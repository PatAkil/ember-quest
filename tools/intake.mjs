// tools/intake.mjs — turn a generated reference image (a pixel-art-looking
// character portrait from an image model, e.g. GPT Image) into this repo's
// PixelStudy grid shape (see game/art/pixel/ember-study.ts), so it can sit in
// tools/study.html's `gen` column beside the reference crops, the kit's
// EMBER and the hand-drawn EMBER_STUDY, and be judged and measured by the
// same rulers.
//
// Playwright's chromium (already installed) decodes the PNG and does every
// pixel operation on a <canvas> — plain .mjs, no other dependency.
//
//   node tools/intake.mjs <in.png> [id=EMBER_GEN] [cell=<px>] [bg=auto|#rrggbb]
//                          [cols=40] [rows=64] [palette=study|<n>] [out=game/art/pixel/<id-lower>.ts]
//   node tools/intake.mjs help                     # print this and exit
//
//   in.png    the generated image: a pixel-art-looking figure at some larger
//             size (roughly 512-1024px tall) on a flat background.
//   id        PixelStudy.id and the exported const's name (default EMBER_GEN)
//   cell      the source's pixel pitch in px; omit to auto-estimate it as the
//             median run length of identical colours along rows and columns
//             inside the figure's bounding box (clamped to 1-64)
//   bg        'auto' (default) samples the image's four corners and keys out
//             every pixel within a small RGB distance of that colour (plus
//             any already-transparent pixel); or give the ground colour
//             explicitly as #rrggbb to skip corner sampling
//   cols/rows the resample cap (default 40x64), clamped to the engine's
//             PixelStudy limit (<=48 cols, <=64 rows: see ember-study.ts).
//             The figure is scaled by a single uniform factor — scale =
//             min(cols/(bboxW/cell), rows/(bboxH/cell)) — so it fits inside
//             this box, then the emitted grid is CROPPED TIGHT to the
//             resampled figure's own opaque bounding box: the result is "at
//             most" cols x rows, not necessarily exactly that size (the
//             actual size is reported either way)
//   palette   'study' (default): every cell maps to the nearest of the 24
//             EMBER_STUDY colours in CIE L*a*b*, so the result is directly
//             comparable to the hand-drawn study on the same 24-colour
//             budget. A number n: build an n-colour palette by median cut
//             over the figure's own resampled cells and map to that instead.
//   out       where to write the PixelStudy module. Default is derived from
//             id the same way ember-study.ts's own name is derived from
//             EMBER_STUDY: lower-case, underscores to hyphens
//             (EMBER_GEN -> game/art/pixel/ember-gen.ts).
//
// Also writes tools/out/intake-<id>-x8.png (the result at 8x beside the
// source scaled to the same figure height, on the study sheet's light ground
// #b9a98a) and prints a JSON summary to stdout: bbox, pitch, grid size,
// colours, mean quantization error (deltaE), 8-connected components, and the
// opaque cells' median L*, % below L 35 and % above L 75 (the same
// definitions tools/study.ts uses for EMBER_STUDY and the kit's EMBER).
//
// Background-key threshold: 8 (Euclidean RGB distance). Chosen small enough
// that it never touches the closest EMBER_STUDY colour to the study sheet's
// light ground (#b9a98a vs skin-tone K #c3a28c is only 12.4 apart) while
// still catching genuinely near-ground pixels (anti-aliased edges, soft
// generated art) — see tools/intake.mjs's own round-trip note in the report.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const USAGE = `Usage:
  node tools/intake.mjs <in.png> [id=EMBER_GEN] [cell=<px>] [bg=auto|#rrggbb]
                         [cols=40] [rows=64] [palette=study|<n>] [out=game/art/pixel/<id-lower>.ts]
  node tools/intake.mjs help

See the header comment in tools/intake.mjs for what each option does.`;

const BG_DIST = 8; // Euclidean RGB distance: "a small distance" from the background colour (see header note)
const OUT_DIR = 'tools/out';
const GROUND_HEX = '#b9a98a'; // the study sheet's light ground

// --- bitmap mode (option C, .claude/prompts/bitmap-pipeline.md) ------------
// A second, independent pipeline living beside the grid one above: same CLI
// entry point, own dispatch (`argv[0] === 'bitmap'`), own self-contained
// page.evaluate function (see runBitmapPipeline below) so nothing here can
// perturb the grid mode's behaviour.
const BITMAP_DIR = 'game/art/bitmap';
const BITMAP_MANIFEST_PATH = `${BITMAP_DIR}/manifest.json`;
const BITMAP_REGISTRY_PATH = `${BITMAP_DIR}/registry.ts`; // DATA only; the runtime is the hand-written index.ts
const CLASS_HEIGHT = { hero: 112, small: 72, medium: 96, large: 112, elite: 128, boss: 192 };
const POSE_NAMES = ['idle', 'attack', 'hurt', 'cast', 'dead'];
// Half-width of the hue window a pixel must fall inside (of the sampled
// background hue) to be keyed as background; the model's green wobbles
// roughly ±20 RGB, a jitter of about the same order in hue degrees.
const HUE_WINDOW_DEG = 20;
// A pixel also has to be reasonably saturated to count as the green screen —
// a desaturated shadow tone on the character must not fall inside the window
// and be keyed out just because its hue happens to drift toward green.
const SAT_MIN = 0.5;

function idToFile(id) {
  return id.toLowerCase().replace(/_/g, '-');
}

function fail(msg, usage = USAGE) {
  console.error(`intake: ${msg}`);
  console.error(usage);
  process.exitCode = 1;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === 'bitmap') {
    await mainBitmap(argv.slice(1));
    return;
  }
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    console.log(USAGE);
    process.exitCode = argv.length === 0 ? 1 : 0;
    return;
  }

  const inArg = argv[0];
  const opts = {};
  for (const a of argv.slice(1)) {
    const eq = a.indexOf('=');
    if (eq > 0) opts[a.slice(0, eq)] = a.slice(eq + 1);
  }

  const inPath = resolve(process.cwd(), inArg);
  if (!existsSync(inPath)) return fail(`no such file: ${inPath}`);

  const id = (opts.id || 'EMBER_GEN').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) return fail(`id must be a valid identifier, got ${JSON.stringify(opts.id)}`);

  const cellOverride = opts.cell !== undefined ? Number(opts.cell) : undefined;
  if (cellOverride !== undefined && (!Number.isFinite(cellOverride) || cellOverride <= 0)) {
    return fail(`cell must be a positive number, got ${JSON.stringify(opts.cell)}`);
  }

  const bgParam = (opts.bg || 'auto').trim();
  if (bgParam !== 'auto' && !/^#?[0-9a-fA-F]{6}$/.test(bgParam)) {
    return fail(`bg must be 'auto' or #rrggbb, got ${JSON.stringify(opts.bg)}`);
  }
  const bgHex = bgParam === 'auto' ? null : `#${bgParam.replace('#', '')}`.toLowerCase();

  const reqCols = opts.cols !== undefined ? Math.round(Number(opts.cols)) : 40;
  const reqRows = opts.rows !== undefined ? Math.round(Number(opts.rows)) : 64;
  if (!Number.isFinite(reqCols) || !Number.isFinite(reqRows) || reqCols < 1 || reqRows < 1) {
    return fail(`cols/rows must be positive numbers, got cols=${JSON.stringify(opts.cols)} rows=${JSON.stringify(opts.rows)}`);
  }
  // PixelStudy's hard limit (ember-study.ts, enforced at runtime by tools/study.ts): <=64 rows, <=48 cols.
  const cols = Math.min(48, reqCols);
  const rows = Math.min(64, reqRows);
  if (cols !== reqCols || rows !== reqRows) {
    console.log(`intake: clamped cols/rows to the PixelStudy limit (<=48x64) -> ${cols}x${rows}`);
  }

  const paletteParam = (opts.palette || 'study').trim();
  let paletteN = null;
  const KEY_POOL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  if (paletteParam !== 'study') {
    paletteN = Math.round(Number(paletteParam));
    if (!Number.isFinite(paletteN) || paletteN < 1 || paletteN > KEY_POOL.length) {
      return fail(`palette must be 'study' or a number 1-${KEY_POOL.length}, got ${JSON.stringify(opts.palette)}`);
    }
  }

  const outPath = opts.out || `game/art/pixel/${idToFile(id)}.ts`;
  const outAbs = resolve(process.cwd(), outPath);
  const emberStudyAbs = resolve(process.cwd(), 'game/art/pixel/ember-study.ts');

  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`[1/7] loading ${inArg}`);
  const pngBuf = readFileSync(inPath);
  const dataUri = `data:image/png;base64,${pngBuf.toString('base64')}`;

  const studyPalette = paletteParam === 'study' ? readStudyPalette(emberStudyAbs) : null;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let result;
  try {
    result = await page.evaluate(runPipeline, {
      dataUri,
      cellOverride: cellOverride ?? null,
      bgHex,
      cols,
      rows,
      paletteMode: paletteParam === 'study' ? 'study' : 'n',
      paletteN,
      keyPool: KEY_POOL,
      studyPalette,
      groundHex: GROUND_HEX,
      bgDist: BG_DIST,
    });
  } finally {
    await browser.close();
  }

  if (!result.ok) {
    return fail(result.error);
  }
  for (const line of result.log) console.log(line);

  const previewPath = `${OUT_DIR}/intake-${id}-x8.png`;
  writeFileSync(previewPath, Buffer.from(result.previewPngBase64, 'base64'));
  console.log(`[7/7] wrote ${previewPath}`);

  let importSpec = relative(dirname(outAbs), emberStudyAbs).replace(/\.ts$/, '').replace(/\\/g, '/');
  if (!importSpec.startsWith('.')) importSpec = `./${importSpec}`;

  const moduleSrc = buildModule({
    id,
    importSpec,
    sourceFile: inArg,
    mapEntries: result.paletteEntries,
    rowsGrid: result.rows,
    feet: result.feet,
    hit: result.hit,
    hitSize: result.hitSize,
    report: result.report,
  });
  mkdirSync(dirname(outAbs), { recursive: true });
  writeFileSync(outAbs, moduleSrc);
  console.log(`[7/7] wrote ${outPath}`);

  const summary = {
    id,
    source: inArg,
    out: outPath,
    preview: previewPath,
    bbox: result.report.bbox,
    pitch: result.report.pitch,
    grid: result.report.grid,
    colours: result.report.colours,
    meanDeltaE: result.report.meanDeltaE,
    cleaned: result.report.cleaned,
    components: result.report.components,
    p50L: result.report.p50,
    pctBelow35: result.report.pctBelow35,
    pctAbove75: result.report.pctAbove75,
    feet: result.feet,
    hit: result.hit,
    hitSize: result.hitSize,
  };
  console.log(JSON.stringify(summary, null, 2));
}

