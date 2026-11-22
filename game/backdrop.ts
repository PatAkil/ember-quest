import { PICO8, drawBevel, drawSprite, fillDither, frameIndex } from '../engine';
import { animFrame, enemyAnim, heroFrames } from './sprites';
import type { Anim } from './sprites';
import { ENEMY_X, FLOOR_Y, H, HERO_X, W } from './theme';
import type { Point } from './theme';
import { biomeLook } from './state';
import type { Game } from './state';

type Ctx = CanvasRenderingContext2D;

function fillPeak(ctx: Ctx, base: Point, halfW: number, height: number): void {
  for (let i = 0; i < height; i++) {
    const hw = Math.round((halfW * (i + 1)) / height);
    ctx.fillRect(base.x - hw, base.y - height + i, hw * 2 + 1, 1);
  }
}

function fillDome(ctx: Ctx, base: Point, r: number, cap = r): void {
  for (let i = 0; i < cap; i++) {
    const y = base.y - cap + i;
    const dy = cap - i;
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(base.x - hw, y, hw * 2 + 1, 1);
  }
}

function fillDisc(ctx: Ctx, center: Point, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(center.x - hw, center.y + dy, hw * 2 + 1, 1);
  }
}

interface Layer { ctx: Ctx; clock: number; dim: number }

const fade = (l: Layer, alpha: number): void => { l.ctx.globalAlpha = alpha * l.dim; };

const PILLARS = [14, 92, 148, 216];
const SCONCE_PILLARS = [14, 216];
const SCONCE_Y = 58;

function drawSconce(l: Layer, pillarX: number): void {
  const { ctx } = l;
  const flame = frameIndex(l.clock, 6, 2);
  const cx = pillarX + 4;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(cx - 2, SCONCE_Y + 6, 6, 1); ctx.fillRect(cx, SCONCE_Y + 7, 2, 2);
  ctx.fillStyle = PICO8[4]; ctx.fillRect(cx - 1, SCONCE_Y + 4, 4, 2);
  ctx.fillStyle = flame ? PICO8[9] : PICO8[10];
  ctx.fillRect(cx - 1 + flame, SCONCE_Y, 3, 4); ctx.fillRect(cx, SCONCE_Y - 2 + flame, 2, 2);
}

function cryptBackdrop(l: Layer): void {
  const { ctx } = l;
  fade(l, 0.5); ctx.fillStyle = PICO8[1];
  ctx.fillRect(0, FLOOR_Y - 30, W, 30);
  fade(l, 1);
  for (const px of PILLARS) {
    ctx.fillRect(px, 6, 10, FLOOR_Y - 6);
    ctx.fillRect(px - 2, 6, 14, 3);
    ctx.fillRect(px - 2, FLOOR_Y - 4, 14, 4);
  }
  for (const px of SCONCE_PILLARS) {drawSconce(l, px);}
}

const PEAKS: readonly (readonly [number, number, number])[] = [[10, 26, 34], [48, 20, 24], [96, 30, 42], [140, 18, 20], [186, 26, 30], [232, 22, 26]];

function tundraBackdrop(l: Layer): void {
  const { ctx } = l;
  fade(l, 1); ctx.fillStyle = PICO8[1];
  fillDisc(ctx, { x: 60, y: 36 }, 12);
  ctx.globalAlpha = 1; ctx.fillStyle = PICO8[0]; fillDisc(ctx, { x: 65, y: 33 }, 10);
  fade(l, 1); ctx.fillStyle = PICO8[1];
  for (const [cx, hw, h] of PEAKS) {fillPeak(ctx, { x: cx, y: FLOOR_Y }, hw, h);}
  fade(l, 0.5); ctx.fillRect(0, FLOOR_Y - 18, W, 18);
}

function desertBackdrop(l: Layer): void {
  const { ctx } = l;
  fade(l, 0.3); ctx.fillStyle = PICO8[9];
  fillDome(ctx, { x: 150, y: FLOOR_Y - 34 }, 22, 22);
  fade(l, 0.45); ctx.fillStyle = PICO8[4];
  fillDome(ctx, { x: 40, y: FLOOR_Y }, 90, 30); fillDome(ctx, { x: 200, y: FLOOR_Y }, 110, 24);
  fade(l, 0.6); fillDome(ctx, { x: 130, y: FLOOR_Y }, 70, 12);
}

