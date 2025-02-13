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
}

function draw() {
  background(0);
  domeSize = domeSlider.value();
  gridSize = gridSlider.value();
  
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
  
  // Draw the dome patches and the fountain arcs
  drawDome(radius, grid);
}

function drawDome(radius, grid) {
  stroke(255);
  fill(0, 150, 255, 50);
  
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Map grid indices to spherical angles (only half-sphere for dome)
      let theta1 = map(i, 0, grid, 0, HALF_PI);
      let theta2 = map(i + 1, 0, grid, 0, HALF_PI);
      let phi1 = map(j, 0, grid, 0, TWO_PI);
      let phi2 = map(j + 1, 0, grid, 0, TWO_PI);
      
      // Compute vertices for the current patch
      let p1 = spherePoint(radius, theta1, phi1);
      let p2 = spherePoint(radius, theta1, phi2);
      let p3 = spherePoint(radius, theta2, phi1);
      let p4 = spherePoint(radius, theta2, phi2);
      
      // Draw the dome patch as a quadrilateral
      beginShape();
      vertex(p1.x, p1.y, p1.z);
      vertex(p2.x, p2.y, p2.z);
      vertex(p4.x, p4.y, p4.z);
      vertex(p3.x, p3.y, p3.z);
      endShape(CLOSE);
      
      // Calculate the center of this patch (red dot location)
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
      
      // Draw a fountain arc from the dome's center (origin) toward the patch center,
      // with a blinking red segment (inside) and a green segment (outside)
      drawFountainArc(center);
    }
  }
}

// This function draws a parabolic arc from the origin to an extended endpoint
// in the direction of the given patch center. The arc is split into two segments.
// The inner segment (from the origin up to the dome's surface) is drawn in blinking laser red,
// while the outer segment (from the dome surface to an extended endpoint) is drawn in bright green.
function drawFountainArc(patchCenter) {
  // Extend the arc past the dome surface by an extension factor.
  // The patchCenter is on the dome (distance = domeSize); extendedEndpoint lies outside.
  let extensionFactor = 1.2;
  let extendedEndpoint = p5.Vector.mult(patchCenter, extensionFactor);
  
  // Determine the t-value where the arc meets the dome surface.
  // Since patchCenter is at distance domeSize and extendedEndpoint is extensionFactor*domeSize,
  // the dome surface corresponds to t = 1/extensionFactor.
  let tSurface = 1 / extensionFactor;
  
  let steps = 20;
  let arcHeight = 50; // Adjust the height of the parabolic curve
  
  // First segment: from t = 0 to t = tSurface (inside the dome)
  // Draw in blinking laser red.
  if (frameCount % 30 < 15) {  // Blink on for half the frames
    stroke(255, 0, 0); // laser red
    noFill();
    beginShape();
    for (let i = 0; i <= steps; i++) {
      let t = i / steps;
      if (t > tSurface) break; // only draw up to the dome surface
      let P = p5.Vector.lerp(createVector(0, 0, 0), extendedEndpoint, t);
      // Add a parabolic offset in z; 4*t*(1-t) peaks at t=0.5
      P.z += arcHeight * 4 * t * (1 - t);
      vertex(P.x, P.y, P.z);
    }
    endShape();
  }
  
  // Second segment: from t = tSurface to t = 1 (outside the dome)
  // Draw in bright green.
  stroke(0, 255, 0); // green shining
  noFill();
  beginShape();
  for (let i = 0; i <= steps; i++) {
    let t = i / steps;
    if (t < tSurface) continue; // skip the inner part
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
  
  // Overlay a 20x20 grid on top of the camera feed
  push();
  translate(0, height / 2 - 100, 1);
  noFill();
  stroke(255, 255, 0);
  let gridCount = 20;
  let planeSize = 200;
  let step = planeSize / gridCount;
  
  // Draw vertical grid lines
  for (let i = 0; i <= gridCount; i++) {
    let x = -planeSize / 2 + i * step;
    line(x, -planeSize / 2, 0, x, planeSize / 2, 0);
  }
  
  // Draw horizontal grid lines
  for (let j = 0; j <= gridCount; j++) {
    let y = -planeSize / 2 + j * step;
    line(-planeSize / 2, y, 0, planeSize / 2, y, 0);
  }
  pop();
}

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
