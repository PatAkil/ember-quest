// Ember Quest v3 — the contract between data/ (content), sim/ (rules) and the
// screens. Pure types and tuning constants only: NO engine imports, NO DOM, so
// sim/ and data/ can be bundled with esbuild and Monte Carlo'd headless.
//
// Every constant named in CAPS in DESIGN.md that no data/ row claims lives
// here, under the section of the design it belongs to. Presentation constants
// (layout, text scales, animation rates) live in the screen that reads them.
//
// Every union below is CLOSED: sim/ interprets every kind, main.ts and the
// screens only render them. Adding a kind means adding its rule in sim/ in
// the same change — the exhaustive Record checks in data/index.ts fail the
// build otherwise.

// ------------------------------------------------------------ randomness ---
/** Injectable randomness: () => [0, 1). Every rolling function under data/ and sim/ takes one as its LAST parameter; main.ts passes Math.random, the harness a seeded PRNG. */
export type Rng = () => number;

// ---------------------------------------------------------------- stats ----
export type Element = 'FIRE' | 'WIND' | 'WATER' | 'LIGHT' | 'DARK';
export const ELEMENTS: readonly Element[] = ['FIRE', 'WIND', 'WATER', 'LIGHT', 'DARK'];
/** What an enemy's `resist` blunts. Survives from v2 as a tag on every skill. */
export type DamageKind = 'PHYSICAL' | 'MAGIC';

/** Eight, and only eight. HP ATK DEF SPD are flat; CRIT CDMG ACC RES are points on a 0–100 scale. */
export type Stat = 'HP' | 'ATK' | 'DEF' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
export const STATS: readonly Stat[] = ['HP', 'ATK', 'DEF', 'SPD', 'CRIT', 'CDMG', 'ACC', 'RES'];
export type Stats = Record<Stat, number>;
/** The four flat stats a base line carries; the four point stats default to BASELINE. */
export type FlatStats = { hp: number; atk: number; def: number; spd: number };
/** Baselines for every character (and enemy, unless its definition says otherwise). */
export const BASELINE = { CRIT: 15, CDMG: 50, ACC: 0, RES: 15 } as const;

/** Mitigation curve: def / (def + DEF_K). 300 DEF ≈ 25 %, 900 ≈ 50 %, never immune. */
export const DEF_K = 900;
/** Crit chance is clamped to this at ROLL time, after the element bonus. Nothing else is capped. */
export const CAP_CRIT = 100;

/** Matchups: FIRE ▸ WIND ▸ WATER ▸ FIRE, and LIGHT ⇄ DARK mutually. */
export type Matchup = 'ADVANTAGE' | 'NEUTRAL' | 'DISADVANTAGE';
export const ELEMENT_MULT: Record<Matchup, number> = { ADVANTAGE: 1.3, NEUTRAL: 1.0, DISADVANTAGE: 0.75 };
/** Points added to the crit roll per matchup. */
export const ELEMENT_CRIT: Record<Matchup, number> = { ADVANTAGE: 15, NEUTRAL: 0, DISADVANTAGE: -15 };

// ------------------------------------------------------------- combat -----
/** The attack bar: an actor acts at ATB_TURN and carries the overflow. Turn order is event-driven; no dt ever enters the rules. */
export const ATB_TURN = 1000;
/** Battle start rolls atb = rng() × ATB_START_MAX × ATB_TURN per living actor so identical SPD never deadlocks. */
export const ATB_START_MAX = 0.15;
/** Actor turns per battle (VIOLENT extras count) before the battle is a stall — a loss reported as such. */
export const TURN_CAP = 500;
/** From this actor turn every enemy turn begins with ATK_UP — heal-stalling a last enemy is not a strategy. */
export const ENRAGE_TURN = 100;
/** v2's 0.9–1.1 damage roll is retired: crit-per-hit is the variance, and no rng is drawn for it. */
export const DAMAGE_JITTER = 0;
/** Landing floor: p = clamp(chance + (acc − res) / 100, STATUS_MIN_CHANCE, 1). */
export const STATUS_MIN_CHANCE = 0.15;
/** A skill's primary debuff rolls at 0.75, a secondary or AoE debuff at 0.50; buffs, heals and self-effects never roll. */
export const CHANCE_PRIMARY = 0.75;
export const CHANCE_SECONDARY = 0.5;

