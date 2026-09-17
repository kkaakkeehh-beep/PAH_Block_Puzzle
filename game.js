(function () {
  const NUM_COLS = 9;
  const NUM_ROWS = 16;
  const SPAWN_COL = Math.floor(NUM_COLS / 2);
  const SPAWN_ROW = 2;
  const BASE_DROP_MS = 800;
  const MIN_DROP_MS = 120;
  const LINES_PER_LEVEL = 8;
  const HIGH_SCORE_KEY = 'pahBlockPuzzleHighScore';

  const boardCanvas = document.getElementById('board-canvas');
  const boardCtx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('best-score');
  const levelEl = document.getElementById('level');
  const currentLabelEl = document.getElementById('current-label');
  const nextLabelEl = document.getElementById('next-label');
  const overlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const newBestEl = document.getElementById('new-best');

  let board = new Map(); // axialKey -> color
  let current, next;
  let score = 0, level = 1, linesCleared = 0;
  let dropIntervalMs = BASE_DROP_MS;
  let dropAccumulator = 0;
  let lastFrameTime = null;
  let gameOver = false;
  let running = false;
  let flashRows = [];
  let flashTimer = 0;

  let hexSize = 20;
  let originX = 0, originY = 0;

  function isInBounds(col, row) {
    return col >= 0 && col < NUM_COLS && row >= 0 && row < NUM_ROWS;
  }

  function getPieceCells(piece) {
    const [anchorQ, anchorR] = offsetToAxial(piece.anchorCol, piece.anchorRow);
    return piece.shape.rotationStates[piece.rotationIndex].map(([dq, dr]) => [anchorQ + dq, anchorR + dr]);
  }

  function isValidPosition(piece) {
    for (const [q, r] of getPieceCells(piece)) {
      const [col, row] = axialToOffset(q, r);
      if (!isInBounds(col, row)) return false;
      if (board.has(axialKey(q, r))) return false;
    }
    return true;
  }

  function newFallingPiece(shapeSlot) {
    return { shape: shapeSlot.shape, rotationIndex: 0, anchorCol: SPAWN_COL, anchorRow: SPAWN_ROW };
  }

  function resetGame() {
    board = new Map();
    score = 0;
    level = 1;
    linesCleared = 0;
    dropIntervalMs = BASE_DROP_MS;
    dropAccumulator = 0;
    gameOver = false;
    flashRows = [];
    current = newFallingPiece(spawnPiece());
    next = spawnPiece();
    updateHud();
    overlay.classList.add('hidden');
    running = true;
    lastFrameTime = null;
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    const best = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    bestScoreEl.textContent = Math.max(best, score);
    currentLabelEl.textContent = current ? `${current.shape.name} (${current.shape.formula})` : '';
    nextLabelEl.textContent = next ? `${next.shape.name} (${next.shape.formula})` : '';
  }

  function tryMove(dCol, dRow) {
    const trial = { ...current, anchorCol: current.anchorCol + dCol, anchorRow: current.anchorRow + dRow };
    if (isValidPosition(trial)) {
      current = trial;
      return true;
    }
    return false;
  }

  const ROTATE_KICKS = [[0, 0], [1, 0], [-1, 0], [0, -1], [2, 0], [-2, 0]];

  function tryRotate() {
    const nextIndex = (current.rotationIndex + 1) % current.shape.rotationStates.length;
    for (const [kc, kr] of ROTATE_KICKS) {
      const trial = { ...current, rotationIndex: nextIndex, anchorCol: current.anchorCol + kc, anchorRow: current.anchorRow + kr };
      if (isValidPosition(trial)) {
        current = trial;
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    let cells = 0;
    while (tryMove(0, 1)) cells++;
    score += cells * 2;
    lockPiece();
  }

  function lockPiece() {
    for (const [q, r] of getPieceCells(current)) {
      board.set(axialKey(q, r), current.shape.color);
    }
    score += current.shape.rotationStates[0].length * 10;

    const cleared = clearFullRows();
    if (cleared.length > 0) {
      flashRows = cleared;
      flashTimer = 220;
      linesCleared += cleared.length;
      score += 100 * cleared.length * cleared.length * level;
      const newLevel = 1 + Math.floor(linesCleared / LINES_PER_LEVEL);
      if (newLevel !== level) {
        level = newLevel;
        dropIntervalMs = Math.max(MIN_DROP_MS, BASE_DROP_MS - (level - 1) * 60);
      }
    }

    current = next;
    current.anchorCol = SPAWN_COL;
    current.anchorRow = SPAWN_ROW;
    next = spawnPiece();
    updateHud();

    if (!isValidPosition(current)) {
      endGame();
    }
  }

  function clearFullRows() {
    const rowCols = new Map();
    for (const key of board.keys()) {
      const [q, r] = key.split(',').map(Number);
      const [col, row] = axialToOffset(q, r);
      if (!rowCols.has(row)) rowCols.set(row, new Set());
      rowCols.get(row).add(col);
    }
    const fullRows = [];
    for (const [row, cols] of rowCols) {
      if (cols.size >= NUM_COLS) fullRows.push(row);
    }
    if (fullRows.length === 0) return [];
    fullRows.sort((a, b) => a - b);

    const newBoard = new Map();
    for (const [key, color] of board) {
      const [q, r] = key.split(',').map(Number);
      const [col, row] = axialToOffset(q, r);
      if (fullRows.includes(row)) continue;
      const shift = fullRows.filter(cr => cr > row).length;
      const [nq, nr] = offsetToAxial(col, row + shift);
      newBoard.set(axialKey(nq, nr), color);
    }
    board = newBoard;
    return fullRows;
  }

  function endGame() {
    gameOver = true;
    running = false;
    const best = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    if (score > best) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      newBestEl.classList.remove('hidden');
    } else {
      newBestEl.classList.add('hidden');
    }
    finalScoreEl.textContent = score;
    updateHud();
    overlay.classList.remove('hidden');
  }

  function computeLayout() {
    const rect = boardCanvas.parentElement.getBoundingClientRect();
    const availW = Math.max(200, rect.width);
    const sizeFromWidth = availW / (1.5 * (NUM_COLS - 1) + 2);
    hexSize = Math.max(12, Math.min(28, sizeFromWidth));

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
    boardCanvas.style.width = cssW + 'px';
    boardCanvas.style.height = cssH + 'px';
    boardCanvas.width = cssW * dpr;
    boardCanvas.height = cssH * dpr;
    boardCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function cellCenter(col, row) {
    const [q, r] = offsetToAxial(col, row);
    const [x, y] = axialToPixel(q, r, hexSize);
    return [x + originX, y + originY];
  }

  function render() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);

    for (let col = 0; col < NUM_COLS; col++) {
      for (let row = 0; row < NUM_ROWS; row++) {
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.96, 'rgba(255,255,255,0.35)', 'rgba(60,70,90,0.18)', 1);
      }
    }

    const flashSet = new Set(flashRows);
    for (const [key, color] of board) {
      const [q, r] = key.split(',').map(Number);
      const [col, row] = axialToOffset(q, r);
      const [cx, cy] = cellCenter(col, row);
      const lit = flashSet.has(row) && flashTimer > 0;
      drawHex(boardCtx, cx, cy, hexSize * 0.94, lit ? '#ffffff' : color, 'rgba(0,0,0,0.25)', 1.5);
      if (!lit) {
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, hexSize * 0.42, 0, Math.PI * 2);
        boardCtx.strokeStyle = 'rgba(255,255,255,0.55)';
        boardCtx.lineWidth = Math.max(1, hexSize * 0.06);
        boardCtx.stroke();
      }
    }

    if (running && current) {
      let ghost = { ...current };
      while (isValidPosition({ ...ghost, anchorRow: ghost.anchorRow + 1 })) ghost = { ...ghost, anchorRow: ghost.anchorRow + 1 };
      for (const [q, r] of getPieceCells(ghost)) {
        const [col, row] = axialToOffset(q, r);
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.9, 'rgba(255,255,255,0.12)', current.shape.color, 1.5);
      }
      for (const [q, r] of getPieceCells(current)) {
        const [col, row] = axialToOffset(q, r);
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.94, current.shape.color, '#1d2126', 2);
        boardCtx.beginPath();
        boardCtx.arc(cx, cy, hexSize * 0.42, 0, Math.PI * 2);
        boardCtx.strokeStyle = 'rgba(255,255,255,0.7)';
        boardCtx.lineWidth = Math.max(1, hexSize * 0.06);
        boardCtx.stroke();
      }
    }

    renderNextPreview();
  }

  function renderNextPreview() {
    const dpr = window.devicePixelRatio || 1;
    const cssSize = 110;
    nextCanvas.width = cssSize * dpr;
    nextCanvas.height = cssSize * dpr;
    nextCanvas.style.width = cssSize + 'px';
    nextCanvas.style.height = cssSize + 'px';
    nextCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nextCtx.clearRect(0, 0, cssSize, cssSize);
    if (!next) return;
    const offsets = next.shape.rotationStates[0];
    const size = 16;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pts = offsets.map(([q, r]) => axialToPixel(q, r, size));
    for (const [x, y] of pts) {
      minX = Math.min(minX, x - size); maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size); maxY = Math.max(maxY, y + size);
    }
    const cx0 = (cssSize - (maxX - minX)) / 2 - minX;
    const cy0 = (cssSize - (maxY - minY)) / 2 - minY;
    pts.forEach(([x, y]) => {
      drawHex(nextCtx, x + cx0, y + cy0, size * 0.92, next.shape.color, '#1d2126', 1.5);
      nextCtx.beginPath();
      nextCtx.arc(x + cx0, y + cy0, size * 0.4, 0, Math.PI * 2);
      nextCtx.strokeStyle = 'rgba(255,255,255,0.7)';
      nextCtx.lineWidth = 1;
      nextCtx.stroke();
    });
  }

  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flashRows = [];
    }

    if (running && !document.hidden) {
      dropAccumulator += dt;
      if (dropAccumulator >= dropIntervalMs) {
        dropAccumulator = 0;
        if (!tryMove(0, 1)) lockPiece();
      }
    }

    render();
    requestAnimationFrame(tick);
  }

  function bindControls() {
    window.addEventListener('keydown', (e) => {
      if (!running) return;
      switch (e.key) {
        case 'ArrowLeft': tryMove(-1, 0); e.preventDefault(); break;
        case 'ArrowRight': tryMove(1, 0); e.preventDefault(); break;
        case 'ArrowDown': if (!tryMove(0, 1)) lockPiece(); e.preventDefault(); break;
        case 'ArrowUp': case 'r': case 'R': tryRotate(); e.preventDefault(); break;
        case ' ': hardDrop(); e.preventDefault(); break;
      }
    });

    const bind = (id, fn) => document.getElementById(id).addEventListener('click', () => { if (running) fn(); });
    bind('btn-left', () => tryMove(-1, 0));
    bind('btn-right', () => tryMove(1, 0));
    bind('btn-down', () => { if (!tryMove(0, 1)) lockPiece(); });
    bind('btn-rotate', tryRotate);
    bind('btn-drop', hardDrop);

    document.getElementById('new-game-btn').addEventListener('click', resetGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);

    window.addEventListener('resize', computeLayout);
  }

  computeLayout();
  bindControls();
  resetGame();
  requestAnimationFrame(tick);
})();
