import { PICO8 } from '../../engine';
import type { Rarity } from '../types';
import type { EventOption } from '../data';
import {
  appliedWords, applyEventCosts, discard, displayName, effectiveBlurb, eventOptionBlocker, pickEvent, rollEventItem, screenEffectOf,
} from '../sim';
import type { AppliedEffect } from '../sim';
import { heroPos, rarityColor } from '../theme';
import { dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game, PickRow } from '../state';
import { noop } from '../lookup';
import { itemIcon } from '../widgets';
import { showCard } from './card';
import { startLevelUp } from './levelup';
import { chooseUpgrade } from './loot';
import { openPick } from './pick';

export function startEvent(g: Game, onDone: () => void): void {
  const def = pickEvent(g.rng);
  const open = def.options.findIndex((o) => eventOptionBlocker(g.hero, o) === null);
  g.event = { def, cursor: Math.max(0, open), refusedAt: -1, onDone };
  g.subScene = 'EVENT';
  resetCursorEdge(g);
}

function backToEvent(g: Game): void {
  g.subScene = 'EVENT';
  resetCursorEdge(g);
}

interface Burst { color: string; sfx: 'hit' | 'pickup' | 'whoosh'; flash: boolean }

function burstOf(applied: AppliedEffect): Burst {
  const { effect, change } = applied;
  if (effect.kind === 'burnNextFight') {return { color: PICO8[9], sfx: 'whoosh', flash: true };}
  if (change < 0) {return { color: PICO8[8], sfx: 'hit', flash: true };}
  return { color: effect.kind === 'potion' ? PICO8[12] : PICO8[11], sfx: 'pickup', flash: false };
}

function juiceFor(g: Game, applied: readonly AppliedEffect[]): void {
  const hp = heroPos();
  applied.forEach((a, i) => {
    const b = burstOf(a);
    g.app.particles.burst(hp.x, hp.y - 6 * i, { count: 12, color: b.color, speed: 80 });
    if (b.flash) {g.app.juice.flash(b.color, 0.2, { x: hp.x, y: hp.y });}
    if (i === 0) {g.app.audio.play(b.sfx);}
  });
  if (applied.some((a) => a.change < 0 && a.effect.kind !== 'potion')) {g.app.juice.shake(3, 0.2);}
}

function payCosts(g: Game, option: EventOption): AppliedEffect[] {
  const applied = applyEventCosts(g.hero, option);
  juiceFor(g, applied);
  return applied;
}

const felt = (a: AppliedEffect): boolean => a.change !== 0 || a.effect.kind === 'burnNextFight';

function resultLines(g: Game, words: readonly string[], acted: boolean): string[] {
  if (words.length === 0) {return [g.event.def.title, acted ? 'NOTHING MORE TO GAIN' : 'YOU LEAVE IT BE'];}
  return [g.event.def.title, words.slice(0, 2).join('  '), words.slice(2).join('  ')].filter(Boolean);
}

function resultCard(g: Game, applied: readonly AppliedEffect[], extra: readonly string[] = []): void {
  const words = [...applied.filter(felt).map(appliedWords), ...extra];
  showCard(g, resultLines(g, words, applied.length > 0), g.event.onDone);
}

function afterScreen(g: Game, applied: readonly AppliedEffect[]): () => void {
  return applied.length > 0 ? () => { resultCard(g, applied); } : g.event.onDone;
}

function openUpgrade(g: Game, option: EventOption): void {
  g.loot = { offers: [], source: 'LOOT', cursor: 0, stow: false, onDone: noop };
  chooseUpgrade(g);
  const takeRow = g.pick.onPick;
  g.pick.onCancel = () => { backToEvent(g); };
  g.pick.onPick = (i) => {
    g.loot.onDone = afterScreen(g, payCosts(g, option));
    takeRow(i);
  };
}

function packRow(g: Game, i: number): PickRow | [] {
  const owned = g.hero.pack[i];
  if (!owned) {return [];}
  const name = displayName(owned.item, owned.level);
  return { icon: itemIcon(owned.item), name, color: rarityColor(owned.item), note: owned.item.slot, detail: [owned.item.rarity, effectiveBlurb(owned.item, owned.level)] };
}

function openDrop(g: Game, option: EventOption): void {
  const rows = g.hero.pack.flatMap((_, i) => packRow(g, i));
  openPick(g, {
    title: 'GIVE UP WHICH?',
    rows,
    cursor: 0,
    onPick: (i) => {
      const applied = payCosts(g, option);
      const gone = discard(g.hero, i);
      resultCard(g, applied, gone ? [`${gone.item.name} IS GONE`] : []);
    },
    onCancel: () => { backToEvent(g); },
  });
}

function offerItem(g: Game, rarity: Rarity, done: () => void): void {
  const item = rollEventItem(g.hero, rarity, g.n, g.rng);
  if (!item) { done(); return; }
  g.loot = { offers: [{ kind: 'ITEM', item }], source: 'LOOT', cursor: 0, stow: false, onDone: done };
  g.subScene = 'LOOT';
  resetCursorEdge(g);
}

function choose(g: Game, option: EventOption): void {
  const screen = screenEffectOf(option);
  if (screen?.kind === 'upgradeAny') { openUpgrade(g, option); return; }
  if (screen?.kind === 'dropPackItem') { openDrop(g, option); return; }
  const applied = payCosts(g, option);
  if (screen?.kind === 'sp') {
    g.hero.sp += screen.amount;
    startLevelUp(g, screen.amount, afterScreen(g, applied));
    return;
  }
  if (screen?.kind === 'item') { offerItem(g, screen.rarity, afterScreen(g, applied)); return; }
  resultCard(g, applied);
}

export function updateEvent(g: Game): void {
  const ev = g.event;
  const dy = dirEdge(g);
  if (dy) { ev.cursor = wrapCursor(ev.cursor, dy, ev.def.options.length); g.app.audio.play('blip'); }
  if (!g.app.input.pressed('A')) {return;}
  const option = ev.def.options[ev.cursor];
  if (!option || eventOptionBlocker(g.hero, option) !== null) {
    ev.refusedAt = g.clock;
    g.app.audio.play('blip');
    return;
  }
  g.app.audio.play('blip');
  choose(g, option);
}
