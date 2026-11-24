import assert from 'node:assert/strict';

const fixed = (v) => () => v;
const SCALE = { n: 4, clears: 0, descentClears: 0 };

function pacted(sim, ids) {
  const hero = sim.createHero();
  hero.alloc.ATK = 30;
  hero.alloc.MAG = 30;
  for (const id of ids) {sim.takePact(hero, id);}
  hero.hp = sim.derive(hero).maxHp;
  hero.mp = sim.derive(hero).maxMp;
  return hero;
}

const dealt = (r) => r.hits.reduce((a, h) => a + h.dmg, 0);

function hitWith(sim, ids, action) {
  const hero = pacted(sim, ids);
  hero.ember = 100;
  return dealt(sim.heroAct(hero, sim.createBattle(sim.spawnEnemy('OGRE_KING', SCALE)), action, fixed(0.5)));
}

const near = (got, want, what) => { assert.ok(Math.abs(got - want) <= 1, `${what}: ${got} vs ${want}`); };

function maxHpMods(sim) {
  const plain = sim.derive(sim.createHero()).maxHp;
  near(sim.derive(pacted(sim, ['BRITTLE'])).maxHp, plain * 0.8, 'BRITTLE max HP');
  near(sim.derive(pacted(sim, ['IRON'])).maxHp, plain * 1.15, 'IRON max HP');
  return ['maxHpMult'];
}

function damageMods(sim) {
  const attack = hitWith(sim, [], 'ATTACK');
  near(hitWith(sim, ['BRITTLE'], 'ATTACK'), attack * 1.25, 'BRITTLE ATTACK');
  near(hitWith(sim, ['STORM'], 'ATTACK'), attack * 0.85, 'STORM ATTACK');
  near(hitWith(sim, ['STORM'], 'FIREBALL'), hitWith(sim, [], 'FIREBALL'), 'STORM touched a spell');
  near(hitWith(sim, ['BRITTLE'], 'BURST'), hitWith(sim, [], 'BURST') * 1.25, 'BRITTLE BURST');
  const stormy = pacted(sim, ['STORM']);
  sim.heroAct(stormy, sim.createBattle(sim.spawnEnemy('OGRE_KING', SCALE)), 'ATTACK', fixed(0.5));
  assert.equal(stormy.ember, 9, 'STORM: ember x1.5 per action');
  return ['dmgMult', 'attackMult', 'burstGainMult'];
}

function clearOf(sim, ids, kind) {
  const hero = pacted(sim, ids);
  hero.hp = 1;
  const got = sim.grantClear(hero, kind);
  return { sp: got.sp, hp: got.hp, maxHp: sim.derive(hero).maxHp };
}

function clearMods(sim) {
  const base = clearOf(sim, [], 'NORMAL');
  const tithe = clearOf(sim, ['TITHE'], 'NORMAL');
  assert.equal(tithe.sp, base.sp + 1, 'TITHE +1 SP per clear');
  assert.equal(tithe.hp, Math.round(tithe.maxHp * 0.1), 'TITHE clear heal 10 %');
  assert.equal(clearOf(sim, ['IRON'], 'BOSS').sp, clearOf(sim, [], 'BOSS').sp + 1, 'IRON +1 SP per boss');
  assert.equal(clearOf(sim, ['IRON'], 'ELITE').sp, clearOf(sim, [], 'ELITE').sp, 'IRON SP on an elite');
  assert.equal(clearOf(sim, ['HUNTER'], 'ELITE').sp, clearOf(sim, [], 'ELITE').sp + 2, 'HUNTER +2 SP per elite');
  assert.equal(clearOf(sim, ['HUNTER'], 'NORMAL').sp, base.sp, 'HUNTER SP on a normal');
  return ['clearHealMult', 'spPerClear', 'spPerBoss', 'eliteSp'];
}

function foeMods(sim) {
  const plain = sim.spawnFoe('MUMMY', { ...SCALE, hero: pacted(sim, []) });
  const iron = sim.spawnFoe('MUMMY', { ...SCALE, hero: pacted(sim, ['IRON']) });
  near(iron.atk, plain.atk * 1.15, 'IRON foe ATK');
  const hunted = sim.spawnFoe('MUMMY', { ...SCALE, hero: pacted(sim, ['HUNTER']) });
  near(hunted.maxHp, plain.maxHp * 1.3, 'HUNTER elite HP');
  const normal = sim.spawnFoe('SLIME', { ...SCALE, hero: pacted(sim, ['HUNTER']) });
  assert.equal(normal.maxHp, sim.spawnFoe('SLIME', { ...SCALE, hero: pacted(sim, []) }).maxHp, 'HUNTER touched a normal');
  const hexed = sim.spawnFoe('MUMMY', { ...SCALE, hero: pacted(sim, ['HEX']) });
  assert.equal(hexed.affixes.length, plain.affixes.length + 1, 'HEX +1 affix');
  return ['foeAtkMult', 'eliteHpMult', 'foeAffix'];
}

