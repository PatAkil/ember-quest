// Ember Quest v3 — game/art/parts.ts
//
// The shared ASCII part library for the layered-actor pipeline (DESIGN.md →
// Presentation → Layered actors). Pure data: no engine import, no DOM. A part
// is a small ASCII-art drawing (rows of characters) plus a map from character
// to a ROLE key — never a literal colour, so one part can be baked for any
// element (`actors.ts` owns the role → colour table and does the baking).
//
// Anchors are named cell points authored in the part's OWN local grid (row 0,
// col 0 = its top-left). `actors.ts` composes a recipe by placing one part's
// named anchor exactly on another already-placed part's same-named anchor
// (e.g. a weapon's `weaponGrip` lands on the arm's `weaponGrip`), which is
// what keeps a weapon glued to a hand across every pose keyframe. Not every
// part defines every anchor — only the ones relevant to how it is used.
//
// Rows may be ragged (a short row is padded transparent on the right by
// engine's `makeSprite`); they are kept close to rectangular here for
// readability while authoring, not because the pipeline requires it.
//
// Style: one light direction (top-left, rim light is added at BAKE time in
// actors.ts, not here), thick 2-3 cell-wide strokes, a 1-cell dark keyline
// baked directly into the rows (never `makeSprite`'s automatic `outline`
// option — that grows the sprite by a cell per side and would shift every
// anchor authored below), and a 3-4 tone ramp per material via the role set.
//
// SIZE (art-quality pass, v3.1): art is authored so a hero fills ~56-58 of
// the 64-cell ACTOR_PART canvas and a boss ~85 of BOSS_PART's 96 (DESIGN.md's
// "roughly 56-64" / "84-96" cells) — roughly double the linear size of the
// v3.0 pass. Every humanoid body is still hand-placed ASCII, built through
// three tiny authoring-time helpers (below) that remove the bookkeeping
// error a hand-mirrored 25-45-row grid invites, not the authorship itself:
//   - `sym(left, centre)` mirrors a LEFT HALF into a full symmetric row —
//     used for the front-facing bodies, which are naturally left/right
//     symmetric (a torso, a helm, a hovering shroud). The centreline column
//     of every row a part uses `sym` on is always `left.length`, so anchors
//     placed at that column stay correct regardless of how a given row's
//     silhouette tapers.
//   - `solid(pad, lh, ch)` / `limb(pad, w, lh, ch)` build one LEFT HALF: `lh`
//     (the half-width) is fixed for every row of a part, and only `pad`
//     (blank cells from the outer edge in) varies — so a shoulder-to-waist
//     taper is just a smaller `pad` per row, and every row still mirrors
//     around the SAME centreline (get this from a per-row `lh` instead and
//     the centreline drifts row to row — the classic bug this avoids).
//     `limb` leaves a gap before the centre (a `#`-bordered column stopping
//     short of `lh`) so mirroring produces two separate legs, not one solid
//     silhouette.
//   - `shiftX(row, dx)` translates one already-built row sideways (clipped
//     to its own width) — used once, for GALE's forward lean, to nudge the
//     shoulders/head rows off the hips' centreline without hand-redrawing
//     an asymmetric torso.
// Every silhouette below is still individually composed and tuned by eye
// (the spikes, horns, jaws, tails, hoods and weapon heads are one-off rows);
// the helpers only remove the arithmetic of keeping a mirrored or tapered
// shape's centreline and width consistent across dozens of rows by hand.

// --- Roles --------------------------------------------------------------------

/**
 * A material role, never a literal colour. `accent` and `glow` are the two
 * roles an element re-tints (actors.ts's ELEMENT_PALETTE); `skin`, `cloth`,
 * `metal`, `dark` and `light` stay neutral on every actor. `dark` is the
 * authored keyline; `light` is reserved for a hand-placed glint (eyes, a
 * blade's edge) — the silhouette-wide rim light is a bake-time pass over the
 * composed actor, not something painted into a part.
 */
export type RoleKey = 'skin' | 'cloth' | 'metal' | 'accent' | 'glow' | 'dark' | 'light';

/** ASCII character → role. '.', ' ' and any character missing from `map` are transparent (engine's `makeSprite` convention). */
export type RoleMap = Readonly<Record<string, RoleKey>>;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The six named connection points a part may define, in ITS OWN local grid.
 * `feet` / `hit` mark the whole-recipe ground contact and hurtbox centre
 * (authored on body/body-like parts); `head` marks where a head sits on a
 * torso, and — on a head part — the neck point that lands there; `hand`
 * marks where arms sit on a torso, and — on an arms part — the shoulder
 * point that lands there; `weaponGrip` marks the fist on an arms part and
 * the handle on a weapon part; `capePin` marks the back-shoulder point on a
 * torso and the collar point on a cloak.
 */
export type AnchorName = 'hand' | 'head' | 'weaponGrip' | 'capePin' | 'feet' | 'hit';

export interface PartDef {
  /** ASCII rows, top to bottom. */
  readonly rows: readonly string[];
  readonly map: RoleMap;
  readonly anchors: Partial<Readonly<Record<AnchorName, Point>>>;
}

function part(rows: readonly string[], map: RoleMap, anchors: Partial<Record<AnchorName, Point>>): PartDef {
  return { rows, map, anchors };
}

// --- Authoring-time helpers (module load only — see the size note above) ------

/** Mirrors a left half (+ an optional centre column) into a full symmetric row. The centreline is always at column `left.length`. */
function sym(left: string, centre = ''): string {
  return left + centre + [...left].reverse().join('');
}
/** One LEFT HALF, `lh` cells wide: `pad` blank cells from the outer edge, then a `#` border, then `ch` filling the rest up to the centreline. Smaller `pad` = wider at that row. `pad` is clamped to `lh - 1` so the result is ALWAYS exactly `lh` chars — a caller passing a too-large pad (asking for a row narrower than a single centre cell) would otherwise silently grow past `lh` and desync that row's mirrored centreline from the rest of the part. */
function solid(pad: number, lh: number, ch: string): string {
  const p = Math.max(0, Math.min(pad, lh - 1));
  return '.'.repeat(p) + '#' + ch.repeat(lh - p - 1);
}
/** One LEFT HALF for a limb: `pad` blank cells, a `#`-bordered `w`-wide fill, then blank cells out to `lh` — mirrors into two separate limbs with a centre gap. */
function limb(pad: number, w: number, lh: number, ch: string): string {
  const left = '.'.repeat(pad) + '#' + ch.repeat(w) + '#';
  return left.length >= lh ? left.slice(0, lh) : left + '.'.repeat(lh - left.length);
}
/** `n` copies of `row` (a same-height band). */
function rep(n: number, row: string): string[] {
  return new Array(n).fill(row);
}
/**
 * A [leftHalf, centreColumn] pair — pairing the centre with its row at the
 * point of authorship (rather than inferring it afterward from a row index)
 * is what keeps a `limb()` row's centre gap from accidentally being filled
 * in by a neighbouring solid band's centre colour.
 */
