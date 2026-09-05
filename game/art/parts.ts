// Ember Quest v3 — game/art/parts.ts
//
// The shared ASCII part library for the layered-actor pipeline (DESIGN.md →
// Presentation → Layered actors). Pure data: no engine import, no DOM.
//
// ART DIRECTION (v3.3, the Octopath Traveler pass, round 2). Every part is
// authored as flat MATERIAL regions; the shading is computed here, once, at
// module load, so a hundred silhouettes share one light. The rules, in the
// order the pass applies them:
//
//   1. PROPORTIONS — about three heads tall at TWO screen pixels per cell,
//      so the detail budget buys cells rather than bigger blocks. A hero is
//      56 cells: a 19-cell head (9 of hair/hood/helm over a 10-row face)
//      over a 38-cell body (2 neck, 21 torso, 15 leg and boot), 25–29 wide.
//      Every humanoid ends its arms in a real five-cell HAND and every
//      weapon's grip lands inside one.
//   2. RAMPS — nine materials (skin, hair, cloth, cloth2, leather, metal,
//      accent, glow, bone), each a SIX-STEP ramp: 0 deep → 5 specular,
//      hue-shifted (shadows toward violet-blue and desaturated, highlights
//      warm). actors.ts owns the colours; a part only ever names a material
//      and, where it matters, an explicit step. The six exist because four
//      could not carry a VALUE HIERARCHY: a figure needs a near-black anchor
//      (step 0, L 11-15: self-shadow seams, a hood interior, the band under a
//      belt), a dark mass (step 1, L 25-32: boots, gloves, belts, the shadow
//      side of a skirt) — together a fifth to a third of the body — a lit
//      mass (steps 2-4) and a small specular (step 5, L 85-92) that no
//      four-step ramp had room for. Everything from step 2 up is authored to
//      clear 3:1 against the stage navy, so the only sub-3:1 pixels in a
//      sprite are its deliberate anchors.
//   3. SHADING — `autoShade` below. One key light from the upper LEFT:
//      the upper-left silhouette takes a one-cell RIM in the material's
//      specular, the lower-right silhouette takes the material's dark
//      anchor, and inside those, top-left faces catch the light while
//      bottom-right faces fall into shadow. The rim never closes into a loop,
//      which is what separates a lit figure from an outlined sticker.
//      Material boundaries inside a part (a belt over a tunic, a trim down a
//      vest) get the same one-cell light/shadow step, which is what makes
//      trims, hems and buckles read. Glow inverts the rule — brightest in
//      the core, dimmest at the edge — so a flame or an orb looks lit.
//   4. OUTLINES are therefore selective and per-material: step 1 of the
//      material that owns the edge, never one global black keyline, and
//      never between two shades of the same material. `#` (a dark navy ink)
//      is reserved for hand-placed FEATURES — eyes, mouths, visor slits, the
//      split between two fingers; a self-shadow (a chin cast shadow, an
//      under-arm seam, the band under a belt) is step 0 of the material it
//      falls on, so it stays that garment's own colour instead of a line.
//
// Authoring alphabet (one char per cell):
//   '.' or ' '  transparent            '#'  ink (dark navy) — features only
//   material    auto     shadow(2)   lit(4)    dark(1)   deep(0)
//   skin        S        s           $         0         (
//   hair        H        h           ^         1         )
//   cloth       C        c           +         2         [
//   cloth2      D        d           =         3         ]
//   leather     L        l           ~         4         {
//   metal       M        m           *         5         }
//   accent      A        a           !         6         <
//   glow        G        g           @         7         >
//   bone        B        b           %         8         &
// "auto" means "let `autoShade` decide" and is what most cells are; the
// explicit steps are for folds, strand notches, catchlights, trim and — the
// two that carry the value hierarchy — dark masses (digits) and self-shadow
// (the bracket row).
//
// Anchors are named cell points in the part's OWN local grid (row 0, col 0 =
// its top-left). actors.ts composes a recipe by landing one part's named
// anchor exactly on an already-placed part's same-named anchor — a weapon's
// `weaponGrip` on the arms' `weaponGrip` — which is what keeps a weapon in a
// hand across every pose keyframe, rotations included.

// --- Materials ----------------------------------------------------------------

/** A material role, never a literal colour: actors.ts resolves (material, shade) → hex through the recipe's palette. */
export type Material = 'skin' | 'hair' | 'cloth' | 'cloth2' | 'leather' | 'metal' | 'accent' | 'glow' | 'bone';

/** Six steps of one material, deepest → most specular. */
export type Ramp = readonly [string, string, string, string, string, string];

/** The six steps by name, so nothing in the pipeline indexes a ramp with a bare integer. */
export const DEEP = 0;
export const DARK = 1;
export const SHADOW = 2;
export const MID = 3;
export const LIT = 4;
export const SPEC = 5;

/** Index order is the wire format between this module and actors.ts (`PartDef.mat` holds these). */
export const MATERIALS: readonly Material[] = ['skin', 'hair', 'cloth', 'cloth2', 'leather', 'metal', 'accent', 'glow', 'bone'];

export const MAT_EMPTY = -1;
/** A hand-placed dark-navy feature line (eyes, a visor slit, the seam under a belt). */
export const MAT_INK = -2;
const AUTO = -1;

interface CharDef {
  mat: number;
  shade: number;
}

const CHARS: Record<string, CharDef> = { '#': { mat: MAT_INK, shade: 0 } };
// auto / shadow / lit / dark / deep, per material, in MATERIALS order.
const CHAR_ROWS: readonly string[] = ['Ss$0(', 'Hh^1)', 'Cc+2[', 'Dd=3]', 'Ll~4{', 'Mm*5}', 'Aa!6<', 'Gg@7>', 'Bb%8&'];
for (let m = 0; m < CHAR_ROWS.length; m++) {
  const [auto, shadow, lit, dark, deep] = [...CHAR_ROWS[m]];
  CHARS[auto] = { mat: m, shade: AUTO };
  CHARS[shadow] = { mat: m, shade: SHADOW };
  CHARS[lit] = { mat: m, shade: LIT };
  CHARS[dark] = { mat: m, shade: DARK };
  CHARS[deep] = { mat: m, shade: DEEP };
}
const GLOW = MATERIALS.indexOf('glow');

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The named connection points a part may define, in ITS OWN local grid.
 * `feet` / `hit` mark whole-recipe ground contact and hurtbox centre;
 * `head` marks where a head sits on a body and, on a head, the neck point
 * that lands there; `hand` is the shoulder seam shared by a body and its
 * arms; `weaponGrip` is the FIST on an arms part and the handle on a
 * weapon; `capePin` is the back-collar point shared by a body and a cloak.
 */
export type AnchorName = 'hand' | 'head' | 'weaponGrip' | 'capePin' | 'feet' | 'hit';

export interface PartDef {
  readonly w: number;
  readonly h: number;
  /** Row-major material index per cell: MAT_EMPTY, MAT_INK, or an index into MATERIALS. */
  readonly mat: Int8Array;
  /** Row-major shade 0..3 per cell, already resolved (auto cells shaded by `autoShade`). */
  readonly shade: Int8Array;
  readonly anchors: Partial<Readonly<Record<AnchorName, Point>>>;
}

/**
 * One key light from the upper left, applied to a whole part at module load.
 *
 * A cell on the UPPER-LEFT silhouette takes the material's specular —
 * the rim light: the top of a head, the outer shoulder, the outer thigh. A
 * cell on the lower-right silhouette takes the material's dark anchor instead,
 * so the figure still has a contained edge where the light is not. Because
 * the two tests are exclusive, the rim can never close into a loop, and a
 * one-cell-thin feature (a strand, a talon, a fold) reads as neither and
 * stays dark. Inside that edge, a left- or top-facing plane catches the
 * light and a right- or bottom-facing one falls away, and any material
 * CHANGE gets the same one-cell step, which is what makes a belt sit on a
 * tunic. Glow inverts (bright core, dim edge) so lit things read lit.
 */
function autoShade(w: number, h: number, mat: Int8Array, shade: Int8Array): void {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? MAT_EMPTY : mat[y * w + x]);
  const empty = (x: number, y: number): boolean => at(x, y) === MAT_EMPTY;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mat[i];
      if (m < 0 || shade[i] !== AUTO) continue;
      const up = empty(x, y - 1);
      const down = empty(x, y + 1);
      const left = empty(x - 1, y);
      const right = empty(x + 1, y);
      if (m === GLOW) {
        // A flame or an orb: hottest in the middle, falling off outward. The
        // specular core is deliberately hard to reach (three cells clear on
        // every side) so a glowing body keeps a hotspot, not a white mass.
        // A spark, an ember crack, a lit eye — anything three cells or
        // thinner — has no room for a falloff and is simply lit; a real body
        // of light gets the falloff, hottest in the middle.
        const thin = (empty(x - 2, y) && empty(x + 2, y)) || (empty(x, y - 2) && empty(x, y + 2));
        if (thin) {
          shade[i] = LIT;
          continue;
        }
        const edge = up || down || left || right;
        const near = empty(x - 2, y) || empty(x + 2, y) || empty(x, y - 2) || empty(x, y + 2);
        const core = !(empty(x - 3, y) || empty(x + 3, y) || empty(x, y - 3) || empty(x, y + 3));
        shade[i] = edge ? DARK : near ? SHADOW : core ? SPEC : LIT;
        continue;
      }
      if (up || down || left || right) {
        shade[i] = (up || left) && !(down || right) ? SPEC : DARK;
        continue;
      }
      const lit = at(x - 1, y) !== m || at(x, y - 1) !== m || empty(x - 1, y - 1);
      const shd = at(x + 1, y) !== m || at(x, y + 1) !== m || empty(x + 1, y + 1);
      if (lit !== shd) {
        shade[i] = lit ? LIT : SHADOW;
        continue;
      }
      // FORM SHADE. A flat region is not flat: the far side of it turns away
      // from the key light. Walk the cell's own run of this material across
      // and down, and give the last third across (and the last sixth down)
      // the material's shadow. This is what makes a torso a cylinder and a
      // skirt a cone instead of two slabs of one colour.
      let x0 = x;
      while (x0 > 0 && at(x0 - 1, y) === m) x0--;
      let x1 = x;
      while (x1 < w - 1 && at(x1 + 1, y) === m) x1++;
      let y1 = y;
      while (y1 < h - 1 && at(x, y1 + 1) === m) y1++;
      let y0 = y;
      while (y0 > 0 && at(x, y0 - 1) === m) y0--;
      const across = x1 - x0 > 1 ? (x - x0) / (x1 - x0) : 0.5;
      const along = y1 - y0 > 3 ? (y - y0) / (y1 - y0) : 0;
      shade[i] = across > 0.68 || along > 0.88 ? SHADOW : MID;
    }
  }
}

function part(rows: readonly string[], anchors: Partial<Record<AnchorName, Point>> = {}): PartDef {
  const h = rows.length;
  let w = 0;
  for (const r of rows) if (r.length > w) w = r.length;
  const mat = new Int8Array(w * h).fill(MAT_EMPTY);
  const shade = new Int8Array(w * h).fill(AUTO);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const def = CHARS[row[x]];
      if (!def) continue;
      mat[y * w + x] = def.mat;
      shade[y * w + x] = def.shade;
    }
  }
  autoShade(w, h, mat, shade);
  for (let i = 0; i < shade.length; i++) if (shade[i] === AUTO) shade[i] = MID;
  return { w, h, mat, shade, anchors };
}

// --- Authoring helpers --------------------------------------------------------
// Front-facing bodies are left/right symmetric in MATERIAL (the light is
// what breaks the symmetry, and that is computed), so a row is authored as
// a left half plus its centre column and mirrored. Every helper returns a
// half of exactly `lh` cells, so a taper is one number per row and the
// centreline can never drift.

/** Mirror a left half (+ its centre column) into a full symmetric row: width 2·lh + centre.length. */
function sym(lh: number, left: string, centre = ''): string {
  const l = left.length >= lh ? left.slice(0, lh) : left + '.'.repeat(lh - left.length);
  return l + centre + [...l].reverse().join('');
}
/** A solid left half: `pad` blank cells from the outer edge, `ch` to the centreline, with `inner` overriding the innermost cells (a trim down the front). */
function hb(lh: number, pad: number, ch: string, inner = ''): string {
  const body = Math.max(0, lh - pad - inner.length);
  return '.'.repeat(Math.min(pad, lh)) + ch.repeat(body) + inner.slice(0, lh - Math.min(pad, lh));
}
/** `hb` with vertical FOLD lines knocked down to `fold` at the given offsets from the outer edge — the one-cell shadow creases every garment needs. */
function hbf(lh: number, pad: number, ch: string, fold: string, folds: readonly number[], inner = ''): string {
  const cells = [...hb(lh, pad, ch, inner)];
  for (const f of folds) if (f >= 0 && f < lh && cells[f] === ch) cells[f] = fold;
  return cells.join('');
}
/** A gapped left half: a `w`-wide block of `ch` starting `pad` cells in, blank to the centreline — mirrors into two limbs with a gap between them. */
function hg(lh: number, pad: number, w: number, ch: string): string {
  return ('.'.repeat(pad) + ch.repeat(w)).slice(0, lh).padEnd(lh, '.');
}
/** Two blocks in one left half (a quadruped's near and far leg, a toad's two eyes). */
function hg2(lh: number, padA: number, wA: number, padB: number, wB: number, ch: string): string {
  const cells = new Array(lh).fill('.');
  for (let i = 0; i < wA; i++) if (padA + i < lh) cells[padA + i] = ch;
  for (let i = 0; i < wB; i++) if (padB + i < lh) cells[padB + i] = ch;
  return cells.join('');
}
/** `[repeats, leftHalf, centreColumn]` — the band form every body is authored in. */
type Band = readonly [n: number, left: string, centre?: string];
function bands(lh: number, list: readonly Band[]): string[] {
  const out: string[] = [];
  for (const [n, left, centre] of list) {
    const row = sym(lh, left, centre ?? '');
    for (let i = 0; i < n; i++) out.push(row);
  }
  return out;
}
/** `n` copies of one already-built row — a band of a hand-authored (unmirrored) part. */
function rep(n: number, row: string): string[] {
  return new Array(n).fill(row);
}
/** Translate a row sideways, clipped to its own width — a lean, a crooked hood, a windswept fringe. */
function shiftX(row: string, dx: number): string {
  const w = row.length;
  if (dx > 0) return ('.'.repeat(dx) + row).slice(0, w);
  if (dx < 0) return row.slice(-dx) + '.'.repeat(-dx);
  return row;
}
/**
 * One row of a STANCE: a FAR limb `farPad` in from the left and a NEAR limb
 * `nearPad` in from the RIGHT, each its own width and its own ramp step. A
 * figure standing on two identical posts is a paper doll; the far leg set a
 * cell back, a row shorter and a step darker is what turns the same two posts
 * into weight on one hip.
 */
