// Ember Quest v3 — sim/battle.ts: the ATB, the turn, damage, statuses, enemy
// AI, `intent`, `simulateBattle`, battle-log lines. Headless: no engine, no
// DOM, no localStorage, no Math.random — every draw is a ./rng primitive
// (`pick`, `chance`) in exactly DESIGN.md's order, `rng` always last.
// DESIGN.md → Combat (Turn order, The turn, Skills, Status effects, Damage,
// Enemies), Relics → Sets/Sigils (battle hooks), Characters (leader/awaken),
// Run structure → Pacts, Ascension, Difficulty targets (Policy, BATTLE_FIXTURES).
//
// Sections: battle-local types · math & lookups · ascension · actor build
// (derive/scale/spawnPack) · statuses & landing · elements & damage · skill
// resolution · counters · enemy AI & intent · act options & policies · the
// turn loop · simulateBattle · fixtures.

import type {
  Actor, ActOption, AscensionRow, BattleResult, Element, EnemyDef, EnemyId, LeaderSkill, Matchup, Modifier,
  PactId, Party, PartyMember, Probe, Rng, SetBonus, SigilEffect, SkillDef, SkillId, Stat, Status, StatusApply,
  StatusKind, Stats, TargetSpec,
} from '../types';
import {
  ATB_START_MAX, ATB_TURN, BASELINE, BURN_CAP_ATK, BURN_FRACTION, CAP_CRIT, CLEAR_GROWTH, COUNTER_MULT, DEF_K,
  ELEMENT_CRIT, ELEMENT_CRIT_LD, ENEMY_RESIST, ENEMY_RES_BASE, ENEMY_RES_KIND, ENEMY_RES_PER_ACT, ENRAGE_TURN,
  ENRAGE_TURNS, GLANCE_CHANCE, GLANCE_DEBUFF, GLANCE_MULT, SHIELD_TURNS, SPD_PER_ACT, SPD_PER_LAP,
  STATUS_MIN_CHANCE, STATUS_MOD, TURN_CAP, WILL_RES, WILL_TURNS,
} from '../types';
import { ASCENSION } from '../data/ascension';
import { ACT_MULT, BIOMES, BOSS_HP, ENEMIES, KIND_MULT, LAP_MULT } from '../data/enemies';
import { CHARACTERS } from '../data/characters';
import { PACTS } from '../data/pacts';
import { SKILLS } from '../data/skills';
import { derive, setBonuses, sigilEffects, wornRelics } from './relics';
import type { DeriveCtx } from './relics';
import { chance, pick } from './rng';

// ============================================================ battle types ==
/** A running battle: both sides plus the bookkeeping the rules need. Not persisted past the battle. */
export interface Battle {
  heroes: Actor[];
  enemies: Actor[];
  /** The original party object passed to createBattle — battleOutcome() writes final hp back onto it. */
  party: Party;
  /** The hero slot FOCUS aims at — independent of SCHISM, which only removes the leader's stat bonus. */
  leaderSlot: number;
  log: string[];
  /** Structured, data-only presentation events, pushed at the point each thing happens. A screen drains this
   * array after each runTurn(); simulateBattle never reads it (a fresh Battle per call, discarded with it). */
  events: BattleEvent[];
  actorTurns: number;
  heroTurns: number;
  rng: Rng;
  policy: ActPolicy;
  pacts: readonly PactId[];
  ascension: number;
  act: number;
  lap: number;
  /** True from the first ENRAGED enemy turn on — BattleResult.enraged. */
  enraged: boolean;
  /** VEIL's once-per-battle low-HP boss INVINCIBLE. */
  veilUsed: boolean;
  /** Actors that have made their first non-counter cast this battle (OPENER's gate). */
  firstCastDone: WeakSet<object>;
  /** The Probe's reference enemy: the pack's BOSS if any, else its first member. */
  bossRef: Actor | null;
  probeAcc: ProbeAcc;
  /** Probe snapshot taken at battle start (createBattle), read back by battleOutcome(). */
  startPartySpd: number;
  startHeroMaxHp: number;
  /** The Probe's bossHp: the reference enemy's maxHp at entry, before DESTROY can shrink it. */
  startBossMaxHp: number;
}

/**
 * Presentation-only, data-only events — a closed union, pushed at the point each thing happens as the rules
 * resolve. No engine, no strings beyond ids: a screen turns these into poses, VFX, pops, bars and sfx.
 */
export type BattleEvent =
  | { kind: 'TURN_START'; actor: Actor; enraged: boolean }
  | { kind: 'TURN_END'; actor: Actor }
  | { kind: 'CAST'; caster: Actor; skill: SkillId; targets: Actor[] }
  | { kind: 'HIT'; attacker: Actor; target: Actor; dealt: number; absorb: number; crit: boolean; glance: boolean; killed: boolean }
  | { kind: 'STATUS_APPLIED'; target: Actor; status: StatusKind; turns: number }
  | { kind: 'STATUS_RESISTED'; target: Actor; status: StatusKind; turns: number }
  | { kind: 'STATUS_EXPIRED'; target: Actor; status: StatusKind; turns: number }
  | { kind: 'HEAL'; target: Actor; amount: number; source: Actor }
  | { kind: 'ATB_CHANGE'; actor: Actor; delta: number; reason: string }
  | { kind: 'COUNTER'; actor: Actor; target: Actor }
  | { kind: 'DEATH'; actor: Actor }
  | { kind: 'BURN_TICK'; actor: Actor; amount: number }
  | { kind: 'VEIL'; actor: Actor }
  | { kind: 'STALL' };

interface ProbeAcc {
  dmgDealtToBoss: number;
  hitsTakenByHeroes: number;
  hpLostByHeroes: number;
  stunsOnBoss: number;
  debuffsResistedOnBoss: number;
  ttk: number;
  bossDied: boolean;
}

/** What a Policy answers `act` with — `Pick<Policy, 'act'>` (Policy itself lands with sim/run.ts in phase 6a). */
export type ActFn = (battle: Battle, actor: Actor, options: ActOption[], rng: Rng) => number;
export interface ActPolicy {
  act: ActFn;
}

/** Extra battle-start context beyond the fixed (party, enemies, policy, rng) contract: optional so the
 * harness's four-argument call is untouched; a full run (phase 6a) will pass all four. `spdDelta` is the
 * harness's --spd on the BATTLE_FIXTURES path (DESIGN.md → Difficulty targets: "the --battles fixtures
 * included") — sim/run.ts's own RunConfig.spdDelta reaches `derive` by baking into each member's cloned
 * CharacterDef.base.spd instead (see that file's Contract notes), so a real run never sets this field. */
export interface BattleCtx {
  pacts?: readonly PactId[];
  ascension?: number;
  act?: number;
  lap?: number;
  spdDelta?: number;
}

/** What the enemy turn ribbon shows: the skill about to fire, or that the actor is stunned. Never the target. */
export interface Intent {
  stunned: boolean;
  skill: SkillId | null;
}

/** spawnPack's scaling inputs — DESIGN.md → Enemies → Scale. */
export interface ScaleCtx {
  act: number;
  lap: number;
  ascension: number;
  clearsThisAct: number;
  pacts: readonly PactId[];
}

/** One BATTLE_FIXTURES row: a name for --fixture, and a fresh (party, enemies) builder. */
export interface Fixture {
  name: string;
  make: (rng: Rng) => { party: Party; enemies: Actor[] };
}

// ================================================================= lookups ==
const clamp = (x: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, x));

/** Ascension rows are indexed defensively — a bad level reads the nearest real row instead of throwing. */
function ascensionRow(ascension: number): AscensionRow {
  const a = Math.max(0, Math.min(ASCENSION.length - 1, Math.floor(ascension)));
  return ASCENSION[a];
}

// --- elements ---------------------------------------------------------------
/** FIRE beats WIND beats WATER beats FIRE. LIGHT and DARK sit outside the triangle. */
const TRIANGLE_BEATS: Partial<Record<Element, Element>> = { FIRE: 'WIND', WIND: 'WATER', WATER: 'FIRE' };
const isTriangle = (e: Element): boolean => e === 'FIRE' || e === 'WIND' || e === 'WATER';

/** LIGHT vs DARK is advantage both ways; LIGHT/DARK vs the triangle (and each other's mirror) is neutral. */
export function matchup(attacker: Element, defender: Element): Matchup {
  if ((attacker === 'LIGHT' && defender === 'DARK') || (attacker === 'DARK' && defender === 'LIGHT')) return 'ADVANTAGE';
  if (!isTriangle(attacker) || !isTriangle(defender)) return 'NEUTRAL';
  if (TRIANGLE_BEATS[attacker] === defender) return 'ADVANTAGE';
  if (TRIANGLE_BEATS[defender] === attacker) return 'DISADVANTAGE';
  return 'NEUTRAL';
}
/** Whether this is the LIGHT ⇄ DARK advantage pair — it carries its own crit bonus (ELEMENT_CRIT_LD). */
export function isLightDarkPair(attacker: Element, defender: Element): boolean {
  return (attacker === 'LIGHT' && defender === 'DARK') || (attacker === 'DARK' && defender === 'LIGHT');
}

