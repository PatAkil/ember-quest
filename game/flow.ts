import { ENEMIES, BOSS_ENTRY_HEAL, PACTS } from './data';
import { ACTS_PER_DEPTH } from './types';
import type { EnemyKind, Hero, PactId } from './types';
import {
  actInDepth, createHero, enterActRecovery, createSeededRng, depthOf, gloryBonus, grantClear, healFraction, isLastActOfDepth, offerPacts, pactMods, planDepth, planOf,
  restHero, scoreAfterDeath, scoreOf, takePendingBurn,
} from './sim';
import type { RestOutcome, RewardSource } from './sim';
import { must } from './lookup';
import { bannerDur, cue, resetFx } from './fx';
import { clearPops } from './pops';
import { generateMap } from './mapgen';
import { armA, biome, biomeLook, installRng, pickOne, resetCursorEdge } from './state';
import type { BattleWin, Game, MapNode, RoomType, ThresholdChoice } from './state';
import { newStamp } from './storage';
import { forgetRun, keepBest, persist, persistBattle, persistReward, settleRoom } from './persist';
import { startBattle } from './screens/battle';
import { popHero } from './screens/battle-fx';
import type { PopSpec } from './screens/battle-fx';
import { C_HP, C_MP } from './theme';
import { showCard } from './screens/card';
import { startLevelUp } from './screens/levelup';
import { chooseUpgrade, startLoot } from './screens/loot';
import type { LootExit } from './screens/loot';
import { startEvent } from './screens/event';
import { startPact } from './screens/pact';
import { startThreshold } from './screens/threshold';

export type FightSource = Exclude<RewardSource, 'EVENT'>;

export function backToMap(g: Game): void {
  g.subScene = 'MAP';
  resetCursorEdge(g);
  armA(g);
}

function advanceStage(g: Game): void {
  settleRoom(g);
  backToMap(g);
}

const KIND_OF: Record<FightSource, EnemyKind> = { FIGHT: 'NORMAL', ELITE: 'ELITE', BOSS: 'BOSS' };

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
  g.map.reachable = (g.map.stages[0] ?? []).map((_, i) => i);
  g.map.cursor = 0;
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  backToMap(g);
  persist(g, { at: 'MAP' });
}

const freshStage = (g: Game, next: () => void) => (): void => { clearPops(g); next(); };

function nextAct(g: Game): void {
  g.n++;
  enterActRecovery(g.hero);
  g.plan = planOf(g.depthPlan, g.n);
  enterAct(g);
}

function showActCard(g: Game): void {
  showCard(g, [`${biome(g).name} AWAITS...`, 'THE DESCENT CONTINUES'], () => { backToMap(g); });
}

function depthCardLines(g: Game): string[] {
  const pact = g.hero.pacts[g.hero.pacts.length - 1];
  const sworn = pact === undefined ? 'NO PACT LEFT TO SWEAR' : `SWORN TO ${PACTS[pact].name}`;
  return [`DEPTH ${String(depthOf(g.n))}`, `${biome(g).name} AWAITS...`, sworn];
}

