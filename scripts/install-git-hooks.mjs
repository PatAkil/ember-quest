import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = '.githooks';

function gitOut(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : null;
}

function ownHookInTheWay() {
  const path = gitOut(['rev-parse', '--git-path', 'hooks/pre-commit']);
  if (path === null) {
    return false;
  }
  const full = resolve(ROOT, path);
  return existsSync(full) && !readFileSync(full, 'utf8').includes('agent-feedback.mjs');
}

function install() {
  if (process.env.CI || process.env.EMBER_NO_GIT_HOOKS) {
    return 'skipped (CI or EMBER_NO_GIT_HOOKS set)';
  }
  if (!existsSync(join(ROOT, HOOKS, 'pre-commit')) || gitOut(['rev-parse', '--show-toplevel']) === null) {
    return 'skipped (not a git checkout of this repo)';
  }
  const current = gitOut(['config', '--get', 'core.hooksPath']) ?? '';
  if (current === HOOKS) {
    return `core.hooksPath already ${HOOKS}`;
  }
  if (current !== '' || ownHookInTheWay()) {
    return `left your existing hooks alone; run "git config core.hooksPath ${HOOKS}" to enable the verify gate on commit`;
  }
  chmodSync(join(ROOT, HOOKS, 'pre-commit'), 0o755);
  gitOut(['config', 'core.hooksPath', HOOKS]);
  return `core.hooksPath set to ${HOOKS} (pre-commit runs the verify gate)`;
}

try {
  console.log(`git hooks: ${install()}`);
} catch (e) {
  console.log(`git hooks: skipped (${e instanceof Error ? e.message : String(e)})`);
}
