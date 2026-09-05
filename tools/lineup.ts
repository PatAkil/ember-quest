// tools/lineup.ts — the art loop's eyes. Dev-server only (Vite serves it at
// /tools/lineup.html; `vite build` never bundles it and nothing in game/ or
// engine/ imports it).
//
// Renders every recipe in game/art/actors.ts straight from the real bake
// pipeline (bakePose) so what the artist and the critic look at is exactly
// what the battle screen draws, and measures the numbers ART-REVIEW.md's ship
// criteria are written in. Driven by URL parameters:
//
//   sheet=lineup   every actor's idle frame 0 in a grid            (default)
//   sheet=poses    one actor (actor=ID), 5 poses x 3 frames
//   mode=color | grey | sil   colour, greyscale (value read), flat silhouette
//   zoom=N         screen pixels per cell (default ACTOR_SCALE = 2)
//   group=all | heroes | enemies | ID,ID,...   which actors (lineup)
//   cols=N         grid columns (lineup; default 7, or 4 at zoom >= 4)
//   bg=RRGGBB      the ground colour (default the stage navy, 1d2b53)
//
// The metrics land in window.__lineup (read by tools/capture.mjs) and as a
// table under the canvas.

import { ACTOR_RECIPES, ACTOR_SCALE, POSE_FRAMES, bakePose } from '../game/art/actors';
import type { ActorRecipe, PoseName } from '../game/art/actors';

const params = new URLSearchParams(location.search);
const sheet = params.get('sheet') ?? 'lineup';
const mode = params.get('mode') ?? 'color';
const zoom = Math.max(1, Math.round(Number(params.get('zoom') ?? ACTOR_SCALE)));
const bg = '#' + (params.get('bg') ?? '1d2b53').replace('#', '');
const groupParam = params.get('group') ?? 'all';
const actorParam = params.get('actor') ?? 'EMBER';
const cols = Math.max(1, Number(params.get('cols') ?? (zoom >= 4 ? 4 : 7)));

const HEROES = ['EMBER', 'GALE', 'TIDE', 'BASALT', 'SABLE', 'LUMEN'];
const POSES: readonly PoseName[] = ['idle', 'attack', 'hurt', 'cast', 'dead'];
/** Every cell is sized for the boss canvas so one grid fits every recipe; `LABEL` rows sit under it. */
const CELL_CELLS = 100;
const LABEL_H = 18;
const PAD = 8;

function ids(): string[] {
  const all = Object.keys(ACTOR_RECIPES);
  if (groupParam === 'all') return all;
  if (groupParam === 'heroes') return all.filter((id) => HEROES.includes(id));
  if (groupParam === 'enemies') return all.filter((id) => !HEROES.includes(id));
  return groupParam.split(',').map((s) => s.trim()).filter((id) => id in ACTOR_RECIPES);
}

// --- Metrics ---------------------------------------------------------------------
// Everything ART-REVIEW.md's ship criteria put a number on, from the idle frame's
// own baked bitmap (one getImageData per actor, tool-time only).

export interface ActorMetrics {
  id: string;
  /** Body pixels (alpha > 0) in the idle-0 bake. */
  pixels: number;
  /** Bounding box of the silhouette in cells. */
  w: number;
  h: number;
  /** Height of the silhouette as a percentage of the 720-px frame at ACTOR_SCALE. */
  framePct: number;
  /** CIE L* (0-100, perceptual — HSL lightness scores a saturated green as dark) span: min / 2nd percentile / 98th percentile / max. */
  lMin: number;
  lP2: number;
  lP98: number;
  lMax: number;
  /** Criterion 1: >= 20 % of body pixels below L 35 and >= 8 % above L 75. */
  pctBelow35: number;
  pctAbove75: number;
  /** The same dark share with the one-cell keyline excluded — an outline is not an anchor. */
  pctBelow35Interior: number;
  /** Mean L* of the silhouette's top quarter and bottom quarter, and their difference: a figure lit from above is positive by >= 8. */
  topL: number;
  bottomL: number;
  litDelta: number;
  /** Histogram over L bands 0-15 / 15-35 / 35-55 / 55-75 / 75-100, as percentages. */
  bands: number[];
  /** WCAG contrast of every body pixel against the ground: mean, min, and the share below 3:1 (criterion 6: mean >= 3, <= 45 % below). */
  contrastMean: number;
  contrastMin: number;
  pctBelow3: number;
  /** Distinct colours in the frame. */
  colours: number;
  /** IoU of the idle silhouette with its own horizontal mirror (%) — a humanoid with a stance sits under 85. */
  mirrorIoU: number;
  /** The other actor whose idle silhouette overlaps this one most (feet-aligned, centred), and that IoU (%) — criterion 4 wants every pair under ~78. */
  nearest: string;
  nearestIoU: number;
}

