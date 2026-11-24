import { BUTTON_KEY, drawText, textWidth } from '../../engine';
import { armA, dirEdge, dirEdgeX, wrapCursor } from '../state';
import type { Game, MenuScreen } from '../state';
import { C_ACCENT, C_DIM, C_SEL_BAR, C_TEXT, C_WARN, W } from '../theme';

interface MenuGuard { rows: number; guarded: number; readA: (g: Game) => boolean }
interface MenuRow { label: string; detail?: string }
interface RowSpot { y: number; barW: number; selected: boolean }

const BAR_H = 9;
const CONFIRM_GAP = 8;

function stepConfirm(g: Game, menu: MenuScreen, guard: MenuGuard): number | null {
  const { input, audio } = g.app;
  const moved = dirEdgeX(g) !== 0 || dirEdge(g) !== 0;
  if (moved) { menu.yes = !menu.yes; audio.play('blip'); }
  if (input.pressed('B')) { menu.confirm = false; audio.play('blip'); return null; }
  if (!guard.readA(g)) {return null;}
  audio.play('blip');
  menu.confirm = false;
  return menu.yes ? guard.guarded : null;
}

export function stepMenu(g: Game, menu: MenuScreen, guard: MenuGuard): number | null {
  const { audio } = g.app;
  if (menu.confirm) {return stepConfirm(g, menu, guard);}
  const dy = dirEdge(g);
  if (dy) { menu.cursor = wrapCursor(menu.cursor, dy, guard.rows); audio.play('blip'); }
  if (!guard.readA(g)) {return null;}
  audio.play('blip');
  if (menu.cursor !== guard.guarded) {return menu.cursor;}
  menu.confirm = true;
  menu.yes = false;
  armA(g);
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

interface Ink { text: string; color: string }

function confirmInks(question: string, yes: boolean): Ink[] {
  return [
    { text: question, color: C_WARN },
    { text: yes ? '  NO' : '> NO', color: yes ? C_TEXT : C_ACCENT },
    { text: yes ? '> YES' : '  YES', color: yes ? C_ACCENT : C_TEXT },
  ];
}

export function drawConfirm(ctx: CanvasRenderingContext2D, question: string, spot: RowSpot & { hintY?: number }): void {
  drawBar(ctx, spot.y, spot.barW);
  const inks = confirmInks(question, spot.selected);
  const width = inks.reduce((n, ink) => n + textWidth(ink.text, 1), 0) + CONFIRM_GAP * (inks.length - 1);
  let x = Math.round(W / 2 - width / 2);
  for (const ink of inks) {
    drawText(ctx, ink.text, { x, y: spot.y }, { color: ink.color, shadow: true });
    x += textWidth(ink.text, 1) + CONFIRM_GAP;
  }
  if (spot.hintY === undefined) {return;}
  const hint = `ARROWS PICK  ${BUTTON_KEY.A.hint} CONFIRM  ${BUTTON_KEY.B.hint} NO`;
  drawText(ctx, hint, { x: Math.round(W / 2 - textWidth(hint, 1) / 2), y: spot.hintY }, { color: C_DIM, shadow: true });
}
