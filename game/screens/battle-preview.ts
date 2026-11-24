import { BREAK_AT, BURST_MULT, EMBER_MAX, GUARD_MP_GAIN, POTION_HEAL } from '../types';
import type { BattleState, DamageKind, Derived, EnemyInstance, Hero, MoveId, SpellId } from '../types';
import { SPELLS } from '../data';
import { burstPower, canAfford, derive, elementMult, expectedFoeDamage, expectedHeroDamage, expectedPreBlowLoss, heroElement, knownSpells, pendingTick, punishes, resistOf, riposteMult, spellCost } from '../sim';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_GOOD, C_HEX, C_LOG_HURT, C_TEXT, C_WARD, C_WARN } from '../theme';
import { hasHex, magicWeapon } from './battle-fx';

export interface Seg { text: string; color: string }
export type PreviewLine = readonly Seg[];

interface IntentLook { short: string; hint: string; color: string; hot: boolean }

const look = (short: string, hint: string, color: string, hot = false): IntentLook => ({ short, hint, color, hot });

const INTENT: Record<MoveId, IntentLook> = {
  STRIKE: look('STRIKES', 'IT READIES A BLOW', C_TEXT),
  WINDUP: look('WINDS UP', 'WINDING UP: HIT NOW, GUARD NEXT TURN', C_WARN),
  HEAVY: look('HEAVY BLOW', 'HEAVY BLOW NEXT: GUARD, OR BREAK IT', C_WARN, true),
  WARD: look('WARDS', 'IT RAISES A WARD - RESISTS RISE FOR 2 TURNS', C_WARD),
  SCORCH: look('SCORCHES', 'IT GATHERS FLAME - THE HIT WILL BURN', C_EMBER),
  MEND: look('MENDS', 'IT WILL MEND ITS WOUNDS', C_GOOD),
};
const HEX_INTENT = look('HEXES', 'IT READIES A HEX', C_HEX);
const STAGGER_INTENT = look('STAGGERED', 'IT IS STAGGERED - IT LOSES ITS TURN', C_DIM);

const breakNeed = (e: EnemyInstance): number => Math.ceil(BREAK_AT[e.def.kind] * e.maxHp);

function heavyHint(state: BattleState, hero: Hero): IntentLook {
  const blow = expectedFoeDamage(hero, state).unguarded;
  return look('HEAVY BLOW', `HEAVY BLOW NEXT (~${String(blow)}): GUARD, OR BREAK IT`, C_WARN, true);
}

const GLANCE_HINT = look('', 'ATTACKS GLANCE OFF: TRY MAGIC', C_WARN);
const GLANCE_RES = 20;

const strikesWithSpell = (id: SpellId): boolean => SPELLS[id].heal === undefined && SPELLS[id].guard === undefined;

function attackGlances(hero: Hero, state: BattleState): boolean {
  const st = attackStrike(hero, derive(hero), state.enemy);
  if (st.elem >= 1 && resistOf(state.enemy, st.kind) < GLANCE_RES) {return false;}
  const attack = expectedHeroDamage(hero, state, 'ATTACK');
  return knownSpells(hero).some((id) => strikesWithSpell(id) && canAfford(hero, id) && expectedHeroDamage(hero, state, id) > attack);
}

export function intentHint(e: EnemyInstance, state: BattleState, hero: Hero): IntentLook {
  const shown = intentLook(e, state);
  if (shown === INTENT.HEAVY) {return heavyHint(state, hero);}
  if (shown === INTENT.WINDUP) {return shown;}
  return attackGlances(hero, state) ? GLANCE_HINT : shown;
}

export function intentLook(e: EnemyInstance, state: BattleState): IntentLook {
  if (e.staggered) {return STAGGER_INTENT;}
  if (state.intent === 'STRIKE' && e.def.atkType === 'MAGIC') {return HEX_INTENT;}
  return INTENT[state.intent];
}

type Stat = 'ATK' | 'MAG';
interface Strike { stat: Stat; base: number; mult: number; hits: number; kind: DamageKind; elem: number }

function attackStrike(hero: Hero, d: Derived, e: EnemyInstance): Strike {
  const elem = elementMult(e.def, heroElement(hero, 'ATTACK'));
  if (hasHex(hero)) {return { stat: 'ATK', base: d.atk, mult: 1, hits: 1, kind: 'MAGIC', elem };}
  if (magicWeapon(hero)) {return { stat: 'MAG', base: d.mag, mult: 1, hits: 1, kind: 'MAGIC', elem };}
  return { stat: 'ATK', base: d.atk, mult: 1, hits: 1, kind: 'PHYSICAL', elem };
}