export type TargetSpec = 'ENEMY' | 'ALL_ENEMIES' | 'ALLY' | 'ALL_ALLIES' | 'SELF' | 'LOWEST_HP_ALLY';

export type StatusKind =
  | 'STUN' | 'DEF_BREAK' | 'ATK_BREAK' | 'SLOW' | 'BURN' | 'HEAL_BLOCK' | 'BRAND' | 'SILENCE'
  | 'ATK_UP' | 'DEF_UP' | 'SPD_UP' | 'CRIT_UP' | 'SHIELD' | 'IMMUNITY' | 'COUNTER' | 'INVINCIBLE';
export const DEBUFFS: readonly StatusKind[] = ['STUN', 'DEF_BREAK', 'ATK_BREAK', 'SLOW', 'BURN', 'HEAL_BLOCK', 'BRAND', 'SILENCE'];
export const BUFFS: readonly StatusKind[] = ['ATK_UP', 'DEF_UP', 'SPD_UP', 'CRIT_UP', 'SHIELD', 'IMMUNITY', 'COUNTER', 'INVINCIBLE'];

/** Default durations in the AFFECTED actor's turns (a skill may set its own). Stat buffs are 3: two own actions under tick-at-turn-start. */
export const STATUS_TURNS: Record<StatusKind, number> = {
  STUN: 1, DEF_BREAK: 2, ATK_BREAK: 2, SLOW: 2, BURN: 2, HEAL_BLOCK: 2, BRAND: 2, SILENCE: 2,
  ATK_UP: 3, DEF_UP: 3, SPD_UP: 2, CRIT_UP: 3, SHIELD: 2, IMMUNITY: 1, COUNTER: 2, INVINCIBLE: 1,
};
/** Stat statuses modify the stat where it is read: statEff = stat × (1 + up − break), unrounded. */
export const STATUS_MOD = {
  ATK_UP: 0.5, ATK_BREAK: 0.5, DEF_UP: 0.7, DEF_BREAK: 0.7, SPD_UP: 0.3, SLOW: 0.3,
  /** Points added to the crit roll. */
  CRIT_UP: 30,
  /** BRAND is the only defender-side damage multiplier. */
  BRAND: 1.25,
} as const;
/** SHIELD from a skill lasts this many turns unless the skill says otherwise. */
export const SHIELD_TURNS = 2;
/** BURN per tick, fixed at application: min(round(maxHp × BURN_FRACTION), round(BURN_CAP_ATK × statEff(applier, ATK))). True damage, lethal. */
export const BURN_FRACTION = 0.05;
export const BURN_CAP_ATK = 2.0;

/** One status application on a skill: rolls once per hit per surviving target (once per target when hits = 0). */
export interface StatusApply {
  status: StatusKind;
  /** 0..1 before the ACC/RES formula; buffs and self-effects never roll. */
  chance: number;
  turns: number;
  /** SHIELD: fraction of the CASTER's max HP. */
  magnitude?: number;
  /** Overrides the skill's target for this application (an ALL_ALLIES shield on a SELF skill). */
  target?: TargetSpec;
}

/** A status on an actor. One instance per kind; re-application takes max(turns) and max(pool / dmg). */
export interface Status {
  kind: StatusKind;
  turns: number;
  /** SHIELD: HP left. */
  pool?: number;
  /** BURN: damage per tick, fixed at application. */
  dmg?: number;
}

