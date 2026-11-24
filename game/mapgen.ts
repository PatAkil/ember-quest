import type { Rng } from './types';
import { generateMap as generateRooms } from './sim';
import type { ActPlan } from './sim';
import type { MapNode } from './state';

function adapt(node: { type: MapNode['type']; links: number[]; enemyId?: string; affixes?: MapNode['affixes'] }, stage: number, slot: number): MapNode {
  const base: MapNode = { type: node.type, stage, slot, links: node.links, cleared: false, enemyId: node.enemyId };
  return node.affixes ? { ...base, affixes: node.affixes } : base;
}

export function generateMap(rng: Rng, plan: ActPlan): MapNode[][] {
  const shape = { stageSizes: plan.stageSizes, weights: plan.weights };
  return generateRooms(rng, shape, plan).map((stage, s) => stage.map((node, slot) => adapt(node, s, slot)));
}
