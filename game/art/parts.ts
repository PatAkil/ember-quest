// Ember Quest v3 — game/art/parts.ts
//
// The shared ASCII part library for the layered-actor pipeline (DESIGN.md →
// Presentation → Layered actors). Pure data: no engine import, no DOM.
//
// ART DIRECTION (v3.2, the Octopath Traveler pass). Every part is authored
// as flat MATERIAL regions; the shading is computed here, once, at module
// load, so a hundred silhouettes share one light. The rules, in the order
// the pass applies them:
//
//   1. PROPORTIONS — about three heads tall. A hero is 48 cells composed:
//      a 17-cell head, 21 cells wide and mostly hair mass, over a 32-cell
//      body (2 neck, 17 torso, 13 leg and boot). Hands are mitts. Faces are
//      a 2x2 dark eye cluster each side with a one-cell catchlight, a hair
//      shadow across the brow and a single cell of mouth.
//   2. RAMPS — nine materials (skin, hair, cloth, cloth2, leather, metal,
//      accent, glow, bone), each a FOUR-SHADE ramp: 0 darkest → 3 lightest,
//      hue-shifted (shadows cooler, highlights warmer). actors.ts owns the
//      colours; a part only ever names a material and, where it matters, an
//      explicit shade.
//   3. SHADING — `autoShade` below. One key light from the top-left:
//      every region gets a dark rim (shade 0) where it meets the
//      background, ONE cell of the material's lightest shade just inside
//      the top-left of that rim, a shadow band just inside the bottom-right,
//      and the base tone everywhere else. Material boundaries inside a part
//      (a belt over a tunic, a trim down a vest) get the same one-cell
//      light/shadow step, which is what makes trims, hems and buckles read.
//      Glow inverts the rule — brightest in the core, dimmest at the edge —
//      so a flame or an orb looks lit rather than outlined.
//   4. OUTLINES are therefore selective and per-material: shade 0 of the
//      material that owns the edge, never one global black keyline, and
//      never between two shades of the same material. `#` (a dark navy ink)
//      is reserved for hand-placed features: eyes, mouths, visor slits,
//      the seam under a belt.
//
// Authoring alphabet (one char per cell):
//   '.' or ' '  transparent            '#'  ink (dark navy)
//   material    auto      shadow(1)    light(3)    dark(0)
//   skin        S         s            $           0
//   hair        H         h            ^           1
//   cloth       C         c            +           2
//   cloth2      D         d            =           3
//   leather     L         l            ~           4
//   metal       M         m            *           5
//   accent      A         a            !           6
//   glow        G         g            @           7
//   bone        B         b            %           8
// "auto" means "let `autoShade` decide" and is what most cells are; the
// explicit shades are for folds, strand notches, catchlights and trim.
//
// Anchors are named cell points in the part's OWN local grid (row 0, col 0 =
// its top-left). actors.ts composes a recipe by landing one part's named
// anchor exactly on an already-placed part's same-named anchor — a weapon's
// `weaponGrip` on the arms' `weaponGrip` — which is what keeps a weapon in a
// hand across every pose keyframe, rotations included.

// --- Materials ----------------------------------------------------------------

/** A material role, never a literal colour: actors.ts resolves (material, shade) → hex through the recipe's palette. */
export type Material = 'skin' | 'hair' | 'cloth' | 'cloth2' | 'leather' | 'metal' | 'accent' | 'glow' | 'bone';

/** Four shades of one material, darkest → lightest. */
export type Ramp = readonly [string, string, string, string];

/** Index order is the wire format between this module and actors.ts (`PartDef.mat` holds these). */
export const MATERIALS: readonly Material[] = ['skin', 'hair', 'cloth', 'cloth2', 'leather', 'metal', 'accent', 'glow', 'bone'];

export const MAT_EMPTY = -1;
/** A hand-placed dark-navy feature line (eyes, a visor slit, the seam under a belt) — the one colour that is not part of a material ramp. */
export const MAT_INK = -2;
const AUTO = -1;

interface CharDef {
  mat: number;
  shade: number;
}

