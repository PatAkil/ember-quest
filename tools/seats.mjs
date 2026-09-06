// tools/seats.mjs — the art loop's IN-SCENE instrument: what an actor's OWN
// pixels read at, at its own seat, in a real driven battle frame. Dev-server
// only (`npm run dev`, or CAPTURE_URL pointing at another port). Writes into
// tools/out/seats/ (gitignored). Run from the repo root.
//
//   node tools/seats.mjs help
//   node tools/seats.mjs drive [seeds=1,4,12,16,20] [marsh=1] [marshseed=7] [frames=9] [gap=110]
//   node tools/seats.mjs measure [tags=s1,s20,marsh]
//   node tools/seats.mjs overlay seed=20 [frame=N]     # or tag=marsh
//   node tools/seats.mjs report [csv=1]
//   node tools/seats.mjs drive measure report          # the whole loop, in order
//
// ============================ THE INSTRUMENT, IN FULL ========================
// (coordinator decision 4 after round 13; decision 3 after round 14. Written
// out here so no critic has to rebuild it from prose again, and no artist
// reports a seat number from a tree whose stage has moved.)
//
// 1. WHAT IS MEASURED. Not "the pixels near an actor" — the actor's OWN cells.
//    A seat reading is a percentile over the frame pixels that the actor's own
//    silhouette covers, and nothing else: no floor, no neighbour, no light pool.
//
// 2. THE MASK is the zoom-1 line-up cell's silhouette. `tools/lineup.html
//    ?sheet=lineup&mode=sil&zoom=1&cols=7` flattens every body pixel of the
//    idle-0 bake to rgb(214,214,220); a cell is CELL*zoom+PAD wide and
//    CELL*zoom+PAD+LABEL_H tall (lineup.ts's own geometry: CELL 100, PAD 8,
//    LABEL_H 18), and the recipe's feet land at (FX, FY) = (cellW/2,
//    cellH-LABEL_H-PAD-2*zoom) = (54, 98) inside it. Mask cells are stored as
//    OFFSETS FROM THE FEET: (px-54, py-98). Same cell geometry, so the colour
//    sheet (`mode=color`) keys by the same offsets: that is the bake's own L*,
//    which the frame choice below correlates against.
//
// 3. EROSION. Only cells whose four 4-neighbours are all in the mask are
//    measured. The one-cell keyline is an outline, not the figure, and at
//    ACTOR_SCALE 2 its device pixels are half-covered by whatever is behind it.
//
// 4. PLANTING. Anchors are READ OUT OF game/screens/layout.ts AT RUNTIME through
//    the dev server (`import('/game/screens/layout.ts')`), never typed into this
//    file: HERO_FEET, ENEMY_FEET, ENEMY_FEET_PAIR (a two-enemy pack), BOSS_FEET
//    (a lone boss), with ACTOR_SCALE from game/art/actors.ts. A mask cell
//    (dx,dy) covers the ACTOR_SCALE x ACTOR_SCALE block at
//    (feet.x + dx*S, feet.y + dy*S); its sample is the MEAN L* of that block.
//    Heroes are drawn facing -1 (mirrored about recipe.feet.x), so for a hero
//    dx -> -dx - 1. The anchors moved in 1df532b (UI round 4) and two rounds of
//    reported numbers were stale because they were carried forward instead:
//    hence "read at runtime", and hence the commit + anchors recorded in every
//    <tag>-scene.json and reprinted by `report`.
//
// 5. THE BANDS. `row` is the cell's row within the silhouette (dy - top).
//      frac  — the FRACTIONAL torso band, rows round(0.33*h) .. round(0.72*h)
//              of the silhouette height h (decision 2 after round 13: headwear
//              must not be able to pass a value ruler by re-registering rows).
//      abs   — the old absolute band, rows 18..40, kept for comparability.
//      whole — every eroded cell.
//    Statistics per band: p50 (nearest-rank: sorted[floor(0.5*(n-1))], one
//    decimal), % below L 35, % above L 75. L* is CIE L* from sRGB relative
//    luminance — the same lin/Y/L* the sheet rulers use.
//
// 6. THE FRAME. The idle cycles three shapes, so a mask baked from idle 0 fits
//    some frames better than others. `drive` dumps nine frames ~110 ms apart;
//    each seat is read on whichever frame maximises the PEARSON r between the
//    bake's own L* and the sampled L* over the eroded cells (r 0.95-0.99 when
//    the mask is registered; 0.45 and below when it is landing on floor). The
//    spread of the other eight is printed beside it, never averaged in.
//
// 7. THE RULES the report checks (ART-REVIEW.md decision 2 after round 13, held
//    by decision 1 after round 14), all read on the FRACTIONAL band:
//      heroes  p50 <= 55 AND >= 12 % of the band below L 35
//      enemies p50 <= 50 (kind NORMAL) / <= 55 (kind ELITE or BOSS)
//    The kind comes from game/data/enemies.ts at runtime, like the anchors.
//
// 8. THE CAVEAT. A driven battle frame is not byte-deterministic (ATB timing,
//    idle phase, particles), so two runs of `drive` at the same commit differ by
//    a few tenths of an L. Agreement within +-0.5 L is a reproduction; the sheet
//    rulers in tools/rulers.mjs are the exact ones.
// =============================================================================

