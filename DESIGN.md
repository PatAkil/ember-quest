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
| `game/types.ts` | shared types + every tuning constant named in CAPS here | nothing |
| `game/data/skills.ts` | SKILLS — every character and enemy skill | `../types` |
| `game/data/characters.ts` | CHARACTERS — roster, awakenings, leader skills | `../types`, `./skills` |
| `game/data/enemies.ts` | ENEMIES, BIOMES (with their packs), ACT_MULT, ELITE_MULT, BOSS_MULT, LAP_MULT | `../types`, `./skills` |
| `game/data/relics.ts` | RELIC_MAIN_BASE, MAIN_BY_SLOT, MAIN_WEIGHTS, SUBSTAT_RANGES, LOOT_WEIGHTS, DROP_LEVEL | `../types` |
| `game/data/sets.ts` | SETS — 2-piece and 4-piece bonuses | `../types` |
| `game/data/sigils.ts` | SIGILS — the authored effects on EPIC and LEGENDARY relics | `../types` |
| `game/data/pacts.ts` | PACTS — SHRINE curse/boon pairs | `../types` |
| `game/data/ascension.ts` | ASCENSION — the A0–A10 modifier ladder | `../types` |
| `game/data/index.ts` | re-exports + `validateData()` | `./*` |
| `game/sim/battle.ts` | ATB, the turn, damage, statuses, enemy AI, battle-log lines | `../types`, `../data/*` |
| `game/sim/relics.ts` | rolling, levelling, forging, set detection, derived stats | `../types`, `../data/*` |
| `game/sim/run.ts` | map, rooms, loot, laps, ascension, the Vault as data, policies, `simulateRun` | `../types`, `../data/*`, `./battle`, `./relics` |
| `game/art/parts.ts` | the layered sprite part library + anchors | `../../engine` |
| `game/art/actors.ts` | character and enemy recipes, animation rigs (looked up by id) | `./parts` |
| `game/art/vfx.ts` | procedural effects: auras, projectiles, impacts (looked up by SkillId / status) | `../../engine` |
| `game/screens/*.ts` | one file per screen; `screens/vault.ts` owns localStorage | everything |
| `game/main.ts` | boot, loop, scene routing, input dispatch | everything |

Everything under `game/data/` and `game/sim/` is **headless** — no engine, no
DOM, no `localStorage`, no `Math.random` — so `esbuild game/sim/run.ts
--bundle` produces a runnable simulator. `sim/run.mjs` stays the Node harness
and its entry point moves to `game/sim/run.ts`; it refuses to run if the
bundle mentions `window`, `document`, `localStorage` or `engine/`, and if
`validateData()` returns anything. This is the boundary that makes balance
possible; it does not move.

**Randomness is injected.** `Rng = () => number` lives in `game/types.ts`;
every function under `data/` and `sim/` that rolls anything takes `rng` as
its last parameter. `main.ts` passes `Math.random`, the harness passes a
seeded PRNG, and the same seed, code and policy produce an identical
`RunResult`. Data definitions carry no art or audio: `art/` looks recipes up
by id, element tint is `art`'s reading of `def.element`.

`validateData()` returns `[]` when: names respect the limits in *UI
constraints*; every character has exactly three skills, skill 1 at cooldown
0 and skills 2–3 in 2..5, and exactly one awakening branch; every `SkillId`,
`SetId`, `SigilId`, `PactId` and enemy id referenced exists and every one
defined is used; every enemy sits in a biome, every biome pack is 1–3 wide;
`MAIN_BY_SLOT` obeys the slot table and no substat pool contains its slot's
main; every `LOOT_WEIGHTS` row sums to 100 with one row per act; every set
has exactly one bonus of size 2 or 4; `ACT_MULT` has six entries and
`ASCENSION` eleven.

### Types

```ts
type Element = 'FIRE' | 'WIND' | 'WATER' | 'LIGHT' | 'DARK';
type DamageKind = 'PHYSICAL' | 'MAGIC';                      // what an enemy's resist blunts
type Stat = 'HP' | 'ATK' | 'DEF' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
type Stats = Record<Stat, number>;                           // flat ×4, points ×4
type RelicStat = 'HP' | 'HP_PCT' | 'ATK' | 'ATK_PCT' | 'DEF' | 'DEF_PCT' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
type TargetSpec = 'ENEMY' | 'ALL_ENEMIES' | 'ALLY' | 'ALL_ALLIES' | 'SELF' | 'LOWEST_HP_ALLY';
type StatusKind = 'STUN' | 'DEF_BREAK' | 'ATK_BREAK' | 'SLOW' | 'BURN' | 'HEAL_BLOCK' | 'BRAND' | 'SILENCE'
                | 'ATK_UP' | 'DEF_UP' | 'SPD_UP' | 'CRIT_UP' | 'SHIELD' | 'IMMUNITY' | 'COUNTER' | 'INVINCIBLE';
interface StatusApply { status: StatusKind; chance: number; turns: number; magnitude?: number } // magnitude: SHIELD, fraction of caster max HP
interface Status { kind: StatusKind; turns: number; pool?: number }     // pool: SHIELD HP left
interface LeaderSkill { stat: Stat; amount: number; element?: Element; elementAmount?: number }
interface Actor { side: 'HERO' | 'ENEMY'; slot: 0 | 1 | 2; def: CharacterDef | EnemyDef; stats: Stats; hp: number; maxHp: number;
                  atb: number; cooldowns: number[]; statuses: Status[]; alive: boolean; resist: Record<DamageKind, number> }
interface Relic { id: string; slot: Slot; rarity: Rarity; set: SetId; level: number; kindled: boolean;
                  main: { key: RelicStat; base: number }; subs: { key: RelicStat; value: number; rolls: number }[]; sigil?: SigilId }
interface PartyMember { def: CharacterDef; hp: number; relics: Partial<Record<Slot, Relic>>; awakened: boolean }
interface Party { members: PartyMember[]; leader: number }   // 1..3 members
interface RunConfig { ascension: number; vault: Relic[]; vaultSlots: number; roster: string[]; seed?: number }
```

`SkillDef`, `CharacterDef`, `EnemyDef`, `SetBonus`, `SigilEffect`, `Pact`
and `Policy` are given in their own sections. Every union is closed: the sim
interprets every kind, `main.ts` only renders them.

## Stats

Eight, and only eight. They are the same eight the inspiration uses, which is
not a coincidence: the set is small enough to read on one panel and every one
of them has a job.

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
and SPD are what distinguish one character from another. Enemies use the same
baselines unless their definition says otherwise.

**MAG, MDEF and DODGE are gone.** The physical-versus-magic build axis they
carried moves to elements. `DamageKind` survives only as a tag on every skill
that an enemy's `resist` can blunt.

### Derivation

Every percentage source is added once and applied to base plus flat; every
point source is added once. Nothing compounds.

```
flat(S)  = fixed relic mains (WEAPON ATK, ARMOR HP, CHALICE DEF) + flat substats + awakening flat
pct(S)   = % mains + % substats + FATAL/ENERGY/GUARD/SWIFT + leader amount      (HP ATK DEF SPD)
total(S) = max(1, round((base(S) + flat(S)) × (1 + pct(S) / 100)))
pts(S)   = baseline + point mains + point substats + BLADE/RAGE/FOCUS/ENDURE + awakening pts + leader amount, min 0   (CRIT CDMG ACC RES)
```

A leader skill's `amount` is in the stat's native unit (percent for the four
flats, points for the four percents) and reaches all three members, leader
included; with `element` set, members of that element get `elementAmount`
instead of `amount`. Statuses never enter `derive`: they modify the stat where
it is read (below), so `stats` on an `Actor` is the relic-and-leader total.

### Mitigation

