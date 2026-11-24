import { BUTTON_KEY } from '../../engine';
import { SPELLS } from '../data';
import { RARITIES } from '../types';
import type { Item, LootOffer, LootSource, OwnedItem, SpellId } from '../types';
import {
  applyOffer, awakenPreview, compareOffer, describeItem, describeOffer, displayName, effectiveBlurb, noteDeclinedScrolls,
  resolveOverflow, resolveUpgrade, rollLoot, skipMend, upgradableTargets,
} from '../sim';
import type { AppliedOffer } from '../sim';
import { actRef, dirEdge, dirEdgeX, resetCursorEdge, takeA, wrapCursor } from '../state';
import { armDecision } from '../transition';
import type { CardScreen, Game, PickRow } from '../state';

type CardArt = NonNullable<CardScreen['art']>;
import { ICON_SCROLL } from '../sprites';
import { C_ACCENT, C_SCROLL, heroPos, rarityColor } from '../theme';
import { noop } from '../lookup';
import { awakenWords, itemIcon } from '../widgets';
import { showCard } from './card';
import { openPick } from './pick';

type ItemOffer = Extract<LootOffer, { kind: 'ITEM' }>;
type UpgradeOffer = Extract<LootOffer, { kind: 'UPGRADE' }>;
type TakenOffer = Exclude<LootOffer, { kind: 'UPGRADE_ANY' }>;

export interface LootExit { settle: () => void; done: () => void }

function resultCard(g: Game, lines: string[], art?: CardArt): void {
  g.loot.settle();
  showCard(g, lines, g.loot.onDone, art);
}

export function startLoot(g: Game, source: LootSource, exit: LootExit): void {
  const offers = rollLoot(source, actRef(g), g.hero, g.rng);
  g.loot = { offers, source, cursor: 0, stow: false, onDone: exit.done, settle: exit.settle };
  if (offers.length === 0) {
    if (source === 'FIGHT') { exit.settle(); exit.done(); return; }
    const m = skipMend(g.hero);
    resultCard(g, ['THE CACHE IS BARE', `MENDED ${m.hp} HP AND ${m.mp} MP`]);
    return;
  }
  g.subScene = 'LOOT';
  resetCursorEdge(g);
  armDecision(g);
}

export const choosesStow = (g: Game, offer: LootOffer | undefined): boolean =>
  offer?.kind === 'ITEM' && g.hero.equipment[offer.item.slot] !== undefined;

function learnedScroll(g: Game, spell: SpellId): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y - 10, { count: 14, color: C_SCROLL, speed: 100 });
  g.app.juice.flash(C_SCROLL, 0.3);
  const sp = SPELLS[spell];
  const stats = `${sp.scale} X${sp.mult.toFixed(1)}${sp.hits > 1 ? ` X${sp.hits}` : ''}  ${sp.cost} MP  ${sp.kind}`;
  resultCard(g, ['YOU LEARNED', sp.name, stats], { icon: ICON_SCROLL, color: C_SCROLL });
}

interface Outcome { item: Item; stowed: boolean; replaced?: OwnedItem; dropped?: OwnedItem }

function outcomeLines(o: Outcome): string[] {
  const name = o.item.name;
  if (o.dropped?.item === o.item) {return ['LEFT BEHIND', name, 'YOUR PACK STAYS AS IT WAS'];}
  const gone = o.dropped ? `${displayName(o.dropped.item, o.dropped.level)} IS DROPPED` : '';
  if (o.stowed) {return ['STOWED IN YOUR PACK', name, gone || `${BUTTON_KEY.B.hint} ON THE MAP OPENS GEAR`];}
  if (o.replaced) {return ['EQUIPPED', name, gone || `${o.replaced.item.name} GOES TO YOUR PACK`];}
  return ['EQUIPPED', name, o.item.blurb];
}

function itemTaken(g: Game, o: Outcome): void {
  resultCard(g, outcomeLines(o), { icon: itemIcon(o.item), color: rarityColor(o.item) });
}

function upgraded(g: Game, offer: UpgradeOffer, r: AppliedOffer, delta: string): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y, { count: 12, color: C_ACCENT, speed: 90 });
  const awakens = offer.toLevel >= 2;
  const item = offer.item;
  const lines = [awakens ? 'AWAKENED' : 'UPGRADED', displayName(item, offer.toLevel), awakens ? r.line : delta];
  resultCard(g, lines, { icon: itemIcon(item), color: rarityColor(item) });
}

function ownedDetail(owned: OwnedItem): string[] {
  const stats = describeItem(owned.item, owned.level).slice(0, 2);
  return [...stats, effectiveBlurb(owned.item, owned.level)];
}

