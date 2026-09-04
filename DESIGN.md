# Ember Quest — systems design (v3: parties, relics, elements, laps)

A roguelike party battler. Three heroes against one to three enemies, turn
order driven by SPD on an attack bar, skills gated by cooldowns, gear that
rolls its own numbers. Permadeath per run; a thin thread of progress survives
in the Vault.

v3 replaces v2 wholesale. The 1v1 duel, MP, the MAG/MDEF/DODGE stats and the
240×160 canvas are all retired. What v2 got right and v3 keeps: six equipment
slots, four rarities, authored unique effects on the best gear, an awakening
that changes how an item *plays*, and a headless simulator that can Monte
Carlo the whole thing.

## Module layout (the contract lives in `game/types.ts`)

| File | Owns | May import |
|---|---|---|
| `game/types.ts` | shared types + tuning constants | nothing |
| `game/data/skills.ts` | SKILLS — every character and enemy skill | `../types` |
| `game/data/characters.ts` | CHARACTERS — roster, awakenings, leader skills | `../types`, `./skills` |
| `game/data/enemies.ts` | ENEMIES, BIOMES, ACT_MULT | `../types`, `./skills` |
| `game/data/relics.ts` | RELIC_BASES, MAIN_BY_SLOT, SUBSTAT_RANGES, LOOT_WEIGHTS | `../types` |
| `game/data/sets.ts` | SETS — 2-piece and 4-piece bonuses | `../types` |
| `game/sim/battle.ts` | ATB, turn resolution, damage, statuses | `../types`, `../data/*` |
| `game/sim/relics.ts` | rolling, upgrading, set detection, derived stats | `../types`, `../data/*` |
| `game/sim/run.ts` | map, rooms, loot, laps, ascension, policies | everything in `sim/` |
| `game/art/parts.ts` | the layered sprite part library + anchors | `../../engine` |
| `game/art/actors.ts` | character and enemy recipes, animation rigs | `./parts` |
| `game/art/vfx.ts` | procedural effects: auras, projectiles, impacts | `../../engine` |
| `game/screens/*.ts` | one file per screen | everything |
| `game/main.ts` | boot, loop, scene routing, input dispatch | everything |

Everything under `game/data/` and `game/sim/` is **headless** — no engine, no
DOM — so `esbuild game/sim/run.ts --bundle` still produces a runnable
simulator. This is the boundary that makes balance possible; it does not move.

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
| CRIT | % | chance to crit |
| CDMG | % | crit damage bonus |
| ACC | % | chance to land status effects |
| RES | % | chance to resist them |

Baselines for every character: CRIT 15, CDMG 50, ACC 0, RES 15. HP, ATK, DEF
and SPD are what distinguish one character from another.

**MAG, MDEF and DODGE are gone.** The physical-versus-magic build axis they
carried moves to elements. `DamageKind` survives only as a tag enemies can
resist and a few relic effects can read.

### Derived values and mitigation

DEF is a flat stat run through a curve, not a capped percentage:

```
mitigation = def / (def + DEF_K)          DEF_K = 900
```

So 300 DEF ≈ 25 % reduction, 900 DEF ≈ 50 %, 2700 DEF ≈ 75 % — always more,
never immune. **Percentage caps are retired**: they break the moment laps
start scaling enemies past them, and this game is now meant to run forever.

`CAP_CRIT` stays at 100 (a crit chance above certainty is meaningless).
Nothing else is capped.

### Base stat ranges (run start, before relics)

HP 2000–4500 · ATK 150–320 · DEF 120–280 · SPD 95–120.

Numbers are deliberately mid-scale: large enough that a rolled `+7 ATK`
substat is a real but small increment, small enough to fit a damage number on
screen without abbreviation.

## Elements

FIRE ▸ WIND ▸ WATER ▸ FIRE, and LIGHT ⇄ DARK mutually.

| Matchup | Damage | Crit chance |
|---|---|---|
| advantage | ×1.30 | +15 pts |
| neutral | ×1.00 | — |
| disadvantage | ×0.75 | −15 pts |

LIGHT and DARK are neutral against the triangle and advantaged against each
other, so they are the flexible picks and the rarest.

Elements are also the visual identity: every actor's palette is an element
tint applied per sprite layer, which is why the layered art pipeline exists.

## Combat

