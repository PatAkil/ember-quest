import type { BattleState, Derived, Hero, HeroAction } from '../types';
import { SPELLS } from '../data';
import { swingFor } from './combat';
import { isCommand } from './commands';
import { actionElement, elementMult } from './element';
import { canAfford, isSpell, spellCost } from './hero';
import type { Policy } from './model';
import { resistOf } from './status';

function expectedDamage(hero: Hero, d: Derived, battle: BattleState, action: HeroAction): number {
  if (isCommand(action)) {return 0;}
  if (isSpell(action) && SPELLS[action].heal !== undefined) {return 0;}
  const swing = swingFor(hero, d, action);
  const resist = resistOf(battle.enemy, swing.kind);
  const critFactor = 1 + (d.crit / 100) * (d.critMult - 1);
  let sum = 0;
  for (const m of swing.mults) {sum += swing.base * m;}
  return Math.max(0, sum * critFactor * (1 - resist / 100) * elementMult(battle.enemy.def, actionElement(action)));
}

const isMend = (a: HeroAction) => isSpell(a) && SPELLS[a].heal !== undefined;

const actionCost = (hero: Hero, a: HeroAction) => (isSpell(a) ? spellCost(hero, a) : 0);

interface Fight { hero: Hero; d: Derived; battle: BattleState }

function hardestHit({ hero, d, battle }: Fight, affordable: HeroAction[], reserve: number): HeroAction {
  let best: HeroAction = 'ATTACK';
  let bestDmg = expectedDamage(hero, d, battle, 'ATTACK');
  let bestCost = 0;
  for (const a of affordable) {
    if (!isSpell(a)) {continue;}
    const dmg = expectedDamage(hero, d, battle, a);
    if (dmg <= 0) {continue;}
    const cost = spellCost(hero, a);
    if (hero.mp - cost < reserve && dmg < battle.enemy.hp) {continue;}
    if (dmg > bestDmg + 1e-9 || (dmg > bestDmg - 1e-9 && cost < bestCost)) {
      bestDmg = dmg;
      best = a;
      bestCost = cost;
    }
  }
  return best;
}

export const damageAct = (mendBelow: number): Policy['act'] => (hero, d, battle, actions) => {
  const affordable = actions.filter((a) => canAfford(hero, a));
  const mend = affordable.find(isMend);
  const hpFrac = hero.hp / Math.max(1, d.maxHp);
  if (mend && hpFrac < mendBelow) {return mend;}
  const mendId = actions.find(isMend);
  const reserve = mendId && hpFrac < 0.6 ? actionCost(hero, mendId) : 0;
  return hardestHit({ hero, d, battle }, affordable, reserve);
};
