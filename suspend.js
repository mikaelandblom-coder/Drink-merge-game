// Suspended runs — leaving a map mid-game parks the whole board in
// localStorage, so the menu can offer "Continue" alongside "New run".
//
// This is deliberately built on machinery that already existed rather than a
// second board format: bodies are serialized with BUGLOG.snapDrink (buglog.js)
// and rebuilt the way test.js's TT.bugLoad rebuilds a bug report. What is left
// is the part a bug report has no use for — score, upcoming tiers, the Happy
// Hour queue — plus the save/clear lifecycle.
//
// ONE save per map (`mm_run_<mapId>`). It carries the VARIANT it was played on
// (size / combos / Happy Hour), because the parked board only makes sense under
// the boundary and mode it was played with — resuming replays that variant even
// if the menu checkboxes have moved on since. Starting a new run on the same map
// replaces it.
//
// Loaded before ui.js/game.js; everything it reads (state, ACTIVE_MAP,
// makeDrink, …) is resolved at call time, never at load.
const SUSPEND = (() => {
  const VER = 1;                          // payload format, not the game version
  const key = id => 'mm_run_' + id;
  const r1  = v => Math.round(v * 10) / 10;

  function read(mapId) {
    try { return JSON.parse(localStorage.getItem(key(mapId)) || 'null'); }
    catch { return null; }
  }

  return {
    // test.js (?test=1) turns this off, like the stubbed high-score saves — a
    // test run must never park itself over Mai's real suspended game.
    persistEnabled: true,

    // Park the run in progress. Safe to call at any time: a finished run, an
    // untouched board, or a full storage quota all just return false.
    save() {
      if (!this.persistEnabled) return false;
      if (typeof ACTIVE_MAP === 'undefined' || !ACTIVE_MAP) return false;
      if (state.gameOver) return false;
      // Nothing shot, nothing earned — there is no run here to come back to,
      // and parking one would put a pointless "Continue" on the card.
      if (!state.drinks.length && !state.coinCount) { this.clear(ACTIVE_MAP.id); return false; }

      const p = {
        v: VER,
        ver: (typeof GAME_VERSION !== 'undefined') ? GAME_VERSION : '?',
        at: Date.now(),
        map: ACTIVE_MAP.id,
        size: ACTIVE_SIZE || undefined,
        combos: COMBOS_ENABLED || undefined,
        happyHour: HAPPY_HOUR || undefined,
        // Coins still flying to the bag are not in coinCount yet. Settle them
        // exactly as checkOver() does, so Continue resumes on the number the
        // player last watched ticking up rather than one short per coin.
        score: state.coinCount + state.coins.length * 10,
        next: state.nextTier,
        queued: state.queuedTier,
        launchX: r1(LAUNCH.x),
        xp: state.runXp,
        board: state.drinks.map(BUGLOG.snapDrink),
      };
      if (HAPPY_HOUR) {
        p.hh = {
          shots: state.shotsFired,
          nextAt: state.nextCustomerAtShot,
          // Customers mid-walk-out are dropped: leaveAt is a wall-clock stamp
          // that means nothing after a break, and they were already served.
          queue: state.customers.filter(c => !c.leaveAt).map(c => [c.slot, c.art, c.tier]),
        };
      }
      try { localStorage.setItem(key(ACTIVE_MAP.id), JSON.stringify(p)); }
      catch { return false; }   // quota / private mode — never throw out of a quit
      return true;
    },

    // The saved run for a map, or null. Validates before handing anything back,
    // so callers can treat a non-null result as restorable.
    load(mapId) {
      const p = read(mapId);
      if (!p || p.v !== VER || p.map !== mapId) return null;
      const map = (typeof MAPS !== 'undefined') && MAPS.find(m => m.id === mapId);
      if (!map || !map.itemsData) return null;

      // TIER indices are what gets validated here — NOT the game version. A
      // version check would throw a parked run away on every single deploy,
      // while the thing that actually breaks a restore is an item chain that
      // shrank under the save: makeDrink would index past the end of ITEMS.
      const nDrink   = map.itemsData.length;
      const nReceipt = (typeof RECEIPT_ITEMS !== 'undefined') ? RECEIPT_ITEMS.length : 0;
      const board = Array.isArray(p.board) ? p.board : [];
      const badTier = board.some(b => !(b[0] >= 0 && b[0] < (b[1] ? nReceipt : nDrink)));
      if (badTier || !(p.next < nDrink) || !(p.queued < nDrink)) { this.clear(mapId); return null; }
      if (p.hh && p.hh.queue && p.hh.queue.some(c => !(c[2] >= 0 && c[2] < nDrink))) {
        this.clear(mapId); return null;
      }
      return p;
    },

    has(mapId) { return !!this.load(mapId); },

    // Guarded by persistEnabled like save(): startGame() clears on every run
    // start, and in test mode that would wipe a REAL parked run just by loading
    // ?test=1 and calling TT.start.
    clear(mapId) {
      if (!this.persistEnabled) return;
      try { localStorage.removeItem(key(mapId)); } catch {}
    },

    // Rebuild a parked run onto the fresh board startGame() just made. Must run
    // AFTER resetState() and after the map's walls / free line are in place —
    // makeDrink derives ghost state from those.
    apply(p) {
      for (const b of p.board) {
        const d = makeDrink(b[3], b[4], b[0], false, false, b[1] ? 'receipt' : 'drink');
        // The game-over grace is measured from plugin.born, so backdating it
        // means a resumed board is judged the instant it loads. That is what
        // keeps quitting honest: parking a run with a drink sitting over the
        // danger line can't be used to reset the 1.5s countdown.
        d.plugin.born -= 10000;
        // Restore the recorded ghost state — makeDrink re-derives it from
        // position, which is wrong for a stray ghost parked inside the tray.
        d.plugin.ghost = !!b[2];
        d.collisionFilter.mask = b[2] ? ~CAT_TRAY : -1;
        if (b.length > 5) Body.setVelocity(d, { x: b[5], y: b[6] });
      }
      state.coinCount  = p.score || 0;
      state.nextTier   = p.next;
      state.queuedTier = p.queued;
      state.runXp      = p.xp || 0;
      if (p.launchX !== undefined) LAUNCH.x = p.launchX;
      if (HAPPY_HOUR && p.hh) {
        const now = performance.now();
        state.shotsFired         = p.hh.shots  || 0;
        state.nextCustomerAtShot = p.hh.nextAt || HH_FIRST_SHOT;
        const cast = Math.max(1, CUSTOMER_IMGS.length);
        state.customers = (p.hh.queue || []).map(([slot, art, tier]) => ({
          // art is modulo'd in case the cast shrank since the save — a missing
          // face would draw as an empty bubble rather than fail loudly.
          slot, art: art % cast, tier, bornAt: now, leaveAt: 0,
        }));
      }
      // state.combo is deliberately NOT restored: the combo window is 1.4s, so
      // a chain cannot meaningfully survive a break of minutes or days.
      wakeRender();   // the rebuilt board must draw even though nothing moved
    },
  };
})();
