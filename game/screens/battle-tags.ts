import { PICO8, drawText, textWidth } from '../../engine';
import { EMBER_MAX } from '../types';
import type { AffixId, BattleState, EnemyInstance, Hero } from '../types';
import { ENRAGE_AFTER, derive, desperate, punishes, woundUp } from '../sim';
import { guardShown } from '../fx';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_TEXT, C_WARD, C_WARN, ELEMENT_COLOR, HUD_BOTTOM } from '../theme';
import type { Burn } from '../types';
import type { Seg } from './battle-preview';
import { hasWeakAnswer } from './battle-preview';
import { TOP_COMMANDS } from './battle-menu';

export interface PlateBox { x: number; y: number; w: number; h: number }
interface TagPlates { hero: PlateBox; enemy: PlateBox; pad: number }

type Ctx = CanvasRenderingContext2D;
type Tag = readonly Seg[];

const ENEMY_TAG_Y = HUD_BOTTOM + 3;
const HERO_TAG_Y = HUD_BOTTOM + 5;
const BACK_PAD = 2;
const TAG_GAP = 3;
const SEG_GAP = 4;

const tagWidth = (tag: Tag): number => tag.reduce((n, s, i) => n + textWidth(s.text, 1) + (i ? SEG_GAP : 0), 0);

function drawTag(ctx: Ctx, tag: Tag, at: { x: number; y: number }): void {
  ctx.fillStyle = PICO8[0]; ctx.fillRect(at.x - BACK_PAD, at.y - 1, tagWidth(tag) + 2 * BACK_PAD, 7);
  let x = at.x;
  for (const s of tag) {
    drawText(ctx, s.text, { x, y: at.y }, { color: s.color });
    x += textWidth(s.text, 1) + SEG_GAP;
  }
}

interface Strip { plate: PlateBox; pad: number; y: number }

type Choices = readonly Tag[];

function drawStrip(ctx: Ctx, entries: readonly Choices[], strip: Strip): void {
  const { plate, pad, y } = strip;
  const right = plate.x + plate.w - pad + BACK_PAD;
  let x = plate.x + pad;
  for (const choices of entries) {
    const tag = choices.find((t) => x + tagWidth(t) + BACK_PAD <= right);
    if (!tag) {continue;}
    drawTag(ctx, tag, { x, y });
    x += tagWidth(tag) + 2 * BACK_PAD + TAG_GAP;
  }
}

const word = (text: string, color: string): Tag => [{ text, color }];

const AFFIX_CYCLE = 1.6;
const AFFIX_ROW = 9;
export const C_AFFIX = PICO8[8];

const AFFIX_SHORT: Record<AffixId, string> = { VAMPIRIC: 'VAMP', ARMORED: 'ARMOR', WARDED: 'WARDED', THORNED: 'THORN', SWIFT: 'SWIFT', SEARING: 'SEAR' };

const affixList = (names: readonly string[]): Tag => names.map((text) => ({ text, color: C_AFFIX }));

function affixChoices(affixes: readonly AffixId[], clock: number): Choices {
  const shown = affixes[Math.floor(clock / AFFIX_CYCLE) % Math.max(1, affixes.length)];
  if (shown === undefined) {return [];}
  const alone = word(shown, C_AFFIX);
  if (affixes.length === 1) {return [alone, word(AFFIX_SHORT[shown], C_AFFIX)];}
  const more = { text: `+${String(affixes.length - 1)}`, color: C_DIM };
  const short = affixes.map((id) => AFFIX_SHORT[id]);
  return [affixList(affixes), affixList(short), [...alone, more], [{ text: AFFIX_SHORT[shown], color: C_AFFIX }, more]];
}

const burnTag = (burn: Burn): Tag => word(`BURN ${String(burn.perTurn)} X${String(burn.turns)}`, C_EMBER);

function weakTag(g: Game, e: EnemyInstance): Choices {
  const weak = e.def.weak;
  if (!weak) {return [];}
  const answered = hasWeakAnswer(g.hero, e);
  return [[{ text: 'WEAK', color: answered ? C_TEXT : C_DIM }, { text: weak, color: answered ? ELEMENT_COLOR[weak] : C_DIM }]];
}

function enemyTags(g: Game, e: EnemyInstance, state: BattleState | null): Choices[] {
  const tags: Choices[] = [weakTag(g, e)];
  if (state && state.calm > ENRAGE_AFTER) {tags.push([word('ENRAGED', C_AFFIX)]);}
  if (e.affixes.length === 1) {tags.push(affixChoices(e.affixes, g.clock));}
  if (e.wardTurns > 0) {tags.push([word(`WARD ${e.wardTurns}`, C_WARD)]);}
  if (e.burn) {tags.push([burnTag(e.burn), word(`BURN -${String(e.burn.perTurn)}`, C_EMBER)]);}
  if (e.def.resists) {tags.push([[{ text: 'RES', color: C_DIM }, { text: e.def.resists, color: ELEMENT_COLOR[e.def.resists] }]]);}
  return tags;
}

function emberTag(g: Game): Tag[] {
  const b = g.battle;
  const lit = b.menu === 'TOP' && b.phase === 'MENU' && TOP_COMMANDS[b.topCursor] === 'BURST';
  if (!lit || g.hero.ember >= EMBER_MAX) {return [];}
  return [word(`EMBER ${String(Math.floor((100 * g.hero.ember) / EMBER_MAX))}%`, C_EMBER)];
}

function heroTags(g: Game, state: BattleState | null, guard: boolean): Tag[] {
  const hero = g.hero;
  const tags: Tag[] = emberTag(g);
  if (hero.burn) {tags.push(burnTag(hero.burn));}
  if (state?.riposte) {tags.push(word('RIPOSTE', C_ACCENT));}
  if (guard) {tags.push(word(state && state.aegis > 0 ? 'AEGIS' : 'GUARD', C_WARD));}
  tags.push(...edgeTags(hero, state));
  if (state && state.rampStacks > 0) {tags.push(word(`RAMP ${state.rampStacks}`, C_WARN));}
  if (hero.ember >= EMBER_MAX) {tags.push(word('BURST READY', C_ACCENT));}
  return tags;
}

function edgeTags(hero: Hero, state: BattleState | null): Tag[] {
  const tags: Tag[] = [];
  if (state && punishes(hero) && woundUp(state)) {tags.push(word('PUNISH', C_ACCENT));}
  if (desperate(hero, derive(hero))) {tags.push(word('DESPERATE', C_WARN));}
  return tags;
}

export function drawTags(g: Game, plates: TagPlates): void {
  const ctx = g.app.pc.ctx;
  const { enemy, state } = g.battle;
  if (!g.heroDown) {drawStrip(ctx, heroTags(g, state, guardShown(g)).map((t) => [t]), { plate: plates.hero, pad: plates.pad, y: HERO_TAG_Y });}
  if (!enemy || enemy.hp <= 0) {return;}
  drawStrip(ctx, enemyTags(g, enemy, state), { plate: plates.enemy, pad: plates.pad, y: ENEMY_TAG_Y });
  if (enemy.affixes.length > 1) {drawStrip(ctx, [affixChoices(enemy.affixes, g.clock)], { plate: plates.enemy, pad: plates.pad, y: ENEMY_TAG_Y + AFFIX_ROW });}
}
