let NUM_COLS = 7;
let NUM_ROWS = 14;

function setBoardSize(cols, rows) {
  NUM_COLS = cols;
  NUM_ROWS = rows;
}

let hexSize = 20;
let originX = 0, originY = 0;

function isInBounds(col, row) {
  return col >= 0 && col < NUM_COLS && row >= 0 && row < NUM_ROWS;
}

function cellsInBounds(cells) {
  return cells.every(([q, r]) => {
    const [col, row] = axialToOffset(q, r);
    return isInBounds(col, row);
  });
}

function cellsFree(board, cells) {
  return cells.every(([q, r]) => !board.has(axialKey(q, r)));
}

function canPlaceCells(board, cells) {
  return cellsInBounds(cells) && cellsFree(board, cells);
}

// cells[i] corresponds to shape.offsets[i] (getPieceCells maps offsets in
// place), so a locked cell can remember whether its ring carried one of the
// molecule's Clar sextets long after the piece itself is gone.
function placeCells(board, cells, shape, rotationIndex) {
  const bonds = rotationIndex !== undefined
    ? kekuleBondsForPiece(shape, rotationIndex)
    : kekuleBondsForCells(cells);
  cells.forEach(([q, r], i) => {
    board.set(axialKey(q, r), { color: shape.color, bonds: bonds[i] });
  });
}

function clearFullRows(board, shiftDown) {
  const rowCols = new Map();
  for (const key of board.keys()) {
    const [q, r] = key.split(',').map(Number);
    const [col, row] = axialToOffset(q, r);
    if (!rowCols.has(row)) rowCols.set(row, new Set());
    rowCols.get(row).add(col);
  }
  const fullRows = [];
  for (const [row, cols] of rowCols) if (cols.size >= NUM_COLS) fullRows.push(row);
  if (fullRows.length === 0) return { cleared: [], board };
  fullRows.sort((a, b) => a - b);
  const fullRowSet = new Set(fullRows);

  const newBoard = new Map();
  for (const [key, cell] of board) {
    const [q, r] = key.split(',').map(Number);
    const [col, row] = axialToOffset(q, r);
    if (fullRowSet.has(row)) continue;
    if (!shiftDown) { newBoard.set(key, cell); continue; }
    let shift = 0;
    for (let i = fullRows.length - 1; i >= 0; i--) {
      if (fullRows[i] > row) shift++; else break;
    }
    const [nq, nr] = offsetToAxial(col, row + shift);
    newBoard.set(axialKey(nq, nr), cell);
  }
  return { cleared: fullRows, board: shiftDown ? dropStrandedCells(newBoard) : newBoard };
}

// Shifting rows down does not always leave the stack resting on itself.
// Flat-top gravity has one candidate straight below, so a rigid vertical
// shift preserves whatever held each cell up. Pointy-top gravity has two --
// the cell below plus one diagonal neighbour -- and which diagonal it is
// flips with row parity, so moving a cell an odd number of rows swaps its
// supports and can leave it holding on to nothing. Those cells stayed locked
// in mid-air after a line clear.
//
// This moves *only* the cells the shift stranded: ones where every cell
// gravity could carry them into is free, which is precisely the test the
// falling piece itself uses to decide it has landed. A cell resting on a
// diagonal neighbour keeps its support and does not budge, so the stack is
// not re-settled and the board does not collapse -- the earlier attempt,
// which dropped anything with a gap directly beneath it, treated the locked
// stack as loose grains and compacted the whole board.
//
// Only called for the falling mode; placing mode deliberately leaves the
// rest of the board alone when rows clear.
function dropStrandedCells(board) {
  const rowOf = (key) => {
    const [q, r] = key.split(',').map(Number);
    return axialToOffset(q, r)[1];
  };
  let moved = true;
  while (moved) {
    moved = false;
    // Lowest cells first, so one never falls into a space that the cell
    // beneath it is about to vacate.
    const keys = [...board.keys()].sort((a, b) => rowOf(b) - rowOf(a));
    for (const key of keys) {
      const cell = board.get(key);
      if (!cell) continue;
      const [q, r] = key.split(',').map(Number);
      const steps = fallStepCandidates(q, r).filter(([nq, nr]) => {
        const [ncol, nrow] = axialToOffset(nq, nr);
        return isInBounds(ncol, nrow);
      });
      if (steps.length === 0) continue;
      if (!steps.every(([nq, nr]) => !board.has(axialKey(nq, nr)))) continue;
      const [nq, nr] = steps[0];
      board.delete(key);
      board.set(axialKey(nq, nr), cell);
      moved = true;
    }
  }
  return board;
}

