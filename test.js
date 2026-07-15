// Test mode — dev-only harness for automated verification (Claude Code).
// Loaded last by index.html but INERT unless the URL contains ?test (so it can
// ship harmlessly; Mai's game never runs any of this). Open
//   http://localhost:5500/?test=1
// and drive the game from the console / eval with the window.TT API.
//
// Why it exists: normal verification had to play in real time through rAF,
// which a hidden preview tab never fires — and timers (merge grow-in, the
// 1.5s game-over grace, combo windows) only advance with the wall clock.
// TT fixes both:
//   - performance.now() is wrapped with a VIRTUAL offset; TT.step(n) advances
//     it 16.67ms per frame and runs the exact same per-frame code as live play
//     (checkOver + stepPhysics + render), fully synchronously. A 30-second
//     gameplay sequence verifies in a few hundred ms, hidden tab or not.
//   - TT.shot() composites #stage-bg + the canvas and POSTs the PNG to
//     tools/shot-receiver.py (port 5599) — the known-good hidden-tab capture.
//
// Quick tour (see TT.help()):
//   await TT.start('tikibar', {happyHour:true});  // bypass menu, audio muted,
//                                                 // rAF loop OFF, sprites loaded
//   TT.seed(42);                    // deterministic Math.random
//   TT.shoot(210, 100);             // fire nextTier at physics point (210,100)
//   TT.spawn(3, 200, 300);          // or place a tier-3 drink directly
//   TT.step(120);                   // advance exactly 2s of game time
//   TT.settle();                    // step until everything stops moving
//   TT.state();                     // compact JSON of the whole game state
//   await TT.shot('after-merge');   // screenshot out via shot-receiver.py

