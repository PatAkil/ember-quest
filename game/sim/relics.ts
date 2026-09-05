// Ember Quest v3 — sim/relics.ts: rolling, levelling, forging, the set pool
// and set detection, sigils, `derive` and `compare`. Headless: no engine, no
// DOM, no localStorage, no Math.random — every integer draw is a ./rng
// primitive, every rolling function takes `rng` LAST, and every draw happens
// in exactly the contract's order (rollRelic's eight steps, an event's key
// then value, RECAST's key then rolls) so the harness's seed and the game's
// Math.random walk the same path and two faithful implementations agree bit
// for bit. DESIGN.md → Relics · Stats/Derivation · Characters · Run structure.
//
// Sections: constants · lookups · levels and values · pacts and tables ·
// substats · rolling · levelling and forging · sets and sigils · derive and
// HP · compare · card text · RunResult helpers.

import type {
  Element, LeaderSkill, LootSource, Modifier, PactId, Party, PartyMember, Rarity, Relic, RelicStat, Rng,
  SetBonus, SetId, SigilEffect, SigilId, Slot, Stat, Stats,
} from '../types';
import {
  ACTS, BASELINE, COMPARE_WEIGHTS, LEGENDARY_LEVEL_CAP, LEGENDARY_MAIN_MULT, LOOT_COUNT, MAIN_PER_LEVEL,
  MAIN_WEIGHT_SIGNATURE, RARITIES, RELIC_LEVEL_CAP, ROLL_THRESHOLDS, SET_POOL, SHARPEN_RELICS, SLOTS, STATS,
  SUBSTAT_MAX, SUBSTAT_POOL, SUBSTAT_START,
} from '../types';
import { DROP_LEVEL, LOOT_WEIGHTS, MAIN_BY_SLOT, MAIN_SIGNATURE, RELIC_MAIN_BASE, SUBSTAT_RANGES } from '../data/relics';
import { FOUR_PIECE_SETS, SETS, SET_IDS, TWO_PIECE_SETS } from '../data/sets';
import { SIGILS, SIGIL_IDS } from '../data/sigils';
import { PACTS } from '../data/pacts';
import { ASCENSION } from '../data/ascension';
import { pick, uniformInt, weighted, withoutReplacement } from './rng';

// ------------------------------------------------------------ constants ---
/** FORGE's base gain; a FORGE_LEVELS boon (DEARTH's +4) replaces it. A rules constant types.ts does not name yet. */
const FORGE_LEVELS_BASE = 2;
/** REST's sharpen: +1 on up to SHARPEN_RELICS uncapped relics one member wears. */
const SHARPEN_LEVELS = 1;
/** UI constraints (DESIGN.md → UI constraints) on the strings this module authors. */
export const TITLE_MAX = 11;
export const SUBSTAT_LINE_MAX = 10;
/** A card's inner width at TEXT_BODY: the who-wears-it compare line. */
export const COMPARE_LINE_MAX = 21;
/** FONT_HD has no →. */
const ARROW = '->';

// -------------------------------------------------------------- lookups ---
type Bucket = 'flat' | 'pct' | 'pts';
/** Which Stat a RelicStat feeds, through which derive bucket, and its card label. */
const RELIC_STAT: Record<RelicStat, { stat: Stat; bucket: Bucket; label: string }> = {
  HP: { stat: 'HP', bucket: 'flat', label: 'HP' },
  HP_PCT: { stat: 'HP', bucket: 'pct', label: 'HP%' },
  ATK: { stat: 'ATK', bucket: 'flat', label: 'ATK' },
  ATK_PCT: { stat: 'ATK', bucket: 'pct', label: 'ATK%' },
  DEF: { stat: 'DEF', bucket: 'flat', label: 'DEF' },
  DEF_PCT: { stat: 'DEF', bucket: 'pct', label: 'DEF%' },
  SPD: { stat: 'SPD', bucket: 'flat', label: 'SPD' },
  CRIT: { stat: 'CRIT', bucket: 'pts', label: 'CRIT' },
  CDMG: { stat: 'CDMG', bucket: 'pts', label: 'CDMG' },
  ACC: { stat: 'ACC', bucket: 'pts', label: 'ACC' },
  RES: { stat: 'RES', bucket: 'pts', label: 'RES' },
};
const FLAT_STATS: readonly Stat[] = ['HP', 'ATK', 'DEF', 'SPD'];
const isFlat = (stat: Stat): boolean => FLAT_STATS.includes(stat);
/** The slot's two sigils in SIGILS order — step 8 draws uniformly over them. */
const sigilsOfSlot = (slot: Slot): readonly SigilId[] => SIGIL_IDS.filter((id) => SIGILS[id].slot === slot);
const SIGILS_BY_SLOT: Record<Slot, readonly SigilId[]> = {
  WEAPON: sigilsOfSlot('WEAPON'), BOOTS: sigilsOfSlot('BOOTS'), ARMOR: sigilsOfSlot('ARMOR'),
  NECKLACE: sigilsOfSlot('NECKLACE'), CHALICE: sigilsOfSlot('CHALICE'), TOME: sigilsOfSlot('TOME'),
};

