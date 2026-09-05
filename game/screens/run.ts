// Ember Quest v3 — screens/run.ts: the phase-4 slice run as a state machine
// over the sim. Party = EMBER, GALE, TIDE (leader EMBER) at base stats, an
// empty relic set and a per-run set pool; rooms FIGHT · FIGHT · LOOT · FIGHT ·
// BOSS in the EMBER CRYPT. Owns score, the party's HP and relics between
// battles, and the loot-card flow; screens/cards.ts, title.ts and end.ts
// render what state() reports and drive the room/card/skip calls below.
// DESIGN.md → Run structure, Between battles, Relics, Delivery phases → 4.
//
// Lives under game/screens/ (not the headless sim), but never calls
// Math.random itself: main.ts hands it the same rng the sim's own rolling
// functions take last.

import type { Battle, BattleCtx } from '../sim/battle';
import { createBattle, POLICY_ACTS, spawnPack } from '../sim/battle';
import type {
  Biome, BattleResult, EnemyId, LootSource, PactId, Party, PartyMember, Relic, Rng, RoomType,
} from '../types';
import {
  BOSS_ENTRY_HEAL, CLEAR_HEAL, FIGHT_DROP_CHANCE, KO_RETURN, PITY_AFTER, ROOM_SCORE, SKIP_MEND,
} from '../types';
import { BIOMES, CHARACTERS, ENEMIES, SLICE_PARTY } from '../data';
import { cardCount, derive, equip, rollCards, rollSetPool } from '../sim/relics';
import type { DeriveCtx, RollCtx } from '../sim/relics';
import { chance, pick } from '../sim/rng';

/** The slice's fixed biome, room order and context — a full run (phase 6a) threads act/lap/ascension/pacts through instead. */
export const RUN_BIOME: Biome = BIOMES[0];
type SliceRoom = 'FIGHT' | 'LOOT' | 'BOSS';
const ROOMS: readonly SliceRoom[] = ['FIGHT', 'FIGHT', 'LOOT', 'FIGHT', 'BOSS'];
const ACT = 1;
const LAP = 1;
const ASCENSION = 0;
const PACTS: readonly PactId[] = [];

export type RunPhase = 'ROOM' | 'BATTLE' | 'CARDS' | 'GAME_OVER' | 'VICTORY';

/** What the room-to-room card (screens/cards.ts) shows before a room resolves. */
export interface RoomCard {
  title: string;
  biome: string;
  blurb: string;
}

export interface RunState {
  phase: RunPhase;
  room: RoomType;
  roomIndex: number;
  roomCard: RoomCard;
  party: Party;
  score: number;
  /** Rooms fully resolved: roomIndex while still running, every room at VICTORY. */
  roomsCleared: number;
  cardSource: LootSource | null;
  /** GAME_OVER only: who landed the killing blow. */
  deathBy: string;
}

export interface RunScreen {
  state(): Readonly<RunState>;
  readonly rooms: readonly RoomType[];
  readonly roomIndex: number;
  readonly score: number;
  /** Commits to the room now on screen: BOSS_ENTRY_HEAL and arms its already-drawn pack, or rolls a LOOT room's cards. */
  enterRoom(): void;
  /** FIGHT/BOSS only, once enterRoom() has armed a pack: the sim battle object for the battle screen's begin(). */
  beginBattle(): Battle;
  /** The battle screen's finished result: the post-battle order, then this room's cards (or straight to the next room on a dropless FIGHT). */
  afterBattle(result: BattleResult): void;
  /** The current CARDS-phase offer. */
  cards(): Relic[];
  /** Equips cards()[cardIndex] onto party.members[memberIndex], then resolves the room. */
  pick(cardIndex: number, memberIndex: number): void;
  /** Declines every card this screen offered: SKIP_MEND, then resolves the room. */
  skip(): void;
}

function packNames(ids: readonly EnemyId[]): string {
  return ids.map((id) => ENEMIES[id]?.name ?? id).join(' & ');
}

/** DESIGN.md → Run structure: a FIGHT/BOSS entry draws uniformly among packs of width <= members + 1; BOSS is always [boss]. */
function drawPack(room: 'FIGHT' | 'BOSS', memberCount: number, rng: Rng): EnemyId[] {
  if (room === 'BOSS') return [RUN_BIOME.boss];
  const width = memberCount + 1;
  const options = RUN_BIOME.fights.filter((p) => p.length <= width);
  return options[pick(options.length, rng)] ?? RUN_BIOME.fights[0];
}

function roomCardFor(room: SliceRoom, pack: readonly EnemyId[] | null): RoomCard {
  const biome = RUN_BIOME.name;
  if (room === 'LOOT') return { title: 'TREASURE', biome, blurb: 'An old cache glints in the dark.' };
  const names = pack ? packNames(pack) : 'Something';
  return room === 'BOSS'
    ? { title: 'BOSS', biome, blurb: `${names} guards the crypt's heart.` }
    : { title: 'FIGHT', biome, blurb: `${names} block the crypt ahead.` };
}

/** A run-scoped relic id counter — DESIGN.md: "a run-scoped counter, never rng." */
function makeIdCounter(): () => string {
  let n = 0;
  return () => `slice-${n++}`;
}

function freshParty(): Party {
  const members: PartyMember[] = SLICE_PARTY.map((id) => ({ def: CHARACTERS[id], hp: 0, relics: {}, awakened: false }));
  const party: Party = { members, leader: 0 };
  const ctx: DeriveCtx = { leader: party.members[0].def.leader, pacts: PACTS };
  for (const m of party.members) m.hp = derive(m, ctx).HP;
  return party;
}

