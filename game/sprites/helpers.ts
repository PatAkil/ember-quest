import { frameIndex, makeSprite } from '../../engine';
import type { Sprite, SpriteMap } from '../../engine';

export type Anim = [Sprite, Sprite];
type Rows = [string, ...string[]];

export function breatheFrames(rows: Rows, map: SpriteMap): Anim {
  const w = rows[0].length;
  const cut = Math.round(rows.length * 0.55);
  const squashed = ['.'.repeat(w), ...rows.slice(0, cut), ...rows.slice(cut + 1)];
  return [makeSprite(rows, map), makeSprite(squashed, map)];
}

export function floatFrames(rows: Rows, map: SpriteMap): Anim {
  const w = rows[0].length;
  return [makeSprite(rows, map), makeSprite([...rows, '.'.repeat(w)], map)];
}

export function animFrame(anim: Anim, time: number): Sprite {
  return frameIndex(time, 2, 2) === 0 ? anim[0] : anim[1];
}
