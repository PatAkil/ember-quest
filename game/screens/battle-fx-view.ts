import { PICO8, drawText, textWidth } from '../../engine';
import { bannerAge, bannerDur, clamp01, easeOut, span } from '../fx';
import type { Banner, Shot, ShotKind } from '../fx-state';
import type { Game } from '../state';
import { C_PANEL, C_TEXT, FLOOR_Y, W } from '../theme';
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

const ORB_TAIL: readonly (readonly [number, number])[] = [[0.3, 1], [0.24, 1], [0.18, 2], [0.12, 2], [0.06, 3]];

function drawOrb(f: Frame): void {
  const { ctx, s } = f;
  const u = travel(f.u);
  const flick = Math.floor(f.t * 30);
  ORB_TAIL.forEach(([lag, r], i) => {
    if (u - lag <= 0) {return;}
    const p = along(s, u - lag, 6);
    blob(ctx, { x: p.x, y: p.y + (hash(i, flick) - 0.5) * 4 }, r, i < 2 ? PICO8[8] : s.color);
  });
  const head = along(s, u, 6);
  blob(ctx, head, 4, s.color);
  blob(ctx, { x: head.x + 1, y: head.y }, 2, s.glow);
  dot(ctx, { x: head.x + 1, y: head.y }, 2, PICO8[7]);
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
  blob(ctx, head, 4, s.color);
  blob(ctx, head, 2, s.glow);
  dot(ctx, head, 1, PICO8[7]);
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

const ARC_R = 13;
const ARC_SPREAD = 1.2;
const ARC_EDGE = 0.45;

function drawArc(f: Frame): void {
  const { ctx, s, u } = f;
  const d = s.to.x < s.from.x ? -1 : 1;
  const c = { x: s.from.x - d * 7, y: s.from.y };
  const head = lerp(-ARC_SPREAD, ARC_SPREAD, Math.min(1, u * 2));
  const thick = u < 0.6 ? 3 : 2;
  for (let a = -ARC_SPREAD; a <= head; a += 0.1) {
    const r = ARC_R - Math.abs(a) * 4;
    const edge = head - a < ARC_EDGE;
    dot(ctx, { x: c.x + d * Math.cos(a) * r, y: c.y + Math.sin(a) * r }, edge ? thick + 1 : thick, edge ? PICO8[7] : s.glow);
  }
}

const BLOOM_SWELL = 0.35;

function drawBloom(f: Frame): void {
  const { ctx, s, u } = f;
  const p = s.from;
  if (u < BLOOM_SWELL) {
    const k = u / BLOOM_SWELL;
    blob(ctx, p, Math.round(lerp(3, 8, k)), s.color);
    blob(ctx, p, Math.round(lerp(1, 4, k)), s.glow);
    dot(ctx, p, 3, PICO8[7]);
    return;
  }
  if (u > 0.7 && Math.floor(f.t * 30) % 2 === 1) {return;}
  const r = lerp(9, 17, easeOut((u - BLOOM_SWELL) / (1 - BLOOM_SWELL)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.3;
    dot(ctx, { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.85 }, u < 0.7 ? 2 : 1, i % 2 ? s.glow : s.color);
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
  RISE: drawRise, RING: drawRing, SLASH: drawSlash, DUST: drawDust, CHARGE: drawCharge, ARC: drawArc, BLOOM: drawBloom,
};

const STRIP_Y = 45;
const STRIP_H = 18;
const TAG_GAP = 6;

function drawStrip(g: Game, b: Banner, age: number): void {
  const ctx = g.app.pc.ctx;
  const open = easeOut(span(age, 0, 0.1)) * (1 - span(age, bannerDur() - 0.12, 0.12));
  const h = Math.round(STRIP_H * open);
  if (h <= 0) {return;}
  const top = STRIP_Y - Math.round(h / 2);
  ctx.fillStyle = PICO8[0]; ctx.fillRect(-16, top, W + 32, h);
  ctx.fillStyle = b.color; ctx.fillRect(-16, top, W + 32, 1); ctx.fillRect(-16, top + h - 1, W + 32, 1);
  ctx.fillStyle = C_PANEL; ctx.fillRect(-16, top + 2, W + 32, 1); ctx.fillRect(-16, top + h - 3, W + 32, 1);
  if (h < STRIP_H - 2) {return;}
  const slide = Math.round((1 - easeOut(span(age, 0.02, 0.2))) * 60);
  const tagW = textWidth(b.tag, 1);
  const left = Math.round((W - tagW - TAG_GAP - textWidth(b.name, 2)) / 2);
  drawText(ctx, b.tag, { x: left - slide, y: top + 7 }, { color: b.color });
  drawText(ctx, b.name, { x: left + tagW + TAG_GAP + slide, y: top + 4 }, { color: C_TEXT, scale: 2, shadow: true });
}

function drawBanner(g: Game): void {
  const b = g.fx.banner;
  const age = bannerAge(g);
  if (!b?.tag || age === null || age >= bannerDur()) {return;}
  drawStrip(g, b, age);
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