type Row = readonly [left: string, centre: string];
function rowsOf(pairs: readonly Row[]): string[] {
  return pairs.map(([l, c]) => sym(l, c));
}
function repRow(n: number, r: Row): Row[] {
  return new Array(n).fill(r);
}
/** Translate one row sideways by `dx` cells, clipped back to its own width (blank-filled) — used for GALE's forward-leaning torso. */
function shiftX(row: string, dx: number): string {
  const w = row.length;
  if (dx > 0) return ('.'.repeat(dx) + row).slice(0, w);
  if (dx < 0) return row.slice(-dx) + '.'.repeat(-dx);
  return row;
}
/** A `width`-cell row with `mid` placed `lead` cells in, blank elsewhere — for a one-off asymmetric appendage (a tail, a jaw) authored by explicit count instead of hand-typed dot runs. */
function padRow(width: number, lead: number, mid: string): string {
  return '.'.repeat(lead) + mid + '.'.repeat(Math.max(0, width - lead - mid.length));
}
/** One LEFT HALF holding TWO separate `#`-bordered blocks (each `wA`/`wB` cells of `ch`, starting at absolute column `padA`/`padB`) — a quadruped's near+far leg within one mirrored half, since `limb` only places one block. */
function limb2(padA: number, wA: number, padB: number, wB: number, lh: number, ch: string): string {
  const cells = new Array(lh).fill('.');
  const put = (pad: number, w: number) => {
    if (pad >= 0 && pad < lh) cells[pad] = '#';
    for (let i = 0; i < w; i++) if (pad + 1 + i < lh) cells[pad + 1 + i] = ch;
    if (pad + w + 1 < lh) cells[pad + w + 1] = '#';
  };
  put(padA, wA);
  put(padB, wB);
  return cells.join('');
}

// --- Humanoid bodies ------------------------------------------------------
// Legs are baked into the torso (no separate leg layer) — at 64px and
// POSE_FPS 12 a separate leg swing bought little and every anchor stays
// simpler with one fewer layer to place.
//
// Accent (the element tint) is the DOMINANT fill here, not a trim line — at
// the size this composites and draws to, a 1-cell stripe reads as grey from
// across the stage. Cloth/metal are kept as a collar/belt/boot/trim accent
// so the garment still looks like cloth or plate over a body, not a solid
// colour block.

// TORSO_SLIM — EMBER, SABLE, LUMEN. LH = 12 (width 25), 42 rows.
const SLIM_LH = 12;
const torsoSlimPairs: Row[] = [
  ...repRow(2, [solid(9, SLIM_LH, 'S'), 'S']), // neck
  [solid(3, SLIM_LH, 'C'), 'C'], // collar trim
  ...repRow(4, [solid(3, SLIM_LH, 'O'), 'O']), // shoulders
  ...repRow(13, [solid(1, SLIM_LH, 'O'), 'O']), // chest/belly
  [solid(1, SLIM_LH, 'C'), 'C'], // belt
  ...repRow(3, [solid(2, SLIM_LH, 'O'), 'O']), // hip taper
  ...repRow(12, [limb(3, 6, SLIM_LH, 'O'), '.']), // legs
  ...repRow(3, [limb(3, 6, SLIM_LH, 'C'), '.']), // boot cuffs
  ...repRow(3, [limb(2, 8, SLIM_LH, '#'), '.']), // boot soles
];
const TORSO_SLIM = part(
  rowsOf(torsoSlimPairs),
  { '#': 'dark', S: 'skin', C: 'cloth', O: 'accent' },
  { head: { x: SLIM_LH, y: 0 }, hand: { x: 21, y: 5 }, capePin: { x: SLIM_LH, y: 3 }, feet: { x: SLIM_LH, y: 41 }, hit: { x: SLIM_LH, y: 20 } },
);

// TORSO_LEAN — GALE. Same footprint as TORSO_SLIM, but the shoulders/head
// mount are translated forward (see `shiftX` above) so the whole upper body
// reads as leaning into a run without hand-drawing an asymmetric torso.
const LEAN_SHIFT = 3;
const torsoLeanRows = rowsOf(torsoSlimPairs);
// Shift head-through-chest (everything above the belt at row 20) forward,
// so the lean bends at the waist — a natural seam — rather than snapping
// back mid-chest.
for (let i = 0; i < 20; i++) torsoLeanRows[i] = shiftX(torsoLeanRows[i], LEAN_SHIFT);
const TORSO_LEAN = part(
  torsoLeanRows,
  { '#': 'dark', S: 'skin', C: 'cloth', O: 'accent' },
  {
    head: { x: SLIM_LH + LEAN_SHIFT, y: 0 },
    hand: { x: 21 + LEAN_SHIFT, y: 5 },
    capePin: { x: SLIM_LH, y: 3 },
    feet: { x: SLIM_LH, y: 41 },
    hit: { x: SLIM_LH, y: 20 },
  },
);

// TORSO_HEAVY — BASALT, CRYPT_WARDEN, PYRE_KNIGHT, DROWNED_KNIGHT. LH = 16
// (width 33), 44 rows — broad pauldrons, plated all the way down.
const HEAVY_LH = 16;
const torsoHeavyPairs: Row[] = [
  ...repRow(2, [solid(13, HEAVY_LH, 'S'), 'S']), // neck
  ...repRow(6, [solid(2, HEAVY_LH, 'M'), 'M']), // pauldrons
  ...repRow(2, [solid(2, HEAVY_LH, 'O'), 'O']), // chest trim band
  ...repRow(16, [solid(3, HEAVY_LH, 'M'), 'M']), // chest plate
  [solid(3, HEAVY_LH, 'O'), 'O'], // belt
  ...repRow(3, [solid(4, HEAVY_LH, 'M'), 'M']), // hip taper
  ...repRow(9, [limb(6, 8, HEAVY_LH, 'M'), '.']), // legs
  ...repRow(3, [limb(6, 8, HEAVY_LH, 'C'), '.']), // boot cuffs
  ...repRow(2, [limb(5, 10, HEAVY_LH, '#'), '.']), // boot soles
];
const TORSO_HEAVY = part(
  rowsOf(torsoHeavyPairs),
  { '#': 'dark', S: 'skin', M: 'metal', O: 'accent', C: 'cloth' },
  { head: { x: HEAVY_LH, y: 0 }, hand: { x: 30, y: 6 }, capePin: { x: HEAVY_LH, y: 3 }, feet: { x: HEAVY_LH, y: 43 }, hit: { x: HEAVY_LH, y: 18 } },
);

// TORSO_ROBE — TIDE, MARSH_HAG. LH = 18 (width 37), 44 rows, robe to the
// ground (no leg gap — the hem covers the legs entirely; a hint of boot
// tips peeks out at the very bottom).
const ROBE_LH = 18;
const torsoRobePairs: Row[] = [
  ...repRow(2, [solid(15, ROBE_LH, 'S'), 'S']), // neck
  ...repRow(3, [solid(8, ROBE_LH, 'C'), 'C']), // collar
  ...repRow(5, [solid(6, ROBE_LH, 'O'), 'O']), // upper chest
  ...repRow(3, [solid(5, ROBE_LH, 'O'), 'O']),
  ...repRow(3, [solid(4, ROBE_LH, 'O'), 'O']),
  ...repRow(3, [solid(3, ROBE_LH, 'O'), 'O']),
  ...repRow(3, [solid(2, ROBE_LH, 'O'), 'O']),
  ...repRow(3, [solid(1, ROBE_LH, 'O'), 'O']), // hem starts flaring
  [solid(1, ROBE_LH, 'C'), 'C'], // trim
  ...repRow(14, [solid(0, ROBE_LH, 'O'), 'O']), // full-width hem
  ...repRow(2, [solid(0, ROBE_LH, 'C'), 'C']), // hem edge
  ...repRow(2, [limb(8, 2, ROBE_LH, '#'), '.']), // boot tips peeking out
];
const TORSO_ROBE = part(
  rowsOf(torsoRobePairs),
  { '#': 'dark', S: 'skin', C: 'cloth', O: 'accent' },
  { head: { x: ROBE_LH, y: 0 }, hand: { x: 30, y: 4 }, capePin: { x: ROBE_LH, y: 2 }, feet: { x: ROBE_LH, y: 43 }, hit: { x: ROBE_LH, y: 20 } },
);

