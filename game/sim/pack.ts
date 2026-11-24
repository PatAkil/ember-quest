import { PACK_SIZE, SLOTS, type Hero, type OwnedItem, type Slot, type UpgradeTarget } from '../types';
import { itemLevel, maxLevelFor } from './gear';
import { clampVitals, equip } from './hero';

export function packSize(hero: Hero): number {
  return Math.max(PACK_SIZE, hero.pack.length);
}

export function ownedIds(hero: Hero): string[] {
  const ids: string[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item) {ids.push(item.id);}
  }
  for (const owned of hero.pack) {ids.push(owned.item.id);}
  return ids;
}

export function stow(hero: Hero, owned: OwnedItem): boolean {
  if (hero.pack.length >= packSize(hero)) {return false;}
  hero.pack.push({ item: owned.item, level: owned.level });
  return true;
}

export function discard(hero: Hero, packIndex: number): OwnedItem | undefined {
  if (packIndex < 0 || packIndex >= hero.pack.length) {return undefined;}
  const [gone] = hero.pack.splice(packIndex, 1);
  return gone;
}

export function swapIn(hero: Hero, packIndex: number): boolean {
  const incoming = discard(hero, packIndex);
  if (!incoming) {return false;}
  const outgoing = equip(hero, incoming.item, incoming.level);
  if (outgoing) {hero.pack.splice(packIndex, 0, outgoing);}
  clampVitals(hero, 1);
  return true;
}

export function unequip(hero: Hero, slot: Slot): boolean {
  const item = hero.equipment[slot];
  if (!item) {return false;}
  if (!stow(hero, { item, level: itemLevel(hero, slot) })) {return false;}
  Reflect.deleteProperty(hero.equipment, slot);
  Reflect.deleteProperty(hero.levels, slot);
  clampVitals(hero, 1);
  return true;
}

export function upgradableTargets(hero: Hero): UpgradeTarget[] {
  const out: UpgradeTarget[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item && itemLevel(hero, slot) < maxLevelFor(item)) {out.push({ where: 'WORN', slot });}
  }
  hero.pack.forEach((owned, index) => {
    if (owned.level < maxLevelFor(owned.item)) {out.push({ where: 'PACK', index });}
  });
  return out;
}

export function targetOwned(hero: Hero, target: UpgradeTarget): OwnedItem | undefined {
  if (target.where === 'PACK') {return hero.pack[target.index];}
  const item = hero.equipment[target.slot];
  return item ? { item, level: itemLevel(hero, target.slot) } : undefined;
}
