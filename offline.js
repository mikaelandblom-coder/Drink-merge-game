/* ===========================================================================
 * offline.js — "Play offline": register the service worker (sw.js) and run
 * the menu panel that saves a map to the device.
 *
 * Mai tried to open the game in airplane mode and got nothing (2026-09-22).
 * sw.js is what makes a saved copy exist; this file is the half the player
 * touches, plus the one decision sw.js cannot make for itself:
 *
 *   THE WORKER IS REGISTERED AS `sw.js?v=<GAME_VERSION>`, and it names its
 *   shell cache after that query. So the existing deploy ritual — bump
 *   GAME_VERSION and every `?v=` in the same commit — versions the offline
 *   copy too, with no new step to forget. Nothing else in the project needs
 *   to know sw.js exists.
 *
 * WHAT GETS SAVED, AND BY WHOM:
 *   - the menu (code, CSS, chrome, card strips) — sw.js precaches it on
 *     install, so ONE visit is enough for the menu to open with no network;
 *   - a map you PLAY — cached as its art loads, automatically;
 *   - a map you have not played lately — that is what the Save button is for,
 *     and it is also the only path that reliably stores the BGM: <audio>
 *     asks for a byte range, and a 206 cannot be put in a cache (sw.js).
 *
 * Deliberately NOT a fixed list of files: every URL below is derived from
 * MAPS/ITEMS, so a new map or a new tier is saved offline the moment it is
 * added to config, with nothing to update here.
 * ======================================================================== */

