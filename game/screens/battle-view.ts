import { PICO8, SAFE_MARGIN, drawPanel, drawText, drawTextCentered, textWidth } from '../../engine';
import type { Derived, EnemyInstance } from '../types';
import { derive } from '../sim';
import { renderTableau } from '../backdrop';
import { drawPops } from '../pops';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_HP, C_HP_LOW, C_MP, C_PANEL, C_TEXT, C_WARN, H, HUD_BOTTOM, W } from '../theme';
import { drawCommandBand, drawGauge, pct, wrap2 } from '../widgets';
import { bannerBlocks, meter } from '../fx';
import type { MeterId } from '../fx-state';
import { KIND_TAG } from './battle-fx';
import { drawBanner, drawBattleFx } from './battle-fx-view';
import { renderActionMenu } from './battle-menu';
import { drawTags } from './battle-tags';
import type { PlateBox } from './battle-tags';

type Ctx = CanvasRenderingContext2D;

const hpColor = (frac: number): string => (frac < 0.25 ? C_HP_LOW : C_HP);

type Box = PlateBox;

const PLATE_W = 96;
const PLATE_PAD = 4;
const ROW_A = 4;
const ROW_B = 11;
const ROW_C = 18;
const NUM_RESERVE = textWidth('999/999', 1);
const HERO_PLATE: Box = { x: SAFE_MARGIN, y: SAFE_MARGIN, w: PLATE_W, h: HUD_BOTTOM - SAFE_MARGIN };
const ENEMY_PLATE: Box = { ...HERO_PLATE, x: W - SAFE_MARGIN - PLATE_W };

const innerLeft = (b: Box): number => b.x + PLATE_PAD;
const innerRight = (b: Box): number => b.x + b.w - PLATE_PAD;

interface BarRow { label: string; id: MeterId; max: number; color?: string }

function drawBarRow(g: Game, plate: Box, dy: number, row: BarRow): void {
  const ctx = g.app.pc.ctx;
  const y = plate.y + dy;
  const m = meter(g, row.id);
  const max = Math.max(1, row.max);
  drawText(ctx, row.label, { x: innerLeft(plate), y }, { color: C_TEXT });
  const num = `${Math.round(m.shown)}/${row.max}`;
  const nx = innerRight(plate) - Math.max(NUM_RESERVE, textWidth(num, 1));
  const bx = innerLeft(plate) + 10;
  const frac = m.shown / max;
  drawGauge(ctx, { x: bx, y, w: nx - 4 - bx, h: 5 }, { frac, ghost: m.ghost / max, color: row.color ?? hpColor(frac) });
  drawText(ctx, num, { x: innerRight(plate) - textWidth(num, 1), y }, { color: C_DIM });
}

const STAT_AIR = 18;

function statSegments(d: Derived, short: boolean): string[] {
  const [atk, mag, crit] = short ? ['A', 'M', 'C'] : ['ATK', 'MAG', 'CRIT'];
  return [`${atk} ${d.atk}`, `${mag} ${d.mag}`, `${crit} ${pct(d.crit)}`];
}

function drawStatLine(ctx: Ctx, plate: Box, d: Derived): void {
  const room = innerRight(plate) - innerLeft(plate);
  const wide = statSegments(d, false);
  const fits = wide.reduce((n, t) => n + textWidth(t, 1), 0) + STAT_AIR <= room;
  const segs = fits ? wide : statSegments(d, true);
  const used = segs.reduce((n, t) => n + textWidth(t, 1), 0);
  const gap = (room - used) / (segs.length - 1);
  let x = innerLeft(plate);
  for (const t of segs) {
    drawText(ctx, t, { x: Math.round(x), y: plate.y + ROW_A }, { color: C_DIM });
    x += textWidth(t, 1) + gap;
  }
}

function renderHeroHud(g: Game, d: Derived): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  drawPanel(pc, HERO_PLATE, { color: C_PANEL, border: C_BORDER });
  drawStatLine(ctx, HERO_PLATE, d);
  drawBarRow(g, HERO_PLATE, ROW_B, { label: 'HP', id: 'heroHp', max: d.maxHp });
  drawBarRow(g, HERO_PLATE, ROW_C, { label: 'MP', id: 'heroMp', max: d.maxMp, color: C_MP });
}

