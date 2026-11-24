import {
  BASE,
  MAX_LEVEL,
  type DamageKind,
  type Derived,
  type Hero,
  type Item,
  type ItemEffect,
  type LootOffer,
  type SpellId,
  type StatMods,
} from '../types';
import { SPELLS } from '../data';
import { effectiveBlurb, effectiveEffect, effectiveMods, itemLevel } from './gear';
import { biggestDelta, deriveGhost, deriveWith, type DField } from './ghost';
import { derive, knownSpells, spellCost } from './hero';
import { onEffect, type EffectTable } from './util';

const signed = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

const MOD_LINES: [keyof StatMods, (v: number) => string][] = [
  ['hp', (v) => `${signed(v)} MAX HP`],
  ['mp', (v) => `${signed(v)} MAX MP`],
  ['atk', (v) => `${signed(v)} ATK`],
  ['mag', (v) => `${signed(v)} MAG`],
  ['def', (v) => `${signed(v)}% DEF`],
  ['mdef', (v) => `${signed(v)}% MDEF`],
  ['crit', (v) => `${signed(v)}% CRIT`],
  ['critMult', (v) => `CRIT X${(BASE.critMult + v).toFixed(1)}`],
  ['dodge', (v) => `${signed(v)}% DODGE`],
  ['hpRegen', (v) => `${signed(v)} HP/TURN`],
  ['mpRegen', (v) => `${signed(v)} MP/TURN`],
];

export function describeItem(item: Item, level = 0): string[] {
  const m = effectiveMods(item, level);
  const lines: string[] = [];
  for (const [key, text] of MOD_LINES) {
    const v = m[key];
    if (v) {lines.push(text(v));}
  }
  const eff = effectiveEffect(item, level);
  if (eff.kind === 'GLASS') {lines.push(`-${Math.round(eff.maxHpFraction * 100)}% MAX HP`);}
  return lines.slice(0, 3).map((l) => l.slice(0, 22));
}

function packLines(parts: string[], width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const part of parts) {
    const p = part.slice(0, width);
    const next = cur ? `${cur}  ${p}` : p;
    if (next.length <= width) {
      cur = next;
      continue;
    }
    lines.push(cur);
    if (lines.length >= maxLines) {return lines;}
    cur = p;
  }
  if (cur) {lines.push(cur);}
  return lines.slice(0, maxLines);
}

const D_LABEL: Record<DField, string> = {
  maxHp: 'HP', maxMp: 'MP', atk: 'ATK', mag: 'MAG', def: 'DEF', mdef: 'MDEF',
  crit: 'CRIT', critMult: 'CRIT', dodge: 'DODGE', hpRegen: 'HP/T', mpRegen: 'MP/T',
};

const D_PCT: Partial<Record<DField, true>> = { def: true, mdef: true, crit: true, dodge: true };

function fieldText(field: DField, v: number): string {
  if (field === 'critMult') {return `X${v.toFixed(1)}`;}
  return D_PCT[field] ? `${v}%` : `${v}`;
}

function deltaLine(before: Derived, after: Derived): string | null {
  const best = biggestDelta(before, after);
  if (!best) {return null;}
  const line = `${D_LABEL[best]} ${fieldText(best, before[best])} -> ${fieldText(best, after[best])}`;
  return line.slice(0, 30);
}

export function compareLine(hero: Hero, item: Item): string {
  if (!hero.equipment[item.slot]) {return 'NEW SLOT';}
  return deltaLine(derive(hero), deriveWith(hero, item)) ?? 'NO STAT CHANGE';
}

interface Gauge { label: string; text: string }

const pct = (v: number) => `${Math.round(v * 100)}%`;
const noGauge = () => null;

const GAUGE: EffectTable<Gauge | null> = {
  NONE: noGauge,
  HEX_STRIKE: noGauge,
  RAMP: (e) => ({ label: 'RAMP', text: pct(e.perStack) }),
  TWIN_STRIKE: (e) => ({ label: '2ND HIT', text: pct(e.secondHitMult) }),
  SPELL_TWICE: (e) => ({ label: '2ND CAST', text: pct(e.secondHitMult) }),
  CHEAPER_SPELLS: (e) => ({ label: 'SPELLS', text: `-${e.amount}` }),
  DRAIN: (e) => ({ label: 'DRAIN', text: pct(e.fraction) }),
  REFLECT: (e) => ({ label: 'REFLECT', text: pct(e.fraction) }),
  REVIVE: (e) => ({ label: 'REVIVE', text: pct(e.hpFraction) }),
  MP_ON_HIT: (e) => ({ label: 'MP/HIT', text: `${e.amount}` }),
  GLASS: noGauge,
  BLOOD: noGauge,
  EXECUTE: (e) => ({ label: 'EXECUTE', text: `+${pct(e.bonus)}` }),
  FIRST_STRIKE: (e) => ({ label: 'OPENER', text: `X${e.mult.toFixed(1)}` }),
  GRANT_SPELL: noGauge,
  GUARD_COUNTER: (e) => ({ label: 'COUNTER', text: pct(e.fraction) }),
  GUARD_MANA: (e) => ({ label: 'GUARD MP', text: `+${e.amount}` }),
  PARRY_POWER: (e) => ({ label: 'RIPOSTE', text: `X${e.mult.toFixed(1)}` }),
  PUNISH_WINDUP: (e) => ({ label: 'PUNISH', text: `X${e.mult.toFixed(2)}` }),
  BURST_GAIN: (e) => ({ label: 'EMBER', text: `X${e.mult.toFixed(1)}` }),
  BURST_POWER: (e) => ({ label: 'BURST', text: `X${e.mult.toFixed(1)}` }),
  IMBUE: noGauge,
  ELEMENT_BOOST: (e) => ({ label: e.element, text: `X${e.mult.toFixed(2)}` }),
  BURN_ON_HIT: (e) => ({ label: 'IGNITE', text: pct(e.chance) }),
  BURN_WARD: noGauge,
  LOW_HP_POWER: (e) => ({ label: 'LOW HP', text: `X${e.mult.toFixed(2)}` }),
};

