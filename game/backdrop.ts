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

function cryptBackdrop(ctx: Ctx, clock: number): void {
  const flame = frameIndex(clock, 6, 2);
  ctx.globalAlpha = 0.5; ctx.fillStyle = PICO8[1];
  ctx.fillRect(0, FLOOR_Y - 30, W, 30);
  ctx.globalAlpha = 1;
  for (const px of [14, 92, 148, 216]) {
    ctx.fillRect(px, 6, 10, FLOOR_Y - 6);
    ctx.fillRect(px - 2, 6, 14, 3);
    ctx.fillRect(px - 2, FLOOR_Y - 4, 14, 4);
  }
  for (const tx of [40, 120, 200]) {
    ctx.fillStyle = PICO8[4]; ctx.fillRect(tx, 44, 2, 6);
    ctx.fillStyle = flame ? PICO8[9] : PICO8[10];
    ctx.fillRect(tx - 1 + flame, 38, 3, 4); ctx.fillRect(tx, 36 + flame, 2, 2);
  }
}

const PEAKS: readonly (readonly [number, number, number])[] = [[10, 26, 34], [48, 20, 24], [96, 30, 42], [140, 18, 20], [186, 26, 30], [232, 22, 26]];

function tundraBackdrop(ctx: Ctx): void {
  ctx.fillStyle = PICO8[1];
  fillDisc(ctx, { x: 60, y: 36 }, 12);
  ctx.fillStyle = PICO8[0]; fillDisc(ctx, { x: 65, y: 33 }, 10);
  ctx.fillStyle = PICO8[1];
  for (const [cx, hw, h] of PEAKS) {fillPeak(ctx, { x: cx, y: FLOOR_Y }, hw, h);}
  ctx.globalAlpha = 0.5; ctx.fillRect(0, FLOOR_Y - 18, W, 18); ctx.globalAlpha = 1;
}

function desertBackdrop(ctx: Ctx): void {
  ctx.globalAlpha = 0.3; ctx.fillStyle = PICO8[9];
  fillDome(ctx, { x: 150, y: FLOOR_Y - 34 }, 22, 22);
  ctx.globalAlpha = 0.45; ctx.fillStyle = PICO8[4];
  fillDome(ctx, { x: 40, y: FLOOR_Y }, 90, 30); fillDome(ctx, { x: 200, y: FLOOR_Y }, 110, 24);
  ctx.globalAlpha = 0.6; fillDome(ctx, { x: 130, y: FLOOR_Y }, 70, 12);
  ctx.globalAlpha = 1;
}

const COLUMNS = [22, 78, 162, 218];

function templeBackdrop(ctx: Ctx): void {
  ctx.globalAlpha = 0.5; ctx.fillStyle = PICO8[1];
  ctx.fillRect(0, FLOOR_Y - 26, W, 26);
  ctx.globalAlpha = 0.7; ctx.fillStyle = PICO8[5];
  for (const cx of COLUMNS) {
    ctx.fillRect(cx - 6, 10, 12, FLOOR_Y - 10);
    ctx.fillStyle = PICO8[0]; ctx.fillRect(cx - 2, 16, 1, FLOOR_Y - 22); ctx.fillRect(cx + 2, 16, 1, FLOOR_Y - 22);
    ctx.fillStyle = PICO8[5];
    ctx.fillRect(cx - 8, 10, 16, 4); ctx.fillRect(cx - 8, FLOOR_Y - 5, 16, 5);
  }
  ctx.globalAlpha = 0.45; ctx.fillStyle = PICO8[10];
  for (const cx of COLUMNS) {ctx.fillRect(cx - 8, 8, 16, 2);}
  ctx.globalAlpha = 1;
}

const BACKDROPS: readonly ((ctx: Ctx, clock: number) => void)[] = [cryptBackdrop, tundraBackdrop, desertBackdrop];

export function renderBiomeBackdrop(g: Game): void {
  const draw = BACKDROPS[g.actIndex] ?? templeBackdrop;
  draw(g.app.pc.ctx, g.clock);
}

export function renderFloor(g: Game): void {
  const b = biomeLook(g);
  const ctx = g.app.pc.ctx;
  drawBevel(ctx, { x: 0, y: FLOOR_Y, w: W, h: H - FLOOR_Y }, { fill: b.floor, light: b.floorLight, dark: b.floorDark });
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

export function enemyPos(g: Game): Point {
  const enemy = g.battle.enemy;
  const h = enemy ? enemyAnim(enemy.def.id)[0].h : 0;
  return { x: ENEMY_X, y: FLOOR_Y - h / 2 };
}
