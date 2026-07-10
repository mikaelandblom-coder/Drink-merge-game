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
audio.js              — Web Audio API synthesis (pop, shoot, clink, coinTick,
                         fanfare) + BGM. pop/clink/coinTick are per-map via
                         `soundProfile` (wood/ceramic/arcane/plush/music); add a
                         profile branch + synth fns to theme a new map's sounds.
render.js             — All canvas drawing (bg, drinks, coins, bag, particles, aim)
ui.js                 — Pointer input, HUD buttons, game-over overlay, LAUNCH pos
welcome.js            — Main menu: map cards, size/combo checkboxes, score lists
game.js               — Physics engine, state object, merge logic, render loop
style.css             — All CSS
index.html            — Shell: loads scripts in order (constants → hitboxes →
                         items → maps → scores → audio → render → ui →
                         welcome → game)
process_assets.py     — Asset pipeline: source images → game-ready PNGs
tools/
  hitbox-editor.html  — Visual hitbox editor (see "Hitbox editing" below)
  sound-lab.html      — Standalone sound-audition sandbox (open in the same
                         server). Prototype/compare synth sounds here BEFORE
                         wiring them into audio.js — used to design the music
                         map's merge/coin/collision/personal-best sounds.
assets/
  source/             — Raw AI-generated images (white background). NEVER edit these.
    _archive/         — Superseded source art, kept for reference
    shared/           — coins_and_bag.png (shared across all maps)
    tikibar/          — Per-map source images
  images/             — Processed output used by the game (git-committed)
```

---

## Hitbox editing

Open **http://localhost:5500/tools/hitbox-editor.html** (same server as the game).

Pick a map from the top **Map** dropdown, then choose **Background** or
**Merge items**:
- **Background tab:** edit the boundary as a Catmull-Rom spline — drag knots,
  double-click the curve to add a knot, double-click a knot (or Del) to remove.
  The magenta shapes are the actual perspective-corrected physics walls,
  regenerated live. "Enter test mode" runs real Matter.js physics: click to
  shoot balls at the boundary exactly like in the game. `side inset` moves the
  straight left/right walls (negative = wider field). Size-variant maps show a
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

## Menu options — size variants & combos

Each map card in the main menu can carry two per-map checkboxes, both remembered
in localStorage and passed into `startGame(map, {size, combos})`:

- **Large table** (only for maps with a `sizes` field in config/maps.js). Swaps
  the background art between framings; `defaultSize` sets the initial state
  (Kyoto → large, Plushie → small). Each size has its own hitbox (see above) and
  its own high-score board. Backgrounds are produced by the asset pipeline (extra
  `copy` entries, e.g. `bg-kyoto-small`, `bg-teddy-large`).
- **Combo multipliers** (every map). Cascade-merge score multipliers. The map's
  `combos: true` is now just the *default* checkbox state (on for Mage Tower &
  Plushie Factory), not a hard setting — `COMBOS_ENABLED` is set per run.

**Cool mode (30 fps cap) — built but SHELVED.** The welcome-screen checkbox is
commented out in index.html (with its wiring in welcome.js), and startGame pins
`coolMode = false`. The game.js machinery is intact: it halves the render rate
but keeps the physics step size (twice the substeps per frame), so game speed
and collision quality are unchanged. Re-enable by restoring the index.html
block + welcome.js wiring + the localStorage read in startGame. It remains the
biggest thermal lever if the DOM-layer background isn't enough.

## High scores

Scores are stored **per variant** (table size × combo state) via `scoreKey()` in
scores.js. To avoid a migration, the DEFAULT variant keeps the legacy
`mm_s_<mapId>` key (so pre-existing scores are untouched); non-default variants
get a suffix (`mm_s_kyoto__small_combo`). Menu cards show every variant's top 3
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

The `.claude/launch.json` is configured for this command — the preview panel
should work directly.

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
| `copy` | background images — no processing |

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

---

## Adding a new map

1. Create `assets/source/<mapname>/` and drop in AI images
2. Add entries to `PIPELINE` in `process_assets.py`
3. Add a map entry in `config/maps.js` pointing to the new bg/bgm/items
4. Add new drink tiers in `config/items.js` (sprite path, r, colors, bodyRatio)
5. Run `python process_assets.py --map <mapname>`
6. Set `ACTIVE_MAP = MAPS[n]` in `config/maps.js`

Optional per-map fields (see "Menu options"): `combos: true` to default the combo
checkbox on; `sizes: {large, small}` + `defaultSize` to offer a Large-table
toggle (add the extra background via a `copy` entry in the pipeline, then trace
each size's boundary in the hitbox editor); `coin:` / `bag:` to override the
shared coin/money-bag art with map-specific PNGs (omit to use the shared art);
a `soundProfile` branch in audio.js (`setSoundProfile`) + `popX`/`clinkX`/
`coinTickX` synth fns to theme the map's sounds. Melody Lane (music shop) is the
worked example of all of these.

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
  screenshot composite `#stage-bg` + the game canvas into a temp canvas,
  `toDataURL('image/jpeg')`, let the harness spill the base64 to a file, and
  decode it to an image with Python. If the user opens the Browser pane,
  `preview_screenshot` should work normally.
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
- Game over: any drink settled above the danger line (H-150) for >1.5s at speed <0.15
- Score: coin count (10 coins per merge, more for higher tiers). Beating a
  variant's best triggers a fanfare + banner on the game-over screen.

---

## Tech stack

- Matter.js 0.19 (CDN) — physics
- Canvas 2D API — rendering
- Web Audio API — sound effects
- Python + Pillow + NumPy — asset pipeline
- No build step, no framework, vanilla JS modules via script tags
