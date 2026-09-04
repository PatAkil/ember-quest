---
name: designing-mechanics
description: Use when a request adds, removes, or reshapes a game system (a new act, meta-progression, classes, synergies, events, a new loot source) or when "more replayable / longer runs / more fun" is asked without a concrete mechanic. Puts the trade-offs on the table, gets a decision, and turns it into a DESIGN.md contract before any code moves.
---

# Designing mechanics

`DESIGN.md` is the contract every module follows and the simulator measures against. Mechanics work starts there, not in `main.ts`. The user decides; Claude lays out the options and recommends one.

## 1. Frame the change against the run

Ember Quest is a roguelike: the unit of fun is one **run**, and replayability is "the next run is a different decision problem". Before proposing anything, place the request on these axes and say which it moves:

- **Run length** — clears per run (≈13 for a balanced hero today), acts, rooms per act. Longer is not better by itself; longer with the same decisions is padding.
- **Decision density** — how often the player chooses something that matters (route, boss card, slot replacement, point spend). Every new system should add a decision, not a stat.
- **Build variety** — the number of distinct winning shapes the policies can find. If `glass`, `tank` and `balanced` all converge on the same items, the pool is the problem, not the numbers.
- **Between-run progression** — unlocks, classes, a codex, a starting-relic draft. The only way a *lost* run pays forward. Kept small: permadeath must keep its teeth.
- **Variance** — events, curses, mutators, elite affixes. Turns "again" into "what will it throw at me this time".

## 2. Put two or three options on the table

For each option, one line each: what it adds, what it costs (complexity, new UI screens at 240×160, sim work), which axis it moves, and a rough size (a milestone, a night, a weekend). Recommend one and say why. Then **stop and ask** — this is the one place in the loop where blocking for the user is right: the wrong mechanic built well is wasted night.

## 3. Write the contract before the code

When the direction is agreed, edit `DESIGN.md` **first**:

- new types and tuning constants go into the Progression / Items / Combat sections with their names (`types.ts` will carry them);
- new screens get a line in *UI constraints* (label lengths, panel placement, which screen they interrupt);
- **difficulty targets** get restated if the change is meant to move them (a fifth act changes "full run 15–25 %"; a meta-unlock that starts the hero stronger changes act-1 clear);
- the module layout table stays true: rules in `sim.ts`, data in `data.ts`, presentation in `main.ts`. A mechanic the simulator cannot run is a mechanic that cannot be balanced — if it needs player skill (timing, aiming) it belongs in presentation only.

## 4. Then build in milestones

Hand to **iterating-on-a-game**: data + sim first (headless, `npm run check`, then **balancing-with-the-simulator** to see the new system move the numbers), presentation second (screens, sprites, juice), quality pass last. A mechanic is done when its policy line in the sim report is where the contract says it should be *and* the user has played it.
