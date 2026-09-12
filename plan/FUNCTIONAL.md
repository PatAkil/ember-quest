# Functional plan — what the player gets

The player-facing half of the plan. The TypeScript game is a **prototype that validated
the mechanics**; the game is now built from scratch on Kotlin Multiplatform. This document
says which mechanics move unchanged (§ F1), what the new presentation decides for phones
(§ F2), how the AI-generated character and enemy art is judged and when it can be stopped
(§ F3), and it holds the two placeholders the owner will fill later: the character changes
(§ F4) and PvP (§ F5). Every item here is a *specification* change; how it is built and
verified is `TECHNICAL.md` and `VERIFICATION.md`.

The rule that governs this document: **the mechanics are the baseline; the presentation
is new.** The rules of `DESIGN.md`, as the prototype's simulator runs them, are rebuilt
exactly (§ F1), proven by the oracle traces. The screens, the stage and the art are designed
for phones, taking from the prototype only what it measured and validated (§ F1.2, § F3.1),
and are accepted by the owner on a device (§ F1.5). Anything in § F2–F5 that changes a
rule lands after the rules gate, as its own change with its own spec clauses, tests and,
where numbers move, simulator guards.

## F1 The mechanics baseline

### F1.1 The systems that move unchanged

Everything `DESIGN.md` specifies, as the prototype's rules core implements it at the tag
`ts-oracle-v3` — where the contract and the code disagree, **the code is the baseline**
(the six items `STATUS.md` lists are reconciled into the spec at P2, `TECHNICAL.md` § T7.6).
The inventory is the checklist the rules gate is signed against; the counts are the
current content.

| System | Content that must survive |
|---|---|
| Party and stats | 3v3, eight stats (HP ATK DEF SPD flat; CRIT CDMG ACC RES points), the derivation with no compounding, mitigation `def / (def + 900)`, no caps but CRIT 100 at roll time |
| Elements | FIRE ▸ WIND ▸ WATER ▸ FIRE, LIGHT ⇄ DARK; advantage = crit points, disadvantage = the glance; the GLANCE debuff |
| Combat | the event-driven attack bar, the ten-step turn, cooldowns, seventeen statuses with their durations and stacking rule, the ACC/RES landing floor, the damage pipeline, counters, ENRAGE at turn 100, TURN_CAP 500 as a stall; **forfeit** — quitting a battle from the pause overlay ends the battle as a lost battle (`WIPE` in the rules, `forfeit` set on the result) and the run with it, the Vault banking as on any death; the screens credit the death to RETREAT, a presentation label the rules never carry |
| Skills | 24 hero skills (six kits of three plus six awakened variants) and every enemy skill in the closed `SkillId` union |
| Characters | six (EMBER, GALE, TIDE, BASALT, SABLE, LUMEN): bases, kits, awakenings, leader skills |
| Enemies | 37 across six biomes (four or five normals, one elite, one boss each), their packs, the scale formula per act, kind, lap and ascension, `BOSS_HP`, `ACT_MULT`, `LAP_MULT`, `CLEAR_GROWTH` |
| Relics | six slots, four rarities, `rollRelic`'s eight ordered draws, substats and the +2/+4/+6 events, drop levels by act, FORGE (+2, recast, rebrand), REST sharpen, sixteen sets (the run's set pool of 2 + 2 plus the Vault's), twelve sigils with kindling at +6, `compare` |
| Run | the map generator (`STAGE_SIZES [2,3,1,3,2]`, landmarks, guarantees, links, adjacency), nine room types, the draft and the two SUMMONs, the leader seat and when it may change, six pacts, the ALTAR, laps under `LAP_MULT`, score |
| Meta | the Vault (12, bank 2 + L − 1 on DESCEND, 1 on death), Vault equip raising the minimum ascension (a screen rule in the prototype; here `minAscensionFor` is a pure rules function the screens clamp the chosen ascension with before a run starts, never enforced inside the run itself, so the oracle's cells at A0 with three Vault relics replay unchanged — `TECHNICAL.md` § T2.2, § F1.4), the A0–A10 ladder, the unlock at the first act-6 kill |
| Persistence | the prototype keeps only the Vault (browser storage); a closed tab loses the run. The app keeps the Vault, the settings and — if § F2.1 is approved, as recommended — the run itself |
| Balance | the Balance state table of `DESIGN.md`: the ladder, the guards, the stall and enrage rates — reproduced exactly on the same seeds and run counts |

### F1.2 The screens, the flows and what the prototype's presentation established

Twelve screen states, in nine screen files in the prototype, in the order the run raises
them: title · Vault (EQUIP, BANK, DOORS) · draft and SUMMON · leader · map · room card ·
battle (the command list, INSPECT, PAUSE with QUIT) · relic cards and who-wears-it · node
faces (REST, SHRINE, FORGE, ALTAR) · party · act clear · GAME OVER and VICTORY with the
doors. Every state is a fixture and a golden at P5. Every tap target keeps a
keyboard route (arrows to move focus, A to activate, B to back), so the desktop build the
agents drive is playable on a keyboard and a phone on touch.

The prototype's presentation is **not ported**; the screens and the stage are designed
for a phone from the start. What the prototype established and the new design keeps as
its inputs, because the numbers were measured and the owner's bar (Octopath Traveler's
HD-2D) has not changed:

- the 16:9 logical frame with a mutable safe inset (landscape is question 2 of the README;
  a portrait layout is a different design, costed there);
- the stage's laws: small dense pixel figures on a lit ground, four planes with the
  middle one sharp, two foot pools derived from where the ranks stand, per-actor light as
  a gain rather than a wash, contact shadows with a cast lobe, three quality tiers plus
  ARCADE; the per-biome ambient presets; the vector pictograms for statuses, slots and
  elements; damage pops; 24 sound effects, rendered once from the prototype's synthesizer;
- the screen inventory above with the contract's readability rules (arm's-length text,
  the character limits per label, one focus model, `TAP_MIN` 96);
- the feel items `STATUS.md` and the full-frame critic recorded, which become the
  `kmp-quality` rubric (§ F1.5).

