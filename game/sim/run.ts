import {
  STAT_KEYS,
  type Biome,
  type Derived,
  type EnemyInstance,
  type Hero,
  type LootOffer,
  type LootSource,
  type Rng,
  type StatKey,
} from '../types';
import { BIOMES, BOSS_ENTRY_HEAL } from '../data';
import { createBattle, enemyAct, heroAct, spawnEnemy, startTurn } from './combat';
import { equippedItems } from './gear';
import { canAfford, createHero, derive, fullHeal, grantClear, healFraction, heroActions, skipMend, spendPoint } from './hero';
import { applyOffer, noteDeclinedScrolls, rollLoot } from './loot';
import { buildMap, type MapNode } from './map';
import type { Policy, RoomType } from './model';
import { withPolicyContext } from './policies';
import { clamp, isNonEmpty, pick } from './util';

export interface RunResult {
  won: boolean;
  actReached: number;
  clears: number;
  deathBy: string;
  finalDerived: Derived;
  itemsHeld: string[];
  probes: Probe[];
  deathKind: '' | 'NORMAL' | 'ELITE' | 'BOSS' | 'STALL';
  upgradesTaken?: number;
  itemsTaken?: number;
  elitesFought?: number;
  chestsOpened?: number;
  hpAtElite?: number[];
  rooms?: RoomType[];
  scrollsTaken?: number;
  scrollsDeclined?: number;
  bossPicks?: BossPick[];
  scrollsMissedAtEnd?: number;
}

export type BossPick = 'SCROLL' | 'MISSED_SCROLL' | 'SIGNATURE' | 'ROLLED' | 'UPGRADE' | 'NONE';

export interface Probe {
  act: number;
  clears: number;
  won: boolean;
  maxHp: number; atk: number; mag: number; def: number; mdef: number; crit: number; dodge: number;
  bossHp: number; bossAtk: number;
  turns: number;
  hitFrac: number;
  dpt: number;
  ttk: number;
}

const ROOMS_PER_ACT = 6;
const TURN_CAP = 80;

interface BattleOutcome {
  won: boolean;
  stalled: boolean;
  turns: number;
  dmgTaken: number;
  landed: number;
  dmgDealt: number;
}

