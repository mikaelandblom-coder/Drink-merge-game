// Per-map item sets. ITEMS (global) is set to the active map's array by startGame().
// bodyRatio: glass-body width / sprite height — determines physics collision radius.
// physR computed as: r * 2.4 * bodyRatio / 2 * 0.88

const HAWAII_ITEMS = [
  { name:'espresso',        r:15, glass:'#f7e9d0', liq:'#6b3a1f', sprite:'assets/images/drink-espresso-shot.png',         bodyRatio:0.634 },
  { name:'lime soda',       r:20, glass:'#eafaf0', liq:'#9bd45e', sprite:'assets/images/drink-mojito.png',                bodyRatio:0.625 },
  { name:'pink fizz',       r:26, glass:'#fdeef4', liq:'#ff8fb3', sprite:'assets/images/drink-strawberry-daiquiri.png',   bodyRatio:0.603 },
  { name:'blue lagoon',     r:33, glass:'#eef4fd', liq:'#5aa8e6', sprite:'assets/images/drink-blue-hawaiian.png',         bodyRatio:0.495 },
  { name:'mango lassi',     r:41, glass:'#fff5e6', liq:'#f2a93b', sprite:'assets/images/drink-mango-smoothie.png',        bodyRatio:0.54  },
  { name:'grape slush',     r:50, glass:'#f3ecff', liq:'#9a6fe8', sprite:'assets/images/drink-berry-shake.png',           bodyRatio:0.51  },
  { name:'sunset punch',    r:60, glass:'#ffefe9', liq:'#ff6b4a', sprite:'assets/images/drink-tiki-mug-cocktail.png',     bodyRatio:0.5   },
  { name:'golden ale',      r:71, glass:'#fffbe8', liq:'#ffd84d', sprite:'assets/images/drink-beer.png',                  bodyRatio:0.59  },
  { name:'emerald pitcher', r:83, glass:'#eafff8', liq:'#27c79a', sprite:'assets/images/drink-fruit-punch-pitcher.png',   bodyRatio:0.82  },
];

const SAIGON_ITEMS = [
  { name:'star anise',   r:15, glass:'#5c2e0a', liq:'#8b4513', sprite:'assets/images/pho-star-anise.png',   bodyRatio:0.80 },
  { name:'lime',         r:20, glass:'#d4edda', liq:'#5cb85c', sprite:'assets/images/pho-lime.png',         bodyRatio:0.75 },
  { name:'chili',        r:26, glass:'#fde8e8', liq:'#e53935', sprite:'assets/images/pho-chili.png',        bodyRatio:0.42 },
  { name:'thai basil',   r:31, glass:'#e8f5e9', liq:'#388e3c', sprite:'assets/images/pho-thai-basil.png',   bodyRatio:0.82 },
  { name:'bean sprouts', r:37, glass:'#fffff0', liq:'#c8d89a', sprite:'assets/images/pho-bean-sprouts.png', bodyRatio:0.72 },
  { name:'hoisin',       r:44, glass:'#fce8d5', liq:'#4a1a00', sprite:'assets/images/pho-hoisin.png',       bodyRatio:0.44 },
  { name:'pho bowl',     r:52, glass:'#fdf6ec', liq:'#c8860a', sprite:'assets/images/pho-bowl-small.png',   bodyRatio:0.86 },
  { name:'pho special',  r:60, glass:'#fdf6ec', liq:'#b8730a', sprite:'assets/images/pho-bowl-large.png',   bodyRatio:0.86 },
  { name:'pho pot',      r:71, glass:'#e8e8e8', liq:'#8b6914', sprite:'assets/images/pho-pot.png',          bodyRatio:0.82 },
];

