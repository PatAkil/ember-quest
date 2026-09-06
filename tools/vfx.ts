// tools/vfx.ts — the VFX loop's eyes. Dev-server only (Vite serves it at
// /tools/vfx.html; `vite build` never bundles it and nothing in game/ or
// engine/ imports it).
//
// Freezes every archetype in game/art/vfx.ts at eight ages across its life over
// a crypt-dark ground with a real baked actor standing in it, and shows each
// strip twice: raw, and through a cheap stand-in for engine/light.ts's bloom
// (quarter-res, threshold by self-multiply, blur, 'lighter' back over the
// frame — the same four steps renderPost takes), so what an effect will look
// like once the light plane has had it is visible here.
//
//   skill=CINDER        one SkillId, raw + bloomed                (detail)
//   kind=fireBurst      one archetype, raw + bloomed              (detail)
//   kinds=a,b,c         several archetypes
//   (nothing)           all thirteen archetypes, one row each     (overview)
//   mode=both|bloom|raw which strips to draw (default: both for a detail sheet,
//                       bloom for the overview)
//   ages=N              frames per strip (default 8)
//   cell=N              cell size in px (default 190 detail / 150 overview)
//   bg=RRGGBB           the wall colour (default the stage navy, 1d2b53)
//   floor=RRGGBB        the floor plane (default 131d3a) — set it warm to check
//                       a warm family against a warm ground
//   actor=ID            who stands in the cell (default CINDER_IMP)
//   bounds=1            stroke each effect's vfxBounds rect over the raw strip
//   envelope=1          measure what each archetype ACTUALLY draws (alpha bbox
//                       per frame, unioned over the life) and print it beside
//                       the BOUNDS table vfx.ts declares, in the same units and
//                       order — paste-ready. Rasterises and reads back every
//                       frame of every row, so it is opt-in.
//
// The per-archetype render cost lands in window.__lineup.metrics (read by
// tools/capture.mjs) and as a table under the canvas.

import { ACTOR_RECIPES, bakePose } from '../game/art/actors';
import { VFX_RECIPES, spawnVfx, updateVfx, renderVfx, renderVfxUnder, vfxBounds } from '../game/art/vfx';
import type { VfxBounds, VfxInstance, VfxKind } from '../game/art/vfx';
import type { SkillId } from '../game/types';

const params = new URLSearchParams(location.search);
const bg = '#' + (params.get('bg') ?? '1d2b53').replace('#', '');
/**
 * The FLOOR, separately from the wall. It was hardcoded navy, which quietly
 * made "does this effect read on a warm ground?" untestable here: the ground
 * wash and every impact land on the floor plane, and on EMBER_CRYPT that plane
 * is lit amber (#ff9436 key, #ffb15c pool). `floor=2a1a12` puts the crypt's
 * own warm floor under the effect.
 */
const floor = '#' + (params.get('floor') ?? '131d3a').replace('#', '');
const actorId = params.get('actor') ?? 'CINDER_IMP';
const AGES = Math.max(2, Math.min(16, Number(params.get('ages') ?? 8)));
/** Stroke each effect's vfxBounds rect over the raw strip (bounds=1). */
const SHOW_BOUNDS = params.get('bounds') === '1';
/**
 * Fixed draw seeds. spawnVfx otherwise takes the next number off a global
 * counter, so the same row came out different between two captures and the
 * sheets could not be diffed. One seed per row, stable across runs.
 */
const SEED_BASE = 4242;

/** The thirteen archetypes, in the order vfx.ts declares them. */
const KINDS: readonly VfxKind[] = [
  'slash', 'fireBurst', 'windBlade', 'waterWave', 'lightBeam', 'darkPulse', 'healShimmer',
  'shieldDome', 'stunStar', 'burnFlicker', 'shockwave', 'projectile', 'frostShards',
];

/** Preferred representative skill per archetype — the recipe the overview shows. */
const PREFERRED: Record<VfxKind, SkillId> = {
  slash: 'BASH',
  fireBurst: 'FLARE',
  windBlade: 'GUST',
  waterWave: 'RIPPLE',
  lightBeam: 'JUDGEMENT',
  darkPulse: 'HEX',
  healShimmer: 'MEND',
  shieldDome: 'BULWARK',
  stunStar: 'ECLIPSE',
  burnFlicker: 'KINDLE',
  shockwave: 'QUAKE',
  projectile: 'CINDER',
  frostShards: 'CHILL',
};

