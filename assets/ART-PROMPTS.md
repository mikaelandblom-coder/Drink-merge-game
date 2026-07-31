# Art prompts for merge-item grids

One AI generation has to produce all nine tiers of a map, and generations are
limited — so the prompt is the cheapest place to fix a problem. Everything here
was paid for by a map that shipped wrong.

Two templates: the **food template** below (Cần Thơ, the most refined; use it
for any food map) and the **Paris template** further down (the original, still
the reference for non-food subjects).

---

## Food template

Fill in the nine ITEMS lines and the colour ladder, then send it as one prompt.
Attach a shipped sprite as a style reference — `assets/images/cantho/bowl.png`
or `assets/images/saigon/bowl-large.png` — which locks cross-map consistency
better than any adjective.

```
A 3×3 sprite grid of 9 [CUISINE] food items on a fully transparent background,
PNG with true alpha transparency. NO background, NO checkerboard, NO drop
shadows, generous empty spacing between sprites so nothing touches.

High-end mobile game collectible icon style. Cute, appetizing storybook
illustration with soft rounded, slightly plump proportions. Every item should
look delicious enough that you immediately want to eat it. Rich but believable
food textures, subtle glossy highlights, warm saturated colours, gentle warm
outlines, clean silhouettes and crisp edges.

The food should look authentic and traditional to its cuisine rather than
generic. Ingredients, garnishes, colours, serving vessels and preparation
methods should accurately reflect real dishes.

Lighting is warm and soft from above, with consistent lighting across every
sprite. Shapes are simple and readable at small sizes while preserving
mouth-watering detail when viewed large.

Every sprite is:
• front-facing or slight 3/4 front angle
• centred
• roughly as tall as it is wide
• consistent scale
• consistent level of detail
• isolated with plenty of transparent space around it

Avoid making grilled meats resemble burgers or steaks unless specifically
requested. Meat should have authentic cuts, natural shapes, caramelization,
char marks and realistic glaze.

Use fresh herbs, vibrant garnishes and natural colour variation to make the
food feel alive and freshly prepared.

Give each item a DISTINCT dominant colour, spread around the colour wheel, so
that no two items next to each other in the list below share a colour family.
The stated colour matters more than realism where the two conflict.

Prioritize recognizability, appetite appeal, and authentic cultural
presentation over strict realism. The result should look like premium artwork
from a polished mobile merge game.

ITEMS

Row 1:
• [Item 1 — colour]
• [Item 2 — colour]
• [Item 3 — colour]

Row 2:
• [Item 4 — colour]
• [Item 5 — colour]
• [Item 6 — colour]

Row 3:
• [Item 7 — colour]
• [Item 8 — colour]
• [Item 9 — colour]
```

### Why each part is there

- **"true alpha transparency … NO checkerboard"** — the AI will happily *paint*
  a grey checkerboard into the pixels and call it transparent.
  `chroma:'checker'` in `process_assets.py` rescues that, but not perfectly:
  faint flyaway detail painted over the checker (noodle strands, steam, fur) is
  ambiguous by construction and comes back as soft fuzz. Cần Thơ's noodle nest
  is the shipped example.
- **NO drop shadows, generous gaps** — technical, not taste. A shadow bridging a
  gutter breaks the band detection in `split_alpha_grid` and in the sprite
  editor's extract tab. A **glow is the exception and is welcome**: it is a
  pre-rendered blur the frame loop could never afford, and the sprite editor
  keeps a baked glow while dropping a baked shadow, splitting the two by colour
  (see "Strip baked shadow" in tools/README.md). So a sheet arriving with both
  is fine — but ask for gaps generous enough that the GLOW doesn't bridge them
  either.
- **"roughly as tall as it is wide"** — wide art needs `vis` rescaling and still
  reads small; non-round art needs capsule hitboxes, which is the main reason
  Melody Lane is the least-loved map.
- **Row-major order IS tier order**, and it is how the sprite editor's tier chain
  reads the folder. Escalate the elaboration across the rows, finale last.
- **The colour ladder is gameplay, not decoration.** At r15–r30 hue is what tells
  the player two items match. Paris pass 1 came back all red/brown/pink and
  needed a reroll; Cần Thơ shipped with pale pickles at tier 2 next to pale
  noodles at tier 3, which is the same mistake caught one tier apart. Name a
  colour per item. Farm's chain is the worked example:
  brown → green → red → blue → orange → yellow → purple → orange → gold.
- **The grilled-meat line** exists because a generic "grilled pork" prompt comes
  back as a burger patty.

### Structuring a food chain

Cần Thơ and Saigon both use **six ingredients then three plated dishes** — the
merge reads as causal, "make a dish from its ingredients", which is the thing
Mai singled out. Every other food map is just small food → big food.

