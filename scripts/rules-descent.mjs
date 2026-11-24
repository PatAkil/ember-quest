import assert from 'node:assert/strict';

const SCALE = { n: 0, clears: 0, descentClears: null };
const STORY_RUNS = 20;
const DESCENT_RUNS = 300;
const DESCENT_POLICIES = ['balanced', 'glass', 'tank'];

function counting() {
  let draws = 0;
  return { next: () => { draws++; return 0.5; }, draws: () => draws };
}

function multRules(sim) {
  sim.ACT_MULT.forEach((m, n) => { assert.equal(sim.actMult(n), m, `actMult(${n}) differs from ACT_MULT`); });
  for (let n = 1; n <= 40; n++) {assert.ok(sim.actMult(n) > sim.actMult(n - 1), `actMult not rising at n=${n}`);}
  assert.ok(Math.abs(sim.actMult(4) - sim.ACT_MULT[3] * sim.DESCENT_GROWTH) < 1e-9, 'actMult(4) is not ACT_MULT[3] x DESCENT_GROWTH');
  return 'actMult equals ACT_MULT for n <= 3 and rises through n = 40';
}

function storyRules(sim) {
  const rng = counting();
  const plan = sim.planDepth(1, rng.next);
  assert.equal(rng.draws(), 0, 'planDepth(1) drew from the rng');
  assert.deepEqual(plan, sim.storyPlan(), 'planDepth(1) is not the story');
  assert.equal(plan.length, sim.BIOMES.length, 'depth 1 must have one act per biome');
  plan.forEach((p, i) => {
    const b = sim.BIOMES[i];
    assert.equal(p.biomeIndex, i, `act ${i}: biomeIndex`);
    assert.deepEqual([p.normals, p.elites, p.boss, p.scroll], [b.normals, b.elites, b.boss, b.scroll], `act ${i}: foes or scroll differ from the biome`);
    assert.deepEqual([p.stageSizes, p.weights], [[...sim.MAP_SHAPE.stageSizes], sim.MAP_SHAPE.weights], `act ${i}: map shape differs`);
    assert.deepEqual(p.affixCount, { normal: 0, elite: 0 }, `act ${i}: story foes carry affixes`);
  });
  assert.equal(sim.planDepth(2, counting().next).length, 4, 'a descent depth has four acts');
  return 'planDepth(1) is the four story acts and draws no rng';
}

function counterRules(sim) {
  const cases = [[0, 1, 0], [3, 1, 3], [4, 2, 0], [7, 2, 3], [8, 3, 0], [41, 11, 1]];
  for (const [n, depth, act] of cases) {
    assert.equal(sim.depthOf(n), depth, `depthOf(${n})`);
    assert.equal(sim.actInDepth(n), act, `actInDepth(${n})`);
    assert.equal(sim.isLastActOfDepth(n), act === 3, `isLastActOfDepth(${n})`);
  }
  assert.equal(sim.firstActOf(3), 8, 'firstActOf(3)');
  assert.deepEqual(sim.affixCountFor(2), { normal: 0, elite: 1 }, 'affixes at depth 2');
  assert.deepEqual(sim.affixCountFor(9), { normal: sim.AFFIX_MAX, elite: sim.AFFIX_MAX }, 'affixes cap at AFFIX_MAX');
  assert.ok(sim.AFFIX_MAX <= sim.AFFIX_IDS.length, 'more affixes per foe than exist');
  return 'depthOf / actInDepth / firstActOf / affix counts';
}

function scoreRules(sim) {
  assert.equal(sim.scoreOf({ clears: 7, bosses: 2 }), 1700, 'scoreOf');
  assert.equal(sim.gloryBonus(3), 3000, 'gloryBonus');
  assert.equal(sim.scoreAfterDeath({ score: 5001, banked: 3000, won: true }), 4000, 'half of the unbanked score, floored');
  assert.equal(sim.scoreAfterDeath({ score: 5000, banked: 0, won: false }), 5000, 'a story death keeps the whole score');
  return 'scoreOf, gloryBonus, scoreAfterDeath';
}

