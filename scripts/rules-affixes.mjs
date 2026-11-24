import assert from 'node:assert/strict';

const fixed = (v) => () => v;
const SCALE = { n: 4, clears: 0, descentClears: 0 };
const item = (sim, id) => {
  const found = sim.ITEMS.find((i) => i.id === id);
  assert.ok(found, `no item ${id}`);
  return found;
};

function sturdy(sim) {
  const hero = sim.createHero();
  hero.bonusMaxHp = 2000;
  hero.hp = sim.derive(hero).maxHp;
  return hero;
}

const foe = (sim, affixes, id = 'SKELETON') => sim.spawnEnemy(id, SCALE, affixes);

function strikeAt(sim, enemy, move) {
  const battle = sim.createBattle(enemy);
  battle.intent = move;
  return battle;
}

function vampiric(sim) {
  const e = foe(sim, ['VAMPIRIC']);
  e.hp = Math.floor(e.maxHp / 2);
  const before = e.hp;
  const r = sim.enemyAct(sturdy(sim), strikeAt(sim, e, 'STRIKE'), fixed(0.5));
  assert.ok(r.dmg > 0, 'VAMPIRIC test: no damage dealt');
  assert.equal(r.healed, Math.round(r.dmg * sim.AFFIX_LIFESTEAL), 'VAMPIRIC heals 30 % of damage dealt');
  assert.equal(e.hp - before, r.healed, 'VAMPIRIC heal not applied');
  const full = foe(sim, ['VAMPIRIC']);
  full.hp = full.maxHp - 1;
  sim.enemyAct(sturdy(sim), strikeAt(sim, full, 'STRIKE'), fixed(0.5));
  assert.equal(full.hp, full.maxHp, 'VAMPIRIC heal is not capped at max HP');
  assert.equal(sim.enemyAct(sturdy(sim), strikeAt(sim, foe(sim, []), 'STRIKE'), fixed(0.5)).healed, 0, 'a plain foe heals');
}

function thorned(sim) {
  const hero = sturdy(sim);
  const hp0 = hero.hp;
  const r = sim.heroAct(hero, sim.createBattle(foe(sim, ['THORNED'])), 'ATTACK', fixed(0.5));
  const dealt = r.hits.reduce((a, h) => a + h.dmg, 0);
  const want = Math.round(Math.min(dealt * sim.AFFIX_THORNS, sim.derive(hero).maxHp * sim.AFFIX_THORNS_CAP));
  assert.equal(r.thorns, want, 'THORNED returns its share of damage taken');
  assert.equal(hp0 - hero.hp, want, 'THORNED damage not taken');
  const brute = sim.createHero();
  brute.alloc.ATK = 60;
  brute.hp = 1;
  const cap = Math.round(sim.derive(brute).maxHp * sim.AFFIX_THORNS_CAP);
  const fatal = sim.heroAct(brute, sim.createBattle(foe(sim, ['THORNED'], 'OGRE_KING')), 'ATTACK', fixed(0.5));
  assert.equal(fatal.thorns, cap, 'THORNED is capped by the hero max HP');
  assert.ok(fatal.heroDead && brute.hp === 0, 'THORNED can kill through heroFalls');
  const last = foe(sim, ['THORNED']);
  last.hp = 1;
  const killing = sim.heroAct(sturdy(sim), sim.createBattle(last), 'ATTACK', fixed(0.5));
  assert.ok(killing.enemyDefeated && killing.thorns === 0, 'THORNED answered the killing blow');
}

