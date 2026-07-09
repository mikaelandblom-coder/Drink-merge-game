const MAPS = [
  {
    id:        'hawaii',
    label:     'Hawaii',
    sublabel:  'Tiki Bar',
    bg:        'assets/images/bg-tikibar.png',
    bgm:       'assets/audio/bgm.mp3',
    bgmVol:    0.35,
    itemsData: null, // filled after items.js loads (see bottom of this file)
  },
  {
    id:        'saigon',
    label:     'Saigon',
    sublabel:  'Pho House',
    bg:        'assets/images/bg-saigon.png',
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
    bg:       'assets/images/bg-kyoto.png',
    bgm:      'assets/audio/Lantern Alley.mp3',
    bgmVol:   0.35,
    itemsData: null,
    // Two table framings share the same play field / hitboxes; only the
    // backdrop art changes. See the size checkbox in the main menu.
    sizes:       { large: 'assets/images/bg-kyoto.png',
                   small: 'assets/images/bg-kyoto-small.png' },
    defaultSize: 'large',
  },
  {
    id:       'mage',
    label:    'Mage Tower',
    sublabel: 'Arcane Sanctum',
    bg:       'assets/images/bg-mage.png',
    bgm:      'assets/audio/Arcane Sanctum.mp3',
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // this map awards cascade-merge multipliers
  },
  {
    id:       'teddy',
    label:    'Plushie Factory',
    sublabel: 'Made for Mai',
    bg:       'assets/images/bg-teddy.png',
    bgm:      'assets/audio/Stuffed with love.mp3',
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // cascade-merge multipliers (like Mage Tower)
    sizes:       { large: 'assets/images/bg-teddy-large.png',
                   small: 'assets/images/bg-teddy.png' },
    defaultSize: 'small',
  },
  {
    id:       'melody',
    label:    'Melody Lane',
    sublabel: 'Music Shop',
    bg:       'assets/images/bg-melody-small.png',
    bgm:      'assets/audio/Melody Lane.mp3',   // TODO: add track (or reuse another map's bgm)
    bgmVol:   0.35,
    itemsData: null,
    combos:   true,   // combos default on — a cascade rings out as a rising arpeggio
    coin:     'assets/images/melody-coin.png',  // custom coin/bag; maps that omit these use the shared art
    bag:      'assets/images/melody-bag.png',
    // TEMP: Large-table framing disabled until the large background art exists —
    // omitting `sizes` hides the "Large table" checkbox and plays only the small
    // framing (bg above). Restore both lines + the bg-melody-large copy entry in
    // process_assets.py once the large art is in. (defaultSize was 'small', so the
    // score/hitbox key stays 'melody' either way — no scores lost by toggling.)
    // sizes:       { large: 'assets/images/bg-melody-large.png',
    //                small: 'assets/images/bg-melody-small.png' },
    // defaultSize: 'small',
  },
];

// Wire item sets after items.js has defined them.
MAPS[0].itemsData = HAWAII_ITEMS;
MAPS[1].itemsData = SAIGON_ITEMS;
MAPS[2].itemsData = KYOTO_ITEMS;
MAPS[3].itemsData = MAGE_ITEMS;
MAPS[4].itemsData = TEDDY_ITEMS;
MAPS[5].itemsData = MELODY_ITEMS;

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
      m.sideInset = hb.sideInset || 0;
      if (hb.horizon !== undefined) m.horizon = hb.horizon;
      if (hb.freeLine !== undefined) m.freeLine = hb.freeLine;
    }
  }
}

let ACTIVE_MAP = MAPS[0];
