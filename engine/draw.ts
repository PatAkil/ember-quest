// draw.ts — pixel-scaled rendering, ASCII-art sprite maps, and bitmap text in
// two fonts: FONT_RETRO (the 3x5 arcade face with 5-wide M/W, uppercase only)
// and FONT_HD (a proportional 7x11 face with real lowercase and descenders for
// the 1280x720 frame). Fonts are DATA — a BitmapFont is a table of '#'/'.'
// rows — and FONT_RETRO is the default, so text drawn without naming a font
// looks exactly as it always has.
//
// Text is never a fillRect per font pixel at draw time: every (font, scale,
// colour) triple is rendered ONCE into a glyph atlas (an offscreen canvas, a
// bounded cache) and drawText blits one image per glyph from it, so a
// 600-character battle screen is 600 drawImage calls, not twenty thousand
// rects. Sprites get the same treatment for the HD actor plane: bakeSprite
// renders a Sprite into a bitmap once, drawBaked draws that bitmap with
// flip/scale/rotation and hard pixels, and tintSprite is the palette swap that
// makes an elemental variant free.
//
// createPixelCanvas() owns the <canvas>: it sizes the backing store to
// logical*scale, sets the context's smoothing (off by default — the retro
// frame; the HD frame turns it on and hard-pixels only its actor plane), and
// bakes a scale transform so ALL drawing happens in logical (pre-scale) pixel
// units. juice.ts layers extra transforms with save/restore on top of this
// base. pickBackingScale() is the contract's rule for that `scale` on the HD
// frame: ×1 everywhere, ×2 only on a dense desktop, never ×1.5.

export interface PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Logical (pre-scale) width in pixels — the coordinate space you draw in. */
  readonly width: number;
  /** Logical (pre-scale) height in pixels. */
  readonly height: number;
  readonly scale: number;
  /** Fill the whole logical area (call at the start of each frame). */
  clear(color?: string): void;
}

export interface CreatePixelCanvasOptions {
  width: number;
  height: number;
  scale?: number;
  /**
   * Element to append the canvas to. Omit for document.body. An EXPLICIT null
   * (e.g. a failed getElementById) throws — a missing mount point must fail
   * loudly so the smoke gate catches it, never silently mount elsewhere.
   */
  parent?: HTMLElement | null;
  /**
   * Initial `imageSmoothingEnabled` of the context (default false — every
   * drawImage lands on hard pixels, the retro frame). An HD screen passes
   * true: light, particles, blurred planes and UI scale smooth, and the actor
   * plane toggles smoothing OFF around its own drawImage calls only (drawBaked
   * and drawText already do). Part of the context state save()/restore() keep,
   * so a layer that flips it inside a save block leaves it as it found it.
   */
  smoothing?: boolean;
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
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = opts.smoothing ?? false;
  // Bake the scale so every draw call works in logical pixels.
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

/**
 * The backing-store scale for the HD frame, from the CSS width the shell fits
 * the canvas to and the device pixel ratio: 2 only when the display is dense
 * (dpr >= 1.5) AND the frame is shown at its full 1280 CSS px or wider, else 1.
 * A phone (dense but narrow) and a plain desktop both get ×1; a Retina desktop
 * showing the full frame gets ×2. Never ×1.5 — that would put one art pixel on
 * 4.5 device pixels. Pure: the only DOM touch is the default parameter.
 */
export function pickBackingScale(cssWidth: number, dpr = window.devicePixelRatio): 1 | 2 {
  return dpr >= 1.5 && cssWidth >= 1280 ? 2 : 1;
}

// --- Sprites ----------------------------------------------------------------

export type SpriteMap = Record<string, string>;

export interface Sprite {
  readonly w: number;
  readonly h: number;
  /** Row-major cells; null = transparent. */
  readonly pixels: ReadonlyArray<string | null>;
}

export interface MakeSpriteOptions {
  /**
   * Bake a 1-cell keyline of this color around every opaque cell (8-neighbour).
   * The sprite GROWS by one cell on each side (w+2, h+2), so a hitbox derived
   * from the sprite must use the INNER size (w-2, h-2) — or skip this option and
   * author the outline directly into the rows, which keeps w/h as written.
   *   makeSprite(SHIP, { '#': PAL[12] }, { outline: PAL[1] })  // 5x4 -> 7x6
   */
  outline?: string;
  /** Bake a horizontally mirrored copy (same as flipSprite, one step earlier). */
  flipX?: boolean;
}

/**
 * Build a sprite from ASCII-art rows. Any char not in `map` (and '.' / ' ')
 * is transparent.
 *   makeSprite(['.#.', '###', '#.#'], { '#': '#fff' })
 */
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
  if (opts.outline) sprite = outlineSprite(sprite, opts.outline);
  if (opts.flipX) sprite = flipSprite(sprite);
  return sprite;
}

/**
 * WHY: a 1-px dark keyline is what separates a pixel actor from a busy ground —
 * baked once at setup, it costs nothing per frame. Grows the sprite by one cell
 * on every side.
 */
function outlineSprite(sprite: Sprite, color: string): Sprite {
  const w = sprite.w + 2;
  const h = sprite.h + 2;
  const pixels: (string | null)[] = new Array(w * h).fill(null);
  // Inner copy first, then fill any transparent cell touching an opaque one.
  for (let y = 0; y < sprite.h; y++) {
    for (let x = 0; x < sprite.w; x++) {
      pixels[(y + 1) * w + (x + 1)] = sprite.pixels[y * sprite.w + x];
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[y * w + x]) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx - 1;
          const ny = y + dy - 1;
          if (nx < 0 || ny < 0 || nx >= sprite.w || ny >= sprite.h) continue;
          if (sprite.pixels[ny * sprite.w + nx]) { touches = true; break; }
        }
      }
      if (touches) pixels[y * w + x] = color;
    }
  }
  return { w, h, pixels };
}

/**
 * WHY: facing left is a different sprite, not a per-frame transform — mirror
 * once at setup and pick the right Sprite when drawing. NEVER call per frame.
 *   const shipLeft = flipSprite(shipRight);
 */
export function flipSprite(sprite: Sprite): Sprite {
  const { w, h } = sprite;
  const pixels: (string | null)[] = new Array(w * h).fill(null);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) pixels[y * w + (w - 1 - x)] = sprite.pixels[y * w + x];
  }
  return { w, h, pixels };
}

