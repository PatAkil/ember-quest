// Ember Quest v3 — data barrel + validateData(). Headless.
//
// validateData() returns [] when the tables are legal (DESIGN.md → Module
// layout). main.ts logs it in dev; sim/run.mjs refuses to run when it is
// non-empty. Every check names the row it failed so the fix is a lookup.

import type { Element, EnemyDef, LootSource, RelicStat, SetId, SigilId, SkillId, Slot, StatusKind } from '../types';
import { ACTS, DEBUFFS, ELEMENTS, LOOT_COUNT, SLOTS, SUBSTAT_POOL, BUFFS } from '../types';
import { SKILLS, SKILL_IDS } from './skills';
import { CHARACTERS, ROSTER, SLICE_PARTY } from './characters';
import { ACT_MULT, BIOMES, BIOME_PLAN, BOSS_HP, ENEMIES } from './enemies';
import { SETS, SET_IDS, TWO_PIECE_SETS, FOUR_PIECE_SETS } from './sets';
import { SIGILS, SIGIL_IDS } from './sigils';
import { PACTS, PACT_IDS } from './pacts';
import { ASCENSION } from './ascension';
import { DROP_LEVEL, LOOT_WEIGHTS, MAIN_BY_SLOT, MAIN_SIGNATURE, RELIC_MAIN_BASE, SUBSTAT_RANGES } from './relics';

export {
  SKILLS, SKILL_IDS, CHARACTERS, ROSTER, SLICE_PARTY, ENEMIES, BIOMES, BIOME_PLAN, ACT_MULT, BOSS_HP,
  SETS, SET_IDS, TWO_PIECE_SETS, FOUR_PIECE_SETS, SIGILS, SIGIL_IDS, PACTS, PACT_IDS, ASCENSION,
  RELIC_MAIN_BASE, MAIN_BY_SLOT, MAIN_SIGNATURE, SUBSTAT_RANGES, LOOT_WEIGHTS, DROP_LEVEL,
};
export { ELITE_MULT, BOSS_MULT, KIND_MULT, LAP_MULT } from './enemies';

const NAME_MAX = { character: 16, skill: 14, set: 8, enemy: 16, biome: 12, blurb: 30, pact: 16 } as const;

