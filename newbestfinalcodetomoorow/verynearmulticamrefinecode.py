import cv2
import numpy as np
import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLU import *
import math
import os
import random

# -------------------------------
# Global parameters
# -------------------------------
dome_radius = 300  # Inner dome radius
# Update video_files to include 4 video files
video_folder = "/home/sakthees/Videos/chola-domepython/videos"
video_files = ["tree.mp4", "free.mp4", "sree.mp4"]
speed_factor = 0.5

# Camera parameters
zoom_factor = 1.0
camera_yaw = 0.0
camera_pitch = 0.0

# Trajectory data (unchanged from before)
trajectories = []    # List of (start_point, end_point) tuples for drawn trajectory lines
dome_hits = []       # Permanent red hit points on the dome when the trajectory first enters
inside_tracks = []   # Yellow locus for the portion of the trajectory inside the dome
base_hits = []       # Red points on the base circle of the dome

# -------------------------------
# Initialize webcam and video files
# -------------------------------
cap_webcam = cv2.VideoCapture(0)
if not cap_webcam.isOpened():
    print("Error: Could not open webcam")
    exit()

caps_videos = [cv2.VideoCapture(os.path.join(video_folder, vid)) for vid in video_files]
for cap in caps_videos:
    if not cap.isOpened():
        print(f"Error: Could not open video {cap}")
        exit()

# Generate texture IDs
texture_webcam = glGenTextures(1)
texture_videos = glGenTextures(len(caps_videos))

# -------------------------------
# Function to load a frame into a texture
# -------------------------------
def load_texture(cap, texture_id):
    ret, frame = cap.read()
    if not ret:
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Restart video if it ends
        ret, frame = cap.read()
    # Use high resolution from webcam if available
    frame = cv2.flip(frame, 0)
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frame_data = frame.tobytes()
    glBindTexture(GL_TEXTURE_2D, texture_id)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, frame.shape[1], frame.shape[0],
                 0, GL_RGB, GL_UNSIGNED_BYTE, frame_data)
    return True

# -------------------------------
# Draw Dome with Textures
# -------------------------------
def draw_textured_dome():
    slices, stacks = 30, 15
    glEnable(GL_TEXTURE_2D)
    # Disable face culling so textures show on both sides
    glDisable(GL_CULL_FACE)
    
    # Loop over stacks and slices to map the dome
    glBegin(GL_QUADS)
    for i in range(stacks):
        theta0 = (i / stacks) * (math.pi / 2)
        theta1 = ((i + 1) / stacks) * (math.pi / 2)
        for j in range(slices):
            phi0 = (j / slices) * 2 * math.pi
            phi1 = ((j + 1) / slices) * 2 * math.pi
            
            # Compute vertices in spherical coordinates
            xA = dome_radius * math.sin(theta0) * math.cos(phi0)
            yA = dome_radius * math.cos(theta0)
            zA = dome_radius * math.sin(theta0) * math.sin(phi0)
            
            xB = dome_radius * math.sin(theta1) * math.cos(phi0)
            yB = dome_radius * math.cos(theta1)
            zB = dome_radius * math.sin(theta1) * math.sin(phi0)
            
            xC = dome_radius * math.sin(theta1) * math.cos(phi1)
            yC = dome_radius * math.cos(theta1)
            zC = dome_radius * math.sin(theta1) * math.sin(phi1)
            
            xD = dome_radius * math.sin(theta0) * math.cos(phi1)
            yD = dome_radius * math.cos(theta0)
            zD = dome_radius * math.sin(theta0) * math.sin(phi1)
            
            # Determine which texture to use for this quad:
            # Convert phi to an adjusted value in [-pi, pi]
            phi_avg = (phi0 + phi1) / 2.0
            if phi_avg > math.pi:
                phi_adjusted = phi_avg - 2 * math.pi
            else:
                phi_adjusted = phi_avg
            
            # If near the top (small theta) use live webcam feed
            if theta0 < 0.3:
                # Use webcam texture
                load_texture(cap_webcam, texture_webcam)
                glBindTexture(GL_TEXTURE_2D, texture_webcam)
            # Else if in front region: |phi_adjusted| <= 45° (pi/4 radians)
            elif abs(phi_adjusted) <= math.pi/4:
                # Divide the front region (90° total) into 4 segments (each 22.5°)
                # Map phi_adjusted from [-pi/4, pi/4] to [0, 1]
                seg_ratio = (phi_adjusted + (math.pi/4)) / (math.pi/2)
                seg_index = int(seg_ratio * 4)
                seg_index = min(max(seg_index, 0), 3)
                load_texture(caps_videos[seg_index], texture_videos[seg_index])
                glBindTexture(GL_TEXTURE_2D, texture_videos[seg_index])
            else:
                # For the rest of the dome, use a default (black) color
                glDisable(GL_TEXTURE_2D)
                glColor3f(0, 0, 0)
            
            # Set texture coordinates and specify vertices for the quad
            if glIsEnabled(GL_TEXTURE_2D):
                glColor3f(1, 1, 1)
                glTexCoord2f(0, 0); glVertex3f(xA, yA, zA)
                glTexCoord2f(0, 1); glVertex3f(xB, yB, zB)
                glTexCoord2f(1, 1); glVertex3f(xC, yC, zC)
                glTexCoord2f(1, 0); glVertex3f(xD, yD, zD)
            else:
                glVertex3f(xA, yA, zA)
                glVertex3f(xB, yB, zB)
                glVertex3f(xC, yC, zC)
                glVertex3f(xD, yD, zD)
            
            # Re-enable texture if it was disabled
            glEnable(GL_TEXTURE_2D)
    glEnd()
    glDisable(GL_TEXTURE_2D)

