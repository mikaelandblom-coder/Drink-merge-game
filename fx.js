// Ambient background motion — a few drifting details over the map art.
//
// This is a DOM layer (#stage-fx), stacked between #stage-bg and the game
// canvas, animated purely with CSS. That placement is the whole design:
//
//   * It costs the render loop NOTHING. game.js stops calling render() after
//     20 idle frames (the heat optimizer); a canvas particle would have to
//     force sceneBusy() true forever to keep moving, putting the game back at
//     a constant 60fps draw — exactly what that optimizer exists to avoid.
//     CSS keyframes keep drifting while the JS loop is fully parked.
//   * It draws ABOVE the background (so details cross the map art) but BELOW
//     the canvas (z-index 1), so drinks always sit in front of them.
//
// The art is an inline SVG data URI, not a PNG: no asset-pipeline entry, no
// AI generation spent, nothing added to the per-map download.
//
// A map opts in with `fx:` in config/maps.js — a preset name, optionally with
// overrides: fx: 'money'  or  fx: { preset:'money', count: 20, dir: -1 }.
//
// THE LAYER IS CLIPPED TO THE HORIZON BY DEFAULT (`band`). Running it over the
// whole stage was tried on Kyoto and rejected: motion across the play surface
// competes with the drinks in a precision aiming game. Keep ambient motion in
// the backdrop unless there's a specific reason not to.

// Own PRNG, deliberately NOT Math.random. Test mode replaces Math.random with a
// seeded generator (TT.seed), and this runs from loadMapAssets() — i.e. inside
// startGame, BEFORE rollFreshTiers() draws the opening tiers. Consuming draws
// here would silently change every seeded run on any map that has an `fx`.
// A fixed seed also means the drift pattern is identical every load, which is
// invisible to a player and one less thing to wonder about when comparing runs.
function fxRand(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- art ----------
function fxSvg(viewBox, body) {
  return 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '">' + body + '</svg>'
  ) + '")';
}

// Sakura petal: two lobes with a notch at the tip, deepening toward the base.
// The proportions matter more than they look: a wide petal with a deep notch
// reads as a HEART at the 10-20px these draw at (it did, first pass). Keep it
// taller than wide, with the notch only a little below the lobes.
function fxPetal(light, deep) {
  return fxSvg('0 0 100 100',
    '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + light + '"/>' +
      '<stop offset="1" stop-color="' + deep + '"/></linearGradient>' +
    '<path d="M50 97C27 81 17 55 26 33 33 16 44 14 50 25 56 14 67 16 74 33 83 55 73 81 50 97Z"' +
      ' fill="url(#g)"/>');
}

// Banknote. PLACEHOLDER art: at the 10-26px these draw at, a note reads from
// its silhouette, its green, and the pale oval where a portrait would be — not
// from any detail. Swap it for real art when the luxury map's palette exists.
function fxBill(light, deep, ink) {
  return fxSvg('0 0 200 96',
    '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + light + '"/>' +
      '<stop offset="1" stop-color="' + deep + '"/></linearGradient>' +
    '<rect x="1" y="1" width="198" height="94" rx="7" fill="url(#g)"/>' +
    '<rect x="11" y="10" width="178" height="76" rx="5" fill="none"' +
      ' stroke="' + ink + '" stroke-opacity=".45" stroke-width="4"/>' +
    '<ellipse cx="100" cy="48" rx="31" ry="27" fill="' + ink + '" fill-opacity=".22"/>' +
    '<circle cx="34" cy="48" r="9" fill="' + ink + '" fill-opacity=".3"/>' +
    '<circle cx="166" cy="48" r="9" fill="' + ink + '" fill-opacity=".3"/>');
}

