import {
  BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, dimScene, drawLogo, drawPanel, drawText, drawTextCentered, textWidth,
} from '../../engine';
import { PACTS } from '../sim';
import { ENEMY_FRAMES, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_TEXT, W } from '../theme';
import { blinkHz, drawCommandBand } from '../widgets';
import { packNames } from './ending';

const POSTER_PX = 3;
const POSTER_X = 52;
const FOE_X = 164;
const COPY_X = 160;

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
  drawTextCentered(ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, { width: W, y: BAND_Y + 6 }, { color: blinkHz(g.clock, 1.2) ? C_ACCENT : C_TEXT, shadow: true });
  const hintOpts = { color: C_DIM, shadow: true };
  drawTextCentered(ctx, 'UP/DOWN  MOVE CURSOR', { width: W, y: BAND_Y + 18 }, hintOpts);
  drawTextCentered(ctx, controlHints(input).join('   '), { width: W, y: BAND_Y + 27 }, hintOpts);
  drawBest(g);
}

const PAUSE_W = 100;
const PACT_PAUSE_W = 184;
const PAUSE_Y = 62;

export function renderPausedOverlay(g: Game): void {
  const { pc } = g.app;
  const names = g.hero.pacts.map((id) => PACTS[id].name);
  const lines = names.length ? packNames(names, PACT_PAUSE_W - 12) : [];
  const w = lines.length ? PACT_PAUSE_W : PAUSE_W;
  const box = { x: W / 2 - w / 2, y: PAUSE_Y - lines.length * 4 - (lines.length ? 6 : 0), w, h: 32 + (lines.length ? 10 + lines.length * 8 : 0) };
  dimScene(pc, 0.6);
  drawPanel(pc, box, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(pc.ctx, 'PAUSED', { width: W, y: box.y + 6 }, { color: C_ACCENT, scale: 2, shadow: true });
  drawTextCentered(pc.ctx, `${BUTTON_KEY.PAUSE.hint} RESUME`, { width: W, y: box.y + 21 }, { color: C_DIM });
  if (!lines.length) {return;}
  drawTextCentered(pc.ctx, 'YOUR PACTS', { width: W, y: box.y + 32 }, { color: C_DIM });
  lines.forEach((line, i) => {
    drawTextCentered(pc.ctx, line, { width: W, y: box.y + 41 + i * 8 }, { color: C_TEXT, shadow: true });
  });
}