Make the last three differ in **silhouette**, not only in size. Saigon escalates
by size (bowl → bowl → pot) and its two bowls read alike; Cần Thơ escalates by
how lavish the serving is (melamine bowl → patterned ceramic with prawn and
chả giò → full lacquer tray with side saucers), which stays distinct at a glance.

### Pick the realism axis deliberately — it is the biggest lever

The style block above descends from Paris, whose subject (pastries) suited
**illustration**. Food photographed rather than drawn is a different target, and
the two do not mix: Cần Thơ's shipped sheet is near-photoreal, and a second
generation from the template as written came back flat, plastic and simplified —
peanuts like beans, noodles like rubber tubing, pork back to generic patties.

The words that did it, all of them in the block above: **"cute"**, **"storybook
illustration"**, **"slightly plump proportions"**, **"collectible icon style"**.
Together they outvote "rich but believable food textures". For a photoreal food
map, replace that whole paragraph with something like:

> Photorealistic food photography, shot from above with soft diffused studio
> light. Real textures, real surface detail, natural imperfection. Not
> illustrated, not stylised, not 3D-rendered.

and keep only the technical clauses (transparency, spacing, framing, consistency).

**Do not write "where the stated colour and strict realism conflict, follow the
stated colour."** It reads as blanket permission to abandon realism and is what
tipped that generation over. Ask for the colour *within* the realistic
rendering: "choose a variety that is genuinely this colour."

That second generation also came back with an **opaque coloured vignette behind
every cell** despite "NO background, NO checkerboard" — so the transparency
clause is not reliable on its own. Ask for one flat pure-white background if
true alpha fails twice; `process_assets.py` keys white cleanly and has done
since the first map.

### Reroll policy

A **palette** nudge is cheap and safe. A whole-**finish** restyle is not: asking
for an existing grid again in a new finish comes back smaller and less intricate
than a first-pass generation (see "AI restyle-regeneration" in CLAUDE.md). Nail
style and colour spread in pass 1.

---

## Paris template (non-food subjects)

Paris was the template before the food one existed, and its item art is still
among the best in the game. Use it as the starting shape for a non-food map.

> A 3×3 sprite grid of 9 French pâtisserie items on a fully transparent
> background, PNG with alpha. Cute, elegant pastel storybook style: soft rounded
> plump shapes, gentle glossy highlights, pastel pink / cream / mint / lavender
> palette, subtle warm outlines. NO drop shadows, NO background, generous empty
> gaps between items so nothing touches. Row 1: a single sugar cube; a pink
> macaron; a petit chou cream puff dusted with powdered sugar. Row 2: … Row 3: …
> All items front-facing, consistent lighting from above, consistent style and
> level of detail across all nine.

The six slots that made it work:

1. **Grid + transparency** — proven wording, don't paraphrase.
2. **Style sentence** — 2–4 adjectives + surface finish + outline treatment.
3. **Pipeline constraints** — NO drop shadows, NO background, generous gaps.
4. **Row-by-row enumeration, one concrete named item per cell** — specificity is
   what stops the sheet drifting into mush.
5. **Escalating elaboration** across the rows, finale last.
6. **Consistency clause** — front-facing, light from above, same level of detail.

Add the three things Paris only got by luck: the **colour ladder**, **"compact,
front-facing, centred, roughly as tall as it is wide"**, and an **attached
reference sprite**. All three are already folded into the food template above.

---

## Backgrounds

Backgrounds are not part of a `PIPELINE` entry — they need no keying, only
recompression (`compress_backgrounds.py`). Two things the prompt must carry:

- **Portrait 2:3**, and the play surface occupying roughly the lower two thirds.
- **The play surface must be empty and unobstructed.** It gets traced as the
  physics boundary in the hitbox editor, and anything painted on it sits under
  the field reading as an obstacle that isn't there.

Cần Thơ's, which worked first time:

```
Portrait 2:3 illustration, storybook style, of the Cai Rang floating market in
Can Tho at early morning. The viewer stands on the flat wooden prow deck of a
small sampan, looking out over the brown Mekong river. The deck fills the lower
two thirds of the frame: worn pale wooden planks, completely empty and
unobstructed, narrowing to a gently rounded prow at the far end. Beyond it,
other wooden boats laden with pineapples, watermelons and rambutan, poles of
hanging produce, palm trees along the far bank, warm golden sunrise haze. Soft
warm colours, no people in the foreground, nothing resting on the near deck.
```

Give a map a boundary shape no other map has — Saigon is a round tray, Cần Thơ a
tapering boat deck. It changes how the pile behaves, so the map plays different
and not just looks different.