function spellStrike(hero: Hero, d: Derived, id: SpellId, e: EnemyInstance): Strike {
  const s = SPELLS[id];
  const kind: DamageKind = hasHex(hero) && id === 'SLASH' ? 'MAGIC' : s.kind;
  return { stat: s.scale, base: s.scale === 'MAG' ? d.mag : d.atk, mult: s.mult, hits: s.hits, kind, elem: elementMult(e.def, s.element) };
}

const strikeOf = (hero: Hero, d: Derived, a: 'ATTACK' | SpellId, e: EnemyInstance): Strike =>
  (a === 'ATTACK' ? attackStrike(hero, d, e) : spellStrike(hero, d, a, e));

interface Ctx { g: Game; hero: Hero; d: Derived; e: EnemyInstance; state: BattleState; heavy: boolean }

const burstStat = (d: Derived): Stat => (d.mag > d.atk ? 'MAG' : 'ATK');
const burstMult = (hero: Hero): number => BURST_MULT * burstPower(hero);
const dmgSeg = (dmg: number): Seg => ({ text: `~${String(dmg)} DMG`, color: C_TEXT });

function breakLine(c: Ctx, total: number, eligible: boolean): PreviewLine | null {
  if (!c.heavy) {return null;}
  if (!eligible) {return [{ text: 'NOT WEAK: NO BREAK', color: C_WARN }];}
  const need = breakNeed(c.e);
  if (total >= need) {return [{ text: 'BREAKS IT', color: C_ACCENT }];}
  return [{ text: `NEEDS ${String(need)}+`, color: C_WARN }, { text: punishes(c.hero) ? 'DMG' : 'WEAK DMG', color: C_WARN }];
}

function resistSegs(c: Ctx, st: Strike): Seg[] {
  const segs: Seg[] = [];
  if (st.elem > 1) {segs.push({ text: `WEAK X${st.elem.toFixed(1)}`, color: C_GOOD });}
  if (st.elem < 1) {segs.push({ text: `RESIST X${st.elem.toFixed(1)}`, color: C_WARN });}
  const res = resistOf(c.e, st.kind);
  if (c.e.wardTurns > 0) {segs.push({ text: `-${res}% WARD`, color: C_WARN });}
  else if (res >= 10) {segs.push({ text: `-${res}% RES`, color: C_WARN });}
  return segs;
}

function strikeHead(st: Strike): string {
  const hits = st.hits > 1 ? ` ${st.hits} HITS` : '';
  return `${st.stat} X${st.mult.toFixed(1)}${hits}`;
}

const canBreak = (c: Ctx, st: Strike): boolean => st.elem > 1 || punishes(c.hero);

function strikeBreaks(c: Ctx, a: 'ATTACK' | SpellId): boolean {
  return canBreak(c, strikeOf(c.hero, c.d, a, c.e)) && expectedHeroDamage(c.hero, c.state, a) >= breakNeed(c.e);
}

function strikePreview(c: Ctx, a: 'ATTACK' | SpellId): PreviewLine[] {
  const st = strikeOf(c.hero, c.d, a, c.e);
  const total = expectedHeroDamage(c.hero, c.state, a);
  const riposteText = `RIPOSTE X${riposteMult(c.hero).toFixed(1)}`;
  const third = breakLine(c, total, canBreak(c, st)) ?? (c.state.riposte ? [{ text: riposteText, color: C_ACCENT }] : []);
  return [[dmgSeg(total), { text: strikeHead(st), color: C_DIM }], resistSegs(c, st), third];
}

const roomHp = (c: Ctx): number => Math.max(0, c.d.maxHp - c.hero.hp);

function healLine(c: Ctx, fraction: number): PreviewLine {
  const n = Math.min(roomHp(c), Math.round(c.d.maxHp * fraction));
  return n > 0 ? [{ text: `+${n} HP`, color: C_GOOD }] : [{ text: 'HP IS FULL', color: C_DIM }];
}