/**
 * The preferred skill, but VERIFIED against the recipe table and replaced if it
 * has moved. RADIANCE was this sheet's lightBeam sample until it became a
 * healShimmer, and the sheet happily drew a heal in the lightBeam row under the
 * lightBeam label — a hardcoded map rots the moment a recipe is retargeted.
 */
function canonFor(kind: VfxKind): SkillId {
  const preferred = PREFERRED[kind];
  if (VFX_RECIPES[preferred] && VFX_RECIPES[preferred].kind === kind) return preferred;
  const found = (Object.keys(VFX_RECIPES) as SkillId[]).find((id) => VFX_RECIPES[id].kind === kind);
  if (!found) throw new Error(`no skill uses archetype ${kind}`);
  return found;
}

// --- What to draw --------------------------------------------------------------

interface Row {
  skill: SkillId;
  kind: VfxKind;
  label: string;
}

function rowFor(kind: VfxKind): Row {
  const skill = canonFor(kind);
  return { skill, kind, label: `${kind} · ${skill}` };
}

function rows(): { list: Row[]; detail: boolean } {
  const skill = params.get('skill');
  if (skill && skill in VFX_RECIPES) {
    const id = skill as SkillId;
    return { list: [{ skill: id, kind: VFX_RECIPES[id].kind, label: id }], detail: true };
  }
  const kindsParam = params.get('kinds') ?? params.get('kind');
  if (kindsParam) {
    const want = kindsParam.split(',').map((s) => s.trim()).filter((k): k is VfxKind => (KINDS as readonly string[]).includes(k));
    if (want.length) {
      return { list: want.map((k) => rowFor(k)), detail: true };
    }
  }
  return { list: KINDS.map(rowFor), detail: false };
}

const { list: ROWS, detail } = rows();
const mode = params.get('mode') ?? (detail ? 'both' : 'bloom');
const showRaw = mode === 'both' || mode === 'raw';
const showBloom = mode === 'both' || mode === 'bloom';
/**
 * Round 3 roughly quadrupled the impact half's reach (the ground splash alone
 * now runs to ~4.5 sizes either side, capped at 320 px) and moved every impact family's draw origin to
 * the CONTACT POINT — a fixed offset toward the attacker — so a cell that
 * fitted the round-2 clouds clips the near half of every one of them. The cell
 * is the frame an effect is JUDGED in, so it grew with the effects.
 */
const CELL = Math.max(80, Number(params.get('cell') ?? (detail ? 620 : 520)));
const GUTTER = 128;
const STRIPS = (showRaw ? 1 : 0) + (showBloom ? 1 : 0);

// --- The stage inside one cell -------------------------------------------------
//
// A crypt floor and one idle actor, so an effect is judged against the thing it
// is drawn over rather than against black. The battle screen spawns an effect at
// `feet.y - 40` with the actor drawn at ACTOR_SCALE = 2, and that is reproduced
// here exactly.

const ACTOR_ZOOM = 2;
const VFX_OFFSET = 40;

function floorY(): number {
  return Math.round(CELL * 0.78);
}

function drawGround(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const fy = floorY();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = floor;
  ctx.fillRect(0, fy, w, h - fy);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, fy, w, 2);
  // A couple of dim pillars, so a pale effect has something to be brighter than.
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(Math.round(w * 0.1), Math.round(h * 0.12), Math.round(w * 0.07), fy - Math.round(h * 0.12));
  ctx.fillRect(Math.round(w * 0.83), Math.round(h * 0.18), Math.round(w * 0.07), fy - Math.round(h * 0.18));
}

