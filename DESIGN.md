# Ember Quest — systems design (v2: skill points + loot table)

v3 (The Long Descent) is in progress — the approved contract is OVERHAUL_PLAN.md; sections move here as milestones land.

A roguelike JRPG: branching node map per act, turn-based one-on-one battles,
permadeath. v2 replaces the tier-upgrade gear with **skill points** and a
**loot table of named items with unique effects**.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + tuning constants (caps, SP gains) | nothing |
| `game/data.ts` | the content import path: re-exports `game/rules/*` (ITEMS, ENEMIES, SPELLS, BIOMES, LOOT_WEIGHTS, ACT_MULT, the heal constants, `validateData`, EVENTS and their types) | `./rules/*` only |
| `game/rules/*.ts` | the content itself: `items` (ITEMS), `enemies` (ENEMIES), `world` (SPELLS, SPELL_ORDER, BIOMES, ACT_MULT, LOOT_WEIGHTS, LOOT_COUNT, CLEAR_HEAL, BOSS_ENTRY_HEAL, SKIP_MEND, RARITY_COLOR_INDEX), `validate` (`validateData`; never imports `data.ts`), `events` (EVENTS, the effect vocabulary, `validateEvents`), `pacts` (PACTS, `validatePacts`); `enemies` also holds the descent-only THE HOLLOW | `../types`, each other |
| `game/sim.ts` | the barrel: the only path presentation and the simulator use to reach the rules (also re-exports `validateData`, `generateMap`, `createSeededRng`, `at`) | `./sim/*`, `./data` |
| `game/sim/*.ts` | pure rules, one concern per file: `util` (clamp, `at`, rng picks, `createSeededRng` — mulberry32 with readable state — and effect tables), `gear` (item levels, upgrades, effective mods/effects), `hero` (derived stats, skill points, heals, equip, spells), `ghost` (stats of a hypothetical equip), `describe` (item/offer/compare text, `compareFull`), `loot` (loot rolls, offers, scrolls, `resolveUpgrade`), `pack` (the pack: `stow`, `discard`, `swapIn`, `unequip`, `ownedIds`, `upgradableTargets`), `combat` (enemy scaling, battle creation, hero actions, damage), `commands` (GUARD, POTION, BURST, BREAK), `enemy-turn` (enemy moves, intent, phase), `status` (turn start, BURN, WARD, `heroFalls`), `element`, `burst`, `power` (the gear-driven damage multipliers: IMBUE element, PUNISH, LOW HP, ELEMENT BOOST, riposte power, ignite chance, the guard counter), `events` (event effects, enablement, `takePendingBurn`, preview words), `map` (**the one map generator**, `generateMap(rng, shape?)`, played by both the screens and the simulator), `model` (`Policy`, `RoomType` including `BOSS`), `scoring`, `policies`, `policy-battle` (how they fight) and `policy-choices` (how the archetypes decide; `DEFAULT_CHOICES` holds the shared pack/upgrade/prepare defaults), `descent` (`n`, `depthOf`, `actInDepth`, `actMult`, `ActPlan`, `planDepth`), `affixes`, `hollow` (`hollowOf`, `spawnFoe`), `pacts` (`pactMods`, `offerPacts`), `score`, `run` (`simulateRun`) | `../types`, `../data`, each other |
| `game/sprites.ts` + `game/sprites/*.ts` | hero/enemy/icon sprites: `helpers`, `hero`, `icons`, one file per biome; `sprites.ts` re-exports them and adds `enemyAnim(id)` | `../engine` only |
| `game/main.ts` + `app`, `state`, `flow`, `frame`, `mapgen`, `theme`, `backdrop`, `widgets`, `pops`, `fx-state`, `fx`, `transition`, `storage`, `lookup`, `screens/*.ts` | presentation: `main.ts` only wires; `app` creates the engine objects and fits the canvas to the window; `state` holds the one `Game` object `g` with per-screen slices; `flow` runs the run (rooms, stages, clears, acts, scene hooks); `frame` dispatches update/render; `mapgen` adapts the shared headless map to the screens (adds `stage`, `slot`, `cleared`); the **fx / transition layer** presents what the rules decided and never decides anything — `fx-state` + `fx` hold the battle-fx clock (actor poses, timed cues, lagging meters, boss banner), `screens/battle-fx` choreographs a turn on it, `screens/battle-fx-verbs` gives each battle verb its beat, `screens/battle-fx-view` draws its shots and banner, `screens/battle-menu` holds the command menu, `screens/battle-tags` the tag strips under the plates, `screens/battle-reach` measures lunges, `transition` reveals each new sub-scene; `screens/` one update file and one view file per screen (`map-view`, `loot-view`, `battle-view`; `plate` holds the shared medallions) | everything |
| `game/devhook.ts` | the dev-only seeded hook (`?seed`, `?scene`, `&act`, `&depth`, `&hold`, `window.__ember`), never in the build | `../engine` types, `./sim`, presentation types |
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
  TOME items grant extra spells (TWINBOLT, LEECH, QUAKE, MEND, EMBERS, TREMOR, AEGIS) while equipped.

## Items

Six slots, one item each, plus a **4-item pack** (see *v3 — the pack, GEAR and chosen
upgrades*): a new item takes the slot and the old one, with its level, can go to the
pack instead of being lost (the loot screen shows both). Rarity COMMON / RARE / EPIC /
LEGENDARY. Every RARE+ item carries a unique effect (`ItemEffect`); a COMMON carries
none, except `IMBUE` (see *v3 — item pool and new effects*). The pool is 69 items (44 + 25
in M3); names <= 13 chars, blurbs <= 30 chars.

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
| EVENT | only through an `item` effect | 1 — a rolled item of the event's rarity (falls back to a lower rarity) | paid for up front (max HP, a burn); declining still mends 25 % |

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

