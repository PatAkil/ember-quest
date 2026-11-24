import { POTIONS_MAX, RARITIES, type Burn, type Hero, type Item, type Rarity, type Rng } from '../types';
import { ACT_MULT, EVENTS, ITEMS, PENDING_BURN_BASE, PENDING_BURN_TURNS, QUIET_EVENT, opensScreen } from '../data';
import type { EventDef, EventEffect, EventOption } from '../data';
import { clampVitals, derive, fullHeal } from './hero';
import { ownedIds, upgradableTargets } from './pack';
import { actMult } from './descent';
import { burnWarded } from './power';
import { mergeBurn } from './status';
import { clamp, pickOneIndex } from './util';

type EffectOf<K extends EventEffect['kind']> = Extract<EventEffect, { kind: K }>;
type EventTable<R> = { [K in EventEffect['kind']]: (effect: EffectOf<K>) => R };
const WARD_REFUSES = 'YOUR WARD REFUSES FIRE';

type ApplyTable = { [K in EventEffect['kind']]: (hero: Hero, effect: EffectOf<K>) => number };

export type ScreenEffect = Extract<EventEffect, { kind: 'sp' | 'item' | 'upgradeAny' | 'dropPackItem' }>;
export interface AppliedEffect { effect: EventEffect; change: number }

function onEvent<R>(table: EventTable<R>, effect: EventEffect): R {
  const handler = table[effect.kind] as (e: EventEffect) => R;
  return handler(effect);
}

function eventItemPool(hero: Hero, rarity: Rarity, act: number): Item[] {
  const owned = new Set(ownedIds(hero));
  const free = ITEMS.filter((i) => !i.bossOnly && !owned.has(i.id));
  const named = free.filter((i) => i.rarity === rarity);
  if (named.length > 0) {return named;}
  const fits = free.filter((i) => (i.minAct ?? 0) <= act);
  for (let ri = RARITIES.indexOf(rarity) - 1; ri >= 0; ri -= 1) {
    const pool = fits.filter((i) => i.rarity === RARITIES[ri]);
    if (pool.length > 0) {return pool;}
  }
  return fits;
}

export function rollEventItem(hero: Hero, rarity: Rarity, act: number, rng: Rng): Item | undefined {
  const pool = eventItemPool(hero, rarity, act);
  return pool[pickOneIndex(rng, pool.length)];
}

function blockerOf(hero: Hero, effect: EventEffect): string | null {
  const table: EventTable<string | null> = {
    hpPct: (e) => (e.amount < 0 && hero.hp <= 1 ? 'TOO WEAK TO BLEED' : null),
    maxHp: (e) => (derive(hero).maxHp + e.amount < 1 ? 'TOO FRAIL' : null),
    sp: () => null,
    item: (e) => (eventItemPool(hero, e.rarity, ACT_MULT.length - 1).length === 0 ? 'NOTHING LEFT TO FIND' : null),
    upgradeAny: () => (upgradableTargets(hero).length === 0 ? 'NOTHING TO UPGRADE' : null),
    burnNextFight: () => (burnWarded(hero) ? WARD_REFUSES : null),
    fullHeal: () => null,
    dropPackItem: () => (hero.pack.length === 0 ? 'NO SPARE GEAR' : null),
    potion: (e) => (e.amount < 0 && hero.potions < -e.amount ? 'NO POTIONS' : null),
  };
  return onEvent(table, effect);
}

const HEALS: ReadonlySet<EventEffect['kind']> = new Set<EventEffect['kind']>(['hpPct', 'fullHeal']);

function paidHealOnly(option: EventOption): boolean {
  const gains = option.effects.filter((e) => effectIsGain(e));
  const paid = gains.length < option.effects.length;
  return paid && gains.length > 0 && gains.every((e) => HEALS.has(e.kind));
}

export function eventOptionBlocker(hero: Hero, option: EventOption): string | null {
  for (const effect of option.effects) {
    const why = blockerOf(hero, effect);
    if (why) {return why;}
  }
  return paidHealOnly(option) && hero.hp >= derive(hero).maxHp ? 'ALREADY AT FULL HP' : null;
}

export const eventOptionEnabled = (hero: Hero, option: EventOption): boolean => eventOptionBlocker(hero, option) === null;

export const eventPlayable = (hero: Hero, event: EventDef): boolean => event.options.some((o) => eventOptionEnabled(hero, o));

export const eventById = (id: string): EventDef | undefined =>
  (id === QUIET_EVENT.id ? QUIET_EVENT : EVENTS.find((e) => e.id === id));

export function pickEvent(rng: Rng, hero: Hero): EventDef {
  const playable = EVENTS.filter((e) => eventPlayable(hero, e));
  return playable[pickOneIndex(rng, playable.length)] ?? QUIET_EVENT;
}

