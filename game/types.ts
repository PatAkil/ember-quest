// Ember Quest — shared contract between data.ts (content), sim.ts (rules) and
// main.ts (screens). Pure types and tuning constants only: NO engine imports,
// NO DOM, so sim.ts + data.ts can be bundled and run headless for balance.

// ---------------------------------------------------------------- stats ----
/** The seven skill-point stats, in the order the LEVEL UP screen lists them. */
export type StatKey = 'HP' | 'MP' | 'ATK' | 'MAG' | 'DEF' | 'MDEF' | 'CRIT';
export const STAT_KEYS: StatKey[] = ['HP', 'MP', 'ATK', 'MAG', 'DEF', 'MDEF', 'CRIT'];

/** What ONE skill point buys. DEF/MDEF/CRIT are percentage points. */
export const SP_GAIN: Record<StatKey, number> = { HP: 6, MP: 3, ATK: 2, MAG: 2, DEF: 3, MDEF: 3, CRIT: 2 };
/** Skill points granted per encounter kind (tunable — the balance pass may drop ELITE to 2). */
export const SP_PER_KIND = { NORMAL: 2, ELITE: 3, BOSS: 4 } as const;

// -------------------------------------------------------------- upgrades ---
/** Items level from 0 to MAX_LEVEL; +1 scales numbers, +2 AWAKENS (item.awaken). */
export const MAX_LEVEL = 2;
/** Legendaries stop at +1 — they never awaken. */
export const LEGENDARY_MAX_LEVEL = 1;
/** Numeric mods scale by (1 + UPGRADE_SCALE * level), rounded; effect magnitudes follow scaleEffect() in sim.ts. */
export const UPGRADE_SCALE = 0.30;
/** Chance a normal FIGHT drops anything at all; PITY_AFTER dry fights force a drop. */
export const FIGHT_DROP_CHANCE = 0.33;
export const PITY_AFTER = 2;
/** Chance a loot screen carries an UPGRADE card (for a random upgradable equipped item). Chests always do. */
export const UPGRADE_CHANCE: Record<'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS', number> = { FIGHT: 0.2, ELITE: 0.25, LOOT: 1.0, BOSS: 0 };

/** Hard caps on derived percentages — items + points together never pass these. */
export const CAP_DEF = 42;
export const CAP_MDEF = 42;
export const CAP_CRIT = 60;
export const CAP_DODGE = 40;

/** Starting hero. */
export const BASE = { hp: 46, mp: 14, atk: 7, mag: 12, crit: 5, critMult: 1.5 } as const;

/**
 * Additive stat modifiers an item carries. Percent fields are percentage
 * points (def: 10 means 10 % physical reduction). critMult is additive to the
 * 1.5 base (0.3 → x1.8).
 */
export interface StatMods {
  hp?: number; mp?: number; atk?: number; mag?: number;
  def?: number; mdef?: number; crit?: number; critMult?: number; dodge?: number;
  hpRegen?: number; mpRegen?: number;
}

/** Everything combat reads, derived from base + points + equipment (capped). */
export interface Derived {
  maxHp: number; maxMp: number; atk: number; mag: number;
  def: number; mdef: number;         // 0..CAP, percentage points
  crit: number; critMult: number;    // crit 0..CAP_CRIT (percentage points)
  dodge: number;                     // 0..CAP_DODGE
  hpRegen: number; mpRegen: number;  // per hero turn
}

// ---------------------------------------------------------------- items ----
export type Slot = 'WEAPON' | 'ARMOR' | 'NECKLACE' | 'BOOTS' | 'CHALICE' | 'TOME';
export const SLOTS: Slot[] = ['WEAPON', 'ARMOR', 'NECKLACE', 'BOOTS', 'CHALICE', 'TOME'];
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export const RARITIES: Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
export type DamageKind = 'PHYSICAL' | 'MAGIC';