import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.CAPTURE_URL || 'http://localhost:5173';
const OUT = 'tools/out/seats';

const args = process.argv.slice(2);
const opts = {};
const modes = new Set();
for (const a of args) {
  const eq = a.indexOf('=');
  if (eq > 0) opts[a.slice(0, eq)] = a.slice(eq + 1);
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

/** tools/lineup.ts's own cell geometry (CELL_CELLS / PAD / LABEL_H) at zoom 1. */
const CELL = 100, PAD = 8, LABEL_H = 18, COLS = 7, ZOOM = 1;
const CELL_W = CELL * ZOOM + PAD, CELL_H = CELL * ZOOM + PAD + LABEL_H;
const FX = CELL_W / 2, FY = CELL * ZOOM - 2 * ZOOM;

const FRAMES = Number(opts.frames ?? 9);
const GAP = Number(opts.gap ?? 110);

function commit() {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
}

/** Anchors + actor scale + enemy kinds, read out of the real modules through the page. */
async function readContract(page) {
  return page.evaluate(async () => {
    const L = await import('/game/screens/layout.ts');
    const A = await import('/game/art/actors.ts');
    const E = await import('/game/data/enemies.ts');
    const xy = (p) => [p.x, p.y];
    return {
      hero: L.HERO_FEET.map(xy),
      enemy: L.ENEMY_FEET.map(xy),
      pair: L.ENEMY_FEET_PAIR.map(xy),
      boss: [xy(L.BOSS_FEET)],
      scale: A.ACTOR_SCALE,
      kinds: Object.fromEntries(Object.values(E.ENEMIES).map((e) => [e.id, e.kind])),
    };
  });
}

/** The eroded silhouette masks and the bake's own colours, both keyed by feet offsets. */
async function readSheet(page) {
  const geo = { CELL, PAD, LABEL_H, COLS, ZOOM, FX, FY };
  await load(page, `${BASE}/tools/lineup.html?sheet=lineup&mode=sil&zoom=${ZOOM}&cols=${COLS}`);
  const ids = await page.evaluate(() => window.__lineup.metrics.map((m) => m.id));
  const masks = await page.evaluate(({ ids, g }) => {
    const cw = g.CELL * g.ZOOM + g.PAD, ch = g.CELL * g.ZOOM + g.PAD;
    const cellH = ch + g.LABEL_H;
    const cv = document.getElementById('sheet');
    if (cv.width !== g.COLS * cw) throw new Error(`sheet geometry moved: canvas ${cv.width} != ${g.COLS * cw}`);
    const s = cv.getContext('2d', { willReadFrequently: true });
    const out = {};
    ids.forEach((id, idx) => {
      const cx0 = (idx % g.COLS) * cw, cy0 = ((idx / g.COLS) | 0) * cellH;
      const d = s.getImageData(cx0, cy0, cw, ch).data;
      const cells = []; let y0 = 1e9, y1 = -1, x0 = 1e9, x1 = -1;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4;
        if (d[i] === 214 && d[i + 1] === 214 && d[i + 2] === 220) {
          cells.push([x - g.FX, y - g.FY]);
          if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
        }
      }
      out[id] = { cells, w: x1 - x0 + 1, h: y1 - y0 + 1, top: y0 - g.FY };
    });
    return out;
  }, { ids, g: geo });
  await load(page, `${BASE}/tools/lineup.html?sheet=lineup&mode=color&zoom=${ZOOM}&cols=${COLS}`);
  const sheetPx = await page.evaluate(({ ids, g }) => {
    const cw = g.CELL * g.ZOOM + g.PAD, ch = g.CELL * g.ZOOM + g.PAD;
    const cellH = ch + g.LABEL_H;
    const s = document.getElementById('sheet').getContext('2d', { willReadFrequently: true });
    // the stage navy, and the navy under the row's faint 10 % white ground line
    const bg = (r, gg, b) => (r === 29 && gg === 43 && b === 83) || (r === 52 && gg === 64 && b === 100);
    const out = {};
    ids.forEach((id, idx) => {
      const cx0 = (idx % g.COLS) * cw, cy0 = ((idx / g.COLS) | 0) * cellH;
      const d = s.getImageData(cx0, cy0, cw, ch).data;
      const M = {};
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const i = (y * cw + x) * 4;
        if (bg(d[i], d[i + 1], d[i + 2])) continue;
        M[(x - g.FX) + ',' + (y - g.FY)] = [d[i], d[i + 1], d[i + 2]];
      }
      out[id] = M;
    });
    return out;
  }, { ids, g: geo });
  return { ids, masks, sheetPx };
}

