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
  rebuildBgCache();  // backing size changed — re-scale the cached background
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

// ---------- perspective ----------
// The horizon (vanishing row) is per-map: each background's art has its own —
// set via the hitbox editor and stored in config/hitboxes.js. startGame()
// applies the active map's value.
const DEFAULT_HORIZON = H * 0.285;
let HORIZON     = DEFAULT_HORIZON;
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
// Only the top wall is global; the left/right side walls are created per-map in
// applyMapWalls so a map can widen its field (see map.sideInset).
Composite.add(engine.world, [
  Bodies.rectangle(W / 2, -30, W * 2, 60, wallOpts),
]);

// ---------- per-map walls ----------
let mapWalls = [];

// Free-shot zone: below the per-map free line (map.freeLine, set in the hitbox
// editor), a freshly SHOT item ignores the traced boundary walls so shooting
// never clips the shape's lower edges near the launcher. The item turns solid
// ("interacts with the environment") the moment it crosses above the line,
// touches another item, or settles — and stays solid forever after.
const CAT_TRAY = 0x0002;          // collision category of the traced walls
let FREE_WY = Infinity;           // physics y of the free line (Infinity = off)
let COMBOS_ENABLED = false;       // cascade-merge multipliers (set per run in startGame)
let ACTIVE_SIZE = null;           // table-size variant of the current run (for score keys)
let trayWalls = [];               // just the traced boundary bodies
let trayPoly  = [];               // boundary polygon (physics coords) for the inside test

function solidify(d) {
  d.plugin.ghost = false;
  d.collisionFilter.mask = -1;
}

// Never solidify a ghost while it geometrically overlaps a traced wall —
// restoring its collision mask mid-overlap makes Matter eject it violently
// (shots bounced backwards). Deferred ghosts are retried every frame and
// solidify as soon as they emerge from the wall.
function trySolidify(d) {
  if (Matter.Query.collides(d, trayWalls).length === 0) solidify(d);
}

// Ordered boundary polygon from the wall segments' endpoints. For open splines
// the ray-cast implicitly closes last->first, which spans the launcher opening
// — exactly the "entrance" edge.
function buildTrayPoly(cornerWalls) {
  const pts = [];
  for (const c of cornerWalls) {
    const hx = Math.cos(c.angle) * c.len / 2, hy = Math.sin(c.angle) * c.len / 2;
    const a = { x: c.x - hx, y: c.y - hy };
    if (!pts.length || Math.hypot(a.x - pts[pts.length-1].x, a.y - pts[pts.length-1].y) > 6) pts.push(a);
    pts.push({ x: c.x + hx, y: c.y + hy });
  }
  return pts;
}

function insideTray(x, y) {
  const p = trayPoly;
  if (!p.length) return true;     // no traced boundary -> whole field is interior
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if ((p[i].y > y) !== (p[j].y > y) &&
        x < (p[j].x - p[i].x) * (y - p[i].y) / (p[j].y - p[i].y) + p[i].x) inside = !inside;
  }
  return inside;
}

// Build the tray boundary directly from the traced polygon: one thin static
// rectangle per edge (the cornerWalls entries already store each edge as
// centre/length/angle). Each rectangle is lengthened a little so neighbours
// overlap at the joints (no gaps), and its corners are chamfered (rounded) so
// items slide across the joints instead of snagging on a sharp inner corner.
const WALL_THICK   = 24;  // wall thickness (px)
const WALL_OVERLAP = 8;   // extra length so adjacent edges overlap at joints

function applyMapWalls(map) {
  mapWalls.forEach(w => Composite.remove(engine.world, w));
  mapWalls = [];

  // Left/right side walls. A negative sideInset lets items travel slightly past
  // the normal physics edge, which the perspective transform then renders
  // further out — i.e. a wider play field (used by round trays like Saigon).
  const inset = map.sideInset || 0;
  mapWalls.push(Bodies.rectangle(-30 + inset,     H / 2, 60, H * 2, wallOpts));
  mapWalls.push(Bodies.rectangle(W + 30 - inset,  H / 2, 60, H * 2, wallOpts));

  trayWalls = [];
  trayPoly  = [];
  if (map.cornerWalls) {
    for (const c of map.cornerWalls) {
      trayWalls.push(Bodies.rectangle(c.x, c.y, c.len + WALL_OVERLAP, WALL_THICK, {
        ...wallOpts, angle: c.angle, chamfer: { radius: WALL_THICK / 2 },
        collisionFilter: { group: 0, category: CAT_TRAY, mask: -1 },
      }));
    }
    mapWalls.push(...trayWalls);
    trayPoly = buildTrayPoly(map.cornerWalls);
  }
  Composite.add(engine.world, mapWalls);
}

