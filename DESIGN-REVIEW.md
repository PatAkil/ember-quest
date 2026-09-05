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

## Round 2 — the rewritten contract (≈ 1000 lines)

The rewrite fixed the direction-level holes and opened detail-level ones: the
new sections referenced fields the types did not carry, the map's one-node
landmark stage could not obey the link rule, the party was two at the act-1
boss, several sigils and pacts were dead or free, and the numbers that were
now in the document had not yet been checked against each other. Round 2
found 17 BLOCKING, 43 GAP and 31 NUMBERS findings; all were applied in a
second integrated rewrite.

### Consistency

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `Actor` carried no worn sets, sigils or original max HP | `sets`, `sigils`, `baseMaxHp` added; enemies wear no sets except A10's WILL |
| C2 | BLOCKING | `Pact`/`Modifier` undefined, pacts had no ids, "IMMUNE" is not a status | Types written; ids HASTE…DEARTH; the curse is INVINCIBLE |
| C3 | BLOCKING | Kindled sigils are a second behaviour the union promise forbade; OPENER meaningless at cooldown 0 | Kinds carry optional kindled fields; OPENER "starts no cooldown" |
| C4 | BLOCKING | Kits needed `cleanse`, a bonus-vs-status multiplier and a per-application target | `cleanse?`, `bonusVs?`, `StatusApply.target?` |
| C5 | NUMBERS | The party is two at the act-1 boss | A SUMMON follows the draft; act 1's landmark is the second (with U1/B1) |
| C6 | NUMBERS | `BANK_WIN + n` banked 3 on a plain win | `BANK_WIN + L − 1`, laps 1-based |
| C7 | NUMBERS | GRUDGE's 1-turn ATK_UP covered no action | 2 turns |
| C8 | NUMBERS | "Four cards"/"four offers" had no layout or roster | Four-card row 284 wide; SCHISM's boon re-priced |
| C9 | NUMBERS | A one-node stage could not obey the 1–2 span rule | Links to every node of the next stage, from every node of the previous |
| C10 | NUMBERS | 30-char blurbs overflow a card line | `BLURB_WRAP = 22`, two lines |
| C11 | NUMBERS | Derivation omitted the BOOTS SPD main, WILL's RES, pact sources; two RES authorities | Sources added; `pts.RES` overrides the act formula |
| C12 | NUMBERS | "types.ts owns every constant" contradicted the data rows | Rules constants not claimed by a data row; presentation constants in their module |
| C13 | NUMBERS | A9 was a no-op | Bosses start at `atb = ATB_TURN` |
| C14 | GAP | `CLEAR_GROWTH` had no application rule | hp/atk per FIGHT/ELITE clear, reset per act, boss carries the count |
| C15 | GAP | BURN's cap needed the applier at tick time | `Status.dmg` fixed at application |
| C16 | GAP | SPD_UP had no source; "boss phases" undefined | Tailwind and Rally; INVINCIBLE only via a boss SELF skill or pact |
| C17 | GAP | A8 broke three-slot packs | Only packs of width < 3 grow |
| C18 | GAP | `vaultSlots` had no persisted input | `RunResult.actsCleared` persisted |
| C19 | GAP | `RunResult`/`Probe` fields and `worn` untyped | Typed; `worn` member-major |
| C20 | GAP | Set/sigil battle hooks, policies and `simulateRun` unowned | Phase 2 hooks, phase 6 `simulateRun` + policies |
| C21 | GAP | `Slot`, `Rarity`, `RoomType`, `LootSource`, `AscensionRow`, `BOSS_HP` undeclared | Added |
| C22 | GAP | Sigil ATB strips vs the debuff-class rule | RENDER debuff-class; TRIP rides on the landed status |
| — | NOISE (15) | Wording: "read, then decrement"; heals order; "leader = slot 1"; "authored" vs derived; card floors; etc. | Fixed in passing where the sentence was rewritten anyway; the rest discarded |

