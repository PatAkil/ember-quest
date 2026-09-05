// Ember Quest v3 — game/screens/battle.ts: the interactive 3v3 battle screen,
// phase 4's core. Drives the sim turn by turn (createBattle/nextReady/runTurn
// built by sim/battle.ts in parallel), presenting a hero's turn as a skill
// bar + target flow and every actor's turn as a paced playback of
// `battle.events`. DESIGN.md → Presentation (Canvas and scale, HD-2D — this
// ships the LOW tier —, Layered actors, Procedural VFX, Input, UI
// constraints) and → Combat.
//
// LOW tier, per the contract: one opaque per-biome backdrop (baked once),
// actors (the only pixelated plane), particles, a vignette (the engine CRT,
// ARCADE-toggle only — off by default here), and UI. No bloom, no DOF planes.

import type { PixelCanvas, Input, HitRegions, Audio, Juice, ParticleSystem, Crt } from '../../engine';
import {
  drawText, drawTextCentered, textWidth, FONT_HD, drawPanel, drawBevel,
  fillBands, fillDither, dimScene, PICO8,
} from '../../engine';

import type { Battle, BattleEvent } from '../sim/battle';
import { nextReady, runTurn, isOver, battleOutcome, forecast, actOptions, intent } from '../sim/battle';
import type { ActOption, Actor, BattleResult, Element, EnemyDef, SetBonus, SetId, SkillId, Slot, StatusKind } from '../types';
import { ATB_TURN, SLOTS } from '../types';
import { SKILLS } from '../data/skills';
import { SETS } from '../data/sets';
import { wornRelics, activeSets, relicTitle, mainLine, substatLine } from '../sim/relics';

import { ACTOR_RECIPES, drawActor, actorHitRect, ACTOR_W, BOSS_W } from '../art/actors';
import type { PoseName } from '../art/actors';
import { spawnVfx, updateVfx, renderVfx } from '../art/vfx';
import type { VfxInstance } from '../art/vfx';

