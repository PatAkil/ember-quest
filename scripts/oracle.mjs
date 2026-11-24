import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SCENES = ['title', 'map', 'battle', 'levelup', 'loot', 'card', 'paused', 'gameover', 'win', 'gear', 'pick', 'drop', 'battle-heavy', 'battle-magic'];
const ACTS = [1, 2, 3, 4];
const KEY_RUNS = ['', 'Down,Space,Space,Down,Space'];
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = flag('dir') ?? '/tmp/ember-oracle';
mkdirSync(dir, { recursive: true });

function capture(scene, act, keys) {
  const out = join(dir, `${scene}-${String(act)}-${keys ? 'keys' : 'still'}.png`);
  const cli = ['scripts/look.mjs', '--scene', scene, '--act', String(act), '--seed', '7', '--out', out];
  if (keys) {
    cli.push('--keys', keys);
  }
  const line = execFileSync('node', cli, { encoding: 'utf8' }).trim().split('\n').pop();
  const result = JSON.parse(line);
  const pixels = createHash('sha256').update(readFileSync(out)).digest('hex');
  const state = createHash('sha256').update(JSON.stringify(result.state)).digest('hex');
  return { ok: result.ok, pixels, state };
}

const snapshot = {};
for (const scene of SCENES) {
  for (const act of ACTS) {
    for (const keys of KEY_RUNS) {
      snapshot[`${scene}/${String(act)}/${keys || 'still'}`] = capture(scene, act, keys);
    }
  }
}

const savePath = flag('save');
const checkPath = flag('check');
if (savePath) {
  writeFileSync(savePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`oracle saved ${String(Object.keys(snapshot).length)} cases to ${savePath}`);
}
if (checkPath) {
  const baseline = JSON.parse(readFileSync(checkPath, 'utf8'));
  const diffs = Object.keys(baseline).filter((k) => JSON.stringify(baseline[k]) !== JSON.stringify(snapshot[k]));
  if (diffs.length > 0) {
    console.error(`ORACLE FAIL: ${String(diffs.length)} of ${String(Object.keys(baseline).length)} cases differ`);
    for (const k of diffs) {
      const kind = baseline[k].state !== snapshot[k]?.state ? 'state' : 'pixels';
      console.error(`  - ${k} (${kind})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`ORACLE OK: ${String(Object.keys(baseline).length)} cases identical in state and pixels`);
  }
}
