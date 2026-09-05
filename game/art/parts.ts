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
//      accent, glow, bone), each a FOUR-SHADE ramp: 0 darkest → 3 lightest,
//      hue-shifted (shadows toward violet-blue and desaturated, highlights
//      warm). actors.ts owns the colours; a part only ever names a material
//      and, where it matters, an explicit shade. Four shades per material
//      per body is the floor, not the ceiling: a garment carries fold lines
//      (shade 1) and a hem band (shade 0) as authored cells.
//   3. SHADING — `autoShade` below. One key light from the upper LEFT:
//      the upper-left silhouette takes a one-cell RIM in the material's
//      lightest shade, the lower-right silhouette takes the material's dark
//      rim, and inside those, top-left faces catch the light while
//      bottom-right faces fall into shadow. The rim never closes into a loop,
//      which is what separates a lit figure from an outlined sticker.
//      Material boundaries inside a part (a belt over a tunic, a trim down a
//      vest) get the same one-cell light/shadow step, which is what makes
//      trims, hems and buckles read. Glow inverts the rule — brightest in
//      the core, dimmest at the edge — so a flame or an orb looks lit.
//   4. OUTLINES are therefore selective and per-material: shade 0 of the
//      material that owns the edge, never one global black keyline, and
//      never between two shades of the same material. `#` (a dark navy ink)
//      is reserved for hand-placed features: eyes, mouths, visor slits,
//      the seam under a belt, the split between two fingers.
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
/** A hand-placed dark-navy feature line (eyes, a visor slit, the seam under a belt). */
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
 * A cell on the UPPER-LEFT silhouette takes the material's lightest shade —
 * the rim light: the top of a head, the outer shoulder, the outer thigh. A
 * cell on the lower-right silhouette takes the material's dark rim instead,
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
        // shade-3 core is deliberately hard to reach (three cells clear on
        // every side) so a glowing body keeps a hotspot, not a white mass.
        // A spark, an ember crack, a lit eye — anything three cells or
        // thinner — has no room for a falloff and is simply lit; a real body
        // of light gets the falloff, hottest in the middle.
        const thin = (empty(x - 2, y) && empty(x + 2, y)) || (empty(x, y - 2) && empty(x, y + 2));
        if (thin) {
          shade[i] = 2;
          continue;
        }
        const edge = up || down || left || right;
        const near = empty(x - 2, y) || empty(x + 2, y) || empty(x, y - 2) || empty(x, y + 2);
        const core = !(empty(x - 3, y) || empty(x + 3, y) || empty(x, y - 3) || empty(x, y + 3));
        shade[i] = edge ? 0 : near ? 1 : core ? 3 : 2;
        continue;
      }
      if (up || down || left || right) {
        shade[i] = (up || left) && !(down || right) ? 3 : 0;
        continue;
      }
      const lit = at(x - 1, y) !== m || at(x, y - 1) !== m || empty(x - 1, y - 1);
      const shd = at(x + 1, y) !== m || at(x, y + 1) !== m || empty(x + 1, y + 1);
      if (lit !== shd) {
        shade[i] = lit ? 3 : 1;
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
      shade[i] = across > 0.68 || along > 0.88 ? 1 : 2;
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

/** The five anchors every biped body shares: neck at the top centre, shoulder seam, cape collar, ground contact, centre mass. */
function bodyAnchors(lh: number, h: number, hitY: number): Partial<Record<AnchorName, Point>> {
  return { head: { x: lh, y: 0 }, hand: { x: lh, y: 3 }, capePin: { x: lh, y: 2 }, feet: { x: lh, y: h - 1 }, hit: { x: lh, y: hitY } };
}

// EMBER — a short leather-plackéted crimson vest with a bright trim down
// both front edges, a dark band at its hem, a buckled belt, creased cloth
// trousers and tall boots with a real gap between the legs.
const BODY_EMBER = part(
  bands(SLIM, [
    [2, hb(SLIM, 9, 'S'), 'S'], // neck
    [1, hb(SLIM, 5, 'L'), 'L'], // vest collar
    [1, hb(SLIM, 3, 'A'), 'A'], // shoulder line
    [7, hb(SLIM, 2, 'A', '!L'), 'L'], // crimson vest, bright trim beside a leather placket
    [1, hb(SLIM, 2, '6', '!L'), 'L'], // the vest hem falls into its darkest band
    [1, hb(SLIM, 2, '4'), 'M'], // belt strap + buckle
    [1, hb(SLIM, 2, '#'), 'M'], // seam under the belt
    [1, hb(SLIM, 3, 'C'), 'C'], // hip
    [3, hbf(SLIM, 3, 'C', 'c', [6]), 'C'], // trousers with a crease
    [1, hb(SLIM, 3, 'c'), 'c'],
    [11, stamp(hg(SLIM, 3, 7, 'C'), [8, 'c']), '.'], // legs, a five-cell gap between them
    [1, hg(SLIM, 3, 7, 'c'), '.'], // knee shadow
    [4, hg(SLIM, 3, 7, 'L'), '.'], // boot shafts
    [3, hg(SLIM, 2, 8, 'l'), '.'], // boots
  ]),
  bodyAnchors(SLIM, 38, 15),
);

// GALE — fitted leathers in the element colour, a chest strap, a buckled
// belt, creased legs and turned-down boots; the whole upper body is then
// translated forward so the figure leans into a run (the lean bends at the
// belt, a natural seam, rather than snapping mid-chest).
const galeRows = bands(SLIM, [
  [2, hb(SLIM, 9, 'S'), 'S'], // neck
  [1, hb(SLIM, 4, 'A'), 'A'], // collar
  [1, hb(SLIM, 3, 'A'), 'A'], // shoulders
  [4, hbf(SLIM, 2, 'A', 'a', [5]), 'A'], // chest
  [1, hb(SLIM, 2, 'L'), 'L'], // chest strap
  [3, hbf(SLIM, 2, 'A', 'a', [5]), 'A'], // midriff
  [1, hb(SLIM, 2, '4'), 'M'], // belt
  [1, hb(SLIM, 2, '#'), 'M'], // seam
  [1, hb(SLIM, 3, 'A'), 'A'], // hip
  [2, hb(SLIM, 4, 'A'), 'A'],
  [9, hg(SLIM, 4, 6, 'A'), '.'], // slim legs
  [2, hg(SLIM, 4, 6, 'a'), '.'],
  [5, hg(SLIM, 3, 7, 'L'), '.'], // boot shafts
  [2, hg(SLIM, 2, 8, '~'), '.'], // turned down at the top
  [3, hg(SLIM, 2, 8, 'l'), '.'],
]);
for (let i = 0; i < 17; i++) galeRows[i] = shiftX(galeRows[i], 3);
const BODY_GALE = part(galeRows, { head: { x: SLIM + 3, y: 0 }, hand: { x: SLIM + 3, y: 3 }, capePin: { x: SLIM - 4, y: 5 }, feet: { x: SLIM, y: 37 }, hit: { x: SLIM, y: 15 } });

// TIDE — a pale robe to the ground over a teal underdress, a sash, four
// vertical creases, a two-cell lit panel down the key-light side and a
// scalloped wave hem. No legs: the robe reaches the floor.
const tideRows = bands(BULK, [
  [2, hb(BULK, 11, 'S'), 'S'], // neck
  [1, hb(BULK, 7, 'C'), 'C'], // collar
  [1, hb(BULK, 5, 'A'), 'A'], // shoulders
  [3, hb(BULK, 4, 'A'), 'A'],
  [3, hb(BULK, 3, 'A'), 'A'],
  [1, hb(BULK, 3, '4'), 'M'], // sash + clasp
  [1, hb(BULK, 3, '#'), 'M'],
  [3, hbf(BULK, 3, 'A', 'a', [7]), 'A'], // the robe falls from the sash
  [4, hbf(BULK, 2, 'A', 'a', [6, 11]), 'A'],
  [5, hbf(BULK, 1, 'A', 'a', [5, 10]), 'A'],
  [6, hbf(BULK, 0, 'A', 'a', [4, 9]), 'A'], // flaring to the floor
  [2, hbf(BULK, 0, 'A', 'a', [4, 9]), 'A'],
  [1, hb(BULK, 0, '6'), '6'], // hem band, the robe's darkest
  [3, hb(BULK, 0, 'C'), 'C'], // wave hem
  [1, 'CC.CC.CC.CCC.', 'C'], // scallop
  [1, '.C..C..C..CC.', '.'],
]);
const BODY_TIDE = part(stampRows(tideRows, 16, 29, [8, '!!']), bodyAnchors(BULK, 38, 16));

// BASALT — mail with a dark tabard over it, a heavy belt, mailed legs and
// sabatons. The mail shows as a three-cell band down each side of the
// tabard so the two materials both read, and the tabard skirt is creased.
const BODY_BASALT = part(
  bands(BULK, [
    [2, hb(BULK, 11, 'M'), 'M'], // gorget
    [1, hb(BULK, 3, 'M'), 'M'], // pauldron line
    [2, hb(BULK, 1, 'M'), 'M'],
    [1, hb(BULK, 2, 'm'), 'm'], // pauldron underside
    [8, '.MMMAAAAAAAAAA', 'A'], // tabard over mail
    [1, '.MMM4444444444', 'M'], // belt + buckle
    [1, '.MMM##########', 'M'], // seam
    [5, '.MMMAAaAAAAaAA', 'A'], // tabard skirt, creased
    [1, '.MMMaaaaaaaaaa', 'a'], // hem shadow
    [1, hb(BULK, 1, '6'), '6'], // hem band
    [7, hg(BULK, 4, 9, 'M'), '.'], // mailed legs
    [2, hg(BULK, 4, 9, 'm'), '.'],
    [3, hg(BULK, 3, 10, 'M'), '.'], // sabatons
    [3, hg(BULK, 3, 10, 'm'), '.'],
  ]),
  bodyAnchors(BULK, 38, 15),
);

// SABLE — a hooded cloak to the knees over dark leathers: the cloak IS the
// silhouette, its plum lining showing as a band down the front where it
// hangs open and as a cowl draped over both shoulders, and the legs below.
const BODY_SABLE = part(
  bands(WIDE, [
    [2, hb(WIDE, 10, 'D'), 'D'], // collar of the cowl, not bare neck
    [1, hb(WIDE, 5, 'A'), 'A'], // cloak collar
    [2, hb(WIDE, 2, 'D'), 'D'], // the cowl drapes onto the shoulders
    [1, hb(WIDE, 2, 'd'), 'd'],
    [3, hbf(WIDE, 1, 'A', 'a', [5], 'D'), 'D'], // cloak, a lining edge where it hangs open
    [1, hb(WIDE, 1, '4'), 'M'], // belt over the cloak
    [1, hb(WIDE, 1, '#'), 'M'],
    [6, hbf(WIDE, 0, 'A', 'a', [4, 9], 'D'), 'D'],
    [4, hbf(WIDE, 0, 'A', 'a', [3, 8], 'D'), 'D'],
    [1, hb(WIDE, 0, 'a', 'd'), 'd'],
    [1, hb(WIDE, 0, '6'), '6'], // cloak hem
    [6, hg(WIDE, 4, 6, 'L'), '.'], // leathered legs
    [2, hg(WIDE, 4, 6, 'l'), '.'],
    [4, hg(WIDE, 3, 7, '4'), '.'], // soft boots
    [3, hg(WIDE, 3, 7, 'l'), '.'],
  ]),
  bodyAnchors(WIDE, 38, 15),
);

// LUMEN — TWO gold shoulder plates with a clean lower edge (not a dithered
// mantle) over a long creased tunic, a cinched sash, a gold hem trim, and
// boots peeking out under it.
const BODY_LUMEN = part(
  bands(WIDE, [
    [2, hb(WIDE, 10, 'S'), 'S'], // neck
    [1, hb(WIDE, 6, 'A'), 'A'], // gold collar
    [3, hb(WIDE, 1, 'A', 'CCCC'), 'C'], // two shoulder plates, clean inner edge
    [1, hb(WIDE, 1, '6', 'CCCC'), 'C'], // and a clean lower edge
    [4, hbf(WIDE, 2, 'C', 'c', [6]), 'C'], // tunic
    [1, hb(WIDE, 2, '4'), 'M'], // sash + clasp
    [1, hb(WIDE, 2, '#'), 'M'],
    [4, hbf(WIDE, 2, 'C', 'c', [6, 10]), 'C'],
    [4, hbf(WIDE, 1, 'C', 'c', [5, 9]), 'C'],
    [4, hbf(WIDE, 0, 'C', 'c', [4, 8]), 'C'],
    [1, hb(WIDE, 0, 'A'), 'A'], // hem trim
    [1, hb(WIDE, 0, '2'), '2'], // hem band
    [5, hg(WIDE, 4, 6, 'C'), '.'], // legs under the tunic
    [3, hg(WIDE, 3, 7, 'L'), '.'], // boots
    [3, hg(WIDE, 3, 7, 'l'), '.'],
  ]),
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
  /** Face material — `s` for a face inside a deep hood, plain `S` in the open. */
  skin?: string;
  eye?: string;
  /** Outer end of the brow dropped (1) or raised (-1) by a cell — the single strongest read of temperament at this size. */
  brow?: number;
  /** Mouth width in cells, 1–3. */
  mouth?: number;
  /** A one-cell cheek shadow under each eye. */
  cheek?: boolean;
}

/**
 * The ten rows every human face shares: forehead under a cast hair shadow,
 * a brow, a 2x2 eye cluster each side with a one-cell catchlight, cheeks, a
 * mouth, jaw and chin. The eyes sit two rows higher and one cell closer
 * together than a naive centre would put them, which is what stops every
 * character reading as the same doll.
 */
function faceBlock(opts: FaceOpts): string[] {
  const { side, skin = 'S', eye = '#', brow = 0, mouth = 1, cheek = false } = opts;
  const r = (pad: number, sides: number): string => sym(HLH, '.'.repeat(pad) + side.repeat(sides) + skin.repeat(Math.max(0, HLH - pad - sides)), skin);
  const dim = skin === 'S' ? 's' : skin;
  // Seventeen cells of face inside twenty-three of head, tapering to seven at
  // the chin — the hair, hood or helm carries the rest of the width, which is
  // what keeps a head from reading as a doll's.
  const rows = [r(0, 4), r(0, 4), r(0, 4), r(0, 4), r(1, 4), r(2, 4), r(3, 4), r(4, 4), r(5, 4), r(6, 4)];
  rows[0] = stamp(rows[0], [4, dim.repeat(2 * HLH - 7)]); // the fringe casts onto the brow
  rows[1] = stamp(rows[1], [4, dim], [2 * HLH - 4, dim]); // and down both temples
  if (brow !== 0) {
    const b = brow > 0 ? dim : skin === 'S' ? '$' : skin;
    rows[1] = stamp(rows[1], [HLH - 5, b], [HLH + 4, b]);
  }
  rows[1] = stamp(rows[1], [HLH - 4, '$' + eye], [HLH + 3, eye + '$']); // eyes, raised two rows
  rows[2] = stamp(rows[2], [HLH - 4, eye + eye], [HLH + 3, eye + eye]);
  if (cheek) rows[3] = stamp(rows[3], [HLH - 4, dim + dim], [HLH + 3, dim + dim]);
  rows[3] = stamp(rows[3], [HLH, dim]); // the bridge of a nose
  rows[5] = stamp(rows[5], [HLH - ((mouth / 2) | 0), dim.repeat(mouth)]);
  rows[7] = stamp(rows[7], [HLH - 2, dim.repeat(5)]); // and a chin shadow under it
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
const HEAD_EMBER = part([...emberCrown, sym(HLH, 'HHhHHHHHHHh', 'H'), sym(HLH, 'HHHhHHHHHHH', 'H'), ...faceBlock({ side: 'H', brow: 1, cheek: true })], NECK);

// GALE — a windswept crop, the whole mass leaning back off the run; a
// raised brow and a wide mouth: the only one of the six who looks cheerful.
const galeCrown = crown('H', [9, 7, 5, 3, 1, 0, 0], [-6, -6, -5, -4, -3, -2, -1]);
galeCrown[4] = stamp(galeCrown[4], [2, '^^^^^^']);
galeCrown[5] = stamp(galeCrown[5], [1, '^^^^']);
const HEAD_GALE = part([...galeCrown, shiftX(sym(HLH, 'HhHHHHHHHHh', 'H'), -2), shiftX(sym(HLH, 'HHhHHHHHHHH', 'H'), -1), ...faceBlock({ side: 'H', brow: -1, mouth: 3 })], NECK);

// TIDE — a deep teal hood with dark hair showing beneath it, and a level
// brow: the composed one.
const HEAD_TIDE = part(
  [...crown('C', [8, 6, 4, 2, 1, 0, 0, 0, 0]), ...faceBlock({ side: 'C' }).map((row, i) => (i < 2 ? stamp(row, [HLH - 8, 'HHHH'], [HLH + 5, 'HHHH']) : row))],
  NECK,
);

// BASALT — a full iron helm: ONE continuous visor slit with a single glint,
// breathing holes below it, and a helm deliberately NARROWER than the
// pauldrons that carry it. No face at all, which is the point.
const basaltHelm = [
  ...crown('M', [4, 3, 2, 2, 2, 2, 2]),
  stamp(sym(HLH, '...########', '#'), [3, 'M'], [4, '*']), // slit + glint
  sym(HLH, '...########', '#'),
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
const HEAD_PYRE = part(
  [
    ...crown('M', [7, 5, 3, 2, 2, 2, 2]).map((r, i) => (i > 1 ? stamp(r, [HLH - 1, '***']) : r)), // the keel
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [HLH - 1, '***'], [4, '###'], [16, '###']), // brow keeled between two eye holes
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [HLH - 1, '*m*'], [4, '###'], [16, '###']),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [6, '#'], [9, '#'], [13, '#'], [16, '#']),
    sym(HLH, hb(HLH, 2, 'm'), 'm'),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    sym(HLH, hb(HLH, 4, 'm'), 'm'),
    sym(HLH, hb(HLH, 5, 'M'), 'M'),
    sym(HLH, hb(HLH, 6, 'M'), 'M'),
    sym(HLH, hb(HLH, 7, 'm'), 'm'),
  ],
  NECK,
);