function aegisPreview(c: Ctx, reflect: number): PreviewLine[] {
  const head = c.heavy ? line('PARRY THE HEAVY BLOW', C_ACCENT) : line('A GUARD THAT BITES', C_TEXT);
  return [head, line(`RETURNS ${Math.round(reflect * 100)}% OF IT`, C_ACCENT), []];
}

function spellLines(c: Ctx, id: SpellId): PreviewLine[] {
  const s = SPELLS[id];
  if (s.guard) {return aegisPreview(c, s.guard.reflect);}
  if (s.heal === undefined) {return strikePreview(c, id);}
  return [[{ text: `HEAL ${Math.round(s.heal * 100)}% HP`, color: C_GOOD }], healLine(c, s.heal), []];
}

function spellPreview(c: Ctx, id: SpellId): PreviewLine[] {
  const lines = spellLines(c, id);
  if (canAfford(c.hero, id)) {return lines;}
  return [...lines.slice(0, 2), [{ text: `NEEDS ${spellCost(c.hero, id)} MP`, color: C_WARN }]];
}

const line = (text: string, color: string): PreviewLine => [{ text, color }];

const hpWhenStruck = (c: Ctx): number => c.hero.hp - expectedPreBlowLoss(c.hero, c.state, 'GUARD');

const guardLethal = (c: Ctx): boolean => expectedFoeDamage(c.hero, c.state).guarded >= hpWhenStruck(c);

function takeLine(c: Ctx): PreviewLine {
  const blow = expectedFoeDamage(c.hero, c.state);
  return line(`TAKE ~${String(blow.guarded)} OF ${String(blow.unguarded)}`, guardLethal(c) ? C_LOG_HURT : C_TEXT);
}

function guardLines(c: Ctx): PreviewLine[] {
  if (c.heavy) {return [line('PARRY THE HEAVY BLOW', C_ACCENT), takeLine(c), line(`NEXT HIT X${riposteMult(c.hero).toFixed(1)}`, C_ACCENT)];}
  if (c.state.guardChain >= 1) {return [takeLine(c), line('YOU GUARDED LAST', C_DIM), line('NO MP OR EMBER', C_DIM)];}
  return [takeLine(c), line(`+${String(GUARD_MP_GAIN)} MP IF STRUCK`, C_DIM)];
}

function guardPreview(c: Ctx): PreviewLine[] {
  if (c.e.staggered || c.state.intent === 'WARD' || c.state.intent === 'MEND') {return [line('NO BLOW IS COMING', C_WARN), line('A WASTED TURN', C_DIM)];}
  const lines = guardLines(c);
  return guardLethal(c) ? [line(GUARD_FAILS, C_LOG_HURT), takeLine(c), lines[2] ?? []] : lines;
}

const GUARD_FAILS = 'GUARD WON\'T SAVE YOU';

function burnAfter(c: Ctx, healed: number): PreviewLine | null {
  const tick = pendingTick(c.hero);
  if (tick <= 0) {return null;}
  return c.hero.hp + healed - tick <= 0 ? line(`BURN ${tick} KILLS YOU`, C_LOG_HURT) : line(`THEN YOU BURN -${tick}`, C_WARN);
}

function withBurn(lines: PreviewLine[], burn: PreviewLine | null): PreviewLine[] {
  return burn ? [lines[0] ?? [], lines[1] ?? [], burn] : lines;
}

const healOf = (c: Ctx, fraction: number): number => Math.min(roomHp(c), Math.round(c.d.maxHp * fraction));

function lethalOnly(c: Ctx, lines: PreviewLine[]): PreviewLine[] {
  const burn = burnAfter(c, 0);
  return burn && c.hero.hp - pendingTick(c.hero) <= 0 ? withBurn(lines, burn) : lines;
}

function potionPreview(c: Ctx): PreviewLine[] {
  const left = c.hero.potions > 0 ? line(`${c.hero.potions} LEFT`, C_DIM) : line('NONE LEFT', C_WARN);
  return withBurn([line(`HEAL ${Math.round(POTION_HEAL * 100)}% HP`, C_GOOD), healLine(c, POTION_HEAL), left], burnAfter(c, healOf(c, POTION_HEAL)));
}

function emberPct(hero: Hero): string {
  return `EMBER ${String(Math.floor((100 * Math.min(hero.ember, EMBER_MAX)) / EMBER_MAX))}%`;
}

