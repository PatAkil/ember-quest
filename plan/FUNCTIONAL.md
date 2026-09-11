# Functional plan — what the player gets

The player-facing half of the plan. It says what moves unchanged (the parity baseline),
what a native app changes whether we like it or not, what the mobile app proposes to add,
how the AI-generated character and enemy art is judged and when it can be stopped, and it
holds the two placeholders the owner will fill later: the character changes (§ F4) and PvP
(§ F5). Every item here is a *specification* change; how it is built and verified is
`TECHNICAL.md` and `VERIFICATION.md`.

The rule that governs this document: **parity before change**. The port reproduces the
v3 game of `DESIGN.md` exactly (§ F1), proven by the oracle traces and the storyboard
drives. Only after the parity gates does anything in § F2–F5 land, each as its own change
with its own spec clauses, tests and, where rules move, simulator guards.

## F1 The parity baseline

### F1.1 The systems that move unchanged

Everything `DESIGN.md` specifies, as it is implemented on `main` at the tag `ts-oracle-v3`
— where the contract and the code disagree, **the code is the baseline** (the five known
disagreements `STATUS.md` lists are reconciled into the spec at P2, `TECHNICAL.md` § T7.6).
The inventory is the checklist the parity gate is signed against; the counts are the
current content.

| System | Content that must survive |
|---|---|
| Party and stats | 3v3, eight stats (HP ATK DEF SPD flat; CRIT CDMG ACC RES points), the derivation with no compounding, mitigation `def / (def + 900)`, no caps but CRIT 100 at roll time |
| Elements | FIRE ▸ WIND ▸ WATER ▸ FIRE, LIGHT ⇄ DARK; advantage = crit points, disadvantage = the glance; the GLANCE debuff |
| Combat | the event-driven attack bar, the ten-step turn, cooldowns, seventeen statuses with their durations and stacking rule, the ACC/RES landing floor, the damage pipeline, counters, ENRAGE at turn 100, TURN_CAP 500 as a stall |
| Skills | 24 hero skills (six kits of three plus six awakened variants) and every enemy skill in the closed `SkillId` union |
| Characters | six (EMBER, GALE, TIDE, BASALT, SABLE, LUMEN): bases, kits, awakenings, leader skills |
| Enemies | 37 across six biomes (four or five normals, one elite, one boss each), their packs, the scale formula per act, kind, lap and ascension, `BOSS_HP`, `ACT_MULT`, `LAP_MULT`, `CLEAR_GROWTH` |
| Relics | six slots, four rarities, `rollRelic`'s eight ordered draws, substats and the +2/+4/+6 events, drop levels by act, FORGE (+2, recast, rebrand), REST sharpen, sixteen sets (the run's set pool of 2 + 2 plus the Vault's), twelve sigils with kindling at +6, `compare` |
| Run | the map generator (`STAGE_SIZES [2,3,1,3,2]`, landmarks, guarantees, links, adjacency), nine room types, the draft and the two SUMMONs, the leader seat and when it may change, six pacts, the ALTAR, laps under `LAP_MULT`, score |
| Meta | the Vault (12, bank 2 + L − 1 on DESCEND, 1 on death), Vault equip raising the minimum ascension, the A0–A10 ladder, the unlock at the first act-6 kill |
| Balance | the Balance state table of `DESIGN.md`: the ladder, the guards, the stall and enrage rates — reproduced exactly on the same seeds and run counts |
| Presentation | 1280×720 logical landscape frame; the HD-2D stage — four planes with parallax, the key and fill lights, two foot pools derived from the stage anchors, the drifting fog banks, the seeded dust motes, the light shafts, the sky body, per-actor gain and rim, contact shadows with their cast lobe, bloom, grade, vignette; the three quality tiers plus ARCADE; 43 actors with five poses of three frames; thirteen VFX archetypes; damage pops; the HUD face and the two bitmap fonts; 24 sound effects |

### F1.2 The screens and flows