function gaugeLine(before: ItemEffect, after: ItemEffect): string | null {
  const gBefore = onEffect(GAUGE, before);
  const gAfter = onEffect(GAUGE, after);
  if (!gBefore || !gAfter) {return null;}
  if (gBefore.label !== gAfter.label || gBefore.text === gAfter.text) {return null;}
  return `${gAfter.label} ${gBefore.text} -> ${gAfter.text}`.slice(0, 30);
}

const EFFECT_WORD: Record<ItemEffect['kind'], string> = {
  NONE: 'NOTHING', HEX_STRIKE: 'HEXED STEEL', RAMP: 'A RISING RAMP',
  TWIN_STRIKE: 'TWIN STRIKES', SPELL_TWICE: 'A DOUBLE CAST', CHEAPER_SPELLS: 'CHEAP SPELLS',
  DRAIN: 'LIFE DRAIN', REFLECT: 'THORNS', REVIVE: 'A SECOND LIFE', MP_ON_HIT: 'MANA ON HIT',
  GLASS: 'GLASS', BLOOD: 'A BLOOD PRICE', EXECUTE: 'AN EXECUTE', FIRST_STRIKE: 'A FIRST STRIKE',
  GRANT_SPELL: 'A NEW SPELL', GUARD_COUNTER: 'A COUNTERBLOW', GUARD_MANA: 'MANA ON GUARD',
  PARRY_POWER: 'A KEENER RIPOSTE', PUNISH_WINDUP: 'A PUNISHER', BURST_GAIN: 'A HUNGRY EMBER',
  BURST_POWER: 'A FIERCER BURST', IMBUE: 'ELEMENTAL STEEL', ELEMENT_BOOST: 'ELEMENT MASTERY',
  BURN_ON_HIT: 'IGNITION', BURN_WARD: 'FIREPROOFING', LOW_HP_POWER: 'DESPERATION',
};

const noWords = () => '';

const AWAKEN_WORDS: EffectTable<string> = {
  NONE: noWords,
  HEX_STRIKE: (e) => (e.allPhysical ? 'ALL BLOWS HEX' : ''),
  RAMP: (e) => (e.sticky ? 'STACKS NEVER DROP' : ''),
  TWIN_STRIKE: noWords,
  SPELL_TWICE: noWords,
  CHEAPER_SPELLS: noWords,
  DRAIN: noWords,
  REFLECT: (e) => (e.magicToo ? 'HEXES BOUNCE TOO' : ''),
  REVIVE: (e) => (e.twice ? 'A SECOND LIFE' : ''),
  MP_ON_HIT: noWords,
  GLASS: noWords,
  BLOOD: noWords,
  EXECUTE: noWords,
  FIRST_STRIKE: noWords,
  GRANT_SPELL: (e) => (e.discount ? 'A CHEAPER SPELL' : ''),
  GUARD_COUNTER: noWords,
  GUARD_MANA: noWords,
  PARRY_POWER: noWords,
  PUNISH_WINDUP: noWords,
  BURST_GAIN: noWords,
  BURST_POWER: noWords,
  IMBUE: (e) => `${e.element} STEEL`,
  ELEMENT_BOOST: noWords,
  BURN_ON_HIT: noWords,
  BURN_WARD: noWords,
  LOW_HP_POWER: noWords,
};

function awakenWords(before: ItemEffect, after: ItemEffect): string {
  if (after.kind !== before.kind) {return EFFECT_WORD[after.kind];}
  return onEffect(AWAKEN_WORDS, after);
}

function compareScroll(hero: Hero, spell: SpellId): string {
  if (hero.baseSpells.includes(spell)) {return 'ALREADY KNOWN';}
  return knownSpells(hero).includes(spell) ? 'LEARNED PERMANENTLY' : 'NEW SPELL';
}

