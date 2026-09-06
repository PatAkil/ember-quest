// Ember Quest v3 — boot, loop, scene routing, input dispatch.
//
// Phase 6a: the whole run is playable. The engine scene machine stays the
// enforced five (TITLE → PLAYING ⇄ PAUSED → (GAME_OVER | WIN) → restart) and
// every scene entry sends the one runtime message it owns (messaging-game-over).
// The finer phase INSIDE PLAYING is not a machine at all — it is DERIVED from
// what the run seam is waiting on:
//
//     phase = run.pending()?.kind ?? 'ROOM'
//
// game/sim/runstep.ts walks game/sim/run.ts's generator and stops on one
// `RunPending`; screens/run.ts adapts it (and raises the one thing the seam has
// no pending for, the room card); this file routes that pending to the screen
// that draws it and hands the screen's answer straight back. No rule, no
// legality check and no fallback lives here: an illegal answer travels into
// run.ts untouched and that decision's own documented default decides it.
//
//   pending      screen                        answer
//   ─────────────────────────────────────────────────────────────────────
//   (pre-run)    vault.ts   EQUIP              {equip, ascension} → RunConfig
//   DRAFT        draft.ts   DRAFT              index
//   VAULT_EQUIP  — answered from the pre-run screen's list
//   SUMMON       draft.ts   SUMMON             index | {swap,out} | null
//   LEADER       party.ts   leaderEnabled      member index (B keeps the seat)
//   ROUTE        map.ts                        index into offeredIdxs
//   (room card)  cards.ts   ROOM               CONTINUE
//   BATTLE       battle.ts                     {result, forfeit}
//   RELIC        cards.ts   CARDS + wear row   {card, onto} | null
//   REST/SHRINE/FORGE/ALTAR   node.ts          per face
//   LAP          vault.ts   DOORS              'DESCEND' | 'LAP'
//   BANK         vault.ts   BANK               {take, drop}
//
// PAUSE/INSPECT/ARCADE persist exactly as before: PAUSE outside of battle is
// this file's own overlay (the region table's generic "pause" row) above EVERY
// non-battle screen — each screen carries its own on-screen pause icon, because
// a phone has no P key — and PAUSE mid-battle is forwarded to the battle
// screen, which owns its own pause-and-forfeit flow.
//
// ONE SCENE. `engine/light.ts` is created here, once, and handed to every
// screen: the diorama bakes per (biome, tier), and the title, the map, the
// card, the node screens, the end screens and this file's pause overlay all
// draw over the same lit biome the battle does, in the battle's own order
// (renderBackground → world → renderLightPlane → renderPost, HUD last and
// un-bloomed). ARCADE lives here for the same reason: it swaps the light module
// to its flat tier AND applies the CRT, and "bloom XOR CRT halation" is a rule
// about the whole frame, not about one screen.
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
import { ACTS, SLOTS, VAULT_EQUIP_MAX } from './types';
import type { RunConfig, RunResult } from './types';
import {
  CANVAS_W, CANVAS_H, PAUSE_BTN, PAUSE_BTN_X, PAUSE_BTN_Y, PAUSED_TEXT_Y, SAFE_INSET,
} from './screens/layout';
import { ACCENT, EDGE_LIT, PLATE_RADIUS, drawPrimaryButton, focusGlow, hudText, hudTextCentered, hudWidth, plate } from './screens/hud';
import { createRunScreen, runConfig } from './screens/run';
import type { HeroChoice, RunScreen } from './screens/run';
import { createCardsScreen } from './screens/cards';
import { createTitleScreen } from './screens/title';
import { createEndScreen } from './screens/end';
import { createBattleScreen } from './screens/battle';
import { FACE_ID, createDraftScreen } from './screens/draft';
import type { DraftAnswer, DraftProps } from './screens/draft';
import { createMapScreen } from './screens/map';
import type { MapProps } from './screens/map';
import { createPartyScreen } from './screens/party';
import type { PartyProps } from './screens/party';
import { createNodeScreen } from './screens/node';
import type { NodeAnswer, NodeProps } from './screens/node';
import { ASCENSION_MAX, clampAscension, createVaultScreen, loadVault, saveVault } from './screens/vault';
import type { VaultAnswer, VaultProps, VaultSave } from './screens/vault';
import { mulberry32 } from './sim/rng';
import { backdropFor } from './art/backdrops';
import { BIOMES } from './data';

