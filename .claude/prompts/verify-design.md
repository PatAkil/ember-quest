# Prompt — design verification loop (Ember Quest v3)

Run this against the Ember Quest repo. It improves `DESIGN.md` and nothing else.

---

You are the design reviewer and editor for **Ember Quest**, a TypeScript +
Canvas 2D roguelike. `DESIGN.md` at the repo root is a brand-new **v3 systems
contract that no code implements yet**. Your job is to make that contract
airtight before anyone builds against it.

## Hard constraints

- **You may edit `DESIGN.md` and no other file.** Do not write game code, do
  not touch `game/`, `engine/`, `index.html`, `package.json`, or the skills.
- **Do not redesign the game.** The direction is settled and was chosen
  deliberately by the owner: 3v3 party combat, SPD-driven attack bar,
  cooldowns instead of MP, eight stats, five elements, slot-gated rolled
  relics with sets, six acts then laps, the Vault, 1280×720 HD-2D, native
  touch with keyboard parity. Your job is to make *this* design correct and
  implementable, not to propose a different one.
- **Preserve the document's voice and structure.** It is written as a contract
  in prose plus tables, tuned constants named in `CAPS`, and it is deliberately
  opinionated. Match it. Do not turn it into a bullet-point spec.
- Read `CLAUDE.md` first for repo conventions, and read `game/types.ts`,
  `game/data.ts`, `game/sim.ts` — these are the **v2** implementation that v3
  replaces. They tell you the conventions and quality bar the contract must
  live up to, and they reveal things v2 got right that v3 may have dropped.

## The loop

Repeat until the convergence test below passes, to a **maximum of five
rounds**. Each round:

### 1. Review

Attack the current `DESIGN.md` on all six dimensions. Use parallel subagents
where it speeds you up; give each one a single dimension.

1. **Internal consistency.** Types named but never defined (`TargetSpec`,
   `StatusApply`, `LeaderSkill`, `Element`, `SkillId`, `RelicBase`, `Stats`,
   `elementMult`, `afterResist`, …). Contradictions between sections. Numbers
   that disagree. Constants referenced but never given a value.
2. **Determinism.** Anything a programmer could implement two different ways
   and both match the text. Ordering (statuses vs cooldowns vs ATB vs regen
   within a turn), stacking (two ATK_UPs? a 2-set and a 4-set granting the
   same stat — additive or multiplicative?), rounding, tie-breaks (equal SPD,
   equal ATB), and edge cases (whole party stunned; a relic whose only substat
   collides with a rerolled main stat; SUMMON with a full party; a full Vault;
   dying on a lap).
3. **Balance arithmetic.** Do the stat scales cohere? Work the numbers: how
   many hits to kill at act 1, at act 6, on lap 2? Is a fully-geared character
   1.5× or 10× a naked one? Do flat substats sit in a sensible band against
   percentage ones? Does VIOLENT compound dangerously with high SPD? Are any
   sets obviously dominant or obviously dead?
4. **Simulability.** The contract's whole balance story depends on
   `game/data/*` and `game/sim/*` staying headless so `esbuild` can bundle
   them for a Monte Carlo simulator. Does anything in the design require the
   engine or the DOM in those modules? Is any mechanic specified in a way the
   simulator cannot evaluate (needs player timing, aiming, or reflexes)?
5. **Feasibility at 1280×720.** Produce a real pixel budget for the battle
   screen: 3 hero panels, up to 3 enemies at ~192 px tall, turn-order ribbon,
   skill bar with cooldown pips, status stacks (6 per actor), battle log, and
   HP/ATB gauges per actor. Does it fit without overlap? Do the stated text
   limits hold at a 7×11 font? Flag the HD-2D passes that will blow a 60 Hz
   frame budget on a mid-range phone.
6. **Fun and scope.** Does each system add a *decision* rather than a stat?
   Is any phase secretly three phases? Is there a system that sounds good on
   paper and is dead weight in play? Say so plainly.

### 2. Triage

Sort every finding into:

- **BLOCKING** — a programmer cannot implement this without guessing.
- **NUMBERS** — implementable, but the value is wrong and you can show why.
- **GAP** — a real case the contract never mentions.
- **NOISE** — stylistic, speculative, or a matter of taste. **Discard these.**
  Do not pad the contract to look thorough.

### 3. Apply

Edit `DESIGN.md` to resolve every BLOCKING, NUMBERS and GAP finding. Rules:

- Fix by **specifying**, not by deleting the mechanic. If a rule is ambiguous,
  pick the option that best serves the design's stated goals and write it down
  as a decision, with its constant named.
- When you change a number, state the arithmetic that justifies it in the
  document, briefly — the contract is meant to be argued with later.
- If a genuine fork needs the owner's judgement (a real trade-off, not a
  detail), do **not** silently pick one. Add it to the **Open questions**
  section at the end of the document with the options and your recommendation.
- Keep the document tight. If it grows past ~700 lines, you are over-writing.

### 4. Re-review

Re-run the dimensions your edits touched. Fixes create new inconsistencies;
find them.

## Convergence test

Stop when **a full review round produces zero BLOCKING and zero GAP findings**,
or when you have completed five rounds. Do not keep polishing past that — a
contract that never converges is worse than one with three open questions.

## When you finish

1. Leave `DESIGN.md` complete, self-consistent, and ending with an **Open
   questions** section listing anything you deliberately left to the owner.
2. Write `DESIGN-REVIEW.md` at the repo root: what changed and why, round by
   round, in a table — finding, severity, resolution. Include the findings you
   discarded as NOISE and why, so the owner can overrule you.
3. Commit both files, unsigned, on a branch named `design/verify`. Do **not**
   push to `main`. Commit message = what changed about the design.
4. In your final message, state plainly: how many rounds you ran, whether it
   converged, the three most important things you changed, and every open
   question. If something is still wrong and you could not fix it, say so —
   do not report success you did not achieve.

End every commit message with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```
