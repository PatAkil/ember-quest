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

  // --- SKY RUINS (act 3) — WIND dominant, WATER foil, DARK boss -----------------
  // Open air over floating masonry: the raptor and drake strip ATB like GALE's
  // own kit, the sprite blinds with GLANCE. The sentinel's own kit opens on
  // its heal (the AI always tries the highest legal skill index first, and
  // Mend Echo sits at index 2), warding the pack with SHIELD once that heal
  // is on cooldown. The drowned cloud is the WATER foil, a rain-heavy
  // elemental that slows instead of hitting hard.
  RUIN_RAPTOR: { id: 'RUIN_RAPTOR', name: 'Ruin Raptor', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1150, atk: 330, def: 120, spd: 108 }, skills: ['TALON', 'GALE_DIVE'], ai: 'FOCUS' },
  WIND_SPRITE: { id: 'WIND_SPRITE', name: 'Wind Sprite', kind: 'NORMAL', element: 'WIND',
    base: { hp: 950, atk: 310, def: 110, spd: 105 }, skills: ['ZEPHYR', 'DAZZLE_GUST'], ai: 'SPREAD' },
  RUIN_SENTINEL: { id: 'RUIN_SENTINEL', name: 'Ruin Sentinel', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1500, atk: 230, def: 200, spd: 90 }, skills: ['STONE_FIST', 'WARD_STONE', 'MEND_ECHO'], ai: 'SPREAD', support: true },
  DROWNED_CLOUD: { id: 'DROWNED_CLOUD', name: 'Drowned Cloud', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1000, atk: 320, def: 115, spd: 102 }, pts: { CRIT: 22 }, skills: ['RAINSPIT', 'DOWNPOUR'], ai: 'SPREAD' },
  STORM_DRAKE: { id: 'STORM_DRAKE', name: 'Storm Drake', kind: 'ELITE', element: 'WIND',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['DRAKE_CLAW', 'TEMPEST_WING', 'GALE_BREATH'], ai: 'FOCUS' },
  SKYFALLEN_KING: { id: 'SKYFALLEN_KING', name: 'Skyfallen King', kind: 'BOSS', element: 'DARK',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['SKYRENT', 'STORMCALL', 'KINGLY_GUARD', 'RUIN_JUDGEMENT'], ai: 'FOCUS' },

  // --- ASHEN FORGE (act 4) — FIRE dominant, WATER foil, LIGHT boss -----------------
  // An industrial forge: the golem and wolf both carry heat, the wolf's bite
  // literally BRANDs. The priest tempers the pack's ATK; the steam wraith (the
  // WATER foil) scalds despite its element. The knight girds behind DEF_UP +
  // COUNTER; the Saint shields itself in an unkillable flame at A5.
  FORGE_GOLEM: { id: 'FORGE_GOLEM', name: 'Forge Golem', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1550, atk: 250, def: 210, spd: 86 }, skills: ['SLAG_FIST', 'MOLTEN_SLAM'], ai: 'SPREAD' },
  CINDER_WOLF: { id: 'CINDER_WOLF', name: 'Cinder Wolf', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1050, atk: 340, def: 115, spd: 108 }, skills: ['SNARL_BITE', 'BRANDING_BITE'], ai: 'FOCUS' },
  SMITH_PRIEST: { id: 'SMITH_PRIEST', name: 'Smith Priest', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 1450, atk: 235, def: 185, spd: 92 }, skills: ['TONGS_STRIKE', 'TEMPER', 'EMBER_SALVE'], ai: 'SPREAD', support: true },
  STEAM_WRAITH: { id: 'STEAM_WRAITH', name: 'Steam Wraith', kind: 'NORMAL', element: 'WATER',
    base: { hp: 950, atk: 300, def: 105, spd: 104 }, pts: { ACC: 10 }, skills: ['HISS', 'SCALD'], ai: 'SPREAD' },
  FURNACE_KNIGHT: { id: 'FURNACE_KNIGHT', name: 'Furnace Knight', kind: 'ELITE', element: 'FIRE',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['GREATHAMMER', 'FORGE_WARD', 'WHITE_HEAT'], ai: 'FOCUS' },
  FORGE_SAINT: { id: 'FORGE_SAINT', name: 'Forge Saint', kind: 'BOSS', element: 'LIGHT',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['SEARLIGHT', 'SAINTS_WRATH', 'CRUCIBLE_FLARE', 'SACRED_EMBER'], ai: 'FOCUS' },

  // --- SUNKEN VAULT (act 5) — WATER dominant, WIND foil, DARK boss -----------------
  // A drowned reliquary: the sentinel drags at the ankles (SLOW), the jelly's
  // sting numbs healing (HEAL_BLOCK). The oracle opens on its heal, not the
  // SPD blessing — Deep Mend sits at index 2, and the AI always tries the
  // highest legal skill index first. The wind eel is the WIND foil, stripping
  // ATB like the surface's own GALE. The Sunken King silences the whole party
  // with the depths before a will-breaking finish.
  DROWNED_SENTINEL: { id: 'DROWNED_SENTINEL', name: 'Drowned Sentinel', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1200, atk: 300, def: 150, spd: 94 }, skills: ['RUSTED_PIKE', 'UNDERTOW_GRASP'], ai: 'FOCUS' },
  VAULT_JELLY: { id: 'VAULT_JELLY', name: 'Vault Jelly', kind: 'NORMAL', element: 'WATER',
    base: { hp: 900, atk: 310, def: 100, spd: 100 }, resist: { PHYSICAL: 15, MAGIC: 5 }, skills: ['STING', 'NUMBING_STING'], ai: 'SPREAD' },
  TIDE_ORACLE: { id: 'TIDE_ORACLE', name: 'Tide Oracle', kind: 'NORMAL', element: 'WATER',
    base: { hp: 1400, atk: 225, def: 180, spd: 93 }, skills: ['CURRENT_LASH', 'TIDAL_BLESSING', 'DEEP_MEND'], ai: 'SPREAD', support: true },
  WIND_EEL: { id: 'WIND_EEL', name: 'Wind Eel', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1000, atk: 330, def: 110, spd: 107 }, pts: { CRIT: 20 }, skills: ['CURRENT_JOLT', 'RIPTIDE_GUST'], ai: 'SPREAD' },
  LEVIATHAN_SPAWN: { id: 'LEVIATHAN_SPAWN', name: 'Leviathan Spawn', kind: 'ELITE', element: 'WATER',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['MAW_BITE', 'CRUSHING_COILS', 'TSUNAMI'], ai: 'FOCUS' },
  SUNKEN_KING: { id: 'SUNKEN_KING', name: 'Sunken King', kind: 'BOSS', element: 'DARK',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['ABYSSAL_CLAW', 'DROWNING_CHORUS', 'CRUSHING_DEPTHS', 'THRONE_OF_RUIN'], ai: 'FOCUS' },

  // --- STORM SPIRE (act 6) — WIND dominant, FIRE foil, LIGHT boss -----------------
  // A lightning-lit tower top: the hawk strips ATB like every other WIND kit;
  // the gale monk's palm and its follow-up scale SPD instead (a SPD-scaling
  // multiplier sits on its own numeric scale — DESIGN.md -> Skills). The
  // warden opens on its heal too (Updraft Mend at index 2 beats DEF_UP +
  // COUNTER under the AI's own highest-index-first rule), warding the whole
  // pack once that heal is on cooldown. The ember elemental is the FIRE foil;
  // the colossus is a rare STUN outside a hero nuke, not the first (FROST_WISP's
  // Deep Freeze already is). The Seraph closes on the Sanctify pattern — heal,
  // cleanse, DEF_UP — at A5.
  LIGHTNING_HAWK: { id: 'LIGHTNING_HAWK', name: 'Lightning Hawk', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1050, atk: 345, def: 115, spd: 110 }, skills: ['THUNDER_STRIKE', 'DIVEBOMB'], ai: 'FOCUS' },
  GALE_MONK: { id: 'GALE_MONK', name: 'Gale Monk', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1000, atk: 280, def: 115, spd: 114 }, skills: ['WIND_PALM', 'HUNDRED_GUSTS'], ai: 'SPREAD' },
  SPIRE_WARDEN: { id: 'SPIRE_WARDEN', name: 'Spire Warden', kind: 'NORMAL', element: 'WIND',
    base: { hp: 1500, atk: 230, def: 205, spd: 88 }, skills: ['STAFF_JAB', 'STAND_FAST', 'UPDRAFT_MEND'], ai: 'SPREAD', support: true },
  EMBER_ELEMENTAL: { id: 'EMBER_ELEMENTAL', name: 'Ember Elemental', kind: 'NORMAL', element: 'FIRE',
    base: { hp: 950, atk: 335, def: 105, spd: 103 }, pts: { CRIT: 24 }, skills: ['EMBER_LICK', 'CINDER_BURST'], ai: 'SPREAD' },
  THUNDER_COLOSSUS: { id: 'THUNDER_COLOSSUS', name: 'Thunder Colossus', kind: 'ELITE', element: 'WIND',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['GRANITE_FIST', 'THUNDERCLAP', 'CHAIN_LIGHTNING'], ai: 'FOCUS' },
  SPIRE_SERAPH: { id: 'SPIRE_SERAPH', name: 'Spire Seraph', kind: 'BOSS', element: 'LIGHT',
    base: { hp: 1250, atk: 300, def: 150, spd: 95 }, skills: ['RADIANT_LANCE', 'JUDGEMENT_BOLT', 'TEMPEST_CHOIR', 'AEGIS_OF_LIGHT'], ai: 'FOCUS' },
};

