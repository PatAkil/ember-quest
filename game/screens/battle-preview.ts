import { BURST_MULT, EMBER_MAX, POTION_HEAL } from '../types';
import type { BattleState, Derived, EnemyInstance, Hero, HeroAction, MoveId, SpellId } from '../types';
import { SPELLS } from '../data';
import {
  breakFacts, burstPower, canAfford, derive, elementMult, expectedFoeDamage, expectedHeroDamage, guardFacts, healPreview, heroElement, knownSpells,
  preBlowFate, punishes, riposteMult, spellCost, strikeFacts,
  type Fate, type FateCause, type GuardFacts, type PreBlow, type StrikeAction, type StrikeFacts,
} from '../sim';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_GOOD, C_HEX, C_LOG_HURT, C_TEXT, C_WARD, C_WARN } from '../theme';

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

function heavyHint(state: BattleState, hero: Hero): IntentLook {
  const blow = expectedFoeDamage(hero, state).unguarded;
  return look('HEAVY BLOW', `HEAVY BLOW NEXT (~${String(blow)}): GUARD, OR BREAK IT`, C_WARN, true);
}

const GLANCE_HINT = look('', 'ATTACKS GLANCE OFF: TRY MAGIC', C_WARN);
const GLANCE_RES = 20;

const strikesWithSpell = (id: SpellId): boolean => SPELLS[id].heal === undefined && SPELLS[id].guard === undefined;