const zeroStats = (): Stats => ({ HP: 0, ATK: 0, DEF: 0, SPD: 0, CRIT: 0, CDMG: 0, ACC: 0, RES: 0 });
function assertNever(x: never): never {
  throw new Error(`unhandled kind ${JSON.stringify(x)}`);
}

// ---------------------------------------------------- levels and values ---
/** +6, LEGENDARY +4. */
export function levelCap(rarity: Rarity): number {
  return rarity === 'LEGENDARY' ? LEGENDARY_LEVEL_CAP : RELIC_LEVEL_CAP;
}
/** Capped relics are offered neither FORGE's LEVEL nor REST's sharpen. */
export function isCapped(relic: Relic): boolean {
  return relic.level >= levelCap(relic.rarity);
}
/** An EPIC at +6 carrying its sigil; LEGENDARY caps at +4 and never kindles. */
export function isKindled(relic: Relic): boolean {
  return relic.rarity === 'EPIC' && relic.sigil !== undefined && relic.level >= RELIC_LEVEL_CAP;
}
/** main = round(base × (1 + MAIN_PER_LEVEL × level)); a LEGENDARY base already carries LEGENDARY_MAIN_MULT. */
export function mainValue(relic: Relic): number {
  return Math.round(relic.main.base * (1 + MAIN_PER_LEVEL * relic.level));
}
/** Substat i's accumulated value (its rolls are added, never re-rolled outside RECAST); 0 past the last. */
export function substatValue(relic: Relic, i: number): number {
  return relic.subs[i]?.value ?? 0;
}

// ---------------------------------------------------- pacts and tables ---
export interface RollCtx {
  act: number;
  lap: number;
  ascension: number;
  /** The run's set pool (rollSetPool); step 3 reads it in SETS order. */
  pool: readonly SetId[];
  pacts: readonly PactId[];
  /** A forced rarity draws no rarity: a boss's first card, every SUMMON card. */
  forced?: Rarity;
  /** Relic ids are a run-scoped counter, never rng. */
  nextId: () => string;
}
export type LevelCtx = Pick<RollCtx, 'ascension'>;
export type ForgeCtx = Pick<RollCtx, 'ascension' | 'pool' | 'pacts'>;

/** The curse and boon of every taken pact, pact order, curse before boon. */
function modifiers(pacts: readonly PactId[]): Modifier[] {
  return pacts.flatMap((id) => [PACTS[id].curse, PACTS[id].boon]);
}
/** HASTE's extra cards minus DEARTH's fewer, on every relic screen. */
function cardDelta(pacts: readonly PactId[]): number {
  let delta = 0;
  for (const m of modifiers(pacts)) {
    if (m.kind === 'EXTRA_CARDS') delta += m.count;
    else if (m.kind === 'FEWER_CARDS') delta -= m.count;
  }
  return delta;
}
/** VEIL's boon: levels every EPIC drop gains. */
function epicDropLevels(pacts: readonly PactId[]): number {
  let levels = 0;
  for (const m of modifiers(pacts)) if (m.kind === 'EPIC_DROP_LEVEL') levels += m.levels;
  return levels;
}
/** FORGE's LEVEL gain: +2, or a FORGE_LEVELS boon (DEARTH's +4) in its place. */
export function forgeLevels(pacts: readonly PactId[]): number {
  let levels = FORGE_LEVELS_BASE;
  for (const m of modifiers(pacts)) if (m.kind === 'FORGE_LEVELS') levels = Math.max(levels, m.levels);
  return levels;
}
/** LOOT_WEIGHTS and DROP_LEVEL read the act's row; laps read the act-6 row. */
function tableRow(act: number, lap: number): number {
  return lap > 1 ? ACTS - 1 : act - 1;
}

