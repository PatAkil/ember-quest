// Ember Quest v3 — sim/rng.ts: the only draw primitives. Headless.
// DESIGN.md → Module layout: `pick(n, rng) = floor(rng() × n)` is the only
// integer draw; everything else is defined in terms of it so two faithful
// implementations consume the rng stream identically.

import type { Rng } from '../types';

/** The only integer draw: a uniform integer in [0, n). n ≥ 1. */
export function pick(n: number, rng: Rng): number {
  return Math.floor(rng() * n);
}

/** A uniform integer in [lo, hi], inclusive: lo + pick(hi − lo + 1). */
export function uniformInt(lo: number, hi: number, rng: Rng): number {
  return lo + pick(hi - lo + 1, rng);
}

/** A weighted choice: rng() × Σw walked cumulatively in listed order. Returns the index. */
export function weighted(weights: readonly number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) total += w;
  const r = rng() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r < acc) return i;
  }
  return weights.length - 1;
}

/** A probability test: rng() < p, drawn even at p = 1 (and p = 0). */
export function chance(p: number, rng: Rng): boolean {
  return rng() < p;
}

/**
 * k without replacement: k successive picks over the shrinking list in data
 * order, drawn even when one element remains. Returns the chosen items in
 * draw order; the input is not mutated.
 */
export function withoutReplacement<T>(list: readonly T[], k: number, rng: Rng): T[] {
  const pool = list.slice();
  const out: T[] = [];
  const n = Math.min(k, pool.length);
  for (let i = 0; i < n; i++) {
    const j = pick(pool.length, rng);
    out.push(pool[j]);
    pool.splice(j, 1);
  }
  return out;
}

/** mulberry32 — the harness's seeded PRNG. main.ts passes Math.random instead. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
