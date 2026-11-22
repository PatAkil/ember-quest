import {
  BASE,
  CAP_CRIT,
  CAP_DEF,
  CAP_DODGE,
  CAP_MDEF,
  FIGHT_DROP_CHANCE,
  LEGENDARY_MAX_LEVEL,
  MAX_LEVEL,
  MISSED_SCROLL_CHANCE,
  PITY_AFTER,
  RARITIES,
  SLOTS,
  SP_GAIN,
  SP_PER_KIND,
  STAT_KEYS,
  UPGRADE_CHANCE,
  UPGRADE_SCALE,
  type BattleState,
  type DamageKind,
  type Derived,
  type EnemyActResult,
  type EnemyInstance,
  type EnemyKind,
  type Hero,
  type HeroAction,
  type HeroActResult,
  type Hit,
  type Item,
  type ItemEffect,
  type LootOffer,
  type LootSource,
  type Rarity,
  type Rng,
  type Slot,
  type SpellId,
  type StatKey,
  type StatMods,
} from './types';

import {
  ACT_MULT,
  BIOMES,
  BOSS_ENTRY_HEAL,
  CLEAR_HEAL,
  ENEMIES,
  ITEMS,
  LOOT_COUNT,
  LOOT_WEIGHTS,
  SKIP_MEND,
  SPELLS,
  SPELL_ORDER,
} from './data';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const r2 = (v: number) => Math.round(v * 100) / 100;

const jitter = (rng: Rng) => 0.9 + rng() * 0.2;

const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

function equippedItems(hero: Hero): Item[] {
  const out: Item[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item) {out.push(item);}
  }
  return out;
}

function findEffect<K extends ItemEffect['kind']>(
  hero: Hero,
  kind: K,
): Extract<ItemEffect, { kind: K }> | undefined {
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (!item) {continue;}
    const eff = effectiveEffect(item, itemLevel(hero, slot));
    if (eff.kind === kind) {return eff as Extract<ItemEffect, { kind: K }>;}
  }
  return undefined;
}
function allEffects<K extends ItemEffect['kind']>(
  hero: Hero,
  kind: K,
): Extract<ItemEffect, { kind: K }>[] {
  const out: Extract<ItemEffect, { kind: K }>[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (!item) {continue;}
    const eff = effectiveEffect(item, itemLevel(hero, slot));
    if (eff.kind === kind) {out.push(eff as Extract<ItemEffect, { kind: K }>);}
  }
  return out;
}

export function maxLevelFor(item: Item): number {
  return item.rarity === 'LEGENDARY' ? LEGENDARY_MAX_LEVEL : MAX_LEVEL;
}
export function itemLevel(hero: Hero, slot: Slot): number {
  const item = hero.equipment[slot];
  if (!item) {return 0;}
  const raw = hero.levels ? hero.levels[slot] ?? 0 : 0;
  return clamp(Math.floor(raw), 0, maxLevelFor(item));
}
export function displayName(item: Item, level: number): string {
  const name = level > 0 ? `${item.name} +${level}` : item.name;
  return name.slice(0, 16);
}
const MOD_KEYS: (keyof StatMods)[] = [
  'hp', 'mp', 'atk', 'mag', 'def', 'mdef', 'crit', 'critMult', 'dodge', 'hpRegen', 'mpRegen',
];
export function effectiveMods(item: Item, level: number): StatMods {
  const lvl = Math.max(0, level);
  const scale = 1 + UPGRADE_SCALE * lvl;
  const out: StatMods = {};
  for (const k of MOD_KEYS) {
    const base = item.mods[k];
    if (base === undefined || base === 0) {continue;}
    out[k] = k === 'critMult' ? r2(base * scale) : Math.round(base * scale);
  }
  const extra = lvl >= MAX_LEVEL ? item.awaken?.mods : undefined;
  if (extra) {
    for (const k of MOD_KEYS) {
      const add = extra[k];
      if (add === undefined || add === 0) {continue;}
      const sum = (out[k] ?? 0) + add;
      out[k] = k === 'critMult' ? r2(sum) : Math.round(sum);
    }
  }
  return out;
}
function stepEffect(e: ItemEffect): ItemEffect {
  switch (e.kind) {
    case 'RAMP':
      return { ...e, perStack: r2(e.perStack * 1.35), maxStacks: e.maxStacks + 1 };
    case 'TWIN_STRIKE':
      return { ...e, secondHitMult: Math.min(1, r2(e.secondHitMult + 0.15)) };
    case 'SPELL_TWICE':
      return { ...e, secondHitMult: Math.min(1, r2(e.secondHitMult + 0.15)) };
    case 'CHEAPER_SPELLS':
      return { ...e, amount: e.amount + 1 };
    case 'DRAIN':
      return { ...e, fraction: Math.min(0.4, r2(e.fraction * 1.3)) };
    case 'REFLECT':
      return { ...e, fraction: Math.min(1.2, r2(e.fraction * 1.35)) };
    case 'REVIVE':
      return { ...e, hpFraction: Math.min(0.9, r2(e.hpFraction + 0.15)) };
    case 'MP_ON_HIT':
      return { ...e, amount: e.amount + 1 };
    case 'EXECUTE':
      return { ...e, bonus: r2(e.bonus * 1.35) };
    case 'FIRST_STRIKE':
      return { ...e, mult: r2(e.mult + 0.3) };
    default:
      return e;
  }
}
export function scaleEffect(e: ItemEffect, level: number): ItemEffect {
  let out = e;
  for (let i = 0; i < Math.max(0, level); i += 1) {out = stepEffect(out);}
  return out;
}
export function effectiveEffect(item: Item, level: number): ItemEffect {
  if (level >= MAX_LEVEL && item.awaken?.effect) {return item.awaken.effect;}
  return scaleEffect(item.effect, level);
}
export function effectiveBlurb(item: Item, level: number): string {
  if (level >= MAX_LEVEL && item.awaken?.blurb) {return item.awaken.blurb;}
  return item.blurb;
}
function upgradableSlots(hero: Hero): Slot[] {
  const out: Slot[] = [];
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (item && itemLevel(hero, slot) < maxLevelFor(item)) {out.push(slot);}
  }
  return out;
}
export function canUpgradeAny(hero: Hero): boolean {
  return upgradableSlots(hero).length > 0;
}
export function createHero(): Hero {
  return {
    hp: BASE.hp,
    mp: BASE.mp,
    sp: 0,
    alloc: { HP: 0, MP: 0, ATK: 0, MAG: 0, DEF: 0, MDEF: 0, CRIT: 0 },
    equipment: {},
    levels: {},
    baseSpells: ['FIREBALL'],
    revived: false,
    revivedTwice: false,
    dryFights: 0,
    missedScrolls: [],
  };
}
export function derive(hero: Hero): Derived {
  const d: Derived = {
    maxHp: BASE.hp + SP_GAIN.HP * hero.alloc.HP,
    maxMp: BASE.mp + SP_GAIN.MP * hero.alloc.MP,
    atk: BASE.atk + SP_GAIN.ATK * hero.alloc.ATK,
    mag: BASE.mag + SP_GAIN.MAG * hero.alloc.MAG,
    def: SP_GAIN.DEF * hero.alloc.DEF,
    mdef: SP_GAIN.MDEF * hero.alloc.MDEF,
    crit: BASE.crit + SP_GAIN.CRIT * hero.alloc.CRIT,
    critMult: BASE.critMult,
    dodge: 0,
    hpRegen: 0,
    mpRegen: 0,
  };
  let glass = 0;
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (!item) {continue;}
    const level = itemLevel(hero, slot);
    const m = effectiveMods(item, level);
    d.maxHp += m.hp ?? 0;
    d.maxMp += m.mp ?? 0;
    d.atk += m.atk ?? 0;
    d.mag += m.mag ?? 0;
    d.def += m.def ?? 0;
    d.mdef += m.mdef ?? 0;
    d.crit += m.crit ?? 0;
    d.critMult += m.critMult ?? 0;
    d.dodge += m.dodge ?? 0;
    d.hpRegen += m.hpRegen ?? 0;
    d.mpRegen += m.mpRegen ?? 0;
    const eff = effectiveEffect(item, level);
    if (eff.kind === 'GLASS') {glass += eff.maxHpFraction;}
  }
  if (glass > 0) {d.maxHp = Math.round(d.maxHp * Math.max(0.1, 1 - glass));}
  d.maxHp = Math.max(1, Math.round(d.maxHp));
  d.maxMp = Math.max(0, Math.round(d.maxMp));
  d.atk = Math.max(0, Math.round(d.atk));
  d.mag = Math.max(0, Math.round(d.mag));
  d.def = clamp(Math.round(d.def), 0, CAP_DEF);
  d.mdef = clamp(Math.round(d.mdef), 0, CAP_MDEF);
  d.crit = clamp(Math.round(d.crit), 0, CAP_CRIT);
  d.dodge = clamp(Math.round(d.dodge), 0, CAP_DODGE);
  d.critMult = Math.max(1, d.critMult);
  d.hpRegen = Math.max(0, Math.round(d.hpRegen));
  d.mpRegen = Math.max(0, Math.round(d.mpRegen));
  return d;
}

