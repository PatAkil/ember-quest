import {
  SLOTS,
  STAT_KEYS,
  type Biome,
  type EnemyDef,
  type EnemyInstance,
  type Hero,
  type LootOffer,
  type LootSource,
  type Rng,
  type StatKey,
} from '../types';
import { BOSS_ENTRY_HEAL } from '../data';
import { createBattle, heroAct, spawnEnemy } from './combat';
import { enemyAct } from './enemy-turn';
import { canAfford, derive, fullHeal, grantClear, healFraction, heroActions, refillPotions, skipMend, spendPoint } from './hero';
import { applyOffer, noteDeclinedScrolls, resolveOverflow, resolveUpgrade, rollLoot } from './loot';
import type { MapNode } from './map';
import type { Policy } from './model';
import { upgradableTargets } from './pack';
import { startTurn } from './status';
import {
  bossPickKind,
  countPick,
  countUpgradeTarget,
  probeOf,
  type BattleOutcome,
  type Ending,
  type RunState,
} from './run-tally';
import { clamp, isNonEmpty, pick } from './util';

const TURN_CAP = 80;

function runBattle(hero: Hero, enemy: EnemyInstance, policy: Policy, rng: Rng): BattleOutcome {
  const battle = createBattle(enemy);
  const startHp = enemy.hp;
  let dmgTaken = 0;
  let landed = 0;
  const outcome = (won: boolean, turns: number): BattleOutcome =>
    ({ won, stalled: false, turns, dmgTaken, landed, dmgDealt: startHp - enemy.hp });
  for (let turn = 0; turn < TURN_CAP; turn += 1) {
    const start = startTurn(hero, battle);
    if (start.heroDead) {return outcome(false, turn);}
    if (start.enemyDefeated) {return outcome(true, turn);}
    const d = derive(hero);
    const actions = heroActions(hero).filter((a) => canAfford(hero, a));
    const wanted = policy.act(hero, d, battle, actions);
    const action = actions.includes(wanted) ? wanted : 'ATTACK';
    const result = heroAct(hero, battle, action, rng);
    if (result.enemyDefeated) {return outcome(true, turn + 1);}
    const reply = enemyAct(hero, battle, rng);
    if (!reply.dodged) {
      dmgTaken += reply.dmg;
      landed += 1;
    }
    if (reply.enemyDefeated) {return outcome(true, turn + 1);}
    if (reply.heroDead) {return outcome(false, turn + 1);}
  }
  return { ...outcome(false, TURN_CAP), stalled: true };
}

function spendAll(hero: Hero, policy: Policy): void {
  let guard = 0;
  while (hero.sp > 0 && guard < 200) {
    guard += 1;
    const d = derive(hero);
    const wanted = policy.allocate(hero, d);
    const stat: StatKey = STAT_KEYS.includes(wanted) ? wanted : 'HP';
    if (!spendPoint(hero, stat)) {break;}
  }
}

function prepareFor(run: RunState, foe: EnemyDef): void {
  const before = SLOTS.map((slot) => run.hero.equipment[slot]?.id);
  run.policy.prepare(run.hero, foe);
  run.tally.prepareSwaps += SLOTS.filter((slot, i) => run.hero.equipment[slot]?.id !== before[i]).length;
}

function resolveChoice(run: RunState, chosen: LootOffer): LootOffer {
  if (chosen.kind !== 'UPGRADE_ANY') {return chosen;}
  const targets = upgradableTargets(run.hero);
  const wanted = Math.floor(run.policy.upgradeTarget(run.hero, targets));
  const target = targets[clamp(wanted, 0, Math.max(0, targets.length - 1))];
  return (target && resolveUpgrade(run.hero, target)) ?? chosen;
}

function wantsStow(run: RunState, offer: LootOffer): boolean {
  if (offer.kind !== 'ITEM' || !run.hero.equipment[offer.item.slot]) {return false;}
  return run.policy.stowOrEquip(run.hero, offer.item) === 'STOW';
}

