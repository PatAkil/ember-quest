import { PICO8 } from '../engine';
import type { RevealShape } from './fx-state';
import type { Game, SubScene } from './state';
import { C_PANEL, H, W } from './theme';

type Ctx = CanvasRenderingContext2D;

const OVERSCAN = 16;
const SHAPE_FOR: Record<SubScene, RevealShape> = { MAP: 'WIPE', BATTLE: 'BLINDS', LEVELUP: 'WIPE', LOOT: 'WIPE', CARD: 'WIPE' };
const DURATION: Record<RevealShape, number> = { BLINDS: 0.2, WIPE: 0.16 };

export function trackReveal(g: Game, dt: number): void {
  const r = g.reveal;
  r.t = Math.min(r.dur, r.t + dt);
  if (g.subScene === r.last) {return;}
  r.last = g.subScene;
  if (!g.app.scenes.is('PLAYING')) {return;}
  r.shape = SHAPE_FOR[g.subScene];
  r.dur = DURATION[r.shape];
  r.t = 0;
}

const BAND = 20;

function drawBlinds(ctx: Ctx, u: number): void {
  for (let b = 0; b * BAND < H; b++) {
    const local = Math.min(1, Math.max(0, u * 1.35 - b * 0.05));
    const cover = Math.round(BAND * (1 - local * local * (3 - 2 * local)));
    if (cover <= 0) {continue;}
    const top = b * BAND + Math.round((BAND - cover) / 2);
    ctx.fillStyle = PICO8[0]; ctx.fillRect(-OVERSCAN, top, W + 2 * OVERSCAN, cover);
    ctx.fillStyle = C_PANEL; ctx.fillRect(-OVERSCAN, top, W + 2 * OVERSCAN, 1); ctx.fillRect(-OVERSCAN, top + cover - 1, W + 2 * OVERSCAN, 1);
  }
}

const ROW = 4;
const SLANT = 0.5;

function drawWipe(ctx: Ctx, u: number): void {
  const eased = 1 - (1 - u) ** 2;
  const reach = (W + H * SLANT + 2 * OVERSCAN) * eased - OVERSCAN;
  for (let y = 0; y < H; y += ROW) {
    const edge = Math.round(reach - (H - y) * SLANT);
    ctx.fillStyle = PICO8[0]; ctx.fillRect(edge, y, W + OVERSCAN - edge, ROW);
    ctx.fillStyle = C_PANEL; ctx.fillRect(edge, y, 2, ROW);
  }
}

const DRAW: Record<RevealShape, (ctx: Ctx, u: number) => void> = { BLINDS: drawBlinds, WIPE: drawWipe };

export const revealActive = (g: Game): boolean => g.reveal.t < g.reveal.dur;

export function syncReveal(g: Game): void {
  g.reveal.last = g.subScene;
  g.reveal.t = g.reveal.dur;
}

export function drawReveal(g: Game): void {
  if (!revealActive(g)) {return;}
  const r = g.reveal;
  DRAW[r.shape](g.app.pc.ctx, r.t / r.dur);
}
