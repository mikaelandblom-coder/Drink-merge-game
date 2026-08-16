"""
Asset pipeline: AI-generated images → game-ready transparent PNGs.

Usage:
    python process_assets.py                   # process everything
    python process_assets.py --map tikibar     # one map only
    python process_assets.py --map shared      # shared assets only

Drop AI output (white background) into assets/source/<map>/ and add an
entry to PIPELINE below. Run the script. Done.

If the AI produced a FAKE transparent background (a grey checkerboard painted
into the pixels), use chroma:'checker' — the checker grid is fitted and keyed
out safely, even under white/grey items. See remove_checker_bg.

--- Spritesheet tip ---
Ask the AI to place a solid bright-magenta (#FF00FF) line between items.
Set 'separator': [255, 0, 255] in the spritesheet config and the script will
split exactly on that color — no guessing, no debris, no missing content.
"""

import argparse
import sys
from collections import deque
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("Missing dependencies. Run:  pip install pillow numpy")


# ===========================================================================
# PIPELINE CONFIG — add a new map by adding an entry here
# ===========================================================================
#
# Types:
#   spritesheet  — grid of items split automatically or by separator color.
#                  'grid': (rows, cols)
#                  'names': output filenames in row-major order
#                  'separator': [R,G,B] color of dividing lines (optional;
#                               omit to use whitespace auto-detection)
#                  'fill_holes': True to make enclosed white regions (e.g.
#                               handle holes) transparent (optional)
#                  'chroma': background type (optional, default 'white'):
#                     'alpha'   — REAL transparent background; split on gutters
#                     'checker' — FAKE transparency: the AI painted the grey
#                                 checkerboard into the pixels. The checker
#                                 grid is fitted (period+phase per axis) and
#                                 only pixels matching their own predicted
#                                 tile colour are removed, so white/grey items
#                                 survive; then splits like 'alpha'.
#                                 'checker_tol' overrides the match tolerance.
#                     'green'   — green-screen keying
#
#   pair         — two items side by side.
#                  'names': [left_name, right_name]
#                  'white_thresh': per-image override (optional)
#
#   single       — one item per file.
#                  'name': output filename (without extension)
#                  'fill_holes': True to make enclosed white holes transparent
#                  'white_thresh': per-image override (optional)
#                  'min_hole_px': minimum hole size in pixels (default 300)
#
# Backgrounds need no processing and are NOT in the pipeline: the game loads
# them straight from assets/source/<map>/ (see `bg:` in config/maps.js).

