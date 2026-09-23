# Rapid fire (quick mode)

> Moved out of CLAUDE.md on 2026-09-23 to keep that file small. CLAUDE.md
> keeps a summary of the rules; this is the full record — the measurements,
> the history and the reasoning. Keep them in step: a new rule goes in the
> CLAUDE.md summary too.

> **Status:** it began as a playtest build ("not deployed"), but it is on
> `main` since the 2026-09-22 merge and every map card offers it. The tuning
> notes below are still the open questions.


A per-map checkbox that answers "rounds take too long" (raised 2026-08-23: Mai
happily plays a map for 30 minutes, other people want something much shorter).
**The launcher fires itself** on a cadence that accelerates with the shot count,
so a run ends on its own instead of lasting as long as the player's skill does.
A random-steering bot dies in **~6 minutes** — against the 30 a map can absorb
in classic.

It is a change to WHEN a shot happens, not to what a shot is — `fireShot` in
ui.js is shared with the classic release-to-shoot gesture, so the two can never
disagree. **Verified: classic play is bit-for-bit unchanged** (seeded 8-shot runs
on hawaii/kyoto/melody, identical board digests before and after).

## The player still aims — the cannon chases the finger

`CANNON` (ui.js) is a carriage that springs toward the finger with momentum, and
**the residual offset between the two IS the shot angle**. That is not a new
mechanic: `updateAim` has always lerped `LAUNCH` toward the finger at 0.35/frame
and fired along `finger − LAUNCH`, so classic play already aims by releasing
during the catch-up transient. Rapid just never stops. One rule gives all three
behaviours:

| input | result |
|-------|--------|
| moving fast | the carriage lags → a tilted shot |
| held still | it catches up, offset decays → straight up |
| finger past the table edge | the carriage clamps, the finger doesn't → a **held** angle |

That third row is the one worth protecting. Pure velocity-derived tilt cannot
hold an angle at all (you would have to keep moving), and the edge is exactly
where a sustained angle is wanted — firing into the far corner. It needs
`setPointerCapture` so the finger can track outside the canvas; without that,
edge tilt caps at the launcher's own margin.

- **`RF_TILT_MAX` (0.70 rad ≈ 40°) is a hard bound**: at full tilt the vertical
  component is still `cos(0.70) = 0.76` of the speed, so a rapid shot can never
  be horizontal or backwards however hard the player swipes.
- **`cannonMargin()` is pinned to the widest tier the mode can deal**, not the
  tier currently loaded. Classic's per-tier margin only matters while a finger
  is down; in rapid the carriage sits parked against an edge and would twitch
  sideways on every shot as the queue dealt a different-sized item.

## Two things measured, both of which caught the first build out

**`RF_DROP_MAX` is the strongest lever on run length — much stronger than the
cadence.** A wider spread makes two neighbouring drinks less likely to match, so
the board stops clearing itself. Against a random-steering bot: 3 tiers → the run
*never ended* (9 min, 134 drinks still on the field); 4 → ~4.4 min; 5 → ~3 min;
6 → ~2.2 min. The first build set it to 3 on the assumption that narrowing the
deal would stop the board filling with big items — it made merges so easy that
nothing ever accumulated.

Shipped at **4**, the same deal classic uses — see the bot-proxy warning below
for why the measured optimum (5) was the wrong choice anyway.

## The bot is a proxy for TERMINATION, never for feel (learned 2026-08-23)

Every number above came from a random-steering bot, and the first shipped tuning
was chosen to kill that bot in ~3 minutes. Mai then played it: *"way too quick,
not able to play strategically at all."*

The mistake is worth stating plainly, because the tooling makes it easy to
repeat: **a random bot dies of chaos, not of time pressure.** It never plans, so
it cannot tell you whether a person has time to. Tuning against it optimised the
one quantity it can measure and silently wrecked the one it cannot.

Two things fell out of re-reading the numbers with that in mind:

- **The ramp SHAPE mattered more than the ceiling.** On the shipped build the
  beat was 0.77s by shot 30 and 0.35s by shot 60 — full speed arrived about a
  minute in, so the strategic phase barely existed. `RF_RAMP_FROM` now holds the
  opening beat for the first 12 shots and `RF_RAMP_SHOTS` stretches the ramp to
  110: 2.2s / 1.9s / 1.4s / 0.9s at shots 1 / 30 / 60 / 90, and ~168s before it
  is fully frantic.
- **Being handed a big drink you did not plan for is what stops a player
  building anything** — and the bot had no plans to ruin, which is exactly why
  `RF_DROP_MAX` 5 measured well and played badly.

Rapid is still not the mode Mai wants (she is happy with 30-minute classic runs,
and this was built for the people who are not). Her feedback is not a demand to
make it slow; it is evidence that the early game gave *nobody* a foothold.

