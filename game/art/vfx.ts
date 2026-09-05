// Ember Quest v3 — game/art/vfx.ts
//
// Procedural VFX at native (unscaled) resolution — the smooth layer that sits
// on top of the actor plane's hard pixels (DESIGN.md → Presentation →
// Procedural VFX). Every effect is gradients/arcs/paths drawn straight onto
// the frame's context, composited with `'lighter'` where the spec calls for
// glow, and keyed by SkillId (`VFX_RECIPES`, one of thirteen reusable
// archetypes per skill) or by StatusKind (`drawStatusGlow`, an ambient ring).
// Canvas 2D only — no DOM beyond the context passed in, so this runs fine
// inside the smoke gate's headless Chromium.
//
// A `VfxInstance` is a plain data record (kind, position, colour, a size and
// an age/duration pair); `spawnVfx`/`updateVfx`/`renderVfx` operate on a
// caller-owned array — main.ts (once it lands) owns exactly one such array
// for the battle screen and passes it through every frame. Nothing here
// allocates in the steady state except the occasional pushed/spliced
// instance record, which is the point of the array being caller-owned rather
// than a module-level singleton.

import { pulse } from '../../engine';
import type { SkillId, StatusKind } from '../types';

// --- Kinds ----------------------------------------------------------------

/** The thirteen reusable archetypes every skill's VFX is built from. */
export type VfxKind =
  | 'slash'
  | 'fireBurst'
  | 'windBlade'
  | 'waterWave'
  | 'lightBeam'
  | 'darkPulse'
  | 'healShimmer'
  | 'shieldDome'
  | 'stunStar'
  | 'burnFlicker'
  | 'shockwave'
  | 'projectile'
  | 'frostShards';

interface VfxRecipeConfig {
  kind: VfxKind;
  /** Primary colour (a hex string — see PALETTE below). */
  color: string;
  /** Secondary/hot-core colour; defaults to `color`. */
  color2?: string;
  /** Native px — the archetype's own DEFAULT_SIZE is used when omitted. */
  size?: number;
  /** Seconds — the archetype's own DEFAULT_DURATION is used when omitted. */
  duration?: number;
}

// A small, named palette so the ~60 recipe rows below read as intent
// ("FIRE", "HEAL") rather than repeated hex literals. Values are the PICO8
// hues DESIGN.md already put on the rest of the v3 UI (engine/palette.ts),
// kept as plain hex here so vfx.ts has no runtime dependency beyond `pulse`.
const FIRE = '#FFA300';
const FIRE_HOT = '#FFEC27';
const WIND = '#00E436';
const WIND_PALE = '#FFF1E8';
const WATER = '#29ADFF';
const WATER_FOAM = '#FFF1E8';
const LIGHT = '#FFEC27';
const LIGHT_WHITE = '#FFF1E8';
const DARK = '#7E2553';
const DARK_GLOW = '#FF77A8';
const HEAL = '#00E436';
const PHYSICAL = '#C2C3C7';
const RUST = '#AB5236';
const FROST = '#FFF1E8';
const GHOST = '#83769C';

