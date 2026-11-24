import assert from 'node:assert/strict';

export const ENEMY_IDS = [
  'SLIME', 'GOBLIN', 'SKELETON', 'OGRE_KING', 'WRAITH_LORD', 'DARK_LORD',
  'ICE_WOLF', 'ICE_BEAR', 'FROST_WISP', 'YETI',
  'SANDWORM', 'SCORPION', 'MUMMY', 'SAND_GOLEM',
  'GUARDIAN', 'ORACLE', 'PALADIN', 'SERAPH',
];

export function fightOf(sim, id, cycleIndex = 0) {
  const hero = sim.createHero();
  const enemy = sim.spawnEnemy(id, { n: 0, clears: 0, descentClears: null });
  enemy.cycleIndex = cycleIndex;
  return { hero, enemy, battle: sim.createBattle(enemy) };
}

export const seeded = (sim, seed) => sim.createSeededRng(seed).next;

function playCycle(sim, id, seed) {
  const f = fightOf(sim, id);
  f.hero.hp = 100000;
  f.enemy.maxHp = 1000;
  f.enemy.hp = 1000;
  const rng = seeded(sim, seed);
  const intents = [];
  for (let t = 0; t < 40; t++) {
    if (t === 12) {f.enemy.hp = 400;}
    sim.heroAct(f.hero, f.battle, 'ATTACK', rng);
    const shown = f.battle.intent;
    intents.push(shown);
    const r = sim.enemyAct(f.hero, f.battle, rng);
    assert.equal(r.move, shown, `${id} turn ${t}: showed ${shown}, did ${r.move}`);
    if (shown === 'WINDUP') {assert.equal(f.battle.intent, 'HEAVY', `${id} turn ${t}: WINDUP not followed by HEAVY`);}
  }
  if (f.enemy.def.kind === 'BOSS') {assert.equal(f.enemy.phase, 2, `${id}: never reached phase 2`);}
  return intents.join(',');
}

function telegraph(sim) {
  for (const id of ENEMY_IDS) {
    assert.equal(playCycle(sim, id, 5), playCycle(sim, id, 99), `${id}: intents depend on the rng`);
  }
}

function phaseSwitch(sim) {
  const f = fightOf(sim, 'DARK_LORD', 2);
  f.hero.hp = 100000;
  const atk = f.enemy.atk;
  const phase2 = f.enemy.def.phase2;
  f.enemy.hp = Math.floor(f.enemy.maxHp * 0.4);
  const windup = sim.enemyAct(f.hero, f.battle, seeded(sim, 1));
  assert.ok(windup.phaseChanged && windup.move === 'WINDUP', 'the shown WINDUP resolves on the switch');
  assert.equal(f.enemy.atk, Math.round(atk * phase2.atkMult), 'ATK x atkMult on the switch');
  assert.equal(f.battle.intent, 'HEAVY', "a WINDUP's HEAVY still follows the switch");
  const heavy = sim.enemyAct(f.hero, f.battle, seeded(sim, 1));
  assert.ok(heavy.move === 'HEAVY' && !heavy.phaseChanged);
  assert.equal(f.battle.intent, phase2.moves[0], 'then the phase-2 cycle at 0');
  const broken = fightOf(sim, 'DARK_LORD', 3);
  broken.enemy.hp = Math.floor(broken.enemy.maxHp * 0.4);
  broken.enemy.staggered = true;
  const r = sim.enemyAct(broken.hero, broken.battle, seeded(sim, 1));
  assert.ok(r.staggered && r.phaseChanged && r.dmg === 0, 'a broken HEAVY does not resolve on the switch');
  assert.equal(broken.battle.intent, phase2.moves[0]);
  const yeti = fightOf(sim, 'YETI');
  yeti.enemy.mended = true;
  yeti.enemy.hp = 1;
  sim.enemyAct(yeti.hero, yeti.battle, seeded(sim, 1));
  assert.equal(yeti.enemy.mended, false, 'MEND re-armed in phase 2');
}

