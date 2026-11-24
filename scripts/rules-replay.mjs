import assert from 'node:assert/strict';
import { liveRun } from './rules-save.mjs';

const CASES = [
  { id: 'GOBLIN', depth: 1, affixes: [] },
  { id: 'OGRE_KING', depth: 2, affixes: ['THORNED', 'VAMPIRIC', 'SWIFT'] },
  { id: 'SLIME', depth: 2, affixes: ['SEARING', 'ARMORED', 'WARDED'] },
  { id: 'DARK_LORD', depth: 1, affixes: [], phase: true },
  { id: 'HOLLOW', depth: 2, affixes: [] },
];
const SCRIPT = ['ATTACK', 'FIREBALL', 'GUARD', 'ATTACK', 'POTION', 'BURST', 'ATTACK', 'FIREBALL'];
const SEEDS = [1, 7, 42, 1009, 65537, 3141592653];
const RELOAD_AT = 3;
const TURNS = 30;

function scaleOf(snapshot, hero) {
  const { n, clears, descentClears } = snapshot.run;
  return { n, clears, descentClears, hero };
}

function openFight(sim, kase, seed) {
  const { snapshot } = liveRun(sim, kase.depth);
  const hero = snapshot.hero;
  hero.bonusMaxHp = 900;
  hero.hp = sim.derive(hero).maxHp;
  const enemy = sim.spawnFoe(kase.id, { ...scaleOf(snapshot, hero), affixes: kase.affixes });
  if (kase.phase) {enemy.hp = Math.ceil(enemy.maxHp * 0.56);}
  return { snapshot, hero, battle: sim.createBattle(enemy), roomSeed: seed, waits: kase.phase === true };
}

const chosen = (sim, f, turn) => {
  if (f.waits && turn < RELOAD_AT) {return 'GUARD';}
  const want = SCRIPT[turn % SCRIPT.length];
  return sim.canAfford(f.hero, want) ? want : 'ATTACK';
};

function play(sim, f, from, to) {
  const turns = [];
  for (let t = from; t < to; t++) {
    const r = sim.resolveTurn(f.hero, f.battle, chosen(sim, f, t), f.roomSeed);
    turns.push(r);
    if (r.outcome) {break;}
  }
  return turns;
}

function savedFight(f) {
  const { def, ...foe } = f.battle.enemy;
  const state = Object.fromEntries(Object.entries(f.battle).filter(([key]) => key !== 'enemy'));
  const battle = { roomSeed: f.roomSeed, foe: { ...foe, id: def.id }, state };
  return { ...f.snapshot, hero: f.hero, step: { ...f.snapshot.step, roomSeed: f.roomSeed, battle } };
}

function reloaded(sim, f) {
  const saved = sim.loadRun(JSON.stringify(sim.toSaved(savedFight(f))));
  assert.ok(saved, `${f.battle.enemy.def.id}: the mid-battle save was rejected`);
  const back = sim.fromSaved(saved);
  const { roomSeed, foe, state } = back.step.battle;
  const { id, ...fields } = foe;
  const enemy = { ...sim.spawnFoe(id, { ...scaleOf(back, back.hero), affixes: fields.affixes }), ...fields };
  return { snapshot: back, hero: back.hero, battle: { ...state, enemy }, roomSeed, waits: f.waits };
}

function replayCase(sim, kase, seed) {
  const live = openFight(sim, kase, seed);
  const before = play(sim, live, 0, RELOAD_AT);
  if (before.some((r) => r.outcome)) {return null;}
  const copy = reloaded(sim, live);
  const straight = play(sim, live, RELOAD_AT, TURNS);
  const resumed = play(sim, copy, RELOAD_AT, TURNS);
  const where = `${kase.id} seed ${String(seed)}`;
  assert.deepEqual(resumed, straight, `${where}: the reloaded fight diverged`);
  assert.deepEqual([copy.hero.hp, copy.battle.enemy.hp], [live.hero.hp, live.battle.enemy.hp], `${where}: end state differs`);
  return straight;
}