The map guarantees one elite, one rest, one chest and one event per act. When it has to
invent a chest it places it beside the rest stop so "rest or loot" is a forced
choice at least once; an invented rest or chest never replaces an elite. Room
weights are FIGHT 46, ELITE 15, REST 14, LOOT 12, EVENT 13; see *EVENT rooms (M3)*
for where an event may sit.

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
  stay a `deathKind`. A break **attempt** is any damaging action (not GUARD or POTION)
  into a shown HEAVY that the real rule could let break: BURST, anything while
  PUNISH_WINDUP is worn, or a hit in the foe's weak element (IMBUE counts for ATTACK).

## v3 — EVENT rooms (M3)

Content lives in `game/rules/events.ts` (`EVENTS`, `validateEvents()`, wired into
`validateData`); rules in `game/sim/events.ts`; the screen in `screens/event.ts` +
`event-view.ts`.

- **Map.** `RoomType` has `EVENT` (`?`, green). Rolled at weight 13 of 100. After linking,
  an EVENT that a REST links to becomes a FIGHT (no free heal-then-gamble), and when
  stages 1–4 (0-based) hold no EVENT one is placed on a FIGHT there that no REST links
  to (if none exists, on an ELITE / REST / LOOT that is not the act's only one).
- **An event** is a title (≤ 20), one or two lines (≤ 30) and exactly two options
  (label ≤ 24), each a list of effects: `hpPct` ± a fraction of max HP (a loss never
  takes HP below 1), `maxHp` ± permanent max HP, `sp` +n points (opens LEVEL UP),
  `item(rarity)` one rolled card on the loot screen, `upgradeAny` (opens `UPGRADE WHICH?`),
  `burnNextFight`, `fullHeal`, `dropPackItem` (opens `GIVE UP WHICH?`), `potion` ±n
  (clamped 0..2). An option has at most one screen-opening effect and it is last;
  at least half the events price their boon in something lasting (max HP or a pack
  item); at most half offer a do-nothing option.
- **Permanent max HP** is `Hero.bonusMaxHp`, added to max HP in `derive` (a gain also
  adds the HP; a loss clamps HP). **The burn** is `Hero.pendingBurn` (turns, 0 = none):
  `takePendingBurn(hero, act)` turns it into BURN `round(3 × ACT_MULT[act])` per turn for
  3 turns when the next fight (boss included) begins, once. A BURN-warded hero
  (`burnWarded`) shrugs it off: the pending burn is consumed and nothing is applied.
- **Enablement** (`eventOptionBlocker`): `upgradeAny` needs an upgradable target
  (`NOTHING TO UPGRADE`), `dropPackItem` a non-empty pack (`NO SPARE GEAR`), a potion cost
  enough potions (`NO POTIONS`), an HP cost more than 1 HP (`TOO WEAK TO BLEED`), a max-HP
  cost a max above it (`TOO FRAIL`). A dim option cannot be chosen.
- **The cancel rule: nothing is paid until the choice is final.** An option whose last
  effect opens a picker (`upgradeAny`, `dropPackItem`) opens it first; B returns to the
  event's two options with nothing applied, and the option's other effects are paid
  when a row is picked. Options ending in `sp` or `item` pay first and then open their
  screen, which cannot be backed out of (LEVEL UP spends, the loot screen's KEEP mends).
  A result card names what changed, then the map.
- **Policies** choose with `eventChoice(hero, event)`: the archetypes score each enabled
  option (HP-rich heroes trade HP, low-HP heroes heal, 1 SP ≈ 6 max HP, never drop the
  only spare), `random` picks an enabled one at random; the routing archetypes rank
  EVENT after LOOT. The run result tallies options taken per event (`events`).

| Event | Option A | Option B |
|---|---|---|
| A BLEEDING ALTAR | GIVE BLOOD: −25 % HP, +2 SP | WALK ON |
| A WANDERING SMITH | LEND HIM YOUR STRENGTH: −8 max HP, upgrade any | SELL HIM SCRAP: +2 potions, give up a pack item |
| A CURSED IDOL | PRY IT OPEN: −10 max HP, an EPIC item | WALK ON |
| A STILL POOL | BATHE: full heal, burn next fight | FILL A FLASK: +1 potion |
| A WEARY PILGRIM | SHARE A POTION: −1 potion, +6 max HP | ASK FOR A BLESSING: +25 % HP |
| THE EMBER SHRINE | BURN SPARE GEAR: full heal, +2 potions, give up a pack item | GRASP THE COAL: burn next fight, a RARE item |
| A FALLEN KNIGHT | GIVE HIM SPARE GEAR: +8 max HP, +1 potion, give up a pack item | WALK ON |
| THE BLOOD TITHE | PAY IN VIGOUR: −12 max HP, +2 SP | PAY IN BLOOD: −35 % HP, +1 SP |
| A WEEPING STATUE | DRINK THE TEARS: +2 potions, burn next fight | WALK ON |

## v3 — item pool and new effects (M3)

Rules: `game/sim/power.ts` (the gear multipliers on a hero strike), `combat` (ATTACK/spells,
AEGIS, ignite), `commands` (the BREAK rule), `enemy-turn` (counter, guard MP, AEGIS
reflect, burn ward), `burst` (ember rate, burst power). Items in `game/rules/items.ts`.

| Kind | Shipped magnitude (+1 step) | Rule |
|---|---|---|
| `GUARD_COUNTER {fraction}` | 1.0, awakened 1.5 (+0.15, cap 1.2) | a hit that lands on a guard (GUARD or AEGIS) strikes back for fraction × the weapon stat (ATK, MAG for a magic weapon), of the weapon's kind, through the foe's resist; summed over items; `EnemyActResult.countered` |
| `GUARD_MANA {amount}` | +3 (+1) | extra MP on every guarded hit that pays guard MP (not a chained guard) |
| `PARRY_POWER {mult}` | 2.5 / 2.8 (+0.2, cap 3) | the riposte multiplier becomes `mult` (highest worn) instead of 1.5 |
| `PUNISH_WINDUP {mult}` | 1.8, 2.3 awakened, 2.0 legendary (+0.15) | ×mult on every hit of an ATTACK or spell while the shown intent is HEAVY and the foe is not staggered; with it worn ANY damaging action may BREAK (still needs `BREAK_AT`) |
| `BURST_GAIN {mult}` | 1.6 / 2.0 (+0.2) | every ember gain × mult (rounded) |
| `BURST_POWER {mult}` | 1.5 / 2.0, 1.7 legendary (+0.2) | the burst blow × mult |
| `IMBUE {element}` | – | weapon ATTACKs (every hit, TWIN included) carry the element: weakness ×1.5, resist ×0.5, `WEAK!` and BREAK-by-weakness apply |
| `ELEMENT_BOOST {element, mult}` | 1.4 / 1.75 (+0.1) | ×mult on hits of that element (spell or imbued ATTACK); not a weakness, so it never breaks by itself |
| `BURN_ON_HIT {chance}` | 0.35 / 0.55 (+0.1, cap 0.8) | after a damaging ATTACK or spell that leaves the foe alive, one roll on the injected rng: the foe burns per the BURN rules (40 % of the volley total, 3 turns); `HeroActResult.burned`, pop `IGNITE` |
| `BURN_WARD {}` | – | the hero never gains BURN from SCORCH or from an event's pending burn; its item always carries MDEF (`validateData`) |
| `LOW_HP_POWER {threshold, mult}` | below 40 % ×1.5 (locket), below 50 % ×1.8 (legendary) (+0.15) | ×mult on strikes while HP / max HP < threshold; tag `DESPERATE` |

A strike's power = RAMP × opener × riposte (× `PARRY_POWER`) × PUNISH × LOW HP × ELEMENT
BOOST; weakness/resist and DEF/WARD after. BURST stays outside all of it (BURST_POWER only).

**Spells** (TOME only): `EMBERS` (fire, 2 × 0.8 MAG, 7 MP, CINDER TOME), `TREMOR` (earth,
1.3 ATK physical, 3 MP, FAULT TOME), `AEGIS` (5 MP, WARDEN TOME): a GUARD for every guard
rule — ×0.5 (chain ×0.75), parry on a HEAVY, guard MP, ember, no regen that turn
(`isGuardAction`), GUARD_COUNTER — that also reflects 50 % of the reduced hit
(`SpellDef.guard.reflect`, `battle.aegis`, added to `reflected`). Policies cast AEGIS
instead of GUARD against a HEAVY whenever it is affordable, never otherwise.

**Build lines.** Bulwark: BULWARK MAIL, PADDED COAT, CLAY BOWL, WARDEN TOME. Duelist:
DUELIST FOIL, DANCER SLIPS (parry power on awakening). Breaker: BREAKER MAUL, OATH CHALICE
(legendary). Burst: EMBER TREADS, NOVA STRIDERS (legendary), SERAPH HALO (the Seraph's
signature, act 3, `bossOnly`). Elements: fire — EMBER BRAND (COMMON, act 0, the starter
guarantee may offer it), CINDER TOME, FIRE GOBLET, PYRE CHALICE; water — SURF SPEAR (COMMON,
act 1), TIDE PEARL; thunder — VOLT ROD, STORM GREAVES; earth — FAULT TOME, GRANITE MAIL.
Fireproof: ASH MANTLE, FROST BEAD. Gambler: TIN LOCKET (awakening), LAST LIGHT (legendary).
Every COMMON slot but TOME (a tome must grant a spell) has one new common whose +2 grants a
new kind; IMBUE commons keep their element when awakened (mods only).

Presentation: an imbued ATTACK takes its element's colour; a counter is a `COUNTER -n` pop
with a slash on the foe; an ignite pops `IGNITE` on the foe; the hero tag strip shows
`AEGIS` (instead of GUARD), `PUNISH` (a HEAVY is shown and PUNISH_WINDUP is worn) and
`DESPERATE` (LOW_HP_POWER active); the menu preview folds the gear multipliers, the parry
power and the burst power into its numbers and lets `BREAKS IT` show for any hit while
PUNISH_WINDUP is worn; AEGIS previews `PARRY THE HEAVY BLOW` / `A GUARD THAT BITES` and
`RETURNS 50% OF IT`.

`validateData` adds: a COMMON may carry only `IMBUE`; `BURN_WARD` needs MDEF; every
effect kind is used (base or awakening); every element has ≥ 2 hero sources by act 2
(FIREBALL, the act-1 scroll, and items with `minAct` ≤ 1 that IMBUE or grant an element's
spell). Policies score the new kinds with `EFFECT_VALUE` and count an ELEMENT_BOOST at 20 %
when the hero has no source of that element.

## v3 — the endless descent (M4)

The Seraph kill is banked as the win; the player may then ASCEND (end the run) or
DESCEND into ever-steeper depths. Status: rules shipped (2026-11-24): depth plans,
affixes, THE HOLLOW, pacts and descent loot are in `game/sim/`, and the simulator plays
the descent (see *Balance state → The descent*).

- **Stage counter.** `n` (`g.n`, the simulator's `run.n`) is the 0-based index of the
  act being played and never resets. `depthOf(n) = floor(n / 4) + 1`, `actInDepth(n) =
  n % 4` (`game/sim/descent.ts`). Every rule that indexes a 4-row table clamps with
  `storyAct(n) = min(n, 3)` (`LOOT_WEIGHTS` rows) or reads what it needs from the
  act's `ActPlan`; `minAct` compares with `n`, so in the descent it is always met.
- **`actMult(n)`** = `ACT_MULT[n]` for n ≤ 3, else `ACT_MULT[3] × DESCENT_GROWTH^(n − 3)`,
  `DESCENT_GROWTH` = 1.20 (tuned from 1.08; HP and ATK both scale, ≈ 1.44× threat per
  act — the descent hero keeps gaining SP and EPIC+ loot, so 1.08 let a tank clear depth
  5 in 84 % of its descents). It scales
  `spawnEnemy` and the event burn (`takePendingBurn`). `spawnEnemy(id, { n, clears,
  descentClears }, affixes)`: the per-clear term uses `descentClears` (the clears count
  held when the descent began) whenever it is set, so it freezes in the descent.
- **`ActPlan`** `{ biomeIndex, normals, elites, boss, scroll?, affixCount: { normal, elite },
  stageSizes, weights, phaseAt?, affixOrder? }`. `planDepth(depth, rng)` is drawn once on entering a
  depth and held as `g.depthPlan`; `g.plan = planOf(g.depthPlan, n)` (= `depthPlan[n % 4]`).
  Depth 1 is exactly the four story acts built from `BIOMES` and draws no rng (a rules
  test). Enemy pools, boss, scroll, biome name, look, backdrop and map shape all read the
  plan (`plan.biomeIndex`, never `n`). `rollLoot(source, { n, plan }, hero, rng)`: boss
  tables take the plan's scroll and its boss's signature item.
  Depth ≥ 2 (`planDepth`, all draws on the run rng, deterministic per seed): the biome
  order is a seeded permutation; each act's normals and elites gain one **invader** drawn
  uniformly from the other biomes' members of the same pool (a normal into normals, an
  elite into elites); `stageSizes` = 6 + (depth − 1) stages alternating 2/3, at most
  `DESCENT_STAGE_MAX` 8 before the boss (`descentStageSizes`); weights ELITE +5 per depth
  taken from FIGHT, FIGHT never below 21 (`descentWeights`); `phaseAt` 0.7; no scroll;
  `affixCount = affixCountFor(depth)`; `affixOrder` a seeded permutation of `AFFIX_IDS`
  (the spawn top-up order below); the last act's boss is `HOLLOW`. `phaseAt` reaches the
  fight through the spawn: `spawnFoe(id, { …, plan })` copies it onto a boss instance
  (`EnemyInstance.phaseAt`) and `enemy-turn` reads `enemy.phaseAt ?? phase2.at`; the game
  passes the plan through `foeScale(g)` (`game/state.ts`).
- **THE HOLLOW** (`ENEMIES.HOLLOW`, a BOSS exempt from biome membership, `phase2` and a
  signature item via `DESCENT_ONLY`). `spawnFoe(id, ctx)` is the one spawn path (game and
  simulator) and routes `HOLLOW` to `hollowOf(hero, n)`, read off the hero at spawn (so a
  GEAR swap before the fight changes it): attack kind = the hero's weapon kind (PHYSICAL
  unarmed); `base` = the hero's plain ATTACK stat (ATK, or MAG for a magic weapon; no
  crit, opener, RAMP, TWIN, riposte or BURST); ATK = `HOLLOW_ATK_SHARE` 0.7 × base ×
  `actMult(n) / ACT_MULT[3]`; resists = the hero's DEF/MDEF capped at `HOLLOW_RES_CAP` 40;
  HP = `HOLLOW_HP_HITS` 30 × base × (1 − its resist of that kind), at least
  `HOLLOW_HP_FLOOR` 2 × hero max HP; at most 3 affixes read off the gear in order (DRAIN →
  VAMPIRIC, REFLECT → THORNED, dodge ≥ 15 → SWIFT, BURN_ON_HIT → SEARING; HEX adds none);
  the definition's fixed cycle `STRIKE STRIKE WINDUP HEAVY`; no weakness or resist; IRON
  raises its ATK like any foe's. Drawn as the hero's sprite, mirrored, in one dark tint.
  Tuned from the contract's 0.5 / 8: the descent hero deals about nine plain hits a turn
  (crits, spells, BURST, gear), so 8 hits of HP died in two turns and the Hollow killed 3 %
  of descenders; at 0.7 / 30 it ends ~20 % of balanced descents, 0 stalls.
