import { BUTTON_KEY, PICO8, SAFE_MARGIN, drawText, drawTextCentered, textWidth } from '../../engine';
import { SPELLS } from '../data';
import { canAfford, canDrinkPotion, knownSpells, spellCost } from '../sim';
import { noteText } from '../fx';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_EMBER, C_FAINT, C_GOOD, C_SEL_BAR, C_TEXT, C_WARN, H, W } from '../theme';
import { accentHz } from '../widgets';
import { MENU_COLS, PAGE_SIZE, TOP_COMMANDS, pageCount } from './battle-menu';
import { attackWeak, breakNote, intentHint, previewSpell, previewTop, weakSpells } from './battle-preview';
import type { PreviewLine, TopCommand } from './battle-preview';

type Ctx = CanvasRenderingContext2D;

const HINT_Y = BAND_Y + 3;
const RULE_Y = BAND_Y + 10;
const ROW_Y = BAND_Y + 13;
const ROW_PITCH = 8;
const COL_W = 68;
const GRID_X = SAFE_MARGIN;
const DIVIDER_X = GRID_X + MENU_COLS * COL_W + 2;
const INFO_X = DIVIDER_X + 4;
const INFO_W = W - SAFE_MARGIN - INFO_X;
const SEG_GAP = 4;
const BAND_BOTTOM = H - SAFE_MARGIN;

interface Cell { label: string; note: string; color: string; sel: boolean; noteColor?: string; inset?: number }

function cellAt(i: number): { x: number; y: number } {
  return { x: GRID_X + (i % MENU_COLS) * COL_W, y: ROW_Y + Math.floor(i / MENU_COLS) * ROW_PITCH };
}

function drawCell(ctx: Ctx, i: number, cell: Cell): void {
  const { x, y } = cellAt(i);
  if (cell.sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x + 1, y - 2, COL_W - 2, 9); }
  drawText(ctx, (cell.sel ? '> ' : '  ') + cell.label, { x: x + 3, y }, { color: cell.color, shadow: cell.sel });
  const noteX = x + COL_W - 3 - (cell.inset ?? 0) - textWidth(cell.note, 1);
  if (cell.note) {drawText(ctx, cell.note, { x: noteX, y }, { color: cell.noteColor ?? (cell.sel ? C_TEXT : C_DIM) });}
}

function labelColor(sel: boolean, ready: boolean, warm = false): string {
  if (!ready) {return sel ? C_DIM : C_FAINT;}
  if (sel) {return C_ACCENT;}
  return warm ? C_EMBER : C_TEXT;
}

const NOTE_INSET = 4;
const NOTE_INSET_HINTED = 9;
const WEAK_NOTE = { note: 'WEAK', noteColor: C_GOOD };

function weakNote(g: Game, cmd: TopCommand): { note: string; noteColor?: string } {
  const verdict = breakNote(g, cmd);
  if (verdict) {return verdict;}
  const e = g.battle.enemy;
  if (!e) {return { note: '' };}
  if (cmd === 'ATTACK' && attackWeak(g.hero, e)) {return WEAK_NOTE;}
  return cmd === 'MAGIC' && weakSpells(g.hero, e).length > 0 ? WEAK_NOTE : { note: '' };
}

function topCell(g: Game, cmd: TopCommand, sel: boolean): Cell {
  const hero = g.hero;
  const inset = sel && showsColumnHint(g) ? NOTE_INSET_HINTED : NOTE_INSET;
  if (cmd === 'POTION') {return { label: `POTION X${hero.potions}`, note: '', color: labelColor(sel, canDrinkPotion(hero)), sel };}
  if (cmd === 'BURST') {return { label: 'BURST', ...weakNote(g, cmd), color: labelColor(sel, canAfford(hero, 'BURST'), true), sel, inset };}
  if (cmd === 'MAGIC') {return { label: 'MAGIC', ...weakNote(g, cmd), color: labelColor(sel, knownSpells(hero).length > 0), sel, inset };}
  return { label: cmd, ...weakNote(g, cmd), color: labelColor(sel, true), sel, inset };
}

function hasColumnHint(cursor: number): boolean {
  const other = cursor + (cursor % MENU_COLS === 0 ? 1 : -1);
  return other >= 0 && other < TOP_COMMANDS.length;
}

function showsColumnHint(g: Game): boolean {
  const cmd = TOP_COMMANDS[g.battle.topCursor];
  return hasColumnHint(g.battle.topCursor) && !(cmd && breakNote(g, cmd));
}

