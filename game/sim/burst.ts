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

type EmberSource = 'ACTION' | 'HIT_TAKEN' | 'PARRY';

const EMBER_GAIN: Record<EmberSource, number> = {
  ACTION: EMBER_PER_ACTION,
  HIT_TAKEN: EMBER_PER_HIT_TAKEN,
  PARRY: EMBER_PER_PARRY,
};

export function gainEmber(hero: Hero, source: EmberSource): number {
  const before = hero.ember;
  hero.ember = Math.min(EMBER_MAX, hero.ember + EMBER_GAIN[source]);
  return hero.ember - before;
}

export const canBurst = (hero: Hero): boolean => hero.ember >= EMBER_MAX;

interface BurstBlow { dmg: number; kind: DamageKind }

export function burstBlow(hero: Hero, d: Derived): BurstBlow {
  return {
    dmg: Math.max(1, Math.round(Math.max(d.atk, d.mag) * BURST_MULT)),
    kind: hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL',
  };
}