function drawActor(ctx: CanvasRenderingContext2D, cx: number): void {
  const recipe = ACTOR_RECIPES[actorId] ?? ACTOR_RECIPES.CINDER_IMP;
  const bmp = bakePose(recipe, 'idle', 0, recipe.element);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bmp,
    Math.round(cx - recipe.feet.x * ACTOR_ZOOM),
    Math.round(floorY() - recipe.feet.y * ACTOR_ZOOM),
    bmp.width * ACTOR_ZOOM,
    bmp.height * ACTOR_ZOOM,
  );
  ctx.imageSmoothingEnabled = true;
}

// --- The bloom stand-in --------------------------------------------------------
//
// engine/light.ts → renderPost: downscale the finished frame, cube it by
// multiplying it into itself twice (only near-white and fully saturated pixels
// survive), blur the small buffer, blit it back with 'lighter' at BLOOM_ALPHA.
// Same four steps at a cell's scale, so the sheet answers "what will the real
// post pass make of this?" without running the whole light module.

const BLOOM_DIV = 4;
const BLOOM_ALPHA = 0.5;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2d context');
  return g;
}

const bloomA = makeCanvas(CELL / BLOOM_DIV, CELL / BLOOM_DIV);
const bloomB = makeCanvas(CELL / BLOOM_DIV, CELL / BLOOM_DIV);
const bloomACtx = ctxOf(bloomA);
const bloomBCtx = ctxOf(bloomB);

function bloomInto(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, dx: number, dy: number): void {
  const a = bloomACtx;
  const b = bloomBCtx;
  a.setTransform(1, 0, 0, 1, 0, 0);
  a.globalCompositeOperation = 'copy';
  a.globalAlpha = 1;
  a.drawImage(src, 0, 0, src.width, src.height, 0, 0, bloomA.width, bloomA.height);
  b.globalCompositeOperation = 'copy';
  b.drawImage(bloomA, 0, 0);
  a.globalCompositeOperation = 'multiply';
  a.drawImage(bloomB, 0, 0);
  a.drawImage(bloomB, 0, 0);
  b.globalCompositeOperation = 'copy';
  b.filter = `blur(${BLOOM_DIV}px)`;
  b.drawImage(bloomA, 0, 0);
  b.filter = 'none';
  dst.drawImage(src, dx, dy);
  dst.save();
  dst.globalCompositeOperation = 'lighter';
  dst.globalAlpha = BLOOM_ALPHA;
  dst.imageSmoothingEnabled = true;
  dst.drawImage(bloomB, 0, 0, bloomB.width, bloomB.height, dx, dy, src.width, src.height);
  dst.restore();
}

// --- Stepping an effect to an age ----------------------------------------------
//
// One instance walks the whole strip: it is spawned once and stepped forward at
// a fixed 60 Hz to each sample age in turn, so the eight cells are eight moments
// of the SAME cloud rather than eight unrelated rolls of the dice.

const STEP = 1 / 60;

function spawnFor(row: Row, cx: number, cy: number, seed: number): VfxInstance | null {
  const list: VfxInstance[] = [];
  // A projectile needs somewhere to come from; everything else takes the hit
  // direction from `from` too (it decides which way a slash or a gust faces).
  spawnVfx(list, row.skill, cx, cy, { from: { x: cx - CELL * 0.9, y: cy + CELL * 0.12 }, seed });
  return list[0] ?? null;
}

function stepTo(list: VfxInstance[], target: number): void {
  const v = list[0];
  if (!v) return;
  let guard = 0;
  while (list.length > 0 && v.age < target && guard++ < 600) updateVfx(list, STEP);
}

/**
 * Forces the canvas's deferred display list to rasterise. Without it a timed
 * batch measures command RECORDING only and the backend flushes whenever it
 * likes, which is what produced the old "worst ms" column's 10-26 ms outliers:
 * they were one flush landing inside one iteration, not an effect's cost.
 */
function flush(ctx: CanvasRenderingContext2D): void {
  ctx.getImageData(0, 0, 1, 1);
}

// --- The measured envelope -------------------------------------------------------
//
// vfx.ts's BOUNDS table is what the light plane treats as an effect's glow
// source, and its comment calls the rows "the measured envelopes of the built
// particle systems" — but nothing here ever measured them, so every retune left
// them a little more wrong. This does measure them, off PIXELS rather than off
// the particle records: the effect is drawn alone on a transparent canvas at
// each 60 Hz step, the alpha bounding box of that frame is read back, and the
// union over the whole life is the envelope. No coupling to the module's
// internals (shape ids, stretch semantics, which extras a renderer blits) — it
// simply asks what got drawn.
//
// Reported in multiples of `size` around the origin, in BOUNDS' own order and
// sign convention, so a row can be pasted straight into the table.

