/**
 * parts-late.ts — the part grids for the acts 3-6 enemy packs: SKY RUINS,
 * ASHEN FORGE, SUNKEN VAULT and STORM SPIRE.
 *
 * CONTRACT. This module exports one plain object of `PartDef`s and performs
 * NO side effects and NO registration; `actors.ts` folds it into the library
 * with `Object.assign(PART_LIBRARY, LATE_PARTS)` before any bake can run. It
 * imports only from './parts' — importing actors.ts here would close a cycle
 * at load time.
 *
 * THE AUTHORING LAYER IS LOCAL. parts.ts keeps `part`, `autoShade` and the
 * band helpers module-private (only the materials, the step constants, the
 * `PartDef` shape and the library itself are exported), so this file carries
 * its own copy of that layer, keyed to exactly the same character alphabet
 * and the same one-key-from-the-upper-left shading law. Every grid below is
 * therefore shaded by the same rules as the act 1-2 cast, and a change to
 * parts.ts's own `autoShade` would need mirroring here — noted rather than
 * hidden.
 *
 * SCALE. These are authored at the round-10 enemy scale: a standard enemy is
 * 40-50 cells at the 2-px cell (80-100 px, 11-14 % of the 720 frame), an
 * elite 50-56, a boss 60+ on the boss canvas. The extra cells over the act
 * 1-2 cast are spent on DETAIL — a haunch, a jaw joint, a strap, a rune — not
 * on bigger blocks.
 */
import { MATERIALS, MAT_EMPTY, MAT_INK } from './parts';
import type { AnchorName, PartDef, Point } from './parts';

// --- The authoring alphabet (mirrors parts.ts) ---------------------------------
//   '.' transparent   '#' ink (dark navy) — hand-placed features only
//   material    auto  shadow(2)  lit(4)  dark(1)  deep(0)  plane(6)
//   skin        S     s          $       0        (        X
//   hair        H     h          ^       1        )        J
//   cloth       C     c          +       2        [        V
//   cloth2      D     d          =       3        ]        U
//   leather     L     l          ~       4        {        F
//   metal       M     m          *       5        }        Q
//   accent      A     a          !       6        <        Z
//   glow        G     g          @       7        >        j
//   bone        B     b          %       8        &        q

const DEEP_S = 0;
const DARK_S = 1;
const SHADOW_S = 2;
const MID_S = 3;
const LIT_S = 4;
const SPEC_S = 5;
const PLANE_S = 6;
const AUTO = -1;

interface CharDef {
  mat: number;
  shade: number;
}
const CHARS: Record<string, CharDef> = { '#': { mat: MAT_INK, shade: 0 } };
const CHAR_ROWS: readonly string[] = ['Ss$0(X', 'Hh^1)J', 'Cc+2[V', 'Dd=3]U', 'Ll~4{F', 'Mm*5}Q', 'Aa!6<Z', 'Gg@7>j', 'Bb%8&q'];
for (let m = 0; m < CHAR_ROWS.length; m++) {
  const [auto, shadow, lit, dark, deep, plane] = [...CHAR_ROWS[m]];
  CHARS[auto] = { mat: m, shade: AUTO };
  CHARS[shadow] = { mat: m, shade: SHADOW_S };
  CHARS[lit] = { mat: m, shade: LIT_S };
  CHARS[dark] = { mat: m, shade: DARK_S };
  CHARS[deep] = { mat: m, shade: DEEP_S };
  CHARS[plane] = { mat: m, shade: PLANE_S };
}
/** Every material's PLANE char keyed by any of that material's chars; glow is excluded — a light inside a cast shadow is still a light. */
const PLANE_OF: Record<string, string> = {};
for (let m = 0; m < CHAR_ROWS.length; m++) {
  if (MATERIALS[m] === 'glow') continue;
  for (const ch of CHAR_ROWS[m]) PLANE_OF[ch] = CHAR_ROWS[m][5];
}
const GLOW = MATERIALS.indexOf('glow');

/** One key light from the upper left — the same law parts.ts applies, so these grids sit in the same light as the act 1-2 cast. */
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
        const thin = (empty(x - 2, y) && empty(x + 2, y)) || (empty(x, y - 2) && empty(x, y + 2));
        if (thin) {
          shade[i] = LIT_S;
          continue;
        }
        const edge = up || down || left || right;
        const near = empty(x - 2, y) || empty(x + 2, y) || empty(x, y - 2) || empty(x, y + 2);
        const core = !(empty(x - 3, y) || empty(x + 3, y) || empty(x, y - 3) || empty(x, y + 3));
        shade[i] = edge ? DARK_S : near ? SHADOW_S : core ? SPEC_S : LIT_S;
        continue;
      }
      if (up || down || left || right) {
        shade[i] = (up || left) && !(down || right) ? SPEC_S : DARK_S;
        continue;
      }
      const lit = at(x - 1, y) !== m || at(x, y - 1) !== m || empty(x - 1, y - 1);
      const shd = at(x + 1, y) !== m || at(x, y + 1) !== m || empty(x + 1, y + 1);
      if (lit !== shd) {
        shade[i] = lit ? LIT_S : SHADOW_S;
        continue;
      }
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
      shade[i] = across > 0.68 || along > 0.88 ? SHADOW_S : MID_S;
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
  for (let i = 0; i < shade.length; i++) if (shade[i] === AUTO) shade[i] = MID_S;
  return { w, h, mat, shade, anchors };
}

// --- Band helpers (mirrors parts.ts) -------------------------------------------

/** Mirror a left half (+ its centre column) into a full symmetric row. */
function sym(lh: number, left: string, centre = ''): string {
  const l = left.length >= lh ? left.slice(0, lh) : left + '.'.repeat(lh - left.length);
  return l + centre + [...l].reverse().join('');
}
/** A solid left half: `pad` blank cells from the outer edge, `ch` to the centreline, `inner` overriding the innermost cells. */
function hb(lh: number, pad: number, ch: string, inner = ''): string {
  const body = Math.max(0, lh - pad - inner.length);
  return '.'.repeat(Math.min(pad, lh)) + ch.repeat(body) + inner.slice(0, lh - Math.min(pad, lh));
}
/** `hb` with vertical fold lines knocked down to `fold` at the given offsets from the outer edge. */
function hbf(lh: number, pad: number, ch: string, fold: string, folds: readonly number[], inner = ''): string {
  const cells = [...hb(lh, pad, ch, inner)];
  for (const f of folds) if (f >= 0 && f < lh && cells[f] === ch) cells[f] = fold;
  return cells.join('');
}
type Band = readonly [n: number, left: string, centre?: string];
function bands(lh: number, list: readonly Band[]): string[] {
  const out: string[] = [];
  for (const [n, left, centre] of list) {
    const row = sym(lh, left, centre ?? '');
    for (let i = 0; i < n; i++) out.push(row);
  }
  return out;
}
/** `n` copies of one already-built (unmirrored) row. */
function rep(n: number, row: string): string[] {
  return new Array(n).fill(row);
}
function shiftX(row: string, dx: number): string {
  const w = row.length;
  if (dx > 0) return ('.'.repeat(dx) + row).slice(0, w);
  if (dx < 0) return row.slice(-dx) + '.'.repeat(-dx);
  return row;
}
/** One row of a stance: a FAR limb in from the left and a NEAR limb in from the right, each its own width and ramp step. */
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
/** An asymmetric row: a left half and a right half, each authored from its own outer edge inward, around a centre column. */
function pair(lh: number, left: string, centre: string, right: string): string {
  const fit1 = (s: string): string => (s.length >= lh ? s.slice(0, lh) : s + '.'.repeat(lh - s.length));
  return fit1(left) + centre + [...fit1(right)].reverse().join('');
}
/** `mid` placed `lead` cells into a `width`-wide blank row — a tail, a jaw, a wing tip. */
function padRow(width: number, lead: number, mid: string): string {
  return ('.'.repeat(lead) + mid).slice(0, width).padEnd(width, '.');
}
/** Overwrite cells of an already-built row, left to right. */
function stamp(row: string, ...edits: readonly (readonly [x: number, s: string])[]): string {
  const cells = [...row];
  for (const [x, s] of edits) for (let i = 0; i < s.length; i++) if (x + i >= 0 && x + i < cells.length) cells[x + i] = s[i];
  return cells.join('');
}
function stampRows(rows: readonly string[], from: number, to: number, ...edits: readonly (readonly [x: number, s: string])[]): string[] {
  const out = rows.slice();
  for (let y = from; y <= to && y < out.length; y++) if (y >= 0) out[y] = stamp(out[y], ...edits);
  return out;
}
/** Drop a rectangular region into the PLANE step, material by material — the round-8 authored dark plane. */
function castPlane(rows: readonly string[], y0: number, y1: number, x0: number, x1: number): string[] {
  return rows.map((r, y) => {
    if (y < y0 || y > y1) return r;
    const cells = [...r];
    for (let x = Math.max(0, x0); x <= x1 && x < cells.length; x++) {
      const p = PLANE_OF[cells[x]];
      if (p) cells[x] = p;
    }
    return cells.join('');
  });
}
/** The chest plane as a WEDGE: widest where the chin touches, retreating from the lit side a cell a row. */
function castChinShadow(rows: readonly string[], top: number, lh: number, depth: number, spread = 5): string[] {
  let out = rows.slice();
  for (let i = 0; i <= depth; i++) {
    const left = lh - spread + Math.min(spread + 1, Math.max(0, i - 1));
    const right = lh + spread - 2 + (i > 1 ? 1 : 0);
    out = castPlane(out, top + i, top + i, left, right);
  }
  return out;
}
/** Shift a range of rows sideways, clipped to their own width. */
function shiftRows(rows: readonly string[], dx: number, from = 0, to = 1e9): string[] {
  return rows.map((r, i) => (i >= from && i <= to ? shiftX(r, dx) : r));
}
/** Pad a variant grid to exactly w x h, BOTTOM-aligned — every pose grid a creature owns is cut to its idle's own size. */
function fit(rows: readonly string[], w: number, h: number): string[] {
  const out: string[] = [];
  for (let i = rows.length; i < h; i++) out.push('.'.repeat(w));
  for (const r of rows) out.push(r.length >= w ? r.slice(0, w) : r.padEnd(w, '.'));
  return out.slice(Math.max(0, out.length - h));
}
function mirrorRows(rows: readonly string[]): string[] {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r.padEnd(w, '.')].reverse().join(''));
}
function firstSolid(row: string): number {
  let x = 0;
  while (x < row.length && row[x] === '.') x++;
  return x;
}
/** The far shoulder inset a cell more than the weapon side, so the top of a torso is a slope rather than a lintel. */
function shoulderDrop(rows: string[], y: number, lh: number, ch: string, farPad: number, nearPad: number): string[] {
  const out = rows.slice();
  if (y >= 0 && y < out.length) out[y] = pair(lh, hb(lh, farPad, ch), ch, hb(lh, nearPad, ch));
  return out;
}
/** Three-quarter on: the weapon-side shoulder carried forward, the far shoulder cut back, the pelvis a cell onto the weight leg. */
function turn(rows: readonly string[], o: { top: number; bottom: number; ch: string; pelvis?: [number, number]; grow?: number }): string[] {
  const w = Math.max(...rows.map((r) => r.length)) + (o.grow ?? 2);
  const out = rows.map((r) => r.padEnd(w, '.'));
  for (let y = o.top; y <= o.bottom && y < out.length; y++) {
    let x = w - 1;
    while (x >= 0 && out[y][x] === '.') x--;
    if (x >= 0) out[y] = stamp(out[y], [x + 1, o.ch.repeat(o.grow ?? 2)]);
  }
  if (o.top < out.length) out[o.top] = stamp(out[o.top], [firstSolid(out[o.top]), '..']);
  if (o.top + 1 < out.length) out[o.top + 1] = stamp(out[o.top + 1], [firstSolid(out[o.top + 1]), '.']);
  if (o.pelvis) for (let y = o.pelvis[0]; y <= o.pelvis[1] && y < out.length; y++) out[y] = shiftX(out[y], 1);
  return out;
}
/** The chin cast shadow across the chest, the chest PLANE under it, and an under-arm seam down each side. */
function selfShadow(rows: string[], deep: string, chin: number, seam: [from: number, to: number], edges: [left: number, right: number], plane = 6): string[] {
  const lh = (Math.max(...rows.map((r) => r.length)) - 1) >> 1;
  const wide = deep.repeat(11);
  let out = stampRows(rows, chin, chin, [lh - 5, wide]);
  out = castChinShadow(out, chin + 1, lh, plane);
  out = stampRows(out, seam[0], seam[1], [edges[0], deep], [edges[1], deep]);
  return out;
}
interface LegSpec {
  pad: number;
  w: number;
  leg: string;
  knee: string;
  boot: string;
  cuff: string;
}
/** A leg block in contrapposto: the near (weight) leg plants on the last row, the far one starts narrower and inset and lifts its sole two rows clear. */
function legsTurned(w: number, h: number, far: LegSpec, near: LegSpec, bootFrom: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < h; i++) {
    const farUp = i === 0;
    const farDown = i >= h - 2;
    const inBoot = i >= bootFrom;
    const cuff = i === bootFrom;
    const fc = cuff ? far.cuff : inBoot ? far.boot : i === bootFrom - 1 ? far.knee : far.leg;
    const nc = cuff ? near.cuff : inBoot ? near.boot : i === bootFrom - 1 ? near.knee : near.leg;
    const fw = farDown ? 0 : farUp ? Math.max(2, far.w - 2) : far.w;
    const fp = farUp ? far.pad + 1 : far.pad;
    out.push(stanceRow(w, fp, fw, fc, near.pad, near.w, nc));
  }
  return out;
}
/** The weight shift a figure with no legs can show: the bell swings off the head's centre line, ramping to `grow` at the hem. */
function hemShift(rows: readonly string[], from: number, ch: string, grow = 2, cut = grow): string[] {
  const span = Math.max(1, rows.length - 1 - from);
  return rows.map((r, y) => {
    if (y < from) return r;
    const g = Math.round((grow * (y - from)) / span);
    const c = Math.round((cut * (y - from)) / span);
    if (g <= 0 && c <= 0) return r;
    const cells = [...r];
    let a = 0;
    while (a < cells.length && cells[a] === '.') a++;
    let b = cells.length - 1;
    while (b >= 0 && cells[b] === '.') b--;
    if (a > b) return r;
    for (let i = 0; i < c && a + i < b; i++) cells[a + i] = '.';
    for (let i = 1; i <= g && b + i < cells.length; i++) cells[b + i] = ch;
    return cells.join('');
  });
}
/** An uneven 2-3-2 scallop: lobes of two and three cells, each hanging its own depth, no air between them. */
function scallopHem(w: number, ch: string, deepCh: string, depths: readonly number[]): string[] {
  const widths = [2, 3, 2];
  const h = Math.max(...depths);
  const rows: string[][] = [];
  for (let i = 0; i < h; i++) rows.push(new Array<string>(w).fill('.'));
  let x = 0;
  let i = 0;
  while (x < w) {
    const lw = widths[i % widths.length];
    const d = depths[i % depths.length];
    for (let k = 0; k < lw && x + k < w; k++) for (let y = 0; y < d; y++) rows[y][x + k] = y === d - 1 ? deepCh : ch;
    x += lw;
    i++;
  }
  return rows.map((r) => r.join(''));
}
/** A torso driven off the blow — sheared about `pivot`, the row that stays put, with the anchors moved by their own rows. */
function bodyRecoil(rows: readonly string[], anchors: Partial<Readonly<Record<AnchorName, Point>>>, pivot: number, k = 3): PartDef {
  const w = Math.max(...rows.map((r) => r.length)) + k;
  const shear = (y: number): number => (y < pivot ? -Math.round((k * (pivot - y)) / pivot) : 0);
  const out = rows.map((r, y) => shiftX('.'.repeat(k) + r.padEnd(w - k, '.'), shear(y)));
  const moved: Partial<Record<AnchorName, Point>> = {};
  for (const name of ['hand', 'head', 'weaponGrip', 'capePin', 'feet', 'hit'] as const) {
    const a = anchors[name];
    if (a) moved[name] = { x: a.x + k + shear(a.y), y: a.y };
  }
  return part(out, moved);
}
/** A head sheared for the recoil or the breath: every row offset by its distance from the neck, so `autoShade` recomputes the rim from the new outline. */
function headShear(rows: readonly string[], cx: number, k = 0.34, lift = 0): PartDef {
  const pad = 6;
  const w = Math.max(...rows.map((r) => r.length)) + 2 * pad;
  const h = rows.length;
  const out = rows.map((r, y) => shiftX(('.'.repeat(pad) + r).padEnd(w, '.'), Math.round((h - 1 - y) * k)));
  // The chin lift hangs `lift` rows of THROAT below the anchor, so when the rig
  // drives the head up on a hit the skull stays joined to the shoulders instead
  // of baking as its own component over a bare row.
  for (let i = 0; i < lift; i++) out.push(out[out.length - 1]);
  return part(out, { head: { x: cx + pad, y: out.length - 1 - lift } });
}

export const LATE_PARTS: Record<string, PartDef> = {};

/** Register a part under its library id. Keeps every definition below to one line of bookkeeping. */
function reg(id: string, p: PartDef): PartDef {
  LATE_PARTS[id] = p;
  return p;
}

// --- Heads, faces, arms and fists (the constructions the cast shares) ---------
// Ported from parts.ts for the same reason the shading law is: the head
// proportion (a 13-cell face inside a 23-cell head), the five-cell fist with
// its knuckle columns proud of the haft, and the asymmetric two-arm rig are
// what make these figures read as the same cast, and none of them is exported.

const HL = 11; // head half-width; composed width 23

interface FaceOpts {
  side: string;
  sideDark: string;
  skin?: string;
  eye?: string;
  sclera?: string;
  brow?: number;
  spacing?: number;
  mouth?: number;
  cheek?: boolean;
  turn?: boolean;
  deep?: string;
}
/** The ten rows every face in the cast shares — eyes raised two rows, a sclera in each, a per-character brow, and the chin's own cast shadow. */
function faceBlock(opts: FaceOpts): string[] {
  const { side, sideDark, skin = 'S', eye = '#', sclera = '$', brow = 0, spacing = 0, mouth = 1, cheek = false, deep = '(', turn = false } = opts;
  const t = turn ? 1 : 0;
  const half = (pad: number, sides: number): string =>
    '.'.repeat(pad) + side.repeat(Math.max(0, sides - 2)) + sideDark.repeat(Math.min(2, sides)) + skin.repeat(Math.max(0, HL - pad - sides));
  const r = (pad: number, sides: number): string => (t ? pair(HL, half(pad, sides + 1), skin, half(pad, sides - 1)) : sym(HL, half(pad, sides), skin));
  const dim = skin === 'S' ? 's' : skin;
  const rows = [r(0, 5), r(0, 5), r(0, 5), r(0, 5), r(1, 5), r(2, 5), r(3, 5), r(3, 5), r(4, 5), r(5, 5)];
  const e = HL - 4 - spacing - t;
  const f = HL + 3 + spacing - t;
  rows[0] = stamp(rows[0], [4, dim.repeat(2 * HL - 7)]);
  rows[0] = stamp(rows[0], [e - 1, deep.repeat(4)], [f - 1, deep.repeat(4)]);
  rows[1] = stamp(rows[1], [4, dim], [2 * HL - 4, dim]);
  if (brow !== 0) {
    const b = brow > 0 ? deep : skin === 'S' ? '$' : skin;
    rows[1] = stamp(rows[1], [e - 1, b], [f + 1, b]);
  }
  rows[1] = stamp(rows[1], [e, eye + eye], [f, eye + eye]);
  rows[2] = stamp(rows[2], [e, sclera + eye], [f, eye + sclera]);
  if (cheek) rows[3] = stamp(rows[3], [e, dim + dim], [f, dim + dim]);
  rows[3] = stamp(rows[3], [HL - t, dim]);
  rows[5] = stamp(rows[5], [HL - ((mouth / 2) | 0) - t, dim.repeat(mouth)]);
  rows[7] = stamp(rows[7], [HL - 2 - t, dim.repeat(5)]);
  rows[8] = stamp(rows[8], [HL - 1 - t, deep.repeat(3)]);
  return rows;
}
/** A hair, hood or helm crown: outer-edge insets top to bottom, optionally swept sideways per row. */
function crown(ch: string, pads: readonly number[], sweep: readonly number[] = []): string[] {
  return pads.map((pad, i) => shiftX(sym(HL, hb(HL, pad, ch), ch), sweep[i] ?? 0));
}