PIPELINE = {

    'shared': [
        {
            'file':         'coins_and_bag.png',
            'type':         'pair',
            'names':        ['shared/coin', 'shared/moneybag'],
            'white_thresh': 245,   # gold edges are close to white; be strict
        },
        # Happy Hour mode: customer cast (shared across all maps)
        {
            'file':   'customers.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'alpha',
            'min_component_frac': 0.05,  # cells grab slivers of the neighbour above/below
                                         # (ledge/hat fragments, <=2.4%); characters are a
                                         # single blob at 97%+ so 0.05 is safe both ways
            'names':  [
                'shared/customer-granny',  'shared/customer-girl',      'shared/customer-sailor',
                'shared/customer-student', 'shared/customer-artist',    'shared/customer-businessman',
                'shared/customer-surfer',  'shared/customer-professor', 'shared/customer-tourist',
            ],
        },
        # Happy Hour mode: 5-tier receipt merge chain (shared across all maps)
        {
            'file':   'receipts.png',
            'type':   'spritesheet',
            'grid':   (1, 5),
            'chroma': 'alpha',
            'names':  [
                'shared/receipt-ball', 'shared/receipt-slip', 'shared/receipt-roll',
                'shared/receipt-stack', 'shared/receipt-golden',
            ],
        },
        # XP bar (progress.js): plush stitched frame + level medallion, one
        # transparent sheet. The frame is consumed as a 9-slice border-image
        # (style.css #xp-bar.h rules) — regenerate slices there if the art
        # ever changes.
        # The split PNGs are the MASTERS for compress_backgrounds.py (the game
        # serves the WebP it makes from them), so they land in source/chrome/
        # with the other chrome masters — NOT in assets/images/, which holds
        # only served files.
        {
            'file':   'xp_bar.png',
            'type':   'spritesheet',
            'grid':   (2, 1),
            'chroma': 'alpha',
            'names':  ['../source/chrome/xp-bar-frame', '../source/chrome/xp-medal'],
        },
    ],

    'tikibar': [
        {'file': 'drink-espresso-shot.png',      'type': 'single', 'name': 'hawaii/espresso-shot'},
        {'file': 'drink-mojito.png',              'type': 'single', 'name': 'hawaii/mojito'},
        {'file': 'drink-strawberry-daiquiri.png', 'type': 'single', 'name': 'hawaii/strawberry-daiquiri'},
        {'file': 'drink-blue-hawaiian.png',       'type': 'single', 'name': 'hawaii/blue-hawaiian'},
        {'file': 'drink-mango-smoothie.png',      'type': 'single', 'name': 'hawaii/mango-smoothie'},
        {'file': 'drink-berry-shake.png',         'type': 'single', 'name': 'hawaii/berry-shake'},
        {'file': 'drink-tiki-mug-cocktail.png',   'type': 'single', 'name': 'hawaii/tiki-mug-cocktail'},
        {'file': 'drink-beer.png',                'type': 'single', 'name': 'hawaii/beer',
         'fill_holes': True, 'fill_holes_region': 'right'},
        {'file': 'drink-fruit-punch-pitcher.png', 'type': 'single', 'name': 'hawaii/fruit-punch-pitcher',
         'fill_holes': True, 'min_hole_px': 300},
    ],

    'saigon': [
        {
            'file':      'pho-items-spritesheet.png',
            'type':      'spritesheet',
            'grid':      (1, 9),
            'separator':     [252, 102, 252],  # actual separator color from AI output
            'sep_tol':       40,               # looser tolerance; AI color varied slightly
            'sep_threshold': 0.01,             # some lines were faint (~1% coverage)
            'names':     [
                'saigon/star-anise', 'saigon/lime', 'saigon/chili',
                'saigon/thai-basil', 'saigon/bean-sprouts', 'saigon/hoisin',
                'saigon/bowl-small', 'saigon/bowl-large', 'saigon/pot',
            ],
        },
    ],

    'kyoto': [
        {
            'file':      'sprite collecction.png',
            'type':      'spritesheet',
            'grid':      (3, 3),
            'col_splits': [417, 835],
            'row_splits': [418, 835],
            'names':     [
                'kyoto/ramune', 'kyoto/mochi', 'kyoto/dango',
                'kyoto/taiyaki', 'kyoto/softserve', 'kyoto/takoyaki',
                'kyoto/parfait', 'kyoto/unaju', 'kyoto/matcha-cake',
            ],
        },
    ],

    'mage': [
        {
            # v2 sheet: REAL transparent background (the workflow fix) — split
            # on alpha gutters, no keying, no separators. The generator drew a
            # 3x4 grid with a duplicate tome, a duplicate portal and one empty
            # cell; None skips those.
            'file':      'merge items v2.png',
            'type':      'spritesheet',
            'grid':      (4, 3),
            'chroma':    'alpha',
            'names':     [
                'mage/crystal', 'mage/potion', 'mage/ring',
                'mage/rune',    'mage/orb',    'mage/tome',
                'mage/wand',    'mage/portal', None,          # dup tome
                None,           None,          'mage/ball',   # empty, dup portal
            ],
        },
    ],

    'teddy': [
        {
            'file':   'merge items.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'alpha',        # real transparent background
            'names':  [
                'teddy/button',   'teddy/yarn',    'teddy/pincushion',
                'teddy/stuffing', 'teddy/chick',   'teddy/capybara',
                'teddy/bunny',    'teddy/axolotl', 'teddy/bear',
            ],
        },
    ],

    'melody': [
        # All 12 items in ONE transparent grid from ChatGPT (real alpha bg, no
        # white keying). split_alpha_grid finds cells from the transparent gutters
        # and tight-crops each — tolerant of uneven spacing, but every row/column
        # gutter must stay clear: the art needs generous gaps and NO drop shadows
        # (a shadow bridging a gutter breaks the band-count assert). Confirm the
        # grid dims against the real image; if the generator drifts, fall back to
        # hardcoded col_splits/row_splits (see the mage/kyoto notes above).
        {
            'file':   'items_grid.png',
            'type':   'spritesheet',
            'grid':   (3, 4),   # (rows, cols) — names below are row-major reading order
            'chroma': 'alpha',
            'min_component_frac': 0.05,   # drop stray bits a cell grabbed from a neighbour
                                          # (trumpet's leftover); keeps real parts like the violin bow
            'names':  [
                'melody/harmonica', 'melody/ocarina',  'melody/recorder',  'melody/ukulele',
                'melody/trumpet',   'melody/violin',    'melody/accordion', 'melody/electric-guitar',
                'melody/saxophone', 'melody/piano',     'melody/coin',      'melody/bag',
            ],
        },
        # TODO: larger framing (mat fills the frame). Backgrounds skip the
        # pipeline — save it as assets/source/melody/bg_large.png and restore
        # the commented `sizes` block in config/maps.js.
    ],

    'paris': [
        # Row 1 (sugar cube / macaron / petit chou) stays from the original
        # sheet; rows 2-3 were re-generated with more colour in "items v2.png".
        {
            'file':   'items.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'alpha',        # real transparent background
            'names':  [
                'paris/sugarcube',  'paris/macaron',   'paris/petitchou',
                None,               None,              None,
                None,               None,              None,
            ],
        },
        {
            'file':   'items v2.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'alpha',
            'min_component_frac': 0.05,   # croissant/charlotte cells grabbed slivers of
                                          # their neighbours (<=0.3%); items are one blob
            'names':  [
                None,               None,              None,
                'paris/croissant',  'paris/eclair',    'paris/berrytart',
                'paris/parisbrest', 'paris/charlotte', 'paris/strawberrycake',
            ],
        },
    ],

    # 'farm' has NO entry on purpose: its shipped art is owned by
    # tools/sprite-editor.html, not this script. The nine sprites in
    # assets/images/farm/ were extracted from "items 3.png" in the sprite
    # editor (commit 27ceb7d), which also tuned ITEM_HITBOXES, bodyRatio and
    # glass/liq to exactly those crops; prizepumpkin was later replaced via
    # the editor's downscale-on-save (76f968c). The old items_combined.png
    # sheet this map used to build from is superseded ART, not just different
    # crops — regenerating from it here would silently swap the whole set
    # back and detach that tuning. It now lives in assets/source/_archive/farm/.

    'cantho': [
        # Bun thit nuong tier chain. The AI painted a FAKE transparency
        # checkerboard into the pixels — chroma:'checker' fits the checker grid
        # and keys it out (see remove_checker_bg), then splits on the resulting
        # alpha.
        #
        # KNOWN DAMAGE, not a bug to chase: the noodle nest's flyaway strands
        # were painted OVER the checker at near-zero contrast, so keying them is
        # ambiguous by construction and they come back as soft fuzz (the caveat
        # under "Fake transparency" in CLAUDE.md). Every sprite is solid inside
        # — measured 0% interior holes — so the loss is edge-only. The fix is a
        # regenerated sheet with TRUE alpha, at which point this entry becomes
        # chroma:'alpha' and min_component_frac can go.
        {
            'file':   'sprite_sheet.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'checker',
            'min_component_frac': 0.05,   # clears the feathered slivers the
                                          # checker key leaves in the two
                                          # sub-tile-width gutters
            'names':  [
                'cantho/peanuts',  'cantho/herbs',         'cantho/pickles',
                'cantho/noodles',  'cantho/springroll',    'cantho/grilled-pork',
                'cantho/bowl',     'cantho/bowl-special',  'cantho/tray',
            ],
        },
    ],

    'pizza': [
        # Napoli tier chain. Ask for TRUE alpha (the food template in
        # assets/ART-PROMPTS.md, filled in at assets/source/pizza/PROMPT.md) --
        # if the sheet comes back with a painted checkerboard instead, switch
        # 'chroma' to 'checker' and add min_component_frac like 'cantho' does.
        #
        # Row-major order IS tier order and must match PIZZA_ITEMS in
        # config/items.js. Every subject is a disc, ring or ball because this
        # map sets spin: true.
        {
            'file':   'sprite_sheet.png',
            'type':   'spritesheet',
            'grid':   (3, 3),
            'chroma': 'alpha',
            'names':  [
                'pizza/olive',       'pizza/mozzarella', 'pizza/tomato',
                'pizza/pepper-ring', 'pizza/onion-ring', 'pizza/pepperoni',
                'pizza/bianca',      'pizza/pan-pizza',  'pizza/the-works',
            ],
        },
    ],

    # 'example-map': [
    #     {
    #         'file':      'items.png',
    #         'type':      'spritesheet',
    #         'grid':      (3, 3),
    #         'chroma':    'alpha',   # generate with a transparent background
    #         'names':     ['item-a', 'item-b', ...],
    #     },
    # ],

}


