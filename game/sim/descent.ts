import {
  ACTS_PER_DEPTH,
  AFFIX_IDS,
  AFFIX_MAX,
  DESCENT_ELITE_STEP,
  DESCENT_FIGHT_FLOOR,
  DESCENT_GROWTH,
  DESCENT_PHASE_AT,
  DESCENT_STAGE_MAX,
  type AffixId,
  type Biome,
  type Rng,
  type SpellId,
} from '../types';
import { ACT_MULT, BIOMES, HOLLOW_ID } from '../data';
import { MAP_SHAPE, type MapShape } from './map';
import { at, clamp, pickOneIndex, shuffled } from './util';

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
  affixOrder?: AffixId[];
}

export interface ActRef { n: number; plan: ActPlan }

export const depthOf = (n: number): number => Math.floor(n / ACTS_PER_DEPTH) + 1;
export const actInDepth = (n: number): number => n % ACTS_PER_DEPTH;
export const firstActOf = (depth: number): number => (Math.max(1, depth) - 1) * ACTS_PER_DEPTH;
export const storyAct = (n: number): number => clamp(n, 0, ACT_MULT.length - 1);
export const isLastActOfDepth = (n: number): boolean => actInDepth(n) === ACTS_PER_DEPTH - 1;
export const inDescent = (n: number): boolean => depthOf(n) >= 2;

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

export function descentStageSizes(depth: number): number[] {
  const count = Math.min(DESCENT_STAGE_MAX, MAP_SHAPE.stageSizes.length + Math.max(0, depth - 1));
  return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? 2 : 3));
}

export function descentWeights(depth: number): MapShape['weights'] {
  const base = MAP_SHAPE.weights;
  const step = clamp(DESCENT_ELITE_STEP * (depth - 1), 0, base.FIGHT - DESCENT_FIGHT_FLOOR);
  return { ...base, ELITE: base.ELITE + step, FIGHT: base.FIGHT - step };
}

type Pool = 'normals' | 'elites';

function invader(home: number, pool: Pool, rng: Rng): string[] {
  const own = new Set(at(BIOMES, home)[pool]);
  const foreign = BIOMES.flatMap((b: Biome, i) => (i === home ? [] : b[pool])).filter((id) => !own.has(id));
  return foreign.length > 0 ? [at(foreign, pickOneIndex(rng, foreign.length))] : [];
}

interface DepthDraw { depth: number; rng: Rng }

function remixAct(biomeIndex: number, last: boolean, draw: DepthDraw): ActPlan {
  const { depth, rng } = draw;
  const b = at(BIOMES, biomeIndex);
  return {
    biomeIndex,
    normals: [...b.normals, ...invader(biomeIndex, 'normals', rng)],
    elites: [...b.elites, ...invader(biomeIndex, 'elites', rng)],
    boss: last ? HOLLOW_ID : b.boss,
    affixCount: affixCountFor(depth),
    stageSizes: descentStageSizes(depth),
    weights: descentWeights(depth),
    phaseAt: DESCENT_PHASE_AT,
    affixOrder: shuffled(AFFIX_IDS, rng),
  };
}

export function planDepth(depth: number, rng: Rng): ActPlan[] {
  if (depth <= 1) {return storyPlan();}
  const order = shuffled(BIOMES.map((_, i) => i), rng);
  return order.map((biomeIndex, i) => remixAct(biomeIndex, i === order.length - 1, { depth, rng }));
}

export const planOf = (depthPlan: readonly ActPlan[], n: number): ActPlan => at(depthPlan, actInDepth(n));
