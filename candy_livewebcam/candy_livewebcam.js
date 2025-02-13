let grid = [];
let cols = 10, rows = 10;
let cellSize = 50;
let colors = [];
let emojis = ['🍬', '🍭', '🍫', '🍪', '🍩', '🍉', '🍇', '🍊', '🍓', '🥝'];
let boundary = [];
let video;
let startX, startY;
let dragging = false;
let lastMoveTime = 0;
let moveDelay = 100; // Reduce delay for faster movement

function setup() {
  createCanvas(800, 800);
  video = createCapture(VIDEO);
  video.size(800, 800);
  video.hide();
  generateClosedCurve();
  initializeGrid();
}

function draw() {
  image(video, 0, 0, width, height);
  drawBoundary();
  drawGrid();
}

function initializeGrid() {
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      let x = i * cellSize;
      let y = j * cellSize;
      if (pointInPolygon({ x: x + cellSize / 2, y: y + cellSize / 2 }, boundary)) {
        grid[i][j] = floor(random(emojis.length));
      } else {
        grid[i][j] = -1;
      }
    }
  }
}

function drawGrid() {
  textSize(32);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j] !== -1) {
        let x = i * cellSize;
        let y = j * cellSize;
        text(emojis[grid[i][j]], x + cellSize / 2, y + cellSize / 2);
      }
    }
  }
}

function generateClosedCurve() {
  boundary = [];
  for (let t = 0; t < TWO_PI; t += 0.05) {
    let x = width / 2 + 300 * cos(t) + 70 * cos(5 * t);
    let y = height / 2 + 250 * sin(t) + 50 * sin(7 * t);
    boundary.push({ x, y });
  }
}

function drawBoundary() {
  noFill();
  stroke(0);
  beginShape();
  for (let p of boundary) {
    vertex(p.x, p.y);
  }
  endShape(CLOSE);
}

function pointInPolygon(point, poly) {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    let xi = poly[i].x, yi = poly[i].y;
    let xj = poly[j].x, yj = poly[j].y;
    let intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function mousePressed() {
  startX = floor(mouseX / cellSize);
  startY = floor(mouseY / cellSize);
  if (startX >= 0 && startX < cols && startY >= 0 && startY < rows && grid[startX][startY] !== -1) {
    dragging = true;
  }
}

function mouseReleased() {
  if (dragging && millis() - lastMoveTime > moveDelay) {
    let endX = floor(mouseX / cellSize);
    let endY = floor(mouseY / cellSize);
    if (abs(endX - startX) + abs(endY - startY) === 1 && grid[endX][endY] !== -1) {
      swap(startX, startY, endX, endY);
      checkMatches();
      lastMoveTime = millis();
    }
  }
  dragging = false;
}

function swap(x1, y1, x2, y2) {
  let temp = grid[x1][y1];
  grid[x1][y1] = grid[x2][y2];
  grid[x2][y2] = temp;
}

function checkMatches() {
  let matched = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (grid[i][j] !== -1) {
        if (i < cols - 2 && grid[i][j] === grid[i + 1][j] && grid[i][j] === grid[i + 2][j]) {
          matched.push([i, j], [i + 1, j], [i + 2, j]);
        }
        if (j < rows - 2 && grid[i][j] === grid[i][j + 1] && grid[i][j] === grid[i][j + 2]) {
          matched.push([i, j], [i, j + 1], [i, j + 2]);
        }
      }
    }
  }
  for (let m of matched) {
    grid[m[0]][m[1]] = floor(random(emojis.length));
  }
}