function wardRules(sim) {
  const f = fightOf(sim, 'SKELETON', 1);
  assert.equal(f.battle.intent, 'WARD');
  assert.ok(sim.enemyAct(f.hero, f.battle, seeded(sim, 1)).warded);
  assert.equal(sim.resistOf(f.enemy, 'PHYSICAL'), 55, 'WARD = instance + 25');
  assert.equal(f.enemy.resPhys, 30, 'WARD written into the instance');
  sim.heroAct(f.hero, f.battle, 'GUARD', seeded(sim, 1));
  assert.equal(sim.resistOf(f.enemy, 'PHYSICAL'), 55, 'GUARD spends one of the two warded actions');
  sim.heroAct(f.hero, f.battle, 'ATTACK', seeded(sim, 1));
  assert.equal(sim.resistOf(f.enemy, 'PHYSICAL'), 30, 'WARD lasts two hero actions');
  f.enemy.wardTurns = 1;
  f.enemy.cycleIndex = 1;
  f.battle.intent = 'WARD';
  sim.enemyAct(f.hero, f.battle, seeded(sim, 1));
  assert.equal(f.enemy.wardTurns, 2, 'a WARD refreshes, never stacks');
  f.enemy.resPhys = 40;
  assert.equal(sim.resistOf(f.enemy, 'PHYSICAL'), 60, 'WARD capped at 60');
}

function mendRules(sim) {
  const f = fightOf(sim, 'SLIME', 3);
  f.enemy.hp = f.enemy.maxHp - 20;
  f.battle.intent = 'MEND';
  const r = sim.enemyAct(f.hero, f.battle, seeded(sim, 1));
  assert.equal(r.healed, Math.min(20, Math.round(f.enemy.maxHp * 0.1)), 'MEND heals 10 %');
  for (let i = 0; i < 3; i++) {sim.enemyAct(f.hero, f.battle, seeded(sim, 1));}
  assert.equal(f.battle.intent, 'STRIKE', 'a spent MEND reads as STRIKE');
  assert.equal(sim.enemyAct(f.hero, f.battle, seeded(sim, 1)).move, 'STRIKE', 'and acts as STRIKE');
}

function withMoves(def, moves, body) {
  const saved = def.moves;
  def.moves = moves;
  try { return body(); } finally { def.moves = saved; }
}

function validateCycles(sim) {
  const goblin = sim.spawnEnemy('GOBLIN', { n: 0, clears: 0, descentClears: null }).def;
  const fails = (moves) => withMoves(goblin, moves, () => sim.validateData().some((m) => m.startsWith('GOBLIN')));
  assert.ok(fails(['STRIKE', 'WINDUP']), 'a WINDUP at the end passed');
  assert.ok(fails(['HEAVY', 'STRIKE']), 'a HEAVY without a WINDUP passed');
  assert.ok(fails(['STRIKE', 'WARD', 'MEND', 'SCORCH']), 'a NORMAL with 3 extra moves passed');
  assert.ok(fails([]), 'an empty cycle passed');
  assert.ok(!fails(['WINDUP', 'HEAVY', 'STRIKE']), 'a legal cycle failed');
  const boss = sim.spawnEnemy('YETI', { n: 0, clears: 0, descentClears: null }).def;
  const phase2 = boss.phase2;
  boss.phase2 = { ...phase2, moves: ['HEAVY', 'STRIKE'] };
  const heavyFirst = sim.validateData().some((m) => m.startsWith('YETI'));
  boss.phase2 = phase2;
  assert.ok(heavyFirst, 'phase2 opening with HEAVY passed');
}

export function foeRules(sim) {
  telegraph(sim);
  phaseSwitch(sim);
  wardRules(sim);
  mendRules(sim);
  validateCycles(sim);
  return '18 cycles: shown move always resolves, WINDUP->HEAVY, intents rng-free; phase switch keeps the shown move (and its HEAVY); WARD +25 cap 60 for 2 actions; MEND once; cycle rules validated';
}

const clone = (f) => {
  const copy = structuredClone({ hero: f.hero, battle: f.battle });
  return { hero: copy.hero, battle: copy.battle, enemy: copy.battle.enemy };
};

