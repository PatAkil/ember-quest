import { PICO8, drawBevel, drawSprite, fillDither, frameIndex, rotateSprite } from '../engine';
import { animFrame, enemyAnim, heroFrames } from './sprites';
import { heroFallen } from './sprites/hero';
import type { Anim } from './sprites';
import type { Sprite, SpriteDrawOptions } from '../engine';
import { actorPose, fadeProgress } from './fx';
import type { Pose } from './fx';
import type { PopAnchor } from './pops';
import { ACTOR_PX, ENEMY_FRONT, ENEMY_MIN_X, FLOOR_Y, H, HERO_H, HERO_W, HERO_X, W } from './theme';
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

const PILLARS = [14, 76, 154, 216];
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

const SUN_X = Math.round((HERO_X + HERO_W / 2 + ENEMY_FRONT) / 2);

const SUN_BASE = FLOOR_Y - 32;
const SUN_BANDS = [4, 9, 13];

function drawSun(l: Layer): void {
  const { ctx } = l;
  fade(l, 1); ctx.fillStyle = PICO8[9];
  fillDome(ctx, { x: SUN_X, y: SUN_BASE }, 22, 22);
  ctx.fillStyle = PICO8[10];
  fillDome(ctx, { x: SUN_X, y: SUN_BASE - 10 }, 10, 10);
  ctx.globalAlpha = 1; ctx.fillStyle = PICO8[0];
  for (const dy of SUN_BANDS) {ctx.fillRect(SUN_X - 23, SUN_BASE - dy, 47, dy > 8 ? 1 : 2);}
}

function desertBackdrop(l: Layer): void {
  const { ctx } = l;
  drawSun(l);
  fade(l, 0.45); ctx.fillStyle = PICO8[4];
  fillDome(ctx, { x: 40, y: FLOOR_Y }, 90, 30); fillDome(ctx, { x: 200, y: FLOOR_Y }, 110, 24);
  fade(l, 0.6); fillDome(ctx, { x: 130, y: FLOOR_Y }, 70, 12);
}

const COLUMNS = [22, 78, 162, 218];
const COLUMN_TOP = 46;

function drawColumn(ctx: Ctx, cx: number): void {
  const shaft = FLOOR_Y - COLUMN_TOP;
  ctx.fillStyle = PICO8[5];
  ctx.fillRect(cx - 6, COLUMN_TOP, 12, shaft);
  ctx.fillRect(cx - 8, COLUMN_TOP, 16, 4); ctx.fillRect(cx - 8, FLOOR_Y - 5, 16, 5);
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(cx - 2, COLUMN_TOP + 6, 1, shaft - 12); ctx.fillRect(cx + 2, COLUMN_TOP + 6, 1, shaft - 12);
}

function drawCapital(ctx: Ctx, cx: number): void {
  ctx.fillStyle = PICO8[10]; ctx.fillRect(cx - 9, COLUMN_TOP - 4, 18, 3);
  ctx.fillStyle = PICO8[9]; ctx.fillRect(cx - 8, COLUMN_TOP - 1, 16, 1);
}

