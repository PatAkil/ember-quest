# Ember Quest v3 — status (checkpoint 2026-09-06)

Branch `claude/fable-credits-reset-wbtv7t`, draft PR #1 against `main`
(`main` still serves playable v2; never push main, never deploy). This file
is the hand-off for a fresh session: what is done, what is honest, what is
next, in order. The contract is DESIGN.md; the art loop's log is
ART-REVIEW.md; the prompts that define the job are `.claude/prompts/`.

## Run it

```
npm run dev                      # Vite on :5173 (strictPort); every save hot-reloads
npm run check                    # tsc --noEmit — after every edit
npm run build && npm run smoke   # before every commit (smoke needs the dev server)
npm run sim                      # act-1 fixtures per policy; --runs N [--seed S] the ladder;
                                 # --battles --runs N; --vault N; --selfcheck; --dump
node tools/capture.mjs sheets | battle seed=N | phone | play | playfull [acts=1] [phone=1] [ko=1] [seed=N] | shot url=…
```

Playable at http://localhost:5173/: title → draft (three of six, leader
seat) → the branching map through six acts (FIGHT · ELITE · SUMMON · LOOT ·
SHRINE · FORGE · ALTAR · REST · BOSS) → the doors (lap or bank) → the Vault
between runs → GAME OVER / VICTORY. Touch and keyboard (arrows, A =
Space/Z, B = X/C, 1/2/3 skills, P/Esc pause, I inspect).

Fixture harnesses (no game state): `tools/lineup.html` (every actor, every
pose, ×N), `tools/vfx.html` (every skill effect), `tools/backdrops.html`
(six biomes, three tiers), `tools/screens.html` (every run screen on a
fixture, `?phone=1`).

## What to look at first

1. `node tools/capture.mjs battle seed=1` → `tools/out/battle-*.png`: the
   lit battle frame with the diorama, the ribbon and the command list.
2. `node tools/capture.mjs playfull acts=2 ko=1` → `tools/out/playfull-*`:
   a scripted run through two acts with a real KO (death shake, wipe, dead
   pose), pause and party detours, and every run screen it crosses.
3. `tools/lineup.html?scale=4`: the 43 actors beside each other — the six
   heroes, the 13 act 1–2 enemies and bosses, the 24 acts 3–6 enemies.
4. `tools/study.html?bg=b9a98a` (needs the local `tools/ref/crops/`, see the
   98464a4 commit message): EMBER drawn by hand beside five Octopath crops and the
   kit's EMBER at zoom 2, 4 and 8 — zoom 2 on the lit ground is the real test.
5. ART-REVIEW.md, last two verdicts: the round-14 sprite critic and the round-4
   full-frame critic, with the exact list each still wants, and the coordinator's
   decisions after round 14.

## Done (all on the branch, every commit gated: check · build · smoke · sim where rules moved)