export function knownSpells(hero: Hero): SpellId[] {
  const set = new Set<SpellId>(hero.baseSpells);
  for (const eff of allEffects(hero, 'GRANT_SPELL')) {set.add(eff.spell);}
  return SPELL_ORDER.filter((id) => set.has(id));
}
export function heroActions(hero: Hero): HeroAction[] {
  return ['ATTACK', ...knownSpells(hero)];
}
export function spellCost(hero: Hero, spell: SpellId): number {
  const base = SPELLS[spell]?.cost ?? 0;
  let discount = 0;
  for (const eff of allEffects(hero, 'CHEAPER_SPELLS')) {discount += eff.amount;}
  for (const eff of allEffects(hero, 'GRANT_SPELL')) {
    if (eff.spell === spell && eff.discount) {discount += eff.discount;}
  }
  return Math.max(1, Math.round(base - discount));
}

export function canAfford(hero: Hero, action: HeroAction): boolean {
  if (action === 'ATTACK') {return true;}
  return hero.mp >= spellCost(hero, action);
}

export function spendPoint(hero: Hero, stat: StatKey): boolean {
  if (hero.sp <= 0) {return false;}
  hero.sp -= 1;
  hero.alloc[stat] += 1;
  const d = derive(hero);
  if (stat === 'HP') {hero.hp += SP_GAIN.HP;}
  if (stat === 'MP') {hero.mp += SP_GAIN.MP;}
  hero.hp = clamp(hero.hp, 0, d.maxHp);
  hero.mp = clamp(hero.mp, 0, d.maxMp);
  return true;
}

export function healFraction(hero: Hero, f: number): { hp: number; mp: number } {
  const d = derive(hero);
  const hp = clamp(Math.round(d.maxHp * f), 0, Math.max(0, d.maxHp - hero.hp));
  const mp = clamp(Math.round(d.maxMp * f), 0, Math.max(0, d.maxMp - hero.mp));
  hero.hp += hp;
  hero.mp += mp;
  return { hp, mp };
}
export function fullHeal(hero: Hero): void {
  const d = derive(hero);
  hero.hp = d.maxHp;
  hero.mp = d.maxMp;
}
export function grantClear(hero: Hero, kind: EnemyKind): { sp: number; hp: number; mp: number } {
  const sp = SP_PER_KIND[kind];
  hero.sp += sp;
  const healed = healFraction(hero, CLEAR_HEAL);
  return { sp, hp: healed.hp, mp: healed.mp };
}
export function learnSpell(hero: Hero, spell: SpellId): void {
  if (!hero.baseSpells.includes(spell)) {hero.baseSpells.push(spell);}
}
export function equip(hero: Hero, item: Item): Item | undefined {
  const previous = hero.equipment[item.slot];
  hero.equipment[item.slot] = item;
  if (!hero.levels) {hero.levels = {};}
  hero.levels[item.slot] = 0;
  const d = derive(hero);
  hero.hp = clamp(hero.hp, 1, d.maxHp);
  hero.mp = clamp(hero.mp, 0, d.maxMp);
  return previous;
}
export function skipMend(hero: Hero): { hp: number; mp: number } {
  return healFraction(hero, SKIP_MEND);
}
const signed = (v: number) => (v >= 0 ? `+${v}` : `${v}`);