function stanceRow(w: number, farPad: number, farW: number, farCh: string, nearPad: number, nearW: number, nearCh: string): string {
  const cells: string[] = new Array(w).fill('.');
  for (let i = 0; i < farW; i++) {
    const x = farPad + i;
    if (x >= 0 && x < w) cells[x] = farCh;
  }
  for (let i = 0; i < nearW; i++) {
    const x = w - 1 - nearPad - i;
    if (x >= 0 && x < w) cells[x] = nearCh;
  }
  return cells.join('');
}
/** An asymmetric row: a left half and a right half, each authored from ITS OWN outer edge inward, around a centre column. `sym` is this with one half mirrored. */
function pair(lh: number, left: string, centre: string, right: string): string {
  const fit = (s: string): string => (s.length >= lh ? s.slice(0, lh) : s + '.'.repeat(lh - s.length));
  return fit(left) + centre + [...fit(right)].reverse().join('');
}
/** `mid` placed `lead` cells into a `width`-wide blank row — one-off asymmetric appendages (a tail, a jaw, a scarf tail). */
function padRow(width: number, lead: number, mid: string): string {
  return ('.'.repeat(lead) + mid).slice(0, width).padEnd(width, '.');
}
/** Overwrite cells of an already-built row, left to right — eyes, catchlights, a visor glint, an asymmetric lit panel. */
function stamp(row: string, ...edits: readonly (readonly [x: number, s: string])[]): string {
  const cells = [...row];
  for (const [x, s] of edits) for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < cells.length) cells[x + i] = s[i];
  return cells.join('');
}
/** Apply `stamp` edits to a RANGE of already-built rows — a lit panel down one side of a robe, a run of rivets. */
function stampRows(rows: string[], from: number, to: number, ...edits: readonly (readonly [x: number, s: string])[]): string[] {
  const out = rows.slice();
  for (let y = from; y <= to && y < out.length; y++) if (y >= 0) out[y] = stamp(out[y], ...edits);
  return out;
}
/** Append `add` to the right of each row starting at `from` (a jaw, a tail, a trailing scarf) without re-typing the body. */
function graft(rows: string[], from: number, add: readonly string[], lead = 0): string[] {
  const out = rows.slice();
  const w = Math.max(...rows.map((r) => r.length));
  for (let i = 0; i < add.length; i++) {
    const y = from + i;
    if (y < 0 || y >= out.length) continue;
    out[y] = out[y].padEnd(w, '.') + padRow(add[i].length + lead, lead, add[i]);
  }
  return out;
}

// --- Hero bodies --------------------------------------------------------------
// A body is torso + legs in one part (a separate leg layer bought nothing at
// POSE_FPS 12 and doubled the anchor bookkeeping). Every hero body is 38
// rows: 2 neck, 21 of torso, 15 of leg and boot — which, under a 19-cell
// head overlapping the neck by one, composes a 56-cell figure almost exactly
// three heads tall. Widths differ by build: 25 for the slim two, 27 for the
// cloaked and the mantled, 29 for the robed and the armoured. Every garment
// carries fold creases (shade 1) from the belt to the hem and a dark band
// under that hem, which is what stops a tunic reading as a flat slab.

const SLIM = 12; // half-width; composed width 2·SLIM + 1 = 25
const WIDE = 13; // 27
const BULK = 14; // 29
const W_SLIM = 2 * SLIM + 1;
const W_WIDE = 2 * WIDE + 1;
const W_BULK = 2 * BULK + 1;

/**
 * Kill the box: the FAR shoulder is inset a cell more than the weapon-side
 * one, so the top of a torso is a slope rather than a lintel and the figure
 * reads as turned a few degrees toward its weapon.
 */
function shoulderDrop(rows: string[], y: number, lh: number, ch: string, farPad: number, nearPad: number): string[] {
  const out = rows.slice();
  if (y >= 0 && y < out.length) out[y] = pair(lh, hb(lh, farPad, ch), ch, hb(lh, nearPad, ch));
  return out;
}

/**
 * The three self-shadows every humanoid carries, applied to already-built
 * torso rows: the CHIN's cast shadow across the chest (two rows, offset a
 * cell to the right of centre because the key light is upper-left), and an
 * UNDER-ARM seam down each side of the torso where the arms layer overlaps
 * it. Without them a torso is a flat slab with a head balanced on top; with
 * them the head sits IN front of the chest and the arms sit in front of the
 * ribs, which is the whole of what "lit form" means at this size.
 */
function selfShadow(rows: string[], deep: string, chin: number, seam: [from: number, to: number], edges: [left: number, right: number]): string[] {
  const wide = deep.repeat(11);
  let out = stampRows(rows, chin, chin, [7, wide]);
  out = stampRows(out, chin + 1, chin + 1, [8, deep.repeat(9)]);
  out = stampRows(out, seam[0], seam[1], [edges[0], deep], [edges[1], deep]);
  return out;
}

/** The five anchors every biped body shares: neck at the top centre, shoulder seam, cape collar, ground contact, centre mass. */
function bodyAnchors(lh: number, h: number, hitY: number): Partial<Record<AnchorName, Point>> {
  return { head: { x: lh, y: 0 }, hand: { x: lh, y: 3 }, capePin: { x: lh, y: 2 }, feet: { x: lh, y: h - 1 }, hit: { x: lh, y: hitY } };
}

// EMBER — a short crimson vest over a dark leather placket, a heavy buckled
// belt, creased trousers and tall turned-cuff boots. The value hierarchy is
// the read: collar, belt, hem band and the whole boot are the dark anchor,
// the vest carries the light.
const emberTop = bands(SLIM, [
  [2, hb(SLIM, 9, 'S'), 'S'], // 0-1  throat
  [1, hb(SLIM, 5, '4'), '4'], // 2    a dark leather collar — the first anchor
  [1, hb(SLIM, 3, 'A'), 'A'], // 3    shoulder line
  [1, hb(SLIM, 2, 'A'), 'A'], // 4
  [6, hbf(SLIM, 2, 'A', '6', [6], '!4'), '4'], // 5-10 crimson vest, creased, a lit trim beside the placket
  [1, hb(SLIM, 3, 'A', '!4'), '4'], // 11   the waist takes a cell in
  [1, hb(SLIM, 3, '6', '!4'), '4'], // 12   the vest hem falls into its dark band
  [1, hb(SLIM, 3, '<'), '<'], // 13   and a deep band under that
  [1, hb(SLIM, 3, '4'), 'M'], // 14   belt strap + buckle
  [1, hb(SLIM, 3, '{'), '{'], // 15   the deep seam under the belt
  [1, hb(SLIM, 3, 'C'), 'C'], // 16   hip
  [3, hbf(SLIM, 3, 'C', '2', [6]), 'C'], // 17-19 trousers, creased
]);
const BODY_EMBER = part(
  [
    ...selfShadow(shoulderDrop(shoulderDrop(emberTop, 3, SLIM, 'A', 4, 3), 4, SLIM, 'A', 3, 2), '<', 3, [5, 11], [4, 19]),
    ...rep(10, stanceRow(W_SLIM, 3, 6, 'c', 3, 7, 'C')), // 20-29 the far leg a cell back and a step down
    ...rep(2, stanceRow(W_SLIM, 3, 6, '[', 3, 7, 'c')), // 30-31 knees
    stanceRow(W_SLIM, 2, 7, '4', 2, 8, 'L'), // 32    turned-down boot cuffs
    ...rep(3, stanceRow(W_SLIM, 3, 6, '4', 3, 7, 'L')), // 33-35 shafts
    stanceRow(W_SLIM, 3, 6, '{', 2, 8, '4'), // 36    the far foot lands
    stanceRow(W_SLIM, 0, 0, '.', 2, 8, '{'), // 37    the near foot alone reaches the line
  ],
  bodyAnchors(SLIM, 38, 15),
);

// GALE — fitted leathers in the element colour, a chest strap, a buckled
// belt, creased legs and turned-down boots; the whole upper body is then
// translated forward so the figure leans into a run (the lean bends at the
// belt, a natural seam, rather than snapping mid-chest).
const galeTop = bands(SLIM, [
  [2, hb(SLIM, 9, 'S'), 'S'], // 0-1  throat
  [1, hb(SLIM, 4, '4'), '4'], // 2    dark collar
  [1, hb(SLIM, 3, 'A'), 'A'], // 3    shoulders
  [4, hbf(SLIM, 2, 'A', '6', [5]), 'A'], // 4-7  chest
  [1, hb(SLIM, 2, '4'), '4'], // 8    a dark chest strap
  [2, hbf(SLIM, 2, 'A', '6', [5]), 'A'], // 9-10 midriff
  [1, hbf(SLIM, 3, 'A', '6', [5]), 'A'], // 11   waist in a cell
  [1, hb(SLIM, 3, '6'), '6'], // 12   jacket hem
  [1, hb(SLIM, 3, '<'), '<'], // 13
  [1, hb(SLIM, 3, '4'), 'M'], // 14   belt + buckle
  [1, hb(SLIM, 3, '{'), '{'], // 15   deep seam
  [1, hb(SLIM, 4, 'A'), 'A'], // 16   hip
  [3, hb(SLIM, 4, 'A'), 'A'], // 17-19
]);
const galeRows = [
  ...selfShadow(shoulderDrop(shoulderDrop(galeTop, 3, SLIM, 'A', 4, 2), 4, SLIM, 'A', 3, 1), '<', 3, [4, 11], [4, 19]),
  ...rep(9, stanceRow(W_SLIM, 4, 5, 'a', 4, 6, 'A')), // 20-28 slim staggered legs
  ...rep(2, stanceRow(W_SLIM, 4, 5, '<', 4, 6, 'a')), // 29-30 knees
  ...rep(3, stanceRow(W_SLIM, 3, 6, '4', 3, 7, 'L')), // 31-33 boot shafts
  stanceRow(W_SLIM, 2, 7, '~', 2, 8, '~'), // 34    turned down at the top
  ...rep(2, stanceRow(W_SLIM, 3, 6, '4', 2, 8, 'L')), // 35-36
  stanceRow(W_SLIM, 0, 0, '.', 2, 8, '{'), // 37    the planted foot
];
// The whole upper body is then translated forward so the figure leans into a
// run (the lean bends at the belt, a natural seam, rather than mid-chest),
// and a coat tail is grafted off the trailing side.
for (let i = 0; i < 16; i++) galeRows[i] = shiftX(galeRows[i], 3);
for (let i = 16; i < 20; i++) galeRows[i] = shiftX(galeRows[i], 2);
const BODY_GALE = part(galeRows, { head: { x: SLIM + 3, y: 0 }, hand: { x: SLIM + 3, y: 3 }, capePin: { x: SLIM - 4, y: 5 }, feet: { x: SLIM, y: 37 }, hit: { x: SLIM, y: 15 } });

// TIDE — a pale robe to the ground over a teal underdress, a sash, four
// vertical creases, a two-cell lit panel down the key-light side and a
// scalloped wave hem. No legs: the robe reaches the floor.
const tideTop = bands(BULK, [
  [2, hb(BULK, 11, 'S'), 'S'], // 0-1  throat
  [1, hb(BULK, 7, '2'), '2'], // 2    a dark collar
  [1, hb(BULK, 6, 'A'), 'A'], // 3    the shoulder SLOPES into the robe
  [1, hb(BULK, 5, 'A'), 'A'], // 4    rather than sitting on it as a plank
  [1, hb(BULK, 4, 'A'), 'A'], // 5
  [3, hb(BULK, 3, 'A'), 'A'], // 6-8
  [1, hb(BULK, 3, '4'), 'M'], // 9    sash + clasp
  [1, hb(BULK, 3, '{'), '{'], // 10   the deep seam under it
  [3, hbf(BULK, 3, 'A', '6', [7]), 'A'], // 11-13 the robe falls from the sash
  [4, hbf(BULK, 2, 'A', '6', [6, 11]), 'A'], // 14-17
  [5, hbf(BULK, 1, 'A', '6', [5, 10]), 'A'], // 18-22
  [6, hbf(BULK, 0, 'A', '6', [4, 9]), 'A'], // 23-28 flaring to the floor
  [2, hbf(BULK, 0, 'A', '6', [4, 9]), 'A'], // 29-30
  [1, hb(BULK, 0, '6'), '6'], // 31   hem band
  [1, hb(BULK, 0, '<'), '<'], // 32   and the deep band under it
  [2, hb(BULK, 0, 'C'), 'C'], // 33-34 a two-row wave band
  [1, hb(BULK, 0, 'c'), 'c'], // 35
  [1, 'CC.CCC.CC.CCC', 'C'], // 36   and an uneven 2-3-2 scallop under it
  [1, '.C..CC..C..CC', '.'], // 37
]);
// A robe is a cone, not a bell: the LIT side takes a two-cell panel and the
// far side a four-cell dark band, so the skirt turns away from the key light
// instead of ending in a symmetric silhouette with nothing inside it.
const tideRows = stampRows(stampRows(selfShadow(tideTop, '<', 3, [5, 9], [5, 23]), 12, 30, [8, '!!']), 14, 30, [21, '66']);
const BODY_TIDE = part(tideRows, bodyAnchors(BULK, 38, 16));

const hagAnchors: Partial<Record<AnchorName, Point>> = { head: { x: BULK + 3, y: 0 }, hand: { x: BULK + 2, y: 4 }, capePin: { x: BULK + 2, y: 3 }, feet: { x: BULK, y: 37 }, hit: { x: BULK, y: 18 } };
const hagBodyRows = stampRows(
  tideRows.map((r, i) => (i <= 12 ? shiftX(r, 3) : i <= 17 ? shiftX(r, 1) : r)),
  3,
  8,
  [4, 'AAA'], // the humped back behind the dropped shoulder
).map((r, i) => (i >= 35 ? stamp(r, [3, 'A.AA..A.AAA..A.AA..A']) : r)); // and a hem gone to rags
const BODY_HAG = part(shoulderDrop(shoulderDrop(hagBodyRows, 5, BULK, 'A', 8, 4), 6, BULK, 'A', 7, 3), hagAnchors);
const BODY_HAG_SWAY = hemSway(hagBodyRows, 30, hagAnchors);

// BASALT — mail with a dark tabard over it, a heavy belt, mailed legs and
// sabatons. The mail shows as a three-cell band down each side of the
// tabard so the two materials both read, and the tabard skirt is creased.
const basaltTop = bands(BULK, [
  [2, hb(BULK, 11, '5'), '5'], // 0-1  a dark gorget under the helm
  [1, hb(BULK, 3, 'M'), 'M'], // 2    pauldron line
  [2, hb(BULK, 1, 'M'), 'M'], // 3-4
  [1, hb(BULK, 2, '5'), '5'], // 5    pauldron underside, dark
  [8, '.}55MAA6AAA6AA', 'A'], // 6-13 tabard over mail, creased, the mail band dark
  [1, '.}554444444444', 'M'], // 14   belt + buckle
  [1, '.}55{{{{{{{{{{', '{'], // 15   the deep seam under it
  [5, '.}55AA6AAAA6AA', 'A'], // 16-20 tabard skirt, creased
  [1, '.}55AA6AAAA6Aa', 'a'], // 21   hem shadow
  [1, '.}55.6AAAAAA6A', '6'], // 22   hem band, cut back to a V
  [1, '.}55..6AAAAAA6', 'A'], // 23
  [1, '.}55...<66666<', '6'], // 24   and its deep band, following the V
  [1, '.}55.....<<<<<', '<'], // 25
  [3, hg(BULK, 4, 9, 'M'), '.'], // 26-28 mailed legs
  [2, hg(BULK, 4, 9, 'm'), '.'], // 29-30
]);
const BODY_BASALT = part(
  [
    ...selfShadow(basaltTop, '<', 2, [6, 13], [5, 23]),
    ...rep(2, stanceRow(W_BULK, 4, 9, 'm', 4, 9, 'M')), // 31-32
    ...rep(2, stanceRow(W_BULK, 3, 10, '5', 3, 10, 'M')), // 33-34 sabatons
    stanceRow(W_BULK, 3, 10, '}', 2, 11, '5'), // 35
    stanceRow(W_BULK, 3, 10, '}', 2, 11, '5'), // 36   the far sabaton lands
    stanceRow(W_BULK, 0, 0, '.', 2, 11, '}'), // 37   the planted one
  ],
  bodyAnchors(BULK, 38, 15),
);

