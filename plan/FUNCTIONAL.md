# Functional plan — what the player gets

This document is the player-facing half of the plan. It says what moves unchanged (the
parity baseline), what a native app changes whether we like it or not, what the mobile app
adds, how the AI-generated character and enemy art is judged, and it holds the two
placeholders the owner will fill later: the character changes (§ F4) and PvP (§ F5). Every
item here is a *specification* change; how it is built and verified is `TECHNICAL.md` and
`VERIFICATION.md`.

The rule that governs this document: **parity before change**. The port reproduces the
v3 game of `DESIGN.md` exactly (§ F1), proven by the oracle traces and the storyboard
drives. Only after the parity gates does anything in § F2–F5 land, each as its own change
with its own spec clauses, tests and, where rules move, simulator guards.

## F1 The parity baseline

### F1.1 The systems that move unchanged

Everything `DESIGN.md` specifies, as it is implemented on `main` at the tag `ts-oracle-v3`.
The inventory below is the checklist the parity gate is signed against; the counts are the
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
| Balance | the Balance state table of `DESIGN.md`: the ladder, the guards, the stall and enrage rates — reproduced to the digit on the same seeds |
| Presentation | 1280×720 logical landscape frame, the HD-2D stage (four planes, light pools derived from the stage anchors, per-actor gain and rim, contact shadows, bloom, grade, vignette, the sky body), the three quality tiers plus ARCADE, 43 actors with five poses, thirteen VFX archetypes, damage pops, the HUD face and the two bitmap fonts, 24 sound effects |

### F1.2 The screens and flows

Ten screens over the run seam, exactly as `DESIGN.md` → *UI constraints* and the region
table lay them out: title · Vault (EQUIP, BANK, DOORS) · draft and SUMMON (the four-column
grid, the detail strip) · leader (the party columns) · map · room card · battle (ribbon, hero
panels, enemy plates, command list, INSPECT, PAUSE) · relic cards and who-wears-it · node
faces (REST, SHRINE, FORGE, ALTAR) · party · act clear · GAME OVER and VICTORY with the doors.
Every tap target keeps its keyboard route (arrows to move focus, A to activate, B to back),
so a desktop build is playable on a keyboard and a phone on touch, in parallel.

### F1.3 What a native app cannot keep identical

These are the only differences the port is allowed to carry. Each is a spec clause in
`spec/platform/` so it is a decision, not drift.

| Difference | On the web today | In the app | Why |
|---|---|---|---|
| Installation and fullscreen | a page; an "add to Home Screen" hint on iPhone; a rotate prompt; fullscreen on first tap | an installed app, fullscreen by nature, landscape by manifest (§ F2.3) | the hints have no meaning in an app |
| Where the Vault lives | `localStorage` under `ember-quest/vault` | the app's private storage, with a schema version and a transfer code from the web (§ F2.4) | browser storage is not reachable from an app |
| Host messages | `postMessage` to an embedding parent (`retrovibe` envelope), a no-op standalone | none | there is no host |
| The HUD face | a system font stack chosen by the browser | one bundled font, the same on every device | consistency across devices; the metrics need one face |
| ARCADE halation | a blurred copy of the frame | present where a cheap frame read exists, otherwise scanlines, vignette and flicker only — the contract's own reduced mode | § TECHNICAL T9.4 |
| Quality tier defaults | HIGH on desktop, MED on a phone by CSS scale | by device class at first launch, adjustable in settings (§ F2.2); the auto-drop to LOW stays | phones differ more than browsers |
| Input surface | mouse, touch, keyboard | touch and, where present, keyboard (desktop, tablets with keyboards); a game controller is optional later | platform |
| Pixel crispness | the whole frame is scaled smooth by CSS | the actor plane draws with nearest sampling where the device scale makes 2 logical px an integer number of device px, else smooth as today | a small win, never a loss |
| The dev hooks | `window.__eq`, `window.__screens` | the same surface as an in-process test API and, in debug builds, a local driver port | the drivers need them |

### F1.4 How parity is accepted

1. **Mechanically**: the oracle traces are identical for every seed × policy × mode in the
   golden set; the balance table reproduces; the storyboard driver plays whole runs through
   the real screens on JVM, Android and iOS and reports `PLAYFULL OK` (`VERIFICATION.md` § V3).
2. **By the owner, on a device**: the parity checklist — one line per row of F1.1 and F1.2 —
   walked on a phone with the storyboard PNGs beside it. The owner signs the checklist; a
   row they cannot verify by playing stays open.