// ------------------------------------------------------------- substats ---
/** The inclusive roll range, its top lowered by the ascension row's substatTopMinus (A4+). */
function substatRange(key: RelicStat, ascension: number): readonly [number, number] {
  const [lo, hi] = SUBSTAT_RANGES[key];
  const row = ASCENSION[Math.max(0, Math.min(ASCENSION.length - 1, Math.floor(ascension)))];
  return [lo, Math.max(lo, hi - row.substatTopMinus)];
}
/** One draw: a fresh roll of `key`. */
function rollSubstat(key: RelicStat, ascension: number, rng: Rng): number {
  const [lo, hi] = substatRange(key, ascension);
  return uniformInt(lo, hi, rng);
}
/** SUBSTAT_POOL minus the main key and every sub key the relic carries, in pool order. */
function openKeys(relic: Relic): RelicStat[] {
  return SUBSTAT_POOL.filter((key) => key !== relic.main.key && !relic.subs.some((sub) => sub.key === key));
}
/** One draw: a key uniform over the open keys. */
function drawKey(relic: Relic, rng: Rng): RelicStat {
  const open = openKeys(relic);
  return open[pick(open.length, rng)];
}
/** Add a substat: key, then value. */
function addSubstat(relic: Relic, ascension: number, rng: Rng): void {
  const key = drawKey(relic, rng);
  relic.subs.push({ key, value: rollSubstat(key, ascension, rng), rolls: 1 });
}
/** One roll event: add (key, value) while under SUBSTAT_MAX, else upgrade (which, value) by ADDING a fresh roll. */
function rollEvent(relic: Relic, ascension: number, rng: Rng): void {
  if (relic.subs.length < SUBSTAT_MAX) {
    addSubstat(relic, ascension, rng);
    return;
  }
  const sub = relic.subs[pick(relic.subs.length, rng)];
  sub.value += rollSubstat(sub.key, ascension, rng);
  sub.rolls += 1;
}
/** Fires, in ROLL_THRESHOLDS order, the event of every threshold in (from, to]. Source-blind. */
function fireThresholds(relic: Relic, from: number, to: number, ascension: number, rng: Rng): void {
  for (const threshold of ROLL_THRESHOLDS) if (threshold > from && threshold <= to) rollEvent(relic, ascension, rng);
}

// -------------------------------------------------------------- rolling ---
/** Step 2: the source's LOOT_WEIGHTS row, cumulative COMMON → LEGENDARY. Every SUMMON card is EPIC and draws nothing. */
function rollRarity(source: LootSource, row: number, rng: Rng): Rarity {
  if (source === 'SUMMON') return 'EPIC';
  return RARITIES[weighted(LOOT_WEIGHTS[source][row], rng)];
}
/** Step 4: a fixed slot draws nothing; an open slot is weighted in table order, signatures at MAIN_WEIGHT_SIGNATURE. */
function rollMain(slot: Slot, rng: Rng): RelicStat {
  const mains = MAIN_BY_SLOT[slot];
  if (mains.length === 1) return mains[0];
  const weights = mains.map((key) => (MAIN_SIGNATURE[slot].includes(key) ? MAIN_WEIGHT_SIGNATURE : 1));
  return mains[weighted(weights, rng)];
}
/** The run's pool in SETS order — the order step 3 and REBRAND read it in. */
function orderedPool(pool: readonly SetId[]): SetId[] {
  const ordered = SET_IDS.filter((id) => pool.includes(id));
  if (ordered.length === 0) throw new Error('empty set pool');
  return ordered;
}

/**
 * One relic, drawn in exactly the contract's order: (1) slot uniform in slot
 * order; (2) rarity from the source's row — forced draws nothing; (3) set
 * uniform over the pool in SETS order; (4) main; (5) the rarity's starting
 * substats, key then value each; (6) level = DROP_LEVEL's integer, +1 for an
 * ELITE or BOSS card, +VEIL for an EPIC, then the cap, no further draw;
 * (7) the threshold events ≤ level in order; (8) the sigil, EPIC and
 * LEGENDARY only, uniform over the slot's two in SIGILS order.
 */
