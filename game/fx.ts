import { createFx } from './fx-state';
import type { Actor, Fade, FxState, Meter, MeterId, MoveKind, Shot } from './fx-state';
import type { Game } from './state';

type Ease = 'OUT' | 'IN' | 'INOUT' | 'LIN';
type Key = readonly [number, number, number, Ease];

const EASE: Record<Ease, (u: number) => number> = {
  OUT: (u) => 1 - (1 - u) ** 3,
  IN: (u) => u * u * u,
  INOUT: (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2),
  LIN: (u) => u,
};

export const clamp01 = (u: number): number => Math.min(1, Math.max(0, u));
export const span = (t: number, from: number, dur: number): number => clamp01((t - from) / Math.max(1e-6, dur));
export const easeOut = EASE.OUT;

const CURVES: Record<MoveKind, readonly Key[]> = {
  LUNGE: [[0, 0, 0, 'LIN'], [0.07, -0.15, 0, 'OUT'], [0.18, 1, 0, 'OUT'], [0.26, 0.88, 0, 'LIN'], [0.46, 0, 0, 'INOUT']],
  HEAVY: [[0, 0, 0, 'LIN'], [0.12, -0.3, -0.4, 'OUT'], [0.24, 1, 0, 'IN'], [0.34, 0.9, 0, 'LIN'], [0.56, 0, 0, 'INOUT']],
  CAST: [[0, 0, 0, 'LIN'], [0.1, 1, -0.25, 'OUT'], [0.22, 1, 0, 'LIN'], [0.4, 0, 0, 'INOUT']],
  RECOIL: [[0, 0, 0, 'LIN'], [0.03, -1, 0, 'OUT'], [0.22, 0, 0, 'INOUT']],
  DODGE: [[0, 0, 0, 'LIN'], [0.08, -1, -0.3, 'OUT'], [0.24, -1, 0, 'LIN'], [0.4, 0, 0, 'INOUT']],
  ENTER: [[0, -1, -0.3, 'LIN'], [0.26, 0, 0.03, 'OUT'], [0.32, 0, 0, 'OUT']],
};

const lastKey = (keys: readonly Key[]): Key => keys[keys.length - 1] ?? [0, 0, 0, 'LIN'];
const moveDur = (kind: MoveKind): number => lastKey(CURVES[kind])[0];

interface Offset { x: number; y: number }

function curveAt(keys: readonly Key[], t: number): Offset {
  let prev = keys[0] ?? lastKey(keys);
  for (const key of keys) {
    if (t <= key[0]) {
      const u = EASE[key[3]](span(t, prev[0], key[0] - prev[0]));
      return { x: prev[1] + (key[1] - prev[1]) * u, y: prev[2] + (key[2] - prev[2]) * u };
    }
    prev = key;
  }
  return { x: prev[1], y: prev[2] };
}

const TOWARD: Record<Actor, number> = { HERO: 1, ENEMY: -1 };

export interface Pose { dx: number; dy: number; tint: string | null; dissolve: number }

const REST: Pose = { dx: 0, dy: 0, tint: null, dissolve: 0 };

function liveTint(fx: FxState, actor: Actor): string | null {
  const hit = fx.tints.filter((t) => t.actor === actor && fx.t >= t.t0 && fx.t < t.t0 + t.dur).pop();
  return hit ? hit.color : null;
}

export function actorPose(g: Game, actor: Actor): Pose {
  const fx = g.fx;
  if (!g.app.scenes.is('PLAYING') && !g.app.scenes.is('PAUSED')) {return REST;}
  let dx = 0; let dy = 0;
  for (const m of fx.moves) {
    if (m.actor !== actor || fx.t < m.t0) {continue;}
    const o = curveAt(CURVES[m.kind], fx.t - m.t0);
    dx += o.x * m.size; dy += o.y * m.size;
  }
  const d = fx.dissolve;
  const dissolve = actor === 'ENEMY' && d ? span(fx.t, d.t0, d.dur) : 0;
  return { dx: Math.round(dx * TOWARD[actor]), dy: Math.round(dy), tint: liveTint(fx, actor), dissolve };
}

export const fadeProgress = (fx: FxState, f: Fade | null): number => (f ? span(fx.t, f.t0, f.dur) : 1);

export function addMove(g: Game, actor: Actor, kind: MoveKind, size: number): void {
  g.fx.moves.push({ actor, kind, size, t0: g.fx.t });
}

