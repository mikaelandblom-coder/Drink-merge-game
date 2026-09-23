/* ===========================================================================
 * sw.js — the service worker that makes the game playable with NO NETWORK
 * (Mai, on a plane, 2026-09-22: airplane mode meant the page would not load
 * at all — nothing was ever stored on the device).
 *
 * TWO CACHES, TWO RULES, and the split is the whole design:
 *
 *   SHELL  (mm-shell-<GAME_VERSION>)  index.html, style.css, every script,
 *          the menu/XP chrome and the icons. Served NETWORK-FIRST, so being
 *          online always means running the newest deploy — this project's
 *          `?v=` discipline keeps working exactly as written, and a stale
 *          cache can never pin an old build while there is a connection.
 *          The cache name carries GAME_VERSION (offline.js registers this
 *          file as `sw.js?v=<GAME_VERSION>` and it reads its own query), so
 *          a deploy replaces the shell rather than layering on it.
 *
 *   ASSETS (mm-assets-v1)  everything under assets/ — backdrops, sprites,
 *          card strips, BGM. Served CACHE-FIRST with a background refresh,
 *          because these URLs carry no `?v=` and are what costs megabytes.
 *          DELIBERATELY NOT version-keyed: a deploy must not throw away the
 *          50-odd MB somebody downloaded for a flight. Art regenerated in
 *          place (compress_backgrounds.py rewrites a .webp at the same path)
 *          lands on the next ONLINE load via the revalidate below.
 *
 * So: playing a map caches that map, and the download button in the menu
 * (offline.js) is the way to fetch one you have not played lately.
 *
 * RANGE REQUESTS ARE HANDLED BY HAND, and they are not optional: <audio>
 * asks for `Range: bytes=0-`, the Cache API ignores the header and hands
 * back the whole response, and Safari will not play a 200 where it asked for
 * a 206. Without sliceRange() below, offline BGM is silent on the one device
 * this was built for.
 * ======================================================================== */

// The version rides in on this worker's own URL (see offline.js). A worker
// fetched without one is a hand-loaded/dev copy; give it its own cache so it
// cannot collide with a real build's.
const VER    = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL  = 'mm-shell-' + VER;
const ASSETS = 'mm-assets-v1';
const KEEP   = [SHELL, ASSETS];

// Chrome referenced only from style.css, so the index.html scrape below can't
// see it. Everything else the shell needs IS in index.html.
const EXTRA_SHELL = [
  'assets/images/bg-main-menu.webp',
  'assets/images/xp-bar-frame.webp',
  'assets/images/xp-medal.webp',
];

// ---------------------------------------------------------------- install --
// The shell list is SCRAPED OUT OF index.html rather than written down here.
// A hardcoded copy would be a second list of every script tag, and it would
// drift the first time a file is added — exactly the failure this project
// already fixed for the customer cast (CLAUDE.md, CUSTOMER_SPRITES.length).
self.addEventListener('install', e => {
  e.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

async function precacheShell() {
  const cache = await caches.open(SHELL);
  const urls  = new Set(['./', './index.html']);
  let scraped = false;
  try {
    const res  = await fetch('./index.html', { cache: 'reload' });
    if (res.ok) {
      scraped = true;
      const html = await res.clone().text();
      await cache.put('./index.html', res.clone());
      await cache.put('./', res.clone());
      for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
        const u = m[1];
        if (/^(?:[a-z]+:|\/\/|#)/i.test(u)) continue;   // absolute, data:, anchors
        if (u.startsWith('tools/')) continue;           // dev editors, not the game
        if (u.startsWith('assets/audio/')) continue;    // megabytes; the map download owns these
        urls.add(u);
      }
    }
  } catch { /* offline at install time — whatever is below still gets a try */ }
  for (const u of EXTRA_SHELL) urls.add(u);
  urls.delete('./');            // already put above, and addAll would refetch it
  urls.delete('./index.html');
  // One at a time, so the failures can be COUNTED rather than one of them
  // aborting the lot the way addAll would.
  const failed = (await Promise.all([...urls].map(u =>
    cache.add(u).then(() => false, () => true)
  ))).filter(Boolean).length + (scraped ? 0 : 1);
  if (!failed) return;
  // What a failure means depends on whether there is a build to fall back on.
  // A FIRST install has nothing to lose, so a partial shell is kept — it is
  // better than none, and every later online load tops it up (freshFirst puts
  // what it fetches). But an UPDATE that half-failed must not go live: activate
  // deletes the previous shell cache, which was complete, and a flaky
  // connection at deploy time would then have traded a working offline copy
  // for a broken one. Failing the install keeps the old worker and its cache;
  // the browser retries the update on a later visit.
  const older = (await caches.keys()).some(n => n.startsWith('mm-shell-') && n !== SHELL);
  if (older) {
    await caches.delete(SHELL);
    throw new Error('shell precache incomplete (' + failed + ' failed) — keeping the previous build');
  }
}

// --------------------------------------------------------------- activate --
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => n.startsWith('mm-') && !KEEP.includes(n))
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// ------------------------------------------------------------------ fetch --
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/tools/')) return;   // the editors are dev-only
  if (isAsset(url)) e.respondWith(assetFirst(req));
  else              e.respondWith(freshFirst(req));
});

