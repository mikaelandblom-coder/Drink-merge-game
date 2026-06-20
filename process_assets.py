"""
Asset pipeline: AI-generated images → game-ready transparent PNGs.

Usage:
    python process_assets.py                   # process everything
    python process_assets.py --map tikibar     # one map only
    python process_assets.py --map shared      # shared assets only

Drop AI output (white background) into assets/source/<map>/ and add an
entry to PIPELINE below. Run the script. Done.

--- Spritesheet tip ---
Ask the AI to place a solid bright-magenta (#FF00FF) line between items.
Set 'separator': [255, 0, 255] in the spritesheet config and the script will
split exactly on that color — no guessing, no debris, no missing content.
"""

import argparse
import shutil
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
#   copy         — no processing, just copy.
#                  'name': output filename (without extension)

PIPELINE = {

    'shared': [
        {
            'file':         'coins_and_bag.png',
            'type':         'pair',
            'names':        ['coin', 'moneybag'],
            'white_thresh': 245,   # gold edges are close to white; be strict
        },
    ],

    'tikibar': [
        {'file': 'drink-espresso-shot.png',      'type': 'single', 'name': 'drink-espresso-shot'},
        {'file': 'drink-mojito.png',              'type': 'single', 'name': 'drink-mojito'},
        {'file': 'drink-strawberry-daiquiri.png', 'type': 'single', 'name': 'drink-strawberry-daiquiri'},
        {'file': 'drink-blue-hawaiian.png',       'type': 'single', 'name': 'drink-blue-hawaiian'},
        {'file': 'drink-mango-smoothie.png',      'type': 'single', 'name': 'drink-mango-smoothie'},
        {'file': 'drink-berry-shake.png',         'type': 'single', 'name': 'drink-berry-shake'},
        {'file': 'drink-tiki-mug-cocktail.png',   'type': 'single', 'name': 'drink-tiki-mug-cocktail'},
        {'file': 'drink-beer.png',                'type': 'single', 'name': 'drink-beer',
         'fill_holes': True, 'fill_holes_region': 'right'},
        {'file': 'drink-fruit-punch-pitcher.png', 'type': 'single', 'name': 'drink-fruit-punch-pitcher',
         'fill_holes': True, 'min_hole_px': 300},
        {'file': 'tiki_bar_background.png',       'type': 'copy',   'name': 'bg-tikibar'},
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
                'pho-star-anise', 'pho-lime', 'pho-chili',
                'pho-thai-basil', 'pho-bean-sprouts', 'pho-hoisin',
                'pho-bowl-small', 'pho-bowl-large', 'pho-pot',
            ],
        },
        {'file': 'bg-saigon.png', 'type': 'copy', 'name': 'bg-saigon'},
    ],

    'kyoto': [
        {
            'file':      'sprite collecction.png',
            'type':      'spritesheet',
            'grid':      (3, 3),
            'col_splits': [417, 835],
            'row_splits': [418, 835],
            'names':     [
                'kyoto-ramune', 'kyoto-mochi', 'kyoto-dango',
                'kyoto-taiyaki', 'kyoto-softserve', 'kyoto-takoyaki',
                'kyoto-parfait', 'kyoto-unaju', 'kyoto-matcha-cake',
            ],
        },
        {'file': 'background 2.png', 'type': 'copy', 'name': 'bg-kyoto'},
    ],

    # 'teddybears': [
    #     {
    #         'file':      'teddy_drinks.png',
    #         'type':      'spritesheet',
    #         'grid':      (3, 3),
    #         'separator': [255, 0, 0],   # ask AI for red dividing lines
    #         'names':     ['teddy-tea', 'teddy-cocoa', ...],
    #     },
    #     {'file': 'teddy_background.png', 'type': 'copy', 'name': 'bg-teddybears'},
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

SOURCE_ROOT = Path("assets/source")
OUTPUT_DIR  = Path("assets/images")


# ===========================================================================
# Core image processing
# ===========================================================================

def white_mask(data: np.ndarray, thresh: int) -> np.ndarray:
    return (data[:, :, 0] >= thresh) & \
           (data[:, :, 1] >= thresh) & \
           (data[:, :, 2] >= thresh)


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


