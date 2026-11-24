import { BREAK_AT, BURST_MULT, EMBER_MAX, GUARD_MP_GAIN, POTION_HEAL } from '../types';
import type { BattleState, DamageKind, Derived, EnemyInstance, Hero, MoveId, SpellId } from '../types';
import { SPELLS } from '../data';
import { burstPower, canAfford, derive, elementMult, gearPower, heroElement, knownSpells, punishes, resistOf, riposteMult, spellCost } from '../sim';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_GOOD, C_HEX, C_TEXT, C_WARD, C_WARN } from '../theme';
import { hasHex, magicWeapon } from './battle-fx';

export interface Seg { text: string; color: string }
export type PreviewLine = readonly Seg[];

interface IntentLook { short: string; hint: string; color: string; hot: boolean }

const look = (short: string, hint: string, color: string, hot = false): IntentLook => ({ short, hint, color, hot });

const INTENT: Record<MoveId, IntentLook> = {
  STRIKE: look('STRIKES', 'IT READIES A BLOW', C_TEXT),
  WINDUP: look('WINDS UP', 'IT WINDS UP - A HEAVY BLOW FOLLOWS', C_WARN),
  HEAVY: look('HEAVY BLOW', 'HEAVY BLOW COMING - GUARD IT OR BREAK IT', C_WARN, true),
  WARD: look('WARDS', 'IT RAISES A WARD - RESISTS RISE FOR 2 TURNS', C_WARD),
  SCORCH: look('SCORCHES', 'IT GATHERS FLAME - THE HIT WILL BURN', C_EMBER),
  MEND: look('MENDS', 'IT WILL MEND ITS WOUNDS', C_GOOD),
};
const HEX_INTENT = look('HEXES', 'IT READIES A HEX', C_HEX);
const STAGGER_INTENT = look('STAGGERED', 'IT IS STAGGERED - IT LOSES ITS TURN', C_DIM);

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

function strikeTotal(c: Ctx, st: Strike, a: 'ATTACK' | SpellId): number {
  const res = resistOf(c.e, st.kind);
  const riposte = c.state.riposte ? riposteMult(c.hero) : 1;
  const power = gearPower({ hero: c.hero, battle: c.state, d: c.d, element: heroElement(c.hero, a) });
  return st.base * st.mult * st.hits * (1 - res / 100) * st.elem * riposte * power;
}

const burstStat = (d: Derived): Stat => (d.mag > d.atk ? 'MAG' : 'ATK');
const burstMult = (hero: Hero): number => BURST_MULT * burstPower(hero);
const burstTotal = (c: Ctx): number => Math.max(c.d.atk, c.d.mag) * burstMult(c.hero);

function breakLine(c: Ctx, total: number, eligible: boolean): PreviewLine | null {
  if (!c.heavy || !eligible) {return null;}
  const enough = total >= BREAK_AT[c.e.def.kind] * c.e.maxHp;
  return enough ? [{ text: 'BREAKS IT', color: C_ACCENT }] : [{ text: 'TOO WEAK TO BREAK', color: C_DIM }];
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

function strikePreview(c: Ctx, a: 'ATTACK' | SpellId): PreviewLine[] {
  const st = strikeOf(c.hero, c.d, a, c.e);
  const total = strikeTotal(c, st, a);
  const riposteText = `RIPOSTE X${riposteMult(c.hero).toFixed(1)}`;
  const third = breakLine(c, total, st.elem > 1 || punishes(c.hero)) ?? (c.state.riposte ? [{ text: riposteText, color: C_ACCENT }] : []);
  return [[{ text: strikeHead(st), color: C_TEXT }], resistSegs(c, st), third];
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

function guardPreview(c: Ctx): PreviewLine[] {
  if (c.heavy) {return [line('PARRY THE HEAVY BLOW', C_ACCENT), line('TAKE HALF DAMAGE', C_TEXT), line(`NEXT HIT X${riposteMult(c.hero).toFixed(1)}`, C_ACCENT)];}
  if (c.e.staggered || c.state.intent === 'WARD' || c.state.intent === 'MEND') {return [line('NO BLOW IS COMING', C_WARN), line('A WASTED TURN', C_DIM)];}
  if (c.state.guardChain >= 1) {return [line('CUTS THE HIT BY 25%', C_TEXT), line('YOU GUARDED LAST', C_DIM), line('NO MP OR EMBER', C_DIM)];}
  return [line('HALVES THE NEXT HIT', C_TEXT), line(`+${GUARD_MP_GAIN} MP IF STRUCK`, C_DIM)];
}

function potionPreview(c: Ctx): PreviewLine[] {
  const left = c.hero.potions > 0 ? line(`${c.hero.potions} LEFT`, C_DIM) : line('NONE LEFT', C_WARN);
  return [line(`HEAL ${Math.round(POTION_HEAL * 100)}% HP`, C_GOOD), healLine(c, POTION_HEAL), left];
}

function burstPreview(c: Ctx): PreviewLine[] {
  if (c.hero.ember < EMBER_MAX) {return [line(`EMBER ${Math.floor(c.hero.ember)}/${EMBER_MAX}`, C_DIM), line('FILLS AS YOU FIGHT', C_DIM)];}
  const third = breakLine(c, burstTotal(c), true) ?? line('EMPTIES THE EMBER', C_DIM);
  return [line(`${burstStat(c.d)} X${burstMult(c.hero).toFixed(1)}`, C_TEXT), line('IGNORES ARMOR+WARDS', C_TEXT), third];
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
  ATTACK: (c) => strikePreview(c, 'ATTACK'),
  MAGIC: magicPreview,
  GUARD: guardPreview,
  BURST: burstPreview,
  POTION: potionPreview,
};

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
  return c ? spellPreview(c, id) : [];
}
