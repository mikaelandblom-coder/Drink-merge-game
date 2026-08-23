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
  // The ambient fx layer (fx.js) is authored in px against the 420x620 world,
  // so it needs the same display scale the canvas just took.
  fxSetScale(disp);

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
let SPIN_ENABLED = false;         // draw items at their real body angle (map.spin, set in startGame)
// Dev preview: ?spin=1 forces rotation on for ANY map, ?spin=0 forces it off —
// so a candidate map's art can be judged before committing `spin:` to config.
const SPIN_PARAM = /[?&]spin=0/.test(location.search) ? false
                 : /[?&]spin/.test(location.search)   ? true : null;
let FLAT_ENABLED = false;         // anchor sprites by CENTRE, not base (map.flat, set in startGame)
// The body angle to DRAW an item at, or undefined for "don't rotate this one".
// Single source of truth: the render loop draws it and sceneBusy() decides
// whether a still-turning body must keep the loop awake, and if those two ever
// disagreed an item would either freeze mid-turn or hold the loop at 60fps
// forever. Two kinds of item are excluded on a spin map:
//
//   CAPSULES — makeDrink locks their inertia so the horizontal sprite can never
//   drift off its stadium hitbox, and their shadow is baked at the authored
//   cap.rot. Spin is a circle-only feature.
//
//   ANYTHING THAT IS NOT THE MAP'S OWN CHAIN — i.e. Happy Hour's shared receipt
//   chain. `spin: true` is a claim its author made about the art in THEIR items
//   list, which they chose to be radially symmetric; it cannot speak for art the
//   mode injects into every map alike. The receipts are a printed slip, a roll,
//   a stack and a clipboard with a clip at the top — four sprites with an
//   unmistakable "this way up", which Napoli spun (reported 2026-08-19). Testing
//   the KIND rather than naming receipts keeps this right for any future shared
//   chain, since the flaw is in the flag's REACH, not in receipts specifically.
function drawnSpin(d) {
  return (SPIN_ENABLED && d.plugin.kind === 'drink' && !d.plugin.item.cap)
    ? d.angle : undefined;
}

// Dev preview: ?flat=1 / ?flat=0, same escape hatch as ?spin.
const FLAT_PARAM = /[?&]flat=0/.test(location.search) ? false
                 : /[?&]flat/.test(location.search)   ? true : null;
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
// Cast size is DERIVED from config/items.js CUSTOMER_SPRITES (via render.js
// CUSTOMER_IMGS) — adding a face there is the whole change. It used to be a
// hardcoded 9 here, which silently ignored any face past the ninth.
const HH_LEAVE_MS      = 420;   // served customer's walk-out animation
const HH_CASHOUT_COINS = 25;    // golden receipt's bonus payout when it forms (10 points per coin)

// ---------- Rapid fire (quick mode) ----------
// The launcher fires itself on a cadence that ACCELERATES with the shot count,
// so a run ends on its own rather than lasting as long as the player's skill
// does — which is the whole point of the mode. A fixed cadence would not do
// that: item income would be constant, a good player would reach equilibrium
// and the mode would just be classic play with the thinking time removed.
//
// The player still aims. Rapid changes WHEN a shot happens, not what a shot is
// (see CANNON in ui.js for the steering model, and fireShot for the shot).
//
// The countdown is measured in FRAMES, not wall time. stepPhysics() is exactly
// one 60Hz frame of game time for both loop() and TT.step(), so a frame-counted
// timer fast-forwards deterministically under test mode — and, the reason it
// matters in play, it has no wall-clock stamp to be wrong about. The score
// panel's freeze (setPaused) has to push every performance.now() stamp forward
// on resume; this timer simply stops counting when frames stop, so pausing can
// neither bank free time nor skip a shot.
let RAPID_FIRE = false;
const RF_CADENCE_START = 1400;  // ms between shots on shot 0
const RF_CADENCE_END   = 350;   // ms between shots once the ramp is done
const RF_RAMP_SHOTS    = 50;    // shots taken to travel from START to END
// Shootable tiers in rapid, in place of DROP_MAX (4). This is MEASURED, and it
// is by far the strongest lever on how long a run lasts — much stronger than
// the cadence. A wider spread makes two neighbouring drinks less likely to
// match, so the board stops clearing itself. Against a random-steering bot:
//
//   3 tiers -> the run never ended (9 min, 134 drinks still on the field)
//   4 tiers -> ~4.4 min      5 tiers -> ~3 min      6 tiers -> ~2.2 min
//
// It is counter-intuitive, and it caught the first build of this mode out:
// NARROWING the deal was meant to stop the board filling with big items, and
// instead made merges so easy that nothing ever accumulated. Widening it also
// hands the player mid-chain items from the first shot, which suits a short
// run — the top tiers are reachable inside one.
const RF_DROP_MAX      = 5;
// After a shot the cradle stands EMPTY for a moment before the next drink
// loads. Without it the next drink appears in the same frame the last one
// leaves, and the launcher reads as a picture of what is coming rather than as
// a thing that shoots (Mikael, on a phone, 2026-08-23).
//
// Capped as a FRACTION of the beat as well as in ms: 170ms is a good pause at
// the start of a run but is half the cycle once the ramp reaches 350ms, and a
// cradle that is empty half the time reads as broken rather than as busy.
const RF_RELOAD_MS   = 170;    // cradle empty
const RF_LOAD_MS     = 90;     // then the next drink scales into it
const RF_RELOAD_FRAC = 0.35;   // ...but never more than this much of the beat

