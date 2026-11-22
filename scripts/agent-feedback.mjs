import { readFileSync } from 'node:fs';
import { killChildren, tail, toolsMissing } from './feedback-checks.mjs';
import { handleEdit } from './feedback-edit.mjs';
import { verifyTree } from './feedback-gate.mjs';
import { handleStop } from './feedback-stop.mjs';
import { agentKey, findRepo, fingerprint, freshAgent, logEvent, gatedPathsNotInIndex, updateState } from './feedback-state.mjs';

const LIMIT_MS = { edit: 55000, stop: 580000, 'session-start': 25000, 'subagent-start': 25000, precommit: 590000, gate: 590000 };
const READS_HOOK_INPUT = new Set(['edit', 'stop', 'session-start', 'subagent-start']);

function readInput(command) {
  if (!READS_HOOK_INPUT.has(command) || process.stdin.isTTY) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

function sessionStart(input, repo) {
  const session = String(input.session_id ?? 'cli');
  updateState(repo.dir, (state) => {
    state.baselines[session] ??= fingerprint(repo.root);
    state.agents[`main:${session}`] ??= freshAgent(repo.root, {});
  });
  return { code: 0 };
}

function subagentStart(input, repo) {
  const key = `agent:${String(input.agent_id ?? 'unknown')}`;
  updateState(repo.dir, (state) => {
    state.agents[key] = freshAgent(repo.root, { startFp: fingerprint(repo.root) });
    state.active[key] = Date.now();
  });
  return { code: 0 };
}

function unstagedRefusal(repo) {
  const files = gatedPathsNotInIndex(repo.root);
  if (!files.length) {
    return null;
  }
  const more = files.length > 8 ? ` (+${String(files.length - 8)} more)` : '';
  return {
    code: 1,
    stderr: `pre-commit: these files are on disk but not staged, so the verified tree would not be the committed tree:\n  ${files.slice(0, 8).join('\n  ')}${more}\npre-commit: Commit refused. Stage or stash them first (git stash --keep-index --include-untracked), or (owner only) bypass with git commit --no-verify.\n`,
  };
}

async function commitGate(repo, label) {
  const refusal = label === 'pre-commit' ? unstagedRefusal(repo) : null;
  if (refusal) {
    return refusal;
  }
  if (toolsMissing(repo.root).length) {
    return { code: 0, stderr: `${label}: node_modules is missing, so the tree was NOT verified. Run npm ci, then npm run verify.\n` };
  }
  const t0 = Date.now();
  const r = await verifyTree(repo, 300000);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.pass) {
    return { code: 0, stderr: `${label}: ${r.cached ? 'tree already verified green (fingerprint cache)' : `${String(r.name)} passed in ${secs}s`}\n` };
  }
  if (r.busy) {
    return { code: 1, stderr: `${label}: another verify run held the lock for 5 minutes; try again.\n` };
  }
  const advice = label === 'pre-commit' ? 'Commit refused: the tree fails the gate. Fix it, or (owner only) bypass with git commit --no-verify.' : 'Gate failed.';
  return { code: 1, stderr: `${tail(String(r.out), 80)}\n${label}: ${advice}\n` };
}

const COMMANDS = {
  edit: handleEdit,
  stop: handleStop,
  'session-start': sessionStart,
  'subagent-start': subagentStart,
  precommit: (_input, repo) => commitGate(repo, 'pre-commit'),
  gate: (_input, repo) => commitGate(repo, 'gate'),
};

function emit(result) {
  if (result.json) {
    process.stdout.write(`${JSON.stringify(result.json)}\n`);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.code;
}

async function main() {
  const command = process.argv[2] ?? '';
  const handler = COMMANDS[command];
  if (!handler) {
    emit({ code: 1, stderr: `usage: agent-feedback.mjs ${Object.keys(COMMANDS).join('|')}\n` });
    return;
  }
  setTimeout(() => {
    killChildren();
    process.stderr.write(`agent-feedback ${command}: gave up after ${String(LIMIT_MS[command] / 1000)}s\n`);
    process.exit(command === 'precommit' ? 1 : 0);
  }, LIMIT_MS[command]).unref();
  const input = readInput(command);
  const repo = findRepo(typeof input.cwd === 'string' ? input.cwd : process.cwd());
  const t0 = Date.now();
  const result = await handler(input, repo);
  emit(result);
  const who = READS_HOOK_INPUT.has(command) ? agentKey(input) : 'git';
  logEvent(repo.dir, { command, event: input.hook_event_name ?? command, who, tool: input.tool_name, code: result.code, ms: Date.now() - t0 });
}

try {
  await main();
} catch (e) {
  killChildren();
  emit({ code: 1, stderr: `agent-feedback: internal error, skipped: ${e instanceof Error ? e.message : String(e)}\n` });
}
