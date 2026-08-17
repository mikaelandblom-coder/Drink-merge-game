# Archived source art

Superseded / unused raw AI-generated images, kept for reference (nothing in the
build uses these). Subfolders mirror the original `assets/source/<map>/` layout.

- `kyoto/background.png` — first Kyoto background attempt; replaced by `kyoto/background 2.png`.
- `tikibar/tiki_bar_drinks.png` — original combined drinks spritesheet; replaced by the individual `tikibar/drink-*.png` files.
- `mage/merge items.png` — v1 mage sheet (green screen, uneven grid); replaced by
  `mage/merge items v2.png` with real transparent background.
- `pizza/bg-oven-low.png`, `pizza/bg-oven-steep.png` — Napoli's first background
  pass, a wood-fired oven interior at ~45–55° off vertical. Rejected because the
  item art is drawn straight down and the two angles cannot agree (flat discs
  read as propped-up plates), and because an oven interior is dark by definition
  while this chain's tier 0 is a near-black olive. Replaced by the marble prep
  counter in `pizza/bg_large.png` + `bg_small.png`. See §6.3 of
  `assets/source/pizza/DESIGN.md` — the camera angle is fixed by the engine, not
  a taste call.
- `farm/items 1.png`, `farm/items 2.png`, `farm/items_combined.png` — v1 farm
  art (combined = sheet 1 with sheet 2's cabbage swapped in); replaced by the
  set extracted from `farm/items 3.png` in the sprite editor. The shipped
  `assets/images/farm/` sprites come from the EDITOR, not process_assets.py —
  see the farm note in process_assets.py's PIPELINE before re-adding an entry.