// --- statuses (read-only helpers; mutation lives in the statuses section) ---
export function getStatus(actor: Actor, kind: StatusKind): Status | undefined {
  return actor.statuses.find((s) => s.kind === kind);
}
export function hasStatus(actor: Actor, kind: StatusKind): boolean {
  return getStatus(actor, kind) !== undefined;
}
/** Count of DEBUFF-kind statuses currently on the actor — BLOODLUST's `perDebuff`. */
function debuffCount(actor: Actor): number {
  return actor.statuses.filter((s) => DEBUFF_KINDS.has(s.kind)).length;
}
/** A local mirror of types.ts's DEBUFFS list (avoids importing an unused-elsewhere const set). */
const DEBUFF_KINDS = new Set<StatusKind>([
  'STUN', 'DEF_BREAK', 'ATK_BREAK', 'SLOW', 'BURN', 'HEAL_BLOCK', 'BRAND', 'SILENCE', 'GLANCE',
]);

/** ATK/DEF/SPD with their up/break status modifiers applied, unrounded. */
function statEff(actor: Actor, stat: Extract<Stat, 'ATK' | 'DEF' | 'SPD'>): number {
  const base = actor.stats[stat];
  let mod = 0;
  if (stat === 'ATK') mod = (hasStatus(actor, 'ATK_UP') ? STATUS_MOD.ATK_UP : 0) - (hasStatus(actor, 'ATK_BREAK') ? STATUS_MOD.ATK_BREAK : 0);
  else if (stat === 'DEF') mod = (hasStatus(actor, 'DEF_UP') ? STATUS_MOD.DEF_UP : 0) - (hasStatus(actor, 'DEF_BREAK') ? STATUS_MOD.DEF_BREAK : 0);
  else mod = (hasStatus(actor, 'SPD_UP') ? STATUS_MOD.SPD_UP : 0) - (hasStatus(actor, 'SLOW') ? STATUS_MOD.SLOW : 0);
  return base * (1 + mod);
}
/** What a skill's `scale` reads off the caster: HP is MAX HP (unmodified by status), SPD/ATK/DEF go through statEff. */
function scaleValue(actor: Actor, scale: SkillDef['scale']): number {
  return scale === 'HP' ? actor.maxHp : statEff(actor, scale);
}

// --- sets & sigils (battle-hook bonuses only — stat bonuses are already inside Actor.stats via derive) ---
function findSet<K extends SetBonus['kind']>(actor: Actor, kind: K): Extract<SetBonus, { kind: K }> | undefined {
  return actor.sets.find((s): s is Extract<SetBonus, { kind: K }> => s.kind === kind);
}
function findSigil<K extends SigilEffect['kind']>(actor: Actor, kind: K): Extract<SigilEffect, { kind: K }> | undefined {
  return actor.sigils.find((s): s is Extract<SigilEffect, { kind: K }> => s.kind === kind);
}

// --- sides & log -------------------------------------------------------------
function sideOf(battle: Battle, actor: Actor): Actor[] {
  return actor.side === 'HERO' ? battle.heroes : battle.enemies;
}
function otherSideOf(battle: Battle, actor: Actor): Actor[] {
  return actor.side === 'HERO' ? battle.enemies : battle.heroes;
}
export function livingHeroes(battle: Battle): Actor[] {
  return battle.heroes.filter((a) => a.alive);
}
export function livingEnemies(battle: Battle): Actor[] {
  return battle.enemies.filter((a) => a.alive);
}
function livingAllies(battle: Battle, actor: Actor): Actor[] {
  return sideOf(battle, actor).filter((a) => a.alive);
}
function livingOpponents(battle: Battle, actor: Actor): Actor[] {
  return otherSideOf(battle, actor).filter((a) => a.alive);
}
/** LOWEST_HP_ALLY: living allies including self, lowest hp/maxHp, tie → lowest slot. */
function lowestHpAlly(battle: Battle, actor: Actor): Actor | null {
  const pool = livingAllies(battle, actor);
  if (pool.length === 0) return null;
  return pool.reduce((best, a) => (a.hp / a.maxHp < best.hp / best.maxHp ? a : best));
}
/** Battle log: ≤ 72 chars, appended in event order. */
const LOG_LINE_MAX = 72;
function log(battle: Battle, line: string): void {
  battle.log.push(line.length > LOG_LINE_MAX ? line.slice(0, LOG_LINE_MAX) : line);
}

// ========================================================== actor building ==
/** Every curse/boon of the taken pacts, pact order, curse before boon (relics.ts keeps its own copy private). */
function pactModifiers(pacts: readonly PactId[]): Modifier[] {
  return pacts.flatMap((id) => [PACTS[id].curse, PACTS[id].boon]);
}
function pactPct(pacts: readonly PactId[], kind: 'ENEMY_SPD_PCT' | 'ENEMY_ATK_PCT'): number {
  let total = 0;
  for (const m of pactModifiers(pacts)) if (m.kind === kind) total += m.pct;
  return total;
}
/** VEIL's curse: the boss-invincible turns, or 0 without the pact. */
function veilInvincibleTurns(pacts: readonly PactId[]): number {
  for (const m of pactModifiers(pacts)) if (m.kind === 'BOSS_INVINCIBLE_START') return m.turns;
  return 0;
}

/** DESIGN.md → Enemies → Scale: hp/atk/def/spd/RES/resist from an EnemyDef at a given act, lap, ascension,
 * clear count and pact set. A BOSS's hp comes from BOSS_HP instead of base×ACT_MULT×KIND_MULT. `slot` is a
 * placeholder (0) — spawnPack sets the real position. */
export function scaleEnemy(def: EnemyDef, ctx: ScaleCtx): Actor {
  const { act, lap, ascension, clearsThisAct, pacts } = ctx;
  const row = ascensionRow(ascension);
  const kind = def.kind;
  const km = KIND_MULT[kind];
  const hasteSpdPct = pactPct(pacts, 'ENEMY_SPD_PCT');
  const furyAtkPct = pactPct(pacts, 'ENEMY_ATK_PCT');
  const clearMult = 1 + CLEAR_GROWTH * clearsThisAct;

  const hpBase = kind === 'BOSS' ? BOSS_HP[act - 1] : def.base.hp * ACT_MULT.hp[act - 1] * km.hp;
  const hp = Math.round(hpBase * (1 + row.enemyHpPct / 100) * Math.pow(LAP_MULT.hp, lap - 1) * clearMult);
  const atk = Math.round(
    def.base.atk * ACT_MULT.atk[act - 1] * km.atk * (1 + furyAtkPct / 100) *
    (1 + row.enemyAtkPct / 100) * Math.pow(LAP_MULT.atk, lap - 1) * clearMult,
  );
  const def_ = Math.round(def.base.def * ACT_MULT.def[act - 1] * km.def * Math.pow(LAP_MULT.def, lap - 1));
  const spd = Math.round(
    (def.base.spd + SPD_PER_ACT * (act - 1) + km.spd + SPD_PER_LAP * (lap - 1)) *
    (1 + row.enemySpdPct / 100) * (1 + hasteSpdPct / 100),
  );
  const isA10Boss = kind === 'BOSS' && row.bossWill;
  const res = (def.pts?.RES ?? ENEMY_RES_BASE) + ENEMY_RES_PER_ACT * (act - 1) + ENEMY_RES_KIND[kind] +
    row.enemyRes + (isA10Boss ? WILL_RES : 0);

  const stats: Stats = {
    HP: hp, ATK: atk, DEF: def_, SPD: spd,
    CRIT: def.pts?.CRIT ?? BASELINE.CRIT, CDMG: def.pts?.CDMG ?? BASELINE.CDMG,
    ACC: def.pts?.ACC ?? BASELINE.ACC, RES: res,
  };
  const resist = def.resist ?? { PHYSICAL: ENEMY_RESIST[kind], MAGIC: ENEMY_RESIST[kind] };
  return {
    side: 'ENEMY', slot: 0, def, stats, hp, maxHp: hp, baseMaxHp: hp, atb: 0,
    cooldowns: def.skills.map(() => 0), statuses: [], alive: hp > 0, resist, sets: [], sigils: [],
  };
}

/** Builds a pack in slot order from EnemyIds — DESIGN.md → Enemies → Packs/Scale. */
export function spawnPack(
  ids: readonly EnemyId[], act: number, lap: number, ascension: number, clearsThisAct: number,
  pacts: readonly PactId[],
): Actor[] {
  return ids.map((id, i) => {
    const def = ENEMIES[id];
    if (!def) throw new Error(`spawnPack: unknown enemy id "${id}"`);
    const actor = scaleEnemy(def, { act, lap, ascension, clearsThisAct, pacts });
    actor.slot = i as 0 | 1 | 2;
    return actor;
  });
}

/** One hero Actor from a PartyMember: stats via relics.ts's `derive`, sets/sigils from its worn relics,
 * HP carried over (clamped to the new max), heroes never carry a DamageKind resist. */
