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
// ONE SCENE. `engine/light.ts` is created here, once, and handed to every
// screen: the diorama bakes per (biome, tier) and the title, the room card,
// the relic offer, the end screens and this file's pause overlay all draw
// over the same lit crypt the battle does, in the battle's own order
// (renderBackground → world → renderLightPlane → renderPost, HUD last and
// un-bloomed). ARCADE lives here for the same reason: it swaps the light
// module to its flat tier AND applies the CRT, and "bloom XOR CRT halation"
// is a rule about the whole frame, not about one screen.
//
// STYLE CARD: PALETTE PICO8 for UI, element tints per actor layer (art/).
// TEXT the HUD face (screens/hud.ts) for everything the player reads as UI;
// bitmap FONT_HD only for the logo, card titles, door labels and damage pops.
// INPUT every tap target is a hit region; A/arrows route to it. CRT off by
// default; ARCADE is the toggle.

import {
  createPixelCanvas, createLoop, createInput, createScenes, createAudio, createRuntime,
  createHitRegions, setSafeInset, createJuice, createParticles, createCrt, createLight, pickBackingScale,
  dimScene, PICO8,
} from '../engine';
import type { BiomeLook, Light, LightActor, LightTier } from '../engine';
import type { Battle } from './sim/battle';
import { forecast } from './sim/battle';
import type { BattleResult } from './types';
import {
  CANVAS_W, CANVAS_H, PAUSE_BTN, PAUSE_BTN_X, PAUSE_BTN_Y, PAUSED_TEXT_Y, SAFE_INSET,
} from './screens/layout';
import { EDGE_LIT, FOCUS_RING, drawPrimaryButton, hudText, hudTextCentered, hudWidth, plate } from './screens/hud';
import { RUN_BIOME, createRunScreen } from './screens/run';
import type { RunPhase, RunScreen } from './screens/run';
import { createCardsScreen } from './screens/cards';
import { createTitleScreen } from './screens/title';
import { createEndScreen } from './screens/end';
import { createBattleScreen } from './screens/battle';
import { backdropFor } from './art/backdrops';

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

const C_TEXT = PICO8[7];
/** PAUSED in the HUD face, at roughly the height the contract's bitmap scale 4 drew (battle.ts's own number). */
const PAUSED_PX = 44;

// --- The scene ----------------------------------------------------------------
// One light module for the life of the page. It bakes a diorama per (biome,
// tier), so the title, the cards, the end screens and every battle share one
// bake — entering or leaving a battle swaps nothing and re-bakes nothing.
const BASE_TIER: LightTier = 'HIGH';
const light: Light = createLight({ width: W, height: H, tier: BASE_TIER });
let sceneBiome: BiomeLook | null = null;

/** Swaps the diorama (and the ambient field that goes with it); a no-op when that look is already up. */
function useBiome(name: string): void {
  const look = backdropFor(name);
  if (look === sceneBiome) return;
  sceneBiome = look;
  light.setBiome(look);
  // The look owns the ambient field too: the flat tiers draw it, the HD tiers
  // let the light plane's own motes and fog do that job.
  particles.setAmbient(look.ambient, look.ambientColor);
}

/**
 * ARCADE, owned here because it is a rule about the whole frame: ON = the light
 * module at its flat ARCADE tier PLUS crt.render; OFF = the HD tier and no CRT
 * call at all. Bloom and CRT halation are the same effect and exactly one is
 * alight. Every screen reads this one flag, so a toggle in the battle's pause
 * menu still holds on the room card and the title.
 */
let arcadeOn = false;
const arcade = {
  get on(): boolean {
    return arcadeOn;
  },
  toggle(): void {
    arcadeOn = !arcadeOn;
    light.setTier(arcadeOn ? 'ARCADE' : BASE_TIER);
  },
};
/** The flat tiers have no light plane, so the engine's ambient field is their dust. */
function flatTier(): boolean {
  const t = light.tier();
  return t === 'LOW' || t === 'ARCADE';
}

/**
 * The one out-of-battle scene pass, in the battle screen's own order:
 * preRender → diorama → world → light plane → postRender → post. The juice
 * transform OPENS and CLOSES in here, exactly as it does inside battle.render,
 * so the bloom, the grade and every screen's HUD are drawn on the restored
 * frame: a shake can never offset the bloom, and a flash can never paint over a
 * number the player has to read. Every screen calls this first thing in its
 * render and then draws its HUD on top, un-shaken, un-bloomed and un-graded.
 */
