import type { Biome, EnemyDef, Item, ItemEffect, LootSource, SpellId } from '../types';
import { ITEMS } from './items';
import { ENEMIES } from './enemies';
import { ACT_MULT, BIOMES, LOOT_COUNT, LOOT_WEIGHTS, SPELL_ORDER, SPELLS } from './world';

const EFFECT_KINDS: Record<ItemEffect['kind'], true> = {
  NONE: true, HEX_STRIKE: true, RAMP: true, TWIN_STRIKE: true, SPELL_TWICE: true,
  CHEAPER_SPELLS: true, DRAIN: true, REFLECT: true, REVIVE: true, MP_ON_HIT: true,
  GLASS: true, BLOOD: true, EXECUTE: true, FIRST_STRIKE: true, GRANT_SPELL: true,
};

type Rule<T> = [fails: (x: T) => boolean, message: (x: T) => string];

function applyRules<T>(rules: Rule<T>[], x: T, bad: string[]): void {
  for (const [fails, message] of rules) {
    if (fails(x)) {bad.push(message(x));}
  }
}

const mentions = (x: object, key: string) => key in x;

const ITEM_RULES: Rule<Item>[] = [
  [(it) => it.name.length > 13, (it) => `${it.id}: name ${it.name.length} chars`],
  [(it) => it.name !== it.name.toUpperCase(), (it) => `${it.id}: name not uppercase`],
  [(it) => it.blurb.length > 30, (it) => `${it.id}: blurb ${it.blurb.length} chars`],
  [(it) => it.blurb !== it.blurb.toUpperCase(), (it) => `${it.id}: blurb not uppercase`],
  [(it) => it.rarity !== 'COMMON' && it.effect.kind === 'NONE', (it) => `${it.id}: non-common with no effect`],
  [(it) => it.rarity === 'COMMON' && it.effect.kind !== 'NONE', (it) => `${it.id}: common with an effect`],
  [(it) => it.slot === 'TOME' && it.effect.kind !== 'GRANT_SPELL', (it) => `${it.id}: tome must grant a spell`],
  [(it) => it.slot === 'WEAPON' && !it.weaponKind, (it) => `${it.id}: weapon needs a weaponKind`],
  [(it) => it.slot !== 'WEAPON' && !!it.weaponKind, (it) => `${it.id}: non-weapon with a weaponKind`],
  [(it) => mentions(it, 'learn'), (it) => `${it.id}: still uses learn`],
  [(it) => it.rarity === 'LEGENDARY' && !!it.awaken, (it) => `${it.id}: legendary must not awaken`],
  [(it) => it.rarity !== 'LEGENDARY' && !it.awaken, (it) => `${it.id}: missing awaken (+2)`],
];

type Awaken = NonNullable<Item['awaken']>;
interface Awakening { it: Item; aw: Awaken }
interface AwakenEffect { it: Item; eff: ItemEffect }

const AWAKEN_RULES: Rule<Awakening>[] = [
  [({ aw }) => aw.blurb.length > 30, ({ it, aw }) => `${it.id}: awaken blurb ${aw.blurb.length} chars`],
  [({ aw }) => aw.blurb !== aw.blurb.toUpperCase(), ({ it }) => `${it.id}: awaken blurb not uppercase`],
  [({ it, aw }) => aw.blurb === it.blurb, ({ it }) => `${it.id}: awaken blurb same as base`],
  [({ aw }) => !aw.effect && Object.keys(aw.mods ?? {}).length === 0, ({ it }) => `${it.id}: awaken changes nothing`],
];

const discountOutOfRange = (eff: ItemEffect) => {
  if (eff.kind !== 'GRANT_SPELL') {return false;}
  const disc = eff.discount ?? 0;
  return disc < 0 || disc >= SPELLS[eff.spell].cost;
};

const tomeChangesSpell = ({ it, eff }: AwakenEffect) =>
  eff.kind === 'GRANT_SPELL' && it.effect.kind === 'GRANT_SPELL' && eff.spell !== it.effect.spell;

const AWAKEN_EFFECT_RULES: Rule<AwakenEffect>[] = [
  [({ eff }) => !(eff.kind in EFFECT_KINDS), ({ it }) => `${it.id}: awaken uses unknown effect kind`],
  [({ eff }) => eff.kind === 'NONE', ({ it }) => `${it.id}: awaken effect must not be NONE`],
  [({ eff }) => discountOutOfRange(eff), ({ it }) => `${it.id}: awaken discount out of range`],
  [({ it, eff }) => it.slot === 'TOME' && eff.kind !== 'GRANT_SPELL', ({ it }) => `${it.id}: tome awaken must grant a spell`],
  [({ it, eff }) => it.slot === 'TOME' && tomeChangesSpell({ it, eff }), ({ it }) => `${it.id}: tome awaken changes its spell`],
];

function validateItem(it: Item, bad: string[]): void {
  applyRules(ITEM_RULES, it, bad);
  const aw = it.rarity === 'LEGENDARY' ? undefined : it.awaken;
  if (!aw) {return;}
  applyRules(AWAKEN_RULES, { it, aw }, bad);
  if (aw.effect) {applyRules(AWAKEN_EFFECT_RULES, { it, eff: aw.effect }, bad);}
}

