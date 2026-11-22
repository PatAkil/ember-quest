export type StatKey = 'HP' | 'MP' | 'ATK' | 'MAG' | 'DEF' | 'MDEF' | 'CRIT';
export const STAT_KEYS: StatKey[] = ['HP', 'MP', 'ATK', 'MAG', 'DEF', 'MDEF', 'CRIT'];

export const SP_GAIN: Record<StatKey, number> = { HP: 6, MP: 3, ATK: 2, MAG: 2, DEF: 3, MDEF: 3, CRIT: 2 };
export const SP_PER_KIND = { NORMAL: 2, ELITE: 3, BOSS: 4 } as const;

export const MAX_LEVEL = 2;
export const LEGENDARY_MAX_LEVEL = 1;
export const UPGRADE_SCALE = 0.30;
export const FIGHT_DROP_CHANCE = 0.33;
export const PITY_AFTER = 2;
export const UPGRADE_CHANCE: Record<'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS', number> = { FIGHT: 0.2, ELITE: 0.25, LOOT: 1.0, BOSS: 0 };

export const CAP_DEF = 42;
export const CAP_MDEF = 42;
export const CAP_CRIT = 60;
export const CAP_DODGE = 40;

export const BASE = { hp: 46, mp: 14, atk: 7, mag: 12, crit: 5, critMult: 1.5 } as const;

export interface StatMods {
  hp?: number; mp?: number; atk?: number; mag?: number;
  def?: number; mdef?: number; crit?: number; critMult?: number; dodge?: number;
  hpRegen?: number; mpRegen?: number;
}
export interface Derived {
  maxHp: number; maxMp: number; atk: number; mag: number;
  def: number; mdef: number;
  crit: number; critMult: number;
  dodge: number;
  hpRegen: number; mpRegen: number;
}
export type Slot = 'WEAPON' | 'ARMOR' | 'NECKLACE' | 'BOOTS' | 'CHALICE' | 'TOME';
export const SLOTS: Slot[] = ['WEAPON', 'ARMOR', 'NECKLACE', 'BOOTS', 'CHALICE', 'TOME'];
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export const RARITIES: Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
export type DamageKind = 'PHYSICAL' | 'MAGIC';
export type SpellId =
  | 'FIREBALL' | 'WATER' | 'SLASH' | 'THUNDER'
  | 'TWINBOLT' | 'LEECH' | 'QUAKE' | 'MEND';

export type ItemEffect =
  | { kind: 'NONE' }
  | { kind: 'HEX_STRIKE'; allPhysical?: boolean }
  | { kind: 'RAMP'; perStack: number; maxStacks: number; scope: 'ATTACK' | 'SPELL'; sticky?: boolean }
  | { kind: 'TWIN_STRIKE'; secondHitMult: number }
  | { kind: 'SPELL_TWICE'; spell: SpellId; secondHitMult: number }
  | { kind: 'CHEAPER_SPELLS'; amount: number }
  | { kind: 'DRAIN'; fraction: number }
  | { kind: 'REFLECT'; fraction: number; magicToo?: boolean }
  | { kind: 'REVIVE'; hpFraction: number; twice?: boolean }
  | { kind: 'MP_ON_HIT'; amount: number }
  | { kind: 'GLASS'; maxHpFraction: number }
  | { kind: 'BLOOD'; hpPerTurn: number }
  | { kind: 'EXECUTE'; threshold: number; bonus: number }
  | { kind: 'FIRST_STRIKE'; mult: number }
  | { kind: 'GRANT_SPELL'; spell: SpellId; discount?: number };
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;

  weaponKind?: DamageKind;
  mods: StatMods;
  effect: ItemEffect;
  blurb: string;
  minAct?: number;
  awaken?: { blurb: string; mods?: StatMods; effect?: ItemEffect };
  bossOnly?: string;
}
export type LootOffer =
  | { kind: 'ITEM'; item: Item }
  | { kind: 'UPGRADE'; slot: Slot; item: Item; toLevel: number }
  | { kind: 'SCROLL'; spell: SpellId };
export const MISSED_SCROLL_CHANCE = 0.3;
export type LootSource = 'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS';
export interface SpellDef {
  id: SpellId;
  name: string;
  cost: number;
  mult: number;
  hits: number;
  scale: 'ATK' | 'MAG';
  kind: DamageKind;
  verb: string;
  heal?: number;
  leech?: number;
}

export type EnemyKind = 'NORMAL' | 'ELITE' | 'BOSS';
export interface EnemyDef {
  id: string;
  name: string;
  kind: EnemyKind;
  atkType: DamageKind;
  hpBase: number; hpPerClear: number;
  atkBase: number; atkPerClear: number;
  def: number; mdef: number;
  mult: number;
  trait?: string;
}

export interface EnemyInstance {
  def: EnemyDef;
  hp: number; maxHp: number; atk: number;
}
export interface Biome {
  name: string;
  normals: [string, ...string[]];
  elites: string[];
  boss: string;
  scroll?: SpellId;
}
export interface Hero {
  hp: number; mp: number;
  sp: number;
  alloc: Record<StatKey, number>;
  equipment: Partial<Record<Slot, Item>>;
  levels: Partial<Record<Slot, number>>;
  baseSpells: SpellId[];
  revived: boolean;
  revivedTwice: boolean;
  dryFights: number;
  missedScrolls: SpellId[];
}
export interface BattleState {
  enemy: EnemyInstance;
  rampStacks: number;
  lastScope: 'ATTACK' | 'SPELL' | null;
  actionsTaken: number;
}
export type HeroAction = 'ATTACK' | SpellId;
export interface Hit { dmg: number; crit: boolean; kind: DamageKind }
export interface HeroActResult {
  hits: Hit[];
  healed: number;
  mpRestored: number;
  text: string;
  enemyDefeated: boolean;
  crit: boolean;
}
export interface EnemyActResult {
  dodged: boolean;
  dmg: number;
  reflected: number;
  revived: boolean;
  heroDead: boolean;
  enemyDefeated: boolean;
  text: string;
}

export type Rng = () => number;