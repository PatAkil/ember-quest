// tools/probe.mjs — the art loop's small frame probes, in one file. These read
// PNG/JPG files (frames captured by tools/capture.mjs or tools/seats.mjs, and
// the owner's reference shots in tools/ref/); only `ground` needs the dev
// server, and only to read the stage anchors out of game/screens/layout.ts.
// Writes into tools/out/ (gitignored) unless `out=` says otherwise. Run from
// the repo root.
//
//   node tools/probe.mjs help
//   node tools/probe.mjs crop out=claw.png zoom=10 in=tools/out/battle-0.png,290,340,60,60 [in=other.png,x,y,w,h ...]
//                          # nearest-neighbour crops, side by side with 8-px gutters — the
//                          # "look at the actual pixels" probe. Any number of `in=` groups.
//   node tools/probe.mjs diff a=before.png b=after.png [out=diff.png] [y0=372] [y1=600] [bin=80]
//                          # where two frames differ: mean dL*, mean warmth (R-B) and the share
//                          # of pixels that moved more than 1.5 L, per x-bin over a band, plus a
//                          # stacked crop of the two so the numbers can be looked at.
//   node tools/probe.mjs step in=title.png y0=300 y1=600 [dy=2] [min=15]
//                          # the longest horizontal run of a VERTICAL L* step (L(y+dy) - L(y-dy)
//                          # over `min`) — how a horizon, a shelf or a floor edge reads as a line.
//   node tools/probe.mjs ground in=frame.png [pack=3] [u0=6] [u1=26] [halfw=58]
//                          # the ground under each rank's feet: p10/p50/p90 L* and warmth (R-B)
//                          # in the strip u0..u1 px BELOW each foot anchor, for the enemy rank,
//                          # the hero rank and the empty corridor between them. Anchors come
//                          # from layout.ts through the dev server (pack = how many enemies, so
//                          # the right anchor array is used), never typed in.
//   node tools/probe.mjs refval in=tools/ref/octopath-4-desert-battle.jpg box=liz_front,440,340,90,120 [box=...]
//                          # a reference crop's own value law: the box's p10/p50/p90, % below
//                          # L 35 and % above L 75, then the same THROUGH A FIGURE MASK — the
//                          # local ground is the box's p85 and a figure cell is anything more
//                          # than `drop` (default 12) L below it. This is how "the reference's
//                          # ground is ABOVE its figures" was measured.
//
// Every L* here is CIE L* from sRGB relative luminance, the same definition
// tools/rulers.mjs and tools/seats.mjs use, and every percentile is nearest-rank
// at index floor(t * (n - 1)) — the loop's one convention. (The coordinator's
// original one-off `cluster2.mjs` indexed floor(t * n) instead, which reads up
// to 0.1 L higher on a strip of a few thousand pixels; that, and nothing else,
// is why a `ground` p50 can differ from a number quoted off that script.)
// Pixel work happens in a headless Chromium because that is what decodes a JPEG
// and a PNG identically to the browser the frames came from.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = 'tools/out';

const args = process.argv.slice(2);
const opts = {};
const many = {};
const modes = new Set();
for (const a of args) {
  const eq = a.indexOf('=');
  if (eq > 0) { const k = a.slice(0, eq), v = a.slice(eq + 1); opts[k] = v; (many[k] ??= []).push(v); }
  else modes.add(a);
}
if (modes.has('help') || modes.has('--help') || modes.has('-h') || args.length === 0) {
  const src = readFileSync(new URL(import.meta.url), 'utf8').split('\n');
  const head = [];
  for (const line of src) { if (!line.startsWith('//')) break; head.push(line.replace(/^\/\/ ?/, '')); }
  console.log(head.join('\n'));
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

const outPath = (fallback) => {
  const p = opts.out ? (opts.out.includes('/') ? opts.out : `${OUT}/${opts.out}`) : `${OUT}/${fallback}`;
  mkdirSync(dirname(p), { recursive: true });
  return p;
};
const dataUrl = (file) => `data:image/${file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg') ? 'jpeg' : 'png'};base64,` + readFileSync(file).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
await page.goto('about:blank');

/**
 * The one L* definition, shipped into the page as source (`LSTAR`) and rebuilt
 * there with `new Function` — the same CIE L* from sRGB relative luminance that
 * tools/rulers.mjs and tools/seats.mjs measure in. `Lat(data, i)` reads it
 * straight off an ImageData buffer at byte offset i.
 */
function lstarHelpers() {
  const lin = (u) => { u /= 255; return u <= 0.03928 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4); };
  const Yof = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const Lof = (Y) => (Y <= 0.008856 ? 903.3 * Y : 116 * Math.cbrt(Y) - 16);
  return { Lat: (d, i) => Lof(Yof(d[i], d[i + 1], d[i + 2])) };
}
const LSTAR = lstarHelpers.toString();