function buildHeroActor(member: PartyMember, slot: 0 | 1 | 2, leader: LeaderSkill | null, pacts: readonly PactId[], spdDelta?: number): Actor {
  const ctx: DeriveCtx = { leader, pacts, spdDelta };
  const stats = derive(member, ctx);
  const maxHp = stats.HP;
  const hp = clamp(Math.round(member.hp), 0, maxHp);
  const worn = wornRelics(member);
  return {
    side: 'HERO', slot, def: member.def, stats, hp, maxHp, baseMaxHp: maxHp, atb: 0,
    cooldowns: member.def.skills.map(() => 0), statuses: [], alive: hp > 0,
    resist: { PHYSICAL: 0, MAGIC: 0 }, sets: setBonuses(worn), sigils: sigilEffects(worn),
  };
}
/** The whole party as Actors, slot order; the leader's skill (if any) reaches every member via `derive`. */
function buildHeroes(party: Party, pacts: readonly PactId[], spdDelta?: number): Actor[] {
  const leaderSkill: LeaderSkill | null = party.members[party.leader]?.def.leader ?? null;
  return party.members.map((member, i) => buildHeroActor(member, i as 0 | 1 | 2, leaderSkill, pacts, spdDelta));
}
/** Probe's reference enemy: the pack's BOSS if it has one, else its first member. */
function pickBossRef(enemies: readonly Actor[]): Actor | null {
  return enemies.find((e) => (e.def as EnemyDef).kind === 'BOSS') ?? enemies[0] ?? null;
}
// ============================================================== statuses ===
/** Create or refresh one status: turns/pool take the max, BURN's dmg takes the max with the applier of the
 * larger value winning ties broken toward the OLDER applier (a smaller-or-equal dmg never displaces `by`). */
function applyStatus(target: Actor, kind: StatusKind, turns: number, opts: { pool?: number; dmg?: number; by?: number } = {}): void {
  const existing = getStatus(target, kind);
  if (!existing) {
    target.statuses.push({ kind, turns, pool: opts.pool, dmg: opts.dmg, by: opts.by });
    return;
  }
  existing.turns = Math.max(existing.turns, turns);
  if (opts.pool !== undefined) existing.pool = Math.max(existing.pool ?? 0, opts.pool);
  if (kind === 'BURN') {
    if (opts.dmg !== undefined && opts.dmg > (existing.dmg ?? 0)) { existing.dmg = opts.dmg; existing.by = opts.by; }
  } else if (opts.by !== undefined) {
    existing.by = opts.by;
  }
}
/** Debuffs removed lowest-index-in-`statuses` first, up to `n`; buffs are never touched. */
function removeDebuffs(target: Actor, n: number): void {
  if (n <= 0) return;
  let removed = 0;
  target.statuses = target.statuses.filter((s) => {
    if (removed < n && DEBUFF_KINDS.has(s.kind)) { removed += 1; return false; }
    return true;
  });
}
/** extendDebuffs / RENDER's kindled +1: an extension, not an application — passes IMMUNITY, no roll, no TRIP. */
function extendOneDebuff(target: Actor, extra: number): void {
  const s = target.statuses.find((st) => DEBUFF_KINDS.has(st.kind));
  if (s) s.turns += extra;
}
function extendAllDebuffs(target: Actor, extra: number): void {
  for (const s of target.statuses) if (DEBUFF_KINDS.has(s.kind)) s.turns += extra;
}
/** BASTION: shields the wearer receives are `round(base × (1 + bonus))` — 50% larger, or bigger still kindled.
 * Shared by every shield source (a skill's SHIELD apply, BULWARK's battle-start grant, GRUDGE's kindled one) —
 * each passes its own base amount; only who RECEIVES the shield (`wearer`) is checked for BASTION. */
function bastionBoost(wearer: Actor, base: number): number {
  const bastion = findSigil(wearer, 'BASTION');
  if (bastion?.cleanse) removeDebuffs(wearer, bastion.cleanse); // kindled: the shield also cleanses
  return Math.round(bastion ? base * (1 + bastion.bonus) : base);
}
/** A skill's SHIELD apply: magnitude is a fraction of the CASTER's max HP, boosted by the recipient's BASTION. */
function shieldPool(applier: Actor, wearer: Actor, magnitudeOfCasterMaxHp: number): number {
  return bastionBoost(wearer, applier.maxHp * magnitudeOfCasterMaxHp);
}
/** BURN's dmg is fixed at application: min(5% of the target's max HP, 2× the applier's ATK), true damage. */
function burnDamage(applier: Actor, target: Actor): number {
  return Math.min(Math.round(target.maxHp * BURN_FRACTION), Math.round(BURN_CAP_ATK * statEff(applier, 'ATK')));
}

/** The ACC/RES landing check: allies/self always land (no draw); IMMUNITY blocks a debuff outright (no draw);
 * otherwise `p = clamp(chance + (acc − res) / 100, STATUS_MIN_CHANCE, 1)`, kindled LOCKDOWN drops the `− res`
 * term entirely. A drawn boolean, never skipped once past the allySide/IMMUNITY gates (drawn even at p = 1). */
function rollLanding(battle: Battle, applier: Actor, target: Actor, baseChance: number, opts: { allySide: boolean; ignoreRes?: boolean }): boolean {
  if (opts.allySide) return true;
  if (hasStatus(target, 'IMMUNITY')) return false;
  const diff = opts.ignoreRes ? applier.stats.ACC : applier.stats.ACC - target.stats.RES;
  const p = clamp(baseChance + diff / 100, STATUS_MIN_CHANCE, 1);
  return chance(p, battle.rng);
}

/** One StatusApply against one target: LOCKDOWN's duration rider (debuffs only, STUN excluded) and RES-ignore,
 * the landing roll, then TRIP's silent ATB strip on a landed SLOW or STUN. Returns whether it landed. */
function applyOneStatus(battle: Battle, applier: Actor, target: Actor, apply: StatusApply): boolean {
  const kind = apply.status;
  const allySide = target.side === applier.side;
  const lockdown = findSigil(applier, 'LOCKDOWN');
  const isDebuff = DEBUFF_KINDS.has(kind);
  const extraTurns = lockdown && isDebuff && kind !== 'STUN' ? lockdown.extra : 0;
  const landed = rollLanding(battle, applier, target, apply.chance, { allySide, ignoreRes: !!lockdown?.ignoreRes });
  if (battle.bossRef && target === battle.bossRef && applier.side === 'HERO' && isDebuff && !landed) {
    battle.probeAcc.debuffsResistedOnBoss += 1;
  }
  if (!landed) {
    battle.events.push({ kind: 'STATUS_RESISTED', target, status: kind, turns: apply.turns });
    return false;
  }
  if (kind === 'STUN' && battle.bossRef && target === battle.bossRef && applier.side === 'HERO') {
    battle.probeAcc.stunsOnBoss += 1;
  }
  const turns = apply.turns + extraTurns;
  applyStatus(target, kind, turns, {
    pool: kind === 'SHIELD' && apply.magnitude !== undefined ? shieldPool(applier, target, apply.magnitude) : undefined,
    dmg: kind === 'BURN' ? burnDamage(applier, target) : undefined,
    by: applier.slot,
  });
  battle.events.push({ kind: 'STATUS_APPLIED', target, status: kind, turns });
  const trip = findSigil(applier, 'TRIP');
  if (trip && (kind === 'SLOW' || kind === 'STUN')) {
    const strip = kind === 'SLOW' ? trip.slowStrip : (trip.stunStrip ?? 0);
    if (strip > 0) {
      const before = target.atb;
      target.atb = Math.max(0, target.atb - ATB_TURN * strip);
      if (target.atb !== before) battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta: target.atb - before, reason: 'trip' });
    }
  }
  return true;
}
/** A skill's `atbBoost`: positive is an unconditional grant; negative is a debuff-class strip through the
 * landing formula at chance 1.0, floored at 0. Once per target, called after a cast's hits are resolved. */
function applyAtbBoost(battle: Battle, applier: Actor, target: Actor, atbBoost: number): void {
  if (atbBoost === 0) return;
  if (atbBoost > 0) {
    const delta = ATB_TURN * atbBoost;
    target.atb += delta;
    battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta, reason: 'skill' });
    return;
  }
  const allySide = target.side === applier.side;
  if (rollLanding(battle, applier, target, 1, { allySide })) {
    const before = target.atb;
    target.atb = Math.max(0, target.atb - ATB_TURN * Math.abs(atbBoost));
    battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta: target.atb - before, reason: 'skill' });
  }
}
/** RENDER: one crit-only landing roll at chance 1.0 strips the target's ATB; the kindled extension rides on
 * that same landed roll (it does not roll separately). */
function tryRenderStrip(battle: Battle, attacker: Actor, target: Actor): void {
  const render = findSigil(attacker, 'RENDER');
  if (!render) return;
  const allySide = target.side === attacker.side;
  if (!rollLanding(battle, attacker, target, 1, { allySide })) return;
  const before = target.atb;
  target.atb = Math.max(0, target.atb - ATB_TURN * render.strip);
  battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta: target.atb - before, reason: 'render' });
  if (render.extend) extendOneDebuff(target, render.extend);
}
/** DESPAIR: per hit (shielded/INVINCIBLE included), a flat chance to attempt a STUN through the SAME landing
 * machinery as any other application (so LOCKDOWN, IMMUNITY and TRIP all apply uniformly) at chance 1.0. */