| Phase | State |
|---|---|
| 0 Contract | DESIGN.md through five blind review rounds plus a scoped sixth (DESIGN-REVIEW.md); every UI region row, the run-screen rows and the Balance state are folded from the shipped code (245267b, 7ad27ef) |
| 1 Engine | 1280×720 CSS-fitted canvas, FONT_HD glyph atlas, baked sprites, pointer input + hit regions (TAP_MIN 96, drawn-first test, keyboard parity), safe inset, CRT retune, mobile shell |
| 2 Combat | `game/sim/battle.ts`: ATB, the ten-step turn, every status, the glance model, sets, sigils, counters, AI + intent, scaling, `simulateBattle`, the interactive API with a structured event stream (`Battle.kills` for the killer's name) |
| 2 + 6b Data | All six biomes authored: EMBER CRYPT, FROST MARSH, SKY RUINS, ASHEN FORGE, SUNKEN VAULT, STORM SPIRE — normals, elites, bosses and packs per DESIGN.md's biome table; `validateData()` clean |
| 3 Relics | `game/sim/relics.ts`: rolling, levels, forge, sets, `derive`, `compare`; 60 644-check self-test |
| 4 Slice | Battle screen (ribbon with forecast and intents, plates and pictograms, compact command list, diagonal stage, event playback with VFX and juice, PAUSE and INSPECT); cards, title and end screens restyled to the same HUD font and plates over the scene |
| 5 Roster | Draft (three of six), opening SUMMON, leader seat, SUMMON swaps, the party screen (`game/screens/draft.ts`, `party.ts`) |
| 6a Run | Headless `game/sim/run.ts` (map, rooms, laps, Vault, nine policies, `simulateRun`) refactored into a resumable step machine (`runstep.ts` `createRun`: `state()/pending()/token()/decide()`); the map, SHRINE/FORGE/ALTAR/REST, laps, the Vault (equip, doors, bank, persistence) and ascension as screens (`map.ts`, `node.ts`, `vault.ts`, `screens/run.ts`); `main.ts` routes every pending to a screen — the whole run is playable (e2b69dd) |
| 7a/7b Scene | `engine/light.ts` + `game/art/backdrops.ts`: diorama planes with parallax, textured ground, stepped horizons, key/fill/rim/pool light, a light pool under each foot cluster, shafts, bloom, grade, contact shadows, elliptical vignette, tiers; actor-plane light is a multiplicative gain so authored sprite values survive the lit frame (d0e052d); prop glow lights the ground, never the carrier's garment (fff9ea8) |
| VFX | `game/art/vfx.ts`: procedural per-skill effects under bloom — streaks, a contact-time impact layer with ground pools, warm families off the crypt key, envelope-measured bounds, `vfxImpactDelay` for the battle screen (1a4d171, 3f95d0f) |
| Art | 43 actors at ×2 with seven-step ramps, an authored dark plane per garment, real hurt/attack/death poses, every crown rising on a hit; rounds 3–14 of artist + blind critic logged in ART-REVIEW.md (7 → 8 → 9 ×10 of 10), the acts 3–6 enemies in a late module (`parts-late.ts`, `actors-late.ts`); a pixel study (`game/art/pixel/ember-study.ts`, `tools/study.html`) with EMBER's idle drawn by hand at the same cell beside the reference — not wired into the game |
| 8 Balance | Ladder within 2.5 points of every act target on four seeds (act 6 ≈ 15 %), elites deadlier not spongier, every HP-refit trigger closed; DESIGN.md's Balance state rewritten and re-measured (0a2e0f7, ec4e39b, 245267b); blind-verified three times |
| Capture | `tools/capture.mjs`: sheets, battle frames, phone, `playfull` (scripted acts with honest OK / ENDED / STALLED verdicts, `ko=1` for a real KO, `phone=1`), `shot`; hot reloads on :5173 reset runs, so long captures run on a snapshot server |
| Sound | `engine/audio.ts`: 24 synthesized sfx through a limiter |

## Honest state

- **The art is not at the Octopath bar, the kit's loop has not said SHIP, and a pixel
  study has shown why.** Twelve artist-plus-blind-critic rounds this session (rounds 3–14:
  7 → 8 → 9 → 9 → 9 → 9 → 9 → 9 → 9 → 9 → 9 → 9 of 10). Since round 11 the sheet has been
  spotless on all 43 actors — criteria 1–8 and every ruler, one component per bake, the
  hero seats and the hit frame fixed in scene — and each later round closed its list
  (round 12 the drawings, round 13 the toad, the interiors, STEAM_WRAITH, the wolf, the
  schematic floaters and the mirror symmetry, round 14 LUMEN under 55 at every seat,
  CRYPT_WARDEN lit from above at 8.53, SILT_CRAB modelled). What stays open after the
  round-14 re-check (58cd55e) is the absolute enemy ceiling at four of thirteen enemy
  seats (DUST_WRAITH 53.0–53.3, CINDER_IMP 50.8–53.6, worst at the two-enemy pair seat)
  and the crab's gape as a line inside the silhouette rather than a notch in it. The
  critic found the obstacle under the ceiling: `legal()` lifts every ramp step to 3.2:1
  against the navy, so the whole cast owns 0.01 % of its cells between L 38 and 49 and an
  enemy torso reads ≥ 52 in scene or ≤ 39 — an engine value-law question (decision 5 after
  round 11, with its mechanism now named), not a ramp tune. The pixel study (98464a4,
  `tools/study.html`) then answered the owner's question — is the gap the model, the cell
  or the kit? — by drawing EMBER's idle frame by hand as a direct grid at the kit's own
  2-px cell with the same character's colours: at the on-screen size it reads as the
  reference's kind of object (p50 L 31 with 51 % below L 35 against the Temenos crop's
  37 / 45 %; the kit's EMBER 51 / 43 %), and it painted the reference's shadow sides in
  exactly the tones the kit's palette lacks. The kit is the ceiling. The loop pauses
  there ("Coordinator decisions after round 14"); the pipeline decision is item 1 under
  Next.
- **The full-frame critic has not reached 8 on every axis.** Round 1: sprites 8 ·
  scene 6 · UI 5 · VFX 7 · composition 5. Round 2: 8 · 7 · 6 · 7 · 5. Round 3 (on 6aa5801): **8 · 7 · 7 · 7 · 6**. It closed the two frames that were
  actively broken (the hit white-out, the airbrush ground) and found the sprites at the
  reference's value; what it wants is the air above the horizon (every biome's top band
  p50 15–22, 76–97 % below L 35, against skies at 59–75), the architecture un-blurred,
  lit mid masses, the floor's light on the seats, a hit that changes the frame's light,
  party plates that hold, one focus, the dead band on every run screen, a GAME OVER
  tableau and an act-clear moment. Round 4 (on 1df532b): **8 · 8 · 8 · 8 · 7** — five axes moved at once: the
  battle frame's dark share 73 → 54–58 % below L 35 with 7.6–8.1 % above L 75 (past the
  reference's 52.4 / 6.8 on the same detector), a lit thing above the horizon in every
  biome, the centre third leading by +22 L, the pack one mass with the ranks 11.7 % apart,
  the party plane above the enemy plane, the plates holding, a hit that lights the ground
  under it by +23.6 L, a heal and a ward that can be seen, the act-clear tableau. What
  stops SHIP: the light wells are value plateaus (8.1 L and 3.5 L of internal range against
  the reference shaft's 30.1), the bright mass sits in the ceiling (centroid 16–18 % down
  against the references' 50 %), the sprites still sit 9.7 L above their ground where the
  reference's front figure sits 17.7 L below its own, every biome is one hue (satMean 25–29
  against 57), and ten of thirteen VFX families are one fan in ten hues at the peak frame.
  Its first-ten-minutes item 1 — the focused primary's lit patch cut by a rectangle (+31 L
  over 4 px, 340 px long, on the first frame of the game) — was fixed after the verdict
  (ea1645c: the light fills the patch's own ellipse through a radial whose outer circle is the
  rim; the title's step run 270 → 44 px).
- **Scene**: round 4 (the pixel floor, the mid masses, the brazier, the sky body,
  MED's joint fix) is committed and blind-verified twice; round 5 (the light rig's seats: fog and motes behind the actors, the gain
  source-test at the feet, a spread cap around the median body, the gain's ellipse
  punched out of the bloom, a cast lobe on the contact shadow) is committed (1033d0d) and blind-verified: the motes and fog no longer move a body's
  value with the clock (0.00 at 168 readings, from +3.4), the hero bar holds at 205 of
  216 seat readings (from 85), the mean rig lift on a torso fell +10.5 → +1.5 L, and
  every figure has a cast shadow that anchors it. Its honest residual: the down-stage
  ground strip lost contrast where the actors dropped and the ground did not (under 2:1
  at both strips 115 → 102 readings; 97 of 216 reach 1.5:1 at both).
- **VFX**: round 3 (scale, the pool as light, family pool hues, the annulus front,
  the draw-order split, the `kind: 'vfx'` light feed) is committed (363eaac) and blind-verified twice: the hit target's own pixels above L 75 at
  the hit 69 → 26 % and at +360 ms 32 → 9 %, bystanders back to HEAD, the pool a soft
  glow the ground reads through, every pool ≥ 24° off the crypt key, 0.64 ms worst
  family at peak. What is short is presence: the biggest hit is a ~300×170 px pool with
  a four-point flash — beside octopath-2 it reads as a well-behaved hit, not a moment.
- **UI**: round 3 is committed and verified in isolation (cards aligned, INSPECT
  filled, one accent, one HP colour, light-not-line focus, resting plates, the detail
  strip, plates over the diorama, bitmap title bands, pops de-collided, the shrine's
  biome). Residuals the verifier listed: the marsh trees still read through the bank
  columns, map focus is the weakest in the game, and the rest-state 1-px accent
  borders on the Vault chips, doors and room card are the loudest edges left.
- **Balance is closed on the sim** (three blind PASSes): the ladder within 2.5 points
  of every act target on four seeds, act 6 ≈ 15 %, lap-2 ≈ 10 %, random < 1 %,
  stall ≈ 0.1 %. Two rule decisions are still open (below). Nothing about balance
  has been felt by a person.
- **Nobody has played it.** Every verdict above is from scripted drives and frames.
  The scripted `playfull` driver dies at the act-2 boss by design (a default party
  under the capture driver's policy), so **no act 3–6 battle has ever been driven
  in the frame**: the 24 late enemies, their packs, bosses and biomes are verified
  on sheets over their measured floor hexes and in the headless sim, never on screen
  in a battle. Phone layout is verified on a 390×844 viewport at dpr 3 through
  Playwright, not on a device.
- **Performance, honestly**: a battle frame at a hit peak measures ~11.5 ms median on
  headless software Chromium at the HIGH tier (the cost is `renderPost`'s
  frame-derived bloom, ~2 ms of readback plus the blur; VFX is 0.1 ms median). The
  guard is `light.ts`'s `note(frameMs)`, which drops HIGH/MED to LOW after 60
  consecutive frames over 20 ms; a GPU canvas is several times faster. No device
  measurement exists.
- **`__eq` and `__screens` are DEV-only** hooks (tree-shaken from dist, verified by
  grep); `tools/out/` is gitignored and holds the contract ledgers
  (`CONTRACT-EDITS*.md`), which are folded into DESIGN.md by a fold agent after each
  verifier confirms them (the scene and UI ledgers of this session are folded: b42ff83).

## Verification findings not fixed, and why

Each of these was found by a blind verifier or critic and left as is, with the reason.

- **Sprites (round-11 critic, pinned by rules rather than skill)**: DUST_WRAITH's torso
  p50 55.9–57.2 in scene against a ≤ 52 ask — `legal()`'s 3.2:1 floor (L* ≈ 51) and
  criterion 6's 45 % cap together make it unreachable from `parts.ts`; ASH_HOUND's
  upper band ≤ 60 on 2 of 7 slot-rows (58.8–62.9); the ≤ 45 %-under-3:1 reading over
  lit floors is withdrawn (over an L* 36 floor only pixels above L* 68 clear 3:1 at
  all); EMBER_ELEMENTAL's chroma 27.4 (a licensed light source, but it moved up).
- **Scene**: ASHEN_FORGE's mid-band p10→p90 17.1 against 20 (the two foot pools'
  additive wash is the ceiling); the marsh moon's interior is still fairly flat under
  the dim (the far plane paints an opaque disc under the sky body); the floor plane
  bakes at 1:1 while far/mid/near stay at the 1.1111 pad scale (≈ 49 px of horizontal
  disagreement at the frame edges — nothing registers across planes today, so a note,
  not a bug); the ground behind the command list is bright now (crypt median L 52),
  held by the UI's plates at 14.8:1.
- **VFX**: the full-frame critic's "≥ 4 % of the frame above L 75 at a hit" is
  withdrawn — it was met only by a white plateau that read as a manhole; KINDLE and
  CINDER are the two smallest `size` rows; FLARE/KINDLE/CINDER and JUDGEMENT share
  one 55° yellow pool because their accent is `FIRE_HOT #FFEC27`, the constant LIGHT
  uses (a palette fact); CRYPT_WARDEN +3–6 points above L 75 on two hit frames from
  the radial sparks flying past it; THRONE_OF_RUIN (1.01 s) and INFERNO (0.96 s) boss
  finishers are a pacing question for `battle.ts`; the old 0.50 ms-per-family budget
  was measured on a clipping harness and is retired (HEAD itself was 0.60 on the
  fixed one; round 3 ends at 0.69 worst).
- **UI**: INSPECT's right third is airy when the inspected hero wears nothing (the
  only state `capture.mjs battle` can produce); the detail strip's three columns sit
  at the contract's own +20 / +380 / +800 offsets; the three residuals listed above.
