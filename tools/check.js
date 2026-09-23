#!/usr/bin/env node
/**
 * check.js — the project's regression checks, run against the REAL game.
 *
 * Two things, and they exist for two failure modes that have actually cost
 * time here rather than for coverage's sake:
 *
 *   BOARD DIGESTS — this game is N maps x M modes over shared code. Every
 *   feature so far (size variants, combos, Happy Hour, `spin`, `flat`, rapid
 *   fire) is another flag threaded through the same handful of functions, and
 *   there are 60 live score variants. So the risk is never "does the new thing
 *   work" — it is "did the new flag quietly move a map nobody was looking at".
 *   This plays seeded runs across the whole matrix and compares the resulting
 *   boards to committed goldens.
 *
 *   DEPLOY PREFLIGHT — the CLAUDE.md deploy checklist as a check. Shipping a
 *   config/*.js change without bumping `?v=` does not deploy it; it ARMS it for
 *   the next deploy, which then gets the blame (this is exactly how the 9->18
 *   customer cast landed, per CLAUDE.md). Needs no browser.
 *
 *   node tools/check.js                 # both (preflight informational)
 *   node tools/check.js --deploy        # both, preflight FAILS if unbumped
 *   node tools/check.js --only=boards   # or --only=preflight / regressions
 *   node tools/check.js --update        # regenerate the board goldens
 *   node tools/check.js --base=main     # preflight baseline (default origin/main)
 *
 * Exits non-zero if anything fails, so it can gate a commit or a deploy.
 * Talks to the dev server, so start one first:  python serve.py 5500
 * Needs the `playwright` npm package, like tools/shot.js — the session-start
 * hook installs it OUTSIDE the repo (this project has no build step).
 */
const path = require('path');
const fs   = require('fs');
const { execFileSync } = require('child_process');