function computeBoardLayout(canvas) {
  refreshBoardPalette();
  const rect = canvas.parentElement.getBoundingClientRect();
  const availH = Math.max(240, window.innerHeight * 0.6);
  const sizeFromHeight = availH / (SQRT3 * (NUM_ROWS + 0.5));
  const availW = Math.max(200, rect.width);
  const sizeFromWidth = availW / (1.5 * (NUM_COLS - 1) + 2);
  hexSize = Math.max(10, Math.min(26, sizeFromWidth, sizeFromHeight));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let col = 0; col < NUM_COLS; col++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      const [q, r] = offsetToAxial(col, row);
      const [cx, cy] = axialToPixel(q, r, hexSize);
      for (let i = 0; i < 6; i++) {
        const [px, py] = hexCorner(cx, cy, hexSize, i);
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
    }
  }
  const pad = 4;
  originX = -minX + pad;
  originY = -minY + pad;
  const dpr = window.devicePixelRatio || 1;
  const cssW = maxX - minX + pad * 2;
  const cssH = maxY - minY + pad * 2;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cssW, cssH };
}

function cellCenter(col, row) {
  const [q, r] = offsetToAxial(col, row);
  const [x, y] = axialToPixel(q, r, hexSize);
  return [x + originX, y + originY];
}

function drawHex(ctx, cx, cy, size, fillColor, strokeColor, lineWidth) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const [px, py] = hexCorner(cx, cy, size, i);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fillColor) { ctx.fillStyle = fillColor; ctx.fill(); }
  if (strokeColor) { ctx.strokeStyle = strokeColor; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
}

