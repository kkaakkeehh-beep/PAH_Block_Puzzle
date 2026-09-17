(function () {
  const FALL_COLS = 7, FALL_ROWS = 14;
  const PLACE_COLS = 7, PLACE_ROWS = 9;
  const SPAWN_ROW = 2;
  const [SPAWN_Q, SPAWN_R] = offsetToAxial(Math.floor(FALL_COLS / 2), SPAWN_ROW);
  const BASE_DROP_MS = 800;
  const MIN_DROP_MS = 120;
  const LINES_PER_LEVEL = 8;
  const HIGH_SCORE_KEY = 'pahBlockPuzzleHighScore';
  const TRAY_SIZE = 3;

  const boardCanvas = document.getElementById('board-canvas');
  const boardCtx = boardCanvas.getContext('2d');
  const nextCanvas = document.getElementById('next-canvas');
  const nextCtx = nextCanvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('best-score');
  const levelEl = document.getElementById('level');
  const levelBox = document.getElementById('level-box');
  const currentLabelEl = document.getElementById('current-label');
  const nextLabelEl = document.getElementById('next-label');
  const overlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const newBestEl = document.getElementById('new-best');
  const fallPanel = document.getElementById('fall-panel');
  const placePanel = document.getElementById('place-panel');
  const touchControls = document.getElementById('touch-controls');
  const modeFallBtn = document.getElementById('mode-fall-btn');
  const modePlaceBtn = document.getElementById('mode-place-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const pausedOverlay = document.getElementById('paused-overlay');
  const resumeBtn = document.getElementById('resume-btn');

  let mode = 'fall';
  let board = new Map(); // axialKey -> color
  let score = 0, level = 1, linesCleared = 0;
  let gameOver = false;
  let running = false;
  let paused = false;
  let flashRows = [];
  let flashTimer = 0;
  const CLEAR_FLASH_MS = 480;
  const BLINK_INTERVAL_MS = 100;
  let pendingClearBoard = null;
  let pendingClearCallback = null;

  // fall-mode state
  let current, next;
  let dropIntervalMs = BASE_DROP_MS;
  let dropAccumulator = 0;
  let lastFrameTime = null;

  // place-mode state
  let tray = [];
  let trayUi = [];
  let selectedSlot = -1;
  let hoverAxial = null;

  function getPieceCells(shape, rotationIndex, anchorQ, anchorR) {
    return shape.rotationStates[rotationIndex].map(([dq, dr]) => [anchorQ + dq, anchorR + dr]);
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    const stored = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    const best = Math.max(stored, score);
    if (best > stored) localStorage.setItem(HIGH_SCORE_KEY, String(best));
    bestScoreEl.textContent = best;
    if (mode === 'fall') {
      currentLabelEl.textContent = current ? `${current.shape.name} (${current.shape.formula})` : '';
      nextLabelEl.textContent = next ? `${next.shape.name} (${next.shape.formula})` : '';
    }
  }

  // Cleared rows blink in place for CLEAR_FLASH_MS before actually being
  // removed from the board -- afterClear runs once that removal happens.
  function applyLineClears(afterClear) {
    const { cleared, board: newBoard } = clearFullRows(board, mode === 'fall');
    if (cleared.length === 0) {
      afterClear();
      return;
    }
    linesCleared += cleared.length;
    score += 100 * cleared.length * cleared.length * level;
    const newLevel = 1 + Math.floor(linesCleared / LINES_PER_LEVEL);
    if (newLevel !== level) {
      level = newLevel;
      if (mode === 'fall') dropIntervalMs = Math.max(MIN_DROP_MS, BASE_DROP_MS - (level - 1) * 60);
    }
    updateHud();
    flashRows = cleared;
    flashTimer = CLEAR_FLASH_MS;
    pendingClearBoard = newBoard;
    pendingClearCallback = afterClear;
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

  // ---------- fall mode ----------

  function newFallingPiece(shapeSlot) {
    return { shape: shapeSlot.shape, rotationIndex: 0, anchorQ: SPAWN_Q, anchorR: SPAWN_R };
  }

  function fallCells(piece) {
    return getPieceCells(piece.shape, piece.rotationIndex, piece.anchorQ, piece.anchorR);
  }

  function tryMoveHorizontal(dq) {
    const trial = { ...current, anchorQ: current.anchorQ + dq };
    if (canPlaceCells(board, fallCells(trial))) { current = trial; return true; }
    return false;
  }

  function tryFall(piece) {
    const [nq, nr] = fallStep(piece.anchorQ, piece.anchorR);
    const trial = { ...piece, anchorQ: nq, anchorR: nr };
    return canPlaceCells(board, fallCells(trial)) ? trial : null;
  }

  function tryMoveDown() {
    const trial = tryFall(current);
    if (trial) { current = trial; return true; }
    return false;
  }

  const ROTATE_KICKS = [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]];

  function tryRotate() {
    const nextIndex = (current.rotationIndex + 1) % current.shape.rotationStates.length;
    for (const [kq, kr] of ROTATE_KICKS) {
      const trial = { ...current, rotationIndex: nextIndex, anchorQ: current.anchorQ + kq, anchorR: current.anchorR + kr };
      if (canPlaceCells(board, fallCells(trial))) { current = trial; return true; }
    }
    return false;
  }

  function hardDrop() {
    let cells = 0, trial;
    while ((trial = tryFall(current))) { current = trial; cells++; }
    score += cells * 2;
    fallLockPiece();
  }

  function fallLockPiece() {
    placeCells(board, fallCells(current), current.shape.color);
    score += current.shape.rotationStates[0].length * 10;
    current = null;
    updateHud();

    applyLineClears(() => {
      current = next;
      current.anchorQ = SPAWN_Q;
      current.anchorR = SPAWN_R;
      next = spawnPiece();
      updateHud();
      if (!canPlaceCells(board, fallCells(current))) endGame();
    });
  }

  // ---------- place mode ----------

  function buildPlacePanel() {
    placePanel.innerHTML = '';
    trayUi = [];
    for (let i = 0; i < TRAY_SIZE; i++) {
      const block = document.createElement('div');
      block.className = 'panel-block tray-slot';
      const canvas = document.createElement('canvas');
      canvas.className = 'tray-canvas';
      const label = document.createElement('div');
      label.className = 'molecule-label';
      const rotateBtn = document.createElement('button');
      rotateBtn.textContent = '↻';
      rotateBtn.className = 'tray-rotate-btn';
      block.appendChild(canvas);
      block.appendChild(label);
      block.appendChild(rotateBtn);
      placePanel.appendChild(block);
      trayUi.push({ block, canvas, ctx: canvas.getContext('2d'), label, rotateBtn });

      canvas.addEventListener('click', () => selectSlot(i));
      rotateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = tray[i];
        if (!slot) return;
        slot.rotationIndex = (slot.rotationIndex + 1) % slot.shape.rotationStates.length;
        renderTray();
      });
    }
  }

  function selectSlot(i) {
    if (!tray[i]) return;
    selectedSlot = selectedSlot === i ? -1 : i;
    renderTray();
  }

  function refillTrayIfEmpty() {
    if (tray.every(s => s === null)) {
      tray = [spawnPiece(), spawnPiece(), spawnPiece()];
      selectedSlot = -1;
    }
  }

  function slotFitsAnywhere(slot) {
    for (let ri = 0; ri < slot.shape.rotationStates.length; ri++) {
      for (let col = 0; col < NUM_COLS; col++) {
        for (let row = 0; row < NUM_ROWS; row++) {
          const [aq, ar] = offsetToAxial(col, row);
          const cells = getPieceCells(slot.shape, ri, aq, ar);
          if (canPlaceCells(board, cells)) return true;
        }
      }
    }
    return false;
  }

  function checkPlaceGameOver() {
    const anyPresent = tray.some(s => s);
    if (!anyPresent) return;
    const anyFits = tray.some(s => s && slotFitsAnywhere(s));
    if (!anyFits) endGame();
  }

  function placeAt(slotIndex, anchorQ, anchorR) {
    const slot = tray[slotIndex];
    if (!slot) return false;
    const cells = getPieceCells(slot.shape, slot.rotationIndex, anchorQ, anchorR);
    if (!canPlaceCells(board, cells)) return false;
    placeCells(board, cells, slot.shape.color);
    score += cells.length * 10;
    tray[slotIndex] = null;
    selectedSlot = -1;
    updateHud();
    renderTray();

    applyLineClears(() => {
      refillTrayIfEmpty();
      checkPlaceGameOver();
      renderTray();
    });
    return true;
  }

  function boardPointerToAxial(clientX, clientY) {
    const rect = boardCanvas.getBoundingClientRect();
    const localX = clientX - rect.left - originX;
    const localY = clientY - rect.top - originY;
    return pixelToAxial(localX, localY, hexSize);
  }

  function bindBoardPointerForPlacing() {
    boardCanvas.addEventListener('mousemove', (e) => {
      if (mode !== 'place' || selectedSlot < 0) { hoverAxial = null; return; }
      hoverAxial = boardPointerToAxial(e.clientX, e.clientY);
    });
    boardCanvas.addEventListener('mouseleave', () => { hoverAxial = null; });
    boardCanvas.addEventListener('click', (e) => {
      if (mode !== 'place' || selectedSlot < 0 || !running || flashTimer > 0) return;
      const [q, r] = boardPointerToAxial(e.clientX, e.clientY);
      placeAt(selectedSlot, q, r);
    });
  }

  function renderTray() {
    if (mode !== 'place') return;
    tray.forEach((slot, i) => {
      const ui = trayUi[i];
      ui.block.classList.toggle('selected', selectedSlot === i);
      ui.block.classList.toggle('empty', !slot);
      ui.canvas.width = ui.canvas.height = 0;
      const cssSize = 90;
      const dpr = window.devicePixelRatio || 1;
      ui.canvas.width = cssSize * dpr;
      ui.canvas.height = cssSize * dpr;
      ui.canvas.style.width = cssSize + 'px';
      ui.canvas.style.height = cssSize + 'px';
      ui.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ui.ctx.clearRect(0, 0, cssSize, cssSize);
      ui.label.textContent = slot ? `${slot.shape.name} (${slot.shape.formula})` : '';
      if (!slot) return;
      const size = 13;
      const offsets = slot.shape.rotationStates[slot.rotationIndex];
      const pts = offsets.map(([q, r]) => axialToPixel(q, r, size));
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of pts) {
        minX = Math.min(minX, x - size); maxX = Math.max(maxX, x + size);
        minY = Math.min(minY, y - size); maxY = Math.max(maxY, y + size);
      }
      const cx0 = (cssSize - (maxX - minX)) / 2 - minX;
      const cy0 = (cssSize - (maxY - minY)) / 2 - minY;
      pts.forEach(([x, y]) => {
        drawHex(ui.ctx, x + cx0, y + cy0, size * 0.92, slot.shape.color, '#1d2126', 1.5);
        drawRingMark(ui.ctx, x + cx0, y + cy0, size, 'rgba(255,255,255,0.7)');
      });
    });
  }

  // ---------- mode switching / reset ----------

  function setMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    modeFallBtn.classList.toggle('active', mode === 'fall');
    modePlaceBtn.classList.toggle('active', mode === 'place');
    fallPanel.classList.toggle('hidden', mode !== 'fall');
    placePanel.classList.toggle('hidden', mode !== 'place');
    touchControls.classList.toggle('hidden', mode !== 'fall');
    levelBox.classList.toggle('hidden', mode !== 'fall');
    pauseBtn.classList.toggle('hidden', mode !== 'fall');
    setBoardSize(mode === 'fall' ? FALL_COLS : PLACE_COLS, mode === 'fall' ? FALL_ROWS : PLACE_ROWS);
    computeBoardLayout(boardCanvas);
    resetGame();
  }

  function setPaused(value) {
    if (mode !== 'fall' || !running) return;
    paused = value;
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    pausedOverlay.classList.toggle('hidden', !paused);
  }

  function resetGame() {
    board = new Map();
    score = 0;
    level = 1;
    linesCleared = 0;
    gameOver = false;
    flashRows = [];
    flashTimer = 0;
    pendingClearBoard = null;
    pendingClearCallback = null;
    overlay.classList.add('hidden');
    running = true;
    paused = false;
    pauseBtn.textContent = 'Pause';
    pausedOverlay.classList.add('hidden');
    selectedSlot = -1;
    hoverAxial = null;

    if (mode === 'fall') {
      dropIntervalMs = BASE_DROP_MS;
      dropAccumulator = 0;
      lastFrameTime = null;
      current = newFallingPiece(spawnPiece());
      next = spawnPiece();
    } else {
      tray = [null, null, null];
      refillTrayIfEmpty();
      renderTray();
    }
    updateHud();
  }

  // ---------- rendering ----------

  function render() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawBoardGrid(boardCtx);

    const flashSet = new Set(flashRows);
    const blinkOn = flashTimer > 0 && Math.floor((CLEAR_FLASH_MS - flashTimer) / BLINK_INTERVAL_MS) % 2 === 0;
    drawLockedCells(boardCtx, board, flashSet, blinkOn);

    if (mode === 'fall' && running && current) {
      let ghost = current, step;
      while ((step = tryFall(ghost))) ghost = step;
      for (const [q, r] of fallCells(ghost)) {
        const [col, row] = axialToOffset(q, r);
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.9, 'rgba(255,255,255,0.12)', current.shape.color, 1.5);
      }
      for (const [q, r] of fallCells(current)) {
        const [col, row] = axialToOffset(q, r);
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.94, current.shape.color, '#1d2126', 2);
        drawRingMark(boardCtx, cx, cy, hexSize, 'rgba(255,255,255,0.7)');
      }
      renderNextPreview();
    }

    if (mode === 'place' && running && selectedSlot >= 0 && hoverAxial) {
      const slot = tray[selectedSlot];
      if (slot) {
        const cells = getPieceCells(slot.shape, slot.rotationIndex, hoverAxial[0], hoverAxial[1]);
        const valid = canPlaceCells(board, cells);
        for (const [q, r] of cells) {
          const [col, row] = axialToOffset(q, r);
          const [cx, cy] = cellCenter(col, row);
          drawHex(boardCtx, cx, cy, hexSize * 0.94, valid ? slot.shape.color : 'rgba(220,60,60,0.55)', valid ? '#1d2126' : '#7a1f1f', 2);
        }
      }
    }
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
      drawRingMark(nextCtx, x + cx0, y + cy0, size, 'rgba(255,255,255,0.7)');
    });
  }

  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    const dt = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) {
        flashRows = [];
        flashTimer = 0;
        if (pendingClearBoard) {
          board = pendingClearBoard;
          pendingClearBoard = null;
          const cb = pendingClearCallback;
          pendingClearCallback = null;
          if (cb) cb();
        }
      }
    }

    if (mode === 'fall' && running && !paused && !document.hidden) {
      dropAccumulator += dt;
      if (current && dropAccumulator >= dropIntervalMs) {
        dropAccumulator = 0;
        if (!tryMoveDown()) fallLockPiece();
      }
    }

    render();
    requestAnimationFrame(tick);
  }

  function bindControls() {
    window.addEventListener('keydown', (e) => {
      if (mode !== 'fall' || !running) return;
      if (e.key === 'p' || e.key === 'P') { setPaused(!paused); e.preventDefault(); return; }
      if (paused || !current) return;
      switch (e.key) {
        case 'ArrowLeft': tryMoveHorizontal(-1); e.preventDefault(); break;
        case 'ArrowRight': tryMoveHorizontal(1); e.preventDefault(); break;
        case 'ArrowDown': if (!tryMoveDown()) fallLockPiece(); e.preventDefault(); break;
        case 'ArrowUp': case 'r': case 'R': tryRotate(); e.preventDefault(); break;
        case ' ': hardDrop(); e.preventDefault(); break;
      }
    });

    const bind = (id, fn) => document.getElementById(id).addEventListener('click', () => { if (mode === 'fall' && running && !paused && current) fn(); });
    bind('btn-left', () => tryMoveHorizontal(-1));
    bind('btn-right', () => tryMoveHorizontal(1));
    bind('btn-down', () => { if (!tryMoveDown()) fallLockPiece(); });
    bind('btn-rotate', tryRotate);
    bind('btn-drop', hardDrop);

    document.getElementById('new-game-btn').addEventListener('click', resetGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);
    modeFallBtn.addEventListener('click', () => setMode('fall'));
    modePlaceBtn.addEventListener('click', () => setMode('place'));
    pauseBtn.addEventListener('click', () => setPaused(!paused));
    resumeBtn.addEventListener('click', () => setPaused(false));

    window.addEventListener('resize', () => computeBoardLayout(boardCanvas));
    bindBoardPointerForPlacing();
  }

  buildPlacePanel();
  setBoardSize(FALL_COLS, FALL_ROWS);
  computeBoardLayout(boardCanvas);
  bindControls();
  resetGame();
  requestAnimationFrame(tick);
})();
