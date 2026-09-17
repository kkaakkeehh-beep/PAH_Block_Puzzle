// Flat-top hexagons: horizontal top/bottom edges, so axial neighbor (0,+1) is
// exactly straight down in pixel space. That's what lets pieces fall in a
// straight vertical column, like Tetris.
const SQRT3 = Math.sqrt(3);

function axialKey(q, r) {
  return q + ',' + r;
}

function axialRotate60(offset) {
  const [q, r] = offset;
  return [-r, q + r];
}

// Columns share a straight visual line, but adjacent columns are staggered by
// half a row (normal hex packing) — offset "row" bakes that stagger in so a
// piece can move left/right/down with simple +/-1 steps.
function axialToOffset(q, r) {
  return [q, r + Math.floor(q / 2)];
}

function offsetToAxial(col, row) {
  return [col, row - Math.floor(col / 2)];
}

function axialToPixel(q, r, size) {
  return [
    size * 1.5 * q,
    size * (SQRT3 / 2 * q + SQRT3 * r),
  ];
}

function hexCorner(cx, cy, size, i) {
  const angleRad = Math.PI / 180 * (60 * i);
  return [cx + size * Math.cos(angleRad), cy + size * Math.sin(angleRad)];
}
