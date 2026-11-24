import {
  BURN_FRACTION,
  BURN_TURNS,
  WARD_BONUS,
  WARD_CAP,
  WARD_TURNS,
  type Burn,
  type DamageKind,
  type Derived,
  type EnemyInstance,
  type Hero,
  type HeroAction,
  type Item,
  type TurnStart,
} from '../types';
import { allEffects, effectiveEffect, findEffect } from './gear';
import { derive, isGuardAction } from './hero';
import { clamp } from './util';

interface Burnable { hp: number; burn: Burn | null }

export function applyBurn(target: Burnable, hitDmg: number): Burn {
  const perTurn = Math.max(1, Math.round(hitDmg * BURN_FRACTION));
  const burn = { perTurn: Math.max(perTurn, target.burn?.perTurn ?? 0), turns: BURN_TURNS };
  target.burn = burn;
  return burn;
}

export function mergeBurn(target: Burnable, burn: Burn): Burn {
  const merged = { perTurn: Math.max(burn.perTurn, target.burn?.perTurn ?? 0), turns: Math.max(burn.turns, target.burn?.turns ?? 0) };
  target.burn = merged;
  return merged;
}

function tickBurn(target: Burnable): number {
  const burn = target.burn;
  if (!burn) {return 0;}
  const loss = Math.min(burn.perTurn, Math.max(0, target.hp));
  target.hp -= loss;
  burn.turns -= 1;
  if (burn.turns <= 0) {target.burn = null;}
  return loss;
}

export function burnHero(hero: Hero, hitDmg: number): boolean {
  if (findEffect(hero, 'BURN_WARD')) {return false;}
  applyBurn(hero, hitDmg);
  return true;
}

export const cleanseBurn = (target: Burnable): void => { target.burn = null; };

export function resistOf(enemy: EnemyInstance, kind: DamageKind): number {
  const base = kind === 'PHYSICAL' ? enemy.resPhys : enemy.resMagic;
  return enemy.wardTurns > 0 ? Math.max(base, Math.min(WARD_CAP, base + WARD_BONUS)) : base;
}

export const applyWard = (enemy: EnemyInstance): void => { enemy.wardTurns = WARD_TURNS; };

export function tickWard(enemy: EnemyInstance): void {
  if (enemy.wardTurns > 0) {enemy.wardTurns -= 1;}
}

function reviveCharges(hero: Hero): { total: number; hpFraction: number } {
  let total = 0;
  let hpFraction = 0;
  for (const eff of allEffects(hero, 'REVIVE')) {
    total += eff.twice ? 2 : 1;
    hpFraction = Math.max(hpFraction, eff.hpFraction);
  }
  return { total: Math.min(2, total), hpFraction };
}

const livesSpent = (hero: Hero): number => (hero.revived ? 1 : 0) + (hero.revivedTwice ? 1 : 0);

const livesLeft = (hero: Hero): number => Math.max(0, reviveCharges(hero).total - livesSpent(hero));

export function reviveSpent(hero: Hero, item: Item, level: number): boolean {
  if (effectiveEffect(item, level).kind !== 'REVIVE') {return false;}
  const wearing: Hero = { ...hero, equipment: { ...hero.equipment, [item.slot]: item }, levels: { ...hero.levels, [item.slot]: level } };
  const without: Hero = { ...hero, equipment: { ...hero.equipment, [item.slot]: undefined } };
  return livesLeft(wearing) <= livesLeft(without);
}

function tryRevive(hero: Hero, d: Derived): boolean {
  const charges = reviveCharges(hero);
  if (livesSpent(hero) >= charges.total) {return false;}
  hero.hp = Math.max(1, Math.round(d.maxHp * charges.hpFraction));
  if (!hero.revived) {hero.revived = true;}
  else {hero.revivedTwice = true;}
  return true;
}

export type Fall = 'STANDING' | 'REVIVED' | 'DEAD';

export function heroFalls(hero: Hero, d: Derived = derive(hero)): Fall {
  if (hero.hp > 0) {return 'STANDING';}
  if (tryRevive(hero, d)) {return 'REVIVED';}
  hero.hp = 0;
  return 'DEAD';
}

function regen(hero: Hero, d: Derived, action: HeroAction | undefined): { hpRegen: number; mpRegen: number } {
  if (action !== undefined && isGuardAction(action)) {return { hpRegen: 0, mpRegen: 0 };}
  const hpRegen = clamp(d.hpRegen, 0, Math.max(0, d.maxHp - hero.hp));
  const mpRegen = clamp(d.mpRegen, 0, Math.max(0, d.maxMp - hero.mp));
  hero.hp += hpRegen;
  hero.mp += mpRegen;
  return { hpRegen, mpRegen };
}

export function startTurn(hero: Hero, action?: HeroAction): TurnStart {
  const d = derive(hero);
  const { hpRegen, mpRegen } = regen(hero, d, action);
  let blood = 0;
  for (const eff of allEffects(hero, 'BLOOD')) {blood += eff.hpPerTurn;}
  const bloodLoss = Math.min(blood, Math.max(0, hero.hp - 1));
  hero.hp -= bloodLoss;
  return { hpRegen, mpRegen, bloodLoss };
}

interface HeroTick { burnTick: number; fall: Fall }

export function heroBurnTick(hero: Hero): HeroTick {
  const burnTick = tickBurn(hero);
  return { burnTick, fall: burnTick > 0 ? heroFalls(hero) : 'STANDING' };
}

export const foeBurnTick = (enemy: EnemyInstance): number => tickBurn(enemy);

export const pendingTick = (hero: Hero): number => hero.burn?.perTurn ?? 0;