const RANK = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 };

function armedPact(sim, ids) {
  const hero = pacted(sim, ids);
  sim.equip(hero, sim.ITEMS.find((i) => i.id === 'RUSTY_SWORD') ?? sim.ITEMS.find((i) => i.slot === 'WEAPON'));
  return hero;
}

function meanRarity(sim, ids, source) {
  const rng = sim.createSeededRng(4).next;
  const plan = sim.planDepth(2, rng)[0];
  let total = 0;
  let count = 0;
  for (let i = 0; i < 200; i++) {
    for (const o of sim.rollLoot(source, { n: 4, plan }, armedPact(sim, ids), rng)) {
      if (o.kind === 'ITEM') { total += RANK[o.item.rarity]; count++; }
    }
  }
  return total / Math.max(1, count);
}

function lootMods(sim) {
  assert.ok(meanRarity(sim, ['HEX'], 'ELITE') > meanRarity(sim, [], 'ELITE') + 0.5, 'HEX: elite loot not a rarity higher');
  assert.equal(meanRarity(sim, ['HEX'], 'BOSS'), RANK.LEGENDARY, 'HEX: descent boss loot not all LEGENDARY');
  near(meanRarity(sim, ['HEX'], 'LOOT') * 100, meanRarity(sim, [], 'LOOT') * 100, 'HEX shifted a chest');
  const miser = pacted(sim, ['MISER']);
  const rng = sim.createSeededRng(8).next;
  const plan = sim.planDepth(1, rng)[0];
  for (let i = 0; i < 50; i++) {assert.deepEqual(sim.rollLoot('FIGHT', { n: 0, plan }, miser, rng), [], 'MISER: a FIGHT dropped');}
  assert.equal(miser.dryFights, 0, 'MISER: pity counter moved');
  const count = (ids, source) => sim.rollLoot(source, { n: 1, plan }, pacted(sim, ids), sim.createSeededRng(2).next).length;
  assert.equal(count(['MISER'], 'LOOT'), count([], 'LOOT') + 1, 'MISER +1 chest card');
  assert.equal(count(['MISER'], 'ELITE'), count([], 'ELITE') + 1, 'MISER +1 elite card');
  assert.equal(count(['HUNTER'], 'ELITE'), count([], 'ELITE') + 1, 'HUNTER 4th elite card');
  assert.equal(count(['HUNTER'], 'LOOT'), count([], 'LOOT'), 'HUNTER touched a chest');
  assert.equal(count(['MISER', 'HUNTER'], 'ELITE'), 4, 'offers cap at 4');
  return ['rarityShift', 'fightDrops', 'extraCard', 'eliteExtraCard'];
}

function restMods(sim) {
  const plain = pacted(sim, []);
  plain.hp = 1;
  plain.potions = 0;
  assert.deepEqual([sim.restHero(plain).upgrade, plain.hp, plain.potions], [false, sim.derive(plain).maxHp, 2], 'REST without pacts');
  const ash = pacted(sim, ['ASH']);
  ash.hp = 1;
  const bare = sim.restHero(ash);
  const max = sim.derive(ash).maxHp;
  assert.equal(bare.upgrade, false, 'ASH offered an upgrade with nothing to upgrade');
  assert.equal(ash.hp, 1 + Math.round(max * 0.5) + Math.round(max * sim.REST_MEND), 'ASH: 50 % rest + 25 % mend');
  const armed = pacted(sim, ['ASH']);
  sim.equip(armed, sim.ITEMS.find((i) => i.slot === 'WEAPON' && i.rarity === 'COMMON'));
  armed.hp = 1;
  const rest = sim.restHero(armed);
  assert.ok(rest.upgrade && rest.mended === 0, 'ASH: no upgrade offered');
  assert.equal(armed.hp, 1 + Math.round(sim.derive(armed).maxHp * 0.5), 'ASH: rest heals 50 %');
  return ['restHealMult', 'restUpgrade'];
}

function neutral(sim) {
  const hero = sim.createHero();
  assert.equal(sim.pactDamage(hero, true), 1, 'no pacts: damage multiplier');
  assert.equal(sim.derive(hero).maxHp, 46, 'no pacts: base max HP');
}

export function pactEffectRules(sim) {
  neutral(sim);
  const covered = [maxHpMods, damageMods, clearMods, foeMods, lootMods, restMods].flatMap((rule) => rule(sim));
  assert.deepEqual([...covered].sort(), Object.keys(sim.neutralMods()).sort(), 'a PactMod has no rules test');
  return `${covered.length} PactMods each observed (max HP, damage, ember, clear heal/SP, foe ATK/HP/affix, loot rarity/drops/cards, REST); neutral without pacts`;
}
