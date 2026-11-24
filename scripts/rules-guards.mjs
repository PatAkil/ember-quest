import assert from 'node:assert/strict';
import { fightOf, seeded } from './rules-foe.mjs';

const itemOf = (sim, id) => {
  const item = sim.ITEMS.find((i) => i.id === id);
  assert.ok(item, `no item ${id}`);
  return item;
};

function potionAtFull(sim) {
  const f = fightOf(sim, 'SLIME');
  assert.equal(f.hero.hp, sim.derive(f.hero).maxHp);
  assert.ok(!sim.canDrinkPotion(f.hero) && !sim.canAfford(f.hero, 'POTION'), 'POTION offered at full HP');
  const r = sim.resolveTurn(f.hero, f.battle, 'POTION', 3);
  assert.equal(r.hero.healed, 0);
  assert.equal(f.hero.potions, 2, 'a potion was spent at full HP');
  f.hero.hp -= 1;
  assert.ok(sim.canDrinkPotion(f.hero) && sim.canAfford(f.hero, 'POTION'), 'a hurt hero cannot drink');
  f.hero.potions = 0;
  assert.ok(!sim.canDrinkPotion(f.hero), 'drank from an empty flask');
  const grail = fightOf(sim, 'SLIME');
  sim.equip(grail.hero, itemOf(sim, 'HOLY_GRAIL'), 0);
  grail.hero.hp = sim.derive(grail.hero).maxHp - 2;
  assert.ok(!sim.canAfford(grail.hero, 'POTION'), 'POTION offered although turn-start regen fills the HP');
  const blood = fightOf(sim, 'SLIME');
  sim.equip(blood.hero, itemOf(sim, 'NIGHT_SCEPTRE'), 0);
  blood.hero.hp = sim.derive(blood.hero).maxHp;
  assert.ok(sim.canAfford(blood.hero, 'POTION') && sim.healPreview(blood.hero, blood.battle, 'POTION') > 0, 'BLOOD at full HP leaves room the potion fills');
}

function watchPotions(sim, base, seen) {
  return {
    ...base,
    act: (hero, d, battle, actions) => {
      if (actions.includes('POTION')) {
        assert.ok(sim.healPreview(hero, battle, 'POTION') > 0 && hero.hp <= d.maxHp, 'a policy was offered a POTION that heals nothing');
        seen.offered += 1;
      }
      return base.act(hero, d, battle, actions);
    },
  };
}

function policiesSkipFullPotions(sim) {
  const seen = { offered: 0 };
  for (const name of ['balanced', 'naive', 'random']) {
    const rng = sim.createSeededRng(23).next;
    for (let i = 0; i < 40; i++) {sim.simulateRun(watchPotions(sim, sim.POLICIES[name], seen), rng);}
  }
  assert.ok(seen.offered > 0, 'no policy was ever offered a potion');
  return seen.offered;
}

function mendAtFull(sim) {
  const f = fightOf(sim, 'SLIME', 3);
  assert.equal(f.battle.intent, 'STRIKE', 'a whole SLIME shows MEND');
  f.battle.intent = 'MEND';
  const r = sim.enemyAct(f.hero, f.battle, seeded(sim, 1));
  assert.equal(r.move, 'STRIKE', 'a whole foe resolved MEND');
  assert.equal(r.healed, 0);
  assert.equal(f.enemy.mended, false, 'a wasted MEND spent the once-only flag');
  const g = fightOf(sim, 'SLIME', 3);
  g.enemy.hp -= 20;
  g.battle.intent = 'MEND';
  const m = sim.enemyAct(g.hero, g.battle, seeded(sim, 1));
  assert.ok(m.move === 'MEND' && m.healed > 0 && g.enemy.mended, 'a hurt foe could not MEND');
}

const card = (item) => ({ kind: 'ITEM', item });

function starterPlacement(sim) {
  const rng = seeded(sim, 5);
  const epic = itemOf(sim, 'MIRROR_PLATE');
  const common = itemOf(sim, 'LEATHER_VEST');
  const scroll = { kind: 'SCROLL', spell: 'WATER' };
  const offers = [scroll, card(epic), card(common)];
  sim.ensureStarterWeapon(offers, sim.createHero(), { n: 0, want: 3 }, rng);
  assert.equal(offers[0], scroll, 'the scroll was replaced');
  assert.equal(offers[1].item, epic, 'the EPIC card was replaced');
  assert.ok(offers[2].item.slot === 'WEAPON' && offers[2].item.rarity === 'COMMON', 'the weakest card is not the weapon');
  const later = [card(common)];
  sim.ensureStarterWeapon(later, sim.createHero(), { n: 1, want: 1 }, rng);
  assert.equal(later[0].item, common, 'a weapon was forced after the first act');
  const short = [scroll, card(epic)];
  sim.ensureStarterWeapon(short, sim.createHero(), { n: 0, want: 3 }, rng);
  assert.ok(short.length === 3 && short[2].item.slot === 'WEAPON', 'a short table did not gain the weapon');
  const scrolls = [scroll];
  sim.ensureStarterWeapon(scrolls, sim.createHero(), { n: 0, want: 1 }, rng);
  assert.deepEqual(scrolls, [scroll], 'a scroll-only table lost its scroll');
}

