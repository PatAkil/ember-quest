import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(ROOT, 'node_modules', '.bin');
const FULL = process.argv.includes('--full');
const SLOTS = 2;
const SCENES = ['title', 'map', 'battle', 'levelup', 'loot', 'card', 'paused', 'gameover', 'win'];

function run(cmd, args) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, FORCE_COLOR: '0' } });
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => { resolve({ code: 127, out: `${out}${e.message}\n` }); });
    child.on('close', (code) => { resolve({ code: code ?? 1, out }); });
  });
}

const tool = (name, ...args) => () => run(join(BIN, name), args);
const script = (file, ...args) => () => run(process.execPath, [join(ROOT, file), ...args]);

function simRates(out) {
  const rates = [...out.matchAll(/^(\S+)\s+win\s+(\d+)%/gm)].map((m) => `${m[1]} ${m[2]}%`);
  return rates.length ? rates.join(', ') : 'no win rates parsed';
}

async function lookAll() {
  const lines = [];
  let code = 0;
  for (const scene of SCENES) {
    const r = await run(process.execPath, [join(ROOT, 'scripts/look.mjs'), '--scene', scene]);
    if (r.code !== 0) {
      code = 1;
    }
    lines.push(`${scene}: ${r.code === 0 ? 'ok' : r.out.trim().slice(0, 400)}`);
  }
  return { code, out: `${lines.join('\n')}\n`, note: code === 0 ? `${SCENES.length} scenes ok` : '' };
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function distClean() {
  let files;
  try {
    files = filesUnder(join(ROOT, 'dist'));
  } catch (e) {
    return Promise.resolve({ code: 1, out: `${e.message}\n` });
  }
  const hits = files.filter((f) => readFileSync(f).includes('__ember'));
  const result = hits.length ? { code: 1, out: `__ember found in:\n${hits.join('\n')}\n` } : { code: 0, out: '', note: `${files.length} files clean` };
  return Promise.resolve(result);
}

function gates() {
  const list = [
    { name: 'eyes', light: true, exec: script('scripts/setup-eyes.mjs') },
    { name: 'lint', exec: tool('eslint', '.') },
    { name: 'check', exec: tool('tsc', '--noEmit') },
    { name: 'build', exec: tool('vite', 'build', '--logLevel', 'warn') },
    { name: 'smoke', after: ['eyes'], exec: script('smoke.mjs') },
    { name: 'sim:quick', info: true, exec: script('sim/run.mjs', '--runs', '500', '--policy', 'balanced,random'), note: simRates },
  ];
  if (!FULL) {
    return list;
  }
  return list.concat([
    { name: 'knip', exec: tool('knip') },
    { name: 'jscpd', exec: tool('jscpd', 'game', 'engine', 'scripts', 'sim') },
    { name: 'depcruise', exec: tool('depcruise', 'game', 'engine', '--config', '.dependency-cruiser.cjs') },
    { name: 'dist:no-hook', light: true, after: ['build'], exec: distClean },
    { name: 'look:all', light: true, after: ['eyes'], exec: lookAll },
    { name: 'sim:full', info: true, exec: script('sim/run.mjs'), note: simRates },
  ]);
}

function tail(out, n = 15) {
  return out.trimEnd().split('\n').slice(-n).map((l) => `    ${l}`).join('\n');
}

function printResult(g, r, secs) {
  const pass = r.code === 0;
  const label = g.info ? 'INFO' : pass ? 'PASS' : 'FAIL';
  const note = g.note ? g.note(r.out) : (r.note ?? '');
  console.log(`${label.padEnd(4)}  ${g.name.padEnd(12)} ${secs.toFixed(1).padStart(5)}s${note ? `  ${note}` : ''}`);
  if (!pass) {
    console.log(tail(r.out));
  }
}

async function execute(g, state) {
  const t = Date.now();
  const r = await g.exec();
  const secs = (Date.now() - t) / 1000;
  state.done.add(g.name);
  if (!g.light) {
    state.busy--;
  }
  if (r.code !== 0 && !g.info) {
    state.failed.push(g.name);
  }
  printResult(g, r, secs);
}

function schedule(pending, state, running) {
  for (const g of [...pending]) {
    if (!(g.after ?? []).every((d) => state.done.has(d))) {
      continue;
    }
    if (!g.light && state.busy >= SLOTS) {
      continue;
    }
    if (!g.light) {
      state.busy++;
    }
    pending.splice(pending.indexOf(g), 1);
    const p = execute(g, state).then(() => running.delete(p));
    running.add(p);
  }
}

async function main() {
  const t0 = Date.now();
  const pending = gates();
  const state = { busy: 0, done: new Set(), failed: [] };
  const running = new Set();
  while (pending.length || running.size) {
    schedule(pending, state, running);
    if (!running.size) {
      break;
    }
    await Promise.race(running);
  }
  const total = ((Date.now() - t0) / 1000).toFixed(1);
  const verdict = state.failed.length ? `FAIL (${state.failed.join(', ')})` : 'PASS';
  console.log(`TOTAL ${verdict} in ${total}s`);
  if (state.failed.length) {
    process.exitCode = 1;
  }
}

await main();
