let video;
let domeSlider, gridSlider;
let domeSize = 300;
let gridSize = 20; // best if set to 20 to match the camera grid

// View objects for the three dome views (top, left, right)
let topView, sideViewLeft, sideViewRight;
let currentView = null;
let topRotation = 0;
let sideRotationXLeft = 0; // left dome rotation X-axis
let sideRotationYLeft = 0; // left dome rotation Y-axis
let sideRotationXRight = 0; // right dome rotation X-axis
let sideRotationYRight = 0; // right dome rotation Y-axis

// Global variables for the first fountain arc (set 1)
let toggleTrajectoryButton, trajectorySlider;
let exportButton, exportDiv;
let globalExtensionFactor = 1.2; // used for first set fountain arc
let arcHeight = 50;            // parabolic offset height

// --- New variables for the second fountain arc (set 2) ---
let toggleTrajectoryButton2, trajectorySlider2;
let exportCSVButton;  // new export button for CSV (set 2)
// per-patch extension factors for set 2 (2D array, 20x20)
let patchExtensionFactors2 = [];

// --- Variables for the camera grid overlay (20x20) ---
let cameraGridCount = 20;      // fixed grid for camera overlay
let cameraOverlayX = 580;      // top-left x-position (DOM pixels)
let cameraOverlayY = 380;      // top-left y-position (DOM pixels)
let cameraOverlaySize = 200;   // size (width and height in pixels)
let cameraButtons = [];        // 2D array for camera grid buttons

// When a camera grid button is pressed, we record the selected indices.
let selectedCameraRow = -1;
let selectedCameraCol = -1;

function setup() {
  createCanvas(800, 600, WEBGL);
  
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  // Dome controls
  domeSlider = createSlider(100, 600, 300, 1);
  domeSlider.position(10, 10);
  gridSlider = createSlider(5, 40, 20, 1); // default to 20 for better matching
  gridSlider.position(10, 40);
  
  // View objects
  topView = { pos: createVector(0, -200, 0), dragging: false };
  sideViewLeft = { pos: createVector(-300, 0, 0), dragging: false };
  sideViewRight = { pos: createVector(300, 0, 0), dragging: false };
  
  // --- First set controls (global for fountain arc set 1) ---
  toggleTrajectoryButton = createButton("Adjust Trajectory (Set 1)");
  toggleTrajectoryButton.position(10, height - 60);
  toggleTrajectoryButton.mousePressed(toggleTrajectorySlider);
  
  trajectorySlider = createSlider(1.0, 2.0, 1.2, 0.01);
  trajectorySlider.position(150, height - 60);
  trajectorySlider.style("width", "200px");
  trajectorySlider.hide();
  
  exportButton = createButton("Export Parabola (Set 1)");
  exportButton.position(10, height - 30);
  exportButton.mousePressed(exportParabola);
  
  exportDiv = createDiv("");
  exportDiv.position(10, height - 100);
  exportDiv.style("color", "white");
  
  // --- Second set controls (per-patch, for fountain arc set 2) ---
  toggleTrajectoryButton2 = createButton("Adjust Trajectory (Set 2)");
  toggleTrajectoryButton2.position(370, height - 60);
  toggleTrajectoryButton2.mousePressed(toggleTrajectorySlider2);
  
  trajectorySlider2 = createSlider(1.0, 2.0, 1.2, 0.01);
  trajectorySlider2.position(520, height - 60);
  trajectorySlider2.style("width", "200px");
  // Rotate the second slider vertically
  trajectorySlider2.style("transform", "rotate(-90deg)");
  trajectorySlider2.style("transform-origin", "left top");
  trajectorySlider2.hide();
  
  exportCSVButton = createButton("Export CSV (Set 2)");
  exportCSVButton.position(370, height - 30);
  exportCSVButton.mousePressed(exportCSV);
  
  // --- Create the camera grid overlay (20x20) ---
  for (let i = 0; i < cameraGridCount; i++) {
    cameraButtons[i] = [];
    patchExtensionFactors2[i] = []; // initialize second set factors
    for (let j = 0; j < cameraGridCount; j++) {
      // Initialize each patch's extension factor for set 2 with default value 1.2
      patchExtensionFactors2[i][j] = 1.2;
      let btn = createButton("");
      btn.size(15, 15);
      btn.style("background-color", "rgba(255,255,255,0.3)");
      // Compute absolute position for the button
      let cellSize = cameraOverlaySize / cameraGridCount;
      let x = cameraOverlayX + j * cellSize;
      let y = cameraOverlayY + i * cellSize;
      btn.position(x, y);
      // When pressed, select that camera cell
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
  
  // Update the first set's global extension factor if its slider is visible
  if (trajectorySlider.elt.style.display !== "none") {
    globalExtensionFactor = trajectorySlider.value();
  }
  // Update the second set's per-patch factor if its slider is visible and a patch is selected
  if (trajectorySlider2.elt.style.display !== "none" && selectedCameraRow != -1 && selectedCameraCol != -1) {
    patchExtensionFactors2[selectedCameraRow][selectedCameraCol] = trajectorySlider2.value();
  }
  
  // --- Draw the three dome views as before ---
  // Top view
  push();
  translate(topView.pos.x, topView.pos.y, topView.pos.z);
  rotateY(topRotation);
  drawDomeWithScreen(domeSize, gridSize);
  pop();
  
  // Left side view
  push();
  translate(sideViewLeft.pos.x, sideViewLeft.pos.y, sideViewLeft.pos.z);
  rotateX(sideRotationXLeft);
  rotateY(sideRotationYLeft);
  drawDomeWithScreen(domeSize, gridSize);
  pop();
  
  // Right side view
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
  
  // Draw dome patches with both fountain arc sets
  drawDome(radius, grid);
}

function drawDome(radius, grid) {
  stroke(255);
  fill(0, 150, 255, 50);
  
  // Loop over the dome grid (assumed to be similar to camera grid)
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Map grid indices to spherical angles for the dome
      let theta1 = map(i, 0, grid, 0, HALF_PI);
      let theta2 = map(i + 1, 0, grid, 0, HALF_PI);
      let phi1 = map(j, 0, grid, 0, TWO_PI);
      let phi2 = map(j + 1, 0, grid, 0, TWO_PI);
      
      // Compute the four vertices for this patch
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
      
      // Calculate the patch center (average of vertices)
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
      
      // --- Draw first fountain arc (set 1) ---
      drawFountainArc1(center);
      
      // --- Draw second fountain arc (set 2) ---
      // Map dome patch indices (i,j) to camera grid indices (assumed 20x20)
      let mappedRow = floor(i / grid * cameraGridCount);
      let mappedCol = floor(j / grid * cameraGridCount);
      let factor2 = patchExtensionFactors2[mappedRow][mappedCol];
      drawFountainArc2(center, factor2);
    }
  }
}