/**
 * WHY: animation is just choosing which Sprite to draw — this turns the game
 * clock into that choice in one line, like blink/pulse. Returns 0..count-1.
 *   drawSprite(ctx, walkFrames[frameIndex(time, 8, walkFrames.length)], x, y);
 */
export function frameIndex(time: number, fps: number, count: number): number {
  if (count <= 1 || fps <= 0) return 0;
  // A NaN/Infinity clock (an uninitialised timer, a division by zero upstream)
  // would make Math.floor return NaN and index the frame array with undefined.
  if (!Number.isFinite(time)) return 0;
  const i = Math.floor(time * fps) % count;
  return i < 0 ? i + count : i;
}

/** Draw a sprite at logical (x,y). `px` = size of each sprite cell (default 1). */
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
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + cx * px, y + cy * px, px, px);
    }
  }
}

// --- Baked sprites (the HD actor plane) --------------------------------------
//
// drawSprite is a fillRect per cell, which is fine for a 22x27 knight at px 1
// and is not fine for a roster of layered 64-px actors drawn x3 with a rim
// light. bakeSprite renders a Sprite into a bitmap ONCE at setup; drawBaked
// then draws that bitmap with flip, scale and rotation as a single drawImage
// with smoothing off — the one plane of the frame that keeps hard pixels.

/**
 * Render a Sprite into an offscreen canvas at `px` logical px per cell (a
 * fillRect per cell, at bake time only). Call at setup, keep the result, draw
 * it with drawBaked. Throws without a 2D context, like createPixelCanvas — a
 * silent blank actor would be worse than a loud failure at boot.
 *   const knight = bakeSprite(makeSprite(KNIGHT_ROWS, PAL_MAP));
 */
export function bakeSprite(sprite: Sprite, px = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  // A 0-sized canvas is an invalid drawImage source; an empty sprite bakes to
  // one transparent pixel instead.
  canvas.width = Math.max(1, Math.round(sprite.w * px));
  canvas.height = Math.max(1, Math.round(sprite.h * px));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('bakeSprite: 2D canvas context unavailable');
  drawSprite(ctx, sprite, 0, 0, px);
  return canvas;
}

export interface DrawBakedOptions {
  /** Mirror horizontally about the origin (facing left, without a second bake). */
  flipX?: boolean;
  /** Logical px per bitmap px (default 1; the HD actor plane draws its 64-px parts at 3). */
  scale?: number;
  /** Multiplies the context's globalAlpha for this draw (default 1). */
  alpha?: number;
  /** Radians, clockwise, about the origin (default 0). */
  rotation?: number;
  /**
   * The point of the BITMAP (in bitmap px, unscaled) that lands on (x, y) and
   * that flip, scale and rotation pivot around. Default: the bitmap's centre.
   * An actor standing on a floor line wants its feet: `originX: bmp.width / 2,
   * originY: bmp.height` — then (x, y) is the floor contact whatever the
   * scale, a hit-pop scale grows upward from the feet, and a flip keeps them
   * planted. For drawSprite-style top-left placement pass 0, 0.
   */
  originX?: number;
  originY?: number;
}

/**
 * Draw a baked bitmap with hard pixels: the bitmap's origin point lands on
 * logical (x, y) and flip/scale/rotation apply about it (see
 * DrawBakedOptions). imageSmoothingEnabled is forced off for the draw and put
 * back afterwards; the transformed path is one save/restore; nothing is
 * allocated — pass a persistent options object from a hot loop.
 *
 * Untransformed and flipped draws snap the bitmap's box to whole logical px:
 * a x3 texel that straddles a half pixel comes out 2 px wide next to one 4 px
 * wide under nearest-neighbour sampling, and the actor plane's whole point is
 * uniform hard texels. A rotated bitmap has no grid to snap to and is drawn
 * exactly where asked.
 *   drawBaked(ctx, knight, feetX, FLOOR_Y, { scale: 3, flipX: facingLeft, originX: 32, originY: 64 });
 */
