import assert from 'node:assert/strict';

const MAP_SEEDS = 5000;
const EVENT_TRIALS = 2000;
const EVENT_STAGES = [1, 2, 3, 4];

const option = (...effects) => ({ label: 'TEST', effects });

function effectRules(sim) {
  const hero = sim.createHero();
  hero.hp = 5;
  sim.applyEventCosts(hero, option({ kind: 'hpPct', amount: -0.9 }));
  assert.equal(hero.hp, 1, 'hpPct took HP below 1');
  const base = sim.derive(hero).maxHp;
  sim.applyEventCosts(hero, option({ kind: 'maxHp', amount: 6 }));
  sim.fullHeal(hero);
  assert.equal(sim.derive(hero).maxHp, base + 6, 'maxHp gain did not persist through derive');
  sim.applyEventCosts(hero, option({ kind: 'maxHp', amount: -10 }));
  assert.equal(sim.derive(hero).maxHp, base - 4, 'maxHp loss did not persist');
  assert.ok(hero.hp <= base - 4, 'HP above the reduced max');
  hero.potions = 2;
  sim.applyEventCosts(hero, option({ kind: 'potion', amount: 2 }));
  assert.equal(hero.potions, 2, 'potion gain not clamped to the max');
  hero.potions = 0;
  sim.applyEventCosts(hero, option({ kind: 'potion', amount: -1 }));
  assert.equal(hero.potions, 0, 'potion loss went below 0');
  return 'hpPct floors at 1 HP; maxHp persists through derive; potions clamp 0..max';
}

function wardedBurnRule(sim) {
  const hero = sim.createHero();
  const ward = sim.ITEMS.find((i) => i.effect.kind === 'BURN_WARD');
  assert.ok(ward, 'no BURN_WARD item to test with');
  sim.equip(hero, ward, 0);
  assert.ok(sim.burnWarded(hero), 'equipping a BURN_WARD item did not ward');
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  assert.equal(sim.takePendingBurn(hero, 0), null, 'a BURN-warded hero still took the pending burn');
  assert.equal(hero.pendingBurn, 0, 'a warded pending burn was not consumed');
}

function burnRules(sim) {
  const hero = sim.createHero();
  assert.equal(sim.takePendingBurn(hero, 0), null, 'burn without a pending burn');
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  const first = sim.takePendingBurn(hero, 0);
  assert.deepEqual(first, { perTurn: 3, turns: 3 }, `act 1 burn ${JSON.stringify(first)}`);
  assert.equal(sim.takePendingBurn(hero, 0), null, 'pending burn consumed twice');
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  const late = sim.takePendingBurn(hero, 3);
  assert.ok(late && late.perTurn > first.perTurn && late.turns === 3, `act 4 burn ${JSON.stringify(late)}`);
  wardedBurnRule(sim);
  return `BURN_WARD shrugs off a pending burn; pendingBurn consumed once; ${String(first.perTurn)}/turn in act 1, ${String(late.perTurn)}/turn in act 4, 3 turns`;
}

function restFed(stages, s) {
  const fed = new Set();
  for (const n of stages[s - 1] ?? []) {if (n.type === 'REST') {for (const j of n.links) {fed.add(j);}}}
  return fed;
}

function checkEventMap(stages, seed) {
  assert.ok(EVENT_STAGES.some((s) => stages[s].some((n) => n.type === 'EVENT')), `seed ${seed}: no EVENT in stages 1-4`);
  stages.forEach((stage, s) => {
    const fed = restFed(stages, s);
    stage.forEach((n, j) => { assert.ok(n.type !== 'EVENT' || !fed.has(j), `seed ${seed}: EVENT ${s}.${j} linked from a REST`); });
  });
  const kept = ['ELITE', 'REST', 'LOOT'].filter((want) => stages.flat().some((n) => n.type === want));
  assert.equal(kept.length, 3, `seed ${seed}: an EVENT replaced the act's only ELITE, REST or LOOT`);
}

function eventMaps(sim) {
  let events = 0;
  for (let seed = 0; seed < MAP_SEEDS; seed++) {
    const stages = sim.generateMap(sim.createSeededRng(seed).next);
    checkEventMap(stages, seed);
    events += stages.flat().filter((n) => n.type === 'EVENT').length;
  }
  return `${MAP_SEEDS} maps: >= 1 EVENT in stages 1-4 (${(events / MAP_SEEDS).toFixed(2)} per map), none linked from a REST, ELITE + REST + LOOT kept`;
}

function randomHero(sim, rng) {
  const hero = sim.createHero();
  hero.hp = 1 + Math.floor(rng() * sim.derive(hero).maxHp);
  hero.potions = Math.floor(rng() * 3);
  if (rng() < 0.5) {hero.pack.push({ item: sim.ITEMS[Math.floor(rng() * sim.ITEMS.length)], level: 0 });}
  if (rng() < 0.3) {hero.pack.push({ item: sim.ITEMS[Math.floor(rng() * sim.ITEMS.length)], level: 0 });}
  return hero;
}

function choiceRules(sim) {
  const rng = sim.createSeededRng(11).next;
  let disabledSeen = 0;
  for (let t = 0; t < EVENT_TRIALS; t++) {
    const hero = randomHero(sim, rng);
    const event = sim.pickEvent(rng);
    const open = event.options.map((o) => sim.eventOptionEnabled(hero, o));
    if (!open[0] || !open[1]) {disabledSeen += 1;}
    if (!open[0] && !open[1]) {continue;}
    const picks = Object.entries(sim.POLICIES).map(([name, p]) => [name, p.eventChoice(hero, event)]);
    picks.push(['randomEventChoice', sim.randomEventChoice(hero, event, rng)]);
    for (const [name, i] of picks) {assert.ok(open[i], `${name} chose a disabled option of ${event.id}`);}
  }
  assert.ok(disabledSeen > 100, `only ${disabledSeen} trials had a disabled option`);
  return `${EVENT_TRIALS} events (${disabledSeen} with a dim option): no policy chose a disabled option`;
}

function eventRuns(sim) {
  const rng = sim.createSeededRng(5).next;
  let taken = 0;
  for (let i = 0; i < 100; i++) {
    const r = sim.simulateRun(sim.POLICIES.balanced, rng);
    for (const split of Object.values(r.events ?? {})) {taken += split[0] + split[1];}
  }
  assert.ok(taken > 50, `only ${taken} events played in 100 runs`);
  return `${taken} events played in 100 balanced runs`;
}

export function eventRules(sim) {
  const bad = sim.validateEvents();
  assert.deepEqual(bad, [], `validateEvents: ${bad.join('; ')}`);
  return [effectRules(sim), burnRules(sim), eventMaps(sim), choiceRules(sim), eventRuns(sim)].join(' | ');
}