/** Alpha at or above this counts as drawn — under it is fringe the eye never sees. */
const ENV_ALPHA = 10;

interface Envelope {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /**
   * The worst PER-FRAME overrun of that frame's own `vfxBounds`, in multiples
   * of `size`; 0 when every frame's drawn pixels sat inside the box the module
   * declared for that frame.
   *
   * The four numbers above are a union over the whole life, and for one
   * archetype that is the wrong question: `projectile`'s box travels with the
   * head on purpose (see BOUNDS in vfx.ts), so its lifetime union spans the
   * entire flight corridor — ~6.8 sizes — while the box at any given instant is
   * 2.9. The union column reported that as a 2.3-size overrun and it was read
   * as a bounds bug. This column asks what the light plane actually needs: at
   * the moment it reads the rect, does the rect contain what is drawn?
   */
  over: number;
}

function measureEnvelope(row: Row, seed: number): Envelope | null {
  const probe = at(row, seed, 0);
  const v = probe[0];
  const s = v.size;
  // Room for the widest archetype (a light pillar stands 3.4 sizes) plus the
  // ground wash below and a wide shockwave either side.
  // + 160 of slack, not 80: round 3's contact offset moves an impact family's
  // whole draw origin a fixed distance toward the attacker, on top of the
  // archetype's own reach.
  const half = Math.ceil(s * 5 + 160);
  const size = half * 2;
  const c = makeCanvas(size, size);
  const ctx = ctxOf(c);
  const list: VfxInstance[] = [];
  spawnVfx(list, row.skill, half, half, { from: { x: half - CELL * 0.9, y: half + CELL * 0.12 }, seed });
  // The ORIGIN the drawn pixels are reported against is the instance's own
  // (v.x, v.y), not the point spawnVfx was called at. Round 3 offsets an
  // impact's whole instance to the contact point, a fixed distance toward the
  // attacker, and vfxBounds is relative to that offset origin — which is what
  // game/screens/battle.ts feeds the light plane. Measuring from the spawn
  // point instead reported every impact family's envelope 0.6-0.9 sizes wide on
  // the left and the same amount narrow on the right, and made the table below
  // read as a bounds bug when the bounds were right.
  const ox = list[0].x;
  const oy = list[0].y;
  const box: VfxBounds = { x: 0, y: 0, w: 0, h: 0 };
  let over = 0;
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  let guard = 0;
  while (list.length > 0 && guard++ < 400) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy';
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    renderVfxUnder(ctx, list);
    renderVfx(ctx, list);
    const px = ctx.getImageData(0, 0, size, size).data;
    // This frame's own drawn extent, for the per-frame containment column.
    let fl = Infinity;
    let ft = Infinity;
    let fr = -Infinity;
    let fb = -Infinity;
    for (let y = 0; y < size; y++) {
      const row0 = y * size * 4;
      for (let x = 0; x < size; x++) {
        if (px[row0 + x * 4 + 3] < ENV_ALPHA) continue;
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < t) t = y;
        if (y > b) b = y;
        if (x < fl) fl = x;
        if (x > fr) fr = x;
        if (y < ft) ft = y;
        if (y > fb) fb = y;
      }
    }
    if (fr >= 0) {
      vfxBounds(list[0], box);
      const o = Math.max(box.x - fl, box.y - ft, fr - (box.x + box.w), fb - (box.y + box.h), 0);
      if (o > over) over = o;
    }
    updateVfx(list, STEP);
  }
  if (l === Infinity) return null;
  return {
    left: (l - ox) / s,
    top: (t - oy) / s,
    right: (r - ox) / s,
    bottom: (b - oy) / s,
    over: over / s,
  };
}

