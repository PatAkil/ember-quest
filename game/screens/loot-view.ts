import { PICO8, SAFE_MARGIN, drawPanel, drawSprite, drawText, drawTextCentered, textWidth } from '../../engine';
import type { Sprite } from '../../engine';
import { SPELLS } from '../data';
import type { LootOffer, LootSource } from '../types';
import { compareOffer, describeOffer, displayName, itemLevel } from '../sim';
import { ICON_SCROLL, ROOM_ART } from '../sprites';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_HP, C_PANEL, C_SEL_BAR, C_TEXT, W, rarityColor } from '../theme';
import { fitText, itemIcon } from '../widgets';
import { drawIconIn, drawMedallion } from './plate';

export const C_SCROLL = PICO8[12];
const X0 = SAFE_MARGIN;
const PW = W - 2 * SAFE_MARGIN;
const ROW_TOP = 14;
const ROW_PITCH = 10;
const ICON_X = X0 + 10;
const NAME_X = X0 + 21;
const MID_X = X0 + 98;
const TAG_RIGHT = X0 + PW - 5;
const CARD_BOX = 40;
const CARD_X = X0 + 6;
const CARD_TEXT_X = CARD_X + CARD_BOX + 6;
const CARD_TEXT_W = X0 + PW - 6 - CARD_TEXT_X;
const LINE = 7;

const TITLE: Record<LootSource, string> = {
  LOOT: 'A CHEST  TAKE ONE OR LEAVE IT',
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
  drawText(row.ctx, text, { x, y: row.y + 2 }, { color });
  return x;
}

function drawOfferRow(row: Row, face: OfferFace): void {
  drawSprite(row.ctx, face.icon, { x: ICON_X, y: row.y }, 1);
  drawText(row.ctx, face.name, { x: NAME_X, y: row.y + 2 }, { color: face.color, shadow: row.sel });
  const tagX = drawRight(row, face.tag, face.tagColor);
  fitText(row.ctx, face.hint, { x: MID_X, y: row.y + 2, maxW: tagX - 6 - MID_X }, { color: C_DIM });
}

function drawKeepRow(row: Row): void {
  drawText(row.ctx, 'KEEP YOUR GEAR', { x: NAME_X, y: row.y + 2 }, { color: row.sel ? C_ACCENT : C_TEXT, shadow: row.sel });
  drawRight(row, 'MEND 25% HP AND MP', C_DIM);
}

function blurbColor(offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {return C_SCROLL;}
  if (offer.kind === 'UPGRADE') {return C_ACCENT;}
  return offer.item.effect.kind === 'NONE' ? C_DIM : rarityColor(offer.item);
}

interface CardText { name: string; color: string; lines: { text: string; color: string }[] }

function drawItemCard(ctx: CanvasRenderingContext2D, y: number, art: { icon: Sprite; px: number }, text: CardText): void {
  const box = { x: CARD_X, y, w: CARD_BOX, h: CARD_BOX };
  drawMedallion(ctx, box, text.color);
  drawIconIn(ctx, art.icon, box, art.px);
  const scale = textWidth(text.name, 2) <= CARD_TEXT_W ? 2 : 1;
  drawText(ctx, text.name, { x: CARD_TEXT_X, y: y + 1 }, { color: text.color, scale, shadow: true });
  text.lines.forEach((line, i) => {
    fitText(ctx, line.text, { x: CARD_TEXT_X, y: y + 14 + i * LINE, maxW: CARD_TEXT_W }, { color: line.color });
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

function drawDetail(g: Game, ctx: CanvasRenderingContext2D, y: number): void {
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) {
    drawItemCard(ctx, y, { icon: ROOM_ART.REST.icon, px: 3 }, MEND_TEXT);
    return;
  }
  const face = offerFace(g, offer);
  drawItemCard(ctx, y, { icon: face.icon, px: 4 }, offerCardText(g, offer, face));
}

export function renderLoot(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false, false);
  const ctx = pc.ctx;
  const offers = g.loot.offers;
  const rows = offers.length + 1;
  const panelY = SAFE_MARGIN;
  const detailY = panelY + ROW_TOP + rows * ROW_PITCH + 4;
  drawPanel(pc, { x: X0, y: panelY, w: PW, h: detailY + CARD_BOX + 4 - panelY }, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(ctx, TITLE[g.loot.source], { width: W, y: panelY + 5 }, { color: C_ACCENT, shadow: true });
  for (let i = 0; i < rows; i++) {
    const row: Row = { ctx, y: panelY + ROW_TOP + i * ROW_PITCH, sel: i === g.loot.cursor };
    if (row.sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, row.y - 1, PW - 6, ROW_PITCH); }
    if (row.sel) {drawText(ctx, '>', { x: X0 + 5, y: row.y + 2 }, { color: C_ACCENT });}
    const offer = offers[i];
    if (offer) {drawOfferRow(row, offerFace(g, offer));} else {drawKeepRow(row);}
  }
  ctx.fillStyle = PICO8[5]; ctx.fillRect(X0 + 6, detailY - 3, PW - 12, 1);
  drawDetail(g, ctx, detailY);
}
