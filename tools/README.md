# Dev tool manuals

Working notes for the three browser tools in this folder — the hitbox editor,
the sprite editor and the sound lab — plus the two command line ones,
`shot.js` and `check.js` (see the last two sections). **Read the relevant section before editing
anything in `tools/`**: nearly every paragraph here encodes a trap that already
cost real time once (the `showSaveFilePicker` truncation that wiped
`config/items.js`, sprite paths that 404 invisibly, a library that goes blank
when thumbnails are fetched instead of read through the handle).

These used to live in `../CLAUDE.md`; they moved out on 2026-07-29 because they
are only needed when working on the tools, and they were ~27% of a file that
loads in full every session. Section names referenced below without a link —
"Bandwidth", "Known issues", "Running the game locally" — are still in
`../CLAUDE.md`.

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

**Size variants in the editor:** maps with a `sizes` field (see "Menu
options" in ../CLAUDE.md) appear once per framing in the dropdown, e.g. "Kyoto — Large" and
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
detection when glow bridges a gutter. **Rows are found over the whole sheet,
then columns are found INSIDE each row band** — never a second full-height
scan. Two neighbours can touch in ONE row and still leave a clean gutter in
every other row; a full-height column profile then sees no gutter anywhere and
fuses those columns into one double-wide cell, with no slider setting that can
recover it (`shared/customers 2.png`, 2026-07-26 — its column gutter sits at
x654-685 in row 1 but x697-726 in row 3, so the union is solid). A row-local
scan is always at least as fine as the global one, so it only ever splits more;
the readout says `3 cols × 4 rows` when every row agrees and
`4 rows, 3/3/3/2 cols` when they don't. The mirror case — items JOINED across a
row by a shared prop (`shared/customers 3.png`, where a wooden shelf runs under
all three) — is not a detection bug and no slider fixes it: regenerate the art
with the "generous gaps, nothing touches" clause. Each item is then isolated by
**connected component flood-fill**, not by rigid grid lines — the fix for a
neighbour's stem poking into the cell. "keep parts ≥" is the floor for
genuinely separate pieces (a violin bow ≈ 13% of the item, stray specks ≈ 1%);
rejected blobs are excluded from the feather pass so they can't reappear.
Save writes the PNGs straight into a folder you pick once.

**"Strip baked shadow" keeps a baked GLOW and drops a baked DROP SHADOW**
(default ON since 2026-07-29). The two are worth opposite treatment. A glow is a
pre-rendered gaussian blur — the same trick `render.js` uses for combo pops
because `shadowBlur` is far too expensive to run per frame — so it is free
quality. A shadow is a liability: `drawDrink` already draws one sized to `physR`
and nudged by `SHADOW_DROP`, so a baked one double-shadows, points wherever that
sheet felt like, and (because sprites are pinned by TOTAL HEIGHT and
bottom-anchored at `r*0.75`) inflates the crop bbox so the drink renders smaller
and floats above its own hitbox. Measured on a synthetic item carrying both:
crop 145×167 → 155×139, i.e. the phantom height goes away.

Both are soft alpha outside the core, so the old distance-based cut could not
tell them apart — it raised the core threshold to 128 and dropped whatever sat
further than `edge feather` from the body, shadow and wide glow alike. The split
is by **colour** instead: ImageData RGB is UNPREMULTIPLIED, so a white glow reads
255 and a black shadow reads ~0 no matter how faint the alpha, which makes the
test independent of how soft the halo is. It compares the **brightest channel**
(HSV value) rather than luminance, because a saturated glow (deep purple ≈
120,60,180) has low luminance and is obviously not a shadow.

- **glow cutoff** (default 110) is where the line sits. **255 reproduces the old
  behaviour** (halo dropped entirely); 0 keeps all of it, shadow included.
- **glow pad** doubles as the REACH: the halo searched is `glow pad` px out from
  the body, which is exactly the margin the crop made room for. Lower it if a
  neighbour's halo gets grabbed.
- Blobs the isolate pass rejected stay rejected, so a neighbour cannot re-enter
  through its own glow.
- A thin dark skirt within `edge feather` of the body always survives, by
  design — that band is the item's own antialiased edge and its outlines, and
  colour-testing it would eat the "subtle warm outlines" the art prompt asks for.

The default flipped with a one-shot settings migration keyed off the new slider,
so a stored `stripShadow:false` from before the split can't silently pin you to
the old default while your tuned sliders are preserved.

**Saving downscales by default (built 2026-07-28).** A **max height** control in
the Save fieldset (default **256 px**, `0` = source resolution) is applied at
save AND download time by `outCanvas()`, and each cell's readout shows the
resulting size (`1125×1026 → 281×256`) so an oversized save is visible before it
lands. Measured on `farm/pumpkin_improved.png`: 1658 KB → 124 KB with alpha
intact. It downscales by **repeated halving** before the final step — a single
big `drawImage` jump samples too few source pixels and aliases the feathered
edges the isolate pass just built.

This was the standing TODO, and the bug it prevents is not hypothetical: a
1024×1536 AI sheet yields ~420–460 px sprites for art the game draws at ~108 px
(customers) or `r*2.4` ≈ 36–170 px (items), i.e. ~4× oversampled at ~265 KB
each — how the Happy Hour cast reached 4.0 MB on 2026-07-26 (see "Menu options →
Happy Hour"). The right size is per-USE, not per-sheet (a customer draws far
bigger than a tier-0 item), so it stays a control rather than a constant — but
it defaults ON, because the oversized case is the one that happens by accident.

**2 · Tier chain** — a **set picker** mirroring the hitbox editor's map
dropdown: one row per map (same labels, same order, built from `MAPS` by
matching `itemsData` BY IDENTITY against the `*_ITEMS` consts, so no map-id →
const-name guessing), then the two map-less shared sets — **Happy Hour —
Receipts** and **Happy Hour — Customers** — then "— new chain —", the only entry
that asks for a const name. Picking a set loads it AND jumps the sprite folder to
that set's art. The old raw `load existing` / `const name` / `sprite path` inputs
are gone: a map knows all three. The sprite root is now the constant
`SPRITE_ROOT` (`assets/images/`).

Pick **assets/images/** as the root once and browse it as a folder tree (📁 to
descend, ↰ or the breadcrumb to go back up), since the sprite folder is
map-based. A tier stores its path RELATIVE to the root (`farm/seed.png`), so one
chain can mix a map's items with something from `shared/`. Thumbnails are read
through the DIRECTORY HANDLE (blob URLs), never fetched from `SPRITE_ROOT` +
name — picking a map folder as the root used to 404 every one of them, and an
`<img>` that fails inside a `.checker` tile paints NOTHING, so the library went
silently blank-checkerboard.

**With no folder picked, the library lists the art named in CONFIG** (2026-08-16).
A static host serves no directory listing, so on the deployed site — and on
iPad, where Safari has no File System Access API and the picker does not exist
— the library column used to sit permanently at "No folder chosen", which takes
the whole tier-chain half of the tool with it. No listing is needed to show the
game's own art, though: every sprite it draws is NAMED in config, which the tool
has already loaded to build `SETS`. `buildCatalog()` collects those paths
(`SETS` items + `CUSTOMER_SPRITES` + any per-map `coin`/`bag`) and `catalogAt()`
serves one level of a virtual tree out of them, so browsing, breadcrumbs,
filtering and click-to-add all work unchanged; thumbnails come from the served
URL, which `thumbSrc` already fell back to. Measured against the repo it covers
**107 of the 112 PNGs** under `assets/images/` — the five it misses are the
three site favicons plus coin and moneybag, none of them item art.

It is a fallback, not a replacement, and the invariant is that `libCatalog` is
non-null only while `libRoot` is null: both places that set a handle clear it on
the same line. A real folder must keep winning because only a handle can see a
PNG that was just extracted and no map references yet — the local authoring
case. The write-time guard below is unaffected: `spriteExists()` asks the server
first, which is exactly what catalog paths are checked against.

**Sprite paths are resolved and then verified — the tool can no longer emit a
path that 404s** (2026-07-28). Two independent guards, because a wrong
`sprite:` path is *invisible*: every draw site gates on
`img.complete && img.naturalWidth`, so the item just doesn't appear, in the game
AND in the hitbox editor.
1. **Root resolution.** Picking `assets/images/farm/` instead of
   `assets/images/` used to emit `assets/images/seed.png` for a file at
   `assets/images/farm/seed.png`. `resolveRootPrefix()` HEAD-probes the
   server with a PNG it can see through the handle and keeps the prefix that
   answers 200, so `relPath()` is right whichever folder was picked
   (`libRootPrefix`, `''` or `'farm/'`). A folder that isn't served under
   `assets/images/` at all is called out instead of guessed. On `file://` there
   is no server to probe and a handle cannot see ABOVE the folder that was
   picked, so the prefix is inferred from the folder's own NAME (`images` = no
   prefix, anything else = one level down, `rootState:'inferred'`). A wrong
   guess is recoverable rather than silent — guard 2 re-checks every path.
2. **Write-time validation.** `pathGuard()` checks every emitted path before
   Write / Copy / Download, via `spriteExists()`. A path it can locate by
   basename under the picked root is **corrected in memory and the write is
   still refused**, so the repaired source can be read before it hits disk; one
   it can't is a hard refusal.

`spriteExists()` asks the SERVER first and the picked FOLDER second, and the
order is deliberate: over http the server is ground truth for what the game will
actually fetch, so localhost behaviour is exactly what it was before the folder
fallback existed. The handle answers only when fetch can't — which is what makes
the guard work from `file://`, where it used to warn and write anyway. It
degrades to a warning ONLY when neither can answer (no folder picked *and* no
server), so Firefox's copy-the-text path still works. Verified all four states by
stubbing `fetch` to throw (2026-07-29).

**Picked folders are REMEMBERED across reloads** (2026-07-29), via the shared
`ToolHandles` store in `tools/tool-handles.js` — see that file for why a handle
can never come from a path. This tool remembers three: `libRoot` (the
assets/images/ tree), the extract tab's save folder, and `config/items.js`. On
load it adopts a remembered handle SILENTLY when the browser still reports
`queryPermission === 'granted'`, and the library opens where it was, with the
current set's folder already showing.

Permission is the part a click still buys. Chromium drops file-system permission
when the browser restarts, and `requestPermission()` requires user activation —
so it can only run from an event handler, never at load. When a handle is
remembered but not granted, "Choose assets/images/…" relabels to **"Reconnect
images/…"**: one click, no walking the tree. `forget()` drops a handle that
turns out to be unusable (permission refused, or the picked file isn't items.js)
— without it the tool would recall the same bad handle forever and never let a
different one be picked.

**The hitbox editor and sound lab remember their save file the same way**
(`hitbox:file` → config/hitboxes.js, `sound:file` → config/soundmap.js). Both
funnel Save through an `ensureSaveFile()` that tries the live handle, then the
remembered one, then the picker — so the usual Save is one click with no picker
at all, and at worst one permission prompt after a browser restart. Each Save
button's tooltip says at load which of those it will be. This also means
`showSaveFilePicker` runs far less often, which matters beyond convenience: that
picker TRUNCATES its target the moment it is dismissed (see the trap below).
Harmless for these two — they never read, they always write a complete file from
memory — but fewer invocations is strictly safer.

### Every save is checked against the server (the wrong-checkout trap)

A remembered handle points at a FILE, and a file has no allegiance to the
checkout you are working in. On 2026-08-02 the hitbox editor's handle was
pointing into `.claude/worktrees/<branch>/config/hitboxes.js`: two boundaries
were traced, Save reported success, and the main checkout's file never changed.
Nothing was wrong with the write — only with which file it wrote.

Nothing in the API can prevent that, and it is worth knowing why, because the
obvious fixes are all dead ends. **A handle exposes no path** — the picker
gesture IS the grant, and a path would leak the shape of your disk — so a tool
cannot compare its handle to `config/hitboxes.js`, cannot derive a handle from
that relative URL, and therefore **can never auto-select the right file**.
`.name` is only the basename, identical in every checkout, which is exactly why
the Save tooltip ("Overwrites hitboxes.js") read as reassuring while pointing
somewhere else.

What a tool CAN do is ask the server. `ToolHandles.checkServed(handle, url,
text?)` fetches `url` over the tool's own origin — by definition the copy the
game next door loads — and compares bytes. Both moments are wired up in all
three tools:

- **At load**, when permission is already granted: a mismatch raises the
  **Wrong file?** banner *before* you spend an hour tracing.
- **After every write**, comparing what was just written against what the server
  now returns. This is the one with no meaningful false negative — if it says
  verified, the save is live where the game reads it.

On a mismatch the tools refuse to look successful: the hitbox editor leaves the
unsaved pill lit (so the `beforeunload` guard still fires), the sound lab **keeps
its localStorage draft** instead of clearing it (that draft is then the only safe
copy of your picks), and each offers **Forget it — pick again**. Comparison is
exact, with no line-ending normalisation, because two checkouts of this repo
differ in EOL alone — git leaves the main checkout CRLF and a worktree LF — and
that difference is signal.

`'unknown'` is a non-answer and stays silent: from `file://` there is no server
to ask, and at load Chromium may not have re-granted read permission yet. The
handle keys are also namespaced per ORIGIN now, so two checkouts served on
different ports can never share one. That namespace orphaned every handle
remembered before 2026-08-02 — each tool asks for its file once more, which is
the intended cost.

Recovering a save that already went astray is a copy, not a re-trace — see
CLAUDE.md, "Preview servers & PARALLEL SESSIONS", for how to find it.

Pick which PNG is which tier, drag to reorder, then write
`config/items.js`. `r` belongs to the SLOT, not the item, so a drag re-assigns
the chain's existing r values smallest→largest — a hand-tuned ladder survives a
reorder. "Reset r ladder" regenerates a plain geometric 15→71 ramp instead, so
it is for NEW chains: the shipped maps are hand-tuned and it will retune them.
`vis` is the per-item rescale
(visual only, physics untouched) and auto-fills to area parity
`sqrt(0.75/aspect)`; a ⚠ appears when an item would draw under 45% of its
tier's footprint, mirroring the load-time guardrail in items.js. `glass`/`liq`
fallback colours are sampled from the art.

**Cast mode — Happy Hour customers.** Picking **Happy Hour — Customers** edits
`CUSTOMER_SPRITES` (config/items.js): a plain sprite list, not a tier chain, so
every tier-only control (r, vis, the r-ladder / auto-vis buttons, the ⚠) is
hidden and rows show the sprite path instead of an editable name. Add faces by
clicking art in `shared/`, drag to reorder, Write. **The cast SIZE is what
matters** — the game picks a face at random per arrival, so more faces = more
variety, and nothing else needs editing (see "Happy Hour" in ../CLAUDE.md). New faces come
from the Extract tab: run a customer sheet through it, save into
`assets/images/shared/`, then add them here. Writing requires the existing
`const CUSTOMER_SPRITES` block — the "append a new chain" fallback would
register a sprite list in the physR pre-load spread, so cast mode refuses it.

Note: a write-back normalises `bodyRatio:0.80` to `0.8` (the emitter drops
trailing zeros). Values round-trip exactly; the diff is cosmetic but touches
lines you didn't edit.

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

---

## Screenshots & byte counts — `tools/shot.js`

Not an editor: a command-line harness that opens the real game in headless
Chromium, screenshots it, and reports what the page said about itself.

```
python serve.py 5500                              # it talks to the dev server
node tools/shot.js menu.png --scores              # welcome screen, with fake boards
node tools/shot.js game.png --map=kyoto           # a started run
node tools/shot.js all.png  --height=3400         # the whole card list
node tools/shot.js x.png --width=390 --dsf=2      # a phone
node tools/shot.js x.png --bytes                  # + first-paint byte report
node tools/shot.js x.png --eval="ACTIVE_MAP.id"   # + evaluate in the page
```

It exists because this game's whole point is how it LOOKS, so verifying a UI
change means rendering it — and that script was being rewritten from scratch
every session, each time rediscovering the same things:

- **Every run reports `page errors` and any cross-origin request**, and exits
  non-zero if the page threw. A silent screenshot of a broken page is the
  failure this guards against — twice, a "working" capture was of a page whose
  console was full of errors.
- **`--eval` combines with `?test=1`**, which is the real test rig: the
  expression runs after the map has started, so `TT.seed/shoot/settle/state`
  drive a deterministic run and hand back JSON. That is how to check GAMEPLAY
  headlessly; the screenshot is for judging the LOOK.
- **There is deliberately no `fullPage`.** `#welcome` is `position:fixed` with
  its own `overflow-y`, so the document is always exactly one viewport tall and
  `fullPage` captures nothing extra. Pass `--height=3400` to see the whole menu.
- **`--bytes` reads response `content-length`,** not file sizes on disk, so it
  measures what a visitor actually downloads — including which of the lazy card
  strips the browser chose to fetch. **The dev server does not compress**, so
  text assets read heavier here than on GitHub Pages (`vendor/matter…js` is
  79 KB locally, ~24 KB served). Compare like with like.
- Chromium comes from `$MM_CHROME` or `/opt/pw-browsers/chromium`; the driver
  library is installed outside the repo by `.claude/hooks/session-start.sh`.
  See "Working in a cloud session" in `../CLAUDE.md`.

---

## Regression checks — `tools/check.js`

```
python serve.py 5500                 # it talks to the dev server
node tools/check.js                  # board digests + an advisory preflight
node tools/check.js --deploy         # preflight becomes a hard failure
node tools/check.js --only=boards    # or --only=preflight
node tools/check.js --update         # regenerate the board goldens
```

Runs in ~6s and exits non-zero on failure, so it can gate a commit or a deploy.

### Board digests

Seeded runs across every non-locked map × `default` / `happyhour` / `rapid`,
plus the non-default framing for maps with size variants — 35 scenarios,
compared against `tools/golden/board-digests.json`.

**It exists because of this project's shape, not for coverage.** Every feature
so far — size variants, combos, Happy Hour, `spin`, `flat`, rapid fire — is
another flag threaded through the same handful of shared functions, and there
are 60 live score variants. The risk is never "does the new thing work", it is
"did the new flag quietly move a map nobody was looking at".

- **Score, item count, the tier multiset and the Happy Hour queue are compared
  EXACTLY. Positions get 1px of tolerance** (`POS_TOL`) — `TT.state()` already
  rounds to whole world px, and a real behavioural change moves items far
  further than a rounding boundary or a different Chromium's last-bit drift.
- **Regenerate with `--update` only when a gameplay change is intended, and
  read the diff.** A golden that is refreshed reflexively protects nothing.
- **The rapid scenario steers through every regime on purpose** — pinned at
  each edge, centred, swept fast, and released to glide. A gentle sine wave was
  the first version and it was worthless: a mutation test (`RF_TILT_MAX`
  0.70 → 0.60) went entirely unnoticed, because the carriage keeps up with a
  slow finger and the offset never reaches the clamp. Mutation-test any new
  scenario before trusting it. With the pattern above, that same mutation fails
  exactly the 9 rapid scenarios and nothing else; a global physics nudge
  (`restitution` 0.02 → 0.03) fails 34 of 35.
- **`TT.settle()` is only called for boards that CAN settle.** In rapid the
  launcher keeps firing inside `TT.step`, so settle would just burn its
  1800-frame cap; there the fixed frame count is the whole scenario.
- **This is what caught the virtual clock leaking real time** — see "Test mode"
  in `../CLAUDE.md`. 9 of 35 scenarios differed on a re-run against completely
  unchanged code, which is how a "reproducible most of the time" harness
  finally became visible.

### Deploy preflight

The CLAUDE.md deploy checklist, as a check: it diffs against `origin/main`
(`--base=` to change) and reports any file `index.html` serves that changed
without its `?v=` moving, plus a `?v=` bump that forgot `GAME_VERSION`.

Shipping a `config/*.js` change without a bump does not deploy it — it ARMS it
for the next deploy, which then gets the blame. That is exactly how the 9→18
customer cast landed, and it cost a real debugging session.

- **Advisory by default, blocking under `--deploy`.** Ordinary branch work is
  *expected* to sit unbumped for a while; only a deploy can actually be broken
  by it. A check that cried wolf on every commit would be ignored by the time
  it mattered.
- **A served file with no `?v=` at all is reported too** — `vendor/matter-…js`
  carries its version in its filename, so editing it in place ships to nobody.
  An upgrade there is a rename.
