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

const battleFixture = () => ({
  roomSeed: 3141592653,
  foe: {
    id: 'GOBLIN', hp: 31, maxHp: 44, atk: 6, resPhys: 20, resMagic: 0, affixes: ['THORNED'], burn: { perTurn: 3, turns: 2 },
    wardTurns: 1, phase: 1, cycleIndex: -1, mended: false, staggered: true,
  },
  state: { rampStacks: 2, lastScope: 'SPELL', actionsTaken: 4, intent: 'HEAVY', guarding: false, guardChain: 1, riposte: true, aegis: 0, calm: 7, foeMark: 31, turn: 5 },
});

export function liveRun(sim, depth) {
  const source = sim.createSeededRng(depth * 101);
  const n = (depth - 1) * 4 + 1;
  const depthPlan = sim.planDepth(depth, source.next);
  const plan = sim.planOf(depthPlan, n);
  const hero = richHero(sim, depth, source.next);
  const stages = liveMap(sim.generateMap(source.next, { stageSizes: plan.stageSizes, weights: plan.weights }, plan));
  stages[0][0].cleared = true;
  const run = { n, clears: 9, bosses: depth - 1, descentClears: depth > 1 ? 24 : null, score: sim.scoreOf({ clears: 9, bosses: depth - 1 }), banked: depth > 1 ? 900 : 0, won: depth > 1 };
  const map = { stages, curStage: 0, reachable: stages[0][0].links, cursor: stages[0][0].links[0] };
  const snapshot = { hero, run, depthPlan, map, step: { at: 'ROOM', stage: 1, slot: 0, roomSeed: 3141592653, battle: battleFixture() }, rng: source.getState() };
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

function stepRoundTrip(sim, what, edit) {
  const { snapshot } = liveRun(sim, 2);
  edit(snapshot);
  const loaded = sim.loadRun(sim.saveRun(snapshot));
  assert.ok(loaded, `${what}: rejected`);
  assert.deepEqual(sim.fromSaved(loaded), snapshot, `${what}: the restored run differs`);
  return loaded;
}

function stepRules(sim) {
  const spot = { stage: 1, slot: 0, roomSeed: 99 };
  const reward = stepRoundTrip(sim, 'REWARD', (s) => { s.step = { at: 'REWARD', ...spot, source: 'ELITE', earned: 3 }; });
  assert.equal(reward.step.earned, 3, 'REWARD lost the earned SP');
  stepRoundTrip(sim, 'REWARD gift', (s) => { s.step = { at: 'REWARD', ...spot, source: 'EVENT', earned: 0, gift: 'EPIC' }; });
  for (const eventId of [sim.QUIET_EVENT.id, sim.EVENTS[0].id]) {
    stepRoundTrip(sim, `event ${eventId}`, (s) => { s.step = { at: 'ROOM', ...spot, eventId }; });
    assert.equal(sim.eventById(eventId)?.id, eventId, `eventById(${eventId})`);
  }
  stepRoundTrip(sim, 'THRESHOLD', (s) => { s.run.n = 7; s.step = { at: 'THRESHOLD' }; });
  stepRoundTrip(sim, 'PACT', (s) => {
    s.run.n = 4;
    s.step = { at: 'PACT', offers: Object.keys(sim.PACTS).filter((id) => !s.hero.pacts.includes(id)).slice(0, 3) };
  });
  const battle = stepRoundTrip(sim, 'battle', () => undefined).step.battle.state;
  assert.deepEqual([battle.calm, battle.foeMark, battle.turn], [7, 31, 5], 'calm / foeMark / turn did not survive the save');
  const noEarned = corrupt(sim.saveRun(liveRun(sim, 2).snapshot), (d) => { d.step = { at: 'REWARD', ...spot, source: 'FIGHT' }; });
  assert.equal(sim.loadRun(noEarned), null, 'a REWARD without earned SP was accepted');
  const noCalm = corrupt(sim.saveRun(liveRun(sim, 2).snapshot), (d) => { delete d.step.battle.state.calm; });
  assert.equal(sim.loadRun(noCalm), null, 'a battle without calm was accepted');
  return `version ${String(sim.SAVE_VERSION)}: REWARD (earned SP, gift), QUIET and drawn eventIds, THRESHOLD and PACT steps round-trip; calm/foeMark/turn saved and required`;
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
    'cursor off reachable': corrupt(text, (d) => { d.map.cursor = [0, 1, 2].find((i) => !d.map.reachable.includes(i)); }),
    'n past the cap': corrupt(text, (d) => { d.run.n = sim.SIM_MAX_N + 1; }),
    'dead hero': corrupt(text, (d) => { d.hero.hp = 0; }),
    'item owned twice': corrupt(text, (d) => { d.hero.pack.push({ id: d.hero.equipment.WEAPON, level: 0 }); }),
    'pack over size': corrupt(text, (d) => { d.hero.pack.push({ id: 'OAK_STAFF', level: 0 }, { id: 'GLASS_SABER', level: 0 }, { id: 'SURF_SPEAR', level: 0 }); }),
    'room step at a cleared room': corrupt(text, (d) => { d.map.stages[d.step.stage][d.step.slot].cleared = true; }),
    'room step out of reach': corrupt(text, (d) => { d.step.stage = 2; }),
    'empty foe pool': corrupt(text, (d) => { d.depthPlan[1].normals = []; }),
    'banked past the score': corrupt(text, (d) => { d.run.banked = 1e9; }),
    'threshold mid-depth': corrupt(text, (d) => { d.step = { at: 'THRESHOLD' }; }),
    'pact mid-depth': corrupt(text, (d) => { d.step = { at: 'PACT', offers: ['ASH'] }; }),
    'pact already sworn': corrupt(text, (d) => { d.run.n = 4; d.step = { at: 'PACT', offers: [d.hero.pacts[0]] }; }),
  };
  for (const [what, raw] of Object.entries(bad)) {
    assert.equal(sim.loadRun(raw), null, `${what}: accepted`);
  }
  return `${Object.keys(bad).length} corrupt saves rejected with null; ${repairs(sim, text)}`;
}