function swift(sim) {
  const hero = sturdy(sim);
  const e = foe(sim, ['SWIFT']);
  const r = sim.heroAct(hero, sim.createBattle(e), 'ATTACK', fixed(0));
  assert.ok(r.missed && r.hits.length === 0 && e.hp === e.maxHp, 'SWIFT evades ATTACK');
  assert.equal(hero.ember, 0, 'an evaded action gained ember');
  const mp0 = hero.mp;
  const spell = sim.heroAct(hero, sim.createBattle(e), 'FIREBALL', fixed(0));
  assert.ok(spell.missed && hero.mp === mp0 - sim.spellCost(hero, 'FIREBALL'), 'an evaded spell still spends MP');
  assert.ok(!sim.heroAct(hero, sim.createBattle(e), 'ATTACK', fixed(0.5)).missed, 'SWIFT evaded above its chance');
  hero.ember = 100;
  const burst = sim.heroAct(hero, sim.createBattle(e), 'BURST', fixed(0));
  assert.ok(!burst.missed && burst.hits.length === 1, 'BURST missed a SWIFT foe');
  assert.ok(!sim.heroAct(sturdy(sim), sim.createBattle(foe(sim, [])), 'ATTACK', fixed(0)).missed, 'a plain foe evaded');
}

function searing(sim) {
  const hot = sturdy(sim);
  assert.ok(sim.enemyAct(hot, strikeAt(sim, foe(sim, ['SEARING']), 'STRIKE'), fixed(0.5)).burned && hot.burn, 'SEARING STRIKE burns');
  const plain = sturdy(sim);
  assert.ok(!sim.enemyAct(plain, strikeAt(sim, foe(sim, []), 'STRIKE'), fixed(0.5)).burned && !plain.burn, 'a plain STRIKE burns');
  const wound = sturdy(sim);
  assert.ok(!sim.enemyAct(wound, strikeAt(sim, foe(sim, ['SEARING']), 'WINDUP'), fixed(0.5)).burned, 'SEARING burned on a WINDUP');
}

function affixBehaviour(sim) {
  [vampiric, thorned, swift, searing].forEach((rule) => { rule(sim); });
  return 'VAMPIRIC heals 30 % capped; THORNED 15 % (cap 12 % max HP) can kill, never on the killing blow; SWIFT 15 % evades ATTACK and spells (MP spent, no ember), never BURST; SEARING STRIKEs burn';
}

function spawnTopUp(sim) {
  const plans = sim.planDepth(2, sim.createSeededRng(5).next);
  const plan = plans[0];
  const hero = sim.createHero();
  const ctx = { ...SCALE, hero, plan };
  const boss = sim.spawnFoe(plan.boss, ctx);
  assert.deepEqual(boss.affixes, plan.affixOrder.slice(0, 1), 'a depth-2 boss takes the elite count from the plan order');
  assert.equal(boss.phaseAt, sim.DESCENT_PHASE_AT, 'descent boss phaseAt');
  assert.deepEqual(sim.spawnFoe(plan.normals[0], ctx).affixes, [], 'a depth-2 normal carries an affix');
  const given = sim.spawnFoe(plan.elites[0], { ...ctx, affixes: ['SEARING'] });
  assert.deepEqual(given.affixes, ['SEARING'], 'a scouted elite was topped up past its count');
  sim.takePact(hero, 'HEX');
  assert.equal(sim.spawnFoe(plan.boss, ctx).affixes.length, 2, 'HEX adds an affix to bosses');
  assert.equal(sim.spawnFoe(plan.elites[0], { ...ctx, affixes: ['SEARING'] }).affixes[0], 'SEARING', 'top-up dropped the scouted affix');
  assert.equal(sim.spawnFoe(plan.normals[0], ctx).affixes.length, 0, 'HEX touched a normal');
  const story = sim.planDepth(1, fixed(0.5))[0];
  const storyBoss = sim.spawnFoe(story.boss, { n: 0, clears: 0, descentClears: null, hero, plan: story });
  assert.deepEqual([storyBoss.affixes, storyBoss.phaseAt], [[], undefined], 'a story boss carries descent rules');
  const deep = sim.spawnFoe(sim.planDepth(9, fixed(0.3))[0].boss, { n: 32, clears: 0, descentClears: 0, hero, plan: sim.planDepth(9, fixed(0.3))[0] });
  assert.equal(deep.affixes.length, sim.AFFIX_MAX, 'affixes cap at AFFIX_MAX');
  assert.equal(new Set(deep.affixes).size, deep.affixes.length, 'a boss repeats an affix');
  return 'spawnFoe tops bosses up to the elite count from plan.affixOrder, HEX +1 on elites/bosses only, max 3, none in the story';
}

