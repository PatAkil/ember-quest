import { PICO8, drawText, drawTextCentered, textWidth } from '../../engine';
import { bannerAge, bannerDur, clamp01, easeOut, span } from '../fx';
import type { Banner, Shot, ShotKind } from '../fx-state';
import { enemyAnchor } from '../backdrop';
import type { Game } from '../state';
import { C_PANEL, C_TEXT, FLOOR_Y, HUD_BOTTOM, W } from '../theme';
import type { Point } from '../theme';
import { drawLine } from '../widgets';

type Ctx = CanvasRenderingContext2D;
interface Frame { ctx: Ctx; s: Shot; u: number; t: number }

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

function along(s: Shot, u: number, arc = 0): Point {
  return { x: lerp(s.from.x, s.to.x, u), y: lerp(s.from.y, s.to.y, u) - arc * Math.sin(Math.PI * u) };
}

function dot(ctx: Ctx, p: Point, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
}

function blob(ctx: Ctx, p: Point, r: number, color: string): void {
  const x = Math.round(p.x); const y = Math.round(p.y);
  ctx.fillStyle = color;
  ctx.fillRect(x - r, y - r + 1, 2 * r + 1, 2 * r - 1);
  ctx.fillRect(x - r + 1, y - r, 2 * r - 1, 2 * r + 1);
}

const hash = (a: number, b: number): number => {
  const h = Math.imul(a * 73856093 ^ b * 19349663, 0x85ebca6b) >>> 0;
  return (h % 1000) / 1000;
};

const travel = (u: number): number => 0.35 * u + 0.65 * u * u;

function drawOrb(f: Frame): void {
  const { ctx, s } = f;
  const u = travel(f.u);
  const trail = [PICO8[8], PICO8[8], s.color, s.color];
  const flick = Math.floor(f.t * 30);
  trail.forEach((c, i) => {
    const p = along(s, Math.max(0, u - 0.06 * (4 - i)), 6);
    dot(ctx, { x: p.x, y: p.y + (hash(i, flick) - 0.5) * 3 }, 2 + i, c);
  });
  const head = along(s, u, 6);
  blob(ctx, head, 3, s.color);
  blob(ctx, { x: head.x + 1, y: head.y }, 1, s.glow);
  dot(ctx, { x: head.x + 1, y: head.y }, 1, PICO8[7]);
}

function drawHex(f: Frame): void {
  const { ctx, s } = f;
  const u = travel(f.u);
  for (let k = 1; k <= 4; k++) {
    const p = along(s, Math.max(0, u - 0.07 * k), 4);
    const spin = f.t * 18 + k * 1.7;
    dot(ctx, { x: p.x + Math.cos(spin) * 3, y: p.y + Math.sin(spin) * 3 }, k < 3 ? 2 : 1, k % 2 ? s.color : s.glow);
  }
  const head = along(s, u, 4);
  const x = Math.round(head.x); const y = Math.round(head.y);
  ctx.fillStyle = s.color;
  for (let i = -3; i <= 3; i++) {
    const w = 3 - Math.abs(i);
    ctx.fillRect(x - w, y + i, 1, 1); ctx.fillRect(x + w, y + i, 1, 1);
  }
  ctx.fillStyle = PICO8[0]; ctx.fillRect(x - 1, y - 1, 3, 3);
  dot(ctx, head, Math.floor(f.t * 20) % 2 ? 1 : 2, s.glow);
}

function drawWave(f: Frame): void {
  const { ctx, s } = f;
  const u = travel(f.u);
  const bob = (k: number): number => 3 * Math.sin((u - k) * Math.PI * 4);
  for (let k = 1; k <= 3; k++) {
    const p = along(s, Math.max(0, u - 0.08 * k));
    dot(ctx, { x: p.x, y: p.y + bob(0.08 * k) + k }, 2, s.color);
  }
  const head = along(s, u);
  const p = { x: head.x, y: head.y + bob(0) };
  blob(ctx, p, 3, s.color);
  ctx.fillStyle = s.glow;
  ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 3, 4, 1);
  ctx.fillRect(Math.round(p.x) + 2, Math.round(p.y) - 2, 1, 2);
}

