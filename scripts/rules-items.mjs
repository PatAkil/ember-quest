import assert from 'node:assert/strict';
import { fightOf, seeded } from './rules-foe.mjs';

const BIG = 100000;
const OFFER_ROLLS = 3000;
const SOURCES = ['ELITE', 'LOOT', 'BOSS'];

const itemOf = (sim, id) => {
  const item = sim.ITEMS.find((i) => i.id === id);
  assert.ok(item, `no item ${id}`);
  return item;
};

const bare = (sim, id) => ({ ...itemOf(sim, id), mods: {} });
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1, `${what}: ${a} vs ${b}`);

function arena(sim, { id = 'SLIME', at = 0, gear = [], level = 0 } = {}) {
  const f = fightOf(sim, id, at);
  for (const item of gear) {sim.equip(f.hero, item, level);}
  Object.assign(f.enemy, { hp: BIG, maxHp: BIG, resPhys: 0, resMagic: 0 });
  f.hero.hp = sim.derive(f.hero).maxHp;
  return f;
}

function hitWith(sim, opts, action = 'ATTACK', seed = 3) {
  const f = arena(sim, opts);
  f.hero.mp = 99;
  if (opts.riposte) {f.battle.riposte = true;}
  if (opts.hp !== undefined) {f.hero.hp = opts.hp;}
  if (opts.learn) {f.hero.baseSpells.push(opts.learn);}
  const r = sim.heroAct(f.hero, f.battle, action, seeded(sim, seed));
  return { ...f, r, dmg: r.hits.reduce((n, h) => n + h.dmg, 0) };
}

function struckWhileGuarding(sim, { gear = [], level = 0, id = 'SLIME', at = 0, action = 'GUARD' } = {}) {
  const f = arena(sim, { id, at, gear, level });
  f.enemy.atk = 100;
  f.hero.hp = BIG;
  f.hero.mp = 10;
  if (action !== 'GUARD') {f.hero.baseSpells.push(action);}
  sim.heroAct(f.hero, f.battle, action, seeded(sim, 1));
  f.hero.mp = 0;
  const mpBefore = f.hero.mp;
  const r = sim.enemyAct(f.hero, f.battle, seeded(sim, 7));
  return { ...f, r, mpGain: f.hero.mp - mpBefore };
}

function guardKinds(sim) {
  const plain = struckWhileGuarding(sim);
  const counter = struckWhileGuarding(sim, { gear: [bare(sim, 'BULWARK_MAIL')] });
  const d = sim.derive(counter.hero);
  assert.equal(plain.r.countered, 0, 'no counter without GUARD_COUNTER');
  assert.equal(counter.r.countered, Math.max(1, Math.round(d.atk * 1.0)), 'GUARD_COUNTER strikes back for fraction x ATK');
  assert.equal(BIG - counter.enemy.hp, counter.r.countered, 'the counter lands on the foe');
  const mana = struckWhileGuarding(sim, { gear: [itemOf(sim, 'PADDED_COAT')], level: 2 });
  assert.equal(plain.mpGain, 2, 'a guarded hit gives 2 MP');
  assert.equal(mana.mpGain, 5, 'GUARD_MANA adds 3 more MP');
}

function parryPower(sim) {
  const base = hitWith(sim, {});
  const riposte = hitWith(sim, { riposte: true });
  const keen = hitWith(sim, { riposte: true, gear: [bare(sim, 'DUELIST_FOIL')], level: 2 });
  near(riposte.dmg, base.dmg * 1.5, 'riposte x1.5 without PARRY_POWER');
  near(keen.dmg, base.dmg * 2.8, 'PARRY_POWER makes the riposte x2.8');
}

