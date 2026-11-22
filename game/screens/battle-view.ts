import { PICO8, SAFE_MARGIN, drawPanel, drawText, drawTextCentered, hudText, textWidth } from '../../engine';
import { SPELLS } from '../data';
import type { DamageKind, Derived, EnemyKind, Hero, HeroAction, SpellId } from '../types';
import { canAfford, derive, heroActions, spellCost } from '../sim';
import { renderTableau } from '../backdrop';
import { drawPops } from '../pops';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_DIM, C_HP, C_HP_LOW, C_MP, C_PANEL, C_SEL_BAR, C_TEXT, H, W } from '../theme';
import { drawBar, pct, wrap2 } from '../widgets';

const hpColor = (frac: number): string => (frac < 0.25 ? C_HP_LOW : C_HP);

function renderHeroHud(g: Game, d: Derived): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  const hero = g.hero;
  drawPanel(pc, { x: SAFE_MARGIN, y: SAFE_MARGIN, w: 132, h: 32 }, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, 'HP', { x: SAFE_MARGIN + 4, y: SAFE_MARGIN + 4 }, { color: C_TEXT });
  drawBar(ctx, { x: SAFE_MARGIN + 16, y: SAFE_MARGIN + 4, w: 56, h: 5 }, hero.hp / d.maxHp, hpColor(hero.hp / d.maxHp));
  drawText(ctx, `${hero.hp}/${d.maxHp}`, { x: SAFE_MARGIN + 76, y: SAFE_MARGIN + 4 }, { color: C_DIM });
  drawText(ctx, 'MP', { x: SAFE_MARGIN + 4, y: SAFE_MARGIN + 12 }, { color: C_TEXT });
  drawBar(ctx, { x: SAFE_MARGIN + 16, y: SAFE_MARGIN + 12, w: 56, h: 5 }, hero.mp / d.maxMp, C_MP);
  drawText(ctx, `${hero.mp}/${d.maxMp}`, { x: SAFE_MARGIN + 76, y: SAFE_MARGIN + 12 }, { color: C_DIM });
  const line = `ATK ${d.atk} MAG ${d.mag} CRIT ${pct(d.crit)}`;
  drawText(ctx, line, { x: SAFE_MARGIN + 4, y: SAFE_MARGIN + 22 }, { color: C_DIM });
  const stacks = g.battle.state?.rampStacks ?? 0;
  if (stacks > 0) {
    const ramp = `RAMP ${stacks}`;
    drawText(ctx, ramp, { x: SAFE_MARGIN + 128 - textWidth(ramp, 1), y: SAFE_MARGIN + 22 }, { color: PICO8[9] });
  }
}

const KIND_TAG: Record<EnemyKind, string> = { BOSS: ' BOSS', ELITE: ' ELITE', NORMAL: '' };

function resistText(def: { def: number; mdef: number }): string {
  if (def.def < def.mdef) {return `RES MAG ${def.mdef}%`;}
  return def.def > 0 ? `RES PHYS ${def.def}%` : '';
}

function renderEnemyHud(g: Game): void {
  const e = g.battle.enemy;
  if (!e) {return;}
  const ctx = g.app.pc.ctx;
  const right = (text: string): number => W - SAFE_MARGIN - textWidth(text, 1);
  const tag = KIND_TAG[e.def.kind];
  drawText(ctx, e.def.name, { x: right(e.def.name + tag), y: SAFE_MARGIN + 9 }, { color: C_TEXT, shadow: true });
  if (tag) {drawText(ctx, tag.trim(), { x: right(tag.trim()), y: SAFE_MARGIN + 9 }, { color: C_ACCENT, shadow: true });}
  drawBar(ctx, { x: W - SAFE_MARGIN - 80, y: SAFE_MARGIN + 17, w: 80, h: 5 }, e.hp / e.maxHp, hpColor(e.hp / e.maxHp));
  const physical = e.def.atkType === 'PHYSICAL';
  drawText(ctx, physical ? 'STRIKES' : 'HEXES', { x: W - SAFE_MARGIN - 80, y: SAFE_MARGIN + 24 }, { color: physical ? PICO8[9] : PICO8[14], shadow: true });
  const res = resistText(e.def);
  if (res) {drawText(ctx, res, { x: right(res), y: SAFE_MARGIN + 24 }, { color: C_DIM, shadow: true });}
}

const hasHex = (hero: Hero): boolean => Object.values(hero.equipment).some((it) => it.effect.kind === 'HEX_STRIKE');
const magicWeapon = (hero: Hero): boolean => hero.equipment.WEAPON?.weaponKind === 'MAGIC';