function drawBolt(f: Frame): void {
  const { ctx, s } = f;
  const u = travel(f.u);
  const head = along(s, u);
  const flick = Math.floor(f.t * 30);
  let prev = head;
  for (let k = 1; k <= 4; k++) {
    const back = along(s, Math.max(0, u - 0.07 * k));
    const next = { x: back.x, y: back.y + (hash(k, flick) - 0.5) * 7 };
    const c = k === 1 ? s.glow : s.color;
    drawLine(ctx, prev, next, c);
    drawLine(ctx, { x: prev.x, y: prev.y + 1 }, { x: next.x, y: next.y + 1 }, c);
    prev = next;
  }
  blob(ctx, head, 3, s.color);
  blob(ctx, head, 1, s.glow);
}

const SKY_SEGMENTS = 7;

function boltPath(s: Shot, flick: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= SKY_SEGMENTS; i++) {
    const u = i / SKY_SEGMENTS;
    const jitter = i === 0 || i === SKY_SEGMENTS ? 0 : (hash(i, flick) - 0.5) * 12;
    pts.push({ x: lerp(s.from.x, s.to.x, u) + jitter, y: lerp(s.from.y, s.to.y, u) });
  }
  return pts;
}

function starburst(ctx: Ctx, p: Point, r: number, s: Shot): void {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const len = i % 2 ? r * 0.6 : r;
    drawLine(ctx, { x: p.x + Math.cos(a) * 2, y: p.y + Math.sin(a) * 2 }, { x: p.x + Math.cos(a) * len, y: p.y + Math.sin(a) * len }, i % 2 ? s.color : s.glow);
  }
  blob(ctx, p, 2, s.glow);
}

const SKY_STROKES: readonly (readonly [number, 'color' | 'glow'])[] = [[-2, 'color'], [2, 'color'], [-1, 'glow'], [1, 'glow'], [0, 'glow']];

function strokeBolt(ctx: Ctx, pts: readonly Point[], s: Shot): void {
  for (const [dx, tone] of SKY_STROKES) {
    pts.slice(1).forEach((p, i) => {
      const a = pts[i] ?? p;
      drawLine(ctx, { x: a.x + dx, y: a.y }, { x: p.x + dx, y: p.y }, tone === 'glow' ? s.glow : s.color);
    });
  }
}

function drawSkybolt(f: Frame): void {
  const { ctx, s, u } = f;
  if (u > 0.5 && Math.floor(f.t * 30) % 2 === 1) {return;}
  const flick = Math.floor(f.t * 20);
  const pts = boltPath(s, flick);
  strokeBolt(ctx, pts, s);
  const fork = pts[3];
  if (fork) {drawLine(ctx, fork, { x: fork.x - 10 + hash(9, flick) * 4, y: fork.y + 14 }, s.color);}
  if (u < 0.45) {starburst(ctx, s.to, Math.round(4 + 8 * u), s);}
}

function drawMotes(f: Frame): void {
  const { ctx, s } = f;
  for (let k = 0; k < 5; k++) {
    const uk = clamp01((f.u - k * 0.1) / 0.6);
    if (uk <= 0 || uk >= 1) {continue;}
    const p = along(s, easeOut(uk), 10 + k * 3);
    dot(ctx, { x: p.x, y: p.y + Math.sin(uk * 9 + k) * 2 }, 2, k % 2 ? s.glow : s.color);
  }
}

function drawRise(f: Frame): void {
  const { ctx, s } = f;
  for (let k = 0; k < 8; k++) {
    const uk = clamp01(f.u * 1.5 - k * 0.07);
    if (uk <= 0 || uk >= 1) {continue;}
    const x = s.from.x + ((k * 37) % 31) - 15 + Math.sin(uk * 6 + k) * 2;
    dot(ctx, { x, y: lerp(s.from.y, s.to.y, easeOut(uk)) }, k % 3 === 0 ? 3 : 2, k % 2 ? s.glow : s.color);
  }
}

function drawRing(f: Frame): void {
  const { ctx, s, u } = f;
  if (u > 0.75 && Math.floor(f.t * 30) % 2 === 1) {return;}
  const r = lerp(4, 26, easeOut(u));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    dot(ctx, { x: s.from.x + Math.cos(a) * r, y: s.from.y + Math.sin(a) * r * 0.8 }, 2, i % 2 ? s.glow : s.color);
  }
}

const SLASH_FROM = -1.5;
const SLASH_TO = 1.3;

