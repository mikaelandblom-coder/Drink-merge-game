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
  // 'low' (bilinear) — sprites are drawn near 1:1 so the high-quality filter is
  // invisible here, but it costs real GPU time per sprite per frame on mobile.
  // The background cache keeps 'high' for its one-time scale (render.js).
  ctx.imageSmoothingQuality = 'low';
}
fitCanvas();
window.addEventListener('resize', () => {
  fitCanvas();
  // Resizing the backing store WIPES the canvas, and the idle-frame optimizer
  // would happily keep skipping render() while the board is still — leaving
  // the field blank after a window resize/rotation until something moved.
  idleFrames = 0;
});

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
// Only the top wall is global; all lateral containment comes from each map's
// traced spline boundary (applyMapWalls).
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
const GHOST_STEER_MS = 150;       // ghost age before escape-steering may kick in
const GHOST_STEER    = 0.7;       // px/frame of velocity bent toward the centroid
let FREE_WY = Infinity;           // physics y of the free line (Infinity = off)
let COMBOS_ENABLED = false;       // cascade-merge multipliers (set per run in startGame)
let HAPPY_HOUR = false;           // orders mode (set per run in startGame; forces combos off)
let ACTIVE_SIZE = null;           // table-size variant of the current run (for score keys)
let trayWalls = [];               // just the traced boundary bodies
let trayPoly  = [];               // boundary polygon (physics coords) for the inside test
let trayCentroid = null;          // area centroid of trayPoly — steering target for escaped ghosts

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

  trayWalls = [];
  trayPoly  = [];
  trayCentroid = null;
  if (map.cornerWalls) {
    for (const c of map.cornerWalls) {
      trayWalls.push(Bodies.rectangle(c.x, c.y, c.len + WALL_OVERLAP, WALL_THICK, {
        ...wallOpts, angle: c.angle, chamfer: { radius: WALL_THICK / 2 },
        collisionFilter: { group: 0, category: CAT_TRAY, mask: -1 },
      }));
    }
    mapWalls.push(...trayWalls);
    trayPoly = buildTrayPoly(map.cornerWalls);
    // Area centroid of the traced polygon (implicitly closed across the
    // launcher mouth) — where escaped ghosts get steered back toward.
    let a2 = 0, cx = 0, cy = 0;
    for (let i = 0, j = trayPoly.length - 1; i < trayPoly.length; j = i++) {
      const cr = trayPoly[j].x * trayPoly[i].y - trayPoly[i].x * trayPoly[j].y;
      a2 += cr;
      cx += (trayPoly[j].x + trayPoly[i].x) * cr;
      cy += (trayPoly[j].y + trayPoly[i].y) * cr;
    }
    if (a2) trayCentroid = { x: cx / (3 * a2), y: cy / (3 * a2) };
  }
  Composite.add(engine.world, mapWalls);
}

// ---------- game state ----------
const DROP_MAX   = 4;
// Game-over threshold (physics y). Per-boundary via the hitbox editor's
// dangerLine (stored flat, converted in startGame); H-150 is the default.
let DANGER_WY    = H - 150;

const COMBO_WINDOW = 1400;  // ms; merges within this of each other chain a combo

// Happy Hour (orders mode) tuning.
const HH_QUEUE_MAX     = 3;     // customers visible at once
const HH_FIRST_SHOT    = 8;     // first customer arrives after this many shots
const HH_SHOTS_BETWEEN = 6;     // further arrivals every N shots (if the queue has room)
const HH_CAST          = 9;     // size of the customer art set (render.js CUSTOMER_IMGS)
const HH_LEAVE_MS      = 420;   // served customer's walk-out animation
const HH_CASHOUT_COINS = 25;    // golden receipt's bonus payout when it forms (10 points per coin)

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
  // Happy Hour
  customers:  [],   // { slot, art, tier, bornAt, leaveAt }
  shotsFired: 0,
  nextCustomerAtShot: HH_FIRST_SHOT,
  // XP earned this run (1/shot; committed to storage per shot by progress.js —
  // this counter only feeds the game-over "+N XP" recap)
  runXp: 0,
};

