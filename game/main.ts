// Ember Quest v3 — boot, loop, scene routing, input dispatch.
//
// Phase 4: the vertical slice is playable end to end. The engine scene
// machine (TITLE → PLAYING ⇄ PAUSED → (GAME_OVER | WIN) → restart) wraps the
// run's own finer-grained phase (ROOM → BATTLE ⇄ CARDS, screens/run.ts) — a
// GAME_OVER/VICTORY there is mirrored onto the engine scene the frame it
// happens, and every scene entry sends the one runtime message it owns
// (messaging-game-over). PAUSE outside of battle is this file's own overlay
// (the region table's generic "pause" row); PAUSE mid-battle is forwarded to
// the battle screen, which owns its own pause-and-forfeit flow — "a quit
// surfaces as a forfeit result" needs no special case here: it is just
// another way battleScreen.result() turns non-null.
//
// STYLE CARD: PALETTE PICO8 for UI, element tints per actor layer (art/).
// TEXT FONT_HD, nothing below scale 2. INPUT every tap target is a hit
// region; A/arrows route to it. CRT off by default; ARCADE is the toggle.

import {
  createPixelCanvas, createLoop, createInput, createScenes, createAudio, createRuntime,
  createHitRegions, setSafeInset, createJuice, createParticles, createCrt, pickBackingScale,
  drawTextCentered, drawPanel, drawText, textWidth, dimScene, FONT_HD, PICO8,
} from '../engine';
import type { Battle } from './sim/battle';
import type { BattleResult } from './types';
import {
  CANVAS_W, CANVAS_H, PAUSE_BTN, PAUSE_BTN_X, PAUSE_BTN_Y, PAUSED_TEXT_Y, SAFE_INSET, TEXT_LABEL,
} from './screens/layout';
import { RUN_BIOME, createRunScreen } from './screens/run';
import type { RunPhase, RunScreen } from './screens/run';
import { createCardsScreen } from './screens/cards';
import { createTitleScreen } from './screens/title';
import { createEndScreen } from './screens/end';
import { createBattleScreen } from './screens/battle';

// --- Boot --------------------------------------------------------------------
const W = CANVAS_W;
const H = CANVAS_H;
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
setSafeInset(SAFE_INSET);
const audio = createAudio();
const input = createInput(
  [{ button: 'A', label: 'select' }, { button: 'B', label: 'back' }, { button: 'PAUSE', label: 'pause' }],
  { onFirstInput: () => audio.unlock(), pointer: { canvas: pc.canvas, width: W, height: H } },
);
const regions = createHitRegions(input, { width: W, height: H });
const scenes = createScenes();
const runtime = createRuntime();
const juice = createJuice();
const particles = createParticles({ width: W, height: H, ambient: 'embers' });
const crt = createCrt();

const hd = { font: FONT_HD };
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_ACCENT = PICO8[10];
const C_PANEL = PICO8[1];

// --- Screens (created once; each reads screens/run.ts's state on its own) ----
let run: RunScreen | null = null;
let activeBattle: Battle | null = null;
let lastHeroKillAttacker: string | null = null;
let lastRunPhase: RunPhase | null = null;
let lastScore = 0;
let arcade = false;
let clock = 0;

function startRun(): void {
  run = createRunScreen(Math.random);
  activeBattle = null;
  lastHeroKillAttacker = null;
  lastRunPhase = null;
  lastScore = 0;
  scenes.to('PLAYING');
}

const titleScreen = createTitleScreen({ pc, input, regions, audio, onStart: startRun });
const cardsScreen = createCardsScreen({ pc, input, regions, audio });
const endScreen = createEndScreen({ pc, input, regions, audio, onRetry: startRun, onContinue: startRun });
const battleScreen = createBattleScreen({ pc, input, regions, audio, juice, particles, crt });

scenes.onEnter('TITLE', () => runtime.stateChanged('TITLE'));
scenes.onEnter('PLAYING', () => runtime.stateChanged('PLAYING'));
scenes.onEnter('PAUSED', () => runtime.stateChanged('PAUSED'));
scenes.onEnter('GAME_OVER', () => {
  runtime.stateChanged('GAME_OVER');
  runtime.gameOver({ score: run?.score ?? 0, won: false });
});
scenes.onEnter('WIN', () => {
  runtime.stateChanged('WIN');
  runtime.gameOver({ score: run?.score ?? 0, won: true });
});
runtime.stateChanged('TITLE');

/** Reads the battle's own presentation-event log for the hero-killing hit, ahead of the battle screen
 * draining it for animation — screens/run.ts's GAME_OVER wants a name, and BattleResult carries none. */
function scanBattleEvents(battle: Battle): void {
  for (const ev of battle.events) {
    if (ev.kind === 'HIT' && ev.killed && ev.target.side === 'HERO') lastHeroKillAttacker = ev.attacker.def.name;
  }
}

// A complete tick — begin -> add -> end -> check activation -> endFrame() —
// the same shape battle.ts uses: end() is what resolves this tick's
// activation, so it must run before (not after) the checks below.
function updatePauseOverlay(): void {
  const resumeKey = input.pressed('PAUSE');
  regions.begin();
  regions.add('pause-resume', PAUSE_BTN_X, PAUSE_BTN_Y[0], PAUSE_BTN.w, PAUSE_BTN.h, { index: 0, group: 'pause' });
  regions.add('pause-arcade', PAUSE_BTN_X, PAUSE_BTN_Y[1], PAUSE_BTN.w, PAUSE_BTN.h, { index: 1, group: 'pause' });
  regions.add('pause-quit', PAUSE_BTN_X, PAUSE_BTN_Y[2], PAUSE_BTN.w, PAUSE_BTN.h, { index: 2, group: 'pause' });
  regions.end();
  const act = regions.activated();
  if (act === 'pause-resume' || resumeKey) { audio.play('blip'); scenes.to('PLAYING'); }
  else if (act === 'pause-arcade') { audio.play('blip'); arcade = !arcade; }
  else if (act === 'pause-quit') { audio.play('blip'); scenes.to('TITLE'); }
  input.endFrame();
}

