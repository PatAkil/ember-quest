import assert from 'node:assert/strict';
import { fightOf, seeded } from './rules-foe.mjs';

const itemOf = (sim, id) => sim.ITEMS.find((i) => i.id === id);
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1, `${what}: ${a} vs ${b}`);

function struck(sim, { id = 'SLIME', at = 0, guards = 0, gear = [] } = {}) {
  const f = fightOf(sim, id, at);
  for (const g of gear) {sim.equip(f.hero, itemOf(sim, g), 0);}
  f.enemy.atk = 100;
  f.hero.hp = 1000;
  f.hero.mp = 0;
  for (let i = 0; i < guards; i++) {
    sim.heroAct(f.hero, f.battle, 'GUARD', seeded(sim, 1));
    if (i < guards - 1) {sim.enemyAct(f.hero, f.battle, seeded(sim, 7));}
  }
  f.hero.mp = 0;
  f.hero.ember = 0;
  return { ...f, r: sim.enemyAct(f.hero, f.battle, seeded(sim, 7)) };
}

function guardRules(sim) {
  const open = struck(sim);
  const guarded = struck(sim, { guards: 1 });
  assert.ok(guarded.r.guarded && !open.r.guarded, 'GUARD not reported on the hit');
  near(guarded.r.dmg, open.r.dmg * 0.5, 'GUARD x0.5');
  assert.equal(guarded.hero.mp, 2, 'a guarded hit gives 2 MP');
  assert.equal(open.hero.mp, 0, 'an open hit gives no MP');
  assert.equal(open.hero.ember, 4, 'a hit taken gives +4 ember');
  const chained = struck(sim, { guards: 2 });
  near(chained.r.dmg, open.r.dmg * 0.75, 'a chained GUARD x0.75');
  assert.ok(chained.hero.mp === 0 && chained.hero.ember === 0, 'a chained GUARD gives no MP and no ember');
  const answer = struck(sim, { id: 'GOBLIN', guards: 2 });
  assert.equal(answer.r.move, 'HEAVY');
  assert.ok(answer.r.parried && answer.hero.mp === 2, 'a chained GUARD answering HEAVY parries and gains MP');
  assert.equal(answer.hero.ember, 19, 'parry +15 and hit +4');
  const thorns = struck(sim, { guards: 1, gear: ['BRAMBLE_VEST'] });
  assert.equal(thorns.r.reflected, Math.max(1, Math.round(thorns.r.dmg * 0.35)), 'REFLECT uses the guarded number');
}

function guardLeavesState(sim) {
  const f = fightOf(sim, 'SLIME');
  Object.assign(f.battle, { rampStacks: 2, lastScope: 'ATTACK', actionsTaken: 3 });
  sim.heroAct(f.hero, f.battle, 'GUARD', seeded(sim, 1));
  assert.deepEqual([f.battle.rampStacks, f.battle.lastScope, f.battle.actionsTaken], [2, 'ATTACK', 3], 'GUARD touched RAMP/lastScope/actionsTaken');
  const r = fightOf(sim, 'SLIME');
  sim.equip(r.hero, itemOf(sim, 'HOLY_GRAIL'), 0);
  r.hero.hp = 10;
  r.hero.mp = 0;
  const still = sim.startTurn(r.hero, r.battle, 'GUARD');
  assert.ok(still.hpRegen === 0 && still.mpRegen === 0, 'regen ticked on a GUARD turn');
  const moving = sim.startTurn(r.hero, r.battle, 'ATTACK');
  assert.ok(moving.hpRegen > 0 && moving.mpRegen > 0, 'regen did not tick on an ATTACK turn');
}

function attackDmg(sim, riposte) {
  const f = fightOf(sim, 'GOBLIN', 2);
  f.battle.riposte = riposte;
  const r = sim.heroAct(f.hero, f.battle, 'ATTACK', seeded(sim, 3));
  return { dmg: r.hits[0].dmg, battle: f.battle };
}

function parryRules(sim) {
  const plain = attackDmg(sim, false);
  const riposte = attackDmg(sim, true);
  near(riposte.dmg, plain.dmg * 1.5, 'riposte x1.5');
  assert.equal(riposte.battle.riposte, false, 'riposte spent by the damaging action');
  const dodge = fightOf(sim, 'GOBLIN', 1);
  sim.equip(dodge.hero, itemOf(sim, 'WORN_SHOES'), 0);
  sim.heroAct(dodge.hero, dodge.battle, 'GUARD', seeded(sim, 1));
  const r = sim.enemyAct(dodge.hero, dodge.battle, () => 0);
  assert.ok(r.dodged && r.parried && dodge.battle.riposte, 'a dodged guarded HEAVY is a parry');
  dodge.hero.ember = 100;
  sim.heroAct(dodge.hero, dodge.battle, 'BURST', seeded(sim, 1));
  assert.equal(dodge.battle.riposte, true, 'BURST spent the riposte');
}

