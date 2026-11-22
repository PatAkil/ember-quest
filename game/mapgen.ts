import type { Rng } from './types';
import type { MapNode, RoomType } from './state';
import { at, pickOneIndex } from './lookup';

export const STAGE_SIZES = [2, 3, 2, 3, 2, 3] as const;

function pickRoomType(rng: Rng): RoomType {
  const r = rng();
  if (r < 0.15) {return 'ELITE';}
  if (r < 0.30) {return 'REST';}
  if (r < 0.42) {return 'LOOT';}
  return 'FIGHT';
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

function ensureLoot(stages: readonly MapNode[][], rng: Rng): void {
  const early = stages.slice(0, 6);
  if (hasType(early, 'LOOT')) {return;}
  const restStage = early.find((st) => st.length > 1 && st.some((n) => n.type === 'REST')) ?? at(stages, 3);
  const cands = restStage.filter((n) => n.type !== 'REST');
  (cands[pickOneIndex(rng, cands.length)] ?? at(restStage, 0)).type = 'LOOT';
}

function ensureVariety(stages: readonly MapNode[][], rng: Rng): void {
  for (const n of at(stages, 0)) {if (n.type === 'ELITE') {n.type = 'FIGHT';}}
  if (!hasType(stages.slice(1, 6), 'ELITE')) {
    const st = at(stages, 2); at(st, pickOneIndex(rng, st.length)).type = 'ELITE';
  }
  if (!hasType(stages.slice(0, 6), 'REST')) {
    const st = at(stages, 4); at(st, pickOneIndex(rng, st.length)).type = 'REST';
  }
  ensureLoot(stages, rng);
}

export function generateMap(rng: Rng): MapNode[][] {
  const stages: MapNode[][] = STAGE_SIZES.map((size, s) => {
    const stage: MapNode[] = [];
    for (let n = 0; n < size; n++) {stage.push({ type: pickRoomType(rng), stage: s, slot: n, links: [], cleared: false });}
    return stage;
  });
  stages.push([{ type: 'BOSS', stage: STAGE_SIZES.length, slot: 0, links: [], cleared: false }]);
  ensureVariety(stages, rng);
  stages.slice(0, -1).forEach((stage, s) => { linkStage(stage, at(stages, s + 1), rng); });
  return stages;
}