function rfReloadMs() {
  return Math.min(RF_RELOAD_MS, rfCadence() * RF_RELOAD_FRAC) + RF_LOAD_MS;
}

// How long a drink may DWELL in the danger zone before the run ends. Used in
// place of BOTH the classic "settled above the line" test and its 1.5s birth
// grace — see checkOver for why stacking the two was wrong.
const RF_OVER_MS       = 800;

// ms until the next automatic shot, given how far into the ramp the run is.
function rfCadence() {
  const t = Math.min(1, state.shotsFired / RF_RAMP_SHOTS);
  return RF_CADENCE_START + (RF_CADENCE_END - RF_CADENCE_START) * t;
}

// Tiers the launcher may deal. Rapid narrows the spread; every other mode is
// unchanged, so this is the only place the two differ.
// Clamped to the chain: a future map with a short item list must not be dealt
// a tier it does not have.
function dropMax() {
  return RAPID_FIRE ? Math.min(RF_DROP_MAX, ITEMS.length) : DROP_MAX;
}

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
  // Rapid fire: ms of game time until the launcher fires itself, and until the
  // next drink has finished loading into the cradle (both frame-counted — see
  // the RF_* block above). Unused in every other mode.
  rfTimer:    0,
  rfReload:   0,
  nextCustomerAtShot: HH_FIRST_SHOT,
  // XP earned this run (1/shot; committed to storage per shot by progress.js —
  // this counter only feeds the game-over "+N XP" recap)
  runXp: 0,
  // Score to chase: this variant's standing record, read once per run (see
  // resetState) — it can't change while a run is being played. 0 = empty board.
  bestToBeat: 0,
  beatBest: false,   // already overtaken it this run (so the pop fires once)
};

// The high-score board this run counts toward. Variant identity (size × combos ×
// Happy Hour) is decided at startGame, so this is stable for the whole run — the
// game-over save, the in-game readout and the score panel must all agree on it.
function currentScoreKey() {
  return scoreKey(ACTIVE_MAP, ACTIVE_SIZE, COMBOS_ENABLED, HAPPY_HOUR, RAPID_FIRE);
}

// The line under the coin pill: how far this run is from the record. Rebuilt
// only when the score actually changes — render() asks for it every frame.
let bestLine = null, bestLineFor = -1;
function bestToBeatLine() {
  if (!state.bestToBeat) return null;   // nothing on this board yet — nothing to chase
  if (bestLineFor === state.coinCount) return bestLine;
  bestLineFor = state.coinCount;
  const gap = state.bestToBeat - state.coinCount;
  bestLine = (gap > 0)
    ? { text: fmtScore(gap) + ' to beat', ahead: false }
    : { text: '🏆 new best', ahead: true };
  return bestLine;
}

