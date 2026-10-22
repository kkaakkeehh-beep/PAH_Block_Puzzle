# Promo clip recorder

Records the promo videos: the game playing itself, composed into a frame with
the score, the molecule names and a closing card.

```bash
powershell -File tools/promo/stage.ps1
powershell -File tools/promo/serve.ps1 -Root "$env:TEMP\pah-promo-build" -OutDir C:\claude\PAH_promo\takes
powershell -File tools/promo/record.ps1 -Lang ja -EndCard search -First 1 -Last 2
```

Output lands in `-OutDir`: an `.mp4` and a `.webm` per take, a summary line,
and JPEG stills pulled from the recorded canvas at fixed times.

## Options

| Flag | Values | Notes |
|---|---|---|
| `-Lang` | `ja`, `en` | Also sets the language the game itself runs in |
| `-Mode` | `fall`, `place` | Placing has its own board shape and its own bot |
| `-Format` | `vertical`, `wide` | 1080×1920 for Reels/Shorts/TikTok, 1280×720 otherwise |
| `-EndCard` | `card`, `search` | `search` is the "look it up" ending; vertical only |
| `-Dpr` | `1`, `2` | 2 renders the board at twice the size, which it needs when scaled up |

## Why it is built this way

**A staged copy, not the repo.** `stage.ps1` patches a read-only `window.__promo`
hook into `game.js`. The shipped game has no reason to expose its internals,
and `game.js` is wrapped in an IIFE, so `board`, `current` and `tray` are
otherwise unreachable — and the bot has to see the board to play.

**A server, not `file://`.** The recorder drives the game in an iframe and has
no other way to get a finished recording out of the browser.

**Headless Chrome, not the browser pane.** The pane throttles
`requestAnimationFrame` when it is not the focused thing on screen, which
dropped a 26-second recording to a handful of frames. Headless at real time
holds ~30fps (vertical, every other frame) or ~58fps (wide).

**`captureStream(0)` plus `requestFrame()`.** One composed frame becomes
exactly one video frame, whatever the rAF clock does.

**Uploads go up a megabyte at a time, one file after another.** A single
multi-megabyte POST is aborted partway through by `HttpListener`, and two
large uploads running side by side wedge after their first part.

## Things that were got wrong before, and should not be again

- **The bot used to slam blocked pieces down wherever they were.** When a
  rotation or a sideways move is refused it now re-plans among the columns it
  can still reach. Before that fix a quarter of all pieces landed somewhere
  unintended and the round often ended mid-clip, which on screen means the
  score resetting to zero. Watch `hardDrops` against `pieces` in the summary:
  they should be equal, and `stuckDrops` should be zero.
- **The stack has to be kept well clear of the deadline, not merely below it.**
  Twelve usable rows and a seven-ring coronene arriving at any moment.
- **The background lattice is rendered once and blitted.** Restroking a
  thousand hexagons per frame on a 1080×1920 canvas starved the bot's input
  timer and dropped the frame rate by half.
- **The snapshot times must stay sorted.** The loop only looks at
  `snapshots[0]`, so one out-of-order entry hides every later one.
- **Takes are not deterministic.** Record two or three and read the summary:
  `gameOvers=0` is the one to keep.

## The search end card

Deliberately *not* Google's interface: no wordmark, no four-colour glyph, no
imitation of their results page. Using a real company's interface to advertise
something is their trademark to license, and a plain search box makes the same
point. What it shows as the result is the page's own real title and
description, read from the same text that is in `index.html`.

If those change, update `resultTitle` and `resultSnippet` in `recorder.html`
so the card keeps matching what a search would actually show.
