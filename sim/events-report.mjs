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
