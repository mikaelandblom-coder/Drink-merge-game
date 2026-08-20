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

It has a SECOND job that shares the same masters: cropping each map's menu
card strip (assets/images/<map>/card.webp) out of the band above that map's
horizon. See CARDS below.

Usage:
    python compress_backgrounds.py            # write any missing/stale .webp
    python compress_backgrounds.py --force    # re-encode everything
    python compress_backgrounds.py --check    # report only, write nothing
"""
import argparse
import re
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
    ('assets/source/cantho/bg_small.png',             'assets/images/cantho/bg_small.webp', BACKDROP_Q),
    ('assets/source/cantho/bg_large.png',             'assets/images/cantho/bg_large.webp', BACKDROP_Q),
    # Art that does not exist yet (the framings CLAUDE.md lists as pending) is
    # skipped with a note rather than failing -- drop the PNG in and re-run.
    ('assets/source/melody/bg_large.png',             'assets/images/melody/bg_large.webp', BACKDROP_Q),
    ('assets/source/farm/bg_small.png',               'assets/images/farm/bg_small.webp',   BACKDROP_Q),
    ('assets/source/pizza/bg_large.png',              'assets/images/pizza/bg_large.webp',  BACKDROP_Q),
    ('assets/source/pizza/bg_small.png',              'assets/images/pizza/bg_small.webp',  BACKDROP_Q),

    # --- site chrome (style.css url(...)) ---
    ('assets/source/chrome/bg-main-menu.png', 'assets/images/bg-main-menu.webp',  BACKDROP_Q),
    ('assets/source/chrome/xp-bar-frame.png', 'assets/images/xp-bar-frame.webp',  CHROME_Q),
    ('assets/source/chrome/xp-medal.png',     'assets/images/xp-medal.webp',      CHROME_Q),
]

# --- menu card art (welcome.js `.map-art`) ---------------------------------
# Each map card in the main menu wears a strip of its OWN background art. The
# strip is not new art: it is a crop of the same master the map plays on, taken
# from the band that ends at the map's HORIZON -- i.e. the painted backdrop
# (bar, shopfront, alley), never the empty play surface below it.
#
# The horizon is read out of config/hitboxes.js rather than written down here,
# because it is dragged in tools/hitbox-editor.html and would otherwise drift:
# re-tracing a boundary moves the band the card shows. Re-run this script after
# moving a horizon.
#
# CARD_BAND is in WORLD px against the 620-tall physics stage, which is what the
# horizon is measured in; `#stage-bg` stretches the master over the stage with
# `background-size: 100% 100%`, so world y maps linearly onto image height.
# A map whose horizon is SHALLOWER than the band (Mage, at 67.5) gets the top
# CARD_BAND px instead, dipping a little below its horizon -- better than
# cropping a wide vista down to a keyhole to keep the rule pure.
CARD_BAND = 120        # world px tall, full 420-wide -- a 3.5:1 strip
CARD_W = 840           # output px: 2x the 420 CSS px a card is at most wide
CARD_Q = 76            # ~30 KB each; see CLAUDE.md "Bandwidth" for the budget

# (map id, source master, output). The SOURCE picks which framing a size-variant
# map advertises -- always its `defaultSize`, since that is what Play starts.
# The map id is also the default hitbox key (hitboxKey() with no size), which is
# how the horizon below is looked up.
CARDS = [
    ('hawaii', 'assets/source/tikibar/tiki_bar_background.png', 'assets/images/hawaii/card.webp'),
    ('saigon', 'assets/source/saigon/bg-saigon.png',            'assets/images/saigon/card.webp'),
    ('kyoto',  'assets/source/kyoto/bg_large.png',              'assets/images/kyoto/card.webp'),
    ('mage',   'assets/source/mage/bg.png',                     'assets/images/mage/card.webp'),
    ('teddy',  'assets/source/teddy/bg.png',                    'assets/images/teddy/card.webp'),
    ('melody', 'assets/source/melody/bg.png',                   'assets/images/melody/card.webp'),
    ('paris',  'assets/source/paris/bg_large.png',              'assets/images/paris/card.webp'),
    ('farm',   'assets/source/farm/bg_large.png',               'assets/images/farm/card.webp'),
    ('cantho', 'assets/source/cantho/bg_small.png',             'assets/images/cantho/card.webp'),
    ('pizza',  'assets/source/pizza/bg_small.png',              'assets/images/pizza/card.webp'),
]

HITBOXES = Path('config/hitboxes.js')
STAGE_H = 620          # H in config/constants.js -- the world the horizon is in


def read_horizons():
    """{hitbox key: horizon} straight out of config/hitboxes.js.

    Regex rather than a parser because that file is TOOL-GENERATED (the hitbox
    editor writes it) and so has a fixed shape: one `key: { ... },` block per
    boundary at two-space indent. A key with no horizon simply doesn't appear.
    """
    out = {}
    src = HITBOXES.read_text(encoding='utf-8')
    for m in re.finditer(r"^  ([A-Za-z0-9_]+):\s*\{(.*?)^  \},", src, re.S | re.M):
        h = re.search(r"horizon:\s*([\d.]+)", m.group(2))
        if h:
            out[m.group(1)] = float(h.group(1))
    return out


def make_card(map_id, src: Path, out: Path, horizon: float, check: bool):
    """Crop one map's backdrop band and write it as a small WebP."""
    im = Image.open(src).convert('RGB')
    # Bottom of the band sits ON the horizon; a shallow horizon starts at the
    # top of the frame instead (see CARD_BAND above).
    y0 = max(0.0, horizon - CARD_BAND)
    box = (0, round(y0 / STAGE_H * im.height),
           im.width, round((y0 + CARD_BAND) / STAGE_H * im.height))
    if check:
        return (src.stat().st_size, None)
    band = im.crop(box).resize((CARD_W, round(CARD_W * CARD_BAND / 420)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    band.save(out, 'WEBP', quality=CARD_Q, method=6)
    return (src.stat().st_size, out.stat().st_size)


def build_cards(force: bool, check: bool):
    horizons = read_horizons()
    wrote = skipped = missing = 0
    total = 0
    print('\nMenu card art (crop above each map\'s horizon):')
    for map_id, src_s, out_s in CARDS:
        src, out = Path(src_s), Path(out_s)
        if not src.exists():
            print('  missing source (not built yet), skipping: %s' % src_s)
            missing += 1
            continue
        horizon = horizons.get(map_id)
        if horizon is None:
            # No traced boundary yet -> no horizon -> no way to know where the
            # backdrop ends. Say so; don't guess a band.
            print('  no horizon in %s for "%s", skipping' % (HITBOXES, map_id))
            missing += 1
            continue
        # Stale if the master OR the horizon moved.
        newest_in = max(src.stat().st_mtime, HITBOXES.stat().st_mtime)
        if not force and not check and out.exists() and out.stat().st_mtime >= newest_in:
            total += out.stat().st_size
            skipped += 1
            continue
        _, out_b = make_card(map_id, src, out, horizon, check)
        if check:
            print('  would crop y %.0f..%.0f of %s' % (max(0, horizon - CARD_BAND),
                                                       max(0, horizon - CARD_BAND) + CARD_BAND, src_s))
            continue
        total += out_b
        wrote += 1
        print('  band y %3.0f..%3.0f -> %5.1f KB  %s'
              % (max(0, horizon - CARD_BAND), max(0, horizon - CARD_BAND) + CARD_BAND,
                 out_b / 1024, out_s))
    if not check:
        print('  Wrote %d, up-to-date %d, skipped %d — %.0f KB of card art total'
              % (wrote, skipped, missing, total / 1024))


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
        build_cards(args.force, args.check)
        return
    print('Wrote %d, up-to-date %d, missing sources %d' % (wrote, skipped, missing))
    if total_src:
        print('Browser-facing background bytes: %.1f MB PNG -> %.1f MB WebP (-%.0f%%)'
              % (total_src / 1024 / 1024, total_out / 1024 / 1024,
                 100 * (1 - total_out / total_src)))
    build_cards(args.force, args.check)


if __name__ == '__main__':
    main()
