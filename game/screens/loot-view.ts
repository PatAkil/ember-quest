import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import type { Sprite } from '../../engine';
import { SPELLS } from '../data';
import type { LootOffer, LootSource } from '../types';
import { awakenPreview, compareOffer, describeOffer, displayName, itemLevel, packSize } from '../sim';
import { ICON_SCROLL, ROOM_ART } from '../sprites';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_HP, C_PANEL, C_SCROLL, C_SEL_BAR, C_TEXT, C_WARN, HERO_W, HERO_X, W, rarityColor } from '../theme';
import { blinkHz, drawCommandBand, fitText, itemIcon } from '../widgets';
import { drawCompare, drawItemCard } from './compare-view';
import type { CardLine, CardText } from './compare-view';
import { choosesStow } from './loot';

const X0 = HERO_X + HERO_W / 2 + 12;
const PW = W - SAFE_MARGIN - X0;
const ROW_TOP = 15;
const ROW_PITCH = 15;
const ICON_X = X0 + 8;
const NAME_X = X0 + 19;
const TAG_RIGHT = X0 + PW - 5;

const TITLE: Record<LootSource, string> = {
  LOOT: 'A CHEST  TAKE ONE OR LEAVE',
  FIGHT: 'IT DROPPED SOMETHING',
  BOSS: 'THE BOSS HOARD  CHOOSE ONE',
  ELITE: 'ELITE SPOILS  CHOOSE ONE',
};
const GIFT_TITLE = 'A GIFT  TAKE IT OR LEAVE IT';
const ASH_TITLE = 'THE ASHES  UPGRADE OR LEAVE';
function lootTitle(g: Game): string {
  if (g.loot.ash) {return ASH_TITLE;}
  return g.loot.gift ? GIFT_TITLE : TITLE[g.loot.source];
}

interface OfferFace { icon: Sprite; name: string; color: string; hint: string; tag: string; tagColor: string }

function itemFace(g: Game, offer: Extract<LootOffer, { kind: 'ITEM' }>): OfferFace {
  const item = offer.item;
  const owned = g.hero.equipment[item.slot];
  const hint = owned ? displayName(owned, itemLevel(g.hero, item.slot)) : 'EMPTY SLOT';
  return { icon: itemIcon(item), name: item.name, color: rarityColor(item), hint, tag: item.rarity, tagColor: rarityColor(item) };
}