export type SkillId =
  // --- heroes (three each, in kit order) + the awakened variants -----------
  | 'CINDER' | 'FLARE' | 'INFERNO' | 'INFERNO_BRAND'
  | 'GUST' | 'SQUALL' | 'TAILWIND' | 'GUST_RIP'
  | 'RIPPLE' | 'TIDEPOOL' | 'UNDERTOW' | 'UNDERTOW_WARD'
  | 'BASH' | 'BULWARK' | 'QUAKE' | 'BULWARK_RAMPART'
  | 'HEX' | 'MIRE' | 'ECLIPSE' | 'HEX_LINGER'
  | 'LANCE' | 'RADIANCE' | 'JUDGEMENT' | 'JUDGEMENT_REFUND'
  // --- the EMBER CRYPT ------------------------------------------------------
  | 'SCORCH' | 'KINDLE' | 'BITE' | 'REND' | 'CUDGEL' | 'RALLY' | 'MEND' | 'WAIL' | 'CHOKE'
  | 'SHIELD_BASH' | 'BRACE' | 'IMMOLATE' | 'REAP' | 'DREAD_WAIL' | 'SHROUD' | 'DOOM';

export interface SkillDef {
  id: SkillId;
  /** <= 14 chars. */
  name: string;
  /** 0 for skill 1, 2..5 otherwise. Cast on turn T with cooldown n → usable again on turn T+n. */
  cooldown: number;
  /** Per hit; 0 for a pure heal or buff. */
  mult: number;
  /** 0 for a pure heal or buff. */
  hits: number;
  /** What the damage is a multiple of. HP reads MAX HP; SPD reads spdEff. */
  scale: 'ATK' | 'DEF' | 'HP' | 'SPD';
  kind: DamageKind;
  /** Relative to the caster. */
  target: TargetSpec;
  applies?: StatusApply[];
  /** Fraction of the CASTER's max HP, given to each target, capped at missing HP. */
  heal?: number;
  /** Fraction of the summed `dealt` returned to the caster, once per skill. */
  leech?: number;
  /** Fraction of ATB_TURN granted to each target — or stripped, if negative (debuff-class: IMMUNITY blocks it, it lands at chance 1.0). */
  atbBoost?: number;
  /** Debuffs removed per target, lowest index in `statuses` first. */
  cleanse?: number;
  /** Extra multiplier when the target carries the status. */
  bonusVs?: { status: StatusKind; mult: number };
  /** Turns added to every debuff already on each target (SABLE awakened). */
  extendDebuffs?: number;
  /** A kill by this skill's own hit refunds its cooldown (LUMEN awakened). */
  refundOnKill?: boolean;
  /** Battle log: HERO <verb> ENEMY FOR n! */
  verb: string;
}

// ------------------------------------------------------------ characters ---
export interface LeaderSkill {
  stat: Stat;
  /** Native unit: percent for HP/ATK/DEF/SPD, points for CRIT/CDMG/ACC/RES. Reaches all three members, leader included. */
  amount: number;
  /** With `element` set, members of that element get `elementAmount` instead of `amount`. */
  element?: Element;
  elementAmount?: number;
}

export type Awakening =
  | { name: string; bonus: Partial<Stats> }
  | { name: string; upgrades: { slot: 0 | 1 | 2; to: SkillId } };

export interface CharacterDef {
  id: string;
  /** <= 16 chars. */
  name: string;
  element: Element;
  base: FlatStats;
  skills: [SkillId, SkillId, SkillId];
  awakening: Awakening;
  leader: LeaderSkill;
}

// --------------------------------------------------------------- enemies ---
export type EnemyKind = 'NORMAL' | 'ELITE' | 'BOSS';
/** SPREAD draws uniformly among living heroes (always one draw); FOCUS takes the living leader, else the lowest hp/maxHp. */
export type EnemyAi = 'SPREAD' | 'FOCUS';

export interface EnemyDef {
  id: string;
  /** <= 16 chars. */
  name: string;
  kind: EnemyKind;
  element: Element;
  /** Act 1, A0, before ACT_MULT. Bosses' HP comes from BOSS_HP instead. */
  base: FlatStats;
  /** Defaults to BASELINE; RES here overrides the act formula. */
  pts?: Partial<Pick<Stats, 'CRIT' | 'CDMG' | 'ACC' | 'RES'>>;
  /** Points, <= 40. Default ENEMY_RESIST[kind]. */
  resist?: Record<DamageKind, number>;
  /** 1..3; bosses carry a 4th for ascension A5. skills[0] has cooldown 0. */
  skills: SkillId[];
  ai: EnemyAi;
  /** Heals, buffs or shields its pack. Every width-3 pack carries one. */
  support?: boolean;
}