async function load(page, url) {
  let last;
  for (let i = 0; i < 8; i++) {
    try {
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__lineup && window.__lineup.ready, null, { timeout: 25000 });
      return;
    } catch (e) { last = e; await page.waitForTimeout(900); }
  }
  throw last;
}

/** Which anchor array a pack of N draws on. */
const anchorsFor = (C, n) => (n === 1 ? C.boss : n === 2 ? C.pair : C.enemy);

/** [id, slot, feetX, feetY, isHero] for every seat in a roster. */
function seatsOf(meta, C) {
  const eF = anchorsFor(C, meta.enemies.length);
  return [
    ...meta.heroes.map((id, i) => [id, 'hero' + i, C.hero[i][0], C.hero[i][1], true]),
    ...meta.enemies.map((id, i) => [id, 'enemy' + i, eF[i][0], eF[i][1], false]),
  ];
}

// ================================================================== drive ===
// Plays the REAL opening at a seed by tapping contract geometry (no dev
// decide()), stops at the first battle — or at the first battle in a named
// biome — and dumps `frames` frames `gap` ms apart plus the roster.

/**
 * Every tap the driver makes, in LOGICAL 1280x720 coordinates, taken from the
 * screens' own geometry through the dev server — layout.ts's rects and
 * draft.ts's `draftSlotRect` (short rows are centred, so slot 0 of three is not
 * DRAFT_X[0]). The one literal is the vault's ascension arrow, which no module
 * exports as a rect.
 */
const readTaps = (page) => page.evaluate(async () => {
  const L = await import('/game/screens/layout.ts');
  const D = await import('/game/screens/draft.ts');
  const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  return {
    continue: mid(L.CONTINUE),
    partyBack: mid(L.PARTY_BACK),
    epic: mid(D.EPIC_SLOT),
    /** draftSlot[count-1] = the middle of slot 0 in a row of `count`. */
    draftSlot: Array.from({ length: 12 }, (_, n) => mid(D.draftSlotRect(0, n + 1))),
    door: L.DOOR_X.map((x) => [x + L.DOOR_W / 2, L.DOOR_Y + L.DOOR_H / 2]),
    wear: L.WEAR_X.map((x) => [x + L.WEAR_BTN.w / 2, L.WEAR_Y + L.WEAR_BTN.h / 2]),
    card: [L.CARD_X[1] + L.CARD_W / 2, L.CARD_Y + 220],
    /** map node centres by [stage][row]. */
    map: Array.from({ length: 8 }, (_, s) => [0, 1, 2].map((r) => [L.mapX(s) + L.MAP_NODE / 2, L.mapY(r) + L.MAP_NODE / 2])),
    skill: [0, 1, 2].map((i) => mid(L.skillRowRect(i, false))),
    ascendUp: [400, 600],
  };
});

