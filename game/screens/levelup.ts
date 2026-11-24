import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawText, textWidth } from '../../engine';
import { STAT_KEYS, SP_GAIN } from '../types';
import type { Derived, Hero, StatKey } from '../types';
import { derive, spendPoint } from '../sim';
import { heroAnchor, renderTableau } from '../backdrop';
import { at } from '../lookup';
import { drawPops, popSpot, pushPop } from '../pops';
import { dirEdge, resetCursorEdge, takeA, wrapCursor } from '../state';
import { armDecision } from '../transition';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, HERO_W, HERO_X, W } from '../theme';
import { decisionPromptColor, drawCommandBand, pct } from '../widgets';

export function startLevelUp(g: Game, earned: number, onDone: () => void): void {
  if (g.hero.sp <= 0) { onDone(); return; }
  g.levelUp = { earned, cursor: 0, onDone };
  g.subScene = 'LEVELUP';
  resetCursorEdge(g);
  armDecision(g);
}

export function updateLevelUp(g: Game): void {
  const lu = g.levelUp;
  const dy = dirEdge(g);
  if (dy) { lu.cursor = wrapCursor(lu.cursor, dy, STAT_KEYS.length); g.app.audio.play('blip'); }
  if (!takeA(g)) {return;}
  const key = at(STAT_KEYS, lu.cursor);
  if (capped(g.hero, key)) { g.app.audio.play('blip'); return; }
  if (spendPoint(g.hero, key)) {
    g.app.audio.play('pickup');
    pushPop(g.pops, { x: Math.round((SAFE_MARGIN + PANEL.x) / 2), y: popSpot(heroAnchor()).y }, `${gainText(key)} ${key}`, C_ACCENT);
  }
  if (g.hero.sp <= 0) {lu.onDone();}
}

const PERCENT_STATS: ReadonlySet<StatKey> = new Set<StatKey>(['DEF', 'MDEF', 'CRIT']);
const gainText = (k: StatKey): string => `+${SP_GAIN[k]}${PERCENT_STATS.has(k) ? '%' : ''}`;

function currentValues(d: Derived): Record<StatKey, string> {
  return {
    HP: String(d.maxHp), MP: String(d.maxMp), ATK: String(d.atk), MAG: String(d.mag), DEF: pct(d.def), MDEF: pct(d.mdef), CRIT: pct(d.crit),
  };
}

function capped(hero: Hero, k: StatKey): boolean {
  const next = { ...hero, alloc: { ...hero.alloc, [k]: hero.alloc[k] + 1 } };
  return currentValues(derive(next))[k] === currentValues(derive(hero))[k];
}

const gainOrMax = (hero: Hero, k: StatKey): string => (capped(hero, k) ? 'MAX' : gainText(k));

const PANEL = { x: HERO_X + HERO_W / 2 + 12, y: SAFE_MARGIN, h: 94 };
const PANEL_W = W - SAFE_MARGIN - PANEL.x;
const ROWS_Y = PANEL.y + 20;
const ROW_PITCH = 10;
const STAT_HINT: Record<StatKey, string> = {
  HP: 'MORE MAX HEALTH', MP: 'MORE MAX MANA', ATK: 'PHYSICAL HITS LAND HARDER', MAG: 'MAGIC HITS LAND HARDER',
  DEF: 'SOFTENS PHYSICAL BLOWS', MDEF: 'SOFTENS HEXES', CRIT: 'CHANCE TO LAND A CRITICAL HIT',
};

const centreX = (text: string, scale: number): number => Math.round(PANEL.x + (PANEL_W - textWidth(text, scale)) / 2);

function drawStatRow(g: Game, k: StatKey, i: number, current: Record<StatKey, string>): void {
  const ctx = g.app.pc.ctx;
  const y = ROWS_Y + i * ROW_PITCH;
  const sel = i === g.levelUp.cursor;
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(PANEL.x + 3, y - 2, PANEL_W - 6, 9); }
  drawText(ctx, `${sel ? '> ' : '  '}${k}`, { x: PANEL.x + 6, y }, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
  const v = `${current[k]} ${gainOrMax(g.hero, k)}`;
  drawText(ctx, v, { x: PANEL.x + PANEL_W - 6 - textWidth(v, 1), y }, { color: sel ? C_TEXT : C_DIM });
}

function drawSpendBand(g: Game): void {
  const ctx = g.app.pc.ctx;
  drawCommandBand(ctx);
  const left = `${g.hero.sp} SP TO SPEND`;
  drawText(ctx, left, { x: SAFE_MARGIN + 4, y: BAND_Y + 7 }, { color: C_ACCENT, scale: 2, shadow: true });
  const earned = `+${g.levelUp.earned} EARNED`;
  drawText(ctx, earned, { x: W - SAFE_MARGIN - 4 - textWidth(earned, 1), y: BAND_Y + 10 }, { color: C_DIM });
  const key = at(STAT_KEYS, g.levelUp.cursor);
  const full = capped(g.hero, key);
  const line = full ? `${key} IS AT ITS CAP  SPEND ELSEWHERE` : `${key} ${gainText(key)}  ${STAT_HINT[key]}`;
  drawText(ctx, line, { x: SAFE_MARGIN + 4, y: BAND_Y + 22 }, { color: full ? C_DIM : C_TEXT });
  const prompt = `${BUTTON_KEY.A.hint} SPEND A POINT`;
  drawText(ctx, prompt, { x: SAFE_MARGIN + 4, y: BAND_Y + 31 }, { color: decisionPromptColor(g, C_ACCENT) });
}

export function renderLevelUp(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  const ctx = pc.ctx;
  drawPanel(pc, { x: PANEL.x, y: PANEL.y, w: PANEL_W, h: PANEL.h }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, 'LEVEL UP', { x: centreX('LEVEL UP', 2), y: PANEL.y + 5 }, { color: C_ACCENT, scale: 2, shadow: true });
  const current = currentValues(derive(g.hero));
  STAT_KEYS.forEach((k, i) => { drawStatRow(g, k, i, current); });
  drawSpendBand(g);
  drawPops(g);
}