export function replayRules(sim) {
  let fights = 0;
  let turns = 0;
  let phased = 0;
  for (const kase of CASES) {
    for (const seed of SEEDS) {
      const after = replayCase(sim, kase, seed);
      if (!after) {continue;}
      fights += 1;
      turns += after.length;
      if (kase.phase && after.some((r) => r.enemy?.phaseChanged)) {phased += 1;}
    }
  }
  assert.ok(fights >= CASES.length * SEEDS.length - 2, `only ${String(fights)} fights reached the reload`);
  assert.ok(phased > 0, 'no boss switched phase after the reload');
  return `${String(fights)} fights (plain, THORNED/VAMPIRIC/SWIFT, SEARING, a DARK LORD phase switch, THE HOLLOW) saved mid-battle through toSaved -> JSON -> loadRun -> fromSaved: ${String(turns)} later turns identical to the uninterrupted fight (${String(phased)} phase switches after the reload)`;
}

const SPELL_IDS = ['FIREBALL', 'WATER', 'SLASH', 'THUNDER', 'TWINBOLT', 'LEECH', 'QUAKE', 'MEND', 'EMBERS', 'TREMOR', 'AEGIS'];
const FOES = ['SLIME', 'GOBLIN', 'SKELETON', 'OGRE_KING', 'WRAITH_LORD', 'DARK_LORD', 'ICE_WOLF', 'ICE_BEAR', 'FROST_WISP', 'YETI', 'SANDWORM', 'SCORPION', 'MUMMY', 'SAND_GOLEM', 'GUARDIAN', 'ORACLE', 'PALADIN', 'SERAPH'];
const FIGHTS = 3000;
const HALF = () => 0.5;

const pickOf = (list, rng) => list[Math.floor(rng() * list.length)];
const intBelow = (n, rng) => Math.floor(rng() * n);

function randomHero(sim, rng) {
  const hero = sim.createHero();
  for (let i = intBelow(5, rng); i > 0; i--) {sim.equip(hero, pickOf(sim.ITEMS, rng), intBelow(3, rng));}
  for (const id of SPELL_IDS) {if (rng() < 0.4) {sim.learnSpell(hero, id);}}
  hero.sp = intBelow(12, rng);
  for (let i = hero.sp; i > 0; i--) {sim.spendPoint(hero, pickOf(['HP', 'ATK', 'MAG', 'DEF', 'MDEF', 'CRIT'], rng));}
  const d = sim.derive(hero);
  hero.hp = 1 + intBelow(d.maxHp, rng);
  hero.mp = d.maxMp;
  hero.ember = rng() < 0.3 ? 100 : 0;
  return hero;
}

function randomFoe(sim, rng) {
  const affixes = sim.AFFIX_IDS.filter(() => rng() < 0.2);
  const enemy = sim.spawnEnemy(pickOf(FOES, rng), { n: intBelow(12, rng), clears: intBelow(10, rng), descentClears: null }, affixes);
  enemy.hp = 1 + intBelow(enemy.maxHp, rng);
  const phase2 = enemy.def.phase2;
  if (phase2 && enemy.hp <= phase2.at * enemy.maxHp) {enemy.phase = 2;}
  enemy.cycleIndex = intBelow(enemy.phase === 2 && phase2 ? phase2.moves.length : enemy.def.moves.length, rng);
  enemy.wardTurns = rng() < 0.25 ? 2 : 0;
  return enemy;
}

function randomFight(sim, rng) {
  const hero = randomHero(sim, rng);
  const battle = sim.createBattle(randomFoe(sim, rng));
  Object.assign(battle, { riposte: rng() < 0.3, actionsTaken: intBelow(3, rng), rampStacks: intBelow(4, rng), guardChain: intBelow(3, rng) });
  return { hero, battle };
}

