import cv2
import numpy as np
import pygame
from pygame.locals import *
from OpenGL.GL import *
from OpenGL.GLU import *
import math

# Window dimensions
window_width = 800
window_height = 600

# Initialize video capture (webcam)
cap = cv2.VideoCapture(0)
texture_id = None  # Global texture id for webcam feed

# Global variables for rotation and zoom
dome_rotation = 0.0
rotating = False
prev_mouse_x = 0
zoom_factor = 3.0  # Controls camera distance

# New globals for arrow key camera control
camera_yaw = 0.0
camera_pitch = 0.0

# -------------------------------
# Simple slider UI class
# -------------------------------
class Slider:
    def __init__(self, x, y, w, h, min_val, max_val, init_val):
        self.rect = pygame.Rect(x, y, w, h)
        self.min_val = min_val
        self.max_val = max_val
        self.value = init_val
        self.dragging = False

    def update(self, event):
        if event.type == MOUSEBUTTONDOWN:
            if self.rect.collidepoint(event.pos):
                self.dragging = True
                self.set_value_from_mouse(event.pos[0])
        elif event.type == MOUSEBUTTONUP:
            self.dragging = False
        elif event.type == MOUSEMOTION:
            if self.dragging:
                self.set_value_from_mouse(event.pos[0])

    def set_value_from_mouse(self, mouse_x):
        rel = mouse_x - self.rect.x
        fraction = rel / self.rect.width
        fraction = max(0, min(1, fraction))
        self.value = self.min_val + fraction * (self.max_val - self.min_val)

    def draw(self):
        surface = pygame.display.get_surface()
        pygame.draw.rect(surface, (180, 180, 180), self.rect)
        frac = (self.value - self.min_val) / (self.max_val - self.min_val)
        handle_x = self.rect.x + frac * self.rect.width
        handle_rect = pygame.Rect(handle_x - 5, self.rect.y, 10, self.rect.height)
        pygame.draw.rect(surface, (255, 0, 0), handle_rect)

# -------------------------------
# Update the webcam texture from OpenCV
# -------------------------------
def load_texture():
    global texture_id, cap
    ret, frame = cap.read()
    if not ret:
        return
    # Flip vertically and convert BGR to RGB.
    frame = cv2.flip(frame, 0)
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frame_data = frame.tobytes()
    if texture_id is None:
        texture_id = glGenTextures(1)
    glBindTexture(GL_TEXTURE_2D, texture_id)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR)
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR)
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, frame.shape[1], frame.shape[0],
                 0, GL_RGB, GL_UNSIGNED_BYTE, frame_data)

# -------------------------------
# Draw the camera feed as a quad on the ground.
# The quad is inscribed in the dome’s base circle.
# An overlay grid of 20x20 red dots is drawn on the quad.
# -------------------------------
def draw_camera_feed(dome_radius):
    # For a circle of radius R, the inscribed square has side = R*sqrt(2)
    side = dome_radius * math.sqrt(2)
    glPushMatrix()
    glTranslatef(0, 0, 0)
    glEnable(GL_TEXTURE_2D)
    load_texture()
    glBindTexture(GL_TEXTURE_2D, texture_id)
    glColor3f(1, 1, 1)
    glBegin(GL_QUADS)
    glTexCoord2f(0, 0); glVertex3f(-side/2, 0, -side/2)
    glTexCoord2f(1, 0); glVertex3f(side/2, 0, -side/2)
    glTexCoord2f(1, 1); glVertex3f(side/2, 0, side/2)
    glTexCoord2f(0, 1); glVertex3f(-side/2, 0, side/2)
    glEnd()
    glDisable(GL_TEXTURE_2D)
    
    # Draw a 20x20 grid of red dots over the camera feed
    glPointSize(5)
    glColor3f(1, 0, 0)
    glBegin(GL_POINTS)
    for i in range(20):
        for j in range(20):
            dot_x = -side/2 + (i + 0.5) * (side/20)
            dot_z = -side/2 + (j + 0.5) * (side/20)
            glVertex3f(dot_x, 0.001, dot_z)  # slight y-offset to avoid z-fighting
    glEnd()
    
    glPopMatrix()

# -------------------------------
# Draw the dome as square patches.
# The dome is defined by the hemisphere: x^2 + y^2 + z^2 = R^2, y >= 0.
# -------------------------------
def draw_dome_square_patches(dome_radius, grid):
    dx = (2 * dome_radius) / grid
    glEnable(GL_BLEND)
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)
    glColor4f(0.0, 0.6, 1.0, 0.3)  # Transparent blue color
    for i in range(grid):
        for j in range(grid):
            x0 = -dome_radius + i * dx
            z0 = -dome_radius + j * dx
            x1 = x0 + dx
            z1 = z0 + dx
            # Only draw the patch if all four corners lie inside the dome's base circle.
            if (x0*x0 + z0*z0 <= dome_radius*dome_radius and
                x1*x1 + z0*z0 <= dome_radius*dome_radius and
                x1*x1 + z1*z1 <= dome_radius*dome_radius and
                x0*x0 + z1*z1 <= dome_radius*dome_radius):
                y0 = math.sqrt(dome_radius*dome_radius - x0*x0 - z0*z0)
                y1 = math.sqrt(dome_radius*dome_radius - x1*x1 - z0*z0)
                y2 = math.sqrt(dome_radius*dome_radius - x1*x1 - z1*z1)
                y3 = math.sqrt(dome_radius*dome_radius - x0*x0 - z1*z1)
                glBegin(GL_QUADS)
                glVertex3f(x0, y0, z0)
                glVertex3f(x1, y1, z0)
                glVertex3f(x1, y2, z1)
                glVertex3f(x0, y3, z1)
                glEnd()
    glDisable(GL_BLEND)

