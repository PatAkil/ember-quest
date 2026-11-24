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

export const CAP_STAT: Partial<Record<StatKey, { field: 'def' | 'mdef' | 'crit'; max: number }>> = {
  DEF: { field: 'def', max: CAP_DEF }, MDEF: { field: 'mdef', max: CAP_MDEF }, CRIT: { field: 'crit', max: CAP_CRIT },
};

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
export type Element = 'FIRE' | 'WATER' | 'THUNDER' | 'EARTH';
export type MoveId = 'STRIKE' | 'WINDUP' | 'HEAVY' | 'WARD' | 'SCORCH' | 'MEND';
export type SpellId =
  | 'FIREBALL' | 'WATER' | 'SLASH' | 'THUNDER'
  | 'TWINBOLT' | 'LEECH' | 'QUAKE' | 'MEND'
  | 'EMBERS' | 'TREMOR' | 'AEGIS';

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
  | { kind: 'GRANT_SPELL'; spell: SpellId; discount?: number }
  | { kind: 'GUARD_COUNTER'; fraction: number }
  | { kind: 'GUARD_MANA'; amount: number }
  | { kind: 'PARRY_POWER'; mult: number }
  | { kind: 'PUNISH_WINDUP'; mult: number }
  | { kind: 'BURST_GAIN'; mult: number }
  | { kind: 'BURST_POWER'; mult: number }
  | { kind: 'IMBUE'; element: Element }
  | { kind: 'ELEMENT_BOOST'; element: Element; mult: number }
  | { kind: 'BURN_ON_HIT'; chance: number }
  | { kind: 'BURN_WARD' }
  | { kind: 'LOW_HP_POWER'; threshold: number; mult: number };
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
export interface OwnedItem { item: Item; level: number }
export const PACK_SIZE = 4;
export const LOOT_OFFERS_MAX = 4;
export type UpgradeTarget = { where: 'WORN'; slot: Slot } | { where: 'PACK'; index: number };
export type LootOffer =
  | { kind: 'ITEM'; item: Item }
  | { kind: 'UPGRADE'; target: UpgradeTarget; item: Item; toLevel: number }
  | { kind: 'UPGRADE_ANY' }
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
  element?: Element;
  guard?: { reflect: number };
}

export type EnemyKind = 'NORMAL' | 'ELITE' | 'BOSS';
export type AffixId = 'VAMPIRIC' | 'ARMORED' | 'WARDED' | 'THORNED' | 'SWIFT' | 'SEARING';
export const AFFIX_IDS: readonly AffixId[] = ['VAMPIRIC', 'ARMORED', 'WARDED', 'THORNED', 'SWIFT', 'SEARING'];
export const AFFIX_MAX = 3;
export const AFFIX_RESIST = 20;
export const AFFIX_LIFESTEAL = 0.3;
export const AFFIX_THORNS = 0.15;
export const AFFIX_THORNS_CAP = 0.12;
export const AFFIX_EVADE = 0.15;
export interface FoeScale { n: number; clears: number; descentClears: number | null }
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
  moves: MoveId[];
  phase2?: { at: number; moves: MoveId[]; banner: string; atkMult: number };
  weak?: Element;
  resists?: Element;
}

export interface Burn { perTurn: number; turns: number }

export interface EnemyInstance {
  def: EnemyDef;
  hp: number; maxHp: number; atk: number;
  resPhys: number; resMagic: number;
  affixes: AffixId[];
  burn: Burn | null;
  wardTurns: number;
  phase: 1 | 2;
  phaseAt?: number;
  cycleIndex: number;
  mended: boolean;
  staggered: boolean;
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
  pack: OwnedItem[];
  baseSpells: SpellId[];
  revived: boolean;
  revivedTwice: boolean;
  dryFights: number;
  missedScrolls: SpellId[];
  potions: number;
  ember: number;
  burn: Burn | null;
  pendingBurn: number;
  bonusMaxHp: number;
  pacts: PactId[];
}

export const POTIONS_MAX = 2;
export const ACT_POTIONS = 1;
export const POTION_HEAL = 0.4;
export const GUARD_FACTOR = 0.5;
export const GUARD_CHAIN_FACTOR = 0.75;
export const GUARD_MP_GAIN = 2;
export const RIPOSTE_MULT = 1.5;
export const HEAVY_MULT = 2.0;
export const WINDUP_MULT = 0.6;
export const SCORCH_MULT = 0.7;
export const WARD_BONUS = 25;
export const WARD_CAP = 60;
export const WARD_TURNS = 2;
export const MEND_FRACTION = 0.1;
export const BOSS_MEND_FRACTION = 0.06;
export const WEAK_MULT = 1.5;
export const RESIST_MULT = 0.5;
export const BURN_FRACTION = 0.4;
export const BURN_TURNS = 3;
export const EMBER_MAX = 100;
export const EMBER_PER_ACTION = 6;
export const EMBER_PER_HIT_TAKEN = 4;
export const EMBER_PER_PARRY = 15;
export const BURST_MULT = 2.5;
export const ENRAGE_AFTER = 12;
export const ENRAGE_STEP = 0.1;
export const BREAK_AT: Record<EnemyKind, number> = { NORMAL: 0.25, ELITE: 0.15, BOSS: 0.08 };

