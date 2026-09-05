// Ember Quest v3 — SKILLS: every character and enemy skill. Headless: imports
// ../types ONLY. Numbers are DESIGN.md's roster and EMBER CRYPT tables; phase 8
// retunes them against the simulator, the SHAPE of each kit is the contract.
//
// Conventions (DESIGN.md → Skills): skill 1 has cooldown 0; skills 2–3 cost
// 2..5; a primary debuff rolls at CHANCE_PRIMARY, a secondary or AoE debuff at
// CHANCE_SECONDARY; buffs, heals and self-effects carry chance 1 and never
// roll; a pure heal or buff is mult 0 / hits 0. An awakened kit upgrades one
// skill to a new SkillId (the *_BRAND / *_RIP / ... entries).

import type { SkillDef, SkillId } from '../types';
import { CHANCE_PRIMARY, CHANCE_SECONDARY, STATUS_TURNS } from '../types';

const T = STATUS_TURNS;

export const SKILLS: Record<SkillId, SkillDef> = {
  // --- EMBER · FIRE · AoE burner --------------------------------------------
  CINDER: { id: 'CINDER', name: 'Cinder', cooldown: 0, mult: 1.0, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'scorches' },
  FLARE: { id: 'FLARE', name: 'Flare', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'BURN', chance: CHANCE_SECONDARY, turns: T.BURN }], verb: 'flares over' },
  INFERNO: { id: 'INFERNO', name: 'Inferno', cooldown: 5, mult: 1.0, hits: 2, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    bonusVs: { status: 'BURN', mult: 1.5 }, verb: 'engulfs' },
  INFERNO_BRAND: { id: 'INFERNO_BRAND', name: 'Inferno', cooldown: 5, mult: 1.0, hits: 2, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    bonusVs: { status: 'BURN', mult: 1.5 }, applies: [{ status: 'BRAND', chance: CHANCE_PRIMARY, turns: T.BRAND }], verb: 'engulfs' },

  // --- GALE · WIND · speed stripper -----------------------------------------
  GUST: { id: 'GUST', name: 'Gust', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', atbBoost: -0.15, verb: 'cuts' },
  SQUALL: { id: 'SQUALL', name: 'Squall', cooldown: 3, mult: 0.6, hits: 2, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'SLOW', chance: 0.6, turns: T.SLOW }], verb: 'lashes' },
  TAILWIND: { id: 'TAILWIND', name: 'Tailwind', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'ALL_ALLIES',
    atbBoost: 0.4, applies: [{ status: 'SPD_UP', chance: 1, turns: T.SPD_UP }], verb: 'lifts' },
  GUST_RIP: { id: 'GUST_RIP', name: 'Gust', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', atbBoost: -0.3, verb: 'rips' },

  // --- TIDE · WATER · healer ------------------------------------------------
  RIPPLE: { id: 'RIPPLE', name: 'Ripple', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', leech: 0.2, verb: 'washes over' },
  TIDEPOOL: { id: 'TIDEPOOL', name: 'Tidepool', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.18, verb: 'soothes' },
  UNDERTOW: { id: 'UNDERTOW', name: 'Undertow', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ALLIES', heal: 0.1, cleanse: 99, verb: 'renews' },
  UNDERTOW_WARD: { id: 'UNDERTOW_WARD', name: 'Undertow', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ALLIES', heal: 0.1, cleanse: 99,
    applies: [{ status: 'IMMUNITY', chance: 1, turns: 1 }], verb: 'wards' },

  // --- BASALT · FIRE · DEF wall ---------------------------------------------
  BASH: { id: 'BASH', name: 'Bash', cooldown: 0, mult: 1.2, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'bashes' },
  BULWARK: { id: 'BULWARK', name: 'Bulwark', cooldown: 3, mult: 0, hits: 0, scale: 'DEF', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER }], verb: 'braces' },
  QUAKE: { id: 'QUAKE', name: 'Quake', cooldown: 5, mult: 1.0, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ALL_ENEMIES',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_SECONDARY, turns: T.DEF_BREAK }], verb: 'shakes' },
  BULWARK_RAMPART: { id: 'BULWARK_RAMPART', name: 'Rampart', cooldown: 3, mult: 0, hits: 0, scale: 'DEF', kind: 'PHYSICAL', target: 'SELF',
    applies: [
      { status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER },
      { status: 'SHIELD', chance: 1, turns: T.SHIELD, magnitude: 0.2, target: 'ALL_ALLIES' },
    ], verb: 'raises a rampart' },

  // --- SABLE · DARK · ACC debuffer ------------------------------------------
  HEX: { id: 'HEX', name: 'Hex', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'ATK_BREAK', chance: CHANCE_PRIMARY, turns: T.ATK_BREAK }], verb: 'hexes' },
  MIRE: { id: 'MIRE', name: 'Mire', cooldown: 3, mult: 0.5, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }, { status: 'HEAL_BLOCK', chance: CHANCE_SECONDARY, turns: T.HEAL_BLOCK }], verb: 'mires' },
  ECLIPSE: { id: 'ECLIPSE', name: 'Eclipse', cooldown: 5, mult: 1.2, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'STUN', chance: CHANCE_PRIMARY, turns: T.STUN }, { status: 'SILENCE', chance: CHANCE_PRIMARY, turns: T.SILENCE }], verb: 'eclipses' },
  HEX_LINGER: { id: 'HEX_LINGER', name: 'Hex', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'ATK_BREAK', chance: CHANCE_PRIMARY, turns: T.ATK_BREAK }], extendDebuffs: 1, verb: 'hexes' },

  // --- LUMEN · LIGHT · crit sniper ------------------------------------------
  LANCE: { id: 'LANCE', name: 'Lance', cooldown: 0, mult: 1.4, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'pierces' },
  RADIANCE: { id: 'RADIANCE', name: 'Radiance', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'CRIT_UP', chance: 1, turns: T.CRIT_UP }, { status: 'ATK_UP', chance: 1, turns: T.ATK_UP }], verb: 'shines' },
  JUDGEMENT: { id: 'JUDGEMENT', name: 'Judgement', cooldown: 5, mult: 3.5, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    bonusVs: { status: 'DEF_BREAK', mult: 1.5 }, verb: 'judges' },
  JUDGEMENT_REFUND: { id: 'JUDGEMENT_REFUND', name: 'Judgement', cooldown: 5, mult: 3.5, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    bonusVs: { status: 'DEF_BREAK', mult: 1.5 }, refundOnKill: true, verb: 'judges' },

  // --- EMBER CRYPT ------------------------------------------------------------
  SCORCH: { id: 'SCORCH', name: 'Scorch', cooldown: 0, mult: 1.0, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'scorches' },
  KINDLE: { id: 'KINDLE', name: 'Kindle', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'BURN', chance: CHANCE_PRIMARY, turns: T.BURN }], verb: 'kindles' },
  BITE: { id: 'BITE', name: 'Bite', cooldown: 0, mult: 1.1, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'bites' },
  REND: { id: 'REND', name: 'Rend', cooldown: 3, mult: 0.6, hits: 2, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'BRAND', chance: CHANCE_PRIMARY, turns: T.BRAND }], verb: 'rends' },
  CUDGEL: { id: 'CUDGEL', name: 'Cudgel', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'clubs' },
  RALLY: { id: 'RALLY', name: 'Rally', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'ALL_ALLIES',
    applies: [{ status: 'SPD_UP', chance: 1, turns: T.SPD_UP }], verb: 'rallies' },
  MEND: { id: 'MEND', name: 'Mend', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.2, verb: 'mends' },
  WAIL: { id: 'WAIL', name: 'Wail', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'wails at' },
  CHOKE: { id: 'CHOKE', name: 'Choke', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'SILENCE', chance: CHANCE_PRIMARY, turns: T.SILENCE }], verb: 'chokes' },
  SHIELD_BASH: { id: 'SHIELD_BASH', name: 'Shield Bash', cooldown: 0, mult: 1.3, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'slams' },
  BRACE: { id: 'BRACE', name: 'Brace', cooldown: 4, mult: 0, hits: 0, scale: 'DEF', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER }], verb: 'braces' },
  IMMOLATE: { id: 'IMMOLATE', name: 'Immolate', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'BURN', chance: CHANCE_SECONDARY, turns: T.BURN }], verb: 'immolates' },
  REAP: { id: 'REAP', name: 'Reap', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'reaps' },
  DREAD_WAIL: { id: 'DREAD_WAIL', name: 'Dread Wail', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }], verb: 'wails over' },
  SHROUD: { id: 'SHROUD', name: 'Shroud', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'SELF',
    applies: [{ status: 'INVINCIBLE', chance: 1, turns: T.INVINCIBLE }], verb: 'shrouds' },
  DOOM: { id: 'DOOM', name: 'Doom', cooldown: 4, mult: 2.0, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'HEAL_BLOCK', chance: CHANCE_PRIMARY, turns: T.HEAL_BLOCK }], verb: 'dooms' },
};

/** Every SkillId, in table order — the harness and validateData walk this. */
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