interface ArmOpts {
  arm: string;
  armDark: string;
  fore: string;
  cuff: string;
  hand: string;
  handDeep: string;
  nearArm?: string;
}
/** Both arms as one layer: the far one hangs to the hip, the weapon one is carried forward with its fist five rows higher and near the centre line. */
function armsPart(lh: number, o: ArmOpts, w = 5): PartDef {
  const W = 2 * lh + 1;
  const hw = w <= 5 ? 3 : 4;
  const rows: string[] = [];
  const push = (fp: number, fw: number, fc: string, np: number, nw: number, nc: string): void => {
    rows.push(stanceRow(W, fp, fw, fc, np, nw, nc));
  };
  const na = o.nearArm ?? o.arm;
  push(1, w - 1, o.arm, 0, w, o.arm);
  push(0, w, o.arm, 0, w, na);
  push(0, w, o.arm, 0, w, na);
  push(0, w, o.armDark, 0, w, o.armDark);
  push(0, w - 1, o.arm, 0, w - 1, na);
  push(0, w - 1, o.arm, 1, w - 1, na);
  push(0, w - 1, o.arm, 2, w - 1, na);
  push(0, w - 1, o.arm, 3, w - 1, o.armDark);
  push(0, w - 1, o.arm, 4, w - 1, o.fore);
  push(0, w - 1, o.arm, 5, w - 1, o.fore);
  push(0, w - 1, o.armDark, 6, hw + 1, o.fore);
  push(1, w - 2, o.fore, 6, hw + 1, o.cuff);
  push(1, w - 2, o.fore, 6, hw, o.hand);
  push(1, w - 2, o.fore, 6, hw, o.handDeep);
  push(1, w - 2, o.fore, 6, hw, o.hand);
  push(1, w - 2, o.fore, 6, hw, o.handDeep);
  push(0, w - 1, o.cuff, 0, 0, '.');
  push(0, hw, o.hand, 0, 0, '.');
  push(0, hw, o.handDeep, 0, 0, '.');
  push(0, hw, o.hand, 0, 0, '.');
  push(0, hw, o.handDeep, 0, 0, '.');
  // The one-cell seam where each limb overlaps the garment, so a shoulder sits
  // IN FRONT of the torso rather than beside it.
  const seamed = rows.map((row, y) => {
    if (y > 11) return row;
    const cells = [...row];
    let far = -1;
    for (let x = 0; x < W; x++) if (cells[x] !== '.') far = x;
    for (let x = 0; x < W; x++) {
      if (cells[x] === '.') continue;
      const inner = cells[x + 1] === '.' && x < W - 1 && x < lh + w;
      if (inner || x === far) cells[x] = o.armDark;
      break;
    }
    return cells.join('');
  });
  return part(seamed, { hand: { x: lh, y: 0 }, weaponGrip: { x: W - 7 - (hw >> 1), y: 13 } });
}
/** The recoil arms: the far one flung up and out off the blow, the weapon arm dropped to the hip and back, the weapon following its grip. */
function armsRecoil(lh: number, o: ArmOpts, w = 5): PartDef {
  const W = 2 * lh + 1;
  const hw = w <= 5 ? 3 : 4;
  const rows: string[] = [];
  const push = (fp: number, fw: number, fc: string, np: number, nw: number, nc: string): void => {
    rows.push(stanceRow(W, fp, fw, fc, np, nw, nc));
  };
  push(2, w - 1, o.arm, 3, w, o.arm);
  push(1, w, o.arm, 2, w, o.arm);
  push(0, w, o.arm, 1, w, o.arm);
  push(0, w, o.armDark, 0, w, o.armDark);
  push(0, w - 1, o.fore, 0, w - 1, o.arm);
  push(0, w - 1, o.fore, 0, w - 1, o.arm);
  push(0, hw, o.cuff, 0, w - 1, o.armDark);
  push(0, hw, o.hand, 0, w - 1, o.fore);
  push(0, hw, o.handDeep, 0, w - 1, o.fore);
  push(0, hw, o.hand, 1, w - 1, o.fore);
  push(0, hw, o.handDeep, 2, w - 1, o.fore);
  push(0, 0, '.', 3, w - 1, o.fore);
  push(0, 0, '.', 3, hw + 1, o.cuff);
  push(0, 0, '.', 3, hw, o.hand);
  push(0, 0, '.', 3, hw, o.handDeep);
  push(0, 0, '.', 3, hw, o.hand);
  push(0, 0, '.', 3, hw, o.handDeep);
  return part(rows, { hand: { x: lh, y: 0 }, weaponGrip: { x: W - 4 - (hw >> 1), y: 14 } });
}
interface FistOpts {
  hand: string;
  notch: string;
  edge: string;
  deep: string;
  lit: string;
  cuff: string;
  wide?: boolean;
}
/** The fist that closes OVER a haft — wider than the shaft, so a knuckle column stands proud on each side and two creases run across it. */
function fingersPart(o: FistOpts): PartDef {
  const n = o.wide ? 4 : 3;
  const rows = [
    '.' + o.cuff.repeat(n) + '.',
    o.edge + o.lit + o.hand.repeat(n - 1) + o.edge,
    o.edge + o.notch.repeat(n) + o.edge,
    o.edge + o.hand.repeat(n) + o.edge,
    o.edge + o.notch.repeat(n) + o.edge,
    '.' + o.hand.repeat(n) + '.',
    '.' + o.deep.repeat(n) + '.',
  ];
  return part(rows, { weaponGrip: { x: ((n + 2) / 2) | 0, y: 3 } });
}
/** A head seen from above with the chin tucked in and both eyes closed — the one pose a rotation cannot fake. */
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
function fallenHead(o: { crown: string; dark: string; face?: string; eye?: string; deep?: string }, flip = false): PartDef {
  const rows = flip ? mirrorRows(fallenHeadRows(o)) : fallenHeadRows(o);
  return { ...part(rows), anchors: flip ? { head: { x: rows[0].length - 10, y: 5 } } : { head: { x: 15, y: 3 } } };
}

// --- Collapse shapes ------------------------------------------------------------
// Four more silhouettes for the twenty-four, drawn (never rotated) in the same
// alphabet: G garment, D its dark step, P its deep step, B boot/limb, K that
// limb's deep step. Deliberately NOT parts.ts's six — nineteen actors already
// share those, and the pairwise death IoU is a criterion.

interface FallenShape {
  rows: readonly string[];
  anchors: Partial<Record<AnchorName, Point>>;
}
/** SLUMP — pitched forward onto both forearms, hips high on the LEFT (the mirror of KNEEL's read), the head down at the right. */
const FALLEN_SLUMP: FallenShape = {
  rows: [
    '....GGGG........................',
    '..GGGGGGGG......................',
    '.GGGGGGGGGGG....................',
    'GGGGGGGGGGGGGG..................',
    'GGGGGGGGGGGGGGGGG...............',
    'GGGGGGGGGGGGGGGGGGGG............',
    '.GGGGGGGGGGGGGGGGGGGGGG.........',
    '...GGGGGGGGGGGGGGGGGGGGGG.......',
    '....GGGGGGGGGGGGGGGGGGGGGGG.....',
    '.....GGGGGGGGGGGGGGGGGGGGGGG....',
    '.....GGGGGGGGGGGGGGGGGGGGGGDD...',
    '......DDDDDDDDDDDDDDDDDDDDDD....',
    '.......PPPPPPPPPPPPPPPPPPPP.....',
    '.......BBBBBBB...BBBBBBB........',
    '......BBBBBBBBB..BBBBBBBB.......',
    '......DDDDDDDDD..DDDDDDDD.......',
    '.....BBBBBBBB.....BBBBBBB.......',
    '.....BBBBBBBB.....BBBBBBB.......',
    '....BBBBBBBBBB...BBBBBBBBB......',
    '....KKKKKKKKKK...KKKKKKKKK......',
  ],
  anchors: { head: { x: 25, y: 8 }, hand: { x: 21, y: 8 }, capePin: { x: 17, y: 5 }, feet: { x: 16, y: 19 }, hit: { x: 16, y: 10 } },
};
/** SIDE — down on one hip with both legs swept the same way, the shoulder the high point and a long low tail of garment behind it. */
const FALLEN_SIDE: FallenShape = {
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..........GGGGGGGG..............',
    '.......GGGGGGGGGGGGG............',
    '.....GGGGGGGGGGGGGGGGG..........',
    '...GGGGGGGGGGGGGGGGGGGGG........',
    '..GGGGGGGGGGGGGGGGGGGGGGGG......',
    '.GGGGGGGGGGGGGGGGGGGGGGGGGGG....',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGD.',
    '.DDGGGGGGGGGGGGGGGGGGGGGGGGGGD..',
    '..DDDDDDDDDDDDDDDDDDDDDDDDDDD...',
    '...PPPPPPPPPPPPPPPPPPPPPPPP.....',
    '....BBBBBBBB......BBBBBBBB......',
    '....BBBBBBBB......BBBBBBBB......',
    '...BBBBBBBBB.....BBBBBBBBB......',
    '...KKKKKKKKK.....KKKKKKKKK......',
  ],
  anchors: { head: { x: 4, y: 12 }, hand: { x: 9, y: 13 }, capePin: { x: 12, y: 11 }, feet: { x: 16, y: 19 }, hit: { x: 16, y: 14 } },
};
/** PITCH — face down and flat with the far shoulder rolled under, the mass thinning to the right; the lowest of the four. */
const FALLEN_PITCH: FallenShape = {
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.......GGGGGGGG.................',
    '....GGGGGGGGGGGGGG..............',
    '..GGGGGGGGGGGGGGGGGGGG..........',
    '.GGGGGGGGGGGGGGGGGGGGGGGG.......',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGG....',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG..',
    '.DDGGGGGGGGGGGGGGGGGGGGGGGGGGGD.',
    '..DDDDDDDDDDDDDDDDDDDDDDDDDDDD..',
    '...PPPPPPPPPPPPPPPPPPPPPPPPPP...',
    '...BBBBBB.....BBBBBB....BBBBB...',
    '..BBBBBBB.....BBBBBB....BBBBB...',
    '..BBBBBBB.....BBBBBB....BBBB....',
    '..KKKKKKK.....KKKKKK....KKKK....',
  ],
  anchors: { head: { x: 6, y: 12 }, hand: { x: 11, y: 13 }, capePin: { x: 14, y: 12 }, feet: { x: 16, y: 19 }, hit: { x: 16, y: 15 } },
};
/** COIL — a body with no legs come down in a heap of its own mass: three settling coils, widest at the floor. */
const FALLEN_COIL: FallenShape = {
  rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '.............GGGGGG.............',
    '..........GGGGGGGGGGGG..........',
    '........GGGGGGGGGGGGGGGG........',
    '.......GGGGGGGGGGGGGGGGGG.......',
    '......GGGGGGGGGGGGGGGGGGGG......',
    '.....GGGGGGGGGGGGGGGGGGGGGG.....',
    '....GGGGGGGGGGGGGGGGGGGGGGGG....',
    '...GGGGGGGGGGDDDDGGGGGGGGGGGG...',
    '..GGGGGGGGGDDDDDDDDGGGGGGGGGGG..',
    '..GGGGGGGGDDDDDDDDDDGGGGGGGGGG..',
    '.GGGGGGGGGDDDDDDDDDDGGGGGGGGGGG.',
    '.DDGGGGGGGGDDDDDDDDGGGGGGGGGGDD.',
    'BBBDDDDDDDDDDDDDDDDDDDDDDDDDBBB.',
    'BBBBPPPPPPPPPPPPPPPPPPPPPPPPBBB.',
    'KKKKKPPPPPPPPPPPPPPPPPPPPPKKKKK.',
  ],
  anchors: { head: { x: 8, y: 9 }, hand: { x: 12, y: 11 }, capePin: { x: 16, y: 7 }, feet: { x: 16, y: 19 }, hit: { x: 16, y: 13 } },
};
/** Nearest-neighbour scale of an already-built grid — a boss collapse is the hero shape at 1.5x, not a hero-sized corpse under a boss-sized standing sprite. */
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

interface FallenOpts {
  g: string;
  dark: string;
  deep: string;
  boot: string;
  bootDeep: string;
}
/** A collapse in one figure's own materials, with the far arm flung forward onto the ground past the shoulder. `k` scales it — 1.5 for a boss. */
function fallenBody(o: FallenOpts, shape: FallenShape, flip = false, k = 1): PartDef {
  const src = k === 1 ? shape.rows : scaleRows(shape.rows, k, k);
  const rows = src.map((r) => r.replace(/G/g, o.g).replace(/D/g, o.dark).replace(/P/g, o.deep).replace(/B/g, o.boot).replace(/K/g, o.bootDeep));
  const y = Math.round((shape.anchors.hit?.y ?? 10) * k);
  let out = stampRows(stampRows(stampRows(rows, y - 1, y - 1, [1, o.g.repeat(4)]), y, y, [0, o.dark.repeat(4)]), y + 1, y + 1, [1, o.deep.repeat(3)]);
  const w = Math.max(...out.map((r) => r.length));
  if (flip) out = mirrorRows(out);
  const a = shape.anchors;
  const moved: Partial<Record<AnchorName, Point>> = {};
  for (const name of ['hand', 'head', 'weaponGrip', 'capePin', 'feet', 'hit'] as const) {
    const p = a[name];
    if (!p) continue;
    const sp = { x: Math.round(p.x * k), y: Math.round(p.y * k) };
    moved[name] = flip ? { x: w - 1 - sp.x, y: sp.y } : sp;
  }
  return { ...part(out), anchors: moved };
}

// --- Kits ----------------------------------------------------------------------
// One call per figure registers the whole family a rig asks for, so a new
// enemy is a silhouette plus a handful of numbers rather than nine grids of
// bookkeeping. Nothing here fakes an animation: the sway grids are genuinely
// different outlines (a hem that lags the hip, a crest sheared the other way),
// the tilt is a sheared head with the chin lifted, and the collapse is drawn.

interface HumanKit {
  /** Torso rows, already turned and self-shadowed, followed by the leg block. */
  rows: readonly string[];
  anchors: Partial<Record<AnchorName, Point>>;
  /** Where the hem starts, for the idle-B lag, and the garment char it lags in. */
  hemFrom: number;
  /** The row the recoil shear pivots about (the hem for a robe, the knee for a cloak, the pelvis for a plate skirt). */
  pivot: number;
  /** How far the shear leans. */
  lean?: number;
}
/** A body, its idle-B hem lag, and its recoil shear. */
function bodyKit(id: string, k: HumanKit): void {
  reg(`${id}_body`, part(k.rows, k.anchors));
  reg(`${id}_body_sway`, part(shiftRows(k.rows, 1, k.hemFrom, k.rows.length - 3), k.anchors));
  reg(`${id}_body_hurt`, bodyRecoil(k.rows, k.anchors, k.pivot, k.lean ?? 8));
}
interface HeadKit {
  rows: readonly string[];
  /** The neck column — where the head meets the body's own head anchor. */
  cx?: number;
  /** The fallen head's own materials. */
  down: { crown: string; dark: string; face?: string; eye?: string; deep?: string };
  downFlip?: boolean;
  /** The chin lift on the recoil tilt: the jaw comes off the neck as the skull goes back. */
  lift?: number;
}
/** A head, the two sway grids the breath swaps between, the tilt a hit throws it into, and the face-down skull it dies on. */
function headKit(id: string, k: HeadKit): void {
  const cx = k.cx ?? HL;
  const rows = k.rows;
  reg(`${id}_head`, part(rows, { head: { x: cx, y: rows.length - 1 } }));
  reg(`${id}_head_sway`, headShear(rows, cx, 0.15));
  reg(`${id}_head_sway2`, headShear(rows, cx, -0.15));
  reg(`${id}_head_tilt`, headShear(rows, cx, 0.36, k.lift ?? 0));
  reg(`${id}_head_down`, fallenHead(k.down, k.downFlip));
}
interface BeastKit {
  /** The three idle shapes: rest, the breath in, the breath out — three OUTLINES, not one at three heights. */
  idle: readonly [readonly string[], readonly string[], readonly string[]];
  /** The wind-up drawn back and the blow thrown forward; the striking part travels at least six cells. */
  wind: readonly string[];
  strike: readonly string[];
  /** The mass driven off the hit with the eye row a cell back inside the head. */
  hurt: readonly string[];
  /** The collapse — at most 55 % of the idle height, so the top of the mass falls below the idle mid-line. */
  dead: readonly (readonly string[])[];
  w: number;
  h: number;
  anchors: Partial<Record<AnchorName, Point>>;
}
/** Every grid a creature owns, all cut to the idle's own width and height so a pose swap needs no offset and the feet anchor cannot drift. */
function beastKit(id: string, k: BeastKit): void {
  const P = (rows: readonly string[]): PartDef => part(fit(rows, k.w, k.h), k.anchors);
  reg(`${id}_body`, P(k.idle[0]));
  reg(`${id}_body_b`, P(k.idle[1]));
  reg(`${id}_body_c`, P(k.idle[2]));
  reg(`${id}_wind`, P(k.wind));
  reg(`${id}_strike`, P(k.strike));
  reg(`${id}_hurt`, P(k.hurt));
  k.dead.forEach((d, i) => reg(`${id}_dead${i > 0 ? '_' + String.fromCharCode(97 + i) : ''}`, P(d)));
}

// --- A raster kit for the creature silhouettes ----------------------------------
// Eleven of these twenty-four are not bipeds: a raptor, a coil of wind, a
// thunderhead, a drake, a wolf, a column of steam, a jelly, an eel, a leviathan,
// a hawk in a stoop and a body of embers. A band table draws a torso well and an
// animal badly — every one of the act 1-2 creatures that the critic called "a
// cut gem" or "an egg" was authored as stacked horizontal runs. So these are
// built from MASSES instead: filled ellipses and tapering limbs laid into a
// grid, which is what gives a haunch, a jaw, a wing root and a coil their own
// curve — and what makes a pose variant a moved mass rather than a retyped
// sheet.

type Grid = string[][];
function grid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => new Array<string>(w).fill('.'));
}
function gridOf(rows: readonly string[]): Grid {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r.padEnd(w, '.')]);
}
function rowsOf(g: Grid): string[] {
  return g.map((r) => r.join(''));
}
function put(g: Grid, x: number, y: number, ch: string): void {
  if (y >= 0 && y < g.length && x >= 0 && x < g[y].length) g[y][x] = ch;
}
/** A filled ellipse — the mass every animal body, skull, haunch and bell is made of. `over` paints only where something is already painted. */
function ell(g: Grid, cx: number, cy: number, rx: number, ry: number, ch: string, over = false): void {
  for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) {
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.001);
      const dy = (y - cy) / (ry + 0.001);
      if (dx * dx + dy * dy > 1) continue;
      if (over && (y < 0 || y >= g.length || x < 0 || x >= g[y].length || g[y][x] === '.')) continue;
      put(g, x, y, ch);
    }
  }
}
/** A tapering capsule from (x0,y0) to (x1,y1) — a neck, a leg, a tail, a tentacle, a wing spar. */
function limb(g: Grid, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, ch: string): void {
  const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = (w0 + (w1 - w0) * t) / 2;
    ell(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, ch);
  }
}
/** A filled rectangle. */
function box(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch);
}
/**
 * THE UNDERSIDE BAND, in the material's own dark and deep steps. `autoShade`
 * gives a mass a lit upper-left rim and a dark lower-right edge, but a
 * creature also needs INTERIOR dark — the round-4 critic measured the act 1-2
 * beasts at 7-14 % below L 35 and named "the outline plus saturated green"
 * as their only anchor. This walks each column to its lowest painted cell and
 * lays `n` rows of dark under it, ending in the deep step.
 */
function underbelly(g: Grid, dark: string, deep: string, n = 3, only?: string, deepRows = 1): void {
  const h = g.length;
  const w = g[0].length;
  for (let x = 0; x < w; x++) {
    let bottom = -1;
    for (let y = 0; y < h; y++) if (g[y][x] !== '.') bottom = y;
    if (bottom < 0) continue;
    for (let i = 0; i < n; i++) {
      const y = bottom - i;
      if (y < 0 || g[y][x] === '.') break;
      if (only && g[y][x] !== only) break;
      g[y][x] = i < deepRows ? deep : dark;
    }
  }
}
/** The lit crown: `n` rows down from each column's highest painted cell take the material's lit step, so the mass reads as lit from above rather than rimmed. */
function topLight(g: Grid, lit: string, n = 2, only?: string): void {
  const h = g.length;
  const w = g[0].length;
  for (let x = 0; x < w; x++) {
    let top = -1;
    for (let y = 0; y < h; y++)
      if (g[y][x] !== '.') {
        top = y;
        break;
      }
    if (top < 0) continue;
    for (let i = 0; i < n; i++) {
      const y = top + i;
      if (y >= h || g[y][x] === '.') break;
      if (only && g[y][x] !== only) break;
      g[y][x] = lit;
    }
  }
}
/** Drop a region of a grid into the PLANE step — the authored dark side of a mass, exempt from the contrast lift. */
function planeBox(g: Grid, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, y0); y <= y1 && y < g.length; y++) {
    for (let x = Math.max(0, x0); x <= x1 && x < g[y].length; x++) {
      const p = PLANE_OF[g[y][x]];
      if (p) g[y][x] = p;
    }
  }
}
/** The same, under an ellipse — a cast shadow with a curved edge (a bell's shaded half, a skull's shadow on a chest). */
function planeEll(g: Grid, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.round(cy - ry); y <= Math.round(cy + ry); y++) {
    for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.001);
      const dy = (y - cy) / (ry + 0.001);
      if (dx * dx + dy * dy > 1) continue;
      if (y < 0 || y >= g.length || x < 0 || x >= g[y].length) continue;
      const p = PLANE_OF[g[y][x]];
      if (p) g[y][x] = p;
    }
  }
}
/** A blank grid row helper for the hand-authored rows that sit beside the masses. */
function E(w: number): string {
  return '.'.repeat(w);
}
function R(w: number, ...edits: readonly (readonly [x: number, s: string])[]): string {
  return stamp(E(w), ...edits);
}

// ================================================================================
// SKY RUINS (act 3) — WIND dominant, WATER foil, DARK boss.
// Open air over floating masonry. The pack reads against a VIOLET-GREY floor
// (`RUINS_GROUND.lit` #57506f, the lightest of the four biomes), so the stone
// here is authored WARM — a weathered sandstone — and the wind is green, not
// grey: a grey figure on that floor is a hole in it.
// ================================================================================

