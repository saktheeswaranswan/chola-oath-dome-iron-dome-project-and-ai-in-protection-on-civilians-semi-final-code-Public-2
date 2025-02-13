let video;
let domeSlider, gridSlider;
let domeSize = 300;
let gridSize = 10;

// View objects for the three dome views (top, left, right)
let topView, sideViewLeft, sideViewRight;
let currentView = null;
let topRotation = 0;
let sideRotationXLeft = 0; // Left dome rotation X-axis
let sideRotationYLeft = 0; // Left dome rotation Y-axis
let sideRotationXRight = 0; // Right dome rotation X-axis
let sideRotationYRight = 0; // Right dome rotation Y-axis

// Global variables for trajectory control and export (for dome view)
let trajectorySlider, toggleTrajectoryButton;
let exportButton, exportDiv;
let globalExtensionFactor = 1.2; // used for dome fountain arc drawing
let arcHeight = 50; // parabolic offset height for fountain arc

// --- New variables for camera grid overlay ---
let cameraGridCount = 20;            // fixed number of cells (20x20)
let cameraOverlayX = 580;            // top-left x-position of camera grid overlay (DOM coordinates)
let cameraOverlayY = 380;            // top-left y-position of camera grid overlay (DOM coordinates)
let cameraOverlaySize = 200;         // size (width & height) in pixels of the camera overlay region
let cameraButtons = [];              // 2D array for the 20x20 buttons
let patchExtensionFactors = [];      // 2D array (20x20) to store per-patch extension factor values
let selectedCameraRow = -1;          // currently selected camera cell row index
let selectedCameraCol = -1;          // currently selected camera cell column index

function setup() {
  createCanvas(800, 600, WEBGL);
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  domeSlider = createSlider(100, 600, 300, 1);
  domeSlider.position(10, 10);
  
  gridSlider = createSlider(5, 40, 10, 1);
  gridSlider.position(10, 40);
  
  topView = { pos: createVector(0, -200, 0), dragging: false };
  sideViewLeft = { pos: createVector(-300, 0, 0), dragging: false };
  sideViewRight = { pos: createVector(300, 0, 0), dragging: false };
  
  // --- Global trajectory slider & export button (for dome view) ---
  toggleTrajectoryButton = createButton("Adjust Trajectory");
  // Position near the bottom (adjust coordinates as desired)
  toggleTrajectoryButton.position(10, height - 60);
  toggleTrajectoryButton.mousePressed(toggleTrajectorySlider);
  
  trajectorySlider = createSlider(1.0, 2.0, 1.2, 0.01);
  trajectorySlider.position(150, height - 60);
  trajectorySlider.style("width", "200px");
  trajectorySlider.hide(); // hidden until a camera cell is selected
  
  // When the slider is moved, update the extension factor for the selected camera patch
  trajectorySlider.input(() => {
    if (selectedCameraRow != -1 && selectedCameraCol != -1) {
      patchExtensionFactors[selectedCameraRow][selectedCameraCol] = trajectorySlider.value();
    }
  });
  
  exportButton = createButton("Export Parabola");
  exportButton.position(10, height - 30);
  exportButton.mousePressed(exportParabola);
  
  exportDiv = createDiv("");
  exportDiv.position(10, height - 100);
  exportDiv.style("color", "white");
  
  // --- Create a 20x20 matrix of buttons over the camera view ---
  for (let i = 0; i < cameraGridCount; i++) {
    cameraButtons[i] = [];
    patchExtensionFactors[i] = [];
    for (let j = 0; j < cameraGridCount; j++) {
      // Initialize each patch extension factor with the default value
      patchExtensionFactors[i][j] = 1.2;
      // Create a button (with no label) for each cell
      let btn = createButton("");
      // Set a small size (adjust if needed)
      btn.size(15, 15);
      // Style the button so it is visible yet semi-transparent
      btn.style("background-color", "rgba(255, 255, 255, 0.3)");
      // Compute its absolute position within the document (relative to camera overlay region)
      let cellSize = cameraOverlaySize / cameraGridCount;
      let x = cameraOverlayX + j * cellSize;
      let y = cameraOverlayY + i * cellSize;
      btn.position(x, y);
      // When this button is pressed, select this camera patch
      btn.mousePressed(function() {
        selectCameraPatch(i, j);
      });
      cameraButtons[i][j] = btn;
    }
  }
}