function renderScene(drawWorld?: () => void, actors?: readonly LightActor[]): void {
  const ctx = pc.ctx;
  juice.preRender(ctx);
  const shake = juice.offset();
  light.renderBackground(ctx, { time: clock, shakeX: shake.x, shakeY: shake.y });
  if (flatTier()) particles.render(ctx);
  drawWorld?.();
  light.renderLightPlane(ctx, { time: clock, actors });
  juice.postRender(ctx, W, H); // restore the shake, then the flash
  light.renderPost(ctx, { time: clock });
}

// --- Screens (created once; each reads screens/run.ts's state on its own) ----
let run: RunScreen | null = null;
let activeBattle: Battle | null = null;
let lastHeroKillAttacker: string | null = null;
let lastRunPhase: RunPhase | null = null;
let lastScore = 0;
let clock = 0;

function startRun(): void {
  run = createRunScreen(Math.random);
  activeBattle = null;
  lastHeroKillAttacker = null;
  lastRunPhase = null;
  lastScore = 0;
  scenes.to('PLAYING');
}

const titleScreen = createTitleScreen({ pc, input, regions, audio, light, scene: renderScene, onStart: startRun });
const cardsScreen = createCardsScreen({
  pc, input, regions, audio, scene: renderScene,
  // The room card and every relic screen need their own on-screen route to PAUSED — a phone has no P key,
  // and until now only the battle screen's ribbon carried this icon (DESIGN.md's Input section: "PAUSE ...
  // have on-screen targets — because a phone has no keys" is a whole-game rule, not a battle-only one).
  onPause: () => scenes.to('PAUSED'),
});
const endScreen = createEndScreen({ pc, input, regions, audio, light, scene: renderScene, onRetry: startRun, onContinue: startRun });
const battleScreen = createBattleScreen({
  pc, input, regions, audio, juice, particles, crt, light, arcade, setBiome: useBiome,
});

// The slice never leaves the EMBER CRYPT, so the title already stands in the
// biome the first battle will use: one bake, and no swap on the way in.
useBiome(RUN_BIOME.name);

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
  else if (act === 'pause-arcade') { audio.play('blip'); arcade.toggle(); }
  else if (act === 'pause-quit') { audio.play('blip'); scenes.to('TITLE'); }
  input.endFrame();
}

/**
 * The region table's pause row — dimScene, PAUSED, three buttons — drawn by the
 * battle screen's rules so the two overlays are one object: the LIVE screen
 * stays underneath (the card the player paused on, not an empty crypt), every
 * label reads bright whether or not it holds focus, and the ring is what says
 * "focused". What sits under this overlay is the diorama alone (render()
 * skips the card screen while PAUSED — its text would otherwise land in the
 * gaps between the three PAUSE_BTN plates as a second layer of English), so
 * the dim only has to push scenery back, a step further than the battle's.
 */
const PAUSE_DIM = 0.7;

