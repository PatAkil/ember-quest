# Ember Quest — gameplay overhaul plan (v3 rules: "The Long Descent")

Status: DRAFT 2 (after review round 1). Owner's brief: more gameplay depth and a
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
4. **Thin variance**: five room types, upgrades land on a random item.
5. **Closing the tab loses the run**; a death teaches nothing (no recap).
6. **Two map generators** (`game/mapgen.ts` vs `game/sim/map.ts`): the sim says 19 %
   where the real game is nearer 24 % (DESIGN.md *Open item*).

## Decisions taken

- **The pack wins over "lose it, but clearer"** — and the clearer compare ships too.
  A 4-item pack, free re-equip on the map. The boss becomes a preparation puzzle
  (the Dark Lord hexes → wear the MDEF charm), which is the JRPG pleasure.
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
  stun, FRENZIED/VOLATILE affixes. Listed under *Loose ends* for a later pass.
- **Visuals**: no restyle. New screens reuse panel / command band / medallion.

## Staging — what a player meets, and when

Act 1: intents + GUARD (first wind-up shows the one-line hint), the compare card,
the pack on the second same-slot item. Boss 1: phase 2, BURST (first full gauge
hint). Act 2: weakness tags matter as the WATER scroll arrives; first EVENT room.
Depth 2+: pacts, affixes, invaders. Hints are one line in the battle log band or
the map readout, shown once per profile (persisted flags), never a tutorial screen.

## Pillar A — Compare, pack, GEAR, chosen upgrades

**A1. Full compare (presentation + `describe.ts`, ships first, alone).**
`compareFull(hero, candidate, level): { rows: {label, before, after, better}[];
lose: string; gain: string; kindChange: string }` — every derived stat that differs
(max 6), the outgoing effect blurb, the incoming one, and `kindChange` when a weapon
flips ATTACK between ATK/PHYSICAL and MAG/MAGIC. The loot band in compare mode drops
the medallion and draws 5 lines at pitch 7 (33 px in the 34 px band): `OLD > NEW`
names in rarity colours; two rows × three columns of `ATK 15>19` (gain green, loss
red); `LOSE: …` red; `GAIN: …` green. Row hint: `REPLACES RUSTY BLADE +1` /
`EMPTY SLOT`.

**A2. The pack (additive `Hero` change — nothing existing is retyped).**
- `OwnedItem { item: Item; level: number }`; `hero.pack: OwnedItem[]`,
  `PACK_SIZE = 4`. `hero.equipment` and `hero.levels` stay as they are. New
  `game/sim/pack.ts`: `swapIn(hero, packIndex)` (pack item ↔ its slot; levels travel
  both ways; `clampVitals(hero, 1)`), `stow(hero, item)`, `discard(hero, packIndex)`,
  `ownedIds(hero)`.
- Taking an ITEM: empty slot → equips. Occupied slot → the prompt line toggles with
  Left/Right between `EQUIP` (old item + its level go to the pack) and `STOW` (the
  new item goes to the pack). Default EQUIP. One screen, no extra step.
