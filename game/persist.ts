import type { Rarity } from './types';
import { saveRun } from './sim';
import type { RewardSource, RunSnapshot, SavedBattle, SavedStep } from './sim';
import { at } from './lookup';
import { stageAt } from './state';
import type { Game } from './state';
import { clearRun, loadStoredRun, sameStamp, storeBest, storeRun } from './storage';

export const realRun = (g: Game): boolean => !g.rngFromHook;

export function snapshotOf(g: Game, step: SavedStep): RunSnapshot {
  const { stages, curStage, reachable, cursor } = g.map;
  const run = { n: g.n, clears: g.clears, bosses: g.bosses, descentClears: g.descentClears, score: g.score, banked: g.banked, won: g.won };
  return { hero: g.hero, run, depthPlan: g.depthPlan, map: { stages, curStage, reachable, cursor }, step, rng: g.rngSource.getState() };
}

function ownsSave(g: Game): boolean {
  const mine = g.saveStamp;
  if (!mine || g.saveLost) {return false;}
  return mine.writes === 0 || sameStamp(loadStoredRun()?.stamp ?? null, mine);
}

export function checkSaveOwner(g: Game): void {
  if (realRun(g) && g.saveStamp && g.saveStamp.writes > 0 && !ownsSave(g)) {g.saveLost = true;}
}

export function persist(g: Game, step: SavedStep): void {
  if (!realRun(g) || g.saveLost) {return;}
  const mine = g.saveStamp;
  if (!mine || !ownsSave(g)) { g.saveLost = true; return; }
  const next = { id: mine.id, writes: mine.writes + 1 };
  if (storeRun(saveRun(snapshotOf(g, step)), next)) {g.saveStamp = next;}
}

export function forgetRun(g: Game): void {
  g.resume = null;
  if (realRun(g) && ownsSave(g)) {clearRun();}
}

export function keepBest(g: Game): void {
  if (realRun(g)) {storeBest(g.best);}
}

function roomSpot(g: Game): { stage: number; slot: number } | null {
  const node = g.map.pendingNode;
  return node ? { stage: node.stage, slot: node.slot } : null;
}

export function persistEvent(g: Game, eventId: string): void {
  const spot = roomSpot(g);
  if (spot) {persist(g, { at: 'ROOM', ...spot, roomSeed: g.roomSeed, eventId });}
}

interface Reward { source: RewardSource; earned: number; gift?: Rarity }

export function persistReward(g: Game, reward: Reward): void {
  const spot = roomSpot(g);
  if (spot) {persist(g, { at: 'REWARD', ...spot, roomSeed: g.roomSeed, ...reward });}
}

function battleOf(g: Game): SavedBattle | null {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return null;}
  const { def, ...foe } = enemy;
  const { enemy: shown, ...saved } = state;
  return shown === enemy ? { roomSeed: g.roomSeed, foe: { ...foe, id: def.id }, state: saved } : null;
}

export function persistBattle(g: Game): void {
  const spot = roomSpot(g);
  const battle = battleOf(g);
  if (spot && battle && g.hero.hp > 0) {persist(g, { at: 'ROOM', ...spot, battle });}
}

export function settleRoom(g: Game): void {
  const node = g.map.pendingNode;
  if (!node) {return;}
  node.cleared = true;
  g.map.curStage = node.stage;
  g.map.reachable = node.links.length ? node.links : stageAt(g, node.stage + 1).map((_, i) => i);
  g.map.cursor = at(g.map.reachable, 0);
  persist(g, { at: 'MAP' });
}
