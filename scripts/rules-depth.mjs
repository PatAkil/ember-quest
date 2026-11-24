import assert from 'node:assert/strict';

const SEEDS = 60;
const DEPTHS = [2, 3, 4, 6, 10];
const RARITY_ROWS = 4;

const sorted = (xs) => [...xs].sort();
const sum = (row) => row.reduce((a, b) => a + b, 0);

function checkPool(sim, plan, pool) {
  const home = sim.BIOMES[plan.biomeIndex][pool];
  assert.deepEqual(plan[pool].slice(0, home.length), home, `${pool}: home foes first`);
  const extra = plan[pool].slice(home.length);
  assert.equal(extra.length, 1, `${pool}: exactly one invader`);
  const [invader] = extra;
  assert.ok(!home.includes(invader), `${pool}: invader ${invader} is a home foe`);
  const from = sim.BIOMES.findIndex((b, i) => i !== plan.biomeIndex && b[pool].includes(invader));
  assert.ok(from >= 0, `${pool}: invader ${invader} is from no other biome's ${pool}`);
}

function checkStages(sim, plan, depth) {
  const want = Math.min(sim.DESCENT_STAGE_MAX, sim.MAP_SHAPE.stageSizes.length + depth - 1);
  assert.equal(plan.stageSizes.length, want, `depth ${depth}: stage count`);
  plan.stageSizes.forEach((size, i) => { assert.equal(size, i % 2 === 0 ? 2 : 3, `depth ${depth}: stage ${i} size`); });
  assert.equal(sum(Object.values(plan.weights)), sum(Object.values(sim.MAP_SHAPE.weights)), `depth ${depth}: weights total moved`);
  assert.equal(plan.weights.ELITE - sim.MAP_SHAPE.weights.ELITE, sim.MAP_SHAPE.weights.FIGHT - plan.weights.FIGHT, `depth ${depth}: ELITE gain not taken from FIGHT`);
  assert.ok(plan.weights.FIGHT >= 20 && plan.weights.ELITE >= sim.MAP_SHAPE.weights.ELITE, `depth ${depth}: weights out of range`);
}

function checkAct(sim, plan, { depth, last }) {
  checkPool(sim, plan, 'normals');
  checkPool(sim, plan, 'elites');
  checkStages(sim, plan, depth);
  const biome = sim.BIOMES[plan.biomeIndex];
  assert.equal(plan.boss, last ? 'HOLLOW' : biome.boss, `depth ${depth}: boss`);
  assert.equal(plan.phaseAt, sim.DESCENT_PHASE_AT, `depth ${depth}: phaseAt`);
  assert.equal(plan.scroll, undefined, `depth ${depth}: a descent act offers a scroll`);
  assert.deepEqual(plan.affixCount, sim.affixCountFor(depth), `depth ${depth}: affix counts`);
  assert.deepEqual(sorted(plan.affixOrder), sorted(sim.AFFIX_IDS), `depth ${depth}: affixOrder is not a permutation`);
}

function planShape(sim) {
  let shuffledOrders = 0;
  for (const depth of DEPTHS) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const plans = sim.planDepth(depth, sim.createSeededRng(seed).next);
      assert.equal(plans.length, 4, 'four acts per depth');
      assert.deepEqual(sorted(plans.map((p) => p.biomeIndex)), [0, 1, 2, 3], 'biome order is not a permutation');
      if (plans.some((p, i) => p.biomeIndex !== i)) {shuffledOrders++;}
      plans.forEach((plan, i) => { checkAct(sim, plan, { depth, last: i === 3 }); });
      assert.deepEqual(sim.planDepth(depth, sim.createSeededRng(seed).next), plans, 'planDepth is not deterministic per seed');
    }
  }
  assert.ok(shuffledOrders > DEPTHS.length * SEEDS * 0.8, 'biome order is rarely reshuffled');
  return `${DEPTHS.length * SEEDS} descent plans: biome permutation, one foreign invader per pool, +1 stage per depth (max ${sim.DESCENT_STAGE_MAX}), ELITE +5 from FIGHT, phaseAt ${sim.DESCENT_PHASE_AT}, no scroll, HOLLOW last, seeded`;
}

function checkNodeAffixes(node, counts) {
  const want = node.type === 'FIGHT' ? counts.normal : node.type === 'ELITE' ? counts.elite : 0;
  const affixes = node.affixes ?? [];
  assert.equal(affixes.length, want, `${node.type} node carries ${affixes.length} affixes, want ${want}`);
  assert.equal(new Set(affixes).size, affixes.length, 'an affix repeats on one node');
}