// DROWNED KNIGHT — a helm the sea has been through: the crown BROKEN open
// along the top, holes rusted through the cheek, and a ragged lower edge.
const HEAD_DROWNED = part(
  [
    stamp(sym(HLH, hb(HLH, 4, 'M'), 'M'), [7, '..'], [12, '.'], [15, '..']), // the crown, broken open
    stamp(sym(HLH, hb(HLH, 3, 'M'), 'M'), [8, '.'], [14, '.']),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [5, '#'], [17, '#']),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    sym(HLH, hb(HLH, 2, 'm'), 'm'),
    stamp(sym(HLH, '..#########', '#'), [3, 'M'], [8, 'M'], [14, 'M']), // a slit with the bar rusted out of it
    stamp(sym(HLH, '..#########', '#'), [3, 'M']),
    stamp(sym(HLH, hb(HLH, 2, 'M'), 'M'), [4, '#'], [18, '#']),
    sym(HLH, hb(HLH, 2, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 2, 'm'), 'm'), [6, '#'], [16, '#']),
    sym(HLH, hb(HLH, 3, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 3, 'M'), 'M'), [9, '#'], [13, '#']),
    sym(HLH, hb(HLH, 4, 'm'), 'm'),
    stamp(sym(HLH, hb(HLH, 4, 'M'), 'M'), [7, '.'], [15, '.']), // and a ragged edge
    sym(HLH, hb(HLH, 5, 'M'), 'M'),
    stamp(sym(HLH, hb(HLH, 6, 'm'), 'm'), [11, '.']),
    sym(HLH, hb(HLH, 7, 'M'), 'M'),
  ],
  NECK,
);

