# Ember Quest — systems design (v3: The Long Descent)

This file is **the** systems contract for v3, "The Long Descent": every rule and number
the game plays by is stated here and matches `game/types.ts` and `game/rules/*`. The
owner's decisions that v3 was built on are listed in *Owner decisions* at the end; the
numbers in the plan they came from were superseded by the balance passes recorded below.

A roguelike JRPG: branching node map per act, turn-based one-on-one battles,
permadeath, **skill points** and a **loot table of named items with unique effects**
(from v2), and since v3 a 4-item pack, battle verbs, EVENT rooms and an endless descent
past the fourth act.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + tuning constants (caps, SP gains) | nothing |
| `game/data.ts` | the content import path: re-exports `game/rules/*` (ITEMS, ENEMIES, SPELLS, BIOMES, LOOT_WEIGHTS, ACT_MULT, the heal constants, `validateData`, EVENTS and their types) | `./rules/*` only |
| `game/rules/*.ts` | the content itself: `items` (ITEMS), `enemies` (ENEMIES), `world` (SPELLS, SPELL_ORDER, BIOMES, ACT_MULT, LOOT_WEIGHTS, LOOT_COUNT, CLEAR_HEAL, BOSS_ENTRY_HEAL, SKIP_MEND, RARITY_COLOR_INDEX), `validate` (`validateData`; never imports `data.ts`), `events` (EVENTS, the effect vocabulary, `validateEvents`), `pacts` (PACTS, `validatePacts`); `enemies` also holds the descent-only THE HOLLOW | `../types`, each other |
| `game/sim.ts` | the barrel: the only path presentation and the simulator use to reach the rules (also re-exports `validateData`, `generateMap`, `createSeededRng`, `at`) | `./sim/*`, `./data` |
| `game/sim/*.ts` | pure rules, one concern per file: `util` (clamp, `at`, rng picks, `createSeededRng` — mulberry32 with readable state — and effect tables), `gear` (item levels, upgrades, effective mods/effects), `hero` (derived stats, skill points, heals, equip, spells), `ghost` (stats of a hypothetical equip), `describe` (item/offer/compare text, `compareFull` — its `awaken` and `describeOffer`'s spare third line carry `awakenPreview(item, level)` = `AT +2: <awaken blurb>`, '' for legendaries and awakened items), `loot` (loot rolls, offers, scrolls, `resolveUpgrade`), `pack` (the pack: `stow`, `discard`, `swapIn`, `unequip`, `ownedIds`, `upgradableTargets`), `combat` (enemy scaling, battle creation, hero actions, damage), `commands` (GUARD, POTION, BURST, BREAK), `enemy-turn` (enemy moves, intent, phase), `status` (turn start, BURN, WARD, `heroFalls`, `livesLeft`, and `canAfford` / `canDrinkPotion`, judged on the hero as the turn start leaves him), `turn` (`resolveTurn`: one whole turn on two per-turn rng streams, played by the game and the simulator), `rehearse` (the hero's half-turn played on a shadow copy under a scripted roll, and the least favourable rolls), `preview` (the battle menu's facts, read off rehearsals: `preBlowFate`, `strikeFacts` / `strikeKind` / `burstKind`, `breakFacts`, `healPreview`, `guardFacts`, `expectedPreBlowLoss`, `expectedPlan` — the screen only words and colours them), `element`, `burst`, `power` (the gear-driven damage multipliers: IMBUE element, PUNISH, LOW HP, ELEMENT BOOST, riposte power, ignite chance, the guard counter), `stack` (how two worn items of one effect kind combine: RAMP per scope, SPELL_TWICE per spell, the stronger TWIN / FIRST_STRIKE / HEX / DRAIN / MP_ON_HIT / EXECUTE, summed REFLECT), `events` (event effects, enablement, `eventPlayable`, `pickEvent(rng, hero)`, `takePendingBurn`, preview words), `map` (**the one map generator**, `generateMap(rng, shape?)`, played by both the screens and the simulator), `model` (`Policy`, `RoomType` including `BOSS`), `scoring`, `policies`, `policy-battle` (how they fight) and `policy-choices` (how the archetypes decide; `DEFAULT_CHOICES` holds the shared pack/upgrade/prepare defaults), `descent` (`n`, `depthOf`, `actInDepth`, `actMult`, `ActPlan`, `planDepth`), `affixes`, `hollow` (`hollowOf` with its private best-loadout `armouryOf`, `spawnFoe`), `pacts` (`pactMods`, `offerPacts`, `lootCards`, `swallowedCards`), `score`, `run` (`simulateRun`), `save` / `save-read` / `save-map` / `save-battle` (the save format) and `save-sanity` (`saneSave`: the cross-field checks run after a save is read) | `../types`, `../data`, each other |
| `game/sprites.ts` + `game/sprites/*.ts` | hero/enemy/icon sprites: `helpers`, `hero`, `icons`, one file per biome; `sprites.ts` re-exports them and adds `enemyAnim(id)` | `../engine` only |
| `game/main.ts` + `app`, `state`, `flow`, `persist`, `resume`, `frame`, `mapgen`, `theme`, `backdrop`, `widgets`, `pops`, `fx-state`, `fx`, `transition`, `storage`, `lookup`, `screens/*.ts` | presentation: `main.ts` only wires; `app` creates the engine objects and fits the canvas to the window; `state` holds the one `Game` object `g` with per-screen slices; `flow` runs the run (rooms, stages, clears, acts, scene hooks); `persist` writes and deletes the save (`realRun`, the step builders, `settleRoom`); `resume` reads it back and re-enters its step; `frame` dispatches update/render; `mapgen` adapts the shared headless map to the screens (adds `stage`, `slot`, `cleared`); the **fx / transition layer** presents what the rules decided and never decides anything — `fx-state` + `fx` hold the battle-fx clock (actor poses, timed cues, lagging meters, boss banner), `screens/battle-fx` choreographs a turn on it, `screens/battle-fx-verbs` gives each battle verb its beat, `screens/battle-fx-view` draws its shots and banner, `screens/battle-menu` holds the command menu, `screens/battle-tags` the tag strips under the plates, `screens/battle-reach` measures lunges, `transition` reveals each new sub-scene; `screens/` one update file and one view file per screen (`map-view`, `loot-view`, `battle-view`; `plate` holds the shared medallions) | everything |
| `game/devhook.ts` | the dev-only seeded hook (`?seed`, `?scene`, `&act`, `&depth`, `&hold`, `window.__ember`), never in the build | `../engine` types, `./sim`, presentation types |
| `sim/run.mjs`, `sim/bundle.mjs`, `scripts/rules.mjs` | the balance simulator; the shared esbuild bundling of `game/sim.ts`; the rules gate (`npm run rules`, part of `verify`): `node:assert` invariants against the bundle — every map node reachable and linked, one BOSS last, ELITE + REST + LOOT on every map (5000 seeds), seeded-rng determinism and state round-trip, `validateData()` clean | the bundle |

`types.ts`, `data.ts`, `sim.ts` and `game/sim/` are **headless** (no engine, no DOM,
no presentation import, no `Math.random` — every roll takes an injected `rng`) so the
balance simulator can bundle them (`esbuild game/sim.ts --bundle`) and Monte Carlo
thousands of runs. ESLint and dependency-cruiser enforce the boundary.

## Progression

- **Skill points**: NORMAL clear 2 SP, ELITE 3, BOSS 4 (`SP_PER_KIND`). Spent
  on the LEVEL UP screen right after the fight, before loot. One point buys
  `SP_GAIN[stat]`: HP +6, MP +3, ATK +2, MAG +2, DEF +3 %, MDEF +3 %, CRIT +2 %.
  `spendPoint` refuses a point on DEF / MDEF / CRIT when the derived stat already sits at
  its cap (`CAP_STAT`; returns false and keeps the SP) — the LEVEL UP screen shows MAX.
- Clears also heal 25 % of max HP/MP (a breather, not a reset) and put out the hero's
  BURN (`grantClear`). REST = full (and puts out BURN too).
- **Entering a new act gives one potion back** (`ACT_POTIONS` 1, never above
  `POTIONS_MAX` 2): `enterActRecovery(hero)` (`game/sim/hero.ts`), called by the game's
  `advanceAct` / `enterDepth` (`game/flow.ts`) and the simulator's `nextAct`, right after
  `n` moves on. Potions are no longer refilled only at rests.
- Boss node: heal 60 % entering. **One boss per act** (the Crypt gauntlet is
  gone: OGRE KING and WRAITH LORD become Crypt elites, DARK LORD is the boss).
- Caps: DEF/MDEF 42 %, CRIT 60 %, DODGE 40 % — items + points together.
- No spell is learned on act entry: FIREBALL is known from the start, and WATER, SLASH and
  THUNDER are boss scrolls (see *Spells and boss tables*). TOME items grant extra spells
  (TWINBOLT, LEECH, QUAKE, MEND, EMBERS, TREMOR, AEGIS) while equipped.

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
Upgrades arrive as an **UPGRADE card** (`UPGRADE_ANY`) on the loot screen; taking it opens
`UPGRADE WHICH?` and the player **chooses** which worn or packed, not-maxed item rises (see
*Chosen upgrades* in the pack section; nothing is picked at random). It is offered when
something is upgradable: in every chest unless the chest's missed-scroll roll put a scroll
there instead, 20 % of the time from fights and 25 % from elites, never from bosses
(`UPGRADE_CHANCE`).

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
always decline for a 25 % mend. In the run's first act (`n` 0), while the hero owns no
weapon (worn or packed), every FIGHT, ELITE and chest roll includes a common blade or wand
and a FIGHT never rolls dry — so the run's first fight always drops one (review round 2: a
real run reached the act-1 boss never offered a weapon; 4000 simulated runs now all see one
before it). The weapon takes the weakest non-scroll card (an UPGRADE card first, then the
lowest rarity), or an empty place when the roll came up short; it never replaces a scroll,
and boss tables are never touched. After the first act a weaponless hero is left to its
choice (review round 3: a caster who kept declining blades got one forced into every roll,
and a boss table could lose its EPIC). The guarantee is checked before MISER's curse; the
two never meet in play, since pacts are sworn from depth 2.

### Spells and boss tables

Spells are no longer learned on act entry. FIREBALL is known from the start;
WATER, SLASH and THUNDER are **scrolls** offered by the boss that ends acts 1,
2 and 3 (`Biome.scroll`). A scroll is learned permanently and takes no slot.
Declining it is a gamble, not a sentence: a missed scroll re-enters later
chests at `MISSED_SCROLL_CHANCE` and the next boss table always carries it.
Each boss also owns one **signature item** (`Item.bossOnly`) that never
appears elsewhere — Dark Lord's crown, Yeti's hide, the Golem's fist.

