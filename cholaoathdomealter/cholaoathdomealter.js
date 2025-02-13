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
  
  // Draw the dome patches with added overlays
  drawDome(radius, grid);
}

function drawDome(radius, grid) {
  stroke(255);
  fill(0, 150, 255, 50);
  
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      // Map grid indices to angles
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
      
      // Draw a small red dot at the center of the patch
      push();
      translate(center.x, center.y, center.z);
      noStroke();
      fill(255, 0, 0);
      sphere(2); // small sphere acts as the dot
      pop();
      
      // Draw yellow lines from the dome center (origin) to each corner of the patch
      stroke(255, 255, 0);
      line(0, 0, 0, p1.x, p1.y, p1.z);
      line(0, 0, 0, p2.x, p2.y, p2.z);
      line(0, 0, 0, p3.x, p3.y, p3.z);
      line(0, 0, 0, p4.x, p4.y, p4.z);
    }
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
  
  // Overlay a 20x20 grid on top of the camera feed
  push();
  // Move to the same position and slightly in front of the plane
  translate(0, height / 2 - 100, 1);
  noFill();
  stroke(255, 255, 0);
  let gridCount = 20;
  let planeSize = 200;
  let step = planeSize / gridCount;
  
  // Vertical grid lines
  for (let i = 0; i <= gridCount; i++) {
    let x = -planeSize / 2 + i * step;
    line(x, -planeSize / 2, 0, x, planeSize / 2, 0);
  }
  
  // Horizontal grid lines
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