async function drive(browser, C, seed, tag, wantBiome) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const url = seed ? `${BASE}/?seed=${seed}` : `${BASE}/`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#screen canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => typeof window.__eq === 'object' && window.__eq !== null, null, { timeout: 15000 });
  await page.waitForTimeout(700);
  const T = await readTaps(page);
  const box = await page.evaluate(() => {
    const r = document.querySelector('#screen canvas').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const tap = (lx, ly) => page.mouse.click(box.x + (lx / 1280) * box.w, box.y + (ly / 720) * box.h);
  const tapAt = (xy) => tap(xy[0], xy[1]);
  /** A stage's offered nodes are drawn centred: 3 fill the rows, 2 take rows 0 and 2, 1 takes row 1. */
  const mapNode = (stage, i) => {
    const SIZES = [2, 3, 1, 3, 2];
    const size = stage >= SIZES.length ? 1 : (SIZES[stage] ?? 1);
    const row = size >= 3 ? i : size === 2 ? i * 2 : 1;
    return T.map[Math.min(T.map.length - 1, stage)][Math.min(2, row)];
  };
  const read = () => page.evaluate(() => {
    const eq = window.__eq; if (!eq) return null;
    const bb = eq.battleObj ? eq.battleObj() : null;
    return {
      scene: eq.scene(), phase: eq.phase ? eq.phase() : null, pending: eq.pending ? eq.pending() : null,
      view: eq.view ? eq.view() : null, battle: eq.battle ? eq.battle() : null,
      heroes: bb ? bb.heroes.map((h) => h.def.id) : null, enemies: bb ? bb.enemies.map((e) => e.def.id) : null,
    };
  });
  const grab = () => page.evaluate(() => document.querySelector('#screen canvas').toDataURL('image/png'));

  let vaultPicked = false, doorK = 0, srow = 0, spin = 0, st = null, ok = false;
  const LIMIT = wantBiome ? 1400 : 120;
  for (let i = 0; i < LIMIT; i++) {
    st = await read(); if (!st) break;
    if (st.scene === 'GAME_OVER' || st.scene === 'WIN') break;
    if (st.scene === 'TITLE') { await tap(640, 400); await page.waitForTimeout(450); continue; }
    if (st.phase === 'BATTLE') {
      const biome = String(st.view && st.view.biome).toUpperCase();
      if (!wantBiome || biome.includes(wantBiome.toUpperCase())) { ok = true; break; }
      // Wrong biome: fight it out. Every enemy is dropped to 1 hp and the party
      // topped up each turn, so a run reaches act 2 in a couple of minutes
      // instead of dying on the way — the biome is what is being sampled, not
      // the combat.
      await page.evaluate(() => {
        const b = window.__eq && window.__eq.battleObj ? window.__eq.battleObj() : null;
        if (!b) return;
        for (const e of b.enemies) if (e.hp > 1) e.hp = 1;
        for (const h of b.heroes) h.hp = h.maxHp ?? h.hp;
      });
      if (st.battle === 'HERO_SKILL') {
        await tapAt(T.skill[srow++ % 3]); await page.waitForTimeout(180);
        if (++spin > 90) break;
      } else if (st.battle === 'HERO_TARGET') {
        const F = anchorsFor(C, (st.enemies || []).length);
        await tap(F[0][0], F[0][1] - 50); await page.waitForTimeout(240); spin = 0;
      } else await page.waitForTimeout(300);
      continue;
    }
    const p = st.pending ?? {};
    const slot0 = (count) => T.draftSlot[Math.max(0, Math.min(11, (count || 1) - 1))];
    switch (st.phase) {
      case 'PRE_VAULT':
        if (!vaultPicked && (p.options ?? 0) > 0 && (p.slots ?? 0) > 0) {
          vaultPicked = true; await tapAt(slot0(p.options)); await page.waitForTimeout(220);
          await tapAt(T.ascendUp); await page.waitForTimeout(200);
        }
        await tapAt(T.continue); await page.waitForTimeout(450); break;
      case 'DRAFT': await tapAt(slot0(p.options ?? 6)); await page.waitForTimeout(220); await tapAt(T.continue); await page.waitForTimeout(380); break;
      case 'SUMMON': await tapAt(p.full ? T.epic : slot0(p.options ?? 3)); await page.waitForTimeout(220); await tapAt(T.continue); await page.waitForTimeout(380); break;
      case 'LEADER': case 'PARTY': await tapAt(T.partyBack); await page.waitForTimeout(320); break;
      case 'ROUTE': { const idxs = p.offeredIdxs ?? [0]; await tapAt(mapNode(p.stage ?? 0, idxs[0] ?? 0)); await page.waitForTimeout(420); break; }
      case 'ROOM': await tapAt(T.continue); await page.waitForTimeout(420); break;
      case 'DOORS': case 'LAP': await tapAt(T.door[(doorK++) % 2]); await page.waitForTimeout(420); break;
      case 'CARDS': await tapAt(T.card); await page.waitForTimeout(260); await tapAt(T.wear[3]); await page.waitForTimeout(260); await tapAt(T.continue); await page.waitForTimeout(360); break;
      case 'WEAR': await tapAt(T.wear[0]); await page.waitForTimeout(260); await tapAt(T.continue); await page.waitForTimeout(360); break;
      default: await tapAt(T.continue); await page.waitForTimeout(380); break;
    }
  }
  if (!ok) {
    console.log(`${tag}: NO BATTLE (seed ${seed || 'default'}) — last ${JSON.stringify(st && { scene: st.scene, phase: st.phase, biome: st.view && st.view.biome })}`);
    await page.close(); return null;
  }
  await page.waitForTimeout(1600);
  const st2 = await read();
  for (let k = 0; k < FRAMES; k++) {
    const u = await grab();
    writeFileSync(`${OUT}/${tag}-f${k}.png`, Buffer.from(u.split(',')[1], 'base64'));
    await page.waitForTimeout(GAP);
  }
  const meta = {
    seed: String(seed ?? ''), tag, commit: commit(), heroes: st2.heroes, enemies: st2.enemies,
    biome: st2.view && st2.view.biome, frames: FRAMES, gapMs: GAP,
    anchors: { hero: C.hero, enemy: C.enemy, pair: C.pair, boss: C.boss, scale: C.scale },
  };
  writeFileSync(`${OUT}/${tag}-scene.json`, JSON.stringify(meta, null, 1));
  console.log(`${tag}: seed ${seed || 'default'}  ${meta.biome}  heroes ${meta.heroes.join(',')}  enemies ${meta.enemies.join(',')}`);
  await page.close();
  return meta;
}

// ================================================================ measure ===

const MEASURE = async ({ datas, PLACE, masks, sheetPx, S }) => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const Yof = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const Lof = (Y) => (Y <= 0.008856 ? 903.3 * Y : 116 * Math.cbrt(Y) - 16);
  const imgs = [];
  for (const data of datas) {
    const im = new Image();
    await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = data; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    imgs.push({ D: g.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height });
  }
  const q = (a, t) => (a.length ? Math.round(a[Math.floor(t * (a.length - 1))] * 10) / 10 : 0);
  const pc = (k, n) => Math.round((1000 * k) / Math.max(1, n)) / 10;
  const out = [];
  for (const [id, slot, fx, fy, isHero] of PLACE) {
    const m = masks[id];
    const set = new Set(m.cells.map(([dx, dy]) => dx + ',' + dy));
    const inner = (dx, dy) => set.has((dx - 1) + ',' + dy) && set.has((dx + 1) + ',' + dy) && set.has(dx + ',' + (dy - 1)) && set.has(dx + ',' + (dy + 1));
    const fr0 = Math.round(0.33 * m.h), fr1 = Math.round(0.72 * m.h);
    const per = [];
    for (const img of imgs) {
      const rows = [];
      for (const [dx, dy] of m.cells) {
        if (!inner(dx, dy)) continue;
        const row = dy - m.top;
        const sp = sheetPx[id][dx + ',' + dy]; if (!sp) continue;
        const sL = Lof(Yof(sp[0], sp[1], sp[2]));
        const sx0 = isHero ? (-dx - 1) : dx;
        let acc = 0, n = 0;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
          const X = fx + sx0 * S + sx, Y2 = fy + dy * S + sy;
          if (X < 0 || Y2 < 0 || X >= img.W || Y2 >= img.H) continue;
          const k = (Y2 * img.W + X) * 4;
          acc += Lof(Yof(img.D[k], img.D[k + 1], img.D[k + 2])); n++;
        }
        if (!n) continue;
        rows.push([row, sL, acc / n]);
      }
      const n = rows.length;
      let sa = 0, sb = 0; for (const r of rows) { sa += r[1]; sb += r[2]; }
      const ma = sa / n, mb = sb / n;
      let num = 0, da = 0, db = 0;
      for (const r of rows) { const A = r[1] - ma, B = r[2] - mb; num += A * B; da += A * A; db += B * B; }
      const rP = num / Math.sqrt(da * db || 1);
      const stat = (r0, r1) => {
        const L = rows.filter((r) => r0 == null || (r[0] >= r0 && r[0] <= r1)).map((r) => r[2]).sort((x, y) => x - y);
        return { n: L.length, p50: q(L, 0.5), b35: pc(L.filter((v) => v < 35).length, L.length), a75: pc(L.filter((v) => v > 75).length, L.length) };
      };
      per.push({ r: +rP.toFixed(4), frac: stat(fr0, fr1), abs: stat(18, 40), whole: stat(null, null) });
    }
    const best = per.reduce((a, c) => (c.r > a.r ? c : a), per[0]);
    const sheetStat = (r0, r1) => {
      const L = [];
      for (const [dx, dy] of m.cells) {
        if (!inner(dx, dy)) continue;
        const row = dy - m.top;
        if (r0 != null && (row < r0 || row > r1)) continue;
        const sp = sheetPx[id][dx + ',' + dy]; if (!sp) continue;
        L.push(Lof(Yof(sp[0], sp[1], sp[2])));
      }
      L.sort((a, b) => a - b);
      return { n: L.length, p50: q(L, 0.5), b35: pc(L.filter((v) => v < 35).length, L.length) };
    };
    out.push({
      id, slot, isHero, h: m.h, fr: [fr0, fr1], bestFrame: per.indexOf(best), best,
      rs: per.map((p) => p.r), fracAll: per.map((p) => p.frac.p50), absAll: per.map((p) => p.abs.p50),
      wholeAll: per.map((p) => p.whole.p50), sheetFrac: sheetStat(fr0, fr1), sheetAbs: sheetStat(18, 40),
      sheetWhole: sheetStat(null, null),
    });
  }
  return out;
};