function runBattle(hero: Hero, enemy: EnemyInstance, policy: Policy, rng: Rng): BattleOutcome {
  const battle = createBattle(enemy);
  const startHp = enemy.hp;
  let dmgTaken = 0;
  let landed = 0;
  const outcome = (won: boolean, turns: number): BattleOutcome =>
    ({ won, stalled: false, turns, dmgTaken, landed, dmgDealt: startHp - enemy.hp });
  for (let turn = 0; turn < TURN_CAP; turn += 1) {
    startTurn(hero);
    if (hero.hp <= 0) {return outcome(false, turn);}
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

interface Tally {
  upgradesTaken: number;
  itemsTaken: number;
  elitesFought: number;
  chestsOpened: number;
  hpAtElite: number[];
  rooms: RoomType[];
  scrollsTaken: number;
  scrollsDeclined: number;
  bossPicks: BossPick[];
}

interface RunState {
  hero: Hero;
  policy: Policy;
  rng: Rng;
  clears: number;
  probes: Probe[];
  tally: Tally;
}

interface Ending {
  won: boolean;
  actReached: number;
  deathBy: string;
  deathKind: RunResult['deathKind'];
}

function bossPickKind(chosen: LootOffer | null, act: number): BossPick {
  if (!chosen) {return 'NONE';}
  if (chosen.kind === 'SCROLL') {
    const current = BIOMES[clamp(act, 0, BIOMES.length - 1)]?.scroll;
    return chosen.spell === current ? 'SCROLL' : 'MISSED_SCROLL';
  }
  if (chosen.kind === 'ITEM') {return chosen.item.bossOnly ? 'SIGNATURE' : 'ROLLED';}
  return 'UPGRADE';
}

function countPick(tally: Tally, chosen: LootOffer): void {
  if (chosen.kind === 'UPGRADE') {tally.upgradesTaken += 1;}
  else if (chosen.kind === 'SCROLL') {tally.scrollsTaken += 1;}
  else {tally.itemsTaken += 1;}
}

function offerLoot(run: RunState, source: LootSource, act: number): void {
  const { hero, policy, rng, tally } = run;
  const offered = rollLoot(source, act, hero, rng);
  if (offered.length === 0) {return;}
  const picked = policy.pick(hero, offered, act);
  const chosen = picked && offered.includes(picked) ? picked : null;
  const scrollsOffered = offered.reduce((n, o) => n + (o.kind === 'SCROLL' ? 1 : 0), 0);
  if (source === 'BOSS') {tally.bossPicks.push(bossPickKind(chosen, act));}
  if (chosen) {
    applyOffer(hero, chosen, rng);
    countPick(tally, chosen);
  } else {
    skipMend(hero);
  }
  noteDeclinedScrolls(hero, offered, chosen);
  tally.scrollsDeclined += scrollsOffered - (chosen?.kind === 'SCROLL' ? 1 : 0);
}

function fightRoom(run: RunState, act: number, biome: Biome, elite: boolean): Ending | null {
  const { hero, rng, tally } = run;
  if (elite) {
    tally.elitesFought += 1;
    tally.hpAtElite.push(hero.hp / Math.max(1, derive(hero).maxHp));
  }
  const ids = elite ? biome.elites : biome.normals;
  const enemyId = isNonEmpty(ids) ? pick(ids, rng) : pick(biome.normals, rng);
  const enemy = spawnEnemy(enemyId, run.clears, act);
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

function playRoom(run: RunState, act: number, biome: Biome, room: RoomType): Ending | null {
  run.tally.rooms.push(room);
  if (room === 'REST') {
    fullHeal(run.hero);
    return null;
  }
  if (room === 'LOOT') {
    run.tally.chestsOpened += 1;
    offerLoot(run, 'LOOT', act);
    return null;
  }
  return fightRoom(run, act, biome, room === 'ELITE');
}

function routeIndex(policy: Policy, offered: RoomType[]): number {
  return clamp(Math.floor(policy.route(offered)), 0, offered.length - 1);
}

function routeNext(node: MapNode, next: MapNode[], policy: Policy): MapNode | undefined {
  const links = node.links.length > 0 ? node.links : [0];
  const options = links.flatMap((j) => next[j] ?? []);
  return options[routeIndex(policy, options.map((n) => n.type))];
}

function playMap(run: RunState, act: number, biome: Biome): Ending | null {
  const stages = buildMap(run.rng);
  const entry = stages[0] ?? [];
  let node = entry[routeIndex(run.policy, entry.map((n) => n.type))];
  for (let r = 0; r < ROOMS_PER_ACT && node; r += 1) {
    const current: MapNode = node;
    const next = r + 1 < ROOMS_PER_ACT ? stages[r + 1] : undefined;
    node = next ? routeNext(current, next, run.policy) : undefined;
    const ending = playRoom(run, act, biome, current.type);
    if (ending) {return ending;}
  }
  return null;
}

function probeOf(act: number, clears: number, entry: Derived, fight: { boss: EnemyInstance; outcome: BattleOutcome }): Probe {
  const { boss, outcome } = fight;
  return {
    act,
    clears,
    won: outcome.won,
    maxHp: entry.maxHp, atk: entry.atk, mag: entry.mag,
    def: entry.def, mdef: entry.mdef, crit: entry.crit, dodge: entry.dodge,
    bossHp: boss.maxHp, bossAtk: boss.atk,
    turns: outcome.turns,
    hitFrac: outcome.landed > 0 ? outcome.dmgTaken / outcome.landed / Math.max(1, entry.maxHp) : 0,
    dpt: outcome.dmgDealt / Math.max(1, outcome.turns),
    ttk: boss.maxHp / Math.max(1, outcome.dmgDealt / Math.max(1, outcome.turns)),
  };
}

function bossRoom(run: RunState, act: number, biome: Biome): Ending | null {
  const { hero } = run;
  healFraction(hero, BOSS_ENTRY_HEAL);
  const boss = spawnEnemy(biome.boss, run.clears, act);
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

function finish(run: RunState, ending: Ending): RunResult {
  const { hero, tally } = run;
  return {
    won: ending.won,
    actReached: ending.actReached,
    clears: run.clears,
    deathBy: ending.deathBy,
    finalDerived: derive(hero),
    itemsHeld: equippedItems(hero).map((i) => i.id),
    probes: run.probes,
    deathKind: ending.deathKind,
    upgradesTaken: tally.upgradesTaken,
    itemsTaken: tally.itemsTaken,
    elitesFought: tally.elitesFought,
    chestsOpened: tally.chestsOpened,
    hpAtElite: tally.hpAtElite,
    rooms: tally.rooms,
    scrollsTaken: tally.scrollsTaken,
    scrollsDeclined: tally.scrollsDeclined,
    bossPicks: tally.bossPicks,
    scrollsMissedAtEnd: hero.missedScrolls.length,
  };
}

function playRun(run: RunState): RunResult {
  for (const [act, biome] of BIOMES.entries()) {
    const ending = playMap(run, act, biome) ?? bossRoom(run, act, biome);
    if (ending) {return finish(run, ending);}
  }
  return finish(run, { won: true, actReached: Math.max(0, BIOMES.length - 1), deathBy: '', deathKind: '' });
}

export function simulateRun(policy: Policy, rng: Rng): RunResult {
  const hero = createHero();
  const tally: Tally = {
    upgradesTaken: 0, itemsTaken: 0, elitesFought: 0, chestsOpened: 0, hpAtElite: [], rooms: [],
    scrollsTaken: 0, scrollsDeclined: 0, bossPicks: [],
  };
  return withPolicyContext(rng, hero, () => playRun({ hero, policy, rng, clears: 0, probes: [], tally }));
}