// SABLE — a pointed hood with a TWO-CELL peak and a cowl draping onto the
// shoulders; its interior is pure shadow but for two lit eyes. Nothing else
// of the face reads, ever.
const HEAD_SABLE = part(
  [
    sym(HLH, hb(HLH, 10, 'A'), 'A'), // the peak
    sym(HLH, hb(HLH, 9, 'A'), 'A'),
    ...crown('A', [7, 5, 4, 3, 2, 1, 0]),
    sym(HLH, 'AAd3333333', '3'),
    stamp(sym(HLH, 'AAd3333333', '3'), [HLH - 6, 'GG'], [HLH + 5, 'GG']), // lit eyes
    stamp(sym(HLH, 'AAd3333333', '3'), [HLH - 6, 'gg'], [HLH + 5, 'gg']),
    sym(HLH, 'AAd3333333', '3'),
    sym(HLH, 'AAAd333333', '3'),
    sym(HLH, 'AAAAd33333', '3'),
    sym(HLH, hb(HLH, 0, 'A'), 'A'), // the cowl closes and spreads
    sym(HLH, hb(HLH, 0, 'a'), 'a'),
    sym(HLH, hb(HLH, 1, 'A'), 'A'),
    sym(HLH, hb(HLH, 2, 'a'), 'a'),
  ],
  NECK,
);

