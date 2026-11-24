import {
  FIGHT_DROP_CHANCE,
  MAX_LEVEL,
  MISSED_SCROLL_CHANCE,
  PITY_AFTER,
  RARITIES,
  UPGRADE_CHANCE,
  type Hero,
  type Item,
  type LootOffer,
  type LootSource,
  type OwnedItem,
  type Rng,
  type SpellId,
  type UpgradeTarget,
} from '../types';
import { BIOMES, ITEMS, LOOT_COUNT, LOOT_WEIGHTS, SPELLS } from '../data';
import { maxLevelFor } from './gear';
import { clampVitals, equip, learnSpell } from './hero';
import { ownedIds, packSize, stow, targetOwned, upgradableTargets } from './pack';
import { clamp, isNonEmpty, pick } from './util';

type UpgradeOffer = Extract<LootOffer, { kind: 'UPGRADE' }>;

export interface AppliedOffer { line: string; replaced?: OwnedItem; stowed: boolean; overflow?: OwnedItem }

export interface OfferChoice { stow?: boolean }

const MAX_OFFERS = 4;

export function resolveUpgrade(hero: Hero, target: UpgradeTarget): UpgradeOffer | null {
  const owned = targetOwned(hero, target);
  if (!owned || owned.level >= maxLevelFor(owned.item)) {return null;}
  return { kind: 'UPGRADE', target, item: owned.item, toLevel: owned.level + 1 };
}

function setLevel(hero: Hero, target: UpgradeTarget, level: number): void {
  if (target.where === 'WORN') {
    hero.levels[target.slot] = level;
    return;
  }
  const owned = hero.pack[target.index];
  if (owned) {owned.level = level;}
}

function applyScroll(hero: Hero, spell: SpellId): AppliedOffer {
  learnSpell(hero, spell);
  hero.missedScrolls = hero.missedScrolls.filter((s) => s !== spell);
  return { line: `YOU LEARNED ${SPELLS[spell].name}`.slice(0, 30), stowed: false };
}

function applyUpgrade(hero: Hero, offer: UpgradeOffer): AppliedOffer {
  const level = clamp(Math.floor(offer.toLevel), 0, maxLevelFor(offer.item));
  setLevel(hero, offer.target, level);
  clampVitals(hero, 1);
  const awakened = level >= MAX_LEVEL ? offer.item.awaken?.blurb : undefined;
  if (awakened) {
    const long = `AWAKENED: ${awakened}`;
    return { line: (long.length <= 30 ? long : awakened).slice(0, 30), stowed: false };
  }
  return { line: `+${level} ${offer.item.name}`.slice(0, 30), stowed: false };
}

function firstUpgrade(hero: Hero): UpgradeOffer | null {
  const [target] = upgradableTargets(hero);
  return target ? resolveUpgrade(hero, target) : null;
}

function intoPack(hero: Hero, entering: OwnedItem): OwnedItem | undefined {
  return stow(hero, entering) ? undefined : entering;
}

function applyItem(hero: Hero, item: Item, choice: OfferChoice): AppliedOffer {
  const line = item.blurb.slice(0, 30);
  if (!hero.equipment[item.slot]) {
    equip(hero, item);
    return { line, stowed: false };
  }
  if (choice.stow) {
    const overflow = intoPack(hero, { item, level: 0 });
    return overflow ? { line, stowed: true, overflow } : { line, stowed: true };
  }
  const replaced = equip(hero, item);
  const overflow = replaced ? intoPack(hero, replaced) : undefined;
  if (!replaced) {return { line, stowed: false };}
  return overflow ? { line, replaced, stowed: false, overflow } : { line, replaced, stowed: false };
}

export function resolveOverflow(hero: Hero, entering: OwnedItem, dropIndex: number): OwnedItem {
  const candidates = [...hero.pack, entering];
  const index = clamp(Math.floor(dropIndex), 0, candidates.length - 1);
  const dropped = candidates[index] ?? entering;
  const kept = candidates.filter((_, i) => i !== index);
  hero.pack = kept.slice(0, packSize(hero));
  return dropped;
}

export function applyOffer(hero: Hero, offer: LootOffer, _rng: Rng, choice: OfferChoice = {}): AppliedOffer {
  if (offer.kind === 'SCROLL') {return applyScroll(hero, offer.spell);}
  if (offer.kind === 'ITEM') {return applyItem(hero, offer.item, choice);}
  const upgrade = offer.kind === 'UPGRADE' ? offer : firstUpgrade(hero);
  return upgrade ? applyUpgrade(hero, upgrade) : { line: 'NOTHING TO UPGRADE', stowed: false };
}

function fightIsDry(hero: Hero, rng: Rng): boolean {
  if (rng() >= FIGHT_DROP_CHANCE && hero.dryFights < PITY_AFTER) {
    hero.dryFights += 1;
    return true;
  }
  hero.dryFights = 0;
  return false;
}

function missedScrollOffer(hero: Hero, rng: Rng): LootOffer | null {
  const missed = oldestMissedScroll(hero, null);
  if (missed && rng() < MISSED_SCROLL_CHANCE) {return { kind: 'SCROLL', spell: missed };}
  return null;
}

function upgradeOffer(source: Exclude<LootSource, 'BOSS'>, want: number, hero: Hero, rng: Rng): LootOffer | null {
  if (want > 0 && upgradableTargets(hero).length > 0 && rng() < UPGRADE_CHANCE[source]) {
    return { kind: 'UPGRADE_ANY' };
  }
  return null;
}

