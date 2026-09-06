// tools/rulers.mjs — the art loop's SHEET rulers, off the real bakes, unrounded.
// Everything the round-13/14 critics measured on the sprite sheet that
// tools/lineup.ts does not already compute, in one maintained pass. Dev-server
// only (`npm run dev`, or CAPTURE_URL pointing at another port). Writes into
// tools/out/ (gitignored). Run from the repo root.
//
//   node tools/rulers.mjs help
//   node tools/rulers.mjs                      # every ruler, all 43 actors, + the verdict lines
//   node tools/rulers.mjs actors=DUST_WRAITH,LUMEN     # a subset (the poses pass is the slow one)
//   node tools/rulers.mjs json=1               # also write tools/out/rulers.json
//   node tools/rulers.mjs hash [out=tools/out/hashes.json] [against=tools/out/hashes-old.json]
//                                              # md5 every pose bake; with `against`, diff two trees bake by bake
//
// WHAT THIS FILE IS FOR. tools/lineup.ts already measures criteria 1-6 per
// actor and `node tools/capture.mjs sheets` already writes them to
// tools/out/metrics.md — that is not repeated here. This file adds the rulers
// the critics built by hand on top of it, and reuses `window.__lineup.metrics`
// for the two it already owns (mirror IoU, nearest-pair IoU).
//
// THE RULERS (with the bar ART-REVIEW.md reads them against):
//   lit           criterion 1's lit-from-above, UNROUNDED: mean L* of the
//                 silhouette's top quarter rows minus its bottom quarter rows
//                 (lineup.ts rounds both ends before subtracting, which is what
//                 hid CRYPT_WARDEN's 7.68; coordinator decision 3 after round
//                 13 makes the unrounded number the criterion).      bar >= 8
//   torso50       p50 of the fractional torso band — rows round(0.33*h) ..
//                 round(0.72*h) of the silhouette, on the 4-neighbour-eroded
//                 mask (decision 2 after round 13). The sheet twin of
//                 tools/seats.mjs's in-scene band.
//   settle        criterion 7: absolute colour difference of attack 2 against
//                 idle 0 — over the union of their cells, the share that is
//                 missing on one side or a different rgb.          band 20-39
//   idleChg       criterion 8: the same difference, idle 2 against idle 0.
//                                                                  floor >= 17
//   top3rd        of the cells that change between idle 0 and idle 2, the share
//                 in the top third of the idle bounding box.
//   crownDy       hurt 0's bounding-box top row minus idle 0's — a hurt pose
//                 that does not drop the crown is not a hurt pose.  bar <= -1
//   deadH         dead 0's box height as a % of idle 0's.          band 25-57
//   edge%         interior edge density: of cells with all four 4-neighbours
//                 present, the share with a neighbour of a different colour.
//   comps         8-connected components per bake; a non-dead bake that is not
//                 ONE component is a figure that has fallen apart.  bar = 1
//   mirror        window.__lineup's mirror IoU (idle 0 against its own flip).
//                                                                     bar < 85
//   nearest       window.__lineup's nearest-silhouette IoU.            bar < 78
//   blob%         the plane blob: the largest 8-connected run of cells in
//                 L* 28-38, as a share of the figure — the anchor mass that
//                 keeps a dark share from being sprinkled.            bar >= 2
//   hole%         the share of the figure's cells in the L* 38 .. 3:1 window
//                 (3:1 against the stage navy #1d2b53 is L* 49.30, derived
//                 here, not typed). `legal()` lifts every ramp step to 3.2:1
//                 (L* 51.11) and the dark steps sit under L* 38, so the cast
//                 owns ~0.01 % of its pixels in between: an actor's torso
//                 median is either >= 49.3 or <= 38 and nothing between. This
//                 is the round-14 verdict's palette hole, measured.
//
// WHERE THE CELLS COME FROM. Two sheets, both at zoom 1, both on lineup.ts's
// own cell geometry (CELL 100, PAD 8, LABEL_H 18; feet at (54, 98) in-cell):
//   * the LINE-UP sheet (`sheet=lineup&mode=color&zoom=1&cols=7&bg=1d2b53`) for
//     everything read off idle 0 — lit, torso50, blob%, hole%. A cell is a body
//     cell when it is neither the stage navy nor the navy under the row's faint
//     10 %-white ground line (rgb 52,64,100).
//   * the POSE sheets (`sheet=poses&actor=ID&zoom=1`) for everything that needs
//     more than idle 0 — settle, idleChg, top3rd, crownDy, deadH, edge%, comps.
//     Read twice per actor, `mode=sil` then `mode=color`, and intersected: the
//     silhouette pass is what keeps a label glyph out of a sprite.
//   Both give identical cell-local coordinates for idle 0, so the two families
//   of ruler are measured on the same pixels.
//
// `hash` is the byte-identity gate: md5 of every non-background cell of every
// bake ("x,y,r,g,b;" in scan order, first 12 hex of the digest), 43 actors x 5
// poses x 3 frames = 645. Run it on two trees and diff, instead of trusting a
// claim that only four actors moved.

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = 'tools/out';