function draw() {
  background(0);
  domeSize = domeSlider.value();
  gridSize = gridSlider.value();
  
  // Update the global extension factor for dome fountain arcs (global for now)
  if (trajectorySlider.elt.style.display !== "none") {
    globalExtensionFactor = trajectorySlider.value();
  }
  
  // --- Draw dome views as before ---
  // Top view dome
  push();
  translate(topView.pos.x, topView.pos.y, topView.pos.z);
  rotateY(topRotation);
  drawDomeWithScreen(domeSize, gridSize);
  pop();
  
  // Left side view dome
  push();
  translate(sideViewLeft.pos.x, sideViewLeft.pos.y, sideViewLeft.pos.z);
  rotateX(sideRotationXLeft);
  rotateY(sideRotationYLeft);
  drawDomeWithScreen(domeSize, gridSize);
  pop();
  
  // Right side view dome
  push();
  translate(sideViewRight.pos.x, sideViewRight.pos.y, sideViewRight.pos.z);
  rotateX(sideRotationXRight);
  rotateY(sideRotationYRight);
  drawDomeWithScreen(domeSize, gridSize);
  pop();
  
  drawBottomCameraView();
}

function drawDomeWithScreen(radius, grid) {
  // Draw the video-textured plane behind the dome
  let side = sqrt(2) * radius;
  push();
  translate(0, 0, -0.1);
  texture(video);
  noStroke();
  plane(side, side);
  pop();
  
  // Draw the dome patches and fountain arcs (dome drawing remains unchanged)
  drawDome(radius, grid);
}

function drawDome(radius, grid) {
  stroke(255);
  fill(0, 150, 255, 50);
  
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Map grid indices to spherical angles (for a dome)
      let theta1 = map(i, 0, grid, 0, HALF_PI);
      let theta2 = map(i + 1, 0, grid, 0, HALF_PI);
      let phi1 = map(j, 0, grid, 0, TWO_PI);
      let phi2 = map(j + 1, 0, grid, 0, TWO_PI);
      
      // Compute vertices for the current patch
      let p1 = spherePoint(radius, theta1, phi1);
      let p2 = spherePoint(radius, theta1, phi2);
      let p3 = spherePoint(radius, theta2, phi1);
      let p4 = spherePoint(radius, theta2, phi2);
      
      // Draw the patch (quadrilateral)
      beginShape();
      vertex(p1.x, p1.y, p1.z);
      vertex(p2.x, p2.y, p2.z);
      vertex(p4.x, p4.y, p4.z);
      vertex(p3.x, p3.y, p3.z);
      endShape(CLOSE);
      
      // Calculate the center of this patch
      let center = createVector(
        (p1.x + p2.x + p3.x + p4.x) / 4,
        (p1.y + p2.y + p3.y + p4.y) / 4,
        (p1.z + p2.z + p3.z + p4.z) / 4
      );
      
      // Draw a small red dot at the patch center
      push();
      translate(center.x, center.y, center.z);
      noStroke();
      fill(255, 0, 0);
      sphere(2);
      pop();
      
      // Draw the fountain arc from the dome's center to (and beyond) the patch center
      drawFountainArc(center);
    }
  }
}

// Draws a parabolic fountain arc from the origin to a patch center,
// then extending beyond. It is split into two segments:
// • Inner segment (up to dome surface) drawn as blinking laser red.
// • Outer segment (beyond dome) drawn in bright green.
function drawFountainArc(patchCenter) {
  let extensionFactor = globalExtensionFactor; // global value used for dome drawing
  let extendedEndpoint = p5.Vector.mult(patchCenter, extensionFactor);
  let tSurface = 1 / extensionFactor; // t-value at dome surface
  
  let steps = 20;
  
  // Inner segment: blinking laser red
  if (frameCount % 30 < 15) {
    stroke(255, 0, 0);
    noFill();
    beginShape();
    for (let i = 0; i <= steps; i++) {
      let t = i / steps;
      if (t > tSurface) break;
      let P = p5.Vector.lerp(createVector(0, 0, 0), extendedEndpoint, t);
      P.z += arcHeight * 4 * t * (1 - t);
      vertex(P.x, P.y, P.z);
    }
    endShape();
  }
  
  // Outer segment: bright green
  stroke(0, 255, 0);
  noFill();
  beginShape();
  for (let i = 0; i <= steps; i++) {
    let t = i / steps;
    if (t < tSurface) continue;
    let P = p5.Vector.lerp(createVector(0, 0, 0), extendedEndpoint, t);
    P.z += arcHeight * 4 * t * (1 - t);
    vertex(P.x, P.y, P.z);
  }
  endShape();
}

