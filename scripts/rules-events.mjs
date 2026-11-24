import assert from 'node:assert/strict';

const MAP_SEEDS = 5000;
const EVENT_TRIALS = 2000;
const EVENT_STAGES = [1, 2, 3, 4];

const option = (...effects) => ({ label: 'TEST', effects });

function effectRules(sim) {
  const hero = sim.createHero();
  hero.hp = 5;
  sim.applyEventCosts(hero, option({ kind: 'hpPct', amount: -0.9 }));
  assert.equal(hero.hp, 1, 'hpPct took HP below 1');
  const base = sim.derive(hero).maxHp;
  sim.applyEventCosts(hero, option({ kind: 'maxHp', amount: 6 }));
  sim.fullHeal(hero);
  assert.equal(sim.derive(hero).maxHp, base + 6, 'maxHp gain did not persist through derive');
  sim.applyEventCosts(hero, option({ kind: 'maxHp', amount: -10 }));
  assert.equal(sim.derive(hero).maxHp, base - 4, 'maxHp loss did not persist');
  assert.ok(hero.hp <= base - 4, 'HP above the reduced max');
  hero.potions = 2;
  sim.applyEventCosts(hero, option({ kind: 'potion', amount: 2 }));
  assert.equal(hero.potions, 2, 'potion gain not clamped to the max');
  hero.potions = 0;
  sim.applyEventCosts(hero, option({ kind: 'potion', amount: -1 }));
  assert.equal(hero.potions, 0, 'potion loss went below 0');
  return 'hpPct floors at 1 HP; maxHp persists through derive; potions clamp 0..max';
}

function wardedBurnRule(sim) {
  const hero = sim.createHero();
  const ward = sim.ITEMS.find((i) => i.effect.kind === 'BURN_WARD');
  assert.ok(ward, 'no BURN_WARD item to test with');
  sim.equip(hero, ward, 0);
  assert.ok(sim.burnWarded(hero), 'equipping a BURN_WARD item did not ward');
  const why = sim.eventOptionBlocker(hero, option({ kind: 'burnNextFight' }));
  assert.ok(why && why.length <= 24, `a warded hero may take a burn price (${String(why)})`);
  const bare = sim.createHero();
  sim.applyEventCosts(bare, option({ kind: 'burnNextFight' }));
  sim.equip(bare, ward, 0);
  const burn = sim.takePendingBurn(bare, 0);
  assert.ok(burn && bare.burn === burn, 'a ward put on after paying dodged the pending burn');
  assert.equal(bare.pendingBurn, 0, 'the pending burn was not consumed');
  return why;
}

function burnLeaks(sim) {
  const hero = sim.createHero();
  hero.burn = { perTurn: 9, turns: 2 };
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  const merged = sim.takePendingBurn(hero, 0);
  assert.deepEqual(merged, { perTurn: 9, turns: 3 }, `pending burn overwrote a larger burn: ${JSON.stringify(merged)}`);
  sim.grantClear(hero, 'NORMAL');
  assert.equal(hero.burn, null, 'a won fight left the hero burning');
  hero.burn = { perTurn: 4, turns: 3 };
  sim.restHero(hero);
  assert.equal(hero.burn, null, 'REST left the hero burning');
  hero.burn = { perTurn: 4, turns: 3 };
  sim.fullHeal(hero);
  assert.equal(hero.burn, null, 'fullHeal left the hero burning');
  return 'pending burn merges (larger perTurn kept); victory, REST and fullHeal put out the hero';
}

function burnRules(sim) {
  const hero = sim.createHero();
  assert.equal(sim.takePendingBurn(hero, 0), null, 'burn without a pending burn');
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  const first = sim.takePendingBurn(hero, 0);
  assert.deepEqual(first, { perTurn: Math.round(3 * sim.ACT_MULT[0]), turns: 3 }, `act 1 burn ${JSON.stringify(first)}`);
  assert.equal(sim.takePendingBurn(hero, 0), null, 'pending burn consumed twice');
  sim.applyEventCosts(hero, option({ kind: 'burnNextFight' }));
  const late = sim.takePendingBurn(hero, 3);
  assert.ok(late && late.perTurn > first.perTurn && late.turns === 3, `act 4 burn ${JSON.stringify(late)}`);
  const why = wardedBurnRule(sim);
  return `a warded hero cannot pay in fire (${why}) and a ward worn later does not dodge it; ${burnLeaks(sim)}; pendingBurn consumed once; ${String(first.perTurn)}/turn in act 1, ${String(late.perTurn)}/turn in act 4, 3 turns`;
}

function restFed(stages, s) {
  const fed = new Set();
  for (const n of stages[s - 1] ?? []) {if (n.type === 'REST') {for (const j of n.links) {fed.add(j);}}}
  return fed;
}