function punish(sim) {
  const maul = bare(sim, 'BREAKER_MAUL');
  const calm = hitWith(sim, { id: 'GOBLIN', at: 2, gear: [maul] });
  const wound = hitWith(sim, { id: 'GOBLIN', at: 1, gear: [maul] });
  assert.equal(wound.battle.intent, 'HEAVY');
  near(wound.dmg, calm.dmg * 1.8, 'PUNISH_WINDUP x1.8 against a shown HEAVY');
  const plain = arena(sim, { id: 'GOBLIN', at: 1 });
  const breaker = arena(sim, { id: 'GOBLIN', at: 1, gear: [maul] });
  for (const f of [plain, breaker]) {Object.assign(f.enemy, { hp: 1000, maxHp: 40 });}
  const r0 = sim.heroAct(plain.hero, plain.battle, 'ATTACK', seeded(sim, 3));
  const r1 = sim.heroAct(breaker.hero, breaker.battle, 'ATTACK', seeded(sim, 3));
  assert.ok(!r0.broke, 'a plain physical hit does not break');
  assert.ok(r1.broke && breaker.enemy.staggered, 'with PUNISH_WINDUP any damaging hit past the floor breaks');
}

function burstKinds(sim) {
  const treads = hitWith(sim, { gear: [bare(sim, 'EMBER_TREADS')] });
  assert.equal(treads.hero.ember, Math.round(6 * 1.6), 'BURST_GAIN x1.6 ember per action');
  const nova = arena(sim, { gear: [bare(sim, 'NOVA_STRIDERS')] });
  nova.hero.ember = 100;
  const d = sim.derive(nova.hero);
  const r = sim.heroAct(nova.hero, nova.battle, 'BURST', seeded(sim, 1));
  assert.equal(r.hits[0].dmg, Math.round(Math.max(d.atk, d.mag) * 2.5 * 1.7), 'BURST_POWER x1.7');
}

function imbue(sim) {
  const brand = bare(sim, 'EMBER_BRAND');
  const plain = hitWith(sim, { id: 'SKELETON', gear: [brand] });
  const weak = hitWith(sim, { id: 'GOBLIN', at: 2, gear: [brand] });
  assert.ok(weak.r.weak && !plain.r.weak, 'IMBUE FIRE makes ATTACK hit a FIRE weakness');
  near(weak.dmg, plain.dmg * 1.5, 'imbued weak hit x1.5');
  const f = arena(sim, { id: 'GOBLIN', at: 1, gear: [brand] });
  Object.assign(f.enemy, { hp: 1000, maxHp: 40 });
  assert.ok(sim.heroAct(f.hero, f.battle, 'ATTACK', seeded(sim, 3)).broke, 'an imbued weak ATTACK breaks a HEAVY');
}

function elementBoost(sim) {
  const goblet = bare(sim, 'FIRE_GOBLET');
  const plain = hitWith(sim, { id: 'SKELETON' }, 'FIREBALL');
  const boosted = hitWith(sim, { id: 'SKELETON', gear: [goblet] }, 'FIREBALL');
  const other = hitWith(sim, { id: 'SKELETON', gear: [goblet], learn: 'TWINBOLT' }, 'TWINBOLT');
  const otherPlain = hitWith(sim, { id: 'SKELETON', learn: 'TWINBOLT' }, 'TWINBOLT');
  near(boosted.dmg, plain.dmg * 1.4, 'ELEMENT_BOOST FIRE x1.4 on FIREBALL');
  assert.equal(other.dmg, otherPlain.dmg, 'ELEMENT_BOOST FIRE leaves THUNDER alone');
}

function burnOnHit(sim) {
  const pyre = bare(sim, 'PYRE_CHALICE');
  let burned = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const f = hitWith(sim, { gear: [pyre] }, 'ATTACK', seed);
    if (!f.r.burned) {continue;}
    burned++;
    assert.equal(f.enemy.burn.perTurn, Math.max(1, Math.round(f.dmg * 0.4)), 'BURN_ON_HIT burns 40 % of the hit');
  }
  assert.ok(burned > 100 && burned < 180, `BURN_ON_HIT 35 % chance: ${burned}/400`);
  const none = hitWith(sim, {}, 'ATTACK', 5);
  assert.ok(!none.r.burned && none.enemy.burn === null, 'no burn without BURN_ON_HIT');
}

function burnWard(sim) {
  const scorch = (gear) => {
    const f = arena(sim, { id: 'SCORPION', at: 1, gear });
    f.hero.hp = BIG;
    return { ...f, r: sim.enemyAct(f.hero, f.battle, seeded(sim, 7)) };
  };
  const open = scorch([]);
  const warded = scorch([bare(sim, 'FROST_BEAD')]);
  assert.ok(open.r.burned && open.hero.burn, 'SCORCH burns');
  assert.ok(!warded.r.burned && warded.hero.burn === null, 'BURN_WARD keeps the hero from burning');
}

