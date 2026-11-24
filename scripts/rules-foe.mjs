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