**Rapid needs its own game-over test.** The classic rule wants a drink over the
danger line AND at rest (`speed < 0.15`), but a shot every 0.35–2.2s keeps the
whole board permanently jostling, so almost nothing settles — a run reached 90
drinks and 4 minutes with no end in sight, a jammed board the game could not see
was jammed. Rapid asks how long a drink has **dwelt** in the zone instead
(`plugin.overSince`, `RF_OVER_MS` = 800), with no speed test. Tracking dwell per
body (rather than just dropping the speed test) is what stops a drink knocked
BACK into the zone ending the run the instant it arrives.

**The dwell REPLACES the 1.5s birth grace; it must not stack with it.** The
first build ran the birth check first, so a drink could sit behind the line for
1.5 + 1.2 = **2.7s** — which read on a phone as the game being slow to notice
(Mikael, 2026-08-23). The birth grace exists to let a shot cross the zone it is
launched from, and the dwell already does that job: a shot clears the line in
~55ms (90 world px at speed 27), so even at 800ms the dwell is ~15× the transit
at full tilt. Measured after the fix: a drink settling in the zone ends the run
in **817ms**, and classic still takes its full 1500ms.

## The rest

- **Combos are forced ON, and the per-throw reset is dropped.** `fireShot` does
  `state.combo = 0` on every classic throw; at rapid's cadence against a 1.4s
  `COMBO_WINDOW` that would stop a chain surviving even one shot, leaving the
  forced combos very nearly inert. Letting the window alone govern the chain is
  what turns the cadence into something that *sustains* a streak. Because combos
  are pinned, `scoreKey` folds rapid and combo into one variant part
  (`mm_s_<map>__rapid`) rather than multiplying them.
- **Mutually exclusive with Happy Hour**, and not merely by taste: HH's
  tap-to-serve gesture lives exactly where rapid's steering drag does. HH wins
  the tie in `startGame` so a stale rapid preference can't disable a mode the
  player did tick.
- **The cadence is counted in FRAMES, not wall time.** `stepPhysics()` is one
  60Hz frame for both `loop()` and `TT.step()`, so `TT.step()` alone plays the
  mode deterministically — and there is no `performance.now()` stamp for
  `setPaused` to be wrong about, so the score panel's freeze can neither bank
  free time nor skip a shot. (`plugin.overSince` IS such a stamp and is pushed
  forward with the rest.)
- `sceneBusy()` returns true for the whole mode: the charge ring is always
  filling, so the idle-frame skip must not park the loop between shots.
- **The aim line is standing state** and is always drawn (`drawRapidAim`), since
  there is no press to reveal it. The mode still needs *some* warning of when
  the shot leaves, or the cadence reads as random and feels unfair rather than
  fast — see the charge readout below.
- **`loadedDrinkWY()` (render.js) is where the loaded drink is, and BOTH the
  preview and the spawn read it.** They used to disagree: the preview sat at the
  cradle's throat while `fireShot` spawned the body at `LAUNCH.y - physR - 4`,
  ~20px lower — and since field drinks are drawn BEHIND the launcher art, a shot
  visibly dropped back behind the cradle for a frame before flying (Mikael,
  2026-08-23). Rapid now spawns at full spring compression, i.e. exactly where
  the drink was drawn on the frame before firing, so the spring releasing is the
  only movement. Measured at a 0.01px gap. Classic keeps its original expression
  to the letter and is untouched.
- **The cradle stands EMPTY between shots** (`RF_RELOAD_MS` + `RF_LOAD_MS`,
  frame-counted like the cadence). The first build rolled the next tier inside
  `fireShot`, so the next drink appeared in the cradle on the very frame the
  last one left it and the launcher read as *a picture of what is coming* rather
  than a thing that shoots (Mikael, 2026-08-23). The pause is capped at
  `RF_RELOAD_FRAC` of the beat as well as in ms — 170ms is right at the start of
  a run but is half the cycle once the ramp reaches 350ms, and a cradle empty
  half the time reads as broken rather than busy. The drink then scales in over
  `RF_LOAD_MS` so it arrives rather than blinking in. Purely visual: verified by
  all 35 board digests being unchanged.
- **The charge readout is the launcher itself, not a gauge.** The spring winds
  up: the head compresses toward its hub (`RF_SQUASH`, cubed so nearly all the
  travel is in the last third of the beat) and the loaded drink rides down with
  it, then both snap back on the shot. The aim line brightens into the beat as a
  second cue, sitting where the player is already looking. The first build drew
  a ring around the cradle instead, and it **buried the art it was reporting
  on** while fighting the XP bar for the same strip of screen (Mikael, on a
  phone, 2026-08-23). Two cues, neither of them a new element.

## A sprite's scale tracks its BODY, not its age (fixed 2026-08-23)

`render()` used to draw **every** drink growing from 0.6 to full over 200ms off
`plugin.born`. Only merge products actually grow — `makeDrink`'s `growIn` flag
is what sets `plugin.scale`, and `stepPhysics` advances it — so a *shot*, whose
body is full size from birth, was drawn at 60% of its own hitbox for 200ms. It
read as the item shrinking the instant it left the launcher.