- **Balance rules, not numbers** (verifier-confirmed diagnoses, left for the owner):
  4-piece sets are rarely completed because `compare()` scores only the eight stats
  and is blind to set hooks (`SET_POOL four:4` was tested and rejected); the
  SABLE/LUMEN triangle guard is really TIDE's rarity under `balanced` (≈ 5 % of
  wins); act-1 elite packs (27 turns) are now shorter than ordinary three-body packs
  (30) and read dangerous only through ending HP.
- **Capture**: battle captures are not byte-deterministic (two runs of the same build
  and seed differ on 74 % of pixels by a mean of 14/765), so byte tests use the
  backdrop and sheet captures; a battle capture can only be judged statistically.

## DESIGN.md — what looks wrong now that it is built

- The "exactly one plane is pixelated" rule was amended by the coordinator: the FLOOR
  (only the floor — `pixelGround` is called from the six FLOOR painters and nowhere
  else; `BLUR_NEAR` stays 8) draws hard pixels at ACTOR_SCALE; far, mid and near keep
  their blur. Folded into DESIGN.md in b42ff83. The HD-2D "light at native resolution" paragraph is still silent on the per-actor multiplicative gain (`color-dodge`, `GAIN_FLOOR`/`GAIN_LIFT`) and `LightActor.kind`, which only CLAUDE.md documents.
