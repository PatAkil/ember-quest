import { SAFE_MARGIN, dimScene, drawPanel, drawText, drawTextCentered } from '../../engine';
import { depthOf, gloryBonus } from '../sim';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, W } from '../theme';
import { drawCommandBand } from '../widgets';

interface ChoiceRow { label: string; note: string; noteColor?: string }

const ROW_X = SAFE_MARGIN;
const ROW_W = W - 2 * SAFE_MARGIN;
const ROW_PITCH = 11;
const NOTE_X = 84;
export const TOP_PANEL = { x: 24, y: SAFE_MARGIN, w: W - 48, h: 46 };

export function drawChoiceRows(ctx: CanvasRenderingContext2D, rows: readonly ChoiceRow[], cursor: number): void {
  drawCommandBand(ctx);
  rows.forEach((row, i) => {
    const y = BAND_Y + 7 + i * ROW_PITCH;
    const sel = i === cursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(ROW_X, y - 2, ROW_W, 9); }
    drawText(ctx, `${sel ? '> ' : '  '}${row.label}`, { x: ROW_X + 2, y }, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
    drawText(ctx, row.note, { x: NOTE_X, y }, { color: row.noteColor ?? (sel ? C_TEXT : C_DIM), shadow: sel });
  });
}

export function renderThreshold(g: Game): void {
  const { pc } = g.app;
  const { ctx } = pc;
  const depth = depthOf(g.n);
  renderTableau(g, false);
  dimScene(pc, 0.6);
  drawPanel(pc, TOP_PANEL, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(ctx, 'THE THRESHOLD', { width: W, y: TOP_PANEL.y + 6 }, { color: C_ACCENT, scale: 2, shadow: true });
  drawTextCentered(ctx, `DEPTH ${String(depth)} CLEARED   SCORE ${String(g.score)}`, { width: W, y: TOP_PANEL.y + 24 }, { color: C_TEXT, shadow: true });
  drawTextCentered(ctx, 'END IT HERE, OR GO DEEPER', { width: W, y: TOP_PANEL.y + 34 }, { color: C_DIM, shadow: true });
  drawChoiceRows(ctx, [
    { label: 'ASCEND', note: `WIN  +${String(gloryBonus(depth))} GLORY` },
    { label: 'DESCEND', note: 'A DEATH KEEPS HALF' },
  ], g.threshold.cursor);
}