// --- read the 24-colour study palette straight from source text (no import: this is a plain .mjs) ---
function readStudyPalette(emberStudyAbs) {
  const src = readFileSync(emberStudyAbs, 'utf8');
  const start = src.indexOf('const MAP');
  if (start < 0) throw new Error('readStudyPalette: `const MAP` not found in ember-study.ts');
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error('readStudyPalette: unbalanced braces reading MAP');
  const block = src.slice(braceStart + 1, end);
  const entries = [];
  const re = /^\s*([A-Za-z]):\s*'(#[0-9a-fA-F]{6})'/gm;
  let m;
  while ((m = re.exec(block))) entries.push({ key: m[1], hex: m[2].toLowerCase() });
  if (entries.length === 0) throw new Error('readStudyPalette: no colour entries parsed from MAP');
  return entries;
}

function buildModule({ id, importSpec, sourceFile, mapEntries, rowsGrid, feet, hit, hitSize, report }) {
  const mapLines = mapEntries.map(({ key, hex }) => `  ${key}: '${hex}',`).join('\n');
  const rowLines = rowsGrid.map((r) => `  '${r}',`).join('\n');
  const w = rowsGrid[0] ? rowsGrid[0].length : 0;
  const h = rowsGrid.length;
  return `// game/art/pixel/${id.toLowerCase().replace(/_/g, '-')}.ts — generated by tools/intake.mjs from
// ${sourceFile}
// pitch ${report.pitch}px source -> ${w}x${h} cells, ${report.colours} colours
// (mean quantization ΔE ${report.meanDeltaE}), ${report.components} 8-connected
// component(s), ${report.cleaned} isolated cell(s) removed. Judge on
// tools/study.html?gen=${id} beside the reference crops, the kit's EMBER and
// EMBER_STUDY, and re-run tools/intake.mjs to regenerate.
//
// TODO(intake): attack/hurt/cast/dead and the two other idle frames are
// copies of this master frame until a real pose set is generated and judged.

import type { PixelStudy } from '${importSpec}';

const MAP: Readonly<Record<string, string>> = {
${mapLines}
};

// master frame, ${w} columns x ${h} rows.
const MASTER: readonly string[] = [
${rowLines}
];

const TODO_COPY: ReadonlyArray<ReadonlyArray<string>> = [MASTER, MASTER, MASTER];

export const ${id}: PixelStudy = {
  id: '${id}',
  map: MAP,
  poses: {
    idle: [MASTER, MASTER, MASTER],
    attack: TODO_COPY,
    hurt: TODO_COPY,
    cast: TODO_COPY,
    dead: TODO_COPY,
  },
  feet: { x: ${feet.x}, y: ${feet.y} },
  hit: { x: ${hit.x}, y: ${hit.y} },
  hitSize: { w: ${hitSize.w}, h: ${hitSize.h} },
};
`;
}

