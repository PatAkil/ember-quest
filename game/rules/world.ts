import type { Biome, LootSource, Rarity, SpellDef, SpellId } from '../types';

export const SPELLS: Record<SpellId, SpellDef> = {
  FIREBALL: { id: 'FIREBALL', name: 'FIREBALL', cost: 5, mult: 1.0, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'HURLS FIRE AT' },
  WATER: { id: 'WATER', name: 'WATER', cost: 8, mult: 1.6, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'FLOODS' },
  SLASH: { id: 'SLASH', name: 'SLASH', cost: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', verb: 'SLASHES' },
  THUNDER: { id: 'THUNDER', name: 'THUNDER', cost: 10, mult: 2.1, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'CALLS LIGHTNING ON' },
  TWINBOLT: { id: 'TWINBOLT', name: 'TWINBOLT', cost: 7, mult: 0.85, hits: 2, scale: 'MAG', kind: 'MAGIC', verb: 'FORKS BOLTS AT' },
  LEECH: { id: 'LEECH', name: 'LEECH', cost: 6, mult: 1.1, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'LEECHES', leech: 0.4 },
  QUAKE: { id: 'QUAKE', name: 'QUAKE', cost: 7, mult: 2.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', verb: 'QUAKES' },
  MEND: { id: 'MEND', name: 'MEND', cost: 6, mult: 0, hits: 0, scale: 'MAG', kind: 'MAGIC', verb: 'MENDS', heal: 0.35 },
};

export const SPELL_ORDER: SpellId[] = ['FIREBALL', 'WATER', 'SLASH', 'THUNDER', 'TWINBOLT', 'LEECH', 'QUAKE', 'MEND'];

export const LOOT_WEIGHTS: Record<LootSource, [number, number, number, number][]> = {
  FIGHT: [[70, 25, 5, 0], [60, 30, 9, 1], [50, 35, 13, 2], [40, 40, 17, 3]],
  ELITE: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10]],
  LOOT: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10]],
  BOSS: [[0, 40, 45, 15], [0, 33, 47, 20], [0, 27, 48, 25], [0, 20, 50, 30]],
};

export const LOOT_COUNT: Record<LootSource, number> = { FIGHT: 1, ELITE: 3, LOOT: 2, BOSS: 3 };

export const BIOMES: Biome[] = [
  { name: 'THE CRYPT', normals: ['SLIME', 'GOBLIN', 'SKELETON'], elites: ['OGRE_KING', 'WRAITH_LORD'], boss: 'DARK_LORD', scroll: 'WATER' },
  { name: 'THE TUNDRA', normals: ['ICE_WOLF', 'ICE_BEAR'], elites: ['FROST_WISP'], boss: 'YETI', scroll: 'SLASH' },
  { name: 'THE DESERT', normals: ['SANDWORM', 'SCORPION'], elites: ['MUMMY'], boss: 'SAND_GOLEM', scroll: 'THUNDER' },
  { name: 'HOLY TEMPLE', normals: ['GUARDIAN', 'ORACLE'], elites: ['PALADIN'], boss: 'SERAPH' },
];
export const ACT_MULT = [1.0, 1.38, 2.2, 3.1];

export const CLEAR_HEAL = 0.25;
export const BOSS_ENTRY_HEAL = 0.6;
export const SKIP_MEND = 0.25;
export const RARITY_COLOR_INDEX: Record<Rarity, number> = { COMMON: 6, RARE: 12, EPIC: 14, LEGENDARY: 10 };