// ---------- Kekule structures ----------
//
// A circle inside a ring means six delocalised pi electrons, so putting one
// in every ring of a fused system counts them twice over: naphthalene would
// read as twelve pi electrons when it has ten. Drawing an explicit Kekule
// structure sidesteps that -- every carbon carries exactly one double bond,
// which is a perfect matching on the carbon skeleton.
//
// A molecule usually has several valid Kekule structures, so we enumerate
// them all and keep the one with the most rings holding three alternating
// double bonds. That is the structure with the maximum number of Clar
// aromatic sextets -- the dominant resonance contributor, and the one
// textbooks draw: phenanthrene ends up with its two end rings alternating
// and a single C9=C10 bond in the middle, triphenylene with three outer
// rings around an empty centre, and anthracene with only one such ring.
//
// Edge i of a hexagon runs from corner i to corner i+1, matching hexCorner,
// so an edge index means the same thing to the drawing code.
function kekuleBondsFromCorners(cornerLists) {
  const ids = new Map();
  const adj = [];
  const idOf = (x, y) => {
    const k = Math.round(x * 1000) + ',' + Math.round(y * 1000);
    if (!ids.has(k)) { ids.set(k, adj.length); adj.push([]); }
    return ids.get(k);
  };

  const hexVerts = cornerLists.map(pts => pts.map(([x, y]) => idOf(x, y)));
  const edgeOwners = new Map();
  hexVerts.forEach((verts, h) => {
    for (let i = 0; i < 6; i++) {
      const a = verts[i], b = verts[(i + 1) % 6];
      if (!adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); }
      const k = Math.min(a, b) + '|' + Math.max(a, b);
      if (!edgeOwners.has(k)) edgeOwners.set(k, []);
      edgeOwners.get(k).push([h, i]);
    }
  });

  // Two rings conflict when they share a carbon, whether across a fusion
  // bond or at a single peri atom. Sextets have to be carbon-disjoint: both
  // rings of naphthalene hold three double bonds at once, but they share the
  // C4a=C8a bond, so only one of them is a sextet and the molecule reads as
  // ten pi electrons rather than twelve. Sharing carbons with a *non*-sextet
  // ring is fine, which is what makes pyrene's two sextets legal.
  const ringSets = hexVerts.map(verts => new Set(verts));
  const conflict = hexVerts.map((verts, a) =>
    hexVerts.map((_, b) => a !== b && verts.some(v => ringSets[b].has(v))));

  const isShared = hexVerts.map(verts => {
    const flags = [];
    for (let i = 0; i < 6; i++) {
      const a = verts[i], b = verts[(i + 1) % 6];
      flags.push(edgeOwners.get(Math.min(a, b) + '|' + Math.max(a, b)).length > 1);
    }
    return flags;
  });

  const n = adj.length;
  const matched = new Array(n).fill(-1);
  let best = null, bestSextets = -1, bestFused = Infinity;

  const maxDisjoint = (cands) => {
    let top = 0;
    const rec = (idx, chosen, count) => {
      if (count + (cands.length - idx) <= top) return;
      if (idx === cands.length) { top = Math.max(top, count); return; }
      const c = cands[idx];
      if (!chosen.some(x => conflict[x][c])) {
        chosen.push(c);
        rec(idx + 1, chosen, count + 1);
        chosen.pop();
      }
      rec(idx + 1, chosen, count);
    };
    rec(0, [], 0);
    return top;
  };

  // Several Kekule structures can tie on sextet count, so the tie is broken
  // by putting as few double bonds as possible on ring-fusion bonds. That
  // picks the form chemists actually draw: phenanthrene with three bonds
  // inside each end ring and a lone C9=C10 across the middle, rather than an
  // equally valid form that doubles a fusion bond.
  const score = () => {
    const cands = [];
    let fused = 0;
    hexVerts.forEach((verts, h) => {
      let doubles = 0;
      for (let i = 0; i < 6; i++) {
        if (matched[verts[i]] !== verts[(i + 1) % 6]) continue;
        doubles++;
        if (isShared[h][i]) fused++;
      }
      if (doubles === 3) cands.push(h);
    });
    return [maxDisjoint(cands), fused / 2];
  };

  const search = () => {
    let pick = -1, fewest = Infinity;
    for (let v = 0; v < n; v++) {
      if (matched[v] !== -1) continue;
      let free = 0;
      for (const u of adj[v]) if (matched[u] === -1) free++;
      if (free < fewest) { fewest = free; pick = v; }
    }
    if (pick === -1) {
      const [sextets, fused] = score();
      if (sextets > bestSextets || (sextets === bestSextets && fused < bestFused)) {
        bestSextets = sextets;
        bestFused = fused;
        best = matched.slice();
      }
      return;
    }
    if (fewest === 0) return;
    for (const u of adj[pick]) {
      if (matched[u] !== -1) continue;
      matched[pick] = u; matched[u] = pick;
      search();
      matched[pick] = -1; matched[u] = -1;
    }
  };
  search();

  const bonds = cornerLists.map(() => []);
  if (!best) return bonds;
  for (let v = 0; v < n; v++) {
    const u = best[v];
    if (u < v) continue;
    for (const [h, i] of edgeOwners.get(v + '|' + u) || []) bonds[h].push(i);
  }
  return bonds;
}

function cornersForCells(cells) {
  return cells.map(([q, r]) => {
    const [cx, cy] = axialToPixel(q, r, 1);
    const pts = [];
    for (let i = 0; i < 6; i++) pts.push(hexCorner(cx, cy, 1, i));
    return pts;
  });
}

// Translation-invariant, so results are cached per shape + rotation. The
// orientation is part of the key because flipping flat-top to pointy-top
// renumbers the corners, and with them the edge indices.
const kekuleCache = new Map();