Ten screens over the run seam, exactly as `DESIGN.md` → *UI constraints* and the region
table lay them out: title · Vault (EQUIP, BANK, DOORS) · draft and SUMMON (the four-column
grid, the detail strip) · leader (the party columns) · map · room card · battle (ribbon, hero
panels, enemy plates, command list, INSPECT, PAUSE) · relic cards and who-wears-it · node
faces (REST, SHRINE, FORGE, ALTAR) · party · act clear · GAME OVER and VICTORY with the doors.
Every tap target keeps its keyboard route (arrows to move focus, A to activate, B to back),
so a desktop build is playable on a keyboard and a phone on touch.

### F1.3 What a native app cannot keep identical

These are the only differences the port is allowed to carry. Each is a spec clause under
`spec/platform/` so it is a decision, not drift.

| Difference | On the web today | In the app | Why |
|---|---|---|---|
| Installation and fullscreen | a page; an "add to Home Screen" hint on iPhone; a rotate prompt; fullscreen on first tap | an installed app, fullscreen by nature, landscape by manifest | the hints have no meaning in an app |
| Where the Vault lives | `localStorage` under `ember-quest/vault` | the app's private storage with a schema version; a one-way transfer from the web (§ F2.4, if approved) | browser storage is not reachable from an app |
| Host messages | `postMessage` to an embedding parent, a no-op standalone | none | there is no host |
| The HUD face | a system font stack chosen by the browser | one bundled font, the same on every device | consistency across devices; the metrics need one face |
| Bloom and halation | bloom is derived from the whole frame; ARCADE's halation is a blurred copy of the frame | bloom and halation come from the *bright layer* (VFX, prop glows, the sky body, pops) at quarter resolution, on every platform | one deterministic code path (`TECHNICAL.md` § T9.4); accepted only if the critic cannot prefer the old frame on more than two of the eight comparison frames of the P0 spike |
| Quality tier defaults | HIGH on desktop, MED on a phone by CSS scale | by device class at first launch, adjustable in settings; the auto-drop to LOW stays | phones differ more than browsers |
| Input surface | mouse, touch, keyboard | touch and, where present, keyboard; **Android's back gesture and button act as B** (back / cancel); at the title, and on the map with a run open, back asks before leaving the app; a game controller is optional later | platform |
| Windowing | a browser tab | split-screen, free-form and tablet windows letterbox the 16:9 frame; a resize pauses the game | platform |
| Pixel crispness | the whole frame is scaled smooth by CSS | the actor plane draws with nearest sampling where the device scale makes one cell an integer number of device pixels, else smooth as today | a small win, never a loss |

### F1.4 How parity is accepted

1. **Mechanically** (`VERIFICATION.md` § V3): the oracle traces are identical for every cell
   of the golden coverage matrix; the balance table reproduces; the exported TypeScript
   frames and the Kotlin frames of the same biome, tier and seat agree within the
   visual-parity band (§ V3.11); the storyboard driver plays **all six acts** with the
   strong-party fixture and a two-act run to a KO, through the real screens, on the JVM,
   and two acts on Android and iOS, and reports `PLAYFULL OK`.
2. **By the owner, on a device.** The checklist has two kinds of rows. *Mechanical rows*
   (every row of F1.1 except Presentation's look, and every screen's geometry) are signed by
   the evidence above, with the report attached. *Felt rows* — at most eight — the owner
   walks on a phone: the first ten minutes (below), a KO, INSPECT, PAUSE, a SHRINE, a
   SUMMON with a full party, the map, the Vault's EQUIP and BANK faces. A felt row the
   owner cannot sign stays open and P5 does not close.
3. **The baseline.** Nobody has played the current game. At P0 the owner plays the web
   build on a phone through the first ten minutes and a KO and records what they saw —
   what read, what did not, what they tapped twice. Parity is judged against that record,
   not against memory.
4. **The first-ten-minutes test**: title → draft → the opening SUMMON → leader → map → a
   crypt fight to a KO or a win → INSPECT → PAUSE → a SUMMON room → a SHRINE, on a phone,
   with the rubric of `STATUS.md` "Playing it on a phone": anything tapped twice, anything
   unreadable at arm's length, a frame rate that does not hold through a hit. It is scored
   against the feel checklist of the `kmp-quality` skill (`TECHNICAL.md` § T13.2), not
   against the analysers.