export function drawBaked(
  ctx: CanvasRenderingContext2D,
  bitmap: HTMLCanvasElement | HTMLImageElement,
  x: number,
  y: number,
  opts?: DrawBakedOptions,
): void {
  const scale = opts?.scale ?? 1;
  const alpha = opts?.alpha ?? 1;
  if (!(scale > 0) || !(alpha > 0)) return;
  const rotation = opts?.rotation ?? 0;
  const flipX = opts?.flipX === true;
  const w = bitmap.width;
  const h = bitmap.height;
  const ox = opts?.originX ?? w / 2;
  const oy = opts?.originY ?? h / 2;

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (rotation === 0 && !flipX && alpha === 1) {
    // Fast path: no state to push, one call.
    ctx.drawImage(bitmap, Math.round(x - ox * scale), Math.round(y - oy * scale), w * scale, h * scale);
  } else {
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    if (rotation !== 0) {
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(flipX ? -scale : scale, scale);
      ctx.drawImage(bitmap, -ox, -oy);
    } else {
      // Flip or alpha only: place the snapped box, then mirror inside it so
      // the pixel grid is unchanged by the flip.
      const left = Math.round(x - (flipX ? w - ox : ox) * scale);
      const top = Math.round(y - oy * scale);
      ctx.translate(flipX ? left + w * scale : left, top);
      ctx.scale(flipX ? -scale : scale, scale);
      ctx.drawImage(bitmap, 0, 0);
    }
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = prevSmoothing;
}

/**
 * WHY: an element tint is a palette swap, not a shader — five elemental
 * variants of one actor are five calls at setup. Every cell whose colour is a
 * key of `map` takes the mapped colour; every other cell (other colours, the
 * keyline, transparency) is untouched. Returns a NEW sprite; never per frame.
 *   const frostSlime = tintSprite(slime, { [PAL[11]]: PAL[12], [PAL[3]]: PAL[1] });
 */
export function tintSprite(sprite: Sprite, map: Readonly<Record<string, string>>): Sprite {
  const n = sprite.pixels.length;
  const pixels: (string | null)[] = new Array<string | null>(n);
  for (let i = 0; i < n; i++) {
    const c = sprite.pixels[i];
    // hasOwnProperty: a colour string like 'constructor' must not hit Object.prototype.
    pixels[i] = c !== null && Object.prototype.hasOwnProperty.call(map, c) ? map[c] : c;
  }
  return { w: sprite.w, h: sprite.h, pixels };
}

// --- Bitmap fonts -----------------------------------------------------------
//
// A font is DATA: a table of glyphs, each `glyphH` rows of '#' (ink) / '.'
// (off). All rows of one glyph share a length, and that length is the glyph's
// advance width in font px — so every font is proportional by construction and
// the text routines advance PER GLYPH (width + spacing) rather than by a fixed
// cell. Two fonts ship here:
//   FONT_RETRO — the original 3x5 arcade face. Uppercase only (lowercase input
//                draws the capital), 5-wide M/W: in a 3-wide cell the diagonals
//                collapse and readers see 'YOU YIN', 'ARROVS', 'GAHE OVER'.
//   FONT_HD    — a 7x11 face for the 1280x720 frame: real lowercase with
//                ascenders and descenders, a slashed zero, distinct 1/l/I.
// FONT_RETRO is the default everywhere, so a call site written against the 3x5
// font renders exactly as it did before fonts became a parameter.

/**
 * A bitmap font as data. Glyph keys are single UTF-16 code units ('A', '→');
 * a character with no glyph renders blank and advances `fallbackW`. Rows of a
 * glyph must all be the same length — that length is its advance width.
 */
export interface BitmapFont {
  /** Unique per font: it keys the glyph-atlas cache, so two fonts must never share one. */
  readonly name: string;
  /** Rows per glyph (the cell height in font px). */
  readonly glyphH: number;
  readonly glyphs: Readonly<Record<string, string[]>>;
  /** Advance in font px for a character the table lacks (drawn blank). */
  readonly fallbackW: number;
  /**
   * Uppercase and lowercase input share whatever glyphs the table has — with
   * an uppercase-only table, 'a' draws the 'A' glyph, exactly as if the text
   * had been uppercased first. A font with real lowercase sets this false.
   */
  readonly caseFold: boolean;
  /**
   * Font px from the top of the cell to the baseline: glyphs without
   * descenders end here, descenders hang below it. A caller aligning text on a
   * baseline draws at `y - baseline * scale`. Omitted = the whole cell.
   */
  readonly baseline?: number;
  /**
   * Smallest font scale at which the 8-way outline keeps the glyph counters
   * open — below it drawText demotes a requested outline to the drop shadow
   * (see TextOptions.outline). 3 for FONT_RETRO, whose counters are one font
   * px; 1 for FONT_HD, whose bowls are four px across.
   */
  readonly outlineMinScale: number;
}

// Each glyph is 5 rows of '#' = on / '.' = off. Rows within a glyph must all be
// the same length; that length is the glyph's width. Missing chars render blank
// (advancing fallbackW = 3).
export const FONT_RETRO: BitmapFont = {
  name: 'retro',
  glyphH: 5,
  fallbackW: 3,
  caseFold: true,
  baseline: 5,
  outlineMinScale: 3,
  glyphs: {
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
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], // 5 wide: a 3-wide M is indistinguishable from H/N
    N: ['###', '#.#', '#.#', '#.#', '#.#'], // flat-top N: distinct from M (filled middle rows), H (bar) and the old zigzag that read as K/X
    O: ['###', '#.#', '#.#', '#.#', '###'],
    P: ['###', '#.#', '###', '#..', '#..'],
    Q: ['###', '#.#', '#.#', '###', '..#'],
    R: ['###', '#.#', '###', '##.', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'], // curved S: no longer byte-identical to the digit 5
    T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'],
    V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], // 5 wide: the inverted M; a 3-wide W read as H or V
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
  },
};

/** Cell height of FONT_HD in font px. */
const HD_H = 11;

/**
 * Authoring helper for FONT_HD. `rows` start at cell row `top` and the cell is
 * padded to HD_H rows with blank rows of the same width, so a capital is
 * written as its 8 rows (top 1), an x-height letter as its 6 (top 3), a
 * descender as 8 from top 3. Validated once at module init: a ragged or
 * overflowing glyph throws, so a typo fails the smoke gate instead of drawing
 * one letter a pixel narrow for the life of the game.
 */
