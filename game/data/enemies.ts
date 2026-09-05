// Ember Quest v3 — ENEMIES, BIOMES (with their packs), and the scaling
// tables. Headless: imports ../types and ./skills only.
//
// DESIGN.md → Enemies. `base` is act 1 at A0 before ACT_MULT; ELITE and BOSS
// derive from a NORMAL-scale base through ELITE_MULT / BOSS_MULT, and a
// boss's HP comes from BOSS_HP[act] instead of its base. The full derivation
// (act, kind, ascension, lap, clear growth) lives in sim/battle.ts.

import type { Biome, EnemyDef, EnemyKind } from '../types';

export const ENEMIES: Record<string, EnemyDef> = {
  // --- EMBER CRYPT (act 1) — FIRE dominant, WIND foil, DARK boss ----------------
  CINDER_IMP: { id: 'CINDER_IMP', name: 'Cinder Imp', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1100, atk: 280, def: 130, spd: 98 }, skills: ['SCORCH', 'KINDLE'], ai: 'SPREAD' },
  ASH_HOUND: { id: 'ASH_HOUND', name: 'Ash Hound', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1150, atk: 330, def: 120, spd: 105 }, skills: ['BITE', 'REND'], ai: 'FOCUS' },
  CRYPT_WARDEN: { id: 'CRYPT_WARDEN', name: 'Crypt Warden', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1500, atk: 240, def: 190, spd: 92 }, skills: ['CUDGEL', 'RALLY', 'MEND'], ai: 'SPREAD', support: true },
  DUST_WRAITH: { id: 'DUST_WRAITH', name: 'Dust Wraith', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1250, atk: 300, def: 140, spd: 100 }, skills: ['WAIL', 'CHOKE'], ai: 'SPREAD' },
  PYRE_KNIGHT: { id: 'PYRE_KNIGHT', name: 'Pyre Knight', kind: 'ELITE', element: 'FIRE',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['SHIELD_BASH', 'BRACE', 'IMMOLATE'], ai: 'FOCUS' },
  HOLLOW_KING: { id: 'HOLLOW_KING', name: 'Hollow King', kind: 'BOSS', element: 'DARK',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['REAP', 'DREAD_WAIL', 'SHROUD', 'DOOM'], ai: 'FOCUS' },

  // --- FROST MARSH (act 2) — WATER dominant, FIRE foil, LIGHT boss ---------------
  // Bases stay at act-1 scale; ACT_MULT[1] makes them act 2. The marsh slows,
  // freezes and cracks armour: the toad SLOWs, the wisp STUNs, the crab (a hard
  // PHYSICAL shell, soft to MAGIC) DEF_BREAKs the leader, the hag shields and
  // salves the pack, and the fen fire is the fragile FIRE foil that BURNs.
  BOG_TOAD: { id: 'BOG_TOAD', name: 'Bog Toad', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1350, atk: 270, def: 160, spd: 92 }, skills: ['TONGUE_LASH', 'BOG_SPIT'], ai: 'SPREAD' },
  FROST_WISP: { id: 'FROST_WISP', name: 'Frost Wisp', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1000, atk: 300, def: 120, spd: 104 }, skills: ['CHILL', 'DEEP_FREEZE'], ai: 'SPREAD' },
  MARSH_HAG: { id: 'MARSH_HAG', name: 'Marsh Hag', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1450, atk: 230, def: 180, spd: 96 }, skills: ['CANE', 'SALVE', 'BRINE_WARD'], ai: 'SPREAD', support: true },
  SILT_CRAB: { id: 'SILT_CRAB', name: 'Silt Crab', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1300, atk: 210, def: 230, spd: 88 }, resist: { PHYSICAL: 20, MAGIC: 5 }, skills: ['PINCH', 'CRUSH'], ai: 'FOCUS' },
  FEN_FIRE: { id: 'FEN_FIRE', name: 'Fen Fire', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 950, atk: 340, def: 110, spd: 106 }, pts: { CRIT: 25 }, skills: ['FLICKER', 'IGNITE'], ai: 'SPREAD' },
  // The elite Deluges (AoE DEF_BREAK), then Drags the leader Under (HEAL_BLOCK)
  // and hacks; the boss Floods (AoE DEF_BREAK), Smites the broken leader, and
  // at A5 Sanctifies — heal, cleanse everything, DEF_UP.
  DROWNED_KNIGHT: { id: 'DROWNED_KNIGHT', name: 'Drowned Knight', kind: 'ELITE', element: 'WATER',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['RUSTED_BLADE', 'DRAG_UNDER', 'DELUGE'], ai: 'FOCUS' },
  PALE_SAINT: { id: 'PALE_SAINT', name: 'Pale Saint', kind: 'BOSS', element: 'LIGHT',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['HALO_LASH', 'SMITE', 'PALE_FLOOD', 'SANCTIFY'], ai: 'FOCUS' },
};

