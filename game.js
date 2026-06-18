const { Engine, Bodies, Body, Composite, Events } = Matter;

// ---------- sizing ----------
// W and H are declared in config/constants.js
const canvas = document.getElementById('c');
const dpr = window.devicePixelRatio || 1;

// fitCanvas() can scale the CSS box up to MAX_SCALE. By rendering at that
// resolution upfront the browser never has to upscale the canvas, which
// would cause blurring on desktop. On small screens it simply downscales
// (even sharper). Game-world coordinates stay at W × H throughout.
const MAX_SCALE = 1.6;
canvas.width  = Math.round(W * dpr * MAX_SCALE);
canvas.height = Math.round(H * dpr * MAX_SCALE);
canvas.style.width  = W + 'px';
canvas.style.height = H + 'px';
const ctx = canvas.getContext('2d');
ctx.scale(dpr * MAX_SCALE, dpr * MAX_SCALE);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

function fitCanvas() {
  const availW = window.innerWidth - 16;
  const availH = window.innerHeight - 16;
  const scale = Math.min(availW / W, availH / H, 1.6);
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
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
const wallOpts = { isStatic: true, restitution: 0.08 };
const WALL_INSET = 10;
Composite.add(engine.world, [
  Bodies.rectangle(W / 2,               -30,   W * 2, 60,   wallOpts),
  Bodies.rectangle(-30 + WALL_INSET,     H / 2, 60,   H * 2, wallOpts),
  Bodies.rectangle(W + 30 - WALL_INSET,  H / 2, 60,   H * 2, wallOpts),
]);

// ---------- per-map corner walls ----------
let mapWalls = [];

function applyMapWalls(map) {
  mapWalls.forEach(w => Composite.remove(engine.world, w));
  mapWalls = [];
  if (!map.cornerWalls) return;
  mapWalls = map.cornerWalls.map(c =>
    Bodies.rectangle(c.x, c.y, c.len, 28, { ...wallOpts, angle: c.angle })
  );
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
    restitution: 0.08, frictionAir: 0.028, friction: 0.3, density: 0.0012,
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

function render() {
  wob += 0.05;
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
    recoil *= 0.82;
    if (state.canShoot) drawDrink(sl.x, sl.y + recoil, state.nextTier, 1, wob);
  }

  drawParticles(state.particles);
  state.particles = state.particles.filter(p => p.life > 0);

  drawNextPreview(state.queuedTier);

  drawBag(state.coinCount);
  state.coins = updateCoins(state.coins, () => {
    state.coinCount += 10;
    coinTick();
  });
  drawCoins(state.coins);
}

function loop() {
  if (!running) return;
  Engine.update(engine, 1000 / 60);
  render();
  checkOver();
  requestAnimationFrame(loop);
}

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
    loop();
  }
}

function returnToMenu() {
  running = false;
  if (bgmEl) { bgmEl.pause(); bgmEl.currentTime = 0; }
  showWelcome();
}