// --- Heads ------------------------------------------------------------------
// Every head below is 16 rows (overlap 2 into its torso — see the neck
// anchor on each) so it pairs with a torso authored to land the whole
// figure at ~56-58 of the 64-cell canvas; the SHAPE — not the tint — is
// what tells the six heroes apart at a glance (DESIGN.md's silhouette rule).

// HEAD_SPIKY — EMBER: upswept spiked hair over a bare skull.
const SPIKY_LH = 7;
const headSpikyPairs: Row[] = [
  ...[5, 4, 3, 2, 1, 0].map((pad): Row => [solid(pad, SPIKY_LH, 'O'), 'O']), // spike mass, narrow to wide
  ...repRow(3, [solid(0, SPIKY_LH, 'S'), 'S']),
  ['#SSLSSS', 'S'], // eye glint
  ...repRow(3, [solid(0, SPIKY_LH, 'S'), 'S']),
  ...repRow(2, [solid(1, SPIKY_LH, 'S'), 'S']),
  [solid(2, SPIKY_LH, 'S'), 'S'], // chin
];
const HEAD_SPIKY = part(rowsOf(headSpikyPairs), { '#': 'dark', O: 'accent', S: 'skin', L: 'light' }, { head: { x: SPIKY_LH, y: 13 } });

// HEAD_WINDSWEPT — GALE: short hair blown back off a round skull, wider at
// the crown-base and thinning into wisps that trail away from the lean.
const WIND_LH = 9;
const windHairBase = [solid(6, WIND_LH, 'O'), solid(5, WIND_LH, 'O'), solid(4, WIND_LH, 'O'), solid(3, WIND_LH, 'O'), solid(2, WIND_LH, 'O'), solid(1, WIND_LH, 'O')];
const headWindsweptHair: string[] = windHairBase.map((left, i) => shiftX(sym(left, 'O'), -(5 - i)));
const headWindsweptRest: Row[] = [
  ...repRow(2, [solid(0, WIND_LH, 'S'), 'S']),
  ['#SSLSSSSS', 'S'], // eye glint
  ...repRow(4, [solid(0, WIND_LH, 'S'), 'S']),
  ...repRow(2, [solid(1, WIND_LH, 'S'), 'S']),
  [solid(2, WIND_LH, 'S'), 'S'], // chin
];
const HEAD_WINDSWEPT = part(
  [...headWindsweptHair, ...rowsOf(headWindsweptRest)],
  { '#': 'dark', O: 'accent', S: 'skin', L: 'light' },
  { head: { x: WIND_LH, y: 13 } },
);

// HEAD_HOOD_DEEP — TIDE: a big rounded, calm hood overhang; only a small
// shadowed patch of face shows at the bottom, no visible eyes.
const HOODD_LH = 8;
const headHoodDeepPairs: Row[] = [
  ...[5, 3, 1].map((pad): Row => [solid(pad, HOODD_LH, 'C'), 'C']), // crown
  ...repRow(5, [solid(0, HOODD_LH, 'C'), 'C']), // widest
  ...repRow(2, [solid(2, HOODD_LH, 'C'), 'C']), // draw back in
  ['..#CCCSS', 'S'], // small face peek
  ...[1, 2, 3, 4, 5].map((pad): Row => [solid(pad, HOODD_LH, 'C'), 'C']), // hood closes under the chin
];
const HEAD_HOOD_DEEP = part(rowsOf(headHoodDeepPairs), { '#': 'dark', C: 'cloth', S: 'skin' }, { head: { x: HOODD_LH, y: 13 } });

// HEAD_HOOD_SHADOW — SABLE: an angular, pointed hood; the face is pure
// shadow but for two glowing eyes (glow → DARK's tint, an eerie pink-red).
const HOODS_LH = 7;
const headHoodShadowPairs: Row[] = [
  ...[5, 4, 3, 2].map((pad): Row => [solid(pad, HOODS_LH, 'C'), 'C']), // pointed tip
  ...repRow(6, [solid(0, HOODS_LH, 'C'), 'C']), // hood body
  ['#CC###G', '#'], // lit eyes in shadow
  ...[1, 2, 3, 4, 5].map((pad): Row => [solid(pad, HOODS_LH, 'C'), 'C']), // closes under the chin
];
const HEAD_HOOD_SHADOW = part(rowsOf(headHoodShadowPairs), { '#': 'dark', C: 'cloth', G: 'glow' }, { head: { x: HOODS_LH, y: 13 } });

// HEAD_HELM — BASALT, CRYPT_WARDEN, PYRE_KNIGHT, DROWNED_KNIGHT: a full
// helm with a dark horizontal slit visor and one centred glint.
const HELM_LH = 9;
const headHelmPairs: Row[] = [
  ...[4, 2, 0].map((pad): Row => [solid(pad, HELM_LH, 'M'), 'M']), // crown
  ...repRow(7, [solid(0, HELM_LH, 'M'), 'M']), // helm body
  ['#MMMMMM##', 'L'], // visor slit + glint
  ...[1, 2, 3, 4, 5].map((pad): Row => [solid(pad, HELM_LH, 'M'), 'M']), // chin guard
];
const HEAD_HELM = part(rowsOf(headHelmPairs), { '#': 'dark', M: 'metal', L: 'light' }, { head: { x: HELM_LH, y: 13 } });

// HEAD_LONGHAIR — LUMEN: a round head with long hair draping past the
// shoulders (the extra rows below the neck overlap simply paint over the
// torso's shoulder line, since the head layer is always on top).
const HAIR_LH = 7;
const headLonghairPairs: Row[] = [
  ...[4, 2, 0, 0, 0, 0].map((pad): Row => [solid(pad, HAIR_LH, 'S'), 'S']), // rounded skull
  ['#SSLSSS', 'S'], // eye glint
  ...repRow(2, [solid(1, HAIR_LH, 'S'), 'S']), // chin
  ...repRow(7, [solid(0, HAIR_LH, 'O'), 'O']), // hair draping past the shoulders
];
const HEAD_LONGHAIR = part(rowsOf(headLonghairPairs), { '#': 'dark', S: 'skin', O: 'accent', L: 'light' }, { head: { x: HAIR_LH, y: 13 } });

// HEAD_HAG — MARSH_HAG: a crooked, lopsided hood (shiftX on the crown) over
// a jutting chin — reads as an old, hunched witch even at a glance.
const HAG_LH = 8;
const headHagCrown = [5, 4, 3, 2, 1].map((pad) => shiftX(sym(solid(pad, HAG_LH, 'C'), 'C'), -2));
const headHagRest: Row[] = [
  ...repRow(5, [solid(0, HAG_LH, 'C'), 'C']), // hood body
  ['..#CCCSS', 'S'], // jutting chin peek
  ...[1, 2, 3, 4, 5].map((pad): Row => [solid(pad, HAG_LH, 'C'), 'C']), // closes under the chin
];
const HEAD_HAG = part([...headHagCrown, ...rowsOf(headHagRest)], { '#': 'dark', C: 'cloth', S: 'skin' }, { head: { x: HAG_LH, y: 13 } });

