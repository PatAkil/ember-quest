import { REST_MEND, type Hero } from '../types';
import { fullHeal, healFraction, refillPotions } from './hero';
import { upgradableTargets } from './pack';
import { pactMods } from './pacts';

export interface RestOutcome { hp: number; mp: number; upgrade: boolean; mended: number }

function restHeal(hero: Hero, fraction: number): void {
  if (fraction >= 1) {fullHeal(hero);}
  else {healFraction(hero, fraction);}
}

export function restHero(hero: Hero): RestOutcome {
  const mods = pactMods(hero);
  const before = { hp: hero.hp, mp: hero.mp };
  restHeal(hero, mods.restHealMult);
  refillPotions(hero);
  const ash = mods.restUpgrade > 0;
  const upgrade = ash && upgradableTargets(hero).length > 0;
  const mended = ash && !upgrade ? healFraction(hero, REST_MEND).hp : 0;
  return { hp: hero.hp - before.hp, mp: hero.mp - before.mp, upgrade, mended };
}
