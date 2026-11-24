import type { Biome, Rng } from '../types';
import { BIOMES } from '../data';
import { createHero } from './hero';
import { generateMap, type MapNode } from './map';
import type { Policy, RoomType } from './model';
import { withPolicyContext } from './policies';
import { bossRoom, playRoom } from './run-rooms';
import { finish, newTally, type Ending, type RunResult, type RunState } from './run-tally';
import { clamp } from './util';

export type { BossPick, Probe, RunResult } from './run-tally';

function routeIndex(policy: Policy, offered: RoomType[]): number {
  return clamp(Math.floor(policy.route(offered)), 0, offered.length - 1);
}

function routeNext(node: MapNode, next: MapNode[], policy: Policy): MapNode | undefined {
  const links = node.links.length > 0 ? node.links : [0];
  const options = links.flatMap((j) => next[j] ?? []);
  return options[routeIndex(policy, options.map((n) => n.type))];
}

function playMap(run: RunState, act: number, biome: Biome): Ending | null {
  const stages = generateMap(run.rng, {}, biome);
  const rooms = stages.length - 1;
  const entry = stages[0] ?? [];
  let node = entry[routeIndex(run.policy, entry.map((n) => n.type))];
  for (let r = 0; r < rooms && node; r += 1) {
    const current: MapNode = node;
    const next = r + 1 < rooms ? stages[r + 1] : undefined;
    node = next ? routeNext(current, next, run.policy) : undefined;
    const ending = playRoom(run, { act, biome, node: current });
    if (ending) {return ending;}
  }
  return null;
}

function playRun(run: RunState): RunResult {
  for (const [act, biome] of BIOMES.entries()) {
    const ending = playMap(run, act, biome) ?? bossRoom(run, act, biome);
    if (ending) {return finish(run, ending);}
  }
  return finish(run, { won: true, actReached: Math.max(0, BIOMES.length - 1), deathBy: '', deathKind: '' });
}

export function simulateRun(policy: Policy, rng: Rng): RunResult {
  const hero = createHero();
  return withPolicyContext(rng, hero, () => playRun({ hero, policy, rng, clears: 0, probes: [], tally: newTally() }));
}
