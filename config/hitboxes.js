// Hitbox data — edited visually with tools/hitbox-editor.html (do not hand-tweak,
// open the tool instead: http://localhost:5500/tools/hitbox-editor.html).
//
// MAP_HITBOXES[mapId]:
//   knots       — spline control points in FLAT canvas coords (what you see on
//                 screen). The editor lets you drag/add/remove these.
//   closed      — false leaves the curve open (bottom opening for the launcher)
//   sideInset   — left/right wall inset; negative widens the field
//   cornerWalls — GENERATED from the spline (perspective-corrected physics
//                 segments consumed by game.js). Regenerated on every save.
//
// ITEM_HITBOXES[spritePath]:
//   bodyRatio   — overrides the item's collision-circle size (see items.js)

const MAP_HITBOXES = {
  saigon: {
    sideInset: -8,
    closed: false,
    knots: [
      [39, 316], [60, 295], [91, 273], [123, 258], [165, 247], [203, 242],
      [244, 244], [282, 252], [314, 264], [351, 284], [378, 308],
    ],
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
};

const ITEM_HITBOXES = {
  // 'assets/images/pho-lime.png': { bodyRatio: 0.75 },
};