const KYOTO_ITEMS = [
  { name:'ramune marble',  r:15, glass:'#d0eeff', liq:'#7bc8f0', sprite:'assets/images/kyoto-ramune.png',      bodyRatio:0.82 },
  { name:'ichigo daifuku', r:20, glass:'#fff0f5', liq:'#ff8fab', sprite:'assets/images/kyoto-mochi.png',       bodyRatio:0.85 },
  { name:'dango',          r:26, glass:'#fdf5e6', liq:'#f4a261', sprite:'assets/images/kyoto-dango.png',       bodyRatio:0.50 },
  { name:'taiyaki',        r:31, glass:'#fdebd0', liq:'#e07b39', sprite:'assets/images/kyoto-taiyaki.png',     bodyRatio:0.72 },
  { name:'matcha softserve',r:37,glass:'#eafaf1', liq:'#52b788', sprite:'assets/images/kyoto-softserve.png',   bodyRatio:0.52 },
  { name:'takoyaki',       r:44, glass:'#fdf3e7', liq:'#c97c3a', sprite:'assets/images/kyoto-takoyaki.png',    bodyRatio:0.88 },
  { name:'matcha parfait', r:52, glass:'#f0fff4', liq:'#40916c', sprite:'assets/images/kyoto-parfait.png',     bodyRatio:0.48 },
  { name:'unaju',          r:60, glass:'#1a1a1a', liq:'#8b3a0f', sprite:'assets/images/kyoto-unaju.png',       bodyRatio:0.82 },
  { name:'matcha cake',    r:71, glass:'#eafaf1', liq:'#2d6a4f', sprite:'assets/images/kyoto-matcha-cake.png', bodyRatio:0.85 },
];

const MAGE_ITEMS = [
  { name:'mana shard', r:15, glass:'#dff2ff', liq:'#7bc8f0', sprite:'assets/images/mage-crystal.png', bodyRatio:0.55 },
  { name:'mana potion',r:20, glass:'#bfe6ff', liq:'#3fa9f5', sprite:'assets/images/mage-potion.png',  bodyRatio:0.60 },
  { name:'gem ring',   r:26, glass:'#ffe9a8', liq:'#3f7bd0', sprite:'assets/images/mage-ring.png',    bodyRatio:0.62 },
  { name:'runestone',  r:31, glass:'#c8ccd0', liq:'#6fa8dc', sprite:'assets/images/mage-rune.png',    bodyRatio:0.72 },
  { name:'arcane orb', r:37, glass:'#d0eaff', liq:'#2f8fe0', sprite:'assets/images/mage-orb.png',     bodyRatio:0.78 },
  { name:'spell tome', r:44, glass:'#3a4a6a', liq:'#5a8fd0', sprite:'assets/images/mage-tome.png',    bodyRatio:0.70 },
  { name:'gem wand',   r:52, glass:'#e8d8ff', liq:'#9a6fe8', sprite:'assets/images/mage-wand.png',    bodyRatio:0.50 },
  { name:'rune portal',r:60, glass:'#e8d0ff', liq:'#8a4fd0', sprite:'assets/images/mage-portal.png',  bodyRatio:0.80 },
  { name:'archmage orb',r:71,glass:'#ffe8b0', liq:'#ffab3d', sprite:'assets/images/mage-ball.png',    bodyRatio:0.72 },
];

const TEDDY_ITEMS = [
  { name:'button',     r:15, glass:'#cfe4ff', liq:'#3f7bd0', sprite:'assets/images/teddy-button.png',     bodyRatio:0.80 },
  { name:'yarn ball',  r:20, glass:'#ffe4ee', liq:'#f2a0bd', sprite:'assets/images/teddy-yarn.png',       bodyRatio:0.85 },
  { name:'pincushion', r:26, glass:'#ffe0dc', liq:'#e04a3a', sprite:'assets/images/teddy-pincushion.png', bodyRatio:0.78 },
  { name:'stuffing',   r:31, glass:'#ffffff', liq:'#f0ece4', sprite:'assets/images/teddy-stuffing.png',   bodyRatio:0.78 },
  { name:'chick',      r:37, glass:'#fff6d0', liq:'#f5c542', sprite:'assets/images/teddy-chick.png',      bodyRatio:0.82 },
  { name:'capybara',   r:44, glass:'#f0e0c8', liq:'#b98a56', sprite:'assets/images/teddy-capybara.png',   bodyRatio:0.80 },
  { name:'bunny',      r:52, glass:'#efe6ff', liq:'#b9a5e0', sprite:'assets/images/teddy-bunny.png',      bodyRatio:0.68 },
  { name:'axolotl',    r:60, glass:'#ffe6ef', liq:'#f5a0b8', sprite:'assets/images/teddy-axolotl.png',    bodyRatio:0.80 },
  { name:'teddy bear', r:71, glass:'#f2dfc4', liq:'#b9814e', sprite:'assets/images/teddy-bear.png',       bodyRatio:0.78 },
];

