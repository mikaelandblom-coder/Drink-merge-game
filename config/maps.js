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