function tryDespairStun(battle: Battle, attacker: Actor, target: Actor): void {
  const stunOnHit = findSet(attacker, 'STUN_ON_HIT');
  if (!stunOnHit) return;
  if (!chance(stunOnHit.chance, battle.rng)) return;
  applyOneStatus(battle, attacker, target, { status: 'STUN', chance: 1, turns: stunOnHit.turns });
}

/** Steps 3–5 of takeTurn: capture STUN before it can tick off, tick cooldowns (even stunned/silenced), then
 * tick every status's duration down and drop the ones that hit 0. Returns the captured `stunned` flag. */
function tickTurnStart(actor: Actor): boolean {
  const stunned = hasStatus(actor, 'STUN');
  for (let k = 0; k < actor.cooldowns.length; k++) actor.cooldowns[k] = Math.max(0, actor.cooldowns[k] - 1);
  actor.statuses = actor.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  return stunned;
}
/** Step 2: BURN's fixed damage; true damage, ignores DEF/element/crit/BRAND, absorbed by SHIELD (below),
 * zeroed by INVINCIBLE and lethal. Returns whether the actor died from it (the turn ends at once). */
function tickBurn(battle: Battle, actor: Actor): boolean {
  const burn = getStatus(actor, 'BURN');
  if (!burn || !burn.dmg) return false;
  if (hasStatus(actor, 'INVINCIBLE')) return false;
  let dmg = burn.dmg;
  const shield = getStatus(actor, 'SHIELD');
  if (shield && shield.pool) {
    const absorb = Math.min(dmg, shield.pool);
    shield.pool -= absorb;
    dmg -= absorb;
    if (shield.pool <= 0) actor.statuses = actor.statuses.filter((s) => s !== shield);
  }
  actor.hp -= dmg;
  battle.events.push({ kind: 'BURN_TICK', actor, amount: dmg });
  if (actor.hp <= 0) {
    actor.hp = 0;
    actor.alive = false;
    battle.events.push({ kind: 'DEATH', actor });
    return true;
  }
  return false;
}

// ================================================================= damage ===
/** CRIT + CRIT_UP + BLOODLUST's per-debuff bonus, read off the TARGET's current debuffs. */
function critPts(attacker: Actor, target: Actor): number {
  const bloodlust = findSigil(attacker, 'BLOODLUST');
  const perDebuff = bloodlust ? bloodlust.perDebuff : 0;
  return attacker.stats.CRIT + (hasStatus(attacker, 'CRIT_UP') ? STATUS_MOD.CRIT_UP : 0) + perDebuff * debuffCount(target);
}
/** DESTROY (attacker's 4pc), after absorb: shreds a slice of the target's max HP, never lethal by itself. */
function applyDestroy(attacker: Actor, target: Actor, dealt: number): void {
  const destroy = findSet(attacker, 'DESTROY');
  if (!destroy) return;
  const strip = Math.round(Math.min(destroy.dealt * dealt, destroy.fraction * target.maxHp));
  const newMax = Math.max(Math.round(destroy.floor * target.baseMaxHp), target.maxHp - strip);
  const shrink = target.maxHp - newMax;
  target.maxHp = newMax;
  target.hp = Math.max(1, target.hp - shrink);
}
/** NEMESIS (defender's 4pc, ATB on a landed hit) then GRUDGE (defender's sigil, a threshold crossing) — both
 * gated on `dealt − absorb > 0`, i.e. BURN and a fully shielded/INVINCIBLE hit never trigger either. */
function applyNemesisGrudge(battle: Battle, target: Actor, dealt: number, absorb: number): void {
  const netDamage = dealt - absorb;
  if (netDamage <= 0) return;
  const nemesis = findSet(target, 'ATB_ON_HIT');
  if (nemesis) {
    const delta = ATB_TURN * nemesis.fraction;
    target.atb += delta;
    battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta, reason: 'nemesis' });
  }
  const grudge = findSigil(target, 'GRUDGE');
  if (!grudge) return;
  const threshold = Math.round(grudge.threshold * target.maxHp);
  const hpBefore = target.hp + netDamage;
  if (hpBefore >= threshold && target.hp < threshold) {
    applyStatus(target, 'ATK_UP', grudge.turns);
    battle.events.push({ kind: 'STATUS_APPLIED', target, status: 'ATK_UP', turns: grudge.turns });
    if (grudge.shield !== undefined) {
      applyStatus(target, 'SHIELD', SHIELD_TURNS, { pool: shieldPool(target, target, grudge.shield) });
      battle.events.push({ kind: 'STATUS_APPLIED', target, status: 'SHIELD', turns: SHIELD_TURNS });
    }
  }
}

export interface HitOutcome {
  /** Rounded, pre-absorb — what the log, leech, VAMPIRE, DESTROY and NEMESIS/GRUDGE all read. */
  dealt: number;
  crit: boolean;
  glance: boolean;
  /** The target died from THIS hit — its part in the cast ends at once (no applies/DESPAIR/RENDER/DESTROY/NEMESIS/GRUDGE). */
  diedNow: boolean;
}

/**
 * One hit on one (already-known-living) target: raw damage → glance/crit → BRAND → mitigation/resist → the
 * INVINCIBLE/shield absorb → then, only if the target is still alive, the skill's own `applies`, DESPAIR,
 * RENDER, DESTROY and NEMESIS/GRUDGE in that order. DESIGN.md → Damage, Status effects.
 */
function resolveOneHit(battle: Battle, attacker: Actor, target: Actor, skill: SkillDef, applies: readonly StatusApply[]): HitOutcome {
  const mu = matchup(attacker.def.element, target.def.element);
  let raw = scaleValue(attacker, skill.scale) * skill.mult;
  if (skill.bonusVs && hasStatus(target, skill.bonusVs.status)) raw *= skill.bonusVs.mult;

  const glanceP = hasStatus(attacker, 'GLANCE') ? GLANCE_DEBUFF[mu] : mu === 'DISADVANTAGE' ? GLANCE_CHANCE : 0;
  const glance = glanceP > 0 && battle.rng() < glanceP;
  let crit = false;
  if (!glance) {
    const elementBonus = mu === 'ADVANTAGE' ? (isLightDarkPair(attacker.def.element, target.def.element) ? ELEMENT_CRIT_LD : ELEMENT_CRIT) : 0;
    crit = battle.rng() * 100 < clamp(critPts(attacker, target) + elementBonus, 0, CAP_CRIT);
  }
  raw *= glance ? GLANCE_MULT : crit ? 1 + attacker.stats.CDMG / 100 : 1;
  if (hasStatus(target, 'BRAND')) raw *= STATUS_MOD.BRAND;

  const defEff = statEff(target, 'DEF');
  let dealt = raw * (1 - defEff / (defEff + DEF_K)) * (1 - target.resist[skill.kind] / 100);
  dealt = hasStatus(target, 'INVINCIBLE') ? 0 : Math.max(1, Math.round(dealt));

  const shield = getStatus(target, 'SHIELD');
  let absorb = 0;
  if (shield?.pool) {
    absorb = Math.min(dealt, shield.pool);
    shield.pool -= absorb;
    if (shield.pool <= 0) target.statuses = target.statuses.filter((s) => s !== shield);
  }
  if (battle.bossRef && target === battle.bossRef && attacker.side === 'HERO') battle.probeAcc.dmgDealtToBoss += dealt;
  if (attacker.side === 'ENEMY' && target.side === 'HERO' && dealt > 0) {
    battle.probeAcc.hitsTakenByHeroes += 1;
    battle.probeAcc.hpLostByHeroes += dealt - absorb;
  }
  target.hp -= dealt - absorb;
  const diedNow = target.hp <= 0;
  if (diedNow) { target.hp = 0; target.alive = false; }
  battle.events.push({ kind: 'HIT', attacker, target, dealt, absorb, crit, glance, killed: diedNow });
  if (diedNow) {
    battle.events.push({ kind: 'DEATH', actor: target });
    return { dealt, crit, glance, diedNow: true };
  }

  for (const apply of applies) {
    const recipients = apply.target ? resolveTargets(battle, attacker, apply.target, -1) : [target];
    for (const r of recipients) if (r.alive) applyOneStatus(battle, attacker, r, apply);
  }
  tryDespairStun(battle, attacker, target);
  if (crit) tryRenderStrip(battle, attacker, target);
  applyDestroy(attacker, target, dealt);
  applyNemesisGrudge(battle, target, dealt, absorb);
  return { dealt, crit, glance, diedNow: false };
}