export function rollRelic(source: LootSource, ctx: RollCtx, rng: Rng): Relic {
  const id = ctx.nextId();
  const row = tableRow(ctx.act, ctx.lap);
  const slot = SLOTS[pick(SLOTS.length, rng)];
  const rarity = ctx.forced ?? rollRarity(source, row, rng);
  const pool = orderedPool(ctx.pool);
  const set = pool[pick(pool.length, rng)];
  const mainKey = rollMain(slot, rng);
  const relic: Relic = {
    id, slot, rarity, set, level: 0, kindled: false,
    main: { key: mainKey, base: RELIC_MAIN_BASE[mainKey] * (rarity === 'LEGENDARY' ? LEGENDARY_MAIN_MULT : 1) },
    subs: [],
  };
  for (let i = 0; i < SUBSTAT_START[rarity]; i++) addSubstat(relic, ctx.ascension, rng);
  const [lo, hi] = DROP_LEVEL[row];
  let level = uniformInt(lo, hi, rng);
  if (source === 'ELITE' || source === 'BOSS') level += 1;
  if (rarity === 'EPIC') level += epicDropLevels(ctx.pacts);
  relic.level = Math.min(level, levelCap(rarity));
  fireThresholds(relic, 0, relic.level, ctx.ascension, rng);
  if (rarity === 'EPIC' || rarity === 'LEGENDARY') {
    const sigils = SIGILS_BY_SLOT[slot];
    relic.sigil = sigils[pick(sigils.length, rng)];
  }
  relic.kindled = isKindled(relic);
  return relic;
}

/** Cards on a relic screen: max(1, LOOT_COUNT + HASTE's extra − DEARTH's fewer) for FIGHT, ELITE, LOOT and BOSS; a SUMMON always shows its one EPIC. */
export function cardCount(source: LootSource, pacts: readonly PactId[]): number {
  if (source === 'SUMMON') return LOOT_COUNT.SUMMON;
  return Math.max(1, LOOT_COUNT[source] + cardDelta(pacts));
}
/** A screen's cards in card order; a BOSS's first card is a forced EPIC (levelled as a BOSS card). */
export function rollCards(source: LootSource, count: number, ctx: RollCtx, rng: Rng): Relic[] {
  const cards: Relic[] = [];
  for (let i = 0; i < count; i++) {
    const forced = source === 'BOSS' && i === 0 ? 'EPIC' : ctx.forced;
    cards.push(rollRelic(source, forced ? { ...ctx, forced } : ctx, rng));
  }
  return cards;
}

// ------------------------------------------------ levelling and forging ---
/** +n, never past the cap, firing the event of every threshold crossed; returns the levels gained (0 draws nothing). */
export function addLevels(relic: Relic, n: number, ctx: LevelCtx, rng: Rng): number {
  const from = relic.level;
  const to = Math.min(levelCap(relic.rarity), from + n);
  if (to <= from) return 0;
  relic.level = to;
  fireThresholds(relic, from, to, ctx.ascension, rng);
  relic.kindled = isKindled(relic);
  return to - from;
}
/** REST's sharpen on one relic: +1. */
export function sharpen(relic: Relic, ctx: LevelCtx, rng: Rng): number {
  return addLevels(relic, SHARPEN_LEVELS, ctx, rng);
}
/** REST's sharpen: +1 on up to SHARPEN_RELICS uncapped relics the member wears, slot order; returns how many rose. */
export function sharpenMember(member: Wearer, ctx: LevelCtx, rng: Rng): number {
  let sharpened = 0;
  for (const relic of wornRelics(member)) {
    if (sharpened >= SHARPEN_RELICS) break;
    if (isCapped(relic)) continue;
    sharpen(relic, ctx, rng);
    sharpened += 1;
  }
  return sharpened;
}
/** REST's offer: the member indices wearing at least one uncapped relic. */
export function sharpenCandidates(party: Pick<Party, 'members'>): number[] {
  return party.members.flatMap((m, i) => (wornRelics(m).some((r) => !isCapped(r)) ? [i] : []));
}