function burnRules(sim) {
  const f = fightOf(sim, 'SCORPION', 1);
  f.enemy.atk = 50;
  f.hero.hp = 1000;
  const r = sim.enemyAct(f.hero, f.battle, seeded(sim, 7));
  assert.ok(r.burned);
  assert.deepEqual(f.hero.burn, { perTurn: Math.max(1, Math.round(r.dmg * 0.4)), turns: 3 }, 'BURN = 40 % of the hit for 3 turns');
  const big = f.hero.burn.perTurn;
  const tick = sim.startTurn(f.hero, f.battle, 'ATTACK');
  assert.equal(tick.heroBurn, big);
  f.enemy.atk = 2;
  f.enemy.cycleIndex = 1;
  f.battle.intent = 'SCORCH';
  sim.enemyAct(f.hero, f.battle, seeded(sim, 7));
  assert.deepEqual(f.hero.burn, { perTurn: big, turns: 3 }, 'the larger BURN kept, turns reset');
  const dodged = fightOf(sim, 'SCORPION', 1);
  sim.equip(dodged.hero, itemOf(sim, 'WORN_SHOES'), 0);
  const miss = sim.enemyAct(dodged.hero, dodged.battle, () => 0);
  assert.ok(miss.dodged && !miss.burned && dodged.hero.burn === null, 'a dodged SCORCH burned');
}

function burnTicks(sim) {
  const f = fightOf(sim, 'SLIME');
  f.hero.hp = 3;
  f.hero.burn = { perTurn: 5, turns: 3 };
  f.enemy.burn = { perTurn: 5, turns: 3 };
  const dead = sim.startTurn(f.hero, f.battle, 'ATTACK');
  assert.ok(dead.heroDead && dead.enemyBurn === 0, 'a hero tick kills before the foe ticks');
  const phoenix = fightOf(sim, 'SLIME');
  sim.equip(phoenix.hero, itemOf(sim, 'PHOENIX_TEAR'), 0);
  phoenix.hero.hp = 3;
  phoenix.hero.burn = { perTurn: 5, turns: 3 };
  const rose = sim.startTurn(phoenix.hero, phoenix.battle, 'ATTACK');
  assert.ok(rose.revived && !rose.heroDead && phoenix.hero.hp > 0, 'REVIVE answers a BURN tick');
  const foe = fightOf(sim, 'SLIME');
  foe.enemy.burn = { perTurn: 999, turns: 3 };
  const won = sim.startTurn(foe.hero, foe.battle, 'ATTACK');
  assert.ok(won.enemyDefeated && foe.hero.ember === 0, 'a foe tick kills, and gives no ember');
}

function burstRules(sim) {
  const f = fightOf(sim, 'SKELETON');
  f.enemy.wardTurns = 2;
  f.hero.ember = 50;
  assert.equal(sim.canAfford(f.hero, 'BURST'), false, 'BURST lit below a full gauge');
  f.hero.ember = 100;
  f.hero.burn = { perTurn: 4, turns: 2 };
  Object.assign(f.battle, { rampStacks: 2, lastScope: 'SPELL', actionsTaken: 4, riposte: true });
  const d = sim.derive(f.hero);
  const r = sim.heroAct(f.hero, f.battle, 'BURST', seeded(sim, 3));
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].dmg, Math.round(2.5 * Math.max(d.atk, d.mag)), 'BURST ignores DEF and WARD');
  assert.ok(!r.weak && !r.crit, 'BURST carries no element or crit');
  assert.equal(f.hero.ember, 0, 'BURST empties the gauge');
  assert.equal(f.hero.burn, null, 'BURST cleanses BURN');
  assert.deepEqual([f.battle.rampStacks, f.battle.lastScope, f.battle.actionsTaken, f.battle.riposte], [2, 'SPELL', 4, true], 'BURST touched turn state');
}

function emberRules(sim) {
  const f = fightOf(sim, 'SLIME');
  f.hero.mp = 100;
  sim.learnSpell(f.hero, 'TWINBOLT');
  sim.learnSpell(f.hero, 'MEND');
  sim.heroAct(f.hero, f.battle, 'ATTACK', seeded(sim, 1));
  assert.equal(f.hero.ember, 6, 'ATTACK +6');
  sim.heroAct(f.hero, f.battle, 'TWINBOLT', seeded(sim, 1));
  assert.equal(f.hero.ember, 12, 'a multi-hit is +6 once');
  sim.heroAct(f.hero, f.battle, 'MEND', seeded(sim, 1));
  sim.heroAct(f.hero, f.battle, 'GUARD', seeded(sim, 1));
  assert.equal(f.hero.ember, 12, 'healing and guarding give no ember');
  sim.createBattle(sim.spawnEnemy('GOBLIN', 0, 0));
  assert.equal(f.hero.ember, 12, 'ember carries between fights');
}

