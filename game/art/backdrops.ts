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

import type { BiomeLook, BiomeLooks } from '../../engine';

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
function arch(
  ctx: CanvasRenderingContext2D,
  x: number,
  half: number,
  top: number,
  spring: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x - half, spring);
  ctx.lineTo(x - half, top + half);
  ctx.quadraticCurveTo(x - half, top, x, top);
  ctx.quadraticCurveTo(x + half, top, x + half, top + half);
  ctx.lineTo(x + half, spring);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
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
 * faint layer under the scatter — jittered spacing, per-line alpha, partial
 * spans and a fade-out well before the bottom edge, so the near field is
 * debris and the lattice never crosses the whole frame.
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
  // Every line runs through (VP_X, VP_Y); only a stretch below the wall is drawn.
  for (let i = -5; i <= 5; i++) {
    if (rand() < 0.3) continue;
    const xb = VP_X + i * 190 + (rand() - 0.5) * 84;
    const k = (FLOOR_Y - VP_Y) / (height - VP_Y);
    const yEnd = FLOOR_Y + (height - FLOOR_Y) * (0.45 + rand() * 0.45);
    const t = (yEnd - VP_Y) / (height - VP_Y);
    ctx.globalAlpha = alpha * (0.45 + rand() * 0.7);
    ctx.beginPath();
    ctx.moveTo(VP_X + (xb - VP_X) * k, FLOOR_Y);
    ctx.lineTo(VP_X + (xb - VP_X) * t, yEnd);
    ctx.stroke();
  }
  // Courses: y advances geometrically so the flagstones foreshorten, but each
  // is a partial span at its own alpha and they give out before the front.
  let y = FLOOR_Y + 6;
  let step = 8;
  while (y < height) {
    const t = (y - FLOOR_Y) / (height - FLOOR_Y);
    ctx.globalAlpha = alpha * (0.4 + rand() * 0.7) * Math.max(0, 1 - t * t * 1.35);
    const x0 = rand() * width * 0.34;
    const x1 = width - rand() * width * 0.34;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y + (rand() - 0.5) * 3);
    ctx.stroke();
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

/**
 * The dark foreground corner the command list is read against. The skill rows
 * live at x 24-344, y 535-670 and the log at x 360-930, y 545-580; a lit floor
 * running under either makes 18-px vector text fight the ground for the same
 * pixels. This sinks the bottom-left corner (and, more gently, the
 * bottom-right) with a soft radial that has no edge of its own, which is also
 * what the reference frames do — their darkest band is the near ground.
 */
function readingShade(ctx: CanvasRenderingContext2D, W: number, H: number, ink: string, strength = 1): void {
  blobAt(ctx, 40, H + 30, 470, 300, ink, 0.62 * strength, false);
  blobAt(ctx, 150, H - 20, 320, 190, ink, 0.4 * strength, false);
  blobAt(ctx, W - 30, H + 40, 400, 250, ink, 0.34 * strength, false);
}

