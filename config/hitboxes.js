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
      [-13, 529], [0, 354], [12, 236], [42, 183], [205, 175], [382, 183], [409, 254], [419, 358], [434, 509],
    ],
    cornerWalls: [
      { x:  -26, y:  475, len:   35, angle: -1.623 },
      { x:  -28, y:  439, len:   39, angle: -1.625 },
      { x:  -30, y:  403, len:   33, angle: -1.627 },
      { x:  -32, y:  369, len:   35, angle: -1.627 },
      { x:  -34, y:  335, len:   34, angle: -1.628 },
      { x:  -36, y:  301, len:   32, angle: -1.628 },
      { x:  -38, y:  266, len:   37, angle: -1.625 },
      { x:  -40, y:  230, len:   35, angle: -1.629 },
      { x:  -42, y:  196, len:   33, angle: -1.637 },
      { x:  -44, y:  165, len:   30, angle: -1.633 },
      { x:  -45, y:  132, len:   36, angle: -1.607 },
      { x:  -46, y:   99, len:   31, angle: -1.538 },
      { x:  -45, y:   66, len:   34, angle: -1.565 },
      { x:  -40, y:   34, len:   32, angle: -1.267 },
      { x:  -19, y:   12, len:   35, angle: -0.410 },
      { x:   12, y:    3, len:   31, angle: -0.147 },
      { x:   47, y:   -1, len:   38, angle: -0.063 },
      { x:   81, y:   -2, len:   31, angle: -0.023 },
      { x:  113, y:   -3, len:   32, angle: -0.004 },
      { x:  145, y:   -3, len:   33, angle:  0.005 },
      { x:  177, y:   -2, len:   32, angle:  0.006 },
      { x:  213, y:   -3, len:   39, angle: -0.006 },
      { x:  248, y:   -3, len:   31, angle: -0.018 },
      { x:  280, y:   -3, len:   33, angle: -0.017 },
      { x:  313, y:   -4, len:   33, angle: -0.005 },
      { x:  345, y:   -4, len:   31, angle:  0.019 },
      { x:  379, y:   -2, len:   38, angle:  0.066 },
      { x:  414, y:    2, len:   31, angle:  0.170 },
      { x:  444, y:   12, len:   33, angle:  0.500 },
      { x:  463, y:   37, len:   35, angle:  1.326 },
      { x:  465, y:   70, len:   31, angle:  1.674 },
      { x:  464, y:  101, len:   30, angle:  1.578 },
      { x:  463, y:  133, len:   35, angle:  1.580 },
      { x:  462, y:  170, len:   38, angle:  1.627 },
      { x:  460, y:  204, len:   31, angle:  1.634 },
      { x:  458, y:  237, len:   34, angle:  1.621 },
      { x:  457, y:  273, len:   37, angle:  1.610 },
      { x:  455, y:  307, len:   32, angle:  1.609 },
      { x:  454, y:  341, len:   34, angle:  1.608 },
      { x:  453, y:  374, len:   33, angle:  1.607 },
      { x:  452, y:  406, len:   30, angle:  1.606 },
      { x:  450, y:  437, len:   33, angle:  1.605 },
      { x:  450, y:  459, len:   12, angle:  1.605 },
    ],
  },
};

const ITEM_HITBOXES = {
  // (no overrides yet)
};