function dropRow(owned: OwnedItem, note: string): PickRow {
  return {
    icon: itemIcon(owned.item),
    name: displayName(owned.item, owned.level),
    color: rarityColor(owned.item),
    note,
    detail: ownedDetail(owned),
    aside: awakenWords(awakenPreview(owned.item, owned.level)),
  };
}

const worth = (o: OwnedItem): number => RARITIES.indexOf(o.item.rarity) * 100 + o.level;

function leastValuable(candidates: readonly OwnedItem[]): number {
  let best = candidates.length - 1;
  candidates.forEach((o, i) => {
    const pick = candidates[best];
    if (pick && worth(o) < worth(pick)) {best = i;}
  });
  return best;
}

function chooseDrop(g: Game, item: Item, r: AppliedOffer & { overflow: OwnedItem }): void {
  const entering = r.overflow;
  const candidates = [...g.hero.pack, entering];
  const rows = [...g.hero.pack.map((o) => dropRow(o, 'PACK')), dropRow(entering, r.stowed ? 'NEW' : 'OLD')];
  openPick(g, {
    title: 'PACK FULL  DROP WHICH?',
    rows,
    cursor: leastValuable(candidates),
    locked: true,
    onPick: (i) => {
      const dropped = resolveOverflow(g.hero, entering, i);
      itemTaken(g, { item, stowed: r.stowed, replaced: r.replaced, dropped });
    },
    onCancel: noop,
  });
}

function takeItem(g: Game, offer: ItemOffer): void {
  const stow = choosesStow(g, offer) && g.loot.stow;
  const r = applyOffer(g.hero, offer, g.rng, { stow });
  const { overflow } = r;
  if (overflow) { chooseDrop(g, offer.item, { ...r, overflow }); return; }
  itemTaken(g, { item: offer.item, stowed: r.stowed, replaced: r.replaced });
}

function takeOffer(g: Game, offer: TakenOffer): void {
  noteDeclinedScrolls(g.hero, g.loot.offers, offer);
  g.app.audio.play('pickup');
  if (offer.kind === 'ITEM') { takeItem(g, offer); return; }
  const delta = compareOffer(g.hero, offer);
  const r = applyOffer(g.hero, offer, g.rng);
  if (offer.kind === 'SCROLL') {learnedScroll(g, offer.spell);} else {upgraded(g, offer, r, delta);}
}

const youLine = (line: string): string => (line.includes(' -> ') ? `YOUR ${line}` : line);

function upgradeDetail(g: Game, offer: UpgradeOffer): string[] {
  const said = describeOffer(g.hero, offer);
  const blurb = said.slice(-1);
  const stat = said.length > 1 ? said.slice(0, 1).map((line) => `ITEM GIVES ${line}`) : [];
  return [youLine(compareOffer(g.hero, offer)), ...stat, ...blurb];
}

function upgradeRow(g: Game, offer: UpgradeOffer): PickRow {
  const { item, toLevel, target } = offer;
  return {
    icon: itemIcon(item),
    name: `${item.name} +${String(toLevel - 1)}\u2192+${String(toLevel)}`,
    color: rarityColor(item),
    note: target.where,
    detail: upgradeDetail(g, offer).filter((line) => line !== awakenPreview(item, toLevel)),
    aside: awakenWords(awakenPreview(item, toLevel)),
  };
}

function backToOffers(g: Game): void {
  g.subScene = 'LOOT';
  resetCursorEdge(g);
  armDecision(g);
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
  if (g.loot.ash) { g.app.audio.play('blip'); resultCard(g, ['THE ASHES COOL', 'YOUR GEAR STAYS AS IT IS']); return; }
  const m = skipMend(g.hero);
  noteDeclinedScrolls(g.hero, g.loot.offers, null);
  g.app.audio.play('pickup');
  resultCard(g, ['YOU KEEP YOUR GEAR', `MENDED ${m.hp} HP AND ${m.mp} MP`]);
}

function moveLootCursor(g: Game): void {
  const loot = g.loot;
  const dy = dirEdge(g);
  const dx = dirEdgeX(g);
  if (dy) {
    loot.cursor = wrapCursor(loot.cursor, dy, loot.offers.length + 1);
    loot.stow = false;
    g.app.audio.play('blip');
  } else if (dx && choosesStow(g, loot.offers[loot.cursor])) {
    loot.stow = !loot.stow;
    g.app.audio.play('blip');
  }
}

export function updateLoot(g: Game): void {
  moveLootCursor(g);
  if (!takeA(g)) {return;}
  const offer = g.loot.offers[g.loot.cursor];
  if (!offer) { keepGear(g); return; }
  if (offer.kind === 'UPGRADE_ANY') { chooseUpgrade(g); return; }
  takeOffer(g, offer);
}
