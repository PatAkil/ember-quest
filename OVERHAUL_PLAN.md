# Ember Quest — gameplay overhaul plan (v3 rules: "The Long Descent")

Status: DRAFT 3 (after review rounds 1–2). Owner's brief: more gameplay depth and a
better experience; picking up an item must stop feeling like a blind loss; a bigger
item pool; the run must not end at the fourth boss — endless, harder, procedurally
generated; JRPG taste; visuals stay unless there is a good argument. Goal: a
first-time player is blown away.

## 0. Diagnosis (measured on `main` 01db0bb, `node sim/run.mjs --runs 1000`)

Balanced 19 % wins, 13 clears, 5.9 items taken, 2.0 upgrades per run.

1. **Loot is a blind swap.** `equip()` overwrites the slot and zeroes its level; the
   old item and its upgrades are destroyed. The card shows `VS RUSTY BLADE` and ONE
   delta line (`biggestDelta`) — never the old effect, never every changed stat.
2. **Combat has one decision.** `enemyAct` is one move; `EnemyDef.trait` is cosmetic;
   the best policy is "hardest affordable hit". No telegraph, defend, or weakness.
3. **The run ends** at act 4 (`onActCleared` → `WIN`); score is `clears * 100`.
4. **Thin variance**: five room types, upgrades land on a random item, the foe behind
   a node is unknown so there is nothing to prepare for.
5. **Closing the tab loses the run**; a death teaches nothing (no recap).
6. **Two map generators** (`game/mapgen.ts` vs `game/sim/map.ts`): the sim says 19 %
   where the real game is nearer 24 % (DESIGN.md *Open item*).

## Decisions taken

- **The pack wins over "lose it, but clearer"** — and the clearer compare ships too.
  A 4-item pack, free re-equip on the map, and **the map tells you who waits in each
  room**, so "choose what to wear before the battle" is a real decision every node.
- **Battle gets JRPG verbs sized to 240×160**: visible enemy intents, GUARD and
  parry, a classic `ATTACK / MAGIC / GUARD / BURST` menu, visible elemental weakness,
  one ailment (BURN), a per-fight limit break, and **a second phase for every story
  boss** — the wow has to be in the run a new player actually sees.
- **Endless is a continuous descent**: the Seraph kill is banked as the win; the
  player may ASCEND or DESCEND into shuffled, mutated, ever-steeper acts with pacts
  and enemy affixes. Depth is the new high score.
- **Because the descent now carries the difficulty, the story run gets kinder**:
  full-run target moves from 15–25 % to **30–40 %** for `balanced`, so more players
  reach the part the owner asked for. (Owner may veto; it is one tuning pass.)
- **Cut after review** (each cost more learning or balance surface than joy):
  origins/classes, codex, resonance sets, SHOCK and CHILL, embers/forge/salvage
  (replaced by "the upgrade card lets you choose its target"), a +3 item tier,
  stun, FRENZIED/VOLATILE affixes, per-turn battle saves, a persisted tutorial.
- **Visuals**: no restyle. New screens reuse panel / command band / medallion.

## Staging — what a player meets, and when

Act 1: intents + GUARD, the compare card, the pack on the second same-slot item.
Boss 1: phase 2 and (usually) the first full BURST gauge. Act 2: weakness matters as
the WATER scroll arrives; EVENT rooms. Depth 2+: pacts, affixes, invaders. Teaching
is contextual and stateless: the enemy's intent text itself says what to do the
first times it matters in a run (`WINDS UP - GUARD THE NEXT BLOW`), and the death
recap ends with a **NEXT TIME** line built from the killing move.

## File ownership rule (applies to every milestone)

`game/types.ts`, `game/state.ts`, `game/frame.ts`, `game/flow.ts`, `game/app.ts`,
`game/devhook.ts`, `game/sim.ts` (barrel), `game/data.ts` (barrel, see below) and the
three `SCENES` lists in `scripts/` are **foundation files**. Each milestone starts
with one *foundation step* by a single writer: new types, exported signatures with
placeholder bodies, dispatch-table entries, fixtures, the DESIGN.md section. Only
after that commit do parallel writers start, and they fill in bodies in their own
files only.