### Turn order — the attack bar

Every actor carries `atb`, starting at 0 (or a rolled 0–15 % on battle start
so identical SPD does not deadlock). Each tick:

```
atb += spd * ATB_RATE * dt          ATB_TURN = 1000
```

At `atb >= ATB_TURN` the actor takes a turn and **carries the overflow**
(`atb -= ATB_TURN`), so a fast actor banks progress toward its next turn.
Taking a turn ticks that actor's cooldowns down by one and ticks its status
durations. This is the single most important number in the game: SPD buys
turns, and turns are everything.

### Skills

Each character has exactly three. **Skill 1 has no cooldown** and is the
default action; skills 2 and 3 cost 2–5 turns of cooldown. There is no MP —
cooldowns are the whole resource system.

```ts
interface SkillDef {
  id: SkillId;
  name: string;            // <= 14 chars
  cooldown: number;        // 0 for skill 1
  mult: number;            // per hit
  hits: number;
  scale: 'ATK' | 'DEF' | 'HP' | 'SPD';   // what the damage is a multiple of
  kind: DamageKind;        // what the target's resist blunts
  target: TargetSpec;      // ENEMY | ALL_ENEMIES | ALLY | ALL_ALLIES | SELF | LOWEST_HP_ALLY
  applies?: StatusApply[]; // status effects, each with its own base chance
  heal?: number;           // fraction of the caster's max HP
  leech?: number;          // fraction of damage dealt returned as HP
  atbBoost?: number;       // fraction of ATB_TURN granted (or stripped, if negative)
  verb: string;            // battle log: HERO <verb> ENEMY FOR n!
}
```

DEF-, HP- and SPD-scaling skills are what make a tank or a speedster a damage
dealer rather than a passenger, and they are the reason those stats stay
interesting after the first act.

### Status effects

| Debuff | Effect | | Buff | Effect |
|---|---|---|---|---|
| STUN | skips the turn | | ATK_UP | +50 % ATK |
| DEF_BREAK | −70 % DEF | | DEF_UP | +70 % DEF |
| ATK_BREAK | −50 % ATK | | SPD_UP | +30 % SPD |
| SLOW | −30 % SPD | | CRIT_UP | +30 pts CRIT |
| BURN | 5 % max HP per turn | | SHIELD | absorbs damage, then expires |
| HEAL_BLOCK | healing does nothing | | IMMUNITY | blocks all incoming debuffs |
| BRAND | +25 % damage taken | | COUNTER | retaliates when hit |
| SILENCE | skills 2 and 3 unusable | | INVINCIBLE | takes no damage |

Landing is an ACC/RES check, floored so nothing is ever impossible:

```
p = clamp(skill.baseChance + (attacker.acc - defender.res) / 100, 0.15, 1.0)
```

IMMUNITY blocks outright, before the roll. Durations tick at the **affected
actor's** turn start, so a slow actor genuinely suffers longer under a debuff
— another reason SPD matters.

### Damage

```
raw        = scaleStat * skill.mult
raw       *= elementMult(attacker, defender)
raw       *= critical ? 1 + cdmg/100 : 1
raw       *= 1 + buffs - debuffs            (ATK_UP, ATK_BREAK, BRAND, …)
dealt      = raw * (1 - defender.def / (defender.def + DEF_K))
dealt      = afterResist(dealt, skill.kind, defender)   // enemy PHYS/MAGIC resist
```

Crit chance is `crit + elementCritBonus`, rolled per hit.

## Relics

Six slots, one relic each, no inventory — a new relic **replaces** the slot's
current one, and the equip screen shows both. Rarity COMMON / RARE / EPIC /
LEGENDARY.

Every relic is **rolled, not authored**: it has a main stat fixed or chosen by
its slot, one to four substats drawn from a pool, a set, and a level.

### Main stat by slot

| Slot | Position | Main stat |
|---|---|---|
| WEAPON | 1 | flat ATK — fixed |
| BOOTS | 2 | **SPD** \| ATK % \| HP % \| DEF % |
| ARMOR | 3 | flat HP — fixed |
| NECKLACE | 4 | **CRIT %** \| **CDMG %** \| ATK % \| HP % \| DEF % |
| CHALICE | 5 | flat DEF — fixed |
| TOME | 6 | **RES %** \| **ACC %** \| ATK % \| HP % \| DEF % |