export interface BattleState {
  enemy: EnemyInstance;
  rampStacks: number;
  lastScope: 'ATTACK' | 'SPELL' | null;
  actionsTaken: number;
  intent: MoveId;
  guarding: boolean;
  guardChain: number;
  riposte: boolean;
  aegis: number;
  calm: number;
  foeMark: number;
  turn: number;
}
export type HeroCommand = 'ATTACK' | 'GUARD' | 'BURST' | 'POTION';
export type HeroAction = HeroCommand | SpellId;
export interface Hit { dmg: number; crit: boolean; kind: DamageKind }
export interface HeroActResult {
  hits: Hit[];
  healed: number;
  mpRestored: number;
  text: string;
  enemyDefeated: boolean;
  crit: boolean;
  broke: boolean;
  weak: boolean;
  resisted: boolean;
  guarded: boolean;
  missed: boolean;
  burned: boolean;
  thorns: number;
  thornsText: string;
  heroDead: boolean;
  revived: boolean;
  burnTick: number;
  burnText: string;
}
export interface EnemyActResult {
  move: MoveId;
  dodged: boolean;
  dmg: number;
  reflected: number;
  revived: boolean;
  heroDead: boolean;
  enemyDefeated: boolean;
  text: string;
  guarded: boolean;
  parried: boolean;
  staggered: boolean;
  phaseChanged: boolean;
  burned: boolean;
  healed: number;
  warded: boolean;
  countered: number;
  enraged: boolean;
  burnTick: number;
  burnText: string;
  aside: string;
}
export interface TurnStart {
  hpRegen: number;
  mpRegen: number;
  bloodLoss: number;
}
export type TurnOutcome = 'WON' | 'LOST' | null;
export type TurnCause = 'HIT' | 'THORNS' | 'BURN' | 'BLOW' | 'RECOIL' | 'FOE_BURN';
export interface TurnResult {
  turn: number;
  action: HeroAction;
  start: TurnStart;
  hero: HeroActResult;
  enemy: EnemyActResult | null;
  outcome: TurnOutcome;
  cause: TurnCause | null;
}

export type Rng = () => number;

export const ACTS_PER_DEPTH = 4;
export const RUN_MAX_N = 400;
export const DESCENT_GROWTH = 1.15;
export const SCORE_PER_CLEAR = 100;
export const SCORE_PER_BOSS = 500;
export const GLORY_PER_DEPTH = 1000;
export const HOLLOW_HP_FLOOR = 2;
export const HOLLOW_ATK_SHARE = 0.65;
export const HOLLOW_HP_HITS = 22;
export const HOLLOW_HIT_CAP = 0.15;
export const HOLLOW_HIT_FLOOR = 0.12;
export const HOLLOW_RES_CAP = 40;
export const HOLLOW_SWIFT_DODGE = 15;
export const DESCENT_STAGE_MAX = 8;
export const DESCENT_ELITE_STEP = 5;
export const DESCENT_FIGHT_FLOOR = 21;
export const DESCENT_PHASE_AT = 0.7;
export const DESCENT_LEGENDARY_STEP = 3;
export const DESCENT_LEGENDARY_CAP = 30;
export const REST_MEND = 0.25;

export type PactId = 'BRITTLE' | 'TITHE' | 'HEX' | 'IRON' | 'MISER' | 'STORM' | 'ASH' | 'HUNTER';
export const PACT_IDS: readonly PactId[] = ['BRITTLE', 'TITHE', 'HEX', 'IRON', 'MISER', 'STORM', 'ASH', 'HUNTER'];
export const PACT_OFFERS = 3;
export interface PactMod {
  maxHpMult?: number; dmgMult?: number; clearHealMult?: number; spPerClear?: number;
  foeAffix?: number; rarityShift?: number; foeAtkMult?: number; spPerBoss?: number;
  fightDrops?: number; extraCard?: number; attackMult?: number; burstGainMult?: number;
  restHealMult?: number; restUpgrade?: number; eliteHpMult?: number; eliteSp?: number; eliteExtraCard?: number;
}
export interface PactDef { id: PactId; name: string; curse: string; boon: string; mods: PactMod }