/** Default `resist` per kind, in points. */
export const ENEMY_RESIST: Record<EnemyKind, number> = { NORMAL: 10, ELITE: 15, BOSS: 20 };
/** RES = (pts.RES ?? ENEMY_RES_BASE) + ENEMY_RES_PER_ACT × (act − 1) + ENEMY_RES_KIND[kind] + ASC_RES_PER_LEVEL × max(0, A − 1). */
export const ENEMY_RES_BASE = 15;
export const ENEMY_RES_PER_ACT = 3;
export const ENEMY_RES_KIND: Record<EnemyKind, number> = { NORMAL: 0, ELITE: 10, BOSS: 20 };
export const ASC_RES_PER_LEVEL = 5;
/** hp, atk ×= (1 + CLEAR_GROWTH × clearsThisAct): FIGHT and ELITE clears, reset per act, the boss carries the act's final count. */
export const CLEAR_GROWTH = 0.03;
/** spd = round((base + SPD_PER_ACT × (act − 1) + kindSpd + SPD_PER_LAP × (lap − 1)) × ...). */
export const SPD_PER_ACT = 3;
export const SPD_PER_LAP = 5;

export interface Biome {
  /** <= 12 chars. */
  name: string;
  dominant: Element;
  foil: Element;
  /** Packs as data: 1–3 wide, every width-3 pack carries one `support`, at least one pack of width <= 2. */
  fights: string[][];
  /** Elite packs; from act 3 each row includes one NORMAL. */
  elites: string[][];
  boss: string;
}

// ---------------------------------------------------------------- relics ---
export type Slot = 'WEAPON' | 'BOOTS' | 'ARMOR' | 'NECKLACE' | 'CHALICE' | 'TOME';
export const SLOTS: readonly Slot[] = ['WEAPON', 'BOOTS', 'ARMOR', 'NECKLACE', 'CHALICE', 'TOME'];
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export const RARITIES: readonly Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
/** Flat and % of a stat are distinct keys for the no-duplicate rule. */
export type RelicStat = 'HP' | 'HP_PCT' | 'ATK' | 'ATK_PCT' | 'DEF' | 'DEF_PCT' | 'SPD' | 'CRIT' | 'CDMG' | 'ACC' | 'RES';
/** One pool for every slot; a draw excludes the relic's rolled main key and its existing sub keys. */
export const SUBSTAT_POOL: readonly RelicStat[] = ['HP', 'HP_PCT', 'ATK', 'ATK_PCT', 'DEF', 'DEF_PCT', 'SPD', 'CRIT', 'CDMG', 'ACC', 'RES'];

export type SetId =
  | 'FATAL' | 'ENERGY' | 'GUARD' | 'SWIFT' | 'BLADE' | 'RAGE' | 'FOCUS' | 'ENDURE'
  | 'VIOLENT' | 'DESPAIR' | 'VAMPIRE' | 'WILL' | 'NEMESIS' | 'REVENGE' | 'BULWARK' | 'DESTROY';
export type SigilId =
  | 'OPENER' | 'RENDER' | 'SURGE' | 'TRIP' | 'BASTION' | 'THORNS'
  | 'SPARK' | 'BLOODLUST' | 'MENDING' | 'GRUDGE' | 'LOCKDOWN' | 'ECHO';

export interface Relic {
  id: string;
  slot: Slot;
  rarity: Rarity;
  set: SetId;
  /** +0..+6 (LEGENDARY stops at +4). */
  level: number;
  /** An EPIC at +6: its sigil gains its kindled behaviour. */
  kindled: boolean;
  /** main = round(base × (1 + MAIN_PER_LEVEL × level)); LEGENDARY bases carry LEGENDARY_MAIN_MULT. */
  main: { key: RelicStat; base: number };
  /** 1..4; an upgrade roll is ADDED (value += roll; rolls += 1). */
  subs: { key: RelicStat; value: number; rolls: number }[];
  sigil?: SigilId;
}

