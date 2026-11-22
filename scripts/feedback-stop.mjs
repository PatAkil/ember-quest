import { lintFiles, tail, toolsMissing, typeErrors } from './feedback-checks.mjs';
import { verifyTree } from './feedback-gate.mjs';
import { agentKey, fingerprint, isSubagent, othersBusy, readState, statSnapshot, updateState } from './feedback-state.mjs';

const MAX_BLOCKS = 3;
const GATE_WAIT_MS = 400000;
const OUTPUT_LINES = 60;

function changedThisSession(input, state, key, fp) {
  const agent = state.agents[key];
  if ((agent?.touched.length ?? 0) > 0) {
    return true;
  }
  if (isSubagent(key)) {
    return othersBusy(state, key, Date.now()).length === 0 && agent?.startFp !== undefined && agent.startFp !== fp;
  }
  const baseline = state.baselines[String(input.session_id)];
  return baseline === undefined || baseline !== fp;
}

function releaseReason(input, block, fp) {
  if (input.stop_hook_active !== true || block === undefined) {
    return null;
  }
  if (block.count >= MAX_BLOCKS) {
    return `Ember gate: released after ${String(MAX_BLOCKS)} consecutive blocks with the tree still red. Run npm run verify and fix it before committing; the pre-commit hook refuses a red tree.`;
  }
  if (block.fp === fp) {
    return 'Ember gate: the tree is still red and no code changed since the last block, so the turn may end. Run npm run verify and fix it before committing; the pre-commit hook refuses a red tree.';
  }
  return null;
}

function deferReason(input, state, key) {
  if (isSubagent(key)) {
    return null;
  }
  const background = Array.isArray(input.background_tasks) ? input.background_tasks.length : 0;
  const running = Object.keys(state.active).filter((k) => othersBusy(state, key, Date.now()).includes(k)).length;
  if (background + running === 0) {
    return null;
  }
  return 'Ember gate deferred: background agents or tasks are still running in this tree; the whole-tree gate runs at the end of the turn in which they are done.';
}

function settle(repo, key, message) {
  updateState(repo.dir, (state) => {
    Reflect.deleteProperty(state.blocks, key);
    Reflect.deleteProperty(state.active, key);
  });
  return message ? { code: 0, json: { systemMessage: message } } : { code: 0 };
}

async function scopedGate(repo, touched) {
  const files = touched.filter((p) => statSnapshot(repo.root, [p])[p] !== undefined);
  const own = new Set(touched);
  const [lint, types] = await Promise.all([lintFiles(repo.root, files), typeErrors(repo.root, repo.dir)]);
  const problems = [...lint, ...types.filter((e) => own.has(e.file))].map((p) => p.text);
  const name = 'scoped check (eslint + tsc on the files you changed; other writers are still running)';
  return { name, pass: problems.length === 0, out: problems.join('\n'), failed: problems.length ? ['scoped'] : [] };
}

function block(repo, input, key, result) {
  const count = updateState(repo.dir, (state) => {
    const prev = input.stop_hook_active === true ? (state.blocks[key]?.count ?? 0) : 0;
    state.blocks[key] = { count: prev + 1, fp: result.fp };
    return prev + 1;
  });
  const lines = [
    `Ember Quest end-of-turn gate: ${String(result.name)} FAILED on the current tree (block ${String(count)} of ${String(MAX_BLOCKS)}).`,
    'Fix what is below, run npm run verify until it prints TOTAL PASS, then finish. If a failure is in a file another writer owns, name it in your report instead of editing it.',
    tail(String(result.out), OUTPUT_LINES),
  ];
  return { code: 2, stderr: `${lines.join('\n')}\n` };
}

function judge(repo, input, key, result) {
  if (result.pass) {
    return settle(repo, key, null);
  }
  if (result.busy) {
    return settle(repo, key, 'Ember gate: another gate held the lock for too long; this stop was not verified. Run npm run verify.');
  }
  if (result.unsettled) {
    return settle(repo, key, 'Ember gate: the tree kept changing while the gate ran (another writer is still editing), so this stop was NOT verified. Run npm run verify once edits settle.');
  }
  if (result.unverifiable) {
    return settle(repo, key, 'Ember gate: only the browser gates (eyes/smoke) failed and the headless browser is not ready; run npm run setup, then npm run verify.');
  }
  return block(repo, input, key, result);
}

export async function handleStop(input, repo) {
  const key = agentKey(input);
  const state = readState(repo.dir);
  const fp = fingerprint(repo.root);
  if (fp === state.green || !changedThisSession(input, state, key, fp)) {
    return settle(repo, key, null);
  }
  const early = releaseReason(input, state.blocks[key], fp) ?? deferReason(input, state, key);
  if (early) {
    return settle(repo, key, early);
  }
  if (toolsMissing(repo.root).length) {
    return settle(repo, key, 'Ember gate skipped: node_modules is missing. Run npm ci, then npm run verify.');
  }
  const scoped = isSubagent(key) && othersBusy(state, key, Date.now()).some(isSubagent);
  const result = scoped ? { ...(await scopedGate(repo, state.agents[key]?.touched ?? [])), fp } : await verifyTree(repo, GATE_WAIT_MS);
  return judge(repo, input, key, result);
}