const HUMANOIDS = new Set(['EMBER', 'GALE', 'TIDE', 'BASALT', 'SABLE', 'LUMEN', 'CRYPT_WARDEN', 'PYRE_KNIGHT', 'DROWNED_KNIGHT', 'MARSH_HAG', 'HOLLOW_KING', 'PALE_SAINT']);
interface Mask {
  w: number;
  h: number;
  bits: Uint8Array;
}
const masks = new Map<string, Mask>();

/** IoU of two silhouettes, feet-aligned and horizontally centred. */
function maskIoU(a: Mask, b: Mask): number {
  const W = Math.max(a.w, b.w);
  const H = Math.max(a.h, b.h);
  const ax = Math.floor((W - a.w) / 2);
  const ay = H - a.h;
  const bx = Math.floor((W - b.w) / 2);
  const by = H - b.h;
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ia = x >= ax && x < ax + a.w && y >= ay ? a.bits[(y - ay) * a.w + (x - ax)] : 0;
      const ib = x >= bx && x < bx + b.w && y >= by ? b.bits[(y - by) * b.w + (x - bx)] : 0;
      if (ia && ib) inter++;
      if (ia || ib) uni++;
    }
  }
  return uni ? Math.round((1000 * inter) / uni) / 10 : 0;
}
function mirrorIoU(m: Mask): number {
  let inter = 0;
  let uni = 0;
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      const a = m.bits[y * m.w + x];
      const b = m.bits[y * m.w + (m.w - 1 - x)];
      if (a && b) inter++;
      if (a || b) uni++;
    }
  }
  return uni ? Math.round((1000 * inter) / uni) / 10 : 0;
}

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function luminance(r: number, g: number, b: number): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
/** CIE L* from relative luminance. */
function lstar(y: number): number {
  return y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16;
}
function contrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const scratch = document.createElement('canvas');
const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });

function measure(recipe: ActorRecipe): ActorMetrics {
  const bmp = bakePose(recipe, 'idle', 0, recipe.element);
  scratch.width = bmp.width;
  scratch.height = bmp.height;
  const ctx = scratchCtx;
  if (!ctx) throw new Error('no 2d context');
  ctx.clearRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const data = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const [br, bgg, bb] = hexRgb(bg);
  const groundLum = luminance(br, bgg, bb);
  const W = bmp.width;
  const Hh = bmp.height;
  const opaque = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < Hh && data[(y * W + x) * 4 + 3] !== 0;
  const ls: number[] = [];
  const ys: number[] = [];
  let x0 = W;
  let y0 = Hh;
  let x1 = -1;
  let y1 = -1;
  let below35 = 0;
  let above75 = 0;
  let interior = 0;
  let below35Interior = 0;
  const bands = [0, 0, 0, 0, 0];
  let cSum = 0;
  let cMin = Infinity;
  let below3 = 0;
  const colours = new Set<number>();
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      colours.add((r << 16) | (g << 8) | b);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const yl = luminance(r, g, b);
      const l = lstar(yl);
      ls.push(l);
      ys.push(y);
      const edge = !(opaque(x - 1, y) && opaque(x + 1, y) && opaque(x, y - 1) && opaque(x, y + 1));
      if (!edge) {
        interior++;
        if (l < 35) below35Interior++;
      }
      if (l < 35) below35++;
      if (l > 75) above75++;
      bands[l < 15 ? 0 : l < 35 ? 1 : l < 55 ? 2 : l < 75 ? 3 : 4]++;
      const c = contrast(yl, groundLum);
      cSum += c;
      if (c < cMin) cMin = c;
      if (c < 3) below3++;
    }
  }
  const n = Math.max(1, ls.length);
  const h = y1 >= y0 ? y1 - y0 + 1 : 0;
  // Top and bottom quarters of the silhouette's own rows — the lit-from-above read.
  const q = Math.max(1, Math.floor(h / 4));
  let topSum = 0;
  let topN = 0;
  let botSum = 0;
  let botN = 0;
  for (let k = 0; k < ls.length; k++) {
    if (ys[k] < y0 + q) {
      topSum += ls[k];
      topN++;
    } else if (ys[k] > y1 - q) {
      botSum += ls[k];
      botN++;
    }
  }
  const topL = topN ? topSum / topN : 0;
  const bottomL = botN ? botSum / botN : 0;
  const mw = x1 >= x0 ? x1 - x0 + 1 : 0;
  const bits = new Uint8Array(Math.max(0, mw * h));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) bits[(y - y0) * mw + (x - x0)] = data[(y * W + x) * 4 + 3] !== 0 ? 1 : 0;
  const mask: Mask = { w: mw, h, bits };
  masks.set(recipe.id, mask);
  ls.sort((a, b) => a - b);
  const pct = (k: number): number => Math.round((100 * k) / n * 10) / 10;
  return {
    id: recipe.id,
    pixels: ls.length,
    w: x1 >= x0 ? x1 - x0 + 1 : 0,
    h,
    framePct: Math.round(((h * ACTOR_SCALE) / 720) * 1000) / 10,
    lMin: Math.round(ls[0] ?? 0),
    lP2: Math.round(ls[Math.floor(0.02 * (n - 1))] ?? 0),
    lP98: Math.round(ls[Math.floor(0.98 * (n - 1))] ?? 0),
    lMax: Math.round(ls[n - 1] ?? 0),
    pctBelow35: pct(below35),
    pctAbove75: pct(above75),
    pctBelow35Interior: Math.round((100 * below35Interior) / Math.max(1, interior) * 10) / 10,
    topL: Math.round(topL),
    bottomL: Math.round(bottomL),
    litDelta: Math.round(topL - bottomL),
    bands: bands.map(pct),
    contrastMean: Math.round((cSum / n) * 100) / 100,
    contrastMin: Math.round((cMin === Infinity ? 0 : cMin) * 100) / 100,
    pctBelow3: pct(below3),
    colours: colours.size,
    mirrorIoU: mirrorIoU(mask),
    nearest: '',
    nearestIoU: 0,
  };
}

