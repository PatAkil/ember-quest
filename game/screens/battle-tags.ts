import { PICO8, drawText, textWidth } from '../../engine';
import { EMBER_MAX } from '../types';
import type { BattleState, EnemyInstance, Hero } from '../types';
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

function drawStrip(ctx: Ctx, tags: readonly Tag[], strip: Strip): void {
  const { plate, pad, y } = strip;
  const right = plate.x + plate.w - pad + BACK_PAD;
  let x = plate.x + pad;
  for (const tag of tags) {
    const w = tagWidth(tag);
    if (x + w + BACK_PAD > right) {continue;}
    drawTag(ctx, tag, { x, y });
    x += w + 2 * BACK_PAD + TAG_GAP;
  }
}

const word = (text: string, color: string): Tag => [{ text, color }];

function enemyTags(e: EnemyInstance): Tag[] {
  const tags: Tag[] = [];
  if (e.def.weak) {tags.push([{ text: 'WEAK', color: C_TEXT }, { text: e.def.weak, color: ELEMENT_COLOR[e.def.weak] }]);}
  if (e.wardTurns > 0) {tags.push(word(`WARD ${e.wardTurns}`, C_WARD));}
  if (e.burn) {tags.push(word(`BURN ${e.burn.turns}`, C_EMBER));}
  if (e.def.resists) {tags.push([{ text: 'RES', color: C_DIM }, { text: e.def.resists, color: ELEMENT_COLOR[e.def.resists] }]);}
  for (const affix of e.affixes) {tags.push(word(affix, C_DIM));}
  return tags;
}

function heroTags(hero: Hero, state: BattleState | null): Tag[] {
  const tags: Tag[] = [];
  if (hero.burn) {tags.push(word(`BURN ${hero.burn.turns}`, C_EMBER));}
  if (state?.riposte) {tags.push(word('RIPOSTE', C_ACCENT));}
  if (state?.guarding) {tags.push(word('GUARD', C_WARD));}
  if (state && state.rampStacks > 0) {tags.push(word(`RAMP ${state.rampStacks}`, C_WARN));}
  if (hero.ember >= EMBER_MAX) {tags.push(word('BURST READY', C_ACCENT));}
  return tags;
}

export function drawTags(g: Game, plates: TagPlates): void {
  const ctx = g.app.pc.ctx;
  const { enemy, state } = g.battle;
  if (!g.heroDown) {drawStrip(ctx, heroTags(g.hero, state), { plate: plates.hero, pad: plates.pad, y: HERO_TAG_Y });}
  if (enemy && enemy.hp > 0) {drawStrip(ctx, enemyTags(enemy), { plate: plates.enemy, pad: plates.pad, y: ENEMY_TAG_Y });}
}