function savedTags() {
  return readdirSync(OUT).filter((f) => f.endsWith('-scene.json')).map((f) => f.replace('-scene.json', ''))
    .sort((a, b) => (Number(a.replace(/\D/g, '')) || 1e9) - (Number(b.replace(/\D/g, '')) || 1e9));
}

async function measure(browser, C) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const { masks, sheetPx } = await readSheet(page);
  const tags = (opts.tags ? opts.tags.split(',') : savedTags()).filter((t) => existsSync(`${OUT}/${t}-scene.json`));
  const all = {};
  for (const tag of tags) {
    const meta = JSON.parse(readFileSync(`${OUT}/${tag}-scene.json`, 'utf8'));
    const datas = [];
    for (let k = 0; k < 32; k++) {
      const f = `${OUT}/${tag}-f${k}.png`;
      if (!existsSync(f)) break;
      datas.push('data:image/png;base64,' + readFileSync(f).toString('base64'));
    }
    if (!datas.length) { console.log(`${tag}: no frames`); continue; }
    const PLACE = seatsOf(meta, C);
    const rows = await page.evaluate(MEASURE, { datas, PLACE, masks, sheetPx, S: C.scale });
    for (const r of rows) if (!r.isHero) r.kind = C.kinds[r.id] || 'NORMAL';
    all[tag] = { meta, rows };
    process.stderr.write(`.`);
  }
  process.stderr.write('\n');
  const stale = Object.values(all).filter((a) => a.meta.anchors && JSON.stringify(a.meta.anchors.hero) !== JSON.stringify(C.hero));
  writeFileSync(`${OUT}/seats.json`, JSON.stringify({ commit: commit(), anchors: { hero: C.hero, enemy: C.enemy, pair: C.pair, boss: C.boss, scale: C.scale }, tags: all }, null, 1));
  if (stale.length) console.log(`WARNING: ${stale.length} tag(s) were driven at different anchors than layout.ts now holds — re-drive them.`);
  await page.close();
  return all;
}

