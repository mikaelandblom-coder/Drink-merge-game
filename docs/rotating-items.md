# Rotating items (`spin:`) — opt-in per map, on for Napoli only

> Moved out of CLAUDE.md on 2026-09-23 to keep that file small. CLAUDE.md
> keeps a summary of the rules; this is the full record — the measurements,
> the history and the reasoning. Keep them in step: a new rule goes in the
> CLAUDE.md summary too.


A map can set `spin: true` in config/maps.js to have its items drawn at their
real physics angle instead of the tiny idle wobble. **Only Napoli (the pizzeria
map) sets it**, which is the map it was built for on 2026-08-16 — every subject
in `PIZZA_ITEMS` is a disc, ring or ball, so rotation reads as items being
shoved around a table rather than as art falling over. Turning it on for a map
whose art has a "this way up" is the failure mode, not a tuning question.

**It is purely cosmetic and cannot change gameplay.** The circle bodies have
always rotated — Matter gives them default inertia and collisions impart angular
velocity. All this does is decide whether `drawDrink` reads `body.angle` or
throws it away. Physics, scores and seeded runs are untouched by the flag.
Verified by pixel-diffing a rendered board against a reimplementation of the old
`drawDrink`: **0 differing subpixels** across kyoto/melody/hawaii/teddy/cantho.

- **Rotation comes from the accumulated ANGLE, not from spin speed.** Measured on
  a 14-shot board: instantaneous `angularVelocity` peaks around 0.008 rad/step
  (~0.07 turns/sec — nothing visibly spins like a top), but the *accumulated*
  angle reaches 276° with a mean of ~48°. So items gradually turn as they get
  shoved around, which is what a top-down table should look like. No gain or
  fudge factor is applied, and none is needed — don't add one.
- **Circle items ONLY.** `makeDrink` locks capsule inertia (`Body.setInertia`
  `Infinity`) so a horizontal sprite can never drift off its stadium hitbox, and
  the capsule shadow is baked at the authored `cap.rot`. `drawnSpin` (game.js)
  returns `undefined` for any item with `.cap`, so a spin map may mix shapes
  safely — the capsules just won't turn. Don't "fix" this by unlocking them.
- **`spin: true` covers the MAP'S OWN CHAIN — never shared art.** Happy Hour
  injects `RECEIPT_ITEMS` into every map, and those four sprites are a printed
  slip, a roll, a stack and a clipboard with a clip at the top: unmistakable
  "this way up" art. They are circles with no `.cap`, so the capsule exclusion
  above did not catch them and Napoli spun them (reported 2026-08-19). The flag
  is a claim a map author made about art in THEIR items list; it cannot speak
  for art a mode adds to every map alike. `drawnSpin` therefore tests
  `plugin.kind === 'drink'` — the KIND, not the receipt chain by name, so any
  future shared chain is right by default. Verified by pixel-diff: all five
  receipt tiers render **0 differing subpixels** between body angle 0, +120° and
  −80°, against a control pizza item that moves 10,578.
- **`drawnSpin(d)` is the single source of truth for "is this rotation drawn?"**
  Both the render loop and `sceneBusy()` go through it. They must agree: if the
  loop drew a rotation `sceneBusy` ignored, an item would freeze mid-turn and
  jump on the next wake; if `sceneBusy` held the loop awake for a rotation the
  loop discards, a settled receipt would pin the game at 60fps for a turn nobody
  can see. Both were real — the second one shipped, and this is what fixed it.
- **The shadow never spins.** It keeps the idle wobble it always had but sits in
  its own `save`/`restore` outside the rotation: the light is overhead, so a
  squashed shadow ellipse turning with the item reads as the lamp orbiting the
  table. This restructuring is what the pixel-diff above was verifying.
- **`sceneBusy()` gained an `angularVelocity` test, gated through `drawnSpin`.**
  A body can be linearly still while still turning; without this it would freeze
  mid-turn when the board settles and jump on the next wake. The threshold
  (0.0015 rad/step) leaves under 3° of un-drawn rotation at the measured
  ~0.97/step decay. Gated so every other map's idle behaviour is unchanged —
  and, since 2026-08-19, so that a body whose rotation is NOT drawn (a receipt,
  a capsule) can no longer hold the loop awake.
- **`?spin=1` forces it on for any map, `?spin=0` off** — for judging a
  candidate map's art before committing `spin:` to config. Worth doing: tried on
  Cần Thơ, the upright rice-paper rolls tilt like they're falling over. Rotation
  needs radially symmetric subjects (pizzas, plates, wheels, records), which is
  exactly why this is a per-MAP art property and not a menu option.
