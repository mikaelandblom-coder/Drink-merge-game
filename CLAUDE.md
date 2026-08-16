# Mixology Merge — Project Guide

A Suika-style browser merge game built as a gift for Mai. Drinks are shot onto a
perspective-rendered table and merge when two of the same tier collide.
Physics via Matter.js, rendering via Canvas 2D API.

---

## File structure

```
config/constants.js   — W=420, H=620 (physics world size) + GAME_VERSION. Loaded first.
config/hitboxes.js    — MAP_HITBOXES (spline knots + generated cornerWalls) and
                         ITEM_HITBOXES (bodyRatio overrides). DO NOT hand-edit —
                         maintained by tools/hitbox-editor.html.
config/items.js       — ITEMS array: all drink tiers (sprite, radius, colors, physR)
                         + RECEIPT_ITEMS and CUSTOMER_SPRITES (the Happy Hour
                         cast — a plain sprite list; its length IS the cast size)
config/maps.js        — MAPS array + ACTIVE_MAP (bg, bgm, bgmVol, items ref,
                         optional sizes/combos); hitboxKey() + applies
                         MAP_HITBOXES overrides at the bottom
scores.js             — Per-variant high scores in localStorage; scoreKey() maps a
                         (map, size, combos) run to a storage key
buglog.js             — Bug-report capture: rolling ring of the last 10 shots
                         (each with the pre-shot board) + game-over events →
                         copyable MMB1. code via the 🐞 HUD button. Replay a
                         code with TT.bug / TT.bugLoad in test mode.
suspend.js            — Suspended runs: quitting or backgrounding a map parks the
                         whole board in localStorage (one per map) so the menu can
                         offer "Continue". Built on BUGLOG.snapDrink + the same
                         rebuild TT.bugLoad does — see "Suspended runs" below.
config/sounds.js      — SOUND_LIB: every synth voice in the game, one entry each
                         (`play(a, out, opts)`) — the single source of truth for
                         HOW a sound is made. A voice renders into the `out` node
                         it is handed and must NEVER touch ctx.destination
                         (iOS routing — see "Known issues").
config/soundmap.js    — SOUND_MAP: WHICH voice each map plays for each event
                         (merge/collide/coin/shoot/gameOver/best/levelUp), over a
                         `default` row every map inherits. Pure data, generated
                         by tools/sound-lab.html — see tools/README.md.
audio.js              — Audio PLUMBING only: output routing (incl. the iOS
                         workarounds), mute/music toggles + the two remembered
                         volume levels (see "Volume"), BGM, and a thin
                         dispatch from a game event to the active map's voice
                         (pop/clink/coinTick/shoot/fanfare/levelUp/gameOver all
                         one-liners over `playSound`). No synthesis lives here.
fx.js                 — Ambient background motion: a few drifting details over a
                         map's art. A CSS-animated DOM layer, NOT canvas
                         particles. Built, working, currently used by NO map —
                         see "Ambient background motion" below for why it's
                         shelved and what to fix before using it.
render.js             — All canvas drawing (bg, drinks, coins, bag, particles,
                         aim); `drawXray` is the player-facing X-ray diagnostic
                         (see "X-ray" below), separate from the dev `drawHitboxes`
ui.js                 — Pointer input, HUD buttons, game-over overlay, LAUNCH pos,
                         the in-game score panel (tap the coin bag)
welcome.js            — Main menu: map cards, size/combo checkboxes, score lists
game.js               — Physics engine, state object, merge logic, render loop
style.css             — All CSS
index.html            — Shell: loads scripts in order (constants → hitboxes →
                         items → maps → sounds → soundmap → scores → buglog →
                         suspend → progress → audio → fx → render → ui →
                         welcome → game)
process_assets.py     — Asset pipeline: source images → game-ready PNGs
compress_backgrounds.py — Background/chrome PNG → WebP (~-91%). Separate from
                         process_assets.py because backgrounds need no keying,
                         only recompression. See "Bandwidth".
compress_audio.py     — BGM mp3 → 112 kbps (ran 2026-07-26: 40.8→24.4 MB).
                         `--check` reports the true AVERAGE bitrate with no
                         ffmpeg (these files are VBR, so the first frame header
                         lies); re-encoding needs ffmpeg. Idempotent.
tools/
  README.md           — Manuals for the three editors below (hitbox, sprite,
                         sound). READ THE RELEVANT SECTION before editing a tool
                         or hand-touching config/hitboxes.js or config/items.js.
  hitbox-editor.html  — Visual hitbox editor (manual: tools/README.md)
  sprite-editor.html  — Visual sprite prep: AI sheet -> individual PNGs, then
                         PNGs -> an items.js tier chain (manual: tools/README.md)
  sound-lab.html      — Sound library + wiring board: audition every voice and
                         assign one per map+event (manual: tools/README.md).
                         Loads config/sounds.js + config/soundmap.js from the
                         real project, so it plays exactly what the game plays.
  tool.css            — Shared look for ALL tools: tokens (--bg/--panel/--accent
                         /--line/--muted…) + the primitives they had each
                         restyled separately (buttons, .tabs, fieldset/legend,
                         inputs, .hint/.row/.val/.readout/.chip). A tool's own
                         <style> should hold only its LAYOUT and its own
                         components. Signal colours are deliberately NOT themed —
                         see the comment at the top of the file.
  tool-handles.js     — Shared remembered-handle store for ALL tools: `ToolHandles`
                         .keep/.recall/.forget/.ready over one IndexedDB db
                         (`mm_tool_handles_v1`), keys namespaced per tool
                         (`sprite:libRoot`, `hitbox:file`, `sound:file`). A File
                         System Access handle can never be built from a path —
                         only from a gesture on a picker — but handles ARE
                         structured-cloneable, so this makes a pick last across
                         reloads. Every op swallows its errors: no IndexedDB
                         just means the tools prompt like they always did.
  tool-nav.js         — Tool switcher. A tool marks its mount point with
                         `data-toolnav="<id>"` and gets pills for the others,
                         PLUS its browser-tab icon (same emoji, as an SVG data
                         URI) so several open tools stay tellable apart. Adding
                         a tool = one line in TOOLS. Hrefs are relative to the
                         PROJECT ROOT because every tool sets <base href="../">.
                         Data-URI favicons are fine here but NOT for the game —
                         iOS Safari ignores them (see index.html's icon note).
                         The Game pill points at `index.html?dev=1`: anyone
                         arriving from a tool is a dev, so the welcome screen's
                         Dev tools row is already there for the trip back.
  shot-receiver.py    — Local POST receiver for canvas screenshots from the
                         (often hidden) preview tab — see "Known issues".
assets/
  source/             — Raw AI-generated images (white background). NEVER edit these.
                         Backgrounds live here as the ~2.5MB PNG masters, but are
                         NOT served: compress_backgrounds.py emits a ~200KB WebP
                         into images/<map>/ and config/maps.js `bg:` points there
                         (see "Bandwidth" below).
    _archive/         — Superseded source art, kept for reference
    chrome/           — Masters for the site chrome WebPs (bg-main-menu,
                         xp-bar-frame, xp-medal). They used to sit in images/
                         next to their own output, so 3.2MB of PNG deployed for
                         nothing; moved 2026-07-29.
    shared/           — coins_and_bag.png (shared across all maps)
    tikibar/          — Per-map source images
  images/             — Processed output used by the game (git-committed).
                        MAP-BASED layout (migrated 2026-07-26): one folder per
                        map — hawaii/ saigon/ kyoto/ mage/ teddy/ melody/
                        paris/ farm/ — with the redundant prefix stripped
                        (assets/images/farm/seed.png, not farm-seed.png).
                        shared/ holds art used by every map (coin, moneybag,
                        receipt-*, customer-*) and KEEPS descriptive names,
                        since it mixes several groups. Site chrome
                        (favicon-32, icon-192, apple-touch-icon, bg-main-menu,
                        xp-*) deliberately stays at the top level —
                        apple-touch-icon is Mai's iPad home-screen icon and
                        moving it risks breaking that for no gain. Only the
                        SERVED form lives here: the icons (PNG, referenced by
                        index.html) and the chrome WebPs. Their PNG masters are
                        in source/chrome/.
```