function actionKind(hero: Hero, a: HeroAction): DamageKind {
  const hex = hasHex(hero);
  if (a === 'ATTACK') {return hex || magicWeapon(hero) ? 'MAGIC' : 'PHYSICAL';}
  return hex && a === 'SLASH' ? 'MAGIC' : SPELLS[a].kind;
}

function spellInfo(a: SpellId): { info: string; isHeal: boolean } {
  const s = SPELLS[a];
  if (s.heal !== undefined) {return { info: `HEAL ${Math.round(s.heal * 100)}%`, isHeal: true };}
  return { info: `${s.scale} x${s.mult.toFixed(1)}${s.hits > 1 ? `x${s.hits}` : ''}`, isHeal: false };
}

function actionInfo(g: Game, a: HeroAction): { text: string; warn: boolean } {
  const hero = g.hero;
  const kind = actionKind(hero, a);
  const enemy = g.battle.enemy;
  const res = enemy ? (kind === 'PHYSICAL' ? enemy.def.def : enemy.def.mdef) : 0;
  const { info, isHeal } = a === 'ATTACK' ? { info: magicWeapon(hero) ? 'MAG x1.0' : 'ATK x1.0', isHeal: false } : spellInfo(a);
  const tag = !isHeal && res >= 20 ? ` -${res}%` : '';
  return { text: info + tag, warn: tag !== '' };
}

function actionLabel(hero: Hero, a: HeroAction): string {
  const cost = a === 'ATTACK' ? 0 : spellCost(hero, a);
  const name = a === 'ATTACK' ? 'ATTACK' : SPELLS[a].name;
  return cost > 0 ? `${name} ${cost}MP` : `${name} FREE`;
}

interface MenuCell { x0: number; y: number; colW: number; sel: boolean }

function drawActionRow(g: Game, a: HeroAction, cell: MenuCell): void {
  const ctx = g.app.pc.ctx;
  const { x0, y, colW, sel } = cell;
  const afford = canAfford(g.hero, a);
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x0 + 2, y - 2, Math.round(colW) - 4, 9); }
  const labelColor = sel ? C_ACCENT : afford ? C_TEXT : PICO8[5];
  drawText(ctx, (sel ? '> ' : '  ') + actionLabel(g.hero, a), { x: x0 + 5, y }, { color: labelColor, shadow: sel });
  const info = actionInfo(g, a);
  const infoColor = info.warn ? PICO8[8] : sel ? C_TEXT : C_DIM;
  drawText(ctx, info.text, { x: x0 + Math.round(colW) - 5 - textWidth(info.text, 1), y }, { color: infoColor });
}

function renderActionMenu(g: Game): void {
  const { pc } = g.app;
  const actions = heroActions(g.hero);
  const rows = Math.min(3, actions.length);
  const cols = Math.ceil(actions.length / 3);
  const colW = (W - 2 * SAFE_MARGIN) / cols;
  const panelH = 10 + rows * 9;
  const panelY = H - SAFE_MARGIN - panelH;
  drawPanel(pc, { x: SAFE_MARGIN, y: panelY, w: W - 2 * SAFE_MARGIN, h: panelH }, { color: C_PANEL, border: C_BORDER });
  actions.forEach((a, i) => {
    const x0 = Math.round(SAFE_MARGIN + Math.floor(i / 3) * colW);
    drawActionRow(g, a, { x0, y: panelY + 5 + (i % 3) * 9, colW, sel: i === g.battle.menuCursor });
  });
}

function renderBattleText(g: Game): void {
  const { pc } = g.app;
  const color = g.battle.color;
  drawPanel(pc, { x: SAFE_MARGIN, y: H - SAFE_MARGIN - 22, w: W - 2 * SAFE_MARGIN, h: 22 }, { color: C_PANEL, border: C_BORDER });
  const lines = wrap2(g.battle.text, W - 2 * SAFE_MARGIN - 10);
  if (lines.length === 1) {
    drawTextCentered(pc.ctx, lines[0], { width: W, y: H - SAFE_MARGIN - 15 }, { color, shadow: true });
    return;
  }
  drawTextCentered(pc.ctx, lines[0], { width: W, y: H - SAFE_MARGIN - 18 }, { color, shadow: true });
  drawTextCentered(pc.ctx, lines[1], { width: W, y: H - SAFE_MARGIN - 10 }, { color, shadow: true });
}

export function renderBattle(g: Game): void {
  renderTableau(g, true);
  const d = derive(g.hero);
  renderEnemyHud(g);
  hudText(g.app.pc, `SCORE ${g.score}`, { h: 'right', v: 'top' }, { color: C_TEXT });
  renderHeroHud(g, d);
  if (g.battle.phase === 'MENU' && !g.heroDown) {renderActionMenu(g);} else {renderBattleText(g);}
  drawPops(g);
}
