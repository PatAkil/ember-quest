import {
  BURST_MULT,
  EMBER_MAX,
  EMBER_PER_ACTION,
  EMBER_PER_HIT_TAKEN,
  EMBER_PER_PARRY,
  type DamageKind,
  type Derived,
  type Hero,
} from '../types';
import { allEffects } from './gear';

type EmberSource = 'ACTION' | 'HIT_TAKEN' | 'PARRY';

const EMBER_GAIN: Record<EmberSource, number> = {
  ACTION: EMBER_PER_ACTION,
  HIT_TAKEN: EMBER_PER_HIT_TAKEN,
  PARRY: EMBER_PER_PARRY,
};

export function gainEmber(hero: Hero, source: EmberSource): number {
  const before = hero.ember;
  const rate = allEffects(hero, 'BURST_GAIN').reduce((m, e) => m * e.mult, 1);
  hero.ember = Math.min(EMBER_MAX, hero.ember + Math.round(EMBER_GAIN[source] * rate));
  return hero.ember - before;
}

export const canBurst = (hero: Hero): boolean => hero.ember >= EMBER_MAX;

export function burstPower(hero: Hero): number {
  return allEffects(hero, 'BURST_POWER').reduce((m, e) => m * e.mult, 1);
}

interface BurstBlow { dmg: number; kind: DamageKind }

export function burstBlow(hero: Hero, d: Derived): BurstBlow {
  return {
    dmg: Math.max(1, Math.round(Math.max(d.atk, d.mag) * BURST_MULT * burstPower(hero))),
    kind: hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL',
  };
}
