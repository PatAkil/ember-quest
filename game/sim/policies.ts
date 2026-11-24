import {
  CAP_CRIT,
  CAP_DEF,
  CAP_MDEF,
  STAT_KEYS,
  type BattleState,
  type Derived,
  type Hero,
  type HeroAction,
  type Rng,
  type StatKey,
} from '../types';
import { SPELLS } from '../data';
import { swingFor } from './combat';
import { canAfford, derive, spellCost } from './hero';
import type { Policy, RoomType } from './model';
import { swapIn } from './pack';
import { choicesFor, type PolicyChoices } from './policy-choices';
import { bestPick, P_BALANCED, P_DEFENCE, P_OFFENCE, type ItemBonus } from './scoring';
import { pickOr } from './util';

const context: { rng: Rng; hero: Hero | null } = { rng: () => 0.5, hero: null };

export function withPolicyContext<T>(rng: Rng, hero: Hero, body: () => T): T {
  const previous = { ...context };
  context.rng = rng;
  context.hero = hero;
  try {
    return body();
  } finally {
    context.rng = previous.rng;
    context.hero = previous.hero;
  }
}

function expectedDamage(hero: Hero, d: Derived, battle: BattleState, action: HeroAction): number {
  if (action !== 'ATTACK' && SPELLS[action].heal !== undefined) {return 0;}
  const swing = swingFor(hero, d, action);
  const resist = swing.kind === 'PHYSICAL' ? battle.enemy.def.def : battle.enemy.def.mdef;
  const critFactor = 1 + (d.crit / 100) * (d.critMult - 1);
  let sum = 0;
  for (const m of swing.mults) {sum += swing.base * m;}
  return Math.max(0, sum * critFactor * (1 - resist / 100));
}

const isMend = (a: HeroAction) => a !== 'ATTACK' && SPELLS[a].heal !== undefined;

const actionCost = (hero: Hero, a: HeroAction) => (a === 'ATTACK' ? 0 : spellCost(hero, a));

interface Fight { hero: Hero; d: Derived; battle: BattleState }