function renderPauseOverlay(): void {
  const ctx = pc.ctx;
  dimScene(pc, PAUSE_DIM);
  const title = 'PAUSED';
  const tw = hudWidth(ctx, title, PAUSED_PX, 200);
  hudText(ctx, title, (W - tw) / 2, PAUSED_TEXT_Y, { px: PAUSED_PX, weight: 200, color: C_TEXT });
  const labels: [string, string][] = [
    ['pause-resume', 'RESUME'],
    ['pause-arcade', `ARCADE ${arcade.on ? 'ON' : 'OFF'}`],
    ['pause-quit', 'QUIT TO TITLE'],
  ];
  // The same two-button language the battle's overlay speaks: RESUME is the
  // primary (a lit plate), and every other button is BORDERED so none of them
  // can dissolve into the dimmed scene behind it.
  labels.forEach(([id, label], i) => {
    const focused = regions.focused() === id;
    const y = PAUSE_BTN_Y[i];
    if (i === 0) {
      drawPrimaryButton(ctx, PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, label, focused);
      return;
    }
    const ph = 56;
    const py = y + (PAUSE_BTN.h - ph) / 2;
    plate(ctx, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, {
      border: focused ? FOCUS_RING : EDGE_LIT, borderWidth: focused ? 2 : 1, alpha: 0.62,
    });
    hudTextCentered(ctx, label, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, { color: C_TEXT });
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
      // A quit-to-forfeit (battleScreen's own `forfeit` tag, set the same ad hoc way this file tags
      // `deathBy`) always outranks an earlier kill this same battle: the run is ending because the
      // player walked away, not because of a teammate who died and was then fought on past.
      const forfeited = (result as unknown as { forfeit?: boolean }).forfeit === true;
      const enriched: BattleResult = forfeited
        ? { ...result, ...({ deathBy: 'RETREAT' } as Partial<BattleResult>) }
        : lastHeroKillAttacker
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
// Same rule: the battle screen clears, wraps juice pre/postRender, draws the
// scene and applies its OWN CRT pass internally, so it is the only thing drawn
// on a battle frame. Every other scene shares this file's pipeline — clear, the
// screen (which opens with renderScene, and renderScene is where the juice
// transform opens and closes, then draws its HUD on the restored frame), and
// the CRT only when ARCADE is on.
function render(): void {
  if (run && run.state().phase === 'BATTLE') {
    battleScreen.render(clock);
    return;
  }

  const t0 = performance.now();
  pc.clear(PICO8[0]);

  if (scenes.is('TITLE')) {
    titleScreen.render(clock);
  } else if (scenes.is('PAUSED') && run) {
    // PAUSED over a card screen shows the diorama alone: the pause row's contract geometry sits
    // exactly over the card, so any card text would land between the buttons as a second layer of
    // English — the battle keeps its live world behind its overlay, and the world here is the scene.
    renderScene();
    renderPauseOverlay();
  } else if (scenes.is('PLAYING') && run) {
    cardsScreen.render(clock, run);
  } else if ((scenes.is('GAME_OVER') || scenes.is('WIN')) && run) {
    endScreen.render(clock, run);
  } else {
    renderScene(); // no run yet: the lit crypt on its own, never a black frame
  }

  if (arcade.on) crt.render(pc.ctx, W, H, 1 / 60);
  // The same feedback the battle frame gives: 60 consecutive slow frames drop
  // the scene to LOW for good.
  light.note(performance.now() - t0);
}

createLoop({ update, render }).start();

// --- Dev state hook -------------------------------------------------------------
// The test driver reads the live scene, run phase and battle phase off the page
// rather than guessing them from pixels. Dev only: Vite substitutes
// `import.meta.env.DEV` with `false` in the Pages build, so the whole block is
// constant-folded away — zero production impact. (The cast is how this file
// reaches `env` without pulling vite/client's ambient types into tsconfig; it
// leaves the member expression Vite actually substitutes untouched.)
if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) {
  (window as unknown as { __eq: unknown }).__eq = {
    scene: () => scenes.current,
    run: () => run?.state() ?? null,
    battle: () => battleScreen.phase,
    /** Whose turn it is (def.id), for the dev state hook and nothing else — mirrors `battle()`. */
    battleActor: () => battleScreen.currentActorId,
    /** The live sim Battle (heroes/enemies/log/events), for a driver to read exact numbers or
     * force a status onto a LIVE actor (e.g. enemies[i].statuses.push(...)) the same way `run().party`
     * is already used to force a hero's hp before a fight. Dev only, same as every field above. */
    battleObj: () => activeBattle,
    /** The exact ribbon forecast (def.id per queue slot) — the same pure function drawRibbonQueue()
     * calls, so a driver can assert "who acts next" against it turn over turn without reading pixels. */
    forecastIds: () => (activeBattle ? forecast(activeBattle, 8).map((a) => a.def.id) : []),
    /**
     * Which region the registry resolves the POINTER to this frame. A QA driver
     * moves the mouse over a grid and reads this back, which is the only way to
     * prove that no strip between two hit rects resolves to the wrong one —
     * pixels cannot show it and geometry alone cannot, since the answer depends
     * on the registry's two-pass order. Dev only, like every field above.
     */
    regionAt: () => regions.hovered(),
    /** Where the KEYBOARD is. The pause overlay replaces the region pool, so
     * proving that resume puts the focus back where the player left it is not
     * something a frame can show — only this can. Dev only. */
    focusedId: () => regions.focused(),
    /** Whether the battle screen is PAUSED — the one state that freezes update()
     * while render() keeps going, so a driver can tell "frozen" from "slow". Dev only. */
    battlePaused: () => battleScreen.paused,
  };
}
