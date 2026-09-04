# DESIGN.md v3 — verification log

What the design-verification loop changed in `DESIGN.md`, round by round.
Six reviewers per round, one dimension each (consistency **C**, determinism
**D**, balance arithmetic **B**, simulability **S**, feasibility at 1280×720
**F**, fun and scope **U**); the editor triaged every finding and applied
every BLOCKING, NUMBERS and GAP. NOISE findings are listed with the reason
they were discarded so the owner can overrule.

Severities: **BLOCKING** — a programmer could not implement it without
guessing · **NUMBERS** — implementable, but the value was wrong and the
reviewer showed why · **GAP** — a real case the contract never mentioned ·
**NOISE** — style, speculation or taste; discarded.

## Round 1 — the original v3 contract (470 lines, no numbers behind it)

The round found the contract sound in direction and unbuildable in detail:
no enemy existed, no turn procedure, no relic bases, no map, no roster, no
sigil, no measurement. Every dimension returned BLOCKING findings. The
resolution was one integrated rewrite rather than six patches.

### Consistency

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `TargetSpec`, `StatusApply`, `LeaderSkill`, `Element`, `SkillId`, `Stats`, relic/actor/party/enemy/vault shapes referenced, never defined | *Types* block added; `LeaderSkill.amount` in the stat's native unit; awakening is exactly one of `bonus` / `upgrades` |
| C2 | BLOCKING | "Six slots" — per member or per party? which member gets a card? | Per member (18 slots); a card asks **who wears it**; Vault relics go on the starter; relics move between members outside battle |
| C3 | BLOCKING | No encounter size, enemy AI, KO rule, battle end, stall cap | Packs as biome data; `ai: SPREAD \| FOCUS`; a KO'd hero returns at `KO_RETURN = 0.30` after a win; `TURN_CAP = 200` |
| C4 | BLOCKING | Party starts at one; SUMMON unguaranteed; targets assume three | Acts 1–2 carry a SUMMON as the landmark node on every path; targets measured with the party at three |
| C5 | BLOCKING | No enemy scaling formula; ascension had no values | Enemy scale table, `ACT_MULT`, `ELITE_MULT`, `BOSS_MULT`, `LAP_MULT`; the cumulative ascension ladder |
| C6 | BLOCKING | `ATB_RATE` unvalued; ATB in real time; "cooldown 2" undefined | Event-driven turn order; `ATB_RATE` removed from the rules; cast on turn T with cooldown n → usable on T+n |
| C7 | BLOCKING | FORGE the only level source; add-vs-replace on upgrade rolls | Drops arrive pre-levelled by act (`DROP_LEVEL`), FORGE +2, REST sharpen +1; an upgrade roll is **added** |
| C8 | BLOCKING | `RELIC_BASES`, main bases, loot weights, drop chance unvalued | `RELIC_MAIN_BASE`, `LOOT_WEIGHTS` per act, `LOOT_COUNT`, `FIGHT_DROP_CHANCE = 0.5`, `PITY_AFTER = 2`; `RELIC_BASES` dropped |
| C9 | BLOCKING | Sigils had no list, type or owner | Twelve sigils with kindled variants; closed `SigilEffect`; `game/data/sigils.ts` |
| C10 | BLOCKING | Set bonuses were prose; NEMESIS/SHIELD unvalued; stacking unstated | Every bonus numbered; closed `SetBonus`; 2-piece × `floor(n/2)`, 4-piece once; counter defined |
| C11 | BLOCKING | `raw *= 1 + buffs − debuffs` contradicted the stat-modifier table | Stat statuses modify the stat where it is read; BRAND is the only defender multiplier |
| C12 | BLOCKING | `skill.baseChance` undefined; REST "cure statuses" vs statuses that only tick in battle; no between-battle healing | `apply.chance`; statuses clear at battle end; `CLEAR_HEAL = 0.20`, `BOSS_ENTRY_HEAL = 0.50`; REST's second option is sharpen |
| C13 | BLOCKING | SHRINE had no curses or boons | Six pacts, closed `Modifier` union, `game/data/pacts.ts` |
| C14 | BLOCKING | No map rule; "thirteen clears" matched nothing | `STAGE_SIZES = [2,3,1,3,2]` with a landmark stage, `ROOM_WEIGHTS`, guarantees; ≈ 21 clears per lap, ≈ 12 for a run dying in act 4 |
| C15 | BLOCKING | Vault under laps: bank counts, withdrawal, levels, unlocks, storage | DESCEND banks `2 + laps`, death banks 1; withdrawing removes; levels kept; unlock at the first act-6 kill; `screens/vault.ts` persists |
| C16 | BLOCKING | Score never defined | `ROOM_SCORE × actNumber × (1 + 0.5 × ascension)`, acts continue through laps |
| C17 | GAP | ALTAR "once per run" vs a lap reaching act 3 again | Once per lap, un-awakened members only, else a FORGE |
| C18 | NUMBERS | "`CAP_CRIT` stays at 100" (v2 was 60) | "up from v2's 60", clamped at roll time after the element bonus |
| C19 | NUMBERS | Mitigation examples (300/900/2700) sit outside the DEF band | Sentence added: a bare character mitigates 12–24 %; 900 is a wall |
| C20 | NUMBERS | "Three roll events" vs LEGENDARY's +4 cap; heal skills' `mult`/`hits` | "Up to three"; pure heals are `mult 0, hits 0`; A4 lowers range tops |
| C21 | GAP | Layout table contradicted CLAUDE.md, the skills, `sim/run.mjs`; import rows incomplete | Phases update CLAUDE.md and every skill in the same milestone; harness entry moves to `game/sim/run.ts`; import rows completed |
| C22 | GAP | Enemies for acts 1–4, screens, audio, score, Vault storage delivered by no phase | Phase table rewritten: phase 2 authors acts 1–2 content, phase 4 is a vertical slice, phase 6 owns persistence |
| C23 | GAP | v2's injected rng, `validateData`, closed unions and string budgets dropped | All three restated as contract; relic title ≤ 11 with the slot as an icon |
| C24 | GAP | "awakening" used for relics and characters; SHIELD set vs SHIELD status; COUNTER vs REVENGE | Relic +6 is **kindled**; the set is **BULWARK**; COUNTER status = REVENGE at 100 % |
| — | NOISE | "Integer ×1 and ×1.5" wording; set names ≤ 8 all pass; "+7 ATK" example; phase 5 before 6; SUMMON never offers a party member | Wording fixed in passing while the section was rewritten; the rest confirmed consistent |