The map guarantees one elite, one rest, one chest and one event per act, and caps elites:
**never more than half of a stage's nodes are ELITE** (`floor(size / 2)`; extra rolled
elites become FIGHTs, left to right, with no rng draw), so no stage is all-ELITE and two
all-ELITE stages can never follow each other — in the story and in every descent shape (a
rules test runs 7- and 8-stage maps). When it has to
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
  plus the entering item; A drops one for good; B is ignored, silently — the offer is already applied, so a
  choice must be made, and the prompt says `YOU MUST CHOOSE`). The cursor opens on the
  least valuable candidate (lowest rarity, then lowest level; the entering item on a tie),
  never on the item just replaced, and A is armed as on every PICK). Dropping the
  newcomer still counts as taking the offer (no mend). KEEP YOUR GEAR (25 % mend) stays.
- **The loot contract.** `applyOffer(hero, offer, rng, { stow? })` returns
  `{ line, replaced?, stowed, overflow? }`. A full pack never drops anything silently: the
  item that had to enter it comes back as `overflow` (the equip itself has happened), and
  `resolveOverflow(hero, entering, dropIndex)` drops one of `[...pack, entering]` and
  returns it.
- **Owned items never re-roll**: `rollItems` and the boss signature exclude `ownedIds`
  (worn + packed). The starter-weapon guarantee is a rule (`rollLoot` applies it): it
  looks at every owned weapon (worn or packed — unequipping a weapon never changes a chest)
  and offers a common weapon not already owned; with no ITEM card to replace it is added. Scrolls
  never touch the pack. A loot screen shows at most 4 offers.
- **REVIVE charges live on the hero** (`revived`, `revivedTwice`), so swapping a spent
  REVIVE item out and in never restores a life — nor does a fresh REVIVE item after an
  earlier revive, unless it holds more lives than were spent (`twice`). The text never
  sells a dud: when wearing the item would add no life (`reviveSpent(hero, item, level)`),
  the offer's blurb line reads `REVIVE ALREADY SPENT THIS RUN`, `compareFull`'s GAIN reads
  `ALREADY SPENT THIS RUN`, and the policies score its effect at 0. GLASS / HP items clamp current HP when
  worn; taking them off gives nothing back.