// SABLE — a hooded cloak to the knees over dark leathers: the cloak IS the
// silhouette, its plum lining showing as a band down the front where it
// hangs open and as a cowl draped over both shoulders, and the legs below.
const sableTop = bands(WIDE, [
  [2, hb(WIDE, 10, ']'), ']'], // 0-1  the cowl's interior, the deepest thing on him
  [1, hb(WIDE, 5, '6'), '6'], // 2    cloak collar, dark
  [2, hb(WIDE, 2, 'D'), 'D'], // 3-4  the cowl drapes onto the shoulders
  [1, hb(WIDE, 2, '3'), '3'], // 5
  [3, hbf(WIDE, 1, 'A', '6', [5], 'D'), 'D'], // 6-8  cloak, a lining edge where it hangs open
  [1, hb(WIDE, 1, '4'), 'M'], // 9    belt over the cloak
  [1, hb(WIDE, 1, '{'), '{'], // 10   deep seam
  [6, hbf(WIDE, 0, 'A', '6', [4, 9], 'D'), 'D'], // 11-16
  [4, hbf(WIDE, 0, 'A', '6', [3, 8], 'D'), 'D'], // 17-20
  [1, hb(WIDE, 0, 'a', 'd'), 'd'], // 21
  [1, hb(WIDE, 0, '6'), '6'], // 22   cloak hem
  [1, hb(WIDE, 0, '<'), '<'], // 23   and its deep band
  [4, hg(WIDE, 4, 6, 'L'), '.'], // 24-27 leathered legs
  [2, hg(WIDE, 4, 6, 'l'), '.'], // 28-29
]);
const sableBodyRows = [
  ...selfShadow(sableTop, '<', 3, [6, 11], [5, 21]),
  ...rep(2, stanceRow(W_WIDE, 4, 5, '{', 4, 6, 'l')), // 30-31 knees
  ...rep(3, stanceRow(W_WIDE, 3, 6, '4', 3, 7, 'L')), // 32-34 soft boots
  ...rep(2, stanceRow(W_WIDE, 3, 6, '{', 3, 7, '4')), // 35-36
  stanceRow(W_WIDE, 0, 0, '.', 3, 7, '{'), // 37
];
const BODY_SABLE = part(sableBodyRows, bodyAnchors(WIDE, 38, 15));

// LUMEN — TWO gold shoulder plates with a clean lower edge (not a dithered
// mantle) over a long creased tunic, a cinched sash, a gold hem trim, and
// boots peeking out under it.
const lumenTop = bands(WIDE, [
  [2, hb(WIDE, 10, 'S'), 'S'], // 0-1  throat
  [1, hb(WIDE, 6, '6'), '6'], // 2    a dark gold collar
  [3, hb(WIDE, 1, 'A', 'CCCC'), 'C'], // 3-5  two shoulder plates, clean inner edge
  [1, hb(WIDE, 1, '6', 'CCCC'), 'C'], // 6    and a clean dark lower edge
  [4, hbf(WIDE, 2, 'C', '2', [6]), 'C'], // 7-10 tunic
  [1, hb(WIDE, 2, '4'), 'M'], // 11   sash + clasp
  [1, hb(WIDE, 2, '{'), '{'], // 12   deep seam
  [4, hbf(WIDE, 2, 'C', '2', [6, 10]), 'C'], // 13-16
  [4, hbf(WIDE, 1, 'C', '2', [5, 9]), 'C'], // 17-20
  [3, hbf(WIDE, 0, 'C', '2', [4, 8]), 'C'], // 21-23
  [1, hb(WIDE, 0, '6'), '6'], // 24   gold hem trim, dark
  [1, hb(WIDE, 0, '['), '['], // 25   hem band
  [3, hg(WIDE, 4, 6, 'C'), '.'], // 26-28 legs under the tunic
]);
const BODY_LUMEN = part(
  [
    ...stampRows(selfShadow(shoulderDrop(lumenTop, 6, WIDE, '6', 2, 1), '[', 3, [7, 11], [5, 21]), 13, 23, [19, '22']), // the tunic's far side turns away
    ...rep(2, stanceRow(W_WIDE, 4, 5, '[', 4, 6, 'c')), // 29-30
    ...rep(4, stanceRow(W_WIDE, 3, 6, '4', 3, 7, 'L')), // 31-34 boots
    ...rep(2, stanceRow(W_WIDE, 3, 6, '{', 3, 7, '4')), // 35-36
    stanceRow(W_WIDE, 0, 0, '.', 3, 7, '{'), // 37
  ],
  bodyAnchors(WIDE, 38, 15),
);

// --- Heads --------------------------------------------------------------------
// Every head is 19 rows and its neck anchor is the last one, so a head lands
// with its chin on the body's neck row: nine rows of hair, hood or helm over
// a ten-row face, 23 wide. That head is a third of the composed figure — the
// proportion the whole style rests on.

const HLH = 11; // half-width; composed width 23

/** Per-character face variation: the same ten rows, but no two characters wear them the same way. */
interface FaceOpts {
  /** What frames the face: hair, a hood, a helm cheek. */
  side: string;
  /** The DARK step of whatever frames it — the two cells of that mass nearest the face, where it turns away and casts. */
  sideDark: string;
  /** Face material — `s` for a face inside a deep hood, plain `S` in the open. */
  skin?: string;
  eye?: string;
  /** The one lit cell inside each eye. Its position is what gives a face a direction to look in. */
  sclera?: string;
  /** Outer end of the brow dropped (1) or raised (-1) by a cell — the single strongest read of temperament at this size. */
  brow?: number;
  /** Eye spacing off the default, in cells: -1 close-set, +1 wide-set. */
  spacing?: number;
  /** Mouth width in cells, 1–3. */
  mouth?: number;
  /** A one-cell cheek shadow under each eye. */
  cheek?: boolean;
  /** The deep step of the skin — the chin's own cast shadow, two rows under the jaw. */
  deep?: string;
}

/**
 * The ten rows every human face shares: forehead under a cast hair shadow, a
 * brow, a two-cell eye cluster each side with a one-cell SCLERA, cheeks, a
 * mouth, jaw and chin. Two things stop every character reading as the same
 * doll: the eyes sit two rows higher than a naive centre would put them and
 * their spacing, brow angle and sclera side vary per character; and whatever
 * frames the face — hair, hood, helm — meets it in its own DARK step rather
 * than its midtone, so the face sits inside a mass instead of on top of one.
 */
function faceBlock(opts: FaceOpts): string[] {
  const { side, sideDark, skin = 'S', eye = '#', sclera = '$', brow = 0, spacing = 0, mouth = 1, cheek = false, deep = '(' } = opts;
  const r = (pad: number, sides: number): string =>
    sym(HLH, '.'.repeat(pad) + side.repeat(Math.max(0, sides - 2)) + sideDark.repeat(Math.min(2, sides)) + skin.repeat(Math.max(0, HLH - pad - sides)), skin);
  const dim = skin === 'S' ? 's' : skin;
  // Seventeen cells of face inside twenty-three of head, tapering to seven at
  // the chin — the hair, hood or helm carries the rest of the width, which is
  // what keeps a head from reading as a doll's.
  // Five cells of frame each side, not four: the face is thirteen cells wide
  // inside a twenty-three-cell head, so the hair, hood or helm is the bigger
  // mass — which is the proportion the reference sprites are built on.
  const rows = [r(0, 5), r(0, 5), r(0, 5), r(0, 5), r(1, 5), r(2, 5), r(3, 5), r(3, 5), r(4, 5), r(5, 5)];
  rows[0] = stamp(rows[0], [4, deep.repeat(2 * HLH - 7)]); // the fringe casts onto the brow
  rows[1] = stamp(rows[1], [4, dim], [2 * HLH - 4, dim]); // and down both temples
  const e = HLH - 4 - spacing; // the outer edge of the left eye; the right mirrors it
  const f = HLH + 3 + spacing;
  if (brow !== 0) {
    const b = brow > 0 ? deep : skin === 'S' ? '$' : skin;
    rows[1] = stamp(rows[1], [e - 1, b], [f + 1, b]);
  }
  rows[1] = stamp(rows[1], [e, eye + eye], [f, eye + eye]); // eyes, raised two rows
  rows[2] = stamp(rows[2], [e, sclera + eye], [f, eye + sclera]); // a lit cell inside each
  if (cheek) rows[3] = stamp(rows[3], [e, dim + dim], [f, dim + dim]);
  rows[3] = stamp(rows[3], [HLH, dim]); // the bridge of a nose
  rows[5] = stamp(rows[5], [HLH - ((mouth / 2) | 0), dim.repeat(mouth)]);
  rows[7] = stamp(rows[7], [HLH - 2, dim.repeat(5)]); // the jaw
  rows[8] = stamp(rows[8], [HLH - 1, deep.repeat(3)]); // and the chin's own cast shadow, offset off the key light
  return rows;
}

/** A hair or hood crown: `pads` outer-edge insets top to bottom (nine of them), optionally swept sideways per row. */
function crown(ch: string, pads: readonly number[], sweep: readonly number[] = []): string[] {
  return pads.map((pad, i) => shiftX(sym(HLH, hb(HLH, pad, ch), ch), sweep[i] ?? 0));
}

const NECK: Partial<Record<AnchorName, Point>> = { head: { x: HLH, y: 18 } };

// EMBER — a big upswept mane with strand notches, swept back off the brow;
// a dropped outer brow and a shadowed cheek make him the scowler of the six.
const emberCrown = crown('H', [8, 6, 4, 2, 1, 0, 0], [-4, -4, -3, -2, -1, 0, 0]);
emberCrown[4] = stamp(emberCrown[4], [4, '^^^^^^']);
emberCrown[5] = stamp(emberCrown[5], [3, '^^^^']);
const emberHeadRows = [...emberCrown, sym(HLH, 'HH^HHHHH111', '1'), sym(HLH, 'HHH^HHH1111', '1'), ...faceBlock({ side: 'H', sideDark: '1', brow: 1, spacing: -1, cheek: true })];
const HEAD_EMBER = part(emberHeadRows, NECK);

// GALE — a windswept crop, the whole mass leaning back off the run; a
// raised brow and a wide mouth: the only one of the six who looks cheerful.
const galeCrown = crown('H', [9, 7, 5, 3, 1, 0, 0], [-6, -6, -5, -4, -3, -2, -1]);
galeCrown[4] = stamp(galeCrown[4], [2, '^^^^^^']);
galeCrown[5] = stamp(galeCrown[5], [1, '^^^^']);
const galeHeadRows = [...galeCrown, shiftX(sym(HLH, 'H^HHHHHH111', '1'), -2), shiftX(sym(HLH, 'HH^HHHH1111', '1'), -1), ...faceBlock({ side: 'H', sideDark: '1', brow: -1, mouth: 3, sclera: '$' })];
const HEAD_GALE = part(galeHeadRows, NECK);

// TIDE — a deep teal hood with dark hair showing beneath it, and a level
// brow: the composed one.
const tideHeadRows = [
  ...crown('C', [8, 6, 4, 2, 1, 0, 0, 0, 0]), ...faceBlock({ side: 'C', sideDark: '2', mouth: 2, spacing: 1 }).map((row, i) => (i < 2 ? stamp(row, [HLH - 8, 'HHHH'], [HLH + 5, 'HHHH']) : row))];
const HEAD_TIDE = part(tideHeadRows, NECK);

// BASALT — a full iron helm: ONE continuous visor slit with a single glint,
// breathing holes below it, and a helm deliberately NARROWER than the
// pauldrons that carry it. No face at all, which is the point.
const basaltHelm = [
  ...crown('M', [6, 4, 2, 1, 1, 1, 1]).map((r, i) => (i < 3 ? stamp(r, [HLH - 1, '*M*']) : r)), // a low dome with a comb over it
  stamp(sym(HLH, '..#########', '#'), [2, 'M'], [3, '*']), // one continuous slit, with a glint at its lit end
  sym(HLH, '..#########', '#'),
  sym(HLH, hb(HLH, 2, 'M'), 'M'),
  sym(HLH, hb(HLH, 2, 'M'), 'M'),
  sym(HLH, hb(HLH, 2, 'm'), 'm'),
  stamp(sym(HLH, hb(HLH, 3, 'M'), 'M'), [5, '#'], [8, '#'], [14, '#'], [17, '#']), // breathing holes
  sym(HLH, hb(HLH, 3, 'M'), 'M'),
  sym(HLH, hb(HLH, 4, 'm'), 'm'),
  sym(HLH, hb(HLH, 4, 'M'), 'M'),
  sym(HLH, hb(HLH, 5, 'M'), 'M'),
  sym(HLH, hb(HLH, 6, 'm'), 'm'),
  sym(HLH, hb(HLH, 7, 'M'), 'M'),
];
const HEAD_BASALT = part(basaltHelm, NECK);

// PYRE KNIGHT — the same iron family, a different helm entirely: a KEELED
// brow, a raised centre ridge running the whole dome, and two eye holes
// rather than a slit.
const pyreHeadRows = [
  
    ...crown('M', [7, 5, 3, 2, 2, 2, 2]).map((r, i) => (i > 1 ? stamp(r, [HLH - 1, '***']) : r)), // the keel
    stamp(sym(HLH, hb(HLH, 2, '5'), '5'), [HLH - 1, '***'], [3, '####'], [15, '####']), // the keeled brow, over two deep eye holes
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [HLH - 1, '*m*'], [3, '####'], [15, '####']),
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [HLH - 1, '*m*'], [4, '##'], [16, '##']),
    stamp(sym(HLH, hb(HLH, 2, '5'), '5'), [6, '}'], [9, '}'], [13, '}'], [16, '}']), // a dark bevor under the brow, so the helm reads as two plates
    sym(HLH, hb(HLH, 2, '}'), '}'),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 4, '5'), '5'),
    sym(HLH, hb(HLH, 5, 'M'), 'M'),
    sym(HLH, hb(HLH, 6, 'M'), 'M'),
    sym(HLH, hb(HLH, 7, '5'), '5'),
  ];
const HEAD_PYRE = part(pyreHeadRows, NECK);

// DROWNED KNIGHT — a helm the sea has been through: the crown BROKEN open
// along the top, holes rusted through the cheek, and a ragged lower edge.
const drownedHeadRows = [
  
    stamp(sym(HLH, hb(HLH, 4, 'M'), 'M'), [7, '..'], [12, '.'], [15, '..']), // the crown, broken open
    stamp(sym(HLH, hb(HLH, 3, 'M'), 'M'), [8, '.'], [14, '.']),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'm'), 'm'),
    stamp(sym(HLH, '..#########', '#'), [3, 'M'], [8, 'M'], [14, 'M']), // a slit with the bar rusted out of it
    stamp(sym(HLH, '..#########', '#'), [3, 'M']),
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [6, '5'], [16, '5']), // two water streaks down the cheeks
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [6, '5'], [16, '5']),
    stamp(sym(HLH, hb(HLH, 2, 'm'), 'm'), [6, '}'], [16, '}']),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 4, 'm'), 'm'),
    stamp(sym(HLH, hb(HLH, 4, 'M'), 'M'), [7, '.'], [15, '.']), // and a ragged edge
    sym(HLH, hb(HLH, 5, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 6, 'm'), 'm'), [11, '.']),
    sym(HLH, hb(HLH, 7, 'M'), 'M'),
  ];
