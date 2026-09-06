// Ember Quest v3 — screens/run.ts: the ADAPTER between the interactive run
// seam (game/sim/runstep.ts's `createRun`) and the screens. Phase 6a replaced
// the phase-4 slice this file used to BE — a hard-coded five-room ladder with
// its own party, its own pack draw and its own re-implementation of the heal,
// the score and the pity counter — with the real run: `createRun(config, rng)`
// walks game/sim/run.ts's generator and stops on one `RunPending` at a time.
// Nothing in here decides anything any more. It:
//
//   1. keeps the `RunScreen` interface screens/cards.ts consumes
//      (state()/cards()/pick()/skip()/enterRoom()/beginBattle()/afterBattle()),
//      so the room card and the relic-card flow did not have to be rewritten;
//   2. holds the ROOM CARD — the one piece of presentation the seam has no
//      pending for. Routing answers the ROUTE pending and the run walks
//      straight into the room, so the card is raised here, over whatever
//      pending the room arrived at, and dismissed by CONTINUE;
//   3. records every answer for the dev replay log (__eq.decisions()).
//
// Legality is NOT here (SURFACE.md's rule): any answer at all may be handed to
// `answer()`; an illegal one travels into game/sim/run.ts untouched and that
// decision's own documented fallback decides it. This file re-derives no rule —
// it draws what a pending carries and sends back what the player picked.
//
// DESIGN.md → Run structure, Between battles, Relics, The Vault.

import type { Battle } from '../sim/battle';
import type {
  BattleResult, Biome, LootSource, Party, Relic, Rng, RoomType, RunConfig, RunResult,
} from '../types';
import { ENEMIES, ROSTER } from '../data';
import { createRun } from '../sim/runstep';
import type { Run, RunView } from '../sim/runstep';
import type { RunPending, RunPendingKind } from '../sim/run';

/**
 * What the frame is showing. The engine's own scene machine stays the enforced
 * five (main.ts); this is the finer phase inside PLAYING, and it is DERIVED —
 * `pending()?.kind` decides it, never a variable this file advances.
 *
 * ROOM   the room card (this file's own, above the room's real pending)
 * CARDS  a RELIC pending — screens/cards.ts's offer + who-wears-it flow
 * BATTLE a BATTLE pending, card dismissed — screens/battle.ts owns the frame
 * SCREEN any other pending — main.ts routes it to draft/map/party/node/vault
 */
export type RunPhase = 'ROOM' | 'BATTLE' | 'CARDS' | 'SCREEN' | 'GAME_OVER' | 'VICTORY';

/** What the room-to-room card (screens/cards.ts) shows before a room resolves. */
export interface RoomCard {
  title: string;
  biome: string;
  blurb: string;
}

/** One answered decision, JSON-safe, for `__eq.decisions()` and a headless replay. */
export interface RunDecision {
  kind: RunPendingKind;
  answer: unknown;
}

export interface RunState {
  phase: RunPhase;
  room: RoomType;
  roomIndex: number;
  roomCard: RoomCard;
  party: Party;
  score: number;
  /** Rooms fully resolved: every room walked into, less the one the run died in. */
  roomsCleared: number;
  cardSource: LootSource | null;
  /** GAME_OVER only: who landed the killing blow (or RETREAT for a forfeit). */
  deathBy: string;
}

export interface RunScreen {
  // ---- the interface screens/cards.ts consumes, unchanged from phase 4 ----
  state(): Readonly<RunState>;
  readonly rooms: readonly RoomType[];
  readonly roomIndex: number;
  readonly score: number;
  /** Dismisses the room card: the room's own pending takes the frame. */
  enterRoom(): void;
  /** FIGHT/ELITE/BOSS only: the seam's already-built Battle, for the battle screen's begin(). */
  beginBattle(): Battle;
  /** The battle screen's finished result, answered into the seam (forfeit tag included). */
  afterBattle(result: BattleResult): void;
  /** The current RELIC offer. */
  cards(): Relic[];
  /** Equips cards()[cardIndex] onto party.members[memberIndex] — the seam does the equipping. */
  pick(cardIndex: number, memberIndex: number): void;
  /** Declines the offer: the seam's own SKIP_MEND. */
  skip(): void;

