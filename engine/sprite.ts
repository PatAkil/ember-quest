import type { Point } from './geometry';

export type SpriteMap = Record<string, string>;

export interface Sprite {
  readonly w: number;
  readonly h: number;

  readonly pixels: readonly (string | null)[];
}
interface MakeSpriteOptions {
  outline?: string;

  flipX?: boolean;
}
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];
function blankPixels(count: number): (string | null)[] {
  return new Array<string | null>(count).fill(null);
}
function inkOf(ch: string | undefined, map: SpriteMap): string | null {
  if (ch === undefined || ch === '.' || ch === ' ') {return null;}
  const color = map[ch];
  return color === undefined || color === '' ? null : color;
}
export function makeSprite(rows: string[], map: SpriteMap, opts: MakeSpriteOptions = {}): Sprite {
  const h = rows.length;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const pixels: (string | null)[] = [];
  for (const row of rows) {
    for (let x = 0; x < w; x++) {pixels.push(inkOf(row[x], map));}
  }
  let sprite: Sprite = { w, h, pixels };
  if (opts.outline) {sprite = outlineSprite(sprite, opts.outline);}
  if (opts.flipX) {sprite = flipSprite(sprite);}
  return sprite;
}
function pixelAt(sprite: Sprite, x: number, y: number): string | null {
  if (x < 0 || y < 0 || x >= sprite.w || y >= sprite.h) {return null;}
  return sprite.pixels[y * sprite.w + x] ?? null;
}
function touchesInk(sprite: Sprite, x: number, y: number): boolean {
  return NEIGHBOURS.some(([dx, dy]) => Boolean(pixelAt(sprite, x + dx, y + dy)));
}
function outlineSprite(sprite: Sprite, color: string): Sprite {
  const w = sprite.w + 2;
  const h = sprite.h + 2;
  const pixels = blankPixels(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const own = pixelAt(sprite, x - 1, y - 1);
      pixels[y * w + x] = !own && touchesInk(sprite, x - 1, y - 1) ? color : own;
    }
  }
  return { w, h, pixels };
}
export function flipSprite(sprite: Sprite): Sprite {
  const { w, h } = sprite;
  const pixels = blankPixels(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {pixels[y * w + (w - 1 - x)] = sprite.pixels[y * w + x] ?? null;}
  }
  return { w, h, pixels };
}
export interface SpriteDrawOptions {
  px?: number;
  tint?: string;
  tintKeep?: string;
  dissolve?: number;
  fringe?: string;
  fall?: number;
  seed?: number;
}
const FRINGE_SPAN = 0.25;
const DISSOLVE_SPREAD = 1 - FRINGE_SPAN;
function cellHash(x: number, y: number, seed: number): number {
  let h = Math.imul(x + 1, 0x27d4eb2d) ^ Math.imul(y + 1, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function cellDeath(sprite: Sprite, cx: number, cy: number, seed: number): number {
  const order = 0.55 * cellHash(cx, cy, seed) + 0.45 * (cy / Math.max(1, sprite.h));
  return order * DISSOLVE_SPREAD;
}
function tinted(color: string, o: SpriteDrawOptions | undefined): string {
  if (o?.tint === undefined || color === o.tintKeep) {return color;}
  return o.tint;
}
function dissolveColor(color: string, inFringe: boolean, o: SpriteDrawOptions | undefined): string {
  if (inFringe && o?.fringe !== undefined) {return o.fringe;}
  return tinted(color, o);
}
function dissolveDrop(gone: number, o: SpriteDrawOptions | undefined): number {
  if (gone <= 0) {return 0;}
  const u = gone / FRINGE_SPAN;
  return Math.round((o?.fall ?? 0) * u * u);
}
const pxOf = (opts: number | SpriteDrawOptions): number => (typeof opts === 'number' ? opts : (opts.px ?? 1));
const isDissolving = (o: SpriteDrawOptions | undefined): o is SpriteDrawOptions => (o?.dissolve ?? 0) > 0;
const cellGone = (sprite: Sprite, cx: number, cy: number, o: SpriteDrawOptions): number =>
  (o.dissolve ?? 0) - cellDeath(sprite, cx, cy, o.seed ?? 0);
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, at: Point, opts: number | SpriteDrawOptions = 1): void {
  const o = typeof opts === 'number' ? undefined : opts;
  const px = pxOf(opts);
  const dissolving = isDissolving(o);
  for (let cy = 0; cy < sprite.h; cy++) {
    const row = cy * sprite.w;
    const py = at.y + cy * px;
    for (let cx = 0; cx < sprite.w; cx++) {
      const color = sprite.pixels[row + cx];
      if (!color) {continue;}
      const gone = dissolving ? cellGone(sprite, cx, cy, o) : 0;
      if (gone >= FRINGE_SPAN) {continue;}
      ctx.fillStyle = dissolveColor(color, gone > 0, o);
      ctx.fillRect(at.x + cx * px, py + dissolveDrop(gone, o) * px, px, px);
    }
  }
}
function sourceCell(sprite: Sprite, turn: { cos: number; sin: number; ox: number; oy: number }, x: number, y: number): string | null {
  const dx = x - turn.ox;
  const dy = y - turn.oy;
  const sx = Math.round(turn.cos * dx + turn.sin * dy + (sprite.w - 1) / 2);
  const sy = Math.round(-turn.sin * dx + turn.cos * dy + (sprite.h - 1) / 2);
  return pixelAt(sprite, sx, sy);
}
export function rotateSprite(sprite: Sprite, radians: number): Sprite {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const w = Math.ceil(Math.abs(sprite.w * cos) + Math.abs(sprite.h * sin));
  const h = Math.ceil(Math.abs(sprite.w * sin) + Math.abs(sprite.h * cos));
  const turn = { cos, sin, ox: (w - 1) / 2, oy: (h - 1) / 2 };
  const pixels = blankPixels(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {pixels[y * w + x] = sourceCell(sprite, turn, x, y);}
  }
  return { w, h, pixels };
}