/** Dev only — Vite substitutes `false` in the Pages build, so every block guarded by it folds away. */
const DEV = (import.meta as unknown as { env: { DEV: boolean } }).env.DEV;

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

// --- The run ------------------------------------------------------------------
let run: RunScreen | null = null;
let activeBattle: Battle | null = null;
let lastRunPhase: string | null = null;
/**
 * The hero turns of the battle now on screen, as the player played them. The
 * battle screen resolves a turn from ITS activations — a `skill-N` row, then an
 * `enemy-N`/`hero-N` target where the skill takes one — and those activations
 * are resolved on this file's own region registry, so they can be read back
 * here without the screen having to report anything. A turn is committed the
 * frame the battle phase leaves the hero's half of it.
 *
 * This is the one thing a replay cannot re-derive: `battle.rng` IS the run's
 * rng, so a battle answered by different choices consumes a different stream
 * and every later room diverges. See screens/run.ts's `HeroChoice`.
 */
const heroChoices: HeroChoice[] = [];
let turnActorId: string | null = null;
let turnSkill = -1;
let turnTarget = -1;
let lastScore = 0;
let clock = 0;

/**
 * The Vault, read once at boot and rewritten the moment a run ends
 * (screens/vault.ts owns the key and the parsing; a corrupt payload comes back
 * as an empty Vault rather than throwing). DESIGN.md → The Vault.
 */
let vaultSave: VaultSave = loadVault();
/**
 * The one screen that cannot be a pending: `RunConfig.ascension` has to be
 * known before `createRun` draws its first number, and the ascension stepper
 * sits on the Vault's EQUIP face — so that face is shown BEFORE the run and its
 * two answers part ways here. The ascension goes into the config; the equip
 * list is held and handed to the run's own VAULT_EQUIP pending when it arrives
 * (after the draft, since the starter has to exist before relics can be worn on
 * them). The player answers it once and sees it once.
 */
let preRun: 'VAULT' | null = null;
let heldEquip: number[] = [];
let chosenAscension = 0;
/** The party screen opened over the map (its PARTY button, or B) — not a pending, a look at the party. */
let partyOpen = false;
/** Which screen owned the last frame — the edge that decides where the keyboard lands (see focusOnOpen). */
let lastScreenKey = '';

/** The run's seed and the config it was built with — a replay's other two inputs beside the decision log. */
let runSeed = 0;
let runCfg: RunConfig = runConfig();
function nextSeed(): number {
  if (DEV) {
    const q = new URLSearchParams(window.location.search).get('seed');
    const n = Number(q);
    if (q !== null && q !== '' && Number.isFinite(n)) return n >>> 0;
  }
  return (Math.random() * 0x100000000) >>> 0;
}

/** TITLE's START, and RETRY/CONTINUE: the Vault face first when there is anything to choose, else straight in. */
function beginNewRun(): void {
  partyOpen = false;
  chosenAscension = clampAscension(chosenAscension, 0, vaultSave.unlockedAscension);
  if (vaultSave.vault.length > 0 || vaultSave.unlockedAscension > 0) {
    preRun = 'VAULT';
    run = null;
    activeBattle = null;
    lastRunPhase = null;
    if (!scenes.is('PLAYING')) scenes.to('PLAYING');
    return;
  }
  heldEquip = [];
  startRun();
}

function startRun(): void {
  preRun = null;
  partyOpen = false;
  runSeed = nextSeed();
  runCfg = runConfig({
    ascension: chosenAscension,
    vault: [...vaultSave.vault],
    vaultSlots: vaultSave.vaultSlots,
  });
  run = createRunScreen(mulberry32(runSeed), runCfg);
  activeBattle = null;
  lastRunPhase = null;
  lastScore = 0;
  useBiome(run.biome().name);
  if (!scenes.is('PLAYING')) scenes.to('PLAYING');
}

/**
 * The run is over: the Vault is what it leaves behind. `RunResult.banked` is
 * already the WHOLE new Vault (run.ts's resolveBank returns vault − drop +
 * take, trimmed to VAULT_SIZE), `vaultSlots` is next run's
 * min(VAULT_EQUIP_MAX, actsCleared), and the ascension unlock is granted on the
 * run's first act-6 kill (DESIGN.md → Laps, The Vault).
 */
