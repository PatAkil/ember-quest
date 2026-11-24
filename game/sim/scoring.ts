import type { Derived, EnemyDef, Hero, Item, LootOffer, OwnedItem, Rarity, SpellId, UpgradeTarget } from '../types';
import { SPELLS } from '../data';
import { effectiveEffect, itemLevel } from './gear';
import { D_FIELDS, D_WEIGHT, deriveGhost, deriveWith, type DField } from './ghost';
import { derive, knownSpells } from './hero';
import { resolveUpgrade } from './loot';
import { upgradableTargets } from './pack';
import { onEffect, type EffectTable } from './util';

export type Profile = Record<DField, number>;

export const P_BALANCED: Profile = { ...D_WEIGHT };

export const P_OFFENCE: Profile = {
  maxHp: 0.15, maxMp: 1.0, atk: 3.2, mag: 3.2, def: 0.4, mdef: 0.4,
  crit: 3.5, critMult: 35, dodge: 1.5, hpRegen: 1.5, mpRegen: 4,
};

export const P_DEFENCE: Profile = {
  maxHp: 1.1, maxMp: 0.6, atk: 1.4, mag: 1.4, def: 3.2, mdef: 3.2,
  crit: 1.0, critMult: 8, dodge: 3.0, hpRegen: 4, mpRegen: 2,
};

export type ItemBonus = (i: Item) => number;

const RARITY_BONUS: Record<Rarity, number> = { COMMON: 0, RARE: 1.5, EPIC: 4, LEGENDARY: 7 };

const worthless = () => 0;

const EFFECT_VALUE: EffectTable<number> = {
  NONE: worthless,
  HEX_STRIKE: (e) => (e.allPhysical ? 8 : 5),
  RAMP: (e) => e.perStack * e.maxStacks * 22 * (e.sticky ? 1.4 : 1),
  TWIN_STRIKE: (e) => e.secondHitMult * 16,
  SPELL_TWICE: (e) => e.secondHitMult * 13,
  CHEAPER_SPELLS: (e) => e.amount * 4,
  DRAIN: (e) => e.fraction * 34,
  REFLECT: (e) => e.fraction * 14 * (e.magicToo ? 1.6 : 1),
  REVIVE: (e) => (e.twice ? 22 : 12),
  MP_ON_HIT: (e) => e.amount * 3,
  GLASS: worthless,
  BLOOD: (e) => -e.hpPerTurn * 4,
  EXECUTE: (e) => e.bonus * 16,
  FIRST_STRIKE: (e) => (e.mult - 1) * 8,
  GRANT_SPELL: (e) => 8 + (e.discount ?? 0) * 2,
};

const effectValue = (item: Item, level: number) => onEffect(EFFECT_VALUE, effectiveEffect(item, level));

function statGain(before: Derived, after: Derived, profile: Profile): number {
  let score = 0;
  for (const f of D_FIELDS) {score += (after[f] - before[f]) * profile[f];}
  return score;
}

function scoreItem(hero: Hero, item: Item, profile: Profile): number {
  let score = statGain(derive(hero), deriveWith(hero, item), profile);
  score += effectValue(item, 0);
  const current = hero.equipment[item.slot];
  if (current) {score -= effectValue(current, itemLevel(hero, item.slot));}
  return score;
}

function scoreUpgrade(hero: Hero, offer: Extract<LootOffer, { kind: 'UPGRADE' }>, profile: Profile): number {
  const from = Math.max(0, offer.toLevel - 1);
  const before = deriveGhost(hero, offer.item.slot, offer.item, from);
  const after = deriveGhost(hero, offer.item.slot, offer.item, offer.toLevel);
  let score = statGain(before, after, profile);
  score += effectValue(offer.item, offer.toLevel);
  score -= effectValue(offer.item, from);
  score += RARITY_BONUS[offer.item.rarity] * 0.8;
  return score;
}

function scoreAnyUpgrade(hero: Hero, profile: Profile): number {
  let best = 0;
  for (const target of upgradableTargets(hero)) {
    const offer = resolveUpgrade(hero, target);
    if (offer) {best = Math.max(best, scoreUpgrade(hero, offer, profile));}
  }
  return best;
}

const SCROLL_BASE: Record<SpellId, number> = {
  FIREBALL: 0, WATER: 22, SLASH: 24, THUNDER: 34,
  TWINBOLT: 0, LEECH: 0, QUAKE: 0, MEND: 0,
};

const SCROLL_DAMAGE_WEIGHT = 2.0;

function perCast(d: Derived, id: SpellId): number {
  const def = SPELLS[id];
  if (def.heal !== undefined) {return 0;}
  const base = def.scale === 'MAG' ? d.mag : d.atk;
  return base * def.mult * Math.max(1, def.hits);
}

function scoreScroll(hero: Hero, spell: SpellId): number {
  if (hero.baseSpells.includes(spell)) {return 0;}
  const d = derive(hero);
  let best = hero.equipment.WEAPON?.weaponKind === 'MAGIC' ? d.mag : d.atk;
  for (const id of knownSpells(hero)) {best = Math.max(best, perCast(d, id));}
  const delta = Math.max(0, perCast(d, spell) - best);
  return SCROLL_BASE[spell] + delta * SCROLL_DAMAGE_WEIGHT;
}


function scoreOffer(hero: Hero, offer: LootOffer, profile: Profile, bonus?: ItemBonus): number {
  if (offer.kind === 'SCROLL') {return scoreScroll(hero, offer.spell);}
  if (offer.kind === 'UPGRADE') {return scoreUpgrade(hero, offer, profile);}
  if (offer.kind === 'UPGRADE_ANY') {return scoreAnyUpgrade(hero, profile);}
  return scoreItem(hero, offer.item, profile)
    + RARITY_BONUS[offer.item.rarity]
    + (bonus ? bonus(offer.item) : 0);
}

export function bestPick(hero: Hero, offered: LootOffer[], profile: Profile, bonus?: ItemBonus): LootOffer | null {
  let best: LootOffer | null = null;
  let bestScore = 0.5;
  for (const offer of offered) {
    const score = scoreOffer(hero, offer, profile, bonus);
    if (score > bestScore) {
      bestScore = score;
      best = offer;
    }
  }
  return best;
}

export function ownedScore(hero: Hero, owned: OwnedItem, profile: Profile, bonus?: ItemBonus): number {
  const { item, level } = owned;
  const bare = deriveGhost(hero, item.slot, undefined, 0);
  const worn = deriveGhost(hero, item.slot, item, level);
  return statGain(bare, worn, profile) + effectValue(item, level) + (bonus ? bonus(item) : 0);
}

export function upgradeGain(hero: Hero, target: UpgradeTarget, profile: Profile): number {
  const offer = resolveUpgrade(hero, target);
  return offer ? scoreUpgrade(hero, offer, profile) : -Infinity;
}

const GUARD_WEIGHT = 2;

export function foeProfile(profile: Profile, foe: EnemyDef): Profile {
  if (foe.atkType === 'MAGIC') {return { ...profile, mdef: profile.mdef * GUARD_WEIGHT };}
  return { ...profile, def: profile.def * GUARD_WEIGHT };
}