DEF is a flat stat run through a curve, not a capped percentage:

```
mitigation = defEff / (defEff + DEF_K)          DEF_K = 900
```

So 300 DEF ≈ 25 % reduction, 900 DEF ≈ 50 %, 2700 DEF ≈ 75 % — always more,
never immune. A bare starting character (DEF 120–280) mitigates 12–24 %; 900
DEF is a relic-stacked wall, not a baseline. **Percentage caps are retired**:
they break the moment laps scale enemies past them, and this game is now
meant to run forever. `CAP_CRIT = 100` (up from v2's 60; a crit chance above
certainty is meaningless) is applied at roll time, after the element bonus.
Nothing else is capped.

### Base stat ranges (run start, before relics)

HP 2000–4500 · ATK 150–320 · DEF 120–280 · SPD 95–120.

Numbers are deliberately mid-scale: large enough that a rolled `+9 ATK`
substat is a real but small increment beside a `+6 % ATK` one, small enough to
fit a damage number on screen without abbreviation.

## Elements

FIRE ▸ WIND ▸ WATER ▸ FIRE, and LIGHT ⇄ DARK mutually.

| Matchup | Damage | Crit chance |
|---|---|---|
| advantage | ×1.30 | +15 pts |
| neutral | ×1.00 | — |
| disadvantage | ×0.75 | −15 pts |

`ELEMENT_MULT` and `ELEMENT_CRIT` are these numbers as constants. LIGHT and
DARK are neutral against the triangle and advantaged against each other, so
they are the flexible picks and the rarest. The swing is deliberate and large
— a FIRE hero does about twice as much into WIND as into WATER — which is why
every biome has a dominant element *and* a foil, and every boss is LIGHT or
DARK (see *Enemies*): a mono-element party is a bet on the route, not a
guaranteed edge.

Elements are also the visual identity: every actor's palette is an element
tint applied per sprite layer, which is why the layered art pipeline exists.

## Combat

### Turn order — the attack bar

Every actor carries `atb`. Turn order is **event-driven, not clocked**: the
rules never see `dt`, so the simulator and the screen agree bit for bit at any
frame rate.

```
ATB_TURN = 1000        ATB_START_MAX = 0.15
advance():  Δ = min over living i of (ATB_TURN − atb_i) / spdEff_i      (Δ = 0 if any atb_i ≥ ATB_TURN)
            atb_i += spdEff_i × Δ; the argmin is set to exactly ATB_TURN (no float drift)
ready():    living actors with atb ≥ ATB_TURN, ordered atb desc → spdEff desc → heroes before enemies → slot asc
            takeTurn(ready()[0]); recompute after EVERY turn — a strip, a stun, a boost or a death changes it
```

`spdEff` is SPD with SPD_UP/SLOW applied, read at each `advance`, so a SLOW
landed mid-bar slows the remaining fill. `atb` is never clamped: an actor
pushed past `2 × ATB_TURN` by `atbBoost` or NEMESIS legally acts twice in a
row. Presentation animates each Δ at `ATB_ANIM_RATE` bars per second — a
number that lives in `screens/battle.ts` and cannot change an outcome.

**Battle start**, in this order: cooldowns 0, no statuses; every living actor,
heroes 0–2 then enemies 0–2, rolls `atb = rng() × ATB_START_MAX × ATB_TURN`
(always rolled, one draw each, so identical SPD never deadlocks); WILL wearers
receive IMMUNITY for `WILL_TURNS = 2` — it ticks at the wearer's turn start, so
2 covers every enemy action before the wearer's first turn *and* that turn;
each BULWARK wearer grants every living
party member a SHIELD of `round(recipient.maxHp × BULWARK_SHIELD)` for
`BULWARK_TURNS = 3` of the recipient's turns (two wearers → max, not sum).

### The turn

```
takeTurn(a, extra = false):
 1  if !extra: a.atb −= ATB_TURN                          // carry first, so a self atbBoost lands on the remainder
 2  BURN: a.hp −= burnDamage(a); if a.hp ≤ 0 the actor dies and the turn ends here
 3  stunned = a.has(STUN)
 4  cooldowns: cd[k] = max(0, cd[k] − 1)                  // also under STUN and SILENCE
 5  statuses: every duration −1; remove at 0             // act, then decrement: STUN(1) skips exactly one turn, BURN(n) burns n times
 6  if stunned: return                                    // the turn is consumed
 7  choose skill and target                               // SILENCE: skill 1 only; skill k needs cd[k] == 0
 8  resolve the skill; then cd[k] = skill.cooldown        // cast on turn T with cooldown n → usable again on turn T+n
 9  if a is alive, wears VIOLENT, !extra and rng() < VIOLENT_CHANCE: takeTurn(a, extra = true)   // one fresh turn, never chains
10  recompute ready()
```

A status applied during the actor's own turn is first decremented at its next
turn, so a self-buff of duration 1 covers no own action — self-buffs are
authored at 2. Dead actors have no `atb`, are never targeted, never counter,
and take no ticks. `TURN_CAP = 200` actor turns per battle (VIOLENT extras
count): reaching it is a loss reported as a stall, and a stall rate above
0.5 % of battles is a rules bug, not a balance number.

### Skills

Each character has exactly three. **Skill 1 has no cooldown** and is the
default action; skills 2 and 3 cost 2–5 turns of cooldown. There is no MP —
cooldowns are the whole resource system. Enemies draw from the same table.

```ts
interface SkillDef {
  id: SkillId;             // closed union in types.ts
  name: string;            // <= 14 chars
  cooldown: number;        // 0 for skill 1, 2..5 otherwise
  mult: number;            // per hit (0 for a pure heal or buff)
  hits: number;            // 0 for a pure heal or buff
  scale: 'ATK' | 'DEF' | 'HP' | 'SPD';   // what the damage is a multiple of; HP reads MAX HP
  kind: DamageKind;        // what the target's resist blunts
  target: TargetSpec;      // relative to the caster
  applies?: StatusApply[]; // one roll per hit per surviving target (once per target when hits = 0)
  heal?: number;           // fraction of the CASTER's max HP, given to each target
  leech?: number;          // fraction of total damage dealt returned to the caster, once per skill
  atbBoost?: number;       // fraction of ATB_TURN granted to each target (or stripped, if negative)
  verb: string;            // battle log: HERO <verb> ENEMY FOR n!
}
```

DEF-, HP- and SPD-scaling skills are what make a tank or a speedster a damage
dealer rather than a passenger, and they are the reason those stats stay
interesting after the first act. `chance` conventions: a skill's primary
debuff 0.75, a secondary or AoE debuff 0.50; buffs, heals and self-effects
never roll. `LOWEST_HP_ALLY` = living allies including self, lowest
`hp / maxHp`, tie → lowest slot. `ALL_*` targets are snapshotted when the
action starts; a target that dies mid-skill takes nothing further and draws no
rng. Positive `atbBoost` is unconditional; negative `atbBoost` on an enemy is
a debuff-class effect (IMMUNITY blocks it, it rolls at chance 1.0 through the
landing formula, once per target after the hits, floored at 0).

### Status effects

Durations count the **affected actor's** turns, so a slow actor genuinely
suffers longer under a debuff — another reason SPD matters. Magnitudes are
constants, never stacked: one instance per kind per actor, a re-application
sets `turns = max(remaining, new)` and, for SHIELD, `pool = max(remaining,
new)`. A buff and its break coexist and both apply (ATK_UP + ATK_BREAK =
×1.0). IMMUNITY blocks new debuffs and strips nothing.

