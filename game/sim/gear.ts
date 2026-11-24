import {
  LEGENDARY_MAX_LEVEL,
  MAX_LEVEL,
  SLOTS,
  UPGRADE_SCALE,
  type Hero,
  type Item,
  type ItemEffect,
  type Slot,
  type StatMods,
} from '../types';
import { clamp, onEffect, r2, type EffectKind, type EffectOf, type EffectTable } from './util';

export function equippedItems(hero: Hero): Item[] {
  const out: Item[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item) {out.push(item);}
  }
  return out;
}

function slotEffect(hero: Hero, slot: Slot): ItemEffect | undefined {
  const item = hero.equipment[slot];
  return item ? effectiveEffect(item, itemLevel(hero, slot)) : undefined;
}

const isKind = <K extends EffectKind>(eff: ItemEffect | undefined, kind: K): eff is EffectOf<K> => eff?.kind === kind;

export function allEffects<K extends EffectKind>(hero: Hero, kind: K): EffectOf<K>[] {
  const out: EffectOf<K>[] = [];
  for (const slot of SLOTS) {
    const eff = slotEffect(hero, slot);
    if (isKind(eff, kind)) {out.push(eff);}
  }
  return out;
}

export function findEffect<K extends EffectKind>(hero: Hero, kind: K): EffectOf<K> | undefined {
  for (const slot of SLOTS) {
    const eff = slotEffect(hero, slot);
    if (isKind(eff, kind)) {return eff;}
  }
  return undefined;
}

export function maxLevelFor(item: Item): number {
  return item.rarity === 'LEGENDARY' ? LEGENDARY_MAX_LEVEL : MAX_LEVEL;
}

export function itemLevel(hero: Hero, slot: Slot): number {
  const item = hero.equipment[slot];
  if (!item) {return 0;}
  const raw = hero.levels[slot] ?? 0;
  return clamp(Math.floor(raw), 0, maxLevelFor(item));
}

export function displayName(item: Item, level: number): string {
  const name = level > 0 ? `${item.name} +${level}` : item.name;
  return name.slice(0, 16);
}

const MOD_KEYS: (keyof StatMods)[] = [
  'hp', 'mp', 'atk', 'mag', 'def', 'mdef', 'crit', 'critMult', 'dodge', 'hpRegen', 'mpRegen',
];

const roundMod = (k: keyof StatMods, v: number) => (k === 'critMult' ? r2(v) : Math.round(v));

function scaledMods(mods: StatMods, scale: number): StatMods {
  const out: StatMods = {};
  for (const k of MOD_KEYS) {
    const base = mods[k];
    if (base === undefined || base === 0) {continue;}
    out[k] = roundMod(k, base * scale);
  }
  return out;
}

function addMods(out: StatMods, extra: StatMods): void {
  for (const k of MOD_KEYS) {
    const add = extra[k];
    if (add === undefined || add === 0) {continue;}
    out[k] = roundMod(k, (out[k] ?? 0) + add);
  }
}

export function effectiveMods(item: Item, level: number): StatMods {
  const lvl = Math.max(0, level);
  const out = scaledMods(item.mods, 1 + UPGRADE_SCALE * lvl);
  const extra = lvl >= MAX_LEVEL ? item.awaken?.mods : undefined;
  if (extra) {addMods(out, extra);}
  return out;
}

const same = <E>(e: E): E => e;

const STEP: EffectTable<ItemEffect> = {
  NONE: same,
  HEX_STRIKE: same,
  RAMP: (e) => ({ ...e, perStack: r2(e.perStack * 1.35), maxStacks: e.maxStacks + 1 }),
  TWIN_STRIKE: (e) => ({ ...e, secondHitMult: Math.min(1, r2(e.secondHitMult + 0.15)) }),
  SPELL_TWICE: (e) => ({ ...e, secondHitMult: Math.min(1, r2(e.secondHitMult + 0.15)) }),
  CHEAPER_SPELLS: (e) => ({ ...e, amount: e.amount + 1 }),
  DRAIN: (e) => ({ ...e, fraction: Math.min(0.4, r2(e.fraction * 1.3)) }),
  REFLECT: (e) => ({ ...e, fraction: Math.min(1.2, r2(e.fraction * 1.35)) }),
  REVIVE: (e) => ({ ...e, hpFraction: Math.min(0.9, r2(e.hpFraction + 0.15)) }),
  MP_ON_HIT: (e) => ({ ...e, amount: e.amount + 1 }),
  GLASS: same,
  BLOOD: same,
  EXECUTE: (e) => ({ ...e, bonus: r2(e.bonus * 1.35) }),
  FIRST_STRIKE: (e) => ({ ...e, mult: r2(e.mult + 0.3) }),
  GRANT_SPELL: same,
  GUARD_COUNTER: (e) => ({ ...e, fraction: Math.min(1.2, r2(e.fraction + 0.15)) }),
  GUARD_MANA: (e) => ({ ...e, amount: e.amount + 1 }),
  PARRY_POWER: (e) => ({ ...e, mult: Math.min(3, r2(e.mult + 0.2)) }),
  PUNISH_WINDUP: (e) => ({ ...e, mult: r2(e.mult + 0.15) }),
  BURST_GAIN: (e) => ({ ...e, mult: r2(e.mult + 0.2) }),
  BURST_POWER: (e) => ({ ...e, mult: r2(e.mult + 0.2) }),
  IMBUE: same,
  ELEMENT_BOOST: (e) => ({ ...e, mult: r2(e.mult + 0.1) }),
  BURN_ON_HIT: (e) => ({ ...e, chance: Math.min(0.8, r2(e.chance + 0.1)) }),
  BURN_WARD: same,
  LOW_HP_POWER: (e) => ({ ...e, mult: r2(e.mult + 0.15) }),
};

export function scaleEffect(e: ItemEffect, level: number): ItemEffect {
  let out = e;
  for (let i = 0; i < Math.max(0, level); i += 1) {out = onEffect(STEP, out);}
  return out;
}

export function effectiveEffect(item: Item, level: number): ItemEffect {
  if (level >= MAX_LEVEL && item.awaken?.effect) {return item.awaken.effect;}
  return scaleEffect(item.effect, level);
}

export function effectiveBlurb(item: Item, level: number): string {
  if (level >= MAX_LEVEL && item.awaken?.blurb) {return item.awaken.blurb;}
  return item.blurb;
}

function upgradableSlots(hero: Hero): Slot[] {
  const out: Slot[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item && itemLevel(hero, slot) < maxLevelFor(item)) {out.push(slot);}
  }
  return out;
}

export function canUpgradeAny(hero: Hero): boolean {
  return upgradableSlots(hero).length > 0;
}