// ---------- presets ----------
// axis   'y' = falls down the band, 'x' = blows across it
// band   'horizon' (clip to the map's horizon) or a 0..1 fraction of stage height
// size   the CROSS dimension in px at stage scale 1 (height for 'x', both for 'y')
// aspect drawn width / height
// dur    seconds for one full pass; paired with `size` by depth, so near = faster
// travel cross-axis drift over one pass, as % of the band's cross dimension
const FX_PRESETS = {
  // Falling cherry blossom. Written for Kyoto Night Market, which currently
  // ships with it OFF — see config/maps.js and CLAUDE.md.
  sakura: {
    axis:    'y',
    count:   22,
    art:     [fxPetal('#ffe6f0', '#ff9dc4'),
              fxPetal('#fff3f8', '#ffb9d4'),
              fxPetal('#ffdbe9', '#f07fae')],
    // RETUNED for the horizon band (2026-08-08). These were authored against
    // the full 620px stage; confined to ~24% of it, the old durations crawled
    // and the old travel worked out to a ~50deg near-diagonal fall.
    size:    [7, 16],
    dur:     [6.5, 3.5],
    wobble:  [2.4, 4.6],
    wobblePx:[6, 15],
    spin:    [9, 3.6],
    flutter: 'tumble',
    travel:  [-32, 32],
    opacity: [0.42, 0.88],
  },

  // Banknotes blowing across the backdrop, for the planned luxury map.
  // UNTUNED: there is no map to judge it against yet, so the numbers are a
  // starting point, not a result. `dir` flips the wind (1 = left to right,
  // -1 = right to left, 0 = mixed).
  money: {
    axis:    'x',
    count:   14,
    art:     [fxBill('#cfe3bd', '#7da173', '#2f4a33'),
              fxBill('#e2eecf', '#93b184', '#38553a'),
              fxBill('#c2d9b2', '#6d9068', '#2a4430')],
    aspect:  2.15,
    size:    [10, 26],
    dur:     [13, 6.5],
    wobble:  [1.2, 2.6],
    wobblePx:[5, 14],
    spin:    [8, 2.8],
    flutter: 'twist',
    travel:  [-45, 45],
    opacity: [0.5, 0.95],
    dir:     1,
  },
};

// depth 0 = far (small, dim, slow), 1 = near (big, bright, fast). Driving every
// size/speed/opacity from ONE random per particle is what makes the field read
// as depth rather than as noise.
function fxLerp(range, t) { return range[0] + (range[1] - range[0]) * t; }

// The pass is a plain translate along one axis, tilted by a static rotate on a
// wrapper whose transform-origin is the START of the path (so entry = start and
// exit = start + travel, exactly). Wind is authored as cross-axis TRAVEL rather
// than an angle because travel is what decides whether a particle is on screen:
// the angle that produces a given drift depends on the band's aspect.
const FX_SPAN = 1.30;                    // -15% -> 115% (see the keyframes)
const FX_CROSS_INSET = 16;               // % of the band kept clear on a crosswind
function fxTiltDeg(travelPct, alongPx, crossPx) {
  return Math.atan((travelPct / 100 * crossPx) / (FX_SPAN * alongPx)) * 180 / Math.PI;
}