function hd(top: number, ...rows: string[]): string[] {
  const w = rows[0].length;
  if (top < 0 || top + rows.length > HD_H) {
    throw new Error(`FONT_HD: glyph "${rows.join('/')}" overflows the ${HD_H}-row cell`);
  }
  const blank = '.'.repeat(w);
  const out: string[] = [];
  for (let i = 0; i < HD_H; i++) {
    const r = i - top;
    const row = r >= 0 && r < rows.length ? rows[r] : blank;
    if (row.length !== w || /[^#.]/.test(row)) {
      throw new Error(`FONT_HD: ragged glyph row "${row}" in "${rows.join('/')}"`);
    }
    out.push(row);
  }
  return out;
}

// FONT_HD cell (11 rows, 6 font px wide for most glyphs — 7 for M/W/m/w, less
// for i/l/punctuation): row 0 is reserved for accents (unused so far), rows 1-8
// are cap height, rows 3-8 the x-height, rows 9-10 the descenders. Strokes are
// one px; bowls are four px across, so the letter stays open at 1x on a 720p
// frame. Designed for the confusable pairs first: slashed 0 vs O, flat-topped
// 5 vs curved S, flat-sided B vs round 8, serifed I vs hooked l vs flagged 1,
// a two-storey a, an m whose three stems never read as "rn".
export const FONT_HD: BitmapFont = {
  name: 'hd',
  glyphH: HD_H,
  fallbackW: 6,
  caseFold: false,
  baseline: 9,
  outlineMinScale: 1,
  glyphs: {
    A: hd(1, '.####.', '#....#', '#....#', '#....#', '######', '#....#', '#....#', '#....#'),
    B: hd(1, '#####.', '#....#', '#....#', '#####.', '#....#', '#....#', '#....#', '#####.'),
    C: hd(1, '.####.', '#....#', '#.....', '#.....', '#.....', '#.....', '#....#', '.####.'),
    D: hd(1, '####..', '#...#.', '#....#', '#....#', '#....#', '#....#', '#...#.', '####..'),
    E: hd(1, '######', '#.....', '#.....', '#####.', '#.....', '#.....', '#.....', '######'),
    F: hd(1, '######', '#.....', '#.....', '#####.', '#.....', '#.....', '#.....', '#.....'),
    G: hd(1, '.####.', '#....#', '#.....', '#.....', '#..###', '#....#', '#....#', '.####.'),
    H: hd(1, '#....#', '#....#', '#....#', '######', '#....#', '#....#', '#....#', '#....#'),
    I: hd(1, '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'),
    J: hd(1, '.#####', '....#.', '....#.', '....#.', '....#.', '....#.', '#...#.', '.###..'),
    K: hd(1, '#....#', '#...#.', '#..#..', '###...', '#..#..', '#...#.', '#....#', '#....#'),
    L: hd(1, '#.....', '#.....', '#.....', '#.....', '#.....', '#.....', '#.....', '######'),
    M: hd(1, '#.....#', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#.....#', '#.....#', '#.....#'),
    N: hd(1, '#....#', '##...#', '#.#..#', '#.#..#', '#..#.#', '#..#.#', '#...##', '#....#'),
    O: hd(1, '.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'),
    P: hd(1, '#####.', '#....#', '#....#', '#....#', '#####.', '#.....', '#.....', '#.....'),
    Q: hd(1, '.####.', '#....#', '#....#', '#....#', '#....#', '#..#.#', '#...#.', '.###.#'),
    R: hd(1, '#####.', '#....#', '#....#', '#####.', '#.#...', '#..#..', '#...#.', '#....#'),
    S: hd(1, '.####.', '#....#', '#.....', '.##...', '...##.', '.....#', '#....#', '.####.'),
    T: hd(1, '#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'),
    U: hd(1, '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'),
    V: hd(1, '#....#', '#....#', '#....#', '#....#', '#....#', '.#..#.', '.#..#.', '..##..'),
    W: hd(1, '#.....#', '#.....#', '#.....#', '#.....#', '#..#..#', '#.#.#.#', '##...##', '#.....#'),
    X: hd(1, '#....#', '#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#', '#....#'),
    Y: hd(1, '#...#', '#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'),
    Z: hd(1, '######', '.....#', '....#.', '...#..', '..#...', '.#....', '#.....', '######'),
    a: hd(3, '.####.', '.....#', '.#####', '#....#', '#....#', '.#####'),
    b: hd(1, '#.....', '#.....', '#.###.', '##...#', '#....#', '#....#', '##...#', '#.###.'),
    c: hd(3, '.####.', '#....#', '#.....', '#.....', '#....#', '.####.'),
    d: hd(1, '.....#', '.....#', '.###.#', '#...##', '#....#', '#....#', '#...##', '.###.#'),
    e: hd(3, '.####.', '#....#', '######', '#.....', '#....#', '.####.'),
    f: hd(1, '..###', '.#...', '####.', '.#...', '.#...', '.#...', '.#...', '.#...'),
    g: hd(3, '.#####', '#....#', '#....#', '#....#', '#....#', '.#####', '.....#', '.####.'),
    h: hd(1, '#.....', '#.....', '#.###.', '##...#', '#....#', '#....#', '#....#', '#....#'),
    i: hd(1, '.#.', '...', '##.', '.#.', '.#.', '.#.', '.#.', '###'),
    j: hd(1, '...#', '....', '..##', '...#', '...#', '...#', '...#', '...#', '#..#', '.##.'),
    k: hd(1, '#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'),
    l: hd(1, '##.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.##'),
    m: hd(3, '.##.##.', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '#..#..#'),
    n: hd(3, '#.###.', '##...#', '#....#', '#....#', '#....#', '#....#'),
    o: hd(3, '.####.', '#....#', '#....#', '#....#', '#....#', '.####.'),
    p: hd(3, '#.###.', '##...#', '#....#', '#....#', '##...#', '#.###.', '#.....', '#.....'),
    q: hd(3, '.###.#', '#...##', '#....#', '#....#', '#...##', '.###.#', '.....#', '.....#'),
    r: hd(3, '#.##.', '##..#', '#....', '#....', '#....', '#....'),
    s: hd(3, '.####.', '#....#', '.##...', '...##.', '#....#', '.####.'),
    t: hd(2, '.#...', '####.', '.#...', '.#...', '.#...', '.#..#', '..##.'),
    u: hd(3, '#....#', '#....#', '#....#', '#....#', '#...##', '.###.#'),
    v: hd(3, '#....#', '#....#', '#....#', '.#..#.', '.#..#.', '..##..'),
    w: hd(3, '#.....#', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '.##.##.'),
    x: hd(3, '#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#'),
    y: hd(3, '#....#', '#....#', '#....#', '#....#', '#...##', '.###.#', '.....#', '.####.'),
    z: hd(3, '######', '....#.', '...#..', '..#...', '.#....', '######'),
    '0': hd(1, '.####.', '#....#', '#...##', '#..#.#', '#.#..#', '##...#', '#....#', '.####.'),
    '1': hd(1, '..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '..#..', '#####'),
    '2': hd(1, '.####.', '#....#', '.....#', '....#.', '...#..', '..#...', '.#....', '######'),
    '3': hd(1, '.####.', '#....#', '.....#', '..###.', '.....#', '.....#', '#....#', '.####.'),
    '4': hd(1, '....#.', '...##.', '..#.#.', '.#..#.', '#...#.', '######', '....#.', '....#.'),
    '5': hd(1, '######', '#.....', '#.....', '#####.', '.....#', '.....#', '#....#', '.####.'),
    '6': hd(1, '..###.', '.#....', '#.....', '#####.', '#....#', '#....#', '#....#', '.####.'),
    '7': hd(1, '######', '.....#', '....#.', '...#..', '..#...', '..#...', '..#...', '..#...'),
    '8': hd(1, '.####.', '#....#', '#....#', '.####.', '#....#', '#....#', '#....#', '.####.'),
    '9': hd(1, '.####.', '#....#', '#....#', '#....#', '.#####', '.....#', '....#.', '.###..'),
    ' ': hd(0, '......'),
    '.': hd(7, '##', '##'),
    ',': hd(7, '##', '##', '.#', '#.'),
    ':': hd(3, '##', '##', '..', '..', '##', '##'),
    ';': hd(3, '##', '##', '..', '..', '##', '##', '.#', '#.'),
    '!': hd(1, '#', '#', '#', '#', '#', '.', '#', '#'),
    '?': hd(1, '.####.', '#....#', '.....#', '....#.', '...#..', '......', '...#..', '...#..'),
    "'": hd(1, '.#', '.#', '#.'),
    '"': hd(1, '#.#', '#.#'),
    '-': hd(5, '####'),
    '+': hd(3, '..#..', '..#..', '#####', '..#..', '..#..'),
    '=': hd(4, '#####', '.....', '#####'),
    '/': hd(1, '...#', '...#', '..#.', '..#.', '.#..', '.#..', '#...', '#...'),
    '\\': hd(1, '#...', '#...', '.#..', '.#..', '..#.', '..#.', '...#', '...#'),
    '(': hd(1, '..#', '.#.', '#..', '#..', '#..', '#..', '.#.', '..#'),
    ')': hd(1, '#..', '.#.', '..#', '..#', '..#', '..#', '.#.', '#..'),
    '[': hd(1, '###', '#..', '#..', '#..', '#..', '#..', '#..', '###'),
    ']': hd(1, '###', '..#', '..#', '..#', '..#', '..#', '..#', '###'),
    '<': hd(2, '...#', '..#.', '.#..', '#...', '.#..', '..#.', '...#'),
    '>': hd(2, '#...', '.#..', '..#.', '...#', '..#.', '.#..', '#...'),
    '%': hd(1, '##...#', '##..#.', '....#.', '...#..', '..#...', '.#....', '.#..##', '#...##'),
    '*': hd(3, '..#..', '#.#.#', '.###.', '#.#.#', '..#..'),
    '#': hd(1, '.#..#.', '.#..#.', '######', '.#..#.', '.#..#.', '######', '.#..#.', '.#..#.'),
    '&': hd(1, '.##...', '#..#..', '#..#..', '.##...', '#.#..#', '#..##.', '#...#.', '.###.#'),
    _: hd(9, '######'),
    '@': hd(1, '.####.', '#....#', '#..###', '#.#..#', '#.#..#', '#..###', '#.....', '.####.'),
    '^': hd(1, '..#..', '.#.#.', '#...#'),
    '~': hd(4, '.##..#', '#..##.'),
    '|': hd(1, '#', '#', '#', '#', '#', '#', '#', '#', '#', '#'),
    '→': hd(3, '...#...', '....#..', '#######', '....#..', '...#...'),
    '←': hd(3, '...#...', '..#....', '#######', '..#....', '...#...'),
    '↑': hd(1, '..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..', '..#..', '..#..'),
    '↓': hd(1, '..#..', '..#..', '..#..', '..#..', '..#..', '#.#.#', '.###.', '..#..'),
    '▸': hd(2, '#...', '##..', '###.', '####', '###.', '##..', '#...'),
    '•': hd(4, '.##.', '####', '####', '.##.'),
    '×': hd(3, '#...#', '.#.#.', '..#..', '.#.#.', '#...#'),
    '·': hd(5, '##', '##'),
  },
};

// --- Bitmap text ------------------------------------------------------------

export interface TextOptions {
  color?: string;
  /** Size of each font pixel in logical px (default 1). */
  scale?: number;
  /** Gap between glyphs in font pixels (default 1). */
  spacing?: number;
  /** Face to draw with (default FONT_RETRO — the 3x5 arcade font). */
  font?: BitmapFont;
  /**
   * 1-logical-px drop shadow under the glyphs, so text stays legible on any
   * ground. `true` uses SHADOW_COLOR, a string uses that color, `false` opts
   * out. Low-level drawText defaults to OFF (callers opt in); drawTextCentered
   * turns it ON for scale >= 2, and the ui.ts HUD helpers turn it on always.
   */
  shadow?: boolean | string;
  /**
   * 1-logical-px dark keyline all the way around the glyphs — a stronger
   * separation than `shadow` for headline words that sit on a live scene.
   * `true` uses SHADOW_COLOR, a string uses that color. drawTextCentered turns
   * it ON for scale >= 2; pass `false` to opt out. When set, it replaces the
   * offset shadow (the two together read as a smear).
   *
   * Only honoured at font scale >= font.outlineMinScale (3 for FONT_RETRO, 1
   * for FONT_HD). Below that the keyline would close the glyph counters, so it
   * quietly degrades to the 1-px drop shadow — asking for an outline is always
   * safe, it just may render as a shadow.
   */
  outline?: boolean | string;
}

/**
 * Backing-pass offsets, hoisted to module constants: drawText runs on every
 * frame, and these arrays never vary, so allocating them per call was pure
 * garbage.
 */
const OUTLINE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
];
const SHADOW_OFFSETS: ReadonlyArray<readonly [number, number]> = [[1, 1]];
const NO_OFFSETS: ReadonlyArray<readonly [number, number]> = [];

/** Default drop-shadow / outline color for bitmap text. */
export const SHADOW_COLOR = 'rgba(0,0,0,0.7)';

/** Default keyline color for outlined text (opaque — see drawText). */
export const OUTLINE_COLOR = '#000000';

// --- Glyph lookup and atlas cache -------------------------------------------
//
// WHY an atlas: at 1280x720 a battle screen draws ~600 characters a frame and
// a 90-character log line is ~4000 font pixels. A fillRect per pixel is a
// fillRect per pixel every frame; instead every (font, scale, colour) triple
// is rendered ONCE into an offscreen canvas and each glyph is then a single
// drawImage. The atlas is built by exactly the fillRect loop the direct path
// used (same cell size, same offsets), and blitted 1:1 with smoothing off, so
// the pixels on screen are identical — there is just one draw call per glyph
// instead of one per pixel.
//
// The per-font lookup below is built once (WeakMap by font identity) and maps
// a UTF-16 code unit to a glyph index, so the hot loop is charCodeAt + Map.get
// + drawImage: no string slicing, no uppercasing, no iterator, no allocation.

/** One font's glyphs, indexed; `byCode` maps a char code to an index here. */
interface FontLookup {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  /** Advance width in font px, per glyph index. */
  readonly widths: ReadonlyArray<number>;
  /** False for an all-blank glyph (space) — nothing to blit. */
  readonly ink: ReadonlyArray<boolean>;
  readonly byCode: ReadonlyMap<number, number>;
}

/** Where one glyph sits in an atlas, in atlas (= logical) px. */
interface GlyphSlot {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

interface GlyphAtlas {
  readonly canvas: HTMLCanvasElement;
  /** Parallel to FontLookup.rows. */
  readonly slots: ReadonlyArray<GlyphSlot>;
  /** Row height in atlas px (glyphH * scale). */
  readonly h: number;
}

const FONT_LOOKUPS = new WeakMap<BitmapFont, FontLookup>();

function fontLookup(font: BitmapFont): FontLookup {
  const hit = FONT_LOOKUPS.get(font);
  if (hit) return hit;
  const rows: string[][] = [];
  const widths: number[] = [];
  const ink: boolean[] = [];
  const byCode = new Map<number, number>();
  for (const key in font.glyphs) {
    // Keys are single code units; an astral-plane key (an emoji) cannot be
    // matched by charCodeAt and is skipped rather than half-matched.
    if (key.length !== 1) continue;
    const glyph = font.glyphs[key];
    byCode.set(key.charCodeAt(0), rows.length);
    rows.push(glyph);
    widths.push(glyph.length > 0 ? glyph[0].length : font.fallbackW);
    ink.push(glyph.some((r) => r.includes('#')));
  }
  if (font.caseFold) {
    // The other case of every key aliases the same glyph unless the table has
    // it explicitly — with an uppercase-only table this is "uppercase the
    // input", minus the per-call string it used to allocate.
    for (const key in font.glyphs) {
      const idx = byCode.get(key.charCodeAt(0));
      if (idx === undefined) continue;
      const upper = key.toUpperCase();
      const lower = key.toLowerCase();
      if (upper.length === 1 && !byCode.has(upper.charCodeAt(0))) byCode.set(upper.charCodeAt(0), idx);
      if (lower.length === 1 && !byCode.has(lower.charCodeAt(0))) byCode.set(lower.charCodeAt(0), idx);
    }
  }
  const made: FontLookup = { rows, widths, ink, byCode };
  FONT_LOOKUPS.set(font, made);
  return made;
}

/**
 * Atlas cache, keyed `${font.name}|${scale}|${color}`. Bounded: past ATLAS_MAX
 * entries the OLDEST (first inserted) is evicted — a game cycles through a
 * couple of dozen colour/scale pairs, so 64 never thrashes, and a one-off
 * colour (a damage number in an enemy's hue) ages out on its own. A `null`
 * entry remembers that no 2D context was available so the fallback path is
 * taken without retrying the canvas every frame.
 */
const ATLAS_CACHE = new Map<string, GlyphAtlas | null>();
const ATLAS_MAX = 64;
/** Glyph rows wrap at this width so a large scale never asks for a mile-wide canvas. */
const ATLAS_MAX_W = 1024;

/** Draw one glyph's font pixels as `scale`-sized rects at (x, y). Bake time, or the no-context fallback. */
function stampGlyph(
  ctx: CanvasRenderingContext2D,
  rows: ReadonlyArray<string>,
  width: number,
  glyphH: number,
  x: number,
  y: number,
  scale: number,
): void {
  const h = rows.length < glyphH ? rows.length : glyphH;
  for (let gy = 0; gy < h; gy++) {
    const row = rows[gy];
    for (let gx = 0; gx < width; gx++) {
      if (row[gx] === '#') ctx.fillRect(x + gx * scale, y + gy * scale, scale, scale);
    }
  }
}

function buildAtlas(font: BitmapFont, lookup: FontLookup, scale: number, color: string): GlyphAtlas | null {
  const h = Math.ceil(font.glyphH * scale);
  const n = lookup.widths.length;
  const slots: GlyphSlot[] = new Array<GlyphSlot>(n);
  let cx = 0;
  let cy = 0;
  let maxW = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.ceil(lookup.widths[i] * scale);
    if (cx > 0 && cx + w > ATLAS_MAX_W) {
      cy += h;
      cx = 0;
    }
    slots[i] = { x: cx, y: cy, w };
    cx += w;
    if (cx > maxW) maxW = cx;
  }
  const canvas = document.createElement('canvas');
  // A 0-sized canvas is a valid element but an invalid drawImage source.
  canvas.width = Math.max(1, maxW);
  canvas.height = Math.max(1, cy + h);
  const actx = canvas.getContext('2d');
  if (!actx) return null;
  actx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    if (!lookup.ink[i]) continue;
    stampGlyph(actx, lookup.rows[i], lookup.widths[i], font.glyphH, slots[i].x, slots[i].y, scale);
  }
  return { canvas, slots, h };
}

function glyphAtlas(font: BitmapFont, lookup: FontLookup, scale: number, color: string): GlyphAtlas | null {
  const key = `${font.name}|${scale}|${color}`;
  const hit = ATLAS_CACHE.get(key);
  if (hit !== undefined) return hit;
  const made = buildAtlas(font, lookup, scale, color);
  if (ATLAS_CACHE.size >= ATLAS_MAX) {
    const oldest = ATLAS_CACHE.keys().next().value;
    if (oldest !== undefined) ATLAS_CACHE.delete(oldest);
  }
  ATLAS_CACHE.set(key, made);
  return made;
}

/**
 * One pass of a text run from the atlas: a drawImage per inked glyph. The
 * advance uses the font-px width times scale (not the ceil'd slot width) so it
 * agrees with textWidth to the pixel.
 */
function blitRun(
  ctx: CanvasRenderingContext2D,
  atlas: GlyphAtlas,
  lookup: FontLookup,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  scale: number,
  spacing: number,
): void {
  const gap = spacing * scale;
  let cursor = x;
  for (let i = 0; i < text.length; i++) {
    const idx = lookup.byCode.get(text.charCodeAt(i));
    if (idx === undefined) {
      cursor += font.fallbackW * scale + gap;
      continue;
    }
    if (lookup.ink[idx]) {
      const slot = atlas.slots[idx];
      ctx.drawImage(atlas.canvas, slot.x, slot.y, slot.w, atlas.h, cursor, y, slot.w, atlas.h);
    }
    cursor += lookup.widths[idx] * scale + gap;
  }
}

/** The pre-atlas path, kept for a context that cannot make an offscreen canvas: a fillRect per font pixel. */
function fillRun(
  ctx: CanvasRenderingContext2D,
  lookup: FontLookup,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  scale: number,
  spacing: number,
  color: string,
): void {
  ctx.fillStyle = color;
  const gap = spacing * scale;
  let cursor = x;
  for (let i = 0; i < text.length; i++) {
    const idx = lookup.byCode.get(text.charCodeAt(i));
    if (idx === undefined) {
      cursor += font.fallbackW * scale + gap;
      continue;
    }
    stampGlyph(ctx, lookup.rows[idx], lookup.widths[idx], font.glyphH, cursor, y, scale);
    cursor += lookup.widths[idx] * scale + gap;
  }
}

/** Width in logical px that drawText would occupy for `text`. */
export function textWidth(text: string, scale = 1, spacing = 1, font: BitmapFont = FONT_RETRO): number {
  if (text.length === 0) return 0;
  const lookup = fontLookup(font);
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    const idx = lookup.byCode.get(text.charCodeAt(i));
    w += ((idx === undefined ? font.fallbackW : lookup.widths[idx]) + spacing) * scale;
  }
  return w - spacing * scale;
}

