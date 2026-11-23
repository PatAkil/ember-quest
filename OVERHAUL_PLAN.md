# Ember Quest — gameplay overhaul plan (v3 rules: "The Long Descent")

Status: DRAFT 1, under review. Owner's brief: more gameplay depth and a better
experience; picking up an item must stop feeling like a blind loss; a bigger item
pool; the run must not end at the fourth boss — endless, harder, procedurally
generated; JRPG taste; visuals stay as they are unless there is a good argument.
Goal: a first-time player is blown away.

## 0. What the code says today (the diagnosis)

Measured on `main` (01db0bb), `node sim/run.mjs --runs 1000`: balanced 19 % wins,
13 clears per run, 5.9 items taken, 2.0 upgrades.

1. **Loot is a blind swap.** `equip()` (`game/sim/hero.ts`) overwrites the slot and
   resets its level to 0; the old item and its upgrades are destroyed. The loot card
   shows `VS RUSTY BLADE` and ONE delta line (`biggestDelta` in `ghost.ts`) — never
   the old item's effect, never every stat that changes. An upgraded +2 awakened item
   is silently lost for a sidegrade.
2. **Combat has one decision.** The hero picks ATTACK or the hardest affordable
   spell; the enemy has exactly one move (`enemyAct`: dodge check, one hit).
   `EnemyDef.trait` is a cosmetic string. No telegraphs, no defend, no statuses, no
   weaknesses. The balanced policy's `act` is "hardest hit" — if a policy that simple
   is optimal, the battle is not a decision problem.
3. **The run ends.** `onActCleared` (`game/flow.ts`) sends act 4 to `WIN`. Score is
   `clears * 100`, so every win scores about the same.
4. **Thin variance.** Five room types, one enemy move, upgrades land on a random
   item, no currency, no events. Run N+1 differs only by drops.
5. **Nothing survives a run** except one best score; closing the tab loses the run.
6. **Tooling debt that blocks balance work:** the game's map (`game/mapgen.ts`) and
   the simulator's (`game/sim/map.ts`) are two different generators (DESIGN.md *Open
   item*) — the sim reports 19 % where the real game is nearer 24 %.

Axes moved (designing-mechanics): decision density (pillars A, B, D), build variety
(A, C), run length and variance (D, E), between-run progression (F).

## Decisions taken (owner asked for a recommendation, not a menu)

- **Items: the pack wins over "lose it, but clearer".** A small pack (6 items) plus a
  GEAR screen. Reason: with an inventory the boss becomes a preparation puzzle
  (Dark Lord hexes → wear the MDEF charm tonight), which is the JRPG pleasure the
  owner names; "clearer loss" only removes a frustration, it adds no decision. The
  pack is capped so permadeath pressure and "what do I drop" stay.
- **Endless is a descent, not a treadmill.** Beating the Seraph is still a WIN and is
  banked; the player may then DESCEND into remixed, mutated acts. Depth is the new
  high score.
- **Combat gets JRPG verbs, sized to the 240×160 screen:** enemy intents, GUARD,
  elemental weakness, three status ailments, and a limit break (EMBER BURST).
- **Visuals:** no restyle. New screens reuse the existing panel / command-band /
  medallion language (STYLE.md). Battle fx get only what the new verbs need (status
  pips, intent line, weak/resist pop, burst flash).

## Pillar A — The pack and the GEAR screen

Rules (`game/sim/`, new file `pack.ts`; `Hero` changes in `types.ts`):

- `OwnedItem { item: Item; level: number }`. `hero.equipment: Partial<Record<Slot,
  OwnedItem>>`, `hero.pack: OwnedItem[]`, `PACK_SIZE = 6`. **Levels travel with the
  item**; `hero.levels` disappears. Swapping never destroys anything.