function checkEventMap(stages, seed) {
  assert.ok(EVENT_STAGES.some((s) => stages[s].some((n) => n.type === 'EVENT')), `seed ${seed}: no EVENT in stages 1-4`);
  stages.forEach((stage, s) => {
    const fed = restFed(stages, s);
    stage.forEach((n, j) => { assert.ok(n.type !== 'EVENT' || !fed.has(j), `seed ${seed}: EVENT ${s}.${j} linked from a REST`); });
  });
  const kept = ['ELITE', 'REST', 'LOOT'].filter((want) => stages.flat().some((n) => n.type === want));
  assert.equal(kept.length, 3, `seed ${seed}: an EVENT replaced the act's only ELITE, REST or LOOT`);
}

function eventMaps(sim) {
  let events = 0;
  for (let seed = 0; seed < MAP_SEEDS; seed++) {
    const stages = sim.generateMap(sim.createSeededRng(seed).next);
    checkEventMap(stages, seed);
    events += stages.flat().filter((n) => n.type === 'EVENT').length;
  }
  return `${MAP_SEEDS} maps: >= 1 EVENT in stages 1-4 (${(events / MAP_SEEDS).toFixed(2)} per map), none linked from a REST, ELITE + REST + LOOT kept`;
}

function randomHero(sim, rng) {
  const hero = sim.createHero();
  hero.hp = 1 + Math.floor(rng() * sim.derive(hero).maxHp);
  hero.potions = Math.floor(rng() * 3);
  if (rng() < 0.5) {hero.pack.push({ item: sim.ITEMS[Math.floor(rng() * sim.ITEMS.length)], level: 0 });}
  if (rng() < 0.3) {hero.pack.push({ item: sim.ITEMS[Math.floor(rng() * sim.ITEMS.length)], level: 0 });}
  return hero;
}

function choiceRules(sim) {
  const rng = sim.createSeededRng(11).next;
  let disabledSeen = 0;
  for (let t = 0; t < EVENT_TRIALS; t++) {
    const hero = randomHero(sim, rng);
    const event = sim.pickEvent(rng, hero);
    const open = event.options.map((o) => sim.eventOptionEnabled(hero, o));
    if (!open[0] || !open[1]) {disabledSeen += 1;}
    assert.ok(open.includes(true), `pickEvent drew ${event.id} with no enabled option`);
    const picks = Object.entries(sim.POLICIES).map(([name, p]) => [name, p.eventChoice(hero, event)]);
    picks.push(['randomEventChoice', sim.randomEventChoice(hero, event, rng)]);
    for (const [name, i] of picks) {assert.ok(open[i], `${name} chose a disabled option of ${event.id}`);}
  }
  assert.ok(disabledSeen > 100, `only ${disabledSeen} trials had a disabled option`);
  return `${EVENT_TRIALS} events (${disabledSeen} with a dim option): no policy chose a disabled option`;
}

function eventRuns(sim) {
  const rng = sim.createSeededRng(5).next;
  let taken = 0;
  for (let i = 0; i < 100; i++) {
    const r = sim.simulateRun(sim.POLICIES.balanced, rng);
    for (const split of Object.values(r.events ?? {})) {taken += split[0] + split[1];}
  }
  assert.ok(taken > 50, `only ${taken} events played in 100 runs`);
  return `${taken} events played in 100 balanced runs`;
}

function playableRules(sim) {
  const fresh = sim.createHero();
  for (const event of sim.EVENTS) {assert.ok(sim.eventPlayable(fresh, event), `${event.id} has no option a fresh hero can take`);}
  const stuck = sim.createHero();
  sim.equip(stuck, sim.ITEMS.find((i) => i.effect.kind === 'BURN_WARD'), 0);
  stuck.hp = 1;
  stuck.potions = 0;
  const rng = sim.createSeededRng(3).next;
  const drawn = new Set(Array.from({ length: 400 }, () => sim.pickEvent(rng, stuck).id));
  for (const id of drawn) {assert.ok(sim.eventPlayable(stuck, sim.EVENTS.find((e) => e.id === id) ?? sim.QUIET_EVENT), `${id} drawn but unplayable`);}
  return `every event playable by a fresh hero; pickEvent skips unplayable ones (${drawn.size} kinds drawn for a warded, empty, 1-HP hero)`;
}

