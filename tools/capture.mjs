// tools/capture.mjs — screenshots for the art loop. Needs the dev server up
// (`npm run dev`, port 5173, or CAPTURE_URL pointing at another one). Writes
// into tools/out/ (gitignored).
//
//   node tools/capture.mjs                 # sheets + battle
//   node tools/capture.mjs sheets          # line-ups (colour/grey/silhouette, x2 and x4) + every actor's pose sheet + metrics
//   node tools/capture.mjs sheets actor=EMBER   # one actor's pose sheet only
//   node tools/capture.mjs battle          # title, the opening (draft/summon/leader/map), a room card,
//                                          # battle frames, a hit, pause, inspect
//   node tools/capture.mjs phone           # the same battle frames on a phone viewport (touch)
//   node tools/capture.mjs playfull [acts=1] [phone=1] [ko=1] [seed=7]
//                                          # A WHOLE ACT, played through the real screens. The driver reads
//                                          # window.__eq.phase() / .pending() / .view() to know WHAT is up and
//                                          # then acts by TAPPING CONTRACT GEOMETRY — never a dev decide() — so
//                                          # what it proves is that every screen is reachable and answerable by
//                                          # a player, not that the seam works. It writes playfull-*.png for
//                                          # every distinct screen it passes (vault equip, draft, summon,
//                                          # leader, map, pause, party, each room card, battle, cards, wear,
//                                          # shrine/forge/altar/rest, doors, bank, the end screen), a verdict
//                                          # line — PLAYFULL OK only when `acts` acts were cleared (or the run
//                                          # was won, or ko=1 asked for the death that ended it); PLAYFULL
//                                          # ENDED with the act and room, and a non-zero exit, when the party
//                                          # died instead; PLAYFULL STALLED on a budget overrun — and
//                                          # playfull-decisions.json — the seed plus every answer given, which
//                                          # is what replays a failure headlessly.
//                                          # acts=1 stops at the act-1 clear; phone=1 runs the same loop on a
//                                          # touch phone (844x390, dpr 3) -> phone-playfull-*.png; ko=1 drops
//                                          # the last hero to 1 hp inside the first battle and lets the next
//                                          # enemy hit DEAL the KO, so a real DEATH plays: three frames go to
//                                          # the shake, the wipe and the dead pose. 16 minutes of budget per act.
//   node tools/capture.mjs play            # the phase-4 slice driver retired with the slice: `play` is an
//                                          # alias for `playfull acts=1` (skip=… no longer applies).
//   node tools/capture.mjs shot url=/tools/vfx.html?skill=CINDER name=vfx-CINDER [selector=#sheet] [phone=1]
//                                          # any dev page that sets window.__lineup.ready (or window.__ready) -> tools/out/<name>.png
//                                          # phone=1 shoots it on the phone viewport (844x390, dpr 3)
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
// The phase-4 slice run is gone (screens/run.ts is an adapter over the real
// seam now) and with it the loop `play` drove: one hard-coded five-room ladder
// whose every screen was a card. The name survives as the alias the docs and
// muscle memory expect.
if (modes.has('play')) { modes.delete('play'); modes.add('playfull'); }