/**
 * Draw bitmap text at logical (x,y) = top-left of the glyph cell. The default
 * font (FONT_RETRO) folds case, so lowercase input draws the capitals.
 *
 * The position snaps to whole logical px: a hard-pixel glyph placed at a
 * half pixel is a smeared edge under fillRect and an uneven nearest-neighbour
 * phase under drawImage — neither is text. Allocation-free once the atlas for
 * this (font, scale, colour) is warm.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): void {
  const font = opts.font ?? FONT_RETRO;
  const color = opts.color ?? '#FFF1E8';
  const scale = opts.scale ?? 1;
  const spacing = opts.spacing ?? 1;
  if (text.length === 0 || !(scale > 0)) return;
  const lookup = fontLookup(font);
  const x0 = Math.round(x);
  const y0 = Math.round(y);

  // Backing pass: an outline (keyline all round) if asked for, otherwise a
  // shadow one LOGICAL pixel down-right whatever the scale — so it lifts the
  // word off the ground without thickening the glyphs at scale 1.
  //
  // The full keyline is only applied from font.outlineMinScale up: below it
  // the keyline would close the counters and turn A/O/0/8/B/D/P/R into blobs,
  // so a requested outline degrades to the single drop shadow there instead.
  const wantsOutline = opts.outline !== undefined && opts.outline !== false;
  const outline = wantsOutline && scale >= font.outlineMinScale ? opts.outline : undefined;
  // A demoted outline still wants SOME backing — fall through to the shadow,
  // using the caller's colour if they gave one.
  const shadow = outline === undefined && wantsOutline ? opts.outline : opts.shadow;
  const offsets = outline ? OUTLINE_OFFSETS : shadow ? SHADOW_OFFSETS : NO_OFFSETS;

  // Glyphs are blitted 1:1 from the atlas; smoothing would soften every edge
  // under the canvas's baked scale. Set it for the duration and put back what
  // the caller had — never leave state behind.
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  if (offsets.length > 0) {
    // The outline overlaps itself at the corners, so its default must be
    // OPAQUE — a translucent one would mottle where the passes stack.
    const back = outline ?? shadow;
    const backColor = typeof back === 'string' ? back : outline ? OUTLINE_COLOR : SHADOW_COLOR;
    const backAtlas = glyphAtlas(font, lookup, scale, backColor);
    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i];
      if (backAtlas) blitRun(ctx, backAtlas, lookup, font, text, x0 + o[0], y0 + o[1], scale, spacing);
      else fillRun(ctx, lookup, font, text, x0 + o[0], y0 + o[1], scale, spacing, backColor);
    }
  }
  const atlas = glyphAtlas(font, lookup, scale, color);
  if (atlas) blitRun(ctx, atlas, lookup, font, text, x0, y0, scale, spacing);
  else fillRun(ctx, lookup, font, text, x0, y0, scale, spacing, color);
  ctx.imageSmoothingEnabled = prevSmoothing;
}

/**
 * Draw text horizontally centered within [0, areaWidth]. Large text (scale >= 2
 * — titles, GAME OVER, YOU WIN) gets a backing pass by DEFAULT so headline words
 * read against whatever the live scene leaves behind them: a full keyline from
 * the font's outlineMinScale up, and a drop shadow below it where a keyline
 * would close the counters. Pass `{ shadow: false }` to opt out.
 */
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  areaWidth: number,
  y: number,
  opts: TextOptions = {},
): void {
  const scale = opts.scale ?? 1;
  const w = textWidth(text, scale, opts.spacing ?? 1, opts.font);
  const outline = opts.outline ?? (opts.shadow === undefined && scale >= 2);
  drawText(ctx, text, Math.round((areaWidth - w) / 2), y, { ...opts, outline });
}