function potionBeforeTick(sim) {
  const f = fightOf(sim, 'SLIME');
  f.enemy.hp = f.enemy.maxHp = 1000;
  Object.assign(f.hero, { hp: 5, burn: { perTurn: 8, turns: 3 } });
  const t = sim.resolveTurn(f.hero, f.battle, 'POTION', 11);
  assert.ok(t.hero.healed > 0 && t.hero.burnTick === 8 && !t.hero.heroDead, 'a POTION at 5 HP must land before the burn tick');
  return 'a POTION at 5 HP lands before an 8 tick';
}

function guardedHeavyThenTick(sim) {
  const f = fightOf(sim, 'GOBLIN', 1);
  f.enemy.hp = f.enemy.maxHp = 1000;
  f.enemy.atk = 16;
  Object.assign(f.hero, { hp: 36, burn: { perTurn: 8, turns: 3 } });
  const t = sim.resolveTurn(f.hero, f.battle, 'GUARD', 5);
  assert.equal(t.hero.burnTick, 8, 'the hero tick follows his GUARD');
  assert.ok(t.enemy?.parried && t.outcome === null && f.hero.hp > 0, `a guarded HEAVY at 36 HP and an 8 tick killed: ${JSON.stringify(t.enemy)}`);
  assert.ok(t.enemy.text.startsWith('PARRIED! THE BLOW ONLY GRAZES YOU FOR') && t.enemy.text.length <= 52, `parry line: ${t.enemy.text}`);
  return 'a guarded HEAVY (33 raw) at 36 HP with an 8 tick is survived';
}

function foeTicksAfterItsAction(sim) {
  const f = fightOf(sim, 'SLIME', 3);
  f.enemy.maxHp = 1000;
  f.enemy.hp = 500;
  f.enemy.burn = { perTurn: 10, turns: 1 };
  f.hero.hp = 1000;
  f.battle.intent = 'MEND';
  const r = sim.enemyAct(f.hero, f.battle, () => 0.5);
  assert.ok(r.move === 'MEND' && r.healed === 100 && r.burnTick === 10 && f.enemy.hp === 590, 'the foe ticks after its own action');
  assert.equal(r.burnText, 'SLIME BURNS FOR 10');
  return 'the foe ticks after its own action';
}

function lastTurn(sim, f, seed, actions) {
  let t = null;
  for (const action of actions) {t = sim.resolveTurn(f.hero, f.battle, action, seed);}
  return t;
}

function boss(sim) {
  const f = fightOf(sim, 'SERAPH');
  f.enemy.hp = f.enemy.maxHp = 100000;
  f.hero.hp = 100000;
  f.hero.mp = 100;
  return f;
}

function foeRollsIgnoreTheHero(sim) {
  let compared = 0;
  for (let seed = 0; seed < 500; seed++) {
    const base = boss(sim);
    lastTurn(sim, base, seed, ['ATTACK', 'ATTACK']);
    const a = clone(base);
    const b = clone(base);
    const ra = sim.resolveTurn(a.hero, a.battle, 'ATTACK', seed);
    const rb = sim.resolveTurn(b.hero, b.battle, 'POTION', seed);
    assert.equal(ra.turn, rb.turn);
    if (!ra.enemy || !rb.enemy || ra.enemy.move !== rb.enemy.move) {continue;}
    compared += 1;
    assert.deepEqual([ra.enemy.dodged, ra.enemy.dmg], [rb.enemy.dodged, rb.enemy.dmg], `seed ${seed}: the foe's roll changed with the hero's action`);
    const again = clone(base);
    assert.deepEqual(sim.resolveTurn(again.hero, again.battle, 'ATTACK', seed), ra, `seed ${seed}: the same turn resolved twice differs`);
  }
  assert.ok(compared > 400, `only ${compared} comparable turns`);
  return `${compared} seeds: the foe's turn-N roll is the same whatever the hero chose; the same turn resolved twice from a copy is identical`;
}

