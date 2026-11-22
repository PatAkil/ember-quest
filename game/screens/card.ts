import { BUTTON_KEY, PICO8, dimScene, drawFrame, drawText, drawTextCentered, textWidth } from '../../engine';
import { renderTableau } from '../backdrop';
import { resetCursorEdge } from '../state';
import type { CardScreen, Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_SEL_BAR, C_TEXT, W } from '../theme';
import { blinkHz, fitText } from '../widgets';
import { drawIconIn, drawMedallion } from './plate';
import type { Rect } from './plate';

type CardArt = NonNullable<CardScreen['art']>;

const CARD: Rect = { x: 24, y: 6, w: W - 48, h: 50 };
const ICON_BOX = 40;
const ICON_PX = 4;
const ART_TEXT_X = CARD.x + 5 + ICON_BOX + 7;
const ART_TEXT_W = CARD.x + CARD.w - 7 - ART_TEXT_X;
const TITLE_W = CARD.w - 16;
const C_RULE = PICO8[9];

export function showCard(g: Game, lines: string[], onDone: () => void, art?: CardArt): void {
  g.card = art ? { lines, onDone, art } : { lines, onDone };
  g.subScene = 'CARD';
  resetCursorEdge(g);
}

export function updateCard(g: Game): void {
  if (g.app.input.pressed('A')) { g.app.audio.play('blip'); g.card.onDone(); }
}

function drawCardFrame(ctx: CanvasRenderingContext2D): void {
  drawFrame(ctx, CARD, { color: C_BORDER, thickness: 1 });
  drawFrame(ctx, { x: CARD.x + 2, y: CARD.y + 2, w: CARD.w - 4, h: CARD.h - 4 }, { color: C_SEL_BAR, thickness: 1 });
}

const promptColor = (g: Game): string => (blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM);
const promptText = (): string => `${BUTTON_KEY.A.hint} CONTINUE`;

function drawTextCard(g: Game, ctx: CanvasRenderingContext2D): void {
  const [title = '', ...body] = g.card.lines;
  const scale = textWidth(title, 2) <= TITLE_W ? 2 : 1;
  const titleY = CARD.y + (scale === 2 ? 8 : 11);
  drawTextCentered(ctx, title, { width: W, y: titleY }, { color: C_ACCENT, scale, shadow: true });
  ctx.fillStyle = C_RULE;
  ctx.fillRect(W / 2 - 16, CARD.y + 21, 32, 1);
  body.slice(0, 2).forEach((line, i) => {
    drawTextCentered(ctx, line, { width: W, y: CARD.y + 26 + i * 7 }, { color: C_TEXT, shadow: true });
  });
  drawTextCentered(ctx, promptText(), { width: W, y: CARD.y + CARD.h - 11 }, { color: promptColor(g) });
}

function drawArtCard(g: Game, ctx: CanvasRenderingContext2D, art: CardArt): void {
  const [kicker = '', name = '', detail = ''] = g.card.lines;
  const box = { x: CARD.x + 5, y: CARD.y + 5, w: ICON_BOX, h: ICON_BOX };
  drawMedallion(ctx, box, art.color);
  drawIconIn(ctx, art.icon, box, ICON_PX);
  drawText(ctx, kicker, { x: ART_TEXT_X, y: CARD.y + 7 }, { color: C_DIM, shadow: true });
  const scale = textWidth(name, 2) <= ART_TEXT_W ? 2 : 1;
  drawText(ctx, name, { x: ART_TEXT_X, y: CARD.y + 15 }, { color: art.color, scale, shadow: true });
  fitText(ctx, detail, { x: ART_TEXT_X, y: CARD.y + 29, maxW: ART_TEXT_W }, { color: C_TEXT, shadow: true });
  drawText(ctx, promptText(), { x: ART_TEXT_X, y: CARD.y + 39 }, { color: promptColor(g) });
}

export function renderCard(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  dimScene(pc, 0.6);
  drawCardFrame(pc.ctx);
  const art = g.card.art;
  if (art) {drawArtCard(g, pc.ctx, art);} else {drawTextCard(g, pc.ctx);}
}