# ===========================================================================
# Global defaults (can be overridden per config entry)
# ===========================================================================

WHITE_THRESH = 235   # channels >= this count as white
FEATHER_PX   = 1.5  # edge softening radius (pixels)
TRIM_PAD     = 6    # padding kept around each cropped item (pixels)
CELL_MARGIN  = 5    # pixels stripped from each spritesheet cell edge
MIN_HOLE_PX  = 300  # minimum enclosed-white region size to treat as a hole
GREEN_MARGIN = 20   # for chroma:'green' — how much G must exceed max(R,B) for
                    # a pixel to count as green-screen background
CHECKER_TOL  = 16   # for chroma:'checker' — max per-channel distance from the
                    # PREDICTED checker colour for a pixel to count as background

SOURCE_ROOT = Path("assets/source")
OUTPUT_DIR  = Path("assets/images")


# ===========================================================================
# Core image processing
# ===========================================================================

def white_mask(data: np.ndarray, thresh: int) -> np.ndarray:
    return (data[:, :, 0] >= thresh) & \
           (data[:, :, 1] >= thresh) & \
           (data[:, :, 2] >= thresh)


def green_bg_mask(data: np.ndarray) -> np.ndarray:
    """Green-screen background: green channel clearly dominant. Also treats the
    magenta separator lines (#FF00FF) as background so their remnants at cell
    edges are removed along with the green."""
    r = data[:, :, 0].astype(np.int16)
    g = data[:, :, 1].astype(np.int16)
    b = data[:, :, 2].astype(np.int16)
    green   = (g - np.maximum(r, b)) >= GREEN_MARGIN
    magenta = (r > 140) & (b > 140) & (g < np.minimum(r, b) - 30)
    return green | magenta


def bg_mask(data: np.ndarray, thresh: int, chroma: str) -> np.ndarray:
    """Dispatch: which pixels are removable background."""
    return green_bg_mask(data) if chroma == 'green' else white_mask(data, thresh)