The restriction is the whole point: SPD exists only on boots, crit only on the
necklace, accuracy and resistance only on the tome. A build that wants speed
*and* crit *and* accuracy has to spend three specific slots on them, and the
odd slots are never negotiable. Every interesting decision in the gear system
descends from this table.

Main stat scales with level: `main = base * (1 + MAIN_PER_LEVEL * level)`,
`MAIN_PER_LEVEL = 0.18`.

### Substats

Pool: flat HP, HP %, flat ATK, ATK %, flat DEF, DEF %, SPD, CRIT %, CDMG %,
RES %, ACC %. A substat never duplicates the main stat or another substat.

Starting count by rarity: COMMON 1 · RARE 2 · EPIC 3 · LEGENDARY 4. Maximum 4.

Levels run **+0 to +6** (LEGENDARY stops at +4). At **+2, +4 and +6** the
relic either gains a new substat, if it has fewer than four, or upgrades one
existing substat by a fresh roll. Three roll events per relic, not fifteen —
rescaled for a run of roughly thirteen clears rather than a year of farming.

Roll ranges, applied identically on first appearance and on upgrade:

| Substat | Range |
|---|---|
| ATK % / HP % / DEF % | 4–8 |
| RES % / ACC % | 4–8 |
| CRIT % / CDMG % | 4–6 |
| SPD | 4–6 |
| flat HP | 60–120 |
| flat ATK / flat DEF | 6–12 |

### Sigil effects and awakening

COMMON and RARE relics are pure numbers. **EPIC and LEGENDARY carry one
authored sigil effect** — this is where v2's unique items survive, and the
place a relic stops being a spreadsheet row. At **+6** an EPIC relic
**awakens**: the sigil is replaced by an authored variant that changes how it
plays, not merely how hard it hits. LEGENDARY relics cap at +4 and never
awaken, exactly as in v2.

### Sets

Every relic belongs to a set. Two-piece sets need two relics, four-piece sets
need four, and six slots means one 4-set plus one 2-set, or three 2-sets.

| 2-piece | Bonus | | 4-piece | Bonus |
|---|---|---|---|---|
| FATAL | +15 % ATK | | VIOLENT | 22 % chance of an extra turn |
| ENERGY | +15 % HP | | DESPAIR | 25 % chance to stun on hit |
| GUARD | +15 % DEF | | VAMPIRE | heal 35 % of damage dealt |
| SWIFT | +25 % SPD | | WILL | IMMUNITY for turn 1 of every battle |
| BLADE | +12 pts CRIT | | NEMESIS | +ATB when damaged |
| RAGE | +40 % CDMG | | REVENGE | 25 % chance to counterattack |
| FOCUS | +20 % ACC | | SHIELD | party shield at battle start, 3 turns |
| ENDURE | +20 % RES | | DESTROY | strip 4 % of the target's max HP |

VIOLENT and NEMESIS only mean anything because turn order is an attack bar;
DESPAIR only means anything because of the ACC/RES check. The sets are what
turn two separate systems into one build.

## Characters

```ts
interface CharacterDef {
  id: string;
  name: string;              // <= 16 chars
  element: Element;
  base: { hp: number; atk: number; def: number; spd: number };
  skills: [SkillId, SkillId, SkillId];
  awakening: { name: string; bonus?: Partial<Stats>; upgrades?: SkillId };
  leader: LeaderSkill;       // { stat, amount, element? }
}
```

Six at launch, growing toward twelve. Each is a distinct answer to "what does
this team lack" — a speed-tuned stripper, a DEF-scaling wall, an AoE burner, a
healer with heal-block counterplay, a debuffer built entirely around ACC.

**Awakening** happens once per run, at an ALTAR room in act 3: the character
gains a permanent stat bonus (+15 pts CRIT, +25 pts ACC) or an upgraded skill.
Which of the three party members to awaken is a real decision.

**Leader skills**: the party has three members but only the **leader's** skill
applies. A leader skill boosts one stat for the whole party, optionally only
for one element — so an all-FIRE team can run a much stronger elemental leader
than a mixed one. Choosing the leader is choosing between a character's own
kit and the team-wide bonus they bring.

### Building a party

