import assert from 'node:assert/strict';

const itemOf = (sim, id) => {
  const item = sim.ITEMS.find((i) => i.id === id);
  assert.ok(item, `no item ${id}`);
  return item;
};

function richHero(sim, depth, rng) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 2);
  sim.equip(hero, itemOf(sim, 'LEATHER_VEST'), 1);
  sim.equip(hero, itemOf(sim, 'BONE_CHARM'), 0);
  sim.stow(hero, { item: itemOf(sim, 'WILLOW_WAND'), level: 1 });
  sim.stow(hero, { item: itemOf(sim, 'SWIFT_BOOTS'), level: 0 });
  for (let d = 2; d <= depth + 1; d++) {
    const [first] = sim.offerPacts(hero, rng);
    if (first) {sim.takePact(hero, first);}
  }
  Object.assign(hero, { sp: 3, ember: 42, potions: 1, burn: { perTurn: 4, turns: 2 }, pendingBurn: 6, bonusMaxHp: 5, dryFights: 2, revived: true });
  hero.missedScrolls.push('LEECH');
  hero.alloc.ATK = 4;
  return hero;
}

const liveMap = (stages) => stages.map((stage, s) => stage.map((node, slot) => {
  const base = { type: node.type, stage: s, slot, links: node.links, cleared: false, enemyId: node.enemyId };
  return node.affixes ? { ...base, affixes: node.affixes } : base;
}));

function liveRun(sim, depth) {
  const source = sim.createSeededRng(depth * 101);
  const n = (depth - 1) * 4 + 1;
  const depthPlan = sim.planDepth(depth, source.next);
  const plan = sim.planOf(depthPlan, n);
  const hero = richHero(sim, depth, source.next);
  const stages = liveMap(sim.generateMap(source.next, { stageSizes: plan.stageSizes, weights: plan.weights }, plan));
  stages[0][0].cleared = true;
  const run = { n, clears: 9, bosses: depth - 1, descentClears: depth > 1 ? 24 : null, score: 1234, banked: depth > 1 ? 900 : 0, won: depth > 1 };
  const map = { stages, curStage: 0, reachable: stages[0][0].links, cursor: stages[0][0].links[0] };
  const snapshot = { hero, run, depthPlan, map, step: { at: 'ROOM', stage: 1, slot: 0 }, rng: source.getState() };
  return { snapshot, source, plan };
}

const draws = (next, count) => Array.from({ length: count }, () => next());

function roundTrip(sim) {
  for (const depth of [1, 2]) {
    const { snapshot, source, plan } = liveRun(sim, depth);
    const text = sim.saveRun(snapshot);
    const back = sim.fromSaved(sim.loadRun(text));
    assert.deepEqual(back, snapshot, `depth ${depth}: the restored run differs`);
    const resumed = sim.createSeededRng(0);
    resumed.setState(back.rng);
    assert.deepEqual(draws(resumed.next, 200), draws(source.next, 200), `depth ${depth}: the rng stream moved`);
    const ref = { n: back.run.n, plan };
    assert.deepEqual(sim.rollLoot('ELITE', ref, back.hero, resumed.next), sim.rollLoot('ELITE', ref, snapshot.hero, source.next), `depth ${depth}: loot differs`);
    const shape = { stageSizes: plan.stageSizes, weights: plan.weights };
    assert.deepEqual(sim.generateMap(resumed.next, shape, plan), sim.generateMap(source.next, shape, plan), `depth ${depth}: next map differs`);
    assert.deepEqual(JSON.parse(sim.saveRun(back)), JSON.parse(text), `depth ${depth}: saving the restored run changes the save`);
  }
  return 'depth 1 and 2: rich hero, map, plan and step round-trip; next 200 draws, rollLoot and generateMap identical';
}

const SAMPLE_MUTATIONS = 600;

function corrupt(text, edit) {
  const data = JSON.parse(text);
  edit(data);
  return JSON.stringify(data);
}

function rejections(sim) {
  const text = sim.saveRun(liveRun(sim, 2).snapshot);
  const bad = {
    empty: '',
    'non-JSON': '{"version":1,',
    'JSON null': 'null',
    'wrong version': corrupt(text, (d) => { d.version = 0; }),
    'unknown worn item': corrupt(text, (d) => { d.hero.equipment.WEAPON = 'NO_SUCH_BLADE'; }),
    'unknown packed item': corrupt(text, (d) => { d.hero.pack[0].id = 'NO_SUCH_WAND'; }),
    'item in the wrong slot': corrupt(text, (d) => { d.hero.equipment.ARMOR = 'IRON_SWORD'; }),
    'unknown pact': corrupt(text, (d) => { d.hero.pacts.push('GREED'); }),
    'unknown enemy': corrupt(text, (d) => { d.depthPlan[0].boss = 'NOBODY'; }),
    'unknown spell': corrupt(text, (d) => { d.hero.baseSpells.push('NOVA'); }),
    'truncated map': corrupt(text, (d) => { d.map.stages.pop(); }),
    'step outside the map': corrupt(text, (d) => { d.step.slot = 7; }),
    'huge number': text.replace(/"score":\d+/, '"score":1e400'),
    'NaN as null': corrupt(text, (d) => { d.hero.hp = null; }),
    'NaN literal': text.replace(/"hp":[\d.]+/, '"hp":NaN'),
    'level past max': corrupt(text, (d) => { d.hero.pack[0].level = 9; }),
    'three acts': corrupt(text, (d) => { d.depthPlan.pop(); }),
  };
  for (const [what, raw] of Object.entries(bad)) {
    assert.equal(sim.loadRun(raw), null, `${what}: accepted`);
  }
  return `${Object.keys(bad).length} corrupt saves rejected with null`;
}

function leaves(value, path = []) {
  if (typeof value !== 'object' || value === null) {return [path];}
  return [path, ...Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]))];
}

const ODD = [null, -1, 1e308, 'X', true, [], {}, 0.5, undefined];

function fuzz(sim) {
  const text = sim.saveRun(liveRun(sim, 2).snapshot);
  const paths = leaves(JSON.parse(text)).filter((p) => p.length > 0);
  const rng = sim.createSeededRng(5).next;
  for (let i = 0; i < SAMPLE_MUTATIONS; i++) {
    const data = JSON.parse(text);
    const path = paths[Math.floor(rng() * paths.length)];
    const parent = path.slice(0, -1).reduce((o, k) => o[k], data);
    parent[path.at(-1)] = ODD[Math.floor(rng() * ODD.length)];
    assert.doesNotThrow(() => sim.loadRun(JSON.stringify(data)), `mutating ${path.join('.')} threw`);
  }
  return `${SAMPLE_MUTATIONS} random field mutations: loadRun never throws`;
}

export function saveRules(sim) {
  return [roundTrip(sim), rejections(sim), fuzz(sim)].join('; ');
}