### Determinism

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | One substat pool or per-slot pools | One pool of eleven keys; exclude the rolled main and existing subs |
| D2 | BLOCKING | Act-6 landmark REST vs no-REST→REST; guarantee order | The five-step `buildMap` order; landmark and guarantee REST exempt |
| D3 | BLOCKING | What a counter resolves | Skill 1 fully, per hero hit, once, no cooldown write, no OPENER, no chain |
| D4 | BLOCKING | BURN's applier ATK at tick or application | Fixed at application, `max` on refresh |
| D5 | GAP | `advance()` ties | Every actor with `Δ_i === Δ` lands exactly on ATB_TURN |
| D7 | GAP | An enemy with every skill on cooldown | `validateData`: enemy `skills[0]` at cooldown 0 |
| D8 | GAP | `statEff` rounding; SPD scaling under SLOW; BRAND on BURN | Unrounded; SPD reads `spdEff`; BURN ignores BRAND |
| D9 | GAP | What `dealt` feeds | Pre-absorb incl. overkill; NEMESIS/GRUDGE need HP loss |
| D10 | GAP | Heal side of HEAL_BLOCK; KO order; map heals; self in ally specs | Recipient-side; KO set then living heal; capped adds; caster included |
| D12 | NUMBERS | GRUDGE 1 turn; pact IMMUNITY expiry; RAGE unit | 2 turns; "until its first turn starts"; +40 pts |
| D13 | GAP | IMMUNITY edges; "one debuff"; sigil strips | Blocks applications incl. refreshes; lowest index; strips per C22 |
| D14 | GAP | Roll events by source; set pool composition | Source-blind thresholds; drop-level formula; pool = 2 + 2 + Vault sets |
| D15 | GAP | Links around the size-1 stage | With C9 |
| D16 | GAP | Rooms with nothing to offer; packs vs party | SHRINE → FORGE; SUMMON always rolls; width ≤ members + 1 |
| D17 | GAP | HP on equip; recruits; pity; cards | Proportional HP; full HP recruits; pity per run; `max(1, …)` |
| D18 | GAP | Vault bookkeeping | Bank/drop defaults; `actsCleared`; unlock formula |
| D19 | GAP | `intent` and enemy derivation | Step-7 pick on a ticked copy; the derivation formula |
| D20 | GAP | A9; INVINCIBLE source | With C13/C16 |
| D21 | GAP | Sigil parameters | ECHO/SPARK/SURGE/GRUDGE/BASTION defined |
| D6, D11 | NOISE | Confirmations; "act, then decrement" wording | Wording fixed |

### Balance arithmetic

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | BLOCKING | Two heroes at the act-1 boss (62 % with GALE) | The post-draft SUMMON; ELITE never rolls while the party is short |
| B2 | BLOCKING | No enemy `resist` default (a ±40 % lever) | NORMAL 10 · ELITE 15 · BOSS 20; the expected-gear reference party stated |
| B3 | NUMBERS | TIDE out-heals acts 2–5 (model 100/100/100/100/99/77) | Tidepool 0.18, Undertow 0.10 |
| B4 | NUMBERS | `TURN_CAP` 200 stalls lap-2 A10 bosses | 500 |
| B5 | NUMBERS | No 4-set beat 2+2+2; SWIFT×3 was the baseline | SWIFT 20 %, VIOLENT 0.30, NEMESIS 0.15, REVENGE 0.35 |
| B6 | NUMBERS | DESTROY never touched current HP | Strips current HP too |
| B7 | NUMBERS | VAMPIRE healed 18 % of incoming | 0.50 |
| B8 | BLOCKING | OPENER a no-op | "Starts no cooldown" |
| B9 | NUMBERS | SPARK per hit doubled AoE kits; BLOODLUST and TRIP dead | Once per skill; +10/+15; 25 % |
| B10 | GAP | LOCKDOWN doubled STUN | STUN excluded |
| B11 | NUMBERS | 2-turn self-buffs covered one action | ATK_UP/DEF_UP/CRIT_UP 3 turns |
| B12 | NUMBERS | SHROUD free, SCHISM never taken, DEARTH zeroed FIGHT cards | +1; halved; min 1 |
| B13 | GAP | Tailwind turn-neutral | +40 % |
| B14 | NOISE (14) | Confirmations (BURN cap, DESPAIR, DEF_BREAK, Inferno/Judgement in band, relic supply, score width); BOOTS base 12 | BOOTS SPD base 12 adopted; the rest confirmed |

### Simulability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | BLOCKING | `balanced` defined by a screen's compare line | `compare()` with `COMPARE_WEIGHTS` in `sim/relics.ts` |
| S2 | BLOCKING | `buildMap` could not link a one-node stage; conversions non-deterministic | With C9/D2 |
| S3 | BLOCKING | `act` options and enemy ALLY targeting unenumerated | Skill-then-target order; enemy ALLY = LOWEST_HP_ALLY |
| S4 | GAP | Run-start order and `leader()` timing | `vaultEquip`, `draft`, pool, ascension, `summon`, `leader`, `buildMap` |
| S5 | GAP | Post-battle order | Score, KO return, clear heal, counter, drop, card |
| S6 | GAP | `summon` semantics | Offers, the EPIC through `relic`, swap rules |
| S7 | GAP | Pack draw, elites, A8, A9, the IMMUNE pact | With D16/C13/C2 |
| S8 | GAP | rng-consumption sentences | Drop roll always drawn; landing drawn at p = 1; per-hit order; REVENGE once |
| S9 | GAP | `random` for non-index methods | Uniform over the legal answers, per method |
| S10 | GAP | `worn`, `bank`, laps, `route` | Defined |
| S11 | GAP | Measurement definitions | `balanced.act`, `spdDelta`, Probe fields |
| S12 | GAP | `simulateBattle`, the fixture | `BattleResult`, `BATTLE_FIXTURES` |
| S13 | GAP | `validateData` vs the new content | List extended |
| S14 | GAP | Stall bookkeeping | `deathKind 'STALL'`, banks `BANK_DEATH`, harness exits non-zero above 0.5 % |
| S15 | NUMBERS | Table text exceeds 30 chars | Tables state effects; blurbs authored in phase 3 |
| S16 | NOISE | Queue chips | `forecast(battle, 8)` named as presentation |

