# The sprite pipeline — option B: heroes and bosses drawn by hand, the kit for the rest

Owner's decision (2026-09-06), after the pixel study: **B, staged.** The six heroes and the
6 bosses are redrawn by hand as direct pixel grids at the kit's own 2-px cell; the
ordinary enemies stay on the procedural kit (`game/art/parts.ts` / `actors.ts`) with the
palette hole fixed in the engine. Each stage is judged in a real battle frame before the
next starts, and every stage is reversible because hand-drawn and kit actors share the
stage through one draw path.

Why: thirteen kit rounds reached 9/10 on every ruler and still read "a bit off" beside
Octopath; the study (`tools/study.html`, `game/art/pixel/ember-study.ts`) drew EMBER's idle
by hand at the same cell with the same colours and it reads as the reference's kind of
object at the on-screen size. The kit was the ceiling. Evidence and numbers: ART-REVIEW.md,
"The pixel study (after round 14)" and "Coordinator decisions after round 14".

## Read order for a fresh session

1. `STATUS.md` (the state, the commands, the conventions, the session mechanics).
2. This file.
3. ART-REVIEW.md: the ship criteria and rulers at the top, "The pixel study" at the end,
   the decisions after rounds 11–14 (the instrument, the ceiling, the palette hole).
4. `game/art/pixel/ember-study.ts` — its header is the alphabet, the palette method and the
   keyline rule; `tools/study.ts` is the sheet.
5. CLAUDE.md's engine table: `engine/draw.ts` (`makeSprite`, `bakeSprite`, `drawBaked`),
   `game/art/actors.ts` (`drawActor`, `bakePose`, `actorHitRect`, `ACTOR_SCALE`, `POSE_FRAMES`,
   `POSE_FPS`, `DEAD_ALPHA`), `tools/lineup.ts`, `tools/capture.mjs`, and the instruments
   under `tools/` (`seats.mjs`, `rulers.mjs`, `probe.mjs` — see STATUS.md "Run it").
6. The references: `tools/ref/` is gitignored; put the four Octopath screenshots there and
   cut the crops with the rectangles in commit 98464a4's message (or `tools/probe.mjs crop`).

## The craft, in one place (from the study; the critic judges against this)

- One cell = 2 screen px; a figure 52–58 rows tall, at most 64 × 48 cells; feet at the
  bottom centre; authored facing RIGHT (the battle mirrors heroes).
- A full 1-px keyline: near-black with a slight hue on garments and boots, the material's
  own dark step on light hair, dark brown on skin; interior lines wherever a form turns.
- Proportions like the reference: the head close to a third of the height (the study is
  slimmer than Octopath's chibi build — correct that on the master frame first).
- Three to four hard-edged tones per material, clean clusters, no dithering; folds and
  accents (collar, cuffs, belt, buttons) as 1-px marks; hands drawn; tapered legs; dark boots.
- Value: the figure sits DARK on the ground — p50 L* ≈ 31–40 with ≥ 45 % of cells below
  L 35 and only the highlights above L 75 (the Temenos crop: 37 / 45 % / 11.5 %).
- Colours: the character's own ramps (`paletteOf(ACTOR_RECIPES.<ID>)`) plus an outline and
  the shadow steps the kit lacks (L* 35–48); about 24 colours per actor.
- Every sheet criterion still applies (ART-REVIEW.md): one 8-connected component per
  non-dead bake, settle 20–39 %, idle change ≥ 17 %, the crown rising ≥ 1 cell on hurt 0,
  dead height 25–57 % of idle, mirror IoU < 85, nearest-pair IoU < 78 (target ≤ 65 among
  the heroes: a brim, a horned helm, a coat with tails, a half-cape — no two heroes share
  an outline), palette overlap < 25 %.

## The stages

**Stage 0 — the grid branch (engine, small, Sonnet-class with a verifier).**
A `PixelActor` shape (`id`, `map`, `poses` with 3 frames per pose, `feet`, `hit`,
`hitSize`) and a registry `game/art/pixel/index.ts` keyed by actor id. `drawActor` in
`actors.ts` consults the registry first: bake each (pose, frame) once through
`makeSprite → bakeSprite(…, 1)`, draw with `drawBaked` at `ACTOR_SCALE` anchored at `feet`,
`flipX` for `facing === -1`, `DEAD_ALPHA` on the dead pose; `actorHitRect` reads the grid's
`hit` / `hitSize`; `bakePose` returns the grid's bake so `tools/lineup.ts`, the sheet
metrics and `tools/seats.mjs` measure hand-drawn actors exactly like kit ones. The kit is
untouched. Gate: `npm run check`, `npm run build`, `npm run smoke`, `capture.mjs sheets`
43 PASS with EMBER_STUDY registered as EMBER's override behind a flag, `seats.mjs` on
crypt seeds 1, 4, 12, 16, 20.

**Stage 1 — EMBER, the fourteen frames (one Fable artist; resume the study's method).**
Master-frame refinements first (proportions, skin keyline, two more fold clusters, denser
strands), then: idle 1–2 (a one-cell breath in hair and shoulders, the flame flickering),
attack 0–2 (wind-up, a staff thrust with the body leaning in and the strike travelling
4–8 cells, recover), hurt 0–2 (recoil, head tilted back, the crown up ≥ 1 cell on frame 0),
cast 0–2 (staff raised, the flame doubled), dead 0–2 (folding to the ground, the staff
dropped). All fifteen as grids in the same alphabet. Judged by a blind Opus eye-critic on
`tools/study.html` at zoom 2 on `bg=b9a98a`, and in `capture.mjs battle seed=1` frames at
1:1 and 2× — does it read as the reference's kind of object, and does it MOVE like one.
Done when the critic says SHIP for EMBER in play and every ruler passes.

**Stage 2 — the other five heroes** (GALE, TIDE, BASALT, SABLE, LUMEN), one file each under
`game/art/pixel/`, one Fable artist per one or two heroes, in parallel, each with its own
verifier; one critic over the six together on the sheet (silhouettes ≤ 65 % nearest IoU)
and in the frame.

**Stage 3 — the bosses** (HOLLOW_KING, PALE_SAINT, SKYFALLEN_KING, FORGE_SAINT, SUNKEN_KING, SPIRE_SERAPH): the boss canvas is 96 cells
(`BOSS_PART`), same craft, same gates; the full-frame critic's composition items apply.

**Stage 4 — the rest stays on the kit** with the engine's value-law fix (STATUS.md Next,
item 2: contrast measured against the lit ground, not the navy, so shadow steps at
L 35–48 are legal), then the full-frame critic's round 5. Hand-draw an ordinary enemy only
if the frame still reads wrong beside the hand-drawn party.

## Method (unchanged from the build)

Writers own files and never share one (one file per actor); every writer gets a blind
verifier; Fable for the drawing, Opus for critics and scene work, Sonnet for mechanical
work; parallelise by file ownership. Gates: `npm run check` after every edit; `npm run
build` and `npm run smoke` before every commit, `capture.mjs sheets` for art commits,
`npm run sim` when rules or numbers move; commit unsigned and pathspec-scoped at green
milestones and push the branch; keep DESIGN.md true to the code; never claim to have
playtested; report the honest state and send the owner sheets and frames as they improve.
**Main deploys to GitHub Pages on push** (`.github/workflows/pages.yml`, the live game at
https://patakil.github.io/ember-quest/): push main only on the owner's instruction.
Agents: start the session with ember-quest as the primary repo, or run every writer,
verifier and critic as a `general-purpose` agent with an explicit model. Isolate verifiers
and critics on a detached worktree of HEAD on their own port; never touch :5173.
