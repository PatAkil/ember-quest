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
