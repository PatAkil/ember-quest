import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ENTRY = {
  eslint: 'node_modules/eslint/bin/eslint.js',
  tsc: 'node_modules/typescript/bin/tsc',
  vite: 'node_modules/vite/bin/vite.js',
};
const LINTABLE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;
const TYPED = /^(?:game|engine)\/|^vite\.config\.ts$|^tsconfig\.json$/;
const TS_ERROR = /^(.+?)\((\d+),(\d+)\): error TS\d+: /;
const CHECK_MS = 30000;
const GATE_MS = 480000;
const EYES_MARKER = '/tmp/ember-eyes.json';
const children = new Set();

export const toolsMissing = (root) => Object.values(ENTRY).filter((p) => !existsSync(join(root, p)));
export const lintable = (files) => files.filter((f) => LINTABLE.test(f));
export const needsTypes = (files) => files.some((f) => TYPED.test(f));

export function tail(text, lines) {
  return text.trimEnd().split('\n').slice(-lines).join('\n');
}

function killGroup(child) {
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}

export function killChildren() {
  for (const child of children) {
    killGroup(child);
  }
}

export function execNode(root, args, timeoutMs) {
  return new Promise((resolve) => {
    const out = { stdout: '', stderr: '', timedOut: false };
    const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    children.add(child);
    const timer = setTimeout(() => {
      out.timedOut = true;
      killGroup(child);
    }, timeoutMs);
    child.stdout.on('data', (d) => (out.stdout += d));
    child.stderr.on('data', (d) => (out.stderr += d));
    const finish = (code) => {
      clearTimeout(timer);
      children.delete(child);
      resolve({ ...out, code });
    };
    child.on('error', (e) => { out.stderr += e.message; finish(127); });
    child.on('close', (code) => { finish(code ?? 1); });
  });
}

function eslintProblems(result, root) {
  return result.messages.map((m) => {
    const file = relative(root, result.filePath);
    return { file, text: `${file}:${m.line ?? 0}:${m.column ?? 0}  ${m.ruleId ?? 'parse-error'}  ${m.message}` };
  });
}

export async function lintFiles(root, files) {
  const targets = lintable(files);
  if (targets.length === 0) {
    return [];
  }
  const r = await execNode(root, [join(root, ENTRY.eslint), '--no-warn-ignored', '--format', 'json', ...targets], CHECK_MS);
  if (r.timedOut) {
    return [{ file: '(eslint)', text: `eslint timed out after ${CHECK_MS / 1000}s` }];
  }
  try {
    return JSON.parse(r.stdout).flatMap((result) => eslintProblems(result, root));
  } catch {
    return r.code === 0 ? [] : [{ file: '(eslint)', text: tail(`${r.stdout}${r.stderr}`, 12) }];
  }
}

function parseTsc(out) {
  const errors = [];
  for (const line of out.split('\n')) {
    const m = TS_ERROR.exec(line);
    const last = errors.at(-1);
    if (m) {
      errors.push({ file: m[1], text: line });
    } else if (line.startsWith(' ') && last) {
      last.text += `\n${line}`;
    }
  }
  return errors;
}

export async function typeErrors(root, dir) {
  const args = [join(root, ENTRY.tsc), '--noEmit', '--pretty', 'false', '--incremental', '--tsBuildInfoFile', join(dir, 'tsc.tsbuildinfo')];
  const r = await execNode(root, args, CHECK_MS);
  if (r.timedOut) {
    return [{ file: '(tsc)', text: `tsc timed out after ${CHECK_MS / 1000}s` }];
  }
  const errors = parseTsc(`${r.stdout}${r.stderr}`);
  return r.code !== 0 && errors.length === 0 ? [{ file: '(tsc)', text: tail(`${r.stdout}${r.stderr}`, 12) }] : errors;
}

export function eyesReady() {
  try {
    return JSON.parse(readFileSync(EYES_MARKER, 'utf8')).ready === true;
  } catch {
    return false;
  }
}

const failedGates = (out) => /TOTAL FAIL \(([^)]*)\)/.exec(out)?.[1]?.split(', ') ?? [];

async function verifyGate(root) {
  const r = await execNode(root, [join(root, 'scripts', 'verify.mjs')], GATE_MS);
  const out = `${r.stdout}${r.stderr}${r.timedOut ? `\nverify timed out after ${GATE_MS / 1000}s\n` : ''}`;
  return { name: 'npm run verify', pass: r.code === 0 && !r.timedOut, out, failed: failedGates(r.stdout) };
}

async function basicGate(root) {
  const steps = [
    { name: 'lint', args: [join(root, ENTRY.eslint), '.'] },
    { name: 'check', args: [join(root, ENTRY.tsc), '--noEmit'] },
    { name: 'build', args: [join(root, ENTRY.vite), 'build', '--logLevel', 'warn'] },
  ];
  const lines = [];
  const failed = [];
  for (const { name, args } of steps) {
    const r = await execNode(root, args, GATE_MS / 3);
    const pass = r.code === 0 && !r.timedOut;
    lines.push(`${pass ? 'PASS' : 'FAIL'}  ${name}`);
    if (!pass) {
      failed.push(name);
      lines.push(tail(`${r.stdout}${r.stderr}`, 15));
    }
  }
  const verdict = failed.length > 0 ? `FAIL (${failed.join(', ')})` : 'PASS';
  lines.push(`TOTAL ${verdict}  (smoke skipped: the headless browser gate is Linux-only)`);
  return { name: 'lint + check + build', pass: failed.length === 0, out: lines.join('\n'), failed };
}

export function runGate(root) {
  const linuxVerify = process.platform === 'linux' && existsSync(join(root, 'scripts', 'verify.mjs'));
  return linuxVerify ? verifyGate(root) : basicGate(root);
}

export const browserOnlyFailure = (result) =>
  !result.pass && result.failed.length > 0 && result.failed.every((g) => g === 'eyes' || g === 'smoke') && !eyesReady();
