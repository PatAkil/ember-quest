import { BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, drawLogo, drawText, drawTextCentered, textWidth } from '../../engine';
import type { ButtonName } from '../../engine';
import { describeSave } from '../sim';
import type { SavedRun } from '../sim';
import { startFresh } from '../flow';
import { continueIfCurrent } from '../resume';
import { ENEMY_FRAMES, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import { takeA } from '../state';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_TEXT, C_WARN, W } from '../theme';
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
  const { audio } = g.app;
  if (!saved) {
    if (takeA(g)) { audio.play('blip'); startFresh(g); }
    return;
  }
  const chosen = stepMenu(g, g.title, { rows: ROW_Y.length, guarded: NEW_RUN_ROW, readA: takeA });
  if (chosen === CONTINUE_ROW) {continueIfCurrent(g, saved);}
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
  }
  const hints = titleHints(g, controlHints(input, TITLE_BUTTONS));
  if (hints) {drawTextCentered(ctx, hints, { width: W, y: BAND_Y + 27 }, hintOpts);}
  drawBest(g);
  drawNotice(g);
}

const TITLE_BUTTONS: readonly ButtonName[] = ['A'];

function titleHints(g: Game, declared: readonly string[]): string {
  if (g.title.confirm) {return '';}
  return (g.resume ? [...declared, 'UP DOWN CHOOSE'] : declared).join('   ');
}

const NOTICE_SHOWN = 2.5;

function drawNotice(g: Game): void {
  const n = g.notice;
  if (!n || g.clock - n.at > NOTICE_SHOWN) {return;}
  copyLine(g.app.pc.ctx, n.text, 60, C_WARN);
}

function drawResumeChoice(g: Game, saved: SavedRun): void {
  const ctx = g.app.pc.ctx;
  if (g.title.confirm) {
    drawConfirm(ctx, 'ERASE YOUR RUN?', { y: BAND_Y + 6, barW: MENU_BAR_W, selected: g.title.yes, hintY: BAND_Y + 16 });
    return;
  }
  const rows = [{ label: 'CONTINUE', detail: describeSave(saved) }, { label: 'NEW RUN' }];
  rows.forEach((row, i) => {
    drawMenuRow(ctx, row, { y: ROW_Y[i] ?? BAND_Y, barW: MENU_BAR_W, selected: i === g.title.cursor });
  });
}
