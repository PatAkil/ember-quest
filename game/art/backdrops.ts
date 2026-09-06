// Ember Quest v3 — game/art/backdrops.ts
//
// The diorama behind the fight: one BiomeLook per biome, handed to
// engine/light.ts, which bakes the four plane painters into blurred offscreens
// ONCE per (biome, tier) and then only ever redraws them at a parallax offset.
// Nothing here runs at frame time, so the painters are written for looks, not
// for speed — paths, gradients and a hundred small shapes are all fair game.
//
// THE RULE OF THE PALETTE: the sprites are the saturated element in the frame;
// the world is desaturated and dark-to-mid. Aerial perspective does the depth —
// the FAR plane is the lightest and the bluest, the MID plane sits a shade
// darker, and the NEAR plane (drawn over the actors) is the darkest thing on
// screen. Any warmth in the crypt or green in the marsh is a light source
// justifying itself, never a decorated wall.
//
// The stage geometry is DESIGN.md's: the wall meets the floor at FLOOR_Y, the
// perspective converges on VP, heroes stand at x 408-520 and enemies mirror
// about x 640, so the composition keeps its interest OUTSIDE x 330-950 at head
// height and lets the actor line own the middle.

import type { BiomeLook, BiomeLooks, PoolLight } from '../../engine';
import { HERO_FEET, ENEMY_FEET } from '../screens/layout';

/**
 * THE FOOT POOLS ARE DERIVED FROM THE STAGE ANCHORS, not from literals.
 *
 * Every biome lights its two foot clusters with a pool, and until round 6 each
 * one carried hand-typed coordinates that happened to sit near where the ranks
 * stand. They drifted: the stage moved to `HERO_FEET` (700, 380) · (790, 448) ·
 * (880, 516) and `ENEMY_FEET` (230, 380) · (330, 448) · (430, 516) (round 6's
 * anchors; UI round 4 has since packed them to ENEMY_FEET x 290-382 and
 * HERO_FEET x 532-732, and the pools followed without an edit here) and the
 * pools stayed at y 462 with an ry of 116-120, so the back seat of each rank
 * sat outside its own pool and the ground at the six seats measured 21.7-38.7
 * while the EMPTY near band measured 34.4-37.0 — the light was where nobody
 * stands. Reading the anchors means the composition round's pack-tightening
 * lands under the pools automatically.
 *
 * `padX` / `padY` are how far past the outermost foot the ellipse reaches, so a
 * rank is lit with a margin rather than clipped at its own boots.
 */
const RANK_OVERLAP_MAX = 60;

/** One rank's centre and un-clamped half-extents. */
function rankGeom(feet: readonly { x: number; y: number }[], padX: number, padY: number) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of feet) {
    x0 = Math.min(x0, f.x); x1 = Math.max(x1, f.x);
    y0 = Math.min(y0, f.y); y1 = Math.max(y1, f.y);
  }
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    rx: (x1 - x0) / 2 + padX,
    ry: (y1 - y0) / 2 + padY,
  };
}

function clusterPool(
  feet: readonly { x: number; y: number }[],
  color: string,
  alpha: number,
  actorWeight: number,
  padX = 250,
  padY = 92,
): PoolLight {
  const me = rankGeom(feet, padX, padY);
  // THE PAD IS CLAMPED AGAINST THE OTHER RANK. `padX` adds to the rank's own
  // half-width, so at round 6's anchors it produced rx 350 and rx 340 for
  // ranks whose centres were only 460 px apart — 230 px of overlap, and the two
  // ellipses already read as one band across the middle of the stage. UI
  // round 4 then tightened the rank gap to 11.7 % of the width (centres 296 px
  // apart, un-clamped rx 296 / 350 — 350 px of overlap); at that gap an
  // unguarded pad merges them completely and the stage has one pool again,
  // which is the exact defect the symmetric pair was introduced to fix. Today
  // the clamp is active (k ~ 0.55): enemy rx 163, party rx 193, 60 px shared. So both radii are scaled by one factor until the pair overlaps by no
  // more than RANK_OVERLAP_MAX, whatever the anchors say. Proportional, so the
  // wider rank keeps the wider pool; never scaled UP, so a wide gap is left
  // alone.
  const a = rankGeom(ENEMY_FEET, padX, padY);
  const b = rankGeom(HERO_FEET, padX, padY);
  const apart = Math.abs(b.cx - a.cx);
  const allowed = apart + RANK_OVERLAP_MAX;
  const sum = a.rx + b.rx;
  const k = sum > allowed ? allowed / sum : 1;
  return {
    color,
    x: Math.round(me.cx),
    y: Math.round(me.cy),
    rx: Math.round(me.rx * k),
    ry: Math.round(me.ry),
    alpha,
    actorWeight,
  };
}

/**
 * How far ABOVE the wall/floor joint each floor plane starts painting. The
 * ground gradient used to begin exactly at FLOOR_Y, so it appeared at full
 * strength on one row and the joint feather had nothing to ramp: a 24-L step
 * in a single row, straight across the frame, and the longest straight edge
 * left at LOW. The plane now starts 52 px higher and fadeTop erases that
 * overlap on a broken line.
 */
const JOINT_LIFT = 52;

/** Where the back wall meets the stage floor. */
const FLOOR_Y = 392;
/** The vanishing point every floor line converges on (above the wall line: the camera looks slightly down). */
const VP_X = 640;
const VP_Y = 296;

// ------------------------------------------------------------------ helpers --

type Stop = readonly [number, string];

function vgrad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stops: readonly Stop[]): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function poly(ctx: CanvasRenderingContext2D, pts: readonly number[], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A soft light blob — bake time only, so a fresh gradient per call is free. */
function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** A round-topped arch opening, apex at (x, top), springing at `spring`. */
function archPath(ctx: CanvasRenderingContext2D, x: number, half: number, top: number, spring: number): void {
  ctx.beginPath();
  ctx.moveTo(x - half, spring);
  ctx.lineTo(x - half, top + half);
  ctx.quadraticCurveTo(x - half, top, x, top);
  ctx.quadraticCurveTo(x + half, top, x + half, top + half);
  ctx.lineTo(x + half, spring);
  ctx.closePath();
}

/**
 * An arch. With a `rim` it is a MASS and not a cut-out: the shadow it throws on
 * the ground, then `faceShade`'s lit crown / hard break / shaded flank clipped
 * to the arch's own curve. The spire's broken gate is the largest mid mass in
 * that biome and was the flat trapezoid round 3 item 3 actually named; the nine
 * merlons twenty lines below it had already been given this treatment.
 */
function arch(
  ctx: CanvasRenderingContext2D,
  x: number,
  half: number,
  top: number,
  spring: number,
  fill: string,
  rim?: string,
  rimA = 0.3,
): void {
  if (rim) propShadow(ctx, x, spring + 2, half * 1.2, 0.34);
  archPath(ctx, x, half, top, spring);
  ctx.fillStyle = fill;
  ctx.fill();
  if (rim) faceShadeIn(ctx, () => archPath(ctx, x, half, top, spring), top, spring, rim, rimA);
}

/** A column: slightly tapered, with a lighter key-side edge. */
function pillar(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  half: number,
  fill: string,
  edge: string,
): void {
  poly(ctx, [x - half, bottom, x - half * 0.82, top, x + half * 0.82, top, x + half, bottom], fill);
  poly(ctx, [x - half, bottom, x - half * 0.82, top, x - half * 0.45, top, x - half * 0.6, bottom], edge);
}

/**
 * Feather the top edge of the ground plane. A hard horizontal join between the
 * hazy mid-field and the ground reads as a seam across the whole frame; 40 px
 * of alpha ramp turns it into the base of the haze.
 */
function fadeTop(ctx: CanvasRenderingContext2D, width: number, y: number, h: number, seed = 0x9a17): void {
  // STEPPED, not a straight ramp. A uniform full-width alpha ramp is itself a
  // 1280-px horizontal edge — at LOW, where no plane blur softens it, it was
  // the longest straight run in four of six biomes. The erase now follows the
  // same broken profile the wall's own joint uses, each segment at its own
  // start row and its own ramp height, so the ground fades in on a line that
  // never runs straight for more than a segment.
  // ELEVEN segments, not seven. The feather is the widest smooth ramp left in
  // the frame, so the ceiling on any one straight run is the segment width:
  // 1360/11 = 124 px, and even two neighbours that happen to ramp alike stay
  // under the 300-px bar.
  const runs = horizonSteps(width, y, seed ^ 0x51a7, 11, Math.max(10, h * 0.5));
  const rand = rng(seed ^ 0x2b19);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [x0, x1, sy] of runs) {
    const hh = h * (1.6 + rand() * 1.2);
    // FULL erase above the segment's own line, then a long ramp below it. The
    // floor plane starts JOINT_LIFT px higher than the joint precisely so this
    // ramp has continuous content to work on rather than a hard start row; the
    // rect therefore has to reach above that lift, and the first stop has to
    // be opaque, or the lift itself becomes the new straight edge.
    const g = ctx.createLinearGradient(0, sy, 0, sy + hh);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    // Overlap the neighbour by a few px so no unerased sliver shows between.
    ctx.fillRect(x0 - 4, sy - JOINT_LIFT - 30, x1 - x0 + 8, hh + JOINT_LIFT + 30);
  }
  ctx.restore();
}

/**
 * A WHISPER of the room's own courses: a few lines converging on the vanishing
 * point and flagstone courses foreshortening toward the wall. This used to be
 * the only texture on the floor and read as a demo grid; it survives as one
 * faint layer under the scatter — DASHED into three to five pieces per line
 * with gaps, jittered spacing, per-dash alpha and a fade-out well before the
 * bottom edge, so the near field is debris and no course ever runs end to end.
 */
function floorGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  line: string,
  alpha: number,
  seed = 0x9a17,
): void {
  const rand = rng(seed);
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  // Every line runs through (VP_X, VP_Y); only a stretch below the wall is
  // drawn, and it is drawn in THREE TO FIVE DASHES with gaps. A worn course in
  // stone is not continuous, and an unbroken converging line is the only
  // straight thing left on a masonry floor once the scatter and grain are in.
  for (let i = -5; i <= 5; i++) {
    if (rand() < 0.3) continue;
    const xb = VP_X + i * 190 + (rand() - 0.5) * 84;
    const k = (FLOOR_Y - VP_Y) / (height - VP_Y);
    const yEnd = FLOOR_Y + (height - FLOOR_Y) * (0.45 + rand() * 0.45);
    const t = (yEnd - VP_Y) / (height - VP_Y);
    const ax = VP_X + (xb - VP_X) * k;
    const bx = VP_X + (xb - VP_X) * t;
    const pieces = 3 + Math.floor(rand() * 3);
    let u = rand() * 0.16;
    for (let d = 0; d < pieces && u < 1; d++) {
      const v = Math.min(1, u + 0.1 + rand() * 0.17);
      ctx.globalAlpha = alpha * (0.4 + rand() * 0.75);
      ctx.beginPath();
      ctx.moveTo(ax + (bx - ax) * u, FLOOR_Y + (yEnd - FLOOR_Y) * u);
      ctx.lineTo(ax + (bx - ax) * v, FLOOR_Y + (yEnd - FLOOR_Y) * v);
      ctx.stroke();
      u = v + 0.07 + rand() * 0.18;
    }
  }
  // Courses: y advances geometrically so the flagstones foreshorten. Each is
  // dashed the same way and they give out well before the front.
  let y = FLOOR_Y + 6;
  let step = 8;
  while (y < height) {
    const t = (y - FLOOR_Y) / (height - FLOOR_Y);
    const fade = Math.max(0, 1 - t * t * 1.35);
    const x0 = rand() * width * 0.34;
    const x1 = width - rand() * width * 0.34;
    const pieces = 2 + Math.floor(rand() * 3);
    let u = rand() * 0.12;
    for (let d = 0; d < pieces && u < 1; d++) {
      const v = Math.min(1, u + 0.14 + rand() * 0.24);
      ctx.globalAlpha = alpha * (0.4 + rand() * 0.7) * fade;
      ctx.beginPath();
      ctx.moveTo(x0 + (x1 - x0) * u, y + (rand() - 0.5) * 2);
      ctx.lineTo(x0 + (x1 - x0) * v, y + (rand() - 0.5) * 3);
      ctx.stroke();
      u = v + 0.06 + rand() * 0.2;
    }
    y += step * (0.8 + rand() * 0.5);
    step *= 1.34;
  }
  ctx.restore();
}

/**
 * The aerial haze on the FAR plane. It used to be a wash that ramped from
 * transparent at `top` to full strength at FLOOR_Y and then simply stopped —
 * a 1280-px value step at the wall line, which is the exact seam this round
 * retires. Under HIGH's 6-px plane blur it was soft enough to hide; at LOW it
 * was the longest straight edge in the frame in every biome (forge 786 px,
 * vault 523, ruins 456). It now peaks just above the joint and falls back to
 * nothing over the first 60 px of the ground, which is also what haze does:
 * it thins where the floor comes forward toward the camera.
 */
function hazeWash(
  ctx: CanvasRenderingContext2D,
  W: number,
  top: number,
  color: string,
  peak: number,
  seed = 0x4a2f,
): void {
  const bottom = FLOOR_Y + 62;
  const crest = (FLOOR_Y - 14 - top) / (bottom - top);
  vgrad(ctx, 0, top, W, bottom - top, [
    [0, hexA(color, 0)],
    [crest * 0.62, hexA(color, peak * 0.42)],
    [crest, hexA(color, peak)],
    [crest + (1 - crest) * 0.45, hexA(color, peak * 0.52)],
    [1, hexA(color, 0)],
  ]);
  // MOTTLE. A perfectly smooth vertical ramp is, to a ruler that looks for a
  // constant vertical step across x, indistinguishable from a straight rule —
  // and to the eye it bands. Haze is not smooth: thirty wide, very soft
  // patches, half of them lifting and half sinking by a couple of L, break
  // every iso-line in the wash without being individually visible.
  const rand = rng(seed);
  const band = FLOOR_Y + 20 - top;
  for (let i = 0; i < 30; i++) {
    const x = -80 + rand() * (W + 160);
    const y = top + rand() * band;
    const rx = 90 + rand() * 210;
    const a = peak * (0.1 + rand() * 0.16);
    blobAt(ctx, x, y, rx, rx * (0.2 + rand() * 0.28), color, a, rand() < 0.55);
  }
  // FINE grain through the last 100 px above the joint and the first 30 below.
  // The wide mottle above breaks the wash at the scale the eye reads; a ruler
  // that looks for a constant vertical step between rows four apart needs a
  // mark every dozen px of x, and this is also the band where the floor plane
  // is feathered away and only the haze is left to carry texture.
  ctx.save();
  for (let i = 0; i < 760; i++) {
    const y = FLOOR_Y - 108 + rand() * 150;
    const x = -20 + rand() * (W + 40);
    const up = rand() < 0.5;
    // Sized to SURVIVE the far plane's 6-px bake blur. At 1-3 px these washed
    // out completely at HIGH and the joint band went back to being the
    // smoothest thing in the frame; at 7-14 px they read as thin drifts in the
    // haze and still break every iso-line they cross.
    ctx.globalAlpha = peak * (up ? 0.13 + rand() * 0.17 : 0.1 + rand() * 0.14);
    ctx.fillStyle = up ? color : '#000000';
    ctx.fillRect(x, y, 7 + rand() * 7, 2 + rand() * 2);
  }
  ctx.restore();
}

/**
 * Chips and dust at the base of the wall, on the MID plane. The far plane's
 * 6-px blur softens anything finer than a drift and the floor plane is
 * feathered away across the joint, so the middle depth is the only one that
 * can carry readable texture through the band where wall meets ground — at
 * 2.6 px of bake blur a 4-7 px mark survives with its edge intact.
 */
function jointSpeckle(ctx: CanvasRenderingContext2D, W: number, ink: GroundInk, seed: number, count = 460): void {
  const rand = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    // Biased DOWN onto the ground: a third of these used to land on the wall
    // above the joint, where chips have nothing to lie on and read as specks
    // in the air.
    const y = FLOOR_Y - 34 + rand() * 122;
    const x = -20 + rand() * (W + 40);
    const up = rand() < 0.45;
    // Sized against the MID plane's 2.6-px bake blur: at 4 px these lost most
    // of their contrast to it and the joint band went smooth again at HIGH
    // (the tier where the far plane's own texture is blurred away too). At
    // 6-12 px they survive as chips and dust at the base of the wall.
    ctx.globalAlpha = up ? 0.12 + rand() * 0.15 : 0.14 + rand() * 0.16;
    ctx.fillStyle = up ? ink.lit : ink.dark;
    ctx.fillRect(x, y, 6 + rand() * 6, 2 + rand() * 2.4);
  }
  ctx.restore();
}

// ------------------------------------------------------------ the ground --
//
// `floorGrid` used to be the ONLY texture on the stage floor, and a converging
// lattice under the actors reads as a demo grid, not a place. Everything below
// is the replacement: a seeded scatter of stones, tufts, cracks and debris at
// three sizes and free rotation, denser inside the lit pool and thinning into
// the vignette, under two or three broad scuff bands that follow the stage
// diagonal. All of it runs at BAKE time inside a PlanePainter, so a hundred
// small paths cost nothing at frame time — and the seed makes the same biome
// draw the same ground on every run.

/** Deterministic scatter: same biome, same stones, every run. */
function rng(seed: number): () => number {
  let s = (seed | 0) >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The three tones a ground pass paints with. `lit` and `dark` are one step
 * either side of the floor gradient beneath them — the scatter is 6-10 %
 * contrast, texture the eye finds only once it stops looking at the actors.
 */
interface GroundInk {
  /** The key-lit facet of a lump: one step LIGHTER than the floor under it. */
  lit: string;
  /** The shaded side and the contact shadow: one step DARKER. */
  dark: string;
  /** Cracks, seams and tool marks. */
  seam: string;
}

/**
 * One kind of thing lying on the floor, drawn at the origin in a space the
 * driver has already translated, squashed into perspective and rotated. `s` is
 * the piece's half-width in px; `lift` says whether it stands proud enough to
 * cast (0 = a crack or a stain, 1 = a stone).
 */
interface ScatterKind {
  lift: number;
  draw(ctx: CanvasRenderingContext2D, s: number, rand: () => number, ink: GroundInk): void;
}

/** A soft-edged blob, additive or subtractive — the one shape a scuff band and a stain are both made of. */
function blobAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
  additive: boolean,
): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(0.45, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  if (additive) ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/**
 * A broad worn band sweeping across the floor along the stage diagonal — the
 * large-scale variation that stops a ground gradient reading as one flat
 * sweep. Built from overlapping soft blobs, so both ends feather and there is
 * never an edge to catch.
 */
function scuffBand(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w0: number,
  w1: number,
  color: string,
  alpha: number,
  additive = false,
): void {
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const w = w0 + (w1 - w0) * t;
    blobAt(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w, w * 0.3, color, alpha, additive);
  }
}

// --- the scatter kinds -------------------------------------------------------
// THIRTEEN kinds. Each draws around the origin at roughly +/- s. The key is
// upper LEFT in every biome, so the RULE for the ten SOLID kinds is one line:
// the body is `ink.lit` — the key-lit face, a step brighter than the floor
// beneath — and the shade and the contact go down-and-right in `ink.dark`.
// TWO of them are the exception and draw in `ink.seam`: kCrack and kToolMark
// are cut INTO the floor, not laid on it, so their stroke is the seam tone
// with only a thin lit lip on the key side. (kDrift is a third special case
// for a different reason — a soft smear with no relief, so it carries no
// shade at all.) That split is what makes a hundred unrelated shapes read as
// one lit ground instead of noise.

/** An angular chip of stone: lit crown, shaded lower-right face. */
const kStone: ScatterKind = {
  lift: 1,
  draw(ctx, s, rand, ink) {
    const n = 5 + Math.floor(rand() * 3);
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.5;
      const r = s * (0.62 + rand() * 0.48);
      pts.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    poly(ctx, pts, ink.lit);
    // The shaded face is CLIPPED to the stone; an unclipped quad would paint a
    // dark rectangle across the floor beside it.
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = base * 0.8;
    poly(ctx, [-s * 0.2, -s * 2, s * 2, -s * 2, s * 2, s * 2, -s * 0.9, s * 2], ink.dark);
    ctx.restore();
    ctx.globalAlpha = base;
  },
};

/** A flat flagstone: barely off the floor tone, with a lit up-key edge and a dark seam. */
const kSlab: ScatterKind = {
  lift: 0.45,
  draw(ctx, s, rand, ink) {
    const w = s * (1.1 + rand() * 0.7);
    const h = s * (0.7 + rand() * 0.5);
    const j = () => (rand() - 0.5) * s * 0.3;
    const pts = [-w + j(), -h + j(), w + j(), -h + j(), w + j(), h + j(), -w + j(), h + j()];
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.5;
    poly(ctx, pts, ink.lit);
    ctx.globalAlpha = base;
    ctx.strokeStyle = ink.lit;
    ctx.lineWidth = Math.max(1.2, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[2], pts[3]);
    ctx.stroke();
    ctx.globalAlpha = base * 0.8;
    ctx.strokeStyle = ink.dark;
    ctx.beginPath();
    ctx.moveTo(pts[4], pts[5]);
    ctx.lineTo(pts[6], pts[7]);
    ctx.stroke();
    ctx.globalAlpha = base;
  },
};

/** A crack: two or three segments of a hairline running off in one direction. */
const kCrack: ScatterKind = {
  lift: 0,
  draw(ctx, s, rand, ink) {
    ctx.save();
    ctx.strokeStyle = ink.seam;
    ctx.lineWidth = Math.max(1.2, s * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    let x = -s * 1.4;
    let y = 0;
    ctx.moveTo(x, y);
    const legs = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < legs; i++) {
      x += s * (0.8 + rand() * 0.9);
      y += (rand() - 0.5) * s * 0.7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    // The lit lip along the crack's upper side — a groove, not a drawn line.
    ctx.globalAlpha *= 0.55;
    ctx.strokeStyle = ink.lit;
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.beginPath();
    ctx.moveTo(-s * 1.4, -Math.max(1, s * 0.16));
    ctx.lineTo(x, y - Math.max(1, s * 0.16));
    ctx.stroke();
    ctx.restore();
  },
};

/** A tuft of dry blades fanning from one root, catching the key on its tips. */
const kTuft: ScatterKind = {
  lift: 0.5,
  draw(ctx, s, rand, ink) {
    ctx.save();
    ctx.lineCap = 'round';
    const n = 3 + Math.floor(rand() * 3);
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const t = (i / Math.max(1, n - 1)) * 2 - 1;
      const len = s * (1.2 + rand() * 1);
      ctx.lineWidth = Math.max(1.2, s * 0.2);
      ctx.strokeStyle = i % 2 === 0 ? ink.dark : ink.lit;
      ctx.globalAlpha = i % 2 === 0 ? base : base * 0.85;
      ctx.beginPath();
      ctx.moveTo(t * s * 0.22, s * 0.3);
      ctx.quadraticCurveTo(t * s * 0.5, -len * 0.4, t * s * 1.1, -len);
      ctx.stroke();
    }
    ctx.restore();
  },
};

/** A broken shell: a scallop fan, lit face up, ribs in shade. */
const kShell: ScatterKind = {
  lift: 0.8,
  draw(ctx, s, rand, ink) {
    const r = s * (0.85 + rand() * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.5);
    ctx.arc(0, r * 0.5, r, Math.PI * 1.12, Math.PI * 1.88);
    ctx.closePath();
    ctx.fillStyle = ink.lit;
    ctx.fill();
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.7;
    ctx.strokeStyle = ink.dark;
    ctx.lineWidth = Math.max(1, s * 0.12);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, r * 0.5);
      ctx.lineTo(i * r * 0.34, r * 0.5 - r * 0.92);
      ctx.stroke();
    }
    ctx.globalAlpha = base;
  },
};

/** A drift of silt or ash: a soft flat smear with no edge at all. */
const kDrift: ScatterKind = {
  lift: 0,
  draw(ctx, s, rand, ink) {
    blobAt(ctx, 0, 0, s * (1.6 + rand() * 1.1), s * (0.5 + rand() * 0.4), ink.lit, ctx.globalAlpha * 0.75, false);
    blobAt(ctx, s * 0.5, s * 0.35, s * (0.8 + rand() * 0.6), s * 0.3, ink.dark, ctx.globalAlpha * 0.45, false);
  },
};

/** A shard of pearl or glass: a thin sliver, one bright face and one in shade. */
const kShard: ScatterKind = {
  lift: 0.7,
  draw(ctx, s, rand, ink) {
    const w = s * (1.2 + rand() * 0.8);
    const h = s * (0.34 + rand() * 0.34);
    poly(ctx, [-w, 0, -w * 0.2, -h, w, -h * 0.4, w * 0.4, h], ink.lit);
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.6;
    poly(ctx, [-w * 0.2, -h * 0.1, w, -h * 0.4, w * 0.4, h], ink.dark);
    ctx.globalAlpha = base;
  },
};

