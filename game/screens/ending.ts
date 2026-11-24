import { BUTTON_KEY, PICO8, SAFE_MARGIN, dimScene, drawFrame, drawTextCentered, textWidth } from '../../engine';
import { SLOTS } from '../types';
import { depthOf, displayName, itemLevel } from '../sim';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_TEXT, FLOOR_Y, H, W } from '../theme';
import { blinkHz, fitText } from '../widgets';

const NAME_SEP = ' / ';

function gearNames(g: Game): string[] {
  return SLOTS.flatMap((sl) => {
    const item = g.hero.equipment[sl];
    return item ? [displayName(item, itemLevel(g.hero, sl))] : [];
  });
}

export function packNames(names: readonly string[], maxW: number): string[] {
  const lines: string[] = [];
  for (const name of names) {
    const last = lines[lines.length - 1];
    const joined = last === undefined ? name : `${last}${NAME_SEP}${name}`;
    if (last !== undefined && textWidth(joined, 1) <= maxW) {lines[lines.length - 1] = joined;} else {lines.push(name);}
  }
  return lines;
}

interface Ending { headline: string; color: string; sub: string; subColor: string }

const HEADLINE_BOX = { x: 26, y: 6, w: W - 52, h: 29 };
const SUMMARY_BOX = { x: 26, y: FLOOR_Y + 4, w: W - 52, h: H - SAFE_MARGIN - FLOOR_Y - 2 };

function summaryLine(g: Game): string {
  const best = g.beatBest ? 'NEW BEST' : `BEST ${String(g.best.score)}`;
  const depth = depthOf(g.n);
  const run = `${String(g.clears)} CLEARED`;
  const head = depth > 1 ? `DEPTH ${String(depth)}  ${run}` : run;
  const sep = depth > 1 ? '  ' : '   ';
  return [head, `SCORE ${String(g.score)}`, best].join(sep);
}

function drawEndingSummary(g: Game, ctx: CanvasRenderingContext2D): void {
  const y = SUMMARY_BOX.y + 4;
  drawTextCentered(ctx, summaryLine(g), { width: W, y }, { color: g.beatBest ? C_ACCENT : C_TEXT, shadow: true });
  const maxW = SUMMARY_BOX.w - 8;
  const names = packNames(gearNames(g), maxW);
  const gear = (names.length ? names : ['NO GEAR']).slice(0, 2);
  const gearY = y + (gear.length === 1 ? 12 : 9);
  gear.forEach((line, i) => {
    fitText(ctx, line, { x: Math.round((W - Math.min(maxW, textWidth(line, 1))) / 2), y: gearY + i * 7, maxW }, { color: C_DIM, shadow: true });
  });
  drawTextCentered(ctx, `${BUTTON_KEY.A.hint} DESCEND AGAIN`, { width: W, y: y + 26 }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM, shadow: true });
}

function renderEndingOverlay(g: Game, ending: Ending): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  dimScene(pc, 0.6);
  drawFrame(ctx, HEADLINE_BOX, { color: C_BORDER, thickness: 1 });
  drawTextCentered(ctx, ending.sub, { width: W, y: HEADLINE_BOX.y + 5 }, { color: ending.subColor, shadow: true });
  drawTextCentered(ctx, ending.headline, { width: W, y: HEADLINE_BOX.y + 14 }, { color: ending.color, scale: 2 });
  drawFrame(ctx, SUMMARY_BOX, { color: C_BORDER, thickness: 1 });
  drawEndingSummary(g, ctx);
}

function gameOverEnding(g: Game): Ending {
  if (!g.won) {return { headline: g.deathBiome, color: PICO8[8], sub: 'YOU DIED IN', subColor: C_DIM };}
  return { headline: `FELL AT DEPTH ${String(depthOf(g.n))}`, color: PICO8[8], sub: 'THE SERAPH FELL TO YOU', subColor: C_ACCENT };
}

function winEnding(g: Game): Ending {
  const depth = depthOf(g.n);
  const sub = depth > 1 ? `ASCENDED FROM DEPTH ${String(depth)}` : 'THE SERAPH IS UNMADE';
  return { headline: 'VICTORY', color: C_ACCENT, sub, subColor: C_DIM };
}

export const renderGameOverOverlay = (g: Game): void => { renderEndingOverlay(g, gameOverEnding(g)); };
export const renderWinOverlay = (g: Game): void => { renderEndingOverlay(g, winEnding(g)); };
