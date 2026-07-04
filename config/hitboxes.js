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
      [25, 322], [54, 288], [91, 266], [136, 250], [171, 243], [206, 241], [246, 242], [288, 248], [318, 259], [354, 280], [386, 311],
    ],
    cornerWalls: [
      { x:   -5, y:  187, len:   36, angle: -1.049 },
      { x:   16, y:  158, len:   38, angle: -0.834 },
      { x:   45, y:  134, len:   37, angle: -0.552 },
      { x:   76, y:  117, len:   34, angle: -0.411 },
      { x:  108, y:  105, len:   33, angle: -0.317 },
      { x:  142, y:   97, len:   37, angle: -0.190 },
      { x:  175, y:   92, len:   30, angle: -0.087 },
      { x:  206, y:   90, len:   32, angle: -0.023 },
      { x:  239, y:   90, len:   34, angle:  0.037 },
      { x:  274, y:   93, len:   37, angle:  0.127 },
      { x:  308, y:  100, len:   31, angle:  0.248 },
      { x:  339, y:  111, len:   35, angle:  0.456 },
      { x:  369, y:  128, len:   35, angle:  0.580 },
      { x:  397, y:  153, len:   40, angle:  0.827 },
      { x:  418, y:  177, len:   25, angle:  0.938 },
    ],
  },
};

const ITEM_HITBOXES = {
  // (no overrides yet)
};
