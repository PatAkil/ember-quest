// tools/study.ts — the pixel study's side-by-side sheet. Dev-server only
// (Vite serves it at /tools/study.html; nothing under game/ or engine/
// imports it).
//
// One sheet, three rows (zoom 2 = the on-screen size, the real test; then 4
// and 8), the same columns in every row: the reference crops from
// tools/ref/crops/ drawn with smoothing OFF and scaled so one reference
// sprite pixel is one study cell (a line-up crop is ~2 screen px per sprite
// px, so it is drawn at Z/2; a battle crop is ~1.5, so Z/1.5), then the kit's
// EMBER straight from bakePose, then the hand-drawn EMBER_STUDY through
// makeSprite + bakeSprite + drawBaked — the same path the battle would use.
//
//   pose=idle|attack|hurt|cast|dead   frame=0..2
//   mode=color|grey                   a greyscale value read (bg included)
//   bg=RRGGBB                         the ground (default the stage navy 1d2b53;
//                                     also look at b9a98a, the lit battle floor)
//   zooms=2,4,8                       rows
//   refs=temenos,scholar,tophat,primrose,alfyn,haanit   which crops
//
// The numbers land in window.__study (ready, study, current) and under the
// canvas: height and width in cells, opaque cells, p50 L*, % below L 35,
// % above L 75, colour count, 8-connected components.

import { bakeSprite, drawBaked, makeSprite } from '../engine';
import { ACTOR_RECIPES, bakePose } from '../game/art/actors';
import type { PoseName } from '../game/art/actors';
import { EMBER_STUDY } from '../game/art/pixel/ember-study';
import type { PixelStudy, StudyPose } from '../game/art/pixel/ember-study';

const params = new URLSearchParams(location.search);
const POSES: readonly StudyPose[] = ['idle', 'attack', 'hurt', 'cast', 'dead'];
const poseParam = params.get('pose') ?? 'idle';
const pose: StudyPose = (POSES as readonly string[]).includes(poseParam) ? (poseParam as StudyPose) : 'idle';
const frame = Math.max(0, Math.min(2, Math.round(Number(params.get('frame') ?? 0)) || 0));
const mode = params.get('mode') === 'grey' ? 'grey' : 'color';
const bg = '#' + (params.get('bg') ?? '1d2b53').replace('#', '');
const zooms = (params.get('zooms') ?? '2,4,8')
  .split(',')
  .map((s) => Math.round(Number(s)))
  .filter((z) => z >= 1 && z <= 16);
/** id of a tools/intake.mjs-generated PixelStudy module to draw as a column after the study; absent = today's sheet, unchanged. */
const genId = params.get('gen');

interface RefSpec {
  key: string;
  file: string;
  /** Screen px per sprite px in the crop — what the crop is divided by so one sprite px = one cell. */
  pitch: number;
}
const REFS: readonly RefSpec[] = [
  { key: 'temenos', file: 'lineup-temenos.png', pitch: 2 },
  { key: 'scholar', file: 'lineup-scholar.png', pitch: 2 },
  { key: 'tophat', file: 'lineup-tophat.png', pitch: 2 },
  { key: 'primrose', file: 'battle-primrose.png', pitch: 1.5 },
  { key: 'alfyn', file: 'battle-alfyn.png', pitch: 1.5 },
  { key: 'haanit', file: 'battle-haanit.png', pitch: 1.5 },
];
const refKeys = (params.get('refs') ?? 'temenos,scholar,tophat,primrose,alfyn').split(',').map((s) => s.trim());
const refs = REFS.filter((r) => refKeys.includes(r.key));
/** The crops carry an 8-px gutter from the crop tool; the figure's feet sit near the inner bottom edge. */
const CROP_GUTTER = 8;

// --- Metrics -----------------------------------------------------------------------

export interface StudyMetrics {
  id: string;
  /** Silhouette bounding box, in cells. */
  w: number;
  h: number;
  /** Opaque cells. */
  cells: number;
  /** Median CIE L* over opaque cells. */
  p50: number;
  pctBelow35: number;
  pctAbove75: number;
  colours: number;
  /** 8-connected opaque components — one figure must be 1. */
  components: number;
}

function lin(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}
function lstar(r: number, g: number, b: number): number {
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16;
}

const scratch = document.createElement('canvas');
const scratchCtx = scratch.getContext('2d', { willReadFrequently: true });