### F1.3 What the new presentation decides

Each of these is a spec clause under `spec/platform/` so it is a decision, not drift.

| Decision | The prototype | The app | Why |
|---|---|---|---|
| Installation and fullscreen | a page; an "add to Home Screen" hint on iPhone; a rotate prompt; fullscreen on first tap | an installed app, fullscreen by nature, landscape by manifest (question 2) | the hints have no meaning in an app |
| Where the Vault lives | browser storage under `ember-quest/vault` | the app's private storage with a schema version; the prototype's Vaults are not imported (§ F6) | nobody has a Vault worth moving; the prototype is disposable |
| Host messages | `postMessage` to an embedding parent | none | there is no host |
| The HUD face | a system font stack chosen by the browser | one bundled font, the same on every device; the contract's character limits re-validated in it | consistency; the metrics need one face |
| Bloom and halation | derived from the whole frame; halation a blurred copy of the frame | from the *bright layer* (VFX, prop glows, the sky body, pops) at quarter resolution, on every platform, decided at P5 on the real stage (`TECHNICAL.md` § T9.4) | one deterministic code path |
| Quality tier defaults | HIGH everywhere (the auto-drop to LOW and the ARCADE toggle) | by a first-launch benchmark — MED on a 2022 phone, HIGH where the stage holds 60 Hz — adjustable in settings; the auto-drop stays | a 2022 phone cannot hold HIGH at 60 Hz |
| Input surface | mouse, touch, keyboard | touch and, where present, keyboard; **Android's back gesture and button act as B**; at the title, and on the map with a run open, back asks before leaving the app; a controller is optional later | platform |
| Windowing | a browser tab | split-screen, free-form and tablet windows letterbox the frame; a resize pauses the game | platform |
| Pixel crispness | the whole frame scaled smooth | the actor plane drawn with nearest sampling where the device scale makes one cell an integer number of device pixels, else smooth | a small win, never a loss |

### F1.4 What the prototype gets wrong, and the spec fixes

The reviews found defects in the prototype's screens; the rules core and the simulator
never take those paths, so the oracle traces are clean. The spec states the correct
behaviour and the new screens are built to it; the prototype is frozen with its defects
(README, "What stands still").

| In the prototype | In the spec and the app | Clause |
|---|---|---|
| The battle screen enumerates a hero's options *before* the turn's cooldown tick while the rules re-enumerate at step 7 after it; when a skill comes off cooldown during the tick the committed index casts a different skill or target — measured on 16 % of hero turns | the hero's decision is asked at step 7 with the post-tick options, so what the player picks is what fires | `COMBAT-TURN` |
| A skill greyed out in the command list at cooldown 1 is legal by the time the turn resolves | the list shows the post-tick legality | `SCREENS-BATTLE` |
| A hero wearing the four-piece VIOLENT set gets an extra turn that asks the battle's policy, which the interactive screen never seats — a crash | the extra turn is a second decision asked of the player | `COMBAT-TURN` |
| The Vault's minimum-ascension floor is enforced by the Vault screen, not by the rules | the same function, with the same numbers, lives in the rules and is tested there; the screens apply it before a run starts, and the run itself still accepts any `RunConfig` — as the oracle does — so the golden cells recorded at A0 with three Vault relics replay | `META-VAULT` |

### F1.5 How the mechanics and the presentation are accepted

1. **The mechanics, mechanically** (`VERIFICATION.md` § V3): the oracle traces are identical
   for every cell of the golden coverage matrix and the balance table reproduces (P3's
   gate). No screen is involved.
2. **The presentation, by evidence**: the storyboard driver **reaches** every biome, every
   boss and every screen with the strong-party fixture and the forcing hooks, plays a
   two-act run to a KO through the real screens on the JVM and two acts on Android and
   iOS, and reports `PLAYFULL OK`; every screen state has a golden; the budgets of
   `TECHNICAL.md` § T9.5 hold on the reference phones.
3. **The presentation, by the owner, on a device.** *Felt rows* — at most eight — the owner
   walks on a phone at P5's end: the first ten minutes (below), a KO, INSPECT, PAUSE, a
   SHRINE, a SUMMON with a full party, the map, the Vault's EQUIP and BANK faces. A felt row
   the owner cannot sign stays open and P5 does not close — with a bound: a row reworked
   twice and still unsigned gets one more rework (an S) and then the owner's decision,
   accept it as a recorded known miss or stop; the priced worst case is two reworks per row and six in all across the eight, and a third rework on a row or a seventh overall is the branch trigger. The rows are scored against the
   **feel rubric** of the `kmp-quality` skill (`TECHNICAL.md` § T13.2), written at P1 from
   `STATUS.md`'s "Playing it on a phone" section and the full-frame critic's
   first-ten-minutes items — anything tapped twice, anything unreadable at arm's length, a
   frame rate that does not hold through a hit, a hit without a pop, a prompt that blinks
   off, a screen that swallows the run.
4. **The reference.** Nobody has played the prototype on a phone. At P0, as the owner's first
   act after the move commit and question 3(c)'s fix, before the accounts, the testers and
   the bake-off's spend, the owner plays it through the first ten minutes and a
   KO — after README question 3(c)'s fix if it was taken — and records, in `plan/BASELINE.md`, what a turn, a hit and a draft *feel* like
   and what did not work, with the battle screen's two hero-turn defects (§ F1.4) recorded
   as excluded from the bar, since the app must not reproduce them — the record the felt
   rows are judged against, so that "as good as the prototype" is a written bar, not a
   memory. The same play is the owner's **go or no-go on the game itself**, recorded in
   the register (README, the P0 owner row): the one product decision before P3.
5. **The first-ten-minutes test**: title → draft → the opening SUMMON → leader → map → a
   crypt fight to a KO or a win → INSPECT → PAUSE → a SUMMON room → a SHRINE, on a phone,
   at P7 on release builds.

## F2 The presentation, designed for phones — approved with the plan, row by row