export const MAIN_PER_LEVEL = 0.15;
export const LEGENDARY_MAIN_MULT = 1.5;
/** Signature mains (bold in the slot table) roll with this weight against 1 for the rest. */
export const MAIN_WEIGHT_SIGNATURE = 2;
export const RELIC_LEVEL_CAP = 6;
export const LEGENDARY_LEVEL_CAP = 4;
/** Roll events fire at these thresholds, source-blind, in order. */
export const ROLL_THRESHOLDS: readonly number[] = [2, 4, 6];
export const SUBSTAT_START: Record<Rarity, number> = { COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4 };
export const SUBSTAT_MAX = 4;
/** Every run rolls two of the eight 4-piece and two of the eight 2-piece sets, plus the sets of the Vault relics worn. */
export const SET_POOL = { four: 2, two: 2 } as const;
/** compare(): score = Σ COMPARE_WEIGHTS[S] × Δ_S, Δ relative for the flats, /100 for the points. */
export const COMPARE_WEIGHTS: Record<Stat, number> = { HP: 1, ATK: 1, DEF: 0.25, SPD: 1.5, CRIT: 0.5, CDMG: 0.4, ACC: 0.3, RES: 0.3 };

/** Closed union, one kind per set row. 2-piece bonuses apply floor(n / 2) times, 4-piece once; wearer-only except SHIELD_START. */
export type SetBonus =
  | { kind: 'STAT_PCT'; stat: Stat; pct: number }
  | { kind: 'STAT_PTS'; stat: Stat; pts: number }
  | { kind: 'EXTRA_TURN'; chance: number }                       // VIOLENT — never chains
  | { kind: 'STUN_ON_HIT'; chance: number; turns: number }        // DESPAIR — then the landing roll at chance 1.0
  | { kind: 'LEECH'; fraction: number }                           // VAMPIRE — once per skill
  | { kind: 'IMMUNITY_START'; turns: number; res: number }        // WILL
  | { kind: 'ATB_ON_HIT'; fraction: number }                      // NEMESIS — per hit with dealt − absorb > 0, not BURN
  | { kind: 'COUNTER'; chance: number }                           // REVENGE
  | { kind: 'SHIELD_START'; fraction: number; turns: number }     // BULWARK — party-wide, max not sum
  | { kind: 'DESTROY'; dealt: number; fraction: number; floor: number };

export interface SetDef {
  id: SetId;
  /** <= 8 chars. */
  name: string;
  pieces: 2 | 4;
  bonus: SetBonus;
}

export const VIOLENT_CHANCE = 0.4;
export const DESPAIR_CHANCE = 0.25;
export const VAMPIRE_FRACTION = 0.5;
export const WILL_TURNS = 3;
export const WILL_RES = 20;
export const NEMESIS_ATB = 0.15;
export const REVENGE_CHANCE = 0.35;
export const BULWARK_SHIELD = 0.2;
export const BULWARK_TURNS = 3;
export const DESTROY_DEALT = 0.3;
export const DESTROY_FRACTION = 0.04;
export const DESTROY_FLOOR = 0.4;
/** A counter is the counterer's skill 1 at this multiplier on the attacker — not a turn. */
export const COUNTER_MULT = 0.75;

/** Closed union, one kind per sigil row; the optional fields are the kindled extras. */
export type SigilEffect =
  | { kind: 'OPENER'; atb?: number }                                  // first skill each battle starts no cooldown; kindled +atb
  | { kind: 'RENDER'; strip: number; extend?: number }                // crits strip ATB (debuff-class); kindled extends one debuff
  | { kind: 'SURGE'; self: number; allies?: number }                  // on a kill by your own hit
  | { kind: 'TRIP'; slowStrip: number; stunStrip?: number }           // rides on the landed status, no roll
  | { kind: 'BASTION'; bonus: number; cleanse?: number }              // shields on you are larger
  | { kind: 'THORNS'; applyBreak?: number }                           // COUNTER while DEF_UP; kindled counters apply DEF_BREAK
  | { kind: 'SPARK'; all?: boolean }                                  // a skill that crits shortens the highest cooldown, once per skill
  | { kind: 'BLOODLUST'; perDebuff: number }
  | { kind: 'MENDING'; atb?: number }                                 // your heals cleanse one debuff; kindled grants ATB
  | { kind: 'GRUDGE'; threshold: number; turns: number; shield?: number }
  | { kind: 'LOCKDOWN'; extra: number; ignoreRes?: boolean }          // STUN excluded
  | { kind: 'ECHO'; skills: number[] };                               // cooldown −1 on these skill slots (max 1)

