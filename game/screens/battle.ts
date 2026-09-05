// Ember Quest v3 — game/screens/battle.ts: the interactive 3v3 battle screen,
// phase 4's core. Drives the sim turn by turn (createBattle/nextReady/runTurn
// built by sim/battle.ts in parallel), presenting a hero's turn as a skill
// bar + target flow and every actor's turn as a paced playback of
// `battle.events`. DESIGN.md → Presentation (Canvas and scale, HD-2D,
// Layered actors, Procedural VFX, Input, UI constraints) and → Combat.
//
// HD-2D, per the contract. The scene is `engine/light.ts`, driven at the
// caller's tier: renderBackground (diorama planes, parallaxed by the live
// shake) → contact shadows → actors, the one pixelated plane, in painter's
// order → gauges → renderLightPlane (near plane, key light, rim, prop glow,
// fog, dust) → VFX → damage pops → renderPost (bloom + grade). The HUD lands
// LAST and un-bloomed: thin translucent plates and vector HUD_FONT text, so
// nothing the player reads is caught by the bloom or the grade. The ARCADE
// toggle swaps the light module to its flat LOW planes and hands the glow to
// the caller's CRT — bloom and halation are never both on.

import type {
  PixelCanvas, Input, HitRegions, Audio, Juice, ParticleSystem, Crt, Light, LightActor, LightTier,
} from '../../engine';
import { drawText, textWidth, FONT_HD, dimScene, createLight, PICO8 } from '../../engine';

import type { Battle, BattleEvent } from '../sim/battle';
import { nextReady, runTurn, isOver, battleOutcome, forecast, actOptions, intent } from '../sim/battle';
import type { ActOption, Actor, BattleResult, Element, EnemyDef, SetBonus, SetId, SkillId, Slot, StatusKind } from '../types';
import { ATB_TURN, SLOTS } from '../types';
import { SKILLS } from '../data/skills';
import { SETS } from '../data/sets';
import { wornRelics, activeSets, relicTitle, mainLine, substatLine } from '../sim/relics';

import { ACTOR_RECIPES, bakePose, drawActor, actorHitRect, ACTOR_W, BOSS_W } from '../art/actors';
import type { ActorRecipe, PoseName } from '../art/actors';
import { spawnVfx, updateVfx, renderVfx } from '../art/vfx';
import type { VfxInstance } from '../art/vfx';
import { backdropFor } from '../art/backdrops';

import {
  CANVAS_W, CANVAS_H, TEXT_POP, TEXT_POP_CRIT, TEXT_BODY, LOG_LINE_MAX,
  HUD_FONT, HUD_PX, HUD_SMALL, HUD_LARGE, HUD_LETTER_SPACING, PORTRAIT,
  PANEL_W, PANEL_H, PANEL_PAD, PANEL_X_HERO, PANEL_X_ENEMY, PANEL_Y, PANEL_ROW_GAP,
  PANEL_ROW_NAME_H, PANEL_ROW_HP_H, PANEL_ROW_ATB_H, STATUS_ICON, STATUS_ICON_MAX, ELEMENT_CHIP,
  QUEUE_LEN, QUEUE_CHIP, INTENT_BADGE, queueChipPos, intentBadgePos,
  NAME_X, NAME_Y, ENRAGE_CHIP, RIBBON_RIGHT, RIBBON_ACT_Y, RIBBON_SCORE_Y, PAUSE_ICON, PAUSE_ICON_HIT,
  HERO_FEET, ENEMY_FEET, BOSS_FEET, HP_GAUGE, ATB_GAUGE, STATUS_ABOVE_MAX, POP_HEAD_OFFSET,
  LOG_RECT, LOG_TEXT, SKILL_W, SKILL_H, SKILL_X, SKILL_Y, SKILL_HIT_H, SKILL_H_PHONE,
  INSPECT, INSPECT_NAME, INSPECT_ROW_ICON, inspectRowY, SET_BAND, SET_LINE_Y, BACK,
  PAUSE_BTN, PAUSE_BTN_X, PAUSE_BTN_Y, PAUSED_TEXT_Y, POP_MAX, isPhone,
} from './layout';

// ============================================================== the API ===
export interface BattleScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  juice: Juice;
  particles: ParticleSystem;
  crt?: Crt;
  /** The scene tier the host picked at boot. Defaults to HIGH; the ARCADE toggle overrides it while on. */
  tier?: LightTier;
}

export interface BattleScreenOpts {
  act: number;
  lap: number;
  score: number;
  biome: string;
}

export interface BattleScreen {
  begin(battle: Battle, opts: BattleScreenOpts): void;
  update(dt: number): void;
  render(time: number): void;
  result(): BattleResult | null;
  readonly paused: boolean;
  togglePause(): void;
}

/** Bars per second: a full (0..ATB_TURN) sweep takes 1/ATB_ANIM_RATE seconds. Presentation only — cannot
 * change an outcome, since it only drives how fast the ATB gauges chase the real, already-resolved atb. */
const ATB_ANIM_RATE = 2.5;
/** HP gauges ease too, at a faster, size-relative rate (a fraction of the bar's own maxHp per second). */
const HP_ANIM_RATE = 1.4;
/** Between an ENEMY becoming current and its turn actually firing — long enough to read the ribbon. */
const ENEMY_THINK_DELAY = 0.35;
/** Playback pacing per event kind (seconds of gap AFTER the event fires, before the next one can). */
const BEAT_GAP: Partial<Record<BattleEvent['kind'], number>> = {
  CAST: 0.16, HIT: 0.3, HEAL: 0.26, STATUS_APPLIED: 0.12, STATUS_RESISTED: 0.12,
  COUNTER: 0.18, DEATH: 0.4, BURN_TICK: 0.24, VEIL: 0.3,
};
/** Extra hold after the last scheduled beat, so a final hit pop is legible before the next turn starts. */
const PLAYBACK_TAIL = 0.35;

// --------------------------------------------------------- pose durations --
// Roughly one POSE_FRAMES/POSE_FPS cycle (12 fps): a single pass, not a loop.
const POSE_DUR: Record<PoseName, number> = { idle: Infinity, attack: 0.28, cast: 0.32, hurt: 0.22, dead: Infinity };

// ------------------------------------------------------------- element ui --
const ELEMENT_COLOR: Record<Element, string> = {
  FIRE: PICO8[9], WIND: PICO8[11], WATER: PICO8[12], LIGHT: PICO8[10], DARK: PICO8[2],
};

// -------------------------------------------------------------- gauges ----
/** A panel's HP row draws its bar this thin — the contract's "thin 4-px bar". */
const HP_BAR_H = 4;
/** ATB is a line, not a bar: 2 px in the panel and under an actor's feet alike. */
const ATB_LINE_H = 2;
/**
 * Under an actor's feet the contract's gauges keep their 96x12 / 96x6 footprint;
 * what changes is the colour. A saturated bar under every sprite fights the lit
 * scene, so the stage pair draws muted and slightly transparent — legible at a
 * glance, never the brightest thing on the plane. The panels keep the full-
 * strength colour, because that is where the player actually reads a number.
 */
const STAGE_GAUGE_ALPHA = 0.82;
/** "under the feet on the OUTER side": pushed away from the centre line so a gauge never lands on the actor standing one step in front. */
const STAGE_GAUGE_DX = 40;
const STAGE_HP_FILL = '#3fa860';
const STAGE_ATB_FILL = '#4f9fc4';
const STAGE_ATB_FLASH = '#e8c15a';
/** PAUSED, in the HUD face at roughly the height the contract's bitmap scale 4 drew. */
const PAUSED_PX = 44;

/**
 * Recipes that carry their own light — a flame staff, a cold orb, a halo. The
 * light module blooms these and adds a spill around the silhouette; everything
 * else only gets rim light. Values are the `glow` strength handed to
 * `renderLightPlane`, roughly "how much of the frame's light is this actor's".
 */
