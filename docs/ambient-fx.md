# Ambient background motion (fx.js)

> Moved out of CLAUDE.md on 2026-09-23 to keep that file small. CLAUDE.md
> keeps a summary of the rules; this is the full record — the measurements,
> the history and the reasoning. Keep them in step: a new rule goes in the
> CLAUDE.md summary too.


A map can declare `fx:` in config/maps.js to get a few drifting details over its
art — the plumbing for "leaves blowing in the wind" on a future map.

**Built and working, but NO map currently uses it.** Two presets ship:

| preset | axis | what it is |
|--------|------|------------|
| `sakura` | `y` | falling cherry blossom (22 petals) |
| `money`  | `x` | banknotes blowing across on the wind (14) — for the planned LUXURY map; **untuned**, since there's no map to judge it against yet, and its bill art is a placeholder |

**The layer is clipped to the HORIZON by default, and that is the central
lesson.** `sakura` was first built covering the whole stage and tried on Kyoto
on 2026-08-08; Mikael's verdict was that it "feels mostly distracting". Kyoto is
the worst case for a full-stage effect: pale petals crossing a big, dark,
near-empty lacquer tray are the highest-contrast moving thing on screen, sitting
exactly where the player is aiming — and this is a precision aiming game. The
lesson is NOT "ambient motion is bad", it's that **ambient motion belongs in the
backdrop, never on the play surface**. `band` now enforces that: `'horizon'`
(default) clips to the map's horizon, or pass a 0..1 fraction of stage height.

Kyoto's `fx:` is still commented out even though the band removes that specific
objection — turning it back on is Mikael's call, not a cleanup. Ask first.

A map whose play surface is busy or light-coloured is a friendlier host than
Kyoto's empty dark tray either way.

**It is a CSS-animated DOM layer (`#stage-fx`), not canvas particles, and that
is the whole design.** The render loop parks itself after 20 idle frames
(`idleFrames` in game.js) — the single biggest heat saving in the game. A canvas
particle would have to force `sceneBusy()` true forever to keep moving, putting
the game back at a constant 60fps draw for the sake of background garnish. CSS
keyframes drift on the compositor while the JS loop is fully parked, so the
effect costs the loop *nothing*. Don't "unify" this into `drawParticles`.

- **Stacking is load-bearing**: `#stage-fx` sits AFTER `#stage-bg` (same
  z-index, later in the DOM, so petals cross the table art) and BEFORE the
  canvas (z1, so drinks are always in front). `pointer-events:none` — the
  canvas above owns every tap.
- **Animate transform/opacity ONLY.** Anything else (width, `left`,
  `background-position`) repaints on the main thread and gives back the saving.
- **The art is an inline SVG data URI**, not a PNG: no `process_assets.py`
  entry, no AI generation spent, nothing added to the per-map download.
- **fx.js has its OWN PRNG and must keep it.** `setMapFx` runs from
  `loadMapAssets`, i.e. inside `startGame` and BEFORE `rollFreshTiers()` draws
  the opening tiers. Test mode replaces `Math.random` with a seeded generator,
  so calling it here would silently change every seeded run (`TT.start(map,
  {seed})`) on any map with an `fx`. Verified: seeded tiers are stable.
- **Sizes are px against the 420×620 world**, scaled by `--fx-k`, which
  `fitCanvas()` feeds the same display scale it gives the canvas — otherwise
  particles would be ~2× larger, relatively, on a phone than on a desktop.
- **`band` reads the LIVE `HORIZON` global, not `map.horizon`.** startGame
  resolves the horizon for the active size variant at game.js:720, ten lines
  before it calls `loadMapAssets` — reading the map field instead would ignore a
  size variant's own horizon.
- **Wind is authored as cross-axis TRAVEL (% of the band), not an angle.** The
  pass is a plain `translate` along one axis, tilted by a static `rotate` on a
  wrapper whose `transform-origin` is the START of the path (so entry = start
  and exit = start + travel, exactly). Travel, not degrees, because the angle
  that produces a given drift depends on the band's aspect — and drift is what
  decides whether a particle is on screen at all. Picking entry and wind
  independently left only 7 of 18 petals visible at the sparsest moment
  (measured); now each picks its entry, then a wind that keeps it in frame.
- **The two axes need DIFFERENT cross-axis allowances** (`FX_CROSS_INSET`). For
  a fall the cross axis is the full stage width, so overshooting the sides is
  free — that's how a petal blows in from off-screen. For a crosswind it's the
  band's *height*, which is short: a particle at its edge is either wasted
  outside the band or sliced by the hard clip at the horizon mid-flight.
- **`fx-fall`'s fade is deliberately ASYMMETRIC, `fx-fly`'s is not.** A fall's
  two ends aren't alike: the top of the band is the top of the stage, a real
  frame edge where fading over a clip is invisible, while the bottom is the
  horizon — an invisible line in open art where a half-faded sprite is visibly
  sliced. With a symmetric fade, petals were still ~25% opaque as they crossed
  it (measured). `fx-fly` exits at the real left/right frame edges, so it stays
  symmetric, which also makes `dir:-1` look identical to `dir:1`.
  Fading in the keyframes rather than masking `#stage-fx` keeps every particle
  independently composited.
- **Petal proportions**: taller than wide, with the notch only slightly below
  the lobes. A wide petal with a deep notch reads as a HEART at the 7–16px
  these draw at (the first pass did).
- **Preset numbers are band-relative**, so retuning `band` means retuning `dur`,
  `size` and `travel` with it — `sakura`'s originals were authored against the
  full 620px stage and, confined to ~24% of it, crawled at a ~50° near-diagonal.
- Cleared and rebuilt per map load, so a map without `fx:` can't inherit the
  previous map's particles. Framing-agnostic: Kyoto's two size variants share it
  with no per-size tuning, since particles cross the whole band rather than
  anchoring to a painted feature.
- `prefers-reduced-motion: reduce` hides the layer.
