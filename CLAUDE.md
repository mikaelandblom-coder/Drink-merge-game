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
config/maps.js        — MAPS array + ACTIVE_MAP (bg, bgm, bgmVol, items ref,
                         optional sizes/combos); hitboxKey() + applies
                         MAP_HITBOXES overrides at the bottom
scores.js             — Per-variant high scores in localStorage; scoreKey() maps a
                         (map, size, combos) run to a storage key
buglog.js             — Bug-report capture: rolling ring of the last 10 shots
                         (each with the pre-shot board) + game-over events →
                         copyable MMB1. code via the 🐞 HUD button. Replay a
                         code with TT.bug / TT.bugLoad in test mode.
config/sounds.js      — SOUND_LIB: every synth voice in the game, one entry each
                         (`play(a, out, opts)`) — the single source of truth for
                         HOW a sound is made. A voice renders into the `out` node
                         it is handed and must NEVER touch ctx.destination
                         (iOS routing — see "Known issues").
config/soundmap.js    — SOUND_MAP: WHICH voice each map plays for each event
                         (merge/collide/coin/shoot/gameOver/best/levelUp), over a
                         `default` row every map inherits. Pure data, generated
                         by tools/sound-lab.html — see "Sound editing" below.
audio.js              — Audio PLUMBING only: output routing (incl. the iOS
                         workarounds), mute/music toggles, BGM, and a thin
                         dispatch from a game event to the active map's voice
                         (pop/clink/coinTick/shoot/fanfare/levelUp/gameOver all
                         one-liners over `playSound`). No synthesis lives here.
render.js             — All canvas drawing (bg, drinks, coins, bag, particles,
                         aim); `drawXray` is the player-facing X-ray diagnostic
                         (see "X-ray" below), separate from the dev `drawHitboxes`
ui.js                 — Pointer input, HUD buttons, game-over overlay, LAUNCH pos
welcome.js            — Main menu: map cards, size/combo checkboxes, score lists
game.js               — Physics engine, state object, merge logic, render loop
style.css             — All CSS
index.html            — Shell: loads scripts in order (constants → hitboxes →
                         items → maps → sounds → soundmap → scores → buglog →
                         audio → render → ui → welcome → game)
process_assets.py     — Asset pipeline: source images → game-ready PNGs
compress_backgrounds.py — Background/chrome PNG → WebP (~-91%). Separate from
                         process_assets.py because backgrounds need no keying,
                         only recompression. See "Bandwidth".
compress_audio.py     — BGM mp3 → 112 kbps (ran 2026-07-26: 40.8→24.4 MB).
                         `--check` reports the true AVERAGE bitrate with no
                         ffmpeg (these files are VBR, so the first frame header
                         lies); re-encoding needs ffmpeg. Idempotent.
