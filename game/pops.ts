import { PICO8, SAFE_MARGIN, drawText, textWidth } from '../engine';
import type { Game, Pop } from './state';
import { HUD_BOTTOM, W } from './theme';
import type { Point } from './theme';

const POP_LIFE = 1.1;
const POP_RISE = 10;
const POP_BACKING = PICO8[0];
const POP_GAP = 12;
const POP_LINE = 20;
const POP_STAGGER = 8;
const TAG_STRIP_BOTTOM = HUD_BOTTOM + 8;
const POP_CEIL = TAG_STRIP_BOTTOM + 3;
const POP_MIN_Y = POP_CEIL + Math.ceil(POP_LIFE * POP_RISE);
const CLAMP_SHIFT = 2;
const TALL_CLAMP = 6;
const GAP_CLEAR = 14;
const PLATE_PAD = 1;

export interface PopAnchor { head: Point; front: number }

interface PopAt { x: number; y: number; scale?: number }

function slideToward(toFront: number, clamped: number): number {
  if (clamped >= TALL_CLAMP) {return toFront + GAP_CLEAR;}
  return Math.min(toFront, clamped * CLAMP_SHIFT);
}

export function popSpot(anchor: PopAnchor, slot = 0): Point {
  const { head, front } = anchor;
  const wanted = head.y - POP_GAP;
  const clamped = Math.max(0, POP_MIN_Y - wanted);
  const toFront = front - head.x;
  const shift = Math.sign(toFront) * slideToward(Math.abs(toFront), clamped);
  const stagger = slot % 2 === 1 ? Math.sign(toFront || 1) * POP_STAGGER : 0;
  return { x: head.x + shift + stagger, y: wanted + clamped + slot * POP_LINE };
}

export const scoreSpot = (): Point => ({ x: W / 2, y: POP_MIN_Y });

export function pushPop(pops: Pop[], at: PopAt, text: string, color: string): void {
  pops.push({ x: at.x, y: at.y, life: POP_LIFE, text, color, scale: at.scale ?? 2 });
}

export function clearPops(g: Game): void { g.pops.length = 0; }

export function updatePops(pops: Pop[], dt: number): void {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    if (!p) {continue;}
    p.life -= dt; p.y -= POP_RISE * dt;
    if (p.life <= 0) {pops.splice(i, 1);}
  }
}

function popOrigin(p: Pop): Point {
  const half = textWidth(p.text, p.scale) / 2;
  const room = half + PLATE_PAD * p.scale;
  const x = Math.min(W - SAFE_MARGIN - room, Math.max(SAFE_MARGIN + room, p.x));
  return { x: Math.round(x - half), y: Math.round(Math.max(POP_CEIL + PLATE_PAD * p.scale, p.y)) };
}

function drawPopPlate(ctx: CanvasRenderingContext2D, p: Pop, at: Point): void {
  const pad = PLATE_PAD * p.scale;
  ctx.fillStyle = POP_BACKING;
  ctx.fillRect(at.x - pad, at.y - pad, textWidth(p.text, p.scale) + 2 * pad, 5 * p.scale + 2 * pad);
}

const POP_FADE_RATE = 4;

export function drawPops(g: Game): void {
  const ctx = g.app.pc.ctx;
  for (const p of g.pops) {
    ctx.globalAlpha = Math.min(1, Math.max(0, (p.life / POP_LIFE) * POP_FADE_RATE));
    const at = popOrigin(p);
    drawPopPlate(ctx, p, at);
    drawText(ctx, p.text, at, { color: p.color, scale: p.scale, shadow: false });
  }
  ctx.globalAlpha = 1;
}
