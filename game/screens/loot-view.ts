import { PICO8, SAFE_MARGIN, drawPanel, drawSprite, drawText, drawTextCentered, textWidth } from '../../engine';
import { SPELLS } from '../data';
import type { LootOffer, LootSource } from '../types';
import { compareOffer, describeOffer, displayName, itemLevel } from '../sim';
import { ICON_TOME } from '../sprites';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, W, rarityColor } from '../theme';
import { fitText, itemIcon } from '../widgets';

const X0 = 16;
const PW = W - 32;

const TITLE: Record<LootSource, string> = {
  LOOT: 'A CHEST  TAKE ONE OR LEAVE IT',
  FIGHT: 'IT DROPPED SOMETHING',
  BOSS: 'THE BOSS HOARD  CHOOSE ONE',
  ELITE: 'ELITE SPOILS  CHOOSE ONE',
};

interface Row { ctx: CanvasRenderingContext2D; y: number; sel: boolean }

const rightText = (row: Row, text: string, color: string): void => {
  drawText(row.ctx, text, { x: X0 + PW - 6 - textWidth(text, 1), y: row.y }, { color });
};

function drawOfferRow(g: Game, row: Row, offer: LootOffer): void {
  const { ctx, y, sel } = row;
  if (offer.kind === 'SCROLL') {
    drawSprite(ctx, ICON_TOME, { x: X0 + 14, y: y - 1 }, 1);
    drawText(ctx, `SCROLL OF ${SPELLS[offer.spell].name}`, { x: X0 + 22, y }, { color: PICO8[12], shadow: sel });
    drawText(ctx, 'LEARN A SPELL', { x: X0 + 88, y }, { color: C_DIM });
    rightText(row, 'SCROLL', PICO8[12]);
    return;
  }
  const item = offer.item;
  drawSprite(ctx, itemIcon(item), { x: X0 + 14, y: y - 1 }, 1);
  if (offer.kind === 'ITEM') {
    const owned = g.hero.equipment[item.slot];
    drawText(ctx, item.name, { x: X0 + 22, y }, { color: rarityColor(item), shadow: sel });
    drawText(ctx, owned ? `VS ${displayName(owned, itemLevel(g.hero, item.slot))}` : `${item.slot} SLOT`, { x: X0 + 88, y }, { color: C_DIM });
    rightText(row, item.rarity, rarityColor(item));
    return;
  }
  drawText(ctx, displayName(item, offer.toLevel), { x: X0 + 22, y }, { color: C_ACCENT, shadow: sel });
  drawText(ctx, offer.toLevel >= 2 ? 'AWAKEN YOUR GEAR' : 'IMPROVE YOUR GEAR', { x: X0 + 88, y }, { color: C_DIM });
  rightText(row, 'UPGRADE', C_ACCENT);
}

function drawKeepRow(row: Row): void {
  drawText(row.ctx, 'KEEP YOUR GEAR', { x: X0 + 12, y: row.y }, { color: row.sel ? C_ACCENT : C_TEXT, shadow: row.sel });
  rightText(row, 'MEND 25% HP AND MP', C_DIM);
}

function blurbColor(offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {return PICO8[12];}
  if (offer.kind === 'UPGRADE') {return C_ACCENT;}
  return offer.item.effect.kind === 'NONE' ? C_DIM : rarityColor(offer.item);
}

function drawDetail(g: Game, ctx: CanvasRenderingContext2D, dy: number): void {
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) {
    drawText(ctx, 'NOTHING HERE FITS YOUR BUILD?', { x: X0 + 6, y: dy }, { color: C_DIM });
    drawText(ctx, 'TAKE THE MEND AND MOVE ON.', { x: X0 + 6, y: dy + 8 }, { color: C_DIM });
    return;
  }
  const lines = describeOffer(g.hero, offer);
  fitText(ctx, lines[0] ?? '', { x: X0 + 6, y: dy, maxW: PW - 12 }, { color: C_TEXT });
  fitText(ctx, lines[1] ?? '', { x: X0 + 6, y: dy + 8, maxW: PW - 12 }, { color: blurbColor(offer) });
  fitText(ctx, compareOffer(g.hero, offer), { x: X0 + 6, y: dy + 16, maxW: PW - 12 }, { color: C_DIM });
}

export function renderLoot(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false, false);
  const ctx = pc.ctx;
  const offers = g.loot.offers;
  const n = offers.length;
  const panelY = SAFE_MARGIN;
  const panelH = 14 + (n + 1) * 8 + 4 + 26;
  drawPanel(pc, { x: X0, y: panelY, w: PW, h: panelH }, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(ctx, TITLE[g.loot.source], { width: W, y: panelY + 5 }, { color: C_ACCENT, shadow: true });
  for (let i = 0; i <= n; i++) {
    const row: Row = { ctx, y: panelY + 14 + i * 8, sel: i === g.loot.cursor };
    if (row.sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(X0 + 3, row.y - 2, PW - 6, 9); }
    drawText(ctx, row.sel ? '>' : ' ', { x: X0 + 6, y: row.y }, { color: C_ACCENT });
    const offer = offers[i];
    if (offer) {drawOfferRow(g, row, offer);} else {drawKeepRow(row);}
  }
  const dy = panelY + 14 + (n + 1) * 8 + 4;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(X0 + 6, dy - 3, PW - 12, 1);
  drawDetail(g, ctx, dy);
}