/** Dev-only table check. Returns [] when the content is legal. */
export function validateData(): string[] {
  const bad: string[] = [];
  const statusSources = new Set<StatusKind>();

  // --- skills ------------------------------------------------------------
  for (const id of SKILL_IDS) {
    const s = SKILLS[id];
    if (s.id !== id) bad.push(`${id}: id mismatch`);
    if (s.name.length > NAME_MAX.skill) bad.push(`${id}: name ${s.name.length} chars`);
    if (s.cooldown !== 0 && (s.cooldown < 2 || s.cooldown > 5)) bad.push(`${id}: cooldown ${s.cooldown} outside 0 or 2..5`);
    if ((s.hits === 0) !== (s.mult === 0)) bad.push(`${id}: a pure heal/buff is mult 0 AND hits 0`);
    for (const a of s.applies ?? []) {
      statusSources.add(a.status);
      if (a.chance <= 0 || a.chance > 1) bad.push(`${id}: chance ${a.chance}`);
      if (a.turns < 1) bad.push(`${id}: ${a.status} turns ${a.turns}`);
      if (a.status === 'SHIELD' && !a.magnitude) bad.push(`${id}: SHIELD without magnitude`);
      const buff = BUFFS.includes(a.status);
      const allySide = a.target ? ['ALLY', 'ALL_ALLIES', 'SELF', 'LOWEST_HP_ALLY'].includes(a.target) : ['ALLY', 'ALL_ALLIES', 'SELF', 'LOWEST_HP_ALLY'].includes(s.target);
      if (buff && !allySide) bad.push(`${id}: buff ${a.status} on an enemy-side target`);
      if (!buff && allySide) bad.push(`${id}: debuff ${a.status} on an ally-side target`);
    }
  }

  // --- characters --------------------------------------------------------
  const charIds = Object.keys(CHARACTERS);
  for (const id of charIds) {
    const c = CHARACTERS[id];
    if (c.id !== id) bad.push(`${id}: id mismatch`);
    if (c.name.length > NAME_MAX.character) bad.push(`${id}: name ${c.name.length} chars`);
    if (c.skills.length !== 3) bad.push(`${id}: needs exactly three skills`);
    c.skills.forEach((sk, i) => {
      if (!SKILLS[sk]) bad.push(`${id}: unknown skill ${sk}`);
      else if (i === 0 && SKILLS[sk].cooldown !== 0) bad.push(`${id}: skill 1 must have cooldown 0`);
      else if (i > 0 && SKILLS[sk].cooldown === 0) bad.push(`${id}: skill ${i + 1} must have a cooldown`);
    });
    if ('upgrades' in c.awakening) {
      const up = c.awakening.upgrades;
      if (!SKILLS[up.to]) bad.push(`${id}: awakening upgrades to unknown ${up.to}`);
      else if (SKILLS[up.to].cooldown !== SKILLS[c.skills[up.slot]].cooldown) bad.push(`${id}: awakened skill changes its cooldown`);
    } else if (Object.keys(c.awakening.bonus).length === 0) bad.push(`${id}: awakening bonus is empty`);
    if (!ELEMENTS.includes(c.element)) bad.push(`${id}: unknown element`);
    if (c.leader.element && c.leader.elementAmount === undefined) bad.push(`${id}: elemental leader without elementAmount`);
  }
  for (const id of ROSTER) if (!CHARACTERS[id]) bad.push(`ROSTER names unknown ${id}`);
  for (const id of SLICE_PARTY) if (!CHARACTERS[id]) bad.push(`SLICE_PARTY names unknown ${id}`);

  // --- enemies and biomes ------------------------------------------------
  const inBiome = new Set<string>();
  const enemyOf = (id: string): EnemyDef | undefined => ENEMIES[id];
  for (const [id, e] of Object.entries(ENEMIES)) {
    if (e.id !== id) bad.push(`${id}: id mismatch`);
    if (e.name.length > NAME_MAX.enemy) bad.push(`${id}: name ${e.name.length} chars`);
    if (e.skills.length < 1) bad.push(`${id}: no skills`);
    if (e.kind === 'BOSS') {
      if (e.skills.length !== 4) bad.push(`${id}: a boss carries four skills`);
      if (!e.skills.some((sk) => SKILLS[sk]?.target === 'ALL_ENEMIES')) bad.push(`${id}: a boss needs an ALL_ENEMIES skill`);
    } else if (e.skills.length > 3) bad.push(`${id}: more than three skills`);
    if (SKILLS[e.skills[0]]?.cooldown !== 0) bad.push(`${id}: skills[0] must have cooldown 0`);
    for (const sk of e.skills) {
      if (!SKILLS[sk]) bad.push(`${id}: unknown skill ${sk}`);
      else for (const a of SKILLS[sk].applies ?? []) statusSources.add(a.status);
    }
    if (e.resist && (e.resist.PHYSICAL > 40 || e.resist.MAGIC > 40)) bad.push(`${id}: resist above 40`);
  }
  BIOMES.forEach((b, act) => {
    if (b.name.length > NAME_MAX.biome) bad.push(`${b.name}: biome name ${b.name.length} chars`);
    const plan = BIOME_PLAN[act];
    if (plan && (plan.name !== b.name || plan.dominant !== b.dominant || plan.foil !== b.foil)) bad.push(`${b.name}: disagrees with BIOME_PLAN`);
    const boss = enemyOf(b.boss);
    if (!boss) bad.push(`${b.name}: unknown boss ${b.boss}`);
    else {
      inBiome.add(b.boss);
      if (boss.kind !== 'BOSS') bad.push(`${b.name}: ${b.boss} is not a BOSS`);
      const want: Element = act % 2 === 0 ? 'DARK' : 'LIGHT';
      if (boss.element !== want) bad.push(`${b.name}: boss must be ${want}`);
    }
    const nonBoss = new Set<string>();
    const checkPacks = (packs: string[][], label: string, elite: boolean) => {
      if (!packs.some((p) => p.length <= 2)) bad.push(`${b.name}: ${label} needs a pack of width <= 2`);
      for (const p of packs) {
        if (p.length < 1 || p.length > 3) bad.push(`${b.name}: ${label} pack width ${p.length}`);
        let supports = 0;
        let normals = 0;
        for (const id of p) {
          const e = enemyOf(id);
          if (!e) { bad.push(`${b.name}: unknown enemy ${id}`); continue; }
          inBiome.add(id);
          nonBoss.add(id);
          if (e.support) supports += 1;
          if (e.kind === 'NORMAL') normals += 1;
          if (e.kind === 'BOSS') bad.push(`${b.name}: boss ${id} inside a pack`);
        }
        if (p.length === 3 && supports !== 1) bad.push(`${b.name}: width-3 pack [${p.join(',')}] needs exactly one support`);
        if (elite && act >= 2 && normals === 0) bad.push(`${b.name}: elite pack [${p.join(',')}] needs a NORMAL from act 3`);
      }
    };
    checkPacks(b.fights, 'fights', false);
    checkPacks(b.elites, 'elites', true);
    let dominant = 0;
    let other = 0;
    for (const id of nonBoss) {
      const e = enemyOf(id);
      if (!e) continue;
      if (e.element === b.dominant) dominant += 1;
      else if (e.element === b.foil) other += 1;
      else bad.push(`${b.name}: ${id} is neither dominant nor foil`);
    }
    if (dominant * 3 < (dominant + other) * 2) bad.push(`${b.name}: fewer than two thirds dominant`);
  });
  for (const id of Object.keys(ENEMIES)) if (!inBiome.has(id)) bad.push(`enemy in no biome: ${id}`);
  if (ACT_MULT.hp.length !== ACTS || ACT_MULT.atk.length !== ACTS || ACT_MULT.def.length !== ACTS) bad.push('ACT_MULT needs six entries');
  if (BOSS_HP.length !== ACTS) bad.push('BOSS_HP needs six entries');
  if (BIOME_PLAN.length !== ACTS) bad.push('BIOME_PLAN needs six biomes');

  // --- relics --------------------------------------------------------------
  for (const slot of SLOTS) {
    const mains = MAIN_BY_SLOT[slot];
    const fixed: Partial<Record<Slot, RelicStat>> = { WEAPON: 'ATK', ARMOR: 'HP', CHALICE: 'DEF' };
    const f = fixed[slot];
    if (f && (mains.length !== 1 || mains[0] !== f)) bad.push(`${slot}: main must be fixed ${f}`);
    if (mains.includes('SPD') && slot !== 'BOOTS') bad.push(`${slot}: SPD only on BOOTS`);
    if ((mains.includes('CRIT') || mains.includes('CDMG')) && slot !== 'NECKLACE') bad.push(`${slot}: CRIT/CDMG only on NECKLACE`);
    if ((mains.includes('ACC') || mains.includes('RES')) && slot !== 'TOME') bad.push(`${slot}: ACC/RES only on TOME`);
    for (const sig of MAIN_SIGNATURE[slot]) if (!mains.includes(sig)) bad.push(`${slot}: signature ${sig} not a main`);
  }
  for (const key of SUBSTAT_POOL) {
    const r = SUBSTAT_RANGES[key];
    if (!r) bad.push(`SUBSTAT_RANGES missing ${key}`);
    else if (r[0] > r[1] || r[0] < 1) bad.push(`SUBSTAT_RANGES ${key}: ${r[0]}..${r[1]}`);
    if (!(key in RELIC_MAIN_BASE)) bad.push(`RELIC_MAIN_BASE missing ${key}`);
  }
  for (const src of Object.keys(LOOT_WEIGHTS) as Exclude<LootSource, 'SUMMON'>[]) {
    const rows = LOOT_WEIGHTS[src];
    if (rows.length !== ACTS) bad.push(`${src}: needs one weight row per act`);
    rows.forEach((row, act) => {
      const sum = row[0] + row[1] + row[2] + row[3];
      if (sum !== 100) bad.push(`${src} act ${act + 1}: weights sum to ${sum}`);
    });
  }
  for (const src of Object.keys(LOOT_COUNT) as LootSource[]) if (LOOT_COUNT[src] < 1) bad.push(`${src}: LOOT_COUNT < 1`);
  if (DROP_LEVEL.length !== ACTS) bad.push('DROP_LEVEL needs six rows');

  // --- sets, sigils, pacts, ascension -------------------------------------
  if (TWO_PIECE_SETS.length !== 8 || FOUR_PIECE_SETS.length !== 8) bad.push('sets: eight of each size');
  for (const id of SET_IDS) {
    const s = SETS[id];
    if (s.id !== id) bad.push(`${id}: id mismatch`);
    if (s.name.length > NAME_MAX.set) bad.push(`${id}: set name ${s.name.length} chars`);
    if (s.pieces !== 2 && s.pieces !== 4) bad.push(`${id}: pieces ${s.pieces}`);
    if (s.bonus.kind === 'STUN_ON_HIT') statusSources.add('STUN');
    if (s.bonus.kind === 'IMMUNITY_START') statusSources.add('IMMUNITY');
    if (s.bonus.kind === 'SHIELD_START') statusSources.add('SHIELD');
    if (s.bonus.kind === 'COUNTER') statusSources.add('COUNTER');
  }
  const perSlot: Record<Slot, number> = { WEAPON: 0, BOOTS: 0, ARMOR: 0, NECKLACE: 0, CHALICE: 0, TOME: 0 };
  for (const id of SIGIL_IDS) {
    const s = SIGILS[id];
    if (s.id !== id) bad.push(`${id}: id mismatch`);
    perSlot[s.slot] += 1;
    if (s.blurb.length > NAME_MAX.blurb) bad.push(`${id}: blurb ${s.blurb.length} chars`);
    if (s.kindled) {
      if (s.kindled.blurb.length > NAME_MAX.blurb) bad.push(`${id}: kindled blurb ${s.kindled.blurb.length} chars`);
      if (s.kindled.blurb === s.blurb) bad.push(`${id}: kindled blurb must differ`);
      if (s.kindled.effect.kind !== s.effect.kind) bad.push(`${id}: kindled effect changes kind`);
    }
    if (s.effect.kind === 'GRUDGE') { statusSources.add('ATK_UP'); if (s.kindled) statusSources.add('SHIELD'); }
    if (s.effect.kind === 'THORNS') { statusSources.add('COUNTER'); if (s.kindled) statusSources.add('DEF_BREAK'); }
  }
  for (const slot of SLOTS) if (perSlot[slot] !== 2) bad.push(`${slot}: needs exactly two sigils, has ${perSlot[slot]}`);
  if (PACT_IDS.length < 6) bad.push('pacts: fewer than six');
  for (const id of PACT_IDS) {
    const p = PACTS[id];
    if (p.id !== id) bad.push(`${id}: id mismatch`);
    if (p.name.length > NAME_MAX.pact) bad.push(`${id}: pact name ${p.name.length} chars`);
    if (p.blurb.length > NAME_MAX.blurb) bad.push(`${id}: blurb ${p.blurb.length} chars`);
    if (p.curse.kind === 'BOSS_INVINCIBLE_START') statusSources.add('INVINCIBLE');
  }
  if (ASCENSION.length !== 11) bad.push('ASCENSION needs eleven rows');
  if (ASCENSION[0].enemyHpPct !== 0 || ASCENSION[0].enemyRes !== 0) bad.push('ASCENSION[0] must be the identity');

  // --- every status has a source; every id defined is used -----------------
  for (const st of [...DEBUFFS, ...BUFFS]) if (!statusSources.has(st)) bad.push(`status with no source: ${st}`);
  const usedSkills = new Set<SkillId>();
  for (const c of Object.values(CHARACTERS)) {
    for (const sk of c.skills) usedSkills.add(sk);
    if ('upgrades' in c.awakening) usedSkills.add(c.awakening.upgrades.to);
  }
  for (const e of Object.values(ENEMIES)) for (const sk of e.skills) usedSkills.add(sk);
  for (const id of SKILL_IDS) if (!usedSkills.has(id)) bad.push(`skill defined but never used: ${id}`);
  void (0 as unknown as SetId); void (0 as unknown as SigilId);
  return bad;
}