- **Affixes** (`AffixId`, `EnemyInstance.affixes`, `MapNode.affixes`; depth ≥ 2 only;
  normals `depth − 2`, elites and bosses `depth − 1`, max 3, no repeats on one foe —
  `affixCountFor(depth)`):

  | Affix | Effect | State |
  |---|---|---|
  | ARMORED | +20 DEF (`resPhys`) | applied by `spawnEnemy` |
  | WARDED | +20 MDEF (`resMagic`) | applied by `spawnEnemy` |
  | VAMPIRIC | heals 30 % of the damage its hits deal, capped at max HP (`EnemyActResult.healed`) | `enemy-turn` |
  | THORNED | returns 15 % of the damage it takes from ATTACK, spells and BURST, at most 12 % of the hero's max HP per action (`AFFIX_THORNS`, `AFFIX_THORNS_CAP`); never on the killing blow; it can kill through `heroFalls` (REVIVE answers): `HeroActResult.thorns / revived / heroDead` | `combat` |
  | SWIFT | 15 % to evade ATTACK and damaging spells, rolled on the injected rng (`IT SLIPS AWAY!`, `HeroActResult.missed`); the spell's MP is spent, no ember, RAMP still advances; BURST never misses | `combat` |
  | SEARING | its STRIKEs apply BURN (SCORCH already does) | `enemy-turn` |

  Tuned: THORNED was 20 % uncapped; it then caused 36–42 % of all descent deaths (a
  descent turn deals ~330, so 66 came back). Rolling: `generateMap` scouts FIGHT nodes
  with `affixCount.normal` and ELITE nodes with `affixCount.elite` affixes drawn without
  repeats (`rollAffixes`; no draw when the count is 0, so depth 1 maps are unchanged).
  At spawn `foeAffixes` tops a foe up (never trims) to its tier count — normals
  `affixCount.normal`, elites and bosses `affixCount.elite` + HEX — taking the plan's
  `affixOrder` in order, so a boss gets its affixes from the plan, deterministically.
