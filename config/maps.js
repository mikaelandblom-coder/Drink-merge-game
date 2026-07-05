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
  },
];

// Wire item sets after items.js has defined them.
MAPS[0].itemsData = HAWAII_ITEMS;
MAPS[1].itemsData = SAIGON_ITEMS;
MAPS[2].itemsData = KYOTO_ITEMS;
MAPS[3].itemsData = MAGE_ITEMS;
MAPS[4].itemsData = TEDDY_ITEMS;

// Apply visually-edited boundaries from config/hitboxes.js
// (maintained with tools/hitbox-editor.html).
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
