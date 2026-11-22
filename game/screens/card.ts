import { BUTTON_KEY, dimScene, drawFrame, drawTextCentered } from '../../engine';
import { renderTableau } from '../backdrop';
import { resetCursorEdge } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_TEXT, W } from '../theme';
import { blinkHz } from '../widgets';

export function showCard(g: Game, lines: string[], onDone: () => void): void {
  g.card = { lines, onDone };
  g.subScene = 'CARD';
  resetCursorEdge(g);
}

export function updateCard(g: Game): void {
  if (g.app.input.pressed('A')) { g.app.audio.play('blip'); g.card.onDone(); }
}

export function renderCard(g: Game): void {
  const { pc } = g.app;
  const lines = g.card.lines;
  renderTableau(g, false);
  dimScene(pc, 0.6);
  const h = 26 + lines.length * 12;
  const y = 30;
  drawFrame(pc.ctx, { x: 26, y, w: W - 52, h }, { color: C_BORDER, thickness: 1 });
  lines.forEach((line, i) => { drawTextCentered(pc.ctx, line, { width: W, y: y + 8 + i * 12 }, { color: i === 0 ? C_ACCENT : C_TEXT, shadow: true }); });
  drawTextCentered(pc.ctx, `${BUTTON_KEY.A.hint} CONTINUE`, { width: W, y: y + h - 10 }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM });
}
