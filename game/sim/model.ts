import type { BattleState, Derived, Hero, HeroAction, LootOffer, StatKey } from '../types';

export type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'BOSS';

export interface Policy {
  allocate(hero: Hero, d: Derived): StatKey;
  pick(hero: Hero, offered: LootOffer[], act: number): LootOffer | null;
  act(hero: Hero, d: Derived, battle: BattleState, actions: HeroAction[]): HeroAction;
  route(roomTypes: RoomType[]): number;
}
