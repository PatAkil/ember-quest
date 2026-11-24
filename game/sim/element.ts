import { RESIST_MULT, WEAK_MULT, type EnemyDef, type Element, type HeroAction } from '../types';
import { SPELLS } from '../data';
import { isSpell } from './hero';

export function elementMult(enemy: EnemyDef, element: Element | undefined): number {
  if (element === undefined) {return 1;}
  if (enemy.weak === element) {return WEAK_MULT;}
  return enemy.resists === element ? RESIST_MULT : 1;
}

export function actionElement(action: HeroAction): Element | undefined {
  return isSpell(action) ? SPELLS[action].element : undefined;
}