const CHARS: Record<string, CharDef> = { '#': { mat: MAT_INK, shade: 0 } };
// auto / shadow / light / dark, per material, in MATERIALS order.
const CHAR_ROWS: readonly string[] = ['Ss$0', 'Hh^1', 'Cc+2', 'Dd=3', 'Ll~4', 'Mm*5', 'Aa!6', 'Gg@7', 'Bb%8'];
for (let m = 0; m < CHAR_ROWS.length; m++) {
  const [auto, shadow, light, dark] = [...CHAR_ROWS[m]];
  CHARS[auto] = { mat: m, shade: AUTO };
  CHARS[shadow] = { mat: m, shade: 1 };
  CHARS[light] = { mat: m, shade: 3 };
  CHARS[dark] = { mat: m, shade: 0 };
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
 * arms; `weaponGrip` is the fist on an arms part and the handle on a
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
 * One key light from the top-left, applied to a whole part at module load.
 * A cell touching transparency is the material's own dark rim; one cell
 * further in it is the material's lightest shade on the top-left faces and
 * its shadow on the bottom-right; a material CHANGE inside the part gets the
 * same one-cell step, which is what makes a belt sit on a tunic and a trim
 * sit on a vest. Glow inverts (bright core, dim edge) so lit things read lit.
 */
function autoShade(w: number, h: number, mat: Int8Array, shade: Int8Array): void {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? MAT_EMPTY : mat[y * w + x]);
  const empty = (x: number, y: number): boolean => at(x, y) === MAT_EMPTY;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mat[i];
      if (m < 0 || shade[i] !== AUTO) continue;
      const rim = empty(x, y - 1) || empty(x, y + 1) || empty(x - 1, y) || empty(x + 1, y);
      if (m === GLOW) {
        // A flame or an orb: hottest in the middle, falling off outward.
        shade[i] = rim ? 1 : empty(x - 2, y) || empty(x + 2, y) || empty(x, y - 2) || empty(x, y + 2) ? 2 : 3;
        continue;
      }
      if (rim) {
        shade[i] = 0;
        continue;
      }
      // A left-facing plane catches the key light; a right-facing one falls
      // away from it; and anything sitting UNDER another material — a skirt
      // under a belt, a hem under a trim — takes that material's cast shadow.
      const lit = at(x - 1, y) !== m || empty(x - 2, y) || empty(x, y - 2) || empty(x - 1, y - 1);
      const shd = at(x + 1, y) !== m || at(x, y - 1) !== m || at(x, y + 1) !== m || empty(x + 2, y) || empty(x, y + 2) || empty(x + 1, y + 1);
      shade[i] = shd && !lit ? 1 : lit && !shd ? 3 : 2;
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
  for (let i = 0; i < shade.length; i++) if (shade[i] === AUTO) shade[i] = 2;
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
/** `mid` placed `lead` cells into a `width`-wide blank row — one-off asymmetric appendages (a tail, a jaw, a scarf tail). */
function padRow(width: number, lead: number, mid: string): string {
  return ('.'.repeat(lead) + mid).slice(0, width).padEnd(width, '.');
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
// POSE_FPS 12 and doubled the anchor bookkeeping). Every hero body is 32
// rows: 2 neck, 17 of torso, 13 of leg and boot — which, under a 16-cell
// head overlapping the neck by one, composes a 47-cell figure that is almost
// exactly three heads tall. Widths differ by build: 23 for the slim three,
// 25 for the cloaked, 27 for the robed and the armoured.

const SLIM = 11; // half-width; composed width 2·SLIM + 1 = 23
const WIDE = 12; // 25
const BULK = 13; // 27

/** The five anchors every biped body shares: neck at the top centre, shoulder seam, cape collar, ground contact, centre mass. */
function bodyAnchors(lh: number, h: number, hitY: number): Partial<Record<AnchorName, Point>> {
  return { head: { x: lh, y: 0 }, hand: { x: lh, y: 3 }, capePin: { x: lh, y: 2 }, feet: { x: lh, y: h - 1 }, hit: { x: lh, y: hitY } };
}

// EMBER — a short leather vest with an orange trim down the front, a
// buckled belt, cloth trousers and tall boots. Sleeveless: the bare arms are
// their own layer.
const BODY_EMBER = part(
  bands(SLIM, [
    [2, hb(SLIM, 8, 'S'), 'S'], // neck
    [1, hb(SLIM, 4, 'L'), 'L'], // vest collar
    [1, hb(SLIM, 2, 'A', 'L'), 'L'], // shoulder line + leather placket
    [6, hb(SLIM, 1, 'A', 'L'), 'L'], // crimson vest, placket down the centre
    [1, hb(SLIM, 1, 'a', 'L'), 'L'], // the vest falls into shadow above the belt
    [1, hb(SLIM, 1, '4'), 'M'], // belt strap + buckle
    [1, hb(SLIM, 1, '#'), 'M'], // seam under the belt
    [1, hb(SLIM, 1, 'C'), 'C'], // hip
    [3, hb(SLIM, 2, 'C'), 'C'], // trousers
    [1, hb(SLIM, 2, 'c'), 'c'], // fold
    [8, hg(SLIM, 2, 7, 'C'), '.'], // legs
    [1, hg(SLIM, 2, 7, 'c'), '.'],
    [3, hg(SLIM, 2, 7, 'L'), '.'], // boot shafts
    [2, hg(SLIM, 1, 8, 'l'), '.'], // boots
  ]),
  bodyAnchors(SLIM, 32, 14),
);

// GALE — fitted leathers in the element colour, a chest strap, a buckled
// belt, slim legs and turned-down boots; the whole upper body is then
// translated forward so the figure leans into a run (the lean bends at the
// belt, a natural seam, rather than snapping mid-chest).
const galeRows = bands(SLIM, [
  [2, hb(SLIM, 8, 'S'), 'S'], // neck
  [1, hb(SLIM, 4, 'A'), 'A'], // collar
  [1, hb(SLIM, 2, 'A'), 'A'], // shoulders
  [4, hb(SLIM, 1, 'A'), 'A'], // chest
  [1, hb(SLIM, 1, 'L'), 'L'], // chest strap
  [3, hb(SLIM, 1, 'A'), 'A'], // midriff
  [1, hb(SLIM, 1, '4'), 'M'], // belt
  [1, hb(SLIM, 1, '#'), 'M'], // seam
  [1, hb(SLIM, 2, 'A'), 'A'], // hip
  [2, hb(SLIM, 3, 'A'), 'A'],
  [7, hg(SLIM, 3, 6, 'A'), '.'], // slim legs
  [2, hg(SLIM, 3, 6, 'a'), '.'],
  [3, hg(SLIM, 2, 7, 'L'), '.'], // boot shafts, turned down
  [2, hg(SLIM, 1, 8, 'l'), '.'],
]);
for (let i = 0; i < 14; i++) galeRows[i] = shiftX(galeRows[i], 2);
const BODY_GALE = part(galeRows, { head: { x: SLIM + 2, y: 0 }, hand: { x: SLIM + 2, y: 3 }, capePin: { x: SLIM + 2, y: 2 }, feet: { x: SLIM, y: 30 }, hit: { x: SLIM, y: 14 } });

// TIDE — a pale robe to the ground over a teal underdress, a sash, vertical
// folds, and a scalloped wave hem. No legs: the robe reaches the floor.
const BODY_TIDE = part(
  bands(BULK, [
    [2, hb(BULK, 10, 'S'), 'S'], // neck
    [1, hb(BULK, 6, 'C'), 'C'], // collar
    [1, hb(BULK, 4, 'A'), 'A'], // shoulders
    [3, hb(BULK, 3, 'A'), 'A'],
    [3, hb(BULK, 2, 'A'), 'A'],
    [1, hb(BULK, 2, '4'), 'M'], // sash + clasp
    [2, '.AAaAAAAAAAAA', 'A'], // robe, one fold to each side
    [3, '.AAaAAAAaAAAA', 'A'],
    [6, 'AAAaAAAAaAAAA', 'A'], // the robe flares to the floor
    [3, 'AAaAAAAAaAAAA', 'A'],
    [1, 'AAAaAAAAaAAAA', 'A'],
    [1, hb(BULK, 0, '#'), '#'], // hem seam
    [3, hb(BULK, 0, 'C'), 'C'], // wave hem
    [1, 'CC.CC.CC.CCC.', 'C'], // scallop
    [1, '.C..C..C..CC.', '.'],
  ]),
  bodyAnchors(BULK, 32, 15),
);

// BASALT — mail with a dark tabard over it, broad pauldrons, a heavy belt,
// mailed legs and sabatons. The mail shows as a two-cell band down each
// side of the tabard so the two materials both read.
const BODY_BASALT = part(
  bands(BULK, [
    [2, hb(BULK, 10, 'M'), 'M'], // gorget
    [1, hb(BULK, 2, 'M'), 'M'], // pauldron line
    [2, hb(BULK, 0, 'M'), 'M'], // broad pauldrons
    [1, hb(BULK, 1, 'm'), 'm'], // pauldron underside
    [6, '.MMAAAAAAAAAA', 'A'], // tabard over mail
    [1, '.MM4444444444'.slice(0, BULK), 'M'], // belt + buckle
    [1, '.MM##########'.slice(0, BULK), 'M'], // seam
    [4, '.MMAAAAAAAAAA', 'A'], // tabard skirt
    [1, '.MMaaaaaaaaaa', 'a'], // hem shadow
    [5, hg(BULK, 4, 8, 'M'), '.'], // mailed legs
    [2, hg(BULK, 4, 8, 'm'), '.'],
    [2, hg(BULK, 3, 9, 'M'), '.'], // sabatons
    [2, hg(BULK, 2, 10, '5'), '.'],
    [2, hg(BULK, 2, 10, 'm'), '.'],
  ]),
  bodyAnchors(BULK, 32, 14),
);

// SABLE — a hooded cloak to the knees over dark leathers: the cloak IS the
// silhouette, its inner lining showing as a band down the front where it
// hangs open, and the legs below it.
const BODY_SABLE = part(
  bands(WIDE, [
    [2, hb(WIDE, 9, 'S'), 'S'], // neck
    [1, hb(WIDE, 5, 'A'), 'A'], // cloak collar
    [2, hb(WIDE, 2, 'A'), 'A'], // shoulders
    [3, hb(WIDE, 1, 'A', 'D'), 'D'], // cloak, a lining edge where it hangs open
    [2, hb(WIDE, 0, 'A', 'D'), 'D'],
    [1, hb(WIDE, 0, '4'), 'M'], // belt over the cloak
    [5, hb(WIDE, 0, 'A', 'D'), 'D'],
    [1, hb(WIDE, 0, 'a', 'd'), 'd'],
    [2, hb(WIDE, 0, 'A', 'D'), 'D'],
    [1, hb(WIDE, 0, '6'), '6'], // cloak hem
    [5, hg(WIDE, 3, 6, 'L'), '.'], // leathered legs
    [2, hg(WIDE, 3, 6, 'l'), '.'],
    [3, hg(WIDE, 2, 7, '4'), '.'], // soft boots
    [2, hg(WIDE, 1, 8, 'l'), '.'],
  ]),
  bodyAnchors(WIDE, 32, 14),
);

// LUMEN — a mantle with a gold-trimmed edge over a long pale tunic, a
// cinched sash, and a hem trim; boots peek out under it.
const BODY_LUMEN = part(
  bands(WIDE, [
    [2, hb(WIDE, 9, 'S'), 'S'], // neck
    [1, hb(WIDE, 5, 'A'), 'A'], // mantle collar
    [1, hb(WIDE, 2, 'A'), 'A'], // mantle shoulders
    [4, hb(WIDE, 1, 'C', 'AA'), 'C'], // mantle over the tunic, gold edge
    [1, hb(WIDE, 1, 'A', 'AA'), 'A'], // mantle hem band
    [1, hb(WIDE, 2, '4'), 'M'], // sash + clasp
    [1, hb(WIDE, 2, '#'), 'M'],
    [3, '..CCcCCCCCCC', 'C'], // tunic with a fold
    [4, '.CCcCCCCCCCC', 'C'],
    [3, 'CCcCCCCCCCCC', 'C'],
    [1, hb(WIDE, 0, 'A'), 'A'], // hem trim
    [1, hb(WIDE, 0, '#'), '#'],
    [5, hg(WIDE, 3, 6, 'C'), '.'], // legs under the tunic
    [2, hg(WIDE, 2, 7, 'L'), '.'], // boots
    [2, hg(WIDE, 1, 8, 'l'), '.'],
  ]),
  bodyAnchors(WIDE, 32, 14),
);

// --- Heads --------------------------------------------------------------------
// Every head is 17 rows and its neck anchor is the last one, so a head
// lands with its chin on the body's neck row: seven or eight rows of hair,
// hood or helm above ten rows of face, at a width that matches the
// shoulders. That head is a third of the composed figure — the proportion
// the whole style rests on.

const HLH = 10; // half-width; composed width 21

/** Overwrite cells of an already-built row, left to right — eyes, catchlights, a visor glint. */
function stamp(row: string, ...edits: readonly (readonly [x: number, s: string])[]): string {
  const cells = [...row];
  for (const [x, s] of edits) for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < cells.length) cells[x + i] = s[i];
  return cells.join('');
}

/**
 * The ten rows every human face shares: forehead, brow, a 2x2 eye cluster
 * with a one-cell catchlight in each, cheeks, a one-cell mouth, jaw, chin.
 * `side` frames the face (hair, a hood, a helm cheek); `skin` is the face
 * material — `s` for a face under a deep hood, plain `S` in the open.
 */
function faceBlock(side: string, skin = 'S', eye = '#'): string[] {
  const r = (pad: number, sides: number): string => sym(HLH, '.'.repeat(pad) + side.repeat(sides) + skin.repeat(Math.max(0, HLH - pad - sides)), skin);
  const rows = [r(0, 2), r(0, 2), r(0, 2), r(0, 2), r(0, 2), r(0, 2), r(1, 2), r(2, 2), r(3, 1), r(4, 1)];
  if (skin === 'S') rows[0] = stamp(rows[0], [2, 's'.repeat(2 * HLH - 3)]); // the hair casts onto the brow
  rows[2] = stamp(rows[2], [HLH - 4, '$' + eye], [HLH + 3, eye + '$']);
  rows[3] = stamp(rows[3], [HLH - 4, eye + eye], [HLH + 3, eye + eye]);
  rows[6] = stamp(rows[6], [HLH, skin === 'S' ? 's' : skin]); // one cell of mouth
  return rows;
}

/** A hair or hood crown: `pads` outer-edge insets top to bottom, optionally swept sideways per row. */
function crown(ch: string, pads: readonly number[], sweep: readonly number[] = []): string[] {
  return pads.map((pad, i) => shiftX(sym(HLH, hb(HLH, pad, ch), ch), sweep[i] ?? 0));
}

const NECK: Partial<Record<AnchorName, Point>> = { head: { x: HLH, y: 16 } };

// EMBER — a big upswept mane with strand notches, swept back off the brow.
const emberCrown = crown('H', [7, 5, 3, 1, 0], [-4, -3, -2, -1, 0]);
emberCrown[3] = stamp(emberCrown[3], [4, '^^^^^']);
emberCrown[4] = stamp(emberCrown[4], [3, '^^^']);
const HEAD_EMBER = part(
  [
    ...emberCrown,
    sym(HLH, 'HHhHHHHHHh', 'H'), // strand notches
    sym(HLH, 'HHHhHHHHHH', 'H'),
    ...faceBlock('H'),
  ],
  NECK,
);

// GALE — a windswept crop: the whole mass leans back off the run.
const galeCrown = crown('H', [8, 6, 4, 2, 0], [-6, -5, -4, -3, -2]);
galeCrown[3] = stamp(galeCrown[3], [2, '^^^^^']);
galeCrown[4] = stamp(galeCrown[4], [1, '^^^']);
const HEAD_GALE = part(
  [
    ...galeCrown,
    shiftX(sym(HLH, 'HhHHHHHHHh', 'H'), -2),
    shiftX(sym(HLH, 'HHhHHHHHHH', 'H'), -1),
    ...faceBlock('H'),
  ],
  NECK,
);

// TIDE — a deep teal hood with dark hair showing beneath it; the face sits
// in the hood's shade, so its skin is authored one step down the ramp.
const HEAD_TIDE = part(
  [
    ...crown('C', [7, 5, 3, 1, 0, 0, 0]),
    ...faceBlock('C', 'S').map((row, i) => (i < 2 ? stamp(row, [HLH - 7, 'HHHH'], [HLH + 4, 'HHHH']) : row)),
  ],
  NECK,
);

// BASALT — a full iron helm: a crest ridge, a dark slit visor with one
// glint, a cheek guard. No face at all, which is the point.
const HEAD_BASALT = part(
  [
    ...crown('M', [7, 5, 3, 1, 0, 0, 0]),
    sym(HLH, hb(HLH, 0, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 0, 'M'), 'M'), [HLH - 7, '######'], [HLH + 2, '######'], [HLH - 7, '*']), // visor slit + glint
    stamp(sym(HLH, hb(HLH, 0, 'M'), 'M'), [HLH - 7, '######'], [HLH + 2, '######']),
    sym(HLH, hb(HLH, 0, 'M'), 'M'),
    sym(HLH, hb(HLH, 0, 'M'), 'M'),
    sym(HLH, hb(HLH, 0, 'm'), 'm'),
    sym(HLH, hb(HLH, 1, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 3, 'm'), 'm'),
    sym(HLH, hb(HLH, 5, 'M'), 'M'),
  ],
  NECK,
);

