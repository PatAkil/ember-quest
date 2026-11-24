import { PICO8, SAFE_MARGIN, drawText, textWidth } from '../../engine';
import type { Sprite } from '../../engine';
import type { Hero, OwnedItem } from '../types';
import { compareFull, displayName, effectiveEffect, itemLevel } from '../sim';
import type { CompareRow, FullCompare } from '../sim';
import { BAND_Y, C_DIM, C_FAINT, C_HP, C_LOG_HURT, C_WARN, W, rarityColor } from '../theme';
import { fitText } from '../widgets';
import { drawIconIn, drawMedallion } from './plate';

const CARD_BOX = 34;
const CARD_X = SAFE_MARGIN;
const CARD_Y = BAND_Y + 5;
const CARD_TEXT_X = CARD_X + CARD_BOX + 6;
const CARD_TEXT_W = W - SAFE_MARGIN - 2 - CARD_TEXT_X;
const LINE = 7;
const LEFT = SAFE_MARGIN;
const RIGHT = W - SAFE_MARGIN;
const TOP = BAND_Y + 4;
const COLUMNS = 3;
const COL_W = Math.floor((RIGHT - LEFT) / COLUMNS);
const GAP = 8;
const C_GAIN = C_HP;
const C_LOSS = C_LOG_HURT;
const C_ARROW = PICO8[6];

export interface CardLine { text: string; color: string }
export interface CardText { name: string; color: string; lines: CardLine[] }

function mergeStats(lines: CardLine[]): CardLine[] {
  const [a, b, ...rest] = lines;
  if (!a || !b || lines.length <= 3 || a.color !== b.color) {return lines;}
  const joined = `${a.text}  ${b.text}`;
  return textWidth(joined, 1) <= CARD_TEXT_W ? [{ text: joined, color: a.color }, ...rest] : lines;
}

export function drawItemCard(ctx: CanvasRenderingContext2D, art: { icon: Sprite; px: number }, text: CardText): void {
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

function wornOwned(hero: Hero, candidate: OwnedItem): OwnedItem | undefined {
  const item = hero.equipment[candidate.item.slot];
  return item ? { item, level: itemLevel(hero, candidate.item.slot) } : undefined;
}

const hasEffect = (owned: OwnedItem): boolean => effectiveEffect(owned.item, owned.level).kind !== 'NONE';

interface Ink { text: string; color: string }

function drawRun(ctx: CanvasRenderingContext2D, parts: Ink[], at: { x: number; y: number }): number {
  let x = at.x;
  for (const part of parts) {
    drawText(ctx, part.text, { x, y: at.y }, { color: part.color, shadow: true });
    x += textWidth(part.text, 1) + 4;
  }
  return x - 4;
}

function headline(worn: OwnedItem | undefined, next: OwnedItem): Ink[] {
  const old: Ink = worn ? { text: displayName(worn.item, worn.level), color: rarityColor(worn.item) } : { text: 'EMPTY SLOT', color: C_FAINT };
  return [old, { text: '>', color: C_ARROW }, { text: displayName(next.item, next.level), color: rarityColor(next.item) }];
}

function drawCell(ctx: CanvasRenderingContext2D, row: CompareRow, at: { x: number; y: number }): void {
  drawText(ctx, row.label, { x: at.x, y: at.y }, { color: C_DIM });
  const vx = at.x + textWidth(row.label, 1) + 4;
  const value = `${row.before}>${row.after}`;
  fitText(ctx, value, { x: vx, y: at.y, maxW: at.x + COL_W - 2 - vx }, { color: row.better ? C_GAIN : C_LOSS });
}

function drawCells(ctx: CanvasRenderingContext2D, rows: CompareRow[], y: number): void {
  if (rows.length === 0) {
    drawText(ctx, 'NO STAT CHANGE', { x: LEFT, y }, { color: C_DIM });
    return;
  }
  rows.slice(0, COLUMNS * 2).forEach((row, i) => {
    drawCell(ctx, row, { x: LEFT + (i % COLUMNS) * COL_W, y: y + Math.floor(i / COLUMNS) * LINE });
  });
}

function effectLine(word: 'LOSE' | 'GAIN', blurb: string, color: string): CardLine {
  return blurb ? { text: `${word}: ${blurb}`, color } : { text: `${word}: NO SPECIAL EFFECT`, color: C_DIM };
}

function loseLine(worn: OwnedItem | undefined, cmp: FullCompare): CardLine {
  if (!worn) {return { text: 'FILLS AN EMPTY SLOT', color: C_DIM };}
  return effectLine('LOSE', hasEffect(worn) ? cmp.lose : '', C_LOSS);
}

interface KindChangeSpot { line1: boolean; line3: boolean; lose: boolean }

function kindChangeSpot(endX: number, cmp: FullCompare): KindChangeSpot {
  if (!cmp.kindChange) {return { line1: false, line3: false, lose: false };}
  if (endX + GAP + textWidth(cmp.kindChange, 1) <= RIGHT) {return { line1: true, line3: false, lose: false };}
  return cmp.rows.length <= COLUMNS ? { line1: false, line3: true, lose: false } : { line1: false, line3: false, lose: true };
}

export function drawCompare(ctx: CanvasRenderingContext2D, hero: Hero, next: OwnedItem): void {
  const worn = wornOwned(hero, next);
  const cmp = compareFull(hero, next.item, next.level);
  const endX = drawRun(ctx, headline(worn, next), { x: LEFT, y: TOP });
  const spot = kindChangeSpot(endX, cmp);
  const warn = { color: C_WARN, shadow: true };
  if (spot.line1) {drawText(ctx, cmp.kindChange, { x: RIGHT - textWidth(cmp.kindChange, 1), y: TOP }, warn);}
  drawCells(ctx, cmp.rows, TOP + LINE);
  if (spot.line3) {drawText(ctx, cmp.kindChange, { x: LEFT, y: TOP + 2 * LINE }, warn);}
  const lose = spot.lose ? { text: cmp.kindChange, color: C_WARN } : loseLine(worn, cmp);
  const gain = effectLine('GAIN', hasEffect(next) ? cmp.gain : '', C_GAIN);
  fitText(ctx, lose.text, { x: LEFT, y: TOP + 3 * LINE, maxW: RIGHT - LEFT }, { color: lose.color });
  fitText(ctx, gain.text, { x: LEFT, y: TOP + 4 * LINE, maxW: RIGHT - LEFT }, { color: gain.color });
}
