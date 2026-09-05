// Ember Quest v3 — sim/run.ts: the map, rooms, loot, laps, ascension, the
// Vault as data, the policies and `simulateRun`. Headless: no engine, no DOM,
// no localStorage, no Math.random — every draw is a ./rng primitive, in
// exactly DESIGN.md's order, `rng` always last, so a seed reproduces a
// RunResult bit for bit. DESIGN.md → Run structure, Difficulty targets.
//
// Sections: the map (buildMap) · fresh members & awakening · SUMMON offers ·
// battle running & deathBy · room resolvers (FIGHT/ELITE/BOSS, REST, LOOT,
// SHRINE, FORGE, SUMMON, ALTAR) · the Vault (equip in, bank out) · policies
// (random, then the balanced family) · simulateRun.

import type {
  ActOption, Actor, AscensionRow, BattleResult, BattleView, Biome, CharacterDef, Element, PactId, Party,
  PartyMember, Policy, Probe, Rarity, Relic, RelicStat, RoomType, RunConfig, RunResult, RunState, SetId, Slot,
  SummonOffer, Rng,
} from '../types';
import {
  ACTS, BANK_DEATH, BANK_WIN, BOSS_ENTRY_HEAL, CLEAR_HEAL, ELITE_ENTER_AT, FIGHT_DROP_CHANCE,
  KO_RETURN, LANDMARKS, LANDMARK_STAGE, PARTY_MAX, PITY_AFTER, REST_HEAL_AT, ROOM_SCORE, ROOM_WEIGHTS,
  SCORE_ASCENSION, SKIP_MEND, SLOTS, STAGE_SIZES, SUMMON_OFFERS, SWAP_FRESH, VAULT_SIZE,
} from '../types';
import { ASCENSION } from '../data/ascension';
import { CHARACTERS, ROSTER } from '../data/characters';
import { BIOMES, ENEMIES } from '../data/enemies';
import { PACTS, PACT_IDS } from '../data/pacts';
import { SKILLS } from '../data/skills';
import { SETS } from '../data/sets';
import { chance, pick, weighted, withoutReplacement } from './rng';
import { createBattle, isOver, matchup, nextReady, runTurn, spawnPack, battleOutcome, POLICY_ACTS } from './battle';
import type { ActFn, ActPolicy, Battle, BattleCtx, BattleEvent } from './battle';
import {
  cardCount, compare, derive, equip, forge, forgeOptions, isCapped, mainsWorn, partyWorn,
  rebrandSets, refitHp, relicLevels, rollCards, rollRelic, rollSetPool, setsWorn, sharpenCandidates, sharpenMember, wornRelics,
} from './relics';
import type { DeriveCtx, ForgeCtx, ForgeChoice, RollCtx } from './relics';

// ================================================================ run ctx ==
/** simulateRun's own mutable, run-scoped bookkeeping — a superset of the public RunState a Policy sees. */
interface Ctx {
  config: RunConfig;
  policy: Policy;
  rng: Rng;
  party: Party;
  ascension: number;
  ascRow: AscensionRow;
  pactsTaken: PactId[];
  pool: SetId[];
  score: number;
  act: number;
  lap: number;
  /** FIGHT/ELITE clears so far this act — CLEAR_GROWTH's counter, reset per act. */
  clearsThisAct: number;
  /** FIGHT/ELITE clears over the whole run — RunResult.clears, never reset. */
  totalClears: number;
  /** Member ids in the order they awakened (ALTAR, or a SUMMON swap inheriting the flag). */
  awakenedLog: string[];
  /** FIGHT rooms since the last card — PITY_AFTER's counter, resets on a card, run-wide. */
  dryStreak: number;
  swaps: number;
  rests: ('HEAL' | 'SHARPEN')[];
  shrines: { pact: PactId; taken: boolean }[];
  rooms: RoomType[];
  turnsPerBattle: number[];
  enrages: number;
  probes: Probe[];
  relicSeq: number;
  actsCleared: number;
}
function deriveCtxFor(ctx: Ctx): DeriveCtx {
  return mkDeriveCtx(ctx.party, ctx.pactsTaken);
}
function rollCtxFor(ctx: Ctx, forced?: Rarity): RollCtx {
  return { act: ctx.act, lap: ctx.lap, ascension: ctx.ascension, pool: ctx.pool, pacts: ctx.pactsTaken, forced, nextId: () => String(ctx.relicSeq++) };
}
function runStateFor(ctx: Ctx): RunState {
  return {
    party: ctx.party, ascension: ctx.ascension, act: ctx.act, lap: ctx.lap, clears: ctx.clearsThisAct,
    vault: ctx.config.vault, vaultSlots: ctx.config.vaultSlots, pactsTaken: [...ctx.pactsTaken],
  };
}
/** score += ROOM_SCORE[type] × actNumber × (1 + SCORE_ASCENSION × ascension); actNumber = ACTS × (lap−1) + act. */
function addScore(ctx: Ctx, type: RoomType): void {
  const per = ROOM_SCORE[type];
  if (!per) return;
  const actNumber = ACTS * (ctx.lap - 1) + ctx.act;
  ctx.score += per * actNumber * (1 + SCORE_ASCENSION * ctx.ascension);
}
/** After a win, in order: KO'd members return at KO_RETURN of max HP and nothing else; living members gain
 * CLEAR_HEAL. (score, the clear counter, the drop roll and cards are the caller's, per room type.) */
function postWinHeal(ctx: Ctx): void {
  const dctx = deriveCtxFor(ctx);
  for (const m of ctx.party.members) {
    const maxHp = derive(m, dctx).HP;
    m.hp = m.hp === 0 ? Math.round(maxHp * KO_RETURN) : Math.min(maxHp, m.hp + Math.round(maxHp * CLEAR_HEAL));
  }
}
/** A relic-card screen's answer: equips the chosen card onto the chosen member, or mends the party SKIP_MEND
 * on any illegal or declined answer (never for a SUMMON, which the caller never routes here). */
function resolveRelicCards(ctx: Ctx, cards: Relic[]): void {
  const dctx = deriveCtxFor(ctx);
  const answer = ctx.policy.relic(cards, ctx.party, ctx.rng);
  const legal = !!answer && Number.isInteger(answer.card) && answer.card >= 0 && answer.card < cards.length &&
    Number.isInteger(answer.onto) && answer.onto >= 0 && answer.onto < ctx.party.members.length;
  if (!legal || !answer) { mendParty(ctx.party, dctx, SKIP_MEND); return; }
  equip(ctx.party.members[answer.onto], cards[answer.card], dctx);
}

// ============================================================ pack drawing ==
function packsOfWidthAtMost(packs: readonly string[][], maxWidth: number): string[][] {
  const fit = packs.filter((p) => p.length <= maxWidth);
  return fit.length > 0 ? fit : [...packs]; // validateData guarantees a <=2-wide pack; this is only a safety net
}
function choosePack(packs: readonly string[][], party: Party, rng: Rng): string[] {
  const eligible = packsOfWidthAtMost(packs, party.members.length + 1);
  return eligible[pick(eligible.length, rng)];
}
/** A8's elite-pack NORMAL: the biome's distinct NORMAL ids, first appearance across `fights` then `elites`. */
function distinctNormals(biome: Biome): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of [...biome.fights, ...biome.elites]) {
    for (const id of row) {
      if (seen.has(id)) continue;
      const def = ENEMIES[id];
      if (def && def.kind === 'NORMAL') { seen.add(id); out.push(id); }
    }
  }
  return out;
}

