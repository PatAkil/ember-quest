// tools/capture.mjs — screenshots for the art loop. Needs the dev server up
// (`npm run dev`, port 5173). Writes into tools/out/ (gitignored).
//
//   node tools/capture.mjs                 # sheets + battle
//   node tools/capture.mjs sheets          # line-ups (colour/grey/silhouette, x2 and x4) + every actor's pose sheet + metrics
//   node tools/capture.mjs sheets actor=EMBER   # one actor's pose sheet only
//   node tools/capture.mjs battle          # title, room card, battle frames, a hit, pause, inspect
//   node tools/capture.mjs phone           # the same battle frames on a phone viewport (touch)
//   node tools/capture.mjs shot url=/tools/vfx.html?skill=CINDER name=vfx-CINDER [selector=#sheet]
//                                          # any dev page that sets window.__lineup.ready (or window.__ready) -> tools/out/<name>.png
//
// The game frames are read straight off the backing store (canvas.toDataURL),
// so they are exact 1280x720 logical frames whatever the CSS fit; the sheets
// are element screenshots of a canvas drawn at its own size.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = 'tools/out';
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const opts = {};
const modes = new Set();
for (const a of args) {
  const eq = a.indexOf('=');
  if (eq > 0) opts[a.slice(0, eq)] = a.slice(eq + 1);
  else modes.add(a);
}
if (modes.size === 0) { modes.add('sheets'); modes.add('battle'); }

const HEROES = ['EMBER', 'GALE', 'TIDE', 'BASALT', 'SABLE', 'LUMEN'];
const CRYPT = ['CINDER_IMP', 'ASH_HOUND', 'CRYPT_WARDEN', 'DUST_WRAITH', 'PYRE_KNIGHT', 'HOLLOW_KING'];
const MARSH = ['BOG_TOAD', 'FROST_WISP', 'MARSH_HAG', 'SILT_CRAB', 'FEN_FIRE', 'DROWNED_KNIGHT', 'PALE_SAINT'];

const browser = await chromium.launch();
const errors = [];
function watch(page) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
}

