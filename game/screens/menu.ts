import { BUTTON_KEY, drawText, drawTextCentered, textWidth } from '../../engine';
import { dirEdge, wrapCursor } from '../state';
import type { Game, MenuScreen } from '../state';
import { C_ACCENT, C_DIM, C_SEL_BAR, C_TEXT, C_WARN, W } from '../theme';

interface MenuGuard { rows: number; guarded: number }
interface MenuRow { label: string; detail?: string }
interface RowSpot { y: number; barW: number; selected: boolean }

const CONFIRM_KEYS = `${BUTTON_KEY.A.hint} YES  ${BUTTON_KEY.B.hint} NO`;
const BAR_H = 9;

function stepConfirm(g: Game, menu: MenuScreen, guarded: number): number | null {
  const { input, audio } = g.app;
  if (input.pressed('A')) { menu.confirm = false; audio.play('blip'); return guarded; }
  if (input.pressed('B')) { menu.confirm = false; audio.play('blip'); }
  return null;
}

export function stepMenu(g: Game, menu: MenuScreen, guard: MenuGuard): number | null {
  const { input, audio } = g.app;
  if (menu.confirm) {return stepConfirm(g, menu, guard.guarded);}
  const dy = dirEdge(g);
  if (dy) { menu.cursor = wrapCursor(menu.cursor, dy, guard.rows); audio.play('blip'); }
  if (!input.pressed('A')) {return null;}
  audio.play('blip');
  if (menu.cursor !== guard.guarded) {return menu.cursor;}
  menu.confirm = true;
  return null;
}

function drawBar(ctx: CanvasRenderingContext2D, y: number, barW: number): void {
  ctx.fillStyle = C_SEL_BAR;
  ctx.fillRect(Math.round(W / 2 - barW / 2), y - 2, barW, BAR_H);
}

export function drawMenuRow(ctx: CanvasRenderingContext2D, row: MenuRow, spot: RowSpot): void {
  if (spot.selected) {drawBar(ctx, spot.y, spot.barW);}
  const head = spot.selected ? `> ${row.label}` : row.label;
  const tail = row.detail === undefined ? '' : `  ${row.detail}`;
  const x = Math.round(W / 2 - textWidth(head + tail, 1) / 2);
  drawText(ctx, head, { x, y: spot.y }, { color: spot.selected ? C_ACCENT : C_TEXT, shadow: true });
  if (tail) {drawText(ctx, tail, { x: x + textWidth(head, 1), y: spot.y }, { color: C_DIM, shadow: true });}
}

export function drawConfirm(ctx: CanvasRenderingContext2D, question: string, spot: Omit<RowSpot, 'selected'>): void {
  drawBar(ctx, spot.y, spot.barW);
  drawTextCentered(ctx, `${question}  ${CONFIRM_KEYS}`, { width: W, y: spot.y }, { color: C_WARN, shadow: true });
}
