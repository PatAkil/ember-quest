const ACTS = 4;
const DEPTHS = [2, 3, 4, 5];

const bump = (counts, key, by = 1) => { counts[key] = (counts[key] ?? 0) + by; };
const pct = (n, d) => (d === 0 ? '-' : `${((100 * n) / d).toFixed(0)}%`);

export const newDescent = () => ({
  runs: 0, beat: 0, cleared: {}, finalN: [], causes: {}, killers: {}, affixDeaths: {}, deaths: 0, taken: {}, through: {},
});

const actsCleared = (r) => (r.won ? r.actReached + 1 : r.actReached);

function tallyDeath(d, r) {
  const cause = r.deathKind === 'STALL' ? 'STALL' : r.thornsDeath ? 'THORNS' : r.deathBy === 'HOLLOW' ? 'HOLLOW' : r.deathKind;
  d.deaths++;
  bump(d.causes, cause);
  bump(d.killers, r.deathBy);
  for (const affix of r.deathAffixes ?? []) {bump(d.affixDeaths, affix);}
}

function tallyPacts(d, r, cleared) {
  (r.pacts ?? []).forEach((id, i) => {
    bump(d.taken, id);
    if (cleared >= ACTS * (i + 2)) {bump(d.through, id);}
  });
}

export function tallyDescent(d, r) {
  d.runs++;
  if (r.actReached < ACTS && !r.won) {return;}
  const cleared = actsCleared(r);
  d.beat++;
  d.finalN.push(r.actReached);
  for (const depth of DEPTHS) {if (cleared >= ACTS * depth) {bump(d.cleared, depth);}}
  if (!r.won) {tallyDeath(d, r);}
  tallyPacts(d, r, cleared);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const sortedEntries = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1]);

export function summarizeDescent(d) {
  const share = (n) => (d.beat ? n / d.beat : 0);
  const through = Object.fromEntries(sortedEntries(d.taken).map(([id, n]) => [id, { taken: n, through: (d.through[id] ?? 0) / n }]));
  return {
    runs: d.runs, beatSeraph: d.beat,
    clearDepth: Object.fromEntries(DEPTHS.map((depth) => [depth, share(d.cleared[depth] ?? 0)])),
    clearDepthCount: Object.fromEntries(DEPTHS.map((depth) => [depth, d.cleared[depth] ?? 0])),
    meanFinalN: d.finalN.length ? d.finalN.reduce((a, b) => a + b, 0) / d.finalN.length : 0,
    medianFinalN: median(d.finalN),
    deathCauses: Object.fromEntries(sortedEntries(d.causes).map(([k, v]) => [k, d.deaths ? v / d.deaths : 0])),
    topKillers: sortedEntries(d.killers).slice(0, 6),
    affixKillShare: Object.fromEntries(sortedEntries(d.affixDeaths).map(([k, v]) => [k, d.deaths ? v / d.deaths : 0])),
    pacts: through,
    stalls: d.causes.STALL ?? 0,
  };
}

const shares = (obj) => Object.entries(obj).map(([k, v]) => `${k} ${pct(v, 1)}`).join(' ');

export function printDescent(name, s) {
  const pad = ''.padEnd(12);
  const clears = DEPTHS.map((depth) => `d${depth} ${pct(s.clearDepth[depth], 1)} (${s.clearDepthCount[depth]})`).join('  ');
  console.log(`${name.padEnd(12)} descent: beat seraph ${s.beatSeraph}/${s.runs}  clear ${clears}` +
    `  final n mean ${s.meanFinalN.toFixed(1)} median ${s.medianFinalN}  stalls ${s.stalls}`);
  console.log(`${pad} deaths ${shares(s.deathCauses)}  top ${s.topKillers.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`${pad} affix on killer ${shares(s.affixKillShare)}`);
  console.log(`${pad} pacts ${Object.entries(s.pacts).map(([id, p]) => `${id} ${p.taken} (${pct(p.through, 1)})`).join('  ')}`);
}

export function pooledPacts(table) {
  const pooled = {};
  for (const [name, s] of Object.entries(table)) {
    if (name === 'random') {continue;}
    for (const [id, p] of Object.entries(s.pacts)) {
      const row = pooled[id] ?? { taken: 0, through: 0 };
      row.taken += p.taken;
      row.through += p.taken * p.through;
      pooled[id] = row;
    }
  }
  return Object.fromEntries(Object.entries(pooled).map(([id, p]) => [id, { taken: p.taken, through: p.taken ? p.through / p.taken : 0 }]));
}

export function printPooled(pooled) {
  const rows = Object.entries(pooled).sort((a, b) => b[1].through - a[1].through);
  console.log(`pacts pooled (non-random): ${rows.map(([id, p]) => `${id} ${p.taken} (${pct(p.through, 1)})`).join('  ')}`);
}

const BOSS_ACTS = [0, 1, 2, 3];
const LONG_FIGHT = 16;

export const newBossTurns = () => BOSS_ACTS.map(() => ({ turns: [], dpt: [], hp: [], heavy: [] }));

export function tallyBossTurns(table, probe) {
  const row = table[probe.act];
  if (!row) {return;}
  row.turns.push(probe.turns);
  row.dpt.push(probe.dpt);
  row.hp.push(probe.bossHp);
  row.heavy.push(probe.heavyShare);
}

function quantile(xs, q) {
  if (xs.length === 0) {return null;}
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function summarizeBossTurns(table) {
  return table.map((row) => ({
    fights: row.turns.length,
    median: quantile(row.turns, 0.5),
    p90: quantile(row.turns, 0.9),
    long: row.turns.length ? row.turns.filter((t) => t > LONG_FIGHT).length / row.turns.length : null,
    dptP25: quantile(row.dpt, 0.25),
    bossHp: mean(row.hp),
    heavyShare: mean(row.heavy),
  }));
}

const cell = (r) => (r.fights === 0 ? '      -       ' : `${String(r.median).padStart(2)}/${String(r.p90).padStart(2)} ${(100 * r.long).toFixed(0).padStart(3)}%`);

export function printBossTurns(name, rows) {
  const dpt = rows.map((r) => (r.dptP25 === null ? '-' : `${r.dptP25.toFixed(0)}/${(r.bossHp ?? 0).toFixed(0)}`)).join(' ');
  const heavy = rows.map((r) => (r.heavyShare === null ? '-' : `${(100 * r.heavyShare).toFixed(0)}%`)).join('/');
  console.log(`${''.padEnd(12)} boss turns med/p90 >${LONG_FIGHT} a1..a4 ${rows.map(cell).join(' | ')}  p25 dmg/turn / boss HP ${dpt}  phase-2 HEAVY ${heavy}`);
}
