import { PICO8, drawSprite, makeSprite } from '../../engine';
import { easeOut } from '../fx';
import type { Shot } from '../fx-state';
import { W } from '../theme';
import type { Point } from '../theme';

export type Ctx = CanvasRenderingContext2D;
export interface Frame { ctx: Ctx; s: Shot; u: number; t: number }

export const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

export function dot(ctx: Ctx, p: Point, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
}

export function blob(ctx: Ctx, p: Point, r: number, color: string): void {
  const x = Math.round(p.x); const y = Math.round(p.y);
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - r + 1, 2 * r + 1, 2 * r - 1);
  ctx.fillRect(x - r + 1, y - r, 2 * r - 1, 2 * r + 1);
}

export const hash = (a: number, b: number): number => {
  const h = Math.imul(a * 73856093 ^ b * 19349663, 0x85ebca6b) >>> 0;
  return (h % 1000) / 1000;
};

const BEAM_LAYERS: readonly (readonly [number, string])[] = [[7, PICO8[9]], [5, PICO8[10]], [2, PICO8[7]]];

function beamWidth(u: number): number {
  if (u < 0.12) {return easeOut(u / 0.12);}
  return u < 0.6 ? 1 : 1 - easeOut((u - 0.6) / 0.4);
}

export function drawBeam(f: Frame): void {
  const { ctx, s, u } = f;
  const k = beamWidth(u);
  const x0 = Math.round(s.from.x);
  const flick = Math.floor(f.t * 30);
  for (const [half, color] of BEAM_LAYERS) {
    const h = Math.max(1, Math.round(half * k));
    ctx.fillStyle = color;
    for (let x = x0; x < W + 16; x += 4) {
      const wob = Math.round((hash(x, flick) - 0.5) * 2 * k);
      ctx.fillRect(x, Math.round(s.from.y) - h + wob, 4, 2 * h);
    }
  }
  blob(ctx, s.from, Math.round(3 + 6 * k), PICO8[10]);
  blob(ctx, s.from, Math.round(1 + 4 * k), PICO8[7]);
}

const FLASK_MAP = { g: PICO8[11], w: PICO8[7] };
const FLASK_UP = makeSprite(['.w.', '.w.', 'ggg', 'gwg', 'ggg'], FLASK_MAP, { outline: PICO8[0] });
const FLASK_TIPPED = makeSprite(['ggg..', 'gwgww', 'ggg..'], FLASK_MAP, { outline: PICO8[0] });

export function drawFlask(f: Frame): void {
  const { ctx, s, u } = f;
  const p = { x: lerp(s.from.x, s.to.x, easeOut(u)), y: lerp(s.from.y, s.to.y, easeOut(u)) - 6 * Math.sin(Math.PI * u) };
  const sprite = u < 0.55 ? FLASK_UP : FLASK_TIPPED;
  drawSprite(ctx, sprite, { x: Math.round(p.x - sprite.w), y: Math.round(p.y - sprite.h) }, 2);
}

const SHIELD_H = 22;

export function drawShieldArc(ctx: Ctx, at: Point, glint: number, color: string): void {
  for (let i = -SHIELD_H; i <= SHIELD_H; i += 2) {
    const v = i / SHIELD_H;
    const x = at.x + Math.round(5 * (1 - v * v));
    const near = Math.abs(v - glint) < 0.18;
    dot(ctx, { x, y: at.y + i }, near ? 3 : 2, near ? PICO8[7] : color);
  }
}

export function drawShield(f: Frame): void {
  const { ctx, s, u } = f;
  if (u > 0.7 && Math.floor(f.t * 30) % 2 === 1) {return;}
  drawShieldArc(ctx, s.from, lerp(-1.2, 1.2, easeOut(u)), s.color);
}
