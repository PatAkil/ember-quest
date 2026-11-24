import assert from 'node:assert/strict';
import { withSim } from '../sim/bundle.mjs';

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

const GROUPS = [
  ['map', mapInvariants],
  ['rng', rngDeterminism],
  ['data', dataValid],
];

await withSim((sim) => {
  let failed = 0;
  for (const [name, check] of GROUPS) {
    try {
      console.log(`PASS  ${name.padEnd(6)} ${check(sim)}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name.padEnd(6)} ${e.message}`);
    }
  }
  if (failed) {process.exitCode = 1;}
});