| Debuff | Effect | Turns | | Buff | Effect | Turns |
|---|---|---|---|---|---|---|
| STUN | skips the turn | 1 | | ATK_UP | +50 % ATK | 2 |
| DEF_BREAK | −70 % DEF | 2 | | DEF_UP | +70 % DEF | 2 |
| ATK_BREAK | −50 % ATK | 2 | | SPD_UP | +30 % SPD | 2 |
| SLOW | −30 % SPD | 2 | | CRIT_UP | +30 pts CRIT | 2 |
| BURN | `BURN_FRACTION = 0.05` of max HP per turn, true damage, capped at `BURN_CAP_ATK = 2.0` × applier ATK | 2 | | SHIELD | absorbs `pool` damage, then expires | 2 or until broken |
| HEAL_BLOCK | heals, leech and VAMPIRE do nothing | 2 | | IMMUNITY | blocks all incoming debuffs | 1 |
| BRAND | +25 % damage taken | 2 | | COUNTER | REVENGE at 100 % (see *Sets*) | 2 |
| SILENCE | skills 2 and 3 unusable | 2 | | INVINCIBLE | takes no HP loss of any kind; **enemy-only** (boss phases) | 1 |

Stat statuses modify the stat where it is read: ATK_UP/ATK_BREAK the ATK
stat (so they touch ATK-scaling skills only), DEF_UP/DEF_BREAK the defender's
DEF before the curve (a DEF-scaler under DEF_UP hits harder — intended),
SPD_UP/SLOW `spdEff`, CRIT_UP the crit roll. BRAND is the only defender-side
damage multiplier. BURN ignores DEF, element and crit, is absorbed by SHIELD,
zeroed by INVINCIBLE, triggers no counter, and is lethal. Every status in the
table has a named source in the launch roster or the act 1–2 enemy pool by
the end of phase 5; a status with no source is cut, not kept for later.

Landing is an ACC/RES check, floored so nothing is ever impossible:

```
p = clamp(apply.chance + (attacker.acc − defender.res) / 100, STATUS_MIN_CHANCE = 0.15, 1.0)
```

IMMUNITY blocks outright, before the roll; applications on allies or self skip
the check; a chance of 1.0 is still resistible (RES 50 vs ACC 0 → 0.5); no rng
is drawn when a roll is impossible.

### Damage

Per hit, on each living target, in this order:

```
raw    = statEff(attacker, skill.scale) × skill.mult
raw   ×= ELEMENT_MULT[matchup]
crit   = rng() × 100 < clamp(critPts(attacker) + ELEMENT_CRIT[matchup], 0, CAP_CRIT)      // rolled per hit
raw   ×= crit ? 1 + cdmg / 100 : 1
raw   ×= target.has(BRAND) ? 1.25 : 1
defEff = statEff(target, 'DEF')                                                            // DEF_UP + DEF_BREAK cancel
dealt  = raw × (1 − defEff / (defEff + DEF_K)) × (1 − target.resist[skill.kind] / 100)   // resist in points, heroes 0
dealt  = target.has(INVINCIBLE) ? 0 : max(1, round(dealt))
absorb = min(dealt, target.shieldPool); shield −= absorb; hp −= dealt − absorb           // SHIELD removed at 0
```

`DAMAGE_JITTER = 0`: v2's 0.9–1.1 roll is retired, crit-per-hit is the
variance, and no rng is drawn for it. All derived stats, shields, heals and
per-hit damage are integers via `round`; `atb` is a float. Heals give
`round(caster.maxHp × heal)` to each target, capped at missing HP; `leech` and
VAMPIRE heal once per skill from the summed damage of every hit and target.
No skill revives.

### Enemies

Enemies are actors like any other: the same eight stats, an element, one to
three skills from SKILLS, and a decision rule that is a rule, not
presentation, so the simulator can run them.

```ts
interface EnemyDef {
  id: string; name: string;                 // <= 16 chars
  kind: 'NORMAL' | 'ELITE' | 'BOSS';
  element: Element;
  base: { hp: number; atk: number; def: number; spd: number };   // act 1, A0, before ACT_MULT
  pts?: Partial<Pick<Stats, 'CRIT' | 'CDMG' | 'ACC' | 'RES'>>;    // default: the character baselines
  resist: Record<DamageKind, number>;       // 0..40 pts
  skills: SkillId[];                        // 1..3; a 4th exists only for the ascension modifier that grants it
  ai: 'SPREAD' | 'FOCUS';                   // target rule for ENEMY skills
  support?: boolean;                        // heals, buffs or shields its pack
}
```

**AI.** Skill: the highest-index skill whose cooldown is 0 (skill 1 under
SILENCE). Target: `SPREAD` draws uniformly among living heroes (always one
draw, even with one candidate, so rng consumption is stable); `FOCUS` takes
the lowest `hp / maxHp`, tie → lowest slot. ALLY-side skills use the hero
rules. `intent(enemy)` — the skill this rule will pick at its next turn given
the cooldown tick that turn — is shown in the turn ribbon, so a STUN, SLOW or
strip always has a visible target; the target is not telegraphed.

**Packs.** Each biome authors its packs as data (`fights: EnemyId[][]`,
`elites: EnemyId[][]`, `boss`); a room draws one uniformly. Packs are 1–3
wide, every pack of three carries one `support`, and a pack never outnumbers
the party by more than one (a solo hero meets ≤ 2, two heroes ≤ 3). Elites
bring one normal from act 3. Bosses fight alone and carry one AoE skill.

**Scale.** The NORMAL row is authored per act; ELITE and BOSS derive from it.

| Act | NORMAL hp / atk / def / spd | ELITE (hp ×2.5, atk ×1.35, def ×1.25, spd +5) | BOSS (hp authored, atk ×1.7, def ×1.6, spd +10) |
|---|---|---|---|
| 1 | 1250 / 300 / 150 / 95 | 3125 / 405 / 188 / 100 | 4700 / 510 / 240 / 105 |
| 2 | 1450 / 360 / 190 / 98 | 3625 / 485 / 238 / 103 | 5800 / 610 / 304 / 108 |
| 3 | 1750 / 470 / 240 / 101 | 4375 / 635 / 300 / 106 | 8000 / 800 / 384 / 111 |
| 4 | 2050 / 600 / 300 / 104 | 5125 / 810 / 375 / 109 | 10000 / 1020 / 480 / 114 |
| 5 | 2350 / 720 / 370 / 107 | 5875 / 970 / 463 / 112 | 12000 / 1225 / 592 / 117 |
| 6 | 2700 / 850 / 450 / 110 | 6750 / 1150 / 563 / 115 | 14000 / 1445 / 720 / 120 |

`ACT_MULT = { hp: [1, 1.16, 1.40, 1.64, 1.88, 2.16], atk: [1, 1.20, 1.57,
2.00, 2.40, 2.83], def: [1, 1.27, 1.60, 2.00, 2.47, 3.00], spd: +3 per act }`
— HP grows slower than ATK because enemy DEF ×3 already eats hero damage
growth, while enemy ATK outpaces hero effective-HP growth so pressure rises.
`CLEAR_GROWTH = 0.03` per clear within an act. `LAP_MULT = { hp 1.5, atk 1.5,
def 1.2, spd +5 }` per lap, compounding, on top of ascension. Enemy RES is
`15 + 3 × (act − 1)`, elites +10, bosses +20, before ascension — a tome's
ACC main doubles a boss landing chance at A0 and is mandatory from A5, which
is the stated intent made numerical. The arithmetic behind the table: the
expected-gear party kills an act-1 normal in ≈ 4.6 skill-1 actions and dies
in ≈ 13 hits; an act-6 boss is a 28–37-action fight; a lap-2 act-6 boss ≈ 46.

**Biomes.** Each has a dominant element (two thirds of its pool) and a foil;
bosses alternate DARK and LIGHT.

