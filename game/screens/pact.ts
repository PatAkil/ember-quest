import type { PactId } from '../types';
import { takePact } from '../sim';
import { at } from '../lookup';
import { resetCursorEdge } from '../state';
import type { Game } from '../state';
import { stepChoice } from './threshold';

export function startPact(g: Game, offers: PactId[], onDone: () => void): void {
  g.pact = { offers, cursor: 0, onDone };
  g.subScene = 'PACT';
  resetCursorEdge(g);
}

export function updatePact(g: Game): void {
  const { pact } = g;
  const step = stepChoice(g, pact.cursor, pact.offers.length);
  pact.cursor = step.cursor;
  if (!step.chosen) {return;}
  g.app.audio.play('pickup');
  takePact(g.hero, at(pact.offers, pact.cursor));
  pact.onDone();
}
