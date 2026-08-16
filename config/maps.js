const MAPS = [
  {
    id:        'hawaii',
    label:     'Hawaii',
    sublabel:  'Tiki Bar',
    bg:        'assets/images/hawaii/bg.webp',
    bgm:       'assets/audio/bgm.mp3',
    bgmVol:    0.35,
    itemsData: null, // filled after items.js loads (see bottom of this file)
  },
  {
    id:        'saigon',
    label:     'Saigon',
    sublabel:  'Pho House',
    bg:        'assets/images/saigon/bg.webp',
    bgm:       'assets/audio/bgm-saigon.mp3',
    bgmVol:    0.30,
    itemsData: null, // filled below
    // Round tray: boundary lives in config/hitboxes.js (edit visually with
    // tools/hitbox-editor.html) and is applied below.
  },
  {
    id:       'kyoto',
    label:    'Kyoto',
    sublabel: 'Night Market',
    bg:       'assets/images/kyoto/bg_large.webp',
    bgm:      'assets/audio/Lantern Alley.mp3',
    bgmVol:   0.35,
    itemsData: null,
    // Two table framings share the same play field / hitboxes; only the
    // backdrop art changes. See the size checkbox in the main menu.
    sizes:       { large: 'assets/images/kyoto/bg_large.webp',
                   small: 'assets/images/kyoto/bg_small.webp' },
    defaultSize: 'large',
    // TEMP-OFF: drifting sakura (fx.js). Mikael tried it 2026-08-08 and found
    // it DISTRACTING here — at the time the layer covered the WHOLE stage, and
    // Kyoto is the worst case for that: pale petals crossing a big, dark,
    // near-empty lacquer tray are the highest-contrast moving thing on screen,
    // exactly where you're aiming.
    // fx.js has since been clipped to the horizon band, which removes that
    // specific problem — so this may well be fine now. It stays off because
    // turning it back on is HIS call, not a cleanup: ask before uncommenting.
    // fx: 'sakura',
  },
  {
    id:       'mage',
    label:    'Mage Tower',
    sublabel: 'Arcane Sanctum',
    bg:       'assets/images/mage/bg.webp',
    bgm:      'assets/audio/Arcane Sanctum.mp3',
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // this map awards cascade-merge multipliers
  },
  {
    id:       'teddy',
    label:    'Plushie Factory',
    sublabel: 'Made for Mai',
    bg:       'assets/images/teddy/bg.webp',
    bgm:      'assets/audio/Stuffed with love.mp3',
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // cascade-merge multipliers (like Mage Tower)
    sizes:       { large: 'assets/images/teddy/bg_large.webp',
                   small: 'assets/images/teddy/bg.webp' },
    defaultSize: 'small',
  },
  {
    id:       'melody',
    label:    'Melody Lane',
    sublabel: 'Music Shop',
    bg:       'assets/images/melody/bg.webp',
    bgm:      'assets/audio/Melody Lane.mp3',   // TODO: add track (or reuse another map's bgm)
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // combos default on — a cascade rings out as a rising arpeggio
    coin:     'assets/images/melody/coin.png',  // custom coin/bag; maps that omit these use the shared art
    bag:      'assets/images/melody/bag.png',
    // TEMP: Large-table framing disabled until the large background art exists —
    // omitting `sizes` hides the "Large table" checkbox and plays only the small
    // framing (bg above). Drop the art in assets/source/melody/bg_large.png,
    // run `python compress_backgrounds.py` to emit the .webp, and restore both
    // lines once it's in. (defaultSize was 'small', so the score/hitbox key
    // stays 'melody' either way — no scores lost by toggling.)
    // sizes:       { large: 'assets/images/melody/bg_large.webp',
    //                small: 'assets/images/melody/bg.webp' },
    // defaultSize: 'small',
  },
  {
    id:       'paris',
    label:    'Paris',
    sublabel: 'Le Petit Café',
    bg:       'assets/images/paris/bg_large.webp',
    bgm:      'assets/audio/Le Petit Cafe.mp3',
    bgmVol:   0.35,
    itemsData: null,
    sizes:       { large: 'assets/images/paris/bg_large.webp',
                   small: 'assets/images/paris/bg_small.webp' },
    defaultSize: 'large',
  },
  {
    id:       'farm',
    label:    'Farm',
    sublabel: 'Sprout Valley',   // working name, not locked (see memory/design-farm-map)
    bg:       'assets/images/farm/bg_large.webp',
    bgm:      'assets/audio/Sprout Valley.mp3',  // TODO: add Suno track (Stardew-vibe
                                                 // folk loop). Missing file just 404s — no crash.
    bgmVol:   0.35,
    itemsData: null,
    // Sounds (sprout-bloop merge + dirt-thud collision + wooden coin tick) are
    // wired up in config/soundmap.js, not here — edit them in the sound lab.
    // TEMP: only the LARGE framing art exists yet. Omitting `sizes` hides the
    // "Large table" checkbox and plays `bg` above. defaultSize is intended
    // 'large', and since the default size keeps the plain map-id key ('farm'),
    // the boundary you trace NOW is the large boundary and is reused when sizes
    // is restored. Drop assets/source/farm/bg_small.png in, run
    // `python compress_backgrounds.py` to emit the .webp, then uncomment:
    // sizes:       { large: 'assets/images/farm/bg_large.webp',
    //                small: 'assets/images/farm/bg_small.webp' },
    // defaultSize: 'large',
  },
  {
    id:       'cantho',
    label:    'Cần Thơ',
    sublabel: 'Floating Market',
    bg:       'assets/images/cantho/bg_small.webp',
    bgm:      'assets/audio/Can Tho.mp3',   // TODO: add Suno track (Mekong-morning
                                            // dan tranh loop). Missing file just 404s — no crash.
    bgmVol:   0.35,
    itemsData: null,
    // The play surface is the BOAT'S PROW DECK: a long deck tapering to a
    // rounded prow at the far end, unlike any other map's boundary (Saigon,
    // the other Vietnamese map, is a round tray). Trace it in
    // tools/hitbox-editor.html — the deck edge where the planks meet the
    // gunwale is the wall.
    // Sounds inherit the `default` SOUND_MAP row until the map plays well;
    // theme them in tools/sound-lab.html then, not here.
    // defaultSize is 'small' — the ORIGINAL framing, which is the one that
    // shipped and the one Mai has been playing. Keeping it the default is what
    // makes both her `mm_s_cantho` scores and the already-traced `cantho`
    // boundary carry over untouched (scoreKey/hitboxKey give the default size
    // the plain map id). 'large' is the WIDER re-framing added 2026-08-02
    // because the original deck tapers so hard at the prow that the endgame
    // gets cramped; it traces its own boundary under `cantho__large`.
    sizes:       { large: 'assets/images/cantho/bg_large.webp',
                   small: 'assets/images/cantho/bg_small.webp' },
    defaultSize: 'small',
  },
  {
    id:       'pizza',
    label:    'Napoli',
    sublabel: 'Pizzeria',
    // TEMP PLACEHOLDER so the map is playable. Both oven backdrops generated on
    // 2026-08-16 sit at ~45-55 degrees off vertical, and the item art is drawn
    // straight down, so flat discs read as propped-up plates. The engine's own
    // camera is much steeper — persp() narrows the far edge to 74% and drawDrink
    // squashes the ground shadow to 0.82, i.e. ~35 degrees off vertical — so the
    // replacement wants that angle, a pale surface (tier 0 is a near-black olive)
    // and a horizon at world y >= ~235 for Happy Hour's cast. The full spec and
    // prompt are in assets/source/pizza/PROMPT.md. Point this at bg.webp when the
    // new art lands and archive the two ovens.
    bg:       'assets/images/pizza/bg_2.webp',
    bgm:      'assets/audio/Napoli.mp3',   // TODO: add Suno track (sunny mandolin
                                           // trattoria loop). Missing file just 404s — no crash.
    bgmVol:   0.35,
    itemsData: null,
    // THE ROTATION MAP. `spin` was built (2026-08-16) with this map in mind and
    // no map has used it until now: items draw at their real physics angle
    // instead of the idle wobble. It is purely cosmetic — the bodies always
    // rotated, this only decides whether drawDrink reads body.angle — so it
    // cannot change physics, scores or seeded runs. It works HERE and not
    // elsewhere because every subject in PIZZA_ITEMS is radially symmetric; see
    // "Rotating items" in CLAUDE.md before adding an item that isn't.
    spin:     true,
    // Sprites are anchored by their CENTRE here, not by their base. Every other
    // map draws objects STANDING on a table, so the art hangs below the body and
    // the shadow peeks out at its foot. This map's food LIES on the oven floor:
    // the disc is dead centre in each sprite, and base-anchoring drew it 0.45r
    // above its own collision circle (measured on all nine), so items levitated
    // and touching ones looked interpenetrated. See drawDrink in render.js.
    // `?flat=1` / `?flat=0` force it either way for comparison, like `?spin`.
    flat:     true,
    // The play surface is the FLOOR OF A WOOD-FIRED OVEN: a wide firebrick
    // hearth whose far edge curves up into the dome, i.e. a broad arch/"D" —
    // no other map has that boundary (Saigon is a round tray, Can Tho a
    // tapering boat deck, the rest are tables). Trace it in
    // tools/hitbox-editor.html; the brick-to-dome seam is the wall.
    // Sounds inherit the `default` SOUND_MAP row until the map plays well;
    // theme them in tools/sound-lab.html then, not here.
    // NOT locked: the art does not exist yet, so this card plays into a missing
    // background on purpose while the map is being built on its branch. Set
    // `locked: true` if it ever has to reach main before the art does — that
    // renders a "Coming soon" card instead (welcome.js).
  },
];

