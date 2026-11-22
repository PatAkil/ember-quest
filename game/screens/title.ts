import {
  BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, dimScene, drawFrame, drawLogo, drawPanel, drawText, drawTextCentered, hudText, textWidth,
} from '../../engine';
import { SLOTS } from '../types';
import { displayName, itemLevel } from '../sim';
import { ENEMY_FRAMES, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_TEXT, FLOOR_Y, H, W } from '../theme';
import { blinkHz, drawCommandBand, fitText } from '../widgets';

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
  drawCommandBand(ctx);
  drawTextCentered(ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, { width: W, y: BAND_Y + 6 }, { color: blinkHz(g.clock, 1.2) ? C_ACCENT : C_TEXT, shadow: true });
  const hintOpts = { color: C_DIM, shadow: true };
  drawTextCentered(ctx, 'UP/DOWN  MOVE CURSOR', { width: W, y: BAND_Y + 18 }, hintOpts);
  drawTextCentered(ctx, controlHints(input).join('   '), { width: W, y: BAND_Y + 27 }, hintOpts);
  if (g.best > 0) {hudText(pc, `BEST ${g.best}`, { h: 'right', v: 'top' }, { color: C_DIM });}
}

const PAUSE_BOX = { x: W / 2 - 50, y: 62, w: 100, h: 32 };

export function renderPausedOverlay(g: Game): void {
  const { pc } = g.app;
  dimScene(pc, 0.6);
  drawPanel(pc, PAUSE_BOX, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(pc.ctx, 'PAUSED', { width: W, y: PAUSE_BOX.y + 6 }, { color: C_ACCENT, scale: 2, shadow: true });
  drawTextCentered(pc.ctx, `${BUTTON_KEY.PAUSE.hint} RESUME`, { width: W, y: PAUSE_BOX.y + 21 }, { color: C_DIM });
}

const GEAR_SEP = ' / ';

function gearNames(g: Game): string[] {
  return SLOTS.flatMap((sl) => {
    const item = g.hero.equipment[sl];
    return item ? [displayName(item, itemLevel(g.hero, sl))] : [];
  });
}

function packGear(names: readonly string[], maxW: number): string[] {
  const lines: string[] = [];
  for (const name of names) {
    const last = lines[lines.length - 1];
    const joined = last === undefined ? name : `${last}${GEAR_SEP}${name}`;
    if (last !== undefined && textWidth(joined, 1) <= maxW) {lines[lines.length - 1] = joined;} else {lines.push(name);}
  }
  return lines.length ? lines : ['NO GEAR'];
}

interface Ending { headline: string; color: string; sub: string }

const HEADLINE_BOX = { x: 26, y: 6, w: W - 52, h: 29 };
const SUMMARY_BOX = { x: 26, y: FLOOR_Y + 4, w: W - 52, h: H - SAFE_MARGIN - FLOOR_Y - 2 };

function drawEndingSummary(g: Game, ctx: CanvasRenderingContext2D): void {
  const y = SUMMARY_BOX.y + 4;
  const best = g.beatBest ? 'NEW BEST' : `BEST ${g.best}`;
  drawTextCentered(ctx, `${g.clears} CLEARED   SCORE ${g.score}   ${best}`, { width: W, y }, { color: g.beatBest ? C_ACCENT : C_TEXT, shadow: true });
  const maxW = SUMMARY_BOX.w - 8;
  const gear = packGear(gearNames(g), maxW).slice(0, 2);
  const gearY = y + (gear.length === 1 ? 12 : 9);
  gear.forEach((line, i) => {
    fitText(ctx, line, { x: Math.round((W - Math.min(maxW, textWidth(line, 1))) / 2), y: gearY + i * 7, maxW }, { color: C_DIM, shadow: true });
  });
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
