---
name: ensuring-arcade-visuals
description: Use when creating or editing a game's visual presentation, or when a game looks flat, modern, or off-brand. Ensures the arcade-cabinet look — palette discipline, low pixel resolution, ASCII sprites, retro bitmap text, CRT filter, ambient particles.
---

# Ensuring arcade visuals

This skill covers the game's **look** only. Readability and HUD margins are *quality* concerns — they live in **improving-game-quality**, which owns the only quality checklist. Do not duplicate those checks here; defer to that skill.

**Engine note:** this repo carries its own copy of the engine, forked from Retrovibe for one game. Engine edits are allowed here (they only affect Ember Quest); verify them by building, running the smoke gate, and looking at the game — there is no fixture loop in this repo.

All engine imports come from the barrel: `import { ... } from '../engine';`. The contract is DESIGN.md's *Presentation* section; `game/art/parts.ts`, `game/art/actors.ts` and `game/screens/*.ts` become its reference implementations once phase 4 lands. After every edit: `npm run check` (repo root).

## 1. Canvas and scale — 1280×720, one pixelated plane

**1280×720 logical, landscape.** The canvas is fitted by CSS (letterboxed `aspect-ratio: 16 / 9`, never its intrinsic size) with `image-rendering: auto` — crispness comes from the integer scale *inside* the frame, never the frame itself. The backing store is ×1 everywhere; ×2 only when `devicePixelRatio >= 1.5` **and** the fitted CSS width is at least 1280 (`pickBackingScale`), chosen once at boot.

This frame calls `createPixelCanvas({ smoothing: true })`: everything is smooth by default. The governing rule is one line long — **exactly one plane is pixelated**: the actor plane, hard-pixelled around its own `drawImage` calls only (`drawBaked` and `drawText` already force smoothing off and restore it after). Light, particles, fog, UI and text all render smooth. A frame that looks soft everywhere, or crisp everywhere, has broken this rule.

```ts
import { createPixelCanvas, pickBackingScale, drawBaked, drawTextCentered, FONT_HD } from '../engine';

const pc = createPixelCanvas({ width: 1280, height: 720, scale: pickBackingScale(cssWidth), smoothing: true });
// ...soft diorama planes, light and particles drawn straight onto pc.ctx...
drawBaked(pc.ctx, heroBitmap, feetX, floorY, { scale: ACTOR_SCALE, originX: 32, originY: 64 }); // the one hard-pixel draw
drawTextCentered(pc.ctx, 'HOLLOW KING', 1280, 40, { font: FONT_HD, scale: TEXT_LABEL, color: PAL[7] });
```

## 2. HD-2D — five passes, hard pixels under soft light

The reference is Octopath Traveler. In order: (1) **diorama planes** — background/midground/actor/foreground, each parallaxing at its own rate; (2) **depth of field** — background and foreground blurred, the actor plane razor sharp; (3) **chunky actors** — parts authored at `ACTOR_PART = 64` px (`BOSS_PART = 96`), drawn at `ACTOR_SCALE = 3` with smoothing off, ≤ `ACTOR_W = 192` wide (a boss ≤ `BOSS_W = 288`) — the only hard-pixel plane; (4) **light at native resolution** — a per-biome key light as radial gradients, rim light along actor silhouettes, embers/dust/fog as smooth alpha particles composited with `'lighter'`; (5) **colour grading** — a cached `'multiply'` shadow tint (carries the vignette) plus a cached `'screen'` highlight tint, baked into the planes when the biome is built.

## 3. Budget and tiers — bloom XOR CRT halation

One full-screen alpha pass at logical 720p is **one FSE** (0.92 Mpx; a ×2 backing quadruples it, hence ×2 is desktop-only).

| Tier | FSE | Where |
|---|---|---|
| HIGH | ≈8.5 (+1 in a flash) | desktop default |
| MED | ≈6.1 | phone default |
| LOW | ≈3.1 | auto after 60 consecutive frames > 20 ms; never rises |
| ARCADE | ≈9 | the toggle |

