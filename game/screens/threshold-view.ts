import { BUTTON_KEY, PICO8, SAFE_MARGIN, dimScene, drawText, drawTextCentered, textWidth } from '../../engine';
import { depthOf, gloryBonus } from '../sim';
import { renderTableau } from '../backdrop';
import { armed } from '../state';
import type { Game, ThresholdChoice } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_FAINT, C_GOOD, C_SEL_BAR, C_TEXT, C_WARN, H, W } from '../theme';
import { blinkHz, drawCommandBand } from '../widgets';
import { drawCardFrame } from './card';
import { drawAbyssGate, drawGateGlow } from './threshold-gate';
import { THRESHOLD_ARM, THRESHOLD_CHOICES } from './threshold';

export interface Ink { text: string; color: string }

const SKY_CARD = { x: 24, y: 6, w: W - 48, h: 44 };
const TITLE_W = SKY_CARD.w - 12;
const LABEL_X = SAFE_MARGIN + 2;
const LABEL_W = 82;
const DETAIL_X = SAFE_MARGIN + LABEL_W + 8;
const LINE_PITCH = 9;
const TYPE_RATE = 30;
const C_RULE = PICO8[9];

type Ctx = CanvasRenderingContext2D;

export function drawSkyCard(ctx: Ctx, title: string, lines: readonly Ink[]): void {
  drawCardFrame(ctx, SKY_CARD);
  const scale = textWidth(title, 2) <= TITLE_W ? 2 : 1;
  drawTextCentered(ctx, title, { width: W, y: SKY_CARD.y + (scale === 2 ? 7 : 9) }, { color: C_ACCENT, scale, shadow: true });
  ctx.fillStyle = C_RULE; ctx.fillRect(W / 2 - 16, SKY_CARD.y + 20, 32, 1);
  lines.forEach((line, i) => {
    drawTextCentered(ctx, line.text, { width: W, y: SKY_CARD.y + 25 + i * 8 }, { color: line.color, shadow: true });
  });
}

export function drawDetail(ctx: Ctx, lines: readonly Ink[], x: number): void {
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x - 6, BAND_Y + 4, 1, H - BAND_Y - 8);
  const maxW = W - SAFE_MARGIN - x;
  lines.forEach((line, i) => {
    drawText(ctx, fitLine(line.text, maxW), { x, y: BAND_Y + 5 + i * LINE_PITCH }, { color: line.color, shadow: true });
  });
}

function fitLine(text: string, maxW: number): string {
  let t = text;
  while (t.length > 1 && textWidth(t, 1) > maxW) {t = t.slice(0, -1);}
  return t;
}

export const promptInk = (g: Game, ready: boolean, verb: string): Ink => ({
  text: ready ? `${BUTTON_KEY.A.hint} ${verb}` : '',
  color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM,
});

const BIG_ROW_Y: readonly number[] = [BAND_Y + 6, BAND_Y + 24];

function drawBigChoices(ctx: Ctx, cursor: number, ready: boolean): void {
  THRESHOLD_CHOICES.forEach((label, i) => {
    const y = BIG_ROW_Y[i] ?? BAND_Y;
    const sel = i === cursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(SAFE_MARGIN, y - 3, LABEL_W, 16); }
    const color = ready ? (sel ? C_ACCENT : C_TEXT) : C_FAINT;
    drawText(ctx, `${sel ? '> ' : '  '}${label}`, { x: LABEL_X, y }, { color, scale: 2, shadow: true });
  });
}

const NUDGE_SHOWN = 1.2;

export function choosePrompt(g: Game, refusedAt: number): Ink {
  const nudged = refusedAt >= 0 && g.clock - refusedAt < NUDGE_SHOWN;
  return nudged ? { text: 'CHOOSE: UP / DOWN', color: blinkHz(g.clock, 4) ? C_WARN : C_TEXT } : { text: 'UP/DOWN TO CHOOSE', color: C_ACCENT };
}

function unchosen(g: Game): Ink[] {
  const prompt = choosePrompt(g, g.threshold.refusedAt);
  return [
    { text: 'TWO PATHS - NO TURNING BACK', color: C_TEXT },
    { text: 'UP: ASCEND ENDS THE RUN', color: C_DIM },
    { text: 'DOWN: DESCEND GOES DEEPER', color: C_DIM },
    prompt,
  ];
}

function headline(depth: number): string {
  return depth <= 1 ? 'THE SERAPH IS NO MORE' : `DEPTH ${String(depth)} CONQUERED`;
}

function choiceLines(g: Game, choice: ThresholdChoice): Ink[] {
  const depth = depthOf(g.n);
  const bonus = gloryBonus(depth);
  if (choice === 'ASCEND') {
    return [
      { text: 'END THE RUN IN GLORY', color: C_TEXT },
      { text: `GLORY BONUS +${String(bonus)}`, color: C_GOOD },
      { text: `FINAL SCORE ${String(g.score + bonus)}`, color: C_ACCENT },
    ];
  }
  return [
    { text: `DEPTH ${String(depth + 1)} AWAITS - DEADLIER FOES`, color: C_TEXT },
    { text: 'FALL DOWN THERE AND YOU KEEP', color: C_WARN },
    { text: `${String(g.score)} + HALF OF WHAT YOU EARN`, color: C_WARN },
  ];
}

export function renderThreshold(g: Game): void {
  const { pc } = g.app;
  const { ctx } = pc;
  const t = g.threshold;
  const ready = armed(g, { openedAt: t.openedAt, delay: THRESHOLD_ARM });
  const shown = Math.floor((g.clock - t.openedAt) * TYPE_RATE);
  renderTableau(g, false);
  drawAbyssGate(ctx);
  dimScene(pc, 0.45);
  drawGateGlow(ctx, g.clock);
  const full = headline(depthOf(g.n));
  drawSkyCard(ctx, full.slice(0, Math.max(0, shown)), [
    { text: `YOUR WIN IS BANKED   SCORE ${String(g.score)}`, color: C_TEXT },
    { text: 'END IT HERE, OR GO DEEPER', color: C_DIM },
  ]);
  drawCommandBand(ctx);
  drawBigChoices(ctx, t.cursor, ready);
  const choice = THRESHOLD_CHOICES[t.cursor];
  const lines = choice ? [...choiceLines(g, choice), promptInk(g, ready, `CHOOSE ${choice}`)] : unchosen(g);
  drawDetail(ctx, lines, DETAIL_X);
}
