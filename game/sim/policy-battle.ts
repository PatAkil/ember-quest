import { BREAK_AT, type BattleState, type Derived, type Hero, type HeroAction } from '../types';
import { SPELLS } from '../data';
import { burstBlow } from './burst';
import { swingFor } from './combat';
import { isCommand } from './commands';
import { elementMult } from './element';
import { moveMult } from './enemy-turn';
import { isGuardAction, isSpell, spellCost } from './hero';
import { gearPower, heroElement, punishes, riposteMult } from './power';
import type { Policy } from './model';
import { pactDamage } from './pacts';
import { pendingTick, resistOf } from './status';

interface BattleStyle {
  mendBelow: number;
  verbs: boolean;
}

const POTION_BELOW = 0.35;
const GUARD_HIT_SHARE = 0.2;
const BURST_RESIST = 25;
const SURE_SHARE = 0.9;

interface Fight { hero: Hero; d: Derived; battle: BattleState; affordable: HeroAction[]; style: BattleStyle }

const isMend = (a: HeroAction): boolean => isSpell(a) && SPELLS[a].heal !== undefined;
const actionCost = (hero: Hero, a: HeroAction): number => (isSpell(a) ? spellCost(hero, a) : 0);
const bossOrElite = (f: Fight): boolean => f.battle.enemy.def.kind !== 'NORMAL';

function swingDamage(f: Fight, action: HeroAction, sure: boolean): number {
  const { hero, d, battle } = f;
  if (action === 'BURST') {return burstBlow(hero, d).dmg;}
  if (isCommand(action) || isMend(action) || isGuardAction(action)) {return 0;}
  const swing = swingFor(hero, d, action);
  const crit = sure ? SURE_SHARE : 1 + (d.crit / 100) * (d.critMult - 1);
  const elem = heroElement(hero, action);
  const element = f.style.verbs ? elementMult(battle.enemy.def, elem) : 1;
  const riposte = battle.riposte ? riposteMult(hero) : 1;
  const resist = 1 - resistOf(battle.enemy, swing.kind) / 100;
  const power = gearPower({ hero, battle, d, element: elem }) * pactDamage(hero, action === 'ATTACK');
  return swing.mults.reduce((sum, m) => sum + swing.base * m, 0) * crit * element * riposte * resist * power;
}

const sureDamage = (f: Fight, a: HeroAction): number => swingDamage(f, a, true);

function cheapest(f: Fight, candidates: HeroAction[]): HeroAction | undefined {
  return [...candidates].sort((a, b) => actionCost(f.hero, a) - actionCost(f.hero, b))[0];
}

function killer(f: Fight): HeroAction | undefined {
  const usable = f.affordable.filter((a) => a !== 'BURST' || bossOrElite(f));
  const kills = usable.filter((a) => sureDamage(f, a) >= f.battle.enemy.hp);
  return cheapest(f, kills.filter((a) => a !== 'BURST')) ?? cheapest(f, kills);
}

function breaker(f: Fight): HeroAction | undefined {
  const enemy = f.battle.enemy;
  const floor = BREAK_AT[enemy.def.kind] * enemy.maxHp;
  const punisher = punishes(f.hero);
  const qualifies = (a: HeroAction): boolean =>
    a === 'BURST' ? bossOrElite(f) : punisher || elementMult(enemy.def, heroElement(f.hero, a)) > 1;
  const breaks = f.affordable.filter((a) => qualifies(a) && sureDamage(f, a) >= floor);
  return cheapest(f, breaks.filter((a) => a !== 'BURST')) ?? cheapest(f, breaks);
}

function heavyHit(f: Fight): number {
  const enemy = f.battle.enemy;
  const resist = enemy.def.atkType === 'PHYSICAL' ? f.d.def : f.d.mdef;
  return enemy.atk * moveMult('HEAVY') * (1 - resist / 100);
}

function guardChoice(f: Fight): HeroAction {
  return f.affordable.find((a) => a !== 'GUARD' && isGuardAction(a)) ?? 'GUARD';
}

function answerHeavy(f: Fight): HeroAction | undefined {
  if (!f.style.verbs || f.battle.intent !== 'HEAVY') {return undefined;}
  const broken = breaker(f);
  if (broken) {return broken;}
  return heavyHit(f) >= GUARD_HIT_SHARE * standing(f) ? guardChoice(f) : undefined;
}

const standing = (f: Fight): number => f.hero.hp - pendingTick(f.hero);

const hpShare = (f: Fight): number => standing(f) / Math.max(1, f.d.maxHp);

function douse(f: Fight): HeroAction | undefined {
  if (standing(f) > 0) {return undefined;}
  if (f.affordable.includes('BURST')) {return 'BURST';}
  if (f.affordable.includes('POTION')) {return 'POTION';}
  return f.affordable.find(isMend);
}

function heal(f: Fight): HeroAction | undefined {
  if (hpShare(f) < POTION_BELOW && f.affordable.includes('POTION')) {return 'POTION';}
  const mend = f.affordable.find(isMend);
  return mend && hpShare(f) < f.style.mendBelow ? mend : undefined;
}

function burstNow(f: Fight, best: HeroAction): boolean {
  if (!f.affordable.includes('BURST')) {return false;}
  if (!f.style.verbs) {return true;}
  if (!bossOrElite(f)) {return false;}
  const enemy = f.battle.enemy;
  const kind = isSpell(best) ? SPELLS[best].kind : f.hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL';
  return enemy.wardTurns > 0 || resistOf(enemy, kind) >= BURST_RESIST || sureDamage(f, 'BURST') >= enemy.hp;
}

function mendReserve(f: Fight): number {
  const mend = f.affordable.find(isMend);
  return mend && hpShare(f) < 0.6 ? actionCost(f.hero, mend) : 0;
}

function hardestHit(f: Fight): HeroAction {
  const { hero, battle } = f;
  const reserve = mendReserve(f);
  let best: HeroAction = 'ATTACK';
  let bestDmg = swingDamage(f, 'ATTACK', false);
  for (const a of f.affordable.filter(isSpell)) {
    const dmg = swingDamage(f, a, false);
    const cost = spellCost(hero, a);
    const keepsReserve = hero.mp - cost >= reserve || dmg >= battle.enemy.hp;
    const better = dmg > bestDmg + 1e-9 || (dmg > bestDmg - 1e-9 && cost < actionCost(hero, best));
    if (dmg > 0 && keepsReserve && better) {
      bestDmg = dmg;
      best = a;
    }
  }
  return best;
}

function decide(f: Fight): HeroAction {
  const kill = killer(f);
  if (kill) {return kill;}
  const answer = douse(f) ?? answerHeavy(f) ?? heal(f);
  if (answer) {return answer;}
  const best = hardestHit(f);
  return burstNow(f, best) ? 'BURST' : best;
}

export const battleAct = (style: BattleStyle): Policy['act'] => (hero, d, battle, actions) =>
  decide({ hero, d, battle, affordable: actions, style });