// --- RUIN RAPTOR — a stone-crested bird of prey, mantled over its own kill ------
// Its kit is TALON and GALE DIVE, so the silhouette is a diver at rest: the
// wings folded into two peaks ABOVE the shoulder line (the mass a hawk carries
// when it is about to drop), a short thick neck pitched forward, a hooked beak
// and a long stiff tail counterweighting it. The strike throws both wings open
// and drives the talons nine cells forward.
const RAP_W = 42;
const RAP_H = 44;
interface RaptorPose {
  /** Wing spread: 0 folded into two peaks, 1 half-open, 2 thrown wide. */
  wing?: number;
  /** The head's own offset from rest. */
  hx?: number;
  hy?: number;
  /** Body offset. */
  bx?: number;
  by?: number;
  /** Talon reach — how far forward the near leg is thrown. */
  reach?: number;
  /** The crest sweeps back on the breath. */
  crest?: number;
}
function raptorGrid(o: RaptorPose = {}): string[] {
  const { wing = 0, hx = 0, hy = 0, bx = 0, by = 0, reach = 0, crest = 0 } = o;
  const g = grid(RAP_W, RAP_H);
  // the tail first, so the body's own mass paints over its root
  limb(g, 9 + bx, 26 + by, 1 + bx, 36 + by, 8, 3, 'B');
  // the folded wing: two coverts stacked over the shoulder, opening upward
  const wy = -3 * wing;
  ell(g, 13 + bx, 17 + by + wy, 10, 6 - wing, 'A');
  ell(g, 8 + bx, 20 + by + (wy >> 1), 7, 5, 'A');
  if (wing >= 1) limb(g, 14 + bx, 15 + by + wy, 4 + bx, 4 + by + wy, 7, 3, 'A');
  if (wing >= 2) limb(g, 20 + bx, 14 + by + wy, 30 + bx, 3 + by + wy, 7, 3, 'A');
  // body, neck and skull
  ell(g, 17 + bx, 25 + by, 11, 8, 'B');
  limb(g, 24 + bx, 21 + by, 30 + hx, 11 + hy, 9, 6, 'B');
  ell(g, 32 + hx, 10 + hy, 6, 5, 'B');
  // the crest, swept back off the skull
  limb(g, 30 + hx, 6 + hy, 24 + hx - crest, 1 + hy + crest, 3, 1, 'A');
  // the beak: a straight upper mandible and a hook under it
  limb(g, 35 + hx, 11 + hy, 40 + hx, 13 + hy, 6, 3, 'L');
  limb(g, 40 + hx, 13 + hy, 38 + hx, 16 + hy, 3, 1, 'L');
  // legs — the far one set back and a step darker, the near one carrying the reach
  limb(g, 14 + bx, 30 + by, 12 + bx, 37 + by, 5, 4, 'l');
  box(g, 9 + bx, 38 + by, 15 + bx, 39 + by, 'l');
  limb(g, 22 + bx, 30 + by, 24 + bx + reach, 39 + by, 6, 4, 'L');
  box(g, 20 + bx + reach, 40 + by, 29 + bx + reach, 41 + by, 'L');
  // talons: three splayed toes, in the leather's deep step
  for (const t of [0, 3, 6]) box(g, 20 + bx + reach + t, 42 + by, 21 + bx + reach + t, 43 + by, '{');
  box(g, 9 + bx, 40 + by, 10 + bx, 41 + by, '{');
  box(g, 14 + bx, 40 + by, 15 + bx, 41 + by, '{');
  // the value hierarchy. Interior dark first: the whole underbody drops into
  // the plane step and the breast under the wing goes to the bone's own dark,
  // because the round-4 critic measured the act 1-2 beasts at 7-14 % below
  // L 35 and named the keyline as their only anchor.
  topLight(g, '%', 2, 'B');
  topLight(g, '!', 1, 'A');
  underbelly(g, '8', '&', 4, 'B');
  underbelly(g, '6', '<', 3, 'A');
  planeEll(g, 21 + bx, 28 + by, 10, 5); // the breast in the wing's own shadow
  planeBox(g, 4 + bx, 20 + by, 11 + bx, 25 + by); // and the far covert, which the key does not reach
  box(g, 22 + bx, 22 + by, 31 + bx, 24 + by, '8'); // a dark collar where the neck meets the breast
  box(g, 6 + bx, 30 + by, 16 + bx, 32 + by, '&'); // and the deep under the tail root
  // the eye, high and forward on the skull, with an ink surround
  const gr = rowsOf(g);
  return stampRows(stampRows(gr, 8 + hy, 8 + hy, [31 + hx, '#GG#']), 9 + hy, 9 + hy, [31 + hx, '#bb#']);
}
const RAPTOR_ANCH = { feet: { x: 22, y: RAP_H - 1 }, hit: { x: 20, y: 24 } };
beastKit('raptor', {
  idle: [raptorGrid(), raptorGrid({ by: 1, crest: 1, hy: 1 }), raptorGrid({ wing: 1, hy: -1, crest: 2 })],
  wind: raptorGrid({ wing: 1, hx: -5, hy: 1, bx: -2, crest: -1 }),
  strike: raptorGrid({ wing: 2, hx: 4, hy: 3, reach: 9, bx: 1 }),
  hurt: raptorGrid({ wing: 1, hx: -7, hy: -3, bx: -3, by: 1, crest: -2 }),
  dead: [
    (() => {
      // The collapse: nineteen rows against forty-four — down on one wing with
      // the other splayed flat, the skull below the idle mid-line and the beak
      // turned into the floor.
      const g = grid(RAP_W, RAP_H);
      limb(g, 12, 32, 2, 28, 7, 3, 'A');
      limb(g, 18, 34, 34, 31, 8, 3, 'A');
      ell(g, 16, 37, 12, 6, 'B');
      limb(g, 24, 36, 33, 39, 8, 5, 'B');
      ell(g, 35, 40, 5, 4, 'B');
      limb(g, 37, 41, 41, 43, 4, 2, 'L');
      limb(g, 8, 38, 1, 41, 6, 3, 'B');
      box(g, 12, 42, 18, 43, 'l');
      box(g, 21, 42, 26, 43, '{');
      topLight(g, '%', 1, 'B');
      underbelly(g, 'b', '&', 2, 'B');
      planeBox(g, 20, 34, 34, 38);
      return stampRows(rowsOf(g), 39, 39, [33, '##']);
    })(),
  ],
  w: RAP_W,
  h: RAP_H,
  anchors: RAPTOR_ANCH,
});

// --- WIND SPRITE — a coil of moving air with a lit heart -----------------------
// DAZZLE GUST blinds, so the read is a LIGHT that turns: three ribbon arcs
// spiralling round a small core, wound tighter on the wind-up and flung open
// on the strike. Deliberately NOT the frost wisp's shard — this has no hard
// facet anywhere in it, and its dark is the ribbon's own underside rather than
// a core.
const SPR_W = 40;
const SPR_H = 46;
interface SpritePose {
  /** How far the coil is wound: 0 open and slow, 1 tight, -1 flung. */
  wind?: number;
  dx?: number;
  dy?: number;
  /** The core's own pulse. */
  core?: number;
}
function spriteGrid(o: SpritePose = {}): string[] {
  const { wind = 0, dx = 0, dy = 0, core = 0 } = o;
  const g = grid(SPR_W, SPR_H);
  const cx = 20 + dx;
  const cy = 23 + dy;
  const s = 1 - 0.22 * wind;
  // three ribbons, each a tapering arc round the core at its own radius and phase
  const arc = (r0: number, ph: number, ch: string, wide: number): void => {
    let px = cx + Math.cos(ph) * r0 * s;
    let py = cy + Math.sin(ph) * r0 * s * 0.82;
    for (let i = 1; i <= 14; i++) {
      const t = i / 14;
      const a = ph + t * 3.5;
      const r = r0 * s * (1 - 0.5 * t);
      const nx = cx + Math.cos(a) * r;
      const ny = cy + Math.sin(a) * r * 0.82 - t * 5;
      limb(g, px, py, nx, ny, wide * (1 - 0.55 * t) + 1, wide * (1 - 0.6 * t) + 1, ch);
      px = nx;
      py = ny;
    }
    limb(g, px, py, cx, cy + 2, 3, 5, ch); // and the inner end runs INTO the heart
  };
  arc(21, 2.2, 'C', 7);
  arc(16, 0.2, 'A', 6);
  arc(22, 4.1, 'c', 5);
  // the heart: a small glow with a dark mantle running out of its underside,
  // never a lamp on a stick and never a cut gem
  ell(g, cx, cy + 2, (6 + core) * s, (7 + core) * s, 'G');
  ell(g, cx + 1, cy + 6, 4 * s, 3 * s, '>');
  limb(g, cx, cy + 2, cx + 9 * s, cy - 3 * s, 4, 2, 'C'); // and one ribbon runs THROUGH the heart, so the coil can never fly off it
  topLight(g, '+', 2, 'C');
  topLight(g, '!', 1, 'A');
  underbelly(g, '2', '[', 4, 'C');
  underbelly(g, '6', '<', 3, 'A');
  planeBox(g, cx + 3, cy - 4, cx + 15, cy + 11);
  // two lit slits where a face would be — what a thing that BLINDS looks at you with
  return stampRows(rowsOf(g), cy - 2, cy - 2, [cx - 3, '@#'], [cx + 2, '#@']);
}
const SPRITE_ANCH = { feet: { x: 20, y: SPR_H - 1 }, hit: { x: 20, y: 23 } };
beastKit('sprite', {
  idle: [spriteGrid(), spriteGrid({ dy: 1, core: 1 }), spriteGrid({ wind: 0.5, dy: -1 })],
  wind: spriteGrid({ wind: 1, dx: -3, dy: 1 }),
  strike: spriteGrid({ wind: -1, dx: 5, dy: -2, core: 2 }),
  hurt: spriteGrid({ wind: 0.6, dx: -6, dy: -3 }),
  dead: [
    (() => {
      // A thing made of moving air does not fall over: it GUTTERS. The coil
      // unwinds into three flat streamers lying on the floor with the heart
      // guttering low between them — sixteen rows against forty-two.
      const g = grid(SPR_W, SPR_H);
      limb(g, 2, 37, 26, 34, 6, 2, 'C');
      limb(g, 6, 41, 35, 39, 7, 2, 'c');
      limb(g, 4, 44, 30, 43, 6, 2, 'A');
      ell(g, 18, 41, 5, 3, 'G');
      ell(g, 19, 42, 3, 2, '>');
      topLight(g, '+', 1, 'C');
      underbelly(g, '2', '[', 3, 'C');
      return rowsOf(g);
    })(),
    (() => {
      const g = grid(SPR_W, SPR_H);
      limb(g, 4, 41, 24, 40, 5, 2, 'c');
      limb(g, 8, 44, 32, 43, 5, 2, '2');
      ell(g, 18, 43, 3, 2, 'g');
      return rowsOf(g);
    })(),
  ],
  w: SPR_W,
  h: SPR_H,
  anchors: SPRITE_ANCH,
});

// --- DROWNED CLOUD — a rain-heavy thunderhead ----------------------------------
// The WATER foil: it SLOWS rather than hits, so it is all mass and no limb — a
// lobed head of cloud sitting on a curtain of rain, two dim lights low in it
// where the lightning is still held. The rain strands are its legs, its
// underside is the darkest thing in the pack, and DOWNPOUR drops the whole
// curtain nine cells.
const CLD_W = 40;
const CLD_H = 44;
interface CloudPose {
  /** The curtain's reach. */
  rain?: number;
  dx?: number;
  dy?: number;
  /** Which lobe rides highest — the breath. */
  swell?: number;
  bolt?: boolean;
}
function cloudGrid(o: CloudPose = {}): string[] {
  const { rain = 0, dx = 0, dy = 0, swell = 0, bolt = false } = o;
  const g = grid(CLD_W, CLD_H);
  const cy = 14 + dy;
  // four lobes of unequal size — a cloud has no axis of symmetry
  ell(g, 12 + dx, cy + 2 - (swell === 1 ? 2 : 0), 11, 7, 'C');
  ell(g, 24 + dx, cy - 1 - (swell === 2 ? 2 : 0), 9, 8, 'C');
  ell(g, 32 + dx, cy + 4 - (swell === 3 ? 2 : 0), 7, 6, 'C');
  ell(g, 18 + dx, cy + 7, 15, 8, 'C');
  // the rain curtain: nine strands of unequal length and pitch
  // The strands start four rows INSIDE the mass, not under it: a curtain that
  // begins below the cloud's own lowest cell bakes as a second component, which
  // is exactly what the first measurement of this sprite showed.
  const strands = [0, 3, 6, 9, 13, 17, 21, 25, 28];
  box(g, 4 + dx, cy + 8, 35 + dx, cy + 10, 'c'); // the base course the curtain hangs from
  strands.forEach((sx, i) => {
    const len = Math.min(26, 13 + ((i * 5) % 9) + rain);
    limb(g, 5 + dx + sx, cy + 2, 3 + dx + sx, cy + 8 + len, 3 - (i % 2), 1, i % 3 === 0 ? 'A' : 'a');
  });
  topLight(g, '+', 3, 'C');
  underbelly(g, '2', '[', 3, 'C', 2);
  box(g, 5 + dx, cy + 9, 34 + dx, cy + 10, '['); // a deep course under the mass, where the curtain leaves it
  planeEll(g, 26 + dx, cy + 6, 12, 7);
  planeBox(g, 6 + dx, cy + 9, 34 + dx, cy + 11);
  let out = rowsOf(g);
  // the two held lights, low in the mass where a face would be
  out = stampRows(out, cy + 4, cy + 4, [11 + dx, 'G#'], [19 + dx, '#G']);
  out = stampRows(out, cy + 5, cy + 5, [11 + dx, '2['], [19 + dx, '[2']);
  if (bolt) {
    // and the bolt it has been holding, let go down the curtain
    const lit = (y: number, x: number, str: string): void => {
      if (y < 0 || y >= out.length) return;
      const cells = [...out[y]];
      for (let i = 0; i < str.length; i++) if (x + i < cells.length && cells[x + i] !== '.') cells[x + i] = str[i];
      out[y] = cells.join('');
    };
    for (let i = 0; i < 12; i++) lit(cy + 11 + i, 15 + dx + ((i % 3) - 1), '@@');
  }
  return out;
}
const CLOUD_ANCH = { feet: { x: 18, y: CLD_H - 1 }, hit: { x: 18, y: 16 } };
beastKit('cloud', {
  idle: [cloudGrid(), cloudGrid({ dy: 1, swell: 2, rain: -1 }), cloudGrid({ swell: 1, rain: 1, dx: 1 })],
  wind: cloudGrid({ dx: -4, dy: -2, rain: -6, swell: 3 }),
  strike: cloudGrid({ dx: 3, dy: 2, rain: 9, bolt: true }),
  hurt: cloudGrid({ dx: -7, dy: -3, rain: -4, swell: 1 }),
  dead: [
    (() => {
      // It does not fall — it RAINS OUT: the head flattens to a third of its
      // height and the curtain collapses into a puddle of short strands.
      const g = grid(CLD_W, CLD_H);
      ell(g, 14, 36, 13, 4, 'C');
      ell(g, 27, 38, 9, 3, 'c');
      ell(g, 20, 40, 16, 3, 'c');
      for (const sx of [4, 9, 15, 22, 28, 33]) limb(g, sx, 41, sx - 1, 43, 2, 1, 'a');
      topLight(g, '+', 1, 'C');
      underbelly(g, '2', '[', 2, 'C');
      return rowsOf(g);
    })(),
  ],
  w: CLD_W,
  h: CLD_H,
  anchors: CLOUD_ANCH,
});

// --- STORM DRAKE (elite) — the pack's wingspan ----------------------------------
// TEMPEST WING buffs itself and GALE BREATH sweeps the party, so the wings are
// the silhouette and the head is a nozzle on a long neck. Fifty-three cells and
// wider than anything else in the biome: the elite has to read as the elite
// from across the stage.
const DRK_W = 58;
const DRK_H = 54;
interface DrakePose {
  /** Wing sweep: 0 half-furled, 1 raised, 2 thrown wide and forward. */
  wing?: number;
  hx?: number;
  hy?: number;
  bx?: number;
  by?: number;
  /** The jaw opens on the breath. */
  jaw?: number;
}
/** One membrane: a spar out to `tip`, and four ribs falling off it into a scalloped trailing edge. */
function drakeWing(g: Grid, rx: number, ry: number, tx: number, ty: number, ch: string, dark: string): void {
  limb(g, rx, ry, tx, ty, 7, 3, dark);
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    const ex = rx + (tx - rx) * t;
    const ey = ry + (ty - ry) * t;
    limb(g, rx, ry, ex + (rx - tx) * 0.16 * t, ey + 12 * t, 6 - i, 3, ch);
    limb(g, ex, ey, ex + (rx - tx) * 0.16 * t, ey + 12 * t, 4, 3, ch);
  }
}
function drakeGrid(o: DrakePose = {}): string[] {
  const { wing = 0, hx = 0, hy = 0, bx = 0, by = 0, jaw = 0 } = o;
  const g = grid(DRK_W, DRK_H);
  const wl = wing;
  // the far wing goes back over the shoulder, the near one forward — never a pair
  drakeWing(g, 20 + bx, 26 + by, Math.max(4, 6 + bx - 2 * wl), 16 + by - 6 * wl, 'D', '3');
  // tail, body, haunch
  limb(g, 14 + bx, 34 + by, 1 + bx, 47 + by, 9, 3, 'L');
  ell(g, 15 + bx, 33 + by, 9, 8, 'L');
  ell(g, 24 + bx, 32 + by, 13, 9, 'L');
  drakeWing(g, 27 + bx, 25 + by, Math.min(50, 45 + bx + 4 * wl), 12 + by - 6 * wl, 'D', '3');
  // neck and skull
  limb(g, 32 + bx, 27 + by, 43 + hx, 13 + hy, 10, 6, 'L');
  ell(g, 46 + hx, 11 + hy, 6, 5, 'L');
  // horns, a brow ridge and the jaw
  limb(g, 45 + hx, 7 + hy, 38 + hx, 1 + hy, 4, 1, 'B');
  limb(g, 48 + hx, 8 + hy, 44 + hx, 3 + hy, 3, 1, 'B');
  limb(g, 48 + hx, 13 + hy, 56 + hx, 14 + hy, 5, 2, 'L');
  limb(g, 45 + hx, 13 + hy, 55 + hx, 17 + hy + 2 * jaw, 5, 3, 'B');
  // four legs on four different pitches
  limb(g, 12 + bx, 38 + by, 10 + bx, 47 + by, 8, 5, 'l');
  limb(g, 19 + bx, 39 + by, 20 + bx, 48 + by, 7, 4, 'L');
  limb(g, 29 + bx, 38 + by, 27 + bx, 46 + by, 6, 4, 'l');
  limb(g, 34 + bx, 37 + by, 37 + bx, 48 + by, 7, 4, 'L');
  box(g, 7 + bx, 48 + by, 14 + bx, 49 + by, 'l');
  box(g, 16 + bx, 49 + by, 24 + bx, 50 + by, 'L');
  box(g, 33 + bx, 49 + by, 41 + bx, 50 + by, 'L');
  for (const t of [0, 3, 6]) {
    box(g, 16 + bx + t, 51 + by, 17 + bx + t, 52 + by, '{');
    box(g, 33 + bx + t, 51 + by, 34 + bx + t, 52 + by, '{');
  }
  box(g, 8 + bx, 50 + by, 13 + bx, 51 + by, '{');
  topLight(g, '~', 2, 'L');
  topLight(g, '=', 1, 'D');
  underbelly(g, '4', '{', 3, 'L');
  underbelly(g, '3', ']', 2, 'D');
  planeEll(g, 30 + bx, 34 + by, 12, 8);
  planeBox(g, 34 + bx, 20 + by, 44 + bx, 27 + by);
  let out = rowsOf(g);
  out = stampRows(out, 9 + hy, 9 + hy, [44 + hx, '#GG']);
  out = stampRows(out, 10 + hy, 10 + hy, [44 + hx, '#44']);
  return out;
}
const DRAKE_ANCH = { feet: { x: 24, y: DRK_H - 1 }, hit: { x: 26, y: 31 } };
beastKit('drake', {
  idle: [drakeGrid(), drakeGrid({ by: 1, hy: 1, jaw: 1 }), drakeGrid({ wing: 1, hy: -2 })],
  wind: drakeGrid({ wing: 1, hx: -6, hy: 2, bx: -2, jaw: 1 }),
  strike: drakeGrid({ wing: 2, hx: 3, hy: 4, jaw: 4, bx: 1 }),
  hurt: drakeGrid({ wing: 1, hx: -8, hy: -4, bx: -3, by: 1, jaw: 3 }),
  dead: [
    (() => {
      // Down on its side with both wings crumpled under it, the neck folded
      // back over the body and the skull on the floor — twenty-two rows.
      const g = grid(DRK_W, DRK_H);
      limb(g, 6, 36, 26, 33, 8, 3, '3');
      limb(g, 22, 35, 46, 36, 7, 3, '3');
      limb(g, 2, 46, 16, 42, 7, 3, 'L');
      ell(g, 26, 42, 15, 8, 'L');
      limb(g, 34, 40, 46, 44, 9, 6, 'L');
      ell(g, 48, 46, 6, 5, 'L');
      limb(g, 48, 42, 41, 37, 3, 1, 'B');
      limb(g, 50, 48, 57, 50, 5, 2, 'B');
      limb(g, 18, 46, 14, 52, 6, 4, 'l');
      limb(g, 33, 46, 37, 52, 6, 4, 'l');
      topLight(g, '~', 1, 'L');
      underbelly(g, '4', '{', 2, 'L');
      planeBox(g, 30, 44, 46, 50);
      return stampRows(rowsOf(g), 45, 45, [46, '##']);
    })(),
  ],
  w: DRK_W,
  h: DRK_H,
  anchors: DRAKE_ANCH,
});

// --- RUIN SENTINEL — the pack's guard ------------------------------------------
// WARD STONE shields the pack and MEND ECHO heals it, so this is masonry that
// GUARDS: a lintel of shoulder three cells past the hips, a chest drum carved
// with a rune band that is the only lit thing on it, a keystone belt, and a
// slab skirt to the shins. Its helm is a flat-topped keystone tapering DOWNWARD
// with one carved slot — no bucket, no keel, no crown, no hood.
const SNL = 16;
const SNW = 2 * SNL + 1;
const sentinelTop = bands(SNL, [
  [2, hb(SNL, 12, '5'), '5'], //  0-1  the neck column, the dark it sits on
  [1, hb(SNL, 1, 'M'), 'M'], //  2    the lintel, three cells past the hips
  [2, hb(SNL, 0, 'M'), 'M'], //  3-4
  [1, hb(SNL, 2, '5'), '5'], //  5    the slab's underside
  [1, hb(SNL, 3, '}'), '}'], //  6    and the deep seam under that
  [3, hbf(SNL, 4, 'M', 'm', [6, 10]), 'M'], //  7-9  the chest drum, two vertical courses
  [1, hb(SNL, 4, 'M', 'AA'), 'A'], // 10    the rune band
  [1, hb(SNL, 4, 'm', 'GG'), 'G'], // 11    and its light
  [1, hb(SNL, 5, 'M', 'A6'), '6'], // 12    the waist takes two cells in
  [1, hb(SNL, 5, '5'), 'M'], // 13    a keystone belt
  [1, hb(SNL, 5, '}'), '}'], // 14    deep seam
  [4, hbf(SNL, 7, 'M', 'm', [9]), 'M'], // 15-18 the slab skirt, a narrow column under a wide lintel
  [1, hb(SNL, 6, '5'), '5'], // 19    and its hem band
]);
const sentinelRows = [
  ...turn(selfShadow(shoulderDrop(sentinelTop, 2, SNL, 'M', 3, 1), '}', 3, [7, 14], [4, SNW - 5]), { top: 2, bottom: 12, ch: 'M', pelvis: [15, 19] }),
  ...legsTurned(SNW + 2, 12, { pad: 9, w: 6, leg: 'm', knee: '5', boot: '}', cuff: '5' }, { pad: 9, w: 8, leg: 'M', knee: 'm', boot: '5', cuff: 'M' }, 8),
];
const sentinelAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SNL + 2, y: 0 },
  hand: { x: SNL, y: 4 },
  capePin: { x: SNL - 2, y: 3 },
  feet: { x: SNL, y: sentinelRows.length - 1 },
  hit: { x: SNL, y: 14 },
};
bodyKit('sentinel', { rows: sentinelRows, anchors: sentinelAnchors, hemFrom: 15, pivot: 20, lean: 7 });
const sentinelHeadRows = [
  sym(HL, hb(HL, 3, 'M'), 'M'), //  0  a flat-topped keystone
  sym(HL, hb(HL, 2, 'M'), 'M'), //  1
  sym(HL, hb(HL, 1, '*'), '*'), //  2  the lit course — the crown is the top quarter of the figure
  sym(HL, hb(HL, 1, 'M'), 'M'), //  3
  sym(HL, hb(HL, 0, 'M'), 'M'), //  4
  sym(HL, hb(HL, 1, '5'), '5'), //  5  the brow shelf
  sym(HL, hb(HL, 2, '}'), '}'), //  6  and its deep undercut
  sym(HL, '.....GGGGGG', 'G'), //  7  ONE carved slot with a rune light behind it
  sym(HL, '....#GGGGGG', 'G'), //  8
  sym(HL, hb(HL, 2, 'm'), 'm'), //  9  one flat tone under the slot
  stamp(sym(HL, hb(HL, 2, 'M'), 'M'), [7, 'A'], [15, 'A']), // 10  two carved marks
  sym(HL, hb(HL, 3, 'M'), 'M'), // 11
  sym(HL, hb(HL, 3, 'A'), 'A'), // 12  a carved band across the jaw
  sym(HL, hb(HL, 3, '6'), '6'), // 13
  sym(HL, hb(HL, 4, 'M'), 'M'), // 14
  sym(HL, hb(HL, 5, 'm'), 'm'), // 15
  sym(HL, hb(HL, 6, '5'), '5'), // 16
  sym(HL, hb(HL, 8, '5'), '5'), // 17  the neck
  sym(HL, hb(HL, 8, '}'), '}'), // 18
];
headKit('sentinel', { rows: sentinelHeadRows, down: { crown: 'M', dark: '5', face: 'm', eye: '}', deep: '}' } });
reg('arms_stone', armsPart(15, { arm: 'M', armDark: '5', fore: 'm', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'm' }, 7));
reg('arms_stone_hurt', armsRecoil(15, { arm: 'M', armDark: '5', fore: 'm', cuff: '5', hand: 'M', handDeep: '}' }, 7));
reg('fingers_stone', fingersPart({ hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5', wide: true }));
reg('fallen_stone', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'm', bootDeep: '}' }, FALLEN_SLUMP));
/** WARD STONE — a carved ward slab on a short haft. The haft runs two cells proud of the fist top and bottom so the hand can close over it. */
reg(
  'ward_stone',
  part(
    [
      R(13, [1, 'MMMMMMMMMMM']),
      R(13, [0, 'M*********MM']),
      R(13, [0, 'M*AAAAAAA*MM']),
      R(13, [0, 'M*AGGGGGA*MM']),
      R(13, [0, 'M*AGGGGGA*MM']),
      R(13, [0, 'M*AAAAAAA*MM']),
      R(13, [0, 'Mm*******mM5']),
      R(13, [0, 'M5mmmmmmm5M5']),
      R(13, [1, '}}}}}}}}}}']),
      R(13, [4, 'MMM']),
      R(13, [4, 'M*M']),
      R(13, [4, 'M*M']),
      R(13, [4, 'M*M']),
      R(13, [4, 'M*M']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'MMM']),
      R(13, [4, 'M5M']),
      R(13, [4, '5}5']),
    ],
    { weaponGrip: { x: 5, y: 17 } },
  ),
);