export function describeItem(item: Item, level = 0): string[] {
  const m = effectiveMods(item, level);
  const lines: string[] = [];
  if (m.hp) {lines.push(`${signed(m.hp)} MAX HP`);}
  if (m.mp) {lines.push(`${signed(m.mp)} MAX MP`);}
  if (m.atk) {lines.push(`${signed(m.atk)} ATK`);}
  if (m.mag) {lines.push(`${signed(m.mag)} MAG`);}
  if (m.def) {lines.push(`${signed(m.def)}% DEF`);}
  if (m.mdef) {lines.push(`${signed(m.mdef)}% MDEF`);}
  if (m.crit) {lines.push(`${signed(m.crit)}% CRIT`);}
  if (m.critMult) {lines.push(`CRIT X${(BASE.critMult + m.critMult).toFixed(1)}`);}
  if (m.dodge) {lines.push(`${signed(m.dodge)}% DODGE`);}
  if (m.hpRegen) {lines.push(`${signed(m.hpRegen)} HP/TURN`);}
  if (m.mpRegen) {lines.push(`${signed(m.mpRegen)} MP/TURN`);}
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
type DField = keyof Derived;
const D_FIELDS: DField[] = [
  'atk', 'mag', 'maxHp', 'maxMp', 'def', 'mdef', 'crit', 'critMult', 'dodge', 'hpRegen', 'mpRegen',
];
const D_LABEL: Record<DField, string> = {
  maxHp: 'HP', maxMp: 'MP', atk: 'ATK', mag: 'MAG', def: 'DEF', mdef: 'MDEF',
  crit: 'CRIT', critMult: 'CRIT', dodge: 'DODGE', hpRegen: 'HP/T', mpRegen: 'MP/T',
};
const D_PCT: Partial<Record<DField, true>> = { def: true, mdef: true, crit: true, dodge: true };
const D_WEIGHT: Record<DField, number> = {
  maxHp: 0.5, maxMp: 0.8, atk: 2.5, mag: 2.5, def: 1.7, mdef: 1.7,
  crit: 2.5, critMult: 25, dodge: 2.5, hpRegen: 4, mpRegen: 4,
};
function fieldText(field: DField, v: number): string {
  if (field === 'critMult') {return `X${v.toFixed(1)}`;}
  return D_PCT[field] ? `${v}%` : `${v}`;
}
function deriveGhost(hero: Hero, slot: Slot, item: Item | undefined, level: number): Derived {
  const equipment = { ...hero.equipment };
  const levels = { ...(hero.levels ?? {}) };
  if (item) {
    equipment[slot] = item;
    levels[slot] = level;
  } else {
    delete equipment[slot];
    delete levels[slot];
  }
  return derive({ ...hero, equipment, levels });
}

function deriveWith(hero: Hero, item: Item): Derived {
  return deriveGhost(hero, item.slot, item, 0);
}
function biggestDelta(before: Derived, after: Derived): DField | null {
  let best: DField | null = null;
  let bestScore = 0;
  for (const f of D_FIELDS) {
    const delta = Math.abs(after[f] - before[f]) * D_WEIGHT[f];
    if (delta > bestScore + 1e-9) {
      bestScore = delta;
      best = f;
    }
  }
  return best;
}
export function compareLine(hero: Hero, item: Item): string {
  if (!hero.equipment[item.slot]) {return 'NEW SLOT';}
  const before = derive(hero);
  const after = deriveWith(hero, item);
  const best = biggestDelta(before, after);
  if (!best) {return 'NO STAT CHANGE';}
  const line = `${D_LABEL[best]} ${fieldText(best, before[best])} -> ${fieldText(best, after[best])}`;
  return line.slice(0, 30);
}
function effectGauge(e: ItemEffect): { label: string; text: string } | null {
  switch (e.kind) {
    case 'RAMP': return { label: 'RAMP', text: `${Math.round(e.perStack * 100)}%` };
    case 'TWIN_STRIKE': return { label: '2ND HIT', text: `${Math.round(e.secondHitMult * 100)}%` };
    case 'SPELL_TWICE': return { label: '2ND CAST', text: `${Math.round(e.secondHitMult * 100)}%` };
    case 'CHEAPER_SPELLS': return { label: 'SPELLS', text: `-${e.amount}` };
    case 'DRAIN': return { label: 'DRAIN', text: `${Math.round(e.fraction * 100)}%` };
    case 'REFLECT': return { label: 'REFLECT', text: `${Math.round(e.fraction * 100)}%` };
    case 'REVIVE': return { label: 'REVIVE', text: `${Math.round(e.hpFraction * 100)}%` };
    case 'MP_ON_HIT': return { label: 'MP/HIT', text: `${e.amount}` };
    case 'EXECUTE': return { label: 'EXECUTE', text: `+${Math.round(e.bonus * 100)}%` };
    case 'FIRST_STRIKE': return { label: 'OPENER', text: `X${e.mult.toFixed(1)}` };
    default: return null;
  }
}
const EFFECT_WORD: Record<ItemEffect['kind'], string> = {
  NONE: 'NOTHING', HEX_STRIKE: 'HEXED STEEL', RAMP: 'A RISING RAMP',
  TWIN_STRIKE: 'TWIN STRIKES', SPELL_TWICE: 'A DOUBLE CAST', CHEAPER_SPELLS: 'CHEAP SPELLS',
  DRAIN: 'LIFE DRAIN', REFLECT: 'THORNS', REVIVE: 'A SECOND LIFE', MP_ON_HIT: 'MANA ON HIT',
  GLASS: 'GLASS', BLOOD: 'A BLOOD PRICE', EXECUTE: 'AN EXECUTE', FIRST_STRIKE: 'A FIRST STRIKE',
  GRANT_SPELL: 'A NEW SPELL',
};

function awakenWords(before: ItemEffect, after: ItemEffect): string {
  if (after.kind !== before.kind) {return EFFECT_WORD[after.kind];}
  switch (after.kind) {
    case 'HEX_STRIKE': return after.allPhysical ? 'ALL BLOWS HEX' : '';
    case 'RAMP': return after.sticky ? 'STACKS NEVER DROP' : '';
    case 'REFLECT': return after.magicToo ? 'HEXES BOUNCE TOO' : '';
    case 'REVIVE': return after.twice ? 'A SECOND LIFE' : '';
    case 'GRANT_SPELL': return after.discount ? 'A CHEAPER SPELL' : '';
    default: return '';
  }
}

export function compareOffer(hero: Hero, offer: LootOffer): string {
  if (offer.kind === 'SCROLL') {
    if (hero.baseSpells.includes(offer.spell)) {return 'ALREADY KNOWN';}
    return knownSpells(hero).includes(offer.spell) ? 'LEARNED PERMANENTLY' : 'NEW SPELL';
  }
  if (offer.kind === 'ITEM') {return compareLine(hero, offer.item);}
  const from = Math.max(0, offer.toLevel - 1);
  const eBefore = effectiveEffect(offer.item, from);
  const eAfter = effectiveEffect(offer.item, offer.toLevel);

  const words = offer.toLevel >= MAX_LEVEL ? awakenWords(eBefore, eAfter) : '';
  if (words) {return `AWAKENS: ${words}`.slice(0, 30);}
  const before = deriveGhost(hero, offer.slot, offer.item, from);
  const after = deriveGhost(hero, offer.slot, offer.item, offer.toLevel);
  const best = biggestDelta(before, after);
  if (best) {
    const line = `${D_LABEL[best]} ${fieldText(best, before[best])} -> ${fieldText(best, after[best])}`;
    return line.slice(0, 30);
  }
  const gBefore = effectGauge(eBefore);
  const gAfter = effectGauge(eAfter);
  if (gBefore && gAfter && gBefore.label === gAfter.label && gBefore.text !== gAfter.text) {
    return `${gAfter.label} ${gBefore.text} -> ${gAfter.text}`.slice(0, 30);
  }
  return 'NO CHANGE';
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
};
export function describeOffer(hero: Hero, offer: LootOffer): string[] {
  if (offer.kind === 'SCROLL') {
    const spell = SPELLS[offer.spell];
    const head = `${spell.name}: ${spell.scale} X${spell.mult} ${spellCost(hero, offer.spell)} MP`;
    return [head.slice(0, 30), SCROLL_FLAVOUR[offer.spell].slice(0, 30)];
  }
  const level = offer.kind === 'UPGRADE' ? offer.toLevel : 0;
  const item = offer.item;
  const stats = packLines(describeItem(item, level), 30, 2);
  const blurb = effectiveBlurb(item, level).slice(0, 30);
  const out = [...stats, blurb];
  return out.slice(0, 3);
}

export function applyOffer(hero: Hero, offer: LootOffer, rng: Rng): { replaced?: Item; line: string } {
  rng;
  if (offer.kind === 'SCROLL') {
    learnSpell(hero, offer.spell);
    if (hero.missedScrolls) {
      hero.missedScrolls = hero.missedScrolls.filter((s) => s !== offer.spell);
    }
    return { line: `YOU LEARNED ${SPELLS[offer.spell].name}`.slice(0, 30) };
  }
  if (offer.kind === 'ITEM') {
    const replaced = equip(hero, offer.item);
    return { replaced, line: offer.item.blurb.slice(0, 30) };
  }
  const level = clamp(Math.floor(offer.toLevel), 0, maxLevelFor(offer.item));
  if (!hero.levels) {hero.levels = {};}
  hero.levels[offer.slot] = level;
  const d = derive(hero);
  hero.hp = clamp(hero.hp, 1, d.maxHp);
  hero.mp = clamp(hero.mp, 0, d.maxMp);
  const awakened = level >= MAX_LEVEL ? offer.item.awaken?.blurb : undefined;
  if (awakened) {
    const long = `AWAKENED: ${awakened}`;
    return { line: (long.length <= 30 ? long : awakened).slice(0, 30) };
  }
  return { line: `+${level} ${offer.item.name}`.slice(0, 30) };
}
export function rollLoot(source: LootSource, act: number, hero: Hero, rng: Rng): LootOffer[] {
  if (source === 'FIGHT') {
    if (rng() >= FIGHT_DROP_CHANCE && hero.dryFights < PITY_AFTER) {
      hero.dryFights = (hero.dryFights ?? 0) + 1;
      return [];
    }
    hero.dryFights = 0;
  }
  if (source === 'BOSS') {return rollBossLoot(act, hero, rng);}
  const want = LOOT_COUNT[source];
  const offers: LootOffer[] = [];

  let pitied = false;
  if (source === 'LOOT') {
    const missed = oldestMissedScroll(hero, null);
    if (missed && rng() < MISSED_SCROLL_CHANCE) {
      offers.push({ kind: 'SCROLL', spell: missed });
      pitied = true;
    }
  }
  const upgradable = upgradableSlots(hero);
  if (!pitied && want > 0 && upgradable.length > 0 && rng() < (UPGRADE_CHANCE[source] ?? 0)) {
    const slot = pick(upgradable, rng);
    const item = hero.equipment[slot];
    if (item) {offers.push({ kind: 'UPGRADE', slot, item, toLevel: itemLevel(hero, slot) + 1 });}
  }
  for (const item of rollItems(source, act, hero, rng, want - offers.length)) {
    offers.push({ kind: 'ITEM', item });
  }
  return offers;
}
function signatureFor(bossId: string, hero: Hero): Item | undefined {
  const item = ITEMS.find((i) => i.bossOnly === bossId);
  if (!item) {return undefined;}
  return hero.equipment[item.slot]?.id === item.id ? undefined : item;
}
function oldestMissedScroll(hero: Hero, except: SpellId | null): SpellId | undefined {
  const missed = hero.missedScrolls;
  if (!missed || missed.length === 0) {return undefined;}
  return missed.find((sp) => sp !== except && !hero.baseSpells.includes(sp));
}
function rollBossLoot(act: number, hero: Hero, rng: Rng): LootOffer[] {
  const biome = BIOMES[clamp(act, 0, BIOMES.length - 1)];
  const offers: LootOffer[] = [];
  const scroll = biome?.scroll;
  if (scroll && !hero.baseSpells.includes(scroll)) {offers.push({ kind: 'SCROLL', spell: scroll });}
  const signature = biome ? signatureFor(biome.boss, hero) : undefined;
  if (signature) {offers.push({ kind: 'ITEM', item: signature });}
  const missed = oldestMissedScroll(hero, scroll ?? null);
  if (missed) {offers.push({ kind: 'SCROLL', spell: missed });}
  const equippedHere = new Set(offers.map((o) => (o.kind === 'ITEM' ? o.item.id : '')));
  for (const item of rollItems('BOSS', act, hero, rng, LOOT_COUNT.BOSS - offers.length)) {
    if (equippedHere.has(item.id)) {continue;}
    offers.push({ kind: 'ITEM', item });
  }
  return offers;
}

export function noteDeclinedScrolls(hero: Hero, offers: LootOffer[], taken: LootOffer | null): void {
  if (!hero.missedScrolls) {hero.missedScrolls = [];}
  for (const offer of offers) {
    if (offer.kind !== 'SCROLL' || offer === taken) {continue;}
    if (hero.baseSpells.includes(offer.spell)) {continue;}
    if (hero.missedScrolls.includes(offer.spell)) {continue;}
    hero.missedScrolls.push(offer.spell);
  }
}

function rollItems(source: LootSource, act: number, hero: Hero, rng: Rng, want: number): Item[] {
  if (want <= 0) {return [];}
  const table = LOOT_WEIGHTS[source];
  const weights = table[clamp(act, 0, table.length - 1)] ?? [1, 0, 0, 0];
  const equipped = new Set(equippedItems(hero).map((i) => i.id));
  const taken = new Set<string>();
  const available = ITEMS.filter((i) => !i.bossOnly && !equipped.has(i.id) && (i.minAct ?? 0) <= act);
  const bucket = (ri: number) =>
    available.filter((i) => i.rarity === RARITIES[ri] && !taken.has(i.id));
  const out: Item[] = [];
  for (let n = 0; n < want; n += 1) {
    let ri = rollRarity(weights, rng);
    let pool = bucket(ri);
    while (pool.length === 0 && ri > 0) {
      ri -= 1;
      pool = bucket(ri);
    }
    if (pool.length === 0) {
      for (ri = 0; ri < RARITIES.length; ri += 1) {
        pool = bucket(ri);
        if (pool.length > 0) {break;}
      }
    }
    if (pool.length === 0) {break;}
    const item = pick(pool, rng);
    taken.add(item.id);
    out.push(item);
  }
  return out;
}
function rollRarity(weights: readonly number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) {total += Math.max(0, w);}
  if (total <= 0) {return 0;}
  let r = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= Math.max(0, weights[i]);
    if (r < 0) {return i;}
  }
  return weights.length - 1;
}

