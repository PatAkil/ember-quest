import {
  ENRAGE_AFTER,
  ENRAGE_STEP,
  GUARD_CHAIN_FACTOR,
  GUARD_FACTOR,
  GUARD_MP_GAIN,
  HEAVY_MULT,
  BOSS_MEND_FRACTION,
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
import { searingStrike, vampiricHeal } from './affixes';
import { findEffect } from './gear';
import { gainEmber } from './burst';
import { derive } from './hero';
import { counterBlow, guardMana } from './power';
import { applyWard, burnHero, foeBurnTick, heroFalls } from './status';
import { jitter } from './util';

function movesOf(enemy: EnemyInstance): MoveId[] {
  const phase2 = enemy.def.phase2;
  return enemy.phase === 2 && phase2 ? phase2.moves : enemy.def.moves;
}

const CARRIED_HEAVY = -1;

const canMend = (enemy: EnemyInstance): boolean => !enemy.mended && enemy.hp < enemy.maxHp;

export function nextIntent(enemy: EnemyInstance): MoveId {
  if (enemy.cycleIndex === CARRIED_HEAVY) {return 'HEAVY';}
  const move = movesOf(enemy)[enemy.cycleIndex] ?? 'STRIKE';
  return move === 'MEND' && !canMend(enemy) ? 'STRIKE' : move;
}

function nextIndex(enemy: EnemyInstance, shown: MoveId, phaseChanged: boolean): number {
  if (!phaseChanged) {return (enemy.cycleIndex + 1) % Math.max(1, movesOf(enemy).length);}
  return shown === 'WINDUP' && !enemy.staggered ? CARRIED_HEAVY : 0;
}

function advanceCycle(battle: BattleState, shown: MoveId, phaseChanged: boolean): void {
  const enemy = battle.enemy;
  enemy.cycleIndex = nextIndex(enemy, shown, phaseChanged);
  battle.intent = nextIntent(enemy);
}

function checkPhase(enemy: EnemyInstance): boolean {
  const phase2 = enemy.def.phase2;
  if (enemy.phase !== 1 || !phase2 || enemy.hp <= 0 || enemy.hp > (enemy.phaseAt ?? phase2.at) * enemy.maxHp) {return false;}
  enemy.phase = 2;
  enemy.atk = Math.max(1, Math.round(enemy.atk * phase2.atkMult));
  enemy.mended = false;
  return true;
}

const HIT_MULT: Partial<Record<MoveId, number>> = { STRIKE: 1, WINDUP: WINDUP_MULT, HEAVY: HEAVY_MULT, SCORCH: SCORCH_MULT };

export const moveMult = (move: MoveId): number => HIT_MULT[move] ?? 0;

const HIT_VERB: Partial<Record<MoveId, string>> = { WINDUP: 'WINDS UP AT', HEAVY: 'SMASHES', SCORCH: 'SCORCHES' };

const QUIET: Omit<EnemyActResult, 'move' | 'text'> = {
  dodged: false, dmg: 0, reflected: 0, revived: false, heroDead: false, enemyDefeated: false,
  guarded: false, parried: false, staggered: false, phaseChanged: false, burned: false, healed: 0, warded: false, countered: 0,
  enraged: false, burnTick: 0, burnText: '', aside: '',
};

const LOG_MAX = 52;

export const ENRAGE_LINE = 'IT GROWS IMPATIENT - ITS BLOWS HIT HARDER';

const quiet = (move: MoveId, text: string, over: Partial<EnemyActResult> = {}): EnemyActResult =>
  ({ ...QUIET, move, text: text.slice(0, LOG_MAX), ...over });

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

function thorns(hero: Hero, dmg: number, physical: boolean): number {
  const reflect = findEffect(hero, 'REFLECT');
  if (!reflect || reflect.fraction <= 0 || !(physical || reflect.magicToo)) {return 0;}
  return Math.max(1, Math.round(dmg * reflect.fraction));
}

function reflectDamage(t: Turn, dmg: number, physical: boolean): number {
  const aegis = t.battle.guarding && t.battle.aegis > 0 ? Math.max(1, Math.round(dmg * t.battle.aegis)) : 0;
  return thorns(t.hero, dmg, physical) + aegis;
}

interface Aftermath { burned: boolean; reflected: number; countered: number; healed: number }

const ignites = (t: Turn): boolean => t.move === 'SCORCH' || (t.move === 'STRIKE' && searingStrike(t.battle.enemy));

function drink(enemy: EnemyInstance, dmg: number): number {
  if (enemy.hp <= 0) {return 0;}
  const healed = Math.min(vampiricHeal(enemy, dmg), Math.max(0, enemy.maxHp - enemy.hp));
  enemy.hp += healed;
  return healed;
}

function aftermath(t: Turn, dmg: number, physical: boolean): Aftermath {
  const enemy = t.battle.enemy;
  const burned = ignites(t) && burnHero(t.hero, dmg);
  const reflected = reflectDamage(t, dmg, physical);
  const countered = t.battle.guarding ? counterBlow(t.hero, t.d, enemy) : 0;
  enemy.hp = Math.max(0, enemy.hp - reflected - countered);
  return { burned, reflected, countered, healed: drink(enemy, dmg) };
}

function guardedGain(t: Turn): void {
  if (chainedGuard(t)) {return;}
  gainEmber(t.hero, 'HIT_TAKEN');
  if (t.battle.guarding) {t.hero.mp = Math.min(t.d.maxMp, t.hero.mp + GUARD_MP_GAIN + guardMana(t.hero));}
}

function hitText(t: Turn, dmg: number): string {
  const enemy = t.battle.enemy;
  const verb = HIT_VERB[t.move] ?? (enemy.def.atkType === 'PHYSICAL' ? 'STRIKES' : 'HEXES');
  return `${enemy.def.name} ${verb} YOU FOR ${dmg}`;
}

const withTail = (line: string, tail: string): string => (line.length + tail.length <= LOG_MAX ? line + tail : line);

function landedText(t: Turn, dmg: number, burned: boolean): string {
  const name = t.battle.enemy.def.name;
  const n = String(dmg);
  const line = !t.battle.guarding ? `${hitText(t, dmg)}!`
    : t.move === 'HEAVY' ? `PARRIED! THE BLOW ONLY GRAZES YOU FOR ${n}`
      : chainedGuard(t) ? `A TIRED GUARD - ${name} STILL HITS FOR ${n}`
        : `YOU BLOCK HALF - ${name} STILL HITS FOR ${n}`;
  return burned ? withTail(line, ' - YOU BURN!') : line;
}

function dodgedText(t: Turn, parried: boolean): string {
  return parried ? 'DODGED AND PARRIED! YOUR NEXT STRIKE HITS HARDER' : `YOU DODGE ${t.battle.enemy.def.name}'S BLOW!`;
}

function fellText(t: Turn, dmg: number, revived: boolean): string {
  if (revived) {return `${t.battle.enemy.def.name} FELLS YOU! YOUR GEAR BURNS - YOU RISE!`;}
  return `${hitText(t, dmg)} - YOU FALL!`;
}

function landHit(t: Turn): EnemyActResult {
  const { hero, battle, d, move, rng } = t;
  const enemy = battle.enemy;
  if (rng() * 100 < d.dodge) {
    const parried = parry(t);
    return quiet(move, dodgedText(t, parried), { dodged: true, guarded: battle.guarding, parried });
  }
  const physical = enemy.def.atkType === 'PHYSICAL';
  const resist = physical ? d.def : d.mdef;
  const dmg = Math.max(1, Math.round(enemy.atk * jitter(rng) * (HIT_MULT[move] ?? 1) * (1 - resist / 100) * guardFactor(t)));
  hero.hp -= dmg;
  guardedGain(t);
  const parried = parry(t);
  const after = aftermath(t, dmg, physical);
  const fall = heroFalls(hero, d);
  const text = fall === 'STANDING' ? landedText(t, dmg, after.burned) : fellText(t, dmg, fall === 'REVIVED');
  return quiet(move, text, {
    ...after, dmg, parried, guarded: battle.guarding,
    revived: fall === 'REVIVED', heroDead: fall === 'DEAD', enemyDefeated: enemy.hp <= 0,
  });
}

function wardUp(t: Turn): EnemyActResult {
  applyWard(t.battle.enemy);
  return quiet(t.move, `${t.battle.enemy.def.name} RAISES A WARD - YOUR HITS SOFTEN`, { warded: true });
}

function mendUp(t: Turn): EnemyActResult {
  const enemy = t.battle.enemy;
  if (!canMend(enemy)) {return landHit({ ...t, move: 'STRIKE' });}
  const fraction = enemy.def.kind === 'BOSS' ? BOSS_MEND_FRACTION : MEND_FRACTION;
  const healed = Math.min(Math.round(enemy.maxHp * fraction), enemy.maxHp - enemy.hp);
  enemy.hp += healed;
  enemy.mended = true;
  return quiet(t.move, `${enemy.def.name} MENDS +${healed} HP!`, { healed });
}

const MOVE_ACT: Record<MoveId, (t: Turn) => EnemyActResult> = {
  STRIKE: landHit, WINDUP: landHit, HEAVY: landHit, SCORCH: landHit, WARD: wardUp, MEND: mendUp,
};

function enrages(battle: BattleState): boolean {
  const enemy = battle.enemy;
  const hurt = enemy.hp < battle.foeMark;
  battle.calm = hurt ? 0 : battle.calm + 1;
  if (battle.calm <= ENRAGE_AFTER) {return false;}
  enemy.atk = Math.max(enemy.atk + 1, Math.round(enemy.atk * (1 + ENRAGE_STEP)));
  return true;
}

function markFoe(battle: BattleState, hpBefore: number): void {
  const enemy = battle.enemy;
  if (enemy.hp < hpBefore) {battle.calm = 0;}
  battle.foeMark = enemy.hp;
}

function burnAfter(enemy: EnemyInstance, result: EnemyActResult): EnemyActResult {
  if (result.heroDead || result.enemyDefeated) {return result;}
  const burnTick = foeBurnTick(enemy);
  if (burnTick <= 0) {return result;}
  const dead = enemy.hp <= 0;
  const burnText = dead ? `${enemy.def.name} BURNS FOR ${String(burnTick)} AND FALLS!` : `${enemy.def.name} BURNS FOR ${String(burnTick)}`;
  return { ...result, burnTick, burnText, enemyDefeated: dead };
}

export function enemyAct(hero: Hero, battle: BattleState, rng: Rng): EnemyActResult {
  const enemy = battle.enemy;
  const phaseChanged = checkPhase(enemy);
  const enraged = enrages(battle);
  const hpBefore = enemy.hp;
  const move = battle.intent;
  const turn: Turn = { hero, battle, d: derive(hero), move, rng };
  const acted = enemy.staggered
    ? quiet(move, `${enemy.def.name} IS STAGGERED AND LOSES ITS TURN`, { staggered: true })
    : MOVE_ACT[move](turn);
  advanceCycle(battle, move, phaseChanged);
  enemy.staggered = false;
  const result = burnAfter(enemy, acted);
  markFoe(battle, hpBefore);
  return { ...result, phaseChanged, enraged, aside: enraged ? ENRAGE_LINE : '' };
}