// ==================================================================== crop ==
if (modes.has('crop')) {
  const zoom = Number(opts.zoom ?? 6);
  const groups = (many.in ?? []).map((g) => {
    const [file, x, y, w, h] = g.split(',');
    return { url: dataUrl(file), x: +x, y: +y, w: +w, h: +h, file };
  });
  if (!groups.length) throw new Error('crop needs at least one in=file,x,y,w,h');
  const png = await page.evaluate(async ({ groups, zoom }) => {
    const imgs = [];
    for (const g of groups) { const im = new Image(); im.src = g.url; await im.decode(); imgs.push(im); }
    const G = 8;
    const W = groups.reduce((t, g) => t + g.w * zoom + G, G);
    const H = Math.max(...groups.map((g) => g.h * zoom)) + 2 * G;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = '#202024'; x.fillRect(0, 0, W, H);
    let cx = G;
    groups.forEach((g, i) => { x.drawImage(imgs[i], g.x, g.y, g.w, g.h, cx, G, g.w * zoom, g.h * zoom); cx += g.w * zoom + G; });
    return c.toDataURL('image/png').split(',')[1];
  }, { groups, zoom });
  const p = outPath('crop.png');
  writeFileSync(p, Buffer.from(png, 'base64'));
  console.log(`wrote ${p}  ${groups.map((g) => `${g.file} ${g.x},${g.y} ${g.w}x${g.h}`).join(' | ')}  at x${zoom}`);
}

// ==================================================================== diff ==
if (modes.has('diff')) {
  const A = dataUrl(opts.a), B = dataUrl(opts.b);
  const y0 = Number(opts.y0 ?? 372), y1 = Number(opts.y1 ?? 600), bin = Number(opts.bin ?? 80);
  const r = await page.evaluate(async ({ A, B, y0, y1, bin, LSTAR }) => {
    const { Lat } = new Function('return (' + LSTAR + ')')()();
    const load = async (u) => { const im = new Image(); im.src = u; await im.decode(); return im; };
    const ia = await load(A), ib = await load(B);
    const W = ia.width, H = ia.height;
    const cv = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return x.getImageData(0, 0, W, H).data; };
    const da = cv(ia), db = cv(ib);
    const bins = [];
    for (let x0 = 0; x0 < W; x0 += bin) {
      let dl = 0, drb = 0, n = 0, changed = 0;
      for (let y = y0; y < Math.min(H, y1); y++) for (let x = x0; x < Math.min(W, x0 + bin); x++) {
        const i = (y * W + x) * 4;
        const d1 = Lat(db, i) - Lat(da, i);
        const d2 = (db[i] - db[i + 2]) - (da[i] - da[i + 2]);
        dl += d1; drb += d2; n++; if (Math.abs(d1) > 1.5) changed++;
      }
      bins.push({ x0, dL: +(dl / n).toFixed(2), dRB: +(drb / n).toFixed(1), changed: +((100 * changed) / n).toFixed(1) });
    }
    const ch = Math.min(H - Math.max(0, y0 - 42), y1 - y0 + 84);
    const top = Math.max(0, y0 - 42);
    const c = document.createElement('canvas'); c.width = W; c.height = ch * 2 + 4;
    const x = c.getContext('2d'); x.fillStyle = '#f00'; x.fillRect(0, 0, W, c.height);
    x.drawImage(ia, 0, top, W, ch, 0, 0, W, ch);
    x.drawImage(ib, 0, top, W, ch, 0, ch + 4, W, ch);
    return { bins, png: c.toDataURL('image/png').split(',')[1] };
  }, { A, B, y0, y1, bin, LSTAR });
  const p = outPath('diff.png');
  writeFileSync(p, Buffer.from(r.png, 'base64'));
  console.log(`${opts.a} -> ${opts.b}, rows ${y0}-${y1}, ${bin}-px bins:`);
  for (const q of r.bins) console.log(`  x ${String(q.x0).padStart(4)}-${String(q.x0 + bin - 1).padStart(4)}  dL ${String(q.dL).padStart(6)}  dR-B ${String(q.dRB).padStart(6)}  moved ${String(q.changed).padStart(5)} %`);
  console.log(`stacked crop (before over after) -> ${p}`);
}