const OFFLINE = (function () {
  const ASSET_CACHE = 'mm-assets-v1';   // must match sw.js

  const hasCaches = (typeof caches !== 'undefined') && !!self.isSecureContext;
  const hasSW     = ('serviceWorker' in navigator) && !!self.isSecureContext;
  let   armed     = false;   // did we actually register? (see the dev-server note)

  // ---------------------------------------------------------- registration --
  function register() {
    const q = new URLSearchParams(location.search);
    // The panic button. If a cached build ever misbehaves on Mai's iPad,
    // "open this link once" is a fix that needs no cable and no settings app.
    if (q.get('nosw') === '1') { resetWorker(); return; }
    // Test mode must play the files on the server, not a copy from last week —
    // TT runs and tools/check.js digests are only worth anything if they do.
    if (q.has('test')) return;
    if (!hasSW) return;
    // OFF ON THE DEV SERVER unless ?offline=1 asks for it. serve.py exists to
    // send `Cache-Control: no-cache` because a stale config/*.js or sprite is
    // indistinguishable from "my edit didn't work" (CLAUDE.md) — and a
    // cache-first worker would hand back yesterday's PNG after a
    // process_assets.py run, which is that same bug with a longer fuse.
    // `?offline=1` is how you exercise this feature locally.
    const h = location.hostname;
    if ((h === 'localhost' || h === '127.0.0.1' || h === '[::1]') && q.get('offline') !== '1') {
      return;
    }
    armed = true;
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(GAME_VERSION))
      .catch(err => console.warn('[offline] service worker not registered:', err));
  }

  // `?nosw=1`. Takes out the WORKER and the cached build it serves, and leaves
  // the saved maps alone: a bad deploy is a code problem, and throwing away
  // 50MB of art someone downloaded for a flight is not a proportionate fix.
  // ("Remove saved maps" in the panel is there for when that IS what you want.)
  //
  // It ends by navigating to the clean URL — otherwise the page keeps the old
  // worker as its controller and the fix is invisible until a manual reload.
  // Dropping the query at the same time is what stops that reload running this
  // again, and again.
  async function resetWorker() {
    try {
      if (hasSW) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (hasCaches) {
        const names = await caches.keys();
        await Promise.all(names.filter(n => n.startsWith('mm-shell-')).map(n => caches.delete(n)));
      }
      console.log('[offline] service worker removed — reloading clean');
    } catch (e) { console.warn('[offline] could not clear:', e); }
    location.replace(location.pathname);
  }

  // ------------------------------------------------------------ URL lists --
  const abs = u => new URL(u, location.href).href;

  // Art every map draws, whatever the mode: the coin and bag, the rapid-fire
  // launcher, and Happy Hour's receipts + customer cast. Sized off the config
  // arrays, so the 9->18 cast (or a 19th face) needs no edit here.
  function coreUrls() {
    const out = [
      'assets/images/shared/coin.png',
      'assets/images/shared/moneybag.png',
      'assets/images/shared/launcher-head.png',
      'assets/images/shared/launcher-base.png',
    ];
    if (typeof RECEIPT_ITEMS !== 'undefined')    out.push(...RECEIPT_ITEMS.map(i => i.sprite));
    if (typeof CUSTOMER_SPRITES !== 'undefined') out.push(...CUSTOMER_SPRITES);
    // Every card's art strip, not just this map's. The cards are lazy <img>s
    // (CLAUDE.md, "Map cards wear the map's own art") so a normal visit only
    // fetches the ones scrolled to — offline, the four below the fold came up
    // blank. Saving them here rather than eagerly at load keeps the menu's
    // measured 511KB first paint intact: you pay the ~120KB only once you have
    // asked for an offline copy, when you are already downloading megabytes.
    for (const m of MAPS) if (m.card) out.push(m.card);
    return [...new Set(out)].map(abs);
  }

  // Everything one map needs: both table framings if it has them, its card
  // strip, its music, its own coin/bag overrides, and its whole tier chain.
  function mapUrls(map) {
    const out = [];
    if (map.bg)   out.push(map.bg);
    if (map.card) out.push(map.card);
    if (map.bgm)  out.push(map.bgm);
    if (map.coin) out.push(map.coin);
    if (map.bag)  out.push(map.bag);
    if (map.sizes) out.push(...Object.values(map.sizes));
    for (const it of (map.itemsData || [])) if (it.sprite) out.push(it.sprite);
    return [...new Set(out)].map(abs);
  }

  function playableMaps() { return MAPS.filter(m => !m.locked); }

  // ---------------------------------------------------------- cache state --
  // Content-Length off the cached RESPONSE HEADERS, never the body: summing
  // ten maps by reading their blobs would pull ~50MB through memory just to
  // print a number on the menu.
  async function inspect(urls) {
    let have = 0, bytes = 0;
    for (const u of urls) {
      const res = await caches.match(u);
      if (!res) continue;
      have++;
      const len = parseInt(res.headers.get('content-length') || '', 10);
      if (len > 0) bytes += len;
    }
    return { have, total: urls.length, bytes };
  }

  // A map's own files only — the shared art below is counted ONCE, in
  // coreState(), rather than ten times over.
  async function mapState(map) {
    const s = await inspect(mapUrls(map));
    s.saved = s.have === s.total;
    return s;
  }

  async function coreState() { return inspect(coreUrls()); }

  // ------------------------------------------------------------ downloads --
  // Sequential on purpose. A phone on hotel wi-fi gains nothing from six
  // parallel 3MB fetches, and one at a time is what makes the progress line
  // mean something.
  async function saveUrls(urls, onStep) {
    if (!hasCaches) throw new Error('This browser cannot save the game offline.');
    const cache = await caches.open(ASSET_CACHE);
    let done = 0, bytes = 0, failed = 0;
    for (const u of urls) {
      try {
        const already = await caches.match(u);
        if (already) {                                // already here — skip the bytes
          bytes += parseInt(already.headers.get('content-length') || '', 10) || 0;
        } else {
          // no-cache revalidates rather than re-downloading an unchanged file,
          // and NO Range header — so this is a full 200 the cache will accept.
          const res = await fetch(u, { cache: 'no-cache' });
          if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
          // Clone BEFORE the put: cache.put consumes the body, and the original
          // response is what goes in, headers and all, so inspect() can read
          // its Content-Length back later without touching the bytes.
          const probe = res.clone();
          await cache.put(u, res);
          bytes += (await probe.blob()).size;
        }
      } catch (e) {
        failed++;
        console.warn('[offline] could not save', u, e);
      }
      done++;
      if (onStep) onStep(done, urls.length, bytes);
    }
    return { bytes, failed };
  }

  // The shared art rides along with every map save. Already-cached URLs are
  // skipped, so it is paid for once and the second map is just its own files.
  function saveMap(map, onStep) {
    return saveUrls([...coreUrls(), ...mapUrls(map)], onStep);
  }

  async function clearSaved() {
    if (hasCaches) await caches.delete(ASSET_CACHE);
  }

  // ------------------------------------------- the warning on a menu card --
  // Offline, a map with nothing saved still OPENS — every draw path tolerates a
  // missing sprite, so it plays on the fallback glass/liq colours with no
  // backdrop and no music. That is the right failure (it beats a dead button),
  // but it is a confusing one to walk into, so the card says so first.
  //
  // It runs ONLY when there is no network: online this is one `navigator.onLine`
  // test and a return, so the menu rebuild — which happens on every trip back
  // from a run, and on every Progress change — pays nothing for it. `onLine`
  // false is the reliable half of that flag (true can still mean a captive
  // portal), and false is the only half this needs.
  let markGen = 0;
  async function markCards() {
    const cards = document.querySelectorAll('.map-card[data-map]');
    if (!cards.length) return;
    // A generation counter, because this is async and fire-and-forget:
    // showWelcome() can rebuild #map-cards while an earlier pass is still
    // awaiting, and that pass holds references to cards no longer in the page.
    const gen = ++markGen;
    if (!(hasCaches && hasSW && armed) || navigator.onLine !== false) {
      clearCardWarnings();
      return;
    }
    for (const card of cards) {
      const map = MAPS.find(m => m.id === card.dataset.map);
      if (!map) continue;
      const s = await mapState(map);
      if (gen !== markGen) return;           // a newer pass owns the DOM now
      setCardWarning(card, !s.saved);
    }
  }

  function clearCardWarnings() {
    document.querySelectorAll('.map-warn').forEach(el => el.remove());
  }

  function setCardWarning(card, on) {
    const body = card.querySelector('.map-body');
    if (!body) return;
    let el = body.querySelector('.map-warn');
    if (!on) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'map-warn';
      // Above the option toggles, in the same slot the "Run in progress" line
      // uses — the two are both "what you need to know before you press Play".
      body.insertBefore(el, body.querySelector('.map-options') || body.firstChild);
    }
    el.textContent = "Not saved for offline — plays with no art or music";
  }

  // Airplane mode is toggled MID-SESSION more often than not (she is already on
  // the menu when the plane doors close), so the cards must follow it live.
  addEventListener('online',  () => markCards());
  addEventListener('offline', () => markCards());

  return { register, mapUrls, coreUrls, mapState, coreState, saveMap, saveUrls,
           clearSaved, playableMaps, resetWorker, markCards,
           get available() { return hasCaches && hasSW && armed; } };
})();

