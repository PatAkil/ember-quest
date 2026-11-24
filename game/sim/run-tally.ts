import { HEAVY_MULT, type AffixId, type Derived, type EnemyInstance, type EnemyKind, type Hero, type LootOffer, type PactId, type Rng, type SpellId } from '../types';
import type { ActPlan } from './descent';
import { equippedItems } from './gear';
import { derive } from './hero';
import type { Policy, RoomType } from './model';

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
  itemsStowed?: number;
  packAtEnd?: number;
  drops?: number;
  prepareSwaps?: number;
  upgradesWorn?: number;
  upgradesPacked?: number;
  verbs?: VerbTally;
  events?: EventTally;
  pacts?: PactId[];
  deathAffixes?: AffixId[];
  thornsDeath?: boolean;
}

export type EventTally = Record<string, [number, number]>;

export interface VerbTally {
  guards: number;
  parries: number;
  bursts: number;
  potions: number;
  breakTry: Record<EnemyKind, number>;
  breakHit: Record<EnemyKind, number>;
  phase2: number;
  burnDeaths: number;
}

export type BossPick = 'SCROLL' | 'MISSED_SCROLL' | 'SIGNATURE' | 'ROLLED' | 'UPGRADE' | 'NONE';

export interface Probe {
  act: number;
  clears: number;
  won: boolean;
  maxHp: number; atk: number; mag: number; def: number; mdef: number; crit: number; dodge: number;
  bossHp: number; bossAtk: number; heavyShare: number;
  turns: number;
  hitFrac: number;
  dpt: number;
  ttk: number;
}

export interface BattleOutcome {
  won: boolean;
  stalled: boolean;
  turns: number;
  dmgTaken: number;
  landed: number;
  dmgDealt: number;
  thorns: boolean;
}

export interface Tally {
  upgradesTaken: number;
  itemsTaken: number;
  elitesFought: number;
  chestsOpened: number;
  hpAtElite: number[];
  rooms: RoomType[];
  scrollsTaken: number;
  scrollsDeclined: number;
  bossPicks: BossPick[];
  itemsStowed: number;
  drops: number;
  prepareSwaps: number;
  upgradesWorn: number;
  upgradesPacked: number;
  verbs: VerbTally;
  events: EventTally;
}

export interface RunState {
  hero: Hero;
  policy: Policy;
  rng: Rng;
  clears: number;
  probes: Probe[];
  tally: Tally;
  n: number;
  depthPlan: ActPlan[];
  plan: ActPlan;
  descentClears: number | null;
  descend: boolean;
}

export interface Ending {
  won: boolean;
  actReached: number;
  deathBy: string;
  deathKind: RunResult['deathKind'];
  affixes?: AffixId[];
  thorns?: boolean;
}

export function newTally(): Tally {
  return {
    upgradesTaken: 0, itemsTaken: 0, elitesFought: 0, chestsOpened: 0, hpAtElite: [], rooms: [],
    scrollsTaken: 0, scrollsDeclined: 0, bossPicks: [],
    itemsStowed: 0, drops: 0, prepareSwaps: 0, upgradesWorn: 0, upgradesPacked: 0,
    verbs: {
      guards: 0, parries: 0, bursts: 0, potions: 0, phase2: 0, burnDeaths: 0,
      breakTry: { NORMAL: 0, ELITE: 0, BOSS: 0 }, breakHit: { NORMAL: 0, ELITE: 0, BOSS: 0 },
    },
    events: {},
  };
}

export function bossPickKind(chosen: LootOffer | null, current: SpellId | undefined): BossPick {
  if (!chosen) {return 'NONE';}
  if (chosen.kind === 'SCROLL') {return chosen.spell === current ? 'SCROLL' : 'MISSED_SCROLL';}
  if (chosen.kind === 'ITEM') {return chosen.item.bossOnly ? 'SIGNATURE' : 'ROLLED';}
  return 'UPGRADE';
}

export function countPick(tally: Tally, chosen: LootOffer): void {
  if (chosen.kind === 'UPGRADE' || chosen.kind === 'UPGRADE_ANY') {tally.upgradesTaken += 1;}
  else if (chosen.kind === 'SCROLL') {tally.scrollsTaken += 1;}
  else {tally.itemsTaken += 1;}
}

export function countUpgradeTarget(tally: Tally, resolved: LootOffer): void {
  if (resolved.kind !== 'UPGRADE') {return;}
  if (resolved.target.where === 'WORN') {tally.upgradesWorn += 1;}
  else {tally.upgradesPacked += 1;}
}

function heavyShareOf(boss: EnemyInstance, atk: number, entry: Derived): number {
  const resist = boss.def.atkType === 'PHYSICAL' ? entry.def : entry.mdef;
  const phase2 = boss.def.phase2?.atkMult ?? 1;
  return (atk * HEAVY_MULT * phase2 * (1 - resist / 100)) / Math.max(1, entry.maxHp);
}

export function probeOf(act: number, clears: number, entry: Derived, fight: { boss: EnemyInstance; outcome: BattleOutcome; atk: number }): Probe {
  const { boss, outcome, atk } = fight;
  return {
    act,
    clears,
    won: outcome.won,
    maxHp: entry.maxHp, atk: entry.atk, mag: entry.mag,
    def: entry.def, mdef: entry.mdef, crit: entry.crit, dodge: entry.dodge,
    bossHp: boss.maxHp, bossAtk: atk, heavyShare: heavyShareOf(boss, atk, entry),
    turns: outcome.turns,
    hitFrac: outcome.landed > 0 ? outcome.dmgTaken / outcome.landed / Math.max(1, entry.maxHp) : 0,
    dpt: outcome.dmgDealt / Math.max(1, outcome.turns),
    ttk: boss.maxHp / Math.max(1, outcome.dmgDealt / Math.max(1, outcome.turns)),
  };
}

export function finish(run: RunState, ending: Ending): RunResult {
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
    ...tally,
    scrollsMissedAtEnd: hero.missedScrolls.length,
    packAtEnd: hero.pack.length,
    pacts: [...hero.pacts],
    deathAffixes: ending.affixes ?? [],
    thornsDeath: ending.thorns ?? false,
  };
}

export function countEvent(tally: Tally, id: string, choice: 0 | 1): void {
  const split = tally.events[id] ?? [0, 0];
  split[choice] += 1;
  tally.events[id] = split;
}
