import { AFFIX_IDS, type AffixId, type Rng } from '../types';
import type { RoomType } from './model';
import { at, pickOneIndex, shuffled } from './util';

type StageRoom = Exclude<RoomType, 'BOSS'>;

export interface MapNode { type: RoomType; links: number[]; enemyId?: string; affixes?: AffixId[] }

export interface MapShape {
  stageSizes: readonly number[];
  weights: Record<StageRoom, number>;
}

export const MAP_SHAPE: MapShape = {
  stageSizes: [2, 3, 2, 3, 2, 3],
  weights: { ELITE: 15, REST: 14, LOOT: 12, EVENT: 13, FIGHT: 46 },
};

const ROLL_ORDER: readonly StageRoom[] = ['ELITE', 'REST', 'LOOT', 'EVENT', 'FIGHT'];
const ELITE_STAGE = 2;
const LOOT_FALLBACK_STAGE = 3;
const REST_STAGE = 4;
const EVENT_STAGES: { first: number; last: number } = { first: 1, last: 4 };

interface Threshold { type: StageRoom; below: number }

function thresholds(weights: Record<StageRoom, number>): Threshold[] {
  const total = ROLL_ORDER.reduce((sum, type) => sum + weights[type], 0);
  let cumulative = 0;
  return ROLL_ORDER.map((type) => {
    cumulative += weights[type];
    return { type, below: cumulative / total };
  });
}

function rollRoom(table: readonly Threshold[], rng: Rng): StageRoom {
  const r = rng();
  return table.find((t) => r < t.below)?.type ?? 'FIGHT';
}

interface LinkSpan { lo: number; hi: number }

function linkSpan(i: number, his: readonly number[], sizes: { a: number; b: number }, rng: Rng): LinkSpan {
  const { a, b } = sizes;
  const straight = Math.round((i * (b - 1)) / Math.max(1, a - 1));
  const prev1 = his[i - 1];
  const prev2 = his[i - 2];
  const floorLo = Math.max(prev1 === undefined ? 0 : prev1 - 1, prev2 ?? 0);
  const span = b >= 2 && rng() < 0.85 ? 2 : 1;
  let lo = Math.max(floorLo, Math.min(straight - (span === 2 && rng() < 0.5 ? 1 : 0), b - 1));
  const hi = Math.max(lo, Math.min(b - 1, lo + span - 1));
  if (hi - lo + 1 < span && lo > floorLo) {lo = Math.max(floorLo, hi - span + 1);}
  return { lo, hi };
}

