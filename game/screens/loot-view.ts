import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import type { Sprite } from '../../engine';
import { SPELLS } from '../data';
import type { LootOffer, LootSource } from '../types';
import { compareOffer, describeOffer, displayName, itemLevel } from '../sim';
import { ICON_SCROLL, ROOM_ART } from '../sprites';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_HP, C_PANEL, C_SCROLL, C_SEL_BAR, C_TEXT, HERO_W, HERO_X, W, rarityColor } from '../theme';
import { blinkHz, drawCommandBand, fitText, itemIcon } from '../widgets';
import { drawIconIn, drawMedallion } from './plate';

const X0 = HERO_X + HERO_W / 2 + 12;
const PW = W - SAFE_MARGIN - X0;
const ROW_TOP = 15;
const ROW_PITCH = 16;
const ICON_X = X0 + 8;
const NAME_X = X0 + 19;
const TAG_RIGHT = X0 + PW - 5;
const CARD_BOX = 34;
const CARD_X = SAFE_MARGIN;
const CARD_Y = BAND_Y + 5;
const CARD_TEXT_X = CARD_X + CARD_BOX + 6;
const CARD_TEXT_W = W - SAFE_MARGIN - 2 - CARD_TEXT_X;
const LINE = 7;

const TITLE: Record<LootSource, string> = {
  LOOT: 'A CHEST  TAKE ONE OR LEAVE',
  FIGHT: 'IT DROPPED SOMETHING',
  BOSS: 'THE BOSS HOARD  CHOOSE ONE',
  ELITE: 'ELITE SPOILS  CHOOSE ONE',
};

interface OfferFace { icon: Sprite; name: string; color: string; hint: string; tag: string; tagColor: string }

function itemFace(g: Game, offer: Extract<LootOffer, { kind: 'ITEM' }>): OfferFace {
  const item = offer.item;
  const owned = g.hero.equipment[item.slot];
  const hint = owned ? `VS ${displayName(owned, itemLevel(g.hero, item.slot))}` : `EMPTY ${item.slot} SLOT`;
  return { icon: itemIcon(item), name: item.name, color: rarityColor(item), hint, tag: item.rarity, tagColor: rarityColor(item) };
}

function offerFace(g: Game, offer: LootOffer): OfferFace {
  if (offer.kind === 'SCROLL') {
    return { icon: ICON_SCROLL, name: `SCROLL OF ${SPELLS[offer.spell].name}`, color: C_SCROLL, hint: 'LEARN A SPELL', tag: 'SCROLL', tagColor: C_SCROLL };
  }
  if (offer.kind === 'ITEM') {return itemFace(g, offer);}
  const hint = offer.toLevel >= 2 ? 'AWAKEN YOUR GEAR' : 'IMPROVE YOUR GEAR';
  return { icon: itemIcon(offer.item), name: displayName(offer.item, offer.toLevel), color: rarityColor(offer.item), hint, tag: 'UPGRADE', tagColor: C_ACCENT };
}

interface Row { ctx: CanvasRenderingContext2D; y: number; sel: boolean }

function drawRight(row: Row, text: string, color: string): number {
  const x = TAG_RIGHT - textWidth(text, 1);
  drawText(row.ctx, text, { x, y: row.y + 8 }, { color });
  return x;
}

function drawOfferRow(row: Row, face: OfferFace): void {
  drawSprite(row.ctx, face.icon, { x: ICON_X, y: row.y + 1 }, 1);
  fitText(row.ctx, face.name, { x: NAME_X, y: row.y + 1, maxW: TAG_RIGHT - NAME_X }, { color: face.color, shadow: row.sel });
  const tagX = drawRight(row, face.tag, face.tagColor);
  fitText(row.ctx, face.hint, { x: NAME_X, y: row.y + 8, maxW: tagX - 4 - NAME_X }, { color: C_DIM });
}

function drawKeepRow(row: Row): void {
  drawText(row.ctx, 'KEEP YOUR GEAR', { x: NAME_X, y: row.y + 1 }, { color: row.sel ? C_ACCENT : C_TEXT, shadow: row.sel });
  drawText(row.ctx, 'MEND 25% HP AND MP', { x: NAME_X, y: row.y + 8 }, { color: C_DIM });
}