function streamsDiffer(sim) {
  const hero = sim.turnRng(7, 3, 'HERO');
  const foe = sim.turnRng(7, 3, 'FOE');
  const next = sim.turnRng(7, 4, 'FOE');
  const a = [hero(), hero()];
  const b = [foe(), foe()];
  const c = [next(), next()];
  assert.notDeepEqual(a, b, 'hero and foe share a stream');
  assert.notDeepEqual(b, c, 'two turns share a stream');
  assert.equal(sim.turnSeed(7, 3, 'FOE'), sim.turnSeed(7, 3, 'FOE'));
}

function enrageOnThirteenth(sim) {
  const f = fightOf(sim, 'GOBLIN');
  f.enemy.hp = f.enemy.maxHp = 1000;
  f.enemy.atk = 1;
  f.hero.hp = 100000;
  let first = 0;
  for (let action = 1; action <= 20 && first === 0; action++) {
    const t = sim.resolveTurn(f.hero, f.battle, 'GUARD', 3);
    if (t.enemy?.enraged) {
      first = action;
      assert.equal(t.enemy.aside, sim.ENRAGE_LINE);
    }
  }
  assert.equal(first, sim.ENRAGE_AFTER + 1, `the calm foe first enraged on action ${first}`);
  return `the calm foe enrages exactly on its ${first}th calm action (with the IMPATIENT line)`;
}

function watchWeapons(sim, base) {
  const seen = { offered: false, unarmedBoss: 0 };
  const policy = {
    ...base,
    pick: (hero, offers, n) => {
      if (offers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON')) {seen.offered = true;}
      return base.pick(hero, offers, n);
    },
    prepare: (hero, foe) => {
      if (foe.kind === 'BOSS' && foe.id === 'DARK_LORD' && !seen.offered) {seen.unarmedBoss += 1;}
      base.prepare(hero, foe);
    },
  };
  return { seen, policy };
}

function starterWeaponReached(sim) {
  const runs = 2000;
  let never = 0;
  for (const name of ['balanced', 'random']) {
    const rng = sim.createSeededRng(17).next;
    for (let i = 0; i < runs; i++) {
      const { seen, policy } = watchWeapons(sim, sim.POLICIES[name]);
      sim.simulateRun(policy, rng);
      never += seen.unarmedBoss;
    }
  }
  assert.equal(never, 0, `${never} runs reached the act-1 boss never offered a weapon`);
  const hero = sim.createHero();
  const ref = { n: 0, plan: sim.planOf(sim.planDepth(1, () => 0), 0) };
  for (let seed = 0; seed < 200; seed++) {
    const offers = sim.rollLoot('FIGHT', ref, hero, sim.createSeededRng(seed).next);
    assert.ok(offers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON'), `seed ${seed}: an unarmed hero's fight dropped no weapon`);
  }
  return `${runs * 2} runs (balanced + random): every hero is offered a weapon before the act-1 boss; an unarmed hero's FIGHT always drops one`;
}

function packedWeaponCounts(sim) {
  const ref = { n: 0, plan: sim.planOf(sim.planDepth(1, () => 0), 0) };
  const worn = sim.createHero();
  const packed = sim.createHero();
  const sword = sim.ITEMS.find((i) => i.id === 'IRON_SWORD');
  sim.equip(worn, sword, 0);
  sim.stow(packed, { item: sword, level: 0 });
  for (let seed = 0; seed < 300; seed++) {
    const a = sim.rollLoot('LOOT', ref, worn, sim.createSeededRng(seed).next);
    const b = sim.rollLoot('LOOT', ref, packed, sim.createSeededRng(seed).next);
    assert.deepEqual(b, a, `seed ${seed}: unequipping the weapon changed the chest`);
  }
  return 'a packed weapon counts like a worn one (300 chests identical)';
}

export function turnRules(sim) {
  streamsDiffer(sim);
  return [
    potionBeforeTick(sim), guardedHeavyThenTick(sim), foeTicksAfterItsAction(sim),
    foeRollsIgnoreTheHero(sim), enrageOnThirteenth(sim), starterWeaponReached(sim), packedWeaponCounts(sim),
  ].join('; ');
}