// The cloud container's browser, if this is one; otherwise undefined, which
// lets Playwright launch the Chromium it installed itself (CI does that —
// .github/workflows/check.yml).
const CHROME = process.env.MM_CHROME ||
  (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const ROOT   = path.join(__dirname, '..');
const GOLDEN = path.join(__dirname, 'golden', 'board-digests.json');

const args   = process.argv.slice(2);
const flag   = n => args.includes(`--${n}`);
const opt    = (n, d) => {
  const hit = args.find(a => a.startsWith(`--${n}=`));
  return hit === undefined ? d : hit.slice(n.length + 3);
};

const URL     = opt('url', 'http://localhost:5500');
const ONLY    = opt('only', 'all');
const BASE    = opt('base', 'origin/main');
const UPDATE  = flag('update');
const DEPLOY  = flag('deploy');

// Positions come out of TT.state() already rounded to whole world px. One px of
// tolerance absorbs rounding at a boundary and the last-bit float drift you get
// from a different Chromium build, while any REAL behaviour change moves items
// by far more than that. Score, item count and the tier multiset are compared
// exactly — those cannot drift.
const POS_TOL = 1;

let failures = 0;
const pass = m => console.log(`  PASS  ${m}`);
const fail = m => { failures++; console.log(`  FAIL  ${m}`); };
const warn = m => console.log(`  warn  ${m}`);

// ===========================================================================
// Deploy preflight — no browser
// ===========================================================================

function git(...a) {
  try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

// src -> cache-buster value, for every <script> index.html serves. A src with
// no `?v=` maps to null, which is meaningful: vendor/matter-0.19.0.min.js
// deliberately has none because its version is in its FILENAME.
function scriptVersions(html) {
  const out = new Map();
  const re = /<script\s+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [src, v] = m[1].split('?v=');
    out.set(src, v === undefined ? null : v);
  }
  return out;
}

function gameVersion(js) {
  const m = js && js.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function preflight() {
  // Only a deploy can actually be broken by this, so it advises during normal
  // work and blocks under --deploy.
  const note = DEPLOY ? fail : warn;
  console.log(`\n[deploy preflight]  baseline ${BASE}` +
              (DEPLOY ? '' : '  (informational — pass --deploy to enforce)'));

  let base = BASE;
  if (git('rev-parse', '--verify', '--quiet', base) === null) {
    const alt = base.replace(/^origin\//, '');
    if (git('rev-parse', '--verify', '--quiet', alt) === null) {
      warn(`no such baseline '${BASE}' — skipping (fetch it, or pass --base=)`);
      return;
    }
    base = alt;
    warn(`'${BASE}' not found, using '${base}'`);
  }

  const changed = (git('diff', '--name-only', base, '--') || '')
    .split('\n').filter(Boolean);
  if (!changed.length) { pass(`nothing differs from ${base}`); return; }

  const nowHtml  = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const baseHtml = git('show', `${base}:index.html`);
  if (baseHtml === null) { warn('cannot read index.html at the baseline'); return; }

  const now  = scriptVersions(nowHtml);
  const was  = scriptVersions(baseHtml);
  const served = changed.filter(f => now.has(f));

  if (!served.length) {
    pass(`${changed.length} file(s) changed, none of them served by index.html`);
  }

  const stale = [];
  for (const f of served) {
    const vNow = now.get(f), vWas = was.get(f);
    if (vNow === null) {
      // Referenced without a buster. Fine for vendor/, whose version lives in
      // the filename — but only if the FILENAME changed, which it did not here.
      note(`${f} changed but is served with no ?v= — an in-place edit of a ` +
           `versioned-by-filename file ships to nobody. Rename it (see vendor/README.md).`);
      continue;
    }
    if (vNow === vWas) stale.push(`${f} (still ?v=${vNow})`);
  }

  if (stale.length) {
    note(`${stale.length} served file(s) changed without a cache-buster bump:\n` +
         stale.map(s => `          ${s}`).join('\n') +
         `\n        Bump every ?v= in index.html AND GAME_VERSION in ` +
         `config/constants.js, in the same commit.`);
  } else if (served.length) {
    pass(`${served.length} served file(s) changed, all cache-busted`);
  }

  // GAME_VERSION rides along with a buster bump: it is what Mai reads off the
  // welcome screen to confirm she is current, so a silent one is a lie.
  const vNow = gameVersion(fs.readFileSync(path.join(ROOT, 'config/constants.js'), 'utf8'));
  const vWas = gameVersion(git('show', `${base}:config/constants.js`));
  const bumped = [...now.keys()].some(f => now.get(f) !== null && now.get(f) !== was.get(f));
  if (bumped) {
    if (vNow === vWas) note(`?v= was bumped but GAME_VERSION is still ${vNow}`);
    else pass(`GAME_VERSION ${vWas} -> ${vNow}`);
  }

  // The service worker is the one served file with no <script> tag to carry a
  // buster: offline.js registers it as `sw.js?v=<GAME_VERSION>`, and sw.js reads
  // that query to name its shell cache. So GAME_VERSION is its cache-buster, and
  // a changed worker under an unchanged one ships new routing code over a cache
  // still named for the old build.
  if (changed.includes('sw.js') && vNow === vWas) {
    note(`sw.js changed but GAME_VERSION is still ${vNow} — it is what names the ` +
         `offline shell cache (see offline.js). Bump it.`);
  }
}

// ===========================================================================
// Board digests — seeded runs across the map x mode matrix
// ===========================================================================

// Fixed aim points, replayed identically for every non-rapid scenario. Spread
// across the table so shots reach the walls and each other rather than stacking
// in one column.
const SHOTS = [
  [210,  90], [150, 120], [270, 110], [190,  70], [240, 140],
  [120,  95], [300, 130], [205,  80], [165, 150], [255,  60],
];
const SEED = 1337;

// Runs INSIDE the page. Returns {id: digest} for every scenario.
async function collect(page) {
  return page.evaluate(async ({ SHOTS, SEED }) => {
    const packed = arr => arr
      .map(d => [d.tier, d.x, d.y])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);

    function digest() {
      const s = TT.state();
      return {
        score: s.score, shots: s.shotsFired, over: !!s.gameOver,
        drinks: packed(s.drinks), receipts: packed(s.receipts),
        customers: s.customers.map(c => [c.slot, c.tier, !!c.servable]),
      };
    }

    const out = {};
    for (const m of MAPS.filter(m => !m.locked)) {
      const runs = [
        ['default',   {}],
        ['happyhour', { happyHour: true }],
        ['rapid',     { rapid: true }],
      ];
      // The non-default framing has its own traced boundary and its own score
      // board, so it is its own scenario — a re-trace that moved one size's
      // walls would otherwise go unnoticed.
      if (m.sizes) {
        runs.push([m.defaultSize === 'large' ? 'small' : 'large',
                   { size: m.defaultSize === 'large' ? 'small' : 'large' }]);
      }
      for (const [label, opts] of runs) {
        await TT.start(m.id, Object.assign({ seed: SEED }, opts));
        if (opts.rapid) {
          // Rapid fires itself; steer it with a fixed PATTERN rather than
          // Math.random, which the seed governs but which would also perturb
          // the tier stream this scenario exists to pin down.
          //
          // The pattern deliberately visits every regime the steering model
          // has, because a gentle waveform exercises almost none of it: a
          // mutation test (RF_TILT_MAX 0.70 -> 0.60) went completely unnoticed
          // under a slow sine, since the carriage keeps up with it and the
          // offset never reaches the clamp at all.
          for (let f = 0; f < 900; f++) {
            CANNON.dragging = true;
            switch (Math.floor(f / 120) % 5) {
              case 0: CANNON.fingerX = -90;                              break; // pin left, clamped tilt
              case 1: CANNON.fingerX = W + 90;                           break; // pin right, clamped tilt
              case 2: CANNON.fingerX = W * 0.5;                          break; // settle back to vertical
              case 3: CANNON.fingerX = W * (0.5 + 0.5 * Math.sin(f / 7)); break; // fast sweeps, big offsets
              default: CANNON.dragging = false;                                 // released: glide + spring back
            }
            TT.step(1);
          }
        } else {
          for (const [x, y] of SHOTS) { TT.shoot(x, y); TT.step(45); }
          // Only meaningful for a board that CAN come to rest. In rapid the
          // launcher keeps firing inside TT.step, so settle() would just burn
          // its 1800-frame cap; the fixed frame count above is the whole
          // scenario there.
          TT.settle();
        }
        out[`${m.id}|${label}`] = digest();
      }
    }
    return out;
  }, { SHOTS, SEED });
}

function comparePositions(label, a, b) {
  if (a.length !== b.length) return `${label}: ${b.length} vs ${a.length} expected`;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0]) return `${label}[${i}] tier ${b[i][0]}, expected ${a[i][0]}`;
    const dx = Math.abs(a[i][1] - b[i][1]), dy = Math.abs(a[i][2] - b[i][2]);
    if (dx > POS_TOL || dy > POS_TOL) {
      return `${label}[${i}] tier ${a[i][0]} at (${b[i][1]},${b[i][2]}), ` +
             `expected (${a[i][1]},${a[i][2]})`;
    }
  }
  return null;
}

