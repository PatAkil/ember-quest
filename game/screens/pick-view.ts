import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import { renderTableau } from '../backdrop';
import { decisionReady } from '../state';
import type { Game, PickRow } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_FAINT, C_PANEL, C_SEL_BAR, C_TEXT, HERO_W, HERO_X, W } from '../theme';
import { drawCommandBand, fitText } from '../widgets';
import { ICON_EMPTY } from '../sprites';
import { drawItemCard } from './compare-view';

const X0 = HERO_X + HERO_W / 2 + 12;
const PW = W - SAFE_MARGIN - X0;
const ROW_TOP = 15;
const ROW_PITCH = 9;
const VISIBLE = 8;
const ICON_X = X0 + 8;
const NAME_X = X0 + 19;
const NOTE_RIGHT = X0 + PW - 5;

const firstVisible = (cursor: number): number => Math.max(0, cursor - (VISIBLE - 1));

function drawRow(ctx: CanvasRenderingContext2D, row: PickRow, at: { y: number; sel: boolean }): void {
  if (at.sel) {
    ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, at.y - 1, PW - 6, ROW_PITCH - 1);
    drawText(ctx, '>', { x: X0 + 4, y: at.y + 1 }, { color: C_ACCENT });
  }
  if (row.icon) {drawSprite(ctx, row.icon, { x: ICON_X, y: at.y - 1 }, 1);}
  const noteX = NOTE_RIGHT - textWidth(row.note, 1);
  drawText(ctx, row.note, { x: noteX, y: at.y + 1 }, { color: C_DIM });
  fitText(ctx, row.name, { x: NAME_X, y: at.y + 1, maxW: noteX - 4 - NAME_X }, { color: row.color, shadow: at.sel });
}

function drawBand(ctx: CanvasRenderingContext2D, row: PickRow | undefined): void {
  drawCommandBand(ctx);
  if (!row) {return;}
  const last = row.detail.length - 1;
  const lines = row.detail.slice(0, 3).map((text, i) => ({ text, color: i === last && last > 0 ? row.color : C_TEXT }));
  if (row.aside) {lines.push({ text: row.aside, color: C_DIM });}
  drawItemCard(ctx, { icon: row.icon ?? ICON_EMPTY, px: 3 }, { name: row.name, color: row.color, lines });
}

function drawScrollHints(ctx: CanvasRenderingContext2D, view: { first: number; shown: number; total: number; promptY: number }): void {
  const x = X0 + PW - 9;
  ctx.fillStyle = C_ACCENT;
  if (view.first > 0) {
    ctx.fillRect(x + 2, SAFE_MARGIN + 5, 1, 1); ctx.fillRect(x + 1, SAFE_MARGIN + 6, 3, 1); ctx.fillRect(x, SAFE_MARGIN + 7, 5, 1);
  }
  if (view.first + view.shown < view.total) {
    ctx.fillRect(x, view.promptY + 1, 5, 1); ctx.fillRect(x + 1, view.promptY + 2, 3, 1); ctx.fillRect(x + 2, view.promptY + 3, 1, 1);
  }
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
  drawScrollHints(ctx, { first, shown: shown.length, total: pick.rows.length, promptY });
  const prompt = pick.locked ? `${BUTTON_KEY.A.hint} PICK  YOU MUST CHOOSE` : `${BUTTON_KEY.A.hint} PICK  ${BUTTON_KEY.B.hint} BACK`;
  drawText(ctx, prompt, { x: Math.round(X0 + (PW - textWidth(prompt, 1)) / 2), y: promptY }, { color: decisionReady(g) ? C_DIM : C_FAINT });
  drawBand(ctx, pick.rows[pick.cursor]);
}