// ========================================================== skill casting ==
function actorName(actor: Actor): string {
  return actor.def.name;
}
/** A heal respects HEAL_BLOCK (zeroes it) and caps at missing HP; returns the amount actually restored. */
function healActor(actor: Actor, amount: number): number {
  if (amount <= 0 || hasStatus(actor, 'HEAL_BLOCK')) return 0;
  const healed = Math.min(amount, actor.maxHp - actor.hp);
  actor.hp += healed;
  return healed;
}
function logHit(battle: Battle, attacker: Actor, target: Actor, skill: SkillDef, outcome: HitOutcome): void {
  const marker = outcome.glance ? ' (glance)' : outcome.crit ? ' (crit)' : '';
  log(battle, `${actorName(attacker)} ${skill.verb} ${actorName(target)} for ${outcome.dealt}!${marker}`);
}
/** SPARK: a crit shortens the highest remaining cooldown by 1 (tie lowest index), or kindled every cooldown. */
function applySpark(actor: Actor): void {
  const spark = findSigil(actor, 'SPARK');
  if (!spark) return;
  if (spark.all) {
    for (let k = 0; k < actor.cooldowns.length; k++) actor.cooldowns[k] = Math.max(0, actor.cooldowns[k] - 1);
    return;
  }
  let bestIdx = -1;
  let bestVal = 0;
  for (let k = 0; k < actor.cooldowns.length; k++) if (actor.cooldowns[k] > bestVal) { bestVal = actor.cooldowns[k]; bestIdx = k; }
  if (bestIdx >= 0) actor.cooldowns[bestIdx] -= 1;
}
/** A TargetSpec relative to `actor`, resolved to concrete living Actors — `targetSlot` is a living-side SLOT
 * index (as enumerated by actOptions), unused by the single-answer specs. Snapshotted at call time. */
function resolveTargets(battle: Battle, actor: Actor, spec: TargetSpec, targetSlot: number): Actor[] {
  switch (spec) {
    case 'SELF': return [actor];
    case 'ENEMY': { const t = otherSideOf(battle, actor)[targetSlot]; return t?.alive ? [t] : []; }
    case 'ALL_ENEMIES': return livingOpponents(battle, actor);
    case 'ALLY': { const t = sideOf(battle, actor)[targetSlot]; return t?.alive ? [t] : []; }
    case 'ALL_ALLIES': return livingAllies(battle, actor);
    case 'LOWEST_HP_ALLY': { const a = lowestHpAlly(battle, actor); return a ? [a] : []; }
    default: return [];
  }
}

export interface CastOptions {
  /** A counter: no step-8 cooldown write, no OPENER, never triggers a further counter, not a turn. */
  isCounter?: boolean;
}
/**
 * Resolves `skill` cast by `actor` on the (already snapshotted) `targets`. DESIGN.md → Skills, Status effects,
 * Damage, Sets, Sigils. `skillIndex` addresses `actor.cooldowns`/ECHO's list; ignored for a counter.
 */
function castSkill(battle: Battle, actor: Actor, skill: SkillDef, targets: readonly Actor[], skillIndex: number, opts: CastOptions = {}): void {
  const isCounter = !!opts.isCounter;
  const firstCast = !isCounter && !battle.firstCastDone.has(actor);
  const applies = skill.applies ?? [];
  const castSkillDef = isCounter && skill.mult > 0 ? { ...skill, mult: skill.mult * COUNTER_MULT } : skill;

  let totalDealt = 0;
  let anyCrit = false;
  const kills: Actor[] = [];
  if (skill.hits > 0) {
    for (let hitIdx = 0; hitIdx < skill.hits; hitIdx++) {
      for (const target of targets) {
        if (!target.alive) continue;
        const outcome = resolveOneHit(battle, actor, target, castSkillDef, applies);
        totalDealt += outcome.dealt;
        if (outcome.crit) anyCrit = true;
        if (outcome.diedNow) kills.push(target);
        logHit(battle, actor, target, skill, outcome);
      }
    }
  }

  // Per-target phase, slot order: cleanse (skill's, then MENDING's) → heal → applies-for-hits=0 →
  // extendDebuffs → atbBoost → MENDING's ATB.
  const mending = findSigil(actor, 'MENDING');
  const healsThisSkill = (skill.heal ?? 0) > 0;
  for (const target of targets) {
    if (!target.alive) continue;
    if (skill.cleanse) removeDebuffs(target, skill.cleanse);
    if (mending && healsThisSkill) removeDebuffs(target, 1);
    if (skill.heal) {
      const healed = healActor(target, Math.round(actor.maxHp * skill.heal));
      battle.events.push({ kind: 'HEAL', target, amount: healed, source: actor });
    }
    if (skill.hits === 0) {
      for (const apply of applies) {
        const recipients = apply.target ? resolveTargets(battle, actor, apply.target, -1) : [target];
        for (const r of recipients) if (r.alive) applyOneStatus(battle, actor, r, apply);
      }
    }
    if (skill.extendDebuffs) extendAllDebuffs(target, skill.extendDebuffs);
    if (skill.atbBoost) applyAtbBoost(battle, actor, target, skill.atbBoost);
    if (mending?.atb && healsThisSkill) {
      const delta = ATB_TURN * mending.atb;
      target.atb += delta;
      battle.events.push({ kind: 'ATB_CHANGE', actor: target, delta, reason: 'mending' });
    }
  }

  // Per-skill phase: leech, VAMPIRE (two heals), SURGE (per kill), SPARK (on any crit).
  if (skill.leech) {
    const healed = healActor(actor, Math.round(totalDealt * skill.leech));
    battle.events.push({ kind: 'HEAL', target: actor, amount: healed, source: actor });
  }
  const vampire = findSet(actor, 'LEECH');
  if (vampire) {
    const h1 = healActor(actor, Math.round(totalDealt * vampire.fraction));
    battle.events.push({ kind: 'HEAL', target: actor, amount: h1, source: actor });
    const h2 = healActor(actor, Math.round(totalDealt * vampire.fraction));
    battle.events.push({ kind: 'HEAL', target: actor, amount: h2, source: actor });
  }
  if (kills.length > 0) {
    const surge = findSigil(actor, 'SURGE');
    if (surge) {
      for (let i = 0; i < kills.length; i++) {
        actor.atb += ATB_TURN * surge.self;
        battle.events.push({ kind: 'ATB_CHANGE', actor, delta: ATB_TURN * surge.self, reason: 'surge' });
        if (surge.allies) {
          for (const ally of livingAllies(battle, actor)) {
            if (ally === actor) continue;
            ally.atb += ATB_TURN * surge.allies;
            battle.events.push({ kind: 'ATB_CHANGE', actor: ally, delta: ATB_TURN * surge.allies, reason: 'surge' });
          }
        }
      }
    }
  }
  if (anyCrit) applySpark(actor);

  if (!isCounter) {
    let cd = skill.cooldown;
    if (skill.refundOnKill && kills.length > 0) cd = 0;
    const echo = findSigil(actor, 'ECHO');
    if (echo && echo.skills.includes(skillIndex)) cd = Math.max(1, cd - 1);
    const opener = findSigil(actor, 'OPENER');
    if (firstCast && opener) {
      cd = 0;
      if (opener.atb) {
        const delta = ATB_TURN * opener.atb;
        actor.atb += delta;
        battle.events.push({ kind: 'ATB_CHANGE', actor, delta, reason: 'opener' });
      }
    }
    actor.cooldowns[skillIndex] = cd;
    battle.firstCastDone.add(actor);
    if (skill.hits > 0) runCounters(battle, actor, targets.filter((t) => t.alive));
  }
}

// ================================================================ counters ==
/**
 * The counter hook: after ANY actor's step-8 write, before its step 9 — per living opposing actor the cast
 * hit, slot order. Certain under COUNTER or THORNS' condition, else a REVENGE wearer rolls. Not a turn: no
 * carry, no ticks, no VIOLENT roll, never itself triggers a counter.
 */
function runCounters(battle: Battle, attacker: Actor, hitTargets: readonly Actor[]): void {
  for (const target of hitTargets) {
    if (!target.alive || !attacker.alive || hasStatus(target, 'STUN')) continue;
    const thorns = findSigil(target, 'THORNS');
    const thornsReady = !!thorns && (hasStatus(target, 'DEF_UP') || hasStatus(target, 'SHIELD'));
    const certain = hasStatus(target, 'COUNTER') || thornsReady;
    const revenge = certain ? undefined : findSet(target, 'COUNTER');
    const willCounter = certain || (!!revenge && target.side === 'HERO' && chance(revenge.chance, battle.rng));
    if (!willCounter) continue;
    const base = SKILLS[target.def.skills[0]];
    const skillForCounter = thorns?.applyBreak
      ? { ...base, applies: [...(base.applies ?? []), { status: 'DEF_BREAK' as const, chance: thorns.applyBreak, turns: 2 }] }
      : base;
    battle.events.push({ kind: 'COUNTER', actor: target, target: attacker });
    castSkill(battle, target, skillForCounter, [attacker], -1, { isCounter: true });
  }
}
// ================================================================ enemy AI ==
/** A boss's 4th skill only exists once A5 (bossFourthSkill) unlocks it; every other enemy uses all of its skills. */
function availableSkillCount(actor: Actor, ascRow: AscensionRow): number {
  const total = actor.def.skills.length;
  if (actor.side === 'ENEMY' && (actor.def as EnemyDef).kind === 'BOSS' && !ascRow.bossFourthSkill) return Math.min(3, total);
  return total;
}
/** DESIGN.md → actOptions: cd[k] == 0 and (k == 0 or not SILENCEd), within the currently available skills. */
function isSkillLegal(actor: Actor, k: number, ascRow: AscensionRow): boolean {
  if (k < 0 || k >= availableSkillCount(actor, ascRow)) return false;
  if (k > 0 && hasStatus(actor, 'SILENCE')) return false;
  return actor.cooldowns[k] === 0;
}
/** Enemy AI's own skill choice: the highest-index legal skill (skill 1 — always legal — is the fallback). */
function chooseSkillIndex(actor: Actor, ascRow: AscensionRow): number {
  for (let k = availableSkillCount(actor, ascRow) - 1; k >= 1; k--) if (isSkillLegal(actor, k, ascRow)) return k;
  return 0;
}
/** FOCUS: the living leader, else the lowest hp/maxHp (pool is already slot-ascending, so a strict `<` keeps
 * the lowest slot on a tie). */