// --- everything below runs INSIDE the browser page via page.evaluate -------
// (kept as one self-contained async function: Playwright serializes it by
// source text, so it cannot close over anything from the module above).
async function runPipeline(args) {
  const { dataUri, cellOverride, bgHex, cols, rows, paletteMode, paletteN, keyPool, studyPalette, groundHex, bgDist } = args;
  const log = [];
  try {
    // ---- colour helpers (CIE L*a*b*; L* branch matches tools/study.ts's lstar() exactly) ----
    function lin(c) {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }
    function rgbToLab(r, g, b) {
      const rl = lin(r);
      const gl = lin(g);
      const bl = lin(b);
      const X = rl * 0.4124 + gl * 0.3576 + bl * 0.1805;
      const Y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
      const Z = rl * 0.0193 + gl * 0.1192 + bl * 0.9505;
      const Xn = 0.95047;
      const Yn = 1;
      const Zn = 1.08883;
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const fx = f(X / Xn);
      const fy = f(Y / Yn);
      const fz = f(Z / Zn);
      const L = Y > 0.008856 ? 116 * fy - 16 : 903.3 * Y;
      return [L, 500 * (fx - fy), 200 * (fy - fz)];
    }
    function deltaE(a, b) {
      return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
    }
    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function rgbToHex(r, g, b) {
      return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
    }

    // ---- 1. decode ----
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('failed to decode the input as a PNG'));
      im.src = dataUri;
    });
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (W < 1 || H < 1) throw new Error('decoded image has zero size');
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W;
    srcCanvas.height = H;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0);
    const srcData = sctx.getImageData(0, 0, W, H);
    const px = srcData.data;
    log.push(`[1/7] loaded ${W}x${H} px`);

    // ---- 2. background key ----
    const corners = [
      [0, 0],
      [W - 1, 0],
      [0, H - 1],
      [W - 1, H - 1],
    ].map(([x, y]) => {
      const i = (y * W + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    });
    let keyRgb;
    if (bgHex) {
      keyRgb = hexToRgb(bgHex);
    } else {
      const counts = new Map();
      for (const c of corners) {
        const k = c.join(',');
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      let bestKey = corners[0].join(',');
      let bestN = 0;
      for (const [k, n] of counts) {
        if (n > bestN) {
          bestN = n;
          bestKey = k;
        }
      }
      keyRgb = bestKey.split(',').map(Number);
    }
    const opaque = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (px[i + 3] === 0) continue;
        const dr = px[i] - keyRgb[0];
        const dg = px[i + 1] - keyRgb[1];
        const db = px[i + 2] - keyRgb[2];
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= bgDist) continue;
        opaque[y * W + x] = 1;
      }
    }
    let x0 = W;
    let x1 = -1;
    let y0 = H;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!opaque[y * W + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < x0) throw new Error('no non-background pixels found (check bg= / the input image)');
    const bboxW = x1 - x0 + 1;
    const bboxH = y1 - y0 + 1;
    log.push(`[2/7] background key ${rgbToHex(...keyRgb)} (<=${bgDist}) -> bbox x=${x0} y=${y0} w=${bboxW} h=${bboxH}`);

    // ---- 3. pixel pitch ----
    function keyAt(x, y) {
      const i = (y * W + x) * 4;
      return opaque[y * W + x] ? (px[i] << 16) | (px[i + 1] << 8) | px[i + 2] : -1;
    }
    let cell;
    if (cellOverride) {
      cell = cellOverride;
      log.push(`[3/7] pixel pitch: cell=${cell} (given)`);
    } else {
      const runs = [];
      for (let y = y0; y <= y1; y++) {
        let runLen = 1;
        let runKey = keyAt(x0, y);
        for (let x = x0 + 1; x <= x1; x++) {
          const k = keyAt(x, y);
          if (k === runKey) runLen++;
          else {
            runs.push(runLen);
            runKey = k;
            runLen = 1;
          }
        }
        runs.push(runLen);
      }
      for (let x = x0; x <= x1; x++) {
        let runLen = 1;
        let runKey = keyAt(x, y0);
        for (let y = y0 + 1; y <= y1; y++) {
          const k = keyAt(x, y);
          if (k === runKey) runLen++;
          else {
            runs.push(runLen);
            runKey = k;
            runLen = 1;
          }
        }
        runs.push(runLen);
      }
      runs.sort((a, b) => a - b);
      const med = runs.length ? runs[Math.floor(runs.length / 2)] : 1;
      cell = Math.max(1, Math.min(64, med));
      log.push(`[3/7] pixel pitch: cell=${cell} (auto median of ${runs.length} runs)`);
    }

    // ---- 4. resample (mode colour per target cell) ----
    const bwCells = bboxW / cell;
    const bhCells = bboxH / cell;
    const scale = Math.min(cols / bwCells, rows / bhCells);
    const gw = Math.max(1, Math.min(cols, Math.round(bwCells * scale)));
    const gh = Math.max(1, Math.min(rows, Math.round(bhCells * scale)));
    const cellColor = new Array(gw * gh).fill(null);
    for (let ty = 0; ty < gh; ty++) {
      const sy0 = y0 + (ty * bboxH) / gh;
      const sy1 = y0 + ((ty + 1) * bboxH) / gh;
      const iy0 = Math.max(y0, Math.floor(sy0));
      const iy1 = Math.min(y1, Math.max(iy0, Math.ceil(sy1) - 1));
      for (let tx = 0; tx < gw; tx++) {
        const sx0 = x0 + (tx * bboxW) / gw;
        const sx1 = x0 + ((tx + 1) * bboxW) / gw;
        const ix0 = Math.max(x0, Math.floor(sx0));
        const ix1 = Math.min(x1, Math.max(ix0, Math.ceil(sx1) - 1));
        let total = 0;
        let transparentN = 0;
        const counts = new Map();
        for (let sy = iy0; sy <= iy1; sy++) {
          for (let sx = ix0; sx <= ix1; sx++) {
            total++;
            if (!opaque[sy * W + sx]) {
              transparentN++;
              continue;
            }
            const i = (sy * W + sx) * 4;
            const k = `${px[i]},${px[i + 1]},${px[i + 2]}`;
            counts.set(k, (counts.get(k) || 0) + 1);
          }
        }
        if (total === 0 || transparentN / total > 0.5) continue;
        let bestKey = null;
        let bestN = -1;
        for (const [k, n] of counts) {
          if (n > bestN) {
            bestN = n;
            bestKey = k;
          }
        }
        cellColor[ty * gw + tx] = bestKey.split(',').map(Number);
      }
    }
    log.push(`[4/7] resampled to ${gw}x${gh} cells (scale=${scale.toFixed(3)})`);

    // ---- 5. quantize ----
    const paletteEntries = [];
    if (paletteMode === 'study') {
      for (const { key, hex } of studyPalette) {
        const rgb = hexToRgb(hex);
        paletteEntries.push({ key, hex, rgb, lab: rgbToLab(...rgb) });
      }
    } else {
      const points = [];
      for (let i = 0; i < gw * gh; i++) if (cellColor[i]) points.push(cellColor[i]);
      if (points.length === 0) throw new Error('no opaque cells to build a palette from');
      let buckets = [points];
      while (buckets.length < paletteN) {
        let bi = -1;
        let bestPop = -1;
        for (let i = 0; i < buckets.length; i++) {
          const uniq = new Set(buckets[i].map((p) => p.join(','))).size;
          if (uniq <= 1) continue;
          if (buckets[i].length > bestPop) {
            bestPop = buckets[i].length;
            bi = i;
          }
        }
        if (bi < 0) break;
        const bucket = buckets[bi];
        const ranges = [0, 1, 2].map((c) => {
          let mn = 255;
          let mx = 0;
          for (const p of bucket) {
            if (p[c] < mn) mn = p[c];
            if (p[c] > mx) mx = p[c];
          }
          return mx - mn;
        });
        const axis = ranges[0] >= ranges[1] && ranges[0] >= ranges[2] ? 0 : ranges[1] >= ranges[2] ? 1 : 2;
        const sorted = [...bucket].sort((a, b) => a[axis] - b[axis]);
        const mid = Math.floor(sorted.length / 2);
        buckets.splice(bi, 1, sorted.slice(0, mid), sorted.slice(mid));
      }
      buckets
        .filter((b) => b.length > 0)
        .forEach((b, idx) => {
          const avg = [0, 0, 0];
          for (const p of b) {
            avg[0] += p[0];
            avg[1] += p[1];
            avg[2] += p[2];
          }
          const rgb = avg.map((v) => Math.round(v / b.length));
          const hex = rgbToHex(...rgb);
          paletteEntries.push({ key: keyPool[idx], hex, rgb, lab: rgbToLab(...rgb) });
        });
    }

    const finalKey = new Array(gw * gh).fill(null);
    let deltaSum = 0;
    let deltaCount = 0;
    for (let i = 0; i < gw * gh; i++) {
      const c = cellColor[i];
      if (!c) continue;
      const lab = rgbToLab(c[0], c[1], c[2]);
      let best = null;
      let bestD = Infinity;
      for (const p of paletteEntries) {
        const d = deltaE(lab, p.lab);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      finalKey[i] = best.key;
      deltaSum += bestD;
      deltaCount++;
    }
    const meanDeltaE = deltaCount ? deltaSum / deltaCount : 0;
    const preCleanColours = new Set(finalKey.filter(Boolean)).size;
    log.push(`[5/7] quantized to ${preCleanColours} colours (of ${paletteEntries.length} in the palette), mean deltaE=${meanDeltaE.toFixed(2)}`);

    // ---- 6. clean + components ----
    function idx(x, y) {
      return y * gw + x;
    }
    let cleaned = 0;
    const toRemove = [];
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (!finalKey[idx(x, y)]) continue;
        let has4 = false;
        if (x > 0 && finalKey[idx(x - 1, y)]) has4 = true;
        if (!has4 && x < gw - 1 && finalKey[idx(x + 1, y)]) has4 = true;
        if (!has4 && y > 0 && finalKey[idx(x, y - 1)]) has4 = true;
        if (!has4 && y < gh - 1 && finalKey[idx(x, y + 1)]) has4 = true;
        if (!has4) toRemove.push(idx(x, y));
      }
    }
    for (const i of toRemove) {
      finalKey[i] = null;
      cleaned++;
    }
    let components = 0;
    {
      const seen = new Uint8Array(gw * gh);
      const stack = [];
      for (let s = 0; s < gw * gh; s++) {
        if (!finalKey[s] || seen[s]) continue;
        components++;
        seen[s] = 1;
        stack.push(s);
        while (stack.length) {
          const q = stack.pop();
          const qx = q % gw;
          const qy = (q - qx) / gw;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = qx + dx;
              const ny = qy + dy;
              if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
              const t = ny * gw + nx;
              if (finalKey[t] && !seen[t]) {
                seen[t] = 1;
                stack.push(t);
              }
            }
          }
        }
      }
    }
    const usedKeys = new Set(finalKey.filter(Boolean));
    log.push(`[6/7] cleaned ${cleaned} isolated cell(s); ${components} 8-connected component(s) (1 expected)`);

    // ---- L* stats over the final opaque cells (same definitions as tools/study.ts) ----
    const keyToLab = new Map(paletteEntries.map((p) => [p.key, p.lab]));
    const ls = [];
    for (let i = 0; i < gw * gh; i++) {
      const k = finalKey[i];
      if (!k) continue;
      ls.push(keyToLab.get(k)[0]);
    }
    ls.sort((a, b) => a - b);
    const nOp = Math.max(1, ls.length);
    const pct = (k) => Math.round((1000 * k) / nOp) / 10;
    const p50 = Math.round((ls[nOp >> 1] ?? 0) * 10) / 10;
    const pctBelow35 = pct(ls.filter((l) => l < 35).length);
    const pctAbove75 = pct(ls.filter((l) => l > 75).length);

    // ---- tight bbox of the final grid; feet / hit / hitSize ----
    let fx0 = gw;
    let fx1 = -1;
    let fy0 = gh;
    let fy1 = -1;
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (!finalKey[idx(x, y)]) continue;
        if (x < fx0) fx0 = x;
        if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y;
        if (y > fy1) fy1 = y;
      }
    }
    if (fx1 < fx0) throw new Error('grid is empty after cleanup');
    const feet = { x: Math.floor((fx0 + fx1) / 2), y: fy1 + 1 };
    const figH = fy1 - fy0 + 1;
    const bandY0 = fy0 + Math.round(0.33 * figH);
    const bandY1 = fy0 + Math.round(0.72 * figH);
    let hx0 = fx1 + 1;
    let hx1 = fx0 - 1;
    let hy0 = Math.min(fy1, bandY1) + 1;
    let hy1 = Math.max(fy0, bandY0) - 1;
    for (let y = Math.max(fy0, bandY0); y <= Math.min(fy1, bandY1); y++) {
      for (let x = fx0; x <= fx1; x++) {
        if (!finalKey[idx(x, y)]) continue;
        if (x < hx0) hx0 = x;
        if (x > hx1) hx1 = x;
        if (y < hy0) hy0 = y;
        if (y > hy1) hy1 = y;
      }
    }
    let hit;
    let hitSize;
    if (hx1 >= hx0 && hy1 >= hy0) {
      hit = { x: Math.floor((hx0 + hx1) / 2), y: Math.floor((hy0 + hy1) / 2) };
      hitSize = { w: hx1 - hx0 + 1, h: hy1 - hy0 + 1 };
    } else {
      hit = { x: Math.floor((fx0 + fx1) / 2), y: Math.floor((fy0 + fy1) / 2) };
      hitSize = { w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 };
    }

    // ---- crop tight, emit rows ----
    const outW = fx1 - fx0 + 1;
    const outH = fy1 - fy0 + 1;
    const finalRows = [];
    for (let y = fy0; y <= fy1; y++) {
      let row = '';
      for (let x = fx0; x <= fx1; x++) {
        const k = finalKey[idx(x, y)];
        row += k || '.';
      }
      finalRows.push(row);
    }
    const feetOut = { x: feet.x - fx0, y: feet.y - fy0 };
    const hitOut = { x: hit.x - fx0, y: hit.y - fy0 };

    // ---- preview PNG: result at 8x beside the source at the same figure height ----
    const CELL_PX = 8;
    const resDrawW = outW * CELL_PX;
    const resDrawH = outH * CELL_PX;
    const srcScale = resDrawH / bboxH;
    const srcDrawW = Math.max(1, Math.round(W * srcScale));
    const srcDrawH = Math.max(1, Math.round(H * srcScale));
    const PAD = 16;
    const LABEL_H = 18;
    const rowH = Math.max(srcDrawH, resDrawH);
    const canvasW = PAD * 3 + srcDrawW + resDrawW;
    const canvasH = PAD * 2 + rowH + LABEL_H;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = canvasW;
    outCanvas.height = canvasH;
    const octx = outCanvas.getContext('2d');
    octx.fillStyle = groundHex;
    octx.fillRect(0, 0, canvasW, canvasH);
    const groundY = PAD + rowH;
    octx.imageSmoothingEnabled = true;
    const srcBboxCenterX = (x0 + bboxW / 2) * srcScale;
    const srcColCenterX = PAD + srcDrawW / 2;
    octx.drawImage(img, Math.round(srcColCenterX - srcBboxCenterX), Math.round(groundY - (y1 + 1) * srcScale), srcDrawW, srcDrawH);
    octx.imageSmoothingEnabled = false;
    const resX = PAD * 2 + srcDrawW;
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const k = finalRows[y][x];
        if (k === '.') continue;
        octx.fillStyle = keyToHex(k);
        octx.fillRect(resX + x * CELL_PX, groundY - resDrawH + y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
    function keyToHex(k) {
      for (const p of paletteEntries) if (p.key === k) return p.hex;
      return '#ff00ff';
    }
    octx.strokeStyle = 'rgba(0,0,0,0.25)';
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(0, groundY + 0.5);
    octx.lineTo(canvasW, groundY + 0.5);
    octx.stroke();
    octx.fillStyle = 'rgba(0,0,0,0.7)';
    octx.font = '12px ui-monospace, Menlo, monospace';
    octx.textBaseline = 'top';
    octx.textAlign = 'center';
    octx.fillText('source (scaled to figure height)', PAD + srcDrawW / 2, groundY + 4);
    octx.fillText('intake result (8x)', resX + resDrawW / 2, groundY + 4);
    const previewPngBase64 = outCanvas.toDataURL('image/png').split(',')[1];

    const report = {
      bbox: { x: x0, y: y0, w: bboxW, h: bboxH },
      pitch: cell,
      grid: { cols: outW, rows: outH, cap: { cols, rows } },
      colours: usedKeys.size,
      meanDeltaE: Math.round(meanDeltaE * 100) / 100,
      cleaned,
      components,
      p50,
      pctBelow35,
      pctAbove75,
    };

    return {
      ok: true,
      log,
      rows: finalRows,
      paletteEntries: paletteEntries.map((p) => ({ key: p.key, hex: p.hex })),
      feet: feetOut,
      hit: hitOut,
      hitSize,
      report,
      previewPngBase64,
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e), log };
  }
}

