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
// Keys are namespaced per tool — 'sprite:libRoot', 'hitbox:file', 'sound:file'.

const ToolHandles = (() => {
  const DB = 'mm_tool_handles_v1', STORE = 'h';

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

  return {
    async keep(key, h) {
      try { await tx('readwrite', s => s.put(h, key)); } catch {}
    },

    async recall(key) {
      try { return (await tx('readonly', s => s.get(key))) || null; }
      catch { return null; }
    },

    // Drop a handle that turned out to be unusable — permission refused, or the
    // wrong file. Without this a tool would recall the same bad handle on every
    // attempt and never let a different one be picked.
    async forget(key) {
      try { await tx('readwrite', s => s.delete(key)); } catch {}
    },

    async ready(h, mode, interactive) {
      if (!h) return false;
      try {
        if (await h.queryPermission({ mode }) === 'granted') return true;
        if (!interactive) return false;
        return await h.requestPermission({ mode }) === 'granted';
      } catch { return false; }
    },
  };
})();