---

## Dev tools — hitbox editor, sprite editor, sound lab

Their manuals live in **[tools/README.md](tools/README.md)** — how each one
works, what it owns, and the traps it exists to avoid. **Read the relevant
section there before editing anything under `tools/`, and before hand-editing
`config/hitboxes.js` or `config/items.js`** (both are tool-generated).

`tools/tool.css`, `tools/tool-handles.js` and `tools/tool-nav.js` are shared by
all three; all three set `<base href="../">`, so every path they reference must
be written relative to the PROJECT ROOT.

---

## Art prompts for merge-item grids

The prompt templates live in **[assets/ART-PROMPTS.md](assets/ART-PROMPTS.md)**
— a FOOD template (Cần Thơ, the most refined), the older Paris template for
non-food subjects, and the background prompt, each with the reason every clause
is in it. **Read it before asking an AI for a new item grid or background.**

It is a separate file rather than a section here because a prompt is something
you copy, paste and fill in, not something you read for context — and most of
its length is worked examples that would crowd this file out.

The two rules worth knowing without opening it: **row-major order IS tier
order**, and **the colour ladder is gameplay** — at r15–r30 hue is what tells
the player two items match, so name a colour per item and never put two
adjacent tiers in the same family.
---

## Menu options — size variants, combos & Happy Hour

Each map card in the main menu can carry per-map checkboxes, all remembered
in localStorage and passed into `startGame(map, {size, combos, happyHour})`:

- **Large table** (only for maps with a `sizes` field in config/maps.js). Swaps
  the background art between framings; `defaultSize` sets the initial state
  (Kyoto → large, Plushie → small). Each size has its own hitbox (see above) and
  its own high-score board. Each framing's PNG master goes in
  `assets/source/<map>/`; run `python compress_backgrounds.py` and point `sizes:`
  at the generated `assets/images/<map>/*.webp` (see "Bandwidth").
- **Combo multipliers** (every map). Cascade-merge score multipliers. The map's
  `combos: true` is now just the *default* checkbox state (on for Mage Tower &
  Plushie Factory), not a hard setting — `COMBOS_ENABLED` is set per run.