tools/
  hitbox-editor.html  — Visual hitbox editor (see "Hitbox editing" below)
  sprite-editor.html  — Visual sprite prep: AI sheet -> individual PNGs, then
                         PNGs -> an items.js tier chain (see "Sprite editing")
  sound-lab.html      — Sound library + wiring board: audition every voice and
                         assign one per map+event (see "Sound editing" below).
                         Loads config/sounds.js + config/soundmap.js from the
                         real project, so it plays exactly what the game plays.
  tool.css            — Shared look for ALL tools: tokens (--bg/--panel/--accent
                         /--line/--muted…) + the primitives they had each
                         restyled separately (buttons, .tabs, fieldset/legend,
                         inputs, .hint/.row/.val/.readout/.chip). A tool's own
                         <style> should hold only its LAYOUT and its own
                         components. Signal colours are deliberately NOT themed —
                         see the comment at the top of the file.
  tool-nav.js         — Tool switcher. A tool marks its mount point with
                         `data-toolnav="<id>"` and gets pills for the others,
                         PLUS its browser-tab icon (same emoji, as an SVG data
                         URI) so several open tools stay tellable apart. Adding
                         a tool = one line in TOOLS. Hrefs are relative to the
                         PROJECT ROOT because every tool sets <base href="../">.
                         Data-URI favicons are fine here but NOT for the game —
                         iOS Safari ignores them (see index.html's icon note).
  shot-receiver.py    — Local POST receiver for canvas screenshots from the
                         (often hidden) preview tab — see "Known issues".
assets/
  source/             — Raw AI-generated images (white background). NEVER edit these.
                         Backgrounds live here as the ~2.5MB PNG masters, but are
                         NOT served: compress_backgrounds.py emits a ~200KB WebP
                         into images/<map>/ and config/maps.js `bg:` points there
                         (see "Bandwidth" below).
    _archive/         — Superseded source art, kept for reference
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
                        moving it risks breaking that for no gain.
```

---

## Hitbox editing

Open **http://localhost:5500/tools/hitbox-editor.html** (same server as the game).

Pick a map from the top **Map** dropdown, then choose **Background** or
**Merge items**. The dropdown also has a map-less **"Happy Hour — Receipts"**
entry for the shared receipt chain: it opens the item tab directly (the
Background tab is disabled — receipts have no boundary of their own) and its
overrides save to `ITEM_HITBOXES` like any other item.
- **Background tab:** edit the boundary as a Catmull-Rom spline — drag knots,
  double-click the curve to add a knot, double-click a knot (or Del) to remove.
  Three draggable horizontal lines: **horizon** (red), **free-shot line**
  (green), **danger line** (white, game-over threshold — saved as `dangerLine`
  per boundary; never dragged = game default, physics H-150). The nearest line
  to the pointer wins the grab; zoom in to separate close lines.
  The magenta shapes are the actual perspective-corrected physics walls,
  regenerated live. "Enter test mode" runs real Matter.js physics: click to
  shoot balls at the boundary exactly like in the game. Size-variant maps show a
  **framing** selector here (one boundary per framing).
- **Merge items tab:** shows **all of the map's items at once** at true relative
  scale, so hitbox sizes are comparable across tiers. Click an item to select;
  drag its circle **edge/square** to resize (bodyRatio) or **inside** to move
  (dx/dy offset). Scroll to **zoom** toward the cursor, drag empty space to
  **pan**, double-click to reset zoom (needed to tune small circles precisely).
  Each item can instead use a **capsule** hitbox (see below) via the
  **Switch to capsule / circle** button — for non-circular art where a circle
  leaves too much sprite uncovered (drinks visually overlap when packed).
- **Save:** writes `config/hitboxes.js` (File System API asks for the file once,
  then overwrites on every save). Reload the game tab to play with the result.
- **Unsaved work:** nothing is persisted until you export, so the sidebar shows a
  `saved` / `unsaved changes` pill and leaving the page prompts for confirmation.
  Every edit funnels through `changed()` (boundary) or `pushItemHB()` (items) —
  route any NEW edit path through one of those, or the guard won't see it. All
  three exports (Save / Download / Copy) clear it, since each produces the
  complete file; a failed clipboard write correctly leaves it lit.

**Capsule (stadium) item hitboxes.** A second per-item primitive alongside the
circle, for elongated/non-circular art (guitars, violins, saxes). Toggle it with
the **Switch to capsule** button in the item tab, then:
- **RIGHT** square handle = length, **TOP** square = thickness, **knob on the
  stalk** = rotation, drag inside = move (dx/dy, shared with the circle).
- Saved to `ITEM_HITBOXES[sprite]` as
  `{ shape:'capsule', w, h, rot?, dx?, dy? }` — `w`/`h` are half-extent fractions
  of sprite height (same scaling as `bodyRatio`, so a square capsule ≈ the
  equivalent circle); `rot` is radians (omitted when 0).
- In-game (`makeDrink`) it is a **chamfered rectangle locked at its authored
  angle** (`inertia: Infinity`) — it never spins, so the upright sprite never
  drifts from its body (`drawDrink` ignores `body.angle` — see below). `rot`
  only tilts the HITBOX to follow diagonal art; the sprite is NOT rotated.
- `physR` for a capsule is its **vertical projection** (`|hw·sinθ|+|hh·cosθ|`),
  so the danger-line / shadow keep working. The stadium shadow in `render.js` is
  orientation- and rotation-aware.
- Melody Lane is the worked example — every instrument uses a capsule, several
  rotated. Existing circle items are untouched (capsule is opt-in; no capsule =
  `item.cap` is null and the old `Bodies.circle` path runs).

The game consumes hitboxes via `MAP_HITBOXES` / `ITEM_HITBOXES` in
`config/hitboxes.js`; the spline knots are stored alongside the generated walls
so the editor can always re-edit from where you left off.

**Size variants in the editor:** maps with a `sizes` field (see "Menu options"
below) appear once per framing in the dropdown, e.g. "Kyoto — Large" and
"Kyoto — Small". Each loads its own background and edits its own boundary under
a distinct `MAP_HITBOXES` key (`hitboxKey()` in maps.js): the default size keeps
the plain map id (`kyoto`), the other size gets a suffix (`kyoto__small`). Until
a size is traced it falls back to the map's base boundary — so trace + save each
new size once. Item-tab targets are per-item and unaffected by size.

---

## Sprite editing

Open **http://localhost:5500/tools/sprite-editor.html** (same server as the game).
Two INDEPENDENT modules that share only the folder of PNGs on disk — so
multiple AI sheets need no "combine" step: extract each one, then the tier
chain picks freely across everything in the folder.

**1 · Extract** — load one AI sheet → individual transparent PNGs.
Everything renders on a **checkerboard** with an alpha readout (`% fully
transparent`), which is the standing antidote to the Read-preview trap where a
good transparent sheet looks like it has a painted backdrop. Cells come from
the transparent gutters (a live JS port of `split_alpha_grid`), so grid drift
is fine; the sliders (gutter alpha / min px / merge gap / min band) tune band
detection when glow bridges a gutter. Each item is then isolated by
**connected component flood-fill**, not by rigid grid lines — the fix for a
neighbour's stem poking into the cell. "keep parts ≥" is the floor for
genuinely separate pieces (a violin bow ≈ 13% of the item, stray specks ≈ 1%);
rejected blobs are excluded from the feather pass so they can't reappear.
"Strip baked shadow" raises the core threshold to 128 (the game draws its own
`SHADOW_SPRITE`, so a baked one double-shadows). Save writes the PNGs straight
into a folder you pick once.

**2 · Tier chain** — pick **assets/images/** as the root and browse it as a
folder tree (📁 to descend, ↰ or the breadcrumb to go back up), since the
sprite folder is map-based. A tier stores its path RELATIVE to the root
(`farm/seed.png`), so one chain can mix a map's items with something from
`shared/`. Pick which PNG is which tier, drag to reorder, then write
`config/items.js`. `r` belongs to the SLOT, not the item, so a drag re-assigns
the chain's existing r values smallest→largest — a hand-tuned ladder survives a
reorder. "Reset r ladder" regenerates a plain geometric 15→71 ramp instead, so
it is for NEW chains: the shipped maps are hand-tuned and it will retune them.
`vis` is the per-item rescale
(visual only, physics untouched) and auto-fills to area parity
`sqrt(0.75/aspect)`; a ⚠ appears when an item would draw under 45% of its
tier's footprint, mirroring the load-time guardrail in items.js. `glass`/`liq`
fallback colours are sampled from the art. "Load existing" pulls a shipped
chain back in for retuning.

Two things it deliberately does NOT own:
- **bodyRatio** — `config/hitboxes.js` is the authority (the hitbox editor
  writes it, and items.js overwrites the in-memory value from it at load). The
  tool re-reads the AUTHORED literal out of items.js source when loading a
  chain, so a write-back can never launder a hitbox override into items.js.
  New items get a 0.85 placeholder to tune in the hitbox editor afterwards.
- **process_assets.py** — still the path for the legacy chroma-key maps and
  shared art. For transparent grids (the standard) the editor replaces it.

**`showSaveFilePicker` TRUNCATES the file you pick, at pick time.** Any tool
that needs to READ-MODIFY-WRITE an existing file must use
`showOpenFilePicker` + `requestPermission({mode:'readwrite'})` instead — with
the save picker the file is already zero bytes by the time you read it, so
there is nothing to merge into. This wiped `config/items.js` on 2026-07-26
(recovered from git + re-applying the path migration). The hitbox editor may
keep using the save picker: it never reads, it always writes a complete file
from in-memory state. The sprite editor also refuses to write a result much
smaller than the file it read, as a backstop.

Writing is surgical: it replaces only the one `const X_ITEMS = [ … ]` block, or
appends a new chain and registers it in the pre-load spread; CRLF and authored
numeric precision (`bodyRatio:0.634` stays 0.634) are preserved. Verified by
round-tripping the shipped chains back to identical values, and by extracting
`farm/items_combined.png` to within a few px of the hand-made sprites.

---

## Sound editing

Open **http://localhost:5500/tools/sound-lab.html** (same server as the game).

Sound is split in two, the same way hitboxes are split from items:
`config/sounds.js` holds **how** each sound is made (`SOUND_LIB`, one voice per
entry), `config/soundmap.js` holds **which** voice each map plays for each event
(`SOUND_MAP`). `audio.js` is plumbing — it looks up the active map's voice and
renders it into `sfxBus`. The lab loads those same two files from the project
root (via `<base href="../">`), so an audition there IS the game's sound; the
old lab's hand-copied synth duplicates (which drifted from audio.js) are gone.

- **Wiring board** — a map × event matrix. Every cell is a dropdown of the
  voices valid for that event plus a ▶ that plays it the way the game fires it
  (a merge plays the map's whole chain as a combo cascade, a collision plays
  soft → medium → hard, coins play a full payout shower). Changing a dropdown
  auditions it immediately. The top **All maps** row is `default`: a map only
  stores an event when it wants something else, so editing the default row moves
  every map still inheriting it, and a new event added to `default` applies
  everywhere at once.
- **Library** — all voices grouped by event kind, each with its description, the
  maps currently using it, and audition controls. Pick a **context map** at the
  top: tier buttons then show that map's real items (name + sprite) and the
  right tier COUNT, so a 5-tier chain isn't auditioned as 9. **Use for &lt;map&gt;**
  assigns the voice to the context map; **Use for all maps** sets the default.
- **Save** rewrites `config/soundmap.js` whole from memory — never
  read-modify-write, so the `showSaveFilePicker` truncation trap can't bite (see
  "Sprite editing"). Unsaved picks survive a reload via localStorage and are
  offered back with a Discard button; **Revert** restores what's on disk.
  Firefox has no file picker — copy the generated text at the bottom instead.

The Mai-feedback loop: set the context map, play the alternatives, click
**Use for &lt;map&gt;**, Save, bump the `?v=` in index.html. No code change.

**Adding a NEW sound** is the only part that is still code: add an entry to
`SOUND_LIB` in config/sounds.js with a `kind` matching one of `SOUND_EVENTS`,
and it appears in the lab automatically — in every dropdown of that kind and as
a library card — with no wiring anywhere else. The voice contract is
`play(a, out, o)` where `o` carries `when` (absolute start time — schedule
everything from it, never `a.currentTime`), plus `tier`/`tiers` for merges,
`impact` for collisions, and `index` for coins (the coin's position in the
current payout shower; audio.js counts the run, so climbing-run voices like
`coin-pentatonic-run` stay stateless). Connect to `out`, never
`a.destination` — that is what keeps iOS SFX on the media volume channel.

## Art prompts for merge-item grids

**Paris is the bar** — its item art is the best in the game, so its prompt is the
template for every new map. Goal for all future maps: colourful, inviting,
appealing. The shipped Paris prompt, and the six slots that made it work:

> A 3×3 sprite grid of 9 French pâtisserie items on a fully transparent
> background, PNG with alpha. Cute, elegant pastel storybook style: soft rounded
> plump shapes, gentle glossy highlights, pastel pink / cream / mint / lavender
> palette, subtle warm outlines. NO drop shadows, NO background, generous empty
> gaps between items so nothing touches. Row 1: a single sugar cube; a pink
> macaron; a petit chou cream puff dusted with powdered sugar. Row 2: … Row 3: …
> All items front-facing, consistent lighting from above, consistent style and
> level of detail across all nine.

1. **Grid + transparency** — proven wording, don't paraphrase.
2. **Style sentence** — 2–4 adjectives + surface finish + outline treatment.
3. **Pipeline constraints** — NO drop shadows, NO background, generous gaps.
   Technical, not taste: a shadow bridging a gutter breaks the band detection in
   `split_alpha_grid` / the sprite editor's extract tab.
4. **Row-by-row enumeration, one concrete named item per cell** — specificity is
   what stops the sheet drifting into mush. Row-major = TIER ORDER, which is also
   how the sprite editor's tier chain reads the folder.
5. **Escalating elaboration** across the rows, finale last.
6. **Consistency clause** — front-facing, light from above, same level of detail.

Three things Paris only got by luck or by a second generation — **bake these into
prompt #1**:
- **Plan the colour ladder in the prompt.** Paris pass 1 came back all red/brown/
  pink because the subject list AND the style line named one palette family; it
  took a reroll ("more varied colors … its almost all red brown and pink now") to
  fix. Name a colour per item and spread nine hues around the wheel, with no two
  ADJACENT tiers in the same family. This is gameplay, not decoration: at r15–r30
  hue is what tells the player two drinks match. Farm's chain is the worked
  example (brown→green→red→blue→orange→yellow→purple→orange→gold).
- **"Compact, front-facing, centred, roughly as tall as it is wide."** Paris got
  this free (pastries are round). Wide art needs `vis` rescaling and still reads
  small; non-round art needs capsule hitboxes — the main reason Melody Lane is the
  least-loved map.
- **Attach a shipped Paris sprite as a style reference** — locks cross-map
  consistency better than adjectives.

Reroll policy: a PALETTE nudge is cheap and safe; a whole-FINISH restyle is not
(it shrinks subjects and simplifies detail — see "AI restyle-regeneration" under
Known issues). Generations are limited, so nail style + colour spread in pass 1.

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
`XP_A` can be retuned without migration. `XP_A = 60` is PROVISIONAL: the
game-over "+N XP" line is literally shots-per-run, so calibrate it from a few
real runs (target: level 1 after the first normal run).

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

---

## Running the game locally

Python is installed. Start a local server from the project root:

```
python -m http.server 5500
```

Then open http://localhost:5500 in a browser.

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
shared coin/money-bag art with map-specific PNGs (omit to use the shared art).
To theme the map's sounds, add a `SOUND_MAP` entry for it in the sound lab (see
"Sound editing") — a new map with no entry just inherits the default set, so
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
**capsule** hitbox in the editor instead (see "Capsule (stadium) item hitboxes"
under Hitbox editing). The capsule params live in `config/hitboxes.js`, not here.

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
- **No Node.js installed**: use `python -m http.server 5500` to serve locally.
  Install Node.js to use `npx serve .` and enable the Claude Code preview panel.
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
