# Ember Quest — systems design (v3: parties, relics, elements, laps)

A roguelike party battler. Three heroes against one to three enemies, turn
order driven by SPD on an attack bar, skills gated by cooldowns, gear that
rolls its own numbers. Permadeath per run; a thin thread of progress survives
in the Vault.

v3 replaces v2 wholesale. The 1v1 duel, MP, the MAG/MDEF/DODGE stats and the
240×160 canvas are all retired. What v2 got right and v3 keeps: six equipment
slots, four rarities, authored unique effects on the best gear, an upgrade
that changes how an item *plays*, a card that tells you what it changes, and a
headless simulator that can Monte Carlo the whole thing.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + every rules constant not claimed by a `data/` row (presentation constants live in the module that reads them) | nothing |
| `game/data/skills.ts` | SKILLS — every character and enemy skill | `../types` |
| `game/data/characters.ts` | CHARACTERS — roster, awakenings, leader skills | `../types`, `./skills` |
| `game/data/enemies.ts` | ENEMIES, BIOMES (with their packs), BOSS_HP, ACT_MULT, ELITE_MULT, BOSS_MULT, LAP_MULT | `../types`, `./skills` |
| `game/data/relics.ts` | RELIC_MAIN_BASE, MAIN_BY_SLOT, MAIN_WEIGHTS, SUBSTAT_RANGES, LOOT_WEIGHTS, DROP_LEVEL | `../types` |
| `game/data/sets.ts` | SETS — 2-piece and 4-piece bonuses | `../types` |
| `game/data/sigils.ts` | SIGILS — the authored effects on EPIC and LEGENDARY relics | `../types` |
| `game/data/pacts.ts` | PACTS — SHRINE curse/boon pairs | `../types` |
| `game/data/ascension.ts` | ASCENSION — the A0–A10 ladder | `../types` |
| `game/data/index.ts` | re-exports + `validateData()` | `./*` |
| `game/sim/rng.ts` | `pick`, `uniformInt`, `weighted`, `chance` — the only draw primitives | `../types` |
| `game/sim/battle.ts` | ATB, the turn, damage, statuses, enemy AI, `intent`, `simulateBattle`, battle-log lines | `../types`, `../data/*`, `./rng` |
| `game/sim/relics.ts` | rolling, levelling, forging, set detection, `derive`, `compare` | `../types`, `../data/*`, `./rng` |
| `game/sim/run.ts` | map, rooms, loot, laps, ascension, the Vault as data, policies, `simulateRun` | `../types`, `../data/*`, `./rng`, `./battle`, `./relics` |
| `game/art/parts.ts` | the layered sprite part library + anchors | `../../engine` |
| `game/art/actors.ts` | character and enemy recipes, animation rigs (looked up by id) | `./parts` |
| `game/art/vfx.ts` | procedural effects (looked up by SkillId / status) | `../../engine` |
| `game/screens/*.ts` | one file per screen; `screens/vault.ts` owns localStorage | everything |
| `game/main.ts` | boot, loop, scene routing, input dispatch | everything |

Everything under `game/data/` and `game/sim/` is **headless** — no engine, no
DOM, no `localStorage`, no `Math.random` — so `esbuild game/sim/run.ts
--bundle` produces a runnable simulator. `sim/run.mjs` stays the Node harness
with its entry moved to `game/sim/run.ts`; it refuses to run if the bundle
mentions `window`, `document`, `localStorage` or `engine/`, or if
`validateData()` returns anything. **Randomness is injected**: `Rng = () =>
number`; every rolling function under `data/` and `sim/` takes `rng` last;
`main.ts` passes `Math.random`, the harness a seeded PRNG, and the same seed,
code and policy give an identical `RunResult`. `pick(n, rng) = floor(rng() ×
n)` is the only integer draw: a uniform integer in `[lo, hi]` is `lo +
pick(hi − lo + 1)`; a weighted choice is `rng() × Σw` walked cumulatively in
listed order; k without replacement is k successive `pick`s over the
shrinking list in data order, drawn even when one element remains; a
probability test is `rng() < p`, drawn even at p = 1. `intent()` and every
screen-side forecast run on copies and never touch the shared rng.
Definitions carry no art or audio; `art/` looks recipes up by id.

`validateData()` returns `[]` when: names respect the *UI constraints*
limits; every character has three skills, skill 1 at cooldown 0, skills 2–3
in 2..5, exactly one awakening branch; every enemy's `skills[0]` has cooldown
0, bosses have four skills and one `ALL_ENEMIES` skill, others 1–3; every
id referenced (`SkillId`, `SetId`, `SigilId`, enemy) exists and every one
defined is used; every enemy sits in a biome; packs are 1–3 wide, a width-3
pack has exactly one `support`, every biome's `fights` and `elites` contain a
pack of width ≤ 2, every `elites` row of acts ≥ 3 contains a NORMAL; at least
two thirds of a biome's non-boss enemies carry its dominant element and the
rest its foil, the boss DARK in odd acts and LIGHT in even; `MAIN_BY_SLOT`
obeys the slot table; `SUBSTAT_RANGES` has one row per `RelicStat`; every
`LOOT_WEIGHTS` row sums to 100, one row per act; eight sets of each size,
each with one bonus; exactly two sigils per slot, each `kindled.blurb ≠
blurb`; `PACTS` has ≥ 6 distinct ids; `DROP_LEVEL` has six rows, `ACT_MULT`
six entries, `ASCENSION` eleven; every `StatusKind` appears in a skill, set,
sigil, awakening or pact. A rule arms with the phase that lands its table
(roster and status-source rules: phase 5; `PACTS` and `ASCENSION`: phase 6a;
biomes 3–6: phase 6b) and the
harness refuses only on armed rules.

### Types

```ts
type Element = 'FIRE' | 'WIND' | 'WATER' | 'LIGHT' | 'DARK';
type DamageKind = 'PHYSICAL' | 'MAGIC';                      // what an enemy's resist blunts
type Slot = 'WEAPON' | 'BOOTS' | 'ARMOR' | 'NECKLACE' | 'CHALICE' | 'TOME';   // unchanged from v2
type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
type Stat = 'HP' | 'ATK' | 'DEF' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
type Stats = Record<Stat, number>;                           // flat ×4, points ×4
type RelicStat = 'HP' | 'HP_PCT' | 'ATK' | 'ATK_PCT' | 'DEF' | 'DEF_PCT' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
type TargetSpec = 'ENEMY' | 'ALL_ENEMIES' | 'ALLY' | 'ALL_ALLIES' | 'SELF' | 'LOWEST_HP_ALLY';
type StatusKind = 'STUN' | 'DEF_BREAK' | 'ATK_BREAK' | 'SLOW' | 'BURN' | 'HEAL_BLOCK' | 'BRAND' | 'SILENCE'
                | 'ATK_UP' | 'DEF_UP' | 'SPD_UP' | 'CRIT_UP' | 'SHIELD' | 'IMMUNITY' | 'COUNTER' | 'INVINCIBLE';
type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'SHRINE' | 'FORGE' | 'SUMMON' | 'ALTAR' | 'BOSS';
type LootSource = 'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS' | 'SUMMON';
type SkillId = /* closed union of every skill */; type SetId = /* sixteen */; type SigilId = /* twelve */;
type PactId = 'HASTE' | 'FURY' | 'VEIL' | 'BLIND' | 'SCHISM' | 'DEARTH';   type EnemyId = string;
interface StatusApply { status: StatusKind; chance: number; turns: number; magnitude?: number; target?: TargetSpec }
                       // magnitude: SHIELD, fraction of caster max HP; target overrides the skill's for this application
interface Status { kind: StatusKind; turns: number; pool?: number; dmg?: number }   // pool: SHIELD HP left; dmg: BURN per tick
interface LeaderSkill { stat: Stat; amount: number; element?: Element; elementAmount?: number }
interface Actor { side: 'HERO' | 'ENEMY'; slot: 0 | 1 | 2; def: CharacterDef | EnemyDef; stats: Stats; hp: number;
                  maxHp: number; baseMaxHp: number; atb: number; cooldowns: number[]; statuses: Status[]; alive: boolean;
                  resist: Record<DamageKind, number>; sets: SetBonus[]; sigils: SigilEffect[] }   // sets: 2-piece repeated per pair
interface Relic { id: string /* a run-scoped counter, never rng */; slot: Slot; rarity: Rarity; set: SetId; level: number; kindled: boolean;
                  main: { key: RelicStat; base: number }; subs: { key: RelicStat; value: number; rolls: number }[]; sigil?: SigilId }
interface PartyMember { def: CharacterDef; hp: number; relics: Partial<Record<Slot, Relic>>; awakened: boolean }
interface Party { members: PartyMember[]; leader: number }   // 1..3 members
interface RunConfig { ascension: number; vault: Relic[]; vaultSlots: number; roster: string[]; spdDelta?: number }
interface AscensionRow { enemyHpPct: number; enemyAtkPct: number; enemyRes: number; restGuarantee: boolean; substatTopMinus: number;
                         bossFourthSkill: boolean; restWeightMult: number; enemySpdPct: number; elitePackPlus: number;
                         bossOpens: boolean; bossWill: boolean }
```

`SkillDef`, `CharacterDef`, `EnemyDef`, `SetBonus`, `SigilEffect`, `Pact`,
`Policy`, `RunResult` and `Probe` are given in their sections. Every union is
closed: the sim interprets every kind, `main.ts` only renders them.

## Stats

| Stat | Unit | Job |
|---|---|---|
| HP | flat | survival |
| ATK | flat | damage for ATK-scaling skills |
| DEF | flat | mitigation, and damage for DEF-scaling skills |
| SPD | flat | attack-bar fill rate — turn frequency and turn order |
| CRIT | pts | chance to crit (0–100 scale) |
| CDMG | pts | crit damage bonus |
| ACC | pts | chance to land status effects |
| RES | pts | chance to resist them |