function hardestHit({ hero, d, battle }: Fight, affordable: HeroAction[], reserve: number): HeroAction {
  let best: HeroAction = 'ATTACK';
  let bestDmg = expectedDamage(hero, d, battle, 'ATTACK');
  let bestCost = 0;
  for (const a of affordable) {
    if (a === 'ATTACK') {continue;}
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

const damageAct = (mendBelow: number): Policy['act'] => (hero, d, battle, actions) => {
  const affordable = actions.filter((a) => canAfford(hero, a));
  const mend = affordable.find(isMend);
  const hpFrac = hero.hp / Math.max(1, d.maxHp);
  if (mend && hpFrac < mendBelow) {return mend;}
  const mendId = actions.find(isMend);
  const reserve = mendId && hpFrac < 0.6 ? actionCost(hero, mendId) : 0;
  return hardestHit({ hero, d, battle }, affordable, reserve);
};

function atCap(d: Derived, stat: StatKey): boolean {
  if (stat === 'DEF') {return d.def >= CAP_DEF;}
  if (stat === 'MDEF') {return d.mdef >= CAP_MDEF;}
  if (stat === 'CRIT') {return d.crit >= CAP_CRIT;}
  return false;
}

function cycleAllocate(hero: Hero, d: Derived, cycle: StatKey[], fallback: StatKey): StatKey {
  let spent = 0;
  for (const k of STAT_KEYS) {spent += hero.alloc[k];}
  for (let i = 0; i < cycle.length; i += 1) {
    const stat = cycle[(spent + i) % cycle.length];
    if (stat && !atCap(d, stat)) {return stat;}
  }
  return atCap(d, fallback) ? 'HP' : fallback;
}

const primaryStat = (d: Derived): StatKey => (d.atk >= d.mag ? 'ATK' : 'MAG');

function routePreferring(offered: RoomType[], order: RoomType[]): number {
  for (const want of order) {
    const i = offered.indexOf(want);
    if (i >= 0) {return i;}
  }
  return 0;
}

function heroHpFraction(): number {
  if (!context.hero) {return 1;}
  const d = derive(context.hero);
  return context.hero.hp / Math.max(1, d.maxHp);
}

function routeWithRest(offered: RoomType[], restBelow: number, order: RoomType[]): number {
  if (heroHpFraction() < restBelow) {
    const rest = offered.indexOf('REST');
    if (rest >= 0) {return rest;}
  }
  return routePreferring(offered, order);
}

function chestHungryRoute(types: RoomType[]): number {
  const hp = heroHpFraction();
  if (hp < 0.5) {
    const rest = types.indexOf('REST');
    if (rest >= 0) {return rest;}
  }
  const loot = types.indexOf('LOOT');
  if (loot >= 0) {return loot;}
  const fight = types.indexOf('FIGHT');
  if (fight >= 0) {return fight;}
  const elite = types.indexOf('ELITE');
  if (elite >= 0 && hp > 0.7) {return elite;}
  return routePreferring(types, ['REST', 'ELITE']);
}

const BALANCED_ALLOCATE = (hero: Hero, d: Derived): StatKey =>
  cycleAllocate(hero, d, [primaryStat(d), 'HP', 'DEF', 'MDEF'], 'HP');

const randomIndex = (length: number): number => Math.floor(context.rng() * Math.max(1, length));

const RANDOM_CHOICES: PolicyChoices = {
  stowOrEquip: () => (context.rng() < 0.5 ? 'STOW' : 'EQUIP'),
  dropWhich: (hero) => randomIndex(hero.pack.length + 1),
  upgradeTarget: (_hero, targets) => randomIndex(targets.length),
  prepare: (hero) => {
    if (hero.pack.length > 0 && context.rng() < 0.5) {swapIn(hero, randomIndex(hero.pack.length));}
  },
};

const GLASS_BONUS: ItemBonus = (i) => (i.slot === 'WEAPON' && i.weaponKind === 'MAGIC' ? 8 : 0);
const TANK_BONUS: ItemBonus = (i) => (i.slot === 'WEAPON' && i.weaponKind !== 'MAGIC' ? 6 : 0);
const BALANCED_CHOICES = choicesFor(P_BALANCED);

const randomPolicy: Policy = {
  ...RANDOM_CHOICES,
  allocate: () => pickOr(STAT_KEYS, context.rng, 'HP'),
  pick: (_hero, offered) =>
    offered.length === 0 || context.rng() < 0.2 ? null : pickOr(offered, context.rng, null),
  act: (hero, _d, _battle, actions) =>
    pickOr(actions.filter((a) => canAfford(hero, a)), context.rng, 'ATTACK'),
  route: (types) => Math.floor(context.rng() * types.length),
};

export type PolicyName =
  | 'random' | 'balanced' | 'glass' | 'tank' | 'eliteHungry' | 'chestHungry';

export const POLICIES: Record<PolicyName, Policy> = {
  random: randomPolicy,
  balanced: {
    ...BALANCED_CHOICES,
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: damageAct(0.35),
    route: (types) => routeWithRest(types, 0.5, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },
  glass: {
    ...choicesFor(P_OFFENCE, GLASS_BONUS),
    allocate: (hero, d) => cycleAllocate(hero, d, [primaryStat(d), 'CRIT', primaryStat(d), 'HP'], primaryStat(d)),
    pick: (hero, offered) => bestPick(hero, offered, P_OFFENCE, GLASS_BONUS),
    act: damageAct(0.35),
    route: (types) => routeWithRest(types, 0.45, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },
  tank: {
    ...choicesFor(P_DEFENCE, TANK_BONUS),
    allocate: (hero, d) => cycleAllocate(hero, d, ['HP', 'DEF', 'ATK', 'MDEF'], 'HP'),
    pick: (hero, offered) => bestPick(hero, offered, P_DEFENCE, TANK_BONUS),
    act: damageAct(0.5),
    route: (types) => routeWithRest(types, 0.55, ['ELITE', 'LOOT', 'FIGHT', 'REST']),
  },
  eliteHungry: {
    ...BALANCED_CHOICES,
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: damageAct(0.35),
    route: (types) => {
      const elite = types.indexOf('ELITE');
      if (elite >= 0) {return elite;}
      return routeWithRest(types, 0.5, ['LOOT', 'FIGHT', 'REST']);
    },
  },
  chestHungry: {
    ...BALANCED_CHOICES,
    allocate: BALANCED_ALLOCATE,
    pick: (hero, offered) => bestPick(hero, offered, P_BALANCED),
    act: damageAct(0.35),
    route: chestHungryRoute,
  },
};
