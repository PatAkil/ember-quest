import assert from 'node:assert/strict';
import { withSim } from '../sim/bundle.mjs';
import { foeRules } from './rules-foe.mjs';
import { itemRules } from './rules-items.mjs';
import { verbRules } from './rules-verbs.mjs';
import { eventRules } from './rules-events.mjs';

const MAP_SEEDS = 5000;
const RNG_DRAWS = 1000;

function reachableCount(stages) {
  let open = new Set(stages[0].map((_, i) => i));
  let count = open.size;
  for (let s = 1; s < stages.length; s++) {
    const next = new Set();
    for (const i of open) {
      for (const j of stages[s - 1][i].links) {next.add(j);}
    }
    assert.equal(next.size, stages[s].length, `stage ${s}: ${stages[s].length - next.size} node(s) unreachable`);
    count += next.size;
    open = next;
  }
  return count;
}

function checkMap(stages, seed) {
  const last = stages.at(-1);
  assert.equal(last.length, 1, `seed ${seed}: last stage must be one node`);
  assert.equal(last[0].type, 'BOSS', `seed ${seed}: last stage must be the BOSS`);
  stages.slice(0, -1).forEach((stage, s) => {
    stage.forEach((node, i) => { assert.ok(node.links.length > 0, `seed ${seed}: node ${s}.${i} has no link`); });
  });
  reachableCount(stages);
  const types = new Set(stages.flat().map((n) => n.type));
  for (const want of ['ELITE', 'REST', 'LOOT']) {assert.ok(types.has(want), `seed ${seed}: no ${want} room`);}
}

function mapInvariants(sim) {
  for (let seed = 0; seed < MAP_SEEDS; seed++) {
    checkMap(sim.generateMap(sim.createSeededRng(seed).next), seed);
  }
  return `${MAP_SEEDS} maps: every node reachable and linked, one BOSS last, ELITE + REST + LOOT present`;
}

const draws = (next, n) => Array.from({ length: n }, () => next());

function rngDeterminism(sim) {
  for (const seed of [0, 1, 7, 0x9e3779b9]) {
    assert.deepEqual(draws(sim.createSeededRng(seed).next, RNG_DRAWS), draws(sim.createSeededRng(seed).next, RNG_DRAWS), `seed ${seed}: streams differ`);
    const source = sim.createSeededRng(seed);
    draws(source.next, 137);
    const saved = source.getState();
    const ahead = draws(source.next, 50);
    source.setState(saved);
    assert.deepEqual(draws(source.next, 50), ahead, `seed ${seed}: getState/setState does not round-trip`);
  }
  return `same seed, same first ${RNG_DRAWS} numbers; getState/setState round-trips mid-stream`;
}

function dataValid(sim) {
  const bad = sim.validateData();
  assert.deepEqual(bad, [], `validateData: ${bad.join('; ')}`);
  return 'validateData() reports no violations';
}

const itemOf = (sim, id) => {
  const item = sim.ITEMS.find((i) => i.id === id);
  assert.ok(item, `no item ${id}`);
  return item;
};

function levelsTravel(sim) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 1);
  assert.ok(sim.stow(hero, { item: itemOf(sim, 'WILLOW_WAND'), level: 2 }));
  assert.ok(sim.swapIn(hero, 0));
  assert.equal(hero.equipment.WEAPON.id, 'WILLOW_WAND');
  assert.equal(hero.levels.WEAPON, 2, 'the incoming item keeps its level');
  assert.deepEqual(hero.pack.map((o) => [o.item.id, o.level]), [['IRON_SWORD', 1]], 'the outgoing item keeps its level');
  assert.ok(sim.unequip(hero, 'WEAPON'));
  assert.equal(hero.equipment.WEAPON, undefined);
  assert.deepEqual(hero.pack.map((o) => [o.item.id, o.level]), [['IRON_SWORD', 1], ['WILLOW_WAND', 2]], 'unequip stows with the level');
  const target = sim.upgradableTargets(hero).find((t) => t.where === 'PACK' && t.index === 0);
  assert.ok(target, 'a packed item is an upgrade target');
  sim.applyOffer(hero, sim.resolveUpgrade(hero, target), () => 0.5);
  assert.equal(hero.pack[0].level, 2, 'a PACK upgrade raises the packed item');
}

