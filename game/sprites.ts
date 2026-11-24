import { CRYPT_FRAMES } from './sprites/crypt';
import { TUNDRA_FRAMES } from './sprites/tundra';
import { DESERT_FRAMES } from './sprites/desert';
import { TEMPLE_FRAMES } from './sprites/temple';
import { hollowFrames } from './sprites/hero';
import type { Anim } from './sprites/helpers';

export type { Anim } from './sprites/helpers';
export { animFrame } from './sprites/helpers';
export { heroFallen, heroFrames } from './sprites/hero';
export {
  ICON_SWORD, ICON_WAND, ICON_ARMOR, ICON_NECKLACE, ICON_CHALICE, ICON_BOOTS, ICON_TOME, ICON_EMPTY, ICON_SCROLL,
  HERO_PIP, ROOM_ART,
} from './sprites/icons';
export type { RoomArt } from './sprites/icons';

export const ENEMY_FRAMES = { ...CRYPT_FRAMES, ...TUNDRA_FRAMES, ...DESERT_FRAMES, ...TEMPLE_FRAMES, HOLLOW: hollowFrames };

const BY_ID: Readonly<Partial<Record<string, Anim>>> = ENEMY_FRAMES;

export function enemyAnim(id: string): Anim {
  const anim = BY_ID[id];
  if (!anim) {
    throw new Error(`no sprite for enemy ${id}`);
  }
  return anim;
}
