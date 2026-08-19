# Napoli — design document

Structure and house rules for these docs: [assets/MAP-DESIGN.md](../../MAP-DESIGN.md).
Prompting reasoning that applies to every map: [assets/ART-PROMPTS.md](../../ART-PROMPTS.md).

**Status: playable.** Art, both framings, boundaries, sounds and BGM all in.
Remaining: the deploy checklist (GAME_VERSION + `?v=`).

---

## 1. What this map is

`id: 'pizza'`, label **Napoli**, sublabel **Pizzeria**. MAPS[9], added
2026-08-16 on branch `pizza-map`.

The map exists to give `spin: true` something to do. Rotation was built on
2026-08-16 with no map using it, explicitly for "a planned PIZZA map, whose
subjects are radially symmetric" — this is that map, requested by Mikael as
"a delicious looking set of items that utilize the new item rotate
functionality".

The fantasy is a pizzaiolo's bench: toppings and finished pies sliding around a
work surface in a sunlit Italian pizzeria.

## 2. The tier chain

Six ingredients, then three finished pies — Saigon and Cần Thơ's
"make a dish from its ingredients" arc, which Mai singles out as the thing she
likes. It suits pizza better than any other cuisine for one blunt reason: the
toppings are already discs, so the arc and the rotation constraint want the same
art.

```
olive slice → mozzarella → cherry tomato → pepper ring → onion ring →
pepperoni → pizza bianca → prosciutto e rucola → the works
```

Tier 8 was `pan pepperoni` until 2026-08-19; it was replaced off a second sheet
for a reason that goes to this map's one hard rule — see §6.7.

**Every subject must be radially symmetric** — a disc, a ring or a ball, with no
handle, no stem, no top and no bottom. This is the map's one hard rule. A wedge
of pizza, a pizza peel, a bottle of chilli oil or a leaning sprig of basil would
each tumble like it was falling over, which is exactly what happened when
rotation was tried on Cần Thơ's upright rice-paper rolls. A cell that comes back
with a stalk on the tomato is a reroll, not a "good enough".

**Colour ladder:** near-black → cream → red → green → violet → orange → cream →
**green** → slate. Adjacent tiers never share a family, because at r15–r30 hue is
what tells a player two items match. The two creams sit five tiers and 30px of
radius apart, and since 2026-08-19 so do the two greens (pepper ring r27, rucola
r58) — the same spacing the creams had already proved is far enough.

**The last three were meant to escalate by SILHOUETTE, not size**, which is the
hard part of a chain whose every finale is a circle: flat disc (bianca) → visibly
thick cylinder with a raised wall (pan pizza) → disc framed by the dark ring of a
stone (the works). Escalating by size the way Saigon does (bowl → bowl → pot)
would have produced three indistinguishable circles.

**That plan half-survived.** The thick-cylinder tier was retired on 2026-08-19
(§6.7) because the only way to paint a raised wall is to tilt the pan, and a
visible side wall is a "this way up" — the thing the rule above forbids outright.
The finales now separate as: pale flat disc → **green canopy** → dark stone ring.
Two of those three are still black-shape distinct (the works keeps its frame);
bianca and rucola separate by hue alone. That is a weaker cue and is the one
thing on this map worth watching in play — but a silhouette that only exists at
one camera angle is not a silhouette at all on a map whose items turn.

## 3. The play surface

A **marble pizza prep counter** with a raised lip, seen from above. The original
plan was the floor of a wood-fired oven; that went with the first background
(§6.3), and the oven now appears in the backdrop band instead.

**Two framings, and they differ in what is TRACEABLE — not just in dressing,
which is what `sizes` means on every other map.** Measured off the masters:

| | far edge (horizon) | far/near width | sides in frame |
|---|---|---|---|
| `bg_large` | 31.7% down → world y ≈ 197 | 50% | **no** — touches the left frame edge on 84% of its height, the right on 79% |
| `bg_small` | 34.3% down → world y ≈ 213 | 51% | yes, apart from the near corners |

`small` is the **default**: its walls are the painted lip all the way round,
where `large` needs side walls invented at the stage edge. That also gives it the
plain `pizza` score/hitbox key — a free choice only because the map has never
shipped, so there is nothing to re-point.

**Both are now traced** (2026-08-19), with horizons at 212.7 (`pizza`) and 196.2
(`pizza__large`) — within a couple of px of the 213/197 measured off the masters
above, so the painted lip and the perspective row agree.

**Two things that were checked while tracing**, both measured rather than guessed:

