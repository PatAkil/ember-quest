---
name: balancing-with-the-simulator
description: Use after any change to rules, numbers, items, enemies, spells, drop rates, or map topology — anything in game/types.ts, game/data.ts, or game/sim/ — and whenever the user says the game feels too easy, too hard, or samey. Monte Carlos thousands of runs per policy and compares against DESIGN.md's difficulty targets before and after.
---

# Balancing with the simulator

`game/sim/` holds every rule the game plays by, headless, one concern per file; `game/sim.ts` is its barrel. `sim/run.mjs` bundles the barrel with esbuild and runs full runs under each named policy in `POLICIES` (`game/sim/policies.ts`: a button-masher, a sane balanced player, a glass cannon, a tank, and two routing archetypes). Thousands of runs take seconds. Never tune by feel alone.

## The loop

1. **Baseline before the change.** From a clean tree (or the last commit):
   ```
   node sim/run.mjs --json > /tmp/sim-before.json
   npm run sim
   ```
   The text form is for reading; the JSON is for diffing (`node sim/run.mjs --json | cmp - /tmp/sim-before.json` is silent when nothing moved — the proof a refactor left the rules alone). `npm run sim:quick` (500 runs, balanced and random) is the fast sanity line `npm run verify` prints.
2. **Make the change** (via iterating-on-a-game; `npm run check` and `npm run lint` after every edit).
3. **Run again and compare**:
   ```
   npm run sim
   ```
   Options: `--runs N` (default 2000; use 5000 for a final number), `--policy balanced,random` to focus, `--seed N` to vary. Same seed + same code = same numbers, so a diff is the change and nothing else.
4. **Judge against the contract** (`DESIGN.md` → *Difficulty targets* and *Balance state*):

   | line | target |
   |---|---|
   | balanced win | 15–25 % |
   | balanced reach act 2 / 3 / 4 | ≥ 70 % / ≈ 50 % / ≈ 35 % |
   | random win | < 5 % (and it should die mostly in act 1) |
   | glass and tank | both viable — neither at 0 %, neither above balanced by much |
   | act-4 boss vs balanced | ≈ 10–12 hero turns to kill; a hit ≈ 20–25 % of max HP |

   Read the *deaths* line too: a boss killing 60 % of runs is a wall, an elite killing healthy heroes is a trap, `NORMAL` deaths in act 3+ mean stat inflation outran the hero. `top killers` names the specific enemy to retune.
5. **Retune the smallest knob.** Prefer a constant in `types.ts` (`ACT_MULT`, caps, `SP_GAIN`, drop chances) or one enemy line in `data.ts` over a rules change in `game/sim/`. One knob per run so the diff stays attributable.
6. **Record the new state.** When the numbers land, update the *Balance state* table and date in `DESIGN.md` in the same milestone. The table is how the next context knows what "balanced" meant when the code was last touched.

## When a new mechanic is not in the policies

The policies only exercise what they know. A new decision (a class pick, an event choice, a curse) needs a `Policy` field (`game/sim/model.ts`) and one line in each archetype in `game/sim/policies.ts` saying how that archetype decides — and the `random` policy must decide randomly, so the button-masher floor stays honest. A mechanic no policy can act on is invisible to balance and will be tuned wrong. The simulator's map lives in `game/sim/map.ts`, separate from the map the screens play (`game/mapgen.ts`): a topology change goes into both, and `DESIGN.md` records a known gap between them.

## Telemetry lives in `RunResult`

Add a counter there (harness-only, optional; `RunResult` and `Probe` live in `game/sim/run.ts`) rather than logging inside rules — `console` is a lint error in `game/`: `sim/run.mjs` aggregates whatever `RunResult` and `Probe` carry, and a new field is a one-line addition to the report.