const ACTOR_GLOW: Record<string, number> = {
  EMBER: 0.9, TIDE: 0.55, LUMEN: 0.8, FROST_WISP: 1, FEN_FIRE: 1, PALE_SAINT: 0.85,
};

// -------------------------------------------------------------- statuses --
// No per-status icon art exists in the frozen art API (drawStatusGlow is a pulsing ring, not a discrete
// glyph) — a single distinguishing letter on a colour-coded chip is the pragmatic stand-in.
const STATUS_ABBR: Record<StatusKind, string> = {
  STUN: 'Z', DEF_BREAK: 'd', ATK_BREAK: 'a', SLOW: 's', BURN: 'B', HEAL_BLOCK: 'h',
  BRAND: 'r', SILENCE: 'x', GLANCE: 'g', ATK_UP: 'A', DEF_UP: 'D', SPD_UP: 'S',
  CRIT_UP: 'C', SHIELD: 'O', IMMUNITY: 'I', COUNTER: '!', INVINCIBLE: '*',
};
const DEBUFF_KINDS = new Set<StatusKind>([
  'STUN', 'DEF_BREAK', 'ATK_BREAK', 'SLOW', 'BURN', 'HEAL_BLOCK', 'BRAND', 'SILENCE', 'GLANCE',
]);
function statusColor(kind: StatusKind): string {
  if (DEBUFF_KINDS.has(kind)) return PICO8[8];
  if (kind === 'SHIELD' || kind === 'IMMUNITY' || kind === 'INVINCIBLE') return PICO8[12];
  return PICO8[11];
}

const SLOT_ABBR: Record<Slot, string> = {
  WEAPON: 'Wp', BOOTS: 'Bt', ARMOR: 'Ar', NECKLACE: 'Nk', CHALICE: 'Ch', TOME: 'Tm',
};

/** A set's bonus as one short line — screens render text, never raw SetBonus shape. */
function formatSetBonus(bonus: SetBonus): string {
  switch (bonus.kind) {
    case 'STAT_PCT': return `+${bonus.pct}% ${bonus.stat}`;
    case 'STAT_PTS': return `+${bonus.pts} ${bonus.stat}`;
    case 'EXTRA_TURN': return `${Math.round(bonus.chance * 100)}% extra turn`;
    case 'STUN_ON_HIT': return `${Math.round(bonus.chance * 100)}% stun on hit`;
    case 'LEECH': return `heal ${Math.round(bonus.fraction * 100)}% dealt`;
    case 'IMMUNITY_START': return `IMMUNITY ${bonus.turns}t, +${bonus.res} RES`;
    case 'ATB_ON_HIT': return `+${Math.round(bonus.fraction * 100)}% ATB on hit`;
    case 'COUNTER': return `${Math.round(bonus.chance * 100)}% counter`;
    case 'SHIELD_START': return `party SHIELD ${Math.round(bonus.fraction * 100)}%`;
    case 'DESTROY': return 'shreds max HP';
    default: return '';
  }
}

// ---------------------------------------------------------------- geometry --
/** Where an actor's feet stand on the diagonal stage — the boss position for a lone BOSS enemy. */
function feetFor(battle: Battle, actor: Actor): { x: number; y: number } {
  if (actor.side === 'HERO') return HERO_FEET[actor.slot] ?? HERO_FEET[0];
  if (isBossActor(battle, actor)) return BOSS_FEET;
  return ENEMY_FEET[actor.slot] ?? ENEMY_FEET[0];
}
function isBossActor(battle: Battle, actor: Actor): boolean {
  return actor.side === 'ENEMY' && battle.enemies.length === 1 && (actor.def as EnemyDef).kind === 'BOSS';
}
function recipeFor(actor: Actor) {
  return ACTOR_RECIPES[actor.def.id];
}
/** Approximate top-of-head, for the status row and hit pops ("pops at head + 64"). */
function headY(battle: Battle, actor: Actor): number {
  const h = isBossActor(battle, actor) ? BOSS_W : ACTOR_W;
  return feetFor(battle, actor).y - h * 0.88;
}

// --------------------------------------------------------------- pops ------
interface Pop { x: number; y: number; text: string; color: string; scale: number; age: number; dur: number; vy: number }

// ------------------------------------------------------------ portraits ---
/**
 * The ribbon's queue chips are actor portraits, per the contract. A portrait is
 * the recipe's own head: the idle pose baked once by the art pipeline, cropped
 * to the top of its silhouette and blown up into a PORTRAIT-square bitmap with
 * smoothing off, so the face keeps its hard pixels inside a smooth HUD.
 *
 * Baked once per (recipe, element) — eight chips a frame are eight drawImage
 * calls, no per-frame composition and no per-frame getImageData: the one alpha
 * scan happens here, at bake time, exactly as the plane bakes do.
 */
const PORTRAIT_CACHE = new Map<string, HTMLCanvasElement>();
/** How much of the silhouette's height is "the head" — the crop the portrait keeps. */
const PORTRAIT_HEAD_FRACTION = 0.42;