- **The taper is hard — ~50% far-to-near, against the engine's `FAR_W` of 74%.**
  Cần Thơ's small framing proved that a hard taper cramps the endgame (a wider
  `large` was added to it on 2026-08-02 for exactly this), and Napoli's finale
  has `physR` 67. If the top tiers jam at the back, this is why.
- **The horizon lands at world y ≈ 197–213, under the ~235 that Happy Hour
  wants.** Customers are sized `min(108, HORIZON*0.46)`, so they will draw at
  ~91–98px instead of the full 108 — about 10% small, not broken. The horizon is
  dragged by hand in the editor and does not have to sit exactly on the painted
  lip, so there is a little room to trade.

## 4. Engine features this map turns on

| flag | why |
|------|-----|
| `spin: true` | The reason the map exists. Items draw at their real body angle; purely cosmetic, since the bodies always rotated. |
| `flat: true` | **New, added for this map.** Anchors sprites by their CENTRE instead of their base — see §6.2. |
| Happy Hour | Inherited, as on every map. Constrains the background: the cast is sized off `HORIZON`. |
| combos | OFF, decided after playtesting (2026-08-19). No `combos:` field, which is what leaves the checkbox unticked; the option is still offered. |
| `SOUND_MAP` | `pizza` row: merge-bubble + collide-wood-tok, rest inherited from `default`. |

## 5. Art prompts, as sent

Drop results in this folder as `sprite_sheet.png` and `bg.png`, then:

```bash
python process_assets.py --map pizza
```

```bash
python compress_backgrounds.py
```

### Item grid (3×3) — SHIPPED, first pass, no reroll needed

**Departures from the standard food template, all three on purpose:**

- **Top-down, flat-on**, not the usual front-facing / 3-4 view. A pizza seen
  at an angle is an ellipse, and an ellipse gives away its rotation.
- **Perfectly circular outline** is stated per item, because "roughly as tall as
  it is wide" is not strong enough here.
- **The last three are separated by silhouette**, not size — see the note under
  the prompt.

Attach `assets/images/cantho/bowl.png` or `assets/images/saigon/bowl-large.png`
as a style reference; it locks cross-map consistency better than any adjective.

```
A 3x3 sprite grid of 9 Italian pizzeria items on a fully transparent
background, PNG with true alpha transparency. NO background, NO checkerboard,
NO drop shadows, generous empty spacing between sprites so nothing touches.

High-end mobile game collectible icon style. Cute, appetizing storybook
illustration with soft rounded, slightly plump proportions. Every item should
look delicious enough that you immediately want to eat it. Rich but believable
food textures, subtle glossy highlights, warm saturated colours, gentle warm
outlines, clean silhouettes and crisp edges.

The food should look authentic and traditional to Neapolitan pizza rather than
generic: real charred leopard-spotted crust, fresh basil, buffalo mozzarella,
San Marzano tomato, proper cured salami.

EVERY sprite is viewed STRAIGHT DOWN FROM DIRECTLY ABOVE, flat-on, so that its
outline is a clean circle. No tilted or 3/4 angles, no ellipses, no
perspective. Each item is a disc, a ring or a ball, perfectly round, centred,
with no handle, no stem, no stalk and no visible "up" direction — each one
should look identical if you rotated it. No plates, no boards, no pizza peels,
no cutlery, no slices or wedges cut out of a pie.

Lighting is warm and soft from directly above, with consistent lighting across
every sprite. Shapes are simple and readable at small sizes while preserving
mouth-watering detail when viewed large.

Every sprite is:
- centred in its cell
- exactly as tall as it is wide
- consistent scale
- consistent level of detail
- isolated with plenty of transparent space around it

Use fresh herbs, vibrant garnishes, bubbling cheese and natural colour
variation to make the food feel alive and freshly baked.

Give each item a DISTINCT dominant colour, spread around the colour wheel, so
that no two items next to each other in the list below share a colour family.
Choose a variety of the ingredient that is genuinely the stated colour.

Prioritize recognizability, appetite appeal and authentic Neapolitan
presentation over strict realism. The result should look like premium artwork
from a polished mobile merge game.

ITEMS

Row 1:
- A single slice of black olive, cut across the ring so it is a dark hoop with
  a hole through the middle - deep aubergine, almost black
- A single ball of fresh buffalo mozzarella, glossy and milky - creamy white
- One ripe cherry tomato seen from directly above so it is a plain circle, no
  stalk and no leaves - bright scarlet red

Row 2:
- A single ring of green bell pepper, crisp and juicy - vivid grass green
- A single ring of red onion, translucent layered hoops - bright violet purple
- One thick slice of pepperoni salami with curled crisp edges and pale fat
  flecks - deep orange-red

Row 3:
- A small round pizza bianca: no tomato, just melted mozzarella, ricotta
  dollops, garlic and fresh basil on a pale golden crust. Flat and thin -
  dominant colour creamy white
- A round deep-dish pan pizza, visibly THICK, with a tall crisp golden wall of
  crust standing up around the outside and bubbling pepperoni and cheese sunk
  in the middle. Clearly taller and deeper than the flat pizza above -
  dominant colour red and golden brown
- The finale: a lavish round pizza with everything on it - pepperoni, olives,
  peppers, mushrooms, basil, torn buffalo mozzarella - resting on a round dark
  slate pizza stone that is a little wider than the pie, so a dark ring frames
  the whole thing. Dominant colour dark slate grey around vivid toppings
```