function blurbColor(offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {return C_SCROLL;}
  if (offer.kind === 'UPGRADE') {return C_ACCENT;}
  return offer.item.effect.kind === 'NONE' ? C_DIM : rarityColor(offer.item);
}

interface CardLine { text: string; color: string }
interface CardText { name: string; color: string; lines: CardLine[] }

function mergeStats(lines: CardLine[]): CardLine[] {
  const [a, b, ...rest] = lines;
  if (!a || !b || lines.length <= 3 || a.color !== b.color) {return lines;}
  const joined = `${a.text}  ${b.text}`;
  return textWidth(joined, 1) <= CARD_TEXT_W ? [{ text: joined, color: a.color }, ...rest] : lines;
}

function drawItemCard(ctx: CanvasRenderingContext2D, art: { icon: Sprite; px: number }, text: CardText): void {
  const box = { x: CARD_X, y: CARD_Y, w: CARD_BOX, h: CARD_BOX };
  drawMedallion(ctx, box, text.color);
  drawIconIn(ctx, art.icon, box, art.px);
  const lines = mergeStats(text.lines);
  const big = lines.length <= 3 && textWidth(text.name, 2) <= CARD_TEXT_W;
  const top = CARD_Y - 1;
  drawText(ctx, text.name, { x: CARD_TEXT_X, y: top }, { color: text.color, scale: big ? 2 : 1, shadow: true });
  const first = top + (big ? 13 : 8);
  lines.slice(0, 4).forEach((line, i) => {
    fitText(ctx, line.text, { x: CARD_TEXT_X, y: first + i * LINE, maxW: CARD_TEXT_W }, { color: line.color });
  });
}

function offerCardText(g: Game, offer: LootOffer, face: OfferFace): CardText {
  const said = describeOffer(g.hero, offer);
  const last = said.length - 1;
  const lines = said.map((text, i) => ({ text, color: i === last ? blurbColor(offer) : C_TEXT }));
  return { name: face.name, color: face.color, lines: [...lines, { text: compareOffer(g.hero, offer), color: C_DIM }] };
}

const MEND_TEXT: CardText = {
  name: 'MEND',
  color: C_HP,
  lines: [
    { text: 'NOTHING HERE FITS YOUR BUILD?', color: C_TEXT },
    { text: 'KEEP WHAT YOU WEAR AND HEAL', color: C_DIM },
    { text: '25% OF YOUR HP AND MP.', color: C_DIM },
  ],
};

function drawDetail(g: Game, ctx: CanvasRenderingContext2D): void {
  drawCommandBand(ctx);
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) {
    drawItemCard(ctx, { icon: ROOM_ART.REST.icon, px: 2 }, MEND_TEXT);
    return;
  }
  const face = offerFace(g, offer);
  drawItemCard(ctx, { icon: face.icon, px: 3 }, offerCardText(g, offer, face));
}

const panelCentre = (text: string): number => Math.round(X0 + (PW - textWidth(text, 1)) / 2);

function drawPrompt(g: Game, y: number): void {
  const take = g.loot.offers[g.loot.cursor] ? 'TAKE IT' : 'KEEP YOUR GEAR';
  const text = `${BUTTON_KEY.A.hint} ${take}`;
  drawText(g.app.pc.ctx, text, { x: panelCentre(text), y }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM });
}

export function renderLoot(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  const ctx = pc.ctx;
  const rows = g.loot.offers.length + 1;
  const panelY = SAFE_MARGIN;
  const promptY = panelY + ROW_TOP + rows * ROW_PITCH + 2;
  drawPanel(pc, { x: X0, y: panelY, w: PW, h: promptY + 9 - panelY }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, TITLE[g.loot.source], { x: panelCentre(TITLE[g.loot.source]), y: panelY + 5 }, { color: C_ACCENT, shadow: true });
  for (let i = 0; i < rows; i++) {
    const row: Row = { ctx, y: panelY + ROW_TOP + i * ROW_PITCH, sel: i === g.loot.cursor };
    if (row.sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, row.y - 2, PW - 6, ROW_PITCH - 1); }
    if (row.sel) {drawText(ctx, '>', { x: X0 + 4, y: row.y + 1 }, { color: C_ACCENT });}
    const offer = g.loot.offers[i];
    if (offer) {drawOfferRow(row, offerFace(g, offer));} else {drawKeepRow(row);}
  }
  drawPrompt(g, promptY);
  drawDetail(g, ctx);
}