function compare(golden, fresh) {
  const ids = new Set([...Object.keys(golden), ...Object.keys(fresh)]);
  for (const id of [...ids].sort()) {
    const g = golden[id], f = fresh[id];
    if (!g) { warn(`${id}: new scenario, no golden yet (run --update)`); continue; }
    if (!f) { fail(`${id}: golden exists but the scenario did not run`); continue; }
    const problems = [];
    if (f.score !== g.score) problems.push(`score ${f.score}, expected ${g.score}`);
    if (f.shots !== g.shots) problems.push(`shots ${f.shots}, expected ${g.shots}`);
    if (f.over  !== g.over)  problems.push(`gameOver ${f.over}, expected ${g.over}`);
    for (const k of ['drinks', 'receipts']) {
      const p = comparePositions(k, g[k], f[k]);
      if (p) problems.push(p);
    }
    const cg = JSON.stringify(g.customers || []), cf = JSON.stringify(f.customers || []);
    if (cg !== cf) problems.push(`customers ${cf}, expected ${cg}`);
    if (problems.length) fail(`${id}\n        ` + problems.join('\n        '));
    else pass(`${id}  (${f.drinks.length} drinks, score ${f.score})`);
  }
}

async function boards() {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch {
    console.error('playwright not found. NODE_PATH should point at ~/.cache/mm-dev/' +
                  'node_modules (see .claude/hooks/session-start.sh).');
    process.exit(2);
  }

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  try {
    await page.goto(`${URL}/?test=1`, { waitUntil: 'networkidle' });
  } catch {
    console.error(`cannot reach ${URL} — start the dev server: python serve.py 5500`);
    process.exit(2);
  }
  await page.waitForFunction(() => window.TT, { timeout: 15000 });

  console.log(`\n[board digests]  ${URL}/?test=1  seed ${SEED}`);
  const fresh = await collect(page);
  await browser.close();

  if (errs.length) fail(`page errors during the run:\n        ${errs.join('\n        ')}`);

  if (UPDATE) {
    fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
    fs.writeFileSync(GOLDEN, JSON.stringify({
      note: 'Generated by tools/check.js --update. Regenerate ONLY when a ' +
            'physics/gameplay change is intended, and read the diff.',
      generated: new Date().toISOString().slice(0, 10),
      seed: SEED,
      scenarios: fresh,
    }, null, 1) + '\n');
    console.log(`  wrote ${Object.keys(fresh).length} scenarios to ` +
                `${path.relative(ROOT, GOLDEN)}`);
    return;
  }

  if (!fs.existsSync(GOLDEN)) {
    console.error(`  no goldens at ${path.relative(ROOT, GOLDEN)} — run --update first`);
    process.exit(2);
  }
  compare(JSON.parse(fs.readFileSync(GOLDEN, 'utf8')).scenarios, fresh);
}