function persistVault(result: RunResult): void {
  const clearedSix = result.actsCleared >= ACTS;
  vaultSave = {
    version: vaultSave.version,
    vault: [...result.banked],
    vaultSlots: Math.min(VAULT_EQUIP_MAX, result.actsCleared),
    unlockedAscension: Math.max(
      vaultSave.unlockedAscension,
      clearedSix ? Math.min(ASCENSION_MAX, result.ascension + 1) : 0,
    ),
  };
  saveVault(vaultSave);
}

// --- Answers ------------------------------------------------------------------
// Each of these is a one-liner on purpose: the screen already drew the
// enumerated options the pending carried, so the answer is passed through
// verbatim. Nothing is validated here — run.ts owns every fallback.
function onDraftAnswer(answer: DraftAnswer): void {
  if (!run) return;
  if (answer.kind === 'DRAFT') run.answer(answer.index);
  else if (answer.kind === 'SUMMON') run.answer(answer.answer);
  // REBRAND is the node screen's own inner use of the draft grid; it answers there.
}
function onNodeAnswer(answer: NodeAnswer): void {
  if (!run) return;
  if (answer.kind === 'SHRINE') run.answer(answer.take);
  else if (answer.kind === 'FORGE') run.answer(answer.answer);
  else if (answer.kind === 'ALTAR') run.answer(answer.index);
  else run.answer(answer.answer); // REST
}
function onVaultAnswer(answer: VaultAnswer): void {
  if (answer.kind === 'EQUIP') {
    // The two halves part ways: the ascension is config, the equip list is the
    // run's own VAULT_EQUIP answer, held until that pending arrives.
    heldEquip = [...answer.equip];
    chosenAscension = answer.ascension;
    startRun();
    return;
  }
  if (!run) return;
  if (answer.kind === 'DOORS') run.answer(answer.door);
  else run.answer({ take: answer.take, drop: answer.drop });
}
/** The party screen's BACK. With a LEADER pending open it is not "go away" — it is the seam's own default. */
function onPartyBack(): void {
  const p = run?.pending();
  if (run && p && p.kind === 'LEADER') { run.answer(run.view().party.leader); return; }
  partyOpen = false;
}
function onLeaderPick(member: number): void {
  const p = run?.pending();
  if (run && p && p.kind === 'LEADER') { run.answer(member); return; }
  partyOpen = false;
}

// --- Screens (created once; each is handed the props its pending carries) -----
const onPause = (): void => { scenes.to('PAUSED'); };

const titleScreen = createTitleScreen({
  pc, input, regions, audio, light, scene: renderScene, onStart: beginNewRun,
  vaultLine: () => {
    const bits: string[] = [];
    if (vaultSave.vault.length > 0) bits.push(`VAULT ${vaultSave.vault.length} . ${vaultSave.vaultSlots} TO EQUIP`);
    if (vaultSave.unlockedAscension > 0) bits.push(`A${vaultSave.unlockedAscension} UNLOCKED`);
    return bits.join('   .   ');
  },
});
const cardsScreen = createCardsScreen({ pc, input, regions, audio, scene: renderScene, onPause });
const endScreen = createEndScreen({
  pc, input, regions, audio, light, scene: renderScene, onRetry: beginNewRun, onContinue: beginNewRun,
});
const battleScreen = createBattleScreen({
  pc, input, regions, audio, juice, particles, crt, light, arcade, setBiome: useBiome,
});
const draftScreen = createDraftScreen({
  pc, input, regions, audio, scene: renderScene, onPause, onAnswer: onDraftAnswer,
});
const mapScreen = createMapScreen({
  pc, input, regions, audio, scene: renderScene, onPause,
  onRoute: (choice) => run?.route(choice),
  onParty: () => { partyOpen = true; },
});
const partyScreen = createPartyScreen({
  pc, input, regions, audio, scene: renderScene, onPause,
  onBack: onPartyBack, onLeader: onLeaderPick, onSwap: () => { partyOpen = false; },
});
const nodeScreen = createNodeScreen({
  pc, input, regions, audio, scene: renderScene, onPause, onAnswer: onNodeAnswer,
});
const vaultScreen = createVaultScreen({
  pc, input, regions, audio, scene: renderScene, onPause, onAnswer: onVaultAnswer,
});

// The title stands in act 1's biome, so the first act needs no swap on the way in.
useBiome(BIOMES[0].name);

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

// --- The router ---------------------------------------------------------------
/**
 * Which screen owns the frame. Everything but the two pre-run/overlay cases is
 * `pending()?.kind`; screens/run.ts collapses BATTLE, RELIC and its own room
 * card into the three phases the phase-4 screens already spoke.
 */