function offerFace(g: Game, offer: LootOffer): OfferFace {
  if (offer.kind === 'SCROLL') {
    return { icon: ICON_SCROLL, name: `SCROLL OF ${SPELLS[offer.spell].name}`, color: C_SCROLL, hint: 'LEARN A SPELL', tag: 'SCROLL', tagColor: C_SCROLL };
  }
  if (offer.kind === 'ITEM') {return itemFace(g, offer);}
  if (offer.kind === 'UPGRADE_ANY') {
    return { icon: ROOM_ART.LOOT.icon, name: 'UPGRADE', color: C_ACCENT, hint: 'CHOOSE AN ITEM', tag: '+1 LEVEL', tagColor: C_ACCENT };
  }
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

function drawKeepRow(row: Row, ash: boolean): void {
  drawText(row.ctx, ash ? 'LEAVE THE ASHES' : 'KEEP YOUR GEAR', { x: NAME_X, y: row.y + 1 }, { color: row.sel ? C_ACCENT : C_TEXT, shadow: row.sel });
  drawText(row.ctx, ash ? 'YOU HAVE RESTED ALREADY' : 'MEND 25% HP AND MP', { x: NAME_X, y: row.y + 8 }, { color: C_DIM });
}

function blurbColor(offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {return C_SCROLL;}
  if (offer.kind === 'UPGRADE' || offer.kind === 'UPGRADE_ANY') {return C_ACCENT;}
  return offer.item.effect.kind === 'NONE' ? C_DIM : rarityColor(offer.item);
}

function packLine(g: Game): CardLine {
  const { pack } = g.hero;
  const size = packSize(g.hero);
  if (pack.length >= size) {return { text: 'PACK FULL: YOU WILL DROP ONE', color: C_WARN };}
  return { text: `GOES TO YOUR PACK  ${String(pack.length + 1)}/${String(size)}`, color: C_DIM };
}

function offerCardText(g: Game, offer: LootOffer, face: OfferFace): CardText {
  const awaken = offer.kind === 'ITEM' || offer.kind === 'UPGRADE' ? awakenPreview(offer.item, offer.kind === 'UPGRADE' ? offer.toLevel : 0) : '';
  const said = describeOffer(g.hero, offer);
  const last = said.filter((text) => text !== awaken).length - 1;
  const lines = said.map((text, i) => ({ text, color: awaken && text === awaken ? C_DIM : i === last ? blurbColor(offer) : C_TEXT }));
  const tail = g.loot.stow && choosesStow(g, offer) ? packLine(g) : { text: compareOffer(g.hero, offer), color: C_DIM };
  return { name: face.name, color: face.color, lines: [...lines, tail] };
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

const ASH_TEXT: CardText = {
  name: 'LEAVE',
  color: C_DIM,
  lines: [
    { text: 'THE CAMPFIRE HAS DONE ITS WORK.', color: C_TEXT },
    { text: 'WALK ON WITHOUT AN UPGRADE.', color: C_DIM },
  ],
};

function drawDetail(g: Game, ctx: CanvasRenderingContext2D): void {
  drawCommandBand(ctx);
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) {
    drawItemCard(ctx, { icon: ROOM_ART.REST.icon, px: 2 }, g.loot.ash ? ASH_TEXT : MEND_TEXT);
    return;
  }
  if (offer.kind === 'ITEM' && choosesStow(g, offer) && !g.loot.stow) {
    drawCompare(ctx, g.hero, { item: offer.item, level: 0 }, g.clock);
    return;
  }
  const face = offerFace(g, offer);
  drawItemCard(ctx, { icon: face.icon, px: 3 }, offerCardText(g, offer, face));
}

const panelCentre = (text: string): number => Math.round(X0 + (PW - textWidth(text, 1)) / 2);

function promptWord(g: Game): string {
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) {return g.loot.ash ? 'LEAVE' : 'KEEP YOUR GEAR';}
  if (!choosesStow(g, offer)) {return 'TAKE IT';}
  return g.loot.stow ? 'STOW' : 'EQUIP';
}

const TOGGLE_HINT = '< > EQUIP OR STOW';
const TOGGLE_GAP = 8;

function drawPrompt(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  const text = `${BUTTON_KEY.A.hint} ${promptWord(g)}`;
  const toggle = choosesStow(g, g.loot.offers[g.loot.cursor]);
  const full = toggle ? textWidth(text, 1) + TOGGLE_GAP + textWidth(TOGGLE_HINT, 1) : textWidth(text, 1);
  const x = Math.round(X0 + (PW - full) / 2);
  drawText(ctx, text, { x, y }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM });
  if (toggle) {drawText(ctx, TOGGLE_HINT, { x: x + full - textWidth(TOGGLE_HINT, 1), y }, { color: C_ACCENT });}
}

export function renderLoot(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  const ctx = pc.ctx;
  const rows = g.loot.offers.length + 1;
  const panelY = SAFE_MARGIN;
  const promptY = panelY + ROW_TOP + rows * ROW_PITCH + 2;
  drawPanel(pc, { x: X0, y: panelY, w: PW, h: promptY + 9 - panelY }, { color: C_PANEL, border: C_BORDER });
  const title = lootTitle(g);
  drawText(ctx, title, { x: panelCentre(title), y: panelY + 5 }, { color: C_ACCENT, shadow: true });
  for (let i = 0; i < rows; i++) {
    const row: Row = { ctx, y: panelY + ROW_TOP + i * ROW_PITCH, sel: i === g.loot.cursor };
    if (row.sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, row.y - 1, PW - 6, ROW_PITCH - 1); }
    if (row.sel) {drawText(ctx, '>', { x: X0 + 4, y: row.y + 1 }, { color: C_ACCENT });}
    const offer = g.loot.offers[i];
    if (offer) {drawOfferRow(row, offerFace(g, offer));} else {drawKeepRow(row, g.loot.ash === true);}
  }
  drawPrompt(g, promptY);
  drawDetail(g, ctx);
}