function packBounded(sim) {
  const hero = sim.createHero();
  const ids = ['RUSTY_BLADE', 'LEATHER_VEST', 'BONE_CHARM', 'WORN_SHOES', 'TIN_CUP', 'SPARK_TOME'];
  const stowed = ids.map((id) => sim.stow(hero, { item: itemOf(sim, id), level: 0 }));
  assert.equal(hero.pack.length, 4, 'stow stops at PACK_SIZE');
  assert.deepEqual(stowed, [true, true, true, true, false, false]);
  assert.equal(sim.packSize(hero), 4);
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 0);
  assert.equal(sim.unequip(hero, 'WEAPON'), false, 'unequip refuses with a full pack');
  assert.equal(hero.equipment.WEAPON.id, 'IRON_SWORD');
  for (let i = 0; i < 8; i++) {sim.swapIn(hero, i % 4);}
  assert.ok(hero.pack.length <= 4, 'swapping never grows the pack');
}

function reviveNotMinted(sim) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'PHOENIX_TEAR'), 0);
  hero.revived = true;
  assert.ok(sim.unequip(hero, 'NECKLACE'));
  assert.ok(sim.swapIn(hero, 0));
  assert.equal(hero.equipment.NECKLACE.id, 'PHOENIX_TEAR');
  assert.equal(hero.revived, true, 'a spent REVIVE stays spent through unequip and swapIn');
}

function packRules(sim) {
  levelsTravel(sim);
  packBounded(sim);
  reviveNotMinted(sim);
  return 'levels travel through swapIn/unequip/PACK upgrades; pack capped at 4; a spent REVIVE is not re-armed by swapping';
}

function compareRules(sim) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 1);
  const wand = itemOf(sim, 'WILLOW_WAND');
  const cmp = sim.compareFull(hero, wand, 0);
  assert.equal(cmp.kindChange, 'ATTACK NOW USES MAG');
  assert.equal(cmp.lose, itemOf(sim, 'IRON_SWORD').blurb);
  assert.equal(cmp.gain, wand.blurb);
  assert.deepEqual(cmp.rows.map((r) => [r.label, r.better]), [['ATK', false], ['MAG', true]]);
  const plate = sim.compareFull(hero, itemOf(sim, 'TITAN_PLATE'), 0);
  assert.equal(plate.lose, '', 'an empty slot loses nothing');
  assert.equal(plate.kindChange, '');
  assert.deepEqual(plate.rows.map((r) => r.label), ['HP', 'DEF'], 'rows follow the priority order');
  const full = sim.compareFull(sim.createHero(), itemOf(sim, 'BLOOD_CUP'), 0);
  assert.ok(full.rows.length <= 6, 'at most six rows');
  return 'compareFull: changed stats in priority order (max 6), LOSE/GAIN blurbs, weapon kind flip';
}

const level = (hero, slot) => hero.levels[slot] ?? 0;
const packIds = (hero) => hero.pack.map((o) => [o.item.id, o.level]);

function equipStowsOld(sim) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 2);
  const out = sim.applyOffer(hero, { kind: 'ITEM', item: itemOf(sim, 'WAR_CLEAVER') }, () => 0.5);
  assert.equal(hero.equipment.WEAPON.id, 'WAR_CLEAVER');
  assert.equal(level(hero, 'WEAPON'), 0);
  assert.deepEqual(packIds(hero), [['IRON_SWORD', 2]], 'EQUIP sends the old item to the pack with its level');
  assert.equal(out.stowed, false);
  assert.equal(out.replaced.item.id, 'IRON_SWORD');
  assert.equal(out.overflow, undefined);
}