type ScreenKey =
  | 'NONE' | 'PRE_VAULT' | 'PARTY' | 'ROOM' | 'ACT_CLEAR' | 'CARDS' | 'BATTLE'
  | 'DRAFT' | 'VAULT_EQUIP' | 'SUMMON' | 'LEADER' | 'ROUTE' | 'RELIC'
  | 'REST' | 'SHRINE' | 'FORGE' | 'ALTAR' | 'LAP' | 'BANK';

/**
 * The keyboard's landing spot when a screen opens. Only the SUMMON asks for
 * one: it arrives directly behind the draft, which leaves the focus on its own
 * CONTINUE (slot 0 is pre-picked there), and a SUMMON's CONTINUE is disabled
 * until something is chosen — so the keyboard would land on a dead seat. Its
 * first offer is the honest spot. screens/draft.ts gives each face its own id
 * namespace (`FACE_ID`), so this names the SUMMON's first card rather than a
 * literal that a rename could quietly break. `focus()` is validated at the next
 * end(), so setting it here — before the screen registers — is in time.
 */
function focusOnOpen(key: ScreenKey): void {
  if (key === 'SUMMON') regions.focus(`${FACE_ID.SUMMON}-0`);
}

function screenKey(): ScreenKey {
  if (preRun === 'VAULT') return 'PRE_VAULT';
  if (!run) return 'NONE';
  const phase = run.state().phase;
  if (phase === 'ACT_CLEAR') return 'ACT_CLEAR';
  if (phase === 'ROOM') return 'ROOM';
  if (phase === 'CARDS') return 'CARDS';
  if (phase === 'BATTLE') return 'BATTLE';
  const p = run.pending();
  if (!p) return 'NONE';
  if (p.kind === 'LEADER') return 'LEADER';
  if (partyOpen) return 'PARTY';
  return p.kind;
}

// The props every screen takes are plain objects that mirror the pending
// field-for-field, plus the live view. They are rebuilt per tick rather than
// cached: the run only moves on an answer, and each screen re-syncs off its own
// payload key, so a fresh object with the same contents changes nothing.
function draftProps(): DraftProps | null {
  const p = run?.pending();
  if (!run || !p) return null;
  if (p.kind === 'DRAFT') return { kind: 'DRAFT', view: run.view(), roster: p.roster };
  if (p.kind === 'SUMMON') {
    // The EPIC a full party is offered is not in this pending: taking it
    // (answer 0) raises a RELIC pending with source 'SUMMON' right after.
    return { kind: 'SUMMON', view: run.view(), offers: p.offers, full: p.full, epic: null };
  }
  return null;
}
function mapProps(): MapProps | null {
  const p = run?.pending();
  if (!run || !p || p.kind !== 'ROUTE') return null;
  const v = run.view();
  return {
    view: v,
    map: p.map,
    // `stage` is where the OFFERED nodes live; the party is standing one stage back.
    stage: p.stage,
    nodeIdx: v.nodeIdx,
    offeredIdxs: p.offeredIdxs,
    offeredTypes: p.offeredTypes,
    taken: run.taken(),
  };
}
function partyProps(): PartyProps | null {
  if (!run) return null;
  const leader = run.pending()?.kind === 'LEADER';
  return {
    view: run.view(),
    leaderEnabled: leader,
    swapEnabled: false,
    title: leader ? 'WHO LEADS' : 'THE PARTY',
  };
}
function nodeProps(): NodeProps | null {
  const p = run?.pending();
  if (!run || !p) return null;
  const view = run.view();
  if (p.kind === 'SHRINE') return { kind: 'SHRINE', view, pact: p.pact, untakenCount: p.untakenCount, biome: run.biome().name };
  if (p.kind === 'FORGE') {
    return {
      kind: 'FORGE', view, worn: p.worn, options: p.options, pool: p.pool, levels: p.levels, rebrand: p.rebrand,
    };
  }
  if (p.kind === 'ALTAR') return { kind: 'ALTAR', view, candidates: p.candidates };
  if (p.kind === 'REST') return { kind: 'REST', view, candidates: p.candidates };
  return null;
}
function vaultProps(): VaultProps | null {
  if (preRun === 'VAULT') {
    return {
      kind: 'EQUIP',
      vault: vaultSave.vault,
      slots: vaultSave.vaultSlots,
      ascension: chosenAscension,
      unlockedAscension: vaultSave.unlockedAscension,
    };
  }
  const p = run?.pending();
  if (!run || !p) return null;
  const view = run.view();
  if (p.kind === 'LAP') return { kind: 'DOORS', view, banked: p.banked };
  if (p.kind === 'BANK') {
    return { kind: 'BANK', view, worn: p.worn, n: p.n, vault: p.vault, vaultSize: p.vaultSize };
  }
  return null;
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
  else if (act === 'pause-quit') {
    audio.play('blip');
    run = null;
    activeBattle = null;
    preRun = null;
    partyOpen = false;
    lastRunPhase = null;
    scenes.to('TITLE');
  }
  input.endFrame();
}