OFFLINE.register();

/* ---------------------------------------------------------------- the panel --
 * Static markup outside #map-cards, like Backup & transfer and Credits, so it
 * is wired ONCE here rather than on every showWelcome() rebuild.
 * -------------------------------------------------------------------------- */
(function wireOffline() {
  const box = document.getElementById('offline-box');
  if (!box) return;
  // No service worker — an insecure origin, opened from file://, or the dev
  // server without ?offline=1 — means there is nothing this panel could
  // promise. Hiding it beats a row of controls that quietly do nothing.
  if (!OFFLINE.available) { box.hidden = true; return; }

  const panel  = document.getElementById('offline-panel');
  const status = document.getElementById('offline-status');
  const list   = document.getElementById('offline-maps');
  const bar    = document.getElementById('offline-bar');
  const fill   = document.getElementById('offline-fill');
  const allBtn = document.getElementById('offline-all');
  const clrBtn = document.getElementById('offline-clear');
  let busy = false;

  const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';

  function setProgress(done, total) {
    bar.hidden = false;
    fill.style.width = (total ? Math.round(100 * done / total) : 0) + '%';
  }

  async function refresh() {
    const maps = OFFLINE.playableMaps();
    const states = await Promise.all(maps.map(m => OFFLINE.mapState(m)));
    const core = await OFFLINE.coreState();
    let savedCount = 0, savedBytes = 0;
    list.innerHTML = maps.map((m, i) => {
      const s = states[i];
      if (s.saved) { savedCount++; savedBytes += s.bytes; }
      const right = s.saved
        ? `<span class="off-ok">Saved${s.bytes ? ' · ' + mb(s.bytes) : ''}</span>`
        : `<button class="off-save" data-id="${m.id}">Save</button>`;
      return `<div class="off-row" data-row="${m.id}">
                <span class="off-name">${m.label}</span>
                <span class="off-right">${right}</span>
              </div>`;
    }).join('');
    list.querySelectorAll('.off-save').forEach(b => {
      b.onclick = () => runSave([maps.find(m => m.id === b.dataset.id)]);
    });
    const onDisk = savedBytes + core.bytes;   // the shared art counts once
    status.textContent = savedCount
      ? `The menu already works with no internet. ${savedCount} of ${maps.length} maps saved` +
        (onDisk ? ` (${mb(onDisk)} on this device).` : '.')
      : `The menu already works with no internet. No maps saved yet — save the ones you want to play.`;
  }

  async function runSave(maps) {
    if (busy) return;
    busy = true;
    allBtn.disabled = clrBtn.disabled = true;
    let failed = 0;
    try {
      for (let i = 0; i < maps.length; i++) {
        const m = maps[i];
        const row = list.querySelector(`[data-row="${m.id}"] .off-right`);
        if (row) row.innerHTML = '<span class="off-working">Saving…</span>';
        const r = await OFFLINE.saveMap(m, (done, total, bytes) => {
          setProgress(done, total);
          status.textContent = `Saving ${m.label} — ${done} of ${total} files (${mb(bytes)})` +
            (maps.length > 1 ? ` · map ${i + 1} of ${maps.length}` : '');
        });
        failed += r.failed;
      }
    } catch (e) {
      status.textContent = 'Could not save: ' + e.message;
    }
    bar.hidden = true;
    fill.style.width = '0%';
    busy = false;
    allBtn.disabled = clrBtn.disabled = false;
    await refresh();
    OFFLINE.markCards();
    if (failed) status.textContent += ` ${failed} file(s) could not be saved — try again on a better connection.`;
  }

  document.getElementById('offline-toggle').onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) refresh();
  };

  allBtn.onclick  = () => runSave(OFFLINE.playableMaps());
  clrBtn.onclick  = async () => {
    if (busy) return;
    await OFFLINE.clearSaved();
    await refresh();
    OFFLINE.markCards();
    status.textContent = 'Saved maps removed. The menu still works offline.';
  };
})();