function stowKeepsWorn(sim) {
  const hero = sim.createHero();
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 1);
  const out = sim.applyOffer(hero, { kind: 'ITEM', item: itemOf(sim, 'WAR_CLEAVER') }, () => 0.5, { stow: true });
  assert.equal(hero.equipment.WEAPON.id, 'IRON_SWORD', 'STOW leaves the worn item');
  assert.equal(level(hero, 'WEAPON'), 1, 'STOW leaves the worn level');
  assert.deepEqual(packIds(hero), [['WAR_CLEAVER', 0]]);
  assert.equal(out.stowed, true);
  const empty = sim.createHero();
  sim.applyOffer(empty, { kind: 'ITEM', item: itemOf(sim, 'WAR_CLEAVER') }, () => 0.5, { stow: true });
  assert.equal(empty.equipment.WEAPON.id, 'WAR_CLEAVER', 'an empty slot always equips');
  assert.equal(empty.pack.length, 0);
}

function fullPackHero(sim) {
  const hero = sim.createHero();
  for (const id of ['LEATHER_VEST', 'BONE_CHARM', 'WORN_SHOES', 'TIN_CUP']) {sim.stow(hero, { item: itemOf(sim, id), level: 1 });}
  return hero;
}

function overflowResolves(sim) {
  const hero = fullPackHero(sim);
  sim.equip(hero, itemOf(sim, 'IRON_SWORD'), 1);
  const out = sim.applyOffer(hero, { kind: 'ITEM', item: itemOf(sim, 'WAR_CLEAVER') }, () => 0.5);
  assert.equal(hero.equipment.WEAPON.id, 'WAR_CLEAVER', 'the equip happens even when the pack is full');
  assert.equal(out.overflow.item.id, 'IRON_SWORD', 'the replaced item is returned as overflow');
  assert.equal(hero.pack.length, 4, 'nothing is dropped silently');
  const dropped = sim.resolveOverflow(hero, out.overflow, 1);
  assert.equal(dropped.item.id, 'BONE_CHARM');
  assert.ok(hero.pack.length <= sim.packSize(hero));
  assert.ok(hero.pack.some((o) => o.item.id === 'IRON_SWORD' && o.level === 1), 'the entering item keeps its level');
  const stowHero = fullPackHero(sim);
  sim.equip(stowHero, itemOf(sim, 'IRON_SWORD'), 0);
  const stowed = sim.applyOffer(stowHero, { kind: 'ITEM', item: itemOf(sim, 'WAR_CLEAVER') }, () => 0.5, { stow: true });
  assert.equal(stowed.overflow.item.id, 'WAR_CLEAVER');
  assert.equal(sim.resolveOverflow(stowHero, stowed.overflow, 4).item.id, 'WAR_CLEAVER', 'dropping the newcomer');
  assert.equal(stowHero.pack.length, 4);
  assert.equal(stowHero.equipment.WEAPON.id, 'IRON_SWORD');
}

function offerRules(sim) {
  equipStowsOld(sim);
  stowKeepsWorn(sim);
  overflowResolves(sim);
  return 'EQUIP packs the old item with its level; STOW leaves worn gear; a full pack returns overflow and resolveOverflow keeps it at 4';
}

const SOURCES = ['FIGHT', 'ELITE', 'LOOT', 'BOSS'];
const LOOT_ROLLS = 2000;

function rollAll(sim, makeHero, check) {
  const rng = sim.createSeededRng(11).next;
  for (let n = 0; n < LOOT_ROLLS; n++) {
    const hero = makeHero();
    const source = SOURCES[n % SOURCES.length];
    const act = Math.floor(n / SOURCES.length) % 4;
    check(hero, sim.rollLoot(source, act, hero, rng), `${source} act ${act}`);
  }
}