/** One row per SkillId — `Record<SkillId, ...>` makes the compiler prove every skill in game/data/skills.ts has a VFX. */
export const VFX_RECIPES: Record<SkillId, VfxRecipeConfig> = {
  // --- EMBER · FIRE --------------------------------------------------------
  CINDER: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  FLARE: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 56 },
  INFERNO: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 76, duration: 0.5 },
  INFERNO_BRAND: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 76, duration: 0.5 },
  // --- GALE · WIND -----------------------------------------------------------
  GUST: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  SQUALL: { kind: 'windBlade', color: WIND, color2: WIND_PALE, size: 50 },
  TAILWIND: { kind: 'healShimmer', color: WIND, color2: WIND_PALE, size: 48, duration: 0.6 },
  GUST_RIP: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  // --- TIDE · WATER ------------------------------------------------------------
  RIPPLE: { kind: 'waterWave', color: WATER, color2: WATER_FOAM },
  TIDEPOOL: { kind: 'healShimmer', color: HEAL, color2: WATER_FOAM },
  UNDERTOW: { kind: 'healShimmer', color: HEAL, color2: WATER_FOAM, size: 60, duration: 0.6 },
  UNDERTOW_WARD: { kind: 'healShimmer', color: HEAL, color2: WATER_FOAM, size: 60, duration: 0.6 },
  // --- BASALT · FIRE (DEF wall) ------------------------------------------------
  BASH: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  BULWARK: { kind: 'shieldDome', color: FIRE, color2: LIGHT_WHITE, duration: 0.5 },
  QUAKE: { kind: 'shockwave', color: RUST, color2: FIRE, size: 60 },
  BULWARK_RAMPART: { kind: 'shieldDome', color: FIRE, color2: LIGHT_WHITE, size: 60, duration: 0.5 },
  // --- SABLE · DARK --------------------------------------------------------
  HEX: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW },
  MIRE: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 60 },
  ECLIPSE: { kind: 'stunStar', color: DARK_GLOW, color2: DARK, duration: 0.6 },
  HEX_LINGER: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW },
  // --- LUMEN · LIGHT -----------------------------------------------------------
  LANCE: { kind: 'projectile', color: LIGHT, color2: LIGHT_WHITE },
  RADIANCE: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, duration: 0.5 },
  JUDGEMENT: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 70, duration: 0.5 },
  JUDGEMENT_REFUND: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 70, duration: 0.5 },

  // --- EMBER CRYPT -------------------------------------------------------------
  SCORCH: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  KINDLE: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  BITE: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  REND: { kind: 'slash', color: PHYSICAL, color2: FIRE, duration: 0.35 },
  CUDGEL: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  RALLY: { kind: 'healShimmer', color: FIRE, color2: FIRE_HOT, size: 48, duration: 0.6 },
  MEND: { kind: 'healShimmer', color: HEAL, color2: FIRE_HOT },
  WAIL: { kind: 'windBlade', color: GHOST, color2: WIND_PALE },
  CHOKE: { kind: 'stunStar', color: GHOST, color2: WIND_PALE },
  SHIELD_BASH: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  BRACE: { kind: 'shieldDome', color: FIRE, color2: LIGHT_WHITE, duration: 0.5 },
  IMMOLATE: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 68 },
  REAP: { kind: 'slash', color: DARK, color2: DARK_GLOW },
  DREAD_WAIL: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 68 },
  SHROUD: { kind: 'shieldDome', color: DARK, color2: DARK_GLOW, size: 60, duration: 0.6 },
  DOOM: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 60, duration: 0.5 },

  // --- FROST MARSH ---------------------------------------------------------------
  TONGUE_LASH: { kind: 'slash', color: WATER, color2: WATER_FOAM },
  BOG_SPIT: { kind: 'projectile', color: WATER, color2: RUST },
  CHILL: { kind: 'frostShards', color: FROST, color2: WATER },
  DEEP_FREEZE: { kind: 'stunStar', color: FROST, color2: WATER, duration: 0.6 },
  CANE: { kind: 'slash', color: WATER, color2: WATER_FOAM },
  SALVE: { kind: 'healShimmer', color: HEAL, color2: WATER_FOAM },
  BRINE_WARD: { kind: 'shieldDome', color: WATER, color2: WATER_FOAM, size: 60, duration: 0.5 },
  PINCH: { kind: 'slash', color: WATER, color2: PHYSICAL },
  CRUSH: { kind: 'shockwave', color: WATER, color2: PHYSICAL, size: 56 },
  FLICKER: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  IGNITE: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  RUSTED_BLADE: { kind: 'slash', color: RUST, color2: WATER },
  DRAG_UNDER: { kind: 'waterWave', color: WATER, color2: DARK },
  DELUGE: { kind: 'waterWave', color: WATER, color2: WATER_FOAM, size: 68 },
  HALO_LASH: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE },
  SMITE: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 72, duration: 0.5 },
  PALE_FLOOD: { kind: 'waterWave', color: LIGHT_WHITE, color2: WATER, size: 68 },
  SANCTIFY: { kind: 'healShimmer', color: LIGHT_WHITE, color2: LIGHT, size: 56, duration: 0.6 },
};

// --- Status glows -----------------------------------------------------------

interface StatusGlowConfig {
  color: string;
  /** Seconds per pulse cycle — a fast pulse (STUN) reads as urgent, a slow one (SHIELD) as steady. */
  period: number;
}

/** One row per StatusKind — same completeness trick as VFX_RECIPES. */
const STATUS_GLOW: Record<StatusKind, StatusGlowConfig> = {
  STUN: { color: LIGHT, period: 0.5 },
  DEF_BREAK: { color: RUST, period: 1.1 },
  ATK_BREAK: { color: '#FF004D', period: 1.1 },
  SLOW: { color: WATER, period: 1.6 },
  BURN: { color: FIRE, period: 0.4 },
  HEAL_BLOCK: { color: DARK, period: 1.2 },
  BRAND: { color: '#FF004D', period: 0.7 },
  SILENCE: { color: GHOST, period: 1.2 },
  GLANCE: { color: PHYSICAL, period: 0.5 },
  ATK_UP: { color: '#FF004D', period: 1.2 },
  DEF_UP: { color: WATER, period: 1.2 },
  SPD_UP: { color: WIND, period: 0.8 },
  CRIT_UP: { color: LIGHT, period: 0.9 },
  SHIELD: { color: WATER, period: 1.4 },
  IMMUNITY: { color: LIGHT_WHITE, period: 1.0 },
  COUNTER: { color: FIRE, period: 1.0 },
  INVINCIBLE: { color: LIGHT_WHITE, period: 0.6 },
};