function phaseLine(sim) {
  const plan = sim.planDepth(2, sim.createSeededRng(5).next)[0];
  const boss = sim.spawnFoe(plan.boss, { ...SCALE, hero: sim.createHero(), plan });
  boss.hp = Math.floor(boss.maxHp * sim.DESCENT_PHASE_AT) - 1;
  assert.ok(sim.enemyAct(sturdy(sim), sim.createBattle(boss), fixed(0.5)).phaseChanged, 'descent boss did not turn at 70 %');
  const story = sim.spawnEnemy(plan.boss, SCALE);
  story.hp = Math.floor(story.maxHp * sim.DESCENT_PHASE_AT) - 1;
  assert.ok(story.def.phase2.at < sim.DESCENT_PHASE_AT, 'fixture: story phase line should sit below 70 %');
  assert.ok(!sim.enemyAct(sturdy(sim), sim.createBattle(story), fixed(0.5)).phaseChanged, 'story boss turned at 70 %');
  return `boss phase line ${sim.DESCENT_PHASE_AT} via the instance in the descent, def line in the story`;
}

const SLOT_NAMES = ['WEAPON', 'ARMOR', 'NECKLACE', 'BOOTS', 'CHALICE', 'TOME'];

function ownedBySlot(hero) {
  return SLOT_NAMES.map((slot) => {
    const worn = hero.equipment[slot] ? [{ item: hero.equipment[slot], level: hero.levels[slot] ?? 0 }] : [];
    return [null, ...worn, ...hero.pack.filter((o) => o.item.slot === slot)];
  });
}

function loadouts(sim, hero) {
  let all = [{}];
  for (const options of ownedBySlot(hero)) {all = all.flatMap((pick) => options.map((o) => (o ? { ...pick, [o.item.slot]: o } : pick)));}
  return all.map((pick) => {
    const worn = Object.values(pick);
    const owned = ownedBySlot(hero).flat().filter((o) => o && !worn.includes(o));
    return {
      ...hero,
      equipment: Object.fromEntries(worn.map((o) => [o.item.slot, o.item])),
      levels: Object.fromEntries(worn.map((o) => [o.item.slot, o.level])),
      pack: owned,
    };
  });
}

function bestOf(sim, hero, field) {
  return Math.max(...loadouts(sim, hero).map((h) => sim.derive(h)[field]));
}

function expectedHollow(sim, hero, n) {
  const best = Object.fromEntries(['atk', 'mag', 'def', 'mdef', 'maxHp'].map((f) => [f, bestOf(sim, hero, f)]));
  const kind = best.atk >= best.mag ? 'PHYSICAL' : 'MAGIC';
  const base = Math.max(best.atk, best.mag);
  const resPhys = Math.min(sim.HOLLOW_RES_CAP, best.def);
  const resMagic = Math.min(sim.HOLLOW_RES_CAP, best.mdef);
  const hex = ownedBySlot(hero).flat().some((o) => o && sim.effectiveEffect(o.item, o.level).kind === 'HEX_STRIKE');
  const faced = kind === 'MAGIC' ? resMagic : hex ? Math.min(resPhys, resMagic) : resPhys;
  const hp = Math.max(1, Math.round(sim.HOLLOW_HP_HITS * base * (1 - faced / 100)), Math.round(sim.HOLLOW_HP_FLOOR * best.maxHp));
  const strikeKind = best.def > best.mdef ? 'MAGIC' : best.mdef > best.def ? 'PHYSICAL' : kind;
  const guard = strikeKind === 'MAGIC' ? best.mdef : best.def;
  const perHp = best.maxHp / Math.max(0.05, 1 - guard / 100);
  const strike = Math.min(Math.max(sim.HOLLOW_ATK_SHARE * base, sim.HOLLOW_HIT_FLOOR * perHp), sim.HOLLOW_HIT_CAP * perHp);
  const atk = Math.max(1, Math.round((strike * sim.actMult(n)) / sim.ACT_MULT[3]));
  return { kind: strikeKind, hp, atk, resPhys, resMagic };
}

