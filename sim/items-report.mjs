const PICKERS = ['balanced', 'glass', 'tank'];
const SLOTS = ['WEAPON', 'ARMOR', 'NECKLACE', 'BOOTS', 'CHALICE', 'TOME'];

const newRow = () => ({ offered: 0, picked: 0, held: 0, heldWon: 0 });

export function newItemTally() {
  return { items: {}, kinds: {} };
}

const rowOf = (table, id) => {
  table[id] ??= newRow();
  return table[id];
};

export function watchPicks(policy, tally) {
  const run = { hero: null };
  const pick = (hero, offered, act) => {
    run.hero = hero;
    const chosen = policy.pick(hero, offered, act);
    for (const offer of offered) {
      if (offer.kind !== 'ITEM') {continue;}
      const row = rowOf(tally.items, offer.item.id);
      row.offered++;
      if (chosen === offer) {row.picked++;}
    }
    return chosen;
  };
  return { policy: { ...policy, pick }, run };
}

function heldItems(hero) {
  const worn = SLOTS.flatMap((slot) => (hero.equipment[slot] ? [{ item: hero.equipment[slot], level: hero.levels[slot] ?? 0, worn: true }] : []));
  return [...worn, ...hero.pack.map((o) => ({ ...o, worn: false }))];
}

export function endRun(sim, tally, run, won) {
  if (!run.hero) {return;}
  const kinds = new Set();
  for (const owned of heldItems(run.hero)) {
    const row = rowOf(tally.items, owned.item.id);
    row.held++;
    if (won) {row.heldWon++;}
    if (owned.worn) {kinds.add(sim.effectiveEffect(owned.item, owned.level).kind);}
  }
  for (const kind of kinds) {
    const row = rowOf(tally.kinds, kind);
    row.held++;
    if (won) {row.heldWon++;}
  }
  run.hero = null;
}

export function mergeTallies(into, from) {
  for (const key of ['items', 'kinds']) {
    for (const [id, row] of Object.entries(from[key])) {
      const target = rowOf(into[key], id);
      for (const f of Object.keys(row)) {target[f] += row[f];}
    }
  }
}

const pct = (n, d) => (d === 0 ? '   -' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);

function itemLines(sim, items) {
  const rows = sim.ITEMS.map((it) => ({ it, row: items[it.id] ?? newRow() }));
  rows.sort((a, b) => b.row.picked / Math.max(1, b.row.offered) - a.row.picked / Math.max(1, a.row.offered));
  return rows.map(({ it, row }) =>
    `  ${it.id.padEnd(14)} ${it.slot.padEnd(8)} ${it.rarity.padEnd(9)} ${it.effect.kind.padEnd(14)} offered ${String(row.offered).padStart(6)}` +
    `  pick ${pct(row.picked, row.offered)}  held ${String(row.held).padStart(5)}  win when held ${pct(row.heldWon, row.held)}`);
}

export function printItems(sim, name, tally) {
  console.log(`items (${name}): pick rate when offered, runs holding it at the end, their win rate`);
  for (const line of itemLines(sim, tally.items)) {console.log(line);}
  console.log(`effect kinds worn at the end (${name}):`);
  const kinds = Object.entries(tally.kinds).sort((a, b) => b[1].held - a[1].held);
  for (const [kind, row] of kinds) {console.log(`  ${kind.padEnd(14)} runs ${String(row.held).padStart(5)}  win ${pct(row.heldWon, row.held)}`);}
}

export const isPicker = (name) => PICKERS.includes(name);

export const newEventTally = () => ({});

export function addEvents(tally, events) {
  for (const [id, [a, b]] of Object.entries(events ?? {})) {
    const row = tally[id] ?? [0, 0];
    row[0] += a;
    row[1] += b;
    tally[id] = row;
  }
}

const share = (n, total) => `${((100 * n) / total).toFixed(0).padStart(3)}%`;

function eventLine(def, [a, b], runs) {
  const total = a + b;
  const [first, second] = def.options.map((o) => o.label);
  return `${''.padEnd(14)}${def.id.padEnd(10)} ${(total / runs).toFixed(2)}/run  ${share(a, total)} ${first}  /  ${share(b, total)} ${second}`;
}

const GRID = 1000;

function eventDefs(sim) {
  const defs = new Map();
  for (let i = 0; i < GRID; i++) {
    const def = sim.pickEvent(() => (i + 0.5) / GRID);
    defs.set(def.id, def);
  }
  return [...defs.values()];
}

export function printEvents(sim, name, tally, runs) {
  const seen = eventDefs(sim).filter((def) => (tally[def.id]?.[0] ?? 0) + (tally[def.id]?.[1] ?? 0) > 0);
  console.log(`${''.padEnd(12)} events (${name})${seen.length ? '' : ': none played'}`);
  for (const def of seen) {console.log(eventLine(def, tally[def.id], runs));}
}

export const eventShares = (tally) => Object.fromEntries(Object.entries(tally).map(([id, [a, b]]) => [id, { first: a, second: b }]));
