// Balance simulator runner — bundles the headless rules (game/sim/battle.ts
// and, for --runs, game/sim/run.ts, each importing only game/types.ts,
// game/data/* and game/sim/rng.ts / ./battle / ./relics) with esbuild and
// Monte Carlos them under each named policy.
//
//   node sim/run.mjs                                   # --battles: every policy × every fixture, 2000 battles each, seed 1
//   node sim/run.mjs --n 5000 --policy balanced,random --seed 7
//   node sim/run.mjs --fixture "BOSS HOLLOW_KING"      # a subset of BATTLE_FIXTURES by name (comma-separated)
//   node sim/run.mjs --runs 2000                       # full-run mode: game/sim/run.ts's simulateRun, per --policy (default all nine)
//   node sim/run.mjs --runs 2000 --policy balanced,lapper
//   node sim/run.mjs --spd 10                          # --runs mode with RunConfig.spdDelta = 10, "spd +10" per row
//   node sim/run.mjs --spd                             # bare: the SPD gate — balanced at +10 then -10, same seed, act-3 Δ
//   node sim/run.mjs --json                            # machine-readable, for diffing before/after
//
// DESIGN.md → Difficulty targets. The --battles mode runs each selected
// policy's `act` over BATTLE_FIXTURES (the act-1 packs: fights, elites, boss),
// reseeding mulberry32(seed) per policy × pack, and prints one row per cell:
// policy · pack · win % · turns (mean actorTurns) · stall % · enrage % · hp end
// (mean over the party of ending HP ÷ starting HP — fixtures start at full
// HP). The --runs mode runs `simulateRun` end to end per policy (default all
// nine POLICIES), seed reseeded per policy so a seed reproduces every row bit
// for bit, and prints the act ladder, pact take/decline deltas, leader share,
// REST/ELITE/swap/sets/mains rows described in DESIGN.md → Difficulty
// targets. Both modes exit non-zero when any stall rate is above STALL_MAX
// (0.5%); --spd is --runs-only (RunConfig.spdDelta is only ever read by
// game/sim/run.ts's derive calls — game/sim/battle.ts's BATTLE_FIXTURES have
// no spdDelta hook to extend without editing that file, which is out of this
// file's scope; see this module's owner's Contract notes).
//
// Refusal rules (DESIGN.md → Module layout), never weakened: the harness will
// not run if the sim bundle mentions `window`, `document`, `localStorage` or
// `engine/`, or if validateData() returns anything.
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def;
};
const has = (name) => args.includes(`--${name}`);
const numOpt = (name, def) => {
  const raw = opt(name, undefined);
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : def;
};
const N = Number(opt('n', 2000));
const RUNS = numOpt('runs', 2000);
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const FIXTURES = opt('fixture', 'all');
const JSON_OUT = has('json');
/** Stall rate above which the harness exits non-zero — per battle in --battles, per run in --runs. */
const STALL_MAX = 0.005;

// --spd: `--spd n` (n consumed as RunConfig.spdDelta for every selected policy); a bare `--spd` (no numeric
// value right after it) instead runs the SPD gate. Either form selects --runs mode.
const spdArgIndex = args.indexOf('--spd');
const spdPresent = spdArgIndex >= 0;
const spdNextRaw = spdPresent ? args[spdArgIndex + 1] : undefined;
const spdHasValue = spdNextRaw !== undefined && !spdNextRaw.startsWith('--') && Number.isFinite(Number(spdNextRaw));
const SPD_VALUE = spdHasValue ? Number(spdNextRaw) : undefined;
const SPD_BARE = spdPresent && !spdHasValue;
const RUNS_MODE = has('runs') || spdPresent;