const total = (r) => r.hits.reduce((s, h) => s + h.dmg, 0);
const copy = (f) => structuredClone(f);

function heroCheck(sim, fight, action, rng) {
  const est = sim.expectedHeroDamage(fight.hero, fight.battle, action);
  assert.ok(Number.isFinite(est) && est >= 0, `${action}: estimate ${est}`);
  const exact = copy(fight);
  const plain = sim.heroAct(exact.hero, exact.battle, action, HALF);
  if (!plain.crit && !plain.missed) {assert.equal(total(plain), est, `${action} vs ${fight.battle.enemy.def.id}: no variance, estimate ${est} but dealt ${total(plain)}`);}
  const rolled = copy(fight);
  const d = sim.derive(rolled.hero);
  const r = sim.heroAct(rolled.hero, rolled.battle, action, rng);
  if (r.missed) {return 0;}
  const top = r.crit ? est * 1.1 * d.critMult : est * 1.1;
  const slack = Math.max(1, r.hits.length);
  assert.ok(total(r) >= Math.floor(est * 0.9) - slack && total(r) <= Math.ceil(top) + slack, `${action} vs ${fight.battle.enemy.def.id}: dealt ${total(r)} outside the band of ${est}`);
  return 1;
}

function foeActual(sim, fight, guard, rng) {
  const f = copy(fight);
  if (guard) {sim.heroAct(f.hero, f.battle, 'GUARD', HALF);}
  return sim.enemyAct(f.hero, f.battle, rng);
}

function foeCheck(sim, fight, rng) {
  const est = sim.expectedFoeDamage(fight.hero, fight.battle);
  assert.ok(est.guarded <= est.unguarded, `guarded ${est.guarded} above unguarded ${est.unguarded}`);
  for (const [guard, want] of [[false, est.unguarded], [true, est.guarded]]) {
    const plain = foeActual(sim, fight, guard, HALF);
    if (!plain.dodged) {assert.equal(plain.dmg, want, `${fight.battle.enemy.def.id} ${plain.move} guard=${guard}: estimate ${want} but dealt ${plain.dmg}`);}
    const r = foeActual(sim, fight, guard, rng);
    if (!r.dodged) {assert.ok(r.dmg >= Math.floor(want * 0.9) - 1 && r.dmg <= Math.ceil(want * 1.1) + 1, `${r.move} guard=${guard}: dealt ${r.dmg} outside the band of ${want}`);}
  }
}

function heavyParry(sim) {
  const hero = sim.createHero();
  const enemy = sim.spawnEnemy('GOBLIN', { n: 0, clears: 0, descentClears: null });
  enemy.cycleIndex = 1;
  const battle = sim.createBattle(enemy);
  battle.guardChain = 2;
  enemy.atk = 100;
  const est = sim.expectedFoeDamage(hero, battle);
  assert.equal(battle.intent, 'HEAVY');
  assert.ok(Math.abs(est.guarded - est.unguarded * 0.5) <= 1, `a guarded HEAVY is halved even on a chain: ${est.guarded} vs ${est.unguarded}`);
  battle.enemy.staggered = true;
  assert.deepEqual(sim.expectedFoeDamage(hero, battle), { unguarded: 0, guarded: 0 }, 'a staggered foe shows no damage');
}

export function estimateRules(sim) {
  const rng = sim.createSeededRng(41).next;
  let rolls = 0;
  for (let i = 0; i < FIGHTS; i++) {
    const fight = randomFight(sim, rng);
    for (const action of [...sim.heroActions(fight.hero), 'BURST', 'GUARD']) {
      if (action !== 'BURST' || fight.hero.ember >= 100) {rolls += heroCheck(sim, fight, action, rng);}
    }
    foeCheck(sim, fight, rng);
  }
  heavyParry(sim);
  return `${FIGHTS} random fights: expectedHeroDamage equals the hit without variance and brackets ${rolls} real rolls; expectedFoeDamage open/guarded likewise, a parried HEAVY halved`;
}