function focusTarget(battle: Battle, pool: readonly Actor[]): Actor {
  const leader = pool.find((a) => a.side === 'HERO' && a.slot === battle.leaderSlot);
  return leader ?? pool.reduce((best, a) => (a.hp / a.maxHp < best.hp / best.maxHp ? a : best));
}
/** An enemy's own target rule for its chosen skill's TargetSpec — SPREAD/FOCUS apply only to ENEMY-spec
 * skills; ALLY resolves as LOWEST_HP_ALLY over the living pack, per DESIGN.md → Enemies → AI. */
function chooseAiTarget(battle: Battle, actor: Actor, spec: TargetSpec): Actor[] {
  switch (spec) {
    case 'SELF': return [actor];
    case 'ALL_ENEMIES': return livingOpponents(battle, actor);
    case 'ALL_ALLIES': return livingAllies(battle, actor);
    case 'ALLY': case 'LOWEST_HP_ALLY': { const a = lowestHpAlly(battle, actor); return a ? [a] : []; }
    case 'ENEMY': {
      const pool = livingOpponents(battle, actor);
      if (pool.length === 0) return [];
      const ai = (actor.def as EnemyDef).ai;
      return [ai === 'SPREAD' ? pool[pick(pool.length, battle.rng)] : focusTarget(battle, pool)];
    }
    default: return [];
  }
}
/** The real (rng-consuming) choice an enemy makes on its own turn: skill index and its resolved targets. */
function chooseEnemyAction(battle: Battle, actor: Actor): { skillIndex: number; targets: Actor[] } {
  const skillIndex = chooseSkillIndex(actor, ascensionRow(battle.ascension));
  const skill = SKILLS[actor.def.skills[skillIndex]];
  return { skillIndex, targets: chooseAiTarget(battle, actor, skill.target) };
}
/** The turn ribbon's preview: the step-7 pick on a COPY after steps 4–5 (or STUNNED), never touching the
 * shared rng — and never the target, which stays untelegraphed (`chooseAiTarget` is not called here). */
export function intent(battle: Battle, enemy: Actor): Intent {
  const copy: Actor = { ...enemy, cooldowns: [...enemy.cooldowns], statuses: enemy.statuses.map((s) => ({ ...s })) };
  const stunned = tickTurnStart(copy);
  if (stunned) return { stunned: true, skill: null };
  const skillIndex = chooseSkillIndex(copy, ascensionRow(battle.ascension));
  return { stunned: false, skill: copy.def.skills[skillIndex] };
}

// ============================================================ act options ==
/**
 * Every legal (skill, target) pair for `actor`, skill order then target order: skill k legal when cd[k] == 0
 * and (k == 0 or not SILENCEd), within the currently available skills; ENEMY/ALLY specs enumerate one option
 * per living opposing/own slot ascending, every other spec exactly one option with target = −1.
 */
export function actOptions(battle: Battle, actor: Actor): ActOption[] {
  const row = ascensionRow(battle.ascension);
  const options: ActOption[] = [];
  const n = availableSkillCount(actor, row);
  for (let k = 0; k < n; k++) {
    if (!isSkillLegal(actor, k, row)) continue;
    const skill = SKILLS[actor.def.skills[k]];
    if (skill.target === 'ENEMY') {
      for (const t of otherSideOf(battle, actor)) if (t.alive) options.push({ skill: k, target: t.slot });
    } else if (skill.target === 'ALLY') {
      for (const t of sideOf(battle, actor)) if (t.alive) options.push({ skill: k, target: t.slot });
    } else {
      options.push({ skill: k, target: -1 });
    }
  }
  return options;
}

// ================================================================ policies ==
/** The expected `dealt` of one hit, folding in glance/crit at their exact probabilities (an estimate: it does
 * not rebuild the per-hit `max(1, round(...))` floor) — `balanced`'s damage heuristic. */
function expectedHitDamage(actor: Actor, skill: SkillDef, target: Actor): number {
  const mu = matchup(actor.def.element, target.def.element);
  let raw = scaleValue(actor, skill.scale) * skill.mult;
  if (skill.bonusVs && hasStatus(target, skill.bonusVs.status)) raw *= skill.bonusVs.mult;
  const glanceP = hasStatus(actor, 'GLANCE') ? GLANCE_DEBUFF[mu] : mu === 'DISADVANTAGE' ? GLANCE_CHANCE : 0;
  const elementBonus = mu === 'ADVANTAGE' ? (isLightDarkPair(actor.def.element, target.def.element) ? ELEMENT_CRIT_LD : ELEMENT_CRIT) : 0;
  const critP = clamp(critPts(actor, target) + elementBonus, 0, CAP_CRIT) / 100;
  const critMult = 1 + actor.stats.CDMG / 100;
  raw *= glanceP * GLANCE_MULT + (1 - glanceP) * (critP * critMult + (1 - critP));
  if (hasStatus(target, 'BRAND')) raw *= STATUS_MOD.BRAND;
  const defEff = statEff(target, 'DEF');
  const mitigated = raw * (1 - defEff / (defEff + DEF_K)) * (1 - target.resist[skill.kind] / 100);
  return hasStatus(target, 'INVINCIBLE') ? 0 : Math.max(0, mitigated);
}
/** Σ expected damage over every living target this option would hit, × its hit count; −Infinity for a
 * non-damaging skill so `balanced` never mistakes a pure buff/heal for its best damage option. */
function scoreDamageOption(actor: Actor, skill: SkillDef, targets: readonly Actor[]): number {
  if (skill.mult <= 0 || skill.hits <= 0) return -Infinity;
  let total = 0;
  for (const t of targets) if (t.alive) total += expectedHitDamage(actor, skill, t);
  return total * skill.hits;
}
/** `random`: one `pick` over the legal options — the < 3% floor every other policy is measured against. */
function randomAct(_battle: Battle, _actor: Actor, options: ActOption[], rng: Rng): number {
  return pick(options.length, rng);
}
/** `balanced`: a heal reaching the lowest ally when any ally is below 40% HP, else the option maximising
 * expected `dealt` (crit/glance at their probabilities); ties keep the lowest index throughout. */
function balancedAct(battle: Battle, actor: Actor, options: ActOption[], _rng: Rng): number {
  const allies = livingAllies(battle, actor);
  const anyLow = allies.some((a) => a.hp / a.maxHp < 0.4);
  if (anyLow) {
    const lowest = allies.reduce((best, a) => (a.hp / a.maxHp < best.hp / best.maxHp ? a : best));
    for (let i = 0; i < options.length; i++) {
      const skill = SKILLS[actor.def.skills[options[i].skill]];
      if (!skill.heal) continue;
      if (resolveTargets(battle, actor, skill.target, options[i].target).includes(lowest)) return i;
    }
  }
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < options.length; i++) {
    const skill = SKILLS[actor.def.skills[options[i].skill]];
    const targets = resolveTargets(battle, actor, skill.target, options[i].target);
    const score = scoreDamageOption(actor, skill, targets);
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}
export const POLICY_ACTS: Record<string, ActFn> = { random: randomAct, balanced: balancedAct };

// =============================================================== the turn ==
function livingActors(battle: Battle): Actor[] {
  return [...battle.heroes, ...battle.enemies].filter((a) => a.alive);
}
/** spdEff, read fresh at every `advance()`. */
const spdEff = (actor: Actor): number => statEff(actor, 'SPD');

/** advance(): Δ = min over living actors of (ATB_TURN − atb)/spdEff (0 if any atb ≥ ATB_TURN already); every
 * actor whose Δ ties the minimum is set to exactly ATB_TURN, the rest add spdEff × Δ. */
