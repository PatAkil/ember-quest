import { PICO8 } from '../../engine';
import { at } from '../lookup';
import { armed, dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Arming, Game, ThresholdChoice } from '../state';
import { C_ACCENT, W } from '../theme';

export const THRESHOLD_CHOICES: readonly ThresholdChoice[] = ['ASCEND', 'DESCEND'];
export const THRESHOLD_ARM = 1.0;
export const PACT_ARM = 0.5;

interface ChoiceStep { cursor: number; chosen: boolean }
export const END_ARM = 1.0;

export function stepChoice(g: Game, cursor: number, count: number, arming: Arming): ChoiceStep {
  const dy = dirEdge(g);
  if (dy) {g.app.audio.play('blip');}
  const ready = armed(g, arming);
  return { cursor: dy ? wrapCursor(cursor, dy, count) : cursor, chosen: ready && g.app.input.pressed('A') };
}

export function startThreshold(g: Game, choose: (choice: ThresholdChoice) => void): void {
  g.threshold = { cursor: 0, openedAt: g.clock, choose };
  g.subScene = 'THRESHOLD';
  g.app.audio.play('pickup');
  g.app.juice.flash(C_ACCENT, 0.35);
  resetCursorEdge(g);
}

const PLUNGE_AT = { x: 176, y: 84 };

const CHOICE_BEAT: Record<ThresholdChoice, (g: Game) => void> = {
  ASCEND: (g) => { g.app.audio.play('pickup'); g.app.juice.flash(C_ACCENT, 0.4); },
  DESCEND: (g) => {
    g.app.audio.play('explosion');
    g.app.juice.shake(5, 0.4);
    g.app.juice.flash(PICO8[8], 0.5, PLUNGE_AT);
    g.app.particles.burst(PLUNGE_AT.x, PLUNGE_AT.y, { count: 18, color: PICO8[8], speed: 120 });
    g.app.particles.burst(W / 2, PLUNGE_AT.y, { count: 10, color: PICO8[9], speed: 80 });
  },
};

export function updateThreshold(g: Game): void {
  const t = g.threshold;
  const step = stepChoice(g, t.cursor, THRESHOLD_CHOICES.length, { openedAt: t.openedAt, delay: THRESHOLD_ARM });
  t.cursor = step.cursor;
  if (!step.chosen) {return;}
  const choice = at(THRESHOLD_CHOICES, step.cursor);
  CHOICE_BEAT[choice](g);
  t.choose(choice);
}