export function spawnEnemy(id: string, clears: number, act: number): EnemyInstance {
  const def = ENEMIES[id];
  if (!def) {throw new Error(`unknown enemy: ${id}`);}
  const m = ACT_MULT[clamp(act, 0, ACT_MULT.length - 1)] ?? 1;
  const hp = Math.max(1, Math.round((def.hpBase + def.hpPerClear * clears) * m * def.mult));
  const atk = Math.max(1, Math.round((def.atkBase + def.atkPerClear * clears) * m * def.mult));
  return { def, hp, maxHp: hp, atk };
}
export function createBattle(enemy: EnemyInstance): BattleState {
  return { enemy, rampStacks: 0, lastScope: null, actionsTaken: 0 };
}
export function startTurn(hero: Hero): { hpRegen: number; mpRegen: number; bloodLoss: number } {
  const d = derive(hero);
  const hpRegen = clamp(d.hpRegen, 0, Math.max(0, d.maxHp - hero.hp));
  const mpRegen = clamp(d.mpRegen, 0, Math.max(0, d.maxMp - hero.mp));
  hero.hp += hpRegen;
  hero.mp += mpRegen;
  let blood = 0;
  for (const eff of allEffects(hero, 'BLOOD')) {blood += eff.hpPerTurn;}
  const bloodLoss = Math.min(blood, Math.max(0, hero.hp - 1));
  hero.hp -= bloodLoss;
  return { hpRegen, mpRegen, bloodLoss };
}
function afterResist(raw: number, kind: DamageKind, enemy: EnemyInstance): number {
  const resist = kind === 'PHYSICAL' ? enemy.def.def : enemy.def.mdef;
  return Math.max(1, Math.round(raw * (1 - resist / 100)));
}
interface Swing {
  base: number;
  kind: DamageKind;
  verb: string;
  mults: number[];
}
function swingFor(hero: Hero, d: Derived, action: HeroAction): Swing {
  const hex = findEffect(hero, 'HEX_STRIKE');
  if (action === 'ATTACK') {
    const weaponKind: DamageKind = hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL';
    const swing: Swing = {
      base: weaponKind === 'MAGIC' ? d.mag : d.atk,
      kind: weaponKind,
      verb: 'STRIKES',
      mults: [1],
    };
    if (hex) {
      swing.kind = 'MAGIC';
      swing.base = d.atk;
    }
    const twin = findEffect(hero, 'TWIN_STRIKE');
    if (twin) {swing.mults.push(twin.secondHitMult);}
    return swing;
  }
  const spell = SPELLS[action];
  const swing: Swing = {
    base: spell.scale === 'MAG' ? d.mag : d.atk,
    kind: spell.kind,
    verb: spell.verb,
    mults: Array.from({ length: Math.max(1, spell.hits) }, () => spell.mult),
  };

  if (hex && spell.kind === 'PHYSICAL' && (action === 'SLASH' || hex.allPhysical)) {
    swing.kind = 'MAGIC';
    swing.base = d.atk;
  }
  const twice = findEffect(hero, 'SPELL_TWICE');
  if (twice && twice.spell === action) {swing.mults.push(spell.mult * twice.secondHitMult);}
  return swing;
}

function battleLine(
  verb: string,
  enemyName: string,
  nums: number[],
  crit: boolean,
  rampSuffix: string,
): string {
  const joined = nums.join('+');
  const core = `HERO ${verb} ${enemyName} FOR ${joined}!`;
  const prefix = crit ? 'CRITICAL! ' : '';
  const candidates = [prefix + core + rampSuffix, prefix + core, core];
  for (const c of candidates) {if (c.length <= 52) {return c;}}
  const total = nums.reduce((a, b) => a + b, 0);
  const short = `HERO HITS ${enemyName} FOR ${total}!`;
  return short.slice(0, 52);
}