// ================================================================ overlay ===

async function overlay(browser, C) {
  const tag = opts.tag || (opts.seed ? (/^\d+$/.test(opts.seed) ? 's' + opts.seed : opts.seed) : savedTags()[0]);
  const fi = Number(opts.frame ?? 0);
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  const { masks } = await readSheet(page);
  const meta = JSON.parse(readFileSync(`${OUT}/${tag}-scene.json`, 'utf8'));
  const data = 'data:image/png;base64,' + readFileSync(`${OUT}/${tag}-f${fi}.png`).toString('base64');
  const PLACE = seatsOf(meta, C);
  const png = await page.evaluate(async ({ data, PLACE, masks, S }) => {
    const im = new Image();
    await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = data; });
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
    for (const [id, , fx, fy, isHero] of PLACE) {
      const m = masks[id];
      const set = new Set(m.cells.map(([dx, dy]) => dx + ',' + dy));
      const inner = (dx, dy) => set.has((dx - 1) + ',' + dy) && set.has((dx + 1) + ',' + dy) && set.has(dx + ',' + (dy - 1)) && set.has(dx + ',' + (dy + 1));
      const fr0 = Math.round(0.33 * m.h), fr1 = Math.round(0.72 * m.h);
      for (const [dx, dy] of m.cells) {
        if (!inner(dx, dy)) continue;
        const row = dy - m.top;
        g.fillStyle = row >= fr0 && row <= fr1 ? 'rgba(255,0,220,0.55)' : 'rgba(0,220,255,0.16)';
        const sx0 = isHero ? (-dx - 1) : dx;
        g.fillRect(fx + sx0 * S, fy + dy * S, S, S);
      }
    }
    return c.toDataURL('image/png');
  }, { data, PLACE, masks, S: C.scale });
  writeFileSync(`${OUT}/ov-${tag}.png`, Buffer.from(png.split(',')[1], 'base64'));
  console.log(`wrote ${OUT}/ov-${tag}.png  frame ${fi}  ${PLACE.map((p) => p[0]).join(' ')}`);
  console.log('magenta = the fractional torso band, cyan = the rest of the eroded mask. It must land on every torso, heroes mirrored.');
  await page.close();
}

