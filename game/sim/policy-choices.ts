import { SLOTS, type Hero, type Item, type OwnedItem, type Slot, type UpgradeTarget } from '../types';
import { itemLevel } from './gear';
import type { Policy } from './model';
import { swapIn } from './pack';
import { foeProfile, ownedScore, upgradeGain, type ItemBonus, type Profile } from './scoring';

export type PolicyChoices = Pick<Policy, 'stowOrEquip' | 'dropWhich' | 'upgradeTarget' | 'prepare'>;

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

export function choicesFor(profile: Profile, bonus?: ItemBonus): PolicyChoices {
  const taste: Taste = bonus ? { profile, bonus } : { profile };
  return {
    stowOrEquip: (hero, item) => stowOrEquip(hero, item, taste),
    dropWhich: (hero, entering) => dropWhich(hero, entering, taste),
    upgradeTarget: (hero, targets) => upgradeTarget(hero, targets, taste),
    prepare: (hero, foe) => { prepare(hero, { ...taste, profile: foeProfile(profile, foe) }); },
  };
}