# -------------------------------
# Draw Trajectories and Hit Points (unchanged)
# -------------------------------
def draw_trajectories():
    glColor3f(1, 0, 0)
    glBegin(GL_LINES)
    for traj in trajectories:
        glVertex3fv(traj[0])
        glVertex3fv(traj[1])
    glEnd()
    
    glPointSize(6)
    glBegin(GL_POINTS)
    for hit in dome_hits:
        glColor3f(1, 0, 0)
        glVertex3fv(hit)
    for track in inside_tracks:
        glColor3f(1, 1, 0)
        glVertex3fv(track)
    for base in base_hits:
        glColor3f(1, 0, 0)
        glVertex3fv(base)
    glEnd()

# -------------------------------
# Generate a Parabolic Trajectory Toward the Dome (unchanged)
# -------------------------------
def generate_parabolic_trajectory():
    angle = random.uniform(0, 2 * math.pi)
    r_start = random.uniform(dome_radius + 100, dome_radius + 300)
    start_x = r_start * math.cos(angle)
    start_z = r_start * math.sin(angle)
    start_y = 0

    angle_end = random.uniform(0, 2 * math.pi)
    r_end = random.uniform(0, dome_radius - 10)
    end_x = r_end * math.cos(angle_end)
    end_z = r_end * math.sin(angle_end)
    end_y = 0

    control_x = (start_x + end_x) / 2
    control_z = (start_z + end_z) / 2
    control_y = random.uniform(dome_radius / 2, dome_radius)  # high arch

    points = []
    num_segments = 50
    entered_dome = False
    for t in np.linspace(0, 1, num_segments):
        bx = (1 - t) ** 2 * start_x + 2 * (1 - t) * t * control_x + t ** 2 * end_x
        by = (1 - t) ** 2 * start_y + 2 * (1 - t) * t * control_y + t ** 2 * end_y
        bz = (1 - t) ** 2 * start_z + 2 * (1 - t) * t * control_z + t ** 2 * end_z
        points.append((bx, by, bz))
        
        r = math.sqrt(bx**2 + bz**2)
        if not entered_dome and r <= dome_radius:
            dome_hits.append((bx, by, bz))
            entered_dome = True
        if r <= dome_radius:
            inside_tracks.append((bx, by, bz))
    
    base_hits.append(points[-1])
    trajectories.append((points[0], points[-1]))

# -------------------------------
# Main Loop with Camera Controls (Arrow keys rotate; +/- zoom; Ctrl+Left click to zoom in continuously)
# -------------------------------
def main():
    global camera_yaw, camera_pitch, zoom_factor
    pygame.init()
    screen = pygame.display.set_mode((800, 600), DOUBLEBUF | OPENGL)
    pygame.display.set_caption("Dome Projection: 4 Videos Front, Webcam Top")
    glEnable(GL_DEPTH_TEST)
    # Disable face culling so both sides are visible
    glDisable(GL_CULL_FACE)
    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(45, 800/600, 0.1, 3000.0)
    glMatrixMode(GL_MODELVIEW)
    
    clock = pygame.time.Clock()
    running = True
    while running:
        # Process events for keyboard and mouse
        for event in pygame.event.get():
            if event.type == QUIT:
                running = False
            if event.type == KEYDOWN:
                if event.key == K_LEFT:
                    camera_yaw -= 0.05
                elif event.key == K_RIGHT:
                    camera_yaw += 0.05
                elif event.key == K_UP:
                    camera_pitch = min(camera_pitch + 0.05, math.pi/2 - 0.1)
                elif event.key == K_DOWN:
                    camera_pitch = max(camera_pitch - 0.05, -math.pi/2 + 0.1)
                elif event.key in (K_PLUS, K_KP_PLUS):
                    zoom_factor = max(0.1, zoom_factor - 0.1)
                elif event.key in (K_MINUS, K_KP_MINUS):
                    zoom_factor += 0.1
        
        # Continuous zoom-in when Ctrl is held and left mouse button is pressed
        if pygame.mouse.get_pressed()[0] and (pygame.key.get_mods() & KMOD_CTRL):
            zoom_factor = max(0.1, zoom_factor - 0.005)
        
        # Randomly generate a parabolic trajectory
        if random.random() < 0.02:
            generate_parabolic_trajectory()
        
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
        glLoadIdentity()
        
        # Compute camera position using spherical coordinates
        distance = 1000 * zoom_factor
        cam_x = distance * math.sin(camera_yaw) * math.cos(camera_pitch)
        cam_y = distance * math.sin(camera_pitch) + dome_radius/2
        cam_z = distance * math.cos(camera_yaw) * math.cos(camera_pitch)
        gluLookAt(cam_x, cam_y, cam_z, 0, dome_radius/2, 0, 0, 1, 0)
        
        draw_textured_dome()
        draw_trajectories()
        
        pygame.display.flip()
        clock.tick(30)
    
    cap_webcam.release()
    for cap in caps_videos:
        cap.release()
    pygame.quit()

if __name__ == "__main__":
    main()

