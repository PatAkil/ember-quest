import { PICO8 } from '../../engine';
import { at } from '../lookup';
import { armA, armed, dirEdge, resetCursorEdge, takeA } from '../state';
import type { Arming, Game, ThresholdChoice } from '../state';
import { C_ACCENT, W } from '../theme';

export const THRESHOLD_CHOICES: readonly ThresholdChoice[] = ['ASCEND', 'DESCEND'];
export const THRESHOLD_ARM = 1.0;
export const PACT_ARM = 0.5;

interface ChoiceStep { cursor: number; chosen: boolean; refused: boolean }
export const END_ARM = 1.0;

export const NO_CHOICE = -1;

interface ChoiceArming extends Arming { entersAtTop?: boolean }

function nextChoice(cursor: number, dy: number, count: number, entersAtTop: boolean): number {
  if (cursor === NO_CHOICE) {return dy < 0 || entersAtTop ? 0 : count - 1;}
  return Math.min(count - 1, Math.max(0, cursor + dy));
}

export function stepChoice(g: Game, cursor: number, count: number, arming: ChoiceArming): ChoiceStep {
  const dy = dirEdge(g);
  const next = dy ? nextChoice(cursor, dy, count, arming.entersAtTop === true) : cursor;
  if (next !== cursor) {g.app.audio.play('blip');}
  const taken = takeA(g);
  const chosen = taken && armed(g, arming) && next !== NO_CHOICE;
  const refused = taken && !chosen;
  if (refused) {g.app.audio.play('blip');}
  return { cursor: next, chosen, refused };
}

export function startThreshold(g: Game, choose: (choice: ThresholdChoice) => void): void {
  g.threshold = { cursor: NO_CHOICE, openedAt: g.clock, refusedAt: -1, choose };
  g.subScene = 'THRESHOLD';
  g.app.audio.play('pickup');
  g.app.juice.flash(C_ACCENT, 0.35);
  resetCursorEdge(g);
  armA(g);
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
  if (step.refused) {t.refusedAt = g.clock;}
  if (!step.chosen) {return;}
  const choice = at(THRESHOLD_CHOICES, step.cursor);
  CHOICE_BEAT[choice](g);
  t.choose(choice);
}
