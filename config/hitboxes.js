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
      [79, 534], [40, 481], [14, 446], [2, 399], [6, 354], [27, 317], [53, 290], [93, 264], [168, 242], [247, 239], [317, 258], [384, 300], [415, 348], [418, 429], [373, 524],
    ],
    cornerWalls: [
      { x:   63, y:  485, len:   34, angle: -2.118 },
      { x:   45, y:  456, len:   34, angle: -2.131 },
      { x:   27, y:  429, len:   31, angle: -2.157 },
      { x:    7, y:  401, len:   38, angle: -2.202 },
      { x:  -11, y:  368, len:   39, angle: -1.974 },
      { x:  -23, y:  335, len:   30, angle: -1.838 },
      { x:  -29, y:  305, len:   31, angle: -1.724 },
      { x:  -32, y:  274, len:   31, angle: -1.582 },
      { x:  -28, y:  239, len:   39, angle: -1.349 },
      { x:  -16, y:  205, len:   35, angle: -1.123 },
      { x:    1, y:  177, len:   30, angle: -0.923 },
      { x:   21, y:  154, len:   31, angle: -0.790 },
      { x:   47, y:  132, len:   37, angle: -0.599 },
      { x:   77, y:  116, len:   33, angle: -0.390 },
      { x:  111, y:  104, len:   38, angle: -0.302 },
      { x:  147, y:   94, len:   37, angle: -0.204 },
      { x:  184, y:   89, len:   37, angle: -0.105 },
      { x:  221, y:   86, len:   37, angle: -0.008 },
      { x:  258, y:   88, len:   37, angle:  0.111 },
      { x:  294, y:   95, len:   36, angle:  0.245 },
      { x:  328, y:  106, len:   37, angle:  0.394 },
      { x:  361, y:  123, len:   37, angle:  0.535 },
      { x:  392, y:  143, len:   37, angle:  0.657 },
      { x:  418, y:  167, len:   35, angle:  0.816 },
      { x:  439, y:  195, len:   35, angle:  1.051 },
      { x:  451, y:  229, len:   37, angle:  1.387 },
      { x:  455, y:  265, len:   35, angle:  1.547 },
      { x:  453, y:  302, len:   40, angle:  1.670 },
      { x:  448, y:  337, len:   32, angle:  1.801 },
      { x:  437, y:  371, len:   40, angle:  1.949 },
      { x:  422, y:  406, len:   34, angle:  2.018 },
      { x:  407, y:  436, len:   33, angle:  2.037 },
      { x:  392, y:  466, len:   34, angle:  2.032 },
    ],
  },
  kyoto: {
    sideInset: 0,
    closed: false,
    knots: [
      [31, 295], [56, 161], [205, 175], [361, 176], [390, 301],
    ],
    cornerWalls: [
      { x:  -13, y:  146, len:   39, angle: -1.636 },
      { x:  -15, y:  110, len:   33, angle: -1.666 },
      { x:  -18, y:   76, len:   36, angle: -1.634 },
      { x:  -19, y:   41, len:   34, angle: -1.555 },
      { x:   -9, y:   12, len:   32, angle: -0.879 },
      { x:   20, y:    0, len:   36, angle:  0.000 },
      { x:   57, y:    0, len:   38, angle:  0.000 },
      { x:   91, y:    0, len:   31, angle:  0.000 },
      { x:  123, y:    0, len:   33, angle:  0.000 },
      { x:  156, y:    0, len:   32, angle:  0.000 },
      { x:  187, y:    0, len:   31, angle:  0.000 },
      { x:  223, y:    0, len:   40, angle:  0.000 },
      { x:  259, y:    0, len:   32, angle:  0.000 },
      { x:  291, y:    0, len:   33, angle:  0.000 },
      { x:  323, y:    0, len:   32, angle:  0.000 },
      { x:  358, y:    0, len:   38, angle:  0.000 },
      { x:  393, y:    0, len:   30, angle:  0.000 },
      { x:  419, y:   15, len:   38, angle:  0.904 },
      { x:  433, y:   46, len:   33, angle:  1.443 },
      { x:  435, y:   81, len:   36, angle:  1.578 },
      { x:  434, y:  116, len:   35, angle:  1.635 },
      { x:  432, y:  151, len:   35, angle:  1.627 },
    ],
  },
};

const ITEM_HITBOXES = {
  // (no overrides yet)
};