// ============================================================= battle rooms ==
export interface RoomOutcome { alive: boolean; deathKind: '' | 'WIPE' | 'STALL'; deathBy: string }
function outcomeFromBattle(result: BattleResult, battle: Battle): RoomOutcome {
  if (result.won) return { alive: true, deathKind: '', deathBy: '' };
  if (result.stall) return { alive: false, deathKind: 'STALL', deathBy: battle.enemies[0]?.def.id ?? '' };
  return { alive: false, deathKind: 'WIPE', deathBy: findDeathBy(battle) };
}
/** Runs one battle for a room, records turnsPerBattle/enrages/probes, and — only on a win — scores it, heals
 * (KO/CLEAR_HEAL) and (for FIGHT/ELITE) advances the clear counter. Card rolling is each room's own, after. */
function runRoomBattle(ctx: Ctx, packIds: readonly string[], source: 'FIGHT' | 'ELITE' | 'BOSS'): { outcome: RoomOutcome; battle: Battle } {
  const enemies = spawnPack(packIds, ctx.act, ctx.lap, ctx.ascension, ctx.clearsThisAct, ctx.pactsTaken);
  const battleCtx: BattleCtx = { pacts: ctx.pactsTaken, ascension: ctx.ascension, act: ctx.act, lap: ctx.lap };
  const { result, battle } = runBattleTracked(ctx.party, enemies, toActPolicy(ctx.policy), ctx.rng, battleCtx);
  ctx.turnsPerBattle.push(result.actorTurns);
  if (result.enraged) ctx.enrages += 1;
  if (source === 'BOSS') ctx.probes.push(result.probe); // Probe is "one per boss" (DESIGN.md's RunResult sketch)
  if (result.won) {
    addScore(ctx, source);
    postWinHeal(ctx);
    if (source !== 'BOSS') { ctx.clearsThisAct += 1; ctx.totalClears += 1; }
  }
  return { outcome: outcomeFromBattle(result, battle), battle };
}
/** FIGHT: a pack from `biome.fights`; a card at FIGHT_DROP_CHANCE (drawn even when pity forces it), forced
 * after PITY_AFTER dropless FIGHTs; the streak resets only on a FIGHT card. Also ELITE-played-as-FIGHT. */
function resolveFight(ctx: Ctx, biome: Biome): RoomOutcome {
  const packIds = choosePack(biome.fights, ctx.party, ctx.rng);
  const { outcome } = runRoomBattle(ctx, packIds, 'FIGHT');
  if (!outcome.alive) return outcome;
  const rolled = chance(FIGHT_DROP_CHANCE, ctx.rng);
  if (rolled || ctx.dryStreak >= PITY_AFTER) {
    ctx.dryStreak = 0;
    const cards = rollCards('FIGHT', cardCount('FIGHT', ctx.pactsTaken), rollCtxFor(ctx), ctx.rng);
    resolveRelicCards(ctx, cards);
  } else {
    ctx.dryStreak += 1;
  }
  return outcome;
}
/** ELITE: an elite pack (A8's extra NORMAL folded in), three guaranteed cards, pick one — or, with fewer than
 * three members, played as a FIGHT (pack and rewards) instead. */
function resolveElite(ctx: Ctx, biome: Biome): RoomOutcome {
  if (ctx.party.members.length < PARTY_MAX) return resolveFight(ctx, biome);
  let packIds = choosePack(biome.elites, ctx.party, ctx.rng);
  if (ctx.ascRow.elitePackPlus && packIds.length < 3 && packIds.length + 1 <= ctx.party.members.length + 1) {
    const normals = distinctNormals(biome);
    if (normals.length > 0) packIds = [...packIds, normals[pick(normals.length, ctx.rng)]];
  }
  const { outcome } = runRoomBattle(ctx, packIds, 'ELITE');
  if (!outcome.alive) return outcome;
  const cards = rollCards('ELITE', cardCount('ELITE', ctx.pactsTaken), rollCtxFor(ctx), ctx.rng);
  resolveRelicCards(ctx, cards);
  return outcome;
}
/** BOSS: BOSS_ENTRY_HEAL first, then the fight; on a win, actsCleared advances and three cards roll (the
 * first a forced EPIC, levelled as a BOSS card — `rollCards` already does this for source 'BOSS'). */
function resolveBoss(ctx: Ctx, biome: Biome): RoomOutcome {
  const dctx = deriveCtxFor(ctx);
  for (const m of ctx.party.members) mapHeal(m, dctx, BOSS_ENTRY_HEAL);
  const { outcome } = runRoomBattle(ctx, [biome.boss], 'BOSS');
  if (!outcome.alive) return outcome;
  ctx.actsCleared += 1;
  const cards = rollCards('BOSS', cardCount('BOSS', ctx.pactsTaken), rollCtxFor(ctx), ctx.rng);
  resolveRelicCards(ctx, cards);
  return outcome;
}

// ========================================================== non-battle rooms ==
/** REST: full party heal, or +1 on up to SHARPEN_RELICS uncapped relics one member wears (relics.ts's own
 * `sharpenMember`/`sharpenCandidates`); an illegal sharpen answer decides HEAL. A level-up is one of
 * Derivation's maxHp-changing triggers (an HP-main relic on the sharpened member), so hp is re-fit around it
 * exactly like `equip`/`unequip` do — capture the pre-sharpen max, then `refitHp` after. */
function resolveRest(ctx: Ctx): void {
  const dctx = deriveCtxFor(ctx);
  const answer = ctx.policy.rest(runStateFor(ctx), ctx.rng);
  const candidates = sharpenCandidates(ctx.party);
  const legalSharpen = typeof answer === 'object' && answer !== null &&
    Number.isInteger(answer.sharpen) && candidates.includes(answer.sharpen);
  if (legalSharpen && typeof answer === 'object') {
    const member = ctx.party.members[answer.sharpen];
    const maxOld = derive(member, dctx).HP;
    sharpenMember(member, { ascension: ctx.ascension }, ctx.rng);
    refitHp(member, maxOld, dctx);
    ctx.rests.push('SHARPEN');
  } else {
    for (const m of ctx.party.members) fullHeal(m, dctx);
    ctx.rests.push('HEAL');
  }
}
/** LOOT: two relic cards, no fight. */
function resolveLoot(ctx: Ctx): void {
  const cards = rollCards('LOOT', cardCount('LOOT', ctx.pactsTaken), rollCtxFor(ctx), ctx.rng);
  resolveRelicCards(ctx, cards);
}
/** SHRINE: one pact drawn uniformly among untaken ones; accept (curse + boon, rest of run) or walk past (no
 * mend either way) — a FORGE when none remain untaken. A taken pact is one of Derivation's maxHp-changing
 * triggers only for SCHISM (LEADER_OFF/LEADER_SELF re-route every member's leader-skill context the instant
 * it's taken), but the refit runs for any taken pact — a no-op for the other five, which never touch HP. */
function resolveShrine(ctx: Ctx): void {
  const untaken = PACT_IDS.filter((id) => !ctx.pactsTaken.includes(id));
  if (untaken.length === 0) { resolveForge(ctx); return; }
  const id = untaken[pick(untaken.length, ctx.rng)];
  const taken = ctx.policy.shrine(PACTS[id], runStateFor(ctx), ctx.rng);
  ctx.shrines.push({ pact: id, taken });
  if (taken) {
    const dctxBefore = deriveCtxFor(ctx);
    const maxOld = ctx.party.members.map((m) => derive(m, dctxBefore).HP);
    ctx.pactsTaken.push(id);
    const dctxAfter = deriveCtxFor(ctx);
    ctx.party.members.forEach((m, i) => refitHp(m, maxOld[i], dctxAfter));
  }
}
/** FORGE: LEVEL (uncapped only) / RECAST / REBRAND on any worn relic; walking past (or an illegal answer) does
 * nothing; a FORGE with nothing to offer is skipped. relics.ts's `forge()` re-validates the choice itself.
 * LEVEL is one of Derivation's maxHp-changing triggers (an HP-main relic on its wearer) — `forge()` only
 * mutates the bare `Relic`, so this call site (the one place that still knows the owning member) captures the
 * pre-forge max and `refitHp`s it after, same as `equip`/`unequip`; harmless no-op for RECAST/REBRAND or a
 * relic that never touches HP, since `refitHp` only moves hp when the derived max actually changed. */