/** Blink factor in [0,1]: 1 for `onRatio` of each `period`, else 0. */
export function blink(time: number, period = 0.9, onRatio = 0.6): number {
  const phase = ((time % period) + period) % period;
  return phase < period * onRatio ? 1 : 0;
}

/** Smooth 0..1 pulse (sine), for breathing prompts and highlights. */
export function pulse(time: number, period = 1.2): number {
  return 0.5 - 0.5 * Math.cos((time / period) * Math.PI * 2);
}

// --- Surfaces ---------------------------------------------------------------
//
// Cheap, opt-in background/slab helpers. All coordinates are LOGICAL pixels and
// every edge is rounded to the pixel grid, so nothing half-covers a pixel and
// no seams appear between adjacent calls. Nothing here allocates per frame
// (the dither patterns are built once and cached).

/**
 * WHY: a flat background is the single loudest "this is a mockup" tell; three
 * or four horizontal bands read instantly as a retro sky, water or cave wall.
 * Band heights split evenly; the LAST band absorbs the remainder so the fill is
 * exactly h tall with no gap.
 *   fillBands(ctx, 0, 0, W, 90, [PAL[1], PAL[13], PAL[12]]);
 */
export function fillBands(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: string[],
): void {
  const n = colors.length;
  if (n === 0 || w <= 0 || h <= 0) return;
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  const wi = Math.round(w);
  const hi = Math.round(h);
  const band = Math.floor(hi / n);
  let cy = y0;
  for (let i = 0; i < n; i++) {
    const bh = i === n - 1 ? y0 + hi - cy : band;
    if (bh <= 0) continue;
    ctx.fillStyle = colors[i];
    ctx.fillRect(x0, cy, wi, bh);
    cy += bh;
  }
}

