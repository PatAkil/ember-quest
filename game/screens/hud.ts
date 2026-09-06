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
import type { Element, SetBonus, Slot, StatusKind } from '../types';
import type { ActorRecipe } from '../art/actors';
import { bakePose } from '../art/actors';
import type { PixelCanvas } from '../../engine';
import { CANVAS_W, HUD_FONT, HUD_LETTER_SPACING, HUD_PX, HUD_SMALL, PORTRAIT, safeInsetFor } from './layout';

// ============================================================ the accents ===
/**
 * ONE accent palette, pulled onto the grade. Pure yellow, pure cyan and pure
 * green belonged to no biome and were the most saturated things in the game;
 * these three are lifted straight off what is already lit: AMBER is the crypt's
 * key light (#ff9436) raised for text, COOL is the hue of Tide's orb (the WATER
 * glow ramp), HP is Gale's green (the WIND glow ramp). Every title, ring, prompt
 * and bar in the game picks from these three and nothing else.
 */
export const ACCENT = '#ffa64a';
export const ACCENT_COOL = '#4fc4de';
export const ACCENT_HP = '#7fd45c';
/** The two the logo needs: the amber one step deeper, and the shadow under it. */
export const ACCENT_DEEP = '#c96a22';
export const ACCENT_SHADOW = '#25131f';

/** The ink every plate, wash, trough and keyline is mixed from. */
export const INK = '6,8,16';
export const INK_KEYLINE = 'rgba(3,4,10,0.95)';
export const INK_TROUGH = 'rgba(3,4,10,0.7)';

/**
 * The four family colours the accents do not cover. Every screen picks from
 * here — the round before this had #f28a8a in two files, #ffd75e in two,
 * #c39ae8 in two and #9a95a8 in two, which is four palettes pretending to be
 * one. Nothing outside this file names a colour any more.
 */
/** Something is being done TO you: debuffs, cooldown pips, an enemy's hairline, GAME OVER. */
export const C_DEBUFF = '#f28a8a';
/** COMMON rarity, dim labels, a spent bar. */
export const C_MUTED = '#9a95a8';
/** A crit, a KINDLED relic — the one hot highlight. */
export const C_GOLD = '#ffd75e';
/** EPIC rarity and the DARK element. */
export const C_VIOLET = '#c39ae8';
/** Off-white for a label that must read without shouting (an unfocused primary button). */
export const C_CREAM = '#e6dfd2';
/** The crypt's key light itself — what the end screen's warm pool is mixed from. */
export const KEY_LIGHT = '#ff9436';

/**
 * The three neutral edges. A plate's lip, a resting border and a spent pip were
 * written as raw `rgba(255,255,255,...)` in five files; named once, "which
 * edge" is a choice rather than a number someone has to match by eye.
 */
export const EDGE_SOFT = 'rgba(255,255,255,0.2)';
export const EDGE_LIT = 'rgba(255,255,255,0.28)';
export const EDGE_REST = 'rgba(255,255,255,0.22)';
export const PIP_EMPTY = 'rgba(255,255,255,0.26)';

/**
 * Damage-pop families. The pop is bitmap text over a LIT floor, so every one of
 * these is read against `INK_KEYLINE`, not against the ground: `drawPops` lays a
 * 2-px ink keyline under the glyph before the colour goes down. GLANCE was
 * #9a95a8 and measured ~3:1 in the key pool — the weakest text in the frame —
 * so it is lifted here and the keyline does the rest.
 */
export const POP_PHYSICAL = '#f4f0e8';
export const POP_HEAL = '#9ff2c8';
export const POP_GLANCE = '#cfc9d8';
export const POP_CRIT = C_GOLD;

// ------------------------------------------------------------- element ui --
/** Element colours ride the same grade: warm amber, leaf, tide, gold, violet. */
export const ELEMENT_COLOR: Record<Element, string> = {
  FIRE: ACCENT, WIND: ACCENT_HP, WATER: ACCENT_COOL, LIGHT: '#ffd98a', DARK: '#b18cd9',
};
/** The same five families as a damage number: brighter, because a pop is read for a third of a second. */
export const POP_ELEMENT: Record<Element, string> = {
  FIRE: '#ffb15c', WIND: '#a8e07a', WATER: '#7fdcef', LIGHT: '#ffe9a8', DARK: C_VIOLET,
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
  ctx.beginPath();
  roundRectSubpath(ctx, x, y, w, h, r);
}

/**
 * The same rounded rectangle as a SUBPATH — it does not call `beginPath`, so a
 * caller can put a second shape in the same path. That is the whole difference
 * between a focus glow and a solid amber board: `focusGlow` clips
 * (padded box MINUS plate) even-odd, and `roundRectPath`'s own `beginPath`
 * silently threw the padded box away, leaving the clip equal to the plate and
 * the "glow" filling its interior instead of bleeding out of it.
 */