export function heroAct(
  hero: Hero,
  battle: BattleState,
  action: HeroAction,
  rng: Rng,
): HeroActResult {
  const d = derive(hero);
  const enemy = battle.enemy;
  const scope: 'ATTACK' | 'SPELL' = action === 'ATTACK' ? 'ATTACK' : 'SPELL';
  const spell = action === 'ATTACK' ? undefined : SPELLS[action];
  if (spell) {hero.mp = Math.max(0, hero.mp - spellCost(hero, action as SpellId));}
  const ramp = findEffect(hero, 'RAMP');
  const rampActive = !!ramp && ramp.scope === scope;
  const rampMult = rampActive ? 1 + ramp.perStack * battle.rampStacks : 1;
  const rampSuffix = rampActive && battle.rampStacks > 0 ? ` (X${rampMult.toFixed(2)})` : '';
  const firstStrike = findEffect(hero, 'FIRST_STRIKE');
  const openerMult = firstStrike && battle.actionsTaken === 0 ? firstStrike.mult : 1;
  const advance = () => {
    if (ramp) {
      if (rampActive) {battle.rampStacks = Math.min(ramp.maxStacks, battle.rampStacks + 1);}
      else if (!ramp.sticky) {battle.rampStacks = 0;}
    }
    battle.lastScope = scope;
    battle.actionsTaken += 1;
  };
  if (spell?.heal !== undefined) {
    const room = Math.max(0, d.maxHp - hero.hp);
    const healed = Math.min(Math.round(d.maxHp * spell.heal), room);
    hero.hp += healed;
    advance();
    return {
      hits: [],
      healed,
      mpRestored: 0,
      text: `HERO ${spell.verb} +${healed} HP!`.slice(0, 52),
      enemyDefeated: false,
      crit: false,
    };
  }
  const swing = swingFor(hero, d, action);
  const execute = findEffect(hero, 'EXECUTE');
  const mpOnHit = findEffect(hero, 'MP_ON_HIT');
  const hits: Hit[] = [];
  let anyCrit = false;
  let total = 0;
  let mpRestored = 0;

  for (const mult of swing.mults) {
    let raw = swing.base * mult * jitter(rng) * rampMult * openerMult;
    const crit = rng() * 100 < d.crit;
    if (crit) {
      raw *= d.critMult;
      anyCrit = true;
    }
    if (execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= execute.threshold) {
      raw *= 1 + execute.bonus;
    }
    const dmg = afterResist(raw, swing.kind, enemy);
    hits.push({ dmg, crit, kind: swing.kind });
    total += dmg;
    if (mpOnHit) {mpRestored += mpOnHit.amount;}
  }
  enemy.hp = Math.max(0, enemy.hp - total);

  let healed = 0;
  const drain = findEffect(hero, 'DRAIN');
  if (drain) {healed += Math.round(total * drain.fraction);}
  if (spell?.leech) {healed += Math.round(total * spell.leech);}
  if (healed > 0) {
    healed = Math.min(healed, Math.max(0, d.maxHp - hero.hp));
    hero.hp += healed;
  }
  if (mpRestored > 0) {
    mpRestored = Math.min(mpRestored, Math.max(0, d.maxMp - hero.mp));
    hero.mp += mpRestored;
  }
  advance();
  return {
    hits,
    healed,
    mpRestored,
    text: battleLine(swing.verb, enemy.def.name, hits.map((h) => h.dmg), anyCrit, rampSuffix),
    enemyDefeated: enemy.hp <= 0,
    crit: anyCrit,
  };
}

function reviveCharges(hero: Hero): { total: number; hpFraction: number } {
  let total = 0;
  let hpFraction = 0;
  for (const eff of allEffects(hero, 'REVIVE')) {
    total += eff.twice ? 2 : 1;
    hpFraction = Math.max(hpFraction, eff.hpFraction);
  }
  return { total: Math.min(2, total), hpFraction };
}
export function enemyAct(hero: Hero, battle: BattleState, rng: Rng): EnemyActResult {
  const d = derive(hero);
  const enemy = battle.enemy;
  const name = enemy.def.name;
  if (rng() * 100 < d.dodge) {
    return {
      dodged: true,
      dmg: 0,
      reflected: 0,
      revived: false,
      heroDead: false,
      enemyDefeated: false,
      text: `YOU DODGE ${name}'S BLOW!`.slice(0, 52),
    };
  }
  const physical = enemy.def.atkType === 'PHYSICAL';
  const resist = physical ? d.def : d.mdef;
  const dmg = Math.max(1, Math.round(enemy.atk * jitter(rng) * (1 - resist / 100)));
  hero.hp -= dmg;
  let reflected = 0;
  const reflect = findEffect(hero, 'REFLECT');
  if (reflect && reflect.fraction > 0 && (physical || reflect.magicToo)) {
    reflected = Math.max(1, Math.round(dmg * reflect.fraction));
    enemy.hp = Math.max(0, enemy.hp - reflected);
  }
  const enemyDefeated = enemy.hp <= 0;
  const verb = physical ? 'STRIKES' : 'HEXES';
  if (hero.hp <= 0) {
    const charges = reviveCharges(hero);
    const spent = (hero.revived ? 1 : 0) + (hero.revivedTwice ? 1 : 0);
    if (spent < charges.total) {
      hero.hp = Math.max(1, Math.round(d.maxHp * charges.hpFraction));
      if (!hero.revived) {hero.revived = true;}
      else {hero.revivedTwice = true;}
      return {
        dodged: false,
        dmg,
        reflected,
        revived: true,
        heroDead: false,
        enemyDefeated,
        text: `${name} FELLS YOU! YOUR GEAR BURNS - YOU RISE!`.slice(0, 52),
      };
    }
    hero.hp = 0;
    return {
      dodged: false,
      dmg,
      reflected,
      revived: false,
      heroDead: true,
      enemyDefeated,
      text: `${name} ${verb} YOU FOR ${dmg} - YOU FALL!`.slice(0, 52),
    };
  }

  return {
    dodged: false,
    dmg,
    reflected,
    revived: false,
    heroDead: false,
    enemyDefeated,
    text: `${name} ${verb} YOU FOR ${dmg}!`.slice(0, 52),
  };
}
export type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT';
export interface Policy {
  allocate(hero: Hero, d: Derived): StatKey;
  pick(hero: Hero, offered: LootOffer[], act: number): LootOffer | null;
  act(hero: Hero, d: Derived, battle: BattleState, actions: HeroAction[]): HeroAction;
  route(roomTypes: RoomType[]): number;
}
export interface RunResult {
  won: boolean;
  actReached: number;
  clears: number;
  deathBy: string;
  finalDerived: Derived;
  itemsHeld: string[];
  probes: Probe[];
  deathKind: '' | 'NORMAL' | 'ELITE' | 'BOSS' | 'STALL';
  upgradesTaken?: number;
  itemsTaken?: number;
  elitesFought?: number;
  chestsOpened?: number;
  hpAtElite?: number[];
  rooms?: RoomType[];
  scrollsTaken?: number;
  scrollsDeclined?: number;
  bossPicks?: BossPick[];
  scrollsMissedAtEnd?: number;
}

export type BossPick = 'SCROLL' | 'MISSED_SCROLL' | 'SIGNATURE' | 'ROLLED' | 'UPGRADE' | 'NONE';
export interface Probe {
  act: number;
  clears: number;
  won: boolean;
  maxHp: number; atk: number; mag: number; def: number; mdef: number; crit: number; dodge: number;
  bossHp: number; bossAtk: number;
  turns: number;

  hitFrac: number;

  dpt: number;
  ttk: number;
}
type Profile = Record<DField, number>;
const P_BALANCED: Profile = { ...D_WEIGHT };
const P_OFFENCE: Profile = {
  maxHp: 0.15, maxMp: 1.0, atk: 3.2, mag: 3.2, def: 0.4, mdef: 0.4,
  crit: 3.5, critMult: 35, dodge: 1.5, hpRegen: 1.5, mpRegen: 4,
};
const P_DEFENCE: Profile = {
  maxHp: 1.1, maxMp: 0.6, atk: 1.4, mag: 1.4, def: 3.2, mdef: 3.2,
  crit: 1.0, critMult: 8, dodge: 3.0, hpRegen: 4, mpRegen: 2,
};
const RARITY_BONUS: Record<Rarity, number> = { COMMON: 0, RARE: 1.5, EPIC: 4, LEGENDARY: 7 };
function effectValue(effect: ItemEffect): number {
  switch (effect.kind) {
    case 'HEX_STRIKE': return effect.allPhysical ? 8 : 5;
    case 'RAMP': return effect.perStack * effect.maxStacks * 22 * (effect.sticky ? 1.4 : 1);
    case 'TWIN_STRIKE': return effect.secondHitMult * 16;
    case 'SPELL_TWICE': return effect.secondHitMult * 13;
    case 'CHEAPER_SPELLS': return effect.amount * 4;
    case 'DRAIN': return effect.fraction * 34;
    case 'REFLECT': return effect.fraction * 14 * (effect.magicToo ? 1.6 : 1);
    case 'REVIVE': return effect.twice ? 22 : 12;
    case 'MP_ON_HIT': return effect.amount * 3;
    case 'GLASS': return 0;
    case 'BLOOD': return -effect.hpPerTurn * 4;
    case 'EXECUTE': return effect.bonus * 16;
    case 'FIRST_STRIKE': return (effect.mult - 1) * 8;
    case 'GRANT_SPELL': return 8 + (effect.discount ?? 0) * 2;
    case 'NONE': return 0;
    default: return 0;
  }
}