### Determinism

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | Wall-clock `dt` in the bar; simultaneous crossings unordered | `advance()` to the readiest actor; `ready()` ordered atb ↓, spdEff ↓, heroes first, slot ↑; recomputed after every turn |
| D2 | BLOCKING | Turn-start order (carry, BURN, STUN, cooldowns, statuses, VIOLENT) | The numbered `takeTurn` procedure; "act, then decrement"; VIOLENT is one fresh turn |
| D3 | BLOCKING | Attacker and defender terms mixed; `scale: 'HP'` ambiguous; jitter | Split pipeline; HP reads max HP; `DAMAGE_JITTER = 0` draws no rng |
| D4 | BLOCKING | % on base or total; set and leader stacking | `total = round((base + flat) × (1 + pct/100))`; `pts` summed; 2-piece × `floor(n/2)` |
| D5 | BLOCKING | No enemy AI or default targeting; ties; dead targets | Highest-index skill off cooldown; SPREAD/FOCUS; snapshot targets; illegal policy answers fall back |
| D6 | BLOCKING | What a dead hero is | Default KO-returns; permanent death is **open question 1** |
| D7 | GAP | Status stacking and expiry | One instance per kind; `max` duration and shield; buff + break coexist |
| D8 | GAP | Rolls per hit or per skill; allies rolling against RES; strips vs IMMUNITY | Once per hit per surviving target; allies never roll; negative `atbBoost` is debuff-class |
| D9 | NUMBERS | Counter undefined | Skill 1 at `COUNTER_MULT = 0.75`, once per enemy skill, never chains, not a turn |
| D10 | NUMBERS | NEMESIS amount | `NEMESIS_ATB = 0.10` per HP-reducing hit |
| D11 | NUMBERS | Battle-start order; BULWARK amount; WILL's "turn 1" | ATB roll → WILL → BULWARK (max, not sum); `WILL_TURNS = 2` under tick-at-start |
| D12 | GAP | Rounding, lethal BURN, DESTROY bounds, heal caps | Integers via `round`; BURN lethal and true; DESTROY bounded by `DESTROY_FLOOR`; heals capped at missing HP |
| D13 | GAP | Which substat upgrades; add or replace; FORGE reroll semantics | Uniform by rng, **added**; reroll keeps the stat and replaces the value with `rolls` fresh rolls |
| D14 | NUMBERS | Main-stat choice weights and bases | `MAIN_WEIGHT_SIGNATURE = 2`; bases from B2 |
| D15 | GAP | Cooldowns/HP/statuses between battles; stall cap | Reset / persist / clear; `TURN_CAP = 200` |
| D16 | GAP | SUMMON when full, full Vault, lap edge cases, score | EPIC or swap; drop before the run ends; ALTAR per lap; score per C16 |
| D17 | NOISE | Units stated in passing | Folded into the stats table ("pts", `/100`) — a two-word change |

