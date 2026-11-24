import { withSim } from './bundle.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const RUNS = Number(opt('runs', 2000));
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const JSON_OUT = args.includes('--json');

const pct = (n, d) => (d === 0 ? '  - ' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const newStats = () => ({ runs: RUNS, won: 0, reach: [0, 0, 0, 0, 0], bossFought: [0, 0, 0, 0, 0], bossWon: [0, 0, 0, 0, 0],
  clears: 0, deathKind: {}, deathBy: {}, elites: 0, chests: 0, upgrades: 0, items: 0, ttk4: [], hit4: [],
  stowed: 0, packEnd: 0, drops: 0, swaps: 0, upWorn: 0, upPacked: 0 });

function tallyProbe(s, p) {
  s.bossFought[p.act + 1]++;
  if (p.won) {s.bossWon[p.act + 1]++;}
  if (p.act === 3) { s.ttk4.push(p.ttk); s.hit4.push(p.hitFrac); }
}

const bump = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1; };

function tallyRooms(s, r) {
  s.elites += r.elitesFought ?? 0; s.chests += r.chestsOpened ?? 0;
  s.upgrades += r.upgradesTaken ?? 0; s.items += r.itemsTaken ?? 0;
}

function tallyPack(s, r) {
  s.stowed += r.itemsStowed ?? 0; s.packEnd += r.packAtEnd ?? 0; s.drops += r.drops ?? 0;
  s.swaps += r.prepareSwaps ?? 0; s.upWorn += r.upgradesWorn ?? 0; s.upPacked += r.upgradesPacked ?? 0;
}

function tallyRun(s, r) {
  if (r.won) {s.won++;}
  for (let a = 1; a <= r.actReached + 1; a++) {s.reach[a]++;}
  s.clears += r.clears;
  bump(s.deathKind, r.deathKind === '' ? 'WIN' : r.deathKind);
  if (r.deathBy) {bump(s.deathBy, r.deathBy);}
  tallyRooms(s, r);
  tallyPack(s, r);
  for (const p of r.probes) {tallyProbe(s, p);}
}

function summarize(s) {
  return {
    runs: RUNS,
    winRate: s.won / RUNS,
    reachAct: [2, 3, 4].map((a) => s.reach[a] / RUNS),
    bossClear: [1, 2, 3, 4].map((a) => (s.bossFought[a] ? s.bossWon[a] / s.bossFought[a] : null)),
    meanClears: s.clears / RUNS,
    meanElites: s.elites / RUNS, meanChests: s.chests / RUNS,
    meanItems: s.items / RUNS, meanUpgrades: s.upgrades / RUNS,
    act4Ttk: mean(s.ttk4), act4HitFrac: mean(s.hit4),
    meanStowed: s.stowed / RUNS, meanPackAtEnd: s.packEnd / RUNS, meanDrops: s.drops / RUNS,
    meanPrepareSwaps: s.swaps / RUNS, meanUpgradesWorn: s.upWorn / RUNS, meanUpgradesPacked: s.upPacked / RUNS,
    deathKind: s.deathKind,
    topKillers: Object.entries(s.deathBy).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

function printText(name, s, r) {
  console.log(`${name.padEnd(12)} win ${pct(s.won, RUNS)}  reach a2/a3/a4 ${r.reachAct.map((x) => pct(x, 1)).join('/')}` +
    `  boss a1..a4 ${r.bossClear.map((x) => (x === null ? '  - ' : pct(x, 1))).join('/')}` +
    `  clears ${r.meanClears.toFixed(1)}  elites ${r.meanElites.toFixed(1)}  chests ${r.meanChests.toFixed(1)}` +
    `  items ${r.meanItems.toFixed(1)}  +${r.meanUpgrades.toFixed(1)}` +
    (s.ttk4.length ? `  a4 boss ttk ${r.act4Ttk.toFixed(1)}t hit ${(100 * r.act4HitFrac).toFixed(0)}%` : ''));
  console.log(`${''.padEnd(12)} deaths ${Object.entries(s.deathKind).map(([k, v]) => `${k} ${pct(v, RUNS).trim()}`).join(', ')}` +
    `  top killers ${r.topKillers.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`${''.padEnd(12)} pack: stowed ${r.meanStowed.toFixed(2)}  at end ${r.meanPackAtEnd.toFixed(2)}` +
    `  drops ${r.meanDrops.toFixed(2)}  prepare swaps ${r.meanPrepareSwaps.toFixed(2)}` +
    `  upgrades worn/packed ${r.meanUpgradesWorn.toFixed(2)}/${r.meanUpgradesPacked.toFixed(2)}`);
}

await withSim((sim) => {
  const names = ONLY === 'all' ? Object.keys(sim.POLICIES) : ONLY.split(',');
  const report = {};
  for (const name of names) {
    const policy = sim.POLICIES[name];
    if (!policy) {throw new Error(`unknown policy "${name}" — known: ${Object.keys(sim.POLICIES).join(', ')}`);}
    const rng = sim.createSeededRng(SEED).next;
    const s = newStats();
    for (let i = 0; i < RUNS; i++) {tallyRun(s, sim.simulateRun(policy, rng));}
    report[name] = summarize(s);
    if (!JSON_OUT) {printText(name, s, report[name]);}
  }
  if (JSON_OUT) {console.log(JSON.stringify({ seed: SEED, runs: RUNS, policies: report }, null, 2));}
});