function hitWith(sim, { id, spell, def }) {
  const f = fightOf(sim, id);
  if (def) {f.enemy.def = { ...f.enemy.def, ...def };}
  f.hero.mp = 100;
  sim.learnSpell(f.hero, spell);
  return sim.heroAct(f.hero, f.battle, spell, seeded(sim, 4));
}

function elementRules(sim) {
  const weak = hitWith(sim, { id: 'GUARDIAN', spell: 'TWINBOLT' });
  const plain = hitWith(sim, { id: 'GUARDIAN', spell: 'TWINBOLT', def: { weak: undefined } });
  assert.ok(weak.weak && !plain.weak);
  weak.hits.forEach((h, i) => { near(h.dmg, plain.hits[i].dmg * 1.5, `WEAK x1.5 on hit ${i}`); });
  const resisted = hitWith(sim, { id: 'WRAITH_LORD', spell: 'THUNDER' });
  const bare = hitWith(sim, { id: 'WRAITH_LORD', spell: 'THUNDER', def: { resists: undefined } });
  assert.ok(resisted.resisted);
  near(resisted.hits[0].dmg, bare.hits[0].dmg * 0.5, 'RESIST x0.5');
}

function breakWith(sim, { action, at = 1, maxHp }) {
  const f = fightOf(sim, 'GOBLIN', at);
  if (maxHp) {f.enemy.maxHp = maxHp; f.enemy.hp = maxHp;}
  f.hero.ember = 100;
  const r = sim.heroAct(f.hero, f.battle, action, seeded(sim, 2));
  return { ...f, r };
}

function breakRules(sim) {
  const broke = breakWith(sim, { action: 'FIREBALL' });
  assert.ok(broke.r.broke && broke.enemy.staggered, 'a weak hit on a shown HEAVY breaks it');
  const reply = sim.enemyAct(broke.hero, broke.battle, seeded(sim, 2));
  assert.ok(reply.staggered && reply.dmg === 0, 'the broken foe loses its turn');
  assert.equal(broke.enemy.cycleIndex, 2, 'the cycle steps past the HEAVY');
  assert.equal(breakWith(sim, { action: 'ATTACK' }).r.broke, false, 'a plain ATTACK broke');
  assert.equal(breakWith(sim, { action: 'FIREBALL', maxHp: 1000 }).r.broke, false, 'a break below BREAK_AT');
  assert.equal(breakWith(sim, { action: 'FIREBALL', at: 0 }).r.broke, false, 'a WINDUP broke');
  assert.equal(breakWith(sim, { action: 'BURST' }).r.broke, true, 'BURST did not break');
}

function potionRules(sim) {
  const f = fightOf(sim, 'SLIME');
  const maxHp = sim.derive(f.hero).maxHp;
  f.hero.hp = 10;
  const r = sim.heroAct(f.hero, f.battle, 'POTION', seeded(sim, 3));
  assert.equal(r.healed, Math.round(maxHp * 0.4), 'POTION heals 40 %');
  assert.equal(f.hero.potions, 1);
  sim.heroAct(f.hero, f.battle, 'POTION', seeded(sim, 3));
  const hp = f.hero.hp;
  assert.equal(sim.canAfford(f.hero, 'POTION'), false);
  sim.heroAct(f.hero, f.battle, 'POTION', seeded(sim, 3));
  assert.ok(f.hero.potions === 0 && f.hero.hp === hp, 'an empty POTION healed');
}

function resistsReadInstance(sim) {
  const hitAt = (resPhys) => {
    const f = fightOf(sim, 'SKELETON');
    f.enemy.resPhys = resPhys;
    return sim.heroAct(f.hero, f.battle, 'ATTACK', seeded(sim, 11)).hits[0].dmg;
  };
  assert.equal(fightOf(sim, 'SKELETON').enemy.resPhys, 30);
  assert.ok(hitAt(0) > hitAt(30), 'ATTACK ignored the instance resist');
}

export function verbRules(sim) {
  guardRules(sim);
  guardLeavesState(sim);
  parryRules(sim);
  burnRules(sim);
  burnTicks(sim);
  burstRules(sim);
  emberRules(sim);
  elementRules(sim);
  breakRules(sim);
  potionRules(sim);
  resistsReadInstance(sim);
  return 'GUARD x0.5/chain x0.75, MP and ember only when due, no regen; PARRY riposte x1.5; BURN 40 %/3, ticks kill (REVIVE answers); BURST 2.5x pierces; ember +6/+4/+15; WEAK/RESIST per hit; BREAK; POTION';
}