export type ForgeMode = 'LEVEL' | 'RECAST' | 'REBRAND';
export interface ForgeOption {
  /** Index into `worn`. */
  relic: number;
  mode: ForgeMode;
  /** LEVEL: what this FORGE grants under the run's pacts. */
  levels?: number;
}
/** A policy's forge answer: RECAST names the substat index, REBRAND the target set. */
export interface ForgeChoice {
  mode: ForgeMode;
  substat?: number;
  set?: SetId;
}
/** Every legal (relic, mode) pair in `worn` order, modes LEVEL (uncapped only) · RECAST · REBRAND; [] is a FORGE with nothing to offer. */
export function forgeOptions(worn: readonly Relic[], pacts: readonly PactId[]): ForgeOption[] {
  const levels = forgeLevels(pacts);
  return worn.flatMap((relic, i) => [
    ...(isCapped(relic) ? [] : [{ relic: i, mode: 'LEVEL' as const, levels }]),
    { relic: i, mode: 'RECAST' as const },
    { relic: i, mode: 'REBRAND' as const },
  ]);
}
/** REBRAND's targets: every other pool set, worn sets allowed, SETS order. */
export function rebrandSets(relic: Relic, pool: readonly SetId[]): SetId[] {
  return orderedPool(pool).filter((id) => id !== relic.set);
}
/**
 * FORGE. LEVEL: +forgeLevels (uncapped only). RECAST: substat `substat` is
 * re-keyed to a different pool stat (key drawn uniform over the open keys)
 * and each of its `rolls` re-rolled in the new range, key then rolls in
 * order. REBRAND: another pool set, keeping every roll, no draw. An illegal
 * choice declines: false, no change, no draw.
 */
export function forge(relic: Relic, choice: ForgeChoice, ctx: ForgeCtx, rng: Rng): boolean {
  switch (choice.mode) {
    case 'LEVEL':
      if (isCapped(relic)) return false;
      addLevels(relic, forgeLevels(ctx.pacts), ctx, rng);
      return true;
    case 'RECAST': {
      const i = choice.substat;
      if (i === undefined || !Number.isInteger(i) || i < 0 || i >= relic.subs.length) return false;
      const sub = relic.subs[i];
      sub.key = drawKey(relic, rng);
      let value = 0;
      for (let roll = 0; roll < sub.rolls; roll++) value += rollSubstat(sub.key, ctx.ascension, rng);
      sub.value = value;
      return true;
    }
    case 'REBRAND':
      if (choice.set === undefined || !rebrandSets(relic, ctx.pool).includes(choice.set)) return false;
      relic.set = choice.set;
      return true;
    default:
      return assertNever(choice.mode);
  }
}

// ----------------------------------------------------- sets and sigils ---
/** The run's set pool: SET_POOL.four of the 4-piece then SET_POOL.two of the 2-piece sets without replacement (each drawn from a list in SETS order), unioned with the worn Vault relics' sets; distinct ids, insertion order (four, then two, then the Vault's) — callers that need SETS order (rollRelic's step 3, REBRAND) re-sort via `orderedPool`. */
export function rollSetPool(vaultWorn: readonly Relic[], rng: Rng): SetId[] {
  const four = withoutReplacement(FOUR_PIECE_SETS, SET_POOL.four, rng);
  const two = withoutReplacement(TWO_PIECE_SETS, SET_POOL.two, rng);
  const ids = new Set<SetId>([...four, ...two, ...vaultWorn.map((relic) => relic.set)]);
  return Array.from(ids);
}
/** Active set ids in SETS order: a 2-piece repeated floor(n / 2) times, a 4-piece once at n ≥ 4. */
export function activeSets(worn: readonly Relic[]): SetId[] {
  const active: SetId[] = [];
  for (const id of SET_IDS) {
    const n = worn.filter((relic) => relic.set === id).length;
    const times = SETS[id].pieces === 2 ? Math.floor(n / 2) : n >= 4 ? 1 : 0;
    for (let i = 0; i < times; i++) active.push(id);
  }
  return active;
}
/** Actor.sets: the active bonuses, a 2-piece repeated per pair. */
export function setBonuses(worn: readonly Relic[]): SetBonus[] {
  return activeSets(worn).map((id) => SETS[id].bonus);
}
/** The relic's sigil effect — the kindled one at +6 — or null for a COMMON or RARE. */
export function sigilOf(relic: Relic): SigilEffect | null {
  if (relic.sigil === undefined) return null;
  const def = SIGILS[relic.sigil];
  return isKindled(relic) && def.kindled ? def.kindled.effect : def.effect;
}
/** The card's blurb for the sigil, kindled when kindled; '' without one. */
export function sigilBlurb(relic: Relic): string {
  if (relic.sigil === undefined) return '';
  const def = SIGILS[relic.sigil];
  return isKindled(relic) && def.kindled ? def.kindled.blurb : def.blurb;
}
/** Actor.sigils: every worn sigil's effect, slot order. */
export function sigilEffects(worn: readonly Relic[]): SigilEffect[] {
  return worn.flatMap((relic) => {
    const effect = sigilOf(relic);
    return effect ? [effect] : [];
  });
}

