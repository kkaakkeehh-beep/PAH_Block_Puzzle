// Two hex orientations are supported for the falling board:
//  - "flat": flat-top hexagons (horizontal top/bottom edges). Axial (0,+1)
//    is exactly straight down with zero horizontal drift, so pieces fall in
//    a perfectly straight column.
//  - "pointy": pointy-top hexagons (vertex up/down). There's no single clean
//    "straight down" axial step here -- (0,+1) then (-1,+1) cancels out to
//    pure vertical over two rows -- so gravity alternates by row parity to
//    stay net-vertical (see fallStepCandidates). That alternation is only a
//    preference, though: if the parity-preferred cell is blocked but the
//    other diagonal is open, a piece must still fall through it, or it locks
//    in place while visibly floating over empty cells.
const SQRT3 = Math.sqrt(3);

let ORIENTATION = 'flat';

function setOrientation(o) {
  ORIENTATION = o;
}

function getOrientation() {
  return ORIENTATION;
}

function axialKey(q, r) {
  return q + ',' + r;
}

function axialRotate60(offset) {
  const [q, r] = offset;
  return [-r, q + r];
}

// Bakes the hex stagger into a plain rectangular (col, row) grid so board
// bounds / line-clear logic doesn't need to know about hex geometry.
function axialToOffset(q, r) {
  if (ORIENTATION === 'flat') return [q, r + Math.floor(q / 2)];
  return [q + Math.floor(r / 2), r];
}

function offsetToAxial(col, row) {
  if (ORIENTATION === 'flat') return [col, row - Math.floor(col / 2)];
  return [col - Math.floor(row / 2), row];
}

// Returns candidate next-row cells in preference order. The caller should
// try each in turn and use the first that's actually free.
function fallStepCandidates(q, r) {
  if (ORIENTATION === 'flat') return [[q, r + 1]];
  const preferredDq = (((r % 2) + 2) % 2) !== 0 ? -1 : 0;
  const otherDq = preferredDq === -1 ? 0 : -1;
  return [[q + preferredDq, r + 1], [q + otherDq, r + 1]];
}

function axialToPixel(q, r, size) {
  if (ORIENTATION === 'flat') {
    return [size * 1.5 * q, size * (SQRT3 / 2 * q + SQRT3 * r)];
  }
  return [size * (SQRT3 * q + SQRT3 / 2 * r), size * 1.5 * r];
}

function hexCorner(cx, cy, size, i) {
  const angleRad = Math.PI / 180 * (60 * i + (ORIENTATION === 'flat' ? 0 : -30));
  return [cx + size * Math.cos(angleRad), cy + size * Math.sin(angleRad)];
}
