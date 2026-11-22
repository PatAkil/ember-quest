export interface PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  clear(color?: string): void;
}

export interface CreatePixelCanvasOptions {
  width: number;
  height: number;
  scale?: number;
  parent?: HTMLElement | null;
}
export function createPixelCanvas(opts: CreatePixelCanvasOptions): PixelCanvas {
  if (opts.parent === null) {
    throw new Error(
      'createPixelCanvas: parent is null — mount point not found (check the id passed to getElementById against index.html)',
    );
  }
  const { width, height } = opts;
  const scale = opts.scale ?? 3;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {throw new Error('2D canvas context unavailable');}
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  (opts.parent ?? document.body).appendChild(canvas);
  return {
    canvas,
    ctx,
    width,
    height,
    scale,
    clear(color = '#000000') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    },
  };
}
export type SpriteMap = Record<string, string>;

export interface Sprite {
  readonly w: number;
  readonly h: number;

  readonly pixels: readonly (string | null)[];
}
export interface MakeSpriteOptions {
  outline?: string;

  flipX?: boolean;
}
export function makeSprite(rows: string[], map: SpriteMap, opts: MakeSpriteOptions = {}): Sprite {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pixels: (string | null)[] = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      pixels.push(ch !== undefined && ch !== '.' && ch !== ' ' && map[ch] ? map[ch] : null);
    }
  }
  let sprite: Sprite = { w, h, pixels };
  if (opts.outline) {sprite = outlineSprite(sprite, opts.outline);}
  if (opts.flipX) {sprite = flipSprite(sprite);}
  return sprite;
}
function outlineSprite(sprite: Sprite, color: string): Sprite {
  const w = sprite.w + 2;
  const h = sprite.h + 2;
  const pixels: (string | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      pixels[(y + 1) * w + (x + 1)] = sprite.pixels[y * sprite.w + x];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[y * w + x]) {continue;}
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {continue;}
          const nx = x + dx - 1;
          const ny = y + dy - 1;
          if (nx < 0 || ny < 0 || nx >= sprite.w || ny >= sprite.h) {continue;}
          if (sprite.pixels[ny * sprite.w + nx]) { touches = true; break; }
        }
      }
      if (touches) {pixels[y * w + x] = color;}
    }
  }
  return { w, h, pixels };
}
export function flipSprite(sprite: Sprite): Sprite {
  const { w, h } = sprite;
  const pixels: (string | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {pixels[y * w + (w - 1 - x)] = sprite.pixels[y * w + x];}
  }
  return { w, h, pixels };
}
export function frameIndex(time: number, fps: number, count: number): number {
  if (count <= 1 || fps <= 0) {return 0;}
  if (!Number.isFinite(time)) {return 0;}
  const i = Math.floor(time * fps) % count;
  return i < 0 ? i + count : i;
}
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  px = 1,
): void {
  for (let cy = 0; cy < sprite.h; cy++) {
    for (let cx = 0; cx < sprite.w; cx++) {
      const color = sprite.pixels[cy * sprite.w + cx];
      if (!color) {continue;}
      ctx.fillStyle = color;
      ctx.fillRect(x + cx * px, y + cy * px, px, px);
    }
  }
}