### Balance arithmetic

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | No enemy scale at all | The per-act NORMAL/ELITE/BOSS table (act-1 normal dies in ≈ 4.6 actions, act-6 boss ≈ 28–37), `ACT_MULT`, `CLEAR_GROWTH`, `LAP_MULT`, enemy RES `15 + 3 × (act−1)` |
| B2 | BLOCKING | Main bases absent; geared multiplier ran to ×13 | `MAIN_PER_LEVEL = 0.15`, bases (WEAPON 36 … CDMG 22), CRIT/CDMG substats 3–5, `LEGENDARY_MAIN_MULT = 1.2`: median ≈ 2.6×, focused ≈ 4.6×, ceiling ≈ 10× for laps |
| B3 | BLOCKING | Levels unreachable (FORGE-only ≈ +0.56 avg); economy unvalued | `DROP_LEVEL` by act, `FIGHT_DROP_CHANCE = 0.5`, `LOOT_WEIGHTS` six rows, ≈ 21 relics per run |
| B4 | BLOCKING | No status amounts or durations | Duration column; BURN cap; SHIELD sizes |
| B5 | BLOCKING | No `chance` conventions; no enemy RES | 0.75 primary / 0.50 secondary; enemy RES per act, elite +10, boss +20; DESPAIR two-stage |
| B6 | BLOCKING | HP only ticks down | `CLEAR_HEAL 0.20`, `BOSS_ENTRY_HEAL 0.50`, `KO_RETURN 0.30` |
| B7 | NUMBERS | 75/50/15 impossible with smooth survival; lap 2 undefined | 80/57/41/29/21/15 (0.72 per act); lap 2 ≈ 8 % conditional on taking it |
| B8 | NUMBERS | DESTROY and BURN uncapped boss-killers | DESTROY `min(30 % dealt, 4 % max HP)` with a 40 % floor; BURN capped at 2× applier ATK |
| B9 | NUMBERS | Flat HP substat dead | flat HP 90–180, flat ATK 7–13 |
| B10 | NUMBERS | Element swing ≈ 2× one way, ≈ 4× both | Kept as the owner wrote it; **open question 2** with the softer alternative |
| B11 | NUMBERS | VIOLENT chaining adds variance; `ATB_RATE` unvalued | Extra turn never chains; `ATB_RATE` is animation only |
| B12 | NUMBERS | LEGENDARY (+4) weaker than EPIC (+6) | `LEGENDARY_MAIN_MULT = 1.2` |
| B13 | BLOCKING | Ascension unvalued; Vault makes act 1 free | +10 % HP/ATK per level, RES +5 from A2, the rest of the ladder; the Vault-vs-ascension link is **open question 3** |
| — | GAP | ATK_UP double-dipped for DEF-scalers; DEF_BREAK weak early; enemy crit; boss targeting | Resolved by D3 (stat-side); DEF_BREAK's shape accepted; enemies use the baselines; `ai` field |
| — | NOISE | "+7 ATK" example; crit reaching 100; ATB jitter; "three roll events" | Example reworded; the rest confirmed fine |

### Simulability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | BLOCKING | No enemy decision rule or `EnemyDef` | *Enemies* section |
| S2 | BLOCKING | Real-time formula inside the rules | Event-driven `advance()`; `ATB_ANIM_RATE` lives in the screen |
| S3 | BLOCKING | Map, guarantees, encounters unspecified | *The map*; packs as data |
| S4 | BLOCKING | Decision surface not enumerable | The `Policy` interface; `random` answers every method uniformly |
| S5 | NUMBERS | Targets without a measurement | Runs, seed, policy, denominators, the `--spd ±10` pair, the 5 % set rule, `RunResult`/`Probe`, `simulateBattle` |
| S6 | GAP | rng injection lived in code only | Contract sentence + the list of rolls |
| S7 | GAP | Cross-run state invites `localStorage` into sim | `RunConfig` in, `RunResult.banked` out; roster unlock is **open question 5** |
| S8 | GAP | Boundary seams (art fields, log lines, import rows) | No art fields on defs; log lines built in `sim/battle.ts`; import rows; bundle gate |
| S9 | GAP | No stall cap | `TURN_CAP = 200`, stall reported |
| S10 | GAP | No `validateData` | The check list in *Module layout* |
| S11 | NOISE | `game/sim/run.ts` vs `sim/run.mjs` share a basename | Discarded — the owner named the files; a rename is churn without a rule |

