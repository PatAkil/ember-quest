import { makeSprite, PICO8 } from '../../engine';
import type { SpriteMap } from '../../engine';

const iconMap = (c: string): SpriteMap => ({ k: PICO8[0], c });
export const ICON_SWORD = makeSprite(['...k.', '..kc.', '.kc..', 'kc...', 'c....'], iconMap(PICO8[6]));
export const ICON_WAND = makeSprite(['..k..', '.kck.', '..c..', '.kck.', '..k..'], iconMap(PICO8[13]));
export const ICON_ARMOR = makeSprite(['.kkk.', 'kcckk', 'kcckk', '.kck.', '..k..'], iconMap(PICO8[9]));
export const ICON_NECKLACE = makeSprite(['..k..', '.kck.', 'kcccc', '.kck.', '..k..'], iconMap(PICO8[14]));
export const ICON_CHALICE = makeSprite(['k...k', 'kcccc', '.kck.', '..k..', '.kkk.'], iconMap(PICO8[10]));
export const ICON_BOOTS = makeSprite(['kk...', 'kc...', 'kc...', 'kcccc', 'kkkkk'], iconMap(PICO8[4]));
export const ICON_TOME = makeSprite(['kkkkk', 'kcckc', 'kcckc', 'kcckc', 'kkkkk'], iconMap(PICO8[11]));
export const ICON_EMPTY = makeSprite(['k...k', '.....', '.....', '.....', 'k...k'], iconMap(PICO8[5]));
const roomIconMap = (c: string): SpriteMap => ({ k: PICO8[0], c });
export const fightIcon = makeSprite(['k...k', '.k.k.', '..k..', '.k.k.', 'k...k'], roomIconMap(PICO8[8]));
export const eliteIcon = makeSprite(['k.k.k', '.kkk.', 'kkkkk', '.kkk.', 'k.k.k'], roomIconMap(PICO8[9]));
export const restIcon = makeSprite(['..k..', '..k..', 'kkkkk', '..k..', '..k..'], roomIconMap(PICO8[11]));
export const lootIcon = makeSprite(['.kkk.', 'kcccc', 'kkkkk', 'kcccc', 'kkkkk'], roomIconMap(PICO8[10]));
export const bossIcon = makeSprite(['k.k.k', 'kkkkk', 'kckck', 'kkkkk', 'kkkkk'], roomIconMap(PICO8[14]));
