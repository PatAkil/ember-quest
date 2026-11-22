import { PICO8, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import { SLOTS } from '../types';
import type { Derived } from '../types';
import { derive, displayName, itemLevel } from '../sim';
import { ICON_EMPTY } from '../sprites';
import type { Game } from '../state';
import { C_BORDER, C_DIM, C_FAINT, C_HP, C_HP_LOW, C_MP, C_PANEL, C_TEXT, W, rarityColor } from '../theme';
import { drawBar, fitText, itemIcon, pct } from '../widgets';

export const STATUS_PANEL_H = 46;
const PAD = 5;
const LEFT = SAFE_MARGIN + PAD;
const RIGHT = W - SAFE_MARGIN - PAD;
const GEAR_COLS = [LEFT, LEFT + 76] as const;
const GEAR_ROWS = 3;
const GEAR_PITCH = 9;
const ICON_GAP = 11;
const NAME_W = 63;
const VITALS_X = 168;
const VITALS_W = RIGHT - VITALS_X;
const STAT_GAP_MIN = 4;
const C_RULE = PICO8[5];

function drawGear(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  SLOTS.forEach((slot, i) => {
    const bx = GEAR_COLS[i < GEAR_ROWS ? 0 : 1];
    const by = y + 4 + (i % GEAR_ROWS) * GEAR_PITCH;
    const item = g.hero.equipment[slot];
    drawSprite(ctx, item ? itemIcon(item) : ICON_EMPTY, { x: bx, y: by }, 1);
    const name = item ? displayName(item, itemLevel(g.hero, slot)) : `NO ${slot}`;
    fitText(ctx, name, { x: bx + ICON_GAP, y: by + 2, maxW: NAME_W }, { color: item ? rarityColor(item) : C_FAINT });
  });
}

interface Gauge { label: string; now: number; max: number; color: string }

function drawGauge(ctx: CanvasRenderingContext2D, gauge: Gauge, y: number): void {
  const value = `${gauge.now}/${gauge.max}`;
  drawText(ctx, gauge.label, { x: VITALS_X, y }, { color: C_TEXT });
  drawText(ctx, value, { x: RIGHT - textWidth(value, 1), y }, { color: C_DIM });
  drawBar(ctx, { x: VITALS_X, y: y + 6, w: VITALS_W, h: 4 }, gauge.now / Math.max(1, gauge.max), gauge.color);
}

function drawVitals(g: Game, d: Derived, y: number): void {
  const ctx = g.app.pc.ctx;
  const hero = g.hero;
  const low = hero.hp / d.maxHp < 0.25;
  drawGauge(ctx, { label: 'HP', now: hero.hp, max: d.maxHp, color: low ? C_HP_LOW : C_HP }, y + 4);
  drawGauge(ctx, { label: 'MP', now: hero.mp, max: d.maxMp, color: C_MP }, y + 16);
  const regen = [d.hpRegen ? `+${d.hpRegen}HP` : '', d.mpRegen ? `+${d.mpRegen}MP` : ''].filter(Boolean).join(' ');
  if (regen) {fitText(ctx, `${regen}/TURN`, { x: VITALS_X, y: y + 28, maxW: VITALS_W }, { color: C_HP });}
}

interface Stat { label: string; value: string }

const statList = (d: Derived): Stat[] => [
  { label: 'ATK', value: `${d.atk}` },
  { label: 'MAG', value: `${d.mag}` },
  { label: 'DEF', value: pct(d.def) },
  { label: 'MDEF', value: pct(d.mdef) },
  { label: 'CRIT', value: `${pct(d.crit)} X${d.critMult.toFixed(1)}` },
  { label: 'DGE', value: pct(d.dodge) },
];

function drawStatLine(ctx: CanvasRenderingContext2D, stats: Stat[], y: number): void {
  const widths = stats.map((s) => textWidth(s.label, 1) + 4 + textWidth(s.value, 1));
  const total = widths.reduce((a, b) => a + b, 0);
  const gap = Math.max(STAT_GAP_MIN, Math.floor((RIGHT - LEFT - total) / Math.max(1, stats.length - 1)));
  let x = LEFT;
  stats.forEach((s, i) => {
    drawText(ctx, s.label, { x, y }, { color: C_DIM });
    drawText(ctx, s.value, { x: x + textWidth(s.label, 1) + 4, y }, { color: C_TEXT });
    x += (widths[i] ?? 0) + gap;
  });
}

export function drawStatusPanel(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  const d = derive(g.hero);
  drawPanel(g.app.pc, { x: SAFE_MARGIN, y, w: W - 2 * SAFE_MARGIN, h: STATUS_PANEL_H }, { color: C_PANEL, border: C_BORDER });
  drawGear(g, y);
  ctx.fillStyle = C_RULE;
  ctx.fillRect(VITALS_X - 4, y + 4, 1, GEAR_ROWS * GEAR_PITCH - 1);
  ctx.fillRect(LEFT, y + 35, RIGHT - LEFT, 1);
  drawVitals(g, d, y);
  drawStatLine(ctx, statList(d), y + 38);
}