function drawBottomCameraView() {
  // Draw the camera feed as a textured plane
  push();
  translate(0, height / 2 - 100, 0);
  texture(video);
  noStroke();
  plane(200, 200);
  pop();
  
  // Draw the yellow grid overlay (as before)
  push();
  translate(0, height / 2 - 100, 1);
  noFill();
  stroke(255, 255, 0);
  let gridCount = 20;
  let planeSize = 200;
  let step = planeSize / gridCount;
  for (let i = 0; i <= gridCount; i++) {
    let x = -planeSize / 2 + i * step;
    line(x, -planeSize / 2, 0, x, planeSize / 2, 0);
  }
  for (let j = 0; j <= gridCount; j++) {
    let y = -planeSize / 2 + j * step;
    line(-planeSize / 2, y, 0, planeSize / 2, y, 0);
  }
  pop();
}

// Converts spherical coordinates to Cartesian.
function spherePoint(r, theta, phi) {
  let x = r * sin(theta) * cos(phi);
  let y = r * sin(theta) * sin(phi);
  let z = r * cos(theta);
  return createVector(x, y, z);
}

function mousePressed() {
  if (mouseX < width / 2) {
    currentView = 'left';
  } else {
    currentView = 'right';
  }
}

function mouseDragged() {
  let dx = movedX * 0.01;
  let dy = movedY * 0.01;
  if (currentView === 'left') {
    sideRotationXLeft += dy;
    sideRotationYLeft += dx;
  } else if (currentView === 'right') {
    sideRotationXRight += dy;
    sideRotationYRight += dx;
  }
}

// Toggle the global trajectory slider's visibility.
function toggleTrajectorySlider() {
  if (trajectorySlider.elt.style.display === "none") {
    trajectorySlider.show();
  } else {
    trajectorySlider.hide();
  }
}

// When a camera grid button is pressed, mark that patch as selected,
// update the slider value to the stored extension factor, and visually indicate selection.
function selectCameraPatch(row, col) {
  selectedCameraRow = row;
  selectedCameraCol = col;
  // Update slider to reflect the patch's extension factor
  trajectorySlider.value(patchExtensionFactors[row][col]);
  trajectorySlider.show();
  // Optionally, change button style to show selection (reset others)
  for (let i = 0; i < cameraGridCount; i++) {
    for (let j = 0; j < cameraGridCount; j++) {
      cameraButtons[i][j].style("border", "none");
    }
  }
  cameraButtons[row][col].style("border", "2px solid red");
}

// Export the parabola (as polynomial functions x(t), y(t), z(t))
// for the dome patch corresponding to the selected camera grid cell.
function exportParabola() {
  if (selectedCameraRow == -1 || selectedCameraCol == -1) {
    exportDiv.html("No camera patch selected!");
    return;
  }
  // Use gridSlider.value() as the dome grid count
  let G = gridSlider.value();
  // Map the selected camera cell (0 to cameraGridCount) to a dome patch index (0 to G)
  let domeRow = floor(selectedCameraRow * (G / cameraGridCount));
  let domeCol = floor(selectedCameraCol * (G / cameraGridCount));
  // Compute the corresponding angles for the dome patch center
  let theta = map(domeRow + 0.5, 0, G, 0, HALF_PI);
  let phi = map(domeCol + 0.5, 0, G, 0, TWO_PI);
  let patchCenter = spherePoint(domeSize, theta, phi);
  // Get the extension factor from the selected patch
  let extFactor = patchExtensionFactors[selectedCameraRow][selectedCameraCol];
  let extendedEndpoint = p5.Vector.mult(patchCenter, extFactor);
  
  // For the fountain arc:
  // x(t) = extendedEndpoint.x * t
  // y(t) = extendedEndpoint.y * t
  // z(t) = extendedEndpoint.z * t + arcHeight * 4 * t * (1-t)
  // Rearranged: z(t) = (extendedEndpoint.z + 4 * arcHeight) * t - 4 * arcHeight * t^2
  let x_poly = `x(t) = ${nf(extendedEndpoint.x, 1, 2)} * t`;
  let y_poly = `y(t) = ${nf(extendedEndpoint.y, 1, 2)} * t`;
  let z_poly = `z(t) = (${nf(extendedEndpoint.z + 4 * arcHeight, 1, 2)}) * t - ${nf(4 * arcHeight, 1, 2)} * t^2`;
  
  let exportText = x_poly + "<br>" + y_poly + "<br>" + z_poly;
  exportDiv.html(exportText);
}
