import { PICO8, blink, drawFrame, drawText, textWidth } from '../engine';
import type { Sprite } from '../engine';
import { ICON_SWORD, ICON_WAND, ICON_ARMOR, ICON_NECKLACE, ICON_CHALICE, ICON_BOOTS, ICON_TOME } from './sprites';
import type { Item, Slot } from './types';
import type { Point } from './theme';

interface Box { x: number; y: number; w: number; h: number }

export function drawBar(ctx: CanvasRenderingContext2D, box: Box, frac: number, color: string): void {
  const { x, y, w, h } = box;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, frac)))), h);
  drawFrame(ctx, { x, y, w, h }, { color: PICO8[0], thickness: 1 });
}

export function drawLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string): void {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(from.x + (dx * i) / steps), Math.round(from.y + (dy * i) / steps), 1, 1);
  }
}

interface FitBox { x: number; y: number; maxW: number }

export function fitText(ctx: CanvasRenderingContext2D, text: string, box: FitBox, opts: { color: string; shadow?: boolean }): void {
  let t = text;
  while (t.length > 3 && textWidth(t, 1) > box.maxW) {
    const cut = t.lastIndexOf(' ');
    t = cut > 0 ? t.slice(0, cut) : t.slice(0, -1);
  }
  drawText(ctx, t, { x: box.x, y: box.y }, opts);
}

export function wrap2(text: string, maxW: number): [string] | [string, string] {
  if (textWidth(text, 1) <= maxW) {return [text];}
  const words = text.split(' ');
  let first = '';
  for (const w of words) {
    const t = first ? `${first} ${w}` : w;
    if (textWidth(t, 1) > maxW) {break;}
    first = t;
  }
  return [first, text.slice(first.length).trim()];
}

export const pct = (n: number): string => `${Math.round(n)}%`;

export const blinkHz = (clock: number, hz: number): boolean => blink(clock, 1 / hz, 0.5) === 1;
export const accentHz = (clock: number, hz: number, duty = 0.2): boolean => blink(clock, 1 / hz, duty) === 1;

const SLOT_ICON: Record<Slot, Sprite> = { WEAPON: ICON_SWORD, ARMOR: ICON_ARMOR, NECKLACE: ICON_NECKLACE, BOOTS: ICON_BOOTS, CHALICE: ICON_CHALICE, TOME: ICON_TOME };
export function itemIcon(item: Item): Sprite { return item.slot === 'WEAPON' && item.weaponKind === 'MAGIC' ? ICON_WAND : SLOT_ICON[item.slot]; }