import {
  CANVAS_W, CANVAS_H, TEXT_POP, TEXT_POP_CRIT, TEXT_LABEL, TEXT_BODY,
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

// ------------------------------------------------------------- backdrop ---
const BACKDROP_CACHE = new Map<string, HTMLCanvasElement>();
const BIOME_BANDS: Record<string, readonly string[]> = {
  'EMBER CRYPT': [PICO8[0], PICO8[2], PICO8[4]],
};
const DEFAULT_BANDS: readonly string[] = [PICO8[0], PICO8[1], PICO8[5]];

/** One opaque backdrop per biome, baked once (fillBands/fillDither + simple pillar silhouettes) and
 * redrawn with a single drawImage every frame after — the LOW tier's whole background pass. */
function buildBackdrop(biome: string): HTMLCanvasElement {
  const hit = BACKDROP_CACHE.get(biome);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = CANVAS_W;
  cv.height = CANVAS_H;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const bands = BIOME_BANDS[biome] ?? DEFAULT_BANDS;
    fillBands(ctx, 0, 0, CANVAS_W, CANVAS_H, [...bands]);
    fillDither(ctx, 0, CANVAS_H * 0.6, CANVAS_W, CANVAS_H * 0.4, bands[bands.length - 1], PICO8[0], 'sparse');
    // Broken-pillar rubble on the floor, well clear of the ribbon and the panels' columns — short stubs,
    // not looming columns, so they read as set dressing instead of competing with the diagonal actor line.
    ctx.fillStyle = PICO8[0];
    for (const px of [430, 850]) {
      ctx.beginPath();
      ctx.moveTo(px - 28, 566);
      ctx.lineTo(px - 15, 462);
      ctx.lineTo(px + 15, 462);
      ctx.lineTo(px + 28, 566);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = bands[1] ?? bands[0];
    ctx.fillRect(0, CANVAS_H * 0.62, CANVAS_W, 3);
    ctx.globalAlpha = 1;
  }
  BACKDROP_CACHE.set(biome, cv);
  return cv;
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
  let backdrop: HTMLCanvasElement | null = null;
  let lastCastSkill: SkillId = 'CINDER';

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
    backdrop = buildBackdrop(newOpts.biome);
    particles.setAmbient('embers');
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
      else if (act === 'pause-1' && crt) arcadeOn = !arcadeOn;
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
  function drawSidePanels(ctx: CanvasRenderingContext2D, b: Battle, side: 'HERO' | 'ENEMY'): void {
    const list = side === 'HERO' ? b.heroes : b.enemies;
    const x = side === 'HERO' ? PANEL_X_HERO : PANEL_X_ENEMY;
    const innerW = PANEL_W - PANEL_PAD * 2;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const y = PANEL_Y[i];
      const focusedId = `${side === 'HERO' ? 'hero' : 'enemy'}-${i}`;
      drawPanel(pc, x, y, PANEL_W, PANEL_H, { border: regions.focused() === focusedId ? PICO8[7] : undefined });
      const ix = x + PANEL_PAD;
      let ry = y + PANEL_PAD;
      drawText(ctx, a.def.name.toUpperCase().slice(0, 16), ix, ry + 2, { font: FONT_HD, scale: TEXT_BODY, color: a.alive ? PICO8[7] : PICO8[6] });
      ry += PANEL_ROW_NAME_H + PANEL_ROW_GAP;
      const hpShown = shownHp.get(a) ?? a.hp;
      drawStatBar(ctx, ix, ry, innerW, PANEL_ROW_HP_H, hpShown / a.maxHp, a.alive ? PICO8[11] : PICO8[5], PICO8[2], `${Math.max(0, Math.round(hpShown))}/${a.maxHp}`);
      ry += PANEL_ROW_HP_H + PANEL_ROW_GAP;
      const atbShown = shownAtb.get(a) ?? a.atb;
      drawGauge(ctx, ix, ry, innerW, PANEL_ROW_ATB_H, atbShown / ATB_TURN, PICO8[12], PICO8[1]);
      ry += PANEL_ROW_ATB_H + PANEL_ROW_GAP;
      drawPanelStatusRow(ctx, ix, ry, a, innerW);
    }
  }

  function drawRibbonQueue(ctx: CanvasRenderingContext2D, b: Battle): void {
    const queue = forecast(b, QUEUE_LEN);
    for (let i = 0; i < queue.length; i++) {
      const chip = queueChipPos(i);
      const a = queue[i];
      drawBevel(ctx, chip.x, chip.y, QUEUE_CHIP, QUEUE_CHIP, ELEMENT_COLOR[a.def.element], PICO8[7], PICO8[0]);
      centerText(ctx, a.def.name.charAt(0).toUpperCase(), chip.x, chip.y, QUEUE_CHIP, QUEUE_CHIP, TEXT_LABEL, PICO8[0]);
      if (a.side === 'ENEMY' && intent(b, a).stunned) {
        const badge = intentBadgePos(chip);
        drawBevel(ctx, badge.x, badge.y, INTENT_BADGE, INTENT_BADGE, PICO8[8], PICO8[7], PICO8[0]);
        centerText(ctx, 'Z', badge.x, badge.y, INTENT_BADGE, INTENT_BADGE, TEXT_BODY, PICO8[7]);
      }
    }
  }

  function drawRibbon(ctx: CanvasRenderingContext2D, b: Battle): void {
    drawRibbonQueue(ctx, b);
    if (currentActor) {
      drawText(ctx, currentActor.def.name.toUpperCase(), NAME_X, NAME_Y, { font: FONT_HD, scale: TEXT_LABEL, color: PICO8[7] });
    }
    if (b.enraged) {
      drawBevel(ctx, ENRAGE_CHIP.x, ENRAGE_CHIP.y, ENRAGE_CHIP.w, ENRAGE_CHIP.h, PICO8[8], PICO8[7], PICO8[0]);
      centerText(ctx, 'ENRAGED', ENRAGE_CHIP.x, ENRAGE_CHIP.y, ENRAGE_CHIP.w, ENRAGE_CHIP.h, TEXT_BODY, PICO8[7]);
    }
    const actLine = `ACT ${opts.act} LAP ${opts.lap}`;
    drawText(ctx, actLine, RIBBON_RIGHT - textWidth(actLine, TEXT_BODY, 1, FONT_HD), RIBBON_ACT_Y, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[7] });
    const scoreLine = `SCORE ${opts.score}`;
    drawText(ctx, scoreLine, RIBBON_RIGHT - textWidth(scoreLine, TEXT_BODY, 1, FONT_HD), RIBBON_SCORE_Y, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[7] });

    const pauseFocused = regions.focused() === 'pause-icon';
    drawBevel(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, PICO8[1], pauseFocused ? PICO8[7] : PICO8[6], PICO8[0]);
    ctx.fillStyle = PICO8[7];
    ctx.fillRect(PAUSE_ICON.x + 20, PAUSE_ICON.y + 16, 8, 32);
    ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 16, 8, 32);
  }

  function drawLogLine(ctx: CanvasRenderingContext2D, b: Battle): void {
    drawPanel(pc, LOG_RECT.x, LOG_RECT.y, LOG_RECT.w, LOG_RECT.h);
    const text = phase === 'HERO_TARGET' ? promptText : (b.log[b.log.length - 1] ?? '');
    drawText(ctx, text, LOG_TEXT.x, LOG_TEXT.y, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[7] });
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
      drawBevel(ctx, x, y, SKILL_W, h, legal ? PICO8[1] : PICO8[5], focused ? PICO8[7] : PICO8[6], PICO8[0]);
      drawText(ctx, skill.name.toUpperCase(), x + 12, y + 8, { font: FONT_HD, scale: TEXT_LABEL, color: legal ? PICO8[7] : PICO8[6] });
      const cd = actor.cooldowns[i];
      const pipY = y + h - 22;
      for (let p = 0; p < 5; p++) {
        ctx.fillStyle = p < cd ? PICO8[8] : PICO8[5];
        ctx.fillRect(x + 12 + p * 12, pipY, 8, 8);
      }
      if (!touch) {
        const hint = String(i + 1);
        const tw = textWidth(hint, TEXT_BODY, 1, FONT_HD);
        drawText(ctx, hint, x + SKILL_W - 12 - tw, pipY - 1, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[6] });
      }
    }
  }

  function drawPops(ctx: CanvasRenderingContext2D): void {
    for (const p of pops) {
      ctx.globalAlpha = clamp01(1 - p.age / p.dur);
      const tw = textWidth(p.text, p.scale, 1, FONT_HD);
      drawText(ctx, p.text, Math.round(p.x - tw / 2), Math.round(p.y), { font: FONT_HD, scale: p.scale, color: p.color, outline: true });
    }
    ctx.globalAlpha = 1;
  }

  function drawInspectOverlay(ctx: CanvasRenderingContext2D, b: Battle): void {
    dimScene(pc);
    drawPanel(pc, INSPECT.x, INSPECT.y, INSPECT.w, INSPECT.h, { color: 'rgba(8,10,20,0.94)', border: PICO8[7] });
    const member = b.party.members[inspectSlot];
    if (!member) return;
    drawText(ctx, member.def.name.toUpperCase(), INSPECT_NAME.x, INSPECT_NAME.y, { font: FONT_HD, scale: TEXT_LABEL, color: PICO8[7] });
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const relic = member.relics[slot];
      const ry = inspectRowY(i);
      drawBevel(ctx, INSPECT.x + 24, ry, INSPECT_ROW_ICON, INSPECT_ROW_ICON, PICO8[5], PICO8[7], PICO8[0]);
      centerText(ctx, SLOT_ABBR[slot], INSPECT.x + 24, ry, INSPECT_ROW_ICON, INSPECT_ROW_ICON, TEXT_BODY, PICO8[7]);
      const tx = INSPECT.x + 24 + INSPECT_ROW_ICON + 16;
      if (!relic) {
        drawText(ctx, 'empty', tx, ry + 6, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[6] });
        continue;
      }
      drawText(ctx, relicTitle(relic).toUpperCase(), tx, ry, { font: FONT_HD, scale: TEXT_LABEL, color: PICO8[7] });
      const lines = [mainLine(relic), substatLine(relic, 0), substatLine(relic, 1), substatLine(relic, 2)].filter((s) => s.length > 0);
      for (let j = 0; j < lines.length; j++) {
        drawText(ctx, lines[j], tx + 240 + j * 190, ry + 4, { font: FONT_HD, scale: TEXT_BODY, color: PICO8[6] });
      }
    }
    const counts = new Map<SetId, number>();
    for (const id of activeSets(wornRelics(member))) counts.set(id, (counts.get(id) ?? 0) + 1);
    let li = 0;
    for (const [id, times] of counts) {
      if (li >= SET_LINE_Y.length) break;
      const def = SETS[id];
      const label = def.pieces === 2 && times > 1 ? `${def.name} x${times} ${formatSetBonus(def.bonus)}` : `${def.name} ${formatSetBonus(def.bonus)}`;
      drawText(ctx, label, SET_BAND.x, SET_LINE_Y[li], { font: FONT_HD, scale: TEXT_BODY, color: PICO8[7] });
      li += 1;
    }
    const backFocused = regions.focused() === 'inspect-back';
    drawBevel(ctx, BACK.x, BACK.y, BACK.w, BACK.h, PICO8[1], backFocused ? PICO8[7] : PICO8[6], PICO8[0]);
    centerText(ctx, 'BACK', BACK.x, BACK.y, BACK.w, BACK.h, TEXT_LABEL, PICO8[7]);
  }

  function drawActorsOnSide(ctx: CanvasRenderingContext2D, b: Battle, side: readonly Actor[]): void {
    for (const a of side) {
      const feet = feetFor(b, a);
      const recipe = recipeFor(a);
      const { pose, time } = poseOf(a);
      drawActor(ctx, recipe, { pose, time, element: a.def.element, facing: a.side === 'HERO' ? 1 : -1, x: feet.x, y: feet.y });
      if (!a.alive) continue;
      const hpShown = shownHp.get(a) ?? a.hp;
      drawGauge(ctx, feet.x - HP_GAUGE.w / 2, feet.y + 8, HP_GAUGE.w, HP_GAUGE.h, hpShown / a.maxHp, PICO8[11], PICO8[2]);
      const atbShown = shownAtb.get(a) ?? a.atb;
      const flash = atbFlash.get(a) ?? 0;
      drawGauge(ctx, feet.x - ATB_GAUGE.w / 2, feet.y + 8 + HP_GAUGE.h + 2, ATB_GAUGE.w, ATB_GAUGE.h, atbShown / ATB_TURN, flash > 0 ? PICO8[10] : PICO8[12], PICO8[1]);
      drawHeadStatusRow(ctx, feet.x, headY(b, a) - STATUS_ICON - 6, a);
    }
  }

  function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
    dimScene(pc);
    drawTextCentered(ctx, 'PAUSED', CANVAS_W, PAUSED_TEXT_Y, { font: FONT_HD, scale: 4, color: PICO8[7] });
    const labels = ['RESUME', `ARCADE ${arcadeOn ? 'ON' : 'OFF'}`, 'QUIT'];
    for (let i = 0; i < 3; i++) {
      const y = PAUSE_BTN_Y[i];
      const disabled = i === 1 && !crt;
      const focused = regions.focused() === `pause-${i}`;
      drawBevel(ctx, PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, disabled ? PICO8[5] : PICO8[1], focused ? PICO8[7] : PICO8[6], PICO8[0]);
      centerText(ctx, labels[i], PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, TEXT_LABEL, disabled ? PICO8[6] : PICO8[7]);
    }
  }

  /** `time` is accepted per the interface, but every animation here is driven off the screen's own
   * update()-accumulated `clock` (pose `since` timestamps are recorded against it) so the two can never
   * desync regardless of what clock the caller happens to pass. */
  function render(_time: number): void {
    const ctx = pc.ctx;
    pc.clear(PICO8[0]); // clear FIRST, unshaken
    const b = battle;
    if (!b) return;

    juice.preRender(ctx);
    if (backdrop) ctx.drawImage(backdrop, 0, 0);
    particles.render(ctx);
    drawActorsOnSide(ctx, b, b.heroes);
    drawActorsOnSide(ctx, b, b.enemies);
    renderVfx(ctx, vfx);
    drawSidePanels(ctx, b, 'HERO');
    drawSidePanels(ctx, b, 'ENEMY');
    drawRibbon(ctx, b);
    drawLogLine(ctx, b);
    if (phase === 'HERO_SKILL' && currentActor) drawSkillBar(ctx, currentActor);
    drawPops(ctx);
    juice.postRender(ctx, CANVAS_W, CANVAS_H);

    if (phase === 'INSPECT') drawInspectOverlay(ctx, b);
    if (paused) drawPauseOverlay(ctx);
    if (arcadeOn && crt) crt.render(ctx, CANVAS_W, CANVAS_H, 1 / 60);
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

function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, fill: string, back: string): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  ctx.fillStyle = back;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x0, y0, Math.round(w * clamp01(frac)), h);
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(x0, y0, w, 1);
  ctx.fillRect(x0, y0 + h - 1, w, 1);
}

/** A gauge with its value centred on top — the hero/enemy panel's chunky HP row. */
function drawStatBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, fill: string, back: string, label: string): void {
  drawGauge(ctx, x, y, w, h, frac, fill, back);
  centerText(ctx, label, x, y, w, h, TEXT_BODY, PICO8[7]);
}

/** Text centred inside a box — queue chips, status chips, the enrage chip, every overlay button label. */
function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, scale: number, color: string): void {
  const tw = textWidth(text, scale, 1, FONT_HD);
  const th = FONT_HD.glyphH * scale;
  drawText(ctx, text, Math.round(x + (w - tw) / 2), Math.round(y + (h - th) / 2), { font: FONT_HD, scale, color });
}

function drawStatusChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  drawBevel(ctx, Math.round(x), Math.round(y), STATUS_ICON, STATUS_ICON, color, PICO8[7], PICO8[0]);
  centerText(ctx, label, x, y, STATUS_ICON, STATUS_ICON, TEXT_BODY, PICO8[0]);
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
  drawBevel(ctx, x + innerW - ELEMENT_CHIP.w, y, ELEMENT_CHIP.w, ELEMENT_CHIP.h, ELEMENT_COLOR[a.def.element], PICO8[7], PICO8[0]);
}
