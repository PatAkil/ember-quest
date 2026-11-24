import type { PactId } from '../types';
import { takePact } from '../sim';
import { at } from '../lookup';
import { armA, resetCursorEdge } from '../state';
import type { Game } from '../state';
import { C_ACCENT } from '../theme';
import { NO_CHOICE, PACT_ARM, stepChoice } from './threshold';

export function startPact(g: Game, offers: PactId[], onDone: () => void): void {
  g.pact = { offers, cursor: NO_CHOICE, openedAt: g.clock, refusedAt: -1, onDone };
  g.subScene = 'PACT';
  resetCursorEdge(g);
  armA(g);
}

export function updatePact(g: Game): void {
  const { pact } = g;
  const step = stepChoice(g, pact.cursor, pact.offers.length, { openedAt: pact.openedAt, delay: PACT_ARM, entersAtTop: true });
  pact.cursor = step.cursor;
  if (step.refused) {pact.refusedAt = g.clock;}
  if (!step.chosen) {return;}
  g.app.audio.play('pickup');
  g.app.juice.flash(C_ACCENT, 0.25);
  takePact(g.hero, at(pact.offers, pact.cursor));
  pact.onDone();
}
