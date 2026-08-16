# Napoli — design document

Structure and house rules for these docs: [assets/MAP-DESIGN.md](../../MAP-DESIGN.md).
Prompting reasoning that applies to every map: [assets/ART-PROMPTS.md](../../ART-PROMPTS.md).

**Status: in progress.** Item art shipped; background is being rerolled (§6.3).

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
pepperoni → pizza bianca → pan pepperoni → the works
```

**Every subject must be radially symmetric** — a disc, a ring or a ball, with no
handle, no stem, no top and no bottom. This is the map's one hard rule. A wedge
of pizza, a pizza peel, a bottle of chilli oil or a leaning sprig of basil would
each tumble like it was falling over, which is exactly what happened when
rotation was tried on Cần Thơ's upright rice-paper rolls. A cell that comes back
with a stalk on the tomato is a reroll, not a "good enough".

**Colour ladder:** near-black → cream → red → green → violet → orange → cream →
red-gold → slate. Adjacent tiers never share a family, because at r15–r30 hue is
what tells a player two items match. The two creams sit five tiers and 30px of
radius apart.

**The last three escalate by SILHOUETTE, not size**, which is the hard part of a
chain whose every finale is a circle: flat disc (bianca) → visibly thick cylinder
with a raised wall (pan pizza) → disc framed by the dark ring of a stone (the
works). Judge a candidate finale by whether the three are tellable apart as black
shapes. Escalating by size the way Saigon does (bowl → bowl → pot) would have
produced three indistinguishable circles.

## 3. The play surface

**Undecided — the original oven-hearth plan was dropped with the background
(§6.3).** Whatever replaces it, the boundary should be a shape no other map has:
Saigon is a round tray, Cần Thơ a tapering boat deck, everything else is a
table. A map should play different, not just look different.

The current placeholder background is an oven interior, so the traced boundary
will change when the real art lands. Nothing has been traced yet — the map runs
on default rectangular walls, `DEFAULT_HORIZON` and the default danger line.

## 4. Engine features this map turns on

| flag | why |
|------|-----|
| `spin: true` | The reason the map exists. Items draw at their real body angle; purely cosmetic, since the bodies always rotated. |
| `flat: true` | **New, added for this map.** Anchors sprites by their CENTRE instead of their base — see §6.2. |
| Happy Hour | Inherited, as on every map. Constrains the background: the cast is sized off `HORIZON`. |
| combos | Left at the default (off). Not considered — worth a look once the map is playable. |
| `SOUND_MAP` | No row yet; inherits `default`. Theme it in the sound lab once the map plays well. |

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

### Background — REROLL PENDING (see §6.3)

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

### 6.4 bodyRatio was guessed when it could have been measured

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
- Combos are at the default (off) and have not been considered.

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