function pactRules(sim) {
  assert.deepEqual(sim.validatePacts(), [], 'validatePacts');
  const hero = sim.createHero();
  assert.deepEqual(sim.pactMods(hero), sim.neutralMods(), 'no pacts must fold to neutral');
  assert.ok(Object.values(sim.neutralMods()).every((v) => v === 0 || v === 1), 'neutral values are 0 or 1');
  sim.takePact(hero, 'BRITTLE');
  sim.takePact(hero, 'IRON');
  const mods = sim.pactMods(hero);
  assert.ok(Math.abs(mods.maxHpMult - 0.92) < 1e-9, 'maxHpMult multiplies');
  assert.equal(mods.spPerBoss, 1, 'spPerBoss adds');
  const rng = sim.createSeededRng(3).next;
  const offers = sim.offerPacts(hero, rng);
  assert.equal(offers.length, 3, 'three pacts offered');
  assert.equal(new Set(offers).size, 3, 'offers repeat');
  assert.ok(offers.every((id) => !hero.pacts.includes(id)), 'a taken pact was offered');
  for (const id of ['TITHE', 'HEX', 'MISER', 'STORM', 'ASH']) {sim.takePact(hero, id);}
  assert.deepEqual(sim.offerPacts(hero, rng), ['HUNTER'], 'the last pact alone');
  sim.takePact(hero, 'HUNTER');
  assert.deepEqual(sim.offerPacts(hero, rng), [], 'none left, none offered');
  return 'validatePacts clean; pactMods neutral without pacts and folds; offers distinct and untaken';
}

function foeRules(sim) {
  const plain = sim.spawnEnemy('SKELETON', SCALE);
  const tough = sim.spawnEnemy('SKELETON', SCALE, ['ARMORED', 'WARDED']);
  assert.deepEqual([tough.resPhys - plain.resPhys, tough.resMagic - plain.resMagic], [20, 20], 'ARMORED / WARDED');
  assert.deepEqual(tough.affixes, ['ARMORED', 'WARDED'], 'affixes stored');
  const frozen = sim.spawnEnemy('YETI', { n: 5, clears: 40, descentClears: 24 });
  const live = sim.spawnEnemy('YETI', { n: 5, clears: 24, descentClears: null });
  assert.deepEqual([frozen.maxHp, frozen.atk], [live.maxHp, live.atk], 'descentClears freezes the clears term');
  const hero = sim.createHero();
  const hollow = sim.spawnFoe('HOLLOW', { n: 7, clears: 0, descentClears: null, hero });
  assert.equal(hollow.def.kind, 'BOSS', 'THE HOLLOW is a boss');
  assert.ok(hollow.maxHp >= sim.HOLLOW_HP_FLOOR * sim.derive(hero).maxHp && hollow.atk > 0, 'THE HOLLOW is sane');
  return 'affix resists, frozen clears term, THE HOLLOW spawns';
}

function checkDescent(sim, deep) {
  assert.ok(deep.actReached < sim.SIM_MAX_N, 'a descending run passed the cap');
  assert.notEqual(deep.deathKind, 'STALL', `a descending run stalled at n=${deep.actReached}`);
  if (deep.won) {assert.equal(deep.actReached, sim.SIM_MAX_N - 1, 'a descending run stopped without dying or reaching the cap');}
  assert.ok((deep.pacts ?? []).length <= Math.max(0, sim.depthOf(deep.actReached) - 1), 'more pacts than depths entered');
}

function runRules(sim) {
  const rng = sim.createSeededRng(9).next;
  for (let i = 0; i < STORY_RUNS; i++) {
    const story = sim.simulateRun(sim.POLICIES.balanced, rng);
    assert.ok(story.actReached <= 3, 'a story run went past act 4');
  }
  let deepest = 0;
  for (let i = 0; i < DESCENT_RUNS; i++) {
    const deep = sim.simulateRun(sim.POLICIES[DESCENT_POLICIES[i % DESCENT_POLICIES.length]], rng, { descend: true });
    checkDescent(sim, deep);
    deepest = Math.max(deepest, deep.actReached);
  }
  return `${STORY_RUNS} story runs end by act 4; ${DESCENT_RUNS} descending runs die or reach n = ${sim.SIM_MAX_N}, no STALL (deepest n = ${deepest})`;
}

export function descentRules(sim) {
  return [multRules, storyRules, counterRules, scoreRules, pactRules, foeRules, runRules].map((rule) => rule(sim)).join(' | ');
}

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