// -------------------------------------------------------- derive and HP ---
export type Wearer = Pick<PartyMember, 'def' | 'relics' | 'awakened'>;
export interface DeriveCtx {
  /** The seat's leader skill, or null with no leader. */
  leader: LeaderSkill | null;
  /** Whether `member` holds the seat. Accepted for the call site's clarity; the formulas never read it — a leader's amount reaches every member, the leader included, and SCHISM reads each member's own skill. */
  leaderIsSelf?: boolean;
  pacts: readonly PactId[];
  /** RunConfig.spdDelta, the harness's --spd: a flat delta on base SPD before derive. */
  spdDelta?: number;
}
/** The member's relics in slot order. */
export function wornRelics(member: Wearer): Relic[] {
  return SLOTS.flatMap((slot) => {
    const relic = member.relics[slot];
    return relic ? [relic] : [];
  });
}
/** The stat-side set bonuses; the rest are battle hooks. */
function addSetBonus(bonus: SetBonus, pct: Stats, pts: Stats): void {
  switch (bonus.kind) {
    case 'STAT_PCT': pct[bonus.stat] += bonus.pct; break;
    case 'STAT_PTS': pts[bonus.stat] += bonus.pts; break;
    case 'IMMUNITY_START': pts.RES += bonus.res; break;
    case 'EXTRA_TURN': case 'STUN_ON_HIT': case 'LEECH': case 'ATB_ON_HIT': case 'COUNTER': case 'SHIELD_START': case 'DESTROY':
      break;
    default: assertNever(bonus);
  }
}
/** A leader skill in the stat's native unit — percent into pct for a flat stat, points into pts — `elementAmount` for a member of its element; `scale` is SCHISM's half, unrounded. */
function addLeader(skill: LeaderSkill, element: Element, scale: number, pct: Stats, pts: Stats): void {
  const own = skill.element !== undefined && skill.element === element ? skill.elementAmount ?? skill.amount : skill.amount;
  (isFlat(skill.stat) ? pct : pts)[skill.stat] += own * scale;
}
/**
 * The contract's derivation. flat = fixed mains + flat substats + awakening
 * flat; pct = % mains + % substats + FATAL/ENERGY/GUARD/SWIFT + leader % +
 * pact %; total = max(1, round((base + flat) × (1 + pct / 100))); pts =
 * baseline + point mains + point substats + BLADE/RAGE/FOCUS/ENDURE/WILL +
 * awakening pts + leader pts + pact pts, min 0, never rounded. Statuses never
 * enter.
 */