function heavyHero(sim) {
  const hero = sim.createHero();
  for (const id of ['DARK_CROWN', 'YETI_HIDE', 'GOLEM_FIST', 'SOULEATER']) {sim.stow(hero, { item: itemOf(sim, id), level: 0 });}
  for (const id of ['IRON_SWORD', 'LEATHER_VEST', 'WORN_SHOES']) {sim.equip(hero, itemOf(sim, id), 0);}
  return hero;
}

function lootRules(sim) {
  let anyUpgrade = 0;
  rollAll(sim, () => heavyHero(sim), (hero, offers, where) => {
    const owned = new Set(sim.ownedIds(hero));
    assert.ok(offers.length <= 4, `${where}: ${offers.length} offers`);
    for (const o of offers) {
      assert.ok(!(o.kind === 'ITEM' && owned.has(o.item.id)), `${where}: owned ${o.kind === 'ITEM' ? o.item.id : ''} re-rolled`);
      assert.notEqual(o.kind, 'UPGRADE', `${where}: a resolved UPGRADE was rolled`);
      if (o.kind === 'UPGRADE_ANY') {anyUpgrade++;}
    }
  });
  assert.ok(anyUpgrade > 0, 'an upgradable hero is offered UPGRADE_ANY');
  rollAll(sim, () => sim.createHero(), (_hero, offers, where) => {
    assert.ok(offers.every((o) => o.kind !== 'UPGRADE_ANY' && o.kind !== 'UPGRADE'), `${where}: upgrade with nothing to upgrade`);
  });
  return `${LOOT_ROLLS} rolls with a full pack: no owned id re-rolled, <= 4 offers, UPGRADE_ANY only when something is upgradable`;
}

function starterRules(sim) {
  rollAll(sim, () => sim.createHero(), (_hero, offers, where) => {
    const items = offers.filter((o) => o.kind === 'ITEM');
    if (items.length === 0) {return;}
    assert.ok(items.some((o) => o.item.slot === 'WEAPON'), `${where}: an unarmed hero got no weapon`);
  });
  return `${LOOT_ROLLS} unarmed rolls: every roll with an item offers a weapon`;
}

const POOLS = { normals: ['N1', 'N2', 'N3'], elites: ['E1', 'E2'] };
const shapeOf = (stages) => stages.map((st) => st.map((n) => `${n.type}:${n.links.join('.')}`).join(' ')).join(' | ');

function scoutRules(sim) {
  for (let seed = 0; seed < MAP_SEEDS; seed++) {
    const bare = sim.generateMap(sim.createSeededRng(seed).next);
    const scouted = sim.generateMap(sim.createSeededRng(seed).next, {}, POOLS);
    assert.equal(shapeOf(scouted), shapeOf(bare), `seed ${seed}: pools changed the map shape`);
    assert.ok(bare.flat().every((n) => n.enemyId === undefined), `seed ${seed}: a foe was rolled without pools`);
    for (const n of scouted.flat()) {
      if (n.type === 'FIGHT') {assert.ok(POOLS.normals.includes(n.enemyId), `seed ${seed}: FIGHT foe ${n.enemyId}`);}
      if (n.type === 'ELITE') {assert.ok(POOLS.elites.includes(n.enemyId), `seed ${seed}: ELITE foe ${n.enemyId}`);}
    }
  }
  return `${MAP_SEEDS} maps: every FIGHT/ELITE scouted from its pool, shape identical to the unscouted map`;
}

const GROUPS = [
  ['map', mapInvariants],
  ['rng', rngDeterminism],
  ['data', dataValid],
  ['pack', packRules],
  ['compare', compareRules],
  ['offer', offerRules],
  ['loot', lootRules],
  ['starter', starterRules],
  ['scout', scoutRules],
  ['foes', foeRules],
  ['verbs', verbRules],
  ['items', itemRules],
  ['events', eventRules],
];

await withSim((sim) => {
  let failed = 0;
  for (const [name, check] of GROUPS) {
    try {
      console.log(`PASS  ${name.padEnd(7)} ${check(sim)}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name.padEnd(7)} ${e.message}`);
    }
  }
  if (failed) {process.exitCode = 1;}
});