  // ---- the seam, for main.ts's router ----
  view(): RunView;
  pending(): RunPending | null;
  /**
   * Opens a tick: records the token the screens about to run are answering
   * AGAINST. Call it once per tick, immediately before the screen that owns the
   * frame updates (main.ts does). It is what makes a second answer inside the
   * same tick — a double tap, a handler that fires after the run already
   * moved — a no-op instead of an answer to the NEXT decision.
   */
  armTick(): void;
  /** Answers the open pending with anything at all; run.ts's fallback catches an illegal answer.
   * Returns whether it landed (false on a stale token, or once the run is over). */
  answer(answer: unknown): boolean;
  /** A ROUTE answer, plus raising this file's room card over whatever the room arrived at. */
  route(choice: number): void;
  result(): RunResult | null;
  /** The act's biome — the diorama main.ts bakes, and the room card's second line. */
  biome(): Biome;
  /** The node taken at each stage of the act so far, stage order — the path the map draws behind the party. */
  taken(): readonly number[];
  /** Every answer given, in order — dev replay (`__eq.decisions()`). */
  decisions(): readonly RunDecision[];
}

/** One shared empty offer, so "no cards" is a stable identity too (see `cards()`). */
const NO_CARDS: Relic[] = [];

function packNames(ids: readonly string[]): string {
  return ids.map((id) => ENEMIES[id]?.name ?? id).join(' & ');
}

/**
 * The room card for all nine room types (phase 4 knew three). A battle room
 * names its pack — the BATTLE pending is already standing when this is built,
 * so the names come off the seam rather than out of a second draw.
 */
export function roomCardFor(room: RoomType | null, biome: string, packIds: readonly string[] | null): RoomCard {
  const names = packIds && packIds.length > 0 ? packNames(packIds) : 'Something';
  switch (room) {
    case 'FIGHT': return { title: 'FIGHT', biome, blurb: `${names} block the way ahead.` };
    case 'ELITE': return { title: 'ELITE', biome, blurb: `${names} hold this ground, and know it.` };
    case 'BOSS': return { title: 'BOSS', biome, blurb: `${names} guards the heart of this place.` };
    case 'LOOT': return { title: 'TREASURE', biome, blurb: 'An old cache glints in the dark.' };
    case 'REST': return { title: 'REST', biome, blurb: 'A dry corner and a little quiet: bind wounds, or sharpen steel.' };
    case 'SHRINE': return { title: 'SHRINE', biome, blurb: 'A pact waits on the stone, curse and boon in one breath.' };
    case 'FORGE': return { title: 'FORGE', biome, blurb: 'A cold anvil, hot enough yet for one relic.' };
    case 'SUMMON': return { title: 'SUMMON', biome, blurb: 'Someone waits at the crossroads, and is looking your way.' };
    case 'ALTAR': return { title: 'ALTAR', biome, blurb: 'The altar remembers a name. Speak one.' };
    default: return { title: 'THE WAY ON', biome, blurb: 'The path runs on into the dark.' };
  }
}

/**
 * The name for GAME_OVER. The seam's own `deathBy` first — but it is usually
 * empty under an interactive battle, and that is not a bug in the seam:
 * `findDeathBy` scans `battle.events`, and screens/battle.ts DRAINS that log
 * into its playback queue inside the very call that fills it (runTurn ->
 * schedulePlayback), so nothing outside the screen ever sees a battle event.
 * The pack the party was fighting is the honest second answer, and the one
 * phase 4 gave; a wipe with neither (a stall, a BURN tick) gets a phrase rather
 * than an empty line.
 */
function killerName(deathBy: string, pack: readonly string[]): string {
  if (deathBy) return ENEMIES[deathBy]?.name ?? deathBy;
  return pack.length > 0 ? packNames(pack) : 'THE DARK';
}

/** A RunConfig for a fresh run: the full roster, and whatever the Vault screen handed back. */
export function runConfig(o: Partial<RunConfig> = {}): RunConfig {
  return {
    ascension: o.ascension ?? 0,
    vault: o.vault ?? [],
    vaultSlots: o.vaultSlots ?? 0,
    roster: o.roster ?? [...ROSTER],
    ...(o.spdDelta !== undefined ? { spdDelta: o.spdDelta } : {}),
  };
}

