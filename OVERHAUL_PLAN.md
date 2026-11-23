# Ember Quest — gameplay overhaul plan (v3 rules: "The Long Descent")

Status: DRAFT 4 (after review rounds 1–3). Owner's brief: more gameplay depth and a
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
- **Battle gets JRPG verbs sized to 240×160**: visible enemy intents; GUARD and
  parry **or BREAK the wind-up**; a classic `ATTACK / MAGIC / GUARD / BURST /
  POTION` menu; visible elemental weakness with a damage preview; one ailment
  (BURN); a limit break carried from fight to fight; and **a second phase for every
  story boss** — the wow has to be in the run a new player actually sees.
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
- **Free gear swaps on the map stay** (the owner asked to choose equipment before
  battle). A reviewer warned it can become a chore; the 4-item pack is what bounds
  it (no room for whole alternate sets). If playtests say chore, the fallback is
  "swap only at REST/LOOT/EVENT nodes" — one line in `map.ts`.
- **Visuals**: no restyle. New screens reuse panel / command band / medallion.

## Staging — what a player meets, and when

Act 1: intents + GUARD, the compare card, the pack on the second same-slot item.
Boss 1: phase 2 and (usually) the first full BURST gauge. Act 2: weakness matters as
the WATER scroll arrives; EVENT rooms. Depth 2+: pacts, affixes, invaders. Teaching
is contextual and stateless: while the hero chooses, the band's top line explains
the foe's shown intent in plain words (a table keyed by move, ≤ 52 chars: `IT WINDS
UP - A HEAVY BLOW FOLLOWS`, then `HEAVY BLOW COMING - GUARD IT OR BREAK IT`), and
the death recap ends with a **NEXT TIME** line built from the killing move.

## File ownership rule (applies to every milestone)

`game/types.ts`, `game/state.ts`, `game/frame.ts`, `game/flow.ts`, `game/app.ts`,
`game/devhook.ts`, `game/sim.ts` (barrel), `game/sim/model.ts` (`Policy`, `RoomType`),
`game/data.ts` (barrel, see below), `game/pops.ts`, `game/fx.ts`, `game/fx-state.ts`
and the three `SCENES` lists in `scripts/` are **foundation files**. Each milestone starts
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
  level go to the pack). One screen. (STOW exists because equipping can cost HP for
  good — GLASS — and to save a GEAR trip.)
- A loot screen shows at most 4 offers (boons that add cards stop at 4), so the
  panel (4 offers + KEEP = 5 rows) never reaches the band.
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
where it was opened from (the offers, or an event's options). It resolves to the existing offer kind, whose shape becomes
`{ kind: 'UPGRADE'; target: { where: 'WORN'; slot } | { where: 'PACK'; index };
item; toLevel }`.

**Input contract** (through **handling-user-input**, in M1): B declared in
`app.ts` (`BACK / GEAR`), `dirEdgeX` in `state.ts` (`resetCursorEdge` resets both
axes), dev hook `press()` gains `B`, `LEFT`, `RIGHT`, CLAUDE.md tables updated.

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
`affixes, burn, wardTurns, phase, cycleIndex, mended, staggered`.
`HeroAction = 'ATTACK' | 'GUARD' | 'BURST' | 'POTION' | SpellId`. `HeroActResult`
gains `broke, weak`; `EnemyActResult` gains `move, guarded, parried, staggered,
phaseChanged`; a `TurnStart` result carries burn ticks for both
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
| `WARD` | no damage; while `wardTurns` > 0 resist = min(60, instance + 25), never written into the instance; lasts the hero's next 2 actions (GUARD included); re-applying refreshes | `WARDS` |
| `SCORCH` | 0.7× hit; the hero gains BURN | `SCORCHES` |
| `MEND` | heals 10 % max HP once per phase; afterwards that cycle entry acts as `STRIKE` | `MENDS` |

`validateData`: every `WINDUP` is immediately followed by `HEAVY` in its cycle and
no `HEAVY` appears without one; normals use at most 2 distinct moves besides STRIKE,
elites 3, bosses any. The rules writer authors all 18 cycles and four `phase2`
blocks; the orchestrator reviews them. **Phase switch**: checked after each hero
action when HP ≤ `at` × max and the foe survives (no HP floor). On the switch ATK ×
`atkMult` (1.15) and the banner strip from the boss entrance announces it; **the
move shown when the hero chose always resolves** (a WINDUP's HEAVY too); only then
does the cycle become `phase2.moves` at index 0, which is the next intent shown.
`validateData`: `phase2.moves[0]` is never `HEAVY`. Dodge is rolled first as today
and only for damaging moves; a dodged move still advances the cycle and a dodged
SCORCH applies no BURN.

**BREAK.** While the shown intent is `HEAVY` (the foe is wound up), a hero action
that deals at least `BREAK_AT[kind]` of the foe's max HP (NORMAL 30 %, ELITE 20 %,
BOSS 12 %) cancels the blow: pop `BREAK!`, the foe is `STAGGERED` and loses that
turn (the cycle steps past the HEAVY). So a wind-up poses a question each time:
GUARD it (free; take 1.1×; riposte) or spend the big spell, a weakness hit or the
BURST to break it (take nothing; costs the resource).

**B2. GUARD.** Always available. Until the hero's next turn damage taken ×0.5
(after DEF/MDEF; REFLECT uses the reduced number; BURN/BLOOD ticks are not
reduced). If a hit lands while guarding: +`GUARD_MP_GAIN` (2) MP. Guarding a `HEAVY`
(landed or dodged) is a **PARRY**: `battle.riposte` — every hit of the hero's next
damaging action ×1.5 (not applied to BURST), pop `PARRY!`. Anti-stall: HP/MP regen
does not tick on a turn the hero guards; a GUARD directly after a GUARD is ×0.75 and
gives no MP and no ember — unless it is answering a shown `HEAVY` (full ×0.5, and it
parries). GUARD leaves RAMP stacks and `lastScope` alone and does not consume
FIRST_STRIKE (`actionsTaken` counts damaging/healing actions).

**B3. Menu.** The band's top line (y 120) is the intent hint; below it a 2-column
× 3-row grid at 8 px pitch: `ATTACK  MAGIC / GUARD  BURST / POTION X2`
(Up/Down/Left/Right, A selects). MAGIC opens today's spell grid (2 columns × 3 rows;
pages with Down past the end if more than 6) with B = back; with no affordable spell
it still opens and rows are dim. BURST is dim until the gauge is full, POTION when
none is left. The right-hand info of the highlighted command previews what it will
do against this foe (`MAG X1.5 WEAK`, `-25% WARD`, `BREAKS IT`).

**POTION.** `hero.potions` (start 2, max 2, REST refills): drinking heals 40 % max
HP and uses the turn. "Heal, guard or race" is the genre's core turn.

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
`burn.perTurn` HP; `burn.turns` starts at 3. `perTurn` = 40 % of the hit that applied
it (min 1); re-applying keeps the larger `perTurn` and resets turns to 3. Ticks give
no ember. Ticks can
kill either side: hero deaths all go through one `heroFalls()` (so REVIVE answers a
tick), an enemy killed by a tick ends the fight through the normal victory path.
DRAIN does not heal from ticks. Sources: enemy `SCORCH`; hero `BURN_ON_HIT` gear.

**B6. EMBER BURST.** `hero.ember` 0–100, **carried from fight to fight** (not
reset by REST or acts): +6 per damaging hero action (once per action), +4 when the
hero is hit, +15 on a parry — about one burst per three fights, more in long ones.
At 100 BURST lights: one hit of 2.5× the higher of ATK and MAG, of the weapon's
kind (no crit, no RAMP, no TWIN, no riposte, no +6), ignores DEF/MDEF and WARD, no
element, cleanses BURN, empties the gauge; it leaves riposte, RAMP stacks,
`lastScope` and `actionsTaken` alone. Spend it on this elite, save it for the boss,
or keep it to BREAK a wind-up — that is the decision. Drawn as a 2 px bar under the
hero plate.

**B7. Where it is drawn.** The short intent text (≤ 10 chars) replaces
`STRIKES`/`HEXES` on the enemy plate's third row; the long hint is the band's top
line (B3). A **tag strip** at y 37–43 under each plate carries pips and
short words: enemy = weakness, WARD, BURN, affix; hero = RAMP (moved here), BURN,
GUARD, RIPOSTE. `POP_CEIL` moves to 46 so pops never cross the strips; boss sprite
tops are checked with `look` in the milestone (strip text stays within the plate's
96 px).

Policies (`policy-battle.ts`), against a shown HEAVY: kill if possible; else BREAK
if an affordable action reaches the threshold (BURST only against elites and
bosses); else GUARD when the unguarded hit ≥ 20 % of current HP. BURST otherwise on
elites/bosses when the foe is WARDED, its resist ≥ 25, or the hit kills. POTION
below 35 % HP when the fight is not won this turn. Expected damage goes through
weakness. Control policy **`naive`** = balanced without GUARD, BREAK, BURST timing,
POTION or weakness awareness; target naive ≤ 75 % of balanced's win rate,
**measured at the end of M2a before anything is tuned** — if the gap is thinner, the
GUARD factor drops (0.5 → 0.35, HEAVY stays 2.2) until guarding matters.

## Pillar C — Item pool 41 → ~65

New `ItemEffect` kinds (each completes `STEP`, `GAUGE`, `EFFECT_WORD`,
`AWAKEN_WORDS`, `EFFECT_VALUE`, `EFFECT_KINDS`); starting magnitudes in brackets,
tuned in the sim: `GUARD_COUNTER {fraction}` (a guarded hit strikes back for 0.5 of
the weapon stat) · `GUARD_MANA {amount}` (+2 more MP per guarded hit) ·
`PARRY_POWER {mult}` (riposte 1.5 → 2.0) · `PUNISH_WINDUP {mult}` (×1.4 against a
wound-up foe — the break-builder's effect; it counts toward the BREAK threshold) · `BURST_GAIN {mult}` (1.5) · `BURST_POWER {mult}` (1.4) ·
`IMBUE {element}` · `ELEMENT_BOOST {element, mult}` (1.25) · `BURN_ON_HIT {chance}`
(0.25) · `BURN_WARD {}` (immune to BURN; always paired with MDEF on its item) ·
`LOW_HP_POWER {threshold, mult}` (below 35 % HP, ×1.4).

~24 new items: 4 per slot, every new kind at least twice, one COMMON imbued weapon
with `minAct` 0 (fire — the starter-weapon guarantee may offer it) and one with
`minAct` 1 (`validateData`'s "common with an effect" rule is relaxed for `IMBUE`
only), at least one COMMON per slot whose +2
awakening grants a new kind, 3 new legendaries, and the Seraph's signature item
(`bossOnly: 'SERAPH'`, on the Seraph's own boss table). Three new TOME spells:
`EMBERS` (fire, 2 × 0.7 MAG, 7 MP), `TREMOR` (earth, 1.3 ATK, 3 MP), `AEGIS` (5 MP:
a GUARD for every guard rule — parry, MP gain, anti-stall, regen, ember — that also
reflects 50 % of the reduced hit; `SpellDef.guard?: { reflect: number }`). `validateData` gains: every
new kind used, every element has ≥ 2 hero sources by act 2, every enemy has a legal
cycle, every boss a `phase2`.

## Pillar D — The endless descent

- **THRESHOLD** (sub-scene, after the Seraph's loot and again after the last boss
  of every depth): `ASCEND` → WIN, banking a glory bonus of `1000 × depth`.
  `DESCEND` → the run continues with `g.won = true`; dying down there keeps the
  score but not the next bonus — push your luck. A later death shows the GAME
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
  70 % HP; and **the last boss of every descent depth is THE HOLLOW** (below).
  `rollBossLoot` and the map header take the `ActPlan`'s biome
  (`DEPTH 2  ACT 1  THE TUNDRA`).
- **THE HOLLOW** — a mirror of the hero, built at spawn by `hollowOf(hero, n)`:
  the hero's sprite, mirrored and drawn in one dark tint (`drawSprite` `tint`);
  attack kind = the hero's weapon kind; ATK from the hero's best swing × 0.5; HP =
  hero max HP × 4 × `actMult(n) / ACT_MULT[3]`; DEF/MDEF = the hero's; affixes read
  off the hero's gear (DRAIN → VAMPIRIC, REFLECT → THORNED, dodge ≥ 15 → SWIFT,
  BURN_ON_HIT → SEARING, DEF ≥ 30 → ARMORED, MDEF ≥ 30 → WARDED); a fixed cycle with
  one wind-up. It tests the build you made and is different every run. (First thing
  cut if M4b runs long: the depth then ends on the plan's biome boss.)
- **Affixes** (depth ≥ 2 only; normals `depth − 2`, elites and bosses `depth − 1`,
  max 3, no repeats on one foe): `VAMPIRIC` (heals 30 % of damage dealt), `ARMORED`
  (+20 DEF), `WARDED` (+20 MDEF), `THORNED` (returns 20 % of damage taken), `SWIFT`
  (15 % to evade ATTACK and damaging spells: `IT SLIPS AWAY`, a miss pop), `SEARING` (its STRIKEs
  apply BURN). Names stay ≤ 12 chars: affix words live in the tag strip (first word
  + `+2`) and the map readout.
- **Pacts.** Entering each depth ≥ 2: pick 1 of min(3, remaining) offered from the
  8 not yet taken (no skip; each at most once per run; none left → no pact); the
  PACT screen also names the affixes the coming depth can roll; shown on the pause
  panel. `PactMod`
  vocabulary: `maxHpMult, dmgMult, clearHealMult, spPerClear, foeAffix, rarityShift,
  foeAtkMult, spPerBoss, fightDrops, extraCard, attackMult, burstGainMult, restHealMult,
  restUpgrade, eliteHpMult, eliteSp, eliteExtraCard`.

  | Pact | Curse | Boon |
  |---|---|---|
  | BRITTLE | −20 % max HP | +25 % damage dealt |
  | TITHE | clear heal 25 % → 10 % | +1 SP per clear |
  | HEX | foes +1 affix | elite and boss loot rolls one rarity higher |
  | IRON | foes +15 % ATK | +15 % max HP and +1 SP per boss |
  | MISER | FIGHT rooms never drop | every loot screen +1 card |
  | STORM | ATTACK deals −15 % | BURST gauge fills ×1.5 |
  | ASH | REST heals 50 % | every REST also gives an UPGRADE card (a 25 % mend if nothing can be upgraded) |
  | HUNTER | elites +30 % HP | elites give +2 SP and a 4th card |

- **Loot in the descent**: the act-4 weight row with +3 LEGENDARY per depth taken
  from COMMON, then RARE, never below 0 (LEGENDARY cap 30); `minAct` always satisfied; boss tables are three rolled
  EPIC+ (signature items not owned re-enter the roll).
- **Score**: `clears × 100 + 500 per boss`, plus the glory bonus on ASCEND. Best stored as `{ score, depth, act }` under a new
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
`DROP WHICH?`; the option is dim with an empty pack). An option has at most one
screen-opening effect and it is applied last (`validateData`); `hpPct` never takes
HP below 1; `upgradeAny` is dim when nothing can be upgraded; B inside a picker
returns to the event's two options; `pendingBurn` = `3 × actMult` per turn for 3
turns at the next fight's start. At least half the events price their boon in
something lasting (max HP, a pack item), not current HP. Example: `A BLEEDING ALTAR` —
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
  the map is shown and **just before a room's handler runs** — the hero as on the
  map, so entry effects such as the boss heal are not applied twice (hero with
  items as ids + levels, potions, ember, pack, map with enemy ids and affixes, the
  depth's `ActPlan`, cursor, n, pacts, clears, score, rng state, the room entered).
  Resume re-enters the saved room from its saved rng state: a room cannot
  be dodged by closing the tab, though a fight in progress restarts from its first
  turn — accepted, per-turn battle saves are out of scope. Title band: `CONTINUE` /
  `NEW RUN` (NEW RUN over a save asks once). Death or ASCEND deletes the save.
  `version` field; a mismatched or corrupt save is dropped silently.
- **Run summary / death recap** on GAME OVER and WIN: a centre panel (y 40–112, 9
  lines at 8 px pitch, long lines wrapped): depth and act, clears, score, the killer
  and its move, the build (worn gear), pacts, and `NEXT TIME: …` from a table keyed
  by the killing move (`HEAVY` → `GUARD WHEN IT WINDS UP`, burn tick → …).
- **Pause**: Up/Down over `RESUME` / `ABANDON RUN` (A twice to abandon: PAUSED →
  PLAYING → GAME_OVER in the same tick, reported as a normal game over, headline
  `ABANDONED`, no killer line), with the
  status panel (gear, pack count, pacts) drawn above a wider pause box.

## Pillar G — Tooling

- **One map generator**: the game's `generateMap` moves into `game/sim/map.ts` as
  `generateMap(rng, { stageSizes, weights })` with today's values as defaults and
  the same rng call order; `game/mapgen.ts` becomes the adapter adding
  `stage/slot/cleared`; the simulator's own linking is deleted; `RoomType` (with
  `BOSS`) lives in `sim/model.ts`, is exported through the `game/sim.ts` barrel, and
  `state.ts` re-exports it from there. M0's oracle stays pixel-identical;
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
| M1 | Input contract; A1 compare; A2 pack; A3 scouting; A4 GEAR; A5 chosen upgrades | rules (`sim/pack, hero, gear, loot, describe, scoring, map, policies, policy-choices, run*`) ∥ screens (`mapgen`, `screens/loot*, gear*, upgrade-pick, status, map*`) | balanced ≥ M0's rate; pack rules tests green |
| M2a | B1 moves/intents/phases/BREAK, B2 GUARD/parry, B3 menu + POTION, B7 plate + strips, `naive` | rules (`sim/combat, enemy-turn, status, policies, policy-battle`, `rules/enemies`) ∥ screens (`screens/battle*`) | naive ≤ 75 % of balanced; no stall deaths |
| M2b | B4 elements + preview, B5 BURN, B6 BURST | rules (`sim/element, status, burst`, `rules/enemies`) ∥ screens (`battle-tags, battle-fx-verbs, battle-menu`) | story run within 10 points of target |
| M3 | Item pool + spells (C) · EVENT rooms (E) | items (`rules/items`, effect tables in `gear, describe, scoring`) ∥ battle behaviour of the new kinds and spells (`sim/combat, enemy-turn, element, burst, status`, then `screens/battle-fx*`) ∥ events (`rules/events`, `run-rooms`, `policy-choices`, event screen + icon) | every new kind picked; no item > 70 % |
| M4a | THRESHOLD, `actMult`, `planAct` (remix, invaders, stages), score, best | rules (`sim/descent, run*`) ∥ screens (`threshold, title, endings, map-view`) | depth distribution reported; `actMult` tests |
| M4b | Affixes, pacts, PACT screen, THE HOLLOW | rules (`sim/descent, enemy-turn`, `rules/pacts`) ∥ screens (`pact, battle-tags, pause`, hollow sprite) | ≈ 40 % of descenders clear depth 2 (± 15) |
| M5 | Save/resume, run summary + NEXT TIME, pause menu (F) | `storage` + save rules ∥ `title`/ending/pause views | save round-trip test; look at every scene |
| M6 | Balance to the targets; DESIGN.md balance table; HANDOVER.md; `verify -- --full`; oracle re-saved | orchestrator | all targets |

Scope guard: M1, M2a and M4a answer the owner's three explicit asks. A milestone
that fails its gates twice is cut back to the first item on its row (its core),
never carried red.

## Loose ends deliberately left for a later pass

Origins/classes, a codex, resonance sets, a FORGE/currency economy, more ailments,
a daily-seed run on the title, a battle-speed toggle, per-turn battle saves.