3. **The first-ten-minutes test**: title → draft → the opening SUMMON → leader → map → a
   crypt fight to a KO or a win → INSPECT → PAUSE → a SUMMON room → a SHRINE, on a phone,
   with the reference list of `STATUS.md` "Playing it on a phone" as the rubric: anything
   tapped twice, anything unreadable at arm's length, a frame rate that does not hold
   through a hit.

## F2 Mobile-native changes

Each change is small, lands after the parity gates, and is written as spec clauses under
`spec/platform/` and `spec/meta/` with tests. None changes a rule of the game.

| # | Change | What the player gets | Notes | Size |
|---|---|---|---|---|
| F2.1 | **Resume anywhere** | Closing or being interrupted mid-run — mid-battle too — loses nothing; the app reopens on the same decision | The run is saved after every decision as `(seed, config, decisions)` and replayed on launch (D6). Replay is exact and takes milliseconds. Not a *rewind*: the player cannot undo a decision. | S |
| F2.2 | **Settings** | sound volume and mute; ARCADE on/off; quality tier (AUTO/HIGH/MED/LOW); a "reset the Vault" with a confirm; credits | One screen, reachable from the title and the pause overlay. Haptics on hits is optional and off by default. | S |
| F2.3 | **Orientation and safe areas** | landscape locked; the frame respects notches and rounded corners | The mutable safe inset already exists (24 px, 40 px bottom on phones); it reads the platform insets instead of guessing. Portrait is an owner question (README) and not in this plan. | S |
| F2.4 | **Vault transfer code** | the web build shows a short code on the Vault screen; the app accepts it once and imports the banked relics, `vaultSlots` and the unlocked ascension | The web build gains an export (no rules touched); the app validates the code's checksum and version. One-way, web → app. | S |
| F2.5 | **Interruptions** | a call or a switch to another app pauses the game and the sound; returning resumes on the pause overlay | The web build already auto-pauses on blur; the app does the same on lifecycle events and yields audio focus. | S |
| F2.6 | **App identity** | icon, splash, store listing, a credits screen that names the AI art providers | Store metadata is copy the owner writes; the credits line is required by § F3.6. | S |
| F2.7 | **Device tiers** | a mid-range 2022 phone runs MED at 60 Hz; older devices start LOW; the toggle in settings | The tiers are the contract's; only the *default* per device class is new. | S |
| F2.8 | **Debug drawer (debug builds only)** | seed display, the decision log export, frame-time overlay, tier override, screen fixtures | Stripped from release builds; it is the agents' and the owner's bug-report tool. | S |

Optional, not planned: controller support (cheap on the keyboard route), portrait layout,
localisation beyond keeping strings in one place, cloud saves, accounts (PvP will decide).

## F3 AI-generated character and enemy art

### F3.1 The bar and the bible

The bar is unchanged: Octopath Traveler's HD-2D — small, dense pixel sprites under soft,
lit, blurred dioramas. Fourteen critic rounds and a hand-drawn pixel study defined what that
means in numbers; the bible below is what every generation prompt, every gate and every
critic works from. It is carried into `spec/art/` as clauses.

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
- **Value law.** The figure sits dark on a lit ground: p50 L* ≈ 31–40 with ≥ 45 % of cells
  below L 35 and only the highlights above L 75 (the reference crop: 37 / 45 % / 11.5 %).
  Lit from above: the top quarter ≥ 8 L* lighter than the bottom.
- **Element identity.** The dominant garment ramp is the element's (fire crimson, wind green,
  water teal, light gold, dark plum) over a neutral secondary; the five elements read apart
  in greyscale too.
- **Silhouette.** No two actors' idle silhouettes overlap above 78 % (heroes ≤ 65 %): a
  brim, a horned helm, a coat with tails, a half-cape; a humanoid with a stance has a mirror
  IoU under 85 %.
- **Motion.** Five poses — idle, attack, hurt, cast, dead — three frames each. Idle
  breathes (≥ 17 % of cells change between idle frames); attack travels (a weapon or a
  body moves 4–8 cells); hurt recoils with the crown rising ≥ 1 cell on its first frame;
  dead is a collapse to 25–57 % of the idle height; the settle band 21–39 %; one connected
  component per non-dead frame.
- **What is never generated.** UI, text, VFX, the light rig, the fonts. Backdrops stay the
  exported procedural planes (§ F3.7).

### F3.2 The fork the owner decides: pixel or painted

