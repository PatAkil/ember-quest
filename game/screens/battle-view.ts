import { PICO8, SAFE_MARGIN, drawPanel, drawText, drawTextCentered, textWidth } from '../../engine';
import { SPELLS } from '../data';
import type { DamageKind, Derived, Hero, HeroAction, SpellId } from '../types';
import { canAfford, derive, heroActions, spellCost } from '../sim';
import { renderTableau } from '../backdrop';
import { drawPops } from '../pops';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_FAINT, C_HP, C_HP_LOW, C_MP, C_PANEL, C_SEL_BAR, C_TEXT, C_WARN, H, HUD_BOTTOM, W } from '../theme';
import { drawGauge, pct, wrap2 } from '../widgets';
import { bannerBlocks, meter } from '../fx';
import type { MeterId } from '../fx-state';
import { KIND_TAG, hasHex, magicWeapon } from './battle-fx';
import { drawBattleFx } from './battle-fx-view';

type Ctx = CanvasRenderingContext2D;

const hpColor = (frac: number): string => (frac < 0.25 ? C_HP_LOW : C_HP);

interface Box { x: number; y: number; w: number; h: number }

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

function statSegments(d: Derived, short: boolean): string[] {
  const [atk, mag, crit] = short ? ['A', 'M', 'C'] : ['ATK', 'MAG', 'CRIT'];
  return [`${atk} ${d.atk}`, `${mag} ${d.mag}`, `${crit} ${pct(d.crit)}`];
}

function drawStatLine(ctx: Ctx, plate: Box, d: Derived): void {
  const room = innerRight(plate) - innerLeft(plate);
  const wide = statSegments(d, false);
  const fits = wide.reduce((n, t) => n + textWidth(t, 1), 0) + 8 <= room;
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
  const stacks = g.battle.state?.rampStacks ?? 0;
  if (stacks > 0) {drawText(ctx, `RAMP ${stacks}`, { x: innerLeft(HERO_PLATE), y: HUD_BOTTOM + 3 }, { color: C_WARN, shadow: true });}
}


function resistText(def: { def: number; mdef: number }): string {
  if (def.def < def.mdef) {return `RES MAG ${def.mdef}%`;}
  return def.def > 0 ? `RES PHYS ${def.def}%` : '';
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
  const res = resistText(e.def);
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

function actionKind(hero: Hero, a: HeroAction): DamageKind {
  const hex = hasHex(hero);
  if (a === 'ATTACK') {return hex || magicWeapon(hero) ? 'MAGIC' : 'PHYSICAL';}
  return hex && a === 'SLASH' ? 'MAGIC' : SPELLS[a].kind;
}

interface SpellInfo { info: string; short: string; isHeal: boolean }

function spellInfo(a: SpellId): SpellInfo {
  const s = SPELLS[a];
  if (s.heal !== undefined) {
    const heal = `HEAL ${Math.round(s.heal * 100)}%`;
    return { info: heal, short: heal, isHeal: true };
  }
  const mult = `x${s.mult.toFixed(1)}${s.hits > 1 ? `x${s.hits}` : ''}`;
  return { info: `${s.scale} ${mult}`, short: mult, isHeal: false };
}

const attackInfo = (hero: Hero): SpellInfo => ({ info: magicWeapon(hero) ? 'MAG x1.0' : 'ATK x1.0', short: 'x1.0', isHeal: false });

interface ActionInfo { text: string; short: string; warn: boolean }

function actionInfo(g: Game, a: HeroAction): ActionInfo {
  const hero = g.hero;
  const kind = actionKind(hero, a);
  const enemy = g.battle.enemy;
  const res = enemy ? (kind === 'PHYSICAL' ? enemy.def.def : enemy.def.mdef) : 0;
  const { info, short, isHeal } = a === 'ATTACK' ? attackInfo(hero) : spellInfo(a);
  const tag = !isHeal && res >= 20 ? ` -${res}%` : '';
  return { text: info + tag, short: short + tag, warn: tag !== '' };
}

function actionLabel(hero: Hero, a: HeroAction): string {
  const cost = a === 'ATTACK' ? 0 : spellCost(hero, a);
  const name = a === 'ATTACK' ? 'ATTACK' : SPELLS[a].name;
  return cost > 0 ? `${name} ${cost}MP` : `${name} FREE`;
}

const ROW_GAP = 4;

interface MenuCell { x0: number; y: number; colW: number; sel: boolean; compact: boolean }

const rowLabel = (hero: Hero, a: HeroAction, sel: boolean): string => (sel ? '> ' : '  ') + actionLabel(hero, a);

function overflows(g: Game, a: HeroAction, colW: number): boolean {
  const room = Math.round(colW) - 10 - textWidth(rowLabel(g.hero, a, true), 1) - ROW_GAP;
  return textWidth(actionInfo(g, a).text, 1) > room;
}

function drawActionRow(g: Game, a: HeroAction, cell: MenuCell): void {
  const ctx = g.app.pc.ctx;
  const { x0, y, colW, sel, compact } = cell;
  const afford = canAfford(g.hero, a);
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x0 + 2, y - 2, Math.round(colW) - 4, 9); }
  const labelColor = sel ? C_ACCENT : afford ? C_TEXT : C_FAINT;
  const label = rowLabel(g.hero, a, sel);
  drawText(ctx, label, { x: x0 + 5, y }, { color: labelColor, shadow: sel });
  const info = actionInfo(g, a);
  const text = compact ? info.short : info.text;
  const infoColor = info.warn ? C_WARN : sel ? C_TEXT : C_DIM;
  drawText(ctx, text, { x: x0 + Math.round(colW) - 5 - textWidth(text, 1), y }, { color: infoColor });
}