- **Pacts** (`game/rules/pacts.ts`, `validatePacts()` in `validateData`; `hero.pacts`).
  Entering each depth ≥ 2: pick 1 of min(3, remaining) drawn with the run's rng from the
  8 not yet taken (`offerPacts`, no skip; none left → no PACT screen). `pactMods(hero)`
  folds every taken pact into `Required<PactMod>` (multipliers multiply, counts add; no
  pacts → neutral: 1 for multipliers, 0 for counts). Where each mod applies (all headless,
  so the game gets them through the calls it already makes, except REST):
  `maxHpMult` `derive` (before GLASS); `dmgMult` every strike and BURST (`pactDamage`);
  `attackMult` ATTACK only; `burstGainMult` `gainEmber`; `clearHealMult`, `spPerClear`,
  `spPerBoss`, `eliteSp` `grantClear`; `foeAffix` the spawn top-up (elites and bosses);
  `foeAtkMult` every foe and `eliteHpMult` elites in `spawnFoe`; `rarityShift` ELITE and
  BOSS item rolls (`rollItems`, capped at LEGENDARY); `fightDrops` 0 → FIGHT never drops
  and the pity counter is untouched; `extraCard` every loot screen, `eliteExtraCard` ELITE
  (offers stay capped at 4); `restHealMult` and `restUpgrade` in `restHero(hero)`
  (`game/sim/rest.ts`: heals `restHealMult` of max HP and MP — full without pacts — and
  refills potions; with ASH it returns `upgrade: true` when something can be upgraded,
  the caller then offers one `UPGRADE_ANY` pick, else it mends `REST_MEND` 25 % and
  returns `mended`). The simulator's REST calls it; **the game's `restRoom` in
  `game/flow.ts` still calls `fullHeal` + `refillPotions`** until it is switched to
  `restHero`.

  | Pact | Curse | Boon | Mods |
  |---|---|---|---|
  | BRITTLE | −20 % max HP | +25 % damage dealt | maxHpMult 0.8, dmgMult 1.25 |
  | TITHE | clear heal 25 % → 10 % | +1 SP per clear | clearHealMult 0.4, spPerClear 1 |
  | HEX | elites and bosses +1 affix | elite and boss loot one rarity higher | foeAffix 1, rarityShift 1 |
  | IRON | foes +15 % ATK | +15 % max HP, +1 SP per boss | foeAtkMult 1.15, maxHpMult 1.15, spPerBoss 1 |
  | MISER | FIGHT rooms never drop | every loot screen +1 card | fightDrops 0, extraCard 1 |
  | STORM | ATTACK deals −15 % | BURST gauge fills ×1.5 | attackMult 0.85, burstGainMult 1.5 |
  | ASH | REST heals 50 % | every REST also gives an UPGRADE card (a 25 % mend if none) | restHealMult 0.5, restUpgrade 1 |
  | HUNTER | elites +30 % HP | elites +2 SP and a 4th card | eliteHpMult 1.3, eliteSp 2, eliteExtraCard 1 |