function resolveForge(ctx: Ctx): void {
  const worn = partyWorn(ctx.party);
  if (forgeOptions(worn, ctx.pactsTaken).length === 0) return;
  const answer = ctx.policy.forge(worn, ctx.pool, ctx.rng);
  if (!answer || !Number.isInteger(answer.relic) || answer.relic < 0 || answer.relic >= worn.length) return;
  const fctx: ForgeCtx = { ascension: ctx.ascension, pool: ctx.pool, pacts: ctx.pactsTaken };
  const choice: ForgeChoice = { mode: answer.mode, substat: answer.substat, set: answer.set };
  const relic = worn[answer.relic];
  const owner = ctx.party.members.find((m) => wornRelics(m).includes(relic));
  const dctx = deriveCtxFor(ctx);
  const maxOld = owner ? derive(owner, dctx).HP : 0;
  const applied = forge(relic, choice, fctx, ctx.rng);
  if (applied && owner) refitHp(owner, maxOld, dctx);
}
/** SUMMON: rolled regardless of party size. Under three, a plain recruit index (declining mends nothing, ever).
 * At three: 0 = an EPIC card (levelled as a FIGHT card — rollRelic('SUMMON', ...) already does this), or a
 * {swap, out} that hands the newcomer the outgoing member's slot, relics, hp/maxHp fraction, leader seat and
 * awakening (their own kit's, if the outgoing one had used theirs). */
function resolveSummon(ctx: Ctx, stage: number | undefined): void {
  const dominant = comingDominant(ctx.act, stage);
  const offers = pickSummonOffers(ctx.config.roster, ctx.party, dominant, ctx.config.spdDelta, ctx.rng);
  if (offers.length === 0) return;
  const dctx = deriveCtxFor(ctx);
  const full = ctx.party.members.length >= PARTY_MAX;
  const answer = ctx.policy.summon(offers, ctx.party, ctx.rng);
  if (answer === null) return;
  if (!full) {
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= offers.length) return;
    const m = newMember(offers[answer].def.id, ctx.config.spdDelta);
    fullHeal(m, dctx);
    ctx.party.members.push(m);
    return;
  }
  if (answer === 0) {
    const card = rollRelic('SUMMON', rollCtxFor(ctx), ctx.rng);
    resolveRelicCards(ctx, [card]);
    return;
  }
  if (typeof answer !== 'object') return;
  const { swap, out } = answer;
  if (!Number.isInteger(swap) || swap < 0 || swap >= offers.length || !Number.isInteger(out) || out < 0 || out >= ctx.party.members.length) return;
  const outgoing = ctx.party.members[out];
  const outMaxHp = derive(outgoing, dctx).HP;
  const fraction = outMaxHp > 0 ? outgoing.hp / outMaxHp : 0;
  const wasLeader = ctx.party.leader === out;
  // `leader` is one of Derivation's maxHp-changing triggers: if the outgoing member held the seat, the moment
  // its slot holds `incoming` instead the seat's LeaderSkill identity changes too (party.leader, an index, is
  // untouched, but party.members[party.leader] is now a different character) — every OTHER member's derived
  // maxHp moves with it. Captured before the slot is touched; refit after `incoming` settles in.
  const others = wasLeader ? ctx.party.members.filter((_, i) => i !== out) : [];
  const othersMaxOld = others.map((m) => derive(m, dctx).HP);
  const incoming: PartyMember = { def: offers[swap].def, hp: 0, relics: outgoing.relics, awakened: false };
  if (outgoing.awakened) { applyAwaken(incoming); ctx.awakenedLog.push(incoming.def.id); }
  ctx.party.members[out] = incoming;
  if (wasLeader) ctx.party.leader = out; // a no-op on the index (already `out`) but marks the seat's occupant changed
  const dctxForIncoming = wasLeader ? deriveCtxFor(ctx) : dctx; // incoming's own leader skill, if any, now applies to itself
  incoming.hp = SWAP_FRESH ? derive(incoming, dctxForIncoming).HP : Math.round(fraction * derive(incoming, dctxForIncoming).HP);
  others.forEach((m, i) => refitHp(m, othersMaxOld[i], dctxForIncoming));
  ctx.swaps += 1;
}
/** ALTAR: awaken one un-awakened member; a FORGE when none remain (later laps). An illegal answer falls to the
 * lowest un-awakened index. */
function resolveAltar(ctx: Ctx): void {
  const candidates = ctx.party.members.map((_, i) => i).filter((i) => !ctx.party.members[i].awakened);
  if (candidates.length === 0) { resolveForge(ctx); return; }
  const answer = ctx.policy.altar(ctx.party, ctx.rng);
  const idx = candidates.includes(answer) ? answer : candidates[0];
  applyAwaken(ctx.party.members[idx]);
  ctx.awakenedLog.push(ctx.party.members[idx].def.id);
}

// =================================================================== vault ==
/** The run-start vaultEquip: up to `vaultSlots` Vault relics onto the starter, one per slot, first relic per
 * slot wins; keeps the answer's prefix before the first invalid entry. */
function applyVaultEquip(ctx: Ctx): void {
  if (ctx.config.vaultSlots <= 0 || ctx.config.vault.length === 0) return;
  const dctx = deriveCtxFor(ctx);
  const starter = ctx.party.members[0];
  const answer = ctx.policy.vaultEquip(ctx.config.vault, ctx.config.vaultSlots, ctx.party, ctx.rng);
  const usedSlots = new Set<Slot>();
  const usedIdx = new Set<number>();
  let equipped = 0;
  for (const idx of answer) {
    if (equipped >= ctx.config.vaultSlots) break;
    if (!Number.isInteger(idx) || idx < 0 || idx >= ctx.config.vault.length || usedIdx.has(idx)) break;
    const relic = ctx.config.vault[idx];
    if (usedSlots.has(relic.slot)) break;
    usedIdx.add(idx); usedSlots.add(relic.slot);
    equip(starter, relic, dctx);
    equipped += 1;
  }
}
/** Banking at run end: `n` = BANK_WIN + lap − 1 at DESCEND, BANK_DEATH on any death. Validates the policy's
 * `take` (truncated to min(n, worn.length), distinct, in range) and `drop`, then — if the result would still
 * overflow VAULT_SIZE — drops the lowest-level remaining Vault relics itself (tie: earliest in the Vault). */
function resolveBank(ctx: Ctx, n: number): Relic[] {
  const worn = partyWorn(ctx.party);
  const vault = ctx.config.vault;
  if (n <= 0) return vault.slice();
  const answer = ctx.policy.bank(worn, n, vault, ctx.rng);
  const takeCap = Math.min(n, worn.length);
  const seenTake = new Set<number>();
  const takeIdx: number[] = [];
  for (const i of answer.take) {
    if (takeIdx.length >= takeCap) break;
    if (!Number.isInteger(i) || i < 0 || i >= worn.length || seenTake.has(i)) continue;
    seenTake.add(i); takeIdx.push(i);
  }
  const taken = takeIdx.map((i) => worn[i]);
  const dropIdx = new Set<number>();
  for (const i of answer.drop) if (Number.isInteger(i) && i >= 0 && i < vault.length) dropIdx.add(i);
  let remaining = vault.filter((_, i) => !dropIdx.has(i));
  const overflow = remaining.length + taken.length - VAULT_SIZE;
  if (overflow > 0) {
    const order = remaining.map((_, i) => i).sort((a, b) => remaining[a].level - remaining[b].level || a - b);
    const cut = new Set(order.slice(0, overflow));
    remaining = remaining.filter((_, i) => !cut.has(i));
  }
  return [...remaining, ...taken];
}