// First fountain arc: inner segment blinks in slow laser red; outer segment is bright green.
function drawFountainArc1(patchCenter) {
  let extensionFactor = globalExtensionFactor;
  let extendedEndpoint = p5.Vector.mult(patchCenter, extensionFactor);
  let tSurface = 1 / extensionFactor;
  let steps = 20;
  
  // Inner segment: blinking laser red (slow blink)
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

// Second fountain arc (Set 2): inner segment blinks in pink (fast blink) and outer segment in fast blinking laser red.
// In this version, the exported polynomial for Set 2 is computed from the dome patch's "base".
// For the selected patch, we compute the base point as the point at the lower boundary of the patch,
// i.e. using theta2 (for that row) instead of the patch center.
function drawFountainArc2(patchCenter, extFactor2) {
  let extensionFactor = extFactor2;
  let extendedEndpoint = p5.Vector.mult(patchCenter, extensionFactor);
  let tSurface = 1 / extensionFactor;
  let steps = 20;
  
  // Inner segment: blinking pink (fast blink: period ~15 frames)
  if (frameCount % 15 < 7) {
    stroke(255, 105, 180); // pink
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
  
  // Outer segment: blinking laser-shine red (period ~10 frames)
  if (frameCount % 10 < 5) {
    stroke(255, 0, 0);
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
}

function drawBottomCameraView() {
  // Draw the camera feed as a textured plane
  push();
  translate(0, height / 2 - 100, 0);
  texture(video);
  noStroke();
  plane(200, 200);
  pop();
  
  // Draw the yellow grid overlay on the camera feed
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

// Helper: Convert spherical coordinates to Cartesian.
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

// Toggle visibility for first set trajectory slider.
function toggleTrajectorySlider() {
  if (trajectorySlider.elt.style.display === "none") {
    trajectorySlider.show();
  } else {
    trajectorySlider.hide();
  }
}

// Toggle visibility for second set trajectory slider.
function toggleTrajectorySlider2() {
  if (trajectorySlider2.elt.style.display === "none") {
    trajectorySlider2.show();
  } else {
    trajectorySlider2.hide();
  }
}

// When a camera grid button is pressed, mark that cell as selected,
// update both sliders to the stored extension factors, and visually highlight the selected button.
function selectCameraPatch(row, col) {
  selectedCameraRow = row;
  selectedCameraCol = col;
  // For Set 1, use the global slider (unchanged)
  trajectorySlider.value(globalExtensionFactor);
  trajectorySlider.show();
  // For Set 2, update the vertical slider with the stored per-patch value
  trajectorySlider2.value(patchExtensionFactors2[row][col]);
  trajectorySlider2.show();
  
  // Highlight the selected button and reset others
  for (let i = 0; i < cameraGridCount; i++) {
    for (let j = 0; j < cameraGridCount; j++) {
      cameraButtons[i][j].style("border", "none");
    }
  }
  cameraButtons[row][col].style("border", "2px solid red");
}

// Export the first set fountain arc (polynomial) for the selected patch.
function exportParabola() {
  if (selectedCameraRow == -1 || selectedCameraCol == -1) {
    exportDiv.html("No camera patch selected for Set 1!");
    return;
  }
  let G = gridSlider.value();
  // Map selected camera cell to dome grid patch indices
  let domeRow = floor(selectedCameraRow * (G / cameraGridCount));
  let domeCol = floor(selectedCameraCol * (G / cameraGridCount));
  let theta = map(domeRow + 0.5, 0, G, 0, HALF_PI);
  let phi = map(domeCol + 0.5, 0, G, 0, TWO_PI);
  let patchCenter = spherePoint(domeSize, theta, phi);
  let extendedEndpoint = p5.Vector.mult(patchCenter, globalExtensionFactor);
  
  let x_poly = `x(t) = ${nf(extendedEndpoint.x, 1, 2)} * t`;
  let y_poly = `y(t) = ${nf(extendedEndpoint.y, 1, 2)} * t`;
  let z_poly = `z(t) = (${nf(extendedEndpoint.z + 4 * arcHeight, 1, 2)}) * t - ${nf(4 * arcHeight, 1, 2)} * t^2`;
  
  exportDiv.html(x_poly + "<br>" + y_poly + "<br>" + z_poly);
}

// Export the second set fountain arc as CSV for the selected patch.
// In this version the polynomial is computed from the "base" of the dome patch.
// For the selected patch, we compute the base point using the lower boundary of the patch.
// Let G = gridSlider.value(); the patch row index in the dome grid is domeRow.
// We set baseTheta = map(domeRow+1, 0, G, 0, HALF_PI) and use the same phi as computed.
function exportCSV() {
  if (selectedCameraRow == -1 || selectedCameraCol == -1) {
    exportDiv.html("No camera patch selected for Set 2!");
    return;
  }
  let G = gridSlider.value();
  let domeRow = floor(selectedCameraRow * (G / cameraGridCount));
  let domeCol = floor(selectedCameraCol * (G / cameraGridCount));
  let phi = map(domeCol + 0.5, 0, G, 0, TWO_PI);
  // Compute baseTheta for the patch (using the lower boundary)
  let baseTheta = map(domeRow + 1, 0, G, 0, HALF_PI);
  let basePoint = spherePoint(domeSize, baseTheta, phi);
  // Also compute the patch center (using midpoint theta)
  let centerTheta = map(domeRow + 0.5, 0, G, 0, HALF_PI);
  let patchCenter = spherePoint(domeSize, centerTheta, phi);
  // Get the per-patch extension factor for Set 2
  let extFactor2 = patchExtensionFactors2[selectedCameraRow][selectedCameraCol];
  // Compute extended endpoint starting at basePoint and going toward patchCenter
  let diff = p5.Vector.sub(patchCenter, basePoint);
  let extendedEndpoint = p5.Vector.add(basePoint, p5.Vector.mult(diff, extFactor2));
  
  // Now the polynomial functions for the pink trajectory (Set 2) are computed as:
  // x(t) = basePoint.x + (extendedEndpoint.x - basePoint.x) * t
  // y(t) = basePoint.y + (extendedEndpoint.y - basePoint.y) * t
  // z(t) = basePoint.z + (extendedEndpoint.z - basePoint.z) * t + arcHeight * 4 * t * (1-t)
  let x_poly = nf(basePoint.x, 1, 2) + " + " + nf(extendedEndpoint.x - basePoint.x, 1, 2) + " * t";
  let y_poly = nf(basePoint.y, 1, 2) + " + " + nf(extendedEndpoint.y - basePoint.y, 1, 2) + " * t";
  let z_poly = nf(basePoint.z, 1, 2) + " + " + nf(extendedEndpoint.z - basePoint.z, 1, 2) + " * t + " + nf(4 * arcHeight, 1, 2) + " * t * (1-t)";
  
  let csvContent = "Function,Polynomial\n";
  csvContent += "x(t)," + x_poly + "\n";
  csvContent += "y(t)," + y_poly + "\n";
  csvContent += "z(t)," + z_poly + "\n";
  
  exportDiv.html("<pre>" + csvContent + "</pre>");
}