| Act | Biome (≤ 12) | Dominant | Foil | Boss |
|---|---|---|---|---|
| 1 | EMBER CRYPT | FIRE | WIND | DARK |
| 2 | FROST MARSH | WATER | FIRE | LIGHT |
| 3 | SKY RUINS | WIND | WATER | DARK |
| 4 | ASHEN FORGE | FIRE | WATER | LIGHT |
| 5 | SUNKEN VAULT | WATER | WIND | DARK |
| 6 | STORM SPIRE | WIND | FIRE | LIGHT |

### Between battles

Cooldowns reset to 0 and every status and shield clears at battle end; HP
persists. A won battle restores `CLEAR_HEAL = 0.20` of max HP to every living
hero, entering a BOSS restores `BOSS_ENTRY_HEAL = 0.50`. A hero at 0 HP is
out for the rest of the battle and returns at `KO_RETURN = 0.30` of max HP
if the party wins; the run ends only when every member is down. Statuses
never persist outside battle.

## Relics

Each member has six slots, one relic each, no inventory — a new relic
**replaces** the slot's current one. A relic card is for a slot, not a hero:
taking it asks **who wears it**, and the equip screen shows the three
candidates' current pieces side by side with a compare line ("SPD 112 → 131",
"BREAKS SWIFT 2-SET"). Relics can be moved or swapped between members on the
party screen outside battle. Rarity COMMON / RARE / EPIC / LEGENDARY.

Every relic is **rolled, not authored**: a main stat fixed or chosen by its
slot, one to four substats drawn from a pool, a set from the run's pool, and a
level. Its title is `<SET> +<level>` (≤ 11 chars); the slot is an icon.

### Main stat by slot

| Slot | Position | Main stat (bold = signature, weight `MAIN_WEIGHT_SIGNATURE = 2`, others 1) |
|---|---|---|
| WEAPON | 1 | flat ATK — fixed |
| BOOTS | 2 | **SPD** \| ATK % \| HP % \| DEF % |
| ARMOR | 3 | flat HP — fixed |
| NECKLACE | 4 | **CRIT** \| **CDMG** \| ATK % \| HP % \| DEF % |
| CHALICE | 5 | flat DEF — fixed |
| TOME | 6 | **RES** \| **ACC** \| ATK % \| HP % \| DEF % |

The restriction is the whole point: SPD exists only on boots, crit only on the
necklace, accuracy and resistance only on the tome. A build that wants speed
*and* crit *and* accuracy has to spend three specific slots on them, and the
odd slots are never negotiable. The bold main is the default, not the answer:
the % main is right for the character whose kit scales off it, and phase 8
verifies that on each open slot at least two mains appear in winning policy
lines.

`main = round(base × (1 + MAIN_PER_LEVEL × level))`, `MAIN_PER_LEVEL = 0.15`
(+6 → ×1.90). `RELIC_MAIN_BASE`: WEAPON ATK 36 · ARMOR HP 450 · CHALICE DEF
36 · BOOTS SPD 10 · ATK % / HP % / DEF % 16 · CRIT 12 · CDMG 22 · ACC / RES
16. Rarity never changes the base — it buys substats and a sigil — except
that LEGENDARY mains are multiplied by `LEGENDARY_MAIN_MULT = 1.2`, so a
LEGENDARY at its +4 cap (×1.92) matches an EPIC at +6 and its edge is
front-loaded. Boots SPD and boots ATK % came out within 4 % damage-per-time
of each other with these bases; CRIT and CDMG within 2 % — real choices.

### Substats

Pool: flat HP, HP %, flat ATK, ATK %, flat DEF, DEF %, SPD, CRIT, CDMG, RES,
ACC. A substat never duplicates the main stat or another substat (flat and %
of the same stat are distinct keys).

Starting count by rarity: COMMON 1 · RARE 2 · EPIC 3 · LEGENDARY 4. Maximum 4.

Levels run **+0 to +6** (LEGENDARY stops at +4). At **+2, +4 and +6** the
relic either gains a new substat, if it has fewer than four, or upgrades one
existing substat — chosen uniformly by `rng` — by **adding** a fresh roll
(`value += roll; rolls += 1`). Up to three roll events per relic, not fifteen
— rescaled for a run rather than a year of farming.

Roll ranges are inclusive integers, identical at every level:

| Substat | Range | Note |
|---|---|---|
| ATK % / HP % / DEF % | 4–8 | |
| RES / ACC | 4–8 | points |
| CRIT / CDMG | 3–5 | points; the crit factor was the runaway term |
| SPD | 4–6 | the doc wants speed to win |
| flat HP | 90–180 | a flat roll ≈ 0.7 × the % roll at the mid base |
| flat ATK | 7–13 | flats win only on low-base heroes |
| flat DEF | 6–12 | |

**Levels come from three places.** Drops arrive **pre-levelled by act**, roll
events already applied: `DROP_LEVEL = [[0,1], [0,2], [1,3], [2,4], [3,5],
[4,6]]` uniform per act, ELITE and BOSS cards one step higher, LEGENDARY
clamped to 4. FORGE adds +2 (one roll event per threshold crossed, never past
the cap); REST's *sharpen* adds +1. An act-5 EPIC at +4 plus one FORGE
kindles, which puts one or two kindlings in a typical run — the intent.
Vault relics keep their level, which is what makes them worth banking.

### Sigils and kindling

COMMON and RARE relics are pure numbers. **EPIC and LEGENDARY carry one
authored sigil** — this is where v2's unique items survive, and the place a
relic stops being a spreadsheet row. Every sigil reads the ATB, cooldown or
status systems, never a bare stat, and a card shows it as a blurb ≤ 30 chars.
At **+6** an EPIC relic is **kindled**: the sigil is replaced by an authored
variant that changes how it plays, not merely how hard it hits, and the
kindled blurb must differ. LEGENDARY relics cap at +4 and never kindle,
exactly as in v2. Twelve at launch, two per slot, uniform within the slot:

| Slot | Sigil (blurb) | Kindled (+6) |
|---|---|---|
| WEAPON | OPENER: first skill each battle ignores its cooldown | …and grants +30 % ATB |
| WEAPON | RENDER: crits strip 10 % of the target's ATB | …and extend one debuff on it by 1 turn |
| BOOTS | SURGE: on kill, +50 % ATB | …+25 % to every ally too |
| BOOTS | TRIP: SLOW you land also strips 15 % ATB | …STUN you land strips 100 % |
| ARMOR | BASTION: shields on you are 50 % larger | …and cleanse one debuff when applied |
| ARMOR | THORNS: COUNTER while DEF_UP is active | …counters apply DEF_BREAK |
| NECKLACE | SPARK: crits shorten your longest cooldown by 1 | …every cooldown |
| NECKLACE | BLOODLUST: +5 pts CRIT per debuff on the target | …+8 |
| CHALICE | MENDING: your heals also cleanse one debuff | …and grant 10 % ATB |
| CHALICE | GRUDGE: taking a hit below 50 % HP grants ATK_UP 1 turn | …and SHIELD 15 % |
| TOME | LOCKDOWN: debuffs you land last +1 turn | …and ignore RES (IMMUNITY still blocks) |
| TOME | ECHO: skill 3 cooldown −1 | …skills 2 and 3 |

`type SigilEffect` is a closed union with one kind per row above and a
parameter per number; `SigilDef = { id; slot; blurb; effect; kindled?: {
blurb; effect } }`. A boss's first card is always an EPIC of a pool set —
a reason to want the boss, as in v2.

### Sets