export type DitherPattern = 'checker' | 'sparse';

/**
 * 4x4 ordered (Bayer) dither tiles, built once per (colorA, colorB, pattern)
 * and cached — a CanvasPattern is immutable, so reusing it is free and the hot
 * path allocates nothing. The cache is tiny by construction (a game has a
 * handful of pairs).
 *
 * WHY 4x4 and not 2x2: a 2x2 checker has CONSTANT parity per row, and the CRT
 * scanline pass runs on a 2-logical-px pitch — the two lock together and the
 * dither resolves into 2-px bands instead of averaging into a third tone. A 4x4
 * ordered cell breaks that phase lock: no row repeats at the scanline period,
 * so alternating rows are never uniformly lit or uniformly dimmed.
 *
 * Keyed per CONTEXT in a WeakMap: a CanvasPattern belongs to the context that
 * created it, so a second canvas must never be handed the first one's pattern.
 * The WeakMap lets a dead context and its patterns be collected together.
 */
const DITHER_CACHE = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern>>();

/** Classic 4x4 Bayer thresholds, 0..15. */
const BAYER_4: ReadonlyArray<number> = [
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
  if (hit) return hit;
  const tile = document.createElement('canvas');
  tile.width = 4;
  tile.height = 4;
  const tctx = tile.getContext('2d');
  if (!tctx) return null;
  tctx.fillStyle = colorA;
  tctx.fillRect(0, 0, 4, 4);
  tctx.fillStyle = colorB;
  // 'checker' = 50 % coverage (thresholds 0-7), 'sparse' = 25 % (0-3).
  const cutoff = pattern === 'sparse' ? 4 : 8;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      if (BAYER_4[ty * 4 + tx] < cutoff) tctx.fillRect(tx, ty, 1, 1);
    }
  }
  const made = ctx.createPattern(tile, 'repeat');
  if (!made) return null;
  perCtx.set(key, made);
  return made;
}

