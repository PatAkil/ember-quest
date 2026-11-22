import { join } from 'node:path';
import { browserOnlyFailure, runGate } from './feedback-checks.mjs';
import { acquire, fingerprint, readState, release, updateState } from './feedback-state.mjs';

const GATE_STALE_MS = 11 * 60 * 1000;

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

export async function verifyTree(repo, waitMs) {
  const before = fingerprint(repo.root);
  if (readState(repo.dir).green === before) {
    return { pass: true, cached: true, fp: before };
  }
  const lock = join(repo.dir, 'gate.lock');
  if (!acquire(lock, { waitMs, staleMs: GATE_STALE_MS })) {
    return { pass: false, busy: true, fp: before };
  }
  try {
    if (readState(repo.dir).green === before) {
      return { pass: true, cached: true, fp: before };
    }
    return await runAndRecord(repo, before);
  } finally {
    release(lock);
  }
}
