import { SLOTS } from '../types';
import { swapIn, unequip } from '../sim';
import { dirEdge, dirEdgeX, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';

export function openGear(g: Game): void {
  g.gear = { cursor: 0 };
  g.subScene = 'GEAR';
  resetCursorEdge(g);
}

const gearRowCount = (g: Game): number => SLOTS.length + g.hero.pack.length;

function closeGear(g: Game): void {
  g.subScene = 'MAP';
  resetCursorEdge(g);
}

function actOnRow(g: Game): boolean {
  const { cursor } = g.gear;
  const slot = SLOTS[cursor];
  if (slot) {return unequip(g.hero, slot);}
  return swapIn(g.hero, cursor - SLOTS.length);
}

function crossColumn(g: Game, dx: number): number {
  const { cursor } = g.gear;
  if (dx > 0 && cursor < SLOTS.length) {return g.hero.pack.length > 0 ? SLOTS.length : cursor;}
  const packed = g.hero.pack[cursor - SLOTS.length];
  if (dx < 0 && packed) {return SLOTS.indexOf(packed.item.slot);}
  return cursor;
}

function moveCursor(g: Game): void {
  const dy = dirEdge(g);
  const dx = dirEdgeX(g);
  const next = dy ? wrapCursor(g.gear.cursor, dy, gearRowCount(g)) : crossColumn(g, dx);
  if (next === g.gear.cursor) {return;}
  g.gear.cursor = next;
  g.app.audio.play('blip');
}

export function updateGear(g: Game): void {
  const { input, audio } = g.app;
  moveCursor(g);
  if (input.pressed('B')) { audio.play('blip'); closeGear(g); return; }
  if (input.pressed('A')) {audio.play(actOnRow(g) ? 'pickup' : 'blip');}
}