const args = process.argv.slice(2);
const opts = {};
const modes = new Set();
for (const a of args) {
  const eq = a.indexOf('=');
  if (eq > 0) opts[a.slice(0, eq)] = a.slice(eq + 1);
  else modes.add(a);
}
if (modes.has('help') || modes.has('--help') || modes.has('-h')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8').split('\n');
  const head = [];
  for (const line of src) { if (!line.startsWith('//')) break; head.push(line.replace(/^\/\/ ?/, '')); }
  console.log(head.join('\n'));
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

/** tools/lineup.ts's cell geometry and the sheet's default ground. */
const CELL = 100, PAD = 8, LABEL_H = 18, COLS = 7, GUTTER = 150, ZOOM = 1, BG = '1d2b53';
const POSES = ['idle', 'attack', 'hurt', 'cast', 'dead'];

// --- CIE L*, the one definition every ruler in the loop uses -----------------
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const Yof = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const Lof = (Y) => (Y <= 0.008856 ? 903.3 * Y : 116 * Math.cbrt(Y) - 16);
const L = (p) => Lof(Yof(p[2], p[3], p[4]));
/** L* of the darkest tone that still clears `k`:1 against the ground. */
const NAVY_Y = Yof(parseInt(BG.slice(0, 2), 16), parseInt(BG.slice(2, 4), 16), parseInt(BG.slice(4, 6), 16));
const Lat = (k) => Lof(k * (NAVY_Y + 0.05) - 0.05);
const L3 = Lat(3);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 1 });
async function load(url) {
  let last;
  for (let i = 0; i < 8; i++) {
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__lineup && window.__lineup.ready, null, { timeout: 30000 });
      return;
    } catch (e) { last = e; await page.waitForTimeout(900); }
  }
  throw last;
}

// --- the line-up sheet: window.__lineup's metrics + idle-0 cells -------------
await load(`${BASE}/tools/lineup.html?sheet=lineup&mode=color&zoom=${ZOOM}&cols=${COLS}&bg=${BG}`);
const MET = await page.evaluate(() => window.__lineup.metrics);
const ALL_IDS = MET.map((m) => m.id);
const IDS = opts.actors ? opts.actors.split(',').filter((id) => ALL_IDS.includes(id)) : ALL_IDS;
const idleCells = await page.evaluate(({ ids, g }) => {
  const cw = g.CELL * g.ZOOM + g.PAD, ch = cw, cellH = ch + g.LABEL_H;
  const all = window.__lineup.metrics.map((m) => m.id);
  const s = document.getElementById('sheet').getContext('2d', { willReadFrequently: true });
  const bg = (r, gg, b) => (r === 29 && gg === 43 && b === 83) || (r === 52 && gg === 64 && b === 100);
  const out = {};
  for (const id of ids) {
    const idx = all.indexOf(id);
    const cx0 = (idx % g.COLS) * cw, cy0 = ((idx / g.COLS) | 0) * cellH;
    const d = s.getImageData(cx0, cy0, cw, ch).data;
    const px = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4;
      if (bg(d[i], d[i + 1], d[i + 2])) continue;
      px.push([x, y, d[i], d[i + 1], d[i + 2]]);
    }
    out[id] = px;
  }
  return out;
}, { ids: IDS, g: { CELL, PAD, LABEL_H, COLS, ZOOM } });

// --- the pose sheets: every bake's cells, silhouette-masked ------------------
/** Reads one actor's 5x3 pose grid. `mode=sil` gives the mask, `mode=color` the tones. */
const readPoses = (mode) => page.evaluate(({ mode, g, POSES }) => {
  const cw = g.CELL * g.ZOOM + g.PAD, ch = cw, cellH = ch + g.LABEL_H;
  const cv = document.getElementById('sheet');
  const s = cv.getContext('2d', { willReadFrequently: true });
  const W = cv.width, D = s.getImageData(0, 0, cv.width, cv.height).data;
  const nCols = Math.round((W - g.GUTTER) / cw);
  const bg = (r, gg, b) => (r === 29 && gg === 43 && b === 83) || (r === 52 && gg === 64 && b === 100);
  const out = {};
  for (let r = 0; r < POSES.length; r++) {
    out[POSES[r]] = [];
    for (let c = 0; c < nCols; c++) {
      const bx = g.GUTTER + c * cw, by = r * cellH;
      if (bx + cw > cv.width || by + ch > cv.height) continue;
      const px = [];
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = ((by + y) * W + (bx + x)) * 4;
        if (mode === 'sil') { if (D[i] === 214 && D[i + 1] === 214 && D[i + 2] === 220) px.push([x, y, 214, 214, 220]); }
        else if (!bg(D[i], D[i + 1], D[i + 2])) px.push([x, y, D[i], D[i + 1], D[i + 2]]);
      }
      if (px.length) out[POSES[r]].push(px);
    }
  }
  return out;
}, { mode, g: { CELL, PAD, LABEL_H, GUTTER, ZOOM }, POSES });

