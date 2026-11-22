import type { Derived, Hero, Item, Slot } from '../types';
import { derive } from './hero';

export type DField = keyof Derived;

export const D_FIELDS: DField[] = [
  'atk', 'mag', 'maxHp', 'maxMp', 'def', 'mdef', 'crit', 'critMult', 'dodge', 'hpRegen', 'mpRegen',
];

export const D_WEIGHT: Record<DField, number> = {
  maxHp: 0.5, maxMp: 0.8, atk: 2.5, mag: 2.5, def: 1.7, mdef: 1.7,
  crit: 2.5, critMult: 25, dodge: 2.5, hpRegen: 4, mpRegen: 4,
};

export function deriveGhost(hero: Hero, slot: Slot, item: Item | undefined, level: number): Derived {
  const equipment = { ...hero.equipment, [slot]: item };
  const levels = { ...hero.levels, [slot]: item ? level : undefined };
  return derive({ ...hero, equipment, levels });
}

export function deriveWith(hero: Hero, item: Item): Derived {
  return deriveGhost(hero, item.slot, item, 0);
}

export function biggestDelta(before: Derived, after: Derived): DField | null {
  let best: DField | null = null;
  let bestScore = 0;
  for (const f of D_FIELDS) {
    const delta = Math.abs(after[f] - before[f]) * D_WEIGHT[f];
    if (delta > bestScore + 1e-9) {
      bestScore = delta;
      best = f;
    }
  }
  return best;
}