async function sheet(page, name, query) {
  await page.goto(`${BASE}/tools/lineup.html?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lineup && window.__lineup.ready, null, { timeout: 20000 });
  await page.locator('#sheet').screenshot({ path: `${OUT}/${name}.png` });
  return page.evaluate(() => window.__lineup.metrics);
}

if (modes.has('sheets')) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  watch(page);
  const only = opts.actor;
  if (!only) {
    const metrics = await sheet(page, 'lineup-x2', 'sheet=lineup&mode=color&zoom=2');
    await sheet(page, 'lineup-x2-grey', 'sheet=lineup&mode=grey&zoom=2');
    await sheet(page, 'lineup-x2-sil', 'sheet=lineup&mode=sil&zoom=2');
    await sheet(page, 'lineup-heroes-x4', `sheet=lineup&mode=color&zoom=4&cols=3&group=${HEROES.join(',')}`);
    await sheet(page, 'lineup-crypt-x4', `sheet=lineup&mode=color&zoom=4&cols=3&group=${CRYPT.join(',')}`);
    await sheet(page, 'lineup-marsh-x4', `sheet=lineup&mode=color&zoom=4&cols=4&group=${MARSH.join(',')}`);
    await sheet(page, 'lineup-heroes-x4-grey', `sheet=lineup&mode=grey&zoom=4&cols=3&group=${HEROES.join(',')}`);
    await sheet(page, 'lineup-enemies-x4-grey', `sheet=lineup&mode=grey&zoom=4&cols=5&group=${[...CRYPT, ...MARSH].join(',')}`);
    writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
    const md = [
      '| actor | px | w×h | frame % | L min/p2/p98/max | <L35 % | >L75 % | bands 0-15/15-35/35-55/55-75/75+ | contrast mean / min | <3:1 % | colours |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      ...metrics.map((m) => `| ${m.id} | ${m.pixels} | ${m.w}×${m.h} | ${m.framePct} | ${m.lMin}/${m.lP2}/${m.lP98}/${m.lMax} | ${m.pctBelow35} | ${m.pctAbove75} | ${m.bands.join(' / ')} | ${m.contrastMean} / ${m.contrastMin} | ${m.pctBelow3} | ${m.colours} |`),
      '',
      'Ship criteria (ART-REVIEW.md): L span 15-85 with >= 20 % below L 35 and >= 8 % above L 75; mean contrast >= 3:1 with <= 45 % of body pixels below 3:1.',
      '',
      ...metrics.map((m) => {
        const fails = [];
        if (m.lP2 > 15) fails.push(`dark end ${m.lP2} > 15`);
        if (m.lP98 < 85) fails.push(`light end ${m.lP98} < 85`);
        if (m.pctBelow35 < 20) fails.push(`<L35 ${m.pctBelow35} % < 20`);
        if (m.pctAbove75 < 8) fails.push(`>L75 ${m.pctAbove75} % < 8`);
        if (m.contrastMean < 3) fails.push(`mean contrast ${m.contrastMean} < 3`);
        if (m.pctBelow3 > 45) fails.push(`${m.pctBelow3} % below 3:1 > 45`);
        return `- ${m.id}: ${fails.length ? fails.join('; ') : 'PASS'}`;
      }),
    ].join('\n');
    writeFileSync(`${OUT}/metrics.md`, md);
    console.log(md);
  }
  const actors = only ? [only] : [...HEROES, ...CRYPT, ...MARSH];
  for (const id of actors) {
    await sheet(page, `poses-${id}`, `sheet=poses&mode=color&zoom=3&actor=${id}`);
  }
  await page.close();
}

// --- the game ----------------------------------------------------------------------
async function canvasBox(page) {
  const box = await page.locator('#screen canvas').boundingBox();
  if (!box) throw new Error('no game canvas');
  return box;
}
/** Tap at LOGICAL (1280x720) coordinates whatever the CSS fit. */
async function tap(page, lx, ly, touch) {
  const box = await canvasBox(page);
  const x = box.x + (lx / 1280) * box.width;
  const y = box.y + (ly / 720) * box.height;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
async function frame(page, name) {
  const data = await page.evaluate(() => document.querySelector('#screen canvas').toDataURL('image/png'));
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
async function wait(page, ms) {
  await page.waitForTimeout(ms);
}

async function battle(page, prefix, touch) {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#screen canvas', { state: 'attached', timeout: 15000 });
  await wait(page, 600);
  await frame(page, `${prefix}title`);
  await tap(page, 640, 400, touch); // START (the full-canvas twin)
  await wait(page, 400);
  await frame(page, `${prefix}room-card`);
  await tap(page, 640, 600, touch); // CONTINUE
  await wait(page, 900);
  await frame(page, `${prefix}battle-0`);
  await wait(page, 1500);
  await frame(page, `${prefix}battle-1`);
  // A hero's turn may or may not be up: try skill 1 on enemy 0 a few times and
  // snapshot right after, so at least one frame carries a hit and its VFX.
  for (let i = 0; i < 5; i++) {
    await tap(page, 228, 648, touch); // skill 1
    await wait(page, 120);
    await tap(page, 1116, 148, touch); // enemy panel 0 = target
    await wait(page, 140);
    await frame(page, `${prefix}battle-hit-${i}a`);
    await wait(page, 220);
    await frame(page, `${prefix}battle-hit-${i}b`);
    await wait(page, 900);
  }
  await frame(page, `${prefix}battle-2`);
  // Pause overlay and the inspect overlay.
  await tap(page, 1224, 48, touch); // pause icon
  await wait(page, 300);
  await frame(page, `${prefix}battle-paused`);
  await tap(page, 640, 264, touch); // RESUME
  await wait(page, 300);
  await tap(page, 164, 148, touch); // hero panel 0 -> inspect (outside target mode)
  await wait(page, 300);
  await frame(page, `${prefix}battle-inspect`);
  await tap(page, 1136, 600, touch); // BACK
  await wait(page, 200);
}

if (modes.has('battle')) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  watch(page);
  await battle(page, '', false);
  await page.close();
}
if (modes.has('phone')) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page);
  await battle(page, 'phone-', true);
  // The phone frame as the phone actually shows it (CSS-fitted, chrome-free).
  await page.screenshot({ path: `${OUT}/phone-viewport.png` });
  await ctx.close();
}

if (modes.has('shot') && opts.url) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  watch(page);
  await page.goto(`${BASE}${opts.url}`, { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__lineup && window.__lineup.ready) || window.__ready === true, null, { timeout: 20000 });
  await page.locator(opts.selector || '#sheet').screenshot({ path: `${OUT}/${opts.name || 'shot'}.png` });
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error('CAPTURE saw page errors:');
  for (const e of errors) console.error('  - ' + e);
  process.exitCode = 1;
} else {
  console.log(`CAPTURE OK -> ${OUT}/`);
}