// Wire item sets after items.js has defined them.
MAPS[0].itemsData = HAWAII_ITEMS;
MAPS[1].itemsData = SAIGON_ITEMS;
MAPS[2].itemsData = KYOTO_ITEMS;
MAPS[3].itemsData = MAGE_ITEMS;
MAPS[4].itemsData = TEDDY_ITEMS;
MAPS[5].itemsData = MELODY_ITEMS;
MAPS[6].itemsData = PARIS_ITEMS;
MAPS[7].itemsData = FARM_ITEMS;
MAPS[8].itemsData = CANTHO_ITEMS;
MAPS[9].itemsData = PIZZA_ITEMS;

// Storage key for a map's boundary in MAP_HITBOXES. Size-variant maps trace a
// separate boundary per table framing (the tray/heart sits differently in each
// background). The DEFAULT size keeps the plain map id — so existing tuned
// hitboxes are reused untouched — while a non-default size gets a suffix.
// Shared by startGame() (game.js) and the hitbox editor. Mirrors scoreKey().
function hitboxKey(map, size) {
  if (!map.sizes) return map.id;
  const defSize = map.defaultSize || 'large';
  const s = size || defSize;
  return (s === defSize) ? map.id : (map.id + '__' + s);
}

// Apply visually-edited boundaries from config/hitboxes.js
// (maintained with tools/hitbox-editor.html). This seeds each map's DEFAULT
// boundary; startGame() re-applies the active size variant's boundary at play.
if (typeof MAP_HITBOXES !== 'undefined') {
  for (const m of MAPS) {
    const hb = MAP_HITBOXES[m.id];
    if (hb) {
      m.cornerWalls = hb.cornerWalls;
      if (hb.horizon !== undefined) m.horizon = hb.horizon;
      if (hb.freeLine !== undefined) m.freeLine = hb.freeLine;
      if (hb.dangerLine !== undefined) m.dangerLine = hb.dangerLine;
    }
  }
}

let ACTIVE_MAP = MAPS[0];