- Taking an ITEM offer: empty slot → equips. Occupied slot → the loot screen asks
  **EQUIP NOW** (old item goes to the pack) or **STOW** (new item goes to the pack).
  Pack full → a third step: choose what to **SALVAGE** (any pack item or the newcomer)
  for embers (pillar E): COMMON 4, RARE 8, EPIC 14, LEGENDARY 22, +50 % per level.
- **GEAR screen** (new sub-scene `GEAR`), opened with **B** from the map and offered
  as "CHECK GEAR" before the boss node resolves. Left column: six slots. Right: pack
  items that fit the selected slot. Picking one swaps. Free, unlimited, only outside
  battle. Bottom band: the full compare (below).
- REVIVE charges are tracked on the hero, not the item, so swapping a Phoenix Tear in
  and out cannot mint lives (already `hero.revived` — keep, add a test).
- `rollItems` excludes ids anywhere in equipment **or pack**.

The compare, everywhere an item is shown against another (loot, gear, forge):

- A two-column **NOW / NEW** card in the command band: both names with rarity colour
  and level; **every** derived stat that differs as `ATK 15 > 19` with gain green /
  loss red (up to 6, two columns of three); then both effect blurbs, labelled
  `LOSE:` (red) and `GAIN:` (green). `describe.ts` gets `compareFull(hero, slot,
  candidate): { rows: {label, before, after, better}[]; lose: string; gain: string }`
  — text comes from the headless side so the sim and screens agree.
- The offer row's hint becomes the verdict: `REPLACES RUSTY BLADE +1` / `EMPTY SLOT`
  / `PACK 4/6`.

## Pillar B — Battle depth (JRPG verbs)

All in `game/sim/combat.ts` split into `combat.ts` (turn order), `moves.ts` (enemy
moves + intent), `status.ts` (ailments), `element.ts` (weakness), `burst.ts`.

1. **Enemy intents.** `EnemyDef.moves: EnemyMove[]` and a `pattern` (cycle or
   weighted, seeded). Moves: `STRIKE` (today's hit), `HEAVY` (telegraphed: the turn
   before it the foe WINDS UP and does nothing; then 2.2× damage), `WARD` (foe gains
   +30 % DEF/MDEF for 2 turns), `AILMENT` (hit at 0.7× that applies a status),
   `MEND` (bosses/elites: heal 12 %, once), `ENRAGE` (bosses below 35 % HP: +25 % ATK,
   announced). `BattleState.intent` is the NEXT enemy move and is always visible on
   the enemy plate (`NEXT: WINDING UP`). Normals get 2 moves, elites 3, bosses 4 with
   an authored pattern each — every boss becomes a recognisable fight.
2. **GUARD** — a fourth permanent command: take 50 % damage until your next turn,
   restore `GUARD_MP` (3) MP, and a guarded HEAVY is **parried**: the foe is STUNNED
   one turn. The answer to a wind-up; MP economy for casters; never optimal to spam
   (a guarded STRIKE trades a turn for 3 MP).
3. **Elements.** `SpellDef.element: 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH' | 'NONE'`
   (FIREBALL fire, WATER water, THUNDER/TWINBOLT thunder, QUAKE earth, SLASH none).
   `EnemyDef.weak?: Element`, `resists?: Element`: 1.5× / 0.5×, shown on the enemy
   plate after the first hit of that element reveals it (and in the codex, pillar F).
   `WEAK!` pop + extra hit-stop. Biomes theme them (Tundra weak to FIRE, Desert to
   WATER, Crypt to THUNDER, Temple to EARTH) with one exception per biome.
4. **Ailments** (max one per side, 3 turns): `BURN` (6 % max HP per turn), `CHILL`
   (−30 % damage dealt), `SHOCK` (next action has 35 % to fizzle). Spells apply their
   element's ailment at 25 % (FIRE→BURN, WATER→CHILL, THUNDER→SHOCK); enemy `AILMENT`
   moves apply theirs to the hero; bosses are immune to SHOCK. MDEF is not
   resistance; a new derived stat is avoided — items grant `WARD_AILMENT`.