function attackGlances(hero: Hero, state: BattleState): boolean {
  const st = strikeFacts(hero, state, 'ATTACK');
  if (st.elem >= 1 && st.resist < GLANCE_RES) {return false;}
  return knownSpells(hero).some((id) => strikesWithSpell(id) && canAfford(hero, id) && expectedHeroDamage(hero, state, id) > st.damage);
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

interface Ctx { g: Game; hero: Hero; d: Derived; e: EnemyInstance; state: BattleState; heavy: boolean }

const burstStat = (d: Derived): string => (d.mag > d.atk ? 'MAG' : 'ATK');
const burstMult = (hero: Hero): number => BURST_MULT * burstPower(hero);
const dmgSeg = (dmg: number): Seg => ({ text: `~${String(dmg)} DMG`, color: C_TEXT });
const line = (text: string, color: string): PreviewLine => [{ text, color }];

function breakLine(c: Ctx, action: HeroAction): PreviewLine | null {
  const facts = breakFacts(c.hero, c.state, action);
  if (!facts) {return null;}
  if (facts.verdict === 'NOT_WEAK') {return line('NOT WEAK: NO BREAK', C_WARN);}
  if (facts.verdict === 'BREAKS') {return line('BREAKS IT', C_ACCENT);}
  return [{ text: `NEEDS ${String(facts.need)}+`, color: C_WARN }, { text: punishes(c.hero) ? 'DMG' : 'WEAK DMG', color: C_WARN }];
}

function resistSegs(c: Ctx, st: StrikeFacts): Seg[] {
  const segs: Seg[] = [];
  if (st.elem > 1) {segs.push({ text: `WEAK X${st.elem.toFixed(1)}`, color: C_GOOD });}
  if (st.elem < 1) {segs.push({ text: `RESIST X${st.elem.toFixed(1)}`, color: C_WARN });}
  if (c.e.wardTurns > 0) {segs.push({ text: `-${String(st.resist)}% WARD`, color: C_WARN });}
  else if (st.resist >= 10) {segs.push({ text: `-${String(st.resist)}% RES`, color: C_WARN });}
  return segs;
}

function strikeHead(st: StrikeFacts): string {
  const hits = st.hits > 1 ? ` ${String(st.hits)} HITS` : '';
  return `${st.stat} X${st.mult.toFixed(1)}${hits}`;
}

function strikePreview(c: Ctx, a: StrikeAction): PreviewLine[] {
  const st = strikeFacts(c.hero, c.state, a);
  const riposte = line(`RIPOSTE X${riposteMult(c.hero).toFixed(1)}`, C_ACCENT);
  const third = breakLine(c, a) ?? (c.state.riposte ? riposte : []);
  return [[dmgSeg(st.damage), { text: strikeHead(st), color: C_DIM }], resistSegs(c, st), third];
}

function healLine(c: Ctx, action: HeroAction): PreviewLine {
  const n = healPreview(c.hero, c.state, action);
  return n > 0 ? line(`+${String(n)} HP`, C_GOOD) : line('HP IS FULL', C_DIM);
}

function aegisPreview(c: Ctx, reflect: number): PreviewLine[] {
  const head = c.heavy ? line('PARRY THE HEAVY BLOW', C_ACCENT) : line('A GUARD THAT BITES', C_TEXT);
  return [head, line(`RETURNS ${String(Math.round(reflect * 100))}% OF IT`, C_ACCENT), []];
}

function spellLines(c: Ctx, id: SpellId): PreviewLine[] {
  const s = SPELLS[id];
  if (s.guard) {return aegisPreview(c, s.guard.reflect);}
  if (s.heal === undefined) {return strikePreview(c, id);}
  return [line(`HEAL ${String(Math.round(s.heal * 100))}% HP`, C_GOOD), healLine(c, id), []];
}

function spellPreview(c: Ctx, id: SpellId): PreviewLine[] {
  const lines = spellLines(c, id);
  if (canAfford(c.hero, id)) {return lines;}
  return [...lines.slice(0, 2), line(`NEEDS ${String(spellCost(c.hero, id))} MP`, C_WARN)];
}

const takeColor = (gf: GuardFacts): string => {
  if (!gf.lethal) {return C_TEXT;}
  return gf.rises ? C_WARN : C_LOG_HURT;
};

const takeLine = (gf: GuardFacts): PreviewLine => line(`TAKE ~${String(gf.take.guarded)} OF ${String(gf.take.unguarded)}`, takeColor(gf));

function guardLines(c: Ctx, gf: GuardFacts): PreviewLine[] {
  if (c.heavy) {return [line('PARRY THE HEAVY BLOW', C_ACCENT), takeLine(gf), line(`NEXT HIT X${riposteMult(c.hero).toFixed(1)}`, C_ACCENT)];}
  if (gf.tires) {return [takeLine(gf), line('A CHAINED GUARD', C_DIM), line('NO MP OR EMBER', C_DIM)];}
  return gf.mpGain > 0 ? [takeLine(gf), line(`+${String(gf.mpGain)} MP IF STRUCK`, C_DIM)] : [takeLine(gf)];
}

const GUARD_FAILS = 'GUARD WON\'T SAVE YOU';
const GUARD_RISES = 'GUARD FAILS - RISE';

function guardPreview(c: Ctx): PreviewLine[] {
  const gf = guardFacts(c.hero, c.state);
  if (gf.take.unguarded <= 0) {return [line('NO BLOW IS COMING', C_WARN), line('A WASTED TURN', C_DIM)];}
  const lines = guardLines(c, gf);
  if (!gf.lethal) {return lines;}
  const head = gf.rises ? line(GUARD_RISES, C_WARN) : line(GUARD_FAILS, C_LOG_HURT);
  return [head, takeLine(gf), lines[2] ?? []];
}

const FATE_TEXT: Record<FateCause, Record<Exclude<Fate, 'SAFE'>, (burn: number) => string>> = {
  BURN: { FALLS: (n) => `BURN ${String(n)} KILLS YOU`, RISES: (n) => `BURN ${String(n)} - YOU RISE` },
  THORNS: { FALLS: () => 'THORNS WILL KILL YOU', RISES: () => 'THORNS - YOU RISE' },
};

function fateLine(f: PreBlow): PreviewLine | null {
  if (f.fate === 'SAFE' || f.cause === null) {return null;}
  return line(FATE_TEXT[f.cause][f.fate](f.burn), f.fate === 'FALLS' ? C_LOG_HURT : C_WARN);
}

function withBurn(lines: PreviewLine[], burn: PreviewLine | null): PreviewLine[] {
  return burn ? [lines[0] ?? [], lines[1] ?? [], burn] : lines;
}

function burnAfter(c: Ctx, action: HeroAction): PreviewLine | null {
  const fate = preBlowFate(c.hero, c.state, action);
  return fateLine(fate) ?? (fate.tick > 0 ? line(`THEN YOU BURN -${String(fate.tick)}`, C_WARN) : null);
}

const SEVERITY: Record<Fate, number> = { SAFE: 0, RISES: 1, FALLS: 2 };

function lethalOnly(c: Ctx, lines: PreviewLine[], actions: HeroAction[]): PreviewLine[] {
  const fates = actions.map((a) => preBlowFate(c.hero, c.state, a));
  const mildest = fates.reduce<PreBlow | null>((best, f) => (best && SEVERITY[best.fate] <= SEVERITY[f.fate] ? best : f), null);
  const warn = mildest ? fateLine(mildest) : null;
  return warn ? withBurn(lines, warn) : lines;
}

const castable = (c: Ctx): SpellId[] => knownSpells(c.hero).filter((id) => canAfford(c.hero, id));

function potionPreview(c: Ctx): PreviewLine[] {
  const left = c.hero.potions > 0 ? line(`${String(c.hero.potions)} LEFT`, C_DIM) : line('NONE LEFT', C_WARN);
  return withBurn([line(`HEAL ${String(Math.round(POTION_HEAL * 100))}% HP`, C_GOOD), healLine(c, 'POTION'), left], burnAfter(c, 'POTION'));
}

function emberPct(hero: Hero): string {
  return `EMBER ${String(Math.floor((100 * Math.min(hero.ember, EMBER_MAX)) / EMBER_MAX))}%`;
}

function burstPreview(c: Ctx): PreviewLine[] {
  if (c.hero.ember < EMBER_MAX) {return [line(emberPct(c.hero), C_EMBER), line(`X${burstMult(c.hero).toFixed(1)} IGNORES ARMOR`, C_DIM), line('FILLS AS YOU FIGHT', C_DIM)];}
  const total = expectedHeroDamage(c.hero, c.state, 'BURST');
  const third = breakLine(c, 'BURST') ?? (c.hero.burn ? line('CLEANSES YOUR BURN', C_GOOD) : line('EMPTIES THE EMBER', C_DIM));
  return [[dmgSeg(total), { text: `${burstStat(c.d)} X${burstMult(c.hero).toFixed(1)}`, color: C_DIM }], line('IGNORES ARMOR+WARDS', C_TEXT), third];
}

function magicPreview(c: Ctx): PreviewLine[] {
  const spells = knownSpells(c.hero);
  const weak = spells.find((id) => elementMult(c.e.def, SPELLS[id].element) > 1);
  const head = line(`${String(spells.length)} SPELL${spells.length === 1 ? '' : 'S'}`, C_TEXT);
  const mp = line(`MP ${String(c.hero.mp)}/${String(c.d.maxMp)}`, C_DIM);
  return weak ? [head, mp, line(`WEAK: ${SPELLS[weak].name}`, C_GOOD)] : [head, mp];
}

export type TopCommand = 'ATTACK' | 'MAGIC' | 'GUARD' | 'BURST' | 'POTION';

const TOP_PREVIEW: Record<TopCommand, (c: Ctx) => PreviewLine[]> = {
  ATTACK: (c) => lethalOnly(c, strikePreview(c, 'ATTACK'), ['ATTACK']),
  MAGIC: (c) => lethalOnly(c, magicPreview(c), castable(c)),
  GUARD: (c) => withBurn(guardPreview(c), burnAfter(c, 'GUARD')),
  BURST: (c) => lethalOnly(c, burstPreview(c), [c.hero.ember >= EMBER_MAX ? 'BURST' : 'ATTACK']),
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
  const lines = spellPreview(c, id);
  return SPELLS[id].heal === undefined ? lethalOnly(c, lines, [id]) : withBurn(lines, burnAfter(c, id));
}

interface BreakNote { note: string; noteColor: string }

const BREAKS_NOTE: BreakNote = { note: 'BREAKS', noteColor: C_ACCENT };
const NO_BREAK_NOTE: BreakNote = { note: 'NO BRK', noteColor: C_WARN };

const breaksWith = (c: Ctx, action: HeroAction): boolean => breakFacts(c.hero, c.state, action)?.verdict === 'BREAKS';

function spellsBreak(c: Ctx): boolean | null {
  if (knownSpells(c.hero).length === 0) {return null;}
  return castable(c).some((id) => strikesWithSpell(id) && breaksWith(c, id));
}

const BREAK_CHECK: Partial<Record<TopCommand, (c: Ctx) => boolean | null>> = {
  ATTACK: (c) => breaksWith(c, 'ATTACK'),
  MAGIC: spellsBreak,
  BURST: (c) => (c.hero.ember < EMBER_MAX ? null : breaksWith(c, 'BURST')),
};

export function breakNote(g: Game, cmd: TopCommand): BreakNote | null {
  const c = context(g);
  const check = BREAK_CHECK[cmd];
  if (!c?.heavy || !check) {return null;}
  const verdict = check(c);
  if (verdict === null) {return null;}
  return verdict ? BREAKS_NOTE : NO_BREAK_NOTE;
}
