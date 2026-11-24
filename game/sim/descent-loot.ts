import { DESCENT_LEGENDARY_CAP, DESCENT_LEGENDARY_STEP, RARITIES, type LootSource } from '../types';
import { LOOT_WEIGHTS } from '../data';
import { depthOf, inDescent, storyAct } from './descent';
import { at, clamp } from './util';

type RarityWeights = [number, number, number, number];

export function descentRow(row: Readonly<RarityWeights>, depth: number): RarityWeights {
  const [common, rare, epic, legendary] = row;
  const gain = clamp(DESCENT_LEGENDARY_STEP * (depth - 1), 0, Math.max(0, DESCENT_LEGENDARY_CAP - legendary));
  const fromCommon = Math.min(common, gain);
  const fromRare = Math.min(rare, gain - fromCommon);
  return [common - fromCommon, rare - fromRare, epic, legendary + fromCommon + fromRare];
}

const epicOrBetter = ([common, rare, epic, legendary]: RarityWeights): RarityWeights => [0, 0, epic + common + rare, legendary];

export function lootWeights(source: LootSource, n: number): RarityWeights {
  const table = LOOT_WEIGHTS[source];
  const row = at(table, Math.min(storyAct(n), table.length - 1));
  if (!inDescent(n)) {return row;}
  const deep = descentRow(row, depthOf(n));
  return source === 'BOSS' ? epicOrBetter(deep) : deep;
}

export const shiftRarity = (index: number, shift: number): number => clamp(index + shift, 0, RARITIES.length - 1);