// Combo tint escalates like RPG loot rarity: blue → purple → magenta → gold.
function comboColor(m) {
  if (m >= 5) return '#ffb03d';
  if (m >= 4) return '#d76be0';
  if (m >= 3) return '#9a6fe8';
  return '#5aa8e6';
}

// kind: 'drink' (the map's item set) or 'receipt' (Happy Hour's shared chain).
// The two kinds share all physics/render plumbing but only merge within a kind.
function makeDrink(x, y, tier, shot = false, growIn = false, kind = 'drink') {
  // Shots always start as ghosts; merge spawns only when they would not yet
  // qualify as active (e.g. two stray ghosts merging in the dead zone) — the
  // product then activates the normal way once it gets inside.
  const ghost = isFinite(FREE_WY) &&
                (shot || !(y < FREE_WY && insideTray(x, y)));
  const it = (kind === 'receipt' ? RECEIPT_ITEMS : ITEMS)[tier];
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
  b.plugin = { tier, kind, item: it, born: performance.now(), merging: false, ghost };
  // Every real shot (pointer or TT.shoot) counts for Happy Hour arrivals AND
  // earns 1 XP (progress.js) — merge/receipt spawns never come through here
  // with shot=true, so nothing else can farm XP.
  if (shot) { countShot(); xpOnShot(state); }
  if (growIn) {
    // Merge products appear INSIDE a packed pile. A full-size body materialising
    // there gets separated by Matter's position solver in one violent shove —
    // the pile visibly teleports (measured up to ~47px in a single frame with
    // the largest capsules; ~33px with big circles). Spawn the BODY at the
    // sprite grow-animation's start scale instead and let the loop grow it in
    // step with the drawn sprite (render() growth, 0.6 -> 1 over 200ms), so the
    // pile is eased apart smoothly. Applies to every map — merge feel stays
    // consistent regardless of item shape or size.
    Body.scale(b, 0.6, 0.6);
    if (it.cap) Body.setInertia(b, Infinity);  // re-lock: Body.scale recomputes inertia
    b.plugin.scale = 0.6;
  }
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
  state.customers = []; state.shotsFired = 0; state.nextCustomerAtShot = HH_FIRST_SHOT;
  state.runXp = 0;
  LAUNCH.x = W / 2;
  state.queuedTier = Math.floor(Math.random() * DROP_MAX);
  rollNext();
  BUGLOG.run();    // fresh bug-report ring for the new run (buglog.js)
  idleFrames = 0;  // ensure the fresh board draws even if we were idle
}

// ---------- Happy Hour (orders mode) ----------
// Customers queue behind the horizon and each shows the drink tier they want.
// Arrivals are keyed to SHOT COUNT, not wall time: a shot always wakes the
// render loop, so a customer can never walk in while the idle-frame optimizer
// has drawing switched off (a timer arrival would go invisible until the next
// interaction).
function countShot() {
  if (!HAPPY_HOUR) return;
  state.shotsFired++;
  if (state.customers.length >= HH_QUEUE_MAX) {
    // Queue full: the arrival clock idles instead of accruing a backlog, so a
    // freed slot still costs HH_SHOTS_BETWEEN shots before the next walk-in —
    // serving never triggers an instant replacement.
    state.nextCustomerAtShot = state.shotsFired + HH_SHOTS_BETWEEN;
    return;
  }
  if (state.shotsFired >= state.nextCustomerAtShot) {
    spawnCustomer();
    state.nextCustomerAtShot = state.shotsFired + HH_SHOTS_BETWEEN;
  }
}

function spawnCustomer() {
  const used  = new Set(state.customers.map(c => c.slot));
  const slot  = [0, 1, 2].find(s => !used.has(s));
  if (slot === undefined) return;
  const faces = new Set(state.customers.map(c => c.art));
  let art;
  do { art = Math.floor(Math.random() * HH_CAST); } while (faces.has(art));
  state.customers.push({
    slot, art,
    // Unweighted sample over the map's ENTIRE tier chain — high-tier orders
    // are rare finds the player grows into, not guaranteed-servable requests.
    tier: Math.floor(Math.random() * ITEMS.length),
    bornAt: performance.now(),
    leaveAt: 0,
  });
}

