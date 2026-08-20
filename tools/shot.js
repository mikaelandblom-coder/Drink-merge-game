#!/usr/bin/env node
/**
 * shot.js — screenshot and measure the real game in a headless browser.
 *
 * The game is a browser page whose whole point is how it LOOKS, so verifying a
 * UI change means rendering it. This exists because that script kept being
 * rewritten from scratch per session, each time rediscovering the same three
 * things: which Chromium binary to launch, that the menu scrolls inside a
 * fixed element (so `fullPage` captures nothing extra), and that byte counts
 * need the response headers rather than the file sizes on disk.
 *
 * It talks to the dev server, so start one first:  python serve.py 5500
 *
 *   node tools/shot.js menu.png                     # the welcome screen
 *   node tools/shot.js game.png --map=kyoto         # a started run
 *   node tools/shot.js all.png --height=3400        # the whole card list
 *   node tools/shot.js phone.png --width=390 --dsf=2
 *   node tools/shot.js x.png --bytes                # + a first-paint byte report
 *   node tools/shot.js x.png --eval="ACTIVE_MAP.id" # + evaluate an expression
 *
 * Options: --url --width --height --dsf --map --wait --bytes --eval --scores
 * Needs the `playwright` npm package; .claude/hooks/session-start.sh installs
 * it outside the repo (this project has no build step and no node_modules).
 */
const path = require('path');

const CHROME = process.env.MM_CHROME || '/opt/pw-browsers/chromium';
const args = process.argv.slice(2);
const out = args.find(a => !a.startsWith('--'));
const opt = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? dflt : hit.slice(name.length + 3);
};
const flag = name => args.includes(`--${name}`);

if (!out) {
  console.error('usage: node tools/shot.js <out.png> [--map=id] [--width=480] [--bytes]');
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('playwright not found. Install it outside the repo:\n' +
    '  npm install --prefix ~/.cache/mm-dev playwright\n' +
    '  export NODE_PATH=~/.cache/mm-dev/node_modules');
  process.exit(2);
}

(async () => {
  const url = opt('url', 'http://localhost:5500/?test=1');
  const width = Number(opt('width', 480));
  const height = Number(opt('height', 900));
  const dsf = Number(opt('dsf', 2));
  const map = opt('map', null);
  const wait = Number(opt('wait', map ? 1500 : 700));

  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dsf });

  // Everything the page says about itself, reported at the end — a silent
  // screenshot of a broken page is the failure mode this guards against.
  const errors = [], external = [], responses = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(new URL(url).origin)) external.push(r.url()); });
  page.on('response', r => responses.push([r.url(), Number(r.headers()['content-length'] || 0)]));

  // Fake score boards, so the menu isn't a wall of em-dashes in a screenshot.
  if (flag('scores')) {
    await page.addInitScript(() => {
      localStorage.setItem('mm_s_hawaii', JSON.stringify([{ score: 2150 }, { score: 1480 }, { score: 960 }]));
      localStorage.setItem('mm_s_kyoto', JSON.stringify([{ score: 5400 }, { score: 3110 }]));
    });
  }

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    console.error(`could not reach ${url} — is the dev server up?  (python serve.py 5500)`);
    await browser.close();
    process.exit(1);
  }
  await page.waitForTimeout(400);

  if (map) {
    await page.click(`.map-card[data-map="${map}"] .play-btn`);
  }
  await page.waitForTimeout(wait);

  // NOTE: no `fullPage`. #welcome is position:fixed with its own overflow-y,
  // so the DOCUMENT is always one viewport tall and fullPage adds nothing —
  // pass --height to see more of the menu instead.
  await page.screenshot({ path: path.resolve(out) });

  if (flag('bytes')) {
    const total = responses.reduce((n, [, len]) => n + len, 0);
    const top = responses.filter(r => r[1] > 8192)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([u, n]) => `    ${(n / 1024).toFixed(0).padStart(5)} KB  ${u.replace(new URL(url).origin + '/', '')}`);
    console.log(`bytes: ${(total / 1024).toFixed(0)} KB over ${responses.length} requests`);
    console.log(top.join('\n'));
  }

  const expr = opt('eval', null);
  if (expr) console.log('eval:', JSON.stringify(await page.evaluate(expr)));

  console.log(`wrote ${out} (${width}x${height} @${dsf}x${map ? `, map=${map}` : ''})`);
  if (external.length) console.log('cross-origin requests:', external);
  console.log(errors.length ? `PAGE ERRORS:\n  ${errors.join('\n  ')}` : 'page errors: none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
