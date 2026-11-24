import { eventById, fromSaved, loadRun, planOf, spawnFoe, storyPlan, toSaved } from './sim';
import type { RunSnapshot, SavedBattle, SavedRun, SavedStep } from './sim';
import { at } from './lookup';
import { biomeLook, foeScale, stageAt } from './state';
import type { Game, MapNode } from './state';
import { clearRun, newStamp, isRunKey, loadStoredRun, sameStamp } from './storage';
import { checkSaveOwner, realRun, snapshotOf } from './persist';
import {
  backToMap, bossExit, leaveRoom, levelThenLoot, openPact, openThreshold, resetRunScreens, roomExit, seedRun, selectNode, winFor,
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
  const def = eventById(eventId);
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
  startLevelUp(g, step.earned, then);
}

function resumeReward(g: Game, step: Step<'REWARD'>): void {
  g.map.pendingNode = at(stageAt(g, step.stage), step.slot);
  g.roomSeed = step.roomSeed;
  const { source } = step;
  if (source === 'EVENT') { resumeEventReward(g, step); return; }
  levelThenLoot(g, { earned: step.earned, source }, source === 'BOSS' ? bossExit(g) : roomExit(g));
}

function resumeStep(g: Game, step: SavedStep): void {
  if (step.at === 'ROOM') {resumeRoom(g, step);}
  if (step.at === 'REWARD') {resumeReward(g, step);}
  if (step.at === 'THRESHOLD') {openThreshold(g);}
  if (step.at === 'PACT') {openPact(g, step.offers);}
}

function continueRun(g: Game, saved: SavedRun): void {
  const live = fromSaved(saved);
  g.resume = null;
  restore(g, live);
  resetRunScreens(g);
  g.saveStamp = g.resumeStamp ?? newStamp();
  g.saveLost = false;
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
  backToMap(g);
  g.app.scenes.to('PLAYING');
  g.app.runtime.scoreChanged(g.score);
  resumeStep(g, live.step);
}

export function loadResume(g: Game): void {
  if (!realRun(g)) {return;}
  const stored = loadStoredRun();
  g.resume = stored === null ? null : loadRun(stored.text);
  g.resumeStamp = g.resume === null ? null : stored?.stamp ?? null;
  if (stored !== null && g.resume === null) {clearRun();}
  if (g.resume === null) {g.title = { cursor: 0, confirm: false, yes: false };}
}

const ENDED_NOTE = 'THAT RUN HAS ENDED';

export function continueIfCurrent(g: Game, saved: SavedRun): void {
  const stored = realRun(g) ? loadStoredRun() : null;
  if (!realRun(g) || (stored !== null && sameStamp(stored.stamp, g.resumeStamp))) { continueRun(g, saved); return; }
  g.notice = { text: ENDED_NOTE, at: g.clock };
  g.app.audio.play('blip');
  loadResume(g);
}

export function watchStorage(g: Game): void {
  window.addEventListener('storage', (e) => {
    if (!isRunKey(e.key)) {return;}
    if (g.app.scenes.current === 'TITLE') { loadResume(g); return; }
    checkSaveOwner(g);
  });
}

export function offerResume(g: Game): void {
  g.resume = toSaved(snapshotOf(g, { at: 'MAP' }));
  g.depthPlan = storyPlan();
  g.plan = planOf(g.depthPlan, 0);
  g.app.particles.setAmbient(biomeLook(g).ambient, biomeLook(g).ambientColor);
}
