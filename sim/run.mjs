// Balance simulator runner — bundles the headless rules (game/sim/battle.ts,
// which imports only game/types.ts, game/data/* and game/sim/rng.ts) with
// esbuild and Monte Carlos them under each named policy.
//
//   node sim/run.mjs                                   # --battles: every policy × every fixture, 2000 battles each, seed 1
//   node sim/run.mjs --n 5000 --policy balanced,random --seed 7
//   node sim/run.mjs --fixture "BOSS HOLLOW_KING"      # a subset of BATTLE_FIXTURES by name (comma-separated)
//   node sim/run.mjs --json                            # machine-readable, for diffing before/after
//   node sim/run.mjs --runs 2000                       # full-run mode — not until phase 6a lands simulateRun
//
// DESIGN.md → Difficulty targets. The --battles mode runs each selected
// policy's `act` over BATTLE_FIXTURES and prints, per policy × fixture, the
// win rate, mean actor turns, stall and enrage rates and the party's mean HP
// fraction at the end. It exits non-zero when any stall rate is above
// STALL_MAX (0.5 %).
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
const N = Number(opt('n', 2000));
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const FIXTURES = opt('fixture', 'all');
const JSON_OUT = has('json');
/** Stall rate (per battle) above which the harness exits non-zero. */
const STALL_MAX = 0.005;

if (has('runs')) {
  console.error('sim/run.mjs: full-run mode (--runs) is not available until phase 6a lands game/sim/run.ts and simulateRun; ' +
    'the --battles mode (the default) runs now.');
  process.exit(2);
}

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

let exitCode = 0;
try {
  const data = await bundle('../game/data/index.ts', 'data.bundle.mjs');
  const problems = data.validateData();
  if (problems.length) {
    throw new Refusal(`refusing to run: validateData() returned ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
  }
  const sim = await bundle('../game/sim/battle.ts', 'battle.bundle.mjs');
  const rngMod = await bundle('../game/sim/rng.ts', 'rng.bundle.mjs');
  const { mulberry32 } = rngMod;
  if (typeof mulberry32 !== 'function') throw new Error('game/sim/rng.ts must export mulberry32(seed)');
  const { ENRAGE_TURN } = data;

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

  /** A fresh party and pack for one battle: the fixture's own builder, else the module's. */
  const make = (fixture, rng) => {
    if (typeof fixture.make === 'function') return fixture.make(rng);
    if (typeof sim.buildFixture === 'function') return sim.buildFixture(fixture, rng);
    throw new Error('battle.ts must export buildFixture(fixture, rng) or give each fixture a make(rng)');
  };
  /** Mean hp / maxHp over the party at the end of a battle (0 for the fallen). */
  const hpFraction = (result, built) => {
    const members = result.party?.members ?? [];
    if (!members.length) return 0;
    let sum = 0;
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const maxHp = m.maxHp ?? built.party?.members?.[i]?.maxHp ?? built.heroes?.[i]?.maxHp ?? m.def?.base?.hp ?? 0;
      sum += maxHp > 0 ? Math.max(0, m.hp) / maxHp : 0;
    }
    return sum / members.length;
  };
  /** A battle where an enemy turn ran ENRAGED: the result's own field when it has one, else the turn count. */
  const enraged = (result) => {
    if (typeof result.enraged === 'boolean') return result.enraged;
    if (typeof result.enrages === 'number') return result.enrages > 0;
    return result.actorTurns >= ENRAGE_TURN;
  };

  const rows = [];
  for (const name of names) {
    const policy = { act: acts[name] };
    for (const fixture of fixtures) {
      const rng = mulberry32(SEED);
      const s = { won: 0, turns: 0, stalls: 0, enrages: 0, hp: 0 };
      for (let i = 0; i < N; i++) {
        const built = make(fixture, rng);
        const r = sim.simulateBattle(built.party, built.enemies, policy, rng);
        if (r.won) s.won++;
        if (r.stall) s.stalls++;
        if (enraged(r)) s.enrages++;
        s.turns += r.actorTurns;
        s.hp += hpFraction(r, built);
      }
      rows.push({ policy: name, fixture: fixture.name, battles: N, winRate: s.won / N, meanTurns: s.turns / N,
        stallRate: s.stalls / N, enrageRate: s.enrages / N, meanHpFraction: s.hp / N });
    }
  }

  const pct = (x, digits = 1) => `${(100 * x).toFixed(digits).padStart(5)}%`;
  const wP = Math.max(6, ...rows.map((r) => r.policy.length));
  const wF = Math.max(7, ...rows.map((r) => r.fixture.length));
  if (JSON_OUT) {
    console.log(JSON.stringify({ mode: 'battles', seed: SEED, battles: N, rows }, null, 2));
  } else {
    console.log(`battles ${N} per cell, seed ${SEED}, act = each policy's act over BATTLE_FIXTURES`);
    console.log(`${'policy'.padEnd(wP)}  ${'fixture'.padEnd(wF)}    win   turns  stall  enrage  hp end`);
    for (const r of rows) {
      console.log(`${r.policy.padEnd(wP)}  ${r.fixture.padEnd(wF)} ${pct(r.winRate)} ${r.meanTurns.toFixed(1).padStart(7)} ${pct(r.stallRate)} ${pct(r.enrageRate)} ${pct(r.meanHpFraction, 0).padStart(7)}`);
    }
  }
  const stalled = rows.filter((r) => r.stallRate > STALL_MAX);
  if (stalled.length) {
    console.error(`STALL GATE: ${stalled.length} cell(s) above ${100 * STALL_MAX}% stalls: ` +
      stalled.map((r) => `${r.policy} × ${r.fixture} ${pct(r.stallRate, 2).trim()}`).join(', '));
    exitCode = 1;
  }
} catch (e) {
  if (!(e instanceof Refusal)) throw e;
  console.error(e.message);
  exitCode = 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exit(exitCode);
