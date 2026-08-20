# 🍹 Mixology Merge

A cozy Suika-style merge game, built as a gift for Mai. Shoot drinks onto a
bar table, merge matching pairs into bigger and better drinks, and try not to
let the table overflow.

**▶ Play it in your browser:** https://mikaelandblom-coder.github.io/Drink-merge-game/

<p align="center">
  <img src="assets/images/bg-main-menu.webp" alt="Mixology Merge main menu art" width="480">
</p>

## How to play

- **Aim and release** to shoot a drink onto the table.
- **Two drinks of the same kind merge** into the next tier — bigger drink, more coins.
- Higher tiers pay more, and chaining merges quickly can multiply your score
  (with **Combo multipliers** on).
- If the pile spills back past the danger line, the bar closes — **game over**.
- Your score is your coin total; each map keeps its own local high-score board.

## Maps

A world tour of flavours — each map has its own art, drink chain, music, and
sound theme:

| Map | Theme |
|---|---|
| Hawaii | Tiki Bar |
| Saigon | Pho House |
| Kyoto | Night Market |
| Mage Tower | Arcane Sanctum |
| Plushie Factory | Made for Mai |
| Melody Lane | Music Shop |
| Paris | Le Petit Café |
| Farm | Sprout Valley |
| Cần Thơ | Floating Market |

## Game modes

- **Combo multipliers** — fast successive merges stack a score multiplier.
- **Happy Hour** — customers queue up behind the bar and order drinks off your
  table. Serve them for coins, then merge the receipts they leave behind into
  a golden payout.
- **Large table** — some maps offer a bigger play area with its own high-score
  board.

## The toolkit behind it

The game ships with the three browser editors it was built with — no install,
no build step, they just run. Each one loads the game's *own* config and code,
so what they show is exactly what the game plays:

| Tool | What it does |
|---|---|
| [🎯 Hitbox editor](https://mikaelandblom-coder.github.io/Drink-merge-game/tools/hitbox-editor.html) | Trace a table's boundary, then shoot balls at it in real Matter.js physics |
| [🎛️ Sound lab](https://mikaelandblom-coder.github.io/Drink-merge-game/tools/sound-lab.html) | Every sound in the game, synthesised live — audition them and rewire which map plays what |
| [🖼️ Sprite editor](https://mikaelandblom-coder.github.io/Drink-merge-game/tools/sprite-editor.html) | Cut an AI-generated art sheet into individual drinks and tune the tier chain |

Or see them from inside the game:
[**?dev=1**](https://mikaelandblom-coder.github.io/Drink-merge-game/?dev=1)
adds a Dev tools row to the main menu, and
[**?hitbox**](https://mikaelandblom-coder.github.io/Drink-merge-game/?hitbox)
draws the collision shapes over a real run.

Saving changes back to disk needs a desktop browser; everything else works
anywhere, iPad included.

## Running locally

No build step — it's vanilla JS served as static files:

```
python serve.py
```

Then open http://localhost:5500. (`serve.py` is a plain static server plus a
`Cache-Control: no-cache` header — without it the browser happily serves a
stale `config/*.js`, which looks exactly like an edit that didn't work.)

## Tech

- [Matter.js](https://brm.io/matter-js/) — 2D physics (top-down, gravity off).
  Vendored in `vendor/`, so the game makes no cross-origin requests at all —
  a CDN having a bad day can't take it down.
- Canvas 2D — perspective-rendered table, drinks, particles
- Web Audio API — all sound effects are synthesised, zero audio files for SFX
- Python + Pillow + NumPy — asset pipeline for the AI-generated art

Made with ❤️ for Mai.
