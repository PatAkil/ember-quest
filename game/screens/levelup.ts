import { BUTTON_KEY, SAFE_MARGIN, drawPanel, drawText, drawTextCentered, textWidth } from '../../engine';
import { STAT_KEYS, SP_GAIN } from '../types';
import type { Derived, StatKey } from '../types';
import { derive, spendPoint } from '../sim';
import { renderTableau } from '../backdrop';
import { at } from '../lookup';
import { drawPops, pushPop } from '../pops';
import { dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_PANEL, C_SEL_BAR, C_TEXT, W, heroPos } from '../theme';
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
    const hp = heroPos();
    pushPop(g.pops, { x: hp.x, y: hp.y - 26 }, `${gainText(key)} ${key}`, C_ACCENT);
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

export function renderLevelUp(g: Game): void {
  const { pc } = g.app;
  renderTableau(g, false);
  const d = derive(g.hero);
  const ctx = pc.ctx;
  const panelY = SAFE_MARGIN + 2;
  const panelH = 62;
  drawPanel(pc, { x: 16, y: panelY, w: W - 32, h: panelH }, { color: C_PANEL, border: C_BORDER });
  const title = `LEVEL UP  +${g.levelUp.earned} SP   ${g.hero.sp} TO SPEND`;
  drawTextCentered(ctx, title, { width: W, y: panelY + 5 }, { color: C_ACCENT, shadow: true });
  const current = currentValues(d);
  const colW = (W - 32) / 2;
  STAT_KEYS.forEach((k, i) => {
    const col = Math.floor(i / 4); const row = i % 4;
    const x0 = 16 + col * colW; const y = panelY + 16 + row * 9;
    const sel = i === g.levelUp.cursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(Math.round(x0) + 3, y - 2, Math.round(colW) - 6, 9); }
    drawText(ctx, `${sel ? '> ' : '  '}${k}`, { x: Math.round(x0) + 6, y }, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
    const v = `${current[k]} ${gainText(k)}`;
    drawText(ctx, v, { x: Math.round(x0 + colW) - 6 - textWidth(v, 1), y }, { color: sel ? C_TEXT : C_DIM });
  });
  drawTextCentered(ctx, `${BUTTON_KEY.A.hint} SPEND A POINT`, { width: W, y: panelY + panelH - 9 }, { color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM });
  drawPops(g);
}