Every relic belongs to a set. Two-piece sets need two relics, four-piece sets
need four, and six slots means one 4-set plus one 2-set, or three 2-sets.
Sixteen sets are authored; **each run rolls a set pool** of four at run start
(`SET_POOL = { four: 2, two: 2 }`), plus the set of every Vault relic worn,
and every relic in the run rolls its set uniformly from the pool. With
sixteen sets rolled flat, a 4-set is possible in ≈ 12 % of runs; with the pool
it is ≈ 95 %, and the draft is made knowing which builds are on the table.

| 2-piece | Bonus | | 4-piece | Bonus |
|---|---|---|---|---|
| FATAL | +15 % ATK | | VIOLENT | `VIOLENT_CHANCE = 0.22` of an extra turn, never chaining |
| ENERGY | +15 % HP | | DESPAIR | `DESPAIR_CHANCE = 0.25` per hit to STUN (1 turn), then the landing roll at chance 1.0 |
| GUARD | +15 % DEF | | VAMPIRE | heal `VAMPIRE_FRACTION = 0.35` of damage dealt, once per skill |
| SWIFT | +25 % SPD | | WILL | IMMUNITY for `WILL_TURNS = 2` at battle start, and +20 RES |
| BLADE | +12 pts CRIT | | NEMESIS | `NEMESIS_ATB = 0.10` of ATB_TURN per hit that reduces HP (not shielded, not BURN) |
| RAGE | +40 % CDMG | | REVENGE | `REVENGE_CHANCE = 0.25` to counterattack |
| FOCUS | +20 ACC | | BULWARK | party SHIELD of `BULWARK_SHIELD = 0.20` max HP at battle start, 3 turns |
| ENDURE | +20 RES | | DESTROY | each hit also strips `min(DESTROY_DEALT = 0.30 × dealt, DESTROY_FRACTION = 0.04 × maxHp)` from max HP, never below `DESTROY_FLOOR = 0.40` of the original |

A 2-piece bonus applies `floor(n / 2)` times (three FATAL pairs = +45 % ATK);
a 4-piece applies once; bonuses are wearer-only except BULWARK. A
**counter** (REVENGE, or COUNTER status at 100 %) is the counterer's skill 1
at `COUNTER_MULT = 0.75` on the attacker, single-target whatever skill 1's
spec says, with full per-hit resolution; it fires at most once per enemy
*skill*, after that skill's hits and boosts resolve, if both are alive and
the counterer is not stunned; a shielded or INVINCIBLE hit still counts as
hit; BURN, DESTROY and counters themselves never trigger one. A counter is
not a turn: no carry, no ticks, no VIOLENT roll. `type SetBonus` is a closed
union with one kind per row.

VIOLENT and NEMESIS only mean anything because turn order is an attack bar;
DESPAIR only means anything because of the ACC/RES check. The sets are what
turn two separate systems into one build. Four-piece bonuses must beat three
two-piece bonuses by a clear margin or 2+2+2 stays dominant: phase 8 measures
that with 2+2+2 as the baseline.

## Characters

```ts
interface CharacterDef {
  id: string;
  name: string;              // <= 16 chars
  element: Element;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: [SkillId, SkillId, SkillId];
  awakening: { name: string; bonus?: Partial<Stats> } | { name: string; upgrades: { slot: 0 | 1 | 2; to: SkillId } };
  leader: LeaderSkill;
}
```

Six at launch, growing toward twelve. Each is a distinct answer to "what does
this team lack". Numbers are phase 8's; kits are the contract.

| Name | El. | Role | Skill 1 / 2 (cd) / 3 (cd) | Awakening | Leader |
|---|---|---|---|---|---|
| EMBER | FIRE | AoE burner | Cinder ATK ×1.0 / Flare ALL_ENEMIES ×0.7 + BURN 0.50 (3) / Inferno ALL_ENEMIES ×1.4, 2 hits (5) | Inferno also BRANDs (0.75) | ATK +20 %, FIRE +35 % |
| GALE | WIND | speed stripper | Gust ATK ×0.9, −15 % ATB / Squall 2 hits + SLOW 0.60 (3) / Tailwind ALL_ALLIES +30 % ATB (4) | Gust strips 30 % | SPD +15 %, WIND +25 % |
| TIDE | WATER | healer | Ripple ATK ×0.9, leech 0.20 / Tidepool LOWEST_HP_ALLY heal 0.25 (3) / Undertow ALL_ALLIES heal 0.15 + cleanse (5) | Undertow also grants IMMUNITY 1 | HP +20 %, WATER +30 % |
| BASALT | FIRE | DEF wall | Bash DEF ×1.2 / Bulwark SELF DEF_UP + COUNTER (3) / Quake ALL_ENEMIES DEF ×1.0 + DEF_BREAK 0.50 (5) | Bulwark shields the party 0.20 | DEF +25 % |
| SABLE | DARK | ACC debuffer | Hex ATK ×0.8 + ATK_BREAK 0.75 / Mire ALL_ENEMIES SLOW + HEAL_BLOCK 0.50 (3) / Eclipse ATK ×1.2 + STUN 0.75 + SILENCE 0.75 (5) | +25 pts ACC | ACC +20 |
| LUMEN | LIGHT | crit sniper | Lance ATK ×1.4 / Radiance SELF CRIT_UP + ATK_UP (3) / Judgement ATK ×3.5, ×1.5 vs DEF_BREAK (5) | +15 pts CRIT | CRIT +15 |

One of skills 2–3 per character is situational (Tailwind, Bulwark, Radiance,
Mire), which is what keeps a turn from collapsing into "fire whatever is off
cooldown". Two FIRE characters exist so a partial mono party is a middle
ground, not nothing.

**Awakening** happens once per lap, at the ALTAR in act 3: the character
gains a permanent stat bonus or an upgraded skill. Which of the three party
members to awaken is a real decision; on later laps the ALTAR offers only
un-awakened members and is a FORGE when none remain.

**Leader skills**: the party has three members but only the **leader's** skill
applies. Choosing the leader is choosing between a character's own kit and the
team-wide bonus they bring, and the choice reopens on the party screen any
time outside battle. A leader who falls mid-battle keeps the bonus alive for
that battle.

### Building a party

You draft **one** character at run start from the unlocked roster — your
starting leader, who also wears the Vault relics. Slots two and three are
filled during the run at **SUMMON** rooms, each offering three distinct
characters not in the party. Acts 1 and 2 each contain a SUMMON on every
path, so the party is three by the act-1 boss and the targets are measured
that way. A SUMMON with a full party offers one EPIC relic of a pool set
**or** a swap: the newcomer replaces a member and inherits that member's
relics — trade the healer for the sniper before act 5, a decision rather than
a consolation.

## Run structure

Six acts, then laps. Room types: FIGHT, ELITE, REST, LOOT, **SHRINE**,
**FORGE**, **SUMMON**, **ALTAR** (act 3 only), BOSS.

### The map

