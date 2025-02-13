import os
import requests
import zipfile
import io
import math
import rasterio
import rasterio.mask
import geopandas as gpd
import cv2
import numpy as np

def download_shapefile(url, extract_path="."):
    """
    Downloads a ZIP file from the given URL and extracts its contents.
    The ZIP should contain all the necessary shapefile components (.shp, .shx, .dbf, etc.).
    """
    print("Downloading Chennai boundary shapefile from:", url)
    response = requests.get(url)
    if response.status_code == 200:
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(path=extract_path)
        print("Download and extraction successful.")
    else:
        raise Exception(f"Failed to download shapefile. Status code: {response.status_code}")

def ensure_shapefile_exists(shapefile_path, download_url):
    """
    Checks whether the shapefile exists; if not, downloads and extracts it.
    """
    if not os.path.exists(shapefile_path):
        print(f"{shapefile_path} not found. Attempting download...")
        download_shapefile(download_url, extract_path=os.path.dirname(shapefile_path) or ".")
        if not os.path.exists(shapefile_path):
            raise Exception("Shapefile still not found after download attempt.")
    else:
        print(f"Found shapefile: {shapefile_path}")

def crop_raster(raster_path, shapefile_path, output_tif):
    """
    Crops the input raster using the boundary defined in the shapefile.
    """
    boundary = gpd.read_file(shapefile_path)
    with rasterio.open(raster_path) as src:
        if boundary.crs != src.crs:
            boundary = boundary.to_crs(src.crs)
        out_image, out_transform = rasterio.mask.mask(src, boundary.geometry, crop=True)
        out_meta = src.meta.copy()
    out_meta.update({
        "driver": "GTiff",
        "height": out_image.shape[1],
        "width": out_image.shape[2],
        "transform": out_transform
    })
    with rasterio.open(output_tif, "w", **out_meta) as dest:
        dest.write(out_image)
    print("Cropped raster saved as:", output_tif)

def convert_tif_to_png(input_tif, output_png):
    """
    Converts a single-band GeoTIFF to a PNG image.
    """
    with rasterio.open(input_tif) as src:
        data = src.read(1)
    cv2.imwrite(output_png, data)
    print("Raster converted to PNG:", output_png)

def extrude_polygon(vertices_2d, height):
    """
    Extrudes a 2D polygon to create a 3D mesh.
    Returns a list of vertices and faces (faces are defined using 1-indexed vertex indices).
    """
    n = len(vertices_2d)
    # Base (z=0) and top (z=height) vertices
    vertices = [(x, y, 0) for x, y in vertices_2d] + [(x, y, height) for x, y in vertices_2d]
    # Create side faces (quads)
    faces = [(i+1, (i+1)%n+1, (i+1)%n+n+1, i+n+1) for i in range(n)]
    # Base face and top face (reverse order so normals point outwards)
    faces.append(tuple(range(1, n+1)))
    faces.append(tuple(range(2*n, n, -1)))
    return vertices, faces

def write_obj(filename, vertices, faces):
    """
    Writes the vertices and faces of a 3D mesh to an OBJ file.
    """
    with open(filename, "w") as f:
        for v in vertices:
            f.write("v {} {} {}\n".format(v[0], v[1], v[2]))
        for face in faces:
            f.write("f " + " ".join(str(idx) for idx in face) + "\n")

def process_building_shadows(image_path, output_obj,
                             pixel_scale=0.5,
                             sun_elevation_deg=45,
                             sun_azimuth_deg=135,
                             min_area_threshold=100):
    """
    Detects building shadows in the PNG image, estimates building heights,
    extrudes the footprints to 3D, and writes the result to an OBJ file.
    """
    sun_elevation_rad = math.radians(sun_elevation_deg)
    sun_azimuth_rad = math.radians(sun_azimuth_deg)
    # Shadow extends opposite to the sun's direction:
    sun_vec = (math.sin(sun_azimuth_rad), math.cos(sun_azimuth_rad))
    
    img = cv2.imread(image_path)
    if img is None:
        print("Error: Image not found:", image_path)
        return
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 50, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
    
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    all_vertices = []
    all_faces = []
    vertex_offset = 0
    
    for cnt in contours:
        if cv2.contourArea(cnt) < min_area_threshold:
            continue
        rect = cv2.minAreaRect(cnt)
        box = np.array(cv2.boxPoints(rect))
        shadow_length_pixels = max(rect[1])
        building_height = shadow_length_pixels * pixel_scale * math.tan(sun_elevation_rad)
        box_m = box * pixel_scale
        shift_amount = (shadow_length_pixels * pixel_scale) / 2.0
        shift_vector = (shift_amount * sun_vec[0], shift_amount * sun_vec[1])
        footprint = box_m + np.array(shift_vector)
        vertices, faces = extrude_polygon(footprint.tolist(), building_height)
        for v in vertices:
            all_vertices.append(v)
        for face in faces:
            all_faces.append(tuple(idx + vertex_offset for idx in face))
        vertex_offset += len(vertices)
    
    write_obj(output_obj, all_vertices, all_faces)
    print("OBJ file saved as:", output_obj)

if __name__ == '__main__':
    # File paths (update these paths as needed)
    raster_path = "chennai_map.tif"          # Input raster (GeoTIFF) file
    shapefile_path = "Chennai_boundary.shp"  # Expected shapefile path after extraction
    cropped_tif = "chennai_map_cropped.tif"    # Cropped raster output
    png_path = "chennai_map_cropped.png"       # PNG conversion output
    output_obj_file = "buildings.obj"          # 3D OBJ model output

    # Updated download URL from ShiftCities for Chennai administrative boundaries
    download_url = "https://datahub.shiftcities.org/datasets/5b1072dbce9d4a5780663d61d0b62158/download"
    
    # Ensure the shapefile exists (download if missing)
    try:
        ensure_shapefile_exists(shapefile_path, download_url)
    except Exception as e:
        print("Error ensuring shapefile exists:", e)
        exit(1)
    
    # Crop the raster using the boundary from the shapefile
    crop_raster(raster_path, shapefile_path, cropped_tif)
    
    # Convert the cropped raster to PNG
    convert_tif_to_png(cropped_tif, png_path)
    
    # Process building shadows and export a 3D OBJ model
    process_building_shadows(png_path, output_obj_file)