function bossTablesUntouched(sim) {
  const ref = { n: 0, plan: sim.storyPlan()[0] };
  for (let seed = 0; seed < 200; seed++) {
    const offers = sim.rollLoot('BOSS', ref, sim.createHero(), sim.createSeededRng(seed).next);
    assert.ok(!offers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON' && o.item.rarity === 'COMMON'), `seed ${seed}: a boss table carried a forced weapon`);
  }
}

function thornedFight(sim) {
  const enemy = sim.spawnEnemy('SERAPH', { n: 3, clears: 20, descentClears: null }, ['THORNED']);
  enemy.hp = enemy.maxHp = 100000;
  const hero = sim.createHero();
  hero.baseSpells.push('THUNDER');
  hero.alloc.MAG = 60;
  hero.bonusMaxHp = 300;
  hero.hp = sim.derive(hero).maxHp;
  hero.mp = 100;
  return { hero, battle: sim.createBattle(enemy) };
}

function thornsLine(sim) {
  for (let seed = 0; seed < 40; seed++) {
    const f = thornedFight(sim);
    const r = sim.heroAct(f.hero, f.battle, 'THUNDER', seeded(sim, seed));
    if (r.missed) {continue;}
    const total = r.hits.reduce((n, h) => n + h.dmg, 0);
    assert.ok(r.thorns > 0, `seed ${seed}: no thorns`);
    assert.ok(!r.text.includes('THORNS'), `seed ${seed}: THORNS spliced into "${r.text}"`);
    const tails = [`${r.hits.map((h) => h.dmg).join('+')}!`, `${total}!`];
    assert.ok(tails.some((tail) => r.text.endsWith(tail)), `seed ${seed}: "${r.text}" lost the damage`);
    assert.equal(r.thornsText, `THORNS BITE YOU FOR ${r.thorns}`);
  }
  const f = thornedFight(sim);
  f.hero.hp = 1;
  f.hero.ember = 100;
  const r = sim.heroAct(f.hero, f.battle, 'BURST', seeded(sim, 1));
  assert.ok(r.heroDead && r.thornsText === `THE THORNS TAKE YOU! (${r.thorns})`, `a thorns death reads "${r.thornsText}"`);
}

function sweepHeroes(sim) {
  const fresh = sim.createHero();
  const armed = sim.createHero();
  sim.equip(armed, itemOf(sim, 'IRON_SWORD'), 2);
  sim.equip(armed, itemOf(sim, 'LEATHER_VEST'), 1);
  sim.equip(armed, itemOf(sim, 'BONE_CHARM'), 0);
  Object.assign(armed.alloc, { MDEF: 4, DEF: 3, CRIT: 2, HP: 3, MP: 2 });
  const capped = sim.createHero();
  Object.assign(capped.alloc, { MDEF: 40, DEF: 40, CRIT: 40 });
  return [['fresh', fresh], ['armed', armed], ['capped', capped]];
}

function ghostOf(sim, hero, item, level) {
  return sim.derive({ ...hero, equipment: { ...hero.equipment, [item.slot]: item }, levels: { ...hero.levels, [item.slot]: level } });
}

function compareSweep(sim) {
  let cases = 0;
  for (const [name, base] of sweepHeroes(sim)) {
    for (const item of sim.ITEMS) {
      const heroes = [[name, base], [`${name} wearing it`, wearing(sim, base, item)]];
      for (const [who, hero] of heroes) {cases += sweepLevels(sim, who, hero, item);}
    }
  }
  return cases;
}

function wearing(sim, base, item) {
  const hero = { ...base, equipment: { ...base.equipment }, levels: { ...base.levels }, pack: [] };
  sim.equip(hero, item, 0);
  return hero;
}

function sweepLevels(sim, who, hero, item) {
  const before = sim.derive(hero);
  let cases = 0;
  for (let level = 0; level <= sim.maxLevelFor(item); level++) {
    const after = ghostOf(sim, hero, item, level);
    const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
    const cmp = sim.compareFull(hero, item, level);
    const where = `${who}: ${item.id} +${level}`;
    assert.equal(cmp.rows.length, Math.min(6, changed.length), `${where}: ${changed.join(',')} changed, rows ${cmp.rows.map((r) => r.label).join(',')}`);
    if (level === 0 && hero.equipment[item.slot] && changed.length > 0) {
      assert.notEqual(sim.compareLine(hero, item), 'NO STAT CHANGE', `${where}: ${changed.join(',')} changed`);
    }
    upgradeText(sim, { who, hero, item, level });
    cases += 1;
  }
  return cases;
}

function upgradeText(sim, { who, hero, item, level }) {
  if (level === 0 || hero.equipment[item.slot] !== item) {return;}
  const before = ghostOf(sim, hero, item, level - 1);
  const after = ghostOf(sim, hero, item, level);
  if (!Object.keys(before).some((k) => before[k] !== after[k])) {return;}
  const offer = { kind: 'UPGRADE', target: { where: 'WORN', slot: item.slot }, item, toLevel: level };
  assert.notEqual(sim.compareOffer(hero, offer), 'NO CHANGE', `${who}: ${item.id} -> +${level} changes stats but reads NO CHANGE`);
}

const FALL_FOES = ['SLIME', 'GOBLIN', 'WRAITH_LORD', 'FROST_WISP', 'YETI', 'SAND_GOLEM', 'SERAPH', 'HOLLOW'];
const FALL_CASES = [
  { move: 'HEAVY', chain: 1, word: 'YOU PARRY' },
  { move: 'STRIKE', chain: 1, word: 'YOU BLOCK' },
  { move: 'STRIKE', chain: 2, word: 'YOUR GUARD TIRES' },
  { move: 'SCORCH', chain: 1, word: 'YOU BLOCK' },
];

function fallOf(sim, id, { move, chain, revive, atk }) {
  const f = fightOf(sim, id);
  if (revive) {sim.equip(f.hero, sim.ITEMS.find((i) => i.effect.kind === 'REVIVE'), 0);}
  Object.assign(f.battle, { intent: move, guarding: chain > 0, guardChain: chain });
  f.enemy.atk = atk;
  f.hero.hp = 1;
  return sim.enemyAct(f.hero, f.battle, () => 0.5);
}

function guardedFallLines(sim) {
  let lines = 0;
  for (const id of FALL_FOES) {
    for (const c of FALL_CASES) {
      for (const [revive, end] of [[false, 'YOU FALL!'], [true, 'YOU RISE!']]) {
        for (const atk of [40, 40000, 1e27]) {
          const r = fallOf(sim, id, { ...c, revive, atk });
          assert.ok(r.heroDead !== revive && r.revived === revive, `${id} ${c.move}: no fall`);
          assert.ok(r.text.startsWith(`${c.word} - `) && r.text.endsWith(end) && r.text.length <= 52, `${id} ${c.move} chain ${c.chain}: ${r.text}`);
          lines += 1;
        }
      }
    }
    const open = fallOf(sim, id, { move: 'HEAVY', chain: 0, revive: false, atk: 40 });
    assert.ok(open.text.endsWith(' - YOU FALL!') && !open.text.startsWith('YOU '), `${id} open kill: ${open.text}`);
  }
  return lines;
}

function guardedHitLines(sim) {
  let lines = 0;
  for (const id of FALL_FOES) {
    for (const c of FALL_CASES) {
      const f = fightOf(sim, id);
      Object.assign(f.battle, { intent: c.move, guarding: true, guardChain: c.chain });
      f.enemy.atk = 40;
      f.hero.hp = 1e9;
      const r = sim.enemyAct(f.hero, f.battle, () => 0.5);
      if (r.dodged) {continue;}
      assert.ok(r.text.startsWith(`${c.word} - TAKE ${String(r.dmg)}`) && r.text.length <= 52, `${id} ${c.move} chain ${c.chain} guarded hit: ${r.text}`);
      assert.ok(!/PARRIED FOR|GRAZES|HITS FOR/.test(r.text), `${id}: a guarded hit reads as damage dealt: ${r.text}`);
      lines += 1;
    }
  }
  return lines;
}

export function guardRules(sim) {
  potionAtFull(sim);
  const offered = policiesSkipFullPotions(sim);
  mendAtFull(sim);
  starterPlacement(sim);
  bossTablesUntouched(sim);
  thornsLine(sim);
  const compared = compareSweep(sim);
  const falls = guardedFallLines(sim);
  const hits = guardedHitLines(sim);
  return [
    `POTION refused at full HP and when turn-start regen fills it (BLOOD leaves room); 360 policy runs offered POTION ${String(offered)} times, always with HP to restore`,
    'a whole foe never MENDs (STRIKE instead, the once-only flag kept)',
    'the act-1 starter weapon replaces the weakest non-scroll card, never an EPIC or a scroll, not after act 1, not on boss tables',
    'THORNS is its own line; the damage line keeps its numbers',
    `${String(compared)} item/level/hero compares: one row per changed derived stat (max 6), NO STAT CHANGE only when none changed`,
    `${String(falls)} guarded killing blows (up to 1e27 ATK) keep YOU PARRY/YOU BLOCK/YOUR GUARD TIRES and end YOU FALL!/YOU RISE! within 52`,
    `${String(hits)} guarded hits read <WORD> - TAKE n within 52`,
  ].join('; ');
}
