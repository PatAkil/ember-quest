import type { PactId } from '../types';
import { takePact } from '../sim';
import { at } from '../lookup';
import { resetCursorEdge } from '../state';
import type { Game } from '../state';
import { C_ACCENT } from '../theme';
import { PACT_ARM, stepChoice } from './threshold';

export function startPact(g: Game, offers: PactId[], onDone: () => void): void {
  g.pact = { offers, cursor: 0, openedAt: g.clock, onDone };
  g.subScene = 'PACT';
  resetCursorEdge(g);
}

export function updatePact(g: Game): void {
  const { pact } = g;
  const step = stepChoice(g, pact.cursor, pact.offers.length, { openedAt: pact.openedAt, delay: PACT_ARM });
  pact.cursor = step.cursor;
  if (!step.chosen) {return;}
  g.app.audio.play('pickup');
  g.app.juice.flash(C_ACCENT, 0.25);
  takePact(g.hero, at(pact.offers, pact.cursor));
  pact.onDone();
}
