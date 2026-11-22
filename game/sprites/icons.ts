import { makeSprite, PICO8 } from '../../engine';
import type { Sprite, SpriteMap } from '../../engine';

const iconMap = (c: string): SpriteMap => ({ k: PICO8[0], c });
export const ICON_SWORD = makeSprite(['....c', '...c.', 'c.c..', '.c...', 'c.c..'], iconMap(PICO8[6]));
export const ICON_WAND = makeSprite(['...c.', '..ccc', '...c.', '..c..', '.c...'], iconMap(PICO8[12]));
export const ICON_ARMOR = makeSprite(['c...c', 'ccccc', 'ccccc', '.ccc.', '.ccc.'], iconMap(PICO8[9]));
export const ICON_NECKLACE = makeSprite(['c...c', '.c.c.', '..c..', '.ccc.', '..c..'], iconMap(PICO8[14]));
export const ICON_CHALICE = makeSprite(['ccccc', 'ccccc', '.ccc.', '..c..', '.ccc.'], iconMap(PICO8[10]));
export const ICON_BOOTS = makeSprite(['cc...', 'cc...', 'cc...', 'ccccc', 'ccccc'], iconMap(PICO8[15]));
export const ICON_TOME = makeSprite(['ccccc', 'ckkkc', 'ccccc', 'ckkkc', 'ccccc'], iconMap(PICO8[11]));
export const ICON_EMPTY = makeSprite(['c...c', '.....', '.....', '.....', 'c...c'], iconMap(PICO8[13]));
const roomIcon = (rows: string[], c: string): Sprite => makeSprite(rows, { k: PICO8[0], c }, { outline: PICO8[0] });
export const fightIcon = roomIcon(['c...c', '.c.c.', '..c..', '.c.c.', 'c...c'], PICO8[8]);
export const eliteIcon = roomIcon(['c.c.c', '.ccc.', 'ccccc', '.ccc.', 'c.c.c'], PICO8[9]);
export const restIcon = roomIcon(['..c..', '..c..', 'ccccc', '..c..', '..c..'], PICO8[11]);
export const lootIcon = roomIcon(['.ccc.', 'ccccc', 'kkckk', 'ccccc', 'ccccc'], PICO8[10]);
export const bossIcon = roomIcon(['c...c', 'ccccc', 'ckckc', 'ccccc', '.c.c.'], PICO8[14]);