## F2 Mobile-native changes — proposed, the owner approves per row

Each change is small, lands after the parity gates, and is written as spec clauses under
`spec/platform/` and `spec/meta/` with tests. None changes a rule of the game. Nothing in
this table is decided.

| # | Change | What the player gets | Notes | Size |
|---|---|---|---|---|
| F2.1 | **Resume anywhere** | Closing or being interrupted mid-run — mid-battle too — loses nothing; the app reopens on the same decision, or on the same hero turn | The run is saved after every decision, hero turns included, as `(rules version, seed, config, decisions)` and replayed on launch; a small state snapshot rides along so that **an app update never abandons a run**: when the installed rules differ from the save's, the run continues from the snapshot under the new rules and the player is told once (`TECHNICAL.md` § T11). Not a *rewind*: the player cannot undo a decision. | S |
| F2.2 | **Settings** | sound volume and mute; ARCADE on/off; quality tier (AUTO/HIGH/MED/LOW); a "reset the Vault" with a confirm; credits | One screen, reachable from the title and the pause overlay. Haptics on hits is optional and off by default. | S |
| F2.3 | **Orientation and safe areas** | landscape locked; the frame respects notches, rounded corners and the gesture-navigation edges | The mutable safe inset already exists (24 px, 40 px bottom on phones); it reads the platform's insets. Every edge target (PAUSE at the frame's right edge) is tested under gesture navigation. Portrait is an owner question (README) and not in this plan. | S |
| F2.4 | **Vault transfer** (optional) | the web build shows a QR code and a copyable link on the Vault screen; the app scans or receives it once and imports the banked relics, `vaultSlots` and the unlocked ascension | A full Vault is ≈ 3.5 KB as JSON, far too long to type; the transfer is a compact binary encoding of about 150–200 bytes (`TECHNICAL.md` § T11) as a QR code and a deep link, with paste as the fallback. The web build gains an export (no rules touched). One-way, web → app. The owner may drop it: nobody has a Vault yet. | S |
| F2.5 | **Interruptions** | a call or a switch to another app pauses the game and the sound; returning resumes on the pause overlay | The web build already auto-pauses on blur; the app does the same on lifecycle events and yields audio focus. | S |
| F2.6 | **App identity** | icon, splash, store listing, a credits screen that names the AI art providers | Store metadata is copy the owner writes; the credits line is required by § F3.6. | S |
| F2.7 | **Device tiers** | a 2022 mid-range phone runs MED at 60 Hz; older devices start LOW; the toggle in settings | The tiers are the contract's; only the *default* per device class is new. | S |

Optional, not planned: controller support (cheap on the keyboard route), portrait layout,
localisation beyond keeping strings in one place, cloud saves, accounts (PvP will decide).
The debug drawer that agents and the owner use for bug reports is a technical item
(`TECHNICAL.md` § T13.6).

## F3 AI-generated character and enemy art

### F3.1 The bar and the bible

The bar is unchanged: Octopath Traveler's HD-2D — small, dense pixel sprites under soft,
lit, blurred dioramas. Fourteen critic rounds and a hand-drawn pixel study defined what that
means in numbers; the bible below is what every generation prompt, every gate and every
critic works from. It is carried into `spec/art/` as clauses **with each number's
derivation recorded** (the study's crop rectangles from commit `98464a4`, the sheet
metrics of ART-REVIEW.md), because the reference frames themselves are the owner's
screenshots, are not in the repository and never will be.

- **Cell and size.** One cell is 2 screen px at 720p. A hero is 52–58 rows tall and at most
  64 × 48 cells; an ordinary enemy 24–56 rows; a boss 84–96 rows on the 96-cell canvas.
  Feet at the bottom centre; authored facing right (the battle mirrors heroes).