/** A cinder: a hot speck ringed by the ash it burned out of. */
const kCinder: ScatterKind = {
  lift: 0.3,
  draw(ctx, s, rand, ink) {
    const base = ctx.globalAlpha;
    blobAt(ctx, 0, 0, s * 1.7, s * 0.7, ink.dark, base * 0.75, false);
    ctx.globalAlpha = base * (0.6 + rand() * 0.4);
    ctx.fillStyle = ink.lit;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1.2, s * 0.42), Math.max(1, s * 0.26), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = base;
  },
};

/** Tool marks: two or three short parallel gouges struck in the same pass. */
const kToolMark: ScatterKind = {
  lift: 0,
  draw(ctx, s, rand, ink) {
    ctx.save();
    ctx.lineCap = 'round';
    const n = 2 + Math.floor(rand() * 2);
    const base = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * s * 0.55;
      const x0 = -s * (0.9 + rand() * 0.4);
      const x1 = s * (0.9 + rand() * 0.4);
      const dy = (rand() - 0.5) * s * 0.2;
      ctx.strokeStyle = ink.seam;
      ctx.lineWidth = Math.max(1.2, s * 0.16);
      ctx.globalAlpha = base;
      ctx.beginPath();
      ctx.moveTo(x0, off);
      ctx.lineTo(x1, off + dy);
      ctx.stroke();
      // The burr the chisel threw up, on the key side of the groove.
      ctx.strokeStyle = ink.lit;
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.globalAlpha = base * 0.6;
      ctx.beginPath();
      ctx.moveTo(x0, off - Math.max(1, s * 0.16));
      ctx.lineTo(x1, off + dy - Math.max(1, s * 0.16));
      ctx.stroke();
    }
    ctx.restore();
  },
};

/** A small block of fallen masonry: a lit top face over a shaded front. */
const kBrick: ScatterKind = {
  lift: 1,
  draw(ctx, s, rand, ink) {
    const w = s * (1 + rand() * 0.6);
    const h = s * (0.55 + rand() * 0.4);
    const d = s * 0.45;
    poly(ctx, [-w, -h + d, -w + d, -h, w + d * 0.4, -h, w, -h + d], ink.lit);
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.85;
    poly(ctx, [-w, -h + d, -w, h, w, h, w, -h + d], ink.dark);
    ctx.globalAlpha = base;
  },
};

/** A lump of slag: a cooled pour, dull grey crown with a dark underside. */
const kSlag: ScatterKind = {
  lift: 1,
  draw(ctx, s, rand, ink) {
    const n = 7;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = s * (0.55 + rand() * 0.75);
      pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.85);
    }
    poly(ctx, pts, ink.lit);
    const base = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = base * 0.8;
    poly(ctx, [-s * 2, s * 0.12, s * 2, s * 0.02, s * 2, s * 2, -s * 2, s * 2], ink.dark);
    ctx.restore();
    ctx.globalAlpha = base;
  },
};

/** A puddle: dark water with the sky caught along its far lip. */
const kPuddle: ScatterKind = {
  lift: 0,
  draw(ctx, s, rand, ink) {
    const n = 8;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = s * (1.2 + rand() * 0.9);
      pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.45);
    }
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.9;
    poly(ctx, pts, ink.dark);
    // The reflected bolt: a bright broken streak, never a filled sheet.
    ctx.globalAlpha = base;
    ctx.strokeStyle = ink.lit;
    ctx.lineWidth = Math.max(1.4, s * 0.24);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, -s * 0.14);
    ctx.lineTo(s * 0.45, -s * 0.28);
    ctx.stroke();
    ctx.globalAlpha = base * 0.5;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, s * 0.16);
    ctx.lineTo(s * 0.85, s * 0.08);
    ctx.stroke();
    ctx.globalAlpha = base;
  },
};

/** A wet slab: a flagstone with a specular sheen along its far edge. */
const kWetStone: ScatterKind = {
  lift: 0.6,
  draw(ctx, s, rand, ink) {
    const w = s * (1.2 + rand() * 0.6);
    const h = s * (0.7 + rand() * 0.4);
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.55;
    poly(ctx, [-w, -h, w, -h * 0.8, w * 0.9, h, -w * 0.95, h * 0.85], ink.lit);
    ctx.globalAlpha = base;
    ctx.strokeStyle = ink.lit;
    ctx.lineWidth = Math.max(1.4, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(-w * 0.85, -h * 0.85);
    ctx.lineTo(w * 0.8, -h * 0.7);
    ctx.stroke();
    ctx.globalAlpha = base * 0.85;
    ctx.strokeStyle = ink.dark;
    ctx.lineWidth = Math.max(1, s * 0.16);
    ctx.beginPath();
    ctx.moveTo(-w * 0.9, h * 0.85);
    ctx.lineTo(w * 0.85, h * 0.95);
    ctx.stroke();
    ctx.globalAlpha = base;
  },
};

/**
 * GRAIN. The scatter puts objects on the ground; without this the plane
 * BETWEEN them is a bare gradient, so the floor reads as debris lying on a
 * wash rather than as continuous ground. Around 1200 marks a pixel or two
 * across, half lifting and half sinking by a few L, scaled by depth and denser
 * toward the camera where the eye can resolve them. It is also what keeps a
 * smooth vertical ramp from measuring as one unbroken horizontal edge: grain
 * breaks every iso-line it crosses.
 */
function groundGrain(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  ink: GroundInk,
  seed: number,
  count = 1200,
  strength = 1,
): void {
  const rand = rng(seed);
  const top = FLOOR_Y - 8;
  const depth = H + 20 - top;
  ctx.save();
  for (let i = 0; i < count; i++) {
    const t = Math.sqrt(rand());
    const y = top + t * depth;
    const x = -20 + rand() * (W + 40);
    const sz = 1 + t * 2.4 * (0.6 + rand() * 0.8);
    const up = rand() < 0.5;
    ctx.globalAlpha = strength * (up ? 0.05 + rand() * 0.08 : 0.06 + rand() * 0.1);
    ctx.fillStyle = up ? ink.lit : ink.dark;
    ctx.fillRect(x, y, sz * (1 + rand()), Math.max(1, sz * 0.7));
  }
  // A second, FINER pass over the first 130 px of ground. The main field is
  // depth-weighted toward the camera, which leaves the band right under the
  // wall — the busiest 130 px in the frame, and the one the wall/floor joint
  // runs through — almost bare. It is also the band where a smooth ramp of
  // sky, haze and pool light stacks into a vertical step big enough to read as
  // one continuous horizontal edge across the whole width; grain at roughly a
  // mark every 15 px of x breaks every such iso-line without being visible as
  // anything but texture.
  // The band runs from ABOVE the joint (the floor plane starts JOINT_LIFT px
  // up and is feathered in across it) down through the first 140 px of ground.
  // It has to live on THIS plane: the far plane's 6-px bake blur erases grain
  // this fine, so at HIGH only the floor's own 1.25-px blur preserves it, and
  // HIGH is the tier where the feather zone would otherwise be the smoothest
  // thing in the frame.
  const bandN = Math.round(count * 0.85);
  for (let i = 0; i < bandN; i++) {
    const y = FLOOR_Y - JOINT_LIFT - 4 + rand() * 196;
    const x = -20 + rand() * (W + 40);
    const up = rand() < 0.5;
    ctx.globalAlpha = strength * (up ? 0.1 + rand() * 0.1 : 0.11 + rand() * 0.11);
    ctx.fillStyle = up ? ink.lit : ink.dark;
    ctx.fillRect(x, y, 1 + rand() * 2.2, 1 + rand());
  }
  ctx.restore();
}

// ------------------------------------------------- the ground, in PIXELS --
//
// Everything above this line is SOFT ground: gradients, blobs, rotated paths
// at 6-10 % contrast. Round 3 measured what that costs — the floor's whole
// p10->p90 range was 4.4 L in the near band and 11.8 in the mid, against
// `octopath-4`'s 30.8 / 51.9 — and named the consequence: "the scatter is
// there, the VALUES are not, so the floor reads as an airbrush and the razor
// sharp actors read as pasted onto it".
//
// This is the answer, and it is a different KIND of mark. The reference's
// ground is pixel art at the sprites' own cell size: in `octopath-4` the sand
// carries stones with a lit crown and a dark bed, wheel ruts, dry tufts and a
// scuffed lane, all of them 2-3 sprite-pixels across; in `octopath-2` a night
// forest still holds its near ground at p50 45.8 because the dirt strip in
// front of the party is hard-edged tufts over a warm bed. So the floor plane
// draws on the ACTOR's grid — `CELL = ACTOR_SCALE` — with every rect snapped
// to it, and `engine/light.ts` bakes that plane with NO blur and NO pad scale
// (`BLUR_FLOOR = 0`, `bakePlane(..., crisp)`) so the cells survive to the
// screen whole. DESIGN.md's "exactly one plane is pixelated" is amended to
// name the floor as the second: FAR and MID keep their 6-px and 2.6-px blur,
// which is the depth-of-field split the rule was really protecting.
//
// The other half of the round-3 note is COLOUR: "the crypt floor is satMean
// 13.4 where all three references' grounds run 25-78. Put a second hue into
// the floor (a cool stone against the amber pool) rather than tinting the
// whole plane one temperature." Hence `PixelInk`'s two families — a warm pair
// and a cool pair — chosen per piece by whether it lies inside a light pool.

/** The actor's own cell (game/art/actors.ts ACTOR_SCALE). Every mark below is a whole number of these. */
const CELL = 2;

/** Snap to the cell grid. Off-grid rects are what a 2-px ground loses its edges to. */
function q(v: number): number {
  return Math.round(v / CELL) * CELL;
}

/**
 * The five tones a pixel ground is drawn with. `lit`/`bed` are the two ends of
 * ONE stone — a crown catching the key and the shadow it sits in — and the gap
 * between them is the 25-40 % local contrast the brief asks for, not the 6-10 %
 * the soft scatter above uses. `cool` and `coolLit` are the same pair in the
 * opposing temperature, so the ground has two hues rather than one tint.
 */
interface PixelInk {
  /** The lit crown of a warm stone: the brightest ground value in the frame. */
  lit: string;
  /** Its body. */
  mid: string;
  /** The bed it sits in, and the ruts. */
  bed: string;
  /** The opposing family's body — cool stone against a warm pool, warm silt in a cold room. */
  cool: string;
  /** That family's lit crown. */
  coolLit: string;
}

interface PixelGroundOptions {
  seed: number;
  ink: PixelInk;
  /** Stones to lay. The six biomes run 900-1300. */
  count: number;
  /** First row of ground (default FLOOR_Y + 4). */
  top?: number;
  /** The two lit pools, [x, y, rx, ry] — inside them a piece is warm and brighter. */
  pools?: readonly (readonly [number, number, number, number])[];
  /** 0..1 — how many pieces are the OPPOSING family outside the pools (default 0.55). */
  coolShare?: number;
  /** Ruts / cracks cut into the bed. Default count * 0.16. */
  ruts?: number;
  /** Standing matter — dry tufts, reeds, cinders. Default count * 0.1; 0 for a stone floor. */
  tufts?: number;
  /** Global alpha multiplier (0.85-1.1). */
  strength?: number;
}

/**
 * Is (x, y) inside one of the lit pools, and how deep? 1 at a pool's centre,
 * 0 outside every pool. Drives BOTH the temperature choice and the value: a
 * stone in the pool gets its lit crown, one in the vignette keeps its bed.
 */
function poolAt(pools: readonly (readonly [number, number, number, number])[] | undefined, x: number, y: number): number {
  if (!pools || !pools.length) return 0;
  let best = 0;
  for (const [px, py, prx, pry] of pools) {
    const d = Math.hypot((x - px) / prx, (y - py) / pry);
    const w = d >= 1 ? 0 : 1 - d * d;
    if (w > best) best = w;
  }
  return best;
}

/**
 * Broad, slow variation across the plane, 0..1. Two crossed sines at
 * incommensurate wavelengths: enough to break an even field into calm and busy
 * regions the size of a prop, which is the scale the references vary at. A
 * uniform grain over 1280 px reads as film noise; a modulated one reads as
 * ground. Cheap, seedable and no allocation.
 */
function broad(x: number, y: number, phase: number): number {
  const a = Math.sin(x * 0.0121 + y * 0.0247 + phase);
  const b = Math.cos(x * 0.0057 - y * 0.0138 + phase * 1.7);
  return 0.5 + 0.5 * (a * 0.6 + b * 0.4);
}

/**
 * The ground, authored at the actor's cell. Four marks, one seeded pass:
 *
 *  - STONES. A body of 2-7 cells by 1-3, a crown row on top in `lit` (the key
 *    is upper-left in every biome, so the crown is the top and the left cell)
 *    and a bed row under and right of it in `bed`. Three marks, ~30 % apart in
 *    value: that is the whole difference between this and a 6 % fleck.
 *  - RUTS. One-cell-tall runs of `bed` following the perspective — the grooves
 *    a floor gets from being walked and dragged over.
 *  - TUFTS. One-cell stalks of dry matter standing 2-4 cells proud, leaning.
 *  - THE LANE. A scuffed diagonal from the enemy rank to the party's — the
 *    reference's worn path, drawn as a denser field of crowns rather than as
 *    another soft band.
 *
 * All of it is bake time: ~4000 snapped fillRects per biome, once.
 */
function pixelGround(ctx: CanvasRenderingContext2D, W: number, H: number, o: PixelGroundOptions): void {
  const rand = rng(o.seed);
  const ink = o.ink;
  const top = o.top ?? FLOOR_Y + 4;
  const depth = H + 16 - top;
  const strength = o.strength ?? 1;
  const coolShare = o.coolShare ?? 0.55;
  ctx.save();

  // --- the grain, first: the ground's OWN texture at the cell ---------------
  // Without this every mark below floats on an airbrush: the first pass of the
  // pixel ground put stones on a smooth lavender field and read as confetti on
  // a gradient. The reference's sand is noisy at the sprite's own cell before
  // a single stone is laid on it, and half of `octopath-4`'s ground chroma is
  // here rather than in the pebbles. Drawn as short 1-3 cell runs so the mark
  // count stays in the low thousands at bake time.
  {
    const rows = Math.ceil((H + 12 - top) / CELL);
    for (let r = 0; r < rows; r++) {
      const y = q(top + r * CELL);
      const t = (y - top) / Math.max(1, depth);
      // Denser and coarser toward the camera; the far rows are nearly smooth.
      // HALVED again in round 4's fix pass: at 0.2-0.46 of a row the near band
      // read as static rather than as ground at 1x (`c-A-botleft.png`), because
      // a single-cell mark repeated every few pixels is noise however well its
      // values are chosen. The value now comes from the STONES below, which are
      // bigger and clumped; the grain is only the tone between them.
      // ...and the ramp INVERTS. Up-stage the plane is compressed into a few
      // rows and the grain is the only thing that can carry its range; at the
      // camera the stones are four times the size and carry it themselves, so
      // grain there only competes with them. Dense at the wall, sparse at the
      // front — the opposite of the first pass, and the reason the vault's
      // near ground stopped reading as a field of dark chips.
      const per = Math.round((W / CELL) * (0.19 - t * 0.09));
      for (let i = 0; i < per; i++) {
        const x = q(-12 + rand() * (W + 24));
        const bn = broad(x, y, o.seed & 7);
        // The broad field GATES, it does not merely weight. An ungated grain
        // at this density is television static — every square inch equally
        // busy, which is the one thing `octopath-4`'s sand never is: it swings
        // between scoured, almost smooth sweeps and beds of visible grit, at
        // the scale of a prop. Below the knee the row is left alone.
        // The knee is higher too: below it the row is left completely alone, so
        // the plane keeps swept, quiet ground between the busy beds.
        if (bn < 0.46 || rand() > (bn - 0.4) * 1.8) continue;
        const w = poolAt(o.pools, x, y);
        const roll = rand();
        const warm = w > 0.14 ? roll < 0.72 : roll < 1 - coolShare;
        // More DARK marks up-stage, more lit ones forward: the mid band is the
        // one the feet sit in and it measured the least range of the three.
        const up = rand() < 0.09 + t * 0.13;
        // A mark GROWS as the plane comes forward — that ramp is the whole of
        // a receding texture. One cell at the wall line, up to five by two at
        // the camera; a constant 2-px fleck across 300 px of depth reads as
        // noise laid over a photograph rather than as ground going away.
        const mw = CELL * (1 + Math.floor(rand() * (1.6 + t * 3.4)));
        const mh = CELL * (t > 0.58 && rand() < 0.42 ? 2 : 1);
        // The (1 - t) term lifts the FAR rows' contrast: up-stage the plane is
        // compressed into a few rows and a flat grain there measured 11.8 L of
        // range against the near band's 30.
        const a0 = strength * (up ? 0.14 + rand() * 0.3 : 0.2 + rand() * 0.44) * (0.55 + w * 0.55) * (0.5 + bn * 0.8) * (1 + (1 - t) * 1.1);
        if (up) {
          // A LIT mark is NEVER alone. On its own a bright cell on a smooth
          // field is confetti — which is what the first pass of this read as
          // on `bd-SKY_RUINS.png`, a hundred loose warm flecks with nothing
          // under them. Paired with a bed cell in the row beneath, the same
          // two marks are a grain of ground catching the key and casting its
          // own shadow, and the eye reads FORM instead of noise. Same rule as
          // the stones below, at one third the size.
          ctx.globalAlpha = Math.min(1, a0 * 1.15);
          ctx.fillStyle = ink.bed;
          ctx.fillRect(x, y + mh, mw, CELL);
        }
        ctx.globalAlpha = a0;
        ctx.fillStyle = up ? (warm ? ink.lit : ink.coolLit) : ink.bed;
        ctx.fillRect(x, y, mw, mh);
      }
    }
  }

  // --- the scuffed lane, first: everything else lies on top of it ----------
  // From the enemy rank's far seat to the party's near one, widening as it
  // comes forward. Drawn as crowns at ~35 % density, so it is a WORN band of
  // the same pixels as the rest of the floor and not a soft airbrushed streak.
  {
    // A SCUFF, not a dot. Round 4's first pass laid 400-600 single crowns along
    // the diagonal and they read as loose sparks scattered over the ground —
    // most of what made the marsh's near band look like spilled grain. Half the
    // count now, and each sample lays two or three marks in a short run, which
    // is what a heel actually leaves.
    const laneN = Math.round(o.count * 0.26);
    for (let i = 0; i < laneN; i++) {
      const t = rand();
      const cx = 250 + t * 700;
      const cy = FLOOR_Y + 26 + t * (H - FLOOR_Y - 40);
      const spread = 46 + t * 150;
      const x0 = cx + (rand() - 0.5) * spread * 2;
      const y0 = cy + (rand() - 0.5) * spread * 0.5;
      if (y0 < top || y0 > H + 8) continue;
      const dn = Math.min(1, Math.abs((x0 - cx) / spread));
      if (rand() < dn * dn) continue;
      const w = poolAt(o.pools, x0, y0);
      const warm = w > 0.12 || rand() > coolShare;
      const a0 = strength * (0.2 + rand() * 0.34) * (0.55 + w * 0.7) * (1 - dn * 0.6);
      const runs = 2 + Math.floor(rand() * 2);
      let x = x0;
      let y = y0;
      for (let k = 0; k < runs; k++) {
        const len = CELL * (2 + Math.floor(rand() * 3));
        if (y < top || y > H + 8) break;
        // Crown over bed, the same pairing the grain and the stones use: a worn
        // lane is scuffed GROUND, not a dusting of loose sparks.
        ctx.globalAlpha = Math.min(1, a0 * 0.9);
        ctx.fillStyle = ink.bed;
        ctx.fillRect(q(x), q(y) + CELL, len, CELL);
        ctx.globalAlpha = a0;
        ctx.fillStyle = warm ? ink.lit : ink.coolLit;
        ctx.fillRect(q(x), q(y), len, CELL);
        x += len + CELL * (rand() < 0.5 ? 0 : 1);
        y += CELL * (rand() < 0.6 ? 1 : 0);
      }
    }
  }

  // --- gravel beds ----------------------------------------------------------
  // The reference's ground is not an even sprinkle: `octopath-4`'s sand has
  // PATCHES — a bed of dark pebbles here, a scoured lighter sweep there — and
  // the patches are most of its p10->p90. Each one is an irregular field of
  // bed-toned cells with a few crowns caught in it.
  {
    const n = Math.round(o.count * 0.035) + 12;
    for (let i = 0; i < n; i++) {
      const t = rand() < 0.56 ? rand() * 0.42 : Math.sqrt(rand());
      const cx = -40 + rand() * (W + 80);
      const cy = top + t * depth;
      const rx = (26 + rand() * 62) * (0.6 + t);
      const ry = rx * (0.26 + t * 0.2);
      const dark = rand() < 0.62;
      // Half the cells of round 4's first pass: a patch is a BED of gravel,
      // and a bed is a few dozen visible pieces, not a few hundred dots.
      const cells = Math.round(rx * ry * 0.024);
      for (let k = 0; k < cells; k++) {
        const a2 = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand());
        const x = q(cx + Math.cos(a2) * rx * rr);
        const y = q(cy + Math.sin(a2) * ry * rr);
        if (y < top - 6 || y > H + 8) continue;
        const w = poolAt(o.pools, x, y);
        const cw = CELL * (2 + (rand() < 0.4 ? 1 : 0));
        const a0 = strength * (0.36 + rand() * 0.5) * (dark ? 1 : 0.42 + w * 0.5);
        if (!dark) {
          ctx.globalAlpha = Math.min(1, a0);
          ctx.fillStyle = ink.bed;
          ctx.fillRect(x, y + CELL, cw, CELL);
        }
        ctx.globalAlpha = a0;
        ctx.fillStyle = dark ? ink.bed : w > 0.2 ? ink.lit : ink.coolLit;
        ctx.fillRect(x, y, cw, CELL);
      }
    }
  }

  // --- stones ---------------------------------------------------------------
  // In CLUMPS. Rubble collects where rubble already is; an even sprinkle of
  // single stones reads as confetti, which is what the first pass of this
  // looked like on `bd-EMBER_CRYPT.png`.
  let placed = 0;
  let guard = 0;
  while (placed < o.count && guard < o.count * 12) {
    guard++;
    // Depth-weighted toward the camera, the way a receding plane's texture
    // gets bigger and sparser as it comes forward.
    // A third of the pieces are pulled UP-STAGE deliberately: sqrt() alone
    // biases everything to the camera and left the mid ground — the band the
    // actors' feet sit in — measuring 11.8 L of range against the near band's.
    const t = rand() < 0.36 ? rand() * 0.42 : Math.sqrt(rand());
    const ay = top + t * depth;
    const ax = -24 + rand() * (W + 48);
    const w0 = poolAt(o.pools, ax, ay);
    // Thin toward the vignette: the frame's edges are dark in every reference.
    const edge = Math.max(0.24, Math.min(1, Math.min(ax + 60, W - ax + 60) / 260));
    if (rand() > (0.36 + w0 * 0.64) * edge) continue;
    // Rubble collects: three quarters of the pieces come in a pile, and the
    // pile is tighter than it was so it reads as ONE object with parts rather
    // than as five pebbles that happen to be near each other.
    const clump = rand() < 0.74 ? 2 + Math.floor(rand() * 5) : 1;
    const spread = (9 + t * 26);
    for (let c = 0; c < clump && placed < o.count; c++) {
      placed++;
      const x = q(c === 0 ? ax : ax + (rand() - 0.5) * spread * 2);
      const y = q(c === 0 ? ay : ay + (rand() - 0.5) * spread * 0.55);
      if (y > H + 10 || y < top - 8) continue;
      const w = poolAt(o.pools, x, y);
      const warm = w > 0.16 || rand() > coolShare;
      const body = warm ? ink.mid : ink.cool;
      const crown = warm ? ink.lit : ink.coolLit;
      // TWO cells minimum, up to seven by four at the camera. A one-cell stone
      // is indistinguishable from a grain of the field it lies on, and a
      // thousand of them is the static the fix pass was called on.
      const cw = CELL * (2 + Math.floor(rand() * (1.6 + t * 5)));
      const ch = CELL * (1 + Math.floor(rand() * (1.4 + t * 2.6)));
      const a = strength * (0.6 + 0.4 * w) * (0.72 + rand() * 0.42);
      // The BED first — down and right of the stone, one cell proud on each
      // side, because the key is upper left in every biome. This is the dark
      // half of the 25-40 % local contrast; without it a crown is a fleck.
      ctx.globalAlpha = Math.min(1, a * 1.05);
      ctx.fillStyle = ink.bed;
      ctx.fillRect(x + CELL, y + CELL, cw, ch);
      // The body.
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = body;
      ctx.fillRect(x, y, cw, ch);
      // The crown: the top row, and the left cell of the row under it. Two
      // marks is what turns a rectangle into a lit face and a shaded one.
      ctx.globalAlpha = Math.min(1, a * (0.9 + rand() * 0.3));
      ctx.fillStyle = crown;
      ctx.fillRect(x, y, cw - (rand() < 0.5 ? CELL : 0), CELL);
      if (ch > CELL) ctx.fillRect(x, y + CELL, CELL, CELL);
    }
  }

  // --- ruts -----------------------------------------------------------------
  {
    const n = o.ruts ?? Math.round(o.count * 0.2);
    for (let i = 0; i < n; i++) {
      const t = rand() < 0.62 ? rand() * 0.42 : Math.sqrt(rand());
      let y = q(top + t * depth);
      let x = q(-20 + rand() * (W + 40));
      const len = 3 + Math.floor(rand() * (5 + t * 9));
      // Ruts run TOWARD the camera, so they lean away from the vanishing point.
      const lean = (x - VP_X) / (W * 0.5);
      ctx.globalAlpha = strength * (0.42 + rand() * 0.48) * (1 + (1 - t) * 0.55);
      ctx.fillStyle = ink.bed;
      for (let k = 0; k < len; k++) {
        ctx.fillRect(x, y, CELL * (1 + (rand() < 0.3 ? 1 : 0)), CELL);
        x = q(x + lean * CELL * (0.6 + rand() * 1.2));
        y += CELL;
        if (y > H + 8) break;
      }
    }
  }

  // --- tufts ----------------------------------------------------------------
  {
    const n = o.tufts ?? Math.round(o.count * 0.1);
    for (let i = 0; i < n; i++) {
      const t = Math.sqrt(rand());
      const y = q(top + 10 + t * depth * 0.98);
      const x = q(-16 + rand() * (W + 32));
      if (y > H + 6) continue;
      const w2 = poolAt(o.pools, x, y);
      const edge = Math.max(0.2, Math.min(1, Math.min(x + 60, W - x + 60) / 240));
      if (rand() > (0.3 + w2 * 0.7) * edge) continue;
      if (rand() > 0.2 + broad(x, y, (o.seed >> 3) & 7) * 1.0) continue;
      const h = 2 + Math.floor(rand() * (1 + t * 2));
      const lean = rand() < 0.5 ? -1 : 1;
      const warm = w2 > 0.18 || rand() > coolShare;
      ctx.globalAlpha = strength * (0.45 + 0.5 * w2) * (0.6 + rand() * 0.5);
      // The stalk's own shadow on the bed, then the stalk, then its lit tip.
      ctx.fillStyle = ink.bed;
      ctx.fillRect(x + CELL, y, CELL, CELL);
      ctx.fillStyle = warm ? ink.mid : ink.cool;
      for (let k = 0; k < h; k++) ctx.fillRect(x + (k > h * 0.6 ? lean * CELL : 0), y - k * CELL, CELL, CELL);
      ctx.fillStyle = warm ? ink.lit : ink.coolLit;
      ctx.fillRect(x + (h > 1 ? lean * CELL : 0), y - (h - 1) * CELL, CELL, CELL);
    }
  }
  ctx.restore();
}

