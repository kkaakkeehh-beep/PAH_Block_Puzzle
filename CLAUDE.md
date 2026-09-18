# CLAUDE.md

Notes for working in this repo. See [README.md](README.md) for what the game
is and how it plays.

## Shape of the project

Plain HTML, CSS and JavaScript, served straight from GitHub Pages at
`https://kkaakkeehh-beep.github.io/PAH_Block_Puzzle/`. There is no build step,
no bundler and no dependency, and it should stay that way.

Scripts are plain `<script>` tags, not ES modules, so everything is a global
and load order in `index.html` matters: `i18n` → `hexmath` → `pieces` →
`board` → `game`. Modules would also break opening `index.html` over
`file://`, which is worth keeping working.

## Deploying

Pushing to `main` deploys. Two things go wrong if they are skipped:

**Bump `?v=` in `index.html` on any deploy that touches a script or the
stylesheet.** All six references share one date-plus-letter string
(`v=20260918a`), so `sed -i 's/v=OLD/v=NEW/g' index.html` does it. GitHub
Pages serves these files with a ten-minute max-age. Without a bump, a browser
can pair a fresh `index.html` with a cached `game.js` and render new markup
that has no event handlers bound to it — that is exactly how the Game Over
Home button once shipped broken on desktop Chrome while phones were fine.

**Confirm the new content is actually live before reporting success.** Pages
takes a minute or two, and saying "fixed" against a stale deploy has burned
real time here:

```bash
until curl -s "https://kkaakkeehh-beep.github.io/PAH_Block_Puzzle/index.html" \
  | grep -q "v=20260918a"; do sleep 5; done; echo deployed
```

The browser will still hand you a cached copy afterwards, so verify with a
cache-busting query (`?cb=1`) rather than a plain reload.

## Chemistry invariants

The user is a chemist. Rendering that is merely decorative is a bug here.

- **Never draw a circle inside a ring to mean aromaticity.** One circle is six
  delocalised π electrons, so one per ring over-counts any fused system.
  Molecules are drawn as explicit Kekulé structures.
- **Double bonds are derived, never stored per molecule.**
  `kekuleBondsFromCorners` in `board.js` builds the carbon skeleton from the
  hexagon corners and finds a perfect matching, enumerating all of them and
  keeping the one with the most carbon-disjoint Clar sextets, ties broken by
  fewest double bonds on ring-fusion bonds. Change the shapes and the bonds
  follow automatically.
- **Ring layouts must match their formulas.** Hexagons one axial step apart
  are ortho-fused; three mutually adjacent ones share a carbon (peri-fusion),
  which changes the formula. Three shapes were once wrong this way —
  phenanthrene was really the phenalenyl skeleton, picene was not a
  closed-shell PAH at all. Counting vertices of the hexagon union gives C and
  H directly; check against `formula` after touching `PAH_SHAPES`.

## Piece frequency

`pickRandomShape` weights each molecule by `weight * factor^(rings - 1)`, so
ring count dominates at higher difficulties — seven rings against Expert's
factor of 2.3 is a 148× multiplier, which swamps the weight entirely. Two
weights are therefore set below what ring count alone would give, and should
not be "corrected" on sight:

- **Picene, 1** (same as pentacene). Five rings spanning five columns in a
  zigzag leaves notches wherever it lands, which is what actually makes a
  board unwinnable.
- **Coronene, 0.6** — fractional because 1 is as low as an integer goes and
  it still came out at about a third of all Expert pieces. Note it is not
  punishing in the way picene is: a compact 3×3 blob packs densely and helps
  complete rows. It was lowered because that share was simply too high, not
  because the piece is hard.

Ring count is a poor proxy for how hard a piece is to place. Compare the
tightest offset-space footprint across a shape's rotations before changing a
weight, and check the resulting shares at all four difficulty factors rather
than reasoning from the weight alone.

## Testing

Verify in the browser rather than by reasoning about the code. Drive the game
through `javascript_tool` against the dev server, and assert on observable
state — the molecule labels, tray contents, `localStorage` — not on
screenshots alone.

Two traps that have produced false results here:

- Comparing the current molecule against the next one is ambiguous when the
  randomiser hands out the same shape twice. Loop `new-game-btn` until they
  differ before testing a swap or a lock.
- A soft drop that reaches the bottom locks the piece too. Test glide-versus-
  hard-drop on a freshly reset board, with few enough steps that the piece
  cannot reach the stack.

Touch behaviour cannot be trusted from the desktop pane: `computer` synthesises
mouse events even under mobile emulation. Dispatch real `PointerEvent`s, and
expect the user to be the final word on how it feels on their phone.

## Adding UI text

Every string goes in `i18n.js`, in all sixteen languages — a missing key
silently falls back to English. Mark up static text with `data-i18n` (or
`data-i18n-aria`); JS-generated text calls `t(key)`.

Prefer arrows and symbols for key bindings in the controls panel so they need
no translation, and reuse existing action names (`controls.rotate`,
`game.pause`) as row labels rather than adding near-duplicates.

Watch out for grammar: substituting a mode name into "Best in {mode}" breaks
case agreement in Greek, Finnish, Estonian, Polish and the Slavic languages,
which is why those use a dash or quote the name instead.

## Layout constraints

Phones are the main way this gets played. The falling board is tall, so
anything added to the side panel pushes the touch controls down; on narrow
screens the controls are ordered directly under the board with CSS `order`,
and the Hold and Next previews lay out as a wide strip rather than a tall
stack. Check `375×812` after any panel change, and confirm the control row is
still above the fold.

## Images

`og.png` and the README screenshots are rasterised with headless Chrome rather
than hand-drawn or passed through the conversation as base64:

```bash
chrome --headless=new --disable-gpu --hide-scrollbars \
  --screenshot=og.png --window-size=1200,630 og-source.html
```

`og-source.html` draws with the game's own Kekulé code, so the share image
cannot drift from how the game actually renders molecules. Screenshots of
gameplay were taken with a temporary same-origin iframe harness that seeds
`localStorage` and clicks through to a position; `--virtual-time-budget` has
to stay small, because the game's `requestAnimationFrame` loop otherwise keeps
virtual time advancing for a long wall-clock time.

## Storage

`localStorage` only, never cookies, and nothing is sent anywhere. Keys:
`pahBlockPuzzleHighScore_fall`, `pahBlockPuzzleHighScore_place`,
`pahBlockPuzzleSeen`, `pahBlockPuzzleLang`. Wrap reads that parse JSON in
`try`/`catch` — a corrupt entry should cost the collection, not the game.
