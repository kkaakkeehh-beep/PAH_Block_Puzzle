// Each shape's offsets are axial coordinates relative to a ring at (0,0),
// matching how the rings of the real fused-ring molecule sit on a triangular
// lattice. weight controls how often it's drawn (small molecules more often,
// like tetrominoes vs. rare pieces).
//
// Two rings whose offsets differ by one axial step are ortho-fused (they
// share an edge). Three *mutually* adjacent rings meet at a common carbon,
// which is peri-fusion -- so an angular cata-condensed molecule like
// phenanthrene must have its end rings two steps apart, not one, or the
// shape is a different (peri-fused) compound with a different formula.
//
// The double bonds drawn inside these rings aren't stored here: they are
// derived from the ring layout itself, in kekuleBondsFromCorners (board.js),
// so they always match whatever skeleton the offsets describe.
const PAH_SHAPES = [
  { name: "Benzene", formula: "C6H6", color: "#e63946", weight: 7,
    offsets: [[0, 0]] },
  { name: "Naphthalene", formula: "C10H8", color: "#f3722c", weight: 6,
    offsets: [[0, 0], [1, 0]] },
  { name: "Phenanthrene", formula: "C14H10", color: "#f8961e", weight: 4,
    offsets: [[0, 0], [1, 0], [2, -1]] },
  { name: "Anthracene", formula: "C14H10", color: "#f9c74f", weight: 4,
    offsets: [[0, 0], [1, 0], [2, 0]] },
  { name: "Pyrene", formula: "C16H10", color: "#90be6d", weight: 3,
    offsets: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: "Chrysene", formula: "C18H12", color: "#43aa8b", weight: 3,
    offsets: [[0, 0], [1, 0], [2, -1], [3, -1]] },
  { name: "Tetracene", formula: "C18H12", color: "#4d908e", weight: 3,
    offsets: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: "Triphenylene", formula: "C18H12", color: "#577590", weight: 3,
    offsets: [[0, 0], [1, 0], [0, -1], [-1, 1]] },
  { name: "Picene", formula: "C22H14", color: "#277da1", weight: 2,
    offsets: [[0, 0], [1, 0], [2, -1], [3, -1], [4, -2]] },
  { name: "Pentacene", formula: "C22H14", color: "#9d4edd", weight: 1,
    offsets: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { name: "Coronene", formula: "C24H12", color: "#f72585", weight: 1,
    offsets: [[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] },
];

function offsetsKey(offsets) {
  return offsets.map(o => o[0] + '_' + o[1]).sort().join('|');
}

function computeRotationStates(baseOffsets) {
  const states = [];
  const seen = new Set();
  let current = baseOffsets;
  for (let i = 0; i < 6; i++) {
    const key = offsetsKey(current);
    if (!seen.has(key)) {
      seen.add(key);
      states.push(current);
    }
    current = current.map(axialRotate60);
  }
  return states;
}

for (const shape of PAH_SHAPES) {
  shape.rotationStates = computeRotationStates(shape.offsets);
  shape.rings = shape.offsets.length;
}

// Weights above are tuned for "Normal" (factor 1). Raising the factor biases
// selection toward more-ringed (more complex) molecules exponentially in
// ring count, so higher difficulty visibly skews toward the bigger pieces
// without ever making the small ones impossible.
let DIFFICULTY_FACTOR = 1;

function setDifficultyFactor(factor) {
  DIFFICULTY_FACTOR = factor;
}

function pickRandomShape() {
  const weights = PAH_SHAPES.map(s => s.weight * Math.pow(DIFFICULTY_FACTOR, s.rings - 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PAH_SHAPES.length; i++) {
    if (r < weights[i]) return PAH_SHAPES[i];
    r -= weights[i];
  }
  return PAH_SHAPES[0];
}

function spawnPiece() {
  return { shape: pickRandomShape(), rotationIndex: 0 };
}