- **Loot in the descent** (`game/sim/descent-loot.ts`, `lootWeights(source, n)`): the
  act-4 row with +3 LEGENDARY per depth below 1 taken from COMMON, then RARE, never below
  0, LEGENDARY capped at 30 (`descentRow`); `minAct` is always met. Boss tables in the
  descent: a missed scroll first if any (no plan scroll, no fixed signature), then three
  rolled items from the BOSS row with COMMON and RARE weight moved onto EPIC (EPIC 70 /
  LEGENDARY 30), signature items not owned in the pool; MISER adds a card, capped at 4.
  Tuned from the contract: HEX's curse hit every foe; its win-through sat 7–16 % against
  26–43 % for the other pacts, so it now hits elites and bosses only (the ones whose loot
  its boon improves).
- **THRESHOLD** (sub-scene after the last boss's loot of every depth, `isLastActOfDepth(n)`):
  `ASCEND` → WIN with a glory bonus `gloryBonus(depth) = 1000 × depth`. `DESCEND` → `g.won
  = true`, `g.banked = g.score`, `descentClears` set on the first descent, `n += 1`, the
  next depth's plan drawn, then the PACT screen, then the depth's act card. A later death
  reaches GAME_OVER as usual; the score becomes `scoreAfterDeath` = banked + floor(half of
  what was earned since the last THRESHOLD) and the host hears `gameOver({ score, won:
  g.won })`. The scene machine is unchanged.
- **Score** (`game/sim/score.ts`): `scoreOf({ clears, bosses }) = clears × 100 + 500 ×
  bosses`, plus the glory bonus on ASCEND. (Before M4 it was `clears × 100`; the WIN
  number changes on purpose.) The best is stored as `{ score, depth, act }` under
  `retrovibe.ember-quest.best.v2` (`game/storage.ts`); while that key is absent the old
  bare-number key is read as `score` (depth 1); unreadable or corrupt values read as 0 and
  never throw. The title shows `BEST 14200` with `DEPTH 3` under it when the best run went
  below depth 1.
- **THRESHOLD presentation**: the cursor starts on ASCEND and A is ignored for the first
  1.0 s (the headline types itself in; both choices are drawn faint until then), so a
  player mashing through the VICTORY, LEVEL UP and loot screens cannot confirm either way
  by accident; DESCEND is an explicit Down + A. PACT arms after 0.5 s the same way. The
  depth card after the pact reads `DEPTH n` / `<BIOME> AWAITS...` / `SWORN TO <PACT>`.
- **Simulator**: `simulateRun(policy, rng, { descend })`; `descend` is off by default, so
  `npm run sim` still ends at the Seraph (its `--json` was byte-identical across the
  foundation step). With it on, runs descend until death or n = `SIM_MAX_N` (40), taking a
  pact on entering each depth by `policy.pactChoice(hero, offers)` (a fixed preference list
  per archetype; `random` picks randomly). `sim/run.mjs` prints the story table, then the
  descent table (`sim/descent-report.mjs`); `--story` prints the story alone (its `--json`
  is the pre-M4 format and stayed byte-identical through the M4 rules), `--descent-only`
  the descent alone.

## v3 — run summary (M5)

- **How the run ended** is `g.death` (`DeathRecord` in `game/state.ts`, presentation
  only): `killerId`, `killerName` (the first affix word + the foe's name, no affix on a
  `THE …` name), `elite`, `move` (`STRIKE`, `HEX` for a magic STRIKE, `WIND-UP`,
  `HEAVY BLOW`, `SCORCH`, `THORNS`, `BURN`, `BLOOD PRICE`), `damage`, `lastLines` (the
  two battle-log result lines before the fatal one) and `cause`
  (`BLOW | BURN | THORNS | BLOOD | ''`). `game/screens/battle-death.ts` resets it when a
  battle starts and fills it at the moment the hero falls (enemy blow, the turn-start
  burn tick, thorns backlash). An abandoned run is `g.abandoned` (the save milestone).
- **The summary** (`game/screens/ending.ts`, content in `ending-recap.ts`) shows on
  GAME OVER, ABANDONED and WIN: `DEPTH n  ACT n  BIOME`; for a death `SLAIN BY <killer>`
  (or `BURNED DOWN FIGHTING` / `BLED OUT FIGHTING`) and `ITS <MOVE> DEALT n`, the two
  log lines; the worn gear with levels packed onto at most two lines; `PACTS …`; and
  `NEXT TIME: <tip>`. A WIN swaps the killer for `GLORY +n   BOSSES FELLED n` and ends
  with an invitation (`THE DESCENT WAITS FOR YOUR NEXT RUN` after a depth-1 ascent,
  `DEPTH n+1 WAITS …` deeper). Nine rows at most; log lines go first when it overflows.
- **NEXT TIME** comes from a table keyed, in priority order, by THE HOLLOW, the cause
  (BURN, THORNS, BLOOD), the move (HEAVY BLOW, SCORCH, HEX), an elite killer, else
  STRIKE (`ABANDONED` has its own). Each key holds two to four concrete tips of at most
  44 characters; the one shown is picked by a hash of the run (score, clears, act,
  damage, SP), so it is stable on screen and varies between deaths.
- The event's one-card item screen titles itself `A GIFT  TAKE IT OR LEAVE IT`
  (`LootScreen.gift`), not the chest's line.
- `node sim/run.mjs --events` prints, per policy, each event's plays per run and its
  option split (also in `--json` as `events`); `--help` lists every flag.

## v3 — save, resume and pause (M5)

- **What is saved**: one run in `localStorage` under `retrovibe.ember-quest.run.v1` as
  versioned plain JSON (`SavedRun`, `game/sim/save.ts`, headless; readers in
  `save-read.ts` / `save-map.ts`): the hero with items as ids + levels (worn and packed),
  alloc, SP, HP/MP, potions, ember, burn and pending burn, bonus max HP, spells, missed
  scrolls, revive flags, dry fights, pacts; the run counters (`n`, clears, bosses, the
  frozen descent clears, score, banked, `won`); the depth plan (all four `ActPlan`s);
  the map (rooms with type, links, cleared, enemy id, affixes; current stage, reachable,
  cursor); the seeded rng state; and a **step**: `MAP`, `ROOM` (stage, slot), `THRESHOLD`
  or `PACT` (with the offers already drawn). Items, foes, spells and pacts are rebuilt
  from the content tables by id.
- **When**: whenever the map is shown (a room resolved, an act or depth entered — the
  map is now generated *before* the `… AWAITS` card, so closing on that card resumes on
  the new map), **just before a room's handler runs** (`selectNode`: the hero as on the
  map, the entered room recorded, the rng state of that instant), when THRESHOLD opens,
  and when PACT opens (after its offers are drawn). Entering GAME_OVER or WIN deletes it.
