import { PICO8 } from '../../engine';
import { ITEMS, SPELLS } from '../data';
import type { LootOffer, LootSource, SpellId } from '../types';
import { applyOffer, compareOffer, displayName, noteDeclinedScrolls, rollLoot, skipMend } from '../sim';
import { dirEdge, pickOne, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { C_ACCENT, heroPos } from '../theme';
import { showCard } from './card';

type ItemOffer = Extract<LootOffer, { kind: 'ITEM' }>;
type UpgradeOffer = Extract<LootOffer, { kind: 'UPGRADE' }>;
type Applied = ReturnType<typeof applyOffer>;

function ensureStarterWeapon(g: Game, offers: LootOffer[]): void {
  const itemIdx = offers.map((o, i) => (o.kind === 'ITEM' ? i : -1)).filter((i) => i >= 0);
  const lastItem = itemIdx[itemIdx.length - 1];
  if (g.hero.equipment.WEAPON || lastItem === undefined || offers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON')) {return;}
  const starters = ITEMS.filter((i) => i.slot === 'WEAPON' && i.rarity === 'COMMON' && (i.minAct ?? 0) <= g.actIndex);
  if (starters.length) {offers[lastItem] = { kind: 'ITEM', item: pickOne(g.rng, starters) };}
}

export function startLoot(g: Game, source: LootSource, onDone: () => void): void {
  const offers = rollLoot(source, g.actIndex, g.hero, g.rng);
  ensureStarterWeapon(g, offers);
  g.loot = { offers, source, cursor: 0, onDone };
  if (offers.length === 0) {
    if (source === 'FIGHT') { onDone(); return; }
    const m = skipMend(g.hero);
    showCard(g, ['THE CACHE IS BARE', `MENDED ${m.hp} HP AND ${m.mp} MP`], onDone);
    return;
  }
  g.subScene = 'LOOT';
  resetCursorEdge(g);
}

function learnedScroll(g: Game, spell: SpellId): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y - 10, { count: 14, color: PICO8[12], speed: 100 });
  g.app.juice.flash(PICO8[12], 0.3);
  const sp = SPELLS[spell];
  showCard(g, [`YOU LEARNED ${sp.name}!`, `${sp.scale} x${sp.mult.toFixed(1)}${sp.hits > 1 ? ` x${sp.hits}` : ''}  ${sp.cost} MP  ${sp.kind}`], g.loot.onDone);
}

function equipped(g: Game, offer: ItemOffer, r: Applied): void {
  showCard(g, [`EQUIPPED ${offer.item.name}`, r.replaced ? `${r.replaced.name} IS LEFT BEHIND` : offer.item.blurb], g.loot.onDone);
}

function upgraded(g: Game, offer: UpgradeOffer, r: Applied, delta: string): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y, { count: 12, color: C_ACCENT, speed: 90 });
  const awakens = offer.toLevel >= 2;
  showCard(g, [awakens ? `${offer.item.name} AWAKENS!` : displayName(offer.item, offer.toLevel), awakens ? r.line : delta], g.loot.onDone);
}

function takeOffer(g: Game, offer: LootOffer): void {
  const delta = compareOffer(g.hero, offer);
  const r = applyOffer(g.hero, offer, g.rng);
  noteDeclinedScrolls(g.hero, g.loot.offers, offer);
  g.app.audio.play('pickup');
  switch (offer.kind) {
    case 'SCROLL': learnedScroll(g, offer.spell); break;
    case 'ITEM': equipped(g, offer, r); break;
    case 'UPGRADE': upgraded(g, offer, r, delta); break;
  }
}

function keepGear(g: Game): void {
  const m = skipMend(g.hero);
  noteDeclinedScrolls(g.hero, g.loot.offers, null);
  g.app.audio.play('pickup');
  showCard(g, ['YOU KEEP YOUR GEAR', `MENDED ${m.hp} HP AND ${m.mp} MP`], g.loot.onDone);
}

export function updateLoot(g: Game): void {
  const loot = g.loot;
  const dy = dirEdge(g);
  if (dy) { loot.cursor = wrapCursor(loot.cursor, dy, loot.offers.length + 1); g.app.audio.play('blip'); }
  if (!g.app.input.pressed('A')) {return;}
  const offer = loot.offers[loot.cursor];
  if (offer) {takeOffer(g, offer);} else {keepGear(g);}
}