// ===========================================================================
// Regressions — one probe per bug that was fixed, run against the real game
// ===========================================================================
//
// Each of these was found by a review (2026-09-23) and reproduced in exactly
// this form before it was fixed, so each probe FAILS on the old code. They are
// behavioural, not source greps: a probe that only checked a line of code
// would pass again the moment someone rewrote the fix in a different shape.

// A hidden page HOLDS its queued rAF callbacks and runs them on return, rather
// than dropping them. Headless Chromium never really hides, so model that:
// a callback that fires while "hidden" parks itself until the page is shown.
function holdRafWhileHidden() {
  const real = window.requestAnimationFrame.bind(window);
  window.__hidden = false; window.__held = []; window.__loopTs = [];
  window.requestAnimationFrame = cb => real(function wrapped(ts) {
    if (window.__hidden) { window.__held.push(wrapped); return; }
    if (cb.name === 'loop') window.__loopTs.push(ts);
    cb(ts);
  });
  Object.defineProperty(document, 'hidden', { get: () => window.__hidden });
  window.__setHidden = h => {
    window.__hidden = h;
    document.dispatchEvent(new Event('visibilitychange'));
    if (!h) { const q = window.__held; window.__held = []; q.forEach(f => real(f)); }
  };
}

async function regressions(browser) {
  console.log('\n[regressions]');

  // --- 1..3 run in test mode --------------------------------------------
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${URL}/?test=1`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.TT, { timeout: 15000 });

  // A score NAME is text. A backup code can carry any name (its checksum is a
  // typo check, not a signature), and both score lists build HTML strings.
  const xss = await page.evaluate(async () => {
    await TT.start('hawaii', { seed: 1 });
    const name = '<img src=x onerror="window.__pwned=1">';
    const key = currentScoreKey();
    const had = localStorage.getItem(key);
    localStorage.setItem(key, JSON.stringify([{ name, score: 5 }]));
    const shown = [];
    showScorePanel(state);
    shown.push(document.querySelector('#sp-list .sr-name').textContent);
    hideScorePanel();
    showGameOver(state, key);
    shown.push(document.querySelector('#finalScore .sr-name').textContent);
    document.getElementById('over').style.display = 'none';
    if (had === null) localStorage.removeItem(key); else localStorage.setItem(key, had);
    await new Promise(r => setTimeout(r, 200));   // give an injected onerror time to fire
    return { ran: !!window.__pwned, literal: shown.every(t => t === name) };
  });
  if (!xss.ran && xss.literal) pass('a score name renders as text, not markup');
  else fail(`score name rendered as markup (script ran: ${xss.ran}, shown literally: ${xss.literal})`);

  // receipt-stack is a CAPSULE, so a merge that grows one in must re-lock its
  // inertia like any other capsule. Kyoto and Napoli are the maps whose own
  // tier 3 is a circle, which is where asking ITEMS[tier] got it wrong.
  for (const map of ['kyoto', 'pizza']) {
    const r = await page.evaluate(async map => {
      await TT.start(map, { seed: 1, happyHour: true });
      const t = 2, R = RECEIPT_ITEMS[t].physR;
      TT.spawn(t, 200, 300, 'receipt'); TT.spawn(t, 200 + R * 0.5, 300, 'receipt');
      TT.step(30);
      const d = state.drinks.find(d => d.plugin.kind === 'receipt' && d.plugin.tier === 3);
      if (!d) return null;
      // Knock it off-centre, hard enough that an unlocked body visibly turns.
      const s = makeDrink(d.position.x - 80, d.position.y - 12, 0);
      Body.setVelocity(s, { x: 12, y: 0 });
      TT.step(90);
      return { locked: !isFinite(d.inertia), deg: Math.abs(d.angle - (RECEIPT_ITEMS[3].cap.rot || 0)) * 180 / Math.PI };
    }, map);
    if (!r) fail(`${map}: the two receipts did not merge into a receipt stack`);
    else if (r.locked && r.deg < 0.5) pass(`${map}: a grown-in receipt stack stays locked upright`);
    else fail(`${map}: receipt stack turned ${r.deg.toFixed(1)} deg (inertia locked: ${r.locked})`);
  }

  // The classic 500ms reload belongs to the run that fired it. "Play again"
  // inside that window must not roll the NEW run's queue on.
  const reload = await page.evaluate(async () => {
    await TT.start('kyoto', { seed: 7 });
    fireShot(state, 0, -1);
    resetState();                                  // what "Play again" does
    const before = [state.nextTier, state.queuedTier];
    await new Promise(r => setTimeout(r, 700));
    return { before, after: [state.nextTier, state.queuedTier] };
  });
  if (JSON.stringify(reload.before) === JSON.stringify(reload.after)) {
    pass('a reload timer from the last run leaves the new run\'s queue alone');
  } else {
    fail(`the last run's reload rolled the new queue ${JSON.stringify(reload.before)} -> ` +
         JSON.stringify(reload.after));
  }
  // Parked MID-RELOAD (the cradle empty, nextTier still naming the drink just
  // fired): Continue must deal what was coming next, not the same drink again.
  const parked = await page.evaluate(async () => {
    await TT.start('kyoto', { seed: 3 });
    const fired = state.nextTier, coming = state.queuedTier;
    fireShot(state, 0, -1);                        // classic: 500ms reload starts
    SUSPEND.persistEnabled = true;                 // test mode stubs it; one save
    SUSPEND.save();
    const p = SUSPEND.load('kyoto');
    await TT.start('kyoto', { resume: p });
    SUSPEND.persistEnabled = false;
    return { fired, coming, dealt: state.nextTier, canShoot: state.canShoot };
  });
  if (parked.dealt === parked.coming && parked.canShoot) {
    pass('Continue after quitting mid-reload deals the next drink, not the fired one');
  } else {
    fail(`Continue mid-reload dealt tier ${parked.dealt}; fired ${parked.fired}, ` +
         `next was ${parked.coming}`);
  }

  // A bug report from a rapid run must replay AS rapid.
  const rapidMeta = await page.evaluate(async () => {
    await TT.start('hawaii', { seed: 1, rapid: true });
    TT.step(200);
    return !!BUGLOG.decode(BUGLOG.code()).meta.rapid;
  });
  if (rapidMeta) pass('a bug report records rapid fire');
  else fail('a bug report from a rapid run does not say it was rapid');
  await page.close();

  // No ctx.roundRect (iOS/iPadOS 15): the frame must still finish, or coins
  // never land and the score sticks at 0.
  const old = await browser.newPage();
  old.on('pageerror', e => errs.push('[no roundRect] ' + String(e)));
  await old.addInitScript(() => { delete CanvasRenderingContext2D.prototype.roundRect; });
  await old.goto(`${URL}/?test=1`, { waitUntil: 'networkidle' });
  await old.waitForFunction(() => window.TT, { timeout: 15000 });
  // TT.step runs render() synchronously, so on the old code the throw lands
  // here rather than in pageerror — report it as a failure, don't crash.
  const noRR = await old.evaluate(async () => {
    await TT.start('hawaii', { seed: 1 });
    const R = ITEMS[0].physR;
    TT.spawn(0, 200, 300); TT.spawn(0, 200 + R * 0.5, 300);   // one merge -> coins
    TT.step(240);
    return state.coinCount;
  }).catch(e => String(e).split('\n')[0]);
  await old.close();
  if (noRR > 0) pass('without ctx.roundRect the HUD draws and coins still land');
  else fail(`without ctx.roundRect the frame failed or no coin landed (${noRR})`);

  // --- 4: the live loop, so NOT test mode ----------------------------------
  // Every trip to the background used to add a render-loop chain. Count loop
  // calls per frame timestamp after three trips: one chain means one call.
  const live = await browser.newPage();
  live.on('pageerror', e => errs.push(String(e)));
  await live.addInitScript(holdRafWhileHidden);
  await live.goto(`${URL}/`, { waitUntil: 'networkidle' });
  await live.waitForFunction(() => typeof launchMap === 'function');
  const chains = await live.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    launchMap(MAPS.find(m => m.id === 'kyoto'), null);
    await wait(200);
    for (let i = 0; i < 3; i++) { window.__setHidden(true); await wait(80); window.__setHidden(false); await wait(80); }
    window.__loopTs = [];
    await wait(400);
    const per = {};
    for (const ts of window.__loopTs) per[ts] = (per[ts] || 0) + 1;
    returnToMenu();
    return { frames: Object.keys(per).length, most: Math.max(0, ...Object.values(per)) };
  });
  if (chains.frames && chains.most === 1) pass('backgrounding three times leaves one render loop');
  else fail(`after three trips to the background: ${chains.most} loop calls per frame ` +
            `(${chains.frames} frames sampled)`);

  // A full or blocked localStorage must not throw out of the game-over save.
  const quota = await live.evaluate(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    try { saveScore('mm_s_probe', 5); return null; }
    catch (e) { return String(e); }
    finally { Storage.prototype.setItem = real; }
  });
  if (quota === null) pass('saveScore survives a storage that refuses writes');
  else fail(`saveScore threw with storage full: ${quota}`);

  // High scores ride in the IndexedDB mirror and come back when localStorage
  // loses them. (Fresh browser profile — nothing real is touched.)
  await live.evaluate(() => {
    saveScore('mm_s_hawaii', 4321);
    dispatchEvent(new Event('pagehide'));          // flushes the mirror now
  });
  await live.waitForTimeout(400);
  await live.evaluate(() => localStorage.removeItem('mm_s_hawaii'));
  await live.reload({ waitUntil: 'networkidle' });
  await live.waitForTimeout(400);                  // the async recovery
  const restored = await live.evaluate(() => getScores('mm_s_hawaii').map(e => e.score));
  await live.close();
  if (restored.includes(4321)) pass('a score board lost from localStorage comes back from IndexedDB');
  else fail(`score board not restored from the IndexedDB mirror (got ${JSON.stringify(restored)})`);

  await offlineProbes(browser, errs);

  if (errs.length) fail(`page errors during the regressions:\n        ${errs.join('\n        ')}`);
}

