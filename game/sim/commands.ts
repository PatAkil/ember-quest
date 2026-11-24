import {
  BREAK_AT,
  POTION_HEAL,
  type BattleState,
  type EnemyInstance,
  type Hero,
  type HeroAction,
  type HeroActResult,
} from '../types';
import { burstBlow, canBurst } from './burst';
import { findEffect } from './gear';
import { derive } from './hero';
import { cleanseBurn } from './status';

type Verb = 'GUARD' | 'BURST' | 'POTION';

const VERBS: readonly HeroAction[] = ['GUARD', 'BURST', 'POTION'] satisfies readonly Verb[];

export const isCommand = (action: HeroAction): action is Verb => VERBS.includes(action);

const QUIET: Omit<HeroActResult, 'text' | 'hits'> = {
  healed: 0, mpRestored: 0, enemyDefeated: false, crit: false,
  broke: false, weak: false, resisted: false, guarded: false, missed: false, burned: false,
  thorns: 0, thornsText: '', heroDead: false, revived: false, burnTick: 0, burnText: '',
};

export const heroResult = (text: string, over: Partial<HeroActResult> = {}): HeroActResult =>
  ({ ...QUIET, hits: [], text: text.slice(0, 52), ...over });

function guard(_hero: Hero, battle: BattleState): HeroActResult {
  battle.guarding = true;
  return heroResult('HERO RAISES HIS GUARD!', { guarded: true });
}

function potion(hero: Hero, battle: BattleState): HeroActResult {
  if (hero.potions <= 0) {return heroResult('NO POTIONS LEFT!');}
  const d = derive(hero);
  if (hero.hp >= d.maxHp) {return heroResult('YOUR HP IS ALREADY FULL!');}
  const healed = Math.min(Math.round(d.maxHp * POTION_HEAL), d.maxHp - hero.hp);
  hero.potions -= 1;
  hero.hp += healed;
  battle.actionsTaken += 1;
  return heroResult(`HERO DRINKS A POTION +${healed} HP!`, { healed });
}

function burst(hero: Hero, battle: BattleState): HeroActResult {
  if (!canBurst(hero)) {return heroResult('THE EMBER IS NOT READY!');}
  const enemy = battle.enemy;
  const blow = burstBlow(hero, derive(hero));
  enemy.hp = Math.max(0, enemy.hp - blow.dmg);
  hero.ember = 0;
  cleanseBurn(hero);
  return heroResult(`EMBER BURST HITS ${enemy.def.name} FOR ${blow.dmg}!`, {
    hits: [{ dmg: blow.dmg, crit: false, kind: blow.kind }],
    enemyDefeated: enemy.hp <= 0,
  });
}

const VERB_ACT: Record<Verb, (hero: Hero, battle: BattleState) => HeroActResult> = { GUARD: guard, POTION: potion, BURST: burst };

export const commandAct = (hero: Hero, battle: BattleState, action: Verb): HeroActResult => VERB_ACT[action](hero, battle);

interface Settle { hero: Hero; battle: BattleState; action: HeroAction; result: HeroActResult }

export const breakNeed = (enemy: EnemyInstance): number => Math.ceil(BREAK_AT[enemy.def.kind] * enemy.maxHp);

export const breakEligible = ({ hero, action, result }: Settle): boolean =>
  action === 'BURST' || result.weak || findEffect(hero, 'PUNISH_WINDUP') !== undefined;

function breaks(settle: Settle): boolean {
  const { battle, result } = settle;
  const enemy = battle.enemy;
  if (battle.intent !== 'HEAVY' || result.enemyDefeated || result.hits.length === 0) {return false;}
  if (!breakEligible(settle)) {return false;}
  const total = result.hits.reduce((n, h) => n + h.dmg, 0);
  return total >= breakNeed(enemy);
}

export function settleBreak(hero: Hero, battle: BattleState, action: HeroAction, result: HeroActResult): HeroActResult {
  if (!breaks({ hero, battle, action, result })) {return result;}
  battle.enemy.staggered = true;
  return { ...result, broke: true };
}
