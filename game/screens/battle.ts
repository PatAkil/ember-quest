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
  PixelCanvas, Input, HitRegions, Audio, Juice, ParticleSystem, Crt, Light, LightActor,
} from '../../engine';
import { drawText, textWidth, FONT_HD, dimScene, PICO8 } from '../../engine';
import {
  ACCENT, ACCENT_COOL, ACCENT_HP, C_DEBUFF, C_MUTED, ELEMENT_COLOR, ELEMENT_ICON_NAME, FOCUS_RING,
  HP_RULE_H, INK, INK_KEYLINE, INK_TROUGH, POP_CRIT, POP_ELEMENT, POP_GLANCE, POP_HEAL, POP_PHYSICAL,
  EDGE_LIT, EDGE_REST, EDGE_SOFT, PIP_EMPTY, SLOT_ICON_NAME, STATUS_ICON_NAME, clamp01, drawBar, drawHpRule, drawIcon, drawPrimaryButton,
  drawSecondaryButton, formatSetBonus, gradientPlate, hudText, hudTextCentered, hudWidth, plate,
  portraitFor, textWash,
} from './hud';

import type { Battle, BattleEvent } from '../sim/battle';
import { nextReady, runTurn, isOver, battleOutcome, forecast, actOptions, intent } from '../sim/battle';
import type { ActOption, Actor, BattleResult, EnemyDef, SetId, SkillId, StatusKind } from '../types';
import { ATB_TURN, SLOTS } from '../types';
import { SKILLS } from '../data/skills';
import { SETS } from '../data/sets';
import { wornRelics, activeSets, relicTitle, mainLine, substatLine } from '../sim/relics';

import { ACTOR_RECIPES, drawActor, actorHitRect, ACTOR_W, BOSS_W } from '../art/actors';
import type { PoseName } from '../art/actors';
import { spawnVfx, updateVfx, renderVfx, vfxBounds, vfxImpactDelay } from '../art/vfx';
import type { VfxBounds, VfxInstance } from '../art/vfx';