function resistText(e: EnemyInstance): string {
  if (e.resPhys < e.resMagic) {return `RES MAG ${e.resMagic}%`;}
  return e.resPhys > 0 ? `RES PHYS ${e.resPhys}%` : '';
}

function renderEnemyHud(g: Game): void {
  const e = g.battle.enemy;
  if (!e) {return;}
  const { pc } = g.app;
  const ctx = pc.ctx;
  const plate = ENEMY_PLATE;
  drawPanel(pc, plate, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, e.def.name, { x: innerLeft(plate), y: plate.y + ROW_A }, { color: C_TEXT });
  const tag = KIND_TAG[e.def.kind];
  if (tag) {drawText(ctx, tag, { x: innerRight(plate) - textWidth(tag, 1), y: plate.y + ROW_A }, { color: C_ACCENT });}
  drawBarRow(g, plate, ROW_B, { label: 'HP', id: 'enemyHp', max: e.maxHp });
  const physical = e.def.atkType === 'PHYSICAL';
  drawText(ctx, physical ? 'STRIKES' : 'HEXES', { x: innerLeft(plate), y: plate.y + ROW_C }, { color: physical ? C_WARN : PICO8[14] });
  const res = resistText(e);
  if (res) {drawText(ctx, res, { x: innerRight(plate) - textWidth(res, 1), y: plate.y + ROW_C }, { color: C_DIM });}
}

function renderScore(g: Game): void {
  const ctx = g.app.pc.ctx;
  const mid = (HERO_PLATE.x + HERO_PLATE.w + ENEMY_PLATE.x) / 2;
  const centred = (text: string): number => Math.round(mid - textWidth(text, 1) / 2);
  const value = String(g.score);
  drawText(ctx, 'SCORE', { x: centred('SCORE'), y: SAFE_MARGIN + ROW_A }, { color: C_DIM, shadow: true });
  drawText(ctx, value, { x: centred(value), y: SAFE_MARGIN + ROW_B }, { color: C_TEXT, shadow: true });
}

const BAND_BOTTOM = H - SAFE_MARGIN;
const LOG_ROOM = BAND_BOTTOM - BAND_Y - 1;
const LOG_MAX_W = W - 2 * SAFE_MARGIN - 8;

function logLayout(text: string): { lines: string[]; scale: number } {
  const big = wrap2(text, LOG_MAX_W, 2);
  if (big.every((l) => textWidth(l, 2) <= LOG_MAX_W)) {return { lines: big, scale: 2 };}
  return { lines: wrap2(text, LOG_MAX_W), scale: 1 };
}

function renderBattleText(g: Game): void {
  const ctx = g.app.pc.ctx;
  const { lines, scale } = logLayout(g.battle.text);
  const lineH = 5 * scale + 3;
  const top = BAND_Y + 1 + Math.round((LOG_ROOM - (lines.length * lineH - 3)) / 2);
  lines.forEach((line, i) => {
    drawTextCentered(ctx, line, { width: W, y: top + i * lineH }, { color: g.battle.color, scale, shadow: true });
  });
}

function drawBandContent(g: Game): void {
  if (bannerBlocks(g)) { drawBanner(g); return; }
  if (g.battle.phase === 'MENU' && !g.heroDown) {renderActionMenu(g);} else {renderBattleText(g);}
}

const endingShown = (g: Game): boolean => g.app.scenes.is('GAME_OVER') || g.app.scenes.is('WIN');

export function renderBattle(g: Game): void {
  renderTableau(g, true);
  if (endingShown(g)) {return;}
  drawBattleFx(g);
  const d = derive(g.hero);
  renderEnemyHud(g);
  renderHeroHud(g, d);
  drawTags(g, { hero: HERO_PLATE, enemy: ENEMY_PLATE, pad: PLATE_PAD });
  renderScore(g);
  drawCommandBand(g.app.pc.ctx);
  drawBandContent(g);
  drawPops(g);
}
