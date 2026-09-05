// Ember Quest v3 — boot, loop, scene routing, input dispatch.
//
// v3 is being rebuilt on this branch against DESIGN.md: 1280×720 logical,
// HD-2D (exactly one pixelated plane — the actors — under smooth light, UI
// and text), 3v3 party battles on an attack bar, native tap + keyboard.
// Phases 1–3 leave the game unplayable; this file is the phase-1 boot that
// keeps the smoke gate honest (a live canvas, zero errors) and exercises the
// upscaled engine — FONT_HD's glyph atlas, the pointer, the hit registry and
// the mutable safe inset — until phase 4 mounts the battle screen here.
//
// STYLE CARD (phase 4 fills the rest — the decisions that already hold):
//   - PALETTE: PICO8 roles for UI; element tints per actor layer (art/).
//   - TEXT: FONT_HD, nothing the player needs below scale 2 (UI constraints).
//   - INPUT: every tap target registers a hit region; A/arrows route to it.
//   - CRT: off in the HD tiers (bloom replaces halation); ARCADE is a toggle.
//
// Controls: arrows/WASD move focus, A (Space/Z) activates, PAUSE pauses.

import {
  createPixelCanvas, createLoop, createInput, createScenes, createAudio, createRuntime,
  createHitRegions, setSafeInset, getSafeInset, pickBackingScale,
  drawText, drawTextCentered, textWidth, drawLogo, drawFrame, drawPanel, blink, pulse,
  FONT_HD, PICO8, BUTTON_KEY,
} from '../engine';

// --- Setup ---------------------------------------------------------------------
const W = 1280;
const H = 720;
const mount = document.getElementById('screen');
const pc = createPixelCanvas({
  width: W,
  height: H,
  // The canvas is not in the DOM yet, so measure the CSS width it will get
  // (index.html: min(100vw, 100vh × 16/9)) rather than the empty mount.
  scale: pickBackingScale(Math.min(window.innerWidth, (window.innerHeight * 16) / 9)),
  parent: mount,
  smoothing: true,
});
setSafeInset({ left: 24, top: 24, right: 24, bottom: 24 });
const audio = createAudio();
const input = createInput(
  [{ button: 'A', label: 'select' }, { button: 'PAUSE', label: 'pause' }],
  { onFirstInput: () => audio.unlock(), pointer: { canvas: pc.canvas, width: W, height: H } },
);
const hits = createHitRegions(input, { width: W, height: H });
const scenes = createScenes();
const runtime = createRuntime();

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_ACCENT = PICO8[10];
const C_PANEL = PICO8[1];

let clock = 0;
let started = 0; // how many times START was activated — proves tap AND keyboard reach it
const hd = { font: FONT_HD };

scenes.onEnter('TITLE', () => runtime.stateChanged('TITLE'));
runtime.stateChanged('TITLE');

// --- Update -----------------------------------------------------------------------
const START = { x: W / 2 - 200, y: 520, w: 400, h: 96 };

function update(dt: number): void {
  clock += dt;
  // Register this frame's tap targets BEFORE endFrame (the registry reads this tick's edges).
  hits.begin();
  hits.add('start', START.x, START.y, START.w, START.h, { index: 0 });
  hits.end();
  if (hits.activated() === 'start') {
    started += 1;
    audio.play('blip');
  }
  input.endFrame();
}

// --- Render -----------------------------------------------------------------------
function render(): void {
  pc.clear(PICO8[0]);
  const ctx = pc.ctx;
  const inset = getSafeInset();

  drawLogo(ctx, 'EMBER QUEST', W, 150, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 8, font: FONT_HD });
  drawTextCentered(ctx, 'v3 is under construction on this branch', W, 270, { ...hd, color: C_DIM, scale: 2 });
  drawTextCentered(ctx, 'three heroes · an attack bar · relics that roll their own numbers', W, 300, { ...hd, color: C_TEXT, scale: 2 });

  const focused = hits.focused() === 'start';
  const hot = focused && blink(clock, 1.0, 0.6) === 1;
  drawPanel(pc, START.x, START.y, START.w, START.h, { color: C_PANEL, border: hot ? C_TEXT : C_ACCENT });
  if (hits.pressing() === 'start') drawFrame(ctx, START.x + 2, START.y + 2, START.w - 4, START.h - 4, C_TEXT, 2);
  const label = started > 0 ? `PRESSED ${started}` : 'PRESS TO BEGIN';
  drawText(ctx, label, Math.round(START.x + (START.w - textWidth(label, 3, 1, FONT_HD)) / 2), START.y + 30, { ...hd, color: focused ? C_TEXT : C_DIM, scale: 3 });

  const hint = input.pointer.type === 'touch' ? 'tap the button' : `${BUTTON_KEY.A.hint} · arrows move · P pauses`;
  drawTextCentered(ctx, hint, W, H - inset.bottom - 22, { ...hd, color: C_DIM, scale: 2 });
  ctx.globalAlpha = 0.5 + 0.5 * pulse(clock, 2);
  drawText(ctx, 'phase 1 · engine upscale', inset.left, inset.top, { ...hd, color: C_DIM, scale: 2 });
  ctx.globalAlpha = 1;
}

createLoop({ update, render }).start();