/** Fills `nearest`/`nearestIoU` across a measured set — every pair, feet-aligned. */
function fillNearest(metrics: ActorMetrics[]): void {
  for (const m of metrics) {
    const a = masks.get(m.id);
    if (!a) continue;
    for (const o of metrics) {
      if (o.id === m.id) continue;
      const b = masks.get(o.id);
      if (!b) continue;
      const v = maskIoU(a, b);
      if (v > m.nearestIoU) {
        m.nearestIoU = v;
        m.nearest = o.id;
      }
    }
  }
}

// --- Drawing -----------------------------------------------------------------------

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
const out = document.getElementById('metrics') as HTMLPreElement;

function drawFrame(ctx: CanvasRenderingContext2D, recipe: ActorRecipe, pose: PoseName, frame: number, feetX: number, feetY: number): void {
  const bmp = bakePose(recipe, pose, frame, recipe.element);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bmp, Math.round(feetX - recipe.feet.x * zoom), Math.round(feetY - recipe.feet.y * zoom), bmp.width * zoom, bmp.height * zoom);
}

/** Applies the value-read modes to the art layer: greyscale keeps luminance, silhouette flattens every body pixel. */
function applyMode(art: HTMLCanvasElement): void {
  if (mode === 'color') return;
  const ctx = art.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, art.width, art.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (mode === 'sil') {
      d[i] = 214;
      d[i + 1] = 214;
      d[i + 2] = 220;
      d[i + 3] = 255;
    } else {
      const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
      d[i] = l;
      d[i + 1] = l;
      d[i + 2] = l;
    }
  }
  ctx.putImageData(img, 0, 0);
}

interface Cell {
  recipe: ActorRecipe;
  pose: PoseName;
  frame: number;
  col: number;
  row: number;
  label: string;
}

