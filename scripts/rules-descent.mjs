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