function scoreItem(hero: Hero, item: Item, profile: Profile): number {
  const before = derive(hero);
  const after = deriveWith(hero, item);
  let score = 0;
  for (const f of D_FIELDS) {score += (after[f] - before[f]) * profile[f];}
  score += effectValue(effectiveEffect(item, 0));
  const current = hero.equipment[item.slot];
  if (current) {score -= effectValue(effectiveEffect(current, itemLevel(hero, item.slot)));}
  return score;
}
function scoreUpgrade(
  hero: Hero,
  offer: Extract<LootOffer, { kind: 'UPGRADE' }>,
  profile: Profile,
): number {
  const from = Math.max(0, offer.toLevel - 1);
  const before = deriveGhost(hero, offer.slot, offer.item, from);
  const after = deriveGhost(hero, offer.slot, offer.item, offer.toLevel);
  let score = 0;
  for (const f of D_FIELDS) {score += (after[f] - before[f]) * profile[f];}
  score += effectValue(effectiveEffect(offer.item, offer.toLevel));
  score -= effectValue(effectiveEffect(offer.item, from));
  score += RARITY_BONUS[offer.item.rarity] * 0.8;
  return score;
}
const SCROLL_BASE: Record<SpellId, number> = {
  FIREBALL: 0, WATER: 22, SLASH: 24, THUNDER: 34,
  TWINBOLT: 0, LEECH: 0, QUAKE: 0, MEND: 0,
};
const SCROLL_DAMAGE_WEIGHT = 2.0;

function scoreScroll(hero: Hero, spell: SpellId): number {
  if (hero.baseSpells.includes(spell)) {return 0;}
  const d = derive(hero);
  const perCast = (id: SpellId): number => {
    const def = SPELLS[id];
    if (!def || def.heal !== undefined) {return 0;}
    const base = def.scale === 'MAG' ? d.mag : d.atk;
    return base * def.mult * Math.max(1, def.hits);
  };
  let best = hero.equipment.WEAPON?.weaponKind === 'MAGIC' ? d.mag : d.atk;
  for (const id of knownSpells(hero)) {best = Math.max(best, perCast(id));}
  const delta = Math.max(0, perCast(spell) - best);
  return SCROLL_BASE[spell] + delta * SCROLL_DAMAGE_WEIGHT;
}
function scoreOffer(
  hero: Hero,
  offer: LootOffer,
  profile: Profile,
  bonus?: (i: Item) => number,
): number {
  if (offer.kind === 'SCROLL') {return scoreScroll(hero, offer.spell);}
  if (offer.kind === 'UPGRADE') {return scoreUpgrade(hero, offer, profile);}
  return scoreItem(hero, offer.item, profile)
    + RARITY_BONUS[offer.item.rarity]
    + (bonus ? bonus(offer.item) : 0);
}
function bestPick(
  hero: Hero,
  offered: LootOffer[],
  profile: Profile,
  bonus?: (i: Item) => number,
): LootOffer | null {
  let best: LootOffer | null = null;
  let bestScore = 0.5;
  for (const offer of offered) {
    const score = scoreOffer(hero, offer, profile, bonus);
    if (score > bestScore) {
      bestScore = score;
      best = offer;
    }
  }
  return best;
}
function expectedDamage(hero: Hero, d: Derived, battle: BattleState, action: HeroAction): number {
  if (action !== 'ATTACK' && SPELLS[action]?.heal !== undefined) {return 0;}
  const swing = swingFor(hero, d, action);
  const resist = swing.kind === 'PHYSICAL' ? battle.enemy.def.def : battle.enemy.def.mdef;
  const critFactor = 1 + (d.crit / 100) * (d.critMult - 1);
  let sum = 0;
  for (const m of swing.mults) {sum += swing.base * m;}
  return Math.max(0, sum * critFactor * (1 - resist / 100));
}
function damagePolicyAct(
  hero: Hero,
  d: Derived,
  battle: BattleState,
  actions: HeroAction[],
  mendBelow: number,
): HeroAction {
  const affordable = actions.filter((a) => canAfford(hero, a));
  const mend = affordable.find((a) => a !== 'ATTACK' && SPELLS[a]?.heal !== undefined);
  const hpFrac = hero.hp / Math.max(1, d.maxHp);
  if (mend && hpFrac < mendBelow) {return mend;}
  const knowsMend = actions.some((a) => a !== 'ATTACK' && SPELLS[a]?.heal !== undefined);
  const mendId = knowsMend
    ? (actions.find((a) => a !== 'ATTACK' && SPELLS[a]?.heal !== undefined) as SpellId)
    : null;
  const reserve = mendId && hpFrac < 0.6 ? spellCost(hero, mendId) : 0;
  let best: HeroAction = 'ATTACK';
  let bestDmg = expectedDamage(hero, d, battle, 'ATTACK');
  let bestCost = 0;
  for (const a of affordable) {
    if (a === 'ATTACK') {continue;}
    const dmg = expectedDamage(hero, d, battle, a);
    if (dmg <= 0) {continue;}
    const cost = spellCost(hero, a);

    if (hero.mp - cost < reserve && dmg < battle.enemy.hp) {continue;}
    if (dmg > bestDmg + 1e-9 || (dmg > bestDmg - 1e-9 && cost < bestCost)) {
      bestDmg = dmg;
      best = a;
      bestCost = cost;
    }
  }
  return best;
}

function atCap(d: Derived, stat: StatKey): boolean {
  if (stat === 'DEF') {return d.def >= CAP_DEF;}
  if (stat === 'MDEF') {return d.mdef >= CAP_MDEF;}
  if (stat === 'CRIT') {return d.crit >= CAP_CRIT;}
  return false;
}
function cycleAllocate(hero: Hero, d: Derived, cycle: StatKey[], fallback: StatKey): StatKey {
  let spent = 0;
  for (const k of STAT_KEYS) {spent += hero.alloc[k];}
  for (let i = 0; i < cycle.length; i += 1) {
    const stat = cycle[(spent + i) % cycle.length];
    if (!atCap(d, stat)) {return stat;}
  }
  return atCap(d, fallback) ? 'HP' : fallback;
}
const primaryStat = (d: Derived): StatKey => (d.atk >= d.mag ? 'ATK' : 'MAG');
function routePreferring(offered: RoomType[], order: RoomType[]): number {
  for (const want of order) {
    const i = offered.indexOf(want);
    if (i >= 0) {return i;}
  }
  return 0;
}
let _rngRef: Rng = () => 0.5;
let _heroRef: Hero | null = null;
function heroHpFraction(): number {
  if (!_heroRef) {return 1;}
  const d = derive(_heroRef);
  return _heroRef.hp / Math.max(1, d.maxHp);
}
function routeWithRest(offered: RoomType[], restBelow: number, order: RoomType[]): number {
  if (heroHpFraction() < restBelow) {
    const rest = offered.indexOf('REST');
    if (rest >= 0) {return rest;}
  }
  return routePreferring(offered, order);
}
const BALANCED_ALLOCATE = (hero: Hero, d: Derived): StatKey =>
  cycleAllocate(hero, d, [primaryStat(d), 'HP', 'DEF', 'MDEF'], 'HP');
