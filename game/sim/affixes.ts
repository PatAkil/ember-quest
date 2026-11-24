import { AFFIX_EVADE, AFFIX_IDS, AFFIX_LIFESTEAL, AFFIX_RESIST, AFFIX_THORNS, AFFIX_THORNS_CAP, type AffixId, type EnemyDef, type EnemyInstance, type Rng } from '../types';
import { PACTS } from '../data';

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

const PACT_AFFIX_ROOM = Math.max(1, Object.values(PACTS).reduce((sum, pact) => sum + (pact.mods.foeAffix ?? 0), 0));

interface PoolSource { affixOrder?: readonly AffixId[]; affixCount?: { normal: number; elite: number } }

export function affixPool(source: PoolSource): AffixId[] {
  const count = source.affixCount ?? { normal: 0, elite: 0 };
  const most = Math.max(count.normal, count.elite);
  if (most <= 0) {return [];}
  return (source.affixOrder ?? AFFIX_IDS).slice(0, Math.min(AFFIX_IDS.length, most + PACT_AFFIX_ROOM));
}
