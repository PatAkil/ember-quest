import { basename, isAbsolute, join, relative } from 'node:path';
import { lintFiles, needsTypes, toolsMissing, typeErrors } from './feedback-checks.mjs';
import {
  acquire, agentKey, claimedByOther, diffSnapshots, fingerprint, gatedFiles, isSubagent, othersBusy, release,
  statSnapshot, updateState,
} from './feedback-state.mjs';

const SLACK_MS = 2000;
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const MAX_LINES = 40;

function namedPaths(input, root) {
  const toolInput = input.tool_input ?? {};
  return new Set([toolInput.file_path, toolInput.notebook_path]
    .filter((p) => typeof p === 'string')
    .map((p) => (isAbsolute(p) ? relative(root, p) : p)));
}

function mentions(command, path) {
  if (command.includes(path)) {
    return true;
  }
  const base = basename(path);
  return base.length > 4 && command.includes(base);
}

function attributed(ctx, change) {
  if (ctx.named.has(change.path) || mentions(ctx.command, change.path)) {
    return true;
  }
  if (EDIT_TOOLS.has(ctx.tool) || claimedByOther(ctx.state, ctx.key, change.path, ctx.now)) {
    return false;
  }
  return ctx.others.length === 0 || change.mtime >= ctx.windowStart;
}

function previousSnapshot(agent, current, windowStart) {
  if (agent?.snap) {
    return agent.snap;
  }
  return Object.fromEntries(Object.entries(current).filter(([, v]) => v[0] < windowStart));
}

function recordBaseline(input, repo, state, key) {
  const session = String(input.session_id);
  if (!isSubagent(key) && !(session in state.baselines)) {
    state.baselines[session] = fingerprint(repo.root);
  }
}

function attributionContext(input, repo, state, key) {
  const now = Date.now();
  const command = input.tool_input?.command;
  return {
    state, key, now,
    windowStart: now - Number(input.duration_ms ?? 0) - SLACK_MS,
    tool: String(input.tool_name ?? ''),
    named: namedPaths(input, repo.root),
    command: typeof command === 'string' ? command : '',
    others: othersBusy(state, key, now),
  };
}

function planChecks(input, repo, state) {
  const key = agentKey(input);
  const ctx = attributionContext(input, repo, state, key);
  const current = statSnapshot(repo.root, gatedFiles(repo.root));
  const agent = state.agents[key];
  const changes = diffSnapshots(previousSnapshot(agent, current, ctx.windowStart), current, ctx.now);
  recordBaseline(input, repo, state, key);
  const mine = changes.filter((c) => attributed(ctx, c)).map((c) => c.path);
  for (const path of mine) {
    state.claims[path] = { agent: key, at: ctx.now };
  }
  const touched = [...new Set([...(agent?.touched ?? []), ...mine])];
  state.agents[key] = { ...agent, snap: current, seen: ctx.now, touched };
  const event = input.hook_event_name === 'PostToolUseFailure' ? 'PostToolUseFailure' : 'PostToolUse';
  return { key, event, mine, others: ctx.others, seen: new Set(agent?.reported ?? []), claims: { ...state.claims } };
}

function sortTypeErrors(plan, types) {
  const own = new Set(plan.mine);
  const elsewhere = types.filter((e) => !own.has(e.file));
  const foreign = (e) => plan.others.length > 0 && plan.claims[e.file] !== undefined && plan.claims[e.file].agent !== plan.key;
  return {
    own: types.filter((e) => own.has(e.file)),
    elsewhere: elsewhere.filter((e) => !foreign(e) && !plan.seen.has(e.text)),
    shown: elsewhere.map((e) => e.text).slice(0, 60),
  };
}

const section = (title, items) => (items.length ? [`${title}:`, ...items.map((i) => `  ${i.text}`)] : []);

function clip(lines) {
  return lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `  … ${String(lines.length - MAX_LINES)} more lines`] : lines;
}

function present(plan, lint, types) {
  const sorted = sortTypeErrors(plan, types);
  const solo = plan.others.length === 0;
  const blocking = [...section('ESLint', lint), ...section('tsc', sorted.own), ...(solo ? section('tsc, other files', sorted.elsewhere) : [])];
  const head = `Files checked: ${plan.mine.join(', ')}`;
  if (blocking.length) {
    const intro = 'Ember Quest per-edit check: what you just changed has lint or type errors. Fix them before moving on (no eslint-disable, fix the code, not the config).';
    return { code: 2, stderr: `${[intro, head, ...clip(blocking)].join('\n')}\n`, shown: sorted.shown };
  }
  if (!solo && sorted.elsewhere.length) {
    const note = `Ember Quest per-edit check: your files are clean, but tsc reports errors in files you did not change. Other agents (${plan.others.join(', ')}) are working in this tree, so these may be their work in progress: fix them only if your change caused them.`;
    const context = [note, head, ...clip(section('tsc', sorted.elsewhere))].join('\n');
    return { code: 0, json: { hookSpecificOutput: { hookEventName: plan.event, additionalContext: context } }, shown: sorted.shown };
  }
  return { code: 0, shown: sorted.shown };
}

async function runChecks(plan, repo) {
  const existing = plan.mine.filter((p) => statSnapshot(repo.root, [p])[p] !== undefined);
  const [lint, types] = await Promise.all([
    lintFiles(repo.root, existing),
    needsTypes(plan.mine) ? typeErrors(repo.root, repo.dir) : Promise.resolve([]),
  ]);
  return present(plan, lint, types);
}

function warnMissingOnce(repo, key) {
  const fresh = updateState(repo.dir, (state) => {
    const agent = state.agents[key] ?? { seen: Date.now(), touched: [] };
    state.agents[key] = { ...agent, warned: true };
    return agent.warned !== true;
  });
  return fresh ? { code: 1, stderr: 'agent-feedback: node_modules is missing, so per-edit lint and type feedback is off. Run npm ci (or npm run setup).\n' } : { code: 0 };
}

export async function handleEdit(input, repo) {
  if (toolsMissing(repo.root).length) {
    return warnMissingOnce(repo, agentKey(input));
  }
  const lock = join(repo.dir, 'check.lock');
  if (!acquire(lock, { waitMs: 20000, staleMs: 90000 })) {
    return { code: 1, stderr: 'agent-feedback: another per-edit check held the lock for 20s; skipped this one (the end-of-turn gate still runs).\n' };
  }
  try {
    const plan = updateState(repo.dir, (state) => planChecks(input, repo, state));
    if (plan.mine.length === 0) {
      return { code: 0 };
    }
    const result = await runChecks(plan, repo);
    updateState(repo.dir, (state) => {
      state.agents[plan.key] = { ...state.agents[plan.key], reported: result.shown };
    });
    return result;
  } finally {
    release(lock);
  }
}