| Option | The player sees | What it keeps | What it costs |
|---|---|---|---|
| **A — pixel sprites (recommended)** | HD-2D as today, with sprites that finally reach the bar: dense, hand-drawn-looking pixel figures under the soft light | the entire scene rig, the contract's one-pixelated-plane rule, every instrument and criterion, the bar the owner set | the providers must produce clean pixel art at the cell; consistency across 15 frames is the hard part (§ TECHNICAL T10) |
| **B — painted characters** | illustrated figures (a Darkest Dungeon or Slay the Spire register) under the same light rig | the light rig and the screens | the identity: the contract's pixel plane, the value-law instruments and the composition criteria are all written for pixel figures; the rig's gain and rim were tuned on them; every criterion would be re-derived; the bar changes from "Octopath" to something the owner has not named |

Recommendation: **A for sprites, with painted portraits** for the ribbon chips, party
heads and cards, where a painted face reads better at 48 px than a sprite crop and nothing in
the contract forbids it. The fork is open until the P0 bake-off shows six actors both ways
on a phone frame.

### F3.3 The cast and the frames

| What | Count | Canvas | Notes |
|---|---|---|---|
| Heroes | 6 | 64 × 64 cells | five poses × three frames = 15 frames each; authored facing right |
| Normal and elite enemies | 31 | 64 × 64 | same poses; creatures (a raptor, a jelly, a coil) are exempt from the mirror-IoU rule |
| Bosses | 6 | 96 × 96 | same poses; heavier and taller by the size rule |
| Portraits | 43 | painted, ≥ 256 px, cropped to 48-px chips | one per actor; the element mark is drawn by the UI, not painted |
| Total sprite frames | 645 | | plus regeneration; the budget is in `TECHNICAL.md` § T10.7 |

### F3.4 Acceptance criteria — what the player must be able to see

Every generated actor passes the **numeric gate** first (the same instruments the current
repo measures its sheets with, `TECHNICAL.md` § T10.4), then a **critic** (an agent with
eyes on a contact sheet and in a lit battle frame at 1:1 and 2×), then the **owner** on a
phone. The criteria, in the order they are checked:

1. Readable at arm's length on a phone: a hero at 13–17 % of the frame's height; the face two
   dark clusters with a highlight; the weapon held.
2. Distinct: the silhouette rules of § F3.1 across the whole cast, not only within a biome.
3. Consistent: the same character in every frame — palette, proportions and keyline do not
   drift between poses (a frame-to-frame palette overlap ≥ 75 % and a bounding-box height
   within ± 3 cells across idle, attack and cast).
4. Lit: the value law and lit-from-above hold; no halo of light pixels around the keyline
   (a background-removal artefact); nothing pure black, nothing pure white outside a
   specular of ≤ 6 cells.
5. Alive: the motion rules of § F3.1, judged on the pose sheet and in play.
6. In scene: standing on the stage under the biome's light, the figure sits below its
   ground's value (the reference's front figure sits ≈ 18 L below its ground) and the party
   plane reads above the enemy plane, as the round-4 full-frame critic requires.
7. One cast: the six heroes beside each other read as one palette; each biome's pack reads
   as one family; bosses read heavier than their packs.

An actor that fails a criterion twice after regeneration goes back to prompt and reference
design, not to more sampling.

### F3.5 The process as the owner sees it

Per actor: a contact sheet of candidates (colour, greyscale, silhouette, the pose sheet, and
the actor standing in a lit crypt frame at 1:1 and 2×) with the gate's table under it; the
critic's verdict; the owner's yes or no on the sheet. Order: the six heroes first (they are
on every screen), then the EMBER CRYPT (the first ten minutes), then the six bosses, then the
remaining packs by act. The owner never sees an actor that has not passed the gate.

### F3.6 Credits, licensing and disclosure

Only providers whose written terms grant commercial rights to the outputs are used
(`TECHNICAL.md` § T10.6 names the current candidates and their terms); every asset's
provenance (provider, model, prompt hash, seed where the provider has one, date, licence)
is recorded in a manifest committed with it. Prompts describe the style in our own bible's
words and never name a third-party game, character or artist. The credits screen names the
providers. The store listings disclose AI-generated art where the store asks.

### F3.7 Backdrops, VFX and portraits

Backdrops are not regenerated in this plan: the six biomes' painted planes are exported
from the TypeScript pipeline as bitmaps per (biome, tier) and shipped as they are; an
AI-backdrop pass is a later option with the same gate-then-critic process. VFX stay
procedural (they are light, not pictures). Portraits are painted (§ F3.2).

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

### F4.2 The template — one per character or change