export function derive(member: Wearer, ctx: DeriveCtx): Stats {
  const { def } = member;
  const worn = wornRelics(member);
  const flat = zeroStats();
  const pct = zeroStats();
  const pts = zeroStats();
  const buckets: Record<Bucket, Stats> = { flat, pct, pts };
  for (const relic of worn) {
    const main = RELIC_STAT[relic.main.key];
    buckets[main.bucket][main.stat] += mainValue(relic);
    for (const sub of relic.subs) {
      const info = RELIC_STAT[sub.key];
      buckets[info.bucket][info.stat] += sub.value;
    }
  }
  for (const id of activeSets(worn)) addSetBonus(SETS[id].bonus, pct, pts);
  if (member.awakened && 'bonus' in def.awakening) {
    for (const [stat, amount] of Object.entries(def.awakening.bonus) as [Stat, number][]) {
      (isFlat(stat) ? flat : pts)[stat] += amount;
    }
  }
  let leaderOff = false;
  let leaderSelf = false;
  for (const m of modifiers(ctx.pacts)) {
    switch (m.kind) {
      case 'PARTY_ATK_PCT': pct.ATK += m.pct; break;
      case 'PARTY_RES': pts.RES += m.pts; break;
      case 'PARTY_ACC': pts.ACC += m.pts; break;
      case 'LEADER_OFF': leaderOff = true; break;
      case 'LEADER_SELF': leaderSelf = true; break;
      case 'ENEMY_SPD_PCT': case 'ENEMY_ATK_PCT': case 'BOSS_INVINCIBLE_START':   // enemy-side: battle.ts
      case 'EXTRA_CARDS': case 'FEWER_CARDS': case 'EPIC_DROP_LEVEL': case 'FORGE_LEVELS':   // loot-side: above
        break;
      default: assertNever(m);
    }
  }
  if (ctx.leader && !leaderOff) addLeader(ctx.leader, def.element, 1, pct, pts);
  if (leaderSelf) addLeader(def.leader, def.element, 0.5, pct, pts);
  const base: Stats = {
    HP: def.base.hp, ATK: def.base.atk, DEF: def.base.def, SPD: def.base.spd + (ctx.spdDelta ?? 0),
    CRIT: BASELINE.CRIT, CDMG: BASELINE.CDMG, ACC: BASELINE.ACC, RES: BASELINE.RES,
  };
  const out = zeroStats();
  for (const stat of STATS) {
    out[stat] = isFlat(stat)
      ? Math.max(1, Math.round((base[stat] + flat[stat]) * (1 + pct[stat] / 100)))
      : Math.max(0, base[stat] + pts[stat]);
  }
  return out;
}

/** Whenever a derive changes maxHp: hp === 0 ? 0 : max(1, round(maxNew × hp / maxOld)); an unchanged max leaves hp alone. */
export function rescaleHp(hp: number, maxOld: number, maxNew: number): number {
  if (maxNew === maxOld) return hp;
  return hp === 0 ? 0 : Math.max(1, Math.round((maxNew * hp) / maxOld));
}
/** Re-fits a member's HP to their derived max after anything that moved it (equip, unequip, move, swap, leader, awakening, pact, a level): pass the max derived BEFORE the change. Returns the new hp. */
export function refitHp(member: PartyMember, maxOld: number, ctx: DeriveCtx): number {
  member.hp = rescaleHp(member.hp, maxOld, derive(member, ctx).HP);
  return member.hp;
}
/** Puts `relic` in its slot, re-fitting HP; returns the piece it replaced. */
export function equip(member: PartyMember, relic: Relic, ctx: DeriveCtx): Relic | null {
  const maxOld = derive(member, ctx).HP;
  const replaced = member.relics[relic.slot] ?? null;
  member.relics[relic.slot] = relic;
  refitHp(member, maxOld, ctx);
  return replaced;
}
/** Empties a slot, re-fitting HP; returns the piece removed. */
export function unequip(member: PartyMember, slot: Slot, ctx: DeriveCtx): Relic | null {
  const removed = member.relics[slot] ?? null;
  if (!removed) return null;
  const maxOld = derive(member, ctx).HP;
  delete member.relics[slot];
  refitHp(member, maxOld, ctx);
  return removed;
}

// -------------------------------------------------------------- compare ---
export interface Comparison {
  /** ≤ COMPARE_LINE_MAX chars: the largest-|Δ| stat as "SPD 112->131", then the set bonuses the swap breaks (-SWIFT) and gains (+FATAL) while they fit; NO CHANGE when nothing moves. */
  line: string;
  /** Σ COMPARE_WEIGHTS[S] × Δ_S, Δ relative for the flats and /100 for the points; positive is an upgrade. */
  score: number;
  /** The stat the line names, null when no stat moves. */
  stat: Stat | null;
  before: Stats;
  after: Stats;
  broken: SetId[];
  gained: SetId[];
}
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** Set bonuses whose application count falls (broken) or rises (gained), SETS order. */
function setChanges(before: readonly Relic[], after: readonly Relic[]): { broken: SetId[]; gained: SetId[] } {
  const was = activeSets(before);
  const now = activeSets(after);
  const times = (list: SetId[], id: SetId): number => list.filter((x) => x === id).length;
  const broken: SetId[] = [];
  const gained: SetId[] = [];
  for (const id of SET_IDS) {
    const delta = times(now, id) - times(was, id);
    if (delta < 0) broken.push(id);
    else if (delta > 0) gained.push(id);
  }
  return { broken, gained };
}
/** The stat part then the set parts, space-joined; a line over COMPARE_LINE_MAX drops trailing set parts (the first part always stays). */
function fitLine(parts: readonly string[]): string {
  let line = parts[0];
  for (const part of parts.slice(1)) {
    if (line.length + 1 + part.length > COMPARE_LINE_MAX) break;
    line += ` ${part}`;
  }
  return line;
}
/**
 * What wearing `relic` (replacing the slot's current piece) changes for
 * `member`: derive with and without it, set bonuses gained or broken
 * included. The line names the largest-|Δ| stat as "SPD 112->131", then
 * every set bonus broken (-SWIFT) and gained (+FATAL); when that exceeds
 * COMPARE_LINE_MAX the stat shrinks to its signed delta ("HP +405") so the
 * set parts keep their room, and only then do trailing set parts drop.
 */
