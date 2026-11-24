import { ITEMS, SPELLS } from '../data';
import type { LootOffer, LootSource, SpellId } from '../types';
import { applyOffer, compareOffer, describeOffer, displayName, noteDeclinedScrolls, resolveUpgrade, rollLoot, skipMend, upgradableTargets } from '../sim';
import { dirEdge, pickOne, resetCursorEdge, wrapCursor } from '../state';
import type { Game, PickRow } from '../state';
import { ICON_SCROLL } from '../sprites';
import { C_ACCENT, C_SCROLL, heroPos, rarityColor } from '../theme';
import { itemIcon } from '../widgets';
import { showCard } from './card';
import { openPick } from './pick';

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
  g.loot = { offers, source, cursor: 0, stow: false, onDone };
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
  g.app.particles.burst(hp.x, hp.y - 10, { count: 14, color: C_SCROLL, speed: 100 });
  g.app.juice.flash(C_SCROLL, 0.3);
  const sp = SPELLS[spell];
  const stats = `${sp.scale} X${sp.mult.toFixed(1)}${sp.hits > 1 ? ` X${sp.hits}` : ''}  ${sp.cost} MP  ${sp.kind}`;
  showCard(g, ['YOU LEARNED', sp.name, stats], g.loot.onDone, { icon: ICON_SCROLL, color: C_SCROLL });
}

function equipped(g: Game, offer: ItemOffer, r: Applied): void {
  const item = offer.item;
  const detail = r.replaced ? `${r.replaced.item.name} IS LEFT BEHIND` : item.blurb;
  showCard(g, ['EQUIPPED', item.name, detail], g.loot.onDone, { icon: itemIcon(item), color: rarityColor(item) });
}

function upgraded(g: Game, offer: UpgradeOffer, r: Applied, delta: string): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y, { count: 12, color: C_ACCENT, speed: 90 });
  const awakens = offer.toLevel >= 2;
  const item = offer.item;
  const lines = [awakens ? 'AWAKENED' : 'UPGRADED', displayName(item, offer.toLevel), awakens ? r.line : delta];
  showCard(g, lines, g.loot.onDone, { icon: itemIcon(item), color: rarityColor(item) });
}

type TakenOffer = Exclude<LootOffer, { kind: 'UPGRADE_ANY' }>;

function takeOffer(g: Game, offer: TakenOffer): void {
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

function upgradeRow(g: Game, offer: UpgradeOffer): PickRow {
  const { item, toLevel, target } = offer;
  return {
    icon: itemIcon(item),
    name: `${item.name} +${String(toLevel - 1)}>+${String(toLevel)}`,
    color: rarityColor(item),
    note: target.where,
    detail: describeOffer(g.hero, offer),
  };
}

function backToOffers(g: Game): void {
  g.subScene = 'LOOT';
  resetCursorEdge(g);
}

export function chooseUpgrade(g: Game): void {
  const offers = upgradableTargets(g.hero).flatMap((t) => resolveUpgrade(g.hero, t) ?? []);
  if (offers.length === 0) { g.app.audio.play('blip'); return; }
  openPick(g, {
    title: 'UPGRADE WHICH?',
    rows: offers.map((o) => upgradeRow(g, o)),
    cursor: 0,
    onPick: (i) => { const o = offers[i]; if (o) {takeOffer(g, o);} },
    onCancel: () => { backToOffers(g); },
  });
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
  if (!offer) { keepGear(g); return; }
  if (offer.kind === 'UPGRADE_ANY') { chooseUpgrade(g); return; }
  takeOffer(g, offer);
}