const GLYPH_W = 3;
const GLYPH_H = 5;
function glyphWidth(glyph: string[] | undefined): number {
  return glyph ? glyph[0].length : GLYPH_W;
}
const FONT: Record<string, string[]> = {
  A: ['###', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['###', '#..', '#..', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['###', '#..', '#.#', '#.#', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['###', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  P: ['###', '#.#', '###', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'],
  R: ['###', '#.#', '###', '##.', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ' ': ['...', '...', '...', '...', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['###', '..#', '.#.', '...', '.#.'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '=': ['...', '###', '...', '###', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'],
  ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '*': ['...', '#.#', '.#.', '#.#', '...'],
  '#': ['#.#', '###', '#.#', '###', '#.#'],
};
export interface TextOptions {
  color?: string;
  scale?: number;
  spacing?: number;
  shadow?: boolean | string;
  outline?: boolean | string;
}
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
];
const SHADOW_OFFSETS: readonly (readonly [number, number])[] = [[1, 1]];
const NO_OFFSETS: readonly (readonly [number, number])[] = [];
const OUTLINE_MIN_SCALE = 3;
export const SHADOW_COLOR = 'rgba(0,0,0,0.7)';

export const OUTLINE_COLOR = '#000000';
export function textWidth(text: string, scale = 1, spacing = 1): number {
  const upper = text.toUpperCase();
  if (upper.length === 0) {return 0;}
  let w = 0;
  for (const raw of upper) {w += (glyphWidth(FONT[raw]) + spacing) * scale;}
  return w - spacing * scale;
}
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): void {
  const color = opts.color ?? '#FFF1E8';
  const scale = opts.scale ?? 1;
  const spacing = opts.spacing ?? 1;
  const upper = text.toUpperCase();

  const wantsOutline = opts.outline !== undefined && opts.outline !== false;
  const outline = wantsOutline && scale >= OUTLINE_MIN_SCALE ? opts.outline : undefined;
  const shadow = outline === undefined && wantsOutline ? opts.outline : opts.shadow;
  const offsets = outline ? OUTLINE_OFFSETS : shadow ? SHADOW_OFFSETS : NO_OFFSETS;
  if (offsets.length > 0) {
    const back = outline ?? shadow;
    ctx.fillStyle = typeof back === 'string' ? back : outline ? OUTLINE_COLOR : SHADOW_COLOR;
    for (const [ox, oy] of offsets) {
      let sc = x + ox;
      for (const raw of upper) {
        const glyph = FONT[raw];
        const gw = glyphWidth(glyph);
        if (glyph) {
          for (let gy = 0; gy < GLYPH_H; gy++) {
            const row = glyph[gy];
            for (let gx = 0; gx < gw; gx++) {
              if (row[gx] === '#') {ctx.fillRect(sc + gx * scale, y + oy + gy * scale, scale, scale);}
            }
          }
        }
        sc += (gw + spacing) * scale;
      }
    }
  }
  ctx.fillStyle = color;
  let cursor = x;
  for (const raw of upper) {
    const glyph = FONT[raw];
    const gw = glyphWidth(glyph);
    if (glyph) {
      for (let gy = 0; gy < GLYPH_H; gy++) {
        const row = glyph[gy];
        for (let gx = 0; gx < gw; gx++) {
          if (row[gx] === '#') {
            ctx.fillRect(cursor + gx * scale, y + gy * scale, scale, scale);
          }
        }
      }
    }
    cursor += (gw + spacing) * scale;
  }
}
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  areaWidth: number,
  y: number,
  opts: TextOptions = {},
): void {
  const scale = opts.scale ?? 1;
  const w = textWidth(text, scale, opts.spacing ?? 1);
  const outline = opts.outline ?? (opts.shadow === undefined && scale >= 2);
  drawText(ctx, text, Math.round((areaWidth - w) / 2), y, { ...opts, outline });
}
export function blink(time: number, period = 0.9, onRatio = 0.6): number {
  const phase = ((time % period) + period) % period;
  return phase < period * onRatio ? 1 : 0;
}
export function pulse(time: number, period = 1.2): number {
  return 0.5 - 0.5 * Math.cos((time / period) * Math.PI * 2);
}
export function fillBands(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
): void {
  const n = colors.length;
  if (n === 0 || w <= 0 || h <= 0) {return;}
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const wi = Math.round(w);
  const hi = Math.round(h);
  const band = Math.floor(hi / n);
  let cy = y0;
  for (let i = 0; i < n; i++) {
    const bh = i === n - 1 ? y0 + hi - cy : band;
    if (bh <= 0) {continue;}
    ctx.fillStyle = colors[i];
    ctx.fillRect(x0, cy, wi, bh);
    cy += bh;
  }
}
export type DitherPattern = 'checker' | 'sparse';
const DITHER_CACHE = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();
const BAYER_4: readonly number[] = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];
function ditherPattern(
  ctx: CanvasRenderingContext2D,
  colorA: string,
  colorB: string,
  pattern: DitherPattern,
): CanvasPattern | null {
  let perCtx = DITHER_CACHE.get(ctx);
  if (!perCtx) {
    perCtx = new Map<string, CanvasPattern>();
    DITHER_CACHE.set(ctx, perCtx);
  }
  const key = `${colorA}|${colorB}|${pattern}`;
  const hit = perCtx.get(key);
  if (hit) {return hit;}
  const tile = document.createElement('canvas');
  tile.width = 4;
  tile.height = 4;
  const tctx = tile.getContext('2d');
  if (!tctx) {return null;}
  tctx.fillStyle = colorA;
  tctx.fillRect(0, 0, 4, 4);
  tctx.fillStyle = colorB;
  const cutoff = pattern === 'sparse' ? 4 : 8;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      if (BAYER_4[ty * 4 + tx] < cutoff) {tctx.fillRect(tx, ty, 1, 1);}
    }
  }
  const made = ctx.createPattern(tile, 'repeat');
  if (!made) {return null;}
  perCtx.set(key, made);
  return made;
}
export function fillDither(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorA: string,
  colorB: string,
  pattern: DitherPattern = 'checker',
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const wi = Math.round(w);
  const hi = Math.round(h);
  if (wi <= 0 || hi <= 0) {return;}
  const pat = ditherPattern(ctx, colorA, colorB, pattern);
  if (!pat) {
    ctx.fillStyle = colorA;
    ctx.fillRect(x0, y0, wi, hi);
    return;
  }
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(x0, y0, wi, hi);
  ctx.restore();
}
export function drawBevel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  light: string,
  dark: string,
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const wi = Math.round(w);
  const hi = Math.round(h);
  if (wi <= 0 || hi <= 0) {return;}
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, wi, hi);
  ctx.fillStyle = light;
  ctx.fillRect(x0, y0, wi, 1);
  ctx.fillRect(x0, y0, 1, hi);
  ctx.fillStyle = dark;
  ctx.fillRect(x0, y0 + hi - 1, wi, 1);
  ctx.fillRect(x0 + wi - 1, y0, 1, hi);
}
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  thickness = 1,
): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const wi = Math.round(w);
  const hi = Math.round(h);
  const t = Math.max(1, Math.round(thickness));
  if (wi <= 0 || hi <= 0) {return;}
  ctx.fillStyle = color;
  const tv = Math.min(t, hi);
  const th = Math.min(t, wi);
  ctx.fillRect(x0, y0, wi, tv);
  ctx.fillRect(x0, y0 + hi - tv, wi, tv);
  ctx.fillRect(x0, y0 + tv, th, Math.max(0, hi - 2 * tv));
  ctx.fillRect(x0 + wi - th, y0 + tv, th, Math.max(0, hi - 2 * tv));
}
export interface LogoOptions {
  color: string;
  shade?: string;
  shadow?: string;
  scale?: number;
  spacing?: number;
  shadowOffset?: number;
}
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerWidth: number,
  y: number,
  opts: LogoOptions,
): void {
  if (!opts?.color) {
    throw new Error(
      'drawLogo: opts.color is required and must come from the game palette, e.g. { color: PAL[10], shade: PAL[9] }',
    );
  }
  const scale = opts.scale ?? 3;
  const spacing = opts.spacing ?? 1;
  const color = opts.color;
  const shade = opts.shade ?? color;
  const shadow = opts.shadow ?? OUTLINE_COLOR;
  const off = opts.shadowOffset ?? 1;
  const w = textWidth(text, scale, spacing);
  const x = Math.round((centerWidth - w) / 2);
  const yi = Math.round(y);
  const base = { scale, spacing, shadow: false as const, outline: false as const };
  drawText(ctx, text, x + off, yi + off, { ...base, color: shadow });
  drawText(ctx, text, x, yi, { ...base, color: shade });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - off, yi, w + 2 * off, 3 * scale);
  ctx.clip();
  drawText(ctx, text, x, yi, { ...base, color });
  ctx.restore();
}