def _bfs(mask: np.ndarray, seeds: list) -> np.ndarray:
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for y, x in seeds:
        if 0 <= y < h and 0 <= x < w and mask[y, x] and not visited[y, x]:
            visited[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and mask[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    return visited


def flood_fill_background(is_white: np.ndarray) -> np.ndarray:
    h, w = is_white.shape
    seeds = ([(0, x) for x in range(w)] + [(h-1, x) for x in range(w)] +
             [(y, 0) for y in range(h)] + [(y, w-1) for y in range(h)])
    return _bfs(is_white, seeds)


def find_enclosed_holes(is_white: np.ndarray, background: np.ndarray,
                        min_hole_px: int, region: str = None) -> np.ndarray:
    """
    Find white regions fully enclosed within the foreground (e.g. handle holes,
    under-umbrella areas). Only regions >= min_hole_px pixels are returned,
    so small glass highlights are preserved.
    """
    fg_white = is_white & ~background
    h, w = fg_white.shape

    # Optionally restrict hole detection to a sub-region of the image.
    # Pixels outside the region are masked out before BFS so they can't
    # become holes — useful when one side has ambiguous enclosed whites
    # (e.g. beer foam) that should be left untouched.
    if region == 'right':
        mask = np.zeros_like(fg_white); mask[:, w//2:] = True
        fg_white = fg_white & mask
    elif region == 'left':
        mask = np.zeros_like(fg_white); mask[:, :w//2] = True
        fg_white = fg_white & mask
    elif region == 'bottom':
        mask = np.zeros_like(fg_white); mask[h//2:, :] = True
        fg_white = fg_white & mask
    elif region == 'top':
        mask = np.zeros_like(fg_white); mask[:h//2, :] = True
        fg_white = fg_white & mask

    seeds = ([(0, x) for x in range(w)] + [(h-1, x) for x in range(w)] +
             [(y, 0) for y in range(h)] + [(y, w-1) for y in range(h)])
    reachable = _bfs(fg_white, seeds)
    enclosed  = fg_white & ~reachable

    if min_hole_px <= 1:
        return enclosed

    # Keep only connected components >= min_hole_px pixels
    result  = np.zeros_like(enclosed)
    visited = np.zeros_like(enclosed)
    for sy in range(h):
        for sx in range(w):
            if not enclosed[sy, sx] or visited[sy, sx]:
                continue
            component = []
            q = deque([(sy, sx)])
            visited[sy, sx] = True
            while q:
                y, x = q.popleft()
                component.append((y, x))
                for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
                    ny, nx = y+dy, x+dx
                    if 0<=ny<h and 0<=nx<w and enclosed[ny,nx] and not visited[ny,nx]:
                        visited[ny,nx] = True
                        q.append((ny,nx))
            if len(component) >= min_hole_px:
                for py, px in component:
                    result[py, px] = True
    return result


def remove_green_screen(img: Image.Image, round_aura: bool = False) -> Image.Image:
    """Key out a green-screen background under glowing subjects.

    The AI renders a soft neutral halo behind each item, so the background's
    'greenness' fades toward zero near the subject — a per-pixel threshold can't
    tell that faint halo from a grey item and leaves a translucent box. Instead
    we flood-fill the connected green field inward from the (strongly green)
    edges: that clears the whole background, including the faint halo, but can't
    cross into the item. Edges are then feathered and de-matted of green spill.
    Magenta separator remnants are removed the same way.

    round_aura: for round items whose bright glow fills the whole square cell
    (orb, potion, portal), flood-fill can't remove that glow so it reads as a
    hard rectangle. Setting this inscribes a circular fade that tapers the glow
    to transparent, turning the square into a natural round aura. The aura is
    purely cosmetic — physics uses each item's separate physR, so a big soft
    glow never affects collisions."""
    img  = img.convert("RGBA")
    data = np.array(img, dtype=np.float32)
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    greenness = g - np.maximum(r, b)

    # Low threshold: catch even faintly-green halo pixels, but stay below any
    # grey item (whose greenness is <= 0), so the flood can't leak inside.
    is_bg   = greenness > 4
    magenta = (r > 140) & (b > 140) & (g < np.minimum(r, b) - 30)
    seed    = (is_bg | magenta).astype(bool)
    bg      = flood_fill_background(seed)

    hard_alpha = np.where(bg, 0.0, 255.0).astype(np.uint8)
    alpha_img  = Image.fromarray(hard_alpha, mode="L")
    if FEATHER_PX > 0:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_PX))

    alpha  = np.array(alpha_img).astype(np.float32)
    a_norm = alpha / 255.0
    safe_a = np.where(a_norm > 0.01, a_norm, 1.0)

    strong  = greenness > 25
    dematte = np.median(data[:, :, :3][strong], axis=0) if strong.any() \
              else np.array([20.0, 110.0, 50.0])

    # De-matte only genuinely green-contaminated edge pixels — blue/cyan glow
    # legitimately has high green and must be left alone.
    edge = (a_norm > 0.01) & (a_norm < 0.99) & (greenness > 0)
    for c in range(3):
        ch = data[:, :, c]
        corrected = np.clip((ch - dematte[c] * (1.0 - a_norm)) / safe_a, 0, 255)
        data[:, :, c] = np.where(edge, corrected, ch)

    # Round items whose glow fills the square cell: inscribe a circular fade so
    # the square glow tapers into a natural round aura.
    if round_aura:
        h, w = alpha.shape
        cy, cx = h / 2.0, w / 2.0
        R = 0.5 * min(h, w)
        yy, xx = np.mgrid[0:h, 0:w]
        dist = np.hypot(xx - cx, yy - cy)
        # full opacity within 0.80R, fading to 0 by ~1.02R (just inside the edge)
        vignette = np.clip(1.0 - (dist - 0.80 * R) / (0.22 * R), 0.0, 1.0)
        alpha = alpha * vignette

    data[:, :, 3] = alpha
    return Image.fromarray(data.astype(np.uint8), mode="RGBA")


def _fit_checker_axis(band_lum: np.ndarray):
    """Fit the checker alternation along one axis from a border band's mean
    luminance profile. Returns (T, phi) with tile boundaries at phi + k*T,
    or None if the profile isn't a regular alternation."""
    lo, hi = float(band_lum.min()), float(band_lum.max())
    if hi - lo < 8:                    # no visible alternation
        return None
    sq    = band_lum > (lo + hi) / 2
    trans = np.where(sq[1:] != sq[:-1])[0] + 1
    if len(trans) < 6:
        return None
    T, phi = np.polyfit(np.arange(len(trans)), trans, 1)
    if not (6 <= T <= 200):
        return None
    resid = np.abs(phi + T * np.arange(len(trans)) - trans)
    if np.median(resid) > 2.0:         # transitions off-lattice: not regular
        return None
    return float(T), float(phi)


def remove_checker_bg(img: Image.Image, tol: int = CHECKER_TOL,
                      fill_holes: bool = False,
                      min_hole_px: int = MIN_HOLE_PX) -> Image.Image:
    """Remove a FAKE transparency checkerboard the AI painted into the pixels.

    A plain 'near white or near grey' threshold would be dangerous here: white
    items (noodles, bowls, daikon) sit in exactly that colour range, and a
    flood fill through such a mask can eat them. Instead we exploit the one
    thing the checker has that items don't — perfect regularity. The tile
    period and phase are fitted per axis from the border bands, giving the
    exact PREDICTED background colour at every pixel; only pixels matching
    their own prediction count as background. A white item pixel over a grey
    tile doesn't match, so the flood fill is fenced in at every tile boundary
    (~one tile of leak at absolute worst). Edges are feathered and de-matted
    against the per-pixel predicted colour, so fringes take the local tile
    shade into account.

    Raises ValueError with a diagnosis when the sheet's checker is too
    irregular to fit — fall back to regenerating the art, or hardcode splits.
    """
    img  = img.convert("RGBA")
    data = np.array(img, dtype=np.float32)
    rgb  = data[:, :, :3]
    h, w = rgb.shape[:2]
    lum  = rgb.mean(axis=2)
    sat  = rgb.max(axis=2) - rgb.min(axis=2)

    # --- border bands (10px strips just inside each edge), keep clean ones ---
    bands = {
        'top':    (slice(3, 13),      slice(None)),
        'bottom': (slice(h-13, h-3),  slice(None)),
        'left':   (slice(None),       slice(3, 13)),
        'right':  (slice(None),       slice(w-13, w-3)),
    }
    def band_ok(sl):                   # checker is neutral; an item touching
        return (sat[sl] <= 12).mean() > 0.97   # the band shows up as saturation
    clean = {n: sl for n, sl in bands.items() if band_ok(sl)}
    if not clean:
        raise ValueError("checker: no clean border band (items touch every "
                         "edge?) — can't sample the checker pattern")

    # --- the two checker shades, from the clean bands ---
    px   = np.concatenate([rgb[sl].reshape(-1, 3) for sl in clean.values()])
    plum = px.mean(axis=1)
    mid  = (plum.min() + plum.max()) / 2
    shade_dark  = np.median(px[plum <= mid], axis=0)
    shade_light = np.median(px[plum >  mid], axis=0)

    # --- tile period + phase per axis ---
    fit_x = fit_y = None
    for n in ('top', 'bottom'):
        if n in clean and fit_x is None:
            fit_x = _fit_checker_axis(lum[clean[n]].mean(axis=0))
    for n in ('left', 'right'):
        if n in clean and fit_y is None:
            fit_y = _fit_checker_axis(lum[clean[n]].mean(axis=1))
    if not (fit_x and fit_y):
        raise ValueError("checker: border bands don't alternate regularly — "
                         "the painted checker is too irregular to fit")
    Tx, phix = fit_x
    Ty, phiy = fit_y

    # --- predicted background colour per pixel ---
    xs, ys = np.arange(w), np.arange(h)
    parity = ((np.floor((xs - phix) / Tx).astype(int)[None, :] +
               np.floor((ys - phiy) / Ty).astype(int)[:, None]) & 1)
    # which parity is the light one? try both, keep the better fit
    exp0 = np.where(parity[:, :, None] == 0, shade_dark, shade_light)
    exp1 = np.where(parity[:, :, None] == 0, shade_light, shade_dark)
    band_mask = np.zeros((h, w), bool)
    for sl in clean.values():
        band_mask[sl] = True
    d0 = np.abs(rgb - exp0).max(axis=2)
    d1 = np.abs(rgb - exp1).max(axis=2)
    if (d0[band_mask] <= tol).mean() >= (d1[band_mask] <= tol).mean():
        expected, dist = exp0, d0
    else:
        expected, dist = exp1, d1
    frac = (dist[band_mask] <= tol).mean()
    if frac < 0.9:
        raise ValueError(f"checker: prediction only matches {frac:.0%} of the "
                         "border — pattern drifts; regenerate with a real "
                         "transparent background")

    # --- background mask: match the prediction; at tile seams the pixels are
    #     a blend of the two shades, so allow any neutral in-between there ---
    off_x = (xs - phix) % Tx
    off_y = (ys - phiy) % Ty
    near_seam = ((np.minimum(off_x, Tx - off_x)[None, :] <= 1.5) |
                 (np.minimum(off_y, Ty - off_y)[:, None] <= 1.5))
    blend_ok = ((sat <= 12) &
                (lum >= shade_dark.mean()  - tol) &
                (lum <= shade_light.mean() + tol))
    is_bg = (dist <= tol) | (near_seam & blend_ok)

    # --- structural guard: an item's own whites/greys can match the
    #     prediction wherever they land on the right parity, letting the flood
    #     percolate into e.g. white noodles. True background shows the checker
    #     TEXTURE: whole tiles matching at ~100%. Only allow removal within
    #     one tile of such a fully-matching tile — bounds any leak into an
    #     item to a single tile past its true edge. ---
    strict = dist <= tol
    tx = np.floor((xs - phix) / Tx).astype(int); tx -= tx.min()
    ty2 = np.floor((ys - phiy) / Ty).astype(int); ty2 -= ty2.min()
    ntx, nty = tx.max() + 1, ty2.max() + 1
    tid    = (ty2[:, None] * ntx + tx[None, :]).ravel()
    match  = np.bincount(tid, weights=strict.ravel(), minlength=ntx * nty)
    total  = np.bincount(tid, minlength=ntx * nty).clip(min=1)
    tile_bg = (match / total).reshape(nty, ntx) >= 0.85
    grown = np.zeros_like(tile_bg)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            grown |= np.roll(np.roll(tile_bg, dy, axis=0), dx, axis=1)
    is_bg &= grown[np.ix_(ty2, tx)]

    bg    = flood_fill_background(is_bg)
    holes = find_enclosed_holes(is_bg, bg, min_hole_px) if fill_holes \
            else np.zeros_like(bg)
    removed = bg | holes

    # --- residue shave: the guard can strand checker slivers where a gutter
    #     is narrower than a tile (no fully-matching tile nearby to authorize
    #     them). Those slivers hug the item edges, so component tests can't
    #     isolate them — but distance can: real item detail (noodle strands,
    #     bowl rims) always has NON-matching pixels within a few px (shading,
    #     anti-aliased edges), while the middle of a checker sliver is
    #     matching pixels through and through. Protect a small halo around
    #     every non-matching kept pixel, then flood from the already-removed
    #     background through unprotected matching pixels only. An item's
    #     interior false-matches stay safe twice over: they're inside the
    #     halo, and the flood can't cross the (protected) item edge. ---
    kept = ~removed
    protected = kept & ~strict
    for _ in range(2):                       # dilate 2px (chebyshev)
        p = protected.copy()
        p[1:, :] |= protected[:-1, :]; p[:-1, :] |= protected[1:, :]
        p[:, 1:] |= protected[:, :-1]; p[:, :-1] |= protected[:, 1:]
        protected = p
    shaveable = kept & strict & ~protected
    if shaveable.any():
        near_removed = np.zeros_like(removed)
        near_removed[1:, :] |= removed[:-1, :]; near_removed[:-1, :] |= removed[1:, :]
        near_removed[:, 1:] |= removed[:, :-1]; near_removed[:, :-1] |= removed[:, 1:]
        seeds = [tuple(p) for p in np.argwhere(shaveable & near_removed)]
        removed |= _bfs(shaveable, seeds)

    # --- alpha + feather + de-matte against the per-pixel predicted colour ---
    hard_alpha = np.where(removed, 0.0, 255.0).astype(np.uint8)
    alpha_img  = Image.fromarray(hard_alpha, mode="L")
    if FEATHER_PX > 0:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_PX))

    alpha  = np.array(alpha_img).astype(np.float32)
    a_norm = alpha / 255.0
    safe_a = np.where(a_norm > 0.01, a_norm, 1.0)
    edge   = (a_norm > 0.01) & (a_norm < 0.99)

    for c in range(3):
        ch = data[:, :, c]
        corrected = np.clip((ch - expected[:, :, c] * (1.0 - a_norm)) / safe_a,
                            0, 255)
        data[:, :, c] = np.where(edge, corrected, ch)

    data[:, :, 3] = alpha
    return Image.fromarray(data.astype(np.uint8), mode="RGBA")


def remove_white_bg(img: Image.Image, thresh: int = WHITE_THRESH,
                    fill_holes: bool = False,
                    min_hole_px: int = MIN_HOLE_PX,
                    fill_holes_region: str = None,
                    chroma: str = 'white',
                    round_aura: bool = False) -> Image.Image:
    if chroma == 'green':
        return remove_green_screen(img, round_aura=round_aura)
    if chroma == 'checker':
        return remove_checker_bg(img, fill_holes=fill_holes,
                                 min_hole_px=min_hole_px)
    img  = img.convert("RGBA")
    data = np.array(img, dtype=np.float32)
    iw   = bg_mask(data.astype(np.uint8), thresh, chroma)
    bg   = flood_fill_background(iw)

    holes = find_enclosed_holes(iw, bg, min_hole_px, fill_holes_region) \
            if fill_holes else np.zeros_like(bg)

    removed = bg | holes

    # De-matte colour: white keys against pure white; a chroma key uses the
    # actual median colour of the removed background so coloured fringes
    # (e.g. green spill) are subtracted instead of white.
    if chroma == 'white' or not removed.any():
        dematte = np.array([255.0, 255.0, 255.0])
    else:
        dematte = np.median(data[:, :, :3][removed], axis=0)

    hard_alpha = np.where(removed, 0.0, 255.0).astype(np.uint8)
    alpha_img  = Image.fromarray(hard_alpha, mode="L")
    if FEATHER_PX > 0:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_PX))

    alpha  = np.array(alpha_img).astype(np.float32)
    a_norm = alpha / 255.0
    safe_a = np.where(a_norm > 0.01, a_norm, 1.0)
    edge   = (a_norm > 0.01) & (a_norm < 0.99)

    for c in range(3):
        ch = data[:, :, c]
        corrected = np.clip((ch - dematte[c] * (1.0 - a_norm)) / safe_a, 0, 255)
        data[:, :, c] = np.where(edge, corrected, ch)

    data[:, :, 3] = alpha
    return Image.fromarray(data.astype(np.uint8), mode="RGBA")


