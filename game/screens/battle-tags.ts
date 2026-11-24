import { PICO8, drawText, textWidth } from '../../engine';
import type { Game } from '../state';
import { C_WARN, HUD_BOTTOM } from '../theme';

export interface PlateBox { x: number; y: number; w: number; h: number }
interface TagPlates { hero: PlateBox; enemy: PlateBox; pad: number }

type Ctx = CanvasRenderingContext2D;

const TAG_Y = HUD_BOTTOM + 3;

function drawTag(ctx: Ctx, text: string, x: number): void {
  const at = { x, y: TAG_Y };
  ctx.fillStyle = PICO8[0]; ctx.fillRect(at.x - 2, at.y - 2, textWidth(text, 1) + 4, 9);
  drawText(ctx, text, at, { color: C_WARN });
}

function drawHeroTags(g: Game, plates: TagPlates): void {
  const stacks = g.battle.state?.rampStacks ?? 0;
  if (stacks > 0) {drawTag(g.app.pc.ctx, `RAMP ${stacks}`, plates.hero.x + plates.pad);}
}

export function drawTags(g: Game, plates: TagPlates): void {
  drawHeroTags(g, plates);
}