function templeBackdrop(l: Layer): void {
  const { ctx } = l;
  fade(l, 0.5); ctx.fillStyle = PICO8[1];
  ctx.fillRect(0, FLOOR_Y - 26, W, 26);
  fade(l, 0.7);
  for (const cx of COLUMNS) {drawColumn(ctx, cx);}
  fade(l, 1);
  for (const cx of COLUMNS) {drawCapital(ctx, cx);}
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

interface ActorPose { phase: number; px?: number; motion?: Pose; seed?: number }

const DISSOLVE_FRINGE = PICO8[9];
const DISSOLVE_FALL = 6;

function inkOptions(px: number, m: Pose | undefined, seed: number): SpriteDrawOptions {
  const o: SpriteDrawOptions = { px };
  if (!m) {return o;}
  if (m.tint) {o.tint = m.tint;}
  if (m.dissolve > 0) { o.dissolve = m.dissolve; o.fringe = DISSOLVE_FRINGE; o.fall = DISSOLVE_FALL; o.seed = seed; }
  return o;
}

export function drawActor(g: Game, frames: Anim, cx: number, pose: ActorPose): void {
  const ctx = g.app.pc.ctx;
  const px = pose.px ?? ACTOR_PX;
  const f = animFrame(frames, g.clock + pose.phase);
  const dx = pose.motion?.dx ?? 0;
  const sx = Math.round(cx - (f.w * px) / 2) + dx;
  if ((pose.motion?.dissolve ?? 0) < 0.6) {drawGroundShadow(ctx, { x: sx, w: f.w * px }, px);}
  drawSprite(ctx, f, { x: sx, y: FLOOR_Y - f.h * px + (pose.motion?.dy ?? 0) }, inkOptions(px, pose.motion, pose.seed ?? 0));
}

function drawGroundShadow(ctx: Ctx, span: { x: number; w: number }, px: number): void {
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(span.x + 3 * px, FLOOR_Y - 1, span.w - 6 * px, 2 + px);
}

const FALLEN_SINK = 2;

function drawFallenHero(ctx: Ctx): void {
  const w = heroFallen.w * ACTOR_PX;
  const x = Math.round(HERO_X - w / 2);
  const y = FLOOR_Y + FALLEN_SINK * ACTOR_PX - heroFallen.h * ACTOR_PX;
  drawGroundShadow(ctx, { x, w: w - 16 * ACTOR_PX }, ACTOR_PX);
  drawSprite(ctx, heroFallen, { x, y }, ACTOR_PX);
}

const FALL_FRAMES: readonly { sprite: Sprite; shift: number; sink: number }[] = [
  { sprite: rotateSprite(heroFrames[0], -0.45), shift: 3, sink: 0 },
  { sprite: rotateSprite(heroFrames[0], -0.95), shift: 6, sink: 1 },
  { sprite: rotateSprite(heroFrames[0], -1.35), shift: 5, sink: 2 },
];

function drawFallingHero(g: Game, progress: number): boolean {
  const frame = FALL_FRAMES[Math.floor(progress * (FALL_FRAMES.length + 1)) - 1];
  if (!frame) {return false;}
  const s = frame.sprite;
  const x = Math.round(HERO_X - frame.shift - (s.w * ACTOR_PX) / 2);
  drawGroundShadow(g.app.pc.ctx, { x: HERO_X - HERO_W / 2, w: HERO_W }, ACTOR_PX);
  drawSprite(g.app.pc.ctx, s, { x, y: FLOOR_Y + frame.sink * ACTOR_PX - s.h * ACTOR_PX }, ACTOR_PX);
  return true;
}

function drawHero(g: Game): void {
  const progress = g.heroDown ? fadeProgress(g.fx, g.fx.fall) : 0;
  if (progress >= 1) { drawFallenHero(g.app.pc.ctx); return; }
  if (progress > 0 && drawFallingHero(g, progress)) {return;}
  drawActor(g, heroFrames, HERO_X, { phase: 0, motion: actorPose(g, 'HERO') });
}

function seedOf(id: string): number {
  let n = 7;
  for (let i = 0; i < id.length; i++) {n = (n * 31 + id.charCodeAt(i)) % 9973;}
  return n;
}

const enemySprite = (g: Game): Sprite | null => {
  const enemy = g.battle.enemy;
  return enemy ? enemyAnim(enemy.def.id)[0] : null;
};

function enemyBox(g: Game): { x: number; w: number; h: number } {
  const s = enemySprite(g);
  const w = (s?.w ?? 0) * ACTOR_PX;
  return { x: Math.max(ENEMY_MIN_X, ENEMY_FRONT + w / 2), w, h: (s?.h ?? 0) * ACTOR_PX };
}

export function renderTableau(g: Game, withEnemy: boolean, withHero = true): void {
  renderBiomeBackdrop(g);
  g.app.particles.render(g.app.pc.ctx);
  renderFloor(g);
  if (withHero) {drawHero(g);}
  const enemy = g.battle.enemy;
  if (withEnemy && enemy) {drawActor(g, enemyAnim(enemy.def.id), enemyBox(g).x, { phase: 0.25, motion: actorPose(g, 'ENEMY'), seed: seedOf(enemy.def.id) });}
}

export function enemyPos(g: Game): Point {
  const box = enemyBox(g);
  return { x: box.x, y: FLOOR_Y - box.h / 2 };
}

const heroHead = (): Point => ({ x: HERO_X, y: FLOOR_Y - HERO_H });

export const heroAnchor = (): PopAnchor => ({ head: heroHead(), front: HERO_X + HERO_W / 2 });

export function enemyAnchor(g: Game): PopAnchor {
  const box = enemyBox(g);
  return { head: { x: box.x, y: FLOOR_Y - box.h }, front: box.x - box.w / 2 };
}