Each row is a design decision of the new build, written as spec clauses under
`spec/platform/`, `spec/meta/` or `spec/save/` with tests. None changes a rule of the game
except where marked. Each row is the owner's to approve: **F2.1 is README question 10 and
closes at P0**, because the save format is designed around it in P3; the other six rows
are approved with the plan (README, "What you are approving", item 3) and built in the
phase named in the Phase column.

| # | Change | What the player gets | Notes | Size | Phase |
|---|---|---|---|---|---|
| F2.1 | **Resume anywhere** (recommended; question 10) | Closing or being interrupted mid-run — mid-battle too — loses nothing; the app reopens on the same decision, or on the same hero turn | The run is saved after every decision, hero turns included, as `(rules version, seed, config, decisions)` and replayed on launch; a state snapshot rides along so that an app update never abandons a run — when the installed rules differ from the save's, the run continues from the snapshot under the new rules and the player is told once — **unless the save names content the installed rules no longer have** (a removed character or skill), the one case that abandons a run with the Vault untouched (`TECHNICAL.md` § T11). Not a *rewind*: the player cannot undo a decision. The resume path (`resumeRun`, `TECHNICAL.md` § T11) is a rules-structure change with its own clauses — an S inside this row's M–L, after the P3 gate — so the row's one price is the save format and `SAVE` clauses inside P3, ≈ 1–2 sessions in P5, and that S after the gate. A "no" leaves a permadeath run at the mercy of the platform killing the app in the background, which is why the plan recommends yes and D6 depends on it. | M–L (the `SAVE` clauses inside P3's size, ≈ 1–2 sessions in P5, the post-gate `resumeRun` S) | decided P0; the save format and `SAVE` clauses in P3; the resume path in P5 |
| F2.2 | **Settings** | sound volume and mute; ARCADE on/off; quality tier (AUTO/HIGH/MED/LOW); a "reset the Vault" with a confirm; credits | One screen, reachable from the title and the pause overlay. Haptics on hits is optional and off by default. A crash-report toggle appears only when a reporter ships (§ T12). | S | P5 |
| F2.3 | **Orientation and safe areas** | landscape locked (question 2); the frame respects notches, rounded corners and the gesture-navigation edges | The mutable safe inset reads the platform's insets. Every edge target is tested under gesture navigation. | S | P5 |
| F2.4 | **Interruptions** | a call or a switch to another app pauses the game and the sound; returning resumes on the pause overlay | The app pauses on lifecycle events and yields audio focus. | S | P5 |
| F2.5 | **App identity** | icon, splash, store listing, a credits screen that names the AI art providers and every bundled asset's licence (the HUD face's OFL or Apache notice; the sounds and the glyph tables are the prototype's own) | Store metadata is copy the owner writes; the credits line is required by § F3.6. | S | P5 (identity and the listing copy, which Play needs before a closed-track release); P7 (the credits and disclosure copy) |
| F2.6 | **Device tiers** | a 2022 mid-range phone runs MED at 60 Hz; older devices start LOW; the toggle in settings | The tiers are the contract's; the *default* comes from a three-second stage benchmark run behind the title on first launch — the title needs no stage, so the ≤ 2 s boot budget of `TECHNICAL.md` § T9.5 holds and the tier is decided before the first battle (§ F1.3). | S | P5 |
| F2.7 | **Bug reports from a release build** (the save share contingent on question 10's yes; built with the first test-track build so the felt rows and the closed testers have it) | a long-press on the title shares the current run's save file; the seed is shown on GAME OVER | So the owner's felt rows, the first-ten-minutes test and the closed testers — all on release builds — can report a bug that replays (`TECHNICAL.md` § T11). The rest of the debug drawer stays debug-only. | S | P5, with the first test-track build |

Optional, not planned: controller support (cheap on the keyboard route), portrait layout,
localisation beyond keeping strings in one place, cloud saves, accounts (PvP will decide).

## F3 AI-generated character and enemy art

### F3.1 The bar and the bible

The bar is unchanged: Octopath Traveler's HD-2D — small, dense pixel sprites under soft,
lit, blurred dioramas. Fourteen critic rounds on the prototype and a hand-drawn pixel study
defined what that means in numbers; the bible below is what every generation prompt, every
gate and every critic works from. It is carried into `spec/art/` as clauses **with each
number's derivation recorded** (the study's crop rectangles from commit `98464a4`, the sheet
metrics of ART-REVIEW.md), because the reference frames themselves are the owner's
screenshots, are not in the repository and never will be.