const PHONE_VIEWPORT = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

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
  // A hot reload from a concurrent save destroys the page context mid-capture: retry the whole sheet.
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await page.goto(`${BASE}/tools/lineup.html?${query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__lineup && window.__lineup.ready, null, { timeout: 20000 });
      await page.locator('#sheet').screenshot({ path: `${OUT}/${name}.png` });
      return await page.evaluate(() => window.__lineup.metrics);
    } catch (e) {
      last = e;
      await page.waitForTimeout(800);
    }
  }
  throw last;
}

if (modes.has('sheets')) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  watch(page);
  const only = opts.actor;
  if (!only) {
    const metrics = await sheet(page, 'lineup-x2', 'sheet=lineup&mode=color&zoom=2');
    const humanoids = new Set(await page.evaluate(() => window.__lineup.humanoids));
    await sheet(page, 'lineup-x2-grey', 'sheet=lineup&mode=grey&zoom=2');
    await sheet(page, 'lineup-x2-sil', 'sheet=lineup&mode=sil&zoom=2');
    await sheet(page, 'lineup-heroes-x4', `sheet=lineup&mode=color&zoom=4&cols=3&group=${HEROES.join(',')}`);
    await sheet(page, 'lineup-crypt-x4', `sheet=lineup&mode=color&zoom=4&cols=3&group=${CRYPT.join(',')}`);
    await sheet(page, 'lineup-marsh-x4', `sheet=lineup&mode=color&zoom=4&cols=4&group=${MARSH.join(',')}`);
    await sheet(page, 'lineup-heroes-x4-grey', `sheet=lineup&mode=grey&zoom=4&cols=3&group=${HEROES.join(',')}`);
    await sheet(page, 'lineup-enemies-x4-grey', `sheet=lineup&mode=grey&zoom=4&cols=5&group=${[...CRYPT, ...MARSH].join(',')}`);
    writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
    const md = [
      '| actor | px | w×h | frame % | L* min/p2/p98/max | <L35 % | interior <L35 % | >L75 % | top / bottom L* (Δ) | bands 0-15/15-35/35-55/55-75/75+ | contrast mean / min | <3:1 % | colours | mirror IoU % | nearest silhouette (IoU %) |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...metrics.map((m) => `| ${m.id} | ${m.pixels} | ${m.w}×${m.h} | ${m.framePct} | ${m.lMin}/${m.lP2}/${m.lP98}/${m.lMax} | ${m.pctBelow35} | ${m.pctBelow35Interior} | ${m.pctAbove75} | ${m.topL} / ${m.bottomL} (${m.litDelta}) | ${m.bands.join(' / ')} | ${m.contrastMean} / ${m.contrastMin} | ${m.pctBelow3} | ${m.colours} | ${m.mirrorIoU} | ${m.nearest} (${m.nearestIoU}) |`),
      '',
      'Ship criteria (ART-REVIEW.md), measured in CIE L*: span 15-85 with >= 20 % below L 35 (>= 20 % of INTERIOR pixels too — a keyline is not an anchor) and >= 8 % above L 75; the top quarter >= 8 L* lighter than the bottom (lit from above); mean contrast >= 3:1 with <= 45 % of body pixels below 3:1; a humanoid with a stance has a mirror IoU under 85 %; no two silhouettes overlap above 78 % (feet-aligned, centred).',
      '',
      ...metrics.map((m) => {
        const fails = [];
        if (m.lP2 > 15) fails.push(`dark end ${m.lP2} > 15`);
        if (m.lP98 < 85) fails.push(`light end ${m.lP98} < 85`);
        if (m.pctBelow35 < 20) fails.push(`<L35 ${m.pctBelow35} % < 20`);
        if (m.pctBelow35Interior < 20) fails.push(`interior <L35 ${m.pctBelow35Interior} % < 20`);
        if (m.pctAbove75 < 8) fails.push(`>L75 ${m.pctAbove75} % < 8`);
        if (m.litDelta < 8) fails.push(`top-bottom ΔL* ${m.litDelta} < 8 (flat or bottom-lit)`);
        if (m.contrastMean < 3) fails.push(`mean contrast ${m.contrastMean} < 3`);
        if (m.pctBelow3 > 45) fails.push(`${m.pctBelow3} % below 3:1 > 45`);
        if (humanoids.has(m.id) && m.mirrorIoU > 85) fails.push(`mirror IoU ${m.mirrorIoU} % > 85 (no stance)`);
        if (m.nearestIoU > 78) fails.push(`silhouette ${m.nearestIoU} % of ${m.nearest} > 78`);
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

// --- the contract's geometry, mirrored (game/screens/layout.ts, plus the
// phase-5 screens' own `// promote to layout.ts` constants) -------------------
// The driver below NEVER calls a dev decide(): every answer it gives is a tap
// at one of these rects, so a screen that draws its button somewhere else, or
// registers it disabled, stalls the run and the mode fails. That is the point.
const ENEMY_FEET = [[230, 380], [330, 448], [430, 516]];
const ENEMY_FEET_PAIR = [[206, 400], [452, 504]];
const BOSS_FEET = [322, 490];
/** Where to tap enemy `i` of a pack of `count` — the sprite's own hurtbox, ~50 px above the feet. */
function enemyTap(count, i) {
  const f = count === 1 ? BOSS_FEET : count === 2 ? (ENEMY_FEET_PAIR[i] ?? ENEMY_FEET_PAIR[0]) : (ENEMY_FEET[i] ?? ENEMY_FEET[0]);
  return [f[0], f[1] - 50];
}
/**
 * Command row `i`, x 24-344. Rows are 40 tall stacked up from y 672 on a
 * desktop and 56 tall stacked up from y 680 on a phone (layout.ts's
 * skillRowRect), with an 8-px gap either way. Without the phone branch every
 * tap landed in a gutter — skillTap(0) = (184, 556) sits between phone row 1
 * (496-552) and row 2 (560-616) — and the run spun forever on a cooldown.
 */
function skillTap(i, phone) {
  const h = phone ? 56 : 40;
  const bottom = phone ? 680 : 672;
  return [184, bottom - h - (2 - i) * (h + 8) + Math.round(h / 2)];
}
/** Hero panel `i`: the one panel column, now on the party's own side (x 976-1256). */
function heroPanelTap(i) {
  return [1116, [148, 264, 380][i]];
}
/** CONTINUE / SKIP / WALK PAST / FULL HEAL — one seat, (448, 552, 384, 96). */
const CONTINUE_TAP = [640, 600];
/** WEAR_BTN 280x96 at WEAR_X 40/344/648/952, y 552 — the wear row, the FORGE's modes, the ascension stepper. */
const WEAR_TAP = [[180, 600], [484, 600], [788, 600], [1092, 600]];
/** PARTY_SWAP / PARTY_LEADER / PARTY_BACK share those seats: 0, 1 and 3. */
const PARTY_BACK_TAP = WEAR_TAP[3];
/** The pause icon's hit rect, (1176, 0, 96, 96). */
const PAUSE_TAP = [1224, 48];
/** dimScene's three PAUSE_BTN 400x96 at x 440, y 216/336/456. */
const PAUSE_BTN_TAP = [[640, 264], [640, 384], [640, 504]];
/** The card slots: CARD_W 384 at CARD_X 40/448/856, CARD_Y 88, h 440. */
const CARD_X = [40, 448, 856];
const CARD_MID_TAP = [CARD_X[1] + 192, 88 + 220];
const CARD_ROW_Y = 308;
/** DRAFT_CARD 284x136 at DRAFT_X 48/348/648/948, DRAFT_Y 88/240/392 — the draft grid, and the Vault's chips. */
const DRAFT_X = [48, 348, 648, 948];
const DRAFT_Y = [88, 240, 392];
/** draft.ts's `draftSlotRect`: row-major over the four columns at `DRAFT_PITCH = 300`, a short row centred on the CANVAS. */
const DRAFT_PITCH = DRAFT_X[1] - DRAFT_X[0];
function draftSlotTap(k, count) {
  const row = Math.min(2, Math.floor(k / 4));
  const inRow = Math.max(1, Math.min(4, count - row * 4));
  const span = inRow * 284 + (inRow - 1) * (DRAFT_PITCH - 284);
  const start = Math.round((1280 - span) / 2);
  return [start + (k % 4) * DRAFT_PITCH + 142, DRAFT_Y[row] + 68];
}
/** The EPIC's own seat on a full SUMMON: the fourth column of the top row. */
const EPIC_TAP = [DRAFT_X[3] + 142, DRAFT_Y[0] + 68];
/** MAP_NODE 96 at MAP_X = 88 + 208 x stage, MAP_Y = 168 + 144 x row; a short stage is centred over three rows. */
const STAGE_SIZES = [2, 3, 1, 3, 2];
function mapRow(size, i) {
  if (size >= 3) return i;
  if (size === 2) return i * 2;
  return 1;
}
function mapNodeTap(stage, i) {
  const size = stage >= STAGE_SIZES.length ? 1 : (STAGE_SIZES[stage] ?? 1);
  return [88 + 208 * stage + 48, 168 + 144 * mapRow(size, i) + 48];
}
/** PARTY_ROW 64 from y 128 in the card columns, and the whole column (head included) from y 56. */
function partyRowTap(m, row) {
  return [CARD_X[m] + 192, 128 + row * 64 + 32];
}
function partyColTap(m) {
  return [CARD_X[m] + 192, 56 + 228];
}
/** The map band's PARTY button, (936, 24, 216, 96) — the only non-routing target there besides PAUSE. */
const MAP_PARTY_TAP = [1044, 72];
/** The Vault's ascension stepper, one control on the foot row: ASC_DOWN (40, 552, 96, 96), ASC_UP (352, 552, 96, 96). */
const ASC_DOWN_TAP = [88, 600];
const ASC_UP_TAP = [400, 600];
/** DOOR 520x200 at DOOR_X 96/664, DOOR_Y 320 — DESCEND and ANOTHER LAP. */
const DOOR_TAP = [[356, 420], [924, 420]];
/** Card centre x for n offered cards — cards.ts's cardXs: the 3-up/4-up rows verbatim, 1-2 centred. */
function cardCentres(n) {
  if (n >= 4) return [48, 348, 648, 948].map((x) => x + 142);
  if (n === 3) return [40, 448, 856].map((x) => x + 192);
  const gap = 24;
  const total = n * 384 + (n - 1) * gap;
  const start = 640 - total / 2;
  return Array.from({ length: n }, (_, i) => Math.round(start + i * (384 + gap) + 192));
}

/** Tap at LOGICAL (1280x720) coordinates whatever the CSS fit. */
async function tap(page, lx, ly, touch) {
  const box = await canvasBox(page);
  const x = box.x + (lx / 1280) * box.width;
  const y = box.y + (ly / 720) * box.height;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
const tapAt = (page, xy, touch) => tap(page, xy[0], xy[1], touch);
async function frame(page, name) {
  const data = await page.evaluate(() => document.querySelector('#screen canvas').toDataURL('image/png'));
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
async function wait(page, ms) {
  await page.waitForTimeout(ms);
}

// --- the dev state hook ------------------------------------------------------------
// game/main.ts exposes window.__eq in dev builds only: .phase() is the router's
// own key (which screen owns the frame), .pending() a JSON-safe summary of the
// decision the seam is standing on, .view() the run, .node()/.vault() what a
// multi-step screen believes its step is. Everything below reads those and
// answers with taps.
async function eqRead(page) {
  const read = () => page.evaluate(() => ({
    scene: window.__eq.scene(),
    phase: window.__eq.phase ? window.__eq.phase() : null,
    pending: window.__eq.pending ? window.__eq.pending() : null,
    view: window.__eq.view ? window.__eq.view() : null,
    run: window.__eq.run(),
    node: window.__eq.node ? window.__eq.node() : null,
    vault: window.__eq.vault ? window.__eq.vault() : null,
    battle: window.__eq.battle(),
    // Whose turn it is, and just enough of the live sim Battle to act on it (cooldowns, who is still
    // alive) without shipping the whole heroes/enemies/log payload across the bridge on every poll.
    actor: window.__eq.battleActor ? window.__eq.battleActor() : null,
    tactics: window.__eq.battleObj ? (() => {
      const b = window.__eq.battleObj();
      if (!b) return null;
      // SILENCE is why cooldowns alone are not legality: sim/battle.ts's
      // isSkillLegal() blocks every slot ABOVE 0 while a hero is silenced, so a
      // driver that picks by cooldown taps a disabled row and spins there for
      // the rest of the run. Slot 0 is always legal, so the flag is enough.
      return {
        heroIds: b.heroes.map((h) => h.def.id),
        heroCooldowns: b.heroes.map((h) => h.cooldowns),
        heroSilenced: b.heroes.map((h) => h.statuses.some((st) => st.kind === 'SILENCE')),
        heroAlive: b.heroes.map((h) => h.alive),
        enemiesAlive: b.enemies.map((e) => e.alive),
      };
    })() : null,
  }));
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await read();
    } catch {
      // A hot reload while another writer saves destroys the context mid-poll: re-attach.
      await page.waitForFunction(() => typeof window.__eq === 'object' && window.__eq !== null, null, { timeout: 20000 });
      await wait(page, 600);
    }
  }
  return null;
}

/** The mutable state one drive carries: what it has shot, what it has already done once, and the battle back-off. */
function newDriver(o = {}) {
  return {
    touch: !!o.touch,
    phone: !!o.phone,
    prefix: o.prefix ?? '',
    ko: !!o.ko,
    shoot: o.shoot ?? false,
    shot: new Set(),
    log: [],
    shrineTaken: false,
    vaultPicked: false,
    /** The two one-shot detours off the first map: PAUSE, then the party overlay. */
    pausedOnce: false,
    partyOnce: false,
    koForced: false,
    koDead: false,
    skillTurn: 0,
    /**
     * The battle back-off, keyed to a TURN and not to an actor. The old version
     * compared `s.actor` (a hero id) against the last HERO_SKILL poll and never
     * reset on a committed turn, so several polls inside one slow turn — or two
     * consecutive turns by the same fast hero — both read as "stuck" and walked
     * the skill slot down to 0. On a phone (dpr 3, a slower frame) many more
     * polls fall inside one turn, so the same run played differently there than
     * on a desktop. `turnSerial` ticks over whenever the battle phase LEAVES the
     * hero's half of a turn (HERO_SKILL / HERO_TARGET -> anything else), which
     * is exactly "a turn was committed", and the key is `${turnSerial}:${actor}`.
     */
    turnSerial: 0,
    prevBattlePhase: null,
    lastSkillKey: '',
    stuckSkill: 0,
  };
}

/** Keeps the turn identity the battle back-off is keyed to. Call once per poll. */
function noteBattlePhase(d, s) {
  const inHeroHalf = (ph) => ph === 'HERO_SKILL' || ph === 'HERO_TARGET';
  if (inHeroHalf(d.prevBattlePhase) && !inHeroHalf(s.battle)) d.turnSerial += 1;
  d.prevBattlePhase = s.battle;
}

/** One frame per distinct screen, at most once, after a settle delay. */
async function once(page, d, name, ms = 0) {
  if (!d.shoot || d.shot.has(name)) return;
  d.shot.add(name);
  if (ms) await wait(page, ms);
  await frame(page, `${d.prefix}${name}`);
}

/** The battle half of a step: pick a skill, pick a target, or wait out the playback. */
async function stepBattle(page, d, s) {
  if (s.battle === 'HERO_SKILL') {
    // Cooldown-aware so a tanky boss (Hollow King: ~4-5x a normal enemy's HP) actually gets cleared
    // within the deadline instead of repeatedly tapping a disabled (on-cooldown) button: prefer the
    // strongest legal skill (highest index) for every hero except a healer, whose other two slots would
    // stall the kill. The roster is not fixed any more (you draft it), so a hero's slot in the party
    // comes from the live battle rather than a hard-coded order.
    const ids = s.tactics?.heroIds ?? [];
    const heroIdx = ids.indexOf(s.actor);
    let slot = d.skillTurn++ % 3; // no tactics this poll (a mid-poll race): fall back to cycling
    const cds = s.tactics?.heroCooldowns?.[heroIdx];
    const silenced = s.tactics?.heroSilenced?.[heroIdx] === true;
    if (cds) {
      slot = 0;
      if (!silenced && s.actor !== 'TIDE') for (let k = 2; k >= 0; k--) if (cds[k] === 0) { slot = k; break; }
    }
    // ...and a belt to the braces: if THIS TURN has not moved on since the last
    // poll, step DOWN toward slot 0 (always legal) rather than tapping the same
    // disabled row until the deadline. It resets the moment a turn commits.
    const key = `${d.turnSerial}:${s.actor}`;
    if (key === d.lastSkillKey) d.stuckSkill += 1;
    else { d.lastSkillKey = key; d.stuckSkill = 0; }
    if (d.stuckSkill > 0) slot = Math.max(0, slot - d.stuckSkill);
    await tap(page, ...skillTap(slot, d.phone), d.touch); // an illegal skill is a disabled region: a no-op
    await wait(page, 220);
    return;
  }
  if (s.battle === 'HERO_TARGET') {
    // The first LIVING enemy, not a blind cycle — a dead enemy is not a target (a no-op), and with
    // 1-2 enemies already down a blind 3-way cycle wastes most of its taps on corpses.
    const alive = s.tactics?.enemiesAlive;
    const count = alive ? alive.length : 3;
    const idx = alive ? alive.findIndex((a) => a) : 0;
    await tapAt(page, enemyTap(count, idx < 0 ? 0 : idx), d.touch);
    await wait(page, 260);
    return;
  }
  // The enemy's half of the turn is where a forced KO lands, so the wait for it
  // is where the death is watched for — at 30 ms, not at the poll's 160.
  if (d.ko && d.koForced && !d.koDead) {
    for (let k = 0; k < 6; k++) {
      await wait(page, 30);
      const down = await page.evaluate(() => {
        const b = window.__eq.battleObj();
        return !!b && b.heroes.some((h) => !h.alive);
      }).catch(() => false);
      if (down) { await deathFrames(page, d); return; }
    }
    return;
  }
  await wait(page, 160);
}

/**
 * The three frames of a death, from the moment the sim marks a hero down. The
 * screen plays that turn's events on its own clock, so these are offsets into
 * the playback: the DEATH beat's shake (battle.ts asks for juice.shake(22, 0.4)
 * there), the flash over the shaken tableau, and the pose it settles into.
 */
async function deathFrames(page, d) {
  d.koDead = true;
  await once(page, d, 'playfull-ko-death-shake', 200);
  await once(page, d, 'playfull-ko-death-wipe', 180);
  await once(page, d, 'playfull-ko-dead-pose', 1000);
  d.log.push('ko=1: the KO was dealt by the pack — shake, wipe and dead pose captured');
}

/**
 * ONE step of the run, whatever screen is up: read what is standing, answer it
 * with a tap at the contract's own geometry. Returns the phase it acted on, or
 * 'END' once the run is over, so a caller can stop where it likes.
 */
async function stepOnce(page, d, s) {
  if (s.scene === 'TITLE') {
    await once(page, d, 'playfull-title', 300);
    await tap(page, 640, 400, d.touch); // START (the full-canvas twin)
    await wait(page, 500);
    return 'TITLE';
  }
  if (s.scene === 'GAME_OVER' || s.scene === 'WIN') {
    await once(page, d, `playfull-end-${s.scene}`, 600);
    return 'END';
  }
  if (s.scene === 'PAUSED') {
    await once(page, d, 'playfull-paused', 250);
    await tapAt(page, PAUSE_BTN_TAP[0], d.touch); // RESUME
    await wait(page, 300);
    return 'PAUSED';
  }

  const phase = s.phase;
  const p = s.pending ?? {};
  switch (phase) {
    case 'PRE_VAULT': {
      await once(page, d, 'playfull-vault-equip', 400);
      if (!d.vaultPicked && (p.options ?? 0) > 0 && (p.slots ?? 0) > 0) {
        d.vaultPicked = true;
        await tapAt(page, draftSlotTap(0, p.options), d.touch);
        await wait(page, 220);
        // One step up the ascension too, so the stepper and its floor are
        // exercised rather than only drawn (a Vault relic worn IS a floor).
        await tapAt(page, ASC_UP_TAP, d.touch);
        await wait(page, 200);
        await once(page, d, 'playfull-vault-equip-picked', 200);
      }
      await tapAt(page, CONTINUE_TAP, d.touch); // BEGIN THE RUN
      await wait(page, 500);
      return phase;
    }
    case 'DRAFT': {
      await once(page, d, 'playfull-draft', 400);
      await tapAt(page, draftSlotTap(0, p.options ?? 6), d.touch);
      await wait(page, 220);
      await tapAt(page, CONTINUE_TAP, d.touch);
      await wait(page, 400);
      return phase;
    }
    case 'SUMMON': {
      await once(page, d, p.full ? 'playfull-summon-full' : 'playfull-summon', 400);
      // A full party: TAKE THE EPIC (the seam's own answer 0) — a RELIC card with
      // source SUMMON follows. Otherwise: recruit the first offer.
      await tapAt(page, p.full ? EPIC_TAP : draftSlotTap(0, p.options ?? 3), d.touch);
      await wait(page, 220);
      await tapAt(page, CONTINUE_TAP, d.touch);
      await wait(page, 400);
      return phase;
    }
    case 'LEADER': {
      await once(page, d, 'playfull-leader', 400);
      await tapAt(page, PARTY_BACK_TAP, d.touch); // KEEP <name> — the seam's own default
      await wait(page, 350);
      return phase;
    }
    case 'PARTY': {
      await once(page, d, 'playfull-party', 350);
      await tapAt(page, PARTY_BACK_TAP, d.touch); // BACK
      await wait(page, 300);
      return phase;
    }
    case 'ROUTE': {
      await once(page, d, `playfull-map-act${s.view?.act ?? 1}`, 400);
      // Two detours, once each, off the first map: PAUSE by its KEY (the
      // overlay resumes by its button, so both routes are exercised) and the
      // band's PARTY button. Without them neither screen is ever reached by a
      // driver that only routes.
      if (!d.pausedOnce) {
        d.pausedOnce = true;
        await page.keyboard.press('KeyP');
        await wait(page, 400);
        return phase;
      }
      if (!d.partyOnce) {
        d.partyOnce = true;
        await tapAt(page, MAP_PARTY_TAP, d.touch);
        await wait(page, 400);
        return phase;
      }
      const idxs = p.offeredIdxs ?? [0];
      await tapAt(page, mapNodeTap(p.stage ?? 0, idxs[0] ?? 0), d.touch);
      await wait(page, 450);
      return phase;
    }
    case 'ACT_CLEAR': {
      // The act-clear beat (screens/run.ts's own phase, raised over the next
      // act's ROUTE): a held tableau that asks nothing and dismisses itself.
      // Without this case the driver's `default:` waited it out and no repo tool
      // ever wrote the frame, so the one screen whose whole job is to be looked
      // at was the one screen the art loop could not see.
      await once(page, d, 'playfull-act-clear', 700);
      await page.keyboard.press('Space'); // A — the beat's own "go on"
      await wait(page, 400);
      return phase;
    }
    case 'ROOM': {
      await once(page, d, `playfull-room-${s.run?.room ?? 'FIGHT'}`, 350);
      await tapAt(page, CONTINUE_TAP, d.touch);
      await wait(page, 450);
      return phase;
    }
    case 'BATTLE': {
      const boss = p.source === 'BOSS';
      await once(page, d, boss ? 'playfull-battle-boss' : `playfull-battle-${p.source ?? 'FIGHT'}`, boss ? 1200 : 900);
      if (d.ko && !d.koForced && (s.tactics?.heroIds?.length ?? 0) > 1) {
        d.koForced = true;
        // hp 1, never 0: the KO has to be DEALT, not assigned. The next enemy
        // hit that lands takes the hero to zero through the sim, so a real
        // DEATH event is pushed and the screen plays it — the shake, the wipe
        // and the pose the actor settles into. (The run view is a per-token
        // clone, so this writes to the LIVE Battle's own Actor.)
        await page.evaluate(() => {
          const b = window.__eq.battleObj();
          if (b && b.heroes.length) b.heroes[b.heroes.length - 1].hp = 1;
        });
        d.log.push('ko=1: the last hero left on 1 hp — the next enemy hit deals the KO');
      }
      await stepBattle(page, d, s);
      return phase;
    }
    case 'CARDS': {
      const src = s.run?.cardSource ?? 'FIGHT';
      const n = p.cards ?? 1;
      const first = !d.shot.has(`playfull-cards-${src}`);
      await once(page, d, `playfull-cards-${src}`, 400);
      await tap(page, cardCentres(n)[0], CARD_ROW_Y, d.touch); // the first card -> who-wears-it
      if (first) await once(page, d, `playfull-wear-${src}`, 450);
      else await wait(page, 250);
      await tapAt(page, WEAR_TAP[0], d.touch); // wear it on member 0
      await wait(page, 600);
      return phase;
    }
    case 'SHRINE': {
      await once(page, d, 'playfull-shrine', 400);
      // Take the first pact on offer, then walk past every later one — both
      // answers get exercised, and the run picks up a curse to live with.
      if (!d.shrineTaken) {
        d.shrineTaken = true;
        await tapAt(page, CARD_MID_TAP, d.touch); // the pact card = accept
      } else {
        await tapAt(page, CONTINUE_TAP, d.touch); // SKIP = walk past
      }
      await wait(page, 450);
      return phase;
    }
    case 'FORGE': {
      const step = s.node?.step ?? 'MAIN';
      await once(page, d, 'playfull-forge', 400);
      if (step === 'MAIN') {
        const level = (p.options ?? []).find((o) => o.mode === 'LEVEL');
        const cell = level ? (p.cells ?? [])[level.relic] : null;
        if (!cell) { await tapAt(page, WEAR_TAP[3], d.touch); await wait(page, 400); return phase; } // WALK PAST
        await tapAt(page, partyRowTap(cell.m, cell.row), d.touch);
        await wait(page, 300);
        await once(page, d, 'playfull-forge-mode', 250);
        await tapAt(page, WEAR_TAP[0], d.touch); // LEVEL +n
        await wait(page, 450);
        return phase;
      }
      if (step === 'MODE') { await tapAt(page, WEAR_TAP[0], d.touch); await wait(page, 400); return phase; }
      await tapAt(page, WEAR_TAP[3], d.touch); // RECAST/REBRAND: walk past rather than commit blind
      await wait(page, 400);
      return phase;
    }
    case 'ALTAR': {
      await once(page, d, 'playfull-altar', 400);
      const m = (p.candidates ?? [0])[0] ?? 0;
      await tapAt(page, partyColTap(m), d.touch);
      await wait(page, 250);
      await once(page, d, 'playfull-altar-picked', 200);
      await tapAt(page, CONTINUE_TAP, d.touch);
      await wait(page, 450);
      return phase;
    }
    case 'REST': {
      await once(page, d, 'playfull-rest', 400);
      await tapAt(page, CONTINUE_TAP, d.touch); // FULL HEAL — the seam's own default
      await wait(page, 450);
      return phase;
    }
    case 'LAP': {
      await once(page, d, 'playfull-doors', 500);
      await tapAt(page, DOOR_TAP[0], d.touch); // DESCEND
      await wait(page, 500);
      return phase;
    }
    case 'BANK': {
      const dropping = s.vault?.step === 'DROP';
      await once(page, d, dropping ? 'playfull-bank-drop' : 'playfull-bank', 500);
      if (dropping) {
        await tapAt(page, draftSlotTap(0, p.vault ?? 1), d.touch); // drop the first Vault chip
        await wait(page, 250);
      } else {
        const cell = (p.cells ?? [])[0];
        if (cell) {
          await tapAt(page, partyRowTap(cell.m, cell.row), d.touch);
          await wait(page, 250);
          await once(page, d, 'playfull-bank-picked', 200);
        }
      }
      await tapAt(page, CONTINUE_TAP, d.touch);
      await wait(page, 450);
      return phase;
    }
    default:
      await wait(page, 200);
      return phase ?? 'NONE';
  }
}

async function openGame(page, seed) {
  const url = seed ? `${BASE}/?seed=${encodeURIComponent(seed)}` : `${BASE}/`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#screen canvas', { state: 'attached', timeout: 15000 });
  await page.waitForFunction(() => typeof window.__eq === 'object' && window.__eq !== null, null, { timeout: 15000 });
  await wait(page, 600);
}

// --- battle: the art loop's frames, over the real opening --------------------------
async function battle(page, prefix, touch, phone = touch) {
  await openGame(page, opts.seed);
  await frame(page, `${prefix}title`);
  // The run no longer starts at a room card: drive the real opening (draft ->
  // summon -> leader -> map -> room card) with the same tap-only driver, then
  // take this mode's own frames once a fight is on.
  const d = newDriver({ touch, phone, prefix });
  for (let i = 0; i < 400; i++) {
    const s = await eqRead(page);
    if (!s) break;
    noteBattlePhase(d, s);
    if (s.phase === 'ROOM' && !d.shot.has('room-card')) {
      d.shot.add('room-card');
      await wait(page, 300);
      await frame(page, `${prefix}room-card`);
    }
    if (s.phase === 'BATTLE') break;
    if (await stepOnce(page, d, s) === 'END') break;
  }
  await wait(page, 500);
  await frame(page, `${prefix}battle-0`);
  await wait(page, 1500);
  await frame(page, `${prefix}battle-1`);
  // A hero's turn may or may not be up: try skill 1 on enemy 0 a few times and
  // snapshot right after, so at least one frame carries a hit and its VFX.
  // Timing: the HIT event fires one CAST beat (0.16 s) after the target tap and
  // its effect lives ~0.3-0.5 s, so the burst below samples early, mid and late life.
  const packSize = await page.evaluate(() => {
    const b = window.__eq && window.__eq.battleObj ? window.__eq.battleObj() : null;
    return b ? b.enemies.length : 3;
  }).catch(() => 3);
  for (let i = 0; i < 3; i++) {
    await tap(page, ...skillTap(0, phone), touch); // command row 1
    await wait(page, 120);
    await tapAt(page, enemyTap(packSize, 0), touch); // enemy 0's sprite = target
    await wait(page, 200);
    await frame(page, `${prefix}battle-hit-${i}a`);
    await wait(page, 70);
    await frame(page, `${prefix}battle-hit-${i}b`);
    await wait(page, 90);
    await frame(page, `${prefix}battle-hit-${i}c`);
    await wait(page, 800);
  }
  await frame(page, `${prefix}battle-2`);
  // Pause overlay and the inspect overlay — only while the battle is still on.
  const stillFighting = async () => page.evaluate(() => {
    const eq = window.__eq;
    return !eq || !eq.phase || eq.phase() === 'BATTLE';
  }).catch(() => true);
  // The taps land on the sprites now, so the room can be WON inside the burst
  // above. Walk on to the next room's battle rather than skipping the two
  // overlay frames, which are the whole point of this mode.
  let inBattle = await stillFighting();
  for (let i = 0; i < 60 && !inBattle; i++) {
    const s = await eqRead(page);
    if (!s) break;
    noteBattlePhase(d, s);
    if (await stepOnce(page, d, s) === 'END') break;
    inBattle = await stillFighting();
  }
  if (inBattle) {
    await wait(page, 600);
    await tapAt(page, PAUSE_TAP, touch); // pause icon
    await wait(page, 300);
    await frame(page, `${prefix}battle-paused`);
    await tapAt(page, PAUSE_BTN_TAP[0], touch); // RESUME
    await wait(page, 300);
    await tap(page, ...heroPanelTap(0), touch); // hero panel 0 -> inspect (outside target mode)
    await wait(page, 300);
    await frame(page, `${prefix}battle-inspect`);
    await tap(page, 1136, 600, touch); // BACK
    await wait(page, 200);
  } else {
    console.log('battle ended before the pause/inspect frames; run `playfull` for the later screens');
  }
}

if (modes.has('battle')) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  watch(page);
  await battle(page, '', false);
  await page.close();
}
if (modes.has('phone')) {
  const ctx = await browser.newContext(PHONE_VIEWPORT);
  const page = await ctx.newPage();
  watch(page);
  await battle(page, 'phone-', true);
  // The phone frame as the phone actually shows it (CSS-fitted, chrome-free).
  await page.screenshot({ path: `${OUT}/phone-viewport.png` });
  await ctx.close();
}

