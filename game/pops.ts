import { PICO8, drawText, textWidth } from '../engine';
import type { Game, Pop } from './state';

const POP_LIFE = 1.1;
const POP_BACKING = PICO8[0];

interface PopAt { x: number; y: number; scale?: number }

export function pushPop(pops: Pop[], at: PopAt, text: string, color: string): void {
  pops.push({ x: at.x, y: at.y, life: POP_LIFE, text, color, scale: at.scale ?? 2 });
}

export function updatePops(pops: Pop[], dt: number): void {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i];
    if (!p) {continue;}
    p.life -= dt; p.y -= 14 * dt;
    if (p.life <= 0) {pops.splice(i, 1);}
  }
}

export function drawPops(g: Game): void {
  const ctx = g.app.pc.ctx;
  for (const p of g.pops) {
    ctx.globalAlpha = Math.min(1, Math.max(0, (p.life / POP_LIFE) * 1.6));
    drawText(ctx, p.text, { x: Math.round(p.x - textWidth(p.text, p.scale) / 2), y: Math.round(p.y) }, { color: p.color, scale: p.scale, shadow: p.scale < 3 ? POP_BACKING : false, outline: p.scale >= 3 ? POP_BACKING : false });
  }
  ctx.globalAlpha = 1;
}