- **Happy Hour** (every map; orders mode). Customers queue behind the horizon
  (max 3; first after 8 shots, then every 6 shots — `HH_*` constants in game.js)
  and each shows the drink tier they want in a speech-bubble frame that lights
  green when that tier is on the field. Orders are an UNWEIGHTED sample over the
  map's whole tier chain (`ITEMS.length`), so high-tier orders sit unservable
  until the player merges that far. Tapping a green frame serves the copy
  CLOSEST to the danger line: coins + a tier-0 **receipt** grows in where the
  drink stood. Receipts (`RECEIPT_ITEMS` in config/items.js, shared art)
  merge as a parallel 5-tier chain; the golden top tier pays a 25-coin burst the
  moment it forms and then STAYS on the field for good — each finished chain
  permanently eats table space, so a run can't drag on forever. Forces combos OFF (`COMBOS_ENABLED=false`, combo checkbox
  disabled). Taps above HORIZON never start an aim (ui.js). Customers/bubbles
  are drawn by `drawCustomers`/`customerLayout` in render.js — layout is
  proportional to the per-map HORIZON and shared with the tap hit-test.
  Arrivals key off SHOT COUNT (not wall time) so the idle-frame optimizer can
  never skip drawing a walk-in.
  The **cast** is `CUSTOMER_SPRITES` in config/items.js (shared art, edited in
  the sprite editor's cast mode). Adding a face there is the WHOLE change: its
  size is derived via `CUSTOMER_IMGS.length`, never written down twice. It used
  to be a hardcoded `HH_CAST = 9` in game.js beside a hardcoded array in
  render.js, so a tenth face would have been silently unreachable. No two queued
  customers share a face — only enforceable while the cast outnumbers the queue,
  so a cast of ≤3 allows repeats rather than spinning forever. The cast went
  **9 → 18** on 2026-07-26 (a second AI sheet through the sprite editor).

  The nine new faces were renamed off the sprite editor's placeholder names
  (`customer-11/22/33/44/55/66/7/9`) to descriptive ones matching the original
  nine — `customer-fox/shopper/biker/kid/sensei/dancer/elf/gamer`, plus
  `customer-viking`, which already was one (2026-07-29). Renaming a face is two
  edits, the file on disk and its line in `CUSTOMER_SPRITES`: unlike item
  sprites there is NO hidden coupling, since `ITEM_HITBOXES` is keyed by sprite
  path but customers are not items and have no hitbox entry. The five extracted
  PNGs that never made the cast were deleted in the same pass.

  **Cast sprites are capped at 256 px tall.** They draw at
  `min(108, HORIZON*0.46)` px, and the second sheet shipped at 419–460 px —
  ~4× oversampled at ~265 KB each, which took the cast to 4.0 MB (from 1.6 MB)
  and an HH session from ~6.4 MB to ~8.8 MB, since `loadCustomerSprites()`
  fetches ALL of it when a Happy Hour run starts. Downscaled 2026-07-29:
  those nine went 2.4 MB → 872 KB with nothing visible at the drawn size. Save
  new faces through the sprite editor's **max height** control (see "Sprite
  editing") so this doesn't recur — it defaults to 256 px, which is exactly
  right for this use.

**Cool mode (30 fps cap) — built but SHELVED.** The welcome-screen checkbox is
commented out in index.html (with its wiring in welcome.js), and startGame pins
`coolMode = false`. The game.js machinery is intact: it halves the render rate
but keeps the physics step size (twice the substeps per frame), so game speed
and collision quality are unchanged. Re-enable by restoring the index.html
block + welcome.js wiring + the localStorage read in startGame. It remains the
biggest thermal lever if the DOM-layer background isn't enough.

## XP & levels (progress.js)

Every shot earns **1 XP** on every map/mode — shots ≈ time played, so no mode
is the "optimal" way to level (deliberate; don't add merge/score bonuses).
Each map has its own level; the **total player level** (welcome header) is the
sum of map levels. Per-level cost doubles every 7 levels:
`cost(n→n+1) = round(XP_A · 2^(n/7))`, no cap. **Only raw XP is stored**
(`mm_xp_v1` in localStorage, one JSON blob) — levels are always derived, so
`XP_A` can be retuned without migration — but **`XP_A = 60` is SETTLED, not a
placeholder**: Mikael confirmed it on 2026-07-17 after hands-on play ("keep this
level of tuning"). Don't retune it unless he asks. (Note for anyone tempted to
measure instead: a random-shot bot never dies, so auto-play cannot tell you a
real run length.)

- **In-game XP bar** is a DOM overlay (like `#stage-bg`) — never draw it on
  the canvas. Orientation flips via `XP_BAR_ORIENT` in ui.js; horizontal
  along the bottom is the default (`?xpbar=v` for the vertical variant).
  Level-ups celebrate LIVE (medal pulse + `levelUp()` chime in audio.js) so
  they never compete with the game-over new-best fanfare.
- **Storage safety:** localStorage is mirrored to IndexedDB (`mm-progress` db,
  richer copy wins per map at startup) + `navigator.storage.persist()`.
  **Backup codes** (`MM1.<checksum>.<base64url>`, welcome-screen "Backup &
  transfer") carry XP + all `mm_s_*` score boards across devices; import
  merges by MAX / union — a code can only ever add progress.
- Test mode (?test=1) blanks `Progress._data.maps` and sets
  `Progress.persistEnabled = false` — TT runs never touch real progress.
- Future (agreed, not built): unlocks driven by total level — new maps, menu
  backgrounds, BGM. Don't gate EXISTING maps behind levels (would regress
  Mai's mid-save experience).

## X-ray (why aren't these merging?)

A player-facing diagnostic on the HUD (the crosshair/scan button in `#hud-btns`,
next to 🐞), toggled via `toggleXray` in game.js → `showXray` → `drawXray` in
render.js. Suika merges get confusing when two matching drinks sit apart:
sometimes a smaller item is wedged between them, sometimes there's just a gap.
X-ray dims the field and draws every collision shape **colour-coded by tier**
(same colour = same tier = "these want to merge"), so plain gaps between matching
drinks are visible on their own. On top of that it calls out the wedged case: for
each near same-tier pair (gap ≤ `XRAY_GAP` = 55 world px between hitbox edges), if
`Matter.Query.ray` finds a body in the centre-to-centre corridor it draws a **red
link + a red ring** around the intruder. (Pure-gap pairs are deliberately NOT
linked — an earlier amber "get closer" link was dropped as too busy, 2026-07-21.)

It's a toggle (touch-friendly for Mai), glows cyan when active (`.hud-btn.active`
in style.css), and forces the render loop to stay live while on (`sceneBusy`
returns true for `showXray`, so a settled board still repaints the overlay).
Distinct from the dev-only `drawHitboxes` (the `h`-key / `?hitbox` overlay).

## Ambient background motion (fx.js)

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

## Volume (press-and-hold the sound buttons)

Mai's ask, 2026-08-03: she likes the BGM but it drowns the game. **Tap** either
HUD sound button and it toggles exactly as it always did; **hold** it ~380ms and
a slider slides out under the HUD row (`#vol-pop`, wired by `wireSoundBtn` in
ui.js). It auto-dismisses after ~3.2s idle, or on the next tap anywhere else —
including the table, where the tap is SWALLOWED so putting the slider away can
never cost a shot.

- Levels live in audio.js (`getVolume`/`setVolume`), persisted in localStorage
  as `mm_vol_music_v1` / `mm_vol_sfx_v1`. Independent of the score/XP blobs, so
  they are deliberately NOT in a backup code — a per-device mix should stay
  per-device.
- **Music is a MULTIPLIER over the map's authored `bgmVol`** (config/maps.js),
  never a replacement: a track balanced quieter stays quieter relative to the
  others, so per-map mixing survives. `initMusic()` stores the map level in
  `mapBgmVol` and `applyMusicVol()` combines them.
- **SFX is the master `sfxBus` gain**, which is why `applySfxVol()` runs inside
  `ac()` — the bus is rebuilt from scratch by `hardResetAudio()` on the iOS
  recovery path, and a fresh GainNode defaults to 1.0 (verified: level survives
  a hard reset).
- **Zero IS off, in both directions.** A slider at 0 flips the button to its
  off icon, and toggling back on from 0 restores `VOL_RESUME` (0.5) — otherwise
  the icon would claim sound is on while nothing can be heard, and the button
  would look like a no-op. Both paths go through `setSoundEnabled(kind, on)`,
  which is the only place that writes `muted`/`musicOn`.
- The effects slider auditions with a `clink(6)` per drag step (throttled 140ms;
  impact 6 saturates every collide voice's volume curve, so she hears a
  full-strength hit at the level she just picked). Music needs no audition — it
  is already playing.
- The popover is **right-aligned to the HUD row**, not centred on the button:
  `#stage` is sized from its height, so on a narrow screen it overflows the
  viewport and a centre-anchor hangs off the edge. Sharing the row's alignment
  makes the slider exactly as reachable as the buttons. The label says which
  channel it is.
- `#vol-pop` needs its explicit `[hidden]{display:none}` in style.css — see the
  `hidden`-vs-author-`display` trap under "Known issues".

## High scores

Scores are stored **per variant** (table size × combo state × Happy Hour) via `scoreKey()` in
scores.js. To avoid a migration, the DEFAULT variant keeps the legacy
`mm_s_<mapId>` key (so pre-existing scores are untouched); non-default variants
get a suffix (`mm_s_kyoto__small_combo`). Happy Hour always suffixes
`happyhour` and skips the combo part (combos are forced off in it, e.g.
`mm_s_kyoto__small_happyhour`). Menu cards show every variant's top 3
at once (no names — local scores), highlighting the current selection. Game over
saves under the played variant and shows a `fanfare()` + banner when the best is
beaten. NOTE: key identity is coupled to a map's current `defaultSize`/`combos`
defaults — changing a default would re-point the legacy key.

`currentScoreKey()` (game.js) is the single expression of "the board this run
counts toward" — the game-over save, the in-game readout and the score panel all
call it, so they cannot disagree about which variant is being played.

### Knowing what you're chasing, mid-run (Mikael's ask, 2026-08-15)

Two halves, and the passive one is the one that answers the question:

- **A second pill under the coin count** — `2,150 to beat`, counting down as
  coins land, flipping to a gold `🏆 new best` the moment it's overtaken (which
  also pops a `NEW BEST!` text — but makes NO sound: Mikael's call, 2026-08-15,
  since the run is still going and anything audible talks over the shot being
  lined up. The game-over `fanfare()` stays the one moment a record is heard. If
  a discrete cue is ever wanted, it needs its own `SOUND_MAP` event added in the
  sound lab, not a second caller of `best`). Drawn by `drawBag` in render.js
  from `bestToBeatLine()` in game.js, which caches per score value rather than
  rebuilding a string every frame. `state.bestToBeat` is read ONCE per run in
  `resetState` — a run's target cannot change while it's being played, and
  coming back through "Play again" re-reads it, so a record set last run is the
  target this run. An empty board draws nothing: there's nothing to chase.
- **Tapping that readout opens the full board** (`showScorePanel` in ui.js,
  `#score-panel`): this variant's top 8 with the live run slotted in at the rank
  it currently stands, and the gap spelled out. Variant labels are reused from
  welcome.js `mapVariants` so the menu and the panel can't describe the same run
  differently.

Two things about it that are load-bearing:

- **The run FREEZES while the panel is open** (`setPaused` in game.js), which no
  other overlay in this game does. The bug panel and quit-confirm are rare or
  terminal; this one is opened mid-run, repeatedly, and `checkOver` keeps
  counting the 1.5s danger-line grace whether or not anything is being drawn —
  so without the freeze, checking what you need to beat could cost you the run.
  Resuming pushes every `performance.now()` stamp (`plugin.born`, customer
  `bornAt`/`leaveAt`, `lastMergeAt`) forward by the frozen duration, so the
  board comes back at the age it was parked at — the same trick as
  `SUSPEND.apply`'s deliberate backdating, pointed the other way. Backgrounding
  closes the panel first (`visibilitychange`), so that window can't grow to an
  hour, and `startGame` closes it defensively — a stuck `paused` would freeze
  the next run's loop at birth.
- **The tap must not steal a shot.** The coin corner is a legal aim direction
  (tap-to-shoot is a supported gesture), so ui.js claims a press in `bagHit`
  (render.js) only while it stays within `BAG_TAP_SLOP`; travel further and it
  becomes a normal aim, picked up from where the finger is. Nothing calls
  `updateAim` on the initial press either, or LAUNCH would visibly slide toward
  the corner just from touching the score. In Happy Hour the customer frames are
  hit-tested FIRST: the leftmost order bubble genuinely overlaps the readout's
  box on Hawaii, Kyoto, Plushie and Farm (measured), and a tap there means
  "serve" — the readout keeps the rest of the box, and a drag off it inside the
  strip still fires nothing, so the no-aim-above-the-horizon rule is intact.

## Suspended runs — leaving a map keeps the board (suspend.js)

Quitting to the menu, or backgrounding the page, parks the whole run in
localStorage; the map's card then offers **Continue** and **New run** instead of
Play, with a line saying what's waiting ("Run in progress · Small · Happy Hour ·
1,240 coins"). New run asks before discarding.

**It is deliberately not a second board format.** Bodies are serialized with
`BUGLOG.snapDrink` (buglog.js — exported for exactly this) and rebuilt the way
`TT.bugLoad` rebuilds a bug report, so a replayed bug and a resumed run can never
disagree about what a board is. suspend.js only adds what a bug report has no use
for: score, upcoming tiers, the Happy Hour queue, and the save lifecycle.

- **One save per map** (`mm_run_<mapId>`, ~300 bytes), carrying the VARIANT it
  was played on. Continue replays that variant and ignores the checkboxes — the
  parked board was traced against that framing's boundary, and its receipts and
  customers only exist in Happy Hour. The checkboxes describe a NEW run only.
- **`d.plugin.born -= 10000` on restore is what keeps quitting honest.** The
  game-over grace is measured from `born`, so backdating it means a resumed board
  is judged immediately — parking a run with a drink sitting over the danger line
  can't reset the 1.5s countdown. (Same line, same reason, as in `TT.bugLoad`.)
- **The backgrounding save is the one that matters**, not the menu button: iOS
  discards backgrounded tabs without warning. It hangs off the existing
  `visibilitychange` handler in game.js.
- Cleared on game over (checkOver) and at the start of any run on that map — so
  a crash mid-run can't leave a parked board older than the one being played.
- **Load validates TIER INDICES, not `GAME_VERSION`.** A version check would
  throw parked runs away on every deploy; what actually breaks a restore is an
  item chain that shrank under the save (`makeDrink` indexing past `ITEMS`).
- `state.combo` is deliberately not saved (the window is 1.4s), and coins still
  flying to the bag are folded into the saved score exactly as `checkOver` does.
- XP needs nothing: `xpOnShot` commits per shot, so suspending can neither lose
  nor double-count it. `runXp` is restored only for the game-over recap line.
- **`SUSPEND.persistEnabled = false` in test mode gates CLEARS as well as
  writes** — startGame clears on every start, so without that guard merely
  loading `?test=1` and calling `TT.start` would delete a real parked run.

---

## Running the game locally

Python is installed. Start a local server from the project root:

```
python serve.py
```

Then open http://localhost:5500 in a browser. Use `serve.py`, not
`python -m http.server 5500`: the only difference is a `Cache-Control: no-cache`
header, and that header is what stops the browser serving a STALE `config/*.js`
or `game.js` under an unchanged `?v=` — a symptom indistinguishable from "my edit
didn't work". Pass a port to run a second one (`python serve.py 5501`); it also
honours `$PORT`. Neither this file nor `.claude/launch.json` is loaded by the
game, so nothing here can reach Mai.

### Preview servers & PARALLEL SESSIONS — pick the right launch config

`.claude/launch.json` has three, and picking wrong is silent:

| config | when | what it does |
|--------|------|--------------|
| `game` | **default**, cwd = main checkout | ATTACHES to the server already on 5500. Starts no process. |
| `game-server` | main checkout, nothing on 5500 | Starts `serve.py` pinned to 5500. |
| `game-worktree` | **cwd is NOT the main checkout** | `autoPort` — its own server rooted in its own directory. |

The default is attach-only because `autoPort` used to hand every `preview_start`
the next free port, so 5500/5501/5502… piled up and it stopped being obvious
which tab was which. One fixed port, one server.

**The trap for parallel work:** `.claude/launch.json` is a TRACKED file, so a git
worktree (`.claude/worktrees/…`, from `EnterWorktree` or `isolation:"worktree"`)
inherits the `game` attach config — and attaching would serve the MAIN checkout's
files while you edit the worktree's. Your changes would appear to do nothing, for
no visible reason. **If the session's cwd is not `E:\Projekt\Drink-merge-game`
itself, use `game-worktree`.** A second port there is correct, not the pile-up
this was fixing.

Two more things that are shared across every parallel session, because they are
keyed by ORIGIN rather than by directory: `localhost:5500` has ONE localStorage
bucket, so high-score boards (`mm_s_*`) and XP (`mm_xp_v1`) are shared by every
session pointed at it — use `?test=1`, which stubs score saves and disables XP
persistence. And the File System Access handles the tools hold are to the file
you PICKED — a specific file on disk, with no relationship to the port the tool
is served from. It cuts BOTH ways, and the tool cannot tell: a handle to the main
checkout's `config/hitboxes.js` while the tool runs on a worktree's port, or (the
one that actually bit us, 2026-08-02) a handle to a WORKTREE's copy while you are
working in main. **Re-pick after switching checkouts.**

The second direction is nastier because it is SILENT: the editor saves through the
remembered handle, reports success, and the trace lands in
`.claude/worktrees/<branch>/config/hitboxes.js` — a real save, to a file nothing
in the main session reads. It looks exactly like "the tool didn't save".

**All three tools now detect this themselves** (added 2026-08-02): each verifies
its handle against the copy its own origin serves, at load and after every write,
and raises a "Wrong file?" banner instead of reporting success — see "Every save
is checked against the server" in tools/README.md for how, and for why
auto-selecting the right file is impossible rather than merely unimplemented. The
manual checks below still matter for a save made BEFORE that existed, or from
`file://` where there is no server to ask. In that order:

1. `git status` in the main checkout — if `config/hitboxes.js` is not modified,
   nothing was written HERE.
2. Search for the real write:
   `Get-ChildItem E:\Projekt -Filter hitboxes*.js -Recurse | Sort LastWriteTime -Desc`
   The newest hit is where the work went.

Recovering is a copy, not a re-trace — but the worktree copy is LF while the main
checkout's is CRLF, so convert on the way in or the whole file shows as changed
and the real diff is unreadable. The `Save` button's tooltip is no help here and
is part of why this hides: it reports the handle's `.name` ("Overwrites
hitboxes.js"), which reads identically for the main checkout and every worktree —
the API exposes no path at all. The handle keys are namespaced per tool
(`hitbox:file`) in `tools/tool-handles.js`, so clearing one tool's memory does
not disturb the others.

### Running the tools from disk (`file://`)

**All three tools now work from disk** (made true 2026-07-29 — before that the
sprite editor silently degraded). They pull config through plain `<script src>`
tags, which work from `file://`, and welcome.js already lists `file` as a
dev-tools hostname. Chromium (Edge included — it is the same engine, so it
changes nothing here) blocks `fetch` on `file://` at any privilege level, so
anything that needed the network had to grow a File System Access path instead:

- **Sprite paths are verified through the picked FOLDER** when fetch can't
  answer — see `spriteExists()` in tools/README.md. This is the one that
  mattered: the write-time guard used to warn and write anyway from disk.
- **`config/items.js` is read through a handle.** `authoredBodyRatios()` still
  prefers `fetch`; from disk, click **items.js…** next to the set picker to hand
  the tool the file. Without it, a shown `bodyRatio` may be the hitbox-editor
  override rather than the authored literal — it says so rather than guessing.
  It is the same handle Write wants, so picking early also saves a prompt.

Two things that remain true from disk and are not worth "fixing": a `file://`
image taints the canvas, so `spriteColours()` falls back to grey
`#888888`/`#dddddd` — but only for a tier added with neither a preset nor a blob
src, which no caller does (library clicks pass a blob URL, set loads pass a
preset), so it is unreachable in practice. And `file://` has its own
localStorage bucket, so the GAME opened from disk shows no scores or XP.

`--allow-file-access-from-files` is NOT needed and should not be used: it does
not fix the `fetch` (wrong layer), and it makes every local page able to read any
file on disk.

A **Dev tools** row sits at the bottom of the welcome screen (below Backup &
transfer) linking to the three editors. `tools/` deploys with the game, so that
row — not the tools' absence — is what keeps them off Mai's menu: welcome.js
renders it only when the hostname is localhost/127.0.0.1/[::1]/file, or when the
URL carries `?dev=1` (the escape hatch for reaching the tools from a phone or
iPad pointed at the dev server). It only ever shows links, so `?dev=1` is safe
to leave in place.

### Test mode (?test=1) — USE THIS to verify gameplay changes

**http://localhost:5500/?test=1** loads `test.js`, which installs `window.TT`
(the file is inert without the flag — Mai's game never runs it). It is the
fast path for verification: it wraps `performance.now()` with a virtual offset
and steps the game **synchronously** (same per-frame code as live play:
`checkOver` + `stepPhysics` + `render`), so merges, the 1.5s game-over grace,
combo windows and coin flights all fast-forward deterministically — hidden
preview tab or not. No rAF, no real-time waits, no pointer-event simulation.

```js
await TT.start('hawaii', {seed:42, happyHour:true}); // bypass menu; muted; rAF OFF
TT.seed(42);              // (or reseed mid-session — also re-rolls next/queued)
TT.shoot(210, 100);       // real shot (ghost->solidify, counts for HH arrivals)
TT.spawn(3, 200, 300);    // or place a body directly ('receipt' kind supported)
TT.step(120);             // advance exactly 2s of game time, synchronously
TT.settle();              // step until nothing moves; returns state + .settledIn
TT.state();               // compact JSON snapshot (drinks/receipts/customers/score)
TT.customer(2); TT.serve(0);      // Happy Hour queue control
TT.bug(code);             // validate + summarize an MMB1. bug-report code
TT.bugLoad(code, i?);     // rebuild the board before shot i (default last)
                          // and re-fire it — then TT.step()/TT.settle() to watch
await TT.shot('label');   // composite bg+canvas -> tools/shot-receiver.py :5599
TT.live(true);            // hand back to the real rAF loop to watch in a pane
```

**Reproducibility: pass the seed to `TT.start`.** `startGame` → `resetState`
draws the first two tiers immediately, so a seed installed afterwards used to
miss them: a cold load opened off the native `Math.random`, a second run in the
same page off the already-advanced PRNG, and the same script played out
differently (measured on `paris`, 2026-07-26). `TT.start(map, {seed})` seeds
before `startGame`, and `TT.seed()` now re-rolls `next`/`queuedTier` through
`rollFreshTiers()` (game.js) — the same call `resetState` makes, so both
orderings consume the same two rolls and give the same run. An UNSEEDED run is
still non-reproducible by design; seed every run you intend to compare. Any new
code that draws the starting pair must go through `rollFreshTiers()` too.

Notes: high-score saves are stubbed in test mode (localStorage boards stay
clean); map ids are `hawaii/saigon/kyoto/mage/teddy/melody` (TT.start errors
list them); two spawned bodies only merge if placed overlapping (use
`ITEMS[t].physR`); the coin-bag NUMBER eases toward the true score — run a few
extra `TT.step()`s before a screenshot if it must match. `stepPhysics()` in
game.js is the shared per-frame simulation — keep loop() and TT.step in sync
through it.

The `.claude/launch.json` runs an equivalent server for the preview panel —
IMPORTANT: it must use `http.server.ThreadingHTTPServer` (plus a
`Cache-Control: no-cache` header for dev). The old plain
`socketserver.TCPServer` one-liner was SINGLE-threaded with a backlog of 5:
Chrome opens ~6 parallel connections, so page loads hung half-finished and the
rest got ERR_CONNECTION_REFUSED — this looked like random preview flakiness for
weeks (diagnosed 2026-07-12). The no-cache header also stops the browser
serving stale JS under an unchanged `?v=` during development.

---

## Asset pipeline

AI art is generated with a **white background**. The script removes it,
feathers edges, and de-mattes colour bleed.

```
python process_assets.py              # process all maps
python process_assets.py --map tikibar
python process_assets.py --map shared
```

### Config in process_assets.py — PIPELINE dict

Each map lists its source files. Entry types:

> **Not every map is pipeline-owned.** Farm has NO PIPELINE entry: its shipped
> sprites were extracted in the sprite editor (from `items 3.png`), with
> hitboxes/colours tuned to those exact crops — see the farm note in the
> PIPELINE dict before re-adding one. A full `python process_assets.py` run is
> expected to be a **no-op** against a clean checkout (verified 2026-07-30);
> if it dirties git, something is stale — fix the config, don't commit blindly.

| type | use case |
|------|----------|
| `single` | one item per file (preferred) |
| `pair` | two items side by side (coin + bag) |
| `spritesheet` | grid of items; use `separator` for reliable splits |

Backgrounds are not PIPELINE entries — they need no keying, only recompression,
so they have their own script: `python compress_backgrounds.py` turns each
`assets/source/<map>/bg*.png` master into a ~200KB WebP under
`assets/images/<map>/`, which is what `bg:` in config/maps.js points at. See
"Bandwidth" for why that matters.

Key per-entry options:
- `fill_holes: True` — makes enclosed white regions transparent (handle holes,
  under-umbrella areas). Uses `min_hole_px` (default 300) to avoid eating small
  glass highlights. Currently enabled for beer and fruit punch pitcher.
- `white_thresh` — override the global 235 threshold. Coin/bag use 245 because
  gold edges are close to white.
- `min_hole_px` — minimum hole size in pixels to treat as a real hole (not a
  glass highlight). Default 300.
- `fill_holes_region` — restrict hole detection to `'left'`, `'right'`, `'top'`,
  or `'bottom'` half of the image. Beer uses `'right'` so foam on the left side
  is never touched, while the handle hole on the right is made transparent.
- `min_component_frac` (spritesheet + `chroma:'alpha'` only) — after splitting,
  erase disconnected alpha blobs smaller than this fraction of an item's area.
  Clears stray bits a grid cell grabbed from a neighbour (the melody grid uses
  0.05 to drop the trumpet's leftover). Use a fraction WELL below any real
  separate part (the violin's bow is ~13%, so 0.05 keeps it) — never a plain
  "keep largest component", which would delete the bow.

**Transparent grids are the standard now** (`type:'spritesheet'`, `chroma:'alpha'`).
ChatGPT/AI CAN generate a real transparent background; ask for one clean grid,
generous gaps, and **NO drop shadows** (a shadow bridging a gutter breaks the
band-count assert in `split_alpha_grid`). Beats the white/magenta-keying path.

**Fake transparency (a grey checkerboard painted into the pixels) is handled
too**: `chroma:'checker'`. `remove_checker_bg` fits the checker grid (period +
phase per axis from the border bands) and removes only pixels matching their
own PREDICTED tile colour, so white/grey items (noodles, bowls) survive where a
plain threshold would eat them; a tile-level guard plus a residue shave handle
percolation and sub-tile gutters. Converts the sheet to real alpha, then splits
like `'alpha'`. Pair it with `min_component_frac` (the keying can leave
feathered slivers in gutters narrower than one checker tile, ~24px). Caveats:
sub-tile enclosed holes may keep their checker (fill_holes is tile-grained
here), and ultra-faint flyaway detail painted OVER the checker (the noodle
wisps) is genuinely half-lost — comes out as soft fuzz, fine at game scale.
Worked example: 'new vietnam map' in PIPELINE. A real transparent background is
still the thing to ask the AI for; this is the rescue path when it fakes one.

### Spritesheet tip (saves AI generations)

Ask the AI to put a **thin bright magenta (#FF00FF) line** between items
(magenta is safest — unlikely to appear in any drink colour).
Add `'separator': [255, 0, 255]` to the config. The script detects that color
and splits exactly there — no whitespace guessing, no debris.
The background stays white as normal; only the separator line changes.

### Source file conventions

- Individual images preferred over spritesheets (no split issues)
- White background from AI is fine
- Place raw files in `assets/source/<mapname>/`
- Run the script → `assets/images/` is updated
- PIPELINE `names` carry their output folder (`'farm/seed'`, `'shared/coin'`);
  `out_path()` creates the folder, so a new map needs no extra wiring

---

## Adding a new map

1. Create `assets/source/<mapname>/` and drop in AI images
2. Add entries to `PIPELINE` in `process_assets.py`
3. Add the background to `TARGETS` in `compress_backgrounds.py` and run
   `python compress_backgrounds.py` (backgrounds are served as WebP from
   `assets/images/<map>/`, never as the source PNG — see "Bandwidth")
4. Add a map entry in `config/maps.js` pointing to the new bg (`.webp`)/bgm/items
5. Add new drink tiers in `config/items.js` (sprite path, r, colors, bodyRatio)
6. Run `python process_assets.py --map <mapname>`
7. Set `ACTIVE_MAP = MAPS[n]` in `config/maps.js`

Optional per-map fields (see "Menu options"): `combos: true` to default the combo
checkbox on; `sizes: {large, small}` + `defaultSize` to offer a Large-table
toggle (drop the extra background master in `assets/source/<map>/`, add it to
`compress_backgrounds.py` and re-run it, point the `sizes` paths at the generated
`.webp`, then trace each size's boundary in the hitbox editor); `coin:` /
`bag:` to override the
shared coin/money-bag art with map-specific PNGs (omit to use the shared art);
`fx:` to add drifting ambient detail (see "Ambient background motion").
To theme the map's sounds, add a `SOUND_MAP` entry for it in the sound lab (see
tools/README.md) — a new map with no entry just inherits the default set, so
this can wait until the map plays well. Melody Lane (music shop) is the worked
example of all of these.

Temporarily hiding the Large-table toggle (e.g. its art isn't ready): comment
out the `sizes`/`defaultSize` lines — the checkbox keys off `map.sizes`, and if
`defaultSize` was the size that maps to the plain map-id key, no scores are lost.

---

## Adding new drink tiers

Edit `config/items.js`. Each item:

```js
{ name:'...',  r: 30,          // visual radius (drives BOTH draw size and physR)
  glass:'#hex', liq:'#hex',    // fallback colours if sprite missing
  sprite:'assets/images/drink-xxx.png',
  bodyRatio: 0.55,             // glass-body width / sprite height (measure from art)
  vis: 0.6 }                   // OPTIONAL visual-scale (default 1), physics-independent
```

`physR` is computed automatically: `r * 2.4 * bodyRatio / 2 * 0.88`

For non-circular art, leave `bodyRatio` as a rough default and give the item a
**capsule** hitbox in the editor instead (see "Capsule (stadium) item
hitboxes" in tools/README.md). The capsule params live in
`config/hitboxes.js`, not here.

**`vis`** scales only the DRAWN sprite (in drawDrink + the editor + the next
preview), not the physics body. Sprites are sized by HEIGHT (`r*2.4`), so wide
shapes (a harmonica, a trumpet) render huge unless scaled down. Set
`vis ≈ sqrt(0.75/aspect)` (aspect = art width/height) — this is **AREA parity**:
the item occupies the same on-screen footprint as a typical upright sprite of
its tier. Do NOT use the old `1/aspect` rule (extent parity) — it shrank very
wide items to slivers (the harmonica shipped at ~35% of its tier's footprint
and "felt tiny"; fixed 2026-07-10). items.js now `console.warn`s at load when
an item draws below half its tier's nominal area — check the console after
adding items. Default 1 = no change. NOTE: changing `vis` on an item that
already has a traced capsule rescales the ART ONLY — scale the capsule in
config/hitboxes.js by the same factor k (`w`,`h`,`dx` ×k; `dy` → k·dy +
0.75·(1−k), from drawDrink's bottom-anchored sprite placement), or re-trace it
in the editor.

`DROP_MAX` in `game.js` controls how many of the lowest tiers can be shot.
Currently 4 — increase when adding more tiers.

---

## Bandwidth (why the loading is structured this way)

The game is hosted on **GitHub Pages' free tier**, whose binding limit is a
**100 GB/month soft bandwidth cap** (plus a 1 GB site-size cap — we're at ~130MB,
a non-issue). Soft means GitHub emails and may throttle rather than hard-cutting,
but a throttle lands exactly when a shared link is doing well.

Audited 2026-07-26, before any fixes, one visitor cost **~27 MB** (20.6 MB before
even picking a map). That is ~3,800 visitors a month — low enough that a single
decent Reddit post could exhaust the month in an afternoon. Almost all of it was
waste rather than content:

| Fix | Saved |
|-----|-------|
| `<audio id="bgm">` `preload="auto"` → `"none"` (index.html) | 4.4 MB off the menu |
| Item sprites fetched per map, not all 9 chains (`loadItemSprites`) | ~10 MB |
| Coin/bag + Happy-Hour customer art no longer eager (render.js) | 2.9 MB |
| Backgrounds + menu/XP chrome PNG → WebP (`compress_backgrounds.py`) | ~2 MB/load, ~2.3 MB per map switch |
| BGM re-encoded 180–193 → 112 kbps (`compress_audio.py`) | 16.4 MB across the 8 tracks |

Result, measured: **menu first load 20.6 MB → 397 KB** (52×), and a full one-map
session **27 MB → 4.8-5.9 MB** (Mage, the heaviest, 33.6 → 9.6 MB). Visitor
headroom goes from ~3,800/month to **~17,000–21,000** on a typical map.

Once a session's art is a few hundred KB, the **BGM track IS the payload** — Mage
is still the outlier purely because `Arcane Sanctum.mp3` is 8 minutes long. If a
future map needs trimming, shorten the loop rather than dropping the bitrate again.

**Rules to keep it that way:**
- **Never fetch art for a map that isn't being played.** `config/items.js` builds
  every item's `Image` object and physR at startup (cheap, no network) but sets
  `.src` only via `loadItemSprites(items)`. `startGame()` calls it for the active
  chain, plus `RECEIPT_ITEMS` + `loadCustomerSprites()` when Happy Hour is on.
  Tools call it for whatever set they display (see `selectMap` in the hitbox
  editor). Anything that draws an item must tolerate a not-yet-loaded sprite —
  they all gate on `img.complete && img.naturalWidth` and fall back to the
  glass/liq colours, so art simply pops in when it lands.
- **Backgrounds ship as WebP**, generated from the PNG masters by
  `compress_backgrounds.py` (q82 backdrops / q92 for alpha UI chrome, since
  `xp-bar-frame` is sliced by `border-image` at fixed pixel offsets). New map or
  framing = drop the PNG master in `assets/source/<map>/`, run the script, point
  `bg:`/`sizes:` at the `.webp`.
- **Item sprites are deliberately still PNG.** Lazy loading already cuts them to
  ~1 MB per map, and lossy WebP with alpha risks haloing the carefully feathered
  edges the pipeline produces. Revisit only with a visual A/B.
- **BGM: `preload="none"` must stay.** `initMusic()` swaps `src` per map, so
  preloading only ever fetched a track most players never hear. Caveat worth
  knowing: an explicit `load()` call buffers anyway — Chrome treats it as intent
  and ignores the hint (measured). So `preload="none"` is what keeps the MENU
  audio-free; the chosen track then starts buffering at `initMusic()`, which is
  the right time. Don't read `preload="none"` as "nothing loads until play()".

**TODO — move hosting to Cloudflare Pages.** The payload work bought ~4× headroom;
it did not remove the cap. Cloudflare Pages' free tier has **unlimited bandwidth**
and a real CDN, deploys from this same GitHub repo, and needs no code change — so
it, not the byte-shaving, is what makes a Reddit-scale spike a non-question. Do
this before sharing the link anywhere broad. (Netlify's free tier is also
100 GB/month, so it buys nothing here.)

**BGM bitrate — DONE 2026-07-26.** All 8 tracks re-encoded from ~180–193 kbps VBR
to **112 kbps** by `compress_audio.py` (ffmpeg/libmp3lame): `assets/audio/`
40.8 MB → **24.4 MB**. Durations and stereo are unchanged and every track was
verified to decode to real audio (peak 0.75–0.96, RMS ~0.15) — not silence.
Originals are recoverable from git history if 112 ever sounds thin.

Two traps that script now handles, both of which cost real time:
- **`--check` is the only trustworthy bitrate reading.** These are VBR files whose
  FIRST FRAME HEADER advertises 64 kbps, which is not the average. An earlier
  version believed it and skipped all 8 files as "already small". The probe reads
  the Xing/Info frame count instead, validated against the browser's own
  `HTMLAudioElement.duration`.
- **`Melody Lane.mp3` had the Windows READ-ONLY attribute set** (alone among the
  8). `os.replace` onto a read-only target fails with WinError 5 — identical to
  the error a real file lock gives, so it looks like a stuck handle that no amount
  of waiting fixes. The script now distinguishes the two (`os.access(W_OK)`) and
  clears the flag. If a future asset script hits WinError 5 on Windows, check the
  attribute before hunting for the process holding the file.
- ffmpeg is NOT part of a fresh setup: `winget install --id Gyan.FFmpeg -e`.
  Re-running the script is safe — anything already at/below target is skipped, so
  generation loss can't stack.

---

## Known issues / decisions

- **Beer handle**: transparent (fill_holes works correctly with min_hole_px=300)
- **Fruit punch pitcher**: handle and under-umbrella are transparent (same)
- **Canvas resolution**: rendered at MAX_SCALE=1.6× DPR so the browser never
  upscales — this fixes the blurriness on desktop
- **Render heat optimizations (deliberate — don't "clean up")**: the map
  background is a DOM layer (`#stage-bg` div) UNDER a transparent canvas —
  rastered once by the compositor per map load; the render loop only
  `clearRect`s and draws dynamic content (never blit a background onto the
  game canvas); the game ctx uses `imageSmoothingQuality:'low'`; the circular
  drink shadow is ONE cached 256px sprite (`SHADOW_SPRITE`) blitted scaled,
  never a per-frame `createRadialGradient`; combo text pops are pre-rendered to
  a per-pop canvas at spawn (`spawnTextPop`) so `shadowBlur` never runs in the
  frame loop. Remaining known levers if heat returns: re-enable the shelved
  cool mode (30fps), rate-limit `clink()` node creation.
- **Collision sounds**: synthesised via Web Audio API (no files). This is intentional —
  instant, zero-size, procedurally variable by tier.
- **A GainNode defaults to 1.0, so set `.value` as well as `setValueAtTime`**
  (fixed in `sfxNoise`, config/sounds.js, 2026-08-08). A param event only takes
  effect FROM its time `t`; a source started at the same `t` can have its first
  sample rendered a hair earlier, at the default gain — i.e. one full-scale
  sample, a broadband click. Voices call `sfxNoise` with `when = a.currentTime`,
  which is never sample-aligned, so this fired at random: bursts intended to
  peak at 0.013 measured 0.84. **Measure new voices by rendering them through
  an `OfflineAudioContext`** and comparing peak AND rms against the existing
  ones — it catches this class of bug, and levelling by ear through a hidden
  preview tab is not possible anyway. Match rms, not peak: short bright
  transients (the coin-metal family) need a much higher peak than a bell to sit
  at the same loudness.
- **iOS SFX routing (diagnosed on Mai's iPad 2026-07-20, fix confirmed)**: iOS
  puts Web Audio's `ctx.destination` on the RINGER/alerts volume channel —
  with that channel at zero, all synth SFX are silent while `<audio>` music
  (media channel) plays fine, even though the context reports
  `state:running` with an advancing clock. Therefore every synth connects to
  the master `sfxBus` gain (never `ctx.destination` directly); on iOS the bus
  pipes through `createMediaStreamDestination()` → a playsinline `<audio>`
  element (media channel), elsewhere straight to destination. `resumeCtx()`
  restarts both the context and the carrier element (iOS pauses media
  elements on background). The 🐞 bug panel has a built-in sound check:
  Beep 1 = raw `ctx.destination` path (silent on affected devices — expected),
  Beep 2 = element path, plus a diag line (`state/rate/clock/out/track/...`).
- **iOS SFX die after backgrounding mid-run (fixed 2026-07-26)**: backgrounding
  the page ENDS the MediaStream track feeding the SFX carrier above, and it
  never recovers — the `<audio>` still reports `paused:false` while its stream
  is dead, so the old `if (sfxEl.paused) play()` guard was a no-op and neither
  `resume()` nor `play()` helped. Music recovered from a double-tap only
  because `bgmEl` is a plain file-backed element. ONLY a fresh
  `createMediaStreamDestination()` + `<audio>` restores SFX (a page reload
  used to be the sole cure, costing the run). Now: `markAudioInterrupted()`
  (game.js visibilitychange) / `onstatechange` / `pageshow[persisted]` set
  `sfxStale`, and the next TAP calls `rebuildSfxRoute()` — rebuilds happen in
  a gesture because a new element may need one to play. A context that comes
  back reporting `running` with a stalled render clock is caught by
  `checkAudioHealth()` (samples `currentTime` 400ms later) and flagged for
  `hardResetAudio()`, which closes and recreates the whole context on the next
  tap (safe: every synth grabs `ac()`/`sfxBus` at call time). Manual escape
  hatches, both calling `repairAudio()`: toggling the HUD sound button back ON,
  and the bug panel's **Fix sound** button — neither loses the run.
  Verified by measuring the carrier stream with a second AudioContext:
  healthy 0.24 peak → track stopped 0 → old resume+play still 0 → after one
  tap 0.24 again.
- **iOS drops the decode of Images it hasn't painted lately — BAKE RARELY-DRAWN
  ART INTO A CANVAS (fixed 2026-07-29)**: Happy Hour customers on Mai's iPad
  appeared as an order bubble with an empty space under it, flickering in and
  out. WebKit purges the decoded pixels of an `Image` that is not in the render
  tree and has not been drawn recently, and `drawImage()` of a purged Image
  paints NOTHING for the frames the async re-decode takes. The cast is the worst
  case for that policy: `loadCustomerSprites()` loads 18 faces but only 3 are on
  screen, so 15 sit cold and an arriving customer is nearly always a face
  nothing has painted in a minute. Fix: `bakeCustomer()` (render.js) copies each
  face into an offscreen canvas on load and `drawCustomers` blits THAT —
  a canvas backing store is a retained buffer, not a purgeable decode cache.
  Verified by destroying every `CUSTOMER_IMGS` entry and re-rendering all 18
  faces: unchanged. Item sprites are exempt in practice (drawn every frame, so
  they stay hot), but **any art drawn rarely wants the same treatment** — this
  is the same pattern as `SHADOW_SPRITE`. Costs ~5MB resident for the cast.
  Two things this also fixed, both real on their own: nothing invalidated the
  idle-frame skip when art finished loading, so a sprite landing on a settled
  board stayed missing until the next shot (now `wakeRender()` in game.js); and
  a dropped fetch left a permanently empty slot, so loads get one retry.
  **Why it looked like the v2026-07-29 deploy caused it:** the 9→18 cast landed
  on main on 2026-07-26 WITHOUT a cache-buster bump, so every device kept the
  9-face `config/items.js` at `?v=79` until `?v=80` shipped. Pushing a config
  change to main without bumping `?v=` doesn't ship it — it arms it for the
  next deploy, which then gets blamed. Bump `?v=` in the SAME commit as a
  `config/*.js` change, even when not deploying.
- **Node.js IS installed** (`C:\Program Files\nodejs\node.exe`) — corrected
  2026-07-29; this line used to claim it wasn't, and that stale fact was
  load-bearing for "what could we build the tools with" questions. Serving is
  still `python serve.py` (see "Running the game locally") — it carries the
  no-cache header `npx serve .` does not. `cargo` is NOT installed, so anything
  Rust-based (Tauri) needs a toolchain first. WebView2 is present.
- **The dev tools stay browser pages — no standalone/Electron app** (decided
  2026-07-29, after the question was raised properly). The reason is fidelity,
  not effort: the tools' worth comes from running the GAME'S OWN code. The sound
  lab plays `config/sounds.js` itself (the previous lab kept hand-copied synth
  voices and they drifted from audio.js — deleting that duplication was the
  design win), the hitbox editor's test mode runs real Matter.js, and its wall
  drawing shares the perspective math with render.js. A non-browser app must
  either reimplement those three — recreating exactly the drift bug that was
  fixed — or embed a browser engine, at which point it is a browser with better
  file access, bought with a build step and a packaged artifact in a repo whose
  ethos is "no build step, no framework". It would also kill the `?dev=1` route
  that reaches the tools from an iPad.
  **If picker friction ever justifies more work, the answer is a scoped local
  endpoint, not an app**: generalise `tools/shot-receiver.py` into `serve.py` as
  `GET /_dev/ls` + `POST /_dev/write`. That closes the one thing the browser
  genuinely cannot do — DIRECTORY LISTING, the only reason the sprite editor
  needs a directory handle at all — in ~40 lines, with no build step and no
  second artifact. (Since 2026-08-16 the sprite editor no longer needs a handle
  merely to SHOW the library: with none picked it browses the paths named in
  config instead — see "no folder picked" in tools/README.md. A handle is still
  the only way to see art that no map references yet, so the argument above
  stands, just with less urgency.) It is NOT free, though, and this is the part to think about
  before building it: a standing write API has ambient authority (any page open
  in the browser can POST to it — note `shot-receiver.py` sets
  `Access-Control-Allow-Origin: *` with no origin check, fine for a one-shot
  capture, not for a permanent endpoint), so it needs path-whitelisting under
  the project root and an Origin check. The File System Access picker IS the
  consent model, which is why it stays the default and the offline fallback.
- **Screenshot/rAF time-outs: the preview tab is often HIDDEN** (root cause,
  diagnosed 2026-07-10 — the old "rAF pages block capture" theory was wrong).
  When the Browser pane isn't open on screen, `document.hidden === true`: the
  renderer commits no frames, so `preview_screenshot` waits forever AND any
  `preview_eval` that awaits `requestAnimationFrame` hangs (30s timeout).
  Check `document.hidden` first when captures/evals stall. Hidden-tab-safe
  verification: everything synchronous still works — call `render(1)` /
  `Matter.Engine.update` directly, assert with `getImageData`, and for a real
  screenshot composite `#stage-bg` + the game canvas into a temp canvas and
  `toDataURL`. **Get the image OUT via `tools/shot-receiver.py`** (run it in
  the background, then `fetch('http://127.0.0.1:5599/', {method:'POST',
  mode:'no-cors', body: dataURL})` from the page — works even hidden). Do NOT
  return the base64 through the eval result: big results get spilled to an
  awkward JSON file, and hand-copying base64 between tools corrupts it
  (both burned real time on 2026-07-12). If the user opens the Browser pane,
  a normal screenshot works.
- **Read-tool image preview composites transparent PNGs on a dark background** —
  a properly-transparent sprite/grid can look like it has "a painted dark
  backdrop with glows". Do NOT conclude transparency failed from the preview:
  check `img.mode` + alpha stats (fraction with alpha==0) and run
  `split_alpha_grid` before telling Mikael the art is broken. (This burned us
  twice.)
- **Preview env has a degenerate `innerHeight`** — the hitbox editor's display
  scale `S` comes out invalid there, so synthetic *screen-coordinate* mouse
  events don't map to the right world point. Test the editor's LOGIC directly
  (drive state/handlers) rather than dispatching coordinate-based events.
- **AI restyle-regeneration shrinks/simplifies detail** — asking ChatGPT to redo
  an existing item grid in a new finish comes back smaller and less intricate
  than a first-pass gen. Nail the target STYLE in the first prompt (or attach an
  existing game sprite as a style reference) rather than iterating a restyle.
- **Deploy checklist**: bump BOTH `GAME_VERSION` in config/constants.js (to
  today's date — shown on the welcome screen so Mai can verify she's current)
  AND every `?v=` cache-buster in index.html. Stale-cache bugs are frequent
  otherwise. localStorage (high scores) survives deploys; never clear it.
- **Hitboxes**: `config/hitboxes.js` is generated by tools/hitbox-editor.html —
  never hand-edit it or the legacy inline `cornerWalls`. The horizon
  (perspective vanishing row) is per-boundary: drag the red line in the editor,
  saved as `horizon` and applied by startGame(). Splines may cross it, but
  walls above it are unreachable in-game (balls stop at physics y=0). Boundaries
  are keyed per size variant (`hitboxKey()`) — a size-variant map has one entry
  per framing in the config (e.g. `kyoto` + `kyoto__small`).
- **Sprite extraction**: separator auto-detection fails when items are purple
  (reads as magenta) — measure grid-line positions and hardcode
  `col_splits`/`row_splits`. Mage art is temporary; plan is to regenerate with
  transparent backgrounds (see memory/workflow-sprites).
- **Windows console is cp1252**: no `→`/`—`/emoji in Python print output.
- **PowerShell 5.1 eats double quotes in native-command arguments.** It re-joins
  args into one command-line string for `git`/`python`/etc. without escaping an
  embedded `"`, so the quote closes PowerShell's own wrapper early. Measured:
  `'he said "already small" here'` arrives as TWO args, `[he said already]` and
  `[small here]`. Two failure modes, and the second is the dangerous one:
  *loud* (the extra arg is rejected — a `git commit -m` becomes a bad pathspec),
  or *SILENT* (the quotes simply vanish and the command succeeds). Commit
  `9a3248a` lost every `"` in its message that way, unnoticed until checked.
  So: pass anything multi-line or quote-bearing through a FILE —
  `git commit -F msg.txt` — or use the Bash tool with a heredoc. Both are immune.
  Paths with spaces are NOT affected (single-quoted or via a variable, they
  arrive intact) — don't over-correct for those. PowerShell 7 fixes the
  underlying bug (`$PSNativeCommandArgumentPassing`), but installing it changes
  nothing here: the harness invokes `powershell.exe` 5.1, not `pwsh`.
- **`hidden` loses to any author `display` rule** — `[hidden]{display:none}` is a
  UA rule of the same specificity as a class, so an author `.x{display:flex}`
  wins and the element stays visible with `hidden` set. The sound lab's
  "unsaved picks restored" banner showed on every load because of exactly this
  (2026-07-26). Any element toggled via `hidden` needs an explicit
  `.x[hidden]{display:none}`. Checking `el.hidden` does NOT catch it — assert on
  `offsetHeight`/`getComputedStyle`, not the attribute.
- **All three tools set `<base href="../">`** so they can load `config/*.js` from
  the real project. Anything a tool references — its own stylesheet, scripts,
  sibling tools — must therefore be written relative to the PROJECT ROOT
  (`tools/tool.css`), not to `tools/`. A bare `tool.css` silently 404s.

---

## Game mechanics

- Physics world: 420×620, gravity disabled (top-down billiards style)
- Perspective transform applied at render time (not physics time)
- Drinks are shot from LAUNCH point (bottom-centre, slides toward aim X)
- Two drinks of the same tier merge → next tier + coin reward + particle burst
- **Merge products GROW IN physically** (makeDrink `growIn` flag): the body
  spawns at 0.6 scale and is Body.scale'd to full over 200ms, in step with the
  sprite's grow animation. Without this, a full-size body materialising inside
  a packed pile got separated by Matter's position solver in one violent
  position shove (up to ~47px/frame with the largest capsules — the "pile
  teleport" that made Melody Lane feel inconsistent). Keep this for all future
  maps/shapes; it's what keeps merge feel uniform regardless of item size.
  (Investigated 2026-07-10: capsule item physics itself measured equivalent to
  circles; per-map wall "bounciness" differences largely vanish once the ghost
  free-shot mechanic is accounted for.)
- Optional combo multipliers (per-run, menu checkbox): fast successive merges
  stack a score multiplier (`COMBOS_ENABLED` in game.js)
- Game over: any drink settled above the danger line for >1.5s at speed <0.15.
  The line's height is per-boundary (`dangerLine` in config/hitboxes.js, dragged
  in the hitbox editor); default physics H-150. It has no effect on ghost
  activation — that stays the free line's job.
- Score: coin count (10 coins per merge, more for higher tiers). Beating a
  variant's best triggers a fanfare + banner on the game-over screen.

---

## Tech stack

- Matter.js 0.19 (CDN) — physics
- Canvas 2D API — rendering
- Web Audio API — sound effects
- Python + Pillow + NumPy — asset pipeline
- No build step, no framework, vanilla JS modules via script tags
