"""
split_sprites.py — Split a 3x3 sprite sheet into 9 individual PNGs.

Requirements:
    pip install Pillow numpy

Usage:
    python split_sprites.py <spritesheet.png> <output_folder> [name1 name2 ... name9]

Example:
    python split_sprites.py drinks.png assets/images espresso mojito daiquiri hawaiian mango berry tiki beer pitcher

Notes:
    - The sprite sheet must have a transparent background (alpha channel).
    - Sprites are detected by finding fully-transparent gap rows/columns between them.
    - Each sprite is tight-cropped to its non-transparent bounding box.
    - If no names are provided, sprites are saved as sprite-0.png through sprite-8.png.
    - Reading order: left-to-right, top-to-bottom.
"""

import sys
import os
import numpy as np
from PIL import Image


def find_gap_bands(empty_indices):
    """Find contiguous bands of empty (fully transparent) rows or columns."""
    if len(empty_indices) == 0:
        return []
    gaps = []
    start = prev = empty_indices[0]
    for v in empty_indices[1:]:
        if v > prev + 1:
            gaps.append((start, prev))
            start = v
        prev = v
    gaps.append((start, prev))
    return gaps


def find_content_bands(gap_bands, total_size):
    """Derive content bands from gap bands."""
    edges = [0] + [g[1] + 1 for g in gap_bands] + [total_size]
    bands = []
    for i in range(len(edges) - 1):
        start, end = edges[i], edges[i + 1]
        # Skip bands that are themselves gaps
        is_gap = any(g[0] <= start <= g[1] for g in gap_bands)
        if not is_gap and end > start:
            bands.append((start, end))
    return bands


def split_sprites(sheet_path, output_folder, names=None):
    img = Image.open(sheet_path).convert('RGBA')
    arr = np.array(img)
    H, W = arr.shape[:2]

    # Find fully transparent rows and columns
    row_content = (arr[:, :, 3] > 10).sum(axis=1)
    col_content = (arr[:, :, 3] > 10).sum(axis=0)
    empty_rows = np.where(row_content == 0)[0]
    empty_cols = np.where(col_content == 0)[0]

    row_gaps = find_gap_bands(empty_rows)
    col_gaps = find_gap_bands(empty_cols)

    row_bands = find_content_bands(row_gaps, H)
    col_bands = find_content_bands(col_gaps, W)

    print(f"Detected grid: {len(row_bands)} rows x {len(col_bands)} cols "
          f"= {len(row_bands) * len(col_bands)} sprites")

    os.makedirs(output_folder, exist_ok=True)

    idx = 0
    for r, (r0, r1) in enumerate(row_bands):
        for c, (c0, c1) in enumerate(col_bands):
            cell = arr[r0:r1, c0:c1]
            spr = Image.fromarray(cell.astype(np.uint8), 'RGBA')
            bbox = spr.getbbox()
            if bbox:
                spr = spr.crop(bbox)

            if names and idx < len(names):
                filename = f"{names[idx]}.png"
            else:
                filename = f"sprite-{idx}.png"

            out_path = os.path.join(output_folder, filename)
            spr.save(out_path, optimize=True)
            print(f"  [{r},{c}] {filename}: {spr.size}")
            idx += 1

    print(f"\nSaved {idx} sprites to '{output_folder}/'")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    sheet_path = sys.argv[1]
    output_folder = sys.argv[2]
    names = sys.argv[3:] if len(sys.argv) > 3 else None

    split_sprites(sheet_path, output_folder, names)
