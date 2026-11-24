# Ember Quest — systems design (v2: skill points + loot table)

v3 (The Long Descent) is in progress — the approved contract is OVERHAUL_PLAN.md; sections move here as milestones land.

A roguelike JRPG: branching node map per act, turn-based one-on-one battles,
permadeath. v2 replaces the tier-upgrade gear with **skill points** and a
**loot table of named items with unique effects**.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + tuning constants (caps, SP gains) | nothing |
| `game/data.ts` | the content import path: re-exports `game/rules/*` (ITEMS, ENEMIES, SPELLS, BIOMES, LOOT_WEIGHTS, ACT_MULT, the heal constants, `validateData`) | `./rules/*` only |
| `game/rules/*.ts` | the content itself: `items` (ITEMS), `enemies` (ENEMIES), `world` (SPELLS, SPELL_ORDER, BIOMES, ACT_MULT, LOOT_WEIGHTS, LOOT_COUNT, CLEAR_HEAL, BOSS_ENTRY_HEAL, SKIP_MEND, RARITY_COLOR_INDEX), `validate` (`validateData`; never imports `data.ts`) | `../types`, each other |
| `game/sim.ts` | the barrel: the only path presentation and the simulator use to reach the rules (also re-exports `validateData`, `generateMap`, `createSeededRng`, `at`) | `./sim/*`, `./data` |
| `game/sim/*.ts` | pure rules, one concern per file: `util` (clamp, `at`, rng picks, `createSeededRng` — mulberry32 with readable state — and effect tables), `gear` (item levels, upgrades, effective mods/effects), `hero` (derived stats, skill points, heals, equip, spells), `ghost` (stats of a hypothetical equip), `describe` (item/offer/compare text, `compareFull`), `loot` (loot rolls, offers, scrolls, `resolveUpgrade`), `pack` (the pack: `stow`, `discard`, `swapIn`, `unequip`, `ownedIds`, `upgradableTargets`), `combat` (enemy scaling, battle creation, hero actions, damage), `commands` (GUARD, POTION, BURST, BREAK), `enemy-turn` (enemy moves, intent, phase), `status` (turn start, BURN, WARD, `heroFalls`), `element`, `burst`, `map` (**the one map generator**, `generateMap(rng, shape?)`, played by both the screens and the simulator), `model` (`Policy`, `RoomType` including `BOSS`), `scoring`, `policies`, `policy-battle` (how they fight) and `policy-choices` (how the archetypes decide; `DEFAULT_CHOICES` holds the shared pack/upgrade/prepare defaults), `run` (`simulateRun`) | `../types`, `../data`, each other |
| `game/sprites.ts` + `game/sprites/*.ts` | hero/enemy/icon sprites: `helpers`, `hero`, `icons`, one file per biome; `sprites.ts` re-exports them and adds `enemyAnim(id)` | `../engine` only |
| `game/main.ts` + `app`, `state`, `flow`, `frame`, `mapgen`, `theme`, `backdrop`, `widgets`, `pops`, `fx-state`, `fx`, `transition`, `storage`, `lookup`, `screens/*.ts` | presentation: `main.ts` only wires; `app` creates the engine objects and fits the canvas to the window; `state` holds the one `Game` object `g` with per-screen slices; `flow` runs the run (rooms, stages, clears, acts, scene hooks); `frame` dispatches update/render; `mapgen` adapts the shared headless map to the screens (adds `stage`, `slot`, `cleared`); the **fx / transition layer** presents what the rules decided and never decides anything — `fx-state` + `fx` hold the battle-fx clock (actor poses, timed cues, lagging meters, boss banner), `screens/battle-fx` choreographs a turn on it, `screens/battle-fx-verbs` gives each battle verb its beat, `screens/battle-fx-view` draws its shots and banner, `screens/battle-menu` holds the command menu, `screens/battle-tags` the tag strips under the plates, `screens/battle-reach` measures lunges, `transition` reveals each new sub-scene; `screens/` one update file and one view file per screen (`map-view`, `loot-view`, `battle-view`; `plate` holds the shared medallions) | everything |
| `game/devhook.ts` | the dev-only seeded hook (`?seed`, `?scene`, `&act`, `&hold`, `window.__ember`), never in the build | `../engine` types, `./sim`, presentation types |
| `sim/run.mjs`, `sim/bundle.mjs`, `scripts/rules.mjs` | the balance simulator; the shared esbuild bundling of `game/sim.ts`; the rules gate (`npm run rules`, part of `verify`): `node:assert` invariants against the bundle — every map node reachable and linked, one BOSS last, ELITE + REST + LOOT on every map (5000 seeds), seeded-rng determinism and state round-trip, `validateData()` clean | the bundle |