function burstPreview(c: Ctx): PreviewLine[] {
  if (c.hero.ember < EMBER_MAX) {return [line(emberPct(c.hero), C_EMBER), line(`X${burstMult(c.hero).toFixed(1)} IGNORES ARMOR`, C_DIM), line('FILLS AS YOU FIGHT', C_DIM)];}
  const total = expectedHeroDamage(c.hero, c.state, 'BURST');
  const third = breakLine(c, total, true) ?? line('EMPTIES THE EMBER', C_DIM);
  return [[dmgSeg(total), { text: `${burstStat(c.d)} X${burstMult(c.hero).toFixed(1)}`, color: C_DIM }], line('IGNORES ARMOR+WARDS', C_TEXT), third];
}

function magicPreview(c: Ctx): PreviewLine[] {
  const spells = knownSpells(c.hero);
  const weak = spells.find((id) => elementMult(c.e.def, SPELLS[id].element) > 1);
  const head = line(`${spells.length} SPELL${spells.length === 1 ? '' : 'S'}`, C_TEXT);
  const mp = line(`MP ${c.hero.mp}/${c.d.maxMp}`, C_DIM);
  return weak ? [head, mp, line(`WEAK: ${SPELLS[weak].name}`, C_GOOD)] : [head, mp];
}

export type TopCommand = 'ATTACK' | 'MAGIC' | 'GUARD' | 'BURST' | 'POTION';

const TOP_PREVIEW: Record<TopCommand, (c: Ctx) => PreviewLine[]> = {
  ATTACK: (c) => lethalOnly(c, strikePreview(c, 'ATTACK')),
  MAGIC: (c) => lethalOnly(c, magicPreview(c)),
  GUARD: (c) => withBurn(guardPreview(c), burnAfter(c, 0)),
  BURST: (c) => lethalOnly(c, burstPreview(c)),
  POTION: potionPreview,
};

export function weakSpells(hero: Hero, e: EnemyInstance): SpellId[] {
  return knownSpells(hero).filter((id) => elementMult(e.def, SPELLS[id].element) > 1);
}

export const attackWeak = (hero: Hero, e: EnemyInstance): boolean => elementMult(e.def, heroElement(hero, 'ATTACK')) > 1;

export const hasWeakAnswer = (hero: Hero, e: EnemyInstance): boolean => attackWeak(hero, e) || weakSpells(hero, e).length > 0;

function context(g: Game): Ctx | null {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return null;}
  const heavy = state.intent === 'HEAVY' && !e.staggered;
  return { g, hero: g.hero, d: derive(g.hero), e, state, heavy };
}

export function previewTop(g: Game, cmd: TopCommand): PreviewLine[] {
  const c = context(g);
  return c ? TOP_PREVIEW[cmd](c) : [];
}

export function previewSpell(g: Game, id: SpellId): PreviewLine[] {
  const c = context(g);
  if (!c) {return [];}
  const heal = SPELLS[id].heal;
  const lines = spellPreview(c, id);
  return heal === undefined ? lethalOnly(c, lines) : withBurn(lines, burnAfter(c, healOf(c, heal)));
}

interface BreakNote { note: string; noteColor: string }

const BREAKS_NOTE: BreakNote = { note: 'BREAKS', noteColor: C_ACCENT };
const NO_BREAK_NOTE: BreakNote = { note: 'NO BRK', noteColor: C_WARN };

function spellsBreak(c: Ctx): boolean | null {
  if (knownSpells(c.hero).length === 0) {return null;}
  return knownSpells(c.hero).some((id) => strikesWithSpell(id) && canAfford(c.hero, id) && strikeBreaks(c, id));
}

function burstBreaks(c: Ctx): boolean | null {
  if (c.hero.ember < EMBER_MAX) {return null;}
  return expectedHeroDamage(c.hero, c.state, 'BURST') >= breakNeed(c.e);
}

const BREAK_CHECK: Partial<Record<TopCommand, (c: Ctx) => boolean | null>> = {
  ATTACK: (c) => strikeBreaks(c, 'ATTACK'),
  MAGIC: spellsBreak,
  BURST: burstBreaks,
};

export function breakNote(g: Game, cmd: TopCommand): BreakNote | null {
  const c = context(g);
  const check = BREAK_CHECK[cmd];
  if (!c?.heavy || !check) {return null;}
  const verdict = check(c);
  if (verdict === null) {return null;}
  return verdict ? BREAKS_NOTE : NO_BREAK_NOTE;
}