Baselines for every character: CRIT 15, CDMG 50, ACC 0, RES 15. HP, ATK, DEF
and SPD are what distinguish one character from another; enemies use the same
baselines unless their definition says otherwise. **MAG, MDEF and DODGE are
gone.** The physical-versus-magic build axis moves to elements; `DamageKind`
survives as a tag on every skill that an enemy's `resist` can blunt.

### Derivation

Every percentage source is added once and applied to base plus flat; every
point source is added once. Nothing compounds.

```
flat(S)  = fixed relic mains (WEAPON ATK, ARMOR HP, CHALICE DEF, BOOTS SPD) + flat substats + awakening flat
pct(S)   = % mains + % substats + FATAL/ENERGY/GUARD/SWIFT + leader amount + pact %          (HP ATK DEF SPD)
total(S) = max(1, round((base(S) + flat(S)) × (1 + pct(S) / 100)))
pts(S)   = baseline + point mains + point substats + BLADE/RAGE/FOCUS/ENDURE/WILL + awakening pts + leader + pact pts, min 0
```

A leader skill's `amount` is in the stat's native unit (percent for the four
flats, points for the four percents) and reaches all three members, leader
included; with `element` set, members of that element get `elementAmount`
instead; `pts` is never rounded. Whenever a `derive` changes `maxHp` (equip,
unequip, move, swap, leader, awakening, pact) `hp = hp === 0 ? 0 : max(1,
round(maxHp_new × hp / maxHp_old))`.

### Mitigation

```
mitigation = defEff / (defEff + DEF_K)          DEF_K = 900
```

