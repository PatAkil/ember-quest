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
    applies: [{ status: 'SLOW', chance: 0.6, turns: T.SLOW }, { status: 'GLANCE', chance: CHANCE_SECONDARY, turns: T.GLANCE }], verb: 'lashes' },
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
  WAIL: { id: 'WAIL', name: 'Wail', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'GLANCE', chance: CHANCE_PRIMARY, turns: T.GLANCE }], verb: 'wails at' },
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

  // --- FROST MARSH ------------------------------------------------------------
  // The marsh slows, freezes and cracks armour; its hag shields the pack; the
  // elite breaks the party's DEF then blocks its heals; the boss floods (AoE
  // DEF_BREAK) and follows with a telegraphed Smite, purging itself at A5.
  TONGUE_LASH: { id: 'TONGUE_LASH', name: 'Tongue Lash', cooldown: 0, mult: 1.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'whips' },
  BOG_SPIT: { id: 'BOG_SPIT', name: 'Bog Spit', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'SLOW', chance: CHANCE_PRIMARY, turns: T.SLOW }], verb: 'spits at' },
  CHILL: { id: 'CHILL', name: 'Chill', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'chills' },
  DEEP_FREEZE: { id: 'DEEP_FREEZE', name: 'Deep Freeze', cooldown: 4, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'STUN', chance: CHANCE_PRIMARY, turns: T.STUN }], verb: 'freezes' },
  CANE: { id: 'CANE', name: 'Cane', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'canes' },
  SALVE: { id: 'SALVE', name: 'Salve', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.2, verb: 'salves' },
  BRINE_WARD: { id: 'BRINE_WARD', name: 'Brine Ward', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ALLIES',
    applies: [{ status: 'SHIELD', chance: 1, turns: T.SHIELD, magnitude: 0.15 }], verb: 'wards' },
  PINCH: { id: 'PINCH', name: 'Pinch', cooldown: 0, mult: 1.1, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'pinches' },
  CRUSH: { id: 'CRUSH', name: 'Crush', cooldown: 4, mult: 1.4, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_PRIMARY, turns: T.DEF_BREAK }], verb: 'crushes' },
  FLICKER: { id: 'FLICKER', name: 'Flicker', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'flickers at' },
  IGNITE: { id: 'IGNITE', name: 'Ignite', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'BURN', chance: CHANCE_PRIMARY, turns: T.BURN }], verb: 'ignites' },
  RUSTED_BLADE: { id: 'RUSTED_BLADE', name: 'Rusted Blade', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'hacks' },
  DRAG_UNDER: { id: 'DRAG_UNDER', name: 'Drag Under', cooldown: 3, mult: 1.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'HEAL_BLOCK', chance: CHANCE_PRIMARY, turns: T.HEAL_BLOCK }], verb: 'drags under' },
  DELUGE: { id: 'DELUGE', name: 'Deluge', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_SECONDARY, turns: T.DEF_BREAK }], verb: 'deluges' },
  HALO_LASH: { id: 'HALO_LASH', name: 'Halo Lash', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'scourges' },
  SMITE: { id: 'SMITE', name: 'Smite', cooldown: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'smites' },
  PALE_FLOOD: { id: 'PALE_FLOOD', name: 'Pale Flood', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_SECONDARY, turns: T.DEF_BREAK }], verb: 'floods over' },
  SANCTIFY: { id: 'SANCTIFY', name: 'Sanctify', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'SELF', heal: 0.1, cleanse: 99,
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }], verb: 'sanctifies' },

  // --- SKY RUINS ----------------------------------------------------------------
  // Open-sky raiders: the raptor and the drake strip ATB like GALE's own kit; the
  // sprite blinds (GLANCE). The sentinel's kit actually OPENS on its heal —
  // chooseSkillIndex picks the highest legal index, and Mend Echo sits at
  // index 2 — then falls back to warding the pack with SHIELD once that heal
  // is on cooldown; the drowned cloud (WATER foil) slows with rain. The fallen
  // sky-king braces behind COUNTER, then judges with a will-breaking finisher.
  TALON: { id: 'TALON', name: 'Talon', cooldown: 0, mult: 1.1, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'rakes' },
  GALE_DIVE: { id: 'GALE_DIVE', name: 'Gale Dive', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', atbBoost: -0.2, verb: 'dives at' },
  ZEPHYR: { id: 'ZEPHYR', name: 'Zephyr', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'flits at' },
  DAZZLE_GUST: { id: 'DAZZLE_GUST', name: 'Dazzle Gust', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'GLANCE', chance: CHANCE_PRIMARY, turns: T.GLANCE }], verb: 'dazzles' },
  // DEF-scaling, not ATK — acts 3 and 5 otherwise had zero scale variety (16/16 ATK).
  STONE_FIST: { id: 'STONE_FIST', name: 'Stone Fist', cooldown: 0, mult: 0.9, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'strikes' },
  WARD_STONE: { id: 'WARD_STONE', name: 'Ward Stone', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'ALL_ALLIES',
    applies: [{ status: 'SHIELD', chance: 1, turns: T.SHIELD, magnitude: 0.18 }], verb: 'wards' },
  MEND_ECHO: { id: 'MEND_ECHO', name: 'Mend Echo', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.18, verb: 'echoes over' },
  RAINSPIT: { id: 'RAINSPIT', name: 'Rainspit', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'spits rain at' },
  DOWNPOUR: { id: 'DOWNPOUR', name: 'Downpour', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'SLOW', chance: CHANCE_PRIMARY, turns: T.SLOW }], verb: 'floods' },
  DRAKE_CLAW: { id: 'DRAKE_CLAW', name: 'Drake Claw', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'claws' },
  TEMPEST_WING: { id: 'TEMPEST_WING', name: 'Tempest Wing', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'SPD_UP', chance: 1, turns: T.SPD_UP }, { status: 'ATK_UP', chance: 1, turns: T.ATK_UP }], verb: 'surges' },
  GALE_BREATH: { id: 'GALE_BREATH', name: 'Gale Breath', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }], verb: 'breathes over' },
  SKYRENT: { id: 'SKYRENT', name: 'Skyrent', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'rends' },
  STORMCALL: { id: 'STORMCALL', name: 'Stormcall', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }], verb: 'storms over' },
  KINGLY_GUARD: { id: 'KINGLY_GUARD', name: 'Kingly Guard', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER }], verb: 'stands fast' },
  RUIN_JUDGEMENT: { id: 'RUIN_JUDGEMENT', name: 'Ruin Judgement', cooldown: 4, mult: 2.0, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'ATK_BREAK', chance: CHANCE_PRIMARY, turns: T.ATK_BREAK }], verb: 'shatters' },

  // --- ASHEN FORGE ----------------------------------------------------------------
  // Industrial FIRE: the golem's slam and the wolf's bite both carry heat (BURN,
  // then a literal BRAND); the priest tempers the pack's ATK instead of its SPD;
  // the steam wraith (WATER foil) scalds despite its element. The knight girds
  // behind DEF_UP + COUNTER; the Saint smites, floods with fire, then shields
  // itself in an unkillable flame at A5 (INVINCIBLE).
  SLAG_FIST: { id: 'SLAG_FIST', name: 'Slag Fist', cooldown: 0, mult: 1.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'pounds' },
  MOLTEN_SLAM: { id: 'MOLTEN_SLAM', name: 'Molten Slam', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'BURN', chance: CHANCE_PRIMARY, turns: T.BURN }], verb: 'slams' },
  SNARL_BITE: { id: 'SNARL_BITE', name: 'Snarl Bite', cooldown: 0, mult: 1.1, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'gnaws' },
  BRANDING_BITE: { id: 'BRANDING_BITE', name: 'Branding Bite', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'BRAND', chance: CHANCE_PRIMARY, turns: T.BRAND }], verb: 'brands' },
  TONGS_STRIKE: { id: 'TONGS_STRIKE', name: 'Tongs Strike', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'strikes' },
  TEMPER: { id: 'TEMPER', name: 'Temper', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'ALL_ALLIES',
    applies: [{ status: 'ATK_UP', chance: 1, turns: T.ATK_UP }], verb: 'tempers' },
  EMBER_SALVE: { id: 'EMBER_SALVE', name: 'Ember Salve', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.2, verb: 'salves' },
  HISS: { id: 'HISS', name: 'Hiss', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'hisses at' },
  SCALD: { id: 'SCALD', name: 'Scald', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'BURN', chance: CHANCE_PRIMARY, turns: T.BURN }], verb: 'scalds' },
  GREATHAMMER: { id: 'GREATHAMMER', name: 'Greathammer', cooldown: 0, mult: 1.3, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'hammers' },
  FORGE_WARD: { id: 'FORGE_WARD', name: 'Forge Ward', cooldown: 4, mult: 0, hits: 0, scale: 'DEF', kind: 'PHYSICAL', target: 'SELF',
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER }], verb: 'girds' },
  WHITE_HEAT: { id: 'WHITE_HEAT', name: 'White Heat', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'BURN', chance: CHANCE_SECONDARY, turns: T.BURN }], verb: 'sears' },
  SEARLIGHT: { id: 'SEARLIGHT', name: 'Searlight', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'scours' },
  SAINTS_WRATH: { id: 'SAINTS_WRATH', name: 'Saints Wrath', cooldown: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'smites' },
  CRUCIBLE_FLARE: { id: 'CRUCIBLE_FLARE', name: 'Crucible Flare', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'BURN', chance: CHANCE_SECONDARY, turns: T.BURN }], verb: 'crackles over' },
  SACRED_EMBER: { id: 'SACRED_EMBER', name: 'Sacred Ember', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'SELF',
    applies: [{ status: 'INVINCIBLE', chance: 1, turns: T.INVINCIBLE }], verb: 'ignites a ward' },

  // --- SUNKEN VAULT ----------------------------------------------------------------
  // The drowned guard drags at the ankles (SLOW); the jelly's sting numbs healing
  // (HEAL_BLOCK). The oracle's heal is actually its opener, not the SPD
  // blessing — Deep Mend sits at index 2, and chooseSkillIndex always tries the
  // highest legal index first. The wind eel (WIND foil) strips ATB like the
  // surface's own GALE. The Sunken King silences the whole party with the
  // depths themselves before a will-breaking finish.
  RUSTED_PIKE: { id: 'RUSTED_PIKE', name: 'Rusted Pike', cooldown: 0, mult: 1.1, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'skewers' },
  UNDERTOW_GRASP: { id: 'UNDERTOW_GRASP', name: 'Undertow Grasp', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'SLOW', chance: CHANCE_PRIMARY, turns: T.SLOW }], verb: 'drags' },
  STING: { id: 'STING', name: 'Sting', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'stings' },
  NUMBING_STING: { id: 'NUMBING_STING', name: 'Numbing Sting', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'HEAL_BLOCK', chance: CHANCE_PRIMARY, turns: T.HEAL_BLOCK }], verb: 'numbs' },
  CURRENT_LASH: { id: 'CURRENT_LASH', name: 'Current Lash', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'lashes' },
  TIDAL_BLESSING: { id: 'TIDAL_BLESSING', name: 'Tidal Blessing', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ALLIES',
    applies: [{ status: 'SPD_UP', chance: 1, turns: T.SPD_UP }], verb: 'blesses' },
  DEEP_MEND: { id: 'DEEP_MEND', name: 'Deep Mend', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.2, verb: 'mends' },
  CURRENT_JOLT: { id: 'CURRENT_JOLT', name: 'Current Jolt', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'jolts' },
  RIPTIDE_GUST: { id: 'RIPTIDE_GUST', name: 'Riptide Gust', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', atbBoost: -0.15, verb: 'rips through' },
  // DEF-scaling, matching the elite's own armoured bulk (mirrors GREATHAMMER/SHIELD_BASH).
  MAW_BITE: { id: 'MAW_BITE', name: 'Maw Bite', cooldown: 0, mult: 1.3, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'bites' },
  CRUSHING_COILS: { id: 'CRUSHING_COILS', name: 'Crushing Coils', cooldown: 3, mult: 1.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_PRIMARY, turns: T.DEF_BREAK }], verb: 'crushes' },
  TSUNAMI: { id: 'TSUNAMI', name: 'Tsunami', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }], verb: 'engulfs' },
  ABYSSAL_CLAW: { id: 'ABYSSAL_CLAW', name: 'Abyssal Claw', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'claws' },
  DROWNING_CHORUS: { id: 'DROWNING_CHORUS', name: 'Drown Chorus', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SILENCE', chance: CHANCE_SECONDARY, turns: T.SILENCE }], verb: 'drowns out' },
  CRUSHING_DEPTHS: { id: 'CRUSHING_DEPTHS', name: 'Abyss Crush', cooldown: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'crushes' },
  THRONE_OF_RUIN: { id: 'THRONE_OF_RUIN', name: 'Throne of Ruin', cooldown: 5, mult: 2.0, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'DEF_BREAK', chance: CHANCE_PRIMARY, turns: T.DEF_BREAK }], verb: 'shatters' },

  // --- STORM SPIRE ----------------------------------------------------------------
  // The hawk strips ATB like every other WIND kit; the monk's palm and its
  // hundred-gust follow-up scale SPD instead of ATK — a SPD-scaling multiplier
  // lives on its OWN numeric scale (see DESIGN.md -> Skills), several times
  // an ATK-scaling one's, because SPD never grows through ACT_MULT the way
  // ATK and DEF do. The warden's heal fires first here too (Updraft Mend sits
  // at index 2, and chooseSkillIndex always tries the highest legal index
  // first), then wards the whole pack with DEF_UP + COUNTER once that heal is
  // on cooldown. The ember elemental (FIRE foil) burns despite the tower's
  // cold air; the colossus is a rare STUN outside a hero nuke — FROST_WISP's
  // Deep Freeze got there first. The Seraph closes on the Sanctify pattern —
  // heal, cleanse, DEF_UP — at A5.
  THUNDER_STRIKE: { id: 'THUNDER_STRIKE', name: 'Thunder Strike', cooldown: 0, mult: 1.1, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'strikes' },
  DIVEBOMB: { id: 'DIVEBOMB', name: 'Divebomb', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', atbBoost: -0.2, verb: 'dive-bombs' },
  WIND_PALM: { id: 'WIND_PALM', name: 'Wind Palm', cooldown: 0, mult: 6.0, hits: 1, scale: 'SPD', kind: 'PHYSICAL', target: 'ENEMY', verb: 'palms' },
  HUNDRED_GUSTS: { id: 'HUNDRED_GUSTS', name: 'Hundred Gusts', cooldown: 3, mult: 3.6, hits: 2, scale: 'SPD', kind: 'PHYSICAL', target: 'ENEMY',
    applies: [{ status: 'GLANCE', chance: CHANCE_PRIMARY, turns: T.GLANCE }], verb: 'flurries' },
  STAFF_JAB: { id: 'STAFF_JAB', name: 'Staff Jab', cooldown: 0, mult: 0.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', target: 'ENEMY', verb: 'jabs' },
  STAND_FAST: { id: 'STAND_FAST', name: 'Stand Fast', cooldown: 4, mult: 0, hits: 0, scale: 'ATK', kind: 'PHYSICAL', target: 'ALL_ALLIES',
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }, { status: 'COUNTER', chance: 1, turns: T.COUNTER }], verb: 'stands fast' },
  UPDRAFT_MEND: { id: 'UPDRAFT_MEND', name: 'Updraft Mend', cooldown: 3, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'LOWEST_HP_ALLY', heal: 0.2, verb: 'mends' },
  EMBER_LICK: { id: 'EMBER_LICK', name: 'Ember Lick', cooldown: 0, mult: 0.9, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'licks' },
  CINDER_BURST: { id: 'CINDER_BURST', name: 'Cinder Burst', cooldown: 3, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'BURN', chance: CHANCE_PRIMARY, turns: T.BURN }], verb: 'bursts' },
  GRANITE_FIST: { id: 'GRANITE_FIST', name: 'Granite Fist', cooldown: 0, mult: 1.3, hits: 1, scale: 'DEF', kind: 'PHYSICAL', target: 'ENEMY', verb: 'pounds' },
  THUNDERCLAP: { id: 'THUNDERCLAP', name: 'Thunderclap', cooldown: 4, mult: 0.8, hits: 1, scale: 'DEF', kind: 'MAGIC', target: 'ENEMY',
    applies: [{ status: 'STUN', chance: CHANCE_PRIMARY, turns: T.STUN }], verb: 'stuns' },
  CHAIN_LIGHTNING: { id: 'CHAIN_LIGHTNING', name: 'Chain Bolt', cooldown: 5, mult: 0.7, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'ATK_BREAK', chance: CHANCE_SECONDARY, turns: T.ATK_BREAK }], verb: 'arcs through' },
  RADIANT_LANCE: { id: 'RADIANT_LANCE', name: 'Radiant Lance', cooldown: 0, mult: 1.2, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'lances' },
  JUDGEMENT_BOLT: { id: 'JUDGEMENT_BOLT', name: 'Judgement Bolt', cooldown: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ENEMY', verb: 'strikes down' },
  TEMPEST_CHOIR: { id: 'TEMPEST_CHOIR', name: 'Tempest Choir', cooldown: 3, mult: 0.8, hits: 1, scale: 'ATK', kind: 'MAGIC', target: 'ALL_ENEMIES',
    applies: [{ status: 'SLOW', chance: CHANCE_SECONDARY, turns: T.SLOW }], verb: 'sings over' },
  AEGIS_OF_LIGHT: { id: 'AEGIS_OF_LIGHT', name: 'Aegis of Light', cooldown: 5, mult: 0, hits: 0, scale: 'ATK', kind: 'MAGIC', target: 'SELF', heal: 0.1, cleanse: 99,
    applies: [{ status: 'DEF_UP', chance: 1, turns: T.DEF_UP }], verb: 'shines with grace' },
};

/** Every SkillId, in table order — the harness and validateData walk this. */
export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];