/** Biomes in act order, all six authored (phase 6b). */
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
  {
    name: 'SKY RUINS', dominant: 'WIND', foil: 'WATER',
    fights: [
      ['RUIN_RAPTOR', 'WIND_SPRITE'],
      ['RUIN_RAPTOR', 'DROWNED_CLOUD'],
      ['WIND_SPRITE', 'DROWNED_CLOUD'],
      ['RUIN_RAPTOR', 'RUIN_SENTINEL', 'WIND_SPRITE'],
      ['DROWNED_CLOUD', 'RUIN_SENTINEL', 'RUIN_RAPTOR'],
    ],
    elites: [['STORM_DRAKE', 'RUIN_RAPTOR'], ['STORM_DRAKE', 'WIND_SPRITE']],
    boss: 'SKYFALLEN_KING',
  },
  {
    name: 'ASHEN FORGE', dominant: 'FIRE', foil: 'WATER',
    fights: [
      ['FORGE_GOLEM', 'CINDER_WOLF'],
      ['FORGE_GOLEM', 'STEAM_WRAITH'],
      ['CINDER_WOLF', 'STEAM_WRAITH'],
      ['FORGE_GOLEM', 'SMITH_PRIEST', 'CINDER_WOLF'],
      ['STEAM_WRAITH', 'SMITH_PRIEST', 'FORGE_GOLEM'],
    ],
    elites: [['FURNACE_KNIGHT', 'FORGE_GOLEM'], ['FURNACE_KNIGHT', 'CINDER_WOLF']],
    boss: 'FORGE_SAINT',
  },
  {
    name: 'SUNKEN VAULT', dominant: 'WATER', foil: 'WIND',
    fights: [
      ['DROWNED_SENTINEL', 'VAULT_JELLY'],
      ['DROWNED_SENTINEL', 'WIND_EEL'],
      ['VAULT_JELLY', 'WIND_EEL'],
      ['DROWNED_SENTINEL', 'TIDE_ORACLE', 'VAULT_JELLY'],
      ['WIND_EEL', 'TIDE_ORACLE', 'DROWNED_SENTINEL'],
    ],
    elites: [['LEVIATHAN_SPAWN', 'DROWNED_SENTINEL'], ['LEVIATHAN_SPAWN', 'VAULT_JELLY']],
    boss: 'SUNKEN_KING',
  },
  {
    name: 'STORM SPIRE', dominant: 'WIND', foil: 'FIRE',
    fights: [
      ['LIGHTNING_HAWK', 'GALE_MONK'],
      ['LIGHTNING_HAWK', 'EMBER_ELEMENTAL'],
      ['GALE_MONK', 'EMBER_ELEMENTAL'],
      ['LIGHTNING_HAWK', 'SPIRE_WARDEN', 'GALE_MONK'],
      ['EMBER_ELEMENTAL', 'SPIRE_WARDEN', 'LIGHTNING_HAWK'],
    ],
    elites: [['THUNDER_COLOSSUS', 'LIGHTNING_HAWK'], ['THUNDER_COLOSSUS', 'GALE_MONK']],
    boss: 'SPIRE_SERAPH',
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
