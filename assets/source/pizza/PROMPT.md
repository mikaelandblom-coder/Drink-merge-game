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
and not just looks different. The far edge curving up into the dome is the wall
you will trace in `tools/hitbox-editor.html`.

```
Portrait 2:3 illustration, warm storybook style, looking straight into the
mouth of a Neapolitan wood-fired pizza oven. The flat firebrick hearth fills
the lower two thirds of the frame: pale sooty brick, completely empty and
unobstructed, stretching away from the viewer and curving up at the far end
where it meets the low domed brick ceiling, so the floor reads as a broad
rounded arch. Beyond and above, the glowing orange mouth of the fire off to
one side, dark soot-blackened dome bricks, a warm ember glow. Deep warm
oranges and browns, soft firelight, no people, and absolutely nothing resting
on the near hearth - no pizzas, no peels, no tools, no logs on the floor.
```

Two clauses in there are load-bearing and neither is taste:

- **Portrait 2:3, play surface in the lower two thirds** — the stage is
  420x620.
- **Nothing painted on the hearth.** It gets traced as the physics boundary, so
  anything resting on it sits *under* the field and reads as an obstacle that
  is not there.

The fire glow being **off to one side** is deliberate too: a bright symmetric
blaze dead centre behind the horizon competes with the aim line, which is the
same mistake the sakura effect made on Kyoto.

---

## 3. After the art lands

1. `python process_assets.py --map pizza` — check the console for the
   below-half-nominal-area warning from `config/items.js`. If a sprite comes
   back wider than tall, give it `vis = sqrt(0.75/aspect)`.
2. `python compress_backgrounds.py`.
3. Trace the hearth boundary + horizon + danger line in
   `tools/hitbox-editor.html` (saves to `config/hitboxes.js`).
4. Tune each item's collision circle in the same editor — `bodyRatio: 0.90` in
   `config/items.js` is a starting guess, not a measurement.
5. Play it with `?spin=0` and `?spin=1` back to back to confirm the rotation is
   actually earning its place on the finished art.
6. Suno track to `assets/audio/Napoli.mp3`, then `python compress_audio.py`.
7. Theme the sounds in `tools/sound-lab.html` (it inherits the `default` row
   until then).
