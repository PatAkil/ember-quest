import type { Rng } from './types';
import { generateMap as generateRooms, MAP_SHAPE } from './sim';
import type { MapNode } from './state';

export const STAGE_SIZES = MAP_SHAPE.stageSizes;

export function generateMap(rng: Rng): MapNode[][] {
  return generateRooms(rng).map((stage, s) =>
    stage.map((node, slot): MapNode => ({ type: node.type, stage: s, slot, links: node.links, cleared: false, enemyId: node.enemyId })));
}
