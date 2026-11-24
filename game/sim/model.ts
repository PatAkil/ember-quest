import type { EventDef } from '../data';
import type { BattleState, Derived, EnemyDef, Hero, HeroAction, Item, LootOffer, OwnedItem, PactId, StatKey, UpgradeTarget } from '../types';

export type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'EVENT' | 'BOSS';

export interface Policy {
  allocate(hero: Hero, d: Derived): StatKey;
  pick(hero: Hero, offered: LootOffer[], act: number): LootOffer | null;
  act(hero: Hero, d: Derived, battle: BattleState, actions: HeroAction[]): HeroAction;
  route(roomTypes: RoomType[]): number;
  stowOrEquip(hero: Hero, item: Item): 'EQUIP' | 'STOW';
  dropWhich(hero: Hero, entering: OwnedItem): number;
  upgradeTarget(hero: Hero, targets: UpgradeTarget[]): number;
  prepare(hero: Hero, foe: EnemyDef): void;
  eventChoice(hero: Hero, event: EventDef): 0 | 1;
  pactChoice(hero: Hero, offers: readonly PactId[]): number;
}