function advance(battle: Battle): void {
  const actors = livingActors(battle);
  if (actors.length === 0 || actors.some((a) => a.atb >= ATB_TURN)) return;
  const deltas = actors.map((a) => (ATB_TURN - a.atb) / spdEff(a));
  const minDelta = Math.min(...deltas);
  actors.forEach((a, i) => { a.atb = deltas[i] === minDelta ? ATB_TURN : a.atb + spdEff(a) * minDelta; });
}
/** ready(): living actors with atb ≥ ATB_TURN, atb desc → spdEff desc → heroes before enemies → slot asc. */
function readyQueue(battle: Battle): Actor[] {
  return livingActors(battle).filter((a) => a.atb >= ATB_TURN).sort((a, b) => {
    if (b.atb !== a.atb) return b.atb - a.atb;
    const bySpd = spdEff(b) - spdEff(a);
    if (bySpd !== 0) return bySpd;
    if (a.side !== b.side) return a.side === 'HERO' ? -1 : 1;
    return a.slot - b.slot;
  });
}
/** Fills bars until someone is ready, or returns null once a side is already empty. */
function nextActor(battle: Battle): Actor | null {
  for (let guard = 0; guard < 100000; guard++) {
    const queue = readyQueue(battle);
    if (queue.length > 0) return queue[0];
    if (livingActors(battle).length === 0) return null;
    advance(battle);
  }
  return null;
}
function bothSidesAlive(battle: Battle): boolean {
  return livingHeroes(battle).length > 0 && livingEnemies(battle).length > 0;
}
/** VEIL, between steps 5 and 6 of a BOSS turn: once per battle, INVINCIBLE again below 50% HP (stunned turns
 * and a BURN crossing at step 2 both count — this runs regardless of the captured `stunned` flag). */
function maybeVeilInvincible(battle: Battle, a: Actor): void {
  if (battle.veilUsed || a.side !== 'ENEMY' || (a.def as EnemyDef).kind !== 'BOSS') return;
  if (!battle.pacts.includes('VEIL') || a.hp >= Math.round(0.5 * a.maxHp)) return;
  const turns = veilInvincibleTurns(battle.pacts);
  if (turns <= 0) return;
  applyStatus(a, 'INVINCIBLE', turns);
  battle.veilUsed = true;
  battle.events.push({ kind: 'STATUS_APPLIED', target: a, status: 'INVINCIBLE', turns });
  battle.events.push({ kind: 'VEIL', actor: a });
  log(battle, `${actorName(a)} is veiled — INVINCIBLE!`);
}
/** The hero side's choice: `forcedChoice` (the interactive screen's picked actOptions index) if given, else
 * the battle's Policy — exactly where a policy answer is drawn today, so simulateBattle's rng stream (which
 * never passes forcedChoice) is untouched. An out-of-range answer, forced or policy-drawn, clamps to option 0. */
function resolveHeroAction(battle: Battle, actor: Actor, forcedChoice?: number): { skillIndex: number; targets: Actor[] } {
  const options = actOptions(battle, actor);
  const raw = forcedChoice !== undefined ? forcedChoice : battle.policy.act(battle, actor, options, battle.rng);
  const idx = Number.isInteger(raw) && raw >= 0 && raw < options.length ? raw : 0;
  const opt = options[idx];
  const skill = SKILLS[actor.def.skills[opt.skill]];
  return { skillIndex: opt.skill, targets: resolveTargets(battle, actor, skill.target, opt.target) };
}

/** The ten-step turn — DESIGN.md → The turn. `extra` is VIOLENT's one fresh (non-chaining) turn; `forcedChoice`
 * is the interactive screen's picked actOptions index for a HERO's step 7 (ignored for an ENEMY, and for an
 * extra turn, which always falls back to the battle's own Policy — there is no second prompt mid-turn). */
function takeTurn(battle: Battle, a: Actor, extra = false, forcedChoice?: number): void {
  battle.actorTurns += 1;
  if (a.side === 'HERO') battle.heroTurns += 1;
  // ENRAGED is a property of the actor-turn count itself (the harness's own fallback treats it exactly that
  // way) — set the flag here, before BURN gets a chance to end the turn early; the ATK_UP it grants still
  // only lands if the actor survives past step 2.
  const enraged = a.side === 'ENEMY' && battle.actorTurns >= ENRAGE_TURN;
  if (enraged && !battle.enraged) { battle.enraged = true; log(battle, `${actorName(a)} is ENRAGED!`); }
  battle.events.push({ kind: 'TURN_START', actor: a, enraged });
  if (!extra) a.atb -= ATB_TURN;
  if (tickBurn(battle, a)) { battle.events.push({ kind: 'TURN_END', actor: a }); return; } // step 2 — BURN can kill; the turn ends here
  if (enraged) {
    applyStatus(a, 'ATK_UP', ENRAGE_TURNS);
    battle.events.push({ kind: 'STATUS_APPLIED', target: a, status: 'ATK_UP', turns: ENRAGE_TURNS });
  }
  const beforeStatuses = a.statuses; // steps 3–5 — captured for the expiry diff below, before tickTurnStart replaces the array
  const stunned = tickTurnStart(a);
  for (const s of beforeStatuses) {
    if (!a.statuses.some((ns) => ns.kind === s.kind)) battle.events.push({ kind: 'STATUS_EXPIRED', target: a, status: s.kind, turns: 0 });
  }
  maybeVeilInvincible(battle, a); // between steps 5 and 6
  if (stunned) { battle.events.push({ kind: 'TURN_END', actor: a }); return; } // step 6
  const { skillIndex, targets } = a.side === 'HERO' ? resolveHeroAction(battle, a, forcedChoice) : chooseEnemyAction(battle, a); // step 7
  const skill = SKILLS[a.def.skills[skillIndex]];
  battle.events.push({ kind: 'CAST', caster: a, skill: skill.id, targets: targets.slice() });
  castSkill(battle, a, skill, targets, skillIndex); // step 8 (cooldown write + counters live inside)
  const violent = findSet(a, 'EXTRA_TURN'); // step 9
  battle.events.push({ kind: 'TURN_END', actor: a });
  if (battle.actorTurns === TURN_CAP && bothSidesAlive(battle)) battle.events.push({ kind: 'STALL' });
  if (bothSidesAlive(battle) && a.alive && violent && !extra && chance(violent.chance, battle.rng)) {
    takeTurn(battle, a, true);
  }
}

// =========================================================== simulateBattle ==
/** Every Modifier of the taken pacts is already read by `scaleEnemy`/`derive`; this only needs the pacts list
 * itself for VEIL's battle-start/mid-battle INVINCIBLE, which lives here. */
function grantBattleStartBuffs(battle: Battle, row: AscensionRow): void {
  const all = [...battle.heroes, ...battle.enemies];
  for (const a of all) {
    if (!a.alive) continue;
    a.atb = battle.rng() * ATB_START_MAX * ATB_TURN; // always one draw per living actor, heroes then enemies
  }
  for (const a of all) {
    if (!a.alive) continue;
    const will = findSet(a, 'IMMUNITY_START');
    if (will) applyStatus(a, 'IMMUNITY', will.turns);
  }
  if (row.bossWill) {
    for (const e of battle.enemies) if (e.alive && (e.def as EnemyDef).kind === 'BOSS') applyStatus(e, 'IMMUNITY', WILL_TURNS);
  }
  for (const wearer of battle.heroes) {
    if (!wearer.alive) continue;
    const bulwark = findSet(wearer, 'SHIELD_START');
    if (!bulwark) continue;
    for (const recipient of battle.heroes) {
      if (!recipient.alive) continue;
      applyStatus(recipient, 'SHIELD', bulwark.turns, { pool: bastionBoost(recipient, Math.round(recipient.maxHp * bulwark.fraction)) });
    }
  }
  if (battle.pacts.includes('VEIL')) {
    const turns = veilInvincibleTurns(battle.pacts);
    if (turns > 0) for (const e of battle.enemies) if (e.alive && (e.def as EnemyDef).kind === 'BOSS') applyStatus(e, 'INVINCIBLE', turns);
  }
  if (row.bossOpens) {
    for (const e of battle.enemies) if (e.alive && (e.def as EnemyDef).kind === 'BOSS') e.atb = ATB_TURN;
  }
}

/**
 * The interactive setup half of a battle: builds both sides, zeroes cooldowns/statuses, grants every
 * battle-start buff (VEIL/WILL/BULWARK/ascension openers) and snapshots the Probe's starting SPD/HP — every­
 * thing `simulateBattle` used to do inline, now shared with an interactive caller. `party`'s members are NOT
 * written back here — only `battleOutcome`, at the true end of the battle, does that.
 */
export function createBattle(party: Party, enemies: Actor[], policy: ActPolicy, rng: Rng, ctx: BattleCtx = {}): Battle {
  const pacts = ctx.pacts ?? [];
  const ascension = ctx.ascension ?? 0;
  const heroes = buildHeroes(party, pacts, ctx.spdDelta);
  for (const a of [...heroes, ...enemies]) { a.cooldowns = a.cooldowns.map(() => 0); a.statuses = []; } // battle start: cooldowns 0, no statuses

  const battle: Battle = {
    heroes, enemies, party, leaderSlot: party.leader, log: [], events: [], actorTurns: 0, heroTurns: 0, rng, policy,
    pacts, ascension, act: ctx.act ?? 1, lap: ctx.lap ?? 1, enraged: false, veilUsed: false, firstCastDone: new WeakSet(),
    bossRef: pickBossRef(enemies),
    probeAcc: { dmgDealtToBoss: 0, hitsTakenByHeroes: 0, hpLostByHeroes: 0, stunsOnBoss: 0, debuffsResistedOnBoss: 0, ttk: 0, bossDied: false },
    startPartySpd: 0, startHeroMaxHp: 0, startBossMaxHp: 0,
  };
  grantBattleStartBuffs(battle, ascensionRow(ascension));

  const livingHeroesAtStart = livingHeroes(battle);
  battle.startPartySpd = livingHeroesAtStart.length > 0
    ? livingHeroesAtStart.reduce((s, a) => s + a.stats.SPD, 0) / livingHeroesAtStart.length
    : 0;
  battle.startHeroMaxHp = livingHeroesAtStart.reduce((s, a) => s + a.maxHp, 0);
  battle.startBossMaxHp = battle.bossRef?.maxHp ?? 0;
  return battle;
}

