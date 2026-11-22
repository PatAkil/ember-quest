import type { BattleState, EnemyInstance, Hero, LootOffer, LootSource, Rng } from './types';
import { BIOMES } from './data';
import { createHero } from './sim';
import type { App } from './app';
import { BIOME_LOOK, C_TEXT } from './theme';
import type { BiomeLook } from './theme';
import { loadBest } from './storage';
import { at, noop } from './lookup';

export type SubScene = 'MAP' | 'BATTLE' | 'LEVELUP' | 'LOOT' | 'CARD';
export type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'BOSS';
export interface MapNode { type: RoomType; stage: number; slot: number; links: number[]; cleared: boolean }

export interface Pop { x: number; y: number; life: number; text: string; color: string; scale: number }

export interface MapState {
  stages: MapNode[][];
  curStage: number;
  reachable: number[];
  cursor: number;
  pendingNode: MapNode | null;
}

type BattlePhase = 'MENU' | 'QUEUE';
type Outcome = 'NONE' | 'WON' | 'LOST';
interface QueueStep { hold: number; run: () => void }
export interface BattleScreen {
  enemy: EnemyInstance | null;
  state: BattleState | null;
  phase: BattlePhase;
  menuCursor: number;
  outcome: Outcome;
  onWon: () => void;
  queue: QueueStep[];
  timer: number;
  text: string;
  color: string;
}

export interface CardScreen { lines: string[]; onDone: () => void }
export interface LevelUpScreen { cursor: number; earned: number; onDone: () => void }
export interface LootScreen { offers: LootOffer[]; cursor: number; source: LootSource; onDone: () => void }

export interface Game {
  app: App;
  rng: Rng;
  clock: number;
  hero: Hero;
  clears: number;
  score: number;
  actIndex: number;
  subScene: SubScene;
  prevDirY: number;
  best: number;
  beatBest: boolean;
  deathBiome: string;
  dying: boolean;
  heroDown: boolean;
  pops: Pop[];
  map: MapState;
  battle: BattleScreen;
  card: CardScreen;
  levelUp: LevelUpScreen;
  loot: LootScreen;
}

export function createGame(app: App): Game {
  return {
    app,
    rng: Math.random,
    clock: 0,
    hero: createHero(),
    clears: 0,
    score: 0,
    actIndex: 0,
    subScene: 'MAP',
    prevDirY: 0,
    best: loadBest(),
    beatBest: false,
    deathBiome: '',
    dying: false,
    heroDown: false,
    pops: [],
    map: { stages: [], curStage: -1, reachable: [0, 1], cursor: 0, pendingNode: null },
    battle: {
      enemy: null, state: null, phase: 'MENU', menuCursor: 0, outcome: 'NONE', onWon: noop,
      queue: [], timer: 0, text: '', color: C_TEXT,
    },
    card: { lines: [], onDone: noop },
    levelUp: { cursor: 0, earned: 0, onDone: noop },
    loot: { offers: [], cursor: 0, source: 'FIGHT', onDone: noop },
  };
}

export const biome = (g: Game) => at(BIOMES, g.actIndex);
export const biomeLook = (g: Game): BiomeLook => at(BIOME_LOOK, g.actIndex);

export function resetCursorEdge(g: Game): void {
  g.prevDirY = g.app.input.dir.y;
}

export function dirEdge(g: Game): number {
  const dy = g.app.input.dir.y;
  const edge = dy !== 0 && g.prevDirY === 0 ? dy : 0;
  g.prevDirY = dy;
  return edge;
}

export function wrapCursor(cursor: number, dy: number, n: number): number {
  return (cursor + dy + n) % n;
}

export const pickOne = <T,>(rng: Rng, items: readonly T[]): T => at(items, Math.floor(rng() * items.length));

export function stageAt(g: Game, stage: number): MapNode[] {
  return at(g.map.stages, stage);
}