You draft **one** character at run start from the unlocked roster — your
starting leader. Slots two and three are filled during the run at **SUMMON**
rooms, each offering one of three. Every run's team is therefore different,
and the leader question reopens each time someone joins.

## Run structure

Six acts, then laps. Room types: FIGHT, ELITE, REST, LOOT, **SHRINE**,
**FORGE**, **SUMMON**, **ALTAR** (act 3 only), BOSS.

| Room | What it offers |
|---|---|
| FIGHT | a battle; relic drop on `FIGHT_DROP_CHANCE`, pity after `PITY_AFTER` |
| ELITE | a harder battle, three relic cards |
| REST | full heal, or cure all statuses and keep going |
| LOOT | two relic cards, no fight |
| SHRINE | accept a curse to gain a boon — both last the rest of the run |
| FORGE | upgrade one relic two levels, **or** reroll one of its substats |
| SUMMON | recruit one of three characters, or one EPIC relic if the party is full |
| ALTAR | awaken one party member |
| BOSS | one per act; three cards, pick one |

### Laps — the endless mode

Beating the act 6 boss ends the run **only if you want it to**. The victory
screen offers two doors:

- **DESCEND** — bank your relics, take the win, end the run.
- **ANOTHER LAP** — ascension +1, keep everything (party, relics, awakenings),
  the map resets to act 1 at the higher difficulty, and the score keeps
  climbing.

This is the endless mode and the New Game+ in one mechanic. A lap is a real
gamble: everything you have banked is still unbanked while you are on it.

### Ascension

A0 through A10, one unlocked per win. Each stacks a modifier — enemy HP and
ATK, enemy RES (which makes ACC mandatory rather than optional), fewer REST
rooms, worse substat rolls, an extra skill on bosses. Ascension is also what
absorbs the Vault, below, so that persistent gear never makes run 20 easier
than run 1.

### The Vault — progress across runs

Permadeath keeps its teeth. What survives a run is a **trickle you choose**,
not an inventory.

- On a **win** you bank 2 relics. On a **death**, 1.
- At the next run's start you may equip up to `min(3, acts cleared last run)`
  relics from the Vault.
- The Vault holds 12. Past that, banking means choosing what to drop.

So a good run pays forward, a disastrous one still pays a little, and the
ascension ladder rises to meet the accumulated power. Farming exists — it is
just measured in runs rather than hours.

## Difficulty targets (balance sim)

At **A0**: act 1 clear ≥ 75 % · act 3 ≈ 50 % · act 6 ≈ 15 %. Lap 2 clear
≈ 8 %. A random-draft, random-pick, random-target policy must win < 3 %.

Speed matters more than raw power: a party that out-speeds an act's enemies
should clear it roughly 20 points more often than an equally-statted slow
party. If it does not, `ATB_RATE` or the SPD substat range is wrong.

Every 4-piece set must appear in at least one winning policy line. A set no
policy ever wants is a set that needs rewriting, not renumbering.

## Presentation

### Canvas and scale

**1280×720 logical, landscape.** Integer ×1 at 720p and ×1.5 at 1080p.

### HD-2D — hard pixels under soft light

The reference is Octopath Traveler. What makes that look is not the sprites;
it is everything around them. The frame is built in five passes:

1. **Diorama planes.** Background, midground, actor plane, foreground. Each
   parallaxes at its own rate, which is what gives a flat scene depth.
2. **Depth of field.** Background and foreground planes are blurred; the actor
   plane stays razor sharp. A sharp band through the middle of a soft frame is
   the single biggest contributor to the diorama read — more than the lighting.
3. **Chunky actors.** Sprite parts authored at 64 px, drawn ×3 with
   `imageSmoothingEnabled = false`. Hard pixel edges are preserved **only**
   on this plane.
4. **Light at native resolution.** A per-biome key light as radial gradients,
   rim light along actor silhouettes, and embers, dust and fog as smooth
   high-resolution alpha particles — deliberately *not* pixelated. Composited
   with `'lighter'`.
5. **Colour grading.** One full-frame pass: a contrast curve plus a warm/cool
   split tone per biome.

The governing rule is one line long: **exactly one plane is pixelated.**
Light, particles, fog, UI and text all render smooth at 720p. Imitations of
this style look cheap when they pixelate the *effects* too, because that stops
reading as an art direction and starts reading as low resolution.

