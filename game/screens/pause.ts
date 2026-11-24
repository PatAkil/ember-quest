import { dimScene, drawPanel, drawTextCentered } from '../../engine';
import { PACTS } from '../sim';
import { abandonRun } from '../flow';
import { resetCursorEdge } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_TEXT, W } from '../theme';
import { packNames } from './ending';
import { drawConfirm, drawMenuRow, stepMenu } from './menu';

const PAUSE_ROWS = ['RESUME', 'ABANDON RUN'] as const;
const ABANDON_ROW = 1;
const PAUSE_W = 144;
const PACT_PAUSE_W = 184;
const PAUSE_MID_Y = 78;
const ROW_Y = 21;
const ROW_PITCH = 10;
const MENU_H = 42;

const pressedA = (g: Game): boolean => g.app.input.pressed('A');

function resume(g: Game): void {
  g.app.scenes.to('PLAYING');
  resetCursorEdge(g);
}

export function updatePaused(g: Game): void {
  if (g.app.input.pressed('PAUSE')) { g.app.audio.play('blip'); resume(g); return; }
  const chosen = stepMenu(g, g.pause, { rows: PAUSE_ROWS.length, guarded: ABANDON_ROW, readA: pressedA });
  if (chosen === null) {return;}
  if (chosen === ABANDON_ROW) { abandonRun(g); return; }
  resume(g);
}

function drawPauseMenu(g: Game, top: number, barW: number): void {
  const ctx = g.app.pc.ctx;
  if (g.pause.confirm) {
    drawConfirm(ctx, 'REALLY ABANDON?', { y: top + ROW_Y, barW, selected: g.pause.yes, hintY: top + ROW_Y + ROW_PITCH });
    return;
  }
  PAUSE_ROWS.forEach((label, i) => {
    drawMenuRow(ctx, { label }, { y: top + ROW_Y + i * ROW_PITCH, barW, selected: i === g.pause.cursor });
  });
}

export function renderPausedOverlay(g: Game): void {
  const { pc } = g.app;
  const names = g.hero.pacts.map((id) => PACTS[id].name);
  const lines = names.length ? packNames(names, PACT_PAUSE_W - 12) : [];
  const w = lines.length ? PACT_PAUSE_W : PAUSE_W;
  const h = MENU_H + (lines.length ? 10 + lines.length * 8 : 0);
  const box = { x: W / 2 - w / 2, y: Math.round(PAUSE_MID_Y - h / 2), w, h };
  dimScene(pc, 0.6);
  drawPanel(pc, box, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(pc.ctx, 'PAUSED', { width: W, y: box.y + 6 }, { color: C_ACCENT, scale: 2, shadow: true });
  drawPauseMenu(g, box.y, w - 8);
  if (!lines.length) {return;}
  drawTextCentered(pc.ctx, 'YOUR PACTS', { width: W, y: box.y + MENU_H }, { color: C_DIM });
  lines.forEach((line, i) => {
    drawTextCentered(pc.ctx, line, { width: W, y: box.y + MENU_H + 9 + i * 8 }, { color: C_TEXT, shadow: true });
  });
}