function richOwner(sim) {
  const hero = sim.createHero();
  hero.alloc.MAG = 6;
  hero.alloc.ATK = 3;
  sim.equip(hero, item(sim, 'ARC_ROD'), 1);
  sim.equip(hero, item(sim, 'PADDED_COAT'), 2);
  sim.equip(hero, item(sim, 'CLAY_BOWL'), 0);
  for (const id of ['IRON_SWORD', 'HEX_DAGGER', 'LEATHER_VEST']) {sim.stow(hero, { item: item(sim, id), level: 1 });}
  return hero;
}

function swapProof(sim) {
  const rich = richOwner(sim);
  const want = sim.hollowOf(rich, 7);
  const tried = loadouts(sim, rich);
  for (const hero of tried) {
    const h = sim.hollowOf(hero, 7);
    assert.ok(h.maxHp >= want.maxHp && h.atk >= want.atk, `a loadout lowered the hollow: HP ${h.maxHp} < ${want.maxHp} or ATK ${h.atk} < ${want.atk}`);
  }
  const want2 = expectedHollow(sim, rich, 7);
  assert.deepEqual([want.maxHp, want.atk, want.def.atkType], [want2.hp, want2.atk, want2.kind], 'hollow is not sized off the best loadout');
  return `${tried.length} worn/packed loadouts of one hero: the hollow never drops below HP ${want.maxHp} / ATK ${want.atk}`;
}

function checkHollow(sim, hero, n, affixes) {
  const h = sim.hollowOf(hero, n);
  const want = expectedHollow(sim, hero, n);
  assert.deepEqual([h.maxHp, h.hp, h.atk, h.resPhys, h.resMagic], [want.hp, want.hp, want.atk, want.resPhys, want.resMagic], `hollow n=${n} numbers`);
  assert.equal(h.def.atkType, want.kind, 'hollow strikes at the weaker resist (ties: the kind of the stronger stat)');
  assert.deepEqual(h.affixes, affixes, 'hollow affixes read off the gear');
  assert.equal(h.def.kind, 'BOSS', 'hollow is a boss');
  assert.ok(!h.def.weak && !h.def.resists && !h.def.phase2, 'hollow has a weakness, resist or phase 2');
  assert.equal(h.def.moves.filter((m) => m === 'WINDUP').length, 1, 'hollow cycle has one wind-up');
  return h;
}

