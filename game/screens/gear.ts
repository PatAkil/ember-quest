import { SLOTS } from '../types';
import type { OwnedItem } from '../types';
import { itemLevel, swapIn, unequip } from '../sim';
import { dirEdge, dirEdgeX, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { rarityColor } from '../theme';

const REFUSAL_SHOWN = 1.2;

export function openGear(g: Game): void {
  g.gear = { cursor: 0, refusedAt: -1 };
  g.subScene = 'GEAR';
  resetCursorEdge(g);
}

const gearRowCount = (g: Game): number => SLOTS.length + g.hero.pack.length;

export function wornAt(g: Game, row: number): OwnedItem | undefined {
  const slot = SLOTS[row];
  const item = slot ? g.hero.equipment[slot] : undefined;
  return slot && item ? { item, level: itemLevel(g.hero, slot) } : undefined;
}

export const packedAt = (g: Game, row: number): OwnedItem | undefined =>
  row < SLOTS.length ? undefined : g.hero.pack[row - SLOTS.length];

export const refusalShowing = (g: Game): boolean => g.gear.refusedAt >= 0 && g.clock - g.gear.refusedAt < REFUSAL_SHOWN;

function closeGear(g: Game): void {
  g.subScene = 'MAP';
  resetCursorEdge(g);
}

function packRowFor(g: Game, cursor: number): number {
  const slot = SLOTS[cursor];
  const same = g.hero.pack.findIndex((o) => o.item.slot === slot);
  return SLOTS.length + (same >= 0 ? same : Math.min(cursor, g.hero.pack.length - 1));
}

function crossColumn(g: Game, dx: number): number {
  const { cursor } = g.gear;
  if (dx > 0 && cursor < SLOTS.length) {return g.hero.pack.length > 0 ? packRowFor(g, cursor) : cursor;}
  const packed = packedAt(g, cursor);
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

function celebrate(g: Game, owned: OwnedItem | undefined): void {
  g.app.audio.play('pickup');
  if (owned) {g.app.juice.flash(rarityColor(owned.item), 0.12);}
}

function refuse(g: Game): void {
  g.app.audio.play('blip');
  g.gear.refusedAt = g.clock;
}

function actOnRow(g: Game): void {
  const { cursor } = g.gear;
  const slot = SLOTS[cursor];
  if (slot) {
    const worn = wornAt(g, cursor);
    if (!worn) {return;}
    if (unequip(g.hero, slot)) {g.app.audio.play('pickup');} else {refuse(g);}
    return;
  }
  const incoming = packedAt(g, cursor);
  if (swapIn(g.hero, cursor - SLOTS.length)) {celebrate(g, incoming);}
  g.gear.cursor = Math.min(g.gear.cursor, gearRowCount(g) - 1);
}

export function updateGear(g: Game): void {
  moveCursor(g);
  if (g.app.input.pressed('B')) { g.app.audio.play('blip'); closeGear(g); return; }
  if (g.app.input.pressed('A')) {actOnRow(g);}
}
