import { AFFIX_IDS, RARITIES } from '../types';
import type { BattleState, Burn, EnemyInstance, MoveId, Rarity } from '../types';
import { ENEMIES } from '../data';
import { eventById } from './events';
import { fail, flag, idList, int, knownKey, num, oneOf, record, SCALED as STAT } from './save-check';
import type { Bounds, Fields } from './save-check';

export type SavedFoe = Omit<EnemyInstance, 'def'> & { id: string };
export type SavedBattleState = Omit<BattleState, 'enemy'>;
export interface SavedBattle { roomSeed: number; foe: SavedFoe; state: SavedBattleState }
export type RewardSource = 'FIGHT' | 'ELITE' | 'BOSS' | 'EVENT';
export interface RoomExtras { roomSeed?: number; eventId?: string; battle?: SavedBattle }
export interface RewardStep { at: 'REWARD'; stage: number; slot: number; roomSeed: number; source: RewardSource; earned: number; gift?: Rarity }

const MOVES: readonly MoveId[] = ['STRIKE', 'WINDUP', 'HEAVY', 'WARD', 'SCORCH', 'MEND'];
const SCOPES = ['ATTACK', 'SPELL'] as const;
const SOURCES: readonly RewardSource[] = ['FIGHT', 'ELITE', 'BOSS', 'EVENT'];
const RESIST: Bounds = { lo: -1e3, hi: 1e3 };
const SMALL: Bounds = { lo: 0, hi: 99 };
const SEED: Bounds = { lo: 0, hi: 0xffffffff };
const COUNT: Bounds = { lo: 0, hi: 1e6 };
const EARNED: Bounds = { lo: 0, hi: 99 };

function readFoeBurn(value: unknown): Burn | null {
  if (value === null) {return null;}
  const f = record(value, 'foe burn');
  return { perTurn: num(f.perTurn, 'foe burn', STAT), turns: int(f.turns, 'foe burn turns', SMALL) };
}

function readFoe(value: unknown): SavedFoe {
  const f = record(value, 'foe');
  const maxHp = num(f.maxHp, 'foe maxHp', { lo: 1, hi: STAT.hi });
  const foe: SavedFoe = {
    id: knownKey(f.id, 'foe id', ENEMIES),
    hp: num(f.hp, 'foe hp', { lo: 1, hi: maxHp }), maxHp, atk: num(f.atk, 'foe atk', STAT),
    resPhys: num(f.resPhys, 'foe resPhys', RESIST), resMagic: num(f.resMagic, 'foe resMagic', RESIST),
    affixes: idList(f.affixes, 'foe affixes', AFFIX_IDS), burn: readFoeBurn(f.burn),
    wardTurns: int(f.wardTurns, 'foe ward', SMALL), phase: int(f.phase, 'foe phase', { lo: 1, hi: 2 }) === 1 ? 1 : 2,
    cycleIndex: int(f.cycleIndex, 'foe cycle', { lo: -1, hi: 99 }),
    mended: flag(f.mended, 'foe mended'), staggered: flag(f.staggered, 'foe staggered'),
  };
  return f.phaseAt === undefined ? foe : { ...foe, phaseAt: num(f.phaseAt, 'foe phaseAt', { lo: 0, hi: 1 }) };
}

function readState(value: unknown): SavedBattleState {
  const f = record(value, 'battle state');
  return {
    rampStacks: int(f.rampStacks, 'ramp', SMALL),
    lastScope: f.lastScope === null ? null : oneOf(f.lastScope, 'lastScope', SCOPES),
    actionsTaken: int(f.actionsTaken, 'actions', { lo: 0, hi: 1e6 }),
    intent: oneOf(f.intent, 'intent', MOVES),
    guarding: flag(f.guarding, 'guarding'), guardChain: int(f.guardChain, 'guardChain', SMALL),
    riposte: flag(f.riposte, 'riposte'), aegis: num(f.aegis, 'aegis', { lo: 0, hi: 1 }),
    calm: int(f.calm, 'calm', COUNT), foeMark: num(f.foeMark, 'foeMark', STAT), turn: int(f.turn, 'turn', COUNT),
  };
}

function readBattle(value: unknown): SavedBattle {
  const f = record(value, 'battle');
  return { roomSeed: int(f.roomSeed, 'roomSeed', SEED), foe: readFoe(f.foe), state: readState(f.state) };
}

function readEventId(value: unknown): string {
  const event = typeof value === 'string' ? eventById(value) : undefined;
  if (!event) {fail(`eventId: unknown "${String(value)}"`);}
  return event.id;
}

export function readRoomExtras(f: Fields): RoomExtras {
  return {
    ...(f.roomSeed === undefined ? {} : { roomSeed: int(f.roomSeed, 'roomSeed', SEED) }),
    ...(f.eventId === undefined ? {} : { eventId: readEventId(f.eventId) }),
    ...(f.battle === undefined ? {} : { battle: readBattle(f.battle) }),
  };
}

export function readRewardStep(f: Fields, spot: { stage: number; slot: number }): RewardStep {
  const step: RewardStep = {
    at: 'REWARD', ...spot, roomSeed: int(f.roomSeed, 'roomSeed', SEED),
    source: oneOf(f.source, 'reward source', SOURCES), earned: int(f.earned, 'earned', EARNED),
  };
  return f.gift === undefined ? step : { ...step, gift: oneOf(f.gift, 'gift', RARITIES) };
}

const copyFoe = (foe: SavedFoe): SavedFoe => ({ ...foe, affixes: [...foe.affixes], burn: foe.burn ? { ...foe.burn } : null });

export function copyRoomExtras(extras: RoomExtras): RoomExtras {
  const { battle } = extras;
  return battle ? { ...extras, battle: { roomSeed: battle.roomSeed, foe: copyFoe(battle.foe), state: { ...battle.state } } } : { ...extras };
}
