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

// Pre-load all sprites and compute physics radii for every item set at startup.
[...HAWAII_ITEMS, ...SAIGON_ITEMS].forEach(item => {
  item.img = new Image();
  item.img.src = item.sprite;
  item.physR = item.r * 2.4 * item.bodyRatio / 2 * 0.88;
});