// SABLE — a pointed hood whose interior is pure shadow but for two lit
// eyes. Nothing else of the face reads, ever.
const HEAD_SABLE = part(
  [
    ...crown('A', [8, 6, 4, 3, 2, 1, 0]),
    sym(HLH, hb(HLH, 0, 'A'), 'A'),
    sym(HLH, 'AA########', '#'),
    stamp(sym(HLH, 'AA########', '#'), [HLH - 6, 'GG'], [HLH + 4, 'GG']), // lit eyes
    stamp(sym(HLH, 'AA########', '#'), [HLH - 6, 'gg'], [HLH + 4, 'gg']),
    sym(HLH, 'AA########', '#'),
    sym(HLH, 'AA########', '#'),
    sym(HLH, 'AAA#######', '#'),
    sym(HLH, hb(HLH, 2, 'A'), 'A'),
    sym(HLH, hb(HLH, 3, 'A'), 'A'),
    sym(HLH, hb(HLH, 5, 'a'), 'a'),
  ],
  NECK,
);

// LUMEN — long cream-gold hair parted off the brow and falling well past
// the shoulders (the rows below the neck paint over the mantle, since the
// head layer is always on top).
const lumenCrown = crown('H', [7, 5, 3, 1, 0]);
lumenCrown[3] = stamp(lumenCrown[3], [4, '^^^^^']);
lumenCrown[4] = stamp(lumenCrown[4], [3, '^^^']);
const HEAD_LUMEN = part(
  [
    ...lumenCrown,
    sym(HLH, 'HHhHHHHHHH', 'h'),
    sym(HLH, 'HHHhHHHHHH', 'H'),
    ...faceBlock('H'),
    sym(HLH, hb(HLH, 3, 'H'), '.'),
    sym(HLH, hb(HLH, 3, 'H'), '.'),
    sym(HLH, hb(HLH, 4, 'H'), '.'),
    sym(HLH, hb(HLH, 4, 'h'), '.'),
    sym(HLH, hb(HLH, 5, 'H'), '.'),
    sym(HLH, hb(HLH, 6, 'h'), '.'),
  ],
  NECK,
);

