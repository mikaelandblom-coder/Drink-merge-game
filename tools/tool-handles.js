// Remembered File System Access handles, shared by every tool in tools/.
//
// A handle can NEVER be constructed from a path — no relative URL, no browser
// flag, no config value produces one. The browser only mints a handle from a
// user gesture on a real picker, and that is a security boundary rather than an
// API gap. What IS possible: handles are structured-cloneable, so IndexedDB can
// store them and hand them back on the next load, turning a pick into
// once-FOREVER instead of once-per-load. localStorage cannot hold one — strings
// only.
//
// Permission is the part a click still buys. Chromium drops file-system
// permission when the browser restarts, and requestPermission() requires user
// activation, so it can only ever run from an event handler — never at load.
// Hence ready(h, mode, interactive): pass false at load to ask "is this ALREADY
// usable?", true from a click to let it prompt.
//
// Remembering is a convenience and never a hard dependency: every operation
// here swallows its own errors, so a browser that refuses IndexedDB leaves a
// tool behaving exactly as it did before any of this existed.
//
// Keys are namespaced per tool — 'sprite:libRoot', 'hitbox:file', 'sound:file'
// — and ALSO per origin (see ns() below), because one remembered handle shared
// across two servers is how a save silently lands in the wrong checkout.

const ToolHandles = (() => {
  const DB = 'mm_tool_handles_v1', STORE = 'h';

  // A handle points at a FILE, not at a checkout, and IndexedDB is per-origin
  // but NOT per-port... except it is: an origin includes the port, so
  // localhost:5500 and localhost:5501 already have separate databases. What was
  // NOT separate is the case that bit us on 2026-08-02: the SAME port serving a
  // different checkout at different times (a worktree started on 5500, or the
  // main server restarted from another directory) reuses the same remembered
  // handle, which still points into the old directory. Keying by origin does not
  // fix that on its own — checkServed() below is what actually catches it — but
  // it does stop two concurrently-served checkouts from ever sharing one.
  //
  // Adding this namespace orphans handles remembered before it existed, so every
  // tool asks for its file once more. That is the intended cost: the pick you
  // make next is a pick you can trust.
  const ns = key => `${key}@${location.origin}`;

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('indexedDB unavailable'));
    });
  }

  // One transaction, one operation — the three verbs differ only in the call.
  async function tx(mode, run) {
    const db = await open();
    try {
      return await new Promise((res, rej) => {
        const t = db.transaction(STORE, mode);
        const out = run(t.objectStore(STORE));
        t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
        t.onerror = () => rej(t.error);
      });
    } finally { db.close(); }
  }

  // The copy of `url` that the SERVER at this origin hands out — by definition
  // the copy the game and the tools on this origin actually load. Cache-busted
  // because a stale 200 would be indistinguishable from a matching file.
  async function served(url) {
    try {
      const bust = (url.includes('?') ? '&' : '?') + '_hcheck=' + Date.now();
      const r = await fetch(url + bust, { cache: 'no-store' });
      return r.ok ? await r.text() : null;
    } catch { return null; }
  }

  return {
    async keep(key, h) {
      try { await tx('readwrite', s => s.put(h, ns(key))); } catch {}
    },

    async recall(key) {
      try { return (await tx('readonly', s => s.get(ns(key)))) || null; }
      catch { return null; }
    },

    // Drop a handle that turned out to be unusable — permission refused, or the
    // wrong file. Without this a tool would recall the same bad handle on every
    // attempt and never let a different one be picked.
    async forget(key) {
      try { await tx('readwrite', s => s.delete(ns(key))); } catch {}
    },

    async ready(h, mode, interactive) {
      if (!h) return false;
      try {
        if (await h.queryPermission({ mode }) === 'granted') return true;
        if (!interactive) return false;
        return await h.requestPermission({ mode }) === 'granted';
      } catch { return false; }
    },

    // "Is this handle the file the game at THIS origin loads?" — the question a
    // tool cannot answer by looking at the handle.
    //
    // There is no path on a FileSystemHandle, deliberately: the picker gesture
    // IS the grant, and exposing a path would leak the shape of the user's disk.
    // No flag, base href or fetch recovers one, so a handle can never be matched
    // against a relative URL directly, and a tool can never *auto-select* the
    // right file. (`.name` is only the basename — every checkout's copy is
    // "hitboxes.js", which is why the Save tooltip looked reassuring while
    // pointing into a worktree.)
    //
    // Bytes settle it. `url` is fetched over this tool's own origin, so it IS
    // the served copy; if the handle's bytes match, the handle is that file.
    // Exact comparison, no line-ending normalisation — two checkouts of this
    // repo differ in EOL alone (git's autocrlf leaves the main checkout CRLF and
    // a worktree LF), and that difference is signal, not noise.
    //
    // Pass `text` after a write to ask the stronger question: "did what I just
    // saved actually land where the game reads it?" That is the check with no
    // meaningful false negative — if it says 'same', the save is live.
    //
    // Returns 'same' | 'different' | 'unknown'. 'unknown' is a non-answer, never
    // a failure, and callers must stay quiet on it: from file:// there is no
    // server to ask (Chromium blocks fetch on file:// at any privilege level —
    // see CLAUDE.md), and at load Chromium may not have re-granted read
    // permission yet, so getFile() throws.
    async checkServed(h, url, text) {
      const remote = await served(url);
      if (remote === null) return 'unknown';
      let local = text;
      if (local == null) {
        try { local = await (await h.getFile()).text(); } catch { return 'unknown'; }
      }
      return remote === local ? 'same' : 'different';
    },
  };
})();
