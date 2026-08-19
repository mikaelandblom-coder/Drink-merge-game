# TODO — make shadows reviewable

Mikael, 2026-08-19: *"it's difficult for me to keep track of shadows."*

This file exists because that is a fair complaint about the code, not about the
reader. Shadows are decided in **three** places that don't reference each other,
the choice is implicit, and **nothing in the game or the tools shows you a
shadow on its own.** Below is what is actually true today (measured, not
recalled), then the work that would fix the reviewability problem.

---

## 1. Why it is hard to keep track

Not because there are many knobs — because the *choice* of system is implicit.
An item never says which shadow it gets. It's derived, at draw time, from a
condition spread across `drawDrink`:

```
flat map?          -> SILHOUETTE   (baked from the sprite's own alpha)
else has .cap?     -> CAPSULE      (stadium, at the authored cap.rot)
else               -> BLOB         (radial SHADOW_SPRITE, sized to physR)
```

Three consequences, and they are the whole difficulty:

- **The same sprite gets different shadows on different maps.** The five
  receipts take BLOB/CAPSULE on nine maps and SILHOUETTE on Napoli. There is no
  single answer to "what shadow does the crumpled receipt have".
- **The systems disagree about what a shadow is attached to, on purpose.** BLOB
  and CAPSULE follow the **body** (they are a hitbox-grounding cue and ignore
  the art offset). SILHOUETTE follows the **art** (it is a picture of the
  sprite). Both are correct; nothing states it in one place. This is exactly
  what caused the receipt bug — see §6.9 in `assets/source/pizza/DESIGN.md`.
- **They have separate, differently-scaled constants.** `SHADOW_DROP` 0.40 with
  a 0.82 vertical squash, versus `FLAT_SHADOW_DROP` 0.13 with no squash. Both
  are fractions of `physR`, so they don't compare by eye.

## 2. What exists today — measured, 2026-08-19

96 items across 11 chains (10 map chains + the shared receipts).

| system | items | who |
|---|---:|---|
| BLOB — radial `SHADOW_SPRITE`, sized to `physR` | 58 | default everywhere |
| CAPSULE — stadium at `cap.rot` | 29 | any item with a `cap` |
| SILHOUETTE — baked from sprite alpha | 9 | every item on a `flat:` map (Napoli only) |

Per chain:

| chain | blob | capsule | silhouette |
|---|---:|---:|---:|
| hawaii | 7 | 2 | — |
| saigon | 8 | 1 | — |
| kyoto | 9 | — | — |
| mage | 9 | — | — |
| teddy | 9 | — | — |
| melody | — | 10 | — |
| paris | 2 | 7 | — |
| farm | 6 | 3 | — |
| cantho | 4 | 5 | — |
| pizza | — | — | 9 |
| receipts (shared) | 4 | 1 | *(all 5 on Napoli)* |

## 3. Two things I checked so you don't have to

**No item sprite has a shadow painted into the art.** This was your hypothesis
and it is worth having a firm answer to, because a painted shadow under an
engine shadow is a double-shadow bug that is very hard to spot by eye. I scanned
all 103 shipped sprites for the signature — semi-transparent, dark, desaturated
pixels in the bottom band, spreading wider than the body above them (the
pipeline keys out white, so a painted grey shadow survives as exactly that).
**Zero matched.** Five sprites scored high on a looser test and I looked at each
one: `mage/ring`, `mage/wand`, `farm/cabbage`, `farm/blueberry`, `teddy/bunny` —
all self-shading and soft alpha edges, no ground shadow. So every shadow in the
game is engine-drawn, and there is no hidden double-up to hunt.

The scan is worth keeping for new art: **a sprite with a painted shadow must not
be shipped**, because all three systems would then draw a second one under it.

**Nine blob items have a shadow under 45% of their drawn art's half-height** —
a small puddle under a tall object:

| item | shadow r | art half-height | ratio |
|---|---:|---:|---:|
| kyoto · matcha softserve | 12.2 | 44.4 | 0.27 |
| saigon · hoisin | 16.6 | 52.8 | 0.32 |
| kyoto · matcha parfait | 21.1 | 62.4 | 0.34 |
| hawaii · mango lassi | 17.3 | 49.2 | 0.35 |
| hawaii · grape slush | 21.2 | 60.0 | 0.35 |
| saigon · chili | 11.5 | 31.2 | 0.37 |
| hawaii · sunset punch | 31.7 | 72.0 | 0.44 |
| hawaii · golden ale | 37.3 | 85.2 | 0.44 |
| kyoto · dango | 13.7 | 31.2 | 0.44 |

**These are probably all correct and should not be "fixed" blind.** Every one is
a tall object standing on a narrow base — a cone, a bottle, a stick — and a
standing object's shadow *should* be the size of its footprint, not its
silhouette. They are listed because they are where an actual mistake would hide,
so they are the right nine to look at first.

## 4. The "dirt decal" idea

Your suggestion — a small hardcoded smudge under the art instead of a computed
shadow — is close to something that already exists: **the BLOB is a soft radial
smudge**, a single cached 256px sprite blitted scaled. It is not per-item art
and costs nothing. The only thing making it feel per-item is that it is *sized
to `physR`*, i.e. to the hitbox.

So the real question isn't "should we add a decal", it's:

> Should a shadow be sized to the item at all, or should every item get the same
> small smudge?

Worth deciding deliberately, because there is a real trade:

- **A fixed smudge is trivially reviewable** — one shape, one size, no coupling
  to hitboxes or art offsets, nothing to get out of sync. Everything in this
  file's §1 stops being true.
- **It loses the grounding cue on big items.** A 71r pumpkin over the same
  smudge as a 15r seed reads as floating. Shadow size is most of what sells
  weight.

A middle option that keeps the review simplicity: **one smudge, scaled by `r`
only** (not `physR`, not the art, not `vis`). Then a shadow is a pure function
of the tier, predictable from the items table alone, and reviewable without
running anything. It would give up the narrow-base realism in §3's nine items —
which is exactly the trade to judge, and judging it needs task 1 below.

**Do not decide this from the table.** It is a look question.

## 5. The TODO

**1. A shadow review mode — the actual unblock. NOT BUILT; this is a note.**
Everything else here is guesswork until you can see all the shadows at once, and
there is no way to today: the hitbox editor draws collision shapes, not shadows,
and the X-ray overlay is about merges. So reviewing shadows currently means
playing ten maps and trying to remember.

The smallest useful version is a `?shadows=1` contact sheet: lay one chain's
items out on a blank stage at their real draw size, each labelled with the
system it takes. That turns the review into one page per map. It reuses
`drawDrink` directly rather than reimplementing anything, which is the same
fidelity argument that keeps the dev tools in the browser (see "The dev tools
stay browser pages" in CLAUDE.md).

Sequencing note: tasks 2 and 3 below are *waiting on this one*. Both are look
questions, and answering them from the tables in this file rather than from the
screen is how the wrong call gets made.

**2. Then walk §3's nine.** With task 1 they are one screen. Decide per item:
correct footprint, or genuinely too small.

**3. Then answer §4** — keep three systems, or collapse to one scaled smudge.
Answering it before task 1 is guessing.

**4. Write the rule down once.** Wherever this lands, the sentence that was
missing is: *a shadow drawn from the hitbox follows the BODY; a shadow drawn
from the art follows the ART.* It is now in CLAUDE.md's known-issues list, but
there is still no one place that says which items get which.

**5. Keep the painted-shadow scan.** It lives in this session's scratchpad.
Worth moving into `process_assets.py` as a post-extraction warning, so a future
AI sheet that comes back with shadows under the items is caught at extraction
rather than in play. Cheap: it is one pass over the alpha.

### Not on this list, deliberately

- **Retuning `SHADOW_DROP` / `FLAT_SHADOW_DROP`.** Both were set against real
  art for stated reasons (see the comments in `render.js` and §6.5 in
  `assets/source/pizza/DESIGN.md`). Nothing measured suggests they are wrong.
- **Giving the receipts their own shadow treatment.** They now behave correctly
  under both systems. Their oddity is that they cross maps, which task 1 shows
  and §4 would remove.