// --- Arms ---------------------------------------------------------------------
// An arms part holds BOTH arms as one symmetric layer that lands on the
// body's shoulder seam, so a figure never reads as one-armed. Its own
// `weaponGrip` is the right-hand mitt (or, for the robed pair, the two
// hands meeting in front); a weapon's grip lands there and stays there
// through every rotation.

const ALH = 12; // arms half-width; composed 25 — one cell proud of a slim body on each side
const PLH = 14; // plated arms: 29, one cell proud of an armoured body

/** Both arms of a hero: the mitt is the widest thing below the elbow, which is what makes hands read at this size. */
function armsPart(lh: number, list: readonly Band[], gripY: number, gripX: number): PartDef {
  return part(bands(lh, list), { hand: { x: lh, y: 0 }, weaponGrip: { x: 2 * lh - gripX, y: gripY } });
}

// EMBER — bare arms with leather bracers.
const ARMS_BARE = armsPart(
  ALH,
  [
    [2, hg(ALH, 0, 6, 'S'), '.'],
    [6, hg(ALH, 1, 5, 'S'), '.'],
    [1, hg(ALH, 1, 5, 's'), '.'],
    [3, hg(ALH, 2, 4, 'L'), '.'], // bracer
    [2, hg(ALH, 2, 4, 'S'), '.'],
    [3, hg(ALH, 1, 5, 'S'), '.'], // mitt
    [1, hg(ALH, 1, 5, 's'), '.'],
  ],
  15,
  3,
);

// GALE, SABLE and the cloth-sleeved enemies — a sleeve, a cuff seam, a
// leather glove.
const ARMS_SLEEVE = armsPart(
  ALH,
  [
    [2, hg(ALH, 0, 6, 'C'), '.'],
    [6, hg(ALH, 1, 5, 'C'), '.'],
    [1, hg(ALH, 1, 5, 'c'), '.'],
    [3, hg(ALH, 2, 4, 'C'), '.'],
    [1, hg(ALH, 2, 4, '#'), '.'], // cuff seam
    [4, hg(ALH, 1, 5, 'L'), '.'], // glove
    [1, hg(ALH, 1, 5, 'l'), '.'],
  ],
  15,
  3,
);

// LUMEN — a mantle sleeve with a gold cuff over a pale glove.
const ARMS_MANTLE = armsPart(
  ALH,
  [
    [2, hg(ALH, 0, 6, 'C'), '.'],
    [6, hg(ALH, 1, 5, 'C'), '.'],
    [1, hg(ALH, 1, 5, 'c'), '.'],
    [2, hg(ALH, 2, 4, 'C'), '.'],
    [2, hg(ALH, 2, 4, 'A'), '.'], // gold cuff
    [4, hg(ALH, 1, 5, 'L'), '.'],
    [1, hg(ALH, 1, 5, 'l'), '.'],
  ],
  15,
  3,
);

// BASALT and the knights — pauldrons, vambraces, gauntlet mitts.
const ARMS_PLATE = armsPart(
  PLH,
  [
    [3, hg(PLH, 0, 7, 'M'), '.'], // pauldron
    [1, hg(PLH, 0, 7, 'm'), '.'],
    [5, hg(PLH, 2, 5, 'M'), '.'],
    [1, hg(PLH, 2, 5, 'm'), '.'],
    [3, hg(PLH, 3, 4, 'M'), '.'], // vambrace
    [4, hg(PLH, 2, 5, 'M'), '.'], // gauntlet
    [1, hg(PLH, 2, 5, 'm'), '.'],
  ],
  15,
  4,
);

// TIDE and the Pale Saint — wide sleeves converging on two hands cupped in
// front of the belly; the grip is the centre, where the orb sits.
const RLH = 13;
const ARMS_ROBE = part(
  bands(RLH, [
    [2, hg(RLH, 0, 6, 'A'), '.'],
    [2, hg(RLH, 1, 6, 'A'), '.'],
    [2, hg(RLH, 2, 6, 'A'), '.'],
    [2, hg(RLH, 3, 6, 'A'), '.'],
    [2, hg(RLH, 4, 6, 'A'), '.'],
    [2, hg(RLH, 5, 6, 'A'), '.'],
    [2, hg(RLH, 6, 6, 'a'), '.'],
    [2, hb(RLH, 8, 'C'), 'C'], // cuffs meeting
    [2, hb(RLH, 9, 'S'), 'S'], // mitts, cupped
  ]),
  { hand: { x: RLH, y: 0 }, weaponGrip: { x: RLH, y: 16 } },
);

// --- Weapons ------------------------------------------------------------------
// Weapons are proportionally large — a staff taller than its bearer, a bow
// as tall, a sword about body length, a tower shield about torso size — and
// shaded by the same ramp rules as everything else. Each rests vertically
// with its grip in the lower half, so the idle pose reads as "held ready"
// and the attack rig can rotate it about that grip in 90° steps.

// STAFF — EMBER: 52 cells, taller than its 47-cell bearer, crowned with a flame.
const STL = 4; // half-width 4 → 9 wide
const STAFF = part(
  bands(STL, [
    [1, hb(STL, 3, 'G'), 'G'],
    [1, hb(STL, 2, 'G'), 'G'],
    [2, hb(STL, 1, 'G'), 'G'],
    [3, hb(STL, 0, 'G'), 'G'], // flame body
    [2, hb(STL, 1, 'G'), 'G'],
    [1, hb(STL, 2, 'G'), 'G'],
    [1, hb(STL, 2, 'A'), 'A'], // ferrule
    [1, hb(STL, 2, '6'), '6'],
    [22, hb(STL, 3, 'L'), 'L'], // shaft
    [3, hb(STL, 3, 'A'), 'A'], // grip wrap
    [12, hb(STL, 3, 'L'), 'L'],
    [1, hb(STL, 2, 'M'), 'M'], // heel cap
    [2, hb(STL, 3, 'M'), 'M'],
  ]),
  { weaponGrip: { x: STL, y: 38 } },
);

// DAGGER — GALE's drawn blade: a leaf blade, a crossguard, a wrapped grip.
const DGL = 3;
const DAGGER = part(
  bands(DGL, [
    [1, hb(DGL, 2, 'M'), 'M'],
    [2, hb(DGL, 1, 'M'), 'M'],
    [8, hb(DGL, 1, 'M'), '*'], // blade with a lit edge
    [1, hb(DGL, 0, 'M'), 'M'], // crossguard
    [4, hb(DGL, 2, 'L'), 'L'], // grip
    [1, hb(DGL, 1, 'A'), 'A'], // pommel
  ]),
  { weaponGrip: { x: DGL, y: 14 } },
);

// DAGGER_SHEATHED — GALE's off-hand blade riding at the hip: "twin daggers"
// without a second arm rig, so it anchors to nothing and travels with the body.
const DAGGER_SHEATHED = part(
  bands(2, [
    [1, hb(2, 1, 'M'), 'M'],
    [7, hb(2, 0, 'L'), 'L'],
    [1, hb(2, 0, 'A'), 'A'],
    [2, hb(2, 1, 'l'), 'l'],
  ]),
);