// ================================================================ policies ==
/** POLICIES.random: uniform over the legal answers at every step — the < 3% floor every other policy is
 * measured against. Every method draws exactly the enumeration DESIGN.md's Difficulty targets names. */
export const RANDOM_POLICY: Policy = {
  draft: (roster, rng) => pick(roster.length, rng),
  leader: (party, rng) => pick(party.members.length, rng),
  route: (offered, _run, rng) => pick(offered.length, rng),
  act: actFromBattleTs(POLICY_ACTS.random),
  relic: (cards, party, rng) => {
    const total = cards.length * party.members.length + 1;
    const idx = pick(total, rng);
    if (idx === total - 1) return null;
    return { card: Math.floor(idx / party.members.length), onto: idx % party.members.length };
  },
  summon: (offers, party, rng) => {
    if (party.members.length < PARTY_MAX) {
      const idx = pick(offers.length + 1, rng);
      return idx === offers.length ? null : idx;
    }
    const total = 1 + offers.length * party.members.length + 1;
    const idx = pick(total, rng);
    if (idx === total - 1) return null;
    if (idx === 0) return 0;
    const rest = idx - 1;
    return { swap: Math.floor(rest / party.members.length), out: rest % party.members.length };
  },
  forge: (worn, pool, rng) => {
    const pairs: { relic: number; mode: 'LEVEL' | 'RECAST' | 'REBRAND' }[] = [];
    worn.forEach((r, i) => {
      if (!isCapped(r)) pairs.push({ relic: i, mode: 'LEVEL' });
      pairs.push({ relic: i, mode: 'RECAST' });
      pairs.push({ relic: i, mode: 'REBRAND' });
    });
    const idx = pick(pairs.length + 1, rng);
    if (idx === pairs.length) return null;
    const chosen = pairs[idx];
    const relic = worn[chosen.relic];
    if (chosen.mode === 'RECAST') return { ...chosen, substat: pick(relic.subs.length, rng) };
    if (chosen.mode === 'REBRAND') {
      const targets = rebrandSets(relic, pool);
      return { ...chosen, set: targets[pick(targets.length, rng)] };
    }
    return chosen;
  },
  shrine: (_pact, _run, rng) => chance(0.5, rng),
  altar: (party, rng) => pick(party.members.length, rng),
  rest: (run, rng) => {
    const candidates = sharpenCandidates(run.party);
    const idx = pick(candidates.length + 1, rng);
    return idx === 0 ? 'HEAL' : { sharpen: candidates[idx - 1] };
  },
  lap: (_run, rng) => (chance(0.5, rng) ? 'LAP' : 'DESCEND'),
  bank: (worn, n, _vault, rng) => ({ take: withoutReplacement(worn.map((_, i) => i), Math.min(n, worn.length), rng), drop: [] }),
  vaultEquip: (vault, slots, _starter, rng) => {
    const c = pick(slots + 1, rng);
    const result: number[] = [];
    const usedSlots = new Set<Slot>();
    for (let k = 0; k < c; k++) {
      const free = vault.map((_, i) => i).filter((i) => !usedSlots.has(vault[i].slot));
      if (free.length === 0) break;
      const idx = free[pick(free.length, rng)];
      result.push(idx);
      usedSlots.add(vault[idx].slot);
    }
    return result;
  },
};

// --------------------------------------------------------- the balanced family --
const RARITY_RANK: Record<Rarity, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 };
function hpFraction(m: PartyMember, dctx: DeriveCtx): number {
  return m.hp <= 0 ? 0 : m.hp / derive(m, dctx).HP;
}
/** `balanced`'s route, shared verbatim by every other non-random policy (DESIGN.md: "the other seven policies
 * inherit route"): REST when hurt, else ELITE while everyone is topped up, else this fixed priority order. */
const ROUTE_PRIORITY: readonly RoomType[] = ['LOOT', 'SHRINE', 'FORGE', 'SUMMON', 'FIGHT', 'ELITE', 'REST'];
function balancedRoute(offered: readonly RoomType[], run: RunState, _rng: Rng): number {
  const dctx = mkDeriveCtx(run.party, run.pactsTaken);
  if (run.party.members.some((m) => hpFraction(m, dctx) < REST_HEAL_AT)) {
    const i = offered.indexOf('REST');
    if (i >= 0) return i;
  }
  if (run.party.members.every((m) => hpFraction(m, dctx) >= ELITE_ENTER_AT)) {
    const i = offered.indexOf('ELITE');
    if (i >= 0) return i;
  }
  for (const type of ROUTE_PRIORITY) {
    const i = offered.indexOf(type);
    if (i >= 0) return i;
  }
  return 0;
}
/** A relic policy generic over a per-card scoring bonus — `compare.score` plus the bonus, highest wins, taken
 * only when positive; this alone (bonus = 0) is `balanced.relic`. */
function makeRelicPolicy(bonus: (relic: Relic) => number): Policy['relic'] {
  return (cards, party, _rng) => {
    const dctx = mkDeriveCtx(party, []);
    let best: { card: number; onto: number; score: number } | null = null;
    for (let c = 0; c < cards.length; c++) {
      for (let m = 0; m < party.members.length; m++) {
        const score = compare(party.members[m], cards[c], dctx).score + bonus(cards[c]);
        if (!best || score > best.score) best = { card: c, onto: m, score };
      }
    }
    return best && best.score > 0 ? { card: best.card, onto: best.onto } : null;
  };
}
function balancedRest(run: RunState, _rng: Rng): 'HEAL' | { sharpen: number } {
  const dctx = mkDeriveCtx(run.party, run.pactsTaken);
  if (run.party.members.some((m) => m.hp > 0 && hpFraction(m, dctx) < REST_HEAL_AT)) return 'HEAL';
  let bestIdx = -1;
  let bestCount = -1;
  run.party.members.forEach((m, i) => {
    const count = wornRelics(m).filter((r) => !isCapped(r)).length;
    if (count > bestCount) { bestCount = count; bestIdx = i; }
  });
  return bestIdx >= 0 && bestCount > 0 ? { sharpen: bestIdx } : 'HEAL';
}
function balancedSummon(offers: readonly SummonOffer[], party: Party, _rng: Rng): number | { swap: number; out: number } | null {
  const favoredIdx = offers.findIndex((o) => o.favored);
  if (party.members.length < PARTY_MAX) return favoredIdx >= 0 ? favoredIdx : 0;
  if (favoredIdx < 0) return 0;
  const dominant = offers[favoredIdx].dominant;
  const outIdx = party.members.findIndex((m) => matchup(dominant, m.def.element) === 'ADVANTAGE');
  return outIdx >= 0 ? { swap: favoredIdx, out: outIdx } : 0;
}
function balancedForge(worn: readonly Relic[], _pool: readonly SetId[], _rng: Rng): { relic: number; mode: 'LEVEL' | 'RECAST' | 'REBRAND'; substat?: number; set?: SetId } | null {
  let bestIdx = -1;
  worn.forEach((r, i) => {
    if (isCapped(r)) return;
    if (bestIdx < 0) { bestIdx = i; return; }
    const b = worn[bestIdx];
    if (RARITY_RANK[r.rarity] > RARITY_RANK[b.rarity] || (RARITY_RANK[r.rarity] === RARITY_RANK[b.rarity] && r.level < b.level)) bestIdx = i;
  });
  return bestIdx >= 0 ? { relic: bestIdx, mode: 'LEVEL' } : null;
}
function balancedVaultEquip(vault: readonly Relic[], slots: number, _starter: Party, _rng: Rng): number[] {
  const result: number[] = [];
  for (const slot of SLOTS) {
    if (result.length >= slots) break;
    let bestIdx = -1;
    for (let i = 0; i < vault.length; i++) {
      if (vault[i].slot !== slot) continue;
      if (bestIdx < 0 || vault[i].level > vault[bestIdx].level) bestIdx = i;
    }
    if (bestIdx >= 0) result.push(bestIdx);
  }
  return result;
}
function balancedBank(worn: readonly Relic[], n: number, _vault: readonly Relic[], _rng: Rng): { take: number[]; drop: number[] } {
  const order = worn.map((_, i) => i).sort((a, b) =>
    worn[b].level - worn[a].level || RARITY_RANK[worn[b].rarity] - RARITY_RANK[worn[a].rarity] || a - b);
  return { take: order.slice(0, Math.min(n, worn.length)), drop: [] };
}