const COLUMNS = [22, 78, 162, 218];

function templeBackdrop(l: Layer): void {
  const { ctx } = l;
  fade(l, 0.5); ctx.fillStyle = PICO8[1];
  ctx.fillRect(0, FLOOR_Y - 26, W, 26);
  fade(l, 0.7); ctx.fillStyle = PICO8[5];
  for (const cx of COLUMNS) {
    ctx.fillRect(cx - 6, 10, 12, FLOOR_Y - 10);
    ctx.fillStyle = PICO8[0]; ctx.fillRect(cx - 2, 16, 1, FLOOR_Y - 22); ctx.fillRect(cx + 2, 16, 1, FLOOR_Y - 22);
    ctx.fillStyle = PICO8[5];
    ctx.fillRect(cx - 8, 10, 16, 4); ctx.fillRect(cx - 8, FLOOR_Y - 5, 16, 5);
  }
  fade(l, 0.45); ctx.fillStyle = PICO8[10];
  for (const cx of COLUMNS) {ctx.fillRect(cx - 8, 8, 16, 2);}
}

const BACKDROPS: readonly ((l: Layer) => void)[] = [cryptBackdrop, tundraBackdrop, desertBackdrop];

export function renderBiomeBackdrop(g: Game, dim = 1): void {
  const draw = BACKDROPS[g.actIndex] ?? templeBackdrop;
  const ctx = g.app.pc.ctx;
  draw({ ctx, clock: g.clock, dim });
  ctx.globalAlpha = 1;
}

const FLOOR_BLEED = 1;

export function renderFloor(g: Game): void {
  const b = biomeLook(g);
  const ctx = g.app.pc.ctx;
  drawBevel(ctx, { x: -FLOOR_BLEED, y: FLOOR_Y, w: W + 2 * FLOOR_BLEED, h: H - FLOOR_Y }, { fill: b.floor, light: b.floorLight, dark: b.floorDark });
  fillDither(ctx, { x: 0, y: FLOOR_Y + 2, w: W, h: 2 }, { colorA: b.floor, colorB: b.floorLight, pattern: 'sparse' });
  fillDither(ctx, { x: 0, y: H - 10, w: W, h: 10 }, { colorA: b.floor, colorB: b.floorDark, pattern: 'sparse' });
}

interface ActorPose { phase: number; fallen?: boolean }

export function drawActor(g: Game, frames: Anim, cx: number, pose: ActorPose): void {
  const ctx = g.app.pc.ctx;
  const f = animFrame(frames, g.clock + pose.phase);
  const sx = Math.round(cx - f.w / 2);
  const sy = FLOOR_Y - f.h;
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(sx + 3, FLOOR_Y - 1, f.w - 6, 3);
  if (pose.fallen) {
    ctx.save();
    ctx.translate(sx + f.w / 2, FLOOR_Y);
    ctx.rotate(-Math.PI / 2);
    drawSprite(ctx, frames[0], { x: 0, y: Math.round(-f.h / 2) }, 1);
    ctx.restore();
    return;
  }
  drawSprite(ctx, f, { x: sx, y: sy }, 1);
}

export function renderTableau(g: Game, withEnemy: boolean, withHero = true): void {
  renderBiomeBackdrop(g);
  g.app.particles.render(g.app.pc.ctx);
  renderFloor(g);
  if (withHero) {drawActor(g, heroFrames, HERO_X, { phase: 0, fallen: g.heroDown });}
  const enemy = g.battle.enemy;
  if (withEnemy && enemy) {drawActor(g, enemyAnim(enemy.def.id), ENEMY_X, { phase: 0.25 });}
}

const enemyHeight = (g: Game): number => {
  const enemy = g.battle.enemy;
  return enemy ? enemyAnim(enemy.def.id)[0].h : 0;
};

export function enemyPos(g: Game): Point {
  return { x: ENEMY_X, y: FLOOR_Y - enemyHeight(g) / 2 };
}

export const enemyHead = (g: Game): Point => ({ x: ENEMY_X, y: FLOOR_Y - enemyHeight(g) });
export const heroHead = (): Point => ({ x: HERO_X, y: FLOOR_Y - heroFrames[0].h });