- **Cell and size.** One cell is 2 screen px at 720p. The canvas is 64 × 64 cells (96 × 96
  for a boss). The bands are the review's recorded ones: a hero 52–60 rows tall, any width
  the 64 columns allow (the contract's `ACTOR_PART = 64` cells — `ACTOR_W` is its 128 screen px; measured heroes run to 53 columns); a
  standard enemy 40–50 rows; an elite 50–56; a boss at least 60 on the 96-cell canvas (the
  six measured 65–93). A taller boss band is a change
  the owner may make at the bake-off, recorded as such — never a silent renumbering. Feet at the bottom centre; authored facing right (the battle mirrors
  heroes).
- **Line and tone.** A full 1-px keyline that follows the material (near-black with a hue on
  garments and boots, the material's own dark step on light hair, dark brown on skin);
  interior lines where a form turns; three to four hard-edged tones per material, clean
  clusters, no dithering; folds and accents as 1-px marks; hands drawn; tapered legs; dark
  boots. About 24 colours per actor: the character's element ramp plus neutral secondaries
  shared across the cast.
- **Proportion.** About three heads tall with a big readable head — the reference's chibi
  build, not a slim figure.
- **Value.** The figure sits dark on a lit ground. *Pass* (the sheet criteria the prototype
  measures — ART-REVIEW.md's criterion 1 and the lit-from-above delta): L* span p2 ≤ 15 and p98 ≥ 85; ≥ 20 % of body cells below L 35
  and ≥ 20 % of interior cells; ≥ 8 % above L 75; the top quarter ≥ 8 L* lighter than the
  bottom (lit from above). *In scene — reported for a sprite, gating the stage* (the ruler the prototype adopted
  after round 11 in place of the old contrast-against-the-navy criterion, which is
  **retired** because the shadow band the bar needs — L 35–48 — cannot clear 3:1 against
  a navy line-up ground; after round 13 the prototype's own record makes it **the scene
  owner's number, not a sprite criterion**: over the derived pools' ground at L 40–49 no
  ramp clears 1.5:1 without breaking the enemy value ceiling from the other side, and the
  rig's cast shadow is what took it from 66 to 106 of 108 seat readings): the actor's
  median against the ground it stands on at both ground strips, as a **luminance
  contrast** — the WCAG relative-luminance ratio `(Y_hi + 0.05) / (Y_lo + 0.05)` between
  the median of the actor's masked cells and the median of the strip's surviving cells,
  ≥ 1.5:1 (over an L* 41.6 ground that admits an actor above L* 53.5 or below 31.3, as
  ART-REVIEW.md records; an L* ratio would be a different gate) — measured on **one fixed
  set**: the six seats of the resting frame of every biome — 36 seats, 72 strip readings
  — the seat list fixed at P0, an excluded seat counted as a miss, never dropped, and the
  fallback cast planted as a fixed reference at P0, P5 and P6; **two bars, both recorded
  at P0 under this rule** on the prototype's landed rig: at its LOW tier (one flat plane
  with the key light and grade baked in, the closest match to the placeholder stage P5
  draws), which is P5's bar, and at HIGH, which is P6's (the record under the older strip
  rule was 106 of 108, quoted for scale only); and the **seat spread** — the
  largest excess of a seat's torso median (rows 0.33–0.72 of the silhouette's height) over
  the median seat's — an L* value over the 36 seats whose bars are likewise the rig's at LOW and
  HIGH (the rig's own 4.5 L was measured with one sprite at all six anchors, the cast's
  differences removed, so 5 L* is the intent, not the bar). Both are
  **reported** on every sprite's contact sheet and **gated** at P5
  and P6 against the rig over the biome frame goldens (a miss is a light or shadow fault,
  worked in the scene, never by regenerating a sprite). The sheet's contrast columns stay
  reported for continuity. *Target*,
  reported beside the pass and gating only P4's six heroes (§ F3.5): p50 L* 31–40 with
  ≥ 45 % of cells below L 35 (the reference crop reads 37 / 45 % / 11.5 % above L 75; the
  hand-drawn study 31 / 51 %; the prototype's EMBER 51 / 43 %).
- **Element identity.** The dominant garment ramp is the element's (fire crimson, wind green,
  water teal, light gold, dark plum) over a neutral secondary; the five elements read apart
  in greyscale too.
- **Silhouette.** *Pass*: no two actors' idle silhouettes overlap above 78 % (feet-aligned,
  centred); a humanoid with a stance has a mirror IoU under 85 %; the *cast* palette
  overlap between any two actors under 25 %. **Palette overlap**, both uses: the summed
  area share of the cells whose quantised colour appears among the other image's ten most
  frequent colours, taken as the minimum of the two directions — cast overlap between two
  actors' idle 0, frame-to-frame (§ F3.4) between an actor's aligned frames. *Target*: heroes ≤ 65 % against every other actor — a brim, a horned
  helm, a coat with tails, a half-cape.
- **Motion.** Five poses — idle, attack, hurt, cast, dead — three frames each. The two
  criteria the prototype already defines are kept **as defined, as absolute differences**
  (ART-REVIEW.md's convention), with one denominator: **differing cells ÷ cells in the
  union of the two masks**: idle changes ≥ 17 % between frames (a one-cell breath is a
  translation and counts); the settle band — attack 2 against idle 0 — **20–39 %** (round
  12's widened band, which rounds 13 and 14 measured against; the 21 floor of round 11 is
  superseded).
  Three criteria are **new** and measured after alignment, defined once so the numbers mean
  one thing: *alignment* is the integer translation that maximises silhouette IoU against
  idle 0; *part travel* is the displacement of the centroid of the largest 8-connected
  component of the aligned XOR mask, 4–8 cells for attack; *crown rise* is measured
  feet-anchored (the bottom opaque row aligned, never best-fit, or the recoil would be
  aligned away), ≥ 1 cell on hurt's first frame; *dead* is a collapse to 25–57 % of the idle
  height whose aligned XOR against idle covers ≥ 90 % of the union (never a rotated or
  clipped idle). One 8-connected component per non-dead frame. **The band rule**: these
  bands are provisional; at P0 the gate records the prototype's 43 actors' p10–p90 per
  criterion; the bake-off gates on the bands above, except that where the prototype's p10
  is below a band's low or its p90 above its high, the recorded [p10, p90] replaces that
  band as a register entry; the bands carry into `spec/art/` when it is written (§ F3.2).
- **What is never generated.** UI, text, VFX, the light rig, the fonts. Backdrops are
  placeholders until the scene phase (§ F3.7).
- **What is never fed to a provider.** Third-party artwork of any kind — no screenshot of
  another game goes in as a reference image; `art generate` accepts only committed asset
  ids under `assets/` as references and the gate fails a manifest naming any other, so the
  owner's reference frames in `prototype/tools/ref/` cannot enter a prompt by accident (the rule is
  mechanical, not discipline). The reference set is the hand-drawn study
  (`prototype/game/art/pixel/ember-study.ts`, licence-clean and the one asset that meets
  the value target, exported at cell resolution and ×4 at P0) and, as they are accepted,
  our own actors.

### F3.2 The fork the owner decides at the bake-off: pixel or painted

| Option | The player sees | What it keeps | What it costs |
|---|---|---|---|
| **A — pixel sprites (recommended)** | HD-2D as the prototype, with sprites that reach further toward the bar: dense, hand-drawn-looking pixel figures under the soft light | the stage's laws, every instrument and criterion, the bar the owner set | the providers must produce clean pixel art at the cell; consistency across 15 frames is the hard part (`TECHNICAL.md` § T10.3) |
| **B — painted characters** | illustrated figures (a Darkest Dungeon or Slay the Spire register) under the same light | the light rig and the screens | the identity: the value instruments and the composition criteria are written for pixel figures; the bar changes from "Octopath" to something the owner has not named; and the asset model: a painted actor ships at twice the cell canvas — 128 × 128 px per frame, 192 × 192 for a boss on the 96-cell canvas (bilinear on the actor plane, no hard-pixel path), so the cast's atlases are ≈ 50 MB resident against 12–14, which with two biomes' bakes presses § T9.5's 250 MB peak-memory budget (one biome resident is the lever), and ≈ 8–15 MB on disk as PNG inside the install budget (`TECHNICAL.md` § T9.7) — both re-derived at P0's exit; about one extra session in P4 for the value targets (README question 1) |

**How B is judged at the bake-off.** A painted figure fails the keyline, colour-count,
cell-alignment and component criteria by construction, and the halo criterion is
manufactured by the bilinear resample, so for look B those are *reported, not gating*, and the candidates skip the palette quantisation and integer downscale of
normalisation (they are resampled to the cell canvas for measurement only); the value,
silhouette and motion criteria gate both looks unchanged, and the in-scene ruler is
reported for both (§ F3.1); if B wins, P4 re-derives the value *targets* (p50 31–40 and
≥ 45 % below L 35 were measured on pixel figures and the reference crop) on B's own
reference, about one extra session, while the pass thresholds stay. A B candidate reaches
the owner on that reduced gate, so the fork can actually close. **B's display path**: a
painted frame is a 128 × 128 px PNG (192 × 192 for a boss) with the sidecar `canvas:
128|192, cell: 1`, drawn by the prototype's `PixelActor` registry at 1:1 on the stage (`TECHNICAL.md` § T4.2, § T10.9)
and by the Kotlin stage bilinear, so the bake-off's lit phone frames exist for both looks.

Recommendation: **A for sprites, with painted portraits** for the ribbon chips, party heads
and cards, where a painted face reads better at 48 px than a sprite crop. The fork closes at
the **end of the P0 bake-off**, on six actors shown both ways, with all their frames, in
lit battle frames on a phone (the prototype's stage carries them, `TECHNICAL.md` § T10.4);
`spec/art/` is written when it closes.

**What the numbers cannot promise.** The prototype's kit passes every sheet criterion at its
pass thresholds and has done so since round 11, at 9/10, and still does not reach the bar;
the pixel study showed why (the kit's palette and construction, not its numbers). The gate
is therefore a floor that keeps bad images away from the owner's eyes, not a proof of the
bar. What proves the bar is the owner looking at lit frames on a phone. The plan makes that
decision explicit twice (§ F3.5), gates P4's heroes on the value target the kit fails, and
names what happens on a "no".

### F3.3 The cast and the frames

| What | Count | Canvas | Notes |
|---|---|---|---|
| Heroes | 6 | 64 × 64 cells | five poses × three frames = 15 frames each; authored facing right |
| Normal and elite enemies | 31 | 64 × 64 | same poses; creatures (a raptor, a jelly, a coil) are exempt from the mirror-IoU rule |
| Bosses | 6 | 96 × 96 | same poses; heavier and taller by the size rule |
| Portraits | 43 | painted, ≥ 256 px, cropped to 48-px chips | one per actor; the element mark is drawn by the UI, not painted. **Their own criteria** (the sprite metrics do not apply): crop-safe at 48 px (the face inside the chip's safe area); the face reads as two dark clusters and a highlight at 48 px; the element's hue is present — at least 15 % of the chip's cells within ΔE 12 of the element ramp's accent or glow colours, skin, hair and the other neutrals permitted and uncounted; consistent with the sprite's hair, headgear and colours; no text, no watermark — the tool measures the first three with the formulas of `TECHNICAL.md` § T10.4, the critic judges the last two. **Fallback**: a normalised head crop of the sprite, generated by the tool, which the screens are designed to accept from P5 so no screen ever depends on a portrait |
| Total sprite frames | 645 | stored at cell resolution | the budget model is in `TECHNICAL.md` § T10.7 |

### F3.4 Acceptance criteria — what the player must be able to see

Every generated actor passes the **numeric gate** first (§ F3.1's pass thresholds and the
motion criteria, measured by the art tool of `TECHNICAL.md` § T10.4 with the targets
reported beside them), then a **critic** (an agent with eyes on a contact sheet and in a lit
battle frame at 1:1 and 2×, under the protocol of § F3.5), then the **owner** on a phone.
The criteria, in the order they are checked:

1. Readable at arm's length on a phone: a hero at 13–17 % of the frame's height; the face two
   dark clusters with a highlight; the weapon held.
2. Distinct: the silhouette rules of § F3.1 across the whole cast, not only within a biome.
3. Consistent: the same character in every frame — palette, proportions and keyline do not
   drift between poses (a frame-to-frame palette overlap ≥ 75 % and a bounding-box height
   within ± 3 cells across idle, attack and cast, after alignment).
4. Lit: the value pass holds on the sheet, and the in-scene reading is reported (§ F3.1);
   no halo of light pixels around the keyline (a background-removal artefact); nothing pure black, nothing pure white outside
   a specular of ≤ 6 cells.
5. Alive: the motion criteria of § F3.1, judged on the pose sheet and in play — a dead pose
   is a collapse, an attack travels.
6. In scene: standing on the stage under the biome's light, the in-scene value rule holds and
   the party plane reads above the enemy plane, as the round-4 full-frame critic requires —
   read on the sprite's sheet, owed by the rig (§ F3.1), so a miss here sends the light and
   the shadow back to work, not the sprite.
7. One cast: the six heroes beside each other read as one palette; each biome's pack reads
   as one family; bosses read heavier than their packs.
8. Nobody else's: no recognisable third-party character, mark or logo — the critic's call
   on the sheet, since no metric can make it.

An actor that fails a gating criterion twice after regeneration goes back to prompt and
reference design, not to more sampling; an actor that fails three times goes to the stop
decision — trigger 4 of § F3.5, per actor, with the same three branches. Criterion 6 and
every reported-only reading are outside this rule: they send the rig back to work.

### F3.5 The process as the owner sees it, and when it stops

Per actor: a contact sheet of candidates (colour, greyscale, silhouette, the pose sheet, and
the actor standing in a lit crypt frame at 1:1 and 2×) with the gate's table under it; the
critic's verdict; the owner's yes or no on the sheet. Order: the six heroes first (they are
on every screen), then the EMBER CRYPT pack (the first ten minutes), then the six bosses,
then the remaining packs by act. The owner never sees an actor that has not passed the
gate. The cast is built in **P4**, in parallel with the rules, because nothing in it
depends on Kotlin: the tool, the providers and the owner's decisions.

**The critic's protocol** (a model's score is not a measurement unless it is repeatable):
the same model and the same prompt every time, blind — the critic is not told which
candidate is which, nor what changed — three runs per verdict and the median score; a
verdict below the bar names the failing criterion by number. The prompt, the five axes,
the scoring **and the model with its version** are frozen in `plan/spikes/7/CRITIC.md`
before the first verdict of the bake-off and promoted unchanged into `spec/art/` at P0's
exit **with the per-axis baselines and the calibration sheet beside it** — `spec/art/` is
an owned path, so the bar an agent's work is judged by is not the agent's to move; every verdict records the model and version; at P0 the pinned critic scores the
frozen calibration sheet — the prototype's round-14 cast in lit frames, committed as
`spec/art/calibration-sheet/*.png` with its capture command in the spike report, since the
prototype's own capture output is not in the repository — three times, and the medians,
**per axis**, are the **baseline** every later bar is set against; if the model must change
during the programme, the new one re-scores the sheet and the offset is recorded as a
register decision.

Two decision points, each a yes or no from the owner on lit phone frames:

1. **After the bake-off (P0's exit):** six actors, both looks, all frames, through the
   calibrated gate. *Continue* with the chosen provider and look; *change provider* (one
   more bake-off, ≈ $250 and half a session to a session, from P0's re-estimate); or
   *stop*.
2. **After the six heroes (in P4):** the party on the prototype's stage in three biomes,
   the six meeting the value target the prototype's kit fails (§ F3.1) and scored by the
   full-frame critic **at least one point above the prototype cast's baseline** on the
   sprite axis, capped at 9 — the baseline being the median the *same pinned model and
   prompt* give the prototype's round-14 cast frames at P0 (expected 8, so the bar is
   expected to be 9; the old 8 was a single verdict under no protocol and proves nothing;
   a baseline above 8 is recorded as a register decision and the cap keeps the gate
   reachable); the value target and the owner's eye are the discriminating criteria, the
   score a floor. P5 owns the UI and VFX axes and P6 the scene and composition axes under the
   same rule, each with a no-regression rule on the others (`TECHNICAL.md` § T14); an axis
   whose P0 baseline is already 9 has no bar the cap can give it, so its bar is an owner
   decision recorded in the register before that phase starts.
   *Continue* to the enemies; *change provider* (the whole-cast re-gate, README money
   table); or *stop*. The cast is judged once more on
   the real stage at P5's end; a miss there is a light or composition fault and is worked in
   the scene phase, not by regenerating the cast.
3. **When the cast's ceiling is reached** — the $4 000 of per-image spend held as the
   providers' own caps, or, for a subscription winner, a month that ends with the cast
   incomplete (`TECHNICAL.md` § T10.7) — wherever the cast stands: the same three branches — a budget the owner raises by name,
   a change of provider, or stop — and a mixed cast, accepted actors beside fallback ones,
   is then a shipped state the owner approves by name, never a transient. The same
   approval by name covers a first test-track build that ships before the cast is complete
   (a subscription winner's allowance paces P4 over months, README).
4. **An actor that fails the gate three times** (§ F3.4): the same three branches, for
   that actor.

**Stop means**: the generated assets are shelved (their provenance kept), the fallback cast
— the prototype's 43 actors' sheets captured at P0 (`TECHNICAL.md` § T10.9) — is the
shipped art, the owner may load P6's plane key instead, only if question 4(b) approves the planes by name (the ceilings are per key, so an unspent sprite cap funds nothing else), and the heroes and
bosses fall back to the owner's option B (hand-drawn pixel grids at the cell, the process
of `prototype/.claude-archive/prompts/pixel-pipeline.md`) if the owner still wants them
redrawn — the twelve master frames ≈ 8–12 sessions at a guessed rate (the study's one frame was
drawn beside other work in one session, so its rate is unmeasured), the derived frames
unmeasured too, outside the aggregate (README money table; question 6). If that
is not affordable, stop means shipping the fallback cast as it is.
Nothing else in the plan depends on the art succeeding; the portraits have their own
fallback (§ F3.3) so the screens never depend on them either.

### F3.6 Credits, licensing, disclosure and continuity

Only providers whose written terms grant commercial rights to the outputs are used
(`TECHNICAL.md` § T10.2 names the current candidates and their terms, verified at P0 and
recorded in `assets/LICENSES.md`); every asset's provenance (provider, model and version,
prompt hash, references, seed where the provider has one, date, licence, the gate result,
who accepted — matched by the merge lane to the approving review) is recorded in a manifest
committed with it. Prompts describe the style in our own bible's words and never name a
third-party game, character or artist, and no third-party artwork is ever used as a
reference image. The credits screen names the providers; the store listings disclose
AI-generated art where the store asks.

**What a licence does not give.** A licence is the right to *use* the outputs. Under the US
Copyright Office's 2025 guidance, output that is wholly machine-generated is not
copyrightable; protection attaches to perceptible human authorship (a recorded hand pass,
a creative arrangement), not to a prompt. The cast can therefore be copied by anyone, and
§ T10.5 forbids the unrecorded hand edits that would add authorship. The residual risk
runs the other way too: a generated actor that resembles someone else's character is
published under the owner's verified developer identity, which § F3.4's criterion 8 and
the prompt rule reduce and nothing removes. The owner approves D9
knowing this; the options, if it matters, are recorded human passes over the accepted
frames (a normalisation step with its own manifest entry), a style model trained on the
hand-drawn study, or accepting the exposure for a free game.

Continuity: providers retire models on a scale of months, and a character added in a later
year must match a cast made by a specific model. Every accepted asset, prompt and reference
is archived; the accepted cast becomes the reference set (and, where the provider supports
it, a trained style reference) for any later actor; a change of provider means a whole-cast
re-gate — priced in the README's money table — never a single-actor one. The cost of a
later character is in § F4.3.

### F3.7 Backdrops, VFX and portraits

The stage is built at P5 over **placeholder backdrops**: one flat, unlit composite of the
prototype's far, mid and floor painters per biome — six images, one per biome, drawn at
every tier — captured once at P0 (`TECHNICAL.md` § T10.9), drawn as a single plane and lit
by the rig from the biome's light data (the pools follow the stage anchors). The real
backdrops are the **scene phase, P6**: four planes per biome as data-driven painters — the
default, inside P6's size — or, where README question 4 approves it by name with its own
budget line, as AI-generated planes; a plane has no actor-shaped gate, so a generated
plane is judged by the scene rulers of `TECHNICAL.md` § T10.4 (the ground strips' values
against the pools and the seat spread, measured with the fallback cast planted at the six
anchors as the fixed reference P6's ruler frames use too), then by the critic and the
owner, and only from a plane provider whose written commercial terms are verified into
`assets/LICENSES.md` before the branch is taken (§ T10.2's rule, which the P0 check does
not cover for a provider chosen months later); either way with the light wells, the second hue per biome, the bright mass behind
the figures and the plate rules the full-frame critic asked for. VFX stay procedural (they are light, not pictures). Portraits are painted
(§ F3.2).

## F4 Character changes — placeholder for the owner's details

The owner will supply the changes once this plan is final — **and the deadline that
matters is P0's exit**, when P4's cast pass starts (README, the P0 owner row): a brief
supplied by then folds a *changed* hero into the cast at no extra art cost, while a *new*
hero adds its fifteen frames, its ≈ $20–60 and its contact sheet outside the 43-actor,
645-frame model (§ F4.3); a hero changed after its sprites are accepted costs § F4.3's
price and a consistency re-gate against the cast. This
section fixes what a change *is*, what it costs, and the questions the details must
answer, so that the changes can be specified and built without a second planning round.

### F4.1 What the contract fixes today

A character is `CharacterDef`: an id, a name ≤ 16 characters, an element, four base stats
in the launch bands (HP 2000–4500 · ATK 150–320 · DEF 120–280 · SPD 95–120), exactly three
skills (skill 1 at cooldown 0, skills 2–3 at 2–5), exactly one awakening (a stat bonus or
an upgraded skill), one leader skill. `validateData()` enforces the shape; the roster is
"six at launch, growing toward twelve"; all launch characters are unlocked. Numbers are the
simulator's; kits are the contract's.

The closed unions a kit is built from — anything outside them is a *mechanics* change:

| Union | Values |
|---|---|
| Element | FIRE · WIND · WATER · LIGHT · DARK |
| DamageKind | PHYSICAL · MAGIC |
| Skill scale | ATK · DEF · HP (reads max HP) · SPD (reads effective SPD) |
| TargetSpec | ENEMY · ALL_ENEMIES · ALLY · ALL_ALLIES · SELF · LOWEST_HP_ALLY |
| Debuffs | STUN · DEF_BREAK · ATK_BREAK · SLOW · BURN · HEAL_BLOCK · BRAND · SILENCE · GLANCE |
| Buffs | ATK_UP · DEF_UP · SPD_UP · CRIT_UP · SHIELD · IMMUNITY · COUNTER · INVINCIBLE |
| Skill riders | applies (status, chance, turns, magnitude, target) · heal · leech · atbBoost (±) · cleanse · bonusVs · extendDebuffs · refundOnKill |
| Leader skill | one stat, an amount in the stat's unit, optionally a larger amount for members of one element |

### F4.2 The template — one per character or change, with a worked example

| Field | Content | EMBER today |
|---|---|---|
| Identity | id, name, element, one line of who they are | `EMBER`, "Ember", FIRE — the fire mage who burns the whole pack |
| Role | the job in a party and what decision the kit adds to a turn | AoE burner: Flare first to set BURN, Inferno second for ×1.5 on the burning, Cinder to focus the support |
| Bases | HP / ATK / DEF / SPD inside the bands, or a stated reason to widen a band | 2900 / 280 / 150 / 104 |
| Skill 1 | name ≤ 14, cooldown 0, mult, hits, scale, kind, target, riders, the log verb | Cinder — ×1.0, 1 hit, ATK, MAGIC, ENEMY, "scorches" |
| Skill 2 | as above, cooldown 2–5 | Flare — cd 3, ×0.7, 1 hit, ATK, MAGIC, ALL_ENEMIES, applies BURN 0.50 for 2, "flares over" |
| Skill 3 | as above | Inferno — cd 5, ×1.0, 2 hits, ATK, MAGIC, ALL_ENEMIES, ×1.5 vs BURN, "engulfs" |
| Awakening | name and either a stat bonus or the upgraded skill | Inferno also BRANDs (0.75 for 2): skill 3 upgrades to `INFERNO_BRAND` |
| Leader | stat, amount, optional element and elementAmount | ATK +20 %, FIRE members +35 % |
| Art brief | silhouette hook, garment materials, the element ramp, the weapon, the face; portrait notes | a crimson vest with orange trim over dark leather, ember hair with a three-tone flame, a staff held in the hand, a lean stance |
| Class of change | NEW · KIT (skills or awakening) · NUMBERS · ART · REMOVAL | — |

### F4.3 What a change costs

| Class | Size | Spec | Tests | Simulator | Art | Screens |
|---|---|---|---|---|---|---|
| NEW character | S–M each; a batch of six ≈ L | clauses under `spec/characters/<id>.md`; roster and `validateData` clauses | data validity, kit behaviour per skill, awakening, leader | every policy must be able to draft and play it; the ladder and the guards re-measured; "every character leads ≥ 5 %" | 15 frames + portrait through the gate against the accepted cast: ≈ 90–150 generated images, one critic round, the owner's sheet — ≈ $20–60 at the per-image price including re-rolls and the portrait; a whole-cast re-gate after a provider change (§ F3.6) | the draft grid and detail strip must fit (the four-column grid holds twelve) |
| KIT change | S | the skill clauses | the skill's behaviour, the awakening | the ladder and the guards | any pose the kit changes (a new weapon) | none |
| NUMBERS | S | the Balance state | none new | the ladder and the guards | none | none |
| ART | S per actor | `spec/art/` | the gate | none | the frames | none |
| REMOVAL | S | roster clauses | validity | the guards | none | the draft grid; a saved run that names the removed character is abandoned with the Vault untouched — § F2.1's one exception |

A NEW character with a new status kind, target spec or scale is a *mechanics* change and
goes through the clause-first discipline of `TECHNICAL.md` § T7.7 with the owner's decision
before code moves: every status needs a source, a sim interpretation and a screen icon.

### F4.4 When

Character changes can be *specified* at any time (a spec is text); they are *built* after
the P3 rules gate so that the balance table is a known baseline to measure them against —
before or after the store release as the owner decides (§ F4.5, question 5). Their art
follows their spec (a kit decides a weapon and a pose) and is generated against the
accepted cast; details supplied before P4 fold into the cast pass.

### F4.5 Questions the details will need to answer

1. Is the roster growing (toward twelve) or changing (six different ones)? The draft grid
   and the SUMMON offers assume ≤ 12.
2. With a roster over six, what does the draft offer — three of the whole roster, or a
   sampled six — and does a SUMMON still draw from the whole roster? (It moves the landmark
   SUMMONs' odds, the "every character leads ≥ 5 %" guard and the draft grid.)
3. Do any changes add a status kind, a target spec or a scale that the unions above lack?
4. Which of the balance guards may move (a new character shifts leader shares and the
   SABLE/LUMEN guard), and what is the target for each?
5. Are the changes meant to land before the store release (P7) or after?
6. For each character: is there a reference for the look beyond the bible?

## F5 PvP — placeholder for the owner's details

PvP is not designed here. This section records the modes on the table, what the platform
keeps open for them now (cheaply), the constraint determinism imposes, the rules questions
any of them will force, and the questions the owner's brief must answer. PvP is the one
functional item that will reopen the technical plan — a server, accounts, a network module
— and `TECHNICAL.md` § T16 is the seat reserved for it.

### F5.1 Modes on the table

| Mode | The player gets | Needs | Real time |
|---|---|---|---|
| **Async defence** | set a defence party; attack others' parties; the defender is played by a policy | accounts, a server that stores parties and validates results by re-simulating | no |
| **Live lockstep** | two players decide turn by turn against each other | accounts, a relay server, presence, a turn timer, a disconnect rule | yes |
| **Ladder and seasons** | rankings over either mode | a server, anti-cheat by re-simulation, seasons and rewards that do not break permadeath's teeth | no |

### F5.2 What the platform keeps open now, and the one constraint

- Determinism and the decision log (D6): a battle or a whole run is reproducible from
  `(seed, config, decisions)` including every hero turn, so a server can *verify* a claimed
  result by replaying it, and a live match is two decision streams over one seed.
- Canonical serialization of `RunConfig`, `Party`, `Relic` and the decision log
  (`TECHNICAL.md` § T11) — the wire format PvP will need, defined once.
- **The constraint**: replay-verification stops result forgery; it does nothing about
  information cheating. A client that knows the seed can simulate every candidate action to
  the end of the battle before choosing. For any competitive mode the seed must not be known
  to a client ahead of use: either the server holds the rng and streams draws, or each side
  commits to a seed half and reveals it after the turn. The rules take the rng as an
  injected stream, so this is a transport decision, not a rules change — but it is why a
  PvP design cannot simply reuse the single-player save.
- A side-symmetric audit of the rules before PvP is specified: today's rules assume heroes
  versus enemies (enemies wear no sets, ENRAGE and the AI are enemy-only, FOCUS aims at a
  leader, elements alternate by biome; a battle takes one hero-side policy and the enemies
  act through their own AI). A hero party as the *enemy* side is a rules change, and the
  audit lists every clause that assumes the asymmetry. The defender-played-by-a-policy of
  async defence is the smallest such extension.

### F5.3 Rules questions PvP will force

Symmetric sides (sets, sigils, leader skills and pacts on both), whose ascension and laps
apply, what a stall is when both sides are player parties, the turn timer for live play,
matchmaking on power (relic levels, Vault relics), how a defence party is chosen and
whether it may be a party that never won, rewards that stay outside the Vault so the
single-player permadeath keeps its teeth.

### F5.4 Questions the owner's brief will need to answer

1. Which mode first, and is a server the owner will run or a managed service?
2. Accounts: anonymous device ids, or sign-in? (Sign-in changes the store review and the
   privacy story.)
3. Does PvP touch the single-player Vault at all?
4. Is live play worth a relay server and a turn timer at this team size?

## F6 Out of scope now

Porting anything of the prototype but its mechanics, its measured laws and — captured once at P0 — its sprite sheets, flat backdrops, sounds, glyph tables and hand-drawn study;
importing the prototype's browser Vaults; fixing the prototype's screen defects (it is
frozen — unless question 3(c) takes the one named fix); music (the contract has none); monetisation; cloud saves; accounts until PvP;
portrait layout (unless question 2 chooses it); localisation beyond keeping strings in one table; AI backdrops before the
scene phase; controller support (optional); tablet-specific layouts (the frame letterboxes).
Accessibility, deliberately: no screen-reader support, no dynamic type and no reduce-motion
setting are planned; what the readability rules already cover — arm's-length text, the
`TAP_MIN` 96 targets, elements that read apart in greyscale, no flashing above the
hit-flash's mix — stays, and a later request is a § F2 row.

## F7 Functional acceptance

A functional item is done when: its spec clauses exist and are bound to passing tests
(`VERIFICATION.md` § V5); the simulator's guards hold where a rule or a number moved; the
storyboard PNGs of every screen it touches are attached to the change; the feel rubric
(`kmp-quality`) has been walked; and the owner has played it on a device and signed the
checklist row. The plan's own acceptance is § F1.5.
