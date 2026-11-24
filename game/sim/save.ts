import type { Hero, Item, Slot } from '../types';
import { BIOMES, ITEMS } from '../data';
import { actInDepth, depthOf, planOf } from './descent';
import type { ActPlan } from './descent';
import { fail, int, list, record } from './save-check';
import { readCounters, readDepthPlan, readHero, RNG_STATE, SAVE_VERSION } from './save-read';
import type { SavedCounters, SavedHero, SavedNode, SavedRun, SavedStep } from './save-read';
import { readMap, readStep } from './save-map';

export { SAVE_VERSION, type SavedRun, type SavedStep } from './save-read';

export interface LiveNode extends SavedNode { stage: number; slot: number }
export interface LiveMap { stages: LiveNode[][]; curStage: number; reachable: number[]; cursor: number }
export interface RunSnapshot { hero: Hero; run: SavedCounters; depthPlan: ActPlan[]; map: LiveMap; step: SavedStep; rng: number }

function itemById(id: string): Item {
  const item = ITEMS.find((i) => i.id === id);
  if (!item) {throw new Error(`[save] unknown item ${id}`);}
  return item;
}

function mapSlots<A, B>(record: Partial<Record<Slot, A>>, f: (value: A) => B): Partial<Record<Slot, B>> {
  const out: Partial<Record<Slot, B>> = {};
  for (const [slot, value] of Object.entries(record) as [Slot, A | undefined][]) {
    if (value !== undefined) {out[slot] = f(value);}
  }
  return out;
}

function heroToSaved(hero: Hero): SavedHero {
  return {
    ...hero,
    alloc: { ...hero.alloc },
    equipment: mapSlots(hero.equipment, (item) => item.id),
    levels: { ...hero.levels },
    pack: hero.pack.map((o) => ({ id: o.item.id, level: o.level })),
    baseSpells: [...hero.baseSpells],
    missedScrolls: [...hero.missedScrolls],
    burn: hero.burn ? { ...hero.burn } : null,
    pacts: [...hero.pacts],
  };
}

function heroFromSaved(saved: SavedHero): Hero {
  return {
    ...heroToSaved({ ...saved, equipment: {}, pack: [] }),
    equipment: mapSlots(saved.equipment, itemById),
    pack: saved.pack.map((o) => ({ item: itemById(o.id), level: o.level })),
  };
}

function nodeToSaved(node: SavedNode): SavedNode {
  const base: SavedNode = { type: node.type, links: [...node.links], cleared: node.cleared };
  const foe = node.enemyId === undefined ? base : { ...base, enemyId: node.enemyId };
  return node.affixes ? { ...foe, affixes: [...node.affixes] } : foe;
}

function nodeFromSaved(node: SavedNode, stage: number, slot: number): LiveNode {
  const live: LiveNode = { type: node.type, stage, slot, links: [...node.links], cleared: node.cleared, enemyId: node.enemyId };
  return node.affixes ? { ...live, affixes: [...node.affixes] } : live;
}

const copyPlan = (plan: ActPlan): ActPlan => JSON.parse(JSON.stringify(plan)) as ActPlan;
const copyStep = (step: SavedStep): SavedStep => (step.at === 'PACT' ? { at: 'PACT', offers: [...step.offers] } : { ...step });

export function toSaved(live: RunSnapshot): SavedRun {
  const { map } = live;
  return {
    version: SAVE_VERSION,
    hero: heroToSaved(live.hero),
    run: { ...live.run },
    depthPlan: live.depthPlan.map(copyPlan),
    map: { stages: map.stages.map((stage) => stage.map(nodeToSaved)), curStage: map.curStage, reachable: [...map.reachable], cursor: map.cursor },
    step: copyStep(live.step),
    rng: live.rng >>> 0,
  };
}

export function fromSaved(saved: SavedRun): RunSnapshot {
  const { map } = saved;
  return {
    hero: heroFromSaved(saved.hero),
    run: { ...saved.run },
    depthPlan: saved.depthPlan.map(copyPlan),
    map: {
      stages: map.stages.map((stage, s) => stage.map((node, i) => nodeFromSaved(node, s, i))),
      curStage: map.curStage, reachable: [...map.reachable], cursor: map.cursor,
    },
    step: copyStep(saved.step),
    rng: saved.rng,
  };
}

export const saveRun = (live: RunSnapshot): string => JSON.stringify(toSaved(live));

function readSaved(value: unknown): SavedRun {
  const f = record(value, 'save');
  if (f.version !== SAVE_VERSION) {fail('save: wrong version');}
  const map = readMap(f.map);
  const depthPlan = readDepthPlan(list(f.depthPlan, 'depthPlan', 8));
  return {
    version: SAVE_VERSION, hero: readHero(f.hero), run: readCounters(f.run), depthPlan,
    map, step: readStep(f.step, map), rng: int(f.rng, 'rng', RNG_STATE),
  };
}

export function loadRun(text: string): SavedRun | null {
  try {
    const data: unknown = JSON.parse(text);
    return readSaved(data);
  } catch {
    return null;
  }
}

export function describeSave(saved: SavedRun): string {
  const { n } = saved.run;
  const biome = BIOMES[planOf(saved.depthPlan, n).biomeIndex];
  return `DEPTH ${String(depthOf(n))} ACT ${String(actInDepth(n) + 1)}  ${biome?.name ?? ''}`.trimEnd();
}