/** DESIGN.md → Difficulty targets → Policy roster. `balanced` plays every room and every fight for value; the
 * seven flavour policies below are `balanced` with the stated preferences overridden. */
export const BALANCED_POLICY: Policy = {
  draft: (roster, rng) => pick(roster.length, rng),
  leader: (party, _rng) => party.leader,
  route: balancedRoute,
  act: actFromBattleTs(POLICY_ACTS.balanced),
  relic: makeRelicPolicy(() => 0),
  summon: balancedSummon,
  forge: balancedForge,
  shrine: (_pact, _run, rng) => chance(0.5, rng),
  altar: (party, _rng) => { const i = party.members.findIndex((m) => !m.awakened); return i >= 0 ? i : 0; },
  rest: balancedRest,
  lap: () => 'DESCEND',
  bank: balancedBank,
  vaultEquip: balancedVaultEquip,
};

/** speed: SPD boots and SWIFT/VIOLENT bias, a GALE leader when one is in the party, its `act` strips first. */
export const SPEED_POLICY: Policy = {
  ...BALANCED_POLICY,
  act: speedAct,
  leader: (party, rng) => { const i = party.members.findIndex((m) => m.def.id === 'GALE'); return i >= 0 ? i : BALANCED_POLICY.leader(party, rng); },
  relic: makeRelicPolicy((r) => (r.main.key === 'SPD' ? 1 : 0) + (r.set === 'SWIFT' || r.set === 'VIOLENT' ? 0.5 : 0)),
};
/** glass: ATK%/CRIT/CDMG mains and FATAL/RAGE/BLADE/DESTROY bias, its `act` always aims at the lowest-HP enemy. */
export const GLASS_POLICY: Policy = {
  ...BALANCED_POLICY,
  act: glassAct,
  relic: makeRelicPolicy((r) => (r.main.key === 'ATK_PCT' || r.main.key === 'CRIT' || r.main.key === 'CDMG' ? 1 : 0) +
    (r.set === 'FATAL' || r.set === 'RAGE' || r.set === 'BLADE' || r.set === 'DESTROY' ? 0.5 : 0)),
};
/** tank: HP/DEF mains and GUARD/ENERGY/BULWARK/WILL/REVENGE bias; no act override (a wall plays like balanced). */
export const TANK_POLICY: Policy = {
  ...BALANCED_POLICY,
  relic: makeRelicPolicy((r) => ((['HP', 'HP_PCT', 'DEF', 'DEF_PCT'] as RelicStat[]).includes(r.main.key) ? 1 : 0) +
    ((['GUARD', 'ENERGY', 'BULWARK', 'WILL', 'REVENGE'] as SetId[]).includes(r.set) ? 0.5 : 0)),
};
/** control: ACC tome and FOCUS/DESPAIR bias, its `act` opens with a DEF_BREAK/ATK_BREAK when one is legal. */
export const CONTROL_POLICY: Policy = {
  ...BALANCED_POLICY,
  act: controlAct,
  relic: makeRelicPolicy((r) => (r.main.key === 'ACC' || r.main.key === 'RES' ? 1 : 0) + (r.set === 'FOCUS' || r.set === 'DESPAIR' ? 0.5 : 0)),
};
/** mono: converges on the drafted starter's element — an elemental leader, and SUMMON only recruits/keeps that
 * element (declining an off-element recruit, swapping out an off-element member for a matching offer). */
export const MONO_POLICY: Policy = {
  ...BALANCED_POLICY,
  leader: (party, rng) => { const i = party.members.findIndex((m) => m.def.leader.element !== undefined); return i >= 0 ? i : BALANCED_POLICY.leader(party, rng); },
  summon: (offers, party, rng) => {
    const monoEl = party.members[0]?.def.element;
    const matchIdx = offers.findIndex((o) => o.def.element === monoEl);
    if (party.members.length < PARTY_MAX) {
      // the six-character roster cannot field every element a full trio — prefer a match, but still fill the
      // party (via balanced's own fallback) rather than staying under-strength forever when none exists.
      return matchIdx >= 0 ? matchIdx : balancedSummon(offers, party, rng);
    }
    if (matchIdx < 0) return 0;
    const outIdx = party.members.findIndex((m) => m.def.element !== monoEl);
    return outIdx >= 0 ? { swap: matchIdx, out: outIdx } : 0;
  },
};
/** lapper: `balanced` that always takes ANOTHER LAP — never DESCENDs, so `actsCleared` is the metric the
 * harness reads (a lapper run's own `won` stays false; it only ever stops by dying). */
export const LAPPER_POLICY: Policy = { ...BALANCED_POLICY, lap: () => 'LAP' };
/** pairs — the 2+2+2 baseline: `relic` only takes cards that leave every 4-piece set below four on the wearer,
 * preferring a pool 2-piece set whose wearer count becomes even; `forge` is balanced's own, which never
 * REBRANDs at all (so it never REBRANDs into a 4-piece either). */
function pairsRelic(cards: readonly Relic[], party: Party, _rng: Rng): { card: number; onto: number } | null {
  const dctx = mkDeriveCtx(party, []);
  const cands: { card: number; onto: number; score: number; completesPair: boolean }[] = [];
  for (let c = 0; c < cards.length; c++) {
    const setDef = SETS[cards[c].set];
    for (let m = 0; m < party.members.length; m++) {
      const member = party.members[m];
      const after = [...wornRelics(member).filter((r) => r.slot !== cards[c].slot), cards[c]];
      const newCount = after.filter((r) => r.set === cards[c].set).length;
      if (setDef.pieces === 4 && newCount >= 4) continue;
      cands.push({ card: c, onto: m, score: compare(member, cards[c], dctx).score, completesPair: setDef.pieces === 2 && newCount % 2 === 0 });
    }
  }
  if (cands.length === 0) return null;
  const preferred = cands.filter((k) => k.completesPair);
  const pool = preferred.length > 0 ? preferred : cands;
  const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
  return best.score > 0 ? { card: best.card, onto: best.onto } : null;
}
export const PAIRS_POLICY: Policy = { ...BALANCED_POLICY, relic: pairsRelic };

/** Every policy the harness can select by name (`--policy`). */
export const POLICIES: Record<string, Policy> = {
  random: RANDOM_POLICY, balanced: BALANCED_POLICY, speed: SPEED_POLICY, glass: GLASS_POLICY, tank: TANK_POLICY,
  control: CONTROL_POLICY, mono: MONO_POLICY, lapper: LAPPER_POLICY, pairs: PAIRS_POLICY,
};

// ============================================================= simulateRun ==
const ALIVE: RoomOutcome = { alive: true, deathKind: '', deathBy: '' };
function clampIdx(i: number, len: number): number {
  return Number.isInteger(i) && i >= 0 && i < len ? i : 0;
}
/** Dispatches one map node to its resolver; only FIGHT/ELITE/BOSS can end the run. */
function resolveRoom(ctx: Ctx, roomType: RoomType, stage: number): RoomOutcome {
  const biome: Biome = BIOMES[ctx.act - 1] ?? BIOMES[0];
  switch (roomType) {
    case 'FIGHT': return resolveFight(ctx, biome);
    case 'ELITE': return resolveElite(ctx, biome);
    case 'BOSS': return resolveBoss(ctx, biome);
    case 'REST': resolveRest(ctx); return ALIVE;
    case 'LOOT': resolveLoot(ctx); return ALIVE;
    case 'SHRINE': resolveShrine(ctx); return ALIVE;
    case 'FORGE': resolveForge(ctx); return ALIVE;
    case 'SUMMON': resolveSummon(ctx, stage); return ALIVE;
    case 'ALTAR': resolveAltar(ctx); return ALIVE;
    default: return ALIVE;
  }
}

