import { join } from 'node:path';
import { browserOnlyFailure, runGate } from './feedback-checks.mjs';
import { acquire, fingerprint, readState, release, updateState } from './feedback-state.mjs';

const GATE_STALE_MS = 11 * 60 * 1000;
const MAX_GATE_RUNS = 3;

async function runAndRecord(repo, before) {
  const result = await runGate(repo.root);
  const after = fingerprint(repo.root);
  if (result.pass && after === before) {
    updateState(repo.dir, (s) => {
      s.green = after;
    });
  }
  return { ...result, fp: before, moved: after !== before, unverifiable: browserOnlyFailure(result) };
}

async function gateUntilSettled(repo) {
  for (let run = 1; ; run += 1) {
    const before = fingerprint(repo.root);
    if (readState(repo.dir).green === before) {
      return { pass: true, cached: true, fp: before };
    }
    const result = await runAndRecord(repo, before);
    if (!result.moved) {
      return result;
    }
    if (run >= MAX_GATE_RUNS) {
      return { ...result, pass: false, unsettled: true, unverifiable: false, fp: fingerprint(repo.root) };
    }
  }
}

export async function verifyTree(repo, waitMs) {
  const seen = fingerprint(repo.root);
  if (readState(repo.dir).green === seen) {
    return { pass: true, cached: true, fp: seen };
  }
  const lock = join(repo.dir, 'gate.lock');
  if (!acquire(lock, { waitMs, staleMs: GATE_STALE_MS })) {
    return { pass: false, busy: true, fp: seen };
  }
  try {
    return await gateUntilSettled(repo);
  } finally {
    release(lock);
  }
}
