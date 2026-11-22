import {
  BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, dimScene, drawFrame, drawLogo, drawText, drawTextCentered, hudText, textWidth,
} from '../../engine';
import { SLOTS } from '../types';
import { displayName, itemLevel } from '../sim';
import { ENEMY_FRAMES, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_TEXT, FLOOR_Y, H, W } from '../theme';
import { blinkHz, fitText } from '../widgets';

const POSTER_PX = 3;
const POSTER_X = 52;
const FOE_X = 164;
const COPY_X = 160;

function copyLine(ctx: CanvasRenderingContext2D, text: string, y: number, color: string): void {
  drawText(ctx, text, { x: Math.round(COPY_X - textWidth(text, 1) / 2), y }, { color, shadow: true });
}

export function renderTitle(g: Game): void {
  const { pc, particles, input } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g); particles.render(ctx); renderFloor(g);
  drawActor(g, heroFrames, POSTER_X, { phase: 0, px: POSTER_PX });
  drawActor(g, ENEMY_FRAMES.SLIME, FOE_X, { phase: 0.5 });
  drawLogo(ctx, 'EMBER QUEST', { width: W, y: 10 }, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 3 });
  copyLine(ctx, 'A ROGUELIKE DESCENT', 38, C_DIM);
  copyLine(ctx, 'FOUR ACTS  ONE LIFE  YOUR BUILD', 48, C_TEXT);
  drawTextCentered(ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, { width: W, y: 120 }, { color: blinkHz(g.clock, 1.2) ? C_ACCENT : C_TEXT, shadow: true });
  const hintOpts = { color: C_TEXT, shadow: true };
  drawTextCentered(ctx, 'UP/DOWN  MOVE CURSOR', { width: W, y: 131 }, hintOpts);
  controlHints(input).forEach((h, i) => { drawTextCentered(ctx, h, { width: W, y: 139 + i * 8 }, hintOpts); });
  if (g.best > 0) {hudText(pc, `BEST ${g.best}`, { h: 'right', v: 'top' }, { color: C_DIM });}
}

export function renderPausedOverlay(g: Game): void {
  const { pc } = g.app;
  dimScene(pc, 0.6);
  hudText(pc, 'PAUSED', { h: 'center', v: 'middle' }, { color: C_ACCENT, scale: 2, plate: false });
  drawTextCentered(pc.ctx, `${BUTTON_KEY.PAUSE.hint} RESUME`, { width: W, y: 96 }, { color: C_DIM, shadow: true });
}

function buildLine(g: Game): string {
  const names = SLOTS.map((sl) => {
    const item = g.hero.equipment[sl];
    return item ? displayName(item, itemLevel(g.hero, sl)) : '';
  });
  return names.filter(Boolean).join(' ') || 'NO GEAR';
}

interface Ending { headline: string; color: string; sub: string }

const HEADLINE_BOX = { x: 26, y: 6, w: W - 52, h: 29 };
const SUMMARY_BOX = { x: 26, y: FLOOR_Y + 4, w: W - 52, h: H - SAFE_MARGIN - FLOOR_Y - 2 };

function drawEndingSummary(g: Game, ctx: CanvasRenderingContext2D): void {
  const y = SUMMARY_BOX.y + 4;
  drawTextCentered(ctx, `${g.clears} ENCOUNTERS CLEARED`, { width: W, y }, { color: C_TEXT, shadow: true });
  const build = buildLine(g);
  const maxW = SUMMARY_BOX.w - 8;
  fitText(ctx, build, { x: Math.round((W - Math.min(maxW, textWidth(build, 1))) / 2), y: y + 8, maxW }, { color: C_DIM, shadow: true });
  drawTextCentered(ctx, `SCORE ${g.score}   ${g.beatBest ? 'NEW BEST' : `BEST ${g.best}`}`, { width: W, y: y + 16 }, { color: g.beatBest ? C_ACCENT : C_DIM, shadow: true });
  drawTextCentered(ctx, `${BUTTON_KEY.A.hint} DESCEND AGAIN`, { width: W, y: y + 26 }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM, shadow: true });
}

export function renderEndingOverlay(g: Game, ending: Ending): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  dimScene(pc, 0.6);
  drawFrame(ctx, HEADLINE_BOX, { color: C_BORDER, thickness: 1 });
  drawTextCentered(ctx, ending.sub, { width: W, y: HEADLINE_BOX.y + 5 }, { color: C_DIM, shadow: true });
  drawTextCentered(ctx, ending.headline, { width: W, y: HEADLINE_BOX.y + 14 }, { color: ending.color, scale: 2 });
  drawFrame(ctx, SUMMARY_BOX, { color: C_BORDER, thickness: 1 });
  drawEndingSummary(g, ctx);
}