export function addTint(g: Game, actor: Actor, color: string, dur: number): void {
  g.fx.tints.push({ actor, color, dur, t0: g.fx.t });
}

export function addShot(g: Game, shot: Omit<Shot, 't0'>, delay = 0): void {
  g.fx.shots.push({ ...shot, t0: g.fx.t + delay });
}

export function cue(g: Game, delay: number, fire: () => void, impact = false): void {
  const c = { at: g.fx.t + delay, impact, fire };
  const i = g.fx.cues.findIndex((o) => o.at > c.at);
  if (i < 0) {g.fx.cues.push(c);} else {g.fx.cues.splice(i, 0, c);}
}

function fireDue(fx: FxState): void {
  for (let n = 0; n < 64; n++) {
    const next = fx.cues[0];
    if (!next || next.at > fx.t) {return;}
    fx.cues.shift();
    next.fire();
  }
}

function prune(fx: FxState): void {
  const t = fx.t;
  fx.moves = fx.moves.filter((m) => t < m.t0 + moveDur(m.kind));
  fx.tints = fx.tints.filter((x) => t < x.t0 + x.dur);
  fx.shots = fx.shots.filter((s) => t < s.t0 + s.dur);
}

const METER_RATE = 11;
const GHOST_HOLD = 0.22;
const GHOST_RATE = 7;

function meterTarget(g: Game, id: MeterId): number {
  const real: Record<MeterId, number> = { heroHp: g.hero.hp, heroMp: g.hero.mp, enemyHp: g.battle.enemy?.hp ?? 0 };
  return Math.max(0, real[id] + g.fx.pending[id]);
}

function stepMeter(m: Meter, target: number, dt: number): void {
  if (target < m.last) {m.hold = GHOST_HOLD;}
  m.last = target;
  m.shown += (target - m.shown) * (1 - Math.exp(-METER_RATE * dt));
  if (Math.abs(target - m.shown) < 0.3) {m.shown = target;}
  m.hold = Math.max(0, m.hold - dt);
  if (m.hold <= 0) {m.ghost += (m.shown - m.ghost) * (1 - Math.exp(-GHOST_RATE * dt));}
  if (m.ghost < m.shown || Math.abs(m.ghost - m.shown) < 0.3) {m.ghost = m.shown;}
}

const METERS: readonly MeterId[] = ['heroHp', 'heroMp', 'enemyHp'];

function snapMeters(g: Game): void {
  for (const id of METERS) {
    const v = meterTarget(g, id);
    g.fx.meters[id] = { shown: v, ghost: v, last: v, hold: 0 };
  }
}

export const meter = (g: Game, id: MeterId): Meter => g.fx.meters[id];

export function holdMeter(g: Game, id: MeterId, amount: number): void { g.fx.pending[id] += amount; }

export function updateFx(g: Game, dt: number): void {
  const fx = g.fx;
  fx.t += dt;
  fireDue(fx);
  prune(fx);
  for (const id of METERS) {stepMeter(fx.meters[id], meterTarget(g, id), dt);}
}

export function skipToImpact(g: Game): number | null {
  const fx = g.fx;
  const next = fx.cues.find((c) => c.impact);
  if (!next) {return null;}
  const skipped = Math.max(0, next.at - fx.t);
  fx.t += skipped;
  fireDue(fx);
  return skipped;
}

export function flushFx(g: Game): void {
  const fx = g.fx;
  fx.moves = []; fx.shots = []; fx.tints = []; fx.banner = null;
  for (let n = 0; n < 64 && fx.cues.length; n++) {
    const next = fx.cues.shift();
    next?.fire();
  }
}

export function resetFx(g: Game): void {
  g.fx = createFx();
  snapMeters(g);
}

const BANNER_DUR = 0.7;
const TAG_DUR = 0.9;

export const bannerAge = (g: Game): number | null => (g.fx.banner ? g.fx.t - g.fx.banner.t0 : null);

export function bannerBlocks(g: Game): boolean {
  const b = g.fx.banner;
  return b !== null && b.tag !== '' && g.fx.t - b.t0 < BANNER_DUR;
}

export const bannerDur = (g: Game): number => (g.fx.banner?.tag ? BANNER_DUR : TAG_DUR);

export function dismissBanner(g: Game): void {
  g.fx.banner = null;
  g.fx.moves = g.fx.moves.filter((m) => m.kind !== 'ENTER');
}