`types.ts`, `data.ts`, `sim.ts` and `game/sim/` are **headless** (no engine, no DOM,
no presentation import, no `Math.random` — every roll takes an injected `rng`) so the
balance simulator can bundle them (`esbuild game/sim.ts --bundle`) and Monte Carlo
thousands of runs. ESLint and dependency-cruiser enforce the boundary.

## Progression

- **Skill points**: NORMAL clear 2 SP, ELITE 3, BOSS 4 (`SP_PER_KIND`). Spent
  on the LEVEL UP screen right after the fight, before loot. One point buys
  `SP_GAIN[stat]`: HP +5, MP +3, ATK +2, MAG +2, DEF +3 %, MDEF +3 %, CRIT +2 %.
- Clears also heal 25 % of max HP/MP (a breather, not a reset). REST = full.
- Boss node: heal 60 % entering. **One boss per act** (the Crypt gauntlet is
  gone: OGRE KING and WRAITH LORD become Crypt elites, DARK LORD is the boss).
- Caps: DEF/MDEF 42 %, CRIT 60 %, DODGE 40 % — items + points together.
- Act-entry spells unchanged: WATER (act 2), SLASH (act 3), THUNDER (act 4).
  TOME items grant extra spells (TWINBOLT, LEECH, QUAKE, MEND) while equipped.

## Items

Six slots, one item each, plus a **4-item pack** (see *v3 — the pack, GEAR and chosen
upgrades*): a new item takes the slot and the old one, with its level, can go to the
pack instead of being lost (the loot screen shows both). Rarity COMMON / RARE / EPIC /
LEGENDARY. Every RARE+ item carries a unique effect (`ItemEffect`). The pool
is ~41 items; names <= 13 chars, blurbs <= 30 chars.

### Upgrades (+1 / +2)

Every equipped item has a level. **+1** scales its numbers (`UPGRADE_SCALE`
on mods, `scaleEffect` on effect magnitudes — downsides never grow). **+2 is
the awakening** (`item.awaken`): an authored change to how the item plays —
a sticky ramp, a hex that converts every physical hit, reflect that answers
hexes too, a common blade that learns to execute. Legendaries stop at +1.
Upgrades arrive as an **UPGRADE card** on the loot screen (v3: the player picks the item, see the v3 section) for one random
equipped, not-maxed item: always in a chest, ~20–25 % of the time from
fights and elites, never from bosses (`UPGRADE_CHANCE`).

### Drop sources

| Source | Drops | Cards | Notes |
|---|---|---|---|
| FIGHT | `FIGHT_DROP_CHANCE` (33 %), pity after `PITY_AFTER` dry fights | 1 | skill points every time; the loot screen only appears on a drop |
| ELITE | always | 3 | the build accelerator: points + breadth, paid in HP and risk |
| LOOT (chest) | always | 2 — an UPGRADE card first when possible | no fight, no points: depth for the build you already have |
| BOSS | always | 3 — pick ONE: the act's **spell scroll**, the boss's **signature item**, one rolled EPIC+ | the run's biggest single decision |

Rarity weights shift toward rare by act (`LOOT_WEIGHTS`). Items already
equipped never re-roll; `minAct` gates the wildest items. The player may
always decline for a 25 % mend. While the hero has no weapon, the first item
offers always include a common blade or wand.

### Spells and boss tables

Spells are no longer learned on act entry. FIREBALL is known from the start;
WATER, SLASH and THUNDER are **scrolls** offered by the boss that ends acts 1,
2 and 3 (`Biome.scroll`). A scroll is learned permanently and takes no slot.
Declining it is a gamble, not a sentence: a missed scroll re-enters later
chests at `MISSED_SCROLL_CHANCE` and the next boss table always carries it.
Each boss also owns one **signature item** (`Item.bossOnly`) that never
appears elsewhere — Dark Lord's crown, Yeti's hide, the Golem's fist.