- The HD-2D section says "hard pixels under soft light" but never states the value
  ORDER between a sprite and the ground it stands on. The reference's is bright
  ground under dark sprites; ours is the reverse, and every ship criterion in
  ART-REVIEW.md was written against a dark stage swatch (`#1d2b53`). The contract
  should state the law once (sprite p50 ≈ 40 with ≥ 35 % below L 35; the foot pools
  at L 60+) so the sprite loop and the scene loop move together.
- The ship criteria live in ART-REVIEW.md, not DESIGN.md, and two of them (the settle
  band 21–39 %, the idle floor ≥ 17 %) were review conventions until this session
  made them criteria 7 and 8.
- No frame budget is written anywhere; CLAUDE.md quotes per-tier costs on headless
  software Chromium. The honest statement is the one under Honest state.
- `minAscensionFor(equipped) = min(ASCENSION_MAX, equipped.length)` is what the Vault's
  "minimum ascension +1 per Vault relic" became (folded in 7ad27ef); declining a
  full-party SUMMON's EPIC no longer mends (the contract's rule, fixed in b8c2869).
- `compare()` is blind to set hooks (above) — either the contract says sets are a
  human choice the compare never scores, or `compare()` grows a set term.

## Next, in order

1. **Decide the sprite pipeline from the pixel study** (98464a4; `tools/study.html`, and zoom 2 on
   `bg=b9a98a` is the real test). EMBER's idle drawn by hand at the kit's own cell reads as
   the reference's craft where thirteen kit rounds did not. If the owner agrees, phase 2
   draws EMBER's other fourteen frames as grids (`game/art/pixel/ember-study.ts` already has
   the shape: `poses`, `feet`, `hit`, `hitSize`), `drawActor` gains a grid branch (bake through
   `makeSprite → bakeSprite`, draw at ACTOR_SCALE anchored at `feet`, mirrored for heroes),
   then the five other heroes, then the 37 enemies — one Fable artist per two actors, a blind
   eye-critic on the study sheet at zoom 2, the sheet criteria kept as gates. The study also
   found the kit's palette has nothing between L 27–31 and 51–52 because `legal()` lifts every
   ramp step to 3.2:1 against the navy; the reference's shadow sides live at L 35–48, so a
   hand-drawn roster needs those tones (the study added three).