/** Where a ground pass thins out: the pool it crowds into, in logical px. */
interface ScatterOptions {
  seed: number;
  /** 60-120 pieces, per the scene brief. */
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
  poly(ctx, [-hw, 0, -hw * 0.92, -h, hw * 0.92, -h, hw, 0], fill);
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
  poly(ctx, [-hw, 0, -tw, -h, tw, -h, hw, 0], fill);
  if (lid) {
    // Slid off to the key side, proud by a hair — a lid that overhangs on both
    // sides stops being a lid and becomes a table top.
    const sh = w * 0.09;
    poly(ctx, [-tw - w * 0.03 + sh, -h, -tw + sh, -h - h * 0.16, tw + sh, -h - h * 0.16, tw + w * 0.03 + sh, -h], fill);
    rimEdge(ctx, [-tw - w * 0.03 + sh, -h, -tw + sh, -h - h * 0.16, tw + sh, -h - h * 0.16], rim, rimA);
  }
  rimEdge(ctx, [-hw, 0, -tw, -h], rim, rimA);
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
  const g = ctx.createLinearGradient(0, H - h, 0, H + PAD);
  g.addColorStop(0, hexA(ink, 0));
  g.addColorStop(0.55, hexA(ink, 0.42));
  g.addColorStop(1, ink);
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
/** The seed every crypt plane shares, so the stepped horizon lines up across them. */
const CRYPT_SEED = 0xc1a7;

const CRYPT: BiomeLook = {
  id: 'EMBER CRYPT',
  key: { color: '#ff9436', x: 244, y: 158, radius: 430, alpha: 0.21 },
  fill: { color: '#4a63a8', x: 1080, y: 630, radius: 660, alpha: 0.2 },
  // A symmetric PAIR, not one centred pool. The stage is a diagonal with the
  // enemies on the left third (layout.ts ENEMY_FEET x 206-452) and the party on
  // the right (HERO_FEET x 700-880); one pool at x 640 peaked between them,
  // where nobody stands, and left the enemy plane unlit.
  pool: { color: '#ffb15c', x: 336, y: 462, rx: 320, ry: 116, alpha: 0.2 },
  pool2: { color: '#ffb970', x: 798, y: 462, rx: 320, ry: 116, alpha: 0.2 },
  shafts: { color: '#ffb066', alpha: 0.065, x: 150, y: -90, angle: -0.52, count: 4, width: 52, length: 1050, gap: 152 },
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
      [0, '#0e0c18'],
      [0.26, '#1d1726'],
      [0.48, '#332630'],
      [0.56, '#3a2b30'],
      [0.68, '#241c26'],
      [1, '#14101a'],
    ]);
    arch(ctx, 190, 84, 132, FLOOR_Y, '#3c2315');
    arch(ctx, 190, 50, 196, FLOOR_Y, '#6b3a1a');
    softBlob(ctx, 190, 320, 116, 120, '#c9631f', 0.15);
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
    softBlob(ctx, 1092, 96, 132, 118, '#2f7ea8', 0.2);
    softBlob(ctx, 1068, 84, 15, 15, '#d8f4ff', 0.42);
    softBlob(ctx, 1148, 132, 10, 10, '#cdeeff', 0.3);
    // Dust haze washing the whole far plane down toward the floor.
    hazeWash(ctx, W, 150, '#927a70', 0.52, CRYPT_SEED);
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
    rimEdge(ctx, [-25, 0, -25, -74, 22, -58], RIM, 0.12, 2);
    ctx.restore();
    slabProp(ctx, 892, FLOOR_Y + 30, 122, 26, 0.02, '#120e1e', RIM, 0.12);
    poly(ctx, [833, FLOOR_Y + 4, 833, FLOOR_Y - 8, 951, FLOOR_Y - 4, 951, FLOOR_Y + 8], '#161125');
    slabProp(ctx, 1176, FLOOR_Y + 34, 44, 78, 0.17, '#120e1e', RIM, 0.26);

    // The brazier that anchors the key — kept hard left, out of the actor row.
    poly(ctx, [212, FLOOR_Y + 26, 222, 352, 254, 352, 264, FLOOR_Y + 26], '#120e1c');
    poly(ctx, [206, 352, 270, 352, 260, 332, 216, 332], '#241a24');
    softBlob(ctx, 238, 320, 86, 74, '#ff7d20', 0.2);
    softBlob(ctx, 238, 312, 30, 28, '#ffca7a', 0.34);
    jointSpeckle(ctx, W, CRYPT_GROUND, CRYPT_SEED ^ 0x3d);
    horizonGlint(ctx, W, FLOOR_Y - 9, '#ff9646', 0.09, CRYPT_SEED, 9, 17);
  },

  floor(ctx, W, H) {
    // The ground reads a clear step darker than the hazy mid-field behind it —
    // that step is what lets a lit head and shoulder separate from the room.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#2c2434'],
      [0.3, '#1c1526'],
      [1, '#0f0b17'],
    ]);
    // Broad scuff along the stage diagonal: centuries of feet between the
    // brazier and the vault, plus a damp band where the wall weeps. These are
    // soft-edged blobs, so nothing here has an edge to catch — which is also
    // what retires the old hard-edged floor stain at (250, 478).
    scuffBand(ctx, 300, FLOOR_Y + 34, 760, H - 30, 96, 210, '#3c3246', 0.05, true);
    scuffBand(ctx, 960, FLOOR_Y + 26, 560, H + 20, 84, 190, '#332b3e', 0.036, true);
    scuffBand(ctx, 206, FLOOR_Y + 56, 140, H - 50, 78, 156, '#0a0712', 0.3, false);
    scuffBand(ctx, 1080, FLOOR_Y + 44, 1200, H + 10, 82, 168, '#0a0712', 0.26, false);
    floorGrid(ctx, W, H, '#5a4c66', 0.055, CRYPT_SEED);
    // Cracked flagstones with rubble: 104 pieces at three sizes and free
    // rotation, crowded into the two lit pools and thinning into the vignette.
    scatterGround(ctx, W, H, {
      seed: CRYPT_SEED ^ 0x51,
      count: 116,
      kinds: [kStone, kStone, kBrick, kSlab, kCrack, kStone, kCrack, kBrick],
      ink: CRYPT_GROUND,
      pool: [566, 476, 520, 140],
    });
    groundGrain(ctx, W, H, CRYPT_GROUND, CRYPT_SEED ^ 0x9c, 1250);
    // The masses that stand FORWARD of the wall — the middle third used to be
    // an empty column of floor. They belong to this plane: the floor is opaque
    // from FLOOR_Y down, so a prop drawn on the mid plane below the joint is
    // simply painted over.
    //
    // PLACEMENT. layout.ts puts the enemies at x 206-452 and the party at
    // x 700-880, both on foot rows y 380/448/516, so the free ground is the
    // corridor around x 500-660. Below that corridor is not free either: the
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
    // The deep structural cracks the flagstones broke around.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#080610';
    ctx.lineWidth = 2;
    for (const [x0, x1] of [[560, 470], [760, 900], [640, 660]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_Y + 20);
      ctx.lineTo((x0 + x1) / 2, FLOOR_Y + 130);
      ctx.lineTo(x1, H);
      ctx.stroke();
    }
    ctx.restore();
    readingShade(ctx, W, H, '#07050d');
    fadeTop(ctx, W, FLOOR_Y - 26, 40, CRYPT_SEED);
  },

  near(ctx, W, H) {
    // Feathered curtains, not slabs: the old flat polygons ended on a straight
    // vertical edge ~60 px in and read as a rectangular vignette.
    edgeCurtain(ctx, W, H, 1, 168, CRYPT_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 186, CRYPT_NEAR_INK);
    poly(ctx, [-40, -40, 380, -40, 150, 74, 112, 150], CRYPT_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 380, -40, W - 158, 74, W - 120, 150], CRYPT_NEAR_INK);
    floorLip(ctx, W, H, CRYPT_NEAR_INK, 112);
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
  key: { color: '#7fdcc4', x: 196, y: 126, radius: 440, alpha: 0.22 },
  // THE OPPOSING FILL. This room's key is a cold moon; a cold fill under it
  // made every pixel one hue. The fill is now the dusk warmth off the lantern
  // on the far bank, so the two lights sit across the wheel.
  fill: { color: '#8f5c50', x: 1090, y: 620, radius: 660, alpha: 0.16 },
  pool: { color: '#8fe2d0', x: 336, y: 450, rx: 316, ry: 100, alpha: 0.18 },
  pool2: { color: '#9de6d4', x: 798, y: 462, rx: 320, ry: 116, alpha: 0.18 },
  shafts: { color: '#a9e8dd', alpha: 0.055, x: 246, y: -80, angle: -0.4, count: 5, width: 42, length: 820, gap: 132 },
  grade: {
    shadow: '#12293c',
    shadowAlpha: 0.22,
    vignette: 0.62,
    highlight: '#a9e8dd',
    highlightAlpha: 0.09,
  },
  fog: { color: '#7fa8ad', alpha: 0.095, y: 272, height: 262, speed: 9, bands: 2 },
  motes: { color: '#cdeee4', count: 56, size: 8, rise: 12, drift: 15 },
  rim: '#bff0e2',
  ambient: 'snow',
  ambientColor: '#456a72',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#101b26'],
      [0.28, '#20364a'],
      [0.48, '#3d5c6c'],
      [0.55, '#456471'],
      [0.66, '#223a45'],
      [1, '#13232c'],
    ]);
    // The cold moon, upper left, where the key light stands.
    softBlob(ctx, 196, 126, 250, 250, '#2f6f74', 0.32);
    ctx.beginPath();
    ctx.arc(196, 126, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#dcf4ec';
    ctx.fill();
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
    hazeWash(ctx, W, 130, '#a0c4c6', 0.4, MARSH_SEED);
  },

  mid(ctx, W) {
    const RIM = '#7fb0ac';
    deadTree(ctx, 306, FLOOR_Y + 28, 268, 22, MARSH_MID_INK);
    deadTree(ctx, 1064, FLOOR_Y + 34, 290, -26, MARSH_MID_INK);
    deadTree(ctx, 962, FLOOR_Y + 6, 148, 14, MARSH_MID_INK);
    // The jetty, and the pilings that once carried it.
    poly(ctx, [1180, FLOOR_Y + 40, 1160, FLOOR_Y + 4, 890, FLOOR_Y + 14, 900, FLOOR_Y + 54], '#101f28');
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
    jointSpeckle(ctx, W, MARSH_GROUND, MARSH_SEED ^ 0x3d, 380);
    horizonGlint(ctx, W, FLOOR_Y - 6, '#9fe4d6', 0.07, MARSH_SEED, 8, 14);
  },

  floor(ctx, W, H) {
    // Water, a clear step darker than the hazy bank behind it.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#2c4a56'],
      [0.26, '#152932'],
      [1, '#0a141a'],
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
    groundGrain(ctx, W, H, MARSH_GROUND, MARSH_SEED ^ 0x9c, 1100, 0.85);
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
    readingShade(ctx, W, H, '#040c11', 1.25);
    fadeTop(ctx, W, FLOOR_Y - 26, 40, MARSH_SEED);
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
    floorLip(ctx, W, H, MARSH_NEAR_INK, 104);
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
const RUINS_SEED = 0x5c99;

/** A chunk of floating rock: a flat-ish top, a jagged broken underside. */
function floatIsland(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, fill: string): void {
  const hw = w / 2;
  poly(ctx, [
    x - hw, baseY - h * 0.32,
    x - hw * 0.7, baseY - h,
    x - hw * 0.1, baseY - h * 0.86,
    x + hw * 0.55, baseY - h,
    x + hw, baseY - h * 0.3,
    x + hw * 0.62, baseY - h * 0.05,
    x + hw * 0.2, baseY,
    x - hw * 0.35, baseY - h * 0.08,
  ], fill);
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
  key: { color: '#ffc266', x: 220, y: 138, radius: 460, alpha: 0.22 },
  // The opposing fill is the risen moon and the night half of the sky, pushed
  // properly blue against the dusk sun rather than sharing its violet.
  fill: { color: '#4e6cc4', x: 1050, y: 560, radius: 680, alpha: 0.19 },
  pool: { color: '#ffd699', x: 336, y: 462, rx: 320, ry: 116, alpha: 0.17 },
  pool2: { color: '#ffdca8', x: 798, y: 462, rx: 320, ry: 116, alpha: 0.17 },
  shafts: { color: '#ffdca0', alpha: 0.06, x: 258, y: -90, angle: -0.42, count: 4, width: 46, length: 830, gap: 140 },
  grade: {
    shadow: '#221a3c',
    shadowAlpha: 0.2,
    vignette: 0.62,
    highlight: '#ffdca0',
    highlightAlpha: 0.09,
  },
  fog: { color: '#8f96c8', alpha: 0.05, y: 260, height: 240, speed: 6, bands: 2 },
  motes: { color: '#e8ddff', count: 58, size: 7, rise: -10, drift: 22 },
  rim: '#ffe0a8',
  ambient: 'stars',
  ambientColor: '#cdd0ff',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#0b0a1c'],
      [0.22, '#171438'],
      [0.34, '#252150'],
      [0.46, '#3e3763'],
      [0.56, '#5a4a6e'],
      [0.64, '#6c5464'],
      [0.72, '#7a5a5c'],
      [1, '#16142a'],
    ]);
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
    hazeWash(ctx, W, 150, '#aa96aa', 0.42, RUINS_SEED);
    // A broken skyline where the platform meets the air, not a 1280-px rule.
    horizonBand(ctx, W, FLOOR_Y - 10, 24, '#241f38', RUINS_SEED, 9, 19);
  },

  mid(ctx, W) {
    const RIM = '#c0a8d0';
    // Bigger, closer masonry, still clear of the actor row at head height.
    floatIsland(ctx, 210, FLOOR_Y - 70, 210, 130, RUINS_MID_INK);
    pillar(ctx, 236, FLOOR_Y - 176, FLOOR_Y - 76, 16, RUINS_MID_INK, '#443e6c');
    floatIsland(ctx, 1080, FLOOR_Y - 40, 240, 150, RUINS_MID_INK);
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
    floatIsland(ctx, 620, 150, 130, 60, '#38335c');

    // Six masses at three depths and three scales, none of them mirrored, each
    // with a rim on the key side and a shadow on the ground.
    // 2. A statue's plinth, its figure broken off above the ankles.
    slabProp(ctx, 438, FLOOR_Y + 24, 62, 74, -0.03, '#241e42', RIM, 0.15);
    slabProp(ctx, 434, FLOOR_Y - 50, 30, 34, 0.12, '#241e42', RIM, 0.15);
    // 3. A flight of broken steps climbing out of frame at the right.
    stairs(ctx, 916, FLOOR_Y + 30, 150, 4, 15, '#1d193a', RIM, 0.15);
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
    jointSpeckle(ctx, W, RUINS_GROUND, RUINS_SEED ^ 0x3d, 700);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#ffc888', 0.08, RUINS_SEED, 9, 19);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#2f2a46'],
      [0.3, '#1c182c'],
      [1, '#0f0d1a'],
    ]);
    // Where feet crossed the platform, and where the wind laid the dust down.
    scuffBand(ctx, 280, FLOOR_Y + 32, 730, H - 24, 92, 200, '#443c60', 0.05, true);
    scuffBand(ctx, 940, FLOOR_Y + 28, 560, H + 16, 80, 180, '#0b0916', 0.26, false);
    scuffBand(ctx, 150, FLOOR_Y + 54, 90, H - 40, 72, 152, '#0b0916', 0.26, false);
    // A whisper of the perspective grid — structure, not a synthwave floor.
    floorGrid(ctx, W, H, '#584f7c', 0.05, RUINS_SEED);
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
      count: 112,
      kinds: [kBrick, kStone, kTuft, kSlab, kCrack, kBrick, kTuft, kStone],
      ink: RUINS_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.5,
    });
    groundGrain(ctx, W, H, RUINS_GROUND, RUINS_SEED ^ 0x9c, 1250);
    // The two masses standing forward of the wall line — the floor plane is
    // opaque from FLOOR_Y down, so they belong to it and not to mid().
    fallenColumn(ctx, 552, FLOOR_Y + 122, 144, 23, 0.05, '#12102a', '#a294bc', 0.32);
    drum(ctx, 648, FLOOR_Y + 140, 60, 46, '#131029', '#a294bc', 0.3);
    // Cracks radiating between the broken slabs — a platform holding itself
    // together, not a void.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#080612';
    ctx.lineWidth = 2;
    for (const [x0, x1] of [[520, 440], [740, 860], [640, 620], [420, 340], [900, 960]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_Y + 18);
      ctx.lineTo((x0 + x1) / 2, FLOOR_Y + 120);
      ctx.lineTo(x1, H);
      ctx.stroke();
    }
    ctx.restore();
    // The platform's broken edge, hard left and right — this floor ends in open air.
    poly(ctx, [0, H, 0, FLOOR_Y + 30, 60, FLOOR_Y + 50, 30, FLOOR_Y + 90, 0, H], '#0c0a16');
    poly(ctx, [W, H, W, FLOOR_Y + 34, W - 54, FLOOR_Y + 56, W - 26, FLOOR_Y + 96, W, H], '#0c0a16');
    readingShade(ctx, W, H, '#080713', 0.95);
    fadeTop(ctx, W, FLOOR_Y - 26, 40, RUINS_SEED);
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
    floorLip(ctx, W, H, RUINS_NEAR_INK, 108);
  },
};

