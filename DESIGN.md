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
| `game/sim/*.ts` | pure rules, one concern per file: `util` (clamp, `at`, rng picks, `createSeededRng` — mulberry32 with readable state — and effect tables), `gear` (item levels, upgrades, effective mods/effects), `hero` (derived stats, skill points, heals, equip, spells), `ghost` (stats of a hypothetical equip), `describe` (item/offer/compare text, `compareFull`), `loot` (loot rolls, offers, scrolls, `resolveUpgrade`), `pack` (the pack: `stow`, `discard`, `swapIn`, `unequip`, `ownedIds`, `upgradableTargets`), `combat` (enemy scaling, turns, damage), `map` (**the one map generator**, `generateMap(rng, shape?)`, played by both the screens and the simulator), `model` (`Policy`, `RoomType` including `BOSS`), `scoring`, `policies` and `policy-choices` (how the archetypes decide; `DEFAULT_CHOICES` holds the shared pack/upgrade/prepare defaults), `run` (`simulateRun`) | `../types`, `../data`, each other |
| `game/sprites.ts` + `game/sprites/*.ts` | hero/enemy/icon sprites: `helpers`, `hero`, `icons`, one file per biome; `sprites.ts` re-exports them and adds `enemyAnim(id)` | `../engine` only |
| `game/main.ts` + `app`, `state`, `flow`, `frame`, `mapgen`, `theme`, `backdrop`, `widgets`, `pops`, `fx-state`, `fx`, `transition`, `storage`, `lookup`, `screens/*.ts` | presentation: `main.ts` only wires; `app` creates the engine objects and fits the canvas to the window; `state` holds the one `Game` object `g` with per-screen slices; `flow` runs the run (rooms, stages, clears, acts, scene hooks); `frame` dispatches update/render; `mapgen` adapts the shared headless map to the screens (adds `stage`, `slot`, `cleared`); the **fx / transition layer** presents what the rules decided and never decides anything — `fx-state` + `fx` hold the battle-fx clock (actor poses, timed cues, lagging meters, boss banner), `screens/battle-fx` choreographs a turn on it, `screens/battle-fx-view` draws its shots and banner, `screens/battle-reach` measures lunges, `transition` reveals each new sub-scene; `screens/` one update file and one view file per screen (`map-view`, `loot-view`, `battle-view`; `plate` holds the shared medallions) | everything |
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
  plus the entering item; A drops one for good, B returns to the offers). Dropping the
  newcomer still counts as taking the offer (no mend). KEEP YOUR GEAR (25 % mend) stays.
- **Owned items never re-roll**: `rollItems` and the boss signature exclude `ownedIds`
  (worn + packed). The starter-weapon guarantee looks at what is worn only. Scrolls
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
  map generator; fight rooms read it, and the map readout names the highlighted foe.
- **Simulator policies** also choose `stowOrEquip`, `dropWhich`, `upgradeTarget`, and
  `prepare(hero, foe)` before every fight (wear the best pack item per slot, weighting MDEF
  ×2 against a MAGIC attacker and DEF ×2 against a PHYSICAL one).

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
and level-up panels sit beside the hero, never over him.

## Balance state (measured with the headless simulator, 2026-11-23)

Harness: `npm run sim` (`sim/run.mjs`) bundles `game/sim.ts` with esbuild into a
temporary directory (`sim/bundle.mjs`), then calls `simulateRun` with each of
`POLICIES` and a seeded PRNG (`createSeededRng`; `--runs`, default 2000; `--seed`,
default 1; `--policy`; `--json`). Same seed and same code give byte-identical `--json`
output. The simulator replicates the drop rates, upgrade cards and boss tables, and
plays **the same map generator as the game** (`game/sim/map.ts`). Numbers below:
2000 runs, seed 1, after the generators were unified (M0); no tuning was changed.

| policy | win | reach act 2 | act 3 | act 4 | boss clears a1/a2/a3/a4 |
|---|---|---|---|---|---|
| balanced | 24.9 % | 81 % | 62 % | 42 % | 94/86/79/67 |
| glass (all offence) | 13.0 % | 85 % | 61 % | 35 % | 97/87/73/47 |
| tank (HP/DEF, physical) | 23.3 % | 86 % | 56 % | 31 % | 91/77/62/86 |
| elite-hungry routing | 24.5 % | 82 % | 62 % | 43 % | 93/87/78/66 |
| chest-hungry routing | 18.3 % | 78 % | 52 % | 32 % | 85/70/66/59 |
| random picks + points | 0 % | 38 % | 2 % | 0 % | 46/10/6/– |

Act-4 boss vs the balanced hero: ~10.5 turns to kill, each hit ≈ 21 % of max HP.
Balanced fights ~3.8 elites and opens ~3.2 chests per run (up from 2.8 / 2.7 on the
simulator's old, stingier linking). Hero base: 46 HP, +6 HP per skill point;
DEF/MDEF cap 42 %; `ACT_MULT` [1.0, 1.38, 2.2, 3.1].

Findings from the 2026-09-04 tuning pass (on the simulator's old map, not re-measured
since): elites kill 4 % of heroes entering above 70 % HP and ~50 % of those entering
below 50 %; with upgrade cards disabled the balanced win rate halves; taking a boss's
scroll beats walking past it (33 % vs 28 % wins for balanced, 59 % vs 17 % for tank).

### The map generators are unified

There is one generator, `generateMap` in `game/sim/map.ts`; `game/mapgen.ts` only
adds the screen fields. The simulator used to link more stingily (about 39 % of nodes
with two onward links against 74 % in the game), which understated the real game's
win rate by about five points; the table above is measured on the game's map.
