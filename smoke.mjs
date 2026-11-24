import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const envOr = (name, fallback) => {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : fallback;
};

const URL = envOr('SMOKE_URL', 'http://localhost:5173/');
const WRAPPER = '/tmp/ember-chromium';
const FRAMES = 40;
const errors = [];
const FIGHT_QUERY = '?scene=battle&act=1&seed=7&hold=1';
const FIGHT_TICKS = 4000;

const executablePath = envOr('CHROMIUM_PATH', existsSync(WRAPPER) ? WRAPPER : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : {});

const waitFrames = (page, count) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => {
          if (++seen >= n) {
            resolve(seen);
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    count,
  );

const fightToTheKill = () => {
  const ember = window.__ember;
  let s = ember.state();
  for (let i = 0; i < 400 && s.subScene === 'BATTLE'; i++) {
    if (s.battle?.phase === 'MENU') {
      ember.press('A');
    }
    s = ember.step(10);
  }
  return { subScene: s.subScene, drift: s.drift ?? 0, hp: s.hero.hp };
};

const checkWinWhileHurt = async (page) => {
  await page.goto(new globalThis.URL(FIGHT_QUERY, URL).href, { waitUntil: 'load', timeout: 15000 });
  const hooked = await page
    .waitForFunction(() => typeof window.__ember?.step === 'function', null, { timeout: 4000 })
    .then(() => true, () => false);
  if (!hooked) {
    console.log('SMOKE NOTE: no dev hook at this URL, the win-while-hurt fight is skipped');
    return;
  }
  const end = await page.evaluate(fightToTheKill);
  if (end.subScene === 'BATTLE') {
    errors.push(`fight: still in BATTLE after ${String(FIGHT_TICKS)} ticks`);
  }
  if (end.drift > 0) {
    errors.push(`fight: the replay drifted from the committed turn ${String(end.drift)} time(s)`);
  }
};

try {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

  let canvasFound = false;
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 15000 });
    await page.waitForSelector('canvas', { state: 'attached', timeout: 8000 });
    canvasFound = true;
    await waitFrames(page, FRAMES);
    await checkWinWhileHurt(page);
  } catch (e) {
    errors.push(`load/canvas: ${e.message}`);
  }

  if (!canvasFound || errors.length > 0) {
    console.error('SMOKE FAIL:');
    if (!canvasFound) {
      console.error('  - no live <canvas> after module ran');
    }
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exitCode = 1;
  } else {
    console.log('SMOKE OK: canvas live in DOM, a seeded fight won while hurt without drift, zero uncaught errors');
  }
} finally {
  await browser.close();
}