function setMapFx(map) {
  const host = document.getElementById('stage-fx');
  if (!host) return;
  host.textContent = '';                 // clear the previous map's layer
  host.style.height = '';
  host.className = '';

  const spec = typeof map.fx === 'string' ? { preset: map.fx } : (map.fx || null);
  const base = spec && FX_PRESETS[spec.preset];
  if (!base) return;                     // map has no fx (or names one that doesn't exist)
  const p = Object.assign({}, base, spec);

  // Clip to the backdrop. HORIZON is a screen-space row in the same 0..H space
  // the stage box spans, and startGame() resolves it for the active size
  // variant BEFORE calling loadMapAssets — so read the live global, not
  // map.horizon, or a size variant's own horizon would be ignored.
  const bandFrac = p.band === undefined || p.band === 'horizon'
    ? (typeof HORIZON === 'number' ? HORIZON / H : 0.285)
    : p.band;
  host.style.height = (bandFrac * 100).toFixed(2) + '%';

  const horiz  = p.axis === 'x';
  host.className = horiz ? 'x' : 'y';
  // Path length and cross extent of the band, in world px — only their ratio
  // matters (it feeds the tilt), so the stage's display scale drops out.
  const alongPx = horiz ? W : H * bandFrac;
  const crossPx = horiz ? H * bandFrac : W;

  const rnd  = fxRand(0x5A4B12);
  const frag = document.createDocumentFragment();

  for (let i = 0; i < p.count; i++) {
    const depth = rnd();
    const size  = fxLerp(p.size, depth);

    // Pick where it enters, THEN a wind that keeps it in frame: a particle
    // entering at the far edge may only drift back inward, or it spends its
    // whole life clipped outside the band. (Choosing the two independently left
    // only ~7 of 18 petals visible at the sparsest moment — measured.)
    //
    // The allowance differs by axis. For a fall, the cross axis is the full
    // stage WIDTH, so overshooting the sides is free — that's how a petal blows
    // in from off-screen. For a crosswind the cross axis is the band's HEIGHT,
    // which is short: a particle placed at its edge is either wasted outside
    // the band or, worse, sliced by the hard clip at the horizon mid-flight,
    // where nothing is fading it. Inset it instead, by enough to cover the
    // wobble plus half a sprite.
    const edge   = horiz ? FX_CROSS_INSET : -12;       // % of the band
    const span   = 100 - 2 * edge;
    const start  = edge + rnd() * span;
    const lo     = Math.max(p.travel[0], edge - start);
    const hi     = Math.min(p.travel[1], (100 - edge) - start);
    const travel = lo + rnd() * Math.max(0, hi - lo);

    const tilt = document.createElement('div');
    tilt.className = 'fx-p';
    tilt.style[horiz ? 'top' : 'left'] = start.toFixed(1) + '%';
    // Rotating this wrapper tilts the wobble with it too, so the wobble stays
    // perpendicular to the path rather than always being axis-aligned.
    tilt.style.transform =
      'rotate(' + fxTiltDeg(travel, alongPx, crossPx).toFixed(2) + 'deg)';

    const pass = document.createElement('div');
    pass.className = 'fx-f';
    pass.style.animationDuration = fxLerp(p.dur, depth).toFixed(2) + 's';
    pass.style.animationDelay    = (-rnd() * 16).toFixed(2) + 's';  // mid-pass at load
    // dir 0 mixes both ways; otherwise every particle rides the same wind.
    const back = p.dir === undefined ? false : (p.dir === 0 ? rnd() < 0.5 : p.dir < 0);
    if (back) pass.style.animationDirection = 'reverse';

    const wob = document.createElement('div');
    wob.className = 'fx-s';
    wob.style.animationDuration = fxLerp(p.wobble, rnd()).toFixed(2) + 's';
    wob.style.animationDelay    = (-rnd() * 5).toFixed(2) + 's';
    wob.style.setProperty('--fx-wob', fxLerp(p.wobblePx, rnd()).toFixed(1) + 'px');

    const bit = document.createElement('i');
    const asp = p.aspect || 1;
    bit.style.backgroundImage   = p.art[i % p.art.length];
    bit.style.height            = 'calc(' + size.toFixed(1) + 'px * var(--fx-k))';
    bit.style.width             = 'calc(' + (size * asp).toFixed(1) + 'px * var(--fx-k))';
    bit.style.marginLeft        = 'calc(' + (-size * asp / 2).toFixed(1) + 'px * var(--fx-k))';
    bit.style.marginTop         = 'calc(' + (-size / 2).toFixed(1) + 'px * var(--fx-k))';
    bit.style.opacity           = fxLerp(p.opacity, depth).toFixed(2);
    bit.style.animationName     = p.flutter === 'twist' ? 'fx-twist' : 'fx-tumble';
    bit.style.animationDuration = fxLerp(p.spin, depth).toFixed(2) + 's';
    bit.style.animationDelay    = (-rnd() * 9).toFixed(2) + 's';
    if (rnd() < 0.5) bit.style.animationDirection = 'reverse';

    wob.appendChild(bit);
    pass.appendChild(wob);
    tilt.appendChild(pass);
    frag.appendChild(tilt);
  }
  host.appendChild(frag);
}

// Particle sizes and wobble are authored in px against the 420x620 stage; the
// real stage is drawn at `disp` (0.6x on a small phone up to MAX_SCALE 1.6x), so
// without this they would be twice as big, relatively, on a phone as on a
// desktop. fitCanvas() feeds the same scale it gives the canvas. Not animated,
// so the var() costs nothing per frame.
function fxSetScale(k) {
  const host = document.getElementById('stage-fx');
  if (host) host.style.setProperty('--fx-k', k.toFixed(3));
}