function drawSlash(f: Frame): void {
  const { ctx, s, u } = f;
  if (u > 0.7 && Math.floor(f.t * 30) % 2 === 1) {return;}
  const head = lerp(SLASH_FROM, SLASH_TO, easeOut(Math.min(1, u * 2.2)));
  const c = { x: s.from.x - 10, y: s.from.y };
  for (let i = 0; i < 24; i++) {
    const a = head - i * 0.075;
    if (a < SLASH_FROM) {break;}
    const r = 22 - Math.abs(a) * 2;
    const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    const thick = i < 6 ? 4 : i < 14 ? 3 : 2;
    dot(ctx, p, thick, i < 4 ? PICO8[7] : s.glow);
  }
}

function drawDust(f: Frame): void {
  const { ctx, s, u } = f;
  const headX = lerp(s.from.x, s.to.x, easeOut(Math.min(1, u * 1.6)));
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(Math.round(s.from.x), FLOOR_Y + 1, Math.max(0, Math.round(headX - s.from.x)), 1);
  for (let x = s.from.x; x < headX; x += 6) {
    const age = (headX - x) / 60 + u * 0.5;
    if (age > 1) {continue;}
    const size = age < 0.3 ? 3 : 2;
    dot(ctx, { x: x + hash(x, 3) * 3, y: FLOOR_Y - 2 - age * 6 }, size, age < 0.5 ? s.color : s.glow);
  }
}

function drawCharge(f: Frame): void {
  const { ctx, s, u } = f;
  const r = Math.round(1 + 3 * u);
  const c = Math.floor(f.t * 20) % 2 ? s.color : s.glow;
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(s.from.x) - r, Math.round(s.from.y), 2 * r + 1, 1);
  ctx.fillRect(Math.round(s.from.x), Math.round(s.from.y) - r, 1, 2 * r + 1);
  dot(ctx, s.from, 2, s.glow);
}

const SHOT_DRAW: Record<ShotKind, (f: Frame) => void> = {
  ORB: drawOrb, HEX: drawHex, WAVE: drawWave, BOLT: drawBolt, SKYBOLT: drawSkybolt, MOTES: drawMotes,
  RISE: drawRise, RING: drawRing, SLASH: drawSlash, DUST: drawDust, CHARGE: drawCharge,
};

const STRIP_Y = 50;
const STRIP_H = 26;

function drawStrip(g: Game, b: Banner, age: number): void {
  const ctx = g.app.pc.ctx;
  const open = easeOut(span(age, 0, 0.1)) * (1 - span(age, 0.58, 0.12));
  const h = Math.round(STRIP_H * open);
  if (h <= 0) {return;}
  const top = STRIP_Y - Math.round(h / 2);
  ctx.fillStyle = PICO8[0]; ctx.fillRect(-16, top, W + 32, h);
  ctx.fillStyle = b.color; ctx.fillRect(-16, top, W + 32, 1); ctx.fillRect(-16, top + h - 1, W + 32, 1);
  ctx.fillStyle = C_PANEL; ctx.fillRect(-16, top + 2, W + 32, 1); ctx.fillRect(-16, top + h - 3, W + 32, 1);
  if (h < STRIP_H - 2) {return;}
  const slide = Math.round((1 - easeOut(span(age, 0.02, 0.2))) * 60);
  drawText(ctx, b.tag, { x: Math.round((W - textWidth(b.tag, 1)) / 2) - slide, y: top + 5 }, { color: b.color });
  drawTextCentered(ctx, b.name, { width: W + slide * 2, y: top + 12 }, { color: C_TEXT, scale: 2, shadow: true });
}

function drawNameTag(g: Game, b: Banner, age: number): void {
  const a = enemyAnchor(g);
  const ctx = g.app.pc.ctx;
  ctx.globalAlpha = 1 - span(age, bannerDur(g) - 0.3, 0.3);
  const x = Math.round(a.head.x - textWidth(b.name, 1) / 2);
  drawText(ctx, b.name, { x, y: Math.max(HUD_BOTTOM + 4, a.head.y - 10) }, { color: C_TEXT, shadow: true });
  ctx.globalAlpha = 1;
}

function drawBanner(g: Game): void {
  const b = g.fx.banner;
  const age = bannerAge(g);
  if (!b || age === null || age >= bannerDur(g)) {return;}
  if (b.tag) {drawStrip(g, b, age);} else {drawNameTag(g, b, age);}
}

export function drawBattleFx(g: Game): void {
  const fx = g.fx;
  const ctx = g.app.pc.ctx;
  for (const s of fx.shots) {
    if (fx.t < s.t0) {continue;}
    SHOT_DRAW[s.kind]({ ctx, s, u: span(fx.t, s.t0, s.dur), t: fx.t });
  }
  drawBanner(g);
}