- **Resume**: the title band becomes `CONTINUE  DEPTH n ACT n  BIOME` / `NEW RUN`;
  NEW RUN over a save asks once (`ERASE YOUR RUN?`, A yes, B no). CONTINUE restores
  everything and the rng state, then re-enters the step: the map; the saved room, replayed
  from the saved rng state (same foe, same loot rolls, same event; the boss entry heal is
  applied once because the save holds the hero from before it); THRESHOLD; or PACT with
  the same offers — reloading cannot reroll a room or a pact. **Accepted**: a fight in
  progress restarts from its first turn, and closing on any screen inside a room (level
  up, loot, a card, the boss's victory screens) replays the whole room from its entry.
- **Version policy**: `version` is 1. A save with another version, malformed JSON, an
  unknown item / foe / spell / pact id, a level past the item's cap, an out-of-range or
  non-finite number, a map whose links or step point outside it, or a depth plan without
  four acts is rejected by `loadRun` (which never throws) and dropped silently: the title
  shows no CONTINUE. A change to the saved shape bumps the version; old saves are dropped,
  never migrated.
- **The dev hook never reads or writes it**: with `?seed`, `?scene` or `&hold` the hook
  owns the rng (`g.rngFromHook`) and saving, loading and deleting are all skipped.
- **Pause**: Up/Down over `RESUME` / `ABANDON RUN`, A to choose; ABANDON asks
  `REALLY ABANDON?  A YES  B NO` (A again confirms, B backs out); PAUSE still resumes at
  once. Abandoning sets `g.abandoned`, goes PAUSED → PLAYING → GAME_OVER in the same tick
  (the scene machine forbids PAUSED → GAME_OVER), is reported to the host as an ordinary
  game over (the unbanked-half rule applies), and deletes the save. The overlay keeps
  listing the pacts.
- **ASH in the game**: REST calls `restHero`; the card reads `REST HEALS 50%`, the HP / MP
  restored, and either `THE ASHES OFFER AN UPGRADE` (A opens `UPGRADE WHICH?` through the
  loot chooser with a single UPGRADE_ANY; B backs out to that one-card loot screen, where
  KEEP YOUR GEAR gives the usual skip mend) or `NOTHING TO UPGRADE  MENDED n HP`.

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
- Enemies scale `(base + perClear × clears) × actMult(n) × def.mult`; `ACT_MULT` [1.15, 1.95, 2.78, 3.41] for n ≤ 3 (see *the endless descent*); in the descent `clears` is the frozen `descentClears`.

## Difficulty targets (balance sim, sane policy)

Story run, `balanced`: act 1 clear ≥ 80 %, act 2 ≈ 65 %, act 3 ≈ 50 %, full run 30–40 %.
`random` < 8 %. Descent, `balanced`, of runs that beat the Seraph: ≈ 40 % (± 15) clear
depth 2, ≈ 10 % depth 3, none clears depth 5 in 2000 runs; no pact's win-through wildly
off the others. `naive` ≤ 75 % of balanced's win rate. No STALL deaths. Late-game
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
`ELITE  NAME  HEXES  AFFIX +n` stays inside 224 px (the verb is dropped first when it does
not); the map header `DEPTH n  ACT n  BIOME` <= 30 chars. Descent screens: THRESHOLD
headline <= 22 chars at scale 2, its detail lines <= 134 px (33 chars) beside the 82-px
label column; PACT names <= 12 chars (58-px column), `CURSE: ` / `BOON: ` + line <= 158 px
(pact lines <= 30 chars); the PACT sky card's affix line wraps to at most two lines of
<= 180 px; the enemy tag strip shows one affix word (cycling every 1.6 s) plus `+n`,
falling back to the bare word when `+n` does not fit beside WEAK; affix ids <= 8 chars.
The ending summary `DEPTH n  n CLEARED  SCORE n  BEST n` <= 180 px. Pause lists the
pacts joined with ` / ` on lines <= 172 px.

## Balance state (measured with the headless simulator, 2026-11-24)

Harness: `npm run sim` (`sim/run.mjs`) bundles `game/sim.ts` with esbuild into a
temporary directory (`sim/bundle.mjs`), then calls `simulateRun` with each of
`POLICIES` and a seeded PRNG (`createSeededRng`; `--runs`, default 2000; `--seed`,
default 1; `--policy`; `--json`; `--no-potions`). Same seed and same code give
byte-identical `--json` output. The simulator replicates the drop rates, upgrade cards and
boss tables, and plays **the same map generator as the game** (`game/sim/map.ts`).
Numbers below: 2000 runs, seed 1, after M3 items (69-item pool, EMBERS/TREMOR/AEGIS) with
the EVENT rooms in the tree as they stood on 2026-11-24. `--items` adds a per-item table
(offered, pick rate when offered, runs holding it at the end and their win rate) over
balanced + glass + tank, and the effect kinds worn at the end.

| policy | win | reach act 2 | act 3 | act 4 | boss clears a1/a2/a3/a4 |
|---|---|---|---|---|---|
| balanced | 35 % | 99 % | 71 % | 50 % | 99/84/82/74 |
| naive (no verbs) | 9 % | 91 % | 35 % | 19 % | 91/53/66/60 |
| balanced, no potions | 18 % | 95 % | 45 % | 29 % | 99/72/76/66 |
| glass (all offence) | 15 % | 99 % | 60 % | 32 % | 99/78/67/54 |
| tank (HP/DEF, physical) | 20 % | 99 % | 53 % | 25 % | 99/67/58/85 |
| elite-hungry routing | 35 % | 99 % | 72 % | 50 % | 99/85/81/74 |
| chest-hungry routing | 28 % | 99 % | 69 % | 47 % | 99/79/80/65 |
| random picks + points | 0 % | 33 % | 0 % | 0 % | 43/0/–/– |

M3 item findings: every item is picked 8–68 % of the times it is offered to balanced/glass/
tank (top LUCKY BOOTS 68, SHADOW EDGE 64, EMBER TREADS 59, TITAN PLATE 58, DARK CROWN 55;
bottom GOLEM FIST 8, RUNE TORC 8, JADE AMULET 9, OAK STAFF 9, GLASS SABER 10). Adding 25
items diluted the pool: with the new items offered but never taken balanced fell from 37 % to
28 %, so the new RARE/EPIC items carry real stat lines and the conditional kinds (PUNISH,
PARRY, COUNTER) big multipliers, while `EFFECT_VALUE` rates them low (the policies took
them over better items when they were scored like the old kinds). Old items retuned: SHADOW
EDGE crit 18 → 12 (was picked 80 %), BLOOD CUP ATK/MAG 6 → 4 (73 %), GOLEM FIST atk 15 → 19
+8 % crit, opener 2.2 → 2.5 and the THUNDER scroll's policy score 34 → 28 (it was never
taken over the scroll), RUNE STAFF mag 10 → 12 +4 MP, RUNE TORC +14 HP +1 HP/turn, JADE
AMULET mdef 18 → 20 +6 MP, WAR CLEAVER atk 10 → 12 +4 % crit, PLATE ARMOR +10 HP, GLASS SABER
atk 12 → 15, NIGHT SCEPTRE mag 17 → 20. PARRY_POWER and GUARD_MANA only exist on common
awakenings, so few runs end wearing them (10 and 18 of 6000).