// ============================================================== the rulers ==
const bbox = (px) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (const p of px) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return [x0, y0, x1, y1]; };
const key = (p) => p[0] + ',' + p[1];
/** Absolute colour difference over the union of two bakes' cells, as a %. */
function absDiff(A, B) {
  const MA = new Map(A.map((p) => [key(p), p])), MB = new Map(B.map((p) => [key(p), p]));
  const keys = new Set([...MA.keys(), ...MB.keys()]);
  let d = 0;
  for (const k of keys) {
    const a = MA.get(k), c = MB.get(k);
    if (!a || !c) { d++; continue; }
    if (a[2] !== c[2] || a[3] !== c[3] || a[4] !== c[4]) d++;
  }
  return +((100 * d) / keys.size).toFixed(1);
}
/** 8-connected components over a set of "x,y" keys. */
function comps(keys) {
  const S = new Set(keys), seen = new Set();
  let n = 0, best = 0;
  for (const k of keys) {
    if (seen.has(k)) continue;
    n++; const st = [k]; seen.add(k); let c = 0;
    while (st.length) {
      const cur = st.pop(); c++;
      const [x, y] = cur.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nn = (x + dx) + ',' + (y + dy);
        if (S.has(nn) && !seen.has(nn)) { seen.add(nn); st.push(nn); }
      }
    }
    if (c > best) best = c;
  }
  return { n, best };
}
/** Largest 8-connected run of cells inside an L* window, as a share of the figure. */
function windowBlob(px, lo, hi) {
  const S = new Set(px.filter((p) => { const l = L(p); return l >= lo && l <= hi; }).map(key));
  return +((100 * comps([...S]).best) / px.length).toFixed(2);
}
function idleRulers(px) {
  const [, y0, , y1] = bbox(px);
  const h = y1 - y0 + 1, q = Math.max(1, Math.floor(h / 4));
  let tS = 0, tN = 0, bS = 0, bN = 0, hole = 0;
  for (const p of px) {
    const l = L(p);
    if (p[1] < y0 + q) { tS += l; tN++; } else if (p[1] > y1 - q) { bS += l; bN++; }
    if (l > 38 && l < L3) hole++;
  }
  const set = new Set(px.map(key));
  const inner = (p) => set.has((p[0] - 1) + ',' + p[1]) && set.has((p[0] + 1) + ',' + p[1]) && set.has(p[0] + ',' + (p[1] - 1)) && set.has(p[0] + ',' + (p[1] + 1));
  const fr0 = y0 + Math.round(0.33 * h), fr1 = y0 + Math.round(0.72 * h);
  const band = [];
  for (const p of px) if (inner(p) && p[1] >= fr0 && p[1] <= fr1) band.push(L(p));
  band.sort((a, b) => a - b);
  const p50 = band.length ? Math.round(band[Math.floor(0.5 * (band.length - 1))] * 10) / 10 : 0;
  const top = tS / Math.max(1, tN), bot = bS / Math.max(1, bN);
  return {
    cells: px.length, h,
    topL: +top.toFixed(2), botL: +bot.toFixed(2), lit: +(top - bot).toFixed(2),
    torso50: p50, torsoBelow35: +((100 * band.filter((v) => v < 35).length) / Math.max(1, band.length)).toFixed(1),
    blob: windowBlob(px, 28, 38), holeCells: hole, hole: +((100 * hole) / px.length).toFixed(2),
  };
}
function poseRulers(A) {
  const i0 = A.idle[0], i2 = A.idle[2] ?? A.idle[A.idle.length - 1];
  const a2 = A.attack[2] ?? A.attack[A.attack.length - 1], h0 = A.hurt[0], d0 = A.dead[0];
  const bi = bbox(i0), bh = bbox(h0), bd = bbox(d0);
  const H = bi[3] - bi[1] + 1, cut = bi[1] + H / 3;
  const M0 = new Map(i0.map((p) => [key(p), p])), M2 = new Map(i2.map((p) => [key(p), p]));
  let chTop = 0, chAll = 0;
  for (const k of new Set([...M0.keys(), ...M2.keys()])) {
    const y = Number(k.split(',')[1]);
    const q = M0.get(k), w = M2.get(k);
    if ((!q && w) || (q && !w) || (q && w && (q[2] !== w[2] || q[3] !== w[3] || q[4] !== w[4]))) { chAll++; if (y < cut) chTop++; }
  }
  const M = new Map(i0.map((p) => [key(p), p]));
  let interior = 0, edged = 0;
  for (const p of i0) {
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => M.get((p[0] + dx) + ',' + (p[1] + dy)));
    if (nb.every((q) => q)) { interior++; if (nb.some((q) => q[2] !== p[2] || q[3] !== p[3] || q[4] !== p[4])) edged++; }
  }
  const multi = [];
  for (const [pose, frames] of Object.entries(A)) frames.forEach((px, i) => {
    const c = comps(px.map(key));
    if (c.n > 1 && pose !== 'dead') multi.push(`${pose}${i}:${c.n}`);
  });
  return {
    settle: absDiff(i0, a2), idleChg: absDiff(i0, i2),
    top3: +((100 * chTop) / Math.max(1, chAll)).toFixed(1),
    crownDy: bh[1] - bi[1], deadH: +((100 * (bd[3] - bd[1] + 1)) / H).toFixed(0),
    edge: +((100 * edged) / Math.max(1, interior)).toFixed(1), multi: multi.join(' '),
  };
}

