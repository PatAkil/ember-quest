import type { BattleState, EnemyActResult, EnemyInstance, Hero, HeroAction, HeroActResult, Rng } from '../types';
import { createBattle, heroAct } from './combat';
import { elementMult } from './element';
import { enemyAct } from './enemy-turn';
import { battleActions, canAfford, derive } from './hero';
import type { Policy } from './model';
import { heroElement, punishes } from './power';
import type { BattleOutcome, VerbTally } from './run-tally';
import { startTurn } from './status';

const TURN_CAP = 80;

type Verdict = 'WON' | 'LOST' | null;

interface Fight {
  hero: Hero;
  battle: BattleState;
  policy: Policy;
  rng: Rng;
  verbs: VerbTally;
  dmgTaken: number;
  landed: number;
  thorns: boolean;
}

function chooseAction({ hero, battle, policy }: Fight): HeroAction {
  const actions = battleActions(hero).filter((a) => canAfford(hero, a));
  const wanted = policy.act(hero, derive(hero), battle, actions);
  return actions.includes(wanted) ? wanted : 'ATTACK';
}

const NO_HIT: readonly HeroAction[] = ['GUARD', 'POTION'];

const breakable = (hero: Hero, battle: BattleState, action: HeroAction): boolean =>
  action === 'BURST' || punishes(hero) || elementMult(battle.enemy.def, heroElement(hero, action)) > 1;

const breakAttempt = (hero: Hero, battle: BattleState, action: HeroAction): boolean =>
  battle.intent === 'HEAVY' && !NO_HIT.includes(action) && breakable(hero, battle, action);

const COUNTED: Partial<Record<HeroAction, 'guards' | 'bursts' | 'potions'>> = { GUARD: 'guards', BURST: 'bursts', POTION: 'potions' };

function tallyHero(f: Fight, action: HeroAction, result: HeroActResult, attempt: boolean): void {
  const counter = COUNTED[action];
  if (counter) {f.verbs[counter] += 1;}
  if (!attempt) {return;}
  const kind = f.battle.enemy.def.kind;
  f.verbs.breakTry[kind] += 1;
  if (result.broke) {f.verbs.breakHit[kind] += 1;}
}

function tallyReply(f: Fight, reply: EnemyActResult): void {
  if (reply.parried) {f.verbs.parries += 1;}
  if (reply.phaseChanged) {f.verbs.phase2 += 1;}
  if (reply.dodged || reply.dmg <= 0) {return;}
  f.dmgTaken += reply.dmg;
  f.landed += 1;
}

function round(f: Fight): Verdict {
  const action = chooseAction(f);
  const start = startTurn(f.hero, f.battle, action);
  if (start.heroDead) {
    if (start.heroBurn > 0) {f.verbs.burnDeaths += 1;}
    return 'LOST';
  }
  if (start.enemyDefeated) {return 'WON';}
  const attempt = breakAttempt(f.hero, f.battle, action);
  const result = heroAct(f.hero, f.battle, action, f.rng);
  tallyHero(f, action, result, attempt);
  if (result.heroDead) {
    f.thorns = true;
    return 'LOST';
  }
  if (result.enemyDefeated) {return 'WON';}
  const reply = enemyAct(f.hero, f.battle, f.rng);
  tallyReply(f, reply);
  if (reply.enemyDefeated) {return 'WON';}
  return reply.heroDead ? 'LOST' : null;
}

interface Contest { hero: Hero; enemy: EnemyInstance; policy: Policy; rng: Rng; verbs: VerbTally }

export function runBattle({ hero, enemy, policy, rng, verbs }: Contest): BattleOutcome {
  const startHp = enemy.hp;
  const f: Fight = { hero, battle: createBattle(enemy), policy, rng, verbs, dmgTaken: 0, landed: 0, thorns: false };
  const outcome = (won: boolean, turns: number, stalled = false): BattleOutcome =>
    ({ won, stalled, turns, dmgTaken: f.dmgTaken, landed: f.landed, dmgDealt: startHp - enemy.hp, thorns: f.thorns });
  for (let turn = 0; turn < TURN_CAP; turn += 1) {
    const verdict = round(f);
    if (verdict) {return outcome(verdict === 'WON', turn + 1);}
  }
  return outcome(false, TURN_CAP, true);
}
