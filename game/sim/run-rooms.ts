import {
  SLOTS,
  STAT_KEYS,
  type Biome,
  type EnemyDef,
  type Hero,
  type LootOffer,
  type LootSource,
  type Rng,
  type StatKey,
} from '../types';
import { BOSS_ENTRY_HEAL, type EventDef } from '../data';
import { spawnEnemy } from './combat';
import { applyEventCosts, eventOptionEnabled, pickEvent, rollEventItem, screenEffectOf, takePendingBurn, type ScreenEffect } from './events';
import { derive, fullHeal, grantClear, healFraction, refillPotions, skipMend, spendPoint } from './hero';
import { applyOffer, noteDeclinedScrolls, resolveOverflow, resolveUpgrade, rollLoot } from './loot';
import type { MapNode } from './map';
import type { Policy } from './model';
import { upgradableTargets } from './pack';
import { runBattle } from './run-battle';
import {
  bossPickKind,
  countEvent,
  countPick,
  countUpgradeTarget,
  probeOf,
  type Ending,
  type RunState,
} from './run-tally';
import { clamp, isNonEmpty, pick } from './util';

function spendAll(hero: Hero, policy: Policy): void {
  let guard = 0;
  while (hero.sp > 0 && guard < 200) {
    guard += 1;
    const d = derive(hero);
    const wanted = policy.allocate(hero, d);
    const stat: StatKey = STAT_KEYS.includes(wanted) ? wanted : 'HP';
    if (!spendPoint(hero, stat)) {break;}
  }
}

function prepareFor(run: RunState, foe: EnemyDef): void {
  const before = SLOTS.map((slot) => run.hero.equipment[slot]?.id);
  run.policy.prepare(run.hero, foe);
  run.tally.prepareSwaps += SLOTS.filter((slot, i) => run.hero.equipment[slot]?.id !== before[i]).length;
}

function resolveChoice(run: RunState, chosen: LootOffer): LootOffer {
  if (chosen.kind !== 'UPGRADE_ANY') {return chosen;}
  const targets = upgradableTargets(run.hero);
  const wanted = Math.floor(run.policy.upgradeTarget(run.hero, targets));
  const target = targets[clamp(wanted, 0, Math.max(0, targets.length - 1))];
  return (target && resolveUpgrade(run.hero, target)) ?? chosen;
}

function wantsStow(run: RunState, offer: LootOffer): boolean {
  if (offer.kind !== 'ITEM' || !run.hero.equipment[offer.item.slot]) {return false;}
  return run.policy.stowOrEquip(run.hero, offer.item) === 'STOW';
}

function takeOffer(run: RunState, chosen: LootOffer): void {
  const { hero, policy, rng, tally } = run;
  const offer = resolveChoice(run, chosen);
  countUpgradeTarget(tally, offer);
  const applied = applyOffer(hero, offer, rng, { stow: wantsStow(run, offer) });
  if (applied.stowed) {tally.itemsStowed += 1;}
  if (applied.overflow) {
    resolveOverflow(hero, applied.overflow, policy.dropWhich(hero, applied.overflow));
    tally.drops += 1;
  }
  countPick(tally, chosen);
}

function offerLoot(run: RunState, source: LootSource, act: number): void {
  const { hero, policy, rng, tally } = run;
  const offered = rollLoot(source, act, hero, rng);
  if (offered.length === 0) {return;}
  const picked = policy.pick(hero, offered, act);
  const chosen = picked && offered.includes(picked) ? picked : null;
  const scrollsOffered = offered.reduce((n, o) => n + (o.kind === 'SCROLL' ? 1 : 0), 0);
  if (source === 'BOSS') {tally.bossPicks.push(bossPickKind(chosen, act));}
  if (chosen) {takeOffer(run, chosen);}
  else {skipMend(hero);}
  noteDeclinedScrolls(hero, offered, chosen);
  tally.scrollsDeclined += scrollsOffered - (chosen?.kind === 'SCROLL' ? 1 : 0);
}

function foeFor(node: MapNode, biome: Biome, rng: Rng): string {
  if (node.enemyId) {return node.enemyId;}
  const ids = node.type === 'ELITE' ? biome.elites : biome.normals;
  return isNonEmpty(ids) ? pick(ids, rng) : pick(biome.normals, rng);
}

function ignitePendingBurn(hero: Hero, act: number): void {
  const burn = takePendingBurn(hero, act);
  if (burn) {hero.burn = burn;}
}

