# Map cards wear the map's own art

> Moved out of CLAUDE.md on 2026-09-23 to keep that file small. CLAUDE.md
> keeps a summary of the rules; this is the full record — the measurements,
> the history and the reasoning. Keep them in step: a new rule goes in the
> CLAUDE.md summary too.


Every card in the menu is topped by a strip of the map it plays — the tiki bar's
sunset, Kyoto's lantern alley, Napoli's oven — with the name, level badge and
Play button sitting on it. **No art was generated for the menu.** The strip is a
crop of the same background master the map plays on, and **one rule places it on
every map alike** — `card_band()` in `compress_backgrounds.py`:

> a full-width band **`CARD_BAND` (120) world-px tall, ending at the map's
> horizon, slid along until it fits inside the frame.**

So a card shows painted backdrop wherever there is enough of it, and the horizon
is where to put the band *when there is room* — there is no per-map case, and
adding a map means adding a row to `CARDS`, nothing else. The script writes
`assets/images/<map>/card.webp` (`CARD_W`, `CARD_Q` size it) and `card:` in
config/maps.js points at it. A map with no `card:` falls back to the plain
header the cards used to have, so this can never block a map from shipping.

- **The horizon is READ OUT of config/hitboxes.js, not written down again.** It
  is dragged in the hitbox editor, so a copy here would silently drift and the
  strip would start including table. That also fixes the ORDER for a new map:
  trace its boundary first, then run `compress_backgrounds.py`. The script
  treats a moved `config/hitboxes.js` as making every card stale, so re-running
  it after a re-trace is all that's needed; a map with no traced horizon yet is
  skipped with a note rather than guessed at.
- **A shallow horizon slides the band down; it does not shrink it.** Mage
  Tower's horizon is 67.5, so its strip is the top 120px and takes in ~50px of
  the arcane slab. That is the rule working, not an exception to it. The other
  reading — keep the band strictly above the horizon and let it shrink — would
  crop a 6:1 vista down to a keyhole on exactly the maps with the least backdrop
  to spare, and needs a second rule for what to do about the leftover card
  height. What a card wants is a full-width strip of the map's own art; not
  showing an EMPTY play surface is why the horizon is the anchor.
- **The strips are `<img loading="lazy">`, not CSS backgrounds, and that is the
  whole reason they're affordable.** Ten cards is ~300 KB of art against a menu
  that loads in ~510 KB; only an `<img>` can defer. Measured on the built page:
  first paint 511 KB → **709 KB** (Chrome's lazy lookahead pulls 7 of the 10 on
  a phone), a full scroll to the bottom 810 KB. A one-map SESSION barely moves
  (~5.5 → ~5.8 MB), because the map's own background and BGM dominate — it is
  only a menu-bouncer who pays. If that ever needs cutting, drop `CARD_W` from
  840 (2× a 420px card) before touching `CARD_Q`: it is a dark, scrimmed,
  decorative strip, and area beats quality here.
- **`.map-art` sizes itself with `aspect-ratio: 420/120`, but the header still
  wins.** It is a flex item in a column flex container, so its automatic minimum
  size keeps a card with the two-button Continue/New run stack from clipping on
  a narrow phone — verified at a 320px viewport, where the strip grows to fit
  instead. Don't replace this with a fixed height.
- The scrim (`.map-art::after`) is bottom-heavy and ends at the card body's own
  colour rather than at transparent, so ten very different backdrops (a noon
  farm, a night market) all stay legible under brass text and the strip hands
  off to the body with no seam.
