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
import { ownedIds, targetOwned, upgradableTargets } from './pack';
import { clamp, isNonEmpty, pick } from './util';

type UpgradeOffer = Extract<LootOffer, { kind: 'UPGRADE' }>;
interface AppliedOffer { replaced?: OwnedItem; line: string }

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
  return { line: `YOU LEARNED ${SPELLS[spell].name}`.slice(0, 30) };
}

function applyUpgrade(hero: Hero, offer: UpgradeOffer): AppliedOffer {
  const level = clamp(Math.floor(offer.toLevel), 0, maxLevelFor(offer.item));
  setLevel(hero, offer.target, level);
  clampVitals(hero, 1);
  const awakened = level >= MAX_LEVEL ? offer.item.awaken?.blurb : undefined;
  if (awakened) {
    const long = `AWAKENED: ${awakened}`;
    return { line: (long.length <= 30 ? long : awakened).slice(0, 30) };
  }
  return { line: `+${level} ${offer.item.name}`.slice(0, 30) };
}

function firstUpgrade(hero: Hero): UpgradeOffer | null {
  const [target] = upgradableTargets(hero);
  return target ? resolveUpgrade(hero, target) : null;
}

export const applyOffer: (hero: Hero, offer: LootOffer, rng: Rng) => AppliedOffer = (hero, offer) => {
  if (offer.kind === 'SCROLL') {return applyScroll(hero, offer.spell);}
  if (offer.kind === 'ITEM') {
    const replaced = equip(hero, offer.item);
    return replaced ? { replaced, line: offer.item.blurb.slice(0, 30) } : { line: offer.item.blurb.slice(0, 30) };
  }
  const upgrade = offer.kind === 'UPGRADE' ? offer : firstUpgrade(hero);
  return upgrade ? applyUpgrade(hero, upgrade) : { line: 'NOTHING TO UPGRADE' };
};

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
  const upgradable = upgradableTargets(hero);
  if (want > 0 && isNonEmpty(upgradable) && rng() < UPGRADE_CHANCE[source]) {
    return resolveUpgrade(hero, pick(upgradable, rng));
  }
  return null;
}

export function rollLoot(source: LootSource, act: number, hero: Hero, rng: Rng): LootOffer[] {
  if (source === 'FIGHT' && fightIsDry(hero, rng)) {return [];}
  if (source === 'BOSS') {return rollBossLoot(act, hero, rng);}
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
