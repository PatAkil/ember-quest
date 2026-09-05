// Ember Quest v3 — game/screens/hud.ts: the HUD language, shared by every
// screen. Lifted verbatim out of screens/battle.ts once the title, the cards,
// the end screens and the out-of-battle pause had to speak it too: one plate,
// one text call, one bar, one chip, so a panel in the crypt and a panel on
// the title screen are the same object drawn twice.
//
// No screen state, no scene knowledge: geometry and text only. Everything the
// player reads as UI goes through hudText/hudWidth — the vector HUD_FONT at
// HUD_PX / HUD_SMALL / HUD_LARGE, light weight, letter-spaced, on a 1-px dark
// drop shadow (DESIGN.md → UI constraints, "Two kinds of text"). The bitmap
// FONT_HD stays for what belongs to the world: damage pops, the logo, card
// titles and door labels.

import { PICO8 } from '../../engine';
import type { Element, SetBonus, Slot } from '../types';
import type { ActorRecipe } from '../art/actors';
import { bakePose } from '../art/actors';
import { HUD_FONT, HUD_LETTER_SPACING, HUD_PX, HUD_SMALL, PORTRAIT, STATUS_ICON } from './layout';

// ------------------------------------------------------------- element ui --
export const ELEMENT_COLOR: Record<Element, string> = {
  FIRE: PICO8[9], WIND: PICO8[11], WATER: PICO8[12], LIGHT: PICO8[10], DARK: PICO8[2],
};

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ==================================================================== text ==
/** `ctx.letterSpacing` is a recent addition; the manual path draws glyph by glyph where it is missing. */
type SpacedCtx = CanvasRenderingContext2D & { letterSpacing?: string };
let spacingSupported: boolean | null = null;
function canSpace(ctx: CanvasRenderingContext2D): boolean {
  if (spacingSupported === null) spacingSupported = typeof (ctx as SpacedCtx).letterSpacing === 'string';
  return spacingSupported;
}

/** Light weight everywhere: the contract asks for a light vector face, not the system default. */
export const HUD_WEIGHT = 300;
/** The one drop shadow, 1 px down-right — never a stroke, never a glow. */
export const HUD_SHADOW = 'rgba(3,4,10,0.85)';

function setHudFont(ctx: CanvasRenderingContext2D, px: number, weight: number): void {
  ctx.font = `${weight} ${px}px ${HUD_FONT}`;
  if (canSpace(ctx)) (ctx as SpacedCtx).letterSpacing = `${HUD_LETTER_SPACING}px`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
}
function clearHudFont(ctx: CanvasRenderingContext2D): void {
  if (canSpace(ctx)) (ctx as SpacedCtx).letterSpacing = '0px';
}

/** Width of `text` as hudText would draw it, letter spacing included. */
export function hudWidth(ctx: CanvasRenderingContext2D, text: string, px: number, weight: number = HUD_WEIGHT): number {
  setHudFont(ctx, px, weight);
  const w = canSpace(ctx)
    ? ctx.measureText(text).width
    : ctx.measureText(text).width + Math.max(0, text.length - 1) * HUD_LETTER_SPACING;
  clearHudFont(ctx);
  return w;
}

function fillSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  if (canSpace(ctx)) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + HUD_LETTER_SPACING;
  }
}

export interface HudTextOptions {
  px?: number;
  weight?: number;
  color?: string;
  /** 'left' (default) or 'right' — a right-aligned line is measured and drawn from x - width. */
  align?: 'left' | 'right';
  alpha?: number;
}

/** The one UI text call. `y` is the TOP of the line (textBaseline 'top'), matching the region table's row tops. */
export function hudText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: HudTextOptions = {}): number {
  const px = o.px ?? HUD_PX;
  const weight = o.weight ?? HUD_WEIGHT;
  setHudFont(ctx, px, weight);
  const w = canSpace(ctx)
    ? ctx.measureText(text).width
    : ctx.measureText(text).width + Math.max(0, text.length - 1) * HUD_LETTER_SPACING;
  const dx = o.align === 'right' ? x - w : x;
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  ctx.fillStyle = HUD_SHADOW;
  fillSpaced(ctx, text, Math.round(dx) + 1, Math.round(y) + 1);
  ctx.fillStyle = o.color ?? PICO8[7];
  fillSpaced(ctx, text, Math.round(dx), Math.round(y));
  ctx.globalAlpha = prevAlpha;
  clearHudFont(ctx);
  return w;
}

