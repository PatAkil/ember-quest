import {
  BUTTON_KEY, PICO8, SAFE_MARGIN, controlHints, dimScene, drawFrame, drawLogo, drawSprite, drawTextCentered, hudText, textWidth,
} from '../../engine';
import { SLOTS } from '../types';
import { displayName, itemLevel } from '../sim';
import { ENEMY_FRAMES, animFrame, heroFrames } from '../sprites';
import { drawActor, renderBiomeBackdrop, renderFloor } from '../backdrop';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_TEXT, FLOOR_Y, H, HERO_X, W } from '../theme';
import { blinkHz, fitText } from '../widgets';

export function renderTitle(g: Game): void {
  const { pc, particles, input } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g); particles.render(ctx); renderFloor(g);
  const hf = animFrame(heroFrames, g.clock);
  ctx.fillStyle = PICO8[0]; ctx.fillRect(HERO_X - hf.w + 6, FLOOR_Y - 1, hf.w * 2 - 12, 3);
  drawSprite(ctx, hf, { x: HERO_X - hf.w, y: FLOOR_Y - hf.h * 2 }, 2);
  drawActor(g, ENEMY_FRAMES.SLIME, 170, { phase: 0.5 });
  drawLogo(ctx, 'EMBER QUEST', { width: W, y: 12 }, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 3 });
  drawTextCentered(ctx, 'A ROGUELIKE DESCENT', { width: W, y: 34 }, { color: C_DIM, shadow: true });
  drawTextCentered(ctx, 'FOUR ACTS  ONE LIFE  YOUR BUILD', { width: W, y: 44 }, { color: C_TEXT, shadow: true });
  drawTextCentered(ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, { width: W, y: 122 }, { color: blinkHz(g.clock, 1.2) ? C_ACCENT : C_TEXT, shadow: true });
  const hintOpts = { color: C_TEXT, shadow: true };
  drawTextCentered(ctx, 'UP/DOWN  MOVE CURSOR', { width: W, y: 134 }, hintOpts);
  controlHints(input).forEach((h, i) => { drawTextCentered(ctx, h, { width: W, y: 142 + i * 8 }, hintOpts); });
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
