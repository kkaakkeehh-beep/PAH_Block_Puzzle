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
// place), so a locked cell keeps the double bonds its own ring carried long
// after the piece itself is gone.
//
// Each placement also gets a group id, so the board remembers which cells
// were one molecule. Rings that are fused stay fused: a line clear may delete
// part of a molecule, but whatever survives has to move as one body.
let nextMoleculeGroup = 1;

function placeCells(board, cells, shape, rotationIndex) {
  const bonds = rotationIndex !== undefined
    ? kekuleBondsForPiece(shape, rotationIndex)
    : kekuleBondsForCells(cells);
  const group = nextMoleculeGroup++;
  cells.forEach(([q, r], i) => {
    board.set(axialKey(q, r), { color: shape.color, bonds: bonds[i], group });
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

  // Cells are not shifted row by row here. Doing that moved each cell by the
  // count of cleared rows beneath it, which differs across a molecule that
  // straddled the clear and so pulled fused rings apart. Instead the cleared
  // cells are simply removed and settleMolecules lets each surviving
  // fragment fall as one body.
  const newBoard = new Map();
  for (const [key, cell] of board) {
    const [q, r] = key.split(',').map(Number);
    const [, row] = axialToOffset(q, r);
    if (fullRowSet.has(row)) continue;
    newBoard.set(key, cell);
  }
  if (!shiftDown) return { cleared: fullRows, board: newBoard };
  return { cleared: fullRows, board: settleMolecules(splitSeveredGroups(newBoard)) };
}

// A clear can cut a molecule into parts that no longer touch each other --
// take a vertical pentacene and remove a row through its middle. Those parts
// are separate fragments, not one body, so each connected run of cells
// becomes its own group before anything settles. Without this they would
// stay rigidly linked across the gap the clear left.
function splitSeveredGroups(board) {
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const byGroup = new Map();
  for (const [key, cell] of board) {
    if (!byGroup.has(cell.group)) byGroup.set(cell.group, []);
    byGroup.get(cell.group).push(key);
  }

  for (const keys of byGroup.values()) {
    if (keys.length < 2) continue;
    const members = new Set(keys);
    const seen = new Set();
    let isFirstComponent = true;
    for (const start of keys) {
      if (seen.has(start)) continue;
      const component = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const key = stack.pop();
        component.push(key);
        const [q, r] = key.split(',').map(Number);
        for (const [dq, dr] of DIRS) {
          const next = axialKey(q + dq, r + dr);
          if (members.has(next) && !seen.has(next)) { seen.add(next); stack.push(next); }
        }
      }
      // The first component keeps the original id; the rest become new ones.
      if (isFirstComponent) { isFirstComponent = false; continue; }
      const id = nextMoleculeGroup++;
      for (const key of component) board.get(key).group = id;
    }
  }
  return board;
}

// A line clear deletes whatever part of a molecule crossed the cleared row,
// but the rings that survive are still fused to each other, so they have to
// move together. Handling cells individually -- shifting each by the number
// of cleared rows beneath it, or dropping each one that lost its support --
// pulled fused rings apart, some falling while others were held up by
// whatever sat below them.
//
// Each surviving fragment therefore falls as a rigid body, by the same
// gravity steps a falling piece uses. That choice of rule matters: a piece
// locks precisely when it cannot fall as a rigid body, so every group on the
// board is already at rest under it, and only the groups the clear actually
// disturbed move. The board is not re-settled and does not collapse.
//
// Groups are taken lowest-first so one never falls into a space another is
// about to vacate, and the pass repeats until nothing moves.
//
// Only called for the falling mode; placing mode deliberately leaves the
// rest of the board alone when rows clear.
function settleMolecules(board) {
  const lowestRow = (cells) =>
    Math.max(...cells.map(c => axialToOffset(c.q, c.r)[1]));

  let moved = true;
  while (moved) {
    moved = false;
    const groups = new Map();
    for (const [key, cell] of board) {
      const [q, r] = key.split(',').map(Number);
      if (!groups.has(cell.group)) groups.set(cell.group, []);
      groups.get(cell.group).push({ key, q, r, cell });
    }
    const ordered = [...groups.values()].sort((a, b) => lowestRow(b) - lowestRow(a));

    for (const cells of ordered) {
      const own = new Set(cells.map(c => c.key));
      // The same candidate steps tryFall uses, as offsets applied to the
      // whole group rather than to one cell.
      const anchor = cells[0];
      const deltas = fallStepCandidates(anchor.q, anchor.r)
        .map(([nq, nr]) => [nq - anchor.q, nr - anchor.r]);

      for (const [dq, dr] of deltas) {
        const targets = cells.map(c => [c.q + dq, c.r + dr]);
        const fits = targets.every(([q, r]) => {
          const [col, row] = axialToOffset(q, r);
          if (!isInBounds(col, row)) return false;
          const key = axialKey(q, r);
          return !board.has(key) || own.has(key);
        });
        if (!fits) continue;
        for (const c of cells) board.delete(c.key);
        targets.forEach(([q, r], i) => board.set(axialKey(q, r), cells[i].cell));
        moved = true;
        break;
      }
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
