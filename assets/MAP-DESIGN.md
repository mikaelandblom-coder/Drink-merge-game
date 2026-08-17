# Map design documents

**Every map gets one: `assets/source/<map-id>/DESIGN.md`.** It sits next to the
art masters it describes, the way `ART-PROMPTS.md` sits next to the art it
prompts. Napoli (`assets/source/pizza/DESIGN.md`) is the worked example.

Convention adopted 2026-08-16, at Mikael's ask. Maps built before that date do
not have one and are not owed one retroactively — write one if a map is being
substantially reworked, otherwise leave it.

---

## Why this exists, and what it is NOT

A map is roughly a week of decisions that leave almost no trace in the code. The
tier chain ends up as nine lines of config; the reason those nine subjects and
that colour order were chosen ends up nowhere. Then a year later someone asks
"could we make the olives brighter" and there is no way to know that the ladder
is the thing keeping tiers 2 and 4 apart.

**Record the decision and its reason, not the outcome.** `config/items.js`
already says the olive is `#2a1d33`. What it cannot say is that the whole ladder
is spread around the colour wheel because hue is what tells a player two items
match at r15–r30.

**It is not a changelog.** `git log` covers what changed when, and does it
better. This is the standing explanation of why the map is shaped the way it is.

**Lessons that generalise do NOT live here.** If a thing is true of every map it
belongs in `CLAUDE.md` (mechanics, pipeline, engine) or `ART-PROMPTS.md`
(prompting), and the map doc just links to it. Otherwise the nine map docs
slowly become nine copies of the same advice, drifting apart — the exact failure
that made the sound lab's hand-copied synth voices worth deleting. A map doc
should be almost entirely things that are true of *this map only*.

---

## Sections

Keep them in this order. Drop one only if it is genuinely empty.

**1. What this map is.** Id, label, sublabel, and a paragraph on the fantasy —
what the player is doing and where. Say why the map exists at all: the pitch, or
whose idea it was.

**2. The tier chain.** The ladder in order, with the reasoning behind it: the
merge arc (ingredients into a dish? small thing into big thing?), the colour
ladder, and how the top tiers stay distinguishable. Note anything the art is not
allowed to do.

**3. The play surface.** The boundary's shape and why it is unlike every other
map's — a map should play different, not just look different. Horizon and
danger-line notes go here.

**4. Engine features this map turns on.** `spin`, `flat`, `fx`, `sizes`,
`combos`, custom `coin`/`bag`, a `SOUND_MAP` row. One line each on WHY, since
each is opt-in per map and the default is off.

**5. Prompts, as actually sent.** All three of them — **item grid, background
and BGM** — plus how to judge what comes back. Generations are limited, so a
prompt that worked is an asset. The music one is the easiest to forget, because
it is the only asset that isn't a file in `assets/source/`; a map doc with two
prompts in it is missing one.

**6. Challenges.** The load-bearing section — the reason Mikael asked for these
docs. For each one: what the symptom looked like, what the cause turned out to
be, and the measurement that proved it. A challenge with a fix but no diagnosis
is the one that comes back.

Two things worth writing down that feel too small at the time: **anything that
looked like a bug and wasn't**, and **anything tried and rejected** — including
whose call it was. Kyoto's sakura effect is the standing example: it is switched
off in config with a comment, and without that comment someone would "fix" it
back on every six months.

**7. Open questions and still-to-do.** What is knowingly unfinished, and what is
a real question versus a placeholder. Mark who a question belongs to when it is
a taste call rather than a technical one.

---

## When to write it

**Start it with the map, not at the end.** The challenges section is the whole
point of the document and it is exactly the part that cannot be reconstructed
afterwards — by the time a map ships, the two days lost to a mis-specified
camera angle have compressed into "the background needed a reroll".

The prompts get written before the art anyway. Add to the challenges section the
day a challenge is solved, while the measurement is still in the terminal.