Performance: a per-frame `ctx.filter = 'blur()'` at 720p is not affordable.
Blurred planes are pre-rendered **once per biome** into offscreen canvases and
redrawn each frame at a new parallax offset; bloom runs through a quarter-res
offscreen, blurred there and upscaled with smoothing on. Nothing allocates per
frame.

This lands in a new `engine/light.ts` — key light, rim light, bloom, grading,
DoF planes. `engine/crt.ts` is **kept**, not replaced: its halation layer is
already bloom and its phosphor lift is already an ambient floor. Run it with
`scanlineAlpha: 0, flicker: 0` and those two layers do HD-2D work. The full
arcade treatment stays reachable as a toggle.

### Layered actors

A character is a recipe, not a picture: body, head, torso, weapon, cape — each
an ASCII part from a shared library, each with **anchor points** so a weapon
stays in a hand across an animation. Animation is per-layer transform
keyframes, not redrawn frames. Element tint is a palette swap per layer, and
rim light is applied to the composed silhouette rather than per part.

Consequence: the eleventh character costs about eight lines, and five
elemental variants of anything are free. This is the only way a roster of this
size gets authored at all.

### Procedural VFX

Auras, projectiles, impact shockwaves, status glows, light shafts, boss
silhouettes and screen distortion are drawn with code at native resolution.
This is where "go wild" lands — smooth light over hard pixels.

### Input

**Native tap and keyboard, in parallel, always both.** Tap an enemy to target
it, a skill to cast it, a card to take it. `engine/input.ts` gains pointer
events mapped to logical pixels through `getBoundingClientRect()` (the CSS
size differs from the baked canvas scale) and an immediate-mode hit-region
registry that suits a game already re-rendering every frame.

Every tappable region also carries a **selection index**, so the whole game
remains playable on a keyboard. A screen that adds a tap target adds a
keyboard route to it in the same change. This is a hard rule: it is the thing
that rots first.

`index.html` loses the arcade bezel on small screens and gains
`touch-action: none`, no user-scaling, a fullscreen request on first tap, and
a rotate-to-landscape prompt.

### UI constraints

Logical screen 1280×720, font 7×11 at scale 1. Battle log line ≤ 90 chars.
Character names ≤ 16, skill names ≤ 14, relic set names ≤ 8, enemy names ≤ 16.
Three hero panels sit left, up to three enemies right, the turn-order queue
ribbons across the top, and the skill bar anchors the bottom with cooldown
pips. Status icons stack above each actor, six maximum before they collapse
into a count. Every panel respects `SAFE_MARGIN`.

## Delivery phases

Each phase ends green — `check`, `build`, `smoke`, and `sim` where rules
moved. v3 is built on a branch: `main` keeps serving playable v2 until phase 4
lands, because phases 1 through 3 leave the game unplayable in between.

| # | Phase | Delivers |
|---|---|---|
| 0 | **Contract** | this document |
| 1 | **Engine upscale** | 1280×720 canvas, 7×11 font, pointer input + hit regions, `engine/light.ts` (bloom, DoF planes, grading), CRT retuned to `scanlineAlpha: 0`, mobile shell. Rewrites `ensuring-arcade-visuals` and `handling-user-input`. |
| 2 | **Combat core** (headless) | stats, elements, ATB, cooldowns, statuses, ACC/RES, 3v3 resolution. Simulator retargeted. |
| 3 | **Relics** (headless) | rolling, substats, upgrades, sets, derived stats, loot tables. |
| 4 | **Battle presentation** | layered actor pipeline with anchors, ATB gauges, turn queue, status icons, skill VFX. **The game is playable again here.** |
| 5 | **Roster and meta** | six characters, awakenings, leader skills, SUMMON drafting. |
| 6 | **Run structure** | acts 5–6, SHRINE/FORGE/ALTAR, ascension, laps, the Vault. |
| 7 | **Go wild** | the full HD-2D pass: diorama planes, depth of field, per-biome key light and grading, boss intros, light shafts. |
| 8 | **Balance** | simulator retune against the targets above. |

Phases 2 and 3 are independent and can run in parallel; so can 5 and 6 once 4
lands.

## Balance state

Not yet measured — v3 has no numbers behind it. The v2 table is retired with
the v2 rules. This section gets rewritten at phase 8 and dated.