/**
 * A mass that CATCHES the well. Round 3's Scene item 3: every crypt mid mass
 * sat at p50 14.4-27.1, where `octopath-3`'s neighbouring masses spread 34 to
 * 79 — a 45 L order between one house and the next against our 13. Nothing in
 * our mid plane was lit; every one of them was a silhouette at the same value.
 *
 * So each biome gets two of these, flanking the centre under its light well:
 * a tall mass whose UPPER two thirds are painted at the well's own value and
 * whose base falls away into the plane's ink, with a hard break between them.
 * The lit half is deliberately above the actors' heads (`litTo` defaults to
 * y 250, and the tallest head on the stage tops out near 270), so the mid plane
 * gains its value order without putting a bright patch behind a face.
 */
function litPylon(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  top: number,
  lit: string,
  dark: string,
  rim: string,
  litTo = 250,
): void {
  const hw = w / 2;
  const pts = [x - hw, baseY, x - hw * 0.88, top, x + hw * 0.88, top, x + hw, baseY];
  poly(ctx, pts, dark);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, litTo + 40);
  g.addColorStop(0, lit);
  g.addColorStop(0.62, lit);
  g.addColorStop(0.88, hexA(lit, 0.35));
  g.addColorStop(1, hexA(lit, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - hw - 4, top - 4, w + 8, litTo + 44 - top);
  // the shaded flank: the well is overhead and slightly left of these, so the
  // right cheek of each falls away.
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = dark;
  ctx.fillRect(x + hw * 0.24, top - 4, hw, baseY - top + 8);
  ctx.restore();
  rimEdge(ctx, [x - hw * 0.88, top, x + hw * 0.88, top], rim, 0.5, 2);
}

/**
 * Broad, soft mottle across the upper band — cloud, vault haze, smoke.
 *
 * It is here for a measurement as much as for the look. A `vgrad` is a
 * perfectly horizontal ramp: every row differs from the row above it by the
 * same amount right across 1280 px, which is the definition of a straight
 * edge, and once round 6 lifted the top band the per-row step crossed the
 * detector's 1.5-L threshold and the longest straight run went 211 px -> 421.
 * Ten overlapping ellipses at 2-5 L of contrast break every row without
 * changing a single percentile: the air stops being a gradient and starts
 * being weather.
 */
function skyMottle(
  ctx: CanvasRenderingContext2D,
  W: number,
  bandH: number,
  light: string,
  dark: string,
  alpha: number,
  seed: number,
  count = 12,
  bandY = 0,
): void {
  const rand = rng(seed);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = -120 + rand() * (W + 240);
    const y = bandY - 40 + rand() * (bandH + 60);
    const rx = 130 + rand() * 260;
    const ry = rx * (0.24 + rand() * 0.3);
    const up = rand() < 0.5;
    blobAt(ctx, x, y, rx, ry, up ? light : dark, alpha * (0.5 + rand()), false);
  }
  ctx.restore();
}

/**
 * A LIGHT WELL — the bright opening every diorama was missing.
 *
 * Round 3 of the full-frame review measured the hole precisely: every biome's
 * top 180 px sat at p50 14.6-22.2 with 76-97 % of it below L 35, where
 * `octopath-4`'s sky reads 55.5 and `octopath-3`'s 37.4; the frame carried
 * 0.7 % of its pixels above L 75 against their 31.7 % and 6.8 %; the centre
 * third led the left by 1.7 L against their +27 and +26; and the largest bright
 * mass in every battle frame was a patch of EMPTY FOREGROUND FLOOR at
 * y 610-697, where both references put a lit gap BEHIND the actors. All four
 * are the same absence: there is nothing in the air for a figure to read
 * against, so the actors are lit shapes on a dark ground instead of dark
 * shapes against a bright one.
 *
 * So each biome gets one, high and CENTRED — a broken vault, a cloud break, a
 * roof light, the water's surface. `rx`/`ry` are the hot core; the halo reaches
 * `spread x` further and carries the glow into the haze. Drawn on the FAR
 * plane, which keeps its 6-px blur, so it is air and not an object.
 */
function lightWell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  core: string,
  halo: string,
  alpha = 1,
  spread = 2.4,
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  // the reach, first: a wide soft bloom that lifts the whole top band
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * spread);
  g.addColorStop(0, hexA(halo, 0.5));
  g.addColorStop(0.34, hexA(halo, 0.22));
  g.addColorStop(0.7, hexA(halo, 0.06));
  g.addColorStop(1, hexA(halo, 0));
  ctx.translate(x, y);
  ctx.scale(1, (ry * spread) / (rx * spread));
  ctx.fillStyle = g;
  ctx.fillRect(-rx * spread, -rx * spread, rx * spread * 2, rx * spread * 2);
  ctx.restore();
  // ...then the core, opaque enough to clear L 75 through the grade's multiply
  ctx.save();
  ctx.globalAlpha = alpha;
  const c = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  c.addColorStop(0, core);
  c.addColorStop(0.52, core);
  c.addColorStop(0.78, hexA(core, 0.55));
  c.addColorStop(1, hexA(core, 0));
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = c;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Straight shafts falling out of a light well, fanning slightly as they drop. */
function wellShafts(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  spread: number,
  len: number,
  color: string,
  alpha: number,
  seed: number,
): void {
  const rand = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x0 = x + (t - 0.5) * spread;
    const w0 = 12 + rand() * 26;
    const lean = (t - 0.5) * 118;
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, hexA(color, alpha));
    g.addColorStop(0.45, hexA(color, alpha * 0.42));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - w0 * 0.4, y);
    ctx.lineTo(x0 + w0 * 0.4, y);
    ctx.lineTo(x0 + lean + w0 * 1.5, y + len);
    ctx.lineTo(x0 + lean - w0 * 1.5, y + len);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The dark foreground corner the command list is read against. The skill rows
 * live at x 24-344, y 535-670 and the log at x 360-930, y 545-580; a lit floor
 * running under either makes 18-px vector text fight the ground for the same
 * pixels. This sinks the bottom-left corner (and, more gently, the
 * bottom-right) with a soft radial that has no edge of its own, which is also
 * what the reference frames do — their darkest band is the near ground.
 */
function readingShade(ctx: CanvasRenderingContext2D, W: number, H: number, ink: string, strength = 1): void {
  // Cut to a third of its old weight, and pulled into the two bottom CORNERS.
  // At 0.62 over a 470-px radius this was a second floorLip: between the two
  // of them the bottom quarter of every frame measured darker than the mid
  // ground, and a corridor of shadow ran under the party's own feet. The
  // command list is read against `screens/hud.ts`'s plate; the floor's job is
  // to be the ground the actors stand on.
  blobAt(ctx, -10, H + 30, 400, 250, ink, 0.52 * strength, false);
  blobAt(ctx, 120, H - 10, 260, 150, ink, 0.26 * strength, false);
  blobAt(ctx, W + 10, H + 46, 330, 200, ink, 0.26 * strength, false);
}

/** Where a ground pass thins out: the pool it crowds into, in logical px. */
interface ScatterOptions {
  seed: number;
  /** Pieces to place. The six biomes run 108-132. */
  count: number;
  kinds: readonly ScatterKind[];
  ink: GroundInk;
  /** First row of ground (default FLOOR_Y + 6). */
  top?: number;
  /** Density centre — the lit pool: [x, y, rx, ry]. */
  pool?: readonly [number, number, number, number];
  /** Size multiplier over the built-in perspective ramp. */
  scale?: number;
  /**
   * Contrast multiplier. The default lands the scatter in the brief's 6-10 %
   * band against the floor beneath, PROVIDED `ink.lit` and `ink.dark` are one
   * step either side of the floor gradient — the ink carries the contrast,
   * this only shades it by pool proximity.
   */
  alpha?: number;
}

/**
 * Scatter one biome's ground litter across the floor plane. Placement is
 * rejection-sampled against two weights — denser inside the lit pool, thinner
 * toward the vignette at the frame edges — and every piece is scaled by its
 * distance down the plane, so the same kind reads small and crowded at the
 * wall and large and sparse at the camera.
 */
function scatterGround(ctx: CanvasRenderingContext2D, W: number, H: number, o: ScatterOptions): void {
  const rand = rng(o.seed);
  const top = o.top ?? FLOOR_Y + 2;
  const [px, py, prx, pry] = o.pool ?? [640, 486, 400, 120];
  const sizeMul = o.scale ?? 1;
  const alphaMul = o.alpha ?? 0.5;
  const depth = H + 24 - top;
  let placed = 0;
  let guard = 0;
  ctx.save();
  while (placed < o.count && guard < o.count * 40) {
    guard++;
    // Toward the middle distance: the wall is too hazy to carry detail and the
    // very front of the plane is where the actors' own shadows land.
    const t = (rand() + rand() * 0.9) / 1.9;
    const y = top + t * depth;
    const x = -40 + rand() * (W + 80);
    const dn = Math.hypot((x - px) / prx, (y - py) / pry);
    const poolW = dn <= 1 ? 1 : Math.max(0.28, 1 - (dn - 1) * 0.75);
    const edge = Math.min(x + 44, W - x + 44) / 230;
    const edgeW = Math.max(0.16, Math.min(1, edge));
    if (rand() > poolW * edgeW) continue;
    // Litter CLUMPS. An even sprinkle reads as noise; rubble collects where
    // rubble already is, so about half the pieces land as a group of three to
    // six around the accepted point and the rest stand alone.
    const clump = rand() < 0.46 ? 2 + Math.floor(rand() * 4) : 1;
    for (let c = 0; c < clump && placed < o.count; c++) {
      placed++;
      const spread = (0.45 + t) * 30;
      const cxp = c === 0 ? x : x + (rand() - 0.5) * spread * 2;
      const cyp = c === 0 ? y : y + (rand() - 0.5) * spread * 0.6;
      const cls = rand();
      const sizeClass = cls < 0.52 ? 0.66 : cls < 0.86 ? 1 : 1.5;
      const s = (5.4 + t * 6.2) * sizeClass * sizeMul;
      const kind = o.kinds[Math.floor(rand() * o.kinds.length)];
      const a = alphaMul * (0.55 + 0.45 * poolW) * (0.58 + rand() * 0.55) * (1 + (1 - t) * 0.4);
      // The cast shadow lands down-key-right and stays in world space, unrotated.
      if (kind.lift > 0) {
        // Soft, not a hard ellipse: at 1x a crisp ring under a 6-px stone reads
        // as a second object. The only hard-edged shadow in the scene is the
        // ACTOR's contact ellipse in engine/light.ts, which is hard on purpose
        // — a sprite standing on a soft smudge floats.
        blobAt(ctx, cxp + s * 0.42, cyp + s * 0.26, s * 1.15, s * 0.42, o.ink.dark, a * 0.52 * kind.lift, false);
      }
      ctx.save();
      ctx.translate(cxp, cyp);
      // Perspective first, rotation inside it: a rotated slab still lies flat.
      ctx.scale(1, 0.34 + t * 0.26);
      ctx.rotate((rand() - 0.5) * Math.PI * 2);
      ctx.globalAlpha = a;
      kind.draw(ctx, s, rand, o.ink);
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * A structural crack running down the floor. Drawn as a chain of short,
 * jittered, tapering segments with gaps rather than one polyline: a crack in
 * stone branches, pinches out and picks up again, and an unbroken 2-px line
 * from the wall to the frame edge is exactly the kind of straight run the rest
 * of this file spends its effort breaking.
 */
function crackRun(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  yTop: number,
  yBot: number,
  color: string,
  alpha: number,
  seed: number,
): void {
  const rand = rng(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  let u = rand() * 0.1;
  while (u < 1) {
    const v = Math.min(1, u + 0.1 + rand() * 0.16);
    const px = (t: number) => x0 + (x1 - x0) * t + (rand() - 0.5) * 9;
    const py = (t: number) => yTop + (yBot - yTop) * t;
    ctx.globalAlpha = alpha * (0.55 + rand() * 0.7);
    ctx.lineWidth = 1 + u * 1.8;
    ctx.beginPath();
    ctx.moveTo(px(u), py(u));
    ctx.lineTo(px((u + v) / 2), py((u + v) / 2));
    ctx.lineTo(px(v), py(v));
    ctx.stroke();
    // A branch, now and then.
    if (rand() < 0.3) {
      ctx.globalAlpha = alpha * 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(v), py(v));
      ctx.lineTo(px(v) + (rand() - 0.5) * 60, py(v) + 12 + rand() * 26);
      ctx.stroke();
    }
    u = v + 0.05 + rand() * 0.13;
  }
  ctx.restore();
}

// ----------------------------------------------------------- the horizon --
//
// A 1280-px straight rule where the back wall meets the floor reads as a seam
// between two offscreens, not as a room. `horizonSteps` is the shared broken
// line: the same seed gives the same profile in the far plane (which fills
// under it) and the mid plane (which lights a few of its tops), so the two
// planes agree while the joint itself never runs straight for more than a
// segment.

/** The stepped wall/floor joint as [x0, x1, y] runs. Deterministic per seed. */
function horizonSteps(
  W: number,
  y: number,
  seed: number,
  steps = 8,
  amp = 16,
): readonly (readonly [number, number, number])[] {
  const rand = rng(seed);
  const out: (readonly [number, number, number])[] = [];
  const span = (W + 80) / steps;
  // CONTIGUOUS boundaries: each segment ends exactly where the next begins.
  // Jittering both ends independently left gaps of up to 0.4 span, and a
  // consumer that ERASES per segment (fadeTop) then skipped those columns
  // entirely — a 23 x 95 px bar of un-feathered floor standing at the joint,
  // visible in the crypt at x 107 and the marsh at x 558.
  const bounds: number[] = [-40];
  for (let i = 1; i < steps; i++) bounds.push(-40 + i * span + (rand() - 0.5) * span * 0.4);
  bounds.push(W + 40);
  let prev = y;
  for (let i = 0; i < steps; i++) {
    const x0 = bounds[i];
    const x1 = bounds[i + 1];
    // A STEP, always. Free jitter let neighbours round to the same row and
    // three of them in a row rebuilt the very rule this helper exists to
    // break (412 px of it in the forge). Each segment is pushed at least
    // MIN_STEP off its predecessor, alternating side when it would not be.
    let sy = Math.round(y + (rand() - 0.5) * amp);
    if (Math.abs(sy - prev) < MIN_STEP) {
      const dir = prev <= y ? 1 : -1;
      sy = Math.round(prev + dir * (MIN_STEP + rand() * amp * 0.3));
      if (Math.abs(sy - y) > amp) sy = Math.round(prev - dir * (MIN_STEP + rand() * amp * 0.3));
    }
    prev = sy;
    out.push([x0, x1, sy]);
  }
  return out;
}

/** Smallest vertical offset between two neighbouring horizon segments, in px. */
const MIN_STEP = 7;

/** Fill the band under a stepped horizon, feathering the joint into the haze above it. */
function horizonBand(
  ctx: CanvasRenderingContext2D,
  W: number,
  y: number,
  h: number,
  fill: string,
  seed: number,
  steps = 8,
  amp = 16,
): void {
  const runs = horizonSteps(W, y, seed, steps, amp);
  ctx.beginPath();
  ctx.moveTo(-40, y + h);
  for (const [x0, x1, sy] of runs) {
    ctx.lineTo(x0, sy);
    ctx.lineTo(x1, sy);
  }
  ctx.lineTo(W + 40, y + h);
  ctx.closePath();
  // The band's LOWER edge fades out. It would otherwise end on a hard
  // horizontal line of its own, which is the seam this helper exists to kill —
  // and the floor plane's fadeTop leaves it showing through.
  const g = ctx.createLinearGradient(0, y - amp, 0, y + h);
  g.addColorStop(0, fill);
  g.addColorStop(0.55, hexA(fill, 0.62));
  g.addColorStop(1, hexA(fill, 0));
  ctx.fillStyle = g;
  ctx.fill();
}

/**
 * The lit contact where wall meets floor — struck only on some of the steps,
 * with gaps between, so the eye reads a broken skirting and never a rule.
 */
function horizonGlint(
  ctx: CanvasRenderingContext2D,
  W: number,
  y: number,
  color: string,
  alpha: number,
  seed: number,
  steps = 8,
  amp = 16,
): void {
  const runs = horizonSteps(W, y, seed, steps, amp);
  const rand = rng(seed ^ 0x9e37);
  ctx.save();
  ctx.fillStyle = color;
  let lit = false;
  for (const [x0, x1, sy] of runs) {
    // Never two neighbours in a row: two lit segments that happen to share a
    // row read as one continuous skirting again.
    if (lit || rand() < 0.3) {
      lit = false;
      continue;
    }
    lit = true;
    const inset = (x1 - x0) * (0.08 + rand() * 0.3);
    ctx.globalAlpha = alpha * (0.5 + rand() * 0.7);
    ctx.fillRect(x0 + inset, sy - 1, x1 - x0 - inset * (1 + rand()), 2.5);
  }
  ctx.restore();
}

// -------------------------------------------------------------- the props --

/** A prop's contact with the ground: an ellipse thrown down-key-right, hard under the mass and soft beyond it. */
function propShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, alpha: number): void {
  blobAt(ctx, x + rx * 0.22, y, rx * 1.15, rx * 0.32, 'rgba(0,0,0,1)', alpha, false);
}

/** A thin lit edge down the key-facing side of a silhouette. Never a closed loop. */
function rimEdge(
  ctx: CanvasRenderingContext2D,
  pts: readonly number[],
  color: string,
  alpha: number,
  width = 2,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
  ctx.restore();
}

/**
 * Model a prop's faces. A flat fill under a 2-px keyline is a line drawing:
 * the eye gets an outline and no form. This clips to the shape and lays a
 * gradient down its short axis — a lit top face, an unlit mid flank, a dark
 * underside — which is the same barrel trick `fallenColumn` uses, applied to
 * every slab, box and trough so one rule shades them all.
 *
 * THE BREAK. A smooth ramp is form but it is not PLANES, and at the mid plane's
 * 2.6-px blur it comes back as a silhouette with a highlight on it — round 3's
 * "every mid-ground prop is an untextured silhouette at one value". A mass in
 * `octopath-3` — the cart, the barrel stack, the house gable — is two flat
 * values meeting on a HARD LINE, and it is the line, not the gradient, that
 * says solid-with-two-faces. So the ramp now carries one discontinuity at 42 %
 * of the mass's height: everything above it is the lit plane, everything below
 * is the shaded one, and every helper that calls this (slabProp, drum,
 * wedgeBox, trough, fallenColumn, fallenBell, stairs' treads) gets it for free.
 */
function faceShade(
  ctx: CanvasRenderingContext2D,
  pts: readonly number[],
  top: number,
  bottom: number,
  lit: string,
  litA: number,
): void {
  faceShadeIn(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }, top, bottom, lit, litA);
}

/** `faceShade` for a shape whose outline is a PATH, not a point list (see `arch`). */
function faceShadeIn(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  top: number,
  bottom: number,
  lit: string,
  litA: number,
): void {
  ctx.save();
  path();
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, hexA(lit, litA * 1.5));
  g.addColorStop(0.2, hexA(lit, litA * 0.7));
  g.addColorStop(0.42, hexA(lit, litA * 0.28));
  // The break: two stops 1/1000 apart is a hard line in a linear gradient.
  g.addColorStop(0.4205, 'rgba(0,0,0,0.14)');
  g.addColorStop(0.72, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(-4000, top - 4, 8000, bottom - top + 8);
  ctx.restore();
}

/** A rectangular mass standing on the floor, tilted, with a key rim and a cast shadow. */
function slabProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  rot: number,
  fill: string,
  rim: string,
  rimA: number,
): void {
  propShadow(ctx, x, baseY, w * 0.72, 0.4);
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(rot);
  const hw = w / 2;
  const face = [-hw, 0, -hw * 0.92, -h, hw * 0.92, -h, hw, 0];
  poly(ctx, face, fill);
  faceShade(ctx, face, -h, 0, rim, rimA);
  rimEdge(ctx, [-hw, 0, -hw * 0.92, -h, hw * 0.92, -h], rim, rimA);
  ctx.restore();
}

/** A column drum or barrel: a tapered body with an elliptical lit top. */
function drum(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  fill: string,
  rim: string,
  rimA: number,
): void {
  const hw = w / 2;
  propShadow(ctx, x, baseY, hw * 1.5, 0.42);
  poly(ctx, [x - hw, baseY, x - hw * 0.9, baseY - h, x + hw * 0.9, baseY - h, x + hw, baseY], fill);
  ctx.save();
  ctx.globalAlpha = rimA * 0.8;
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, baseY - h, hw * 0.9, hw * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  rimEdge(ctx, [x - hw, baseY, x - hw * 0.9, baseY - h], rim, rimA);
}

/**
 * A toppled column: a drum lying at an angle. A plain quad reads as a plank,
 * so the body carries a lit band along its upper third and a shaded one along
 * its lower third (both clipped to the shaft), a broken end-drum with a sunk
 * inner face, and a couple of faint course seams.
 */