export type PolicyName =
  | 'random' | 'balanced' | 'glass' | 'tank' | 'eliteHungry' | 'chestHungry';
export const POLICIES: Record<PolicyName, Policy> = {
  random: {
    allocate: (_hero, _d) => STAT_KEYS[Math.floor(_rngRef() * STAT_KEYS.length)],
    pick: (_hero, offered) =>
      offered.length === 0 || _rngRef() < 0.2 ? null : offered[Math.floor(_rngRef() * offered.length)],
    act: (hero, _d, _battle, actions) => {
      const affordable = actions.filter((a) => canAfford(hero, a));
      return affordable[Math.floor(_rngRef() * affordable.length)] ?? 'ATTACK';
    },
    route: (types) => Math.floor(_rngRef() * types.length),
  },
  balanced: {
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: (hero, d, battle, actions) => damagePolicyAct(hero, d, battle, actions, 0.35),
    route: (types) => routeWithRest(types, 0.5, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },
  glass: {
    allocate: (hero, d) => cycleAllocate(hero, d, [primaryStat(d), 'CRIT', primaryStat(d), 'HP'], primaryStat(d)),
    pick: (hero, offered) =>
      bestPick(hero, offered, P_OFFENCE, (i) =>
        i.slot === 'WEAPON' && i.weaponKind === 'MAGIC' ? 8 : 0),
    act: (hero, d, battle, actions) => damagePolicyAct(hero, d, battle, actions, 0.35),
    route: (types) => routeWithRest(types, 0.45, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },

  tank: {
    allocate: (hero, d) => cycleAllocate(hero, d, ['HP', 'DEF', 'ATK', 'MDEF'], 'HP'),
    pick: (hero, offered) =>
      bestPick(hero, offered, P_DEFENCE, (i) =>
        i.slot === 'WEAPON' && i.weaponKind !== 'MAGIC' ? 6 : 0),
    act: (hero, d, battle, actions) => damagePolicyAct(hero, d, battle, actions, 0.5),
    route: (types) => routeWithRest(types, 0.55, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },
  eliteHungry: {
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: (hero, d, battle, actions) => damagePolicyAct(hero, d, battle, actions, 0.35),
    route: (types) => {
      const elite = types.indexOf('ELITE');
      if (elite >= 0) {return elite;}
      return routeWithRest(types, 0.5, ['LOOT', 'FIGHT', 'REST']);
    },
  },

  chestHungry: {
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: (hero, d, battle, actions) => damagePolicyAct(hero, d, battle, actions, 0.35),
    route: (types) => {
      const hp = heroHpFraction();
      if (hp < 0.5) {
        const rest = types.indexOf('REST');
        if (rest >= 0) {return rest;}
      }
      const loot = types.indexOf('LOOT');
      if (loot >= 0) {return loot;}
      const fight = types.indexOf('FIGHT');
      if (fight >= 0) {return fight;}
      const elite = types.indexOf('ELITE');
      if (elite >= 0 && hp > 0.7) {return elite;}
      return routePreferring(types, ['REST', 'ELITE']);
    },
  },
};

const ROOMS_PER_ACT = 6;
const TURN_CAP = 80;
const STAGE_SIZES = [2, 3, 2, 3, 2, 3];
interface MapNode { type: RoomType; links: number[] }
function pickRoomType(rng: Rng): RoomType {
  const r = rng();
  if (r < 0.15) {return 'ELITE';}
  if (r < 0.3) {return 'REST';}
  if (r < 0.42) {return 'LOOT';}
  return 'FIGHT';
}
function span(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let j = lo; j <= hi; j += 1) {out.push(j);}
  return out;
}
function linkStage(cur: MapNode[], next: MapNode[], rng: Rng): void {
  const a = cur.length;
  const b = next.length;
  if (a === 0 || b === 0) {return;}
  let prevHi = -1;
  let prevPrevHi = -1;
  for (let i = 0; i < a; i += 1) {
    const straight = Math.round((i * (b - 1)) / Math.max(1, a - 1));
    const width = b >= 2 && rng() < 0.85 ? 2 : 1;
    const minLo = Math.max(0, prevPrevHi, prevHi - 1);
    const lo = Math.max(minLo, Math.min(straight, b - 1));
    const hi = Math.min(b - 1, lo + width - 1);
    cur[i].links = span(Math.min(lo, hi), hi);
    prevPrevHi = prevHi;
    prevHi = hi;
  }
  for (let j = 0; j < b; j += 1) {
    if (cur.some((n) => n.links.includes(j))) {continue;}
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < a; i += 1) {
      const l = cur[i].links;
      if (l.length === 0) {continue;}
      const lo = l[0];
      const hi = l[l.length - 1];
      const dist = j < lo ? lo - j : j > hi ? j - hi : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    const l = cur[best].links;
    const lo = l.length > 0 ? Math.min(l[0], j) : j;
    const hi = l.length > 0 ? Math.max(l[l.length - 1], j) : j;
    cur[best].links = span(lo, hi);
  }
}

function buildMap(rng: Rng): MapNode[][] {
  const stages: MapNode[][] = [];
  for (const size of STAGE_SIZES) {
    const stage: MapNode[] = [];
    for (let n = 0; n < size; n += 1) {stage.push({ type: pickRoomType(rng), links: [] });}
    stages.push(stage);
  }
  for (const n of stages[0]) {if (n.type === 'ELITE') {n.type = 'FIGHT';}}
  if (!stages.slice(1).some((st) => st.some((n) => n.type === 'ELITE'))) {
    const st = stages[2];
    st[Math.floor(rng() * st.length)].type = 'ELITE';
  }
  if (!stages.some((st) => st.some((n) => n.type === 'REST'))) {
    const st = stages[4];
    st[Math.floor(rng() * st.length)].type = 'REST';
  }
  if (!stages.some((st) => st.some((n) => n.type === 'LOOT'))) {
    const restStage = stages.find((st) => st.length > 1 && st.some((n) => n.type === 'REST')) ?? stages[3];
    const cands = restStage.filter((n) => n.type !== 'REST');
    const target = cands[Math.floor(rng() * cands.length)] ?? restStage[0];
    target.type = 'LOOT';
  }
  for (let s = 0; s < stages.length - 1; s += 1) {linkStage(stages[s], stages[s + 1], rng);}
  for (let s = 0; s < stages.length - 1; s += 1) {
    for (const node of stages[s]) {
      if (node.type !== 'REST') {continue;}
      for (const j of node.links) {
        if (stages[s + 1][j].type === 'REST') {stages[s + 1][j].type = 'FIGHT';}
      }
    }
  }
  return stages;
}
export function buildMapForCheck(rng: Rng) { return buildMap(rng); }
interface BattleOutcome {
  won: boolean;
  stalled: boolean;
  turns: number;
  dmgTaken: number;
  landed: number;
  dmgDealt: number;
}

function runBattle(hero: Hero, enemy: EnemyInstance, policy: Policy, rng: Rng): BattleOutcome {
  const battle = createBattle(enemy);
  const startHp = enemy.hp;
  const dealt = () => startHp - enemy.hp;
  let dmgTaken = 0;
  let landed = 0;
  for (let turn = 0; turn < TURN_CAP; turn += 1) {
    startTurn(hero);
    if (hero.hp <= 0) {return { won: false, stalled: false, turns: turn, dmgTaken, landed, dmgDealt: dealt() };}
    const d = derive(hero);
    const actions = heroActions(hero).filter((a) => canAfford(hero, a));
    const wanted = policy.act(hero, d, battle, actions);
    const action = actions.includes(wanted) ? wanted : 'ATTACK';
    const result = heroAct(hero, battle, action, rng);
    if (result.enemyDefeated) {return { won: true, stalled: false, turns: turn + 1, dmgTaken, landed, dmgDealt: dealt() };}
    const reply = enemyAct(hero, battle, rng);
    if (!reply.dodged) {
      dmgTaken += reply.dmg;
      landed += 1;
    }
    if (reply.enemyDefeated) {return { won: true, stalled: false, turns: turn + 1, dmgTaken, landed, dmgDealt: dealt() };}
    if (reply.heroDead) {return { won: false, stalled: false, turns: turn + 1, dmgTaken, landed, dmgDealt: dealt() };}
  }
  return { won: false, stalled: true, turns: TURN_CAP, dmgTaken, landed, dmgDealt: dealt() };
}
function spendAll(hero: Hero, policy: Policy): void {
  let guard = 0;
  while (hero.sp > 0 && guard < 200) {
    guard += 1;
    const d = derive(hero);
    const wanted = policy.allocate(hero, d);
    const stat: StatKey = STAT_KEYS.includes(wanted) ? wanted : 'HP';
    if (!spendPoint(hero, stat)) {break;}
  }
}
interface Tally {
  upgradesTaken: number;
  itemsTaken: number;
  elitesFought: number;
  chestsOpened: number;
  hpAtElite: number[];
  rooms: RoomType[];
  scrollsTaken: number;
  scrollsDeclined: number;
  bossPicks: BossPick[];
}
function offerLoot(
  hero: Hero,
  source: LootSource,
  act: number,
  policy: Policy,
  rng: Rng,
  tally: Tally,
): void {
  const offered = rollLoot(source, act, hero, rng);
  if (offered.length === 0) {return;}
  const picked = policy.pick(hero, offered, act);
  const chosen = picked && offered.includes(picked) ? picked : null;
  const scrollsOffered = offered.reduce((n, o) => n + (o.kind === 'SCROLL' ? 1 : 0), 0);
  if (source === 'BOSS') {
    const current = BIOMES[clamp(act, 0, BIOMES.length - 1)]?.scroll;
    let kind: BossPick = 'NONE';
    if (chosen?.kind === 'SCROLL') {kind = chosen.spell === current ? 'SCROLL' : 'MISSED_SCROLL';}
    else if (chosen?.kind === 'ITEM') {kind = chosen.item.bossOnly ? 'SIGNATURE' : 'ROLLED';}
    else if (chosen?.kind === 'UPGRADE') {kind = 'UPGRADE';}
    tally.bossPicks.push(kind);
  }
  if (chosen) {
    applyOffer(hero, chosen, rng);
    if (chosen.kind === 'UPGRADE') {tally.upgradesTaken += 1;}
    else if (chosen.kind === 'SCROLL') {tally.scrollsTaken += 1;}
    else {tally.itemsTaken += 1;}
  } else {
    skipMend(hero);
  }
  noteDeclinedScrolls(hero, offered, chosen);
  tally.scrollsDeclined += scrollsOffered - (chosen?.kind === 'SCROLL' ? 1 : 0);
}

export function simulateRun(policy: Policy, rng: Rng): RunResult {
  const previousRng = _rngRef;
  const previousHero = _heroRef;
  _rngRef = rng;
  try {
    const hero = createHero();
    _heroRef = hero;
    let clears = 0;
    let actReached = 0;
    let deathBy = '';
    const probes: Probe[] = [];
    const tally: Tally = {
      upgradesTaken: 0, itemsTaken: 0, elitesFought: 0, chestsOpened: 0, hpAtElite: [], rooms: [],
      scrollsTaken: 0, scrollsDeclined: 0, bossPicks: [],
    };
    for (let act = 0; act < BIOMES.length; act += 1) {
      actReached = act;
      const biome = BIOMES[act];

      const stages = buildMap(rng);
      const entryTypes = stages[0].map((n) => n.type);
      let slot = clamp(Math.floor(policy.route(entryTypes)), 0, entryTypes.length - 1);
      for (let r = 0; r < ROOMS_PER_ACT; r += 1) {
        const node = stages[r][slot];
        const room = node.type;
        if (r + 1 < ROOMS_PER_ACT) {
          const links = node.links.length > 0 ? node.links : [0];
          const offered = links.map((j) => stages[r + 1][j].type);
          const idx = clamp(Math.floor(policy.route(offered)), 0, offered.length - 1);
          slot = clamp(links[idx], 0, stages[r + 1].length - 1);
        }
        tally.rooms.push(room);
        if (room === 'REST') {
          fullHeal(hero);
          continue;
        }
        if (room === 'LOOT') {
          tally.chestsOpened += 1;
          offerLoot(hero, 'LOOT', act, policy, rng, tally);
          continue;
        }
        const elite = room === 'ELITE';
        if (elite) {
          tally.elitesFought += 1;
          tally.hpAtElite.push(hero.hp / Math.max(1, derive(hero).maxHp));
        }
        const ids = elite ? biome.elites : biome.normals;
        const enemyId = ids.length > 0 ? pick(ids, rng) : pick(biome.normals, rng);
        const enemy = spawnEnemy(enemyId, clears, act);
        const outcome = runBattle(hero, enemy, policy, rng);
        if (!outcome.won) {
          deathBy = outcome.stalled ? 'STALL' : enemyId;
          return finish(hero, false, actReached, clears, deathBy, probes, outcome.stalled ? 'STALL' : (elite ? 'ELITE' : 'NORMAL'), tally);
        }
        clears += 1;
        grantClear(hero, elite ? 'ELITE' : 'NORMAL');
        spendAll(hero, policy);
        offerLoot(hero, elite ? 'ELITE' : 'FIGHT', act, policy, rng, tally);
      }

      healFraction(hero, BOSS_ENTRY_HEAL);
      const boss = spawnEnemy(biome.boss, clears, act);
      const entry = derive(hero);
      const bossHp = boss.hp;
      const bossAtk = boss.atk;
      const outcome = runBattle(hero, boss, policy, rng);
      probes.push({
        act,
        clears,
        won: outcome.won,
        maxHp: entry.maxHp, atk: entry.atk, mag: entry.mag,
        def: entry.def, mdef: entry.mdef, crit: entry.crit, dodge: entry.dodge,
        bossHp, bossAtk,
        turns: outcome.turns,
        hitFrac: outcome.landed > 0 ? outcome.dmgTaken / outcome.landed / Math.max(1, entry.maxHp) : 0,
        dpt: outcome.dmgDealt / Math.max(1, outcome.turns),
        ttk: bossHp / Math.max(1, outcome.dmgDealt / Math.max(1, outcome.turns)),
      });
      if (!outcome.won) {
        deathBy = outcome.stalled ? 'STALL' : biome.boss;
        return finish(hero, false, actReached, clears, deathBy, probes, outcome.stalled ? 'STALL' : 'BOSS', tally);
      }
      clears += 1;
      grantClear(hero, 'BOSS');
      spendAll(hero, policy);
      offerLoot(hero, 'BOSS', act, policy, rng, tally);
    }
    return finish(hero, true, Math.max(0, BIOMES.length - 1), clears, '', probes, '', tally);
  } finally {
    _rngRef = previousRng;
    _heroRef = previousHero;
  }
}
function finish(
  hero: Hero,
  won: boolean,
  actReached: number,
  clears: number,
  deathBy: string,
  probes: Probe[],
  deathKind: RunResult['deathKind'],
  tally: Tally,
): RunResult {
  return {
    won,
    actReached,
    clears,
    deathBy,
    finalDerived: derive(hero),
    itemsHeld: equippedItems(hero).map((i) => i.id),
    probes,
    deathKind,
    upgradesTaken: tally.upgradesTaken,
    itemsTaken: tally.itemsTaken,
    elitesFought: tally.elitesFought,
    chestsOpened: tally.chestsOpened,
    hpAtElite: tally.hpAtElite,
    rooms: tally.rooms,
    scrollsTaken: tally.scrollsTaken,
    scrollsDeclined: tally.scrollsDeclined,
    bossPicks: tally.bossPicks,
    scrollsMissedAtEnd: (hero.missedScrolls ?? []).length,
  };
}