The map guarantees one elite, one rest and one chest per act. When it has to
invent a chest it places it beside the rest stop so "rest or loot" is a forced
choice at least once; an invented rest or chest never replaces an elite.

Every run is seeded: `startRun` draws a random seed and plays it through
`createSeededRng`, so the rng state is always readable (the dev hook's `?seed`
fixes it instead).

## v3 — the pack, GEAR and chosen upgrades (M1)

- **Pack.** `hero.pack: OwnedItem[]` (`{ item, level }`), at most `PACK_SIZE` = 4
  (`packSize(hero)`). An item's level travels with it everywhere: worn → pack, pack →
  worn, and upgrades to a packed item. `equip` returns the replaced item and its level;
  the caller decides whether it goes to the pack.
- **Taking an ITEM.** Empty slot → it is worn. Occupied slot → `< EQUIP >` / `< STOW >`
  (Left/Right, default EQUIP; `LootScreen.stow`): EQUIP wears it and the old item goes to
  the pack, STOW puts the new one in the pack. A full pack opens `DROP WHICH?` (the pack
  plus the entering item; A drops one for good; B does nothing — the offer is already applied, so a
  choice must be made). Dropping the
  newcomer still counts as taking the offer (no mend). KEEP YOUR GEAR (25 % mend) stays.
- **The loot contract.** `applyOffer(hero, offer, rng, { stow? })` returns
  `{ line, replaced?, stowed, overflow? }`. A full pack never drops anything silently: the
  item that had to enter it comes back as `overflow` (the equip itself has happened), and
  `resolveOverflow(hero, entering, dropIndex)` drops one of `[...pack, entering]` and
  returns it.
- **Owned items never re-roll**: `rollItems` and the boss signature exclude `ownedIds`
  (worn + packed). The starter-weapon guarantee is a rule (`rollLoot` applies it): it
  looks at what is worn only and offers a common weapon that is not already packed. Scrolls
  never touch the pack. A loot screen shows at most 4 offers.
- **REVIVE charges live on the hero** (`revived`, `revivedTwice`), so swapping a spent
  REVIVE item out and in never restores a life. GLASS / HP items clamp current HP when
  worn; taking them off gives nothing back.
- **GEAR** (sub-scene `GEAR`, B on the map, B again returns): the six worn slots and the
  pack (Up/Down run over slots then pack rows; Right jumps to the pack, Left from a pack
  row to its slot). A on a pack row swaps it into its slot (`swapIn`); A on a worn row takes it off
  into the pack if there is room (`unequip`), else a refusal blip. No discarding here.
  Free and unlimited on the map; never in battle. The band shows `compareFull` of the
  highlighted pack item against what is worn.
- **Full compare.** `compareFull(hero, candidate, level)`: every derived stat that
  changes, at most 6, in the order maxHp, atk, mag, def, mdef, crit, dodge, maxMp,
  hpRegen, mpRegen, critMult; LOSE = the worn item's effect blurb at its level, GAIN = the
  candidate's at `level`; `kindChange` (`ATTACK NOW USES MAG`) when a weapon flips the
  attack's kind.
- **Chosen upgrades.** An upgrade card is `{ kind: 'UPGRADE_ANY' }`; taking it opens
  `UPGRADE WHICH?` (the shared `PICK` sub-scene) over every upgradable worn or packed
  item; B returns to where it was opened from. It resolves (`resolveUpgrade`) to
  `{ kind: 'UPGRADE'; target: { where: 'WORN'; slot } | { where: 'PACK'; index }; item;
  toLevel }`.
- **Scouting.** Every FIGHT / ELITE node carries its foe (`MapNode.enemyId`), rolled by the
  map generator from the biome's pools after linking (`generateMap(rng, shape, pools)`;
  without pools nothing is rolled, so a seed's layout does not change); fight rooms read
  it, and the map readout names the highlighted foe. An empty elite pool falls back to
  the normals.