const HEAD_DROWNED = part(drownedHeadRows, NECK);

// SABLE — a pointed hood with a TWO-CELL peak and a cowl draping onto the
// shoulders; its interior is pure shadow but for two lit eyes. Nothing else
// of the face reads, ever.
const sableHeadRows = [
  
    sym(HLH, hb(HLH, 10, 'A'), 'A'), // the peak
    sym(HLH, hb(HLH, 9, 'A'), 'A'),
    ...crown('A', [7, 5, 4, 3, 2, 1, 0]),
    sym(HLH, 'AAd3333333', '3'),
    stamp(sym(HLH, 'AA3]]]]]]]', ']'), [HLH - 6, 'GG'], [HLH + 5, 'GG']), // two lit eyes inside a six-cell visor slot
    stamp(sym(HLH, 'AA3]]]]]]]', ']'), [HLH - 6, 'gg'], [HLH + 5, 'gg']),
    sym(HLH, 'AA3]]]]]]]', ']'),
    sym(HLH, 'AAAd333333', '3'),
    sym(HLH, 'AAAAd33333', '3'),
    sym(HLH, hb(HLH, 0, 'A'), 'A'), // the cowl closes and spreads
    sym(HLH, hb(HLH, 0, 'a'), 'a'),
    sym(HLH, hb(HLH, 1, 'A'), 'A'),
    sym(HLH, hb(HLH, 2, 'a'), 'a'),
  ];
const HEAD_SABLE = part(sableHeadRows, NECK);

// LUMEN — long cream-gold hair parted off the brow, a braid down one side,
// falling well past the shoulders (the rows below the neck paint over the
// mantle, since the head layer is always on top).
const lumenCrown = crown('H', [8, 6, 4, 2, 1, 0, 0]);
lumenCrown[4] = stamp(lumenCrown[4], [4, '^^^^^^']);
lumenCrown[5] = stamp(lumenCrown[5], [3, '^^^^']);
const lumenHeadRows = [
  
    ...lumenCrown,
    sym(HLH, 'HH^HHHHH111', '1'),
    sym(HLH, 'HHH^HHH1111', '1'),
    ...faceBlock({ side: 'H', sideDark: '1', mouth: 2, spacing: 1, brow: -1 }),
    stamp(sym(HLH, hb(HLH, 5, 'H'), '.'), [6, '^']),
    stamp(sym(HLH, hb(HLH, 6, 'H'), '.'), [7, 'h']),
    stamp(sym(HLH, hb(HLH, 7, 'H'), '.'), [8, '^']),
    sym(HLH, hb(HLH, 8, 'h'), '.'),
  ];
const HEAD_LUMEN = part(lumenHeadRows, NECK);

// --- Arms and hands -----------------------------------------------------------
// An arms part holds BOTH arms as one layer that lands on the body's shoulder
// seam, so a figure never reads as one-armed — but the two arms are NOT the
// same arm mirrored. The far one hangs from a shoulder dropped a row and ends
// at the hip; the weapon one is carried forward, its elbow bent, its fist
// five rows higher and near the centre line. `weaponGrip` is the centre of
// that raised fist, and every weapon's own grip lands there, which is what
// puts a haft IN a hand and across the body instead of beside one.

const ALH = 13; // arms half-width; composed 27 — one cell proud of a slim body on each side
const PLH = 15; // plated arms: 31, two cells proud of an armoured body on each side
const RLH = 14; // wide robe sleeves: 29

interface ArmOpts {
  /** Sleeve or bare-arm material. */
  arm: string;
  /** Its dark step — the deltoid's underside and the elbow, where the key light does not reach. */
  armDark: string;
  /** Forearm covering — a bracer, a vambrace, a gold cuff, or more sleeve. */
  fore: string;
  /** The one-cell WRIST seam where the covering ends and the hand begins. */
  cuff: string;
  /** Hand material: skin for bare, leather for gloved, metal for a gauntlet. */
  hand: string;
  /** The hand's deep step: its two finger notches. */
  handDeep: string;
}

/**
 * Both arms of a humanoid. `w` is the shoulder width; the limb narrows by one
 * to the elbow and again to the wrist. Every hand is one construction — three
 * cells wide (four in a gauntlet) and four tall, joined by a one-cell wrist in
 * the cuff tone, with two deep FINGER NOTCHES across it — so no character
 * ends an arm in a slab with a stray dot on it.
 */
function armsPart(lh: number, o: ArmOpts, w = 5): PartDef {
  const W = 2 * lh + 1;
  const hw = w <= 5 ? 3 : 4;
  const rows: string[] = [];
  const push = (fp: number, fw: number, fc: string, np: number, nw: number, nc: string): void => {
    rows.push(stanceRow(W, fp, fw, fc, np, nw, nc));
  };
  push(1, w - 1, o.arm, 0, w, o.arm); //  0  the far shoulder drops a row
  push(0, w, o.arm, 0, w, o.arm); //  1
  push(0, w, o.arm, 0, w, o.arm); //  2
  push(0, w, o.armDark, 0, w, o.armDark); //  3  the deltoid's underside
  push(0, w - 1, o.arm, 0, w - 1, o.arm); //  4
  push(0, w - 1, o.arm, 1, w - 1, o.arm); //  5  the weapon arm starts to come in
  push(0, w - 1, o.arm, 2, w - 1, o.arm); //  6
  push(0, w - 1, o.arm, 3, w - 1, o.armDark); //  7  its elbow
  push(0, w - 1, o.arm, 4, w - 1, o.fore); //  8  and the forearm angles across
  push(0, w - 1, o.arm, 5, w - 1, o.fore); //  9
  push(0, w - 1, o.armDark, 6, hw + 1, o.fore); // 10  the far elbow
  push(1, w - 2, o.fore, 6, hw + 1, o.cuff); // 11  the near wrist
  push(1, w - 2, o.fore, 6, hw, o.hand); // 12  the raised fist
  push(1, w - 2, o.fore, 6, hw, o.handDeep); // 13  finger notch
  push(1, w - 2, o.fore, 6, hw, o.hand); // 14
  push(1, w - 2, o.fore, 6, hw, o.handDeep); // 15  finger notch
  push(0, w - 1, o.cuff, 0, 0, '.'); // 16  the far wrist
  push(0, hw, o.hand, 0, 0, '.'); // 17  and its hand, at the hip
  push(0, hw, o.handDeep, 0, 0, '.'); // 18
  push(0, hw, o.hand, 0, 0, '.'); // 19
  push(0, hw, o.handDeep, 0, 0, '.'); // 20
  return part(rows, { hand: { x: lh, y: 0 }, weaponGrip: { x: W - 7 - (hw >> 1), y: 13 } });
}

/**
 * The two finger bands that close OVER a haft. This part is drawn above the
 * weapon and below the head, so the shaft shows between the bands: that gap
 * is the whole difference between a weapon resting against a hand and a
 * weapon held in one.
 */
function fingersPart(hand: string, deep: string): PartDef {
  return part([hand.repeat(3), deep.repeat(3), '...', hand.repeat(3), deep.repeat(3)], { weaponGrip: { x: 1, y: 2 } });
}

// EMBER — bare arms with leather bracers and bare hands.
const ARMS_BARE = armsPart(ALH, { arm: 'S', armDark: '0', fore: 'L', cuff: '4', hand: 'S', handDeep: '(' });
// GALE, SABLE and the cloth-sleeved enemies — a sleeve, a cuff seam, a leather glove.
const ARMS_SLEEVE = armsPart(ALH, { arm: 'C', armDark: '2', fore: 'C', cuff: '4', hand: 'L', handDeep: '{' });
// LUMEN — a sleeve with a gold cuff over a bare drawing hand.
const ARMS_MANTLE = armsPart(ALH, { arm: 'C', armDark: '2', fore: 'A', cuff: '6', hand: 'S', handDeep: '(' });
// BASALT and the knights — pauldrons, vambraces, gauntleted fists.
const ARMS_PLATE = armsPart(PLH, { arm: 'M', armDark: '5', fore: 'M', cuff: '5', hand: 'M', handDeep: '}' }, 7);

const FINGERS_SKIN = fingersPart('S', '(');
const FINGERS_GLOVE = fingersPart('L', '{');
const FINGERS_PLATE = fingersPart('M', '}');

// TIDE and the Pale Saint — wide sleeves converging on two hands CUPPED in
// front of the belly, palms up; the grip is the centre of that cradle, so
// the orb sits in them rather than floating over them.
const ARMS_ROBE = part(
  stampRows(
    bands(RLH, [
      [2, hg(RLH, 0, 6, 'A'), '.'],
      [2, hg(RLH, 1, 6, 'A'), '.'],
      [2, hg(RLH, 2, 6, 'A'), '.'],
      [2, hg(RLH, 3, 6, 'A'), '.'],
      [2, hg(RLH, 4, 6, 'A'), '.'],
      [2, hg(RLH, 5, 6, 'A'), '.'],
      [2, hg(RLH, 6, 6, 'A'), '.'],
      [1, hg(RLH, 7, 6, '6'), '.'], // the sleeve's dark underside
      [2, hb(RLH, 9, '2'), '2'], // cuffs meeting, dark
      [3, hb(RLH, 10, 'S'), 'S'], // cupped palms
      [2, hb(RLH, 11, 'S'), 'S'], // fingers
    ]),
    19,
    21,
    [12, '#'],
    [16, '#'],
  ),
  { hand: { x: RLH, y: 0 }, weaponGrip: { x: RLH, y: 18 } },
);

// --- Weapons ------------------------------------------------------------------
// Weapons are proportionally large — a staff taller than its bearer, a bow
// as tall, a sword about body length, a tower shield about torso size — and
// shaded by the same ramp rules as everything else. Each rests vertically
// with its grip in the lower half, so the idle pose reads as "held ready"
// and the attack rig can rotate it about that grip in 90° steps. Every grip
// row is authored as a WRAPPED section, so the fist that closes over it has
// something to close over.

/**
 * A shaft authored ON A DIAGONAL. Rotation in this pipeline is 90-degree
 * steps, so an angle has to be drawn, not transformed: the shaft steps one
 * cell sideways every few rows, which at two screen pixels per cell reads as
 * a clean lean rather than a stair. `run` is how far the head travels from
 * the heel; everything is placed relative to the shaft centre at that row, so
 * a crown, a grip wrap and a heel cap all stay on the shaft.
 */
function diagonalHaft(h: number, w: number, run: number, paint: (i: number, put: (dx: number, ch: string) => void, off: number) => void): { rows: string[]; off: (i: number) => number } {
  const off = (i: number): number => Math.round(((h - 1 - i) * run) / (h - 1));
  const rows: string[] = [];
  for (let i = 0; i < h; i++) {
    const cells: string[] = new Array(w).fill('.');
    const o = off(i);
    paint(
      i,
      (dx, ch) => {
        const x = o + dx;
        if (x >= 0 && x < w) cells[x] = ch;
      },
      o,
    );
    rows.push(cells.join(''));
  }
  return { rows, off };
}

// STAFF — EMBER: carried across the body on a diagonal, the flame crown out
// past the shoulder and the heel crossing in front of the far knee. 46 cells
// on a 56-cell bearer, which at this angle spans him corner to corner.
const STAFF_FLAME = [1, 3, 5, 7, 7, 9, 9, 7, 5, 3];
const staff = diagonalHaft(46, 20, 14, (i, put) => {
  if (i < STAFF_FLAME.length) {
    const half = (STAFF_FLAME[i] - 1) >> 1;
    for (let k = -half; k <= half; k++) put(1 + k, 'G');
    return;
  }
  if (i < 12) {
    for (let k = 0; k < 3; k++) put(k, i === 10 ? 'A' : '6'); // ferrule
    return;
  }
  const grip = i >= 27 && i <= 33; // the wrap the fist closes on, 2 cells proud of it top and bottom
  for (let k = 0; k < 3; k++) put(k, i >= 44 ? '}' : k === 0 ? '~' : grip ? '{' : k === 2 ? '{' : '4');
});
const STAFF = part(staff.rows, { weaponGrip: { x: staff.off(30) + 1, y: 30 } });

// DAGGER — GALE's drawn blade: SHORT (20 cells, not a plank), a tapered leaf
// blade with a lit edge, a real crossguard, a dark wrapped grip, a pommel.
const DAGGER = part(
  [
    '...M...',
    '..MMM..',
    '..M*M..',
    '.MM*MM.',
    '.MM*MM.',
    '.MM*MM.',
    '.MM*MM.',
    '.MM*Mm.',
    '.MM*Mm.',
    '.mM*Mm.',
    '..M*M..',
    '..MmM..',
    'MMMMMMM', // crossguard
    'mm###mm',
    '..LLL..',
    '..LLL..',
    '..LLL..',
    '..LLL..',
    '.AAAAA.', // pommel
    '.6aaa6.',
  ],
  { weaponGrip: { x: 3, y: 16 } },
);

// DAGGER_SHEATHED — GALE's off-hand blade riding at the hip: "twin daggers"
// without a second arm rig, so it anchors to nothing and travels with the body.
const DAGGER_SHEATHED = part([
  '.MMM.',
  'LLLLL',
  'L444L',
  'LLLLL',
  'L444L',
  'LLLLL',
  'L444L',
  'LLLLL',
  '.LLL.',
  '.lll.',
  '..l..',
]);

// DAGGER_CURVED — SABLE: gripped near the top so the curved blade hangs low
// and sweeps back behind the hip.
const DAGGER_CURVED = part(
  [
    '..LLL..',
    '..LLL..',
    '..LLL..',
    '..LLL..',
    '.MMMMM.',
    '..MMm..',
    '..MM*..',
    '..MM*..',
    '...MM*.',
    '...MM*.',
    '...MMm.',
    '....MM*',
    '....MM*',
    '....MMm',
    '....MM*',
    '.....M*',
    '.....M*',
    '.....Mm',
    '......#',
  ],
  { weaponGrip: { x: 3, y: 2 } },
);

// BOW_TALL — LUMEN: the limbs bow INWARD from a taut string held OUTSIDE the
// silhouette, so the stave crosses her body and the string never crosses her
// face. A wrapped grip at the centre is where the fist closes.
const BOW_H = 44;
const BOW_W = 12;
const bowRows: string[] = [];
for (let i = 0; i < BOW_H; i++) {
  const t = Math.sin((Math.PI * i) / (BOW_H - 1));
  const off = 8 - Math.round(6 * t); // the belly of the bow swings in toward the body
  const cells = new Array(BOW_W).fill('.');
  if (i > 1 && i < BOW_H - 2) cells[BOW_W - 2] = '!'; // the string, outside everything
  const grip = i >= 19 && i <= 25;
  for (let k = 0; k < 3; k++) {
    const x = off + k;
    if (x >= 0 && x < BOW_W) cells[x] = grip ? '4' : k === 0 ? '!' : k === 2 ? '6' : 'A';
  }
  bowRows.push(cells.join(''));
}
const BOW_TALL = part(bowRows, { weaponGrip: { x: 3, y: 22 } });

// ORB — TIDE and the Pale Saint: a sphere of light with a two-cell hotspot
// off centre. Its grip is the BOTTOM centre, so it rests IN two cupped hands.
const OLH = 6;
const ORB = part(
  bands(OLH, [
    [1, hb(OLH, 4, 'G'), 'G'],
    [1, hb(OLH, 2, 'G'), 'G'],
    [1, hb(OLH, 1, 'G'), 'G'],
    [6, hb(OLH, 0, 'G'), 'G'],
    [1, hb(OLH, 1, 'G'), 'G'],
    [1, hb(OLH, 2, 'G'), 'G'],
    [1, hb(OLH, 4, 'G'), 'G'],
  ]),
  { weaponGrip: { x: OLH, y: 11 } },
);

