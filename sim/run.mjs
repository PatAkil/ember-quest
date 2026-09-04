// Balance simulator runner — bundles the headless rules (game/sim.ts, which
// imports only game/types.ts and game/data.ts) with esbuild and Monte Carlos
// full runs under each named policy.
//
//   node sim/run.mjs                 # every policy, 2000 runs each, seed 1
//   node sim/run.mjs --runs 5000 --policy balanced --seed 7
//   node sim/run.mjs --json          # machine-readable, for diffing before/after
//
// Reads DESIGN.md's difficulty targets as the frame: act-1 clear >= 70 %,
// act 2 ~ 50 %, act 3 ~ 35 %, full run 15–25 % for the balanced policy;
// the random policy must win < 5 %.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const RUNS = Number(opt('runs', 2000));
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const JSON_OUT = args.includes('--json');

// mulberry32 — small, seedable, good enough for balance work.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dir = await mkdtemp(join(tmpdir(), 'ember-sim-'));
const outfile = join(dir, 'sim.bundle.mjs');
try {
  await build({
    entryPoints: [new URL('../game/sim.ts', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  const sim = await import(pathToFileURL(outfile).href);
  const names = ONLY === 'all' ? Object.keys(sim.POLICIES) : ONLY.split(',');

  const pct = (n, d) => (d === 0 ? '  - ' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);
  const report = {};
  for (const name of names) {
    const policy = sim.POLICIES[name];
    if (!policy) throw new Error(`unknown policy "${name}" — known: ${Object.keys(sim.POLICIES).join(', ')}`);
    const rng = mulberry32(SEED);
    const s = { runs: RUNS, won: 0, reach: [0, 0, 0, 0, 0], bossFought: [0, 0, 0, 0, 0], bossWon: [0, 0, 0, 0, 0],
      clears: 0, deathKind: {}, deathBy: {}, elites: 0, chests: 0, upgrades: 0, items: 0, ttk4: [], hit4: [] };
    for (let i = 0; i < RUNS; i++) {
      const r = sim.simulateRun(policy, rng);
      if (r.won) s.won++;
      for (let a = 1; a <= r.actReached + 1; a++) s.reach[a]++; // actReached is 0-based
      s.clears += r.clears;
      s.deathKind[r.deathKind || 'WIN'] = (s.deathKind[r.deathKind || 'WIN'] ?? 0) + 1;
      if (r.deathBy) s.deathBy[r.deathBy] = (s.deathBy[r.deathBy] ?? 0) + 1;
      s.elites += r.elitesFought ?? 0; s.chests += r.chestsOpened ?? 0;
      s.upgrades += r.upgradesTaken ?? 0; s.items += r.itemsTaken ?? 0;
      for (const p of r.probes) {
        s.bossFought[p.act + 1]++; // probe.act is 0-based
        if (p.won) s.bossWon[p.act + 1]++;
        if (p.act === 3) { s.ttk4.push(p.ttk); s.hit4.push(p.hitFrac); }
      }
    }
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    report[name] = {
      runs: RUNS,
      winRate: s.won / RUNS,
      reachAct: [2, 3, 4].map((a) => s.reach[a] / RUNS),
      bossClear: [1, 2, 3, 4].map((a) => (s.bossFought[a] ? s.bossWon[a] / s.bossFought[a] : null)),
      meanClears: s.clears / RUNS,
      meanElites: s.elites / RUNS, meanChests: s.chests / RUNS,
      meanItems: s.items / RUNS, meanUpgrades: s.upgrades / RUNS,
      act4Ttk: mean(s.ttk4), act4HitFrac: mean(s.hit4),
      deathKind: s.deathKind,
      topKillers: Object.entries(s.deathBy).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
    if (!JSON_OUT) {
      const r = report[name];
      console.log(`${name.padEnd(12)} win ${pct(s.won, RUNS)}  reach a2/a3/a4 ${r.reachAct.map((x) => pct(x, 1)).join('/')}` +
        `  boss a1..a4 ${r.bossClear.map((x) => (x == null ? '  - ' : pct(x, 1))).join('/')}` +
        `  clears ${r.meanClears.toFixed(1)}  elites ${r.meanElites.toFixed(1)}  chests ${r.meanChests.toFixed(1)}` +
        `  items ${r.meanItems.toFixed(1)}  +${r.meanUpgrades.toFixed(1)}` +
        (s.ttk4.length ? `  a4 boss ttk ${r.act4Ttk.toFixed(1)}t hit ${(100 * r.act4HitFrac).toFixed(0)}%` : ''));
      console.log(`${''.padEnd(12)} deaths ${Object.entries(s.deathKind).map(([k, v]) => `${k} ${pct(v, RUNS).trim()}`).join(', ')}` +
        `  top killers ${r.topKillers.map(([k, v]) => `${k} ${v}`).join(', ')}`);
    }
  }
  if (JSON_OUT) console.log(JSON.stringify({ seed: SEED, runs: RUNS, policies: report }, null, 2));
} finally {
  await rm(dir, { recursive: true, force: true });
}