/**
 * The region table's pause row — dimScene, PAUSED, three buttons — drawn by the
 * battle screen's rules so the two overlays are one object: the LIVE screen
 * stays underneath, every label reads bright whether or not it holds focus, and
 * the ring is what says "focused". What sits under this overlay is the diorama
 * alone (render() skips the live screen while PAUSED — its text would otherwise
 * land in the gaps between the three PAUSE_BTN plates as a second layer of
 * English), so the dim only has to push scenery back, a step further than the
 * battle's.
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
    // Focus is the glow, here as everywhere — the cream 2-px ring is gone. The
    // border stays because THIS overlay is the contract's one place a line is
    // still the honest answer: over a 0.66 dim with no lit world behind them a
    // borderless plate dissolves. Same treatment as battle.ts's own overlay.
    if (focused) focusGlow(ctx, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, PLATE_RADIUS, ACCENT);
    plate(ctx, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, {
      border: EDGE_LIT, borderWidth: 1, alpha: focused ? 0.78 : 0.62,
    });
    hudTextCentered(ctx, label, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, { color: C_TEXT });
  });
}

// --- Update -------------------------------------------------------------------
// Every screen's update() (title/cards/end, the five phase-5 screens, battle.ts's
// own) is a COMPLETE tick on its own — regions.begin() -> add() -> regions.end()
// -> check activation -> input.endFrame(). EXACTLY ONE of them runs per tick,
// chosen by scene/pending below; this file must never ALSO touch regions or
// endFrame around the call (a second begin/end would re-resolve this tick's
// pointer/dirPressed edges; a second endFrame would clear them before the
// screen's own check ever saw them). juice/particles are the one exception:
// battle.ts ticks them itself, so this file ticks them only when battle isn't
// the active screen.
function update(dt: number): void {
  clock += dt;

  if (scenes.is('PLAYING') && run && run.state().phase === 'BATTLE') {
    if (!activeBattle) {
      const p = run.pending();
      activeBattle = run.beginBattle();
      heroChoices.length = 0;
      turnActorId = null;
      turnSkill = -1;
      turnTarget = -1;
      battleScreen.begin(activeBattle, {
        act: p && p.kind === 'BATTLE' ? p.act : run.view().act,
        lap: p && p.kind === 'BATTLE' ? p.lap : run.view().lap,
        score: run.score,
        biome: run.biome().name,
      });
    }
    run.armTick();
    // Whose turn is open, and how far into it we are, BEFORE the screen ticks.
    const wasHeroTurn = battleScreen.phase === 'HERO_SKILL' || battleScreen.phase === 'HERO_TARGET';
    if (battleScreen.phase === 'HERO_SKILL' && battleScreen.currentActorId) turnActorId = battleScreen.currentActorId;
    battleScreen.update(dt);
    // ...and what the player pressed on it. `activated()` holds the id this
    // tick resolved (the screen's own end() computed it), so reading it again
    // here consumes nothing and sees exactly what the screen acted on.
    const pressed = regions.activated();
    if (pressed) {
      if (pressed.startsWith('skill-')) turnSkill = Number(pressed.slice(6));
      else if (pressed.startsWith('enemy-')) turnTarget = Number(pressed.slice(6));
      else if (pressed.startsWith('hero-')) turnTarget = Number(pressed.slice(5));
    }
    const stillHeroTurn = battleScreen.phase === 'HERO_SKILL' || battleScreen.phase === 'HERO_TARGET';
    if (wasHeroTurn && !stillHeroTurn && turnSkill >= 0) {
      heroChoices.push({ actor: turnActorId ?? '', skill: turnSkill, target: turnTarget });
      turnSkill = -1;
      turnTarget = -1;
      turnActorId = null;
    }
    const result = battleScreen.result();
    if (result) {
      // A quit-to-forfeit (battleScreen's own `forfeit` tag) rides on the result
      // itself and run.ts reads it there: a won result comes back a loss, and
      // screens/run.ts remembers the RETREAT for the end screen's verdict line.
      // Who landed the killing blow is the seam's own `deathBy` now.
      run.afterBattle(result, heroChoices);
      activeBattle = null;
    }
    if (run.score !== lastScore) { lastScore = run.score; runtime.scoreChanged(lastScore); }
    return;
  }

  juice.update(dt);
  particles.update(dt);

  if (scenes.is('TITLE')) {
    titleScreen.update(dt);
    return;
  }
  if (scenes.is('PAUSED')) {
    updatePauseOverlay();
    return;
  }
  if ((scenes.is('GAME_OVER') || scenes.is('WIN')) && run) {
    endScreen.update(dt, run);
    return;
  }
  if (!scenes.is('PLAYING')) return;

  if (run) {
    // THE ACT-CLEAR BEAT HOLDS THE OUTGOING BIOME. The seam advances its act —
    // and with it `run.biome()` — the moment the boss's last reward is answered,
    // which is the same moment the beat is raised, so drawing `run.biome()`
    // under it printed "ACT 1 CLEARED / EMBER CRYPT" over the frost marsh: the
    // caption naming what you beat, the diorama showing where you are going.
    // `actClearedBiome` is the name recorded BEFORE the step, so the tableau
    // shows the crypt until the beat is dismissed and the map takes the frame.
    const st = run.state();
    useBiome(st.phase === 'ACT_CLEAR' ? st.actClearedBiome : run.biome().name);
    const phase = st.phase;
    if (phase !== lastRunPhase) {
      lastRunPhase = phase;
      const result = run.result();
      if (result) {
        persistVault(result);
        scenes.to(result.won ? 'WIN' : 'GAME_OVER');
      }
    }
    // The frame the run ends on still owes the registry a complete tick: the
    // scene has moved to GAME_OVER/WIN and the end screen's own update() does
    // not run until the next frame, so without this the pointer and dirPressed
    // edges raised on this one would survive into it and fire a button nobody
    // pressed there.
    if (!scenes.is('PLAYING')) { idleTick(); return; }
    // The run's own VAULT_EQUIP: already answered on the pre-run face, so it is
    // handed the list that face returned instead of asking a second time.
    if (run.pending()?.kind === 'VAULT_EQUIP') {
      run.armTick();
      run.answer(heldEquip);
      heldEquip = [];
    }
  }

  // Read the PAUSE edge BEFORE the screen's update() clears it with its own endFrame().
  const pausePressed = input.pressed('PAUSE');
  // One tick, one answer: the screen about to run answers against the token the
  // run is standing on NOW, so a second answer inside this same tick (a double
  // tap, a handler firing after the run already moved) is refused by the seam
  // instead of landing on the decision behind it.
  run?.armTick();
  const key = screenKey();
  if (key !== lastScreenKey) { lastScreenKey = key; focusOnOpen(key); }
  updateScreen(dt);
  if (pausePressed) scenes.to('PAUSED');
  if (run && run.score !== lastScore) { lastScore = run.score; runtime.scoreChanged(lastScore); }
}

/**
 * A complete tick with no screen behind it: begin -> end -> endFrame, so a
 * frame that registers nothing still CONSUMES this frame's edges instead of
 * leaving them for whatever screen runs next.
 */