export function createRunScreen(rng: Rng, config: RunConfig = runConfig()): RunScreen {
  const run: Run = createRun(config, rng);
  const decisions: RunDecision[] = [];
  /** The room card is up: raised by route(), dropped by enterRoom(). */
  let roomCardUp = false;
  let roomCard: RoomCard = roomCardFor(null, '', null);
  /** The token every answer this tick is answering against — see `armTick`. */
  let armedToken: number | null = null;
  /**
   * The current offer, as ONE array for as long as the RELIC pending stands.
   * screens/cards.ts tells "a new offer" from "the same offer again" by
   * IDENTITY (`offer !== lastOffer` is what resets which card is being placed),
   * so handing back a fresh copy each frame would drop the player's pick every
   * tick and the who-wears-it row could never open.
   */
  let offerCache: { pending: RunPending; list: Relic[] } | null = null;
  /** A forfeit outranks whatever the sim credits the death to: the player walked away. */
  let forfeited = false;
  /** The pack of the last battle fought — the end screen's fallback name (see `killerName`). */
  let lastPack: readonly string[] = [];

  function battlePending(): Extract<RunPending, { kind: 'BATTLE' }> | null {
    const p = run.pending();
    return p && p.kind === 'BATTLE' ? p : null;
  }
  function relicPending(): Extract<RunPending, { kind: 'RELIC' }> | null {
    const p = run.pending();
    return p && p.kind === 'RELIC' ? p : null;
  }

  /** BATTLE answers carry a whole BattleResult and a live Battle; the log keeps a JSON-safe summary instead. */
  function loggable(kind: RunPendingKind, a: unknown): unknown {
    if (kind !== 'BATTLE') return a;
    const b = a as { result?: BattleResult; forfeit?: boolean } | null;
    return { won: b?.result?.won === true, forfeit: b?.forfeit === true, turns: b?.result?.actorTurns ?? 0 };
  }

  /**
   * The one mover. The token this tick was armed with rides along, so a second
   * answer inside the same tick is refused by the seam rather than landing on
   * whatever decision came next (the seam's own worked example: a double tap at
   * the DRAFT feeding the draft's index into the opening SUMMON behind it).
   */
  function answer(a: unknown): boolean {
    const p = run.pending();
    if (!p) return false;
    const landed = run.decide(a, armedToken ?? run.token());
    if (landed) decisions.push({ kind: p.kind, answer: loggable(p.kind, a) });
    return landed;
  }

  function phase(): RunPhase {
    const done = run.result();
    if (done) return done.won ? 'VICTORY' : 'GAME_OVER';
    if (roomCardUp) return 'ROOM';
    const p = run.pending();
    if (!p) return 'SCREEN';
    if (p.kind === 'BATTLE') return 'BATTLE';
    if (p.kind === 'RELIC') return 'CARDS';
    return 'SCREEN';
  }

  return {
    view: () => run.state(),
    pending: () => run.pending(),
    result: () => run.result(),
    armTick() { armedToken = run.token(); },
    answer,
    decisions: () => decisions,
    /** The seam's own trail for this act, flattened to one node index per stage. */
    taken() {
      const out: number[] = [];
      for (const step of run.state().path) out[step.stage] = step.nodeIdx;
      return out;
    },
    biome: () => run.state().biome,

    state(): Readonly<RunState> {
      const v = run.state();
      const done = run.result();
      const rooms = v.rooms;
      return {
        phase: phase(),
        room: v.roomType ?? 'FIGHT',
        roomIndex: Math.max(0, rooms.length - 1),
        roomCard,
        party: v.party,
        score: v.score,
        roomsCleared: done && !done.won ? Math.max(0, rooms.length - 1) : rooms.length,
        cardSource: relicPending()?.source ?? null,
        deathBy: forfeited ? 'RETREAT' : killerName(v.deathBy, lastPack),
      };
    },
    get rooms() { return run.state().rooms; },
    get roomIndex() { return Math.max(0, run.state().rooms.length - 1); },
    get score() { return run.state().score; },

    /**
     * A ROUTE answer. The seam walks the whole room the moment it lands — the
     * pack is spawned, the pact is drawn, the cards are rolled — and stops on
     * that room's own pending, so the card is built AFTER the answer (that is
     * where the pack names come from) and gates the room's screen until
     * CONTINUE.
     */
    route(choice: number) {
      if (!answer(choice)) return;
      const v = run.state();
      roomCard = roomCardFor(v.roomType, v.biome.name, battlePending()?.packIds ?? null);
      roomCardUp = true;
    },

    enterRoom() {
      roomCardUp = false;
    },

    beginBattle(): Battle {
      const p = battlePending();
      if (!p) throw new Error('beginBattle: the run is not standing on a BATTLE pending');
      return p.battle;
    },

    afterBattle(result: BattleResult) {
      const forfeit = (result as unknown as { forfeit?: boolean }).forfeit === true;
      if (forfeit) forfeited = true;
      lastPack = battlePending()?.packIds ?? lastPack;
      answer({ result, forfeit });
    },

    cards(): Relic[] {
      const p = relicPending();
      if (!p) { offerCache = null; return NO_CARDS; }
      if (!offerCache || offerCache.pending !== p) offerCache = { pending: p, list: [...p.cards] };
      return offerCache.list;
    },

    pick(cardIndex: number, memberIndex: number) {
      answer({ card: cardIndex, onto: memberIndex });
    },

    skip() {
      answer(null);
    },
  };
}
