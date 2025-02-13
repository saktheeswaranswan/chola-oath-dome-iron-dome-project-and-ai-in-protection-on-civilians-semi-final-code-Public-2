let grid = [];
let cols = 8, rows = 8;
let cellSize = 50;
let colors = [];
let emojis = ['🍬', '🍭', '🍫', '🍪', '🍩'];
let boundary = [];
let dragging = false;
let offsetX = 0, offsetY = 0;
let startX, startY;

function setup() {
  createCanvas(600, 600);
  generateClosedCurve();
  generateColors();
  initializeGrid();
}

function draw() {
  background(255);
  drawBoundary();
  drawGrid();
}

function generateColors() {
  colors = [color(255, 0, 0), color(0, 255, 0), color(0, 0, 255), color(255, 255, 0), color(255, 165, 0)];
}

function initializeGrid() {
  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    for (let j = 0; j < rows; j++) {
      let x = i * cellSize + offsetX;
      let y = j * cellSize + offsetY;
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
        let x = i * cellSize + offsetX;
        let y = j * cellSize + offsetY;
        text(emojis[grid[i][j]], x + cellSize / 2, y + cellSize / 2);
      }
    }
  }
}

function generateClosedCurve() {
  boundary = [];
  for (let t = 0; t < TWO_PI; t += 0.1) {
    let x = width / 2 + 200 * cos(t) + 50 * cos(3 * t);
    let y = height / 2 + 150 * sin(t) + 30 * sin(5 * t);
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
  startX = floor((mouseX - offsetX) / cellSize);
  startY = floor((mouseY - offsetY) / cellSize);
  if (startX >= 0 && startX < cols && startY >= 0 && startY < rows && grid[startX][startY] !== -1) {
    dragging = true;
  }
}

function mouseReleased() {
  if (dragging) {
    let endX = floor((mouseX - offsetX) / cellSize);
    let endY = floor((mouseY - offsetY) / cellSize);
    if (abs(endX - startX) + abs(endY - startY) === 1 && grid[endX][endY] !== -1) {
      swap(startX, startY, endX, endY);
      checkMatches();
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