function fallenColumn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  r: number,
  rot: number,
  fill: string,
  rim: string,
  rimA: number,
): void {
  propShadow(ctx, x + len * 0.04, y + r * 0.8, len * 0.5, 0.44);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const hl = len / 2;
  const shaft = [-hl, -r, hl, -r * 0.88, hl, r * 0.88, -hl, r];
  poly(ctx, shaft, fill);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(shaft[0], shaft[1]);
  for (let i = 2; i < shaft.length; i += 2) ctx.lineTo(shaft[i], shaft[i + 1]);
  ctx.closePath();
  ctx.clip();
  // A GRADIENT across the short axis, not two flat bands: a hard-edged strip
  // of lighter fill reads as a plank with a stripe on it, a ramp reads as a
  // barrel. Lit at the top-left where the key is, falling to shade underneath.
  const cyl = ctx.createLinearGradient(0, -r * 1.1, 0, r * 1.1);
  cyl.addColorStop(0, hexA(rim, rimA * 1.7));
  cyl.addColorStop(0.24, hexA(rim, rimA * 0.7));
  cyl.addColorStop(0.52, 'rgba(0,0,0,0)');
  cyl.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = cyl;
  ctx.fillRect(-hl - 6, -r - 6, len + 12, r * 2 + 12);
  ctx.restore();
  // The broken end, facing the camera: a drum with its face sunk one step.
  ctx.beginPath();
  ctx.ellipse(-hl, 0, r * 0.36, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(-hl + r * 0.06, 0, r * 0.24, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
  // Course seams, so it reads as stacked stone rather than a pipe.
  ctx.save();
  ctx.globalAlpha = rimA * 0.5;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.5;
  for (const t of [-0.18, 0.22, 0.56]) {
    ctx.beginPath();
    ctx.moveTo(hl * t, -r * 0.92);
    ctx.lineTo(hl * t + r * 0.14, r * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  rimEdge(ctx, [-hl, -r, hl, -r * 0.88], rim, rimA, 2);
  ctx.restore();
}

/** A sarcophagus or chest: a tapered box with a lid, tilted off square. */
function wedgeBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  taper: number,
  rot: number,
  fill: string,
  rim: string,
  rimA: number,
  lid = true,
): void {
  propShadow(ctx, x, baseY, w * 0.66, 0.42);
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(rot);
  const hw = w / 2;
  const tw = hw * taper;
  const body = [-hw, 0, -tw, -h, tw, -h, hw, 0];
  poly(ctx, body, fill);
  faceShade(ctx, body, -h, 0, rim, rimA);
  if (lid) {
    // Slid off to the key side, proud by a hair — a lid that overhangs on both
    // sides stops being a lid and becomes a table top.
    const sh = w * 0.09;
    const cap = [-tw - w * 0.03 + sh, -h, -tw + sh, -h - h * 0.16, tw + sh, -h - h * 0.16, tw + w * 0.03 + sh, -h];
    poly(ctx, cap, fill);
    // The lid catches the key across its whole top face, not on a hairline.
    faceShade(ctx, cap, -h - h * 0.16, -h, rim, rimA * 1.35);
    rimEdge(ctx, [-tw - w * 0.03 + sh, -h, -tw + sh, -h - h * 0.16, tw + sh, -h - h * 0.16], rim, rimA * 0.8, 1.5);
  }
  rimEdge(ctx, [-hw, 0, -tw, -h], rim, rimA);
  ctx.restore();
}

/**
 * A bell on its side. Its predecessor was one flat fill a couple of L* off the
 * floor with a 2.5-px keyline over it, so all that reached the frame was a
 * bare white chevron. This one is modelled: a body a clear step lighter than
 * the ground, a barrel gradient across the short axis (lit crown, mid flank,
 * dark underside), two raised mouldings, a dark mouth with a lit rim, and the
 * canon loop at the closed end.
 */
function fallenBell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  len: number,
  r: number,
  rot: number,
  fill: string,
  lit: string,
  litA: number,
): void {
  propShadow(ctx, x + len * 0.05, y + r * 0.85, len * 0.5, 0.44);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const hl = len / 2;
  const crownR = r * 0.46;
  // The flare, crown at the left and mouth at the right.
  ctx.beginPath();
  ctx.moveTo(-hl, -crownR);
  ctx.bezierCurveTo(-hl * 0.1, -crownR * 1.05, hl * 0.45, -r * 0.82, hl, -r);
  ctx.lineTo(hl, r);
  ctx.bezierCurveTo(hl * 0.45, r * 0.82, -hl * 0.1, crownR * 1.05, -hl, crownR);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, -r * 1.05, 0, r * 1.05);
  g.addColorStop(0, hexA(lit, litA * 1.9));
  g.addColorStop(0.26, hexA(lit, litA * 0.7));
  g.addColorStop(0.54, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(-hl - 6, -r - 6, len + 12, r * 2 + 12);
  // Two raised mouldings around the waist.
  ctx.globalAlpha = litA * 0.7;
  ctx.fillStyle = lit;
  ctx.fillRect(hl * 0.12, -r, 1.6, r * 2);
  ctx.fillRect(hl * 0.4, -r, 1.4, r * 2);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000000';
  ctx.fillRect(hl * 0.12 + 1.6, -r, 2, r * 2);
  ctx.fillRect(hl * 0.4 + 1.4, -r, 1.8, r * 2);
  ctx.restore();
  // The mouth: the inside of a bell is the darkest thing on it.
  ctx.beginPath();
  ctx.ellipse(hl, 0, r * 0.3, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#07080e';
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = litA * 1.4;
  ctx.strokeStyle = lit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(hl, 0, r * 0.3, r, 0, Math.PI * 0.75, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
  // The canon: the loop it hung from.
  ctx.save();
  ctx.globalAlpha = litA * 1.2;
  ctx.strokeStyle = lit;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(-hl - crownR * 0.5, 0, crownR * 0.62, Math.PI * 0.55, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();
  rimEdge(ctx, [-hl, -crownR, 0, -r * 0.74, hl, -r], lit, litA * 1.5, 2);
  ctx.restore();
}

/**
 * A quench trough: three modelled faces (a lit coping along the top, a mid
 * flank, a dark underside) with soft-edged slack water sitting inside the
 * mouth. Drawn as a flat slab with a keyline it read as a line drawing at 3x.
 */
function trough(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  fill: string,
  lit: string,
  litA: number,
  water: string,
): void {
  propShadow(ctx, x, baseY, w * 0.6, 0.42);
  const hw = w / 2;
  const lip = Math.max(9, h * 0.44);
  // The front flank.
  const flank = [x - hw, baseY, x - hw * 0.96, baseY - h, x + hw * 0.96, baseY - h, x + hw, baseY];
  poly(ctx, flank, fill);
  faceShade(ctx, flank, baseY - h, baseY, lit, litA * 0.8);
  // The coping the water sits in, seen from slightly above.
  const cope = [
    x - hw * 0.96, baseY - h,
    x - hw * 0.88, baseY - h - lip,
    x + hw * 0.88, baseY - h - lip,
    x + hw * 0.96, baseY - h,
  ];
  poly(ctx, cope, fill);
  // A top face is the lightest plane on the prop, so it is FILLED with the key
  // tone rather than outlined with it — an outline plus a gradient read as two
  // parallel bright bars at 3x, which is a line drawing, not a coping.
  ctx.save();
  ctx.globalAlpha = litA * 0.9;
  poly(ctx, cope, lit);
  ctx.restore();
  faceShade(ctx, cope, baseY - h - lip, baseY - h, lit, litA * 0.8);
  // Slack water inside the mouth: soft at both ends, with one specular streak.
  blobAt(ctx, x - w * 0.02, baseY - h - lip * 0.42, hw * 0.78, lip * 0.5, water, 0.16, true);
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = water;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.5, baseY - h - lip * 0.56);
  ctx.lineTo(x + hw * 0.16, baseY - h - lip * 0.62);
  ctx.stroke();
  ctx.restore();
}

/**
 * A feathered side curtain for the NEAR plane. The old flat polygons ended on
 * a straight vertical edge about 60 px in, which read as a rectangular
 * vignette; this ramps out over `w` px (>= 120) so the frame darkens instead
 * of being walled.
 */
function edgeCurtain(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  side: 1 | -1,
  w: number,
  ink: string,
): void {
  const x0 = side === 1 ? -PAD : W + PAD;
  const x1 = side === 1 ? w : W - w;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, ink);
  g.addColorStop(0.24, ink);
  g.addColorStop(0.52, hexA(ink, 0.5));
  g.addColorStop(0.78, hexA(ink, 0.15));
  g.addColorStop(1, hexA(ink, 0));
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x0, x1), -PAD, Math.abs(x1 - x0), H + PAD * 2);
}

/**
 * The near ground under the camera: a soft dark lip along the bottom edge. The
 * reference frames put their darkest band here, and without it a lit floor
 * fades out at the bottom of the picture instead of ending. Starts below the
 * front actor's feet (y 516) so it never eats a boot.
 */
function floorLip(ctx: CanvasRenderingContext2D, W: number, H: number, ink: string, h: number): void {
  // SHALLOWER AND WEAKER than it was (112 px to opaque). At that depth it owned
  // the whole bottom quarter and was most of why the near ground measured p50
  // L 7.3 — darker than the mid ground behind it, which is an inversion of
  // every reference frame. It is a LIP now: the last rows sink, the ground in
  // front of the party stays lit, and the alpha never reaches the flat ink.
  const g = ctx.createLinearGradient(0, H - h, 0, H + PAD);
  g.addColorStop(0, hexA(ink, 0));
  g.addColorStop(0.62, hexA(ink, 0.2));
  g.addColorStop(1, hexA(ink, 0.62));
  ctx.fillStyle = g;
  ctx.fillRect(-PAD, H - h, W + PAD * 2, h + PAD);
}

/** How far outside the frame a plane painter may safely draw (engine/light.ts's PLANE_PAD). */
const PAD = 48;

/** #rrggbb -> rgba() at `a`. Bake time only. */
function hexA(hex: string, a: number): string {
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ================================================================ EMBER CRYPT ==
// Warm amber over cold stone. The light has a reason to exist — a burning arch
// at the far left of the vault, its beams thrown across the room as shafts —
// and it comes from the UPPER LEFT because that is where the sprites' own baked
// key and rim come from; the fill answers it from the lower right, cool.
//
// The actor row (x 330-950, y 250-540) is kept deliberately empty: dark
// pillars, low detail, nothing saturated and nothing bright behind a head.

const CRYPT_FAR_INK = '#282640';
const CRYPT_MID_INK = '#14101f';
const CRYPT_NEAR_INK = '#07050d';
/** The floor's own litter: chipped flagstone and rubble, either side of the ground tone. */
const CRYPT_GROUND: GroundInk = { lit: '#4f4460', dark: '#0d0917', seam: '#0a0714' };
/**
 * The crypt's ground at the ACTOR's cell. Warm sandstone where the braziers
 * and the two pools reach it, cold blue-violet flag where they do not — the
 * second hue round 3 asked for, so the floor carries chroma without the whole
 * plane going one temperature.
 */
const CRYPT_PIX: PixelInk = { lit: '#93764f', mid: '#4e4038', bed: '#191228', cool: '#3c4468', coolLit: '#6a76a4' };
/** The seed every crypt plane shares, so the stepped horizon lines up across them. */
const CRYPT_SEED = 0xc1a7;

const CRYPT: BiomeLook = {
  id: 'EMBER CRYPT',
  // ACTOR WEIGHTS (`actorWeight`, on every source in every biome below). The
  // alphas are the DIORAMA's and are untouched — the light map bakes from them
  // and the backdrop captures are byte for byte what they were. The weight is
  // the second question: how much of this source lands on a BODY.
  //
  // They are not the same answer here. The key is high, up-stage and on the
  // left, which is where the enemies stand; the fill and the party's own floor
  // pool are on the right. Weighted 1:1 the rig lit the enemy rank harder than
  // the party at every seat (source reach at the six feet anchors measured
  // 0.143 / 0.107 / 0.119 on the left against 0.050 / 0.080 / 0.125 on the
  // right), which is half of why three critics in a row read the frame
  // left-first. Halving the key and lifting the fill and pool2 inverts that
  // ordering without moving one pixel of the wall it rakes.
  // The key moved with the brazier (see mid(), and the far arch below): a
  // source at x 244 justified a fire the frame no longer keeps there.
  // THE KEY IS THE WELL. Round 6 put a lit opening high and centred in every
  // biome (see `lightWell`); the key light is what that opening throws, so it
  // moved there with it. The wash on the back wall follows the hole in the
  // ceiling instead of a doorway in the left corner.
  key: { color: '#ffb066', x: 640, y: 120, radius: 520, alpha: 0.22, actorWeight: 0.5 },
  fill: { color: '#4a63a8', x: 1080, y: 630, radius: 660, alpha: 0.2, actorWeight: 1.4 },
  // A symmetric PAIR, not one centred pool. The stage is a diagonal with the
  // enemies on the left-centre (layout.ts ENEMY_FEET x 290-382) and the party
  // on the right (HERO_FEET x 532-732); one pool at x 640 peaked between them,
  // where nobody stood at round 6's anchors, and left the enemy plane unlit.
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#ffb15c', 0.816, 0.85),
  // Pool2 is the PARTY's ground and it is now the brightest floor in the room:
  // the eye has to land on the half of the stage the player controls.
  pool2: clusterPool(HERO_FEET, '#ffb970', 0.792, 1.25),
  shafts: { color: '#ffb066', alpha: 0.065, x: 296, y: -90, angle: -0.52, count: 4, width: 52, length: 1050, gap: 152 },
  grade: {
    shadow: '#3a1b2a',
    shadowAlpha: 0.20,
    vignette: 0.64,
    highlight: '#ffb673',
    highlightAlpha: 0.10,
  },
  fog: { color: '#6b4a3a', alpha: 0.06, y: 300, height: 260, speed: 7, bands: 2 },
  motes: { color: '#ffa348', count: 64, size: 9, rise: -26, drift: 16 },
  rim: '#ffcf8f',
  ambient: 'embers',
  ambientColor: '#8a3a18',

  far(ctx, W, H) {
    // Aerial perspective: the deepest plane is the LIGHTEST and the least
    // contrasty thing in the frame, hazing out toward the wall line.
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#3a3547'],
      [0.14, '#4a4152'],
      [0.3, '#463746'],
      [0.48, '#3d2e36'],
      [0.56, '#3a2b30'],
      [0.68, '#241c26'],
      [1, '#14101a'],
    ]);
    skyMottle(ctx, W, 300, '#6d6178', '#17131f', 0.16, CRYPT_SEED ^ 0x71);
    // THE BROKEN VAULT — the crypt's light well, centred and high (see
    // `lightWell`). The ceiling has fallen in over the middle of the room and
    // cold daylight comes down through it: an interior's version of a sky, and
    // the one thing in the frame the actor rank can be read AGAINST. It is the
    // opposing accent this room already had (cold against the amber) grown to
    // the size the reference gives its sky, and it sits above y 240, clear of
    // every head on the stage.
    ctx.save();
    ctx.globalAlpha = 0.85;
    poly(ctx, [478, -20, 812, -20, 800, 92, 742, 140, 690, 118, 604, 152, 540, 120, 486, 66], '#0a0a12');
    ctx.restore();
    lightWell(ctx, 646, 62, 232, 132, '#f4f9ff', '#9cc2e6', 1, 2.8);
    wellShafts(ctx, 646, 120, 5, 300, 300, '#cfe2ff', 0.17, 0xbeef);
    // THE FAR-LEFT DOORWAY, DIMMED. Measured with the critic's own method the
    // largest bright AND largest saturated mass in every crypt frame was this
    // one — x 60-260, opposite the party, the first thing the eye found and
    // nothing the player controls. It stays as architecture (the room needs a
    // way out) at a third of its glow; the FIRE that justified it has moved
    // up-stage behind the enemy rank, and the wall there carries its spill.
    // ...and dimmed AGAIN in round 6. Composition item 2: it was still the
    // largest saturated mass in every crypt frame at 2.4-3.1 % of pixels,
    // x 87-240, in the left third opposite the party. The doorway stays as a
    // way out of the room; its warm glow is now a quarter of what it was, and
    // the room's loudest thing is the vault above the middle of the stage.
    arch(ctx, 190, 84, 132, FLOOR_Y, '#2a1c1a');
    arch(ctx, 190, 50, 196, FLOOR_Y, '#33221c');
    softBlob(ctx, 190, 326, 66, 70, '#7a4420', 0.04);
    // The brazier's own spill on the back wall, at x 452 — up-stage, behind
    // where the enemies stand, so their silhouettes read against it.
    softBlob(ctx, 452, 336, 104, 96, '#c9631f', 0.13);
    for (const x of [372, 470, 640, 812, 980, 1112, 1216]) {
      pillar(ctx, x, 96, FLOOR_Y, 19, CRYPT_FAR_INK, '#3a3859');
    }
    ctx.strokeStyle = CRYPT_FAR_INK;
    ctx.lineWidth = 6;
    for (const x of [372, 640, 980]) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.quadraticCurveTo(x + 84, 22, x + 168, 100);
      ctx.stroke();
    }
    // THE OPPOSING ACCENT. Every other light in this room is amber; the far
    // vault carries a cold mineral seam — frost-blue veins in the rib stone
    // with two glints in them — so key and fill sit across the wheel instead
    // of the whole frame reading as one hue. Kept hard right (x > 1000) and
    // high, well outside the actors' band, and dim enough that it reads as a
    // glint and never competes with the brazier.
    ctx.save();
    ctx.strokeStyle = '#7fc9e8';
    ctx.lineCap = 'round';
    for (const [x, y, dx, dy, a, w] of [
      [1024, 46, 62, 92, 0.3, 2.5],
      [1096, 30, -34, 118, 0.24, 2],
      [1164, 74, 46, 74, 0.2, 1.5],
    ] as const) {
      ctx.globalAlpha = a;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dx * 0.7, y + dy * 0.4, x + dx, y + dy);
      ctx.stroke();
    }
    ctx.restore();
    // ...and the COLD window is raised to meet it: with the brazier halved,
    // the room's two loudest sources now sit across the wheel AND across the
    // frame instead of one amber mass owning the left edge.
    softBlob(ctx, 1092, 96, 118, 106, '#2f7ea8', 0.16);
    softBlob(ctx, 1068, 84, 14, 14, '#d8f4ff', 0.34);
    softBlob(ctx, 1148, 132, 10, 10, '#cdeeff', 0.3);
    // Dust haze washing the whole far plane down toward the floor.
    hazeWash(ctx, W, 150, '#927a70', 0.3, CRYPT_SEED);
    // The wall meets the floor on a BROKEN line: a straight 1280-px rule reads
    // as a seam between two offscreens, so the joint steps over nine segments
    // and three masses below stand across it.
    horizonBand(ctx, W, FLOOR_Y - 9, 22, '#2b2334', CRYPT_SEED, 9, 17);
  },

  mid(ctx, W) {
    // Dark, low-detail stone. Everything here sits behind an actor at some
    // point in the fight, so nothing may draw attention to itself — inside
    // x 330-950 the rims run at a third of the strength they take outside it.
    const RIM = '#6e5f7a';
    pillar(ctx, 336, 54, FLOOR_Y + 30, 32, CRYPT_MID_INK, '#241d38');
    pillar(ctx, 964, 40, FLOOR_Y + 34, 34, CRYPT_MID_INK, '#1d1730');
    pillar(ctx, 784, 200, FLOOR_Y + 8, 24, CRYPT_MID_INK, '#1c1730');
    pillar(ctx, 516, 236, FLOOR_Y + 4, 20, CRYPT_MID_INK, '#221b34');
    poly(ctx, [282, FLOOR_Y + 30, 296, 296, 336, 302, 330, FLOOR_Y + 34], CRYPT_MID_INK);

    // Masses at three depths and three scales, none of them mirrored, each with
    // a rim on the key side and a shadow on the ground plane; several straddle
    // the wall/floor joint and occlude it. The two that stand FORWARD of the
    // joint live in floor() — the floor plane is opaque from FLOOR_Y down and
    // paints over anything the mid plane draws below it.
    // 1. A sarcophagus at an angle, lid slid off.
    wedgeBox(ctx, 746, FLOOR_Y + 22, 128, 56, 0.8, -0.05, '#0d0917', RIM, 0.15);
    // 4. A rubble heap against the left pillar, well outside the actor band.
    // A rubble heap: a block, a broken wedge and a rolled drum, not three slabs.
    slabProp(ctx, 252, FLOOR_Y + 44, 74, 34, 0.1, '#100c1b', RIM, 0.3);
    poly(ctx, [268, FLOOR_Y + 54, 300, FLOOR_Y + 20, 326, FLOOR_Y + 30, 322, FLOOR_Y + 56], '#100c1b');
    rimEdge(ctx, [268, FLOOR_Y + 54, 300, FLOOR_Y + 20, 326, FLOOR_Y + 30], RIM, 0.3, 2);
    drum(ctx, 214, FLOOR_Y + 60, 42, 22, '#100c1b', RIM, 0.3);
    // 5. A pair of stone urns on the right, different heights.
    drum(ctx, 1042, FLOOR_Y + 40, 44, 74, '#151020', RIM, 0.34);
    drum(ctx, 1096, FLOOR_Y + 30, 32, 50, '#131020', RIM, 0.28);
    // 6. Chains off the unresolved ceiling, over the middle but hairline-thin.
    ctx.save();
    ctx.strokeStyle = '#100c1a';
    ctx.lineWidth = 2;
    for (const [x, top, bot] of [[596, -10, 214], [648, -10, 168], [880, -10, 132]] as const) {
      ctx.globalAlpha = 0.8;
      for (let y = top; y < bot; y += 13) {
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Four sarcophagi, no two the same: different widths, heights, tapers and
    // tilts, so the row stops reading as one shape stamped four times.
    // Four graves, four PROFILES — the row used to be one trapezoid stamped at
    // four scales, which is the same repetition the reed fans were pulled up on.
    // A tapered chest, a snapped stele, a low kerbed slab and a leaning marker
    // share nothing but their material.
    wedgeBox(ctx, 432, FLOOR_Y + 30, 96, 54, 0.62, 0.05, '#120e1e', RIM, 0.26, false);
    ctx.save();
    ctx.translate(612, FLOOR_Y + 30);
    ctx.rotate(-0.05);
    poly(ctx, [-25, 0, -25, -74, 22, -58, 25, 0], '#120e1e');
    faceShade(ctx, [-25, 0, -25, -74, 22, -58, 25, 0], -74, 0, RIM, 0.16);
    rimEdge(ctx, [-25, 0, -25, -74, 22, -58], RIM, 0.12, 2);
    ctx.restore();
    slabProp(ctx, 892, FLOOR_Y + 30, 122, 26, 0.02, '#120e1e', RIM, 0.12);
    poly(ctx, [833, FLOOR_Y + 4, 833, FLOOR_Y - 8, 951, FLOOR_Y - 4, 951, FLOOR_Y + 8], '#161125');
    faceShade(ctx, [833, FLOOR_Y + 4, 833, FLOOR_Y - 8, 951, FLOOR_Y - 4, 951, FLOOR_Y + 8], FLOOR_Y - 8, FLOOR_Y + 8, RIM, 0.14);
    slabProp(ctx, 1176, FLOOR_Y + 34, 44, 78, 0.17, '#120e1e', RIM, 0.26);

    // THE BRAZIER, MOVED. It used to stand at x 206-270 and it was the
    // largest, brightest, most saturated mass in every crypt frame — at the
    // far left, opposite the party. It now stands at x 452, UP-STAGE and
    // BEHIND the enemy rank (layout.ts seats them x 150-520), so the fire is
    // something the enemies are silhouetted against rather than a lamp in the
    // corner shouting at the player, and its bloom is a quarter of what it was:
    // 86 px of glow at 0.2 down to 40 at 0.095, with a 13-px core at 0.19
    // instead of a 30-px one at 0.34.
    poly(ctx, [426, FLOOR_Y + 8, 436, 344, 468, 344, 478, FLOOR_Y + 8], '#120e1c');
    poly(ctx, [420, 344, 484, 344, 474, 326, 430, 326], '#241a24');
    faceShade(ctx, [420, 344, 484, 344, 474, 326, 430, 326], 326, 344, RIM, 0.4);
    softBlob(ctx, 452, 318, 40, 34, '#e8752a', 0.095);
    softBlob(ctx, 452, 312, 13, 12, '#f0c294', 0.19);
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // A collapsed grave stack: a kerbed base, a snapped stele leaning off it
    // and a rolled drum, so the mass has three profiles and not one block.
    slabProp(ctx, 604, FLOOR_Y + 26, 118, 34, 0.02, '#0f0b1a', RIM, 0.11);
    poly(ctx, [566, FLOOR_Y - 8, 572, FLOOR_Y - 82, 612, FLOOR_Y - 74, 616, FLOOR_Y - 6], '#110d1d');
    faceShade(ctx, [566, FLOOR_Y - 8, 572, FLOOR_Y - 82, 612, FLOOR_Y - 74, 616, FLOOR_Y - 6], FLOOR_Y - 82, FLOOR_Y - 6, RIM, 0.13);
    rimEdge(ctx, [566, FLOOR_Y - 8, 572, FLOOR_Y - 82, 612, FLOOR_Y - 74], RIM, 0.1, 2);
    wedgeBox(ctx, 690, FLOOR_Y + 18, 84, 44, 0.7, 0.06, '#0e0a18', RIM, 0.1, false);
    drum(ctx, 654, FLOOR_Y + 34, 40, 20, '#0f0b1a', RIM, 0.1);
    // The two masses that catch the broken vault (see `litPylon`).
    litPylon(ctx, 498, FLOOR_Y + 18, 52, 96, '#c9b49c', '#171225', RIM);
    litPylon(ctx, 812, FLOOR_Y + 22, 60, 112, '#bda88f', '#151020', RIM);
    jointSpeckle(ctx, W, CRYPT_GROUND, CRYPT_SEED ^ 0x3d);
    horizonGlint(ctx, W, FLOOR_Y - 9, '#ff9646', 0.09, CRYPT_SEED, 9, 17);
  },

  floor(ctx, W, H) {
    // THE GROUND IS LIT FROM THE FRONT NOW. It used to ramp DOWN as it came
    // toward the camera (#2c2434 -> #0f0b17), which put the near quarter at
    // p50 L 7.3 against the mid ground's 18.8 — the bottom of the picture was
    // the darkest thing in it and the reference does the exact opposite: in
    // `octopath-4` the near sand is the BRIGHTEST plane in the frame, and even
    // `octopath-2`'s night forest holds a warm lit dirt strip across its front.
    // The ramp now brightens forward and eases back only in the last rows.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#281d31'],
      [0.17, '#3a2c3e'],
      [0.46, '#503d47'],
      [0.78, '#a68170'],
      [1, '#9c7663'],
    ]);
    // Broad scuff along the stage diagonal: centuries of feet between the
    // brazier and the vault, plus a damp band where the wall weeps. These are
    // soft-edged blobs, so nothing here has an edge to catch — which is also
    // what retires the old hard-edged floor stain at (250, 478).
    scuffBand(ctx, 300, FLOOR_Y + 34, 760, H - 30, 96, 210, '#3c3246', 0.05, true);
    scuffBand(ctx, 960, FLOOR_Y + 26, 560, H + 20, 84, 190, '#332b3e', 0.036, true);
    scuffBand(ctx, 206, FLOOR_Y + 56, 140, H - 50, 78, 156, '#0a0712', 0.3, false);
    scuffBand(ctx, 1080, FLOOR_Y + 44, 1200, H + 10, 82, 168, '#0a0712', 0.26, false);
    floorGrid(ctx, W, H, '#5a4c66', 0.035, CRYPT_SEED);
    // Cracked flagstones with rubble: the SOFT scatter, the big shapes, still
    // rotated and perspective-squashed — it carries the silhouettes.
    scatterGround(ctx, W, H, {
      seed: CRYPT_SEED ^ 0x51,
      count: 96,
      kinds: [kStone, kStone, kBrick, kSlab, kCrack, kStone, kCrack, kBrick],
      ink: CRYPT_GROUND,
      pool: [566, 476, 520, 140],
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 210, CRYPT_GROUND.lit, CRYPT_GROUND.dark, 0.14, CRYPT_SEED ^ 0x5a, 18, FLOOR_Y - 10);
    // ...and the PIXEL ground over it, which is where the value lives: crowns,
    // beds, ruts and a scuffed lane on the actors' own 2-px grid.
    pixelGround(ctx, W, H, {
      seed: CRYPT_SEED ^ 0xa3,
      ink: CRYPT_PIX,
      count: 980,
      // The two foot pools, plus a THIRD wide one across the near ground: the
      // brief's "near plane lit MORE than the mid", and the reference's own
      // habit of putting its warmest, busiest ground right under the camera.
      pools: [[336, 470, 340, 128], [798, 470, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.5,
      tufts: 46,
    });
    groundGrain(ctx, W, H, CRYPT_GROUND, CRYPT_SEED ^ 0x9c, 900);
    // The masses that stand FORWARD of the wall — the middle third used to be
    // an empty column of floor. They belong to this plane: the floor is opaque
    // from FLOOR_Y down, so a prop drawn on the mid plane below the joint is
    // simply painted over.
    //
    // PLACEMENT. layout.ts put the enemies at x 206-452 and the party at
    // x 700-880 when this was authored, both on foot rows y 380/448/516, so
    // the free ground was the corridor around x 500-660. (UI round 4 packed
    // the ranks to ENEMY_FEET x 290-382 and HERO_FEET x 532-732; the corridor
    // between them is now x ~400-510 and the party's back seat stands at 532.) Below that corridor is not free either: the
    // battle log renders at x 360-930, y 545-580 and the skill list at
    // x 24-344, y 535-670, so a mass parked in the near ground sits behind
    // running text. The corridor at foot depth is the one place that is clear
    // of both foot clusters, of their contact shadows, and of the UI. A dark
    // slab under a foot cluster reads as a hole; this one's top edge used to
    // cut across the party's own contact shadows. It is also drawn as a LIT
    // cylinder rather than a silhouette: fallenColumn's barrel gradient
    // carries a top face well above the floor tone, so it can never be
    // mistaken for a cast shadow.
    fallenColumn(ctx, 568, FLOOR_Y + 120, 140, 24, -0.06, '#0e0a19', '#8a7896', 0.32);
    slabProp(ctx, 658, FLOOR_Y + 134, 54, 26, 0.3, '#0c0816', '#8a7896', 0.3);
    drum(ctx, 502, FLOOR_Y + 146, 56, 40, '#0e0a19', '#8a7896', 0.3);
    // The deep structural cracks the flagstones broke around — broken into
    // segments and branches, not three continuous rules down the floor.
    for (const [x0, x1] of [[560, 470], [760, 900], [640, 660]] as const) {
      crackRun(ctx, x0, x1, FLOOR_Y + 20, H, '#080610', 0.42, CRYPT_SEED ^ x0);
    }
    readingShade(ctx, W, H, '#07050d', 0.3);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, CRYPT_SEED);
  },

  near(ctx, W, H) {
    // Feathered curtains, not slabs: the old flat polygons ended on a straight
    // vertical edge ~60 px in and read as a rectangular vignette.
    edgeCurtain(ctx, W, H, 1, 168, CRYPT_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 186, CRYPT_NEAR_INK);
    poly(ctx, [-40, -40, 380, -40, 150, 74, 112, 150], CRYPT_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 380, -40, W - 158, 74, W - 120, 150], CRYPT_NEAR_INK);
    floorLip(ctx, W, H, CRYPT_NEAR_INK, 48);
  },
};