function measure(id: string, bmp: HTMLCanvasElement): StudyMetrics {
  const ctx = scratchCtx;
  if (!ctx) throw new Error('no 2d context');
  scratch.width = bmp.width;
  scratch.height = bmp.height;
  ctx.clearRect(0, 0, bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const W = bmp.width;
  const H = bmp.height;
  const data = ctx.getImageData(0, 0, W, H).data;
  const opaque = new Uint8Array(W * H);
  const ls: number[] = [];
  const colours = new Set<number>();
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  let below = 0;
  let above = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      opaque[y * W + x] = 1;
      colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      const l = lstar(data[i], data[i + 1], data[i + 2]);
      ls.push(l);
      if (l < 35) below++;
      if (l > 75) above++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // 8-connected components over opaque cells.
  const seen = new Uint8Array(W * H);
  let components = 0;
  const stack: number[] = [];
  for (let s = 0; s < W * H; s++) {
    if (!opaque[s] || seen[s]) continue;
    components++;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const q = stack.pop() as number;
      const qx = q % W;
      const qy = (q - qx) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx;
          const ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const t = ny * W + nx;
          if (opaque[t] && !seen[t]) {
            seen[t] = 1;
            stack.push(t);
          }
        }
      }
    }
  }
  ls.sort((a, b) => a - b);
  const n = Math.max(1, ls.length);
  const pct = (k: number): number => Math.round((1000 * k) / n) / 10;
  return {
    id,
    w: x1 >= x0 ? x1 - x0 + 1 : 0,
    h: y1 >= y0 ? y1 - y0 + 1 : 0,
    cells: ls.length,
    p50: Math.round((ls[n >> 1] ?? 0) * 10) / 10,
    pctBelow35: pct(below),
    pctAbove75: pct(above),
    colours: colours.size,
    components,
  };
}

// --- Drawing -----------------------------------------------------------------------

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
const out = document.getElementById('metrics') as HTMLPreElement;
const PAD = 12;
const LABEL_H = 18;
const TOP_H = 20;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

interface Column {
  label: string;
  /** Drawn width/height at zoom z, in screen px. */
  size: (z: number) => { w: number; h: number };
  /** Draw with the column's left edge at x and the ground line at groundY. */
  draw: (ctx: CanvasRenderingContext2D, z: number, x: number, groundY: number) => void;
}

function toGrey(target: HTMLCanvasElement): void {
  const ctx = target.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, target.width, target.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Luminance-weighted grey, applied to the ground too so it is a value read of the whole sheet.
    const l = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    d[i] = l;
    d[i + 1] = l;
    d[i + 2] = l;
  }
  ctx.putImageData(img, 0, 0);
}

/** Duck-types a dynamically-imported module's export as a PixelStudy (its type is erased for a computed import specifier). */
function looksLikeStudy(v: unknown): v is PixelStudy {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return 'poses' in o && 'map' in o && 'feet' in o && 'hitSize' in o;
}