// --- SKYFALLEN KING (boss) — the lord the ruins fell with ----------------------
// DARK on a WIND stage, with KINGLY GUARD and RUIN JUDGEMENT: a tall armoured
// figure whose right side is broken OPEN — one wing sheared to a stump of
// masonry, a mantle torn to three tatters, a cracked crown askew, and a
// two-handed greatsword of falling stone planted across the body. Sixty-nine
// cells on the boss canvas.
const SKL = 20; // boss body half-width → 41
const SKW = 2 * SKL + 1;
const skyTop = bands(SKL, [
  [2, hb(SKL, 16, '5'), '5'], //  0-1  the gorget
  [1, hb(SKL, 4, 'M'), 'M'], //  2    the pauldron line
  [3, hb(SKL, 2, 'M'), 'M'], //  3-5
  [1, hb(SKL, 4, '5'), '5'], //  6    their underside
  [1, hb(SKL, 5, '}'), '}'], //  7    the deep seam
  [4, hbf(SKL, 6, 'M', 'm', [8, 13]), 'M'], //  8-11 the cuirass, two courses
  [1, hb(SKL, 6, 'M', 'DD'), 'D'], // 12   a torn surcoat starts
  [3, hbf(SKL, 6, 'D', '3', [9, 14]), 'D'], // 13-15
  [1, hb(SKL, 5, '5'), 'M'], // 16   the belt and its buckle
  [1, hb(SKL, 5, '}'), '}'], // 17   deep seam
  [6, hbf(SKL, 4, 'D', '3', [7, 12, 16]), 'D'], // 18-23 the surcoat falls
  [2, hbf(SKL, 4, 'd', ']', [8, 14]), 'd'], // 24-25 a step into shadow
  [1, hb(SKL, 4, ']'), ']'], // 26   the hem band
  [1, hb(SKL, 4, ']'), ']'], // 27
]);
const skyRows = [
  ...turn(selfShadow(shoulderDrop(skyTop, 2, SKL, 'M', 5, 3), '}', 3, [8, 17], [5, SKW - 6], 8), { top: 2, bottom: 16, ch: 'M', pelvis: [18, 27] }),
  ...legsTurned(SKW + 2, 18, { pad: 7, w: 8, leg: 'm', knee: '5', boot: '5', cuff: 'm' }, { pad: 8, w: 9, leg: 'M', knee: 'm', boot: '5', cuff: 'M' }, 12),
];
/**
 * The sheared wing stump — masonry broken off at the shoulder, three courses of
 * it proud of the far pauldron — and the surcoat's far half in its own plane
 * step, which is the one contiguous dark area criterion 1 rests on.
 */
const skyBodyRows = stampRows(
  castPlane(stampRows(stampRows(stampRows(skyRows, 2, 4, [0, 'BBB']), 5, 8, [0, 'B&B']), 9, 11, [1, '&&']), 19, 25, 26, 36),
  41,
  45,
  [7, '}}}}}}}}}'],
  [26, '}}}}}}}}}}'],
);
const skyAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SKL + 2, y: 0 },
  hand: { x: SKL, y: 4 },
  capePin: { x: SKL - 3, y: 3 },
  feet: { x: SKL, y: skyRows.length - 1 },
  hit: { x: SKL, y: 20 },
};
reg('sky_body', part(skyBodyRows, skyAnchors));
reg('sky_body_hurt', bodyRecoil(skyBodyRows, skyAnchors, 30, 12));
const SKHL = 15; // boss head half-width → 31
const skyHeadRows = bands(SKHL, [
  [1, hb(SKHL, 9, '*'), '*'], //  0  the dome — nine rows of it, and the whole of it takes the key
  [1, hb(SKHL, 7, '*'), '*'], //  1
  [1, hb(SKHL, 5, '*'), '*'], //  2
  [1, hb(SKHL, 4, '*'), '*'], //  3
  [2, hb(SKHL, 3, '*'), '*'], //  4-5
  [2, hb(SKHL, 2, 'M'), 'M'], //  6-7   the dome turns away below the key
  [2, hb(SKHL, 2, '*'), '*'], //  8-9   and takes it again on the browline's lit lip
  [2, hb(SKHL, 2, 'M'), 'M'], // 10-11
  [1, hb(SKHL, 2, '5'), '5'], // 12  the brow bar, clear of the top quarter
  [1, hb(SKHL, 2, '}'), '}'], // 13  and its undercut
  [2, hb(SKHL, 5, '#'), '#'], // 14-15 ONE unbroken slit
  [1, hb(SKHL, 3, 'm'), 'm'], // 16  one flat tone under it
  [2, hb(SKHL, 3, 'M'), 'M'], // 17-18
  [1, hb(SKHL, 4, 'm'), 'm'], // 19
  [2, hb(SKHL, 5, 'M'), 'M'], // 20-21
  [1, hb(SKHL, 7, 'm'), 'm'], // 22  the helm's ragged lower edge
  [1, hb(SKHL, 8, 'M'), 'M'], // 23
  [1, hb(SKHL, 11, '5'), '5'], // 24  the neck
  [1, hb(SKHL, 11, '5'), '5'], // 25
  [1, hb(SKHL, 11, '}'), '}'], // 26
]);
/** A crack across the helm and a dim light behind the slit — the king is broken, and it shows on his face. */
const skyHeadFinal = stampRows(stampRows(skyHeadRows, 14, 14, [19, 'g']), 5, 11, [22, '}'], [23, '}']);
headKit('sky', { rows: skyHeadFinal, cx: SKHL, down: { crown: 'M', dark: '5', face: 'm', eye: '}', deep: '}' }, downFlip: true, lift: 2 });
reg('fallen_sky', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'D', bootDeep: ']' }, FALLEN_SIDE, false, 1.5));
/** A cracked crown, worn askew over the great helm. */
reg(
  'crown_broken',
  part([
    R(24, [2, 'B'], [14, 'B']),
    R(24, [2, 'B'], [6, 'B'], [13, 'BB'], [20, 'B']),
    R(24, [1, 'BB'], [5, 'BB'], [13, 'BBB'], [19, 'BB']),
    R(24, [1, 'B%B'], [5, 'B%B'], [12, 'B%%%B'], [19, 'B%B']),
    R(24, [1, 'BBBB'], [5, 'BBB'], [12, 'BBBBB'], [19, 'BBB']),
    R(24, [1, 'BBBBBBBBBBB'], [13, 'BBBBBBBBB']),
    R(24, [1, '%%%%%%%%%%%'], [12, '%%%%%%%%%%']),
    R(24, [1, 'B8888888888'], [12, '888888888B']),
    R(24, [2, '&&&&&&&&&&&&&&&&&&&&']),
  ]),
);
/** A mantle torn to three tatters, hanging off the broken side. */
const skyCloakRows = [
  ...bands(13, [
    [2, hb(13, 1, 'D'), 'D'],
    [4, hbf(13, 0, 'D', '3', [4, 9]), 'D'],
    [8, hbf(13, 0, 'D', '3', [3, 8, 11]), 'D'],
    [6, hbf(13, 0, 'd', ']', [5, 10]), 'd'],
  ]),
  ...scallopHem(27, 'd', ']', [5, 2, 7, 3, 6, 2]),
];
reg('cloak_sky', part(skyCloakRows, { capePin: { x: 12, y: 1 } }));
reg(
  'cloak_sky_sway',
  part(
    skyCloakRows.map((r, i) => (i >= 14 ? shiftX(r, 2) : i >= 8 ? shiftX(r, 1) : r)),
    { capePin: { x: 12, y: 1 } },
  ),
);
/** SKYRENT — a greatsword of falling stone, carried across the body; too tall to swing inside the bake, so its rig thrusts. */
reg(
  'skyrent',
  part(
    [
      ...rep(2, R(13, [5, 'BBB'])),
      ...rep(3, R(13, [4, 'B%%%BB'])),
      ...rep(15, R(13, [3, 'B%bbb8B'])),
      ...rep(8, R(13, [3, 'B8bbb8B'])),
      R(13, [3, 'B88&88B']),
      R(13, [1, 'MM5}}}}}5MM']),
      R(13, [1, '5}}}}}}}}}5']),
      R(13, [4, 'LLLLL']),
      R(13, [4, 'L444L']),
      R(13, [4, 'L4{4L']),
      R(13, [4, 'L444L']),
      R(13, [4, 'L4{4L']),
      R(13, [4, '4{{{4']),
      R(13, [3, 'BBBBBBB']),
      R(13, [4, '&&&&&']),
    ],
    { weaponGrip: { x: 6, y: 34 } },
  ),
);

/** Arms, their recoil twin and the fist that closes over a haft — one call per build. */
function armKit(id: string, o: ArmOpts, fist: FistOpts, lh = 13, w = 5): void {
  reg(`arms_${id}`, armsPart(lh, o, w));
  reg(`arms_${id}_hurt`, armsRecoil(lh, o, w));
  reg(`fingers_${id}`, fingersPart(fist));
}

// ================================================================================
// ASHEN FORGE (act 4) — FIRE dominant, WATER foil, LIGHT boss.
// Iron, slag and ember over FORGE_GROUND's warm brown floor (#5b4438) under a
// #ff5a2e key. Amber on amber would vanish, so the IRON here is cold and dark
// and the only warm thing in the pack is the fire inside it — a seam, a grille,
// a crucible. That inversion is also what separates this pack from the crypt's.
// ================================================================================

// --- FORGE GOLEM — a slag automaton ---------------------------------------------
// MOLTEN SLAM: the whole figure is built around ONE oversized fist. Asymmetric
// by construction — a squat riveted body, a furnace seam glowing down the chest,
// a low hooded head with a grille, and a slag arm three cells wider than the
// other, so it is the only humanoid in the game whose two arms are different
// masses.
const GLL = 15;
const GLW = 2 * GLL + 1;
const golemTop = bands(GLL, [
  [2, hb(GLL, 11, '5'), '5'], //  0-1  the neck vent
  [1, hb(GLL, 2, 'M'), 'M'], //  2    a heavy shoulder yoke
  [3, hb(GLL, 1, 'M'), 'M'], //  3-5
  [1, hb(GLL, 3, '5'), '5'], //  6    its underside
  [1, hb(GLL, 4, '}'), '}'], //  7    deep seam
  [1, hb(GLL, 5, 'M', 'GG'), 'G'], //  8    THE FURNACE SEAM opens
  [3, hbf(GLL, 5, 'M', 'm', [7], 'GG'), 'G'], //  9-11
  [1, hb(GLL, 5, 'm', '7G'), 'G'], // 12    and closes into its own ember
  [1, hb(GLL, 5, 'M'), 'M'], // 13
  [1, hb(GLL, 4, '5'), 'M'], // 14   a riveted belt band
  [1, hb(GLL, 4, '}'), '}'], // 15   deep seam
  [4, hbf(GLL, 3, 'M', 'm', [6, 11]), 'M'], // 16-19 the hip block, two plate courses
  [1, hb(GLL, 3, '5'), '5'], // 20   and its dark under-band
]);
const golemRows = castPlane(
  [
    ...turn(selfShadow(shoulderDrop(golemTop, 2, GLL, 'M', 4, 2), '}', 3, [8, 15], [4, GLW - 5]), { top: 2, bottom: 14, ch: 'M', pelvis: [16, 20] }),
    ...legsTurned(GLW + 2, 11, { pad: 4, w: 8, leg: 'm', knee: '5', boot: '}', cuff: '5' }, { pad: 5, w: 9, leg: 'M', knee: 'm', boot: '5', cuff: 'M' }, 7),
  ],
  16,
  27,
  17,
  28,
);
const golemAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: GLL + 2, y: 0 },
  hand: { x: GLL, y: 4 },
  capePin: { x: GLL - 2, y: 3 },
  feet: { x: GLL, y: golemRows.length - 1 },
  hit: { x: GLL, y: 13 },
};
bodyKit('golem', { rows: golemRows, anchors: golemAnchors, hemFrom: 16, pivot: 21, lean: 7 });
const golemHeadRows = [
  sym(HL, hb(HL, 7, 'M'), 'M'), //  0  a low hood, no crown to speak of
  sym(HL, hb(HL, 5, '*'), '*'), //  1  its lit ridge
  sym(HL, hb(HL, 4, 'M'), 'M'), //  2
  sym(HL, hb(HL, 3, 'M'), 'M'), //  3
  sym(HL, hb(HL, 3, 'm'), 'm'), //  4
  sym(HL, hb(HL, 3, '5'), '5'), //  5  the brow bar
  sym(HL, hb(HL, 3, '}'), '}'), //  6
  stamp(sym(HL, hb(HL, 4, 'G'), 'G'), [7, 'M'], [11, 'M'], [15, 'M']), //  7  THE GRILLE — three cold bars over a fire
  stamp(sym(HL, hb(HL, 4, 'G'), 'G'), [7, 'M'], [11, 'M'], [15, 'M']), //  8
  sym(HL, hb(HL, 4, '5'), '5'), //  9
  sym(HL, hb(HL, 3, 'M'), 'M'), // 10
  sym(HL, hb(HL, 3, 'M'), 'M'), // 11
  stamp(sym(HL, hb(HL, 3, 'm'), 'm'), [6, '}'], [16, '}']), // 12  two rivet pits
  sym(HL, hb(HL, 4, 'M'), 'M'), // 13
  sym(HL, hb(HL, 5, 'm'), 'm'), // 14
  sym(HL, hb(HL, 6, '5'), '5'), // 15
  sym(HL, hb(HL, 8, '5'), '5'), // 16  the neck
  sym(HL, hb(HL, 8, '}'), '}'), // 17
];
headKit('golem', { rows: golemHeadRows, down: { crown: 'M', dark: '5', face: 'm', eye: '}', deep: '}' } });
armKit(
  'slag',
  { arm: 'M', armDark: '5', fore: 'm', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'm' },
  { hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5', wide: true },
  16,
  8,
);
reg('fallen_slag', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'm', bootDeep: '}' }, FALLEN_PITCH));
/** SLAG FIST — a boulder of cooling slag on a stub of chain, swung on the golem's own arm. */
reg(
  'slag_fist',
  part(
    [
      R(15, [4, 'MMMMM']),
      R(15, [2, 'M**AAA*MM']),
      R(15, [1, 'M*AA7GAA*M']),
      R(15, [1, '*AA7GG7AA*M']),
      R(15, [1, 'MA7GG77GA*M']),
      R(15, [1, 'MmAA7GAA*mM']),
      R(15, [2, 'MmAAAAAmM']),
      R(15, [2, 'M5mmmmm5M']),
      R(15, [3, '}}}}}}}']),
      R(15, [6, 'MMM']),
      R(15, [6, 'M*M']),
      R(15, [6, 'M*M']),
      R(15, [6, 'M5M']),
      R(15, [6, 'MMM']),
      R(15, [6, 'M*M']),
      R(15, [6, 'M5M']),
      R(15, [6, 'MMM']),
      R(15, [6, 'M5M']),
      R(15, [5, '5}}}5']),
    ],
    { weaponGrip: { x: 7, y: 14 } },
  ),
);

// --- CINDER WOLF — the ember-cracked runner --------------------------------------
// BRANDING BITE, and the round-7 note on ASH_HOUND ("four identical bars at one
// pitch") is the thing to avoid: this one is taller and leggier than the hound,
// its topline broken by a RUFF OF SPINES from skull to shoulder, its tail up and
// forward, and its hind pair genuinely different geometry from its fore.
const WLF_W = 46;
const WLF_H = 44;
interface WolfPose {
  jaw?: number;
  hx?: number;
  hy?: number;
  bx?: number;
  by?: number;
  /** The fore pair skids on a recoil, the hind pair gathers on a strike. */
  fore?: number;
  hind?: number;
  tail?: number;
}
function wolfGrid(o: WolfPose = {}): string[] {
  const { jaw = 0, hx = 0, hy = 0, bx = 0, by = 0, fore = 0, hind = 0, tail = 0 } = o;
  const g = grid(WLF_W, WLF_H);
  // tail carried UP and forward over the rump
  limb(g, 8 + bx, 22 + by, 1 + bx, 10 + by - tail, 6, 2, 'L');
  // rump, ribcage, shoulder — three masses, not one barrel
  ell(g, 11 + bx, 24 + by, 8, 8, 'L');
  ell(g, 21 + bx, 24 + by, 10, 7, 'L');
  ell(g, 30 + bx, 22 + by, 7, 7, 'L');
  // neck and skull
  limb(g, 31 + bx, 19 + by, 38 + hx, 13 + hy, 9, 6, 'L');
  ell(g, 39 + hx, 12 + hy, 6, 5, 'L');
  // muzzle and lower jaw
  limb(g, 41 + hx, 13 + hy, 45 + hx, 14 + hy, 5, 3, 'L');
  limb(g, 37 + hx, 14 + hy, 44 + hx, 16 + hy + 2 * jaw, 5, 3, 'B');
  // ears
  limb(g, 37 + hx, 9 + hy, 35 + hx, 4 + hy, 3, 1, 'L');
  limb(g, 41 + hx, 9 + hy, 41 + hx, 4 + hy, 3, 1, 'l');
  // THE RUFF: seven ember-lit spines along the topline, each its own length
  [0, 1, 2, 3, 4, 5, 6].forEach((i) => {
    const sx = 10 + bx + i * 4;
    const len = 4 + ((i * 3) % 5);
    limb(g, sx, 18 + by, sx - 2, 18 + by - len, 3, 1, i % 2 ? 'A' : 'a');
  });
  // four legs: fore pair near-vertical and forward, hind pair angled back off a haunch
  limb(g, 9 + bx, 29 + by, 5 + bx - hind, 40 + by, 7, 4, 'l');
  limb(g, 15 + bx, 30 + by, 13 + bx - hind, 41 + by, 6, 4, 'L');
  limb(g, 27 + bx, 29 + by, 28 + bx + fore, 41 + by, 6, 4, 'l');
  limb(g, 32 + bx, 28 + by, 34 + bx + fore, 40 + by, 6, 4, 'L');
  box(g, 3 + bx - hind, 41 + by, 9 + bx - hind, 42 + by, 'l');
  box(g, 11 + bx - hind, 42 + by, 17 + bx - hind, 43 + by, 'L');
  box(g, 26 + bx + fore, 42 + by, 32 + bx + fore, 43 + by, 'l');
  box(g, 31 + bx + fore, 40 + by, 38 + bx + fore, 42 + by, 'L');
  topLight(g, '~', 2, 'L');
  topLight(g, '!', 1, 'A');
  underbelly(g, '4', '{', 5, 'L', 2);
  planeEll(g, 25 + bx, 27 + by, 11, 5);
  planeBox(g, 6 + bx, 24 + by, 16 + bx, 30 + by);
  let out = rowsOf(g);
  // ember cracks along the flank, and the eye
  out = stampRows(out, 21 + by, 21 + by, [12 + bx, '@'], [19 + bx, '@'], [26 + bx, '@']);
  out = stampRows(out, 22 + by, 22 + by, [12 + bx, '7'], [19 + bx, '7'], [26 + bx, '7']);
  out = stampRows(out, 23 + by, 23 + by, [13 + bx, '@'], [20 + bx, '@']);
  out = stampRows(out, 11 + hy, 11 + hy, [38 + hx, '#G']);
  out = stampRows(out, 12 + hy, 12 + hy, [38 + hx, '#4']);
  return out;
}
const WOLF_ANCH = { feet: { x: 21, y: WLF_H - 1 }, hit: { x: 22, y: 24 } };
beastKit('wolf', {
  idle: [wolfGrid(), wolfGrid({ by: 1, hy: 1, tail: 1 }), wolfGrid({ hy: -1, tail: 2, jaw: 1 })],
  wind: wolfGrid({ hx: -5, hy: 2, bx: -2, hind: 3, jaw: 1 }),
  strike: wolfGrid({ hx: 6, hy: 3, jaw: 5, fore: 4, bx: 1, tail: 2 }),
  hurt: wolfGrid({ hx: -8, hy: -3, bx: -3, by: 1, fore: -3, jaw: 3 }),
  dead: [
    (() => {
      // On its side, legs folded the same way, the skull turned into the floor
      // and the ruff flat — twenty rows against forty-four.
      const g = grid(WLF_W, WLF_H);
      limb(g, 2, 32, 12, 34, 5, 3, 'L');
      ell(g, 16, 38, 12, 6, 'L');
      limb(g, 24, 37, 34, 40, 8, 5, 'L');
      ell(g, 37, 41, 6, 4, 'L');
      limb(g, 39, 41, 45, 42, 4, 2, 'L');
      for (const sx of [8, 14, 20, 26]) limb(g, sx, 33, sx - 2, 29, 3, 1, 'a');
      limb(g, 12, 41, 8, 43, 5, 3, 'l');
      limb(g, 22, 41, 26, 43, 5, 3, 'l');
      topLight(g, '~', 1, 'L');
      underbelly(g, '4', '{', 2, 'L');
      planeBox(g, 24, 38, 40, 43);
      return stampRows(rowsOf(g), 40, 40, [36, '##']);
    })(),
  ],
  w: WLF_W,
  h: WLF_H,
  anchors: WOLF_ANCH,
});

