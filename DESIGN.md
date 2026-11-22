# Ember Quest — systems design (v2: skill points + loot table)

A roguelike JRPG: branching node map per act, turn-based one-on-one battles,
permadeath. v2 replaces the tier-upgrade gear with **skill points** and a
**loot table of named items with unique effects**.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + tuning constants (caps, SP gains) | nothing |
| `game/data.ts` | ITEMS, LOOT_WEIGHTS, SPELLS, ENEMIES, BIOMES, ACT_MULT, `validateData` | `./types` only |
| `game/sim.ts` | the barrel: the only path presentation and the simulator use to reach the rules | `./sim/*` |
| `game/sim/*.ts` | pure rules, one concern per file: `util` (clamp, rng picks, effect tables), `gear` (item levels, upgrades, effective mods/effects), `hero` (derived stats, skill points, heals, equip, spells), `ghost` (stats of a hypothetical equip), `describe` (item/offer/compare text), `loot` (loot rolls, offers, scrolls), `combat` (enemy scaling, turns, damage), `map` (the simulator's map), `model` (`Policy`, `RoomType`), `scoring` and `policies` (how the archetypes decide), `run` (`simulateRun`) | `../types`, `../data`, each other |
| `game/sprites.ts` + `game/sprites/*.ts` | hero/enemy/icon sprites: `helpers`, `hero`, `icons`, one file per biome; `sprites.ts` re-exports them and adds `enemyAnim(id)` | `../engine` only |
| `game/main.ts` + `app`, `state`, `flow`, `frame`, `mapgen`, `theme`, `backdrop`, `widgets`, `pops`, `fx-state`, `fx`, `transition`, `storage`, `lookup`, `screens/*.ts` | presentation: `main.ts` only wires; `app` creates the engine objects and fits the canvas to the window; `state` holds the one `Game` object `g` with per-screen slices; `flow` runs the run (rooms, stages, clears, acts, scene hooks); `frame` dispatches update/render; `mapgen` builds the map the screens play; the **fx / transition layer** presents what the rules decided and never decides anything — `fx-state` + `fx` hold the battle-fx clock (actor poses, timed cues, lagging meters, boss banner), `screens/battle-fx` choreographs a turn on it, `screens/battle-fx-view` draws its shots and banner, `screens/battle-reach` measures lunges, `transition` reveals each new sub-scene; `screens/` one update file and one view file per screen (`map-view`, `loot-view`, `battle-view`; `plate` holds the shared medallions) | everything |
| `game/devhook.ts` | the dev-only seeded hook (`?seed`, `?scene`, `&act`, `&hold`, `window.__ember`), never in the build | `../engine` types, `./sim`, presentation types |

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
- Caps: DEF/MDEF 60 %, CRIT 60 %, DODGE 40 % — items + points together.
- Act-entry spells unchanged: WATER (act 2), SLASH (act 3), THUNDER (act 4).
  TOME items grant extra spells (TWINBOLT, LEECH, QUAKE, MEND) while equipped.

## Items

Six slots, one item each, no inventory: a new item **replaces** the slot's
current item (the loot screen shows both). Rarity COMMON / RARE / EPIC /
LEGENDARY. Every RARE+ item carries a unique effect (`ItemEffect`). The pool
is ~41 items; names <= 13 chars, blurbs <= 30 chars.

### Upgrades (+1 / +2)

Every equipped item has a level. **+1** scales its numbers (`UPGRADE_SCALE`
on mods, `scaleEffect` on effect magnitudes — downsides never grow). **+2 is
the awakening** (`item.awaken`): an authored change to how the item plays —
a sticky ramp, a hex that converts every physical hit, reflect that answers
hexes too, a common blade that learns to execute. Legendaries stop at +1.
Upgrades arrive as an **UPGRADE card** on the loot screen for one random
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

The map guarantees one chest per act and, when it has to invent one, places
it beside the rest stop so "rest or loot" is a forced choice at least once.

## Combat

- Hero turn: regen (chalice/necklace) → BLOOD tick → action. ATTACK is free,
  scales off ATK (or MAG for a magic weapon), deals `weaponKind` damage.
  Spells per `SPELLS`. Crit: `crit %` chance, `x critMult`.
- Enemy DEF/MDEF blunt the matching damage kind — HEX_STRIKE turns physical
  attacks into magic damage, so a physical build can beat a plated foe.
- Enemy turn: dodge check → damage × (1 − DEF/MDEF) → REFLECT → REVIVE check.
- Enemies scale `(base + perClear × clears) × ACT_MULT[act] × def.mult`.

## Difficulty targets (balance sim, sane policy)

act 1 clear ≥ 70 %, act 2 ≈ 50 %, act 3 ≈ 35 %, full run ≈ 15–25 %.
A random-allocation, random-pick policy must win < 5 % of runs. Late-game
power comes from routing (elites for loot), focused points, and item synergy —
not from stat inflation alone.

## UI constraints (text overlap)

Logical screen 240×160, font 4 px per char at scale 1. Battle log line
<= 52 chars, or it wraps to two lines. Item names <= 13 chars, enemy names
<= 12, spell names <= 9. Every panel is placed with `SAFE_MARGIN`; the loot
and level-up panels sit above the actors, never over them.

## Balance state (tuned with the headless simulator, 2026-09-04)

Harness: `npm run sim` (`sim/run.mjs`) bundles `game/sim.ts` with esbuild into a
temporary directory, then calls `simulateRun` with each of `POLICIES` and a seeded
PRNG (`--runs`, default 2000; `--seed`, default 1; `--policy`; `--json`). Same seed and
same code give byte-identical `--json` output. The simulator replicates the drop
rates, upgrade cards and boss tables; its map (`game/sim/map.ts`) uses the same stage
sizes as the game's but its own linking — see *Open item* below.

| policy | win | reach act 2 | act 3 | act 4 | boss clears a1/a2/a3/a4 |
|---|---|---|---|---|---|
| balanced | 17–19 % | 77 % | 52 % | 32 % | 86/79/72/62 |
| glass (all offence) | 9 % | 84 % | 54 % | 24 % | 95/82/60/45 |
| tank (HP/DEF, physical) | 15 % | 81 % | 45 % | 22 % | 86/65/55/75 |
| elite-hungry routing | 17 % | | | | |
| chest-hungry routing | 15 % | | | | |
| random picks + points | 0 % | 38 % | 2 % | 0 % | |

Act-4 boss vs the balanced hero: ~11 turns to kill, each hit ≈ 21 % of max
HP. Elites kill 4 % of heroes entering above 70 % HP and ~50 % of those
entering below 50 %. Upgrades matter without being mandatory: with upgrade
cards disabled the balanced win rate halves. Taking a boss's scroll beats
walking past it (33 % vs 28 % wins for balanced, 59 % vs 17 % for tank).
Hero base: 46 HP, +6 HP per skill point; DEF/MDEF cap 42 %; `ACT_MULT` [1.0, 1.38, 2.2, 3.1].

### Open item: the game's map links more generously than the simulator's

A review measured that the map generator the screens use (`game/mapgen.ts`) gives
about 74 % of nodes two onward links, against about 39 % in the simulator's
`game/sim/map.ts`. More links mean more routing choice, so the real game is
somewhat easier than the table above says: with the game's linking in the simulator,
balanced wins about 24 % instead of 19 %. Not fixed in the tooling work because
choosing which linking is right is a balance decision; it is owned by the gameplay
work, which will re-measure this table once the two generators agree.