// Melody Lane (music shop). Instruments small -> large; the merge SOUND climbs a
// pentatonic scale by tier (see popMusical in audio.js), independent of the
// instrument's real-world pitch. bodyRatio values are first-pass guesses —
// retrace each in tools/hitbox-editor.html once the art exists.
// `vis` (visual scale, default 1) shrinks the DRAWN sprite only (not the physics
// circle): instruments are drawn by height, so wide shapes (harmonica, trumpet)
// blow up in width. vis ~= 1/aspect lands every item's drawn extent on the same
// r-based ramp so sizes read by tier. Recompute if the art's proportions change.
const MELODY_ITEMS = [
  { name:'harmonica',   r:15, glass:'#eef1f4', liq:'#b8c0c8', sprite:'assets/images/melody-harmonica.png', bodyRatio:0.70, vis:0.38 },
  { name:'ocarina',     r:19, glass:'#e6f4ff', liq:'#5aa8e6', sprite:'assets/images/melody-ocarina.png',   bodyRatio:0.70, vis:0.67 },
  { name:'recorder',    r:23, glass:'#fdf9ee', liq:'#c9a86a', sprite:'assets/images/melody-recorder.png',  bodyRatio:0.32, vis:1.2 },
  { name:'ukulele',     r:28, glass:'#fdf1dd', liq:'#d89a4e', sprite:'assets/images/melody-ukulele.png',   bodyRatio:0.52 },
  { name:'trumpet',     r:33, glass:'#fff6db', liq:'#e0a92e', sprite:'assets/images/melody-trumpet.png',   bodyRatio:0.55, vis:0.43 },
  { name:'violin',      r:39, glass:'#f7e6cf', liq:'#a0522d', sprite:'assets/images/melody-violin.png',    bodyRatio:0.46, vis:0.83 },
  { name:'accordion',   r:45, glass:'#ffe3e0', liq:'#d0384e', sprite:'assets/images/melody-accordion.png', bodyRatio:0.62, vis:0.64 },
  { name:'electric guitar', r:52, glass:'#dbeaf7', liq:'#2e6fb0', sprite:'assets/images/melody-electric-guitar.png', bodyRatio:0.42 },
  { name:'saxophone',   r:61, glass:'#fff3cf', liq:'#d4a017', sprite:'assets/images/melody-saxophone.png', bodyRatio:0.52 },
  { name:'grand piano', r:71, glass:'#e8e8ec', liq:'#1a1a1a', sprite:'assets/images/melody-piano.png',     bodyRatio:0.78, vis:0.93 },
];

// Le Petit Café (Paris pâtisserie). Pastries small -> large. bodyRatio values
// are first-pass guesses — retrace each in tools/hitbox-editor.html; the
// croissant and éclair are elongated and should get CAPSULE hitboxes there.
// vis shrinks the DRAWN sprite of the wide items toward area parity
// (sqrt(0.75/aspect)) so sizes read by tier.
const PARIS_ITEMS = [
  { name:'sugar cube',      r:15, glass:'#ffffff', liq:'#f0ece4', sprite:'assets/images/paris-sugarcube.png',      bodyRatio:0.85 },
  { name:'macaron',         r:20, glass:'#ffd6e4', liq:'#f48fb1', sprite:'assets/images/paris-macaron.png',        bodyRatio:0.90 },
  { name:'petit chou',      r:26, glass:'#fdf0dd', liq:'#e8b04a', sprite:'assets/images/paris-petitchou.png',      bodyRatio:0.85 },
  { name:'croissant',       r:31, glass:'#fdeecd', liq:'#d89a3e', sprite:'assets/images/paris-croissant.png',      bodyRatio:0.70, vis:0.70 },
  { name:'eclair',          r:37, glass:'#ffdfe9', liq:'#f2a0bd', sprite:'assets/images/paris-eclair.png',         bodyRatio:0.50, vis:0.64 },
  { name:'berry tart',      r:44, glass:'#fde8e8', liq:'#d0384e', sprite:'assets/images/paris-berrytart.png',      bodyRatio:0.90 },
  { name:'paris-brest',     r:52, glass:'#f7e6cf', liq:'#c9843a', sprite:'assets/images/paris-parisbrest.png',     bodyRatio:0.90, vis:0.85 },
  { name:'charlotte',       r:60, glass:'#fff0f5', liq:'#e8879e', sprite:'assets/images/paris-charlotte.png',      bodyRatio:0.90 },
  { name:'strawberry cake', r:71, glass:'#fff5f8', liq:'#e0344a', sprite:'assets/images/paris-strawberrycake.png', bodyRatio:0.80 },
];