function fullHpRules(sim) {
  const hero = sim.createHero();
  const bathe = sim.EVENTS.find((e) => e.id === 'POOL').options[0];
  assert.equal(sim.eventOptionBlocker(hero, bathe), 'ALREADY AT FULL HP', 'a paid heal-only option was open at full HP');
  const bless = sim.EVENTS.find((e) => e.id === 'PILGRIM').options[1];
  assert.equal(sim.eventOptionBlocker(hero, bless), null, 'a free heal (the blessing) was dim at full HP');
  hero.hp -= 5;
  assert.equal(sim.eventOptionBlocker(hero, bathe), null, 'a paid heal-only option was dim below full HP');
  const shrine = sim.EVENTS.find((e) => e.id === 'SHRINE').options[0];
  hero.hp += 5;
  hero.pack.push({ item: sim.ITEMS[0], level: 0 });
  assert.equal(sim.eventOptionBlocker(hero, shrine), null, 'an option with a heal and other boons was dim at full HP');
  const tired = sim.createHero();
  tired.potions = 0;
  sim.enterActRecovery(tired);
  sim.enterActRecovery(tired);
  sim.enterActRecovery(tired);
  assert.equal(tired.potions, 2, 'enterActRecovery: one potion per act, max 2');
  return 'a paid heal-only option is dim at full HP (ALREADY AT FULL HP), a free one stays open; entering an act gives a potion back (max 2)';
}

function epicIdol(sim) {
  const rng = sim.createSeededRng(9).next;
  for (let i = 0; i < 200; i++) {
    const got = sim.rollEventItem(sim.createHero(), 'EPIC', 0, rng);
    assert.equal(got?.rarity, 'EPIC', `act-1 EPIC event item rolled ${got?.rarity} ${got?.id}`);
  }
  return '200 act-1 EPIC event items are EPIC (minAct ignored at the named rarity)';
}

const FREE_TRIALS = 5000;

const costsNothing = (sim, option) => option.effects.every((e) => sim.effectIsGain(e));

function richerHero(sim, rng) {
  const hero = randomHero(sim, rng);
  if (rng() < 0.3) {hero.hp = sim.derive(hero).maxHp;}
  if (rng() < 0.2) {sim.equip(hero, sim.ITEMS.find((i) => i.effect.kind === 'BURN_WARD'), 0);}
  if (rng() < 0.2) {hero.bonusMaxHp = -Math.floor(rng() * 60);}
  for (const item of sim.ITEMS) {if (rng() < 0.02) {sim.equip(hero, item, Math.floor(rng() * 3));}}
  sim.derive(hero);
  hero.hp = Math.min(hero.hp, sim.derive(hero).maxHp);
  return hero;
}

function freeExitRules(sim) {
  const rng = sim.createSeededRng(23).next;
  for (let t = 0; t < FREE_TRIALS; t++) {
    const hero = richerHero(sim, rng);
    for (const event of [...sim.EVENTS, sim.QUIET_EVENT]) {
      const free = event.options.filter((o) => costsNothing(sim, o) && sim.eventOptionEnabled(hero, o));
      assert.ok(free.length > 0, `${event.id}: no enabled zero-cost option for hero hp ${hero.hp}/${sim.derive(hero).maxHp}, potions ${hero.potions}, pack ${hero.pack.length}`);
    }
  }
  return `${FREE_TRIALS} random heroes (full HP, warded, frail, empty): every event offers an enabled option that costs nothing`;
}

const NO_FREE_EXIT = 'no option that costs nothing';

function synthetic(options) {
  return { id: 'SYNTH', title: 'A TEST', lines: ['A TEST LINE.'], options };
}

function signAwareFreeExit(sim) {
  const paid = synthetic([
    { label: 'SELL A MEMORY', effects: [{ kind: 'sp', amount: -2 }] },
    { label: 'PRY IT OPEN', effects: [{ kind: 'maxHp', amount: -5 }, { kind: 'item', rarity: 'RARE' }] },
  ]);
  const paidBad = sim.validateEvents([paid]);
  assert.ok(paidBad.some((b) => b.includes(NO_FREE_EXIT)), `an SP-cost option counted as free: ${paidBad.join('; ')}`);
  assert.ok(paidBad.some((b) => b.includes('sp must be a gain')), 'an SP cost passed the amount check');
  const gift = synthetic([paid.options[1], { label: 'TAKE THE LESSON', effects: [{ kind: 'sp', amount: 1 }] }]);
  const giftBad = sim.validateEvents([gift]);
  assert.ok(!giftBad.some((b) => b.includes(NO_FREE_EXIT)), `an SP gain did not count as free: ${giftBad.join('; ')}`);
  return 'validateEvents is sign-aware: an SP-cost option is no free exit, an SP gain is';
}

export function eventRules(sim) {
  const bad = sim.validateEvents();
  assert.deepEqual(bad, [], `validateEvents: ${bad.join('; ')}`);
  return [signAwareFreeExit(sim), effectRules(sim), burnRules(sim), playableRules(sim), fullHpRules(sim), freeExitRules(sim), epicIdol(sim), eventMaps(sim), choiceRules(sim), eventRuns(sim)].join(' | ');
}