- **GEAR** (sub-scene `GEAR`, B on the map, B again returns): the six worn slots and the
  pack (Up/Down run over slots then pack rows; Right jumps to the pack, Left from a pack
  row to its slot). A on a pack row swaps it into its slot (`swapIn`); A on a worn row takes it off
  into the pack if there is room (`unequip`), else a refusal blip; A on an empty slot wears the first
  pack item that fits it (a blip when none does). No discarding here. Closing GEAR saves the run (`MAP`).
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
  it, and the map readout names the highlighted foe and its weakness (`WEAK FIRE`); the map
  header names the act boss's weakness from the first room (`ACT 1  THE CRYPT  BOSS  WEAK
  FIRE`, the biome name dropped first when the corners crowd it). An empty elite pool falls back to
  the normals.
- **Simulator policies** also choose `stowOrEquip` (keep the higher-scored item worn under
  the archetype's profile), `dropWhich` (drop the lowest-scored of pack + entering),
  `upgradeTarget` (the worn item with the best scored gain; a packed one only when nothing
  worn is upgradable), and `prepare(hero, foe)` before every fight and boss (wear the best
  item per slot among worn + packed, weighting MDEF ×2 against a MAGIC attacker and DEF ×2
  against a PHYSICAL one; a swap needs a 0.5-point edge). `prepare` runs against the foe's
  definition before the foe is spawned (THE HOLLOW is sized at spawn). The `random` policy picks all
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
  = the move at `cycleIndex` (a spent MEND, or a MEND while the foe is at full HP, reads
  as STRIKE), set at battle creation and
  advanced after every enemy action, deterministic. Dodge is rolled first and only for
  damaging moves; a dodged move still advances the cycle and a dodged SCORCH burns nothing.

  | Move | Effect | Plate text |
  |---|---|---|
  | `STRIKE` | today's hit | `STRIKES` / `HEXES` |
  | `WINDUP` | ×0.6 hit (`WINDUP_MULT`); always followed by `HEAVY` | `WINDS UP` |
  | `HEAVY` | ×2.0 hit (`HEAVY_MULT`; 2.2 before the 2026-11-24 balance pass) | `HEAVY BLOW` |
  | `WARD` | no damage; `wardTurns` = 2: resist = min(60, instance + 25) for the hero's next 2 actions (GUARD counts); never written into the instance; re-applying refreshes | `WARDS` |
  | `SCORCH` | ×0.7 hit; the hero gains BURN | `SCORCHES` |
  | `MEND` | heals 10 % max HP (bosses 6 %, `BOSS_MEND_FRACTION`, review round 2) once per phase; afterwards that entry acts as `STRIKE`. A foe at full HP never MENDs: the entry shows and resolves as `STRIKE` and the once-only `mended` flag is kept (review round 3: a whole foe used to print `MENDS +0 HP` and lose its mend) | `MENDS` |

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
  does not tick on a turn the hero guards (`startTurn(hero, action)`); a GUARD
  directly after a GUARD (`battle.guardChain` > 1) is ×0.75 and gives no MP and no
  ember — unless it answers a shown `HEAVY` (full ×0.5, and it parries). **Only a
  damaging hero action (ATTACK, a damaging spell, BURST — a SWIFT miss counts) resets the
  chain**; POTION and the MEND spell leave it where it was, so GUARD, MEND, GUARD is a
  chain (the second GUARD pays no MP and no ember; the menu calls it `A CHAINED GUARD`, not "you guarded last", since a POTION or MEND may stand between, and the ending tip reads `GUARD HALVES ONE BLOW - LESS IF CHAINED`). AEGIS counts as a GUARD. GUARD leaves RAMP
  stacks, `lastScope` and FIRST_STRIKE alone (`actionsTaken` counts damaging and healing
  actions: spells, ATTACK, POTION).
- **Soft enrage** (anti-stall; the game has no turn cap). `battle.calm` counts consecutive
  enemy actions in which the foe took no damage (`battle.foeMark` is its HP at the end of
  the previous enemy action; a hit, BURST, a burn tick, a reflect or a counter all count as
  damage; a MEND does not). From the `ENRAGE_AFTER` + 1 = 13th calm action on, the foe's
  ATK rises 10 % (`ENRAGE_STEP`, at least +1) before each action, and the result carries
  `EnemyActResult.enraged` and `aside` = `IT GROWS IMPATIENT - ITS BLOWS HIT HARDER`
  (`ENRAGE_LINE`; '' otherwise). Any damage resets the count; the raised ATK stays.
  `calm` and `foeMark` are required `BattleState` fields and are saved with a fight, so
  reloading cannot reset the count (a rules test: the calm foe first enrages on exactly its
  13th calm action, and `calm` survives save/load).
- **One whole turn** (`resolveTurn(hero, battle, action, roomSeed)`, `game/sim/turn.ts`;
  review round 2). In order: `startTurn(hero, action)` (regen, BLOOD; `TurnStart` is
  `{ hpRegen, mpRegen, bloodLoss }`) → `heroAct` (its BREAK check, then the hero's BURN
  tick) → unless the hero or the foe fell, `enemyAct` (phase check, enrage, the shown move,
  then the foe's BURN tick). It returns `TurnResult { turn, action, start, hero, enemy
  (null when the fight ended on the hero's action), outcome ('WON' | 'LOST' | null), cause
  ('HIT' | 'THORNS' | 'BURN' | 'BLOW' | 'RECOIL' | 'FOE_BURN' | null) }` and advances
  `battle.turn` (saved). The hero's rolls come from `turnRng(roomSeed, turn, 'HERO')`, the
  foe's from `turnRng(roomSeed, turn, 'FOE')` (`createSeededRng(turnSeed(…))`, a murmur
  mix of the room seed, the turn index and the stream), so the foe's turn-N roll (dodge,
  jitter) is the same whatever the hero chose, and a reloaded turn replays exactly. The
  simulator draws a room seed from the run rng at each fight's start and plays every turn
  through the same function. `heroAct` / `enemyAct` stay as the internals it composes.
- **Battle log lines** (rules text, ≤ 52 chars; the screens show them as given). Every
  guarded blow names the hero as the one who takes the damage (review round 5: `PARRIED
  FOR n` and `THE BLOW ONLY GRAZES YOU` both read as damage dealt): a GUARD or AEGIS reads
  `YOU BLOCK - TAKE n`, a chained guard `YOUR GUARD TIRES - TAKE n`, a parried HEAVY `YOU
  PARRY - TAKE n - YOUR NEXT STRIKE HITS HARDER` (the tail dropped when it would not fit),
  a dodged parry `DODGED AND PARRIED! YOUR NEXT STRIKE HITS HARDER`, a burning hit ends `-
  YOU BURN!` when it fits. A guarded blow that kills keeps the same head: `YOU PARRY - TAKE
  n - YOU FALL!` (`YOU BLOCK …`, `YOUR GUARD TIRES …`; past 52 chars the number goes:
  `<HEAD> - YOU FALL!`), and with a REVIVE `<HEAD> - <FOE> FELLS YOU - YOU RISE!` (`<HEAD> -
  IT FELLS YOU - YOU RISE!` when the foe's name would push it past 52). An unguarded hit
  reads `<FOE> STRIKES YOU FOR n!` (HEXES, WINDS UP AT, SMASHES, SCORCHES). WARD `<FOE>
  RAISES A WARD - YOUR HITS SOFTEN`; a broken foe `<FOE> IS STAGGERED AND LOSES ITS TURN`;
  burn ticks `YOU BURN FOR n` / `THE FLAMES TAKE YOU! (n)` / `<FOE> BURNS FOR n [AND
  FALLS!]`.
- **Who wins a tie.** When one enemy action kills the hero and also kills the foe (REFLECT,
  AEGIS, a guard counter), the hero's death wins: the fight is lost (REVIVE still answers
  first). The game reads `heroDead` before `enemyDefeated`; the simulator's `run-battle`
  does the same.
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
  reason in the hint line (`NOT ENOUGH MP`, `NO POTIONS LEFT`, `YOUR HP IS FULL`, `THE EMBER IS NOT FULL
  YET`); POTION is dim at full HP as well. A preview column right of the grid (3 lines) shows what the highlighted command
  does against this foe: `ATK X1.0` / `MAG X0.8 2 HITS`, `WEAK X1.5` / `RESIST X0.5`,
  `-25% WARD` / `-30% RES`, `BREAKS IT` (accent) / `NEEDS n+ WEAK DMG` (`NEEDS n+ DMG` with
  PUNISH_WINDUP worn; n the real floor `ceil(BREAK_AT[kind] × maxHp)`) / `NOT WEAK: NO BREAK`
  (orange, for a damaging command that is not eligible) against a shown HEAVY,
  `RIPOSTE X1.5`. Every damaging command's first line opens with `~n DMG`
  (`expectedHeroDamage`: no jitter, no crit, on the hero as the turn start leaves him —
  regen and BLOOD applied first, so LOW HP gear is judged at hit-time HP). GUARD shows the
  expected blow `TAKE ~g OF u` (`expectedFoeDamage`, guarded / unguarded, with the foe's
  phase switch and its enrage step folded in when its next calm action crosses
  `ENRAGE_AFTER`, and a MEND the foe can no longer cast counted as the STRIKE it becomes;
  `NO BLOW IS COMING` exactly when the unguarded figure is 0), under `PARRY THE HEAVY BLOW`
  on a HEAVY, `+n MP IF STRUCK` with n the real gain (`guardFacts(...).mpGain`: `GUARD_MP_GAIN`
  + GUARD_MANA gear, capped at max MP; the line is left out when it is 0) and, on a chained
  guard (`guardTires`), `A CHAINED GUARD` / `NO MP OR EMBER`. **The preview contract**: the
  screen never re-derives a rule; every number and verdict comes from `game/sim/preview.ts`,
  which reads it off a *rehearsal* — `startTurn` and `heroAct` run on a shadow copy under a
  scripted roll (`rollScript(battle, plan)`, owned by `combat`, which knows its own draw
  order: the SWIFT evade draw, then per hit a jitter draw and a crit draw, then the ignite
  draw). The `rules` suite's `preview` group fuzzes 20 000 states and checks every fact below
  against real turns. (1) **Fate before the blow** — `preBlowFate(hero, battle, action)` →
  `SAFE` / `RISES` / `FALLS` plus the cause (`BURN` or `THORNS`; BLOOD is capped at HP − 1 and
  never kills alone), judged at the **least favourable roll**, built deliberately
  (`worstRolls`, `game/sim/rehearse.ts`): the lowest roll (every hit at minimum jitter, no
  crit — least damage, least DRAIN/LEECH healing, least chance to end the fight); the SWIFT
  evade (no damage at all); and against a THORNED foe the total that hurts most — every hit's
  damage is a rounded continuous function of its jitter, so each crit pattern reaches every
  integer total between its lowest and highest roll; the total below the foe's HP that
  minimises `min(room, volleyHeal(total)) − thornsDamage(total)` is picked arithmetically and
  then realised as a real roll (hits raised in order, the one partial hit's jitter found by
  bisection) and rehearsed. The worst of those rehearsals is the fate, and its roll is
  returned (`PreBlow.plan`), so the gate replays it. A full BURST cleanses first, a hit whose
  lowest roll fells a foe that cannot evade ends the fight first, heals count exactly
  (they roll nothing), and a REVIVE charge turns a fall into `RISES` (`livesLeft`). The line
  reads `BURN n KILLS YOU` / `THORNS WILL KILL YOU` (pink) or `BURN n - YOU RISE` /
  `THORNS - YOU RISE` (orange); on a damaging command it shows only when the fate is not SAFE
  (MAGIC: when every castable spell is, the mildest shown); POTION, GUARD and healing spells
  otherwise end on `THEN YOU BURN -n` with n the rehearsed tick. GUARD heads `GUARD WON'T SAVE
  YOU` (pink, take line pink) when the expected guarded blow is at least the HP the hero stands
  at when struck (`guardFacts(...).lethal`, the rehearsal at the expected roll), or `GUARD
  FAILS - RISE` (orange, take line orange) when a REVIVE charge is left then. (2) **Damage**
  `~n DMG` = `expectedHeroDamage` (exact at the expected roll: jitter 1, no crit, no evade).
  (3) **Damage kind and resist** — `strikeFacts(hero, battle, action)` from the same `swingFor`
  the real hit uses, so an awakened HEX STRIKE (all physical hits as MAGIC) and a magic weapon
  show the resist they actually meet; the same kind picks the ATTACK's look (`strikeKind`) and
  the glance hint. (4) **Break verdict** — `breakFacts` runs the expected roll through the real
  `settleBreak` (`BREAKS` / `SHORT` with `need` = `breakNeed(enemy)` / `NOT_WEAK`). (5) **Heals**
  — `healPreview`, the rehearsed heal after turn-start regen and BLOOD. BURST shows `CLEANSES YOUR BURN` while burning; POTION `HEAL 40% HP`; BURST `IGNORES ARMOR+WARDS`. The hint line reads
  `HEAVY BLOW NEXT (~u): GUARD, OR BREAK IT` on a HEAVY, `WINDING UP: HIT NOW, GUARD NEXT
  TURN` on a WINDUP, and otherwise `ATTACKS GLANCE OFF: TRY MAGIC` when ATTACK is resisted
  (an element below 1 or 20 %+ resist, ward included) and an affordable damaging spell is
  expected to out-hit it (the resist read off `strikeFacts`, so an awakened HEX never
  glances off armour). Damage figures are the expected roll (jitter 1, no crit; RAMP, TWIN and
  SPELL_TWICE included, as the real hit computes them); fates are the least favourable roll.
  Cursor memory: the TOP
  cursor holds between turns (ATTACK at each fight's start); MAGIC keeps the last spell
  across fights; choosing an action returns to TOP.
- **POTION.** `hero.potions` starts at 2 (`POTIONS_MAX`), REST refills, entering a new act
  gives one back; drinking heals
  40 % max HP (`POTION_HEAL`) and uses the turn; at 0, or when it would restore nothing, it
  cannot be chosen (`canDrinkPotion(hero)`, which `canAfford(hero, 'POTION')` uses, so the
  menu and every policy refuse it; review round 3: a full-HP potion healed +0 and was spent).
  "Nothing to restore" is judged on the hero as the turn start leaves him (`atTurnStart`:
  regen, then BLOOD), because `potion()` runs after it: a HOLY GRAIL hero 2 below max HP is
  refused (regen fills him first), a NIGHT SCEPTRE hero at full HP may drink (BLOOD opens
  room). Resolved anyway at full HP, it spends nothing (`YOUR HP IS ALREADY FULL!`).
- **Elements.** `SpellDef.element`: FIREBALL fire, WATER water, THUNDER and TWINBOLT
  thunder, QUAKE earth; LEECH, SLASH, MEND none. `EnemyDef.weak` ×1.5 (`WEAK_MULT`),
  `resists` ×0.5 (`RESIST_MULT`), after resist, on each hit of a multi-hit
  (`HeroActResult.weak` / `resisted`). Weapon attacks carry an element only through
  `IMBUE` gear (M3). Each act's commonest weakness is one the hero can own by then — act 1
  FIRE, act 2 FIRE/WATER, act 3 WATER, act 4 THUNDER; one enemy per biome breaks the
  theme; EARTH is the off-meta answer. `WEAK!` pop and a longer hit-stop on a weak hit.
- **BURN** (the only ailment). `{ perTurn, turns }`: `perTurn` = 40 % of the hit that
  applied it (min 1, `BURN_FRACTION`), `turns` = 3; re-applying keeps the larger
  `perTurn` and resets turns. **A side's BURN ticks after that side's own action resolves**
  (review round 2; before, both ticked at the start of the round, so a potion drunk at 5 HP
  never landed): the hero's at the end of `heroAct` (`HeroActResult.burnTick` / `burnText`;
  skipped when the action killed the foe or the hero; BURST cleanses first, so it never
  ticks), the foe's at the end of `enemyAct` (`EnemyActResult.burnTick` / `burnText`;
  skipped when the hero fell; a staggered foe still ticks). They give no ember, DRAIN never
  heals from them, and they can kill: hero deaths all go through `heroFalls` (REVIVE answers
  a tick, `heroDead` / `revived` on the hero result), a foe killed by its tick ends the
  fight through the normal victory path (`EnemyActResult.enemyDefeated`). The policies
  count their own pending tick (`pendingTick`): HP − tick is what they guard and drink
  by, and a hero the tick would kill BURSTs, drinks or MENDs unless it can kill first. Sources: enemy `SCORCH`,
  hero `BURN_ON_HIT` gear (M3), an event's pending burn. The hero's BURN ends with the
  fight it was gained in: a victory (`grantClear`), REST and `fullHeal` all clear it, so it
  never leaks into the next fight or the save.
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
  the hardest affordable hit. Expected damage goes through weakness, WARD (`resistOf`),
  riposte, the gear multipliers and the pact multipliers (`pactDamage`, as `burstBlow`
  already did). Control policy **`naive`** = balanced without GUARD, BREAK, BURST timing or
  weakness awareness: it bursts the moment the gauge is full (any foe) and drinks potions
  like balanced. `random` picks among every affordable action, verbs included.
  `node sim/run.mjs --no-potions` adds a `noPotions` line (balanced with POTION filtered
  out) and every text run prints the naive/balanced win ratio. The simulator chooses the
  action and plays it through `resolveTurn`, the same function the screen calls, so a
  GUARD turn has no regen. Telemetry per run (`RunResult.verbs`): guards, parries, bursts,
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
  item); at most half offer a do-nothing option. **Every event has a free way out**
  (review round 4): at least one option costs nothing and can never be dim — it is empty
  (WALK ON) or only gains HP, max HP, potions, SP or a full heal (no item roll or upgrade,
  which can run dry). `validateEvents` checks it for `EVENTS` and `QUIET_EVENT`, and a
  rules sweep of 5000 random heroes (full HP, warded, frail, potionless, packless) finds an
  enabled zero-cost option in every event. Before 2026-11-24 A WEARY PILGRIM at full HP
  offered only SHARE A POTION, and THE BLOOD TITHE and THE EMBER SHRINE had no free option
  at all.
- **Permanent max HP** is `Hero.bonusMaxHp`, added to max HP in `derive` (a gain also
  adds the HP; a loss clamps HP). **The burn** is `Hero.pendingBurn` (turns, 0 = none):
  `takePendingBurn(hero, n)` turns it into BURN `round(3 × actMult(n))` per turn for
  3 turns when the next fight (boss included) begins, once, merged into any BURN the hero
  already has by the `applyBurn` rule (larger `perTurn` kept, `mergeBurn`) and set on the
  hero (it also returns the hero's new BURN). **The ward is checked when the price is
  paid**: a BURN-warded hero cannot choose an option with `burnNextFight` (dim, `YOUR WARD
  REFUSES FIRE`), and once pending the burn applies whatever is worn later — wearing a
  ward afterwards does not dodge it. (Before 2026-11-24 a warded hero consumed it for free,
  which let a player pay with a ward swapped in after the event.)
- **Enablement** (`eventOptionBlocker`): `upgradeAny` needs an upgradable target
  (`NOTHING TO UPGRADE`), `dropPackItem` a non-empty pack (`NO SPARE GEAR`), a potion cost
  enough potions (`NO POTIONS`), an HP cost more than 1 HP (`TOO WEAK TO BLEED`), a max-HP
  cost a max above it (`TOO FRAIL`), a burn price a BURN-warded hero (`YOUR WARD REFUSES
  FIRE`), and an option that has a price and whose only gains are heals (`hpPct` > 0,
  `fullHeal`) a hero at full HP (`ALREADY AT FULL HP` — paying for nothing). A free heal
  stays open at full HP and simply heals nothing. The rule is the source of truth for the screen. A dim option
  cannot be chosen.
- **The cancel rule: nothing is paid until the choice is final.** An option whose last
  effect opens a picker (`upgradeAny`, `dropPackItem`) opens it first; B returns to the
  event's two options with nothing applied, and the option's other effects are paid
  when a row is picked. Options ending in `sp` or `item` pay first and then open their
  screen, which cannot be backed out of (LEVEL UP spends, the loot screen's KEEP mends).
  A result card names what changed, then the map.
- **Policies** choose with `eventChoice(hero, event)`: the archetypes score each enabled
  option (HP-rich heroes trade HP, low-HP heroes heal, 1 SP ≈ 6 max HP, never drop the
  only spare), `random` picks an enabled one at random; the routing archetypes rank
  EVENT after LOOT. The run result tallies options taken per event (`events`) — only
  options that were actually applied.
- **Drawing an event** (`pickEvent(rng, hero)`): only events with at least one option the
  hero can take (`eventPlayable(hero, event)`) are drawn, one rng draw over that list; if
  none qualifies a harmless `QUIET_EVENT` (`A QUIET HOLLOW`: +10 % HP or WALK ON) stands
  in. Every event in `EVENTS` is playable by a fresh hero (a rules test), so a softlock
  cannot happen. The game calls it from `screens/event.ts` (`startEvent`).
- **Event items** roll at the named rarity regardless of `minAct` (A CURSED IDOL in act 1
  gives an EPIC, as its preview says); only when every item of that rarity is owned does
  it fall back to a lower rarity, which then respects `minAct`.

| Event | Option A | Option B |
|---|---|---|
| A BLEEDING ALTAR | GIVE BLOOD: −25 % HP, +2 SP | WALK ON |
| A WANDERING SMITH | LEND HIM YOUR STRENGTH: −8 max HP, upgrade any | TRADE A STORY: +1 potion (always open, so a fresh hero is never stuck) |
| A CURSED IDOL | PRY IT OPEN: −10 max HP, an EPIC item | WALK ON |
| A STILL POOL | BATHE: full heal, burn next fight | FILL A FLASK: +1 potion |
| A WEARY PILGRIM | SHARE A POTION: −1 potion, +6 max HP | ASK FOR A BLESSING: +25 % HP (open at full HP, heals nothing then) |
| THE EMBER SHRINE | BURN SPARE GEAR: full heal, +2 potions, give up a pack item | WARM YOUR HANDS: +15 % HP (was GRASP THE COAL: burn, a RARE item — no free option) |
| A FALLEN KNIGHT | GIVE HIM SPARE GEAR: +8 max HP, +1 potion, give up a pack item | WALK ON |
| THE BLOOD TITHE | PAY IN VIGOUR: −12 max HP, +2 SP | REFUSE THE TITHE (was PAY IN BLOOD: −35 % HP, +1 SP — no free option) |
| A WEEPING STATUE | DRINK THE TEARS: +2 potions, burn next fight | CATCH A SINGLE TEAR: +10 % HP (keeps WALK ONs at 4 of 9) |

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
| `BURN_WARD {}` | – | the hero never gains BURN from SCORCH; an event's burn price cannot be paid while it is worn (the option is dim), and a burn already pending applies anyway; its item always carries MDEF (`validateData`) |
| `LOW_HP_POWER {threshold, mult}` | below 40 % ×1.5 (locket), below 50 % ×1.8 (legendary) (+0.15) | ×mult on strikes while HP / max HP < threshold; tag `DESPERATE` |

A strike's power = RAMP × opener × riposte (× `PARRY_POWER`) × PUNISH × LOW HP × ELEMENT
BOOST; weakness/resist and DEF/WARD after. BURST stays outside all of it (BURST_POWER only).

### When two worn items share an effect kind

Six slots can carry the same kind (an awakening often grants a kind its item did not
have), so every kind has one stacking rule; nothing reads "the first slot that has it".
Rules: `game/sim/stack.ts` for the hit-shaping kinds, `power` / `burst` / `hero` /
`status` / `enemy-turn` for the rest. The `stack` rules group equips every cross-slot pair
of carriers of each kind, at every level, and checks a resolved turn: each item alone is
live, the pair is never weaker than either alone, a pair that stacks is stronger than
either, and a pair under "the stronger" plays exactly the stronger one.

| Kind | Two worn | Why |
|---|---|---|
| `SPELL_TWICE` | per spell: each item's spell echoes; the same spell twice echoes once, at the higher `secondHitMult` | a second echo of one spell would be a third hit no item sells |
| `RAMP` | per scope: an ATTACK ramp and a SPELL ramp both work; the same scope merges to the higher `perStack`, the higher `maxStacks`, sticky if either is | one streak counter (`battle.rampStacks`): an action a worn ramp covers adds a stack (capped by that ramp's `maxStacks`, and its bonus reads at most that many); an action no worn ramp covers resets it unless the other scope's ramp is sticky — so with both scopes worn every strike keeps the streak |
| `FIRST_STRIKE`, `TWIN_STRIKE`, `PARRY_POWER`, `BURN_ON_HIT`, `EXECUTE` | the stronger (`mult`, `secondHitMult`, `chance`; EXECUTE the higher bonus among those whose threshold is met) | each shapes the one opening blow, the one extra hit, the one riposte, the one ignite roll |
| `HEX_STRIKE` | worn if any; converts every physical hit if any is awakened | a hit is magic or it is not |
| `DRAIN`, `MP_ON_HIT` | the stronger | a per-hit sustain rate, like the riposte and the ignite chance, and `scaleEffect` already caps one DRAIN at 40 %; summed they put balanced at 41 % (above the 30–40 % band) |
| `PUNISH_WINDUP`, `LOW_HP_POWER`, `ELEMENT_BOOST`, `BURST_GAIN`, `BURST_POWER` | multiply (ELEMENT_BOOST per element) | power multipliers multiply, as pacts' do |
| `GUARD_COUNTER`, `GUARD_MANA`, `CHEAPER_SPELLS`, `BLOOD`, `REFLECT`, `GLASS` | add (REFLECT: the fractions of the items that answer this hit's kind) | flat amounts and prices add, as pacts' counts do |
| `REVIVE` | lives add (a `twice` item holds two), at most 2 in all, at the higher `hpFraction`; spent lives stay spent (`revived`, `revivedTwice`) | see *the pack* |
| `GRANT_SPELL` | every granted spell is known; discounts add | each tome is its own spell |
| `IMBUE`, `BURN_WARD` | IMBUE is weapon-only (`validateData`), so an ATTACK has one element; BURN_WARD is worn or not | – |

Policy scoring (`scoring.ts`) values an item's effect alone and does not model these
pairs; it is a heuristic, not a rule.

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
  `DESCENT_GROWTH` = 1.15 (tuned from 1.08 to 1.20 in M4 — 1.08 let a tank clear depth 5
  in 84 % of its descents — to 1.16 on 2026-11-24, when `ACT_MULT[3]` rose 3.41 → 3.8
  and THE HOLLOW stopped being disarmable, and to 1.15 in review round 2, when `ACT_MULT[3]`
  rose to 4.3: 1.16 left balanced clearing depth 3 in 5 %, 1.14 let a tank clear depth 5). It scales
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
  simulator) and routes `HOLLOW` to `hollowOf(hero, n)`. It is sized off the hero's
  **best loadout**, not what is worn (`armouryOf(hero)`): for each of ATK, MAG, DEF, MDEF
  and max HP, each slot in turn takes whichever owned item (worn or packed, or none)
  raises that stat most — so unequipping a weapon or swapping gear in GEAR before the node
  can never weaken it (before 2026-11-24 a mage who took off ARC ROD met a Hollow ~10×
  weaker). `base` = max(best ATK, best MAG) (no crit, opener, RAMP, TWIN, riposte or
  BURST); its own blows strike **the hero's weaker resist** (MAGIC when best DEF > best
  MDEF, PHYSICAL when MDEF > DEF, else the kind of the stronger stat: ATK → PHYSICAL, MAG
  → MAGIC; review round 2 — the mirror finds the crack in a DEF-stacked tank);
  ATK = `HOLLOW_ATK_SHARE` 0.65 × base × `actMult(n) / ACT_MULT[3]`; resists = the best
  DEF/MDEF capped at `HOLLOW_RES_CAP` 40; HP = `HOLLOW_HP_HITS` 22 × base × (1 − the
  resist the hero's strongest damage faces: MDEF for MAG; DEF for ATK, or the lower of the
  two when the hero owns a HEX_STRIKE item), at least `HOLLOW_HP_FLOOR` 2 × best max HP;
  at most 3 affixes read off the worn gear in order (DRAIN →
  VAMPIRIC, REFLECT → THORNED, dodge ≥ 15 → SWIFT, BURN_ON_HIT → SEARING; HEX adds none);
  the definition's fixed cycle `STRIKE STRIKE WINDUP HEAVY`; no weakness or resist; IRON
  raises its ATK like any foe's. Drawn as the hero's sprite, mirrored, in one dark tint.
  **Its STRIKE is clamped**: ATK = clamp(`HOLLOW_ATK_SHARE` × base, `HOLLOW_HIT_FLOOR` 0.12,
  `HOLLOW_HIT_CAP` 0.15 × best max HP ÷ (1 − the hero's best resist to its kind)) ×
  `actMult(n) / ACT_MULT[3]` (the floor, review round 2, keeps a low-ATK, high-HP build from
  meeting a harmless mirror), so at depth 2 a STRIKE lands ~19–23 % of the hero's max HP (a
  HEAVY ~40–46 %); deeper it
  grows with `actMult`. Without the cap a glass mage (MAG ~180, max HP ~230) met a Hollow
  hitting 55 % of its HP per STRIKE and balanced cleared depth 2 in 8 % of descents.
  Tuning history: the contract's 0.5 / 8 died in two turns; M4 used 0.7 / 30 (sized off
  the worn weapon's stat, which most balanced mages — holding a physical weapon — dodged);
  since 2026-11-24 `HOLLOW_ATK_SHARE` 0.65, `HOLLOW_HP_HITS` 22, `HOLLOW_HIT_CAP` 0.15.
- **Affixes** (`AffixId`, `EnemyInstance.affixes`, `MapNode.affixes`; depth ≥ 2 only;
  normals `depth − 2`, elites and bosses `depth − 1`, max 3, no repeats on one foe —
  `affixCountFor(depth)`):

  | Affix | Effect | State |
  |---|---|---|
  | ARMORED | +20 DEF (`resPhys`) | applied by `spawnEnemy` |
  | WARDED | +20 MDEF (`resMagic`) | applied by `spawnEnemy` |
  | VAMPIRIC | heals 30 % of the damage its hits deal, capped at max HP (`EnemyActResult.healed`) | `enemy-turn` |
  | THORNED | returns 15 % of the damage it takes from ATTACK, spells and BURST, at most 12 % of the hero's max HP per action (`AFFIX_THORNS`, `AFFIX_THORNS_CAP`); never on the killing blow; it can kill through `heroFalls` (REVIVE answers): `HeroActResult.thorns / revived / heroDead`, and its own log line `HeroActResult.thornsText` (`THORNS BITE YOU FOR n`, `THE THORNS TAKE YOU! (n)`, `THE THORNS FELL YOU (n) - YOU RISE!`) — the damage line is never cut to make room (review round 3) | `combat` |
  | SWIFT | 15 % to evade ATTACK and damaging spells, rolled on the injected rng (`IT SLIPS AWAY!`, `HeroActResult.missed`); the spell's MP is spent, no ember, RAMP still advances, a held riposte is kept for the next damaging action; BURST never misses | `combat` |
  | SEARING | its STRIKEs apply BURN (SCORCH already does) | `enemy-turn` |

  Tuned: THORNED was 20 % uncapped; it then caused 36–42 % of all descent deaths (a
  descent turn deals ~330, so 66 came back). **A depth's affix set**: each act draws only
  from its **affix pool**, `affixPool(plan)` = the first `max(normal, elite) + room` entries of
  its `affixOrder` (room = the most foe affixes all pacts together can add, at least 1 —
  today HEX's 1; empty when both counts are 0); the depth's announced set is the union of its
  acts' pools (`depthAffixes(plans)`), which the PACT screen lists. Rolling: `generateMap`
  scouts FIGHT nodes with `affixCount.normal` and ELITE nodes with `affixCount.elite` affixes
  drawn without repeats from the act's pool (`rollAffixes(pool, count, rng)`; no draw when
  the count is 0, so depth 1 maps are unchanged) — game and simulator share this one path.
  The spawn top-up below takes `affixOrder` in order, so it never leaves the pool either (the
  `affixes` rules group checks every scouted and spawned foe of 2400 depths, HEX on half).
  THE HOLLOW is the exception: it wears the affixes of the hero's gear.
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
  and the pity counter is untouched; `extraCard` every chest, elite and boss loot screen (never FIGHT), `eliteExtraCard` ELITE
  (offers stay capped at 4 — a card the cap swallows becomes +1 SP in `grantClear`, see
  below); `restHealMult` and `restUpgrade` in `restHero(hero)`
  (`game/sim/rest.ts`: heals `restHealMult` of max HP and MP — full without pacts — and
  refills potions; with ASH it returns `upgrade: true` when something can be upgraded,
  the caller then offers one `UPGRADE_ANY` pick, else it mends `REST_MEND` 25 % and
  returns `mended`). The game's REST and the simulator's both call it.
- **Swearing a pact** (`takePact`, in `game/sim/hero.ts`): a max-HP pact changes HP with
  it — IRON's +15 % max HP also adds that HP, BRITTLE's −20 % clamps HP to the new max
  (`clampVitals(hero, 1)`).
- **The card cap never eats a boon silently.** `lootCards(source, mods)` is what a screen
  should show (`LOOT_COUNT` + MISER's card on chests, elites and bosses + HUNTER's elite
  card); a screen shows at most 4 (`LOOT_OFFERS_MAX`). Every card past 4 becomes +1 SP,
  granted by `grantClear` (`swallowedCards`) — today only MISER + HUNTER at an ELITE (3 + 1
  + 1). MISER never adds a card to FIGHT (its curse already stops FIGHT drops).

  | Pact | Curse | Boon | Mods |
  |---|---|---|---|
  | BRITTLE | −20 % max HP | +25 % damage dealt | maxHpMult 0.8, dmgMult 1.25 |
  | TITHE | clear heal 25 % → 10 % | +1 SP per clear | clearHealMult 0.4, spPerClear 1 |
  | HEX | elites and bosses +1 affix | elite and boss loot one rarity higher | foeAffix 1, rarityShift 1 |
  | IRON | foes +15 % ATK | +15 % max HP, +1 SP per boss | foeAtkMult 1.15, maxHpMult 1.15, spPerBoss 1 |
  | MISER | FIGHT rooms never drop | chests, elites and bosses +1 card | fightDrops 0, extraCard 1 (not on FIGHT) |
  | STORM | ATTACK deals −15 % | BURST gauge fills ×1.5 | attackMult 0.85, burstGainMult 1.5 |
  | ASH | REST heals 50 % | every REST also gives an UPGRADE card (a 25 % mend if none) | restHealMult 0.5, restUpgrade 1 |
  | HUNTER | elites +30 % HP | elites +2 SP and a 4th card | eliteHpMult 1.3, eliteSp 2, eliteExtraCard 1 |

- **Loot in the descent** (`game/sim/descent-loot.ts`, `lootWeights(source, n)`): the
  act-4 row with +3 LEGENDARY per depth below 1 taken from COMMON, then RARE, never below
  0, LEGENDARY capped at 30 (`descentRow`); `minAct` is always met. Boss tables in the
  descent: three cards (MISER: four), a missed scroll first if any and taking one of them
  (no plan scroll, no fixed signature), the rest rolled items from the BOSS row with COMMON and RARE weight moved onto EPIC — **EPIC 70 /
  LEGENDARY 30 at every depth** (the +3-per-depth LEGENDARY step applies to the other
  sources' rows, never to descent boss loot) — signature items not owned in the pool.
  Nothing is rolled beyond the card count (before the PR-11 review a missed scroll came on
  top of three rolled items, and under MISER a fifth was rolled and thrown away).
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
  below depth 1. A death's best is stored the moment the fatal turn is committed
  (`keepDeathBest`: `scoreAfterDeath` against the stored best, the same value GAME OVER
  stores again), so closing the page during the death animation keeps it. Abandoning
  during a turn's animation first adopts the committed turn, so the score GAME OVER reports
  is the one the host already heard.
- **THRESHOLD presentation**: no row is lit until Up or Down (see *Arming and input*) and A is ignored for the first
  1.0 s (the headline types itself in; both choices are drawn faint until then), so a
  player mashing through the VICTORY, LEVEL UP and loot screens cannot confirm either way
  by accident; DESCEND is an explicit Down + A. PACT arms after 0.5 s the same way and also
  opens with no row lit. The
  depth card after the pact reads `DEPTH n` / `<BIOME> AWAITS...` / `SWORN TO <PACT>`.
  A plain act change reads `<BIOME> AWAITS...` / `THE ROAD GOES ON` in depth 1 ("the descent"
  names the post-Seraph mode on the title) and `THE DESCENT CONTINUES` from depth 2 on.
- **Simulator**: `simulateRun(policy, rng, { descend })`; `descend` is off by default, so
  `npm run sim` still ends at the Seraph (its `--json` was byte-identical across the
  foundation step). With it on, runs descend until death or n = `SIM_MAX_N` (= `RUN_MAX_N`, 400), taking a
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
  (or `BURNED DOWN FIGHTING` / `BLED OUT FIGHTING`) then the two log lines in the order they happened and
  `ITS <MOVE> DEALT n` (`… THROUGH YOUR GUARD` when the killing blow was guarded); the worn gear with levels packed onto at most two lines; `PACTS …`; and
  `NEXT TIME: <tip>`. A WIN swaps the killer for `GLORY +n   BOSSES FELLED n` and ends
  with an invitation (`THE DESCENT WAITS FOR YOUR NEXT RUN` after a depth-1 ascent,
  `DEPTH n+1 WAITS …` deeper). Nine rows at most; log lines go first when it overflows.
- **NEXT TIME** comes from a table keyed, in priority order, by THE HOLLOW; then the
  situation of the fatal fight (`game/screens/ending-tips.ts`): a guarded blow still
  killed, a boss whose weakness the hero had no answer for, a full ember never burst, an
  affordable weak spell never cast, a HEAVY BLOW death with GUARD never used, no potions
  left, no MP for any spell; then the cause (BURN, THORNS, BLOOD), the move (HEAVY BLOW,
  SCORCH, HEX), an elite killer, else STRIKE (`ABANDONED` has its own). Each key holds two to four concrete tips of at most
  44 characters; the one shown is picked by a hash of the run (score, clears, act,
  damage, SP), so it is stable on screen and varies between deaths.
- The event's one-card item screen titles itself `A GIFT  TAKE IT OR LEAVE IT`
  (`LootScreen.gift`), not the chest's line.
- `node sim/run.mjs --events` prints, per policy, each event's plays per run and its
  option split (also in `--json` as `events`); `--help` lists every flag.

## v3 — save, resume and pause (M5)

- **What is saved**: one run in `localStorage` under `retrovibe.ember-quest.run.v1` as
  versioned plain JSON (`SavedRun`, `game/sim/save.ts`, headless; readers in
  `save-read.ts` / `save-map.ts` / `save-battle.ts`, sanity checks in `save-sanity.ts`):
  the hero with items as ids + levels (worn and packed), alloc, SP, HP/MP, potions, ember,
  burn and pending burn, bonus max HP, spells, missed scrolls, revive flags, dry fights,
  pacts; the run counters (`n`, clears, bosses, the frozen descent clears, score, banked,
  `won`); the depth plan (all four `ActPlan`s); the map (rooms with type, links, cleared,
  enemy id, affixes; current stage, reachable, cursor); the seeded rng state; and a
  **step**:
  - `MAP`;
  - `ROOM` (stage, slot) — optionally with `roomSeed` and either `eventId` (an EVENT room
    whose event is already drawn) or `battle` (a fight in progress: `roomSeed`, the foe —
    its id plus every instance field: hp, maxHp, atk, resPhys/resMagic, affixes, burn,
    wardTurns, phase, phaseAt, cycleIndex, mended, staggered — and the `BattleState`
    without the foe: rampStacks, lastScope, actionsTaken, intent, guarding, guardChain,
    riposte, aegis, calm, foeMark, turn);
  - `REWARD` (stage, slot, `roomSeed`, `source` FIGHT / ELITE / BOSS / EVENT, `earned` —
    the SP the room granted, so a resumed LEVEL UP shows `+n EARNED` — and for an event item
    the `gift` rarity);
  - `THRESHOLD`, or `PACT` (with the offers already drawn).
  Items, foes, spells and pacts are rebuilt from the content tables by id; a foe is
  re-spawned by id (`spawnFoe`, which also rebuilds THE HOLLOW off the hero) and then
  takes every saved instance field.
- **When** (presentation: `game/persist.ts`): whenever the map is shown (a room resolved,
  an act or depth entered — the map is generated *before* the `… AWAITS` card), **just
  before a room's handler runs** (`selectNode`: the hero as on the map, the entered room,
  the rng state of that instant), when a fight opens (battle start, after the boss entry
  heal and the event burn), **the instant the player confirms an action** (see *A chosen
  action is final* below), the instant the rules report the foe dead (`REWARD` with the SP
  `earned`) and again when the loot screen opens (the hero with the SP spent), **the
  instant a loot / upgrade / scroll / keep / ASH / gift result is applied — before its
  result card shows** (the room is settled and `MAP` saved; after a boss, `THRESHOLD` is
  saved, or the next act is entered and its `MAP` saved, so the `EQUIPPED` card can no
  longer be reloaded away), when an event is drawn (`ROOM` + `eventId`), when an event's
  costs are paid (`REWARD` EVENT for an option that opens LEVEL UP — `earned` = the SP it
  gives — or the gift screen, otherwise the room is settled and `MAP` saved at once), **on
  every GEAR swap or take-off**, when THRESHOLD opens and when PACT opens. **The save is
  deleted the instant the rules report the hero dead** — for a fight that is the moment
  the action is confirmed, before any animation — and on entering GAME_OVER or WIN.
- **A chosen action is final.** On A in the battle menu the whole turn is resolved at once
  by the rules (`resolveTurn`: turn start → hero action → the hero's BURN tick → the foe's
  action → its BURN tick, each side on its own per-turn rng stream derived from the room
  seed and the turn number) on a shadow copy of the hero, the foe and the battle state
  (`game/screens/battle-commit.ts`); the result is saved (the next turn's `ROOM` battle,
  `REWARD` on a kill, nothing on a death) and the live state is put back, then the
  choreography replays the same rule calls on the same streams beat by beat (so every
  intent lean, tag and meter still reads the live state) and adopts the shadow copy when
  the turn ends, the foe falls or the hero dies (a drift — hero HP, MP, potions, ember and
  BURN, foe HP, stagger and BURN differing from the shadow — is reported through
  `reportError` on every outcome, and counted: the dev hook's state carries `drift` when it
  is non-zero and `npm run look` fails on it). Reloading
  mid-animation therefore lands on the next turn's menu, on the reward, or on a title
  without CONTINUE; reloading a turn and choosing another action meets the same foe roll.
- **Rewards depend on the room, not on the fight.** `selectNode` draws one 32-bit
  `roomSeed` from the run rng (after the `ROOM` save, so a replayed room draws the same
  one). A fight's turns draw from per-turn streams of `roomSeed` (see *One whole turn*), never
the run rng; the moment the foe dies the rng is re-seeded to
  `roomSeed ^ 0x5bd1e995` and only then are the clear (SP, score) and the loot rolled, so
  two different fights of one room give the same SP and the same offers. Chest, rest and
  event rooms replay identically from the `ROOM` save as before.
- **Resume**: the title band becomes `CONTINUE  DEPTH n ACT n  BIOME` / `NEW RUN`;
  NEW RUN over a save asks `ERASE YOUR RUN?  > NO   YES` (see *Confirmations*). CONTINUE
  first re-reads storage (see *More than one tab*), then restores
  everything and the rng state and re-enters the step: the map; a `ROOM` with a
  `battle` re-enters that fight at that hero turn (no entrance replay, the log reads `THE
  FIGHT WITH <FOE> GOES ON`); a `ROOM` with an `eventId` reopens that event; a plain
  `ROOM` replays the room from the saved rng state (same foe, same chest, same rest; the
  boss entry heal is applied once because the save holds the hero from before it); a
  `REWARD` opens LEVEL UP while SP is unspent (`+n EARNED` shows the step's `earned`, not
  the whole pool), then the same loot offers (FIGHT / ELITE / BOSS; a boss then continues
  to its act card or THRESHOLD — the boss's loot and result card are drawn over the act it
  was won in, the next act's scenery appearing with its act card), or for an EVENT the same gift; THRESHOLD; or PACT with
  the same offers. **Reloading cannot reroll a room, a drop, an event or a pact, cannot
  undo a paid event cost, a taken offer, a GEAR swap or a chosen battle action, and cannot
  undo a death.** **Accepted**: reloading on a result card lands on the map, the next act
  or THRESHOLD (the card is skipped); reloading on the loot screen lets the player choose
  among the same offers again.
- **More than one tab.** Next to the run the storage keeps a stamp
  (`retrovibe.ember-quest.run.stamp`: a random run id + a write counter that every save
  increments). A tab remembers the stamp it loaded or last wrote. Before every write it
  re-reads the stamp; if the stored one is missing or differs (another tab wrote, ended or
  deleted the run), the tab stops saving for the rest of that run (`g.saveLost`; the map
  shows `ANOTHER TAB TOOK THIS RUN - THIS ONE NO LONGER SAVES` in orange) and never
  deletes the save on its own death or abandon. A new run from the title claims the slot
  outright (behind the title's `ERASE YOUR RUN?` confirm when a save is offered). TRY AGAIN /
  PLAY AGAIN never overwrites a live save silently: this tab's own save is already gone at
  GAME OVER / WIN, so a save still stored then is another tab's, and A goes to the title
  instead (CONTINUE that run, or NEW RUN through the confirm). A failed write (quota) puts
  the previous stamp back, so it is never read as another tab taking over. The
  title listens to the `storage` event and refreshes or drops CONTINUE; CONTINUE itself
  re-reads storage and refuses a save that is gone or whose stamp moved
  (`THAT RUN HAS ENDED` in orange under the hook lines for 2.5 s, then the title offers
  whatever save is stored now). A tab that is playing marks itself lost as soon as the
  `storage` event shows another tab's write.
- **Version policy**: `version` is 3 (2 had no `calm` / `foeMark` / `turn` in a battle and
  no `earned` on REWARD; 1 had no battle, reward or event fields). An `eventId` is any id in
  `EVENTS` or `QUIET_EVENT` (`eventById`; before, a QUIET save was rejected and the run lost). A save with
  another version, malformed JSON, an unknown item / foe / spell / pact / event id, a level
  past the item's cap, an out-of-range or non-finite number, a map whose links or step
  point outside it, or a depth plan without four acts is rejected by `loadRun` (which
  never throws) and dropped silently: the title shows no CONTINUE. A change to the saved
  shape bumps the version; old saves are dropped, never migrated. After reading,
  `saneSave` (`game/sim/save-sanity.ts`) also rejects: `n` past `RUN_MAX_N` (400, depth 101 —
  raised from 40 on 2026-11-24, which would have dropped CONTINUE for an endless run past
  depth 11; foes grow ×1.15 per act, so n = 400 means foes ×5e24, unreachable in practice:
  the deepest simulated run reaches n ≈ 15. A rules test spawns every planned foe and THE
  HOLLOW at n = 397 and 400 and round-trips a mid-battle save there; the battle readers
  bound damage-scaled numbers — foe HP/ATK/burn, `foeMark`, the hero's burn — at 1e60
  (`SCALED` in `save-check.ts`; legitimate play at n = 400 peaks near 1e28, while a
  hand-edited 1e308 printed `9.69e+307` and overflowed to Infinity/NaN downstream — review
  round 5; a rules test rejects 1e308 in each of those six fields). Past the cap the game plays on but a save is refused, so CONTINUE
  would be lost; the threshold does not stop the descent); more
  bosses than acts or clears; `won` / `descentClears` disagreeing with `n` (descended ⇔
  n ≥ 4); `banked` above the score; a dead hero (HP ≤ 0); the same item id owned twice; a
  pack over `PACK_SIZE`; an empty normal or elite pool; a map cursor not among the
  reachable rooms; a ROOM / REWARD step at a room that is not on the next stage or not
  reachable, or a ROOM step at a cleared room (a BOSS room is marked cleared on entry, so
  it is allowed); THRESHOLD except at the last act of a depth; PACT except at act 1 of
  depth ≥ 2, or with offers that repeat or were already sworn. It **repairs** rather than
  rejects: HP / MP above the derived max are clamped to it, and the score is recomputed as
  `scoreOf(clears, bosses)` (glory is only ever added on ASCEND, which ends the run and
  deletes the save).
- **Only a real run touches storage**: with `?seed`, `?scene` or `&hold` (hold alone now
  seeds the hook's rng with 1) the hook owns the rng (`g.rngFromHook`) and saving,
  loading, deleting and the best score are all skipped (`realRun` in `game/persist.ts`).
- **Pause**: Up/Down over `RESUME` / `ABANDON RUN`, A to choose; ABANDON asks
  `REALLY ABANDON?  > NO   YES` (see *Confirmations*); PAUSE still resumes at
  once. Abandoning sets `g.abandoned` and goes PAUSED → GAME_OVER directly (the scene
  machine allows it), is reported to the host as an ordinary game over (the unbanked-half
  rule applies), and deletes the save (when this tab still owns it). The overlay keeps
  listing the pacts. PAUSE is ignored while the hero falls (`g.dying`).
- **Confirmations** (ERASE YOUR RUN, REALLY ABANDON): one row `QUESTION  > NO   YES` on the
  purple bar with `ARROWS PICK  SPACE CONFIRM  X NO` under it. The highlight starts on NO;
  any arrow toggles it; A takes the highlighted answer; B is always NO. Pressing the same
  key twice can no longer confirm.
- **ASH in the game**: REST calls `restHero`; the card reads `REST HEALS 50%`, the HP / MP
  restored (zero gains are left out: `+12 HP  POTIONS FULL`), and either `THE ASHES OFFER
  AN UPGRADE` (A opens `UPGRADE WHICH?` through the loot chooser with a single
  UPGRADE_ANY; B backs out to that one-card screen, titled `THE ASHES  UPGRADE OR LEAVE`,
  whose last row is `LEAVE THE ASHES` — no mend, the rest already healed) or `NOTHING TO
  UPGRADE  +n HP`. A plain REST that restores nothing reads `ALREADY AT FULL STRENGTH` /
  `POTIONS FULL`.
- **Event safety**: an event whose options are all blocked never opens — the rules do not
  draw it (`pickEvent(rng, hero)`), and if one opens anyway (an old save, a rules bug) the
  screen reports it through `reportError` and leaves the room as if walked on.

## Arming and input (presentation rules)

- **A is armed per screen.** LEVEL UP, the loot screen (and the event gift), PICK, the
  event screen, every card, **the MAP, GEAR, THRESHOLD, PACT and the title menu** ignore A
  until it is a fresh press: A must be up at some point after the screen opened (`armA`
  records whether it is already up) and the press must land on a later tick (`armA` /
  `takeA` in `game/state.ts`), so an A held through a battle's last beat or a card cannot
  spend SP, take an offer, skip a card or walk into the next room. The title's confirm
  re-arms when it opens.
- **Permanent choices wait for a readable beat.** On the screens whose choice cannot be
  taken back — LEVEL UP, the loot screen and the event gift, PICK (UPGRADE / DROP / GIVE UP
  WHICH?), the EVENT screen and GEAR — `armDecision` (`game/transition.ts`) arms A with a
  hold of the screen reveal (0.16 s wipe) plus `DECIDE_BEAT` (0.15 s, `game/state.ts`): A is
  ignored until the reveal has finished and that beat has passed, and the screen's A prompt
  is drawn faint (`C_FAINT`, `decisionPromptColor` / `decisionReady`) until then, so the wait
  never looks like a dropped press. Directions work at once. Plain continue cards and the
  MAP keep acting on the first fresh press (one press = one action, no dwell). THRESHOLD
  (1.0 s) and PACT (0.5 s) keep their own longer waits (`armed`), and GAME OVER and WIN
  (1.0 s, prompt faint until then) are armed by time. PAUSED reads plain presses (the
  clock is frozen there). (Chosen so that mashing A through a boss's VICTORY can no longer
  descend, seal a pact, take loot and pick an upgrade target inside a second: the mash now
  stalls on PACT, which has no preselected row.)
- **The battle menu** is armed when a battle opens, when the entrance banner is skipped and
  after every turn's queue, so the A that skipped a turn's animation (or was buffered during
  a hit-stop) never chooses the next command; the next fresh press does, from the first
  frame the menu is drawn. After a turn the cursor leaves POTION and BURST for ATTACK (both
  are one-off verbs), and when it was left on MAGIC A also waits one `DECIDE_BEAT`, so a
  masher repeats ATTACK at worst and never drinks or bursts by accident. A during the
  ELITE / BOSS banner skips the banner (as A skips to the next impact in a turn);
  directions are not read until it is gone.
- **THRESHOLD has no default.** It opens with neither row lit and the detail column reading
  `TWO PATHS - NO TURNING BACK` / `ASCEND ENDS THE RUN` / `DESCEND GOES DEEPER` /
  `UP/DOWN TO CHOOSE`; Up lights ASCEND, Down lights DESCEND (the cursor clamps: Down,Down
  stays on DESCEND, Up,Up on ASCEND), and only then does an armed A choose. An A that
  cannot choose yet blips and turns the prompt line into a blinking `CHOOSE: UP / DOWN` for
  1.2 s. PACT works the same way: no pact is lit until Up or Down (either lights the top row), A
  before that blips and nudges, and the detail column reads `A PACT BINDS YOU FOR GOOD` /
  `EACH HAS A CURSE AND A BOON` / `UP/DOWN TO CHOOSE`; its rows clamp too. (Chosen over a second `END THE RUN HERE?` confirm: one deliberate direction
  press is enough to stop a masher, and both paths are treated alike.)
- **Grids** (the battle commands and the spell list, 2 columns): Left/Right step through
  the list in reading order (Right from the right column goes to the next row's left cell,
  wrapping from the last item to the first, across spell pages); Up/Down move within the
  column and wrap from the bottom row to the top (in a spell list with more pages,
  Up/Down past the edge turns the page).
- **The kill always plays.** A pressed while the foe is dying fires its defeat cues at
  once (dissolve, `+100`, `… DEFEATED!`) and shortens the hold to 0.5 s; it never skips
  them.
- **Quick taps count.** The engine latches direction presses like button presses
  (`input.pressedDir()`), so a key pressed and released between two ticks still moves a
  cursor; `dirEdge` / `dirEdgeX` read the latch first and the held edge second.
- **Capped stats** show `MAX` on LEVEL UP and refuse the point with a blip (the screen
  checks that one more point would change nothing).

## Combat

See *v3 — battle verbs (M2)* above for moves, intents, GUARD, POTION, elements, BURN,
BURST and BREAK; the lines below are the base turn they build on.

- Hero turn: regen (chalice/necklace) → BLOOD tick → action → the hero's BURN tick (the
  foe's ticks after its own action; see *One whole turn*). ATTACK is free,
  scales off ATK (or MAG for a magic weapon), deals `weaponKind` damage.
  Spells per `SPELLS`. Crit: `crit %` chance, `x critMult`.
- Enemy resists (the instance's `resPhys`/`resMagic`, plus WARD) blunt the matching damage kind — HEX_STRIKE turns physical
  attacks into magic damage, so a physical build can beat a plated foe.
- Enemy turn: phase check → the shown move; for a hit: dodge check → damage × move mult
  × (1 − DEF/MDEF) × guard → REFLECT → `heroFalls` (REVIVE).
- Enemies scale `(base + perClear × clears) × actMult(n) × def.mult`; `ACT_MULT` [1.3, 1.8, 3.05, 4.3] for n ≤ 3 (see *the endless descent*); in the descent `clears` is the frozen `descentClears`.
- The hero's death wins a tie (see *Who wins a tie* above).

## Difficulty targets (balance sim, sane policy)

Story run, `balanced`: act 1 clear ≥ 80 %, act 2 ≈ 65 %, act 3 ≈ 50 %, full run 30–40 %.
`random` < 8 %. `glass` and `tank` ≥ 18 %. **The game teaches before it punishes**: the
`naive` control (no GUARD, BREAK, BURST timing or weakness — the closest policy to a
first-time player) wins ≥ 15 % and ≤ 75 % of balanced's rate, and reaches act 3 in
≥ 40 % of runs. Bosses: `balanced` kills the act-1 boss in ≈ 6–8 turns and the act-4 boss in
≤ 12; **for every sane archetype (balanced, naive, glass, tank, the routing pair) the median
boss fight is ≤ 12 turns and the p90 ≤ 16 at acts 3 and 4** — a boss is decided by play,
not attrition; a p25 build (damage per turn) still makes net progress ≥ 6 % of the boss's HP
per turn; one boss HEAVY ≤ ~60 % of a balanced hero's max HP at that boss; no ordinary act-N+1
normal out-HPs the act-N boss by more than ~10 %; a first-fight HEAVY takes ~25–30 % of a
fresh hero's HP. Descent, `balanced`, of runs that beat the Seraph: ≈ 40 % (± 15) clear
depth 2, ≈ 10 % depth 3, none clears depth 5 in 2000 runs; no pact's win-through wildly
off the others. No STALL deaths. Late-game
power comes from routing (elites for loot), focused points, and item synergy —
not from stat inflation alone.

## UI constraints (text overlap)

Logical screen 240×160, font 4 px per char at scale 1. Battle log line
<= 52 chars, or it wraps to two lines. Battle verbs: the plate's intent text <= 10 chars
(`HEAVY BLOW`, `STAGGERED` 9), the band's intent hint <= 52 chars (`HEAVY BLOW NEXT (~n): GUARD, OR BREAK IT` is 42 with a 4-digit n), a phase banner
<= 20 chars (scale 2 beside its tag), a menu preview line <= 82 px (21 chars), a spell
cell `NAME` + `nMP` inside 68 px, a tag strip inside its plate's 96 px (tags that do not
fit are dropped, lowest priority last: enemy WEAK, WARD, BURN, RES, affixes; hero BURN,
RIPOSTE, GUARD, RAMP, `BURST READY`). Item names <= 13 chars, enemy names
<= 12, spell names <= 9. Every panel is placed with `SAFE_MARGIN`; the loot
and level-up panels sit beside the hero, never over him.
Compare card: `displayName` (<= 16 chars) `>` name, `ATTACK NOW USES MAG` beside them;
six cells of <= 18 chars (74 px columns); `LOSE:` / `GAIN:` lines <= 36 chars (blurbs
<= 30). A loot offer's hint <= 64 px (the worn item's `displayName`). GEAR rows <= 92 px
of name; PICK rows `NAME +n→+n+1` <= 84 px (the arrow is a 4-px glyph) beside a <= 4-char note (`WORN`, `PACK`,
`NEW`, `OLD`); PICK titles <= 30 chars; PICK detail <= 3 lines. The map readout
`ELITE  NAME  HEXES  WEAK FIRE  AFFIX +n` stays inside 224 px (the verb, then the affix are dropped first when it does
not); the map header `DEPTH n  ACT n  BIOME` <= 30 chars. Descent screens: THRESHOLD
headline <= 22 chars at scale 2, its detail lines <= 134 px (33 chars) beside the 82-px
label column; PACT names <= 12 chars (58-px column), `CURSE: ` / `BOON: ` + line <= 158 px
(pact lines <= 30 chars); the PACT sky card's affix line wraps to at most two lines of
<= 180 px, and the PACT screen lists each of those affixes (`depthAffixes`) under the sky card (x 122, 8-px
pitch, name orange, blurb white, blurb <= 16 chars: `THORNED  HURTS ATTACKERS`). A foe
with one affix shows it in the enemy tag strip (the short label — `VAMP`, `ARMOR`,
`THORN`, `SEAR` — when the word does not fit); a foe with two or more gets its own affix
row 9 px under the strip, all names at once (full, else short labels, else one cycling every
1.6 s plus `+n`), so no affix is ever hidden; affix ids <= 8 chars.
The ending summary `DEPTH n  n CLEARED  SCORE n  BEST n` <= 180 px. Pause lists the
pacts joined with ` / ` on lines <= 172 px.

## Balance state (measured with the headless simulator, 2026-11-24)

The one current table: `node sim/run.mjs` (2000 runs per policy, seed 1), on the tree after
the owner's PR-11 review (worn effects of one kind now stack by the table in *When two worn
items share an effect kind*, and a descent boss table's missed scroll takes one of its
cards). Every balance number in this file comes from this one run. Harness:
`sim/run.mjs` bundles `game/sim.ts` with esbuild (`sim/bundle.mjs`) and plays `simulateRun`
with each of `POLICIES` on a seeded PRNG (`--runs`, `--seed`, `--policy`, `--json`,
`--story`, `--descent-only`, `--items`, `--events`, `--no-potions`); same seed and code give
byte-identical `--json`. It plays the game's own map generator and turn function
(`resolveTurn`); `sim/descent-report.mjs` and `sim/items-report.mjs` hold the extra
sections.

| policy | win | reach act 2 / 3 / 4 | boss clears a1/a2/a3/a4 | boss turns med/p90 a3, a4 (> 16) | top killers |
|---|---|---|---|---|---|
| balanced | 39 % | 98 / 92 / 68 % | 99/98/89/74 | 6/11 (1 %), 8/12 (2 %) | SERAPH 275, MUMMY 255, PALADIN 233, SAND GOLEM 171 |
| naive (no verbs) | 16 % | 90 / 65 / 39 % | 91/81/76/60 | 6/10 (1 %), 7/12 (2 %) | YETI 297, MUMMY 261, SAND GOLEM 246, PALADIN 229 |
| glass (all offence) | 18 % | 99 / 85 / 46 % | 100/96/74/61 | 4/7 (0 %), 6/8 (0 %) | MUMMY 343, SAND GOLEM 323, PALADIN 246, SERAPH 230 |
| tank (HP/DEF, physical) | 38 % | 99 / 89 / 57 % | 99/95/80/83 | 11/16 (7 %), 10/16 (9 %) | MUMMY 299, SAND GOLEM 295, PALADIN 215, SERAPH 152 |
| elite-hungry routing | 39 % | 99 / 92 / 68 % | 99/98/88/73 | 6/11 (1 %), 7/12 (2 %) | SERAPH 281, MUMMY 254, PALADIN 229, SAND GOLEM 181 |
| chest-hungry routing | 32 % | 96 / 89 / 63 % | 98/97/84/66 | 7/12 (1 %), 9/13 (4 %) | SERAPH 331, SAND GOLEM 235, ORACLE 134, MUMMY 122 |
| random picks + points | 0 % | 19 / 1 / 0 % | 29/15/0/– | – | DARK LORD 923, SKELETON 319 |

naive/balanced = **0.40**. 0 STALL deaths. Balanced per run: GUARD 5.3 (PARRY 5.5), BURST
5.1, POTION 2.9, BREAK succeeded/attempted 0.39/0.68 normals, 0.94/1.42 elites, 1.87/2.46
bosses, phase 2 reached 3.2 times. Boss HP at spawn 164 / 334 / 668 / 1283; balanced's
phase-2 HEAVY 30 / 39 / 61 / 64 % of max HP (glass 91 / 82 % at the Golem / Seraph); the p25
build nets ≥ 7 % of the boss's HP per turn at every boss (tank 48 / 667 at the Golem).

Descent (same run; shares of the runs that beat the Seraph, deaths of the descenders who
died below depth 1; THORNS = killed by THORNED backlash):

| policy | beat Seraph | clear d2 | d3 | d4 | d5 | final n mean / median | deaths ELITE / BOSS / HOLLOW / THORNS / NORMAL |
|---|---|---|---|---|---|---|---|
| balanced | 779 | 36 % | 7 % | 0 % | 0 | 7.3 / 7 | 44 / 14 / 33 / 7 / 2 % |
| naive | 326 | 18 % | 3 % | 0 % | 0 | 6.0 / 5 | 52 / 22 / 22 / 3 / 1 % |
| glass | 356 | 31 % | 5 % | 0.3 % | 0 | 6.7 / 6 | 50 / 19 / 24 / 4 / 3 % |
| tank | 716 | 57 % | 23 % | 2 % | 0 | 8.9 / 9 | 28 / 22 / 37 / 12 / 1 % |
| elite-hungry | 790 | 35 % | 7 % | 0.3 % | 0 | 7.1 / 7 | 48 / 16 / 29 / 5 / 2 % |
| chest-hungry | 625 | 48 % | 8 % | 0.3 % | 0 | 8.0 / 7 | 21 / 29 / 40 / 4 / 5 % |

THE HOLLOW is the top descent killer for every policy (balanced: HOLLOW 282, FROST WISP 140,
MUMMY 101, PALADIN 63). Affix on the killer (balanced): SWIFT 53 %, THORNED 37 %, VAMPIRIC
26 %, SEARING 17 %, WARDED 16 %, ARMORED 8 %. Pact win-through pooled over the non-random
policies: ASH 43, TITHE 37, MISER 34, BRITTLE 32, IRON 32, HUNTER 31, STORM 25, HEX 23 %.

Against the previous table (review round 5) the stacking rules moved balanced 39 → 39 %
(41 % with DRAIN and MP_ON_HIT summed instead of taking the stronger, which is why they take
the stronger), tank 35 → 38 %, naive and glass unchanged at 16 / 18 %.

**Open balance items** (known, not yet addressed):

- **The tank's descent advantage.** It clears depth 2 in 57 % of descents against
  balanced's 36 % and depth 3 in 23 % against 7 %. The Hollow does not carry it (with every
  Hollow STRIKE pinned at 15 % of max HP it still clears depth 2 in ~65 %); it outlasts the
  depth's elites and bosses. Its act-3/4 boss fights also sit at the p90 edge (16 turns,
  7–9 % over 16).
- **naive and glass on their floors.** 16 % and 18 % against the ≥ 15 % / ≥ 18 % targets;
  any act-3/4 tightening must be paid for elsewhere.
- **Balanced's depth-3 clear below its aim**: 7 % against ≈ 10 %.
- **MUMMY and PALADIN elites as top killers**: MUMMY is balanced's second killer, glass's
  first and naive's second; PALADIN is in every sane policy's top four. Elites end 29 % of
  balanced story runs (bosses 25 %).
- **Pure physical builds lack a break other than BURST**: BREAK needs a weakness hit, BURST
  or PUNISH_WINDUP, and most weaknesses are elemental spells, so a physical build without
  PUNISH or IMBUE gear can only break a HEAVY by spending a full ember bar.

**Tuning history** (each change was measured with the same harness; superseded numbers are
not repeated here):

- *PR-11 review* (2026-11-24): no number moved. Stacking worn effects of one kind (see
  *When two worn items share an effect kind*) with DRAIN and MP_ON_HIT summed put balanced
  at 41 % (40–41 % over seeds 1–4); taking the stronger of those two instead holds it at
  39 % (seed 1) with naive 16 % and glass 18 %.
- *Review round 5* (2026-11-24): **MUMMY atkBase 5.3 → 4.9** (its act-3 hex took 25–30 of
  a ~100-HP hero and it was the top killer in two blind playtests and for naive). Balanced
  38 → 39 %, naive 15 → 16 %, glass 17 → 18 %, tank 35 %; MUMMY deaths: naive 309 → 260
  (no longer its top killer), glass 417 → 371, balanced 280 → 247.
- *Review round 4*: YETI atkBase 6.8 → 5.8 (naive died to the YETI in 405 of 2000 runs, its
  act-2 boss clear 75 % vs balanced 97 %; 6.2 moved it only to 79 %). Every event got a
  free option.
- *Review round 2*: `ACT_MULT` [1.3, 1.75, 2.8, 3.8] → [1.3, 1.8, 3.05, 4.3]; SAND GOLEM
  hpBase 195 → 115, atkBase 7.6 → 9.0, DEF 40 → 25; THE SERAPH hpBase 205 → 120, atkBase
  5.7 → 6.2, DEF 15 → 8; MUMMY atkBase 5.6 → 5.3; `DESCENT_GROWTH` 1.16 → 1.15; boss MEND
  6 %; THE HOLLOW strikes the weaker resist with `HOLLOW_HIT_FLOOR` 0.12. The round-2 rules
  alone had stretched the tank's Golem fight to a median 16 turns.
- *Review round 1*: `ACT_MULT` [1.15, 1.95, 2.78, 3.41] → [1.3, 1.75, 2.8, 3.8];
  `HEAVY_MULT` 2.2 → 2.0; harder act-1 normals; DARK LORD, YETI, SAND GOLEM, SERAPH
  reshaped; a potion back on each act; at most half a stage ELITE; THE HOLLOW sized off
  the best loadout with its STRIKE capped (`HOLLOW_ATK_SHARE` 0.65, `HOLLOW_HP_HITS` 22,
  `HOLLOW_HIT_CAP` 0.15).
- *M4 (the descent)*: THORNED 20 % uncapped → 15 % capped at 12 % of max HP (it caused
  36–42 % of all descent deaths).
- *M3*: 25 new items with real stat lines (with them offered but never taken balanced fell
  37 → 28 %); SHADOW EDGE, BLOOD CUP, GOLEM FIST, RUNE STAFF, RUNE TORC, JADE AMULET, WAR
  CLEAVER, PLATE ARMOR, GLASS SABER and NIGHT SCEPTRE retuned toward 8–68 % pick rates.
- *M2*: `ACT_MULT` [1.0, 1.38, 2.2, 3.1] → [1.15, 1.95, 2.78, 3.41]; FROST WISP trimmed;
  `GUARD_FACTOR` kept at 0.5 (potions and BURST are the bulk of the new hero power).
- *2026-09-04* (old map, not re-measured): elites kill 4 % of heroes entering above 70 % HP
  and ~50 % of those below 50 %; without upgrade cards balanced's win rate halves; taking a
  boss's scroll beats walking past it.

### The map generators are unified

There is one generator, `generateMap` in `game/sim/map.ts`; `game/mapgen.ts` only
adds the screen fields. The simulator used to link more stingily (about 39 % of nodes
with two onward links against 74 % in the game), which understated the real game's
win rate by about five points; the tables above are measured on the game's map.

## Owner decisions

v3 was built on these defaults; each changed something the owner did not ask for, and
each can be reverted in one tuning pass if the owner says so.

| Decision | Why |
|---|---|
| Story-run win target 15–25 % → **30–40 %** (per-act targets up, `random` < 5 % → < 8 %) | the descent now carries the difficulty; more players should reach it |
| **POTION ×2**, refilled at REST (and one back on entering each act) | "heal, guard or race" is the JRPG turn |
| Score: +500 per boss, a glory bonus on ASCEND, a death in the descent keeps half of what was earned since the last threshold; a new best-score format | depth has to be worth something and worth risking |
| Save/resume: closing the tab keeps the run; an interrupted fight restarts from its first turn | losing a 25-minute run to a closed tab is the worst UX the game had |
| Controls: B (X/C) opens GEAR and means "back"; Left/Right work in menus; pause gains ABANDON RUN | needed by the pack and the 2-D battle menu |
| A death after descending reports `won: true` to the host | the Seraph kill is banked |
| UPGRADE cards let the player **choose** the target | removes the "upgrade landed on the wrong item" frustration |
| EVENT rooms change the map mix; seeded layouts differ from v2's | variance |
| Small visual additions: tag strips under the battle plates, THE HOLLOW's tinted mirror sprite, a per-depth palette tint and banner | the new verbs and the descent must be readable and feel new |

**Cut for a later pass** (deliberately not in v3): origins/classes, a codex, resonance
sets, a FORGE/currency economy, more ailments, a daily-seed run on the title, a
battle-speed toggle, per-turn battle saves.
