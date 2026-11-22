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
    console.log('SMOKE OK: canvas live in DOM, zero uncaught errors');
  }
} finally {
  await browser.close();
}