// ================================================================ FROST MARSH ==
// The opposite temperature and the opposite kind of space: no ceiling, no
// stone, a cold moon low over standing water. Same lighting geometry as the
// crypt — key upper left, cool fill from the lower right — because the sprites
// are lit that way and the scene has to agree with them.

const MARSH_FAR_INK = '#48627a';
const MARSH_MID_INK = '#12212b';
const MARSH_NEAR_INK = '#060f14';
/** Silt and shell against standing water — one step either side of the shallows. */
const MARSH_GROUND: GroundInk = { lit: '#3f6b76', dark: '#08131a', seam: '#061018' };
/**
 * The marsh bed at the ACTOR's cell (see `pixelGround`). Sun-bleached SEDGE
 * where the dusk fill off the right bank reaches the shallows, cold
 * water-stone where it does not — the second hue the floor needs to carry
 * chroma without the whole plane going one temperature. The warm family is
 * pulled toward the bed's own green (`#a3b184`, not the `#a8896a` it started
 * at): a straight ochre grain on teal water read as RUST, which is a different
 * material, not a different light.
 */
const MARSH_PIX: PixelInk = { lit: '#95a37a', mid: '#5b6a55', bed: '#0a1820', cool: '#2e6274', coolLit: '#63b6cc' };
const MARSH_SEED = 0x3e11;

