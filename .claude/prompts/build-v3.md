# Prompt — build Ember Quest v3, with verification built in

Run this against the Ember Quest repo for a long autonomous session. It builds
the game and validates its own work as it goes.

---

You are building **Ember Quest v3**. The design is settled and written down:
read `DESIGN.md` at the repo root **in full** before you touch anything, then
`CLAUDE.md` for repo conventions, then the skills in `.claude/skills/`.

`DESIGN.md` is the contract. It wins every argument. If you believe it is
wrong, you may say so in your final report — but you build what it says.

## The one thing that matters most

You will not finish all eight phases. **Do not try.**

The person reading your work has to be able to *play it*. A polished, playable
vertical slice beats eight half-built systems every time. So:

> **Get to end of phase 4 — a playable, beautiful 3v3 battle — and make it
> excellent. Only then move on.**

Phases 1–3 leave the game unplayable in between; phase 4 is where it comes
back. Treat phases 1→4 as one indivisible push. Everything after phase 4 is
upside, taken in the contract's order, each one landed complete rather than
three started.

If you have to choose between breadth and polish, choose polish. Every time.

## Ground rules

- **Work on a branch.** `git checkout -b v3`. `main` keeps serving the
  playable v2 build and you never commit to it.
- **Never push to `main`. Never deploy. Never run the `releasing-the-game`
  skill.** Pushing the `v3` branch is fine.
- **Never claim you playtested.** You cannot play the game. The correct
  phrasing is "builds, boots clean, ready to play at <URL>".
- **Never stub something and call it done.** A phase is done when it does what
  the contract says, not when it compiles.
- **Never weaken a gate to pass it.** Do not delete a failing check, loosen a
  type, add `any`, or `@ts-ignore` your way through. If a gate fails, the code
  is wrong.
- **Respect the headless boundary.** `game/data/*` and `game/sim/*` import
  neither the engine nor the DOM, ever. Breaking this silently kills the
  balance simulator, which is the only way this game gets tuned.
- Keep `DESIGN.md` true. A rules change edits the contract in the same
  milestone that changes the code.

## Gates

- `npm run check` after **every** edit.
- `npm run build` **and** `npm run smoke` green before **every** commit.
- `npm run sim` reviewed whenever rules or numbers moved.
- Commit at every green milestone, unsigned. Message = what changed.

## The build loop

For each phase in `DESIGN.md`'s delivery table, in order:

### 1. Plan the milestone
Break the phase into milestones of roughly one module each. Write them down.
Data and rules before presentation, always.

### 2. Build
Write the code. Match the surrounding style — this repo has a strong voice and
a documented engine API; extend it, do not fight it. New engine primitives go
into the owning module, are re-exported from `engine/index.ts`, and are added
to the API table in `CLAUDE.md` in the same change.

### 3. Verify — this is not optional

After each milestone, **before committing**, run an adversarial pass on your
own work. Use parallel subagents; give each a single lens:

- **Contract conformance.** Diff the behaviour against `DESIGN.md` clause by
  clause. Every constant named in the contract exists with that name. Every
  rule is implemented, not approximated. Report anything you silently skipped.
- **Correctness.** Hunt real bugs: off-by-one in the ATB carry, statuses
  ticking on the wrong actor's turn, stacking applied twice, rounding drift,
  a dead branch, an unhandled empty party, division by zero when DEF is 0.
- **Simulability.** Confirm `esbuild game/sim/run.ts --bundle` still produces
  a runnable bundle and the headless boundary holds.
- **Feel and performance** (once anything renders). Frame budget at 1280×720,
  per-frame allocations, uncached blur passes, fill-rate. Does it hold 60 Hz?

Then **fix everything that pass found, and run it again.** Repeat until a
verification pass comes back clean. A milestone is not done until it does.

If a gate or a verification finding defeats the same approach **twice**, stop
repeating it — change the approach. Write down what you tried and why it
failed before trying something different.

### 4. Commit
Only when green and only when verification is clean.

## The bar for phase 4

Phase 4 is what gets looked at first. It is not done when it works. It is done
when it looks deliberate:

- Turn order is legible at a glance — you can see who acts next and why.
- Damage, crits, status applications and resists each *read* differently. A
  resisted debuff must never look like a landed one.
- Something moves on every action. Nothing teleports.
- The HD-2D rule from the contract holds: exactly one plane is pixelated.
  Light, particles, fog, UI and text stay smooth at 720p. If the effects look
  pixelated too, the whole look collapses into "low resolution" and you have
  failed the brief.
- It is readable on a phone in landscape, and playable by touch **and**
  keyboard. Every tap target has a keyboard route added in the same change.

## When you stop

Whenever you finish — done, blocked, or out of budget — leave the repo in a
state someone can pick up cold:

1. The working tree is **clean and green**: `check`, `build` and `smoke` all
   pass on the last commit. Never leave a broken tree behind.
2. Write `STATUS.md` at the repo root:
   - which phases are **complete**, which is **in progress** and exactly where
   - how to run it (`npm run dev`, the URL, what to press or tap)
   - what to look at first
   - **what is not done, and what is faked** — be specific and honest
   - every verification finding you chose not to fix, and why
   - anything in `DESIGN.md` you think is wrong now that you have built it
3. In your final message: what you built, what genuinely works, what does not,
   and the single next thing you would do. Report failures plainly. An honest
   "phase 5 is half-built and the SUMMON screen is a placeholder" is worth far
   more than a confident summary that falls apart on first launch.

End every commit message with:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```