// --- Arms ---------------------------------------------------------------------
// An arm is a small ASYMMETRIC shape (shoulder to a fist reaching out to
// one side), so these are the one place `sym` doesn't apply — built instead
// with `diagonalArm`, a tiny generator for "a sleeve block sliding sideways
// from the shoulder row to the fist rows", which keeps the many rows in
// alignment without hand-typing each one's leading padding.

/** `rows` total: a `blockW`-wide sleeve block whose offset from the outer edge slides from `startOff` to `endOff` over the non-fist rows, then `fistRows` of a small fist block at `endOff + 1`. */
function diagonalArm(rows: number, w: number, blockW: number, fillCh: string, fistCh: string, startOff: number, endOff: number, fistRows: number): string[] {
  const out: string[] = [];
  const sleeveRows = rows - fistRows;
  for (let i = 0; i < sleeveRows; i++) {
    const off = Math.round(startOff + (i * (endOff - startOff)) / Math.max(1, sleeveRows - 1));
    const block = '#' + fillCh.repeat(Math.max(0, blockW - 2)) + '#';
    out.push(('.'.repeat(off) + block).padEnd(w, '.').slice(0, w));
  }
  const fistBlock = '#' + fistCh.repeat(2) + '#';
  for (let i = 0; i < fistRows; i++) {
    out.push(('.'.repeat(endOff + 1) + fistBlock).padEnd(w, '.').slice(0, w));
  }
  return out;
}

// ARMS_SLEEVE — GALE, SABLE, MARSH_HAG: a cloth-sleeved arm reaching down
// and out to a fist.
const ARMS_SLEEVE = part(
  diagonalArm(22, 16, 8, 'C', 'S', 0, 7, 6),
  { '#': 'dark', C: 'cloth', S: 'skin' },
  { hand: { x: 4, y: 0 }, weaponGrip: { x: 10, y: 21 } },
);

// ARMS_BARE — EMBER: a bare, skin-toned arm (no sleeve) — the brief's "bare
// arms" as a silhouette/material read, not just a colour.
const ARMS_BARE = part(
  diagonalArm(22, 14, 6, 'S', 'S', 0, 6, 6),
  { '#': 'dark', S: 'skin' },
  { hand: { x: 3, y: 0 }, weaponGrip: { x: 9, y: 21 } },
);

// ARMS_GUARD — BASALT: a shorter, raised gauntlet-guard pose (a mace held
// close, not hanging at full reach).
const ARMS_GUARD = part(
  diagonalArm(18, 17, 8, 'M', 'S', 0, 6, 6),
  { '#': 'dark', M: 'metal', S: 'skin' },
  { hand: { x: 4, y: 0 }, weaponGrip: { x: 9, y: 17 } },
);

// ARMS_BOTH — TIDE: both sleeves converge from the shoulders to a single
// centred grip in front of the belly (cradling the orb in both hands) — one
// symmetric part rather than a second anchor name.
const BOTH_LH = 15;
const bothSleevePairs: Row[] = [];
for (let i = 0; i < 12; i++) {
  const pad = 1 + Math.round((i * 8) / 11);
  bothSleevePairs.push([limb(pad, 4, BOTH_LH, 'C'), '.']);
}
const bothGripPairs: Row[] = repRow(6, [solid(7, BOTH_LH, 'C'), 'C']);
const ARMS_BOTH = part(
  rowsOf([...bothSleevePairs, ...bothGripPairs]),
  { '#': 'dark', C: 'cloth' },
  { hand: { x: 28, y: 0 }, weaponGrip: { x: BOTH_LH, y: 17 } },
);

// --- Weapons: sword, daggers, staff, bow, orb, mace, lantern, cane, claw,
// shields --------------------------------------------------------------------
// Every weapon rests vertically (grip in the upper-middle, most of the
// weapon hanging above it as if held at guard, a small pommel/base below)
// so the idle pose reads as "held ready"; the attack rig rotates it in
// 90-degree steps about `weaponGrip`.

// SWORD — PYRE_KNIGHT, DROWNED_KNIGHT. LH = 3 (width 7), 32 rows.
const SWORD_LH = 3;
const swordPairs: Row[] = [
  ...repRow(2, [solid(1, SWORD_LH, 'L'), 'L']), // bright tip
  ...repRow(22, [solid(1, SWORD_LH, 'M'), 'M']), // blade
  [solid(0, SWORD_LH, 'M'), 'M'], // crossguard (full width)
  ...repRow(3, [solid(1, SWORD_LH, 'C'), 'C']), // grip wrap
  ...repRow(4, [solid(1, SWORD_LH, 'M'), 'M']), // pommel
];
const SWORD = part(rowsOf(swordPairs), { '#': 'dark', M: 'metal', C: 'cloth', L: 'light' }, { weaponGrip: { x: SWORD_LH, y: 26 } });

// DAGGER — GALE's main hand. LH = 3 (width 7), 18 rows.
const daggerPairs: Row[] = [
  ...repRow(2, [solid(1, SWORD_LH, 'L'), 'L']),
  ...repRow(8, [solid(1, SWORD_LH, 'M'), 'M']),
  [solid(0, SWORD_LH, 'M'), 'M'],
  ...repRow(3, [solid(1, SWORD_LH, 'C'), 'C']),
  ...repRow(4, [solid(1, SWORD_LH, 'M'), 'M']),
];
const DAGGER = part(rowsOf(daggerPairs), { '#': 'dark', M: 'metal', C: 'cloth', L: 'light' }, { weaponGrip: { x: SWORD_LH, y: 12 } });

// DAGGER_SMALL — GALE's sheathed off-hand blade, a small literal accent at
// the hip (no weaponGrip: it doesn't anchor to a hand, it just rides along
// with the torso) that reads as "twin daggers" without a second arm rig.
const dsLH = 2;
const daggerSmallPairs: Row[] = [
  [solid(1, dsLH, 'M'), 'M'],
  [solid(0, dsLH, 'M'), 'M'],
  ...repRow(5, [solid(0, dsLH, 'M'), 'M']),
  [solid(1, dsLH, '#'), '#'],
];
const DAGGER_SMALL = part(rowsOf(daggerSmallPairs), { '#': 'dark', M: 'metal' }, {});

// DAGGER_CURVED — SABLE: grip near the TOP (cap above it, blade hanging
// mostly below) and the blade itself sweeps to one side as it extends —
// "held low", trailing behind the hip.
const dcLH = 4;
const daggerCurvedTop: Row[] = [...repRow(3, [solid(3, dcLH, 'M'), 'M']), ...repRow(3, [solid(2, dcLH, 'C'), 'C'])];
const daggerCurvedBlade: string[] = [
  '..#MM....',
  '..#MM....',
  '..#MM....',
  '...#MM...',
  '...#MM...',
  '...#MM...',
  '....#MM..',
  '....#MM..',
  '....#MM..',
  '.....#MM.',
  '.....#MM.',
  '.....#ML.',
  '......#L.',
  '......##.',
];
const DAGGER_CURVED = part([...rowsOf(daggerCurvedTop), ...daggerCurvedBlade], { '#': 'dark', M: 'metal', C: 'cloth', L: 'light' }, { weaponGrip: { x: dcLH, y: 4 } });

