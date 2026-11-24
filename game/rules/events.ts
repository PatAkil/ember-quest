import type { Rarity } from '../types';

export type EventEffect =
  | { kind: 'hpPct'; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'sp'; amount: number }
  | { kind: 'item'; rarity: Rarity }
  | { kind: 'upgradeAny' }
  | { kind: 'burnNextFight' }
  | { kind: 'fullHeal' }
  | { kind: 'dropPackItem' }
  | { kind: 'potion'; amount: number };

type EffectKind = EventEffect['kind'];

export interface EventOption { label: string; effects: readonly EventEffect[] }

export interface EventDef {
  id: string;
  title: string;
  lines: readonly [string, string?];
  options: readonly [EventOption, EventOption];
}

const EVENT_TITLE_MAX = 20;
const EVENT_LINE_MAX = 30;
const EVENT_LABEL_MAX = 24;
export const PENDING_BURN_TURNS = 3;
export const PENDING_BURN_BASE = 3;

const WALK_ON: EventOption = { label: 'WALK ON', effects: [] };

export const EVENTS: readonly EventDef[] = [
  {
    id: 'ALTAR', title: 'A BLEEDING ALTAR', lines: ['THE STONE IS WARM AND WET.', 'IT DRINKS WHAT IT IS GIVEN.'],
    options: [{ label: 'GIVE BLOOD', effects: [{ kind: 'hpPct', amount: -0.25 }, { kind: 'sp', amount: 2 }] }, WALK_ON],
  },
  {
    id: 'SMITH', title: 'A WANDERING SMITH', lines: ['NO FORGE, NO COIN WANTED.', 'HE WORKS FOR SWEAT ALONE.'],
    options: [
      { label: 'LEND HIM YOUR STRENGTH', effects: [{ kind: 'maxHp', amount: -8 }, { kind: 'upgradeAny' }] },
      { label: 'TRADE A STORY', effects: [{ kind: 'potion', amount: 1 }] },
    ],
  },
  {
    id: 'IDOL', title: 'A CURSED IDOL', lines: ['ITS RUBY EYES FOLLOW YOU.', 'SOMETHING INSIDE IT HUMS.'],
    options: [{ label: 'PRY IT OPEN', effects: [{ kind: 'maxHp', amount: -10 }, { kind: 'item', rarity: 'EPIC' }] }, WALK_ON],
  },
  {
    id: 'POOL', title: 'A STILL POOL', lines: ['THE WATER IS WARM.', 'TOO STILL. TOO WARM.'],
    options: [
      { label: 'BATHE', effects: [{ kind: 'fullHeal' }, { kind: 'burnNextFight' }] },
      { label: 'FILL A FLASK', effects: [{ kind: 'potion', amount: 1 }] },
    ],
  },
  {
    id: 'PILGRIM', title: 'A WEARY PILGRIM', lines: ['HE HAS WALKED SINCE', 'THE FIRST FIRE WENT OUT.'],
    options: [
      { label: 'SHARE A POTION', effects: [{ kind: 'potion', amount: -1 }, { kind: 'maxHp', amount: 6 }] },
      { label: 'ASK FOR A BLESSING', effects: [{ kind: 'hpPct', amount: 0.25 }] },
    ],
  },
  {
    id: 'SHRINE', title: 'THE EMBER SHRINE', lines: ['IT BURNS WHAT YOU OFFER', 'AND WARMS YOU IN RETURN.'],
    options: [
      { label: 'BURN SPARE GEAR', effects: [{ kind: 'fullHeal' }, { kind: 'potion', amount: 2 }, { kind: 'dropPackItem' }] },
      { label: 'WARM YOUR HANDS', effects: [{ kind: 'hpPct', amount: 0.15 }] },
    ],
  },
  {
    id: 'KNIGHT', title: 'A FALLEN KNIGHT', lines: ['HIS SWORD IS BROKEN.', 'HE ASKS YOU FOR ARMS.'],
    options: [{ label: 'GIVE HIM SPARE GEAR', effects: [{ kind: 'maxHp', amount: 8 }, { kind: 'potion', amount: 1 }, { kind: 'dropPackItem' }] }, WALK_ON],
  },
  {
    id: 'TITHE', title: 'THE BLOOD TITHE', lines: ['A HOODED FIGURE COUNTS', 'YOUR SCARS. IT WANTS ONE.'],
    options: [
      { label: 'PAY IN VIGOUR', effects: [{ kind: 'maxHp', amount: -12 }, { kind: 'sp', amount: 2 }] },
      { label: 'REFUSE THE TITHE', effects: [] },
    ],
  },
  {
    id: 'STATUE', title: 'A WEEPING STATUE', lines: ['TEARS OF HOT SALT RUN', 'DOWN ITS STONE CHEEKS.'],
    options: [
      { label: 'DRINK THE TEARS', effects: [{ kind: 'potion', amount: 2 }, { kind: 'burnNextFight' }] },
      { label: 'CATCH A SINGLE TEAR', effects: [{ kind: 'hpPct', amount: 0.1 }] },
    ],
  },
];