function idleTick(): void {
  regions.begin();
  regions.end();
  input.endFrame();
}

/** The one screen update this tick. Each branch is a complete tick and ends the frame itself. */
function updateScreen(dt: number): void {
  switch (screenKey()) {
    case 'PRE_VAULT': case 'LAP': case 'BANK': {
      const props = vaultProps();
      if (props) { vaultScreen.update(dt, props); return; }
      break;
    }
    case 'DRAFT': case 'SUMMON': {
      const props = draftProps();
      if (props) { draftScreen.update(dt, props); return; }
      break;
    }
    case 'LEADER': case 'PARTY': {
      const props = partyProps();
      if (props) { partyScreen.update(dt, props); return; }
      break;
    }
    case 'ROUTE': {
      const props = mapProps();
      if (props) { mapScreen.update(dt, props); return; }
      break;
    }
    case 'SHRINE': case 'FORGE': case 'ALTAR': case 'REST': {
      const props = nodeProps();
      if (props) { nodeScreen.update(dt, props); return; }
      break;
    }
    case 'ACT_CLEAR':
      if (run) { endScreen.updateActClear(dt, run); return; }
      break;
    case 'ROOM': case 'CARDS': case 'RELIC':
      if (run) { cardsScreen.update(dt, run); return; }
      break;
    default:
      break;
  }
  // Nothing is standing (a torn frame between two answers, or the pre-run
  // title): still a complete tick, so this frame's edges are consumed like
  // every other.
  idleTick();
}

