import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawSprite, drawText, drawTextCentered } from '../../engine';
import { SLOTS, type Item, type OwnedItem } from '../types';
import { compareFull, describeItem, displayName, effectiveBlurb, itemLevel, packSize } from '../sim';
import { renderBiomeBackdrop } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_HP, C_HP_LOW, C_PANEL, C_SEL_BAR, C_TEXT, W, rarityColor } from '../theme';
import { drawCommandBand, fitText, itemIcon } from '../widgets';

const COL_W = 110;
const LEFT_X = SAFE_MARGIN;
const RIGHT_X = W - SAFE_MARGIN - COL_W;
const TOP = 26;
const PITCH = 14;
const LINE = 7;
const BAND_X = SAFE_MARGIN;
const BAND_W = W - 2 * SAFE_MARGIN;

interface Cell { ctx: CanvasRenderingContext2D; x: number; y: number; sel: boolean }

function drawCell(cell: Cell, owned: OwnedItem | undefined, empty: string): void {
  const { ctx, x, y, sel } = cell;
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x + 2, y - 2, COL_W - 4, PITCH - 1); }
  if (!owned) {
    drawText(ctx, empty, { x: x + 16, y: y + 2 }, { color: C_DIM });
    return;
  }
  drawSprite(ctx, itemIcon(owned.item), { x: x + 4, y: y - 1 }, 1);
  fitText(ctx, displayName(owned.item, owned.level), { x: x + 16, y: y + 2, maxW: COL_W - 20 }, { color: rarityColor(owned.item), shadow: sel });
}

function wornAt(g: Game, i: number): OwnedItem | undefined {
  const slot = SLOTS[i];
  const item = slot ? g.hero.equipment[slot] : undefined;
  return slot && item ? { item, level: itemLevel(g.hero, slot) } : undefined;
}

function drawColumns(g: Game, ctx: CanvasRenderingContext2D): void {
  const box = { y: TOP - 14, w: COL_W, h: SLOTS.length * PITCH + 16 };
  drawPanel(g.app.pc, { x: LEFT_X, ...box }, { color: C_PANEL, border: C_BORDER });
  drawPanel(g.app.pc, { x: RIGHT_X, ...box }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, 'WORN', { x: LEFT_X + 5, y: TOP - 10 }, { color: C_ACCENT, shadow: true });
  drawText(ctx, `PACK ${String(g.hero.pack.length)}/${String(packSize(g.hero))}`, { x: RIGHT_X + 5, y: TOP - 10 }, { color: C_ACCENT, shadow: true });
  SLOTS.forEach((slot, i) => {
    drawCell({ ctx, x: LEFT_X, y: TOP + i * PITCH, sel: g.gear.cursor === i }, wornAt(g, i), `EMPTY ${slot}`);
  });
  for (let j = 0; j < packSize(g.hero); j++) {
    drawCell({ ctx, x: RIGHT_X, y: TOP + j * PITCH, sel: g.gear.cursor === SLOTS.length + j }, g.hero.pack[j], '-');
  }
}

interface BandLine { text: string; color: string }

function compareLines(g: Game, owned: OwnedItem): BandLine[] {
  const cmp = compareFull(g.hero, owned.item, owned.level);
  const stats = cmp.rows.map((r) => `${r.label} ${r.before}>${r.after}`).join('  ');
  const lose = cmp.kindChange || cmp.lose;
  return [
    { text: stats || 'NO STAT CHANGE', color: C_TEXT },
    { text: lose ? `LOSE: ${lose}` : 'FILLS AN EMPTY SLOT', color: C_HP_LOW },
    { text: `GAIN: ${cmp.gain}`, color: C_HP },
  ];
}

function cardLines(item: Item, level: number): BandLine[] {
  return [
    { text: describeItem(item, level).join('  '), color: C_TEXT },
    { text: effectiveBlurb(item, level), color: rarityColor(item) },
  ];
}

function bandFor(g: Game): { name: string; color: string; lines: BandLine[] } {
  const worn = wornAt(g, g.gear.cursor);
  if (worn) {return { name: displayName(worn.item, worn.level), color: rarityColor(worn.item), lines: cardLines(worn.item, worn.level) };}
  const packed = g.hero.pack[g.gear.cursor - SLOTS.length];
  if (packed) {return { name: displayName(packed.item, packed.level), color: rarityColor(packed.item), lines: compareLines(g, packed) };}
  return { name: 'EMPTY SLOT', color: C_DIM, lines: [] };
}

function drawBand(g: Game, ctx: CanvasRenderingContext2D): void {
  drawCommandBand(ctx);
  const band = bandFor(g);
  drawText(ctx, band.name, { x: BAND_X, y: BAND_Y + 4 }, { color: band.color, shadow: true });
  band.lines.forEach((line, i) => {
    fitText(ctx, line.text, { x: BAND_X, y: BAND_Y + 4 + (i + 1) * LINE, maxW: BAND_W }, { color: line.color });
  });
  const prompt = `${BUTTON_KEY.A.hint} SWAP  ${BUTTON_KEY.B.hint} BACK`;
  drawTextCentered(ctx, prompt, { width: W, y: BAND_Y + 4 + 4 * LINE + 1 }, { color: C_DIM });
}

export function renderGear(g: Game): void {
  const { pc, particles } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g, 0.45);
  particles.render(ctx);
  drawTextCentered(ctx, 'GEAR', { width: W, y: SAFE_MARGIN - 4 }, { color: C_ACCENT, shadow: true });
  drawColumns(g, ctx);
  drawBand(g, ctx);
}