5. **EMBER BURST** (limit break). `battle.ember` 0–100, +gain from damage dealt and
   taken (taken counts double), kept between fights within an act, reset on REST.
   At 100 a fifth command appears: `EMBER BURST` — 2.5× weapon-stat hit of the
   weapon's kind that ignores resist and cleanses the hero's ailment. One big button
   per ~3 fights; saving it for the boss is a routing decision.

Sim: `Policy.act` learns GUARD (guard a telegraphed HEAVY when it would deal ≥ 30 %
max HP or MP is short), element choice (expected damage already goes through the
multiplier), and burst timing (bosses/elites, or lethal). A `naive` policy that
never guards and ignores weakness must do clearly worse than `balanced` — that gap is
the proof the verbs are decisions (target: naive ≤ 60 % of balanced's win rate).

## Pillar C — A bigger, wider item pool (41 → ~72)

New `ItemEffect` kinds, each with an exhaustive entry in `STEP`, `GAUGE`,
`EFFECT_WORD`, `AWAKEN_WORDS`, `EFFECT_VALUE`, `EFFECT_KINDS` (the `EffectTable`
type forces it):

- `AILMENT_ON_HIT {ailment, chance}` · `ELEMENT_BOOST {element, mult}` ·
  `GUARD_COUNTER {mult}` (guarding strikes back) · `GUARD_MP {amount}` ·
  `BURST_GAIN {mult}` · `BURST_POWER {mult}` · `WARD_AILMENT {}` ·
  `EMBER_FIND {mult}` (more embers) · `LOW_HP_POWER {threshold, mult}` (desperation)
  · `OVERHEAL_SHIELD {fraction}` (excess healing becomes a shield) ·
  `SPELL_ECHO_ANY {chance}` (any spell may echo).
- ~31 new items across the six slots (5 per slot + one signature item for the Seraph
  + one per endless-only boss variant), each non-legendary with an authored +2
  awakening; four new TOME spells (`FROSTBITE`, `BOLT`? — final list in the data
  milestone): one GUARD-stance spell (`BULWARK`: guard + reflect), one ailment
  cleanser, one earth nuke, one burst-charger.
- **Resonance** (2-piece sets, light): every item gets `family?: 'EMBER' | 'FROST' |
  'STORM' | 'STONE' | 'BLOOD' | 'WARD'`. Wearing 2 of a family lights a small bonus,
  4 a larger one (`RESONANCE` table in `data.ts`). Shown as pips on the GEAR screen.
  This is what makes the pack a build tool instead of a spare tyre.
- `validateData` grows the matching rules (every family has ≥ 4 items across ≥ 3
  slots, every new effect kind is used, names ≤ 13, blurbs ≤ 30).

## Pillar D — The endless descent, procedurally generated

- Beating the Seraph shows the **THRESHOLD** screen: `ASCEND` (end the run: WIN,
  as today) or `DESCEND` (continue). Either way the win is banked
  (`runtime.gameOver({won: true})` fires when the run finally ends; a death after
  descending reports `won: true` with the higher score).
- **Depth** `d = 1, 2, 3…`; each depth is 4 acts. Act index becomes `(depth, act)`.
  `actMult(depth, act) = ACT_MULT[act] * DEPTH_MULT^(depth-1)` (`DEPTH_MULT` ≈ 1.55,
  tuned in sim), `perClear` growth continues. Loot weights use the act-4 row plus a
  legendary bump per depth; `MAX_LEVEL` rises by 1 per depth (a +3 "ascended" tier:
  numeric only, no new authored text) so power has somewhere to go.
- **Procedural generation in the descent** (seeded, headless, in `game/sim/descent.ts`):
  - **Biome remix:** the order of the four biomes is shuffled per depth; each act's
    normal/elite pool is its biome's plus one "invader" from another biome.
  - **Affixes:** every elite (depth ≥ 1, act ≥ 3) and every enemy at depth ≥ 2 rolls
    affixes from a table of ~10 (`VAMPIRIC` heals on hit, `ARMORED`, `WARDED`,
    `FRENZIED` acts twice every third turn, `THORNED`, `VENOMOUS` burn on hit,
    `SWIFT` dodge, `ANCHORED` immune to stun, `HOARDER` drops an extra card, `VOLATILE`
    explodes on death). Count = depth − 1 (max 3). The name reads `FRENZIED YETI`.
  - **Boss mutation:** descent bosses get a second phase move-set and one affix.
  - **Pacts:** entering each new depth the player picks 1 of 3 **pacts** — a curse
    with a boon (`GLASS PACT`: −20 % max HP, +30 % damage; `MISER`: no rest sites, 2×
    embers; `HEX PACT`: every foe has an affix, loot is one rarity higher). Pacts
    stack through the run and are the endless mode's build-defining choice.
  - **Map generator** takes `(depth, act)`: later depths get longer acts (7–8 stages),
    more elites, rarer rests.
- **Score** becomes `clears * 100 * depth + boss bonuses + pact multipliers`; the
  title shows `BEST: DEPTH 3 ACT 2 · 14,200`.

## Pillar E — Embers, the FORGE, and EVENTS (map variety)

- **Embers** (currency): +3 per fight, +6 elite, +10 boss, plus salvage.
- **FORGE** room (new `RoomType`): spend embers to **upgrade the item you choose**
  (cost by rarity and level), **reforge** (reroll the offers of a chest-style table,
  once), or **mend**. Replaces "the upgrade card lands on a random item" as the main
  upgrade path — the random UPGRADE card stays in chests at reduced weight.
- **EVENT** room (`?`): ~14 authored two-choice events as data (`EVENTS` in
  `data.ts`: text ≤ 2 lines × 30 chars, two options with effects from a small effect
  vocabulary: gain/lose HP %, embers, SP, a random item of rarity, an ailment for the
  next fight, upgrade/curse an item, swap two stats). Sim-runnable (policies pick by
  a scored heuristic).
- Map room weights re-tuned: FIGHT 44, ELITE 14, REST 13, LOOT 10, FORGE 8, EVENT 11;
  guarantees: ≥ 1 forge per act from act 2, ≥ 1 event per act.

## Pillar F — Between runs, and the experience around the run

- **Run save / resume.** The run is serialised to localStorage at every map node
  (hero, pack, map, depth, pacts, RNG state — `mulberry32` state so a resumed run is
  the same run). Title offers `CONTINUE`. Death deletes the save (permadeath keeps
  its teeth). Versioned; a save from an older build is discarded, never crashed on.
- **Codex** (`CODEX` screen from the title): items found, enemies met with their
  revealed weakness/moves, deepest depth, wins, deaths by enemy. Persisted. Reveals
  carry over between runs — knowledge is the meta-progression.
- **Origins** (light classes, unlocked by play): KNIGHT (today's hero), MAGE (starts
  with a wand, +MP, −HP; unlocked by a first win), ROGUE (starts with boots, crit;
  unlocked by reaching act 3), PENITENT (starts cursed with a pact and a rare;
  unlocked by reaching depth 2). Chosen on a new ORIGIN screen after the title. No
  permanent stat growth — unlocks widen, never strengthen.
- **Run summary** on GAME OVER / WIN: depth, clears, killer and the move that did it,
  build (gear + resonance), pacts, a "one more run" prompt that lands on the origin
  screen in one press.
- **Onboarding:** first-run contextual one-liners in the battle log band (the first
  wind-up: `IT WINDS UP — GUARD TO PARRY`; first weakness; first full pack), each
  shown once (persisted flag). No tutorial screen.
- **Pause** gains the status panel (gear, pack, pacts) and `ABANDON RUN`.

## Pillar G — Tooling that keeps it honest

- **One map generator.** `generateMap` moves to `game/sim/map.ts` (headless, typed
  for both); `game/mapgen.ts` becomes the thin adapter that adds `stage/slot/cleared`.
  DESIGN.md *Open item* closes; the balance table is re-measured.
- **Policies** learn every new decision (pack/loadout before the boss, guard, burst,
  forge spend, event choice, pact choice, descend-or-ascend) plus `naive`.
- **Sim report** grows: depth reached distribution, median endless death, per-pact
  win rates, per-affix kill share, item/family pick and win rates (dead items and
  dominant items are balance bugs), guard/burst usage.
- **Dev hook + look/verify/oracle:** fixtures and `SCENES` entries for `gear`,
  `forge`, `event`, `threshold`, `pact`, `origin`, `codex`; `&depth=N`.
- Headless unit checks (`npm run rules`, node:test over the esbuild bundle) for the
  invariants the sim cannot see: levels travel with items, pack never exceeds 6,
  save → load → same next roll, no duplicate ids, revive cannot be minted.

## Difficulty targets (restated; DESIGN.md gets these)

Depth 1 (the "story" run) keeps today's contract: act 1 ≥ 70 %, act 2 ≈ 50 %, act 3
≈ 35 %, full run 15–25 % for `balanced`; `random` < 5 %; `naive` ≤ 60 % of balanced.
Endless: of runs that win depth 1 and descend, ≈ 35 % clear depth 2, ≈ 10 % depth 3;
no policy clears depth 5 in 2000 runs (the descent must always kill you). Every
origin within ±5 points of KNIGHT. No item with a pick rate > 60 % when offered or
< 5 %; no family in > 50 % of winning builds.

## Order of work (each milestone green: check, lint, verify, sim reviewed, commit)

| # | Milestone | Modules (writer split) |
|---|---|---|
| M0 | Contract: DESIGN.md v3 + `types.ts` shapes; `npm run rules` harness; unify map generator (behaviour-preserving for the sim side: oracle + `--json`) | orchestrator + 1 writer |
| M1 | Pack: `OwnedItem`, pack rules, compareFull, salvage · loot screen EQUIP/STOW/SALVAGE flow, GEAR screen, compare card | rules writer ∥ screens writer |
| M2 | Battle verbs: intents, GUARD, elements, ailments, burst · battle menu (5 commands), enemy plate intent line, pips, pops | rules writer ∥ screens writer |
| M3 | Embers, FORGE, EVENT rooms, map weights · their screens and map icons | rules writer ∥ screens writer |
| M4 | Item pool + resonance + new spells · icons for new items | data writer ∥ sprites writer |
| M5 | Descent: depth, affixes, pacts, remix, THRESHOLD/PACT screens, score | rules writer ∥ screens writer |
| M6 | Save/resume, codex, origins, run summary, onboarding lines, pause panel | 2 writers split by screen |
| M7 | Balance pass to the targets; DESIGN.md balance table; HANDOVER.md; `verify -- --full` | orchestrator |

After each of M1–M6: a balance checkpoint (sim vs targets), so numbers never drift
more than one milestone from the contract.

## Risks and how the plan answers them

- **Screen real estate (240×160).** Battle menu grows from ≤ 5 to ≤ 7 rows →
  two-column menu already exists (`uniform two-column battle menu`); intent line
  replaces the enemy plate's `STRIKES` word. GEAR screen is two list columns + the
  band. Every new string has a length rule in `validateData`.
- **Lint ceilings** (400 lines / file, complexity 10): combat splits into five
  files up front; every new screen is update + view.
- **Balance blast radius.** Seven systems move the numbers; hence the per-milestone
  checkpoint and the `naive` policy as a control.
- **Scope.** M1, M2 and M5 answer the owner's three explicit asks and ship value
  alone; M3, M4, M6 deepen. If a milestone fails its gates twice it is cut back to
  its core, not carried red.