// MACE — BASALT: a flanged head on a short haft, carried on the same diagonal
// as every other haft in the cast so the head clears the pauldron and the
// wrap lands inside the gauntlet.
const MACE_HEAD = [3, 7, 9, 9, 9, 7, 5];
const mace = diagonalHaft(30, 16, 10, (i, put) => {
  if (i < MACE_HEAD.length) {
    const half = (MACE_HEAD[i] - 1) >> 1;
    for (let k = -half; k <= half; k++) put(1 + k, i === 3 ? (k === 0 ? 'A' : 'M') : k === -half ? '*' : k === half ? '5' : 'M');
    return;
  }
  if (i === 7) {
    for (let k = -1; k < 4; k++) put(k, '5'); // the head's dark underside
    return;
  }
  const grip = i >= 19 && i <= 25;
  for (let k = 0; k < 3; k++) put(k, i >= 28 ? '}' : k === 0 ? '~' : grip ? '{' : k === 2 ? '{' : '4');
});
const MACE = part(mace.rows, { weaponGrip: { x: mace.off(22) + 1, y: 22 } });

// SWORD — the knights: about body length, a fullered blade raised on the
// diagonal past the shoulder, a broad crossguard and a wrapped grip.
const sword = diagonalHaft(34, 16, 10, (i, put) => {
  if (i === 0) {
    put(1, 'M');
    return;
  }
  if (i < 25) {
    put(0, 'M'); // the flat
    put(1, '*'); // the fuller, catching the key light down the middle
    put(2, 'M');
    put(3, '5'); // and the dark spine
    return;
  }
  if (i === 25 || i === 26) {
    for (let k = -2; k < 5; k++) put(k, i === 25 ? 'M' : '5'); // crossguard
    return;
  }
  if (i >= 32) {
    for (let k = 0; k < 3; k++) put(k, i === 32 ? 'A' : '6'); // pommel
    return;
  }
  for (let k = 0; k < 3; k++) put(k, k === 0 ? 'L' : '{'); // the wrapped grip
});
const SWORD = part(sword.rows, { weaponGrip: { x: sword.off(29) + 1, y: 29 } });

// TOWER_SHIELD — BASALT: about torso size, a bevelled metal rim around a
// bold element-coloured face, the LOWER CORNERS ROUNDED off and a raised
// three-cell boss at its centre, so it reads as a held object rather than
// more chest.
const TWL = 7; // half-width 7 -> 15 wide, two cells of bevelled rim around an 11-cell face
const towerRows = bands(TWL, [
  [1, hb(TWL, 3, 'M'), 'M'], // the rim, chamfered at the top
  [1, hb(TWL, 2, '*'), '*'],
  [2, hb(TWL, 1, 'M'), 'M'],
  [4, hb(TWL, 0, 'M', 'AAAAA'), 'A'], // a bold element face inside the rim
  [7, hb(TWL, 0, 'M', 'AAAAA'), 'A'],
  [4, hb(TWL, 0, 'M', 'AAAAA'), 'A'],
  [2, hb(TWL, 0, '5', '66666'), '6'], // the underside of both, dark
  [2, hb(TWL, 1, 'M'), 'M'], // and rounded away at the bottom
  [1, hb(TWL, 3, '5'), '5'],
  [1, hb(TWL, 5, '}'), '}'],
]);
const TOWER_SHIELD = part(
  // A three-cell raised boss lit from the upper left, and four rivets in the
  // corners of the face: at fifteen cells across, those two are the whole
  // difference between a shield and a painted door.
  stampRows(stampRows(stampRows(towerRows, 4, 4, [4, '5'], [10, '5']), 17, 17, [4, '5'], [10, '5']), 10, 12, [TWL - 2, '*MM5m']).map((r, i) => (i === 9 || i === 13 ? stamp(r, [TWL - 1, '555']) : r)),
);

// SHIELD — the knights' kite shield: a bevelled rim, an element band, a
// central boss and four rivets, tapering to a point.
const SHL = 6; // half-width 6 -> 13 wide
const shieldRows = bands(SHL, [
  [1, hb(SHL, 3, 'M'), 'M'],
  [1, hb(SHL, 1, '*'), '*'], // the rim catches the key light along its top
  [4, hb(SHL, 0, 'M', 'AAA'), 'A'],
  [4, hb(SHL, 0, 'M', '666'), '6'], // emblem band
  [5, hb(SHL, 0, 'M', 'AAA'), 'A'],
  [2, hb(SHL, 1, 'M'), 'M'],
  [2, hb(SHL, 2, '5'), '5'],
  [2, hb(SHL, 3, '5'), '5'],
  [1, hb(SHL, 4, '}'), '}'],
  [1, hb(SHL, 5, '}'), '}'],
]);
const riveted = stampRows(shieldRows, 2, 2, [2, '5'], [SHL * 2 - 2, '5']);
const SHIELD = part(stampRows(stampRows(riveted, 13, 13, [2, '5'], [SHL * 2 - 2, '5']), 7, 9, [SHL - 1, '*M5']));

// SHIELD_BROKEN — the Drowned Knight's: the same kite split down one side,
// its lower half torn away and the edge notched by barnacles.
const SHIELD_BROKEN = part(
  stampRows(stampRows(shieldRows, 12, 15, [SHL + 2, '.......']), 16, 23, [SHL - 1, '..........']).map((r, i) =>
    i === 5 || i === 9 || i === 13 ? stamp(r, [2, '#'], [SHL + 4, '#']) : i === 11 ? stamp(r, [SHL + 1, '.'], [1, '#']) : r,
  ),
);

// LANTERN — the Crypt Warden: carried by its ring, the glowing body hanging
// BELOW the fist, so its grip is at the top and the arm above it shows.
const LNL = 6;
const LANTERN = part(
  bands(LNL, [
    [3, hb(LNL, 5, 'M'), '.'], // the bail the fist closes on
    [1, hb(LNL, 5, 'M'), 'M'],
    [1, hb(LNL, 4, 'M'), 'M'],
    [1, hb(LNL, 2, 'M'), 'M'], // cap
    [10, hb(LNL, 2, 'M', 'GG'), 'G'], // a metal frame around a glazed body
    [1, hb(LNL, 2, 'M'), 'M'],
    [1, hb(LNL, 3, 'm'), 'm'],
  ]),
  { weaponGrip: { x: LNL, y: 2 } },
);

// CANE — the Marsh Hag: a crooked hook over a knotted shaft, nothing like
// EMBER's straight flame staff.
// The hook is MIRRORED off EMBER's flame staff — it curls the other way, over
// the hag's own shoulder — and the knotted shaft leans on the same diagonal so
// it lands inside her fist rather than beside her hip.
const cane = diagonalHaft(38, 18, 11, (i, put) => {
  if (i === 0) {
    for (let k = -1; k < 4; k++) put(k, 'L');
    return;
  }
  if (i === 1) {
    put(-2, 'L');
    put(-1, 'L');
    put(3, 'L');
    put(4, 'L');
    return;
  }
  if (i === 2) {
    put(-2, '4');
    put(3, 'L');
    put(4, 'L');
    return;
  }
  if (i === 3) {
    put(3, '4');
    put(4, '4');
  }
  const knot = i === 12 || i === 24;
  const grip = i >= 19 && i <= 25;
  for (let k = 0; k < (knot ? 4 : 3); k++) put(knot ? k - 1 : k, i >= 36 ? '{' : knot ? '4' : k === 0 ? '~' : grip ? '{' : k === 2 ? '{' : '4');
});
const CANE = part(cane.rows, { weaponGrip: { x: cane.off(22) + 1, y: 22 } });

// CLAW — the Hollow King (boss scale): a bony wrist and palm at the grip,
// four long talons that HOOK inward at the tip rather than hanging straight.
const CLL = 8;
const clawRows = bands(CLL, [
  [3, hb(CLL, 5, 'B'), 'B'], // wrist
  [5, hb(CLL, 1, 'B'), 'B'], // palm
  [4, hg2(CLL, 1, 2, 5, 2, 'B'), 'B'],
  [5, hg2(CLL, 2, 2, 5, 2, 'B'), '.'],
  [3, hg2(CLL, 3, 2, 5, 2, 'B'), '.'],
  [2, hg2(CLL, 4, 2, 6, 1, 'B'), '.'],
]);
const hooked = [...clawRows, sym(CLL, hg2(CLL, 5, 2, 7, 1, 'B'), '.'), sym(CLL, hg2(CLL, 6, 2, 7, 1, '%'), '.'), sym(CLL, hg2(CLL, 7, 1, 8, 1, '%'), '.')];
const CLAW = part(hooked, { weaponGrip: { x: CLL, y: 2 } });
/** The king's other hand — literally placed, so both arms end in talons. */
const CLAW_LEFT = part(hooked.map((r) => [...r].reverse().join('')));

// --- The collapse: re-authored parts, never a rotated standing sprite ----------
// A death frame is the one pose a rotation cannot fake. Turning the standing
// sprite ninety degrees carries its baked keylines round with it — the light
// then falls from the left of a figure lying on its side, the face is on its
// ear, and every rim highlight points at the floor. So the collapse is drawn:
// a body that has BUCKLED (knees folded under, torso pitched forward over
// them, the whole mass low and wide), a head re-authored FACE DOWN with its
// eyes closed, and the weapon dropped as its own part on the ground line.

/** A layer that is simply gone for a pose — an arms rig under a folded body, a halo over a corpse. */
const EMPTY = part(['.']);

interface FallenOpts {
  /** The garment: its auto, dark and deep steps. */
  g: string;
  dark: string;
  deep: string;
  /** What the legs end in. */
  boot: string;
  bootDeep: string;
}

/**
 * A humanoid collapsed onto its knees and folded forward: the hips are the
 * high point on the right, the back falls away to the left where the head
 * lands well BELOW the standing shoulder row, the hem and its shadow band cut
 * across the middle, and two buckled legs with their soles turned up carry the
 * mass. 34 by 19 — the wide low box the brief asks for — and it shares the
 * material alphabet and the band helpers with the standing body, so it takes
 * the same ramps and the same key light without a second palette.
 */
const FALLEN_TEMPLATE: readonly string[] = [
  '..........................GGGG..',
  '.......................GGGGGGGG.',
  '.....................GGGGGGGGGGG',
  '..................GGGGGGGGGGGGGG',
  '...............GGGGGGGGGGGGGGGGG',
  '............GGGGGGGGGGGGGGGGGGGG',
  '.........GGGGGGGGGGGGGGGGGGGGGG.',
  '.......GGGGGGGGGGGGGGGGGGGGGG...',
  '......GGGGGGGGGGGGGGGGGGGGGG....',
  '.....GGGGGGGGGGGGGGGGGGGGGG.....',
  '....DDGGGGGGGGGGGGGGGGGGGGD.....',
  '.....DDDDDDDDDDDDDDDDDDDDD......',
  '......PPPPPPPPPPPPPPPPPPP.......',
  '.........GGGGGG...GGGGGGG.......',
  '........GGGGGGG..GGGGGGGGG......',
  '........DDDDDDD..DDDDDDDDD......',
  '.......BBBBBBB....BBBBBBBB......',
  '.......BBBBBBB....BBBBBBBB......',
  '......BBBBBBBBB..BBBBBBBBBB.....',
  '......KKKKKKKKK..KKKKKKKKKK.....',
];
function fallenBody(o: FallenOpts): PartDef {
  const rows = FALLEN_TEMPLATE.map((r) => r.replace(/G/g, o.g).replace(/D/g, o.dark).replace(/P/g, o.deep).replace(/B/g, o.boot).replace(/K/g, o.bootDeep));
  // The far arm is flung forward onto the ground past the shoulder — the one
  // limb a folded torso cannot hide, and the read that says "dropped".
  const out = stampRows(stampRows(stampRows(rows, 9, 9, [1, o.g.repeat(4)]), 10, 10, [0, o.dark.repeat(4)]), 11, 11, [1, o.deep.repeat(3)]);
  return { ...part(out), anchors: { head: { x: 6, y: 8 }, hand: { x: 10, y: 8 }, capePin: { x: 14, y: 5 }, feet: { x: 16, y: 19 }, hit: { x: 16, y: 10 } } };
}

/**
 * A head seen from above and in front, chin tucked into the chest: the crown
 * mass is most of it, its underside turns dark where the light no longer
 * reaches, and the face is a foreshortened sliver with two CLOSED eyes. The
 * neck anchor sits at the back of the skull, so the head lands at the fallen
 * body's shoulder end and hangs forward of it.
 */
function fallenHeadRows(o: { crown: string; dark: string; face?: string; eye?: string; deep?: string }): string[] {
  const c = o.crown;
  const d = o.dark;
  const f = o.face ?? c;
  const e = o.eye ?? '#';
  const p = o.deep ?? d;
  return [
    '.....' + c.repeat(9) + '.....',
    '...' + c.repeat(13) + '...',
    '..' + c.repeat(15) + '..',
    '.' + c.repeat(17) + '.',
    c.repeat(19),
    c.repeat(19),
    c.repeat(4) + d.repeat(11) + c.repeat(4),
    '.' + c + d.repeat(15) + c + '.',
    '.' + c + d + f.repeat(13) + d + c + '.',
    '..' + d + f + e.repeat(4) + f.repeat(3) + e.repeat(4) + f + d + '..',
    '..' + d + f.repeat(13) + d + '..',
    '...' + p.repeat(13) + '...',
    '....' + f.repeat(11) + '....',
    '.....' + p.repeat(9) + '.....',
  ];
}
function fallenHead(o: { crown: string; dark: string; face?: string; eye?: string; deep?: string }): PartDef {
  return { ...part(fallenHeadRows(o)), anchors: { head: { x: 15, y: 3 } } };
}

/**
 * A head TILTED for the hurt recoil. Sheared, not rotated: every row is
 * offset by its distance from the neck, and `autoShade` then recomputes the
 * rim and the anchor from the new silhouette — so the light still falls from
 * the upper left and no keyline is left pointing the wrong way.
 */
function headTilt(rows: readonly string[], k = 0.22): PartDef {
  const pad = 6;
  const w = Math.max(...rows.map((r) => r.length)) + 2 * pad;
  const h = rows.length;
  const out = rows.map((r, y) => shiftX(('.'.repeat(pad) + r).padEnd(w, '.'), Math.round((h - 1 - y) * k)));
  return part(out, { head: { x: HLH + pad, y: h - 1 } });
}

/**
 * Nearest-neighbour scaling of a MATERIAL grid. Legitimate here and nowhere
 * else: what is being scaled is which material owns a cell, and `autoShade`
 * then re-derives every rim, plane and fold from the new silhouette — so a
 * boss-scale collapse is the same drawing at the boss's own pixel density,
 * not an upscaled bitmap.
 */
function scaleRows(rows: readonly string[], sx: number, sy: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < Math.round(rows.length * sy); y++) {
    const src = rows[Math.min(rows.length - 1, Math.floor(y / sy))];
    let line = '';
    for (let x = 0; x < Math.round(src.length * sx); x++) line += src[Math.min(src.length - 1, Math.floor(x / sx))];
    out.push(line);
  }
  return out;
}

