import {
  BASE,
  CAP_CRIT,
  CAP_DEF,
  CAP_DODGE,
  CAP_MDEF,
  ACT_POTIONS,
  CAP_STAT,
  POTIONS_MAX,
  SLOTS,
  SP_GAIN,
  SP_PER_KIND,
  type Derived,
  type EnemyKind,
  type Hero,
  type HeroAction,
  type HeroCommand,
  type Item,
  type OwnedItem,
  type PactId,
  type SpellId,
  type StatKey,
  type StatMods,
} from '../types';
import { CLEAR_HEAL, SKIP_MEND, SPELLS, SPELL_ORDER } from '../data';
import { allEffects, effectiveEffect, effectiveMods, itemLevel } from './gear';
import { pactMods, swallowedCards, type PactTotals } from './pacts';
import { clamp } from './util';

export function createHero(): Hero {
  return {
    hp: BASE.hp,
    mp: BASE.mp,
    sp: 0,
    alloc: { HP: 0, MP: 0, ATK: 0, MAG: 0, DEF: 0, MDEF: 0, CRIT: 0 },
    equipment: {},
    levels: {},
    pack: [],
    baseSpells: ['FIREBALL'],
    revived: false,
    revivedTwice: false,
    dryFights: 0,
    missedScrolls: [],
    potions: POTIONS_MAX,
    ember: 0,
    burn: null,
    pendingBurn: 0,
    bonusMaxHp: 0,
    pacts: [],
  };
}

function baseDerived(hero: Hero): Derived {
  return {
    maxHp: BASE.hp + SP_GAIN.HP * hero.alloc.HP + hero.bonusMaxHp,
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
}

function addCoreMods(d: Derived, m: StatMods): void {
  d.maxHp += m.hp ?? 0;
  d.maxMp += m.mp ?? 0;
  d.atk += m.atk ?? 0;
  d.mag += m.mag ?? 0;
  d.def += m.def ?? 0;
  d.mdef += m.mdef ?? 0;
}

function addEdgeMods(d: Derived, m: StatMods): void {
  d.crit += m.crit ?? 0;
  d.critMult += m.critMult ?? 0;
  d.dodge += m.dodge ?? 0;
  d.hpRegen += m.hpRegen ?? 0;
  d.mpRegen += m.mpRegen ?? 0;
}

function finalizeDerived(d: Derived, glass: number, hpMult: number): Derived {
  if (hpMult !== 1) {d.maxHp = Math.round(d.maxHp * hpMult);}
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

export function derive(hero: Hero): Derived {
  const d = baseDerived(hero);
  let glass = 0;
  for (const slot of SLOTS) {
    const item = hero.equipment[slot];
    if (!item) {continue;}
    const level = itemLevel(hero, slot);
    const mods = effectiveMods(item, level);
    addCoreMods(d, mods);
    addEdgeMods(d, mods);
    const eff = effectiveEffect(item, level);
    if (eff.kind === 'GLASS') {glass += eff.maxHpFraction;}
  }
  return finalizeDerived(d, glass, pactMods(hero).maxHpMult);
}

export function knownSpells(hero: Hero): SpellId[] {
  const set = new Set<SpellId>(hero.baseSpells);
  for (const eff of allEffects(hero, 'GRANT_SPELL')) {set.add(eff.spell);}
  return SPELL_ORDER.filter((id) => set.has(id));
}

export function heroActions(hero: Hero): HeroAction[] {
  return ['ATTACK', ...knownSpells(hero)];
}

export const battleActions = (hero: Hero): HeroAction[] => [...heroActions(hero), 'GUARD', 'BURST', 'POTION'];

export function spellCost(hero: Hero, spell: SpellId): number {
  const base = SPELLS[spell].cost;
  let discount = 0;
  for (const eff of allEffects(hero, 'CHEAPER_SPELLS')) {discount += eff.amount;}
  for (const eff of allEffects(hero, 'GRANT_SPELL')) {
    if (eff.spell === spell && eff.discount) {discount += eff.discount;}
  }
  return Math.max(1, Math.round(base - discount));
}

const COMMANDS: readonly HeroAction[] = ['ATTACK', 'GUARD', 'BURST', 'POTION'] satisfies readonly HeroCommand[];

export const isSpell = (action: HeroAction): action is SpellId => !COMMANDS.includes(action);

export const isGuardAction = (action: HeroAction): boolean => action === 'GUARD' || (isSpell(action) && SPELLS[action].guard !== undefined);

export const refillPotions = (hero: Hero): void => { hero.potions = POTIONS_MAX; };

export function clampVitals(hero: Hero, minHp: number): void {
  const d = derive(hero);
  hero.hp = clamp(hero.hp, minHp, d.maxHp);
  hero.mp = clamp(hero.mp, 0, d.maxMp);
}

function statCapped(hero: Hero, stat: StatKey): boolean {
  const cap = CAP_STAT[stat];
  return cap !== undefined && derive(hero)[cap.field] >= cap.max;
}

export function spendPoint(hero: Hero, stat: StatKey): boolean {
  if (hero.sp <= 0 || statCapped(hero, stat)) {return false;}
  hero.sp -= 1;
  hero.alloc[stat] += 1;
  if (stat === 'HP') {hero.hp += SP_GAIN.HP;}
  if (stat === 'MP') {hero.mp += SP_GAIN.MP;}
  clampVitals(hero, 0);
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
  hero.burn = null;
}

const KIND_SP: Record<EnemyKind, (mods: PactTotals) => number> = {
  NORMAL: () => 0,
  ELITE: (mods) => mods.eliteSp,
  BOSS: (mods) => mods.spPerBoss,
};

export function grantClear(hero: Hero, kind: EnemyKind): { sp: number; hp: number; mp: number } {
  const mods = pactMods(hero);
  const sp = SP_PER_KIND[kind] + mods.spPerClear + KIND_SP[kind](mods) + swallowedCards(kind, mods);
  hero.sp += sp;
  hero.burn = null;
  const healed = healFraction(hero, CLEAR_HEAL * mods.clearHealMult);
  return { sp, hp: healed.hp, mp: healed.mp };
}

export function enterActRecovery(hero: Hero): number {
  const before = hero.potions;
  hero.potions = Math.min(POTIONS_MAX, hero.potions + ACT_POTIONS);
  return hero.potions - before;
}

export function takePact(hero: Hero, id: PactId): void {
  if (hero.pacts.includes(id)) {return;}
  const before = derive(hero).maxHp;
  hero.pacts.push(id);
  hero.hp += Math.max(0, derive(hero).maxHp - before);
  clampVitals(hero, 1);
}

export function learnSpell(hero: Hero, spell: SpellId): void {
  if (!hero.baseSpells.includes(spell)) {hero.baseSpells.push(spell);}
}

export function equip(hero: Hero, item: Item, level = 0): OwnedItem | undefined {
  const previous = hero.equipment[item.slot];
  const replaced = previous ? { item: previous, level: itemLevel(hero, item.slot) } : undefined;
  hero.equipment[item.slot] = item;
  hero.levels[item.slot] = level;
  clampVitals(hero, 1);
  return replaced;
}

export function skipMend(hero: Hero): { hp: number; mp: number } {
  return healFraction(hero, SKIP_MEND);
}