// ================================================================= report ===

function report() {
  const file = `${OUT}/seats.json`;
  if (!existsSync(file)) { console.log(`no ${file} — run \`node tools/seats.mjs measure\` first`); return; }
  const J = JSON.parse(readFileSync(file, 'utf8'));
  const P = (s, n = 16) => String(s).padEnd(n), R = (s, n = 8) => String(s).padStart(n);
  console.log(`in-scene seats — commit ${J.commit}, anchors from game/screens/layout.ts:`);
  console.log(`  HERO_FEET ${J.anchors.hero.map((p) => '(' + p + ')').join(' ')}   ACTOR_SCALE ${J.anchors.scale}`);
  console.log(`  ENEMY_FEET ${J.anchors.enemy.map((p) => '(' + p + ')').join(' ')}  PAIR ${J.anchors.pair.map((p) => '(' + p + ')').join(' ')}  BOSS (${J.anchors.boss[0]})`);
  console.log('');
  console.log(P('actor') + R('tag', 7) + R('slot', 7) + R('r') + R('shFrac') + R('sh<35') + R('FRAC50') + R('f<35') + R('ABS50') + R('WHOLE50') + '   frac p50 across frames');
  const rows = [];
  for (const [tag, { rows: rs }] of Object.entries(J.tags)) for (const r of rs) {
    rows.push({ tag, ...r });
    console.log(P(r.id) + R(tag, 7) + R(r.slot, 7) + R(r.best.r.toFixed(2)) + R(r.sheetFrac.p50) + R(r.sheetFrac.b35)
      + R(r.best.frac.p50) + R(r.best.frac.b35) + R(r.best.abs.p50) + R(r.best.whole.p50) + '   ' + r.fracAll.join(' '));
  }
  if (opts.csv) {
    writeFileSync(`${OUT}/seats.csv`, ['tag,slot,actor,kind,r,frac_p50,frac_below35,abs_p50,whole_p50,sheet_frac_p50',
      ...rows.map((r) => [r.tag, r.slot, r.id, r.kind || 'HERO', r.best.r, r.best.frac.p50, r.best.frac.b35, r.best.abs.p50, r.best.whole.p50, r.sheetFrac.p50].join(','))].join('\n'));
    console.log(`\nwrote ${OUT}/seats.csv`);
  }
  const heroes = rows.filter((r) => r.isHero), enemies = rows.filter((r) => !r.isHero);
  const lo = (a, k) => Math.min(...a.map(k)), hi = (a, k) => Math.max(...a.map(k));
  const who = (a, k, v) => (a.find((r) => k(r) === v) || {}).id;
  console.log('\n--- the rules, read on the FRACTIONAL band (rows 0.33-0.72 of the silhouette) ---');
  if (heroes.length) {
    const mx = hi(heroes, (r) => r.best.frac.p50), mn = lo(heroes, (r) => r.best.frac.p50);
    console.log(`heroes  ${heroes.length} seats: band ${mn} .. ${mx} (max ${who(heroes, (r) => r.best.frac.p50, mx)}), < L 35 ${lo(heroes, (r) => r.best.frac.b35)} .. ${hi(heroes, (r) => r.best.frac.b35)} %   bar <= 55 with >= 12 % below L 35`);
    const bad = heroes.filter((r) => r.best.frac.p50 > 55 || r.best.frac.b35 < 12);
    console.log(`  ${bad.length ? 'FAIL ' + bad.map((r) => `${r.id} ${r.tag} ${r.slot} ${r.best.frac.p50}/${r.best.frac.b35} %`).join(', ') : 'PASS — no hero seat over 55, none under 12 % below L 35'}`);
  }
  if (enemies.length) {
    const cap = (r) => (r.kind === 'ELITE' || r.kind === 'BOSS' ? 55 : 50);
    const over = enemies.filter((r) => r.best.frac.p50 > cap(r));
    console.log(`enemies ${enemies.length} seats: band ${lo(enemies, (r) => r.best.frac.p50)} .. ${hi(enemies, (r) => r.best.frac.p50)}   bar <= 50 NORMAL / <= 55 ELITE|BOSS`);
    console.log(`  ${over.length ? `FAIL at ${over.length} of ${enemies.length} enemy seats: ` + over.map((r) => `${r.id} ${r.tag} ${r.slot} ${r.best.frac.p50} (cap ${cap(r)})`).join(', ') : 'PASS — every enemy seat inside its ceiling'}`);
  }
  const weak = rows.filter((r) => r.best.r < 0.9);
  console.log(`\nregistration: Pearson r ${lo(rows, (r) => r.best.r).toFixed(2)} .. ${hi(rows, (r) => r.best.r).toFixed(2)}${weak.length ? ` — ${weak.length} seat(s) under 0.90, the mask may be landing off the figure: ${weak.map((r) => r.id + ' ' + r.tag).join(', ')}` : ' — every mask registered on its figure'}`);
  console.log('a driven battle frame is not byte-deterministic: +-0.5 L between runs at one commit is agreement, not a change.');
}

// =================================================================== main ===

const wantDrive = modes.has('drive'), wantMeasure = modes.has('measure'), wantOverlay = modes.has('overlay');
const wantReport = modes.has('report');
if (wantDrive || wantMeasure || wantOverlay) {
  const browser = await chromium.launch();
  const probe = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await probe.goto(`${BASE}/tools/lineup.html?sheet=lineup&mode=sil&zoom=1&cols=7`, { waitUntil: 'load' }).catch(() => {});
  const C = await readContract(probe);
  await probe.close();
  if (wantDrive) {
    const seeds = String(opts.seeds ?? '1,4,12,16,20').split(',').filter(Boolean);
    for (const s of seeds) await drive(browser, C, s, 's' + s, '');
    if (opts.marsh && opts.marsh !== '0') await drive(browser, C, String(opts.marshseed ?? 7), 'marsh', 'FROST');
  }
  if (wantMeasure) await measure(browser, C);
  if (wantOverlay) await overlay(browser, C);
  await browser.close();
}
if (wantReport) report();