/**
 * DESIGN.md → Difficulty targets: `draft`, `vaultEquip`, the set pool, the ascension row, the opening `summon`,
 * `leader`, then `buildMap(1, …)` — then every act's six rooms (stage 0..4, then BOSS), then the door at act 6,
 * laps compounding via LAP_MULT until a DESCEND or a death. Banking happens exactly once, at the very end.
 */
export function simulateRun(config: RunConfig, policy: Policy, rng: Rng): RunResult {
  const rosterIds = config.roster.length > 0 ? config.roster : ROSTER;
  const ascension = Math.max(0, Math.min(ASCENSION.length - 1, Math.floor(config.ascension)));
  const ascRow = ascRowFor(ascension);

  const starter = newMember(rosterIds[clampIdx(policy.draft(rosterIds, rng), rosterIds.length)], config.spdDelta);
  const party: Party = { members: [starter], leader: 0 };
  const ctx: Ctx = {
    config, policy, rng, party, ascension, ascRow, pactsTaken: [], pool: [], score: 0, act: 1, lap: 1,
    clearsThisAct: 0, totalClears: 0, awakenedLog: [], dryStreak: 0, swaps: 0, rests: [], shrines: [], rooms: [],
    turnsPerBattle: [], enrages: 0, probes: [], relicSeq: 0, actsCleared: 0,
  };

  applyVaultEquip(ctx);
  ctx.pool = rollSetPool(wornRelics(starter), rng);
  fullHeal(starter, deriveCtxFor(ctx));

  const openingOffers = pickSummonOffers(rosterIds, party, comingDominant(1, undefined), config.spdDelta, rng);
  const openingAns = policy.summon(openingOffers, party, rng);
  if (typeof openingAns === 'number' && Number.isInteger(openingAns) && openingAns >= 0 && openingAns < openingOffers.length) {
    const recruit = newMember(openingOffers[openingAns].def.id, config.spdDelta);
    fullHeal(recruit, deriveCtxFor(ctx));
    party.members.push(recruit);
  }
  party.leader = clampIdx(policy.leader(party, rng), party.members.length);
  // `leader` is one of Derivation's maxHp-changing triggers: for any policy whose `leader()` doesn't just
  // echo back index 0 (RANDOM's uniform pick, SPEED's GALE-seeking, MONO's elemental search), the seat can
  // land on a member other than the one both fullHeals above assumed, re-pointing every member's leader-skill
  // context. No battle has run yet, so every member is still exactly at their (possibly now-stale) max — a
  // fresh fullHeal against the finalized leader is exact, not merely a refit that happens to agree here.
  const dctxAfterOpeningLeader = deriveCtxFor(ctx);
  for (const m of party.members) fullHeal(m, dctxAfterOpeningLeader);

  let won = false;
  let deathKind: '' | 'WIPE' | 'STALL' = '';
  let deathBy = '';
  for (;;) {
    const map = buildMap(ctx.act, ctx.ascension, ctx.party, ctx.rng);
    ctx.clearsThisAct = 0;
    let stage = -1;
    let nodeIdx = -1;
    let alive = true;
    for (let step = 0; step <= STAGE_SIZES.length && alive; step++) {
      const offeredIdxs = stage === -1 ? [...map.entry] : [...map.links[stage][nodeIdx]];
      const targetStage = stage + 1;
      const offeredTypes = offeredIdxs.map((i) => (targetStage < STAGE_SIZES.length ? map.stages[targetStage][i] : 'BOSS' as RoomType));
      const choice = clampIdx(ctx.policy.route(offeredTypes, runStateFor(ctx), ctx.rng), offeredIdxs.length);
      nodeIdx = offeredIdxs[choice];
      stage = targetStage;
      const roomType: RoomType = stage < STAGE_SIZES.length ? map.stages[stage][nodeIdx] : 'BOSS';
      ctx.rooms.push(roomType);
      const outcome = resolveRoom(ctx, roomType, stage);
      if (!outcome.alive) { alive = false; deathKind = outcome.deathKind; deathBy = outcome.deathBy; }
    }
    if (!alive) break;

    if (ctx.act === ACTS) {
      if (ctx.policy.lap(runStateFor(ctx), ctx.rng) === 'DESCEND') { won = true; break; }
      ctx.lap += 1;
      ctx.act = 1;
    } else {
      ctx.act += 1;
    }
  }

  const banked = resolveBank(ctx, won ? BANK_WIN + ctx.lap - 1 : BANK_DEATH);
  return {
    won, actReached: ctx.act, lap: ctx.lap, ascension, clears: ctx.totalClears, actsCleared: ctx.actsCleared,
    deathBy, deathKind,
    party: party.members.map((m) => m.def.id),
    leader: party.members[party.leader]?.def.id ?? '',
    awakened: ctx.awakenedLog,
    setsWorn: setsWorn(party), mainsWorn: mainsWorn(party), relicLevels: relicLevels(party),
    banked, rooms: ctx.rooms, turnsPerBattle: ctx.turnsPerBattle, enrages: ctx.enrages,
    shrines: ctx.shrines, swaps: ctx.swaps, rests: ctx.rests, probes: ctx.probes,
  };
}

// =================================================== fresh members & heal ==
/**
 * `RunConfig.spdDelta` baked into a cloned CharacterDef's base SPD, rather than threaded through `DeriveCtx`
 * (relics.ts's own mechanism for it) or `sim/battle.ts`'s `BattleCtx.spdDelta` (which `createBattle` now does
 * forward into `buildHeroes` — phase 8 closed that gap for the `--battles` fixture path, which has no
 * `RunConfig` of its own to bake a delta into). A full run still bakes it here instead of also setting
 * `BattleCtx.spdDelta` on every `runRoomBattle` call: every member's own `def.base.spd` already carries it via
 * this function, so setting `ctx.spdDelta` too on top would add it a second time (`derive()`'s formula is
 * `def.base.spd + (ctx.spdDelta ?? 0)` — additive, not idempotent). Baking it into `base.spd` also reaches every
 * plain `derive()` call this file itself makes outside a battle (e.g. `compare`'s SPD-weighted scoring)
 * identically to a real battle Actor's, which a `BattleCtx`-only placement would not.
 */
function withSpdDelta(id: string, spdDelta?: number): CharacterDef {
  const def = CHARACTERS[id];
  return spdDelta ? { ...def, base: { ...def.base, spd: def.base.spd + spdDelta } } : def;
}
/** A brand-new member of `id`: no relics, un-awakened, hp set by the caller once a DeriveCtx exists. */
function newMember(id: string, spdDelta?: number): PartyMember {
  return { def: withSpdDelta(id, spdDelta), hp: 0, relics: {}, awakened: false };
}
/** The party's shared DeriveCtx: the seated leader's skill (or null) reaches every member; SCHISM (LEADER_OFF /
 * LEADER_SELF) is read inside `derive` itself from `pacts`. spdDelta is never passed here — every member's own
 * `def.base.spd` already carries it (see `withSpdDelta`); adding it again here would double it. */