if (/[?&]test\b/.test(location.search)) {
  // ---- virtual clock ----------------------------------------------------
  // Everything time-based in the game reads performance.now(), so skewing it
  // is all it takes to fast-forward merges, game-over grace, combo expiry and
  // customer walk-ins deterministically.
  const realNow = performance.now.bind(performance);
  let clockSkew = 0;
  performance.now = () => realNow() + clockSkew;

  // High scores: a test run must never write into the real local boards.
  saveScore = () => ({ inTop: false, rank: 0 });

  const TT = {};

  // ---- run control -------------------------------------------------------
  TT.start = function (mapId, opts = {}) {
    const map = MAPS.find(m => m.id === mapId);
    if (!map) throw new Error('unknown map "' + mapId + '" — ids: ' + MAPS.map(m => m.id).join(', '));
    document.getElementById('welcome').style.display = 'none';
    document.getElementById('wrap').style.display = 'flex';
    document.getElementById('over').style.display = 'none';
    document.getElementById('over-peek').style.display = 'none';
    muted = true;                       // no AudioContext churn during tests
    startGame(map, opts);
    running = false;                    // TT.step drives frames, not rAF
    if (bgmEl) bgmEl.pause();
    return TT.ready();
  };

  // Resolves once every image a screenshot could need is decoded (item
  // sprites, receipts, coin/bag, customers, the map background). decode()
  // works in hidden tabs; already-loaded images resolve immediately.
  TT.ready = function () {
    const imgs = [];
    for (const it of ITEMS) if (it.img) imgs.push(it.img);
    if (typeof RECEIPT_ITEMS !== 'undefined')
      for (const it of RECEIPT_ITEMS) if (it.img) imgs.push(it.img);
    imgs.push(COIN_IMG, BAG_IMG, ...CUSTOMER_IMGS);
    const bgUrl = (getComputedStyle(document.getElementById('stage-bg'))
      .backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
    if (bgUrl) { const b = new Image(); b.src = bgUrl; imgs.push(b); }
    return Promise.allSettled(imgs.map(i => i.decode ? i.decode() : null))
      .then(() => 'ready: ' + ACTIVE_MAP.id +
        (HAPPY_HOUR ? ' (happy hour)' : '') +
        (COMBOS_ENABLED ? ' (combos)' : ''));
  };

  // Toggle the real rAF loop back on/off (to watch live in a visible pane).
  // While live, wall time and TT.step both move the clock — don't mix.
  TT.live = function (on) {
    if (on && !running) { running = true; lastTs = 0; idleFrames = 0; requestAnimationFrame(loop); }
    if (!on) running = false;
    return 'live=' + !!on;
  };

  TT.reset = function () {
    document.getElementById('over').style.display = 'none';
    document.getElementById('over-peek').style.display = 'none';
    resetState();
    return 'reset';
  };

  // Deterministic Math.random (mulberry32) — fixes nextTier rolls, customer
  // faces and order tiers for reproducible runs.
  TT.seed = function (s) {
    let a = s >>> 0;
    Math.random = function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    return 'seeded ' + s;
  };

  // ---- acting ------------------------------------------------------------
  // Fire a shot at PHYSICS-space target (tx,ty) — same speed/spawn/ghost/shot
  // accounting as a real pointerup, minus the 500ms reload timer.
  TT.shoot = function (tx, ty, tier) {
    if (state.gameOver) throw new Error('game over — TT.reset() first');
    if (tier !== undefined) state.nextTier = tier;
    const t = state.nextTier;
    const d = makeDrink(LAUNCH.x, LAUNCH.y - ITEMS[t].physR - 4, t, true);
    const dx = tx - LAUNCH.x, dy = ty - LAUNCH.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    Body.setVelocity(d, { x: dx / len * 27, y: dy / len * 27 });
    state.combo = 0;
    rollNext();
    return d.id;
  };

  // Place a body directly (no flight). Inside the tray it spawns solid.
  TT.spawn = function (tier, x, y, kind = 'drink') {
    return makeDrink(x, y, tier, false, false, kind).id;
  };

  // Happy Hour: force a customer in (optionally with a chosen order tier),
  // and serve by queue index.
  TT.customer = function (tier) {
    if (!HAPPY_HOUR) throw new Error('not in happy hour mode');
    const before = state.customers.length;
    spawnCustomer();
    if (state.customers.length === before) return 'queue full';
    const c = state.customers[state.customers.length - 1];
    if (tier !== undefined) c.tier = tier;
    return { slot: c.slot, tier: c.tier };
  };

  TT.serve = function (i = 0) {
    const c = state.customers[i];
    if (!c) throw new Error('no customer at index ' + i);
    if (!orderAvailable(c.tier)) return 'tier ' + c.tier + ' not on field';
    tryServeCustomer(c);
    return 'served slot ' + c.slot + ' (tier ' + c.tier + ')';
  };

  // ---- time --------------------------------------------------------------
  // Advance exactly n 60Hz frames of game time, synchronously. Runs the same
  // per-frame sequence as loop(): checkOver, combo expiry, stepPhysics,
  // render — so coins/particles/animations all progress and screenshots are
  // always current.
  TT.step = function (n = 1) {
    for (let i = 0; i < n; i++) {
      clockSkew += FRAME_MS;
      checkOver();
      if (state.combo > 0 && performance.now() - state.lastMergeAt > COMBO_WINDOW) state.combo = 0;
      stepPhysics();
      render(1);
    }
    return TT.state();
  };

  // Step until the board is fully at rest (or maxFrames). Returns frames used.
  TT.settle = function (maxFrames = 1800) {
    let f = 0;
    while (f < maxFrames) {
      TT.step(1); f++;
      const busy =
        state.coins.length || state.particles.length || state.textPops.length ||
        state.drinks.some(d => d.plugin.scale ||
          Math.hypot(d.velocity.x, d.velocity.y) > 0.05);
      if (!busy) break;
    }
    const st = TT.state(); st.settledIn = f;
    return st;
  };

  // ---- observing ---------------------------------------------------------
  TT.state = function () {
    const bodies = kind => state.drinks
      .filter(d => d.plugin.kind === kind)
      .map(d => ({
        id: d.id, tier: d.plugin.tier,
        x: Math.round(d.position.x), y: Math.round(d.position.y),
        speed: +Math.hypot(d.velocity.x, d.velocity.y).toFixed(2),
        ghost: d.plugin.ghost || undefined,
        merging: d.plugin.merging || undefined,
      }));
    return {
      map: ACTIVE_MAP.id, happyHour: HAPPY_HOUR, combosEnabled: COMBOS_ENABLED,
      score: state.coinCount, combo: state.combo, gameOver: state.gameOver,
      nextTier: state.nextTier, queuedTier: state.queuedTier,
      shotsFired: state.shotsFired, coinsInFlight: state.coins.length,
      drinks: bodies('drink'), receipts: bodies('receipt'),
      customers: state.customers.map(c => ({
        slot: c.slot, tier: c.tier,
        servable: orderAvailable(c.tier), leaving: !!c.leaveAt,
      })),
    };
  };

  // Composite #stage-bg + game canvas and POST the PNG to
  // tools/shot-receiver.py (run it first: python tools/shot-receiver.py out.png).
  // Works with the tab hidden — no rAF involved.
  TT.shot = async function (label = 'shot', port = 5599) {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tc = tmp.getContext('2d');
    const bgUrl = (getComputedStyle(document.getElementById('stage-bg'))
      .backgroundImage.match(/url\("?([^")]+)"?\)/) || [])[1];
    if (bgUrl) {
      const img = new Image(); img.src = bgUrl;
      await img.decode().catch(() => {});
      // #stage-bg uses background-size 100% 100% — same stretch here.
      if (img.naturalWidth) tc.drawImage(img, 0, 0, tmp.width, tmp.height);
    }
    tc.drawImage(canvas, 0, 0);
    const dataURL = tmp.toDataURL('image/png');
    await fetch('http://127.0.0.1:' + port + '/', { method: 'POST', mode: 'no-cors', body: dataURL });
    return label + ' posted, ' + Math.round(dataURL.length / 1024) + ' KB';
  };

  TT.help = function () {
    return [
      "await TT.start(mapId, {size, combos, happyHour}) — bypass menu; muted; rAF OFF; waits for sprites",
      "TT.seed(n)                — deterministic Math.random",
      "TT.shoot(tx, ty, tier?)   — fire nextTier (or tier) at physics point; returns body id",
      "TT.spawn(tier, x, y, kind='drink'|'receipt') — place a body directly",
      "TT.step(n=1)              — advance n frames (16.67ms virtual each), sync; returns state",
      "TT.settle(max=1800)       — step until nothing moves; adds .settledIn",
      "TT.state()                — compact JSON snapshot",
      "TT.customer(tier?) / TT.serve(i=0) — happy-hour queue control",
      "await TT.shot(label)      — composite screenshot -> shot-receiver.py :5599",
      "TT.live(true|false)       — hand control back to the real rAF loop",
      "TT.reset()                — fresh board, same run settings",
      "notes: high-score saves are stubbed out; audio muted; game clock is virtual (wall time irrelevant)",
    ];
  };

  window.TT = TT;
  console.log('[test-mode] TT ready — TT.help() for the API');
}
