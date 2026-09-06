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
//   node sim/run.mjs --battles --spd 10                # --battles mode with the same flat SPD delta, "spd +10" per row
//   node sim/run.mjs --battles --runs 5000             # --battles mode, 5000 battles per cell (--runs is an alias for
//                                                       #   --n here unless --n is ALSO given, in which case --n wins)
//   node sim/run.mjs --runs 2000 --vault 3              # --runs mode, RunConfig.vault/vaultSlots seeded with 3
//                                                       #   already-kindled relics (WEAPON/ARMOR/CHALICE) — the Vault
//                                                       #   guard (DESIGN.md -> Difficulty targets) from the CLI
//   node sim/run.mjs --json                            # machine-readable, for diffing before/after
//   node sim/run.mjs --runs 200 --seed 7 --dump        # + sha256 of the FULL RunResult[] per policy (per
//                                                       #   policy × fixture in --battles mode): the equivalence
//                                                       #   proof the aggregates cannot give — a reordering that
//                                                       #   averages to the same numbers changes the hash
//   node sim/run.mjs --selfcheck --runs 50 --seed 7    # simulateRun vs runSteps+answerWith vs runstep.ts's
//                                                       #   createRun, same seed, deep-equal per run
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
// (0.5%). --spd's flat delta reaches both modes (DESIGN.md: "the --battles
// fixtures included") — in --runs mode it rides RunConfig.spdDelta into
// game/sim/run.ts's own derive calls; in --battles mode this file passes it
// as game/sim/battle.ts's BattleCtx.spdDelta, which createBattle forwards
// into buildHeroes for the fixture heroes. A bare --spd (no number) always
// selects --runs mode for the SPD gate — pass --battles explicitly to keep
// --spd's numeric form on the battles path instead (see the example above).
//
// Refusal rules (DESIGN.md → Module layout), never weakened: the harness will
// not run if the sim bundle mentions `window`, `document`, `localStorage` or
// `engine/`, or if validateData() returns anything.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
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
const RUNS = numOpt('runs', 2000);
const SEED = Number(opt('seed', 1));
const ONLY = opt('policy', 'all');
const FIXTURES = opt('fixture', 'all');
const JSON_OUT = has('json');
/** --dump: sha256 over the FULL per-run (or per-battle) records rather than the aggregates — two builds of the
 * rules are equivalent only if these match, and a reordering that averages to the same numbers does not. */