// LUMEN — long cream-gold hair parted off the brow, a braid down one side,
// falling well past the shoulders (the rows below the neck paint over the
// mantle, since the head layer is always on top).
const lumenCrown = crown('H', [8, 6, 4, 2, 1, 0, 0]);
lumenCrown[4] = stamp(lumenCrown[4], [4, '^^^^^^']);
lumenCrown[5] = stamp(lumenCrown[5], [3, '^^^^']);
const HEAD_LUMEN = part(
  [
    ...lumenCrown,
    sym(HLH, 'HHhHHHHHHHH', 'h'),
    sym(HLH, 'HHHhHHHHHHH', 'H'),
    ...faceBlock({ side: 'H', mouth: 2 }),
    stamp(sym(HLH, hb(HLH, 5, 'H'), '.'), [6, '^']),
    stamp(sym(HLH, hb(HLH, 6, 'H'), '.'), [7, 'h']),
    stamp(sym(HLH, hb(HLH, 7, 'H'), '.'), [8, '^']),
    sym(HLH, hb(HLH, 8, 'h'), '.'),
  ],
  NECK,
);

// --- Arms and hands -----------------------------------------------------------
// An arms part holds BOTH arms as one symmetric layer that lands on the
// body's shoulder seam, so a figure never reads as one-armed. Twenty-two
// rows: a shoulder cap, an upper arm one cell narrower, a forearm one
// narrower again, and then a real five-cell HAND that juts back out — the
// widest thing below the elbow, split by an ink line between the fingers and
// closed by a knuckle shadow. `weaponGrip` is the centre of the right fist,
// and every weapon's own grip lands there, which is what puts a haft IN a
// hand instead of beside one.

const ALH = 13; // arms half-width; composed 27 — one cell proud of a slim body on each side
const PLH = 15; // plated arms: 31, two cells proud of an armoured body on each side
const RLH = 14; // wide robe sleeves: 29

interface ArmOpts {
  /** Sleeve or bare-arm material. */
  arm: string;
  /** Forearm covering — a bracer, a vambrace, a gold cuff, or more sleeve. */
  fore: string;
  /** The one-cell seam where the covering ends. */
  cuff: string;
  /** Hand material: skin for bare, leather for gloved, metal for a gauntlet. */
  hand: string;
  handShadow: string;
}

