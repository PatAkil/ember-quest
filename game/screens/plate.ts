import { PICO8, drawSprite } from '../../engine';
import type { Sprite } from '../../engine';
import type { Point } from '../theme';

export interface Rect { x: number; y: number; w: number; h: number }

export const squareAt = (c: Point, size: number): Rect => ({ x: c.x - (size - 1) / 2, y: c.y - (size - 1) / 2, w: size, h: size });

export function drawRing(ctx: CanvasRenderingContext2D, r: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(r.x + 1, r.y, r.w - 2, 1);
  ctx.fillRect(r.x + 1, r.y + r.h - 1, r.w - 2, 1);
  ctx.fillRect(r.x, r.y + 1, 1, r.h - 2);
  ctx.fillRect(r.x + r.w - 1, r.y + 1, 1, r.h - 2);
}

export function drawMedallion(ctx: CanvasRenderingContext2D, r: Rect, ring: string): void {
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(r.x + 1, r.y, r.w - 2, r.h);
  ctx.fillRect(r.x, r.y + 1, r.w, r.h - 2);
  drawRing(ctx, r, ring);
}

export function drawIconIn(ctx: CanvasRenderingContext2D, sprite: Sprite, r: Rect, px: number): void {
  const x = r.x + Math.floor((r.w - sprite.w * px) / 2);
  const y = r.y + Math.floor((r.h - sprite.h * px) / 2);
  drawSprite(ctx, sprite, { x, y }, px);
}