const ROW_PITCH = 9;
const BAND_BOTTOM = H - SAFE_MARGIN;
const LOG_ROOM = BAND_BOTTOM - BAND_Y - 1;

function renderBand(g: Game): void {
  const ctx = g.app.pc.ctx;
  ctx.fillStyle = PICO8[0]; ctx.fillRect(0, BAND_Y - 1, W, 1);
  ctx.fillStyle = C_PANEL; ctx.fillRect(0, BAND_Y, W, H - BAND_Y);
  ctx.fillStyle = C_BORDER; ctx.fillRect(0, BAND_Y, W, 1);
}

function renderActionMenu(g: Game): void {
  const ctx = g.app.pc.ctx;
  const actions = heroActions(g.hero);
  const cols = Math.ceil(actions.length / 3);
  const colW = (W - 2 * SAFE_MARGIN) / cols;
  if (cols > 1) { ctx.fillStyle = PICO8[5]; ctx.fillRect(W / 2, BAND_Y + 4, 1, BAND_BOTTOM - BAND_Y - 4); }
  const compact = actions.some((a) => overflows(g, a, colW));
  const rows = Math.min(3, actions.length);
  const top = BAND_Y + 1 + Math.round((LOG_ROOM - (rows * ROW_PITCH - 4)) / 2);
  actions.forEach((a, i) => {
    const x0 = Math.round(SAFE_MARGIN + Math.floor(i / 3) * colW);
    drawActionRow(g, a, { x0, y: top + (i % 3) * ROW_PITCH, colW, sel: i === g.battle.menuCursor, compact });
  });
}

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

const endingShown = (g: Game): boolean => g.app.scenes.is('GAME_OVER') || g.app.scenes.is('WIN');

export function renderBattle(g: Game): void {
  renderTableau(g, true);
  if (endingShown(g)) {return;}
  drawBattleFx(g);
  const d = derive(g.hero);
  renderEnemyHud(g);
  renderHeroHud(g, d);
  renderScore(g);
  renderBand(g);
  if (g.battle.phase === 'MENU' && !g.heroDown && !bannerBlocks(g)) {renderActionMenu(g);} else {renderBattleText(g);}
  drawPops(g);
}