/** Both arms of a hero, ending in hands. `w` is the shoulder width; the limb narrows by one to the elbow and again to the wrist, then the fist comes back out to the full shoulder width. */
function armsPart(lh: number, o: ArmOpts, w = 5): PartDef {
  const dim = o.arm.toLowerCase();
  const rows = bands(lh, [
    [3, hg(lh, 0, w, o.arm), '.'], // shoulder cap
    [1, hg(lh, 0, w, dim), '.'],
    [6, hg(lh, 0, w - 1, o.arm), '.'], // upper arm
    [1, hg(lh, 0, w - 1, dim), '.'], // elbow
    [4, hg(lh, 1, w - 2, o.fore), '.'], // forearm covering
    [1, hg(lh, 0, w, o.cuff), '.'], // cuff seam
    [5, hg(lh, 0, w, o.hand), '.'], // the fist, back out to the widest
    [1, hg(lh, 0, w, o.handShadow), '.'], // knuckle shadow
  ]);
  const rx = 2 * lh - w;
  const out = stampRows(rows, 18, 18, [2, '#'], [rx + w - 3, '#']); // the split between two fingers
  return part(out, { hand: { x: lh, y: 0 }, weaponGrip: { x: 2 * lh - ((w / 2) | 0) - 1, y: 19 } });
}

// EMBER — bare arms with leather bracers and bare hands.
const ARMS_BARE = armsPart(ALH, { arm: 'S', fore: 'L', cuff: '4', hand: 'S', handShadow: 's' });
// GALE, SABLE and the cloth-sleeved enemies — a sleeve, a cuff seam, a leather glove.
const ARMS_SLEEVE = armsPart(ALH, { arm: 'C', fore: 'C', cuff: '#', hand: 'L', handShadow: 'l' });
// LUMEN — a sleeve with a gold cuff over a bare drawing hand.
const ARMS_MANTLE = armsPart(ALH, { arm: 'C', fore: 'A', cuff: '6', hand: 'S', handShadow: 's' });
// BASALT and the knights — pauldrons, vambraces, gauntleted fists.
const ARMS_PLATE = armsPart(PLH, { arm: 'M', fore: 'M', cuff: 'm', hand: 'M', handShadow: 'm' }, 7);

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
      [1, hg(RLH, 7, 6, 'a'), '.'],
      [2, hb(RLH, 9, 'C'), 'C'], // cuffs meeting
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

// STAFF — EMBER: 58 cells, taller than its 56-cell bearer, crowned with a flame.
const STL = 4; // half-width 4 → 9 wide
const STAFF = part(
  bands(STL, [
    [1, hb(STL, 3, 'G'), 'G'],
    [1, hb(STL, 2, 'G'), 'G'],
    [2, hb(STL, 1, 'G'), 'G'],
    [4, hb(STL, 0, 'G'), 'G'], // flame body
    [2, hb(STL, 1, 'G'), 'G'],
    [1, hb(STL, 2, 'G'), 'G'],
    [1, hb(STL, 2, 'A'), 'A'], // ferrule
    [1, hb(STL, 2, '6'), '6'],
    [26, hb(STL, 3, 'L'), 'L'], // shaft
    [5, hb(STL, 3, 'A'), 'A'], // grip wrap, where the fist closes
    [11, hb(STL, 3, 'L'), 'L'],
    [1, hb(STL, 2, 'M'), 'M'], // heel cap
    [2, hb(STL, 3, 'm'), 'm'],
  ]),
  { weaponGrip: { x: STL, y: 42 } },
);

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

// BOW_TALL — LUMEN: as tall as its bearer, the limbs bowing away from a
// taut string, a wrapped grip at the centre where the fist closes.
const BOW_H = 50;
const BOW_W = 14;
const bowRows: string[] = [];
for (let i = 0; i < BOW_H; i++) {
  const t = Math.sin((Math.PI * i) / (BOW_H - 1));
  const off = 2 + Math.round(8 * t);
  const cells = new Array(BOW_W).fill('.');
  if (i > 1 && i < BOW_H - 2) cells[1] = '!'; // string
  const grip = i >= 21 && i <= 28;
  for (let k = 0; k < (grip ? 4 : 3); k++) if (off + k < BOW_W) cells[off + k] = grip ? 'L' : k === 2 ? 'a' : 'A';
  bowRows.push(cells.join(''));
}
const BOW_TALL = part(bowRows, { weaponGrip: { x: 10, y: 24 } });

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

// MACE — BASALT: a flanged head on a short haft, gripped low.
const MLH = 5;
const MACE = part(
  bands(MLH, [
    [1, hb(MLH, 3, 'M'), 'M'],
    [1, hb(MLH, 1, 'M'), 'M'],
    [2, hb(MLH, 0, 'M'), 'A'], // flanged head, accent ridge
    [3, hb(MLH, 0, 'M'), 'M'],
    [1, hb(MLH, 1, 'm'), 'm'],
    [1, hb(MLH, 2, 'M'), 'M'],
    [11, hb(MLH, 3, 'L'), 'L'], // haft
    [5, hb(MLH, 3, 'A'), 'A'], // grip wrap
    [4, hb(MLH, 3, 'L'), 'L'],
    [2, hb(MLH, 2, 'M'), 'M'], // pommel
  ]),
  { weaponGrip: { x: MLH, y: 26 } },
);

// SWORD — the knights: about body length, a fullered blade, a broad
// crossguard and a wrapped grip.
const SWL = 4;
const SWORD = part(
  bands(SWL, [
    [1, hb(SWL, 3, 'M'), 'M'],
    [2, hb(SWL, 2, 'M'), '*'],
    [22, hb(SWL, 1, 'M'), '*'], // blade + fuller highlight
    [1, hb(SWL, 1, 'm'), 'm'],
    [1, hb(SWL, 0, 'M'), 'M'], // crossguard
    [1, hb(SWL, 0, 'm'), 'm'],
    [6, hb(SWL, 3, 'L'), 'L'], // grip
    [1, hb(SWL, 2, 'A'), 'A'], // pommel
  ]),
  { weaponGrip: { x: SWL, y: 32 } },
);