def content_bbox(img: Image.Image, thresh: int = WHITE_THRESH, chroma: str = 'white'):
    data      = np.array(img.convert("RGB"))
    non_white = ~bg_mask(data, thresh, chroma)
    rows = np.any(non_white, axis=1)
    cols = np.any(non_white, axis=0)
    if not rows.any():
        return None
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]
    h, w = data.shape[:2]
    return (max(0, int(cmin)-TRIM_PAD), max(0, int(rmin)-TRIM_PAD),
            min(w, int(cmax)+TRIM_PAD+1), min(h, int(rmax)+TRIM_PAD+1))


# ===========================================================================
# Spritesheet splitting
# ===========================================================================

def find_separator_splits(data: np.ndarray, sep_rgb: list,
                          axis: int, tol: int = 30,
                          threshold: float = 0.05) -> list[int]:
    """
    Find split positions where rows/cols are dominated by the separator color.
    axis=0 → find column splits, axis=1 → find row splits.
    Returns list of pixel positions (one per gap between items).
    tol: per-channel colour tolerance (default 30).
    threshold: fraction of separator pixels in a strip to count as a separator (default 0.05).
    """
    r, g, b = sep_rgb
    is_sep = ((np.abs(data[:,:,0].astype(int) - r) < tol) &
              (np.abs(data[:,:,1].astype(int) - g) < tol) &
              (np.abs(data[:,:,2].astype(int) - b) < tol))
    # fraction of separator pixels along each row/col
    profile = is_sep.mean(axis=axis)   # axis=0 → per-column, axis=1 → per-row
    in_sep = profile > threshold
    splits = []
    in_band = False
    band_start = 0
    for i, v in enumerate(in_sep):
        if v and not in_band:
            in_band = True; band_start = i
        elif not v and in_band:
            splits.append((band_start + i) // 2)
            in_band = False
    # Merge splits that are within 8px of each other (handles 1-px gaps in separator lines)
    merged = []
    for s in splits:
        if merged and s - merged[-1] < 8:
            merged[-1] = (merged[-1] + s) // 2
        else:
            merged.append(s)
    return merged


def find_whitespace_splits(data: np.ndarray, n_parts: int,
                           axis: int) -> list[int]:
    non_white = (255.0 - data[:,:,:3].astype(float)).clip(0).max(axis=2)
    profile   = non_white.sum(axis=axis)
    length    = len(profile)
    search_r  = length // (n_parts * 2)
    splits    = []
    for i in range(1, n_parts):
        centre = length * i // n_parts
        lo, hi = max(0, centre-search_r), min(length, centre+search_r)
        splits.append(lo + int(np.argmin(profile[lo:hi])))
    return splits


def _alpha_bands(mask: np.ndarray, axis: int,
                 merge_gap: int = 14, min_size: int = 20,
                 min_px: int = 4) -> list:
    """Content bands along an axis of a boolean alpha mask. A line only counts
    as content if it has more than min_px solid pixels — generators sometimes
    leave faint 1px alpha streaks running across the whole sheet, which would
    otherwise bridge every gutter. Bands separated by less than merge_gap px
    are merged (stray glow specks); bands narrower than min_size are dropped."""
    prof = mask.sum(axis=axis) > min_px
    bands, inb, s = [], False, 0
    for i, v in enumerate(prof):
        if v and not inb: inb, s = True, i
        elif not v and inb: bands.append([s, i]); inb = False
    if inb: bands.append([s, len(prof)])
    merged = []
    for b in bands:
        if merged and b[0] - merged[-1][1] < merge_gap: merged[-1][1] = b[1]
        else: merged.append(b)
    return [b for b in merged if b[1] - b[0] >= min_size]


def out_path(name: str) -> Path:
    """Output file for an item name, creating its map folder if needed.
    Names carry their folder ('shared/coin'), mirroring the map-based layout
    of assets/images/; master-only outputs escape it ('../source/chrome/…')."""
    p = OUTPUT_DIR / f"{name}.png"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def split_alpha_grid(img: Image.Image, rows: int, cols: int) -> list:
    """Split a sheet with a REAL transparent background: cells are found from
    the fully-transparent gutters between items — no separator lines, no
    keying, and tolerant of the grid drifting off even spacing. Returns
    rows*cols cells in reading order (None where a cell is empty)."""
    img  = img.convert("RGBA")
    data = np.array(img)
    mask = data[:, :, 3] > 32          # solid content only; faint streaks ignored
    col_bands = _alpha_bands(mask, axis=0)
    row_bands = _alpha_bands(mask, axis=1)
    # A genuine gutter narrower than merge_gap gets merged away on tight
    # sheets — retry with minimal merging before giving up.
    if len(col_bands) != cols:
        retry = _alpha_bands(mask, axis=0, merge_gap=4)
        if len(retry) == cols: col_bands = retry
    if len(row_bands) != rows:
        retry = _alpha_bands(mask, axis=1, merge_gap=4)
        if len(retry) == rows: row_bands = retry
    assert len(col_bands) == cols and len(row_bands) == rows, (
        f"expected {cols}x{rows} content bands, found {len(col_bands)}x{len(row_bands)} "
        f"(cols {col_bands}, rows {row_bands}) -> glow may be bridging a gutter")
    # pad bands so soft glow (below the solid threshold) is kept with its item —
    # but never further than halfway into the gap to the neighbouring band,
    # or a tight gutter would hand a cell a big slab of its neighbour
    GLOW_PAD = 24
    def pad_lo(bands, i, lo_edge):
        gap = bands[i][0] - (bands[i-1][1] if i > 0 else lo_edge)
        return min(GLOW_PAD, max(0, gap // 2)) if i > 0 else GLOW_PAD
    def pad_hi(bands, i, hi_edge):
        gap = (bands[i+1][0] if i+1 < len(bands) else hi_edge) - bands[i][1]
        return min(GLOW_PAD, max(0, gap // 2)) if i+1 < len(bands) else GLOW_PAD
    cells = []
    for ri, (y0, y1) in enumerate(row_bands):
        for ci, (x0, x1) in enumerate(col_bands):
            cell = img.crop((max(0, x0 - pad_lo(col_bands, ci, 0)),
                             max(0, y0 - pad_lo(row_bands, ri, 0)),
                             min(img.width,  x1 + pad_hi(col_bands, ci, img.width)),
                             min(img.height, y1 + pad_hi(row_bands, ri, img.height))))
            ca = np.array(cell)[:, :, 3] > 32
            if ca.sum() < 30: cells.append(None); continue
            ys, xs = np.where(ca)
            p = TRIM_PAD
            cells.append(cell.crop((max(0, xs.min()-p), max(0, ys.min()-p),
                                    min(cell.width, xs.max()+p+1), min(cell.height, ys.max()+p+1))))
    return cells


def split_grid(img: Image.Image, rows: int, cols: int,
               separator: list = None,
               sep_tol: int = 30,
               sep_threshold: float = 0.05,
               row_splits: list = None,
               col_splits: list = None,
               chroma: str = 'white',
               cell_margin: int = CELL_MARGIN) -> list[Image.Image]:
    data = np.array(img.convert("RGBA"))

    if separator:
        xs = find_separator_splits(data, separator, axis=0, tol=sep_tol, threshold=sep_threshold)
        ys = find_separator_splits(data, separator, axis=1, tol=sep_tol, threshold=sep_threshold)
    else:
        xs = col_splits or find_whitespace_splits(data, cols, axis=0)
        ys = row_splits or find_whitespace_splits(data, rows, axis=1)

    x_splits = [0] + xs + [img.width]
    y_splits = [0] + ys + [img.height]

    cells = []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = x_splits[c], y_splits[r]
            x1, y1 = x_splits[c+1], y_splits[r+1]
            m    = cell_margin
            cell = img.crop((x0+m, y0+m, x1-m, y1-m))
            bbox = content_bbox(cell, chroma=chroma)
            cells.append(cell.crop(bbox) if bbox else cell)
    return cells


def split_pair(img: Image.Image, thresh: int = WHITE_THRESH):
    data     = np.array(img.convert("RGBA"))
    xs       = find_whitespace_splits(data, 2, axis=0)
    mid      = xs[0]
    left     = img.crop((0, 0, mid, img.height))
    right    = img.crop((mid, 0, img.width, img.height))
    bl, br   = content_bbox(left, thresh), content_bbox(right, thresh)
    return (left.crop(bl) if bl else left), (right.crop(br) if br else right)


# ===========================================================================
# Handlers per type
# ===========================================================================

def drop_specks(cell: Image.Image, min_frac: float) -> Image.Image:
    """Erase disconnected alpha blobs smaller than min_frac of the item's total
    alpha area — clears stray fragments a grid cell grabbed from a neighbour.
    A legitimately separate part (e.g. a violin's bow) survives if it's big
    enough, so keep min_frac well below any real part (~0.05 works for melody)."""
    from collections import deque
    data = np.array(cell.convert("RGBA"))
    mask = data[:, :, 3] > 32
    total = int(mask.sum())
    if total == 0:
        return cell
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    keep = np.zeros((h, w), bool)
    thresh = total * min_frac
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = True; comp = [(y, x)]
                while q:
                    cy, cx = q.popleft()
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx)); comp.append((ny, nx))
                if len(comp) >= thresh:
                    for cy, cx in comp:
                        keep[cy, cx] = True
    data[:, :, 3] = np.where(keep, data[:, :, 3], 0)
    # re-crop to the surviving content so the sprite anchor stays centred
    ys, xs = np.where(data[:, :, 3] > 0)
    if len(xs):
        data = data[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(data, "RGBA")


def handle_spritesheet(src: Path, cfg: dict):
    rows, cols = cfg['grid']
    names      = cfg['names']
    assert len(names) == rows * cols, \
        f"{src.name}: expected {rows*cols} names, got {len(names)}"
    chroma     = cfg.get('chroma', 'white')

    # Real transparent background: split on alpha gutters, no keying at all.
    # 'checker' (a FAKE transparency checkerboard painted into the pixels) is
    # keyed out first — remove_checker_bg turns it into real alpha — and then
    # takes exactly the same gutter-splitting path.
    # Use None in 'names' to skip a cell (duplicates / empties in the sheet).
    if chroma in ('alpha', 'checker'):
        sheet = Image.open(src)
        if chroma == 'checker':
            sheet = remove_checker_bg(sheet,
                                      tol=cfg.get('checker_tol', CHECKER_TOL),
                                      fill_holes=cfg.get('fill_holes', False),
                                      min_hole_px=cfg.get('min_hole_px', MIN_HOLE_PX))
        speck = cfg.get('min_component_frac')   # drop stray fragments from neighbours
        for cell, name in zip(split_alpha_grid(sheet, rows, cols), names):
            if name is None:
                continue
            assert cell is not None, f"{src.name}: cell for '{name}' is empty"
            if speck:
                cell = drop_specks(cell, speck)
            cell.save(out_path(name), "PNG")
            print(f"    {name}.png")
        return

    cells      = split_grid(Image.open(src), rows, cols,
                            separator=cfg.get('separator'),
                            sep_tol=cfg.get('sep_tol', 30),
                            sep_threshold=cfg.get('sep_threshold', 0.05),
                            row_splits=cfg.get('row_splits'),
                            col_splits=cfg.get('col_splits'),
                            chroma=chroma,
                            cell_margin=cfg.get('cell_margin', CELL_MARGIN))
    thresh     = cfg.get('white_thresh', WHITE_THRESH)
    fill_holes = cfg.get('fill_holes', False)
    min_hole   = cfg.get('min_hole_px', MIN_HOLE_PX)
    round_set  = set(cfg.get('round_aura', []))   # item names to give a round aura
    for cell, name in zip(cells, names):
        remove_white_bg(cell, thresh, fill_holes, min_hole, chroma=chroma,
                        round_aura=(name in round_set)).save(
            out_path(name), "PNG")
        print(f"    {name}.png")


def handle_pair(src: Path, cfg: dict):
    thresh     = cfg.get('white_thresh', WHITE_THRESH)
    left, right = split_pair(Image.open(src), thresh)
    for part, name in zip((left, right), cfg['names']):
        remove_white_bg(part, thresh).save(out_path(name), "PNG")
        print(f"    {name}.png")


def handle_single(src: Path, cfg: dict):
    thresh = cfg.get('white_thresh', WHITE_THRESH)
    remove_white_bg(Image.open(src), thresh,
                    cfg.get('fill_holes', False),
                    cfg.get('min_hole_px', MIN_HOLE_PX),
                    cfg.get('fill_holes_region'),
                    chroma=cfg.get('chroma', 'white')).save(
        out_path(cfg['name']), "PNG")
    print(f"    {cfg['name']}.png")


HANDLERS = {
    'spritesheet': handle_spritesheet,
    'pair':        handle_pair,
    'single':      handle_single,
}


# ===========================================================================
# Entry point
# ===========================================================================

def process_map(map_name: str):
    if map_name not in PIPELINE:
        print(f"  [skip] '{map_name}' not in PIPELINE config")
        return
    src_dir = SOURCE_ROOT / map_name
    if not src_dir.is_dir():
        print(f"  [skip] {src_dir} does not exist")
        return
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n[{map_name}]")
    for cfg in PIPELINE[map_name]:
        src = src_dir / cfg['file']
        if not src.exists():
            print(f"  MISSING: {src}"); continue
        print(f"  {cfg['file']}")
        HANDLERS[cfg['type']](src, cfg)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--map", help="Process only this map (e.g. tikibar, shared)")
    args = parser.parse_args()
    for m in ([args.map] if args.map else list(PIPELINE.keys())):
        process_map(m)
    print("\nDone.")


if __name__ == "__main__":
    main()