function takeOffer(run: RunState, chosen: LootOffer): void {
  const { hero, policy, rng, tally } = run;
  const offer = resolveChoice(run, chosen);
  countUpgradeTarget(tally, offer);
  const applied = applyOffer(hero, offer, rng, { stow: wantsStow(run, offer) });
  if (applied.stowed) {tally.itemsStowed += 1;}
  if (applied.overflow) {
    resolveOverflow(hero, applied.overflow, policy.dropWhich(hero, applied.overflow));
    tally.drops += 1;
  }
  countPick(tally, chosen);
}

function offerLoot(run: RunState, source: LootSource, act: number): void {
  const { hero, policy, rng, tally } = run;
  const offered = rollLoot(source, act, hero, rng);
  if (offered.length === 0) {return;}
  const picked = policy.pick(hero, offered, act);
  const chosen = picked && offered.includes(picked) ? picked : null;
  const scrollsOffered = offered.reduce((n, o) => n + (o.kind === 'SCROLL' ? 1 : 0), 0);
  if (source === 'BOSS') {tally.bossPicks.push(bossPickKind(chosen, act));}
  if (chosen) {takeOffer(run, chosen);}
  else {skipMend(hero);}
  noteDeclinedScrolls(hero, offered, chosen);
  tally.scrollsDeclined += scrollsOffered - (chosen?.kind === 'SCROLL' ? 1 : 0);
}

function foeFor(node: MapNode, biome: Biome, rng: Rng): string {
  if (node.enemyId) {return node.enemyId;}
  const ids = node.type === 'ELITE' ? biome.elites : biome.normals;
  return isNonEmpty(ids) ? pick(ids, rng) : pick(biome.normals, rng);
}

interface Room { act: number; biome: Biome; node: MapNode }

function fightRoom(run: RunState, { act, biome, node }: Room): Ending | null {
  const { hero, rng, tally } = run;
  const elite = node.type === 'ELITE';
  if (elite) {
    tally.elitesFought += 1;
    tally.hpAtElite.push(hero.hp / Math.max(1, derive(hero).maxHp));
  }
  const enemyId = foeFor(node, biome, rng);
  const enemy = spawnEnemy(enemyId, run.clears, act);
  prepareFor(run, enemy.def);
  const outcome = runBattle(hero, enemy, run.policy, rng);
  if (!outcome.won) {
    const deathKind = outcome.stalled ? 'STALL' : elite ? 'ELITE' : 'NORMAL';
    return { won: false, actReached: act, deathBy: outcome.stalled ? 'STALL' : enemyId, deathKind };
  }
  run.clears += 1;
  grantClear(hero, elite ? 'ELITE' : 'NORMAL');
  spendAll(hero, run.policy);
  offerLoot(run, elite ? 'ELITE' : 'FIGHT', act);
  return null;
}

export function playRoom(run: RunState, room: Room): Ending | null {
  const { type } = room.node;
  run.tally.rooms.push(type);
  if (type === 'REST') {
    fullHeal(run.hero);
    refillPotions(run.hero);
    return null;
  }
  if (type === 'LOOT') {
    run.tally.chestsOpened += 1;
    offerLoot(run, 'LOOT', room.act);
    return null;
  }
  return fightRoom(run, room);
}

export function bossRoom(run: RunState, act: number, biome: Biome): Ending | null {
  const { hero } = run;
  healFraction(hero, BOSS_ENTRY_HEAL);
  const boss = spawnEnemy(biome.boss, run.clears, act);
  prepareFor(run, boss.def);
  const entry = derive(hero);
  const outcome = runBattle(hero, boss, run.policy, run.rng);
  run.probes.push(probeOf(act, run.clears, entry, { boss, outcome }));
  if (!outcome.won) {
    return { won: false, actReached: act, deathBy: outcome.stalled ? 'STALL' : biome.boss, deathKind: outcome.stalled ? 'STALL' : 'BOSS' };
  }
  run.clears += 1;
  grantClear(hero, 'BOSS');
  spendAll(hero, run.policy);
  offerLoot(run, 'BOSS', act);
  return null;
}
