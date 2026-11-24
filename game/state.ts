import type { AffixId, BattleState, EnemyInstance, FoeScale, Hero, LootOffer, LootSource, PactId, Rng } from './types';
import { BIOMES, EVENTS } from './data';
import type { EventDef } from './data';
import { createHero, createSeededRng, planOf, storyPlan } from './sim';
import type { ActPlan, ActRef, RoomType, SeededRng } from './sim';
import type { Sprite } from '../engine';
import type { App } from './app';
import { BIOME_LOOK, C_TEXT } from './theme';
import type { BiomeLook } from './theme';
import { loadBest } from './storage';
import type { BestRecord } from './storage';
import { at, noop, pickOneIndex } from './lookup';
import { createFx, createReveal } from './fx-state';
import type { FxState, Reveal } from './fx-state';

export type SubScene = 'MAP' | 'BATTLE' | 'LEVELUP' | 'LOOT' | 'CARD' | 'GEAR' | 'PICK' | 'EVENT' | 'THRESHOLD' | 'PACT';
export type { RoomType } from './sim';
export interface MapNode { type: RoomType; stage: number; slot: number; links: number[]; cleared: boolean; enemyId?: string; affixes?: AffixId[] }

export interface Pop { x: number; y: number; life: number; text: string; color: string; scale: number }

export interface MapState {
  stages: MapNode[][];
  curStage: number;
  reachable: number[];
  cursor: number;
  pendingNode: MapNode | null;
}

type BattlePhase = 'MENU' | 'QUEUE';
export type BattleMenu = 'TOP' | 'MAGIC';
type Outcome = 'NONE' | 'WON' | 'LOST';
interface QueueStep { hold: number; run: () => void }
export interface BattleScreen {
  enemy: EnemyInstance | null;
  state: BattleState | null;
  phase: BattlePhase;
  menuCursor: number;
  menu: BattleMenu;
  topCursor: number;
  magicCursor: number;
  magicPage: number;
  outcome: Outcome;
  onWon: () => void;
  queue: QueueStep[];
  timer: number;
  text: string;
  color: string;
  bufferedA: boolean;
}

export interface CardScreen { lines: string[]; onDone: () => void; art?: { icon: Sprite; color: string } }
export interface LevelUpScreen { cursor: number; earned: number; onDone: () => void }
export interface LootScreen { offers: LootOffer[]; cursor: number; source: LootSource; stow: boolean; onDone: () => void }
export interface GearScreen { cursor: number; refusedAt: number }
export interface PickRow { icon?: Sprite; name: string; color: string; note: string; detail: string[] }
export interface EventScreen { def: EventDef; cursor: number; refusedAt: number; onDone: () => void }
export type ThresholdChoice = 'ASCEND' | 'DESCEND';
export interface ThresholdScreen { cursor: number; openedAt: number; choose: (choice: ThresholdChoice) => void }
export interface PactScreen { offers: PactId[]; cursor: number; openedAt: number; onDone: () => void }
export interface PickScreen { title: string; rows: PickRow[]; cursor: number; locked?: boolean; onPick: (i: number) => void; onCancel: () => void }

export interface Game {
  app: App;
  rngSource: SeededRng;
  rng: Rng;
  rngFromHook: boolean;
  clock: number;
  hero: Hero;
  clears: number;
  score: number;
  bosses: number;
  n: number;
  depthPlan: ActPlan[];
  plan: ActPlan;
  won: boolean;
  banked: number;
  descentClears: number | null;
  subScene: SubScene;
  prevDirY: number;
  prevDirX: number;
  best: BestRecord;
  beatBest: boolean;
  deathBiome: string;
  dying: boolean;
  heroDown: boolean;
  pops: Pop[];
  fx: FxState;
  reveal: Reveal;
  map: MapState;
  battle: BattleScreen;
  card: CardScreen;
  levelUp: LevelUpScreen;
  loot: LootScreen;
  gear: GearScreen;
  pick: PickScreen;
  event: EventScreen;
  threshold: ThresholdScreen;
  pact: PactScreen;
}

export function createGame(app: App): Game {
  const rngSource = createSeededRng(0);
  const depthPlan = storyPlan();
  return {
    app,
    rngSource,
    rng: rngSource.next,
    rngFromHook: false,
    clock: 0,
    hero: createHero(),
    clears: 0,
    score: 0,
    bosses: 0,
    n: 0,
    depthPlan,
    plan: planOf(depthPlan, 0),
    won: false,
    banked: 0,
    descentClears: null,
    subScene: 'MAP',
    prevDirY: 0,
    prevDirX: 0,
    best: loadBest(),
    beatBest: false,
    deathBiome: '',
    dying: false,
    heroDown: false,
    pops: [],
    fx: createFx(),
    reveal: createReveal(),
    map: { stages: [], curStage: -1, reachable: [0, 1], cursor: 0, pendingNode: null },
    battle: {
      enemy: null, state: null, phase: 'MENU', menuCursor: 0, menu: 'TOP', topCursor: 0, magicCursor: 0, magicPage: 0, outcome: 'NONE', onWon: noop,
      queue: [], timer: 0, text: '', color: C_TEXT, bufferedA: false,
    },
    card: { lines: [], onDone: noop },
    levelUp: { cursor: 0, earned: 0, onDone: noop },
    loot: { offers: [], cursor: 0, source: 'FIGHT', stow: false, onDone: noop },
    gear: { cursor: 0, refusedAt: -1 },
    pick: { title: '', rows: [], cursor: 0, onPick: noop, onCancel: noop },
    event: { def: at(EVENTS, 0), cursor: 0, refusedAt: -1, onDone: noop },
    threshold: { cursor: 0, openedAt: 0, choose: noop },
    pact: { offers: [], cursor: 0, openedAt: 0, onDone: noop },
  };
}

export const biome = (g: Game) => at(BIOMES, g.plan.biomeIndex);
export const biomeLook = (g: Game): BiomeLook => at(BIOME_LOOK, g.plan.biomeIndex);
export const actRef = (g: Game): ActRef => ({ n: g.n, plan: g.plan });
export const foeScale = (g: Game): FoeScale & { plan: ActPlan } => ({ n: g.n, clears: g.clears, descentClears: g.descentClears, plan: g.plan });

export function resetCursorEdge(g: Game): void {
  g.prevDirY = g.app.input.dir.y;
  g.prevDirX = g.app.input.dir.x;
}

export function dirEdge(g: Game): number {
  const dy = g.app.input.dir.y;
  const edge = dy !== 0 && g.prevDirY === 0 ? dy : 0;
  g.prevDirY = dy;
  return edge;
}

export function dirEdgeX(g: Game): number {
  const dx = g.app.input.dir.x;
  const edge = dx !== 0 && g.prevDirX === 0 ? dx : 0;
  g.prevDirX = dx;
  return edge;
}

export function wrapCursor(cursor: number, dy: number, n: number): number {
  return (cursor + dy + n) % n;
}

export const pickOne = <T,>(rng: Rng, items: readonly T[]): T => at(items, pickOneIndex(rng, items.length));

export function installRng(g: Game, source: SeededRng, fromHook: boolean): void {
  g.rngSource = source;
  g.rng = source.next;
  g.rngFromHook = fromHook;
}

export function stageAt(g: Game, stage: number): MapNode[] {
  return at(g.map.stages, stage);
}