`game/data.ts` (328 lines) would pass 400: content moves to `game/rules/items.ts`,
`game/rules/enemies.ts` (defs, moves, phases, affixes), `game/rules/events.ts`,
`game/rules/pacts.ts`, `game/rules/validate.ts`; `game/data.ts` stays the import path
and re-exports (`game/rules/**` is already in the headless lists of ESLint and
dependency-cruiser). Planned splits elsewhere: `sim/run.ts` → `run.ts` + `run-rooms.ts`
+ `run-tally.ts`; `sim/policies.ts` → `policies.ts` + `policy-battle.ts` +
`policy-choices.ts`; `screens/battle-fx.ts` → + `battle-fx-verbs.ts`;
`screens/battle-view.ts` → + `battle-menu.ts`, `battle-tags.ts`.

## Pillar A — Compare, pack, GEAR, scouting, chosen upgrades

**A1. Full compare** (`describe.ts` + loot band). `compareFull(hero, candidate,
level): { rows: {label, before, after, better}[]; lose: string; gain: string;
kindChange: string }` — the derived stats that differ, at most 6, in the fixed
priority `maxHp, atk, mag, def, mdef, crit, dodge, maxMp, hpRegen, mpRegen,
critMult`; the outgoing effect blurb; the incoming one; `kindChange` (e.g.
`ATTACK NOW USES MAG`) when a weapon flips the attack's stat/kind (it then takes the
place of the LOSE line's tail). Band in compare mode: no medallion, 5 lines at pitch
7 (33 px of 34): `OLD > NEW` names in rarity colours; two rows × three columns of
`ATK 15>19` (gain green, loss red); `LOSE: …` red; `GAIN: …` green. The offer row's
hint is the old item's name only (`RUSTY BLADE+1`, fits 64 px) or `EMPTY SLOT`.

**A2. The pack** (additive `Hero` change — nothing existing is retyped).
- `OwnedItem { item: Item; level: number }`; `hero.pack: OwnedItem[]`;
  `packSize(hero)` = `PACK_SIZE` (4). `hero.equipment` / `hero.levels` stay. New
  `game/sim/pack.ts`: `swapIn(hero, packIndex)` (pack item ↔ its slot, levels travel
  both ways, `clampVitals(hero, 1)`), `unequip(hero, slot)` (to pack if room),
  `stow(hero, owned)`, `discard(hero, packIndex)`, `ownedIds(hero)`.
- Taking an ITEM: empty slot → equips. Occupied slot → the prompt line shows
  `< EQUIP >` / `< STOW >`, toggled with Left/Right, default EQUIP (old item and its
  level go to the pack). One screen.
- Pack full and something must enter it → `DROP WHICH?`: the pack items + the
  entering one (5 rows, the panel's maximum; the band shows the highlighted item's
  card). A drops it for good; B cancels back to the offers. Dropping the newcomer
  still counts as having taken the offer (no mend).
- `rollItems` and `signatureFor` exclude `ownedIds`. The starter-weapon guarantee
  looks at equipment only. Scrolls never touch the pack. The equip card reads
  `… GOES TO YOUR PACK`.
- REVIVE charges are spent on the hero (`revived`, `revivedTwice`): swapping cannot
  mint a life (rules test). GLASS/HP items clamp current HP on equip; unequip gives
  nothing back.
- KEEP YOUR GEAR (25 % mend) stays: "another option in the pack" vs "heal now".

**A3. Scouting.** Every FIGHT/ELITE node's enemy is rolled at map generation
(`MapNode.enemyId`); the map readout for the highlighted node shows
`ELITE  FROST WISP  HEXES  WEAK WATER` (name, attack kind, weakness; affix words in
the descent). The boss readout does the same.