// --- bundle ---------------------------------------------------------------
/** A refusal is reported as one line and exit 1; anything else is a bug and keeps its stack. */
class Refusal extends Error {}
const FORBIDDEN = [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /engine\//];
const dir = await mkdtemp(join(tmpdir(), 'ember-sim-'));
async function bundle(entry, name) {
  const outfile = join(dir, name);
  await build({
    entryPoints: [new URL(entry, import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  const text = await readFile(outfile, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) throw new Refusal(`refusing to run: the ${entry} bundle mentions ${re.source} — the rules must stay headless`);
  }
  return import(pathToFileURL(outfile).href);
}

const pct = (x, digits = 1) => `${(100 * x).toFixed(digits).padStart(5)}%`;

// ============================================================== --runs mode ==
/** Slot order — RunResult.mainsWorn's per-member arrays are in this order (game/types.ts's SLOTS). */
const SLOT_ORDER = ['WEAPON', 'BOOTS', 'ARMOR', 'NECKLACE', 'CHALICE', 'TOME'];
/** The three slots with more than one possible main — DESIGN.md's "at least two mains on each open slot". */
const OPEN_SLOTS = ['BOOTS', 'NECKLACE', 'TOME'];

/** "Act N clear" = act N's boss killed on lap 1 — RunResult.probes carries one Probe per BOSS fight. */
function actClearedLap1(results, act) {
  const n = results.filter((r) => r.probes.some((p) => p.lap === 1 && p.act === act && p.won)).length;
  return n / results.length;
}
function lap2ClearAmongLappers(results) {
  const tookLap = results.filter((r) => r.probes.some((p) => p.lap === 1 && p.act === 6 && p.won));
  if (tookLap.length === 0) return { n: 0, rate: NaN };
  const cleared = tookLap.filter((r) => r.probes.some((p) => p.lap === 2 && p.act === 6 && p.won)).length;
  return { n: tookLap.length, rate: cleared / tookLap.length };
}
/** rooms is visit order; a lost run's LAST room (only) can be a loss — every earlier room was necessarily won. */
function eliteStats(results) {
  let entered = 0;
  let won = 0;
  for (const r of results) {
    const eliteCount = r.rooms.filter((t) => t === 'ELITE').length;
    entered += eliteCount;
    const lastWasElite = r.rooms.length > 0 && r.rooms[r.rooms.length - 1] === 'ELITE';
    won += eliteCount - (!r.won && lastWasElite ? 1 : 0);
  }
  return { entered, won, rate: entered > 0 ? won / entered : NaN };
}
function restHealRate(results) {
  let heal = 0;
  let total = 0;
  for (const r of results) { total += r.rests.length; heal += r.rests.filter((x) => x === 'HEAL').length; }
  return { total, rate: total > 0 ? heal / total : NaN };
}
function swapRate(results) {
  const wins = results.filter((r) => r.won);
  return { wins: wins.length, rate: wins.length > 0 ? wins.filter((r) => r.swaps >= 1).length / wins.length : NaN };
}
function stallRate(results) { return results.filter((r) => r.deathKind === 'STALL').length / results.length; }
function enrageRate(results) {
  const battles = results.reduce((s, r) => s + r.turnsPerBattle.length, 0);
  const enrages = results.reduce((s, r) => s + r.enrages, 0);
  return battles > 0 ? enrages / battles : 0;
}
function topKiller(results) {
  const counts = {};
  for (const r of results) if (r.deathKind === 'WIPE' && r.deathBy) counts[r.deathBy] = (counts[r.deathBy] ?? 0) + 1;
  let best = null;
  let bestN = 0;
  for (const [k, v] of Object.entries(counts)) if (v > bestN) { best = k; bestN = v; }
  return best ? `${best} (${bestN})` : 'n/a';
}
function leaderShare(results) {
  const wins = results.filter((r) => r.won);
  const counts = {};
  for (const r of wins) counts[r.leader] = (counts[r.leader] ?? 0) + 1;
  return { wins: wins.length, counts };
}
function setsWornShare(results) {
  const wins = results.filter((r) => r.won);
  const counts = {};
  for (const r of wins) for (const id of new Set(r.setsWorn.flat())) counts[id] = (counts[id] ?? 0) + 1;
  return { wins: wins.length, counts };
}
function mainsPerOpenSlot(results) {
  const wins = results.filter((r) => r.won);
  const bySlot = Object.fromEntries(OPEN_SLOTS.map((s) => [s, {}]));
  for (const r of wins) {
    for (const memberMains of r.mainsWorn) {
      memberMains.forEach((key, i) => {
        const slot = SLOT_ORDER[i];
        if (!OPEN_SLOTS.includes(slot) || key == null) return;
        bySlot[slot][key] = (bySlot[slot][key] ?? 0) + 1;
      });
    }
  }
  return { wins: wins.length, bySlot };
}
function pactRows(pactIds, allResults) {
  return pactIds.map((id) => {
    let takeN = 0;
    let takeWin = 0;
    let declN = 0;
    let declWin = 0;
    for (const r of allResults) {
      const cleared = r.probes.some((p) => p.lap === 1 && p.act === 6 && p.won);
      for (const s of r.shrines) {
        if (s.pact !== id) continue;
        if (s.taken) { takeN += 1; if (cleared) takeWin += 1; } else { declN += 1; if (cleared) declWin += 1; }
      }
    }
    const takePct = takeN > 0 ? (100 * takeWin) / takeN : NaN;
    const declPct = declN > 0 ? (100 * declWin) / declN : NaN;
    return { id, takeN, declN, takePct, declPct, delta: takePct - declPct };
  });
}

/** `--runs`: game/sim/run.ts's `simulateRun` per selected policy (default all nine POLICIES), seed reseeded per
 * policy. A bare `--spd` instead runs the SPD gate (`balanced` at +10 then −10, same seed, act-3 lap-1 clear).
 * Sets module-scope `exitCode` on a stall-gate or SPD-gate failure — the caller reads it after this returns. */
async function runRunsMode({ bundle: bundleFn, data, mulberry32 }) {
  const runMod = await bundleFn('../game/sim/run.ts', 'run.bundle.mjs');
  const { simulateRun, POLICIES } = runMod;
  if (typeof simulateRun !== 'function') throw new Error('game/sim/run.ts must export simulateRun');
  if (!POLICIES) throw new Error('game/sim/run.ts must export POLICIES');
  const roster = data.ROSTER;
  const config = (spdDelta) => ({ ascension: 0, vault: [], vaultSlots: 0, roster: [...roster], spdDelta });

  if (SPD_BARE) {
    const balanced = POLICIES.balanced;
    if (!balanced) throw new Error('game/sim/run.ts must export POLICIES.balanced');
    const runMany = (spdDelta) => {
      const rng = mulberry32(SEED);
      const out = [];
      for (let i = 0; i < RUNS; i++) out.push(simulateRun(config(spdDelta), balanced, rng));
      return out;
    };
    const plus = runMany(10);
    const minus = runMany(-10);
    const pPlus = 100 * actClearedLap1(plus, 3);
    const pMinus = 100 * actClearedLap1(minus, 3);
    const delta = pPlus - pMinus;
    if (JSON_OUT) {
      console.log(JSON.stringify({ mode: 'spd-gate', runs: RUNS, seed: SEED, act3Plus10: pPlus, act3Minus10: pMinus, delta }, null, 2));
    } else {
      console.log(`spd gate (${RUNS} runs, seed ${SEED}): act3 +10 ${pPlus.toFixed(1)}% / -10 ${pMinus.toFixed(1)}% Δ ${delta.toFixed(1)} pts (>= 20)`);
    }
    if (delta < 20) { console.error(`SPD GATE: Δ ${delta.toFixed(1)} pts is below the required 20`); exitCode = 1; }
    return;
  }

  const names = ONLY === 'all' ? Object.keys(POLICIES) : ONLY.split(',');
  for (const name of names) if (!POLICIES[name]) throw new Error(`unknown policy "${name}" — known: ${Object.keys(POLICIES).join(', ')}`);

  const byPolicy = names.map((name) => {
    const rng = mulberry32(SEED);
    const results = [];
    for (let i = 0; i < RUNS; i++) results.push(simulateRun(config(SPD_VALUE), POLICIES[name], rng));
    return { name, results };
  });
  const allResults = byPolicy.flatMap((p) => p.results);

  if (JSON_OUT) {
    const json = byPolicy.map(({ name, results }) => ({
      policy: name, runs: RUNS, winRate: results.filter((r) => r.won).length / RUNS,
      ladder: [1, 2, 3, 4, 5, 6].map((act) => actClearedLap1(results, act)),
      stallRate: stallRate(results), enrageRate: enrageRate(results), topKiller: topKiller(results),
      restHeal: restHealRate(results), elite: eliteStats(results), swap: swapRate(results),
      leader: leaderShare(results), setsWorn: setsWornShare(results),
    }));
    console.log(JSON.stringify({ mode: 'runs', seed: SEED, runs: RUNS, spdDelta: SPD_VALUE ?? null, policies: json,
      pacts: pactRows(data.PACT_IDS, allResults), mains: mainsPerOpenSlot(allResults) }, null, 2));
  } else {
    const spdNote = SPD_VALUE !== undefined ? ` spd ${SPD_VALUE >= 0 ? '+' : ''}${SPD_VALUE}` : '';
    console.log(`runs ${RUNS} per policy, seed ${SEED}${spdNote} — act ladder is act-N boss killed on lap 1`);
    const wP = Math.max(6, ...names.map((n) => n.length));
    console.log(`${'policy'.padEnd(wP)}   win  act1  act2  act3  act4  act5  act6  stall enrage  killer`);
    for (const { name, results } of byPolicy) {
      const win = results.filter((r) => r.won).length / RUNS;
      const ladder = [1, 2, 3, 4, 5, 6].map((act) => pct(actClearedLap1(results, act)));
      console.log(`${name.padEnd(wP)} ${pct(win)} ${ladder.join(' ')} ${pct(stallRate(results))} ${pct(enrageRate(results))}  ${topKiller(results)}`);
    }
    const random = byPolicy.find((p) => p.name === 'random');
    if (random) console.log(`random floor: ${pct(random.results.filter((r) => r.won).length / RUNS)} (< 3% target)`);
    const lapper = byPolicy.find((p) => p.name === 'lapper');
    if (lapper) {
      const { n, rate } = lap2ClearAmongLappers(lapper.results);
      console.log(`lapper lap-2 clear: ${Number.isFinite(rate) ? pct(rate) : '  n/a'} of ${n} runs that took another lap (~8% target)`);
    }
    console.log('per-policy rooms: REST HEAL % · ELITE win % · swap % (of wins)');
    for (const { name, results } of byPolicy) {
      const heal = restHealRate(results);
      const elite = eliteStats(results);
      const swap = swapRate(results);
      console.log(`  ${name.padEnd(wP)} heal ${Number.isFinite(heal.rate) ? pct(heal.rate) : '  n/a'}` +
        `  elite ${Number.isFinite(elite.rate) ? pct(elite.rate) : '  n/a'} (${elite.entered})` +
        `  swap ${Number.isFinite(swap.rate) ? pct(swap.rate) : '  n/a'}`);
    }
    console.log('leader share of wins, by character:');
    for (const { name, results } of byPolicy) {
      const { wins, counts } = leaderShare(results);
      const line = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${pct(n / Math.max(1, wins)).trim()}`).join(', ');
      console.log(`  ${name.padEnd(wP)} (${wins} wins) ${line || 'n/a'}`);
    }
    console.log('sets worn at run end, of wins (>= 5% target for every 4-piece somewhere):');
    for (const { name, results } of byPolicy) {
      const { wins, counts } = setsWornShare(results);
      const line = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id} ${pct(n / Math.max(1, wins)).trim()}`).join(', ');
      console.log(`  ${name.padEnd(wP)} (${wins} wins) ${line || 'n/a'}`);
    }
    const mains = mainsPerOpenSlot(allResults);
    console.log(`mains per open slot, all policies' wins pooled (${mains.wins} wins; >= 2 mains each target):`);
    for (const slot of OPEN_SLOTS) {
      const line = Object.entries(mains.bySlot[slot]).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
      console.log(`  ${slot.padEnd(9)} ${line || 'n/a'}`);
    }
    console.log('pact · takers % · decliners % · Δ (act 6 clear on lap 1; |Δ| <= 5 pts target):');
    for (const row of pactRows(data.PACT_IDS, allResults)) {
      const t = Number.isFinite(row.takePct) ? row.takePct.toFixed(1) : 'n/a';
      const d = Number.isFinite(row.declPct) ? row.declPct.toFixed(1) : 'n/a';
      const delta = Number.isFinite(row.delta) ? row.delta.toFixed(1) : 'n/a';
      console.log(`  ${row.id.padEnd(8)} takers ${t}% (${row.takeN})  decliners ${d}% (${row.declN})  Δ ${delta}`);
    }
  }

  const stalledPolicies = byPolicy.filter((p) => stallRate(p.results) > STALL_MAX);
  if (stalledPolicies.length) {
    console.error(`STALL GATE: ${stalledPolicies.length} polic(y/ies) above ${100 * STALL_MAX}% stalls: ` +
      stalledPolicies.map((p) => `${p.name} ${pct(stallRate(p.results), 2).trim()}`).join(', '));
    exitCode = 1;
  }
}

// ================================================================== main ==
let exitCode = 0;
try {
  const data = await bundle('../game/data/index.ts', 'data.bundle.mjs');
  const problems = data.validateData();
  if (problems.length) {
    throw new Refusal(`refusing to run: validateData() returned ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  }
  const rngMod = await bundle('../game/sim/rng.ts', 'rng.bundle.mjs');
  const { mulberry32 } = rngMod;
  if (typeof mulberry32 !== 'function') throw new Error('game/sim/rng.ts must export mulberry32(seed)');

  if (RUNS_MODE) {
    await runRunsMode({ bundle, data, mulberry32 });
  } else {
    const sim = await bundle('../game/sim/battle.ts', 'battle.bundle.mjs');
    const acts = sim.POLICY_ACTS;
    if (!acts) throw new Error('game/sim/battle.ts must export POLICY_ACTS');
    const names = ONLY === 'all' ? Object.keys(acts) : ONLY.split(',');
    for (const name of names) {
      if (!acts[name]) throw new Error(`unknown policy "${name}" — known: ${Object.keys(acts).join(', ')}`);
    }
    const allFixtures = sim.BATTLE_FIXTURES;
    if (!Array.isArray(allFixtures)) throw new Error('game/sim/battle.ts must export BATTLE_FIXTURES');
    const fixtures = FIXTURES === 'all' ? allFixtures : FIXTURES.split(',').map((f) => {
      const hit = allFixtures.find((x) => x.name === f);
      if (!hit) throw new Error(`unknown fixture "${f}" — known: ${allFixtures.map((x) => x.name).join(', ')}`);
      return hit;
    });

    /** A fresh party and pack for one battle: battle.ts's builder, which runs the fixture's own make(rng). */
    const make = (fixture, rng) => (typeof sim.buildFixture === 'function' ? sim.buildFixture(fixture, rng) : fixture.make(rng));
    /** Mean over the party of ending HP ÷ starting HP (full HP at build, so hp / maxHp; the fallen count 0). */
    const hpFraction = (before, after) => {
      if (!before.length) return 0;
      let sum = 0;
      for (let i = 0; i < before.length; i++) sum += before[i] > 0 ? Math.max(0, after[i]?.hp ?? 0) / before[i] : 0;
      return sum / before.length;
    };

    const rows = [];
    for (const name of names) {
      const policy = { act: acts[name] };
      for (const fixture of fixtures) {
        const rng = mulberry32(SEED);
        const s = { won: 0, turns: 0, stalls: 0, enrages: 0, hp: 0 };
        for (let i = 0; i < N; i++) {
          const built = make(fixture, rng);
          const before = built.party.members.map((m) => m.hp);
          const r = sim.simulateBattle(built.party, built.enemies, policy, rng);
          if (r.won) s.won++;
          if (r.stall) s.stalls++;
          if (r.enraged) s.enrages++;
          s.turns += r.actorTurns;
          s.hp += hpFraction(before, r.party.members);
        }
        rows.push({ policy: name, pack: fixture.name, battles: N, winRate: s.won / N, meanTurns: s.turns / N,
          stallRate: s.stalls / N, enrageRate: s.enrages / N, meanHpFraction: s.hp / N });
      }
    }

    const wP = Math.max(6, ...rows.map((r) => r.policy.length));
    const wF = Math.max(4, ...rows.map((r) => r.pack.length));
    if (JSON_OUT) {
      console.log(JSON.stringify({ mode: 'battles', seed: SEED, battles: N, rows }, null, 2));
    } else {
      console.log(`battles ${N} per cell, seed ${SEED} (reseeded per cell), act = each policy's act over BATTLE_FIXTURES`);
      console.log(`${'policy'.padEnd(wP)}  ${'pack'.padEnd(wF)}    win   turns  stall  enrage  hp end`);
      for (const r of rows) {
        console.log(`${r.policy.padEnd(wP)}  ${r.pack.padEnd(wF)} ${pct(r.winRate)} ${r.meanTurns.toFixed(1).padStart(7)} ${pct(r.stallRate)} ${pct(r.enrageRate)} ${pct(r.meanHpFraction, 0).padStart(7)}`);
      }
    }
    const stalled = rows.filter((r) => r.stallRate > STALL_MAX);
    if (stalled.length) {
      console.error(`STALL GATE: ${stalled.length} cell(s) above ${100 * STALL_MAX}% stalls: ` +
        stalled.map((r) => `${r.policy} × ${r.pack} ${pct(r.stallRate, 2).trim()}`).join(', '));
      exitCode = 1;
    }
  }
} catch (e) {
  if (!(e instanceof Refusal)) throw e;
  console.error(e.message);
  exitCode = 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exit(exitCode);
