import {
  GUARD_CHAIN_FACTOR,
  GUARD_FACTOR,
  GUARD_MP_GAIN,
  HEAVY_MULT,
  MEND_FRACTION,
  SCORCH_MULT,
  WINDUP_MULT,
  type BattleState,
  type Derived,
  type EnemyActResult,
  type EnemyInstance,
  type Hero,
  type MoveId,
  type Rng,
} from '../types';
import { findEffect } from './gear';
import { gainEmber } from './burst';
import { derive } from './hero';
import { applyBurn, applyWard, heroFalls } from './status';
import { jitter } from './util';

function movesOf(enemy: EnemyInstance): MoveId[] {
  const phase2 = enemy.def.phase2;
  return enemy.phase === 2 && phase2 ? phase2.moves : enemy.def.moves;
}

export function nextIntent(enemy: EnemyInstance): MoveId {
  const move = movesOf(enemy)[enemy.cycleIndex] ?? 'STRIKE';
  return move === 'MEND' && enemy.mended ? 'STRIKE' : move;
}

function advanceCycle(battle: BattleState, phaseChanged: boolean): void {
  const enemy = battle.enemy;
  const length = Math.max(1, movesOf(enemy).length);
  enemy.cycleIndex = phaseChanged ? 0 : (enemy.cycleIndex + 1) % length;
  battle.intent = nextIntent(enemy);
}

function checkPhase(enemy: EnemyInstance): boolean {
  const phase2 = enemy.def.phase2;
  if (enemy.phase !== 1 || !phase2 || enemy.hp <= 0 || enemy.hp > phase2.at * enemy.maxHp) {return false;}
  enemy.phase = 2;
  enemy.atk = Math.max(1, Math.round(enemy.atk * phase2.atkMult));
  enemy.mended = false;
  return true;
}

const HIT_MULT: Partial<Record<MoveId, number>> = { STRIKE: 1, WINDUP: WINDUP_MULT, HEAVY: HEAVY_MULT, SCORCH: SCORCH_MULT };

const HIT_VERB: Partial<Record<MoveId, string>> = { WINDUP: 'WINDS UP AT', HEAVY: 'SMASHES', SCORCH: 'SCORCHES' };

const QUIET: Omit<EnemyActResult, 'move' | 'text'> = {
  dodged: false, dmg: 0, reflected: 0, revived: false, heroDead: false, enemyDefeated: false,
  guarded: false, parried: false, staggered: false, phaseChanged: false, burned: false, healed: 0, warded: false,
};

const quiet = (move: MoveId, text: string, over: Partial<EnemyActResult> = {}): EnemyActResult =>
  ({ ...QUIET, move, text: text.slice(0, 52), ...over });

interface Turn { hero: Hero; battle: BattleState; d: Derived; move: MoveId; rng: Rng }

const chainedGuard = (t: Turn): boolean => t.battle.guarding && t.battle.guardChain > 1 && t.move !== 'HEAVY';

function guardFactor(t: Turn): number {
  if (!t.battle.guarding) {return 1;}
  return chainedGuard(t) ? GUARD_CHAIN_FACTOR : GUARD_FACTOR;
}

function parry(t: Turn): boolean {
  if (!t.battle.guarding || t.move !== 'HEAVY') {return false;}
  t.battle.riposte = true;
  gainEmber(t.hero, 'PARRY');
  return true;
}

function reflectDamage(hero: Hero, dmg: number, physical: boolean): number {
  const reflect = findEffect(hero, 'REFLECT');
  if (!reflect || reflect.fraction <= 0 || !(physical || reflect.magicToo)) {return 0;}
  return Math.max(1, Math.round(dmg * reflect.fraction));
}

function guardedGain(t: Turn): void {
  if (chainedGuard(t)) {return;}
  gainEmber(t.hero, 'HIT_TAKEN');
  if (t.battle.guarding) {t.hero.mp = Math.min(t.d.maxMp, t.hero.mp + GUARD_MP_GAIN);}
}

function hitText(t: Turn, dmg: number): string {
  const enemy = t.battle.enemy;
  const verb = HIT_VERB[t.move] ?? (enemy.def.atkType === 'PHYSICAL' ? 'STRIKES' : 'HEXES');
  return `${enemy.def.name} ${verb} YOU FOR ${dmg}`;
}

function fellText(t: Turn, dmg: number, revived: boolean): string {
  if (revived) {return `${t.battle.enemy.def.name} FELLS YOU! YOUR GEAR BURNS - YOU RISE!`;}
  return `${hitText(t, dmg)} - YOU FALL!`;
}

function landHit(t: Turn): EnemyActResult {
  const { hero, battle, d, move, rng } = t;
  const enemy = battle.enemy;
  if (rng() * 100 < d.dodge) {
    return quiet(move, `YOU DODGE ${enemy.def.name}'S BLOW!`, { dodged: true, guarded: battle.guarding, parried: parry(t) });
  }
  const physical = enemy.def.atkType === 'PHYSICAL';
  const resist = physical ? d.def : d.mdef;
  const dmg = Math.max(1, Math.round(enemy.atk * jitter(rng) * (HIT_MULT[move] ?? 1) * (1 - resist / 100) * guardFactor(t)));
  hero.hp -= dmg;
  guardedGain(t);
  const parried = parry(t);
  const burned = move === 'SCORCH';
  if (burned) {applyBurn(hero, dmg);}
  const reflected = reflectDamage(hero, dmg, physical);
  if (reflected > 0) {enemy.hp = Math.max(0, enemy.hp - reflected);}
  const fall = heroFalls(hero, d);
  const text = fall === 'STANDING' ? `${hitText(t, dmg)}!` : fellText(t, dmg, fall === 'REVIVED');
  return quiet(move, text, {
    dmg, reflected, burned, parried, guarded: battle.guarding,
    revived: fall === 'REVIVED', heroDead: fall === 'DEAD', enemyDefeated: enemy.hp <= 0,
  });
}

function wardUp(t: Turn): EnemyActResult {
  applyWard(t.battle.enemy);
  return quiet(t.move, `${t.battle.enemy.def.name} RAISES A WARD!`, { warded: true });
}

function mendUp(t: Turn): EnemyActResult {
  const enemy = t.battle.enemy;
  const healed = Math.min(Math.round(enemy.maxHp * MEND_FRACTION), enemy.maxHp - enemy.hp);
  enemy.hp += healed;
  enemy.mended = true;
  return quiet(t.move, `${enemy.def.name} MENDS +${healed} HP!`, { healed });
}

const MOVE_ACT: Record<MoveId, (t: Turn) => EnemyActResult> = {
  STRIKE: landHit, WINDUP: landHit, HEAVY: landHit, SCORCH: landHit, WARD: wardUp, MEND: mendUp,
};

export function enemyAct(hero: Hero, battle: BattleState, rng: Rng): EnemyActResult {
  const enemy = battle.enemy;
  const phaseChanged = checkPhase(enemy);
  const move = battle.intent;
  const turn: Turn = { hero, battle, d: derive(hero), move, rng };
  const result = enemy.staggered
    ? quiet(move, `${enemy.def.name} IS STAGGERED!`, { staggered: true })
    : MOVE_ACT[move](turn);
  enemy.staggered = false;
  advanceCycle(battle, phaseChanged);
  return { ...result, phaseChanged };
}
