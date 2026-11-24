import { BUTTON_KEY, PICO8, SAFE_MARGIN, drawFrame, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import { SLOTS, type OwnedItem, type Slot } from '../types';
import { describeItem, displayName, effectiveBlurb, effectiveEffect, packSize } from '../sim';
import { renderBiomeBackdrop } from '../backdrop';
import { ICON_EMPTY } from '../sprites';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_FAINT, C_PANEL, C_SEL_BAR, C_TEXT, C_WARN, W, rarityColor } from '../theme';
import { blinkHz, drawCommandBand, fitText, itemIcon } from '../widgets';
import { drawCompare, drawItemCard } from './compare-view';
import type { CardText } from './compare-view';
import { packedAt, refusalShowing, wornAt } from './gear';

const COL_W = (W - 2 * SAFE_MARGIN) / 2;
const PANEL_Y = 16;
const HEAD_Y = PANEL_Y + 5;
const ROWS_Y = PANEL_Y + 14;
const PITCH = 14;
const PANEL_H = ROWS_Y - PANEL_Y + SLOTS.length * PITCH;
const ICON_DX = 5;
const NAME_DX = 17;

const columnX = (pack: boolean): number => SAFE_MARGIN + (pack ? COL_W : 0);
const rowY = (i: number): number => ROWS_Y + i * PITCH;
const TITLE_Y = SAFE_MARGIN;
const C_RULE = PICO8[5];

interface Cell { ctx: CanvasRenderingContext2D; pack: boolean; row: number; sel: boolean }

function drawCellBar(cell: Cell): void {
  if (!cell.sel) {return;}
  const x = columnX(cell.pack);
  cell.ctx.fillStyle = C_SEL_BAR;
  cell.ctx.fillRect(x + 2, rowY(cell.row), COL_W - 4, PITCH - 1);
}

function drawCell(cell: Cell, owned: OwnedItem | undefined, empty: string): void {
  drawCellBar(cell);
  const x = columnX(cell.pack);
  const y = rowY(cell.row);
  const textY = y + 4;
  if (!owned) {
    drawSprite(cell.ctx, ICON_EMPTY, { x: x + ICON_DX, y: y + 2 }, 1);
    drawText(cell.ctx, empty, { x: x + NAME_DX, y: textY }, { color: C_FAINT });
    return;
  }
  drawSprite(cell.ctx, itemIcon(owned.item), { x: x + ICON_DX, y: y + 2 }, 1);
  const name = displayName(owned.item, owned.level);
  fitText(cell.ctx, name, { x: x + NAME_DX, y: textY, maxW: COL_W - NAME_DX - 4 }, { color: rarityColor(owned.item), shadow: cell.sel });
}

function markTargetSlot(g: Game, ctx: CanvasRenderingContext2D): void {
  const packed = packedAt(g, g.gear.cursor);
  if (!packed) {return;}
  const row = SLOTS.indexOf(packed.item.slot);
  drawFrame(ctx, { x: columnX(false) + 2, y: rowY(row), w: COL_W - 4, h: PITCH - 1 }, { color: C_DIM, thickness: 1 });
}

function packHeader(g: Game): { text: string; color: string } {
  if (refusalShowing(g)) {return { text: 'PACK FULL', color: blinkHz(g.clock, 4) ? C_WARN : C_TEXT };}
  return { text: `PACK ${String(g.hero.pack.length)}/${String(packSize(g.hero))}`, color: C_ACCENT };
}

function drawColumns(g: Game, ctx: CanvasRenderingContext2D): void {
  drawPanel(g.app.pc, { x: SAFE_MARGIN, y: PANEL_Y, w: W - 2 * SAFE_MARGIN, h: PANEL_H }, { color: C_PANEL, border: C_BORDER });
  ctx.fillStyle = C_RULE;
  ctx.fillRect(columnX(true), PANEL_Y + 4, 1, PANEL_H - 8);
  drawText(ctx, 'WORN', { x: columnX(false) + ICON_DX, y: HEAD_Y }, { color: C_ACCENT, shadow: true });
  const head = packHeader(g);
  drawText(ctx, head.text, { x: columnX(true) + ICON_DX, y: HEAD_Y }, { color: head.color, shadow: true });
  markTargetSlot(g, ctx);
  SLOTS.forEach((slot, i) => {
    drawCell({ ctx, pack: false, row: i, sel: g.gear.cursor === i }, wornAt(g, i), `NO ${slot}`);
  });
  for (let j = 0; j < packSize(g.hero); j++) {
    drawCell({ ctx, pack: true, row: j, sel: g.gear.cursor === SLOTS.length + j }, g.hero.pack[j], 'EMPTY');
  }
}

function ownCard(owned: OwnedItem): CardText {
  const { item, level } = owned;
  const blurbColor = effectiveEffect(item, level).kind === 'NONE' ? C_DIM : rarityColor(item);
  return {
    name: displayName(item, level),
    color: rarityColor(item),
    lines: [
      ...describeItem(item, level).map((text) => ({ text, color: C_TEXT })),
      { text: effectiveBlurb(item, level), color: blurbColor },
      { text: 'WORN NOW', color: C_DIM },
    ],
  };
}

function emptyCard(g: Game, slot: Slot): CardText {
  const spare = g.hero.pack.filter((o) => o.item.slot === slot).length;
  const hint = spare > 1 ? `${String(spare)} ITEMS IN YOUR PACK FIT` : spare ? 'ONE ITEM IN YOUR PACK FITS' : 'NOTHING IN YOUR PACK FITS';
  return { name: `NO ${slot}`, color: C_FAINT, lines: [{ text: 'THIS SLOT IS EMPTY', color: C_DIM }, { text: hint, color: C_DIM }] };
}

function drawBand(g: Game, ctx: CanvasRenderingContext2D): void {
  drawCommandBand(ctx);
  const { cursor } = g.gear;
  const packed = packedAt(g, cursor);
  if (packed) { drawCompare(ctx, g.hero, packed); return; }
  const worn = wornAt(g, cursor);
  if (worn) { drawItemCard(ctx, { icon: itemIcon(worn.item), px: 3 }, ownCard(worn)); return; }
  const slot = SLOTS[cursor];
  if (slot) {drawItemCard(ctx, { icon: ICON_EMPTY, px: 2 }, emptyCard(g, slot));}
}

function actionHint(g: Game): string {
  const { cursor } = g.gear;
  if (packedAt(g, cursor)) {return `${BUTTON_KEY.A.hint} WEAR IT`;}
  if (wornAt(g, cursor)) {return `${BUTTON_KEY.A.hint} TO PACK`;}
  return '';
}

function drawHeader(g: Game, ctx: CanvasRenderingContext2D): void {
  drawText(ctx, 'GEAR', { x: SAFE_MARGIN, y: TITLE_Y }, { color: C_ACCENT, shadow: true });
  const act = actionHint(g);
  const back = `${BUTTON_KEY.B.hint} BACK`;
  const hint = act ? `${act}   ${back}` : back;
  drawText(ctx, hint, { x: W - SAFE_MARGIN - textWidth(hint, 1), y: TITLE_Y }, { color: C_DIM, shadow: true });
}

export function renderGear(g: Game): void {
  const { pc, particles } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g, 0.45);
  particles.render(ctx);
  drawHeader(g, ctx);
  drawColumns(g, ctx);
  drawBand(g, ctx);
}
