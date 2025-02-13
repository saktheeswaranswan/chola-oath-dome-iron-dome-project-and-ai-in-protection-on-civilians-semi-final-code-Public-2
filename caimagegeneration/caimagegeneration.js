// This p5.js sketch generates a series of 200×200 black-and-white images 
// using a cellular automaton (Conway’s Game of Life) and saves each frame 
// as a PNG file named "1.png", "2.png", etc.

// Grid dimensions
const cols = 200;
const rows = 200;

// Cellular automata grid (2D array)
let grid;

// Number of images (generations) to generate
const numImages = 10;
let currentGen = 0;

function setup() {
  // Create a 200x200 canvas
  createCanvas(cols, rows);
  
  // Initialize the grid with random black (0) or white (1) cells
  grid = new Array(cols);
  for (let i = 0; i < cols; i++) {
    grid[i] = new Array(rows);
    for (let j = 0; j < rows; j++) {
      grid[i][j] = random() < 0.5 ? 1 : 0;
    }
  }
  
  // Slow down the frame rate so you can see each generation
  frameRate(1);
}

function draw() {
  // Draw the current grid to the canvas
  loadPixels();
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let index = (x + y * cols) * 4;
      // Use white for alive (1) and black for dead (0)
      let c = grid[x][y] === 1 ? 255 : 0;
      pixels[index]     = c;  // Red
      pixels[index + 1] = c;  // Green
      pixels[index + 2] = c;  // Blue
      pixels[index + 3] = 255; // Alpha
    }
  }
  updatePixels();
  
  // Save the current canvas as an image file (e.g., "1.png", "2.png", ...)
  // The filename is based on the current generation number.
  saveCanvas('' + (currentGen + 1), 'png');
  
  // Stop the sketch if the desired number of images has been generated.
  if (currentGen >= numImages - 1) {
    noLoop();
    console.log("Finished generating images.");
    return;
  }
  
  // Compute the next generation using Conway’s Game of Life rules.
  // Wrap-around (toroidal) boundary conditions are applied.
  let nextGrid = new Array(cols);
  for (let x = 0; x < cols; x++) {
    nextGrid[x] = new Array(rows);
    for (let y = 0; y < rows; y++) {
      let state = grid[x][y];
      let neighbors = countNeighbors(x, y);
      let newState;
      
      // Game of Life rules:
      // - A live cell with 2 or 3 live neighbors survives.
      // - A dead cell with exactly 3 live neighbors becomes alive.
      // - Otherwise, the cell dies or remains dead.
      if (state === 1) {
        newState = (neighbors === 2 || neighbors === 3) ? 1 : 0;
      } else {
        newState = (neighbors === 3) ? 1 : 0;
      }
      nextGrid[x][y] = newState;
    }
  }
  
  // Update the grid and the generation counter
  grid = nextGrid;
  currentGen++;
}

// Helper function to count alive neighbors for cell at (x, y)
function countNeighbors(x, y) {
  let sum = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (i === 0 && j === 0) continue;
      // Wrap-around using modulo arithmetic
      let col = (x + i + cols) % cols;
      let row = (y + j + rows) % rows;
      sum += grid[col][row];
    }
  }
  return sum;
}