// --- Instances --------------------------------------------------------------

export interface VfxSpawnOptions {
  size?: number;
  duration?: number;
  /** Origin for `projectile` (and any kind) to travel FROM, arriving at (x, y) at the end of its life. Omit for a stationary impact effect. */
  from?: { x: number; y: number };
}

export interface VfxInstance {
  readonly kind: VfxKind;
  readonly x: number;
  readonly y: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly color: string;
  readonly color2: string;
  readonly size: number;
  readonly duration: number;
  /** Stable per-instance draw seed (e.g. which way frost shards scatter) — never re-rolled, so a effect doesn't jitter across frames. */
  readonly seed: number;
  age: number;
}

const DEFAULT_SIZE: Record<VfxKind, number> = {
  slash: 40,
  fireBurst: 44,
  windBlade: 42,
  waterWave: 44,
  lightBeam: 56,
  darkPulse: 44,
  healShimmer: 40,
  shieldDome: 46,
  stunStar: 32,
  burnFlicker: 24,
  shockwave: 46,
  projectile: 14,
  frostShards: 30,
};

const DEFAULT_DURATION: Record<VfxKind, number> = {
  slash: 0.22,
  fireBurst: 0.35,
  windBlade: 0.3,
  waterWave: 0.4,
  lightBeam: 0.35,
  darkPulse: 0.35,
  healShimmer: 0.5,
  shieldDome: 0.4,
  stunStar: 0.5,
  burnFlicker: 0.45,
  shockwave: 0.4,
  projectile: 0.2,
  frostShards: 0.45,
};

/** A battle screen never needs more live effects than this at once; spawning past the cap drops the oldest rather than growing unbounded. */
export const VFX_MAX = 64;

let seedCounter = 1;

/**
 * Push a new effect for `id` (a SkillId) onto `list`, which the caller owns
 * — one array per battle screen, passed to `updateVfx`/`renderVfx` every
 * frame. An unknown id (should not happen: VFX_RECIPES is total over
 * SkillId) is silently ignored rather than throwing mid-battle.
 */
export function spawnVfx(list: VfxInstance[], id: SkillId, x: number, y: number, opts: VfxSpawnOptions = {}): void {
  const cfg = VFX_RECIPES[id];
  if (!cfg) return;
  if (list.length >= VFX_MAX) list.shift();
  list.push({
    kind: cfg.kind,
    x,
    y,
    fromX: opts.from?.x ?? x,
    fromY: opts.from?.y ?? y,
    color: cfg.color,
    color2: cfg.color2 ?? cfg.color,
    size: opts.size ?? cfg.size ?? DEFAULT_SIZE[cfg.kind],
    duration: opts.duration ?? cfg.duration ?? DEFAULT_DURATION[cfg.kind],
    seed: seedCounter++,
    age: 0,
  });
}

/** Ages every instance by `dt` seconds and removes the ones that finished. */
export function updateVfx(list: VfxInstance[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i];
    v.age += dt;
    if (v.age >= v.duration) list.splice(i, 1);
  }
}

/** Draws every live instance, in list order (oldest first). */
export function renderVfx(ctx: CanvasRenderingContext2D, list: VfxInstance[]): void {
  for (let i = 0; i < list.length; i++) renderOne(ctx, list[i]);
}

/** A pulsing ambient ring for a status effect an actor is carrying — driven by the clock, not a VfxInstance (a status has no lifetime of its own). */
export function drawStatusGlow(ctx: CanvasRenderingContext2D, kind: StatusKind, x: number, y: number, r: number, time: number): void {
  const cfg = STATUS_GLOW[kind];
  const t = pulse(time, cfg.period);
  const alpha = 0.35 + 0.4 * t;
  const radius = r * (0.85 + 0.15 * t);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// --- Cached gradients ---------------------------------------------------------
//
// A CanvasGradient belongs to the context that built it (like a
// CanvasPattern — see engine/draw.ts's DITHER_CACHE), so the cache is keyed
// per-context in a WeakMap and dies with a dead context. Every gradient is
// built once per (kind of gradient, radius/size, colours) and reused by
// translating the context to the instance's position before filling —
// "cached per (recipe, size)" without needing a gradient per pixel position.

const RADIAL_CACHE = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();

function radialGradient(
  ctx: CanvasRenderingContext2D,
  key: string,
  radius: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  let per = RADIAL_CACHE.get(ctx);
  if (!per) {
    per = new Map();
    RADIAL_CACHE.set(ctx, per);
  }
  const hit = per.get(key);
  if (hit) return hit;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius));
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  per.set(key, g);
  return g;
}