export function roundRectSubpath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
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
 * FOCUS IS LIGHT, NOT A KEYLINE. Round 2 retired the 1-px bordered rounded
 * rectangle as a BUTTON and then kept it as the focused STATE — the command
 * list, the leader rows, the draft cards, the map nodes and the bank rows all
 * answered "which one is the keyboard on?" with a hairline box, which is the
 * same web control wearing a different hat. Focus is now two things a lit
 * diorama can actually carry:
 *
 *   1. a GLOW in the key colour, bled around the plate (`focusGlow`, drawn
 *      UNDER it so it reads as light spilling out from behind), and
 *   2. a VALUE LIFT — a denser plate, a soft accent lip along the top and a
 *      faint tint across the body (`focusLift`), so the focused thing is
 *      brighter than its neighbours even in a greyscale reduction.
 *
 * `FOCUS_RING` is GONE: nothing in the game draws a focus ring any more. The
 * two pause overlays keep a border on their secondaries — over a 0.66 dim with
 * no lit world behind them a borderless plate dissolves — but that border is
 * `EDGE_LIT` in both states and the glow is what says which one is focused, so
 * the line is the button's own anatomy and never the cursor.
 */
export const FOCUS_PLATE_ALPHA = 0.76;
/** How far the focus glow bleeds, and how hard. */
export const FOCUS_GLOW_BLUR = 22;
export const FOCUS_GLOW_ALPHA = 0.42;

/**
 * The glow: the accent, blurred OUT OF the plate's own footprint and never
 * into it. The shape is filled with the accent under a shadow, but the fill
 * itself is clipped away — an even-odd clip of (a padded box MINUS the plate)
 * leaves the source invisible and only its bleed on the canvas. That clip is
 * built with `roundRectSubpath`, NOT `roundRectPath`: the latter opens a new
 * path and would drop the padded box, which turns the clip into the plate
 * itself and the glow into a 0.42-alpha accent slab a translucent plate cannot
 * hide — a focused party column as a solid amber board.
 *
 * ONE pass, wide and soft. A second tighter pass was tried and read as a 1-px
 * saturated keyline round every focused card, node and row — the bordered
 * rounded rectangle again, wearing the glow's name. Focus is carried by the
 * bleed plus `focusLift`'s value change, never by an edge.
 */
export function focusGlow(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  radius: number = PLATE_RADIUS, color: string = ACCENT, strength = 1,
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const pw = Math.round(w);
  const ph = Math.round(h);
  const pad = Math.ceil(FOCUS_GLOW_BLUR * strength) * 3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px - pad, py - pad, pw + pad * 2, ph + pad * 2);
  roundRectSubpath(ctx, px, py, pw, ph, radius);
  ctx.clip('evenodd');
  ctx.shadowColor = color;
  ctx.shadowBlur = FOCUS_GLOW_BLUR * strength;
  ctx.globalAlpha = FOCUS_GLOW_ALPHA * strength;
  ctx.fillStyle = color;
  roundRectPath(ctx, px, py, pw, ph, radius);
  ctx.fill();
  ctx.restore();
}

/**
 * The value lift: light LANDING on the plate — a short accent wash down from
 * its top edge, a 1-px lip where the light meets it, and a very faint tint
 * across the whole body so the focused thing is warmer and brighter than its
 * neighbours everywhere, not only at the head. That last term is what makes
 * focus survive a greyscale reduction; it is held at `FOCUS_BODY_ALPHA`
 * because at any more it stops being a value change and becomes a colour.
 * The head wash is capped at `FOCUS_LIFT_H` for the same reason — a
 * proportional lift on a 456-px party column would be a 228-px amber field.
 */
export const FOCUS_LIFT_H = 26;
export const FOCUS_BODY_ALPHA = 0.07;
/**
 * How much of the focus light a CHOSEN-but-not-focused thing carries — the
 * column the two party buttons will act on, the draft offer already picked.
 * It is the same light at a little over half strength, not a border: two
 * states in one vocabulary, told apart by how lit they are.
 */
export const FOCUS_CHOSEN = 0.55;

/**
 * A thing that has been PICKED but does not hold the keyboard — a banked chip,
 * a chosen set, the EPIC seat on a full SUMMON. The same light as focus at
 * `FOCUS_CHOSEN`, never a stroke: round 4 retired the last rest-state keylines,
 * so "picked" and "focused" differ by how lit they are and by nothing else.
 */
export function drawChosen(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  radius: number = PLATE_RADIUS, color: string = ACCENT,
): void {
  focusGlow(ctx, x, y, w, h, radius, color, FOCUS_CHOSEN);
  focusLift(ctx, x, y, w, h, radius, color, FOCUS_CHOSEN);
}
export function focusLift(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  radius: number = PLATE_RADIUS, color: string = ACCENT, strength = 1,
): void {
  const pw = Math.round(w);
  const ph = Math.round(h);
  const lh = Math.max(6, Math.min(FOCUS_LIFT_H, Math.round(h * 0.5)));
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  roundRectPath(ctx, 0, 0, pw, ph, radius);
  ctx.clip();
  ctx.globalAlpha = FOCUS_BODY_ALPHA * strength;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, pw, ph);
  ctx.globalAlpha = strength;
  ctx.fillStyle = tintGrad(ctx, lh, color, 0.3);
  ctx.fillRect(0, 0, pw, lh);
  ctx.globalAlpha = 0.45 * strength;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, pw, 1);
  ctx.restore();
}

// One reused option record: a focusable plate is drawn several times a frame
// and must not allocate to do it.
const REST_OPTS: PlateOptions = {};