async function main(): Promise<void> {
  const recipe = ACTOR_RECIPES.EMBER;
  const kitBmp = bakePose(recipe, pose as PoseName, frame, 'FIRE');
  const rows = EMBER_STUDY.poses[pose][frame] ?? EMBER_STUDY.poses[pose][0];
  const width = rows[0]?.length ?? 0;
  for (const r of rows) {
    if (r.length !== width) throw new Error(`EMBER_STUDY ${pose}[${frame}]: row lengths differ (${r.length} vs ${width})`);
  }
  if (rows.length > 64 || width > 48) throw new Error(`EMBER_STUDY ${pose}[${frame}]: ${width}x${rows.length} exceeds 48x64`);
  const studySprite = makeSprite([...rows], EMBER_STUDY.map);
  const studyBmp = bakeSprite(studySprite, 1);

  const images = await Promise.all(refs.map((r) => loadImage(`/tools/ref/crops/${r.file}`)));

  const columns: Column[] = [];
  refs.forEach((r, i) => {
    const img = images[i];
    columns.push({
      label: `ref ${r.key} (÷${r.pitch})`,
      size: (z) => ({ w: Math.round((img.width * z) / r.pitch), h: Math.round((img.height * z) / r.pitch) }),
      draw: (ctx, z, x, groundY) => {
        const s = z / r.pitch;
        const w = Math.round(img.width * s);
        const h = Math.round(img.height * s);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, Math.round(groundY - (img.height - CROP_GUTTER) * s), w, h);
      },
    });
  });
  columns.push({
    label: `EMBER kit · ${pose} ${frame}`,
    size: (z) => ({ w: kitBmp.width * z, h: kitBmp.height * z }),
    draw: (ctx, z, x, groundY) => {
      drawBaked(ctx, kitBmp, x + Math.round(recipe.feet.x * z), groundY, { scale: z, originX: recipe.feet.x, originY: recipe.feet.y });
    },
  });
  columns.push({
    label: `EMBER study · ${pose} ${frame}`,
    size: (z) => ({ w: studyBmp.width * z, h: studyBmp.height * z }),
    draw: (ctx, z, x, groundY) => {
      drawBaked(ctx, studyBmp, x + Math.round(EMBER_STUDY.feet.x * z), groundY, { scale: z, originX: EMBER_STUDY.feet.x, originY: EMBER_STUDY.feet.y });
    },
  });

  // The `gen` column: a tools/intake.mjs output, loaded ONLY when ?gen=<id>
  // is given. Dynamic (computed-specifier) import so a missing module never
  // breaks the sheet — every other column still renders, gen is just absent.
  let genMetrics: StudyMetrics | null = null;
  if (genId) {
    try {
      const file = genId.toLowerCase().replace(/_/g, '-');
      const mod: unknown = await import(/* @vite-ignore */ `/game/art/pixel/${file}.ts`);
      const namespace = mod as Record<string, unknown>;
      const candidate = looksLikeStudy(namespace[genId]) ? namespace[genId] : Object.values(namespace).find(looksLikeStudy);
      if (!looksLikeStudy(candidate)) throw new Error(`no PixelStudy export found in game/art/pixel/${file}.ts`);
      const genStudy = candidate;
      const gRows = genStudy.poses[pose]?.[frame] ?? genStudy.poses[pose]?.[0] ?? genStudy.poses.idle[0];
      const gWidth = gRows[0]?.length ?? 0;
      for (const r of gRows) {
        if (r.length !== gWidth) throw new Error(`${genId} ${pose}[${frame}]: row lengths differ (${r.length} vs ${gWidth})`);
      }
      if (gRows.length > 64 || gWidth > 48) throw new Error(`${genId} ${pose}[${frame}]: ${gWidth}x${gRows.length} exceeds 48x64`);
      const genSprite = makeSprite([...gRows], genStudy.map);
      const genBmp = bakeSprite(genSprite, 1);
      columns.push({
        label: `${genId} gen · ${pose} ${frame}`,
        size: (z) => ({ w: genBmp.width * z, h: genBmp.height * z }),
        draw: (ctx, z, x, groundY) => {
          drawBaked(ctx, genBmp, x + Math.round(genStudy.feet.x * z), groundY, { scale: z, originX: genStudy.feet.x, originY: genStudy.feet.y });
        },
      });
      genMetrics = measure(genId, genBmp);
    } catch (err) {
      console.warn(`gen column skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Layout: one row per zoom; every column bottom-aligned on the row's ground line.
  const rowTops: number[] = [];
  const rowHeights: number[] = [];
  let W = 0;
  let H = 0;
  for (const z of zooms) {
    let rowH = 0;
    let rowW = PAD;
    for (const c of columns) {
      const s = c.size(z);
      if (s.h > rowH) rowH = s.h;
      rowW += s.w + PAD;
    }
    if (rowW > W) W = rowW;
    rowTops.push(H);
    rowHeights.push(rowH);
    H += TOP_H + rowH + LABEL_H + PAD;
  }
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const labels: { text: string; x: number; y: number; align: CanvasTextAlign }[] = [];
  zooms.forEach((z, r) => {
    const groundY = rowTops[r] + TOP_H + rowHeights[r];
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 0.5);
    ctx.lineTo(W, groundY + 0.5);
    ctx.stroke();
    labels.push({ text: `zoom ${z}  (${z} screen px per cell)`, x: PAD, y: rowTops[r] + 4, align: 'left' });
    let x = PAD;
    for (const c of columns) {
      const s = c.size(z);
      c.draw(ctx, z, x, groundY);
      labels.push({ text: c.label, x: x + s.w / 2, y: groundY + 4, align: 'center' });
      x += s.w + PAD;
    }
  });
  if (mode === 'grey') toGrey(canvas);
  ctx.font = '12px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = mode === 'grey' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.75)';
  for (const l of labels) {
    ctx.textAlign = l.align;
    ctx.fillText(l.text, l.x, l.y);
  }

  const study = measure('EMBER_STUDY', studyBmp);
  const current = measure('EMBER', kitBmp);
  const line = (m: StudyMetrics): string =>
    `${m.id.padEnd(12)} ${String(m.h).padStart(3)} ${String(m.w).padStart(3)} ${String(m.cells).padStart(6)} ${String(m.p50).padStart(6)} ${String(m.pctBelow35).padStart(6)} ${String(m.pctAbove75).padStart(6)} ${String(m.colours).padStart(8)} ${String(m.components).padStart(5)}`;
  out.textContent = [
    `pose=${pose} frame=${frame} mode=${mode} bg=${bg} zooms=${zooms.join(',')}`,
    'figure         h   w  cells  p50L*  <L35%  >L75%  colours  comps',
    line(study),
    line(current),
    ...(genMetrics ? [line(genMetrics)] : []),
  ].join('\n');
  (window as unknown as { __study: unknown }).__study = {
    ready: true,
    pose,
    frame,
    mode,
    bg,
    zooms,
    study,
    current,
    ...(genMetrics ? { gen: genMetrics } : {}),
  };
}

main().catch((err: unknown) => {
  out.textContent = `study failed: ${err instanceof Error ? err.message : String(err)}`;
  (window as unknown as { __study: unknown }).__study = { ready: true, error: String(err) };
});