const BITMAP_USAGE = `Usage:
  node tools/intake.mjs bitmap <in.png> id=<ID> pose=idle|attack|hurt|cast|dead frame=<n>
                         [class=hero|small|medium|large|elite|boss] [key=auto|#rrggbb] [alpha=0.45]
  node tools/intake.mjs bitmap help

  in.png    one PNG per (actor, pose, frame): the figure on a flat solid
            green (#00FF00-ish) background, facing RIGHT, feet at the bottom
            centre (see .claude/prompts/bitmap-pipeline.md's asset spec).
  id        BITMAP_ACTORS key — must match the id ACTOR_RECIPES / enemies.ts
            use (e.g. EMBER). Required.
  pose      idle | attack | hurt | cast | dead. Required.
  frame     frame index within the pose, 0-based. Required.
  class     sets the on-screen height: hero/large 112, elite 128, boss 192,
            medium 96, small 72. Default hero.
  key       'auto' (default) samples the dominant corner colour and keys
            every pixel within a ${HUE_WINDOW_DEG}° hue window of it with
            saturation > ${SAT_MIN}; or give the background colour explicitly
            as #rrggbb to skip corner sampling (still hue+saturation keyed).
  alpha     the alpha-snap threshold (0-1, default 0.45): a downscaled pixel
            at or above this coverage becomes fully opaque, below it fully
            transparent — no anti-aliased edges survive into the game.

Crops to the opaque bbox, area-downscales in two steps (to 1/4, then to the
class height, imageSmoothingQuality 'high') to keep the shrink clean, writes
game/art/bitmap/<id lower>/<pose>-<frame>.png, and regenerates
game/art/bitmap/registry.ts (the DATA — the runtime is the hand-written
index.ts) from game/art/bitmap/manifest.json (which this also updates) — so
re-running the same intake is deterministic. Prints one JSON
line: size, feet (bottom centre of the opaque mass), hit/hitSize (the torso
box) and the value stats the sheet uses (median L*, % below L 35, % above
L 75 of opaque pixels).`;