`game/sim/run.ts` is the only generator; the map screen consumes it.
`buildMap(act, ascension, party, rng)` lays out `STAGE_SIZES = [2, 3, 1, 3,
2]` — five stages, then the BOSS. The single node of stage 3 is the act's
**landmark**, on every path: act 1 SUMMON, act 2 SUMMON, act 3 ALTAR, act 4
FORGE, act 5 SHRINE, act 6 REST. Every other node rolls from `ROOM_WEIGHTS =
{ FIGHT 46, ELITE 16, LOOT 12, REST 10, FORGE 8, SHRINE 5, SUMMON 3 }`, then
the guarantees apply: stage 1 is never ELITE; each act has at least one REST
and one LOOT among its rolled nodes (a FIGHT is converted, the LOOT placed as
the REST's sibling so rest-or-loot is forced at least once); a REST never
links straight into a REST. Links: each node reaches a contiguous span of 1–2
successors (two 85 % of the time), spans overlap a neighbour by at most one,
every successor is reachable — v2's monotone partition. Expected clears: ≈ 3.5
per act, ≈ 21 per full lap (≈ 15 fights, 6 bosses); a run that dies in act 4
sees about twelve.

| Room | What it offers |
|---|---|
| FIGHT | a pack; a relic card on `FIGHT_DROP_CHANCE = 0.5`, forced after `PITY_AFTER = 2` dry fights |
| ELITE | an elite pack, three relic cards |
| REST | full party heal, **or** sharpen — +1 level on one relic |
| LOOT | two relic cards, no fight |
| SHRINE | one pact offered: accept its curse to gain its boon, both for the rest of the run, or walk past |
| FORGE | one relic: +2 levels, **or** reroll one substat's value (same stat, `rolls` fresh rolls), **or** rebrand it to another pool set keeping its rolls |
| SUMMON | recruit one of three, or the EPIC / swap when the party is full |
| ALTAR | awaken one party member |
| BOSS | one per act; three cards, the first an EPIC, pick one |

Every card screen may be declined: declining mends the party `SKIP_MEND =
0.15` of max HP. Cards per source `LOOT_COUNT = { FIGHT 1, ELITE 3, LOOT 2,
BOSS 3, SUMMON 1 }`; rarity rolls from `LOOT_WEIGHTS` (COMMON / RARE / EPIC /
LEGENDARY, one row per act): FIGHT 70/25/5/0 · 60/30/9/1 · 50/35/13/2 ·
40/40/17/3 · 30/42/23/5 · 20/42/30/8; ELITE and LOOT 35/45/17/3 · 28/44/23/5
· 21/42/29/8 · 15/40/35/10 · 10/38/40/12 · 5/35/45/15; BOSS 0/40/45/15 ·
0/33/47/20 · 0/27/48/25 · 0/20/50/30 · 0/15/50/35 · 0/10/50/40. Laps reuse
the act-6 row. A run sees ≈ 21 relics for 18 slots.

**Pacts** (`PACTS`, closed `Modifier` union, stack across the run; a SHRINE
never offers a pact already taken):

| Curse (rest of run) | Boon (rest of run) |
|---|---|
| enemies +20 % SPD | +1 card on every relic screen |
| REST heals 50 % | party ATK +15 % |
| bosses IMMUNE until their first turn ends | every EPIC drops +2 |
| party RES −20 | party ACC +25 |
| leader skill off | every SUMMON offers four |
| every relic screen shows one fewer card | FORGE gives +4 |

**Score**: `score += ROOM_SCORE[type] × actNumber × (1 + 0.5 × ascension)`
per clear, `ROOM_SCORE = { FIGHT 10, ELITE 25, BOSS 100 }`, `actNumber`
continuing through laps (lap 2 act 1 is 7). Shown on the victory and death
screens, posted via `scoreChanged`, never lost on death.

### Laps — the endless mode

Beating the act 6 boss ends the run **only if you want it to**. The victory
screen offers two doors:

- **DESCEND** — bank your relics, take the win, end the run.
- **ANOTHER LAP** — keep everything (party, HP, relics, awakenings), the map
  resets to act 1 with every enemy under `LAP_MULT` (compounding per lap, on
  top of the run's ascension), and the score keeps climbing.

This is the endless mode and the New Game+ in one mechanic. Banking happens
**only at DESCEND**: after lap *n* it banks `BANK_WIN + n` relics (2, then 3,
then 4 — the Vault cap still holds), while a death anywhere banks
`BANK_DEATH = 1`. The second door reads "take 2 now, or bet them for 3". The
ascension unlock (A+1) is granted at the run's first act-6 kill, before the
door.

### Ascension

A0 through A10, one unlocked per win, chosen at run start up to the highest
unlocked. Each level adds its row to every row above it; `ASCENSION` in
`game/data/ascension.ts` holds the eleven cumulative records.

| A | Adds |
|---|---|
| 1 | enemy HP +10 %, ATK +10 % — and again at every level after (A10 = +100 %) |
| 2 | enemy RES +5 per level from here (A10 = +45): ACC becomes mandatory around A5 |
| 3 | no REST guarantee — REST only by roll |
| 4 | the top of every substat range −1 |
| 5 | bosses gain their fourth skill |
| 6 | REST weight halved |
| 7 | enemy SPD +8 % |
| 8 | elite packs +1 |
| 9 | bosses open with their strongest skill |
| 10 | bosses get WILL |

Checked against the median act-6 party: an act-6 normal takes 7.8 actions
at A0, 10.1 at A3, 15.6 at A10; the boss 37, 48, 75. A10 needs a focused
party to feel like A0, which is the ladder's job.

### The Vault — progress across runs

Permadeath keeps its teeth. What survives a run is a **trickle you choose**,
not an inventory.

- On a **win** you bank `BANK_WIN = 2` relics (more after laps). On a
  **death**, `BANK_DEATH = 1`. Banked relics keep level, sigil and kindling.
- At the next run's start you may equip up to `min(VAULT_EQUIP_MAX = 3, acts
  cleared last run)` relics from the Vault onto your starter (lap acts
  count); withdrawing removes a relic from the Vault.
- The Vault holds `VAULT_SIZE = 12`. Past that, banking means choosing what to
  drop before the run can end.

So a good run pays forward, a disastrous one still pays a little, and the
ascension ladder rises to meet the accumulated power: three kindled Vault
relics make act 1 trivial (it is ≥ 80 % anyway) and change nothing about
act 6, where the A-multiplier persists and the Vault's edge has been matched
or replaced. Farming exists — it is just measured in runs rather than hours.

The Vault, the highest ascension won and the roster are `RunConfig` inputs
and `RunResult.banked` outputs; `screens/vault.ts` persists them under one
`localStorage` key. All six launch characters are unlocked.

## Difficulty targets (balance sim)

**How the targets are measured.** `npm run sim` = 2000 runs per policy, seed
1, A0, empty Vault, full roster (5000 for a recorded Balance state). "Act N
clear" = act-N boss killed, as a fraction of all runs on the `balanced`
policy; the ladder is **act 1 ≥ 80 % · act 2 ≈ 57 % · act 3 ≈ 41 % · act 4 ≈
29 % · act 5 ≈ 21 % · act 6 ≈ 15 %** (a smooth 0.72 survival per act after
act 1). **Lap 2 clear ≈ 8 %** of runs that took ANOTHER LAP, on `lapper`. A
random-draft, random-pick, random-target policy must win < 3 %.

Speed matters more than raw power: the harness runs `balanced` at `--spd +10`
and `--spd −10` (a flat delta on every hero's base SPD, identical seeds) and
the fast party must clear act 3 at least 20 points more often than the slow
one. If it does not, the SPD base range, the SPD substat range or SWIFT's
25 % is wrong.

Every 4-piece set must appear in at least one winning policy line: ≥ 5 % of
some policy's wins end with it complete. A set no policy ever wants is a set
that needs rewriting, not renumbering.

**Every choice is a Policy method.** `main.ts` never calls one; the harness
always does. Each method receives the enumerated options and `rng` and
returns an index (or `null` where declining is legal); an out-of-range answer
is clamped to option 0. `POLICIES.random` answers every method uniformly —
that is the definition of the < 3 % floor.

```ts
interface Policy {
  draft(roster, rng): number;                 leader(party, rng): number;
  route(offered: RoomType[], run, rng): number;
  act(battle, actor, options: { skill: number; target: number }[], rng): number;
  relic(cards, party, rng): { card: number; onto: number } | null;
  summon(offers, party, rng): number | { swap: number; out: number } | null;
  forge(worn, rng): { relic: number; mode: 'LEVEL' | 'REROLL' | 'REBRAND'; substat?: number; set?: SetId };
  shrine(pact, run, rng): boolean;            altar(party, rng): number;
  rest(run, rng): 'HEAL' | { sharpen: number };
  lap(run, rng): 'DESCEND' | 'LAP';
  bank(worn, n, vault, rng): { take: number[]; drop: number[] };
  vaultEquip(vault, slots, starter, rng): number[];
}
```

Policy roster: **random** · **balanced** (biggest compare-line delta per
card, damage-greedy `act`, heals under 40 %, DESCEND) · **speed** (SPD boots,
SWIFT/VIOLENT, GALE leader, strips first) · **glass** (ATK %/CRIT/CDMG mains,
FATAL/RAGE/BLADE/DESTROY, lowest-HP target) · **tank** (HP/DEF mains,
GUARD/ENERGY, BULWARK/WILL/REVENGE) · **control** (ACC tome, FOCUS/DESPAIR,
opens with breaks) · **mono** (one element, elemental leader) · **lapper**
(`balanced` that takes the lap). `RunResult` reports `won`, `actReached`,
`lap`, `ascension`, `clears`, `deathBy`, `deathKind` (incl. `STALL`),
`party`, `leader`, `awakened`, `setsWorn` per hero, `relicLevels`,
`banked`, `rooms`, `turnsPerBattle` and one `Probe` per boss (`act`, `lap`,
`won`, `actorTurns`, `partySpd`, `bossSpd`, `outSped`, `bossHp`, `dmgDealt`,
`ttk`, `hitsTaken`, `hitFrac`, `stunsLanded`, `debuffsResisted`). Phase 2
ships `simulateBattle(party, enemies, policy, rng)` and a `--battles` mode
over fixture parties, so the simulator has something to run before phase 6.

## Presentation

### Canvas and scale

**1280×720 logical, landscape.** The backing store is ×1 on phones and ×1
on desktop, ×2 when `devicePixelRatio ≥ 1.5` and the fitted CSS width is at
least 1280 — never ×1.5, which would put an art pixel on 4.5 device pixels.
The canvas is fitted by CSS (letterboxed `aspect-ratio: 16 / 9`, never its
intrinsic size) with `image-rendering: auto`: crispness comes from the
integer ×3 *inside* the frame, and the frame itself scales smooth, which is
the HD-2D look.

### HD-2D — hard pixels under soft light

The reference is Octopath Traveler. What makes that look is not the sprites;
it is everything around them. The frame is built in five passes:

1. **Diorama planes.** Background, midground, actor plane, foreground. Each
   parallaxes at its own rate, which is what gives a flat scene depth.
2. **Depth of field.** Background and foreground planes are blurred; the actor
   plane stays razor sharp. A sharp band through the middle of a soft frame is
   the single biggest contributor to the diorama read — more than the lighting.
3. **Chunky actors.** Sprite parts authored at `ACTOR_PART = 64` px
   (`BOSS_PART = 96`), drawn at `ACTOR_SCALE = 3` with
   `imageSmoothingEnabled = false`. Hard pixel edges are preserved **only**
   on this plane.
4. **Light at native resolution.** A per-biome key light as radial gradients,
   rim light along actor silhouettes, and embers, dust and fog as smooth
   high-resolution alpha particles — deliberately *not* pixelated. Composited
   with `'lighter'`.
5. **Colour grading.** Two cached full-frame fills: a `'multiply'` shadow
   tint that carries the vignette, and a `'screen'` highlight tint. The
   contrast curve is baked into the planes when the biome is built.

The governing rule is one line long: **exactly one plane is pixelated.**
Light, particles, fog, UI and text all render smooth at 720p. Imitations of
this style look cheap when they pixelate the *effects* too, because that stops
reading as an art direction and starts reading as low resolution.

**Budget.** One full-screen alpha pass at 720p is one FSE (0.92 Mpx); a 2022
mid-range phone affords 8–12 per frame at 60 Hz, and the literal reading of
the passes above plus the CRT is ≈ 17. So:

| Tier | Passes | FSE | Where |
|---|---|---|---|
| HIGH | planes 3 + actors + key light + particles + bloom (¼ res) + grading 2 + UI | ≈ 7.7 (9.7 in a flash) | desktop default |
| MED | as HIGH, no highlight tint, bloom at ⅛ res, fewer fog puffs | ≈ 6.1 | phone default |
| LOW | BG (key light baked in) + actors + particles + vignette + UI | ≈ 3.1 | auto after 60 consecutive frames > 20 ms; never rises |
| ARCADE | CRT halation + lift + scanlines on, bloom + grading off | ≈ 7 | the toggle |

Bloom and CRT halation are the same effect: exactly one is on. HD tiers run
`createCrt({ scanlineAlpha: 0, flicker: 0, halation: 0, lift: '' })`; the
full arcade treatment stays reachable as a toggle. Blurred planes are
pre-rendered **once per biome** into offscreen canvases (the background
opaque and oversized by the parallax amplitude, mid/foreground as ≤ 3
sub-rects) and redrawn each frame at a new offset; bloom runs through a
quarter-res offscreen allocated once (threshold by self-multiply, blur via
`ctx.filter` at 320×180 with a two-tap `drawImage` fallback where the filter
is unsupported) and is upscaled with smoothing on; key-light and grading
gradients are cached per biome and animated with alpha and translate only.
`getImageData` never runs in the frame loop. Nothing allocates per frame:
no canvases, gradients, arrays or closures.

This lands in `engine/light.ts` — key light, rim light, bloom, grading, DoF
planes — in phase 7a. `engine/crt.ts` is **kept**, not replaced.

### Layered actors

A character is a recipe, not a picture: body, head, torso, weapon, cape —
each an ASCII part from a shared library, each with **anchor points** so a
weapon stays in a hand across an animation. Animation is per-layer transform
keyframes stepped at `POSE_FPS = 12`, not redrawn frames; rotation is in 90°
steps so nothing lands off-grid. Element tint is a palette swap per layer at
bake time, and rim light is applied to the composed silhouette rather than
per part.

Cost is what makes this feasible: parts are baked once per (part, element)
into offscreen bitmaps; a pose is composed — rim light included — into a
per-actor offscreen only when its keyframe changes; the frame draws one
`drawImage` per actor at ×3. Text goes through a glyph atlas the same way.
`fillRect` per cell exists only at bake time.

Consequence: the eleventh character costs about eight lines, and five
elemental variants of anything are free. This is the only way a roster of
this size gets authored at all.

### Procedural VFX

Auras, projectiles, impact shockwaves, status glows, light shafts, boss
silhouettes and screen distortion are drawn with code at native resolution.
This is where "go wild" lands — smooth light over hard pixels. Screen
distortion is boss-intro only, in 8-px bands, never steady state; every
gradient is cached. Shake amplitudes scale with the frame (20–30 px for a
death), `DIM_BLEED = 40`.

### Input

**Native tap and keyboard, in parallel, always both.** Tap an enemy to target
it, a skill to cast it, a card to take it. `engine/input.ts` gains pointer
events mapped to logical pixels through `getBoundingClientRect()` (divide by
the CSS size, never `canvas.width`), primary pointer only, pointer capture on
down, a tap committed on release inside the region it began in, all pressed
state cleared on `pointercancel` and blur, and an immediate-mode hit-region
registry — a pooled array re-registered each frame — that suits a game
already re-rendering every frame. Audio unlocks on the first key **or** the
first tap.

Every tappable region also carries a **selection index**, so the whole game
remains playable on a keyboard: focus moves spatially with the arrows, A
activates. A screen that adds a tap target adds a keyboard route to it in the
same change, and the converse holds — PAUSE, BACK and inspect have on-screen
targets — because a phone has no keys. This is a hard rule: it is the thing
that rots first. `TAP_MIN = 96` logical px (44 CSS px at a phone's 0.5×),
`TAP_GAP = 12`; the registry expands any smaller hit rect around its centre
and warns in dev. Sprite bodies and panels register the same target id.

`index.html` loses the arcade bezel on small screens and gains `touch-action:
none`, `viewport-fit=cover`, `100dvh` sizing, a fullscreen request (and
`orientation.lock('landscape')`) on first tap where the API exists, an
"add to Home Screen for fullscreen" hint where it does not (iPhone), and a
rotate-to-landscape prompt.

### UI constraints

Logical screen 1280×720, font 7×11 (`FONT_HD`, mixed case) at scale 1 =
11 px ≈ 1 mm on a phone, so **nothing the player needs in battle renders
below scale 2**: `TEXT_POP 3` (crits 4) · `TEXT_LABEL 3` (skill labels, the
current actor, door and card titles) · `TEXT_BODY 2` (panel names, HP
numbers, the log, substats) · `TEXT_SMALL 1` is desktop-only decoration.
Limits at those scales: battle log line ≤ `LOG_LINE_MAX = 72` chars, character
names ≤ 16, skill names ≤ 14, relic set names ≤ 8, enemy names ≤ 16, biome
names ≤ 12, sigil and pact blurbs ≤ 30, relic titles ≤ 11. `SAFE_MARGIN =
24`, `SAFE_MARGIN_PHONE = 40` when the CSS scale is below 0.75; hit rects
may bleed into the margin, drawn panels may not.

The battle screen is staged on a **diagonal**, because three 192-px actors,
their icons and their gauges do not stack in the 512 px between a ribbon and
a skill bar. Heroes face right on a back→front diagonal at left-centre,
enemies mirrored; names live in the side panels, only gauges and a short
status row sit on the actor plane.

| Region | Geometry |
|---|---|
| turn ribbon | y 24–88: eight 48-px queue chips (display-only, not tappable) at left, current actor name at `TEXT_LABEL`, ACT/LAP and SCORE lines right, a 64-px PAUSE button (hit 96) far right |
| hero panels | x 24–304, three of `PANEL 280×104` at y 96/212/328: name, element chip, HP bar + numbers, ATB bar, the full six-icon status row; tap = ally target / inspect |
| stage | x 320–960: heroes at (408, 380) · (464, 448) · (520, 516) feet, `DIAG_DX 56 / DIAG_DY 68`; enemies mirrored about x 640; a boss at (816, 516) with `BOSS_PART` 96; HP 96×12 and ATB 96×6 under the feet on the outer side; ≤ `STATUS_ABOVE_MAX = 4` icons above the head (then 3 + "+N"); pops at head + 64 |
| enemy panels | x 976–1256, mirror of the hero panels; **tap = target**, the canonical enemy target |
| log | y 558–590, one line, scrolling |
| skill bar | three `SKILL 400×96` buttons at y 600, hit rects to the bottom edge: label at `TEXT_LABEL`, five cooldown pips, a key hint on desktop |

Column sums were checked: left 432 ≤ 558, stage 156–542, bottom 558 + 32 +
96 + 24 = 720, width 24 + 280 + 16 + 640 + 16 + 280 + 24 = 1280. Every
panel respects `SAFE_MARGIN`; relic and summon cards are 384×440 at x
40/448/856; the two victory doors are 520×200.

## Delivery phases

Each phase ends green — `check`, `build`, `smoke`, and `sim` where rules
moved — and updates CLAUDE.md's repo map and engine table and every skill
that names a moved file in the same milestone. v3 is built on a branch:
`main` keeps serving playable v2 until phase 4 lands, because phases 1
through 3 leave the game unplayable in between.

| # | Phase | Delivers |
|---|---|---|
| 0 | **Contract** | this document |
| 1 | **Engine upscale** | 1280×720 canvas fitted by CSS, `FONT_HD` with a glyph atlas, baked sprites, pointer input + hit regions with keyboard parity, CRT retuned, mobile shell. Rewrites `ensuring-arcade-visuals` and `handling-user-input`. |
| 2 | **Combat core** (headless) | types, stats, elements, ATB, the turn, cooldowns, statuses, ACC/RES, damage, 3v3 resolution, enemy AI, `simulateBattle`; SKILLS and ENEMIES for acts 1–2 with elements and packs. Simulator retargeted with a `--battles` mode. |
| 3 | **Relics** (headless) | rolling, substats, drop levels, forging, sharpening, sets and the set pool, sigils, derived stats, loot tables, `validateData`. |
| 4 | **Vertical slice** | layered actor pipeline with anchors, ATB gauges, the turn ribbon with intents, status icons, skill VFX, the diagonal stage — **plus the minimum to play it**: EMBER, GALE and TIDE as a fixed party (leader = slot 1), the EMBER CRYPT with its packs and boss, a linear five-room run (FIGHT · FIGHT · LOOT · FIGHT · BOSS) with the relic card and who-wears-it screens, title, GAME OVER and VICTORY, sfx, score and runtime messages. **The game is playable again here.** |
| 5 | **Roster and meta** | the other three characters, awakenings, the leader choice, SUMMON drafting and swaps, the party screen. |
| 6 | **Run structure** | the branching map, acts 2–6, SHRINE/FORGE/ALTAR/REST-sharpen, ascension, laps, the Vault with persistence. |
| 7a | **Diorama** | `engine/light.ts`: DoF planes, parallax, bloom, quality tiers. |
| 7b | **Light** | per-biome key light, rim light, grading. |
| 7c | **Spectacle** | boss intros, light shafts, screen distortion. |
| 8 | **Balance** | simulator retune against the targets above; the Balance state below rewritten and dated. |

Phases 2 and 3 are independent and can run in parallel; so can 5 and 6 once 4
lands; 7a–7c each ship alone.

## Balance state

Not yet measured — v3 has no numbers behind it. The v2 table is retired with
the v2 rules. This section gets rewritten at phase 8 and dated.

## Open questions

Decisions the review could not make for the owner. Each has a default written
into the contract above so the build never waits; overrule by editing the
rule, not this list.

1. **A fallen hero.** Default: out for the battle, back at `KO_RETURN = 0.30`
   after a win; the run ends on a wipe. Alternative: the fallen stay dead for
   the run, the party fights short-handed until a SUMMON, and REST's second
   option becomes "revive one". The alternative is the reading under which
   "permadeath keeps its teeth" bites hardest and it makes a 3v3 much harder
   to balance; recommended: keep the default until phase 8 has numbers.
2. **Element swing.** ×1.30 / ×0.75 with ±15 crit is a 2× swing one way and
   ≈ 4× both ways, so a mono party in its foil biome is a coin flip.
   Alternative: ×1.25 / ×0.80 with ±10 (1.7× / 2.9×). Recommended: keep the
   numbers, and soften only if the `mono` policy clears act 3 below 60 % of
   `balanced`.
3. **The Vault and ascension.** Default: ascension is the player's choice up
   to the highest unlocked. Alternative: every Vault relic worn raises the
   run's minimum ascension by one, so three god-rolls are a bet at A3 and the
   ladder rises to meet the Vault mechanically. Recommended: the alternative,
   once ascension exists to be tested.
4. **Dying on a lap.** Default: banks 1, like any death. Alternative: banks
   0, so the door is the whole bet. Recommended: 0 if lap-takers exceed 60 %
   of act-6 winners in the sim.
5. **Roster unlocks.** Default: all six unlocked at launch. Alternative: three
   at launch, one per win. The sim treats the roster as an input either way.
6. **Statuses on the map.** Default: none persist outside battle; REST's
   second option is sharpen. If the owner wanted lingering afflictions (a
   curse room, a bleed you carry), that is a new system, not a rule fix.
