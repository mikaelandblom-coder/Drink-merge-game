# Napoli (Pizzeria) — art prompts

Two prompts, both ready to paste. Read
[assets/ART-PROMPTS.md](../../ART-PROMPTS.md) first if you want the reasoning
behind each clause — this file only fills that template in and notes the three
places it deliberately departs from it.

Drop the results here as `sprite_sheet.png` and `bg.png`, then:

```bash
python process_assets.py --map pizza
```

```bash
python compress_backgrounds.py
```

---

## The one thing this map cannot compromise on

Napoli is the map that turns on **`spin: true`** — items draw at their real
physics angle instead of a tiny idle wobble. That only looks right if every
subject is **radially symmetric**: a disc, a ring or a ball, with no handle, no
stem, no top and no bottom. A wedge of pizza, a pizza peel, a bottle of chilli
oil or a leaning sprig of basil would each tumble on the table like it was
falling over — that is exactly what happened when rotation was tried on
Cần Thơ's upright rice-paper rolls.

So if a cell comes back with a stem on the tomato or a handle on the pan, that
cell is a reroll, not a "good enough".

---

## 1. Item grid (3×3)

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

## 2. Background

The play surface is the **floor of a wood-fired oven** — a boundary shape no
other map has (Saigon is a round tray, Cần Thơ a tapering boat deck, everything
else is a table). It changes how the pile behaves, so the map plays different
and not just looks different.

### The camera angle is the whole problem — get it from the engine, not by eye

**Pass 1 got this wrong and it is worth understanding why.** Two wood-fired-oven
backdrops were generated (`bg_1.png` low camera, `bg_2.png` steeper — both still
in this folder) at roughly 45–55° off vertical, and against straight-down item
art they read as propped-up plates on a receding floor. The prompt asked for
top-down items and an oblique room, which cannot agree. `bg_2.webp` is wired up
as a placeholder so the map is playable meanwhile.

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

### The other three constraints

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

### Prompt — sunlit marble prep counter

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

## 3. After the art lands

1. `python process_assets.py --map pizza` — check the console for the
   below-half-nominal-area warning from `config/items.js`. If a sprite comes
   back wider than tall, give it `vis = sqrt(0.75/aspect)`.
2. `python compress_backgrounds.py`.
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