function starterWeapons(hero: Hero, act: number): Item[] {
  const owned = new Set(ownedIds(hero));
  return ITEMS.filter((i) =>
    i.slot === 'WEAPON' && i.rarity === 'COMMON' && !i.bossOnly && !owned.has(i.id) && (i.minAct ?? 0) <= act);
}

export function ensureStarterWeapon(offers: LootOffer[], hero: Hero, act: number, rng: Rng): void {
  if (hero.equipment.WEAPON) {return;}
  if (offers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON')) {return;}
  const lastItem = offers.reduce((last, o, i) => (o.kind === 'ITEM' ? i : last), -1);
  const starters = starterWeapons(hero, act);
  if (lastItem < 0 || !isNonEmpty(starters)) {return;}
  offers[lastItem] = { kind: 'ITEM', item: pick(starters, rng) };
}

export function rollLoot(source: LootSource, act: number, hero: Hero, rng: Rng): LootOffer[] {
  if (source === 'FIGHT' && fightIsDry(hero, rng)) {return [];}
  const offers = source === 'BOSS' ? rollBossLoot(act, hero, rng) : rollRoomLoot(source, act, hero, rng);
  ensureStarterWeapon(offers, hero, act, rng);
  return offers.slice(0, MAX_OFFERS);
}

function rollRoomLoot(source: Exclude<LootSource, 'BOSS'>, act: number, hero: Hero, rng: Rng): LootOffer[] {
  const want = LOOT_COUNT[source];
  const offers: LootOffer[] = [];
  const pity = source === 'LOOT' ? missedScrollOffer(hero, rng) : null;
  const bonus = pity ?? upgradeOffer(source, want, hero, rng);
  if (bonus) {offers.push(bonus);}
  for (const item of rollItems({ source, act, want: want - offers.length }, hero, rng)) {
    offers.push({ kind: 'ITEM', item });
  }
  return offers;
}

function signatureFor(bossId: string, hero: Hero): Item | undefined {
  const item = ITEMS.find((i) => i.bossOnly === bossId);
  if (!item) {return undefined;}
  return ownedIds(hero).includes(item.id) ? undefined : item;
}

function oldestMissedScroll(hero: Hero, except: SpellId | null): SpellId | undefined {
  return hero.missedScrolls.find((sp) => sp !== except && !hero.baseSpells.includes(sp));
}

function rollBossLoot(act: number, hero: Hero, rng: Rng): LootOffer[] {
  const biome = BIOMES[clamp(act, 0, BIOMES.length - 1)];
  const offers: LootOffer[] = [];
  const scroll = biome?.scroll;
  if (scroll && !hero.baseSpells.includes(scroll)) {offers.push({ kind: 'SCROLL', spell: scroll });}
  const signature = biome ? signatureFor(biome.boss, hero) : undefined;
  if (signature) {offers.push({ kind: 'ITEM', item: signature });}
  const missed = oldestMissedScroll(hero, scroll ?? null);
  if (missed) {offers.push({ kind: 'SCROLL', spell: missed });}
  const equippedHere = new Set(offers.map((o) => (o.kind === 'ITEM' ? o.item.id : '')));
  for (const item of rollItems({ source: 'BOSS', act, want: LOOT_COUNT.BOSS - offers.length }, hero, rng)) {
    if (equippedHere.has(item.id)) {continue;}
    offers.push({ kind: 'ITEM', item });
  }
  return offers;
}

export function noteDeclinedScrolls(hero: Hero, offers: LootOffer[], taken: LootOffer | null): void {
  for (const offer of offers) {
    if (offer.kind !== 'SCROLL' || offer === taken) {continue;}
    if (hero.baseSpells.includes(offer.spell)) {continue;}
    if (hero.missedScrolls.includes(offer.spell)) {continue;}
    hero.missedScrolls.push(offer.spell);
  }
}

interface ItemRoll { source: LootSource; act: number; want: number }

function firstFilled(bucket: (ri: number) => Item[], start: number): Item[] {
  for (let ri = start; ri >= 0; ri -= 1) {
    const pool = bucket(ri);
    if (pool.length > 0) {return pool;}
  }
  for (let ri = 0; ri < RARITIES.length; ri += 1) {
    const pool = bucket(ri);
    if (pool.length > 0) {return pool;}
  }
  return [];
}

function rollItems({ source, act, want }: ItemRoll, hero: Hero, rng: Rng): Item[] {
  if (want <= 0) {return [];}
  const table = LOOT_WEIGHTS[source];
  const weights = table[clamp(act, 0, table.length - 1)] ?? [1, 0, 0, 0];
  const equipped = new Set(ownedIds(hero));
  const taken = new Set<string>();
  const available = ITEMS.filter((i) => !i.bossOnly && !equipped.has(i.id) && (i.minAct ?? 0) <= act);
  const bucket = (ri: number) =>
    available.filter((i) => i.rarity === RARITIES[ri] && !taken.has(i.id));
  const out: Item[] = [];
  for (let n = 0; n < want; n += 1) {
    const pool = firstFilled(bucket, rollRarity(weights, rng));
    if (!isNonEmpty(pool)) {break;}
    const item = pick(pool, rng);
    taken.add(item.id);
    out.push(item);
  }
  return out;
}

function rollRarity(weights: readonly number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) {total += Math.max(0, w);}
  if (total <= 0) {return 0;}
  let r = rng() * total;
  for (const [i, w] of weights.entries()) {
    r -= Math.max(0, w);
    if (r < 0) {return i;}
  }
  return weights.length - 1;
}
