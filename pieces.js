// Each shape's offsets are axial coordinates relative to a ring at (0,0),
// matching how the rings of the real fused-ring molecule sit on a triangular
// lattice. weight controls how often it's drawn (small molecules more often,
// like tetrominoes vs. rare pieces).
const PAH_SHAPES = [
  { name: "Benzene", formula: "C6H6", color: "#e63946", weight: 7,
    offsets: [[0, 0]] },
  { name: "Naphthalene", formula: "C10H8", color: "#f3722c", weight: 6,
    offsets: [[0, 0], [1, 0]] },
  { name: "Phenanthrene", formula: "C14H10", color: "#f8961e", weight: 4,
    offsets: [[0, 0], [1, 0], [1, -1]] },
  { name: "Anthracene", formula: "C14H10", color: "#f9c74f", weight: 4,
    offsets: [[0, 0], [1, 0], [2, 0]] },
  { name: "Pyrene", formula: "C16H10", color: "#90be6d", weight: 3,
    offsets: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: "Chrysene", formula: "C18H12", color: "#43aa8b", weight: 3,
    offsets: [[0, 0], [1, 0], [1, -1], [2, -1]] },
  { name: "Tetracene", formula: "C18H12", color: "#4d908e", weight: 3,
    offsets: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: "Triphenylene", formula: "C18H12", color: "#577590", weight: 3,
    offsets: [[0, 0], [1, 0], [0, -1], [-1, 1]] },
  { name: "Picene", formula: "C22H14", color: "#277da1", weight: 2,
    offsets: [[0, 0], [1, 0], [1, -1], [2, -1], [2, -2]] },
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
}

const PIECE_WEIGHT_TOTAL = PAH_SHAPES.reduce((sum, s) => sum + s.weight, 0);

function pickRandomShape() {
  let r = Math.random() * PIECE_WEIGHT_TOTAL;
  for (const shape of PAH_SHAPES) {
    if (r < shape.weight) return shape;
    r -= shape.weight;
  }
  return PAH_SHAPES[0];
}

function spawnPiece() {
  return { shape: pickRandomShape(), rotationIndex: 0 };
}
