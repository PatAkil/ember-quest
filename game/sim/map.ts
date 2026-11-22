import type { Rng } from '../types';
import type { RoomType } from './model';

const STAGE_SIZES = [2, 3, 2, 3, 2, 3];

export interface MapNode { type: RoomType; links: number[] }

function pickRoomType(rng: Rng): RoomType {
  const r = rng();
  if (r < 0.15) {return 'ELITE';}
  if (r < 0.3) {return 'REST';}
  if (r < 0.42) {return 'LOOT';}
  return 'FIGHT';
}

function span(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let j = lo; j <= hi; j += 1) {out.push(j);}
  return out;
}

function linkForward(cur: MapNode[], b: number, rng: Rng): void {
  const a = cur.length;
  let prevHi = -1;
  let prevPrevHi = -1;
  for (const [i, node] of cur.entries()) {
    const straight = Math.round((i * (b - 1)) / Math.max(1, a - 1));
    const width = b >= 2 && rng() < 0.85 ? 2 : 1;
    const minLo = Math.max(0, prevPrevHi, prevHi - 1);
    const lo = Math.max(minLo, Math.min(straight, b - 1));
    const hi = Math.min(b - 1, lo + width - 1);
    node.links = span(Math.min(lo, hi), hi);
    prevPrevHi = prevHi;
    prevHi = hi;
  }
}

function linkSpan(node: MapNode): { lo: number; hi: number } | null {
  const lo = node.links[0];
  const hi = node.links[node.links.length - 1];
  return lo === undefined || hi === undefined ? null : { lo, hi };
}

function nearestNode(cur: MapNode[], j: number): MapNode | undefined {
  let best = cur[0];
  let bestDist = Infinity;
  for (const node of cur) {
    const range = linkSpan(node);
    if (!range) {continue;}
    const dist = j < range.lo ? range.lo - j : j > range.hi ? j - range.hi : 0;
    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }
  return best;
}

function coverOrphans(cur: MapNode[], b: number): void {
  for (let j = 0; j < b; j += 1) {
    if (cur.some((n) => n.links.includes(j))) {continue;}
    const best = nearestNode(cur, j);
    if (!best) {continue;}
    const range = linkSpan(best);
    best.links = range ? span(Math.min(range.lo, j), Math.max(range.hi, j)) : span(j, j);
  }
}

function linkStage(cur: MapNode[], next: MapNode[], rng: Rng): void {
  if (cur.length === 0 || next.length === 0) {return;}
  linkForward(cur, next.length, rng);
  coverOrphans(cur, next.length);
}

const hasType = (stages: MapNode[][], type: RoomType) => stages.some((st) => st.some((n) => n.type === type));

function setRandomNode(stage: MapNode[] | undefined, type: RoomType, rng: Rng): void {
  if (!stage) {return;}
  const node = stage[Math.floor(rng() * stage.length)];
  if (node) {node.type = type;}
}

function ensureLoot(stages: MapNode[][], rng: Rng): void {
  const restStage = stages.find((st) => st.length > 1 && st.some((n) => n.type === 'REST')) ?? stages[3];
  if (!restStage) {return;}
  const cands = restStage.filter((n) => n.type !== 'REST');
  const target = cands[Math.floor(rng() * cands.length)] ?? restStage[0];
  if (target) {target.type = 'LOOT';}
}

function demoteRestChains(cur: MapNode[], next: MapNode[]): void {
  for (const node of cur) {
    if (node.type !== 'REST') {continue;}
    for (const j of node.links) {
      const target = next[j];
      if (target?.type === 'REST') {target.type = 'FIGHT';}
    }
  }
}

function adjacentPairs<T>(items: T[]): [T, T][] {
  const out: [T, T][] = [];
  items.forEach((item, i) => {
    const following = items[i + 1];
    if (following !== undefined) {out.push([item, following]);}
  });
  return out;
}

export function buildMap(rng: Rng): MapNode[][] {
  const stages = STAGE_SIZES.map((size) =>
    Array.from({ length: size }, (): MapNode => ({ type: pickRoomType(rng), links: [] })));
  for (const n of stages[0] ?? []) {if (n.type === 'ELITE') {n.type = 'FIGHT';}}
  if (!hasType(stages.slice(1), 'ELITE')) {setRandomNode(stages[2], 'ELITE', rng);}
  if (!hasType(stages, 'REST')) {setRandomNode(stages[4], 'REST', rng);}
  if (!hasType(stages, 'LOOT')) {ensureLoot(stages, rng);}
  const pairs = adjacentPairs(stages);
  for (const [cur, next] of pairs) {linkStage(cur, next, rng);}
  for (const [cur, next] of pairs) {demoteRestChains(cur, next);}
  return stages;
}

export function buildMapForCheck(rng: Rng): MapNode[][] { return buildMap(rng); }