### Judging the result

Three checks, in order:

1. **Rotate each cell 90 degrees in your head.** Anything that now looks wrong
   is not usable on this map.
2. **Squint at the bottom row as black shapes.** Flat disc / thick cylinder /
   disc-inside-a-ring must be tellable apart with the colour thrown away. This
   is the hard part of a nine-tier chain where every finale is a circle, and it
   is worth a reroll of just that row if it fails.
3. **Check the colour ladder holds** — near-black, cream, red, green, violet,
   orange, cream, red-gold, slate. Adjacent tiers sharing a family is the
   mistake Paris and Cần Thơ both shipped: at r15–r30 hue is what tells the
   player two items match.

If true alpha fails twice, ask for **one flat pure-white background** instead —
`process_assets.py` keys white cleanly and always has. Do not accept a painted
checkerboard: `chroma:'checker'` rescues it, but flyaway detail (basil edges,
cheese strings) comes back as soft fuzz, which is exactly the damage Cần Thơ's
noodle nest still carries.

---

### Background — SHIPPED on the second pass (see §6.3, §6.4)

#### The camera angle is the whole problem — get it from the engine, not by eye

The engine already states the answer, in two places:

- `persp()` (game.js) is **fixed and global for every map**: the far edge of the
  field is **74%** of the near width and items draw at **55%** scale at the back.
- `drawDrink` squashes the ground shadow by `ctx.scale(1, 0.82)` — the ground
  plane foreshortened, i.e. `cos θ = 0.82`, i.e. a camera about **35° off
  vertical**.

So the target is a **steep three-quarter view, ~30–35° off vertical**. Not 45°,
and NOT fully overhead either: the engine still draws a receding trapezoid, so a
surface with parallel edges would fight it — the far edge must still narrow to
roughly three quarters of the near edge.

#### The other three constraints

- **Portrait 2:3** — the stage is 420x620.
- **Play surface fills the lower ~60%, leaving a real backdrop band above it.**
  Happy Hour customers stand ON the horizon at `min(108, HORIZON*0.46)` px tall
  (`customerLayout`, render.js), so `HORIZON` wants to be ≥ ~235 of 620 for
  full-size faces. A surface creeping higher than that shrinks the whole cast.
- **Nothing resting on the play surface.** It gets traced as the physics
  boundary, so anything painted on it sits *under* the field and reads as an
  obstacle that is not there.
- **Keep it pale.** Tier 0 (black olive) and the tier-8 slate stone are the two
  darkest things in the chain, and on dark brick they disappeared. A light
  surface is a legibility requirement here, not a mood preference — and any
  bright feature in the backdrop belongs OFF TO ONE SIDE, never dead centre
  where it competes with the aim line (the mistake sakura made on Kyoto).

#### Prompt — sunlit marble prep counter

```
Portrait 2:3 illustration, bright warm storybook style, looking down at a
pizzaiolo's marble prep counter in a sunlit Italian pizzeria.

The camera is high and steep, looking down at the counter from about 30
degrees off vertical - almost a top-down view, but with just enough angle
that the counter still recedes: its far edge is about three quarters as
wide as its near edge.

The pale cream marble counter fills the lower 60% of the frame: dusted with
flour, softly veined, completely empty and unobstructed, its near edge
running off the bottom of the frame and its far edge a gently curved lip.
Nothing rests on it at all - no pizzas, no dough, no peels, no bowls, no
tools, no hands.

Above and beyond the counter, a shallow band of warm pizzeria backdrop:
terracotta wall, wooden shelves of tomato tins and basil pots, strings of
garlic, and the arched mouth of a wood-fired oven glowing softly off to ONE
SIDE rather than in the centre. Bright morning sunlight from a window, soft
shadows, cheerful and appetizing. Warm creams, terracotta and soft greens.
No people.
```