// The service worker only registers on the dev server with ?offline=1, and it
// needs a context of its own: a worker outlives the page that registered it.
async function offlineProbes(browser, errs) {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('[offline] ' + String(e)));
  const fromSW = [];
  ctx.on('request', r => {
    if (r.serviceWorker() && r.url().includes('/assets/')) fromSW.push(r.url());
  });
  const start = async () => {
    await page.evaluate(() => launchMap(MAPS.find(m => m.id === 'kyoto'), null));
    await page.waitForTimeout(1200);
    await page.evaluate(() => returnToMenu());
  };

  await page.goto(`${URL}/?offline=1`, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });          // now controlled
  await start();                                           // fills the asset cache
  await page.reload({ waitUntil: 'networkidle' });
  fromSW.length = 0;
  await start();                                           // everything is cached now
  if (!fromSW.length) pass('a cached map is served without refetching its assets');
  else fail(`a cached map refetched ${fromSW.length} asset(s) in the background, e.g. ` +
            fromSW[0].replace(URL, ''));

  // An UPDATE whose shell precache half-fails must not go live: the previous
  // worker and its complete shell cache stay.
  await ctx.route(/\/style\.css/, r => r.abort());
  const upd = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('sw.js?v=probe-update');
    const w = reg.installing || reg.waiting || reg.active;
    await new Promise(res => {
      if (!w || w.state === 'redundant' || w.state === 'activated') return res();
      w.addEventListener('statechange', () => {
        if (w.state === 'redundant' || w.state === 'activated') res();
      });
    });
    return { state: w && w.state, caches: await caches.keys() };
  });
  await ctx.unroute(/\/style\.css/);
  const keptOld = upd.caches.some(n => n.startsWith('mm-shell-') && n !== 'mm-shell-probe-update');
  if (upd.state === 'redundant' && keptOld && !upd.caches.includes('mm-shell-probe-update')) {
    pass('a half-failed shell update is rejected and the previous offline copy kept');
  } else {
    fail(`half-failed update: worker ${upd.state}, caches ${JSON.stringify(upd.caches)}`);
  }
  await ctx.close();
}

async function withBrowser(fn) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch {
    console.error('playwright not found. NODE_PATH should point at ~/.cache/mm-dev/' +
                  'node_modules (see .claude/hooks/session-start.sh).');
    process.exit(2);
  }
  const browser = await chromium.launch({ executablePath: CHROME });
  try { await fn(browser); } finally { await browser.close(); }
}

// ===========================================================================

(async () => {
  const t0 = Date.now();
  if (ONLY === 'all' || ONLY === 'preflight') {
    preflight();
  }
  if (ONLY === 'all' || ONLY === 'boards') await boards();
  if (!UPDATE && (ONLY === 'all' || ONLY === 'regressions')) await withBrowser(regressions);
  console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}` +
              `  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(failures ? 1 : 0);
})();