- **Line and tone.** A full 1-px keyline that follows the material (near-black with a hue on
  garments and boots, the material's own dark step on light hair, dark brown on skin);
  interior lines where a form turns; three to four hard-edged tones per material, clean
  clusters, no dithering; folds and accents as 1-px marks; hands drawn; tapered legs; dark
  boots. About 24 colours per actor: the character's element ramp plus neutral secondaries
  shared across the cast.
- **Proportion.** About three heads tall with a big readable head — the reference's chibi
  build, not a slim figure.
- **Value.** The figure sits dark on a lit ground. *Pass* (the ship criteria the sheets are
  measured with today): L* span p2 ≤ 15 and p98 ≥ 85; ≥ 20 % of body cells below L 35 and
  ≥ 20 % of interior cells; ≥ 8 % above L 75; the top quarter ≥ 8 L* lighter than the
  bottom (lit from above). *Target*, reported beside the pass and raised to a pass only by
  the owner: p50 L* 31–40 with ≥ 45 % of cells below L 35 (the reference crop reads
  37 / 45 % / 11.5 % above L 75; the hand-drawn study 31 / 51 %; the kit's EMBER 51 / 43 %).
  In scene: the actor's median value against the ground it stands on ≥ 1.5:1 at both ground
  strips, and no seat's torso median more than 5 L* above the median seat's.
- **Element identity.** The dominant garment ramp is the element's (fire crimson, wind green,
  water teal, light gold, dark plum) over a neutral secondary; the five elements read apart
  in greyscale too.
- **Silhouette.** *Pass*: no two actors' idle silhouettes overlap above 78 % (feet-aligned,
  centred); a humanoid with a stance has a mirror IoU under 85 %; palette overlap between
  actors under 25 %. *Target*: heroes ≤ 65 % against every other actor — a brim, a horned
  helm, a coat with tails, a half-cape.
- **Motion.** Five poses — idle, attack, hurt, cast, dead — three frames each. Frame
  differences are measured **after best-fit alignment** of the two silhouettes, so a
  translation of the whole sprite scores nothing: idle changes ≥ 17 % of cells between
  frames; the settle band 21–39 %; attack moves a *part* (a weapon, an arm, the torso)
  4–8 cells relative to the body; hurt recoils with the crown rising ≥ 1 cell on its first
  frame; dead is a collapse to 25–57 % of the idle height that differs from the idle by
  ≥ 90 % after alignment (never a rotated or clipped idle); one 8-connected component per
  non-dead frame.
- **What is never generated.** UI, text, VFX, the light rig, the fonts. Backdrops are the
  exported planes until the scene phase (§ F3.7).
- **What is never fed to a provider.** Third-party artwork of any kind — no screenshot of
  another game goes in as a reference image. The reference set is the hand-drawn study
  (`game/art/pixel/ember-study.ts`, licence-clean and the one asset that meets the value
  law) and, as they are accepted, our own actors.

### F3.2 The fork the owner decides at the bake-off: pixel or painted

| Option | The player sees | What it keeps | What it costs |
|---|---|---|---|
| **A — pixel sprites (recommended)** | HD-2D as today, with sprites that reach further toward the bar: dense, hand-drawn-looking pixel figures under the soft light | the entire scene rig, the contract's one-pixelated-plane rule, every instrument and criterion, the bar the owner set | the providers must produce clean pixel art at the cell; consistency across 15 frames is the hard part (`TECHNICAL.md` § T10.3) |
| **B — painted characters** | illustrated figures (a Darkest Dungeon or Slay the Spire register) under the same light rig | the light rig and the screens | the identity: the contract's pixel plane, the value-law instruments and the composition criteria are written for pixel figures; every criterion would be re-derived; the bar changes from "Octopath" to something the owner has not named |

Recommendation: **A for sprites, with painted portraits** for the ribbon chips, party heads
and cards, where a painted face reads better at 48 px than a sprite crop. The fork closes at
the **end of the P0 bake-off**, on six actors shown both ways in lit battle frames on a
phone; `spec/art/` is not written until it closes.

