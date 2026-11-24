import { ENEMIES, BOSS_ENTRY_HEAL, PACTS } from './data';
import { ACTS_PER_DEPTH } from './types';
import type { EnemyKind, Hero, LootSource } from './types';
import {
  actInDepth, createHero, createSeededRng, depthOf, fromSaved, gloryBonus, grantClear, healFraction, isLastActOfDepth, offerPacts, pactMods, planDepth, planOf,
  loadRun, restHero, saveRun, scoreAfterDeath, scoreOf, storyPlan, takePendingBurn, toSaved,
} from './sim';
import type { PactId } from './types';
import type { RestOutcome, RunSnapshot, SavedRun, SavedStep } from './sim';
import { at, must } from './lookup';
import { resetFx } from './fx';
import { clearPops } from './pops';
import { generateMap } from './mapgen';
import { biome, biomeLook, installRng, pickOne, resetCursorEdge, stageAt } from './state';
import type { Game, MapNode, RoomType, ThresholdChoice } from './state';
import { clearRun, loadStoredRun, storeBest, storeRun } from './storage';
import { startBattle } from './screens/battle';
import { showCard } from './screens/card';
import { startLevelUp } from './screens/levelup';
import { chooseUpgrade, startLoot } from './screens/loot';
import { startEvent } from './screens/event';
import { startPact } from './screens/pact';
import { startThreshold } from './screens/threshold';

function snapshotOf(g: Game, step: SavedStep): RunSnapshot {
  const { stages, curStage, reachable, cursor } = g.map;
  const run = { n: g.n, clears: g.clears, bosses: g.bosses, descentClears: g.descentClears, score: g.score, banked: g.banked, won: g.won };
  return { hero: g.hero, run, depthPlan: g.depthPlan, map: { stages, curStage, reachable, cursor }, step, rng: g.rngSource.getState() };
}

function persist(g: Game, step: SavedStep): void {
  if (g.rngFromHook) {return;}
  storeRun(saveRun(snapshotOf(g, step)));
}

function forgetRun(g: Game): void {
  g.resume = null;
  if (!g.rngFromHook) {clearRun();}
}

function backToMap(g: Game): void {
  g.subScene = 'MAP';
  resetCursorEdge(g);
}

function advanceStage(g: Game): void {
  const node = g.map.pendingNode;
  if (!node) {return;}
  node.cleared = true;
  g.map.curStage = node.stage;
  g.map.reachable = node.links.length ? node.links : stageAt(g, node.stage + 1).map((_, i) => i);
  g.map.cursor = at(g.map.reachable, 0);
  backToMap(g);
  persist(g, { at: 'MAP' });
}

function onClear(g: Game, kind: EnemyKind): number {
  g.clears++;
  if (kind === 'BOSS') {g.bosses++;}
  g.score = scoreOf(g);
  g.app.runtime.scoreChanged(g.score);
  return grantClear(g.hero, kind).sp;
}

export function enterAct(g: Game): void {
  g.map.stages = generateMap(g.rng, g.plan);
  g.map.pendingNode = null;
  g.map.curStage = -1;
  g.map.reachable = stageAt(g, 0).map((_, i) => i);
  g.map.cursor = 0;
  g.subScene = 'MAP';
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  resetCursorEdge(g);
  persist(g, { at: 'MAP' });
}

const freshStage = (g: Game, next: () => void) => (): void => { clearPops(g); next(); };

function advanceAct(g: Game): void {
  g.n++;
  g.plan = planOf(g.depthPlan, g.n);
  enterAct(g);
  showCard(g, [`${biome(g).name} AWAITS...`, 'THE DESCENT CONTINUES'], () => { backToMap(g); });
}

function depthCardLines(g: Game): string[] {
  const pact = g.hero.pacts[g.hero.pacts.length - 1];
  const sworn = pact === undefined ? 'NO PACT LEFT TO SWEAR' : `SWORN TO ${PACTS[pact].name}`;
  return [`DEPTH ${String(depthOf(g.n))}`, `${biome(g).name} AWAITS...`, sworn];
}

function enterDepth(g: Game): void {
  g.n++;
  g.depthPlan = planDepth(depthOf(g.n), g.rng);
  g.plan = planOf(g.depthPlan, g.n);
  const offers = offerPacts(g.hero, g.rng);
  if (offers.length === 0) { openDepth(g); return; }
  openPact(g, offers);
}

function openDepth(g: Game): void {
  enterAct(g);
  showCard(g, depthCardLines(g), () => { backToMap(g); });
}