function portraitFor(recipe: ActorRecipe, element: Element): HTMLCanvasElement | null {
  const key = `${recipe.id}|${element}`;
  const hit = PORTRAIT_CACHE.get(key);
  if (hit) return hit;
  const pose = bakePose(recipe, 'idle', 0, element);
  const out = document.createElement('canvas');
  out.width = PORTRAIT;
  out.height = PORTRAIT;
  const ctx = out.getContext('2d');
  // The alpha scan runs off a scratch copy that declares willReadFrequently —
  // reading straight off the art pipeline's own bitmap would demote it to a
  // software canvas for the rest of the run, and it is drawn every frame.
  const scan = document.createElement('canvas');
  scan.width = pose.width;
  scan.height = pose.height;
  const src = scan.getContext('2d', { willReadFrequently: true });
  if (!ctx || !src) return null;
  src.drawImage(pose, 0, 0);

  // Alpha bounding box of the baked pose — a recipe's silhouette sits wherever
  // its parts put it inside the res-square, so the crop is measured, not assumed.
  let x0 = pose.width;
  let y0 = pose.height;
  let x1 = -1;
  let y1 = -1;
  const data = src.getImageData(0, 0, pose.width, pose.height).data;
  for (let y = 0; y < pose.height; y++) {
    for (let x = 0; x < pose.width; x++) {
      if (data[(y * pose.width + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  ctx.imageSmoothingEnabled = false;
  if (x1 < x0 || y1 < y0) return out; // fully transparent pose: an empty chip beats a crash
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const headH = Math.max(4, Math.round(bh * PORTRAIT_HEAD_FRACTION));
  // Square the crop around the silhouette's centre line so the face is centred.
  const side = Math.max(headH, Math.min(bw, Math.round(headH * 1.15)));
  const cx = x0 + bw / 2;
  const sx = Math.round(cx - side / 2);
  const scale = PORTRAIT / side;
  ctx.drawImage(pose, sx, y0, side, side, 0, 0, Math.round(side * scale), Math.round(side * scale));
  PORTRAIT_CACHE.set(key, out);
  return out;
}

/** Linear approach — used for both HP and ATB gauges: a constant SPEED (not a constant time), so a full
 * bar and a tiny nudge both read as motion at the same visual rate. */
function approach(cur: number, target: number, rate: number, dt: number): number {
  const diff = target - cur;
  const step = rate * dt;
  if (Math.abs(diff) <= step || step <= 0) return target;
  return cur + Math.sign(diff) * step;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// ============================================================== the screen ==
type Phase = 'HERO_SKILL' | 'HERO_TARGET' | 'ENEMY_PENDING' | 'PLAYBACK' | 'INSPECT' | 'DONE';

export function createBattleScreen(deps: BattleScreenDeps): BattleScreen {
  const { pc, input, regions, audio, juice, particles } = deps;
  const crt = deps.crt;

  let battle: Battle | null = null;
  let opts: BattleScreenOpts = { act: 1, lap: 1, score: 0, biome: '' };
  let phase: Phase = 'DONE';
  let returnPhase: Phase = 'HERO_SKILL';
  let currentActor: Actor | null = null;
  let pendingOptions: ActOption[] = [];
  let pendingSkillSlot = -1;
  let promptText = '';
  let inspectSlot = 0;
  let finalResult: BattleResult | null = null;
  let clock = 0;
  let enemyPendingTimer = 0;
  let playback: { ev: BattleEvent; at: number }[] = [];
  let playHead = 0;
  let playClock = 0;
  let playEndAt = 0;
  let arcadeOn = false;
  let paused = false;
  let lastCastSkill: SkillId = 'CINDER';

  // ------------------------------------------------------------- the scene --
  // One light module for the life of the screen: it caches a baked diorama per
  // (biome, tier), so `begin` only ever hands it a look.
  const baseTier: LightTier = deps.tier ?? 'HIGH';
  const light: Light = createLight({ width: CANVAS_W, height: CANVAS_H, tier: baseTier });
  /** Rebuilt once per frame from the live actor list — pooled, never reallocated. */
  const lightActors: LightActor[] = [];
  /** Last frame's full render cost in ms, fed back to light.note() so a slow device drops itself to LOW. */
  let lastFrameMs = 0;

  // A local mirror of the juice flash this screen raises (DEATH only), so
  // renderPost can bloom harder for its duration. juice owns the overlay; this
  // owns nothing but the number, and follows juice's own hold-then-fall shape.
  let flashLeft = 0;
  let flashDur = 0;
  function flashAlphaNow(): number {
    if (flashLeft <= 0 || flashDur <= 0) return 0;
    const t = flashLeft / flashDur;
    const HOLD = 0.12;
    const shape = t > 1 - HOLD ? 1 : (t / (1 - HOLD)) ** 2;
    return 0.75 * shape;
  }

  const poseState = new Map<Actor, { pose: PoseName; since: number }>();
  const shownHp = new Map<Actor, number>();
  const shownAtb = new Map<Actor, number>();
  const atbFlash = new Map<Actor, number>();
  const vfx: VfxInstance[] = [];
  let pops: Pop[] = [];

  function spawnPop(x: number, y: number, text: string, color: string, scale: number, dur = 0.85): void {
    if (pops.length >= POP_MAX) pops.shift();
    pops.push({ x, y, text, color, scale, age: 0, dur, vy: -40 });
  }

  function setPose(actor: Actor, pose: PoseName): void {
    const cur = poseState.get(actor);
    if (cur && cur.pose === 'dead') return; // dead is terminal
    poseState.set(actor, { pose, since: clock });
  }
  function poseOf(actor: Actor): { pose: PoseName; time: number } {
    const st = poseState.get(actor);
    if (!st) {
      poseState.set(actor, { pose: 'idle', since: clock });
      return { pose: 'idle', time: 0 };
    }
    if (st.pose !== 'idle' && st.pose !== 'dead' && clock - st.since > POSE_DUR[st.pose]) {
      st.pose = 'idle';
      st.since = clock;
    }
    return { pose: st.pose, time: clock - st.since };
  }

  function ensureShown(actor: Actor): void {
    if (!shownHp.has(actor)) shownHp.set(actor, actor.hp);
    if (!shownAtb.has(actor)) shownAtb.set(actor, actor.atb);
  }
  function allActors(b: Battle): Actor[] {
    return [...b.heroes, ...b.enemies];
  }
  function resetPresentation(b: Battle): void {
    poseState.clear();
    shownHp.clear();
    shownAtb.clear();
    atbFlash.clear();
    vfx.length = 0;
    pops = [];
    for (const a of allActors(b)) {
      poseState.set(a, { pose: a.alive ? 'idle' : 'dead', since: clock });
      shownHp.set(a, a.hp);
      shownAtb.set(a, a.atb);
    }
  }

  // -------------------------------------------------------- turn driving --
  function finishBattle(): void {
    if (!battle) return;
    finalResult = battleOutcome(battle);
    phase = 'DONE';
  }

  function scheduleNextTurn(): void {
    if (!battle) return;
    if (isOver(battle)) { finishBattle(); return; }
    const actor = nextReady(battle);
    if (!actor) { finishBattle(); return; } // defensive: isOver() already covers a side being empty
    ensureShown(actor);
    currentActor = actor;
    if (actor.side === 'HERO') {
      pendingOptions = actOptions(battle, actor);
      pendingSkillSlot = -1;
      promptText = '';
      phase = 'HERO_SKILL';
    } else {
      phase = 'ENEMY_PENDING';
      enemyPendingTimer = ENEMY_THINK_DELAY;
    }
  }

  /** Drains battle.events into a paced playback queue — the screen owns pacing, the sim owns the data. */
  function schedulePlayback(): void {
    if (!battle) return;
    let t = 0;
    playback = battle.events.map((ev) => {
      const at = t;
      t += BEAT_GAP[ev.kind] ?? 0;
      return { ev, at };
    });
    battle.events.length = 0;
    playHead = 0;
    playClock = 0;
    playEndAt = Math.max(t + PLAYBACK_TAIL, 0.15);
    phase = 'PLAYBACK';
  }

  function runEnemyTurnNow(): void {
    if (!battle || !currentActor) return;
    runTurn(battle, currentActor);
    schedulePlayback();
  }

  function commitHeroAction(optionIndex: number): void {
    if (!battle || !currentActor) return;
    runTurn(battle, currentActor, optionIndex);
    pendingSkillSlot = -1;
    promptText = '';
    schedulePlayback();
  }

  function pickSkill(skillSlot: number): void {
    if (!battle || !currentActor) return;
    const skill = SKILLS[currentActor.def.skills[skillSlot]];
    if (skill.target === 'ENEMY' || skill.target === 'ALLY') {
      enterTargetMode(skillSlot);
      return;
    }
    const idx = pendingOptions.findIndex((o) => o.skill === skillSlot);
    if (idx >= 0) commitHeroAction(idx);
  }
  function pickTarget(slot: number): void {
    const idx = pendingOptions.findIndex((o) => o.skill === pendingSkillSlot && o.target === slot);
    if (idx >= 0) commitHeroAction(idx);
  }
  function enterTargetMode(skillSlot: number): void {
    if (!currentActor) return;
    const skill = SKILLS[currentActor.def.skills[skillSlot]];
    pendingSkillSlot = skillSlot;
    promptText = `CHOOSE ${skill.target === 'ALLY' ? 'AN ALLY' : 'A TARGET'} FOR ${skill.name.toUpperCase()}`;
    phase = 'HERO_TARGET';
    audio.play('blip');
  }
  function cancelTargetMode(): void {
    pendingSkillSlot = -1;
    promptText = '';
    phase = 'HERO_SKILL';
    audio.play('blip');
  }
  function openInspect(slot: number): void {
    if (phase === 'HERO_TARGET' || phase === 'DONE' || phase === 'INSPECT') return;
    returnPhase = phase;
    inspectSlot = slot;
    phase = 'INSPECT';
    audio.play('blip');
  }
  function closeInspect(): void {
    phase = returnPhase;
    audio.play('blip');
  }
  function togglePauseInternal(): void {
    paused = !paused;
    audio.play('blip');
  }
  function quitBattle(): void {
    if (!battle) return;
    finalResult = battleOutcome(battle);
    phase = 'DONE';
    paused = false;
  }

  // ---------------------------------------------------- event presentation --
  function applyEvent(ev: BattleEvent): void {
    if (!battle) return;
    switch (ev.kind) {
      case 'TURN_START':
        currentActor = ev.actor;
        break;
      case 'CAST': {
        lastCastSkill = ev.skill;
        const skill = SKILLS[ev.skill];
        setPose(ev.caster, skill.kind === 'PHYSICAL' ? 'attack' : 'cast');
        break;
      }
      case 'HIT': {
        const feet = feetFor(battle, ev.target);
        const from = feetFor(battle, ev.attacker);
        spawnVfx(vfx, lastCastSkill, feet.x, feet.y - 40, { from: { x: from.x, y: from.y - 40 } });
        if (!ev.killed) setPose(ev.target, 'hurt');
        const popY = headY(battle, ev.target) - POP_HEAD_OFFSET;
        if (ev.glance) {
          spawnPop(feet.x, popY, `${ev.dealt} (glance)`, PICO8[6], TEXT_POP);
          audio.play('hit');
        } else if (ev.crit) {
          spawnPop(feet.x, popY, `${ev.dealt}!`, PICO8[10], TEXT_POP_CRIT);
          juice.shake(6, 0.18);
          juice.hitStop(0.05);
          audio.play('explosion');
        } else {
          spawnPop(feet.x, popY, `${ev.dealt}`, PICO8[7], TEXT_POP);
          juice.shake(3, 0.1);
          audio.play('hit');
        }
        break;
      }
      case 'STATUS_APPLIED': {
        const feet = feetFor(battle, ev.target);
        spawnPop(feet.x, headY(battle, ev.target) - 16, ev.status, statusColor(ev.status), TEXT_BODY);
        break;
      }
      case 'STATUS_RESISTED': {
        const feet = feetFor(battle, ev.target);
        spawnPop(feet.x, headY(battle, ev.target) - 16, 'RESIST', PICO8[6], TEXT_BODY);
        break;
      }
      case 'HEAL': {
        if (ev.amount > 0) {
          const feet = feetFor(battle, ev.target);
          spawnVfx(vfx, lastCastSkill, feet.x, feet.y - 40);
          spawnPop(feet.x, headY(battle, ev.target) - POP_HEAD_OFFSET, `+${ev.amount}`, PICO8[11], TEXT_POP);
          audio.play('pickup');
        }
        break;
      }
      case 'COUNTER':
        lastCastSkill = ev.actor.def.skills[0];
        setPose(ev.actor, 'attack');
        audio.play('blip');
        break;
      case 'DEATH': {
        setPose(ev.actor, 'dead');
        const feet = feetFor(battle, ev.actor);
        juice.flash(PICO8[8], 0.4, { x: feet.x, y: feet.y - 60 });
        flashLeft = 0.4;
        flashDur = 0.4;
        juice.shake(22, 0.4);
        juice.hitStop(0.15);
        audio.play('explosion');
        break;
      }
      case 'BURN_TICK': {
        const feet = feetFor(battle, ev.actor);
        spawnPop(feet.x, headY(battle, ev.actor) - POP_HEAD_OFFSET, `${ev.amount}`, PICO8[9], TEXT_POP);
        break;
      }
      case 'VEIL': {
        const feet = feetFor(battle, ev.actor);
        spawnVfx(vfx, 'SHROUD', feet.x, feet.y - 40);
        break;
      }
      case 'ATB_CHANGE':
        atbFlash.set(ev.actor, 0.3);
        break;
      default:
        break;
    }
  }

  function begin(newBattle: Battle, newOpts: BattleScreenOpts): void {
    battle = newBattle;
    opts = newOpts;
    finalResult = null;
    paused = false;
    arcadeOn = false;
    clock = 0;
    resetPresentation(newBattle);
    const look = backdropFor(newOpts.biome);
    light.setBiome(look);
    light.setTier(baseTier);
    flashLeft = 0;
    // The look owns the ambient field too: the flat tiers draw it, the HD tiers
    // let the light plane's own motes and fog do that job.
    particles.setAmbient(look.ambient, look.ambientColor);
    regions.focus(null);
    scheduleNextTurn();
  }

  // ------------------------------------------------------------- regions ---
  /** A phone's skill hit rect reaches the canvas bottom edge; the drawn button stays SKILL_W x drawn-height
   * ("the PAUSE pattern": an explicit hit rect taller than the drawn button). */
  function skillHit(i: number): { x: number; y: number; w: number; h: number } {
    const h = isPhone(pc) ? CANVAS_H - SKILL_Y : SKILL_HIT_H;
    return { x: SKILL_X[i], y: SKILL_Y, w: SKILL_W, h };
  }
  function skillButtonHeight(): number {
    return isPhone(pc) ? SKILL_H_PHONE : SKILL_H;
  }

  function registerRegions(): void {
    if (!battle) return;
    regions.add('pause-icon', PAUSE_ICON_HIT.x, PAUSE_ICON_HIT.y, PAUSE_ICON_HIT.w, PAUSE_ICON_HIT.h, { index: 90, group: 'ribbon' });

    const targetSkill = phase === 'HERO_TARGET' && currentActor ? SKILLS[currentActor.def.skills[pendingSkillSlot]] : null;
    const heroesAreTargets = targetSkill?.target === 'ALLY';
    const enemiesAreTargets = targetSkill?.target === 'ENEMY';

    for (let i = 0; i < battle.heroes.length; i++) {
      const a = battle.heroes[i];
      const disabled = phase === 'HERO_TARGET' && !(heroesAreTargets && a.alive);
      regions.add(`hero-${i}`, PANEL_X_HERO, PANEL_Y[i], PANEL_W, PANEL_H, { index: i, group: 'heroes', disabled });
      const feet = feetFor(battle, a);
      const hit = actorHitRect(recipeFor(a), feet.x, feet.y);
      regions.add(`hero-${i}`, hit.x, hit.y, hit.w, hit.h, { index: i, group: 'heroes', disabled });
    }
    for (let i = 0; i < battle.enemies.length; i++) {
      const a = battle.enemies[i];
      const disabled = phase === 'HERO_TARGET' && !(enemiesAreTargets && a.alive);
      regions.add(`enemy-${i}`, PANEL_X_ENEMY, PANEL_Y[i], PANEL_W, PANEL_H, { index: i, group: 'enemies', disabled });
      const feet = feetFor(battle, a);
      const hit = actorHitRect(recipeFor(a), feet.x, feet.y);
      regions.add(`enemy-${i}`, hit.x, hit.y, hit.w, hit.h, { index: i, group: 'enemies', disabled });
    }

    if (phase === 'HERO_SKILL' && currentActor) {
      for (let i = 0; i < 3; i++) {
        const legal = pendingOptions.some((o) => o.skill === i);
        const h = skillHit(i);
        regions.add(`skill-${i}`, h.x, h.y, h.w, h.h, { index: i, group: 'skills', disabled: !legal });
      }
    }
  }

  function registerPauseRegions(): void {
    for (let i = 0; i < 3; i++) {
      regions.add(`pause-${i}`, PAUSE_BTN_X, PAUSE_BTN_Y[i], PAUSE_BTN.w, PAUSE_BTN.h, { index: i, group: 'pause', disabled: i === 1 && !crt });
    }
  }
  function registerInspectRegions(): void {
    regions.add('inspect-back', BACK.x, BACK.y, BACK.w, BACK.h, { index: 0, group: 'inspect' });
  }

  // -------------------------------------------------------------- update ---
  function update(dt: number): void {
    clock += dt;
    if (phase !== 'DONE' && input.pressed('PAUSE')) togglePauseInternal();

    regions.begin();
    if (paused) registerPauseRegions();
    else if (phase === 'INSPECT') registerInspectRegions();
    else registerRegions();
    regions.end();
    const act = regions.activated();

    if (paused) {
      if (act === 'pause-0') togglePauseInternal();
      else if (act === 'pause-1' && crt) {
        // Bloom and CRT halation are the same effect: exactly one is on. ARCADE
        // swaps the scene to its flat LOW planes and hands the glow to the CRT.
        arcadeOn = !arcadeOn;
        light.setTier(arcadeOn ? 'ARCADE' : baseTier);
      }
      else if (act === 'pause-2') quitBattle();
      input.endFrame();
      return; // fully frozen — nothing else ticks while paused
    }

    if (phase === 'INSPECT') {
      if (act === 'inspect-back' || input.pressed('B')) closeInspect();
    } else if (act === 'pause-icon') {
      togglePauseInternal();
    } else if (phase === 'HERO_SKILL' && act && act.startsWith('skill-')) {
      pickSkill(Number(act.slice(6)));
    } else if (phase === 'HERO_TARGET') {
      if (input.pressed('B')) cancelTargetMode();
      else if (act && currentActor) {
        const skill = SKILLS[currentActor.def.skills[pendingSkillSlot]];
        if (skill.target === 'ALLY' && act.startsWith('hero-')) pickTarget(Number(act.slice(5)));
        else if (skill.target === 'ENEMY' && act.startsWith('enemy-')) pickTarget(Number(act.slice(6)));
      }
    } else if (act && act.startsWith('hero-')) {
      openInspect(Number(act.slice(5)));
    }

    // Ambient/juice/vfx/bars/pops tick in every remaining phase (INSPECT included) — only PAUSED freezes them.
    juice.update(dt);
    if (flashLeft > 0) flashLeft = Math.max(0, flashLeft - dt);
    particles.update(dt);
    updateVfx(vfx, dt);
    if (battle) {
      for (const a of allActors(battle)) {
        ensureShown(a);
        shownHp.set(a, approach(shownHp.get(a) ?? a.hp, a.hp, a.maxHp * HP_ANIM_RATE, dt));
        shownAtb.set(a, approach(shownAtb.get(a) ?? a.atb, a.atb, ATB_TURN * ATB_ANIM_RATE, dt));
        const flash = atbFlash.get(a);
        if (flash !== undefined && flash > 0) atbFlash.set(a, Math.max(0, flash - dt));
      }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.age += dt;
      p.y += p.vy * dt;
      if (p.age >= p.dur) pops.splice(i, 1);
    }

    if (phase === 'ENEMY_PENDING') {
      enemyPendingTimer -= dt;
      if (enemyPendingTimer <= 0) runEnemyTurnNow();
    } else if (phase === 'PLAYBACK') {
      playClock += dt;
      while (playHead < playback.length && playback[playHead].at <= playClock) {
        applyEvent(playback[playHead].ev);
        playHead += 1;
      }
      if (playHead >= playback.length && playClock >= playEndAt) scheduleNextTurn();
    }

    input.endFrame();
  }

  // -------------------------------------------------------------- render ---
  // The HUD, in order of the contract's region table. Every one of these runs
  // AFTER renderPost, on the un-shaken, un-bloomed frame: a plate is a plate,
  // not a light source, and a number the player has to read never blooms.

  function drawSidePanels(ctx: CanvasRenderingContext2D, b: Battle, side: 'HERO' | 'ENEMY'): void {
    const list = side === 'HERO' ? b.heroes : b.enemies;
    const x = side === 'HERO' ? PANEL_X_HERO : PANEL_X_ENEMY;
    const innerW = PANEL_W - PANEL_PAD * 2;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const y = PANEL_Y[i];
      const focusedId = `${side === 'HERO' ? 'hero' : 'enemy'}-${i}`;
      const focused = regions.focused() === focusedId;
      plate(ctx, x, y, PANEL_W, PANEL_H, focused ? { border: PICO8[7], alpha: 0.65 } : {});
      const ix = x + PANEL_PAD;
      let ry = y + PANEL_PAD;

      // NAME — the panel's one HUD_PX line.
      hudText(ctx, a.def.name.slice(0, 16), ix, ry + 1, { color: a.alive ? PICO8[7] : PICO8[6] });
      ry += PANEL_ROW_NAME_H + PANEL_ROW_GAP;

      // HP — "HP" tag, numbers right-aligned, a 4-px bar under them.
      const hpShown = shownHp.get(a) ?? a.hp;
      hudText(ctx, 'HP', ix, ry + 2, { px: HUD_SMALL, color: PICO8[6], alpha: 0.85 });
      hudText(ctx, `${Math.max(0, Math.round(hpShown))} / ${a.maxHp}`, ix + innerW, ry, {
        px: HUD_SMALL, align: 'right', color: a.alive ? PICO8[7] : PICO8[6],
      });
      drawBar(ctx, ix, ry + PANEL_ROW_HP_H - HP_BAR_H, innerW, HP_BAR_H, hpShown / a.maxHp, a.alive ? PICO8[11] : PICO8[5]);
      ry += PANEL_ROW_HP_H + PANEL_ROW_GAP;

      // ATB — a 2-px line, centred in the contract's 6-px row.
      const atbShown = shownAtb.get(a) ?? a.atb;
      const flash = atbFlash.get(a) ?? 0;
      drawBar(ctx, ix, ry + (PANEL_ROW_ATB_H - ATB_LINE_H) / 2, innerW, ATB_LINE_H, atbShown / ATB_TURN, flash > 0 ? PICO8[10] : PICO8[12]);
      ry += PANEL_ROW_ATB_H + PANEL_ROW_GAP;

      drawPanelStatusRow(ctx, ix, ry, a, innerW);
    }
  }

  /** One queue chip: the actor's portrait in a diamond, framed in its element. */
  function drawQueueChip(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, a: Actor, current: boolean): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,8,16,0.82)';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const art = portraitFor(recipeFor(a), a.def.element);
    if (art) {
      ctx.imageSmoothingEnabled = false;
      const s = current ? 1 : 0.88; // the actor on turn reads one step larger
      const w = PORTRAIT * s;
      ctx.drawImage(art, cx - w / 2, cy - w / 2 - r * 0.06, w, w);
    }
    ctx.restore();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ELEMENT_COLOR[a.def.element];
    ctx.globalAlpha = current ? 0.9 : 0.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawRibbonQueue(ctx: CanvasRenderingContext2D, b: Battle): void {
    const queue = forecast(b, QUEUE_LEN);
    const r = QUEUE_CHIP / 2;
    for (let i = 0; i < queue.length; i++) {
      const chip = queueChipPos(i);
      const a = queue[i];
      const cx = chip.x + r;
      const cy = chip.y + r;
      if (i > 0) {
        // The thread the queue hangs on, drawn behind the chips.
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = PICO8[6];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - QUEUE_CHIP - 2, cy + 0.5);
        ctx.lineTo(cx, cy + 0.5);
        ctx.stroke();
        ctx.restore();
      }
      drawQueueChip(ctx, cx, cy, r - (i === 0 ? 0 : 3), a, i === 0);
      if (a.side === 'ENEMY' && intent(b, a).stunned) {
        const badge = intentBadgePos(chip);
        plate(ctx, badge.x, badge.y, INTENT_BADGE, INTENT_BADGE, { alpha: 0.8, border: PICO8[8], radius: 3 });
        hudTextCentered(ctx, 'Z', badge.x, badge.y, INTENT_BADGE, INTENT_BADGE, { px: HUD_SMALL, color: PICO8[8] });
      }
    }
    // "NEXT TURN": the caret under the actor whose turn this is.
    if (queue.length > 0) {
      const chip = queueChipPos(0);
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = PICO8[7];
      ctx.beginPath();
      ctx.moveTo(chip.x + r, chip.y + QUEUE_CHIP + 1);
      ctx.lineTo(chip.x + r - 5, chip.y + QUEUE_CHIP + 7);
      ctx.lineTo(chip.x + r + 5, chip.y + QUEUE_CHIP + 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRibbon(ctx: CanvasRenderingContext2D, b: Battle): void {
    drawRibbonQueue(ctx, b);
    if (currentActor) {
      hudText(ctx, currentActor.def.name, NAME_X, NAME_Y, { px: HUD_LARGE, color: PICO8[7] });
    }
    if (b.enraged) {
      plate(ctx, ENRAGE_CHIP.x, ENRAGE_CHIP.y, ENRAGE_CHIP.w, ENRAGE_CHIP.h, { alpha: 0.55, border: PICO8[8] });
      hudTextCentered(ctx, 'ENRAGED', ENRAGE_CHIP.x, ENRAGE_CHIP.y, ENRAGE_CHIP.w, ENRAGE_CHIP.h, { px: HUD_SMALL, color: PICO8[8] });
    }
    hudText(ctx, `ACT ${opts.act}   LAP ${opts.lap}`, RIBBON_RIGHT, RIBBON_ACT_Y, { px: HUD_SMALL, align: 'right', color: PICO8[6] });
    hudText(ctx, `SCORE ${opts.score}`, RIBBON_RIGHT, RIBBON_SCORE_Y, { px: HUD_SMALL, align: 'right', color: PICO8[7] });

    const pauseFocused = regions.focused() === 'pause-icon';
    plate(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, { alpha: 0.5, border: pauseFocused ? PICO8[7] : 'rgba(255,255,255,0.2)' });
    ctx.fillStyle = pauseFocused ? PICO8[7] : PICO8[6];
    ctx.fillRect(PAUSE_ICON.x + 22, PAUSE_ICON.y + 20, 6, 24);
    ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 20, 6, 24);
  }

  function drawLogLine(ctx: CanvasRenderingContext2D, b: Battle): void {
    const text = phase === 'HERO_TARGET' ? promptText : (b.log[b.log.length - 1] ?? '');
    if (!text) return;
    plate(ctx, LOG_RECT.x, LOG_RECT.y, LOG_RECT.w, LOG_RECT.h, { alpha: 0.5 });
    hudText(ctx, text.slice(0, LOG_LINE_MAX), LOG_TEXT.x, LOG_TEXT.y + 3, { color: PICO8[7] });
  }

  /** The reference's "chance of success" plate: a small tooltip beside whichever target has focus. */
  function drawTargetTooltip(ctx: CanvasRenderingContext2D, b: Battle): void {
    const id = regions.focused() ?? regions.hovered();
    if (!id) return;
    const isHero = id.startsWith('hero-');
    const isEnemy = id.startsWith('enemy-');
    if (!isHero && !isEnemy) return;
    const slot = Number(id.slice(isHero ? 5 : 6));
    const a = (isHero ? b.heroes : b.enemies)[slot];
    if (!a || !a.alive) return;
    const feet = feetFor(b, a);
    const name = a.def.name.slice(0, 16);
    const hp = `${Math.max(0, Math.round(shownHp.get(a) ?? a.hp))} / ${a.maxHp}`;
    const w = Math.max(hudWidth(ctx, name, HUD_SMALL), hudWidth(ctx, hp, HUD_SMALL)) + 20;
    const h = 46;
    // Offset to the OUTER side, the way the gauges are: on the diagonal a
    // centred tooltip lands on whichever actor stands one step in front.
    const raw = isHero ? feet.x - w - 28 : feet.x + 28;
    const x = Math.min(CANVAS_W - w - 24, Math.max(24, raw));
    const y = feet.y + 8 + HP_GAUGE.h + 2 + ATB_GAUGE.h + 8;
    plate(ctx, x, y, w, h, { alpha: 0.72 });
    hudText(ctx, name, x + 10, y + 6, { px: HUD_SMALL, color: PICO8[7] });
    hudText(ctx, hp, x + 10, y + 24, { px: HUD_SMALL, color: PICO8[6] });
  }

  function drawSkillBar(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const h = skillButtonHeight();
    const touch = input.pointer.type === 'touch';
    for (let i = 0; i < 3; i++) {
      const skill = SKILLS[actor.def.skills[i]];
      const legal = pendingOptions.some((o) => o.skill === i);
      const x = SKILL_X[i];
      const y = SKILL_Y;
      const focused = regions.focused() === `skill-${i}`;
      plate(ctx, x, y, SKILL_W, h, focused ? { border: PICO8[7], alpha: 0.66 } : { alpha: legal ? 0.58 : 0.4 });
      hudText(ctx, skill.name, x + 16, y + 14, { color: legal ? PICO8[7] : PICO8[5] });
      // Cooldown pips: small dots, not blocks.
      const cd = actor.cooldowns[i];
      const pipY = y + h - 22;
      for (let p = 0; p < 5; p++) {
        ctx.beginPath();
        ctx.arc(x + 20 + p * 14, pipY, 3, 0, Math.PI * 2);
        ctx.fillStyle = p < cd ? PICO8[8] : 'rgba(255,255,255,0.22)';
        ctx.fill();
      }
      if (!touch) hudText(ctx, String(i + 1), x + SKILL_W - 16, pipY - 9, { px: HUD_SMALL, align: 'right', color: PICO8[6] });
    }
  }

  function drawPops(ctx: CanvasRenderingContext2D): void {
    // The one bold thing on screen, and the one that stays bitmap: FONT_HD.
    for (const p of pops) {
      ctx.globalAlpha = clamp01(1 - p.age / p.dur);
      const tw = textWidth(p.text, p.scale, 1, FONT_HD);
      drawText(ctx, p.text, Math.round(p.x - tw / 2), Math.round(p.y), { font: FONT_HD, scale: p.scale, color: p.color, outline: true });
    }
    ctx.globalAlpha = 1;
  }
  // ---------------------------------------------------------- the stage ----
  /**
   * Back to front by feet y, both sides interleaved: the diagonal only reads if
   * the near actor overlaps the far one. Sorted in place in a pooled array —
   * nothing on this path allocates per frame.
   */
  const order: Actor[] = [];
  function refreshStageOrder(b: Battle): void {
    order.length = 0;
    for (const a of b.heroes) order.push(a);
    for (const a of b.enemies) order.push(a);
    order.sort((p, q) => feetFor(b, p).y - feetFor(b, q).y);
  }

  function drawStage(ctx: CanvasRenderingContext2D, b: Battle, order: readonly Actor[]): void {
    // 1. Contact shadows first, all of them, so no shadow lands on a sprite.
    for (const a of order) {
      if (!a.alive) continue;
      const feet = feetFor(b, a);
      const span = actorHitRect(recipeFor(a), feet.x, feet.y).w;
      light.drawContactShadow(ctx, feet.x, feet.y, span);
    }
    // 2. The actors — the one pixelated plane.
    for (const a of order) {
      const feet = feetFor(b, a);
      const { pose, time } = poseOf(a);
      drawActor(ctx, recipeFor(a), { pose, time, element: a.def.element, facing: a.side === 'HERO' ? 1 : -1, x: feet.x, y: feet.y });
    }
    // 3. Gauges and the head status row, over every sprite.
    for (const a of order) {
      if (!a.alive) continue;
      const feet = feetFor(b, a);
      const hpShown = shownHp.get(a) ?? a.hp;
      const flash = atbFlash.get(a) ?? 0;
      const outward = a.side === 'HERO' ? -STAGE_GAUGE_DX : STAGE_GAUGE_DX;
      ctx.save();
      ctx.globalAlpha = STAGE_GAUGE_ALPHA;
      drawBar(ctx, feet.x - HP_GAUGE.w / 2 + outward, feet.y + 8, HP_GAUGE.w, HP_GAUGE.h, hpShown / a.maxHp, STAGE_HP_FILL);
      const atbShown = shownAtb.get(a) ?? a.atb;
      drawBar(ctx, feet.x - ATB_GAUGE.w / 2 + outward, feet.y + 8 + HP_GAUGE.h + 2, ATB_GAUGE.w, ATB_GAUGE.h, atbShown / ATB_TURN, flash > 0 ? STAGE_ATB_FLASH : STAGE_ATB_FILL);
      ctx.restore();
      drawHeadStatusRow(ctx, feet.x, headY(b, a) - STATUS_ICON - 6, a);
    }
  }

  /** The rects renderLightPlane needs for rim light and prop glow — refilled in place, never reallocated. */
  function fillLightActors(b: Battle, order: readonly Actor[]): void {
    lightActors.length = 0;
    for (const a of order) {
      if (!a.alive) continue;
      const feet = feetFor(b, a);
      const w = isBossActor(b, a) ? BOSS_W : ACTOR_W;
      const top = headY(b, a);
      lightActors.push({ x: feet.x - w / 2, y: top, w, h: feet.y - top, glow: ACTOR_GLOW[a.def.id] ?? 0 });
    }
    // Live VFX are light too: an impact or a projectile is the brightest thing
    // on the plane for its handful of frames, and the bloom should catch it.
    for (const v of vfx) {
      if (v.age >= v.duration) continue;
      const r = v.size;
      lightActors.push({ x: v.x - r, y: v.y - r, w: r * 2, h: r * 2, glow: 0.7 });
    }
  }

  function drawInspectOverlay(ctx: CanvasRenderingContext2D, b: Battle): void {
    dimScene(pc);
    plate(ctx, INSPECT.x, INSPECT.y, INSPECT.w, INSPECT.h, { alpha: 0.9, border: 'rgba(255,255,255,0.22)', radius: 6 });
    const member = b.party.members[inspectSlot];
    if (!member) return;
    hudText(ctx, member.def.name, INSPECT_NAME.x, INSPECT_NAME.y, { px: HUD_LARGE, color: PICO8[7] });
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const relic = member.relics[slot];
      const ry = inspectRowY(i);
      plate(ctx, INSPECT.x + 24, ry, INSPECT_ROW_ICON, INSPECT_ROW_ICON, { alpha: 0.5, radius: 3 });
      hudTextCentered(ctx, SLOT_ABBR[slot], INSPECT.x + 24, ry, INSPECT_ROW_ICON, INSPECT_ROW_ICON, { px: HUD_SMALL, color: PICO8[6] });
      const tx = INSPECT.x + 24 + INSPECT_ROW_ICON + 16;
      if (!relic) {
        hudText(ctx, 'empty', tx, ry + 6, { px: HUD_SMALL, color: PICO8[5] });
        continue;
      }
      hudText(ctx, relicTitle(relic), tx, ry + 2, { color: PICO8[7] });
      const lines = [mainLine(relic), substatLine(relic, 0), substatLine(relic, 1), substatLine(relic, 2)].filter((s) => s.length > 0);
      for (let j = 0; j < lines.length; j++) {
        hudText(ctx, lines[j], tx + 240 + j * 190, ry + 4, { px: HUD_SMALL, color: PICO8[6] });
      }
    }
    const counts = new Map<SetId, number>();
    for (const id of activeSets(wornRelics(member))) counts.set(id, (counts.get(id) ?? 0) + 1);
    let li = 0;
    for (const [id, times] of counts) {
      if (li >= SET_LINE_Y.length) break;
      const def = SETS[id];
      const label = def.pieces === 2 && times > 1 ? `${def.name} x${times} ${formatSetBonus(def.bonus)}` : `${def.name} ${formatSetBonus(def.bonus)}`;
      hudText(ctx, label, SET_BAND.x, SET_LINE_Y[li], { px: HUD_SMALL, color: PICO8[7] });
      li += 1;
    }
    const backFocused = regions.focused() === 'inspect-back';
    plate(ctx, BACK.x, BACK.y, BACK.w, BACK.h, backFocused ? { border: PICO8[7], alpha: 0.66 } : { alpha: 0.55 });
    hudTextCentered(ctx, 'BACK', BACK.x, BACK.y, BACK.w, BACK.h, { color: PICO8[7] });
  }

  function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
    dimScene(pc);
    const title = 'PAUSED';
    const tw = hudWidth(ctx, title, PAUSED_PX, 200);
    hudText(ctx, title, (CANVAS_W - tw) / 2, PAUSED_TEXT_Y, { px: PAUSED_PX, weight: 200, color: PICO8[7] });
    const labels = ['RESUME', `ARCADE ${arcadeOn ? 'ON' : 'OFF'}`, 'QUIT'];
    for (let i = 0; i < 3; i++) {
      const y = PAUSE_BTN_Y[i];
      const disabled = i === 1 && !crt;
      const focused = regions.focused() === `pause-${i}`;
      plate(ctx, PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, focused ? { border: PICO8[7], alpha: 0.7 } : { alpha: disabled ? 0.4 : 0.6 });
      hudTextCentered(ctx, labels[i], PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, { color: disabled ? PICO8[5] : PICO8[7] });
    }
  }

  /** `time` is accepted per the interface, but every animation here is driven off the screen's own
   * update()-accumulated `clock` (pose `since` timestamps are recorded against it) so the two can never
   * desync regardless of what clock the caller happens to pass. */
  function render(_time: number): void {
    const ctx = pc.ctx;
    const t0 = performance.now();
    pc.clear(PICO8[0]); // clear FIRST, unshaken
    const b = battle;
    if (!b) return;

    refreshStageOrder(b);
    fillLightActors(b, order);
    const lowTier = light.tier() === 'LOW' || light.tier() === 'ARCADE';

    juice.preRender(ctx);
    const shake = juice.offset();
    // Pass 1-2: the diorama, parallaxed by the live shake so far planes lag it.
    light.renderBackground(ctx, { time: clock, shakeX: shake.x, shakeY: shake.y });
    // The flat tiers have no light plane, so the engine's ambient field is their
    // dust; at HIGH/MED the light module's own motes and fog do that job.
    if (lowTier) particles.render(ctx);
    drawStage(ctx, b, order);
    // Pass 4: near plane, key light, rim, prop glow, fog, dust.
    light.renderLightPlane(ctx, { time: clock, actors: lightActors });
    renderVfx(ctx, vfx);
    drawPops(ctx);
    juice.postRender(ctx, CANVAS_W, CANVAS_H); // restore the shake, then the flash
    // Pass 5: bloom + grade, over the finished world and under the whole HUD.
    light.renderPost(ctx, { time: clock, flashAlpha: flashAlphaNow() });

    drawSidePanels(ctx, b, 'HERO');
    drawSidePanels(ctx, b, 'ENEMY');
    drawRibbon(ctx, b);
    drawLogLine(ctx, b);
    if (phase === 'HERO_TARGET') drawTargetTooltip(ctx, b);
    if (phase === 'HERO_SKILL' && currentActor) drawSkillBar(ctx, currentActor);

    if (phase === 'INSPECT') drawInspectOverlay(ctx, b);
    if (paused) drawPauseOverlay(ctx);
    if (arcadeOn && crt) crt.render(ctx, CANVAS_W, CANVAS_H, 1 / 60);

    lastFrameMs = performance.now() - t0;
    light.note(lastFrameMs);
  }

  return {
    begin,
    update,
    render,
    result() {
      return finalResult;
    },
    get paused() {
      return paused;
    },
    togglePause: togglePauseInternal,
  };
}

// ======================================================= pure draw helpers ==
// No screen state: geometry and text only, safe to share and to call before
// createBattleScreen's own body is reached (function declarations hoist).
//
// Everything the player reads as UI goes through hudText/hudWidth — the vector
// HUD_FONT at HUD_PX / HUD_SMALL / HUD_LARGE, light weight, letter-spaced, on a
// 1-px dark drop shadow (DESIGN.md, "Two kinds of text"). The only bitmap text
// left on this screen is the damage pop.

/** `ctx.letterSpacing` is a recent addition; the manual path draws glyph by glyph where it is missing. */
type SpacedCtx = CanvasRenderingContext2D & { letterSpacing?: string };
let spacingSupported: boolean | null = null;
function canSpace(ctx: CanvasRenderingContext2D): boolean {
  if (spacingSupported === null) spacingSupported = typeof (ctx as SpacedCtx).letterSpacing === 'string';
  return spacingSupported;
}

/** Light weight everywhere: the contract asks for a light vector face, not the system default. */
const HUD_WEIGHT = 300;
/** The one drop shadow, 1 px down-right — never a stroke, never a glow. */
const HUD_SHADOW = 'rgba(3,4,10,0.85)';

function setHudFont(ctx: CanvasRenderingContext2D, px: number, weight: number): void {
  ctx.font = `${weight} ${px}px ${HUD_FONT}`;
  if (canSpace(ctx)) (ctx as SpacedCtx).letterSpacing = `${HUD_LETTER_SPACING}px`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
}
function clearHudFont(ctx: CanvasRenderingContext2D): void {
  if (canSpace(ctx)) (ctx as SpacedCtx).letterSpacing = '0px';
}

/** Width of `text` as hudText would draw it, letter spacing included. */
function hudWidth(ctx: CanvasRenderingContext2D, text: string, px: number, weight: number = HUD_WEIGHT): number {
  setHudFont(ctx, px, weight);
  const w = canSpace(ctx)
    ? ctx.measureText(text).width
    : ctx.measureText(text).width + Math.max(0, text.length - 1) * HUD_LETTER_SPACING;
  clearHudFont(ctx);
  return w;
}

function fillSpaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  if (canSpace(ctx)) {
    ctx.fillText(text, x, y);
    return;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + HUD_LETTER_SPACING;
  }
}

interface HudTextOptions {
  px?: number;
  weight?: number;
  color?: string;
  /** 'left' (default) or 'right' — a right-aligned line is measured and drawn from x - width. */
  align?: 'left' | 'right';
  alpha?: number;
}

/** The one UI text call. `y` is the TOP of the line (textBaseline 'top'), matching the region table's row tops. */
function hudText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: HudTextOptions = {}): number {
  const px = o.px ?? HUD_PX;
  const weight = o.weight ?? HUD_WEIGHT;
  setHudFont(ctx, px, weight);
  const w = canSpace(ctx)
    ? ctx.measureText(text).width
    : ctx.measureText(text).width + Math.max(0, text.length - 1) * HUD_LETTER_SPACING;
  const dx = o.align === 'right' ? x - w : x;
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  ctx.fillStyle = HUD_SHADOW;
  fillSpaced(ctx, text, Math.round(dx) + 1, Math.round(y) + 1);
  ctx.fillStyle = o.color ?? PICO8[7];
  fillSpaced(ctx, text, Math.round(dx), Math.round(y));
  ctx.globalAlpha = prevAlpha;
  clearHudFont(ctx);
  return w;
}

/** Centred inside a box — chips, buttons, tooltips. */
function hudTextCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, o: HudTextOptions = {}): void {
  const px = o.px ?? HUD_PX;
  const tw = hudWidth(ctx, text, px, o.weight ?? HUD_WEIGHT);
  hudText(ctx, text, x + (w - tw) / 2, y + (h - px * 1.16) / 2, o);
}