function mkDeriveCtx(party: Party, pactsTaken: readonly PactId[]): DeriveCtx {
  return { leader: party.members[party.leader]?.def.leader ?? null, pacts: pactsTaken };
}
function fullHeal(member: PartyMember, ctx: DeriveCtx): void {
  member.hp = derive(member, ctx).HP;
}
/** Every map heal: hp = min(maxHp, hp + round(maxHp × f)). */
function mapHeal(member: PartyMember, ctx: DeriveCtx, fraction: number): void {
  const maxHp = derive(member, ctx).HP;
  member.hp = Math.min(maxHp, member.hp + Math.round(maxHp * fraction));
}
function mendParty(party: Party, ctx: DeriveCtx, fraction: number): void {
  for (const m of party.members) if (m.hp > 0) mapHeal(m, ctx, fraction);
}
/** A member awakens once per lap-life: an `upgrades` awakening swaps one skill id on a CLONED CharacterDef (the
 * shared data/characters.ts object is never mutated); a `bonus` awakening needs no def change — `derive` already
 * reads `member.awakened` for it. */
function applyAwaken(member: PartyMember): void {
  const def = member.def;
  if ('upgrades' in def.awakening) {
    const { slot, to } = def.awakening.upgrades;
    const skills = [...def.skills] as [typeof def.skills[0], typeof def.skills[1], typeof def.skills[2]];
    skills[slot] = to;
    member.def = { ...def, skills };
  }
  member.awakened = true;
}

// ============================================================ SUMMON offers ==
/** The dominant element of act `act1based` (1-based) — defensively falls back to BIOMES[0] while phase 6b's
 * later biomes are still landing, per this file's Contract notes. */
function biomeDominant(act1based: number): Element {
  return (BIOMES[act1based - 1] ?? BIOMES[0]).dominant;
}
/** "The coming act's dominant": the current act's while still before the landmark stage, the next act's (with
 * lap wraparound) from the landmark stage on. `stage` is undefined for the opening, pre-map SUMMON. */
function comingDominant(act: number, stage: number | undefined): Element {
  if (stage === undefined || stage < LANDMARK_STAGE) return biomeDominant(act);
  return biomeDominant(act === ACTS ? 1 : act + 1);
}
/** Three offers uniform without replacement from `rosterIds` minus the current party, each tagged with whether
 * its element beats `dominant` — DESIGN.md → Characters → Building a party, and balanced.summon's rule. */
function pickSummonOffers(rosterIds: readonly string[], party: Party, dominant: Element, spdDelta: number | undefined, rng: Rng): SummonOffer[] {
  const have = new Set(party.members.map((m) => m.def.id));
  const candidates = rosterIds.filter((id) => !have.has(id));
  const chosen = withoutReplacement(candidates, Math.min(SUMMON_OFFERS, candidates.length), rng);
  return chosen.map((id) => ({ def: withSpdDelta(id, spdDelta), favored: matchup(CHARACTERS[id].element, dominant) === 'ADVANTAGE', dominant }));
}

// ================================================ battle running & deathBy ==
/** My own Policy's `act` (battle: BattleView) is assignable wherever battle.ts wants its own `{act: ActFn}` —
 * BattleView is a supertype of the real Battle it will always be called with, per this file's Contract notes. */
function toActPolicy(policy: Policy): ActPolicy {
  return { act: (battle, actor, options, rng) => policy.act(battle, actor, options, rng) };
}
/** The reverse direction (used to reuse battle.ts's own `random`/`balanced` act functions as a Policy's `act`):
 * `battle` arrives as a real Battle at runtime; the assertion just names that back to the type. */
function actFromBattleTs(fn: ActFn): Policy['act'] {
  return (battle, actor, options, rng) => fn(battle as Battle, actor, options, rng);
}

/** Mirrors `simulateBattle`'s own loop exactly (including its boss-died/ttk tracking, needed for a correct
 * Probe) but keeps the `Battle` around afterward — `deathBy` on a WIPE needs its event log. */
function runBattleTracked(party: Party, enemies: Actor[], policy: ActPolicy, rng: Rng, ctx: BattleCtx): { result: ReturnType<typeof battleOutcome>; battle: Battle } {
  const battle = createBattle(party, enemies, policy, rng, ctx);
  for (;;) {
    const actor = nextReady(battle);
    if (!actor) break;
    const bossWasAlive = battle.bossRef?.alive ?? false;
    runTurn(battle, actor);
    if (bossWasAlive && battle.bossRef && !battle.bossRef.alive && !battle.probeAcc.bossDied) {
      battle.probeAcc.bossDied = true;
      battle.probeAcc.ttk = battle.heroTurns;
    }
    if (isOver(battle)) break;
  }
  return { result: battleOutcome(battle), battle };
}

/** DESIGN.md → RunResult.deathBy: on a WIPE, the enemy whose hit downed the last living hero, or on a BURN
 * death the actor at `status.by`; '' if no hero ever died (shouldn't happen on a real WIPE, but never throws). */
function findDeathBy(battle: Battle): string {
  let deathIdx = -1;
  let victim: Actor | undefined;
  for (let i = 0; i < battle.events.length; i++) {
    const e = battle.events[i];
    if (e.kind === 'DEATH' && e.actor.side === 'HERO') { deathIdx = i; victim = e.actor; }
  }
  if (deathIdx < 0 || !victim) return '';
  const idOf = (a: Actor): string => a.def.id;
  for (let i = deathIdx - 1; i >= 0; i--) {
    const e: BattleEvent = battle.events[i];
    if (e.kind === 'HIT' && e.target === victim && e.killed) return idOf(e.attacker);
    if (e.kind === 'BURN_TICK' && e.actor === victim) {
      const burn = victim.statuses.find((s) => s.kind === 'BURN');
      const applier = burn?.by !== undefined ? battle.enemies[burn.by] : undefined;
      return applier ? idOf(applier) : '';
    }
  }
  return '';
}

// ==================================================== act strategies ==
/** Runs battle.ts's own `balancedAct` over a subset of `options` (never drawing rng — balanced's act never
 * does) and maps the winning index back into the original array; an empty subset defers to the full options. */
function delegateAmong(battle: BattleView, actor: Actor, options: ActOption[], rng: Rng, keep: (opt: ActOption) => boolean): number {
  const idxs: number[] = [];
  const filtered: ActOption[] = [];
  options.forEach((opt, i) => { if (keep(opt)) { idxs.push(i); filtered.push(opt); } });
  if (filtered.length === 0) return POLICY_ACTS.balanced(battle as Battle, actor, options, rng);
  return idxs[POLICY_ACTS.balanced(battle as Battle, actor, filtered, rng)];
}
function livingLowestHpEnemySlot(battle: BattleView): number | null {
  const alive = battle.enemies.filter((e) => e.alive);
  if (alive.length === 0) return null;
  return alive.reduce((best, e) => (e.hp / e.maxHp < best.hp / best.maxHp ? e : best)).slot;
}
/** speed: "strips first" — a legal skill with a negative atbBoost (an ATB strip), else balanced's own choice. */
function speedAct(battle: BattleView, actor: Actor, options: ActOption[], rng: Rng): number {
  return delegateAmong(battle, actor, options, rng, (opt) => (SKILLS[actor.def.skills[opt.skill]].atbBoost ?? 0) < 0);
}
/** glass: "lowest-HP target" — among options aimed at a specific enemy, keep only the lowest-hp% living one
 * (AoE/self/ally options, target = −1, are never excluded); balanced's own scoring picks among what remains. */
function glassAct(battle: BattleView, actor: Actor, options: ActOption[], rng: Rng): number {
  const lowest = livingLowestHpEnemySlot(battle);
  if (lowest === null) return POLICY_ACTS.balanced(battle as Battle, actor, options, rng);
  return delegateAmong(battle, actor, options, rng, (opt) => opt.target === -1 || opt.target === lowest);
}
/** control: "opens with breaks" — a legal skill that applies DEF_BREAK or ATK_BREAK, else balanced's choice. */
function controlAct(battle: BattleView, actor: Actor, options: ActOption[], rng: Rng): number {
  return delegateAmong(battle, actor, options, rng, (opt) =>
    (SKILLS[actor.def.skills[opt.skill]].applies ?? []).some((a) => a.status === 'DEF_BREAK' || a.status === 'ATK_BREAK'));
}