export type SpellId =
  | 'FIREBALL' | 'WATER' | 'SLASH' | 'THUNDER'   // learned on act entry
  | 'TWINBOLT' | 'LEECH' | 'QUAKE' | 'MEND';     // granted by TOME items

/**
 * Unique item behaviours. sim.ts implements every kind; data.ts only declares
 * them. Keep the set closed — main.ts renders a blurb, never interprets these.
 */
export type ItemEffect =
  | { kind: 'NONE' }
  | { kind: 'HEX_STRIKE'; allPhysical?: boolean }                 // basic ATTACK and SLASH deal MAGIC damage (still off ATK); allPhysical: QUAKE too
  | { kind: 'RAMP'; perStack: number; maxStacks: number; scope: 'ATTACK' | 'SPELL'; sticky?: boolean } // +perStack per consecutive use, resets on the other kind unless sticky
  | { kind: 'TWIN_STRIKE'; secondHitMult: number }                // basic ATTACK hits twice
  | { kind: 'SPELL_TWICE'; spell: SpellId; secondHitMult: number } // one named spell hits twice
  | { kind: 'CHEAPER_SPELLS'; amount: number }                    // all spell costs -amount (min 1)
  | { kind: 'DRAIN'; fraction: number }                           // heal fraction of ALL damage dealt
  | { kind: 'REFLECT'; fraction: number; magicToo?: boolean }     // return fraction of PHYSICAL damage taken (magicToo: HEXES as well)
  | { kind: 'REVIVE'; hpFraction: number; twice?: boolean }       // once per run (twice: two charges): survive a killing blow at hpFraction
  | { kind: 'MP_ON_HIT'; amount: number }                         // every damaging hit restores MP
  | { kind: 'GLASS'; maxHpFraction: number }                      // -fraction max HP (paired with big offence)
  | { kind: 'BLOOD'; hpPerTurn: number }                          // lose HP each hero turn (paired with big regen / power)
  | { kind: 'EXECUTE'; threshold: number; bonus: number }         // +bonus damage vs enemies below threshold HP fraction
  | { kind: 'FIRST_STRIKE'; mult: number }                        // first hero action of a battle deals x mult
  | { kind: 'GRANT_SPELL'; spell: SpellId; discount?: number };   // TOME: adds a spell while equipped (discount: that spell costs less)

export interface Item {
  id: string;
  /** <= 13 chars, UPPERCASE — must fit the equipment strip. */
  name: string;
  slot: Slot;
  rarity: Rarity;
  /** WEAPON only: what the basic ATTACK scales off (PHYSICAL → ATK, MAGIC → MAG). */
  weaponKind?: DamageKind;
  mods: StatMods;
  effect: ItemEffect;
  /** <= 30 chars, one line under the name on the loot card, e.g. "ATTACKS HIT TWICE". */
  blurb: string;
  /** First act (0-based) this can drop in. Default 0. */
  minAct?: number;
  /**
   * The +2 AWAKENING: what the item becomes at max level. `mods` are ADDED on
   * top of the (scaled) base mods; `effect`, if present, REPLACES the base
   * effect (usually the same kind with an awakened flag or bigger numbers, or
   * a real effect for a COMMON that had NONE). blurb <= 30 chars UPPERCASE.
   * Required for every non-LEGENDARY item; ignored on LEGENDARY.
   */
  awaken?: { blurb: string; mods?: StatMods; effect?: ItemEffect };
  /**
   * Boss signature item: never in the normal pool; offered only on that boss's
   * loot table (enemy id, e.g. 'DARK_LORD'). At most one per boss.
   */
  bossOnly?: string;
}

/** One card on the loot screen. SCROLL teaches a spell permanently (no slot). */
export type LootOffer =
  | { kind: 'ITEM'; item: Item }
  | { kind: 'UPGRADE'; slot: Slot; item: Item; toLevel: number }
  | { kind: 'SCROLL'; spell: SpellId };

