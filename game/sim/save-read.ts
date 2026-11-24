import { ACTS_PER_DEPTH, AFFIX_IDS, EMBER_MAX, PACT_IDS, SLOTS, STAT_KEYS } from '../types';
import type { AffixId, Burn, Hero, PactId, Slot, StatKey } from '../types';
import { BIOMES, ENEMIES, ITEMS, SPELL_ORDER } from '../data';
import type { ActPlan } from './descent';
import type { RoomType } from './model';
import { maxLevelFor } from './gear';
import { fail, flag, idList, int, knownKey, list, num, oneOf, record, SCALED } from './save-check';
import type { Bounds, Fields } from './save-check';
import type { RewardStep, RoomExtras } from './save-battle';

export const SAVE_VERSION = 3;

export interface SavedItem { id: string; level: number }
export type SavedHero = Omit<Hero, 'equipment' | 'pack'> & { equipment: Partial<Record<Slot, string>>; pack: SavedItem[] };
export interface SavedNode { type: RoomType; links: number[]; cleared: boolean; enemyId?: string; affixes?: AffixId[] }
export interface SavedMap { stages: SavedNode[][]; curStage: number; reachable: number[]; cursor: number }
export interface SavedCounters { n: number; clears: number; bosses: number; descentClears: number | null; score: number; banked: number; won: boolean }
export type SavedStep = { at: 'MAP' } | ({ at: 'ROOM'; stage: number; slot: number } & RoomExtras) | RewardStep | { at: 'THRESHOLD' } | { at: 'PACT'; offers: PactId[] };
export interface SavedRun { version: typeof SAVE_VERSION; hero: SavedHero; run: SavedCounters; depthPlan: ActPlan[]; map: SavedMap; step: SavedStep; rng: number }

const COUNT: Bounds = { lo: 0, hi: 1e6 };
const SIGNED: Bounds = { lo: -1e6, hi: 1e6 };
const SCORE: Bounds = { lo: 0, hi: 1e12 };
const SMALL: Bounds = { lo: 0, hi: 99 };
const RNG_STATE: Bounds = { lo: 0, hi: 0xffffffff };
const MAX_STAGES = 40;
const MAX_SLOTS = 9;
const MAX_POOL = 24;
const ROOM_TYPES: readonly RoomType[] = ['FIGHT', 'ELITE', 'REST', 'LOOT', 'EVENT', 'BOSS'];
const STAGE_ROOMS = ['ELITE', 'REST', 'LOOT', 'EVENT', 'FIGHT'] as const;
const PACK_MAX = 8;

function itemOf(id: unknown, what: string) {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) {fail(`${what}: unknown item "${String(id)}"`);}
  return item;
}

function readOwned(value: unknown, what: string): SavedItem {
  const f = record(value, what);
  const item = itemOf(f.id, what);
  return { id: item.id, level: int(f.level, what, { lo: 0, hi: maxLevelFor(item) }) };
}

function readWorn(value: unknown): Partial<Record<Slot, string>> {
  const worn: Partial<Record<Slot, string>> = {};
  for (const [key, id] of Object.entries(record(value, 'equipment'))) {
    const slot = oneOf(key, 'equipment slot', SLOTS);
    const item = itemOf(id, `equipment ${slot}`);
    if (item.slot !== slot) {fail(`equipment ${slot}: ${item.id} belongs elsewhere`);}
    worn[slot] = item.id;
  }
  return worn;
}

function readLevels(value: unknown, worn: Partial<Record<Slot, string>>): Partial<Record<Slot, number>> {
  const levels: Partial<Record<Slot, number>> = {};
  for (const [key, level] of Object.entries(record(value, 'levels'))) {
    const slot = oneOf(key, 'level slot', SLOTS);
    const id = worn[slot];
    const hi = id === undefined ? MAX_SLOTS : maxLevelFor(itemOf(id, slot));
    levels[slot] = int(level, `level ${slot}`, { lo: 0, hi });
  }
  return levels;
}

function readAlloc(value: unknown): Record<StatKey, number> {
  const f = record(value, 'alloc');
  const entries = STAT_KEYS.map((k): [StatKey, number] => [k, int(f[k], `alloc ${k}`, COUNT)]);
  return Object.fromEntries(entries) as Record<StatKey, number>;
}

function readBurn(value: unknown): Burn | null {
  if (value === null) {return null;}
  const f = record(value, 'burn');
  return { perTurn: num(f.perTurn, 'burn', SCALED), turns: int(f.turns, 'burn turns', SMALL) };
}