import {
  CANVAS_W, CANVAS_H, TEXT_POP, TEXT_POP_CRIT, TEXT_BODY, LOG_LINE_MAX,
  HUD_PX, HUD_SMALL, HUD_LARGE,
  PANEL_W, PANEL_H, PANEL_PAD, PANEL_X_HERO, PANEL_Y, PANEL_ROW_GAP,
  PANEL_ROW_NAME_H, PANEL_ROW_HP_H, PANEL_ROW_ATB_H, PANEL_ROW_STATUS_H,
  STATUS_ICON, STATUS_ICON_MAX, ELEMENT_GLYPH,
  QUEUE_LEN, QUEUE_CHIP, QUEUE_X, QUEUE_Y, QUEUE_GAP, INTENT_BADGE, RIBBON_BOTTOM,
  NAME_X, NAME_Y, ENRAGE_CHIP, RIBBON_RIGHT, RIBBON_ACT_Y, RIBBON_SCORE_Y, PAUSE_ICON, PAUSE_ICON_HIT,
  HERO_FEET, ENEMY_FEET, ENEMY_FEET_PAIR, BOSS_FEET, STAGE_X0, STAGE_X1, spriteCellX,
  STATUS_ABOVE_MAX, POP_HEAD_OFFSET, POP_RISE_MAX, POP_PLATE_CLEAR,
  HP_HAIRLINE_H, HP_HAIRLINE_SPAN, HP_HAIRLINE_HOLD,
  ENEMY_PLATE_MIN_W, ENEMY_PLATE_PAD, ENEMY_PLATE_LIFT,
  ENEMY_PLATE_NAME_H, ENEMY_PLATE_HP_H, ENEMY_PLATE_STATUS_H,
  QUEUE_CURRENT_SCALE, QUEUE_ROLLOVER_GAP,
  LOG_TEXT, LOG_MAX_W, LOG_WASH_H, LOG_WASH_BLEED,
  skillRowRect, skillHitRect, skillTailRect,
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
  /** The one scene layer, created and tiered by main.ts and shared with every other screen. */
  light: Light;
  /** Swaps the baked diorama and the ambient field to a biome's look; a no-op when that look is already up. */
  setBiome(biome: string): void;
  /**
   * The ARCADE toggle, owned by main.ts so every screen agrees: `on` means the
   * light module runs its flat ARCADE tier and the caller applies the CRT —
   * bloom and halation are never both alight. This screen only reads it and
   * asks for the flip; main.ts does the tier swap.
   */
  arcade: { readonly on: boolean; toggle(): void };
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
  /** Which half of the turn the screen is in — read-only, for the dev state hook and nothing else. */
  readonly phase: BattlePhase;
  /** The actor whose turn this is (its def.id) — read-only, for the dev state hook and nothing else. */
  readonly currentActorId: string | null;
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

// -------------------------------------------------------------- gauges ----
/** ATB is a line, not a bar, and it lives ONLY in the panel now — never on the floor. */
const ATB_LINE_H = 2;
/**
 * The ground carries actors, shadows and nothing else. What is left of an
 * actor's HP on the stage is a 3-px hairline tucked into its contact shadow,
 * never wider than the foot span, up only while the bar is short or for
 * HP_HAIRLINE_HOLD seconds after it moved.
 */
const HAIRLINE_TROUGH = INK_TROUGH;
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
// Icons, not letters: hud.ts owns the seventeen marks (STATUS_ICON_NAME), this
// file owns which FAMILY each belongs to. Shape says what it does, colour says
// whether it is being done TO you (rose), FOR you (leaf) or is a ward (tide).
const DEBUFF_KINDS = new Set<StatusKind>([
  'STUN', 'DEF_BREAK', 'ATK_BREAK', 'SLOW', 'BURN', 'HEAL_BLOCK', 'BRAND', 'SILENCE', 'GLANCE',
]);
function statusColor(kind: StatusKind): string {
  if (DEBUFF_KINDS.has(kind)) return C_DEBUFF;
  if (kind === 'SHIELD' || kind === 'IMMUNITY' || kind === 'INVINCIBLE') return ACCENT_COOL;
  return ACCENT_HP;
}

// ------------------------------------------------------------------ pops ---
/** The four offsets the pop's ink keyline is stamped at — hoisted so drawPops allocates nothing. */
const POP_KEY_DX = [-1, 1, 0, 0];
const POP_KEY_DY = [0, 0, -1, 1];

/** The colour a hit's number takes (hud.ts owns the values): glance grey and crit gold outrank the family. */
function popColor(attacker: Actor, skill: SkillId, glance: boolean, crit: boolean): string {
  if (glance) return POP_GLANCE;
  if (crit) return POP_CRIT;
  return SKILLS[skill].kind === 'PHYSICAL' ? POP_PHYSICAL : POP_ELEMENT[attacker.def.element];
}

// ---------------------------------------------------------------- geometry --
/** Where an actor's feet stand on the diagonal stage — the boss position for a lone BOSS enemy. */
function feetFor(battle: Battle, actor: Actor): { x: number; y: number } {
  if (actor.side === 'HERO') return HERO_FEET[actor.slot] ?? HERO_FEET[0];
  if (isBossActor(battle, actor)) return BOSS_FEET;
  // Two enemies FAN across the left half instead of stacking at the diagonal's
  // far end, so the frame's other half is never all floor (composition item 5).
  if (battle.enemies.length === 2) return ENEMY_FEET_PAIR[actor.slot] ?? ENEMY_FEET_PAIR[0];
  return ENEMY_FEET[actor.slot] ?? ENEMY_FEET[0];
}
function isBossActor(battle: Battle, actor: Actor): boolean {
  return actor.side === 'ENEMY' && battle.enemies.length === 1 && (actor.def as EnemyDef).kind === 'BOSS';
}
function recipeFor(actor: Actor) {
  return ACTOR_RECIPES[actor.def.id];
}
/**
 * Top of the actor's REAL silhouette, for the status row, the hit pops ("pops
 * at head + 64") and the enemy plate. Measured off `actorHitRect`, not off a
 * fixed 0.88 x ACTOR_W: that constant is the same for a 60-cell hero and a
 * 28-cell hound, so it put the hound's "head" 100 px above the hound.
 */
function headY(battle: Battle, actor: Actor): number {
  const feet = feetFor(battle, actor);
  return actorHitRect(recipeFor(actor), feet.x, feet.y).y;
}

// --------------------------------------------------------------- pops ------
interface Pop { x: number; y: number; yMin: number; text: string; color: string; scale: number; age: number; dur: number; vy: number }

/** Linear approach — used for both HP and ATB gauges: a constant SPEED (not a constant time), so a full
 * bar and a tiny nudge both read as motion at the same visual rate. */
function approach(cur: number, target: number, rate: number, dt: number): number {
  const diff = target - cur;
  const step = rate * dt;
  if (Math.abs(diff) <= step || step <= 0) return target;
  return cur + Math.sign(diff) * step;
}

// ============================================================== the screen ==
/** The screen's own turn phase. Exposed read-only through `BattleScreen.phase` — main.ts's dev hook reads it. */
export type BattlePhase = 'HERO_SKILL' | 'HERO_TARGET' | 'ENEMY_PENDING' | 'PLAYBACK' | 'INSPECT' | 'DONE';
type Phase = BattlePhase;

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
  let paused = false;
  let lastCastSkill: SkillId = 'CINDER';

  // ------------------------------------------------------------- the scene --
  // main.ts owns the one light module — the same baked diorama the title, the
  // cards and the end screens draw over, so entering a battle swaps no scene
  // and re-bakes nothing.
  const light: Light = deps.light;
  // The rects renderLightPlane reads, rebuilt every frame and never reallocated:
  // `lightActorPool` owns the records for the life of the screen, `lightActors`
  // is the view handed to the light module (its length is trimmed to the live
  // count, the pool keeps the records for the next frame).
  const lightActorPool: LightActor[] = [];
  const lightActors: LightActor[] = [];
  let lightActorN = 0;
  /** One scratch rect for vfxBounds — the numbers are copied straight into a pooled record. */
  const vfxBox: VfxBounds = { x: 0, y: 0, w: 0, h: 0 };

  function addLightActor(x: number, y: number, w: number, h: number, glow: number): void {
    let rec = lightActorPool[lightActorN];
    if (!rec) {
      rec = { x: 0, y: 0, w: 0, h: 0, glow: 0 };
      lightActorPool[lightActorN] = rec;
    }
    rec.x = x;
    rec.y = y;
    rec.w = w;
    rec.h = h;
    rec.glow = glow;
    lightActors[lightActorN] = rec;
    lightActorN += 1;
  }
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

  /**
   * A hit's IMPACT, held back until the effect actually ARRIVES. A projectile
   * family leaves the caster and travels (vfx.ts's `vfxImpactDelay`), so
   * spawning the number, the recoil, the shake and the sfx on the HIT event
   * itself put all four a third of a second ahead of the contact ring, the
   * ground pool and the spray. The VFX still leaves immediately; only what the
   * blow LANDS is scheduled, against the screen's own `clock` — so a pause
   * (which freezes update entirely) freezes a shot in flight too. Records are
   * pooled and the live ones live in [0, impactN).
   */
  interface Impact {
    at: number; target: Actor; killed: boolean; dealt: number; glance: boolean; crit: boolean;
    x: number; y: number; color: string;
  }
  const impactPool: Impact[] = [];
  let impactN = 0;

  const poseState = new Map<Actor, { pose: PoseName; since: number }>();
  const shownHp = new Map<Actor, number>();
  /** Raw hp as last seen, and the clock the hairline's 1.5 s window started on. */
  const lastHp = new Map<Actor, number>();
  const hpTouched = new Map<Actor, number>();
  const shownAtb = new Map<Actor, number>();
  const atbFlash = new Map<Actor, number>();
  const vfx: VfxInstance[] = [];
  let pops: Pop[] = [];
  /**
   * The log line actually drawn, advanced ONE hit at a time as HIT events apply during PLAYBACK —
   * never `b.log[b.log.length - 1]`. `battle.log` gets every hit's text pushed synchronously, ahead of
   * playback, for the WHOLE turn (a 2-hit skill against 2 enemies logs all 4 lines before the first pop
   * has even animated); reading the array's tail during playback jumps straight to the turn's LAST hit
   * while the on-screen pop is still animating an EARLIER one. Reconstructed from the event's own fields
   * (never re-reads `battle.log`) because `logHit`'s exact text is fully derivable from them: same
   * `actor.def.name`s, same `SKILLS[lastCastSkill].verb` (lastCastSkill is kept current by CAST/COUNTER,
   * above), same glance/crit marker. A non-hit turn (a heal or a buff, which push no log line at all)
   * leaves this untouched, matching `b.log`'s own tail — the pre-existing behaviour for those.
   */
  let currentLogLine = '';

  /**
   * A pop rises, but only so far: `yMin` is clamped to POP_RISE_MAX above the
   * spawn and never past the ribbon's foot, so a number can neither climb over
   * the actor standing behind nor land in the turn ribbon (VFX item 5).
   */
  function spawnPop(x: number, y: number, text: string, color: string, scale: number, dur = 0.85): void {
    if (pops.length >= POP_MAX) pops.shift();
    // A turn can land a number, a status and a RESIST on one actor inside a few
    // frames; without a stagger they print on top of each other ("BRAND" over
    // "RESIST"). Step each new pop down past whatever is already there.
    let py = y;
    for (let step = 0; step < 4; step++) {
      let clash = false;
      for (const q of pops) {
        if (Math.abs(q.x - x) < 60 && Math.abs(q.y - py) < 20) { clash = true; break; }
      }
      if (!clash) break;
      py += 22;
    }
    const yMin = Math.max(py - POP_RISE_MAX, RIBBON_BOTTOM + 10);
    pops.push({ x, y: Math.max(py, yMin), yMin, text, color, scale, age: 0, dur, vy: -40 });
  }

  /**
   * Land the blow now, or hold it until `at`. Writes straight into the pool —
   * a hit builds no record of its own, so a fifteen-hit turn allocates nothing.
   */
  function scheduleImpact(
    at: number, target: Actor, killed: boolean, dealt: number, glance: boolean, crit: boolean,
    x: number, y: number, color: string,
  ): void {
    let r = impactPool[impactN];
    if (!r) {
      r = { at: 0, target, killed: false, dealt: 0, glance: false, crit: false, x: 0, y: 0, color: '' };
      impactPool[impactN] = r;
    }
    r.at = at;
    r.target = target;
    r.killed = killed;
    r.dealt = dealt;
    r.glance = glance;
    r.crit = crit;
    r.x = x;
    r.y = y;
    r.color = color;
    // A family with no flight time (every non-projectile) lands on the frame it
    // fires, exactly as it always did — the queue is only ever for travel.
    if (at <= clock) {
      landImpact(r);
      return;
    }
    impactN += 1;
  }

  /** Everything a hit does ON CONTACT: the number, the recoil, the shake, the hit-stop and the sfx. */
  function landImpact(r: Impact): void {
    if (!r.killed) setPose(r.target, 'hurt');
    spawnPop(r.x, r.y, r.crit ? `${r.dealt}!` : `${r.dealt}`, r.color, r.crit ? TEXT_POP_CRIT : TEXT_POP);
    if (r.crit) {
      juice.shake(6, 0.18);
      juice.hitStop(0.05);
      audio.play('explosion');
      return;
    }
    if (!r.glance) juice.shake(3, 0.1);
    audio.play('hit');
  }

  /** Fires every impact whose flight time is up; swap-removes it from the live range. */
  function updateImpacts(): void {
    for (let i = impactN - 1; i >= 0; i--) {
      const r = impactPool[i];
      if (clock < r.at) continue;
      landImpact(r);
      impactPool[i] = impactPool[impactN - 1];
      impactPool[impactN - 1] = r;
      impactN -= 1;
    }
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
    if (!lastHp.has(actor)) lastHp.set(actor, actor.hp);
    if (!shownAtb.has(actor)) shownAtb.set(actor, actor.atb);
  }
  function allActors(b: Battle): Actor[] {
    return [...b.heroes, ...b.enemies];
  }
  function resetPresentation(b: Battle): void {
    // Drop the pool outright rather than only zeroing the count: a pooled record
    // holds an Actor, and a finished battle's actors have no business surviving
    // into the next one.
    impactPool.length = 0;
    impactN = 0;
    poseState.clear();
    shownHp.clear();
    lastHp.clear();
    hpTouched.clear();
    shownAtb.clear();
    atbFlash.clear();
    vfx.length = 0;
    pops = [];
    for (const a of allActors(b)) {
      poseState.set(a, { pose: a.alive ? 'idle' : 'dead', since: clock });
      shownHp.set(a, a.hp);
      shownAtb.set(a, a.atb);
    }
    currentLogLine = b.log[b.log.length - 1] ?? '';
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
      const firstLegal = pendingOptions.length ? Math.min(...pendingOptions.map((o) => o.skill)) : 0;
      regions.focus(`skill-${firstLegal}`);
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
    if (!currentActor || !battle) return;
    const skill = SKILLS[currentActor.def.skills[skillSlot]];
    pendingSkillSlot = skillSlot;
    promptText = `CHOOSE ${skill.target === 'ALLY' ? 'AN ALLY' : 'A TARGET'} FOR ${skill.name.toUpperCase()}`;
    phase = 'HERO_TARGET';
    // Land the focus ON a legal target the moment the prompt opens. With the
    // enemy panel column gone the enemy plate is what shows a target's numbers,
    // and it follows the focus — so a keyboard player must never have to arrow
    // blindly off a skill row to find out what they are about to hit.
    const side = skill.target === 'ALLY' ? battle.heroes : battle.enemies;
    const prefix = skill.target === 'ALLY' ? 'hero' : 'enemy';
    const first = side.findIndex((a) => a.alive);
    if (first >= 0) regions.focus(`${prefix}-${first}`);
    audio.play('blip');
  }
  function cancelTargetMode(): void {
    const slot = pendingSkillSlot;
    pendingSkillSlot = -1;
    promptText = '';
    phase = 'HERO_SKILL';
    // Back on the command row the player came from, not wherever the pack left it.
    if (slot >= 0) regions.focus(`skill-${slot}`);
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
  /**
   * The focus the player had before PAUSED took the region pool over. The pause
   * overlay replaces every region, so on resume `end()` has nothing to restore
   * to and falls back to the first region registered — the party panel — and the
   * next A opened INSPECT instead of picking a skill. Remembering it is the fix.
   */
  let focusBeforePause: string | null = null;
  /** Only a region the TURN owns is worth restoring; the ribbon's pause icon is not. */
  function isFlowRegion(id: string | null): boolean {
    return !!id && (id.startsWith('skill-') || id.startsWith('hero-') || id.startsWith('enemy-'));
  }
  /** Where the keyboard belongs when nothing better is remembered: the first thing the phase can act on. */
  function defaultFocus(): string | null {
    if (!battle || !currentActor) return null;
    if (phase === 'HERO_SKILL') {
      const first = pendingOptions.length ? Math.min(...pendingOptions.map((o) => o.skill)) : 0;
      return `skill-${first}`;
    }
    if (phase === 'HERO_TARGET' && pendingSkillSlot >= 0) {
      const skill = SKILLS[currentActor.def.skills[pendingSkillSlot]];
      const side = skill.target === 'ALLY' ? battle.heroes : battle.enemies;
      const i = side.findIndex((a) => a.alive);
      return i >= 0 ? `${skill.target === 'ALLY' ? 'hero' : 'enemy'}-${i}` : null;
    }
    return null;
  }
  function togglePauseInternal(): void {
    if (!paused) {
      // Remembered only if the player was actually mid-turn on it. Pausing by
      // TAPPING the ribbon icon leaves the focus on that icon, and restoring it
      // would put A back on "pause" the moment the player resumed.
      const cur = regions.focused();
      focusBeforePause = isFlowRegion(cur) ? cur : null;
      paused = true;
    } else {
      paused = false;
      regions.focus(focusBeforePause ?? defaultFocus());
      focusBeforePause = null;
    }
    audio.play('blip');
  }
  function quitBattle(): void {
    if (!battle) return;
    // Tagged the same way main.ts already bolts `deathBy` onto a BattleResult (a side channel outside
    // the sim's own type, read back via the same unknown-cast): battleOutcome() alone can't be told apart
    // from a genuine wipe or stall, and the run screen's GAME_OVER text ("SLAIN BY ...") would otherwise
    // credit the pack for a fight the player walked away from instead of lost.
    finalResult = { ...battleOutcome(battle), ...({ forfeit: true } as Partial<BattleResult>) };
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
        // A heal or a buff pushes no line into battle.log (only hits do), so a support turn used to
        // leave the last hit's line on screen, turns stale. Say what was cast, in the same voice.
        if (skill.hits === 0) {
          // A SELF skill's one target IS the caster, and "Hollow King shrouds
          // Hollow King" reads as a bug: name the skill instead.
          if (ev.targets.length === 1 && ev.targets[0] === ev.caster) {
            currentLogLine = `${ev.caster.def.name} uses ${skill.name}`;
          } else {
            const who = ev.targets.length === 1
              ? ev.targets[0].def.name
              : ev.caster.side === 'HERO' ? 'the party' : 'the pack';
            currentLogLine = `${ev.caster.def.name} ${skill.verb} ${who}`;
          }
        }
        break;
      }
      case 'HIT': {
        const feet = feetFor(battle, ev.target);
        const from = feetFor(battle, ev.attacker);
        // The effect leaves NOW; what the blow lands waits for it to arrive.
        spawnVfx(vfx, lastCastSkill, feet.x, feet.y - 40, { from: { x: from.x, y: from.y - 40 } });
        // Reconstructed to match sim/battle.ts's logHit() exactly (same name/verb/number/marker), advanced
        // per HIT event rather than reading battle.log's tail — see currentLogLine's own comment above.
        const hitMarker = ev.glance ? ' (glance)' : ev.crit ? ' (crit)' : '';
        currentLogLine = `${ev.attacker.def.name} ${SKILLS[lastCastSkill].verb} ${ev.target.def.name} for ${ev.dealt}!${hitMarker}`;
        // The number carries the family in its COLOUR; the (glance)/(crit) words
        // stay in the log line above, which is where a player reads sentences.
        scheduleImpact(
          clock + vfxImpactDelay(lastCastSkill), ev.target, ev.killed, ev.dealt, ev.glance, ev.crit,
          feet.x, popYFor(battle, ev.target),
          popColor(ev.attacker, lastCastSkill, ev.glance, ev.crit),
        );
        break;
      }
      case 'STATUS_APPLIED': {
        const feet = feetFor(battle, ev.target);
        spawnPop(feet.x, headY(battle, ev.target) - 16, ev.status, statusColor(ev.status), TEXT_BODY);
        break;
      }
      case 'STATUS_RESISTED': {
        const feet = feetFor(battle, ev.target);
        spawnPop(feet.x, headY(battle, ev.target) - 16, 'RESIST', POP_GLANCE, TEXT_BODY);
        break;
      }
      case 'HEAL': {
        if (ev.amount > 0) {
          const feet = feetFor(battle, ev.target);
          spawnVfx(vfx, lastCastSkill, feet.x, feet.y - 40);
          spawnPop(feet.x, popYFor(battle, ev.target), `+${ev.amount}`, POP_HEAL, TEXT_POP);
          audio.play('pickup');
          currentLogLine = `${ev.source.def.name} ${SKILLS[lastCastSkill].verb} ${ev.target.def.name} for ${ev.amount}`;
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
        spawnPop(feet.x, popYFor(battle, ev.actor), `${ev.amount}`, POP_ELEMENT.FIRE, TEXT_POP);
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
    clock = 0;
    resetPresentation(newBattle);
    // The biome (and with it the ambient field the flat tiers draw) is main.ts's
    // to swap: the HD tiers let the light plane's own motes and fog do that job.
    deps.setBiome(newOpts.biome);
    flashLeft = 0;
    regions.focus(null);
    scheduleNextTurn();
  }

  // ------------------------------------------------------------- regions ---

  /**
   * Whose plate is up: the focused (or hovered) LIVING enemy. Shared by the
   * plate itself and by the pop spawner, which has to know where the plate will
   * be before it decides how high a number starts.
   */
  function plateActor(b: Battle): Actor | null {
    const id = regions.focused() ?? regions.hovered();
    if (!id || !id.startsWith('enemy-')) return null;
    const a = b.enemies[Number(id.slice(6))];
    return a && a.alive ? a : null;
  }
  /** The plate's height — rows only, so it can be known without measuring any text. */
  function enemyPlateH(a: Actor): number {
    return ENEMY_PLATE_PAD * 2 + ENEMY_PLATE_NAME_H + ENEMY_PLATE_HP_H
      + (a.statuses.length > 0 ? ENEMY_PLATE_STATUS_H : 0);
  }
  function enemyPlateTop(b: Battle, a: Actor): number {
    return Math.max(RIBBON_BOTTOM + 6, headY(b, a) - ENEMY_PLATE_LIFT - enemyPlateH(a));
  }
  /**
   * Where a hit number starts. Normally head + 64, per the contract — but an
   * actor wearing the plate has the space over its head taken, so its numbers
   * start above the PLATE instead. The plate is pinned to the body and the pop
   * clears it: one column, nothing overlapping, and no leader line between them.
   */
  function popYFor(b: Battle, a: Actor): number {
    const top = headY(b, a);
    const y = top - POP_HEAD_OFFSET;
    if (plateActor(b) !== a) return y;
    // A pop's `y` is its TOP and the glyphs hang below it, so clearing the plate
    // means clearing it by the tallest pop's own height as well as the gap —
    // subtracting the gap alone left a crit sitting across the plate's lip.
    return Math.min(y, enemyPlateTop(b, a) - POP_PLATE_CLEAR - FONT_HD.glyphH * TEXT_POP_CRIT);
  }

  /**
   * The feet table the pack is actually standing on, so a sprite's hit cell can
   * be split against its real NEIGHBOURS rather than the three-slot default.
   */
  function enemyFeetTable(b: Battle): readonly { x: number; y: number }[] {
    if (b.enemies.length === 1) return [feetFor(b, b.enemies[0])];
    return b.enemies.length === 2 ? ENEMY_FEET_PAIR : ENEMY_FEET;
  }
  /**
   * An actor's tap cell: the hurtbox's y span, and an x span split at the
   * midpoint between it and each neighbour. A 68-px hurtbox on a 90-px pitch
   * grows to TAP_MIN and overlaps its neighbour by 6 px; the registry resolves
   * those strips by registration order, so they went to the LATER hero. Cells
   * that tile give every point to the actor it is nearest, in the first pass.
   */
  function spriteRect(
    b: Battle, a: Actor, feetTable: readonly { x: number }[], i: number,
  ): { x: number; y: number; w: number; h: number } {
    const feet = feetFor(b, a);
    const hit = actorHitRect(recipeFor(a), feet.x, feet.y);
    const cell = spriteCellX(feetTable, Math.min(i, feetTable.length - 1), hit.w / 2);
    return { x: cell.x, y: hit.y, w: cell.w, h: hit.h };
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
      const cell = spriteRect(battle, a, HERO_FEET, i);
      regions.add(`hero-${i}`, cell.x, cell.y, cell.w, cell.h, { index: i, group: 'heroes', disabled });
    }
    // NO enemy panel column any more: the sprite's own hit rect IS the enemy
    // target, carrying the panel's index and group verbatim, so every keyboard
    // route the column used to serve (arrows across the pack, A to commit)
    // lands on the sprite instead. The registry grows a 68x100 hurtbox to
    // TAP_MIN on its own, so a phone gets the same 96-px target it always had.
    const enemyFeet = enemyFeetTable(battle);
    for (let i = 0; i < battle.enemies.length; i++) {
      const a = battle.enemies[i];
      const disabled = phase === 'HERO_TARGET' && !(enemiesAreTargets && a.alive);
      const cell = spriteRect(battle, a, enemyFeet, i);
      regions.add(`enemy-${i}`, cell.x, cell.y, cell.w, cell.h, { index: i, group: 'enemies', disabled });
    }

    if (phase === 'HERO_SKILL' && currentActor) {
      // The DRAWN row is what is registered; the registry grows each to TAP_MIN
      // itself, and its drawn-first pass is then what keeps a tap on row 1 from
      // resolving to row 2's expanded rect (see layout.ts's skillTailRect).
      const phone = isPhone(pc);
      for (let i = 0; i < 3; i++) {
        const legal = pendingOptions.some((o) => o.skill === i);
        const r = skillHitRect(i, phone);
        regions.add(`skill-${i}`, r.x, r.y, r.w, r.h, { index: i, group: 'skills', disabled: !legal });
      }
      // ...and one twin under the last row, so the list reaches the bottom edge.
      const tail = skillTailRect(phone);
      regions.add('skill-2', tail.x, tail.y, tail.w, tail.h, {
        index: 2, group: 'skills', disabled: !pendingOptions.some((o) => o.skill === 2),
      });
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
        // swaps the scene to its flat LOW planes and hands the glow to the CRT;
        // main.ts owns that swap, and it holds for every screen at once.
        deps.arcade.toggle();
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
    updateImpacts();
    if (battle) {
      for (const a of allActors(battle)) {
        ensureShown(a);
        if (lastHp.get(a) !== a.hp) {
          lastHp.set(a, a.hp);
          hpTouched.set(a, clock);
        }
        shownHp.set(a, approach(shownHp.get(a) ?? a.hp, a.hp, a.maxHp * HP_ANIM_RATE, dt));
        shownAtb.set(a, approach(shownAtb.get(a) ?? a.atb, a.atb, ATB_TURN * ATB_ANIM_RATE, dt));
        const flash = atbFlash.get(a);
        if (flash !== undefined && flash > 0) atbFlash.set(a, Math.max(0, flash - dt));
      }
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.age += dt;
      p.y = Math.max(p.yMin, p.y + p.vy * dt);
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
      // A shot still in flight holds the turn open: the next actor must never
      // start while a number is about to land on the last one.
      if (playHead >= playback.length && playClock >= playEndAt && impactN === 0) scheduleNextTurn();
    }

    input.endFrame();
  }

  // -------------------------------------------------------------- render ---
  // The HUD, in order of the contract's region table. Every one of these runs
  // AFTER renderPost, on the un-shaken, un-bloomed frame: a plate is a plate,
  // not a light source, and a number the player has to read never blooms.

  /**
   * The party's panels — plates, not boxes. A top-down gradient that reaches
   * zero at the foot, no border at all unless the panel is focused, the HP bar
   * a 4-px rule the width of its own NUMBER over a trough tinted to the actor's
   * element, and a status shelf that is simply not there when nothing is
   * active. The element is a small drawn mark on the name row, never the
   * saturated block that used to sit in the corner.
   */
  function drawHeroPanels(ctx: CanvasRenderingContext2D, b: Battle): void {
    const innerW = PANEL_W - PANEL_PAD * 2;
    for (let i = 0; i < b.heroes.length; i++) {
      const a = b.heroes[i];
      const y = PANEL_Y[i];
      const x = PANEL_X_HERO;
      const focused = regions.focused() === `hero-${i}`;
      const isTurn = currentActor === a;
      const hasStatus = a.statuses.length > 0;
      // The drawn height follows the content; the registered rect keeps PANEL_H.
      const drawnH = PANEL_PAD * 2 + PANEL_ROW_NAME_H + PANEL_ROW_GAP + PANEL_ROW_HP_H + PANEL_ROW_GAP
        + PANEL_ROW_ATB_H + (hasStatus ? PANEL_ROW_GAP + PANEL_ROW_STATUS_H : 0);
      gradientPlate(ctx, x, y, PANEL_W, drawnH, {
        topAlpha: isTurn ? 0.46 : 0.35,
        border: focused ? FOCUS_RING : isTurn ? EDGE_REST : undefined,
      });
      const ix = x + PANEL_PAD;
      let ry = y + PANEL_PAD;

      // NAME, with the element's own mark closing the row on the right.
      hudText(ctx, a.def.name.slice(0, 16), ix, ry + 1, { color: a.alive ? PICO8[7] : PICO8[6] });
      drawIcon(ctx, ELEMENT_ICON_NAME[a.def.element], ix + innerW - ELEMENT_GLYPH, ry + 1,
        ELEMENT_GLYPH, ELEMENT_COLOR[a.def.element], a.alive ? 0.95 : 0.5);
      ry += PANEL_ROW_NAME_H + PANEL_ROW_GAP;

      // HP — the tag, the number right-aligned, and the rule UNDER THE NUMBER.
      const hpShown = shownHp.get(a) ?? a.hp;
      const num = `${Math.max(0, Math.round(hpShown))} / ${a.maxHp}`;
      hudText(ctx, 'HP', ix, ry + 2, { px: HUD_SMALL, color: PICO8[6], alpha: 0.8 });
      const numW = hudWidth(ctx, num, HUD_PX);
      hudText(ctx, num, ix + innerW, ry - 1, { align: 'right', color: a.alive ? PICO8[7] : PICO8[6] });
      drawHpRule(ctx, ix + innerW - numW, ry + PANEL_ROW_HP_H - HP_RULE_H + 1, numW,
        hpShown / a.maxHp, a.def.element, a.alive);
      ry += PANEL_ROW_HP_H + PANEL_ROW_GAP;

      // ATB — a 2-px line, and the ONLY place an attack bar is drawn on a hero.
      const atbShown = shownAtb.get(a) ?? a.atb;
      const flash = atbFlash.get(a) ?? 0;
      // Dimmer than the HP rule on purpose: the attack bar is a clock, not a
      // life bar, and it must never be the brightest line in the panel.
      ctx.save();
      ctx.globalAlpha = flash > 0 ? 0.85 : 0.5;
      drawBar(ctx, ix, ry + (PANEL_ROW_ATB_H - ATB_LINE_H) / 2, innerW, ATB_LINE_H,
        atbShown / ATB_TURN, flash > 0 ? ACCENT : ACCENT_COOL);
      ctx.restore();
      ry += PANEL_ROW_ATB_H + PANEL_ROW_GAP;

      if (hasStatus) drawPanelStatusRow(ctx, ix, ry, a);
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
    ctx.fillStyle = `rgba(${INK},0.82)`;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const art = portraitFor(recipeFor(a), a.def.element);
    if (art) {
      ctx.imageSmoothingEnabled = false;
      // The face fills whatever diamond it is in, so the 1.4x current chip
      // carries a 1.4x portrait instead of a small face in a big frame.
      const w = r * 1.68;
      ctx.drawImage(art, cx - w / 2, cy - w / 2 - r * 0.06, w, w);
    }
    ctx.restore();
    // The actor ON TURN wears the key light's amber at 2 px; everyone else wears
    // their own element at 1 — so "now" is answered by the ribbon at a glance.
    ctx.lineWidth = current ? 2 : 1;
    ctx.strokeStyle = current ? ACCENT : ELEMENT_COLOR[a.def.element];
    ctx.globalAlpha = current ? 0.95 : 0.5;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The ribbon reads THIS TURN / NEXT TURN, not eight equal chips: the actor on
   * turn is drawn 1.4x, and where the queue rolls over into the next round (the
   * first actor that comes round a second time) a chevron divider breaks the
   * run — octopath-4's own "<< <<". Positions are computed into a pooled array;
   * the frame allocates nothing.
   */
  const chipSlots: { cx: number; cy: number; r: number }[] = [];
  const seenInQueue = new Set<Actor>();

  function layoutQueue(queue: readonly Actor[]): number {
    const r0 = (QUEUE_CHIP / 2) * QUEUE_CURRENT_SCALE;
    const r = QUEUE_CHIP / 2 - 3;
    seenInQueue.clear();
    let rollover = -1;
    for (let i = 0; i < queue.length; i++) {
      if (seenInQueue.has(queue[i])) { rollover = i; break; }
      seenInQueue.add(queue[i]);
    }
    let x = QUEUE_X;
    for (let i = 0; i < queue.length; i++) {
      if (i === rollover) x += QUEUE_ROLLOVER_GAP;
      const rad = i === 0 ? r0 : r;
      let slot = chipSlots[i];
      if (!slot) { slot = { cx: 0, cy: 0, r: 0 }; chipSlots[i] = slot; }
      slot.cx = x + rad;
      slot.cy = i === 0 ? QUEUE_Y + r0 - 6 : QUEUE_Y + QUEUE_CHIP / 2;
      slot.r = rad;
      x += rad * 2 + QUEUE_GAP;
    }
    return rollover;
  }

  /** The chevron pair that says "everything past here is next round". */
  function drawChevron(ctx: CanvasRenderingContext2D, x: number, cy: number): void {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = PICO8[6];
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const dx of [-7, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + dx + 5, cy - 6);
      ctx.lineTo(x + dx, cy);
      ctx.lineTo(x + dx + 5, cy + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRibbonQueue(ctx: CanvasRenderingContext2D, b: Battle): void {
    const queue = forecast(b, QUEUE_LEN);
    const rollover = layoutQueue(queue);
    for (let i = 0; i < queue.length; i++) {
      const slot = chipSlots[i];
      const a = queue[i];
      if (i > 0 && i !== rollover) {
        // The thread the queue hangs on, drawn behind the chips.
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = PICO8[6];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chipSlots[i - 1].cx + chipSlots[i - 1].r, slot.cy + 0.5);
        ctx.lineTo(slot.cx, slot.cy + 0.5);
        ctx.stroke();
        ctx.restore();
      }
      if (i === rollover) {
        const dx = slot.cx - slot.r - QUEUE_ROLLOVER_GAP / 2;
        drawChevron(ctx, dx, slot.cy);
        // octopath-3's own caption under the divider: everything right of it is next round.
        const lw = hudWidth(ctx, 'NEXT TURN', HUD_SMALL);
        hudText(ctx, 'NEXT TURN', dx - lw / 2 + 2, slot.cy + slot.r + 4, { px: HUD_SMALL, color: PICO8[6], alpha: 0.65 });
      }
      drawQueueChip(ctx, slot.cx, slot.cy, slot.r, a, i === 0);
      if (a.side === 'ENEMY' && intent(b, a).stunned) {
        const bx = slot.cx + slot.r - INTENT_BADGE + 2;
        const by = slot.cy + slot.r - INTENT_BADGE + 2;
        plate(ctx, bx, by, INTENT_BADGE, INTENT_BADGE, { alpha: 0.85, border: C_DEBUFF, radius: 3 });
        drawIcon(ctx, 'spiral', bx + 4, by + 4, INTENT_BADGE - 8, C_DEBUFF);
      }
    }
    // "NEXT TURN": the caret under the actor whose turn it is, in the key light's amber.
    if (queue.length > 0) {
      const slot = chipSlots[0];
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.moveTo(slot.cx, slot.cy + slot.r + 2);
      ctx.lineTo(slot.cx - 6, slot.cy + slot.r + 9);
      ctx.lineTo(slot.cx + 6, slot.cy + slot.r + 9);
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
    plate(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, { alpha: 0.5, border: pauseFocused ? PICO8[7] : EDGE_SOFT });
    ctx.fillStyle = pauseFocused ? PICO8[7] : PICO8[6];
    ctx.fillRect(PAUSE_ICON.x + 22, PAUSE_ICON.y + 20, 6, 24);
    ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 20, 6, 24);
  }

  /**
   * One shadowed line over a SHORT local wash sized to the text — no full-width
   * plate, no rule cutting the frame across all 1280 px (composition item 4).
   */
  function drawLogLine(ctx: CanvasRenderingContext2D, _b: Battle): void {
    const raw = phase === 'HERO_TARGET' ? promptText : currentLogLine;
    if (!raw) return;
    const text = raw.slice(0, LOG_LINE_MAX);
    const w = Math.min(LOG_MAX_W, hudWidth(ctx, text, HUD_PX));
    textWash(ctx, LOG_TEXT.x - LOG_WASH_BLEED, LOG_TEXT.y - 8, w + LOG_WASH_BLEED * 2, LOG_WASH_H, 0.5);
    hudText(ctx, text, LOG_TEXT.x, LOG_TEXT.y, { color: phase === 'HERO_TARGET' ? ACCENT : PICO8[7] });
  }

  /**
   * The enemy panel column, moved onto the stage. octopath-4 gives its pack no
   * side panel at all: the targeted lizardman carries its own small plate, and
   * that is what this is — name, HP with its rule, and the status marks, floated
   * over whichever enemy is focused, hovered or being targeted, pinned 18 px off
   * the REAL silhouette with a pointer tail — octopath-4 keeps its plate tight
   * to the body, and so does this one.
   */
  function drawEnemyPlate(ctx: CanvasRenderingContext2D, b: Battle): void {
    const a = plateActor(b);
    if (!a) return;

    const name = a.def.name.slice(0, 16);
    const hpShown = shownHp.get(a) ?? a.hp;
    const hp = `${Math.max(0, Math.round(hpShown))} / ${a.maxHp}`;
    const nameW = hudWidth(ctx, name, HUD_SMALL);
    const hpW = hudWidth(ctx, hp, HUD_SMALL);
    const statuses = a.statuses.length;
    const statusW = statuses > 0 ? statuses * (STATUS_ICON - 6) + (statuses - 1) * 2 : 0;
    const inner = Math.max(nameW + ELEMENT_GLYPH + 8, hpW, statusW, ENEMY_PLATE_MIN_W);
    const w = inner + ENEMY_PLATE_PAD * 2;
    const h = enemyPlateH(a);

    const feet = feetFor(b, a);
    const x = Math.round(Math.min(STAGE_X1 - w, Math.max(STAGE_X0, feet.x - w / 2)));
    const y = Math.round(enemyPlateTop(b, a));
    const targeting = phase === 'HERO_TARGET';
    gradientPlate(ctx, x, y, w, h, { topAlpha: 0.62, border: targeting ? ACCENT : EDGE_SOFT });

    // A tail, and nothing else. The plate sits 18 px off the real silhouette, so
    // there is no distance for a leader stem to cross — and no stem to run
    // through the damage number, which is what the 96-px lift produced.
    const tailX = Math.min(x + w - 14, Math.max(x + 14, Math.round(feet.x)));
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = `rgba(${INK},1)`;
    ctx.beginPath();
    ctx.moveTo(tailX - 7, y + h - 1);
    ctx.lineTo(tailX + 7, y + h - 1);
    ctx.lineTo(tailX, y + h + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const ix = x + ENEMY_PLATE_PAD;
    hudText(ctx, name, ix, y + ENEMY_PLATE_PAD, { px: HUD_SMALL, color: PICO8[7] });
    drawIcon(ctx, ELEMENT_ICON_NAME[a.def.element], x + w - ENEMY_PLATE_PAD - ELEMENT_GLYPH, y + ENEMY_PLATE_PAD - 1,
      ELEMENT_GLYPH, ELEMENT_COLOR[a.def.element], 0.95);
    const hy = y + ENEMY_PLATE_PAD + ENEMY_PLATE_NAME_H;
    hudText(ctx, hp, ix, hy, { px: HUD_SMALL, color: PICO8[6] });
    drawHpRule(ctx, ix, hy + 17, Math.max(hpW, 48), hpShown / a.maxHp, a.def.element);
    if (statuses > 0) {
      let sx = ix;
      const sy = hy + ENEMY_PLATE_HP_H + 4;
      for (const st of a.statuses) {
        drawIcon(ctx, STATUS_ICON_NAME[st.kind], sx, sy, STATUS_ICON - 6, statusColor(st.kind));
        sx += STATUS_ICON - 4;
      }
    }
  }

  /**
   * The command list: three ~320x40 rows stacked bottom-left, name left and
   * cooldown pips right — not three 400x96 slabs across the whole width. The
   * DRAWN row is smaller than its registered hit rect (the PAUSE pattern), so a
   * phone still gets a TAP_MIN target that reaches the bottom edge.
   */
  function drawCommandList(ctx: CanvasRenderingContext2D, actor: Actor): void {
    const phone = isPhone(pc);
    const touch = input.pointer.type === 'touch';
    for (let i = 0; i < 3; i++) {
      const skill = SKILLS[actor.def.skills[i]];
      const legal = pendingOptions.some((o) => o.skill === i);
      const r = skillRowRect(i, phone);
      const focused = regions.focused() === `skill-${i}`;
      gradientPlate(ctx, r.x, r.y, r.w, r.h, {
        topAlpha: focused ? 0.62 : legal ? 0.44 : 0.24,
        border: focused ? FOCUS_RING : undefined,
      });
      hudText(ctx, skill.name, r.x + 14, Math.round(r.y + (r.h - HUD_PX * 1.16) / 2), {
        color: legal ? PICO8[7] : PICO8[5],
      });
      // Pips only where a cooldown exists at all — five grey dots on a free
      // skill was noise the eye had to discard every frame.
      let right = r.x + r.w - 14;
      if (!touch) {
        hudText(ctx, String(i + 1), right, Math.round(r.y + (r.h - HUD_SMALL * 1.16) / 2), {
          px: HUD_SMALL, align: 'right', color: C_MUTED,
        });
        right -= 18;
      }
      const total = skill.cooldown;
      if (total <= 0) continue;
      const cd = actor.cooldowns[i];
      const cy = Math.round(r.y + r.h / 2);
      for (let k = 0; k < total; k++) {
        const cx = right - (total - 1 - k) * 12;
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = k < cd ? C_DEBUFF : PIP_EMPTY;
        ctx.fill();
      }
    }
  }

  function drawPops(ctx: CanvasRenderingContext2D): void {
    // The one bold thing on screen, and the one that stays bitmap: FONT_HD.
    // Every pop is keylined in ink (a lit floor eats an unoutlined glyph) and
    // clamped inside the safe inset AND out of the hero panel column, so a big
    // number can never land half-under a panel.
    for (const p of pops) {
      ctx.globalAlpha = clamp01(1 - p.age / p.dur);
      const tw = textWidth(p.text, p.scale, 1, FONT_HD);
      let x = Math.min(CANVAS_W - 24 - tw, Math.max(24, Math.round(p.x - tw / 2)));
      const inPanelBand = p.y < PANEL_Y[2] + PANEL_H && p.y + FONT_HD.glyphH * p.scale > PANEL_Y[0];
      if (inPanelBand && x + tw > PANEL_X_HERO - 10) x = PANEL_X_HERO - 10 - tw;
      // A 2-px ink keyline, not one: the engine's `outline` lays a single pixel
      // all round, which the key pool eats — POP_GLANCE measured ~3:1 against the
      // lit floor through it. Four ink passes at +-1 px thicken that keyline, so
      // every pop is read against INK rather than against whatever it is over.
      const py = Math.round(p.y);
      for (let k = 0; k < 4; k++) {
        drawText(ctx, p.text, x + POP_KEY_DX[k], py + POP_KEY_DY[k], {
          font: FONT_HD, scale: p.scale, color: INK_KEYLINE,
        });
      }
      drawText(ctx, p.text, x, py, {
        font: FONT_HD, scale: p.scale, color: p.color, outline: INK_KEYLINE,
      });
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
      // The sides swapped with the composition: the party stands right and looks LEFT into the frame.
      drawActor(ctx, recipeFor(a), { pose, time, element: a.def.element, facing: a.side === 'HERO' ? -1 : 1, x: feet.x, y: feet.y });
    }
    // 3. The HP hairline (tucked INTO the contact shadow, never a slab on the
    //    floor) and the head status row, over every sprite. Both are HUD drawn
    //    on the stage plane, so an overlay suppresses them with the rest of it.
    if (paused || phase === 'INSPECT') return;
    for (const a of order) {
      if (!a.alive) continue;
      const feet = feetFor(b, a);
      const hpShown = shownHp.get(a) ?? a.hp;
      const frac = clamp01(hpShown / a.maxHp);
      const touched = clock - (hpTouched.get(a) ?? -99);
      if (frac < 0.999 || touched < HP_HAIRLINE_HOLD) {
        const span = actorHitRect(recipeFor(a), feet.x, feet.y).w * HP_HAIRLINE_SPAN;
        const w = Math.round(span);
        const x0 = Math.round(feet.x - w / 2);
        const y0 = Math.round(feet.y - 1);
        // It fades in with the change and back out again when HP is full.
        const fade = frac < 0.999 ? 1 : clamp01((HP_HAIRLINE_HOLD - touched) / 0.4);
        ctx.save();
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = HAIRLINE_TROUGH;
        ctx.fillRect(x0, y0, w, HP_HAIRLINE_H);
        ctx.fillStyle = a.side === 'HERO' ? ACCENT_HP : C_DEBUFF;
        ctx.fillRect(x0, y0, Math.max(1, Math.round(w * frac)), HP_HAIRLINE_H);
        ctx.restore();
      }
      drawHeadStatusRow(ctx, feet.x, headY(b, a) - STATUS_ICON - 6, a);
    }
  }

  /** The rects renderLightPlane needs for rim light and prop glow — refilled in place, never reallocated. */
  function fillLightActors(b: Battle, order: readonly Actor[]): void {
    lightActorN = 0;
    for (const a of order) {
      if (!a.alive) continue;
      const feet = feetFor(b, a);
      const w = isBossActor(b, a) ? BOSS_W : ACTOR_W;
      const top = headY(b, a);
      addLightActor(feet.x - w / 2, top, w, feet.y - top, ACTOR_GLOW[a.def.id] ?? 0);
    }
    // Live VFX are light too: an impact or a projectile is the brightest thing
    // on the plane for its handful of frames, and the bloom should catch it.
    // vfx.ts owns what each archetype actually covers — a light beam stands 3.2
    // sizes tall, a slash reaches ±1.7 across, a projectile spans from its
    // origin to the target, a heal barely leaves its centre — so a ±size box
    // would under-light half of them and over-light the rest.
    for (const v of vfx) {
      if (v.age >= v.duration) continue;
      const box = vfxBounds(v, vfxBox);
      addLightActor(box.x, box.y, box.w, box.h, 0.7);
    }
    lightActors.length = lightActorN;
  }

  /** The battle HUD is SUPPRESSED under this (see render): the panel is opaque enough to own the frame. */
  function drawInspectOverlay(ctx: CanvasRenderingContext2D, b: Battle): void {
    dimScene(pc, 0.62);
    plate(ctx, INSPECT.x, INSPECT.y, INSPECT.w, INSPECT.h, { alpha: 0.92, border: EDGE_REST, radius: 6 });
    const member = b.party.members[inspectSlot];
    if (!member) return;
    hudText(ctx, member.def.name, INSPECT_NAME.x, INSPECT_NAME.y, { px: HUD_LARGE, color: PICO8[7] });
    for (let i = 0; i < SLOTS.length; i++) {
      const slot = SLOTS[i];
      const relic = member.relics[slot];
      const ry = inspectRowY(i);
      // The contract's 32-px slot icon, finally an icon: a mark, not `Wp`/`Bt`.
      drawIcon(ctx, SLOT_ICON_NAME[slot], INSPECT.x + 24, ry, INSPECT_ROW_ICON, relic ? ACCENT : PICO8[5], relic ? 1 : 0.7);
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
    drawSecondaryButton(ctx, BACK.x, BACK.y, BACK.w, BACK.h, 'BACK', regions.focused() === 'inspect-back');
  }

  /**
   * PAUSED draws over the HUD, not under it: render() suppresses the panels,
   * the ribbon, the log and the command list while paused, so the dim only ever
   * has the lit world to push back and PAUSED never sits in front of a live
   * panel. RESUME is the primary action (a lit plate); the other two are
   * bordered, because a button with no border dissolved into the dimmed stage.
   */
  function drawPauseOverlay(ctx: CanvasRenderingContext2D): void {
    dimScene(pc, 0.66);
    const title = 'PAUSED';
    const tw = hudWidth(ctx, title, PAUSED_PX, 200);
    hudText(ctx, title, (CANVAS_W - tw) / 2, PAUSED_TEXT_Y, { px: PAUSED_PX, weight: 200, color: PICO8[7] });
    const labels = ['RESUME', `ARCADE ${deps.arcade.on ? 'ON' : 'OFF'}`, 'QUIT'];
    for (let i = 0; i < 3; i++) {
      const y = PAUSE_BTN_Y[i];
      const disabled = i === 1 && !crt;
      const focused = regions.focused() === `pause-${i}`;
      if (i === 0) {
        drawPrimaryButton(ctx, PAUSE_BTN_X, y, PAUSE_BTN.w, PAUSE_BTN.h, labels[i], focused);
        continue;
      }
      const ph = 56;
      const py = y + (PAUSE_BTN.h - ph) / 2;
      plate(ctx, PAUSE_BTN_X, py, PAUSE_BTN.w, ph, {
        border: focused ? FOCUS_RING : EDGE_LIT, borderWidth: focused ? 2 : 1, alpha: disabled ? 0.4 : 0.62,
      });
      hudTextCentered(ctx, labels[i], PAUSE_BTN_X, py, PAUSE_BTN.w, ph, { color: disabled ? PICO8[5] : PICO8[7] });
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
    // A frozen number hanging over PAUSED is noise, not information.
    if (!paused) drawPops(ctx);
    juice.postRender(ctx, CANVAS_W, CANVAS_H); // restore the shake, then the flash
    // Pass 5: bloom + grade, over the finished world and under the whole HUD.
    light.renderPost(ctx, { time: clock, flashAlpha: flashAlphaNow() });

    // The HUD is suppressed under either overlay: PAUSED used to sit in front of
    // six full-saturation bars, and the inspect panel used to have the battle's
    // own numbers ghosting through it (UI item 6).
    const overlay = paused || phase === 'INSPECT';
    if (!overlay) {
      drawHeroPanels(ctx, b);
      drawRibbon(ctx, b);
      drawLogLine(ctx, b);
      drawEnemyPlate(ctx, b);
      if (phase === 'HERO_SKILL' && currentActor) drawCommandList(ctx, currentActor);
    }

    if (phase === 'INSPECT') drawInspectOverlay(ctx, b);
    if (paused) drawPauseOverlay(ctx);
    if (deps.arcade.on && crt) crt.render(ctx, CANVAS_W, CANVAS_H, 1 / 60);

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
    get phase() {
      return phase;
    },
    get currentActorId() {
      return currentActor?.def.id ?? null;
    },
    togglePause: togglePauseInternal,
  };
}

// ============================================ battle-only draw helpers ==
// The shared HUD language (hudText, plate, drawBar, the chips) now lives in
// screens/hud.ts, so the title, the cards and the end screens speak it too.
// What is left here is what only a battle draws: the status rows built out of
// those chips.

/**
 * Above an actor's head on the stage: <= STATUS_ABOVE_MAX marks, then 3 + "+N".
 * Marks, not letters — `r`, `B`, `Z` and `*` told the player nothing.
 */
function drawHeadStatusRow(ctx: CanvasRenderingContext2D, cx: number, y: number, a: Actor): void {
  const list = a.statuses;
  if (list.length === 0) return;
  const overflow = list.length > STATUS_ABOVE_MAX;
  const shown = overflow ? list.slice(0, 3) : list.slice(0, STATUS_ABOVE_MAX);
  const count = shown.length + (overflow ? 1 : 0);
  const step = STATUS_ICON - 4;
  let x = cx - (count * step - 2) / 2;
  for (const st of shown) {
    drawIcon(ctx, STATUS_ICON_NAME[st.kind], x, y, STATUS_ICON - 6, statusColor(st.kind));
    x += step;
  }
  if (overflow) hudText(ctx, `+${list.length - 3}`, x + 2, y + 3, { px: HUD_SMALL, color: PICO8[6] });
}

/** A hero panel's status shelf: <= six marks; past six, five and a "+N". The shelf is not drawn at all when it is empty. */
function drawPanelStatusRow(ctx: CanvasRenderingContext2D, x: number, y: number, a: Actor): void {
  let cx = x;
  const overflow = a.statuses.length > STATUS_ICON_MAX;
  const shown = overflow ? a.statuses.slice(0, 5) : a.statuses.slice(0, STATUS_ICON_MAX);
  for (const st of shown) {
    drawIcon(ctx, STATUS_ICON_NAME[st.kind], cx, y, STATUS_ICON - 4, statusColor(st.kind));
    cx += STATUS_ICON - 2;
  }
  if (overflow) hudText(ctx, `+${a.statuses.length - 5}`, cx + 2, y + 4, { px: HUD_SMALL, color: PICO8[6] });
}