- **Simulator policies** also choose `stowOrEquip` (keep the higher-scored item worn under
  the archetype's profile), `dropWhich` (drop the lowest-scored of pack + entering),
  `upgradeTarget` (the worn item with the best scored gain; a packed one only when nothing
  worn is upgradable), and `prepare(hero, foe)` before every fight and boss (wear the best
  item per slot among worn + packed, weighting MDEF ×2 against a MAGIC attacker and DEF ×2
  against a PHYSICAL one; a swap needs a 0.5-point edge). The `random` policy picks all
  four at random.

## v3 — battle verbs (M2)

Rules live in `game/sim/`: `combat` (spawn, battle creation, ATTACK and spells, the
action dispatch), `commands` (GUARD, POTION, BURST, the BREAK settle), `enemy-turn` (the
enemy's move, intent, cycle and phase), `status` (turn start, BURN, WARD, `heroFalls`),
`element` (`elementMult`), `burst` (ember gain, `canBurst`, the burst blow),
`policy-battle` (how the policies fight). Tuning constants are in `game/types.ts`.

- **Instance stats.** `EnemyInstance` carries `resPhys`/`resMagic` (copied from the
  definition's `def`/`mdef` at spawn, later changed by affixes), `affixes`, `burn`,
  `wardTurns`, `phase`, `cycleIndex`, `mended`, `staggered`. All resist math and the enemy
  plate read the instance (`resistOf(enemy, kind)` adds the ward).
- **Moves and intents.** `EnemyDef.moves` is a cycle of any length; `battle.intent`
  = the move at `cycleIndex` (a spent MEND reads as STRIKE), set at battle creation and
  advanced after every enemy action, deterministic. Dodge is rolled first and only for
  damaging moves; a dodged move still advances the cycle and a dodged SCORCH burns nothing.

  | Move | Effect | Plate text |
  |---|---|---|
  | `STRIKE` | today's hit | `STRIKES` / `HEXES` |
  | `WINDUP` | ×0.6 hit (`WINDUP_MULT`); always followed by `HEAVY` | `WINDS UP` |
  | `HEAVY` | ×2.2 hit (`HEAVY_MULT`) | `HEAVY BLOW` |
  | `WARD` | no damage; `wardTurns` = 2: resist = min(60, instance + 25) for the hero's next 2 actions (GUARD counts); never written into the instance; re-applying refreshes | `WARDS` |
  | `SCORCH` | ×0.7 hit; the hero gains BURN | `SCORCHES` |
  | `MEND` | heals 10 % max HP once per phase; afterwards that entry acts as `STRIKE` | `MENDS` |

  WARD never lowers a resist already above the cap (`max(instance, min(60, instance + 25))`).

  Data rules (`validateData`): every `WINDUP` is immediately followed by `HEAVY` and no
  `HEAVY` stands without one (no wrap-around: a cycle never opens on `HEAVY`); normals use
  at most 2 distinct moves besides STRIKE (WINDUP and HEAVY count as two), elites 3,
  bosses any; every BOSS has a `phase2` and nothing else does; `phase2.moves[0]` is never
  `HEAVY`, its banner is uppercase and ≤ 20 chars, `0 < at < 1`, `atkMult > 0`; no cycle
  is empty; `weak` ≠ `resists`.

  The roster (`game/rules/enemies.ts`; every boss: `phase2.at` 0.5, `atkMult` 1.15):

  | Act | Enemy | Tier | Cycle | Weak / resists |
  |---|---|---|---|---|
  | 1 | SLIME | N | STRIKE STRIKE STRIKE MEND | FIRE / – |
  | 1 | GOBLIN | N | WINDUP HEAVY STRIKE STRIKE | FIRE / – |
  | 1 | SKELETON | N | STRIKE WARD STRIKE STRIKE | EARTH / – |
  | 1 | OGRE KING | E | STRIKE WINDUP HEAVY STRIKE MEND | FIRE / – |
  | 1 | WRAITH LORD | E | SCORCH STRIKE WINDUP HEAVY STRIKE | FIRE / THUNDER |
  | 1 | DARK LORD | B | STRIKE WARD WINDUP HEAVY STRIKE SCORCH → `THE DARK LORD RISES`: SCORCH WINDUP HEAVY STRIKE WINDUP HEAVY | FIRE / – |
  | 2 | ICE WOLF | N | STRIKE STRIKE WINDUP HEAVY | FIRE / WATER |
  | 2 | ICE BEAR | N | STRIKE MEND STRIKE WARD | EARTH / WATER |
  | 2 | FROST WISP | E | SCORCH STRIKE WINDUP HEAVY STRIKE | WATER / – |
  | 2 | YETI | B | STRIKE WINDUP HEAVY STRIKE MEND STRIKE → `THE YETI RAGES`: STRIKE WINDUP HEAVY WINDUP HEAVY STRIKE | FIRE / WATER |
  | 3 | SANDWORM | N | STRIKE WINDUP HEAVY STRIKE | WATER / EARTH |
  | 3 | SCORPION | N | STRIKE SCORCH STRIKE STRIKE | WATER / – |
  | 3 | MUMMY | E | STRIKE MEND STRIKE WINDUP HEAVY | FIRE / EARTH |
  | 3 | SAND GOLEM | B | WARD STRIKE WINDUP HEAVY STRIKE → `THE GOLEM CRACKS`: STRIKE WINDUP HEAVY MEND WINDUP HEAVY | WATER / EARTH |
  | 4 | GUARDIAN | N | STRIKE STRIKE WINDUP HEAVY | THUNDER / – |
  | 4 | ORACLE | N | STRIKE SCORCH STRIKE WARD | EARTH / THUNDER |
  | 4 | PALADIN | E | STRIKE WARD WINDUP HEAVY STRIKE | THUNDER / FIRE |
  | 4 | THE SERAPH | B | SCORCH STRIKE WARD WINDUP HEAVY MEND → `THE SERAPH ASCENDS`: SCORCH WINDUP HEAVY SCORCH WINDUP HEAVY | THUNDER / FIRE |

  Theme breakers per biome: SKELETON (EARTH), ICE BEAR (EARTH), MUMMY (FIRE), ORACLE
  (EARTH).
- **Phase switch** (`phase2: { at, moves, banner, atkMult }`). Checked as the enemy's
  turn begins (nothing acts between the hero's action and it, so this is the check
  "after each hero action"): HP ≤ `at` × max and alive → phase 2, ATK × `atkMult`, MEND
  re-armed, the banner strip announces it (`EnemyActResult.phaseChanged`). The move shown
  when the hero chose still resolves (unless it was broken); only then does the cycle
  become `phase2.moves` at index 0, which is the next intent shown. A WINDUP shown at the
  switch keeps its HEAVY: the cycle index is parked at −1 (`nextIntent` reads it as
  `HEAVY`), and the step after it lands on `phase2.moves[0]`.
- **GUARD** (always available). Until the hero's next action damage taken ×0.5
  (`GUARD_FACTOR`, after DEF/MDEF; REFLECT uses the reduced number; BURN/BLOOD ticks are
  not reduced). A hit landing on a guard gives +2 MP (`GUARD_MP_GAIN`). Guarding a
  `HEAVY` (landed or dodged) is a **PARRY**: `battle.riposte`, every hit of the hero's next
  damaging action ×1.5 (`RIPOSTE_MULT`, not BURST), +15 ember. Anti-stall: HP/MP regen
  does not tick on a turn the hero guards (`startTurn(hero, battle, action)`); a GUARD
  directly after a GUARD (`battle.guardChain` > 1) is ×0.75 and gives no MP and no
  ember — unless it answers a shown `HEAVY` (full ×0.5, and it parries). GUARD leaves RAMP
  stacks, `lastScope` and FIRST_STRIKE alone (`actionsTaken` counts damaging and healing
  actions: spells, ATTACK, POTION).
- **BREAK** (M2b). While the shown intent is `HEAVY`, a hero action breaks it when it is
  a BURST, a hit on the foe's weakness, or any damaging action while `PUNISH_WINDUP` is
  worn — and it deals at least `BREAK_AT[kind]` of the foe's max HP (NORMAL 25 %, ELITE
  15 %, BOSS 8 %; a floor only). Pop `BREAK!`; the foe is `staggered` and loses that turn
  (the cycle steps past the HEAVY). Order after a hero action: BREAK check, then the phase
  check. "The telegraph never lies" exempts broken moves.
- **Menu.** The band's top line (y 120) is the intent hint (`… GUARD IT` in M2a,
  `… OR BREAK IT` in M2b); below it a 2 × 3 grid at 8 px pitch: `ATTACK MAGIC / GUARD
  BURST / POTION X2` (`BattleScreen.menu` `'TOP'`, `topCursor`). MAGIC opens the spell grid
  (2 × 3, pages with Down past the end beyond 6: `magicCursor`, `magicPage`), B = back;
  it opens even when nothing is affordable (rows dim). BURST is dim until the gauge is
  full, POTION when none is left; choosing a dim command refuses with a blip and a short
  reason in the hint line (`NOT ENOUGH MP`, `NO POTIONS LEFT`, `THE EMBER IS NOT FULL
  YET`). A preview column right of the grid (3 lines) shows what the highlighted command
  does against this foe: `ATK X1.0` / `MAG X0.8 2 HITS`, `WEAK X1.5` / `RESIST X0.5`,
  `-25% WARD` / `-30% RES`, `BREAKS IT` / `TOO WEAK TO BREAK` against a shown HEAVY,
  `RIPOSTE X1.5`; GUARD `HALVES THE NEXT HIT` / `PARRY THE HEAVY BLOW`; POTION `HEAL 40%
  HP`; BURST `IGNORES ARMOR+WARDS`. The break preview is a presentation estimate (no
  jitter, crit, RAMP or TWIN), so it can only under-promise. Cursor memory: the TOP
  cursor holds between turns (ATTACK at each fight's start); MAGIC keeps the last spell
  across fights; choosing an action returns to TOP.
- **POTION.** `hero.potions` starts at 2 (`POTIONS_MAX`), REST refills; drinking heals
  40 % max HP (`POTION_HEAL`) and uses the turn; at 0 it cannot be chosen.
- **Elements.** `SpellDef.element`: FIREBALL fire, WATER water, THUNDER and TWINBOLT
  thunder, QUAKE earth; LEECH, SLASH, MEND none. `EnemyDef.weak` ×1.5 (`WEAK_MULT`),
  `resists` ×0.5 (`RESIST_MULT`), after resist, on each hit of a multi-hit
  (`HeroActResult.weak` / `resisted`). Weapon attacks carry an element only through
  `IMBUE` gear (M3). Each act's commonest weakness is one the hero can own by then — act 1
  FIRE, act 2 FIRE/WATER, act 3 WATER, act 4 THUNDER; one enemy per biome breaks the
  theme; EARTH is the off-meta answer. `WEAK!` pop and a longer hit-stop on a weak hit.
- **BURN** (the only ailment). `{ perTurn, turns }`: `perTurn` = 40 % of the hit that
  applied it (min 1, `BURN_FRACTION`), `turns` = 3; re-applying keeps the larger
  `perTurn` and resets turns. Ticks happen in `startTurn`, at the start of each round
  (the hero's turn), hero first, then the foe (`TurnStart.heroBurn` / `enemyBurn`); they
  give no ember, DRAIN never heals from them, and they can kill: hero deaths all go
  through `heroFalls` (REVIVE answers a tick), a foe killed by a tick ends the fight
  through the normal victory path (`TurnStart.enemyDefeated`). Sources: enemy `SCORCH`,
  hero `BURN_ON_HIT` gear (M3).
- **EMBER BURST.** `hero.ember` 0–100 (`EMBER_MAX`), carried from fight to fight (not
  reset by REST or acts): +6 per damaging hero action (once per action, not BURST), +4
  when hit (not on a chained GUARD), +15 on a parry. At 100 BURST lights: one hit of 2.5×
  the higher of ATK and MAG (`BURST_MULT`), of the weapon's kind, no crit/RAMP/TWIN/
  riposte/jitter, ignores DEF/MDEF and WARD, no element; it cleanses the hero's BURN and
  empties the gauge, and leaves riposte, RAMP stacks, `lastScope` and `actionsTaken`
  alone. Drawn as a 2 px bar under the hero plate.
- **Where it is drawn.** The short intent text (≤ 10 chars) replaces `STRIKES`/`HEXES` on
  the enemy plate's third row; the long hint is the band's top line. A tag strip at
  y 37–43 under each plate (`screens/battle-tags`) carries pips and short words: enemy =
  weakness, WARD, BURN, affix; hero = RAMP, BURN, GUARD, RIPOSTE. Pops never rise above
  y 46 (`POP_CEIL`), so they never cross the strips; strip text stays inside the plate's
  96 px. Every verb has its beat (`screens/battle-fx-verbs`: `fxGuard`, `fxParry`,
  `fxBreak`, `fxBurst`, `fxPotion`, `fxBurnTick`, `fxPhase`, `fxWeak`); the phase banner
  reuses the boss-entrance strip (`showBanner`); BURST is a full-screen moment.
- **Policies** (`policy-battle.ts`, `battleAct({ mendBelow, verbs })`), in order: (1) kill
  if a "sure" estimate (no crit, ×0.9) of an affordable action reaches the foe's HP —
  cheapest first, BURST only against elites and bosses; (2) against a shown HEAVY: BREAK
  with an affordable weakness spell (or, against elites/bosses, BURST) whose sure damage
  reaches `BREAK_AT`, else GUARD when the unguarded HEAVY ≥ 20 % of current HP; (3)
  POTION below 35 % HP, then the MEND spell below `mendBelow`; (4) BURST on elites/bosses
  when the foe is WARDED, the resist its best hit faces is ≥ 25, or the burst kills; (5)
  the hardest affordable hit. Expected damage goes through weakness, WARD (`resistOf`)
  and riposte. Control policy **`naive`** = balanced without GUARD, BREAK, BURST timing or
  weakness awareness: it bursts the moment the gauge is full (any foe) and drinks potions
  like balanced. `random` picks among every affordable action, verbs included.
  `node sim/run.mjs --no-potions` adds a `noPotions` line (balanced with POTION filtered
  out) and every text run prints the naive/balanced win ratio. The simulator chooses the
  action before `startTurn(hero, battle, action)`, exactly like the screen, so a GUARD
  turn has no regen. Telemetry per run (`RunResult.verbs`): guards, parries, bursts,
  potions, break attempts/successes per tier, phase-2 switches, burn deaths; STALL deaths
  stay a `deathKind`.

## Combat

See *v3 — battle verbs (M2)* above for moves, intents, GUARD, POTION, elements, BURN,
BURST and BREAK; the lines below are the base turn they build on.

- Hero turn: regen (chalice/necklace) → BLOOD tick → BURN ticks → action. ATTACK is free,
  scales off ATK (or MAG for a magic weapon), deals `weaponKind` damage.
  Spells per `SPELLS`. Crit: `crit %` chance, `x critMult`.
- Enemy resists (the instance's `resPhys`/`resMagic`, plus WARD) blunt the matching damage kind — HEX_STRIKE turns physical
  attacks into magic damage, so a physical build can beat a plated foe.
- Enemy turn: phase check → the shown move; for a hit: dodge check → damage × move mult
  × (1 − DEF/MDEF) × guard → REFLECT → `heroFalls` (REVIVE).
- Enemies scale `(base + perClear × clears) × ACT_MULT[act] × def.mult`; `ACT_MULT` [1.15, 1.95, 2.78, 3.41].

## Difficulty targets (balance sim, sane policy)

Story run, `balanced`: act 1 clear ≥ 80 %, act 2 ≈ 65 %, act 3 ≈ 50 %, full run 30–40 %.
`random` < 8 %. `naive` ≤ 75 % of balanced's win rate. No STALL deaths. Late-game
power comes from routing (elites for loot), focused points, and item synergy —
not from stat inflation alone.

## UI constraints (text overlap)

Logical screen 240×160, font 4 px per char at scale 1. Battle log line
<= 52 chars, or it wraps to two lines. Battle verbs: the plate's intent text <= 10 chars
(`HEAVY BLOW`, `STAGGERED` 9), the band's intent hint <= 52 chars, a phase banner
<= 20 chars (scale 2 beside its tag), a menu preview line <= 82 px (21 chars), a spell
cell `NAME` + `nMP` inside 68 px, a tag strip inside its plate's 96 px (tags that do not
fit are dropped, lowest priority last: enemy WEAK, WARD, BURN, RES, affixes; hero BURN,
RIPOSTE, GUARD, RAMP, `BURST READY`). Item names <= 13 chars, enemy names
<= 12, spell names <= 9. Every panel is placed with `SAFE_MARGIN`; the loot
and level-up panels sit beside the hero, never over him.
Compare card: `displayName` (<= 16 chars) `>` name, `ATTACK NOW USES MAG` beside them;
six cells of <= 18 chars (74 px columns); `LOSE:` / `GAIN:` lines <= 36 chars (blurbs
<= 30). A loot offer's hint <= 64 px (the worn item's `displayName`). GEAR rows <= 92 px
of name; PICK rows `NAME +n>+n+1` <= 84 px beside a <= 4-char note (`WORN`, `PACK`,
`NEW`, `OLD`); PICK titles <= 30 chars; PICK detail <= 3 lines. The map readout
`ELITE  NAME  HEXES` stays inside the 160 px between the corner labels.

## Balance state (measured with the headless simulator, 2026-11-24)

Harness: `npm run sim` (`sim/run.mjs`) bundles `game/sim.ts` with esbuild into a
temporary directory (`sim/bundle.mjs`), then calls `simulateRun` with each of
`POLICIES` and a seeded PRNG (`createSeededRng`; `--runs`, default 2000; `--seed`,
default 1; `--policy`; `--json`; `--no-potions`). Same seed and same code give
byte-identical `--json` output. The simulator replicates the drop rates, upgrade cards and
boss tables, and plays **the same map generator as the game** (`game/sim/map.ts`).
Numbers below: 2000 runs, seed 1, after M2 (battle verbs: move cycles, phase 2, GUARD and
PARRY, POTION, elements, BURN, EMBER BURST, BREAK).

| policy | win | reach act 2 | act 3 | act 4 | boss clears a1/a2/a3/a4 |
|---|---|---|---|---|---|
| balanced | 38 % | 99 % | 68 % | 48 % | 99/85/85/81 |
| naive (no verbs) | 10 % | 88 % | 25 % | 13 % | 90/40/68/76 |
| balanced, no potions | 21 % | 93 % | 44 % | 28 % | 98/75/82/76 |
| glass (all offence) | 22 % | 100 % | 57 % | 31 % | 100/79/75/77 |
| tank (HP/DEF, physical) | 19 % | 97 % | 42 % | 24 % | 97/63/67/84 |
| elite-hungry routing | 37 % | 99 % | 68 % | 48 % | 99/85/86/81 |
| chest-hungry routing | 32 % | 98 % | 64 % | 47 % | 99/75/83/73 |
| random picks + points | 0 % | 24 % | 0 % | 0 % | 34/0/–/– |

Verb use per run (balanced): GUARD 5.6 (every one answers a HEAVY, so PARRY 5.6), BURST
4.5, POTION 2.0, BREAK succeeded/attempted 0.32/0.52 normals, 0.59/0.93 elites,
1.57/1.95 bosses; phase 2 reached 2.8 times. naive/balanced = **0.25** (target ≤ 0.75).
0 STALL deaths in any policy; BURN ticks end 4.8 % of balanced runs (96 / 2000).

Tuning in M2: `ACT_MULT` [1.0, 1.38, 2.2, 3.1] → [1.15, 1.95, 2.78, 3.41]; FROST WISP
hpBase 76 → 70, atkBase 5.2 → 4.8. Before tuning (new cycles and verbs, old numbers)
balanced won 74 % and naive 42 % (ratio 0.57): potions and BURST are the bulk of the new
hero power (balanced without potions: 56 %), so `GUARD_FACTOR` stays 0.5. The naive gap
is wide because an unguarded HEAVY is 2.2× and naive casts resisted or unweighted
elements; the YETI's double wind-up phase 2 alone ends 37 % of naive runs.

Elites now kill as many balanced runs as bosses (27 % vs 30 %; M1 26 % vs 39 %): FROST
WISP (330 deaths) and MUMMY (199) are the walls of acts 2 and 3.

M1 (2026-11-24, pre-verbs), for reference: balanced 32 %, glass 20 %, tank 27 %,
elite-hungry 33 %, chest-hungry 22 %, random 0 %. M0 (2026-11-23): balanced 24.9 %.

Act-4 boss vs the balanced hero: ~8.4 turns to kill, each hit ≈ 20 % of max HP.
Balanced fights ~4.1 elites and opens ~3.6 chests per run. Hero base: 46 HP, +6 HP per skill point;
DEF/MDEF cap 42 %; `ACT_MULT` [1.15, 1.95, 2.78, 3.41].

Findings from the 2026-09-04 tuning pass (on the simulator's old map, not re-measured
since): elites kill 4 % of heroes entering above 70 % HP and ~50 % of those entering
below 50 %; with upgrade cards disabled the balanced win rate halves; taking a boss's
scroll beats walking past it (33 % vs 28 % wins for balanced, 59 % vs 17 % for tank).

### The map generators are unified

There is one generator, `generateMap` in `game/sim/map.ts`; `game/mapgen.ts` only
adds the screen fields. The simulator used to link more stingily (about 39 % of nodes
with two onward links against 74 % in the game), which understated the real game's
win rate by about five points; the table above is measured on the game's map.
