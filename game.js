(function () {
  const FALL_COLS = 7, FALL_ROWS = 14;
  const PLACE_COLS = 7, PLACE_ROWS = 9;
  const SPAWN_ROW = 2;
  // The anchor column that centres a rotation's own bounding width, clamped
  // so no cell falls off either side. A fixed centre column overflowed the
  // board for wide pieces (pentacene is five cells across), which made them
  // invalid the instant they spawned and falsely triggered game over.
  function idealSpawnCol(offsets) {
    const dqs = offsets.map(([dq]) => dq);
    const minDq = Math.min(...dqs), maxDq = Math.max(...dqs);
    const width = maxDq - minDq + 1;
    const col = Math.floor((NUM_COLS - width) / 2) - minDq;
    return Math.max(-minDq, Math.min(col, NUM_COLS - 1 - maxDq));
  }

  // The fallback position, used only when findSpawn finds nowhere the piece
  // actually fits. The row is the highest one where every cell still lands at
  // row >= 0, rather than a fixed SPAWN_ROW, which left almost no buffer
  // above a moderately tall stack.
  function spawnAxial(shape) {
    const offsets = shape.rotationStates[0];
    const col = idealSpawnCol(offsets);

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
  const NEXT_COUNT = 3;
  // 500ms, matching modern Tetris. Worth noting it is a large fraction of
  // this game's 800ms opening gravity step, so raising it further would have
  // a grounded molecule visibly hanging in mid-air; 800 would be a full drop
  // step and should not be tried. Six resets caps the worst-case stall at
  // about three and a half seconds.
  const LOCK_DELAY_MS = 500;
  const MAX_LOCK_RESETS = 6;
  const TIME_SPEEDUP_INTERVAL_MS = 20000;
  const DROP_MS_PER_LEVEL = 50;
  const LEGACY_HIGH_SCORE_KEY = 'pahBlockPuzzleHighScore';
  const HIGH_SCORE_KEYS = { fall: 'pahBlockPuzzleHighScore_fall', place: 'pahBlockPuzzleHighScore_place' };

  // Reads are guarded like the writes are: a browser set to block all site
  // data throws on any localStorage access, not only on setItem, and this
  // runs from updateHud on every frame.
  function getStoredBest(forMode) {
    try {
      return Number(localStorage.getItem(HIGH_SCORE_KEYS[forMode])) || 0;
    } catch (e) {
      return 0;
    }
  }

  // Which molecules the player has actually landed, for the home-screen
  // collection. Recorded on placement rather than on spawn, so a molecule
  // you only watched go past doesn't count.
  const SEEN_KEY = 'pahBlockPuzzleSeen';
  let seenMolecules = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    if (Array.isArray(stored)) seenMolecules = new Set(stored);
  } catch (err) { /* corrupt entry: start the collection over */ }

  function markSeen(shape) {
    if (seenMolecules.has(shape.name)) return;
    seenMolecules.add(shape.name);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenMolecules])); } catch (e) { /* storage full or disabled */ }
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
  const holdCanvas = document.getElementById('hold-canvas');
  const holdCtx = holdCanvas.getContext('2d');
  const holdLabelEl = document.getElementById('hold-label');
  const holdBlock = document.getElementById('hold-block');
  const scoreEl = document.getElementById('score');
  const scoresEl = document.getElementById('scores');
  const bestScoreEl = document.getElementById('best-score');
  const bestModeTag = document.getElementById('best-mode-tag');
  const homeFallBest = document.getElementById('home-fall-best');
  const homePlaceBest = document.getElementById('home-place-best');
  const runSummaryEl = document.getElementById('run-summary');
  const gameOverBestEl = document.getElementById('game-over-best');
  const levelEl = document.getElementById('level');
  const levelBox = document.getElementById('level-box');
  const currentLabelEl = document.getElementById('current-label');
  const nextLabelEl = document.getElementById('next-label');
  const overlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const newBestEl = document.getElementById('new-best');
  const shareNativeBtn = document.getElementById('share-native-btn');
  const shareXBtn = document.getElementById('share-x-btn');
  const shareInstagramBtn = document.getElementById('share-instagram-btn');
  const shareLineBtn = document.getElementById('share-line-btn');
  const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
  const shareTelegramBtn = document.getElementById('share-telegram-btn');
  const shareEmailBtn = document.getElementById('share-email-btn');
  const shareCopyBtn = document.getElementById('share-copy-btn');
  const shareCopiedNote = document.getElementById('share-copied-note');
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
  const helpCols = document.getElementById('controls-help-cols');
  const collectionGrid = document.getElementById('collection-grid');
  const collectionCount = document.getElementById('collection-count');
  const difficultyCards = document.querySelectorAll('#difficulty-screen .difficulty-card');

  let screen = 'home';
  let pendingMode = null;
  let mode = 'fall';
  let fallOrientation = 'flat';
  let difficultyKey = 'normal';
  // Captured when a round starts. updateHud() writes the running score to
  // storage as soon as it passes the old best, so by the time endGame() runs
  // the stored best always equals the score -- comparing against it would
  // never detect a new record.
  let bestAtStart = 0;
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
  let current;
  let nextQueue = [];
  // The piece parked in Hold, and whether Hold has already been used for the
  // piece currently falling. Without that second flag you could swap back and
  // forth forever and never have to commit to a placement.
  let held = null;
  let holdUsed = false;
  let dropIntervalMs = BASE_DROP_MS;
  let dropAccumulator = 0;
  // Grace period once a piece touches down, so gravity alone can't lock it
  // the instant it lands. At high levels the drop interval falls to 120ms,
  // which left no chance at all to slide or turn a piece after it grounded.
  // Moving or rotating restarts the clock, but only so many times -- without
  // that cap a player could keep a piece alive indefinitely, and even with
  // it the worst case is about two seconds. A soft drop or hard drop still
  // locks immediately, so there is always a way to commit.
  let lockTimer = null;
  let lockResets = 0;
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

  function modeName(forMode) {
    return t(forMode === 'fall' ? 'home.fallingTitle' : 'home.placingTitle');
  }

  // Each mode keeps its own best, so the home cards show both side by side
  // instead of collapsing them into one number.
  // Tiles for every molecule in the set, greyed out until you've landed one.
  // Drawn flat-top regardless of the orientation the last game used, so the
  // collection looks the same from one visit to the next.
  function renderCollection() {
    setOrientation('flat');
    collectionGrid.textContent = '';
    let found = 0;
    for (const shape of PAH_SHAPES) {
      const seen = seenMolecules.has(shape.name);
      if (seen) found++;
      const tile = document.createElement('div');
      tile.className = 'collection-tile';
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const w = 74, h = 52;
      sizeCanvas(canvas, ctx, w, h);
      if (seen) {
        drawMoleculeIn(ctx, shape, 7.5, 0, 0, w, h, 1);
      } else {
        drawMoleculeIn(ctx, shape, 7.5, 0, 0, w, h, 1,
          'rgba(127,133,140,0.22)', 'rgba(127,133,140,0.55)', true);
      }
      const name = document.createElement('div');
      name.className = 'collection-name';
      name.textContent = seen ? shape.name : '???';
      const formula = document.createElement('div');
      formula.className = 'collection-formula';
      formula.textContent = seen ? shape.formula : '';
      tile.append(canvas, name, formula);
      collectionGrid.appendChild(tile);
    }
    collectionCount.textContent = found + ' / ' + PAH_SHAPES.length;
  }

  function refreshHomeBests() {
    homeFallBest.textContent = getStoredBest('fall');
    homePlaceBest.textContent = getStoredBest('place');
  }

  // The settings a round was actually played with -- shown on the Game Over
  // card and included in the share text, so a score always carries the
  // context that makes it comparable.
  function runDetailParts() {
    const parts = [
      t('detail.mode') + ': ' + modeName(mode),
      t('detail.difficulty') + ': ' + t('difficulty.' + difficultyKey + 'Title'),
    ];
    if (mode === 'fall') {
      parts.push(t('detail.hexes') + ': ' + t(fallOrientation === 'flat' ? 'orientation.flatTitle' : 'orientation.pointyTitle'));
      parts.push(t('detail.level') + ': ' + level);
    }
    parts.push(t('detail.lines') + ': ' + linesCleared);
    return parts;
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    bestModeTag.textContent = ' · ' + modeName(mode);
    const stored = getStoredBest(mode);
    const best = Math.max(stored, score);
    if (best > stored) {
      try { localStorage.setItem(HIGH_SCORE_KEYS[mode], String(best)); } catch (e) { /* storage full or disabled */ }
    }
    bestScoreEl.textContent = best;
    if (mode === 'fall') {
      currentLabelEl.textContent = current ? `${current.shape.name} (${current.shape.formula})` : '';
      const upcoming = nextQueue[0];
      nextLabelEl.textContent = upcoming ? `${upcoming.shape.name} (${upcoming.shape.formula})` : '';
      holdLabelEl.textContent = held ? `${held.shape.name} (${held.shape.formula})` : '';
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
    // Cascade: re-settling the stack after a clear can complete another row,
    // and one left sitting there full looks broken. Checking again once the
    // flash has swapped the board in scores each round separately, so a chain
    // pays out like the combo it is.
    pendingClearCallback = () => applyLineClears(afterClear);
  }

  function endGame() {
    gameOver = true;
    running = false;
    if (score > bestAtStart) {
      try { localStorage.setItem(HIGH_SCORE_KEYS[mode], String(score)); } catch (e) { /* storage full or disabled */ }
      newBestEl.classList.remove('hidden');
    } else {
      newBestEl.classList.add('hidden');
    }
    finalScoreEl.textContent = score;
    runSummaryEl.textContent = runDetailParts().join(' · ');
    gameOverBestEl.textContent =
      t('gameOver.bestFor').replace('{mode}', modeName(mode)) + ': ' + getStoredBest(mode);
    updateHud();
    setupShareButtons();
    overlay.classList.remove('hidden');
  }

  // Instagram has no web share-intent URL for arbitrary posts (only its own
  // app can post to Stories/feed), so its button just copies the message
  // like the generic "Copy link" fallback -- X and LINE both have real
  // share-intent URLs, so those are plain links.
  // Left untranslated on purpose: a hashtag only gathers posts together if
  // everyone writes it the same way, so these stay identical in all sixteen
  // languages even though the message around them is translated.
  const SHARE_HASHTAGS = '#PAHBlockPuzzle #PAH #Chemistry #Puzzle';

  function setupShareButtons() {
    const text = t('share.message').replace('{score}', score)
      + '\n' + runDetailParts().join(' / ')
      + '\n' + SHARE_HASHTAGS;
    // Not location.href: that carries along whatever query string the page
    // happens to have been opened with, and those end up in the shared link.
    const url = location.origin + location.pathname;
    shareCopiedNote.classList.add('hidden');

    shareXBtn.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    shareLineBtn.href = 'https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    shareTelegramBtn.href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
    // WhatsApp and mailto take one field each, so the link goes inside it.
    shareWhatsappBtn.href = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
    shareEmailBtn.href = 'mailto:?subject=' + encodeURIComponent('PAH Block Puzzle')
      + '&body=' + encodeURIComponent(text + '\n\n' + url);

    if (navigator.share) {
      shareNativeBtn.classList.remove('hidden');
      shareNativeBtn.onclick = () => navigator.share({ text, url }).catch(() => {});
    } else {
      shareNativeBtn.classList.add('hidden');
    }

    const copyToClipboard = () => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(text + ' ' + url)
        .then(() => shareCopiedNote.classList.remove('hidden'))
        .catch(() => {});
    };
    shareCopyBtn.onclick = copyToClipboard;
    shareInstagramBtn.onclick = copyToClipboard;
  }

  // ---------- fall mode ----------

  // spawnAxial picks a position without looking at the stack, so a wide
  // molecule arriving over an uneven stack could appear already overlapping
  // it and end the game before the player could move at all. This looks for
  // somewhere the piece genuinely fits, preferring the top of the board, then
  // columns outward from the middle, and only as a last resort a rotation
  // other than the one shown in the Next preview.
  function findSpawn(shape) {
    for (let ri = 0; ri < shape.rotationStates.length; ri++) {
      // Columns are tried outward from the one that centres this rotation's
      // own bounding box, not from the middle of the board, so on an empty
      // board a piece still arrives exactly where it always did.
      const ideal = idealSpawnCol(shape.rotationStates[ri]);
      const cols = [ideal];
      for (let d = 1; d < NUM_COLS; d++) {
        if (ideal - d >= 0) cols.push(ideal - d);
        if (ideal + d < NUM_COLS) cols.push(ideal + d);
      }
      for (let row = 0; row <= SPAWN_ROW + 4; row++) {
        for (const col of cols) {
          const [aq, ar] = offsetToAxial(col, row);
          if (canPlaceCells(board, getPieceCells(shape, ri, aq, ar))) {
            return { rotationIndex: ri, anchorQ: aq, anchorR: ar };
          }
        }
      }
    }
    return null;
  }

  function newFallingPiece(shapeSlot) {
    const spot = findSpawn(shapeSlot.shape);
    if (spot) return { shape: shapeSlot.shape, ...spot };
    // The board genuinely has no room for this molecule in any rotation.
    // Return the default position and let the caller's placement check end
    // the game.
    const [q, r] = spawnAxial(shapeSlot.shape);
    return { shape: shapeSlot.shape, rotationIndex: 0, anchorQ: q, anchorR: r };
  }

  function fallCells(piece) {
    return getPieceCells(piece.shape, piece.rotationIndex, piece.anchorQ, piece.anchorR);
  }

  // Called after any successful player move while the piece is grounded.
  function restartLockDelay() {
    if (lockTimer === null || lockResets >= MAX_LOCK_RESETS) return;
    lockResets++;
    lockTimer = LOCK_DELAY_MS;
  }

  function tryMoveHorizontal(dq) {
    const trial = { ...current, anchorQ: current.anchorQ + dq };
    if (canPlaceCells(board, fallCells(trial))) {
      current = trial;
      restartLockDelay();
      return true;
    }
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

  // Wall kicks, as (column, row) offsets rather than axial ones so that
  // "nudge two columns right" means exactly that at any position.
  //
  // The range has to cover the widest molecule. Rotating pentacene from its
  // upright form sweeps all five rings to one side of the anchor, so against
  // a wall it needs the anchor moved up to four columns to fit -- with the
  // old one-cell kick set that rotation simply failed, which is why pieces
  // felt stuck at the edges.
  //
  // Ordered by total displacement, preferring a sideways nudge over moving
  // the piece vertically, so the closest legal position wins and a rotation
  // never teleports further than it must.
  //
  // The row range is deliberately lopsided. Downward kicks cost nothing --
  // the piece is falling anyway -- so two of them are allowed, which is what
  // a wide molecule needs to turn just after it spawns. Upward kicks are
  // capped at one, because lifting a piece further would let a player stall
  // a landing indefinitely by rotating. A molecule wedged against the floor
  // with no room to turn then simply refuses, as it should.
  const ROTATE_KICKS = (() => {
    const kicks = [];
    for (let dcol = -4; dcol <= 4; dcol++) {
      for (let drow = -1; drow <= 2; drow++) kicks.push([dcol, drow]);
    }
    kicks.sort((a, b) => {
      const spanA = Math.abs(a[0]) + Math.abs(a[1]);
      const spanB = Math.abs(b[0]) + Math.abs(b[1]);
      if (spanA !== spanB) return spanA - spanB;
      if (Math.abs(a[1]) !== Math.abs(b[1])) return Math.abs(a[1]) - Math.abs(b[1]);
      if (a[0] !== b[0]) return b[0] - a[0];
      return b[1] - a[1];
    });
    return kicks;
  })();

  function tryRotate() {
    const nextIndex = (current.rotationIndex + 1) % current.shape.rotationStates.length;
    const [col, row] = axialToOffset(current.anchorQ, current.anchorR);
    for (const [dcol, drow] of ROTATE_KICKS) {
      const [aq, ar] = offsetToAxial(col + dcol, row + drow);
      const trial = { ...current, rotationIndex: nextIndex, anchorQ: aq, anchorR: ar };
      if (canPlaceCells(board, fallCells(trial))) {
        current = trial;
        restartLockDelay();
        return true;
      }
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
    placeCells(board, fallCells(current), current.shape, current.rotationIndex);
    markSeen(current.shape);
    score += current.shape.rotationStates[0].length * 10;
    current = null;
    updateHud();

    applyLineClears(() => {
      // The drawn deadline is a real boundary, not decoration: once the
      // settled stack reaches above it the round is over. Every molecule
      // *enters* the board inside that band and falls out of it, so this can
      // only be judged after a piece comes to rest -- and it is judged after
      // line clears, so a row completed by the very piece that reached up
      // there still saves you.
      if (stackAboveDeadline()) {
        endGame();
        return;
      }
      current = newFallingPiece(takeFromQueue());
      holdUsed = false;
      lockTimer = null;
      lockResets = 0;
      updateHud();
      if (!canPlaceCells(board, fallCells(current))) endGame();
    });
  }

  function stackAboveDeadline() {
    for (const key of board.keys()) {
      const [q, r] = key.split(',').map(Number);
      if (axialToOffset(q, r)[1] < SPAWN_ROW) return true;
    }
    return false;
  }

  function takeFromQueue() {
    const piece = nextQueue.shift();
    nextQueue.push(spawnPiece());
    return piece;
  }

  // Parks the falling piece and brings out whatever was parked before, or the
  // next one from the queue on the first use. The swapped-in piece re-enters
  // at the spawn position in its default rotation, like a fresh piece.
  function holdPiece() {
    if (mode !== 'fall' || !running || paused || gameOver || !current || holdUsed || flashTimer > 0) return;
    const incoming = held;
    held = { shape: current.shape, rotationIndex: 0 };
    current = newFallingPiece(incoming || takeFromQueue());
    holdUsed = true;
    lockTimer = null;
    lockResets = 0;
    updateHud();
    if (!canPlaceCells(board, fallCells(current))) endGame();
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
        rotateSlot(i);
      });
    }
  }

  function rotateSlot(index) {
    if (!running || gameOver) return;
    const slot = tray[index];
    if (!slot) return;
    slot.rotationIndex = (slot.rotationIndex + 1) % slot.shape.rotationStates.length;
    renderTray();
  }

  // ---------- place mode: keyboard ----------
  //
  // Placing was mouse- and touch-only, so on a desktop without a pointer it
  // could not be played at all. The keyboard drives the same hoverAxial
  // preview the pointer does, so the ghost and the placement rules are
  // shared rather than duplicated.

  function centreOfBoard() {
    return offsetToAxial(Math.floor(NUM_COLS / 2), Math.floor(NUM_ROWS / 2));
  }

  function selectSlot(index) {
    if (!tray[index]) return;
    selectedSlot = index;
    if (!hoverAxial) hoverAxial = centreOfBoard();
    renderTray();
  }

  function cycleSlot(step) {
    const from = selectedSlot < 0 ? -1 : selectedSlot;
    for (let n = 1; n <= TRAY_SIZE; n++) {
      const i = ((from + step * n) % TRAY_SIZE + TRAY_SIZE) % TRAY_SIZE;
      if (tray[i]) { selectSlot(i); return; }
    }
  }

  // Moves in offset (column, row) space so the arrow keys line up with what
  // the player sees, rather than with the skewed axial axes.
  function moveCursor(dCol, dRow) {
    if (selectedSlot < 0) cycleSlot(1);
    if (selectedSlot < 0) return;
    if (!hoverAxial) { hoverAxial = centreOfBoard(); return; }
    const [col, row] = axialToOffset(hoverAxial[0], hoverAxial[1]);
    hoverAxial = offsetToAxial(
      Math.max(0, Math.min(NUM_COLS - 1, col + dCol)),
      Math.max(0, Math.min(NUM_ROWS - 1, row + dRow)));
  }

  function handlePlaceKey(e) {
    if (!running || flashTimer > 0) return;
    switch (e.key) {
      case '1': case '2': case '3': selectSlot(Number(e.key) - 1); break;
      case 'Tab': cycleSlot(e.shiftKey ? -1 : 1); break;
      case 'ArrowLeft': moveCursor(-1, 0); break;
      case 'ArrowRight': moveCursor(1, 0); break;
      case 'ArrowUp': moveCursor(0, -1); break;
      case 'ArrowDown': moveCursor(0, 1); break;
      case 'r': case 'R': rotateSlot(selectedSlot); break;
      case 'Enter': case ' ':
        if (selectedSlot >= 0 && hoverAxial) placeAt(selectedSlot, hoverAxial[0], hoverAxial[1]);
        break;
      case 'Escape': selectedSlot = -1; hoverAxial = null; renderTray(); break;
      default: return;
    }
    e.preventDefault();
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
    placeCells(board, cells, slot.shape, slot.rotationIndex);
    markSeen(slot.shape);
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
      const bonds = kekuleBondsForPiece(slot.shape, slot.rotationIndex);
      pts.forEach(([x, y], i) => {
        drawHex(ui.ctx, x + cx0, y + cy0, size * 0.92, slot.shape.color, '#1d2126', 1.5);
        drawDoubleBonds(ui.ctx, x + cx0, y + cy0, size * 0.92, bonds[i], 'rgba(255,255,255,0.85)');
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
    scoresEl.classList.add('hidden');
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

  // An entry is either [action, inputs] for a two-column row, or a plain
  // string for a full-width note.
  function buildHelpColumn(title, entries) {
    const col = document.createElement('div');
    col.className = 'controls-help-col';
    const heading = document.createElement('h3');
    heading.textContent = title;
    col.appendChild(heading);
    for (const entry of entries) {
      const row = document.createElement('div');
      if (typeof entry === 'string') {
        row.className = 'help-note';
        row.textContent = entry;
      } else {
        row.className = 'help-row';
        const label = document.createElement('span');
        label.className = 'help-label';
        label.textContent = entry[0];
        const keys = document.createElement('span');
        keys.className = 'help-keys';
        keys.textContent = entry[1];
        row.append(label, keys);
      }
      col.appendChild(row);
    }
    return col;
  }

  // Shown on the difficulty screen, the last stop before play starts. The
  // two modes are controlled so differently that one shared list would be
  // mostly irrelevant to whichever mode you picked.
  function renderControlsHelp(forMode) {
    const move = t('controls.left') + ' / ' + t('controls.right');
    const columns = forMode === 'fall'
      ? [
          [t('howto.keyboard'), [
            [move, '←  →'],
            [t('controls.rotate'), '↑  /  R'],
            [t('controls.softDrop'), '↓'],
            [t('controls.hardDrop'), 'Space'],
            [t('game.hold'), 'C  /  Shift'],
            [t('game.pause'), 'P'],
          ]],
          [t('howto.touch'), [
            [move, t('howto.swipe') + ' ←→  ·  ◀ ▶'],
            [t('controls.rotate'), t('howto.swipe') + ' ↑  ·  ↻'],
            [t('controls.softDrop'), '▼'],
            [t('controls.hardDrop'), t('howto.swipe') + ' ↓  ·  ⤓  ·  ' + t('howto.doubleTap') + ' ▼'],
            [t('game.hold'), t('howto.holdTap')],
          ]],
        ]
      : [
          [t('howto.keyboard'), [
            [t('howto.pick'), '1  2  3  ·  Tab'],
            [t('howto.move'), '←  →  ↑  ↓'],
            [t('controls.rotate'), 'R'],
            [t('howto.place'), 'Enter  /  Space'],
          ]],
          [t('howto.mouse'), [t('howto.placeMouse'), t('howto.placeRotate')]],
          [t('howto.touch'), [t('howto.placeTouch'), t('howto.placeRotate')]],
        ];
    helpCols.textContent = '';
    for (const [title, entries] of columns) helpCols.appendChild(buildHelpColumn(title, entries));
  }

  function showDifficultyScreen(desiredMode) {
    pendingMode = desiredMode;
    renderControlsHelp(desiredMode);
    screen = 'difficulty';
    hideAllPreGameScreens();
    difficultyScreen.classList.remove('hidden');
  }

  function enterGame(desiredMode, difficultyFactor, chosenDifficultyKey) {
    setDifficultyFactor(difficultyFactor);
    difficultyKey = chosenDifficultyKey || 'normal';
    screen = 'game';
    hideAllPreGameScreens();
    scoresEl.classList.remove('hidden');
    gameScreen.classList.remove('hidden');
    setMode(desiredMode, true);
  }

  function goHome() {
    screen = 'home';
    pendingMode = null;
    running = false;
    flashRows = [];
    flashTimer = 0;
    pendingClearBoard = null;
    pendingClearCallback = null;
    gameScreen.classList.add('hidden');
    levelBox.classList.add('hidden');
    hideAllPreGameScreens();
    homeScreen.classList.remove('hidden');
    overlay.classList.add('hidden');
    pausedOverlay.classList.add('hidden');
    refreshHomeBests();
    renderCollection();
    window.scrollTo(0, 0);
  }

  function setPaused(value) {
    if (mode !== 'fall' || !running) return;
    paused = value;
    pauseBtn.textContent = t(paused ? 'game.resume' : 'game.pause');
    pausedOverlay.classList.toggle('hidden', !paused);
  }

  function resetGame() {
    bestAtStart = getStoredBest(mode);
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
      lockTimer = null;
      lockResets = 0;
      elapsedMs = 0;
      lastFrameTime = null;
      held = null;
      holdUsed = false;
      nextQueue = [];
      for (let i = 0; i < NEXT_COUNT; i++) nextQueue.push(spawnPiece());
      current = newFallingPiece(takeFromQueue());
    } else {
      tray = [null, null, null];
      refillTrayIfEmpty();
      renderTray();
    }
    updateHud();
  }

  // ---------- rendering ----------

  // Marks the boundary above SPAWN_ROW, which stackAboveDeadline() enforces:
  // a settled cell anywhere past this ends the round. Molecules all *enter*
  // the board inside the band above it and fall out, so the rule is judged
  // only once a piece comes to rest.
  //
  // The threshold is not a straight line. A hex grid staggers the cells of
  // one row by half a cell from column to column, so the height you must not
  // stack past alternates as you go across -- the old straight line took the
  // middle column's height and was wrong for every other column by half a
  // cell. Tracing the upper edges of the row's own cells puts it exactly
  // where it is, and the zigzag reads as a boundary rather than decoration.
  //
  // Which corners are "upper" depends on the orientation: a flat-top cell has
  // a horizontal top edge (corners 4-5), while a pointy-top cell comes to a
  // peak (corners 4-5-0).
  function drawDeadline(ctx) {
    // Wash the cells above the threshold, so the danger zone reads as a band
    // rather than resting on a thin line being noticed. Drawn under the
    // pieces, and faint enough not to fight with them.
    for (let row = 0; row < SPAWN_ROW; row++) {
      for (let col = 0; col < NUM_COLS; col++) {
        const [cx, cy] = cellCenter(col, row);
        drawHex(ctx, cx, cy, hexSize * 0.96, 'rgba(214, 40, 40, 0.08)', null, 0);
      }
    }

    const topCorners = getOrientation() === 'flat' ? [4, 5] : [4, 5, 0];
    const points = [];
    for (let col = 0; col < NUM_COLS; col++) {
      const [cx, cy] = cellCenter(col, SPAWN_ROW);
      for (const i of topCorners) points.push(hexCorner(cx, cy, hexSize, i));
    }
    // Short stubs past the outer cells, so it reads as a line spanning the
    // board rather than stopping short of the walls.
    const stub = hexSize * 0.5;
    const first = points[0], last = points[points.length - 1];

    ctx.save();
    ctx.strokeStyle = 'rgba(214, 40, 40, 0.9)';
    ctx.lineWidth = Math.max(2, hexSize * 0.14);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([hexSize * 0.55, hexSize * 0.36]);
    ctx.beginPath();
    ctx.moveTo(first[0] - stub, first[1]);
    for (const [px, py] of points) ctx.lineTo(px, py);
    ctx.lineTo(last[0] + stub, last[1]);
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
      const currentBonds = kekuleBondsForPiece(current.shape, current.rotationIndex);
      fallCells(current).forEach(([q, r], i) => {
        const [col, row] = axialToOffset(q, r);
        const [cx, cy] = cellCenter(col, row);
        drawHex(boardCtx, cx, cy, hexSize * 0.94, current.shape.color, '#1d2126', 2);
        drawDoubleBonds(boardCtx, cx, cy, hexSize * 0.94, currentBonds[i], 'rgba(255,255,255,0.85)');
      });
      renderNextPreview();
      renderHoldPreview();
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

  function sizeCanvas(canvas, ctx, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
  }

  // Draws a molecule centred inside the box (boxX, boxY, boxW, boxH).
  // fill and outline override the molecule's own colours, and silhouette
  // leaves the double bonds off, for the not-yet-found collection tiles.
  function drawMoleculeIn(ctx, shape, size, boxX, boxY, boxW, boxH, alpha, fill, outline, silhouette) {
    const pts = shape.rotationStates[0].map(([q, r]) => axialToPixel(q, r, size));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x - size); maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size); maxY = Math.max(maxY, y + size);
    }
    const ox = boxX + (boxW - (maxX - minX)) / 2 - minX;
    const oy = boxY + (boxH - (maxY - minY)) / 2 - minY;
    const bonds = kekuleBondsForPiece(shape, 0);
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    pts.forEach(([x, y], i) => {
      drawHex(ctx, x + ox, y + oy, size * 0.92, fill || shape.color, outline || '#1d2126', 1.5);
      if (!silhouette) {
        drawDoubleBonds(ctx, x + ox, y + oy, size * 0.92, bonds[i], 'rgba(255,255,255,0.85)');
      }
    });
    ctx.restore();
  }

  // Narrow screens put the panel between the board and the touch controls,
  // so the previews lay out in a wide strip there instead of a tall stack --
  // a tall one pushes the controls well below the fold.
  function isNarrow() {
    return window.innerWidth <= 480;
  }

  // The whole queue, with the piece you get next drawn largest.
  function renderNextPreview() {
    const narrow = isNarrow();
    const cssW = narrow ? 168 : 110;
    const cssH = narrow ? 54 : 150;
    sizeCanvas(nextCanvas, nextCtx, cssW, cssH);
    const boxes = narrow
      ? [[0, 0, 72, cssH, 11], [72, 0, 48, cssH, 8], [120, 0, 48, cssH, 8]]
      : [[0, 0, cssW, 74, 15], [0, 74, cssW / 2, 38, 9], [cssW / 2, 74, cssW / 2, 38, 9]];
    nextQueue.slice(0, NEXT_COUNT).forEach((piece, i) => {
      if (!piece || !boxes[i]) return;
      const [bx, by, bw, bh, size] = boxes[i];
      drawMoleculeIn(nextCtx, piece.shape, size, bx, by, bw, bh, i === 0 ? 1 : 0.65);
    });
  }

  function renderHoldPreview() {
    const narrow = isNarrow();
    const cssW = narrow ? 76 : 110;
    const cssH = narrow ? 54 : 62;
    sizeCanvas(holdCanvas, holdCtx, cssW, cssH);
    if (!held) return;
    // Dimmed once Hold is spent, so it's clear it can't be used again until
    // the current piece lands.
    drawMoleculeIn(holdCtx, held.shape, narrow ? 10 : 13, 0, 0, cssW, cssH, holdUsed ? 0.35 : 1);
  }

  function tick(timestamp) {
    if (lastFrameTime === null) lastFrameTime = timestamp;
    // Cap dt to prevent massive spikes when switching back from a background
    // tab -- without this, elapsedMs instantly skips levels and lockTimer
    // expires on the first visible frame.
    const dt = Math.min(timestamp - lastFrameTime, 100);
    lastFrameTime = timestamp;

    if (flashTimer > 0 && !paused) {
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
      if (current) {
        if (tryFall(current)) {
          // Airborne: normal gravity, and any lock countdown is abandoned --
          // a piece slid off its ledge should fall rather than freeze.
          lockTimer = null;
          dropAccumulator += dt;
          if (dropAccumulator >= dropIntervalMs) {
            dropAccumulator = 0;
            tryMoveDown();
          }
        } else {
          if (lockTimer === null) lockTimer = LOCK_DELAY_MS;
          lockTimer -= dt;
          if (lockTimer <= 0) fallLockPiece();
        }
      }
    }

    render();
    requestAnimationFrame(tick);
  }

  function softDrop() {
    if (!tryMoveDown()) fallLockPiece();
    else dropAccumulator = 0;
  }

  // Tapping the on-screen down button twice quickly drops the piece the rest
  // of the way. Touch only: the keyboard has Space for that, and leaving the
  // arrow key out of it also means a held key can just glide the piece down
  // without its auto-repeat looking like a double press.
  //
  // The first tap still soft-drops right away instead of waiting to see
  // whether a second one follows, so the button never feels laggy -- a hard
  // drop that starts one row lower lands in exactly the same place. The
  // timer resets afterwards so a third tap doesn't immediately slam the
  // piece that just spawned.
  const DOUBLE_TAP_MS = 300;
  let lastDownTap = 0;

  function tapDown() {
    const now = performance.now();
    if (now - lastDownTap < DOUBLE_TAP_MS) {
      lastDownTap = 0;
      hardDrop();
      return;
    }
    lastDownTap = now;
    softDrop();
  }

  function bindControls() {
    window.addEventListener('keydown', (e) => {
      if (screen !== 'game') return;
      if (mode === 'place') { handlePlaceKey(e); return; }
      if (!running) return;
      if (e.key === 'p' || e.key === 'P') { setPaused(!paused); e.preventDefault(); return; }
      if (paused || !current) return;
      switch (e.key) {
        case 'ArrowLeft': tryMoveHorizontal(-1); e.preventDefault(); break;
        case 'ArrowRight': tryMoveHorizontal(1); e.preventDefault(); break;
        case 'ArrowDown': softDrop(); e.preventDefault(); break;
        case 'ArrowUp': case 'r': case 'R': tryRotate(); e.preventDefault(); break;
        case ' ': hardDrop(); e.preventDefault(); break;
        case 'c': case 'C': case 'Shift': holdPiece(); e.preventDefault(); break;
      }
    });

    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => { if (screen === 'game' && mode === 'fall' && running && !paused && current) fn(); }); };
    bind('btn-left', () => tryMoveHorizontal(-1));
    bind('btn-right', () => tryMoveHorizontal(1));
    bind('btn-down', tapDown);
    bind('btn-rotate', tryRotate);
    bind('btn-drop', hardDrop);

    // Null-tolerant: a missing element (e.g. a browser holding a stale
    // cached copy of one file but not the other) should cost that one
    // button, not throw and leave every later binding unattached.
    const onClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    holdBlock.addEventListener('click', holdPiece);
    onClick('new-game-btn', resetGame);
    onClick('restart-btn', resetGame);
    onClick('game-over-home-btn', goHome);
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
      card.addEventListener('click', () => enterGame(pendingMode, Number(card.dataset.factor), card.dataset.difficulty));
    });

    window.addEventListener('resize', () => computeBoardLayout(boardCanvas));
    bindTrayDragControls();
    bindSwipeControls();
  }

  // One-time migration: seed both per-mode bests from the old shared one so
  // nobody's existing high score just disappears.
  (function migrateLegacyHighScore() {
    try {
      const legacy = localStorage.getItem(LEGACY_HIGH_SCORE_KEY);
      if (legacy === null) return;
      for (const key of Object.values(HIGH_SCORE_KEYS)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, legacy);
      }
      localStorage.removeItem(LEGACY_HIGH_SCORE_KEY);
    } catch (e) { /* storage disabled */ }
  })();

  buildPlacePanel();
  setOrientation(fallOrientation);
  setBoardSize(FALL_COLS, FALL_ROWS);
  computeBoardLayout(boardCanvas);
  bindControls();
  refreshHomeBests();
  renderCollection();
  requestAnimationFrame(tick);
})();
