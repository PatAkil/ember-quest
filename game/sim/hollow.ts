import {
  AFFIX_IDS,
  AFFIX_MAX,
  HOLLOW_ATK_SHARE,
  HOLLOW_HP_FLOOR,
  HOLLOW_HP_HITS,
  HOLLOW_RES_CAP,
  HOLLOW_SWIFT_DODGE,
  type AffixId,
  type DamageKind,
  type Derived,
  type EnemyInstance,
  type EnemyKind,
  type FoeScale,
  type Hero,
} from '../types';
import { ACT_MULT, ENEMIES, HOLLOW_ID } from '../data';
import { spawnEnemy } from './combat';
import { actMult, affixCountFor, depthOf, inDescent, type ActPlan } from './descent';
import { findEffect } from './gear';
import { derive } from './hero';
import { pactMods } from './pacts';
import { at } from './util';

type GearTest = (hero: Hero, d: Derived) => boolean;

const GEAR_AFFIXES: readonly [GearTest, AffixId][] = [
  [(hero) => findEffect(hero, 'DRAIN') !== undefined, 'VAMPIRIC'],
  [(hero) => findEffect(hero, 'REFLECT') !== undefined, 'THORNED'],
  [(_hero, d) => d.dodge >= HOLLOW_SWIFT_DODGE, 'SWIFT'],
  [(hero) => findEffect(hero, 'BURN_ON_HIT') !== undefined, 'SEARING'],
];

export const hollowAffixes = (hero: Hero, d: Derived = derive(hero)): AffixId[] =>
  GEAR_AFFIXES.filter(([worn]) => worn(hero, d)).map(([, id]) => id).slice(0, AFFIX_MAX);

const storyPeak = (): number => at(ACT_MULT, ACT_MULT.length - 1);

export function hollowOf(hero: Hero, n: number): EnemyInstance {
  const d = derive(hero);
  const kind: DamageKind = hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL';
  const base = kind === 'MAGIC' ? d.mag : d.atk;
  const resPhys = Math.min(HOLLOW_RES_CAP, d.def);
  const resMagic = Math.min(HOLLOW_RES_CAP, d.mdef);
  const landed = base * (1 - (kind === 'MAGIC' ? resMagic : resPhys) / 100);
  const hp = Math.max(1, Math.round(HOLLOW_HP_HITS * landed), Math.round(HOLLOW_HP_FLOOR * d.maxHp));
  const atk = Math.max(1, Math.round((HOLLOW_ATK_SHARE * base * actMult(n)) / storyPeak()));
  const shell = spawnEnemy(HOLLOW_ID, { n, clears: 0, descentClears: null }, hollowAffixes(hero, d));
  return { ...shell, def: { ...shell.def, atkType: kind }, hp, maxHp: hp, atk, resPhys, resMagic };
}

export interface SpawnContext extends FoeScale { hero: Hero; affixes?: readonly AffixId[]; plan?: ActPlan }

function tierCount(kind: EnemyKind, n: number, hero: Hero): number {
  const counts = affixCountFor(depthOf(n));
  return kind === 'NORMAL' ? counts.normal : counts.elite + pactMods(hero).foeAffix;
}

export function foeAffixes(id: string, ctx: SpawnContext): AffixId[] {
  const given = [...(ctx.affixes ?? [])];
  const def = ENEMIES[id];
  if (!def || !inDescent(ctx.n)) {return given;}
  const target = Math.min(AFFIX_MAX, tierCount(def.kind, ctx.n, ctx.hero));
  for (const affix of ctx.plan?.affixOrder ?? AFFIX_IDS) {
    if (given.length >= target) {break;}
    if (!given.includes(affix)) {given.push(affix);}
  }
  return given;
}

function pactFoe(enemy: EnemyInstance, hero: Hero): EnemyInstance {
  const mods = pactMods(hero);
  const atk = Math.max(1, Math.round(enemy.atk * mods.foeAtkMult));
  const hp = enemy.def.kind === 'ELITE' ? Math.max(1, Math.round(enemy.maxHp * mods.eliteHpMult)) : enemy.maxHp;
  return { ...enemy, atk, hp, maxHp: hp };
}

function withPhaseLine(enemy: EnemyInstance, plan: ActPlan | undefined): EnemyInstance {
  if (enemy.def.kind !== 'BOSS' || plan?.phaseAt === undefined) {return enemy;}
  return { ...enemy, phaseAt: plan.phaseAt };
}

function baseFoe(id: string, ctx: SpawnContext): EnemyInstance {
  return id === HOLLOW_ID ? hollowOf(ctx.hero, ctx.n) : spawnEnemy(id, ctx, foeAffixes(id, ctx));
}

export const spawnFoe = (id: string, ctx: SpawnContext): EnemyInstance =>
  withPhaseLine(pactFoe(baseFoe(id, ctx), ctx.hero), ctx.plan);