function descentMaps(sim) {
  let affixed = 0;
  for (const depth of [1, 2, 3, 4, 5]) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const rng = sim.createSeededRng(seed).next;
      const plan = sim.planDepth(depth, rng)[seed % 4];
      const stages = sim.generateMap(rng, { stageSizes: plan.stageSizes, weights: plan.weights }, plan);
      assert.equal(stages.length, plan.stageSizes.length + 1, 'stage count');
      assert.equal(stages.at(-1)[0].type, 'BOSS', 'last stage is the boss');
      for (const node of stages.flat()) {
        checkNodeAffixes(node, plan.affixCount);
        affixed += node.affixes ? 1 : 0;
      }
    }
  }
  assert.ok(affixed > 0, 'no node rolled an affix');
  return `${5 * SEEDS} maps across depths 1-5: FIGHT nodes carry the normal count, ELITE nodes the elite count, no repeats, none at depth 1`;
}

function weightRows(sim) {
  for (const source of ['FIGHT', 'ELITE', 'LOOT', 'BOSS']) {
    assert.deepEqual(sim.lootWeights(source, 3), sim.LOOT_WEIGHTS[source][3], `${source}: act-4 row moved`);
    let last = -1;
    for (let n = 4; n < 60; n++) {
      const row = sim.lootWeights(source, n);
      assert.equal(row.length, RARITY_ROWS, `${source} n=${n}: row length`);
      assert.ok(row.every((w) => w >= 0), `${source} n=${n}: negative weight ${row}`);
      assert.equal(sum(row), 100, `${source} n=${n}: weights sum to ${sum(row)}`);
      assert.ok(row[3] <= Math.max(sim.DESCENT_LEGENDARY_CAP, sim.LOOT_WEIGHTS[source][3][3]), `${source} n=${n}: LEGENDARY over the cap`);
      assert.ok(row[3] >= last, `${source} n=${n}: LEGENDARY fell`);
      last = row[3];
      if (source === 'BOSS') {assert.equal(row[0] + row[1], 0, `BOSS n=${n}: COMMON or RARE weight in the descent`);}
    }
  }
  assert.deepEqual(sim.descentRow([40, 40, 17, 3], 2), [37, 40, 17, 6], 'depth 2 takes 3 from COMMON');
  assert.deepEqual(sim.descentRow([2, 40, 50, 8], 3), [0, 36, 50, 14], 'COMMON then RARE');
  return 'descent loot rows: act-4 row +3 LEGENDARY per depth from COMMON then RARE, never negative, sum 100, cap 30; BOSS rows EPIC+';
}

function armed(sim) {
  const hero = sim.createHero();
  sim.equip(hero, sim.ITEMS.find((i) => i.id === 'RUSTY_SWORD') ?? sim.ITEMS.find((i) => i.slot === 'WEAPON'));
  return hero;
}

function bossTables(sim) {
  const rng = sim.createSeededRng(11).next;
  const plans = sim.planDepth(2, rng);
  let signatures = 0;
  for (let i = 0; i < 300; i++) {
    const offers = sim.rollLoot('BOSS', { n: 4 + (i % 4), plan: plans[i % 4] }, armed(sim), rng);
    assert.equal(offers.length, 3, 'three rolled boss offers');
    for (const o of offers) {
      assert.equal(o.kind, 'ITEM', 'a descent boss offered a non-item without a missed scroll');
      assert.ok(o.item.rarity === 'EPIC' || o.item.rarity === 'LEGENDARY', `descent boss offered ${o.item.rarity}`);
      if (o.item.bossOnly) {signatures++;}
    }
  }
  assert.ok(signatures > 0, 'signature items never re-enter the descent boss roll');
  const hero = armed(sim);
  hero.missedScrolls.push('THUNDER');
  const offers = sim.rollLoot('BOSS', { n: 5, plan: plans[1] }, hero, rng);
  assert.deepEqual(offers[0], { kind: 'SCROLL', spell: 'THUNDER' }, 'a missed scroll leads the descent boss table');
  return `300 descent boss tables: three EPIC+ items, ${signatures} signature re-rolls, only missed scrolls`;
}

export function depthRules(sim) {
  return [planShape, descentMaps, weightRows, bossTables].map((rule) => rule(sim)).join(' | ');
}
