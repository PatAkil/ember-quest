import { PACT_IDS, PACT_OFFERS, type Hero, type PactId, type PactMod, type Rng } from '../types';
import { PACTS } from '../data';
import { pickOneIndex } from './util';

type Fold = 'MULT' | 'ADD';
export type PactTotals = Required<PactMod>;

const FOLD: Record<keyof PactMod, Fold> = {
  maxHpMult: 'MULT', dmgMult: 'MULT', clearHealMult: 'MULT', spPerClear: 'ADD',
  foeAffix: 'ADD', rarityShift: 'ADD', foeAtkMult: 'MULT', spPerBoss: 'ADD',
  fightDrops: 'MULT', extraCard: 'ADD', attackMult: 'MULT', burstGainMult: 'MULT',
  restHealMult: 'MULT', restUpgrade: 'ADD', eliteHpMult: 'MULT', eliteSp: 'ADD', eliteExtraCard: 'ADD',
};

const MOD_KEYS = Object.keys(FOLD) as (keyof PactMod)[];

const NEUTRAL_MODS: PactTotals = {
  maxHpMult: 1, dmgMult: 1, clearHealMult: 1, spPerClear: 0,
  foeAffix: 0, rarityShift: 0, foeAtkMult: 1, spPerBoss: 0,
  fightDrops: 1, extraCard: 0, attackMult: 1, burstGainMult: 1,
  restHealMult: 1, restUpgrade: 0, eliteHpMult: 1, eliteSp: 0, eliteExtraCard: 0,
};

export const neutralMods = (): PactTotals => ({ ...NEUTRAL_MODS });

function foldInto(totals: PactTotals, mods: PactMod): void {
  for (const key of MOD_KEYS) {
    const value = mods[key];
    if (value === undefined) {continue;}
    totals[key] = FOLD[key] === 'MULT' ? totals[key] * value : totals[key] + value;
  }
}

export function pactMods(hero: Hero): PactTotals {
  const totals = neutralMods();
  for (const id of hero.pacts) {foldInto(totals, PACTS[id].mods);}
  return totals;
}

export function offerPacts(hero: Hero, rng: Rng): PactId[] {
  const left = PACT_IDS.filter((id) => !hero.pacts.includes(id));
  const offers: PactId[] = [];
  while (offers.length < PACT_OFFERS && left.length > 0) {offers.push(...left.splice(pickOneIndex(rng, left.length), 1));}
  return offers;
}

export function takePact(hero: Hero, id: PactId): void {
  if (!hero.pacts.includes(id)) {hero.pacts.push(id);}
}

export function pactDamage(hero: Hero, attack: boolean): number {
  const mods = pactMods(hero);
  return attack ? mods.dmgMult * mods.attackMult : mods.dmgMult;
}
