const { Engine, Bodies, Body, Composite, Events } = Matter;

// ---------- sizing ----------
// W and H are declared in config/constants.js
const canvas = document.getElementById('c');
const dpr = window.devicePixelRatio || 1;

// Game-world coordinates stay at W × H throughout; fitCanvas() sizes both the
// CSS box (up to MAX_SCALE) and the backing store. The backing store is only
// as large as it needs to be for the display size — the device-pixel-ratio is
// capped at MAX_PR so high-DPR phones don't render millions of wasted pixels
// every frame (that oversampling is the biggest source of heat/battery drain).
const MAX_SCALE = 1.6;  // max CSS upscale of the world box
const MAX_PR    = 2;    // cap on backing-store pixel ratio
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const availW = window.innerWidth  - 16;
  const availH = window.innerHeight - 16;
  if (availW <= 0 || availH <= 0) return;  // viewport not ready (e.g. mid orientation change)
  const disp   = Math.min(availW / W, availH / H, MAX_SCALE);
  canvas.style.width  = (W * disp) + 'px';
  canvas.style.height = (H * disp) + 'px';

  const pr = Math.min(dpr, MAX_PR);
  canvas.width  = Math.round(W * disp * pr);
  canvas.height = Math.round(H * disp * pr);
  const s = canvas.width / W;  // uniform world→pixel scale (aspect preserved)
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// ---------- perspective ----------
const HORIZON   = H * 0.285;
const NEAR_Y    = H;
const FAR_SCALE = 0.55;
const FAR_W     = W * 0.74;

function persp(wx, wy) {
  const t = wy / H;
  const scale = FAR_SCALE + (1 - FAR_SCALE) * t;
  const rowW  = FAR_W + (W - FAR_W) * t;
  const sx    = W / 2 + (wx - W / 2) * (rowW / W);
  const sy    = HORIZON + (NEAR_Y - HORIZON) * t;
  return { x: sx, y: sy, s: scale };
}

function unpersp(sx, sy) {
  const t  = Math.max(0, Math.min(1, (sy - HORIZON) / (NEAR_Y - HORIZON)));
  const rowW = FAR_W + (W - FAR_W) * t;
  const wx = W / 2 + (sx - W / 2) * (W / rowW);
  return { x: wx, y: t * H };
}

// ---------- physics ----------
const engine = Engine.create();
engine.gravity.y = 0; engine.gravity.x = 0;
const wallOpts = { isStatic: true, restitution: 0.02 };
const WALL_INSET = 0;
Composite.add(engine.world, [
  Bodies.rectangle(W / 2,               -30,   W * 2, 60,   wallOpts),
  Bodies.rectangle(-30 + WALL_INSET,     H / 2, 60,   H * 2, wallOpts),
  Bodies.rectangle(W + 30 - WALL_INSET,  H / 2, 60,   H * 2, wallOpts),
]);

// ---------- per-map corner walls ----------
let mapWalls = [];

// Build the boundary from a dense chain of overlapping static circles rather
// than angled rectangles. Chained rectangles meet at inner corners that poke
// toward the play area — those notches are what items snag on. We also smooth
// the traced polyline with Chaikin corner-cutting first, so the arc is a clean
// curve rather than a jaggy zigzag, then lay circles (which have no corners of
// their own) densely along it.
const WALL_R   = 13;  // circle radius; ×2 gives ~26px effective wall thickness
const WALL_MIN = 7;   // minimum spacing between adjacent circle centres