**A4. GEAR screen** (sub-scene `GEAR`): **B on the map**; B again returns. Two
112 px columns at 14 px pitch: left the six slots with the worn item, right the pack.
Up/Down runs over slots then pack rows. A on a pack row swaps it into its slot; A on
a slot row unequips it into the pack if there is room (else a refusal blip). No
discard here. The band shows `compareFull` of the highlighted pack item against
what is worn (or the worn item's own card). Free and unlimited on the map,
impossible in battle. The map hint line shows `X GEAR`.

**A5. UPGRADE cards choose their target.** `rollLoot` returns
`{ kind: 'UPGRADE_ANY' }` in game and sim. Taking it opens `UPGRADE WHICH?`: every
upgradable worn or packed item, one-line rows at 9 px pitch (8 visible, scrolls),
each `NAME +n>+n+1`; the band shows the delta or the awakening blurb; B returns to
the offers. It resolves to the existing offer kind, whose shape becomes
`{ kind: 'UPGRADE'; target: { where: 'WORN'; slot } | { where: 'PACK'; index };
item; toLevel }`.

**Input contract** (through **handling-user-input**, in M1): B declared in
`app.ts` (`BACK / GEAR`), `dirEdgeX` in `state.ts`, dev hook `press()` gains `B`,
`LEFT`, `RIGHT`, CLAUDE.md tables updated.

`Policy` grows: `stowOrEquip(hero, item)`, `dropWhich(hero, entering)`,
`upgradeTarget(hero, targets)`, `prepare(hero, foe: EnemyDef)` (called before every
fight: wear the best-scoring pack item per slot under a profile with MDEF ×2 against
a MAGIC attacker, DEF ×2 against a PHYSICAL one). Defaults live in one shared
helper so archetypes override only what differs.

## Pillar B — Battle verbs

Rules files: `combat.ts` (hero actions), new `enemy-turn.ts` (enemy action, intent,
phase), `element.ts`, `status.ts` (BURN, WARD timers), `burst.ts`.
`EnemyInstance` gains `def, mdef` (copied from the definition at spawn, then changed
by affixes/WARD — **all resist math and the enemy plate read the instance**),
`affixes, burn, wardTurns, phase, cycleIndex, mended`.
`HeroAction = 'ATTACK' | 'GUARD' | 'BURST' | SpellId`. `EnemyActResult` gains `move,
guarded, parried, phaseChanged`; a `TurnStart` result carries burn ticks for both
sides.

**B1. Enemy moves and intents.** `EnemyDef.moves: MoveId[]` is a **cycle** (any
length); `phase2?: { at: number; moves: MoveId[]; banner: string; atkMult: number }`.
`battle.intent` = `moves[cycleIndex]` is what the foe does on its next turn, set at
battle creation and advanced after every enemy action (deterministic, no rng).

| Move | Effect | Plate text |
|---|---|---|
| `STRIKE` | today's hit | `STRIKES` / `HEXES` |
| `WINDUP` | a 0.6× hit | `WINDS UP` |
| `HEAVY` | 2.2× hit | `HEAVY BLOW` |
| `WARD` | no damage; instance DEF and MDEF +25 (cap 60) for the hero's next 2 actions | `WARDS` |
| `SCORCH` | 0.7× hit; the hero gains BURN | `SCORCHES` |
| `MEND` | heals 10 % max HP once per phase; afterwards that cycle entry acts as `STRIKE` | `MENDS` |

`validateData`: every `WINDUP` is immediately followed by `HEAVY` in its cycle and
no `HEAVY` appears without one; normals use at most 2 distinct moves besides STRIKE,
elites 3, bosses any. The rules writer authors all 18 cycles and four `phase2`
blocks; the orchestrator reviews them. **Phase switch**: checked after each hero
action when HP ≤ `at` × max; an overkill from above the line still triggers it only
if the foe survives (no HP floor). On the switch the cycle becomes `phase2.moves` at
index 0 and ATK × `atkMult` (1.15) — except a shown `HEAVY` still resolves first, so
the telegraph never lies. The banner strip from the boss entrance announces it.
Dodge is rolled first as today; a dodged move still advances the cycle.

**B2. GUARD.** Always available. Until the hero's next turn damage taken ×0.5
(after DEF/MDEF; REFLECT uses the reduced number; BURN/BLOOD ticks are not
reduced). If a hit lands while guarding: +`GUARD_MP_GAIN` (2) MP. Guarding a `HEAVY`
(landed or dodged) is a **PARRY**: `battle.riposte` — every hit of the hero's next
damaging action ×1.5 (not applied to BURST), pop `PARRY!`. Anti-stall: HP/MP regen
does not tick on a turn the hero guards; a GUARD directly after a GUARD is ×0.75 and
gives no MP and no ember. GUARD leaves RAMP stacks and `lastScope` alone and does
not consume FIRST_STRIKE (`actionsTaken` counts damaging/healing actions).
The opposing choice on a wind-up comes from gear (`PUNISH_WINDUP`, pillar C) and
from the race: a foe at low HP may be cheaper to kill than to guard.

**B3. Menu.** Top level 2×2: `ATTACK  MAGIC / GUARD  BURST` (Up/Down/Left/Right, A
selects). MAGIC opens today's spell grid (2 columns × 3 rows; pages with Down past
the end if more than 6) with B = back; with no affordable spell it still opens and
rows are dim. BURST is dim until the gauge is full.