**What the numbers cannot promise.** The current kit passes every numeric criterion above
at its pass thresholds and has done so since round 11, at 9/10, and still does not reach the
bar; the pixel study showed why (the kit's palette and construction, not its numbers). The
gate is therefore a floor that keeps bad images away from the owner's eyes, not a proof of
the bar. What proves the bar is the owner looking at lit frames on a phone. The plan makes
that decision explicit twice (§ F3.5) and names what happens on a "no".

### F3.3 The cast and the frames

| What | Count | Canvas | Notes |
|---|---|---|---|
| Heroes | 6 | 64 × 64 cells | five poses × three frames = 15 frames each; authored facing right |
| Normal and elite enemies | 31 | 64 × 64 | same poses; creatures (a raptor, a jelly, a coil) are exempt from the mirror-IoU rule |
| Bosses | 6 | 96 × 96 | same poses; heavier and taller by the size rule |
| Portraits | 43 | painted, ≥ 256 px, cropped to 48-px chips | one per actor; the element mark is drawn by the UI, not painted |
| Total sprite frames | 645 | stored at cell resolution | the budget model is in `TECHNICAL.md` § T10.7 |

### F3.4 Acceptance criteria — what the player must be able to see

Every generated actor passes the **numeric gate** first (§ F3.1's pass thresholds and the
motion rules, measured by the instruments of `TECHNICAL.md` § T10.4 with the targets reported
beside them), then a **critic** (an agent with eyes on a contact sheet and in a lit battle
frame at 1:1 and 2×), then the **owner** on a phone. The criteria, in the order they are
checked:

1. Readable at arm's length on a phone: a hero at 13–17 % of the frame's height; the face two
   dark clusters with a highlight; the weapon held.
2. Distinct: the silhouette rules of § F3.1 across the whole cast, not only within a biome.
3. Consistent: the same character in every frame — palette, proportions and keyline do not
   drift between poses (a frame-to-frame palette overlap ≥ 75 % and a bounding-box height
   within ± 3 cells across idle, attack and cast, after alignment).
4. Lit: the value pass holds; no halo of light pixels around the keyline (a background-
   removal artefact); nothing pure black, nothing pure white outside a specular of ≤ 6 cells.
5. Alive: the motion rules of § F3.1, judged on the pose sheet and in play — a dead pose is
   a collapse, an attack travels.
6. In scene: standing on the stage under the biome's light, the in-scene value rule holds
   (≥ 1.5:1 against the ground at both strips) and the party plane reads above the enemy
   plane, as the round-4 full-frame critic requires.
7. One cast: the six heroes beside each other read as one palette; each biome's pack reads
   as one family; bosses read heavier than their packs.

An actor that fails a criterion twice after regeneration goes back to prompt and reference
design, not to more sampling; an actor that fails three times goes to the stop decision.

### F3.5 The process as the owner sees it, and when it stops

Per actor: a contact sheet of candidates (colour, greyscale, silhouette, the pose sheet, and
the actor standing in a lit crypt frame at 1:1 and 2×) with the gate's table under it; the
critic's verdict; the owner's yes or no on the sheet. Order: the six heroes first (they are
on every screen), then the EMBER CRYPT (the first ten minutes), then the six bosses, then the
remaining packs by act. The owner never sees an actor that has not passed the gate.

Two decision points, each a yes or no from the owner on lit phone frames:

1. **After the bake-off (P0's exit):** six actors, both looks, through the calibrated gate.
   *Continue* with the chosen provider and look; *change provider* (one more bake-off);
   or *stop*.
2. **After the first six accepted actors (the heroes, in P6):** the party on the stage in
   three biomes. *Continue* to the enemies; *change provider*; or *stop*.

**Stop means**: the generated assets are shelved (their provenance kept), the current kit
stays the shipped art, the remaining art budget moves to the scene phase (P6b), and the
heroes and bosses fall back to the owner's option B (hand-drawn pixel grids at the cell,
`.claude/prompts/pixel-pipeline.md`) if the owner still wants them redrawn. Nothing else in
the plan depends on the art succeeding.

### F3.6 Credits, licensing, disclosure and continuity

Only providers whose written terms grant commercial rights to the outputs are used
(`TECHNICAL.md` § T10.6 names the current candidates and their terms, verified at P0 and
recorded in `kmp/assets/LICENSES.md`); every asset's provenance (provider, model and version,
prompt hash, references, seed where the provider has one, date, licence, the gate result,
who accepted) is recorded in a manifest committed with it. Prompts describe the style in
our own bible's words and never name a third-party game, character or artist, and no
third-party artwork is ever used as a reference image. The credits screen names the
providers; the store listings disclose AI-generated art where the store asks.

