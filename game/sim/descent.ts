import { ACTS_PER_DEPTH, AFFIX_MAX, DESCENT_GROWTH, type Rng, type SpellId } from '../types';
import { ACT_MULT, BIOMES } from '../data';
import { MAP_SHAPE, type MapShape } from './map';
import { at, clamp } from './util';

export interface AffixCount { normal: number; elite: number }

export interface ActPlan {
  biomeIndex: number;
  normals: string[];
  elites: string[];
  boss: string;
  scroll?: SpellId;
  affixCount: AffixCount;
  stageSizes: number[];
  weights: MapShape['weights'];
  phaseAt?: number;
}

export interface ActRef { n: number; plan: ActPlan }

export const depthOf = (n: number): number => Math.floor(n / ACTS_PER_DEPTH) + 1;
export const actInDepth = (n: number): number => n % ACTS_PER_DEPTH;
export const firstActOf = (depth: number): number => (Math.max(1, depth) - 1) * ACTS_PER_DEPTH;
export const storyAct = (n: number): number => clamp(n, 0, ACT_MULT.length - 1);
export const isLastActOfDepth = (n: number): boolean => actInDepth(n) === ACTS_PER_DEPTH - 1;

export function actMult(n: number): number {
  const last = ACT_MULT.length - 1;
  const base = at(ACT_MULT, storyAct(n));
  return n <= last ? base : base * DESCENT_GROWTH ** (n - last);
}

function storyActPlan(biomeIndex: number): ActPlan {
  const b = at(BIOMES, biomeIndex);
  const plan: ActPlan = {
    biomeIndex,
    normals: [...b.normals],
    elites: [...b.elites],
    boss: b.boss,
    affixCount: { normal: 0, elite: 0 },
    stageSizes: [...MAP_SHAPE.stageSizes],
    weights: { ...MAP_SHAPE.weights },
  };
  return b.scroll ? { ...plan, scroll: b.scroll } : plan;
}

export const storyPlan = (): ActPlan[] => BIOMES.map((_, i) => storyActPlan(i));

export function affixCountFor(depth: number): AffixCount {
  return { normal: clamp(depth - 2, 0, AFFIX_MAX), elite: clamp(depth - 1, 0, AFFIX_MAX) };
}

interface DepthDraw { depth: number; rng: Rng }

const remixAct = (plan: ActPlan, draw: DepthDraw): ActPlan => ({ ...plan, affixCount: affixCountFor(draw.depth) });

export function planDepth(depth: number, rng: Rng): ActPlan[] {
  const story = storyPlan();
  return depth <= 1 ? story : story.map((plan) => remixAct(plan, { depth, rng }));
}

export const planOf = (depthPlan: readonly ActPlan[], n: number): ActPlan => at(depthPlan, actInDepth(n));
