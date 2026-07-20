// Bug-report capture: a rolling record of the last shots — each with the full
// board state as it was the instant the shot was fired — serialized to a
// compact "MMB1.<checksum>.<base64url>" code (same shape as the MM1 backup
// codes). The 🐞 HUD button (ui.js) shows the code for copy/paste; the replay
// side is TT.bug / TT.bugLoad in test.js, which rebuilds the recorded board
// and re-fires the exact shot so a weird moment can be watched frame by frame.
//
// Loaded before ui.js/game.js; everything it reads (state, ACTIVE_MAP, …) is
// resolved at call time, never at load.
const BUGLOG = (() => {
  const KEEP_SHOTS  = 10;   // ring size — plenty to cover "it just happened"
  const KEEP_EVENTS = 20;

  let meta = null, shots = [], events = [], t0 = 0;

  const now = () => Math.round(performance.now() - t0);
  const r1  = v => Math.round(v * 10) / 10;
  const r2  = v => Math.round(v * 100) / 100;

  // Same encoding helpers as progress.js (they're private to its IIFE).
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

  // One body -> compact tuple [tier, receipt?, ghost?, x, y, vx?, vy?].
  // Velocity is omitted at rest (the usual case) to keep codes small.
  function snapDrink(d) {
    const p = d.plugin;
    const t = [p.tier, p.kind === 'receipt' ? 1 : 0, p.ghost ? 1 : 0,
               r1(d.position.x), r1(d.position.y)];
    if (Math.hypot(d.velocity.x, d.velocity.y) > 0.05)
      t.push(r2(d.velocity.x), r2(d.velocity.y));
    return t;
  }

  return {
    // New run: stamp the run's settings and clear the buffers. Called from
    // resetState() so "Play again" starts a fresh log too.
    run() {
      t0 = performance.now();
      meta = {
        ver: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '?',
        map: (typeof ACTIVE_MAP !== 'undefined' && ACTIVE_MAP) ? ACTIVE_MAP.id : null,
        size: ACTIVE_SIZE || undefined,
        combos: COMBOS_ENABLED || undefined,
        happyHour: HAPPY_HOUR || undefined,
        date: new Date().toISOString().slice(0, 16),
      };
      shots = []; events = [];
    },

    // Record a fired shot. Call right after its launch velocity is set; the
    // snapshot is every OTHER body, i.e. the board the shot flew into.
    shot(d) {
      if (!meta) this.run();
      shots.push({
        t: now(), tier: d.plugin.tier,
        x: r1(d.position.x), y: r1(d.position.y),
        vx: r2(d.velocity.x), vy: r2(d.velocity.y),
        board: state.drinks.filter(o => o !== d).map(snapDrink),
      });
      if (shots.length > KEEP_SHOTS) shots.shift();
    },

    // Notable moments (currently just 'gameover') for context in the report.
    event(type, info) {
      if (!meta) this.run();
      events.push({ t: now(), type, ...info });
      if (events.length > KEEP_EVENTS) events.shift();
    },

    // Build the copyable code: run meta + shot ring + events + the board as
    // it stands right now (how it looked when the player hit 🐞).
    code() {
      if (!meta) this.run();
      const payload = { v: 1, meta, shots, events,
                        board: state.drinks.map(snapDrink) };
      const body = b64urlEncode(JSON.stringify(payload));
      return 'MMB1.' + checksum(body) + '.' + body;
    },

    // Parse/validate a code (throws readable errors). Used by test.js replay.
    decode(str) {
      const s = String(str || '').replace(/\s+/g, '');
      const m = s.match(/^MMB1\.([0-9a-z]{7})\.([A-Za-z0-9_-]+)$/);
      if (!m) throw new Error("That doesn't look like an MMB1 bug code.");
      if (checksum(m[2]) !== m[1]) throw new Error('Bug code got damaged in transit — copy and paste it again.');
      return JSON.parse(b64urlDecode(m[2]));
    },
  };
})();