function transparent(hex: string): string {
  // Every colour here is an opaque hex triple; a transparent gradient stop
  // needs the SAME hue at alpha 0, not black, or the fade reads as a dirty
  // grey ring instead of dissolving into the scene.
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0)`;
}

// --- Archetype renderers ------------------------------------------------------
//
// Each takes the instance and its progress `p` in [0,1) (age / duration).
// All draw in a `ctx.save()/restore()` sandwich so a kind's blend mode, alpha
// and transform never leak to its neighbours in the list.

function renderOne(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  const p = Math.min(1, v.age / v.duration);
  switch (v.kind) {
    case 'slash':
      return renderSlash(ctx, v, p);
    case 'fireBurst':
      return renderFireBurst(ctx, v, p);
    case 'windBlade':
      return renderWindBlade(ctx, v, p);
    case 'waterWave':
      return renderWaterWave(ctx, v, p);
    case 'lightBeam':
      return renderLightBeam(ctx, v, p);
    case 'darkPulse':
      return renderDarkPulse(ctx, v, p);
    case 'healShimmer':
      return renderHealShimmer(ctx, v, p);
    case 'shieldDome':
      return renderShieldDome(ctx, v, p);
    case 'stunStar':
      return renderStunStar(ctx, v, p);
    case 'burnFlicker':
      return renderBurnFlicker(ctx, v, p);
    case 'shockwave':
      return renderShockwave(ctx, v, p);
    case 'projectile':
      return renderProjectile(ctx, v, p);
    case 'frostShards':
      return renderFrostShards(ctx, v, p);
  }
}

function renderFireBurst(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const r = v.size * (0.35 + 0.65 * p);
  const key = `fireBurst|${v.size}|${v.color}|${v.color2}`;
  const g = radialGradient(ctx, key, v.size, [
    [0, v.color2],
    [0.4, v.color],
    [1, transparent(v.color)],
  ]);
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - p;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderBurnFlicker(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const key = `burn|${v.size}|${v.color}|${v.color2}`;
  const g = radialGradient(ctx, key, v.size, [
    [0, v.color2],
    [0.5, v.color],
    [1, transparent(v.color)],
  ]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const phase = v.seed * 1.7 + i * 2.1 + v.age * 14;
    const jx = Math.sin(phase) * v.size * 0.25;
    const jy = -v.age * v.size * 1.4 - i * v.size * 0.18;
    const r = v.size * (0.28 - i * 0.05) * (1 - p * 0.4);
    ctx.globalAlpha = (1 - p) * (1 - i * 0.25);
    ctx.translate(v.x + jx, v.y + jy);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.restore();
}

function renderWindBlade(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const t = Math.min(1, p * 1.4 - i * 0.15);
    if (t <= 0) continue;
    const sweep = t * Math.PI * 1.1;
    const rad = v.size * (0.5 + i * 0.22);
    ctx.globalAlpha = (1 - p) * (1 - i * 0.3);
    ctx.strokeStyle = i === 0 ? v.color2 : v.color;
    ctx.lineWidth = 3 - i * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, rad, -Math.PI * 0.55, -Math.PI * 0.55 + sweep);
    ctx.stroke();
  }
  ctx.restore();
}

function renderWaterWave(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const r = v.size * (0.3 + 0.7 * p);
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - p) * 0.85;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = Math.max(2, v.size * 0.14 * (1 - p));
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - p) * 0.5;
  ctx.strokeStyle = v.color;
  ctx.lineWidth = Math.max(1, v.size * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.7, r * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderLightBeam(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const h = v.size * 2;
  const w = v.size * (0.5 - 0.3 * p);
  const grad = ctx.createLinearGradient(0, -h, 0, 0);
  grad.addColorStop(0, transparent(v.color2));
  grad.addColorStop(0.55, v.color2);
  grad.addColorStop(1, v.color);
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - p;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w * 0.35, -h);
  ctx.lineTo(-w * 0.35, -h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderDarkPulse(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  // An implosion then a burst: radius dips before it grows, unlike the other elemental bursts.
  const t = p < 0.35 ? 1 - p / 0.35 : (p - 0.35) / 0.65;
  const r = v.size * (0.15 + 0.85 * t);
  const key = `dark|${v.size}|${v.color}|${v.color2}`;
  const g = radialGradient(ctx, key, v.size, [
    [0, v.color2],
    [0.5, v.color],
    [1, transparent(v.color)],
  ]);
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = p < 0.35 ? 0.6 : 1 - (p - 0.35) / 0.65;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderHealShimmer(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const key = `heal|${v.size}|${v.color}`;
  const g = radialGradient(ctx, key, v.size * 0.5, [
    [0, v.color2],
    [1, transparent(v.color)],
  ]);
  ctx.globalAlpha = (1 - p) * 0.5;
  ctx.translate(v.x, v.y + v.size * 0.3);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, v.size * 0.5, v.size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < 4; i++) {
    const off = (i / 4 + v.seed * 0.13) % 1;
    const rise = ((p + off) % 1) * v.size;
    const sx = Math.sin((v.seed + i) * 2.4) * v.size * 0.22;
    ctx.globalAlpha = (1 - rise / v.size) * 0.9;
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.arc(v.x + sx, v.y - rise, Math.max(1, v.size * 0.05), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderShieldDome(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const r = v.size * 0.55;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (1 - p) * 0.4;
  ctx.fillStyle = v.color2;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = v.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, Math.PI * 2);
  ctx.stroke();
  // Two hex-facet lines for a "ward" read rather than a plain half-circle.
  ctx.globalAlpha = (1 - p) * 0.7;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.05);
  ctx.lineTo(-r * 0.2, -r * 0.85);
  ctx.moveTo(r * 0.5, -r * 0.05);
  ctx.lineTo(r * 0.2, -r * 0.85);
  ctx.stroke();
  ctx.restore();
}

function renderStunStar(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const count = 5;
  const r = v.size * 0.4;
  ctx.save();
  ctx.translate(v.x, v.y - v.size * 0.55);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const ang = v.age * 4 + (i / count) * Math.PI * 2;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r * 0.5;
    ctx.globalAlpha = (1 - p) * (0.6 + 0.4 * Math.sin(v.age * 10 + i));
    ctx.fillStyle = i % 2 === 0 ? v.color : v.color2;
    drawSpark(ctx, px, py, v.size * 0.09);
  }
  ctx.restore();
}

/** A tiny 4-point sparkle (a plus of two crossed diamonds), used by stunStar. */
function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.3, y - r * 0.3);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.3, y + r * 0.3);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.3, y + r * 0.3);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.3, y - r * 0.3);
  ctx.closePath();
  ctx.fill();
}

function renderShockwave(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const r = v.size * p;
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = Math.max(1, v.size * 0.16 * (1 - p));
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - p) * 0.6;
  ctx.strokeStyle = v.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.7, r * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderProjectile(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const x = v.fromX + (v.x - v.fromX) * p;
  const y = v.fromY + (v.y - v.fromY) * p;
  const key = `proj|${v.size}|${v.color}|${v.color2}`;
  const g = radialGradient(ctx, key, v.size, [
    [0, v.color2],
    [0.6, v.color],
    [1, transparent(v.color)],
  ]);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // A short ghost trail behind the head, along the travel direction.
  for (let i = 1; i <= 2; i++) {
    const tp = Math.max(0, p - i * 0.12);
    const tx = v.fromX + (v.x - v.fromX) * tp;
    const ty = v.fromY + (v.y - v.fromY) * tp;
    ctx.globalAlpha = (1 - p) * (0.35 - i * 0.1);
    ctx.translate(tx, ty);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, v.size * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.translate(x, y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, v.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function renderFrostShards(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const count = 5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const ang = (v.seed * 0.7 + i * 1.256) % (Math.PI * 2);
    const dist = v.size * 0.5 * p;
    const px = v.x + Math.cos(ang) * dist;
    const py = v.y + Math.sin(ang) * dist * 0.6;
    const s = v.size * 0.14 * (1 - p * 0.5);
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = i % 2 === 0 ? v.color2 : v.color;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.5, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function renderSlash(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(-0.5 + p * 0.4);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = 4 * (1 - p * 0.5);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, v.size * 0.55, -0.9, 0.9);
  ctx.stroke();
  ctx.globalAlpha = (1 - p) * 0.6;
  ctx.strokeStyle = v.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, v.size * 0.4, -0.7, 0.7);
  ctx.stroke();
  ctx.restore();
}