/** The rect vfxBounds reports, so the bloom feed's extent can be eyeballed against what is actually drawn. */
function drawBounds(ctx: CanvasRenderingContext2D, b: VfxBounds): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,80,80,0.75)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(b.x) + 0.5, Math.round(b.y) + 0.5, Math.round(b.w), Math.round(b.h));
  ctx.restore();
}

// --- Render ---------------------------------------------------------------------

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
const out = document.getElementById('metrics') as HTMLPreElement;

export interface VfxMetrics {
  kind: VfxKind;
  skill: string;
  /** Live particle count the instance built at spawn. */
  particles: number;
  /** Of those, the ones drawn 'source-over' (smoke, debris, crystal). */
  dark: number;
  size: number;
  duration: number;
  /** Mean ms for one renderVfx call at mid-life over RENDER_REPS draws, INCLUDING rasterisation (the batch is flushed inside the timed region). */
  msRender: number;
  /**
   * The WORST of PEAK_SWEEP, which is where the budget question actually lives:
   * the contact flash, the shockwave ring, the eight radial sparks and most
   * families' own burst are all on screen inside the first 120 ms and every one
   * of them is gone by mid-life, so measuring only the middle of an effect
   * flatters it by up to a factor of two. Swept rather than sampled at one
   * fixed age because the peak is not in the same place for every family: a
   * projectile is an empty frame at t 16 % and does not land until t 42 %.
   */
  msPeak: number;
  /** Where in the life msPeak was found, 0..1. */
  peakAt: number;
  /** Live particles there — what msPeak is actually drawing. */
  peakParts: number;
  /** Mean ms for one updateVfx call, over RENDER_REPS steps. */
  msUpdate: number;
  /** vfxBounds' rect for this archetype at `size`, in px — the bloom feed's extent. */
  boundsW: number;
  boundsH: number;
}

const RENDER_REPS = 240;
/** Ages swept for the cost peak, as fractions of the life. */
const PEAK_SWEEP = [0.06, 0.16, 0.3, 0.46, 0.62];

/** A fresh instance of `row`, stepped to `frac` of its life, at (cx, cy). */
function at(row: Row, seed: number, frac: number, cx = CELL / 2, cy = floorY() - VFX_OFFSET): VfxInstance[] {
  const list: VfxInstance[] = [];
  spawnVfx(list, row.skill, cx, cy, { from: { x: cx - CELL * 0.9, y: cy + CELL * 0.12 }, seed });
  stepTo(list, list[0].duration * frac);
  return list;
}

/**
 * The cost canvas is sized to the EFFECT, not to the display cell.
 *
 * Until round 3 the timing ran into a CELL-sized offscreen (150 px on the
 * overview) while the archetypes' own envelopes were already 250-430 px wide,
 * so the backend clipped between a third and three quarters of every blit and
 * the table reported the cost of the middle of an effect, not the effect. It
 * flattered exactly the change this round makes — doubling the impact half's
 * reach adds fill OUTSIDE a 150-px box and would have cost nothing on the old
 * harness. Cap: no archetype's envelope reaches 640 px at these sizes, and a
 * canvas bigger than the thing drawn into it costs nothing to clear.
 */
const COST_MAX = 640;

function costCanvas(row: Row, seed: number): { c: HTMLCanvasElement; cx: number; cy: number } {
  const probe = at(row, seed, 0.3);
  const b = vfxBounds(probe[0]);
  const dim = Math.min(COST_MAX, Math.max(CELL, Math.ceil(Math.max(b.w, b.h)) + 48));
  return { c: makeCanvas(dim, dim), cx: dim / 2, cy: dim / 2 };
}

/** Live particles in an instance right now — the ones drawPart will not skip. */
function liveParts(v: VfxInstance): number {
  let n = 0;
  for (let i = 0; i < v.count; i++) {
    const p = v.parts[i];
    const t = v.age - p.born;
    if (t >= 0 && t < p.life) n++;
  }
  return n;
}

/** Mean ms of one renderVfx over RENDER_REPS draws, rasterisation included. */
function timeRender(ctx: CanvasRenderingContext2D, list: VfxInstance[]): number {
  // Warm the JIT and the sprite atlas before the clock starts.
  for (let i = 0; i < 30; i++) renderVfx(ctx, list);
  flush(ctx);
  const t0 = performance.now();
  for (let i = 0; i < RENDER_REPS; i++) renderVfx(ctx, list);
  flush(ctx);
  return (performance.now() - t0) / RENDER_REPS;
}