// ==================================================================== step ==
if (modes.has('step')) {
  const y0 = Number(opts.y0 ?? 0), y1 = Number(opts.y1 ?? 720), dy = Number(opts.dy ?? 2), min = Number(opts.min ?? 15);
  const r = await page.evaluate(async ({ url, y0, y1, dy, min, LSTAR }) => {
    const { Lat } = new Function('return (' + LSTAR + ')')()();
    const im = new Image(); im.src = url; await im.decode();
    const W = im.width, H = im.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    const Lxy = (X, Y) => Lat(d, (Y * W + X) * 4);
    let best = { run: 0, y: 0, dL: 0 };
    for (let y = Math.max(dy, y0); y < Math.min(H - dy, y1); y++) {
      let run = 0, maxRun = 0, sum = 0, n = 0;
      for (let X = 0; X < W; X++) {
        const dl = Lxy(X, y + dy) - Lxy(X, y - dy);
        if (Math.abs(dl) > min) { run++; sum += dl; n++; if (run > maxRun) maxRun = run; } else run = 0;
      }
      if (maxRun > best.run) best = { run: maxRun, y, dL: n ? +(sum / n).toFixed(1) : 0 };
    }
    return best;
  }, { url: dataUrl(opts.in), y0, y1, dy, min, LSTAR });
  console.log(`${opts.in}: longest step run ${r.run} px at y ${r.y} (mean dL ${r.dL} over +-${dy} px, threshold ${min})`);
}

