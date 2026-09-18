# PAH Block Puzzle

A block puzzle built from real polycyclic aromatic hydrocarbons. Benzene to
coronene, on a hex grid, drawn as proper Kekulé structures.

**[▶ Play in your browser](https://kkaakkeehh-beep.github.io/PAH_Block_Puzzle/)** ·
[日本語 README](README.ja.md)

<p align="center">
  <img src="screenshot-fall.png" alt="Falling mode: molecules stacked on a hex board" width="330">
  <img src="screenshot-home.png" alt="Home screen with the molecule collection" width="330">
</p>

No install, no build step, no account, no tracking. It is a handful of static
files served straight from GitHub Pages.

## Two ways to play

**Falling** — molecules drop like Tetris. Steer, rotate and clear full rows
before they stack past the red line. Speed climbs with the level, which rises
from both lines cleared and time played, so a round that never completes a
line still ramps up.

**Placing** — no clock. Take a molecule from the tray and fit it anywhere it
goes. Cleared rows vanish without the rest collapsing, so the board is a
packing problem rather than a reaction test.

Each mode keeps its own best score.

## The chemistry

Every piece is a real molecule, and the code treats that as something to get
right rather than as set dressing.

**The ring layouts are checked against the formulas.** Two hexagons one axial
step apart are ortho-fused; three mutually adjacent ones meet at a shared
carbon, which is peri-fusion. Counting vertices of the hexagon union gives the
carbon and hydrogen count directly, and all eleven molecules derive exactly
the formula shown in-game.

**Double bonds are derived, not stored.** A circle inside a ring means six
delocalised π electrons, so drawing one in every ring of a fused system counts
them twice over — naphthalene would read as twelve π electrons when it has
ten. Instead `kekuleBondsFromCorners` builds the carbon skeleton from the
hexagon corners and finds a perfect matching, so every carbon carries exactly
one double bond.

A molecule usually has several valid Kekulé structures, so all of them are
enumerated and the one with the most carbon-disjoint aromatic sextets is kept
— Clar's rule, which picks the dominant resonance contributor. Ties are broken
by putting as few double bonds as possible on ring-fusion bonds. That yields
the structures chemists actually draw:

| Molecule | Formula | Rings | Clar sextets |
|---|---|---|---|
| Benzene | C₆H₆ | 1 | 1 |
| Naphthalene | C₁₀H₈ | 2 | 1 |
| Phenanthrene | C₁₄H₁₀ | 3 (angular) | 2 |
| Anthracene | C₁₄H₁₀ | 3 (linear) | 1 |
| Pyrene | C₁₆H₁₀ | 4 (peri-fused) | 2 |
| Chrysene | C₁₈H₁₂ | 4 (zigzag) | 2 |
| Tetracene | C₁₈H₁₂ | 4 (linear) | 1 |
| Triphenylene | C₁₈H₁₂ | 4 (branched) | 3 |
| Picene | C₂₂H₁₄ | 5 (zigzag) | 3 |
| Pentacene | C₂₂H₁₄ | 5 (linear) | 1 |
| Coronene | C₂₄H₁₂ | 7 (peri-fused) | 3 |

Phenanthrene ends up with three bonds inside each end ring and a lone C9=C10
across the middle; triphenylene with three outer rings around an empty centre;
anthracene with only one such ring, which is why it is the less stable of the
two C₁₄H₁₀ isomers.

The home screen keeps a collection of the eleven, greyed to a silhouette until
you have actually landed one.

## Controls

The game shows these before each round, for whichever mode you picked.

**Falling**

| | Keyboard | Touch |
|---|---|---|
| Move | ← → | swipe ←→, or ◀ ▶ |
| Rotate | ↑ or R | swipe ↑, or ↻ |
| Soft drop | ↓ | ▼ |
| Hard drop | Space | swipe ↓, ⤓, or double-tap ▼ |
| Hold | C or Shift | tap the Hold panel |
| Pause | P | — |

**Placing** — 1/2/3 or Tab picks a molecule, arrow keys move the target, R
rotates, Enter or Space places, Escape cancels. With a pointer: click a
molecule then click the board. On touch: drag from the tray to aim, then tap
to place it where you aimed.

## Hexagon orientation

Falling mode lets you choose. Neither orientation gives a hex grid a clean
straight line in both directions at once:

- **Flat-top** falls in a perfectly straight column; sideways moves drift.
- **Pointy-top** moves sideways perfectly straight; the fall drifts, alternating
  by row parity to stay net-vertical.

## Languages

English, 日本語, 简体中文, 繁體中文, 한국어, Български, Deutsch, Eesti,
Ελληνικά, Español, Français, Italiano, Polski, Русский, Українська, Suomi.

Picked from your browser automatically, changeable on the home screen.

## Running it locally

There is no build step and no dependency. Open `index.html`, or serve the
folder over HTTP if you want the language picker to persist:

```bash
python3 -m http.server 8000
```

Scores, language and the collection live in `localStorage`, never on a server
and never in cookies, so nothing leaves your device and nothing is shared
between devices.

## Layout

| File | |
|---|---|
| `index.html` | markup, metadata, the home-screen illustration |
| `hexmath.js` | axial ↔ offset coordinates, rotation, both orientations |
| `pieces.js` | the eleven molecules and weighted random selection |
| `board.js` | board state, line clears, drawing, Kekulé structures |
| `game.js` | modes, input, scoring, screens |
| `i18n.js` | the sixteen translations |
| `og-source.html` | source for `og.png`, rasterised with headless Chrome |

`index.html` loads the scripts with a `?v=` query. GitHub Pages serves them
with a ten-minute max-age, so without it a fresh `index.html` can load against
a cached `game.js` — new markup with no handlers bound to it. Bump it on any
deploy that touches a script or the stylesheet.

## License

MIT — see [LICENSE](LICENSE).