export interface SigilDef {
  id: SigilId;
  slot: Slot;
  /** <= 30 chars, wrapped at BLURB_WRAP on a card. */
  blurb: string;
  effect: SigilEffect;
  /** EPIC only; `blurb` must differ from the base blurb. */
  kindled?: { blurb: string; effect: SigilEffect };
}

// ------------------------------------------------------------------ loot ---
export type LootSource = 'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS' | 'SUMMON';
export const LOOT_COUNT: Record<LootSource, number> = { FIGHT: 1, ELITE: 3, LOOT: 2, BOSS: 3, SUMMON: 1 };
/** The roll is drawn even when pity forces the card; the dry counter resets on a FIGHT card only. */
export const FIGHT_DROP_CHANCE = 0.5;
export const PITY_AFTER = 2;
/** Declining every card mends the party this fraction of max HP. */
export const SKIP_MEND = 0.15;

// ------------------------------------------------------------------- run ---
export type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'SHRINE' | 'FORGE' | 'SUMMON' | 'ALTAR' | 'BOSS';
export const ACTS = 6;
/** Five stages, then the BOSS. The single node of stage 3 is the act's landmark. */
export const STAGE_SIZES: readonly number[] = [2, 3, 1, 3, 2];
export const LANDMARK_STAGE = 2;
export const LANDMARKS: readonly RoomType[] = ['SUMMON', 'SHRINE', 'ALTAR', 'FORGE', 'SUMMON', 'REST'];
/** Rolled room types for every non-landmark node; sums to 100. */
export const ROOM_WEIGHTS: Record<Exclude<RoomType, 'ALTAR' | 'BOSS'>, number> = {
  FIGHT: 46, ELITE: 16, LOOT: 12, REST: 10, FORGE: 8, SHRINE: 5, SUMMON: 3,
};
/** A node reaches a contiguous span of 1–2 successors; two this often. */
export const SPAN_TWO_CHANCE = 0.85;
/** score += ROOM_SCORE[type] × actNumber × (1 + SCORE_ASCENSION × ascension), actNumber = 6 × (lap − 1) + act. */
export const ROOM_SCORE: Partial<Record<RoomType, number>> = { FIGHT: 10, ELITE: 25, BOSS: 100 };
export const SCORE_ASCENSION = 0.5;

/** Between battles. Every map heal is hp = min(maxHp, hp + round(maxHp × f)). */
export const CLEAR_HEAL = 0.2;
export const BOSS_ENTRY_HEAL = 0.5;
/** A KO'd hero is out for the battle and returns at this fraction if the party wins (no clear heal on top). */
export const KO_RETURN = 0.3;

/** Party. */
export const PARTY_MAX = 3;
export const SUMMON_OFFERS = 3;

/** Laps and the Vault. DESCEND after lap L banks BANK_WIN + L − 1; any death banks BANK_DEATH. */
export const BANK_WIN = 2;
export const BANK_DEATH = 1;
export const VAULT_SIZE = 12;
export const VAULT_EQUIP_MAX = 3;
export const ASCENSION_MAX = 10;
/** Ascension: enemy HP and ATK gain this per level, additive. */
export const ASC_HP_ATK_PER_LEVEL = 0.1;