// --- SMITH PRIEST — the pack's support ------------------------------------------
// TEMPER and EMBER SALVE: a working smith in holy orders. A heavy leather apron
// from throat to shin is the silhouette — narrow shoulders under a wide skirt,
// the inverse of the sentinel's T — with a stole over one shoulder only, a
// bellows satchel at the far hip, and long tongs held in a gloved fist.
const SPL = 13;
const SPW = 2 * SPL + 1;
const priestTop = bands(SPL, [
  [2, hb(SPL, 9, 'S'), 'S'], //  0-1  the throat
  [1, hb(SPL, 5, '4'), '4'], //  2    a dark collar
  [1, hb(SPL, 4, 'L'), 'L'], //  3    narrow shoulders
  [1, hb(SPL, 3, 'L'), 'L'], //  4
  [1, hb(SPL, 3, 'l'), 'l'], //  5
  [1, hb(SPL, 3, '{'), '{'], //  6    the deep seam under the yoke
  [4, hbf(SPL, 3, 'L', 'l', [6], 'D4'), 'D'], //  7-10 the apron's bib, a stole down one edge
  [1, hb(SPL, 3, 'L', 'D4'), 'D'], // 11
  [1, hb(SPL, 2, '4'), 'M'], // 12   a tool belt with a buckle
  [1, hb(SPL, 2, '{'), '{'], // 13   its deep seam
  [5, hbf(SPL, 1, 'L', 'l', [4, 9]), 'L'], // 14-18 the apron flares
  [3, hbf(SPL, 0, 'l', '{', [3, 8]), 'l'], // 19-21 and falls into shadow
  [1, hb(SPL, 0, '{'), '{'], // 22   the hem band
]);
const priestRows = [
  ...turn(selfShadow(shoulderDrop(priestTop, 3, SPL, 'L', 4, 2), '{', 3, [7, 13], [3, SPW - 4]), { top: 3, bottom: 12, ch: 'L', pelvis: [14, 22] }),
  ...scallopHem(SPW + 2, 'l', '{', [3, 1, 4, 2]),
  ...legsTurned(SPW + 2, 6, { pad: 5, w: 5, leg: 'c', knee: '[', boot: '{', cuff: '4' }, { pad: 6, w: 6, leg: 'C', knee: 'c', boot: '4', cuff: 'l' }, 3),
];
const priestAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SPL + 2, y: 0 },
  hand: { x: SPL, y: 4 },
  capePin: { x: SPL - 2, y: 3 },
  feet: { x: SPL, y: priestRows.length - 1 },
  hit: { x: SPL, y: 14 },
};
bodyKit('priest', { rows: priestRows, anchors: priestAnchors, hemFrom: 14, pivot: 25, lean: 9 });
const priestHeadRows = [
  ...crown('L', [8, 6, 4, 3, 2, 2, 2], [2, 2, 1, 1, 0, 0, 0]), // a smith's hood, pulled forward off centre
  stamp(sym(HL, hb(HL, 2, 'L'), 'L'), [6, 'DDD']), // the stole's end thrown over it
  sym(HL, hb(HL, 2, '4'), '4'), // and the hood's dark lip
  ...faceBlock({ side: 'L', sideDark: '4', brow: 1, spacing: 0, mouth: 3, cheek: true, turn: true }),
];
headKit('priest', { rows: priestHeadRows, down: { crown: 'L', dark: '4', face: 'S', eye: '#', deep: '(' }, lift: 1 });
armKit(
  'apron',
  { arm: 'S', armDark: '(', fore: 'L', cuff: '4', hand: 'L', handDeep: '{', nearArm: 's' },
  { hand: 'L', notch: 'l', edge: '4', deep: '{', lit: '~', cuff: '4' },
  13,
  5,
);
reg('fallen_apron', fallenBody({ g: 'L', dark: '4', deep: '{', boot: 'C', bootDeep: '[' }, FALLEN_SIDE));
/** A bellows satchel, worn at the far hip. */
reg(
  'bellows',
  part([
    R(12, [2, 'LLLLLL']),
    R(12, [1, 'L~~~~~4L']),
    R(12, [1, 'L~llll4L']),
    R(12, [1, 'L4llll4L']),
    R(12, [1, 'L44444{L']),
    R(12, [2, '4{{{{{4']),
    R(12, [4, 'MMM']),
    R(12, [4, 'M5M']),
  ]),
);
/** SMITH'S TONGS — long enough to thrust rather than swing, and closed on a hot billet. */
reg(
  'tongs',
  part(
    [
      R(11, [2, 'MG'], [6, 'GM']),
      R(11, [2, 'M7'], [6, '7M']),
      R(11, [2, 'MG'], [6, 'GM']),
      R(11, [3, 'M'], [6, 'M']),
      R(11, [3, 'M'], [6, 'M']),
      R(11, [3, 'M'], [6, 'M']),
      R(11, [3, 'M*'], [5, '*M']),
      R(11, [3, 'M5'], [5, '5M']),
      R(11, [4, 'MM']),
      ...rep(6, R(11, [4, 'M5'])),
      ...rep(8, R(11, [4, 'MM'])),
      ...rep(8, R(11, [4, 'M5'])),
      R(11, [4, '5}']),
      R(11, [4, 'LL']),
      R(11, [4, 'L4']),
      R(11, [4, 'L4']),
      R(11, [4, '4{']),
    ],
    { weaponGrip: { x: 5, y: 27 } },
  ),
);

// --- STEAM WRAITH — the WATER foil in a furnace ---------------------------------
// SCALD: a column of scalding vapour with a hollow face near its top and two
// vent arms it lashes with. It has no legs and no hard edge anywhere — the
// opposite construction to the golem it stands beside, and nothing like the
// crypt's DUST WRAITH, whose whole read is a shroud with a hem.
const STM_W = 38;
const STM_H = 46;
interface SteamPose {
  /** How far the column has boiled up: 0 low and wide, 1 tall and thin. */
  boil?: number;
  dx?: number;
  dy?: number;
  /** The vent arms lash forward. */
  reach?: number;
  face?: number;
}
function steamGrid(o: SteamPose = {}): string[] {
  const { boil = 0, dx = 0, dy = 0, reach = 0, face = 0 } = o;
  const g = grid(STM_W, STM_H);
  const cx = 19 + dx;
  // the column: five stacked billows of falling size, each offset off the last
  const billows: readonly [number, number, number, number][] = [
    [0, 40, 13, 6],
    [2, 32, 12, 7],
    [-2, 24, 11, 7],
    [1, 16, 9, 6],
    [-1, 9 - 2 * boil, 7, 5],
  ];
  for (const [ox, oy, rx, ry] of billows) ell(g, cx + ox, oy + dy - boil * (40 - oy) * 0.12, rx, ry - boil, 'C');
  // the crown of it wisps away, and the scald sits at its heart — the light end
  // a body of vapour needs to span L 15-85 at all
  limb(g, cx - 1, 8 + dy, cx + 3, 1 + dy, 5, 2, 'c');
  ell(g, cx - 2, 30 + dy, 4, 5, 'G');
  // two vent arms, lashing forward at different heights
  limb(g, cx + 8, 20 + dy, cx + 15 + reach, 15 + dy - reach, 6, 3, 'C');
  limb(g, cx - 8, 26 + dy, cx - 14 - (reach >> 1), 24 + dy, 5, 3, 'c');
  topLight(g, '+', 3, 'C');
  for (const [ox, oy, rx, ry] of billows) ell(g, cx + ox - rx * 0.45, oy + dy - ry * 0.4, rx * 0.4, ry * 0.4, '+');
  underbelly(g, '2', '[', 4, 'C');
  planeBox(g, cx + 3, 17 + dy, cx + 13, 37 + dy);
  let out = rowsOf(g);
  // the hollow face: two vents and a torn mouth, all in the material's deep step
  out = stampRows(out, 12 + dy + face, 12 + dy + face, [cx - 5, '[[['], [cx + 2, '[[[']);
  out = stampRows(out, 13 + dy + face, 13 + dy + face, [cx - 5, '#G#'], [cx + 2, '#G#']);
  out = stampRows(out, 17 + dy + face, 17 + dy + face, [cx - 3, '[[[[[[']);
  return out;
}
const STEAM_ANCH = { feet: { x: 19, y: STM_H - 1 }, hit: { x: 19, y: 24 } };
beastKit('steam', {
  idle: [steamGrid(), steamGrid({ dy: 1, boil: 0.4 }), steamGrid({ boil: 1, face: -1 })],
  wind: steamGrid({ boil: 1, dx: -4, dy: -1, reach: -3 }),
  strike: steamGrid({ boil: 0.3, dx: 4, dy: 1, reach: 8, face: 1 }),
  hurt: steamGrid({ boil: 0.6, dx: -7, dy: -3, reach: -4, face: -2 }),
  dead: [
    (() => {
      // Steam does not fall over: it SPREADS. The column flattens into three
      // low billows on the floor — seventeen rows against forty-six.
      const g = grid(STM_W, STM_H);
      ell(g, 12, 38, 11, 5, 'C');
      ell(g, 24, 40, 12, 4, 'c');
      ell(g, 18, 43, 17, 3, 'c');
      limb(g, 4, 36, 1, 33, 4, 2, 'c');
      topLight(g, '+', 2, 'C');
      underbelly(g, '2', '[', 3, 'C');
      return rowsOf(g);
    })(),
    (() => {
      const g = grid(STM_W, STM_H);
      ell(g, 16, 42, 13, 3, 'c');
      ell(g, 26, 44, 9, 2, '2');
      return rowsOf(g);
    })(),
  ],
  w: STM_W,
  h: STM_H,
  anchors: STEAM_ANCH,
});

// --- FURNACE KNIGHT (elite) — the forge's front rank ----------------------------
// GREATHAMMER and FORGE WARD. Fifty-four cells of banded plate over a tabard,
// a shoulder-mounted chimney venting off the far pauldron, and a visor that is
// a FURNACE DOOR — a hinged grille with the fire behind it — so its head shares
// no construction with the bucket, the keel, the crown, the slit or the hood.
const FKL = 17;
const FKW = 2 * FKL + 1;
const furnaceTop = bands(FKL, [
  [2, hb(FKL, 13, '5'), '5'], //  0-1  the gorget
  [1, hb(FKL, 1, 'M'), 'M'], //  2    pauldrons past the hips
  [2, hb(FKL, 0, 'M'), 'M'], //  3-4
  [1, hb(FKL, 2, '5'), '5'], //  5
  [1, hb(FKL, 3, '}'), '}'], //  6    the deep seam under them
  [1, hb(FKL, 5, '*'), '*'], //  7    the cuirass's lit top band
  [2, hbf(FKL, 5, 'M', 'm', [8, 12]), 'M'], //  8-9
  [1, hb(FKL, 5, '5'), '5'], // 10   a plate course, dark
  [2, hbf(FKL, 5, 'M', 'm', [9]), 'M'], // 11-12
  [1, hb(FKL, 5, '5'), '5'], // 13   and another
  [1, hb(FKL, 5, 'M', 'AA'), 'A'], // 14   a scorched tabard band
  [1, hb(FKL, 4, '4'), 'M'], // 15   the belt and its buckle
  [1, hb(FKL, 4, '{'), '{'], // 16   deep seam
  [5, hbf(FKL, 4, 'A', '6', [6, 11]), 'A'], // 17-21 the tabard falls to mid-shin
  [2, hbf(FKL, 4, 'a', '<', [8]), 'a'], // 22-23
  [1, hb(FKL, 4, '<'), '<'], // 24   its hem band
]);
const furnaceRows = [
  ...turn(selfShadow(shoulderDrop(furnaceTop, 2, FKL, 'M', 4, 2), '}', 3, [8, 16], [4, FKW - 5]), { top: 2, bottom: 15, ch: 'M', pelvis: [17, 24] }),
  ...legsTurned(FKW + 2, 13, { pad: 6, w: 8, leg: 'm', knee: '5', boot: '}', cuff: '5' }, { pad: 7, w: 9, leg: 'M', knee: 'm', boot: '5', cuff: 'M' }, 8),
];
/** The chimney: three courses of vented pipe standing off the far pauldron, with its own ember at the top. */
const furnaceBodyRows = stampRows(stampRows(stampRows(furnaceRows, 0, 1, [1, 'MMM']), 2, 4, [1, 'M7M']), 5, 7, [1, 'M5M']);
const furnaceAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: FKL + 2, y: 0 },
  hand: { x: FKL, y: 4 },
  capePin: { x: FKL - 2, y: 3 },
  feet: { x: FKL, y: furnaceRows.length - 1 },
  hit: { x: FKL, y: 15 },
};
bodyKit('furnace', { rows: furnaceBodyRows, anchors: furnaceAnchors, hemFrom: 17, pivot: 25, lean: 8 });
const furnaceHeadRows = [
  sym(HL, hb(HL, 5, 'M'), 'M'), //  0  a squat helm, no crest
  sym(HL, hb(HL, 3, '*'), '*'), //  1  its lit crown
  sym(HL, hb(HL, 2, 'M'), 'M'), //  2
  sym(HL, hb(HL, 2, 'M'), 'M'), //  3
  sym(HL, hb(HL, 2, 'm'), 'm'), //  4
  sym(HL, hb(HL, 2, '5'), '5'), //  5  the door's top hinge
  stamp(sym(HL, hb(HL, 3, 'G'), 'G'), [5, 'M'], [9, 'M'], [13, 'M'], [17, 'M']), //  6  THE FURNACE DOOR — four bars over the fire
  stamp(sym(HL, hb(HL, 3, 'G'), 'G'), [5, 'M'], [9, 'M'], [13, 'M'], [17, 'M']), //  7
  stamp(sym(HL, hb(HL, 3, 'G'), 'G'), [5, 'M'], [9, 'M'], [13, 'M'], [17, 'M']), //  8
  sym(HL, hb(HL, 3, '5'), '5'), //  9  its bottom hinge
  sym(HL, hb(HL, 2, 'M'), 'M'), // 10
  stamp(sym(HL, hb(HL, 2, 'M'), 'M'), [4, '}'], [18, '}']), // 11  two rivets
  sym(HL, hb(HL, 3, 'm'), 'm'), // 12
  sym(HL, hb(HL, 3, 'M'), 'M'), // 13
  sym(HL, hb(HL, 4, 'm'), 'm'), // 14
  sym(HL, hb(HL, 5, 'M'), 'M'), // 15
  sym(HL, hb(HL, 7, '5'), '5'), // 16
  sym(HL, hb(HL, 8, '5'), '5'), // 17  the neck
  sym(HL, hb(HL, 8, '}'), '}'), // 18
];
headKit('furnace', { rows: furnaceHeadRows, down: { crown: 'M', dark: '5', face: 'm', eye: '}', deep: '}' }, downFlip: true });
armKit(
  'furnace',
  { arm: 'M', armDark: '5', fore: 'm', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'm' },
  { hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5', wide: true },
  16,
  7,
);
reg('fallen_furnace', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'A', bootDeep: '<' }, FALLEN_SLUMP, true));
/** GREATHAMMER — a forge hammer with one flat face and one drawn peen, its haft bound in leather. */
reg(
  'greathammer',
  part(
    [
      R(17, [1, 'MMMMMMMMMMMM']),
      R(17, [0, 'M**********5M'], [14, 'M']),
      R(17, [0, 'M*mmmmmmmmm5M'], [13, 'MM']),
      R(17, [0, 'M*mmmmmmmmm5M'], [13, 'm5']),
      R(17, [0, 'M5mmmmmmmmm5M'], [14, 'M']),
      R(17, [0, 'M55555555555M']),
      R(17, [1, '}}}}}}}}}}}']),
      R(17, [5, 'MMM']),
      R(17, [5, 'M*M']),
      ...rep(4, R(17, [5, 'L4L'])),
      ...rep(4, R(17, [5, 'L~L'])),
      ...rep(4, R(17, [5, 'L4L'])),
      R(17, [5, 'M5M']),
      R(17, [5, 'MMM']),
      R(17, [5, 'M5M']),
      R(17, [4, '5}}}5']),
    ],
    { weaponGrip: { x: 6, y: 21 } },
  ),
);

// --- FORGE SAINT (boss) — a crucible in vestments -------------------------------
// SACRED EMBER makes it briefly unkillable and CRUCIBLE FLARE burns the party:
// the torso is an OPEN CRUCIBLE of white fire under a soot-black chasuble, so
// the biggest light in the biome is inside the boss rather than on it. A halo
// of sparks, a hammer-sceptre, and a mantle that hangs to the floor.
const FSL = 20;
const FSW = 2 * FSL + 1;
const saintTop = bands(FSL, [
  [2, hb(FSL, 16, '2'), '2'], //  0-1  the throat of the chasuble
  [1, hb(FSL, 4, 'C'), 'C'], //  2    a broad flat yoke
  [3, hb(FSL, 3, 'C'), 'C'], //  3-5
  [1, hb(FSL, 5, '2'), '2'], //  6
  [1, hb(FSL, 6, '['), '['], //  7    its deep seam
  [1, hb(FSL, 7, 'M', 'GGGG'), 'G'], //  8    THE CRUCIBLE opens
  [5, hb(FSL, 6, 'M', '7GGGG'), 'G'], //  9-13
  [1, hb(FSL, 7, 'm', 'GG7G'), '7'], // 14   and its lip closes over the fire
  [1, hb(FSL, 7, '5'), 'M'], // 15   the crucible's iron band
  [1, hb(FSL, 6, '}'), '}'], // 16   deep seam
  [6, hbf(FSL, 5, 'C', '2', [7, 13, 18]), 'C'], // 17-22 the chasuble falls
  [3, hbf(FSL, 4, 'c', '[', [9, 15]), 'c'], // 23-25 into shadow
  [2, hb(FSL, 4, '['), '['], // 26-27 the hem band
]);
const saintRows = [
  ...turn(selfShadow(shoulderDrop(saintTop, 2, FSL, 'C', 5, 3), '[', 3, [8, 16], [5, FSW - 6], 8), { top: 2, bottom: 15, ch: 'C', pelvis: [17, 27] }),
  ...hemShift(bands(FSL + 1, [[10, hbf(FSL + 1, 5, 'c', '[', [8, 14]), 'c']]), 0, 'c', 4, 1),
  ...scallopHem(FSW + 2, 'c', '[', [4, 2, 5, 3]),
];
const saintAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: FSL + 2, y: 0 },
  hand: { x: FSL, y: 4 },
  capePin: { x: FSL - 3, y: 3 },
  feet: { x: FSL, y: saintRows.length - 1 },
  hit: { x: FSL, y: 18 },
};
reg('saintf_body', part(saintRows, saintAnchors));
reg('saintf_body_sway', part(shiftRows(saintRows, 1, 22, saintRows.length - 2), saintAnchors));
reg('saintf_body_hurt', bodyRecoil(saintRows, saintAnchors, 34, 14));
const FSHL = 15;
const saintHeadRows = bands(FSHL, [
  [1, hb(FSHL, 9, 'M'), 'M'], //  0  a smith's mitre: a tall iron cap
  [1, hb(FSHL, 8, '*'), '*'], //  1  its lit face
  [2, hb(FSHL, 7, '*'), '*'], //  2-3
  [2, hb(FSHL, 6, 'M'), 'M'], //  4-5
  [1, hb(FSHL, 5, '*'), '*'], //  6
  [1, hb(FSHL, 4, 'M'), 'M'], //  7
  [1, hb(FSHL, 4, '5'), '5'], //  8  the mitre's dark band
  [1, hb(FSHL, 4, '}'), '}'], //  9
  [1, hb(FSHL, 4, 'C'), 'C'], // 10  a cowl under it
  [1, hb(FSHL, 4, '2'), '2'], // 11
  [2, hb(FSHL, 6, '['), '['], // 12-13 the hood's interior — nothing of a face reads but the fire in it
  [1, stamp(hb(FSHL, 6, '['), [8, 'G']), '['], // 14
  [1, stamp(hb(FSHL, 6, '['), [8, '7']), '['], // 15
  [2, hb(FSHL, 5, 'C'), 'C'], // 16-17 the cowl closes under the jaw
  [1, hb(FSHL, 6, 'c'), 'c'], // 18
  [1, hb(FSHL, 8, '2'), '2'], // 19
  [2, hb(FSHL, 10, '2'), '2'], // 20-21 the neck
  [1, hb(FSHL, 10, '['), '['], // 22
]);
headKit('saintf', { rows: saintHeadRows, cx: FSHL, down: { crown: 'M', dark: '5', face: 'C', eye: '#', deep: '[' }, lift: 2 });
reg('fallen_saintf', fallenBody({ g: 'C', dark: '2', deep: '[', boot: 'M', bootDeep: '}' }, FALLEN_COIL, false, 1.5));
armKit(
  'vestment',
  { arm: 'C', armDark: '2', fore: 'c', cuff: '2', hand: 'L', handDeep: '{', nearArm: 'c' },
  { hand: 'L', notch: 'l', edge: '4', deep: '{', lit: '~', cuff: '2' },
  17,
  6,
);
/** A halo of sparks — a broken ring of embers rather than a plate, so it reads as a forge saint and not a church one. */
reg(
  'halo_sparks',
  part([
    R(32, [11, 'GGGGGGGGGG']),
    R(32, [7, 'GGGG'], [21, 'GGGG']),
    R(32, [5, 'GG'], [25, 'GG']),
    R(32, [3, 'GG'], [27, 'GG']),
    R(32, [2, 'GG'], [28, 'GG']),
    R(32, [2, 'G7'], [28, '7G']),
    R(32, [3, 'GG'], [27, 'GG']),
    R(32, [4, 'GG'], [26, 'GG']),
    R(32, [6, 'GG'], [24, 'GG']),
    R(32, [8, 'GG'], [22, 'GG']),
    R(32, [10, 'GG'], [20, 'GG']),
    R(32, [12, 'GGGGGGGG']),
  ]),
);
/** A mantle to the floor, hanging behind the crucible. */
const saintfCloakRows = [
  ...bands(15, [
    [2, hb(15, 1, 'C'), 'C'],
    [5, hbf(15, 0, 'C', '2', [5, 10]), 'C'],
    [10, hbf(15, 0, 'C', '2', [4, 9, 12]), 'C'],
    [8, hbf(15, 0, 'c', '[', [6, 11]), 'c'],
  ]),
  ...scallopHem(31, 'c', '[', [4, 2, 6, 3, 5, 2]),
];
reg('cloak_saintf', part(saintfCloakRows, { capePin: { x: 14, y: 1 } }));
reg(
  'cloak_saintf_sway',
  part(
    saintfCloakRows.map((r, i) => (i >= 16 ? shiftX(r, 2) : i >= 9 ? shiftX(r, 1) : r)),
    { capePin: { x: 14, y: 1 } },
  ),
);
/** SEARLIGHT — a hammer-sceptre: a hot billet held in an iron head on a long haft. */
reg(
  'sceptre_hammer',
  part(
    [
      R(13, [2, 'MMMMMMM']),
      R(13, [1, 'M*GGGGG*M']),
      R(13, [1, 'M*G777G*M']),
      R(13, [1, 'M*GGGGG*M']),
      R(13, [1, 'M5mmmmm5M']),
      R(13, [2, '}}}}}}}']),
      R(13, [4, 'MMM']),
      R(13, [4, 'M*M']),
      ...rep(20, R(13, [4, 'M5M'])),
      R(13, [4, 'MMM']),
      R(13, [4, 'M5M']),
      R(13, [3, '5}}}5']),
      R(13, [3, 'MMMMM']),
      R(13, [4, '}}}']),
    ],
    { weaponGrip: { x: 5, y: 20 } },
  ),
);

