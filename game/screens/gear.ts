import { SLOTS } from '../types';
import type { OwnedItem, Slot } from '../types';
import { itemLevel, swapIn, unequip } from '../sim';
import { armA, dirEdge, dirEdgeX, resetCursorEdge, takeA, wrapCursor } from '../state';
import type { Game } from '../state';
import { rarityColor } from '../theme';
import { persist } from '../persist';

const REFUSAL_SHOWN = 1.2;

export function openGear(g: Game): void {
  g.gear = { cursor: 0, refusedAt: -1 };
  g.subScene = 'GEAR';
  resetCursorEdge(g);
  armA(g);
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
  armA(g);
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

function wearFromPack(g: Game, index: number): void {
  const incoming = g.hero.pack[index];
  if (swapIn(g.hero, index)) {celebrate(g, incoming);} else {refuse(g);}
}

function actOnSlot(g: Game, slot: Slot): void {
  if (wornAt(g, g.gear.cursor)) {
    if (unequip(g.hero, slot)) {g.app.audio.play('pickup');} else {refuse(g);}
    return;
  }
  const fits = fittingRows(g, slot);
  const [only] = fits;
  if (only === undefined) { g.app.audio.play('blip'); return; }
  if (fits.length > 1) { g.gear.cursor = SLOTS.length + only; g.app.audio.play('blip'); return; }
  wearFromPack(g, only);
}

export function fittingRows(g: Game, slot: Slot): number[] {
  return g.hero.pack.flatMap((o, i) => (o.item.slot === slot ? [i] : []));
}

function actOnRow(g: Game): void {
  const slot = SLOTS[g.gear.cursor];
  if (slot) { actOnSlot(g, slot); return; }
  wearFromPack(g, g.gear.cursor - SLOTS.length);
  g.gear.cursor = Math.min(g.gear.cursor, gearRowCount(g) - 1);
}

export function updateGear(g: Game): void {
  moveCursor(g);
  if (g.app.input.pressed('B')) { g.app.audio.play('blip'); closeGear(g); return; }
  if (takeA(g)) { actOnRow(g); persist(g, { at: 'MAP' }); }
}
