import { PICO8 } from '../../engine';
import type { Burn } from '../types';
import { enemyAnchor, enemyPos } from '../backdrop';
import { actorPose, guardShown } from '../fx';
import type { Actor } from '../fx-state';
import type { Game } from '../state';
import { C_WARD, FLOOR_Y, HERO_H, HERO_W, HERO_X, HUD_BOTTOM } from '../theme';
import type { Point } from '../theme';
import { dot, drawShieldArc, hash } from './battle-fx-shapes';

type Ctx = CanvasRenderingContext2D;
interface Body { centre: Point; halfW: number; halfH: number }

function heroBody(g: Game): Body {
  const dx = actorPose(g, 'HERO').dx;
  return { centre: { x: HERO_X + dx, y: FLOOR_Y - HERO_H / 2 }, halfW: HERO_W / 2, halfH: HERO_H / 2 };
}

function enemyBody(g: Game): Body {
  const p = enemyPos(g);
  const a = enemyAnchor(g);
  const dx = actorPose(g, 'ENEMY').dx;
  return { centre: { x: p.x + dx, y: p.y }, halfW: p.x - a.front, halfH: p.y - a.head.y };
}

const SHIELD_SWEEP = 1.6;

function drawGuard(g: Game, ctx: Ctx): void {
  const b = heroBody(g);
  const glint = ((g.fx.t % SHIELD_SWEEP) / SHIELD_SWEEP) * 3 - 1.5;
  drawShieldArc(ctx, { x: b.centre.x + b.halfW + 3, y: b.centre.y + 2 }, glint, C_WARD);
}

const CHARGE_DOTS = 26;
const STRIP_FLOOR = HUD_BOTTOM + 12;
const CHARGE_INK: readonly string[] = [PICO8[10], PICO8[9], PICO8[9], PICO8[8]];

function drawCharge(g: Game, ctx: Ctx): void {
  const b = enemyBody(g);
  const k = g.fx.charge;
  const pulse = Math.sin(g.fx.t * 9) * 2;
  const grow = 0.55 + 0.45 * k;
  for (let i = 0; i < CHARGE_DOTS; i++) {
    const a = (i / CHARGE_DOTS) * Math.PI * 2 + g.fx.t * 1.5;
    const ring = i % 2 === 0 ? 4 : 0;
    const rx = (b.halfW + 2 + ring) * grow + pulse;
    const ry = (b.halfH + ring) * grow + pulse;
    const y = Math.max(STRIP_FLOOR, b.centre.y + Math.sin(a) * ry);
    const ink = CHARGE_INK[(i + Math.floor(g.fx.t * 12)) % CHARGE_INK.length] ?? PICO8[9];
    dot(ctx, { x: b.centre.x + Math.cos(a) * rx, y }, ring ? 2 : 3, ink);
  }
  drawEmbers(g, ctx, { ...b, halfW: b.halfW * 0.8 });
}

const WARD_DOTS = 24;

function drawWard(g: Game, ctx: Ctx): void {
  const b = enemyBody(g);
  const spin = g.fx.t * 2.2;
  for (let i = 0; i < WARD_DOTS; i++) {
    const a = (i / WARD_DOTS) * Math.PI * 2 + spin;
    const p = { x: b.centre.x + Math.cos(a) * (b.halfW + 7), y: Math.max(STRIP_FLOOR, b.centre.y + Math.sin(a) * (b.halfH + 5)) };
    if (Math.sin(a) < -0.2 && i % 2 === 1) {continue;}
    dot(ctx, p, 2, (i + Math.floor(g.fx.t * 8)) % 4 === 0 ? PICO8[7] : C_WARD);
  }
}

const EMBERS = 6;
const EMBER_INK: readonly string[] = [PICO8[10], PICO8[9], PICO8[9], PICO8[8]];

function drawEmbers(g: Game, ctx: Ctx, b: Body): void {
  for (let k = 0; k < EMBERS; k++) {
    const u = (g.fx.t * 0.8 + k / EMBERS) % 1;
    const x = b.centre.x + (hash(k, 11) - 0.5) * b.halfW * 1.4 + Math.sin(u * 7 + k) * 2;
    const y = b.centre.y + b.halfH * 0.7 - u * b.halfH * 1.6;
    dot(ctx, { x, y: Math.max(STRIP_FLOOR, y) }, u < 0.5 ? 2 : 1, EMBER_INK[Math.floor(u * EMBER_INK.length)] ?? PICO8[8]);
  }
}

function drawStars(g: Game, ctx: Ctx): void {
  const b = enemyBody(g);
  const top = Math.max(STRIP_FLOOR + 3, b.centre.y - b.halfH - 2);
  for (let k = 0; k < 3; k++) {
    const a = g.fx.t * 6 + k * 2.09;
    sparkle(ctx, { x: b.centre.x + Math.cos(a) * 12, y: top + Math.sin(a) * 3 }, 2);
  }
}

function sparkle(ctx: Ctx, at: Point, r: number): void {
  const x = Math.round(at.x); const y = Math.round(at.y);
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(x - r - 1, y - 1, 2 * r + 3, 3); ctx.fillRect(x - 1, y - r - 1, 3, 2 * r + 3);
  ctx.fillStyle = PICO8[10];
  ctx.fillRect(x - r, y, 2 * r + 1, 1); ctx.fillRect(x, y - r, 1, 2 * r + 1);
  ctx.fillStyle = PICO8[7]; ctx.fillRect(x, y, 1, 1);
}

const BLADE_TIP: Point = { x: HERO_X + 17, y: FLOOR_Y - 45 };

function drawRiposte(g: Game, ctx: Ctx): void {
  const r = Math.floor(g.fx.t * 4) % 2 === 0 ? 4 : 2;
  sparkle(ctx, { x: BLADE_TIP.x + actorPose(g, 'HERO').dx, y: BLADE_TIP.y }, r);
}

const burning = (b: Burn | null): boolean => b !== null && b.turns > 0;

function enemyLive(g: Game): boolean {
  const e = g.battle.enemy;
  return e !== null && e.hp > 0 && g.fx.dissolve === null;
}

function drawHeroAuras(g: Game, ctx: Ctx): void {
  const s = g.battle.state;
  if (g.heroDown) {return;}
  if (burning(g.hero.burn)) {drawEmbers(g, ctx, heroBody(g));}
  if (guardShown(g)) {drawGuard(g, ctx);}
  if (s?.riposte) {drawRiposte(g, ctx);}
}

function drawEnemyAuras(g: Game, ctx: Ctx): void {
  const e = g.battle.enemy;
  if (!e || !enemyLive(g)) {return;}
  if (g.fx.charge > 0.05) {drawCharge(g, ctx);}
  if (e.wardTurns > 0) {drawWard(g, ctx);}
  if (burning(e.burn)) {drawEmbers(g, ctx, enemyBody(g));}
  if (e.staggered) {drawStars(g, ctx);}
}

export function drawAuras(g: Game): void {
  const ctx = g.app.pc.ctx;
  drawHeroAuras(g, ctx);
  drawEnemyAuras(g, ctx);
}

export const actorBody = (actor: Actor, g: Game): Body => (actor === 'HERO' ? heroBody(g) : enemyBody(g));