/** Cost of one archetype at its peak and at mid-life, into an offscreen the size of a cell. */
function measure(row: Row, seed: number): VfxMetrics {
  const { c, cx, cy } = costCanvas(row, seed);
  const ctx = ctxOf(c);
  let msPeak = 0;
  let peakAt = 0;
  let peakParts = 0;
  for (const frac of PEAK_SWEEP) {
    const probe = at(row, seed, frac, cx, cy);
    if (probe.length === 0) continue;
    const ms = timeRender(ctx, probe);
    if (ms <= msPeak) continue;
    msPeak = ms;
    peakAt = frac;
    peakParts = liveParts(probe[0]);
  }
  const list = at(row, seed, 0.5, cx, cy);
  const v = list[0];
  const particles = v.count;
  const dark = v.darkCount;
  const msRender = timeRender(ctx, list);
  // updateVfx on a list that never expires: age is rewound each step.
  const u0 = performance.now();
  for (let i = 0; i < RENDER_REPS; i++) {
    updateVfx(list, STEP);
    if (list.length === 0) break;
    list[0].age = v.duration * 0.5;
  }
  const msUpdate = (performance.now() - u0) / RENDER_REPS;
  const b = vfxBounds(v);
  return {
    kind: row.kind,
    skill: row.skill,
    particles,
    dark,
    size: v.size,
    duration: v.duration,
    msRender: Math.round(msRender * 1000) / 1000,
    msPeak: Math.round(msPeak * 1000) / 1000,
    peakAt,
    peakParts,
    msUpdate: Math.round(msUpdate * 1000) / 1000,
    boundsW: Math.round(b.w),
    boundsH: Math.round(b.h),
  };
}

function render(): VfxMetrics[] {
  const W = GUTTER + AGES * CELL;
  const rowH = STRIPS * CELL + 22;
  const H = ROWS.length * rowH;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = ctxOf(canvas);
  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, W, H);

  const cell = makeCanvas(CELL, CELL);
  const cellCtx = ctxOf(cell);
  const cx = CELL / 2;
  const cy = floorY() - VFX_OFFSET;

  ROWS.forEach((row, ri) => {
    const top = ri * rowH;
    const list: VfxInstance[] = [];
    const v = spawnFor(row, cx, cy, SEED_BASE + ri);
    if (v) list.push(v);
    for (let k = 0; k < AGES; k++) {
      const target = ((k + 0.5) / AGES) * (v ? v.duration : 1);
      stepTo(list, target);
      // One cell, in game/screens/battle.ts's own order: ground, the effect's
      // GROUND half, the actor, then everything the effect throws into the air.
      // The sheet drew only `renderVfx` for one round and the floor pool was
      // simply missing from every cell — the one place the pool is supposed to
      // be judged.
      cellCtx.setTransform(1, 0, 0, 1, 0, 0);
      cellCtx.globalCompositeOperation = 'source-over';
      cellCtx.globalAlpha = 1;
      drawGround(cellCtx, CELL, CELL);
      renderVfxUnder(cellCtx, list);
      cellCtx.setTransform(1, 0, 0, 1, 0, 0);
      cellCtx.globalCompositeOperation = 'source-over';
      cellCtx.globalAlpha = 1;
      drawActor(cellCtx, cx);
      renderVfx(cellCtx, list);
      if (SHOW_BOUNDS && list.length > 0) drawBounds(cellCtx, vfxBounds(list[0]));
      const dx = GUTTER + k * CELL;
      let sy = top;
      if (showRaw) {
        ctx.drawImage(cell, dx, sy);
        sy += CELL;
      }
      if (showBloom) bloomInto(ctx, cell, dx, sy);
      // A hairline between cells so the strip reads as frames.
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, top + 0.5, CELL - 1, STRIPS * CELL - 1);
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`t ${(((k + 0.5) / AGES) * 100).toFixed(0)}%`, dx + 4, top + 4);
    }
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText(row.kind, 8, top + 10);
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(row.skill, 8, top + 28);
    if (showRaw && showBloom) {
      ctx.fillText('raw', 8, top + 52);
      ctx.fillText('bloom', 8, top + CELL + 8);
    }
  });
  return ROWS.map((row, i) => measure(row, SEED_BASE + i));
}