/** Chance a chest carries a SCROLL card for a spell the player declined at a boss. */
export const MISSED_SCROLL_CHANCE = 0.3;

export type LootSource = 'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS';

// ---------------------------------------------------------------- spells ---
export interface SpellDef {
  id: SpellId;
  name: string;      // <= 9 chars
  cost: number;
  mult: number;      // per hit
  hits: number;      // 1, or 2 for TWINBOLT
  scale: 'ATK' | 'MAG';
  kind: DamageKind;  // what the target's DEF/MDEF blunts
  verb: string;      // "HURLS FIRE AT" — battle log: HERO <verb> <ENEMY> FOR n!
  heal?: number;     // MEND: fraction of maxHp restored instead of damage
  leech?: number;    // LEECH: fraction of damage dealt returned as HP
}

// --------------------------------------------------------------- enemies ---
export type EnemyKind = 'NORMAL' | 'ELITE' | 'BOSS';
export interface EnemyDef {
  id: string;
  name: string;           // <= 12 chars
  kind: EnemyKind;
  atkType: DamageKind;    // STRIKES (physical) or HEXES (magic)
  hpBase: number; hpPerClear: number;
  atkBase: number; atkPerClear: number;
  def: number; mdef: number;   // percentage points — resists
  /** Boss-only multiplier on hp and atk (1.0 for normals/elites). */
  mult: number;
  /** Optional one-word tell shown under the name: "RESISTS PHYS" etc. is derived; this is flavour, <= 14 chars. */
  trait?: string;
}

export interface EnemyInstance {
  def: EnemyDef;
  hp: number; maxHp: number; atk: number;
}

export interface Biome {
  name: string;           // <= 12 chars
  normals: string[];      // enemy ids
  elites: string[];
  boss: string;
  /**
   * The spell SCROLL this act's boss offers (WATER / SLASH / THUNDER). It is no
   * longer learned automatically on act entry: the boss table offers it as one
   * of three cards, and a declined scroll re-enters later chests and the next
   * boss table (see sim.rollLoot).
   */
  scroll?: SpellId;
}

// ------------------------------------------------------------------ hero ---
export interface Hero {
  hp: number; mp: number;
  sp: number;                              // unspent skill points
  alloc: Record<StatKey, number>;          // points spent per stat
  equipment: Partial<Record<Slot, Item>>;
  levels: Partial<Record<Slot, number>>;   // upgrade level of the item in each slot (0 when absent)
  baseSpells: SpellId[];                   // act-entry spells (tomes add to these while equipped)
  revived: boolean;                        // REVIVE consumed (first charge)
  revivedTwice: boolean;                   // second charge consumed (awakened PHOENIX)
  dryFights: number;                       // consecutive FIGHT clears with no drop (pity counter)
  missedScrolls: SpellId[];                // boss scrolls declined and not yet learned
}

/** Battle-local state that item effects read. */
export interface BattleState {
  enemy: EnemyInstance;
  rampStacks: number;
  lastScope: 'ATTACK' | 'SPELL' | null;
  actionsTaken: number;
}

export type HeroAction = 'ATTACK' | SpellId;

export interface Hit { dmg: number; crit: boolean; kind: DamageKind }
export interface HeroActResult {
  hits: Hit[];              // empty for MEND
  healed: number;           // HP restored (MEND / LEECH / DRAIN)
  mpRestored: number;
  text: string;             // full battle-log line, <= 52 chars
  enemyDefeated: boolean;
  crit: boolean;            // any hit crit (for juice)
}
export interface EnemyActResult {
  dodged: boolean;
  dmg: number;              // damage the hero actually took
  reflected: number;        // damage returned to the enemy (REFLECT)
  revived: boolean;
  heroDead: boolean;
  enemyDefeated: boolean;   // via reflect
  text: string;             // <= 52 chars
}

/** Injectable randomness: () => [0, 1). Games pass Math.random; the balance sim passes a seeded PRNG. */
export type Rng = () => number;