// Farm map ("Harvest Basket" chain). Combined in-session from two AI gens
// (see process_assets.py 'farm' entry + memory/design-farm-map). Deliberately
// ALL ROUND, CENTERED items — no capsules — to fix the awkward-hitbox feel that
// made Melody Lane unpopular. r curve reuses Paris's proven 15->71 ramp; vis is
// area-parity (sqrt(0.75/aspect)) for the mildly-wide produce; bodyRatio values
// are STARTING points sized to the round body — trace/tune each in
// tools/hitbox-editor.html before shipping. Background art still pending.
const FARM_ITEMS = [
  { name:'seed',         r:15, glass:'#7a4a24', liq:'#9a5a2c', sprite:'assets/images/farm-seed.png',         bodyRatio:0.90, vis:0.80 },
  { name:'sprout',       r:20, glass:'#7ec84f', liq:'#3f8f2f', sprite:'assets/images/farm-sprout.png',       bodyRatio:0.90, vis:0.83 },
  { name:'strawberry',   r:26, glass:'#e5382b', liq:'#c22a20', sprite:'assets/images/farm-strawberry.png',   bodyRatio:0.90, vis:0.88 },
  { name:'blueberries',  r:31, glass:'#4646a8', liq:'#33337a', sprite:'assets/images/farm-blueberry.png',    bodyRatio:0.90, vis:0.81 },
  { name:'bell pepper',  r:37, glass:'#ffcf2e', liq:'#efb000', sprite:'assets/images/farm-pepper.png',       bodyRatio:0.90, vis:0.85 },
  { name:'purple cabbage', r:44, glass:'#8f43b3', liq:'#6b2f8c', sprite:'assets/images/farm-cabbage.png',    bodyRatio:0.90, vis:0.78 },
  { name:'watermelon',   r:52, glass:'#3fa04a', liq:'#2c7838', sprite:'assets/images/farm-watermelon.png',   bodyRatio:0.90, vis:0.86 },
  { name:'cauliflower',  r:60, glass:'#eef0dd', liq:'#cfe0ad', sprite:'assets/images/farm-cauliflower.png',  bodyRatio:0.90, vis:0.80 },
  { name:'prize pumpkin',r:71, glass:'#ff9a2e', liq:'#e87a1f', sprite:'assets/images/farm-prizepumpkin.png', bodyRatio:0.90, vis:0.80 },
];

// Happy Hour mode: the receipt merge chain, shared by every map. Serving a
// customer's order spawns tier 0 (crumpled ball) where the served drink stood;
// receipts merge among themselves in parallel with the drink chain. The FINAL
// tier pays a bonus coin burst when it forms and then stays on the field for
// good, slowly filling the table (see game.js). vis values are area-parity
// (sqrt(0.75/aspect)) since the art is wider than a typical upright drink.
const RECEIPT_ITEMS = [
  { name:'crumpled receipt', r:16, glass:'#f5f2ea', liq:'#e8e2d4', sprite:'assets/images/receipt-ball.png',   bodyRatio:0.85, vis:0.83 },
  { name:'receipt slip',     r:21, glass:'#faf7ef', liq:'#efe9da', sprite:'assets/images/receipt-slip.png',   bodyRatio:0.72, vis:0.72 },
  { name:'receipt roll',     r:27, glass:'#faf7ef', liq:'#f2ecdf', sprite:'assets/images/receipt-roll.png',   bodyRatio:0.85, vis:0.83 },
  { name:'receipt stack',    r:34, glass:'#fbf6ea', liq:'#ffd84d', sprite:'assets/images/receipt-stack.png',  bodyRatio:0.80, vis:0.78 },
  { name:'golden receipt',   r:42, glass:'#fff3c4', liq:'#ffc83d', sprite:'assets/images/receipt-golden.png', bodyRatio:0.80, vis:0.83 },
];