/** Centred inside a box — chips, buttons, tooltips. */
export function hudTextCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, o: HudTextOptions = {}): void {
  const px = o.px ?? HUD_PX;
  const tw = hudWidth(ctx, text, px, o.weight ?? HUD_WEIGHT);
  hudText(ctx, text, x + (w - tw) / 2, y + (h - px * 1.16) / 2, o);
}

// ================================================================= plates ===
/** A plate is a thin translucent slab, not a box: no bevel, no opaque fill, one lighter top edge. */
export const PLATE_ALPHA = 0.6;
export const PLATE_RADIUS = 4;
export const PLATE_INK = '6,8,16';
export const PLATE_TOP = 'rgba(255,255,255,0.16)';

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export interface PlateOptions {
  /** 0.55-0.65 by the contract; a tooltip sits a little denser so it reads over a lit sprite. */
  alpha?: number;
  /** A border, drawn instead of the default top-edge highlight when given (focus, rarity, ENRAGED). */
  border?: string;
  /** Border width in logical px — 1 by default; the focus ring is the only 2. */
  borderWidth?: number;
  radius?: number;
}

export function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: PlateOptions = {}): void {
  const px = Math.round(x) + 0.5;
  const py = Math.round(y) + 0.5;
  const pw = Math.round(w) - 1;
  const ph = Math.round(h) - 1;
  const r = o.radius ?? PLATE_RADIUS;
  ctx.save();
  roundRectPath(ctx, px, py, pw, ph, r);
  ctx.fillStyle = `rgba(${PLATE_INK},${o.alpha ?? PLATE_ALPHA})`;
  ctx.fill();
  ctx.lineWidth = o.borderWidth ?? 1;
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.stroke();
  } else {
    ctx.lineWidth = 1;
    // The 1-px lighter top edge: a lit lip, not a frame.
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + pw - r, py);
    ctx.strokeStyle = PLATE_TOP;
    ctx.stroke();
  }
  ctx.restore();
}

// ================================================================= gauges ===
/** HP: a thin bar with a dark bed, no keyline. `h` is the contract's 4 px in a panel, 12 on the stage. */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, fill: string): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  ctx.fillStyle = 'rgba(4,5,12,0.72)';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, Math.max(0, Math.round(w * clamp01(frac))), h);
}

// =============================================================== statuses ===
/** Status icons stay what they were: a small element-coloured glyph, now lettered in the HUD face. */
export function drawStatusChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  const s = STATUS_ICON;
  ctx.save();
  roundRectPath(ctx, Math.round(x) + 0.5, Math.round(y) + 0.5, s - 1, s - 1, 3);
  ctx.fillStyle = 'rgba(6,8,16,0.72)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  hudTextCentered(ctx, label, x, y, s, s, { px: HUD_SMALL, color });
}

// ============================================================== wrapping ===
/**
 * Greedy word-wrap for HUD text, capped at `maxLines` — layout.ts's `fitText`
 * is the bitmap twin of this: same policy, different ruler. A proportional
 * vector face cannot be measured by the bitmap's advance, so a blurb drawn in
 * the HUD font wraps through this one. The final kept line absorbs every
 * remaining word without further wrapping (the contract caps LINES, not
 * characters), so a caller that must not overflow truncates first.
 */
