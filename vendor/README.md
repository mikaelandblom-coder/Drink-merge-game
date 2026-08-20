# vendor/

Third-party code the game loads directly, committed rather than fetched.

## matter-0.19.0.min.js

The physics engine. **Vendored 2026-08-20**, replacing
`https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js` in
index.html.

The reason is availability, not bytes: the game was unplayable — a blank stage,
`Matter is not defined` — any time that CDN was unreachable, which is a
third-party outage the project can neither see nor fix. It also made every
sandboxed/offline dev environment unable to start a run at all.

- **Byte-identical to the npm package `matter-js@0.19.0`**, which is the same
  build cdnjs serves. sha256
  `bdf68e297d6c4ec85b8dd693b8781d99db0090449c9a3ba69948eede08c9275a`.
  Verify a replacement against npm, never by pasting from a web page.
- **The version is in the FILENAME.** Upgrading means adding the new file and
  pointing index.html at it, so a half-finished upgrade can't leave a file
  called `matter.min.js` that is a different engine than the comment claims.
- 79 KB raw, ~24 KB gzipped over the wire. It moves from cdnjs' bandwidth to
  GitHub Pages' — ~5% of the menu's ~510 KB first load, cached thereafter.
  See "Bandwidth" in CLAUDE.md.
- Do not edit it. It is a build artifact; local fixes belong in game.js.

### What this does NOT buy: offline play

Vendoring removes the last cross-origin *request* the game makes (the only
external URL left in index.html is the GitHub link in the menu footer, which is
an `<a href>` nobody fetches). That is a prerequisite for offline play, but it
is not offline play.

**Measured 2026-08-20:** warm the cache with a full visit, start a run, then
disconnect and reload — the navigation fails outright
(`ERR_INTERNET_DISCONNECTED`), because there is **no service worker**
(`navigator.serviceWorker.controller` is null) and nothing else obliges the
browser to serve a navigation from cache.

Real offline support means a service worker plus a web manifest, and it is worth
thinking about before building: a service worker is a cache that outlives a
deploy, which is the `?v=` stale-cache problem in a much more stubborn form —
the standard failure is a player pinned to an old build with no way to clear it.
If it is ever wanted (Mai's iPad home-screen icon is the obvious use), the
cache-busting discipline in CLAUDE.md's deploy checklist has to be designed into
the worker, not bolted on.
