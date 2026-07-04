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
    // Round tray: the straight left/right sides are handled by the per-map side
    // walls (sideInset widens the field a touch so items reach the rim), and
    // cornerWalls just rounds off the TOP. The arc is traced from the magenta
    // oval in assets/source/saigon/bg-saigon-hitbox.png (perspective-corrected
    // via unpersp so it lands on the rim as rendered). Bottom stays open for
    // the launcher.
    sideInset: -8,
    cornerWalls: [
      { x:   14, y:  180, len:   38, angle: -0.917 },
      { x:   43, y:  150, len:   48, angle: -0.711 },
      { x:   80, y:  124, len:   43, angle: -0.484 },
      { x:  126, y:  106, len:   56, angle: -0.288 },
      { x:  177, y:   95, len:   48, angle: -0.124 },
      { x:  227, y:   93, len:   52, angle:  0.038 },
      { x:  278, y:  100, len:   50, angle:  0.221 },
      { x:  322, y:  114, len:   43, angle:  0.402 },
      { x:  364, y:  136, len:   51, angle:  0.577 },
      { x:  400, y:  167, len:   46, angle:  0.832 },
    ],
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
];

// Wire item sets after items.js has defined them.
MAPS[0].itemsData = HAWAII_ITEMS;
MAPS[1].itemsData = SAIGON_ITEMS;
MAPS[2].itemsData = KYOTO_ITEMS;
MAPS[3].itemsData = MAGE_ITEMS;

let ACTIVE_MAP = MAPS[0];
