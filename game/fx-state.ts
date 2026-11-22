import type { Point } from './theme';

export type Actor = 'HERO' | 'ENEMY';
export type MoveKind = 'LUNGE' | 'HEAVY' | 'CAST' | 'RECOIL' | 'DODGE' | 'ENTER';
export type ShotKind = 'ORB' | 'HEX' | 'WAVE' | 'BOLT' | 'SKYBOLT' | 'MOTES' | 'RISE' | 'RING' | 'SLASH' | 'DUST' | 'CHARGE';
export type MeterId = 'heroHp' | 'heroMp' | 'enemyHp';

export interface Move { actor: Actor; kind: MoveKind; t0: number; size: number }
export interface Tint { actor: Actor; t0: number; dur: number; color: string }
export interface Shot { kind: ShotKind; t0: number; dur: number; from: Point; to: Point; color: string; glow: string }
export interface Cue { at: number; impact: boolean; fire: () => void }
export interface Meter { shown: number; ghost: number; last: number; hold: number }
export interface Fade { t0: number; dur: number }
export interface Banner { t0: number; name: string; tag: string; color: string }

export interface FxState {
  t: number;
  moves: Move[];
  tints: Tint[];
  shots: Shot[];
  cues: Cue[];
  pending: Record<MeterId, number>;
  meters: Record<MeterId, Meter>;
  dissolve: Fade | null;
  fall: Fade | null;
  banner: Banner | null;
}

const idleMeter = (): Meter => ({ shown: 0, ghost: 0, last: 0, hold: 0 });

export function createFx(): FxState {
  return {
    t: 0, moves: [], tints: [], shots: [], cues: [],
    pending: { heroHp: 0, heroMp: 0, enemyHp: 0 },
    meters: { heroHp: idleMeter(), heroMp: idleMeter(), enemyHp: idleMeter() },
    dissolve: null, fall: null, banner: null,
  };
}

export type RevealShape = 'BLINDS' | 'WIPE';
export interface Reveal { t: number; dur: number; shape: RevealShape; last: string }

export const createReveal = (): Reveal => ({ t: 1, dur: 1, shape: 'WIPE', last: 'MAP' });
