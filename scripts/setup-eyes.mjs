import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = '/tmp/chromium';
const LIBS = '/tmp/al2023/lib';
const WRAPPER = '/tmp/ember-chromium';
const MARKER = '/tmp/ember-eyes.json';
const LOCK = '/tmp/ember-eyes.lock';
const DEV_LOG = '/tmp/ember-dev.log';
const SETUP_LOG = '/tmp/ember-setup.log';
const LOCAL_URL = 'http://localhost:5173/';
const PUBLIC_URL = process.env.JBCENTRAL_EXPOSED_PORT_URL_5173 ?? '';
const FORCE = process.argv.includes('--force');
const APT_PACKAGES = ['libnspr4', 'libnss3', 'libsqlite3-0'];
const t0 = Date.now();

const WRAPPER_TEXT = [
  '#!/bin/sh',
  `export LD_LIBRARY_PATH=${LIBS}\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}`,
  ': "${FONTCONFIG_PATH:=/tmp/fonts}"',
  'export FONTCONFIG_PATH',
  `exec ${BIN} --headless=shell --no-sandbox --disable-gpu "$@"`,
  '',
].join('\n');

const log = (line) => appendFileSync(SETUP_LOG, `${new Date().toISOString()} ${line}\n`);
const seconds = () => ((Date.now() - t0) / 1000).toFixed(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readMarker() {
  try {
    return JSON.parse(readFileSync(MARKER, 'utf8'));
  } catch {
    return null;
  }
}

function writeMarker(ready, reason) {
  const marker = { ready, reason, chromium: WRAPPER, url: PUBLIC_URL !== '' ? PUBLIC_URL : LOCAL_URL, local: LOCAL_URL, at: new Date().toISOString() };
  writeFileSync(MARKER, `${JSON.stringify(marker)}\n`);
  return marker;
}

async function devAnswers() {
  try {
    const res = await fetch(LOCAL_URL, { signal: AbortSignal.timeout(1500) });
    return res.status === 200;
  } catch {
    return false;
  }
}

function ensureNodeModules() {
  if (existsSync(join(ROOT, 'node_modules', 'playwright')) && existsSync(join(ROOT, 'node_modules', '@sparticuz', 'chromium'))) {
    return;
  }
  log('npm ci');
  const r = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`npm ci failed: ${String(r.stderr).trim().split('\n').pop()}`);
  }
}

async function ensureChromium() {
  if (existsSync(BIN) && existsSync(join(LIBS, 'libnss3.so')) && existsSync('/tmp/fonts/fonts.conf')) {
    return;
  }
  log('extracting chromium');
  const mod = await import('@sparticuz/chromium');
  const path = await mod.default.executablePath();
  if (path !== BIN) {
    throw new Error(`chromium extracted to ${path}, expected ${BIN}`);
  }
  const binDir = join(ROOT, 'node_modules', '@sparticuz', 'chromium', 'bin');
  await mod.inflate(join(binDir, 'al2023.tar.br'));
}

function ensureWrapper() {
  if (existsSync(WRAPPER) && readFileSync(WRAPPER, 'utf8') === WRAPPER_TEXT) {
    return;
  }
  writeFileSync(WRAPPER, WRAPPER_TEXT, { mode: 0o755 });
}

async function ensureDevServer() {
  if (await devAnswers()) {
    return;
  }
  log('starting dev server');
  const cmd = `cd '${ROOT}' && exec setsid nohup npm run dev > ${DEV_LOG} 2>&1 < /dev/null`;
  spawn('sh', ['-c', cmd], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await devAnswers()) {
      return;
    }
  }
  throw new Error(`dev server did not answer 200 on ${LOCAL_URL} (see ${DEV_LOG})`);
}

async function launchCheck() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ executablePath: WRAPPER, timeout: 20000 });
  try {
    const page = await browser.newPage();
    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('canvas', { state: 'attached', timeout: 8000 });
  } finally {
    await browser.close();
  }
}

function canApt() {
  if (process.platform !== 'linux') {
    return false;
  }
  return spawnSync('sudo', ['-n', 'true'], { stdio: 'ignore' }).status === 0;
}

function aptInstall() {
  log(`apt fallback: ${APT_PACKAGES.join(' ')}`);
  const env = { ...process.env, DEBIAN_FRONTEND: 'noninteractive' };
  const opts = { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8', env };
  spawnSync('sudo', ['-n', '-E', 'apt-get', 'update'], opts);
  const r = spawnSync('sudo', ['-n', '-E', 'apt-get', 'install', '-y', ...APT_PACKAGES], opts);
  if (r.status !== 0) {
    throw new Error(`apt-get install failed: ${String(r.stderr).trim().split('\n').pop()}`);
  }
}

async function verifiedLaunch() {
  try {
    await launchCheck();
    return 'launch ok (bundled libs via LD_LIBRARY_PATH)';
  } catch (e) {
    log(`launch failed: ${e.message}`);
    if (!canApt()) {
      const detail = /error while loading shared libraries[^\n]*/.exec(e.message)?.[0] ?? e.message.split('\n')[0];
      throw new Error(`browser launch failed: ${detail}`, { cause: e });
    }
  }
  aptInstall();
  await launchCheck();
  return 'launch ok after apt fallback';
}

function exportEnv() {
  const file = process.env.CLAUDE_ENV_FILE;
  if (!file) {
    return;
  }
  const lines = [`export CHROMIUM_PATH=${WRAPPER}`, `export AGENT_BROWSER_EXECUTABLE_PATH=${WRAPPER}`];
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const missing = lines.filter((l) => !current.includes(l));
  if (missing.length) {
    appendFileSync(file, `${missing.join('\n')}\n`);
  }
}

function report(marker) {
  const state = marker.ready ? 'ready' : 'NOT READY';
  console.log(`eyes: ${state} - ${marker.reason} | chromium ${marker.chromium} | dev ${marker.url} | ${seconds()}s`);
  if (marker.ready) {
    exportEnv();
  } else {
    process.exitCode = 1;
  }
}

async function fastPath() {
  if (FORCE) {
    return null;
  }
  const marker = readMarker();
  if (!marker?.ready || !existsSync(BIN) || !existsSync(WRAPPER)) {
    return null;
  }
  if (readFileSync(WRAPPER, 'utf8') !== WRAPPER_TEXT) {
    return null;
  }
  if (!(await devAnswers())) {
    return null;
  }
  return marker;
}

function takeLock() {
  try {
    mkdirSync(LOCK);
    return true;
  } catch {
    if (Date.now() - statSync(LOCK).mtimeMs > 600000) {
      rmSync(LOCK, { recursive: true, force: true });
      return takeLock();
    }
    return false;
  }
}

async function waitForOtherRun() {
  for (let i = 0; i < 600 && existsSync(LOCK); i++) {
    await sleep(500);
  }
  return readMarker() ?? writeMarker(false, 'another setup run did not finish');
}

async function fullSetup() {
  try {
    ensureNodeModules();
    await ensureChromium();
    ensureWrapper();
    await ensureDevServer();
    return writeMarker(true, await verifiedLaunch());
  } catch (e) {
    return writeMarker(false, e.message);
  }
}

async function main() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    console.log(`eyes: skipped - ${process.platform}/${process.arch} is not the linux-x64 cloud box`);
    return;
  }
  const fast = await fastPath();
  if (fast) {
    report(fast);
    return;
  }
  if (!takeLock()) {
    report(await waitForOtherRun());
    return;
  }
  try {
    report(await fullSetup());
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}

await main();
