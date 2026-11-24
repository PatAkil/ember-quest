import { AFFIX_EVADE, AFFIX_LIFESTEAL, AFFIX_RESIST, AFFIX_THORNS, AFFIX_THORNS_CAP, type AffixId, type EnemyDef, type EnemyInstance, type Rng } from '../types';

interface Resists { resPhys: number; resMagic: number }

const bonus = (affixes: readonly AffixId[], id: AffixId): number => (affixes.includes(id) ? AFFIX_RESIST : 0);

export function affixResists(def: EnemyDef, affixes: readonly AffixId[]): Resists {
  return { resPhys: def.def + bonus(affixes, 'ARMORED'), resMagic: def.mdef + bonus(affixes, 'WARDED') };
}

const has = (enemy: EnemyInstance, id: AffixId): boolean => enemy.affixes.includes(id);

export const vampiricHeal = (enemy: EnemyInstance, dealt: number): number =>
  (has(enemy, 'VAMPIRIC') ? Math.round(dealt * AFFIX_LIFESTEAL) : 0);

export const thornsDamage = (enemy: EnemyInstance, taken: number, heroMaxHp: number): number =>
  (has(enemy, 'THORNED') ? Math.round(Math.min(taken * AFFIX_THORNS, heroMaxHp * AFFIX_THORNS_CAP)) : 0);

export const swiftEvades = (enemy: EnemyInstance, rng: Rng): boolean => has(enemy, 'SWIFT') && rng() < AFFIX_EVADE;

export const searingStrike = (enemy: EnemyInstance): boolean => has(enemy, 'SEARING');
