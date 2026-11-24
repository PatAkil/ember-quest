import type { HeroAction, HeroCommand, SpellId } from '../types';
import { canAfford, knownSpells } from '../sim';
import { clearNote, showNote } from '../fx';
import { DECIDE_BEAT, armA, dirEdge, dirEdgeX } from '../state';
import type { Game } from '../state';
import type { TopCommand } from './battle-preview';

export const TOP_COMMANDS: readonly TopCommand[] = ['ATTACK', 'MAGIC', 'GUARD', 'BURST', 'POTION'];
export const MENU_COLS = 2;
export const PAGE_SIZE = 6;

const REFUSAL: Record<Exclude<HeroCommand, 'ATTACK' | 'GUARD'>, (g: Game) => string> = {
  BURST: () => 'THE EMBER IS NOT FULL YET',
  POTION: (g) => (g.hero.potions > 0 ? 'YOUR HP IS FULL' : 'NO POTIONS LEFT'),
};

const rowsIn = (col: number, count: number): number => Math.ceil(Math.max(0, count - col) / MENU_COLS);

interface Step { dx: number; dy: number }

function stepInPage(local: number, count: number, dy: number): number {
  const col = local % MENU_COLS;
  const rows = rowsIn(col, count);
  const row = (Math.floor(local / MENU_COLS) + dy + rows) % rows;
  return row * MENU_COLS + col;
}

const stepAcross = (cursor: number, n: number, dx: number): number => (cursor + dx + n) % n;

export const pageCount = (n: number): number => Math.max(1, Math.ceil(n / PAGE_SIZE));
const pageLen = (n: number, page: number): number => Math.min(PAGE_SIZE, n - page * PAGE_SIZE);

function leavesPage(local: number, count: number, dy: number): boolean {
  const col = local % MENU_COLS;
  const row = Math.floor(local / MENU_COLS) + dy;
  return row < 0 || row >= rowsIn(col, count);
}

function turnPage(cursor: number, n: number, dy: number): number {
  const pages = pageCount(n);
  const page = (Math.floor(cursor / PAGE_SIZE) + dy + pages) % pages;
  const count = pageLen(n, page);
  const col = Math.min(cursor % MENU_COLS, count - 1);
  const row = dy > 0 ? 0 : rowsIn(col, count) - 1;
  return page * PAGE_SIZE + row * MENU_COLS + col;
}

function moveMagic(cursor: number, n: number, step: Step): number {
  if (step.dx !== 0) {return stepAcross(cursor, n, step.dx);}
  const page = Math.floor(cursor / PAGE_SIZE);
  const local = cursor - page * PAGE_SIZE;
  const count = pageLen(n, page);
  if (pageCount(n) > 1 && leavesPage(local, count, step.dy)) {return turnPage(cursor, n, step.dy);}
  return page * PAGE_SIZE + stepInPage(local, count, step.dy);
}

function refuse(g: Game, text: string): null {
  showNote(g, text);
  g.app.audio.play('blip');
  return null;
}

function syncCursor(g: Game): void {
  const b = g.battle;
  b.magicPage = Math.floor(b.magicCursor / PAGE_SIZE);
  b.menuCursor = b.menu === 'TOP' ? b.topCursor : b.magicCursor;
}

interface Edges extends Step { a: boolean; b: boolean }

function openMagic(g: Game): null {
  if (knownSpells(g.hero).length === 0) {return refuse(g, 'NO SPELLS KNOWN');}
  clearNote(g);
  g.battle.menu = 'MAGIC';
  g.app.audio.play('blip');
  return null;
}

function chooseTop(g: Game, cmd: TopCommand): HeroAction | null {
  if (cmd === 'MAGIC') {return openMagic(g);}
  if (cmd !== 'ATTACK' && cmd !== 'GUARD' && !canAfford(g.hero, cmd)) {return refuse(g, REFUSAL[cmd](g));}
  g.app.audio.play('blip');
  return cmd;
}

function topChoice(g: Game, e: Edges): HeroAction | null {
  const b = g.battle;
  if (e.dx !== 0 || e.dy !== 0) {
    b.topCursor = e.dx !== 0 ? stepAcross(b.topCursor, TOP_COMMANDS.length, e.dx) : stepInPage(b.topCursor, TOP_COMMANDS.length, e.dy);
    clearNote(g);
    g.app.audio.play('blip');
  }
  const cmd = TOP_COMMANDS[b.topCursor];
  return e.a && cmd ? chooseTop(g, cmd) : null;
}

function castChoice(g: Game, spell: SpellId): HeroAction | null {
  if (!canAfford(g.hero, spell)) {return refuse(g, 'NOT ENOUGH MP');}
  g.battle.menu = 'TOP';
  g.app.audio.play('blip');
  return spell;
}

function magicChoice(g: Game, e: Edges): HeroAction | null {
  const b = g.battle;
  if (e.b) { b.menu = 'TOP'; clearNote(g); g.app.audio.play('blip'); return null; }
  const spells = knownSpells(g.hero);
  if (e.dx !== 0 || e.dy !== 0) {
    b.magicCursor = moveMagic(b.magicCursor, spells.length, e);
    clearNote(g);
    g.app.audio.play('blip');
  }
  const spell = spells[b.magicCursor];
  return e.a && spell ? castChoice(g, spell) : null;
}

export function menuChoice(g: Game, pressedA: boolean): HeroAction | null {
  const edges: Edges = { dx: dirEdgeX(g), dy: dirEdge(g), a: pressedA, b: g.app.input.pressed('B') };
  const chosen = g.battle.menu === 'MAGIC' ? magicChoice(g, edges) : topChoice(g, edges);
  syncCursor(g);
  return chosen;
}

export function clampMenuCursor(g: Game): void {
  const b = g.battle;
  b.topCursor = Math.min(Math.max(0, b.topCursor), TOP_COMMANDS.length - 1);
  b.magicCursor = Math.min(Math.max(0, b.magicCursor), Math.max(0, knownSpells(g.hero).length - 1));
  syncCursor(g);
}

const ONE_SHOT: ReadonlySet<TopCommand> = new Set<TopCommand>(['POTION', 'BURST']);

export function reopenMenu(g: Game): void {
  const b = g.battle;
  b.menu = 'TOP';
  clearNote(g);
  if (ONE_SHOT.has(TOP_COMMANDS[b.topCursor] ?? 'ATTACK')) {b.topCursor = 0;}
  clampMenuCursor(g);
  armA(g, TOP_COMMANDS[b.topCursor] === 'MAGIC' ? DECIDE_BEAT : 0);
}
