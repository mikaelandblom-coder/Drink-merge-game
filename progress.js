// Player progression — per-map XP and levels.
// Depends on: getScores/SCORE_MAX (scores.js) for backup-code score merging.
//
// XP rules (agreed 2026-07-17):
//   - 1 XP per shot, on EVERY map/mode — shots track time played, so no
//     mode/map is the "optimal" way to level; play what you enjoy. Rapid
//     fire's shots fire themselves, so it earns 1 XP per 3s of play instead
//     (RF_XP_MS in game.js) — the same idea, measured directly.
//   - Each map has its own level (derived from raw XP, never stored). The
//     total player level is the sum of the map levels — playing all maps is
//     what pushes the big number.
//   - Per-level cost doubles every 7 levels (RuneScape-style):
//       cost(n -> n+1) = round(XP_A * 2^(n/7)),  no level cap.
//     XP_A is the only tuning knob and raw XP is what's stored, so the curve
//     can be retuned later without any migration.
//
// Storage safety (a lost month of XP would be tragic):
//   - mm_xp_v1 in localStorage is the source of truth (one versioned JSON blob).
//   - Mirrored to IndexedDB (some "clear data" paths / eviction heuristics hit
//     the two stores differently); on startup the richer copy wins per map.
//     The high-score boards (mm_s_*) ride in the same mirror and come back by
//     the same union merge a backup code uses — they used to live in
//     localStorage alone, so the one loss the mirror exists for took every
//     board with it.
//   - navigator.storage.persist() asks the browser to exempt us from eviction.
//   - Backup codes (MM1.<checksum>.<base64url JSON>) carry XP + high scores
//     between devices; import merges by MAX so a stale code never erases
//     newer progress. UI lives on the welcome screen (welcome.js).

const XP_KEY = 'mm_xp_v1';
const XP_A   = 60;   // XP for level 0 -> 1 (~one typical run; see CLAUDE.md)

function xpCostFor(level) {
  return Math.round(XP_A * Math.pow(2, level / 7));
}

// Raw XP -> { level, into (XP inside current level), need (cost of this level) }.
function xpLevelInfo(xp) {
  let level = 0, rest = Math.max(0, Math.floor(xp || 0));
  for (;;) {
    const need = xpCostFor(level);
    if (rest < need) return { level, into: rest, need };
    rest -= need; level++;
  }
}