// STAFF — EMBER: a flame-headed staff (glow = FIRE's tint) held high, and
// CRYPT_WARDEN's cudgel (same part, its dominant FIRE glow reading as embers
// rather than a spellcaster's flame in context).
const STAFF_LH = 5;
const staffFlamePads = [3, 4, 2, 3, 1, 2, 0, 1]; // flicker
const staffPairs: Row[] = [
  ...staffFlamePads.map((pad): Row => [solid(pad, STAFF_LH, 'G'), 'G']),
  ...repRow(2, [solid(3, STAFF_LH, 'O'), 'O']),
  ...repRow(24, [solid(4, STAFF_LH, 'O'), 'O']), // shaft
  ...repRow(3, [solid(4, STAFF_LH, 'C'), 'C']), // grip wrap
  ...repRow(2, [solid(4, STAFF_LH, 'O'), 'O']),
  ...repRow(3, [solid(3, STAFF_LH, 'O'), 'O']),
  ...repRow(2, [solid(2, STAFF_LH, '#'), '#']), // base cap
];
const STAFF = part(rowsOf(staffPairs), { '#': 'dark', O: 'accent', G: 'glow', C: 'cloth' }, { weaponGrip: { x: STAFF_LH, y: 35 } });

// CANE — MARSH_HAG: a crooked hook top (asymmetric) over an otherwise plain
// shaft, distinct from EMBER's straight flame staff.
const CANE_LH = 3;
const caneHook: string[] = ['....##.', '...###.', sym(solid(0, CANE_LH, 'M'), 'M')];
const canePairs: Row[] = [
  ...repRow(23, [solid(1, CANE_LH, 'M'), 'M']),
  ...repRow(2, [solid(1, CANE_LH, 'C'), 'C']),
  ...repRow(2, [solid(1, CANE_LH, 'M'), 'M']),
];
const CANE = part([...caneHook, ...rowsOf(canePairs)], { '#': 'dark', M: 'metal', C: 'cloth' }, { weaponGrip: { x: CANE_LH, y: 26 } });

// BOW_TALL — LUMEN: a tall arc bulging away from a taut string, gripped at
// the centre — built with a small generator since the curve is smooth
// rather than banded.
const BOW_W = 15;
function bowArcRow(i: number, n: number): string {
  const off = 2 + Math.round(8 * Math.sin((Math.PI * i) / (n - 1)));
  const chars = new Array(BOW_W).fill('.');
  chars[1] = '#'; // taut string
  chars[off] = '#';
  chars[off + 1] = 'O';
  chars[off + 2] = '#';
  return chars.join('');
}
const bowArcTop = Array.from({ length: 18 }, (_, i) => bowArcRow(i, 18));
const bowGripRow = (() => {
  const c = new Array(BOW_W).fill('.');
  c[0] = '#';
  c[1] = 'C';
  c[2] = 'C';
  c[3] = 'C';
  c[4] = '#';
  return c.join('');
})();
const BOW_TALL = part([...bowArcTop, ...rep(4, bowGripRow), ...bowArcTop.slice().reverse()], { '#': 'dark', O: 'accent', C: 'cloth' }, { weaponGrip: { x: 2, y: 20 } });

// ORB — TIDE, PALE_SAINT: a round glowing orb. LH = 7 (width 15), 15 rows.
const ORB_LH = 7;
const orbPads = [6, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 6];
const orbPairs: Row[] = orbPads.map((pad, i): Row => {
  const glow = i >= 5 && i <= 9;
  return [solid(pad, ORB_LH, glow ? 'G' : 'O'), glow ? 'G' : 'O'];
});
const ORB = part(rowsOf(orbPairs), { '#': 'dark', O: 'accent', G: 'glow' }, { weaponGrip: { x: ORB_LH, y: 14 } });

// MACE — BASALT. LH = 5 (width 11), 26 rows.
const MACE_LH = 5;
const macePairs: Row[] = [
  ...repRow(2, [solid(4, MACE_LH, 'M'), 'M']),
  [solid(0, MACE_LH, 'O'), 'O'], // accent ring
  ...repRow(6, [solid(0, MACE_LH, 'M'), 'M']), // heavy head
  ...repRow(2, [solid(2, MACE_LH, 'M'), 'M']), // neck
  ...repRow(11, [solid(3, MACE_LH, 'M'), 'M']), // haft
  ...repRow(2, [solid(3, MACE_LH, 'C'), 'C']), // grip wrap
  ...repRow(2, [solid(2, MACE_LH, 'M'), 'M']), // base
];
const MACE = part(rowsOf(macePairs), { '#': 'dark', M: 'metal', O: 'accent', C: 'cloth' }, { weaponGrip: { x: MACE_LH, y: 23 } });

// LANTERN — CRYPT_WARDEN: held up by its handle, the glowing body hangs
// below the fist (like a real lantern, not a "held ready" blade).
const LANT_LH = 6;
const lanternPairs: Row[] = [
  ...repRow(3, [solid(4, LANT_LH, 'M'), 'M']), // handle ring
  ...repRow(2, [solid(5, LANT_LH, 'M'), 'M']), // hook
  [solid(0, LANT_LH, 'M'), 'M'],
  ...repRow(11, [solid(1, LANT_LH, 'G'), 'G']), // glowing body
  [solid(0, LANT_LH, 'M'), 'M'],
  ...repRow(2, [solid(3, LANT_LH, 'M'), 'M']), // base
];
const LANTERN = part(rowsOf(lanternPairs), { '#': 'dark', M: 'metal', G: 'glow' }, { weaponGrip: { x: LANT_LH, y: 1 } });

// CLAW — HOLLOW_KING (BOSS_PART scale). LH = 7 (width 15), 38 rows: a wrist
// and palm at the grip, two long hooked claws hanging from it.
const CLAW_LH = 7;
const clawPairs: Row[] = [
  ...repRow(3, [solid(5, CLAW_LH, 'M'), 'M']), // wrist
  ...repRow(6, [solid(1, CLAW_LH, 'M'), 'M']), // palm
  ...repRow(22, [limb(2, 2, CLAW_LH, 'M'), '.']), // claws
  ...repRow(5, [limb(3, 1, CLAW_LH, 'M'), '.']),
  ...repRow(2, [limb(3, 1, CLAW_LH, 'L'), '.']), // glinting tips
];
const CLAW = part(rowsOf(clawPairs), { '#': 'dark', M: 'metal', L: 'light' }, { weaponGrip: { x: CLAW_LH, y: 2 } });

// SHIELD — PYRE_KNIGHT, DROWNED_KNIGHT: a round-topped kite shield, literally
// placed in front rather than anchored (a raised guard barely moves pose to
// pose, and the six-name anchor vocabulary has no second grip point).
const SHIELD_LH = 10;
const shieldPairs: Row[] = [
  ...[4, 2, 0].map((pad): Row => [solid(pad, SHIELD_LH, 'M'), 'M']),
  ...repRow(3, [solid(0, SHIELD_LH, 'M'), 'M']),
  ...repRow(3, [solid(0, SHIELD_LH, 'O'), 'O']), // emblem band
  ...repRow(6, [solid(0, SHIELD_LH, 'M'), 'M']),
  ...Array.from({ length: 11 }, (_, i): Row => [solid(1 + Math.round((i * 8) / 10), SHIELD_LH, 'M'), 'M']),
];
const SHIELD = part(rowsOf(shieldPairs), { '#': 'dark', M: 'metal', O: 'accent' }, {});