function openPact(g: Game, offers: PactId[]): void {
  persist(g, { at: 'PACT', offers });
  startPact(g, offers, freshStage(g, () => { openDepth(g); }));
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

function openThreshold(g: Game): void {
  persist(g, { at: 'THRESHOLD' });
  startThreshold(g, (choice) => { THRESHOLD_PATH[choice](g); });
}

function onActCleared(g: Game): void {
  if (isLastActOfDepth(g.n)) { openThreshold(g); return; }
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

function ashNote(rest: RestOutcome): string {
  if (rest.upgrade) {return 'THE ASHES OFFER AN UPGRADE';}
  return rest.mended > 0 ? `NOTHING TO UPGRADE  MENDED ${String(rest.mended)} HP` : 'NOTHING TO UPGRADE';
}

function restLines(g: Game, rest: RestOutcome): string[] {
  const mods = pactMods(g.hero);
  if (mods.restHealMult >= 1 && mods.restUpgrade <= 0) {return ['FULLY RESTED', 'HP, MP AND POTIONS FULL'];}
  const title = mods.restHealMult >= 1 ? 'FULLY RESTED' : `REST HEALS ${String(Math.round(mods.restHealMult * 100))}%`;
  const healed = `+${String(rest.hp - rest.mended)} HP  +${String(rest.mp)} MP  POTIONS FULL`;
  return mods.restUpgrade > 0 ? [title, healed, ashNote(rest)] : [title, healed];
}

function offerAshUpgrade(g: Game): void {
  g.loot = { offers: [{ kind: 'UPGRADE_ANY' }], source: 'LOOT', cursor: 0, stow: false, onDone: freshStage(g, () => { advanceStage(g); }) };
  chooseUpgrade(g);
}

function restRoom(g: Game): void {
  const rest = restHero(g.hero);
  g.app.audio.play('pickup');
  showCard(g, restLines(g, rest), () => { if (rest.upgrade) {offerAshUpgrade(g);} else {advanceStage(g);} });
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
  persist(g, { at: 'ROOM', stage: node.stage, slot: node.slot });
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

function resetRunScreens(g: Game): void {
  g.dying = false; g.heroDown = false; g.abandoned = false;
  g.battle.enemy = null; g.battle.state = null;
  clearPops(g);
  resetFx(g);
}

export function startRun(g: Game, hero: Hero = createHero(), n = 0, clears = 0): void {
  seedRun(g);
  g.hero = hero;
  placeRun(g, n, clears);
  resetRunScreens(g);
  enterAct(g);
}

export function startPlaying(g: Game): void {
  startRun(g);
  g.app.scenes.to('PLAYING');
}

export function startFresh(g: Game): void {
  forgetRun(g);
  startPlaying(g);
}

function restore(g: Game, live: RunSnapshot): void {
  seedRun(g);
  g.rngSource.setState(live.rng);
  g.hero = live.hero;
  Object.assign(g, live.run);
  g.depthPlan = live.depthPlan;
  g.plan = planOf(g.depthPlan, g.n);
  g.map = { ...live.map, pendingNode: null };
}

const RESUME_STEP: Record<SavedStep['at'], (g: Game, step: SavedStep) => void> = {
  MAP: () => undefined,
  ROOM: (g, step) => { if (step.at === 'ROOM') {selectNode(g, at(stageAt(g, step.stage), step.slot));} },
  THRESHOLD: openThreshold,
  PACT: (g, step) => { if (step.at === 'PACT') {openPact(g, step.offers);} },
};

export function continueRun(g: Game, saved: SavedRun): void {
  const live = fromSaved(saved);
  g.resume = null;
  restore(g, live);
  resetRunScreens(g);
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  backToMap(g);
  g.app.scenes.to('PLAYING');
  g.app.runtime.scoreChanged(g.score);
  RESUME_STEP[live.step.at](g, live.step);
}

export function loadResume(g: Game): void {
  if (g.rngFromHook) {return;}
  const text = loadStoredRun();
  g.resume = text === null ? null : loadRun(text);
  if (text !== null && g.resume === null) {clearRun();}
}

export function offerResume(g: Game): void {
  g.resume = toSaved(snapshotOf(g, { at: 'MAP' }));
  g.depthPlan = storyPlan();
  g.plan = planOf(g.depthPlan, 0);
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
}

export function abandonRun(g: Game): void {
  g.abandoned = true;
  g.app.scenes.to('PLAYING');
  g.app.scenes.to('GAME_OVER');
}

function settleDeath(g: Game): void {
  g.score = scoreAfterDeath(g);
}

function saveBest(g: Game): void {
  g.beatBest = g.score > g.best.score;
  if (g.beatBest) { g.best = { score: g.score, depth: depthOf(g.n), act: actInDepth(g.n) + 1 }; storeBest(g.best); }
}

export function wireScenes(g: Game): void {
  const { scenes, runtime } = g.app;
  scenes.onEnter('TITLE', () => { runtime.stateChanged('TITLE'); });
  scenes.onEnter('PLAYING', () => { runtime.stateChanged('PLAYING'); });
  scenes.onEnter('PAUSED', () => { g.pause = { cursor: 0, confirm: false }; runtime.stateChanged('PAUSED'); });
  scenes.onEnter('GAME_OVER', () => {
    forgetRun(g); settleDeath(g); saveBest(g);
    runtime.stateChanged('GAME_OVER'); runtime.gameOver({ score: g.score, won: g.won });
  });
  scenes.onEnter('WIN', () => { forgetRun(g); saveBest(g); runtime.stateChanged('WIN'); runtime.gameOver({ score: g.score, won: true }); });
}