const FALLEN_EMBER = fallenBody({ g: 'A', dark: '6', deep: '<', boot: '4', bootDeep: '{' });
const FALLEN_GALE = fallenBody({ g: 'A', dark: '6', deep: '<', boot: '4', bootDeep: '{' });
const FALLEN_TIDE = fallenBody({ g: 'A', dark: '6', deep: '<', boot: '6', bootDeep: '<' });
const FALLEN_PLATE = fallenBody({ g: 'M', dark: '5', deep: '}', boot: '5', bootDeep: '}' });
const FALLEN_SABLE = fallenBody({ g: 'A', dark: '6', deep: '<', boot: '4', bootDeep: '{' });
const FALLEN_LUMEN = fallenBody({ g: 'C', dark: '2', deep: '[', boot: '4', bootDeep: '{' });
const FALLEN_HIDE = fallenBody({ g: 'C', dark: '2', deep: '[', boot: '4', bootDeep: '{' });

const HEAD_EMBER_DOWN = fallenHead({ crown: 'H', dark: '1', face: 'S', deep: '(' });
const HEAD_GALE_DOWN = fallenHead({ crown: 'H', dark: '1', face: 'S', deep: '(' });
const HEAD_TIDE_DOWN = fallenHead({ crown: 'C', dark: '2', face: 'S', deep: '(' });
const HEAD_LUMEN_DOWN = fallenHead({ crown: 'H', dark: '1', face: 'S', deep: '(' });
const HEAD_SABLE_DOWN = fallenHead({ crown: 'A', dark: '6', face: ']', eye: ']', deep: ']' });
const HEAD_HELM_DOWN = fallenHead({ crown: 'M', dark: '5', face: 'M', eye: '#', deep: '}' });
const HEAD_HAG_DOWN = fallenHead({ crown: 'C', dark: '2', face: 's', deep: '[' });

/** The two bosses collapse at their own density: the same drawing, half again as large. */
function fallenBoss(o: FallenOpts): PartDef {
  const base = fallenBody(o);
  const rows = scaleRows(FALLEN_TEMPLATE, 1.5, 1.5).map((r) => r.replace(/G/g, o.g).replace(/D/g, o.dark).replace(/P/g, o.deep).replace(/B/g, o.boot).replace(/K/g, o.bootDeep));
  void base;
  return { ...part(rows), anchors: { head: { x: 9, y: 12 }, hand: { x: 15, y: 12 }, capePin: { x: 21, y: 8 }, feet: { x: 24, y: 29 }, hit: { x: 24, y: 15 } } };
}
function fallenHeadBoss(o: { crown: string; dark: string; face?: string; eye?: string; deep?: string }): PartDef {
  const rows = scaleRows(
    fallenHeadRows(o),
    1.6,
    1.6,
  );
  return { ...part(rows), anchors: { head: { x: 24, y: 5 } } };
}
const FALLEN_KING = fallenBoss({ g: 'B', dark: '8', deep: '&', boot: '8', bootDeep: '&' });
const FALLEN_SAINT = fallenBoss({ g: 'C', dark: '2', deep: '[', boot: '2', bootDeep: '[' });
const HEAD_KING_DOWN = fallenHeadBoss({ crown: 'B', dark: '8', face: 'B', eye: '#', deep: '&' });
const HEAD_SAINT_DOWN = fallenHeadBoss({ crown: 'C', dark: '2', face: 'S', deep: '(' });

/**
 * IDLE FOLLOW-THROUGH. The round-2 critic's complaint about the breath was
 * exact: hair, hem and flame were identical between frames, so the torso
 * moved and nothing followed it. A one-cell shear of the crown — a tenth of
 * the tilt a recoil takes — is a hair mass lagging behind a head, and the
 * matching one-cell shift of a hem is a robe lagging behind a hip.
 */
function headSway(rows: readonly string[]): PartDef {
  return headTilt(rows, 0.09);
}
/** A garment's hem, a cell behind the body it hangs on. */
function hemSway(rows: readonly string[], from: number, anchors: Partial<Record<AnchorName, Point>>): PartDef {
  return part(
    rows.map((r, i) => (i >= from ? shiftX(r, 1) : r)),
    anchors,
  );
}

const HEAD_EMBER_TILT = headTilt(emberHeadRows);
const HEAD_GALE_TILT = headTilt(galeHeadRows);
const HEAD_TIDE_TILT = headTilt(tideHeadRows);
const HEAD_BASALT_TILT = headTilt(basaltHelm);
const HEAD_PYRE_TILT = headTilt(pyreHeadRows);
const HEAD_DROWNED_TILT = headTilt(drownedHeadRows);
const HEAD_SABLE_TILT = headTilt(sableHeadRows);
const HEAD_LUMEN_TILT = headTilt(lumenHeadRows);

const HEAD_EMBER_SWAY = headSway(emberHeadRows);
const HEAD_GALE_SWAY = headSway(galeHeadRows);
const HEAD_TIDE_SWAY = headSway(tideHeadRows);
const HEAD_BASALT_SWAY = headSway(basaltHelm);
const HEAD_PYRE_SWAY = headSway(pyreHeadRows);
const HEAD_DROWNED_SWAY = headSway(drownedHeadRows);
const HEAD_SABLE_SWAY = headSway(sableHeadRows);
const HEAD_LUMEN_SWAY = headSway(lumenHeadRows);

const BODY_TIDE_SWAY = hemSway(tideRows, 30, bodyAnchors(BULK, 38, 16));
const BODY_SABLE_SWAY = hemSway(sableBodyRows, 30, bodyAnchors(WIDE, 38, 15));

// --- Capes, cloaks and crests -------------------------------------------------

// SCARF — GALE: pinned at the collar and streaming back the other way from
// the lean. Its pin sits near the far RIGHT of its own grid so the streamer
// lands behind the shoulder — and the grid is only as wide as the tail is
// long, so none of it falls off the bake.
const SCARF = part(
  [
    padRow(19, 13, 'DDDDDD'), // the wrap at the throat
    padRow(19, 12, 'DDDDDDD'),
    padRow(19, 10, 'DDD3DDDDD'), // and then a streamer off the lean, creased along its length
    padRow(19, 8, 'DDD3DDDD'),
    padRow(19, 7, 'DDD3DDD'),
    padRow(19, 5, 'DDD3DDD'),
    padRow(19, 4, 'DD3DDD'),
    padRow(19, 2, 'DDD3DD'),
    padRow(19, 1, 'DD3DD'),
    padRow(19, 1, 'D3DD'),
    padRow(19, 0, 'DD3D'),
    padRow(19, 0, 'D3D'),
    padRow(19, 0, '3]'),
    padRow(19, 0, ']'),
  ],
  { capePin: { x: 17, y: 1 } },
);

// CLOAK_RAGGED / CLOAK_HOLY — the two bosses (boss scale), drawn BEHIND the
// body and authored wider and longer than it so the drape actually shows.
// Same collar and body; only the hem differs — torn strips of uneven length
// for the skeleton king, a clean trimmed edge for the saint. The inner
// lining is a second colour down both leading edges, and both carry fold
// creases from the shoulder down.
const BCL = 24;
const cloakTop: Band[] = [
  [2, hb(BCL, 18, 'C'), 'C'],
  [2, hb(BCL, 14, 'C'), 'C'],
  [2, hb(BCL, 10, 'A'), 'A'],
  [3, hb(BCL, 6, 'A'), 'A'],
  [4, hbf(BCL, 3, 'A', '6', [9, 16]), 'A'],
  [6, hbf(BCL, 1, 'A', '6', [7, 14], 'DD'), 'A'],
  [16, hbf(BCL, 0, 'A', '6', [6, 13], 'DD'), 'A'],
];
const CLOAK_RAGGED = part(
  bands(BCL, [
    ...cloakTop,
    [2, hbf(BCL, 0, 'A', '6', [6, 13], 'DD'), 'A'],
    [3, hg2(BCL, 0, 13, 15, 9, 'A'), 'A'],
    [3, hg2(BCL, 0, 11, 16, 7, 'A'), '.'],
    [3, hg2(BCL, 1, 9, 17, 5, 'a'), '.'],
    [2, hg2(BCL, 2, 7, 18, 4, 'a'), '.'],
    [2, hg2(BCL, 3, 5, 19, 2, 'a'), '.'],
  ]),
  { capePin: { x: BCL, y: 2 } },
);
const CLOAK_HOLY = part(
  // The hem is trimmed, not torn — but it is NOT level: the far side is cut
  // back four cells and the near side hangs four lower, which is most of what
  // stands between a mantle this size and a refrigerator door.
  stampRows(
    bands(BCL, [
      ...cloakTop,
      [18, hbf(BCL, 0, 'A', '6', [6, 13], 'DD'), 'A'],
      [3, hb(BCL, 0, 'C'), 'C'], // trimmed hem
      [4, hb(BCL, 0, '2'), '2'],
    ]),
    47,
    50,
    [0, '.'.repeat(10)],
    [BCL + 6, '2222222222'],
  ),
  { capePin: { x: BCL, y: 2 } },
);

// CROWN — the Hollow King: a jagged band of points with a lit gem.
const CRL = 9;
const CROWN = part([
  sym(CRL, '..A...A..', 'A'),
  sym(CRL, '.AA..AA.A', 'A'),
  sym(CRL, 'AAA.AAAAA', 'A'),
  sym(CRL, 'AAAAAAAAA', 'A'),
  stamp(sym(CRL, hb(CRL, 0, 'A'), 'A'), [CRL - 1, 'G@G']),
  sym(CRL, hb(CRL, 0, 'A'), 'A'),
  sym(CRL, hb(CRL, 0, '6'), '6'),
]);

// HALO — LUMEN and the Pale Saint: a hovering ELLIPSE seen a little from
// above, two tones, the back arc dimmer than the front.
function halo(lh: number): PartDef {
  const bore = lh - 3;
  const solid = (ch: string, pad: number): string => sym(lh, hb(lh, pad, ch), ch);
  const open = (ch: string): string => stamp(solid(ch, 1), [lh - bore, '.'.repeat(2 * bore + 1)]);
  return part([solid('g', 3), open('g'), open('@'), open('@'), solid('@', 2)]);
}
const HALO = halo(9);
const HALO_BOSS = halo(14);

// PLUME — the Pyre Knight's helm crest: an upward flame.
const PLUME = part(
  bands(4, [
    [2, hb(4, 3, 'G'), 'G'], // a tongue of flame, tall enough to spike the silhouette
    [2, hb(4, 2, 'G'), 'G'],
    [3, hb(4, 1, 'G'), 'G'],
    [4, hb(4, 0, 'G'), 'G'],
    [3, hb(4, 1, 'G'), 'G'],
    [1, hb(4, 2, '7'), '7'], // and a dark socket where it meets the helm
    [2, hb(4, 3, '6'), '6'],
  ]),
);

// KELP — the Drowned Knight's crest: waterlogged strands hanging off the
// helm, the same family as PLUME, inverted.
const KELP = part(
  bands(6, [
    [2, hb(6, 0, 'A'), 'A'],
    [3, hb(6, 1, 'A'), 'A'],
    [4, hg2(6, 0, 3, 4, 2, 'A'), 'A'],
    [5, hg2(6, 1, 3, 4, 2, 'A'), '.'],
    [4, hg2(6, 2, 3, 5, 1, 'a'), '.'],
  ]),
);

// --- Enemy heads --------------------------------------------------------------

// HEAD_HAG — a crooked, lopsided hood over a HOOKED profile: the crown
// leans, the nose juts a cell past the cheek and the chin comes up to meet
// it, which reads as "old and bent" before any colour arrives.
const hagFace = faceBlock({ side: 'C', sideDark: '2', skin: 's', brow: 1, spacing: -1, cheek: true, deep: '[' }).map((row, i) => (i < 2 ? stamp(row, [2, 'C'.repeat(19)]) : i > 4 ? shiftX(row, 1) : row));
const hagHeadRows = [
  
    ...crown('C', [9, 7, 5, 4, 3, 2, 1, 0, 0], [-5, -5, -4, -4, -3, -2, -1, 0, 0]),
    ...stampRows(stampRows(hagFace, 3, 4, [15, 'SS']), 6, 6, [14, 'ss']), // the hooked nose and the chin under it
  ];
const HEAD_HAG = part(hagHeadRows, NECK);
const HEAD_HAG_TILT = headTilt(hagHeadRows);
const HEAD_HAG_SWAY = headSway(hagHeadRows);

// HEAD_BRUTE — the Crypt Warden: a FLAT-TOPPED bucket helm, straight-sided,
// with a low slot and two ember slits behind it; no dome, no crest.
const bruteHeadRows = [
  
    sym(HLH, hb(HLH, 2, 'm'), 'm'), // the flat top
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'm'), 'm'),
    sym(HLH, 'CCc2222222', '2'),
    stamp(sym(HLH, 'CCc2222222', '2'), [HLH - 6, 'GGG'], [HLH + 4, 'GGG']),
    sym(HLH, 'CCc2222222', '2'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 1, '5'), '5'), [4, '}'], [18, '}']),
    sym(HLH, hb(HLH, 1, 'm'), 'm'),
    sym(HLH, hb(HLH, 2, 'C'), 'C'),
    sym(HLH, hb(HLH, 3, 'C'), 'C'),
    sym(HLH, hb(HLH, 4, 'c'), 'c'),
    sym(HLH, hb(HLH, 5, 'C'), 'C'),
    sym(HLH, hb(HLH, 7, 'c'), 'c'),
  ];
const HEAD_BRUTE = part(bruteHeadRows, NECK);
const HEAD_BRUTE_TILT = headTilt(bruteHeadRows);
const HEAD_BRUTE_SWAY = headSway(bruteHeadRows);

// --- Monster bodies -----------------------------------------------------------
// Single-part creatures: no head/arms rig, one silhouette per layer, so a
// quadruped or a legless shroud never has to fake a biped skeleton. Each
// name's defining feature — horns, a jaw, a shell, no legs — is authored as
// a one-off graft on a mirrored base, and each carries all four shades of
// its material: a lit rim, a base, a crease and a dark band.