function layout(): { cells: Cell[]; cols: number; rows: number; rowLabels: string[] } {
  const cells: Cell[] = [];
  if (sheet === 'poses') {
    const recipe = ACTOR_RECIPES[actorParam];
    if (!recipe) return { cells, cols: 1, rows: 1, rowLabels: [`unknown actor ${actorParam}`] };
    let maxFrames = 1;
    POSES.forEach((pose, row) => {
      const n = POSE_FRAMES[pose];
      if (n > maxFrames) maxFrames = n;
      for (let f = 0; f < n; f++) cells.push({ recipe, pose, frame: f, col: f, row, label: `${pose} ${f}` });
    });
    return { cells, cols: maxFrames, rows: POSES.length, rowLabels: POSES.map((p) => `${actorParam} · ${p}`) };
  }
  const list = ids();
  list.forEach((id, i) => {
    cells.push({ recipe: ACTOR_RECIPES[id], pose: 'idle', frame: 0, col: i % cols, row: Math.floor(i / cols), label: id });
  });
  return { cells, cols: Math.min(cols, Math.max(1, list.length)), rows: Math.max(1, Math.ceil(list.length / cols)), rowLabels: [] };
}

function render(): ActorMetrics[] {
  const { cells, cols: nCols, rows, rowLabels } = layout();
  const cellW = CELL_CELLS * zoom + PAD;
  const cellH = CELL_CELLS * zoom + PAD + LABEL_H;
  const leftGutter = rowLabels.length ? 150 : 0;
  const W = leftGutter + nCols * cellW;
  const H = rows * cellH;
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const art = document.createElement('canvas');
  art.width = W;
  art.height = H;
  const actx = art.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!actx || !ctx) throw new Error('no 2d context');

  for (const c of cells) {
    const feetX = leftGutter + c.col * cellW + cellW / 2;
    const feetY = c.row * cellH + cellH - LABEL_H - PAD - 2 * zoom;
    drawFrame(actx, c.recipe, c.pose, c.frame, feetX, feetY);
  }
  applyMode(art);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // A faint ground line per row so a floating figure is visible as floating.
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    const y = r * cellH + cellH - LABEL_H - PAD - 2 * zoom + 0.5;
    ctx.beginPath();
    ctx.moveTo(leftGutter, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.drawImage(art, 0, 0);
  ctx.font = '13px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of cells) {
    ctx.fillText(c.label, leftGutter + c.col * cellW + cellW / 2, c.row * cellH + cellH - LABEL_H);
  }
  ctx.textAlign = 'left';
  rowLabels.forEach((label, r) => ctx.fillText(label, 8, r * cellH + 8));

  const seen = new Set<string>();
  const metrics: ActorMetrics[] = [];
  for (const c of cells) {
    if (seen.has(c.recipe.id)) continue;
    seen.add(c.recipe.id);
    metrics.push(measure(c.recipe));
  }
  fillNearest(metrics);
  return metrics;
}

function table(metrics: ActorMetrics[]): string {
  const head = 'actor            px   w  h  frame%  L* min/p2/p98/max  <L35%  int<35%  >L75%  top/bot dL  bands 0-15/15-35/35-55/55-75/75+   contrast mean/min  <3:1%  colours  mirror%  nearest (IoU%)';
  const rows = metrics.map((m) => {
    const id = m.id.padEnd(15);
    const l = `${String(m.lMin).padStart(3)}/${String(m.lP2).padStart(3)}/${String(m.lP98).padStart(3)}/${String(m.lMax).padStart(3)}`;
    const bands = m.bands.map((b) => String(b).padStart(5)).join(' ');
    const lit = `${String(m.topL).padStart(3)}/${String(m.bottomL).padStart(3)} ${String(m.litDelta).padStart(3)}`;
    return `${id} ${String(m.pixels).padStart(5)} ${String(m.w).padStart(3)} ${String(m.h).padStart(2)}  ${String(m.framePct).padStart(5)}  ${l}    ${String(m.pctBelow35).padStart(5)}  ${String(m.pctBelow35Interior).padStart(7)}  ${String(m.pctAbove75).padStart(5)}  ${lit}  ${bands}   ${String(m.contrastMean).padStart(5)}/${String(m.contrastMin).padStart(5)}  ${String(m.pctBelow3).padStart(5)}  ${String(m.colours).padStart(7)}  ${String(m.mirrorIoU).padStart(7)}  ${m.nearest} (${m.nearestIoU})`;
  });
  return [head, ...rows].join('\n');
}

const metrics = render();
out.textContent = `sheet=${sheet} mode=${mode} zoom=${zoom} bg=${bg}\n${table(metrics)}`;
(window as unknown as { __lineup: { ready: boolean; sheet: string; mode: string; zoom: number; metrics: ActorMetrics[]; humanoids: string[] } }).__lineup = {
  ready: true,
  sheet,
  mode,
  zoom,
  metrics,
  humanoids: [...HUMANOIDS],
};