export const QUIET_EVENT: EventDef = {
  id: 'QUIET', title: 'A QUIET HOLLOW', lines: ['NOTHING STIRS HERE.', 'YOU CATCH YOUR BREATH.'],
  options: [{ label: 'REST A MOMENT', effects: [{ kind: 'hpPct', amount: 0.1 }] }, WALK_ON],
};

const SCREEN_KINDS: ReadonlySet<EffectKind> = new Set<EffectKind>(['sp', 'item', 'upgradeAny', 'dropPackItem']);

export const opensScreen = (effect: EventEffect): boolean => SCREEN_KINDS.has(effect.kind);

const pricedInLasting = (event: EventDef): boolean =>
  event.options.some((o) => o.effects.some((e) => (e.kind === 'maxHp' && e.amount < 0) || e.kind === 'dropPackItem'));

const isWalkOn = (event: EventDef): boolean => event.options.some((o) => o.effects.length === 0);

const gains = (effect: EventEffect): boolean => 'amount' in effect && effect.amount > 0;

const OPEN_WHEN_FREE: Readonly<Record<EffectKind, (effect: EventEffect) => boolean>> = {
  hpPct: gains,
  maxHp: gains,
  sp: gains,
  item: () => false,
  upgradeAny: () => false,
  burnNextFight: () => false,
  fullHeal: () => true,
  dropPackItem: () => false,
  potion: gains,
};

const neverBlockedFree = (option: EventOption): boolean => option.effects.every((e) => OPEN_WHEN_FREE[e.kind](e));

const hasFreeExit = (event: EventDef): boolean => event.options.some(neverBlockedFree);

function checkText(bad: string[], where: string, text: string, max: number): void {
  if (text.length === 0 || text.length > max) {bad.push(`${where}: "${text}" must be 1..${String(max)} chars`);}
  if (text !== text.toUpperCase()) {bad.push(`${where}: "${text}" must be uppercase`);}
}

function checkAmount(bad: string[], where: string, effect: EventEffect): void {
  if (effect.kind === 'sp' && effect.amount <= 0) {bad.push(`${where}: sp must be a gain`);}
  if (effect.kind === 'potion' && effect.amount === 0) {bad.push(`${where}: potion amount is zero`);}
  if (effect.kind === 'maxHp' && effect.amount === 0) {bad.push(`${where}: maxHp amount is zero`);}
  if (effect.kind === 'hpPct' && (effect.amount === 0 || Math.abs(effect.amount) > 1)) {bad.push(`${where}: hpPct must be within -1..1, not 0`);}
}

function checkOption(bad: string[], where: string, option: EventOption): void {
  checkText(bad, where, option.label, EVENT_LABEL_MAX);
  const screens = option.effects.filter(opensScreen);
  if (screens.length > 1) {bad.push(`${where}: more than one screen-opening effect`);}
  const last = option.effects.at(-1);
  if (screens.length === 1 && (!last || !opensScreen(last))) {bad.push(`${where}: the screen-opening effect must be last`);}
  for (const effect of option.effects) {checkAmount(bad, where, effect);}
}

function checkEvent(bad: string[], event: EventDef): void {
  const where = `event ${event.id}`;
  checkText(bad, where, event.title, EVENT_TITLE_MAX);
  for (const line of event.lines) {
    if (line !== undefined) {checkText(bad, where, line, EVENT_LINE_MAX);}
  }
  event.options.forEach((o, i) => { checkOption(bad, `${where} option ${String(i)}`, o); });
  if (!hasFreeExit(event)) {bad.push(`${where}: no option that costs nothing and is always open (add WALK ON or a free gain)`);}
}

export function validateEvents(events: readonly EventDef[] = EVENTS): string[] {
  const bad: string[] = [];
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) {bad.push(`event ${event.id}: duplicate id`);}
    ids.add(event.id);
    checkEvent(bad, event);
  }
  checkEvent(bad, QUIET_EVENT);
  if (events.filter(pricedInLasting).length * 2 < events.length) {bad.push('events: fewer than half price their boon in max HP or a pack item');}
  if (events.filter(isWalkOn).length * 2 > events.length) {bad.push('events: more than half offer a do-nothing option');}
  return bad;
}