# -------------------------------
# Render the full scene.
# The camera position is now determined by zoom and the arrow-key controlled yaw/pitch.
# -------------------------------
def render_scene(dome_radius, grid):
    global camera_yaw, camera_pitch
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    
    # Calculate the camera's position using spherical coordinates.
    # Center of interest is at (0, dome_radius/2, 0)
    r = dome_radius * zoom_factor
    center_y = dome_radius / 2.0
    cam_x = r * math.cos(camera_pitch) * math.cos(camera_yaw)
    cam_y = center_y + r * math.sin(camera_pitch)
    cam_z = r * math.cos(camera_pitch) * math.sin(camera_yaw)
    gluLookAt(cam_x, cam_y, cam_z,
              0, center_y, 0,
              0, 1, 0)

    # Rotate the dome (controlled by mouse drag, if desired)
    glPushMatrix()
    glRotatef(math.degrees(dome_rotation), 0, 1, 0)
    draw_camera_feed(dome_radius)
    glDisable(GL_DEPTH_TEST)
    draw_dome_square_patches(dome_radius, grid)
    glEnable(GL_DEPTH_TEST)
    glPopMatrix()
    
    # Optionally draw a red dot at the apex of the dome
    glPushMatrix()
    glColor3f(1, 0, 0)
    glPointSize(10)
    glBegin(GL_POINTS)
    glVertex3f(0, dome_radius, 0)
    glEnd()
    glPopMatrix()

# -------------------------------
# Main loop: set up OpenGL, handle mouse events for rotation/zoom,
# and use sliders to adjust dome size and grid resolution.
# Arrow keys now also allow you to change the camera view.
# -------------------------------
def main():
    global dome_rotation, rotating, prev_mouse_x, zoom_factor, camera_yaw, camera_pitch
    pygame.init()
    pygame.display.set_mode((window_width, window_height), DOUBLEBUF | OPENGL)
    pygame.display.set_caption("Dome with Square Patches and Adjustable Grid")
    glEnable(GL_DEPTH_TEST)
    glClearColor(0, 0, 0, 1)
    
    glMatrixMode(GL_PROJECTION)
    gluPerspective(45, window_width / window_height, 0.1, 1000.0)
    glMatrixMode(GL_MODELVIEW)

    # Slider for dome radius (size) and grid resolution (number of patches)
    dome_slider = Slider(10, 10, 200, 20, 100, 400, 300)
    grid_slider = Slider(10, 40, 200, 20, 5, 80, 20)  # Increase grid resolution up to 80 patches

    clock = pygame.time.Clock()
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == QUIT:
                running = False

            dome_slider.update(event)
            grid_slider.update(event)

            # Mouse drag to rotate the dome.
            if event.type == MOUSEBUTTONDOWN:
                if event.button == 1:
                    # Only start rotating if not interacting with the sliders.
                    if not dome_slider.rect.collidepoint(event.pos) and not grid_slider.rect.collidepoint(event.pos):
                        rotating = True
                        prev_mouse_x = event.pos[0]
            elif event.type == MOUSEBUTTONUP:
                if event.button == 1:
                    rotating = False
            elif event.type == MOUSEMOTION:
                if rotating:
                    dx = event.pos[0] - prev_mouse_x
                    dome_rotation += dx * 0.005
                    prev_mouse_x = event.pos[0]
            # Mouse wheel to zoom.
            if event.type == pygame.MOUSEWHEEL:
                zoom_factor -= event.y * 0.1
                zoom_factor = max(1.0, min(5.0, zoom_factor))
                
            # Use arrow keys to adjust the camera view (yaw and pitch)
            if event.type == KEYDOWN:
                if event.key == K_LEFT:
                    camera_yaw -= 0.05
                elif event.key == K_RIGHT:
                    camera_yaw += 0.05
                elif event.key == K_UP:
                    camera_pitch += 0.05
                    # Limit pitch to avoid flipping
                    camera_pitch = min(camera_pitch, math.pi/2 - 0.1)
                elif event.key == K_DOWN:
                    camera_pitch -= 0.05
                    camera_pitch = max(camera_pitch, -math.pi/2 + 0.1)

        dome_radius = dome_slider.value
        grid = int(grid_slider.value)

        render_scene(dome_radius, grid)
        pygame.display.flip()

        # Draw sliders over the OpenGL view.
        surface = pygame.display.get_surface()
        dome_slider.draw()
        grid_slider.draw()

        clock.tick(30)

    cap.release()
    pygame.quit()

if __name__ == "__main__":
    main()