// DAGGER_CURVED — SABLE: gripped near the top so the curved blade hangs
// low and sweeps back behind the hip.
const DAGGER_CURVED = part(
  [
    '..LLL..',
    '..LLL..',
    '..LLL..',
    '..MMM..',
    '..MMm..',
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
    '.....##',
  ],
  { weaponGrip: { x: 3, y: 2 } },
);

// BOW_TALL — LUMEN: as tall as its bearer, the limbs bowing away from a
// taut string, a wrapped grip at the centre.
const BOW_H = 44;
const BOW_W = 13;
const bowRows: string[] = [];
for (let i = 0; i < BOW_H; i++) {
  const t = Math.sin((Math.PI * i) / (BOW_H - 1));
  const off = 2 + Math.round(7 * t);
  const cells = new Array(BOW_W).fill('.');
  if (i > 1 && i < BOW_H - 2) cells[1] = '6'; // string
  const grip = i >= 19 && i <= 24;
  for (let k = 0; k < (grip ? 4 : 3); k++) if (off + k < BOW_W) cells[off + k] = grip ? 'L' : k === 2 ? 'a' : 'A';
  bowRows.push(cells.join(''));
}
const BOW_TALL = part(bowRows, { weaponGrip: { x: 9, y: 21 } });

// ORB — TIDE and the Pale Saint: a floating sphere of light. Its grip is
// the BOTTOM centre, so it rests above two cupped hands.
const OLH = 5;
const ORB = part(
  bands(OLH, [
    [1, hb(OLH, 3, 'G'), 'G'],
    [1, hb(OLH, 2, 'G'), 'G'],
    [1, hb(OLH, 1, 'G'), 'G'],
    [5, hb(OLH, 0, 'G'), 'G'],
    [1, hb(OLH, 1, 'G'), 'G'],
    [1, hb(OLH, 2, 'G'), 'G'],
    [1, hb(OLH, 3, 'G'), 'G'],
  ]),
  { weaponGrip: { x: OLH, y: 10 } },
);

// MACE — BASALT: a flanged head on a short haft, gripped low.
const MLH = 5;
const MACE = part(
  bands(MLH, [
    [1, hb(MLH, 2, 'M'), 'M'],
    [1, hb(MLH, 0, 'M'), 'M'],
    [2, hb(MLH, 0, 'M'), 'A'], // flanged head, accent ridge
    [3, hb(MLH, 0, 'M'), 'M'],
    [1, hb(MLH, 1, 'm'), 'm'],
    [1, hb(MLH, 2, 'M'), 'M'],
    [10, hb(MLH, 3, 'L'), 'L'], // haft
    [3, hb(MLH, 3, 'A'), 'A'], // grip wrap
    [4, hb(MLH, 3, 'L'), 'L'],
    [2, hb(MLH, 2, 'M'), 'M'], // pommel
  ]),
  { weaponGrip: { x: MLH, y: 24 } },
);

// SWORD — the knights: about body length, with a fullered blade and a
// broad crossguard.
const SWL = 4;
const SWORD = part(
  bands(SWL, [
    [1, hb(SWL, 3, 'M'), 'M'],
    [2, hb(SWL, 2, 'M'), '*'],
    [20, hb(SWL, 1, 'M'), '*'], // blade + fuller highlight
    [1, hb(SWL, 1, 'm'), 'm'],
    [1, hb(SWL, 0, 'M'), 'M'], // crossguard
    [1, hb(SWL, 0, 'm'), 'm'],
    [5, hb(SWL, 3, 'L'), 'L'], // grip
    [1, hb(SWL, 2, 'A'), 'A'], // pommel
  ]),
  { weaponGrip: { x: SWL, y: 29 } },
);

// TOWER_SHIELD — BASALT: about torso size, a metal rim around a bold
// element-coloured face with a raised boss, so it reads as a held object in
// front of an armoured body rather than more chest.
const TWL = 8;
const TOWER_SHIELD = part(
  bands(TWL, [
    [2, hb(TWL, 1, 'M'), 'M'], // rim
    [2, hb(TWL, 0, 'M'), 'M'],
    [3, hb(TWL, 0, 'M', 'AA'), 'A'], // emblem: a bar down
    [2, hb(TWL, 0, 'M', 'AAAAA'), 'A'], // and a bar across
    [3, hb(TWL, 0, 'M', 'AA'), 'A'],
    [6, hb(TWL, 0, 'M', 'AA'), 'A'],
    [3, hb(TWL, 0, 'm', 'aa'), 'a'],
    [2, hb(TWL, 0, 'M'), 'M'],
    [2, hb(TWL, 1, 'm'), 'm'],
  ]),
);

// SHIELD — the knights' kite shield: rounded at the top, tapering to a
// point, an element-coloured band across the middle.
const SHL = 9;
const SHIELD = part(
  bands(SHL, [
    [1, hb(SHL, 4, 'M'), 'M'],
    [1, hb(SHL, 2, 'M'), 'M'],
    [4, hb(SHL, 0, 'M'), 'M'],
    [3, hb(SHL, 0, 'A'), 'A'], // emblem band
    [6, hb(SHL, 0, 'M'), 'M'],
    [2, hb(SHL, 1, 'M'), 'M'],
    [2, hb(SHL, 2, 'M'), 'M'],
    [2, hb(SHL, 3, 'M'), 'M'],
    [2, hb(SHL, 4, 'm'), 'm'],
    [2, hb(SHL, 5, 'm'), 'm'],
    [1, hb(SHL, 6, 'm'), 'm'],
  ]),
);

// LANTERN — the Crypt Warden: carried by its ring, the glowing body
// hanging BELOW the fist, so its grip is at the top.
const LNL = 5;
const LANTERN = part(
  bands(LNL, [
    [1, hb(LNL, 4, 'M'), '.'],
    [1, hb(LNL, 4, 'M'), 'M'],
    [1, hb(LNL, 3, 'M'), 'M'],
    [1, hb(LNL, 1, 'M'), 'M'], // cap
    [8, hb(LNL, 2, 'M', 'GG'), 'G'], // glazed body
    [1, hb(LNL, 1, 'M'), 'M'],
    [1, hb(LNL, 2, 'm'), 'm'],
  ]),
  { weaponGrip: { x: LNL, y: 1 } },
);

// CANE — the Marsh Hag: a crooked hook over a knotted shaft, nothing like
// EMBER's straight flame staff.
const CNL = 4;
const CANE = part(
  [
    '....LLLL...',
    '...LLLLLLL.',
    '...LLL.LLLL',
    '..LLLL..LLL',
    '..LLLL.....',
    ...bands(CNL, [
      [6, hb(CNL, 2, 'L'), 'L'],
      [1, hb(CNL, 1, 'l'), 'l'], // knot
      [8, hb(CNL, 2, 'L'), 'L'],
      [1, hb(CNL, 1, 'l'), 'l'],
      [8, hb(CNL, 2, 'L'), 'L'],
      [2, hb(CNL, 2, '4'), '4'],
    ]),
  ],
  { weaponGrip: { x: 3, y: 22 } },
);

// CLAW — the Hollow King (boss scale): a bony wrist and palm at the grip,
// four long hooked talons hanging from it.
const CLL = 8;
const CLAW = part(
  bands(CLL, [
    [3, hb(CLL, 5, 'B'), 'B'], // wrist
    [5, hb(CLL, 1, 'B'), 'B'], // palm
    [4, hg2(CLL, 1, 2, 5, 2, 'B'), 'B'],
    [10, hg2(CLL, 2, 2, 5, 2, 'B'), '.'],
    [6, hg2(CLL, 3, 2, 5, 2, 'B'), '.'],
    [4, hg2(CLL, 4, 1, 6, 1, 'B'), '.'],
    [2, hg2(CLL, 5, 1, 6, 1, '%'), '.'], // talon tips catch the light
  ]),
  { weaponGrip: { x: CLL, y: 2 } },
);

