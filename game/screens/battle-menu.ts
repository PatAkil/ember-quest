import { PICO8, SAFE_MARGIN, drawText, textWidth } from '../../engine';
import { SPELLS } from '../data';
import type { DamageKind, Hero, HeroAction, HeroCommand, SpellId } from '../types';
import { canAfford, elementMult, heroActions, isSpell, resistOf, spellCost } from '../sim';
import { at } from '../lookup';
import { dirEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_FAINT, C_SEL_BAR, C_TEXT, C_WARN, H, W } from '../theme';
import { hasHex, magicWeapon } from './battle-fx';

function actionKind(hero: Hero, a: HeroAction): DamageKind {
  const hex = hasHex(hero);
  if (!isSpell(a)) {return hex || magicWeapon(hero) ? 'MAGIC' : 'PHYSICAL';}
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

const COMMAND_INFO: Record<Exclude<HeroCommand, 'ATTACK'>, SpellInfo> = {
  GUARD: { info: 'HALVES HIT', short: 'x0.5', isHeal: true },
  BURST: { info: 'EMBER x2.5', short: 'x2.5', isHeal: true },
  POTION: { info: 'HEAL 40%', short: '40%', isHeal: true },
};

function infoOf(hero: Hero, a: HeroAction): SpellInfo {
  if (isSpell(a)) {return spellInfo(a);}
  return a === 'ATTACK' ? attackInfo(hero) : COMMAND_INFO[a];
}

interface ActionInfo { text: string; short: string; tiny: string; warn: boolean }

function elementTag(g: Game, a: HeroAction): string {
  const enemy = g.battle.enemy;
  const mult = enemy && isSpell(a) ? elementMult(enemy.def, SPELLS[a].element) : 1;
  if (mult === 1) {return '';}
  return mult > 1 ? ' WEAK' : ' RESIST';
}

function actionInfo(g: Game, a: HeroAction): ActionInfo {
  const hero = g.hero;
  const kind = actionKind(hero, a);
  const enemy = g.battle.enemy;
  const res = enemy ? resistOf(enemy, kind) : 0;
  const { info, short, isHeal } = infoOf(hero, a);
  const tag = (!isHeal && res >= 20 ? ` -${res}%` : '') + elementTag(g, a);
  return { text: info + tag, short: short + tag, tiny: short, warn: tag !== '' };
}

function actionLabel(hero: Hero, a: HeroAction): string {
  const cost = isSpell(a) ? spellCost(hero, a) : 0;
  const name = isSpell(a) ? SPELLS[a].name : a;
  return cost > 0 ? `${name} ${cost}MP` : `${name} FREE`;
}

const ROW_GAP = 7;
const INFO_PAD = 9;
const BAR_INSET = 3;

type InfoFit = 'text' | 'short' | 'tiny';
const INFO_FITS: readonly InfoFit[] = ['text', 'short', 'tiny'];

interface MenuCell { x0: number; y: number; colW: number; sel: boolean; fit: InfoFit }

const rowLabel = (hero: Hero, a: HeroAction, sel: boolean): string => (sel ? '> ' : '  ') + actionLabel(hero, a);

function overflows(g: Game, a: HeroAction, colW: number, fit: InfoFit): boolean {
  const room = Math.round(colW) - 5 - INFO_PAD - textWidth(rowLabel(g.hero, a, true), 1) - ROW_GAP;
  return textWidth(actionInfo(g, a)[fit], 1) > room;
}

function drawActionRow(g: Game, a: HeroAction, cell: MenuCell): void {
  const ctx = g.app.pc.ctx;
  const { x0, y, colW, sel, fit } = cell;
  const afford = canAfford(g.hero, a);
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x0 + BAR_INSET, y - 2, Math.round(colW) - 2 * BAR_INSET, 9); }
  const labelColor = sel ? C_ACCENT : afford ? C_TEXT : C_FAINT;
  const label = rowLabel(g.hero, a, sel);
  drawText(ctx, label, { x: x0 + 5, y }, { color: labelColor, shadow: sel });
  const info = actionInfo(g, a);
  const text = info[fit];
  const infoColor = info.warn ? C_WARN : sel ? C_TEXT : C_DIM;
  drawText(ctx, text, { x: x0 + Math.round(colW) - INFO_PAD - textWidth(text, 1), y }, { color: infoColor });
}

const ROW_PITCH = 9;
const BAND_BOTTOM = H - SAFE_MARGIN;
const LOG_ROOM = BAND_BOTTOM - BAND_Y - 1;

export function renderActionMenu(g: Game): void {
  const ctx = g.app.pc.ctx;
  const actions = heroActions(g.hero);
  const cols = Math.ceil(actions.length / 3);
  const colW = (W - 2 * SAFE_MARGIN) / cols;
  ctx.fillStyle = PICO8[5];
  for (let c = 1; c < cols; c++) { ctx.fillRect(Math.round(SAFE_MARGIN + c * colW), BAND_Y + 4, 1, BAND_BOTTOM - BAND_Y - 4); }
  const fit = INFO_FITS.find((f) => !actions.some((a) => overflows(g, a, colW, f))) ?? 'tiny';
  const rows = Math.min(3, actions.length);
  const top = BAND_Y + 1 + Math.round((LOG_ROOM - (rows * ROW_PITCH - 4)) / 2);
  actions.forEach((a, i) => {
    const x0 = Math.round(SAFE_MARGIN + Math.floor(i / 3) * colW);
    drawActionRow(g, a, { x0, y: top + (i % 3) * ROW_PITCH, colW, sel: i === g.battle.menuCursor, fit });
  });
}

export function menuChoice(g: Game, pressedA: boolean): HeroAction | null {
  const actions = heroActions(g.hero);
  const dy = dirEdge(g);
  if (dy) { g.battle.menuCursor = wrapCursor(g.battle.menuCursor, dy, actions.length); g.app.audio.play('blip'); }
  if (!pressedA) {return null;}
  g.app.audio.play('blip');
  return at(actions, g.battle.menuCursor);
}

export function clampMenuCursor(g: Game): void {
  g.battle.menuCursor = Math.min(g.battle.menuCursor, heroActions(g.hero).length - 1);
}
