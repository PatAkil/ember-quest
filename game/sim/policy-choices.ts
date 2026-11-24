import { POTIONS_MAX, SLOTS, type Hero, type Item, type OwnedItem, type Rarity, type Rng, type Slot, type UpgradeTarget } from '../types';
import type { EventDef, EventEffect, EventOption } from '../data';
import { eventOptionEnabled } from './events';
import { derive } from './hero';
import { itemLevel } from './gear';
import type { Policy } from './model';
import { swapIn } from './pack';
import { foeProfile, ownedScore, upgradeGain, type ItemBonus, type Profile } from './scoring';

export type PolicyChoices = Pick<Policy, 'stowOrEquip' | 'dropWhich' | 'upgradeTarget' | 'prepare' | 'eventChoice'>;

const SWAP_MARGIN = 0.5;

interface Taste { profile: Profile; bonus?: ItemBonus }

function wornOwned(hero: Hero, slot: Slot): OwnedItem | undefined {
  const item = hero.equipment[slot];
  return item ? { item, level: itemLevel(hero, slot) } : undefined;
}

function argBest<T>(items: readonly T[], score: (t: T) => number): number {
  let best = -1;
  let bestScore = -Infinity;
  items.forEach((t, i) => {
    const s = score(t);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

function stowOrEquip(hero: Hero, item: Item, taste: Taste): 'EQUIP' | 'STOW' {
  const worn = wornOwned(hero, item.slot);
  if (!worn) {return 'EQUIP';}
  const incoming = ownedScore(hero, { item, level: 0 }, taste.profile, taste.bonus);
  return incoming >= ownedScore(hero, worn, taste.profile, taste.bonus) ? 'EQUIP' : 'STOW';
}

function dropWhich(hero: Hero, entering: OwnedItem, taste: Taste): number {
  const candidates = [...hero.pack, entering];
  return argBest(candidates, (o) => -ownedScore(hero, o, taste.profile, taste.bonus));
}

function upgradeTarget(hero: Hero, targets: UpgradeTarget[], taste: Taste): number {
  const anyWorn = targets.some((t) => t.where === 'WORN');
  return Math.max(0, argBest(targets, (t) =>
    (anyWorn && t.where === 'PACK' ? -Infinity : upgradeGain(hero, t, taste.profile))));
}

function bestPackFor(hero: Hero, slot: Slot, taste: Taste): number {
  const worn = wornOwned(hero, slot);
  let bestScore = worn ? ownedScore(hero, worn, taste.profile, taste.bonus) + SWAP_MARGIN : 0;
  let best = -1;
  hero.pack.forEach((owned, index) => {
    if (owned.item.slot !== slot) {return;}
    const score = ownedScore(hero, owned, taste.profile, taste.bonus);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}

function prepare(hero: Hero, taste: Taste): void {
  for (const slot of SLOTS) {
    const index = bestPackFor(hero, slot, taste);
    if (index >= 0) {swapIn(hero, index);}
  }
}

const RARITY_VALUE: Record<Rarity, number> = { COMMON: 3, RARE: 8, EPIC: 14, LEGENDARY: 20 };
const SP_VALUE = 6;
const UPGRADE_VALUE = 10;
const MAX_HP_VALUE = 1;
const POTION_VALUE = 6;
const HEAL_VALUE = 40;
const ONLY_SPARE = -100;

interface Need { hero: Hero; hpFrac: number }

function hpTrade(need: Need, amount: number): number {
  if (amount > 0) {return Math.min(amount, 1 - need.hpFrac) * HEAL_VALUE;}
  return amount * (need.hpFrac < 0.5 ? 3 * HEAL_VALUE : HEAL_VALUE / 2);
}

function potionTrade(need: Need, amount: number): number {
  if (amount < 0) {return amount * POTION_VALUE * 1.5;}
  return Math.min(amount, POTIONS_MAX - need.hero.potions) * POTION_VALUE;
}

type ValueTable = { [K in EventEffect['kind']]: (need: Need, effect: Extract<EventEffect, { kind: K }>) => number };

const VALUE: ValueTable = {
  hpPct: (need, e) => hpTrade(need, e.amount),
  maxHp: (_need, e) => e.amount * MAX_HP_VALUE,
  sp: (_need, e) => e.amount * SP_VALUE,
  item: (_need, e) => RARITY_VALUE[e.rarity],
  upgradeAny: () => UPGRADE_VALUE,
  burnNextFight: (need) => (need.hpFrac < 0.6 ? -10 : -5),
  fullHeal: (need) => (1 - need.hpFrac) * HEAL_VALUE,
  dropPackItem: (need) => (need.hero.pack.length < 2 ? ONLY_SPARE : -4),
  potion: (need, e) => potionTrade(need, e.amount),
};

function effectValue(need: Need, effect: EventEffect): number {
  const value = VALUE[effect.kind] as (n: Need, e: EventEffect) => number;
  return value(need, effect);
}

function optionValue(hero: Hero, option: EventOption): number {
  if (!eventOptionEnabled(hero, option)) {return -Infinity;}
  const need: Need = { hero, hpFrac: hero.hp / Math.max(1, derive(hero).maxHp) };
  return option.effects.reduce((sum, e) => sum + effectValue(need, e), 0);
}

function scoredEventChoice(hero: Hero, event: EventDef): 0 | 1 {
  return optionValue(hero, event.options[1]) > optionValue(hero, event.options[0]) ? 1 : 0;
}

export function randomEventChoice(hero: Hero, event: EventDef, rng: Rng): 0 | 1 {
  const open = ([0, 1] as const).filter((i) => eventOptionEnabled(hero, event.options[i]));
  return open[Math.floor(rng() * open.length)] ?? 0;
}

export function choicesFor(profile: Profile, bonus?: ItemBonus): PolicyChoices {
  const taste: Taste = bonus ? { profile, bonus } : { profile };
  return {
    stowOrEquip: (hero, item) => stowOrEquip(hero, item, taste),
    dropWhich: (hero, entering) => dropWhich(hero, entering, taste),
    upgradeTarget: (hero, targets) => upgradeTarget(hero, targets, taste),
    prepare: (hero, foe) => { prepare(hero, { ...taste, profile: foeProfile(profile, foe) }); },
    eventChoice: scoredEventChoice,
  };
}
