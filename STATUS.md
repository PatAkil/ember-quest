# Ember Quest v3 — status (checkpoint 2026-09-05)

Branch `claude/fable-credits-reset-wbtv7t`. The v3 rebuild (3v3 ATB battles,
rolled relics, 1280×720 HD-2D, native touch) from the contract in DESIGN.md.
`main` still serves playable v2. This file is the hand-off for a fresh
session: what is done, what is honest, what is next, in order.

## Run it

```
npm run dev      # Vite on :5173 (strictPort); every save hot-reloads
npm run check    # tsc --noEmit — after every edit
npm run build && npm run smoke   # before every commit (smoke needs the dev server)
npm run sim      # --battles: the act-1 fixtures per policy; --runs N once sim/run.ts lands
```

Playable at http://localhost:5173/: title → five-room slice (FIGHT · FIGHT ·
LOOT · FIGHT · BOSS in the EMBER CRYPT) → relic cards and who-wears-it →
GAME OVER / VICTORY. Touch and keyboard (arrows, A = Space/Z, B = X/C,
1/2/3 skills, P/Esc pause).

## Done

| Phase | State |
|---|---|
| 0 Contract | DESIGN.md through five blind review rounds plus a scoped sixth; log in DESIGN-REVIEW.md; no open questions (owner decided all four) |
| 1 Engine | 1280×720 CSS-fitted canvas, FONT_HD 7×11 with a glyph atlas, baked sprites, pointer input + hit regions (TAP_MIN 96, drawn-first test, keyboard parity), mutable safe inset, CRT retune, mobile shell, `pickBackingScale` |
| 2 Combat | `game/sim/battle.ts`: ATB, the ten-step turn, every status, the glance model, sets, sigils, counters, AI + intent, scaling, `simulateBattle`, the interactive API (`createBattle`/`nextReady`/`runTurn`/`battleOutcome`) with a structured event stream; verified against the contract (three fixes applied); harness `--battles` |
| 2 Data | Acts 1–2 authored (EMBER CRYPT, FROST MARSH), `validateData()` clean |
| 3 Relics | `game/sim/relics.ts`: rolling in the contracted draw order, levels, forge, sets, `derive`, `compare`; 60 644-check self-test |
| 4 Battle screen | `game/screens/battle.ts` + `layout.ts`: ribbon with forecast and intents, panels, diagonal stage, event playback with VFX and juice, skill bar and target flow, PAUSE and INSPECT |
| 4 Run flow | `game/screens/run.ts`, `cards.ts`, `title.ts`, `end.ts`, `main.ts`: the slice, drops with pity, who-wears-it via `compare`, score, heals, KO return, runtime messages, Home-Screen hint |
| 4 Art | `game/art/parts.ts`, `actors.ts`, `vfx.ts`: layered parts with four-shade ramps and auto-shading, recipes and rigs for every hero and act 1–2 enemy at ×2, procedural VFX per skill; two critic rounds logged in ART-REVIEW.md |
| 7a/7b Scene | `engine/light.ts` + `game/art/backdrops.ts`: diorama planes, key/rim/pool light, shafts, bloom, grade, contact shadows, tiers (HIGH 7.3 ms on headless Chromium) |
| Sound | `engine/audio.ts`: 24 synthesized sfx through a limiter |

## Honest state

- The art is the make-or-break item and is not at the Octopath bar yet.
  Round 1 scored 4/10; round 2 (hands, faces, folds, ×2 density, contrast)
  is committed; the critic's round-2 verdict and round-3 list are in
  ART-REVIEW.md. Loop until the critic says SHIP.
- The battle screen's scene integration and HUD restyle (vector HUD font,
  translucent plates, portrait ribbon) were the last work in flight at this
  checkpoint — see the git log for whether they landed; the cards, title
  and end screens still use the bitmap font in boxes and need the same
  restyle.
- Balance is untuned: at A0 the bare slice party wins every act-1 fixture,
  including the boss, under random play. Phase 8 owns this; the levers are
  named in DESIGN.md.
- Not tested on a phone viewport; the ARCADE toggle is wired but unverified;
  relic-wearing fixtures (BULWARK, sets, sigils) are exercised only by the
  relic self-test, not in play.
- `game/sim/run.ts` (phase 6a: map, rooms, laps, Vault, policies,
  `simulateRun`, `--runs`/`--spd`) was in flight at this checkpoint.

## Next, in order

1. Read ART-REVIEW.md's latest verdict; run art round 3 on Opus (artist) +
   a blind critic; repeat until SHIP. Then a full-frame critic against the
   owner's four Octopath references (sprites, scene, UI, VFX, composition
   each ≥ 8).
2. If the scene integration did not land: wire `engine/light.ts` into
   `screens/battle.ts` (background → contact shadows → actors → light plane
   → VFX → post → HUD) and restyle the HUD per DESIGN.md's "Two kinds of
   text". Then the same restyle for cards, title and end screens.
3. VFX under bloom: particle-based skill effects (`game/art/vfx.ts`).
4. A full adversarial playthrough of the slice (Playwright): every screen,
   every card count (1/2/3), decline paths, GAME OVER and VICTORY, a phone
   viewport, ARCADE on.
5. Phase 5 (draft, opening SUMMON, leader seat, swaps, party screen) and 6a
   screens (the map, SHRINE/FORGE/ALTAR/REST, laps, the Vault) over the
   headless `sim/run.ts`; 6b biomes for acts 3–6.
6. Phase 8: `npm run sim -- --runs` against the ladder; rewrite Balance state.

## Conventions that matter

Headless boundary (`game/data`, `game/sim` never touch the engine, DOM or
`Math.random`); every draw through `game/sim/rng.ts`; DESIGN.md moves with
the code; commit at green milestones, unsigned; push = the feature branch
only, never main. Writers own files, never share one; every writer gets a
blind verifier; art rounds alternate artist and critic on the strong model.