Verb use per run (balanced): GUARD 4.6 (PARRY 4.7), BURST 4.4, POTION 2.2, BREAK
succeeded/attempted 0.25/0.39 normals, 0.62/0.97 elites, 1.56/1.94 bosses (the attempt
count misses PUNISH and IMBUE breaks: `run-battle` counts weakness spells and BURST only);
phase 2 reached 2.9 times. naive/balanced = **0.27** (target ≤ 0.75). 0 STALL deaths in
any policy; BURN ticks end 5.2 % of balanced runs (104 / 2000).

M2 (2026-11-24), for reference: balanced 38 %, naive 10 %, glass 22 %, tank 19 %, random 0 %.

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

### The descent (2026-11-24)

`node sim/run.mjs --descent-only` (2000 runs per policy, seed 1, `descend: true`). Shares
are of the runs that beat the Seraph; deaths are of those descenders who died below
depth 1 (THORNS = killed by THORNED backlash; affix column = the killer carried it, one
death can count several).

| policy | beat Seraph | clear d2 | d3 | d4 | d5 | final n mean / median | deaths ELITE / BOSS / HOLLOW / THORNS / NORMAL |
|---|---|---|---|---|---|---|---|
| balanced | 675 | 38 % | 11 % | 0 % | 0 | 7.3 / 7 | 47 / 26 / 21 / 4 / 1 % |
| naive | 211 | 27 % | 6 % | 0 % | 0 | 6.5 / 6 | 40 / 37 / 19 / 2 / 1 % |
| glass | 278 | 15 % | 1 % | 0 % | 0 | 6.0 / 6 | 32 / 32 / 32 / 2 / 2 % |
| tank | 401 | 42 % | 5 % | 0.5 % | 0 | 7.7 / 7 | 18 / 27 / 46 / 8 / 1 % |
| elite-hungry | 707 | 31 % | 6 % | 0.1 % | 0 | 6.8 / 7 | 46 / 26 / 22 / 4 / 2 % |
| chest-hungry | 603 | 43 % | 12 % | 0.2 % | 0 | 7.5 / 7 | 31 / 38 / 22 / 3 / 5 % |