// ------------------------------------------------------------- plates -----
/** A plate is a thin translucent slab, not a box: no bevel, no opaque fill, one lighter top edge. */
const PLATE_ALPHA = 0.6;
const PLATE_RADIUS = 4;
const PLATE_INK = '6,8,16';
const PLATE_TOP = 'rgba(255,255,255,0.16)';

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

interface PlateOptions {
  /** 0.55-0.65 by the contract; a tooltip sits a little denser so it reads over a lit sprite. */
  alpha?: number;
  /** A 1-px border, drawn instead of the default top-edge highlight when given (focus, ENRAGED). */
  border?: string;
  radius?: number;
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: PlateOptions = {}): void {
  const px = Math.round(x) + 0.5;
  const py = Math.round(y) + 0.5;
  const pw = Math.round(w) - 1;
  const ph = Math.round(h) - 1;
  const r = o.radius ?? PLATE_RADIUS;
  ctx.save();
  roundRectPath(ctx, px, py, pw, ph, r);
  ctx.fillStyle = `rgba(${PLATE_INK},${o.alpha ?? PLATE_ALPHA})`;
  ctx.fill();
  ctx.lineWidth = 1;
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.stroke();
  } else {
    // The 1-px lighter top edge: a lit lip, not a frame.
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.lineTo(px + pw - r, py);
    ctx.strokeStyle = PLATE_TOP;
    ctx.stroke();
  }
  ctx.restore();
}