300 DEF ≈ 25 %, 900 ≈ 50 %, 2700 ≈ 75 % — always more, never immune; a bare
starting character (DEF 120–280) mitigates 12–24 %. **Percentage caps are
retired**: they break the moment laps scale enemies past them. `CAP_CRIT =
100` (up from v2's 60) is applied at roll time, after the element bonus.
Nothing else is capped.

### Base stat ranges (run start, before relics)

HP 2000–4500 · ATK 150–320 · DEF 120–280 · SPD 95–120. The authored bases
(HP / ATK / DEF / SPD): EMBER 2900 / 280 / 150 / 104 · GALE 2600 / 220 / 140
/ 120 · TIDE 3800 / 180 / 190 / 108 · BASALT 4200 / 160 / 280 / 96 · SABLE
3000 / 210 / 160 / 112 · LUMEN 2500 / 320 / 120 / 100; the first three are
the `--battles` fixture.

## Elements

FIRE ▸ WIND ▸ WATER ▸ FIRE, and LIGHT ⇄ DARK mutually.

| Matchup | Damage | Crit chance |
|---|---|---|
| advantage | ×1.30 | +15 pts |
| neutral | ×1.00 | — |
| disadvantage | ×0.75 | −15 pts |

`ELEMENT_MULT` and `ELEMENT_CRIT` are these numbers as constants. LIGHT and
DARK are neutral against the triangle and advantaged against each other. The
swing is deliberate and large — a FIRE hero does about twice as much into
WIND as into WATER — which is why every biome has a dominant element *and* a
foil, and every boss is LIGHT or DARK: a mono-element party is a bet on the
route. Elements are also the visual identity: every actor's palette is an
element tint applied per sprite layer.

## Combat

### Turn order — the attack bar

Turn order is **event-driven, not clocked**: the rules never see `dt`, so the
simulator and the screen agree bit for bit at any frame rate.

```
ATB_TURN = 1000        ATB_START_MAX = 0.15
advance():  Δ_i = (ATB_TURN − atb_i) / spdEff_i for every living i;  Δ = min Δ_i  (0 if any atb_i ≥ ATB_TURN)
            every actor with Δ_i === Δ is set to exactly ATB_TURN; the rest add spdEff_i × Δ
ready():    living actors with atb ≥ ATB_TURN, ordered atb desc → spdEff desc → heroes before enemies → slot asc
            takeTurn(ready()[0]); recompute after EVERY turn — a strip, a stun, a boost or a death changes it
```

`spdEff` is SPD with SPD_UP/SLOW applied, read at each `advance`. `atb` is
never clamped: an actor pushed past `2 × ATB_TURN` by `atbBoost` or NEMESIS
acts twice in a row. Presentation animates each Δ at `ATB_ANIM_RATE` bars per
second, a number that lives in `screens/battle.ts` and cannot change an
outcome; the ribbon's queue is `forecast(battle, QUEUE_LEN = 8)`,
presentation only, recomputed at turn boundaries.

**Battle start**, in order: cooldowns 0, no statuses; every living actor,
heroes 0–2 then enemies 0–2, rolls `atb = rng() × ATB_START_MAX × ATB_TURN`
(always one draw each); WILL wearers receive IMMUNITY for `WILL_TURNS = 3`
(it ticks at the wearer's turn start, so 2 covers every enemy action before
the wearer's first turn *and* that turn); each BULWARK wearer grants every
living party member a SHIELD of `round(recipient.maxHp × BULWARK_SHIELD)` for
`BULWARK_TURNS = 3` (two wearers → max, not sum); pacts and ascension
openers (INVINCIBLE, A9's `atb = ATB_TURN`) apply.

### The turn

```
takeTurn(a, extra = false):
 1  if !extra: a.atb −= ATB_TURN                          // carry first, so a self atbBoost lands on the remainder
 2  BURN: a.hp −= status.dmg; if a.hp ≤ 0 the actor dies and the turn ends here
 3  stunned = a.has(STUN)
 4  cooldowns: cd[k] = max(0, cd[k] − 1)                  // also under STUN and SILENCE
 5  statuses: every duration −1; remove at 0             // tick at turn start, before the action
 6  if stunned: return                                    // the turn is consumed
 7  choose skill and target                               // SILENCE: skill 1 only; skill k needs cd[k] == 0
 8  resolve the skill; then cd[k] = skill.cooldown        // cast on turn T with cooldown n → usable again on turn T+n
 9  if both sides still have a living actor, a is alive, wears VIOLENT, !extra and rng() < VIOLENT_CHANCE:
      takeTurn(a, extra = true)                              // one fresh turn, never chains; no draw once a side is empty
10  recompute ready(); the battle ends when a side is empty, else actorTurns ≥ TURN_CAP is a stall
```

Tick at turn start, before the action: STUN(1) skips exactly one turn, BURN(n)
burns n times, a status applied on a foreign turn first ticks at the target's
next step 5, a self-buff of n covers n − 1 own actions (the stat buffs are
authored at 3: two actions). Dead
actors have no `atb`, are never targeted, never counter, take no ticks.
`TURN_CAP = 500` actor turns per battle (extras count): reaching it is a loss
reported as a stall (`deathKind 'STALL'`, `deathBy` = the pack's first enemy,
banks `BANK_DEATH`); the harness prints stalls per battle and exits non-zero
above 0.5 %. `actorTurns` increments at `takeTurn` entry (extras, stunned
and BURN-death turns included); an enemy turn with `actorTurns ≥
ENRAGE_TURN = 100` at entry is ENRAGED — ATK_UP (2) applied before step 5 —
and the ribbon says so; the harness prints enrages per boss beside stalls.
Heal-stalling a last enemy for free cooldowns is not a strategy.

### Skills

Each character has exactly three. Skill 1 has no cooldown; skills 2 and 3
cost 2–5 turns. There is no MP.

```ts
interface SkillDef {
  id: SkillId;             // closed union in types.ts
  name: string;            // <= 14 chars
  cooldown: number;        // 0 for skill 1, 2..5 otherwise
  mult: number;            // per hit (0 for a pure heal or buff)
  hits: number;            // 0 for a pure heal or buff
  scale: 'ATK' | 'DEF' | 'HP' | 'SPD';   // HP reads MAX HP; SPD reads spdEff
  kind: DamageKind;
  target: TargetSpec;      // relative to the caster
  applies?: StatusApply[]; // one roll per hit per surviving target (once per target when hits = 0)
  heal?: number;           // fraction of the CASTER's max HP, given to each target
  leech?: number;          // fraction of total damage dealt returned to the caster, once per skill
  atbBoost?: number;       // fraction of ATB_TURN granted to each target (or stripped, if negative)
  cleanse?: number;        // debuffs removed per target, lowest index in `statuses` first
  bonusVs?: { status: StatusKind; mult: number };   // extra multiplier when the target carries the status
  extendDebuffs?: number;  // turns added to every debuff already on each target
  refundOnKill?: boolean;  // a kill by this skill's own hit refunds its cooldown
  verb: string;            // battle log: HERO <verb> ENEMY FOR n!
}
```

Every "% ATB" in a skill, set or sigil is a fraction of `ATB_TURN`. A skill
resolves its hits (below), then per target in slot order: `cleanse` (the
skill's, then MENDING's one) → `heal` → `applies` for a skill with `hits = 0`
→ `extendDebuffs` → `atbBoost` → MENDING's ATB; then once per skill:
`leech` / VAMPIRE, SURGE, SPARK, the step-8 cooldown write (`cd = 0` instead
when `refundOnKill` and a target died to this cast). MENDING fires on every
target of a skill with `heal > 0`, HP gained or not, never on leech, VAMPIRE
or map heals. DEF-, HP- and SPD-scaling skills are what make a tank or a
speedster a damage dealer rather than a passenger. `chance` conventions: a primary debuff `CHANCE_PRIMARY = 0.75`, a
secondary or AoE debuff `CHANCE_SECONDARY = 0.50`; buffs, heals and
self-effects never roll. An awakened skill is a new `SkillId` the awakening
`upgrades` to (`extendDebuffs` for SABLE, `refundOnKill` for LUMEN).
`LOWEST_HP_ALLY` = living allies including self, lowest `hp / maxHp`, tie →
lowest slot; `ALLY`, `ALL_ALLIES` include the caster. `ALL_*` targets are
snapshotted when the action starts; a target that dies mid-skill takes
nothing further and draws no rng. Positive `atbBoost` is unconditional;
negative `atbBoost` on an enemy is a debuff-class effect (IMMUNITY blocks
it, it lands at chance 1.0 through the landing formula, once per target after
the hits, floored at 0).

### Status effects

Durations count the **affected actor's** turns, so a slow actor genuinely
suffers longer under a debuff. Magnitudes are constants, never stacked: one
instance per kind per actor, a re-application sets `turns = max(remaining,
new)` and, for SHIELD/BURN, `pool`/`dmg = max`. A buff and its break coexist
and both apply (ATK_UP + ATK_BREAK = ×1.0). IMMUNITY blocks every debuff
*application*, refreshes included, drawing no rng; extensions of a present
debuff (LOCKDOWN, RENDER) pass.

| Debuff | Effect | Turns | | Buff | Effect | Turns |
|---|---|---|---|---|---|---|
| STUN | skips the turn | 1 | | ATK_UP | +50 % ATK | 3 |
| DEF_BREAK | −70 % DEF | 2 | | DEF_UP | +70 % DEF | 3 |
| ATK_BREAK | −50 % ATK | 2 | | SPD_UP | +30 % SPD | 2 |
| SLOW | −30 % SPD | 2 | | CRIT_UP | +30 pts CRIT | 3 |
| BURN | `dmg` per turn, fixed at application: `min(round(maxHp × BURN_FRACTION = 0.05), round(BURN_CAP_ATK = 2.0 × statEff(applier, ATK)))` | 2 | | SHIELD | absorbs `pool` damage, then expires | `SHIELD_TURNS = 2` or until broken |
| HEAL_BLOCK | every HP gain to the holder is 0 | 2 | | IMMUNITY | blocks all incoming debuffs | 1 |
| BRAND | +25 % damage taken | 2 | | COUNTER | REVENGE at 100 % (see *Sets*) | 2 |
| SILENCE | skills 2 and 3 unusable | 2 | | INVINCIBLE | takes no HP loss of any kind; **enemy-only**: a boss's SELF skill or pact 3 | 1 |

Stat statuses modify the stat where it is read, unrounded: `statEff(a, S) =
stats[S] × (1 + up(S) − break(S))` for ATK, DEF and SPD; CRIT_UP enters the
crit roll; BRAND is the only defender-side damage multiplier. BURN is true
damage: it ignores DEF, element, crit and BRAND, is absorbed by SHIELD,
zeroed by INVINCIBLE, triggers no counter, and is lethal. Every status has a
named source in the launch roster or the act-1 pool (SPD_UP: Tailwind and
Rally; SHIELD: Bulwark, BULWARK, GRUDGE; BRAND: Inferno awakened, Rend;
SILENCE: Eclipse, Choke; COUNTER: Bulwark, Brace; INVINCIBLE: Shroud, pact 3;
HEAL_BLOCK: Mire, Doom); a status with no source is cut, not kept.

Landing is an ACC/RES check, floored so nothing is ever impossible:

```
p = clamp(apply.chance + (attacker.acc − defender.res) / 100, STATUS_MIN_CHANCE = 0.15, 1.0)
```

Applications on allies or self skip the check; a chance of 1.0 is still
resistible (RES 50 vs ACC 0 → 0.5); the roll is drawn whenever not blocked,
even at p = 1.0. Hits are the outer loop, snapshotted targets in slot order
the inner: hit 1 on every living target, then hit 2. Per hit and target:
crit → `applies` in order → the DESPAIR chance roll (always drawn) → its
landing roll (skipped under IMMUNITY) → RENDER on a crit: one landing roll at
chance 1.0 for a strip of `ATB_TURN × 0.10`, immediately, the kindled
extension riding on a landed strip.

### Damage

Per hit, on each living target, in this order:

```
raw    = statEff(attacker, skill.scale) × skill.mult × (target.has(bonusVs.status) ? bonusVs.mult : 1)
raw   ×= ELEMENT_MULT[matchup]
crit   = rng() × 100 < clamp(critPts(attacker) + ELEMENT_CRIT[matchup], 0, CAP_CRIT)      // rolled per hit
raw   ×= crit ? 1 + cdmg / 100 : 1
raw   ×= target.has(BRAND) ? 1.25 : 1
defEff = statEff(target, 'DEF')                                                            // DEF_UP + DEF_BREAK cancel
dealt  = raw × (1 − defEff / (defEff + DEF_K)) × (1 − target.resist[skill.kind] / 100)   // resist in points, heroes 0
dealt  = target.has(INVINCIBLE) ? 0 : max(1, round(dealt))
absorb = min(dealt, target.shieldPool); shield −= absorb; hp −= dealt − absorb           // SHIELD removed at 0
```

`DAMAGE_JITTER = 0`. `dealt` (rounded,
pre-absorb, overkill included) is what the log shows and what `leech`,
VAMPIRE and DESTROY read; NEMESIS and GRUDGE need `dealt − absorb > 0`.
Derived stats, shields, heals and per-hit damage are integers via `round`;
`atb` is a float. Heals give `round(caster.maxHp × heal)` to each target,
capped at missing HP; `leech` and VAMPIRE heal once per skill from the summed
`dealt` of every hit and target. No skill revives.

### Enemies

Enemies are actors like any other, with a decision rule that is a rule, not
presentation, so the simulator can run them.

```ts
interface EnemyDef {
  id: string; name: string;                 // <= 16 chars
  kind: 'NORMAL' | 'ELITE' | 'BOSS';
  element: Element;
  base: { hp: number; atk: number; def: number; spd: number };   // act 1, A0, before ACT_MULT
  pts?: Partial<Pick<Stats, 'CRIT' | 'CDMG' | 'ACC' | 'RES'>>;    // default: the baselines; pts.RES replaces the 15 in the RES formula, the act/kind/A terms still add
  resist?: Record<DamageKind, number>;      // pts, ≤ 40; default NORMAL 10 · ELITE 15 · BOSS 20
  skills: SkillId[];                        // 1..3; bosses carry a 4th for ascension A5
  ai: 'SPREAD' | 'FOCUS';                   // target rule for ENEMY skills
  support?: boolean;                        // heals, buffs or shields its pack
}
```

**AI.** Skill: the highest-index skill whose cooldown is 0 after the step-4
tick (skill 1 under SILENCE). Target: `SPREAD` draws uniformly among living
heroes (always one draw); `FOCUS` takes the living leader, else the lowest
`hp / maxHp`, tie → lowest slot — so choosing the leader is also choosing who
absorbs focus. Enemy `ALLY` skills resolve as `LOWEST_HP_ALLY` over the
living pack. `intent(enemy)` — the step-7 pick on a copy after steps 4–5, or
STUNNED — is shown in the turn ribbon, so a STUN, SLOW or strip always has a
visible target; the target is not telegraphed.

**Packs.** Each biome authors packs as data (`fights: EnemyId[][]`, `elites:
EnemyId[][]`, `boss`); on entry a room draws uniformly among packs of width ≤
`members + 1`. Every width-3 pack carries one `support`; from act 3 an
`elites` row includes one normal. Bosses fight alone and carry one
`ALL_ENEMIES` skill.

**Scale.** `KIND_MULT = { NORMAL: { hp 1, atk 1, def 1, spd 0, res 0 },
ELITE: { hp 2.5, atk 1.35, def 1.25, spd 5, res 10 }, BOSS: { hp —, atk 1.7,
def 1.6, spd 10, res 20 } }` (the layout's `ELITE_MULT` / `BOSS_MULT`). `hp =
round(base.hp × ACT_MULT.hp × KIND_MULT.hp × (1 + 0.10 A) × LAP_MULT.hp^(lap−1)
× (1 + CLEAR_GROWTH × clearsThisAct))` — for a BOSS `base.hp × ACT_MULT.hp ×
KIND_MULT.hp` is replaced by `BOSS_HP[act − 1]`; `atk` the same with its own
columns and `× (FURY ? 1.15 : 1)` inside the round; `def` the same without
the A, CLEAR and FURY terms; `spd = round((base + 3(act−1) + KIND_MULT.spd +
5(lap−1)) × (A ≥ 7 ? 1.08 : 1) × (HASTE ? 1.2 : 1))`; `RES = (pts.RES ?? 15)
+ 3(act−1) + KIND_MULT.res + 5 × max(0, A − 1)`, plus `WILL_RES` for an A10
boss. `CLEAR_GROWTH = 0.03` counts FIGHT and ELITE clears, resets per act,
and the boss carries the act's final count. On laps `ACT_MULT`, the biome,
the landmark and the clear counter read the lap's act; `LOOT_WEIGHTS` and
`DROP_LEVEL` read the act-6 row.

| Act | NORMAL hp / atk / def / spd (base 1250 / 300 / 150 / 95 through the formula) | ELITE | BOSS (`BOSS_HP` authored) |
|---|---|---|---|
| 1 | 1250 / 300 / 150 / 95 | 3125 / 405 / 188 / 100 | 4700 / 510 / 240 / 105 |
| 2 | 1450 / 360 / 191 / 98 | 3625 / 486 / 238 / 103 | 5800 / 612 / 305 / 108 |
| 3 | 1750 / 471 / 240 / 101 | 4375 / 636 / 300 / 106 | 8000 / 801 / 384 / 111 |
| 4 | 2050 / 600 / 300 / 104 | 5125 / 810 / 375 / 109 | 10000 / 1020 / 480 / 114 |
| 5 | 2350 / 720 / 371 / 107 | 5875 / 972 / 463 / 112 | 12000 / 1224 / 593 / 117 |
| 6 | 2700 / 849 / 450 / 110 | 6750 / 1146 / 563 / 115 | 14000 / 1443 / 720 / 120 |

`ACT_MULT = { hp: [1, 1.16, 1.40, 1.64, 1.88, 2.16], atk: [1, 1.20, 1.57,
2.00, 2.40, 2.83], def: [1, 1.27, 1.60, 2.00, 2.47, 3.00] }`, `LAP_MULT = {
hp 1.5, atk 1.5, def 1.2 }`. The reference party for every paper estimate in
this document is the expected-gear `balanced` party: at act 6 a mid hero of
HP 4650 · ATK 394 · DEF 284 · SPD 167 · CRIT 42 · CDMG 57 · ACC 38, which
kills an act-1 normal in ≈ 5 actions and dies in ≈ 12 hits, kills an act-6
normal in ≈ 7, and takes ≈ 46 actions on the act-6 boss (37 with an ATK
leader and DEF_BREAK).

**Biomes.** Each has a dominant element (two thirds of its pool) and a foil;
bosses alternate DARK and LIGHT. Names ≤ 12.

| Act | Biome | Dominant | Foil | Boss |
|---|---|---|---|---|
| 1 | EMBER CRYPT | FIRE | WIND | DARK |
| 2 | FROST MARSH | WATER | FIRE | LIGHT |
| 3 | SKY RUINS | WIND | WATER | DARK |
| 4 | ASHEN FORGE | FIRE | WATER | LIGHT |
| 5 | SUNKEN VAULT | WATER | WIND | DARK |
| 6 | STORM SPIRE | WIND | FIRE | LIGHT |

The EMBER CRYPT, authored for the vertical slice (every three-pack carries
the WARDEN; numbers are phase 8's):

| Enemy | El. | Kind / AI | Skills (cd) |
|---|---|---|---|
| CINDER IMP | FIRE | normal SPREAD | Scorch ×1.0 / Kindle ×0.8 + BURN 0.75 (3) |
| ASH HOUND | FIRE | normal FOCUS, spd +10 | Bite ×1.1 / Rend 2 × 0.6 + BRAND 0.75 (3) |
| CRYPT WARDEN | FIRE | normal support | Cudgel ×0.8 / Rally ALL_ALLIES SPD_UP (4) / Mend LOWEST_HP_ALLY 0.20 (3) |
| DUST WRAITH | WIND | normal SPREAD | Wail ×0.9 / Choke ×0.7 + SILENCE 0.75 (3) |
| PYRE KNIGHT | FIRE | elite FOCUS | Shield Bash DEF ×1.3 / Brace SELF DEF_UP + COUNTER (4) / Immolate ALL_ENEMIES ×0.7 + BURN 0.50 (5) |
| HOLLOW KING | DARK | boss FOCUS | Reap ×1.2 / Dread Wail ALL_ENEMIES ×0.8 + SLOW 0.50 (3) / Shroud SELF INVINCIBLE 1 (5) / A5: Doom ×2.0 + HEAL_BLOCK 0.75 (4) |

### Between battles

Cooldowns reset to 0 and every status and shield clears at battle end; HP
persists. After a win, in order: score; KO'd members are set to `round(maxHp
× KO_RETURN = 0.30)` and nothing else; living members gain `CLEAR_HEAL =
0.20`; the clear counter; the drop roll; the card screen. Entering a BOSS
restores `BOSS_ENTRY_HEAL = 0.50`. Every map heal is `hp = min(maxHp, hp +
round(maxHp × f))`. A hero at 0 HP is out for the rest of the battle; the
run ends only when every member is down.

## Relics

Each member has six slots, one relic each, no inventory — a new relic
**replaces** the slot's current one. A relic card is for a slot, not a hero:
taking it asks **who wears it**, and the equip screen shows the three
candidates' current pieces side by side with `compare(member, relic,
leader).line` ("SPD 112 → 131", "BREAKS SWIFT 2-SET"). Relics can be moved
or swapped between members on the party screen outside battle. Rarity
COMMON / RARE / EPIC / LEGENDARY. A relic's title is `<SET> +<level>` (≤ 11
chars); the slot is an icon.

`rollRelic(source, act, lap, run, rng)` draws in exactly this order, one
`pick` per step unless noted: (1) slot, uniform over the six slots in slot
order; (2) rarity from the source's `LOOT_WEIGHTS` row, cumulative COMMON →
LEGENDARY — a forced rarity (a boss's first card, every SUMMON card) draws
nothing; (3) set, uniform over the run's pool in `SETS` order; (4) main:
fixed slots draw nothing, open slots weighted in table order; (5) the
rarity's starting substats, each key then value; (6) level: the `DROP_LEVEL`
integer, then the +1s and the cap, no further draw; (7) the threshold
events in order (add: key, value; upgrade: which, value); (8) sigil, EPIC and
LEGENDARY only, uniform over the slot's two in `SIGILS` order. A screen rolls
its cards in card order; a SUMMON rolls its recruits before its EPIC.

`compare` in `sim/relics.ts` returns `{ line, score }`: `score = Σ_S
COMPARE_WEIGHTS[S] × Δ_S`, with `Δ_S = (after − before) / before` for the
four flats and `(after − before) / 100` for the four points, `after`/`before`
from `derive` with and without the relic (set bonuses gained or broken
included), `COMPARE_WEIGHTS = { HP 1, ATK 1, DEF 0.25, SPD 1.5, CRIT 0.5,
CDMG 0.4, ACC 0.3, RES 0.3 }`; `line` prints the largest |Δ| stat and any set
bonus that changes. Screens render `line`, never compute it.

### Main stat by slot

| Slot | Position | Main stat (bold = signature, weight `MAIN_WEIGHT_SIGNATURE = 2`, others 1) |
|---|---|---|
| WEAPON | 1 | flat ATK — fixed |
| BOOTS | 2 | **SPD** \| ATK % \| HP % \| DEF % |
| ARMOR | 3 | flat HP — fixed |
| NECKLACE | 4 | **CRIT** \| **CDMG** \| ATK % \| HP % \| DEF % |
| CHALICE | 5 | flat DEF — fixed |
| TOME | 6 | **RES** \| **ACC** \| ATK % \| HP % \| DEF % |

A build that wants speed *and* crit *and* accuracy has to spend three
specific slots on them, and the odd slots are never negotiable. The bold main
is the default, not the answer: the % main is right for the character whose
kit scales off it, and phase 8 verifies that on each open slot at least two
mains appear in winning policy lines.

`main = round(base × (1 + MAIN_PER_LEVEL × level))`, `MAIN_PER_LEVEL = 0.15`
(+6 → ×1.90). `RELIC_MAIN_BASE`: WEAPON ATK 36 · ARMOR HP 450 · CHALICE DEF
36 · BOOTS SPD 12 · ATK % / HP % / DEF % 16 · CRIT 12 · CDMG 22 · ACC / RES
16. Rarity never changes the base — it buys substats and a sigil — except
that LEGENDARY mains are multiplied by `LEGENDARY_MAIN_MULT = 1.5`, so a
LEGENDARY at its +4 cap (×2.40) out-mains a kindled EPIC at +6 (×1.90) by
about a kindle's worth — the price of never kindling.

### Substats

`SUBSTAT_POOL` is the eleven `RelicStat` keys, one pool for all slots; a draw
excludes the relic's rolled `main.key` and its existing sub keys (flat and %
of a stat are distinct keys).

Starting count by rarity: COMMON 1 · RARE 2 · EPIC 3 · LEGENDARY 4. Maximum 4.

Levels run **+0 to +6** (LEGENDARY stops at +4). Level history is
source-blind: after the rarity's starting substats, every threshold ≤ the
level (**+2, +4, +6**) fires one roll event in order. An event adds a substat
(key uniform from the remaining pool, one roll) if the relic has fewer than
four, else upgrades one existing substat, chosen uniformly, by **adding** a
fresh roll (`value += roll; rolls += 1`).

Roll ranges are inclusive integers, identical at every level (ascension A4+
lowers every top by 1):

| Substat | Range | | Substat | Range |
|---|---|---|---|---|
| ATK % / HP % / DEF % | 4–8 | | SPD | 4–6 |
| RES / ACC | 4–8 | | flat HP | 90–180 |
| CRIT / CDMG | 3–5 | | flat ATK | 7–13 |
| | | | flat DEF | 6–12 |

**Levels come from three places.** Drops arrive **pre-levelled by act**:
level = uniform integer in `DROP_LEVEL = [[0,1], [0,2], [1,3], [2,4], [3,5],
[4,6]][lap > 1 ? 5 : act − 1]`, +1 for an ELITE or BOSS card, +1 more for an
EPIC under VEIL, then `min(level, cap)` (6; LEGENDARY 4). FORGE adds +2 and
REST's *sharpen* +1, each firing the events of every threshold crossed,
never past the cap; only uncapped relics are offered for either.

### Sigils and kindling

COMMON and RARE relics are pure numbers. **EPIC and LEGENDARY carry one
authored sigil**: every sigil reads the ATB, cooldown or status systems,
never a bare stat, and a card shows it as a blurb ≤ 30 chars (the tables
below state effects; blurbs are authored in phase 3). At **+6** an EPIC relic
is **kindled**: the sigil gains its kindled behaviour, which changes how it
plays, and the kindled blurb must differ. LEGENDARY relics cap at +4 and never
kindle. Twelve at launch, two per slot, uniform within the slot; `SigilEffect`
is a closed union with one kind per row whose optional fields are the kindled
extras.

| Slot | Kind | Sigil | Kindled (+6) |
|---|---|---|---|
| WEAPON | `OPENER { atb? }` | the first skill you cast each battle does not start its cooldown | …and grants +30 % ATB |
| WEAPON | `RENDER { strip; extend? }` | crits strip 10 % of the target's ATB (debuff-class, as a negative `atbBoost`) | …and extend one debuff on it by 1 turn |
| BOOTS | `SURGE { self; allies? }` | on a kill by your own hit (counters count, BURN does not), +50 % ATB | …+25 % to the other allies too |
| BOOTS | `TRIP { slowStrip; stunStrip? }` | a SLOW you land also strips 25 % ATB (rides on the landed status, no roll) | …a STUN you land strips 100 % |
| ARMOR | `BASTION { bonus; cleanse? }` | shields on you are 50 % larger (`round(base × 1.5)`) | …and cleanse one debuff when applied |
| ARMOR | `THORNS { applyBreak? }` | COUNTER while DEF_UP or a SHIELD is on you | …counters apply DEF_BREAK (0.75) |
| NECKLACE | `SPARK { all? }` | a skill that crits shortens your highest remaining cooldown by 1, once per skill (tie: lowest index; read before step 8) | …every cooldown, once per skill |
| NECKLACE | `BLOODLUST { perDebuff }` | +10 pts CRIT per debuff on the target | …+15 |
| CHALICE | `MENDING { atb? }` | your heals also cleanse one debuff | …and grant 10 % ATB to each healed target |
| CHALICE | `GRUDGE { threshold; turns; shield? }` | a hit that leaves you below 50 % HP grants ATK_UP 2 | …and a SHIELD of 15 % |
| TOME | `LOCKDOWN { extra; ignoreRes? }` | debuffs you land last +1 turn (STUN excluded) | …and ignore RES (IMMUNITY still blocks) |
| TOME | `ECHO { skills }` | skill 3 cooldown −1 (`max(1, cd − 1)`) | …skills 2 and 3 |

"One debuff" (cleanse or extend) is the lowest index in `statuses`.

### Sets

Every relic belongs to a set. Two-piece sets need two relics, four-piece sets
need four, and six slots means one 4-set plus one 2-set, or three 2-sets.
Sixteen sets are authored; **each run rolls a set pool**: two of the eight
4-piece and two of the eight 2-piece sets, uniform without replacement
(`SET_POOL = { four: 2, two: 2 }`), then the sets of the Vault relics worn at
run start are unioned in — the pool is the distinct ids, fixed for the run.
Every relic in the run rolls its set uniformly over those ids, so four same-set relics drop in ≈ 95 % of runs — wearing them
is what REBRAND is for — and the draft is made knowing which builds are on
the table.

| 2-piece | Bonus | | 4-piece | Bonus |
|---|---|---|---|---|
| FATAL | +15 % ATK | | VIOLENT | `VIOLENT_CHANCE = 0.40` of an extra turn, never chaining |
| ENERGY | +15 % HP | | DESPAIR | `DESPAIR_CHANCE = 0.25` per hit (shielded or INVINCIBLE included) to STUN (1), then the landing roll at chance 1.0 |
| GUARD | +30 % DEF | | VAMPIRE | heal `VAMPIRE_FRACTION = 0.50` of damage dealt, once per skill |
| SWIFT | +20 % SPD | | WILL | IMMUNITY for `WILL_TURNS = 3` at battle start, and +20 RES |
| BLADE | +12 pts CRIT | | NEMESIS | `NEMESIS_ATB = 0.15` of ATB_TURN per hit with `dealt − absorb > 0` (not BURN) |
| RAGE | +40 pts CDMG | | REVENGE | `REVENGE_CHANCE = 0.35` to counterattack |
| FOCUS | +20 ACC | | BULWARK | party SHIELD of `BULWARK_SHIELD = 0.20` max HP at battle start, 3 turns |
| ENDURE | +20 RES | | DESTROY | after absorb, `strip = round(min(DESTROY_DEALT = 0.30 × dealt, DESTROY_FRACTION = 0.04 × maxHp))`; `maxHp' = max(round(DESTROY_FLOOR = 0.40 × baseMaxHp), maxHp − strip)`; `hp = max(1, hp − (maxHp − maxHp'))`, bypassing SHIELD, never lethal |

A 2-piece bonus applies `floor(n / 2)` times (three FATAL pairs = +45 % ATK);
a 4-piece applies once; bonuses are wearer-only except BULWARK; enemies wear
no sets (A10's WILL excepted). A **counter** (REVENGE, or COUNTER status at
100 %): after an enemy skill's hits and boosts resolve, each hero it hit
rolls once in slot order (no draw under COUNTER), if both are alive and the
counterer is not stunned — a shielded or INVINCIBLE hit still counts; the
counter resolves skill 1 fully (hits, `applies`, DESPAIR, `atbBoost`, leech,
VAMPIRE, NEMESIS, SURGE, SPARK, RENDER, TRIP) at `COUNTER_MULT = 0.75` on the
attacker, single-target whatever skill 1's spec says, without the step-8
cooldown write, without consuming OPENER, and never triggering a further
counter; BURN and DESTROY never trigger one. A counter is not a turn: no
carry, no ticks, no VIOLENT roll. `SetBonus` is a closed union with one kind
per row. Four-piece bonuses must beat three two-piece bonuses by a clear
margin: phase 8 measures with 2+2+2 as the baseline and, if 2+2+2 wins,
caps a 2-piece bonus at two applications.

## Characters

```ts
interface CharacterDef {
  id: string;
  name: string;              // <= 16 chars
  element: Element;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: [SkillId, SkillId, SkillId];
  awakening: { name: string; bonus: Partial<Stats> } | { name: string; upgrades: { slot: 0 | 1 | 2; to: SkillId } };
  leader: LeaderSkill;
}
```

Six at launch, growing toward twelve. Kits are the contract; numbers are
phase 8's.

| Name | El. | Role | Skill 1 / 2 (cd) / 3 (cd) | Awakening | Leader |
|---|---|---|---|---|---|
| EMBER | FIRE | AoE burner | Cinder ATK ×1.0 / Flare ALL_ENEMIES ×0.7 + BURN 0.50 (3) / Inferno ALL_ENEMIES ×1.0, 2 hits, ×1.5 vs BURN (5) | Inferno also BRANDs (0.75) | ATK +20 %, FIRE +35 % |
| GALE | WIND | speed stripper | Gust ATK ×0.9, −15 % ATB / Squall 2 hits + SLOW 0.60 (3) / Tailwind ALL_ALLIES +40 % ATB + SPD_UP (4) | Gust strips 30 % | SPD +15 %, WIND +25 % |
| TIDE | WATER | healer | Ripple ATK ×0.9, leech 0.20 / Tidepool LOWEST_HP_ALLY heal 0.18 (3) / Undertow ALL_ALLIES heal 0.10 + cleanse all (5) | Undertow also grants IMMUNITY 1 | HP +20 %, WATER +30 % |
| BASALT | FIRE | DEF wall | Bash DEF ×1.2 / Bulwark SELF DEF_UP + COUNTER (3) / Quake ALL_ENEMIES DEF ×1.0 + DEF_BREAK 0.50 (5) | Bulwark also shields the party 0.20 (`target: ALL_ALLIES`) | DEF +25 % |
| SABLE | DARK | ACC debuffer | Hex ATK ×0.8 + ATK_BREAK 0.75 / Mire ALL_ENEMIES SLOW + HEAL_BLOCK 0.50 (3) / Eclipse ATK ×1.2 + STUN 0.75 + SILENCE 0.75 (5) | Hex extends every debuff on the target by 1 turn | ACC +20 |
| LUMEN | LIGHT | crit sniper | Lance ATK ×1.4 / Radiance SELF CRIT_UP + ATK_UP (3) / Judgement ATK ×3.5, ×1.5 vs DEF_BREAK (5) | a Judgement kill refunds its cooldown | CRIT +15 |

Flare first, Inferno second, Cinder to focus the support: one of skills 2–3
per character is situational, which is what keeps a turn from collapsing into
"fire whatever is off cooldown". Two FIRE characters exist so a partial mono
party is a middle ground.

**Awakening** happens once per lap, at the ALTAR in act 3: the character
gains a permanent stat bonus or an upgraded skill. On later laps the ALTAR
offers only un-awakened members and is a FORGE when none remain.

**Leader skills**: only the **leader's** skill applies, and FOCUS enemies aim
at the leader, so choosing the leader trades the team-wide bonus against who
absorbs focus. The seat is chosen at the draft and may change at a SUMMON, a
REST or the ALTAR — never freely before an ELITE — and relics move freely;
the sim calls `leader()` at exactly those points. A leader who falls
mid-battle keeps the bonus alive for that battle.

### Building a party

You draft **one** character from the unlocked roster — your starting leader,
who also wears the Vault relics — and are immediately offered a **SUMMON**:
one of three characters not in the party. Act 1's landmark is the second
SUMMON, so the party is three by the third room. A recruit arrives at full HP.
A SUMMON with a full party offers one EPIC relic **or** a swap: the newcomer
takes a member's slot, relics, `hp / maxHp` fraction, the leader seat if
they held it, and the awakening if they had one — a kit choice, not a stat
loss; trade the healer for the sniper mid-act 5. Every SUMMON card is EPIC,
levelled as a FIGHT card; declining a SUMMON mends nothing.

## Run structure

Six acts, then laps. Room types: FIGHT, ELITE, REST, LOOT, **SHRINE**,
**FORGE**, **SUMMON**, **ALTAR** (act 3 only), BOSS.

### The map

`game/sim/run.ts` is the only generator; the map screen consumes it.
`buildMap(act, ascension, party, rng)` lays out `STAGE_SIZES = [2, 3, 1, 3,
2]` — five stages, then the BOSS. The single node of stage 3 is the act's
**landmark**: act 1 SUMMON, act 2 SHRINE, act 3 ALTAR, act 4 FORGE, act 5
SUMMON, act 6 REST. In order: (1) every other node rolls from `ROOM_WEIGHTS =
{ FIGHT 46, ELITE 16, LOOT 12, REST 10, FORGE 8, SHRINE 5, SUMMON 3 }`; (2) an
ELITE in stage 1, or rolled while the party is smaller than three, becomes
FIGHT; (3) guarantees — no REST (the landmark
counts; skipped at A3+): the lowest-index FIGHT of stage 4, else of stages 5,
2, 1 in that order, else stage 4's node 0, becomes REST; then no LOOT: the
lowest-index FIGHT in the first REST's stage, else the first FIGHT in stage
order, else the first non-landmark node that is not the guarantee REST,
becomes LOOT; (4) links — node i of a stage of a nodes into b: `straight =
round(i × (b − 1) / max(1, a − 1))`, `lo = max(0, hi[i−2], hi[i−1] − 1,
min(straight, b − 1))`, `width = (b ≥ 2 and rng() < SPAN_TWO_CHANCE = 0.85)
? 2 : 1` (no draw when b < 2), `hi = min(b − 1, lo + width − 1)`; then each
unreached j ascending joins the nearest span (tie: lowest i); a one-node
stage (landmark, BOSS) is linked from every node before it and to every node
after it with no draw, and the act entry links to every stage-1 node; (5) adjacency, RESTs in stage
order: a REST successor becomes FIGHT unless it is the landmark or the
guarantee REST, in which case the predecessor becomes FIGHT. Expected clears
≈ 3.5 per act, ≈ 21 per full lap; a run that dies in act 4 sees about twelve.

| Room | What it offers |
|---|---|
| FIGHT | a pack; a relic card on `FIGHT_DROP_CHANCE = 0.5` (the roll is drawn even when pity forces it), forced after `PITY_AFTER = 2` dropless FIGHTs; the dry counter resets on a FIGHT card only |
| ELITE | an elite pack, three relic cards, pick one |
| REST | full party heal, **or** sharpen — +1 level on every uncapped relic one member wears |
| LOOT | two relic cards, no fight |
| SHRINE | one pact drawn uniformly among untaken ones: accept its curse to gain its boon, both for the rest of the run, or walk past; a FORGE when none remain |
| FORGE | one relic: +2 levels (uncapped relics only), **or** recast one substat into a different pool stat with its `rolls` re-rolled, **or** rebrand it to another pool set (worn sets allowed) keeping its rolls — any worn relic for the last two; walking past is legal; a FORGE (or a SHRINE / ALTAR that became one) with nothing to offer is skipped |
| SUMMON | rolled regardless of party size; recruit one of three, or an EPIC / swap when full |
| ALTAR | awaken one party member |
| BOSS | one per act; three cards, the first an EPIC levelled as a BOSS card, pick one |

Every relic card screen may be declined: declining mends the party
`SKIP_MEND = 0.15`. Cards per source `LOOT_COUNT = { FIGHT 1, ELITE 3, LOOT
2, BOSS 3, SUMMON 1 }`, then `max(1, count + boons − curses)`; rarity rolls from
`LOOT_WEIGHTS` (COMMON / RARE / EPIC / LEGENDARY, one row per act): FIGHT
70/25/5/0 · 60/30/9/1 · 50/35/13/2 · 40/40/17/3 · 30/42/23/5 · 20/42/30/8;
ELITE and LOOT 35/45/17/3 · 28/44/23/5 · 21/42/29/8 · 15/40/35/10 ·
10/38/40/12 · 5/35/45/15; BOSS 0/40/45/15 · 0/33/47/20 · 0/27/48/25 ·
0/20/50/30 · 0/15/50/35 · 0/10/50/40.

**Pacts** (`Pact = { id: PactId; name ≤ 16; curse: Modifier; boon:
Modifier; blurb ≤ 30 }`, `Modifier` a closed union with one kind per cell;
pacts stack across the run):

| Id | Curse (rest of run) | Boon (rest of run) |
|---|---|---|
| HASTE | enemies +20 % SPD | +1 card on every relic screen |
| FURY | enemies +15 % ATK | party ATK +15 % |
| VEIL | bosses INVINCIBLE 1 at battle start (until their first turn starts) and again on their first turn below 50 % HP | every EPIC drops +1 |
| BLIND | party RES −20 | party ACC +25 |
| SCHISM | no leader skill (FOCUS still aims at the leader) | each member's own leader skill applies to that member only, at half, unrounded |
| DEARTH | one fewer card on every relic screen (min 1) | FORGE gives +4 |

**Score**: `score += ROOM_SCORE[type] × actNumber × (1 + 0.5 × ascension)`
per clear, `ROOM_SCORE = { FIGHT 10, ELITE 25, BOSS 100 }`, `actNumber =
6 × (lap − 1) + act`. Shown on the victory and death screens, posted via
`scoreChanged`, never lost on death.

### Laps — the endless mode

Beating the act 6 boss ends the run **only if you want it to**. The victory
screen offers two doors:

- **DESCEND** — bank your relics, take the win, end the run.
- **ANOTHER LAP** — keep everything (party, HP, relics, awakenings), the map
  resets to act 1 with every enemy under `LAP_MULT` (compounding per lap, on
  top of the run's ascension, which never changes mid-run), and the score
  keeps climbing.

Banking happens **only at DESCEND**: after lap *L* (1-based) it banks `BANK_WIN + L − 1`
relics (2, then 3, then 4 — the Vault cap still holds), while a death
anywhere, laps included, banks `BANK_DEATH = 1`. The lap buys score and
harder enemies; in relics it costs about one — DESCEND is the greedy door by
design. The ascension unlock (`unlocked = max(unlocked, min(10, ascension +
1))`) is granted at the run's first act-6 kill, before the door.

### Ascension

A0 through A10, chosen at run start up to the highest unlocked, immutable for
the run. `ASCENSION: AscensionRow[11]` holds the cumulative records; each
level adds its row to every row above it.

| A | Adds |
|---|---|
| 1 | enemy HP +10 %, ATK +10 % — and again at every level after (A10 = +100 %) |
| 2 | enemy RES +5 per level from here (A10 = +45): ACC becomes mandatory around A5 |
| 3 | no REST guarantee — REST only by roll |
| 4 | the top of every substat range −1 |
| 5 | bosses gain their fourth skill |
| 6 | REST weight halved |
| 7 | enemy SPD +8 % |
| 8 | elite packs of width < 3 gain one NORMAL, uniform over the biome's NORMAL ids, appended last, skipped when the party-size cap forbids |
| 9 | bosses start at `atb = ATB_TURN` and act first |
| 10 | bosses get WILL |

### The Vault — progress across runs

Permadeath keeps its teeth. What survives a run is a **trickle you choose**,
not an inventory.

- DESCEND banks `BANK_WIN = 2` relics (more after laps); any death banks
  `BANK_DEATH = 1`. Banked relics keep level, sigil and kindling.
- At the next run's start you may equip up to `vaultSlots =
  min(VAULT_EQUIP_MAX = 3, actsCleared)` relics from the Vault onto your
  starter, one per slot (`actsCleared` = bosses killed last run, laps
  included); withdrawing removes a relic from the Vault.
- The Vault holds `VAULT_SIZE = 12`. Past that, banking means choosing what to
  drop before the run can end.

`RunConfig` carries the Vault, the ascension and the roster in;
`RunResult.banked` and `actsCleared` carry out; `screens/vault.ts` persists
them, `vaultSlots` and the highest ascension won under one `localStorage`
key. All six launch characters are unlocked.

## Difficulty targets (balance sim)

**How the targets are measured.** `npm run sim` = 2000 runs per policy, seed
1, A0, empty Vault, full roster (5000 for a recorded Balance state). "Act N
clear" = act-N boss killed on lap 1, as a fraction of all runs on the
`balanced` policy; the ladder is **act 1 ≥ 80 % · act 2 ≈ 57 % · act 3 ≈
41 % · act 4 ≈ 29 % · act 5 ≈ 21 % · act 6 ≈ 15 %** (a smooth 0.72 survival
per act after act 1). **Lap 2 clear ≈ 8 %** of runs that took ANOTHER LAP, on
`lapper`. A random-draft, random-pick, random-target policy must win < 3 %.

Speed matters more than raw power: `RunConfig.spdDelta` (the harness's
`--spd`) adds a flat delta to every hero's base SPD before `derive`; the
harness runs `balanced` at +10 and −10 on identical seeds and the fast party
must clear act 3 at least 20 points more often. If it does not, the SPD base
range, the SPD substat range or SWIFT's 20 % is wrong.

Every 4-piece set must appear in at least one winning policy line: ≥ 5 % of
some policy's wins end with it complete (`setsWorn`). A set no policy ever
wants is a set that needs rewriting, not renumbering.

**Every choice is a Policy method.** `main.ts` never calls one; the harness
always does. Each method receives the enumerated options and `rng` and
returns an index (or `null` where declining is legal); an out-of-range answer
is clamped to option 0. `POLICIES.random` answers uniformly over the legal
answers (`relic`: every (card, onto) pair plus `null`; `summon`: every
recruit, every (swap, out) pair and `null`; `forge`: every (relic, mode) pair
then a uniform substat or pool set; `rest`: HEAL plus one sharpen per
member wearing an uncapped relic; `shrine` and `lap`: 50/50; `bank`: `n` uniform relics of `worn`,
the overflow rule below; `vaultEquip`: a uniform
0..slots distinct-slot relics) — the definition of the < 3 % floor.

```ts
interface Policy {
  draft(roster, rng): number;                 leader(party, rng): number;
  route(offered: RoomType[], run, rng): number;                       // the current node's successors, span order
  act(battle, actor, options: { skill: number; target: number }[], rng): number;
  relic(cards, party, rng): { card: number; onto: number } | null;
  summon(offers, party, rng): number | { swap: number; out: number } | null;   // full party: 0 = the EPIC
  forge(worn, rng): { relic: number; mode: 'LEVEL' | 'RECAST' | 'REBRAND'; substat?: number; set?: SetId } | null;
  shrine(pact, run, rng): boolean;            altar(party, rng): number;
  rest(run, rng): 'HEAL' | { sharpen: number };                       // sharpen = a member index
  lap(run, rng): 'DESCEND' | 'LAP';
  bank(worn, n, vault, rng): { take: number[]; drop: number[] };      // vault − drop + take ≤ VAULT_SIZE
  vaultEquip(vault, slots, starter, rng): number[];                   // first relic per slot wins
}
```

`options` for `act` is built in skill order then target order: skill k is
legal when `cd[k] == 0` and (k == 0 or not SILENCEd); `ENEMY` yields one
option per living enemy slot ascending, `ALLY` one per living hero slot
ascending, every other spec exactly one with `target = −1`. `worn` is every
relic on every member, member then slot order. `simulateRun(config, policy,
rng)` runs `draft`, `vaultEquip`, the set pool, the ascension row, the
opening `summon`, `leader`, then `buildMap(1, …)`. Invalid structured
answers: `bank` truncates `take` to `min(n, worn.length)` and on overflow
drops the lowest-level Vault relics (tie oldest) until it fits;
`vaultEquip` keeps the valid prefix; `altar` falls to the lowest un-awakened
index; `relic`, `summon`, `forge` and `rest` with any illegal field decline
(`null`, no change, `HEAL`). The sim's Vault defaults: bank the *n*
highest-level worn relics (tie rarity, member, slot).

Policy roster: **random** · **balanced** (`relic` takes the highest
`compare.score` when positive; `act` maximises expected `dealt` with crit at
its probability, preferring a heal that reaches the lowest ally when any
ally is below 40 %, ties lowest index; DESCEND) · **speed** (SPD boots,
SWIFT/VIOLENT, GALE leader, strips first) · **glass** (ATK %/CRIT/CDMG
mains, FATAL/RAGE/BLADE/DESTROY, lowest-HP target) · **tank** (HP/DEF mains,
GUARD/ENERGY, BULWARK/WILL/REVENGE) · **control** (ACC tome, FOCUS/DESPAIR,
opens with breaks) · **mono** (one element, elemental leader) · **lapper**
(`balanced` that takes the lap).

```ts
interface RunResult { won; actReached; lap; ascension; clears; actsCleared; deathBy: string; deathKind: '' | 'WIPE' | 'STALL';
                      party: string[]; leader: string; awakened: string[]; setsWorn: SetId[][]; mainsWorn: (RelicStat | null)[][];
                      relicLevels: number[][]; banked: Relic[]; rooms: RoomType[]; turnsPerBattle: number[]; enrages: number; probes: Probe[] }
interface Probe { act; lap; won; actorTurns; heroTurns; partySpd; bossSpd; outSped: boolean; bossHp; dmgDealt; ttk;
                  hitsTaken; hitFrac; stunsLanded; debuffsResisted }   // one per boss
```

`won` = the run ended at DESCEND; `actReached` = the 1-based act of the
final lap; `deathBy` on a WIPE = the enemy whose hit or BURN downed the last
living hero; `awakened` = member ids in ALTAR order; `setsWorn[m]` = member
m's active set ids at run end, a 2-piece repeated per pair; `mainsWorn` =
per member, slot order; `partySpd` = mean derived SPD of members alive at
boss entry, `outSped = partySpd > bossSpd`, `actorTurns` counts every
`takeTurn`, `ttk` = hero turns until the boss died or the battle ended,
`hitsTaken` = enemy hits that reduced hero HP or shield, `hitFrac` = hero HP
lost ÷ Σ maxHp, `stunsLanded` = STUNs heroes landed on the boss,
`debuffsResisted` = hero applications on the boss that failed the landing
roll. Phase 2 ships `simulateBattle(party, enemies, policy: Pick<Policy,
'act'>, rng): BattleResult = { won; stall; actorTurns; probe; party }` and
the harness's `--battles` mode: each selected policy's `act` (default every
policy) over `BATTLE_FIXTURES` — EMBER, GALE, TIDE at base stats, no relics,
full HP, leader EMBER, rebuilt fresh per battle, against every act-1 pack
scaled at act 1, lap 1, A0, `clearsThisAct = 0`, no pacts — 2000 battles
each, printing win rate, mean turns, stall and enrage rates. The 2+2+2
baseline is a `pairs` policy (three 2-sets, else `balanced`).

## Presentation

### Canvas and scale

**1280×720 logical, landscape.** The backing store is ×1 everywhere; ×2 only
when `devicePixelRatio ≥ 1.5` and the fitted CSS width is at least 1280,
chosen once at boot (a resize re-fits CSS only). The canvas is fitted by CSS
(letterboxed `aspect-ratio: 16 / 9`, never its intrinsic size) with
`image-rendering: auto`: crispness comes from the integer ×3 *inside* the
frame, and the frame itself scales smooth.

### HD-2D — hard pixels under soft light

The reference is Octopath Traveler: everything around the sprites. Five
passes: (1) **diorama planes** — background, midground, actor plane,
foreground, each parallaxing at its own rate; (2) **depth of field** —
background and foreground blurred, the actor plane razor sharp; (3) **chunky
actors** — parts authored at `ACTOR_PART = 64` px (`BOSS_PART = 96`), drawn
at `ACTOR_SCALE = 3` with smoothing off, ≤ `ACTOR_W = 192` wide (a boss ≤
`BOSS_W = 288`), the only plane with hard pixel edges; (4) **light at native resolution** — a per-biome
key light as radial gradients, rim light along actor silhouettes, embers,
dust and fog as smooth alpha particles, composited with `'lighter'`; (5)
**colour grading** — a cached `'multiply'` shadow tint that carries the
vignette and a cached `'screen'` highlight tint, the contrast curve baked
into the planes when the biome is built. The governing rule is one line
long: **exactly one plane is pixelated.** Light, particles, fog, UI and text
all render smooth at 720p.

**Budget.** One full-screen alpha pass at logical 720p is one FSE (0.92 Mpx;
a ×2 backing quadruples it, hence desktop-only); a 2022 mid-range phone
affords 8–12 per frame at 60 Hz.

| Tier | Passes | FSE | Where |
|---|---|---|---|
| HIGH | planes 3 + actors + key light + particles + bloom (¼ res) + grading 2 + UI | ≈ 8.5 (+1 in a flash) | desktop default |
| MED | as HIGH, no highlight tint, bloom at ⅛ res, fewer fog puffs | ≈ 6.1 | phone default |
| LOW | BG (key light baked in) + actors + particles + vignette + UI | ≈ 3.1 | auto after 60 consecutive frames > 20 ms; never rises |
| ARCADE | LOW's planes + the full CRT (halation, lift, scanlines, vignette) | ≈ 9 | the toggle |

Bloom and CRT halation are the same effect: exactly one is on, and the HD
tiers never call `crt.render`. Blurred planes are pre-rendered **once per
biome** into offscreens (the background opaque and oversized by the parallax
amplitude, mid/foreground as ≤ 3 sub-rects) and redrawn at a new offset;
bloom runs through a quarter-res offscreen allocated once (threshold by
self-multiply, blur via `ctx.filter` at 320×180 with a two-tap `drawImage`
fallback), upscaled with smoothing on; key-light and grading gradients are
cached per biome and animated with alpha and translate only. `getImageData`
never runs in the frame loop. Nothing allocates per frame: pops are
`POP_MAX = 16` pooled, the log keeps `LOG_KEEP = 32` lines and reveals by
count. `engine/light.ts` lands in phase 7a; `engine/crt.ts` is **kept**.

### Layered actors

A character is a recipe, not a picture: body, head, torso, weapon, cape —
each an ASCII part from a shared library with **anchor points**, so a weapon
stays in a hand across an animation. Animation is per-layer transform
keyframes stepped at `POSE_FPS = 12`, rotation in 90° steps; element tint is
a palette swap per layer at bake time; rim light is applied to the composed
silhouette. Parts bake lazily per (part, element) into one atlas per element
(1024×1024), never one canvas per part; a pose is composed at part
resolution, rim light included, only when its keyframe changes; the frame
draws one `drawImage` per actor at ×3. Text goes through a glyph atlas the
same way. `fillRect` per cell exists only at bake time.

### Procedural VFX

Auras, projectiles, impact shockwaves, status glows, light shafts, boss
silhouettes and screen distortion are drawn with code at native resolution —
smooth light over hard pixels. Screen distortion is boss-intro only, in 8-px
bands; every gradient is cached; shake amplitudes scale with the frame
(20–30 px for a death), `DIM_BLEED = 40`.

### Input

**Native tap and keyboard, in parallel, always both.** `engine/input.ts`
maps pointer events to logical pixels through `getBoundingClientRect()`
(divide by the CSS size, never `canvas.width`), primary pointer only, pointer
capture on down, a tap committed on release inside the region it began in,
all pressed state cleared on `pointercancel` and blur, and an immediate-mode
hit-region registry — a pooled array registered in `update()` before
`input.endFrame()`, read by `render()`. Audio unlocks on the first key **or**
the first tap.

Every tappable region also carries a **selection index**, so the whole game
remains playable on a keyboard: focus moves spatially with the arrows, A
activates. A screen that adds a tap target adds a keyboard route to it in the
same change, and the converse holds — PAUSE, BACK and inspect have on-screen
targets — because a phone has no keys. `TAP_MIN = 96` logical px (≈ 48 CSS
px at a phone's 0.5×), `TAP_GAP = 12`; the registry expands any smaller hit
rect around its centre, clamped to the canvas, and a region's drawn rect
always beats a neighbour's expanded hit rect. Sprite bodies and panels
register the same target id.

`index.html` drops the arcade bezel on small screens; `touch-action: none`,
`viewport-fit=cover`, `100dvh` sizing, the web-app metas, fullscreen and
`orientation.lock('landscape')` on first tap where the APIs exist, an "add to
Home Screen" hint where they do not (iPhone, phase 4), a rotate prompt.

### UI constraints

Logical screen 1280×720, font 7×11 (`FONT_HD`, mixed case). **Nothing
renders below scale 2**: `TEXT_POP 3` (crits 4) · `TEXT_LABEL 3` (skill
labels, the current actor, door and card titles) · `TEXT_BODY 2` (everything
else). Limits at those scales: battle log line ≤ `LOG_LINE_MAX = 72` chars,
character names ≤ 16, skill names ≤ 14, relic set names ≤ 8, enemy names ≤
16, biome names ≤ 12, pact names ≤ 16, sigil and pact blurbs ≤ 30 wrapped
by `textWidth` inside `CARD_W − 2 × CARD_PAD` (`CARD_PAD = 16`, ≤
`BLURB_LINES_MAX = 3` lines), relic titles ≤ 11.
`SAFE_MARGIN = 24` on every side; on a phone (CSS scale < 0.75)
`SAFE_BOTTOM_PHONE = 40` and the skill buttons draw at `SKILL_H_PHONE = 80`
(hit rects still reach the bottom edge) — nothing else moves. Hit rects may
bleed into the margin, drawn panels may not.

The battle screen is staged on a **diagonal**: heroes face right on a
back→front diagonal at left-centre, enemies mirrored; names live in the side
panels, only gauges and a short status row sit on the actor plane.

| Region | Geometry |
|---|---|
| turn ribbon | y 24–88: `QUEUE_LEN = 8` chips of `QUEUE_CHIP = 48` from `QUEUE_X = 24` at `QUEUE_GAP = 4` (display-only; an `INTENT_BADGE = 24` at (chip.x + 24, chip.y + 24) on enemy chips, the STUN icon when stunned), the current actor's name at `TEXT_LABEL` from `NAME_X = 452`, `ENRAGE_CHIP = (848, 40, 112, 32)` with ENRAGED at `TEXT_BODY`, ACT/LAP and SCORE lines right-aligned at `RIBBON_RIGHT = 1160` (y 32 / 57); PAUSE draws 64×64 at (1192, 24) with an explicit hit rect (1176, 0, 96, 96) |
| hero panels | x 24–304, three of `PANEL 280×104` at y 96/212/328; `PANEL_PAD = 7`, rows NAME 22 · HP 22 · ATB 6 · STATUS 28 (six 28-px icons + a 32×28 element chip), gaps 4; tap = target while a target prompt is open, else inspect |
| stage | x 320–960: heroes at (408, 380) · (464, 448) · (520, 516) feet, `DIAG_DX 56 / DIAG_DY 68`; enemies mirrored about x 640; a boss at (816, 516); HP 96×12 and ATB 96×6 under the feet on the outer side; ≤ `STATUS_ABOVE_MAX = 4` icons above the head (then 3 + "+N"); pops at head + 64 |
| enemy panels | x 976–1256, mirror of the hero panels; **tap = target**, the canonical enemy target |
| log | y 558–590, one line |
| skill bar | three `SKILL 400×96` buttons at y 600 drawn inside registered hit rects `SKILL_HIT 400×120` (the PAUSE pattern): row 1 the label at `TEXT_LABEL`, row 2 five cooldown pips left and a key hint right (desktop) |
| cards | `CARD 384×440` at `CARD_Y = 88`, x 40/448/856, or four of `284×440` at x 48/348/648/948 under HASTE; the room-to-room card is the middle slot with `CONTINUE = (448, 552, 384, 96)`; the who-wears-it row: `WEAR_BTN 280×96` at `WEAR_X = 40/344/648/952`, `WEAR_Y = 552` (the fourth is decline), each candidate's current piece and compare line in the three card slots |
| doors | DESCEND and ANOTHER LAP, 520×200 at `DOOR_X = 96 / 664`, `DOOR_Y = 320` |
| inspect | `INSPECT = (24, 24, 1232, 648)` via `drawPanel`: name at `TEXT_LABEL` (48, 40); six rows at `INSPECT_ROW_Y = 96 + 72 × i` — 32-px slot icon, title ≤ 11 at `TEXT_LABEL`, four substats ≤ 10 chars at `TEXT_BODY`; set bonuses at y 544–600; `BACK = (1040, 552, 192, 96)`, also bound to B |
| pause | dimScene, PAUSED at scale 4 at y 120, three `PAUSE_BTN 400×96` at x 440, y 216 / 336 / 456 (resume · ARCADE · quit), group `pause`, index 0–2 |
| map | `MAP_NODE = 96` at `MAP_X = 88 + 208 × stage`, `MAP_Y = 168 + 144 × row`; the act and score band y 24–120 |
| party | three member columns in the card slots, six 56-px slot rows from y 136; SWAP · BACK in the 552–648 row at `WEAR_X` |

## Delivery phases

Each phase ends green — `check`, `build`, `smoke`, and `sim` where rules
moved — and updates CLAUDE.md's repo map and engine table and every skill
that names a moved file in the same milestone. v3 is built on a branch:
`main` keeps serving playable v2 until phase 4 lands.

| # | Phase | Delivers |
|---|---|---|
| 0 | **Contract** | this document |
| 1 | **Engine upscale** | 1280×720 canvas fitted by CSS, `FONT_HD` with a glyph atlas, baked sprites, pointer input + hit regions with keyboard parity and `TAP_MIN` expansion, the mutable safe inset, CRT retuned, mobile shell with the web-app metas. Rewrites `ensuring-arcade-visuals` and `handling-user-input`. |
| 2 | **Combat core** (headless) | types, stats, elements, ATB, the turn, cooldowns, statuses, ACC/RES, damage, 3v3 resolution, enemy AI and `intent`, the `SetBonus` and `SigilEffect` unions with their battle hooks fed from fixtures, `simulateBattle`; SKILLS, CHARACTERS for the slice three, ENEMIES and packs for acts 1–2 with elements. Simulator retargeted with `--battles`; `sim/rng.ts`. |
| 3 | **Relics** (headless) | rolling, substats, drop levels, forging, sharpening, sets and the set pool, the twelve sigils with kindled variants and blurbs, `derive`, `compare`, loot tables, `validateData`. |
| 4 | **Vertical slice** | layered actor pipeline with anchors (no rim light yet), one opaque LOW-tier backdrop per biome, ATB gauges, the turn ribbon with intents, status icons, skill VFX, the diagonal stage — **plus the minimum to play it**: EMBER, GALE and TIDE as a fixed party (leader EMBER), the EMBER CRYPT with its packs and boss, a linear five-room run (FIGHT · FIGHT · LOOT · FIGHT · BOSS) as room-to-room cards, the relic card and who-wears-it screens, title, PAUSE overlay (resume · ARCADE toggle · quit), GAME OVER and VICTORY, sfx, score and runtime messages, the iPhone Home-Screen hint. **The game is playable again here.** |
| 5 | **Roster and meta** | the other three characters, the draft and the opening SUMMON, the leader choice, SUMMON drafting and swaps, the party screen; the slice run becomes FIGHT · FIGHT · SUMMON · LOOT · FIGHT · BOSS so the party is three by the boss; awakenings as data plus `derive` with an `awakened` flag on the `--battles` fixtures. |
| 6a | **Run structure** | the branching map, SHRINE/FORGE/ALTAR/REST-sharpen, laps, the Vault with persistence, `simulateRun`, the nine policies, `RunResult` and `--spd`, on acts 1–2 (after 5). |
| 6b | **Biomes** | ENEMIES and packs for acts 3–6 — per biome ≥ 4 normals (one support, ≥ 1 foil), one elite, one four-skill boss — and ascension (parallel with 5). |
| 7a | **Diorama** | `engine/light.ts`: DoF planes, parallax, bloom, quality tiers. |
| 7b | **Light** | per-biome key light, rim light, grading. |
| 7c | **Spectacle** | boss intros, light shafts, screen distortion; a procedural chiptune loop if time allows — there is no music at launch. |
| 8 | **Balance** | simulator retune against the targets above; the Balance state below rewritten and dated. |

Phases 2 and 3 are independent and can run in parallel; 5 and 6b can run in
parallel once 4 lands, 6a follows 5; 7a–7c each ship alone.

## Balance state

Not yet measured — v3 has no numbers behind it. The v2 table is retired with
the v2 rules. Paper numbers last moved in the round-3 review (2026-09-05):
`ENRAGE_TURN` 40 → 100, `VIOLENT_CHANCE` 0.30 → 0.40, `WILL_TURNS` 2 → 3,
`LEGENDARY_MAIN_MULT` 1.2 → 1.5, `COMPARE_WEIGHTS.DEF` 0.6 → 0.25, GUARD +15
→ +30 % DEF, SCHISM's curse ×0.5 → ×0. This section gets rewritten at phase
8 and dated.

## Open questions

Decisions the review could not make for the owner. Each has a default written
into the contract above so the build never waits; overrule by editing the
rule, not this list.

1. **A fallen hero.** Default: out for the battle, back at `KO_RETURN` after a
   win; the run ends on a wipe. Alternative: the fallen stay dead for the run,
   the party fights short-handed until a SUMMON, and REST's second option
   becomes "revive one". Harsher, truer to "permadeath keeps its teeth", and
   much harder to balance; recommended: keep the default until phase 8 has
   numbers.
2. **Element swing.** ×1.30 / ×0.75 with ±15 crit is a 2× swing one way and
   ≈ 4× both ways, so a mono party in its foil biome is a coin flip.
   Alternative: ×1.25 / ×0.80 with ±10. Recommended: keep the numbers, and
   soften only if the `mono` policy clears act 3 below 60 % of `balanced`.
3. **The Vault and ascension.** Default: ascension is the player's choice up
   to the highest unlocked. Alternative: every Vault relic worn raises the
   run's minimum ascension by one, so three god-rolls are a bet at A3 and the
   ladder rises to meet the Vault mechanically — at the cost of a casual A0
   player never using the Vault. Recommended: the alternative, once ascension
   exists to be tested.
4. **Roster unlocks.** Default: all six unlocked at launch. Alternative: three
   at launch, one per win. The sim treats the roster as an input either way.