// --- Capes, cloaks and crests -------------------------------------------------

// SCARF — GALE: pinned at the collar and streaming back the other way from
// the lean. Its pin sits at the far RIGHT of its own grid so the whole
// streamer lands behind the shoulder instead of under it.
const SCARF = part(
  [
    padRow(34, 24, 'DDDDDDDDDD'),
    padRow(34, 20, 'DDDDDDDDDDDDDD'),
    padRow(34, 16, 'DDDDDDDDDDDDDDDDDD'),
    padRow(34, 12, 'DDDDDDDDDDDDDDDDDDDD'),
    padRow(34, 9, 'DDDDDDDDDDDDDDDDDDDD'),
    padRow(34, 6, 'DDDDDDDDDDDDDDDDDDDd'),
    padRow(34, 3, 'DDDDDDDDDDDDDDDDDDd'),
    padRow(34, 1, 'DDDDDDDDDDDDDDDDd'),
    padRow(34, 0, 'DDDDDDDDDDDDDd'),
    padRow(34, 0, 'DDDDDDDDDd'),
    padRow(34, 1, 'DDDDd'),
  ],
  { capePin: { x: 32, y: 1 } },
);

// CLOAK_RAGGED / CLOAK_HOLY — the two bosses (boss scale), drawn BEHIND the
// body and authored wider and longer than it so the drape actually shows.
// Same collar and body; only the hem differs — torn strips of uneven length
// for the skeleton king, a clean trimmed edge for the saint. The inner
// lining is a second colour down both leading edges.
const BCL = 24;
const cloakTop: Band[] = [
  [2, hb(BCL, 18, 'C'), 'C'],
  [2, hb(BCL, 14, 'C'), 'C'],
  [2, hb(BCL, 10, 'A'), 'A'],
  [3, hb(BCL, 6, 'A'), 'A'],
  [4, hb(BCL, 3, 'A'), 'A'],
  [6, hb(BCL, 1, 'A', 'DD'), 'A'],
  [16, hb(BCL, 0, 'A', 'DD'), 'A'],
];
const CLOAK_RAGGED = part(
  bands(BCL, [
    ...cloakTop,
    [2, hb(BCL, 0, 'A', 'DD'), 'A'],
    [3, hg2(BCL, 0, 13, 15, 9, 'A'), 'A'],
    [3, hg2(BCL, 0, 11, 16, 7, 'A'), '.'],
    [3, hg2(BCL, 1, 9, 17, 5, 'a'), '.'],
    [2, hg2(BCL, 2, 7, 18, 4, 'a'), '.'],
    [2, hg2(BCL, 3, 5, 19, 2, 'a'), '.'],
  ]),
  { capePin: { x: BCL, y: 2 } },
);
const CLOAK_HOLY = part(
  bands(BCL, [
    ...cloakTop,
    [18, hb(BCL, 0, 'A', 'DD'), 'A'],
    [3, hb(BCL, 0, 'C'), 'C'], // trimmed hem
    [2, hb(BCL, 0, '2'), '2'],
  ]),
  { capePin: { x: BCL, y: 2 } },
);

// CROWN — the Hollow King: a jagged band of points with a lit gem.
const CRL = 9;
const CROWN = part([
  sym(CRL, '..A...A..', 'A'),
  sym(CRL, '.AA..AA.A', 'A'),
  sym(CRL, 'AAA.AAAAA', 'A'),
  sym(CRL, 'AAAAAAAAA', 'A'),
  stamp(sym(CRL, hb(CRL, 0, 'A'), 'A'), [CRL - 1, 'GGG']),
  sym(CRL, hb(CRL, 0, 'A'), 'A'),
  sym(CRL, hb(CRL, 0, '6'), '6'),
]);

// HALO — LUMEN and the Pale Saint: a thin hovering ring of light.
function halo(lh: number): PartDef {
  const bore = 2;
  const hole = stamp(sym(lh, hb(lh, 0, 'G'), 'G'), [lh - bore, '.'.repeat(bore * 2 + 1)]);
  const cap = sym(lh, hb(lh, bore, 'g'), 'g');
  return part([cap, hole, hole, cap]);
}
const HALO = halo(8);
const HALO_BOSS = halo(13);

// PLUME — the Pyre Knight's helm crest: an upward flame.
const PLUME = part(
  bands(3, [
    [1, hb(3, 2, 'G'), 'G'],
    [2, hb(3, 1, 'G'), 'G'],
    [6, hb(3, 0, 'G'), 'G'],
    [3, hb(3, 1, 'G'), 'G'],
    [2, hb(3, 2, 'A'), 'A'],
  ]),
);

// KELP — the Drowned Knight's crest: waterlogged strands hanging off the
// helm, the same family as PLUME, inverted.
const KELP = part(
  bands(5, [
    [2, hb(5, 0, 'A'), 'A'],
    [3, hb(5, 1, 'A'), 'A'],
    [4, hg2(5, 0, 3, 4, 2, 'A'), 'A'],
    [4, hg2(5, 1, 3, 4, 2, 'A'), '.'],
    [3, hg2(5, 2, 3, 4, 1, 'a'), '.'],
  ]),
);

// --- Enemy heads --------------------------------------------------------------

// HEAD_HAG — a crooked, lopsided hood over a jutting chin; the whole crown
// leans, which reads as "old and hunched" before any colour arrives.
const HEAD_HAG = part(
  [
    ...crown('C', [8, 6, 4, 3, 2, 1, 0], [-5, -4, -4, -3, -2, -1, 0]),
    ...faceBlock('C', 's').map((row, i) => (i < 2 ? stamp(row, [2, 'CCCCCCCCCCCCCCCCC']) : i > 5 ? shiftX(row, 1) : row)),
  ],
  NECK,
);

// HEAD_BRUTE — the Crypt Warden: a low shelled skull-cap over a shadowed
// face with two ember slits, and no jaw to speak of.
const HEAD_BRUTE = part(
  [
    ...crown('M', [7, 5, 3, 1, 0, 0]),
    sym(HLH, hb(HLH, 0, 'm'), 'm'),
    sym(HLH, 'CC########', '#'),
    stamp(sym(HLH, 'CC########', '#'), [HLH - 6, 'GGG'], [HLH + 3, 'GGG']),
    sym(HLH, 'CC########', '#'),
    sym(HLH, hb(HLH, 1, 'C'), 'C'),
    sym(HLH, hb(HLH, 1, 'C'), 'C'),
    sym(HLH, hb(HLH, 2, 'C'), 'C'),
    sym(HLH, hb(HLH, 2, 'c'), 'c'),
    sym(HLH, hb(HLH, 3, 'C'), 'C'),
    sym(HLH, hb(HLH, 4, 'c'), 'c'),
    sym(HLH, hb(HLH, 6, 'c'), 'c'),
  ],
  NECK,
);

// --- Monster bodies -----------------------------------------------------------
// Single-part creatures: no head/arms rig, one silhouette per layer, so a
// quadruped or a legless shroud never has to fake a biped skeleton. Each
// name's defining feature — horns, a jaw, a shell, no legs — is authored as
// a one-off graft on a mirrored base.

