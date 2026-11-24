import { BIOMES, ENEMIES, BOSS_ENTRY_HEAL } from './data';
import type { EnemyKind, Hero, LootSource } from './types';
import { createHero, createSeededRng, fullHeal, grantClear, healFraction, refillPotions } from './sim';
import { at, must } from './lookup';
import { resetFx } from './fx';
import { clearPops } from './pops';
import { generateMap } from './mapgen';
import { biome, biomeLook, installRng, pickOne, resetCursorEdge, stageAt } from './state';
import type { Game, MapNode, RoomType } from './state';
import { storeBest } from './storage';
import { startBattle } from './screens/battle';
import { showCard } from './screens/card';
import { startLevelUp } from './screens/levelup';
import { startLoot } from './screens/loot';

function advanceStage(g: Game): void {
  const node = g.map.pendingNode;
  if (!node) {return;}
  node.cleared = true;
  g.map.curStage = node.stage;
  g.map.reachable = node.links.length ? node.links : stageAt(g, node.stage + 1).map((_, i) => i);
  g.map.cursor = at(g.map.reachable, 0);
  g.subScene = 'MAP';
  resetCursorEdge(g);
}

function onClear(g: Game, kind: EnemyKind): number {
  g.clears++;
  g.score = g.clears * 100;
  g.app.runtime.scoreChanged(g.score);
  return grantClear(g.hero, kind).sp;
}

function enterAct(g: Game): void {
  g.map.stages = generateMap(g.rng, biome(g));
  g.map.pendingNode = null;
  g.map.curStage = -1;
  g.map.reachable = stageAt(g, 0).map((_, i) => i);
  g.map.cursor = 0;
  g.subScene = 'MAP';
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  resetCursorEdge(g);
}

function onActCleared(g: Game): void {
  if (g.actIndex >= BIOMES.length - 1) { g.subScene = 'BATTLE'; g.app.scenes.to('WIN'); return; }
  g.actIndex++;
  showCard(g, [`${biome(g).name} AWAITS...`, 'THE DESCENT CONTINUES'], () => { enterAct(g); });
}

const freshStage = (g: Game, next: () => void) => (): void => { clearPops(g); next(); };

function levelThenLoot(g: Game, sp: number, source: LootSource, done: () => void): void {
  clearPops(g);
  startLevelUp(g, sp, freshStage(g, () => { startLoot(g, source, freshStage(g, done)); }));
}

function fightRoom(g: Game, node: MapNode, kind: 'NORMAL' | 'ELITE'): void {
  const b = biome(g);
  const pool = kind === 'NORMAL' ? b.normals : b.elites;
  const source: LootSource = kind === 'NORMAL' ? 'FIGHT' : 'ELITE';
  startBattle(g, node.enemyId ?? pickOne(g.rng, pool), () => {
    levelThenLoot(g, onClear(g, kind), source, () => { advanceStage(g); });
  });
}

function bossRoom(g: Game, node: MapNode): void {
  const b = biome(g);
  node.cleared = true;
  healFraction(g.hero, BOSS_ENTRY_HEAL);
  const afterVictory = (sp: number) => (): void => { levelThenLoot(g, sp, 'BOSS', () => { onActCleared(g); }); };
  startBattle(g, b.boss, () => {
    const sp = onClear(g, 'BOSS');
    showCard(g, ['VICTORY!', `${must(ENEMIES[b.boss], b.boss).name} IS NO MORE`], afterVictory(sp));
  });
}

function restRoom(g: Game): void {
  fullHeal(g.hero);
  refillPotions(g.hero);
  g.app.audio.play('pickup');
  showCard(g, ['FULLY RESTED', 'HP AND MP RESTORED'], () => { advanceStage(g); });
}

const normalRoom = (g: Game, node: MapNode): void => { fightRoom(g, node, 'NORMAL'); };
const eliteRoom = (g: Game, node: MapNode): void => { fightRoom(g, node, 'ELITE'); };
const lootRoom = (g: Game): void => { startLoot(g, 'LOOT', freshStage(g, () => { advanceStage(g); })); };

const ROOMS: Record<RoomType, (g: Game, node: MapNode) => void> = {
  FIGHT: normalRoom,
  ELITE: eliteRoom,
  BOSS: bossRoom,
  REST: restRoom,
  LOOT: lootRoom,
};

export function selectNode(g: Game, node: MapNode): void {
  g.map.pendingNode = node;
  ROOMS[node.type](g, node);
}

const SEED_SPACE = 0x100000000;

function seedRun(g: Game): void {
  if (g.rngFromHook) {return;}
  installRng(g, createSeededRng(Math.floor(Math.random() * SEED_SPACE)), false);
}

export function startRun(g: Game, hero: Hero = createHero(), act = 0, clears = 0): void {
  seedRun(g);
  g.hero = hero;
  g.clears = clears; g.score = clears * 100; g.actIndex = act;
  g.dying = false; g.heroDown = false;
  g.battle.enemy = null; g.battle.state = null;
  clearPops(g);
  resetFx(g);
  enterAct(g);
}

export function startPlaying(g: Game): void {
  startRun(g);
  g.app.scenes.to('PLAYING');
}

function saveBest(g: Game): void {
  g.beatBest = g.score > g.best;
  if (g.beatBest) { g.best = g.score; storeBest(g.best); }
}

export function wireScenes(g: Game): void {
  const { scenes, runtime } = g.app;
  scenes.onEnter('TITLE', () => { runtime.stateChanged('TITLE'); });
  scenes.onEnter('PLAYING', () => { runtime.stateChanged('PLAYING'); });
  scenes.onEnter('PAUSED', () => { runtime.stateChanged('PAUSED'); });
  scenes.onEnter('GAME_OVER', () => { saveBest(g); runtime.stateChanged('GAME_OVER'); runtime.gameOver({ score: g.score, won: false }); });
  scenes.onEnter('WIN', () => { saveBest(g); runtime.stateChanged('WIN'); runtime.gameOver({ score: g.score, won: true }); });
}
