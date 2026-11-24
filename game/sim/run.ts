import type { Rng } from '../types';
import { actInDepth, depthOf, isLastActOfDepth, planDepth, planOf } from './descent';
import { createHero } from './hero';
import { generateMap, type MapNode } from './map';
import { offerPacts, takePact } from './pacts';
import type { Policy, RoomType } from './model';
import { withPolicyContext } from './policies';
import { bossRoom, playRoom } from './run-rooms';
import { finish, newTally, type Ending, type RunResult, type RunState } from './run-tally';
import { clamp } from './util';

export type { BossPick, Probe, RunResult } from './run-tally';

export const SIM_MAX_N = 40;

export interface SimOptions { descend?: boolean }

function routeIndex(policy: Policy, offered: RoomType[]): number {
  return clamp(Math.floor(policy.route(offered)), 0, offered.length - 1);
}

function routeNext(node: MapNode, next: MapNode[], policy: Policy): MapNode | undefined {
  const links = node.links.length > 0 ? node.links : [0];
  const options = links.flatMap((j) => next[j] ?? []);
  return options[routeIndex(policy, options.map((n) => n.type))];
}

function playMap(run: RunState): Ending | null {
  const { plan } = run;
  const stages = generateMap(run.rng, { stageSizes: plan.stageSizes, weights: plan.weights }, plan);
  const rooms = stages.length - 1;
  const entry = stages[0] ?? [];
  let node = entry[routeIndex(run.policy, entry.map((n) => n.type))];
  for (let r = 0; r < rooms && node; r += 1) {
    const current: MapNode = node;
    const next = r + 1 < rooms ? stages[r + 1] : undefined;
    node = next ? routeNext(current, next, run.policy) : undefined;
    const ending = playRoom(run, current);
    if (ending) {return ending;}
  }
  return null;
}

function choosePact(run: RunState): void {
  const offers = offerPacts(run.hero, run.rng);
  if (offers.length === 0) {return;}
  const chosen = offers[clamp(Math.floor(run.policy.pactChoice(run.hero, offers)), 0, offers.length - 1)];
  if (chosen) {takePact(run.hero, chosen);}
}

function nextAct(run: RunState): void {
  run.n += 1;
  if (actInDepth(run.n) === 0) {
    run.descentClears ??= run.clears;
    run.depthPlan = planDepth(depthOf(run.n), run.rng);
    choosePact(run);
  }
  run.plan = planOf(run.depthPlan, run.n);
}

const keepsGoing = (run: RunState): boolean => !isLastActOfDepth(run.n) || (run.descend && run.n + 1 < SIM_MAX_N);

function playRun(run: RunState): RunResult {
  for (;;) {
    const ending = playMap(run) ?? bossRoom(run);
    if (ending) {return finish(run, ending);}
    if (!keepsGoing(run)) {return finish(run, { won: true, actReached: run.n, deathBy: '', deathKind: '' });}
    nextAct(run);
  }
}

export function simulateRun(policy: Policy, rng: Rng, options: SimOptions = {}): RunResult {
  const hero = createHero();
  const depthPlan = planDepth(1, rng);
  const run: RunState = {
    hero, policy, rng, clears: 0, probes: [], tally: newTally(),
    n: 0, depthPlan, plan: planOf(depthPlan, 0), descentClears: null, descend: options.descend ?? false,
  };
  return withPolicyContext(rng, hero, () => playRun(run));
}
