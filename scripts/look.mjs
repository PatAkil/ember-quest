import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const WRAPPER = '/tmp/ember-chromium';
const envOr = (name, fallback) => {
  const value = process.env[name];
  return value !== undefined && value !== '' ? value : fallback;
};
const BASE = envOr('LOOK_URL', envOr('SMOKE_URL', 'http://localhost:5173/'));
const KEY_NAMES = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', space: 'Space', b: 'KeyX', x: 'KeyX', esc: 'Escape', escape: 'Escape', enter: 'Enter' };
const HOOK_ACTIONS = {
  arrowup: 'UP', w: 'UP', keyw: 'UP', arrowdown: 'DOWN', s: 'DOWN', keys: 'DOWN',
  arrowleft: 'LEFT', keya: 'LEFT', arrowright: 'RIGHT', d: 'RIGHT', keyd: 'RIGHT',
  space: 'A', z: 'A', keyz: 'A', keyx: 'B', c: 'B', keyc: 'B', p: 'PAUSE', keyp: 'PAUSE', escape: 'PAUSE',
};

const { values: opts } = parseArgs({
  options: {
    scene: { type: 'string' },
    act: { type: 'string' },
    seed: { type: 'string' },
    keys: { type: 'string', default: '' },
    steps: { type: 'string', default: '30' },
    out: { type: 'string' },
    'no-shot': { type: 'boolean', default: false },
  },
});

const SCENES = ['title', 'map', 'battle', 'levelup', 'loot', 'card', 'paused', 'gameover', 'win', 'gear', 'pick', 'drop', 'battle-heavy', 'battle-magic'];
if (opts.scene !== undefined && !SCENES.includes(opts.scene)) {
  console.log(JSON.stringify({ ok: false, state: null, errors: [`unknown --scene "${opts.scene}" (known: ${SCENES.join(', ')})`], shot: null }));
  process.exit(1);
}

const steps = Math.max(0, Number(opts.steps) || 0);
const keys = opts.keys.split(',').map((k) => k.trim()).filter(Boolean).map((k) => KEY_NAMES[k.toLowerCase()] ?? k);

function pageUrl() {
  const url = new URL(BASE);
  for (const name of ['seed', 'scene', 'act']) {
    if (opts[name] !== undefined) {
      url.searchParams.set(name, opts[name]);
    }
  }
  if (opts.seed || opts.scene) {url.searchParams.set('hold', '1');}
  return url.href;
}

function shotPath() {
  if (opts.out) {
    return opts.out;
  }
  const scene = opts.scene ?? 'title';
  const seed = opts.seed ?? (opts.scene ? '1' : 'r');
  const name = `${scene}-a${opts.act ?? 1}-s${seed}.png`;
  const dir = process.env.AIR_ARTIFACTS_DIR ? join(process.env.AIR_ARTIFACTS_DIR, 'look') : '/tmp/ember-look';
  return join(dir, name);
}

function waitFrames(page, count) {
  return page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let seen = 0;
        const tick = () => {
          if (++seen >= n) {
            resolve();
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}

async function advance(page, hooked, ticks) {
  if (ticks <= 0) {
    return;
  }
  if (hooked) {
    await page.evaluate((n) => window.__ember.step(n), ticks);
  }
  else {await waitFrames(page, ticks);}
}

async function pressKey(page, hooked, key) {
  const action = HOOK_ACTIONS[key.toLowerCase()];
  if (hooked && action) {
    await page.evaluate((a) => window.__ember.press(a), action);
  }
  else {await page.keyboard.press(key);}
  await advance(page, hooked, Math.max(steps, 1));
}

async function drive(page) {
  const hooked = await page.evaluate(() => typeof window.__ember?.state === 'function');
  for (const key of keys) {
    await pressKey(page, hooked, key);
  }
  if (!keys.length) {
    await advance(page, hooked, steps);
  }
  return hooked ? page.evaluate(() => JSON.parse(JSON.stringify(window.__ember.state()))) : null;
}

async function capture(page, canvas) {
  if (opts['no-shot'] || !canvas) {
    return null;
  }
  const path = shotPath();
  mkdirSync(dirname(path), { recursive: true });
  await canvas.screenshot({ path });
  return path;
}

async function look(page, errors) {
  const result = { ok: false, state: null, errors, shot: null };
  await page.goto(pageUrl(), { waitUntil: 'domcontentloaded', timeout: 15000 });
  const canvas = await page.waitForSelector('canvas', { state: 'attached', timeout: 8000 }).catch(() => null);
  if (!canvas) {
    errors.push('no live <canvas> after module ran');
  }
  else {result.state = await drive(page);}
  result.shot = await capture(page, canvas);
  result.ok = Boolean(canvas) && errors.length === 0;
  return result;
}

const executablePath = envOr('CHROMIUM_PATH', existsSync(WRAPPER) ? WRAPPER : undefined);
const errors = [];
let result = { ok: false, state: null, errors, shot: null };
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage();
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`console.error: ${msg.text()}`));
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  result = await look(page, errors);
} catch (e) {
  errors.push(`look: ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
}
console.log(JSON.stringify(result));
if (!result.ok) {
  process.exitCode = 1;
}