// TOWER_SHIELD — BASALT: a flat-topped, flat-bottomed rectangular tower
// shield (never taper to a point) — a bigger, blunter silhouette than the
// knights' kite shield.
// Accent-DOMINANT (unlike the knights' mostly-metal round SHIELD above) —
// held in front of a mostly-metal torso_heavy, a mostly-metal tower shield
// would blend into the armour behind it and read as nothing at all; the
// bold accent face is what makes "a tower shield in front" actually visible.
const TOWER_LH = 11;
const towerPairs: Row[] = [
  ...repRow(3, [solid(2, TOWER_LH, 'M'), 'M']), // metal rim, top
  ...repRow(3, [solid(0, TOWER_LH, 'M'), 'M']),
  ...repRow(22, [solid(0, TOWER_LH, 'O'), 'O']), // bold accent face
  ...repRow(4, [solid(0, TOWER_LH, 'M'), 'M']), // metal rim, bottom
];
const TOWER_SHIELD = part(rowsOf(towerPairs), { '#': 'dark', M: 'metal', O: 'accent' }, {});

// --- Capes / cloaks -----------------------------------------------------------

// SHORT_CLOAK — SABLE: a hooded cloak to the knees (clean hem, not
// tattered — that read is reserved for HOLLOW_KING below).
const SHORT_LH = 9;
const shortCloakPairs: Row[] = [
  ...[6, 4, 2].map((pad): Row => [solid(pad, SHORT_LH, 'C'), 'C']),
  ...repRow(17, [solid(0, SHORT_LH, 'O'), 'O']),
  ...[2, 3, 4, 5, 6, 7].map((pad): Row => [solid(pad, SHORT_LH, 'C'), 'C']),
];
const SHORT_CLOAK = part(rowsOf(shortCloakPairs), { '#': 'dark', C: 'cloth', O: 'accent' }, { capePin: { x: SHORT_LH, y: 1 } });

// SCARF — GALE: streams backward off the collar (opposite the torso's
// forward lean), rather than hanging straight down like a cloak. Built with
// explicit `.repeat()` counts (rather than hand-typed dot runs) since it's
// asymmetric and every row must still land on the same total width.
const SCARF_W = 19;
const scarfRows: string[] = [
  padRow(SCARF_W, 7, '#OOO#'),
  padRow(SCARF_W, 6, '#OOO#'),
  padRow(SCARF_W, 5, '#OOO#'),
  padRow(SCARF_W, 4, '#OO#'),
  padRow(SCARF_W, 3, '#OO#'),
  padRow(SCARF_W, 2, '#OO#'),
  padRow(SCARF_W, 1, '#OO#'),
  padRow(SCARF_W, 0, '#O#'),
  padRow(SCARF_W, 0, '#'),
];
// capePin sits well right of the streamer's own content (rather than
// centred on it) so placing it against the torso's capePin point shifts
// the WHOLE scarf left of the shoulder — visibly trailing out from behind
// GALE's forward-leaning torso instead of being entirely covered by it
// (the same "layered behind a same-size-or-smaller silhouette is invisible"
// trap the boss cloak above ran into).
const SCARF = part(scarfRows, { '#': 'dark', O: 'accent' }, { capePin: { x: 16, y: 0 } });

// CLOAK_RAGGED / CLOAK_HOLY — HOLLOW_KING, PALE_SAINT (BOSS_PART scale).
// Same collar and body; only the hem differs — torn strips of uneven
// length for the ragged skeleton king, a clean trimmed edge for the saint.
// Deliberately WIDER than KING_BODY/SAINT_BODY's own 45 cells (draped over
// and past the shoulders) and taller than the body's own 66 rows (trailing
// past the legs) — drawn at z 0, BEHIND the body, a same-width-or-shorter
// cloak would be entirely hidden by the wider, taller body painted over it.
const BCLOAK_LH = 26;
const cloakTop: Row[] = [...[20, 16, 12].map((pad): Row => [solid(pad, BCLOAK_LH, 'C'), 'C']), ...repRow(26, [solid(0, BCLOAK_LH, 'O'), 'O'])];
const cloakRaggedBottom: Row[] = [
  ...repRow(5, [limb(0, 23, BCLOAK_LH, 'O'), '.']),
  ...repRow(5, [limb(3, 17, BCLOAK_LH, 'O'), '.']),
  ...repRow(5, [limb(6, 12, BCLOAK_LH, 'O'), '.']),
  ...repRow(5, [limb(9, 8, BCLOAK_LH, 'O'), '.']),
  ...repRow(5, [limb(12, 4, BCLOAK_LH, 'O'), '.']),
  ...repRow(5, [limb(15, 1, BCLOAK_LH, 'O'), '.']),
];
const CLOAK_RAGGED = part(rowsOf([...cloakTop, ...cloakRaggedBottom]), { '#': 'dark', C: 'cloth', O: 'accent' }, { capePin: { x: BCLOAK_LH, y: 1 } });
const cloakHolyBottom: Row[] = [...repRow(28, [solid(0, BCLOAK_LH, 'O'), 'O']), ...repRow(2, [solid(0, BCLOAK_LH, 'C'), 'C'])];
const CLOAK_HOLY = part(rowsOf([...cloakTop, ...cloakHolyBottom]), { '#': 'dark', C: 'cloth', O: 'accent' }, { capePin: { x: BCLOAK_LH, y: 1 } });

// --- Accessories: crown, halo, plume, kelp, claw (claw is with the weapons above) ---

// CROWN — HOLLOW_KING.
const CROWN_LH = 8;
const crownRows: string[] = ['.#.#.#.#.#.#.#.#.', '#O#O#O#O#O#O#O#O#', sym(solid(0, CROWN_LH, 'O'), 'G'), sym(solid(0, CROWN_LH, 'O'), 'O'), sym(solid(0, CROWN_LH, '#'), '#')];
const CROWN = part(crownRows, { '#': 'dark', O: 'accent', G: 'glow' }, {});

// HALO — LUMEN, PALE_SAINT: a thin hollow ring of light.
const haloRows: string[] = [sym(solid(6, 8, 'G'), 'G'), sym(solid(2, 8, 'G'), 'G'), '..#GGG.....GGG#..', sym(solid(2, 8, 'G'), 'G'), sym(solid(6, 8, 'G'), 'G')];
const HALO = part(haloRows, { '#': 'dark', G: 'glow' }, {});

// PLUME — PYRE_KNIGHT's helm crest: an upward flame-like feather (glow, so
// it reads as literally burning under FIRE's tint).
const PLUME_LH = 3;
const plumePads = [3, 2, 2, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];
const PLUME = part(
  rowsOf(plumePads.map((pad): Row => [solid(pad, PLUME_LH, 'G'), 'G'])),
  { '#': 'dark', G: 'glow' },
  {},
);

// KELP — DROWNED_KNIGHT's helm crest: hanging waterlogged strands (accent,
// so it reads teal under WATER's tint) — the same silhouette family as
// PLUME, inverted (wide at the attach point, thinning as it hangs).
const kelpPads = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6, 7];
const KELP = part(
  rowsOf(kelpPads.map((pad): Row => [solid(pad, PLUME_LH, 'O'), 'O'])),
  { '#': 'dark', O: 'accent' },
  {},
);

// --- Monster bodies -------------------------------------------------------
// Single-part creatures: no separate head/arms rig, one silhouette per
// layer (plus the imp's wings, a second layer) so a quadruped or a floating
// shape never has to fake a biped skeleton. Each name's defining feature —
// horns, a jaw, a shell, no legs — is a one-off addition (via `padRow` or a
// hand-typed row) on top of a `sym`-built base, per DESIGN.md's silhouette
// rule for the EMBER CRYPT / FROST MARSH rosters.