// A drink can fill an order once it's a real settled-ish body on the field —
// not a ghost still flying through the dead zone, and not mid-merge.
function orderAvailable(tier) {
  return state.drinks.some(d => d.plugin.kind === 'drink' && d.plugin.tier === tier &&
                                !d.plugin.ghost && !d.plugin.merging);
}

// Serve: the matching drink CLOSEST TO THE DANGER LINE (largest y) leaves the
// field — so serving always reads as helpful — pays coins like the merge it
// replaces, and a tier-0 receipt grows in where the drink stood.
function tryServeCustomer(c) {
  if (c.leaveAt || state.gameOver) return;
  let pick = null;
  for (const d of state.drinks) {
    if (d.plugin.kind !== 'drink' || d.plugin.tier !== c.tier ||
        d.plugin.ghost || d.plugin.merging) continue;
    if (!pick || d.position.y > pick.position.y) pick = d;
  }
  if (!pick) return;
  const { x, y } = pick.position;
  Composite.remove(engine.world, pick);
  state.drinks = state.drinks.filter(d => d !== pick);
  makeDrink(x, y, 0, false, true, 'receipt');
  const sp = persp(x, y);
  burst(sp.x, sp.y, '#ffe9a8', ITEMS[c.tier].r * sp.s, state.particles);
  spawnCoins(sp.x, sp.y, 2 + c.tier, state.coins);
  pop(c.tier);
  c.leaveAt = performance.now();
  idleFrames = 0;
}

// Per-frame Happy Hour upkeep: served customers finish their walk-out.
function updateHappyHour() {
  const now = performance.now();
  state.customers = state.customers.filter(c => !c.leaveAt || now - c.leaveAt < HH_LEAVE_MS);
}

