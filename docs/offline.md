# Playing with no network — the offline copy (sw.js + offline.js)

> Moved out of CLAUDE.md on 2026-09-23 to keep that file small. CLAUDE.md
> keeps a summary of the rules; this is the full record — the measurements,
> the history and the reasoning. Keep them in step: a new rule goes in the
> CLAUDE.md summary too.


Mai opened the game on a plane in airplane mode and got nothing at all
(2026-09-22): a static site is still a site, and none of it had ever been on
the device. `sw.js` is a service worker that keeps a copy; `offline.js`
registers it and runs the **Play offline** panel on the menu, where a map is
saved for a flight.

**Two caches, two rules, and the split is the whole design.** Everything else
follows from it:

| cache | holds | rule |
|-------|-------|------|
| `mm-shell-<GAME_VERSION>` | index.html, style.css, every script, the menu/XP chrome, the icons | **network-first** |
| `mm-assets-v1` | everything under `assets/` — backdrops, sprites, card strips, BGM | **cache-first**, refreshed in the background while online |

- **The shell is network-first so this project's `?v=` discipline keeps
  meaning exactly what it means today.** Being online always means running the
  newest deploy; a cached build can never pin an old one while there is a
  connection. Verified by editing a served file on disk between two online
  loads and seeing the second one change.
- **The asset cache is deliberately NOT version-keyed.** A deploy must not
  throw away the 50-odd MB somebody downloaded for a flight. Art regenerated
  in place (`compress_backgrounds.py` rewrites a `.webp` at the same path)
  lands via the background revalidate, within `RECHECK_MS` (12h) — the price
  of not re-downloading a map every deploy.
- **The revalidate is THROTTLED, and must stay so.** It used to run on every
  cache hit, so the cache never saved a request, and Safari fetches a track in
  many ranged pieces (and again as it loops) — each one set off a download of
  the WHOLE mp3. Now each cached response carries an `x-mm-checked` stamp and
  is re-checked at most every 12h, and a per-worker `checking` set collapses a
  burst of concurrent ranged hits into one refresh.
- **A half-failed shell UPDATE fails the install on purpose.** activate deletes
  the previous shell cache, so a flaky connection at deploy time would trade a
  complete offline copy for a broken one. If an older `mm-shell-*` exists and
  any shell file fails to precache, the new worker's cache is dropped and the
  install throws — the old worker stays, and the browser retries later. A
  FIRST install keeps a partial shell (better than none; online loads top it
  up).
- **`GAME_VERSION` is the worker's cache-buster.** offline.js registers it as
  `sw.js?v=<GAME_VERSION>` and sw.js reads its own query to name the shell
  cache, so the existing ritual — bump GAME_VERSION and every `?v=` in the same
  commit — versions the offline copy too, with no new step to forget.
  `tools/check.js` now says so if `sw.js` changes without it, since sw.js is
  the one served file with no `<script>` tag to carry a buster.
- **The shell list is SCRAPED OUT OF index.html by the worker on install**, not
  written down in sw.js. A hardcoded copy would be a second list of every
  script tag and would drift the first time a file was added — the same failure
  `CUSTOMER_SPRITES.length` already exists to prevent. `assets/audio/` and
  `tools/` are excluded from the scrape.
- **Every URL the panel saves is derived from `MAPS`/`ITEMS`**, so a new map or
  a new tier is covered the moment it lands in config, with nothing to update
  in offline.js.

## Range requests are handled by hand, and they are not optional

`<audio>` asks for `Range: bytes=0-`. The Cache API ignores the header and
hands back the whole response, and Safari will not play a 200 where it asked
for a 206 — so without `sliceRange()` in sw.js, offline BGM is silent on the
one device this was built for. Measured with the server killed: `readyState 4`,
the full 312s duration, `Content-Range: bytes 100-199/2624877` on a probe.

The same header is why the download button exists at all rather than relying on
play-and-it's-cached: a 206 cannot be put in a cache, so **a map you play saves
its art but never its music.** The panel's Save fetches each file with no Range
header, which is the only path that gets a whole mp3 onto the device.

## What a save costs, shown before you tap it

Each unsaved map's button reads `Save · 8.9 MB` and "Save every map" carries
its total underneath (`52 MB to download`) — the number you want before
downloading on hotel wi-fi, which the panel originally never showed.