### Feasibility

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | BLOCKING | `SAFE_MARGIN_PHONE` 40 overflowed the width | `SAFE_BOTTOM_PHONE = 40`, `SKILL_H_PHONE = 80` |
| F2 | BLOCKING | Engine `TAP_MIN` 48 + warn vs contract 96 + expansion | Engine follow-up (phase 1); "drawn rect beats an expanded neighbour" |
| F3–F8 | NUMBERS | Bottom sum, PAUSE overlap, panel rows, two-row skill buttons, blurb width, card/door positions | All stated |
| F9 | NUMBERS | ARCADE ≈ 12 FSE; HD tiers still paid the CRT vignette | ARCADE = LOW's planes + CRT ≈ 9; HD tiers never call `crt.render` |
| F10 | NUMBERS | Backing-scale wording | ×1 everywhere, ×2 only on a dense desktop, chosen once |
| F11 | GAP | Part bitmaps as 1000 canvases | One atlas per element |
| F12 | GAP | Twin-id navigation; registration timing | Engine follow-up; the timing sentence |
| F13 | GAP | Orientation lock, iOS metas, the Home-Screen hint | Phase 1 / phase 4 |
| F14 | GAP | Queue, pops, log unbounded | `QUEUE_LEN 8`, `POP_MAX 16`, `LOG_KEEP 32` |

### Fun and scope

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| U1 | BLOCKING | Two heroes at the act-1 boss; pacts a 1.5-act system | The post-draft SUMMON; landmarks re-ordered (SHRINE in act 2, SUMMON in act 5) |
| U2 | GAP | The leader was only a number | FOCUS aims at the leader |
| U3 | GAP | Three kits still "fire whatever is up"; stat awakenings | Inferno ×1.0 ×2 with a BURN bonus; SABLE and LUMEN awaken into plays |
| U4 | NUMBERS | Heal-stalling beat every healing rule | `ENRAGE_TURN = 40` |
| U5 | GAP | Orphan statuses; an unnamed act 1 | The six EMBER CRYPT enemies; sources listed |
| U6 | NUMBERS | FORGE's reroll was dominated | Recast |
| U7 | NUMBERS | Three pacts always- or never-take | Re-priced (with B12) |
| U8 | NUMBERS | The lap door is not a relic bet; *n* undefined | Lap 1-based; "DESCEND is the greedy door by design" |
| U9 | GAP | The swap under-specified | HP fraction, relics, seat, un-awakened |
| U10 | NUMBERS | "≈ 95 %" oversold; no 2+2+2 lever | Wording; a 2-piece cap of two applications as phase 8's lever |
| U11 | GAP | Phase holes: PAUSE, ARCADE toggle, backdrop, kindled variants, `simulateRun`, music | Phase rows extended; no music at launch |
| U12 | NOISE | Open-question hygiene | Question 6 cut; relic movement and enemy sets stated as rules |