function enterDepth(g: Game): void {
  g.n++;
  enterActRecovery(g.hero);
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

export function openPact(g: Game, offers: PactId[]): void {
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

export function openThreshold(g: Game): void {
  persist(g, { at: 'THRESHOLD' });
  startThreshold(g, (choice) => { THRESHOLD_PATH[choice](g); });
}

export function bossExit(g: Game): LootExit {
  if (isLastActOfDepth(g.n)) {return { settle: () => { persist(g, { at: 'THRESHOLD' }); }, done: () => { openThreshold(g); } };}
  let moved = false;
  const move = (): void => {
    if (moved) {return;}
    moved = true;
    nextAct(g);
  };
  return { settle: move, done: () => { move(); showActCard(g); } };
}

export const roomExit = (g: Game): LootExit => ({ settle: () => { settleRoom(g); }, done: () => { advanceStage(g); } });

export function levelThenLoot(g: Game, reward: { earned: number; source: FightSource }, exit: LootExit): void {
  const { earned, source } = reward;
  clearPops(g);
  startLevelUp(g, earned, freshStage(g, () => {
    persistReward(g, { source, earned });
    startLoot(g, source, { settle: exit.settle, done: freshStage(g, exit.done) });
  }));
}

function ignitePendingBurn(g: Game): void {
  const burn = takePendingBurn(g.hero, g.n);
  if (burn) {g.hero.burn = burn;}
}

const REWARD_SALT = 0x5bd1e995;

function reseedReward(g: Game): void {
  g.rngSource.setState((g.roomSeed ^ REWARD_SALT) >>> 0);
}

function bossVictory(g: Game, sp: number): void {
  const name = must(ENEMIES[g.plan.boss], g.plan.boss).name;
  showCard(g, ['VICTORY!', `${name} IS NO MORE`], () => { levelThenLoot(g, { earned: sp, source: 'BOSS' }, bossExit(g)); });
}

const AFTER_WIN: Record<FightSource, (g: Game, sp: number) => void> = {
  FIGHT: (g, sp) => { levelThenLoot(g, { earned: sp, source: 'FIGHT' }, roomExit(g)); },
  ELITE: (g, sp) => { levelThenLoot(g, { earned: sp, source: 'ELITE' }, roomExit(g)); },
  BOSS: bossVictory,
};

export function winFor(g: Game, source: FightSource): BattleWin {
  let sp: number | null = null;
  const kill = (): void => {
    if (sp !== null) {return;}
    reseedReward(g);
    const earned = onClear(g, KIND_OF[source]);
    sp = earned;
    persistReward(g, { source, earned });
  };
  return { kill, done: () => { kill(); AFTER_WIN[source](g, sp ?? 0); } };
}

function fightRoom(g: Game, node: MapNode, source: 'FIGHT' | 'ELITE'): void {
  const pool = source === 'FIGHT' ? g.plan.normals : g.plan.elites;
  startBattle(g, node.enemyId ?? pickOne(g.rng, pool), winFor(g, source), node.affixes ?? []);
  ignitePendingBurn(g);
  persistBattle(g);
}

function entryHealPops(healed: { hp: number; mp: number }): PopSpec[] {
  const hp = healed.hp > 0 ? [{ text: `+${String(healed.hp)} HP`, color: C_HP }] : [];
  return healed.mp > 0 ? [...hp, { text: `+${String(healed.mp)} MP`, color: C_MP }] : hp;
}

function bossRoom(g: Game, node: MapNode): void {
  node.cleared = true;
  const healed = healFraction(g.hero, BOSS_ENTRY_HEAL);
  startBattle(g, g.plan.boss, winFor(g, 'BOSS'));
  const pops = entryHealPops(healed);
  cue(g, bannerDur(), () => { popHero(g, pops); });
  ignitePendingBurn(g);
  persistBattle(g);
}

function ashNote(rest: RestOutcome): string {
  if (rest.upgrade) {return 'THE ASHES OFFER AN UPGRADE';}
  return rest.mended > 0 ? `NOTHING TO UPGRADE  +${String(rest.mended)} HP` : 'NOTHING TO UPGRADE';
}

function gainsLine(rest: RestOutcome): string {
  const hp = rest.hp - rest.mended;
  const gains = [hp > 0 ? `+${String(hp)} HP` : '', rest.mp > 0 ? `+${String(rest.mp)} MP` : ''].filter(Boolean);
  return [...gains, 'POTIONS FULL'].join('  ');
}

function restLines(g: Game, rest: RestOutcome, refilled: boolean): string[] {
  const mods = pactMods(g.hero);
  const restored = rest.hp > 0 || rest.mp > 0 || refilled;
  if (mods.restHealMult >= 1 && mods.restUpgrade <= 0) {
    return restored ? ['FULLY RESTED', 'HP, MP AND POTIONS FULL'] : ['ALREADY AT FULL STRENGTH', 'POTIONS FULL'];
  }
  const title = mods.restHealMult >= 1 ? 'FULLY RESTED' : `REST HEALS ${String(Math.round(mods.restHealMult * 100))}%`;
  return mods.restUpgrade > 0 ? [title, gainsLine(rest), ashNote(rest)] : [title, gainsLine(rest)];
}

function offerAshUpgrade(g: Game): void {
  const exit = roomExit(g);
  g.loot = { offers: [{ kind: 'UPGRADE_ANY' }], source: 'LOOT', cursor: 0, stow: false, ash: true, onDone: freshStage(g, exit.done), settle: exit.settle };
  chooseUpgrade(g);
}

function restRoom(g: Game): void {
  const potions = g.hero.potions;
  const rest = restHero(g.hero);
  g.app.audio.play('pickup');
  showCard(g, restLines(g, rest, g.hero.potions > potions), () => { if (rest.upgrade) {offerAshUpgrade(g);} else {advanceStage(g);} });
}

export const leaveRoom = (g: Game): () => void => freshStage(g, () => { advanceStage(g); });

const ROOMS: Record<RoomType, (g: Game, node: MapNode) => void> = {
  FIGHT: (g, node) => { fightRoom(g, node, 'FIGHT'); },
  ELITE: (g, node) => { fightRoom(g, node, 'ELITE'); },
  BOSS: bossRoom,
  REST: restRoom,
  LOOT: (g) => { startLoot(g, 'LOOT', { settle: roomExit(g).settle, done: leaveRoom(g) }); },
  EVENT: (g) => { startEvent(g, leaveRoom(g)); },
};

const SEED_SPACE = 0x100000000;

export function selectNode(g: Game, node: MapNode): void {
  g.map.pendingNode = node;
  persist(g, { at: 'ROOM', stage: node.stage, slot: node.slot });
  g.roomSeed = Math.floor(g.rng() * SEED_SPACE);
  ROOMS[node.type](g, node);
}

export function seedRun(g: Game): void {
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

export function resetRunScreens(g: Game): void {
  g.dying = false; g.heroDown = false; g.abandoned = false;
  g.battle.enemy = null; g.battle.state = null;
  clearPops(g);
  resetFx(g);
}

export function startRun(g: Game, hero: Hero = createHero(), n = 0, clears = 0): void {
  seedRun(g);
  g.saveStamp = newStamp();
  g.saveLost = false;
  g.hero = hero;
  placeRun(g, n, clears);
  resetRunScreens(g);
  enterAct(g);
}

export function startPlaying(g: Game): void {
  startRun(g);
  g.app.scenes.to('PLAYING');
  g.app.runtime.scoreChanged(g.score);
}

export function startFresh(g: Game): void {
  forgetRun(g);
  startPlaying(g);
}

export function abandonRun(g: Game): void {
  g.abandoned = true;
  g.app.scenes.to('GAME_OVER');
}

function settleDeath(g: Game): void {
  const before = g.score;
  g.score = scoreAfterDeath(g);
  if (g.score !== before) {g.app.runtime.scoreChanged(g.score);}
}

function saveBest(g: Game): void {
  g.beatBest = g.score > g.best.score;
  if (!g.beatBest) {return;}
  g.best = { score: g.score, depth: depthOf(g.n), act: actInDepth(g.n) + 1 };
  keepBest(g);
}

export function wireScenes(g: Game): void {
  const { scenes, runtime } = g.app;
  scenes.onEnter('TITLE', () => { armA(g); runtime.stateChanged('TITLE'); });
  scenes.onEnter('PLAYING', () => { runtime.stateChanged('PLAYING'); });
  scenes.onEnter('PAUSED', () => { g.pause = { cursor: 0, confirm: false, yes: false }; runtime.stateChanged('PAUSED'); });
  scenes.onEnter('GAME_OVER', () => {
    g.endedAt = g.clock;
    forgetRun(g); settleDeath(g); saveBest(g);
    runtime.stateChanged('GAME_OVER'); runtime.gameOver({ score: g.score, won: g.won });
  });
  scenes.onEnter('WIN', () => {
    g.endedAt = g.clock;
    forgetRun(g); saveBest(g);
    runtime.stateChanged('WIN'); runtime.gameOver({ score: g.score, won: true });
  });
}