function isAsset(url) {
  return url.pathname.includes('/assets/');
}

// Code, CSS and the document: the network wins whenever there is one, so the
// `?v=` cache-busters keep meaning exactly what they mean today.
async function freshFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(SHELL).then(c => c.put(req, copy)).catch(() => {});
    }
    return res;
  } catch {
    // Offline. Exact URL first; then ignoring the query, which is what carries
    // a build ACROSS a deploy — index.html at ?v=101 asking for game.js?v=101
    // still finds the game.js cached under ?v=100.
    const hit = await caches.match(req) ||
                await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const idx = await caches.match('./index.html', { ignoreSearch: true });
      if (idx) return idx;
    }
    return new Response('Offline and not saved to this device.',
      { status: 504, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
  }
}

// Art and audio: cache-first (this is the part that must survive a flight),
// with a quiet refresh in the background while there IS a network.
async function assetFirst(req) {
  const range = req.headers.get('range');
  // The asset cache FIRST: the menu chrome also sits in the shell cache (the
  // install precaches it, unstamped), and a plain caches.match would keep
  // finding that copy — so its x-mm-checked stamp never showed, and it was
  // re-downloaded on every single hit.
  const hit   = await (await caches.open(ASSETS)).match(req) || await caches.match(req);
  if (hit) {
    if (self.navigator.onLine !== false && dueForCheck(req.url, hit)) revalidate(req);
    return range ? sliceRange(hit, range) : hit;
  }
  try {
    const res = await fetch(req);
    // A ranged request comes back 206, which cache.put refuses — and a partial
    // body must never become the cached copy of a whole file anyway. That is
    // why the menu's download button fetches without a Range header.
    if (res && res.ok && res.status === 200) {
      const copy = stamped(res.clone());   // just fetched = just checked
      caches.open(ASSETS).then(c => c.put(req.url, copy)).catch(() => {});
    }
    return res;
  } catch {
    const alt = await caches.match(req, { ignoreSearch: true });
    if (alt) return range ? sliceRange(alt, range) : alt;
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

// How often a cached asset is checked against the network. The refresh used to
// run on EVERY cache hit, so a cached copy never saved a request — and Safari
// asks for a track in many ranged pieces (and again as it loops), each of which
// set off a download of the WHOLE 3-8 MB file. Art regenerated in place still
// lands, just within a day instead of one visit behind.
const RECHECK_MS = 12 * 60 * 60 * 1000;
// URLs already being (or already) checked by this worker — collapses the burst
// of concurrent ranged hits a single <audio> start makes into one refresh.
const checking = new Set();

// The last check is stamped ON the cached response (x-mm-checked), so it
// survives the worker being stopped and restarted, which happens constantly.
// Entries saved by the offline panel carry no stamp and get checked once.
function dueForCheck(url, hit) {
  if (checking.has(url)) return false;
  const at = +hit.headers.get('x-mm-checked') || 0;
  return Date.now() - at > RECHECK_MS;
}

// Fire-and-forget refresh. Fetched by URL (not the original Request) so a
// media element's Range header can't turn this into an uncacheable 206.
function revalidate(req) {
  const url = req.url;
  checking.add(url);
  fetch(url).then(res => {
    if (res && res.ok && res.status === 200) return caches.open(ASSETS).then(c => c.put(url, stamped(res)));
  }).catch(() => {}).finally(() => checking.delete(url));
}

// Same response, plus the time it was checked. Content-Length and the rest are
// kept: offline.js reads sizes off these headers without touching the body.
function stamped(res) {
  const h = new Headers(res.headers);
  h.set('x-mm-checked', String(Date.now()));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// Serve a byte range out of a full cached response — see the header note.
async function sliceRange(res, range) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(range).trim());
  if (!m) return res;
  const buf   = await res.clone().arrayBuffer();
  const total = buf.byteLength;
  let start, end;
  if (m[1] === '') {                       // bytes=-N : the last N bytes
    const n = parseInt(m[2], 10) || 0;
    start = Math.max(0, total - n); end = total - 1;
  } else {
    start = parseInt(m[1], 10);
    end   = m[2] === '' ? total - 1 : Math.min(parseInt(m[2], 10), total - 1);
  }
  if (!(start >= 0) || start > end || start >= total) {
    return new Response(null, { status: 416, statusText: 'Range Not Satisfiable',
      headers: { 'Content-Range': 'bytes */' + total } });
  }
  const body = buf.slice(start, end + 1);
  const h = new Headers(res.headers);
  h.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
  h.set('Content-Length', String(body.byteLength));
  h.set('Accept-Ranges', 'bytes');
  return new Response(body, { status: 206, statusText: 'Partial Content', headers: h });
}