const Progress = (() => {
  let data = { v: 1, maps: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(XP_KEY) || 'null');
    if (raw && raw.maps) data = raw;
  } catch { /* corrupt blob -> start empty; the IDB mirror may still restore */ }

  // ---- IndexedDB mirror (best-effort; the game never depends on it) -------
  function idbStore(mode, fn) {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('no idb'));
      const req = indexedDB.open('mm-progress', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', mode);
        const out = fn(tx.objectStore('kv'));
        tx.oncomplete = () => { db.close(); resolve(out && out.result); };
        tx.onerror    = () => { db.close(); reject(tx.error); };
      };
    });
  }
  const idbRead  = () => idbStore('readonly',  s => s.get(XP_KEY));
  // Every mm_s_* board, read fresh from localStorage at write time.
  function scoreBoards() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mm_s_')) {
          try { out[k] = JSON.parse(localStorage.getItem(k)); } catch {}
        }
      }
    } catch {}
    return out;
  }
  const idbWrite = () => idbStore('readwrite',
    s => s.put(JSON.parse(JSON.stringify({ ...data, scores: scoreBoards() })), XP_KEY)).catch(() => {});

  // Throttle the mirror: localStorage gets every write (cheap, synchronous);
  // IndexedDB follows at most once per few seconds and on pagehide.
  let idbTimer = 0;
  function scheduleMirror() {
    if (idbTimer) return;
    idbTimer = setTimeout(() => { idbTimer = 0; idbWrite(); }, 4000);
  }
  window.addEventListener('pagehide', () => { if (P.persistEnabled) idbWrite(); });

  function save() {
    if (!P.persistEnabled) return;   // test mode (?test=1) stubs all writes
    try { localStorage.setItem(XP_KEY, JSON.stringify(data)); } catch {}
    scheduleMirror();
  }

  // On startup, adopt whatever the mirror has that localStorage lost.
  idbRead().then(mirror => {
    if (!mirror || !mirror.maps || !P.persistEnabled) return;
    let adopted = false;
    for (const [id, v] of Object.entries(mirror.maps)) {
      const n = Math.max(0, Math.floor(+v || 0));
      if (n > (data.maps[id] || 0)) { data.maps[id] = n; adopted = true; }
    }
    if (mergeBoards(mirror.scores)) adopted = true;
    if (adopted) {
      save();
      if (P.onChange) P.onChange();  // welcome.js refreshes visible badges
    }
  }).catch(() => {});

  // Ask the browser not to evict our origin's storage under disk pressure.
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

  // ---- backup codes -------------------------------------------------------
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }
  function checksum(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h.toString(36).padStart(7, '0').slice(-7);
  }

  // Union a set of score boards into localStorage — shared by the mirror
  // recovery and backup-code import, so the two can never disagree about what
  // "merging a board" means. Only ever ADDS entries. Returns boards changed.
  function mergeBoards(boards) {
    let boardsUp = 0;
    for (const [k, list] of Object.entries(boards || {})) {
      if (!k.startsWith('mm_s_') || !Array.isArray(list)) continue;
      const cur = getScores(k);
      const seen = new Set(cur.map(e => e.name + '|' + e.score));
      let changed = false;
      for (let e of list) {
        if (typeof e === 'number') e = { name: 'you', score: e };
        if (!e || typeof e.score !== 'number') continue;
        const id = e.name + '|' + e.score;
        if (!seen.has(id)) { cur.push({ name: String(e.name), score: e.score }); seen.add(id); changed = true; }
      }
      if (changed && P.persistEnabled) {
        cur.sort((a, b) => b.score - a.score);
        try { localStorage.setItem(k, JSON.stringify(cur.slice(0, SCORE_MAX))); boardsUp++; } catch {}
      }
    }
    return boardsUp;
  }

  const P = {
    persistEnabled: true,

    // A board changed outside progress.js (saveScore at game over): refresh
    // the IndexedDB copy on the usual throttle.
    mirrorSoon() { if (P.persistEnabled) scheduleMirror(); },
    onChange: null,       // fired when async recovery/import changes the data
    _data: data,          // live reference for test.js (?test=1) to blank out

    xp(mapId)    { return data.maps[mapId] || 0; },
    info(mapId)  { return xpLevelInfo(P.xp(mapId)); },
    level(mapId) { return xpLevelInfo(P.xp(mapId)).level; },

    totalLevel() {
      let sum = 0;
      for (const v of Object.values(data.maps)) sum += xpLevelInfo(v).level;
      return sum;
    },

    // Returns level info after the add, plus `leveled` when a boundary was
    // crossed (1 XP per call means at most one level per call).
    addXp(mapId, n = 1) {
      const before = P.level(mapId);
      data.maps[mapId] = (data.maps[mapId] || 0) + n;
      save();
      const info = xpLevelInfo(data.maps[mapId]);
      info.leveled = info.level > before;
      return info;
    },

    // "MM1.<checksum>.<base64url payload>" — XP plus every high-score board.
    exportCode() {
      const scores = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mm_s_')) {
          try { scores[k] = JSON.parse(localStorage.getItem(k)); } catch {}
        }
      }
      const body = b64urlEncode(JSON.stringify({ v: 1, xp: data.maps, scores }));
      return 'MM1.' + checksum(body) + '.' + body;
    },

    // Merge-import: XP takes the max per map, score boards take the union of
    // entries (re-sorted, trimmed) — a code can only ever ADD progress.
    // Throws with a human-readable message on a bad code.
    importCode(str) {
      const s = String(str || '').replace(/\s+/g, '');
      const m = s.match(/^MM1\.([0-9a-z]{7})\.([A-Za-z0-9_-]+)$/);
      if (!m) throw new Error('That doesn\'t look like a Mixology Merge code.');
      if (checksum(m[2]) !== m[1]) throw new Error('Code got damaged in transit — copy and paste it again.');
      let payload;
      try { payload = JSON.parse(b64urlDecode(m[2])); }
      catch { throw new Error('Code got damaged in transit — copy and paste it again.'); }

      let mapsUp = 0;
      for (const [id, v] of Object.entries(payload.xp || {})) {
        const n = Math.max(0, Math.floor(+v || 0));
        if (n > (data.maps[id] || 0)) { data.maps[id] = n; mapsUp++; }
      }
      const boardsUp = mergeBoards(payload.scores);
      save();
      if (P.onChange) P.onChange();
      return { mapsUp, boardsUp };
    },
  };

  return P;
})();