// --- Render ---------------------------------------------------------------------
// Same rule: the battle screen clears, wraps juice pre/postRender, draws the
// scene and applies its OWN CRT pass internally, so it is the only thing drawn
// on a battle frame. Every other scene shares this file's pipeline — clear, the
// screen (which opens with renderScene, and renderScene is where the juice
// transform opens and closes, then draws its HUD on the restored frame), and
// the CRT only when ARCADE is on.
function render(): void {
  if (scenes.is('PLAYING') && run && run.state().phase === 'BATTLE') {
    battleScreen.render(clock);
    return;
  }

  const t0 = performance.now();
  pc.clear(PICO8[0]);

  if (scenes.is('TITLE')) {
    titleScreen.render(clock);
  } else if (scenes.is('PAUSED')) {
    // PAUSED over a screen shows the diorama alone: the pause row's contract
    // geometry sits exactly over the cards and the node columns, so any of their
    // text would land between the buttons as a second layer of English — the
    // battle keeps its live world behind its overlay, and the world here is the
    // scene.
    renderScene();
    renderPauseOverlay();
  } else if ((scenes.is('GAME_OVER') || scenes.is('WIN')) && run) {
    endScreen.render(clock, run);
  } else if (scenes.is('PLAYING')) {
    renderScreen();
  } else {
    renderScene(); // no run yet: the lit biome on its own, never a black frame
  }

  if (arcade.on) crt.render(pc.ctx, W, H, 1 / 60);
  // The same feedback the battle frame gives: 60 consecutive slow frames drop
  // the scene to LOW for good.
  light.note(performance.now() - t0);
}

function renderScreen(): void {
  switch (screenKey()) {
    case 'PRE_VAULT': case 'LAP': case 'BANK': {
      const props = vaultProps();
      if (props) { vaultScreen.render(clock, props); return; }
      break;
    }
    case 'DRAFT': case 'SUMMON': {
      const props = draftProps();
      if (props) { draftScreen.render(clock, props); return; }
      break;
    }
    case 'LEADER': case 'PARTY': {
      const props = partyProps();
      if (props) { partyScreen.render(clock, props); return; }
      break;
    }
    case 'ROUTE': {
      const props = mapProps();
      if (props) { mapScreen.render(clock, props); return; }
      break;
    }
    case 'SHRINE': case 'FORGE': case 'ALTAR': case 'REST': {
      const props = nodeProps();
      if (props) { nodeScreen.render(clock, props); return; }
      break;
    }
    case 'ACT_CLEAR':
      if (run) { endScreen.renderActClear(clock, run); return; }
      break;
    case 'ROOM': case 'CARDS': case 'RELIC':
      if (run) { cardsScreen.render(clock, run); return; }
      break;
    default:
      break;
  }
  renderScene();
}

createLoop({ update, render }).start();