/** A bare marsh tree: leaning trunk, three forks, no leaves. */
function deadTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number,
  lean: number,
  color: string,
): void {
  const top = base - h;
  poly(ctx, [x - h * 0.055, base, x + lean - h * 0.02, top, x + lean + h * 0.02, top, x + h * 0.055, base], color);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const forks: readonly (readonly [number, number, number])[] = [
    [0.42, -1, 0.34],
    [0.62, 1, 0.28],
    [0.8, -1, 0.2],
  ];
  for (const [at, dir, len] of forks) {
    const bx = x + lean * at;
    const by = base - h * at;
    ctx.lineWidth = Math.max(2, h * 0.035 * (1 - at));
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + dir * h * len * 0.6, by - h * len * 0.4, bx + dir * h * len, by - h * len * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A clump of reeds. A perfectly even radial fan repeated five times across a
 * frame is the thing the critic called out by name, so every blade takes its
 * own length, root offset and bow from the clump's seed and the whole fan
 * leans: no two clumps in a biome are the same shape.
 */
function reeds(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number,
  n: number,
  color: string,
  lean = 0,
  seed = 1,
): void {
  const rand = rng((seed * 2654435761) ^ Math.round(x * 7) ^ (n * 8191));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const skew = (rand() - 0.5) * 0.7;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1 + skew + (rand() - 0.5) * 0.25;
    const tip = h * (0.5 + rand() * 0.6) * (0.62 + (1 - Math.min(1, Math.abs(t))) * 0.38);
    const bow = lean * (0.4 + rand() * 0.8);
    ctx.lineWidth = 2 + (1 - Math.min(1, Math.abs(t))) * 3 + rand();
    ctx.beginPath();
    ctx.moveTo(x + t * 6 + (rand() - 0.5) * h * 0.06, base);
    ctx.quadraticCurveTo(x + t * tip * 0.35 + bow * 0.4, base - tip * 0.62, x + t * tip * 0.82 + bow, base - tip);
    ctx.stroke();
  }
  ctx.restore();
}

/** A half-sunken hull: a curved keel with a broken gunwale and one rib showing. */
function hull(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
  fill: string,
  rim: string,
  rimA: number,
): void {
  propShadow(ctx, x, y + h * 0.5, w * 0.5, 0.34);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const hw = w / 2;
  ctx.beginPath();
  ctx.moveTo(-hw, -h * 0.5);
  ctx.quadraticCurveTo(-hw * 0.2, h * 0.9, hw * 0.86, -h * 0.2);
  ctx.lineTo(hw, -h * 0.62);
  ctx.quadraticCurveTo(0, h * 0.1, -hw * 0.9, -h * 0.9);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  // The gunwale takes the moon, the belly falls away from it: without this the
  // wreck is one silhouette with a keyline drawn round its top edge.
  faceShade(ctx, [-hw, -h * 0.9, hw, -h * 0.62, hw * 0.86, h * 0.2, -hw * 0.2, h * 0.9], -h * 0.9, h * 0.6, rim, rimA * 0.9);
  rimEdge(ctx, [-hw * 0.9, -h * 0.9, 0, -h * 0.1, hw, -h * 0.62], rim, rimA, 2);
  ctx.save();
  ctx.globalAlpha = rimA * 0.7;
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  for (const t of [-0.3, 0.1, 0.46]) {
    ctx.beginPath();
    ctx.moveTo(hw * t, -h * 0.5);
    ctx.lineTo(hw * t + h * 0.1, h * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

const MARSH: BiomeLook = {
  id: 'FROST MARSH',
  key: { color: '#a8e6dc', x: 640, y: 110, radius: 520, alpha: 0.22, actorWeight: 0.5 },
  // THE OPPOSING FILL. This room's key is a cold moon; a cold fill under it
  // made every pixel one hue. The fill is now the dusk warmth off the lantern
  // on the far bank, so the two lights sit across the wheel.
  fill: { color: '#8f5c50', x: 1090, y: 620, radius: 660, alpha: 0.16, actorWeight: 1.4 },
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#8fe2d0', 0.504, 0.85),
  pool2: clusterPool(HERO_FEET, '#9de6d4', 0.576, 1.25),
  shafts: { color: '#a9e8dd', alpha: 0.055, x: 246, y: -80, angle: -0.4, count: 5, width: 42, length: 820, gap: 132 },
  grade: {
    shadow: '#12293c',
    shadowAlpha: 0.22,
    vignette: 0.62,
    highlight: '#a9e8dd',
    highlightAlpha: 0.09,
  },
  // THE MOON AS A LIGHT. First-ten-minutes defect 5: under `dimScene` it came
  // back a flat mid-grey disc with a cyan ring — a hole punched in the sky —
  // because a hard-edged disc under a uniform multiply is still a hard-edged
  // disc. `engine/light.ts` re-applies this additively after the grade, as a
  // core inside a wide falloff, and a gradient survives a multiply as a
  // gradient. Centred on the same (196, 126) the far plane paints it at.
  // Alpha kept LOW on purpose: the far plane already paints this disc as a
  // gradient, and an additive sprite strong enough to clip all three channels
  // is exactly what made the dimmed moon a flat grey coin with no chroma in it
  // (p10 = p50 = p90 = 53.2, satMean 0.0). The sprite's job is to keep the
  // body reading as a LIGHT through a multiply, not to become one.
  sky: { color: '#ffd9a8', x: 196, y: 126, r: 34, halo: 210, alpha: 0.2 },
  fog: { color: '#7fa8ad', alpha: 0.095, y: 272, height: 262, speed: 9, bands: 2 },
  motes: { color: '#cdeee4', count: 56, size: 8, rise: 12, drift: 15 },
  rim: '#bff0e2',
  ambient: 'snow',
  ambientColor: '#456a72',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#2c4a62'],
      [0.16, '#38607c'],
      [0.32, '#2a465c'],
      [0.48, '#3d5c6c'],
      [0.55, '#456471'],
      [0.66, '#223a45'],
      [1, '#13232c'],
    ]);
    skyMottle(ctx, W, 300, '#6d8ea0', '#132029', 0.17, MARSH_SEED ^ 0x71);
    // The break in the overcast, centred: the marsh's light well (see
    // `lightWell`) — the sky the moon is actually lighting, rather than a lamp
    // on a black field.
    lightWell(ctx, 640, 70, 262, 140, '#f0fbf8', '#8ecacd', 1, 2.8);
    wellShafts(ctx, 640, 120, 4, 320, 280, '#bfe6e4', 0.12, 0x3e11);
    // The cold moon, upper left, where the key light stands. Its disc is a
    // GRADIENT now, not a flat fill: first-ten-minutes defect 5 measured the
    // dimmed moon at p10 = p50 = p90 = 53.2, range 0.0, inside a cyan annulus —
    // and the flat opaque disc painted here is what the terminal overlay was
    // flattening. A hot core falling across its own limb survives a multiply.
    softBlob(ctx, 196, 126, 190, 190, '#2f6f74', 0.16);
    {
      const mg = ctx.createRadialGradient(196, 120, 0, 196, 126, 34);
      mg.addColorStop(0, '#ffeec2');
      mg.addColorStop(0.42, '#f0efd8');
      mg.addColorStop(0.74, '#d2ece2');
      mg.addColorStop(0.93, '#a9d4c8');
      mg.addColorStop(1, 'rgba(169,212,200,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(196, 126, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    softBlob(ctx, 196, 126, 70, 70, '#a8e6dc', 0.3);
    for (const [x, h] of [[96, 128], [178, 96], [330, 150], [452, 104], [600, 128], [742, 88], [1046, 116], [1180, 148]] as const) {
      deadTree(ctx, x, FLOOR_Y - 4, h, (x % 7) - 3, MARSH_FAR_INK);
    }
    // The far bank: already a broken line, now stepped harder and dropped in
    // two places where the water cuts back into it.
    poly(ctx, [
      0, FLOOR_Y, 0, FLOOR_Y - 24, 160, FLOOR_Y - 30, 300, FLOOR_Y - 36, 402, FLOOR_Y - 16,
      520, FLOOR_Y - 30, 700, FLOOR_Y - 20, 820, FLOOR_Y - 34, 1000, FLOOR_Y - 38,
      1102, FLOOR_Y - 18, W, FLOOR_Y - 26, W, FLOOR_Y,
    ], '#38566a');
    for (const [x, h, n, lean] of [[120, 58, 7, 6], [350, 50, 5, -8], [620, 64, 8, 3], [980, 46, 6, -5], [1180, 60, 7, 9]] as const) {
      reeds(ctx, x, FLOOR_Y - 12, h, n, '#3d6070', lean, x);
    }
    // Standing haze — the marsh's aerial perspective, heavier than the crypt's.
    hazeWash(ctx, W, 130, '#a0c4c6', 0.26, MARSH_SEED);
  },

  mid(ctx, W) {
    const RIM = '#7fb0ac';
    deadTree(ctx, 306, FLOOR_Y + 28, 268, 22, MARSH_MID_INK);
    deadTree(ctx, 1064, FLOOR_Y + 34, 290, -26, MARSH_MID_INK);
    deadTree(ctx, 962, FLOOR_Y + 6, 148, 14, MARSH_MID_INK);
    // The jetty, and the pilings that once carried it.
    // TWO PLANKS at different heights with a broken end between them, not one
    // 270-px board: its deck line was the last straight rule left in the set
    // (353 px at y 408 on `bd-FROST_MARSH` at HIGH, 346 at MED). A jetty this
    // rotten does not keep one level edge across its whole length.
    const deckA = [1180, FLOOR_Y + 40, 1162, FLOOR_Y + 2, 1028, FLOOR_Y + 8, 1040, FLOOR_Y + 46];
    const deckB = [1036, FLOOR_Y + 48, 1022, FLOOR_Y + 16, 886, FLOOR_Y + 26, 898, FLOOR_Y + 58];
    poly(ctx, deckA, '#101f28');
    faceShade(ctx, deckA, FLOOR_Y + 2, FLOOR_Y + 46, RIM, 0.3);
    poly(ctx, deckB, '#0e1c24');
    faceShade(ctx, deckB, FLOOR_Y + 16, FLOOR_Y + 58, RIM, 0.24);
    propShadow(ctx, 1030, FLOOR_Y + 60, 150, 0.3);
    for (const [x, h] of [[920, 62], [986, 74], [1052, 54], [1120, 68]] as const) {
      ctx.fillStyle = '#0c1a22';
      ctx.fillRect(x, FLOOR_Y + 10, 9, h);
    }

    // Six masses at three depths and three scales, none of them mirrored.
    // 3. A leaning cairn of flat stones, further back and smaller.
    for (const [x, y, w, h, r] of [
      [498, FLOOR_Y + 12, 46, 13, 0.05],
      [500, FLOOR_Y - 1, 38, 12, -0.1],
      [503, FLOOR_Y - 13, 27, 11, 0.14],
    ] as const) {
      slabProp(ctx, x, y, w, h, r, '#0e1c24', RIM, 0.12);
    }
    // 4. A broken fence walking out of the water at the left, posts at four
    //    heights and none of them upright.
    for (const [x, h, r] of [[142, 66, 0.07], [186, 48, -0.13], [226, 58, 0.16], [262, 38, -0.05]] as const) {
      slabProp(ctx, x, FLOOR_Y + 34, 11, h, r, '#0b171f', RIM, 0.34);
    }
    // 5. A tussock of dead sedge on its own hummock, nearest of the lot.
    reeds(ctx, 700, FLOOR_Y + 46, 104, 9, '#0d1b23', 22, 3);
    reeds(ctx, 430, FLOOR_Y + 30, 88, 7, '#0d1b23', -26, 11);
    // 6. THE OPPOSING ACCENT: a lantern on a leaning post at the far right
    //    bank, the one warm light in a cold room. Kept past x 950, out of the
    //    actor band, and small enough to read as a lamp and not a second moon.
    slabProp(ctx, 1146, FLOOR_Y + 30, 10, 96, -0.06, '#0a151c', RIM, 0.34);
    poly(ctx, [1138, FLOOR_Y - 66, 1136, FLOOR_Y - 84, 1160, FLOOR_Y - 84, 1158, FLOOR_Y - 66], '#0d1219');
    softBlob(ctx, 1148, FLOOR_Y - 75, 62, 58, '#ff9a44', 0.3);
    softBlob(ctx, 1148, FLOOR_Y - 75, 12, 12, '#ffd9a0', 0.5);

    // Will-o'-wisps, kept off the actor row so nothing bright sits behind a head.
    for (const [x, y, r] of [[188, 336, 22], [268, 296, 14], [104, 380, 12], [1236, 452, 15]] as const) {
      softBlob(ctx, x, y, r * 3.6, r * 3.6, '#2f8f76', 0.5);
      softBlob(ctx, x, y, r, r, '#d8fff0', 0.8);
    }
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // A half-sunk punt against a rotted stump, out in the shallows.
    hull(ctx, 596, FLOOR_Y + 4, 148, 38, -0.06, '#0c1a22', RIM, 0.12);
    slabProp(ctx, 678, FLOOR_Y + 10, 30, 74, 0.08, '#0b171f', RIM, 0.12);
    poly(ctx, [660, FLOOR_Y - 62, 666, FLOOR_Y - 78, 694, FLOOR_Y - 74, 690, FLOOR_Y - 58], '#0b171f');
    reeds(ctx, 636, FLOOR_Y + 16, 62, 6, '#0c1a21', 16, 29);
    // Two dead trunks stripped white under the break (see `litPylon`).
    litPylon(ctx, 486, FLOOR_Y + 16, 34, 74, '#cfe2dc', '#0d1c24', RIM);
    litPylon(ctx, 828, FLOOR_Y + 20, 40, 92, '#c2d8d4', '#0b1a21', RIM);
    jointSpeckle(ctx, W, MARSH_GROUND, MARSH_SEED ^ 0x3d, 380);
    horizonGlint(ctx, W, FLOOR_Y - 6, '#9fe4d6', 0.07, MARSH_SEED, 8, 14);
  },

  floor(ctx, W, H) {
    // LIT FROM THE FRONT, like the crypt's: the shallows brighten as they come
    // toward the camera and ease back only in the last rows. `octopath-2` is
    // the case that settles it — a NIGHT forest that still holds a warm, lit
    // silt strip across its near ground at p50 45.8, because that is where the
    // camera is and the eye needs somewhere to stand.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#22434f'],
      [0.18, '#2b5059'],
      [0.48, '#3b6360'],
      [0.66, '#4a7d6d'],
      [0.84, '#69a98a'],
      [1, '#5f9c7e'],
    ]);
    // Ripples, BROKEN. These were eight full-width fillRects — dead-straight
    // 1280-px rules lying on the water, the same defect as a straight horizon
    // one plane lower. Each course is now three to six segments at their own
    // phase, length and lift, with a gradient feathering both ends into
    // nothing, so no run of constant edge survives.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rip = rng(MARSH_SEED ^ 0x0f);
    let sy = FLOOR_Y + 10;
    let sstep = 11;
    while (sy < H) {
      const t = (sy - FLOOR_Y) / (H - FLOOR_Y);
      const thick = Math.max(1, 1 + t * 3);
      const segs = 3 + Math.floor(rip() * 4);
      let x = -60 - rip() * 120;
      for (let i = 0; i < segs && x < W + 40; i++) {
        const len = (110 + rip() * 250) * (0.6 + t);
        const yy = sy + (rip() - 0.5) * 6 * (0.4 + t);
        const a = 0.05 * (1 - t * 0.5) * (0.5 + rip() * 0.9);
        const g = ctx.createLinearGradient(x, 0, x + len, 0);
        g.addColorStop(0, 'rgba(127,182,189,0)');
        g.addColorStop(0.28, hexA('#7fb6bd', a));
        g.addColorStop(0.72, hexA('#7fb6bd', a));
        g.addColorStop(1, 'rgba(127,182,189,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, yy, len, thick);
        x += len + (50 + rip() * 190) * (0.6 + t);
      }
      sy += sstep;
      sstep *= 1.3;
    }
    ctx.restore();
    // Silt drifts sweeping down the stage diagonal, and the darker channels
    // between them where the water runs deeper.
    scuffBand(ctx, 240, FLOOR_Y + 30, 720, H - 20, 90, 200, '#3c6670', 0.045, true);
    scuffBand(ctx, 900, FLOOR_Y + 24, 470, H + 20, 76, 176, '#08131a', 0.26, false);
    scuffBand(ctx, 120, FLOOR_Y + 52, 60, H - 40, 70, 150, '#08131a', 0.26, false);
    // The moon's column, widening as it comes forward.
    // The moon's column, widening as it comes forward — and STOPPING short of
    // the near ground: it used to run to the bottom edge, straight through the
    // corner the skill list is read against (p99 59 there against a ~50 bar).
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const y = FLOOR_Y + 14 + t * (H - FLOOR_Y) * 0.66;
      const w = 30 + t * 130;
      softBlob(ctx, 196 + Math.sin(i * 0.9) * 10, y, w, 7 + t * 11, '#9fe6d8', 0.095 * (1 - t * 0.78));
    }
    // Silt and broken shells: the bed of the shallows, crowded into the two
    // lit pools and thinning into the vignette.
    scatterGround(ctx, W, H, {
      seed: MARSH_SEED ^ 0x71,
      count: 108,
      kinds: [kDrift, kShell, kStone, kDrift, kTuft, kShell, kShard],
      ink: MARSH_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.56,
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 210, MARSH_GROUND.lit, MARSH_GROUND.dark, 0.14, MARSH_SEED ^ 0x5a, 18, FLOOR_Y - 10);
    // ...and the PIXEL ground over it, on the actors' own 2-px grid: crowns,
    // beds, ruts and a scuffed lane, at 25-40 % local contrast. This is where
    // the plane's VALUE lives; the soft scatter above only carries silhouettes.
    // The two foot pools plus a third wide one across the near ground — the
    // near plane has to be lit MORE than the mid, not less.
    pixelGround(ctx, W, H, {
      seed: MARSH_SEED ^ 0xa7,
      ink: MARSH_PIX,
      count: 760,
      pools: [[336, 462, 340, 128], [798, 462, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.58,
      tufts: 64,
    });
    groundGrain(ctx, W, H, MARSH_GROUND, MARSH_SEED ^ 0x9c, 760, 0.85);
    // The two masses forward of the bank: the floor plane is opaque from
    // FLOOR_Y down, so anything standing in the shallows belongs here.
    fallenColumn(ctx, 566, FLOOR_Y + 116, 148, 20, 0.04, '#0a1a22', '#79a8a6', 0.32);
    hull(ctx, 1042, FLOOR_Y + 132, 236, 62, 0.1, '#07131a', '#7fb0ac', 0.44);
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const x of [306, 962, 1064]) {
      vgrad(ctx, x - 32, FLOOR_Y, 64, 210, [
        [0, '#08141a'],
        [1, 'rgba(8,20,26,0)'],
      ]);
    }
    ctx.restore();
    for (const [x, base, h, n, lean] of [[252, 552, 92, 5, 10], [1046, 566, 84, 6, -12]] as const) {
      reeds(ctx, x, base, h, n, '#0a171d', lean, x);
    }
    readingShade(ctx, W, H, '#040c11', 0.34);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, MARSH_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 150, MARSH_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 158, MARSH_NEAR_INK);
    reeds(ctx, 118, H + 30, 420, 9, MARSH_NEAR_INK, 60, 5);
    reeds(ctx, W - 128, H + 30, 380, 9, MARSH_NEAR_INK, -52, 17);
    ctx.save();
    ctx.strokeStyle = MARSH_NEAR_INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.quadraticCurveTo(240, 60, 470, 34);
    ctx.stroke();
    ctx.lineWidth = 11;
    for (const [x, y] of [[318, 60], [412, 44]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 30, y + 70, x + 6, y + 132);
      ctx.stroke();
    }
    ctx.restore();
    floorLip(ctx, W, H, MARSH_NEAR_INK, 48);
  },
};

// ================================================================ SKY RUINS ===
// Open air over a broken sky-city at dusk: the same key-upper-left /
// fill-lower-right geometry as every other biome, but the light is a low sun
// instead of a flame or a moon, and the "walls" are chunks of masonry with
// nothing holding them up. The actor row stays a gap of open twilight sky —
// islands and wind streaks crowd the edges and cross high overhead; nothing
// bright drifts through the middle at head height.

const RUINS_FAR_INK = '#3c3a5e';
const RUINS_MID_INK = '#3a3560';
const RUINS_NEAR_INK = '#0b0a17';
/** Weathered masonry and dead grass over a violet platform. */
const RUINS_GROUND: GroundInk = { lit: '#57506f', dark: '#0d0b1a', seam: '#090714' };
/** Sunlit sandstone against the platform's violet shadow (see `pixelGround`). */
const RUINS_PIX: PixelInk = { lit: '#b09270', mid: '#5b4d52', bed: '#150f22', cool: '#464070', coolLit: '#7d76b4' };
const RUINS_SEED = 0x5c99;

/** A chunk of floating rock: a flat-ish top, a jagged broken underside. */
function floatIsland(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  fill: string,
  rim?: string,
  rimA = 0.3,
): void {
  const hw = w / 2;
  const pts = [
    x - hw, baseY - h * 0.32,
    x - hw * 0.7, baseY - h,
    x - hw * 0.1, baseY - h * 0.86,
    x + hw * 0.55, baseY - h,
    x + hw, baseY - h * 0.3,
    x + hw * 0.62, baseY - h * 0.05,
    x + hw * 0.2, baseY,
    x - hw * 0.35, baseY - h * 0.08,
  ];
  poly(ctx, pts, fill);
  // With a rim these are MASSES, not trapezoids: the sun is upper left, so the
  // crust is the lit plane, the rock hanging under it the shaded one, and
  // `faceShade`'s break falls where the soil stops and the stone starts. Round
  // 3 named `ff-bd-SKY_RUINS.png`'s islands as the worst case of a flat
  // silhouette on this plane. The NEAR-plane copies pass no rim — that plane is
  // the darkest thing on screen by contract and stays a cut-out.
  if (rim) {
    faceShade(ctx, pts, baseY - h, baseY, rim, rimA);
    rimEdge(ctx, [
      x - hw, baseY - h * 0.32,
      x - hw * 0.7, baseY - h,
      x - hw * 0.1, baseY - h * 0.86,
      x + hw * 0.55, baseY - h,
    ], rim, rimA * 1.15, 2);
    // The keel: a second, darker mass under the break, so the island reads as
    // soil ON rock rather than one carved chip.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + hw * 0.1, baseY + h * 0.12, hw * 0.92, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** A thin wind-blown streak — a tapered curved stroke, never a filled shape. */
function windStreak(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, bow: number, color: string, alpha: number, width: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.5, y + bow, x + len, y - bow * 0.4);
  ctx.stroke();
  ctx.restore();
}

/** A flight of broken steps climbing away from the camera, each tread shorter than the last. */
function stairs(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  steps: number,
  rise: number,
  fill: string,
  rim: string,
  rimA: number,
): void {
  propShadow(ctx, x, baseY, w * 0.6, 0.36);
  let hw = w / 2;
  let y = baseY;
  for (let i = 0; i < steps; i++) {
    poly(ctx, [x - hw, y, x - hw, y - rise, x + hw, y - rise, x + hw, y], fill);
    rimEdge(ctx, [x - hw, y - rise, x + hw, y - rise], rim, rimA * (1 - i * 0.12));
    y -= rise;
    hw *= 0.82;
    x += w * 0.04;
  }
}

const RUINS: BiomeLook = {
  id: 'SKY RUINS',
  key: { color: '#ffd9a4', x: 632, y: 120, radius: 520, alpha: 0.22, actorWeight: 0.5 },
  // The opposing fill is the risen moon and the night half of the sky, pushed
  // properly blue against the dusk sun rather than sharing its violet.
  fill: { color: '#4e6cc4', x: 1050, y: 560, radius: 680, alpha: 0.19, actorWeight: 1.4 },
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#ffd699', 0.552, 0.85),
  pool2: clusterPool(HERO_FEET, '#ffdca8', 0.624, 1.25),
  shafts: { color: '#ffdca0', alpha: 0.06, x: 258, y: -90, angle: -0.42, count: 4, width: 46, length: 830, gap: 140 },
  grade: {
    shadow: '#221a3c',
    shadowAlpha: 0.2,
    vignette: 0.62,
    highlight: '#ffdca0',
    highlightAlpha: 0.09,
  },
  // The low sun, re-applied after the grade so a terminal overlay dims it as a
  // LIGHT and not into a grey coin (see MARSH.sky and engine/light.ts SkyLight).
  sky: { color: '#ffe6b0', x: 220, y: 138, r: 32, halo: 210, alpha: 0.4 },
  fog: { color: '#8f96c8', alpha: 0.05, y: 260, height: 240, speed: 6, bands: 2 },
  motes: { color: '#e8ddff', count: 58, size: 7, rise: -10, drift: 22 },
  rim: '#ffe0a8',
  ambient: 'stars',
  ambientColor: '#cdd0ff',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#2a2650'],
      [0.14, '#3a3468'],
      [0.26, '#2b2554'],
      [0.34, '#252150'],
      [0.46, '#3e3763'],
      [0.56, '#5a4a6e'],
      [0.64, '#6c5464'],
      [0.72, '#7a5a5c'],
      [1, '#16142a'],
    ]);
    skyMottle(ctx, W, 380, '#7a6ea6', '#100d24', 0.3, RUINS_SEED ^ 0x71, 20);
    // The break the low sun is coming through, centred (see `lightWell`).
    lightWell(ctx, 632, 78, 276, 146, '#fff8ea', '#eab98a', 1, 2.9);
    wellShafts(ctx, 632, 126, 5, 340, 300, '#ffe6bd', 0.14, 0x5c99);
    // A scatter of faint stars, well above head height, dim enough to never outshine the sun.
    ctx.save();
    ctx.fillStyle = '#f2eaff';
    const starXY: readonly (readonly [number, number, number])[] = [
      [80, 60, 0.5], [140, 110, 0.35], [420, 50, 0.4], [520, 90, 0.3], [700, 40, 0.45],
      [900, 70, 0.3], [1020, 110, 0.4], [1150, 55, 0.35], [1200, 130, 0.3], [980, 160, 0.25],
      [260, 150, 0.3], [60, 170, 0.3],
    ];
    for (const [x, y, a] of starXY) {
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
    // The low dusk sun, hard left of the actor row — same side as the key light it feeds.
    softBlob(ctx, 220, 138, 190, 190, '#ffb85e', 0.3);
    ctx.beginPath();
    ctx.arc(220, 138, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#fff1d8';
    ctx.fill();
    softBlob(ctx, 220, 138, 62, 62, '#ffe6b0', 0.32);
    // THE OPPOSING ACCENT: the moon already up on the night side, and the cold
    // half of the sky behind it. Warm sun, cold sky — the two ends of the
    // reference frame's wheel. Held past x 950 and high, out of the actor band.
    softBlob(ctx, 1046, 118, 230, 220, '#3f63b8', 0.3);
    ctx.beginPath();
    ctx.arc(1046, 118, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#cfd8ff';
    ctx.fill();
    softBlob(ctx, 1046, 118, 46, 46, '#9fb2ff', 0.26);
    // Distant floating islands, hazy, spread the full width but kept above the head band.
    for (const [x, y, w, h] of [[120, 210, 130, 60], [430, 180, 90, 44], [760, 230, 150, 64], [1080, 190, 110, 52], [1220, 260, 90, 46]] as const) {
      floatIsland(ctx, x, y, w, h, RUINS_FAR_INK);
    }
    // A broken causeway crossing the gulf, well above head height.
    ctx.save();
    ctx.globalAlpha = 0.55;
    poly(ctx, [560, 268, 700, 246, 830, 254, 830, 264, 700, 258, 560, 280], RUINS_FAR_INK);
    ctx.globalAlpha = 0.4;
    for (const x of [604, 664, 726, 790]) poly(ctx, [x - 4, 258, x + 4, 256, x + 4, 288, x - 4, 290], RUINS_FAR_INK);
    ctx.restore();
    windStreak(ctx, -20, 150, 340, -26, '#dcd6ff', 0.14, 3);
    windStreak(ctx, 900, 220, 320, -18, '#dcd6ff', 0.12, 2);
    hazeWash(ctx, W, 150, '#aa96aa', 0.28, RUINS_SEED);
    // A broken skyline where the platform meets the air, not a 1280-px rule.
    // TWELVE segments at a 30-px step, not nine at 19. The joint carried a
    // 316-px straight rule at y 394, x 717-1033 at LOW and ARCADE (306 px even
    // at the 4-L threshold) — two adjacent segments that happened to land at
    // the same height, chained. More segments and a taller step is the same
    // lever the forge's horizon needed.
    horizonBand(ctx, W, FLOOR_Y - 10, 28, '#241f38', RUINS_SEED, 12, 30);
  },

  mid(ctx, W) {
    const RIM = '#c0a8d0';
    // Bigger, closer masonry, still clear of the actor row at head height.
    floatIsland(ctx, 210, FLOOR_Y - 70, 210, 130, RUINS_MID_INK, RIM, 0.26);
    pillar(ctx, 236, FLOOR_Y - 176, FLOOR_Y - 76, 16, RUINS_MID_INK, '#443e6c');
    floatIsland(ctx, 1080, FLOOR_Y - 40, 240, 150, RUINS_MID_INK, RIM, 0.26);
    arch(ctx, 1080, 44, FLOOR_Y - 172, FLOOR_Y - 76, RUINS_MID_INK);
    // The arch's key-lit edge — the side facing the sun catches a warm rim,
    // the one thing that reads this as a RUIN and not a silhouette cut-out.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffd699';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1036, FLOOR_Y - 128);
    ctx.quadraticCurveTo(1036, FLOOR_Y - 172, 1080, FLOOR_Y - 172);
    ctx.stroke();
    ctx.restore();
    floatIsland(ctx, 620, 150, 130, 60, '#38335c', RIM, 0.2);

    // Six masses at three depths and three scales, none of them mirrored, each
    // with a rim on the key side and a shadow on the ground.
    // 2. A statue's plinth, its figure broken off above the ankles.
    slabProp(ctx, 438, FLOOR_Y + 24, 62, 74, -0.03, '#241e42', RIM, 0.15);
    slabProp(ctx, 434, FLOOR_Y - 50, 30, 34, 0.12, '#241e42', RIM, 0.15);
    // 3. A flight of broken steps climbing out of frame at the right.
    stairs(ctx, 916, FLOOR_Y + 30, 150, 4, 15, '#1d193a', RIM, 0.15);
    // A snapped baluster standing ACROSS the joint at x 790, between the
    // stairs and the centre mass: the run above needs occluding as well as
    // stepping, and this is the gap it ran through.
    slabProp(ctx, 790, FLOOR_Y + 22, 26, 96, 0.04, '#1a1636', RIM, 0.13);
    drum(ctx, 828, FLOOR_Y + 30, 34, 22, '#1a1636', RIM, 0.12);
    // 5. Masonry at the left edge — where there used to be two identical
    //    trapezoids at 520 and 780. Their crowns must not sit at the same
    //    height OR be flat: two level tops a block apart, softened by the mid
    //    plane's 2.6-px blur, merged into one horizontal edge that ran on into
    //    the haze ramp beside it.
    ctx.save();
    ctx.translate(128, FLOOR_Y + 44);
    ctx.rotate(0.05);
    propShadow(ctx, 0, 0, 76, 0.4);
    poly(ctx, [-54, 0, -50, -70, -8, -58, 14, -76, 50, -62, 54, 0], '#171432');
    rimEdge(ctx, [-54, 0, -50, -70, -8, -58, 14, -76, 50, -62], RIM, 0.34, 2);
    ctx.restore();
    drum(ctx, 214, FLOOR_Y + 30, 62, 30, '#171432', RIM, 0.34);
    slabProp(ctx, 288, FLOOR_Y + 46, 46, 96, -0.1, '#171432', RIM, 0.34);
    // 6. A leaning capital half over the platform's edge, right of the party.
    slabProp(ctx, 1188, FLOOR_Y + 34, 78, 44, 0.22, '#171432', RIM, 0.32);

    windStreak(ctx, 340, 260, 300, -20, '#bcb4e8', 0.12, 3);
    windStreak(ctx, 760, 300, 260, 18, '#bcb4e8', 0.1, 2);
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // A fallen arch springer, still carrying two courses of its voussoirs.
    slabProp(ctx, 612, FLOOR_Y + 24, 130, 40, -0.02, '#191531', RIM, 0.11);
    poly(ctx, [566, FLOOR_Y - 14, 574, FLOOR_Y - 86, 626, FLOOR_Y - 78, 638, FLOOR_Y - 10], '#1b1734');
    faceShade(ctx, [566, FLOOR_Y - 14, 574, FLOOR_Y - 86, 626, FLOOR_Y - 78, 638, FLOOR_Y - 10], FLOOR_Y - 86, FLOOR_Y - 10, RIM, 0.13);
    rimEdge(ctx, [566, FLOOR_Y - 14, 574, FLOOR_Y - 86, 626, FLOOR_Y - 78], RIM, 0.1, 2);
    drum(ctx, 686, FLOOR_Y + 22, 52, 30, '#1b1734', RIM, 0.1);
    // Two standing stones taking the low sun (see `litPylon`).
    litPylon(ctx, 494, FLOOR_Y + 18, 50, 88, '#e2c49c', '#1c1838', RIM);
    litPylon(ctx, 820, FLOOR_Y + 22, 56, 104, '#d6b891', '#191534', RIM);
    jointSpeckle(ctx, W, RUINS_GROUND, RUINS_SEED ^ 0x3d, 700);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#ffc888', 0.08, RUINS_SEED, 9, 19);
  },

  floor(ctx, W, H) {
    // Lit from the front (see MARSH.floor): the platform catches the low sun
    // hardest where it is nearest the camera.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#2b2740'],
      [0.18, '#3c3350'],
      [0.48, '#584659'],
      [0.8, '#b48764'],
      [1, '#a97d5b'],
    ]);
    // Where feet crossed the platform, and where the wind laid the dust down.
    scuffBand(ctx, 280, FLOOR_Y + 32, 730, H - 24, 92, 200, '#443c60', 0.05, true);
    scuffBand(ctx, 940, FLOOR_Y + 28, 560, H + 16, 80, 180, '#0b0916', 0.26, false);
    scuffBand(ctx, 150, FLOOR_Y + 54, 90, H - 40, 72, 152, '#0b0916', 0.26, false);
    // A whisper of the perspective grid — structure, not a synthwave floor.
    floorGrid(ctx, W, H, '#584f7c', 0.03, RUINS_SEED);
    // Broken flagstones: irregular missing slabs, not a uniform lattice.
    for (const [x, y, w, h] of [[400, 470, 90, 46], [880, 520, 110, 50], [640, 600, 70, 34]] as const) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      poly(ctx, [x - w / 2, y, x - w * 0.3, y - h / 2, x + w * 0.4, y - h * 0.4, x + w / 2, y + h * 0.1, x + w * 0.2, y + h / 2, x - w * 0.2, y + h * 0.4], '#0e0b1a');
      ctx.restore();
    }
    // Broken masonry and the weeds that took the joints.
    scatterGround(ctx, W, H, {
      seed: RUINS_SEED ^ 0x2d,
      count: 124,
      kinds: [kBrick, kStone, kTuft, kSlab, kCrack, kBrick, kTuft, kStone],
      ink: RUINS_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.5,
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 230, '#8f7b9e', '#120f22', 0.26, RUINS_SEED ^ 0x5a, 22, FLOOR_Y - 14);
    // ...and the PIXEL ground over it, on the actors' own 2-px grid: crowns,
    // beds, ruts and a scuffed lane, at 25-40 % local contrast. This is where
    // the plane's VALUE lives; the soft scatter above only carries silhouettes.
    // The two foot pools plus a third wide one across the near ground — the
    // near plane has to be lit MORE than the mid, not less.
    pixelGround(ctx, W, H, {
      seed: RUINS_SEED ^ 0xa7,
      ink: RUINS_PIX,
      count: 800,
      pools: [[336, 462, 340, 128], [798, 462, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.5,
      tufts: 52,
    });
    groundGrain(ctx, W, H, RUINS_GROUND, RUINS_SEED ^ 0x9c, 860);
    // The two masses standing forward of the wall line — the floor plane is
    // opaque from FLOOR_Y down, so they belong to it and not to mid().
    fallenColumn(ctx, 552, FLOOR_Y + 122, 144, 23, 0.05, '#12102a', '#a294bc', 0.32);
    // The right third measured the least local detail of the three: a spill of
    // rubble at the stair foot and a toppled lintel past the stage's edge.
    for (const [x, y, w, h, r] of [
      [872, FLOOR_Y + 96, 46, 16, 0.08],
      [906, FLOOR_Y + 108, 34, 13, -0.2],
      [858, FLOOR_Y + 120, 28, 11, 0.3],
    ] as const) {
      slabProp(ctx, x, y, w, h, r, '#131029', '#a294bc', 0.15);
    }
    fallenColumn(ctx, 1062, FLOOR_Y + 142, 118, 19, -0.05, '#131029', '#a294bc', 0.3);
    drum(ctx, 1156, FLOOR_Y + 106, 46, 34, '#131029', '#a294bc', 0.3);
    drum(ctx, 648, FLOOR_Y + 140, 60, 46, '#131029', '#a294bc', 0.3);
    // Cracks radiating between the broken slabs — a platform holding itself
    // together, not a void.
    for (const [x0, x1] of [[520, 440], [740, 860], [640, 620], [420, 340], [900, 960]] as const) {
      crackRun(ctx, x0, x1, FLOOR_Y + 18, H, '#080612', 0.46, RUINS_SEED ^ x0);
    }
    // The platform's broken edge, hard left and right — this floor ends in open air.
    poly(ctx, [0, H, 0, FLOOR_Y + 30, 60, FLOOR_Y + 50, 30, FLOOR_Y + 90, 0, H], '#0c0a16');
    poly(ctx, [W, H, W, FLOOR_Y + 34, W - 54, FLOOR_Y + 56, W - 26, FLOOR_Y + 96, W, H], '#0c0a16');
    readingShade(ctx, W, H, '#080713', 0.3);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, RUINS_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 152, RUINS_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 164, RUINS_NEAR_INK);
    floatIsland(ctx, 60, 40, 220, 130, RUINS_NEAR_INK);
    floatIsland(ctx, W - 60, 70, 220, 140, RUINS_NEAR_INK);
    // Foreground wind, STEEP and short. These used to be two 300-px near-flat
    // swipes at 10 px wide; blurred by 8 on this plane they became a soft dark
    // band lying almost level across the left of the frame at head height —
    // 362 px of one horizontal edge at HIGH, and invisible at LOW because LOW
    // draws no near plane at all. Steep, shorter and thinner, they read as
    // wind and cross the frame diagonally instead of ruling it.
    windStreak(ctx, -30, H * 0.30, 190, -96, RUINS_NEAR_INK, 0.42, 7);
    windStreak(ctx, 40, H * 0.62, 150, -78, RUINS_NEAR_INK, 0.34, 6);
    windStreak(ctx, W + 30, H * 0.26, -180, 92, RUINS_NEAR_INK, 0.42, 7);
    windStreak(ctx, W - 50, H * 0.58, -140, 74, RUINS_NEAR_INK, 0.34, 6);
    floorLip(ctx, W, H, RUINS_NEAR_INK, 48);
  },
};

// ================================================================ ASHEN FORGE ==
// An industrial furnace hall: the same warm-key / cool-fill geometry as the
// crypt, pushed hotter and harder — one great furnace mouth at the far left
// throws the key light, chains hang from a ceiling that never fully resolves,
// and anvils sit at the edges. The actor row stays dark iron and soot; the
// glow lives at the margins, the same discipline as the crypt's brazier.

const FORGE_FAR_INK = '#4a2a22';
const FORGE_MID_INK = '#241d1a';
const FORGE_NEAR_INK = '#090504';
/** Slag, cinder and scale over a soot floor. */
const FORGE_GROUND: GroundInk = { lit: '#5b4438', dark: '#0a0706', seam: '#070403' };
/** Furnace-lit brick against cold grey slag (see `pixelGround`). */
const FORGE_PIX: PixelInk = { lit: '#b0813f', mid: '#584237', bed: '#150c08', cool: '#4a4548', coolLit: '#8a8288' };
const FORGE_SEED = 0xf01e;

/** An anvil silhouette: a flat base, a tapered waist, a horn to one side. `dir` mirrors the horn. */
function anvilShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  fill: string,
  dir: 1 | -1 = 1,
  rim?: string,
  rimA = 0.3,
): void {
  const hw = (w / 2) * dir;
  const base = [x - hw * 0.55, baseY, x - hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY];
  const waist = [x - hw * 0.4, baseY - w * 0.16, x - hw * 0.28, baseY - w * 0.5, x + hw * 0.28, baseY - w * 0.5, x + hw * 0.4, baseY - w * 0.16];
  const face = [x - hw * 0.5, baseY - w * 0.5, x - hw * 0.5, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.5];
  const horn = [x + hw * 0.2, baseY - w * 0.58, x + hw * 1.1, baseY - w * 0.7, x + hw * 1.08, baseY - w * 0.58, x + hw * 0.28, baseY - w * 0.48];
  poly(ctx, base, fill);
  poly(ctx, waist, fill);
  poly(ctx, face, fill);
  poly(ctx, horn, fill);
  // Four flat quads at one value is a pictogram of an anvil. The furnace is up
  // and left, so the FACE takes the light and the waist and plinth fall away
  // under it, each with `faceShade`'s hard break across the middle.
  if (rim) {
    faceShade(ctx, face, baseY - w * 0.62, baseY - w * 0.46, rim, rimA * 1.6);
    faceShade(ctx, horn, baseY - w * 0.7, baseY - w * 0.46, rim, rimA);
    faceShade(ctx, waist, baseY - w * 0.5, baseY - w * 0.16, rim, rimA * 0.6);
    faceShade(ctx, base, baseY - w * 0.16, baseY, rim, rimA * 0.5);
    rimEdge(ctx, [x - hw * 0.5, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.62], rim, rimA * 1.4, 2);
  }
}

/** A hanging chain: a column of small linked rings. */
function chainLine(ctx: CanvasRenderingContext2D, x: number, topY: number, botY: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  const link = 13;
  for (let y = topY; y < botY; y += link) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const FORGE: BiomeLook = {
  id: 'ASHEN FORGE',
  key: { color: '#ffb478', x: 646, y: 100, radius: 520, alpha: 0.24, actorWeight: 0.5 },
  // The cold half of the room: daylight and steam falling through the roof
  // vents on the far right, opposite the furnace mouth.
  fill: { color: '#5a76b8', x: 1085, y: 560, radius: 680, alpha: 0.22, actorWeight: 1.4 },
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#ff8a4a', 0.912, 0.85),
  pool2: clusterPool(HERO_FEET, '#ff9a5e', 0.84, 1.25),
  shafts: { color: '#ff8552', alpha: 0.07, x: 140, y: -80, angle: -0.5, count: 4, width: 50, length: 1040, gap: 150 },
  grade: {
    shadow: '#2a1210',
    shadowAlpha: 0.22,
    vignette: 0.66,
    highlight: '#ff9a5c',
    highlightAlpha: 0.11,
  },
  fog: { color: '#5a3a2e', alpha: 0.06, y: 300, height: 260, speed: 6, bands: 2 },
  motes: { color: '#ffab5a', count: 66, size: 8, rise: -30, drift: 14 },
  rim: '#ffb073',
  ambient: 'embers',
  ambientColor: '#c1360f',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#3a2c22'],
      [0.14, '#4a382a'],
      [0.3, '#3c261a'],
      [0.46, '#341c14'],
      [0.56, '#3e2216'],
      [0.68, '#241410'],
      [1, '#120a08'],
    ]);
    skyMottle(ctx, W, 300, '#6b5442', '#150e0a', 0.17, FORGE_SEED ^ 0x71);
    // THE ROOF LIGHT, centred. The forge measured 89.3 % of its frame below
    // L 35 — the darkest of the six by 24 points — and its whole top band at
    // p50 15.0. A furnace hall has a louvred roof over the hearth for the heat
    // to leave by, and that is where the daylight comes in: a cold shaft down
    // the middle of a room that is otherwise all fire, which is the opposing
    // accent this biome already keeps at its right-hand vent, moved to where
    // the eye should be.
    ctx.save();
    ctx.globalAlpha = 0.8;
    poly(ctx, [486, -20, 806, -20, 792, 74, 660, 112, 520, 78], '#120c0a');
    ctx.restore();
    lightWell(ctx, 646, 46, 206, 106, '#ffeacd', '#c99a6e', 0.92, 2.7);
    wellShafts(ctx, 646, 92, 5, 300, 320, '#ffd7a8', 0.12, 0xf01e);
    // The great furnace mouth, hard left — the room's one true light source.
    arch(ctx, 200, 100, 118, FLOOR_Y, '#2a1208');
    arch(ctx, 200, 62, 168, FLOOR_Y, '#5c2408');
    // The saturated core stays left of x 330 — the actor band's own edge.
    // Down hard (composition item 2): at 0.22 over a 112-px radius this was a
    // 7.99 %-of-frame saturated mass in the left third. The hearth is still a
    // hearth; the room's brightest thing is the roof light over the middle.
    softBlob(ctx, 192, 320, 78, 86, '#c2481a', 0.1);
    softBlob(ctx, 192, 302, 30, 28, '#e8b070', 0.16);
    // THE OPPOSING ACCENT: a barred roof vent at the far right, throwing a
    // COLD daylight wash and a plume of steam down the other end of the hall.
    // Every other pixel in this room is a shade of fire; without a cold half
    // the frame is one hue. Held past x 950 and above the actor band.
    poly(ctx, [1004, -10, 1188, -10, 1176, 176, 1016, 168], '#1b2436');
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#0a0d16';
    ctx.lineWidth = 7;
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      ctx.beginPath();
      ctx.moveTo(1004 + 184 * t, -10);
      ctx.lineTo(1016 + 160 * t, 172);
      ctx.stroke();
    }
    ctx.restore();
    // Ceiling ductwork and hanging chains, none of it over the actor row's centre.
    for (const x of [340, 900, 1150]) chainLine(ctx, x, 0, 150, '#0e0806', 0.6);
    for (const x of [380, 460, 940, 1080]) {
      pillar(ctx, x, 60, FLOOR_Y, 17, FORGE_FAR_INK, '#4a2418');
    }
    hazeWash(ctx, W, 150, '#965a3c', 0.3, FORGE_SEED);
    // The vent's light and its steam go on AFTER the warm haze: painted under
    // it they were tinted straight back into the fire, and the room lost its
    // cold half again.
    softBlob(ctx, 1096, 120, 178, 200, '#6f8fd0', 0.3);
    softBlob(ctx, 1096, 60, 62, 60, '#cfe0ff', 0.26);
    for (const [x, y, r, a] of [
      [1120, 226, 138, 0.17], [1094, 312, 88, 0.1], [1216, 296, 104, 0.11], [1066, 172, 92, 0.07],
    ] as const) {
      softBlob(ctx, x, y, r, r * 0.62, '#8fa6cf', a);
    }
    // ELEVEN segments at a 28-px step, not eight at 20: with the floor plane
    // lit from the front the joint carries a bigger value change than it did,
    // and the forge measured the longest run left in the set (516 px at the
    // 1.5-L threshold). More, taller steps is the only lever that shortens a
    // run without flattening the step itself.
    horizonBand(ctx, W, FLOOR_Y - 11, 30, '#241108', FORGE_SEED, 11, 28);
  },

  mid(ctx, W) {
    // Soot-grey iron, not a second light source — the furnace mouth stays the
    // only saturated colour in the room; everything else is what it lights.
    const RIM = '#a07a5e';
    // Two anvils, one horned left and one right, at different sizes — they
    // used to be the same shape twice.
    anvilShape(ctx, 250, FLOOR_Y + 30, 96, FORGE_MID_INK, 1, RIM, 0.34);
    anvilShape(ctx, 1058, FLOOR_Y + 24, 116, FORGE_MID_INK, -1, RIM, 0.34);
    propShadow(ctx, 250, FLOOR_Y + 30, 60, 0.4);
    propShadow(ctx, 1058, FLOOR_Y + 24, 70, 0.4);

    // Six masses at three depths and three scales.
    // 3. A double bellows against the left wall, past the actor band.
    propShadow(ctx, 150, FLOOR_Y + 26, 76, 0.4);
    poly(ctx, [72, FLOOR_Y - 96, 176, FLOOR_Y - 74, 214, FLOOR_Y - 32, 176, FLOOR_Y - 4, 74, FLOOR_Y - 22], '#120e0d');
    faceShade(ctx, [72, FLOOR_Y - 96, 176, FLOOR_Y - 74, 214, FLOOR_Y - 32, 176, FLOOR_Y - 4, 74, FLOOR_Y - 22], FLOOR_Y - 96, FLOOR_Y - 4, RIM, 0.3);
    poly(ctx, [214, FLOOR_Y - 36, 262, FLOOR_Y - 30, 262, FLOOR_Y - 24, 214, FLOOR_Y - 26], '#0f0c0b');
    rimEdge(ctx, [72, FLOOR_Y - 96, 176, FLOOR_Y - 74, 214, FLOOR_Y - 32], RIM, 0.32);
    for (const [x, h] of [[104, 26], [186, 30]] as const) {
      slabProp(ctx, x, FLOOR_Y + 26, 13, h, 0.03, '#0f0c0b', RIM, 0.3);
    }
    // 4. A crucible on a tripod, glowing dully at the room's right end.
    drum(ctx, 998, FLOOR_Y + 24, 54, 46, '#161211', RIM, 0.3);
    softBlob(ctx, 998, FLOOR_Y - 24, 46, 23, '#ff7a2e', 0.16);
    // 5. A tool rack: tongs and hammers hung at uneven heights.
    slabProp(ctx, 1180, FLOOR_Y + 18, 12, 118, 0.02, '#131010', RIM, 0.3);
    ctx.save();
    ctx.strokeStyle = '#141010';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const [x, h] of [[1150, 54], [1166, 74], [1198, 44], [1214, 66]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, FLOOR_Y - 96);
      ctx.lineTo(x + 4, FLOOR_Y - 96 + h);
      ctx.stroke();
    }
    ctx.restore();
    // 6. Chains over the hall, thin enough to cross the actor band unnoticed.
    for (const x of [560, 700, 860]) chainLine(ctx, x, 20, 200, '#100907', 0.55);
    pillar(ctx, 1150, 90, FLOOR_Y + 20, 26, FORGE_MID_INK, '#332c2a');
    // A handful of drifting embers — small, dim, no new light source.
    for (const [x, y, r] of [[300, 260, 2.5], [1120, 230, 2.5], [640, 200, 1.8]] as const) {
      softBlob(ctx, x, y, r * 5, r * 5, '#c17a3e', 0.12);
    }
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // A coal bunker with its shovel leaning on it, and a low flue stack.
    slabProp(ctx, 608, FLOOR_Y + 22, 128, 46, 0.01, '#141010', RIM, 0.11);
    poly(ctx, [560, FLOOR_Y - 24, 566, FLOOR_Y - 88, 606, FLOOR_Y - 84, 602, FLOOR_Y - 20], '#151110');
    faceShade(ctx, [560, FLOOR_Y - 24, 566, FLOOR_Y - 88, 606, FLOOR_Y - 84, 602, FLOOR_Y - 20], FLOOR_Y - 88, FLOOR_Y - 20, RIM, 0.13);
    rimEdge(ctx, [560, FLOOR_Y - 24, 566, FLOOR_Y - 88, 606, FLOOR_Y - 84], RIM, 0.1, 2);
    drum(ctx, 694, FLOOR_Y + 16, 46, 34, '#141010', RIM, 0.1);
    // Two flue stacks under the roof light (see `litPylon`).
    litPylon(ctx, 492, FLOOR_Y + 16, 46, 84, '#e0c096', '#151110', RIM);
    litPylon(ctx, 824, FLOOR_Y + 20, 54, 100, '#d3b087', '#141010', RIM);
    jointSpeckle(ctx, W, FORGE_GROUND, FORGE_SEED ^ 0x3d, 500);
    horizonGlint(ctx, W, FLOOR_Y - 11, '#ff7c34', 0.09, FORGE_SEED, 8, 20);
  },

  floor(ctx, W, H) {
    // Soot-grey, not the mid plane's orange-brown — the floor is what the
    // furnace lights, not a light source of its own.
    // Lit from the front (see MARSH.floor): swept ash over hot brick, brightest
    // in the rows the camera stands in.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#2a201a'],
      [0.18, '#3a2b22'],
      [0.48, '#4d3829'],
      [0.8, '#8d6344'],
      [1, '#84593d'],
    ]);
    // Where the barrows ran between furnace and anvil, and the swept ash banks.
    scuffBand(ctx, 260, FLOOR_Y + 30, 700, H - 20, 96, 210, '#4b382c', 0.05, true);
    scuffBand(ctx, 930, FLOOR_Y + 26, 540, H + 16, 82, 182, '#080605', 0.28, false);
    scuffBand(ctx, 140, FLOOR_Y + 56, 70, H - 40, 74, 156, '#080605', 0.28, false);
    floorGrid(ctx, W, H, '#5a3a28', 0.03, FORGE_SEED);
    // Cooled runnels of slag, held to the sides (x < 350 / > 930) — a dim
    // ember fill, not a stroke, tapering wide-near/narrow-far to the vanishing
    // point, so nothing bright crosses the actor row.
    for (const [x0, x1] of [[200, 160], [290, 250], [1000, 1040]] as const) {
      const midx = (x0 + x1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#c2521c';
      ctx.beginPath();
      ctx.moveTo(x0 - 1, FLOOR_Y + 16);
      ctx.lineTo(x0 + 1, FLOOR_Y + 16);
      ctx.lineTo(midx + 2, FLOOR_Y + 120);
      ctx.lineTo(midx - 2, FLOOR_Y + 120);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(midx - 2, FLOOR_Y + 120);
      ctx.lineTo(midx + 2, FLOOR_Y + 120);
      ctx.lineTo(x1 + 3, H);
      ctx.lineTo(x1 - 3, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Slag, cinders and the tool marks of a floor that has been struck on.
    scatterGround(ctx, W, H, {
      seed: FORGE_SEED ^ 0x1b,
      count: 132,
      kinds: [kSlag, kCinder, kToolMark, kStone, kSlag, kCinder, kBrick, kToolMark],
      ink: FORGE_GROUND,
      pool: [566, 478, 520, 142],
      alpha: 0.6,
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 210, FORGE_GROUND.lit, FORGE_GROUND.dark, 0.14, FORGE_SEED ^ 0x5a, 18, FLOOR_Y - 10);
    // ...and the PIXEL ground over it, on the actors' own 2-px grid: crowns,
    // beds, ruts and a scuffed lane, at 25-40 % local contrast. This is where
    // the plane's VALUE lives; the soft scatter above only carries silhouettes.
    // The two foot pools plus a third wide one across the near ground — the
    // near plane has to be lit MORE than the mid, not less.
    pixelGround(ctx, W, H, {
      seed: FORGE_SEED ^ 0xa7,
      ink: FORGE_PIX,
      count: 1120,
      pools: [[336, 462, 340, 128], [798, 462, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.46,
      tufts: 18,
    });
    groundGrain(ctx, W, H, FORGE_GROUND, FORGE_SEED ^ 0x9c, 980);
    // The right third measured 44 % less local detail than the left, and it is
    // the half the party stands on. A slack tub, a spill of quench water and a
    // dropped billet put edges back into x 700-950 without lighting anything.
    drum(ctx, 872, FLOOR_Y + 118, 76, 58, '#0e0b0a', '#a07a5e', 0.22);
    blobAt(ctx, 918, FLOOR_Y + 128, 78, 26, '#4a3a30', 0.16, true);
    slabProp(ctx, 782, FLOOR_Y + 138, 84, 15, -0.05, '#0d0a09', '#a07a5e', 0.24);
    slabProp(ctx, 940, FLOOR_Y + 176, 108, 18, 0.04, '#0d0a09', '#a07a5e', 0.24);
    // The quench trough and the billet stack stand forward of the wall, so
    // they belong to the floor plane — the floor is opaque from FLOOR_Y down.
    trough(ctx, 570, FLOOR_Y + 128, 166, 34, '#221a16', '#a07a5e', 0.28, '#79a8c0');
    for (const [x, y, w, h, r] of [
      [612, FLOOR_Y + 86, 118, 17, 0.02],
      [618, FLOOR_Y + 69, 100, 16, -0.04],
      [608, FLOOR_Y + 53, 72, 15, 0.05],
    ] as const) {
      slabProp(ctx, x, y, w, h, r, '#0e0b09', '#a07a5e', 0.26);
    }
    readingShade(ctx, W, H, '#070403', 0.34);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, FORGE_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 156, FORGE_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 168, FORGE_NEAR_INK);
    chainLine(ctx, 90, -40, 140, FORGE_NEAR_INK, 0.9);
    chainLine(ctx, W - 100, -40, 170, FORGE_NEAR_INK, 0.9);
    anvilShape(ctx, 130, H - 30, 150, FORGE_NEAR_INK, -1);
    floorLip(ctx, W, H, FORGE_NEAR_INK, 50);
  },
};

// ================================================================ SUNKEN VAULT ==
// A drowned reliquary: the crypt's own pillars and arches, submerged and cold,
// lit by a shaft of surface light instead of a flame. Caustic ripples stand in
// for the crypt's dust haze; drifting silt stands in for its embers. The vault
// door itself follows the crypt's OWN brazier discipline — held off to one
// side (x ~= 980), never centred behind the actor row — and the flanking
// columns stay past x < 330 / x > 950 too, so the middle of the frame is open,
// dim water.

const VAULT_FAR_INK = '#1c3a4a';
const VAULT_MID_INK = '#0e222c';
const VAULT_NEAR_INK = '#050f14';
/** Silt and shell-white shards over a drowned flagstone floor. */
const VAULT_GROUND: GroundInk = { lit: '#3e6d7c', dark: '#061318', seam: '#050f14' };
/** Pale shell silt against deep-water flagstone (see `pixelGround`). */
const VAULT_PIX: PixelInk = { lit: '#8fbfae', mid: '#42615f', bed: '#04141b', cool: '#2f6172', coolLit: '#69bbcf' };
const VAULT_SEED = 0x7a1e;

/** A band of wavering underwater light — thin sine-wave strokes, composited additive. */
function causticBand(ctx: CanvasRenderingContext2D, y: number, w: number, color: string, alpha: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = alpha * (1 - i * 0.16);
    ctx.beginPath();
    const yy = y + i * 13;
    for (let x = 0; x <= w; x += 24) {
      const yo = Math.sin((x + seed + i * 46) * 0.021) * 9;
      if (x === 0) ctx.moveTo(x, yy + yo);
      else ctx.lineTo(x, yy + yo);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** A frond of weed rooted at one point and bending with the current. */
function frond(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number,
  n: number,
  bend: number,
  color: string,
  seed: number,
): void {
  const rand = rng(seed ^ Math.round(x));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const len = h * (0.55 + rand() * 0.65);
    const sway = bend * (0.5 + rand());
    ctx.lineWidth = 3 + rand() * 4;
    ctx.beginPath();
    ctx.moveTo(x + (rand() - 0.5) * h * 0.16, base);
    ctx.bezierCurveTo(
      x + sway * 0.3, base - len * 0.4,
      x + sway * 1.1, base - len * 0.7,
      x + sway * 0.7, base - len,
    );
    ctx.stroke();
  }
  ctx.restore();
}

const VAULT: BiomeLook = {
  id: 'SUNKEN VAULT',
  key: { color: '#9fe4ff', x: 636, y: 100, radius: 520, alpha: 0.22, actorWeight: 0.5 },
  // Warm against the cold: the drowned lantern still burning on the far bank
  // is what the fill answers with, so the room is not one blue.
  fill: { color: '#a86a44', x: 1085, y: 580, radius: 660, alpha: 0.17, actorWeight: 1.4 },
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#7fe2ff', 0.504, 0.85),
  pool2: clusterPool(HERO_FEET, '#8ce6ff', 0.576, 1.25),
  shafts: { color: '#a6ecff', alpha: 0.075, x: 160, y: -90, angle: -0.48, count: 5, width: 46, length: 1040, gap: 138 },
  grade: {
    shadow: '#08202c',
    shadowAlpha: 0.24,
    vignette: 0.64,
    highlight: '#9fe8ff',
    highlightAlpha: 0.09,
  },
  fog: { color: '#3f7488', alpha: 0.09, y: 290, height: 280, speed: 5, bands: 2 },
  motes: { color: '#cdeeff', count: 70, size: 6, rise: 14, drift: 12 },
  rim: '#bdeeff',
  ambient: 'bubbles',
  ambientColor: '#2f7c8a',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#1d4d61'],
      [0.14, '#286478'],
      [0.28, '#1e5468'],
      [0.4, '#194a5c'],
      [0.46, '#164358'],
      [0.56, '#1b4d5e'],
      [0.64, '#15404e'],
      [0.72, '#0f2e38'],
      [1, '#081a22'],
    ]);
    skyMottle(ctx, W, 300, '#3f7f96', '#08181f', 0.17, VAULT_SEED ^ 0x71);
    // THE SURFACE, centred and overhead — this room's light well. A drowned
    // reliquary has daylight on the water above it, and that is the bright
    // thing the actors read against.
    lightWell(ctx, 636, 50, 268, 132, '#effcff', '#78c6dd', 1, 2.9);
    wellShafts(ctx, 636, 92, 6, 340, 330, '#b6ecff', 0.15, 0x7a1e);
    // The surface light column, hard left, feeding the key.
    softBlob(ctx, 210, 100, 168, 190, '#2f97b8', 0.15);
    softBlob(ctx, 210, 132, 42, 42, '#cdf3ff', 0.16);
    // The vault door itself, held off to one side — the crypt's own brazier
    // discipline — with flanking columns past the actor band on both edges.
    arch(ctx, 980, 108, 118, FLOOR_Y, VAULT_FAR_INK);
    // THE OPPOSING ACCENT, part one: something is still alight behind the vault
    // door. A warm amber breath at the far end of a blue room, past x 950.
    // Held clear of the actor band: centre minus radius must exceed x 950.
    softBlob(ctx, 1010, 280, 56, 84, '#c96a24', 0.2);
    softBlob(ctx, 1006, 316, 24, 32, '#ffb469', 0.22);
    for (const x of [180, 260]) pillar(ctx, x, 130, FLOOR_Y, 18, VAULT_FAR_INK, '#2c5262');
    for (const x of [1060, 1180]) pillar(ctx, x, 170, FLOOR_Y, 16, VAULT_FAR_INK, '#264854');
    causticBand(ctx, 190, W, '#9fe2f2', 0.1, 0);
    hazeWash(ctx, W, 150, '#78bec6', 0.26, VAULT_SEED);
    horizonBand(ctx, W, FLOOR_Y - 10, 24, '#0e222c', VAULT_SEED, 9, 18);
  },

  mid(ctx, W) {
    const RIM = '#7fc0d4';
    pillar(ctx, 300, 60, FLOOR_Y + 30, 30, VAULT_MID_INK, '#1c3844');
    // The door's own inner frame, nested at the same off-centre x as the far
    // plane's arch — depth, not a second doorway in the middle of the room.
    arch(ctx, 980, 62, 216, FLOOR_Y + 8, '#132a34');
    // A toppled column, half-buried — the only diagonal in an otherwise upright room.
    ctx.save();
    ctx.translate(150, FLOOR_Y + 10);
    ctx.rotate(-0.32);
    poly(ctx, [-140, -18, 140, -18, 140, 18, -140, 18], VAULT_MID_INK);
    faceShade(ctx, [-140, -18, 140, -18, 140, 18, -140, 18], -18, 18, RIM, 0.3);
    ctx.restore();
    propShadow(ctx, 150, FLOOR_Y + 26, 130, 0.3);

    // Six masses at three depths and three scales, none of them mirrored.
    // 3. A row of low urns against the left wall, three sizes.
    for (const [x, w, h] of [[206, 34, 46], [246, 26, 32], [278, 40, 58]] as const) {
      drum(ctx, x, FLOOR_Y + 46, w, h, '#0b1d26', RIM, 0.3);
    }
    // 4. Weed rooted in the broken flags, at both ends and at two scales.
    frond(ctx, 254, FLOOR_Y + 60, 108, 6, 42, '#0a1b23', 3);
    frond(ctx, 1096, FLOOR_Y + 52, 88, 5, -36, '#0a1b23', 19);
    frond(ctx, 430, FLOOR_Y + 22, 58, 4, 26, '#0b1d25', 41);
    // 5. THE OPPOSING ACCENT, part two: a lantern still burning inside its
    //    glass on a leaning post at the right — the warm the fill answers.
    slabProp(ctx, 1152, FLOOR_Y + 32, 11, 92, 0.05, '#0a1a22', RIM, 0.32);
    poly(ctx, [1144, FLOOR_Y - 62, 1142, FLOOR_Y - 82, 1166, FLOOR_Y - 82, 1164, FLOOR_Y - 62], '#0b161c');
    softBlob(ctx, 1154, FLOOR_Y - 72, 58, 54, '#ff9a3e', 0.28);
    softBlob(ctx, 1154, FLOOR_Y - 72, 11, 11, '#ffd7a4', 0.46);
    // 6. A fallen lintel bridging two stumps, deep left of the enemy band.
    fallenColumn(ctx, 96, FLOOR_Y + 52, 190, 18, -0.05, '#0c1f28', RIM, 0.26);

    // Drifting motes of light caught in the water, off the actor band.
    for (const [x, y, r] of [[210, 340, 16], [270, 400, 10], [1060, 320, 15], [1140, 380, 9]] as const) {
      softBlob(ctx, x, y, r * 2.4, r * 2.4, '#7fe0d0', 0.28);
    }
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // A broken votive pedestal with its offering urns, crusted over.
    slabProp(ctx, 606, FLOOR_Y + 26, 120, 38, 0.02, '#0a1c25', RIM, 0.11);
    poly(ctx, [572, FLOOR_Y - 10, 578, FLOOR_Y - 80, 620, FLOOR_Y - 72, 624, FLOOR_Y - 6], '#0b1e27');
    faceShade(ctx, [572, FLOOR_Y - 10, 578, FLOOR_Y - 80, 620, FLOOR_Y - 72, 624, FLOOR_Y - 6], FLOOR_Y - 80, FLOOR_Y - 6, RIM, 0.13);
    rimEdge(ctx, [572, FLOOR_Y - 10, 578, FLOOR_Y - 80, 620, FLOOR_Y - 72], RIM, 0.1, 2);
    drum(ctx, 684, FLOOR_Y + 20, 44, 40, '#0b1e27', RIM, 0.1);
    frond(ctx, 660, FLOOR_Y + 12, 46, 4, 20, '#0a1b23', 57);
    // Two columns taking the surface light (see `litPylon`).
    litPylon(ctx, 490, FLOOR_Y + 18, 48, 86, '#bfe4ee', '#0a1c25', RIM);
    litPylon(ctx, 826, FLOOR_Y + 22, 56, 102, '#aed6e4', '#091a22', RIM);
    jointSpeckle(ctx, W, VAULT_GROUND, VAULT_SEED ^ 0x3d, 540);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#96dcee', 0.08, VAULT_SEED, 9, 18);
  },

  floor(ctx, W, H) {
    // Lit from the front (see MARSH.floor): the surface shaft reaches the near
    // flags, and the silt there is the palest thing on the plane.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#153039'],
      [0.18, '#1d3c45'],
      [0.48, '#2b5057'],
      [0.8, '#628f81'],
      [1, '#5a8477'],
    ]);
    // Where the silt banked up, and the scoured channels between the banks.
    scuffBand(ctx, 270, FLOOR_Y + 30, 720, H - 24, 94, 204, '#31606e', 0.045, true);
    scuffBand(ctx, 950, FLOOR_Y + 26, 560, H + 16, 80, 178, '#050f15', 0.26, false);
    scuffBand(ctx, 130, FLOOR_Y + 54, 70, H - 40, 72, 152, '#050f15', 0.26, false);
    causticBand(ctx, FLOOR_Y + 30, W, '#a6e6f2', 0.08, 220);
    causticBand(ctx, FLOOR_Y + 120, W, '#a6e6f2', 0.06, 300);
    // Silt drifts and pearl shards, lying under the caustics.
    scatterGround(ctx, W, H, {
      seed: VAULT_SEED ^ 0x4f,
      count: 110,
      kinds: [kDrift, kShard, kShell, kStone, kDrift, kShard, kSlab],
      ink: VAULT_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.5,
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 210, VAULT_GROUND.lit, VAULT_GROUND.dark, 0.14, VAULT_SEED ^ 0x5a, 18, FLOOR_Y - 10);
    // ...and the PIXEL ground over it, on the actors' own 2-px grid: crowns,
    // beds, ruts and a scuffed lane, at 25-40 % local contrast. This is where
    // the plane's VALUE lives; the soft scatter above only carries silhouettes.
    // The two foot pools plus a third wide one across the near ground — the
    // near plane has to be lit MORE than the mid, not less.
    pixelGround(ctx, W, H, {
      seed: VAULT_SEED ^ 0xa7,
      ink: VAULT_PIX,
      count: 780,
      pools: [[336, 462, 340, 128], [798, 462, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.56,
      tufts: 40,
    });
    groundGrain(ctx, W, H, VAULT_GROUND, VAULT_SEED ^ 0x9c, 560, 0.9);
    // The burst reliquary chest and the crusted votive statue stand forward of
    // the wall, so they belong to the floor plane — the floor is opaque from
    // FLOOR_Y down and would paint over anything mid() drew below the joint.
    wedgeBox(ctx, 566, FLOOR_Y + 124, 112, 50, 0.82, 0.05, '#06202b', '#7fc0d4', 0.32);
    slabProp(ctx, 616, FLOOR_Y + 82, 54, 40, 0.02, '#061821', '#7fc0d4', 0.2);
    slabProp(ctx, 618, FLOOR_Y + 42, 31, 64, -0.05, '#061821', '#7fc0d4', 0.2);
    ctx.save();
    ctx.globalAlpha = 0.085;
    ctx.fillStyle = '#7fc0d4';
    ctx.beginPath();
    ctx.arc(618, FLOOR_Y - 30, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    readingShade(ctx, W, H, '#030c11', 0.34);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, VAULT_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 150, VAULT_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 158, VAULT_NEAR_INK);
    pillar(ctx, 70, -40, H + 20, 42, VAULT_NEAR_INK, '#0a1c22');
    pillar(ctx, W - 76, -40, H + 20, 40, VAULT_NEAR_INK, '#0a1c22');
    // Silt clouds hanging in the water, right at the frame edges.
    softBlob(ctx, 40, H * 0.6, 160, 200, '#0d262e', 0.5);
    softBlob(ctx, W - 40, H * 0.5, 170, 210, '#0d262e', 0.5);
    floorLip(ctx, W, H, VAULT_NEAR_INK, 48);
  },
};

// ================================================================ STORM SPIRE ==
// A tower top above the weather: the crypt's geometry once more, but the key
// light is the afterglow of a lightning strike and the "ceiling" is open sky
// with a sea of storm cloud sitting right at the horizon line. Banners and
// broken battlements frame the edges; the actor row stays clear night air.

const SPIRE_MID_INK = '#171b2c';
const SPIRE_NEAR_INK = '#08090f';
/** Rain-wet stone: the sky caught in the puddles, the shadow under the lip. */
const SPIRE_GROUND: GroundInk = { lit: '#5b6484', dark: '#080911', seam: '#06070d' };
/** Storm-lit wet stone against the warm bronze of the parapet's copper (see `pixelGround`). */
const SPIRE_PIX: PixelInk = { lit: '#93a6cc', mid: '#4a5064', bed: '#0a0c16', cool: '#6b5a52', coolLit: '#b09070' };
const SPIRE_SEED = 0xb01d;

/** A small triangular banner, hanging from a point and fluttering to one side. */
function pennant(ctx: CanvasRenderingContext2D, x: number, topY: number, len: number, lean: number, fill: string): void {
  poly(ctx, [x - 3, topY, x + 3, topY, x + lean, topY + len * 0.5, x + lean * 0.4, topY + len], fill);
}

/** A jagged lightning stroke: a soft wide glow pass under a bright narrow core — never a 2-px scribble. */
function boltStreak(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, alpha: number): void {
  const pts: readonly (readonly [number, number])[] = [
    [x, y],
    [x + len * 0.2, y + len * 0.2],
    [x - len * 0.05, y + len * 0.32],
    [x + len * 0.16, y + len * 0.56],
    [x - len * 0.04, y + len * 0.64],
    [x + len * 0.12, y + len * 0.86],
    [x, y + len],
  ];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.globalAlpha = alpha * 0.32;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
}

/** A tapering Gothic spire: three narrowing tiers, a lit ledge, a couple of lit windows and a cross-strut spike. */
function spireTower(ctx: CanvasRenderingContext2D, x: number, base: number, top: number, baseHalf: number, fill: string, lit: string): void {
  const h = base - top;
  const tiers: readonly (readonly [number, number])[] = [
    [base - h * 0.32, baseHalf],
    [base - h * 0.6, baseHalf * 0.66],
    [base - h * 0.82, baseHalf * 0.38],
    [top, baseHalf * 0.1],
  ];
  let py = base;
  let ph = baseHalf;
  for (const [y, half] of tiers) {
    poly(ctx, [x - ph, py, x - half, y, x + half, y, x + ph, py], fill);
    py = y;
    ph = half;
  }
  // A lit rim down the key-facing (left) edge of every tier — an outline
  // reads as a silhouette regardless of what light washes over the fill.
  ctx.save();
  ctx.strokeStyle = lit;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  py = base;
  ph = baseHalf;
  ctx.beginPath();
  ctx.moveTo(x - ph, py);
  for (const [y, half] of tiers) {
    ctx.lineTo(x - half, y);
    py = y;
    ph = half;
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = lit;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - baseHalf * 0.7, base - h * 0.32);
  ctx.lineTo(x + baseHalf * 0.7, base - h * 0.32);
  ctx.moveTo(x - baseHalf * 0.46, base - h * 0.6);
  ctx.lineTo(x + baseHalf * 0.46, base - h * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - h * 0.09);
  ctx.moveTo(x - h * 0.025, top - h * 0.035);
  ctx.lineTo(x + h * 0.025, top - h * 0.035);
  ctx.strokeStyle = fill;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = lit;
  ctx.fillRect(x - 3, base - h * 0.46, 6, 10);
  ctx.fillRect(x - 3, base - h * 0.72, 5, 8);
  ctx.restore();
}

const SPIRE: BiomeLook = {
  id: 'STORM SPIRE',
  key: { color: '#dbe8ff', x: 636, y: 116, radius: 520, alpha: 0.22, actorWeight: 0.5 },
  // The brazier on the far parapet: the one warm thing above the weather, and
  // the reason this room's fill is not a third shade of storm blue.
  fill: { color: '#9c5f44', x: 1050, y: 560, radius: 660, alpha: 0.17, actorWeight: 1.4 },
  // Derived from ENEMY_FEET / HERO_FEET (see `clusterPool`). The alphas came
  // UP in round 6: the ground at the six seats measured 21.7-38.7 against an
  // empty near band at 34.4-37.0, and the front hero's actor-to-ground
  // contrast was 1.23:1. The lift is on the PARTY's side by design — pool2
  // is the party's and is the stronger of the two, because the enemy rank was
  // averaging 8.0 L above the plane the player controls.
  pool: clusterPool(ENEMY_FEET, '#d8ecff', 0.48, 0.85),
  pool2: clusterPool(HERO_FEET, '#e2f0ff', 0.552, 1.25),
  shafts: { color: '#dfeaff', alpha: 0.065, x: 180, y: -90, angle: -0.5, count: 4, width: 46, length: 1030, gap: 150 },
  grade: {
    shadow: '#1a1a30',
    shadowAlpha: 0.22,
    vignette: 0.65,
    highlight: '#d6e6ff',
    highlightAlpha: 0.1,
  },
  // The strike's afterglow — this biome's brightest sky object, and the same
  // rule applies to it (see MARSH.sky).
  // PURE HALO, not a disc: unlike the moon and the sun there is no painted
  // BODY here for a core to sit inside — the far plane paints a soft bloom and
  // a bolt — so an r-26 core came back as a hard white orb hanging beside the
  // lightning. r ~ 0 collapses `skySprite`'s first stops onto the centre and
  // leaves the long falloff, which is what an afterglow is.
  sky: { color: '#f2f8ff', x: 224, y: 40, r: 4, halo: 210, alpha: 0.3 },
  fog: { color: '#5a6088', alpha: 0.07, y: 270, height: 250, speed: 10, bands: 2 },
  motes: { color: '#e2ecff', count: 54, size: 7, rise: 20, drift: 26 },
  rim: '#e6f0ff',
  ambient: 'rain',
  ambientColor: '#7d9fd0',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      // The upper band lifts in round 6: the vault/sky above the horizon read
      // p50 14.6-22.2 against the references' 37.4 and 55.5, so a figure had
      // nothing to be a silhouette against. The air is hazed and lit now, and
      // the light well overhead is what is lighting it.
      [0, '#2b3050'],
      [0.14, '#3a4066'],
      [0.3, '#2c3054'],
      [0.44, '#232748'],
      [0.56, '#343458'],
      [0.68, '#22233c'],
      [1, '#131424'],
    ]);
    skyMottle(ctx, W, 300, '#59628c', '#0d0f1a', 0.17, SPIRE_SEED ^ 0x71);
    // The break in the storm, centred — the spire's light well: the one patch
    // of lit cloud the tower top is silhouetted against.
    lightWell(ctx, 636, 66, 264, 138, '#f2f7ff', '#a3b6e8', 1, 2.8);
    wellShafts(ctx, 636, 110, 4, 320, 290, '#cfdcff', 0.13, 0x5117);
    // The afterglow of the last strike, hard left, feeding the key light.
    softBlob(ctx, 220, 150, 176, 176, '#a8c8ff', 0.15);
    softBlob(ctx, 224, 40, 34, 34, '#f2f8ff', 0.22);
    boltStreak(ctx, 224, 40, 220, '#eaf2ff', 0.75);
    boltStreak(ctx, 980, 20, 150, '#dbe8ff', 0.28);
    // A sea of storm cloud sitting right at the horizon, held past x < 330 /
    // x > 950 — the actor band stays clear night air, not pale cloud. A lit
    // top edge is what sells a CLOUD instead of a smudge, kept dim (0.15) so
    // it never becomes the brightest patch in the frame.
    for (const [x, y, r] of [[80, FLOOR_Y - 6, 130], [300, FLOOR_Y - 20, 150], [1020, FLOOR_Y - 6, 150], [1200, FLOOR_Y - 16, 130]] as const) {
      softBlob(ctx, x, y + r * 0.16, r, r * 0.5, '#454e78', 0.65);
      softBlob(ctx, x, y - r * 0.18, r * 0.8, r * 0.32, '#7883b8', 0.15);
    }
    // A sister spire, off to the right, taller than anything else in frame — a
    // real tapering silhouette (tiers, a lit ledge, windows), not a hairline.
    // Drawn LAST (opaque fills), over the additive cloud glow, so it stays a
    // crisp silhouette instead of washing out under it.
    spireTower(ctx, 1150, FLOOR_Y, 26, 58, SPIRE_NEAR_INK, '#c9d6ff');
    hazeWash(ctx, W, 150, '#aab4d2', 0.24, SPIRE_SEED);
    horizonBand(ctx, W, FLOOR_Y - 10, 24, '#171930', SPIRE_SEED, 9, 18);
  },

  mid(ctx, W) {
    const RIM = '#9fb0d8';
    // Broken battlements at the edges — varied heights and widths, and two of
    // them snapped off short, so the row never repeats a merlon.
    // Battlements in four PROFILES — square, snapped, stepped and leaning — so
    // the run never repeats a merlon at a new scale.
    const merlons: readonly (readonly [number, number, number, number])[] = [
      [122, 17, 74, 0],
      [166, 13, 40, 1],
      [294, 15, 68, 2],
      [336, 19, 46, 1],
      [380, 14, 60, 3],
      [882, 14, 58, 1],
      [924, 20, 72, 0],
      [968, 15, 44, 2],
      [1096, 18, 66, 3],
    ];
    for (const [x, hw, h, kind] of merlons) {
      const top = FLOOR_Y - h;
      const a = x > 330 && x < 950 ? 0.12 : 0.26;
      // Round 3: "`ff-bd-STORM_SPIRE.png`'s monoliths are flat trapezoids at
      // one value." They were: a fill and a keyline, nothing between. Each is
      // now a MASS — the shadow it throws on the parapet, the lit crown facing
      // the strike, `faceShade`'s hard break where the coping meets the shaft,
      // and the flank below it a clear step darker.
      let pts: readonly number[];
      let lip: readonly number[];
      if (kind === 1) {
        pts = [x - hw, FLOOR_Y + 10, x - hw, top + 8, x - hw * 0.2, top, x + hw, top + 14, x + hw, FLOOR_Y + 10];
        lip = [x - hw, top + 8, x - hw * 0.2, top];
      } else if (kind === 2) {
        pts = [x - hw, FLOOR_Y + 10, x - hw, top + 18, x - hw * 0.1, top + 18, x - hw * 0.1, top, x + hw, top, x + hw, FLOOR_Y + 10];
        lip = [x - hw, top + 18, x - hw * 0.1, top + 18, x - hw * 0.1, top, x + hw, top];
      } else if (kind === 3) {
        pts = [x - hw, FLOOR_Y + 10, x - hw * 0.55, top, x + hw * 1.05, top + 6, x + hw * 1.2, FLOOR_Y + 10];
        lip = [x - hw, FLOOR_Y + 10, x - hw * 0.55, top, x + hw * 1.05, top + 6];
      } else {
        pts = [x - hw, FLOOR_Y + 10, x - hw, top, x + hw, top, x + hw, FLOOR_Y + 10];
        lip = [x - hw, FLOOR_Y + 10, x - hw, top, x + hw, top];
      }
      propShadow(ctx, x, FLOOR_Y + 12, hw * 1.2, 0.3);
      poly(ctx, pts, SPIRE_MID_INK);
      faceShade(ctx, pts, top, FLOOR_Y + 10, RIM, a * 1.5);
      rimEdge(ctx, lip, RIM, a);
    }
    pennant(ctx, 294, FLOOR_Y - 68, 70, 26, '#242840');
    pennant(ctx, 924, FLOOR_Y - 72, 66, -24, '#242840');

    // Six masses at three depths and three scales, none of them mirrored.
    // 1. A broken gate arch standing on the platform's far side. arch() takes
    //    (x, half, top, spring): a 62-px half-width springing at the floor.
    arch(ctx, 546, 62, FLOOR_Y - 158, FLOOR_Y + 6, '#0d101c', RIM, 0.13);
    // Its crown is gone: punched out, so the silhouette breaks instead of
    // closing. Nothing else on this plane reaches these rows.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    poly(ctx, [572, FLOOR_Y - 168, 616, FLOOR_Y - 156, 610, FLOOR_Y - 96, 574, FLOOR_Y - 104], '#000');
    ctx.restore();
    rimEdge(ctx, [484, FLOOR_Y + 6, 484, FLOOR_Y - 96, 546, FLOOR_Y - 158], RIM, 0.13, 2);
    // 2. A lightning mast, its guys running off to the parapet.
    slabProp(ctx, 764, FLOOR_Y + 18, 14, 168, 0.02, '#0a0d18', RIM, 0.16);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#121625';
    ctx.lineWidth = 2;
    for (const dx of [-96, 84]) {
      ctx.beginPath();
      ctx.moveTo(764, FLOOR_Y - 148);
      ctx.lineTo(764 + dx, FLOOR_Y + 16);
      ctx.stroke();
    }
    ctx.restore();
    // 4. A pile of dislodged coping stones at the left, three sizes.
    // Dislodged coping: a slab, a snapped wedge and a rolled drum — three
    // profiles, not one rectangle at three scales.
    slabProp(ctx, 206, FLOOR_Y + 48, 76, 26, 0.06, '#10131f', RIM, 0.3);
    poly(ctx, [224, FLOOR_Y + 58, 254, FLOOR_Y + 28, 288, FLOOR_Y + 40, 280, FLOOR_Y + 60], '#10131f');
    rimEdge(ctx, [224, FLOOR_Y + 58, 254, FLOOR_Y + 28, 288, FLOOR_Y + 40], RIM, 0.3, 2);
    drum(ctx, 172, FLOOR_Y + 62, 44, 20, '#10131f', RIM, 0.3);
    // 5. THE OPPOSING ACCENT: an iron brazier still lit on the far parapet.
    //    Held past x 950, and the reason this frame is not one blue.
    slabProp(ctx, 1012, FLOOR_Y + 26, 22, 54, 0, '#0f121d', RIM, 0.3);
    poly(ctx, [986, FLOOR_Y - 28, 1038, FLOOR_Y - 28, 1030, FLOOR_Y - 48, 994, FLOOR_Y - 48], '#161a28');
    softBlob(ctx, 1012, FLOOR_Y - 56, 78, 66, '#ff8a30', 0.28);
    softBlob(ctx, 1012, FLOOR_Y - 62, 22, 20, '#ffd08c', 0.4);
    // 6. A lower cloud bank, closer, drifting just under the parapets — held
    //    past the actor band on both sides.
    for (const [x, y, r] of [[160, FLOOR_Y + 24, 130], [1120, FLOOR_Y + 26, 130]] as const) {
      softBlob(ctx, x, y, r, r * 0.42, '#2a2f4c', 0.55);
      softBlob(ctx, x, y - r * 0.2, r * 0.7, r * 0.2, '#565f90', 0.15);
    }
    // ---- THE CENTRE MASS (composition, round 3 item 2) ----------------------
    // "The centre band x 470-670 is empty floor in every battle frame; the
    // mid-ground mass round 2 asked for sits in the blurred FAR plane." So one
    // real mass stands here, on the MID plane, straddling the wall/floor joint
    // so it occludes the horizon — in front of the far wall, behind the actor
    // line. It stays DARK and its rim runs at the inside-the-actor-band third
    // (this file's header rule: interest lives outside x 330-950 at HEAD
    // height), and it tops out around FLOOR_Y - 80, under the far rank's heads.
    // The gate arch already stands at x 484-608; this widens its footing into
    // the empty half of the band with a spill of its own coping.
    slabProp(ctx, 664, FLOOR_Y + 22, 116, 34, -0.02, '#101422', RIM, 0.11);
    poly(ctx, [626, FLOOR_Y - 6, 632, FLOOR_Y - 74, 674, FLOOR_Y - 66, 678, FLOOR_Y - 2], '#111527');
    faceShade(ctx, [626, FLOOR_Y - 6, 632, FLOOR_Y - 74, 674, FLOOR_Y - 66, 678, FLOOR_Y - 2], FLOOR_Y - 74, FLOOR_Y - 2, RIM, 0.13);
    rimEdge(ctx, [626, FLOOR_Y - 6, 632, FLOOR_Y - 74, 674, FLOOR_Y - 66], RIM, 0.1, 2);
    drum(ctx, 716, FLOOR_Y + 30, 48, 24, '#111527', RIM, 0.1);
    // Two merlon stacks against the storm break (see `litPylon`).
    litPylon(ctx, 492, FLOOR_Y + 14, 46, 80, '#c6d2ee', '#10131f', RIM);
    litPylon(ctx, 822, FLOOR_Y + 18, 52, 96, '#b8c6e6', '#0f1220', RIM);
    jointSpeckle(ctx, W, SPIRE_GROUND, SPIRE_SEED ^ 0x3d);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#c4d4ff', 0.09, SPIRE_SEED, 9, 18);
  },

  floor(ctx, W, H) {
    // Lit from the front (see MARSH.floor): wet flagstone throwing the storm
    // light back at the camera.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#22273c'],
      [0.18, '#2d3550'],
      [0.48, '#3f4a72'],
      [0.8, '#6c7aa2'],
      [1, '#627098'],
    ]);
    // The rain runs off the platform along these two falls, and the middle
    // stays wettest — a sheen, not a highlight.
    scuffBand(ctx, 300, FLOOR_Y + 30, 740, H - 20, 96, 206, '#4a5478', 0.055, true);
    scuffBand(ctx, 950, FLOOR_Y + 26, 560, H + 16, 82, 180, '#080911', 0.26, false);
    scuffBand(ctx, 140, FLOOR_Y + 54, 70, H - 40, 74, 154, '#080911', 0.26, false);
    floorGrid(ctx, W, H, '#565c82', 0.03, SPIRE_SEED);
    // Wet stone and standing water, with the bolts caught in the puddles.
    scatterGround(ctx, W, H, {
      seed: SPIRE_SEED ^ 0x37,
      count: 126,
      kinds: [kWetStone, kPuddle, kCrack, kStone, kWetStone, kPuddle, kSlab],
      ink: SPIRE_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.44,
    });
    // The two foot pools are smooth radial gradients and they now overlap
    // across the middle of the stage, which put a 421-px straight run at
    // y ~ 500 into the crisp floor plane — a horizontal band whose vertical
    // rate of change was identical right across it. Broad, low-contrast
    // mottle over the same band breaks every row of it and changes no
    // percentile (see `skyMottle`).
    skyMottle(ctx, W, 210, SPIRE_GROUND.lit, SPIRE_GROUND.dark, 0.14, SPIRE_SEED ^ 0x5a, 18, FLOOR_Y - 10);
    // ...and the PIXEL ground over it, on the actors' own 2-px grid: crowns,
    // beds, ruts and a scuffed lane, at 25-40 % local contrast. This is where
    // the plane's VALUE lives; the soft scatter above only carries silhouettes.
    // The two foot pools plus a third wide one across the near ground — the
    // near plane has to be lit MORE than the mid, not less.
    pixelGround(ctx, W, H, {
      seed: SPIRE_SEED ^ 0xa7,
      ink: SPIRE_PIX,
      count: 800,
      pools: [[336, 462, 340, 128], [798, 462, 340, 128], [620, 706, 660, 168]],
      coolShare: 0.44,
      tufts: 24,
    });
    groundGrain(ctx, W, H, SPIRE_GROUND, SPIRE_SEED ^ 0x9c, 860);
    // The fallen bell lies forward of the parapet, so it belongs to the floor
    // plane — the floor is opaque from FLOOR_Y down.
    fallenBell(ctx, 578, FLOOR_Y + 124, 132, 38, 0.3, '#2b3148', '#9fb0d8', 0.28);
    // Rubble and a snapped staff on the right third, which measured the least
    // local detail of the three.
    for (const [x, y, w, h, r] of [
      [1146, FLOOR_Y + 104, 52, 18, 0.07],
      [1188, FLOOR_Y + 118, 38, 14, -0.22],
      [1112, FLOOR_Y + 128, 30, 12, 0.28],
    ] as const) {
      slabProp(ctx, x, y, w, h, r, '#151928', '#9fb0d8', 0.3);
    }
    fallenColumn(ctx, 1024, FLOOR_Y + 152, 96, 8, -0.28, '#151928', '#9fb0d8', 0.3);
    drum(ctx, 902, FLOOR_Y + 96, 40, 28, '#151928', '#9fb0d8', 0.15);
    readingShade(ctx, W, H, '#06070d', 0.3);
    fadeTop(ctx, W, FLOOR_Y - 26, 56, SPIRE_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 156, SPIRE_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 168, SPIRE_NEAR_INK);
    poly(ctx, [-20, H + 40, -20, H - 40, 40, H - 60, 100, H - 40, 100, H + 40], SPIRE_NEAR_INK);
    poly(ctx, [W + 20, H + 40, W + 20, H - 40, W - 40, H - 60, W - 100, H - 40, W - 100, H + 40], SPIRE_NEAR_INK);
    pennant(ctx, 130, -40, 240, 40, SPIRE_NEAR_INK);
    pennant(ctx, W - 140, -40, 220, -36, SPIRE_NEAR_INK);
    // The rampart the camera stands behind — crenellations along the bottom
    // edge, sides only, so the frame reads as looking OUT from a tower top.
    const MERLON = 46;
    const MERLON_H = 64;
    for (let x = -20; x < 200; x += MERLON) poly(ctx, [x, H + 20, x, H - MERLON_H, x + MERLON * 0.62, H - MERLON_H, x + MERLON * 0.62, H + 20], SPIRE_NEAR_INK);
    for (let x = W + 20; x > W - 200; x -= MERLON) poly(ctx, [x, H + 20, x, H - MERLON_H, x - MERLON * 0.62, H - MERLON_H, x - MERLON * 0.62, H + 20], SPIRE_NEAR_INK);
    floorLip(ctx, W, H, SPIRE_NEAR_INK, 46);
  },
};

// ------------------------------------------------------------------ exports --

/**
 * Biome id -> diorama. Keyed by `Biome.name` from game/data/enemies.ts (the
 * string the battle screen already carries in `opts.biome`), with the
 * underscored spelling registered as an alias so either form resolves.
 */
export const BACKDROPS: BiomeLooks = {
  'EMBER CRYPT': CRYPT,
  EMBER_CRYPT: CRYPT,
  'FROST MARSH': MARSH,
  FROST_MARSH: MARSH,
  'SKY RUINS': RUINS,
  SKY_RUINS: RUINS,
  'ASHEN FORGE': FORGE,
  ASHEN_FORGE: FORGE,
  'SUNKEN VAULT': VAULT,
  SUNKEN_VAULT: VAULT,
  'STORM SPIRE': SPIRE,
  STORM_SPIRE: SPIRE,
};

/** The look for a biome name, falling back to the crypt for a biome phase 6b has not authored yet. */
export function backdropFor(biome: string): BiomeLook {
  return BACKDROPS[biome] ?? BACKDROPS[biome.replace(/[\s-]+/g, '_')] ?? CRYPT;
}