// --- playfull: a whole act, screen by screen ---------------------------------------
async function playfull(page, prefix, touch, phone, acts) {
  await openGame(page, opts.seed);
  const d = newDriver({ touch, phone, prefix, ko: opts.ko === '1', shoot: true });
  const deadline = Date.now() + acts * 16 * 60 * 1000; // a boss fight is ~45 actor turns of paced playback
  let ended = false;
  let cleared = false;
  // A heartbeat, so a stalled mode says WHERE it stalled while it is stalling
  // rather than sixteen minutes later: one line per screen the run moves to,
  // and one a minute if it moves to none.
  const t0 = Date.now();
  let lastTag = '';
  let lastLog = 0;
  for (let i = 0; i < 40000 && Date.now() < deadline; i++) {
    const s = await eqRead(page);
    if (!s) break;
    noteBattlePhase(d, s);
    const tag = `${s.scene}/${s.phase}${s.phase === 'BATTLE' ? `:${s.battle}` : ''}`;
    if (tag !== lastTag || Date.now() - lastLog > 60000) {
      lastTag = tag;
      lastLog = Date.now();
      const v = s.view;
      const at = v ? ` act ${v.act} lap ${v.lap} rooms ${v.rooms.length} score ${v.score} hp ${v.members.map((m) => m.hp).join('/')}` : '';
      console.log(`  [${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s] ${tag}${at}`);
    }
    // The act budget: `acts=1` stops the moment act 1 is behind the party — the
    // boss is dead, its cards are taken, and the run is standing on act 2's map.
    if (s.view && s.view.act > acts) {
      await once(page, d, `playfull-act${acts}-cleared`, 400);
      cleared = true;
      break;
    }
    if (await stepOnce(page, d, s) === 'END') { ended = true; break; }
  }
  const tail = await eqRead(page);
  const dev = await page.evaluate(() => ({
    seed: window.__eq.seed(), config: window.__eq.config ? window.__eq.config() : null,
    decisions: window.__eq.decisions(), result: window.__eq.result(),
  })).catch(() => null);
  const won = dev?.result?.won === true;
  // Three outcomes, and only one of them is OK. `acts` acts cleared is the
  // mode's job done; a won run (DESCEND) is that too. A DEATH is not — the
  // driver was asked to clear an act and did not — so it says ENDED and exits
  // non-zero, unless ko=1 asked for a death in the first place.
  const stalled = !ended && !cleared;
  const died = ended && !won;
  const verdict = stalled ? 'STALLED' : died && opts.ko !== '1' ? 'ENDED' : 'OK';
  const report = {
    mode: prefix ? 'phone' : 'desktop',
    acts,
    ko: opts.ko === '1',
    verdict,
    seed: dev?.seed ?? null,
    config: dev?.config ?? null,
    stopped: ended ? (won ? 'the run was won' : 'the party died') : cleared ? `act ${acts} cleared` : 'the budget ran out',
    scene: tail?.scene ?? null,
    phase: tail?.phase ?? null,
    act: tail?.view?.act ?? null,
    lap: tail?.view?.lap ?? null,
    score: tail?.view?.score ?? null,
    rooms: tail?.view?.rooms ?? [],
    party: tail?.view?.members ?? [],
    pacts: tail?.view?.pactsTaken ?? [],
    frames: [...d.shot].filter((n) => n.startsWith('playfull')),
    notes: d.log,
    decisions: dev?.decisions ?? [],
    result: dev?.result ?? null,
  };
  writeFileSync(`${OUT}/${prefix}playfull-decisions.json`, JSON.stringify(report, null, 2));
  console.log(`PLAYFULL ${report.mode}: seed ${report.seed} — ${report.stopped}; act ${report.act}, score ${report.score}`);
  console.log(`  rooms: ${report.rooms.join(' ')}`);
  console.log(`  party: ${report.party.map((m) => `${m.id} ${m.hp}`).join(' . ')}${report.pacts.length ? `  pacts: ${report.pacts.join(' ')}` : ''}`);
  console.log(`  frames (${report.frames.length}): ${report.frames.join(', ')}`);
  for (const n of report.notes) console.log(`  ${n}`);
  console.log(`  decisions -> ${OUT}/${prefix}playfull-decisions.json (${report.decisions.length} answers, replay with ?seed=${report.seed})`);
  if (stalled) {
    console.error(`PLAYFULL STALLED on ${report.phase} after ${acts * 16} minutes`);
    process.exitCode = 1;
  } else if (verdict === 'ENDED') {
    console.error(`PLAYFULL ENDED — the party died in act ${report.act} at room ${report.rooms.length} (${report.rooms[report.rooms.length - 1] ?? '?'}), ${acts} act(s) asked for`);
    process.exitCode = 1;
  } else if (died) {
    console.log(`PLAYFULL OK — the party died in act ${report.act}, which is what ko=1 asked for`);
  } else {
    console.log('PLAYFULL OK');
  }
}