// Overtaking the record is worth marking WHEN IT HAPPENS — at game over the run
// is already finished. Marked SILENTLY, on purpose (Mikael, 2026-08-15): the
// pill flipping to gold and the pop are enough, and the run is still going, so
// anything louder would talk over the shot the player is lining up. The
// game-over fanfare stays the one moment a record gets a sound.
function checkNewBest() {
  if (state.beatBest || !state.bestToBeat || state.coinCount <= state.bestToBeat) return;
  state.beatBest = true;
  spawnTextPop(BAG_POS.x + 62, BAG_POS.y + 90, 'NEW BEST!', '#ffd35c', state.textPops);
}

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
  state.queuedTier = Math.floor(Math.random() * dropMax());
}

// Draw a fresh pair of upcoming tiers off the CURRENT Math.random. Split out of
// resetState so test mode can re-roll after seeding without clearing the board
// (TT.seed in test.js) — keep this the only place the starting pair is drawn,
// so seeding before startGame and seeding after it consume the same two rolls.
function rollFreshTiers() {
  state.queuedTier = Math.floor(Math.random() * dropMax());
  rollNext();
}

function resetState() {
  for (const d of state.drinks) Composite.remove(engine.world, d);
  state.drinks = []; state.particles = []; state.coins = []; state.textPops = [];
  state.coinCount = 0; state.combo = 0; state.lastMergeAt = 0;
  state.gameOver = false; state.canShoot = true;
  state.customers = []; state.shotsFired = 0; state.nextCustomerAtShot = HH_FIRST_SHOT;
  state.runXp = 0;
  // Re-read the board here rather than in startGame: "Play again" comes straight
  // back through resetState, and by then the run that just ended has been saved
  // — so a record set last run is the target this run.
  state.bestToBeat = getScores(currentScoreKey())[0]?.score ?? 0;
  state.beatBest = false;
  bestLineFor = -1;
  LAUNCH.x = W / 2;
  resetCannon();                                    // ui.js — steering state
  state.rfTimer = RAPID_FIRE ? RF_CADENCE_START : 0;
  state.rfReload = 0;
  rollFreshTiers();
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
  // Counted in EVERY mode, not just Happy Hour: rapid fire's cadence ramp reads
  // it, and "shots fired this run" is what the name has always claimed. Harmless
  // elsewhere — nothing but these two modes looks at it.
  state.shotsFired++;
  if (!HAPPY_HOUR) return;
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
  // No two customers in the queue share a face. Only enforceable while the cast
  // outnumbers the queue — a smaller cast would spin here forever, so a short
  // one just allows repeats.
  const cast  = CUSTOMER_IMGS.length;
  const faces = new Set(state.customers.map(c => c.art));
  let art;
  do { art = Math.floor(Math.random() * cast); } while (cast > HH_QUEUE_MAX && faces.has(art));
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
    const over = d.position.y + d.plugin.item.physR > DANGER_WY;
    if (RAPID_FIRE) {
      // Rapid needs a different end condition, and this was measured rather
      // than guessed: the classic test asks for a drink that is over the line
      // AND has come to rest (speed < 0.15), but a shot every 0.4-1.5s keeps
      // the whole board permanently jostling, so almost nothing ever settles.
      // A run reached 90 drinks on the field and 4 minutes with no end in
      // sight — a jammed board that the game could not see was jammed.
      //
      // So rapid asks how long a drink has DWELT in the zone instead, with no
      // speed test at all. A shot crossing the zone is out of it in ~0.2s, far
      // inside RF_OVER_MS, while a drink that is stuck there is caught however
      // hard its neighbours are shoving it. Tracking the dwell per body (rather
      // than dropping the speed test outright) is what keeps a drink knocked
      // BACK into the zone from ending the run the instant it arrives — it gets
      // its own grace, the same as a fresh shot.
      //
      // The dwell REPLACES the 1.5s birth grace rather than stacking on top of
      // it, which is what the first build did — 1.5s then 1.2s meant a drink
      // could sit behind the line for 2.7s before the run ended, and it read on
      // a phone as the game being slow to notice (Mikael, 2026-08-23). The
      // birth grace exists to let a shot cross the zone it is launched from,
      // and the dwell already does exactly that job: a shot clears the line in
      // about 55ms (90 world px at speed 27), so RF_OVER_MS is ~15x the transit
      // even at full tilt. Stacking a second grace on top bought nothing.
      if (!over) { d.plugin.overSince = 0; continue; }
      if (!d.plugin.overSince) { d.plugin.overSince = now; continue; }
      if (now - d.plugin.overSince < RF_OVER_MS) continue;
    } else {
      if (now - d.plugin.born < 1500) continue;
      const speed = Math.hypot(d.velocity.x, d.velocity.y);
      if (!(over && speed < 0.15)) continue;
    }
    state.gameOver = true;
    // The run is over, so its parked copy (if any) is dead — drop it before
    // anything can offer to "continue" a board that just lost.
    SUSPEND.clear(ACTIVE_MAP.id);
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
    showGameOver(state, currentScoreKey());
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
  // 0 just after a shot, 1 at the instant the next one leaves. Drives every
  // part of the launcher's readout (see RF_SQUASH in render.js).
  const rfCharge = RAPID_FIRE ? 1 - state.rfTimer / rfCadence() : 0;
  drawAimLine(aiming, state.gameOver, sl, aimX, aimY);
  if (RAPID_FIRE && !state.gameOver) drawRapidAim(sl, CANNON.tilt, LAUNCHER_LIFT, rfCharge);

  const sorted = [...state.drinks].sort((a, b) => a.position.y - b.position.y);
  for (const d of sorted) {
    // The sprite tracks the BODY's scale, never the body's age. Only merge
    // products grow in (makeDrink's growIn flag is what sets plugin.scale, and
    // stepPhysics advances it); a shot's body is full size from birth, so
    // drawing it from 0.6 made the item visibly SHRINK the moment it left the
    // launcher — sprite and hitbox disagreeing for 200ms. Mikael saw it in
    // rapid, where the eye follows the projectile out of the cradle, but it was
    // true of every shot on every map.
    const growth = d.plugin.scale || 1;
    const p      = persp(d.position.x, d.position.y);
    drawDrink(p.x, p.y, d.plugin.item, p.s * growth, wob + d.id, drawnSpin(d), FLAT_ENABLED);
  }

  if (!state.gameOver) {
    recoil *= Math.pow(0.82, dt);
    // Launcher art under the loaded drink, so the drink sits IN the cradle.
    if (RAPID_FIRE) drawLauncher(sl, CANNON.tilt, rfCharge);
    // Scales in as it loads, so the next drink ARRIVES in the cradle instead of
    // blinking into it at full size.
    const load = (RAPID_FIRE && state.rfReload > 0)
      ? 0.72 + 0.28 * (1 - state.rfReload / RF_LOAD_MS) : 1;
    // Rapid places the preview through persp() at its real world point — the
    // one loadedDrinkWY names — rather than by subtracting screen px, so the
    // preview and the body it becomes are drawn at the same place AND the same
    // perspective scale. Classic is left exactly as it was.
    const lp = RAPID_FIRE ? persp(LAUNCH.x, LAUNCH.y - LAUNCHER_LIFT * launcherSquash(rfCharge))
                          : sl;
    if (state.canShoot) drawDrink(lp.x, lp.y + recoil, ITEMS[state.nextTier],
                                  RAPID_FIRE ? lp.s * load : 1, wob,
                                  undefined, FLAT_ENABLED);
  }

  drawParticles(state.particles, dt);
  state.particles = state.particles.filter(p => p.life > 0);

  drawTextPops(state.textPops, dt);
  state.textPops = state.textPops.filter(p => p.life > 0);

  if (showXray) drawXray(state.drinks, wob);
  if (showHitbox) drawHitboxes();

  drawNextPreview(state.queuedTier);

  drawBag(state.coinCount, dt, bestToBeatLine());
  state.coins = updateCoins(state.coins, dt, () => {
    state.coinCount += 10;
    coinTick();
    checkNewBest();   // coins landing in the bag is the only way the score rises
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
// Force one more drawn frame from outside the loop. Art that finishes loading
// mid-run is the case that needs it: sceneBusy() only knows about MOTION, so a
// sprite landing on a settled board would not be painted until the next shot.
function wakeRender() { idleFrames = 0; }
function sceneBusy() {
  if (showXray) return true;   // keep the diagnostic live while a settled board idles
  // Rapid fire is never idle by construction: the charge ring is always filling
  // and the cannon is always steerable, so the idle-frame skip must not park the
  // loop between shots. It costs nothing in practice — the longest gap the mode
  // ever has is RF_CADENCE_START, and a shot is in flight for most of it.
  if (RAPID_FIRE && !state.gameOver) return true;
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
    // A body can be linearly still while it is STILL TURNING, and where that
    // rotation is drawn the item would otherwise freeze mid-turn when the board
    // settles and jump on the next wake. Gated through drawnSpin so it asks the
    // exact question "is this body's rotation on screen?" — a settled receipt
    // whose angle is thrown away must NOT hold the loop at 60fps for a turn
    // nobody can see. Every non-spin map's idle behaviour is bit-for-bit what
    // it was. 0.0015 rad/step: at the measured ~0.97/step decay that leaves
    // under 3 degrees of un-drawn rotation, which is invisible.
    if (drawnSpin(d) !== undefined && Math.abs(d.angularVelocity) > 0.0015) return true;
  }
  return false;
}

// ---------- freeze (score panel) ----------
// The score panel is opened MID-RUN, on purpose, possibly often — so unlike the
// bug panel and the quit confirm (rare / terminal) it cannot leave the game
// running underneath. checkOver keeps counting the 1.5s danger-line grace even
// when nothing is drawn, so without this, checking what you need to beat could
// cost you the run — the exact opposite of the feature.
let paused = false, pausedAt = 0;

function setPaused(on) {
  if (on === paused) return;
  if (on) { paused = true; pausedAt = performance.now(); return; }
  // Everything time-based is stamped with performance.now(), which kept running
  // while we were frozen. Push those stamps forward by the frozen duration so
  // the board resumes at the age it was parked at — a drink halfway through its
  // game-over grace keeps the other half, and a merge mid-grow-in finishes its
  // animation instead of snapping to full size. (Same idea as the deliberate
  // BACKDATING in SUSPEND.apply, pointed the other way.)
  const held = performance.now() - pausedAt;
  for (const d of state.drinks) {
    d.plugin.born += held;
    // Rapid's danger-zone dwell is a performance.now() stamp like the rest, so
    // it has to move too — otherwise unfreezing would instantly bill a drink
    // for the whole time the panel was open.
    if (d.plugin.overSince) d.plugin.overSince += held;
  }
  for (const c of state.customers) {
    c.bornAt += held;
    if (c.leaveAt) c.leaveAt += held;
  }
  if (state.lastMergeAt) state.lastMergeAt += held;
  paused = false;
  lastTs = 0;      // don't bill the frozen stretch to the next frame's dt
  idleFrames = 0;  // the board may have settled — force one frame back on screen
}

function loop(ts) {
  if (!running) return;
  requestAnimationFrame(loop);
  // Frozen: no physics, no render, and above all no checkOver. The canvas keeps
  // its last frame, so the board stays visible behind the panel.
  if (paused) return;
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
  // Rapid fire: steer the launcher and fire on the beat BEFORE the physics
  // substeps, so a shot made this frame is simulated this frame — exactly where
  // a pointer-released shot would have entered the world. Living here (rather
  // than in loop()) is what lets TT.step() drive the mode synchronously.
  if (RAPID_FIRE && !state.gameOver) {
    updateCannon();                    // ui.js — one 60Hz frame of steering
    if (state.rfReload > 0) {
      state.rfReload -= FRAME_MS;
      // canShoot flips with RF_LOAD_MS still on the clock: that tail is the
      // drink scaling into the cradle, drawn by render().
      if (state.rfReload <= RF_LOAD_MS && !state.canShoot) {
        rollNext(); state.canShoot = true;
      }
    }
    state.rfTimer -= FRAME_MS;
    if (state.rfTimer <= 0) {
      // Never fire an empty cradle. rfReloadMs() is capped well under the beat
      // so this is a guard against a future retune, not a path the mode takes.
      if (!state.canShoot) { rollNext(); state.canShoot = true; state.rfReload = 0; }
      fireCannon();                    // ui.js — shoots along the current tilt
      state.rfTimer = rfCadence();     // recomputed AFTER the shot: countShot()
    }                                  // has just advanced the ramp by one
  }
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
    // Close the score panel first: its freeze is measured from a wall-clock
    // stamp, and backgrounding for an hour with it open would hand the board an
    // hour of "age" back on return. Unfreezing here keeps that window to nothing.
    hideScorePanel();
    // Park the run before anything else: iOS discards backgrounded tabs without
    // warning, so this — not the menu button — is the save that usually matters.
    if (onGameScreen) SUSPEND.save();
    running = false;
    pauseMusicForHide();
    markAudioInterrupted();  // iOS kills the SFX carrier while backgrounded
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
  // A run can only start from the menu, where no panel is open — but a stuck
  // `paused` would freeze the new run's loop the instant it started, so never
  // take that on trust.
  hideScorePanel();
  ACTIVE_MAP = map;
  ITEMS = ACTIVE_MAP.itemsData;
  // Fetch only THIS map's sprite chain (see the bandwidth note in items.js) —
  // the receipt chain and the customer cast are Happy-Hour-only, so they wait
  // for a run that actually needs them.
  loadItemSprites(ITEMS);
  // Pick the backdrop for the requested size (map.sizes), else default art.
  const chosenSize = opts.size || map.defaultSize;
  const bgSrc = (map.sizes && chosenSize && map.sizes[chosenSize]) || map.bg;
  ACTIVE_SIZE = chosenSize;
  // Happy Hour (orders mode) is per-run from the menu and forces combos off —
  // the receipt chain is its own scoring layer, so the two don't stack.
  HAPPY_HOUR = !!opts.happyHour;
  if (HAPPY_HOUR) { loadItemSprites(RECEIPT_ITEMS); loadCustomerSprites(); }
  // Rapid fire (quick mode). Mutually exclusive with Happy Hour, and not merely
  // by preference: HH's tap-to-serve gesture lives exactly where rapid's
  // steering drag does, and its receipt chain is a second scoring layer a
  // 2-4 minute run has no room to develop. HH wins the tie so a stale rapid
  // preference can never quietly disable a mode the player did tick.
  RAPID_FIRE = !!opts.rapid && !HAPPY_HOUR;
  if (RAPID_FIRE) loadLauncherSprites();   // shared chrome, fetched only for this mode
  // Combo multipliers: per-run override from the menu, else the map's default.
  // Rapid FORCES them on — the mode is built around sustaining a chain through
  // the cadence (see fireShot in ui.js), so its scores are only comparable to
  // each other with combos in. That is also why scoreKey folds rapid and combo
  // into one variant part rather than multiplying them.
  COMBOS_ENABLED = HAPPY_HOUR ? false
    : RAPID_FIRE ? true
    : (opts.combos !== undefined) ? !!opts.combos : !!map.combos;
  // Rotating items: a per-MAP property, not a menu option — it belongs to the
  // art (radially symmetric subjects only), not to how a player wants to play.
  // Purely visual: the bodies already rotate, this only draws it.
  SPIN_ENABLED = (SPIN_PARAM !== null) ? SPIN_PARAM : !!map.spin;
  // Flat-lying art: same shape of decision, also a property of the ART. See the
  // sprite-anchor comment in drawDrink (render.js) for what it changes and why
  // top-down food needs it while every standing drink does not.
  FLAT_ENABLED = (FLAT_PARAM !== null) ? FLAT_PARAM : !!map.flat;
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
  setMapSounds(ACTIVE_MAP.id);
  initMusic(document.getElementById('bgm'), ACTIVE_MAP.bgmVol, ACTIVE_MAP.bgm);
  resetState();
  // Whatever was parked for this map is superseded the moment a run starts on
  // it — including a resume, whose payload is already in hand. Clearing here
  // (rather than at the menu) means a crash mid-run can't leave a stale board
  // that is older than the one being played.
  SUSPEND.clear(map.id);
  if (opts.resume) SUSPEND.apply(opts.resume);
  idleFrames = 0;
  if (!running) {
    running = true;
    lastTs = 0;
    requestAnimationFrame(loop);
  }
}

// Both callers (the game-over overlay's Menu button and the in-game ✕ confirm)
// come through here, so the suspend lives here rather than in ui.js. A finished
// run has nothing to park and SUSPEND.save() bails on state.gameOver by itself.
function returnToMenu() {
  SUSPEND.save();
  running = false;
  if (bgmEl) { bgmEl.pause(); bgmEl.currentTime = 0; }
  showWelcome();
}