**Bloom and CRT halation are the same effect: exactly one is on.** HIGH/MED/LOW never call `crt.render`; only ARCADE runs the full CRT (halation, lift, scanlines, vignette) over LOW's planes. Blurred planes pre-render once per biome to offscreens and redraw at a new offset; bloom runs through a quarter-res offscreen allocated once; key-light and grading gradients are cached per biome and animated with alpha/translate only. `getImageData` never runs in the frame loop, and nothing else allocates per frame either (pops `POP_MAX = 16` pooled, the log keeps `LOG_KEEP = 32` lines).

## 4. Layered actors — recipes baked to atlases

A character is a **recipe**, not a picture: body, head, torso, weapon, cape — each an ASCII part from a shared library with **anchor points**, so a weapon stays in a hand across an animation. Animation is per-layer transform keyframes stepped at `POSE_FPS = 12`, rotation in 90° steps; element tint is a palette swap per layer at bake time (`tintSprite`); rim light applies to the composed silhouette. Parts bake lazily per (part, element) into **one atlas per element** (1024×1024) — never a canvas per part; a pose composes at part resolution, rim light included, only when its keyframe changes; the frame draws one `drawImage` per actor at `ACTOR_SCALE` (`bakeSprite`/`drawBaked`). Text goes through a glyph atlas the same way (§6).

## 5. Contrast and safety — unchanged from v2

`contrast()` (from the barrel) is still the gate: every gameplay-critical color needs `contrast(entity, surface) >= 3.0` against every static surface it overlaps — but **on any clear color other than pure black the authored floor is 4.5:1, not 3.0**, because the CRT lift eats ~1.4× of whatever ratio you author and the 3.0 floor only holds on pure black. Ambient particle colors sit in a **1.8–2.5:1** band against the clear color. Red-vs-green may never be the *only* distinction between critical entity classes — require two of hue family, brightness, silhouette, and check the pairing in grayscale. None of these numbers move for the HD frame; they are why the light and grading passes in §2 must never wash an actor's authored color into its background.

## 6. Text — nothing renders below scale 2

The 720p frame's face is `FONT_HD` — 7×11, mixed case, 99 glyphs, descenders, a slashed zero — selected per call via `TextOptions.font` (the engine default stays `FONT_RETRO`; every v3 screen passes `font: FONT_HD`). Sizes: `TEXT_POP 3` (crits 4) · `TEXT_LABEL 3` (skill labels, the current actor, door and card titles) · `TEXT_BODY 2` (everything else) — **nothing renders below scale 2**, because HD's stems and bowls close up under it. Text still costs one `drawImage` per glyph from a cached per-(font, scale, colour) atlas, never a per-pixel draw; an outline is honoured from `scale >= font.outlineMinScale`, which is **1** for `FONT_HD` (vs `FONT_RETRO`'s 3) — so headline text keeps its keyline at any HD size instead of degrading to a shadow.

## Visual pass checklist (look only)

- [ ] Canvas is 1280×720 logical, fitted by CSS letterboxing, backing scale from `pickBackingScale` (§1).
- [ ] Exactly one plane is pixelated — the actor plane at `ACTOR_SCALE = 3`, smoothing forced off around it only; light, particles, fog, UI and text render smooth (§1).
- [ ] All five HD-2D passes present: diorama planes, depth of field, chunky actors (`ACTOR_PART`/`BOSS_PART`, `ACTOR_W`/`BOSS_W`), native-res light, cached colour grading (§2).
- [ ] Frame cost sized to its tier's FSE budget; bloom and CRT halation are never both on; HIGH/MED/LOW never call `crt.render` (§3).
- [ ] Actors are layered recipes with anchors, `POSE_FPS = 12` per-layer keyframes, element tints via `tintSprite`, parts baked lazily into one atlas per element (§4).
- [ ] Every gameplay-critical color clears `contrast() >= 3.0` vs surfaces it overlaps (4.5:1 on any non-black ground); ambient in the 1.8–2.5:1 band; red/green never the sole distinction (§5).
- [ ] Text uses `FONT_HD`; nothing below scale 2 (`TEXT_BODY`); labels at `TEXT_LABEL`, pops/crits at `TEXT_POP` (§6).
- [ ] `npm run check` (repo root) passes.