// ---------- game state ----------
const DROP_MAX   = 4;
const DANGER_WY  = H - 150;

const COMBO_WINDOW = 1400;  // ms; merges within this of each other chain a combo

const state = {
  drinks:     [],
  particles:  [],
  coins:      [],
  textPops:   [],
  coinCount:  0,
  combo:      0,
  lastMergeAt: 0,
  gameOver:   false,
  nextTier:   0,
  queuedTier: 0,
  canShoot:   true,
};

// Combo tint escalates like RPG loot rarity: blue → purple → magenta → gold.
function comboColor(m) {
  if (m >= 5) return '#ffb03d';
  if (m >= 4) return '#d76be0';
  if (m >= 3) return '#9a6fe8';
  return '#5aa8e6';
}

function makeDrink(x, y, tier, shot = false) {
  // Shots always start as ghosts; merge spawns only when they would not yet
  // qualify as active (e.g. two stray ghosts merging in the dead zone) — the
  // product then activates the normal way once it gets inside.
  const ghost = isFinite(FREE_WY) &&
                (shot || !(y < FREE_WY && insideTray(x, y)));
  const it = ITEMS[tier];
  const opts = {
    restitution: 0.02, frictionAir: 0.028, friction: 0.3, density: 0.0012,
    collisionFilter: { group: 0, category: 0x0001, mask: ghost ? ~CAT_TRAY : -1 },
  };
  let b;
  if (it.cap) {
    // Elongated stadium hitbox (config/hitboxes.js shape:'capsule'): a chamfered
    // rectangle, LOCKED UPRIGHT (inertia ∞) so the horizontal sprite never drifts
    // from its body — drawDrink ignores body.angle, see render.js.
    b = Bodies.rectangle(x, y, it.cap.hw * 2, it.cap.hh * 2,
      { ...opts, angle: it.cap.rot, chamfer: { radius: Math.min(it.cap.hw, it.cap.hh) } });
    Body.setInertia(b, Infinity);   // locks the body at its authored angle forever
  } else {
    b = Bodies.circle(x, y, it.physR, opts);
  }
  b.plugin = { tier, born: performance.now(), merging: false, ghost };
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
  state.drinks = []; state.particles = []; state.coins = []; state.textPops = [];
  state.coinCount = 0; state.combo = 0; state.lastMergeAt = 0;
  state.gameOver = false; state.canShoot = true;
  LAUNCH.x = W / 2;
  state.queuedTier = Math.floor(Math.random() * DROP_MAX);
  rollNext();
  idleFrames = 0;  // ensure the fresh board draws even if we were idle
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
      pop(tier);
      triggerShake();

      const base = 2 + tier;
      let m = 1;
      if (COMBOS_ENABLED) {
        const now = performance.now();
        state.combo = (now - state.lastMergeAt < COMBO_WINDOW) ? state.combo + 1 : 1;
        state.lastMergeAt = now;
        m = state.combo;
      }
      // Coin shower scales with the multiplier; tighten the stagger on big
      // combos so a large payout still streams to the bag quickly.
      spawnCoins(sp.x, sp.y, Math.min(20, base * m), state.coins, m >= 3 ? 0.06 : 0.10);

      if (COMBOS_ENABLED && m >= 2) {
        const col = comboColor(m);
        spawnTextPop(sp.x, sp.y - 24, 'COMBO ×' + m, col, state.textPops);
        burst(sp.x, sp.y, col, ITEMS[tier + 1].r * sp.s * 1.5, state.particles);
      }
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
      // Coins still flying to the bag haven't landed, so their value isn't in
      // coinCount yet. Settle them now so the saved/displayed score matches what
      // the player earned (otherwise the bag keeps ticking up behind the overlay
      // while the recorded high score is short by 10 per in-flight coin).
      state.coinCount += state.coins.length * 10;
      state.coins = [];
      showGameOver(state, scoreKey(ACTIVE_MAP, ACTIVE_SIZE, COMBOS_ENABLED));
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

// Debug hitbox overlay: 'h' key or ?hitbox in the URL.
let showHitbox = /[?&]hitbox/.test(location.search);
window.addEventListener('keydown', e => {
  if (e.key === 'h' || e.key === 'H') showHitbox = !showHitbox;
});

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

  drawTextPops(state.textPops, dt);
  state.textPops = state.textPops.filter(p => p.life > 0);

  if (showHitbox) drawHitboxes();

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

// Is anything actually moving/animating? When the board is fully settled and
// the player is just thinking, there's nothing to simulate or redraw — so we
// skip physics + drawing entirely, which hugely cuts battery/heat during the
// long idle stretches a merge game spends waiting for input.
let idleFrames = 0;
function sceneBusy() {
  if (aiming || !state.canShoot) return true;
  if (state.coins.length || state.particles.length || state.textPops.length) return true;
  if (recoil > 0.1) return true;
  for (const d of state.drinks) {
    if (Math.hypot(d.velocity.x, d.velocity.y) > 0.08) return true;
  }
  return false;
}

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  // Cap to ~60fps: on 120Hz phones rAF fires twice as often, so skip the
  // extra frames rather than doing double the physics + drawing work (heat).
  if (lastTs && ts - lastTs < FRAME_MS - 1) return;
  const dt = lastTs ? Math.min((ts - lastTs) / FRAME_MS, 3) : 1;
  lastTs = ts;

  // Cheap; must run even while idle so a settled drink above the line still
  // ends the game, and stale combos still expire.
  checkOver();
  if (state.combo > 0 && performance.now() - state.lastMergeAt > COMBO_WINDOW) state.combo = 0;

  if (sceneBusy()) idleFrames = 0; else idleFrames++;
  if (idleFrames > 20) return;  // board is still — skip the expensive work

  for (let i = 0; i < SUBSTEPS; i++) Engine.update(engine, FRAME_MS / SUBSTEPS);
  // A shot's hitbox activates only once it is past the free line AND inside
  // the traced shape (and clear of walls, via trySolidify). Nothing can turn
  // solid out in the dead zone — a stray ghost stays a ghost until a later
  // nudge carries it inside, so bounce-backs outside the play area are gone.
  for (const d of state.drinks) {
    if (d.plugin.ghost && d.position.y < FREE_WY &&
        insideTray(d.position.x, d.position.y)) trySolidify(d);
  }
  render(dt);
}