- A map's figure is its own files **plus whatever shared art is not saved yet**
  (the first save pays for the coin, launcher, receipts and cast), so after one
  save every other map's figure drops. "Save every map" counts each shared file
  once.
- Sizes come from `HEAD` requests (`downloadSizes()` in offline.js), six at a
  time, only for files not already cached, remembered for the page's life.
  Not a manifest: that would be a second list of every asset, drifting the
  first time art is regenerated.
- A file whose size can't be learned makes the figure read "at least …";
  offline, no HEADs are sent and the buttons just say "Save".
- The total sits on its own line because at phone width the button is half
  the row, and a single-line label wrapped mid-number.

## What is saved when

- **One visit is enough for the MENU.** The worker precaches the shell on
  install, so the cards, scores and XP all come up with no network.
- **A map you play saves its art as it loads**, through the asset rule — but
  not its BGM (above), so a played map still shows as unsaved in the panel.
  That is honest rather than a bug.
- **Save fetches the lot**: both table framings, the card strip, the tier
  chain, the music, plus the shared art every map draws (coin, bag, launcher,
  receipts, the 18-face Happy Hour cast) and **every map's card strip** — the
  cards are lazy `<img>`s, so offline the four below the fold came up blank
  until this was added. Paid once, on the first save, when megabytes are
  already being downloaded anyway; the menu's measured 511 KB first paint is
  untouched.
- Measured: one map **4–8 MB**, all ten **52 MB**, and a fresh save of
  everything took 1.8s on the dev server.

## The things that would bite

- **It is OFF on the dev server unless `?offline=1`.** `serve.py` sends
  `Cache-Control: no-cache` precisely because a stale `config/*.js` is
  indistinguishable from "my edit didn't work" — and a cache-first worker would
  hand back yesterday's PNG after a `process_assets.py` run, which is that same
  bug with a longer fuse. `?test=1` never registers either, so `TT` runs and
  `tools/check.js` digests always play the files on the server.
- **`?nosw=1` is the panic button** — open that link once and the worker and
  its cached build are gone, then the page reloads clean and rebuilds from the
  network. It leaves the saved MAPS alone: a bad deploy is a code problem, and
  throwing away 50 MB someone downloaded for a flight is not a proportionate
  fix. ("Remove saved maps" in the panel is for when that IS what you want.)
  The reload drops the query, which is what stops it running again on the way
  back in.
- **An unsaved map, offline, still opens** — the asset fetch 504s, every draw
  path already tolerates a missing sprite, and it plays on the fallback
  glass/liq colours with no backdrop and no music. That is the right failure
  (it beats a dead Play button), but a confusing one to walk into, so
  `OFFLINE.markCards()` puts an amber line on each unsaved card while there is
  no network: *"Not saved for offline — plays with no art or music"*. Three
  things about it:
  - **It runs only when offline.** `showWelcome()` calls it on every menu
    rebuild — coming back from a run, a backup import, any `Progress.onChange`
    — so with a network it must cost nothing, and it is one `navigator.onLine`
    test and a return. `onLine` FALSE is the reliable half of that flag (true
    can still be a captive portal), and false is the only half this needs.
  - **It listens for `online`/`offline` too.** Airplane mode gets switched on
    mid-session more often than not — she is already looking at the menu when
    the doors close — so the cards follow it live rather than only on a reload.
  - **It carries a generation counter.** It is async and fire-and-forget, and
    `showWelcome()` can replace `#map-cards` while an earlier pass is still
    awaiting a cache lookup; without the counter that pass would write its
    warnings into detached nodes and the live cards would get none.
  - Amber, not `--neon`: it lands in the same slot as `.map-saved` ("Run in
    progress"), and one is good news while the other is a caution.
- **No web manifest, deliberately (for now).** Offline play needs none — the
  worker covers a normal Safari tab and her existing home-screen icon alike.
  Adding one with `display: standalone` would change how that icon launches
  (no address bar, no reload), and that is a change to Mai's setup to make on
  purpose, with her, not as a side effect of this.
- iOS evicts script-writable storage for sites left untouched for weeks;
  `progress.js` already calls `navigator.storage.persist()`, which is the
  defence, and a player who plays regularly never trips it.
