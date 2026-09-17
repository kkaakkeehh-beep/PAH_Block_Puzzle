(function () {
  const FALL_COLS = 7, FALL_ROWS = 14;
  const PLACE_COLS = 7, PLACE_ROWS = 9;
  const SPAWN_ROW = 2;
  // Centers the piece's own bounding width, not just a fixed column -- a
  // fixed center column overflows the board for wide pieces (e.g. Pentacene
  // is 5 cells wide), which made them invalid the instant they spawned and
  // falsely triggered game over.
  //
  // The row is then the highest (smallest-index) one where every cell of the
  // piece still lands at row >= 0, rather than a fixed SPAWN_ROW -- a fixed
  // row leaves almost no buffer above a moderately tall stack, so a column
  // near the spawn point could block new pieces well before the board was
  // actually full.
  function spawnAxial(shape) {
    const offsets = shape.rotationStates[0];
    const dqs = offsets.map(([dq]) => dq);
    const minDq = Math.min(...dqs), maxDq = Math.max(...dqs);
    const width = maxDq - minDq + 1;
    let col = Math.floor((NUM_COLS - width) / 2) - minDq;
    col = Math.max(-minDq, Math.min(col, NUM_COLS - 1 - maxDq));

    for (let row = 0; row <= SPAWN_ROW + 4; row++) {
      const [aq, ar] = offsetToAxial(col, row);
      const rows = offsets.map(([dq, dr]) => axialToOffset(aq + dq, ar + dr)[1]);
      if (Math.min(...rows) >= 0) return [aq, ar];
    }
    return offsetToAxial(col, SPAWN_ROW);
  }
  const BASE_DROP_MS = 800;
  const MIN_DROP_MS = 120;
  const LINES_PER_LEVEL = 8;
  const TIME_SPEEDUP_INTERVAL_MS = 20000;
  const DROP_MS_PER_LEVEL = 50;
  const LEGACY_HIGH_SCORE_KEY = 'pahBlockPuzzleHighScore';
  const HIGH_SCORE_KEYS = { fall: 'pahBlockPuzzleHighScore_fall', place: 'pahBlockPuzzleHighScore_place' };

  function getStoredBest(forMode) {
    return Number(localStorage.getItem(HIGH_SCORE_KEYS[forMode]) || 0);
  }
  const TRAY_SIZE = 3;

  // Level (shown in the HUD) climbs from lines cleared OR just from time
  // spent playing, whichever is higher -- so a round that never completes a
  // line still ramps up, and the displayed Level always matches what's
  // actually driving the fall speed instead of only tracking line clears.
  function computeLevel(clearedLines, playedMs) {
    const lineLevel = 1 + Math.floor(clearedLines / LINES_PER_LEVEL);
    const timeLevel = 1 + Math.floor(playedMs / TIME_SPEEDUP_INTERVAL_MS);
    return Math.max(lineLevel, timeLevel);
  }

  function dropIntervalForLevel(lvl) {
    return Math.max(MIN_DROP_MS, BASE_DROP_MS - (lvl - 1) * DROP_MS_PER_LEVEL);
  }

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
  const pauseBtn = document.getElementById('pause-btn');
  const pausedOverlay = document.getElementById('paused-overlay');
  const resumeBtn = document.getElementById('resume-btn');
  const homeScreen = document.getElementById('home-screen');
  const gameScreen = document.getElementById('game-screen');
  const orientationScreen = document.getElementById('orientation-screen');
  const difficultyScreen = document.getElementById('difficulty-screen');
  const homeFallBtn = document.getElementById('home-fall-btn');
  const homePlaceBtn = document.getElementById('home-place-btn');
  const homeBtn = document.getElementById('home-btn');
  const orientationBackBtn = document.getElementById('orientation-back-btn');
  const orientationCards = document.querySelectorAll('#orientation-screen .difficulty-card');
  const difficultyBackBtn = document.getElementById('difficulty-back-btn');
  const difficultyCards = document.querySelectorAll('#difficulty-screen .difficulty-card');

  let screen = 'home';
  let pendingMode = null;
  let mode = 'fall';
  let fallOrientation = 'flat';
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
  let elapsedMs = 0;
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
    const stored = getStoredBest(mode);
    const best = Math.max(stored, score);
    if (best > stored) localStorage.setItem(HIGH_SCORE_KEYS[mode], String(best));
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
    if (mode === 'fall') {
      level = computeLevel(linesCleared, elapsedMs);
      dropIntervalMs = dropIntervalForLevel(level);
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
    const best = getStoredBest(mode);
    if (score > best) {
      localStorage.setItem(HIGH_SCORE_KEYS[mode], String(score));
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
    const [q, r] = spawnAxial(shapeSlot.shape);
    return { shape: shapeSlot.shape, rotationIndex: 0, anchorQ: q, anchorR: r };
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
    for (const [nq, nr] of fallStepCandidates(piece.anchorQ, piece.anchorR)) {
      const trial = { ...piece, anchorQ: nq, anchorR: nr };
      if (canPlaceCells(board, fallCells(trial))) return trial;
    }
    return null;
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
      [current.anchorQ, current.anchorR] = spawnAxial(current.shape);
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

      rotateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slot = tray[i];
        if (!slot) return;
        slot.rotationIndex = (slot.rotationIndex + 1) % slot.shape.rotationStates.length;
        renderTray();
      });
    }
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

  // Press a tray piece and drag onto the board; the board-preview follows
  // the pointer the whole way (via hoverAxial) so it's clear where it'll
  // land even on touch, where there's no hover state to show it beforehand.
  //
  // Tracks the drag via window-level pointermove/pointerup rather than
  // setPointerCapture on the tray canvas -- capture support for canvas
  // elements is inconsistent on some real mobile browsers, whereas a
  // window listener gated on "is a drag active" works everywhere and
  // doesn't care which element the pointer is currently over.
  //
  // If the pointer goes up without ever reaching the board (a plain tap,
  // or a drag gesture that just didn't register for some reason), it falls
  // back to the old tap-to-select-then-tap-the-board flow instead of
  // silently doing nothing, so there's always a working path.
  // Dragging only ever *chooses* a cell (updates hoverAxial); it never
  // places by itself. Placing always happens via a separate confirm tap on
  // the board, and that tap uses whatever cell the drag already locked in
  // -- it does not recompute a position from where the tap itself landed.
  // This is deliberate: trying to place exactly on release/cancel turned
  // out to be unreliable across real mobile browsers (drag-end events don't
  // fire consistently), so instead the drag's only job is to show where it
  // would go, and a plain, ordinary tap (the single most reliable gesture
  // there is) confirms it there regardless of the tap's own precision.
  //
  // If there was no drag at all (a direct tap on the tray, then a tap on
  // the board with no hoverAxial yet), the board tap's own coordinates are
  // used instead, so a no-drag tap-then-tap flow still works.
  function bindTrayDragControls() {
    let draggingSlot = -1;
    let draggingPointerId = null;

    function updateHoverFromEvent(e) {
      const rect = boardCanvas.getBoundingClientRect();
      const pad = 24; // dragging a little past the visual edge still counts
      const inside = e.clientX >= rect.left - pad && e.clientX <= rect.right + pad && e.clientY >= rect.top - pad && e.clientY <= rect.bottom + pad;
      hoverAxial = inside ? boardPointerToAxial(e.clientX, e.clientY) : null;
    }

    function endDrag() {
      if (draggingSlot < 0) return;
      selectedSlot = draggingSlot;
      draggingSlot = -1;
      draggingPointerId = null;
      renderTray();
    }

    window.addEventListener('pointermove', (e) => {
      if (draggingSlot < 0 || e.pointerId !== draggingPointerId) return;
      updateHoverFromEvent(e);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('pointerup', (e) => {
      if (draggingSlot < 0 || e.pointerId !== draggingPointerId) return;
      updateHoverFromEvent(e);
      endDrag();
    });
    window.addEventListener('pointercancel', (e) => {
      if (draggingSlot < 0 || e.pointerId !== draggingPointerId) return;
      endDrag();
    });

    trayUi.forEach((ui, i) => {
      ui.canvas.addEventListener('pointerdown', (e) => {
        if (!tray[i] || !running || flashTimer > 0) return;
        draggingSlot = i;
        draggingPointerId = e.pointerId;
        hoverAxial = null;
        updateHoverFromEvent(e);
        e.preventDefault();
      });
    });

    boardCanvas.addEventListener('pointermove', (e) => {
      if (mode !== 'place' || selectedSlot < 0 || draggingSlot >= 0) return;
      hoverAxial = boardPointerToAxial(e.clientX, e.clientY);
    });
    boardCanvas.addEventListener('mouseleave', () => {
      if (draggingSlot < 0 && selectedSlot < 0) hoverAxial = null;
    });
    boardCanvas.addEventListener('click', (e) => {
      if (mode !== 'place' || selectedSlot < 0 || draggingSlot >= 0 || !running || flashTimer > 0) return;
      const [q, r] = hoverAxial || boardPointerToAxial(e.clientX, e.clientY);
      placeAt(selectedSlot, q, r);
    });
  }

  // Same window-level tracking approach as bindTrayDragControls, and for
  // the same reason: no dependency on setPointerCapture.
  function bindSwipeControls() {
    const SWIPE_MIN_DIST = 28;
    let startX = 0, startY = 0, tracking = false, pointerId = null;

    boardCanvas.addEventListener('pointerdown', (e) => {
      if (mode !== 'fall') return;
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
      pointerId = e.pointerId;
    });

    window.addEventListener('pointermove', (e) => {
      if (tracking && e.pointerId === pointerId && mode === 'fall') e.preventDefault();
    }, { passive: false });

    window.addEventListener('pointerup', (e) => {
      if (!tracking || e.pointerId !== pointerId) return;
      tracking = false;
      if (mode !== 'fall' || !running || paused || !current) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN_DIST && Math.abs(dy) < SWIPE_MIN_DIST) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        tryMoveHorizontal(dx > 0 ? 1 : -1);
      } else if (dy < 0) {
        tryRotate();
      } else {
        hardDrop();
      }
    });

    window.addEventListener('pointercancel', (e) => {
      if (e.pointerId === pointerId) tracking = false;
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

  function setMode(newMode, force) {
    if (mode === newMode && !force) return;
    mode = newMode;
    fallPanel.classList.toggle('hidden', mode !== 'fall');
    placePanel.classList.toggle('hidden', mode !== 'place');
    touchControls.classList.toggle('hidden', mode !== 'fall');
    levelBox.classList.toggle('hidden', mode !== 'fall');
    pauseBtn.classList.toggle('hidden', mode !== 'fall');
    // Placing mode's click-to-place math only works for flat-top hexes.
    setOrientation(mode === 'fall' ? fallOrientation : 'flat');
    setBoardSize(mode === 'fall' ? FALL_COLS : PLACE_COLS, mode === 'fall' ? FALL_ROWS : PLACE_ROWS);
    computeBoardLayout(boardCanvas);
    resetGame();
  }

  function hideAllPreGameScreens() {
    homeScreen.classList.add('hidden');
    orientationScreen.classList.add('hidden');
    difficultyScreen.classList.add('hidden');
  }

  function showOrientationScreen(desiredMode) {
    pendingMode = desiredMode;
    screen = 'orientation';
    hideAllPreGameScreens();
    orientationScreen.classList.remove('hidden');
  }

  function showDifficultyScreen(desiredMode) {
    pendingMode = desiredMode;
    screen = 'difficulty';
    hideAllPreGameScreens();
    difficultyScreen.classList.remove('hidden');
  }

  function enterGame(desiredMode, difficultyFactor) {
    setDifficultyFactor(difficultyFactor);
    screen = 'game';
    hideAllPreGameScreens();
    gameScreen.classList.remove('hidden');
    setMode(desiredMode, true);
  }

  function goHome() {
    screen = 'home';
    pendingMode = null;
    running = false;
    gameScreen.classList.add('hidden');
    levelBox.classList.add('hidden');
    hideAllPreGameScreens();
    homeScreen.classList.remove('hidden');
    overlay.classList.add('hidden');
    pausedOverlay.classList.add('hidden');
    bestScoreEl.textContent = Math.max(getStoredBest('fall'), getStoredBest('place'));
  }

  function setPaused(value) {
    if (mode !== 'fall' || !running) return;
    paused = value;
    pauseBtn.textContent = t(paused ? 'game.resume' : 'game.pause');
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
    pauseBtn.textContent = t('game.pause');
    pausedOverlay.classList.add('hidden');
    selectedSlot = -1;
    hoverAxial = null;

    if (mode === 'fall') {
      dropIntervalMs = BASE_DROP_MS;
      dropAccumulator = 0;
      elapsedMs = 0;
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

  // Marks the boundary between SPAWN_ROW-1 and SPAWN_ROW: stack up to (or
  // past) it in the spawn columns and the next piece won't fit.
  function drawDeadline(ctx) {
    const col = Math.floor(NUM_COLS / 2);
    const [, yAbove] = cellCenter(col, SPAWN_ROW - 1);
    const [, yAt] = cellCenter(col, SPAWN_ROW);
    const lineY = (yAbove + yAt) / 2;
    const [x0] = cellCenter(0, SPAWN_ROW);
    const [x1] = cellCenter(NUM_COLS - 1, SPAWN_ROW);
    const pad = hexSize * 1.2;
    ctx.save();
    ctx.strokeStyle = 'rgba(214, 40, 40, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x0 - pad, lineY);
    ctx.lineTo(x1 + pad, lineY);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawBoardGrid(boardCtx);
    if (mode === 'fall') drawDeadline(boardCtx);

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

    if (screen === 'game' && mode === 'fall' && running && !paused && !document.hidden) {
      elapsedMs += dt;
      const newLevel = computeLevel(linesCleared, elapsedMs);
      if (newLevel !== level) {
        level = newLevel;
        updateHud();
      }
      dropIntervalMs = dropIntervalForLevel(level);
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
      if (screen !== 'game' || mode !== 'fall' || !running) return;
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

    const bind = (id, fn) => document.getElementById(id).addEventListener('click', () => { if (screen === 'game' && mode === 'fall' && running && !paused && current) fn(); });
    bind('btn-left', () => tryMoveHorizontal(-1));
    bind('btn-right', () => tryMoveHorizontal(1));
    bind('btn-down', () => { if (!tryMoveDown()) fallLockPiece(); });
    bind('btn-rotate', tryRotate);
    bind('btn-drop', hardDrop);

    document.getElementById('new-game-btn').addEventListener('click', resetGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);
    pauseBtn.addEventListener('click', () => setPaused(!paused));
    resumeBtn.addEventListener('click', () => setPaused(false));
    homeFallBtn.addEventListener('click', () => showOrientationScreen('fall'));
    homePlaceBtn.addEventListener('click', () => showDifficultyScreen('place'));
    homeBtn.addEventListener('click', goHome);
    orientationBackBtn.addEventListener('click', () => {
      screen = 'home';
      pendingMode = null;
      orientationScreen.classList.add('hidden');
      homeScreen.classList.remove('hidden');
    });
    orientationCards.forEach(card => {
      card.addEventListener('click', () => {
        fallOrientation = card.dataset.orientation;
        showDifficultyScreen(pendingMode);
      });
    });
    difficultyBackBtn.addEventListener('click', () => {
      if (pendingMode === 'fall') {
        screen = 'orientation';
        difficultyScreen.classList.add('hidden');
        orientationScreen.classList.remove('hidden');
      } else {
        screen = 'home';
        pendingMode = null;
        difficultyScreen.classList.add('hidden');
        homeScreen.classList.remove('hidden');
      }
    });
    difficultyCards.forEach(card => {
      card.addEventListener('click', () => enterGame(pendingMode, Number(card.dataset.factor)));
    });

    window.addEventListener('resize', () => computeBoardLayout(boardCanvas));
    bindTrayDragControls();
    bindSwipeControls();
  }

  // One-time migration: seed both per-mode bests from the old shared one so
  // nobody's existing high score just disappears.
  (function migrateLegacyHighScore() {
    const legacy = localStorage.getItem(LEGACY_HIGH_SCORE_KEY);
    if (legacy === null) return;
    for (const key of Object.values(HIGH_SCORE_KEYS)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy);
    }
    localStorage.removeItem(LEGACY_HIGH_SCORE_KEY);
  })();

  buildPlacePanel();
  setOrientation(fallOrientation);
  setBoardSize(FALL_COLS, FALL_ROWS);
  computeBoardLayout(boardCanvas);
  bindControls();
  bestScoreEl.textContent = Math.max(getStoredBest('fall'), getStoredBest('place'));
  requestAnimationFrame(tick);
})();