export function hudFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, px: number, maxLines: number): string[] {
  const words = text.split(' ').filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = line ? `${line} ${word}` : word;
    if (line === '' || hudWidth(ctx, candidate, px) <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    if (lines.length >= maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

// ================================================================== focus ===
/**
 * The focus ring is its OWN colour and its own weight, because a plate's
 * unfocused border is already saying something else — a relic's rarity, a
 * room's accent. Cream at 2 px on a denser plate is the one combination no
 * rarity can wear (COMMON is grey, RARE blue, EPIC pink, LEGENDARY orange), so
 * "which one is focused" is answered by colour AND width, never by colour alone.
 */
export const FOCUS_RING = PICO8[7];
export const FOCUS_RING_W = 2;
export const FOCUS_PLATE_ALPHA = 0.76;

// Two reused option records: a focusable plate is drawn several times a frame
// and must not allocate to do it.
const FOCUS_OPTS: PlateOptions = { border: FOCUS_RING, borderWidth: FOCUS_RING_W, alpha: FOCUS_PLATE_ALPHA };
const REST_OPTS: PlateOptions = {};

/** A plate that can hold focus: the ring when it does, its own accent (or nothing) when it does not. */
export function drawFocusablePlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  focused: boolean,
  accent?: string,
  alpha: number = PLATE_ALPHA,
): void {
  if (focused) {
    plate(ctx, x, y, w, h, FOCUS_OPTS);
    return;
  }
  REST_OPTS.border = accent;
  REST_OPTS.alpha = alpha;
  plate(ctx, x, y, w, h, REST_OPTS);
}

// ================================================================== relics ==
/** The slot, as the two-letter glyph the inspect overlay already uses. */
export const SLOT_ABBR: Record<Slot, string> = {
  WEAPON: 'Wp', BOOTS: 'Bt', ARMOR: 'Ar', NECKLACE: 'Nk', CHALICE: 'Ch', TOME: 'Tm',
};

/** A set's bonus as one short line — screens render text, never a raw SetBonus shape. */
export function formatSetBonus(bonus: SetBonus): string {
  switch (bonus.kind) {
    case 'STAT_PCT': return `+${bonus.pct}% ${bonus.stat}`;
    case 'STAT_PTS': return `+${bonus.pts} ${bonus.stat}`;
    case 'EXTRA_TURN': return `${Math.round(bonus.chance * 100)}% extra turn`;
    case 'STUN_ON_HIT': return `${Math.round(bonus.chance * 100)}% stun on hit`;
    case 'LEECH': return `heal ${Math.round(bonus.fraction * 100)}% dealt`;
    case 'IMMUNITY_START': return `IMMUNITY ${bonus.turns}t, +${bonus.res} RES`;
    case 'ATB_ON_HIT': return `+${Math.round(bonus.fraction * 100)}% ATB on hit`;
    case 'COUNTER': return `${Math.round(bonus.chance * 100)}% counter`;
    case 'SHIELD_START': return `party SHIELD ${Math.round(bonus.fraction * 100)}%`;
    case 'DESTROY': return 'shreds max HP';
    default: return '';
  }
}

// =============================================================== portraits ==
/**
 * An actor's face, cropped out of its baked idle pose and blown up into a
 * PORTRAIT-square bitmap with smoothing off, so it keeps its hard pixels inside
 * a smooth HUD. The battle ribbon's queue chips are these; so is the candidate
 * column on the who-wears-it row.
 *
 * Baked once per (recipe, element) — the one alpha scan happens here, at bake
 * time, exactly as the plane bakes do; no per-frame composition and no
 * per-frame getImageData.
 */
const PORTRAIT_CACHE = new Map<string, HTMLCanvasElement>();
/** How much of the silhouette's height is "the head" — the crop the portrait keeps. */
const PORTRAIT_HEAD_FRACTION = 0.42;

export function portraitFor(recipe: ActorRecipe, element: Element): HTMLCanvasElement | null {
  const key = `${recipe.id}|${element}`;
  const hit = PORTRAIT_CACHE.get(key);
  if (hit) return hit;
  const pose = bakePose(recipe, 'idle', 0, element);
  const out = document.createElement('canvas');
  out.width = PORTRAIT;
  out.height = PORTRAIT;
  const ctx = out.getContext('2d');
  // The alpha scan runs off a scratch copy that declares willReadFrequently —
  // reading straight off the art pipeline's own bitmap would demote it to a
  // software canvas for the rest of the run, and it is drawn every frame.
  const scan = document.createElement('canvas');
  scan.width = pose.width;
  scan.height = pose.height;
  const src = scan.getContext('2d', { willReadFrequently: true });
  if (!ctx || !src) return null;
  src.drawImage(pose, 0, 0);

  // Alpha bounding box of the baked pose — a recipe's silhouette sits wherever
  // its parts put it inside the res-square, so the crop is measured, not assumed.
  let x0 = pose.width;
  let y0 = pose.height;
  let x1 = -1;
  let y1 = -1;
  const data = src.getImageData(0, 0, pose.width, pose.height).data;
  for (let y = 0; y < pose.height; y++) {
    for (let x = 0; x < pose.width; x++) {
      if (data[(y * pose.width + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  ctx.imageSmoothingEnabled = false;
  if (x1 < x0 || y1 < y0) return out; // fully transparent pose: an empty chip beats a crash
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const headH = Math.max(4, Math.round(bh * PORTRAIT_HEAD_FRACTION));
  // Square the crop around the silhouette's centre line so the face is centred.
  const side = Math.max(headH, Math.min(bw, Math.round(headH * 1.15)));
  const cx = x0 + bw / 2;
  const sx = Math.round(cx - side / 2);
  const scale = PORTRAIT / side;
  ctx.drawImage(pose, sx, y0, side, side, 0, 0, Math.round(side * scale), Math.round(side * scale));
  PORTRAIT_CACHE.set(key, out);
  return out;
}
