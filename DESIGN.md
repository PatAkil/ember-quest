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
default 1; `--policy`; `--json`). Same seed and same code give byte-identical `--json`
output. The simulator replicates the drop rates, upgrade cards and boss tables, and
plays **the same map generator as the game** (`game/sim/map.ts`). Numbers below:
2000 runs, seed 1, after M1 (pack, chosen upgrades, scouted foes, headless starter
weapon); no tuning was changed.

| policy | win | reach act 2 | act 3 | act 4 | boss clears a1/a2/a3/a4 |
|---|---|---|---|---|---|
| balanced | 32 % | 86 % | 68 % | 50 % | 93/88/83/72 |
| glass (all offence) | 20 % | 92 % | 64 % | 38 % | 98/87/72/63 |
| tank (HP/DEF, physical) | 27 % | 90 % | 55 % | 34 % | 94/75/68/87 |
| elite-hungry routing | 33 % | 87 % | 67 % | 50 % | 94/88/83/73 |
| chest-hungry routing | 22 % | 82 % | 52 % | 36 % | 86/67/72/63 |
| random picks + points | 0 % | 45 % | 2 % | 0 % | 49/13/22/0 |

Every win rate rose (balanced 24.9 → 32 %, glass 13 → 20 %, tank 23 → 27 %) because
the pack and chosen upgrades are hero power: an UPGRADE card now lands on the best worn
item instead of a random one (balanced takes 3.0 upgrades a run, up from 2.4), nothing
taken is lost, and the starter weapon is guaranteed in the simulator too. The pack itself
is mostly a reserve: balanced ends with ~2 packed items, stows 0.09, drops 0.14 and
`prepare` swaps only 0.01 times a run — the scored policies rarely carry a better
counter-item than what they wear. M1's pass line (balanced ≥ 24.9 %) holds and it stays
under the 45 % ceiling, so nothing was retuned.

M0 (2026-11-23), for reference: balanced 24.9 %, glass 13.0 %, tank 23.3 %,
elite-hungry 24.5 %, chest-hungry 18.3 %, random 0 %.

Act-4 boss vs the balanced hero: ~9.7 turns to kill, each hit ≈ 21 % of max HP.
Balanced fights ~4.0 elites and opens ~3.5 chests per run. Hero base: 46 HP, +6 HP per skill point;
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