function lowHp(sim) {
  const light = bare(sim, 'LAST_LIGHT');
  const max = sim.derive(sim.createHero()).maxHp;
  const healthy = hitWith(sim, { gear: [light], hp: Math.ceil(max * 0.5) });
  const low = hitWith(sim, { gear: [light], hp: Math.floor(max * 0.5) - 1 });
  near(low.dmg, healthy.dmg * 1.8, 'LOW_HP_POWER x1.8 below half HP');
}

function aegis(sim) {
  const open = struckWhileGuarding(sim, { action: 'ATTACK' });
  const shield = struckWhileGuarding(sim, { action: 'AEGIS' });
  assert.ok(shield.r.guarded, 'AEGIS guards');
  near(shield.r.dmg, open.r.dmg * 0.5, 'AEGIS halves the hit');
  assert.equal(shield.r.reflected, Math.max(1, Math.round(shield.r.dmg * 0.5)), 'AEGIS reflects 50 % of the reduced hit');
  assert.equal(shield.mpGain, 2, 'AEGIS gains guard MP');
  const parry = struckWhileGuarding(sim, { id: 'GOBLIN', at: 1, action: 'AEGIS' });
  assert.ok(parry.r.parried && parry.battle.riposte, 'AEGIS parries a HEAVY');
  const f = arena(sim, { gear: [itemOf(sim, 'HOLY_GRAIL')] });
  f.hero.hp = 5;
  assert.equal(sim.startTurn(f.hero, f.battle, 'AEGIS').hpRegen, 0, 'no regen on an AEGIS turn');
  const cost = arena(sim);
  cost.hero.mp = 20;
  cost.hero.baseSpells.push('AEGIS');
  sim.heroAct(cost.hero, cost.battle, 'AEGIS', seeded(sim, 1));
  assert.equal(cost.hero.mp, 15, 'AEGIS costs 5 MP');
}

function newSpells(sim) {
  const embers = hitWith(sim, { id: 'GOBLIN', at: 2, learn: 'EMBERS' }, 'EMBERS');
  assert.equal(embers.r.hits.length, 2, 'EMBERS hits twice');
  assert.ok(embers.r.weak, 'EMBERS is fire');
  const tremor = hitWith(sim, { id: 'SKELETON', learn: 'TREMOR' }, 'TREMOR');
  assert.ok(tremor.r.weak && tremor.r.hits[0].kind === 'PHYSICAL', 'TREMOR is a physical earth blow');
  assert.equal(tremor.hero.mp, 99 - 3, 'TREMOR costs 3 MP');
}

function offerSpread(sim) {
  const seen = new Set();
  const rng = seeded(sim, 11);
  for (let i = 0; i < OFFER_ROLLS; i++) {
    const offers = sim.rollLoot(SOURCES[i % SOURCES.length], { n: i % 4, plan: sim.storyPlan()[i % 4] }, sim.createHero(), rng);
    for (const o of offers) {if (o.kind === 'ITEM') {seen.add(o.item.id);}}
  }
  const missing = sim.ITEMS.filter((it) => !it.bossOnly && !seen.has(it.id)).map((it) => it.id);
  assert.deepEqual(missing, [], `never offered in ${OFFER_ROLLS} rolls`);
}

export function itemRules(sim) {
  guardKinds(sim);
  parryPower(sim);
  punish(sim);
  burstKinds(sim);
  imbue(sim);
  elementBoost(sim);
  burnOnHit(sim);
  burnWard(sim);
  lowHp(sim);
  aegis(sim);
  newSpells(sim);
  offerSpread(sim);
  return 'COUNTER, GUARD MP, PARRY x2.8, PUNISH x1.8 + break, EMBER x1.6, BURST x1.7, IMBUE weak + break, BOOST x1.4, IGNITE 35 %, BURN WARD, LOW HP x1.8; AEGIS guard+reflect+parry; EMBERS, TREMOR; every item offered';
}