/**
 * A plate that can hold focus: glow + a denser body + the accent lip when it
 * does, its own accent border (a relic's rarity, a room's colour) when it does
 * not. `accentColor` overrides what the glow is made of — a draft card glows in
 * its element, a relic card in its rarity — defaulting to the one amber.
 */
export function drawFocusablePlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  focused: boolean,
  accent?: string,
  alpha: number = PLATE_ALPHA,
  accentColor?: string,
): void {
  const glow = accentColor ?? accent ?? ACCENT;
  if (focused) {
    focusGlow(ctx, x, y, w, h, PLATE_RADIUS, glow);
    REST_OPTS.border = undefined;
    REST_OPTS.alpha = FOCUS_PLATE_ALPHA;
    plate(ctx, x, y, w, h, REST_OPTS);
    focusLift(ctx, x, y, w, h, PLATE_RADIUS, glow);
    return;
  }
  REST_OPTS.border = accent;
  REST_OPTS.alpha = alpha;
  plate(ctx, x, y, w, h, REST_OPTS);
}

// ================================================================== relics ==
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

// ============================================================ washes/plates ==
/**
 * A PLATE is not a box. The battle panels, the enemy plate and the log line all
 * sit on a top-down gradient that starts at `topAlpha` and reaches zero at the
 * foot, so the ink hangs under the text and the lit scene keeps coming through
 * underneath. Gradients are cached per (height, alpha) and positioned by
 * translate — a frame builds none.
 */
export const PANEL_TOP_ALPHA = 0.35;
const V_GRADS = new Map<string, CanvasGradient>();
const TINT_GRADS = new Map<string, CanvasGradient>();
const H_GRADS = new Map<string, CanvasGradient>();

function vGrad(ctx: CanvasRenderingContext2D, h: number, topAlpha: number, floorAlpha = 0): CanvasGradient {
  const key = `${h}|${topAlpha}|${floorAlpha}`;
  let g = V_GRADS.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgba(${INK},${topAlpha})`);
    g.addColorStop(0.62, `rgba(${INK},${Math.max(topAlpha * 0.42, floorAlpha)})`);
    // A plate with a FLOOR holds its ink almost to the bottom edge and only
    // then lets go, so a text block near the plate's foot still has ink under
    // it. Without one (the default, and every battle panel) the wash reaches
    // zero at 62 % and the scene comes back through — which is what let the
    // marsh's dead trees run through the relic rows.
    if (floorAlpha > 0) g.addColorStop(0.9, `rgba(${INK},${floorAlpha})`);
    g.addColorStop(1, `rgba(${INK},0)`);
    V_GRADS.set(key, g);
  }
  return g;
}
/**
 * `#rrggbb` -> `rgba(r,g,b,a)`. A gradient must fade a colour to ITS OWN zero
 * alpha, never to CSS `transparent` (which is transparent BLACK and drags an
 * amber wash toward soot on the way down).
 */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A top-down wash in an arbitrary colour — what makes the primary button read LIT rather than merely rimmed. */
function tintGrad(ctx: CanvasRenderingContext2D, h: number, color: string, alpha: number): CanvasGradient {
  const key = `${h}|${color}|${alpha}`;
  let g = TINT_GRADS.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, withAlpha(color, alpha));
    g.addColorStop(0.55, withAlpha(color, alpha * 0.3));
    g.addColorStop(1, withAlpha(color, 0));
    TINT_GRADS.set(key, g);
  }
  return g;
}

/** Widths are BUCKETED to 32 px: the log line's width changes with every damage
 * number it prints, and an exact-width key would grow this cache without bound. */
