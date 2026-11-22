import { PICO8 } from '../engine';
import type { AmbientPreset } from '../engine';
import type { Item } from './types';
import { RARITY_COLOR_INDEX } from './data';
import { at } from './lookup';
import { heroFrames } from './sprites';

export const W = 240;
export const H = 160;

export const C_BG = PICO8[0];
export const C_PANEL = PICO8[1];
export const C_BORDER = PICO8[10];
export const C_ACCENT = PICO8[10];
export const C_TEXT = PICO8[7];
export const C_DIM = PICO8[6];
export const C_FAINT = PICO8[13];
export const C_WARN = PICO8[9];
export const C_HP = PICO8[11];
export const C_HP_LOW = PICO8[8];
export const C_MP = PICO8[12];
export const C_DMG_TAKEN = PICO8[8];
export const C_SEL_BAR = PICO8[2];

export const rarityColor = (item: Item): string => at(PICO8, RARITY_COLOR_INDEX[item.rarity]);

const ENEMY_COLOR: Partial<Record<string, string>> = {
  SLIME: PICO8[11], GOBLIN: PICO8[9], SKELETON: PICO8[7], OGRE_KING: PICO8[4], WRAITH_LORD: PICO8[13], DARK_LORD: PICO8[3],
  ICE_WOLF: PICO8[12], ICE_BEAR: PICO8[7], FROST_WISP: PICO8[13], YETI: PICO8[6],
  SANDWORM: PICO8[15], SCORPION: PICO8[10], MUMMY: PICO8[6], SAND_GOLEM: PICO8[4],
  GUARDIAN: PICO8[10], ORACLE: PICO8[13], PALADIN: PICO8[7], SERAPH: PICO8[15],
};
export const enemyColor = (id: string): string => ENEMY_COLOR[id] ?? C_TEXT;

export interface BiomeLook { floor: string; floorLight: string; floorDark: string; ambient: AmbientPreset; ambientColor: string }
export const BIOME_LOOK: readonly BiomeLook[] = [
  { floor: PICO8[5], floorLight: PICO8[6], floorDark: PICO8[1], ambient: 'embers', ambientColor: PICO8[9] },
  { floor: PICO8[1], floorLight: PICO8[12], floorDark: PICO8[0], ambient: 'snow', ambientColor: PICO8[7] },
  { floor: PICO8[4], floorLight: PICO8[9], floorDark: PICO8[2], ambient: 'embers', ambientColor: PICO8[15] },
  { floor: PICO8[6], floorLight: PICO8[7], floorDark: PICO8[5], ambient: 'bubbles', ambientColor: PICO8[10] },
];

export interface Point { x: number; y: number }

export const FLOOR_Y = 112;
export const ACTOR_PX = 2;
export const HERO_X = 70;
export const ENEMY_FRONT = 136;
export const ENEMY_MIN_X = 162;
export const HUD_BOTTOM = 35;
export const BAND_Y = 118;

const HERO_SPRITE = heroFrames[0];
export const HERO_W = HERO_SPRITE.w * ACTOR_PX;
export const HERO_H = HERO_SPRITE.h * ACTOR_PX;
export const heroPos = (): Point => ({ x: HERO_X, y: FLOOR_Y - HERO_H / 2 });