Swap the subject freely — the four constraints above are what matter, not the
marble. A scrubbed-wood trattoria table on a sunny terrace works the same way.

### Music (Suno) — SHIPPED

`assets/audio/Napoli.mp3`, 196s, re-encoded to 112 kbps (2.6 MB). It ends on a
fade rather than looping seamlessly, so the loop point goes briefly quiet —
Mikael's call to keep it (2026-08-19), a slight pause being fine.

```
Warm sunny Neapolitan trattoria instrumental. Mandolin lead with
nylon-string acoustic guitar, soft accordion, gentle upright bass and light
brushed percussion. Relaxed mid-tempo tarantella feel, major key, cheerful
and appetizing, like a family pizzeria on a bright morning.

Steady even energy throughout - no build-ups, no drops, no key changes, no
solos that pull focus.

Seamlessly loopable: no intro, no outro, no fade in or out, no final chord.
It should be able to start again from the top without anyone noticing.

Instrumental only, no vocals and no vocal samples. About 2 to 3 minutes.
```

Why those clauses are in there is in
[ART-PROMPTS.md](../../ART-PROMPTS.md#bgm-prompt-suno); the short version is
that the loop and length clauses are bandwidth and seam requirements, not taste.
Mandolin is the one genuinely free choice, and it is the instrument that will
place the map in one bar.

`bgmVol` is at the house default of 0.35. Suno masters hot, so if it sits over
the effects, lower that rather than re-exporting — the player's music slider
multiplies it, so per-map balance survives.

---

## 6. Challenges

### 6.1 The sprite sheet would not split — 5px and 2px gutters

**Symptom:** `process_assets.py --map pizza` asserted
`expected 3x3 content bands, found 1x3`. The rows split fine; all three columns
came back as one band. The assert's own message blamed a glow bridging a gutter,
which sent the first look in the wrong direction — the sheet has no glow.

**Cause:** the art is simply packed tighter than the splitter's tolerance.
Measuring the fully-transparent column runs gave gutters of **5px and 2px**,
against `_alpha_bands`' `merge_gap` of 14. The one existing retry stopped at 4,
so the 2px gutter was merged away no matter what.

**Fix:** `split_alpha_grid` now walks a ladder of merge gaps (14, 8, 4, 2, 1),
widest first, accepting only a result with exactly the expected band count. A
wide gap is the most tolerant of stray specks, so the narrow rungs are reached
only once the wide ones have demonstrably merged a real gutter away — meaning a
sheet that already split correctly cannot come out differently than before.

**For next time:** "generous empty spacing between sprites so nothing touches"
was in the prompt and the generator still packed them to 2px. It is not a prompt
problem worth spending a generation on; the splitter handles it now.

### 6.2 Every item floated above its own collision circle

**Symptom:** with the first board rendered, the food looked like it was hovering
just above the floor, and items that were touching looked interpenetrated.

**Cause, and it is structural rather than a bug:** `drawDrink` has always placed
the sprite's BASE at `r*0.75`. That is correct for every map built so far, all
of which draw objects STANDING on a table — the physics body sits up inside the
glass and the art hangs below it, so the shadow peeking out at its foot reads as
contact. Napoli's food LIES on a floor, and its disc is dead centre in the
sprite: measured `cy = 0.499` on all nine PNGs. Base-anchoring therefore drew
every item **0.45r above its own collision circle**, and **10–22% too large**.

**Fix:** a `flat: true` map flag that anchors the sprite by its centre instead,
mirroring how `spin` is wired (map field → global in `startGame` → parameter to
`drawDrink`), with `?flat=1` / `?flat=0` to force it either way. Off for every
other map — verified by cycling all ten and checking the flag, and by confirming
Kyoto still renders.

**The general lesson, which is why this is written down:** the sprite anchor
encodes an assumption nobody had needed to state — that game objects stand
upright on a surface. Any future map of flat-lying subjects (a sushi counter, a
card table, a workbench of tools seen from above) will need `flat: true` and
should not rediscover this.

### 6.3 The background camera angle was specified by eye, and was wrong

**Symptom:** Mikael's read of the first two backgrounds — "there is a mismatch
between the item view angle and the background". Correct.

**Cause:** the background prompt was written without consulting the engine. It
produced a wood-fired oven interior at roughly 45–55° off vertical, while the
item prompt asked for straight-down art. Those cannot agree, and the result is
that flat discs read as plates propped up on a receding floor. Two generations
spent (`bg_1.png` low camera, `bg_2.png` steeper — both kept in this folder;
`bg_2.webp` is wired up as the placeholder so the map stays playable).

**The engine had the answer all along, in two numbers:** `persp()` narrows the
far edge of the field to 74% of the near width, and `drawDrink` squashes the
ground shadow by `ctx.scale(1, 0.82)` — `cos θ = 0.82`, a camera ~35° off
vertical. The respecified prompt in §5 is derived from those rather than from
taste, and also records why *fully* overhead is wrong: the trapezoid stays, so a
surface with parallel edges would fight it.

**Two secondary findings folded into the reroll**, both of which would have been
missed by only fixing the angle:

- **The surface has to be pale.** Tier 0 is a near-black olive and tier 8 sits on
  dark slate; on dark firebrick, both disappeared. This is legibility, not mood —
  and it is what moved the subject off "oven interior", which is dark by
  definition, so brightening it fights the subject.
- **Happy Hour constrains the framing.** The cast is drawn at
  `min(108, HORIZON*0.46)` px standing on the horizon, so a surface that creeps
  above ~60% of frame height silently shrinks every customer.

**For next time:** an item prompt and a background prompt are one decision, not
two. Write the camera angle into both, from `persp()` and the shadow squash.

### 6.4 The first counter had no traceable edges

**Symptom:** Mikael, on generating the replacement background — "the edge of the
table is out of frame, so there is no natural game zone in the art."

**Cause:** the respecified prompt (§5) fixed the camera angle, the brightness and
the horizon, and still never said the play surface's edges had to be *visible*.
It asked for the counter to fill the lower 60% of the frame, which the generator
satisfied by running it off both sides. Measured on `bg_large.png`: the counter
touches the left frame edge on **84%** of its height and the right on **79%**.
The far edge is in frame; the sides simply are not.

That matters because **the painted edge IS the boundary**. With no edge to trace,
the side walls have to be invented at the stage edge, and balls stop against
nothing.

**Fix:** a second generation with the borders inside the frame (`bg_small.png`),
and the rule added to the shared background prompt in
[ART-PROMPTS.md](../../ART-PROMPTS.md) so no future map pays for it again: near
edge off the bottom only, left/right/far fully visible.

**Both were kept as size variants** rather than throwing the first away —
`large` is genuinely the bigger table, `small` the one whose walls are real, so
`small` is the default. Note this is NOT what `sizes` normally means: everywhere
else the two framings differ only in dressing, while here they differ in what can
be traced.

**Worth watching:** both taper to about **50%** far-edge-to-near-edge width,
against the engine's `FAR_W` of 74%. Cần Thơ's small framing already proved a
hard taper makes the endgame cramped — that is exactly why a wider `large` was
added to it on 2026-08-02 — and Napoli's finale has `physR` 67. If the top tiers
jam at the back, that measurement is the reason.

### 6.5 Hollow items had solid shadows, then floating ones

**Symptom:** the ring tiers — olive slice, pepper ring, onion ring — showed a
dark blob through their holes.

**Cause:** the shared shadow is a radial gradient that is DARKEST AT ITS CENTRE,
which is invisible under a solid item and exactly wrong under a hollow one: the
densest part of an item's own shadow sat in the one place the counter should
have shown through.

**Fix:** on a `flat` map each item's shadow is baked from its own alpha
silhouette (`makeFlatShadowSprite`), so a ring casts a ring and a pizza casts a
disc, with nothing to author per item and nothing to re-sync when art changes.
Two alternatives were considered and rejected: dropping shadows for the map
(these items had only just stopped looking like they levitated, §6.2) and a
crescent shadow visible along the bottom edge (it implies a LOW light, while the
overhead light is the reason the shadow is centred and squashed at all).

**Then it floated at the top**, which is the part worth remembering. The
silhouette alone was not enough, because it was still being placed with the
constants meant for standing objects: `SHADOW_DROP` 0.40 plus the 0.82 ground
squash pushed the shadow's top edge about **0.43r below the top of the art**.
Under a solid item nobody sees that; under a ring it is a bare gap. Both
constants exist to slide a standing object's shadow out from under its BASE —
and a flat item has no base, so it needs neither. It now uses
`FLAT_SHADOW_DROP` 0.13 and no extra squash.

The general shape of the lesson: `flat` was introduced as one change to sprite
ANCHORING (§6.2), but standing-vs-lying assumptions turned out to be baked into
the shadow geometry too. Expect a third one somewhere.

### 6.6 bodyRatio was guessed when it could have been measured

Minor, but it set the whole chain wrong. The scaffold used a flat
`bodyRatio: 0.90` across all nine as a "trace it later" placeholder. Once the art
existed the true value was directly measurable from the PNGs — disc diameter over
sprite height — and came out **0.87–0.97**, because a top-down disc fills its
frame where a bottle does not. Those are now in `config/items.js`.

Consequence to watch in play: because the ratios are higher than other maps'
0.85, `physR` at a given `r` is ~13% larger at the LOW tiers and only ~4% at the
finale, so the size ramp is slightly compressed. If the endgame plays cramped the
fix is to scale the whole `r` ramp by ~0.89 — **not** to shrink `bodyRatio`,
which would just detach the collision circles from the art again.

### 6.7 The deep-dish tier had a "this way up" — and the map rotates

**Mikael, 2026-08-19: "the pan pizza looks a bit weird and not like an actual
pan pizza".** He was reading a symptom of the map's own rule.

Tier 8 asked the art for something self-contradictory. §2 requires every subject
to be radially symmetric, because `spin: true` draws items at their real physics
angle. But §2 *also* asked tier 8 to be a **visibly thick cylinder with a raised
wall** so the three finales differed as black shapes. A wall is only visible if
you can see its side — and you can only see the side of a pan by tilting the
camera off vertical. So the cell came back at roughly 3/4 view while its eight
neighbours were straight down.

That is what "weird" was. Two separate defects, from the one cause:

- **It did not read as a pan pizza.** The tilt shortened the pie into an oval
  and put the crust's outer face in view, so it read as a normal pizza tipping
  away from the viewer — a perspective error, not a deep dish.
- **It was the only item on the map with an up.** `spin: true` then rotated it.
  The other eight are discs and rings that look identical at any angle; this one
  advertised a horizon and spent the run turning it.

The alpha bounding boxes measure the first defect without opening the art. Every
straight-down sprite in the chain is square to within 3% (olive 328×327,
mozzarella 342×339, onion ring 343×340). The three finales are not:
bianca 389×417, the works 412×449, **pan pizza 395×438** — 10% taller than wide,
which is the perspective depth of a tilted disc showing its far rim. Bianca and
the works carry a mild version of the same tilt and get away with it because
neither shows a *wall*; the pan pizza's whole reason to exist was the wall.

**Fix:** a second sheet (`more_pizzas.png`, nine whole pies, all straight down)
supplied a replacement. Tier 8 is now **prosciutto e rucola** — a flat pie under
a green rocket canopy, alpha box 389×391, i.e. square to half a percent. Its
green also does more work than the pan pizza's red-gold did, since it is the one
thing separating it from bianca's cream now that the silhouette cue is gone.

**The lesson generalises past this map, and it is the ART-PROMPTS.md one turned
up a level.** CLAUDE.md already says the item prompt and the background prompt
are one decision, because the camera angle has to match. This adds: on a `spin`
map, **a silhouette requirement and the radial-symmetry rule can be in direct
conflict, and radial symmetry has to win.** Any finale distinguished by a feature
you can only see off-axis — a wall, a rim, a depth, a base — is asking for art
the map cannot use. Distinguish by what survives rotation: hue, a frame around
the disc, the density of the topping. Check a candidate cell's alpha box before
looking at it; a finished pie more than ~4% off square is tilted.

**The other eight pies from that sheet are extracted** to
`assets/images/pizza/alt/` (margherita, pepperoni-pie, funghi, formaggi,
diavola, ortolana, hawaiian, burrata) as swap candidates for the top tiers. All
nine cells split clean on the first pass — real alpha, no edge contact, no
neighbour slivers, no `min_component_frac` needed, unlike §6.1's sheet. Nothing
fetches them (`loadItemSprites` only pulls the active chain), so they cost repo
size and nothing per visit.

**Two loose ends this left, both handled:**

- `config/hitboxes.js` had a hand-traced entry keyed to `pan-pizza.png`, which
  no longer exists. It was dropped — dead keys are how someone restores retired
  art and silently gets a hitbox for a sprite the pipeline does not emit. Its
  value is recorded here instead: `{ bodyRatio: 1.003, dx: -0.013, dy: 0.023 }`.
- `arugula.png` therefore has **no** override, so unusually for this map its
  `config/items.js` literal is live rather than a fallback (§6.6). It is not
  guessed. `width / height / 0.88` is the formula the eight hand traces already
  obey, and on the finale tiers — the ones whose discs are widest relative to
  their frame — it reproduces them to within 1.5%: bianca 1.031 vs 1.033 traced,
  the works 1.016 vs 1.002, the retired pan pizza 0.998 vs 1.003. For rucola it
  gives **1.097**, and the sprite's box is centred to within one pixel, so `dx`
  and `dy` are genuinely 0. Verified in X-ray on a real merge: the circle sits on
  the painted crust edge, which is this map's convention. A re-trace in the
  hitbox editor would move it under the override with the rest — a confirmation
  pass, not a repair.

**One number did move, and it is the thing to watch.** The old sprite's disc
filled less of its taller frame, so tier 8 drew at ~122 world px and had
`physR` 61.4. Rucola's square frame draws at ~134 px, `physR` 67.2. Both are
correct — the body tracks the painted disc in each case — but tier 8 is now 9.5%
larger, and the gap to the works narrowed from 25% to 13%. Adjacent finales that
are close in size *and* no longer silhouette-distinct is exactly the combination
§2 was trying to avoid. If it plays badly the lever is tier 8's `r` (58 → ~54),
**not** `bodyRatio`, for §6.6's reason.

### 6.8 Happy Hour's receipts spun too — a per-map flag over shared art

**Mikael, 2026-08-19, right after §6.7: "the receipt items are rotating on the
pizza map, which is not supported by the art".** Correct, and it is the same
mistake as §6.7 one level up: §6.7 was art that broke the map's rule, this is
art the rule was never able to reach.

`spin: true` lives in `config/maps.js` next to the map's `items:` reference, so
it reads as a statement about that chain — and it is. But Happy Hour injects
`RECEIPT_ITEMS` (shared, in `config/items.js`) into **every** map, and nobody
choosing `spin` for Napoli was choosing anything about receipts. All four have a
blatant up: the slip's printed lines run horizontally, the roll stands on its
end, the stack lies flat, and the golden receipt is a clipboard with its clip
and coins at the TOP. Napoli turned all of them.

The existing exclusion did not catch it. The render call site already skipped
capsule items — but receipts are plain circles with no `.cap`, so they sailed
straight through a guard that looked like it was about shapes when the real
question was about **provenance**.

**Fix:** one predicate, `drawnSpin(d)` in game.js, testing
`plugin.kind === 'drink'` alongside the old capsule check. Testing the KIND
rather than naming the receipt chain is deliberate: the defect is in the flag's
REACH, so any future shared chain is right without anyone remembering this.

**It also fixed a heat bug nobody had reported.** `sceneBusy()` had its own copy
of the rotation test, gated on `SPIN_ENABLED` alone, so a settled receipt that
was still turning held the render loop at 60fps for a rotation the loop was
throwing away — the exact opposite of the idle-parking that `sceneBusy` exists
for. Both callers now go through `drawnSpin`, which is the point of extracting
it: the loop and the idle check are answering one question ("is this body's
rotation on screen?") and cannot drift apart. The two ways they can disagree are
both real and opposite — draw a rotation `sceneBusy` ignores and the item freezes
mid-turn, or hold the loop awake for one the loop discards and the game never
sleeps. The second had shipped.

**Verification, same standard as the original spin feature.** All five receipt
tiers render **0 differing subpixels** between body angle 0, +120° and −80°, with
a measured noise floor of 0 and a control pizza item moving 10,578 subpixels. The
noise floor is the part worth copying: a first attempt at this test showed every
receipt "differing" under rotation and looked like the fix had failed. It had
not — `render()` advances `wob` by `0.05*dt` per call and the 200ms grow-in reads
`performance.now()`, so two frames of the *same* board are never identical.
Pinning `wob`, backdating `plugin.born`, and clearing particles and text pops
takes the floor to 0 and makes the result mean something. Physics is untouched
either way: all four bodies in the mixed test sat at 68.5° while only the drinks
drew that way.

### 6.9 The silhouette shadow took the body's position, not the art's

**Mikael, 2026-08-19: the shadow on the crumpled receipt has "a part of the
shadow above the item which doesn't make sense".** It didn't, and the reason is
a two-line-apart mismatch in `drawDrink`.

The sprite is drawn at the **hitbox offset** — `ctx.translate(-hbOffX*r,
-hbOffY*r)`, from the `dx`/`dy` traced in the hitbox editor — so the art stays
glued to its collision circle wherever the circle was placed. §6.5's silhouette
shadow was sized off the art (its own comment says "so it lines up with the
sprite exactly") but positioned on the **body**, inside a `save`/`restore` that
never saw that translate. Size from one, position from the other. So for any
item whose circle is off-centre, the art slid out from under its own shadow and
the silhouette showed on the opposite side.

The direction follows the sign: `hbOffY` negative means the art is drawn *below*
the body centre, so the shadow was left standing above it.

**Why the receipts and only the receipts.** Napoli's own nine are traced almost
dead-centre — every `dx`/`dy` in the chain is under 1.5%, so the mismatch was
sub-pixel and invisible. The shared receipt chain is not: `receipt-ball.png`
carries **`dy: -0.281`**, the largest offset in all of `config/hitboxes.js`,
because a crumpled ball's painted mass sits high in its frame. That is ~0.28r of
shadow standing proud of the item — and it took **two** things landing together
to become visible, the `flat:` shadow system (§6.5, Napoli-only) and Happy Hour
putting shared art on a flat map. Neither alone would have shown it.

**Fix:** the flat branch now applies the same offset the art applies, under the
art's own angle, then rotates back by `idle - shAng` so the silhouette's SHAPE
still never turns with the item (§6.5's overhead-lamp rule is untouched).
Non-flat maps take `shAng === idle` and no translate — bit-for-bit the path they
always had.

**The distinction worth keeping**, because it is not obvious and the two shadow
kinds genuinely disagree: a **blob or capsule shadow follows the BODY** — it is a
hitbox-grounding cue and is *supposed* to ignore the art offset — while a
**silhouette shadow follows the ART**, because it is a picture of the sprite and
belongs wherever the sprite is. Any future per-item shadow baked from art wants
the art's transform.

**Measured, before and after,** by restoring `render.js` from HEAD and shooting
the same board:

| | shadow centroid | art centroid |
|---|---|---|
| before | y **31.45** | y 34.57 |
| after  | y **36.59** | y 34.30 |

The shadow moves from 3.1px *above* the art's centre to 2.3px *below* it, while
the art itself moves 0.27px — threshold bleed, not motion. Changed pixels are
confined to the five receipts' own regions. Instrumenting `ctx.drawImage` to log
the device-space centre of each blit is the quicker check and the one to reach
for next time: it reports the shadow-minus-art offset per item directly, and
after the fix every item on every map shows a small positive `dy` (the intended
`FLAT_SHADOW_DROP`) and `dx` within 0.07px of zero.

---

## 7. Open questions and still to do

**Mikael's calls, not technical:**

- The background subject. The marble prep counter in §5 is a proposal; the four
  constraints are the real requirement.
- Whether the boundary shape ends up distinct from the other nine maps (§3).

**Technical, once the background exists:**

- Do the two SPHERE tiers (cherry tomato, mozzarella ball) still sit right beside
  the flat discs on a steep surface? The discs will match the ground plane
  exactly; a sphere is angle-independent and should be fine, but it is an eyeball
  call on the real art and nobody has made it yet.
- **Are tiers 8 and 9 tellable apart mid-run?** Since the tier-8 swap (§6.7) they
  are both flat pies, 13% apart in size, separated mainly by rucola's green
  against the works' dark stone ring. Levers, in order: re-trace rucola in the
  hitbox editor, then tier 8's `r` (58 → ~54), then a different pie from
  `assets/images/pizza/alt/`.
- ~~Combos~~ — settled 2026-08-19: off.

**Checklist:**

1. ~~`python process_assets.py --map pizza`~~ — done, all nine extracted clean,
   no area warning (every sprite came back square).
2. `python compress_backgrounds.py` once `bg.png` exists, then point `bg:` in
   `config/maps.js` at `bg.webp` and move the two oven masters to
   `assets/source/_archive/`.
3. Trace the surface boundary + horizon + danger line in
   `tools/hitbox-editor.html` (saves to `config/hitboxes.js`). Put the horizon
   on the far edge of the counter and check it lands at world y >= ~235, or
   Happy Hour's customers draw undersized.
4. Tune each item's collision circle in the same editor. The `bodyRatio` values
   in `config/items.js` are MEASURED off the shipped PNGs (disc diameter over
   sprite height), so they are already close — this is a check, not a rescue.
5. Play it with `?spin=0` and `?spin=1` back to back to confirm the rotation is
   actually earning its place on the finished art.
6. Suno track to `assets/audio/Napoli.mp3`, then `python compress_audio.py`.
7. Theme the sounds in `tools/sound-lab.html` (it inherits the `default` row
   until then).