// TOWER_SHIELD — BASALT: about torso size, a bevelled metal rim around a
// bold element-coloured face, the LOWER CORNERS ROUNDED off and a raised
// three-cell boss at its centre, so it reads as a held object rather than
// more chest.
const TWL = 8;
const towerRows = bands(TWL, [
  [1, hb(TWL, 2, 'M'), 'M'], // rim, chamfered at the top
  [1, hb(TWL, 1, 'M'), 'M'],
  [2, hb(TWL, 0, 'M'), 'M'],
  [4, hb(TWL, 0, 'M', 'AAAAAA'), 'A'],
  [6, hb(TWL, 0, 'M', 'AAAAAA'), 'A'],
  [4, hb(TWL, 0, 'M', 'AAAAAA'), 'A'],
  [3, hb(TWL, 0, 'm', 'aaaaaa'), 'a'],
  [2, hb(TWL, 1, 'M'), 'M'], // and rounded away at the bottom
  [1, hb(TWL, 2, 'm'), 'm'],
  [1, hb(TWL, 4, 'm'), 'm'],
]);
const TOWER_SHIELD = part(
  towerRows.map((r, i) =>
    i === 9 ? stamp(r, [TWL - 1, 'MMM']) : i === 10 ? stamp(r, [TWL - 2, '**MMm']) : i === 11 ? stamp(r, [TWL - 2, '*MMmm']) : i === 12 ? stamp(r, [TWL - 1, 'mmm']) : r,
  ),
);

// SHIELD — the knights' kite shield: a bevelled rim, an element band, a
// central boss and four rivets, tapering to a point.
const SHL = 8;
const shieldRows = bands(SHL, [
  [1, hb(SHL, 4, 'M'), 'M'],
  [1, hb(SHL, 2, 'M'), 'M'],
  [5, hb(SHL, 0, 'M'), 'M'],
  [4, hb(SHL, 0, 'A'), 'A'], // emblem band
  [6, hb(SHL, 0, 'M'), 'M'],
  [2, hb(SHL, 1, 'M'), 'M'],
  [2, hb(SHL, 2, 'M'), 'M'],
  [2, hb(SHL, 3, 'm'), 'm'],
  [2, hb(SHL, 4, 'm'), 'm'],
  [1, hb(SHL, 6, 'm'), 'm'],
]);
const riveted = stampRows(shieldRows, 3, 3, [3, '5'], [SHL * 2 - 3, '5']);
const SHIELD = part(stampRows(stampRows(riveted, 16, 16, [3, '5'], [SHL * 2 - 3, '5']), 9, 11, [SHL - 1, '*5*']));

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
const CNL = 4;
const CANE = part(
  [
    '....LLLL...',
    '...LLLLLLL.',
    '...LLL.LLLL',
    '..LLLL..LLL',
    '..LLLL.....',
    ...bands(CNL, [
      [7, hb(CNL, 2, 'L'), 'L'],
      [1, hb(CNL, 1, 'l'), 'l'], // knot
      [9, hb(CNL, 2, 'L'), 'L'],
      [1, hb(CNL, 1, 'l'), 'l'],
      [9, hb(CNL, 2, 'L'), 'L'],
      [2, hb(CNL, 2, '4'), '4'],
    ]),
  ],
  { weaponGrip: { x: 3, y: 24 } },
);

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

// --- Capes, cloaks and crests -------------------------------------------------