// Pre-load all sprites and compute physics radii for every item set at startup.
// Collision-circle overrides from config/hitboxes.js (edited visually with
// tools/hitbox-editor.html) are applied before physR is derived.
[...HAWAII_ITEMS, ...SAIGON_ITEMS, ...KYOTO_ITEMS, ...MAGE_ITEMS, ...TEDDY_ITEMS, ...MELODY_ITEMS, ...PARIS_ITEMS, ...FARM_ITEMS, ...RECEIPT_ITEMS].forEach(item => {
  const hb = (typeof ITEM_HITBOXES !== 'undefined') && ITEM_HITBOXES[item.sprite];
  if (hb && hb.bodyRatio) item.bodyRatio = hb.bodyRatio;
  // Collision-circle offset relative to the sprite anchor, in units of r
  // (the sprite is drawn shifted the other way so the circle lands where
  // the editor placed it).
  item.hbOffX = (hb && hb.dx) || 0;
  item.hbOffY = (hb && hb.dy) || 0;
  item.img = new Image();
  // Guardrail against "tiny item" regressions (the melody harmonica shipped at
  // ~35% of its tier's visual footprint before this existed): once the art
  // loads, compare the DRAWN area — (r*2.4*vis)^2 * aspect — against the tier's
  // nominal footprint (a typical upright sprite: height r*2.4, aspect ~0.75)
  // and warn when it lands under 45% (calibrated so the slimmest legitimate
  // sprite, Saigon's hoisin bottle at 48%, stays quiet). Fix by raising vis
  // toward the area-parity value sqrt(0.75/aspect) — see CLAUDE.md.
  item.img.onload = () => {
    const aspect = item.img.naturalWidth / item.img.naturalHeight;
    const drawn   = Math.pow(item.r * 2.4 * (item.vis || 1), 2) * aspect;
    const nominal = Math.pow(item.r * 2.4, 2) * 0.75;
    if (drawn < nominal * 0.45) console.warn(
      '[items] "' + item.name + '" draws at ' + Math.round(100 * drawn / nominal) +
      '% of its tier\'s nominal area - raise vis toward sqrt(0.75/aspect) = ' +
      (Math.sqrt(0.75 / aspect)).toFixed(2) + ' (see CLAUDE.md, and scale its' +
      ' capsule hitbox by the same factor)');
  };
  item.img.src = item.sprite;
  const natH = item.r * 2.4;                 // sprites are sized by height
  if (hb && hb.shape === 'capsule') {
    // Elongated (stadium) hitbox for non-circular art: a rounded rectangle whose
    // half-extents are fractions of sprite height (same 0.88 fudge as physR, so a
    // square capsule matches the equivalent circle). Built and LOCKED UPRIGHT in
    // makeDrink() — see game.js. physR keeps the SHORT (vertical) half-extent so
    // the shadow + danger-line checks keep working unchanged.
    const rot = hb.rot || 0;
    item.cap   = { hw: natH * hb.w / 2 * 0.88, hh: natH * hb.h / 2 * 0.88, rot };
    // Vertical half-extent of the rotated stadium — the danger-line check adds
    // this to the body centre (physR keeps meaning "downward reach").
    item.physR = Math.abs(item.cap.hw * Math.sin(rot)) + Math.abs(item.cap.hh * Math.cos(rot));
  } else {
    item.cap   = null;
    item.physR = natH * item.bodyRatio / 2 * 0.88;
  }
});