/** DESIGN.md's map heal: hp = min(maxHp, hp + round(maxHp * f)), every currently-living member. */
function mapHeal(party: Party, ctx: DeriveCtx, fraction: number): void {
  for (const m of party.members) {
    if (m.hp <= 0) continue;
    const maxHp = derive(m, ctx).HP;
    m.hp = Math.min(maxHp, m.hp + Math.round(maxHp * fraction));
  }
}

/** Best-effort killer name for GAME_OVER: a `deathBy` the battle result carries, else the pack that beat the party. */
function killerName(result: BattleResult, pack: readonly EnemyId[]): string {
  const withDeath = result as unknown as { deathBy?: string };
  const raw = withDeath.deathBy;
  if (raw) return ENEMIES[raw]?.name ?? raw;
  return packNames(pack);
}

export function createRunScreen(rng: Rng): RunScreen {
  const party = freshParty();
  const pool = rollSetPool([], rng);
  const nextId = makeIdCounter();
  const deriveCtx: DeriveCtx = { leader: party.members[party.leader].def.leader, pacts: PACTS };
  const rollCtx: RollCtx = { act: ACT, lap: LAP, ascension: ASCENSION, pool, pacts: PACTS, nextId };
  const rollRoomCards = (source: LootSource): Relic[] => rollCards(source, cardCount(source, PACTS), rollCtx, rng);

  let phase: RunPhase = 'ROOM';
  let roomIndex = 0;
  let room: SliceRoom = ROOMS[0];
  let pack: EnemyId[] | null = null;
  let roomCard: RoomCard = roomCardFor(room, null);
  let score = 0;
  let clearsThisAct = 0;
  let dryCount = 0;
  let cards: Relic[] = [];
  let cardSource: LootSource | null = null;
  let deathBy = '';

  function armRoom(index: number): void {
    roomIndex = index;
    room = ROOMS[index];
    pack = room === 'LOOT' ? null : drawPack(room, party.members.length, rng);
    roomCard = roomCardFor(room, pack);
    cards = [];
    cardSource = null;
    phase = 'ROOM';
  }
  armRoom(0);

  /** After a CARDS offer is picked or declined: the next room, or VICTORY once the boss's is resolved. */
  function resolveRoom(): void {
    if (room === 'BOSS') { phase = 'VICTORY'; return; }
    if (roomIndex + 1 < ROOMS.length) armRoom(roomIndex + 1);
  }

  return {
    state() {
      const roomsCleared = phase === 'VICTORY' ? ROOMS.length : roomIndex;
      return { phase, room, roomIndex, roomCard, party, score, roomsCleared, cardSource, deathBy };
    },
    rooms: ROOMS,
    get roomIndex() { return roomIndex; },
    get score() { return score; },

    enterRoom() {
      if (room === 'BOSS') mapHeal(party, deriveCtx, BOSS_ENTRY_HEAL);
      if (room === 'LOOT') {
        cardSource = 'LOOT';
        cards = rollRoomCards('LOOT');
        phase = 'CARDS';
      } else {
        phase = 'BATTLE';
      }
    },

    beginBattle(): Battle {
      const enemies = spawnPack(pack ?? [], ACT, LAP, ASCENSION, clearsThisAct, PACTS);
      const battleCtx: BattleCtx = { pacts: PACTS, ascension: ASCENSION, act: ACT, lap: LAP };
      // Heroes are player-controlled through the interactive battle screen; POLICY_ACTS.balanced
      // is a placeholder ActPolicy for the type only — createBattle's own turn loop resolves a
      // hero's actual action from the screen's skill-bar/target input, not this fallback.
      return createBattle(party, enemies, { act: POLICY_ACTS.balanced }, rng, battleCtx);
    },

    afterBattle(result: BattleResult) {
      for (let i = 0; i < party.members.length; i++) {
        const updated = result.party.members[i];
        if (updated) party.members[i].hp = updated.hp;
      }
      if (!result.won) {
        deathBy = killerName(result, pack ?? []);
        phase = 'GAME_OVER';
        return;
      }
      const actNumber = ACT; // 6 * (LAP - 1) + ACT; LAP is fixed at 1 for the slice
      score += (ROOM_SCORE[room] ?? 0) * actNumber;
      for (const m of party.members) {
        if (m.hp > 0) continue;
        m.hp = Math.round(derive(m, deriveCtx).HP * KO_RETURN);
      }
      mapHeal(party, deriveCtx, CLEAR_HEAL);

      if (room === 'FIGHT') {
        clearsThisAct += 1;
        const dropped = chance(FIGHT_DROP_CHANCE, rng) || dryCount >= PITY_AFTER;
        if (!dropped) {
          dryCount += 1;
          resolveRoom();
          return;
        }
        dryCount = 0;
        cardSource = 'FIGHT';
        cards = rollRoomCards('FIGHT');
        phase = 'CARDS';
        return;
      }
      cardSource = 'BOSS'; // three cards, the first forced EPIC — rollCards(source='BOSS', ...) handles the force
      cards = rollRoomCards('BOSS');
      phase = 'CARDS';
    },

    cards() { return cards; },

    pick(cardIndex: number, memberIndex: number) {
      const relic = cards[cardIndex];
      const member = party.members[memberIndex];
      if (!relic || !member) return;
      equip(member, relic, deriveCtx);
      resolveRoom();
    },

    skip() {
      mapHeal(party, deriveCtx, SKIP_MEND);
      resolveRoom();
    },
  };
}