/**
 * WHY: two palette colors dithered together give a THIRD tone without leaving
 * the palette — the classic way to get a gradient or a ground texture on 16
 * colors. The 4x4 ordered tile is anchored to the logical pixel grid (the
 * pattern lives in the canvas's baked logical space) and its rows do not repeat
 * at the CRT's 2-px scanline pitch, so a static field averages instead of
 * banding. It is still a PATTERN, not a solid: keep it to seams, edges and
 * out-of-play strips — tiled under fast actors it beats against their motion.
 *   fillDither(ctx, 0, 96, W, H - 96, PAL[3], PAL[11], 'sparse');
 */
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
  if (wi <= 0 || hi <= 0) return;
  const pat = ditherPattern(ctx, colorA, colorB, pattern);
  if (!pat) {
    ctx.fillStyle = colorA;
    ctx.fillRect(x0, y0, wi, hi);
    return;
  }
  // save/restore so the pattern never leaks into the caller's next fill — a
  // CanvasPattern left in fillStyle silently textures whatever is drawn next.
  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(x0, y0, wi, hi);
  ctx.restore();
}

/**
 * WHY: a flat rectangle is a rectangle; the same rectangle with a 1-px light
 * top/left and dark bottom/right edge is a BRICK, a platform, a panel. Two
 * extra fills, no state to keep.
 *   drawBevel(ctx, p.x, p.y, p.w, p.h, PAL[4], PAL[15], PAL[2]);
 */
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
  if (wi <= 0 || hi <= 0) return;
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, wi, hi);
  ctx.fillStyle = light;
  ctx.fillRect(x0, y0, wi, 1);
  ctx.fillRect(x0, y0, 1, hi);
  ctx.fillStyle = dark;
  ctx.fillRect(x0, y0 + hi - 1, wi, 1);
  ctx.fillRect(x0 + wi - 1, y0, 1, hi);
}

/**
 * WHY: arena edges, window frames and selection boxes are all the same hollow
 * rectangle, and stroke() at a baked scale lands on half-pixels. This is four
 * fillRects, always on the grid.
 *   drawFrame(ctx, 4, 4, W - 8, H - 8, PAL[5], 2);
 */
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
  if (wi <= 0 || hi <= 0) return;
  ctx.fillStyle = color;
  const tv = Math.min(t, hi);
  const th = Math.min(t, wi);
  ctx.fillRect(x0, y0, wi, tv);
  ctx.fillRect(x0, y0 + hi - tv, wi, tv);
  ctx.fillRect(x0, y0 + tv, th, Math.max(0, hi - 2 * tv));
  ctx.fillRect(x0 + wi - th, y0 + tv, th, Math.max(0, hi - 2 * tv));
}

// --- Title treatment --------------------------------------------------------

export interface LogoOptions {
  /**
   * Lit color for the TOP 3 of the 5 font rows. REQUIRED, and taken from the
   * game's palette — a hard-coded default would be the one place a title screen
   * leaves the palette.
   */
  color: string;
  /** Body color for the whole word — the shaded lower half (defaults to `color`). */
  shade?: string;
  /** Offset shadow color under the word (default OUTLINE_COLOR, opaque black). */
  shadow?: string;
  /** Font pixel size in logical px (default 3). */
  scale?: number;
  /** Gap between glyphs in font pixels (default 1). */
  spacing?: number;
  /** Shadow offset in logical px (default 1). */
  shadowOffset?: number;
  /** Face to set the wordmark in (default FONT_RETRO). */
  font?: BitmapFont;
}

/**
 * WHY: an arcade title is never one flat color — it is lit from above. This is
 * the whole treatment in one call: an offset shadow, the word in `shade`, then
 * the top 3 of the 5 font rows re-drawn in `color` behind a single clip, so the
 * letters read as metal catching the light. One save/restore per call; the
 * per-glyph outline is off inside (the logo carries its own shadow).
 *
 * `color` is REQUIRED; `shade` defaults to `color` (a flat but on-palette
 * wordmark) and `shadow` to OUTLINE_COLOR. There are no palette-specific
 * literals here — a PICO8 default would put an off-palette hue on every
 * SUNSET/OCEAN/GAMEBOY title screen.
 *   drawLogo(ctx, 'STAR DRIFT', W, 34, { color: PAL[10], shade: PAL[9] });
 */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerWidth: number,
  y: number,
  opts: LogoOptions,
): void {
  if (!opts || !opts.color) {
    throw new Error(
      'drawLogo: opts.color is required and must come from the game palette, e.g. { color: PAL[10], shade: PAL[9] }',
    );
  }
  const scale = opts.scale ?? 3;
  const spacing = opts.spacing ?? 1;
  const font = opts.font ?? FONT_RETRO;
  const color = opts.color;
  const shade = opts.shade ?? color;
  const shadow = opts.shadow ?? OUTLINE_COLOR;
  const off = opts.shadowOffset ?? 1;
  const w = textWidth(text, scale, spacing, font);
  const x = Math.round((centerWidth - w) / 2);
  const yi = Math.round(y);
  const base = { scale, spacing, font, shadow: false as const, outline: false as const };
  // Lit band = the top 3/5 of the rows above the baseline: 3 of FONT_RETRO's 5,
  // and for FONT_HD (baseline 9, caps on rows 1-8) rows 0-4 — the upper half
  // of a capital, which is where light from above lands.
  const litRows = Math.round((font.baseline ?? font.glyphH) * 0.6);

  drawText(ctx, text, x + off, yi + off, { ...base, color: shadow });
  drawText(ctx, text, x, yi, { ...base, color: shade });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - off, yi, w + 2 * off, litRows * scale);
  ctx.clip();
  drawText(ctx, text, x, yi, { ...base, color });
  ctx.restore();
}
