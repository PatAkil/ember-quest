import { BUTTON_KEY, PICO8, SAFE_MARGIN, dimScene, drawFrame, drawText, drawTextCentered, textWidth } from '../../engine';
import { renderTableau } from '../backdrop';
import { resetCursorEdge } from '../state';
import type { CardScreen, Game } from '../state';
import { BAND_Y, C_ACCENT, C_BG, C_BORDER, C_DIM, C_SEL_BAR, C_TEXT, H, W } from '../theme';
import { blinkHz, drawCommandBand } from '../widgets';
import { drawIconIn, drawMedallion } from './plate';
import type { Rect } from './plate';

type CardArt = NonNullable<CardScreen['art']>;

const ART_CARD: Rect = { x: 24, y: 6, w: W - 48, h: 50 };
const TEXT_CARD: Rect = { ...ART_CARD, h: 30 };
const ICON_BOX = 40;
const ICON_PX = 4;
const ART_TEXT_X = ART_CARD.x + 5 + ICON_BOX + 7;
const ART_TEXT_W = ART_CARD.x + ART_CARD.w - 7 - ART_TEXT_X;
const TITLE_W = TEXT_CARD.w - 16;
const BAND_TEXT_W = W - 2 * SAFE_MARGIN - 8;
const PROMPT_Y = H - SAFE_MARGIN - 5;
const C_RULE = PICO8[9];

export function showCard(g: Game, lines: string[], onDone: () => void, art?: CardArt): void {
  g.card = art ? { lines, onDone, art } : { lines, onDone };
  g.subScene = 'CARD';
  resetCursorEdge(g);
}

export function updateCard(g: Game): void {
  if (g.app.input.pressed('A')) { g.app.audio.play('blip'); g.card.onDone(); }
}

function drawCardFrame(ctx: CanvasRenderingContext2D, card: Rect): void {
  ctx.fillStyle = C_BG; ctx.fillRect(card.x, card.y, card.w, card.h);
  drawFrame(ctx, card, { color: C_BORDER, thickness: 1 });
  drawFrame(ctx, { x: card.x + 2, y: card.y + 2, w: card.w - 4, h: card.h - 4 }, { color: C_SEL_BAR, thickness: 1 });
}

const promptColor = (g: Game): string => (blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM);
const promptText = (): string => `${BUTTON_KEY.A.hint} CONTINUE`;

function bandScale(lines: readonly string[]): number {
  return lines.every((l) => textWidth(l, 2) <= BAND_TEXT_W) ? 2 : 1;
}

function drawCardBand(g: Game, ctx: CanvasRenderingContext2D, lines: readonly string[]): void {
  drawCommandBand(ctx);
  const body = lines.filter(Boolean).slice(0, 2);
  const scale = bandScale(body);
  const lineH = 5 * scale + 3;
  const room = PROMPT_Y - 3 - (BAND_Y + 1);
  const top = BAND_Y + 1 + Math.round((room - (body.length * lineH - 3)) / 2);
  body.forEach((line, i) => {
    drawTextCentered(ctx, line, { width: W, y: top + i * lineH }, { color: C_TEXT, scale, shadow: true });
  });
  drawTextCentered(ctx, promptText(), { width: W, y: PROMPT_Y }, { color: promptColor(g), shadow: true });
}

function drawTextCard(g: Game, ctx: CanvasRenderingContext2D): void {
  const [title = '', ...body] = g.card.lines;
  drawCardFrame(ctx, TEXT_CARD);
  const scale = textWidth(title, 2) <= TITLE_W ? 2 : 1;
  const titleY = TEXT_CARD.y + (scale === 2 ? 8 : 11);
  drawTextCentered(ctx, title, { width: W, y: titleY }, { color: C_ACCENT, scale, shadow: true });
  ctx.fillStyle = C_RULE;
  ctx.fillRect(W / 2 - 16, TEXT_CARD.y + 22, 32, 1);
  drawCardBand(g, ctx, body);
}

function drawArtCard(g: Game, ctx: CanvasRenderingContext2D, art: CardArt): void {
  const [kicker = '', name = '', detail = ''] = g.card.lines;
  drawCardFrame(ctx, ART_CARD);
  const box = { x: ART_CARD.x + 5, y: ART_CARD.y + 5, w: ICON_BOX, h: ICON_BOX };
  drawMedallion(ctx, box, art.color);
  drawIconIn(ctx, art.icon, box, ICON_PX);
  drawText(ctx, kicker, { x: ART_TEXT_X, y: ART_CARD.y + 12 }, { color: C_DIM, shadow: true });
  const scale = textWidth(name, 2) <= ART_TEXT_W ? 2 : 1;
  drawText(ctx, name, { x: ART_TEXT_X, y: ART_CARD.y + 22 }, { color: art.color, scale, shadow: true });
  drawCardBand(g, ctx, [detail]);
}

export function renderCard(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  dimScene(pc, 0.6);
  const art = g.card.art;
  if (art) {drawArtCard(g, pc.ctx, art);} else {drawTextCard(g, pc.ctx);}
}