**B4. Elements.** `Element = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH'`.
`SpellDef.element?` (FIREBALL fire, WATER water, THUNDER and TWINBOLT thunder, QUAKE
earth, LEECH and SLASH none). `EnemyDef.weak?`, `resists?`: ×1.5 / ×0.5 after
resist, each hit of a multi-hit. **Always visible** (tag strip, `WEAK FIRE`). Weapon
attacks carry an element only through `IMBUE` gear (pillar C guarantees a COMMON
imbued weapon from act 1 so physical builds play too). Data rule: each act's
commonest weakness is an element the hero can own by then — act 1 FIRE, act 2
FIRE/WATER, act 3 WATER, act 4 THUNDER; one enemy per biome breaks the theme; EARTH
is the off-meta answer. `WEAK!` pop and a longer hit-stop on a weak hit.

**B5. BURN** (the only ailment). At the start of the burning side's turn it loses
`burn.perTurn` HP; `burn.turns` starts at 2. `perTurn` = 30 % of the hit that applied
it (min 1); re-applying keeps the larger `perTurn` and resets turns to 2. Ticks can
kill either side: hero deaths all go through one `heroFalls()` (so REVIVE answers a
tick), an enemy killed by a tick ends the fight through the normal victory path.
DRAIN does not heal from ticks. Sources: enemy `SCORCH`; hero `BURN_ON_HIT` gear.

**B6. EMBER BURST.** `battle.ember` 0–100, **per fight**: +8 per damaging hero
action (once per action), +5 when the hero is hit, +20 on a parry. At 100 BURST
lights: one hit of 2.5× the weapon swing (no crit, no RAMP, no TWIN, no riposte),
ignores DEF/MDEF and WARD, no element, cleanses BURN, empties the gauge. A boss
fight sees about 1.5 bursts, an elite ≤ 1, a normal fight rarely any. Its edge is
ignoring resist: fire it into a WARD, at a plated foe, or to close out a phase.
Drawn as a 2 px bar under the hero plate.

**B7. Where it is drawn.** The intent text replaces `STRIKES`/`HEXES` on the enemy
plate's third row. A **tag strip** at y 37–43 under each plate carries pips and
short words: enemy = weakness, WARD, BURN, affix; hero = RAMP (moved here), BURN,
GUARD, RIPOSTE. `POP_CEIL` moves to 46 so pops never cross the strips; boss sprite
tops are checked with `look` in the milestone (strip text stays within the plate's
96 px).

Policies (`policy-battle.ts`): GUARD when the intent is HEAVY and the unguarded hit
≥ 20 % of current HP and the foe will not die to this turn's best action; BURST on a
full gauge when the foe is WARDED or its instance resist ≥ 25 or the hit closes a
phase or kills, else hold at most 3 turns; expected damage goes through weakness.
Control policy **`naive`** = balanced without GUARD, BURST timing or weakness
awareness; target naive ≤ 75 % of balanced's win rate, **measured at the end of M2a
before anything is tuned** — if the gap is thinner, HEAVY rises (2.2 → 2.6) until
guarding matters.

## Pillar C — Item pool 41 → ~65

New `ItemEffect` kinds (each completes `STEP`, `GAUGE`, `EFFECT_WORD`,
`AWAKEN_WORDS`, `EFFECT_VALUE`, `EFFECT_KINDS`); starting magnitudes in brackets,
tuned in the sim: `GUARD_COUNTER {fraction}` (a guarded hit strikes back for 0.5 of
the weapon stat) · `GUARD_MANA {amount}` (+2 more MP per guarded hit) ·
`PARRY_POWER {mult}` (riposte 1.5 → 2.0) · `PUNISH_WINDUP {mult}` (×1.4 against a
foe whose intent is HEAVY) · `BURST_GAIN {mult}` (1.5) · `BURST_POWER {mult}` (1.4) ·
`IMBUE {element}` · `ELEMENT_BOOST {element, mult}` (1.25) · `BURN_ON_HIT {chance}`
(0.35) · `BURN_WARD {}` · `LOW_HP_POWER {threshold, mult}` (below 35 % HP, ×1.4).