// ================================================================================
// SUNKEN VAULT (act 5) — WATER dominant, WIND foil, DARK boss.
// A drowned reliquary read against VAULT_GROUND's teal floor (#3e6d7c) under a
// #6fd8ff key. Teal on teal disappears, so this pack is BRONZE and KELP — warm
// verdigris metal, an olive weed and a cold bioluminescence that is the only
// thing in it allowed to be cyan.
// ================================================================================

// --- DROWNED SENTINEL — the vault's pikeman -------------------------------------
// RUSTED PIKE and UNDERTOW GRASP. Tall and NARROW where the crypt's drowned
// knight is hunched and the ruins' sentinel is a T: a barnacled bronze cuirass
// over a long scale skirt, a kelp veil hanging from an open-faced helm, and a
// pike carried across the body at sixty degrees.
const DSL = 12;
const DSW = 2 * DSL + 1;
const dsentTop = bands(DSL, [
  [2, hb(DSL, 9, '5'), '5'], //  0-1  the gorget
  [1, hb(DSL, 3, '*'), '*'], //  2    narrow shoulders, and their lit tops carry the key
  [2, hb(DSL, 2, '*'), '*'], //  3-4
  [1, hb(DSL, 4, '5'), '5'], //  5
  [1, hb(DSL, 5, '}'), '}'], //  6    the deep seam under them
  [1, hb(DSL, 4, '*'), '*'], //  7    the cuirass's lit top edge
  [2, hbf(DSL, 4, 'M', 'm', [6]), 'M'], //  8-9
  [1, hb(DSL, 4, '5'), '5'], // 10   a barnacled course
  [2, hbf(DSL, 4, 'M', 'm', [7]), 'M'], // 11-12
  [1, hb(DSL, 3, '4'), 'M'], // 13   the belt
  [1, hb(DSL, 3, '{'), '{'], // 14   deep seam
  [6, hbf(DSL, 3, 'C', '2', [5, 9]), 'C'], // 15-20 a long scale skirt
  [2, hbf(DSL, 2, 'c', '[', [6]), 'c'], // 21-22 falling into shadow
  [2, hb(DSL, 2, '['), '['], // 23-24 its hem band, deep
]);
const dsentRows = [
  ...turn(selfShadow(shoulderDrop(dsentTop, 2, DSL, 'M', 4, 2), '}', 3, [8, 14], [3, DSW - 4]), { top: 2, bottom: 13, ch: 'M', pelvis: [15, 24] }),
  ...legsTurned(DSW + 2, 9, { pad: 4, w: 6, leg: 'm', knee: '5', boot: '}', cuff: '5' }, { pad: 5, w: 7, leg: 'M', knee: 'm', boot: '5', cuff: 'M' }, 5),
];
const dsentAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: DSL + 2, y: 0 },
  hand: { x: DSL, y: 4 },
  capePin: { x: DSL - 2, y: 3 },
  feet: { x: DSL, y: dsentRows.length - 1 },
  hit: { x: DSL, y: 14 },
};
bodyKit('dsent', { rows: dsentRows, anchors: dsentAnchors, hemFrom: 15, pivot: 24, lean: 8 });
const dsentHeadRows = [
  sym(HL, hb(HL, 6, '*'), '*'), //  0  an OPEN-faced helm: a low skull cap, no visor at all
  sym(HL, hb(HL, 4, '*'), '*'), //  1
  sym(HL, hb(HL, 3, '*'), '*'), //  2
  sym(HL, hb(HL, 3, 'M'), 'M'), //  3  its rim
  sym(HL, hb(HL, 3, '}'), '}'), //  4
  ...faceBlock({ side: 'C', sideDark: '[', skin: 's', eye: '#', sclera: 'g', brow: 1, spacing: 1, mouth: 3, turn: true }),
  stamp(sym(HL, hb(HL, 4, 'C'), 'C'), [5, 'c'], [16, 'c']), // and a kelp veil closing under the jaw
  stamp(sym(HL, hb(HL, 5, 'c'), 'c'), [7, '2']),
  stamp(sym(HL, hb(HL, 6, 'C'), 'C'), [8, '['], [14, '[']),
  sym(HL, hb(HL, 8, '2'), '2'),
];
headKit('dsent', { rows: dsentHeadRows, down: { crown: 'M', dark: '5', face: 's', eye: '#', deep: '(' } });
armKit(
  'bronze',
  { arm: 'M', armDark: '5', fore: 'm', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'm' },
  { hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5' },
  13,
  5,
);
reg('fallen_bronze', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'C', bootDeep: '[' }, FALLEN_PITCH, true));
/** RUSTED PIKE — a long shaft with a leaf head and a weed-wrapped grip; too tall to swing, so its rig thrusts. */
reg(
  'rusted_pike',
  part(
    [
      R(9, [4, 'M']),
      R(9, [3, 'M*M']),
      R(9, [3, 'M*M']),
      R(9, [2, 'M*mM5']),
      R(9, [2, 'M*mM5']),
      R(9, [2, 'M5mM5']),
      R(9, [3, 'M5M']),
      R(9, [3, '5}5']),
      R(9, [3, 'LLL']),
      ...rep(9, R(9, [3, 'L4L'])),
      ...rep(3, R(9, [3, 'CCC'])),
      ...rep(12, R(9, [3, 'L4L'])),
      ...rep(3, R(9, [3, 'cCc'])),
      ...rep(6, R(9, [3, 'L4L'])),
      R(9, [3, '4{4']),
    ],
    { weaponGrip: { x: 4, y: 26 } },
  ),
);

// --- VAULT JELLY — a bell over a curtain of stingers -----------------------------
// NUMBING STING blocks healing. A translucent bell with a bioluminescent ring
// low inside it and eleven stingers of unequal length trailing under — the
// stingers ARE the strike, driven eleven cells forward on the blow.
const JLY_W = 40;
const JLY_H = 46;
interface JellyPose {
  /** The bell pulses: 0 relaxed, 1 contracted. */
  pulse?: number;
  dx?: number;
  dy?: number;
  /** How far the stingers are thrown forward. */
  cast?: number;
}
function jellyGrid(o: JellyPose = {}): string[] {
  const { pulse = 0, dx = 0, dy = 0, cast = 0 } = o;
  const g = grid(JLY_W, JLY_H);
  const cx = 19 + dx;
  const by = 15 + dy + pulse * 3;
  // the bell: a dome with a flared rim, contracting on the pulse
  ell(g, cx, by, 14 - pulse * 2, 11 - pulse * 3, 'D');
  box(g, cx - 14 + pulse * 2, by, cx + 14 - pulse * 2, by + 3 - pulse, 'D');
  ell(g, cx, by + 4 - pulse, 13 - pulse * 2, 3, 'd');
  // the stingers, each its own length, pitch and thickness
  const st = [-13, -10, -7, -4, -1, 2, 5, 8, 11, 13];
  st.forEach((sx, i) => {
    const len = 16 + ((i * 7) % 11);
    limb(g, cx + sx, by + 2, cx + sx + (i % 3) - 1 + cast, by + 4 + len + (cast >> 1), 3 - (i % 2), 1, i % 2 ? 'A' : 'a');
  });
  // one heavy oral arm, longer and thicker than the rest
  limb(g, cx - 3, by + 3, cx - 6 + cast, by + 26 + cast, 6, 2, 'D');
  topLight(g, '=', 3, 'D');
  underbelly(g, '3', ']', 3, 'D', 2);
  box(g, cx - 13, by + 4, cx + 13, by + 5, ']'); // the bell's own deep rim, where the stingers hang from it
  planeEll(g, cx + 6, by + 1, 9, 8);
  // the bioluminescent ring, low inside the bell where a jelly's own light sits
  const out = rowsOf(g);
  return stampRows(stampRows(out, by - 1, by - 1, [cx - 8, 'GG'], [cx - 2, 'GGG'], [cx + 5, 'GG']), by, by, [cx - 7, '7'], [cx + 1, '7'], [cx + 6, '7']);
}
const JELLY_ANCH = { feet: { x: 19, y: JLY_H - 1 }, hit: { x: 19, y: 17 } };
beastKit('jelly', {
  idle: [jellyGrid(), jellyGrid({ pulse: 1, dy: 1 }), jellyGrid({ dy: -1, cast: 1 })],
  wind: jellyGrid({ pulse: 1, dx: -4, dy: -2, cast: -3 }),
  strike: jellyGrid({ dx: 4, dy: 2, cast: 9 }),
  hurt: jellyGrid({ pulse: 1, dx: -7, dy: -3, cast: -4 }),
  dead: [
    (() => {
      // A jelly out of the water does not fall — it SETTLES: the bell collapses
      // to a third of its height and the stingers lie in a fan around it.
      const g = grid(JLY_W, JLY_H);
      ell(g, 20, 39, 15, 5, 'D');
      ell(g, 20, 42, 17, 3, 'd');
      for (const [sx, ex] of [
        [6, 1],
        [11, 4],
        [16, 10],
        [24, 32],
        [29, 37],
        [33, 39],
      ])
        limb(g, sx, 42, ex, 44 + (sx % 2), 3, 1, 'a');
      topLight(g, '=', 2, 'D');
      underbelly(g, '3', ']', 2, 'D');
      return stampRows(rowsOf(g), 38, 38, [14, 'G'], [20, 'G'], [26, 'G']);
    })(),
  ],
  w: JLY_W,
  h: JLY_H,
  anchors: JELLY_ANCH,
});

// --- TIDE ORACLE — the vault's support -------------------------------------------
// DEEP MEND and TIDAL BLESSING, and she CRADLES: a scrying shell held in two
// cupped hands under a wide CORAL CROWN that is three cells wider than her
// shoulders — the one figure in the game whose head is the widest part of the
// silhouette, which is what takes her off TIDE's and the MARSH HAG's bell.
const TOL = 13;
const TOW = 2 * TOL + 1;
const oracleTop = bands(TOL, [
  [2, hb(TOL, 10, '2'), '2'], //  0-1  the throat of the mantle
  [1, hb(TOL, 6, '['), '['], //  2    a deep collar
  [1, hb(TOL, 2, 'C'), 'C'], //  3    sloped shoulders, not a plank
  [2, hb(TOL, 1, 'C'), 'C'], //  4-5
  [1, hb(TOL, 2, 'c'), 'c'], //  6
  [1, hb(TOL, 4, '['), '['], //  7    the seam under them
  [3, hbf(TOL, 3, 'C', '2', [6], 'A2'), 'A'], //  8-10 the mantle, a coral band down one edge
  [1, hb(TOL, 3, 'C', 'A2'), 'A'], // 11
  [1, hb(TOL, 3, '6'), 'A'], // 12   a shell clasp at the waist
  [1, hb(TOL, 3, '<'), '<'], // 13   deep seam
  [6, hbf(TOL, 2, 'C', '2', [4, 8]), 'C'], // 14-19 the robe falls
  [4, hbf(TOL, 1, 'c', '[', [5, 10]), 'c'], // 20-23 into shadow
  [1, hb(TOL, 1, '['), '['], // 24   its hem band
]);
/** The robe SPLITS into two tails at the hem, one longer than the other, so it reads as a current pulling at it. */
const oracleRows = [
  ...hemShift(turn(selfShadow(shoulderDrop(oracleTop, 3, TOL, 'C', 3, 1), '[', 3, [8, 14], [3, TOW - 4]), { top: 3, bottom: 12, ch: 'C', pelvis: [14, 24] }), 12, 'c', 5, 2),
  // the two tails are NOT a pair: the weight-side one hangs four rows lower
  ...[
    stanceRow(TOW + 2, 4, 7, 'c', 3, 6, 'c'),
    stanceRow(TOW + 2, 4, 7, 'c', 3, 6, 'c'),
    stanceRow(TOW + 2, 5, 6, 'c', 3, 6, 'c'),
    stanceRow(TOW + 2, 5, 5, '[', 3, 6, 'c'),
    stanceRow(TOW + 2, 6, 4, '[', 4, 5, 'c'),
    stanceRow(TOW + 2, 0, 0, '.', 4, 5, 'c'),
    stanceRow(TOW + 2, 0, 0, '.', 4, 5, '['),
  ],
];
const oracleAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: TOL + 2, y: 0 },
  hand: { x: TOL, y: 4 },
  capePin: { x: TOL - 2, y: 3 },
  feet: { x: TOL, y: oracleRows.length - 1 },
  hit: { x: TOL, y: 14 },
};
bodyKit('oracle', { rows: oracleRows, anchors: oracleAnchors, hemFrom: 14, pivot: 26, lean: 10 });
const oracleHeadRows = [
  R(27, [2, 'B'], [7, 'BB'], [13, 'B'], [18, 'BB'], [24, 'B']), // THE CORAL CROWN — five uneven prongs, wider than the shoulders
  R(27, [1, 'BB'], [6, 'BBB'], [12, 'BB'], [17, 'BBB'], [23, 'BB']),
  R(27, [1, 'B%BBB%BBBBB%BBBBB%BBBBB%B']),
  R(27, [1, 'B8888888888888888888888B']),
  R(27, [2, '&&&&&&&&&&&&&&&&&&&&&&']),
  ...crown('H', [7, 6, 5, 4], [1, 1, 0, 0]).map((r) => padRow(27, 2, r)), // hair under it
  ...faceBlock({ side: 'H', sideDark: '1', brow: -1, spacing: 1, mouth: 2, cheek: true, turn: true }).map((r) => padRow(27, 2, r)),
  padRow(27, 2, sym(HL, hb(HL, 5, 'H'), 'H')),
  padRow(27, 2, sym(HL, hb(HL, 7, '1'), '1')),
];
headKit('oracle', { rows: oracleHeadRows, cx: 13, down: { crown: 'H', dark: '1', face: 'S', eye: '#', deep: '(' }, lift: 1 });
armKit(
  'shell',
  { arm: 'C', armDark: '2', fore: 'c', cuff: '2', hand: 'S', handDeep: '(', nearArm: 'c' },
  { hand: 'S', notch: 's', edge: '0', deep: '(', lit: '$', cuff: '2' },
  13,
  5,
);
reg('fallen_oracle', fallenBody({ g: 'C', dark: '2', deep: '[', boot: 'c', bootDeep: '[' }, FALLEN_COIL, true));
/** The scrying shell she cradles: a spiral shell with a light inside its mouth. */
reg(
  'scrying_shell',
  part(
    [
      R(15, [5, 'BBBB']),
      R(15, [3, 'B%%%%%BB']),
      R(15, [2, 'B%%bbb%%8B']),
      R(15, [1, 'B%%b8G8b%%8B']),
      R(15, [1, 'B%b8G77G8b%8B']),
      R(15, [1, 'B%b8G777G8b8B']),
      R(15, [1, 'B%b88G7G88b8B']),
      R(15, [1, 'B%bb888888b8B']),
      R(15, [2, 'B%bbbbbbbb8B']),
      R(15, [2, 'B88888888&B']),
      R(15, [3, '&&&&&&&&&']),
    ],
    { weaponGrip: { x: 6, y: 9 } },
  ),
);

// --- WIND EEL — the WIND foil in a drowned room ----------------------------------
// RIPTIDE GUST strips ATB. A ribbon body held in a standing S with a sail fin
// down its whole back, sparks at the jaw and no legs anywhere — it is the one
// thing in the vault that reads as FAST.
const EEL_W = 36;
const EEL_H = 48;
interface EelPose {
  /** How hard the S is wound. */
  s?: number;
  hx?: number;
  hy?: number;
  dx?: number;
  jaw?: number;
  spark?: boolean;
}
function eelGrid(o: EelPose = {}): string[] {
  const { s = 1, hx = 0, hy = 0, dx = 0, jaw = 0, spark = false } = o;
  const g = grid(EEL_W, EEL_H);
  const cx = 17 + dx;
  // the body: five segments alternating side to side, thinning upward
  const pts: readonly [number, number, number][] = [
    [cx - 2, 47, 10],
    [cx + 5 * s, 39, 9],
    [cx - 5 * s, 30, 8],
    [cx + 4 * s, 21, 7],
    [cx - 3 * s + hx, 13 + hy, 6],
  ];
  for (let i = 0; i < pts.length - 1; i++) limb(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2], 'L');
  // the sail fin, rippling down the whole back
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    for (let k = 0; k <= 3; k++) {
      const t = k / 3;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      limb(g, px, py, px + (i % 2 ? 7 : -7), py - 3, 4, 1, 'D');
    }
  }
  // the head: a wedge skull with a long jaw
  ell(g, cx - 3 * s + hx, 11 + hy, 6, 5, 'L');
  limb(g, cx - 4 * s + hx, 12 + hy, cx - 12 * s + hx, 14 + hy, 5, 2, 'L');
  limb(g, cx - 4 * s + hx, 13 + hy + jaw, cx - 11 * s + hx, 17 + hy + 2 * jaw, 4, 2, 'B');
  topLight(g, '~', 2, 'L');
  topLight(g, '=', 1, 'D');
  underbelly(g, '4', '{', 3, 'L');
  planeBox(g, cx + 2, 20, cx + 11, 40);
  let out = rowsOf(g);
  out = stampRows(out, 10 + hy, 10 + hy, [Math.max(0, cx - 6 * s + hx) | 0, '#G']);
  if (spark) {
    out = stampRows(out, 16 + hy, 16 + hy, [Math.max(0, cx - 14 * s + hx) | 0, '@@']);
    out = stampRows(out, 19 + hy, 19 + hy, [Math.max(0, cx - 12 * s + hx) | 0, '@']);
  }
  return out;
}
const EEL_ANCH = { feet: { x: 15, y: EEL_H - 1 }, hit: { x: 17, y: 26 } };
beastKit('eel', {
  idle: [eelGrid(), eelGrid({ s: 0.7, hy: 1 }), eelGrid({ s: 1.3, hy: -1, jaw: 1 })],
  wind: eelGrid({ s: 1.4, hx: 4, hy: 2, dx: -3 }),
  strike: eelGrid({ s: 0.4, hx: -8, hy: 3, dx: 4, jaw: 4, spark: true }),
  hurt: eelGrid({ s: 1.5, hx: 5, hy: -3, dx: -6, jaw: 2 }),
  dead: [
    (() => {
      // Out of the current it lies flat in three slack curves, the sail fin
      // collapsed along it — nineteen rows against forty-eight.
      const g = grid(EEL_W, EEL_H);
      const pts: readonly [number, number, number][] = [
        [34, 41, 9],
        [24, 44, 8],
        [13, 40, 7],
        [4, 43, 6],
      ];
      for (let i = 0; i < pts.length - 1; i++) limb(g, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2], 'L');
      for (const [px, py] of pts) limb(g, px, py, px - 3, py - 4, 4, 1, 'D');
      ell(g, 3, 43, 5, 4, 'L');
      limb(g, 2, 44, 1, 47, 4, 2, 'B');
      topLight(g, '~', 1, 'L');
      underbelly(g, '4', '{', 2, 'L');
      return stampRows(rowsOf(g), 42, 42, [2, '##']);
    })(),
  ],
  w: EEL_W,
  h: EEL_H,
  anchors: EEL_ANCH,
});

// --- LEVIATHAN SPAWN (elite) — the coil ------------------------------------------
// MAW BITE and CRUSHING COILS: the whole silhouette is the coil, three stacked
// loops of body with a huge wedge skull rising off the top of them. The strike
// throws the skull eleven cells and opens a jaw of nine teeth.
const LEV_W = 54;
const LEV_H = 54;
interface LevPose {
  /** How tight the coils are wound. */
  coil?: number;
  hx?: number;
  hy?: number;
  jaw?: number;
  bx?: number;
  by?: number;
}
function levGrid(o: LevPose = {}): string[] {
  const { coil = 0, hx = 0, hy = 0, jaw = 0, bx = 0, by = 0 } = o;
  const g = grid(LEV_W, LEV_H);
  const cx = 24 + bx;
  // three coils, each narrower and higher than the last
  ell(g, cx, 47 + by, 22 - coil * 2, 6, 'L');
  ell(g, cx - 3, 40 + by, 18 - coil, 6, 'L');
  ell(g, cx + 3, 33 + by + coil, 14, 6, 'L');
  // the tail tip escaping the bottom coil
  limb(g, cx - 20, 46 + by, cx - 30, 40 + by, 6, 2, 'L');
  // the trunk rising out of the coils, and the skull
  limb(g, cx + 5, 32 + by, cx + 10 + hx, 16 + hy, 12, 8, 'L');
  ell(g, cx + 12 + hx, 13 + hy, 8, 6, 'L');
  // brow horns and a long lower jaw
  limb(g, cx + 9 + hx, 8 + hy, cx + 4 + hx, 2 + hy, 3, 1, 'B');
  limb(g, cx + 15 + hx, 8 + hy, cx + 13 + hx, 2 + hy, 3, 1, 'B');
  limb(g, cx + 16 + hx, 14 + hy, cx + 27 + hx, 15 + hy, 7, 3, 'L');
  limb(g, cx + 14 + hx, 16 + hy + jaw, cx + 26 + hx, 19 + hy + 2 * jaw, 6, 3, 'B');
  topLight(g, '~', 3, 'L');
  underbelly(g, '4', '{', 4, 'L');
  planeEll(g, cx + 12, 42 + by, 14, 8);
  planeBox(g, cx + 12 + hx, 18 + hy, cx + 24 + hx, 26 + hy);
  let out = rowsOf(g);
  // the eye, and a row of teeth that only shows when the jaw is open
  out = stampRows(out, 11 + hy, 11 + hy, [cx + 9 + hx, '#GG']);
  out = stampRows(out, 12 + hy, 12 + hy, [cx + 9 + hx, '#44']);
  if (jaw > 1) out = stampRows(out, 16 + hy + jaw, 16 + hy + jaw, [cx + 16 + hx, '%&%&%&%&%']);
  return out;
}
const LEV_ANCH = { feet: { x: 24, y: LEV_H - 1 }, hit: { x: 30, y: 30 } };
beastKit('lev', {
  idle: [levGrid(), levGrid({ by: 1, hy: 1, jaw: 1 }), levGrid({ coil: 1, hy: -2 })],
  wind: levGrid({ coil: 1, hx: -6, hy: 3, bx: -2, jaw: 1 }),
  strike: levGrid({ hx: 8, hy: 4, jaw: 5, bx: 1 }),
  hurt: levGrid({ coil: 1, hx: -9, hy: -4, bx: -3, by: 1, jaw: 3 }),
  dead: [
    (() => {
      // The coils slacken and run out flat, the skull down at the far end —
      // twenty-two rows against fifty-four.
      const g = grid(LEV_W, LEV_H);
      limb(g, 1, 38, 16, 43, 6, 12, 'L');
      ell(g, 24, 45, 20, 7, 'L');
      limb(g, 34, 42, 44, 46, 12, 8, 'L');
      ell(g, 46, 48, 7, 5, 'L');
      limb(g, 44, 43, 40, 37, 3, 1, 'B');
      limb(g, 49, 49, 53, 51, 5, 3, 'B');
      topLight(g, '~', 2, 'L');
      underbelly(g, '4', '{', 3, 'L');
      planeBox(g, 30, 44, 50, 52);
      return stampRows(rowsOf(g), 46, 46, [45, '##']);
    })(),
  ],
  w: LEV_W,
  h: LEV_H,
  anchors: LEV_ANCH,
});

