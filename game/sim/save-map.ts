import { AFFIX_IDS, PACT_IDS } from '../types';
import { ENEMIES } from '../data';
import { fail, flag, idList, int, knownKey, list, oneOf, record } from './save-check';
import type { Fields } from './save-check';
import { MAX_SLOTS, MAX_STAGES, ROOM_TYPES } from './save-read';
import type { SavedMap, SavedNode, SavedStep } from './save-read';

const INDEX = { lo: 0, hi: MAX_SLOTS - 1 };

function nodeExtras(f: Fields): Partial<SavedNode> {
  return {
    ...(f.enemyId === undefined ? {} : { enemyId: knownKey(f.enemyId, 'enemyId', ENEMIES) }),
    ...(f.affixes === undefined ? {} : { affixes: idList(f.affixes, 'affixes', AFFIX_IDS) }),
  };
}

function readNode(value: unknown, nextSize: number): SavedNode {
  const f = record(value, 'node');
  const links = list(f.links, 'links', MAX_SLOTS).map((v) => int(v, 'link', { lo: 0, hi: nextSize - 1 }));
  return { type: oneOf(f.type, 'room', ROOM_TYPES), links, cleared: flag(f.cleared, 'cleared'), ...nodeExtras(f) };
}

function readStages(value: unknown): SavedNode[][] {
  const raw = list(value, 'stages', MAX_STAGES).map((stage) => list(stage, 'stage', MAX_SLOTS));
  if (raw.length === 0 || raw.some((stage) => stage.length === 0)) {fail('stages: empty');}
  return raw.map((stage, s) => stage.map((node) => readNode(node, raw[s + 1]?.length ?? 0)));
}

export function readMap(value: unknown): SavedMap {
  const f = record(value, 'map');
  const stages = readStages(f.stages);
  const curStage = int(f.curStage, 'curStage', { lo: -1, hi: stages.length - 1 });
  const nextSize = stages[curStage + 1]?.length ?? 0;
  const reachable = list(f.reachable, 'reachable', MAX_SLOTS).map((v) => int(v, 'reachable', { lo: 0, hi: nextSize - 1 }));
  return { stages, curStage, reachable, cursor: int(f.cursor, 'cursor', INDEX) };
}

type StepAt = SavedStep['at'];
const STEP_AT: readonly StepAt[] = ['MAP', 'ROOM', 'THRESHOLD', 'PACT'];

function readRoomStep(f: Fields, map: SavedMap): SavedStep {
  const stage = int(f.stage, 'step stage', { lo: 0, hi: map.stages.length - 1 });
  const slot = int(f.slot, 'step slot', { lo: 0, hi: (map.stages[stage]?.length ?? 0) - 1 });
  return { at: 'ROOM', stage, slot };
}

function readPactStep(f: Fields): SavedStep {
  const offers = idList(f.offers, 'pact offers', PACT_IDS);
  if (offers.length === 0) {fail('pact offers: none');}
  return { at: 'PACT', offers };
}

const STEP_READERS: Record<StepAt, (f: Fields, map: SavedMap) => SavedStep> = {
  MAP: () => ({ at: 'MAP' }),
  ROOM: readRoomStep,
  THRESHOLD: () => ({ at: 'THRESHOLD' }),
  PACT: readPactStep,
};

export function readStep(value: unknown, map: SavedMap): SavedStep {
  const f = record(value, 'step');
  return STEP_READERS[oneOf(f.at, 'step', STEP_AT)](f, map);
}
