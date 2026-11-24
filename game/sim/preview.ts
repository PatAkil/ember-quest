import type { BattleState, DamageKind, Hero, HeroAction, SpellId } from '../types';
import { breakEligible, breakNeed } from './commands';
import { burstBlow } from './burst';
import { expectedHeroDamage, strikesFoe, swingFor, type RollPlan } from './combat';
import { elementMult } from './element';
import { expectedFoeDamage, guardMpIfStruck, guardTires, type FoeBlowEstimate } from './enemy-turn';
import { derive } from './hero';
import { heroElement, woundUp } from './power';
import { hitsOf, planAt, play, worstRolls, type Case, type Rehearsal } from './rehearse';
import { livesLeft, pendingTick, resistOf } from './status';

export type Fate = 'SAFE' | 'RISES' | 'FALLS';
export type FateCause = 'BURN' | 'THORNS';
export type StrikeAction = 'ATTACK' | SpellId;

export interface PreBlow { fate: Fate; cause: FateCause | null; burn: number; tick: number; plan: RollPlan }

const EXPECTED_U = 0.5;

export const expectedPlan = (hero: Hero, action: HeroAction): RollPlan => planAt(hitsOf(hero, action), EXPECTED_U);

const SEVERITY: Record<Fate, number> = { SAFE: 0, RISES: 1, FALLS: 2 };

function fateOf(before: Hero, r: Rehearsal): Fate {
  if (r.result.heroDead) {return 'FALLS';}
  return livesLeft(r.hero) < livesLeft(before) ? 'RISES' : 'SAFE';
}

function causeOf(c: Case, plan: RollPlan, fate: Fate): FateCause {
  const unburnt: Case = { ...c, hero: { ...c.hero, burn: null } };
  return SEVERITY[fateOf(c.hero, play(unburnt, plan))] >= SEVERITY[fate] ? 'THORNS' : 'BURN';
}

interface Worst { fate: Fate; tick: number; plan: RollPlan }

export function preBlowFate(hero: Hero, battle: BattleState, action: HeroAction): PreBlow {
  const c: Case = { hero, battle, action };
  let worst: Worst | null = null;
  for (const plan of worstRolls(c)) {
    const r = play(c, plan);
    const fate = fateOf(hero, r);
    if (!worst || SEVERITY[fate] > SEVERITY[worst.fate]) {worst = { fate, tick: r.result.burnTick, plan };}
  }
  const found = worst ?? { fate: 'SAFE', tick: 0, plan: planAt(0, 0) };
  const cause = found.fate === 'SAFE' ? null : causeOf(c, found.plan, found.fate);
  return { ...found, cause, burn: pendingTick(hero) };
}

export const expectedPreBlowLoss = (hero: Hero, battle: BattleState, action: HeroAction = 'GUARD'): number =>
  hero.hp - play({ hero, battle, action }, expectedPlan(hero, action)).hero.hp;

export function healPreview(hero: Hero, battle: BattleState, action: HeroAction): number {
  const ready: Hero = action === 'POTION' ? { ...hero, potions: Math.max(1, hero.potions) } : hero;
  return play({ hero: ready, battle, action }, planAt(0, 0)).result.healed;
}

export interface GuardFacts { take: FoeBlowEstimate; lethal: boolean; rises: boolean; mpGain: number; tires: boolean }

export function guardFacts(hero: Hero, battle: BattleState): GuardFacts {
  const take = expectedFoeDamage(hero, battle);
  const r = play({ hero, battle, action: 'GUARD' }, planAt(0, 0));
  const lethal = take.guarded >= r.hero.hp;
  return {
    take,
    lethal,
    rises: lethal && !r.result.heroDead && livesLeft(r.hero) > 0,
    mpGain: guardMpIfStruck(r.hero, r.battle),
    tires: guardTires(r.battle, battle.intent),
  };
}

export function strikeKind(hero: Hero, action: StrikeAction): DamageKind {
  return swingFor(hero, derive(hero), action).kind;
}

export interface StrikeFacts { kind: DamageKind; stat: 'ATK' | 'MAG'; mult: number; hits: number; elem: number; resist: number; damage: number }

export function strikeFacts(hero: Hero, battle: BattleState, action: StrikeAction): StrikeFacts {
  const swing = swingFor(hero, derive(hero), action);
  return {
    kind: swing.kind,
    stat: swing.stat,
    mult: swing.mults[0] ?? 1,
    hits: swing.mults.length,
    elem: elementMult(battle.enemy.def, heroElement(hero, action)),
    resist: resistOf(battle.enemy, swing.kind),
    damage: expectedHeroDamage(hero, battle, action),
  };
}

export const burstKind = (hero: Hero): DamageKind => burstBlow(hero, derive(hero)).kind;

type BreakVerdict = 'BREAKS' | 'SHORT' | 'NOT_WEAK';

export interface BreakFacts { verdict: BreakVerdict; need: number }

export function breakFacts(hero: Hero, battle: BattleState, action: HeroAction): BreakFacts | null {
  if (!woundUp(battle) || (action !== 'BURST' && !strikesFoe(action))) {return null;}
  const c: Case = { hero, battle, action };
  const r = play(c, expectedPlan(hero, action));
  const need = breakNeed(battle.enemy);
  if (!breakEligible({ ...c, result: r.result })) {return { verdict: 'NOT_WEAK', need };}
  return { verdict: r.result.broke || r.result.enemyDefeated ? 'BREAKS' : 'SHORT', need };
}