### Feasibility at 1280×720

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | BLOCKING | `fillRect` per cell/pixel cannot render at 720p (48k–120k calls) | Bake parts and glyphs to bitmaps; pose cache with rim light; `POSE_FPS 12`; 90° rotations |
| F2 | BLOCKING | Literal pass list ≈ 17 FSE vs 8–12 affordable | Quality tiers HIGH/MED/LOW/ARCADE; bloom xor halation; grading as two cached fills; no `getImageData` |
| F3 | BLOCKING | Three 192-px actors do not stack in 512 px | The diagonal stage and the region table |
| F4 | BLOCKING | Shell clips the game; ×1.5 backing | CSS-fitted 16:9 canvas, `image-rendering: auto`, backing ×1/×2 |
| F5 | NUMBERS | `SAFE_MARGIN` 8 | 24 desktop, 40 phone |
| F6 | NUMBERS | 44 CSS px at a phone's 0.5× is 88–96 logical | `TAP_MIN = 96`, `TAP_GAP = 12`; ribbon chips display-only |
| F7 | NUMBERS | Scale-1 text ≈ 1 mm on a phone; 90 chars at scale 2 overflow | Scale-2 minimum; `LOG_LINE_MAX = 72`; relic title ≤ 11 |
| F8 | NUMBERS | Six icons above an actor collide on the diagonal | `STATUS_ABOVE_MAX = 4`, six in the panel |
| F9 | NUMBERS | Juice/particle constants sized for 240 px | Shake ×5, `DIM_BLEED = 40`; soft-dot particles (phase 7) |
| F10 | GAP | iPhone has no fullscreen API | Orientation lock where present; Home-Screen hint where not |
| F11 | GAP | Parity stated one way; registry pitfalls | "Every keyboard action has a tap target"; pointer rules; pooled registry |
| F12 | GAP | Per-frame allocation in the wording | Cached gradients; distortion boss-intro only; "nothing allocates per frame" made concrete |
| F13 | GAP | Engine font metrics hard-coded to 3×5 | Phase 1 engine work, not a contract rule |

### Fun and scope

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| U1 | BLOCKING | Phase 4 "playable again" was false as phased | Phase 4 is a vertical slice with three fixed characters, one biome, a linear run, title/over/victory |
| U2 | BLOCKING | Kindling unreachable | Drop levels by act (B3's form) |
| U3 | BLOCKING | Six characters unspecified; mono parties impossible | The roster table; two FIRE; `elementAmount` leader rule |
| U4 | BLOCKING | Enemies had no elements, kits or telegraphs | Enemy elements, packs with a support, `intent` in the ribbon, the biome table (SUNKEN VAULT for the 12-char limit) |
| U5 | GAP | Slots per whom starve the replace decision | Per member; who-wears-it; drop density |
| U6 | NUMBERS | A 4-set assembles in ≈ 12 % of runs; 2+2+2 dominates | Per-run set pool of four; FORGE rebrand; phase 8 measures 4-sets against 2+2+2 |
| U7 | GAP | No SUMMON guarantee; 1v3 bosses | Landmark SUMMONs; pack size vs party size; the swap |
| U8 | GAP | The lap door was not a decision | Banking only at DESCEND, `2 + laps`; death banks 1; **open question 4** |
| U9 | GAP | No map shape, SHRINE content, or REST alternative | The map; six pacts; sharpen |
| U10 | GAP | Sigils had no count, list or example | Twelve sigils |
| U11 | NUMBERS | Redundant statuses; four with no source | INVINCIBLE enemy-only; COUNTER = REVENGE 100 %; every status needs a source by phase 5 |
| U12 | NUMBERS | Slot gating collapses to the bold mains | Phase 8 verifies two mains per open slot in winning lines |
| U13 | GAP | Ascension was prose | The ladder (merged with B13) |
| U14 | GAP | Nothing links the Vault to ascension | **Open question 3** |
| U15 | NOISE | Set numbers missing | Not noise in effect — numbered via B4/B8 |
| U16 | NOISE | Phase 1 creeping; phase 7 is three | Phase 7 split into 7a/7b/7c; `light.ts` moved to 7a; the mobile shell stayed in phase 1 because it was already built |
| U17 | NOISE | v2 features quietly dropped (compare line, decline-for-mend, boss signature) | Kept, cheaply: compare line, `SKIP_MEND = 0.15`, a boss's first card is an EPIC |

Conflicts between reviewers, and how they were settled: the KO rule (D6
permanent vs C3/B6 return) — return by default, permanent as an open
question; rooms per act (S3 three stages, U9 five, C14 six, B1 "5 + boss")
— five stages with a one-node landmark, and the enemy table's arithmetic
still holds at ≈ 3.5 clears per act; upgrade sources (U2 drop levels vs C7
UPGRADE cards) — drop levels, because they add no card type; the counter
multiplier (D9 1.0 vs B4/C10 0.75) — 0.75; `TURN_CAP` (S9 150 vs D15/C3
200) — 200; NEMESIS (D10 unvalued, U15 12 %, C10 8 %, B4 10 %) — 10 %;
WILL's duration (D11 1 or 2) — 2, so it covers the wearer's first action.

Length: the rewrite grew the document from 470 to ≈ 1000 lines against a
~700-line guideline. Every added line answers a BLOCKING or GAP finding;
round 2 was asked to name cuts.
