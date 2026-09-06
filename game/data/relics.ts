// Ember Quest v3 — the relic tables: main-stat bases, the slot table with its
// weights, substat ranges, loot weights and drop levels. Headless.
// DESIGN.md → Relics. Rolling itself lives in sim/relics.ts.

import type { LootSource, Rarity, RelicStat, Slot } from '../types';

/** main = round(base × (1 + MAIN_PER_LEVEL × level)); LEGENDARY bases carry LEGENDARY_MAIN_MULT. */
export const RELIC_MAIN_BASE: Record<RelicStat, number> = {
  ATK: 36, HP: 450, DEF: 36, SPD: 12,
  ATK_PCT: 16, HP_PCT: 16, DEF_PCT: 16,
  CRIT: 12, CDMG: 22, ACC: 16, RES: 16,
};

/** The slot table. Odd slots are fixed; the first entries of the open slots are the signatures. */
export const MAIN_BY_SLOT: Record<Slot, readonly RelicStat[]> = {
  WEAPON: ['ATK'],
  BOOTS: ['SPD', 'ATK_PCT', 'HP_PCT', 'DEF_PCT'],
  ARMOR: ['HP'],
  NECKLACE: ['CRIT', 'CDMG', 'ATK_PCT', 'HP_PCT', 'DEF_PCT'],
  CHALICE: ['DEF'],
  TOME: ['RES', 'ACC', 'ATK_PCT', 'HP_PCT', 'DEF_PCT'],
};

/** Signature mains per open slot (weight MAIN_WEIGHT_SIGNATURE); everything else weighs 1. */
export const MAIN_SIGNATURE: Record<Slot, readonly RelicStat[]> = {
  WEAPON: ['ATK'], BOOTS: ['SPD'], ARMOR: ['HP'], NECKLACE: ['CRIT', 'CDMG'], CHALICE: ['DEF'], TOME: ['RES', 'ACC'],
};

/** Inclusive integer ranges, identical at every level; ascension A4+ lowers every top by 1. */
export const SUBSTAT_RANGES: Record<RelicStat, readonly [number, number]> = {
  ATK_PCT: [4, 8], HP_PCT: [4, 8], DEF_PCT: [4, 8],
  RES: [4, 8], ACC: [4, 8],
  CRIT: [3, 5], CDMG: [3, 5],
  SPD: [4, 6],
  HP: [90, 180], ATK: [7, 13], DEF: [6, 12],
};

/** [COMMON, RARE, EPIC, LEGENDARY] per act (index 0 = act 1); each row sums to 100. Laps reuse the act-6 row. */
export const LOOT_WEIGHTS: Record<Exclude<LootSource, 'SUMMON'>, readonly (readonly [number, number, number, number])[]> = {
  FIGHT: [[70, 25, 5, 0], [60, 30, 9, 1], [50, 35, 13, 2], [40, 40, 17, 3], [30, 42, 23, 5], [20, 42, 30, 8]],
  ELITE: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10], [10, 38, 40, 12], [5, 35, 45, 15]],
  LOOT: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10], [10, 38, 40, 12], [5, 35, 45, 15]],
  BOSS: [[0, 40, 45, 15], [0, 33, 47, 20], [0, 27, 48, 25], [0, 20, 50, 30], [0, 15, 50, 35], [0, 10, 50, 40]],
};

/** Drop level per act: uniform integer in [lo, hi]; +1 for an ELITE or BOSS card, +1 more for an EPIC under VEIL, then clamped to the cap. */
export const DROP_LEVEL: readonly (readonly [number, number])[] = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6]];

export const RARITY_ORDER: readonly Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
