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

function placeCells(board, cells, color) {
  for (const [q, r] of cells) board.set(axialKey(q, r), color);
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

  const newBoard = new Map();
  for (const [key, color] of board) {
    const [q, r] = key.split(',').map(Number);
    const [col, row] = axialToOffset(q, r);
    if (fullRows.includes(row)) continue;
    if (!shiftDown) { newBoard.set(key, color); continue; }
    const shift = fullRows.filter(cr => cr > row).length;
    const [nq, nr] = offsetToAxial(col, row + shift);
    newBoard.set(axialKey(nq, nr), color);
  }
  return { cleared: fullRows, board: newBoard };
}

function computeBoardLayout(canvas) {
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

function drawRingMark(ctx, cx, cy, size, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.strokeStyle = color || 'rgba(255,255,255,0.6)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.stroke();
}

function drawBoardGrid(ctx) {
  for (let col = 0; col < NUM_COLS; col++) {
    for (let row = 0; row < NUM_ROWS; row++) {
      const [cx, cy] = cellCenter(col, row);
      drawHex(ctx, cx, cy, hexSize * 0.96, 'rgba(255,255,255,0.35)', 'rgba(60,70,90,0.18)', 1);
    }
  }
}

function drawLockedCells(ctx, board, flashRowSet, flashOn) {
  for (const [key, color] of board) {
    const [q, r] = key.split(',').map(Number);
    const [col, row] = axialToOffset(q, r);
    const [cx, cy] = cellCenter(col, row);
    const lit = flashOn && flashRowSet.has(row);
    drawHex(ctx, cx, cy, hexSize * 0.94, lit ? '#ffffff' : color, 'rgba(0,0,0,0.25)', 1.5);
    if (!lit) drawRingMark(ctx, cx, cy, hexSize, 'rgba(255,255,255,0.55)');
  }
}

// Inverse of axialToPixel (flat-top) + cube rounding, for pointer placement.
function pixelToAxial(px, py, size) {
  const q = px / (1.5 * size);
  const r = py / (SQRT3 * size) - q / 2;
  let rx = q, rz = r, ry = -q - r;
  let ix = Math.round(rx), iy = Math.round(ry), iz = Math.round(rz);
  const dx = Math.abs(ix - rx), dy = Math.abs(iy - ry), dz = Math.abs(iz - rz);
  if (dx > dy && dx > dz) ix = -iy - iz;
  else if (dz > dy) iz = -ix - iy;
  return [ix, iz];
}