function compareUpgrade(hero: Hero, offer: Extract<LootOffer, { kind: 'UPGRADE' }>): string {
  const from = Math.max(0, offer.toLevel - 1);
  const eBefore = effectiveEffect(offer.item, from);
  const eAfter = effectiveEffect(offer.item, offer.toLevel);
  const words = offer.toLevel >= MAX_LEVEL ? awakenWords(eBefore, eAfter) : '';
  if (words) {return `AWAKENS: ${words}`.slice(0, 30);}
  const before = deriveGhost(hero, offer.item.slot, offer.item, from);
  const after = deriveGhost(hero, offer.item.slot, offer.item, offer.toLevel);
  return deltaLine(before, after) ?? gaugeLine(eBefore, eAfter) ?? 'NO CHANGE';
}

export function compareOffer(hero: Hero, offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {return compareScroll(hero, offer.spell);}
  if (offer.kind === 'ITEM') {return compareLine(hero, offer.item);}
  if (offer.kind === 'UPGRADE_ANY') {return 'YOU CHOOSE WHICH ITEM';}
  return compareUpgrade(hero, offer);
}

const SCROLL_FLAVOUR: Record<SpellId, string> = {
  FIREBALL: 'THE FIRST FIRE. RELIABLE',
  WATER: 'A FLOOD THAT SOAKS ARMOR',
  SLASH: 'CHEAP STEEL, WIDE ARC',
  THUNDER: 'THE SKY ANSWERS. IT HURTS',
  TWINBOLT: 'TWO FORKS, ONE BREATH',
  LEECH: 'DRINKS WHAT IT BURNS',
  QUAKE: 'THE FLOOR DOES THE WORK',
  MEND: 'A BREATH BACK FROM THE EDGE',
  EMBERS: 'A SHOWER OF SPARKS, TWICE',
  TREMOR: 'A CHEAP SHOVE OF STONE',
  AEGIS: 'A SHIELD THAT BITES BACK',
};

const UPGRADE_ANY_LINES = ['+1 LEVEL TO ONE ITEM YOU OWN', 'WORN OR IN YOUR PACK'];

export function describeOffer(hero: Hero, offer: LootOffer): string[] {
  if (offer.kind === 'SCROLL') {
    const spell = SPELLS[offer.spell];
    const head = `${spell.name}: ${spell.scale} X${spell.mult} ${spellCost(hero, offer.spell)} MP`;
    return [head.slice(0, 30), SCROLL_FLAVOUR[offer.spell].slice(0, 30)];
  }
  if (offer.kind === 'UPGRADE_ANY') {return [...UPGRADE_ANY_LINES];}
  const level = offer.kind === 'UPGRADE' ? offer.toLevel : 0;
  const item = offer.item;
  const stats = packLines(describeItem(item, level), 30, 2);
  const blurb = effectiveBlurb(item, level).slice(0, 30);
  const out = [...stats, blurb];
  return out.slice(0, 3);
}

export interface CompareRow { label: string; before: string; after: string; better: boolean }
export interface FullCompare { rows: CompareRow[]; lose: string; gain: string; kindChange: string }

const COMPARE_ORDER: DField[] = [
  'maxHp', 'atk', 'mag', 'def', 'mdef', 'crit', 'dodge', 'maxMp', 'hpRegen', 'mpRegen', 'critMult',
];
const COMPARE_LABEL: Record<DField, string> = { ...D_LABEL, critMult: 'CRITX' };
const MAX_COMPARE_ROWS = 6;

function compareRows(before: Derived, after: Derived): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const field of COMPARE_ORDER) {
    if (after[field] === before[field]) {continue;}
    rows.push({
      label: COMPARE_LABEL[field],
      before: fieldText(field, before[field]),
      after: fieldText(field, after[field]),
      better: after[field] > before[field],
    });
  }
  return rows.slice(0, MAX_COMPARE_ROWS);
}

const attackKind = (item: Item | undefined): DamageKind => item?.weaponKind ?? 'PHYSICAL';
const ATTACK_STAT: Record<DamageKind, string> = { PHYSICAL: 'ATK', MAGIC: 'MAG' };

function kindChangeText(worn: Item | undefined, candidate: Item): string {
  if (candidate.slot !== 'WEAPON') {return '';}
  const now = attackKind(candidate);
  return now === attackKind(worn) ? '' : `ATTACK NOW USES ${ATTACK_STAT[now]}`;
}

export function compareFull(hero: Hero, candidate: Item, level: number): FullCompare {
  const worn = hero.equipment[candidate.slot];
  const after = deriveGhost(hero, candidate.slot, candidate, level);
  return {
    rows: compareRows(derive(hero), after),
    lose: worn ? effectiveBlurb(worn, itemLevel(hero, candidate.slot)) : '',
    gain: effectiveBlurb(candidate, level),
    kindChange: kindChangeText(worn, candidate),
  };
}