- Pack full (4) and something must enter it → a `DROP WHICH?` list of the 4 pack
  items + the entering item (5 rows, the loot panel's maximum). Dropped is gone.
- `rollItems` and `signatureFor` exclude ids in `ownedIds`. The starter-weapon
  guarantee looks at equipment only (a packed wand is not a weapon in hand).
  Scrolls never touch the pack.
- REVIVE: charges are spent on the hero (`revived`, `revivedTwice`) — swapping
  cannot mint a life (rules test). GLASS/HP items clamp current HP on equip and do
  not give it back on unequip (already `clampVitals`).
- KEEP YOUR GEAR (25 % mend) stays: "another option in the pack" vs "heal now".

**A3. GEAR screen** (sub-scene `GEAR`): **B on the map**. Left: six slots with the
worn item; Right: pack items; Up/Down moves over slots then pack rows, A on a pack
row swaps it into its slot, B returns to the map. The band shows `compareFull` of
the highlighted pack item against what is worn. Free and unlimited on the map,
impossible in battle. The BOSS node readout says `B CHECK GEAR` and names the
boss's attack type.

**A4. UPGRADE cards choose their target.** An UPGRADE offer no longer names a
random slot: taking it opens a list of upgradable **equipped and packed** items
(each row shows the `+n` and the delta / awakening words). `LootOffer` gains
`{ kind: 'UPGRADE_ANY' }`; the old `UPGRADE` kind stays for the sim's and fixtures'
resolved form.

Policies: equip-vs-stow by `scoring` (keep the higher score worn); before a BOSS
node, wear the best-scoring pack item per slot using a profile shifted toward the
boss's damage kind (MDEF vs a hexer, DEF vs a striker); drop the lowest-scored;
upgrade the worn item with the highest `EFFECT_VALUE`-weighted gain.

## Pillar B — Battle verbs

Files: `game/sim/combat.ts` keeps hero actions; new `enemy-turn.ts` (enemy action +
intent), `moves.ts` (move table, patterns, phases), `element.ts`, `status.ts`
(BURN, WARD timers), `burst.ts`. Presentation splits planned up front:
`screens/battle-menu.ts` (2×2 menu + MAGIC list), `screens/battle-tags.ts` (the tag
strips), `screens/battle-fx-verbs.ts` (guard, parry, burst, burn choreography).

**B1. Enemy moves and intents.** `EnemyDef.moves: MoveId[]` (a cycle),
`phase2?: { at: number; moves: MoveId[]; banner: string }`. `BattleState.intent:
MoveId` is the move the foe will make on its next turn; it is set when the battle is
created and re-set at the end of every enemy action (cycle index; no rng). Moves:

| Move | Effect | Tag text |
|---|---|---|
| `STRIKE` | today's hit | `STRIKES` / `HEXES` |
| `WINDUP` | a 0.6× hit; next intent is forced to `HEAVY` | `WINDS UP` |
| `HEAVY` | 2.2× hit | `HEAVY BLOW` |
| `WARD` | no damage; foe DEF and MDEF +25 (cap 60) for its next 2 turns | `WARDS` |
| `SCORCH` | 0.7× hit; hero gains BURN | `SCORCHES` |
| `MEND` | heals 10 % max HP; at most once per phase | `MENDS` |

Normals: 2-move cycles (e.g. `STRIKE, STRIKE, WINDUP, HEAVY`); elites 3 kinds;
bosses 4 kinds and an authored **phase 2** at 50 % HP for all four story bosses
(banner strip reused from the boss entrance, e.g. `THE YETI RAGES`, a new cycle,
+15 % ATK). Dodge is rolled first as today; a dodged move still advances the cycle.

**B2. GUARD.** Always available. Until the hero's next turn: damage taken ×0.5
(after DEF/MDEF; REFLECT uses the reduced number; BURN/BLOOD ticks are not
reduced). If a hit lands while guarding: +`GUARD_MP` (2) MP. Guarding a `HEAVY` is a
**PARRY**: the hero's next damaging action deals ×1.5 (`battle.riposte`), pop
`PARRY!`. GUARD does not change RAMP stacks or `lastScope`, does not consume
FIRST_STRIKE (`actionsTaken` counts damaging/healing actions only), and regen/BLOOD
tick at turn start as for any action. No stun exists.

**B3. Menu.** Top level 2×2: `ATTACK  MAGIC / GUARD  BURST` (Up/Down/Left/Right,
A select). MAGIC opens the spell list (the current rows, one column, ≤ 6 spells
visible, scrolls if more) with B = back. BURST is dim until the gauge is full.
Input contract (via **handling-user-input**): B declared in `app.ts` as
`BACK / GEAR`; dev hook `press()` gains `B`, `LEFT`, `RIGHT`; `state.ts` gets
`dirEdgeX`.

**B4. Elements.** `Element = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH'`.
`SpellDef.element?` (FIREBALL fire, WATER water, THUNDER and TWINBOLT thunder, QUAKE
earth, LEECH and SLASH none). `EnemyDef.weak?`, `resists?`: ×1.5 / ×0.5 applied
after resist; **always visible** in the enemy tag strip (`WEAK FIRE`). Weapon
attacks have no element unless an item gives `IMBUE` (pillar C). Rule for the data:
each act's commonest weakness is an element the hero can own by then — act 1 FIRE,
act 2 FIRE/WATER, act 3 WATER, act 4 THUNDER; one enemy per biome breaks the theme;
EARTH is the off-meta answer. `WEAK!` pop and a longer hit-stop on a weak hit.

**B5. BURN** (the only ailment). On either side: at the start of the burning side's
turn, lose `burn.perTurn` HP for `burn.turns` (2) turns; `perTurn` = 30 % of the hit
that applied it (min 1); re-applying replaces if larger. Ticks can kill; every hero
death goes through one `heroFalls()` so REVIVE answers ticks too. DRAIN does not
heal from ticks. Sources: enemy `SCORCH`; hero items with `BURN_ON_HIT`.

**B6. EMBER BURST.** `battle.ember` 0–100, **per fight**: +12 per damaging hero
action, +8 when the hero is hit, +25 on a parry. At 100 BURST lights: one hit of
2.5× the weapon swing, ignores DEF/MDEF and WARD, no element, cleanses BURN, empties
the gauge. Normal fights rarely fill it; elites and bosses see it about once — when
(now, or into phase 2 / after a WARD drops) is the decision. Drawn as a 2 px bar
under the hero plate.

**B7. Tag strips** (new, y ≈ 38–46 under each plate, like the RAMP tag): enemy =
intent text + weakness + WARD/BURN pips (+ affix word in the descent); hero = BURN /
GUARD / RIPOSTE pips. The enemy plate's `STRIKES` word moves there.

Policies: `act` gains guard (GUARD when intent is HEAVY and the unguarded hit ≥ 25 %
of current HP, or when MP is short and the intent is not WINDUP), burst (on full
gauge: if the foe is WARDED wait, else fire), and expected damage through weakness.
New control policy **`naive`** = balanced without guard, burst timing or weakness
awareness. Target: naive wins ≤ 65 % of balanced's rate.

## Pillar C — Item pool 41 → ~65

New `ItemEffect` kinds (each completes `STEP`, `GAUGE`, `EFFECT_WORD`,
`AWAKEN_WORDS`, `EFFECT_VALUE`, `EFFECT_KINDS`):
`GUARD_COUNTER {fraction}` (a guarded hit strikes back for a fraction of ATK/MAG) ·
`GUARD_MP {amount}` · `PARRY_POWER {mult}` · `PUNISH_WINDUP {mult}` (bonus vs a foe
whose intent is HEAVY) · `BURST_GAIN {mult}` · `BURST_POWER {mult}` ·
`IMBUE {element}` (weapon attacks carry an element) · `ELEMENT_BOOST {element,
mult}` · `BURN_ON_HIT {chance}` · `BURN_WARD {}` (immune to BURN) ·
`LOW_HP_POWER {threshold, mult}`.

~24 new items: 4 per slot, covering every new kind at least twice, at least one
COMMON per slot whose +2 awakening grants a new kind, 3 new legendaries, and the
Seraph's signature item (`SERAPH`, minAct 3 — offered on the THRESHOLD boss table).
Three new TOME spells: `EMBERS` (fire, 2 hits), `TREMOR` (earth, cheap), `AEGIS`
(guard this turn and reflect 50 %). All text obeys the existing length rules;
`validateData` gains: every new kind used, every element has ≥ 2 hero sources by
act 2, every enemy has moves, every boss has `phase2`.

## Pillar D — The endless descent

- **THRESHOLD** (sub-scene, after the Seraph's loot): `ASCEND` → WIN as today.
  `DESCEND` → the run continues; `g.won = true` is kept. A later death goes to
  GAME_OVER presentation with the headline `FELL AT DEPTH 2` and reports
  `runtime.gameOver({ score, won: true })`. Scene machine unchanged
  (`PLAYING → PLAYING`).
- **Stage counter** `n` = acts cleared this run (0-based act being played);
  `depth = floor(n / 4) + 1`. `actMult(n) = ACT_MULT[n]` for n ≤ 3, else
  `ACT_MULT[3] × DESCENT_GROWTH^(n − 3)` (`DESCENT_GROWTH` 1.18, tuned). Continuous,
  no sawtooth. The clears term in `spawnEnemy` freezes at the clear count held when
  the descent begins.
- **Procedural, seeded, headless** (`game/sim/descent.ts`, `planAct(n, rng):
  ActPlan { biome, normals, elites, boss, affixCount, stages }`):
  biome order reshuffled each depth; each act's pools gain one **invader** from
  another biome; maps get one extra stage per depth (max 8) and an ELITE-heavier
  mix; every boss fights from its phase-2 cycle at 70 % HP.
- **Affixes** (depth ≥ 2 only; normals `depth − 2`, elites and bosses `depth − 1`,
  max 3): `VAMPIRIC` (heals 30 % of damage dealt), `ARMORED` (+20 DEF), `WARDED`
  (+20 MDEF), `THORNED` (returns 20 % of damage taken), `SWIFT` (15 % to evade),
  `VENOMOUS` (its STRIKEs burn). Names stay ≤ 12 chars: affixes show as words in
  the tag strip (first word + `+2`), and the map readout names them.
- **Pacts.** Entering each depth ≥ 2: pick 1 of 3 (from 8), each a curse and a boon
  in a fixed `PactMod` vocabulary; they stack; shown on the pause panel.

  | Pact | Curse | Boon |
  |---|---|---|
  | GLASS | −20 % max HP | +25 % damage dealt |
  | BLOOD | clear heal 25 % → 10 % | +1 SP per clear |
  | HEX | foes +1 affix | loot rolls one rarity higher |
  | IRON | foes +15 % ATK | +15 DEF and MDEF (cap still applies) |
  | MISER | fight drops halved | pack size +2 |
  | STORM | spells cost +2 MP | BURST gauge fills ×1.5 |
  | ASH | REST heals 50 % | every REST also gives an UPGRADE card |
  | HUNTER | elites +30 % HP | elites give +2 SP and a 4th card |

- **Loot in the descent**: weights use the act-4 row with +3 LEGENDARY per depth
  (from COMMON, cap 30); `minAct` satisfied; boss tables are three rolled EPIC+
  (signature items the hero does not own re-enter the roll).
- **Score**: `clears × 100 + 500 per boss + 1000 per depth completed`. Best stored
  as `{ score, depth, act }` under a new storage key (old bare-number best is read
  once as `score`). Title: `BEST 14200  DEPTH 3`.
- Policies: `DESCEND` always (the sim measures the descent); pact by a fixed
  preference list per archetype.

## Pillar E — EVENT rooms (variance from act 1)

New `RoomType` `EVENT` (`?` icon): 8 authored events in `data.ts` (`EVENTS`), each
two lines ≤ 30 chars and two options whose effects come from a fixed vocabulary:
`hpPct`, `maxHp`, `sp`, `item(rarity)`, `upgradeAny`, `burnNextFight`, `fullHeal`,
`dropPackItem`. Example: `A BLEEDING ALTAR` — `GIVE BLOOD: −25 % HP, +2 SP` /
`WALK ON`. Map weights: FIGHT 46, ELITE 15, REST 14, LOOT 12, EVENT 13; ≥ 1 EVENT
per act. Policies choose by a scored heuristic (HP-rich → trade HP).

## Pillar F — The experience around the run

- **Seeded runs + save/resume.** Every real run draws a random seed and uses
  `mulberry32` (moved to `game/sim/util.ts`); the dev-hook contract is unchanged
  (`?seed` fixes it). The run is saved to localStorage **on entering a room**
  (hero with items as ids + levels, pack, map, cursor, n, pacts, clears, score, rng
  state, the room entered) and on returning to the map. Resume replays the entered
  room from its saved rng state — a fight cannot be dodged by closing the tab.
  Title shows `CONTINUE`. Death or ASCEND deletes the save. `version` field; a
  mismatched or corrupt save is dropped silently.
- **Run summary / death recap** on GAME OVER and WIN: depth and act, clears, the
  killer, the move that did it and the last two log lines, the build, pacts.
- **Hints** (staging above): persisted `seen` flags.
- **Pause** shows the status panel (gear, pack count, pacts) and `ABANDON RUN`
  (reports a normal game over).

## Pillar G — Tooling

- **One map generator**: the game's `generateMap` moves into `game/sim/map.ts`
  (headless, parameterised by `ActPlan.stages` and room weights); `game/mapgen.ts`
  becomes the adapter adding `stage/slot/cleared`; the simulator's own linking is
  deleted. The oracle (pixels) stays identical; the sim `--json` changes by design —
  re-baseline once (expected ≈ 24 % balanced) and close DESIGN.md's *Open item*.
- **Rules tests**: `scripts/rules.mjs` (bundles `game/sim.ts` like `sim/run.mjs`,
  runs assertions with `node:assert`) wired into `verify` as gate `rules`: levels
  travel with items, pack ≤ size, no owned id re-rolls, revive cannot be minted,
  intent cycle and phase switch, parry/riposte, burn kill → revive, `actMult`
  monotonic, save → load → identical next rolls.
- **Sim report** adds: depth distribution of descending runs, guard/parry/burst
  use, per-item pick and win rates, per-pact win rates, `naive` vs `balanced`.
- **Dev hook / look / verify / oracle**: fixtures and scene entries for `gear`,
  `event`, `threshold`, `pact`, plus `&depth=N`; the three duplicated `SCENES`
  lists and `devhook`'s `cursors` updated together; `RoomType` defined once
  (`sim/model.ts`) and re-exported.

## Difficulty targets (DESIGN.md gets these)

Story run, `balanced`: act 1 ≥ 80 %, act 2 ≈ 65 %, act 3 ≈ 50 %, full run 30–40 %.
`random` < 8 %. `naive` ≤ 65 % of balanced. Of descending runs: ≈ 40 % clear depth
2, ≈ 10 % depth 3, none clear depth 5 in 2000 runs. No item picked > 70 % or < 5 %
of the times it is offered to `balanced`/`glass`/`tank` combined.

## Order of work

Every milestone: the orchestrator first lands a **types-and-stubs commit** (new
types, exported signatures, DESIGN.md section), then writers run in parallel on
disjoint files, then gates (`verify`, sim reviewed), then commit.

| # | Milestone | Writers (disjoint files) |
|---|---|---|
| M0 | DESIGN.md v3 contract; one map generator; `rules` gate; seeded `mulberry32` in sim util | one writer |
| M1 | A1 compare card · A2 pack rules + policies · A3 GEAR screen · A4 chosen upgrades | rules (`sim/pack, loot, describe, scoring, policies, run`) ∥ screens (`loot*, gear*, status, map, devhook, scripts`) |
| M2 | Battle verbs B1–B7, boss phases, `naive` | rules (`sim/combat, enemy-turn, moves, element, status, burst, policies`, `data` enemies) ∥ screens (`battle*, battle-menu, battle-tags, battle-fx-verbs`, input) |
| M3 | Item pool + spells (C) · EVENT rooms (E) | data+rules ∥ event screen + map icon |
| M4 | Descent (D): `descent.ts`, affixes, pacts, score · THRESHOLD/PACT screens, endings, title best | rules ∥ screens |
| M5 | Save/resume, run summary/recap, hints, pause panel (F) | storage+flow ∥ title/pause views |
| M6 | Balance pass to the targets; DESIGN.md balance table; HANDOVER.md; `verify -- --full`; oracle re-saved | orchestrator |

Balance checkpoints after M1, M2 and M4 (the three that move the numbers most).
Scope guard: M1, M2 and M4 answer the owner's three explicit asks; a milestone that
fails its gates twice is cut back to its core, never carried red.

## Loose ends deliberately left for a later pass

Origins/classes, a codex, resonance sets, a FORGE/currency economy, more ailments,
a daily-seed run on the title, battle-speed toggle, map preview of affixes.