// IMP_BODY — CINDER_IMP: small, horned, hunched (top-heavy silhouette), a
// curled tail trailing from the hip.
const IMP_LH = 11;
const impPairs: Row[] = [
  ...[9, 7].map((pad): Row => [solid(pad, IMP_LH, 'O'), 'O']), // horns
  ...repRow(3, [solid(2, IMP_LH, 'O'), 'O']),
  ['..#OGO#....', 'O'], // eyes
  ...repRow(4, [solid(2, IMP_LH, 'O'), 'O']), // hunched shoulders (widest point)
  ...repRow(10, [solid(4, IMP_LH, 'O'), 'O']), // body tapers in
  ...repRow(4, [solid(3, IMP_LH, 'O'), 'O']), // hips
  ...repRow(6, [limb(4, 3, IMP_LH, 'O'), '.']), // stubby legs
];
const impRows = rowsOf(impPairs);
const impTail = ['..##.', '.####', '..##.', '..#..'];
for (let i = 0; i < impTail.length; i++) impRows[20 + i] += impTail[i]; // curls off the hip, right side
const IMP_BODY = part(impRows, { '#': 'dark', O: 'accent', G: 'glow' }, { feet: { x: IMP_LH, y: 29 }, hit: { x: IMP_LH, y: 12 } });

const IMP_WINGS = part(
  rowsOf([9, 6, 3, 1, 0, 0, 1, 3, 6, 9, 12].map((pad): Row => [solid(pad, 13, 'O'), 'O'])),
  { '#': 'dark', O: 'accent' },
  {},
);

// HOUND_BODY — ASH_HOUND: a low, wide four-legged body (two leg blocks per
// mirrored half via `limb2`) with a long jaw jutting from one side.
const HOUND_LH = 10;
const houndPairs: Row[] = [
  ...repRow(4, [solid(3, HOUND_LH, 'O'), 'O']), // back
  ...repRow(6, [solid(1, HOUND_LH, 'O'), 'O']), // ribcage
  ...repRow(2, [solid(3, HOUND_LH, 'O'), 'O']), // belly taper
  ...repRow(8, [limb2(1, 2, 5, 2, HOUND_LH, 'O'), '.']), // four legs
  ...repRow(2, [limb2(1, 2, 5, 2, HOUND_LH, '#'), '.']), // paws
];
const houndRows = rowsOf(houndPairs);
const houndJaw = ['..###..', '.#OOO#.', '#OOOOO#', '#OOOOO#', '.#OOO#.', '..###..'];
for (let i = 0; i < houndJaw.length; i++) houndRows[4 + i] += houndJaw[i]; // long snout, right side
const HOUND_BODY = part(houndRows, { '#': 'dark', O: 'accent' }, { feet: { x: HOUND_LH, y: 21 }, hit: { x: HOUND_LH, y: 7 } });

// WRAITH_BODY — DUST_WRAITH: a tall tattered shroud with no legs — the feet
// anchor sits above the tatter tips, so it visibly hovers.
const WRAITH_LH = 14;
const wraithPairs: Row[] = [
  ...[10, 7, 4].map((pad): Row => [solid(pad, WRAITH_LH, 'C'), 'C']), // hood (cloth trim, neutral)
  ['...........#GG', '#'], // eyes in shadow
  [solid(9, WRAITH_LH, 'O'), 'O'],
  ...repRow(5, [solid(2, WRAITH_LH, 'O'), 'O']), // shoulders — accent from here down, so the shroud tints per element
  ...repRow(24, [solid(0, WRAITH_LH, 'O'), 'O']), // flowing shroud
  ...repRow(3, [limb(0, 12, WRAITH_LH, 'O'), '.']), // tattered hem, uneven strips
  ...repRow(3, [limb(2, 8, WRAITH_LH, 'O'), '.']),
  ...repRow(3, [limb(4, 5, WRAITH_LH, 'O'), '.']),
  ...repRow(3, [limb(6, 2, WRAITH_LH, 'O'), '.']),
];
const WRAITH_BODY = part(rowsOf(wraithPairs), { '#': 'dark', C: 'cloth', O: 'accent', G: 'glow' }, { feet: { x: WRAITH_LH, y: 38 }, hit: { x: WRAITH_LH, y: 20 } });

// TOAD_BODY — BOG_TOAD: squat and very wide, two bulging eyes on top.
const TOAD_LH = 22;
const toadPairs: Row[] = [
  ...repRow(4, [limb2(6, 3, 13, 3, TOAD_LH, 'O'), '.']), // bulging eyes
  ...repRow(4, [solid(6, TOAD_LH, 'O'), 'O']), // head/back
  ...repRow(12, [solid(0, TOAD_LH, 'O'), 'O']), // wide body
  ...repRow(2, [solid(4, TOAD_LH, 'O'), 'O']), // belly taper
  ...repRow(4, [limb(8, 4, TOAD_LH, 'O'), '.']), // stubby legs
];
const TOAD_BODY = part(rowsOf(toadPairs), { '#': 'dark', O: 'accent' }, { feet: { x: TOAD_LH, y: 25 }, hit: { x: TOAD_LH, y: 10 } });

// WISP_BODY — FROST_WISP: a small, jagged crystalline glow (distinct from
// FEN_FIRE's flame lick below) with a fading trail beneath it.
const WISP_LH = 12;
const wispPads = [11, 9, 6, 8, 4, 6, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 4, 6, 8, 11];
const wispPairs: Row[] = wispPads.map((pad, i): Row => {
  const glow = i >= 7 && i <= 12;
  return [solid(pad, WISP_LH, glow ? 'G' : 'O'), glow ? 'G' : 'O'];
});
const WISP_BODY = part(
  [...rowsOf(wispPairs), ...rowsOf(repRow(4, [limb(9, 3, WISP_LH, 'G'), '.']))],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: WISP_LH, y: 23 }, hit: { x: WISP_LH, y: 9 } },
);

// CRAB_BODY — SILT_CRAB: wide, shelled, with a prominent pincer claw at
// each outer edge.
const CRAB_LH = 22;
const crabPairs: Row[] = [
  ...repRow(4, [limb(0, 6, CRAB_LH, 'O'), '.']), // claws
  ...repRow(4, [solid(4, CRAB_LH, 'O'), 'O']), // shell dome
  ...repRow(10, [solid(0, CRAB_LH, 'O'), 'O']), // wide shell
  ...repRow(2, [solid(6, CRAB_LH, 'O'), 'O']), // underside taper
  ...repRow(4, [limb2(2, 2, 10, 2, CRAB_LH, 'O'), '.']), // legs
];
const CRAB_BODY = part(rowsOf(crabPairs), { '#': 'dark', O: 'accent' }, { feet: { x: CRAB_LH, y: 23 }, hit: { x: CRAB_LH, y: 9 } });

// FENFIRE_BODY — FEN_FIRE: a small, slender flickering flame (distinct
// silhouette from FROST_WISP's crystalline round shape above).
const FEN_LH = 10;
const fenPads = [6, 3, 7, 2, 5, 1, 4, 0, 2, 0, 1, 0, 2, 1, 3, 5, 7, 9];
const fenPairs: Row[] = fenPads.map((pad, i): Row => {
  const glow = i >= 7 && i <= 11;
  return [solid(pad, FEN_LH, glow ? 'G' : 'O'), glow ? 'G' : 'O'];
});
const FENFIRE_BODY = part(rowsOf(fenPairs), { '#': 'dark', O: 'accent', G: 'glow' }, { feet: { x: FEN_LH, y: 17 }, hit: { x: FEN_LH, y: 8 } });

