import type { AffixId, BattleState, Hero, HeroAction, HeroActResult, Rng } from '../types';
import { SPELLS } from '../data';
import { thornsDamage } from './affixes';
import { ROLL_TOP, heroAct, rollScript, strikesFoe, swingFor, volleyHeal, type RollPlan } from './combat';
import { derive, isSpell } from './hero';
import { atTurnStart, startTurn } from './status';

export interface Case { hero: Hero; battle: BattleState; action: HeroAction }

export interface Rehearsal { hero: Hero; battle: BattleState; result: HeroActResult }

function rehearse(c: Case, rng: Rng): Rehearsal {
  const hero: Hero = { ...c.hero, burn: c.hero.burn ? { ...c.hero.burn } : null };
  const battle: BattleState = { ...c.battle, enemy: { ...c.battle.enemy } };
  startTurn(hero, c.action);
  const result = heroAct(hero, battle, c.action, rng);
  return { hero, battle, result };
}

export const play = (c: Case, plan: RollPlan): Rehearsal => rehearse(c, rollScript(c.battle, plan));

const fill = <T>(n: number, value: T): T[] => Array.from({ length: n }, () => value);

export const planAt = (hits: number, u: number, crit = false): RollPlan => ({ evade: false, jitters: fill(hits, u), crits: fill(hits, crit) });

export const hitsOf = (hero: Hero, action: HeroAction): number => (strikesFoe(action) ? swingFor(hero, derive(hero), action).mults.length : 0);

const EVADE: RollPlan = { evade: true, jitters: [], crits: [] };

const BISECT_STEPS = 24;

const SCAN_MAX = 20000;

const carries = (battle: BattleState, affix: AffixId): boolean => battle.enemy.affixes.includes(affix);

const dealt = (r: Rehearsal): number[] => r.result.hits.map((h) => h.dmg);

const sum = (values: readonly number[]): number => values.reduce((n, v) => n + v, 0);

interface Band { crits: boolean[]; lo: number[]; hi: number[] }

function patterns(hits: number, crit: boolean): boolean[][] {
  const count = crit ? 2 ** hits : 1;
  return Array.from({ length: count }, (_, mask) => Array.from({ length: hits }, (_, i) => ((mask >> i) & 1) === 1));
}

function bandOf(c: Case, crits: boolean[]): Band {
  const at = (u: number): number[] => dealt(play(c, { evade: false, jitters: fill(crits.length, u), crits }));
  return { crits, lo: at(0), hi: at(ROLL_TOP) };
}

interface Pick { band: Band; total: number; score: number }

function scorer(c: Case): (total: number) => number {
  const ready = atTurnStart(c.hero, c.action);
  const maxHp = derive(ready).maxHp;
  const room = Math.max(0, maxHp - ready.hp);
  const spell = isSpell(c.action) ? SPELLS[c.action] : undefined;
  return (total) => Math.min(room, volleyHeal(ready, total, spell)) - thornsDamage(c.battle.enemy, total, maxHp);
}

function worstIn(band: Band, last: number, score: (total: number) => number): Pick | null {
  const from = sum(band.lo);
  const to = Math.min(sum(band.hi), last, from + SCAN_MAX);
  let best: Pick | null = null;
  for (let total = from; total <= to; total += 1) {
    const s = score(total);
    if (!best || s < best.score) {best = { band, total, score: s };}
  }
  return best;
}

function jitterFor(c: Case, band: Band, slot: { index: number; value: number; jitters: number[] }): number {
  const valueAt = (u: number): number => dealt(play(c, { evade: false, jitters: slot.jitters.map((v, i) => (i === slot.index ? u : v)), crits: band.crits }))[slot.index] ?? 0;
  let lo = 0;
  let hi = ROLL_TOP;
  for (let step = 0; step < BISECT_STEPS; step += 1) {
    const mid = (lo + hi) / 2;
    if (valueAt(mid) >= slot.value) {hi = mid;} else {lo = mid;}
  }
  return hi;
}

function rollFor(c: Case, pick: Pick): RollPlan {
  const { band } = pick;
  const jitters = fill(band.lo.length, 0);
  let left = pick.total - sum(band.lo);
  band.lo.forEach((lo, index) => {
    const span = (band.hi[index] ?? lo) - lo;
    const raise = Math.min(span, left);
    left -= raise;
    if (raise === span) {jitters[index] = ROLL_TOP;}
    else if (raise > 0) {jitters[index] = jitterFor(c, band, { index, value: lo + raise, jitters });}
  });
  return { evade: false, jitters, crits: band.crits };
}

function thornRoll(c: Case, hits: number): RollPlan | null {
  const score = scorer(c);
  const last = c.battle.enemy.hp - 1;
  let worst: Pick | null = null;
  for (const crits of patterns(hits, derive(c.hero).crit > 0)) {
    const pick = worstIn(bandOf(c, crits), last, score);
    if (pick && (!worst || pick.score < worst.score)) {worst = pick;}
  }
  return worst ? rollFor(c, worst) : null;
}

export function worstRolls(c: Case): RollPlan[] {
  const hits = hitsOf(c.hero, c.action);
  const plans = [planAt(hits, 0)];
  if (hits === 0) {return plans;}
  if (carries(c.battle, 'SWIFT')) {plans.push(EVADE);}
  const thorny = carries(c.battle, 'THORNED') ? thornRoll(c, hits) : null;
  return thorny ? [...plans, thorny] : plans;
}
