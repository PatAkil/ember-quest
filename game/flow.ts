import { ENEMIES, BOSS_ENTRY_HEAL } from './data';
import { ACTS_PER_DEPTH } from './types';
import type { EnemyKind, Hero, LootSource } from './types';
import {
  createHero, createSeededRng, depthOf, fullHeal, gloryBonus, grantClear, healFraction, isLastActOfDepth, offerPacts, planDepth, planOf,
  refillPotions, scoreAfterDeath, scoreOf, takePendingBurn,
} from './sim';
import { at, must } from './lookup';
import { resetFx } from './fx';
import { clearPops } from './pops';
import { generateMap } from './mapgen';
import { biome, biomeLook, installRng, pickOne, resetCursorEdge, stageAt } from './state';
import type { Game, MapNode, RoomType, ThresholdChoice } from './state';
import { storeBest } from './storage';
import { startBattle } from './screens/battle';
import { showCard } from './screens/card';
import { startLevelUp } from './screens/levelup';
import { startLoot } from './screens/loot';
import { startEvent } from './screens/event';
import { startPact } from './screens/pact';
import { startThreshold } from './screens/threshold';

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
  if (kind === 'BOSS') {g.bosses++;}
  g.score = scoreOf(g);
  g.app.runtime.scoreChanged(g.score);
  return grantClear(g.hero, kind).sp;
}

function enterAct(g: Game): void {
  g.map.stages = generateMap(g.rng, g.plan);
  g.map.pendingNode = null;
  g.map.curStage = -1;
  g.map.reachable = stageAt(g, 0).map((_, i) => i);
  g.map.cursor = 0;
  g.subScene = 'MAP';
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  resetCursorEdge(g);
}

const freshStage = (g: Game, next: () => void) => (): void => { clearPops(g); next(); };

function advanceAct(g: Game): void {
  g.n++;
  g.plan = planOf(g.depthPlan, g.n);
  showCard(g, [`${biome(g).name} AWAITS...`, 'THE DESCENT CONTINUES'], () => { enterAct(g); });
}

function enterDepth(g: Game): void {
  g.n++;
  g.depthPlan = planDepth(depthOf(g.n), g.rng);
  g.plan = planOf(g.depthPlan, g.n);
  const offers = offerPacts(g.hero, g.rng);
  const card = (): void => { showCard(g, [`DEPTH ${String(depthOf(g.n))}`, `${biome(g).name} AWAITS...`], () => { enterAct(g); }); };
  if (offers.length === 0) { card(); return; }
  startPact(g, offers, freshStage(g, card));
}

function ascend(g: Game): void {
  g.score += gloryBonus(depthOf(g.n));
  g.app.runtime.scoreChanged(g.score);
  g.subScene = 'BATTLE';
  g.app.scenes.to('WIN');
}

function descend(g: Game): void {
  g.won = true;
  g.banked = g.score;
  g.descentClears ??= g.clears;
  enterDepth(g);
}

const THRESHOLD_PATH: Record<ThresholdChoice, (g: Game) => void> = { ASCEND: ascend, DESCEND: descend };

function onActCleared(g: Game): void {
  if (isLastActOfDepth(g.n)) { startThreshold(g, (choice) => { THRESHOLD_PATH[choice](g); }); return; }
  advanceAct(g);
}

function levelThenLoot(g: Game, sp: number, source: LootSource, done: () => void): void {
  clearPops(g);
  startLevelUp(g, sp, freshStage(g, () => { startLoot(g, source, freshStage(g, done)); }));
}

function ignitePendingBurn(g: Game): void {
  const burn = takePendingBurn(g.hero, g.n);
  if (burn) {g.hero.burn = burn;}
}

function fightRoom(g: Game, node: MapNode, kind: 'NORMAL' | 'ELITE'): void {
  const { plan } = g;
  const pool = kind === 'NORMAL' ? plan.normals : plan.elites;
  const source: LootSource = kind === 'NORMAL' ? 'FIGHT' : 'ELITE';
  startBattle(g, node.enemyId ?? pickOne(g.rng, pool), () => {
    levelThenLoot(g, onClear(g, kind), source, () => { advanceStage(g); });
  }, node.affixes ?? []);
  ignitePendingBurn(g);
}

function bossRoom(g: Game, node: MapNode): void {
  const b = g.plan;
  node.cleared = true;
  healFraction(g.hero, BOSS_ENTRY_HEAL);
  const afterVictory = (sp: number) => (): void => { levelThenLoot(g, sp, 'BOSS', () => { onActCleared(g); }); };
  startBattle(g, b.boss, () => {
    const sp = onClear(g, 'BOSS');
    showCard(g, ['VICTORY!', `${must(ENEMIES[b.boss], b.boss).name} IS NO MORE`], afterVictory(sp));
  });
  ignitePendingBurn(g);
}

function restRoom(g: Game): void {
  fullHeal(g.hero);
  refillPotions(g.hero);
  g.app.audio.play('pickup');
  showCard(g, ['FULLY RESTED', 'HP, MP AND POTIONS FULL'], () => { advanceStage(g); });
}

const normalRoom = (g: Game, node: MapNode): void => { fightRoom(g, node, 'NORMAL'); };
const eliteRoom = (g: Game, node: MapNode): void => { fightRoom(g, node, 'ELITE'); };
const lootRoom = (g: Game): void => { startLoot(g, 'LOOT', freshStage(g, () => { advanceStage(g); })); };
const eventRoom = (g: Game): void => { startEvent(g, freshStage(g, () => { advanceStage(g); })); };

const ROOMS: Record<RoomType, (g: Game, node: MapNode) => void> = {
  FIGHT: normalRoom,
  ELITE: eliteRoom,
  BOSS: bossRoom,
  REST: restRoom,
  LOOT: lootRoom,
  EVENT: eventRoom,
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

function placeRun(g: Game, n: number, clears: number): void {
  g.n = n;
  g.clears = clears; g.bosses = 0; g.score = scoreOf(g);
  g.depthPlan = planDepth(depthOf(n), g.rng);
  g.plan = planOf(g.depthPlan, n);
  g.won = n >= ACTS_PER_DEPTH;
  g.banked = g.won ? g.score : 0;
  g.descentClears = g.won ? clears : null;
}

export function startRun(g: Game, hero: Hero = createHero(), n = 0, clears = 0): void {
  seedRun(g);
  g.hero = hero;
  placeRun(g, n, clears);
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

function settleDeath(g: Game): void {
  g.score = scoreAfterDeath(g);
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
  scenes.onEnter('GAME_OVER', () => { settleDeath(g); saveBest(g); runtime.stateChanged('GAME_OVER'); runtime.gameOver({ score: g.score, won: g.won }); });
  scenes.onEnter('WIN', () => { saveBest(g); runtime.stateChanged('WIN'); runtime.gameOver({ score: g.score, won: true }); });
}
