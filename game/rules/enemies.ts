import type { EnemyDef } from '../types';

export const ENEMIES: Record<string, EnemyDef> = {
  SLIME: { id: 'SLIME', name: 'SLIME', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 36, hpPerClear: 5, atkBase: 3.5, atkPerClear: 0.26, def: 0, mdef: 0, mult: 1, trait: 'GOOEY', moves: ['STRIKE'] },
  GOBLIN: { id: 'GOBLIN', name: 'GOBLIN', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 38, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 0, mdef: 0, mult: 1, trait: 'SNEAKY', moves: ['STRIKE'] },
  SKELETON: { id: 'SKELETON', name: 'SKELETON', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 40, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 30, mdef: 0, mult: 1, trait: 'BONY', moves: ['STRIKE'] },
  OGRE_KING: { id: 'OGRE_KING', name: 'OGRE KING', kind: 'ELITE', atkType: 'PHYSICAL', hpBase: 52, hpPerClear: 7, atkBase: 3.8, atkPerClear: 0.42, def: 15, mdef: 0, mult: 1, trait: 'BRUTAL', moves: ['STRIKE'] },
  WRAITH_LORD: { id: 'WRAITH_LORD', name: 'WRAITH LORD', kind: 'ELITE', atkType: 'MAGIC', hpBase: 52, hpPerClear: 7, atkBase: 3.8, atkPerClear: 0.42, def: 12, mdef: 10, mult: 1, trait: 'SPECTRAL', moves: ['STRIKE'] },
  DARK_LORD: { id: 'DARK_LORD', name: 'DARK LORD', kind: 'BOSS', atkType: 'MAGIC', hpBase: 95, hpPerClear: 4, atkBase: 6.6, atkPerClear: 0.5, def: 15, mdef: 15, mult: 1.0, trait: 'DREAD', moves: ['STRIKE'] },
  ICE_WOLF: { id: 'ICE_WOLF', name: 'ICE WOLF', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 36, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 5, mdef: 5, mult: 1, trait: 'PACK HUNTER', moves: ['STRIKE'] },
  ICE_BEAR: { id: 'ICE_BEAR', name: 'ICE BEAR', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 15, mdef: 0, mult: 1, trait: 'THICK HIDE', moves: ['STRIKE'] },
  FROST_WISP: { id: 'FROST_WISP', name: 'FROST WISP', kind: 'ELITE', atkType: 'MAGIC', hpBase: 76, hpPerClear: 7, atkBase: 5.2, atkPerClear: 0.42, def: 0, mdef: 35, mult: 1, trait: 'SPECTRAL', moves: ['STRIKE'] },
  YETI: { id: 'YETI', name: 'YETI', kind: 'BOSS', atkType: 'PHYSICAL', hpBase: 120, hpPerClear: 6, atkBase: 8.4, atkPerClear: 0.42, def: 20, mdef: 10, mult: 1.17, trait: 'FURIOUS', moves: ['STRIKE'] },
  SANDWORM: { id: 'SANDWORM', name: 'SANDWORM', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 10, mdef: 0, mult: 1, trait: 'BURROWS', moves: ['STRIKE'] },
  SCORPION: { id: 'SCORPION', name: 'SCORPION', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 38, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 5, mdef: 10, mult: 1, trait: 'VENOMOUS', moves: ['STRIKE'] },
  MUMMY: { id: 'MUMMY', name: 'MUMMY', kind: 'ELITE', atkType: 'MAGIC', hpBase: 78, hpPerClear: 7, atkBase: 5.6, atkPerClear: 0.42, def: 10, mdef: 25, mult: 1, trait: 'CURSED', moves: ['STRIKE'] },
  SAND_GOLEM: { id: 'SAND_GOLEM', name: 'SAND GOLEM', kind: 'BOSS', atkType: 'PHYSICAL', hpBase: 215, hpPerClear: 6, atkBase: 8.2, atkPerClear: 0.26, def: 40, mdef: 5, mult: 1.15, trait: 'STONE SKIN', moves: ['STRIKE'] },
  GUARDIAN: { id: 'GUARDIAN', name: 'GUARDIAN', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 25, mdef: 0, mult: 1, trait: 'ARMORED', moves: ['STRIKE'] },
  ORACLE: { id: 'ORACLE', name: 'ORACLE', kind: 'NORMAL', atkType: 'MAGIC', hpBase: 36, hpPerClear: 5, atkBase: 3.8, atkPerClear: 0.26, def: 0, mdef: 25, mult: 1, trait: 'FARSEEING', moves: ['STRIKE'] },
  PALADIN: { id: 'PALADIN', name: 'PALADIN', kind: 'ELITE', atkType: 'PHYSICAL', hpBase: 96, hpPerClear: 7, atkBase: 6.0, atkPerClear: 0.42, def: 25, mdef: 15, mult: 1, trait: 'BLESSED', moves: ['STRIKE'] },
  SERAPH: { id: 'SERAPH', name: 'THE SERAPH', kind: 'BOSS', atkType: 'MAGIC', hpBase: 172, hpPerClear: 7, atkBase: 7.8, atkPerClear: 0.22, def: 15, mdef: 30, mult: 1.25, trait: 'DIVINE', moves: ['STRIKE'] },
};