function readBitmapManifest() {
  if (!existsSync(BITMAP_MANIFEST_PATH)) return {};
  return JSON.parse(readFileSync(BITMAP_MANIFEST_PATH, 'utf8'));
}
function writeBitmapManifest(manifest) {
  mkdirSync(BITMAP_DIR, { recursive: true });
  writeFileSync(BITMAP_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * The registry is a pure function of the manifest — always rebuilt in full
 * (never hand-patched), sorted by id, so two intakes of the same inputs in
 * either order produce byte-identical output. A gap in a pose's frame array
 * (an odd frame intake'd before an earlier one) is filled from the nearest
 * earlier real frame, or the first real one, so every index still resolves.
 */
function buildBitmapRegistry(manifest) {
  const POSE_ORDER = ['idle', 'attack', 'cast', 'hurt', 'dead'];
  const ids = Object.keys(manifest).sort();
  const constLines = [];
  const entryBlocks = [];
  for (const id of ids) {
    const rec = manifest[id];
    const idLower = id.toLowerCase();
    const poseParts = [];
    for (const pose of POSE_ORDER) {
      const files = rec.poses && rec.poses[pose];
      if (!files || files.length === 0) continue;
      const firstReal = files.find((f) => f) || null;
      if (!firstReal) continue;
      let last = firstReal;
      const names = files.map((f, i) => {
        if (f) last = f;
        const use = f || last;
        const constName = `${id}_${pose.toUpperCase()}_${i}`;
        constLines.push(`const ${constName} = new URL('./${idLower}/${use}', import.meta.url).href;`);
        return constName;
      });
      poseParts.push(`${pose}: [${names.join(', ')}]`);
    }
    entryBlocks.push(
      `  ${id}: {\n` +
        `    id: '${id}',\n` +
        `    height: ${rec.height},\n` +
        `    feet: { x: ${rec.feet.x}, y: ${rec.feet.y} },\n` +
        `    hit: { x: ${rec.hit.x}, y: ${rec.hit.y} },\n` +
        `    hitSize: { w: ${rec.hitSize.w}, h: ${rec.hitSize.h} },\n` +
        `    poses: { ${poseParts.join(', ')} },\n` +
        `  },`,
    );
  }
  return `// game/art/bitmap/registry.ts — GENERATED by \`node tools/intake.mjs bitmap\`
// from game/art/bitmap/manifest.json. Do not hand-edit: the next intake
// overwrites this file. This is the DATA; the runtime (the types, the pose
// fallbacks, the decoder, \`bitmapFor\`) is the hand-written ./index.ts.

import type { BitmapActor } from './index';

${constLines.join('\n')}

export const BITMAP_ACTORS: Record<string, BitmapActor> = {
${entryBlocks.join('\n')}
};
`;
}

async function mainBitmap(argv) {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    console.log(BITMAP_USAGE);
    process.exitCode = argv.length === 0 ? 1 : 0;
    return;
  }

  const inArg = argv[0];
  const opts = {};
  for (const a of argv.slice(1)) {
    const eq = a.indexOf('=');
    if (eq > 0) opts[a.slice(0, eq)] = a.slice(eq + 1);
  }

  const inPath = resolve(process.cwd(), inArg);
  if (!existsSync(inPath)) return fail(`no such file: ${inPath}`, BITMAP_USAGE);

  const id = (opts.id || '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) return fail(`id must be a valid identifier, got ${JSON.stringify(opts.id)}`, BITMAP_USAGE);

  const pose = (opts.pose || '').trim();
  if (!POSE_NAMES.includes(pose)) return fail(`pose must be one of ${POSE_NAMES.join('|')}, got ${JSON.stringify(opts.pose)}`, BITMAP_USAGE);

  const frame = opts.frame !== undefined ? Math.round(Number(opts.frame)) : NaN;
  if (!Number.isFinite(frame) || frame < 0) return fail(`frame must be a non-negative integer, got ${JSON.stringify(opts.frame)}`, BITMAP_USAGE);

  const klass = (opts.class || 'hero').trim();
  if (!(klass in CLASS_HEIGHT)) return fail(`class must be one of ${Object.keys(CLASS_HEIGHT).join('|')}, got ${JSON.stringify(opts.class)}`, BITMAP_USAGE);
  const targetHeight = CLASS_HEIGHT[klass];

  const keyParam = (opts.key || 'auto').trim();
  if (keyParam !== 'auto' && !/^#?[0-9a-fA-F]{6}$/.test(keyParam)) return fail(`key must be 'auto' or #rrggbb, got ${JSON.stringify(opts.key)}`, BITMAP_USAGE);
  const keyHex = keyParam === 'auto' ? null : `#${keyParam.replace('#', '')}`.toLowerCase();

  const alpha = opts.alpha !== undefined ? Number(opts.alpha) : 0.45;
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha >= 1) return fail(`alpha must be a number in (0,1), got ${JSON.stringify(opts.alpha)}`, BITMAP_USAGE);

  const idLower = id.toLowerCase();
  const outDir = `${BITMAP_DIR}/${idLower}`;
  const outFile = `${pose}-${frame}.png`;
  const outPath = `${outDir}/${outFile}`;

  console.log(`[1/6] loading ${inArg}`);
  const pngBuf = readFileSync(inPath);
  const dataUri = `data:image/png;base64,${pngBuf.toString('base64')}`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let result;
  try {
    result = await page.evaluate(runBitmapPipeline, {
      dataUri,
      keyHex,
      hueWindowDeg: HUE_WINDOW_DEG,
      satMin: SAT_MIN,
      targetHeight,
      alphaThreshold: alpha,
    });
  } finally {
    await browser.close();
  }
  if (!result.ok) return fail(result.error, BITMAP_USAGE);
  for (const line of result.log) console.log(line);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, Buffer.from(result.pngBase64, 'base64'));
  console.log(`[6/6] wrote ${outPath}`);

  const manifest = readBitmapManifest();
  const rec = manifest[id] || { poses: {} };
  const arr = (rec.poses && rec.poses[pose]) ? [...rec.poses[pose]] : [];
  arr[frame] = outFile;
  manifest[id] = {
    id,
    class: klass,
    height: targetHeight,
    feet: result.feet,
    hit: result.hit,
    hitSize: result.hitSize,
    metrics: { p50L: result.p50L, pctBelow35: result.pctBelow35, pctAbove75: result.pctAbove75 },
    poses: { ...(rec.poses || {}), [pose]: arr },
  };
  writeBitmapManifest(manifest);
  console.log(`[6/6] wrote ${BITMAP_MANIFEST_PATH}`);
  writeFileSync(BITMAP_REGISTRY_PATH, buildBitmapRegistry(manifest));
  console.log(`[6/6] wrote ${BITMAP_REGISTRY_PATH}`);

  const summary = {
    id,
    pose,
    frame,
    class: klass,
    out: outPath,
    size: { w: result.width, h: result.height },
    feet: result.feet,
    hit: result.hit,
    hitSize: result.hitSize,
    p50L: result.p50L,
    pctBelow35: result.pctBelow35,
    pctAbove75: result.pctAbove75,
    keyHex: result.keyHex,
    registry: BITMAP_REGISTRY_PATH,
    manifest: BITMAP_MANIFEST_PATH,
  };
  console.log(JSON.stringify(summary));
}

// --- runs INSIDE the browser via page.evaluate (see runPipeline's own note:
// Playwright serializes it by source text, so it cannot close over anything
// from the module above — every helper it needs is declared inside it). ---
async function runBitmapPipeline(args) {
  const { dataUri, keyHex, hueWindowDeg, satMin, targetHeight, alphaThreshold } = args;
  const log = [];
  try {
    function lin(c) {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    }
    function luminance(r, g, b) {
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }
    function lstar(y) {
      return y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16;
    }
    function hexToRgb(hex) {
      const h = hex.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function rgbToHex(r, g, b) {
      return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
    }
    function rgbToHsv(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
      }
      if (h < 0) h += 360;
      return [h, max === 0 ? 0 : d / max, max];
    }
    function hueDist(a, b) {
      const d = Math.abs(a - b) % 360;
      return d > 180 ? 360 - d : d;
    }

    // ---- 1. decode ----
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('failed to decode the input as a PNG'));
      im.src = dataUri;
    });
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (W < 1 || H < 1) throw new Error('decoded image has zero size');
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = W;
    srcCanvas.height = H;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(img, 0, 0);
    const srcData = sctx.getImageData(0, 0, W, H);
    const px = srcData.data;
    log.push(`[2/6] decoded ${W}x${H} px`);

    // ---- 2. background hue (corner sample, or the given key=) ----
    let keyRgb;
    if (keyHex) {
      keyRgb = hexToRgb(keyHex);
    } else {
      const corners = [
        [0, 0],
        [W - 1, 0],
        [0, H - 1],
        [W - 1, H - 1],
      ].map(([x, y]) => {
        const i = (y * W + x) * 4;
        return [px[i], px[i + 1], px[i + 2]];
      });
      const counts = new Map();
      for (const c of corners) {
        const k = c.join(',');
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      let bestKey = corners[0].join(',');
      let bestN = 0;
      for (const [k, n] of counts) {
        if (n > bestN) {
          bestN = n;
          bestKey = k;
        }
      }
      keyRgb = bestKey.split(',').map(Number);
    }
    const hue0 = rgbToHsv(...keyRgb)[0];
    log.push(`[3/6] background hue ${hue0.toFixed(1)}° from ${rgbToHex(...keyRgb)} (window ±${hueWindowDeg}°, sat>${satMin})`);

    // ---- 3. opaque mask: hue+saturation key, already-transparent stays transparent ----
    const opaque = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (px[i + 3] === 0) continue;
        const [h, s] = rgbToHsv(px[i], px[i + 1], px[i + 2]);
        if (s > satMin && hueDist(h, hue0) <= hueWindowDeg) continue;
        opaque[y * W + x] = 1;
      }
    }
    let x0 = W;
    let x1 = -1;
    let y0 = H;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!opaque[y * W + x]) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < x0) throw new Error('no non-background pixels found (check key= / the input image)');
    const bboxW = x1 - x0 + 1;
    const bboxH = y1 - y0 + 1;
    log.push(`[4/6] cropped to bbox x=${x0} y=${y0} w=${bboxW} h=${bboxH}`);

    // ---- 4. crop onto its own canvas, background RGB zeroed defensively ----
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = bboxW;
    cropCanvas.height = bboxH;
    const cropCtx = cropCanvas.getContext('2d');
    const cropData = cropCtx.createImageData(bboxW, bboxH);
    for (let y = 0; y < bboxH; y++) {
      for (let x = 0; x < bboxW; x++) {
        const sy = y + y0;
        const sx = x + x0;
        if (!opaque[sy * W + sx]) continue; // leave at the zero-init (0,0,0,0)
        const si = (sy * W + sx) * 4;
        const di = (y * bboxW + x) * 4;
        cropData.data[di] = px[si];
        cropData.data[di + 1] = px[si + 1];
        cropData.data[di + 2] = px[si + 2];
        cropData.data[di + 3] = 255;
      }
    }
    cropCtx.putImageData(cropData, 0, 0);

    // ---- 5. area-downscale in two steps: to 1/4, then to the class height ----
    const midW = Math.max(1, Math.round(bboxW * 0.25));
    const midH = Math.max(1, Math.round(bboxH * 0.25));
    const midCanvas = document.createElement('canvas');
    midCanvas.width = midW;
    midCanvas.height = midH;
    const midCtx = midCanvas.getContext('2d');
    midCtx.imageSmoothingEnabled = true;
    midCtx.imageSmoothingQuality = 'high';
    midCtx.drawImage(cropCanvas, 0, 0, midW, midH);

    const outW = Math.max(1, Math.round(targetHeight * (bboxW / bboxH)));
    const outH = targetHeight;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const outCtx = outCanvas.getContext('2d');
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = 'high';
    outCtx.drawImage(midCanvas, 0, 0, outW, outH);
    log.push(`[5/6] downscaled ${bboxW}x${bboxH} -> ${midW}x${midH} -> ${outW}x${outH}`);

    // ---- 6. snap alpha: hard edges, no anti-aliasing survives ----
    const finalImg = outCtx.getImageData(0, 0, outW, outH);
    const fd = finalImg.data;
    for (let i = 0; i < fd.length; i += 4) {
      if (fd[i + 3] / 255 >= alphaThreshold) {
        fd[i + 3] = 255;
      } else {
        fd[i] = 0;
        fd[i + 1] = 0;
        fd[i + 2] = 0;
        fd[i + 3] = 0;
      }
    }
    outCtx.putImageData(finalImg, 0, 0);

    // ---- feet / hit / hitSize off the final (post-snap) opaque mass ----
    let fx0 = outW;
    let fx1 = -1;
    let fy0 = outH;
    let fy1 = -1;
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        if (fd[(y * outW + x) * 4 + 3] === 0) continue;
        if (x < fx0) fx0 = x;
        if (x > fx1) fx1 = x;
        if (y < fy0) fy0 = y;
        if (y > fy1) fy1 = y;
      }
    }
    if (fx1 < fx0) throw new Error('bitmap is empty after the alpha snap (try a lower alpha= or check key=)');
    const figW = fx1 - fx0 + 1;
    const figH = fy1 - fy0 + 1;
    const feet = { x: Math.round((fx0 + fx1) / 2), y: fy1 + 1 };
    // The torso box: the opaque bbox's central 60 % of width over the middle 45 % of height.
    const hitW = Math.max(1, Math.round(0.6 * figW));
    const hitH = Math.max(1, Math.round(0.45 * figH));
    const hx0 = fx0 + Math.floor((figW - hitW) / 2);
    const hy0 = fy0 + Math.floor((figH - hitH) / 2);
    const hit = { x: hx0 + Math.floor(hitW / 2), y: hy0 + Math.floor(hitH / 2) };
    const hitSize = { w: hitW, h: hitH };

    // ---- value stats over the opaque pixels (median L*, % below 35, % above 75) ----
    const ls = [];
    for (let y = 0; y < outH; y++) {
      for (let x = 0; x < outW; x++) {
        const i = (y * outW + x) * 4;
        if (fd[i + 3] === 0) continue;
        ls.push(lstar(luminance(fd[i], fd[i + 1], fd[i + 2])));
      }
    }
    ls.sort((a, b) => a - b);
    const n = Math.max(1, ls.length);
    const p50L = Math.round((ls[n >> 1] ?? 0) * 10) / 10;
    const pctBelow35 = Math.round((1000 * ls.filter((l) => l < 35).length) / n) / 10;
    const pctAbove75 = Math.round((1000 * ls.filter((l) => l > 75).length) / n) / 10;
    log.push(`[6/6] ${outW}x${outH} px, feet=(${feet.x},${feet.y}), p50L=${p50L} <35%=${pctBelow35} >75%=${pctAbove75}`);

    const pngBase64 = outCanvas.toDataURL('image/png').split(',')[1];
    return {
      ok: true,
      log,
      pngBase64,
      width: outW,
      height: outH,
      feet,
      hit,
      hitSize,
      p50L,
      pctBelow35,
      pctAbove75,
      keyHex: rgbToHex(...keyRgb),
    };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e), log };
  }
}

try {
  await main();
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}

