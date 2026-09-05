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
//   bg=RRGGBB           the ground colour (default the stage navy, 1d2b53)
//   actor=ID            who stands in the cell (default CINDER_IMP)
//
// The per-archetype render cost lands in window.__lineup.metrics (read by
// tools/capture.mjs) and as a table under the canvas.

import { ACTOR_RECIPES, bakePose } from '../game/art/actors';
import { VFX_RECIPES, spawnVfx, updateVfx, renderVfx, vfxBounds } from '../game/art/vfx';
import type { VfxBounds, VfxInstance, VfxKind } from '../game/art/vfx';
import type { SkillId } from '../game/types';

const params = new URLSearchParams(location.search);
const bg = '#' + (params.get('bg') ?? '1d2b53').replace('#', '');
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
const CELL = Math.max(80, Number(params.get('cell') ?? (detail ? 190 : 150)));
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
  ctx.fillStyle = '#131d3a';
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
  /** Mean ms for one updateVfx call, over RENDER_REPS steps. */
  msUpdate: number;
  /** vfxBounds' rect for this archetype at `size`, in px — the bloom feed's extent. */
  boundsW: number;
  boundsH: number;
}

const RENDER_REPS = 300;

/** Cost of one archetype at mid-life, drawn into an offscreen the size of a cell. */
function measure(row: Row, seed: number): VfxMetrics {
  const c = makeCanvas(CELL, CELL);
  const ctx = ctxOf(c);
  const cx = CELL / 2;
  const cy = floorY() - VFX_OFFSET;
  const list: VfxInstance[] = [];
  spawnVfx(list, row.skill, cx, cy, { from: { x: cx - CELL * 0.9, y: cy + CELL * 0.12 }, seed });
  const v = list[0];
  const particles = v.count;
  const dark = v.darkCount;
  stepTo(list, v.duration * 0.5);
  // Warm the JIT and the sprite atlas before the clock starts.
  for (let i = 0; i < 30; i++) renderVfx(ctx, list);
  flush(ctx);
  const t0 = performance.now();
  for (let i = 0; i < RENDER_REPS; i++) renderVfx(ctx, list);
  flush(ctx);
  const msRender = (performance.now() - t0) / RENDER_REPS;
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
      // One cell: ground, actor, effect — the effect translated from the
      // instance's own origin to this cell's, because renderVfx draws at (x, y).
      cellCtx.setTransform(1, 0, 0, 1, 0, 0);
      cellCtx.globalCompositeOperation = 'source-over';
      cellCtx.globalAlpha = 1;
      drawGround(cellCtx, CELL, CELL);
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
  const head = 'archetype      skill          parts  dark  size  dur    render ms  update ms   bounds w x h';
  const body = metrics.map((m) =>
    `${m.kind.padEnd(14)} ${m.skill.padEnd(14)} ${String(m.particles).padStart(5)} ${String(m.dark).padStart(5)} ` +
    `${String(m.size).padStart(5)} ${m.duration.toFixed(2).padStart(5)} ${m.msRender.toFixed(3).padStart(10)} ` +
    `${m.msUpdate.toFixed(3).padStart(9)}   ${m.boundsW} x ${m.boundsH}`);
  const worst = metrics.reduce((a, m) => Math.max(a, m.msRender), 0);
  return [head, ...body, '', `worst mean render: ${worst.toFixed(3)} ms (budget: <= 0.5 ms; means include rasterisation)`].join('\n');
}

const metrics = render();
out.textContent = `vfx sheet · ${ROWS.length} row(s) · ages=${AGES} · cell=${CELL} · mode=${mode}\n${table(metrics)}`;
(window as unknown as { __lineup: { ready: boolean; metrics: VfxMetrics[] } }).__lineup = { ready: true, metrics };
