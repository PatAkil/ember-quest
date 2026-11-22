import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawText, textWidth } from '../../engine';
import { STAT_KEYS, SP_GAIN } from '../types';
import type { Derived, StatKey } from '../types';
import { derive, spendPoint } from '../sim';
import { heroAnchor, renderTableau } from '../backdrop';
import { at } from '../lookup';
import { drawPops, popSpot, pushPop } from '../pops';
import { dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, HERO_W, HERO_X, W } from '../theme';
import { blinkHz, pct } from '../widgets';

export function startLevelUp(g: Game, earned: number, onDone: () => void): void {
  if (g.hero.sp <= 0) { onDone(); return; }
  g.levelUp = { earned, cursor: 0, onDone };
  g.subScene = 'LEVELUP';
  resetCursorEdge(g);
}

export function updateLevelUp(g: Game): void {
  const lu = g.levelUp;
  const dy = dirEdge(g);
  if (dy) { lu.cursor = wrapCursor(lu.cursor, dy, STAT_KEYS.length); g.app.audio.play('blip'); }
  if (!g.app.input.pressed('A')) {return;}
  const key = at(STAT_KEYS, lu.cursor);
  if (spendPoint(g.hero, key)) {
    g.app.audio.play('pickup');
    pushPop(g.pops, popSpot(heroAnchor()), `${gainText(key)} ${key}`, C_ACCENT);
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

const PANEL = { x: HERO_X + HERO_W / 2 + 12, y: SAFE_MARGIN, h: 100 };
const PANEL_W = W - SAFE_MARGIN - PANEL.x;
const ROWS_Y = PANEL.y + 25;
const ROW_PITCH = 9;

const centreX = (text: string, scale: number): number => Math.round(PANEL.x + (PANEL_W - textWidth(text, scale)) / 2);

function drawStatRow(g: Game, k: StatKey, i: number, current: Record<StatKey, string>): void {
  const ctx = g.app.pc.ctx;
  const y = ROWS_Y + i * ROW_PITCH;
  const sel = i === g.levelUp.cursor;
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(PANEL.x + 3, y - 2, PANEL_W - 6, 9); }
  drawText(ctx, `${sel ? '> ' : '  '}${k}`, { x: PANEL.x + 6, y }, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
  const v = `${current[k]} ${gainText(k)}`;
  drawText(ctx, v, { x: PANEL.x + PANEL_W - 6 - textWidth(v, 1), y }, { color: sel ? C_TEXT : C_DIM });
}

export function renderLevelUp(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  const ctx = pc.ctx;
  drawPanel(pc, { x: PANEL.x, y: PANEL.y, w: PANEL_W, h: PANEL.h }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, 'LEVEL UP', { x: centreX('LEVEL UP', 2), y: PANEL.y + 4 }, { color: C_ACCENT, scale: 2, shadow: true });
  const sub = `+${g.levelUp.earned} SP   ${g.hero.sp} TO SPEND`;
  drawText(ctx, sub, { x: centreX(sub, 1), y: PANEL.y + 17 }, { color: C_TEXT });
  const current = currentValues(derive(g.hero));
  STAT_KEYS.forEach((k, i) => { drawStatRow(g, k, i, current); });
  const prompt = `${BUTTON_KEY.A.hint} SPEND A POINT`;
  drawText(ctx, prompt, { x: centreX(prompt, 1), y: PANEL.y + PANEL.h - 10 }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM });
  drawPops(g);
}