| Field | Content |
|---|---|
| Identity | id, name, element, one line of who they are |
| Role | the job in a party (burner, stripper, healer, wall, debuffer, sniper, …) and what decision the kit adds to a turn |
| Bases | HP / ATK / DEF / SPD inside the bands, or a stated reason to widen a band |
| Skills | three: name ≤ 14, cooldown, mult, hits, scale, kind, target, applies (status, chance, turns), heal / leech / atbBoost / cleanse / bonusVs / extendDebuffs / refundOnKill, the log verb |
| Awakening | name and either a stat bonus or the upgraded skill |
| Leader | stat, amount, optional element and elementAmount |
| Art brief | silhouette hook, garment materials, the element ramp, the weapon, the face; portrait notes |
| Class of change | NEW character · KIT change (skills or awakening) · NUMBERS only · ART only · REMOVAL |

### F4.3 What a change costs

| Class | Spec | Tests | Simulator | Art | Screens |
|---|---|---|---|---|---|
| NEW character | clauses under `spec/characters/<id>.md`; roster and `validateData` clauses | data validity, kit behaviour per skill, awakening, leader | every policy must be able to draft and play it; the ladder and the guards re-measured; "every character leads ≥ 5 %" | 15 frames + portrait through the gate | draft grid and detail strip must fit (the four-column grid holds twelve) |
| KIT change | the skill clauses | the skill's behaviour, the awakening | the ladder and the guards | any pose the kit changes (a new weapon) | none |
| NUMBERS | the Balance state | none new | the ladder and the guards | none | none |
| ART | `spec/art/` | the gate | none | the frames | none |
| REMOVAL | roster clauses | validity | the guards | none | the draft grid |

A NEW character with a new status kind is a *mechanics* change and goes through the
designing-mechanics discussion first: every status needs a source, a sim interpretation and
a screen icon.

### F4.4 When

Character changes can be *specified* at any time (a spec is text); they are *built* after
the P5 parity gate so that the balance table is a known baseline to measure them against.
Their art follows their spec (a kit decides a weapon and a pose).

### F4.5 Questions the details will need to answer

1. Is the roster growing (toward twelve) or changing (six different ones)? The draft grid
   and the SUMMON offers assume ≤ 12.
2. Do any changes add a status kind, a target spec or a scale that the closed unions lack?
3. Which of the balance guards may move (a new character shifts leader shares and the
   SABLE/LUMEN guard), and what is the target for each?
4. Are the changes meant to land before the store release (P7) or after?
5. For each character: is there a reference for the look beyond the bible?

## F5 PvP — placeholder for the owner's details

PvP is not designed here. This section records the modes on the table, what the platform
keeps open for them now (cheaply), the rules questions any of them will force, and the
questions the owner's brief must answer.

### F5.1 Modes on the table

| Mode | The player gets | Needs | Real time |
|---|---|---|---|
| **Async defence** | set a defence party; attack others' parties; the defender is played by a policy | accounts, a server that stores parties and validates results by re-simulating | no |
| **Live lockstep** | two players decide turn by turn against each other | accounts, a relay server, presence, a turn timer, a disconnect rule | yes |
| **Ladder and seasons** | rankings over either mode | a server, anti-cheat by re-simulation, seasons and rewards that do not break permadeath's teeth | no |

### F5.2 What the platform keeps open now

- Determinism and the decision log (D6): a battle or a whole run is reproducible from
  `(seed, config, decisions)`, so a server can *verify* a claimed result by replaying it,
  and a live match is two decision streams over one seed.
- Canonical serialization of `RunConfig`, `Party`, `Relic` and the decision log (`TECHNICAL.md`
  § T11) — the wire format PvP will need, defined once.
- A side-symmetric audit of the rules before PvP is specified: today's rules assume heroes
  versus enemies (enemies wear no sets, ENRAGE and the AI are enemy-only, FOCUS aims at a
  leader, elements alternate by biome). A hero party as the *enemy* side is a rules change,
  and the audit lists every clause that assumes the asymmetry.
- The `:core` API can already run a battle with a policy on either side (`simulateBattle`
  takes a policy for the hero side; the enemy side's decisions are the AI's) — the defender-
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
layout, localisation beyond keeping strings in one table, AI backdrops (an option, § F3.7),
controller support (optional), tablet-specific layouts (the 16:9 frame letterboxes).

## F7 Functional acceptance

A functional item is done when: its spec clauses exist and are bound to passing tests
(`VERIFICATION.md` § V5); the simulator's guards hold where a rule or a number moved; the
storyboard PNGs of every screen it touches are attached to the change; and the owner has
played it on a device and signed the checklist row. The plan's own acceptance is § F1.4.