0 STALL deaths in any policy; nobody clears depth 5. Top killers (balanced): HOLLOW 154,
FROST WISP 129, SERAPH 107, MUMMY 100. Affix on the killer (balanced): SWIFT 50 % (the
Hollow takes it off dodge boots), THORNED 37 %, SEARING 26 %, WARDED 22 %, VAMPIRIC 21 %,
ARMORED 13 %.

Pact win-through (took it, then cleared the depth it was sworn at), within policy:
balanced IRON 37 %, ASH 36 %, TITHE 34 %, HUNTER 28 %, MISER 28 %, HEX 25 %; tank 26–37 %
(HEX 33 %); elite-hungry 21–32 % (HEX 21 %, its most taken after HUNTER); chest-hungry
18–40 % (HEX 18 % on 22 takes); glass 12–17 % for BRITTLE, STORM, TITHE, HEX. Pooled over
the non-random policies 15–33 %: ASH 33, IRON 33, MISER 32, TITHE 32, HUNTER 29, HEX 21,
BRITTLE 15, STORM 15 (the last two are glass's picks, and glass descends worst).

Tuning in M4 (descent only; the story table is byte-identical): `DESCENT_GROWTH` 1.08 →
1.20 (balanced cleared d2/d3/d4/d5 50/34/23/17 %, tank 89/87/86/84 %); THORNED 20 % →
15 % capped at 12 % of hero max HP; THE HOLLOW ATK share 0.5 → 0.7 and HP 8 → 30 plain
hits; HEX's curse narrowed to elites and bosses.

### The map generators are unified

There is one generator, `generateMap` in `game/sim/map.ts`; `game/mapgen.ts` only
adds the screen fields. The simulator used to link more stingily (about 39 % of nodes
with two onward links against 74 % in the game), which understated the real game's
win rate by about five points; the table above is measured on the game's map.