export interface AscensionRow {
  enemyHpPct: number;
  enemyAtkPct: number;
  enemyRes: number;
  restGuarantee: boolean;
  substatTopMinus: number;
  bossFourthSkill: boolean;
  restWeightMult: number;
  enemySpdPct: number;
  elitePackPlus: number;
  /** A9: bosses start at atb = ATB_TURN and act first. */
  bossOpens: boolean;
  bossWill: boolean;
}

export type PactId = 'HASTE' | 'FURY' | 'VEIL' | 'BLIND' | 'SCHISM' | 'DEARTH';
/** Closed union, one kind per pact cell; pacts stack across the run. */
export type Modifier =
  | { kind: 'ENEMY_SPD_PCT'; pct: number }
  | { kind: 'EXTRA_CARDS'; count: number }
  | { kind: 'ENEMY_ATK_PCT'; pct: number }
  | { kind: 'PARTY_ATK_PCT'; pct: number }
  | { kind: 'BOSS_INVINCIBLE_START'; turns: number }
  | { kind: 'EPIC_DROP_LEVEL'; levels: number }
  | { kind: 'PARTY_RES'; pts: number }
  | { kind: 'PARTY_ACC'; pts: number }
  | { kind: 'LEADER_OFF' }
  | { kind: 'LEADER_SELF' }
  | { kind: 'FEWER_CARDS'; count: number }
  | { kind: 'FORGE_LEVELS'; levels: number };

export interface Pact {
  id: PactId;
  /** <= 16 chars. */
  name: string;
  curse: Modifier;
  boon: Modifier;
  /** <= 30 chars. */
  blurb: string;
}

// ----------------------------------------------------------- run state -----
export interface PartyMember {
  def: CharacterDef;
  hp: number;
  relics: Partial<Record<Slot, Relic>>;
  awakened: boolean;
}
export interface Party {
  /** 1..3 members. */
  members: PartyMember[];
  leader: number;
}

export interface RunConfig {
  ascension: number;
  vault: Relic[];
  /** min(VAULT_EQUIP_MAX, acts cleared last run). */
  vaultSlots: number;
  roster: string[];
  /** The harness's --spd: a flat delta on every hero's base SPD before derive. */
  spdDelta?: number;
}

// -------------------------------------------------------------- battle -----
export interface Actor {
  side: 'HERO' | 'ENEMY';
  slot: 0 | 1 | 2;
  def: CharacterDef | EnemyDef;
  /** The relic-and-leader total; statuses never enter derive. */
  stats: Stats;
  hp: number;
  maxHp: number;
  /** Max HP at battle start — DESTROY's floor. */
  baseMaxHp: number;
  atb: number;
  cooldowns: number[];
  statuses: Status[];
  alive: boolean;
  resist: Record<DamageKind, number>;
  /** Worn set bonuses, a 2-piece repeated per completed pair. */
  sets: SetBonus[];
  sigils: SigilEffect[];
}

/** What a policy answers `act` with: an index into the enumerated options. */
export interface ActOption {
  skill: number;
  /** Living slot index, or −1 for a spec with exactly one target. */
  target: number;
}

export interface Probe {
  act: number;
  lap: number;
  won: boolean;
  actorTurns: number;
  heroTurns: number;
  partySpd: number;
  bossSpd: number;
  outSped: boolean;
  bossHp: number;
  dmgDealt: number;
  ttk: number;
  hitsTaken: number;
  hitFrac: number;
  stunsLanded: number;
  debuffsResisted: number;
}

export interface BattleResult {
  won: boolean;
  stall: boolean;
  actorTurns: number;
  probe: Probe;
  party: Party;
}

export interface RunResult {
  won: boolean;
  actReached: number;
  lap: number;
  ascension: number;
  clears: number;
  /** Bosses killed, laps included — next run's vaultSlots comes from this. */
  actsCleared: number;
  deathBy: string;
  deathKind: '' | 'WIPE' | 'STALL';
  party: string[];
  leader: string;
  awakened: string[];
  setsWorn: SetId[][];
  mainsWorn: (RelicStat | null)[][];
  relicLevels: number[][];
  banked: Relic[];
  rooms: RoomType[];
  turnsPerBattle: number[];
  probes: Probe[];
}