/** ready()'s head, exported for an interactive driver: the next actor to act, filling attack bars as needed
 * (null only once a side is already empty). */
export function nextReady(battle: Battle): Actor | null {
  return nextActor(battle);
}

/**
 * Runs one actor's turn. `heroChoice`, when given, is the interactive screen's picked index into
 * `actOptions(battle, actor)` for a HERO's step 7, taken instead of `battle.policy.act(...)` — the exact point
 * a policy answer is drawn today, so a caller that never passes it (simulateBattle) draws identically to
 * before this was split out. Ignored for an ENEMY.
 *
 * The Probe's boss kill is recorded HERE, around the turn, rather than in each caller's loop: `simulateBattle`
 * and sim/run.ts's own battle loop both carried these five lines and the interactive screen's loop carried
 * neither, so an interactively-played boss reported `ttk` as the whole battle's heroTurns. Every caller drives
 * a turn through this function, and only a turn can kill the boss, so the observable is what each loop's copy
 * produced — no draw, same order.
 */
export function runTurn(battle: Battle, actor: Actor, heroChoice?: number): void {
  const bossWasAlive = battle.bossRef?.alive ?? false;
  takeTurn(battle, actor, false, heroChoice);
  if (bossWasAlive && battle.bossRef && !battle.bossRef.alive && !battle.probeAcc.bossDied) {
    battle.probeAcc.bossDied = true;
    battle.probeAcc.ttk = battle.heroTurns;
  }
}

/** A side is already empty, or the battle has run TURN_CAP actor turns (a stall) — the two conditions that
 * end a battle, mirroring the order `simulateBattle`'s own loop always checked in (side-empty first). */
export function isOver(battle: Battle): boolean {
  return livingHeroes(battle).length === 0 || livingEnemies(battle).length === 0 || battle.actorTurns >= TURN_CAP;
}

/**
 * The tail of `simulateBattle`: won/stall from the battle's final state, the Probe, and the write-back of
 * every hero's final hp onto the ORIGINAL party object passed to `createBattle` (also returned as
 * `BattleResult.party`). Call once, after `isOver(battle)` is true.
 */
export function battleOutcome(battle: Battle): BattleResult {
  // A side already empty outranks a same-instant TURN_CAP crossing — the original loop's own order (the
  // side-empty break ran before the cap check, so the two conditions were never both true in a `stall`).
  const stall = livingHeroes(battle).length > 0 && livingEnemies(battle).length > 0 && battle.actorTurns >= TURN_CAP;
  const won = !stall && livingHeroes(battle).length > 0 && livingEnemies(battle).length === 0;
  for (let i = 0; i < battle.party.members.length; i++) battle.party.members[i].hp = battle.heroes[i].hp;

  const boss = battle.bossRef;
  const probe: Probe = {
    act: battle.act, lap: battle.lap, won, actorTurns: battle.actorTurns, heroTurns: battle.heroTurns, enraged: battle.enraged,
    partySpd: battle.startPartySpd, bossSpd: boss?.stats.SPD ?? 0, outSped: battle.startPartySpd > (boss?.stats.SPD ?? 0),
    bossHp: battle.startBossMaxHp, dmgDealt: battle.probeAcc.dmgDealtToBoss, ttk: battle.probeAcc.bossDied ? battle.probeAcc.ttk : battle.heroTurns,
    hitsTaken: battle.probeAcc.hitsTakenByHeroes,
    hitFrac: battle.startHeroMaxHp > 0 ? battle.probeAcc.hpLostByHeroes / battle.startHeroMaxHp : 0,
    stunsLanded: battle.probeAcc.stunsOnBoss, debuffsResisted: battle.probeAcc.debuffsResistedOnBoss,
  };
  return { won, stall, enraged: battle.enraged, actorTurns: battle.actorTurns, probe, party: battle.party };
}

/**
 * The next `n` actors to act, previewed on CLONED atb values by a standalone copy of advance()/ready()'s own
 * formulas (duplicated, not shared, so the proven path above can never be perturbed by a change here): never
 * draws from `battle.rng`, never mutates a real Actor. Presentation only — the turn ribbon's queue, recomputed
 * at turn boundaries, per DESIGN.md → Turn order. Extras (VIOLENT), stuns and BURN deaths are not modelled.
 */
export function forecast(battle: Battle, n: number): Actor[] {
  const clones = livingActors(battle).map((a) => ({ ...a }));
  const result: Actor[] = [];
  const guardMax = (n + clones.length) * 4 + 50;
  for (let guard = 0; guard < guardMax && result.length < n && clones.length > 0; guard++) {
    const ready = clones
      .filter((a) => a.atb >= ATB_TURN)
      .sort((a, b) => {
        if (b.atb !== a.atb) return b.atb - a.atb;
        const bySpd = spdEff(b) - spdEff(a);
        if (bySpd !== 0) return bySpd;
        if (a.side !== b.side) return a.side === 'HERO' ? -1 : 1;
        return a.slot - b.slot;
      });
    if (ready.length === 0) {
      const deltas = clones.map((a) => (ATB_TURN - a.atb) / spdEff(a));
      const minDelta = Math.min(...deltas);
      if (!Number.isFinite(minDelta)) break; // every clone stuck at 0 spdEff — cannot advance further
      clones.forEach((a, i) => { a.atb = deltas[i] === minDelta ? ATB_TURN : a.atb + spdEff(a) * minDelta; });
      continue;
    }
    const next = ready[0];
    result.push(next);
    next.atb -= ATB_TURN; // carry, mirroring step 1 (extras/stun/burn-death are not modelled — presentation only)
  }
  return result;
}

/**
 * Runs one battle to its conclusion: a win, a wipe or a TURN_CAP stall. `party`'s members' `hp` is updated in
 * place to their post-battle values and the same object is returned as `BattleResult.party`. `enemies` is used
 * as given (already scaled, e.g. via `spawnPack`) and is likewise mutated in place. A thin driver over
 * `createBattle`/`nextReady`/`runTurn`/`isOver`/`battleOutcome`: every hero turn draws `battle.policy.act(...)`
 * at the same point it always has (no `heroChoice` is ever passed here), so the rng stream this produces is
 * identical to the single-function version it replaces.
 */
export function simulateBattle(party: Party, enemies: Actor[], policy: ActPolicy, rng: Rng, ctx: BattleCtx = {}): BattleResult {
  const battle = createBattle(party, enemies, policy, rng, ctx);
  for (;;) {
    const actor = nextReady(battle);
    if (!actor) break;
    runTurn(battle, actor); // the Probe's boss-kill tracking lives inside runTurn — every caller's loop gets it
    if (isOver(battle)) break;
  }
  return battleOutcome(battle);
}
// =============================================================== fixtures ==
/** EMBER, GALE, TIDE (leader EMBER) at base stats — base + BASELINE points + the leader skill, no relics —
 * via `derive`, full HP. */
const FIXTURE_PARTY_IDS = ['EMBER', 'GALE', 'TIDE'] as const;
function freshFixtureParty(): Party {
  const members: PartyMember[] = FIXTURE_PARTY_IDS.map((id) => ({ def: CHARACTERS[id], hp: 0, relics: {}, awakened: false }));
  const party: Party = { members, leader: 0 };
  const leaderSkill = party.members[party.leader].def.leader;
  for (const m of party.members) m.hp = derive(m, { leader: leaderSkill, pacts: [] }).HP;
  return party;
}
/** One pack, scaled at act 1, lap 1, A0, clears 0, no pacts. */
function fixturePack(ids: readonly EnemyId[]): Actor[] {
  return spawnPack(ids, 1, 1, 0, 0, []);
}
function packFixture(name: string, ids: readonly EnemyId[]): Fixture {
  return { name, make: () => ({ party: freshFixtureParty(), enemies: fixturePack(ids) }) };
}
/** EMBER, GALE, TIDE against every act-1 (EMBER CRYPT) pack: `fights` rows, then `elites`, then `[boss]` —
 * the harness's `--battles` default sweep and the `--fixture "BOSS HOLLOW_KING"` example in sim/run.mjs. */
const EMBER_CRYPT = BIOMES[0];
export const BATTLE_FIXTURES: Fixture[] = [
  ...EMBER_CRYPT.fights.map((ids) => packFixture(ids.join('+'), ids)),
  ...EMBER_CRYPT.elites.map((ids) => packFixture(ids.join('+'), ids)),
  packFixture(`BOSS ${EMBER_CRYPT.boss}`, [EMBER_CRYPT.boss]),
];
/** A thin pass-through — every fixture above already carries its own `make`; this exists for a fixture that
 * does not (and for direct testing). */
export function buildFixture(fixture: Fixture, rng: Rng): { party: Party; enemies: Actor[] } {
  return fixture.make(rng);
}
