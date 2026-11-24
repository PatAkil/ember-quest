import type { EnemyActResult, EnemyInstance, MoveId, TurnStart } from '../types';
import { emptyDeath } from '../state';
import type { DeathCause, Game } from '../state';

const LOG_KEPT = 2;

const MOVE_WORD: Record<MoveId, string> = {
  STRIKE: 'STRIKE', WINDUP: 'WIND-UP', HEAVY: 'HEAVY BLOW', WARD: 'WARD', SCORCH: 'SCORCH', MEND: 'MEND',
};

export function resetDeath(g: Game): void { g.death = emptyDeath(); }

export function noteLog(g: Game, text: string): void {
  const lines = g.death.lastLines;
  if (!text || lines.at(-1) === text) {return;}
  lines.push(text);
  if (lines.length > LOG_KEPT) {lines.shift();}
}

function killerName(e: EnemyInstance): string {
  const [affix] = e.affixes;
  return affix === undefined || e.def.name.startsWith('THE ') ? e.def.name : `${affix} ${e.def.name}`;
}

function moveWord(e: EnemyInstance, move: MoveId): string {
  return move === 'STRIKE' && e.def.atkType !== 'PHYSICAL' ? 'HEX' : MOVE_WORD[move];
}

interface Fall { cause: DeathCause; move: string; damage: number }

function record(g: Game, e: EnemyInstance, fall: Fall): void {
  g.death = {
    ...fall,
    killerId: e.def.id,
    killerName: killerName(e),
    elite: e.def.kind === 'ELITE',
    lastLines: [...g.death.lastLines],
  };
}

export function recordBlow(g: Game, e: EnemyInstance, r: EnemyActResult): void {
  record(g, e, { cause: 'BLOW', move: moveWord(e, r.move), damage: r.dmg });
}

export function recordThorns(g: Game, e: EnemyInstance, thorns: number): void {
  record(g, e, { cause: 'THORNS', move: 'THORNS', damage: thorns });
}

export function recordTurnDeath(g: Game, e: EnemyInstance, turn: TurnStart): void {
  const burned = turn.heroBurn > 0;
  record(g, e, { cause: burned ? 'BURN' : 'BLOOD', move: burned ? 'BURN' : 'BLOOD PRICE', damage: burned ? turn.heroBurn : turn.bloodLoss });
}
