import type { BattleState, EnemyActResult, Hero, HeroAction, HeroActResult, Rng, TurnCause, TurnResult } from '../types';
import { expectedHeroDamage, heroAct } from './combat';
import { enemyAct } from './enemy-turn';
import { pendingTick, startTurn } from './status';
import { canBurst } from './burst';
import { JITTER_MAX, JITTER_MIN, createSeededRng } from './util';

export type TurnStream = 'HERO' | 'FOE';

const STREAM_SALT: Record<TurnStream, number> = { HERO: 0, FOE: 1 };

function fmix(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function turnSeed(roomSeed: number, turn: number, stream: TurnStream): number {
  const room = fmix(roomSeed);
  const step = fmix(room ^ Math.imul(turn + 1, 0x9e3779b9));
  return fmix(step ^ Math.imul(STREAM_SALT[stream] + 1, 0x27d4eb2f));
}

export const turnRng = (roomSeed: number, turn: number, stream: TurnStream): Rng =>
  createSeededRng(turnSeed(roomSeed, turn, stream)).next;

function heroCause(r: HeroActResult): TurnCause | null {
  if (r.heroDead) {return r.burnTick > 0 ? 'BURN' : 'THORNS';}
  return r.enemyDefeated ? 'HIT' : null;
}

function foeCause(r: EnemyActResult): TurnCause | null {
  if (r.heroDead) {return 'BLOW';}
  if (!r.enemyDefeated) {return null;}
  return r.burnTick > 0 ? 'FOE_BURN' : 'RECOIL';
}

const outcomeOf = (cause: TurnCause | null): TurnResult['outcome'] => {
  if (cause === null) {return null;}
  return cause === 'BURN' || cause === 'THORNS' || cause === 'BLOW' ? 'LOST' : 'WON';
};

export function resolveTurn(hero: Hero, battle: BattleState, action: HeroAction, roomSeed: number): TurnResult {
  const turn = battle.turn;
  const start = startTurn(hero, action);
  const heroResult = heroAct(hero, battle, action, turnRng(roomSeed, turn, 'HERO'));
  battle.turn = turn + 1;
  const early = heroCause(heroResult);
  if (early) {return { turn, action, start, hero: heroResult, enemy: null, outcome: outcomeOf(early), cause: early };}
  const enemy = enemyAct(hero, battle, turnRng(roomSeed, turn, 'FOE'));
  const cause = foeCause(enemy);
  return { turn, action, start, hero: heroResult, enemy, outcome: outcomeOf(cause), cause };
}

const EVEN: Rng = () => 0.5;

const HIGH: Rng = () => 0.999;

interface Rehearsal { hero: Hero; foeHp: number }

function rehearse(hero: Hero, battle: BattleState, action: HeroAction, rng: Rng): Rehearsal {
  const shadow: Hero = { ...hero, burn: hero.burn ? { ...hero.burn } : null };
  const enemy = { ...battle.enemy };
  startTurn(shadow, action);
  heroAct(shadow, { ...battle, enemy }, action, rng);
  return { hero: shadow, foeHp: enemy.hp };
}

export function expectedPreBlowLoss(hero: Hero, battle: BattleState, action: HeroAction = 'GUARD'): number {
  return hero.hp - rehearse(hero, battle, action, EVEN).hero.hp;
}

const ROUNDING_SLACK = 2;

const swift = (battle: BattleState): boolean => battle.enemy.affixes.includes('SWIFT');

function surelyKills(hero: Hero, battle: BattleState, action: HeroAction): boolean {
  return !swift(battle) && Math.floor(expectedHeroDamage(hero, battle, action) * JITTER_MIN) - ROUNDING_SLACK >= battle.enemy.hp;
}

const spentALife = (before: Hero, after: Hero): boolean => before.revived !== after.revived || before.revivedTwice !== after.revivedTwice;

const escapesBurn = (hero: Hero, battle: BattleState, action: HeroAction): boolean =>
  (action === 'BURST' && canBurst(hero)) || surelyKills(hero, battle, action);

function healOutlastsBurn(hero: Hero, battle: BattleState, action: HeroAction): boolean {
  const best = rehearse(hero, battle, action, HIGH);
  if (best.hero.hp <= 0 || best.foeHp <= 0 || spentALife(hero, best.hero) || swift(battle)) {return false;}
  const afterTick = hero.hp - pendingTick(hero);
  const gained = best.hero.hp - afterTick;
  return afterTick + Math.floor((gained * JITTER_MIN) / JITTER_MAX) - ROUNDING_SLACK > 0;
}

export function burnWillKill(hero: Hero, battle: BattleState, action: HeroAction): boolean {
  if (hero.hp - pendingTick(hero) > 0) {return false;}
  return !escapesBurn(hero, battle, action) && !healOutlastsBurn(hero, battle, action);
}