// --- Dev state hook -------------------------------------------------------------
// The test driver reads the live scene, the open decision and the run off the
// page rather than guessing them from pixels. Dev only: Vite substitutes
// `import.meta.env.DEV` with `false` in the Pages build, so the whole block is
// constant-folded away — zero production impact. (The cast is how this file
// reaches `env` without pulling vite/client's ambient types into tsconfig; it
// leaves the member expression Vite actually substitutes untouched.)
if (DEV) {
  /**
   * The (column, row) each worn relic sits at on the party columns — geometry,
   * not a rule: `partyWorn` is member-major in SLOTS order, so a driver that
   * must tap the relic at worn index i taps cells[i]. FORGE and BANK only.
   */
  const wornCells = (): { m: number; row: number }[] => {
    const out: { m: number; row: number }[] = [];
    const members = run?.view().party.members ?? [];
    members.forEach((member, m) => {
      SLOTS.forEach((slot, row) => { if (member.relics[slot]) out.push({ m, row }); });
    });
    return out;
  };
  /**
   * The pending, JSON-safe and small: a driver needs to know WHAT is up and how
   * many options it has, not to carry a live Battle (or a whole RunMap) across
   * the bridge on every poll.
   */
  const pendingSummary = (): unknown => {
    if (preRun === 'VAULT') {
      return {
        kind: 'VAULT_EQUIP', pre: true, options: vaultSave.vault.length,
        slots: vaultSave.vaultSlots, unlockedAscension: vaultSave.unlockedAscension,
      };
    }
    const p = run?.pending();
    if (!p) {
      const done = run?.result();
      return done ? { kind: 'DONE', won: done.won } : null;
    }
    switch (p.kind) {
      case 'DRAFT': return { kind: p.kind, options: p.roster.length, roster: [...p.roster] };
      case 'VAULT_EQUIP': return { kind: p.kind, options: p.vault.length, slots: p.slots };
      case 'SUMMON': return {
        kind: p.kind, options: p.offers.length, full: p.full, opening: p.opening,
        offers: p.offers.map((o) => o.def.id),
      };
      case 'LEADER': return { kind: p.kind, members: p.party.members.length, leader: p.party.leader };
      case 'ROUTE': return {
        kind: p.kind, stage: p.stage, offeredIdxs: [...p.offeredIdxs], offeredTypes: [...p.offeredTypes],
        sizes: p.map.stages.map((s) => s.length),
      };
      case 'RELIC': return { kind: p.kind, cards: p.cards.length, source: p.source };
      case 'REST': return { kind: p.kind, candidates: [...p.candidates] };
      case 'SHRINE': return { kind: p.kind, pact: p.pact.id, untakenCount: p.untakenCount };
      case 'FORGE': return {
        kind: p.kind, worn: p.worn.length, levels: p.levels,
        options: p.options.map((o) => ({ relic: o.relic, mode: o.mode })), cells: wornCells(),
      };
      case 'ALTAR': return { kind: p.kind, candidates: [...p.candidates] };
      case 'BATTLE': return {
        kind: p.kind, source: p.source, act: p.act, lap: p.lap, biome: p.biome.name, packIds: [...p.packIds],
      };
      case 'LAP': return { kind: p.kind, banked: p.banked };
      case 'BANK': return {
        kind: p.kind, worn: p.worn.length, n: p.n, vault: p.vault.length, vaultSize: p.vaultSize,
        cells: wornCells(),
      };
      default: return null;
    }
  };

  (window as unknown as { __eq: unknown }).__eq = {
    scene: () => scenes.current,
    /** Which screen owns the frame — the router's own key, the pre-run face and the party overlay included. */
    phase: () => screenKey(),
    /** What the run is waiting on, JSON-safe (see pendingSummary). */
    pending: pendingSummary,
    run: () => run?.state() ?? null,
    /** The whole live view: act, lap, ascension, score, where the party stands, who is in it. */
    view: () => {
      if (!run) return null;
      const v = run.view();
      return {
        act: v.act, lap: v.lap, ascension: v.ascension, score: v.score, clears: v.clears,
        stage: v.stage, nodeIdx: v.nodeIdx, rooms: [...v.rooms], roomType: v.roomType,
        biome: v.biome.name, pactsTaken: [...v.pactsTaken], phase: v.phase, over: v.over,
        members: v.party.members.map((m) => ({ id: m.def.id, hp: m.hp, awakened: m.awakened })),
        leader: v.party.leader,
      };
    },
    /** The finished run, if it is finished. */
    result: () => run?.result() ?? null,
    /**
     * The three inputs a headless replay needs: the seed, the config the run was
     * built with, and every answer given (a BATTLE answer carries the hero turns
     * that produced it — `battle.rng` is the run's own rng, so nothing less
     * reproduces the stream).
     */
    seed: () => runSeed,
    config: () => ({
      ascension: runCfg.ascension, vaultSlots: runCfg.vaultSlots,
      roster: [...runCfg.roster], vault: runCfg.vault.length,
    }),
    decisions: () => run?.decisions?.() ?? [],
    /** What each phase-5 screen believes it is showing (its own view(props)) — null when it is not up. */
    map: () => { const p = mapProps(); return p ? mapScreen.view(p) : null; },
    party: () => { const p = partyProps(); return p ? partyScreen.view(p) : null; },
    draft: () => { const p = draftProps(); return p ? draftScreen.view(p) : null; },
    node: () => { const p = nodeProps(); return p ? nodeScreen.view(p) : null; },
    vault: () => { const p = vaultProps(); return p ? vaultScreen.view(p) : null; },
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
