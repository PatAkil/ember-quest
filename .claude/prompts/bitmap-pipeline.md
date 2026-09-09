# The sprite pipeline — option C: image-model bitmaps for every asset

Owner's decision (2026-09-09), after the frame test in ART-REVIEW.md: **C.** Every actor —
heroes, enemies, bosses — is an image-model-generated sprite used as a bitmap at its
on-screen size, not a hand-drawn grid and not the procedural kit. Playable characters get a
few more poses than enemies. This supersedes `pixel-pipeline.md` (option B, hand-drawn
grids), which stays in the repo as history; the kit (`game/art/parts.ts` / `actors.ts`)
stays as the fallback for any actor that has no bitmap yet.

Why: the generated EMBER (`tools/in/ember-gen-2.png`) shrunk to hero size and drawn at
one screen pixel per pixel kept its face, trim, belt and boots on the lit stage, while
the 2-px intake grid of it lost them and read coarser than the reference. The on-screen
size is what makes it read like Octopath; the 2-px grid was a pipeline convention.

## Read order for a fresh session

1. `STATUS.md`; 2. this file; 3. ART-REVIEW.md's "Frame test" and the decisions before it;
4. CLAUDE.md's engine table (`engine/draw.ts` `drawBaked`, `engine/light.ts`,
`game/art/actors.ts` `drawActor` / `actorHitRect` / `ACTOR_SCALE`), `tools/intake.mjs`,
`tools/lineup.ts`, `tools/capture.mjs`, `tools/seats.mjs`.

## The asset spec

- **Source**: one PNG per (actor, pose, frame) from the image model, the figure on a flat
  solid green (#00FF00), facing RIGHT, feet at the bottom centre, nothing else in frame,
  the whole figure including weapons inside the canvas with a margin. 1024-px output;
  the figure 110–160 painted pixels tall reads well after the shrink (finer is fine,
  coarser than ~90 is not). Costume, palette and proportions locked by the master frame.
- **Display size** (the shrink target, one screen pixel per pixel, `ACTOR_SCALE 1` for
  bitmaps): heroes 112 px tall; ordinary enemies 72–112 by kind (small 72, medium 96,
  large 112); elites 128; bosses 192 (`BOSS_W` stays 192 wide). Widths follow.
- **Poses**: heroes and bosses — idle ×2, attack ×2 (wind-up, strike), cast, hurt, dead;
  elites — idle, attack, hurt, dead; ordinary enemies — idle, attack, hurt (dead reuses
  hurt tinted and sunk, as the kit does). Idle B is the breath frame.
- **Repo layout**: masters and pose sources in `tools/in/<ID>/<pose>-<n>.png` (tracked;
  the model's output is the master copy); shrunk, keyed sprites in
  `game/art/bitmap/<id>/<pose>-<n>.png` (tracked, a few KB each) with
  `game/art/bitmap/index.ts` as the registry: `{ id, height, feet, hit, hitSize,
  poses: { idle: [url, url], attack: [...], … } }` built from Vite asset imports.
- **Intake** (`tools/intake.mjs bitmap …`, to be added): key the green by hue and
  saturation (the model's green wobbles ±20 RGB; the corner key fails), crop to the
  opaque bbox, area-downscale in two steps to the class height, snap alpha at 0.45,
  write the PNG and print bbox/feet/hit/value stats (median L*, % below 35, % above 75)
  so the sheet rulers still apply. No palette snapping.
- **Engine** (`actors.ts`): a bitmap branch in `drawActor` — decode once at boot, draw
  1:1 with `drawBaked` at scale 1 anchored at `feet`, `flipX` for `facing −1`,
  `DEAD_ALPHA` on dead; `actorHitRect` from the registry; `bakePose` returns the bitmap
  so `tools/lineup.ts`, `capture.mjs sheets` and `seats.mjs` measure bitmaps like kit
  actors. Status tints (BURN, IMMUNITY, INVINCIBLE) as the existing per-actor overlays.

## Generation prompts

**Master** (one per character; the six hero briefs are in `art-round.md`'s roster or
DESIGN.md's Characters table):

```
A single 16-bit JRPG character sprite in the Octopath Traveler HD-2D style, full body,
standing idle, facing RIGHT, feet at the bottom centre, on a flat solid bright green
background (#00FF00), nothing else. Clean pixel art: hard-edged pixels, a one-pixel dark
keyline, three or four tones per material with cooler shadows and warm highlights, no
anti-aliasing, no gradients, no dithering. Chibi proportions, about three heads tall,
a compact hair mass, hands drawn, tapered legs, dark boots. <character brief>
```

**Pose** (image-to-image from the master, one per pose; keep the wording identical
across a character so the costume holds):

```
Redraw this exact character — same costume, colours, proportions and pixel style, same
green background, still facing right, feet at the bottom centre — in this pose:
<pose>. Keep the weapon and every costume detail.
```

with `<pose>` one of: "a subtle breathing idle, shoulders and hair slightly lifted" ·
"wind-up before an attack, weapon drawn back, weight on the back foot" · "the strike,
weapon swung forward with the body leaning in" · "casting, weapon raised overhead,
the flame doubled" · "recoiling from a hit, head back, one foot off the ground" ·
"collapsed on the ground, defeated, the weapon dropped beside them".

## Stages

**Stage 0 — the bitmap branch** (Sonnet with a verifier): the intake's `bitmap` mode,
the registry, `drawActor`'s branch, `lineup`/`capture`/`seats` reading bitmaps. Gate:
check, build, smoke, `capture.mjs sheets` with EMBER's master registered as its idle.
**Stage 1 — EMBER's poses**: the owner generates the seven pose sources from
`tools/in/ember-gen-2.png`; intake; a blind Opus critic judges them in
`capture.mjs battle seed=1` frames — do the frames read as one character, does it move.
Fix by regenerating a pose, never by hand-editing pixels.
**Stage 2 — the other five heroes** (master + poses each), one critic over the six on
the sheet (silhouettes distinct) and in frame.
**Stage 3 — enemies of acts 1–2** at their class heights, then bosses at 192.
**Stage 4 — acts 3–6** with the biomes, then the full-frame critic's next round.

## Method

Files are owned, never shared; every writer gets a blind verifier; critics on Opus;
mechanical work on Sonnet; the owner generates (the image model is on the owner's side)
and attaches PNGs as files; gates as in STATUS.md; DESIGN.md's "Layered actors" is
amended when stage 0 lands (bitmaps at ×1 beside the kit at ×2 until the kit is
retired); never push main without the owner's word.
