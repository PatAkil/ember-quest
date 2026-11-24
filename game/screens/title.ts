import { BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, drawLogo, drawText, drawTextCentered, textWidth } from '../../engine';
import { describeSave } from '../sim';
import type { SavedRun } from '../sim';
import { continueRun, startFresh } from '../flow';
import { ENEMY_FRAMES, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_TEXT, W } from '../theme';
import { blinkHz, drawCommandBand } from '../widgets';
import { drawConfirm, drawMenuRow, stepMenu } from './menu';

const POSTER_PX = 3;
const POSTER_X = 52;
const FOE_X = 164;
const COPY_X = 160;
const CONTINUE_ROW = 0;
const NEW_RUN_ROW = 1;
const ROW_Y: readonly number[] = [BAND_Y + 6, BAND_Y + 16];
const MENU_BAR_W = W - 2 * SAFE_MARGIN;

export function updateTitle(g: Game): void {
  const saved = g.resume;
  const { input, audio } = g.app;
  if (!saved) {
    if (input.pressed('A')) { audio.play('blip'); startFresh(g); }
    return;
  }
  const chosen = stepMenu(g, g.title, { rows: ROW_Y.length, guarded: NEW_RUN_ROW });
  if (chosen === CONTINUE_ROW) {continueRun(g, saved);}
  if (chosen === NEW_RUN_ROW) {startFresh(g);}
}

function copyLine(ctx: CanvasRenderingContext2D, text: string, y: number, color: string): void {
  drawText(ctx, text, { x: Math.round(COPY_X - textWidth(text, 1) / 2), y }, { color, shadow: true });
}

function drawBest(g: Game): void {
  const { score, depth } = g.best;
  if (score <= 0) {return;}
  const lines = depth > 1 ? [`BEST ${String(score)}`, `DEPTH ${String(depth)}`] : [`BEST ${String(score)}`];
  lines.forEach((line, i) => {
    drawText(g.app.pc.ctx, line, { x: W - SAFE_MARGIN - textWidth(line, 1), y: SAFE_MARGIN + i * 8 }, { color: C_DIM, shadow: true });
  });
}

export function renderTitle(g: Game): void {
  const { pc, particles, input } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g); particles.render(ctx); renderFloor(g);
  drawActor(g, heroFrames, POSTER_X, { phase: 0, px: POSTER_PX });
  drawActor(g, ENEMY_FRAMES.SLIME, FOE_X, { phase: 0.5 });
  drawLogo(ctx, 'EMBER QUEST', { width: W, y: 10 }, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 3 });
  copyLine(ctx, 'ONE LIFE  YOUR BUILD', 38, C_DIM);
  copyLine(ctx, 'FOUR ACTS  THEN THE DESCENT', 48, C_TEXT);
  drawCommandBand(ctx);
  const hintOpts = { color: C_DIM, shadow: true };
  if (g.resume) {drawResumeChoice(g, g.resume);} else {
    drawTextCentered(ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, { width: W, y: BAND_Y + 6 }, { color: blinkHz(g.clock, 1.2) ? C_ACCENT : C_TEXT, shadow: true });
    drawTextCentered(ctx, 'UP/DOWN  MOVE CURSOR', { width: W, y: BAND_Y + 18 }, hintOpts);
  }
  drawTextCentered(ctx, controlHints(input).join('   '), { width: W, y: BAND_Y + 27 }, hintOpts);
  drawBest(g);
}

function drawResumeChoice(g: Game, saved: SavedRun): void {
  const ctx = g.app.pc.ctx;
  if (g.title.confirm) {
    drawConfirm(ctx, 'ERASE YOUR RUN?', { y: BAND_Y + 11, barW: MENU_BAR_W });
    return;
  }
  const rows = [{ label: 'CONTINUE', detail: describeSave(saved) }, { label: 'NEW RUN' }];
  rows.forEach((row, i) => {
    drawMenuRow(ctx, row, { y: ROW_Y[i] ?? BAND_Y, barW: MENU_BAR_W, selected: i === g.title.cursor });
  });
}
