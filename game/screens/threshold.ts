import { at } from '../lookup';
import { dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game, ThresholdChoice } from '../state';

const THRESHOLD_CHOICES: readonly ThresholdChoice[] = ['ASCEND', 'DESCEND'];

interface ChoiceStep { cursor: number; chosen: boolean }

export function stepChoice(g: Game, cursor: number, count: number): ChoiceStep {
  const dy = dirEdge(g);
  if (dy) {g.app.audio.play('blip');}
  return { cursor: dy ? wrapCursor(cursor, dy, count) : cursor, chosen: g.app.input.pressed('A') };
}

export function startThreshold(g: Game, choose: (choice: ThresholdChoice) => void): void {
  g.threshold = { cursor: 0, choose };
  g.subScene = 'THRESHOLD';
  resetCursorEdge(g);
}

export function updateThreshold(g: Game): void {
  const step = stepChoice(g, g.threshold.cursor, THRESHOLD_CHOICES.length);
  g.threshold.cursor = step.cursor;
  if (!step.chosen) {return;}
  g.app.audio.play('pickup');
  g.threshold.choose(at(THRESHOLD_CHOICES, step.cursor));
}