// CINDER_IMP — small, horned, hunched, with a curling tail, a lighter belly
// band and lit eyes.
const IML = 10;
const impRows = bands(IML, [
  [1, hg2(IML, 1, 2, 7, 2, 'B'), '.'], // bone horn tips
  [1, hg2(IML, 1, 3, 6, 3, 'B'), '.'],
  [1, hg2(IML, 1, 3, 6, 3, '8'), '.'], // their dark roots
  [1, hb(IML, 3, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'], // eye rows
  [1, hb(IML, 3, '<'), '<'], // the jaw's cast shadow
  [2, hb(IML, 1, 'A'), 'A'], // hunched shoulders
  [4, hb(IML, 3, 'A'), 'A'],
  [3, hb(IML, 3, 'A', '!!'), 'A'], // belly band, lighter
  [1, hb(IML, 3, '6'), '6'], // and a dark band under it
  [1, hb(IML, 3, '<'), '<'],
  [2, hb(IML, 2, 'A'), 'A'],
  [6, hg(IML, 3, 3, 'A'), '.'], // stubby legs
  [1, hg(IML, 3, 3, '6'), '.'],
  [2, hg(IML, 2, 4, '4'), '.'], // and clawed feet
  [1, hg(IML, 2, 4, '{'), '.'],
]);
impRows[6] = stamp(impRows[6], [5, 'GG'], [14, 'GG']);
impRows[7] = stamp(impRows[7], [6, '#'], [14, '#']);
const IMP_BODY = part(graft(impRows, 17, ['.AAA', '..AAA', '...AAA', '...AAA', '..AAA', '.AAA', 'AAA', '6'], 0), { feet: { x: IML, y: 31 }, hit: { x: IML, y: 15 } });

// Bat wings, spread WIDER than the imp and two shades DOWN from it, so the
// membrane sits behind the body instead of merging into it.
const IWL = 17;
const IMP_WINGS = part(
  bands(IWL, [
    [1, hg(IWL, 0, 3, '3'), '.'],
    [2, hg(IWL, 0, 6, 'd'), '.'],
    [2, hg(IWL, 1, 8, 'd'), '.'],
    [3, hg(IWL, 2, 9, 'd'), '.'],
    [2, hg(IWL, 4, 8, '3'), '.'],
    [2, hg(IWL, 6, 6, '3'), '.'],
    [2, hg(IWL, 8, 4, ']'), '.'], // the membrane falls away into the dark
  ]),
);

// ASH_HOUND — a low, long-bodied quadruped with a heavy head at the front,
// two pricked EARS, a clear shoulder/haunch break and ember cracks glowing
// through the ash-grey hide. Authored as full rows (not mirrored) because a
// head at one end is the whole point of it.
const HOUND_BODY = part(
  [
    '.........................C....C.........',
    '........................CC...CC.........',
    '.......................CCC..CCC.........',
    '.........................CCCCCC.........',
    '..........................CCCCCCCC......',
    '...........CCCCCCCCC...CCCCCCCCCCCCC....',
    '........CCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
    '......CCCCCCCCCCCCCCCCCCCCCGGGGCCCCCCC..',
    '.....CCCCCCCCCCCCCCCCCCCCCGGGGGCCCCCCCC.',
    '....CCCCCCCCCCCCCCCCCCCCCCCC#BBBBBBBB#..',
    '....CCCCCCCCCCCCCCCCCCCCCCCC#BBBBBBB#...',
    '....CCCC2CCCCCCCC2CCCCCCCCCCCCCCCCC.....', // shoulder and haunch breaks
    '....CCCC2CCCCCCCC2CCCCCCCCCCCCCCC.......',
    '.....CCC2CCCCCCCC2CCCCCCCCCCCCC.........',
    '.....[[[[[[[[[[[[[[[[[[[[[[[[[..........', // the belly's own shadow, the hound's dark anchor
    '.....CCCC..CCCC......CCCC..CCCC.........',
    ...rep(5, '.....CCCC..CCCC......CCCC..CCCC.........'),
    ...rep(2, '.....cccc..cccc......cccc..cccc.........'),
    '.....2222..2222......2222..2222.........',
    '.....4444..4444......4444..4444.........',
    '....{{{{{{{{{{{{....{{{{{{{{{{{{........',
  ],
  { feet: { x: 18, y: 25 }, hit: { x: 18, y: 10 } },
);

// DUST_WRAITH — a tall shroud with nothing under it: no legs, a hood whose
// interior is a void with two lit eyes, and a hem that FRAYS the whole way
// round and fades toward the ground rather than ending on a flat edge.
const WRL = 14;
const wraithRows = bands(WRL, [
  [1, hb(WRL, 13, 'C'), 'C'], // hood peak
  [1, hb(WRL, 12, 'C'), 'C'],
  [1, hb(WRL, 11, 'C'), 'C'],
  [1, hb(WRL, 10, 'C'), 'C'],
  [1, hb(WRL, 9, 'C'), 'C'],
  [1, hb(WRL, 8, 'C', '[[['), '['], // the void inside the cowl — a real hole, not a shade
  [3, hb(WRL, 8, 'C', '[[[['), '['],
  [1, hb(WRL, 9, 'C'), 'C'], // the hood closes
  [1, hb(WRL, 11, '2'), '2'], // on a thin dark neck
  [2, hb(WRL, 6, 'A'), 'A'], // shoulders
  [4, hbf(WRL, 4, 'A', '6', [8]), 'A'], // the folds are DARK, not a half-step
  [8, hbf(WRL, 2, 'A', '6', [6, 11]), 'A'], // the shroud at its widest
  [4, hbf(WRL, 3, 'A', '6', [7, 11]), 'A'], // and drawing back in
  [2, hbf(WRL, 3, '6', '<', [7, 11]), '6'], // the bottom rows fade toward the ground
  [2, hb(WRL, 4, '<'), '<'],
  [1, '<<<<66<6666<66', '6'], // and then fray away rather than ending flat
  [1, '...<6<6.66<6<6', '<'],
  [1, '...<6.<.6<<6<.', '6'],
  [1, '....<..<.<6<6.', '<'],
  [1, '.......<..<<..', '<'],
  [1, '..........<...', '.'],
]);
wraithRows[6] = stamp(wraithRows[6], [10, 'GG'], [17, 'GG']);
wraithRows[7] = stamp(wraithRows[7], [10, 'gg'], [17, 'gg']);
const WRAITH_BODY = part(wraithRows, { feet: { x: WRL, y: wraithRows.length - 1 }, hit: { x: WRL, y: 20 } });

// CRYPT_WARDEN — a broad shelled brute: a plate across the chest, heavy
// shoulders, a creased hide skirt, short thick legs.
const BRL = 16;
const W_BRUTE = 2 * BRL + 1;
const bruteTop = bands(BRL, [
  [2, hb(BRL, 13, '2'), '2'], // 0-1  a dark neck under the bucket helm
  [1, hb(BRL, 4, 'M'), 'M'], // 2    shell shoulders
  [3, hb(BRL, 1, 'M'), 'M'], // 3-5
  [2, hb(BRL, 2, '5'), '5'], // 6-7  their dark underside
  [8, hb(BRL, 5, 'C', 'MMMMMMMM'), 'M'], // 8-15 chest plate over hide
  [1, hb(BRL, 5, '4'), 'M'], // 16   belt
  [1, hb(BRL, 5, '{'), '{'], // 17   deep seam
  [6, hbf(BRL, 5, 'C', '2', [9]), 'C'], // 18-23
  [1, hb(BRL, 5, '2'), '2'], // 24   hem band
  [1, hb(BRL, 5, '['), '['], // 25   deep hem
  [5, hg(BRL, 4, 10, 'C'), '.'], // 26-30 thick short legs
]);
const BRUTE_BODY = part(
  [
    ...selfShadow(bruteTop, '[', 2, [8, 15], [5, 27]),
    ...rep(2, stanceRow(W_BRUTE, 4, 9, '[', 4, 10, 'c')), // 31-32
    ...rep(3, stanceRow(W_BRUTE, 3, 10, '4', 3, 11, 'L')), // 33-35 heavy boots
    stanceRow(W_BRUTE, 3, 10, '{', 2, 12, '4'), // 36
    stanceRow(W_BRUTE, 0, 0, '.', 2, 12, '{'), // 37
  ],
  bodyAnchors(BRL, 38, 15),
);

// BOG_TOAD — squat and very wide, two bulging eyes riding on top, a CURVED
// mouth that turns up at the corners, and a pale belly band under it.
const TDL = 17;
const toadRows = bands(TDL, [
  [1, hg(TDL, 5, 6, 'A'), '.'], // two bulging eyes
  [2, hg(TDL, 4, 8, 'A'), '.'],
  [1, hg(TDL, 4, 8, 'a'), '.'],
  [2, hb(TDL, 4, 'A'), 'A'], // brow
  [2, hb(TDL, 2, 'A'), 'A'],
  [4, hb(TDL, 0, 'A'), 'A'], // wide body
  [2, hb(TDL, 0, 'A'), 'A'], // mouth line stamped over this
  [4, hb(TDL, 0, 'A', 'CCCC'), 'C'], // pale belly band
  [1, hb(TDL, 1, '6'), '6'], // the belly's dark underside
  [2, hb(TDL, 4, '<'), '<'], // and the ground shadow it sits in
  [3, hg2(TDL, 2, 4, 10, 4, 'A'), '.'], // squat legs
  [1, hg2(TDL, 2, 4, 10, 4, '6'), '.'],
  [2, hg2(TDL, 1, 5, 9, 5, '4'), '.'],
  [1, hg2(TDL, 1, 5, 9, 5, '{'), '.'],
]);
toadRows[1] = stamp(toadRows[1], [6, '%#'], [26, '#%']); // pupils with a catchlight
toadRows[2] = stamp(toadRows[2], [6, '##'], [26, '##']);
toadRows[11] = stamp(toadRows[11], [4, '##'], [29, '##']); // the mouth turns up at both corners
toadRows[12] = stamp(toadRows[12], [5, '#'.repeat(25)]);
toadRows[5] = stamp(toadRows[5], [6, '!!!!!!!!'], [22, '66']); // the back takes the key light
toadRows[6] = stamp(toadRows[6], [4, '!!!!!!'], [25, '66']);
for (let i = 7; i < 11; i++) toadRows[i] = stamp(toadRows[i], [2 + i, '6']); // and a crease runs eye to hip
const TOAD_BODY = part(toadRows, { feet: { x: TDL, y: 27 }, hit: { x: TDL, y: 13 } });

// FROST_WISP — a tall crystalline shard trailing a tail of motes, nothing
// like FEN_FIRE's flame lick. Its core is deliberately capped at a two-cell
// hotspot: everything else falls to the glow ramp's cooler shades, so it
// reads as lit rather than blown out.
const WSL = 8;
const wispRows = bands(WSL, [
  [1, hb(WSL, 7, '6'), '6'], // spire, its dark facet edge
  [2, hb(WSL, 6, 'A'), 'A'],
  [1, hb(WSL, 5, '7'), '7'], // the shard's shadowed shoulder
  [1, hb(WSL, 4, 'g'), 'g'],
  [1, hb(WSL, 2, 'g'), 'g'],
  [1, hb(WSL, 1, 'G'), 'G'],
  [4, hb(WSL, 0, 'G'), 'G'], // the crystal at its widest
  [1, hb(WSL, 1, 'G'), 'G'],
  [1, hb(WSL, 2, '7'), '7'], // a dark facet across the belly of it
  [1, hb(WSL, 3, 'g'), 'g'],
  [1, hb(WSL, 4, '7'), '7'],
  [2, hb(WSL, 5, '6'), '6'],
  [1, hb(WSL, 6, '<'), '<'],
  [1, hg(WSL, 6, 2, 'g'), '.'], // the tail trails away in motes
  [1, hg(WSL, 7, 1, 'g'), '.'],
  [1, hg(WSL, 6, 2, '6'), '.'],
  [2, hg(WSL, 7, 1, '6'), '.'],
  [1, hg(WSL, 7, 1, '<'), '.'],
  [2, hg(WSL, 7, 1, '6'), '.'],
  [1, hg(WSL, 7, 1, '<'), '.'],
]);
// A two-cell hotspot inside a mid-cyan ring: the core reads as lit rather
// than blown out because the ring around it is two steps down, not one.
const WISP_BODY = part(stampRows(stampRows(wispRows, 8, 8, [WSL - 2, 'g@@@g']), 9, 10, [WSL - 1, '@@@']), { feet: { x: WSL, y: 26 }, hit: { x: WSL, y: 10 } });

// SILT_CRAB — a ROUNDED carapace low to the ground, two silt-brown arms
// (never steel) two cells thick reaching up and out into open pincers, and
// stalked eyes on the shell.
const CBL = 20;
const crabRows = bands(CBL, [
  [3, 'AAAAAA..............', '.'], // upper jaw of the pincer
  [2, 'AAAA................', '.'], // the pincer stands open
  [3, 'AAAAAA..............', '.'], // lower jaw
  [1, '.AAAAA..............', '.'],
  [1, '..AAAA.....AAAAAAAAA', 'A'], // the shell starts between the arms
  [1, '...AAA...AAAAAAAAAAA', 'A'],
  [1, '...AAA.AAAAAAAAAAAAA', 'A'],
  [1, '...AA.AAAAAAAAAAAAAA', 'A'],
  [3, '...AAAAAAAAAAAAAAAAA', 'A'], // rounded shell
  [1, '...AAAAA6666666666AA', '6'], // a seam across the carapace
  [3, '...AAAAAAAAAAAAAAAAA', 'A'],
  [1, '....AAAAAAAAAAAAAAAA', 'A'],
  [2, '.....666666666666666', '6'], // the shell's dark underside
  [1, '......<<<<<<<<<<<<<<', '<'],
  [2, hg2(CBL, 5, 3, 11, 3, '4'), '.'], // legs
  [1, hg2(CBL, 5, 3, 11, 3, '{'), '.'],
  [2, hg2(CBL, 4, 3, 10, 3, '4'), '.'],
  [1, hg2(CBL, 4, 3, 10, 3, '{'), '.'],
]);
const crabEyed = stampRows(stampRows(crabRows, 13, 13, [15, 'GG'], [24, 'GG']), 14, 15, [15, 'GG'], [24, 'GG']); // stalked eyes
const CRAB_BODY = part(crabEyed, { feet: { x: CBL, y: 29 }, hit: { x: CBL, y: 17 } });

// FEN_FIRE — a flame lick, not an egg: two tongues cut out of the top
// silhouette and a dark core, so the shape reads as fire even in one frame.
const FFL = 8;
const fenRows = bands(FFL, [
  [1, hb(FFL, 7, 'g'), '.'],
  [1, hb(FFL, 6, 'g'), '.'],
  [1, hb(FFL, 5, 'g'), 'g'],
  [2, hb(FFL, 4, 'g'), 'g'],
  [2, hb(FFL, 3, 'g'), 'g'],
  [2, hb(FFL, 2, 'G'), 'G'],
  [2, hb(FFL, 2, 'g'), 'g'],
  [2, hb(FFL, 1, 'G'), 'G'],
  [3, hb(FFL, 1, 'g'), 'g'],
  [2, hb(FFL, 2, '7'), '7'], // the flame's own shadow, under the light
  [1, hb(FFL, 3, '7'), '7'],
  [2, hb(FFL, 3, '>'), '>'], // and the ember it burns from
  [2, hg(FFL, 4, 2, '>'), '.'],
  [1, hg(FFL, 5, 1, '>'), '.'],
  [2, hg(FFL, 5, 1, '7'), '.'],
]);
// The core is raised two steps and set LOW and LEFT of the flame's centre,
// where a real flame is hottest, rather than dead centre where it reads as an egg.
const FENFIRE_BODY = part(
  stampRows(stampRows(fenRows, 0, 4, [5, '.'], [11, '.']), 10, 12, [FFL - 2, '@@@']).map((r, i) => (i === 2 ? stamp(r, [7, 'g'], [9, 'g']) : r)),
  { feet: { x: FFL, y: 25 }, hit: { x: FFL, y: 12 } },
);

// --- Boss-scale bodies and heads ----------------------------------------------
// Authored for the 96-cell boss canvas. The two bosses share no silhouette:
// the Hollow King is BONE — a ribcage you can see daylight through, two long
// bone arms and long separated legs, with negative space as its identity —
// while the Pale Saint is an unbroken robed mass with a flared hem.
// Crown-and-claws versus halo-and-orb is the second read, not the first.

const KBL = 20; // boss body half-width → 41
const KHL = 15; // boss head half-width → 31

// Six rib PAIRS: each rib starts near the spine and sweeps DOWN AND OUT (the
// lower of its two rows is the wider), and each pair is shorter than the one
// above, so the cage tapers to the pelvis instead of reading as a radiator.
const kingRibs: string[] = [];
for (const pad of [3, 3, 4, 5, 6, 8]) {
  kingRibs.push(stamp(sym(KBL, hb(KBL, pad + 3, 'B'), 'B'), [KBL - 1, 'B%B']));
  kingRibs.push(stamp(sym(KBL, hb(KBL, pad, 'B'), 'B'), [KBL - 1, 'B%B']));
  kingRibs.push(stamp(sym(KBL, hb(KBL, KBL - 3, '&'), '&'), [KBL - 1, '8%8'])); // the dark between two ribs, and the sternum lit down the middle of it
}
const kingRows = [
  ...bands(KBL, [
    [2, hb(KBL, 16, 'B'), 'B'], // neck vertebrae
    [1, hb(KBL, 6, 'B'), 'B'], // clavicle
    [2, hb(KBL, 2, 'B'), 'B'], // shoulder girdle, the widest bone
    [1, hb(KBL, 3, 'b'), 'b'],
  ]),
  ...kingRibs,
  ...bands(KBL, [
    [2, hb(KBL, 14, 'B'), 'B'], // lumbar spine
    [3, hb(KBL, 7, 'B'), 'B'], // pelvis
    [2, hb(KBL, 10, '#'), '#'], // hip sockets
    [22, hg(KBL, 7, 6, 'B'), '.'], // long separated legs
    [3, hg(KBL, 6, 7, 'B'), '.'],
    [2, hg(KBL, 5, 8, 'b'), '.'],
  ]),
];
// Both arms, hanging clear of the cage from the shoulder girdle to the hip —
// the king is not a one-armed skeleton.
const kingShaded = stampRows(stampRows(stampRows(kingRows, 2, 3, [14, '&'.repeat(13)]), 5, 24, [0, 'BBB'], [38, 'BBB']), 5, 24, [3, '&'], [37, '&']);
const KING_BODY = part(stampRows(kingShaded, 25, 26, [1, 'BB'], [38, 'BB']), {
  head: { x: KBL, y: 0 },
  hand: { x: KBL, y: 4 },
  weaponGrip: { x: 38, y: 25 },
  capePin: { x: KBL, y: 3 },
  feet: { x: KBL, y: kingRows.length - 1 },
  hit: { x: KBL, y: 28 },
});

const kingHeadRows = bands(KHL, [
  [1, hb(KHL, 10, 'B'), 'B'],
  [1, hb(KHL, 8, 'B'), 'B'],
  [1, hb(KHL, 6, 'B'), 'B'],
  [1, hb(KHL, 4, 'B'), 'B'],
  [1, hb(KHL, 3, 'B'), 'B'],
  [4, hb(KHL, 2, 'B'), 'B'],
  [3, hb(KHL, 1, 'B'), 'B'], // brow ridge, sockets below it
  [3, hb(KHL, 1, 'B'), 'B'],
  [2, hb(KHL, 3, 'B'), 'B'], // cheekbones
  [2, hb(KHL, 5, 'B'), 'B'], // nasal
  [1, hb(KHL, 4, '#'), '#'], // mouth shadow
  [2, hb(KHL, 4, 'B'), 'B'], // bared teeth
  [2, hb(KHL, 5, 'B'), 'B'],
  [2, hb(KHL, 6, 'b'), 'b'],
  [2, hb(KHL, 8, 'b'), 'b'],
]);
kingHeadRows[9] = stamp(kingHeadRows[9], [5, '######'], [20, '######']);
kingHeadRows[10] = stamp(kingHeadRows[10], [5, '#G@GG#'], [20, '#GG@G#']);
kingHeadRows[11] = stamp(kingHeadRows[11], [5, '#g##g#'], [20, '#g##g#']);
kingHeadRows[12] = stamp(kingHeadRows[12], [6, '####'], [21, '####']);
kingHeadRows[15] = stamp(kingHeadRows[15], [13, 'b##b'], [0, '']); // the nasal cavity
kingHeadRows[20] = stamp(kingHeadRows[20], [9, '#'], [12, '#'], [15, '#'], [18, '#'], [21, '#']);
kingHeadRows[21] = stamp(kingHeadRows[21], [9, '#'], [12, '#'], [15, '#'], [18, '#'], [21, '#']);
const KING_HEAD = part(kingHeadRows, { head: { x: KHL, y: 27 } });

// The Pale Saint: a pale mantle with a gold placket, sash, collar and hem —
// the gold is trim on white, never the whole garment — creased down its
// length, an off-centre medallion, and a hem that FLARES four cells past the
// robe so the figure ends in a skirt rather than a fridge door.
const saintTop = bands(KBL, [
  [2, hb(KBL, 16, 'S'), 'S'], // neck
  [1, hb(KBL, 10, '6'), '6'], // a dark gold collar
  [2, hb(KBL, 6, 'C'), 'C'], // mantle shoulders
  [1, hb(KBL, 7, '2'), '2'],
  [6, hb(KBL, 4, 'C', '6A'), 'C'], // mantle, gold placket down the front
  [1, hb(KBL, 4, '6'), '6'], // sash
  [1, hb(KBL, 4, '['), '['], // the deep seam under it
  [8, hbf(KBL, 3, 'C', '2', [8, 14], '6A'), 'C'],
  [3, hbf(KBL, 2, 'C', '2', [7, 13], '6A'), 'C'],
  [14, hbf(KBL, 1, 'C', '2', [6, 12], '6A'), 'C'],
  [14, hbf(KBL, 0, 'C', '2', [5, 11], '6A'), 'C'],
  [4, hbf(KBL, 0, 'C', '2', [4, 10], '6A'), 'C'], // and flares
  [3, hb(KBL, 0, '6'), '6'], // gold hem
  [2, hb(KBL, 0, '['), '['],
]);
// The far half of the mantle turns away from the key light in a four-cell
// dark band, and the hem's shadow pools under it: a robe this size reads as a
// refrigerator door until something inside it is dark.
const saintShaded = stampRows(stampRows(saintTop, 2, 3, [14, '['.repeat(13)]), 5, 16, [6, '['], [34, '[']); // the chin's cast shadow, and an under-arm seam down each side
const saintRows = stampRows(stampRows(saintShaded, 14, 55, [30, '2222']), 56, 61, [4, '22222222']);
const SAINT_BODY = part(stampRows(saintRows, 11, 13, [KBL - 5, 'AAA'], [KBL - 4, 'A!A']), {
  head: { x: KBL, y: 0 },
  hand: { x: KBL, y: 3 },
  weaponGrip: { x: KBL, y: 30 },
  capePin: { x: KBL, y: 2 },
  feet: { x: KBL, y: saintRows.length - 1 },
  hit: { x: KBL, y: 30 },
});

const saintHeadRows = bands(KHL, [
  [1, hb(KHL, 10, 'C'), 'C'], // veil crown
  [1, hb(KHL, 8, 'C'), 'C'],
  [1, hb(KHL, 6, 'C'), 'C'],
  [1, hb(KHL, 4, 'C'), 'C'],
  [2, hb(KHL, 2, 'C'), 'C'],
  [4, hb(KHL, 1, 'C'), 'C'],
  [1, hb(KHL, 1, 'C'), 'C'],
  [3, '.CCCSSSSSSSSSSS', 'S'], // the veil parts over the brow
  [3, '.CCCSSSSSSSSSSS', 'S'], // a real eye cluster
  [3, '.CCCSSSSSSSSSSS', 'S'],
  [2, '.CCCCSSSSSSSSSS', 'S'],
  [2, hb(KHL, 3, 'C'), 'C'], // the veil closes under the chin
  [3, hb(KHL, 5, 'C'), 'C'],
  [1, hb(KHL, 8, 'c'), 'c'],
]);
const SAINT_HEAD = part(
  stampRows(
    stampRows(stampRows(saintHeadRows, 14, 14, [7, '####'], [20, '####']), 15, 15, [7, '#$$#'], [20, '#$$#']),
    16,
    16,
    [8, '##'],
    [21, '##'],
  ).map((r, i) => (i === 19 ? stamp(r, [12, 'sssssss']) : r)), // chin shadow
  { head: { x: KHL, y: 27 } },
);

// The Pale Saint's sleeves: the same cradle as TIDE's, at boss width.
const SLH = 19;
const ARMS_ROBE_BOSS = part(
  stampRows(
    bands(SLH, [
      [3, hg(SLH, 0, 8, 'C'), '.'],
      [3, hg(SLH, 1, 8, 'C'), '.'],
      [3, hg(SLH, 3, 8, 'C'), '.'],
      [3, hg(SLH, 5, 8, 'C'), '.'],
      [3, hg(SLH, 7, 8, 'C'), '.'],
      [3, hg(SLH, 9, 8, 'C'), '.'],
      [2, hg(SLH, 11, 8, '2'), '.'], // the sleeve's dark underside
      [3, hb(SLH, 13, '6'), '6'], // gold cuffs meeting, dark
      [4, hb(SLH, 14, 'S'), 'S'], // cupped palms
      [2, hb(SLH, 15, 'S'), 'S'],
    ]),
    28,
    30,
    [16, '#'],
    [22, '#'],
  ),
  { hand: { x: SLH, y: 0 }, weaponGrip: { x: SLH, y: 22 } },
);

// CLOAK_SHORT — SABLE: a hero-scale drape hung behind the body, wider and
// longer than it so a cloak silhouette actually shows past the shoulders and
// below the hem; the lining is a second colour down both leading edges and
// the whole thing is creased.
const SCL = 17;
const CLOAK_SHORT = part(
  bands(SCL, [
    [1, hb(SCL, 13, 'D'), 'D'], // collar
    [2, hb(SCL, 10, 'D'), 'D'],
    [2, hb(SCL, 6, 'D'), 'D'],
    [3, hbf(SCL, 3, 'D', '3', [7]), 'D'],
    [5, hbf(SCL, 1, 'D', '3', [5, 11]), 'D'],
    [12, hbf(SCL, 0, 'D', '3', [4, 10]), 'D'],
    [4, hbf(SCL, 1, 'D', '3', [5, 11]), 'D'],
    [2, hb(SCL, 2, 'd'), 'd'],
    [1, hg2(SCL, 2, 6, 10, 5, 'd'), 'd'], // a torn hem
    [1, hg2(SCL, 3, 4, 11, 3, '3'), '.'],
  ]),
  { capePin: { x: SCL, y: 1 } },
);

// --- Library ------------------------------------------------------------------

export const PART_LIBRARY = {
  // hero bodies
  body_ember: BODY_EMBER,
  body_gale: BODY_GALE,
  body_tide: BODY_TIDE,
  body_basalt: BODY_BASALT,
  body_sable: BODY_SABLE,
  body_lumen: BODY_LUMEN,
  body_brute: BRUTE_BODY,
  // heads
  head_ember: HEAD_EMBER,
  head_gale: HEAD_GALE,
  head_tide: HEAD_TIDE,
  head_basalt: HEAD_BASALT,
  head_pyre: HEAD_PYRE,
  head_drowned: HEAD_DROWNED,
  head_sable: HEAD_SABLE,
  head_lumen: HEAD_LUMEN,
  head_hag: HEAD_HAG,
  head_brute: HEAD_BRUTE,
  // arms
  arms_bare: ARMS_BARE,
  arms_sleeve: ARMS_SLEEVE,
  arms_mantle: ARMS_MANTLE,
  arms_plate: ARMS_PLATE,
  arms_robe: ARMS_ROBE,
  arms_robe_boss: ARMS_ROBE_BOSS,
  fingers_skin: FINGERS_SKIN,
  fingers_glove: FINGERS_GLOVE,
  fingers_plate: FINGERS_PLATE,
  // the collapse
  empty: EMPTY,
  fallen_ember: FALLEN_EMBER,
  fallen_gale: FALLEN_GALE,
  fallen_tide: FALLEN_TIDE,
  fallen_plate: FALLEN_PLATE,
  fallen_sable: FALLEN_SABLE,
  fallen_lumen: FALLEN_LUMEN,
  fallen_hide: FALLEN_HIDE,
  fallen_king: FALLEN_KING,
  fallen_saint: FALLEN_SAINT,
  head_king_down: HEAD_KING_DOWN,
  head_saint_down: HEAD_SAINT_DOWN,
  head_ember_down: HEAD_EMBER_DOWN,
  head_gale_down: HEAD_GALE_DOWN,
  head_tide_down: HEAD_TIDE_DOWN,
  head_lumen_down: HEAD_LUMEN_DOWN,
  head_sable_down: HEAD_SABLE_DOWN,
  head_helm_down: HEAD_HELM_DOWN,
  head_hag_down: HEAD_HAG_DOWN,
  head_ember_tilt: HEAD_EMBER_TILT,
  head_gale_tilt: HEAD_GALE_TILT,
  head_tide_tilt: HEAD_TIDE_TILT,
  head_basalt_tilt: HEAD_BASALT_TILT,
  head_pyre_tilt: HEAD_PYRE_TILT,
  head_drowned_tilt: HEAD_DROWNED_TILT,
  head_sable_tilt: HEAD_SABLE_TILT,
  head_lumen_tilt: HEAD_LUMEN_TILT,
  head_hag_tilt: HEAD_HAG_TILT,
  head_brute_tilt: HEAD_BRUTE_TILT,
  head_ember_sway: HEAD_EMBER_SWAY,
  head_gale_sway: HEAD_GALE_SWAY,
  head_tide_sway: HEAD_TIDE_SWAY,
  head_basalt_sway: HEAD_BASALT_SWAY,
  head_pyre_sway: HEAD_PYRE_SWAY,
  head_drowned_sway: HEAD_DROWNED_SWAY,
  head_sable_sway: HEAD_SABLE_SWAY,
  head_lumen_sway: HEAD_LUMEN_SWAY,
  head_hag_sway: HEAD_HAG_SWAY,
  head_brute_sway: HEAD_BRUTE_SWAY,
  body_tide_sway: BODY_TIDE_SWAY,
  body_hag: BODY_HAG,
  body_hag_sway: BODY_HAG_SWAY,
  body_sable_sway: BODY_SABLE_SWAY,
  // weapons
  staff: STAFF,
  dagger: DAGGER,
  dagger_sheathed: DAGGER_SHEATHED,
  dagger_curved: DAGGER_CURVED,
  bow_tall: BOW_TALL,
  orb: ORB,
  mace: MACE,
  sword: SWORD,
  tower_shield: TOWER_SHIELD,
  shield: SHIELD,
  shield_broken: SHIELD_BROKEN,
  lantern: LANTERN,
  cane: CANE,
  claw: CLAW,
  claw_left: CLAW_LEFT,
  // capes and crests
  scarf: SCARF,
  cloak_short: CLOAK_SHORT,
  cloak_ragged: CLOAK_RAGGED,
  cloak_holy: CLOAK_HOLY,
  crown: CROWN,
  halo: HALO,
  halo_boss: HALO_BOSS,
  plume: PLUME,
  kelp: KELP,
  // monsters
  imp_body: IMP_BODY,
  imp_wings: IMP_WINGS,
  hound_body: HOUND_BODY,
  wraith_body: WRAITH_BODY,
  toad_body: TOAD_BODY,
  wisp_body: WISP_BODY,
  crab_body: CRAB_BODY,
  fenfire_body: FENFIRE_BODY,
  // boss scale
  king_body: KING_BODY,
  king_head: KING_HEAD,
  saint_body: SAINT_BODY,
  saint_head: SAINT_HEAD,
} satisfies Record<string, PartDef>;

export type PartId = keyof typeof PART_LIBRARY;

/** Cell width/height of a part's own grid (before any pose rotation). */
export function partSize(id: PartId): { w: number; h: number } {
  const p = PART_LIBRARY[id];
  return { w: p.w, h: p.h };
}