// --- SUNKEN KING (boss) — the drowned monarch ------------------------------------
// DROWNING CHORUS and THRONE OF RUIN. A heavy figure whose plate has gone to
// verdigris and whose mantle is WEED: a coral crown of five prongs, a chest
// carrying a drowned reliquary lamp, and a trident planted across the body. Its
// legs are gone below the knee into a skirt of kelp, so nothing about its
// silhouette is the Skyfallen King's.
const SKGL = 20;
const SKGW = 2 * SKGL + 1;
const skingTop = bands(SKGL, [
  [2, hb(SKGL, 16, '5'), '5'], //  0-1  the gorget
  [1, hb(SKGL, 1, 'M'), 'M'], //  2    a broad drowned pauldron line, three cells past the hips
  [3, hb(SKGL, 0, 'M'), 'M'], //  3-5
  [1, hb(SKGL, 4, '5'), '5'], //  6
  [1, hb(SKGL, 5, '}'), '}'], //  7    the deep seam under them
  [1, hb(SKGL, 6, '*'), '*'], //  8    the cuirass's lit top edge
  [2, hbf(SKGL, 6, 'M', 'm', [8, 14]), 'M'], //  9-10
  [1, hb(SKGL, 6, 'M', 'GG'), 'G'], // 11   the reliquary lamp set into the chest
  [2, hb(SKGL, 6, 'M', '7G'), 'G'], // 12-13
  [1, hb(SKGL, 6, 'm', 'G7'), '7'], // 14
  [1, hb(SKGL, 5, '5'), 'M'], // 15   a heavy belt
  [1, hb(SKGL, 5, '}'), '}'], // 16   deep seam
  [7, hbf(SKGL, 4, 'C', '2', [6, 12, 17]), 'C'], // 17-23 a skirt of kelp
  [4, hbf(SKGL, 3, 'c', '[', [8, 15]), 'c'], // 24-27 falling into shadow
  [2, hb(SKGL, 3, '['), '['], // 28-29 its hem band
]);
const skingRows = [
  ...turn(selfShadow(shoulderDrop(skingTop, 2, SKGL, 'M', 5, 3), '}', 3, [9, 16], [4, SKGW - 5], 8), { top: 2, bottom: 15, ch: 'M', pelvis: [17, 29] }),
  ...hemShift(bands(SKGL + 1, [[8, hbf(SKGL + 1, 6, 'c', '[', [9, 15]), 'c']]), 0, 'c', 3, 2),
  ...scallopHem(SKGW + 2, 'c', '[', [5, 2, 7, 3, 4, 2]),
];
const skingAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SKGL + 2, y: 0 },
  hand: { x: SKGL, y: 4 },
  capePin: { x: SKGL - 3, y: 3 },
  feet: { x: SKGL, y: skingRows.length - 1 },
  hit: { x: SKGL, y: 20 },
};
reg('sking_body', part(skingRows, skingAnchors));
reg('sking_body_sway', part(shiftRows(skingRows, 1, 24, skingRows.length - 2), skingAnchors));
reg('sking_body_hurt', bodyRecoil(skingRows, skingAnchors, 36, 12));
const SKGHL = 15;
const skingHeadRows = bands(SKGHL, [
  [1, hb(SKGHL, 8, '*'), '*'], //  0  a low crowned helm, lit across its whole top
  [2, hb(SKGHL, 6, '*'), '*'], //  1-2
  [2, hb(SKGHL, 4, '*'), '*'], //  3-4
  [1, hb(SKGHL, 3, '*'), '*'], //  5
  [1, hb(SKGHL, 3, '5'), '5'], //  6  the brow band
  [1, hb(SKGHL, 3, '}'), '}'], //  7
  [1, hb(SKGHL, 5, 'C'), 'C'], //  8  and under it a face of WEED, not a visor
  [1, hb(SKGHL, 5, '2'), '2'], //  9
  [2, hb(SKGHL, 6, '['), '['], // 10-11 two drowned lights in the dark of it
  [2, hb(SKGHL, 5, 'C'), 'C'], // 12-13
  [1, hb(SKGHL, 6, 'c'), 'c'], // 14
  [2, hb(SKGHL, 7, 'C'), 'C'], // 15-16 the weed hangs past the jaw
  [1, hb(SKGHL, 9, 'c'), 'c'], // 17
  [1, hb(SKGHL, 10, '2'), '2'], // 18
  [2, hb(SKGHL, 11, '2'), '2'], // 19-20 the neck
  [1, hb(SKGHL, 11, '['), '['], // 21
]);
const skingHeadFinal = stampRows(
  stampRows(stampRows(stampRows(skingHeadRows, 9, 9, [8, '[[[[[[[[[[[[[[']), 10, 10, [10, 'G'], [18, 'G']), 11, 11, [10, '7'], [18, '7']),
  14,
  14,
  [10, '[[[[[[[[[['],
);
headKit('sking', { rows: skingHeadFinal, cx: SKGHL, down: { crown: 'M', dark: '5', face: 'C', eye: '#', deep: '[' }, downFlip: true, lift: 2 });
reg('fallen_sking', fallenBody({ g: 'M', dark: '5', deep: '}', boot: 'C', bootDeep: '[' }, FALLEN_COIL, true, 1.5));
/** A broken anchor, caught over the far shoulder — the one asymmetric mass in the silhouette. */
reg(
  'anchor_broken',
  part([
    R(16, [6, 'MMM']),
    R(16, [6, 'M*M']),
    R(16, [6, 'M*M']),
    R(16, [2, 'MMMM*MMMM']),
    R(16, [2, 'M55*55M']),
    R(16, [6, 'M*M']),
    R(16, [6, 'M*M']),
    R(16, [6, 'M5M']),
    R(16, [6, 'M5M']),
    R(16, [1, 'M5M'], [6, 'M5M']),
    R(16, [1, 'M5MM5M'], [9, 'M']),
    R(16, [2, 'M555M']),
    R(16, [3, '}}}']),
  ]),
);

/** A coral crown of five uneven prongs. */
reg(
  'crown_coral',
  part([
    R(28, [3, 'B'], [8, 'B'], [14, 'B'], [20, 'B'], [25, 'B']),
    R(28, [2, 'BB'], [7, 'BB'], [13, 'BBB'], [19, 'BB'], [24, 'BB']),
    R(28, [2, 'BBB'], [7, 'BB'], [13, 'BBB'], [19, 'BB'], [24, 'BB']),
    R(28, [2, 'BBBBBBBBBBBBBBBBBBBBBBBB']),
    R(28, [2, '%%%%%%%%%%%%%%%%%%%%%%%%']),
    R(28, [2, '888888888888888888888888']),
    R(28, [3, '&&&&&&&&&&&&&&&&&&&&&&']),
  ]),
);
/** A mantle of kelp, hanging to the floor behind him. */
const skingCloakRows = [
  ...bands(15, [
    [2, hb(15, 1, 'C'), 'C'],
    [5, hbf(15, 0, 'C', '2', [4, 10]), 'C'],
    [12, hbf(15, 0, 'C', '2', [3, 8, 12]), 'C'],
    [8, hbf(15, 0, 'c', '[', [6, 11]), 'c'],
  ]),
  ...scallopHem(31, 'c', '[', [6, 3, 8, 2, 5, 4]),
];
reg('cloak_sking', part(skingCloakRows, { capePin: { x: 14, y: 1 } }));
reg(
  'cloak_sking_sway',
  part(
    skingCloakRows.map((r, i) => (i >= 18 ? shiftX(r, 2) : i >= 10 ? shiftX(r, 1) : r)),
    { capePin: { x: 14, y: 1 } },
  ),
);
/** ABYSSAL TRIDENT — three tines on a weed-bound haft; too tall to swing, so it thrusts. */
reg(
  'trident',
  part(
    [
      R(13, [2, 'M'], [6, 'M'], [10, 'M']),
      R(13, [2, 'M'], [6, '*'], [10, 'M']),
      R(13, [2, '*'], [6, '*'], [10, '*']),
      R(13, [2, '*'], [6, '*'], [10, '*']),
      R(13, [2, 'M'], [6, '*'], [10, 'M']),
      R(13, [2, 'M5MM*MM5M']),
      R(13, [3, 'M5M*M5M']),
      R(13, [4, 'M5*5M']),
      R(13, [5, '}}}']),
      ...rep(6, R(13, [5, 'M5M'])),
      ...rep(3, R(13, [5, 'CcC'])),
      ...rep(9, R(13, [5, 'M5M'])),
      ...rep(3, R(13, [5, 'cCc'])),
      ...rep(6, R(13, [5, 'M5M'])),
      R(13, [5, '5}5']),
      R(13, [4, 'BBBBB']),
      R(13, [5, '&&&']),
    ],
    { weaponGrip: { x: 6, y: 25 } },
  ),
);

// ================================================================================
// STORM SPIRE (act 6) — WIND dominant, FIRE foil, LIGHT boss.
// A lightning-lit tower top over SPIRE_GROUND's blue-grey floor (#5b6484) under
// a near-white key. Storm grey on storm grey is a hole, so the pack is BRASS
// and VERDIGRIS-free warm metal with white lightning as the only light.
// ================================================================================

// --- LIGHTNING HAWK — a bird in a stoop -----------------------------------------
// DIVEBOMB. Where the ruins' raptor stands mantled with its wings folded into
// two peaks, this one is already falling: wings swept BACK into a delta, the
// body pitched nose-down along the diagonal, legs tucked, and a bolt running
// the length of one wing on the strike.
const HWK_W = 50;
const HWK_H = 46;
interface HawkPose {
  /** 0 perched with the wings half back, 1 the full stoop. */
  dive?: number;
  hx?: number;
  hy?: number;
  bx?: number;
  by?: number;
  /** Talons dropped for the strike. */
  grab?: number;
  bolt?: boolean;
}
function hawkGrid(o: HawkPose = {}): string[] {
  const { dive = 0, hx = 0, hy = 0, bx = 0, by = 0, grab = 0, bolt = false } = o;
  const g = grid(HWK_W, HWK_H);
  const d = dive;
  // the swept delta: two spars back over the tail, plus their membranes
  const wing = (sx: number, sy: number, tx: number, ty: number, ch: string): void => {
    limb(g, sx, sy, tx, ty, 7, 2, ch);
    for (let i = 1; i <= 3; i++) {
      const t = i / 3;
      limb(g, sx, sy, sx + (tx - sx) * t, sy + (ty - sy) * t + 7 * t, 6 - i, 2, ch);
    }
  };
  wing(24 + bx, 15 + by, 2 + bx - 3 * d, 3 + by - 6 * d, 'H');
  limb(g, 20 + bx, 25 + by, 4 + bx, 36 + by, 8, 3, 'H'); // the tail, fanned back and down
  ell(g, 25 + bx, 22 + by, 13, 10, 'H'); // the body, pitched along the dive line
  wing(30 + bx, 14 + by, 48 + bx + 2 * d, 2 + by - 5 * d, 'h');
  limb(g, 32 + bx, 18 + by, 38 + hx, 10 + hy, 9, 6, 'H'); // a short neck
  ell(g, 40 + hx, 9 + hy, 6, 5, 'H'); // the skull
  limb(g, 41 + hx, 10 + hy, 46 + hx, 12 + hy, 5, 2, 'A'); // a brass beak
  limb(g, 45 + hx, 12 + hy, 43 + hx, 15 + hy, 3, 2, 'A');
  // legs: tucked under the body at rest, thrown forward on the grab
  limb(g, 24 + bx, 30 + by, 26 + bx + grab, 38 + by + grab, 6, 3, 'A');
  limb(g, 30 + bx, 29 + by, 33 + bx + grab, 37 + by + grab, 5, 3, 'a');
  for (const t of [0, 2, 4]) box(g, 23 + bx + grab + t, 39 + by + grab, 24 + bx + grab + t, 40 + by + grab, '<');
  topLight(g, '^', 3, 'H');
  underbelly(g, '1', ')', 4, 'H', 2);
  planeBox(g, 8 + bx, 24 + by, 22 + bx, 32 + by); // the far wing's shadow face
  planeEll(g, 29 + bx, 25 + by, 8, 5);
  let out = rowsOf(g);
  out = stampRows(out, 8 + hy, 8 + hy, [36 + hx, '#GG']);
  out = stampRows(out, 9 + hy, 9 + hy, [36 + hx, '#11']);
  if (bolt) {
    // the strike's bolt, drawn ON the wing it runs down
    const on = (y: number, x: number, str: string): void => {
      if (y < 0 || y >= out.length) return;
      const cells = [...out[y]];
      for (let i = 0; i < str.length; i++) if (x + i < cells.length && cells[x + i] !== '.') cells[x + i] = str[i];
      out[y] = cells.join('');
    };
    for (let i = 0; i < 10; i++) on(8 + i, 34 - i - (i % 3), '@@');
  }
  return out;
}
const HAWK_ANCH = { feet: { x: 25, y: HWK_H - 1 }, hit: { x: 26, y: 22 } };
beastKit('hawk', {
  idle: [hawkGrid(), hawkGrid({ by: 1, hy: 1, dive: 0.3 }), hawkGrid({ dive: 0.6, hy: -1 })],
  wind: hawkGrid({ dive: 0.2, hx: -5, hy: 2, bx: -2 }),
  strike: hawkGrid({ dive: 1, hx: 5, hy: 4, grab: 7, bx: 1, bolt: true }),
  hurt: hawkGrid({ dive: 0.4, hx: -8, hy: -3, bx: -3, by: 1 }),
  dead: [
    (() => {
      // Down on its breast with both wings thrown forward and open — eighteen
      // rows against forty-four, the reverse of the raptor's fold.
      const g = grid(HWK_W, HWK_H);
      limb(g, 18, 33, 40, 30, 7, 2, 'H');
      limb(g, 14, 38, 42, 39, 8, 2, 'h');
      ell(g, 14, 39, 11, 5, 'H');
      limb(g, 3, 36, 12, 39, 3, 7, 'H');
      limb(g, 20, 39, 28, 42, 8, 5, 'H');
      ell(g, 30, 42, 5, 4, 'H');
      limb(g, 32, 42, 38, 43, 4, 2, 'A');
      box(g, 16, 42, 22, 43, 'a');
      topLight(g, '^', 1, 'H');
      underbelly(g, '1', ')', 2, 'H');
      planeBox(g, 20, 39, 36, 43);
      return stampRows(rowsOf(g), 41, 41, [28, '##']);
    })(),
  ],
  w: HWK_W,
  h: HWK_H,
  anchors: HAWK_ANCH,
});

// --- GALE MONK — a fighter with no weapon ---------------------------------------
// WIND PALM scales off SPD, so this is the only humanoid in the twenty-four
// that carries NOTHING: an open palm thrust forward is its weapon, and its
// "haft" is a string of prayer beads wound round that hand. Bare-armed,
// sleeveless, low in the knees, with a sash whose tails stream off the lean.
const GML = 12;
const GMW = 2 * GML + 1;
const monkTop = bands(GML, [
  [2, hb(GML, 9, 'S'), 'S'], //  0-1  a bare throat
  [1, hb(GML, 5, 'D'), 'D'], //  2    the gi's collar
  [1, hb(GML, 4, '+'), '+'], //  3    a bare shoulder line, lit
  [1, hb(GML, 3, '+'), '+'], //  4
  [1, hb(GML, 3, 'c'), 'c'], //  5
  [1, hb(GML, 4, '['), '['], //  6    the seam under it
  [4, hbf(GML, 3, 'C', '2', [5], 'D2'), 'D'], //  7-10 the gi, crossed over at the front
  [1, hb(GML, 3, 'C', 'D2'), 'D'], // 11
  [1, hb(GML, 2, '3'), 'D'], // 12   a broad sash
  [1, hb(GML, 2, ']'), ']'], // 13   and its deep seam
  [4, hbf(GML, 3, 'C', '2', [5, 8]), 'C'], // 14-17 the skirt of the gi, short
  [1, hb(GML, 3, '['), '['], // 18   its hem band
]);
const monkRows = [
  ...turn(selfShadow(shoulderDrop(monkTop, 3, GML, 'C', 4, 2), '[', 3, [7, 13], [3, GMW - 4]), { top: 3, bottom: 12, ch: 'C', pelvis: [14, 18] }),
  // a WIDE low stance: the knees are bent and the feet are further apart than
  // the shoulders, which no other figure in the cast does
  ...legsTurned(GMW + 2, 14, { pad: 1, w: 6, leg: 's', knee: '(', boot: '(', cuff: '(' }, { pad: 1, w: 7, leg: 's', knee: '0', boot: '(', cuff: '0' }, 10),
];
const monkAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: GML + 2, y: 0 },
  hand: { x: GML, y: 4 },
  capePin: { x: GML - 2, y: 3 },
  feet: { x: GML, y: monkRows.length - 1 },
  hit: { x: GML, y: 13 },
};
bodyKit('monk', { rows: monkRows, anchors: monkAnchors, hemFrom: 14, pivot: 20, lean: 8 });
const monkHeadRows = [
  ...crown('^', [9, 7, 6, 5], [-3, -3, -2, -1]), // a shaved crown, lit
  ...crown('H', [5, 5, 5], [0, 0, 0]), // and a topknot swept back off it
  sym(HL, 'HH^HHHHH111', '1'),
  sym(HL, 'HHH^HHH1111', '1'),
  ...faceBlock({ side: 'H', sideDark: '1', brow: -1, spacing: -1, mouth: 1, turn: true }),
];
headKit('monk', { rows: monkHeadRows, down: { crown: 'H', dark: '1', face: 'S', eye: '#', deep: '(' }, lift: 1 });
armKit(
  'late_bare',
  { arm: 'S', armDark: '(', fore: 'S', cuff: '0', hand: 'S', handDeep: '(', nearArm: 's' },
  { hand: 'S', notch: 's', edge: '0', deep: '(', lit: '$', cuff: '0' },
  13,
  4,
);
reg('fallen_monk', fallenBody({ g: 'C', dark: '2', deep: '[', boot: 'S', bootDeep: '(' }, FALLEN_PITCH));
/** A string of prayer beads wound round the striking hand — the monk's "haft", and the thing his fist has to cross. */
reg(
  'beads',
  part(
    [
      R(9, [3, 'A']),
      R(9, [2, 'A6A']),
      R(9, [2, 'A6A']),
      R(9, [1, 'A6.6A']),
      R(9, [1, 'A6.6A']),
      R(9, [1, 'A6.6A']),
      R(9, [2, 'A6A']),
      R(9, [2, 'A6A']),
      R(9, [3, 'A']),
      R(9, [3, '<']),
      R(9, [3, 'A']),
      R(9, [3, '6']),
      R(9, [3, 'A']),
      R(9, [3, '<']),
    ],
    { weaponGrip: { x: 3, y: 6 } },
  ),
);