export function compare(member: Wearer, relic: Relic, ctx: DeriveCtx): Comparison {
  const before = derive(member, ctx);
  const withRelic: Wearer = { ...member, relics: { ...member.relics, [relic.slot]: relic } };
  const after = derive(withRelic, ctx);
  let score = 0;
  let stat: Stat | null = null;
  let top = 0;
  for (const s of STATS) {
    const delta = isFlat(s) ? (after[s] - before[s]) / before[s] : (after[s] - before[s]) / 100;
    score += COMPARE_WEIGHTS[s] * delta;
    if (Math.abs(delta) > top) {
      top = Math.abs(delta);
      stat = s;
    }
  }
  const { broken, gained } = setChanges(wornRelics(member), wornRelics(withRelic));
  const setParts = [...broken.map((id) => `-${SETS[id].name}`), ...gained.map((id) => `+${SETS[id].name}`)];
  let line = 'NO CHANGE';
  if (stat) {
    const full = [`${stat} ${fmt(before[stat])}${ARROW}${fmt(after[stat])}`, ...setParts].join(' ');
    const delta = after[stat] - before[stat];
    line = full.length <= COMPARE_LINE_MAX ? full : fitLine([`${stat} ${delta > 0 ? '+' : ''}${fmt(delta)}`, ...setParts]);
  } else if (setParts.length > 0) line = fitLine(setParts);
  return { line, score, stat, before, after, broken, gained };
}

// ------------------------------------------------------------ card text ---
/** The card and inspect label of a RelicStat: HP, HP%, ATK, ATK%, DEF, DEF%, SPD, CRIT, CDMG, ACC, RES. */
export function statLabel(key: RelicStat): string {
  return RELIC_STAT[key].label;
}
/** `<SET> +<level>`, ≤ TITLE_MAX. */
export function relicTitle(relic: Relic): string {
  return `${SETS[relic.set].name} +${relic.level}`;
}
/** `<label> <main>` at the relic's level, ≤ SUBSTAT_LINE_MAX. */
export function mainLine(relic: Relic): string {
  return `${statLabel(relic.main.key)} ${mainValue(relic)}`;
}
/** `<label> +<value>` for substat i, ≤ SUBSTAT_LINE_MAX; '' past the last. */
export function substatLine(relic: Relic, i: number): string {
  const sub = relic.subs[i];
  return sub ? `${statLabel(sub.key)} +${substatValue(relic, i)}` : '';
}

// ---------------------------------------------------- RunResult helpers ---
/** `worn`: every relic on every member, member then slot order. */
export function partyWorn(party: Pick<Party, 'members'>): Relic[] {
  return party.members.flatMap(wornRelics);
}
/** RunResult.mainsWorn: per member, the main key per slot in slot order, null where bare. */
export function mainsWorn(party: Pick<Party, 'members'>): (RelicStat | null)[][] {
  return party.members.map((m) => SLOTS.map((slot) => m.relics[slot]?.main.key ?? null));
}
/** RunResult.setsWorn: per member, the active set ids, a 2-piece repeated per pair. */
export function setsWorn(party: Pick<Party, 'members'>): SetId[][] {
  return party.members.map((m) => activeSets(wornRelics(m)));
}
/** RunResult.relicLevels: per member, per slot, the worn relic's level or −1 when empty. */
export function relicLevels(party: Pick<Party, 'members'>): number[][] {
  return party.members.map((m) => SLOTS.map((slot) => m.relics[slot]?.level ?? -1));
}