Conflicts settled in round 2: KO'd heroes get `KO_RETURN` and no clear heal
(D10 over S5); sigil strips are debuff-class except TRIP (C22 over D13);
the Vault-vs-ascension link stayed an open question (U8 asked to contract
it; the casual-A0 cost is the owner's call); `TURN_CAP` 500 (B4); the lap
door is honestly a score bet, not a relic bet (U8), and the death-on-lap
question was dropped as moot.

Length: after the round-2 rewrite the document stands at ≈ 1010 lines
against the ~700-line guideline. Every reviewer's cut list was applied
where the sentence carried no rule; what remains is rules and tables that
round 1 and 2 found missing. The guideline is consciously exceeded.

## Round 3 — 2026-09-05

Six lanes on the round-2 document (1010 lines). Verdicts: consistency
BLOCKING 6 / GAP 4, determinism 8 / 9, balance 0 / 2, simulability 2 / 7,
feasibility 1 / 6, fun & scope 3 / 6 — not converged. Everything below was
applied in one pass; round 4 reviews the result.

### Consistency

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | Enemy `pts.RES`: override or baseline | The comment: replaces the 15, the act/kind/A terms still add |
| C2 | BLOCKING | Two awakenings had no `SkillDef` field | `extendDebuffs?`, `refundOnKill?`; Undertow's cleanse is a number |
| C3 | BLOCKING | FURY absent from the scale formula | `× (FURY ? 1.15 : 1)` inside the round |
| C4 | BLOCKING | `vaultEquip` ran before the starter existed | Run-start order draft → vaultEquip → pool → ascension → summon → leader → buildMap |
| C5 | BLOCKING | `PactId`, `EnemyId`, `KIND_MULT`, the `BOSS_HP` replacement undeclared | Declared in Types; the `KIND_MULT` table and the BOSS hp replacement under Scale |
| C6 | BLOCKING | `RunResult.awakened` could not hold a lapped run | `awakened: string[]` |
| C7 | NUMBERS | Fourteen enemy-table cells rounded from rounded intermediates | Recomputed from the formula; the header names the base |
| C8 | NUMBERS | Four-card row 16 px off-centre | x 48/348/648/948 |
| C9 | NUMBERS | Hero-panel rows did not sum to 104 | `PANEL_PAD = 7`, gaps 4 |
| C10 | NUMBERS | `BLURB_WRAP = 22` wider than a four-wide card | Wrap by `textWidth` inside `CARD_W − 2 × CARD_PAD`, ≤ 3 lines (with F1) |
| C11 | NUMBERS | "three after five rooms" | "three by the third room" |
| C12 | GAP | REST guarantee with no FIGHT in stage 5 | Stage 4 first, then 5 / 2 / 1, else stage 4's node 0 (with D13, U4) |
| C13 | GAP | FORGE / sharpen with nothing eligible | Eligibility per mode; `forge` may return `null`; an empty FORGE is skipped |
| C14 | GAP | `DROP_LEVEL[act]` out of bounds, silent on laps | `[lap > 1 ? 5 : act − 1]` |
| C15 | GAP | A SUMMON's second card under HASTE | Every SUMMON card is EPIC, levelled as a FIGHT card |
| cuts | NOISE | Five sentences duplicating `validateData` or a later paragraph | "Laps reuse" folded into Scale; the SUMMON row shortened; three kept at their point of use |

### Determinism

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | Link spans had no start rule | `straight` / `lo` / `width` / `hi` formula, then coverage (with S5) |
| D2 | BLOCKING | RENDER's base and multiplicity | Every "% ATB" is a fraction of `ATB_TURN`; RENDER once per crit hit through the landing formula |
| D3 | BLOCKING | Cleanse-versus-heal order; what a heal is | Per-target order cleanse → heal → applies → extendDebuffs → atbBoost → MENDING; MENDING only on `heal > 0` |
| D4 | BLOCKING | HP rescale only "at equip" | On every `derive` that changes maxHp, with the 0 / 1 guards |
| D5 | BLOCKING | SCHISM's arithmetic | Curse = no leader skill; boon = own at half, unrounded (with B5, U6) |
| D6 | BLOCKING | Per-act tables on laps | `LOOT_WEIGHTS` and `DROP_LEVEL` read row 6; everything else reads the lap's act |
| D7 | BLOCKING | Turn-counter boundaries | `actorTurns` increments at entry; ENRAGE `≥` at entry; side-empty precedes the `TURN_CAP` check |
| D8 | BLOCKING | Set pool with a Vault set already drawn | Draw four, then union the worn Vault sets; the pool is the distinct ids |
| D9 | GAP | A card's slot never rolled | The slot is the relic's first draw (with S1) |
| D10 | GAP | DESTROY's strip | The rounded formula; bypasses SHIELD, never lethal |
| D11 | GAP | FURY and A10's WILL missing from enemy derivation | The FURY term; `WILL_RES` for an A10 boss |
| D12 | GAP | Step 9 after the last enemy died | Fires only while both sides have a living actor |
| D13 | GAP | REST guarantee fallback | With C12 |
| D14 | GAP | What FORGE and REST offer | With C13 |
| D15 | GAP | Invalid structured answers | Per-method fallbacks in the policy paragraph |
| D16 | GAP | A8's added NORMAL | Uniform over the biome's NORMAL ids, appended last, skipped at the cap |
| D17 | GAP | Awakening effects in `SkillDef` | With C2 |
| cuts | NOISE | Four restating sentences | "Statuses never enter derive" and "Vault relics keep their level" cut; two kept |

### Balance arithmetic

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | NUMBERS | `ENRAGE_TURN` 40 fired inside every act-5/6 boss and elite fight | 100 (U9 proposed 90; 1.5 × the reference act-6 boss fight); the harness prints enrages per boss |
| B2 | NUMBERS | VIOLENT 0.30 and WILL lost to 2+2 in their own lane | `VIOLENT_CHANCE` 0.40; `WILL_TURNS` 3 |
| B3 | NUMBERS | A LEGENDARY clamped at +4 never beat an EPIC | `LEGENDARY_MAIN_MULT` 1.5 |
| B4 | NUMBERS | DEF priced at 4 × its worth | `COMPARE_WEIGHTS.DEF` 0.25; GUARD +30 % DEF; `DEF_K` 600 named as phase 8's lever |
| B5 | NUMBERS | SCHISM had no curse | Curse = the leader's skill removed |
| B6 | GAP | THORNS was dead on every launch party | Triggers on DEF_UP **or** a SHIELD — the one round-3 change to a rule rather than a number, kept because a null sigil cannot ship |
| B7 | NUMBERS | FURY and the `BOSS_HP` replacement missing from Scale | With C3 / C5 |
| G1 | GAP | `DROP_LEVEL` on laps | With C14 |
| G2 | GAP | The fixture's base stats were unstated | The six authored bases written beside the range |

### Simulability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | BLOCKING | A relic's slot was never rolled; the per-card draw order unstated | `rollRelic` draws (1) slot … (8) sigil; forced rarities draw nothing; `Relic.id` is a counter |
| S2 | BLOCKING | No integer-draw convention | `pick(n, rng) = floor(rng() × n)` and the derived rules; `game/sim/rng.ts` in phase 2 |
| S3 | GAP | Hit × target nesting; RENDER's roll; DESPAIR under IMMUNITY | Hit-major loop; per-hit order crit → applies → DESPAIR chance → landing → RENDER |
| S4 | GAP | `vaultEquip` before the starter | With C4 |
| S5 | GAP | Span start position | With D1 |
| S6 | GAP | `RunResult` / `Probe` fields the harness prints were undefined | The definitions paragraph |
| S7 | GAP | No field behind the "two mains per open slot" check | `mainsWorn` |
| S8 | GAP | `--battles` fixture: whose `act`, what scaling | Each selected policy's `act`; enemies at act 1, lap 1, A0, no clears, no pacts; party rebuilt per battle |
| S9 | GAP | Enemy scale and loot rows on laps | With C3 / D6 |
| cuts | NOISE | Scorer pinning, `intent` on a copy, the 2+2+2 lane, v2 harness fields, declining a SUMMON | `intent` never touches the rng; a `pairs` policy; declining a SUMMON mends nothing; the scorer stays prose |

### Feasibility

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | BLOCKING | `BLURB_WRAP` overflowed the four-card row | Wrap by `textWidth`, `CARD_PAD 16`, `BLURB_LINES_MAX 3` |
| F2 | GAP | Inspect overlay and BACK had no geometry | `INSPECT`, `INSPECT_ROW_Y`, `BACK`; panel tap = target while a prompt is open, else inspect |
| F3 | GAP | PAUSE overlay targets | Three `PAUSE_BTN 400×96` at x 440, y 216 / 336 / 456 |
| F4 | GAP | Ribbon x-layout, ENRAGED marker, intent badge | `QUEUE_X / QUEUE_CHIP / QUEUE_GAP`, `NAME_X`, `ENRAGE_CHIP`, `INTENT_BADGE`, `RIBBON_RIGHT` |
| F5 | GAP | Room-to-room card | The middle card slot plus `CONTINUE` |
| F6 | GAP | Who-wears-it row x-layout | `WEAR_BTN / WEAR_X / WEAR_Y` |
| F7 | GAP | Map and party screens had no geometry | `MAP_NODE / MAP_X / MAP_Y`; party columns in the card slots |
| cuts | NOISE | `TEXT_SMALL`, `BOSS_PART` vs `ACTOR_W`, four-card centring, HIGH's tint, `QUEUE_LEN` | `TEXT_SMALL` cut, `BOSS_W 288`, the row centred; HIGH's tint and `QUEUE_LEN` unchanged (ENRAGED fits at `TEXT_BODY`) |

### Fun and scope

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| U1 | BLOCKING | `validateData` armed three phases before their tables existed | A rule arms with the phase that lands its table |
| U2 | BLOCKING | Phase 5 put two heroes at the boss again | The slice run gains a SUMMON node; awakenings as data with an `awakened` fixture flag |
| U3 | BLOCKING | Acts 3–6 had no author; phase 6 was half the game | 6a run structure (after 5), 6b biomes and ascension (parallel with 5) |
| U4 | GAP | REST was a state read, not a choice | Sharpen = every uncapped relic one member wears; the guarantee moves to stage 4 |
| U5 | GAP | The swap arrived un-awakened | The newcomer inherits the awakening |
| U6 | GAP | VEIL and SCHISM were still free | VEIL: INVINCIBLE again on the first turn below 50 %; SCHISM: curse = no leader skill |
| U7 | GAP | The free seat collapsed the leader trade-off | The seat changes only at the draft, a SUMMON, a REST or the ALTAR |
| U8 | GAP | Lap cards were junk | With C14 |
| U9 | GAP | Every boss enraged by tuning | With B1 (100, not 90) |
| cuts | NOISE | Five history / flavour sentences | Two cut (the New Game+ line, the Vault-trivialises-act-1 line); three kept as intent |

Conflicts settled in round 3: `ENRAGE_TURN` 100 (B1) over 90 (U9); the
REST guarantee prefers stage 4 (U4) with C12/D13's fallback chain behind
it; SCHISM's curse removes the leader skill (B5, U6) rather than D5's
"own in full plus half the leader's"; the blurb limit is a `textWidth`
wrap (F1) rather than a character count (C10); THORNS gained a second
trigger (B6) — the only place this round changed a rule, logged as such.
Length after round 3: 1092 lines.

## Round 4 — 2026-09-05

Six lanes on the round-3 document (1092 lines). Verdicts: consistency
BLOCKING 5 / GAP 4, determinism 11 / 1, balance 0 / 2, simulability 1 / 7,
feasibility 1 / 4, fun & scope 1 / 4 — not converged. Nearly every finding
is a one-rule refinement of text round 3 added; all applied in one pass.
Round 5 is the last the loop allows.

### Consistency

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `enrages` missing from `types.ts`; no `enraged` on `BattleResult`/`Probe` | Added to both files |
| C2 | BLOCKING | `WILL_RES` never defined | Named in the WILL row |
| C3 | BLOCKING | `CARD_W` never defined, ambiguous under HASTE | `CARD_W = 384`, `CARD_W_FOUR = 284` |
| C4 | BLOCKING | `critPts` never defined | `critPts(a, t)` after the damage block |
| C5 | BLOCKING | NEMESIS side unstated | Defender-side: the wearer gains ATB when hit; removed from the counter list |
| C6 | NUMBERS | WILL parenthetical still explained 2 | "3 covers every enemy action before the wearer's third turn" |
| C7 | NUMBERS | "stat buffs authored at 3" vs SPD_UP 2 | SPD_UP named as the exception |
| C8 | NUMBERS | `SAFE_MARGIN = 24` vs the engine's 8 | `setSafeInset` at boot; the engine constant untouched |
| C9 | GAP | A BURN death could not name its enemy | `Status.by` (applier's slot), max-merge keeps the winner (with D12) |
| C10 | GAP | VEIL's second INVINCIBLE had no step | Between steps 5 and 6, once per battle (with S1, D5) |
| C11 | GAP | HASTE / DEARTH on a full-party SUMMON | Pact card adjustments apply to FIGHT/ELITE/LOOT/BOSS only |
| C12 | GAP | `clears`, `relicLevels`, `turnsPerBattle` undefined | Defined in the RunResult paragraph |
| cuts | NOISE | Five restating sentences | The bank bullet, the packs sentence and "drawn whenever not blocked" cut; the biome sentence kept (it introduces the table); the UI opener cut |

### Determinism

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | ENRAGE once or every turn | Every ENRAGED turn applies ATK_UP `ENRAGE_TURNS = 2`, refreshed by max |
| D2 | BLOCKING | `extendDebuffs` and "already on" | Live list at the moment it runs, this cast's included; never blocked, never triggers LOCKDOWN/TRIP |
| D3 | BLOCKING | A killing hit versus "always drawn" | A target at `hp ≤ 0` is dead at once and takes no further part in the cast |
| D4 | BLOCKING | `leech` plus VAMPIRE | Two heals, each rounded and capped after the previous |
| D5 | BLOCKING | VEIL's second INVINCIBLE | With C10 / S1 |
| D6 | BLOCKING | OPENER and a cooldown-0 first cast | Consumed by the battle's first cast whatever its cooldown |
| D7 | BLOCKING | THORNS kindled `applyBreak` position | Appended to the counter's skill-1 `applies`, per hit, before DESPAIR |
| D8 | BLOCKING | FORGE RECAST draws | Key by `pick` over the pool minus main and current keys, then `rolls` values summed (with S3) |
| D9 | BLOCKING | HP rescale granularity | One `derive` per member per screen action; old and new maxHp bracket the action |
| D10 | BLOCKING | A8's NORMAL id order | First-appearance order over `fights` then `elites` (with S5) |
| D11 | BLOCKING | TRIP and DESPAIR's STUN | Fires on every SLOW/STUN landed through the formula, refreshes and DESPAIR included |
| D12 | GAP | `deathBy` on a BURN death | With C9 |
| cuts | NOISE | Five restating sentences | Four cut ("Heal-stalling", the DEF/HP/SPD-scaling line, "recompute after EVERY turn", "A build that wants speed…"); the WILL parenthetical rewritten |

### Balance arithmetic

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | NUMBERS | The 2+2+2 fallback cap at two applications was a no-op (`SET_POOL.two = 2`) | Cap at one application; `DESTROY_DEALT` 0.40 |
| B2 | NUMBERS | WILL text still justified 2 | With C6 |
| G1 | GAP | The reference party's per-action multiplier unstated | "at a kit-average skill multiplier of 1.4 per action" |
| G2 | GAP | "Clear margin" had no number | ≥ 1.10 × `pairs` on act-6 clears, identical seeds |
| — | — | Checked clean: all 54 enemy cells, the RES column, ladder, bank, LEGENDARY 1.5, GUARD vs ENERGY, REST sharpen vs heal, VEIL and SCHISM takeable, ENRAGE 100 silent on lap 1, THORNS live via shields, the six bases | Least sure: ENRAGE 100 against the lap-2 act-6 boss (94–103 actor turns) |

### Simulability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | BLOCKING | VEIL's second INVINCIBLE had no step | Between steps 5 and 6, `hp < round(0.5 × maxHp)`, once per battle, BURN and stunned turns count |
| S2 | GAP | Counter hook placement and interleave | After the step-8 write, before step 9; per hero in slot order, each counter resolved before the next check |
| S3 | GAP | FORGE RECAST draw count | With D8; `random` draws the substat after its (relic, mode) pick |
| S4 | GAP | `vaultEquip` validity vs `random`'s draw | Invalid-entry definition; `random`: `c = pick(slots + 1)` then c picks over free-slot relics |
| S5 | GAP | A8's NORMAL-id order | With D10 |
| S6 | GAP | `pairs` was one clause | Defined: `balanced` with 4-piece-avoiding `relic` and `forge`; ninth policy |
| S7 | GAP | `--battles` rows and enrage fields | Per policy × pack rows with reseeding; `enraged`, `heroTurns`, `bossHp`, `dmgDealt`, `clears`, `turnsPerBattle` defined; `spawnPack` exported |
| S8 | GAP | `--spd` semantics | `--spd n` per row; bare `--spd` runs the ±10 gate and exits non-zero below 20 |
| cuts | NOISE | `DAMAGE_JITTER`, `outSped`, `KIND_MULT.BOSS.hp`, the `--battles` default, the `awakened` fixture flag | `DAMAGE_JITTER` retired from the doc and `types.ts`; the default narrowed to distinct `act`s; the rest kept |

### Feasibility

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | BLOCKING | Inspect set-bonus band overflowed and collided with BACK | `SET_BAND = (48, 536, 968, 112)`, `SET_LINE_Y = 540 / 576 / 612` |
| F2 | GAP | Skill bar had no x | `SKILL_X = 28 / 440 / 852`, `SKILL_HIT = (SKILL_X[i], 600, 400, 120)` |
| F3 | GAP | Ribbon chip y; the log rect | `QUEUE_Y = 32`, name at y 40, `LOG = (24, 558, 1232, 32)` |
| F4 | GAP | Party SWAP · BACK slots | `PARTY_SWAP`, `PARTY_BACK`, group `party` |
| F5 | GAP | GAME OVER / VICTORY primary target | Reuse `CONTINUE`; the act-6 VICTORY shows the doors; an end-screens row |
| cuts | NOISE | Stage x-range, the atlas rule, ARCADE on LOW, 56-px party rows, `WEAR_X` alignment | All five applied: stage 312–968, the atlas rule became the observable budget, ARCADE-on-LOW drops halation and lift, `PARTY_ROW = 64` with the column as the region, the WEAR row is its own grid |

### Fun and scope

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| U1 | BLOCKING | 6a promised laps, the Vault and ascension on a two-act run; ASCENSION assigned to 6b | 6a owns ascension and follows 5 and 6b |
| U2 | GAP | Act 2 had an owner but no minimum | Phase 2 authors both biomes to the 6b minimum (act 2 was already in flight under phase 2) |
| U3 | GAP | Phase 5 shipped the swap where no SUMMON could be full | The phase-5 run gains a second SUMMON before the boss |
| U4 | GAP | REST read as always-sharpen | `RunResult.rests`; `balanced.rest` with `REST_HEAL_AT = 0.50`; a 25–60 % HEAL target and `SHARPEN_RELICS` as the lever |
| U5 | GAP | The seat and the SHRINE had no target; pacts and swaps left no trace | `RunResult.pacts`, `swaps`; leader and pact targets; `balanced.shrine` 50/50 |
| cuts | NOISE | Five history / rationale sentences | Three cut (MAG/MDEF/DODGE, "the price of never kindling", "Heal-stalling"); "Percentage caps are retired" was not found; the slot-table sentence cut with D |

Conflicts settled in round 4: VEIL's second INVINCIBLE sits between steps 5
and 6 (S1) rather than at step 7 (D5, C10) — after the tick, before the
stun check; `Status.by` is a slot index (D12) rather than a def id (C9);
act 2 stays in phase 2 (it was being authored) but to 6b's minimum (U2);
the counter hook follows S2's placement with D7's THORNS rule inside it.
Length after round 4: 1129 lines.

## Round 5 — 2026-09-05 (final)

Six lanes on the round-4 document (1129 lines). Verdicts: consistency
BLOCKING 2 / GAP 1 on its first pass (the reviewer was cut off by a rate
limit after three findings; a second pass completes the lane below),
determinism 6 / 1, balance 0 / 0 (CONVERGED, with five NUMBERS),
simulability 0 / 2, feasibility 0 / 3, fun & scope 1 / 2. Not converged
on the loop's definition, but every finding was one rule or one number
and all were applied.

### Consistency

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| C1 | BLOCKING | `EnemyId` declared in the Types block but not in `types.ts`; `SigilDef.blurb`'s comment named an undefined `BLURB_WRAP` | `EnemyId` added and used by `Biome` and `EnemyDef`; the comment rewritten |
| C2 | BLOCKING | BOOTS SPD called a "fixed" main in the derivation, an open slot in the table | "and a BOOTS SPD main when rolled" |
| C3 | GAP | The counter procedure was hero-side only; Brace puts COUNTER on an enemy | With D5 |
| C4 | BLOCKING | "declining mends `SKIP_MEND`" named `LOOT_COUNT`'s five sources, SUMMON included, while Building a party says a declined SUMMON mends nothing | The exception named where the rule is stated |
| — | — | Second pass checked clean: every CAPS constant against `types.ts`, all 54 scale cells, the ladder, bank, clamps, every weights row, the 11 ascension rows, the 12 modifiers, 10 set kinds, 12 sigils, every region rectangle against both insets | — |

### Determinism

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| D1 | BLOCKING | LOCKDOWN's +1 before or after the refresh max | Before: `max(remaining, apply.turns + extra)`; blocked with the application; only `extendDebuffs` and RENDER's kindled +1 pass IMMUNITY |
| D2 | BLOCKING | OPENER: the wearer's first cast or the battle's | The wearer's first non-counter cast |
| D3 | BLOCKING | GRUDGE: crossing hit or every hit | The crossing hit, right after the NEMESIS check, refreshed by max |
| D4 | BLOCKING | ENRAGE off by one | `actorTurns += 1` first; ENRAGED iff the incremented value ≥ `ENRAGE_TURN` |
| D5 | GAP | An enemy holding COUNTER | The hook runs after ANY actor's step-8 write, per opposing actor hit |
| D6 | BLOCKING | Map step 5: which successors turn FIGHT | Only successors that are themselves REST |
| D7 | BLOCKING | `random`'s REBRAND set domain | `pick(pool.length − 1)` over the pool minus the current set |
| cuts | NOISE | VEIL's "(until their first turn starts)", BASTION's base, `balanced.act`'s heuristic | The VEIL gloss cut; the others kept |

### Balance arithmetic

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B1 | NUMBERS | `SHARPEN_RELICS` could not move the HEAL rate it was the lever for | `REST_HEAL_AT` is the lever (0.50 → 0.60 raises it) |
| B2 | NUMBERS | HASTE's curse ≈ 2.4 × its boon | Enemy SPD ×1.2 → ×1.1 |
| B3 | NUMBERS | NEMESIS at 0.15 weaker than one SWIFT pair | `NEMESIS_ATB` 0.40 |
| B4 | NUMBERS | The fallback fired at 1.00 × while the rule needed 1.10 × | "if any 4-piece falls short of 1.10 ×" |
| B5 | NUMBERS | "37 with an ATK leader and DEF_BREAK" | 27, with DEF_BREAK up |
| — | — | Checked clean: DESTROY 0.40 under the cap, ENRAGE refresh, the three low-value leaders under FOCUS, the one-application cap with `SET_POOL.two = 2`, clears per act | Least sure: the HASTE boon's worth (+4.4 % stats in a toy model) |

### Simulability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S1 | GAP | `leader()` order at SUMMON / REST / ALTAR | After the room's own answer and its effects |
| S2 | GAP | Pact decliners had no field | `RunResult.shrines` (with U1) |
| cuts | NOISE | The harness's "hp end" column; the arming clause | The arming clause cut (rules check the tables that exist); the column stays out of the contract |

### Feasibility

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | GAP | The leader seat had no target | `PARTY_LEADER = (344, 552, 280, 96)` |
| F2 | GAP | The draft had no region | `DRAFT_CARD 284 × 136`, `DRAFT_Y = 88 / 240 / 392` |
| F3 | GAP | Decline on single-step card screens | `SKIP = CONTINUE` under every card row |
| cuts | NOISE | ARCADE-on-LOW's flicker, phones starting ARCADE low, the dead ×2 measurement | `flicker: 0` added and the budget restated at 5.6; phones start ARCADE low; `main.ts` now measures the canvas's future CSS width so ×2 is reachable |

### Fun and scope

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| U1 | BLOCKING | The pact target read a population the run never recorded | `shrines: { pact, taken }[]`; takers vs decliners defined; a harness row per pact |
| U2 | GAP | The route had no reference rule and no target | `balanced.route` with `ELITE_ENTER_AT = 0.60`; a 75–90 % ELITE win-rate target with `KIND_MULT.ELITE.hp` as the lever |
| U3 | GAP | The full-party SUMMON was a free EPIC against a free nothing | `balanced.summon` by element; a `swaps ≥ 1` target with `SWAP_FRESH` as the lever |
| cuts | NOISE | The Vault overflow screen, A8's pack mutation, the ×2 backing store | None applied: the overflow rule is already the sim's default, A8 and ×2 stay as contracted |

Conflicts settled in round 5: the leader seat's region sits in the WEAR
grid's second column (F1) and `PARTY_BACK` moves to index 2; HASTE's curse
is ×1.1 by balance (B2) while the pact target (U5 of round 4) remains the
check on it. Length after round 5: 1156 lines.

## Outcome

Five rounds, 2026-09-04 → 2026-09-05. Findings triaged: round 1 ≈ 95,
round 2 ≈ 99, round 3 ≈ 58, round 4 ≈ 44, round 5 ≈ 21 — every BLOCKING,
NUMBERS and GAP item applied, NOISE discarded and listed. The loop did not
reach the formal bar (a full round with zero BLOCKING and zero GAP): round 5
still produced eleven one-rule findings, all in text that rounds 3–4 had
added, and the balance lane alone declared CONVERGED. The document is at
1156 lines against the ~700 guideline; the excess is the rules and tables
the first two rounds found missing, and the review judged each necessary.
Four questions remain open for the owner (see *Open questions* in
DESIGN.md); each has a default in the contract so the build never waits.

## Owner decisions — 2026-09-05

After round 5 the owner answered the open questions: (1) a fallen hero
keeps the simple default; (2) elements become crit up versus the glance
(no damage multiplier; `GLANCE_CHANCE` 0.50, `GLANCE_MULT` 0.70, a GLANCE
debuff sourced by Squall and Wail — the paper estimates that used ×1.30
are re-derived at phase 8); (3) the Vault–ascension link was left to the
reviewer and decided as independent, with an act-1 target that turns the
link on if Vault runs at A0 prove trivial; LIGHT and DARK never glance and
are advantaged against each other both ways (`ELEMENT_CRIT_LD` as phase
8's lever); (4) all six characters unlocked at launch.