// ================================================================ ASHEN FORGE ==
// An industrial furnace hall: the same warm-key / cool-fill geometry as the
// crypt, pushed hotter and harder — one great furnace mouth at the far left
// throws the key light, chains hang from a ceiling that never fully resolves,
// and anvils sit at the edges. The actor row stays dark iron and soot; the
// glow lives at the margins, the same discipline as the crypt's brazier.

const FORGE_FAR_INK = '#3a1e1a';
const FORGE_MID_INK = '#171313';
const FORGE_NEAR_INK = '#090504';
/** Slag, cinder and scale over a soot floor. */
const FORGE_GROUND: GroundInk = { lit: '#5b4438', dark: '#0a0706', seam: '#070403' };
const FORGE_SEED = 0xf01e;

/** An anvil silhouette: a flat base, a tapered waist, a horn to one side. `dir` mirrors the horn. */
function anvilShape(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, fill: string, dir: 1 | -1 = 1): void {
  const hw = (w / 2) * dir;
  poly(ctx, [x - hw * 0.55, baseY, x - hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY], fill);
  poly(ctx, [x - hw * 0.4, baseY - w * 0.16, x - hw * 0.28, baseY - w * 0.5, x + hw * 0.28, baseY - w * 0.5, x + hw * 0.4, baseY - w * 0.16], fill);
  poly(ctx, [x - hw * 0.5, baseY - w * 0.5, x - hw * 0.5, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.5], fill);
  poly(ctx, [x + hw * 0.2, baseY - w * 0.58, x + hw * 1.1, baseY - w * 0.7, x + hw * 1.08, baseY - w * 0.58, x + hw * 0.28, baseY - w * 0.48], fill);
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
  key: { color: '#ff5a2e', x: 210, y: 168, radius: 460, alpha: 0.24 },
  // The cold half of the room: daylight and steam falling through the roof
  // vents on the far right, opposite the furnace mouth.
  fill: { color: '#5a76b8', x: 1085, y: 560, radius: 680, alpha: 0.22 },
  pool: { color: '#ff8a4a', x: 336, y: 464, rx: 320, ry: 118, alpha: 0.22 },
  pool2: { color: '#ff9a5e', x: 798, y: 464, rx: 320, ry: 118, alpha: 0.22 },
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
      [0, '#0a0806'],
      [0.24, '#1c110c'],
      [0.46, '#341c14'],
      [0.56, '#3e2216'],
      [0.68, '#241410'],
      [1, '#120a08'],
    ]);
    // The great furnace mouth, hard left — the room's one true light source.
    arch(ctx, 200, 100, 118, FLOOR_Y, '#2a1208');
    arch(ctx, 200, 62, 168, FLOOR_Y, '#5c2408');
    // The saturated core stays left of x 330 — the actor band's own edge.
    softBlob(ctx, 192, 320, 112, 122, '#ff5a1c', 0.22);
    softBlob(ctx, 192, 300, 44, 42, '#ffd27a', 0.3);
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
    hazeWash(ctx, W, 150, '#965a3c', 0.5, FORGE_SEED);
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
    horizonBand(ctx, W, FLOOR_Y - 11, 26, '#241108', FORGE_SEED, 8, 20);
  },

  mid(ctx, W) {
    // Soot-grey iron, not a second light source — the furnace mouth stays the
    // only saturated colour in the room; everything else is what it lights.
    const RIM = '#a07a5e';
    // Two anvils, one horned left and one right, at different sizes — they
    // used to be the same shape twice.
    anvilShape(ctx, 250, FLOOR_Y + 30, 96, FORGE_MID_INK, 1);
    anvilShape(ctx, 1058, FLOOR_Y + 24, 116, FORGE_MID_INK, -1);
    propShadow(ctx, 250, FLOOR_Y + 30, 60, 0.4);
    propShadow(ctx, 1058, FLOOR_Y + 24, 70, 0.4);

    // Six masses at three depths and three scales.
    // 3. A double bellows against the left wall, past the actor band.
    propShadow(ctx, 150, FLOOR_Y + 26, 76, 0.4);
    poly(ctx, [72, FLOOR_Y - 96, 176, FLOOR_Y - 74, 214, FLOOR_Y - 32, 176, FLOOR_Y - 4, 74, FLOOR_Y - 22], '#120e0d');
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
    jointSpeckle(ctx, W, FORGE_GROUND, FORGE_SEED ^ 0x3d, 500);
    horizonGlint(ctx, W, FLOOR_Y - 11, '#ff7c34', 0.09, FORGE_SEED, 8, 20);
  },

  floor(ctx, W, H) {
    // Soot-grey, not the mid plane's orange-brown — the floor is what the
    // furnace lights, not a light source of its own.
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#221a16'],
      [0.28, '#161211'],
      [1, '#0d0a09'],
    ]);
    // Where the barrows ran between furnace and anvil, and the swept ash banks.
    scuffBand(ctx, 260, FLOOR_Y + 30, 700, H - 20, 96, 210, '#4b382c', 0.05, true);
    scuffBand(ctx, 930, FLOOR_Y + 26, 540, H + 16, 82, 182, '#080605', 0.28, false);
    scuffBand(ctx, 140, FLOOR_Y + 56, 70, H - 40, 74, 156, '#080605', 0.28, false);
    floorGrid(ctx, W, H, '#5a3a28', 0.05, FORGE_SEED);
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
    groundGrain(ctx, W, H, FORGE_GROUND, FORGE_SEED ^ 0x9c, 1500);
    // The right third measured 44 % less local detail than the left, and it is
    // the half the party stands on. A slack tub, a spill of quench water and a
    // dropped billet put edges back into x 700-950 without lighting anything.
    drum(ctx, 872, FLOOR_Y + 118, 76, 58, '#0e0b0a', '#a07a5e', 0.22);
    blobAt(ctx, 918, FLOOR_Y + 128, 78, 26, '#4a3a30', 0.16, true);
    slabProp(ctx, 782, FLOOR_Y + 138, 84, 15, -0.05, '#0d0a09', '#a07a5e', 0.24);
    slabProp(ctx, 940, FLOOR_Y + 176, 108, 18, 0.04, '#0d0a09', '#a07a5e', 0.24);
    // The quench trough and the billet stack stand forward of the wall, so
    // they belong to the floor plane — the floor is opaque from FLOOR_Y down.
    slabProp(ctx, 570, FLOOR_Y + 128, 160, 38, 0.02, '#0d0a09', '#a07a5e', 0.3);
    ctx.save();
    ctx.globalAlpha = 0.085;
    ctx.fillStyle = '#79a8c0';
    ctx.fillRect(500, FLOOR_Y + 96, 138, 6);
    ctx.restore();
    for (const [x, y, w, h, r] of [
      [612, FLOOR_Y + 86, 118, 17, 0.02],
      [618, FLOOR_Y + 69, 100, 16, -0.04],
      [608, FLOOR_Y + 53, 72, 15, 0.05],
    ] as const) {
      slabProp(ctx, x, y, w, h, r, '#0e0b09', '#a07a5e', 0.26);
    }
    readingShade(ctx, W, H, '#070403', 1.15);
    fadeTop(ctx, W, FLOOR_Y - 26, 40, FORGE_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 156, FORGE_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 168, FORGE_NEAR_INK);
    chainLine(ctx, 90, -40, 140, FORGE_NEAR_INK, 0.9);
    chainLine(ctx, W - 100, -40, 170, FORGE_NEAR_INK, 0.9);
    anvilShape(ctx, 130, H - 30, 150, FORGE_NEAR_INK, -1);
    floorLip(ctx, W, H, FORGE_NEAR_INK, 110);
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
  key: { color: '#6fd8ff', x: 210, y: 132, radius: 460, alpha: 0.2 },
  // Warm against the cold: the drowned lantern still burning on the far bank
  // is what the fill answers with, so the room is not one blue.
  fill: { color: '#a86a44', x: 1085, y: 580, radius: 660, alpha: 0.17 },
  pool: { color: '#7fe2ff', x: 336, y: 462, rx: 320, ry: 116, alpha: 0.18 },
  pool2: { color: '#8ce6ff', x: 798, y: 462, rx: 320, ry: 116, alpha: 0.18 },
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
      [0, '#040f16'],
      [0.24, '#0c2432'],
      [0.4, '#123a4c'],
      [0.46, '#164358'],
      [0.56, '#1b4d5e'],
      [0.64, '#15404e'],
      [0.72, '#0f2e38'],
      [1, '#081a22'],
    ]);
    // The surface light column, hard left, feeding the key.
    softBlob(ctx, 210, 100, 230, 260, '#2f97b8', 0.3);
    softBlob(ctx, 210, 132, 60, 60, '#cdf3ff', 0.3);
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
    hazeWash(ctx, W, 150, '#78bec6', 0.4, VAULT_SEED);
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
    ctx.restore();

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
    jointSpeckle(ctx, W, VAULT_GROUND, VAULT_SEED ^ 0x3d, 540);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#96dcee', 0.08, VAULT_SEED, 9, 18);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#173842'],
      [0.28, '#0d222a'],
      [1, '#061318'],
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
    groundGrain(ctx, W, H, VAULT_GROUND, VAULT_SEED ^ 0x9c, 1150, 0.9);
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
    readingShade(ctx, W, H, '#030c11', 1.3);
    fadeTop(ctx, W, FLOOR_Y - 26, 40, VAULT_SEED);
  },

  near(ctx, W, H) {
    edgeCurtain(ctx, W, H, 1, 150, VAULT_NEAR_INK);
    edgeCurtain(ctx, W, H, -1, 158, VAULT_NEAR_INK);
    pillar(ctx, 70, -40, H + 20, 42, VAULT_NEAR_INK, '#0a1c22');
    pillar(ctx, W - 76, -40, H + 20, 40, VAULT_NEAR_INK, '#0a1c22');
    // Silt clouds hanging in the water, right at the frame edges.
    softBlob(ctx, 40, H * 0.6, 160, 200, '#0d262e', 0.5);
    softBlob(ctx, W - 40, H * 0.5, 170, 210, '#0d262e', 0.5);
    floorLip(ctx, W, H, VAULT_NEAR_INK, 106);
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
  key: { color: '#cfe0ff', x: 220, y: 150, radius: 470, alpha: 0.22 },
  // The brazier on the far parapet: the one warm thing above the weather, and
  // the reason this room's fill is not a third shade of storm blue.
  fill: { color: '#9c5f44', x: 1050, y: 560, radius: 660, alpha: 0.17 },
  pool: { color: '#d8ecff', x: 336, y: 462, rx: 320, ry: 116, alpha: 0.16 },
  pool2: { color: '#e2f0ff', x: 798, y: 462, rx: 320, ry: 116, alpha: 0.16 },
  shafts: { color: '#dfeaff', alpha: 0.065, x: 180, y: -90, angle: -0.5, count: 4, width: 46, length: 1030, gap: 150 },
  grade: {
    shadow: '#1a1a30',
    shadowAlpha: 0.22,
    vignette: 0.65,
    highlight: '#d6e6ff',
    highlightAlpha: 0.1,
  },
  fog: { color: '#5a6088', alpha: 0.07, y: 270, height: 250, speed: 10, bands: 2 },
  motes: { color: '#e2ecff', count: 54, size: 7, rise: 20, drift: 26 },
  rim: '#e6f0ff',
  ambient: 'rain',
  ambientColor: '#7d9fd0',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#07070f'],
      [0.24, '#12142a'],
      [0.44, '#232748'],
      [0.56, '#343458'],
      [0.68, '#22233c'],
      [1, '#131424'],
    ]);
    // The afterglow of the last strike, hard left, feeding the key light.
    softBlob(ctx, 220, 150, 240, 240, '#a8c8ff', 0.3);
    softBlob(ctx, 224, 40, 46, 46, '#f2f8ff', 0.4);
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
    hazeWash(ctx, W, 150, '#aab4d2', 0.34, SPIRE_SEED);
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
      if (kind === 1) {
        poly(ctx, [x - hw, FLOOR_Y + 10, x - hw, top + 8, x - hw * 0.2, top, x + hw, top + 14, x + hw, FLOOR_Y + 10], SPIRE_MID_INK);
        rimEdge(ctx, [x - hw, top + 8, x - hw * 0.2, top], RIM, a);
      } else if (kind === 2) {
        poly(ctx, [x - hw, FLOOR_Y + 10, x - hw, top + 18, x - hw * 0.1, top + 18, x - hw * 0.1, top, x + hw, top, x + hw, FLOOR_Y + 10], SPIRE_MID_INK);
        rimEdge(ctx, [x - hw, top + 18, x - hw * 0.1, top + 18, x - hw * 0.1, top, x + hw, top], RIM, a);
      } else if (kind === 3) {
        poly(ctx, [x - hw, FLOOR_Y + 10, x - hw * 0.55, top, x + hw * 1.05, top + 6, x + hw * 1.2, FLOOR_Y + 10], SPIRE_MID_INK);
        rimEdge(ctx, [x - hw, FLOOR_Y + 10, x - hw * 0.55, top, x + hw * 1.05, top + 6], RIM, a);
      } else {
        poly(ctx, [x - hw, FLOOR_Y + 10, x - hw, top, x + hw, top, x + hw, FLOOR_Y + 10], SPIRE_MID_INK);
        rimEdge(ctx, [x - hw, FLOOR_Y + 10, x - hw, top, x + hw, top], RIM, a);
      }
    }
    pennant(ctx, 294, FLOOR_Y - 68, 70, 26, '#242840');
    pennant(ctx, 924, FLOOR_Y - 72, 66, -24, '#242840');

    // Six masses at three depths and three scales, none of them mirrored.
    // 1. A broken gate arch standing on the platform's far side. arch() takes
    //    (x, half, top, spring): a 62-px half-width springing at the floor.
    arch(ctx, 546, 62, FLOOR_Y - 158, FLOOR_Y + 6, '#0d101c');
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
    jointSpeckle(ctx, W, SPIRE_GROUND, SPIRE_SEED ^ 0x3d);
    horizonGlint(ctx, W, FLOOR_Y - 10, '#c4d4ff', 0.09, SPIRE_SEED, 9, 18);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y - JOINT_LIFT, W, H - FLOOR_Y + JOINT_LIFT, [
      [0, '#282a3e'],
      [0.3, '#171929'],
      [1, '#0b0c17'],
    ]);
    // The rain runs off the platform along these two falls, and the middle
    // stays wettest — a sheen, not a highlight.
    scuffBand(ctx, 300, FLOOR_Y + 30, 740, H - 20, 96, 206, '#4a5478', 0.055, true);
    scuffBand(ctx, 950, FLOOR_Y + 26, 560, H + 16, 82, 180, '#080911', 0.26, false);
    scuffBand(ctx, 140, FLOOR_Y + 54, 70, H - 40, 74, 154, '#080911', 0.26, false);
    floorGrid(ctx, W, H, '#565c82', 0.05, SPIRE_SEED);
    // Wet stone and standing water, with the bolts caught in the puddles.
    scatterGround(ctx, W, H, {
      seed: SPIRE_SEED ^ 0x37,
      count: 114,
      kinds: [kWetStone, kPuddle, kCrack, kStone, kWetStone, kPuddle, kSlab],
      ink: SPIRE_GROUND,
      pool: [566, 476, 520, 140],
      alpha: 0.44,
    });
    groundGrain(ctx, W, H, SPIRE_GROUND, SPIRE_SEED ^ 0x9c, 1250);
    // The fallen bell lies forward of the parapet, so it belongs to the floor
    // plane — the floor is opaque from FLOOR_Y down.
    ctx.save();
    ctx.translate(582, FLOOR_Y + 126);
    ctx.rotate(0.38);
    propShadow(ctx, 0, 28, 50, 0.42);
    ctx.beginPath();
    ctx.moveTo(-38, 34);
    ctx.quadraticCurveTo(-31, -38, 0, -42);
    ctx.quadraticCurveTo(31, -38, 38, 34);
    ctx.closePath();
    ctx.fillStyle = '#141827';
    ctx.fill();
    rimEdge(ctx, [-38, 34, -31, -16, 0, -42], '#9fb0d8', 0.32, 2.5);
    ctx.restore();
    readingShade(ctx, W, H, '#06070d', 0.9);
    fadeTop(ctx, W, FLOOR_Y - 26, 40, SPIRE_SEED);
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
    floorLip(ctx, W, H, SPIRE_NEAR_INK, 96);
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
