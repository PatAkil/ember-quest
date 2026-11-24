import { BUTTON_KEY, PICO8, SAFE_MARGIN, drawPanel, drawText, textWidth } from '../../engine';
import type { EventEffect, EventOption } from '../data';
import { POTIONS_MAX } from '../types';
import type { Hero } from '../types';
import { derive, effectIsGain, effectWords, eventOptionBlocker } from '../sim';
import { renderTableau } from '../backdrop';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_BORDER, C_DIM, C_FAINT, C_GOOD, C_LOG_HURT, C_PANEL, C_SEL_BAR, C_TEXT, C_WARN, HERO_W, HERO_X, W } from '../theme';
import { blinkHz, drawCommandBand } from '../widgets';

const X0 = HERO_X + HERO_W / 2 + 12;
const PW = W - SAFE_MARGIN - X0;
const PANEL_H = 46;
const ROW_X = SAFE_MARGIN;
const ROW_W = 134;
const ROW_Y = BAND_Y + 8;
const ROW_PITCH = 11;
const DIVIDER_X = 146;
const PREVIEW_X = 150;
const PREVIEW_PITCH = 8;
const PROMPT_Y = BAND_Y + 33;
const REFUSE_SECONDS = 1.4;

interface Ink { text: string; color: string }

const panelCentre = (text: string, scale: number): number => Math.round(X0 + (PW - textWidth(text, scale)) / 2);

function drawStory(g: Game, ctx: CanvasRenderingContext2D): void {
  const { def } = g.event;
  drawPanel(g.app.pc, { x: X0, y: SAFE_MARGIN, w: PW, h: PANEL_H }, { color: C_PANEL, border: C_BORDER });
  const scale = textWidth(def.title, 2) <= PW - 8 ? 2 : 1;
  drawText(ctx, def.title, { x: panelCentre(def.title, scale), y: SAFE_MARGIN + (scale === 2 ? 5 : 7) }, { color: C_ACCENT, scale, shadow: true });
  ctx.fillStyle = PICO8[9];
  ctx.fillRect(X0 + PW / 2 - 16, SAFE_MARGIN + 18, 32, 1);
  def.lines.forEach((line, i) => {
    if (line) {drawText(ctx, line, { x: panelCentre(line, 1), y: SAFE_MARGIN + 24 + i * 8 }, { color: C_TEXT, shadow: true });}
  });
}

function rowColor(sel: boolean, open: boolean): string {
  if (!open) {return sel ? C_DIM : C_FAINT;}
  return sel ? C_ACCENT : C_TEXT;
}

function drawOption(g: Game, ctx: CanvasRenderingContext2D, option: EventOption, i: number): void {
  const y = ROW_Y + i * ROW_PITCH;
  const sel = i === g.event.cursor;
  const open = eventOptionBlocker(g.hero, option) === null;
  if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(ROW_X, y - 2, ROW_W, 9); }
  drawText(ctx, `${sel ? '> ' : '  '}${option.label}`, { x: ROW_X + 2, y }, { color: rowColor(sel, open), shadow: sel });
}

const healsHp = (e: EventEffect): boolean => e.kind === 'fullHeal' || (e.kind === 'hpPct' && e.amount > 0);

function effectInk(hero: Hero, e: EventEffect): Ink {
  if (e.kind === 'potion' && e.amount > 0 && hero.potions >= POTIONS_MAX) {return { text: 'POTIONS ALREADY FULL', color: C_DIM };}
  if (healsHp(e) && hero.hp >= derive(hero).maxHp) {return { text: 'ALREADY AT FULL HP', color: C_DIM };}
  return { text: effectWords(e), color: effectIsGain(e) ? C_GOOD : C_LOG_HURT };
}

function previewInks(g: Game, option: EventOption): Ink[] {
  const why = eventOptionBlocker(g.hero, option);
  if (why) {return [{ text: why, color: C_WARN }];}
  if (option.effects.length === 0) {return [{ text: 'NOTHING HAPPENS', color: C_DIM }];}
  return option.effects.map((e) => effectInk(g.hero, e));
}

function drawPreview(g: Game, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = PICO8[5];
  ctx.fillRect(DIVIDER_X, BAND_Y + 4, 1, 36);
  const option = g.event.def.options[g.event.cursor];
  if (!option) {return;}
  previewInks(g, option).slice(0, 4).forEach((ink, i) => {
    drawText(ctx, ink.text, { x: PREVIEW_X, y: BAND_Y + 6 + i * PREVIEW_PITCH }, { color: ink.color });
  });
}

function promptInk(g: Game): Ink {
  const refused = g.event.refusedAt >= 0 && g.clock - g.event.refusedAt < REFUSE_SECONDS;
  if (refused) {return { text: 'YOU CANNOT PAY THAT PRICE', color: C_WARN };}
  return { text: `${BUTTON_KEY.A.hint} CHOOSE`, color: blinkHz(g.clock, 1.2) ? C_TEXT : C_DIM };
}

export function renderEvent(g: Game): void {
  const { pc } = g.app;
  const ctx = pc.ctx;
  renderTableau(g, false);
  drawStory(g, ctx);
  drawCommandBand(ctx);
  g.event.def.options.forEach((o, i) => { drawOption(g, ctx, o, i); });
  drawPreview(g, ctx);
  const prompt = promptInk(g);
  drawText(ctx, prompt.text, { x: ROW_X + 4, y: PROMPT_Y }, { color: prompt.color, shadow: true });
}