// Chaikin corner-cutting: replace each span with two points 1/4 and 3/4 along
// it, keeping the endpoints. Each pass rounds the polyline; a few passes make
// it visually smooth.
function chaikin(pts, passes) {
  for (let p = 0; p < passes; p++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function applyMapWalls(map) {
  mapWalls.forEach(w => Composite.remove(engine.world, w));
  mapWalls = [];
  if (!map.cornerWalls) return;

  // 1. Reconstruct the ordered boundary polyline from the segment endpoints,
  //    merging the near-duplicate points where consecutive segments join.
  let pts = [];
  for (const c of map.cornerWalls) {
    const hx = Math.cos(c.angle) * c.len / 2;
    const hy = Math.sin(c.angle) * c.len / 2;
    pts.push({ x: c.x - hx, y: c.y - hy });
    pts.push({ x: c.x + hx, y: c.y + hy });
  }
  const merged = [];
  for (const p of pts) {
    const last = merged[merged.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < WALL_MIN) {
      last.x = (last.x + p.x) / 2; last.y = (last.y + p.y) / 2;
    } else {
      merged.push({ x: p.x, y: p.y });
    }
  }

  // 2. Smooth, then 3. lay circles — thinning any that crowd together.
  const curve = chaikin(merged, 3);
  let lastP = null;
  for (const p of curve) {
    if (lastP && Math.hypot(p.x - lastP.x, p.y - lastP.y) < WALL_MIN) continue;
    mapWalls.push(Bodies.circle(p.x, p.y, WALL_R, wallOpts));
    lastP = p;
  }
  Composite.add(engine.world, mapWalls);
}

// ---------- game state ----------
const DROP_MAX   = 4;
const DANGER_WY  = H - 150;

const state = {
  drinks:     [],
  particles:  [],
  coins:      [],
  coinCount:  0,
  gameOver:   false,
  nextTier:   0,
  queuedTier: 0,
  canShoot:   true,
};

function makeDrink(x, y, tier) {
  const b = Bodies.circle(x, y, ITEMS[tier].physR, {
    restitution: 0.02, frictionAir: 0.028, friction: 0.3, density: 0.0012,
  });
  b.plugin = { tier, born: performance.now(), merging: false };
  Composite.add(engine.world, b);
  state.drinks.push(b);
  return b;
}

function rollNext() {
  state.nextTier   = state.queuedTier;
  state.queuedTier = Math.floor(Math.random() * DROP_MAX);
}

function resetState() {
  for (const d of state.drinks) Composite.remove(engine.world, d);
  state.drinks = []; state.particles = []; state.coins = [];
  state.coinCount = 0; state.gameOver = false; state.canShoot = true;
  LAUNCH.x = W / 2;
  state.queuedTier = Math.floor(Math.random() * DROP_MAX);
  rollNext();
}

// ---------- merging ----------
Events.on(engine, 'collisionStart', ev => {
  for (const pair of ev.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    if (!a.plugin || !b.plugin) continue;
    const rvx = a.velocity.x - b.velocity.x, rvy = a.velocity.y - b.velocity.y;
    clink(Math.hypot(rvx, rvy));
    if (a.plugin.merging || b.plugin.merging) continue;
    if (a.plugin.tier === b.plugin.tier && a.plugin.tier < ITEMS.length - 1) {
      a.plugin.merging = b.plugin.merging = true;
      const tier = a.plugin.tier;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;
      Composite.remove(engine.world, a); Composite.remove(engine.world, b);
      state.drinks = state.drinks.filter(d => d !== a && d !== b);
      makeDrink(mx, my, tier + 1);
      const sp = persp(mx, my);
      burst(sp.x, sp.y, ITEMS[tier + 1].liq, ITEMS[tier + 1].r * sp.s, state.particles);
      spawnCoins(sp.x, sp.y, Math.min(6, 2 + tier), state.coins);
      pop(tier);
      triggerShake();
    }
  }
});

// ---------- game-over check ----------
function checkOver() {
  if (state.gameOver) return;
  const now = performance.now();
  for (const d of state.drinks) {
    if (now - d.plugin.born < 1500) continue;
    const speed = Math.hypot(d.velocity.x, d.velocity.y);
    if (d.position.y + ITEMS[d.plugin.tier].physR > DANGER_WY && speed < 0.15) {
      state.gameOver = true;
      showGameOver(state, ACTIVE_MAP.id);
    }
  }
}

// ---------- wire UI ----------
wireInput(canvas, state);
wireHUD(state);

// ---------- render loop ----------
let running = false;
let wob = 0;
let lastTs = 0;

function render(dt) {
  wob += 0.05 * dt;
  drawBackground();
  drawDangerLine(DANGER_WY);

  const sl = persp(LAUNCH.x, LAUNCH.y);
  drawAimLine(aiming, state.gameOver, sl, aimX, aimY);

  const sorted = [...state.drinks].sort((a, b) => a.position.y - b.position.y);
  for (const d of sorted) {
    const born   = (performance.now() - d.plugin.born) / 200;
    const growth = Math.min(1, 0.6 + born * 0.4);
    const p      = persp(d.position.x, d.position.y);
    drawDrink(p.x, p.y, d.plugin.tier, p.s * growth, wob + d.id);
  }

  if (!state.gameOver) {
    recoil *= Math.pow(0.82, dt);
    if (state.canShoot) drawDrink(sl.x, sl.y + recoil, state.nextTier, 1, wob);
  }

  drawParticles(state.particles, dt);
  state.particles = state.particles.filter(p => p.life > 0);

  drawNextPreview(state.queuedTier);

  drawBag(state.coinCount, dt);
  state.coins = updateCoins(state.coins, dt, () => {
    state.coinCount += 10;
    coinTick();
  });
  drawCoins(state.coins);
}

const FRAME_MS = 1000 / 60;
// Items are shot fast (~27px/step). A single physics step lets them jump deep
// into a thin wall in one go, which Matter resolves by ejecting them inward
// with a "pop" — so shots bounced back toward centre instead of sliding along
// the edge. Splitting the frame into substeps keeps each step's motion small
// enough to collide cleanly, so items graze and slide instead. Physics is cheap
// next to drawing, so this costs little heat.
const SUBSTEPS = 3;

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  // Cap to ~60fps: on 120Hz phones rAF fires twice as often, so skip the
  // extra frames rather than doing double the physics + drawing work (heat).
  if (lastTs && ts - lastTs < FRAME_MS - 1) return;
  const dt = lastTs ? Math.min((ts - lastTs) / FRAME_MS, 3) : 1;
  lastTs = ts;
  for (let i = 0; i < SUBSTEPS; i++) Engine.update(engine, FRAME_MS / SUBSTEPS);
  render(dt);
  checkOver();
}

// Stop burning cycles when the tab/app is backgrounded; resume on return.
document.addEventListener('visibilitychange', () => {
  const onGameScreen = document.getElementById('wrap').style.display !== 'none';
  if (document.hidden) {
    running = false;
  } else if (onGameScreen && !running) {
    running = true; lastTs = 0; requestAnimationFrame(loop);
  }
});

function startGame(map) {
  ACTIVE_MAP = map;
  ITEMS = ACTIVE_MAP.itemsData;
  applyMapWalls(ACTIVE_MAP);
  loadMapAssets(ACTIVE_MAP);
  setSoundProfile(ACTIVE_MAP.id);
  initMusic(document.getElementById('bgm'), ACTIVE_MAP.bgmVol, ACTIVE_MAP.bgm);
  resetState();
  if (!running) {
    running = true;
    lastTs = 0;
    requestAnimationFrame(loop);
  }
}

function returnToMenu() {
  running = false;
  if (bgmEl) { bgmEl.pause(); bgmEl.currentTime = 0; }
  showWelcome();
}
