"""Recompress the big PNGs the browser downloads into WebP.

WHY: a single visit used to pull ~27 MB, and the background art was the largest
non-item slice of it -- eleven ~2.5 MB full-screen PNGs plus the menu backdrop.
GitHub Pages' free tier has a 100 GB/month soft bandwidth limit, so at 27 MB a
visit the site only survives ~3,800 visitors. See CLAUDE.md "Bandwidth".

This is deliberately NOT part of process_assets.py. That script's PIPELINE is
about keying item art off a white/transparent background; backgrounds need no
keying at all, only recompression, so mixing them in would mean bending PIPELINE
entries into a shape they don't fit.

Sources stay untouched: assets/source/ remains the raw AI art (see CLAUDE.md),
and the WebP outputs land in assets/images/<map>/ like every other processed
asset. config/maps.js + style.css point at the .webp files.

Usage:
    python compress_backgrounds.py            # write any missing/stale .webp
    python compress_backgrounds.py --force    # re-encode everything
    python compress_backgrounds.py --check    # report only, write nothing
"""
import argparse
from pathlib import Path

from PIL import Image

# (source, output, quality). Quality is split by ROLE, not by taste:
#   82 - full-screen photographic backdrops. They sit UNDER a transparent canvas
#        and are never inspected up close; 82 is where the file stops shrinking
#        meaningfully but no banding shows in the skies/gradients.
#   92 - UI chrome with alpha. xp-bar-frame is consumed by CSS `border-image`
#        with a fixed 132/240 slice, so softened edges would smear the slice
#        seams; the medal is small and sits over bright art. Both are cheap
#        enough at 92 that there is no reason to push them.
BACKDROP_Q = 82
CHROME_Q = 92

TARGETS = [
    # --- per-map play backgrounds (config/maps.js `bg:` / `sizes:`) ---
    ('assets/source/tikibar/tiki_bar_background.png', 'assets/images/hawaii/bg.webp',       BACKDROP_Q),
    ('assets/source/saigon/bg-saigon.png',            'assets/images/saigon/bg.webp',       BACKDROP_Q),
    ('assets/source/kyoto/bg_large.png',              'assets/images/kyoto/bg_large.webp',  BACKDROP_Q),
    ('assets/source/kyoto/bg_small.png',              'assets/images/kyoto/bg_small.webp',  BACKDROP_Q),
    ('assets/source/mage/bg.png',                     'assets/images/mage/bg.webp',         BACKDROP_Q),
    ('assets/source/teddy/bg.png',                    'assets/images/teddy/bg.webp',        BACKDROP_Q),
    ('assets/source/teddy/bg_large.png',              'assets/images/teddy/bg_large.webp',  BACKDROP_Q),
    ('assets/source/melody/bg.png',                   'assets/images/melody/bg.webp',       BACKDROP_Q),
    ('assets/source/paris/bg_large.png',              'assets/images/paris/bg_large.webp',  BACKDROP_Q),
    ('assets/source/paris/bg_small.png',              'assets/images/paris/bg_small.webp',  BACKDROP_Q),
    ('assets/source/farm/bg_large.png',               'assets/images/farm/bg_large.webp',   BACKDROP_Q),
    ('assets/source/cantho/bg_large.png',             'assets/images/cantho/bg_large.webp', BACKDROP_Q),
    # Art that does not exist yet (the framings CLAUDE.md lists as pending) is
    # skipped with a note rather than failing -- drop the PNG in and re-run.
    ('assets/source/melody/bg_large.png',             'assets/images/melody/bg_large.webp', BACKDROP_Q),
    ('assets/source/farm/bg_small.png',               'assets/images/farm/bg_small.webp',   BACKDROP_Q),

    # --- site chrome (style.css url(...)) ---
    ('assets/source/chrome/bg-main-menu.png', 'assets/images/bg-main-menu.webp',  BACKDROP_Q),
    ('assets/source/chrome/xp-bar-frame.png', 'assets/images/xp-bar-frame.webp',  CHROME_Q),
    ('assets/source/chrome/xp-medal.png',     'assets/images/xp-medal.webp',      CHROME_Q),
]


def encode(src: Path, out: Path, quality: int, check: bool):
    """Encode one PNG to WebP. Returns (src_bytes, out_bytes) or None if skipped."""
    im = Image.open(src)
    # Keep alpha only where it actually exists: the backdrops are RGB, and
    # handing WebP a pointless alpha channel just costs bytes.
    has_alpha = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
    im = im.convert('RGBA' if has_alpha else 'RGB')

    if check:
        return (src.stat().st_size, None)

    out.parent.mkdir(parents=True, exist_ok=True)
    # method=6 is the slowest/densest search. This runs by hand, not per frame,
    # so there is no reason to trade size for encode time.
    im.save(out, 'WEBP', quality=quality, method=6)

    src_b, out_b = src.stat().st_size, out.stat().st_size
    # A WebP bigger than the PNG means the source was already well compressed
    # (flat art). Keep the PNG in that case rather than shipping a regression.
    if out_b >= src_b:
        out.unlink()
        print('  SKIP (webp %.0f KB >= png %.0f KB, kept PNG)  %s'
              % (out_b / 1024, src_b / 1024, src))
        return None

    # Dimensions must survive exactly: maps.js stretches the backdrop to the
    # stage with background-size 100% 100%, and border-image slices xp-bar-frame
    # in absolute pixels.
    check_im = Image.open(out)
    assert (check_im.width, check_im.height) == (im.width, im.height), \
        'dimension drift on %s: %s -> %s' % (src, im.size, check_im.size)
    return (src_b, out_b)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', action='store_true', help='re-encode even if the .webp is newer')
    ap.add_argument('--check', action='store_true', help='report only, write nothing')
    args = ap.parse_args()

    total_src = total_out = 0
    wrote = skipped = missing = 0

    for src_s, out_s, q in TARGETS:
        src, out = Path(src_s), Path(out_s)
        if not src.exists():
            print('  missing source (not built yet), skipping: %s' % src_s)
            missing += 1
            continue
        if (not args.force and not args.check and out.exists()
                and out.stat().st_mtime >= src.stat().st_mtime):
            total_src += src.stat().st_size
            total_out += out.stat().st_size
            skipped += 1
            continue

        res = encode(src, out, q, args.check)
        if res is None:
            continue
        src_b, out_b = res
        if args.check:
            print('  would encode %7.0f KB  %s' % (src_b / 1024, src_s))
            total_src += src_b
            continue
        total_src += src_b
        total_out += out_b
        wrote += 1
        print('  %7.0f KB -> %6.0f KB  (-%2.0f%%, q%d)  %s'
              % (src_b / 1024, out_b / 1024, 100 * (1 - out_b / src_b), q, out_s))

    print('')
    if args.check:
        print('CHECK: %d encodable, %d missing sources, %.1f MB of PNG input'
              % (len(TARGETS) - missing, missing, total_src / 1024 / 1024))
        return
    print('Wrote %d, up-to-date %d, missing sources %d' % (wrote, skipped, missing))
    if total_src:
        print('Browser-facing background bytes: %.1f MB PNG -> %.1f MB WebP (-%.0f%%)'
              % (total_src / 1024 / 1024, total_out / 1024 / 1024,
                 100 * (1 - total_out / total_src)))


if __name__ == '__main__':
    main()
