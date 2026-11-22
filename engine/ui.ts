import type { PixelCanvas } from './draw';
import { drawText, textWidth } from './draw';

export const SAFE_MARGIN = 8;

export interface HudOptions {
  color?: string;
  scale?: number;
  shadow?: boolean | string;
  plate?: boolean;
}
export interface PanelOptions {
  color?: string;
  border?: string;
}
const PLATE_FILL = 'rgba(0,0,0,0.66)';
const PLATE_BORDER = 'rgba(255,255,255,0.18)';

export function drawPanel(
  pc: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {},
): void {
  const x0 = Math.max(SAFE_MARGIN, Math.round(x));
  const y0 = Math.max(SAFE_MARGIN, Math.round(y));
  const x1 = Math.min(pc.width - SAFE_MARGIN, Math.round(x + w));
  const y1 = Math.min(pc.height - SAFE_MARGIN, Math.round(y + h));
  if (x1 <= x0 || y1 <= y0) {return;}
  const ctx = pc.ctx;
  ctx.fillStyle = opts.color ?? PLATE_FILL;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const border = opts.border ?? PLATE_BORDER;
  if (border) {
    ctx.fillStyle = border;
    ctx.fillRect(x0, y0, x1 - x0, 1);
    ctx.fillRect(x0, y1 - 1, x1 - x0, 1);
    ctx.fillRect(x0, y0, 1, y1 - y0);
    ctx.fillRect(x1 - 1, y0, 1, y1 - y0);
  }
}
export function dimScene(pc: PixelCanvas, alpha = 0.55): void {
  pc.ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
  pc.ctx.fillRect(
    -DIM_BLEED,
    -DIM_BLEED,
    pc.width + 2 * DIM_BLEED,
    pc.height + 2 * DIM_BLEED,
  );
}
const DIM_BLEED = 16;
export function drawScore(pc: PixelCanvas, score: number, opts: HudOptions = {}): void {
  drawText(pc.ctx, `SCORE ${score}`, SAFE_MARGIN, SAFE_MARGIN, {
    color: opts.color ?? '#FFF1E8',
    scale: opts.scale ?? 1,
    shadow: opts.shadow ?? true,
  });
}
export function drawLives(pc: PixelCanvas, lives: number, opts: HudOptions = {}): void {
  const scale = opts.scale ?? 1;
  const text = `LIVES ${lives}`;
  const x = pc.width - SAFE_MARGIN - textWidth(text, scale);
  drawText(pc.ctx, text, x, SAFE_MARGIN, {
    color: opts.color ?? '#FFF1E8',
    scale,
    shadow: opts.shadow ?? true,
  });
}
export type HAnchor = 'left' | 'center' | 'right';
export type VAnchor = 'top' | 'middle' | 'bottom';
export function hudText(
  pc: PixelCanvas,
  text: string,
  h: HAnchor,
  v: VAnchor,
  opts: HudOptions = {},
): void {
  const scale = opts.scale ?? 1;
  const w = textWidth(text, scale);
  const glyphH = 5 * scale;
  let x: number;
  if (h === 'left') {x = SAFE_MARGIN;}
  else if (h === 'right') {x = pc.width - SAFE_MARGIN - w;}
  else {x = Math.round((pc.width - w) / 2);}
  let y: number;
  if (v === 'top') {y = SAFE_MARGIN;}
  else if (v === 'bottom') {y = pc.height - SAFE_MARGIN - glyphH;}
  else {y = Math.round((pc.height - glyphH) / 2);}
  const plate = opts.plate ?? (h === 'center' && v === 'middle' && scale >= 2);
  if (plate) {
    const padX = 4 * scale;
    const padY = 3 * scale;
    drawPanel(pc, x - padX, y - padY, w + 2 * padX + 1, glyphH + 2 * padY + 1, {
      border: opts.color ? hexToRgba(opts.color, 0.35) : PLATE_BORDER,
    });
  }
  drawText(pc.ctx, text, x, y, {
    color: opts.color ?? '#FFF1E8',
    scale,
    shadow: opts.shadow ?? true,
  });
}
function hexToRgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) {return color;}
  let hex = m[1];
  if (hex.length === 3) {hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];}
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}