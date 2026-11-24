import {
  AFFIX_IDS,
  AFFIX_MAX,
  HOLLOW_ATK_SHARE,
  HOLLOW_HP_FLOOR,
  HOLLOW_HIT_CAP,
  HOLLOW_HP_HITS,
  HOLLOW_RES_CAP,
  HOLLOW_SWIFT_DODGE,
  SLOTS,
  type AffixId,
  type DamageKind,
  type Derived,
  type EnemyInstance,
  type EnemyKind,
  type FoeScale,
  type Hero,
  type OwnedItem,
  type Slot,
} from '../types';
import { ACT_MULT, ENEMIES, HOLLOW_ID } from '../data';
import { spawnEnemy } from './combat';
import { actMult, affixCountFor, depthOf, inDescent, type ActPlan } from './descent';
import { effectiveEffect, findEffect, itemLevel } from './gear';
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

type ArmouryField = 'atk' | 'mag' | 'def' | 'mdef' | 'maxHp';

const byId = (a: OwnedItem, b: OwnedItem): number => (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : a.level - b.level);

function ownedIn(hero: Hero, slot: Slot): OwnedItem[] {
  const worn = hero.equipment[slot];
  const packed = hero.pack.filter((o) => o.item.slot === slot);
  return [...(worn ? [{ item: worn, level: itemLevel(hero, slot) }] : []), ...packed].sort(byId);
}

const wearing = (hero: Hero, owned: OwnedItem): Hero =>
  ({ ...hero, equipment: { ...hero.equipment, [owned.item.slot]: owned.item }, levels: { ...hero.levels, [owned.item.slot]: owned.level } });

function bestLoadout(hero: Hero, field: ArmouryField): number {
  let ghost: Hero = { ...hero, equipment: {}, levels: {}, pack: [] };
  for (const slot of SLOTS) {
    let best = derive(ghost)[field];
    for (const owned of ownedIn(hero, slot)) {
      const tried = wearing(ghost, owned);
      const value = derive(tried)[field];
      if (value > best) { best = value; ghost = tried; }
    }
  }
  return derive(ghost)[field];
}

type Armoury = Record<ArmouryField, number>;

const armouryOf = (hero: Hero): Armoury =>
  ({ atk: bestLoadout(hero, 'atk'), mag: bestLoadout(hero, 'mag'), def: bestLoadout(hero, 'def'), mdef: bestLoadout(hero, 'mdef'), maxHp: bestLoadout(hero, 'maxHp') });

const ownsHex = (hero: Hero): boolean =>
  SLOTS.some((slot) => ownedIn(hero, slot).some((o) => effectiveEffect(o.item, o.level).kind === 'HEX_STRIKE'));

function facedResist(hero: Hero, kind: DamageKind, res: { phys: number; magic: number }): number {
  if (kind === 'MAGIC') {return res.magic;}
  return ownsHex(hero) ? Math.min(res.phys, res.magic) : res.phys;
}

export function hollowOf(hero: Hero, n: number): EnemyInstance {
  const best = armouryOf(hero);
  const kind: DamageKind = best.atk >= best.mag ? 'PHYSICAL' : 'MAGIC';
  const base = Math.max(best.atk, best.mag);
  const res = { phys: Math.min(HOLLOW_RES_CAP, best.def), magic: Math.min(HOLLOW_RES_CAP, best.mdef) };
  const landed = base * (1 - facedResist(hero, kind, res) / 100);
  const hp = Math.max(1, Math.round(HOLLOW_HP_HITS * landed), Math.round(HOLLOW_HP_FLOOR * best.maxHp));
  const guard = kind === 'MAGIC' ? best.mdef : best.def;
  const capped = (HOLLOW_HIT_CAP * best.maxHp) / Math.max(0.05, 1 - guard / 100);
  const atk = Math.max(1, Math.round((Math.min(HOLLOW_ATK_SHARE * base, capped) * actMult(n)) / storyPeak()));
  const shell = spawnEnemy(HOLLOW_ID, { n, clears: 0, descentClears: null }, hollowAffixes(hero));
  return { ...shell, def: { ...shell.def, atkType: kind }, hp, maxHp: hp, atk, resPhys: res.phys, resMagic: res.magic };
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