// ---------- merging ----------
Events.on(engine, 'collisionStart', ev => {
  for (const pair of ev.pairs) {
    const a = pair.bodyA, b = pair.bodyB;
    if (!a.plugin || !b.plugin) continue;
    const rvx = a.velocity.x - b.velocity.x, rvy = a.velocity.y - b.velocity.y;
    clink(Math.hypot(rvx, rvy));
    if (a.plugin.merging || b.plugin.merging) continue;
    // Merges only happen within a kind: the map's drink chain and Happy Hour's
    // receipt chain run in parallel without ever merging into each other.
    const SET = a.plugin.kind === 'receipt' ? RECEIPT_ITEMS : ITEMS;
    if (a.plugin.kind === b.plugin.kind &&
        a.plugin.tier === b.plugin.tier && a.plugin.tier < SET.length - 1) {
      a.plugin.merging = b.plugin.merging = true;
      const kind = a.plugin.kind;
      const tier = a.plugin.tier;
      const mx = (a.position.x + b.position.x) / 2;
      const my = (a.position.y + b.position.y) / 2;
      Composite.remove(engine.world, a); Composite.remove(engine.world, b);
      state.drinks = state.drinks.filter(d => d !== a && d !== b);
      makeDrink(mx, my, tier + 1, false, true, kind);  // grow in — no one-frame pile shove
      const sp = persp(mx, my);
      // The golden top receipt pays its bonus the moment it forms but STAYS on
      // the field for good — each finished chain permanently eats table space,
      // so a Happy Hour run ratchets toward game over instead of dragging on.
      if (kind === 'receipt' && tier + 1 === SET.length - 1) {
        spawnTextPop(sp.x, sp.y - 20, 'PAID!', '#ffb03d', state.textPops);
        spawnCoins(sp.x, sp.y, HH_CASHOUT_COINS, state.coins, 0.05);
      }
      burst(sp.x, sp.y, SET[tier + 1].liq, SET[tier + 1].r * sp.s, state.particles);
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
        burst(sp.x, sp.y, col, SET[tier + 1].r * sp.s * 1.5, state.particles);
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
    if (d.position.y + d.plugin.item.physR > DANGER_WY && speed < 0.15) {
      state.gameOver = true;
      // Bug-report ring: which drink ended the run, and where it sat.
      BUGLOG.event('gameover', {
        tier: d.plugin.tier, kind: d.plugin.kind,
        x: Math.round(d.position.x), y: Math.round(d.position.y),
        ghost: d.plugin.ghost ? 1 : undefined,
      });
      // Coins still flying to the bag haven't landed, so their value isn't in
      // coinCount yet. Settle them now so the saved/displayed score matches what
      // the player earned (otherwise the bag keeps ticking up behind the overlay
      // while the recorded high score is short by 10 per in-flight coin).
      state.coinCount += state.coins.length * 10;
      state.coins = [];
      showGameOver(state, scoreKey(ACTIVE_MAP, ACTIVE_SIZE, COMBOS_ENABLED, HAPPY_HOUR));
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

// Player-facing X-ray diagnostic (HUD scan button) — draws the collision
// shapes and flags why matching drinks aren't merging (render.js drawXray).
let showXray = false;
function toggleXray(btn) {
  showXray = !showXray;
  btn.classList.toggle('active', showXray);
  btn.setAttribute('aria-pressed', String(showXray));
  idleFrames = 0;   // repaint even if the board has settled into the idle skip
}

function render(dt) {
  wob += 0.05 * dt;
  // The background is a DOM layer under this (transparent) canvas — just clear.
  ctx.clearRect(0, 0, W, H);
  // Customers live behind the horizon, so they're drawn first — anything on
  // the field (including the danger line) reads as in front of them.
  if (HAPPY_HOUR) drawCustomers(state.customers, wob);
  drawDangerLine(DANGER_WY);

  const sl = persp(LAUNCH.x, LAUNCH.y);
  drawAimLine(aiming, state.gameOver, sl, aimX, aimY);

  const sorted = [...state.drinks].sort((a, b) => a.position.y - b.position.y);
  for (const d of sorted) {
    const born   = (performance.now() - d.plugin.born) / 200;
    const growth = Math.min(1, 0.6 + born * 0.4);
    const p      = persp(d.position.x, d.position.y);
    drawDrink(p.x, p.y, d.plugin.item, p.s * growth, wob + d.id);
  }

  if (!state.gameOver) {
    recoil *= Math.pow(0.82, dt);
    if (state.canShoot) drawDrink(sl.x, sl.y + recoil, ITEMS[state.nextTier], 1, wob);
  }

  drawParticles(state.particles, dt);
  state.particles = state.particles.filter(p => p.life > 0);

  drawTextPops(state.textPops, dt);
  state.textPops = state.textPops.filter(p => p.life > 0);

  if (showXray) drawXray(state.drinks, wob);
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
// Cool mode (welcome-screen toggle): cap rendering at 30fps instead of 60 —
// the single biggest heat/battery lever. Physics keeps the SAME step size
// (twice as many substeps per frame), so game speed and collision quality are
// identical; only the draw rate halves. Read from storage per run in startGame.
let coolMode = false;
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
  if (showXray) return true;   // keep the diagnostic live while a settled board idles
  if (aiming || !state.canShoot) return true;
  if (state.coins.length || state.particles.length || state.textPops.length) return true;
  if (recoil > 0.1) return true;
  if (HAPPY_HOUR) {
    // Keep drawing while a customer walks in/out — it would otherwise freeze
    // mid-animation when the board settles.
    const now = performance.now();
    for (const c of state.customers) {
      if (c.leaveAt || now - c.bornAt < 700) return true;
    }
  }
  for (const d of state.drinks) {
    if (Math.hypot(d.velocity.x, d.velocity.y) > 0.08) return true;
  }
  return false;
}

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  // Cap to ~60fps (30 in cool mode): on 120Hz phones rAF fires twice as often,
  // so skip the extra frames rather than doing double the physics + drawing
  // work (heat).
  if (lastTs && ts - lastTs < (coolMode ? FRAME_MS * 2 : FRAME_MS) - 1) return;
  const dt = lastTs ? Math.min((ts - lastTs) / FRAME_MS, 3) : 1;
  lastTs = ts;

  // Cheap; must run even while idle so a settled drink above the line still
  // ends the game, and stale combos still expire.
  checkOver();
  if (state.combo > 0 && performance.now() - state.lastMergeAt > COMBO_WINDOW) state.combo = 0;

  if (sceneBusy()) idleFrames = 0; else idleFrames++;
  if (idleFrames > 20) return;  // board is still — skip the expensive work

  stepPhysics();
  render(dt);
}

// One 60Hz frame of simulation (physics substeps + ghost/grow upkeep).
// Extracted from loop() so test mode (test.js, ?test=1) can step the game
// synchronously without rAF — behaviour must stay identical to live play.
function stepPhysics() {
  // In cool mode each drawn frame covers two 60Hz frames of game time, so run
  // twice the substeps at the unchanged step size (bigger steps would tunnel).
  const steps = coolMode ? SUBSTEPS * 2 : SUBSTEPS;
  for (let i = 0; i < steps; i++) Engine.update(engine, FRAME_MS / SUBSTEPS);
  // A shot's hitbox activates only once it is past the free line AND inside
  // the traced shape (and clear of walls, via trySolidify). Nothing can turn
  // solid out in the dead zone — a stray ghost stays a ghost until a later
  // nudge carries it inside, so bounce-backs outside the play area are gone.
  for (const d of state.drinks) {
    if (d.plugin.ghost && d.position.y < FREE_WY &&
        insideTray(d.position.x, d.position.y)) trySolidify(d);
  }
  // A ghost still outside the traced shape after its launch transit is an
  // escaped shot (an angled shot that missed the launcher mouth — easy on
  // Paris, whose mouth is narrow). Steer it toward the tray centroid each
  // frame until it curves inside and solidifies. The age gate keeps normal
  // shots untouched: at speed 27 they are deep inside (or solid) long before
  // GHOST_STEER_MS, so aim feel doesn't change.
  if (trayCentroid) {
    const now = performance.now();
    for (const d of state.drinks) {
      if (!d.plugin.ghost || now - d.plugin.born < GHOST_STEER_MS) continue;
      const p = d.position;
      if (insideTray(p.x, p.y)) continue;
      let vx = d.velocity.x, vy = d.velocity.y;
      // Mirror the outward component at the world edge so an escapee never
      // coasts far off-screen (steering alone lets a fast shallow shot travel
      // ~400px out before it turns around, then fling back in too hard).
      if ((p.x < 0 && vx < 0) || (p.x > W && vx > 0)) vx *= -0.5;
      if (p.y > H && vy > 0) vy *= -0.5;
      const dx = trayCentroid.x - p.x, dy = trayCentroid.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      Body.setVelocity(d, { x: vx + dx / len * GHOST_STEER,
                            y: vy + dy / len * GHOST_STEER });
    }
  }
  // With no side walls (splines are the only lateral containment), a shallow
  // rail shot can slip past the traced boundary near the launcher opening and
  // leave the world — as a ghost, or as a solid body on maps without a free
  // line. Once it comes to rest well outside, cull it: it can never return
  // (the walls block re-entry), and left alone a solid escapee would trigger
  // checkOver's danger-line game-over from off-screen with no visible cause.
  // The 0.3 threshold is above checkOver's 0.15 so the cull always wins.
  for (let i = state.drinks.length - 1; i >= 0; i--) {
    const d = state.drinks[i], p = d.position;
    if (d.speed < 0.3 &&
        (p.x < -60 || p.x > W + 60 || p.y > H + 60)) {
      Composite.remove(engine.world, d);
      state.drinks.splice(i, 1);
    }
  }
  // Grow freshly-merged bodies to full size in step with their sprite's grow
  // animation (spawned at 0.6 scale in makeDrink) — eases the pile apart over
  // 200ms instead of one violent position-solver shove.
  for (const d of state.drinks) {
    const pl = d.plugin;
    if (pl.scale) {
      const target = Math.min(1, 0.6 + 0.4 * (performance.now() - pl.born) / 200);
      if (target > pl.scale) {
        const r = target / pl.scale;
        Body.scale(d, r, r);
        if (ITEMS[pl.tier].cap) Body.setInertia(d, Infinity);
        pl.scale = target;
      }
      if (target >= 1) pl.scale = null;
    }
  }
  if (HAPPY_HOUR) updateHappyHour();
}

// Stop burning cycles when the tab/app is backgrounded; resume on return.
// The bgm <audio> keeps playing in a hidden tab unless paused explicitly.
document.addEventListener('visibilitychange', () => {
  const onGameScreen = document.getElementById('wrap').style.display !== 'none';
  if (document.hidden) {
    running = false;
    pauseMusicForHide();
  } else if (onGameScreen && !running) {
    resumeMusicAfterHide();
    resumeCtx();  // SFX context can come back 'interrupted' from a lock/app switch
    running = true; lastTs = 0; idleFrames = 0; requestAnimationFrame(loop);
  }
});

function startGame(map, opts = {}) {
  // Cool mode is shelved for now (checkbox commented out in index.html) —
  // pinned off here so a stale saved pref can't half-rate anyone's game.
  coolMode = false;  // was: localStorage.getItem('mm_cool') === '1'
  ACTIVE_MAP = map;
  ITEMS = ACTIVE_MAP.itemsData;
  // Pick the backdrop for the requested size (map.sizes), else default art.
  const chosenSize = opts.size || map.defaultSize;
  const bgSrc = (map.sizes && chosenSize && map.sizes[chosenSize]) || map.bg;
  ACTIVE_SIZE = chosenSize;
  // Happy Hour (orders mode) is per-run from the menu and forces combos off —
  // the receipt chain is its own scoring layer, so the two don't stack.
  HAPPY_HOUR = !!opts.happyHour;
  // Combo multipliers: per-run override from the menu, else the map's default.
  COMBOS_ENABLED = HAPPY_HOUR ? false
    : (opts.combos !== undefined) ? !!opts.combos : !!map.combos;
  // Apply the active size variant's traced boundary (each framing has its own).
  // Falls back to the map's base boundary if this size wasn't traced yet.
  if (typeof MAP_HITBOXES !== 'undefined') {
    const hb = MAP_HITBOXES[hitboxKey(ACTIVE_MAP, chosenSize)] || MAP_HITBOXES[ACTIVE_MAP.id];
    if (hb) {
      ACTIVE_MAP.cornerWalls = hb.cornerWalls;
      ACTIVE_MAP.horizon     = hb.horizon;    // undefined -> game default below
      ACTIVE_MAP.freeLine    = hb.freeLine;   // undefined -> free-line off below
      ACTIVE_MAP.dangerLine  = hb.dangerLine; // undefined -> default H-150 below
    }
  }
  HORIZON = (ACTIVE_MAP.horizon !== undefined) ? ACTIVE_MAP.horizon : DEFAULT_HORIZON;
  // free line is stored in flat (editor) coords; horizontal lines map to a
  // constant physics y, so convert once here
  FREE_WY = (ACTIVE_MAP.freeLine !== undefined && ACTIVE_MAP.freeLine < H - 1)
    ? unpersp(0, ACTIVE_MAP.freeLine).y : Infinity;
  // Danger line: same flat->physics conversion; per-boundary game-over height.
  DANGER_WY = (ACTIVE_MAP.dangerLine !== undefined)
    ? unpersp(0, ACTIVE_MAP.dangerLine).y : H - 150;
  applyMapWalls(ACTIVE_MAP);
  initXpBar();   // after HORIZON is set — the vertical bar's top tracks it
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