// The background may finish loading after we've already gone idle; rebuild its
// cache and wake the loop for a frame so it actually appears.
bgImg.onload = () => { rebuildBgCache(); idleFrames = 0; };

// Stop burning cycles when the tab/app is backgrounded; resume on return.
document.addEventListener('visibilitychange', () => {
  const onGameScreen = document.getElementById('wrap').style.display !== 'none';
  if (document.hidden) {
    running = false;
  } else if (onGameScreen && !running) {
    running = true; lastTs = 0; idleFrames = 0; requestAnimationFrame(loop);
  }
});

function startGame(map, opts = {}) {
  ACTIVE_MAP = map;
  ITEMS = ACTIVE_MAP.itemsData;
  // Pick the backdrop for the requested size (map.sizes), else default art.
  const chosenSize = opts.size || map.defaultSize;
  const bgSrc = (map.sizes && chosenSize && map.sizes[chosenSize]) || map.bg;
  ACTIVE_SIZE = chosenSize;
  // Combo multipliers: per-run override from the menu, else the map's default.
  COMBOS_ENABLED = (opts.combos !== undefined) ? !!opts.combos : !!map.combos;
  // Apply the active size variant's traced boundary (each framing has its own).
  // Falls back to the map's base boundary if this size wasn't traced yet.
  if (typeof MAP_HITBOXES !== 'undefined') {
    const hb = MAP_HITBOXES[hitboxKey(ACTIVE_MAP, chosenSize)] || MAP_HITBOXES[ACTIVE_MAP.id];
    if (hb) {
      ACTIVE_MAP.cornerWalls = hb.cornerWalls;
      ACTIVE_MAP.sideInset   = hb.sideInset || 0;
      ACTIVE_MAP.horizon     = hb.horizon;   // undefined -> game default below
      ACTIVE_MAP.freeLine    = hb.freeLine;  // undefined -> free-line off below
    }
  }
  HORIZON = (ACTIVE_MAP.horizon !== undefined) ? ACTIVE_MAP.horizon : DEFAULT_HORIZON;
  // free line is stored in flat (editor) coords; horizontal lines map to a
  // constant physics y, so convert once here
  FREE_WY = (ACTIVE_MAP.freeLine !== undefined && ACTIVE_MAP.freeLine < H - 1)
    ? unpersp(0, ACTIVE_MAP.freeLine).y : Infinity;
  applyMapWalls(ACTIVE_MAP);
  loadMapAssets(ACTIVE_MAP, bgSrc);
  setSoundProfile(ACTIVE_MAP.id);
  initMusic(document.getElementById('bgm'), ACTIVE_MAP.bgmVol, ACTIVE_MAP.bgm);
  resetState();
  idleFrames = 0;
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
