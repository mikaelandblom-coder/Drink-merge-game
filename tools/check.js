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
 *   node tools/check.js --only=boards   # or --only=preflight
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

const CHROME = process.env.MM_CHROME || '/opt/pw-browsers/chromium';
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
  const bumped = [...now.keys()].some(f => now.get(f) !== null && now.get(f) !== was.get(f));
  if (bumped) {
    const vNow = gameVersion(fs.readFileSync(path.join(ROOT, 'config/constants.js'), 'utf8'));
    const vWas = gameVersion(git('show', `${base}:config/constants.js`));
    if (vNow === vWas) note(`?v= was bumped but GAME_VERSION is still ${vNow}`);
    else pass(`GAME_VERSION ${vWas} -> ${vNow}`);
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

(async () => {
  const t0 = Date.now();
  if (ONLY === 'all' || ONLY === 'preflight') {
    preflight();
  }
  if (ONLY === 'all' || ONLY === 'boards') await boards();
  console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}` +
              `  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  process.exit(failures ? 1 : 0);
})();
