import { PICO8, SAFE_MARGIN, drawPanel, drawSprite, drawText, textWidth } from '../../engine';
import { SLOTS } from '../types';
import type { Derived } from '../types';
import { derive, displayName, itemLevel } from '../sim';
import { ICON_EMPTY } from '../sprites';
import type { Game } from '../state';
import { C_BORDER, C_DIM, C_HP, C_HP_LOW, C_MP, C_PANEL, C_TEXT, W, rarityColor } from '../theme';
import { drawBar, fitText, itemIcon, pct } from '../widgets';

function drawGear(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  SLOTS.forEach((slot, i) => {
    const bx = SAFE_MARGIN + 5 + (i % 3) * 72;
    const by = y + 4 + Math.floor(i / 3) * 8;
    const item = g.hero.equipment[slot];
    drawSprite(ctx, item ? itemIcon(item) : ICON_EMPTY, { x: bx, y: by }, 1);
    drawText(ctx, item ? displayName(item, itemLevel(g.hero, slot)) : `NO ${slot}`, { x: bx + 7, y: by }, { color: item ? rarityColor(item) : PICO8[5] });
  });
}

function drawVitals(g: Game, d: Derived, y: number): void {
  const ctx = g.app.pc.ctx;
  const hero = g.hero;
  drawText(ctx, 'HP', { x: SAFE_MARGIN + 5, y: y + 23 }, { color: C_TEXT });
  drawBar(ctx, { x: SAFE_MARGIN + 15, y: y + 23, w: 40, h: 5 }, hero.hp / d.maxHp, hero.hp / d.maxHp < 0.25 ? C_HP_LOW : C_HP);
  drawText(ctx, `${hero.hp}/${d.maxHp}`, { x: SAFE_MARGIN + 58, y: y + 23 }, { color: C_DIM });
  drawText(ctx, 'MP', { x: SAFE_MARGIN + 92, y: y + 23 }, { color: C_TEXT });
  drawBar(ctx, { x: SAFE_MARGIN + 102, y: y + 23, w: 40, h: 5 }, hero.mp / d.maxMp, C_MP);
  drawText(ctx, `${hero.mp}/${d.maxMp}`, { x: SAFE_MARGIN + 145, y: y + 23 }, { color: C_DIM });
  const regen = [d.mpRegen ? `+${d.mpRegen}MP` : '', d.hpRegen ? `+${d.hpRegen}HP` : ''].filter(Boolean).join(' ');
  if (regen) {drawText(ctx, `${regen}/TURN`, { x: W - SAFE_MARGIN - 5 - textWidth(`${regen}/TURN`, 1), y: y + 23 }, { color: C_HP });}
}

export function drawStatusPanel(g: Game, y: number): void {
  const d = derive(g.hero);
  drawPanel(g.app.pc, { x: SAFE_MARGIN, y, w: W - 2 * SAFE_MARGIN, h: 46 }, { color: C_PANEL, border: C_BORDER });
  drawGear(g, y);
  drawVitals(g, d, y);
  const stats = `ATK ${d.atk} MAG ${d.mag} DEF ${pct(d.def)} MDEF ${pct(d.mdef)} CRIT ${pct(d.crit)} X${d.critMult.toFixed(1)} DGE ${pct(d.dodge)}`;
  fitText(g.app.pc.ctx, stats, { x: SAFE_MARGIN + 5, y: y + 34, maxW: W - 2 * SAFE_MARGIN - 10 }, { color: C_DIM });
}