/** Biomes in act order. Acts 3–6 are authored by phase 6b; until then BIOMES holds acts 1–2. */
export const BIOMES: Biome[] = [
  {
    name: 'EMBER CRYPT', dominant: 'FIRE', foil: 'WIND',
    fights: [
      ['CINDER_IMP', 'ASH_HOUND'],
      ['CINDER_IMP', 'DUST_WRAITH'],
      ['ASH_HOUND', 'DUST_WRAITH'],
      ['CINDER_IMP', 'CRYPT_WARDEN', 'ASH_HOUND'],
      ['DUST_WRAITH', 'CRYPT_WARDEN', 'CINDER_IMP'],
    ],
    elites: [['PYRE_KNIGHT'], ['PYRE_KNIGHT', 'CINDER_IMP']],
    boss: 'HOLLOW_KING',
  },
  {
    name: 'FROST MARSH', dominant: 'WATER', foil: 'FIRE',
    fights: [
      ['BOG_TOAD', 'FROST_WISP'],
      ['FROST_WISP', 'FEN_FIRE'],
      ['SILT_CRAB', 'BOG_TOAD'],
      ['BOG_TOAD', 'MARSH_HAG', 'FEN_FIRE'],
      ['FROST_WISP', 'MARSH_HAG', 'SILT_CRAB'],
    ],
    elites: [['DROWNED_KNIGHT'], ['DROWNED_KNIGHT', 'FROST_WISP']],
    boss: 'PALE_SAINT',
  },
];

/** The plan for the six biomes — names, elements and boss alignment from DESIGN.md — for screens that show the road ahead. */
export const BIOME_PLAN: readonly { name: string; dominant: Biome['dominant']; foil: Biome['foil']; boss: 'DARK' | 'LIGHT' }[] = [
  { name: 'EMBER CRYPT', dominant: 'FIRE', foil: 'WIND', boss: 'DARK' },
  { name: 'FROST MARSH', dominant: 'WATER', foil: 'FIRE', boss: 'LIGHT' },
  { name: 'SKY RUINS', dominant: 'WIND', foil: 'WATER', boss: 'DARK' },
  { name: 'ASHEN FORGE', dominant: 'FIRE', foil: 'WATER', boss: 'LIGHT' },
  { name: 'SUNKEN VAULT', dominant: 'WATER', foil: 'WIND', boss: 'DARK' },
  { name: 'STORM SPIRE', dominant: 'WIND', foil: 'FIRE', boss: 'LIGHT' },
];

// --- Scale ------------------------------------------------------------------------
/** Per act (index 0 = act 1). HP grows slower than ATK because enemy DEF ×3 already eats hero damage growth. */
export const ACT_MULT = {
  hp: [1, 1.16, 1.4, 1.64, 1.88, 2.16],
  atk: [1, 1.2, 1.57, 2.0, 2.4, 2.83],
  def: [1, 1.27, 1.6, 2.0, 2.47, 3.0],
} as const;
/** Boss HP is authored per act rather than derived. */
export const BOSS_HP: readonly number[] = [4700, 5800, 8000, 10000, 12000, 14000];
export const ELITE_MULT = { hp: 2.5, atk: 1.35, def: 1.25, spd: 5 } as const;
/** Bosses take HP from BOSS_HP; the multipliers cover the rest. */
export const BOSS_MULT = { hp: 1, atk: 1.7, def: 1.6, spd: 10 } as const;
export const KIND_MULT: Record<EnemyKind, { hp: number; atk: number; def: number; spd: number }> = {
  NORMAL: { hp: 1, atk: 1, def: 1, spd: 0 },
  ELITE: ELITE_MULT,
  BOSS: BOSS_MULT,
};
/** Per lap, compounding, on top of the run's ascension. */
export const LAP_MULT = { hp: 1.5, atk: 1.5, def: 1.2 } as const;