function drawColumnHint(g: Game, ctx: Ctx, cursor: number): void {
  if (!showsColumnHint(g)) {return;}
  const { x, y } = cellAt(cursor);
  drawText(ctx, cursor % MENU_COLS === 0 ? '>' : '<', { x: x + COL_W - 6, y }, { color: C_DIM });
}

function drawTop(g: Game): void {
  const ctx = g.app.pc.ctx;
  TOP_COMMANDS.forEach((cmd, i) => { drawCell(ctx, i, topCell(g, cmd, i === g.battle.topCursor)); });
  drawColumnHint(g, ctx, g.battle.topCursor);
}

function drawMagic(g: Game): void {
  const ctx = g.app.pc.ctx;
  const spells = knownSpells(g.hero);
  const weak = g.battle.enemy ? weakSpells(g.hero, g.battle.enemy) : [];
  const page = Math.floor(g.battle.magicCursor / PAGE_SIZE);
  spells.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).forEach((id, i) => {
    const sel = page * PAGE_SIZE + i === g.battle.magicCursor;
    const ready = canAfford(g.hero, id);
    const color = ready && !sel && weak.includes(id) ? C_GOOD : labelColor(sel, ready);
    const noteColor = ready ? undefined : C_WARN;
    drawCell(ctx, i, { label: SPELLS[id].name, note: `${spellCost(g.hero, id)}MP`, color, sel, noteColor });
  });
}

function fitSegs(segs: PreviewLine): PreviewLine {
  const kept: PreviewLine[number][] = [];
  let used = 0;
  for (const s of segs) {
    const w = textWidth(s.text, 1) + (kept.length ? SEG_GAP : 0);
    if (used + w > INFO_W) {break;}
    kept.push(s); used += w;
  }
  return kept;
}

function drawInfoLine(ctx: Ctx, segs: PreviewLine, y: number): void {
  let x = INFO_X;
  for (const s of fitSegs(segs)) {
    drawText(ctx, s.text, { x, y }, { color: s.color });
    x += textWidth(s.text, 1) + SEG_GAP;
  }
}

function magicFooter(g: Game): PreviewLine {
  const n = knownSpells(g.hero).length;
  const pages = pageCount(n);
  const page = pages > 1 ? `  ${g.battle.magicPage + 1}/${pages}` : '';
  return [{ text: `${BUTTON_KEY.B.hint} BACK${page}`, color: C_DIM }];
}

function previewLines(g: Game): PreviewLine[] {
  const b = g.battle;
  if (b.menu === 'TOP') {return previewTop(g, TOP_COMMANDS[b.topCursor] ?? 'ATTACK');}
  const spell = knownSpells(g.hero)[b.magicCursor];
  const lines = spell ? previewSpell(g, spell) : [];
  const third = lines[2];
  return third && third.length > 0 ? lines : [...lines.slice(0, 2), magicFooter(g)];
}

function drawInfo(g: Game): void {
  const ctx = g.app.pc.ctx;
  previewLines(g).slice(0, 3).forEach((segs, i) => { drawInfoLine(ctx, segs, ROW_Y + i * ROW_PITCH); });
}

function drawHint(g: Game): void {
  const ctx = g.app.pc.ctx;
  const note = noteText(g);
  const { enemy: e, state } = g.battle;
  if (note) { drawTextCentered(ctx, note, { width: W, y: HINT_Y }, { color: C_WARN, shadow: true }); return; }
  if (!e || !state) {return;}
  const look = intentHint(e, state, g.hero);
  const color = look.hot && accentHz(g.clock, 2, 0.5) ? C_TEXT : look.color;
  drawTextCentered(ctx, look.hint, { width: W, y: HINT_Y }, { color, shadow: true });
}

function drawRules(ctx: Ctx): void {
  ctx.fillStyle = PICO8[5];
  for (let x = SAFE_MARGIN; x < W - SAFE_MARGIN; x += 2) {ctx.fillRect(x, RULE_Y, 1, 1);}
  ctx.fillRect(DIVIDER_X, RULE_Y + 2, 1, BAND_BOTTOM - RULE_Y - 2);
}

export function renderActionMenu(g: Game): void {
  drawHint(g);
  drawRules(g.app.pc.ctx);
  if (g.battle.menu === 'MAGIC') {drawMagic(g);} else {drawTop(g);}
  drawInfo(g);
}
