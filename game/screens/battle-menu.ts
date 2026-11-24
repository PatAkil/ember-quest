import type { HeroAction, HeroCommand, SpellId } from '../types';
import { canAfford, knownSpells } from '../sim';
import { showNote } from '../fx';
import { dirEdge, dirEdgeX } from '../state';
import type { Game } from '../state';
import type { TopCommand } from './battle-preview';

export const TOP_COMMANDS: readonly TopCommand[] = ['ATTACK', 'MAGIC', 'GUARD', 'BURST', 'POTION'];
export const MENU_COLS = 2;
export const PAGE_SIZE = 6;

const REFUSAL: Record<Exclude<HeroCommand, 'ATTACK' | 'GUARD'>, string> = {
  BURST: 'THE EMBER IS NOT FULL YET',
  POTION: 'NO POTIONS LEFT',
};

const rowsIn = (col: number, count: number): number => Math.ceil(Math.max(0, count - col) / MENU_COLS);

interface Step { dx: number; dy: number }

function stepInPage(local: number, count: number, step: Step): number {
  let col = local % MENU_COLS;
  let row = Math.floor(local / MENU_COLS);
  if (step.dx !== 0) {
    const next = (col + step.dx + MENU_COLS) % MENU_COLS;
    if (rowsIn(next, count) > 0) { col = next; row = Math.min(row, rowsIn(col, count) - 1); }
  }
  if (step.dy !== 0) {
    const n = rowsIn(col, count);
    row = (row + step.dy + n) % n;
  }
  return row * MENU_COLS + col;
}

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
  const page = Math.floor(cursor / PAGE_SIZE);
  const local = cursor - page * PAGE_SIZE;
  const count = pageLen(n, page);
  if (step.dy !== 0 && pageCount(n) > 1 && leavesPage(local, count, step.dy)) {return turnPage(cursor, n, step.dy);}
  return page * PAGE_SIZE + stepInPage(local, count, step);
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
  g.battle.menu = 'MAGIC';
  g.app.audio.play('blip');
  return null;
}

function chooseTop(g: Game, cmd: TopCommand): HeroAction | null {
  if (cmd === 'MAGIC') {return openMagic(g);}
  if (cmd !== 'ATTACK' && cmd !== 'GUARD' && !canAfford(g.hero, cmd)) {return refuse(g, REFUSAL[cmd]);}
  g.app.audio.play('blip');
  return cmd;
}

function topChoice(g: Game, e: Edges): HeroAction | null {
  const b = g.battle;
  if (e.dx !== 0 || e.dy !== 0) {
    b.topCursor = stepInPage(b.topCursor, TOP_COMMANDS.length, e);
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
  if (e.b) { b.menu = 'TOP'; g.app.audio.play('blip'); return null; }
  const spells = knownSpells(g.hero);
  if (e.dx !== 0 || e.dy !== 0) {
    b.magicCursor = moveMagic(b.magicCursor, spells.length, e);
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
