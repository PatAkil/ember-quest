# tools/in — the generated masters and pose sources (tracked)

The image model runs on the owner's side. Every PNG it produces for the game lands here,
one file per (actor, pose, frame), then goes through the intake into `game/art/bitmap/`.
Attach files in the session (pasted screenshots do not reach the disk) or commit them here.

## Layout

```
tools/in/<ID>/<pose>-<n>.png      e.g. tools/in/EMBER/attack-0.png
```

`<ID>` is the actor id in `game/data/characters.ts` / `enemies.ts` (EMBER, GALE, TIDE,
BASALT, SABLE, LUMEN, …); `<pose>` is idle | attack | cast | hurt | dead; `<n>` the frame.
The first master frame of EMBER predates the layout and stays at `tools/in/ember-gen-2.png`.

## Intake

```
node tools/intake.mjs bitmap tools/in/<ID>/<pose>-<n>.png id=<ID> pose=<pose> frame=<n> [class=hero|small|medium|large|elite|boss]
```

Keys the green by hue and saturation, crops, shrinks to the class height (hero 112), snaps
the alpha, writes `game/art/bitmap/<id>/<pose>-<n>.png`, updates `manifest.json` and
regenerates `registry.ts`. The older grid intake (`node tools/intake.mjs <file>.png
id=<ID>_GEN bg=auto`) is the superseded option B and still runs.

## What to generate

- Heroes and bosses: idle ×2 (the master is idle 0; idle 1 is the breath), attack ×2
  (wind-up, strike), cast, hurt, dead — seven frames.
- Elites: idle, attack, hurt, dead. Ordinary enemies: idle, attack, hurt.
- Source: 1024-px output, the figure on a flat solid green (#00FF00-ish — the exact shade
  does not matter, the intake keys by hue), facing RIGHT, feet at the bottom centre,
  nothing else in frame, the whole figure and weapon inside the canvas with a margin.

## The master prompt (one per character)

```
A single 16-bit JRPG character sprite in the Octopath Traveler HD-2D style, full body,
standing idle, facing RIGHT, feet at the bottom centre, on a flat solid bright green
background (#00FF00), nothing else. Clean pixel art: hard-edged pixels, a one-pixel dark
keyline, three or four tones per material with cooler shadows and warm highlights, no
anti-aliasing, no gradients, no dithering. Chibi proportions, about three heads tall,
a compact hair mass, hands drawn, tapered legs, dark boots. <character brief>
```

Replace `<character brief>` with the line for the character:

| ID | Element | `<character brief>` |
|---|---|---|
| EMBER | FIRE | A fire mage: an ember-red mane of hair, bare arms with leather bracers, a red vest with orange trim over a light shirt, dark trousers, and a wooden staff taller than the figure with a flame burning at its tip. (The accepted master is `tools/in/ember-gen-2.png`.) |
| GALE | WIND | A wind rogue: a windswept short crop of pale-green hair, a long scarf streaming out behind, a green tunic with a darker shade side, lean forward stance, and twin daggers with dark grips and crossguards, one in each hand. |
| TIDE | WATER | A water healer: a deep hood shadowing the face, a floor-length pale robe over teal with a wave-pattern hem, both hands cradling a glowing blue water orb at the chest. |
| BASALT | FIRE | An armoured knight: a slit-visored helm, heavy pauldrons wider than the helm, dark basalt-grey plate with warm ember-orange accents, a tall tower shield with rounded lower corners and a central boss on one arm, a mace in the other hand. |
| SABLE | DARK | A dark hexer: a pointed hood with two glowing violet eyes inside it, a knee-length plum-black cloak draping onto the shoulders, and a curved dagger held low and ready. |
| LUMEN | LIGHT | A light archer: long cream-gold hair under a faint gold halo, a white robe with a gold-trimmed mantle of two clean shoulder plates, and a bow as tall as she is held upright in one hand. |

## The pose prompt (image-to-image from the character's master)

Keep the wording identical across a character so the costume holds:

```
Redraw this exact character — same costume, colours, proportions and pixel style, same
green background, still facing right, feet at the bottom centre — in this pose:
<pose>. Keep the weapon and every costume detail.
```

| File | `<pose>` |
|---|---|
| `idle-1.png` | a subtle breathing idle, shoulders and hair slightly lifted |
| `attack-0.png` | wind-up before an attack, weapon drawn back, weight on the back foot |
| `attack-1.png` | the strike, weapon swung forward with the body leaning in |
| `cast-0.png` | casting, weapon raised overhead, the magic doubled |
| `hurt-0.png` | recoiling from a hit, head back, one foot off the ground |
| `dead-0.png` | collapsed on the ground, defeated, the weapon dropped beside them |

A pose that fails the critic is regenerated, never hand-edited.