function dropForEvent(run: RunState): void {
  const { hero } = run;
  const last = hero.pack.at(-1);
  if (!last) {return;}
  const wanted = Math.floor(run.policy.dropWhich({ ...hero, pack: hero.pack.slice(0, -1) }, last));
  hero.pack.splice(clamp(wanted, 0, hero.pack.length - 1), 1);
}

function eventItem(run: RunState, rarity: Extract<ScreenEffect, { kind: 'item' }>['rarity'], act: number): void {
  const item = rollEventItem(run.hero, rarity, act, run.rng);
  if (!item) {return;}
  const offer: LootOffer = { kind: 'ITEM', item };
  if (run.policy.pick(run.hero, [offer], act) === offer) {takeOffer(run, offer);}
  else {skipMend(run.hero);}
}

function eventScreen(run: RunState, screen: ScreenEffect, act: number): void {
  if (screen.kind === 'sp') { run.hero.sp += screen.amount; spendAll(run.hero, run.policy); return; }
  if (screen.kind === 'item') { eventItem(run, screen.rarity, act); return; }
  if (screen.kind === 'upgradeAny') { takeOffer(run, { kind: 'UPGRADE_ANY' }); return; }
  dropForEvent(run);
}

function chooseOption(run: RunState, event: EventDef): 0 | 1 {
  const wanted = run.policy.eventChoice(run.hero, event);
  const other = wanted === 0 ? 1 : 0;
  return eventOptionEnabled(run.hero, event.options[wanted]) ? wanted : other;
}

function eventRoom(run: RunState, act: number): void {
  const event = pickEvent(run.rng);
  const choice = chooseOption(run, event);
  countEvent(run.tally, event.id, choice);
  const option = event.options[choice];
  if (!eventOptionEnabled(run.hero, option)) {return;}
  applyEventCosts(run.hero, option);
  const screen = screenEffectOf(option);
  if (screen) {eventScreen(run, screen, act);}
}

interface Room { act: number; biome: Biome; node: MapNode }

function fightRoom(run: RunState, { act, biome, node }: Room): Ending | null {
  const { hero, rng, tally } = run;
  const elite = node.type === 'ELITE';
  if (elite) {
    tally.elitesFought += 1;
    tally.hpAtElite.push(hero.hp / Math.max(1, derive(hero).maxHp));
  }
  const enemyId = foeFor(node, biome, rng);
  const enemy = spawnEnemy(enemyId, run.clears, act);
  prepareFor(run, enemy.def);
  ignitePendingBurn(hero, act);
  const outcome = runBattle({ hero, enemy, policy: run.policy, rng, verbs: tally.verbs });
  if (!outcome.won) {
    const deathKind = outcome.stalled ? 'STALL' : elite ? 'ELITE' : 'NORMAL';
    return { won: false, actReached: act, deathBy: outcome.stalled ? 'STALL' : enemyId, deathKind };
  }
  run.clears += 1;
  grantClear(hero, elite ? 'ELITE' : 'NORMAL');
  spendAll(hero, run.policy);
  offerLoot(run, elite ? 'ELITE' : 'FIGHT', act);
  return null;
}

export function playRoom(run: RunState, room: Room): Ending | null {
  const { type } = room.node;
  run.tally.rooms.push(type);
  if (type === 'REST') {
    fullHeal(run.hero);
    refillPotions(run.hero);
    return null;
  }
  if (type === 'LOOT') {
    run.tally.chestsOpened += 1;
    offerLoot(run, 'LOOT', room.act);
    return null;
  }
  if (type === 'EVENT') {
    eventRoom(run, room.act);
    return null;
  }
  return fightRoom(run, room);
}

export function bossRoom(run: RunState, act: number, biome: Biome): Ending | null {
  const { hero } = run;
  healFraction(hero, BOSS_ENTRY_HEAL);
  const boss = spawnEnemy(biome.boss, run.clears, act);
  prepareFor(run, boss.def);
  ignitePendingBurn(hero, act);
  const entry = derive(hero);
  const outcome = runBattle({ hero, enemy: boss, policy: run.policy, rng: run.rng, verbs: run.tally.verbs });
  run.probes.push(probeOf(act, run.clears, entry, { boss, outcome }));
  if (!outcome.won) {
    return { won: false, actReached: act, deathBy: outcome.stalled ? 'STALL' : biome.boss, deathKind: outcome.stalled ? 'STALL' : 'BOSS' };
  }
  run.clears += 1;
  grantClear(hero, 'BOSS');
  spendAll(hero, run.policy);
  offerLoot(run, 'BOSS', act);
  return null;
}
