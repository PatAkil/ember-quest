import { PICO8 } from '../../engine';
import { FLOOR_Y } from '../theme';
import { accentHz } from '../widgets';

type Ctx = CanvasRenderingContext2D;

const GATE = { x: 152, y: 56, w: 48, h: FLOOR_Y - 56 };
const JAMB = 6;
const CX = GATE.x + GATE.w / 2;
const STEP_TONES: readonly string[] = [PICO8[6], PICO8[5], PICO8[5], PICO8[1], PICO8[1], PICO8[2]];
const STEP_PITCH = 5;
const STEP_SHRINK = 6;
const NEAR_STEP_W = GATE.w - 2 * JAMB - 2;
const GATE_DEEP = { x: CX, y: FLOOR_Y - 3 - STEP_TONES.length * STEP_PITCH };

function drawStones(ctx: Ctx): void {
  const { x, y, w, h } = GATE;
  ctx.fillStyle = PICO8[0]; ctx.fillRect(x - 1, y - 1, w + 2, h + 1);
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PICO8[6]; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(x + JAMB, y + JAMB, w - 2 * JAMB, h - JAMB);
  for (let row = y + 12; row < y + h; row += 10) {
    ctx.fillRect(x, row, JAMB - 1, 1); ctx.fillRect(x + w - JAMB + 1, row, JAMB - 1, 1);
  }
}

function drawStair(ctx: Ctx): void {
  STEP_TONES.forEach((tone, i) => {
    const w = NEAR_STEP_W - i * STEP_SHRINK;
    ctx.fillStyle = tone;
    ctx.fillRect(Math.round(CX - w / 2), FLOOR_Y - 3 - i * STEP_PITCH, w, 2);
  });
}

export function drawAbyssGate(ctx: Ctx): void {
  drawStones(ctx);
  drawStair(ctx);
}

export function drawGateGlow(ctx: Ctx, clock: number): void {
  const hot = accentHz(clock, 1.5, 0.5);
  const { x, y } = GATE_DEEP;
  ctx.fillStyle = PICO8[2]; ctx.fillRect(x - 5, y - 2, 10, 5);
  ctx.fillStyle = PICO8[8]; ctx.fillRect(x - 3, y - 1, 6, 3);
  ctx.fillStyle = hot ? PICO8[10] : PICO8[9]; ctx.fillRect(x - 1, y, 2, 1);
}
