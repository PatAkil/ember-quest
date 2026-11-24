import { EVENTS } from './data';
import { fromSaved, loadRun, planOf, spawnFoe, storyPlan, toSaved } from './sim';
import type { RunSnapshot, SavedBattle, SavedRun, SavedStep } from './sim';
import { at } from './lookup';
import { biomeLook, foeScale, stageAt } from './state';
import type { Game, MapNode } from './state';
import { clearRun, loadStoredRun } from './storage';
import { realRun, snapshotOf } from './persist';
import {
  advanceStage, backToMap, leaveRoom, levelThenLoot, onActCleared, openPact, openThreshold, resetRunScreens, seedRun, selectNode, winFor,
} from './flow';
import type { FightSource } from './flow';
import { resumeBattle } from './screens/battle';
import { offerGift, startEvent } from './screens/event';
import { startLevelUp } from './screens/levelup';

type Step<K extends SavedStep['at']> = Extract<SavedStep, { at: K }>;

function restore(g: Game, live: RunSnapshot): void {
  seedRun(g);
  g.rngSource.setState(live.rng);
  g.hero = live.hero;
  Object.assign(g, live.run);
  g.depthPlan = live.depthPlan;
  g.plan = planOf(g.depthPlan, g.n);
  g.map = { ...live.map, pendingNode: null };
}

const FIGHT_OF: Partial<Record<MapNode['type'], FightSource>> = { FIGHT: 'FIGHT', ELITE: 'ELITE', BOSS: 'BOSS' };

function resumeFight(g: Game, node: MapNode, saved: SavedBattle): void {
  const source = FIGHT_OF[node.type];
  if (!source) { selectNode(g, node); return; }
  g.roomSeed = saved.roomSeed;
  const { id, ...fields } = saved.foe;
  const enemy = { ...spawnFoe(id, { ...foeScale(g), hero: g.hero, affixes: fields.affixes }), ...fields };
  resumeBattle(g, { ...saved.state, enemy }, winFor(g, source));
}

function resumeEvent(g: Game, eventId: string): void {
  const def = EVENTS.find((e) => e.id === eventId);
  startEvent(g, leaveRoom(g), def);
}

function resumeRoom(g: Game, step: Step<'ROOM'>): void {
  const node = at(stageAt(g, step.stage), step.slot);
  g.map.pendingNode = node;
  g.roomSeed = step.roomSeed ?? 0;
  if (step.battle) { resumeFight(g, node, step.battle); return; }
  if (step.eventId !== undefined) { resumeEvent(g, step.eventId); return; }
  selectNode(g, node);
}

function resumeEventReward(g: Game, step: Step<'REWARD'>): void {
  const leave = leaveRoom(g);
  const { gift } = step;
  const then = gift === undefined ? leave : (): void => { offerGift(g, gift, leave); };
  startLevelUp(g, g.hero.sp, then);
}

function resumeReward(g: Game, step: Step<'REWARD'>): void {
  g.map.pendingNode = at(stageAt(g, step.stage), step.slot);
  g.roomSeed = step.roomSeed;
  const { source } = step;
  if (source === 'EVENT') { resumeEventReward(g, step); return; }
  const done = source === 'BOSS' ? (): void => { onActCleared(g); } : (): void => { advanceStage(g); };
  levelThenLoot(g, g.hero.sp, source, done);
}

function resumeStep(g: Game, step: SavedStep): void {
  if (step.at === 'ROOM') {resumeRoom(g, step);}
  if (step.at === 'REWARD') {resumeReward(g, step);}
  if (step.at === 'THRESHOLD') {openThreshold(g);}
  if (step.at === 'PACT') {openPact(g, step.offers);}
}

export function continueRun(g: Game, saved: SavedRun): void {
  const live = fromSaved(saved);
  g.resume = null;
  restore(g, live);
  resetRunScreens(g);
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  backToMap(g);
  g.app.scenes.to('PLAYING');
  g.app.runtime.scoreChanged(g.score);
  resumeStep(g, live.step);
}

export function loadResume(g: Game): void {
  if (!realRun(g)) {return;}
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