if (modes.has('playfull')) {
  const acts = Math.max(1, Number(opts.acts ?? 1) || 1);
  if (opts.phone === '1') {
    const ctx = await browser.newContext(PHONE_VIEWPORT);
    const page = await ctx.newPage();
    watch(page);
    await playfull(page, 'phone-', true, true, acts);
    await ctx.close();
  } else {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
    watch(page);
    await playfull(page, '', false, false, acts);
    await page.close();
  }
}

if (modes.has('shot') && opts.url) {
  const phone = opts.phone === '1';
  const ctx = phone ? await browser.newContext(PHONE_VIEWPORT) : null;
  const page = ctx ? await ctx.newPage() : await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 });
  watch(page);
  await page.goto(`${BASE}${opts.url}`, { waitUntil: 'load' });
  await page.waitForFunction(() => (window.__lineup && window.__lineup.ready) || window.__ready === true, null, { timeout: 20000 });
  await page.locator(opts.selector || '#sheet').screenshot({ path: `${OUT}/${opts.name || 'shot'}.png` });
  if (ctx) await ctx.close();
  else await page.close();
}

await browser.close();
if (errors.length) {
  console.error('CAPTURE saw page errors:');
  for (const e of errors) console.error('  - ' + e);
  process.exitCode = 1;
} else if (process.exitCode) {
  console.error(`CAPTURE finished with failures -> ${OUT}/`);
} else {
  console.log(`CAPTURE OK -> ${OUT}/`);
}
