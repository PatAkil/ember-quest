import { PICO8, blink, drawFrame, drawText, textWidth } from '../engine';
import type { Sprite } from '../engine';
import { ICON_SWORD, ICON_WAND, ICON_ARMOR, ICON_NECKLACE, ICON_CHALICE, ICON_BOOTS, ICON_TOME } from './sprites';
import type { Item, Slot } from './types';
import { BAND_Y, C_BORDER, C_DIM, C_FAINT, C_PANEL, H, W } from './theme';
import { decisionReady } from './state';
import type { Game } from './state';
import type { Point } from './theme';

interface Box { x: number; y: number; w: number; h: number }

interface Gauge { frac: number; color: string; ghost?: number; ghostColor?: string }

const fillW = (w: number, frac: number): number => Math.max(0, Math.round(w * Math.max(0, Math.min(1, frac))));

export function drawGauge(ctx: CanvasRenderingContext2D, box: Box, gauge: Gauge): void {
  const { x, y, w, h } = box;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x, y, w, h);
  if (gauge.ghost !== undefined && gauge.ghost > gauge.frac) {
    ctx.fillStyle = gauge.ghostColor ?? PICO8[7]; ctx.fillRect(x, y, fillW(w, gauge.ghost), h);
  }
  ctx.fillStyle = gauge.color; ctx.fillRect(x, y, fillW(w, gauge.frac), h);
  drawFrame(ctx, { x, y, w, h }, { color: PICO8[0], thickness: 1 });
}

export function drawBar(ctx: CanvasRenderingContext2D, box: Box, frac: number, color: string): void {
  drawGauge(ctx, box, { frac, color });
}

export function drawLine(ctx: CanvasRenderingContext2D, from: Point, to: Point, color: string): void {
  drawDashed(ctx, { from, to, every: 1 }, color);
}

interface Dash { from: Point; to: Point; every: number }

export function drawDashed(ctx: CanvasRenderingContext2D, dash: Dash, color: string): void {
  const { from, to, every } = dash;
  const dx = to.x - from.x; const dy = to.y - from.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i += every) {
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

function greedySplit(words: readonly string[], maxW: number, scale: number): number {
  let split = 1;
  for (let i = 2; i < words.length; i++) {
    if (textWidth(words.slice(0, i).join(' '), scale) > maxW) {break;}
    split = i;
  }
  return split;
}

function balancedSplit(words: readonly string[], maxW: number, scale: number): number {
  let best = 0;
  let bestW = Infinity;
  for (let i = 1; i < words.length; i++) {
    const widest = Math.max(textWidth(words.slice(0, i).join(' '), scale), textWidth(words.slice(i).join(' '), scale));
    if (widest <= maxW && widest < bestW) { best = i; bestW = widest; }
  }
  return best || greedySplit(words, maxW, scale);
}

export function wrap2(text: string, maxW: number, scale = 1): [string] | [string, string] {
  const trimmed = text.trim();
  if (textWidth(trimmed, scale) <= maxW) {return [trimmed];}
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {return [trimmed];}
  const split = balancedSplit(words, maxW, scale);
  return [words.slice(0, split).join(' '), words.slice(split).join(' ')];
}

export const awakenWords = (raw: string): string => (raw ? `AWAKENS ${raw}` : '');

export const pct = (n: number): string => `${Math.round(n)}%`;

export const blinkHz = (clock: number, hz: number): boolean => blink(clock, 1 / hz, 0.5) === 1;

export const decisionPromptColor = (g: Game, lit: string): string => {
  if (!decisionReady(g)) {return C_FAINT;}
  return blinkHz(g.clock, 1.2) ? lit : C_DIM;
};
export const accentHz = (clock: number, hz: number, duty = 0.2): boolean => blink(clock, 1 / hz, duty) === 1;

const SLOT_ICON: Record<Slot, Sprite> = { WEAPON: ICON_SWORD, ARMOR: ICON_ARMOR, NECKLACE: ICON_NECKLACE, BOOTS: ICON_BOOTS, CHALICE: ICON_CHALICE, TOME: ICON_TOME };
export function itemIcon(item: Item): Sprite { return item.slot === 'WEAPON' && item.weaponKind === 'MAGIC' ? ICON_WAND : SLOT_ICON[item.slot]; }

export function drawCommandBand(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PICO8[0]; ctx.fillRect(0, BAND_Y - 1, W, 1);
  ctx.fillStyle = C_PANEL; ctx.fillRect(0, BAND_Y, W, H - BAND_Y);
  ctx.fillStyle = C_BORDER; ctx.fillRect(0, BAND_Y, W, 1);
}