function validateItems(bad: string[]): void {
  const seen = new Set<string>();
  const usedKinds = new Set<string>();
  for (const it of ITEMS) {
    if (seen.has(it.id)) {bad.push(`duplicate item id ${it.id}`);}
    seen.add(it.id);
    validateItem(it, bad);
    usedKinds.add(it.effect.kind);
  }
  for (const kind of Object.keys(EFFECT_KINDS)) {
    if (!usedKinds.has(kind)) {bad.push(`effect kind never used: ${kind}`);}
  }
}

function validateSignatures(bad: string[]): Map<string, string> {
  const signatureOf = new Map<string, string>();
  for (const it of ITEMS) {
    if (!it.bossOnly) {continue;}
    const boss = ENEMIES[it.bossOnly];
    if (!boss) {bad.push(`${it.id}: bossOnly names unknown enemy ${it.bossOnly}`);}
    else if (boss.kind !== 'BOSS') {bad.push(`${it.id}: bossOnly ${it.bossOnly} is not a BOSS`);}
    const already = signatureOf.get(it.bossOnly);
    if (already) {bad.push(`${it.bossOnly}: two signature items (${already}, ${it.id})`);}
    else {signatureOf.set(it.bossOnly, it.id);}
  }
  return signatureOf;
}

const SPELL_RULES: Rule<SpellId>[] = [
  [(id) => !SPELL_ORDER.includes(id), (id) => `spell missing from SPELL_ORDER: ${id}`],
  [(id) => SPELLS[id].name.length > 9, (id) => `${id}: spell name too long`],
];

const ENEMY_RULES: Rule<EnemyDef>[] = [
  [(e) => e.name.length > 12, (e) => `${e.id}: enemy name ${e.name.length} chars`],
  [(e) => !!e.trait && e.trait.length > 14, (e) => `${e.id}: trait too long`],
  [(e) => e.def < 0 || e.def > 40 || e.mdef < 0 || e.mdef > 40, (e) => `${e.id}: resist out of 0..40`],
  [(e) => e.moves.length === 0, (e) => `${e.id}: empty move cycle`],
];

function validateSpellsAndEnemies(bad: string[]): void {
  for (const id of Object.keys(SPELLS) as SpellId[]) {applyRules(SPELL_RULES, id, bad);}
  for (const e of Object.values(ENEMIES)) {applyRules(ENEMY_RULES, e, bad);}
}

interface BiomeCheck { b: Biome; act: number; signatureOf: Map<string, string> }

function signatureMinActMismatch({ b, act, signatureOf }: BiomeCheck): string | null {
  const sig = signatureOf.get(b.boss);
  if (!sig) {return null;}
  const item = ITEMS.find((i) => i.id === sig);
  return item && (item.minAct ?? 0) !== act ? `${sig}: minAct should be ${act} (its boss lives there)` : null;
}

const BIOME_RULES: Rule<BiomeCheck>[] = [
  [({ b }) => mentions(b, 'learn'), ({ b }) => `${b.name}: still uses learn, rename to scroll`],
  [({ b }) => b.scroll === 'FIREBALL', ({ b }) => `${b.name}: scroll must not be FIREBALL (known at start)`],
  [({ b }) => ENEMIES[b.boss] !== undefined && ENEMIES[b.boss]?.kind !== 'BOSS', ({ b }) => `${b.name}: boss is not a BOSS`],
  [(c) => signatureMinActMismatch(c) !== null, (c) => signatureMinActMismatch(c) ?? ''],
];

function validateBiome(check: BiomeCheck, seen: { enemies: Set<string>; scrolls: Set<string> }, bad: string[]): void {
  const { b } = check;
  if (b.name.length > 12) {bad.push(`${b.name}: biome name too long`);}
  if (b.scroll) {
    if (seen.scrolls.has(b.scroll)) {bad.push(`${b.name}: scroll ${b.scroll} offered twice`);}
    seen.scrolls.add(b.scroll);
  }
  for (const id of [...b.normals, ...b.elites, b.boss]) {
    if (!ENEMIES[id]) {bad.push(`${b.name}: unknown enemy ${id}`);}
    else {seen.enemies.add(id);}
  }
  applyRules(BIOME_RULES, check, bad);
}

function validateBiomes(bad: string[], signatureOf: Map<string, string>): void {
  const seen = { enemies: new Set<string>(), scrolls: new Set<string>() };
  BIOMES.forEach((b, act) => { validateBiome({ b, act, signatureOf }, seen, bad); });
  for (const id of Object.keys(ENEMIES)) {
    if (!seen.enemies.has(id)) {bad.push(`enemy in no biome: ${id}`);}
  }
}

function validateTables(bad: string[]): void {
  const sources = Object.keys(LOOT_WEIGHTS) as LootSource[];
  for (const src of sources) {
    const rows = LOOT_WEIGHTS[src];
    if (rows.length !== 4) {bad.push(`${src}: needs one weight row per act`);}
    rows.forEach((row, act) => {
      const sum = row[0] + row[1] + row[2] + row[3];
      if (sum !== 100) {bad.push(`${src} act ${act}: weights sum to ${sum}`);}
    });
  }
  for (const src of sources) {
    const n = LOOT_COUNT[src];
    if (!Number.isInteger(n) || n < 1) {bad.push(`${src}: LOOT_COUNT must be a positive integer`);}
  }
  if (ACT_MULT.length !== BIOMES.length) {bad.push('ACT_MULT must have one entry per biome');}
}

export function validateData(): string[] {
  const bad: string[] = [];
  validateItems(bad);
  const signatureOf = validateSignatures(bad);
  validateSpellsAndEnemies(bad);
  validateBiomes(bad, signatureOf);
  validateTables(bad);
  return bad;
}
