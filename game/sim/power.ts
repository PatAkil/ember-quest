import { RIPOSTE_MULT, type BattleState, type DamageKind, type Derived, type Element, type EnemyInstance, type Hero, type HeroAction } from '../types';
import { SPELLS } from '../data';
import { allEffects, findEffect } from './gear';
import { isSpell } from './hero';
import { resistOf } from './status';

export function heroElement(hero: Hero, action: HeroAction): Element | undefined {
  if (action === 'ATTACK') {return findEffect(hero, 'IMBUE')?.element;}
  return isSpell(action) ? SPELLS[action].element : undefined;
}

export function riposteMult(hero: Hero): number {
  return allEffects(hero, 'PARRY_POWER').reduce((m, e) => Math.max(m, e.mult), RIPOSTE_MULT);
}

export const punishes = (hero: Hero): boolean => findEffect(hero, 'PUNISH_WINDUP') !== undefined;

export const woundUp = (battle: BattleState): boolean => battle.intent === 'HEAVY' && !battle.enemy.staggered;

const product = (mults: number[]): number => mults.reduce((m, x) => m * x, 1);

function punishMult(hero: Hero, battle: BattleState): number {
  return woundUp(battle) ? product(allEffects(hero, 'PUNISH_WINDUP').map((e) => e.mult)) : 1;
}

const hpShare = (hero: Hero, d: Derived): number => hero.hp / Math.max(1, d.maxHp);

export function desperate(hero: Hero, d: Derived): boolean {
  return allEffects(hero, 'LOW_HP_POWER').some((e) => hpShare(hero, d) < e.threshold);
}

function lowHpMult(hero: Hero, d: Derived): number {
  const share = hpShare(hero, d);
  return product(allEffects(hero, 'LOW_HP_POWER').filter((e) => share < e.threshold).map((e) => e.mult));
}

function boostMult(hero: Hero, element: Element | undefined): number {
  if (!element) {return 1;}
  return product(allEffects(hero, 'ELEMENT_BOOST').filter((e) => e.element === element).map((e) => e.mult));
}

interface PowerCtx { hero: Hero; battle: BattleState; d: Derived; element: Element | undefined }

export function gearPower({ hero, battle, d, element }: PowerCtx): number {
  return punishMult(hero, battle) * lowHpMult(hero, d) * boostMult(hero, element);
}

export function burnChance(hero: Hero): number {
  return allEffects(hero, 'BURN_ON_HIT').reduce((m, e) => Math.max(m, e.chance), 0);
}

export const burnWarded = (hero: Hero): boolean => findEffect(hero, 'BURN_WARD') !== undefined;

export function counterBlow(hero: Hero, d: Derived, enemy: EnemyInstance): number {
  const fraction = allEffects(hero, 'GUARD_COUNTER').reduce((sum, e) => sum + e.fraction, 0);
  if (fraction <= 0) {return 0;}
  const kind: DamageKind = hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL';
  const base = kind === 'MAGIC' ? d.mag : d.atk;
  return Math.max(1, Math.round(base * fraction * (1 - resistOf(enemy, kind) / 100)));
}

export function guardMana(hero: Hero): number {
  return allEffects(hero, 'GUARD_MANA').reduce((sum, e) => sum + e.amount, 0);
}
