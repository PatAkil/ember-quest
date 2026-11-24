import type { BattleState, EnemyActResult, Hero, HeroAction, HeroActResult, Rng, TurnCause, TurnResult } from '../types';
import { heroAct } from './combat';
import { enemyAct } from './enemy-turn';
import { startTurn } from './status';
import { createSeededRng } from './util';

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

export function expectedPreBlowLoss(hero: Hero, battle: BattleState, action: HeroAction = 'GUARD'): number {
  const shadow: Hero = { ...hero, burn: hero.burn ? { ...hero.burn } : null };
  startTurn(shadow, action);
  heroAct(shadow, { ...battle, enemy: { ...battle.enemy } }, action, EVEN);
  return hero.hp - shadow.hp;
}
