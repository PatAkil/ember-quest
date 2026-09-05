// ui.ts — HUD helpers that keep score/lives/text a safe distance from the
// viewport edges. The inset is ONE mutable value, set once per game (see
// setSafeInset): every helper here clamps or anchors against it, so a screen
// that moves from a desktop margin to a phone's bigger one changes a single
// number, not every call site. SAFE_MARGIN, the v2 constant, is kept for the
// layout math that still names it and doubles as the inset's default (8 on
// every side). Readability rules live in the improving-game-quality skill.
//
// PRESENTATION DEFAULTS (they apply to every game, no opt-in needed):
//   * HUD text (drawScore/drawLives/hudText) carries a 1-logical-px drop
//     shadow, so a score never dissolves into a bright brick or platform.
//   * Large centered overlay text — hudText(..., 'center', 'middle', {scale >= 2}),
//     i.e. the PAUSED banner — gets a translucent dark plate behind it, so the
//     overlay reads as a layer above the game instead of fighting it.
// Both are switchable per call: `{ shadow: false }`, `{ plate: false }`.

import type { BitmapFont, PixelCanvas } from './draw';
import { FONT_RETRO, drawText, textWidth } from './draw';

/**
 * Logical-pixel inset all HUD elements keep from the screen edge — the v2
 * constant and the default of every side of the mutable inset below. The 720p
 * game sets its own (24, or 40 on a phone) through setSafeInset and never
 * reads this.
 */
export const SAFE_MARGIN = 8;

/** Per-side inset, logical px: what a drawn panel or HUD text keeps clear of the edge. */
export interface SafeInset {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Module state, deliberately: the inset is a property of the screen, not of a
// call, and there is one screen. One object for the life of the module —
// setSafeInset writes into it, getSafeInset hands it back — so neither
// allocates, and a caller that reads it every frame pays nothing.
const inset: SafeInset = { left: SAFE_MARGIN, top: SAFE_MARGIN, right: SAFE_MARGIN, bottom: SAFE_MARGIN };

/**
 * Set the inset for every helper here, per side; sides left out keep their
 * value. Call it once when the game boots (and again when the CSS scale says
 * the screen is a phone): `setSafeInset({ left: 24, top: 24, right: 24, bottom: 24 })`.
 */
export function setSafeInset(next: Partial<SafeInset>): void {
  if (next.left !== undefined) inset.left = next.left;
  if (next.top !== undefined) inset.top = next.top;
  if (next.right !== undefined) inset.right = next.right;
  if (next.bottom !== undefined) inset.bottom = next.bottom;
}

/**
 * The live inset — the same object every call, so read it, never keep a copy
 * expecting it to stay put, and never write to it (go through setSafeInset).
 */
export function getSafeInset(): Readonly<SafeInset> {
  return inset;
}

export interface HudOptions {
  color?: string;
  scale?: number;
  /** Face to draw with (default FONT_RETRO; the 720p HUD passes FONT_HD). */
  font?: BitmapFont;
  /** 1-px drop shadow under the glyphs. Default ON for all HUD helpers. */
  shadow?: boolean | string;
  /**
   * Translucent dark plate behind the text. Default ON for large centered
   * overlay text (h 'center' + v 'middle' + scale >= 2), OFF otherwise.
   */
  plate?: boolean;
}

export interface PanelOptions {
  /** Plate fill (default a translucent near-black). */
  color?: string;
  /** 1-px border color; pass '' for no border. */
  border?: string;
}

const PLATE_FILL = 'rgba(0,0,0,0.66)';
const PLATE_BORDER = 'rgba(255,255,255,0.18)';

/**
 * Translucent dark plate — the backing every overlay message should sit on.
 * Coordinates are logical pixels; the rect is clamped inside the safe inset
 * (a drawn panel never enters the margin — hit rects may, panels may not).
 *   drawPanel(pc, x, y, w, h, { border: PAL[6] })
 */
export function drawPanel(
  pc: PixelCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {},
): void {
  const x0 = Math.max(inset.left, Math.round(x));
  const y0 = Math.max(inset.top, Math.round(y));
  const x1 = Math.min(pc.width - inset.right, Math.round(x + w));
  const y1 = Math.min(pc.height - inset.bottom, Math.round(y + h));
  if (x1 <= x0 || y1 <= y0) return;
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

/**
 * Darken the whole frame — for GAME_OVER / WIN / PAUSED screens that keep the
 * world visible behind the message. Call it after the world, before the text.
 *
 * The fill is OVERSIZED by DIM_BLEED logical px on every side. dimScene is
 * normally called between juice.preRender/postRender, i.e. inside the shake
 * translate: a death shake displaces the whole frame by several px, and an
 * exactly-sized (0,0,W,H) rect would leave an undimmed strip of world along the
 * leading edges for the length of the shake. Bleeding past the viewport costs
 * nothing (it clips) and keeps the darkening edge-to-edge at any shake
 * amplitude the engine can produce.
 */
export function dimScene(pc: PixelCanvas, alpha = 0.55): void {
  pc.ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
  pc.ctx.fillRect(
    -DIM_BLEED,
    -DIM_BLEED,
    pc.width + 2 * DIM_BLEED,
    pc.height + 2 * DIM_BLEED,
  );
}

/**
 * Overscan for dimScene, in logical px — past the largest shake the game
 * produces: a 1280-wide frame shakes 20–30 px on a death, so 40 keeps the
 * edge covered with room to spare.
 */
const DIM_BLEED = 40;

/** Score, anchored inside the top-left safe corner. */
export function drawScore(pc: PixelCanvas, score: number, opts: HudOptions = {}): void {
  drawText(pc.ctx, `SCORE ${score}`, inset.left, inset.top, {
    color: opts.color ?? '#FFF1E8',
    scale: opts.scale ?? 1,
    font: opts.font,
    shadow: opts.shadow ?? true,
  });
}

/** Lives, anchored inside the top-right safe corner. */
export function drawLives(pc: PixelCanvas, lives: number, opts: HudOptions = {}): void {
  const scale = opts.scale ?? 1;
  const text = `LIVES ${lives}`;
  const x = pc.width - inset.right - textWidth(text, scale, 1, opts.font);
  drawText(pc.ctx, text, x, inset.top, {
    color: opts.color ?? '#FFF1E8',
    scale,
    font: opts.font,
    shadow: opts.shadow ?? true,
  });
}

export type HAnchor = 'left' | 'center' | 'right';
export type VAnchor = 'top' | 'middle' | 'bottom';

/**
 * Draw HUD text anchored to a screen edge/corner, always inside the safe inset.
 *   hudText(pc, 'PAUSED', 'center', 'middle')
 * Large centered text gets a plate behind it by default (see PanelOptions).
 */
export function hudText(
  pc: PixelCanvas,
  text: string,
  h: HAnchor,
  v: VAnchor,
  opts: HudOptions = {},
): void {
  const scale = opts.scale ?? 1;
  const w = textWidth(text, scale, 1, opts.font);
  const glyphH = (opts.font ?? FONT_RETRO).glyphH * scale;
  let x: number;
  if (h === 'left') x = inset.left;
  else if (h === 'right') x = pc.width - inset.right - w;
  else x = Math.round((pc.width - w) / 2);
  let y: number;
  if (v === 'top') y = inset.top;
  else if (v === 'bottom') y = pc.height - inset.bottom - glyphH;
  else y = Math.round((pc.height - glyphH) / 2);

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
    font: opts.font,
    shadow: opts.shadow ?? true,
  });
}

/** #RGB/#RRGGBB → rgba() at the given alpha; any other string is passed through. */
function hexToRgba(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  let hex = m[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