// SCARF — GALE: pinned at the collar and streaming back the other way from
// the lean. Its pin sits near the far RIGHT of its own grid so the streamer
// lands behind the shoulder — and the grid is only as wide as the tail is
// long, so none of it falls off the bake.
const SCARF = part(
  [
    padRow(20, 14, 'DDDDDD'),
    padRow(20, 11, 'DDDDDDDDD'),
    padRow(20, 9, 'DDDDDDDDDDD'),
    padRow(20, 7, 'DDDDDDDDDDDDD'),
    padRow(20, 5, 'DDDDDDdDDDDDDD'),
    padRow(20, 4, 'DDDDDDdDDDDDD'),
    padRow(20, 3, 'DDDDDdDDDDD'),
    padRow(20, 2, 'DDDDdDDDDD'),
    padRow(20, 2, 'DDDdDDDD'),
    padRow(20, 1, 'DDdDDDD'),
    padRow(20, 1, 'DDdDDD'),
    padRow(20, 0, 'DDDdD'),
    padRow(20, 0, 'DDd'),
    padRow(20, 1, 'Dd'),
  ],
  { capePin: { x: 18, y: 1 } },
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
  [4, hbf(BCL, 3, 'A', 'a', [9, 16]), 'A'],
  [6, hbf(BCL, 1, 'A', 'a', [7, 14], 'DD'), 'A'],
  [16, hbf(BCL, 0, 'A', 'a', [6, 13], 'DD'), 'A'],
];
const CLOAK_RAGGED = part(
  bands(BCL, [
    ...cloakTop,
    [2, hbf(BCL, 0, 'A', 'a', [6, 13], 'DD'), 'A'],
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
    [18, hbf(BCL, 0, 'A', 'a', [6, 13], 'DD'), 'A'],
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
  bands(3, [
    [1, hb(3, 2, 'G'), 'G'],
    [2, hb(3, 1, 'G'), 'G'],
    [7, hb(3, 0, 'G'), 'G'],
    [3, hb(3, 1, 'G'), 'G'],
    [2, hb(3, 2, 'A'), 'A'],
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
const hagFace = faceBlock({ side: 'C', skin: 's', brow: 1, cheek: true }).map((row, i) => (i < 2 ? stamp(row, [2, 'C'.repeat(19)]) : i > 4 ? shiftX(row, 1) : row));
const HEAD_HAG = part(
  [
    ...crown('C', [9, 7, 5, 4, 3, 2, 1, 0, 0], [-5, -5, -4, -4, -3, -2, -1, 0, 0]),
    ...stampRows(stampRows(hagFace, 3, 4, [15, 'SS']), 6, 6, [14, 'ss']), // the hooked nose and the chin under it
  ],
  NECK,
);

// HEAD_BRUTE — the Crypt Warden: a FLAT-TOPPED bucket helm, straight-sided,
// with a low slot and two ember slits behind it; no dome, no crest.
const HEAD_BRUTE = part(
  [
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
    stamp(sym(HLH, hb(HLH, 1, 'M'), 'M'), [5, '#'], [8, '#'], [14, '#'], [17, '#']),
    sym(HLH, hb(HLH, 1, 'm'), 'm'),
    sym(HLH, hb(HLH, 2, 'C'), 'C'),
    sym(HLH, hb(HLH, 3, 'C'), 'C'),
    sym(HLH, hb(HLH, 4, 'c'), 'c'),
    sym(HLH, hb(HLH, 5, 'C'), 'C'),
    sym(HLH, hb(HLH, 7, 'c'), 'c'),
  ],
  NECK,
);

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
  [1, hg2(IML, 1, 3, 6, 3, 'B'), '.'],
  [1, hb(IML, 3, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'],
  [2, hb(IML, 2, 'A'), 'A'], // eye rows
  [1, hb(IML, 3, 'a'), 'a'], // jaw shadow
  [2, hb(IML, 1, 'A'), 'A'], // hunched shoulders
  [4, hb(IML, 3, 'A'), 'A'],
  [3, hb(IML, 3, 'A', '!!'), 'A'], // belly band, lighter
  [2, hb(IML, 3, 'a'), 'a'],
  [2, hb(IML, 2, 'A'), 'A'],
  [7, hg(IML, 3, 3, 'A'), '.'], // stubby legs
  [3, hg(IML, 2, 4, 'L'), '.'], // and clawed feet

]);
impRows[6] = stamp(impRows[6], [5, 'GG'], [14, 'GG']);
impRows[7] = stamp(impRows[7], [6, '#'], [14, '#']);
const IMP_BODY = part(graft(impRows, 17, ['.AAA', '..AAA', '...AAA', '...AAA', '..AAA', '.AAA', 'AAA', '6'], 0), { feet: { x: IML, y: 31 }, hit: { x: IML, y: 15 } });

// Bat wings, spread WIDER than the imp and two shades DOWN from it, so the
// membrane sits behind the body instead of merging into it.
const IWL = 17;
const IMP_WINGS = part(
  bands(IWL, [
    [1, hg(IWL, 0, 3, 'D'), '.'],
    [2, hg(IWL, 0, 6, 'D'), '.'],
    [2, hg(IWL, 1, 8, 'D'), '.'],
    [3, hg(IWL, 2, 9, 'D'), '.'],
    [2, hg(IWL, 4, 8, 'D'), '.'],
    [2, hg(IWL, 6, 6, 'D'), '.'],
    [2, hg(IWL, 8, 4, 'd'), '.'],
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
    '....CCCCcCCCCCCCCcCCCCCCCCCCCCCCCCC.....', // shoulder and haunch breaks
    '....CCCCcCCCCCCCCcCCCCCCCCCCCCCCC.......',
    '.....CCCcCCCCCCCCcCCCCCCCCCCCCC.........',
    '.....ccccccccccccccccccccccccc..........',
    '.....CCCC..CCCC......CCCC..CCCC.........',
    ...rep(7, '.....CCCC..CCCC......CCCC..CCCC.........'),
    '.....cccc..cccc......cccc..cccc.........',
    '.....LLLL..LLLL......LLLL..LLLL.........',
    '....llllllllllll....llllllllllll........',
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
  [1, hb(WRL, 8, 'C', 'ccc'), 'c'], // the void inside the cowl
  [3, hb(WRL, 8, 'C', 'cccc'), 'c'],
  [1, hb(WRL, 9, 'C'), 'C'], // the hood closes
  [1, hb(WRL, 11, 'c'), 'c'], // on a thin neck
  [2, hb(WRL, 6, 'A'), 'A'], // shoulders
  [4, hbf(WRL, 4, 'A', 'a', [8]), 'A'],
  [8, hbf(WRL, 2, 'A', 'a', [6, 11]), 'A'], // the shroud at its widest
  [6, hbf(WRL, 3, 'A', 'a', [7, 11]), 'A'], // and drawing back in
  [2, hb(WRL, 4, 'a'), 'a'],
  [1, 'aaaaAAaAAAAaAA', 'A'], // and then frays away rather than ending flat
  [1, '...aAaA.AAaAaA', 'a'],
  [1, '...aA.a.AaaAa.', 'A'],
  [1, '....6..a.6aAa.', 'a'],
  [1, '.......6..a6..', '6'],
  [1, '..........6...', '.'],
]);
wraithRows[6] = stamp(wraithRows[6], [10, 'GG'], [17, 'GG']);
wraithRows[7] = stamp(wraithRows[7], [10, 'gg'], [17, 'gg']);
const WRAITH_BODY = part(wraithRows, { feet: { x: WRL, y: wraithRows.length - 1 }, hit: { x: WRL, y: 20 } });

// CRYPT_WARDEN — a broad shelled brute: a plate across the chest, heavy
// shoulders, a creased hide skirt, short thick legs.
const BRL = 16;
const BRUTE_BODY = part(
  bands(BRL, [
    [2, hb(BRL, 13, 'C'), 'C'], // neck
    [1, hb(BRL, 4, 'M'), 'M'], // shell shoulders
    [3, hb(BRL, 1, 'M'), 'M'],
    [2, hb(BRL, 2, 'm'), 'm'],
    [8, hb(BRL, 5, 'C', 'MMMMMMMM'), 'M'], // chest plate over hide
    [1, hb(BRL, 5, '4'), 'M'], // belt
    [1, hb(BRL, 5, '#'), 'M'],
    [6, hbf(BRL, 5, 'C', 'c', [9]), 'C'],
    [1, hb(BRL, 5, '2'), '2'], // hem band
    [7, hg(BRL, 4, 10, 'C'), '.'], // thick short legs
    [3, hg(BRL, 3, 11, 'L'), '.'],
    [3, hg(BRL, 2, 12, 'l'), '.'],
  ]),
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
  [1, hb(TDL, 1, 'a'), 'a'],
  [2, hb(TDL, 4, 'a'), 'a'],
  [4, hg2(TDL, 2, 4, 10, 4, 'A'), '.'], // squat legs
  [3, hg2(TDL, 1, 5, 9, 5, 'L'), '.'],
]);
toadRows[1] = stamp(toadRows[1], [6, '%#'], [26, '#%']); // pupils with a catchlight
toadRows[2] = stamp(toadRows[2], [6, '##'], [26, '##']);
toadRows[11] = stamp(toadRows[11], [4, '##'], [29, '##']); // the mouth turns up at both corners
toadRows[12] = stamp(toadRows[12], [5, '#'.repeat(25)]);
const TOAD_BODY = part(toadRows, { feet: { x: TDL, y: 27 }, hit: { x: TDL, y: 13 } });

// FROST_WISP — a tall crystalline shard trailing a tail of motes, nothing
// like FEN_FIRE's flame lick. Its core is deliberately capped at a two-cell
// hotspot: everything else falls to the glow ramp's cooler shades, so it
// reads as lit rather than blown out.
const WSL = 8;
const wispRows = bands(WSL, [
  [1, hb(WSL, 7, 'A'), 'A'], // spire
  [2, hb(WSL, 6, 'A'), 'A'],
  [1, hb(WSL, 5, 'g'), 'g'],
  [1, hb(WSL, 4, 'g'), 'g'],
  [1, hb(WSL, 2, 'g'), 'g'],
  [1, hb(WSL, 1, 'G'), 'G'],
  [4, hb(WSL, 0, 'G'), 'G'], // the crystal at its widest
  [1, hb(WSL, 1, 'G'), 'G'],
  [1, hb(WSL, 2, 'g'), 'g'],
  [1, hb(WSL, 3, 'g'), 'g'],
  [1, hb(WSL, 4, 'g'), 'g'],
  [2, hb(WSL, 5, 'A'), 'A'],
  [1, hb(WSL, 6, 'a'), 'a'],
  [1, hg(WSL, 6, 2, 'g'), '.'], // the tail trails away in motes
  [1, hg(WSL, 7, 1, 'g'), '.'],
  [1, hg(WSL, 6, 2, 'a'), '.'],
  [2, hg(WSL, 7, 1, 'a'), '.'],
  [1, hg(WSL, 7, 1, '6'), '.'],
  [2, hg(WSL, 7, 1, 'a'), '.'],
  [1, hg(WSL, 7, 1, '6'), '.'],
]);
const WISP_BODY = part(stampRows(wispRows, 9, 10, [WSL - 1, '@@@']), { feet: { x: WSL, y: 26 }, hit: { x: WSL, y: 10 } });

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
  [7, '...AAAAAAAAAAAAAAAAA', 'A'], // rounded shell
  [1, '....AAAAAAAAAAAAAAAA', 'A'],
  [2, '.....aaaaaaaaaaaaaaa', 'a'],
  [1, '......aaaaaaaaaaaaaa', 'a'],
  [3, hg2(CBL, 5, 3, 11, 3, 'L'), '.'], // legs
  [3, hg2(CBL, 4, 3, 10, 3, 'l'), '.'],
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
  [2, hb(FFL, 3, 'G'), 'G'],
  [4, hb(FFL, 2, 'G'), 'G'],
  [5, hb(FFL, 1, 'G'), 'G'],
  [3, hb(FFL, 2, 'g'), 'g'],
  [2, hb(FFL, 3, 'A'), 'A'],
  [2, hg(FFL, 4, 2, 'a'), '.'],
  [1, hg(FFL, 5, 1, '6'), '.'],
  [2, hg(FFL, 5, 1, 'a'), '.'],
]);
const FENFIRE_BODY = part(
  stampRows(stampRows(fenRows, 0, 4, [5, '.'], [11, '.']), 10, 14, [FFL - 1, '@@@']).map((r, i) => (i === 2 ? stamp(r, [7, 'g'], [9, 'g']) : r)),
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
  kingRibs.push(sym(KBL, hb(KBL, pad + 3, 'B'), 'B'));
  kingRibs.push(sym(KBL, hb(KBL, pad, 'B'), 'B'));
  kingRibs.push(sym(KBL, hb(KBL, KBL - 3, 'b'), 'b')); // the gap between two, spine only
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
const KING_BODY = part(stampRows(stampRows(kingRows, 5, 24, [0, 'BBB'], [38, 'BBB']), 25, 26, [1, 'BB'], [38, 'BB']), {
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
const saintRows = bands(KBL, [
  [2, hb(KBL, 16, 'S'), 'S'], // neck
  [1, hb(KBL, 10, 'A'), 'A'], // gold collar
  [2, hb(KBL, 6, 'C'), 'C'], // mantle shoulders
  [1, hb(KBL, 7, 'c'), 'c'],
  [6, hb(KBL, 4, 'C', 'AA'), 'C'], // mantle, gold placket down the front
  [1, hb(KBL, 4, 'A'), 'A'], // sash
  [1, hb(KBL, 4, '#'), 'M'],
  [8, hbf(KBL, 3, 'C', 'c', [8, 14], 'AA'), 'C'],
  [3, hbf(KBL, 2, 'C', 'c', [7, 13], 'AA'), 'C'],
  [14, hbf(KBL, 1, 'C', 'c', [6, 12], 'AA'), 'C'],
  [14, hbf(KBL, 0, 'C', 'c', [5, 11], 'AA'), 'C'],
  [4, hbf(KBL, 0, 'C', 'c', [4, 10], 'AA'), 'C'], // and flares
  [3, hb(KBL, 0, 'A'), 'A'], // gold hem
  [2, hb(KBL, 0, '2'), '2'],
]);
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
      [2, hg(SLH, 11, 8, 'c'), '.'],
      [3, hb(SLH, 13, 'A'), 'A'], // gold cuffs meeting
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
    [3, hbf(SCL, 3, 'D', 'd', [7]), 'D'],
    [5, hbf(SCL, 1, 'D', 'd', [5, 11]), 'D'],
    [12, hbf(SCL, 0, 'D', 'd', [4, 10]), 'D'],
    [4, hbf(SCL, 1, 'D', 'd', [5, 11]), 'D'],
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