~24 new items: 4 per slot, every new kind at least twice, one COMMON imbued weapon
with `minAct` 0 and one with `minAct` 1, at least one COMMON per slot whose +2
awakening grants a new kind, 3 new legendaries, and the Seraph's signature item
(`bossOnly: 'SERAPH'`, on the Seraph's own boss table). Three new TOME spells:
`EMBERS` (fire, 2 × 0.7 MAG, 7 MP), `TREMOR` (earth, 1.3 ATK, 3 MP), `AEGIS` (5 MP:
counts as a GUARD this turn — parry and MP gain included — and reflects 50 % of the
reduced hit; `SpellDef.guard?: { reflect: number }`). `validateData` gains: every
new kind used, every element has ≥ 2 hero sources by act 2, every enemy has a legal
cycle, every boss a `phase2`.

## Pillar D — The endless descent

- **THRESHOLD** (sub-scene, after the Seraph's loot): `ASCEND` → WIN as today.
  `DESCEND` → the run continues with `g.won = true`. A later death shows the GAME
  OVER presentation with the headline `FELL AT DEPTH 2` and reports
  `runtime.gameOver({ score, won: true })`. Scene machine unchanged.
- **Stage counter** `n` = index of the act being played (0-based, never resets);
  `depth = floor(n / 4) + 1`. `actMult(n) = ACT_MULT[n]` for n ≤ 3, else
  `ACT_MULT[3] × DESCENT_GROWTH^(n − 3)`; `DESCENT_GROWTH` starts at **1.08** (HP and
  ATK both scale, so threat grows ≈ 1.17× per act) and is tuned to the targets;
  affixes and pacts carry the rest of the steepness. The clears term in `spawnEnemy`
  freezes at the count held when the descent begins.
- **Procedural, seeded, headless** (`game/sim/descent.ts`): `planAct(n, rng):
  ActPlan { biomeIndex, normals, elites, boss, scroll?, affixCount: { normal, elite
  }, stageSizes, weights }`. For n ≤ 3 it returns exactly the story act (no rng
  drawn). For n ≥ 4: biome order reshuffled per depth; each pool gains one
  **invader** from another biome; one extra stage per depth (sizes keep alternating
  2/3, max 8 — `map-view` reads the stage count from the map, not a constant);
  ELITE weight +5 per depth taken from FIGHT; bosses' phase line moves from 50 % to
  70 % HP. `rollBossLoot` and the map header take the `ActPlan`'s biome
  (`DEPTH 2  ACT 1  THE TUNDRA`).
- **Affixes** (depth ≥ 2 only; normals `depth − 2`, elites and bosses `depth − 1`,
  max 3, no repeats on one foe): `VAMPIRIC` (heals 30 % of damage dealt), `ARMORED`
  (+20 DEF), `WARDED` (+20 MDEF), `THORNED` (returns 20 % of damage taken), `SWIFT`
  (15 % to evade a hero action: `IT SLIPS AWAY`, a miss pop), `SEARING` (its STRIKEs
  apply BURN). Names stay ≤ 12 chars: affix words live in the tag strip (first word
  + `+2`) and the map readout.
- **Pacts.** Entering each depth ≥ 2: pick 1 of 3 offered from the 8 not yet taken
  (no skip; each at most once per run); shown on the pause panel. `PactMod`
  vocabulary: `maxHpMult, dmgMult, clearHealMult, spPerClear, foeAffix, rarityShift,
  foeAtkMult, fightDrops, extraCard, spellCostAdd, burstGainMult, restHealMult,
  restUpgrade, eliteHpMult, eliteSp, eliteExtraCard`.

  | Pact | Curse | Boon |
  |---|---|---|
  | BRITTLE | −20 % max HP | +25 % damage dealt |
  | TITHE | clear heal 25 % → 10 % | +1 SP per clear |
  | HEX | foes +1 affix | loot rolls one rarity higher |
  | IRON | foes +15 % ATK | +15 % max HP |
  | MISER | FIGHT rooms never drop | every loot screen +1 card |
  | STORM | spells cost +2 MP | BURST gauge fills ×1.5 |
  | ASH | REST heals 50 % | every REST also gives an UPGRADE card |
  | HUNTER | elites +30 % HP | elites give +2 SP and a 4th card |

- **Loot in the descent**: the act-4 weight row with +3 LEGENDARY per depth taken
  from COMMON (cap 30); `minAct` always satisfied; boss tables are three rolled
  EPIC+ (signature items not owned re-enter the roll).
- **Score**: `clears × 100 + 500 per boss + 1000 per depth completed` (the story win
  counts as depth 1 completed). Best stored as `{ score, depth, act }` under a new
  key; the old bare number is read once as `score`. Title: `BEST 14200  DEPTH 3`;
  the title copy `FOUR ACTS` becomes `FOUR ACTS  THEN THE DESCENT`.
- Sim: runs always DESCEND, capped at n ≤ 40; pact by a fixed preference list per
  archetype.

## Pillar E — EVENT rooms (variance from act 1)

`RoomType` gains `EVENT` (`?` icon; the sprites' own `RoomKind` gains it too). 8
authored events in `game/rules/events.ts`: two lines ≤ 30 chars, two options, each a
list of effects from a fixed vocabulary — `hpPct`, `maxHp`, `sp` (opens LEVELUP),
`item(rarity)` (opens the loot screen with one card), `upgradeAny` (opens `UPGRADE
WHICH?`), `burnNextFight` (`hero.pendingBurn`), `fullHeal`, `dropPackItem` (opens
`DROP WHICH?`; the option is dim with an empty pack). Example: `A BLEEDING ALTAR` —
`GIVE BLOOD: −25 % HP, +2 SP` / `WALK ON`. Screen: a card for the two lines, the
band for the two options. Map weights: FIGHT 46, ELITE 15, REST 14, LOOT 12, EVENT
13; ≥ 1 EVENT per act, placed in stages 1–4 and never linked from a REST. Policies
choose by a scored heuristic (HP-rich → trade HP).

## Pillar F — The experience around the run

- **Seeded runs + save/resume.** `game/sim/util.ts` gains `createSeededRng(seed):
  { next: Rng; getState(): number; setState(s: number): void }` (the dev hook's
  `mulberry32` moves there). `startRun` draws a random seed and installs a seeded
  rng **unless the dev hook already installed one** (the hook's rng always wins;
  CLAUDE.md's dev-hook text is updated). The run is saved to localStorage whenever
  the map is shown and **on entering a room** (hero with items as ids + levels,
  pack, map with enemy ids, cursor, n, pacts, clears, score, rng state, the room
  entered). Resume re-enters the saved room from its saved rng state: a room cannot
  be dodged by closing the tab, though a fight in progress restarts from its first
  turn — accepted, per-turn battle saves are out of scope. Title band: `CONTINUE` /
  `NEW RUN` (NEW RUN over a save asks once). Death or ASCEND deletes the save.
  `version` field; a mismatched or corrupt save is dropped silently.
- **Run summary / death recap** on GAME OVER and WIN: a centre panel (y 40–112, 9
  lines at 8 px pitch, long lines wrapped): depth and act, clears, score, the killer
  and its move, the build (worn gear), pacts, and `NEXT TIME: …` from a table keyed
  by the killing move (`HEAVY` → `GUARD WHEN IT WINDS UP`, burn tick → …).
- **Pause**: Up/Down over `RESUME` / `ABANDON RUN` (A twice to abandon: PAUSED →
  PLAYING → GAME_OVER in the same tick, reported as a normal game over), with the
  status panel (gear, pack count, pacts) drawn above a wider pause box.

## Pillar G — Tooling

- **One map generator**: the game's `generateMap` moves into `game/sim/map.ts` as
  `generateMap(rng, { stageSizes, weights })` with today's values as defaults and
  the same rng call order; `game/mapgen.ts` becomes the adapter adding
  `stage/slot/cleared`; the simulator's own linking is deleted; `RoomType` lives in
  `sim/model.ts` and `state.ts` re-exports it. M0's oracle stays pixel-identical;
  the sim `--json` changes by design — re-baselined once (expected ≈ 24 % balanced),
  DESIGN.md's *Open item* closes. Enemy ids on nodes arrive in M1 (a second,
  deliberate rng-order change).
- **Rules tests**: `sim/bundle.mjs` (the esbuild bundling shared with `sim/run.mjs`,
  so jscpd stays at zero) and `scripts/rules.mjs` (assertions with `node:assert`),
  wired into `verify` as the light gate `rules`. M0 ships map invariants (every node
  reachable; ELITE, REST and LOOT present) and seeded-rng determinism; each
  milestone adds its own (levels travel with items, pack ≤ size, no owned id
  re-rolls, revive cannot be minted, legal cycles, telegraph never lies, phase
  switch, parry/riposte, guard anti-stall, burn kill → revive, `actMult` monotonic,
  `planAct(n ≤ 3)` equals the story, save → load → identical next rolls).
- **Sim report** adds: depth distribution, guard/parry/burst use, per-item pick and
  win rates, per-pact win rates, `naive` vs `balanced`.
- **Dev hook / look / verify / oracle**: fixtures and scene entries for `gear`,
  `event`, `threshold`, `pact`, plus `&depth=N` (look's parameter allow-list too);
  the oracle baseline is re-saved after every milestone's commit (it changes on
  purpose) and used inside a milestone to prove refactor-only steps.
- DESIGN.md v3 also fixes the stale `DEF/MDEF 60 %` line (the cap is 42).

## Difficulty targets (DESIGN.md gets these)

Story run, `balanced`: act 1 ≥ 80 %, act 2 ≈ 65 %, act 3 ≈ 50 %, full run 30–40 %.
`random` < 8 %. `naive` ≤ 75 % of balanced. Of descending runs: ≈ 40 % clear depth
2, ≈ 10 % depth 3, none clear depth 5 in 2000 runs. No item picked > 70 % or < 5 %
of the times it is offered to `balanced`/`glass`/`tank` combined.

## Order of work

Each milestone: foundation step → parallel writers on disjoint files → gates
(`verify`, `rules`, sim reviewed against the pass line) → commit → oracle re-saved.

| # | Milestone | Parallel writers after the foundation step | Pass line |
|---|---|---|---|
| M0 | DESIGN.md v3 contract; one map generator; `rules` gate; seeded rng; `data.ts` split into `game/rules/*` | one writer | oracle identical; balanced re-baselined and recorded |
| M1 | Input contract; A1 compare; A2 pack; A3 scouting; A4 GEAR; A5 chosen upgrades | rules (`sim/pack, loot, describe, scoring, policy-choices, run*`) ∥ screens (`screens/loot*, gear*, upgrade-pick, status, map*`) | balanced ≥ M0's rate; pack rules tests green |
| M2a | B1 moves/intents/phases, B2 GUARD/parry, B3 menu, B7 plate + strips, `naive` | rules (`sim/combat, enemy-turn, status, policy-battle`, `rules/enemies`) ∥ screens (`screens/battle*`) | naive ≤ 75 % of balanced; no stall deaths |
| M2b | B4 elements, B5 BURN, B6 BURST | rules (`sim/element, status, burst`, `rules/enemies`) ∥ screens (`battle-tags, battle-fx-verbs, battle-menu`) | story run within 10 points of target |
| M3 | Item pool + spells (C) · EVENT rooms (E) | `rules/items` + effect tables ∥ `rules/events` + event screen + icon | every new kind picked; no item > 70 % |
| M4a | THRESHOLD, `actMult`, `planAct` (remix, invaders, stages), score, best | rules (`sim/descent, run*`) ∥ screens (`threshold, title, endings, map-view`) | depth distribution reported; `actMult` tests |
| M4b | Affixes, pacts, PACT screen | rules (`sim/descent, enemy-turn`, `rules/pacts`) ∥ screens (`pact, battle-tags, pause`) | ≈ 40 % of descenders clear depth 2 (± 15) |
| M5 | Save/resume, run summary + NEXT TIME, pause menu (F) | `storage` + save rules ∥ `title`/ending/pause views | save round-trip test; look at every scene |
| M6 | Balance to the targets; DESIGN.md balance table; HANDOVER.md; `verify -- --full`; oracle re-saved | orchestrator | all targets |

Scope guard: M1, M2a and M4a answer the owner's three explicit asks. A milestone
that fails its gates twice is cut back to the first item on its row (its core),
never carried red.

## Loose ends deliberately left for a later pass

Origins/classes, a codex, resonance sets, a FORGE/currency economy, more ailments,
a daily-seed run on the title, a battle-speed toggle, per-turn battle saves.
