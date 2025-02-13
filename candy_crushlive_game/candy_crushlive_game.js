let stressData = [];
let minStress, maxStress;
let slider;
let downloadButton;
let video;
let boundary = [];
let elements = [];
let xEquationInput, yEquationInput;
let candyEmojis = ['🍬', '🍭', '🍫', '🍩', '🍪', '🧁', '🍉', '🍇', '🥨', '🍎'];

function setup() {
  createCanvas(800, 600);
  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();

  xEquationInput = createInput('width / 2 + 200 * cos(t)');
  xEquationInput.position(10, height + 10);
  
  yEquationInput = createInput('height / 2 + 150 * sin(t)');
  yEquationInput.position(10, height + 40);
  
  slider = createSlider(1, 1000, 1000, 1);
  slider.position(10, height + 70);
  
  downloadButton = createButton('Download CSV');
  downloadButton.position(10, height + 100);
  downloadButton.mousePressed(downloadCSV);
  
  generateClosedCurve();
  generateElementsInside();
  stressData = generateRandomStressData(elements.length);
}

function draw() {
  image(video, 0, 0, width, height);
  let n = slider.value();
  
  noFill();
  stroke(0);
  beginShape();
  for (let p of boundary) {
    vertex(p.x, p.y);
  }
  endShape(CLOSE);
  
  textSize(20);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < min(n, elements.length); i++) {
    let e = elements[i];
    let emoji = random(candyEmojis);
    text(emoji, e.x + e.w / 2, e.y + e.h / 2);
  }
}

function generateClosedCurve() {
  boundary = [];
  let xEquation = xEquationInput.value();
  let yEquation = yEquationInput.value();
  
  for (let t = 0; t < TWO_PI; t += 0.1) {
    let x = eval(xEquation);
    let y = eval(yEquation);
    boundary.push({ x, y });
  }
}

function generateElementsInside() {
  elements = [];
  let stepX = 40, stepY = 40;
  for (let x = 50; x < width - 50; x += stepX) {
    for (let y = 50; y < height - 50; y += stepY) {
      if (pointInPolygon({ x: x + stepX / 2, y: y + stepY / 2 }, boundary)) {
        elements.push({ x, y, w: stepX, h: stepY });
      }
    }
  }
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

function downloadCSV() {
  let csvContent = 'Element,X,Y,Width,Height\n' + 
    elements.map((row, index) => `${index},${row.x},${row.y},${row.w},${row.h}`).join('\n');
  let blob = new Blob([csvContent], { type: 'text/csv' });
  let a = createA(URL.createObjectURL(blob), 'elements_data.csv');
  a.attribute('download', 'elements_data.csv');
  a.elt.click();
}