const WASH_BUCKET = 32;
function hWash(ctx: CanvasRenderingContext2D, w: number, alpha: number): CanvasGradient {
  const key = `${w}|${alpha}`;
  let g = H_GRADS.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(${INK},0)`);
    g.addColorStop(0.1, `rgba(${INK},${alpha})`);
    g.addColorStop(0.68, `rgba(${INK},${alpha})`);
    g.addColorStop(1, `rgba(${INK},0)`);
    H_GRADS.set(key, g);
  }
  return g;
}

/**
 * The gradient plate: ink at the top fading toward the foot, and a border ONLY
 * when it is focused or targeted.
 *
 * `base` is a FLAT ink fill laid under that gradient, and it is what makes a
 * plate HOLD. A gradient alone is a wash: however high its top alpha, the value
 * it reaches at the foot is the value the diorama comes back at, and the party
 * columns measured p10→p90 21.0–23.5 L at satMean 30–33 with the marsh's trees,
 * boat and lantern legible straight through six rows of text. The card plates
 * that work are not gradients at all — they are `plate()`'s flat fill at
 * `CARD_ALPHA`, and they measure 12.2–13.4 L at satMean 8–9. A base plus a
 * gradient is both: a floor no lower than the card's, with the top-down fall
 * that keeps a plate from reading as a box.
 */
export const COLUMN_BASE_ALPHA = 0.86;
/**
 * The base's own ink, and it is NOT `INK`. `INK` is `6,8,16` — a blue-leaning
 * ink that is right for a wash over a warm crypt and wrong as the thing a
 * column's colour is measured on: a plate built from it carries its own chroma
 * into the measurement on top of whatever the diorama leaks through. The base
 * is the same value at a neutral hue, so raising it buys density without buying
 * saturation.
 */
export const BASE_INK = '10,10,12';
export function gradientPlate(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  o: {
    topAlpha?: number; floorAlpha?: number; base?: number; border?: string;
    radius?: number; focused?: boolean; accent?: string;
  } = {},
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const pw = Math.round(w);
  const ph = Math.round(h);
  const r = o.radius ?? PLATE_RADIUS;
  if (o.focused) focusGlow(ctx, px, py, pw, ph, r, o.accent ?? ACCENT);
  ctx.save();
  ctx.translate(px, py);
  roundRectPath(ctx, 0, 0, pw, ph, r);
  if (o.base) {
    ctx.fillStyle = `rgba(${BASE_INK},${o.base})`;
    ctx.fill();
  }
  ctx.fillStyle = vGrad(ctx, ph, o.topAlpha ?? PANEL_TOP_ALPHA, o.floorAlpha ?? 0);
  ctx.fill();
  ctx.restore();
  if (o.focused) focusLift(ctx, px, py, pw, ph, r, o.accent ?? ACCENT);
  if (!o.border) return;
  ctx.save();
  roundRectPath(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, r);
  ctx.strokeStyle = o.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/**
 * THE TITLE BAND: the one box the bitmap face gets to itself. DESIGN.md's
 * "Two kinds of text" gives card and door titles to bitmap `FONT_HD` and
 * everything the player reads as UI to the vector HUD face — which is right,
 * and which put a 3x-scaled bitmap word two centimetres above vector body copy
 * INSIDE THE SAME PLATE on every relic card, wear column, room card, pact card
 * and door. The rule is kept and the collision is not: the title now sits on a
 * denser strip of its own across the head of the card, closed by the card's own
 * hairline, so the two voices are in two boxes. Top corners rounded to the
 * plate's radius, bottom square, because it is the head of the plate and not a
 * chip floating on it.
 */
export function titleBand(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string,
  radius: number = PLATE_RADIUS, alpha = 0.42,
): void {
  const px = Math.round(x);
  const py = Math.round(y);
  const pw = Math.round(w);
  const ph = Math.round(h);
  const rr = Math.min(radius, pw / 2, ph / 2);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px + rr, py);
  ctx.lineTo(px + pw - rr, py);
  ctx.arcTo(px + pw, py, px + pw, py + rr, rr);
  ctx.lineTo(px + pw, py + ph);
  ctx.lineTo(px, py + ph);
  ctx.lineTo(px, py + rr);
  ctx.arcTo(px, py, px + rr, py, rr);
  ctx.closePath();
  ctx.fillStyle = `rgba(${INK},${alpha})`;
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.fillRect(px, py + ph - 1, pw, 1);
  ctx.restore();
}

/**
 * THE CONTROLS HINT every run screen closes with, on its own wash. Round 4's
 * scene pass lifted the ground under it to p50 34-37, and a `C_DIM` line at
 * HUD_SMALL over lit stones is a line you have to hunt for. Same treatment as
 * the log: a short local wash the width of the words, faded out at both ends,
 * inside the safe inset — never a full-width plate.
 */
export function footHint(pc: PixelCanvas, text: string, color: string = PICO8[6]): void {
  const ctx = pc.ctx;
  const inset = safeInsetFor(pc);
  const y = pc.height - inset.bottom - 18;
  const w = hudWidth(ctx, text, HUD_SMALL);
  // The wash is a DRAWN element, so it stops at the safe inset — on a phone the
  // inset is 40 and its full height would put 4 px of ink into the margin.
  const wh = Math.min(HUD_SMALL + 14, pc.height - inset.bottom - (y - 7));
  textWash(ctx, (CANVAS_W - w) / 2 - 26, y - 7, w + 52, wh, 0.6);
  hudTextCentered(ctx, text, 0, y, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color });
}

/** A short local wash under one line of text — the log line's whole background: no rule, no box. */
export function textWash(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.5): void {
  const pw = Math.max(WASH_BUCKET, Math.ceil(w / WASH_BUCKET) * WASH_BUCKET);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = hWash(ctx, pw, alpha);
  ctx.fillRect(0, 0, pw, Math.round(h));
  ctx.restore();
}

// ================================================================ HP rules ===
/** The panel's HP bar: a 4-px rule the width of the NUMBER, over a trough tinted to the actor's element. */
export const HP_RULE_H = 4;

/**
 * ONE HP colour in the whole game — `ACCENT_HP` — which SHIFTS toward the
 * danger hue as the bar empties. Two colours for the same quantity (green in
 * battle, gold on the map) is two vocabularies; a single colour that never
 * changes is a bar the player has to read the NUMBER off to know they are
 * dying. So: green above `HP_DANGER_FROM`, and from there it walks to
 * `C_DEBUFF` — the colour everything done TO you already wears — reaching it
 * at `HP_DANGER_FULL`.
 *
 * The ramp is quantised to `HP_RAMP_N` steps and baked ONCE into an array of
 * colour strings: a bar is drawn several times a frame on the map and in every
 * panel, and mixing a colour per draw would build a string per bar per frame.
 */
export const HP_DANGER_FROM = 0.35;
export const HP_DANGER_FULL = 0.1;
const HP_RAMP_N = 12;
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const m = (sh: number): number => Math.round((((pa >> sh) & 255) * (1 - t)) + (((pb >> sh) & 255) * t));
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
const HP_RAMP: string[] = [];
for (let i = 0; i < HP_RAMP_N; i++) HP_RAMP.push(mixHex(ACCENT_HP, C_DEBUFF, i / (HP_RAMP_N - 1)));

/** The one HP colour at this fraction: `ACCENT_HP` healthy, walking to `C_DEBUFF` under 35 %. */
export function hpColor(frac: number): string {
  const f = clamp01(frac);
  if (f >= HP_DANGER_FROM) return HP_RAMP[0];
  const t = clamp01((HP_DANGER_FROM - f) / (HP_DANGER_FROM - HP_DANGER_FULL));
  return HP_RAMP[Math.min(HP_RAMP_N - 1, Math.round(t * (HP_RAMP_N - 1)))];
}

export function drawHpRule(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, element: Element, alive = true,
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const ww = Math.max(2, Math.round(w));
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.66)';
  ctx.fillRect(x0, y0, ww, HP_RULE_H);
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = ELEMENT_COLOR[element];
  ctx.fillRect(x0, y0, ww, HP_RULE_H);
  ctx.restore();
  ctx.fillStyle = alive ? hpColor(frac) : PICO8[5];
  ctx.fillRect(x0, y0, Math.max(0, Math.round(ww * clamp01(frac))), HP_RULE_H);
}

// =============================================================== pictograms ==
/**
 * Icons, not letters. Every status, relic slot and element is a small vector
 * mark authored in a 24x24 unit box and drawn at any size: colour carries the
 * family (debuff / buff / ward / element), shape carries the effect. Each
 * Path2D is built ONCE, on first use, and cached — a frame allocates nothing,
 * and nothing here runs at module load, so a headless import never touches the
 * DOM.
 */
export type IconName =
  | 'flame' | 'droplet' | 'shield' | 'shieldCrack' | 'sword' | 'swordDown' | 'wing' | 'star'
  | 'eye' | 'chain' | 'noHeal' | 'brand' | 'spiral' | 'halo' | 'counter'
  | 'boot' | 'cuirass' | 'pendant' | 'chalice' | 'tome'
  | 'swirl' | 'sun' | 'moon';

/**
 * `d` is the body. `cut` is stroked in INK over it — a crack, a seam, a split.
 * `over` is a second SHAPE laid on top with a keyline gap around it, which is
 * how a bar crosses a symbol without severing it (evenodd punched a hole
 * through `noHeal`'s cross and left two loose arms).
 */
interface IconSpec { d: string; evenodd?: boolean; stroke?: number; flipY?: boolean; cut?: string; over?: string }

const ICONS: Record<IconName, IconSpec> = {
  // --- statuses ---
  flame: { d: 'M12 1.5c3 5.2 6.2 6.6 6.2 11.4a6.2 6.2 0 0 1-12.4 0c0-3.1 2-4.4 3.1-7.2c1.1 3.1 2 4.2 2 6.2c1-2.1 1.1-6.2 1.1-10.4z' },
  droplet: { d: 'M12 2.4c4.1 5.1 6.2 8.1 6.2 11.1a6.2 6.2 0 0 1-12.4 0c0-3 2.1-6 6.2-11.1z' },
  shield: { d: 'M12 1.8l8.2 3v6.1c0 5.3-3.6 9.3-8.2 11.3c-4.6-2-8.2-6-8.2-11.3V4.8z' },
  // A shield SPLIT by a crack that runs edge to tip — the punched-out bolt read as a shield with a lightning badge on it.
  shieldCrack: { d: 'M12 1.8l8.2 3v6.1c0 5.3-3.6 9.3-8.2 11.3c-4.6-2-8.2-6-8.2-11.3V4.8z', cut: 'M12.8 2.2l-3.2 6.6l3.4 1.4l-3.4 4.2l2.4 1.6l-1.6 6.4' },
  sword: { d: 'M12 1.4l3 4.6v8.4H9V6z M6.6 14.4h10.8v2.4H6.6z M10.8 16.8h2.4V22.6h-2.4z' },
  swordDown: { d: 'M12 1.4l3 4.6v8.4H9V6z M6.6 14.4h10.8v2.4H6.6z M10.8 16.8h2.4V22.6h-2.4z', flipY: true },
  // A leading edge and three finger feathers: the old pair of tapers read as a leaf.
  wing: { d: 'M21.2 2.4C13 3.4 6 7.8 1.6 14.6l6.6-1l-3.2 4.4l6-1.6l-2.4 4.6l5-1.8l-1.2 3.6c6.6-3.6 10.4-11.6 9-20.8z' },
  star: { d: 'M12 1.6l3 6.5l7.1.8l-5.3 4.8l1.5 7l-6.3-3.5l-6.3 3.5l1.5-7L1.9 8.9l7.1-.8z' },
  eye: { d: 'M12 4.6c6.2 0 10.4 4.7 11.4 7.4c-1 2.7-5.2 7.4-11.4 7.4S1.6 14.7.6 12C1.6 9.3 5.8 4.6 12 4.6z M12 8.4a3.6 3.6 0 1 0 0 7.2a3.6 3.6 0 1 0 0-7.2z', evenodd: true },
  chain: { d: 'M3.4 5.2h8.2a3.2 3.2 0 0 1 0 6.4H3.4a3.2 3.2 0 0 1 0-6.4z M5 6.8h6.6a1.6 1.6 0 0 1 0 3.2H5a1.6 1.6 0 0 1 0-3.2z M12.4 12.4h8.2a3.2 3.2 0 0 1 0 6.4h-8.2a3.2 3.2 0 0 1 0-6.4z M14 14h6.6a1.6 1.6 0 0 1 0 3.2H14a1.6 1.6 0 0 1 0-3.2z', evenodd: true },
  // The bar lies OVER the cross with a keyline gap; as an evenodd hole it cut the cross into four loose arms.
  noHeal: { d: 'M9.2 3.2h5.6v6h6v5.6h-6v6H9.2v-6h-6V9.2h6z', over: 'M3.8 5.0l1.4-1.4L20.2 18.6l-1.4 1.4z' },
  brand: { d: 'M12 1.4l10.6 10.6L12 22.6L1.4 12z M12 6.2L6.2 12L12 17.8L17.8 12z M12 9.4a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z', evenodd: true },
  spiral: { d: 'M12 12a2 2 0 1 1-2.1-2a4.6 4.6 0 1 1-3.3 7.9a7.7 7.7 0 1 1 10.9-10.9', stroke: 2.4 },
  halo: { d: 'M12 5.6c5.6 0 10.2 2.1 10.2 4.7S17.6 15 12 15S1.8 12.9 1.8 10.3S6.4 5.6 12 5.6z M12 7.8c-4.1 0-7.2 1.2-7.2 2.5s3.1 2.5 7.2 2.5s7.2-1.2 7.2-2.5S16.1 7.8 12 7.8z', evenodd: true },
  counter: { d: 'M5.6 3.6v6.6a4.2 4.2 0 0 0 4.2 4.2h5.4v3.2H9.8a7.4 7.4 0 0 1-7.4-7.4V3.6z M14.6 10.6l7.4 4.6l-7.4 4.6z' },
  // --- relic slots ---
  boot: { d: 'M6.4 2.2h4.8v8.6c0 2 1.2 3.2 3.2 4.2l4.4 2.2c1.2.6 2.4 1.4 2.4 3v1.6H6.4z' },
  cuirass: { d: 'M8 2.4L12 5.4L16 2.4L20.4 4.6l-1.2 5.6l1.2 3.2l-2.2 8.2H5.8L3.6 13.4l1.2-3.2L3.6 4.6z' },
  pendant: { d: 'M2.2 3.4c2 8.2 6.4 11.4 9.8 11.4s7.8-3.2 9.8-11.4l2.2.8c-2.2 9.2-7.6 12.8-12 12.8S2.2 13.4 0 4.2z M12 15.4l3.2 3.4l-3.2 3.6l-3.2-3.6z' },
  chalice: { d: 'M4.6 2.6h14.8l-2 7.2a5.4 5.4 0 0 1-4.2 3.8v5.2h4v2.6H6.8v-2.6h4v-5.2a5.4 5.4 0 0 1-4.2-3.8z' },
  // Drawn as an OUTLINE — two page edges and a spine. The filled pair closed into a plain square below 32 px.
  tome: { d: 'M3 4.8h7.4v14.4H3z M13.6 4.8h7.4v14.4h-7.4z M12 3.4v17.2', stroke: 2 },
  // --- elements ---
  swirl: { d: 'M2.4 8.2h11.2a3.2 3.2 0 1 0-3.2-3.2 M2.4 13.4h14.8a3.6 3.6 0 1 1-3.6 3.6', stroke: 2.2 },
  sun: { d: 'M12 7.2a4.8 4.8 0 1 1 0 9.6a4.8 4.8 0 1 1 0-9.6z M10.9.8h2.2v4h-2.2z M10.9 19.2h2.2v4h-2.2z M.8 10.9h4v2.2h-4z M19.2 10.9h4v2.2h-4z M3.9 5.4l1.5-1.5l2.9 2.9l-1.5 1.5z M15.7 17.2l1.5-1.5l2.9 2.9l-1.5 1.5z M5.4 20.1l-1.5-1.5l2.9-2.9l1.5 1.5z M17.2 8.3l-1.5-1.5l2.9-2.9l1.5 1.5z' },
  moon: { d: 'M16 3.4A9.4 9.4 0 1 0 16 20.6A12 12 0 0 1 16 3.4z' },
};

const PATHS = new Map<IconName, Path2D>();
function pathFor(name: IconName): Path2D {
  let p = PATHS.get(name);
  if (!p) {
    p = new Path2D(ICONS[name].d);
    PATHS.set(name, p);
  }
  return p;
}

/** The dark keyline every pictogram wears, so one mark reads over a lit floor AND over a plate. */
const ICON_KEYLINE = 'rgba(3,4,10,0.9)';
const CUT_CACHE = new Map<IconName, Path2D>();
const OVER_CACHE = new Map<IconName, Path2D>();
function subPath(cache: Map<IconName, Path2D>, name: IconName, d: string): Path2D {
  let p = cache.get(name);
  if (!p) {
    p = new Path2D(d);
    cache.set(name, p);
  }
  return p;
}

/** Draw a pictogram with its top-left at (x, y), `size` px square, in `color`. */
export function drawIcon(
  ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, color: string, alpha = 1,
): void {
  const spec = ICONS[name];
  const path = pathFor(name);
  const s = size / 24;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  if (spec.flipY) {
    ctx.translate(Math.round(x), Math.round(y) + size);
    ctx.scale(s, -s);
  } else {
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(s, s);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (spec.stroke) {
    ctx.strokeStyle = ICON_KEYLINE;
    ctx.lineWidth = spec.stroke + 2.2;
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = spec.stroke;
    ctx.stroke(path);
  } else {
    ctx.strokeStyle = ICON_KEYLINE;
    ctx.lineWidth = 2.6;
    ctx.stroke(path);
    ctx.fillStyle = color;
    if (spec.evenodd) ctx.fill(path, 'evenodd');
    else ctx.fill(path);
  }
  if (spec.cut) {
    ctx.strokeStyle = ICON_KEYLINE;
    ctx.lineWidth = 2.4;
    ctx.stroke(subPath(CUT_CACHE, name, spec.cut));
  }
  if (spec.over) {
    const q = subPath(OVER_CACHE, name, spec.over);
    ctx.strokeStyle = ICON_KEYLINE;
    ctx.lineWidth = 3.6;
    ctx.stroke(q);
    ctx.fillStyle = color;
    ctx.fill(q);
  }
  ctx.restore();
}

/** Shape carries the effect: every status kind has its own mark. */
export const STATUS_ICON_NAME: Record<StatusKind, IconName> = {
  BURN: 'flame', SLOW: 'droplet', SHIELD: 'shield', DEF_UP: 'shield', DEF_BREAK: 'shieldCrack',
  ATK_UP: 'sword', ATK_BREAK: 'swordDown', SPD_UP: 'wing', CRIT_UP: 'star', GLANCE: 'eye',
  SILENCE: 'chain', HEAL_BLOCK: 'noHeal', BRAND: 'brand', STUN: 'spiral',
  IMMUNITY: 'halo', INVINCIBLE: 'halo', COUNTER: 'counter',
};
/** The six relic slots, as the marks the cards and the inspect rows both draw. */
export const SLOT_ICON_NAME: Record<Slot, IconName> = {
  WEAPON: 'sword', BOOTS: 'boot', ARMOR: 'cuirass', NECKLACE: 'pendant', CHALICE: 'chalice', TOME: 'tome',
};
/** Colour carries the family: the element's own mark, in the element's own colour. */
export const ELEMENT_ICON_NAME: Record<Element, IconName> = {
  FIRE: 'flame', WIND: 'swirl', WATER: 'droplet', LIGHT: 'sun', DARK: 'moon',
};

// ================================================================= buttons ===
/**
 * TWO buttons in the whole game, and neither is a bordered rounded rectangle.
 * The PRIMARY action is a lit borderless plate with a soft key-coloured glow —
 * it is the thing to press, so it is the thing that is lit. The SECONDARY is
 * plain text that grows a focus underline. Both keep their full contract hit
 * rect; only the paint is smaller.
 */
export function drawPrimaryButton(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string,
  focused: boolean, pressed = false, accent: string = ACCENT,
): void {
  // THE PRIMARY IS A POOL OF LIGHT, NOT A ROUNDED RECT (round-4 defect 7). The
  // same 384x56 gradient rounded rectangle with an outer glow and a centred
  // sans-serif word appeared on seven screens in the first ten minutes, and at
  // x3 it is the anatomy of a web CTA whatever colour it is painted. What
  // replaces it keeps every affordance and drops the box:
  //
  //   * the ends FEATHER. The ink is a horizontal gradient that reaches zero
  //     `PRIMARY_FEATHER` of the way in from each edge, so the slab has no left
  //     or right edge at all — it is a lit patch of the floor with a word in it,
  //     the way the log line already sits on its own wash.
  //   * the light comes from ABOVE and lands where the diorama's key does: the
  //     accent wash peaks on the top edge and falls through the body, and the
  //     1-px lip along the top is that light meeting the slab, not a rule.
  //   * FOCUS is the same glow-and-lift the rest of the game uses, and it is the
  //     only state that adds an outer bleed. At rest there is none.
  const ph = Math.min(h, 56);
  const py = Math.round(y + (h - ph) / 2) + (pressed ? 1 : 0);
  const px = Math.round(x);
  const pw = Math.round(w);
  if (focused) focusGlow(ctx, px + Math.round(pw * 0.12), py + 4, Math.round(pw * 0.76), ph - 8, ph / 2, accent, 0.9);
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  // THE INK IS A LOW ELLIPSE, not a rectangle with feathered ends. Feathering
  // only the left and right left the top and bottom as hard horizontal lines,
  // so what the player saw was a lit BAND with a word in it. An elliptical
  // radial — a circular gradient under a vertical squash — has no straight edge
  // anywhere: it is a patch of the floor that happens to be lit, which is what
  // an HD-2D primary is.
  ctx.scale(1, ph / pw);
  ctx.fillStyle = primaryInk(ctx, pw, focused ? 0.9 : 0.84);
  ctx.beginPath();
  ctx.arc(0, 0, pw / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The key's own light landing on it from above, ADDED rather than painted: a
  // radial centred on the patch's crown falls off downward and outward, so the
  // light has no edge either, and it is what says "light lands here" now that
  // the straight 2-px lip is gone.
  ctx.save();
  ctx.translate(px, py);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = focused ? 1 : 0.82;
  ctx.fillStyle = primaryPool(ctx, pw, ph, accent);
  ctx.fillRect(-pw * 0.1, -ph * 0.3, pw * 1.2, ph * 1.6);
  ctx.restore();
  hudTextCentered(ctx, label, px, py, pw, ph, { color: focused ? PICO8[7] : C_CREAM });
}

/**
 * Where the patch's ink stops being solid, as a fraction of its radius — the
 * outer 24 % is the feather, and because the shape is a squashed circle that
 * feather is on all four sides at once.
 */
export const PRIMARY_FEATHER = 0.62;
const PRIMARY_INKS = new Map<string, CanvasGradient>();
function primaryInk(ctx: CanvasRenderingContext2D, w: number, alpha: number): CanvasGradient {
  const key = `${w}|${alpha}`;
  let g = PRIMARY_INKS.get(key);
  if (!g) {
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, `rgba(${INK},${alpha})`);
    g.addColorStop(PRIMARY_FEATHER, `rgba(${INK},${alpha})`);
    g.addColorStop(1, `rgba(${INK},0)`);
    PRIMARY_INKS.set(key, g);
  }
  return g;
}
const PRIMARY_POOLS = new Map<string, CanvasGradient>();
function primaryPool(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): CanvasGradient {
  const key = `${w}|${h}|${color}`;
  let g = PRIMARY_POOLS.get(key);
  if (!g) {
    g = ctx.createRadialGradient(w / 2, h * 0.16, 0, w / 2, h * 0.16, Math.max(w * 0.5, h * 1.4));
    g.addColorStop(0, withAlpha(color, 0.7));
    g.addColorStop(0.42, withAlpha(color, 0.38));
    g.addColorStop(1, withAlpha(color, 0));
    PRIMARY_POOLS.set(key, g);
  }
  return g;
}

/**
 * The primary's seat while there is nothing to press yet — a SUMMON before an
 * offer is picked, the ALTAR before a member is. It was bare dim grey text on
 * the floor, so the biggest control on the screen had no affordance at all
 * until it was already answered. Now it is the same slab at a fraction of the
 * light: unmistakably a button, unmistakably not ready.
 */
export function drawPendingButton(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string,
  accent: string = ACCENT,
): void {
  const ph = Math.min(h, 56);
  const py = Math.round(y + (h - ph) / 2);
  const px = Math.round(x);
  const pw = Math.round(w);
  ctx.save();
  ctx.translate(px, py);
  roundRectPath(ctx, 0, 0, pw, ph, 6);
  ctx.fillStyle = `rgba(${INK},0.62)`;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = tintGrad(ctx, ph, accent, 0.1);
  ctx.fillRect(0, 0, pw, ph);
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, pw, 1);
  ctx.restore();
  hudTextCentered(ctx, label, px, py, pw, ph, { color: C_MUTED });
}

/**
 * The quiet half of a pair. It is still TEXT, not a slab — but it is text on a
 * PLATE, because DECLINE / SKIP / WALK PAST / KEEP <name> printed straight onto
 * a lit floor read as a caption, not as a thing to press: three of the four
 * controls on a SUMMON had no visible seat at all. The plate is short, quiet
 * and borderless; focus adds the glow and the underline.
 */
export function drawSecondaryButton(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string,
  focused: boolean, accent: string = ACCENT,
): void {
  const px = HUD_PX;
  const tw = hudWidth(ctx, label, px);
  const tx = Math.round(x + (w - tw) / 2);
  const ty = Math.round(y + (h - px * 1.16) / 2);
  // The seat: the label's own width plus air, never the full hit rect — a
  // secondary that fills its 280 px would weigh the same as the primary.
  const sw = Math.min(Math.round(w), Math.round(tw) + 56);
  const sh = Math.min(Math.round(h), 44);
  const sx = Math.round(x + (w - sw) / 2);
  const sy = Math.round(y + (h - sh) / 2);
  if (focused) focusGlow(ctx, sx, sy, sw, sh, 6, accent, 0.8);
  ctx.save();
  ctx.translate(sx, sy);
  roundRectPath(ctx, 0, 0, sw, sh, 6);
  ctx.fillStyle = `rgba(${INK},${focused ? 0.7 : 0.44})`;
  ctx.fill();
  ctx.restore();
  hudText(ctx, label, tx, ty, { color: focused ? PICO8[7] : C_CREAM });
  if (!focused) return;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = accent;
  ctx.fillRect(tx, ty + Math.round(px * 1.16) + 3, Math.round(tw), 2);
  ctx.restore();
}