function readPacts(value: unknown): PactId[] {
  const pacts = idList(value, 'pacts', PACT_IDS);
  if (new Set(pacts).size !== pacts.length) {fail('pacts: sworn twice');}
  return pacts;
}

function readHero(value: unknown): SavedHero {
  const f = record(value, 'hero');
  const equipment = readWorn(f.equipment);
  return {
    hp: num(f.hp, 'hp', COUNT), mp: num(f.mp, 'mp', COUNT), sp: int(f.sp, 'sp', COUNT),
    alloc: readAlloc(f.alloc),
    equipment,
    levels: readLevels(f.levels, equipment),
    pack: list(f.pack, 'pack', PACK_MAX).map((o, i) => readOwned(o, `pack ${String(i)}`)),
    baseSpells: idList(f.baseSpells, 'baseSpells', SPELL_ORDER),
    revived: flag(f.revived, 'revived'), revivedTwice: flag(f.revivedTwice, 'revivedTwice'),
    dryFights: int(f.dryFights, 'dryFights', COUNT),
    missedScrolls: idList(f.missedScrolls, 'missedScrolls', SPELL_ORDER),
    potions: int(f.potions, 'potions', SMALL), ember: num(f.ember, 'ember', { lo: 0, hi: EMBER_MAX }),
    burn: readBurn(f.burn), pendingBurn: num(f.pendingBurn, 'pendingBurn', COUNT), bonusMaxHp: num(f.bonusMaxHp, 'bonusMaxHp', SIGNED),
    pacts: readPacts(f.pacts),
  };
}

function readCounters(value: unknown): SavedCounters {
  const f = record(value, 'run');
  return {
    n: int(f.n, 'n', COUNT), clears: int(f.clears, 'clears', COUNT), bosses: int(f.bosses, 'bosses', COUNT),
    descentClears: f.descentClears === null ? null : int(f.descentClears, 'descentClears', COUNT),
    score: num(f.score, 'score', SCORE), banked: num(f.banked, 'banked', SCORE), won: flag(f.won, 'won'),
  };
}

const foeIds = (value: unknown, what: string): string[] => list(value, what, MAX_POOL).map((id) => knownKey(id, what, ENEMIES));

function readWeights(value: unknown): ActPlan['weights'] {
  const f = record(value, 'weights');
  const entries = STAGE_ROOMS.map((k) => [k, num(f[k], `weight ${k}`, COUNT)] as const);
  return Object.fromEntries(entries) as ActPlan['weights'];
}

function planExtras(f: Fields): Partial<ActPlan> {
  return {
    ...(f.scroll === undefined ? {} : { scroll: oneOf(f.scroll, 'scroll', SPELL_ORDER) }),
    ...(f.phaseAt === undefined ? {} : { phaseAt: num(f.phaseAt, 'phaseAt', { lo: 0, hi: 1 }) }),
    ...(f.affixOrder === undefined ? {} : { affixOrder: idList(f.affixOrder, 'affixOrder', AFFIX_IDS) }),
  };
}

function readPlan(value: unknown): ActPlan {
  const f = record(value, 'plan');
  const count = record(f.affixCount, 'affixCount');
  const sizes = list(f.stageSizes, 'stageSizes', MAX_STAGES).map((v) => int(v, 'stage size', { lo: 1, hi: MAX_SLOTS }));
  return {
    biomeIndex: int(f.biomeIndex, 'biomeIndex', { lo: 0, hi: BIOMES.length - 1 }),
    normals: foeIds(f.normals, 'normals'),
    elites: foeIds(f.elites, 'elites'),
    boss: knownKey(f.boss, 'boss', ENEMIES),
    ...planExtras(f),
    affixCount: { normal: int(count.normal, 'affix normal', SMALL), elite: int(count.elite, 'affix elite', SMALL) },
    stageSizes: sizes,
    weights: readWeights(f.weights),
  };
}

function readDepthPlan(value: unknown): ActPlan[] {
  const plans = list(value, 'depthPlan', ACTS_PER_DEPTH).map(readPlan);
  if (plans.length !== ACTS_PER_DEPTH) {fail('depthPlan: wrong act count');}
  return plans;
}

export { readCounters, readDepthPlan, readHero, RNG_STATE, ROOM_TYPES, MAX_SLOTS, MAX_STAGES };