2. **The value law in the engine** (ART-REVIEW.md, decisions 5 after round 11 and 2 after
   round 14): `legal()` lifts every ramp step to 3.2:1 against the navy, which leaves no
   tone between L 38 and 49 — the reference's shadow sides. Measure contrast against the
   lit ground the sprites actually stand on (p50 45–60 after scene round 6), not the
   navy, so a shadow step at L 35–48 is legal; then re-run the seat ruler on crypt seeds
   1, 4, 12, 16, 20 and the marsh frame at HEAD with the anchors read from `layout.ts`,
   and the full-frame critic's item — sprites sitting ~10 L above their ground where the
   reference's sit 18 below — is measured on the same frames. If item 1 goes ahead this
   is solved by construction for the hand-drawn actors and still needed for the rest.
3. **Drive an act 3–6 battle.** Add a DEV-only strong-party option to
   `tools/capture.mjs playfull` (or a `__eq.config()` party with Vault relics) so the
   scripted run reaches SKY RUINS, ASHEN FORGE, SUNKEN VAULT and STORM SPIRE, and
   judge the 24 late enemies, their VFX and their floors in the frame — nothing has.
4. **Full-frame critic round 5.** Round 4 scored 8 · 8 · 8 · 8 · 7, so composition is
   the axis short of 8; its round-5 lists in ART-REVIEW.md are the brief. Composition:
   the bright mass down behind the figures (centred at 30–40 % of the height, centroid
   40–55 %), the middle third the brightest, the fallen party lit at GAME OVER, the 216-px
   right strip, the last saturated mass out of the outer third. Scene: shaped light wells
   (≥ 25 L inside every well, a hard silhouette across it), the FAR architecture back, the
   pool under the party measured in a battle frame, a second hue per biome, the ARCADE
   gap. UI: no plate rule over 250 px, the last three plates, pops readable on the new
   sky, the map not an app grid. VFX: three peak-frame geometries, the hit carrying +4
   points of frame light, a three-frame peak, a quantified bystander guard. Sprites: four
   hero outlines broken (see item 1 — the pixel study decides how), the three hero-body
   humanoids, EMBER_ELEMENTAL, the held-weapon pose. Repeat until every axis holds 8.