function hollow(sim) {
  assert.equal(checkHollow(sim, sim.createHero(), 7, []).def.atkType, 'MAGIC', 'an unarmed hero (MAG 12 > ATK 7) meets a magic hollow');
  const geared = sim.createHero();
  geared.alloc.ATK = 10;
  for (const id of ['SOULEATER', 'BRAMBLE_VEST', 'WIND_GREAVES', 'PYRE_CHALICE']) {sim.equip(geared, item(sim, id));}
  for (const n of [7, 11, 19]) {checkHollow(sim, geared, n, ['VAMPIRIC', 'THORNED', 'SWIFT']);}
  const burner = sim.createHero();
  sim.equip(burner, item(sim, 'PYRE_CHALICE'));
  checkHollow(sim, burner, 7, ['SEARING']);
  const floor = sim.createHero();
  floor.bonusMaxHp = 600;
  const floored = checkHollow(sim, floor, 7, []);
  assert.equal(floored.maxHp, Math.round(sim.HOLLOW_HP_FLOOR * sim.derive(floor).maxHp), 'hollow HP floor');
  const wall = sim.createHero();
  wall.alloc.DEF = 20;
  wall.alloc.MDEF = 20;
  const capped = checkHollow(sim, wall, 7, []);
  assert.deepEqual([capped.resPhys, capped.resMagic], [sim.HOLLOW_RES_CAP, sim.HOLLOW_RES_CAP], 'hollow resists cap at 40');
  const mage = sim.createHero();
  sim.equip(mage, sim.ITEMS.find((i) => i.slot === 'WEAPON' && i.weaponKind === 'MAGIC' && i.effect.kind === 'NONE'));
  assert.equal(checkHollow(sim, mage, 7, []).def.atkType, 'MAGIC', 'a magic hero meets a magic hollow');
  const viaSpawn = sim.spawnFoe('HOLLOW', { n: 7, clears: 3, descentClears: 3, hero: geared });
  assert.deepEqual([viaSpawn.maxHp, viaSpawn.atk], [sim.hollowOf(geared, 7).maxHp, sim.hollowOf(geared, 7).atk], 'spawnFoe routes HOLLOW to hollowOf');
  const glassMage = sim.createHero();
  glassMage.alloc.MAG = 60;
  const mirrored = sim.hollowOf(glassMage, 7);
  assert.ok(mirrored.atk < Math.round((sim.HOLLOW_ATK_SHARE * sim.derive(glassMage).mag * sim.actMult(7)) / sim.ACT_MULT[3]), 'a glass mage\'s hollow was not capped by max HP');
  return `hollowOf: ATK ${sim.HOLLOW_ATK_SHARE} x best-loadout max(ATK, MAG) (a STRIKE landing ${sim.HOLLOW_HIT_FLOOR}-${sim.HOLLOW_HIT_CAP} x max HP through the weaker resist) x actMult/ACT_MULT[3], HP ${sim.HOLLOW_HP_HITS} hits through the resist faced (floor ${sim.HOLLOW_HP_FLOOR} x max HP), resists capped ${sim.HOLLOW_RES_CAP}, gear affixes in order (max 3) | ${swapProof(sim)}`;
}

const ANNOUNCE_SEEDS = 400;

function hexHero(sim, seed) {
  const hero = sim.createHero();
  if (seed % 2 === 1) {sim.takePact(hero, 'HEX');}
  return hero;
}

function announcedDepth(sim, depth, seed) {
  const rng = sim.createSeededRng(seed * 31 + depth).next;
  const plans = sim.planDepth(depth, rng);
  const announced = new Set(sim.depthAffixes(plans));
  const hero = hexHero(sim, seed);
  let carried = 0;
  plans.forEach((plan, act) => {
    const n = (depth - 1) * 4 + act;
    const stages = sim.generateMap(rng, { stageSizes: plan.stageSizes, weights: plan.weights }, plan);
    const foes = stages.flat().filter((node) => node.type !== 'BOSS' && node.enemyId).map((node) => [node.enemyId, node.affixes ?? []]);
    if (plan.boss !== 'HOLLOW') {foes.push([plan.boss, []]);}
    for (const [id, affixes] of foes) {
      const enemy = sim.spawnFoe(id, { n, clears: 0, descentClears: 0, hero, affixes, plan });
      for (const affix of [...affixes, ...enemy.affixes]) {
        carried += 1;
        assert.ok(announced.has(affix), `depth ${String(depth)} seed ${String(seed)}: ${id} carries ${affix}, announced only ${[...announced].join(' ')}`);
      }
    }
  });
  return carried;
}

function announcedSet(sim) {
  let carried = 0;
  for (let depth = 2; depth <= 7; depth++) {
    for (let seed = 0; seed < ANNOUNCE_SEEDS; seed++) {carried += announcedDepth(sim, depth, seed);}
  }
  assert.ok(carried > 1000, `only ${String(carried)} affixes sampled`);
  assert.deepEqual(sim.depthAffixes(sim.planDepth(1, sim.createSeededRng(1).next)), [], 'depth 1 announces affixes');
  return `${String(6 * ANNOUNCE_SEEDS)} depths 2-7 (HEX on half): all ${String(carried)} affixes on scouted nodes and spawned foes (top-ups, bosses) are in the PACT screen's announced set`;
}

export function affixRules(sim) {
  return [affixBehaviour, spawnTopUp, phaseLine, hollow, announcedSet].map((rule) => rule(sim)).join(' | ');
}
