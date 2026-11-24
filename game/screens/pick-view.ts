import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import { renderTableau } from '../backdrop';
import type { Game, PickRow } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, HERO_W, HERO_X, W } from '../theme';
import { drawCommandBand, fitText } from '../widgets';

const X0 = HERO_X + HERO_W / 2 + 12;
const PW = W - SAFE_MARGIN - X0;
const ROW_TOP = 15;
const ROW_PITCH = 9;
const VISIBLE = 8;
const NAME_X = X0 + 9;
const NOTE_RIGHT = X0 + PW - 5;
const BAND_TEXT_X = SAFE_MARGIN + 24;
const BAND_TEXT_W = W - SAFE_MARGIN - BAND_TEXT_X;

const firstVisible = (cursor: number): number => Math.max(0, cursor - (VISIBLE - 1));

function drawRow(ctx: CanvasRenderingContext2D, row: PickRow, at: { y: number; sel: boolean }): void {
  if (at.sel) {
    ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, at.y - 1, PW - 6, ROW_PITCH - 1);
    drawText(ctx, '>', { x: X0 + 4, y: at.y + 1 }, { color: C_ACCENT });
  }
  const noteX = NOTE_RIGHT - textWidth(row.note, 1);
  drawText(ctx, row.note, { x: noteX, y: at.y + 1 }, { color: C_DIM });
  fitText(ctx, row.name, { x: NAME_X, y: at.y + 1, maxW: noteX - 4 - NAME_X }, { color: row.color, shadow: at.sel });
}

function drawBand(ctx: CanvasRenderingContext2D, row: PickRow | undefined): void {
  drawCommandBand(ctx);
  if (!row) {return;}
  if (row.icon) {drawSprite(ctx, row.icon, { x: SAFE_MARGIN, y: BAND_Y + 6 }, 2);}
  fitText(ctx, row.name, { x: BAND_TEXT_X, y: BAND_Y + 5, maxW: BAND_TEXT_W }, { color: row.color, shadow: true });
  row.detail.slice(0, 3).forEach((line, i) => {
    fitText(ctx, line, { x: BAND_TEXT_X, y: BAND_Y + 13 + i * 7, maxW: BAND_TEXT_W }, { color: C_TEXT });
  });
}

export function renderPick(g: Game): void {
  const { pc } = g.app;
  const { pick } = g;
  renderTableau(g, false);
  const ctx = pc.ctx;
  const first = firstVisible(pick.cursor);
  const shown = pick.rows.slice(first, first + VISIBLE);
  const promptY = SAFE_MARGIN + ROW_TOP + Math.max(1, shown.length) * ROW_PITCH + 2;
  drawPanel(pc, { x: X0, y: SAFE_MARGIN, w: PW, h: promptY + 9 - SAFE_MARGIN }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, pick.title, { x: Math.round(X0 + (PW - textWidth(pick.title, 1)) / 2), y: SAFE_MARGIN + 5 }, { color: C_ACCENT, shadow: true });
  shown.forEach((row, i) => {
    drawRow(ctx, row, { y: SAFE_MARGIN + ROW_TOP + i * ROW_PITCH, sel: first + i === pick.cursor });
  });
  const prompt = `${BUTTON_KEY.A.hint} PICK  ${BUTTON_KEY.B.hint} BACK`;
  drawText(ctx, prompt, { x: Math.round(X0 + (PW - textWidth(prompt, 1)) / 2), y: promptY }, { color: C_DIM });
  drawBand(ctx, pick.rows[pick.cursor]);
}