// ================================================================== ground ==
if (modes.has('ground')) {
  const anchors = await (async () => {
    const p2 = await browser.newPage();
    await p2.goto(`${BASE}/tools/lineup.html?sheet=lineup&mode=sil&zoom=1&cols=7`, { waitUntil: 'load' });
    const a = await p2.evaluate(async () => {
      const L = await import('/game/screens/layout.ts');
      const xy = (p) => [p.x, p.y];
      return { hero: L.HERO_FEET.map(xy), enemy: L.ENEMY_FEET.map(xy), pair: L.ENEMY_FEET_PAIR.map(xy), boss: [xy(L.BOSS_FEET)] };
    });
    await p2.close();
    return a;
  })();
  const pack = Number(opts.pack ?? 3);
  const enemy = pack === 1 ? anchors.boss : pack === 2 ? anchors.pair : anchors.enemy;
  const u0 = Number(opts.u0 ?? 6), u1 = Number(opts.u1 ?? 26), halfw = Number(opts.halfw ?? 58);
  // the empty corridor between the ranks, on the same three ground rows
  const midX = Math.round((enemy[enemy.length - 1][0] + anchors.hero[0][0]) / 2);
  const corridor = anchors.hero.map((h) => [midX, h[1]]);
  const r = await page.evaluate(async ({ url, sets, u0, u1, halfw, LSTAR }) => {
    const { Lat } = new Function('return (' + LSTAR + ')')()();
    const im = new Image(); im.src = url; await im.decode();
    const W = im.width, H = im.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    const strip = (pts) => {
      const v = []; let rb = 0, n = 0;
      for (const [fx, fy] of pts) for (let Y = fy + u0; Y < fy + u1; Y++) for (let X = fx - halfw; X < fx + halfw; X++) {
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const i = (Y * W + X) * 4;
        v.push(Lat(d, i)); rb += d[i] - d[i + 2]; n++;
      }
      v.sort((a, b) => a - b);
      const q = (t) => +v[Math.floor(t * (v.length - 1))].toFixed(1);
      return { n, p10: q(0.1), p50: q(0.5), p90: q(0.9), rb: +(rb / n).toFixed(1) };
    };
    return Object.fromEntries(Object.entries(sets).map(([k, pts]) => [k, strip(pts)]));
  }, { url: dataUrl(opts.in), sets: { enemy, hero: anchors.hero, corridor }, u0, u1, halfw, LSTAR });
  console.log(`${opts.in}: ground in the u+${u0}..+${u1} strip, ${2 * halfw} px wide, at layout.ts's anchors (pack of ${pack})`);
  for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(9)} p50 ${String(v.p50).padStart(5)} (p10 ${v.p10} / p90 ${v.p90})   warmth R-B ${String(v.rb).padStart(6)}   ${v.n} px`);
}

// ================================================================== refval ==
if (modes.has('refval')) {
  const drop = Number(opts.drop ?? 12);
  const boxes = (many.box ?? []).map((b) => { const [name, x, y, w, h] = b.split(','); return { name, x: +x, y: +y, w: +w, h: +h }; });
  if (!boxes.length) throw new Error('refval needs at least one box=name,x,y,w,h');
  const r = await page.evaluate(async ({ url, boxes, drop, LSTAR }) => {
    const { Lat } = new Function('return (' + LSTAR + ')')()();
    const im = new Image(); im.src = url; await im.decode();
    const W = im.width, H = im.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    const out = {};
    for (const b of boxes) {
      const v = [];
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) {
        const X = b.x + i, Y = b.y + j;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        v.push(Lat(d, (Y * W + X) * 4));
      }
      v.sort((a, bb) => a - bb);
      const q = (a, t) => +a[Math.floor(t * (a.length - 1))].toFixed(1);
      const pct = (a, f) => +((100 * a.filter(f).length) / Math.max(1, a.length)).toFixed(1);
      const ground = q(v, 0.85);
      const fig = v.filter((u) => u < ground - drop);
      out[b.name] = {
        n: v.length, p10: q(v, 0.1), p50: q(v, 0.5), p90: q(v, 0.9),
        below35: pct(v, (u) => u < 35), above75: pct(v, (u) => u > 75), localGround: ground,
        figP50: fig.length ? q(fig, 0.5) : null, figBelow35: fig.length ? pct(fig, (u) => u < 35) : null,
        figAbove75: fig.length ? pct(fig, (u) => u > 75) : null, figShare: +((100 * fig.length) / v.length).toFixed(1),
      };
    }
    return out;
  }, { url: dataUrl(opts.in), boxes, drop, LSTAR });
  console.log(`${opts.in}: box p50 / % below L 35 / % above L 75, then the same through the figure mask (cells more than ${drop} L under the box's own p85)`);
  const P = (s, n = 14) => String(s).padEnd(n), R = (s, n = 9) => String(s).padStart(n);
  console.log(P('box') + R('p10') + R('p50') + R('p90') + R('<L35 %') + R('>L75 %') + R('ground') + R('fig p50') + R('fig<35') + R('fig>75') + R('fig %'));
  for (const [k, v] of Object.entries(r)) console.log(P(k) + R(v.p10) + R(v.p50) + R(v.p90) + R(v.below35) + R(v.above75) + R(v.localGround) + R(v.figP50) + R(v.figBelow35) + R(v.figAbove75) + R(v.figShare));
}

await browser.close();