function renderPauseOverlay(): void {
  const ctx = pc.ctx;
  dimScene(pc); // DESIGN.md's pause row: dimScene, PAUSED at scale 4, then the three buttons
  drawTextCentered(ctx, 'PAUSED', W, PAUSED_TEXT_Y, { ...hd, color: C_TEXT, scale: 4, outline: true });
  const labels: [string, string][] = [
    ['pause-resume', 'RESUME'],
    ['pause-arcade', `ARCADE ${arcade ? 'ON' : 'OFF'}`],
    ['pause-quit', 'QUIT TO TITLE'],
  ];
  labels.forEach(([id, label], i) => {
    const focused = regions.focused() === id;
    drawPanel(pc, PAUSE_BTN_X, PAUSE_BTN_Y[i], PAUSE_BTN.w, PAUSE_BTN.h, { color: C_PANEL, border: focused ? C_TEXT : C_ACCENT });
    const lx = Math.round(PAUSE_BTN_X + (PAUSE_BTN.w - textWidth(label, TEXT_LABEL, 1, FONT_HD)) / 2);
    drawText(ctx, label, lx, PAUSE_BTN_Y[i] + 30, { ...hd, color: focused ? C_TEXT : C_DIM, scale: TEXT_LABEL });
  });
}

// --- Update -------------------------------------------------------------------
// Every screen's update() (title/cards/end below, battle.ts's own) is a
// COMPLETE tick on its own — regions.begin() -> add() -> regions.end() ->
// check activation -> input.endFrame() — exactly like the pattern in
// handling-user-input's SKILL.md. Exactly one of them runs per tick, chosen
// by scene/phase below; this file must never ALSO touch regions or endFrame
// around the call (a second begin/end would re-resolve this tick's
// pointer/dirPressed edges; a second endFrame would clear them before the
// screen's own check ever saw them). juice/particles are the one exception:
// battle.ts ticks them itself, so this file ticks them only when battle isn't
// the active screen.
function update(dt: number): void {
  clock += dt;

  if (scenes.is('PLAYING') && run && run.state().phase === 'BATTLE') {
    if (!activeBattle) {
      activeBattle = run.beginBattle();
      lastHeroKillAttacker = null;
      battleScreen.begin(activeBattle, { act: 1, lap: 1, score: run.score, biome: RUN_BIOME.name });
    }
    scanBattleEvents(activeBattle);
    battleScreen.update(dt);
    const result = battleScreen.result();
    if (result) {
      const enriched: BattleResult = lastHeroKillAttacker
        ? { ...result, ...({ deathBy: lastHeroKillAttacker } as Partial<BattleResult>) }
        : result;
      run.afterBattle(enriched);
      activeBattle = null;
    }
    if (run.score !== lastScore) { lastScore = run.score; runtime.scoreChanged(lastScore); }
    return;
  }

  juice.update(dt);
  particles.update(dt);

  if (scenes.is('TITLE')) {
    titleScreen.update(dt);
  } else if (scenes.is('PLAYING') && run) {
    const phase = run.state().phase;
    if (phase !== lastRunPhase) {
      lastRunPhase = phase;
      if (phase === 'GAME_OVER') scenes.to('GAME_OVER');
      else if (phase === 'VICTORY') scenes.to('WIN');
    }
    if (scenes.is('PLAYING')) {
      // Read the edge BEFORE cardsScreen.update() clears it with its own endFrame().
      const pausePressed = input.pressed('PAUSE');
      cardsScreen.update(dt, run);
      if (pausePressed) scenes.to('PAUSED');
    }
    if (run.score !== lastScore) { lastScore = run.score; runtime.scoreChanged(lastScore); }
  } else if (scenes.is('PAUSED')) {
    updatePauseOverlay();
  } else if ((scenes.is('GAME_OVER') || scenes.is('WIN')) && run) {
    endScreen.update(dt, run);
  }
}

// --- Render ---------------------------------------------------------------------
// Same rule: the battle screen clears, wraps juice pre/postRender, draws
// particles and applies its OWN CRT pass internally, so it is the only thing
// drawn on a battle frame. Every other scene shares this file's own pipeline.
function render(): void {
  if (run && run.state().phase === 'BATTLE') {
    battleScreen.render(clock);
    return;
  }

  pc.clear(PICO8[0]);
  juice.preRender(pc.ctx);

  if (scenes.is('TITLE')) {
    titleScreen.render(clock);
  } else if ((scenes.is('PLAYING') || scenes.is('PAUSED')) && run) {
    cardsScreen.render(clock, run);
    particles.render(pc.ctx);
    if (scenes.is('PAUSED')) renderPauseOverlay();
  } else if ((scenes.is('GAME_OVER') || scenes.is('WIN')) && run) {
    endScreen.render(clock, run);
  }

  juice.postRender(pc.ctx, W, H);
  if (arcade) crt.render(pc.ctx, W, H, 1 / 60);
}

createLoop({ update, render }).start();