function changeHp(hero: Hero, fraction: number): number {
  const maxHp = derive(hero).maxHp;
  const before = hero.hp;
  hero.hp = clamp(hero.hp + Math.round(maxHp * fraction), 1, maxHp);
  return hero.hp - before;
}

function changeMaxHp(hero: Hero, amount: number): number {
  const before = derive(hero).maxHp;
  hero.bonusMaxHp += amount;
  if (amount > 0) {hero.hp += amount;}
  clampVitals(hero, 1);
  return derive(hero).maxHp - before;
}

function changePotions(hero: Hero, amount: number): number {
  const before = hero.potions;
  hero.potions = clamp(hero.potions + amount, 0, POTIONS_MAX);
  return hero.potions - before;
}

function healFull(hero: Hero): number {
  const before = hero.hp;
  fullHeal(hero);
  return hero.hp - before;
}

const APPLY: ApplyTable = {
  hpPct: (hero, e) => changeHp(hero, e.amount),
  maxHp: (hero, e) => changeMaxHp(hero, e.amount),
  sp: (_hero, e) => e.amount,
  item: () => 0,
  upgradeAny: () => 0,
  burnNextFight: (hero) => { hero.pendingBurn = PENDING_BURN_TURNS; return PENDING_BURN_TURNS; },
  fullHeal: healFull,
  dropPackItem: () => 0,
  potion: (hero, e) => changePotions(hero, e.amount),
};

function applyOne(hero: Hero, effect: EventEffect): number {
  const apply = APPLY[effect.kind] as (h: Hero, e: EventEffect) => number;
  return apply(hero, effect);
}

export function applyEventCosts(hero: Hero, option: EventOption): AppliedEffect[] {
  return option.effects.filter((e) => !opensScreen(e)).map((effect) => ({ effect, change: applyOne(hero, effect) }));
}

export function screenEffectOf(option: EventOption): ScreenEffect | undefined {
  const last = option.effects.at(-1);
  if (!last || !opensScreen(last)) {return undefined;}
  return last.kind === 'sp' || last.kind === 'item' || last.kind === 'upgradeAny' || last.kind === 'dropPackItem' ? last : undefined;
}

export function takePendingBurn(hero: Hero, n: number): Burn | null {
  if (hero.pendingBurn <= 0) {return null;}
  const turns = hero.pendingBurn;
  hero.pendingBurn = 0;
  return mergeBurn(hero, { perTurn: Math.max(1, Math.round(PENDING_BURN_BASE * actMult(n))), turns });
}

const signed = (n: number): string => (n >= 0 ? `+${String(n)}` : String(n));
const plural = (n: number, word: string): string => `${String(Math.abs(n))} ${word}${Math.abs(n) === 1 ? '' : 'S'}`;
const pctOf = (f: number): string => `${String(Math.round(Math.abs(f) * 100))}%`;

const PREVIEW: EventTable<string> = {
  hpPct: (e) => (e.amount < 0 ? `LOSE ${pctOf(e.amount)} HP` : `HEAL ${pctOf(e.amount)} HP`),
  maxHp: (e) => (e.amount < 0 ? `LOSE ${String(-e.amount)} MAX HP` : `GAIN ${String(e.amount)} MAX HP`),
  sp: (e) => `GAIN ${plural(e.amount, 'SKILL POINT')}`,
  item: (e) => `A RANDOM ${e.rarity} ITEM`,
  upgradeAny: () => 'UPGRADE AN ITEM',
  burnNextFight: () => 'BURN IN NEXT FIGHT',
  fullHeal: () => 'HEAL TO FULL',
  dropPackItem: () => 'GIVE UP A PACK ITEM',
  potion: (e) => (e.amount < 0 ? `LOSE ${plural(e.amount, 'POTION')}` : `GAIN ${plural(e.amount, 'POTION')}`),
};

export const effectWords = (effect: EventEffect): string => onEvent(PREVIEW, effect);

export function appliedWords(applied: AppliedEffect): string {
  const { effect, change } = applied;
  if (effect.kind === 'hpPct' || effect.kind === 'fullHeal') {return `${signed(change)} HP`;}
  if (effect.kind === 'maxHp') {return `${signed(change)} MAX HP`;}
  if (effect.kind === 'potion') {return `${signed(change)} ${change === 1 || change === -1 ? 'POTION' : 'POTIONS'}`;}
  if (effect.kind === 'burnNextFight') {return 'YOU WILL BURN';}
  return effectWords(effect);
}

const GAIN: EventTable<boolean> = {
  hpPct: (e) => e.amount > 0,
  maxHp: (e) => e.amount > 0,
  sp: (e) => e.amount > 0,
  item: () => true,
  upgradeAny: () => true,
  burnNextFight: () => false,
  fullHeal: () => true,
  dropPackItem: () => false,
  potion: (e) => e.amount > 0,
};

export const effectIsGain = (effect: EventEffect): boolean => onEvent(GAIN, effect);