const DUMP = has('dump');
/** --selfcheck: the three ways to run the seam, over one seed, deep-equal. */
const SELFCHECK = has('selfcheck');
const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** 0-3: how many already-kindled Vault relics RunConfig.vault/vaultSlots start the run with (--runs mode
 * only — BATTLE_FIXTURES has no RunConfig at all). Clamped here, not just documented, so an out-of-range
 * value (negative, or past VAULT_EQUIP_MAX's 3) can't silently pass through as something other than what the
 * three built-in relics (WEAPON/ARMOR/CHALICE) can actually represent. */
const VAULT_N = has('vault') ? Math.max(0, Math.min(3, numOpt('vault', 0))) : 0;
/** Stall rate above which the harness exits non-zero — per battle in --battles, per run in --runs. */
const STALL_MAX = 0.005;

// --spd: `--spd n` (n consumed as a flat SPD delta for every selected policy — RunConfig.spdDelta in --runs
// mode, BattleCtx.spdDelta in --battles mode); a bare `--spd` (no numeric value right after it) instead runs
// the SPD gate, which only exists in --runs mode. Either form selects --runs mode UNLESS --battles is also
// given, in which case --battles wins and a numeric --spd applies to the fixture battles instead (a bare
// --spd alongside --battles has no gate to run and is silently a no-op delta, same as omitting --spd).
const BATTLES = has('battles');
const spdArgIndex = args.indexOf('--spd');
const spdPresent = spdArgIndex >= 0;
const spdNextRaw = spdPresent ? args[spdArgIndex + 1] : undefined;
const spdHasValue = spdNextRaw !== undefined && !spdNextRaw.startsWith('--') && Number.isFinite(Number(spdNextRaw));
const SPD_VALUE = spdHasValue ? Number(spdNextRaw) : undefined;
const SPD_BARE = spdPresent && !spdHasValue && !BATTLES;
// --vault N > 0 has no meaning in --battles mode (BATTLE_FIXTURES builds its own party, never touching
// RunConfig) — refuse the combination outright rather than silently dropping it the way --battles --runs N
// used to silently drop --runs; --vault alone (no --runs, no --spd) still selects --runs mode on its own.
if (BATTLES && VAULT_N > 0) {
  console.error('refusing: --vault has no effect in --battles mode (BATTLE_FIXTURES never reads RunConfig.vault) — drop --battles, or drop --vault');
  process.exit(1);
}
const RUNS_MODE = !BATTLES && (has('runs') || spdPresent || VAULT_N > 0);
/** " spd +10" / " spd -10" / "" — shared by both modes' headers and JSON. */
const spdNote = SPD_VALUE !== undefined ? ` spd ${SPD_VALUE >= 0 ? '+' : ''}${SPD_VALUE}` : '';
// battles-per-cell: --n is the native flag; --runs is accepted as an alias for it in --battles mode (so
// "--battles --runs 5000" means 5000 battles per cell, not a silently-ignored value) UNLESS --n was ALSO
// given explicitly, in which case --n wins.
const N = BATTLES && has('runs') && !has('n') ? RUNS : Number(opt('n', 2000));

// --- bundle ---------------------------------------------------------------
/** A refusal is reported as one line and exit 1; anything else is a bug and keeps its stack. */
class Refusal extends Error {}
const FORBIDDEN = [/\bwindow\b/, /\bdocument\b/, /\blocalStorage\b/, /engine\//];
const dir = await mkdtemp(join(tmpdir(), 'ember-sim-'));
async function bundleWith(input, label, name) {
  const outfile = join(dir, name);
  await build({
    ...input,
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  const text = await readFile(outfile, 'utf8');
  for (const re of FORBIDDEN) {
    if (re.test(text)) throw new Refusal(`refusing to run: the ${label} bundle mentions ${re.source} — the rules must stay headless`);
  }
  return import(pathToFileURL(outfile).href);
}
/** One module of the rules, by path. */
const bundle = (entry, name) => bundleWith({ entryPoints: [new URL(entry, import.meta.url).pathname] }, entry, name);
/** Several modules of the rules as ONE bundle — the only way to hold run.ts and runstep.ts in a single module
 * instance, which --selfcheck needs (two bundles would compare two copies of the rules, not one). */
const bundleSource = (contents, label, name) =>
  bundleWith({ stdin: { contents, resolveDir: new URL('.', import.meta.url).pathname, loader: 'ts' } }, label, name);

const pct = (x, digits = 1) => `${(100 * x).toFixed(digits).padStart(5)}%`;

// --vault N: RunConfig.vault/vaultSlots IS the harness seam for the Vault-guard scenario (DESIGN.md ->
// Difficulty targets: "a balanced party wearing three kindled Vault relics") — only the CLI lacked a flag
// for it. Three already-kindled (EPIC, +6, sigil-bearing) relics, one per fixed-main slot, matching the
// slot's real RELIC_MAIN_BASE (data/relics.ts). Three DIFFERENT 2-piece sets (FATAL/ENDURE/FOCUS), one
// relic each, so none of them completes a pair — three of the SAME 2-piece set (FATAL, originally) reads
// floor(3/2) = 1 application of its stat bonus (+15 % ATK), which is a set-completion effect baked into
// every measurement, not the pure per-relic power this scenario means to isolate. N beyond 3 is accepted
// but only these three exist to equip.
const VAULT_RELICS = [
  { id: 'cli-vault-weapon', slot: 'WEAPON', rarity: 'EPIC', set: 'FATAL', level: 6, kindled: true,
    main: { key: 'ATK', base: 36 }, subs: [{ key: 'CRIT', value: 20, rolls: 4 }, { key: 'SPD', value: 15, rolls: 3 }], sigil: 'OPENER' },
  { id: 'cli-vault-armor', slot: 'ARMOR', rarity: 'EPIC', set: 'ENDURE', level: 6, kindled: true,
    main: { key: 'HP', base: 450 }, subs: [{ key: 'DEF', value: 30, rolls: 4 }, { key: 'RES', value: 16, rolls: 3 }], sigil: 'BASTION' },
  { id: 'cli-vault-chalice', slot: 'CHALICE', rarity: 'EPIC', set: 'FOCUS', level: 6, kindled: true,
    main: { key: 'DEF', base: 36 }, subs: [{ key: 'HP', value: 500, rolls: 3 }, { key: 'ACC', value: 20, rolls: 4 }], sigil: 'MENDING' },
];
/** The RunConfig every --runs-mode run is built from — one shared `vault` array, exactly as before. */
function configFactory(roster) {
  const vault = VAULT_N > 0 ? VAULT_RELICS.slice(0, Math.min(3, VAULT_N)) : [];
  return (spdDelta) => ({ ascension: 0, vault, vaultSlots: VAULT_N, roster: [...roster], spdDelta });
}

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
  const config = configFactory(roster);

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
    const dump = DUMP ? { 'balanced+10': sha(plus), 'balanced-10': sha(minus) } : undefined;
    if (JSON_OUT) {
      console.log(JSON.stringify({ mode: 'spd-gate', runs: RUNS, seed: SEED, act3Plus10: pPlus, act3Minus10: pMinus, delta, dump }, null, 2));
    } else {
      console.log(`spd gate (${RUNS} runs, seed ${SEED}): act3 +10 ${pPlus.toFixed(1)}% / -10 ${pMinus.toFixed(1)}% Δ ${delta.toFixed(1)} pts (>= 20)`);
      if (dump) for (const [k, v] of Object.entries(dump)) console.log(`dump ${k.padEnd(12)} ${v}`);
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
  // --dump: the hash is over the FULL RunResult[] of a policy, in run order — every room, every relic, every
  // probe. Two builds that agree here are the same rules; aggregates can agree while the runs differ.
  const dumps = DUMP ? byPolicy.map(({ name, results }) => ({ policy: name, sha256: sha(results) })) : undefined;

  if (JSON_OUT) {
    const json = byPolicy.map(({ name, results }) => ({
      policy: name, runs: RUNS, winRate: results.filter((r) => r.won).length / RUNS,
      ladder: [1, 2, 3, 4, 5, 6].map((act) => actClearedLap1(results, act)),
      stallRate: stallRate(results), enrageRate: enrageRate(results), topKiller: topKiller(results),
      restHeal: restHealRate(results), elite: eliteStats(results), swap: swapRate(results),
      leader: leaderShare(results), setsWorn: setsWornShare(results),
    }));
    console.log(JSON.stringify({ mode: 'runs', seed: SEED, runs: RUNS, spdDelta: SPD_VALUE ?? null, vault: VAULT_N || null, policies: json,
      pacts: pactRows(data.PACT_IDS, allResults), mains: mainsPerOpenSlot(allResults), dump: dumps }, null, 2));
  } else {
    const vaultNote = VAULT_N > 0 ? ` vault ${Math.min(3, VAULT_N)} kindled` : '';
    console.log(`runs ${RUNS} per policy, seed ${SEED}${spdNote}${vaultNote} — act ladder is act-N boss killed on lap 1`);
    if (dumps) for (const d of dumps) console.log(`dump ${d.policy.padEnd(8)} ${d.sha256}`);
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

// ============================================================= --selfcheck ==
/**
 * The seam's own equivalence check, run inside ONE bundle so all three ways exercise the same module instance
 * of the rules: for each selected policy, over `--runs` runs off one seed, these must produce byte-identical
 * RunResults —
 *   (a) `simulateRun(config, policy, rng)`                     — the harness's own entry point;
 *   (b) `runSteps` + `answerWith`, driven from here            — the generator drained from OUTSIDE run.ts;
 *   (c) `createRun(config, rng)` + `decide`, from runstep.ts   — the path a screen takes.
 * (c) also asserts the interactive contract on every decision: `state().phase` names the open pending, and
 * `decide` moves `token()`. A divergence names the policy and the first run index that differed.
 */
async function runSelfcheck({ data, mulberry32 }) {
  const mod = await bundleSource(
    "export * from '../game/sim/run.ts';\nexport { createRun } from '../game/sim/runstep.ts';\n" +
      "export { nextReady, runTurn, isOver, battleOutcome } from '../game/sim/battle.ts';\n",
    'game/sim/run.ts + game/sim/runstep.ts + game/sim/battle.ts', 'seam.bundle.mjs');
  for (const name of ['simulateRun', 'runSteps', 'answerWith', 'createRun', 'maxHpOf', 'mkDeriveCtx']) {
    if (typeof mod[name] !== 'function') throw new Error(`the seam bundle must export ${name}()`);
  }
  const { simulateRun, runSteps, answerWith, createRun, POLICIES } = mod;
  if (!POLICIES) throw new Error('game/sim/run.ts must export POLICIES');
  const config = configFactory(data.ROSTER);
  const runs = has('runs') ? RUNS : 50;

  const viaSteps = (cfg, policy, rng) => {
    const steps = runSteps(cfg, rng);
    let step = steps.next();
    while (!step.done) step = steps.next(answerWith(step.value, policy, rng));
    return step.value;
  };
  const viaCreateRun = (cfg, policy, rng) => {
    const run = createRun(cfg, rng);
    for (let guard = 0; ; guard++) {
      const pending = run.pending();
      if (!pending) break;
      if (guard > 500000) throw new Error('createRun: no end after 500000 decisions');
      const phase = run.state().phase;
      if (phase !== pending.kind) throw new Error(`createRun: state().phase "${phase}" does not name the open pending "${pending.kind}"`);
      const before = run.token();
      run.decide(answerWith(pending, policy, rng));
      if (run.token() === before) throw new Error(`createRun: decide() did not advance the run on a ${pending.kind} pending`);
    }
    const result = run.result();
    if (!result) throw new Error('createRun: the run ended with no result');
    if (!run.state().over) throw new Error('createRun: state().over is false after the run ended');
    return result;
  };

  const names = ONLY === 'all' ? Object.keys(POLICIES) : ONLY.split(',');
  for (const name of names) if (!POLICIES[name]) throw new Error(`unknown policy "${name}" — known: ${Object.keys(POLICIES).join(', ')}`);
  console.log(`selfcheck: ${runs} runs per policy, seed ${SEED}${spdNote} — simulateRun vs runSteps+answerWith vs createRun`);
  const wP = Math.max(6, ...names.map((n) => n.length));
  for (const name of names) {
    const policy = POLICIES[name];
    const rngA = mulberry32(SEED);
    const rngB = mulberry32(SEED);
    const rngC = mulberry32(SEED);
    const all = [];
    let bad = '';
    for (let i = 0; i < runs; i++) {
      const a = simulateRun(config(SPD_VALUE), policy, rngA);
      const b = viaSteps(config(SPD_VALUE), policy, rngB);
      const c = viaCreateRun(config(SPD_VALUE), policy, rngC);
      const [ja, jb, jc] = [JSON.stringify(a), JSON.stringify(b), JSON.stringify(c)];
      if (!bad && ja !== jb) bad = `run ${i}: runSteps+answerWith differs from simulateRun`;
      if (!bad && ja !== jc) bad = `run ${i}: createRun differs from simulateRun`;
      all.push(a);
    }
    if (bad) { console.error(`SELFCHECK: ${name} — ${bad}`); exitCode = 1; }
    console.log(`  ${name.padEnd(wP)} ${bad ? 'DIFFERS' : '     ok'}  ${sha(all)}`);
  }

  const problems = probeRunContract(mod, config(SPD_VALUE), mulberry32(SEED));
  console.log(`  ${'contract'.padEnd(wP)} ${problems.length ? 'FAILS' : '     ok'}  ${problems.length ? '' : 'stale-token guard · view isolation · map/party/leader fields'}`);
  for (const p of problems) console.error(`SELFCHECK contract: ${p}`);
  if (problems.length) exitCode = 1;

  const screenProblems = probeScreenPaths(mod, config, mulberry32);
  console.log(`  ${'screens'.padEnd(wP)} ${screenProblems.length ? 'FAILS' : '     ok'}  ${screenProblems.length ? '' : 'deathBy survives a drained event log · a withdrawn Vault relic is not still banked'}`);
  for (const p of screenProblems) console.error(`SELFCHECK screens: ${p}`);
  if (screenProblems.length) exitCode = 1;
}

/**
 * Two things only a screen does, which no policy driver would ever catch:
 *  (a) it DRAINS `battle.events` every turn (screens/battle.ts's schedulePlayback empties the queue inside the
 *      call that fills it), so a WIPE must still name its killer — `findDeathBy` reads `battle.kills`;
 *  (b) it starts a run with a Vault, and a relic equipped out of the Vault must not also be banked back out of
 *      it (DESIGN.md:919 — equipping withdraws).
 * Returns a list of problems; empty is a pass.
 */
function probeScreenPaths({ createRun, answerWith, POLICIES, nextReady, runTurn, isOver, battleOutcome }, config, mulberry32) {
  const problems = [];

  // (a) the battle screen's loop: run the turns and throw the event queue away as it goes.
  const asAScreen = (pending) => {
    const battle = pending.battle;
    for (;;) {
      const actor = nextReady(battle);
      if (!actor) break;
      runTurn(battle, actor, actor.side === 'HERO' ? 0 : undefined);
      battle.events.length = 0; // schedulePlayback: drained inside the same call that filled it
      if (isOver(battle)) break;
    }
    battle.events.length = 0;
    return { result: battleOutcome(battle) };
  };
  const rng = mulberry32(SEED);
  let wipes = 0;
  for (let i = 0; i < 40 && wipes < 3; i++) {
    const run = createRun(config(SPD_VALUE), rng);
    for (let guard = 0; run.pending() && guard < 100000; guard++) {
      const p = run.pending();
      run.decide(p.kind === 'BATTLE' ? asAScreen(p) : answerWith(p, POLICIES.random, rng), run.token());
    }
    const r = run.result();
    if (r && r.deathKind === 'WIPE') {
      wipes += 1;
      if (!r.deathBy) problems.push('a WIPE played out through a drained event log reported no deathBy');
    }
  }
  if (wipes === 0) problems.push('no WIPE happened in 40 screen-driven runs — the deathBy probe proved nothing');

  // (b) three kindled Vault relics, all equipped: none of them may still be in the Vault at the end.
  if (VAULT_RELICS.length >= 3) {
    const vaultCfg = { ascension: 0, vault: VAULT_RELICS.slice(0, 3), vaultSlots: 3, roster: [...config(undefined).roster] };
    const vrng = mulberry32(SEED);
    const run = createRun(vaultCfg, vrng);
    let equipped = [];
    for (let guard = 0; run.pending() && guard < 100000; guard++) {
      const p = run.pending();
      const answer = answerWith(p, POLICIES.balanced, vrng);
      if (p.kind === 'VAULT_EQUIP') equipped = [...answer].map((i) => p.vault[i].id);
      run.decide(answer, run.token());
      if (p.kind === 'VAULT_EQUIP') {
        const left = run.state().vault.map((r) => r.id);
        for (const id of equipped) if (left.includes(id)) problems.push(`${id} was equipped out of the Vault and is still in it`);
      }
    }
    if (equipped.length === 0) problems.push('balanced equipped nothing from a three-relic Vault — the withdrawal probe proved nothing');
    const banked = run.result().banked.map((r) => r.id);
    for (const id of equipped) {
      if (banked.filter((b) => b === id).length > 1) problems.push(`${id} is in the banked Vault twice`);
    }
  }
  return problems;
}

/**
 * The interactive contract a screen relies on, probed once over one run (not per policy): the stale-token
 * guard on `decide`, the isolation of `state()` from the run's own objects, and the view fields the screens
 * read instead of re-deriving a rule. Returns a list of problems; empty is a pass.
 */
function probeRunContract({ createRun, answerWith, POLICIES, maxHpOf }, cfg, rng) {
  const problems = [];
  const policy = POLICIES.balanced;
  const run = createRun(cfg, rng);

  // (1) the stale-token guard: the token drawn WITH a pending answers that pending and nothing later.
  const drawn = run.token();
  const first = run.pending();
  const answer = answerWith(first, policy, rng);
  if (run.decide(answer, drawn) !== true) problems.push('decide(answer, live token) did not land');
  const openNow = run.pending();
  const tokenNow = run.token();
  if (run.decide(answer, drawn) !== false) {
    problems.push(`a stale token was accepted — the ${first.kind} answer landed on the ${openNow && openNow.kind} that followed`);
  }
  if (run.token() !== tokenNow) problems.push('a refused decide still moved the run');
  if (run.pending() !== openNow) problems.push('a refused decide still consumed the open pending');
  if (run.decide(answerWith(run.pending(), policy, rng)) !== true) problems.push('decide(answer) without a token stopped working');

  // (2) state() is a copy: a screen writing to it cannot reach the run's own party.
  const withParty = run.pending();
  if (withParty && withParty.party) {
    const live = withParty.party.members[0];
    const hp0 = live.hp;
    const view = run.state();
    if (view.party.members[0] === live) problems.push('state().party.members[0] IS the run\'s live member object');
    view.party.members[0].hp = -999;
    view.party.members[0].relics = {};
    view.rooms.push('BOSS');
    if (live.hp !== hp0) problems.push('writing to state().party.members[0].hp reached the run');
    if (Object.keys(live.relics).length !== Object.keys(withParty.party.members[0].relics).length) {
      problems.push('writing to state().party.members[0].relics reached the run');
    }
  }

  // (3) the additive fields, and the map mirror while a ROUTE is open.
  let guard = 0;
  while (run.pending() && run.pending().kind !== 'ROUTE' && guard++ < 10000) {
    run.decide(answerWith(run.pending(), policy, rng), run.token());
  }
  const route = run.pending();
  if (!route || route.kind !== 'ROUTE') {
    problems.push('never reached a ROUTE pending');
  } else {
    const view = run.state();
    for (const key of ['path', 'offeredIdxs', 'offeredTypes', 'totalClears', 'actsCleared', 'map']) {
      if (!(key in view)) problems.push(`RunView is missing ${key}`);
    }
    if (JSON.stringify(view.offeredIdxs) !== JSON.stringify(route.offeredIdxs)) problems.push('state().offeredIdxs does not mirror the open ROUTE');
    if (JSON.stringify(view.offeredTypes) !== JSON.stringify(route.offeredTypes)) problems.push('state().offeredTypes does not mirror the open ROUTE');
    if (!view.map) problems.push('state().map is null while a ROUTE is open');
    for (const m of view.party.members) if (!(maxHpOf(view, m) > 0)) problems.push('maxHpOf(view, member) is not positive');
    const chose = route.offeredIdxs[0];
    run.decide(0, run.token());
    const after = run.state();
    if (after.offeredIdxs.length !== 0) problems.push('state().offeredIdxs survives its ROUTE');
    const last = after.path[after.path.length - 1];
    if (!last || last.stage !== route.stage || last.nodeIdx !== chose) problems.push('state().path did not record the node just taken');
    if (after.stage !== route.stage || after.nodeIdx !== chose) problems.push('state().stage/nodeIdx did not follow the route');
  }
  return problems;
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

  if (SELFCHECK) {
    await runSelfcheck({ data, mulberry32 });
  } else if (RUNS_MODE) {
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

    // --spd's flat delta on the fixture heroes: BattleCtx.spdDelta, forwarded by createBattle into
    // buildHeroes — see game/sim/battle.ts's BattleCtx doc. undefined when --spd was not given.
    const battleCtx = { spdDelta: SPD_VALUE };

    const rows = [];
    for (const name of names) {
      const policy = { act: acts[name] };
      for (const fixture of fixtures) {
        const rng = mulberry32(SEED);
        const s = { won: 0, turns: 0, stalls: 0, enrages: 0, hp: 0 };
        // --dump's per-cell trace: every battle's outcome and its whole Probe, in battle order. Collected only
        // under --dump, and never drawn from — the rng stream is what it always was.
        const trace = DUMP ? [] : null;
        for (let i = 0; i < N; i++) {
          const built = make(fixture, rng);
          const before = built.party.members.map((m) => m.hp);
          const r = sim.simulateBattle(built.party, built.enemies, policy, rng, battleCtx);
          if (r.won) s.won++;
          if (r.stall) s.stalls++;
          if (r.enraged) s.enrages++;
          s.turns += r.actorTurns;
          s.hp += hpFraction(before, r.party.members);
          if (trace) trace.push({ won: r.won, stall: r.stall, enraged: r.enraged, actorTurns: r.actorTurns,
            probe: r.probe, hp: r.party.members.map((m) => m.hp) });
        }
        rows.push({ policy: name, pack: fixture.name, battles: N, winRate: s.won / N, meanTurns: s.turns / N,
          stallRate: s.stalls / N, enrageRate: s.enrages / N, meanHpFraction: s.hp / N,
          ...(trace ? { sha256: sha(trace) } : {}) });
      }
    }

    const wP = Math.max(6, ...rows.map((r) => r.policy.length));
    const wF = Math.max(4, ...rows.map((r) => r.pack.length));
    if (JSON_OUT) {
      console.log(JSON.stringify({ mode: 'battles', seed: SEED, battles: N, spdDelta: SPD_VALUE ?? null, rows }, null, 2));
    } else {
      console.log(`battles ${N} per cell, seed ${SEED} (reseeded per cell)${spdNote}, act = each policy's act over BATTLE_FIXTURES`);
      console.log(`${'policy'.padEnd(wP)}  ${'pack'.padEnd(wF)}    win   turns  stall  enrage  hp end`);
      for (const r of rows) {
        console.log(`${r.policy.padEnd(wP)}  ${r.pack.padEnd(wF)} ${pct(r.winRate)} ${r.meanTurns.toFixed(1).padStart(7)} ${pct(r.stallRate)} ${pct(r.enrageRate)} ${pct(r.meanHpFraction, 0).padStart(7)}`);
      }
      if (DUMP) for (const r of rows) console.log(`dump ${r.policy.padEnd(wP)} ${r.pack.padEnd(wF)} ${r.sha256}`);
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