function table(metrics: VfxMetrics[]): string {
  const head = 'archetype      skill          parts  dark  size  dur    peak ms   at%  live  mid ms  update ms   bounds w x h';
  const body = metrics.map((m) =>
    `${m.kind.padEnd(14)} ${m.skill.padEnd(14)} ${String(m.particles).padStart(5)} ${String(m.dark).padStart(5)} ` +
    `${String(m.size).padStart(5)} ${m.duration.toFixed(2).padStart(5)} ${m.msPeak.toFixed(3).padStart(8)} ` +
    `${String(Math.round(m.peakAt * 100)).padStart(4)} ${String(m.peakParts).padStart(5)} ${m.msRender.toFixed(3).padStart(7)} ` +
    `${m.msUpdate.toFixed(3).padStart(9)}   ${m.boundsW} x ${m.boundsH}`);
  const worstPeak = metrics.reduce((a, m) => Math.max(a, m.msPeak), 0);
  const worstMid = metrics.reduce((a, m) => Math.max(a, m.msRender), 0);
  return [
    head,
    ...body,
    '',
    `worst mean render: ${worstPeak.toFixed(3)} ms at each family's own peak, ` +
    `${worstMid.toFixed(3)} ms at mid-life (budget: <= 1.5 ms per family, the round-3 gate; ` +
    `HEAD measures 0.59-0.68 on this same harness. Means include rasterisation, and the cost ` +
    `canvas is sized to the EFFECT, not to the display cell — see COST_MAX)`,
  ].join('\n');
}

/**
 * The measured envelope beside the one vfx.ts declares, in BOUNDS' own units
 * and order — paste-ready. Opt-in (`envelope=1`) because it rasterises and
 * reads back every frame of every row.
 */
function envelopeTable(): string {
  const head = 'archetype      skill            measured [l, t, r, b] x size          declared                                per-frame';
  const lines = ROWS.map((row, i) => {
    const e = measureEnvelope(row, SEED_BASE + i);
    if (!e) return `${row.kind.padEnd(14)} ${row.skill.padEnd(14)} (nothing drawn)`;
    const list: VfxInstance[] = [];
    spawnVfx(list, row.skill, 0, 0, { seed: SEED_BASE + i });
    const v = list[0];
    const d = vfxBounds(v);
    const f = (n: number): string => (n >= 0 ? ' ' : '') + n.toFixed(2);
    return `${row.kind.padEnd(14)} ${row.skill.padEnd(14)} ` +
      `[${f(e.left)}, ${f(e.top)}, ${f(e.right)}, ${f(e.bottom)}]   ` +
      `[${f(d.x / v.size)}, ${f(d.y / v.size)}, ${f((d.x + d.w) / v.size)}, ${f((d.y + d.h) / v.size)}]   ` +
      (e.over <= 0.005 ? 'in' : `OUT by ${e.over.toFixed(2)}`);
  });
  return ['',
    'measured drawn envelope vs vfxBounds (multiples of size, y negative up).',
    'The first two columns are LIFETIME unions; "per-frame" is the column that matters —',
    'whether each frame\'s drawn pixels sat inside the box vfxBounds declared for THAT frame,',
    'which is what the light plane reads. A travelling box (projectile) is `in` per frame and',
    'far wider than its box over a whole life; that is the design, not an overrun.',
    head, ...lines].join('\n');
}

const metrics = render();
const envelopes = params.get('envelope') === '1' ? envelopeTable() : '';
out.textContent = `vfx sheet · ${ROWS.length} row(s) · ages=${AGES} · cell=${CELL} · mode=${mode}\n${table(metrics)}${envelopes}`;
(window as unknown as { __lineup: { ready: boolean; metrics: VfxMetrics[] } }).__lineup = { ready: true, metrics };
