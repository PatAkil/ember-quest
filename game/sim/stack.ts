import type { Hero, SpellId } from '../types';
import { allEffects } from './gear';
import type { EffectOf } from './util';

export type RampScope = 'ATTACK' | 'SPELL';
export type RampEffect = EffectOf<'RAMP'>;

const maxOf = (values: readonly number[]): number => values.reduce((m, v) => Math.max(m, v), 0);
const sumOf = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0);

export function rampFor(hero: Hero, scope: RampScope): RampEffect | undefined {
  const ramps = allEffects(hero, 'RAMP').filter((e) => e.scope === scope);
  if (ramps.length === 0) {return undefined;}
  return {
    kind: 'RAMP',
    scope,
    perStack: maxOf(ramps.map((e) => e.perStack)),
    maxStacks: maxOf(ramps.map((e) => e.maxStacks)),
    sticky: ramps.some((e) => e.sticky === true),
  };
}

export function echoFor(hero: Hero, spell: SpellId): number {
  return maxOf(allEffects(hero, 'SPELL_TWICE').filter((e) => e.spell === spell).map((e) => e.secondHitMult));
}

export const twinFor = (hero: Hero): number => maxOf(allEffects(hero, 'TWIN_STRIKE').map((e) => e.secondHitMult));

interface Hex { worn: boolean; allPhysical: boolean }

export function hexFor(hero: Hero): Hex {
  const hexes = allEffects(hero, 'HEX_STRIKE');
  return { worn: hexes.length > 0, allPhysical: hexes.some((e) => e.allPhysical === true) };
}

export const openerFor = (hero: Hero): number => Math.max(1, maxOf(allEffects(hero, 'FIRST_STRIKE').map((e) => e.mult)));

export const drainFor = (hero: Hero): number => maxOf(allEffects(hero, 'DRAIN').map((e) => e.fraction));

export const manaPerHit = (hero: Hero): number => maxOf(allEffects(hero, 'MP_ON_HIT').map((e) => e.amount));

export function executeBonus(hero: Hero, hpShare: number): number {
  return maxOf(allEffects(hero, 'EXECUTE').filter((e) => hpShare <= e.threshold).map((e) => e.bonus));
}

export function reflectFor(hero: Hero, physical: boolean): number {
  return sumOf(allEffects(hero, 'REFLECT').filter((e) => physical || e.magicToo === true).map((e) => e.fraction));
}
