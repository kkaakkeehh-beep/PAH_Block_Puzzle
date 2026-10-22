param(
  [string]$Stage = "$env:TEMP\pah-promo-build"
)

# Builds the recording staging area: a copy of the game with a small read-only
# hook added, plus the recorder page.
#
# The hook is patched in here rather than committed into game.js because the
# shipped game has no reason to expose its internals. game.js is wrapped in an
# IIFE, so board, current and tray are unreachable from the recorder's bot
# without it -- and the bot has to see the board to place a molecule sensibly.
#
#     powershell -File tools/promo/stage.ps1

$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

New-Item -ItemType Directory -Force $Stage | Out-Null
foreach ($f in @('index.html', 'style.css', 'i18n.js', 'hexmath.js', 'pieces.js',
                 'board.js', 'favicon.svg')) {
  Copy-Item (Join-Path $repo $f) (Join-Path $Stage $f) -Force
}
Copy-Item (Join-Path $PSScriptRoot 'recorder.html') (Join-Path $Stage 'recorder.html') -Force

# Read and write as UTF-8 explicitly: Get-Content/Set-Content would mangle the
# non-ASCII in the comments and break the file.
$enc = New-Object System.Text.UTF8Encoding($false)
$js = [IO.File]::ReadAllText((Join-Path $repo 'game.js'), $enc)

$anchor1 = "  function newFallingPiece(shapeSlot) {"
if (-not $js.Contains($anchor1)) { throw "stale patch: $anchor1 not found in game.js" }
$js = $js.Replace($anchor1, $anchor1 + "`r`n    window.__promoPieceId = (window.__promoPieceId || 0) + 1;")

$anchor2 = "  renderCollection();`r`n  requestAnimationFrame(tick);`r`n})();"
if (-not $js.Contains($anchor2)) {
  $anchor2 = "  renderCollection();`n  requestAnimationFrame(tick);`n})();"
}
if (-not $js.Contains($anchor2)) { throw "stale patch: could not find the tail of game.js" }

$expose = @"
  renderCollection();
  window.__promo = {
    state: function () {
      return { screen: screen, mode: mode, running: running, paused: paused,
               gameOver: gameOver, score: score, level: level,
               lines: linesCleared, flashTimer: flashTimer, elapsedMs: elapsedMs };
    },
    get current() { return current; },
    get board() { return board; },
    get nextQueue() { return nextQueue; },
    get held() { return held; },
    get tray() { return tray; },
    get selectedSlot() { return selectedSlot; },
    get hoverAxial() { return hoverAxial; }
  };
  requestAnimationFrame(tick);
})();
"@
$js = $js.Replace($anchor2, $expose)
[IO.File]::WriteAllText((Join-Path $Stage 'game.js'), $js, $enc)

Write-Output "staged to $Stage"