// =================================================================== hash ===
if (modes.has('hash')) {
  const out = {};
  for (const id of IDS) {
    await load(`${BASE}/tools/lineup.html?sheet=poses&actor=${id}&mode=color&zoom=${ZOOM}&bg=${BG}`);
    const cells = await readPoses('color');
    out[id] = {};
    for (const [pose, frames] of Object.entries(cells)) frames.forEach((px, i) => {
      let s = '';
      for (const p of px) s += `${p[0]},${p[1]},${p[2]},${p[3]},${p[4]};`;
      if (s) out[id][`${pose} ${i}`] = createHash('md5').update(s).digest('hex').slice(0, 12);
    });
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  const file = opts.out || `${OUT}/hashes.json`;
  writeFileSync(file, JSON.stringify(out, null, 1));
  const n = Object.values(out).reduce((a, c) => a + Object.keys(c).length, 0);
  console.log(`${IDS.length} actors, ${n} bakes -> ${file}`);
  if (opts.against) {
    if (!existsSync(opts.against)) { console.log(`no ${opts.against} to diff against`); }
    else {
      const old = JSON.parse(readFileSync(opts.against, 'utf8'));
      const moved = [], gone = [], added = [];
      for (const [id, bakes] of Object.entries(out)) for (const [k, v] of Object.entries(bakes)) {
        const o = old[id] && old[id][k];
        if (o === undefined) added.push(`${id} ${k}`); else if (o !== v) moved.push(`${id} ${k}`);
      }
      for (const [id, bakes] of Object.entries(old)) for (const k of Object.keys(bakes)) if (!(out[id] && out[id][k] !== undefined)) gone.push(`${id} ${k}`);
      const byActor = {};
      for (const m of moved) { const id = m.split(' ')[0]; byActor[id] = (byActor[id] || 0) + 1; }
      console.log(`\nagainst ${opts.against}: ${moved.length} of ${n} bakes moved${added.length ? `, ${added.length} new` : ''}${gone.length ? `, ${gone.length} gone` : ''}`);
      console.log(Object.keys(byActor).length ? Object.entries(byActor).map(([id, c]) => `  ${id} ${c}`).join('\n') : '  byte-identical');
      if (moved.length) console.log(`  ${Object.keys(byActor).length} actor(s) moved; the other ${IDS.length - Object.keys(byActor).length} are byte-identical`);
    }
  }
  await browser.close();
  process.exit(0);
}

// ================================================================== report ==
const rows = [];
for (const id of IDS) {
  // sil first: the row-label text is not part of the sprite
  await load(`${BASE}/tools/lineup.html?sheet=poses&actor=${id}&mode=sil&zoom=${ZOOM}&bg=${BG}`);
  const sil = await readPoses('sil');
  await load(`${BASE}/tools/lineup.html?sheet=poses&actor=${id}&mode=color&zoom=${ZOOM}&bg=${BG}`);
  const col = await readPoses('color');
  const A = {};
  for (const [pose, frames] of Object.entries(col)) A[pose] = frames.map((px, i) => {
    const m = new Set(((sil[pose] && sil[pose][i]) || []).map(key));
    return m.size ? px.filter((p) => m.has(key(p))) : px;
  });
  const m = MET.find((x) => x.id === id) || {};
  rows.push({ id, ...idleRulers(idleCells[id]), ...poseRulers(A), mirror: m.mirrorIoU, nearest: m.nearestIoU, nearestTo: m.nearest });
  process.stderr.write('.');
}
process.stderr.write('\n');
await browser.close();

const P = (s, n = 17) => String(s).padEnd(n), R = (s, n = 8) => String(s).padStart(n);
console.log(`sheet rulers off the real bakes, zoom 1, ground #${BG} (3:1 = L* ${L3.toFixed(2)}, 3.2:1 = L* ${Lat(3.2).toFixed(2)})\n`);
console.log(P('actor') + R('lit') + R('torso50') + R('tor<35') + R('settle') + R('idleChg') + R('top3rd') + R('crownDy') + R('deadH%') + R('edge%') + R('mirror') + R('nearest') + R('blob%') + R('hole%') + '  comps>1');
for (const r of rows) console.log(P(r.id) + R(r.lit) + R(r.torso50) + R(r.torsoBelow35) + R(r.settle) + R(r.idleChg) + R(r.top3) + R(r.crownDy) + R(r.deadH) + R(r.edge) + R(r.mirror) + R(r.nearest) + R(r.blob) + R(r.hole) + '  ' + (r.multi || '-'));

const num = (k) => rows.map((r) => r[k]).filter((v) => typeof v === 'number');
const mn = (k) => Math.min(...num(k)), mx = (k) => Math.max(...num(k));
const who = (k, v) => (rows.find((r) => r[k] === v) || {}).id;
const line = (label, k, bar) => console.log(`${label.padEnd(13)} ${mn(k)} (${who(k, mn(k))}) .. ${mx(k)} (${who(k, mx(k))})   ${bar}`);
console.log('');
line('lit from above', 'lit', 'bar >= 8 UNROUNDED');
line('torso p50', 'torso50', 'the sheet twin of the in-scene band');
line('settle', 'settle', 'band 20-39');
line('idle change', 'idleChg', 'floor >= 17');
line('top third', 'top3', '');
line('crownDy', 'crownDy', 'bar <= -1');
line('dead height', 'deadH', 'band 25-57 %');
line('edge density', 'edge', 'bar >= 72 where the criterion is read');
console.log(`mirror max    ${mx('mirror')} (${who('mirror', mx('mirror'))})   bar < 85`);
console.log(`nearest max   ${mx('nearest')} (${who('nearest', mx('nearest'))})   bar < 78`);
line('plane blob', 'blob', 'bar >= 2 %');
const totC = rows.reduce((a, c) => a + c.cells, 0), totH = rows.reduce((a, c) => a + c.holeCells, 0);
console.log(`\nunder the lit floor:  ${rows.filter((r) => r.lit < 8).map((r) => r.id + ' ' + r.lit).join(', ') || 'none'}`);
console.log(`over the settle band: ${rows.filter((r) => r.settle < 20 || r.settle > 39).map((r) => r.id + ' ' + r.settle).join(', ') || 'none'}`);
console.log(`under the idle floor: ${rows.filter((r) => r.idleChg < 17).map((r) => r.id + ' ' + r.idleChg).join(', ') || 'none'}`);
console.log(`crown that does not drop: ${rows.filter((r) => r.crownDy > -1).map((r) => r.id + ' ' + r.crownDy).join(', ') || 'none'}`);
console.log(`dead height out of band:  ${rows.filter((r) => r.deadH < 25 || r.deadH > 57).map((r) => r.id + ' ' + r.deadH).join(', ') || 'none'}`);
console.log(`plane blob under 2 %:     ${rows.filter((r) => r.blob < 2).map((r) => r.id + ' ' + r.blob).join(', ') || 'none'}`);
console.log(`multi-component NON-DEAD bakes: ${rows.filter((r) => r.multi).map((r) => r.id + ' ' + r.multi).join(' | ') || 'none'}`);
console.log(`\nthe palette hole: ${totH} of ${totC} cells = ${((100 * totH) / totC).toFixed(2)} % of the cast sits in the ${(L3 - 38).toFixed(1)}-L window between L* 38 and 3:1 (L* ${L3.toFixed(2)}).`);
if (opts.json) { writeFileSync(`${OUT}/rulers.json`, JSON.stringify(rows, null, 1)); console.log(`\nwrote ${OUT}/rulers.json`); }
