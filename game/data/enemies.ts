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
};

/** Biomes in act order. Acts 2–6 are authored by phases 2 and 6; until then BIOMES holds act 1. */
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
