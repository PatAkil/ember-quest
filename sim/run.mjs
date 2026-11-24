import { withSim } from './bundle.mjs';
import { endRun, isPicker, mergeTallies, newItemTally, printItems, watchPicks } from './items-report.mjs';
import { addEvents, eventShares, newEventTally, printEvents } from './events-report.mjs';
import { newDescent, pooledPacts, printDescent, printPooled, summarizeDescent, tallyDescent } from './descent-report.mjs';

const args = process.argv.slice(2);
const HELP = [
  'usage: node sim/run.mjs [flags]',
  '  --runs N          runs per policy (default 2000)',
  '  --seed N          rng seed (default 1)',
  '  --policy a,b      comma-separated policies (default all)',
  '  --json            print one JSON report instead of tables',
  '  --story           story (depth 1) table only, no descent',
  '  --descent-only    descent table only, no story table',
  '  --items           per-item offered/picked/held table (balanced + glass + tank)',
  '  --events          per-event option split for each policy (story runs)',
  '  --no-potions      add a noPotions variant of balanced',
  '  --help            this list',
];
if (args.includes('--help') || args.includes('-h')) {
  console.log(HELP.join('\n'));
  process.exit(0);
}
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const RUNS = Number(opt('runs', 2000));
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const JSON_OUT = args.includes('--json');
const NO_POTIONS = args.includes('--no-potions');
const ITEMS = args.includes('--items');
const EVENTS = args.includes('--events');
const STORY = !args.includes('--descent-only');
const DESCENT = !args.includes('--story');
const TIERS = ['NORMAL', 'ELITE', 'BOSS'];

const pct = (n, d) => (d === 0 ? '  - ' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const newStats = () => ({ runs: RUNS, won: 0, reach: [0, 0, 0, 0, 0], bossFought: [0, 0, 0, 0, 0], bossWon: [0, 0, 0, 0, 0],
  clears: 0, deathKind: {}, deathBy: {}, elites: 0, chests: 0, upgrades: 0, items: 0, ttk4: [], hit4: [],
  stowed: 0, packEnd: 0, drops: 0, swaps: 0, upWorn: 0, upPacked: 0,
  verbs: { guards: 0, parries: 0, bursts: 0, potions: 0, phase2: 0, burnDeaths: 0,
    breakTry: { NORMAL: 0, ELITE: 0, BOSS: 0 }, breakHit: { NORMAL: 0, ELITE: 0, BOSS: 0 } } });

function tallyVerbs(s, v) {
  if (!v) {return;}
  for (const k of ['guards', 'parries', 'bursts', 'potions', 'phase2', 'burnDeaths']) {s.verbs[k] += v[k];}
  for (const t of TIERS) { s.verbs.breakTry[t] += v.breakTry[t]; s.verbs.breakHit[t] += v.breakHit[t]; }
}

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
  tallyVerbs(s, r.verbs);
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
    verbs: {
      guards: s.verbs.guards / RUNS, parries: s.verbs.parries / RUNS, bursts: s.verbs.bursts / RUNS,
      potions: s.verbs.potions / RUNS, phase2: s.verbs.phase2 / RUNS, burnDeaths: s.verbs.burnDeaths,
      breakTry: Object.fromEntries(TIERS.map((t) => [t, s.verbs.breakTry[t] / RUNS])),
      breakHit: Object.fromEntries(TIERS.map((t) => [t, s.verbs.breakHit[t] / RUNS])),
    },
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
  const v = r.verbs;
  const breaks = TIERS.map((t) => `${v.breakHit[t].toFixed(2)}/${v.breakTry[t].toFixed(2)}`).join(' ');
  console.log(`${''.padEnd(12)} verbs/run: guard ${v.guards.toFixed(2)}  parry ${v.parries.toFixed(2)}  burst ${v.bursts.toFixed(2)}` +
    `  potion ${v.potions.toFixed(2)}  break n/e/b ${breaks}  phase2 ${v.phase2.toFixed(2)}` +
    `  burn deaths ${v.burnDeaths}  stalls ${s.deathKind.STALL ?? 0}`);
}

const withoutPotions = (policy) => ({ ...policy, act: (hero, d, battle, actions) => policy.act(hero, d, battle, actions.filter((a) => a !== 'POTION')) });

function policiesOf(sim) {
  const named = ONLY === 'all' ? Object.keys(sim.POLICIES) : ONLY.split(',');
  const list = named.map((name) => {
    const policy = sim.POLICIES[name];
    if (!policy) {throw new Error(`unknown policy "${name}" — known: ${Object.keys(sim.POLICIES).join(', ')}`);}
    return [name, policy];
  });
  if (NO_POTIONS) {list.push(['noPotions', withoutPotions(sim.POLICIES.balanced)]);}
  return list;
}

function playPolicy(sim, plain) {
  const rng = sim.createSeededRng(SEED).next;
  const s = newStats();
  const items = newItemTally();
  const events = newEventTally();
  const { policy, run } = watchPicks(plain, items);
  for (let i = 0; i < RUNS; i++) {
    const result = sim.simulateRun(policy, rng);
    tallyRun(s, result);
    addEvents(events, result.events);
    endRun(sim, items, run, result.won);
  }
  return { s, items, events };
}

function playDescent(sim, policy) {
  const rng = sim.createSeededRng(SEED).next;
  const d = newDescent();
  for (let i = 0; i < RUNS; i++) {tallyDescent(d, sim.simulateRun(policy, rng, { descend: true }));}
  return summarizeDescent(d);
}

function descentTable(sim) {
  const table = {};
  for (const [name, policy] of policiesOf(sim)) {
    table[name] = playDescent(sim, policy);
    if (!JSON_OUT) {printDescent(name, table[name]);}
  }
  if (!JSON_OUT) {printPooled(pooledPacts(table));}
  return table;
}

function printFooter(sim, report, pickers) {
  if (ITEMS) {printItems(sim, 'balanced + glass + tank', pickers);}
  const { naive, balanced } = report;
  if (naive && balanced) {
    console.log(`naive/balanced win ratio ${(balanced.winRate > 0 ? naive.winRate / balanced.winRate : 0).toFixed(2)} (target <= 0.75)`);
  }
}

function storyTable(sim) {
  const report = {};
  const pickers = newItemTally();
  for (const [name, plain] of policiesOf(sim)) {
    const { s, items, events } = playPolicy(sim, plain);
    report[name] = summarize(s);
    if (EVENTS) {report[name].events = eventShares(events);}
    if (!JSON_OUT) {printText(name, s, report[name]);}
    if (EVENTS && !JSON_OUT) {printEvents(sim, name, events, RUNS);}
    if (ITEMS && isPicker(name)) {mergeTallies(pickers, items);}
  }
  if (!JSON_OUT) {printFooter(sim, report, pickers);}
  return report;
}

await withSim((sim) => {
  const report = STORY ? storyTable(sim) : {};
  const descent = DESCENT ? descentTable(sim) : null;
  if (!JSON_OUT) {return;}
  const out = { seed: SEED, runs: RUNS, policies: report };
  console.log(JSON.stringify(descent ? { ...out, descent } : out, null, 2));
});
