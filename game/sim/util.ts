import type { ItemEffect, Rng } from '../types';

type NonEmpty<T> = [T, ...T[]];

export type EffectKind = ItemEffect['kind'];
export type EffectOf<K extends EffectKind> = Extract<ItemEffect, { kind: K }>;
export type EffectTable<R> = { [K in EffectKind]: (effect: EffectOf<K>) => R };

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export const r2 = (v: number) => Math.round(v * 100) / 100;

export const jitter = (rng: Rng) => 0.9 + rng() * 0.2;

export function isNonEmpty<T>(arr: T[]): arr is NonEmpty<T> {
  return arr.length > 0;
}

export function pick<T>(arr: NonEmpty<T>, rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

export function pickOr<T>(arr: readonly T[], rng: Rng, fallback: T): T {
  return arr[Math.floor(rng() * arr.length)] ?? fallback;
}

export function onEffect<R>(table: EffectTable<R>, effect: ItemEffect): R {
  const handler = table[effect.kind] as (e: ItemEffect) => R;
  return handler(effect);
}