`const growth = d.plugin.scale || 1` makes the sprite track the body exactly.

**This changes classic too**, and deliberately: every shot on every map loses a
200ms grow-in pop that never matched its physics. It is visual only — all 25
non-rapid board digests are unchanged — but it IS a thing Mai could notice, so
it is written down here rather than buried in the rapid-fire section.

## Two things rapid fire changed for every mode

- **Coins clear faster when the screen is crowded** (`COIN_RUSH_*`, render.js).
  In late rapid fire a merge lands every few hundred ms and the coins stop
  reading as a reward and become a curtain over the table. `updateCoins` scales
  the whole flight — including each coin's negative stagger, since the speed-up
  is applied before the `t < 0` test — by the live number in flight, so it eases
  off again as the crowd drains. Measured on ten 18-coin merges 350ms apart:
  peak on screen **136 → 65**, and 2.0s → **0.6s** to fall back under 20. A
  normal burst never reaches `COIN_RUSH_FROM` and is untouched.
  Tune it against a realistic crowd, not one big `spawnCoins` call: a single
  call is capped at ~20 coins, and a synthetic 140-coin burst is dominated by
  its own stagger, which sent the first tuning after the wrong lever.
- **The quit confirm now FREEZES the run**, like the score panel. It was left
  running because it was judged "rare or terminal" — it is neither. It is the
  only pause this game has, and people use it as one when they need to put the
  phone down (Mikael, 2026-08-23). Rapid made that reasoning plainly wrong,
  since the cannon keeps firing on its own and a run dies behind the overlay,
  but `checkOver`'s danger-line grace was counting in every other mode too. Both
  exits unfreeze explicitly: a `paused` that outlived the run would freeze the
  NEXT one at birth.

## Open, for after the playtest

- **The 4th checkbox costs Kyoto its single row of toggles** — CLAUDE.md's note
  about 17px boxes was written for exactly this. It wraps cleanly to two rows at
  360/390/430px (verified, nothing clipped), but the real fix is that Classic /
  Happy Hour / Rapid are **mutually exclusive** and want a segmented mode
  control rather than N checkboxes.
  Until then, **neither mode box is ever disabled**: ticking one UNTICKS the
  other (`syncModeToggles` in welcome.js). A disabled box is a dead end — you
  have to work out for yourself which other control is holding it down, and on a
  phone it just reads as broken (Mikael, 2026-08-23). The COMBO box is still
  disabled under either mode, and that is a different thing: it is not excluded
  by the mode, it is PINNED by it, so showing the pinned value is honest.
- **Is the spring wind-up loud enough on a small screen?** It replaced the
  charge ring for good reasons, but it is a subtler cue by design. If it proves
  too quiet, the next thing to try is the aim line (brightness, or dashes that
  march) rather than putting a gauge back on the launcher.

## The launcher art — two sprites, because only the head turns

`assets/images/shared/launcher-head.png` + `-base.png`: a brass cradle on a
spring, and the plate it is mounted on. **Shared chrome, not map art** — the
same reasoning as the coin and the moneybag, since it has to sit on a tiki bar
and in a mage tower alike. Generated white-on-transparent as one sheet
(`assets/source/shared/launcher.png`).

- **It is two sprites because a one-piece launcher tips over when it tilts.**
  The head rotates about the point where its spring meets the hub; the plate
  never rotates at all.
- **The cut is a `boxes` entry, not a grid.** The generator drew the cradle
  already standing on its own base plate, and the spring runs down BEHIND that
  plate's rim — so the boundary between the two parts is a horizontal cut
  partway through one drawn object, and `split_alpha_grid` has no gutter to
  find. `handle_boxes` takes explicit source rectangles instead. The head is cut
  at y=500, just above where the plate first flares.
- **`max_height` scales the whole SHEET by one factor, never each sprite to the
  same height.** These parts are drawn assembled: capping each to 256px
  independently resized them 3% relative to each other, which is enough to leave
  the cradle sitting proud of its hub.
- **The head is drawn at 0.45× the shot's tilt** (`LAUNCHER_TILT_K`). At the
  full 40° a horseshoe pivoting down at its spring swings clear off its own
  plate and reads as having fallen over — the head sprite is wider than the base
  to begin with. The aim line carries the true direction; the art only has to
  lean into it. 0.6 still overhung; the range was rendered to pick this.
- **`LAUNCHER_DY` and `LAUNCHER_LIFT` are one measurement, and it is against
  the XP BAR.** The horizontal bar occupies the bottom ~42 world px of the
  stage, and a plate whose hub sits on LAUNCH has its lower third behind it —
  the second half of the phone-test clutter. −22 clears it with margin on every
  map (the bar's geometry is map-independent), and the loaded drink is raised by
  the matching amount so it still sits in the cradle's throat rather than in
  front of it. Move one and the other must move.
- **`cannonMargin()` accounts for the ART, not the drink.** The cradle is wider
  than anything it can hold, so in rapid the carriage has to stop before the
  cradle would hang off the table.