function kekuleBondsForCells(cells) {
  return kekuleBondsFromCorners(cornersForCells(cells));
}

function kekuleBondsForPiece(shape, rotationIndex) {
  const key = getOrientation() + '|' + shape.name + '|' + rotationIndex;
  let bonds = kekuleCache.get(key);
  if (!bonds) {
    bonds = kekuleBondsForCells(shape.rotationStates[rotationIndex]);
    kekuleCache.set(key, bonds);
  }
  return bonds;
}

function drawDoubleBonds(ctx, cx, cy, size, edges, color, lineWidth) {
  if (!edges || edges.length === 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth || Math.max(1, size * 0.09);
  ctx.lineCap = 'round';
  for (const i of edges) {
    const [x1, y1] = hexCorner(cx, cy, size, i);
    const [x2, y2] = hexCorner(cx, cy, size, (i + 1) % 6);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const len = Math.hypot(cx - mx, cy - my) || 1;
    const nx = (cx - mx) / len * size * 0.2;
    const ny = (cy - my) / len * size * 0.2;
    const t = 0.2;
    ctx.beginPath();
    ctx.moveTo(x1 + (x2 - x1) * t + nx, y1 + (y2 - y1) * t + ny);
    ctx.lineTo(x2 - (x2 - x1) * t + nx, y2 - (y2 - y1) * t + ny);
    ctx.stroke();
  }
}

// Canvas can't reference CSS variables, so the empty-cell colours are read
// out of them once and re-read when the colour scheme changes. Hard-coding
// them left the board light-themed in dark mode, where a 35%-white fill made
// the empty grid the brightest thing on the screen.
const boardPalette = {
  cellFill: 'rgba(255,255,255,0.35)',
  cellStroke: 'rgba(60,70,90,0.18)',
};

function refreshBoardPalette() {
  const style = getComputedStyle(document.documentElement);
  const read = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
  boardPalette.cellFill = read('--cell-fill', boardPalette.cellFill);
  boardPalette.cellStroke = read('--cell-stroke', boardPalette.cellStroke);
}

function drawBoardGrid(ctx) {
  for (let col = 0; col < NUM_COLS; col++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      const [cx, cy] = cellCenter(col, row);
      drawHex(ctx, cx, cy, hexSize * 0.96, boardPalette.cellFill, boardPalette.cellStroke, 1);
    }
  }
}

function drawLockedCells(ctx, board, flashRowSet, flashOn) {
  for (const [key, cell] of board) {
    const [q, r] = key.split(',').map(Number);
    const [col, row] = axialToOffset(q, r);
    const [cx, cy] = cellCenter(col, row);
    const lit = flashOn && flashRowSet.has(row);
    drawHex(ctx, cx, cy, hexSize * 0.94, lit ? '#ffffff' : cell.color, 'rgba(0,0,0,0.25)', 1.5);
    if (!lit) drawDoubleBonds(ctx, cx, cy, hexSize * 0.94, cell.bonds, 'rgba(255,255,255,0.75)');
  }
}

// Inverse of axialToPixel + cube rounding, for pointer placement.
function pixelToAxial(px, py, size) {
  let q, r;
  if (getOrientation() === 'flat') {
    q = px / (1.5 * size);
    r = py / (SQRT3 * size) - q / 2;
  } else {
    r = py / (1.5 * size);
    q = px / (SQRT3 * size) - r / 2;
  }
  let rx = q, rz = r, ry = -q - r;
  let ix = Math.round(rx), iy = Math.round(ry), iz = Math.round(rz);
  const dx = Math.abs(ix - rx), dy = Math.abs(iy - ry), dz = Math.abs(iz - rz);
  if (dx > dy && dx > dz) ix = -iy - iz;
  else if (dz > dy) iz = -ix - iy;
  return [ix, iz];
}

// The board is redrawn every frame, so a palette refresh on the scheme
// change is enough -- no explicit repaint needed.
if (window.matchMedia) {
  const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (darkScheme.addEventListener) darkScheme.addEventListener('change', refreshBoardPalette);
}
