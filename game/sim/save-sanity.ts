import { ACTS_PER_DEPTH, PACK_SIZE, RUN_MAX_N, type Hero } from '../types';
import { actInDepth, depthOf, isLastActOfDepth, type ActPlan } from './descent';
import { derive } from './hero';
import { ownedIds } from './pack';
import { fail } from './save-check';
import type { SavedCounters, SavedHero, SavedMap, SavedRun, SavedStep } from './save-read';
import { scoreOf } from './score';

function saneHero(saved: SavedHero, live: Hero): SavedHero {
  const ids = ownedIds(live);
  if (new Set(ids).size !== ids.length) {fail('hero: an item owned twice');}
  if (saved.pack.length > PACK_SIZE) {fail('hero: pack over its size');}
  if (saved.hp <= 0) {fail('hero: dead');}
  const d = derive(live);
  return { ...saved, hp: Math.min(saved.hp, d.maxHp), mp: Math.min(saved.mp, d.maxMp) };
}

function saneCounters(run: SavedCounters): SavedCounters {
  if (run.n > RUN_MAX_N) {fail('run: n past the last act');}
  if (run.bosses > run.n + 1 || run.bosses > run.clears) {fail('run: more bosses than acts');}
  const descended = run.n >= ACTS_PER_DEPTH;
  if (run.won !== descended || (run.descentClears === null) === descended) {fail('run: descent flags disagree with n');}
  const score = scoreOf(run);
  if (run.banked > score) {fail('run: banked more than was earned');}
  return { ...run, score };
}

function sanePlans(plans: readonly ActPlan[]): void {
  if (plans.some((p) => p.normals.length === 0 || p.elites.length === 0)) {fail('plan: an empty foe pool');}
}

function saneCursor(map: SavedMap): void {
  if (map.reachable.length === 0 || !map.reachable.includes(map.cursor)) {fail('map: cursor off the reachable rooms');}
}

function saneSpot(map: SavedMap, spot: { stage: number; slot: number }, entering: boolean): void {
  if (spot.stage !== map.curStage + 1 || !map.reachable.includes(spot.slot)) {fail('step: a room that cannot be reached');}
  const node = map.stages[spot.stage]?.[spot.slot];
  if (entering && node?.cleared === true && node.type !== 'BOSS') {fail('step: a room already cleared');}
}

function sanePact(step: Extract<SavedStep, { at: 'PACT' }>, saved: SavedRun): void {
  const { n } = saved.run;
  if (actInDepth(n) !== 0 || depthOf(n) < 2) {fail('step: a pact outside a depth entry');}
  const offers = new Set(step.offers);
  if (offers.size !== step.offers.length || step.offers.some((id) => saved.hero.pacts.includes(id))) {fail('step: pact offers repeat or were sworn');}
}

function saneStep(saved: SavedRun): void {
  const { step, map } = saved;
  if (step.at === 'ROOM' || step.at === 'REWARD') {saneSpot(map, step, step.at === 'ROOM');}
  if (step.at === 'THRESHOLD' && !isLastActOfDepth(saved.run.n)) {fail('step: a threshold before the depth ends');}
  if (step.at === 'PACT') {sanePact(step, saved);}
}

export function saneSave(saved: SavedRun, live: Hero): SavedRun {
  sanePlans(saved.depthPlan);
  saneCursor(saved.map);
  saneStep(saved);
  return { ...saved, hero: saneHero(saved.hero, live), run: saneCounters(saved.run) };
}