def remove_white_bg(img: Image.Image, thresh: int = WHITE_THRESH,
                    fill_holes: bool = False,
                    min_hole_px: int = MIN_HOLE_PX,
                    fill_holes_region: str = None) -> Image.Image:
    img  = img.convert("RGBA")
    data = np.array(img, dtype=np.float32)
    iw   = white_mask(data.astype(np.uint8), thresh)
    bg   = flood_fill_background(iw)

    holes = find_enclosed_holes(iw, bg, min_hole_px, fill_holes_region) \
            if fill_holes else np.zeros_like(bg)

    hard_alpha = np.where(bg | holes, 0.0, 255.0).astype(np.uint8)
    alpha_img  = Image.fromarray(hard_alpha, mode="L")
    if FEATHER_PX > 0:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=FEATHER_PX))

    alpha  = np.array(alpha_img).astype(np.float32)
    a_norm = alpha / 255.0
    safe_a = np.where(a_norm > 0.01, a_norm, 1.0)
    edge   = (a_norm > 0.01) & (a_norm < 0.99)

    for c in range(3):
        ch = data[:, :, c]
        corrected = np.clip((ch - 255.0 * (1.0 - a_norm)) / safe_a, 0, 255)
        data[:, :, c] = np.where(edge, corrected, ch)

    data[:, :, 3] = alpha
    return Image.fromarray(data.astype(np.uint8), mode="RGBA")


def content_bbox(img: Image.Image, thresh: int = WHITE_THRESH):
    data      = np.array(img.convert("RGB"))
    non_white = ~white_mask(data, thresh)
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


def split_grid(img: Image.Image, rows: int, cols: int,
               separator: list = None,
               sep_tol: int = 30,
               sep_threshold: float = 0.05,
               row_splits: list = None,
               col_splits: list = None) -> list[Image.Image]:
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
            m    = CELL_MARGIN
            cell = img.crop((x0+m, y0+m, x1-m, y1-m))
            bbox = content_bbox(cell)
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

def handle_spritesheet(src: Path, cfg: dict):
    rows, cols = cfg['grid']
    names      = cfg['names']
    assert len(names) == rows * cols, \
        f"{src.name}: expected {rows*cols} names, got {len(names)}"
    cells      = split_grid(Image.open(src), rows, cols,
                            separator=cfg.get('separator'),
                            sep_tol=cfg.get('sep_tol', 30),
                            sep_threshold=cfg.get('sep_threshold', 0.05),
                            row_splits=cfg.get('row_splits'),
                            col_splits=cfg.get('col_splits'))
    thresh     = cfg.get('white_thresh', WHITE_THRESH)
    fill_holes = cfg.get('fill_holes', False)
    min_hole   = cfg.get('min_hole_px', MIN_HOLE_PX)
    for cell, name in zip(cells, names):
        remove_white_bg(cell, thresh, fill_holes, min_hole).save(
            OUTPUT_DIR / f"{name}.png", "PNG")
        print(f"    {name}.png")


def handle_pair(src: Path, cfg: dict):
    thresh     = cfg.get('white_thresh', WHITE_THRESH)
    left, right = split_pair(Image.open(src), thresh)
    for part, name in zip((left, right), cfg['names']):
        remove_white_bg(part, thresh).save(OUTPUT_DIR / f"{name}.png", "PNG")
        print(f"    {name}.png")


def handle_copy(src: Path, cfg: dict):
    dst = OUTPUT_DIR / f"{cfg['name']}{src.suffix}"
    shutil.copy2(src, dst)
    print(f"    {dst.name}  (copied)")


def handle_single(src: Path, cfg: dict):
    thresh = cfg.get('white_thresh', WHITE_THRESH)
    remove_white_bg(Image.open(src), thresh,
                    cfg.get('fill_holes', False),
                    cfg.get('min_hole_px', MIN_HOLE_PX),
                    cfg.get('fill_holes_region')).save(
        OUTPUT_DIR / f"{cfg['name']}.png", "PNG")
    print(f"    {cfg['name']}.png")


HANDLERS = {
    'spritesheet': handle_spritesheet,
    'pair':        handle_pair,
    'copy':        handle_copy,
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
