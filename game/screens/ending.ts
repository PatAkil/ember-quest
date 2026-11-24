import { BUTTON_KEY, PICO8, dimScene, drawText, drawTextCentered, textWidth } from '../../engine';
import { depthOf } from '../sim';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_TEXT, C_WARN, H, W } from '../theme';
import { blinkHz, drawCommandBand, wrap2 } from '../widgets';
import { drawCardFrame } from './card';
import { abandonRecap, deathRecap, winRecap } from './ending-recap';
import type { RecapLine } from './ending-recap';

const NAME_SEP = ' / ';

export function packNames(names: readonly string[], maxW: number): string[] {
  const lines: string[] = [];
  for (const name of names) {
    const last = lines[lines.length - 1];
    const joined = last === undefined ? name : `${last}${NAME_SEP}${name}`;
    if (last !== undefined && textWidth(joined, 1) <= maxW) {lines[lines.length - 1] = joined;} else {lines.push(name);}
  }
  return lines;
}

interface Ending { headline: string; color: string; sub: string; subColor: string; recap: RecapLine[]; prompt: string }

const HEADLINE_CARD = { x: 24, y: 4, w: W - 48, h: 30 };
const RECAP_CARD = { x: 12, y: 37, w: W - 24, h: 77 };
const RECAP_ROWS = 9;
const RECAP_PITCH = 8;
const RECAP_W = RECAP_CARD.w - 16;
const GEAR_ROWS = 2;
const SCORE_Y = 122;
const TALLY_Y = 135;
const PROMPT_Y = H - 13;

function fitted(text: string, maxW: number): string {
  let t = text;
  while (t.length > 3 && textWidth(t, 1) > maxW) {
    const cut = t.lastIndexOf(' ');
    t = cut > 0 ? t.slice(0, cut) : t.slice(0, -1);
  }
  return t;
}

function expand(line: RecapLine): RecapLine[] {
  if (line.wrap) {return wrap2(line.text, RECAP_W).map((text) => ({ text, color: line.color }));}
  if (!line.pack?.length) {return [line];}
  return packNames(line.pack, RECAP_W).slice(0, GEAR_ROWS).map((text) => ({ text, color: line.color }));
}

function trimmed(lines: RecapLine[]): RecapLine[] {
  const rows = [...lines];
  while (rows.length > RECAP_ROWS) {
    const dim = rows.findIndex((l) => l.color === C_DIM);
    rows.splice(dim >= 0 ? dim : rows.length - 2, 1);
  }
  return rows;
}

function drawRecap(ctx: CanvasRenderingContext2D, recap: RecapLine[]): void {
  drawCardFrame(ctx, RECAP_CARD);
  const rows = trimmed(recap.flatMap(expand));
  const top = RECAP_CARD.y + 4 + ((RECAP_ROWS - rows.length) * RECAP_PITCH) / 2;
  rows.forEach((row, i) => {
    const text = fitted(row.text, RECAP_W);
    const x = Math.round((W - textWidth(text, 1)) / 2);
    drawText(ctx, text, { x, y: Math.round(top + i * RECAP_PITCH) }, { color: row.color, shadow: true });
  });
}

function drawTally(g: Game, ending: Ending): void {
  const ctx = g.app.pc.ctx;
  drawCommandBand(ctx);
  drawTextCentered(ctx, `SCORE ${String(g.score)}`, { width: W, y: SCORE_Y }, { color: g.beatBest ? C_ACCENT : C_TEXT, scale: 2, shadow: true });
  const best = g.beatBest ? 'NEW BEST!' : `BEST ${String(g.best.score)}`;
  drawTextCentered(ctx, `${String(g.clears)} CLEARED   ${best}`, { width: W, y: TALLY_Y }, { color: g.beatBest ? C_ACCENT : C_DIM, shadow: true });
  const prompt = `${BUTTON_KEY.A.hint} ${ending.prompt}`;
  drawTextCentered(ctx, prompt, { width: W, y: PROMPT_Y }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM, shadow: true });
}

function renderEndingOverlay(g: Game, ending: Ending): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  dimScene(pc, 0.6);
  drawCardFrame(ctx, HEADLINE_CARD);
  drawTextCentered(ctx, ending.sub, { width: W, y: HEADLINE_CARD.y + 6 }, { color: ending.subColor, shadow: true });
  drawTextCentered(ctx, ending.headline, { width: W, y: HEADLINE_CARD.y + 15 }, { color: ending.color, scale: 2 });
  drawRecap(ctx, ending.recap);
  drawTally(g, ending);
}

function gameOverEnding(g: Game): Ending {
  if (g.abandoned) {
    return { headline: 'ABANDONED', color: C_WARN, sub: 'YOU WALKED AWAY FROM THE RUN', subColor: C_DIM, recap: abandonRecap(g), prompt: 'TRY AGAIN' };
  }
  const recap = deathRecap(g);
  if (!g.won) {return { headline: g.deathBiome, color: PICO8[8], sub: 'YOU DIED IN', subColor: C_DIM, recap, prompt: 'TRY AGAIN' };}
  return { headline: `FELL AT DEPTH ${String(depthOf(g.n))}`, color: PICO8[8], sub: 'THE SERAPH FELL TO YOU', subColor: C_ACCENT, recap, prompt: 'TRY AGAIN' };
}

function winEnding(g: Game): Ending {
  const depth = depthOf(g.n);
  const sub = depth > 1 ? `ASCENDED FROM DEPTH ${String(depth)}` : 'THE SERAPH IS UNMADE';
  return { headline: 'VICTORY', color: C_ACCENT, sub, subColor: C_DIM, recap: winRecap(g), prompt: 'PLAY AGAIN' };
}

export const renderGameOverOverlay = (g: Game): void => { renderEndingOverlay(g, gameOverEnding(g)); };
export const renderWinOverlay = (g: Game): void => { renderEndingOverlay(g, winEnding(g)); };
