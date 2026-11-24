import { PICO8, drawText, textWidth } from '../../engine';
import { EMBER_MAX } from '../types';
import type { BattleState, EnemyInstance, Hero } from '../types';
import { derive, desperate, punishes, woundUp } from '../sim';
import { guardShown } from '../fx';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_TEXT, C_WARD, C_WARN, ELEMENT_COLOR, HUD_BOTTOM } from '../theme';
import type { Seg } from './battle-preview';

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
export const C_AFFIX = PICO8[8];

function affixChoices(affixes: readonly string[], clock: number): Choices {
  const shown = affixes[Math.floor(clock / AFFIX_CYCLE) % Math.max(1, affixes.length)];
  if (shown === undefined) {return [];}
  const more = affixes.length - 1;
  const alone = word(shown, C_AFFIX);
  return more > 0 ? [[{ text: shown, color: C_AFFIX }, { text: `+${String(more)}`, color: C_DIM }], alone] : [alone];
}

function enemyTags(e: EnemyInstance, clock: number): Choices[] {
  const tags: Choices[] = [];
  if (e.def.weak) {tags.push([[{ text: 'WEAK', color: C_TEXT }, { text: e.def.weak, color: ELEMENT_COLOR[e.def.weak] }]]);}
  tags.push(affixChoices(e.affixes, clock));
  if (e.wardTurns > 0) {tags.push([word(`WARD ${e.wardTurns}`, C_WARD)]);}
  if (e.burn) {tags.push([word(`BURN ${e.burn.turns}`, C_EMBER)]);}
  if (e.def.resists) {tags.push([[{ text: 'RES', color: C_DIM }, { text: e.def.resists, color: ELEMENT_COLOR[e.def.resists] }]]);}
  return tags;
}

function heroTags(hero: Hero, state: BattleState | null, guard: boolean): Tag[] {
  const tags: Tag[] = [];
  if (hero.burn) {tags.push(word(`BURN ${hero.burn.turns}`, C_EMBER));}
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
  if (!g.heroDown) {drawStrip(ctx, heroTags(g.hero, state, guardShown(g)).map((t) => [t]), { plate: plates.hero, pad: plates.pad, y: HERO_TAG_Y });}
  if (enemy && enemy.hp > 0) {drawStrip(ctx, enemyTags(enemy, g.clock), { plate: plates.enemy, pad: plates.pad, y: ENEMY_TAG_Y });}
}