// ================================================================ the map ==
/** A generated act map: stages[0..4] room types, node order; the single node of STAGE_SIZES[LANDMARK_STAGE] is
 * the act's landmark. Links point forward one stage at a time; `links[4]` points at the (single, implicit)
 * BOSS. `entry` is the act's own opening links into stage 0 — there is no room to have "entered" yet. */
export interface RunMap {
  stages: RoomType[][];
  entry: readonly number[];
  links: readonly (readonly number[])[][];
}

/** Ascension rows are indexed defensively, mirroring battle.ts's own clamp — a bad level reads the nearest
 * real row instead of throwing. */
function ascRowFor(ascension: number): AscensionRow {
  const a = Math.max(0, Math.min(ASCENSION.length - 1, Math.floor(ascension)));
  return ASCENSION[a];
}

/** ROOM_WEIGHTS' own key order — the order step (1)'s weighted draw walks. */
const ROOM_ROLL_ORDER: readonly Exclude<RoomType, 'ALTAR' | 'BOSS'>[] = ['FIGHT', 'ELITE', 'LOOT', 'REST', 'FORGE', 'SHRINE', 'SUMMON'];
function rollRoomType(restWeightMult: number, rng: Rng): RoomType {
  const weights = ROOM_ROLL_ORDER.map((rt) => (rt === 'REST' ? ROOM_WEIGHTS.REST * restWeightMult : ROOM_WEIGHTS[rt]));
  return ROOM_ROLL_ORDER[weighted(weights, rng)];
}

/** DESIGN.md → Run structure → The map, step (4)'s link formula between a stage of `a` nodes and one of `b`:
 * per source node i ascending, a contiguous span of target indices (anti-crossing against the previous two
 * spans), then every unreached target joins the nearest span (tie: lowest i). Only called for the two
 * transitions where neither side is the landmark or BOSS (both of those are full, undrawn connections instead). */
function generalLinks(a: number, b: number, rng: Rng): number[][] {
  const spans: [number, number][] = [];
  for (let i = 0; i < a; i++) {
    const straight = Math.round((i * (b - 1)) / Math.max(1, a - 1));
    let lo = Math.max(0, Math.min(straight, b - 1));
    if (i >= 1) lo = Math.max(lo, spans[i - 1][1] - 1);
    if (i >= 2) lo = Math.max(lo, spans[i - 2][1]);
    const width = b >= 2 && chance(0.85, rng) ? 2 : 1; // SPAN_TWO_CHANCE — no data/types constant owns this in run.ts's scope
    const hi = Math.min(b - 1, lo + width - 1);
    spans.push([lo, hi]);
  }
  const links: number[][] = spans.map(([lo, hi]) => {
    const out: number[] = [];
    for (let j = lo; j <= hi; j++) out.push(j);
    return out;
  });
  for (let j = 0; j < b; j++) {
    if (links.some((s) => s.includes(j))) continue;
    let bestI = 0;
    let bestDist = Infinity;
    for (let i = 0; i < a; i++) {
      const [lo, hi] = spans[i];
      const dist = j < lo ? lo - j : j > hi ? j - hi : 0;
      if (dist < bestDist) { bestDist = dist; bestI = i; }
    }
    links[bestI] = [...links[bestI], j].sort((x, y) => x - y);
  }
  return links;
}

/**
 * DESIGN.md → Run structure → The map, steps (1)-(5). `party` is read only for `.members.length` — its size at
 * the moment this act's map is generated (step 2's ELITE gate). `ascension` gates the REST guarantee (A3+) and
 * halves the REST roll weight (A6+) via `ascRowFor`.
 */
export function buildMap(act: number, ascension: number, party: Party, rng: Rng): RunMap {
  const row = ascRowFor(ascension);
  const sizes = STAGE_SIZES;
  const stages: RoomType[][] = sizes.map(() => []);

  // (1) every other node rolls from ROOM_WEIGHTS, stage then node order.
  for (let s = 0; s < sizes.length; s++) {
    if (s === LANDMARK_STAGE) continue;
    for (let i = 0; i < sizes[s]; i++) stages[s].push(rollRoomType(row.restWeightMult, rng));
  }
  stages[LANDMARK_STAGE] = [LANDMARKS[act - 1]];

  // (2) the ELITE gate: stage 1 always downgrades; earlier than a SUMMON landmark while under three members too.
  const landmarkIsSummon = LANDMARKS[act - 1] === 'SUMMON';
  const small = party.members.length < PARTY_MAX;
  for (let s = 0; s < sizes.length; s++) {
    if (s === LANDMARK_STAGE) continue;
    for (let i = 0; i < stages[s].length; i++) {
      if (stages[s][i] !== 'ELITE') continue;
      if (s === 0 || (landmarkIsSummon && s < LANDMARK_STAGE && small)) stages[s][i] = 'FIGHT';
    }
  }

  // (3) guarantees — no REST (the landmark counts; skipped at A3+), then no LOOT.
  const hasRest = stages.some((st) => st.includes('REST'));
  let guaranteeRest: { stage: number; index: number } | null = null;
  if (!hasRest && row.restGuarantee) {
    const order = [3, 4, 1, 0];
    let placed = false;
    for (const s of order) {
      for (let i = 0; i < stages[s].length && !placed; i++) {
        if (stages[s][i] === 'FIGHT') { stages[s][i] = 'REST'; guaranteeRest = { stage: s, index: i }; placed = true; }
      }
      if (placed) break;
    }
    if (!placed) { stages[3][0] = 'REST'; guaranteeRest = { stage: 3, index: 0 }; }
  }
  const hasLoot = stages.some((st) => st.includes('LOOT'));
  if (!hasLoot) {
    let placed = false;
    const firstRestStage = stages.findIndex((st) => st.includes('REST'));
    if (firstRestStage >= 0) {
      const i = stages[firstRestStage].indexOf('FIGHT');
      if (i >= 0) { stages[firstRestStage][i] = 'LOOT'; placed = true; }
    }
    if (!placed) {
      for (let s = 0; s < sizes.length && !placed; s++) {
        for (let i = 0; i < stages[s].length && !placed; i++) if (stages[s][i] === 'FIGHT') { stages[s][i] = 'LOOT'; placed = true; }
      }
    }
    if (!placed) {
      for (let s = 0; s < sizes.length && !placed; s++) {
        if (s === LANDMARK_STAGE) continue;
        for (let i = 0; i < stages[s].length && !placed; i++) {
          if (guaranteeRest && guaranteeRest.stage === s && guaranteeRest.index === i) continue;
          stages[s][i] = 'LOOT'; placed = true;
        }
      }
    }
  }

  // (4) links — the landmark and BOSS are full, undrawn connections; the other two transitions use the formula.
  const entry = stages[0].map((_, i) => i);
  const links: number[][][] = [];
  links[0] = generalLinks(sizes[0], sizes[1], rng);
  links[1] = stages[1].map(() => [0]);
  links[2] = [stages[3].map((_, i) => i)];
  links[3] = generalLinks(sizes[3], sizes[4], rng);
  links[4] = stages[4].map(() => [0]);

  // (5) adjacency, RESTs in stage order: a REST whose successor is also REST downgrades that successor, unless
  // the successor is the landmark or the guarantee REST, in which case this (the predecessor) REST does instead.
  for (let s = 0; s < sizes.length - 1; s++) {
    for (let i = 0; i < stages[s].length; i++) {
      if (stages[s][i] !== 'REST') continue;
      for (const j of links[s][i]) {
        if (stages[s + 1][j] !== 'REST') continue;
        const protectedTarget = s + 1 === LANDMARK_STAGE || (!!guaranteeRest && guaranteeRest.stage === s + 1 && guaranteeRest.index === j);
        if (protectedTarget) { stages[s][i] = 'FIGHT'; break; }
        stages[s + 1][j] = 'FIGHT';
      }
    }
  }

  return { stages, entry, links };
}