// --- Boss-scale bodies + heads (Hollow King, Pale Saint) -----------------------
// Authored at BOSS_PART = 96 and placed on the 96-cell canvas. The two
// bosses no longer share one body: HOLLOW_KING reads as bone (gapped ribs,
// separated legs — negative space as the identity), PALE_SAINT as an
// unbroken robed silhouette (solid mass, no leg gap) — the crown/claw vs.
// halo/orb accessories tell them apart on top of that, not instead of it.

// KING_BODY — HOLLOW_KING: a gaunt ribcage (bone = the neutral `skin` role),
// a narrow waist, and long, separated bony legs.
const KING_LH = 22;
const kingRibcage: Row[] = Array.from({ length: 20 }, (_, i): Row => (i % 2 === 0 ? [solid(6, KING_LH, 'S'), 'S'] : [solid(9, KING_LH, '#'), '#']));
const kingBodyPairs: Row[] = [
  ...[16, 12, 8].map((pad): Row => [solid(pad, KING_LH, 'S'), 'S']), // shoulder blades
  ...repRow(2, [solid(10, KING_LH, 'S'), 'S']), // collarbone
  ...kingRibcage,
  ...repRow(4, [solid(14, KING_LH, 'S'), 'S']), // spine/waist
  ...repRow(3, [solid(8, KING_LH, 'S'), 'S']), // pelvis flare
  ...repRow(2, [solid(10, KING_LH, '#'), '#']), // hip socket gap
  ...repRow(30, [limb(9, 4, KING_LH, 'S'), '.']), // long separated legs
  ...repRow(2, [limb(8, 6, KING_LH, '#'), '.']), // bony feet
];
const KING_BODY = part(
  rowsOf(kingBodyPairs),
  { '#': 'dark', S: 'skin', M: 'metal', O: 'accent' },
  { head: { x: KING_LH, y: 0 }, hand: { x: 38, y: 7 }, weaponGrip: { x: 38, y: 10 }, capePin: { x: KING_LH, y: 4 }, feet: { x: KING_LH, y: 65 }, hit: { x: KING_LH, y: 30 } },
);

// KING_HEAD — a gaunt skull: eye sockets glowing DARK's tint deep inside,
// a grid of bared teeth.
const KING_HEAD_LH = 10;
const kingHeadPairs: Row[] = [
  ...[7, 5, 3, 1, 0].map((pad): Row => [solid(pad, KING_HEAD_LH, 'S'), 'S']), // cranium
  ...repRow(5, [solid(0, KING_HEAD_LH, 'S'), 'S']),
  ['....##GG..', '#'], // eye sockets
  ...repRow(3, [solid(1, KING_HEAD_LH, 'S'), 'S']), // cheekbones
  ...repRow(4, [solid(2, KING_HEAD_LH, 'S'), 'S']), // jaw
  ['..#S#S#S#.', '#'], // bared teeth
  [solid(4, KING_HEAD_LH, 'S'), 'S'],
];
const KING_HEAD = part(rowsOf(kingHeadPairs), { '#': 'dark', S: 'skin', G: 'glow' }, { head: { x: KING_HEAD_LH, y: 19 } });

// SAINT_BODY — PALE_SAINT: an unbroken robed silhouette (no rib gaps, no
// leg split) — solid mass is the identity read against HOLLOW_KING's bone.
const saintBodyPairs: Row[] = [
  ...[16, 12, 8].map((pad): Row => [solid(pad, KING_LH, 'C'), 'C']), // collar (cloth trim, neutral)
  ...repRow(7, [solid(4, KING_LH, 'M'), 'M']), // armoured pauldrons
  ...repRow(10, [solid(0, KING_LH, 'O'), 'O']), // robe — accent from here down, so it tints per element
  ...repRow(3, [solid(0, KING_LH, 'C'), 'C']), // trim band
  ...repRow(17, [solid(0, KING_LH, 'O'), 'O']),
  ...repRow(24, [solid(0, KING_LH, 'O'), 'O']), // robe continues, unbroken to the hem
  ...repRow(2, [solid(0, KING_LH, 'C'), 'C']), // hem trim
];
const SAINT_BODY = part(
  rowsOf(saintBodyPairs),
  { '#': 'dark', C: 'cloth', M: 'metal', O: 'accent' },
  { head: { x: KING_LH, y: 0 }, hand: { x: 38, y: 5 }, weaponGrip: { x: 38, y: 8 }, capePin: { x: KING_LH, y: 2 }, feet: { x: KING_LH, y: 65 }, hit: { x: KING_LH, y: 25 } },
);

// SAINT_HEAD — a serene, veiled face (skin shows, unlike KING_HEAD's bared
// skull) with softly closed eyes.
const saintHeadPairs: Row[] = [
  ...[7, 5, 3, 1, 0].map((pad): Row => [solid(pad, KING_HEAD_LH, 'C'), 'C']), // veil
  ...repRow(5, [solid(0, KING_HEAD_LH, 'S'), 'S']), // face
  ['....##LL..', 'S'], // closed, gentle eyes
  ...repRow(5, [solid(1, KING_HEAD_LH, 'S'), 'S']), // lower face
  ...repRow(4, [solid(0, KING_HEAD_LH, 'C'), 'C']), // veil drape
  [solid(4, KING_HEAD_LH, 'S'), 'S'],
];
const SAINT_HEAD = part(rowsOf(saintHeadPairs), { '#': 'dark', C: 'cloth', S: 'skin', L: 'light' }, { head: { x: KING_HEAD_LH, y: 19 } });

// --- Library ------------------------------------------------------------------

export const PART_LIBRARY = {
  // humanoid rig
  torso_slim: TORSO_SLIM,
  torso_lean: TORSO_LEAN,
  torso_heavy: TORSO_HEAVY,
  torso_robe: TORSO_ROBE,
  head_spiky: HEAD_SPIKY,
  head_windswept: HEAD_WINDSWEPT,
  head_hood_deep: HEAD_HOOD_DEEP,
  head_hood_shadow: HEAD_HOOD_SHADOW,
  head_helm: HEAD_HELM,
  head_longhair: HEAD_LONGHAIR,
  head_hag: HEAD_HAG,
  arms_sleeve: ARMS_SLEEVE,
  arms_bare: ARMS_BARE,
  arms_guard: ARMS_GUARD,
  arms_both: ARMS_BOTH,
  // weapons
  sword: SWORD,
  dagger: DAGGER,
  dagger_small: DAGGER_SMALL,
  dagger_curved: DAGGER_CURVED,
  staff: STAFF,
  cane: CANE,
  bow_tall: BOW_TALL,
  orb: ORB,
  mace: MACE,
  lantern: LANTERN,
  claw: CLAW,
  shield: SHIELD,
  tower_shield: TOWER_SHIELD,
  // capes
  short_cloak: SHORT_CLOAK,
  scarf: SCARF,
  cloak_ragged: CLOAK_RAGGED,
  cloak_holy: CLOAK_HOLY,
  // accessories
  crown: CROWN,
  halo: HALO,
  plume: PLUME,
  kelp: KELP,
  // EMBER CRYPT monsters
  imp_body: IMP_BODY,
  imp_wings: IMP_WINGS,
  hound_body: HOUND_BODY,
  wraith_body: WRAITH_BODY,
  // FROST MARSH monsters
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

/** Cell width/height of a part's own ASCII grid (before any pose rotation). */
export function partSize(id: PartId): { w: number; h: number } {
  const p = PART_LIBRARY[id];
  const h = p.rows.length;
  let w = 0;
  for (const row of p.rows) if (row.length > w) w = row.length;
  return { w, h };
}