Continuity: providers retire models on a scale of months, and a character added in a later
year must match a cast made by a specific model. Every accepted asset, prompt and reference
is archived; the accepted cast becomes the reference set (and, where the provider supports
it, a trained style reference) for any later actor; a change of provider means a whole-cast
re-gate, never a single-actor one. The cost of a later character is in § F4.3.

### F3.7 Backdrops, VFX and portraits

Backdrops are not regenerated during the port: the six biomes' painted planes are exported
from the TypeScript pipeline as bitmaps and lit at boot by the same rig, driven by the
exported light data, so the foot pools still follow the stage anchors. The scene work the
full-frame critic asks for (light wells with an interior, a second hue per biome, the bright
mass behind the figures, the plate rules) has its own post-parity phase, **P6b**, in which
the painters are ported or re-authored as data-driven painters — with AI-generated backdrops
as the owner's option, through the same gate-then-critic process. VFX stay procedural (they
are light, not pictures). Portraits are painted (§ F3.2).

## F4 Character changes — placeholder for the owner's details

The owner will supply the changes once this plan is final. This section fixes what a
change *is*, what it costs, and the questions the details must answer, so that the changes
can be specified and built without a second planning round.

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

| Class | Spec | Tests | Simulator | Art | Screens |
|---|---|---|---|---|---|
| NEW character | clauses under `spec/characters/<id>.md`; roster and `validateData` clauses | data validity, kit behaviour per skill, awakening, leader | every policy must be able to draft and play it; the ladder and the guards re-measured; "every character leads ≥ 5 %" | 15 frames + portrait through the gate against the accepted cast: ≈ 90–150 generated images, one critic round, the owner's sheet — ≈ $50–150 at listed prices, more after a provider change (§ F3.6) | the draft grid and detail strip must fit (the four-column grid holds twelve) |
| KIT change | the skill clauses | the skill's behaviour, the awakening | the ladder and the guards | any pose the kit changes (a new weapon) | none |
| NUMBERS | the Balance state | none new | the ladder and the guards | none | none |
| ART | `spec/art/` | the gate | none | the frames | none |
| REMOVAL | roster clauses | validity | the guards | none | the draft grid; a saved run that names the removed character is abandoned with the Vault untouched (§ F2.1's rule) |

A NEW character with a new status kind, target spec or scale is a *mechanics* change and
goes through the clause-first discipline of `TECHNICAL.md` § T7.7 with the owner's decision
before code moves: every status needs a source, a sim interpretation and a screen icon.

### F4.4 When

Character changes can be *specified* at any time (a spec is text); they are *built* after
the P5 parity gate so that the balance table is a known baseline to measure them against.
Their art follows their spec (a kit decides a weapon and a pose) and is generated against
the accepted cast.

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
  commits to a seed half and reveals it after the turn. The rules already take the rng as an
  injected stream (`() -> Double`), so this is a transport decision, not a rules change —
  but it is why a PvP design cannot simply reuse the single-player save.
- A side-symmetric audit of the rules before PvP is specified: today's rules assume heroes
  versus enemies (enemies wear no sets, ENRAGE and the AI are enemy-only, FOCUS aims at a
  leader, elements alternate by biome). A hero party as the *enemy* side is a rules change,
  and the audit lists every clause that assumes the asymmetry.
- The `:core` API can already run a battle with a policy on either side; the defender-
  played-by-a-policy of async defence is the smallest extension.

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

Music (the contract has none), monetisation, cloud saves, accounts until PvP, portrait
layout, localisation beyond keeping strings in one table, AI backdrops before P6b,
controller support (optional), tablet-specific layouts (the 16:9 frame letterboxes).

## F7 Functional acceptance

A functional item is done when: its spec clauses exist and are bound to passing tests
(`VERIFICATION.md` § V5); the simulator's guards hold where a rule or a number moved; the
storyboard PNGs of every screen it touches are attached to the change; the feel checklist
(`kmp-quality`) has been walked; and the owner has played it on a device and signed the
checklist row. The plan's own acceptance is § F1.4.
