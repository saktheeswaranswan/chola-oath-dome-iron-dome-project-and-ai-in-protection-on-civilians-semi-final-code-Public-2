// p5.js sketch: Genetic Algorithm to infer a Cellular Automaton rule
// from a sequence of 200×200 black & white images stored in a folder.
// Images must be named in increasing order (e.g., "1.png", "2.png", etc.)
// and placed in the "images" folder (relative to your sketch).

let images = [];          // Array to hold loaded images
let population = [];      // GA population (array of Rule objects)
let generation = 0;
const maxGenerations = 1000;
const popSize = 50;
const mutationRate = 0.05;

let bestRule;             // Best rule found so far
let bestFitness = Number.MAX_VALUE;

const numImages = 5;      // Update with the number of images available

// Preload images from the "images" folder (named "1.png", "2.png", etc.)
function preload() {
  for (let i = 1; i <= numImages; i++) {
    let img = loadImage('images/' + i + '.png');
    images.push(img);
  }
}

function setup() {
  createCanvas(800, 400);
  // Resize images to 200×200 pixels if needed
  for (let i = 0; i < images.length; i++) {
    images[i].resize(200, 200);
  }
  
  // Initialize the GA population with random candidate rules
  for (let i = 0; i < popSize; i++) {
    population.push(new Rule());
  }
  
  // Optionally slow down the evolution to see progress
  frameRate(5);
}

function draw() {
  // Evaluate fitness for each candidate rule over all consecutive image pairs.
  for (let r of population) {
    r.fitness = evaluateFitness(r);
  }
  
  // Sort the population so that lower fitness (fewer mismatches) is first.
  population.sort((a, b) => a.fitness - b.fitness);
  
  // Update our best rule if the current best candidate is better.
  if (population[0].fitness < bestFitness) {
    bestFitness = population[0].fitness;
    bestRule = population[0].copy(); // Copy to save the best rule.
  }
  
  // Display current generation info and visualize the result.
  background(220);
  fill(0);
  textSize(16);
  text("Generation: " + generation, 10, 20);
  text("Best Fitness (Error Count): " + bestFitness, 10, 40);
  
  // Show the first input image and the predicted next state.
  if (images.length > 0) {
    image(images[0], 10, 60);
    let predicted = bestRule.apply(images[0]);
    image(predicted, 220, 60);
    text("Left: Input State\nRight: Predicted Next State", 10, 280);
  }
  
  // Stop evolving if the maximum number of generations is reached.
  if (generation >= maxGenerations) {
    noLoop();
    console.log("Finished evolution at generation " + generation);
    return;
  }
  
  // Generate the next generation using elitism and genetic operators.
  let newPopulation = [];
  // Elitism: carry over the best candidate unchanged.
  newPopulation.push(bestRule.copy());
  
  // Fill the remainder of the population.
  while (newPopulation.length < popSize) {
    let parent1 = tournamentSelection(population, 5);
    let parent2 = tournamentSelection(population, 5);
    let child = parent1.crossover(parent2);
    child.mutate(mutationRate);
    newPopulation.push(child);
  }
  
  population = newPopulation;
  generation++;
}

// Evaluate fitness by comparing the predicted next state to the actual next image.
// The fitness is the sum of pixel mismatches over all consecutive image pairs.
function evaluateFitness(rule) {
  let error = 0;
  // For each pair of consecutive images:
  for (let k = 0; k < images.length - 1; k++) {
    let current = images[k];
    let next = images[k + 1];
    let predicted = rule.apply(current);
    predicted.loadPixels();
    next.loadPixels();
    
    // Since the images are black and white, check the red channel (every 4th value).
    for (let i = 0; i < predicted.pixels.length; i += 4) {
      let predVal = predicted.pixels[i] > 127 ? 1 : 0;
      let actualVal = next.pixels[i] > 127 ? 1 : 0;
      if (predVal !== actualVal) {
        error++;
      }
    }
  }
  return error;
}

// Tournament selection: randomly choose 'tournamentSize' candidates and return the best.
function tournamentSelection(pop, tournamentSize) {
  let best = null;
  for (let i = 0; i < tournamentSize; i++) {
    let idx = floor(random(pop.length));
    let candidate = pop[idx];
    if (best == null || candidate.fitness < best.fitness) {
      best = candidate;
    }
  }
  return best;
}

// Rule class: Encapsulates a CA rule represented as a 2x9 lookup table.
// table[currentState][neighborCount] yields the next state (0 or 1).
class Rule {
  constructor() {
    // Create a 2x9 table.
    this.table = [[], []];
    this.fitness = Number.MAX_VALUE;
    this.randomize();
  }
  
  // Randomly initialize the rule (each entry is 0 or 1).
  randomize() {
    for (let state = 0; state < 2; state++) {
      this.table[state] = [];
      for (let count = 0; count < 9; count++) {
        this.table[state][count] = floor(random(2));
      }
    }
  }
  
  // Apply the CA rule to an input image and return the new image.
  apply(stateImg) {
    let w = stateImg.width;
    let h = stateImg.height;
    let newImg = createImage(w, h);
    stateImg.loadPixels();
    newImg.loadPixels();
    
    // Iterate over every pixel.
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let idx = (x + y * w) * 4;
        // Determine current cell state (using red channel as proxy)
        let cell = stateImg.pixels[idx] > 127 ? 1 : 0;
        let count = 0;
        // Count alive neighbors (Moore neighborhood with wrap-around)
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // skip the center cell
            let nx = (x + dx + w) % w;
            let ny = (y + dy + h) % h;
            let nIdx = (nx + ny * w) * 4;
            let neighbor = stateImg.pixels[nIdx] > 127 ? 1 : 0;
            count += neighbor;
          }
        }
        // Use the lookup table to determine the next state.
        let newState = this.table[cell][count];
        let col = newState === 1 ? 255 : 0;
        newImg.pixels[idx] = col;
        newImg.pixels[idx + 1] = col;
        newImg.pixels[idx + 2] = col;
        newImg.pixels[idx + 3] = 255;
      }
    }
    
    newImg.updatePixels();
    return newImg;
  }
  
  // Crossover: Create a child rule by mixing genes from this rule and another.
  crossover(other) {
    let child = new Rule();
    for (let state = 0; state < 2; state++) {
      for (let count = 0; count < 9; count++) {
        child.table[state][count] = random(1) < 0.5 ? this.table[state][count] : other.table[state][count];
      }
    }
    return child;
  }
  
  // Mutation: Flip each gene with the given probability.
  mutate(rate) {
    for (let state = 0; state < 2; state++) {
      for (let count = 0; count < 9; count++) {
        if (random(1) < rate) {
          this.table[state][count] = 1 - this.table[state][count];
        }
      }
    }
  }
  
  // Return a copy of this rule.
  copy() {
    let r = new Rule();
    for (let state = 0; state < 2; state++) {
      for (let count = 0; count < 9; count++) {
        r.table[state][count] = this.table[state][count];
      }
    }
    r.fitness = this.fitness;
    return r;
  }
}