function nearestNode(cur: readonly MapNode[], j: number): MapNode {
  let best = at(cur, 0);
  let bestDist = Infinity;
  for (const n of cur) {
    const d = Math.min(Math.abs(at(n.links, 0) - j), Math.abs(at(n.links, n.links.length - 1) - j));
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

function coverOrphans(cur: readonly MapNode[], b: number): void {
  for (let j = 0; j < b; j++) {
    if (cur.some((n) => n.links.includes(j))) {continue;}
    const best = nearestNode(cur, j);
    best.links.push(j);
    best.links.sort((x, y) => x - y);
  }
}

function breakRestChains(cur: readonly MapNode[], next: readonly MapNode[]): void {
  for (const n of cur.filter((c) => c.type === 'REST')) {
    for (const j of n.links) {
      const target = next[j];
      if (target?.type === 'REST') {target.type = 'FIGHT';}
    }
  }
}

function linkStage(cur: readonly MapNode[], next: readonly MapNode[], rng: Rng): void {
  const sizes = { a: cur.length, b: next.length };
  const his: number[] = [];
  cur.forEach((node, i) => {
    const { lo, hi } = linkSpan(i, his, sizes, rng);
    node.links = [];
    for (let j = lo; j <= hi; j++) {node.links.push(j);}
    his.push(hi);
  });
  coverOrphans(cur, sizes.b);
  breakRestChains(cur, next);
}

const hasType = (stages: readonly MapNode[][], type: RoomType): boolean => stages.some((st) => st.some((n) => n.type === type));

const isLootSpot = (n: MapNode): boolean => n.type !== 'REST' && n.type !== 'ELITE';
const isRestSpot = (n: MapNode): boolean => n.type !== 'ELITE';

interface Spot { regular: readonly MapNode[][]; stage: readonly MapNode[]; rolled: MapNode; allowed: (n: MapNode) => boolean }

function spareElites({ regular, stage, rolled, allowed }: Spot): MapNode {
  if (allowed(rolled)) {return rolled;}
  return stage.find(allowed) ?? regular.flat().find(allowed) ?? rolled;
}

function ensureLoot(regular: readonly MapNode[][], rng: Rng): void {
  if (hasType(regular, 'LOOT')) {return;}
  const stage = regular.find((st) => st.length > 1 && st.some((n) => n.type === 'REST')) ?? at(regular, LOOT_FALLBACK_STAGE);
  const cands = stage.filter((n) => n.type !== 'REST');
  const rolled = cands[pickOneIndex(rng, cands.length)] ?? at(stage, 0);
  spareElites({ regular, stage, rolled, allowed: isLootSpot }).type = 'LOOT';
}

function ensureRest(regular: readonly MapNode[][], rng: Rng): void {
  if (hasType(regular, 'REST')) {return;}
  const stage = at(regular, REST_STAGE);
  const rolled = at(stage, pickOneIndex(rng, stage.length));
  spareElites({ regular, stage, rolled, allowed: isRestSpot }).type = 'REST';
}

function ensureVariety(regular: readonly MapNode[][], rng: Rng): void {
  for (const n of at(regular, 0)) {if (n.type === 'ELITE') {n.type = 'FIGHT';}}
  if (!hasType(regular.slice(1), 'ELITE')) {
    const st = at(regular, ELITE_STAGE); at(st, pickOneIndex(rng, st.length)).type = 'ELITE';
  }
  ensureRest(regular, rng);
  ensureLoot(regular, rng);
}

function restFed(stages: readonly MapNode[][], s: number): Set<number> {
  const fed = new Set<number>();
  for (const n of stages[s - 1] ?? []) {
    if (n.type === 'REST') {for (const j of n.links) {fed.add(j);}}
  }
  return fed;
}

function unfeedEvents(stages: readonly MapNode[][]): void {
  stages.forEach((stage, s) => {
    const fed = restFed(stages, s);
    stage.forEach((n, j) => { if (n.type === 'EVENT' && fed.has(j)) {n.type = 'FIGHT';} });
  });
}

const countOf = (nodes: readonly MapNode[], type: RoomType): number => nodes.filter((n) => n.type === type).length;

function eventSpots(stages: readonly MapNode[][], spare: (n: MapNode) => boolean): MapNode[] {
  const spots: MapNode[] = [];
  for (let s = EVENT_STAGES.first; s <= EVENT_STAGES.last; s++) {
    const fed = restFed(stages, s);
    (stages[s] ?? []).forEach((n, j) => { if (!fed.has(j) && spare(n)) {spots.push(n);} });
  }
  return spots;
}

function ensureEvent(stages: readonly MapNode[][], rng: Rng): void {
  const placed = stages.slice(EVENT_STAGES.first, EVENT_STAGES.last + 1).some((st) => st.some((n) => n.type === 'EVENT'));
  if (placed) {return;}
  const all = stages.flat();
  const duplicated = (n: MapNode): boolean => n.type !== 'BOSS' && n.type !== 'FIGHT' && countOf(all, n.type) > 1;
  const fights = eventSpots(stages, (n) => n.type === 'FIGHT');
  const spots = fights.length > 0 ? fights : eventSpots(stages, duplicated);
  const chosen = spots[pickOneIndex(rng, spots.length)];
  if (chosen) {chosen.type = 'EVENT';}
}

export interface FoePools {
  normals: readonly string[];
  elites: readonly string[];
  affixCount?: { normal: number; elite: number };
}

function rollFoe(pool: readonly string[], fallback: readonly string[], rng: Rng): string | undefined {
  const from = pool.length > 0 ? pool : fallback;
  return from.length > 0 ? from[pickOneIndex(rng, from.length)] : undefined;
}

export const rollAffixes = (count: number, rng: Rng): AffixId[] => (count > 0 ? shuffled(AFFIX_IDS, rng).slice(0, count) : []);

function scoutAffixes(node: MapNode, count: number, rng: Rng): void {
  const affixes = rollAffixes(count, rng);
  if (affixes.length > 0) {node.affixes = affixes;}
}

function scoutFoes(stages: readonly MapNode[][], pools: FoePools, rng: Rng): void {
  const counts = pools.affixCount ?? { normal: 0, elite: 0 };
  for (const node of stages.flat()) {
    if (node.type === 'FIGHT') {
      node.enemyId = rollFoe(pools.normals, pools.elites, rng);
      scoutAffixes(node, counts.normal, rng);
    }
    if (node.type === 'ELITE') {
      node.enemyId = rollFoe(pools.elites, pools.normals, rng);
      scoutAffixes(node, counts.elite, rng);
    }
  }
}

export function generateMap(rng: Rng, shape: Partial<MapShape> = {}, pools?: FoePools): MapNode[][] {
  const { stageSizes, weights } = { ...MAP_SHAPE, ...shape };
  const table = thresholds(weights);
  const regular = stageSizes.map((size) =>
    Array.from({ length: size }, (): MapNode => ({ type: rollRoom(table, rng), links: [] })));
  const stages: MapNode[][] = [...regular, [{ type: 'BOSS', links: [] }]];
  ensureVariety(regular, rng);
  stages.slice(0, -1).forEach((stage, s) => { linkStage(stage, at(stages, s + 1), rng); });
  unfeedEvents(stages);
  ensureEvent(stages, rng);
  if (pools) {scoutFoes(stages, pools, rng);}
  return stages;
}
