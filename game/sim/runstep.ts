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

/** Everything a screen needs to draw the run without re-deriving a rule: run.ts's snapshot of the run plus
 * which decision is open. The party, Vault, map, path, rooms and offer arrays are COPIES made when the run
 * last moved — writing to them changes nothing in the run (and is pointless: the next `state()` after a
 * `decide` hands back a fresh set). `def`, `Relic` and `biome` objects inside them are shared immutable data
 * from game/data — never write to those. */
export interface RunView extends RunSnapshot {
  phase: RunPhase;
  over: boolean;
}

/** One interactive run. `state()`/`pending()`/`token()` are cheap reads; `decide` is the only mover. */
export interface Run {
  state(): RunView;
  pending(): RunPending | null;
  /** Identifies the decision that is open right now: it changes exactly when the run moves. Capture it with
   * the pending you drew and PASS IT BACK to `decide` — that is what makes a stale answer (a double tap, a
   * queued input, a handler that fired after the run already moved on) a no-op instead of an answer to
   * whatever decision came next. */
  token(): number;
  /**
   * Answer the open pending; returns whether the answer landed. Anything at all may be passed as `answer`: an
   * illegal one travels into run.ts untouched and that decision's own fallback decides it.
   *
   * Pass `token` — the value `token()` had when you drew the pending you are answering — and the answer is
   * refused (false, nothing moves) unless it is still the open decision. Omitting it answers whatever is open
   * now, which is what a headless driver wants and what a screen almost never does.
   *
   * Also false, with nothing moved, when the run is over or when called from inside another `decide`.
   */
  decide(answer: unknown, token?: number): boolean;
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
  /** The view for the CURRENT token, built at most once however often a frame asks for it — snapshotting a
   * party and a map per frame would be real garbage for a value that cannot change until the run moves. */
  let view: RunView | null = null;

  function advance(answer?: unknown): void {
    busy = true;
    try {
      const step = steps.next(answer);
      if (step.done) { result = step.value; pending = null; } else { pending = step.value; }
      token += 1;
      view = null;
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
      if (view) return view;
      const read = observer.read;
      if (!read) throw new Error('createRun: the run never started — runSteps published no snapshot');
      view = { ...read(), phase: phaseOf(), over: result !== null };
      return view;
    },
    pending: () => pending,
    token: () => token,
    decide(answer: unknown, expected?: number): boolean {
      if (busy || !pending) return false;
      if (expected !== undefined && expected !== token) return false; // a stale answer, for a decision already made
      advance(answer);
      return true;
    },
    result: () => result,
  };
}