// -------------------------------------------------------------- gauges ----
/** HP: a thin bar with a dark bed, no keyline. `h` is the contract's 4 px in a panel, 12 on the stage. */
function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, fill: string): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  ctx.fillStyle = 'rgba(4,5,12,0.72)';
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, Math.max(0, Math.round(w * clamp01(frac))), h);
}

// ------------------------------------------------------------ statuses ----
/** Status icons stay what they were: a small element-coloured glyph, now lettered in the HUD face. */
function drawStatusChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  const s = STATUS_ICON;
  ctx.save();
  roundRectPath(ctx, Math.round(x) + 0.5, Math.round(y) + 0.5, s - 1, s - 1, 3);
  ctx.fillStyle = 'rgba(6,8,16,0.72)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  hudTextCentered(ctx, label, x, y, s, s, { px: HUD_SMALL, color });
}

/** Above an actor's head on the stage: ≤ STATUS_ABOVE_MAX icons, then 3 + "+N". */
function drawHeadStatusRow(ctx: CanvasRenderingContext2D, cx: number, y: number, a: Actor): void {
  const list = a.statuses;
  if (list.length === 0) return;
  const overflow = list.length > STATUS_ABOVE_MAX;
  const shown = overflow ? list.slice(0, 3) : list.slice(0, STATUS_ABOVE_MAX);
  const count = shown.length + (overflow ? 1 : 0);
  let x = cx - (count * STATUS_ICON + (count - 1) * 2) / 2;
  for (const s of shown) {
    drawStatusChip(ctx, x, y, STATUS_ABBR[s.kind], statusColor(s.kind));
    x += STATUS_ICON + 2;
  }
  if (overflow) drawStatusChip(ctx, x, y, `+${list.length - 3}`, PICO8[6]);
}

/** A hero/enemy panel's status row: ≤ six icons + the element chip; past six, five icons and a "+N" chip. */
function drawPanelStatusRow(ctx: CanvasRenderingContext2D, x: number, y: number, a: Actor, innerW: number): void {
  let cx = x;
  const overflow = a.statuses.length > STATUS_ICON_MAX;
  const shown = overflow ? a.statuses.slice(0, 5) : a.statuses.slice(0, STATUS_ICON_MAX);
  for (const s of shown) {
    drawStatusChip(ctx, cx, y, STATUS_ABBR[s.kind], statusColor(s.kind));
    cx += STATUS_ICON + 2;
  }
  if (overflow) drawStatusChip(ctx, cx, y, `+${a.statuses.length - 5}`, PICO8[6]);
  // The element chip: a filled swatch, the one saturated block in the panel.
  const ex = x + innerW - ELEMENT_CHIP.w;
  ctx.save();
  roundRectPath(ctx, Math.round(ex) + 0.5, Math.round(y) + 0.5, ELEMENT_CHIP.w - 1, ELEMENT_CHIP.h - 1, 3);
  ctx.fillStyle = ELEMENT_COLOR[a.def.element];
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.restore();
}