// --- SPIRE WARDEN — the pack's support -------------------------------------------
// UPDRAFT MEND and STAND FAST. Brass over a storm-blue coat, a tall staff with
// a caged lamp at its head, and a WEATHER-VANE crest on the helm — a spur of
// brass standing a third of a head above it, so its skyline is unmistakable
// beside the golem's flat hood and the furnace knight's squat dome.
const SWL = 17;
const SWW = 2 * SWL + 1;
const wardenTop = bands(SWL, [
  [2, hb(SWL, 11, '2'), '2'], //  0-1  the coat's throat
  [1, hb(SWL, 3, '*'), '*'], //  2    brass shoulder plates, their tops lit
  [2, hb(SWL, 2, '*'), '*'], //  3-4
  [1, hb(SWL, 4, '5'), '5'], //  5
  [1, hb(SWL, 5, '}'), '}'], //  6    the deep seam under them
  [5, hbf(SWL, 4, 'C', '2', [6, 10], 'M2'), 'M'], //  7-11 the coat, a brass placket down the front
  [1, hb(SWL, 4, '5'), 'M'], // 12   the belt and its buckle
  [1, hb(SWL, 4, '}'), '}'], // 13   deep seam
  [3, hbf(SWL, 5, 'C', '2', [7]), 'C'], // 14-16 the coat stops at mid-thigh
  [1, hbf(SWL, 5, 'c', '[', [8]), 'c'], // 17
  [1, hb(SWL, 5, '['), '['], // 18   its hem band
]);
const wardenRows = [
  ...turn(selfShadow(shoulderDrop(wardenTop, 2, SWL, 'M', 4, 2), '}', 3, [7, 13], [4, SWW - 5]), { top: 2, bottom: 12, ch: 'M', pelvis: [14, 22] }),
  ...legsTurned(SWW + 2, 16, { pad: 4, w: 8, leg: '2', knee: '[', boot: '5', cuff: 'm' }, { pad: 5, w: 9, leg: 'c', knee: '2', boot: 'm', cuff: 'M' }, 12),
];
const wardenAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SWL + 2, y: 0 },
  hand: { x: SWL, y: 4 },
  capePin: { x: SWL - 2, y: 3 },
  feet: { x: SWL, y: wardenRows.length - 1 },
  hit: { x: SWL, y: 13 },
};
bodyKit('warden', { rows: wardenRows, anchors: wardenAnchors, hemFrom: 14, pivot: 19, lean: 8 });
const wardenHeadRows = [
  stamp(sym(HL, hb(HL, 9, '*'), '*'), [7, '*'], [15, '.']), //  0  the vane's spur, off centre
  stamp(sym(HL, hb(HL, 8, '*'), '*'), [15, '.']), //  1
  sym(HL, hb(HL, 6, '*'), '*'), //  2  the helm's lit crown
  sym(HL, hb(HL, 4, '*'), '*'), //  3
  sym(HL, hb(HL, 3, '*'), '*'), //  4
  sym(HL, hb(HL, 3, '5'), '5'), //  5  the brow band
  sym(HL, hb(HL, 3, '}'), '}'), //  6
  ...faceBlock({ side: 'M', sideDark: '5', brow: 1, spacing: 0, mouth: 2, turn: true }), //  7-16 an OPEN face under a brass helm
  sym(HL, hb(HL, 5, 'M'), 'M'), // 17  a brass gorget closing under the jaw
  sym(HL, hb(HL, 7, '5'), '5'), // 18
];
headKit('warden', { rows: wardenHeadRows, down: { crown: 'M', dark: '5', face: 's', eye: '#', deep: '(' } });
armKit(
  'brass',
  { arm: 'C', armDark: '2', fore: 'M', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'c' },
  { hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5' },
  13,
  5,
);
reg('fallen_brass', fallenBody({ g: 'C', dark: '2', deep: '[', boot: 'M', bootDeep: '}' }, FALLEN_SLUMP, true));
/** A short storm cape, hanging off the far shoulder only — an asymmetric mass the vault's pikeman does not have. */
const wardenCapeRows = [
  ...bands(11, [
    [2, hb(11, 1, 'D'), 'D'],
    [4, hbf(11, 0, 'D', '3', [4]), 'D'],
    [7, hbf(11, 0, 'D', '3', [3, 8]), 'D'],
    [4, hbf(11, 0, 'd', ']', [5]), 'd'],
  ]),
  ...scallopHem(23, 'd', ']', [4, 2, 5, 3]),
];
reg('cape_storm', part(hemShift(wardenCapeRows, 4, 'd', 5, 0), { capePin: { x: 10, y: 1 } }));
reg(
  'cape_storm_sway',
  part(hemShift(wardenCapeRows.map((r, i) => (i >= 12 ? shiftX(r, 2) : i >= 6 ? shiftX(r, 1) : r)), 4, 'd', 5, 0), { capePin: { x: 10, y: 1 } }),
);

/** A tall staff with a CAGED lamp at its head — four bars over the light, so the brightest pane in the pack is broken. */
reg(
  'storm_staff',
  part(
    [
      R(11, [3, 'MMMMM']),
      R(11, [2, 'M*****M']),
      R(11, [2, 'MGMGMGM']),
      R(11, [2, 'MG7G7GM']),
      R(11, [2, 'MG7G7GM']),
      R(11, [2, 'MGMGMGM']),
      R(11, [2, 'M55555M']),
      R(11, [3, '}}}}}']),
      R(11, [4, 'MMM']),
      R(11, [4, 'M*M']),
      ...rep(9, R(11, [4, 'M5M'])),
      ...rep(2, R(11, [4, 'CcC'])),
      ...rep(10, R(11, [4, 'M5M'])),
      R(11, [4, 'MMM']),
      R(11, [4, 'M5M']),
      R(11, [3, '5}}}5']),
    ],
    { weaponGrip: { x: 5, y: 24 } },
  ),
);

// --- EMBER ELEMENTAL — the FIRE foil at the top of a tower ----------------------
// CINDER BURST, and the crypt's fen fire is the thing to avoid: that one is an
// egg of flame with tongues cut into its top. This is the inverse — a DARK
// CLINKER core with a body of loose embers orbiting it, so its dark is at the
// centre and its light is at the edge, and the burst throws the whole orbit out.
const EMB_W = 38;
const EMB_H = 42;
interface EmberPose {
  /** How far the orbit is thrown out. */
  burst?: number;
  dx?: number;
  dy?: number;
  /** Which of the three tongues is longest — the flicker. */
  lick?: number;
}
function emberGrid(o: EmberPose = {}): string[] {
  const { burst = 0, dx = 0, dy = 0, lick = 0 } = o;
  const g = grid(EMB_W, EMB_H);
  const cx = 19 + dx;
  const cy = 26 + dy;
  const r = 1 + burst * 0.35;
  // the orbit: nine ember masses on an ellipse round the clinker, each its own size
  let px = 0;
  let py = 0;
  for (let i = 0; i <= 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.4;
    const nx = cx + Math.cos(a) * 11 * r;
    const ny = cy + Math.sin(a) * 13 * r;
    if (i > 0) limb(g, px, py, nx, ny, 4, 4, 'G'); // the ring the embers ride
    if (i < 9) ell(g, nx, ny, 3 + ((i * 5) % 4), 2 + ((i * 5) % 4), i % 2 ? 'G' : '7');
    px = nx;
    py = ny;
  }
  limb(g, cx, cy, cx, cy - 13 * r, 5, 4, 'G'); // and a spoke joining it to the clinker
  // three tongues off the top, one longer than the others
  [0, 1, 2].forEach((i) => {
    const len = 8 + (i === lick ? 7 : 0);
    limb(g, cx - 5 + i * 5, cy - 11, cx - 7 + i * 6, cy - 11 - len, 5, 1, 'G');
  });
  // the clinker: a dark burnt heart, the one thing here that is not on fire
  ell(g, cx, cy, 9, 10, 'B');
  ell(g, cx + 1, cy + 1, 7, 8, '8');
  ell(g, cx + 1, cy + 2, 5, 6, '&');
  // and the embers it stands on
  box(g, cx - 9, cy + 13, cx + 9, cy + 14, '7');
  underbelly(g, '8', '&', 2, 'B');
  underbelly(g, '7', '>', 3); // the whole bottom of the fire falls to its own dark, so it is lit from above like everything else
  const out = rowsOf(g);
  // two vents in the clinker where the fire shows through it
  return stampRows(stampRows(out, cy - 3, cy - 3, [cx - 4, '@@'], [cx + 2, '@@']), cy - 2, cy - 2, [cx - 4, '7.'], [cx + 3, '7']);
}
const EMBER_ANCH = { feet: { x: 19, y: EMB_H - 1 }, hit: { x: 19, y: 26 } };
beastKit('elemental', {
  idle: [emberGrid(), emberGrid({ dy: 1, lick: 1 }), emberGrid({ burst: 0.4, lick: 2, dy: -1 })],
  wind: emberGrid({ burst: -0.4, dx: -4, dy: 1, lick: 0 }),
  strike: emberGrid({ burst: 1, dx: 4, dy: -1, lick: 2 }),
  hurt: emberGrid({ burst: 0.5, dx: -7, dy: -3, lick: 1 }),
  dead: [
    (() => {
      // It goes OUT: the orbit falls into a bed of embers round a cracked
      // clinker — fourteen rows against forty-two.
      const g = grid(EMB_W, EMB_H);
      ell(g, 19, 39, 16, 4, '7');
      ell(g, 17, 36, 8, 5, 'B');
      ell(g, 18, 37, 5, 3, '8');
      box(g, 4, 41, 34, 41, 'G');
      underbelly(g, '8', '&', 2, 'B');
      return stampRows(rowsOf(g), 35, 35, [15, '@'], [20, '@']);
    })(),
    (() => {
      const g = grid(EMB_W, EMB_H);
      ell(g, 19, 41, 15, 2, '7');
      ell(g, 17, 39, 6, 3, '8');
      return rowsOf(g);
    })(),
  ],
  w: EMB_W,
  h: EMB_H,
  anchors: EMBER_ANCH,
});

// --- THUNDER COLOSSUS (elite) — granite bound in brass ---------------------------
// GRANITE FIST and CHAIN BOLT. Fifty-six cells: a granite mass with brass
// bindings round every joint and two CONDUCTOR RODS standing off the shoulders
// with an arc between them, so the widest and brightest part of the silhouette
// is above the shoulder line rather than at it.
const TCL = 18;
const TCW = 2 * TCL + 1;
const colossusTop = bands(TCL, [
  [2, hb(TCL, 14, '5'), '5'], //  0-1  the neck course
  [1, hb(TCL, 1, 'B'), 'B'], //  2    a granite shoulder shelf
  [3, hb(TCL, 0, 'B'), 'B'], //  3-5
  [1, hb(TCL, 2, '8'), '8'], //  6    its underside
  [1, hb(TCL, 3, '&'), '&'], //  7    the deep seam
  [1, hb(TCL, 5, 'M'), 'M'], //  8    a brass binding across the chest
  [3, hbf(TCL, 5, 'B', 'b', [7, 12]), 'B'], //  9-11 the chest block, two courses
  [1, hb(TCL, 5, 'M'), 'M'], // 12   a second binding
  [2, hbf(TCL, 5, 'B', 'b', [8]), 'B'], // 13-14
  [1, hb(TCL, 4, '5'), 'M'], // 15   a brass belt band
  [1, hb(TCL, 4, '}'), '}'], // 16   deep seam
  [8, hbf(TCL, 3, 'B', 'b', [6, 12, 18]), 'B'], // 17-24 the hip block, three courses of it
  [1, hb(TCL, 3, '8'), '8'], // 25   its dark under-band
]);
const colossusRows = [
  ...castPlane(
    [
      ...turn(selfShadow(shoulderDrop(colossusTop, 2, TCL, 'B', 4, 2), '&', 3, [9, 16], [4, TCW - 5]), { top: 2, bottom: 15, ch: 'B', pelvis: [17, 25] }),
      ...legsTurned(TCW + 2, 10, { pad: 8, w: 9, leg: 'b', knee: '8', boot: '&', cuff: '8' }, { pad: 8, w: 10, leg: 'B', knee: 'b', boot: '8', cuff: 'B' }, 6),
    ],
    17,
    30,
    21,
    33,
  ),
];
/** Two conductor rods standing off the shoulders, and the arc between them. */
const colossusBodyRows = stampRows(
  stampRows(stampRows(colossusRows, 0, 1, [2, 'MM'], [33, 'MM']), 2, 5, [2, 'MM'], [33, 'MM']),
  0,
  0,
  [4, '@'],
  [32, '@'],
);
const colossusAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: TCL + 2, y: 2 },
  hand: { x: TCL, y: 5 },
  capePin: { x: TCL - 2, y: 4 },
  feet: { x: TCL, y: colossusRows.length - 1 },
  hit: { x: TCL, y: 15 },
};
bodyKit('colossus', { rows: colossusBodyRows, anchors: colossusAnchors, hemFrom: 17, pivot: 26, lean: 8 });
const colossusHeadRows = [
  sym(HL, hb(HL, 6, 'B'), 'B'), //  0  a granite block of a head, no neck to speak of
  sym(HL, hb(HL, 4, '%'), '%'), //  1  its lit top course
  sym(HL, hb(HL, 3, 'B'), 'B'), //  2
  sym(HL, hb(HL, 3, 'B'), 'B'), //  3
  sym(HL, hb(HL, 3, 'M'), 'M'), //  4  a brass band round the brow
  sym(HL, hb(HL, 3, '5'), '5'), //  5
  sym(HL, hb(HL, 3, '&'), '&'), //  6  the deep undercut
  stamp(sym(HL, hb(HL, 4, 'B'), 'B'), [6, 'GG'], [14, 'GG']), //  7  two arc-lit sockets, wide apart
  stamp(sym(HL, hb(HL, 4, 'B'), 'B'), [6, '#7'], [14, '7#']), //  8
  sym(HL, hb(HL, 4, 'b'), 'b'), //  9
  sym(HL, hb(HL, 3, 'B'), 'B'), // 10
  stamp(sym(HL, hb(HL, 3, 'B'), 'B'), [7, '&&&&&&&&&']), // 11  a cut jaw line
  sym(HL, hb(HL, 3, 'B'), 'B'), // 12
  sym(HL, hb(HL, 4, 'b'), 'b'), // 13
  sym(HL, hb(HL, 5, 'B'), 'B'), // 14
  sym(HL, hb(HL, 7, '8'), '8'), // 15
  sym(HL, hb(HL, 8, '8'), '8'), // 16
  sym(HL, hb(HL, 8, '&'), '&'), // 17
];
headKit('colossus', { rows: colossusHeadRows, down: { crown: 'B', dark: '8', face: 'b', eye: '&', deep: '&' } });
armKit(
  'granite',
  { arm: 'B', armDark: '8', fore: 'b', cuff: 'M', hand: 'B', handDeep: '&', nearArm: 'b' },
  { hand: 'B', notch: 'b', edge: '8', deep: '&', lit: '%', cuff: 'M', wide: true },
  17,
  8,
);
reg('fallen_granite', fallenBody({ g: 'B', dark: '8', deep: '&', boot: 'M', bootDeep: '}' }, FALLEN_SIDE));
/** GRANITE FIST — a boulder maul with brass bands and an arc caged in its head. */
reg(
  'granite_maul',
  part(
    [
      R(15, [3, 'BBBBBBB']),
      R(15, [2, 'B%%%%%%%B']),
      R(15, [1, 'B%bMGMb%%B']),
      R(15, [1, 'B%bG7GMb%B']),
      R(15, [1, 'B%bMGMb%%B']),
      R(15, [1, 'B8bbbbbb8B']),
      R(15, [2, 'B88888888']),
      R(15, [3, '&&&&&&&']),
      R(15, [6, 'MMM']),
      R(15, [6, 'M*M']),
      ...rep(3, R(15, [6, 'B8B'])),
      R(15, [6, 'MMM']),
      ...rep(4, R(15, [6, 'B8B'])),
      R(15, [6, 'M5M']),
      ...rep(3, R(15, [6, 'B8B'])),
      R(15, [5, '8&&&8']),
    ],
    { weaponGrip: { x: 7, y: 17 } },
  ),
);

// --- SPIRE SERAPH (boss) — six wings and a lance --------------------------------
// AEGIS OF LIGHT and TEMPEST CHOIR. Where the Forge Saint is a crucible in a
// soot chasuble and the two DARK kings are armoured, this one is WINGS: three
// pairs standing off the shoulders at three pitches, a brass mask with no eyes
// in it, a storm-indigo robe, and a lance carried across the body. The wings
// are drawn from the shoulder so nothing about them can float.
const SRL = 19;
const SRW = 2 * SRL + 1;
const seraphTop = bands(SRL, [
  [2, hb(SRL, 15, '2'), '2'], //  0-1  the throat
  [1, hb(SRL, 5, 'M'), 'M'], //  2    a brass gorget-yoke
  [2, hb(SRL, 4, 'M'), 'M'], //  3-4
  [1, hb(SRL, 6, '5'), '5'], //  5
  [1, hb(SRL, 7, '}'), '}'], //  6    the deep seam under it
  [1, hb(SRL, 7, '*'), '*'], //  7    the breastplate's lit top edge
  [3, hbf(SRL, 7, 'M', 'm', [9]), 'M'], //  8-10
  [1, hb(SRL, 7, '5'), '5'], // 11   a plate course
  [2, hbf(SRL, 6, 'C', '2', [8]), 'C'], // 12-13 the robe begins
  [1, hb(SRL, 5, 'M'), 'M'], // 14   a brass girdle
  [1, hb(SRL, 5, '}'), '}'], // 15   deep seam
  [7, hbf(SRL, 8, 'C', '2', [10, 14]), 'C'], // 16-22 the robe falls as a column
  [4, hbf(SRL, 8, 'c', '[', [11]), 'c'], // 23-26 into shadow
  [2, hb(SRL, 8, '['), '['], // 27-28 the hem band
]);
const seraphRows = [
  ...turn(selfShadow(shoulderDrop(seraphTop, 2, SRL, 'M', 6, 4), '}', 3, [8, 15], [5, SRW - 6], 8), { top: 2, bottom: 14, ch: 'M', pelvis: [16, 28] }),
  ...hemShift(bands(SRL + 1, [[9, hbf(SRL + 1, 9, 'c', '[', [12]), 'c']]), 0, 'c', 5, 2),
  ...scallopHem(SRW + 2, 'c', '[', [4, 2, 6, 3]).map((r) => stamp(r, [0, '.'.repeat(9)], [SRW - 7, '.'.repeat(9)])),
];
/**
 * Three pairs of wings, drawn FROM the shoulder outward at three pitches, so
 * none of them can bake as its own component. The robe's own rows are PADDED
 * first: a wing that reaches seventeen cells past a thirty-nine-cell body is
 * clipped by the grid otherwise, which is exactly what the first silhouette
 * plate of this boss showed — a plain block where six wings should be.
 */
const SERAPH_PAD = 20;
function seraphWings(rows: readonly string[]): string[] {
  const g = gridOf(rows.map((r) => '.'.repeat(SERAPH_PAD) + r.padEnd(SRW + 2, '.') + '.'.repeat(SERAPH_PAD)));
  const sy = 5;
  const lx = SERAPH_PAD + 8;
  const rx = SERAPH_PAD + SRW - 6;
  const wing2 = (x: number, dy: number, span: number, drop: number, ch: string): void => {
    limb(g, x, sy + dy, x + span, sy + dy - drop, 7, 2, ch);
    for (let i = 1; i <= 3; i++) {
      const t = i / 3;
      limb(g, x, sy + dy, x + span * t, sy + dy - drop * t + 9 * t, 6 - i, 2, ch);
    }
  };
  wing2(lx, 0, -17, 14, 'D');
  wing2(rx, 1, 12, 7, 'D');
  wing2(lx, 8, -11, -4, 'd');
  wing2(rx, 6, 16, 2, 'd');
  wing2(lx, 15, -13, -17, 'D');
  wing2(rx, 13, 9, -11, 'D');
  return rowsOf(g);
}
const seraphBodyRows = seraphWings(seraphRows);
const seraphAnchors: Partial<Record<AnchorName, Point>> = {
  head: { x: SERAPH_PAD + SRL + 2, y: 0 },
  hand: { x: SERAPH_PAD + SRL, y: 4 },
  capePin: { x: SERAPH_PAD + SRL - 3, y: 3 },
  feet: { x: SERAPH_PAD + SRL, y: seraphRows.length - 1 },
  hit: { x: SERAPH_PAD + SRL, y: 18 },
};
reg('seraph_body', part(seraphBodyRows, seraphAnchors));
reg('seraph_body_sway', part(shiftRows(seraphBodyRows, 1, 24, seraphBodyRows.length - 2), seraphAnchors));
reg('seraph_body_hurt', bodyRecoil(seraphBodyRows, seraphAnchors, 33, 11));
const SRHL = 14;
const seraphHeadRows = bands(SRHL, [
  [1, hb(SRHL, 8, '*'), '*'], //  0  a brass mask, lit right across its crown
  [2, hb(SRHL, 6, '*'), '*'], //  1-2
  [2, hb(SRHL, 4, '*'), '*'], //  3-4
  [1, hb(SRHL, 3, 'M'), 'M'], //  5
  [2, hb(SRHL, 3, 'M'), 'M'], //  6-7
  [1, hb(SRHL, 3, '5'), '5'], //  8  the mask's brow ridge
  [1, hb(SRHL, 3, '}'), '}'], //  9
  [3, hb(SRHL, 3, 'M'), 'M'], // 10-12 and NO eyes in it at all
  [1, hb(SRHL, 4, 'm'), 'm'], // 13
  [2, hb(SRHL, 4, 'M'), 'M'], // 14-15
  [1, hb(SRHL, 6, 'm'), 'm'], // 16
  [1, hb(SRHL, 7, 'M'), 'M'], // 17
  [1, hb(SRHL, 9, '5'), '5'], // 18
  [2, hb(SRHL, 10, '2'), '2'], // 19-20 the neck
  [1, hb(SRHL, 10, '['), '['], // 21
]);
/** One vertical seam down the mask, and a lit lip under the brow — the only features it has. */
const seraphHeadFinal = stampRows(stampRows(seraphHeadRows, 10, 12, [SRHL, '5']), 10, 10, [4, '*'], [SRHL + 4, '*']);
headKit('seraph', { rows: seraphHeadFinal, cx: SRHL, down: { crown: 'M', dark: '5', face: 'm', eye: '}', deep: '}' }, lift: 2 });
reg('fallen_seraph', fallenBody({ g: 'C', dark: '2', deep: '[', boot: 'M', bootDeep: '}' }, FALLEN_PITCH, true, 1.5));
armKit(
  'seraph',
  { arm: 'C', armDark: '2', fore: 'M', cuff: '5', hand: 'M', handDeep: '}', nearArm: 'c' },
  { hand: 'M', notch: 'm', edge: '5', deep: '}', lit: '*', cuff: '5' },
  17,
  6,
);
/** A halo BROKEN by the lance: a thin brass ring standing behind the mask, open at its lower right. */
reg(
  'halo_ring',
  part([
    R(30, [10, 'MMMMMMMMM']),
    R(30, [7, 'MM*'], [20, '*MM']),
    R(30, [5, 'M*'], [23, '*M']),
    R(30, [4, 'M*'], [24, '*M']),
    R(30, [4, 'M5'], [24, '5M']),
    R(30, [4, 'M5'], [24, '5M']),
    R(30, [5, 'M5'], [23, '5M']),
    R(30, [6, 'M5'], [22, '5M']),
    R(30, [7, 'M5'], [21, '5M']),
    R(30, [9, 'M5'], [19, '5M']),
    R(30, [11, 'M5'], [17, '5M']),
    R(30, [13, 'M5M']),
  ]),
);
/** RADIANT LANCE — a long brass lance with a lit vane; too tall to swing, so it thrusts. */
reg(
  'radiant_lance',
  part(
    [
      R(11, [5, 'M']),
      R(11, [4, 'M*M']),
      R(11, [4, 'M*M']),
      R(11, [3, 'M*G*M']),
      R(11, [3, 'M*G*M']),
      R(11, [3, 'M*7*M']),
      R(11, [3, 'M5G5M']),
      R(11, [4, 'M5M']),
      R(11, [4, '}}}']),
      R(11, [4, 'MMM']),
      ...rep(7, R(11, [4, 'M*M'])),
      ...rep(3, R(11, [4, 'CcC'])),
      ...rep(11, R(11, [4, 'M5M'])),
      R(11, [3, 'M555M']),
      R(11, [3, 'M5}5M']),
      R(11, [4, 'MMM']),
      R(11, [4, '}}}']),
    ],
    { weaponGrip: { x: 5, y: 27 } },
  ),
);
