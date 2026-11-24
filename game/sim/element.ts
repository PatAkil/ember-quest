import { RESIST_MULT, WEAK_MULT, type EnemyDef, type Element } from '../types';

export function elementMult(enemy: EnemyDef, element: Element | undefined): number {
  if (element === undefined) {return 1;}
  if (enemy.weak === element) {return WEAK_MULT;}
  return enemy.resists === element ? RESIST_MULT : 1;
}