function repairs(sim, text) {
  const rich = corrupt(text, (d) => { d.hero.hp = 1e5; d.hero.mp = 1e5; d.run.score = 99999; });
  const back = sim.fromSaved(sim.loadRun(rich));
  const d = sim.derive(back.hero);
  assert.deepEqual([back.hero.hp, back.hero.mp], [d.maxHp, d.maxMp], 'HP/MP over the max were not clamped');
  assert.equal(back.run.score, sim.scoreOf(back.run), 'the score was trusted instead of recomputed');
  return 'HP/MP over max clamped; score recomputed from clears and bosses';
}

function sane(sim, saved, what) {
  const live = sim.fromSaved(saved);
  const d = sim.derive(live.hero);
  assert.ok(Number.isFinite(d.maxHp) && live.hero.hp > 0 && live.hero.hp <= d.maxHp, `${what}: HP ${live.hero.hp} of ${d.maxHp}`);
  assert.ok(live.hero.mp >= 0 && live.hero.mp <= d.maxMp, `${what}: MP ${live.hero.mp} of ${d.maxMp}`);
  assert.ok(live.map.reachable.includes(live.map.cursor), `${what}: cursor off the reachable rooms`);
  assert.ok(live.run.n <= sim.SIM_MAX_N && live.run.score === sim.scoreOf(live.run), `${what}: counters`);
  const ids = [...Object.values(live.hero.equipment).map((i) => i.id), ...live.hero.pack.map((o) => o.item.id)];
  assert.equal(new Set(ids).size, ids.length, `${what}: an item owned twice`);
  assert.ok(live.depthPlan.every((p) => p.normals.length > 0 && p.elites.length > 0), `${what}: an empty pool`);
  assert.doesNotThrow(() => sim.saveRun(live), `${what}: the accepted save cannot be saved again`);
}

function leaves(value, path = []) {
  if (typeof value !== 'object' || value === null) {return [path];}
  return [path, ...Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]))];
}

const ODD = [null, -1, 1e308, 'X', true, [], {}, 0.5, undefined];

function loadQuietly(sim, raw, path) {
  try {
    return sim.loadRun(raw);
  } catch (error) {
    assert.fail(`mutating ${path.join('.')} threw: ${String(error)}`);
  }
}

function fuzz(sim) {
  const text = sim.saveRun(liveRun(sim, 2).snapshot);
  const paths = leaves(JSON.parse(text)).filter((p) => p.length > 0);
  const rng = sim.createSeededRng(5).next;
  let accepted = 0;
  for (let i = 0; i < SAMPLE_MUTATIONS; i++) {
    const data = JSON.parse(text);
    const path = paths[Math.floor(rng() * paths.length)];
    const parent = path.slice(0, -1).reduce((o, k) => o[k], data);
    parent[path.at(-1)] = ODD[Math.floor(rng() * ODD.length)];
    const saved = loadQuietly(sim, JSON.stringify(data), path);
    if (saved) {
      accepted += 1;
      sane(sim, saved, `mutating ${path.join('.')}`);
    }
  }
  assert.ok(accepted > 0, 'no mutation was accepted, so the sanity checks never ran');
  return `${SAMPLE_MUTATIONS} random field mutations: loadRun never throws; ${accepted} accepted ones restore and pass the sanity checks`;
}

export function saveRules(sim) {
  return [roundTrip(sim), stepRules(sim), rejections(sim), fuzz(sim)].join('; ');
}
