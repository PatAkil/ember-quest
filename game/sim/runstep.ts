// Ember Quest v3 — sim/runstep.ts: the interactive wrapper around sim/run.ts's
// `runSteps`. Headless, to the same rule as every other file under sim/: no
// engine import, no DOM, no browser storage, no ambient randomness (the rng is
// injected) — and it decides nothing itself. A screen asks what the
// run is waiting on (`pending()`), draws it over `state()`, and hands back one
// answer (`decide`); every rule, every legality check and every fallback stays
// in game/sim/run.ts. DESIGN.md → Run structure, Difficulty targets.
//
// The token: `token()` changes exactly when the run moves — a screen captures
// it with the pending it drew and can tell a landed answer from a stale one.
// `decide` is not re-entrant (an answer raised from inside a decide is
// dropped), and is a no-op once the run is over.

import type { Rng, RunConfig, RunResult } from '../types';
import { runSteps } from './run';
import type { RunObserver, RunPending, RunPendingKind, RunSnapshot } from './run';

/** What the run is waiting on, for a screen router: the pending's own kind, 'ROOM' between decisions (the
 * generator is never idle there, so only a torn state shows it) and 'DONE' once the RunResult exists. */
export type RunPhase = RunPendingKind | 'ROOM' | 'DONE';

/** Everything a screen needs to draw the run without re-deriving a rule: run.ts's live snapshot plus which
 * decision is open. Read-only — mutating it does not reach the run. */
export interface RunView extends RunSnapshot {
  phase: RunPhase;
  over: boolean;
}

/** One interactive run. `state()`/`pending()`/`token()` are cheap reads; `decide` is the only mover. */
export interface Run {
  state(): RunView;
  pending(): RunPending | null;
  token(): number;
  /** Answer the open pending. Anything at all may be passed: an illegal answer travels into run.ts untouched
   * and that decision's own fallback decides it. Ignored when the run is over or a decide is already running. */
  decide(answer: unknown): void;
  /** The finished run, or null while it is still going. */
  result(): RunResult | null;
}

/**
 * Starts a run and advances it to its first decision. `rng` is the run's only randomness — the caller owns it
 * (mulberry32(seed) for a reproducible run, the platform's own source at the boot of a real game).
 */
export function createRun(config: RunConfig, rng: Rng): Run {
  const observer: RunObserver = {};
  const steps = runSteps(config, rng, observer);
  let pending: RunPending | null = null;
  let result: RunResult | null = null;
  let token = 0;
  let busy = false;

  function advance(answer?: unknown): void {
    busy = true;
    try {
      const step = steps.next(answer);
      if (step.done) { result = step.value; pending = null; } else { pending = step.value; }
      token += 1;
    } finally {
      busy = false;
    }
  }

  advance();

  function phaseOf(): RunPhase {
    if (pending) return pending.kind;
    return result ? 'DONE' : 'ROOM';
  }

  return {
    state(): RunView {
      const read = observer.read;
      if (!read) throw new Error('createRun: the run never started — runSteps published no snapshot');
      return { ...read(), phase: phaseOf(), over: result !== null };
    },
    pending: () => pending,
    token: () => token,
    decide(answer: unknown): void {
      if (busy || !pending) return;
      advance(answer);
    },
    result: () => result,
  };
}