5. **VFX follow-ups**: give fire its own accent (FIRE_HOT is shared with LIGHT);
   KINDLE and CINDER sizes; a cheaper bloom source (the 2 ms readback is the frame's
   largest cost).
6. **UI residuals**: the marsh trees through the bank columns, map focus, the
   rest-state 1-px borders on the Vault chips, doors and room card.
7. **Balance rules** (owner decisions): `compare()` and 4-piece sets; TIDE's rarity;
   whether act-1 elites should be longer than trash packs.
8. **A person plays it** — on a phone too. Everything above is frames and drives.

## Conventions that matter

Headless boundary (`game/data`, `game/sim` never import the engine, the DOM
or `Math.random`); every draw through `game/sim/rng.ts`; DESIGN.md moves
with the code; commit at green milestones, unsigned, pathspec-scoped; push
= the feature branch only, never main; never deploy. Writers own files and
never share one; every writer gets a blind verifier; Opus for art, critics
and scene work, Sonnet for mechanical work; nobody claims to have
playtested — the owner is the playtester.

Session mechanics learned the hard way: start the next session with
**ember-quest as the primary repo**. This session's primary repo was
retrovibe, so any `game-writer` agent loaded retrovibe's
`.claude/agents/game-writer.md` (scoped to `workspace/<game>`) and refused
ember-quest files; every writer here ran as a plain `general-purpose` agent
with an explicit model instead. Long captures must not run against :5173
while a writer is saving (each hot reload resets the run): use a detached
worktree of HEAD on its own port.