// CINDER_IMP — small, horned, hunched, with a curling tail and lit eyes.
const IML = 9;
const impRows = bands(IML, [
  [1, hg2(IML, 1, 1, 7, 1, 'A'), '.'], // horn tips
  [2, hg2(IML, 1, 2, 6, 2, 'A'), '.'],
  [1, hb(IML, 3, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'], // eye rows
  [1, hb(IML, 3, 'a'), 'a'], // jaw shadow
  [2, hb(IML, 1, 'A'), 'A'], // hunched shoulders
  [6, hb(IML, 3, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'],
  [5, hg(IML, 3, 3, 'A'), '.'], // stubby legs
  [2, hg(IML, 2, 4, 'a'), '.'],
]);
impRows[6] = stamp(impRows[6], [4, 'GG'], [13, 'GG']);
impRows[7] = stamp(impRows[7], [5, '#'], [13, '#']);
const IMP_BODY = part(graft(impRows, 14, ['.AAA', '..AAA', '...AAA', '...AAA', '..AAA', '.AAA', 'AAA'], 0), { feet: { x: IML, y: 25 }, hit: { x: IML, y: 12 } });

// Bat wings, spread WIDER than the imp so they show behind it.
const IWL = 16;
const IMP_WINGS = part(
  bands(IWL, [
    [1, hg(IWL, 0, 3, 'a'), '.'],
    [2, hg(IWL, 0, 6, 'a'), '.'],
    [2, hg(IWL, 1, 8, 'a'), '.'],
    [2, hg(IWL, 2, 9, 'a'), '.'],
    [2, hg(IWL, 4, 8, 'a'), '.'],
    [2, hg(IWL, 6, 6, 'a'), '.'],
    [2, hg(IWL, 8, 4, 'a'), '.'],
  ]),
);

// ASH_HOUND — a low, long-bodied quadruped with a heavy head at the front
// and ember cracks glowing through the ash-grey hide. Authored as full rows
// (not mirrored) because a head at one end is the whole point of it.
const HOUND_BODY = part(
  [
    '..........................CCCCCCCC......',
    '...........CCCCCCCCC...CCCCCCCCCCCCC....',
    '........CCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
    '......CCCCCCCCCCCCCCCCCCCCCCCCCGGCCCCC..',
    '.....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC.',
    '....CCCCCCCCCCCCCCCCCCCCCCCC##########..',
    '....CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC...',
    '....CCCCACCCCCCCCACCCCCCCCCCCCCCCCC.....',
    '....CCCCCCCCCCCCCCCCCCCCCCCCCCCCC.......',
    '.....CCCCCCCCCCCCCCCCCCCCCCCCCC.........',
    '.....cccccccccccccccccccccccc...........',
    '.....CCCC..CCCC......CCCC..CCCC.........',
    ...rep(7, '.....CCCC..CCCC......CCCC..CCCC.........'),
    '.....LLLL..LLLL......LLLL..LLLL.........',
    '....llllllllllll....llllllllllll........',
  ],
  { feet: { x: 18, y: 20 }, hit: { x: 18, y: 6 } },
);

// DUST_WRAITH — a tall shroud with nothing under it: no legs, a hood whose
// interior is a void with two lit eyes, and a hem that frays into wisps.
const WRL = 13;
const wraithRows = bands(WRL, [
  [1, hb(WRL, 12, 'C'), 'C'], // hood peak
  [1, hb(WRL, 11, 'C'), 'C'],
  [1, hb(WRL, 9, 'C'), 'C'],
  [1, hb(WRL, 7, 'C'), 'C'],
  [1, hb(WRL, 6, '#'), '#'], // the void inside the hood
  [2, hb(WRL, 6, '#'), '#'],
  [1, hb(WRL, 7, 'C'), 'C'], // the hood closes
  [2, hb(WRL, 4, 'A'), 'A'], // shoulders
  [4, hb(WRL, 2, 'A', 'aA'), 'A'],
  [8, hb(WRL, 0, 'A', 'aA'), 'A'], // the shroud at its widest
  [6, hb(WRL, 1, 'A', 'aA'), 'A'], // and drawing back in
  [4, hb(WRL, 3, 'a'), 'a'],
  [2, hb(WRL, 3, 'A'), 'A'],
  [1, 'aaAAaAAAAaAAa', 'A'], // the hem frays rather than splitting into legs
  [1, '.aA.AAa.AAaA.', 'A'],
  [1, '..A..Aa..Aa..', '.'],
]);
wraithRows[5] = stamp(wraithRows[5], [8, 'GGG'], [16, 'GGG']);
wraithRows[6] = stamp(wraithRows[6], [8, 'ggg'], [16, 'ggg']);
const WRAITH_BODY = part(wraithRows, { feet: { x: WRL, y: 39 }, hit: { x: WRL, y: 18 } });

// CRYPT_WARDEN — a broad shelled brute: a plate across the chest, heavy
// shoulders, short thick legs.
const BRL = 17;
const BRUTE_BODY = part(
  bands(BRL, [
    [2, hb(BRL, 14, 'C'), 'C'], // neck
    [1, hb(BRL, 3, 'M'), 'M'], // shell shoulders
    [3, hb(BRL, 0, 'M'), 'M'],
    [2, hb(BRL, 1, 'm'), 'm'],
    [7, hb(BRL, 4, 'C', 'MMMMMMMMM'), 'M'], // chest plate over hide
    [1, hb(BRL, 4, '4'), 'M'], // belt
    [1, hb(BRL, 4, '#'), 'M'],
    [6, hb(BRL, 5, 'C'), 'C'],
    [5, hg(BRL, 4, 10, 'C'), '.'], // thick short legs
    [2, hg(BRL, 3, 11, 'L'), '.'],
    [2, hg(BRL, 2, 12, 'l'), '.'],
  ]),
  bodyAnchors(BRL, 32, 14),
);

// BOG_TOAD — squat and very wide, two bulging eyes riding on top.
const TDL = 16;
const toadRows = bands(TDL, [
  [1, hg(TDL, 5, 6, 'A'), '.'], // two bulging eyes
  [2, hg(TDL, 4, 8, 'A'), '.'],
  [1, hg(TDL, 4, 8, 'a'), '.'],
  [2, hb(TDL, 4, 'A'), 'A'], // brow
  [2, hb(TDL, 2, 'A'), 'A'],
  [8, hb(TDL, 0, 'A'), 'A'], // wide body
  [1, hb(TDL, 1, 'a'), 'a'],
  [2, hb(TDL, 4, 'a'), 'a'],
  [3, hg2(TDL, 2, 4, 9, 4, 'A'), '.'], // squat legs
  [2, hg2(TDL, 1, 5, 8, 5, 'a'), '.'],
]);
toadRows[1] = stamp(toadRows[1], [6, '$#'], [25, '#$']); // pupils with a catchlight
toadRows[2] = stamp(toadRows[2], [6, '##'], [25, '##']);
toadRows[7] = stamp(toadRows[7], [6, '#'.repeat(21)]); // a mouth the width of the face
const TOAD_BODY = part(toadRows, { feet: { x: TDL, y: 23 }, hit: { x: TDL, y: 11 } });

// FROST_WISP — a small crystalline glow with a trail of motes, nothing like
// FEN_FIRE's flame lick.
const WSL = 8;
const WISP_BODY = part(
  bands(WSL, [
    [2, hb(WSL, 7, 'A'), 'A'], // spire
    [1, hb(WSL, 5, 'A'), 'A'],
    [1, hb(WSL, 4, 'G'), 'G'],
    [1, hb(WSL, 2, 'G'), 'G'],
    [1, hb(WSL, 1, 'G'), 'G'],
    [3, hb(WSL, 0, 'G'), 'G'], // the crystal at its widest
    [1, hb(WSL, 1, 'G'), 'G'],
    [1, hb(WSL, 2, 'G'), 'G'],
    [1, hb(WSL, 3, 'G'), 'G'],
    [1, hb(WSL, 4, 'A'), 'A'],
    [1, hb(WSL, 5, 'A'), 'A'],
    [1, hb(WSL, 6, 'A'), 'A'],
    [4, hg(WSL, 6, 2, 'g'), '.'],
  ]),
  { feet: { x: WSL, y: 17 }, hit: { x: WSL, y: 8 } },
);

// SILT_CRAB — a wide shell low to the ground with a big open pincer to each
// side, reaching from above the shell down to it rather than perched on top.
const CBL = 19;
const crabRows = bands(CBL, [
  [3, 'MMMMMMM............', '.'], // upper jaw of the pincer
  [2, 'MMMM...............', '.'], // the pincer stands open
  [4, 'MMMMMMM............', '.'], // lower jaw
  [1, '.MMMMMM....AAAAAAAA', 'A'], // the shell starts between the arms
  [1, '..MMMMM...AAAAAAAAA', 'A'],
  [1, '...MMMM.AAAAAAAAAAA', 'A'],
  [1, '....MM.AAAAAAAAAAAA', 'A'],
  [8, '...AAAAAAAAAAAAAAAA', 'A'], // shell
  [2, '....aaaaaaaaaaaaaaa', 'a'],
  [2, hg2(CBL, 4, 3, 10, 3, 'M'), '.'], // legs
  [2, hg2(CBL, 3, 3, 9, 3, 'm'), '.'],
]);
crabRows[13] = stamp(crabRows[13], [15, 'G'], [23, 'G']); // stalked eyes
const CRAB_BODY = part(crabRows, { feet: { x: CBL, y: 24 }, hit: { x: CBL, y: 15 } });

// FEN_FIRE — a slender flame lick, taller than it is wide.
const FFL = 7;
const FENFIRE_BODY = part(
  bands(FFL, [
    [1, hb(FFL, 5, 'G'), 'G'],
    [1, hb(FFL, 4, 'G'), 'G'],
    [2, hb(FFL, 3, 'G'), 'G'],
    [2, hb(FFL, 2, 'G'), 'G'],
    [4, hb(FFL, 1, 'G'), 'G'],
    [4, hb(FFL, 0, 'G'), 'G'],
    [2, hb(FFL, 1, 'G'), 'G'],
    [2, hb(FFL, 2, 'A'), 'A'],
    [2, hg(FFL, 3, 2, 'g'), '.'],
  ]),
  { feet: { x: FFL, y: 19 }, hit: { x: FFL, y: 8 } },
);

// --- Boss-scale bodies and heads ----------------------------------------------
// Authored for the 96-cell boss canvas. The two bosses share no silhouette:
// the Hollow King is BONE — a ribcage you can see daylight through and long
// separated legs, with negative space as its identity — while the Pale
// Saint is an unbroken robed mass. Crown-and-claws versus halo-and-orb is
// the second read, not the first.

const KBL = 20; // boss body half-width → 41
const KHL = 15; // boss head half-width → 31

const kingRibs: Band[] = [];
for (const pad of [2, 2, 3, 3, 4, 5]) {
  kingRibs.push([2, hb(KBL, pad, 'B'), 'B']); // a rib
  kingRibs.push([1, hb(KBL, 14, 'b'), 'b']); // the gap between two, spine only
}
const KING_BODY = part(
  bands(KBL, [
    [2, hb(KBL, 16, 'B'), 'B'], // neck vertebrae
    [1, hb(KBL, 6, 'B'), 'B'], // clavicle
    [2, hb(KBL, 2, 'B'), 'B'], // shoulder girdle, the widest bone
    [1, hb(KBL, 3, 'b'), 'b'],
    ...kingRibs,
    [2, hb(KBL, 14, 'B'), 'B'], // lumbar spine
    [3, hb(KBL, 7, 'B'), 'B'], // pelvis
    [2, hb(KBL, 10, '#'), '#'], // hip sockets
    [22, hg(KBL, 7, 6, 'B'), '.'], // long separated legs
    [3, hg(KBL, 6, 7, 'B'), '.'],
    [2, hg(KBL, 5, 8, 'b'), '.'],
  ]),
  { head: { x: KBL, y: 0 }, hand: { x: KBL, y: 4 }, weaponGrip: { x: 38, y: 6 }, capePin: { x: KBL, y: 3 }, feet: { x: KBL, y: 57 }, hit: { x: KBL, y: 26 } },
);

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
kingHeadRows[10] = stamp(kingHeadRows[10], [6, '#####'], [20, '#####']);
kingHeadRows[11] = stamp(kingHeadRows[11], [6, '#GGG#'], [20, '#GGG#']);
kingHeadRows[12] = stamp(kingHeadRows[12], [7, '###'], [21, '###']);
kingHeadRows[20] = stamp(kingHeadRows[20], [9, '#'], [12, '#'], [15, '#'], [18, '#'], [21, '#']);
kingHeadRows[21] = stamp(kingHeadRows[21], [9, '#'], [12, '#'], [15, '#'], [18, '#'], [21, '#']);
const KING_HEAD = part(kingHeadRows, { head: { x: KHL, y: 27 } });

// The Pale Saint: a pale mantle with a gold placket, sash, collar and hem —
// the gold is trim on white, never the whole garment.
const SAINT_BODY = part(
  bands(KBL, [
    [2, hb(KBL, 16, 'S'), 'S'], // neck
    [1, hb(KBL, 10, 'A'), 'A'], // gold collar
    [2, hb(KBL, 6, 'C'), 'C'], // mantle shoulders
    [1, hb(KBL, 7, 'c'), 'c'],
    [6, hb(KBL, 4, 'C', 'AA'), 'C'], // mantle, gold placket down the front
    [1, hb(KBL, 4, 'A'), 'A'], // sash
    [1, hb(KBL, 4, '#'), 'M'],
    [8, hb(KBL, 3, 'C', 'AA'), 'C'],
    [3, hb(KBL, 2, 'C', 'AA'), 'C'],
    [14, hb(KBL, 1, 'C', 'AA'), 'C'],
    [18, hb(KBL, 0, 'C', 'AA'), 'C'], // the robe reaches the floor, unbroken
    [3, hb(KBL, 0, 'A'), 'A'], // gold hem
    [3, hb(KBL, 0, '2'), '2'],
  ]),
  { head: { x: KBL, y: 0 }, hand: { x: KBL, y: 3 }, weaponGrip: { x: KBL, y: 26 }, capePin: { x: KBL, y: 2 }, feet: { x: KBL, y: 62 }, hit: { x: KBL, y: 26 } },
);

const saintHeadRows = bands(KHL, [
  [1, hb(KHL, 10, 'C'), 'C'], // veil crown
  [1, hb(KHL, 8, 'C'), 'C'],
  [1, hb(KHL, 6, 'C'), 'C'],
  [1, hb(KHL, 4, 'C'), 'C'],
  [2, hb(KHL, 2, 'C'), 'C'],
  [4, hb(KHL, 1, 'C'), 'C'],
  [1, hb(KHL, 1, 'C'), 'C'],
  [3, '.CCCSSSSSSSSSSS', 'S'], // the veil parts over the brow
  [3, '.CCCSSSSSSSSSSS', 'S'], // eyes, closed
  [3, '.CCCSSSSSSSSSSS', 'S'],
  [2, '.CCCCSSSSSSSSSS', 'S'],
  [2, hb(KHL, 3, 'C'), 'C'], // the veil closes under the chin
  [3, hb(KHL, 5, 'C'), 'C'],
  [1, hb(KHL, 8, 'c'), 'c'],
]);
saintHeadRows[14] = stamp(saintHeadRows[14], [7, '###'], [21, '###']);
saintHeadRows[15] = stamp(saintHeadRows[15], [7, '$$$'], [21, '$$$']);
const SAINT_HEAD = part(saintHeadRows, { head: { x: KHL, y: 27 } });

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
  lantern: LANTERN,
  cane: CANE,
  claw: CLAW,
  // capes and crests
  scarf: SCARF,
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
