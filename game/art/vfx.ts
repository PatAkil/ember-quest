// Ember Quest v3 — game/art/vfx.ts
//
// Procedural VFX at native (unscaled) resolution — the smooth layer that sits
// on top of the actor plane's hard pixels (DESIGN.md → Presentation →
// Procedural VFX). The reference is Octopath Traveler's skill effects: a skill
// is a CLOUD — bright motes, streaks and sparks with a hot white core, layered
// over the sprite plane — never a flat gradient blob.
//
// So every archetype here is a particle system. An instance owns an array of
// `Particle` records taken from a pool at spawn; `updateVfx` integrates them
// and `renderVfx` blits a cached sprite per particle. Nothing allocates in the
// steady state: no gradients, no strings, no arrays, no closures per frame.
//
// Bloom (engine/light.ts → renderPost) thresholds by self-multiply: the frame
// is multiplied by itself twice, so a pixel's value is cubed. Mid-grey drops to
// 1/8, and only near-white or fully saturated pixels survive to be blurred back
// over the frame. Every effect is therefore designed AROUND a hot core: the
// particle sprites carry a white centre, and where motes overlap under
// `'lighter'` the sum clips toward pure white — so a dense cluster grows its own
// bloom core while the scattered outliers stay coloured and crisp. That is
// exactly the reference frame's structure.
//
// Two caches, for two different things:
//   * sprites — an offscreen canvas is context-independent, so the atlas is a
//     plain Map keyed by (variant, colour), baked lazily on first use and
//     blitted with `drawImage`. One blit per particle beats one gradient fill
//     per particle by a wide margin.
//   * gradients — a CanvasGradient belongs to the context that built it (like a
//     CanvasPattern, see engine/draw.ts's DITHER_CACHE), so the two gradients
//     drawn straight onto the frame (the light pillar, the ward dome) live in a
//     per-context WeakMap and die with a dead context. Their keys are built at
//     spawn, never per frame.
//
// The module never touches the DOM at import time — sprites bake on first
// spawn — so a headless import stays headless.
//
// Screen shake, hit-stop and damage pops belong to the battle screen; this file
// only draws light. It also never calls `setTransform`, because the caller
// draws inside juice's shake transform and wiping it would unshake the effect.

import { pulse } from '../../engine';
import type { SkillId, StatusKind } from '../types';

// --- Kinds ----------------------------------------------------------------

/** The thirteen reusable archetypes every skill's VFX is built from. */
export type VfxKind =
  | 'slash'
  | 'fireBurst'
  | 'windBlade'
  | 'waterWave'
  | 'lightBeam'
  | 'darkPulse'
  | 'healShimmer'
  | 'shieldDome'
  | 'stunStar'
  | 'burnFlicker'
  | 'shockwave'
  | 'projectile'
  | 'frostShards';

interface VfxRecipeConfig {
  kind: VfxKind;
  /** Primary colour (a hex string — see PALETTE below). */
  color: string;
  /** Secondary/hot-core colour; defaults to `color`. */
  color2?: string;
  /** Native px — the archetype's own DEFAULT_SIZE is used when omitted. */
  size?: number;
  /** Seconds — the archetype's own DEFAULT_DURATION is used when omitted. */
  duration?: number;
}

// A small, named palette so the ~60 recipe rows below read as intent
// ("FIRE", "HEAL") rather than repeated hex literals. Values are the PICO8
// hues DESIGN.md already put on the rest of the v3 UI (engine/palette.ts),
// kept as plain hex here so vfx.ts has no runtime dependency beyond `pulse`.
const FIRE = '#FFA300';
const FIRE_HOT = '#FFEC27';
const WIND = '#00E436';
const WIND_PALE = '#FFF1E8';
const WATER = '#29ADFF';
const WATER_FOAM = '#FFF1E8';
const LIGHT = '#FFEC27';
const LIGHT_WHITE = '#FFF1E8';
const DARK = '#7E2553';
const DARK_GLOW = '#FF77A8';
// Restoration and warding are NOT elements, and they must not borrow an
// element's hue: HEAL used to be WIND's exact green, so a Gust landing and a
// Mend healing were the same colour on the same frame. Two dedicated friendly
// hues instead — mint for life, pale ice-blue for a ward — both with a white
// core, neither of them any attack's colour.
const HEAL = '#58E8C8';
const HEAL_WHITE = '#E6FFF7';
const WARD = '#BFE6FF';
const WARD_WHITE = '#F0FAFF';
const PHYSICAL = '#C2C3C7';
const RUST = '#AB5236';
const FROST = '#FFF1E8';
const GHOST = '#83769C';
/** darkPulse's hole — not a palette hue, the absence of one. */
const VOID = '#050308';

/** One row per SkillId — `Record<SkillId, ...>` makes the compiler prove every skill in game/data/skills.ts has a VFX. */
export const VFX_RECIPES: Record<SkillId, VfxRecipeConfig> = {
  // --- EMBER · FIRE --------------------------------------------------------
  CINDER: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  FLARE: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 68 },
  INFERNO: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 92, duration: 0.72 },
  INFERNO_BRAND: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 92, duration: 0.72 },
  // --- GALE · WIND -----------------------------------------------------------
  GUST: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  SQUALL: { kind: 'windBlade', color: WIND, color2: WIND_PALE, size: 64 },
  TAILWIND: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 60, duration: 0.8 },
  GUST_RIP: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  // --- TIDE · WATER ------------------------------------------------------------
  RIPPLE: { kind: 'waterWave', color: WATER, color2: WATER_FOAM },
  TIDEPOOL: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  UNDERTOW: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 74, duration: 0.85 },
  UNDERTOW_WARD: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 74, duration: 0.85 },
  // --- BASALT · FIRE (DEF wall) ------------------------------------------------
  BASH: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  BULWARK: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  QUAKE: { kind: 'shockwave', color: RUST, color2: FIRE, size: 78 },
  BULWARK_RAMPART: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, size: 76, duration: 0.7 },
  // --- SABLE · DARK --------------------------------------------------------
  HEX: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW },
  MIRE: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 74 },
  ECLIPSE: { kind: 'stunStar', color: DARK_GLOW, color2: DARK, duration: 0.75 },
  HEX_LINGER: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW },
  // --- LUMEN · LIGHT -----------------------------------------------------------
  LANCE: { kind: 'projectile', color: LIGHT, color2: LIGHT_WHITE },
  RADIANCE: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 64, duration: 0.8 },
  JUDGEMENT: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 86, duration: 0.78 },
  JUDGEMENT_REFUND: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 86, duration: 0.78 },

  // --- EMBER CRYPT -------------------------------------------------------------
  SCORCH: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  KINDLE: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  BITE: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  REND: { kind: 'slash', color: PHYSICAL, color2: FIRE, duration: 0.55 },
  CUDGEL: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  RALLY: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 60, duration: 0.8 },
  MEND: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  WAIL: { kind: 'windBlade', color: GHOST, color2: WIND_PALE },
  CHOKE: { kind: 'stunStar', color: GHOST, color2: WIND_PALE },
  SHIELD_BASH: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  BRACE: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  IMMOLATE: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 84 },
  REAP: { kind: 'slash', color: DARK, color2: DARK_GLOW },
  DREAD_WAIL: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 84 },
  SHROUD: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, size: 76, duration: 0.8 },
  DOOM: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 76, duration: 0.72 },

  // --- FROST MARSH ---------------------------------------------------------------
  TONGUE_LASH: { kind: 'slash', color: WATER, color2: WATER_FOAM },
  BOG_SPIT: { kind: 'projectile', color: WATER, color2: RUST },
  CHILL: { kind: 'frostShards', color: FROST, color2: WATER },
  DEEP_FREEZE: { kind: 'stunStar', color: FROST, color2: WATER, duration: 0.75 },
  CANE: { kind: 'slash', color: WATER, color2: WATER_FOAM },
  SALVE: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  BRINE_WARD: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, size: 76, duration: 0.7 },
  PINCH: { kind: 'slash', color: WATER, color2: PHYSICAL },
  CRUSH: { kind: 'shockwave', color: WATER, color2: PHYSICAL, size: 72 },
  FLICKER: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  IGNITE: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  RUSTED_BLADE: { kind: 'slash', color: RUST, color2: WATER },
  DRAG_UNDER: { kind: 'waterWave', color: WATER, color2: DARK },
  DELUGE: { kind: 'waterWave', color: WATER, color2: WATER_FOAM, size: 86 },
  HALO_LASH: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE },
  SMITE: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 90, duration: 0.78 },
  PALE_FLOOD: { kind: 'waterWave', color: LIGHT_WHITE, color2: WATER, size: 86 },
  SANCTIFY: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 70, duration: 0.8 },

  // --- SKY RUINS -------------------------------------------------------------
  TALON: { kind: 'slash', color: PHYSICAL, color2: WIND },
  GALE_DIVE: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  ZEPHYR: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  DAZZLE_GUST: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  STONE_FIST: { kind: 'slash', color: PHYSICAL, color2: WIND },
  WARD_STONE: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  MEND_ECHO: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  RAINSPIT: { kind: 'projectile', color: WATER, color2: WATER_FOAM },
  DOWNPOUR: { kind: 'waterWave', color: WATER, color2: WATER_FOAM },
  DRAKE_CLAW: { kind: 'slash', color: PHYSICAL, color2: WIND },
  TEMPEST_WING: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 60, duration: 0.8 },
  GALE_BREATH: { kind: 'windBlade', color: WIND, color2: WIND_PALE, size: 80 },
  SKYRENT: { kind: 'slash', color: PHYSICAL, color2: DARK },
  STORMCALL: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 84 },
  KINGLY_GUARD: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  RUIN_JUDGEMENT: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 76, duration: 0.72 },

  // --- ASHEN FORGE -------------------------------------------------------------
  SLAG_FIST: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  MOLTEN_SLAM: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  SNARL_BITE: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  BRANDING_BITE: { kind: 'slash', color: PHYSICAL, color2: FIRE, duration: 0.55 },
  TONGS_STRIKE: { kind: 'slash', color: PHYSICAL, color2: FIRE },
  TEMPER: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 60, duration: 0.8 },
  EMBER_SALVE: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  HISS: { kind: 'projectile', color: WATER, color2: WATER_FOAM },
  SCALD: { kind: 'burnFlicker', color: WATER, color2: WATER_FOAM },
  GREATHAMMER: { kind: 'shockwave', color: RUST, color2: FIRE },
  FORGE_WARD: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  WHITE_HEAT: { kind: 'fireBurst', color: FIRE, color2: FIRE_HOT, size: 84 },
  SEARLIGHT: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE },
  SAINTS_WRATH: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 90, duration: 0.78 },
  CRUCIBLE_FLARE: { kind: 'fireBurst', color: LIGHT_WHITE, color2: FIRE, size: 86 },
  SACRED_EMBER: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, size: 76, duration: 0.8 },

  // --- SUNKEN VAULT -------------------------------------------------------------
  RUSTED_PIKE: { kind: 'slash', color: RUST, color2: WATER },
  UNDERTOW_GRASP: { kind: 'waterWave', color: WATER, color2: DARK },
  STING: { kind: 'projectile', color: WATER, color2: WATER_FOAM },
  NUMBING_STING: { kind: 'waterWave', color: WATER, color2: WATER_FOAM },
  CURRENT_LASH: { kind: 'waterWave', color: WATER, color2: WATER_FOAM },
  TIDAL_BLESSING: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 60, duration: 0.8 },
  DEEP_MEND: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  CURRENT_JOLT: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  RIPTIDE_GUST: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  MAW_BITE: { kind: 'slash', color: PHYSICAL, color2: WATER },
  CRUSHING_COILS: { kind: 'shockwave', color: WATER, color2: PHYSICAL },
  TSUNAMI: { kind: 'waterWave', color: WATER, color2: WATER_FOAM, size: 86 },
  ABYSSAL_CLAW: { kind: 'slash', color: PHYSICAL, color2: DARK },
  DROWNING_CHORUS: { kind: 'stunStar', color: DARK, color2: DARK_GLOW, size: 80 },
  CRUSHING_DEPTHS: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 80, duration: 0.72 },
  THRONE_OF_RUIN: { kind: 'darkPulse', color: DARK, color2: DARK_GLOW, size: 90, duration: 0.78 },

  // --- STORM SPIRE -------------------------------------------------------------
  THUNDER_STRIKE: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  DIVEBOMB: { kind: 'windBlade', color: WIND, color2: WIND_PALE },
  WIND_PALM: { kind: 'slash', color: PHYSICAL, color2: WIND },
  HUNDRED_GUSTS: { kind: 'windBlade', color: WIND, color2: WIND_PALE, size: 64 },
  STAFF_JAB: { kind: 'slash', color: PHYSICAL, color2: WIND },
  STAND_FAST: { kind: 'shieldDome', color: WARD, color2: WARD_WHITE, duration: 0.7 },
  UPDRAFT_MEND: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE },
  EMBER_LICK: { kind: 'projectile', color: FIRE, color2: FIRE_HOT },
  CINDER_BURST: { kind: 'burnFlicker', color: FIRE, color2: FIRE_HOT },
  GRANITE_FIST: { kind: 'shockwave', color: PHYSICAL, color2: WIND },
  THUNDERCLAP: { kind: 'stunStar', color: WIND, color2: WIND_PALE, duration: 0.75 },
  CHAIN_LIGHTNING: { kind: 'shockwave', color: WIND, color2: LIGHT_WHITE, size: 78 },
  RADIANT_LANCE: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE },
  JUDGEMENT_BOLT: { kind: 'lightBeam', color: LIGHT, color2: LIGHT_WHITE, size: 88, duration: 0.78 },
  TEMPEST_CHOIR: { kind: 'windBlade', color: LIGHT_WHITE, color2: WIND, size: 82 },
  AEGIS_OF_LIGHT: { kind: 'healShimmer', color: HEAL, color2: HEAL_WHITE, size: 70, duration: 0.8 },
};

// --- Status glows -----------------------------------------------------------

interface StatusGlowConfig {
  color: string;
  /** Seconds per pulse cycle — a fast pulse (STUN) reads as urgent, a slow one (SHIELD) as steady. */
  period: number;
  /** Lazily baked mote sprite for this colour, so a per-frame call builds no key string. */
  sprite?: HTMLCanvasElement;
}

/** One row per StatusKind — same completeness trick as VFX_RECIPES. */
const STATUS_GLOW: Record<StatusKind, StatusGlowConfig> = {
  STUN: { color: LIGHT, period: 0.5 },
  DEF_BREAK: { color: RUST, period: 1.1 },
  ATK_BREAK: { color: '#FF004D', period: 1.1 },
  SLOW: { color: WATER, period: 1.6 },
  BURN: { color: FIRE, period: 0.4 },
  HEAL_BLOCK: { color: DARK, period: 1.2 },
  BRAND: { color: '#FF004D', period: 0.7 },
  SILENCE: { color: GHOST, period: 1.2 },
  GLANCE: { color: PHYSICAL, period: 0.5 },
  ATK_UP: { color: '#FF004D', period: 1.2 },
  DEF_UP: { color: WATER, period: 1.2 },
  SPD_UP: { color: WIND, period: 0.8 },
  CRIT_UP: { color: LIGHT, period: 0.9 },
  SHIELD: { color: WATER, period: 1.4 },
  IMMUNITY: { color: LIGHT_WHITE, period: 1.0 },
  COUNTER: { color: FIRE, period: 1.0 },
  INVINCIBLE: { color: LIGHT_WHITE, period: 0.6 },
};

// --- Particles ----------------------------------------------------------------

const TAU = Math.PI * 2;

/** Particle shapes: a sprite blit for the glowing ones, a path for the solid ones. */
const SH_MOTE = 0;
const SH_STREAK = 1;
const SH_STAR = 2;
const SH_CHIP = 3;
const SH_SHARD = 4;

/**
 * One particle. Allocated only when a pooled array has to grow, and reused in
 * place for every later spawn — `reset` overwrites every field, so a recycled
 * record never carries state from the effect that used it last.
 *
 * Positions are RELATIVE to the instance's (x, y): the renderer translates once
 * and every particle draws in that local space.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  /** Velocity decay per second (0 = none, 3 ≈ a spark biting into air). */
  drag: number;
  r: number;
  /** Radius change per second — negative shrinks. */
  grow: number;
  rot: number;
  spin: number;
  /** Half-length / half-width for SH_STREAK (4 = the sprite's own aspect). */
  stretch: number;
  /** Seconds after the instance's spawn before this particle appears. */
  born: number;
  life: number;
  /** Peak alpha, before the fade-in / decay / twinkle envelope. */
  alpha: number;
  fadeIn: number;
  /** Decay exponent: 1 linear, 2+ holds bright then drops away fast. */
  pow: number;
  /** Twinkle rate in rad/s (0 = steady). */
  twinkle: number;
  phase: number;
  /** Sideways sway amplitude in px (a licking flame, a drifting ember). */
  wav: number;
  wHz: number;
  /**
   * Orbit rate in rad/s. Non-zero makes the particle ANALYTIC: the integrator
   * skips it and the renderer places it on the (ox, oy) ellipse around (x, y),
   * because a linear integrator cannot make a circle.
   */
  orbit: number;
  ox: number;
  oy: number;
  /** Ghost copies drawn behind an orbiter, each one step back along the orbit. */
  trail: number;
  shape: number;
  /** Blitted for SH_MOTE / SH_STREAK / SH_STAR. */
  sprite: HTMLCanvasElement | null;
  /** Fill for the path shapes (SH_CHIP, SH_SHARD). */
  col: string;
  /** Drawn in the 'source-over' pass instead of the 'lighter' one — the only way to put smoke, debris or a black core into a field of glow. */
  dark: boolean;
}

function newParticle(): Particle {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, drag: 0,
    r: 1, grow: 0, rot: 0, spin: 0, stretch: 4,
    born: 0, life: 1, alpha: 1, fadeIn: 0, pow: 1,
    twinkle: 0, phase: 0, wav: 0, wHz: 0,
    orbit: 0, ox: 0, oy: 0, trail: 0,
    shape: SH_MOTE, sprite: null, col: '#FFFFFF', dark: false,
  };
}

function reset(p: Particle): void {
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.ax = 0; p.ay = 0; p.drag = 0;
  p.r = 1; p.grow = 0; p.rot = 0; p.spin = 0; p.stretch = 4;
  p.born = 0; p.life = 1; p.alpha = 1; p.fadeIn = 0; p.pow = 1;
  p.twinkle = 0; p.phase = 0; p.wav = 0; p.wHz = 0;
  p.orbit = 0; p.ox = 0; p.oy = 0; p.trail = 0;
  p.shape = SH_MOTE; p.sprite = null; p.col = '#FFFFFF'; p.dark = false;
}

/** Free particle arrays, handed back when an effect ends. Pooled as arrays, not per kind: they only ever grow to the largest system's count. */
const ARRAY_POOL: Particle[][] = [];
const ARRAY_POOL_MAX = 24;

function takeArray(): Particle[] {
  return ARRAY_POOL.pop() ?? [];
}

function freeArray(a: Particle[]): void {
  if (ARRAY_POOL.length < ARRAY_POOL_MAX) ARRAY_POOL.push(a);
}

/**
 * What a finished instance's `parts` is set to when its array goes back to the
 * pool. Without this an instance the caller still holds keeps pointing at an
 * array that a later spawn is already overwriting — a use-after-free that draws
 * some other skill's particles. Frozen so the aliasing can never come back.
 */
const EMPTY_PARTS = Object.freeze([]) as unknown as Particle[];

/** Returns an instance's array to the pool and detaches it from the instance. */
function release(v: VfxInstance): void {
  freeArray(v.parts);
  v.parts = EMPTY_PARTS;
  v.count = 0;
  v.darkCount = 0;
}

// --- Deterministic randomness -------------------------------------------------
//
// Module-level state rather than a seeded closure, so a spawn allocates nothing
// at all. Every effect reseeds from its instance seed before it builds, so the
// same seed always produces the same cloud (the test sheet depends on that).

let rngState = 1;

function rseed(seed: number): void {
  rngState = (seed * 0x9e3779b1) >>> 0;
}

function rnd(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform in [lo, hi). */
function rr(lo: number, hi: number): number {
  return lo + rnd() * (hi - lo);
}

// --- Sprite atlas -------------------------------------------------------------

type SpriteVariant = 'hot' | 'glow' | 'soft' | 'smoke' | 'streakHot' | 'streak' | 'star' | 'wash' | 'scorch';

const SPRITE_CACHE = new Map<string, HTMLCanvasElement>();

const MOTE_PX = 64;
const STREAK_W = 128;
const STREAK_H = 32;
const STAR_PX = 64;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('vfx: no 2d context for a sprite');
  return g;
}

function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** The same hue at a chosen alpha — a falloff must fade to its OWN colour at alpha 0, or the edge reads as a dirty grey ring. Bake time only. */
function rgba(hex: string, a: number): string {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Blend two hexes. Bake time only. */
function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  const to = (x: number, y: number): string => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${to(r1, r2)}${to(g1, g2)}${to(b1, b2)}`;
}

// --- Reading on a warm ground ---------------------------------------------------
//
// EMBER_CRYPT's key light is #ff9436 (hue 28 deg) and its floor pool #ffb15c
// (31 deg). FIRE is #FFA300 — hue 38, ten degrees off the key at the same
// value — so fireBurst, burnFlicker, projectile and shockwave were amber motes
// on an amber floor and vanished into it (ART-REVIEW, VFX round 2 item 3: "the
// only family that reads in-scene is Tide's cool water"). Two corrections:
//
//   * the BODY hue rotates -26 deg, out of the amber band into a saturated
//     red-orange (#FFA300 -> #FF3500, hue 12, a full 16 deg off the crypt key);
//   * the CORE mixes 55 % toward white — the value the bloom's cube threshold
//     survives, and the separation that actually carries at battle scale.
//
// A literal "1-px dark rim in the mote atlas" cannot work: the glow run draws
// under 'lighter', where a dark pixel adds nothing at all. The dark contact
// edge lives where it CAN — the scorch under the ground wash (drawImpactWash),
// laid down 'source-over' beneath the light pool.
//
// Both corrections run ONCE per spawn, in spawnVfx, so the sprite atlas, the
// gradient keys and every stroke downstream see the corrected hue and no render
// path ever builds a colour string.

/** The amber band, narrow on purpose. */
const WARM_LO = 26;
const WARM_HI = 48;
const WARM_ROT = -26;

/**
 * A saturated amber-band hue rotated off the biome key; anything else returned
 * unchanged. FIRE is the ONLY palette hue inside the band, so LIGHT (53 deg),
 * RUST (15), WIND, WATER, DARK, GHOST and the near-white pales are untouched —
 * a LANCE (a LIGHT projectile) or a CRUSH (a WATER shockwave) keeps its own
 * colour while sharing a warm family's archetype.
 */
function offKey(hex: string): string {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // A pale like #FFF1E8 has a nominal hue but no chroma to speak of; rotating
  // it would tint a near-white core for nothing.
  if (delta < 60) return hex;
  let h: number;
  if (max === r) h = 60 * (((g - b) / delta + 6) % 6);
  else if (max === g) h = 60 * ((b - r) / delta + 2);
  else h = 60 * ((r - g) / delta + 4);
  if (h < WARM_LO || h > WARM_HI) return hex;
  h = (h + WARM_ROT + 360) % 360;
  // Back to RGB at the SAME chroma and value: only the hue moves.
  const x = delta * (1 - Math.abs(((h / 60) % 2) - 1));
  const seg = Math.floor(h / 60) % 6;
  const c0 = seg === 0 || seg === 5 ? delta : seg === 1 || seg === 4 ? x : 0;
  const c1 = seg === 1 || seg === 2 ? delta : seg === 0 || seg === 3 ? x : 0;
  const c2 = seg === 3 || seg === 4 ? delta : seg === 2 || seg === 5 ? x : 0;
  const to = (n: number): string => Math.round(n + min).toString(16).padStart(2, '0');
  return `#${to(c0)}${to(c1)}${to(c2)}`;
}

/**
 * A core pushed toward white — the value the bloom's cube threshold keeps.
 *
 * Used ONLY where a white core belongs: the contact flash, and a ring that
 * would otherwise be too dark to stroke. It is deliberately NOT part of the
 * per-family colour policy any more. Blanket-whitening every warm family's
 * `color2` bleached colours that had nothing to do with the amber problem —
 * GRANITE_FIST's WIND #00E436 became #8CF3A5, CRUSH's PHYSICAL became #E4E4E6,
 * SCALD's foam #FFF9F5 — and it took FLARE's saturated FIRE_HOT #FFEC27 to
 * #FFF69E, which is why a fireball's loudest frames read as a white star with
 * no fire in them. The white core is the SPRITE's job (see moteStops below):
 * every 'hot' and 'streakHot' falloff already plateaus at pure white in the
 * middle whatever hue it is built from.
 */
function whiten(hex: string, t = 0.55): string {
  return mixHex(hex, '#FFFFFF', t);
}

/** How much a colour can add under 'lighter' — its brightest channel. */
function peakChannel(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return r > g ? (r > b ? r : b) : g > b ? g : b;
}

function channelSum(hex: string): number {
  const [r, g, b] = rgbOf(hex);
  return r + g + b;
}

/**
 * Which of a recipe's two colours is the ACCENT — the bright one the shockwave
 * ring and the spark cores are drawn in. The other is the BODY, which the
 * ground pool takes.
 *
 * The recipe table does not agree on an order. Most rows put the body in
 * `color` and the accent in `color2`, but ECLIPSE inverts it (`color`
 * DARK_GLOW #FF77A8, `color2` DARK #7E2553), and the impact layer used to read
 * the roles positionally — so a stun painted a saturated hot-pink pool across
 * the floor and then stroked its ring in a maroon that adds almost nothing
 * under 'lighter'. Deciding by peak channel, tie-broken by total channel
 * energy, gets every row in the table right with no per-recipe list to keep.
 */
function accentOf(a: string, b: string): string {
  const pa = peakChannel(a);
  const pb = peakChannel(b);
  if (pa !== pb) return pa > pb ? a : b;
  return channelSum(a) >= channelSum(b) ? a : b;
}

/**
 * The falloff every particle is made of. 'hot' keeps a white plateau at the
 * centre: that is the pixel the bloom's cube-threshold survives, and where two
 * hot motes overlap under 'lighter' the sum clips to white and blooms harder —
 * so a dense cluster grows its own core for free.
 */
function moteStops(g: CanvasGradient, color: string, variant: SpriteVariant): void {
  if (variant === 'hot' || variant === 'streakHot') {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.17, 'rgba(255,255,255,0.94)');
    g.addColorStop(0.33, rgba(color, 0.96));
    g.addColorStop(0.62, rgba(color, 0.32));
    g.addColorStop(1, rgba(color, 0));
  } else if (variant === 'glow' || variant === 'streak') {
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.2, rgba(color, 1));
    g.addColorStop(0.55, rgba(color, 0.3));
    g.addColorStop(1, rgba(color, 0));
  } else if (variant === 'smoke') {
    g.addColorStop(0, rgba(color, 0.85));
    g.addColorStop(0.5, rgba(color, 0.5));
    g.addColorStop(1, rgba(color, 0));
  } else if (variant === 'wash') {
    // The ground pool. A broad plateau and a long tail, so squashed flat under
    // an actor it reads as light lying ON the floor rather than as one more
    // mote. Deliberately not white-cored: the pool is where the light LANDS,
    // and a white centre here would bloom into a second impact flash.
    g.addColorStop(0, rgba(color, 0.82));
    g.addColorStop(0.34, rgba(color, 0.56));
    g.addColorStop(0.66, rgba(color, 0.22));
    g.addColorStop(1, rgba(color, 0));
  } else if (variant === 'scorch') {
    // The dark contact edge, drawn 'source-over' UNDER the pool: local contrast
    // is the only way a warm effect separates from a warm floor, and it cannot
    // be had inside the 'lighter' run.
    g.addColorStop(0, rgba(color, 0.5));
    g.addColorStop(0.55, rgba(color, 0.28));
    g.addColorStop(1, rgba(color, 0));
  } else {
    g.addColorStop(0, rgba(color, 0.8));
    g.addColorStop(0.45, rgba(color, 0.28));
    g.addColorStop(1, rgba(color, 0));
  }
}

/**
 * A particle bitmap, baked once per (variant, colour) and blitted from then on.
 * Context-independent (unlike a CanvasGradient), so this is a plain Map — and
 * lazy, so importing the module never touches the DOM.
 */
function spriteFor(color: string, variant: SpriteVariant): HTMLCanvasElement {
  const key = variant + '|' + color;
  const hit = SPRITE_CACHE.get(key);
  if (hit) return hit;
  let c: HTMLCanvasElement;
  if (variant === 'streak' || variant === 'streakHot') {
    // One elongated glow: a radial falloff filled through a 4:1 scale, so a
    // rotated blit is a motion-blurred streak with a bright spine.
    c = makeCanvas(STREAK_W, STREAK_H);
    const g = ctxOf(c);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, STREAK_H / 2);
    moteStops(grad, color, variant);
    g.translate(STREAK_W / 2, STREAK_H / 2);
    g.scale(STREAK_W / STREAK_H, 1);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, STREAK_H / 2, 0, TAU);
    g.fill();
  } else if (variant === 'star') {
    // A four-point sparkle: two crossed thin ellipses plus a hot dot, summed.
    c = makeCanvas(STAR_PX, STAR_PX);
    const g = ctxOf(c);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, STAR_PX / 2);
    moteStops(grad, color, 'hot');
    g.globalCompositeOperation = 'lighter';
    g.translate(STAR_PX / 2, STAR_PX / 2);
    g.fillStyle = grad;
    for (let i = 0; i < 3; i++) {
      const sx = i === 0 ? 1 : i === 1 ? 0.15 : 0.4;
      const sy = i === 0 ? 0.15 : i === 1 ? 1 : 0.4;
      g.save();
      g.scale(sx, sy);
      g.beginPath();
      g.arc(0, 0, STAR_PX / 2, 0, TAU);
      g.fill();
      g.restore();
    }
  } else {
    c = makeCanvas(MOTE_PX, MOTE_PX);
    const g = ctxOf(c);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, MOTE_PX / 2);
    moteStops(grad, color, variant);
    g.translate(MOTE_PX / 2, MOTE_PX / 2);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, MOTE_PX / 2, 0, TAU);
    g.fill();
  }
  SPRITE_CACHE.set(key, c);
  return c;
}

// --- Cached gradients ---------------------------------------------------------
//
// A CanvasGradient belongs to the context that built it, so the cache is keyed
// per-context in a WeakMap and dies with a dead context. Only the two effects
// whose shape is a filled path rather than a cloud need one (the light pillar
// and the ward dome); their keys are built at spawn and stored on the instance,
// so the render path allocates no strings.

const RADIAL_CACHE = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();

function cacheFor(ctx: CanvasRenderingContext2D): Map<string, CanvasGradient> {
  let per = RADIAL_CACHE.get(ctx);
  if (!per) {
    per = new Map();
    RADIAL_CACHE.set(ctx, per);
  }
  return per;
}

/**
 * The cache LOOKUP is separate from the build on purpose. A single
 * `gradient(ctx, key, [[0, rgba(c, 0)], ...])` call would build the stop array
 * and its colour strings on every frame just to hand them to a cache hit — the
 * arguments are evaluated before the function can check anything. Callers ask
 * first and only build the stops when this returns undefined.
 */
function cachedGradient(ctx: CanvasRenderingContext2D, key: string): CanvasGradient | undefined {
  return RADIAL_CACHE.get(ctx)?.get(key);
}

function putRadial(
  ctx: CanvasRenderingContext2D,
  key: string,
  radius: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, radius));
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  cacheFor(ctx).set(key, g);
  return g;
}

function putLinear(
  ctx: CanvasRenderingContext2D,
  key: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: ReadonlyArray<readonly [number, string]>,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  cacheFor(ctx).set(key, g);
  return g;
}

// --- Instances --------------------------------------------------------------

export interface VfxSpawnOptions {
  size?: number;
  duration?: number;
  /** Origin for `projectile` (and any kind) to travel FROM, arriving at (x, y) at the end of its life. Omit for a stationary impact effect. */
  from?: { x: number; y: number };
  /** Force the draw seed instead of taking the next one. Only a test sheet wants this — in play, consecutive casts of one skill should not produce identical clouds. */
  seed?: number;
}

export interface VfxInstance {
  readonly kind: VfxKind;
  readonly x: number;
  readonly y: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly color: string;
  readonly color2: string;
  readonly size: number;
  readonly duration: number;
  /** Stable per-instance draw seed (e.g. which way frost shards scatter) — never re-rolled, so an effect doesn't jitter across frames. */
  readonly seed: number;
  age: number;
  /** This instance's particles, taken from the pool at spawn and returned when it ends. The array may be longer than `count`; only [0, count) is live. */
  parts: Particle[];
  count: number;
  /** Particles [0, darkCount) draw in the 'source-over' pass (smoke, debris, a black core); the rest draw in 'lighter'. */
  darkCount: number;
  /** Gradient cache key, built once here so the render path never concatenates. */
  key: string;
  /** +1 when the effect faces right (the attacker stood to the left), -1 otherwise. */
  face: number;
  /**
   * The two sprites a renderer's non-particle extras need (a hot core, a soft
   * pool), resolved at spawn. `spriteFor` builds a lookup key string, so calling
   * it from a renderer would allocate once per effect per frame; the meaning of
   * each slot is the owning archetype's business.
   */
  hotSprite: HTMLCanvasElement | null;
  softSprite: HTMLCanvasElement | null;
  /** The impact layer's pair, resolved at spawn for the same reason: the ground pool's falloff in the family's hue, and its white-hot contact flash. Impact archetypes only. */
  washSprite: HTMLCanvasElement | null;
  flashSprite: HTMLCanvasElement | null;
  /** The recipe's two colours in ROLE order (see accentOf), resolved once at spawn so no render path picks them positionally or builds a string. */
  readonly accent: string;
  readonly body: string;
  /** The shockwave ring's stroke — the accent, lifted if it is too dark to read under 'lighter'. */
  readonly ringColor: string;
}

const DEFAULT_SIZE: Record<VfxKind, number> = {
  slash: 54,
  fireBurst: 58,
  windBlade: 56,
  waterWave: 62,
  lightBeam: 64,
  darkPulse: 58,
  healShimmer: 54,
  shieldDome: 60,
  // The three that were simply too small to be a hit at battle scale: a
  // burnFlicker was a 48x65 candle beside a 110-px actor and a projectile's
  // head a 18-px dot (ART-REVIEW, VFX round 2 item 1).
  stunStar: 54,
  burnFlicker: 52,
  shockwave: 62,
  projectile: 46,
  frostShards: 58,
};

/**
 * Every impact's tail now has to still be moving at ~450 ms, when the damage
 * pop lands (ART-REVIEW, VFX round 2 item 4: "most families on the sheet are
 * spent by t 56 % and gone by t 69 %"). Two things were wrong, and both are
 * fixed: the particles died well before the instance did (buildImpact's tail
 * runs to the last frame now), and the instance itself was too short. The
 * friendly pair — healShimmer and shieldDome — keep their own timing; they
 * were never the complaint.
 */
const DEFAULT_DURATION: Record<VfxKind, number> = {
  // Every impact runs to ~0.78 s so that 450 ms — the mark the round was
  // written for — falls at t 55-60 %, in the middle of the tail rather than
  // against its last frame. At 0.5 s a slash was 90 % dead by the time the
  // damage number appeared, which is exactly what "0.2 % of peak energy at
  // 450 ms" measured.
  slash: 0.76,
  fireBurst: 0.8,
  windBlade: 0.76,
  waterWave: 0.8,
  lightBeam: 0.78,
  darkPulse: 0.78,
  healShimmer: 0.8,
  shieldDome: 0.7,
  stunStar: 0.8,
  burnFlicker: 0.78,
  shockwave: 0.78,
  // The head flies for PROJ_ARRIVE (0.32) of this and the impact owns the rest:
  // a 0.23 s flight and a 0.49 s tail.
  projectile: 0.72,
  frostShards: 0.8,
};

/**
 * Which archetypes LAND on a target. Everything but the two friendly ones: a
 * heal and a ward have no contact point, no shockwave and no debris. The impact
 * families all get buildImpact's sparks and tail, and drawImpactWash /
 * drawImpactRing around their own render.
 */
const IMPACT: Record<VfxKind, boolean> = {
  slash: true,
  fireBurst: true,
  windBlade: true,
  waterWave: true,
  lightBeam: true,
  darkPulse: true,
  healShimmer: false,
  shieldDome: false,
  stunStar: true,
  burnFlicker: true,
  shockwave: true,
  projectile: true,
  frostShards: true,
};

/** The four ART-REVIEW found invisible on a warm ground — see offKey/whiten. */
const WARM_FAMILY: Record<VfxKind, boolean> = {
  slash: false,
  fireBurst: true,
  windBlade: false,
  waterWave: false,
  lightBeam: false,
  darkPulse: false,
  healShimmer: false,
  shieldDome: false,
  stunStar: false,
  burnFlicker: true,
  shockwave: true,
  projectile: true,
  frostShards: false,
};

/**
 * Where the floor is, in the effect's own local space. game/screens/battle.ts
 * spawns every effect at `feet.y - 40` (and tools/vfx.ts's cell reproduces that
 * exactly), so +40 px below the origin is the contact point the ground wash
 * pools on, whatever the archetype's `size`. A multiple of `size` cannot say
 * this: at size 46 it would float the pool above the floor and at size 92 sink
 * it through it.
 */
const GROUND_DROP = 40;

/**
 * A battle screen never needs more live effects than this at once; spawning
 * past the cap drops the oldest rather than growing unbounded.
 *
 * Sixteen, up from twelve, because the tails got longer: the deepest real
 * overlap is a 2-hit AoE across three targets — six effects inside one beat —
 * and at a 0.45 s tail the PREVIOUS cast's six are still fading when they land.
 * Twelve clipped exactly that case, dropping the oldest tail mid-fade. Sixteen
 * covers it with four to spare and is still bounded: the peak cost measured on
 * the sheet is ~0.35 ms an effect, but only the two or three inside their first
 * 120 ms are dense — a tail is a dozen motes, a fraction of that — so a full
 * sixteen is well under a millisecond of the frame, not sixteen peaks.
 */
export const VFX_MAX = 16;

let seedCounter = 1;

/**
 * Push a new effect for `id` (a SkillId) onto `list`, which the caller owns
 * — one array per battle screen, passed to `updateVfx`/`renderVfx` every
 * frame. An unknown id (should not happen: VFX_RECIPES is total over
 * SkillId) is silently ignored rather than throwing mid-battle.
 */
export function spawnVfx(list: VfxInstance[], id: SkillId, x: number, y: number, opts: VfxSpawnOptions = {}): void {
  const cfg = VFX_RECIPES[id];
  if (!cfg) return;
  if (list.length >= VFX_MAX) {
    const dropped = list.shift();
    if (dropped) release(dropped);
  }
  const fromX = opts.from?.x ?? x;
  // Clamped: a zero or negative size reaches ctx.drawImage as a negative width
  // and throws from inside the effect's save(), which would leave the shake
  // transform applied to everything the HUD draws afterwards.
  const size = Math.max(1, opts.size ?? cfg.size ?? DEFAULT_SIZE[cfg.kind]);
  // The warm families' hue correction, applied HERE and only here: the whole
  // module downstream — the sprite atlas, `key`, every stroke — then works in
  // the corrected colours without a single per-frame string.
  // offKey self-gates on the amber band, so it is applied to BOTH colours and
  // moves whichever one is actually sitting on the biome key. That matters:
  // QUAKE's `color` is RUST (hue 15, out of band and left alone) while its
  // `color2` is FIRE at hue 38 — dead on the crypt key #ff9436 — and the old
  // policy sent color2 through `whiten` instead, so the one colour that needed
  // moving never moved. Nothing is bleached on the way past any more.
  const warm = WARM_FAMILY[cfg.kind];
  const raw2 = cfg.color2 ?? cfg.color;
  const color = warm ? offKey(cfg.color) : cfg.color;
  const color2 = warm ? offKey(raw2) : raw2;
  const accent = accentOf(color, color2);
  const body = accent === color ? color2 : color;
  const v: VfxInstance = {
    kind: cfg.kind,
    x,
    y,
    fromX,
    fromY: opts.from?.y ?? y,
    color,
    color2,
    size,
    duration: Math.max(0.01, opts.duration ?? cfg.duration ?? DEFAULT_DURATION[cfg.kind]),
    seed: opts.seed ?? seedCounter++,
    age: 0,
    parts: takeArray(),
    count: 0,
    darkCount: 0,
    key: `${cfg.kind}|${Math.round(size)}|${color}|${color2}`,
    face: fromX <= x ? 1 : -1,
    hotSprite: null,
    softSprite: null,
    washSprite: null,
    flashSprite: null,
    accent,
    body,
    // A ring has to be legible: a maroon or a rust stroke under 'lighter' is
    // very nearly nothing, so a dark accent is lifted for the stroke only.
    ringColor: peakChannel(accent) >= 200 ? accent : whiten(accent, 0.45),
  };
  build(v);
  list.push(v);
}

/**
 * Seconds between spawning `id` and the moment it CONTACTS the target — the
 * delay a caller should hold a damage number, a hurt pose, a shake or a hit
 * sound by, so they land with the hit instead of with the cast.
 *
 * Zero for every archetype that is already at the target when it starts, and
 * the flight time for the one that is not: a projectile is drawn travelling
 * from the attacker, and game/screens/battle.ts spawns the effect and the pop
 * on the same HIT event, so without this the number reads "Ember scorches Dust
 * Wraith for 291!" while the shot is still a dot mid-stage.
 *
 * Derived from the RECIPE, so it can be asked before anything is spawned. It
 * therefore describes a spawn that does not override `duration` through
 * VfxSpawnOptions; battle.ts never does.
 */
export function vfxImpactDelay(id: SkillId): number {
  const cfg = VFX_RECIPES[id];
  if (!cfg || cfg.kind !== 'projectile') return 0;
  const d = Math.max(0.01, cfg.duration ?? DEFAULT_DURATION[cfg.kind]);
  return d * PROJ_ARRIVE;
}

/** Ages every instance by `dt` seconds, integrates its particles, and removes the ones that finished. */
export function updateVfx(list: VfxInstance[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i];
    v.age += dt;
    if (v.age >= v.duration) {
      release(v);
      list.splice(i, 1);
      continue;
    }
    const parts = v.parts;
    const n = v.count;
    for (let j = 0; j < n; j++) {
      const p = parts[j];
      if (p.orbit !== 0) continue; // analytic: placed by the renderer, never integrated
      const t = v.age - p.born;
      if (t < 0 || t > p.life) continue;
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      if (p.drag !== 0) {
        const k = 1 - p.drag * dt;
        const kk = k < 0 ? 0 : k;
        p.vx *= kk;
        p.vy *= kk;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin !== 0) p.rot += p.spin * dt;
    }
  }
}

// --- Drawn extent (the bloom feed) -------------------------------------------

/** An axis-aligned rect in the same space the effect draws in. */
export interface VfxBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Local extent per archetype as multiples of `size`: [left, top, right, bottom]
 * around the instance's origin, y negative upward. These are the measured
 * envelopes of the built particle systems, and they are NOT symmetric or
 * uniform — a light pillar reaches 3.4 sizes upward and a heal barely leaves
 * the actor's feet, so feeding `size` as a radius for both (as a square rect
 * around the origin does) paints a key-coloured halo far bigger than the heal
 * and far smaller than the pillar.
 */
const BOUNDS: Record<VfxKind, readonly [number, number, number, number]> = {
  slash: [-2.55, -1.88, 1.9, 2.75],
  fireBurst: [-1.85, -1.75, 1.95, 1.12],
  windBlade: [-1.7, -1.45, 2.0, 1.28], // mirrored below when the effect faces left
  waterWave: [-2.02, -1.6, 1.95, 1.1],
  lightBeam: [-1.7, -4.08, 1.68, 0.93],
  darkPulse: [-1.83, -1.79, 2.06, 1.79],
  healShimmer: [-1.12, -1.38, 1.1, 1.12],
  shieldDome: [-0.8, -0.7, 0.8, 0.4],
  stunStar: [-1.7, -1.14, 1.68, 1.18],
  burnFlicker: [-1.71, -1.95, 1.68, 1.21],
  shockwave: [-2.55, -1.03, 2.9, 1.0],
  // Around the travelling head, NOT the whole path — the corridor behind a shot
  // must not glow before it has been fired. Widened from 2.2 because the impact
  // spray now throws ~3 sizes: `envelope=1` measures the whole corridor for this
  // one archetype (3.4) and that number is deliberately not the one used here.
  projectile: [-2.9, -2.2, 2.9, 2.6],
  frostShards: [-1.7, -1.18, 1.67, 1.11],
};

const boundsScratch: VfxBounds = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The rect this effect is currently drawing inside — what a light plane should
 * treat as the glow source, instead of assuming a square of `size` around the
 * origin.
 *
 * Allocation-free: writes into `out` when given, otherwise into a module-level
 * scratch record that the NEXT call overwrites. Copy the fields out before
 * calling again; never retain the returned object.
 *
 * The rect is the archetype's envelope over its whole life, except for
 * `projectile`, which follows its head so the corridor behind it does not glow
 * before the shot has been fired.
 *
 * The impact layer is added on top of the table rather than baked into it,
 * because the ground pool hangs off an ABSOLUTE offset (GROUND_DROP is 40 px
 * whatever `size` is) while everything else in the table is a multiple. Baking
 * it in would put the floor in the right place for exactly one recipe's size:
 * a KINDLE at 52 and an INFERNO at 92 would both be wrong, in opposite
 * directions.
 */
export function vfxBounds(v: VfxInstance, out: VfxBounds = boundsScratch): VfxBounds {
  const s = v.size;
  const b = BOUNDS[v.kind];
  let l = b[0];
  let r = b[2];
  if (v.face < 0) {
    // The asymmetric archetypes are authored facing right.
    const t = l;
    l = -r;
    r = -t;
  }
  let cx = v.x;
  let cy = v.y;
  if (v.kind === 'projectile') {
    const p = v.duration > 0 ? v.age / v.duration : 1;
    const f = Math.min(1, p / PROJ_ARRIVE);
    const dx = v.fromX - v.x;
    const dy = v.fromY - v.y;
    const len = Math.hypot(dx, dy) || 1;
    const arc = Math.sin(f * Math.PI) * Math.min(len * 0.14, s * 4);
    cx += dx * (1 - f) + (-dy / len) * arc;
    cy += dy * (1 - f) + (dx / len) * arc;
  }
  let left = l * s;
  let right = r * s;
  const top = b[1] * s;
  let bottom = b[3] * s;
  if (IMPACT[v.kind]) {
    // The shockwave ring is the widest thing an impact draws...
    const side = RING_RX * s;
    if (left > -side) left = -side;
    if (right < side) right = side;
    // ...and the lower of the ring's rim and the ground pool is the deepest.
    const pool = GROUND_DROP + WASH_RY * WASH_GROW * s;
    const rim = GROUND_DROP * 0.5 + RING_RY * s;
    const floor = pool > rim ? pool : rim;
    if (bottom < floor) bottom = floor;
  } else if (v.kind === 'healShimmer') {
    // A heal has no ring and no pool, but its floor glow hangs off the same
    // absolute GROUND_DROP, so it needs the floor term and NOT the side one —
    // lending it the ring's width would light a box twice as wide as the heal.
    const floor = GROUND_DROP + HEAL_GLOW_RY * s;
    if (bottom < floor) bottom = floor;
  }
  out.x = cx + left;
  out.y = cy + top;
  out.w = right - left;
  out.h = bottom - top;
  return out;
}

/** Draws every live instance, in list order (oldest first). */
export function renderVfx(ctx: CanvasRenderingContext2D, list: VfxInstance[]): void {
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    const p = v.duration > 0 ? v.age / v.duration : 1;
    if (p >= 1) continue;
    // One save/restore per effect: blend mode, alpha and the translate to the
    // instance's origin all go back to what the caller had. The caller draws
    // inside juice's shake transform, so this NEVER calls setTransform.
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.globalCompositeOperation = 'lighter';
    // The impact signature brackets the family's own render: the ground pool
    // goes UNDER it (light landing on the floor the actor stands on) and the
    // shockwave ring and contact flash OVER it. See "The impact layer".
    const impact = IMPACT[v.kind];
    if (impact) drawImpactWash(ctx, v);
    renderOne(ctx, v, p < 0 ? 0 : p);
    if (impact) drawImpactRing(ctx, v);
    ctx.restore();
  }
}

/**
 * A pulsing ambient ring for a status effect an actor is carrying — driven by
 * the clock, not a VfxInstance (a status has no lifetime of its own). A ring of
 * motes rather than a stroked circle, so it speaks the same light language as
 * the skills; cheap enough to run per status per actor per frame, and it builds
 * no string (the sprite is memoised on the config row).
 */
export function drawStatusGlow(ctx: CanvasRenderingContext2D, kind: StatusKind, x: number, y: number, r: number, time: number): void {
  const cfg = STATUS_GLOW[kind];
  if (!cfg.sprite) cfg.sprite = spriteFor(cfg.color, 'glow');
  const t = pulse(time, cfg.period);
  const radius = r * (0.86 + 0.14 * t);
  const spin = time * 0.9;
  const mote = r * (0.16 + 0.05 * t);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.24 + 0.24 * t;
  for (let i = 0; i < 8; i++) {
    const a = spin + (i / 8) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius * 0.42;
    ctx.drawImage(cfg.sprite, px - mote, py - mote, mote * 2, mote * 2);
  }
  ctx.restore();
}

// --- Build --------------------------------------------------------------------
//
// Builders run once, at spawn. They emit into the instance's pooled array
// through the module-level cursor below — no closures, no per-particle
// allocation once the pool is warm.

let curArr: Particle[] = [];
let curN = 0;

function emit(): Particle {
  if (curArr.length <= curN) curArr.push(newParticle());
  const p = curArr[curN++];
  reset(p);
  return p;
}

function build(v: VfxInstance): void {
  rseed(v.seed);
  curArr = v.parts;
  curN = 0;
  // The extras' sprites, resolved once here so no renderer ever calls spriteFor.
  switch (v.kind) {
    case 'darkPulse':
      v.softSprite = spriteFor(VOID, 'smoke');
      break;
    case 'frostShards':
      v.softSprite = spriteFor(v.color2, 'soft');
      break;
    case 'projectile':
      v.softSprite = spriteFor(v.color, 'glow');
      v.hotSprite = spriteFor(v.color2, 'hot');
      break;
    default:
      v.softSprite = spriteFor(v.color, 'soft');
      v.hotSprite = spriteFor(v.color2, 'hot');
  }
  if (IMPACT[v.kind]) {
    v.washSprite = spriteFor(v.body, 'wash');
    v.flashSprite = spriteFor(whiten(v.accent, 0.45), 'hot');
    if (!scorchSprite) scorchSprite = spriteFor(SCORCH_INK, 'scorch');
  }
  switch (v.kind) {
    case 'slash': buildSlash(v); break;
    case 'fireBurst': buildFireBurst(v); break;
    case 'windBlade': buildWindBlade(v); break;
    case 'waterWave': buildWaterWave(v); break;
    case 'lightBeam': buildLightBeam(v); break;
    case 'darkPulse': buildDarkPulse(v); break;
    case 'healShimmer': buildHealShimmer(v); break;
    case 'shieldDome': buildShieldDome(v); break;
    case 'stunStar': buildStunStar(v); break;
    case 'burnFlicker': buildBurnFlicker(v); break;
    case 'shockwave': buildShockwave(v); break;
    case 'projectile': buildProjectile(v); break;
    case 'frostShards': buildFrostShards(v); break;
  }
  // The shared impact signature, on top of whatever the family just built.
  if (IMPACT[v.kind]) buildImpact(v);
  v.count = curN;
  // Partition the dark particles to the front so the renderer can draw
  // 'source-over' and 'lighter' as two straight runs. In place, at spawn.
  let w = 0;
  for (let i = 0; i < curN; i++) {
    if (curArr[i].dark) {
      const tmp = curArr[w];
      curArr[w] = curArr[i];
      curArr[i] = tmp;
      w++;
    }
  }
  v.darkCount = w;
  curArr = [];
}

// --- The impact layer ----------------------------------------------------------
//
// ART-REVIEW, VFX round 2:
//   item 1 — "add a ground-contact wash, a short elliptical light pool under
//             the target, which is what plants the reference's skill in the
//             world";
//   item 2 — "every impact needs a shockwave and a target flash: a thin
//             expanding ring (the shockwave family already owns the shape) and
//             6-10 fast radial sparks with hot white cores, all inside 120 ms";
//   item 4 — "stretch the impact tail to ~450 ms with a decaying ember/spray so
//             the frame is still moving when the damage pop lands".
//
// All three are the SAME signature on every impact family, so they live here
// once instead of in eleven renderers: buildImpact adds the sparks and the tail
// to the instance's own pooled array (so they partition, integrate and draw
// with everything else), drawImpactWash lays the pool and its dark contact edge
// UNDER the family's render, drawImpactRing puts the ring and the contact flash
// over the top. renderVfx calls the two halves around renderOne — no archetype
// renderer had to learn about any of it, and a non-impact family (healShimmer,
// shieldDome) never pays a line of it.
//
// The white core on the target's silhouette that item 2 also asks for is the
// hurt tint in game/art/actors.ts, not this module's to draw.

/** The review's window: the sparks and the ring are done inside this. */
const IMPACT_WINDOW = 0.12;
/** The ground pool's own life. Short — it is the contact, not the effect. */
const WASH_LIFE = 0.24;

// The pool's and the ring's geometry, as multiples of `size`. They are named
// constants because BOTH the draw functions below and vfxBounds read them: the
// impact layer is now the widest thing most archetypes put on screen and the
// lowest thing every one of them does, so a hand-copied number in the bounds
// table would go stale the first time either shape was retuned.
const WASH_RX = 1.18;
const WASH_RY = 0.36;
/** The pool's widest growth, reached at the end of WASH_LIFE. */
const WASH_GROW = 1.22;
const RING_RX0 = 0.2;
const RING_RX1 = 1.5;
const RING_RY0 = 0.09;
const RING_RY1 = 0.6;
/** The ring's widest reach. */
const RING_RX = RING_RX0 + RING_RX1;
const RING_RY = RING_RY0 + RING_RY1;

/**
 * Archetypes that already draw their own expanding ring. `shockwave` IS the
 * ring — renderShockwave strokes its leading edge at the origin — and lending
 * it the shared hoop as well put two stroked ellipses on the same impact, one
 * at y 0 and one at GROUND_DROP/2. They still get the contact flash and the
 * radial sparks; only the duplicate shape is skipped.
 */
const OWN_RING: Record<VfxKind, boolean> = {
  slash: false,
  fireBurst: false,
  windBlade: false,
  waterWave: false,
  lightBeam: false,
  darkPulse: false,
  healShimmer: false,
  shieldDome: false,
  stunStar: false,
  burnFlicker: false,
  shockwave: true,
  projectile: false,
  frostShards: false,
};

/**
 * When the hit LANDS, in seconds from spawn. Zero for every archetype that is
 * already at the target when it starts — and PROJ_ARRIVE of the life for the
 * one that is not. Without this a projectile bloomed its shockwave ring, its
 * contact flash and its ground pool around the target at CAST time, a third of
 * a second before the shot got there (plainly wrong in the t 6 % cell of
 * `?kinds=projectile`): the impact layer has to be told what "the impact" means
 * for a family that travels.
 */
function impactStart(v: VfxInstance): number {
  return v.kind === 'projectile' ? v.duration * PROJ_ARRIVE : 0;
}

/** The contact scorch is one ink for every family, so it is baked once, lazily. */
const SCORCH_INK = '#090510';
let scorchSprite: HTMLCanvasElement | null = null;

function buildImpact(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const hit = impactStart(v);
  // The flash and the sparks take the family's BODY hue pushed toward white,
  // not `color2`. For half the recipes color2 IS a near-white already
  // (WATER_FOAM, LIGHT_WHITE, WIND_PALE), so whitening that produced a
  // colourless flash and colourless sparks on every one of them — a water crit
  // and a light smite arrived as the same white star (battle-hit-1a/1b). The
  // body hue keeps the halo cyan for Tide and red-orange for Ember, while the
  // sprite's own white plateau still supplies the hot core the review asked for.
  const spark = spriteFor(v.accent, 'streakHot');
  const ember = spriteFor(v.body, 'glow');
  const emberHot = spriteFor(v.accent, 'hot');
  // Eight fast radial sparks, born and dead inside IMPACT_WINDOW. Heavy drag:
  // they punch out and stop, which is what makes them read as a hit rather than
  // as a slow expanding ring.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + rr(-0.3, 0.3);
    const sp = s * rr(11, 20);
    const p = emit();
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.8;
    p.drag = 9;
    p.r = s * rr(0.028, 0.05);
    p.stretch = rr(6, 11);
    p.shape = SH_STREAK;
    p.rot = a;
    p.born = hit + rr(0, IMPACT_WINDOW * 0.18);
    p.life = Math.min(d - hit, IMPACT_WINDOW) * rr(0.7, 1);
    p.pow = 1.6;
    p.sprite = spark;
  }
  // The tail, and it has to be a FEATURE. Measured against the verifier's
  // harness the old one was 0.2 % of a slash's peak energy at 450 ms — 48 lit
  // pixels, which is nothing. Three things were wrong and all three are fixed:
  // the effect ended too soon (see DEFAULT_DURATION), the embers were too small
  // to carry light, and pow 1.15 dumped them early. Twenty-six embers at twice
  // the radius on a pow-0.75 decay, born across the first three quarters of the
  // life, so there is still something lit and drifting when the number lands.
  //
  // Mostly round motes with no rotation — the cheapest path through drawPart —
  // plus a handful of rising streaks, because "still lit" and "still MOVING"
  // are different claims and the frame owes the second one too.
  const hold = d * 0.99;
  const span = hold - hit;
  const lick = spriteFor(v.accent, 'streak');
  for (let i = 0; i < 26; i++) {
    const born = hit + span * rr(0.1, 0.74);
    const a = rr(0, TAU);
    const streak = i % 5 === 0;
    const p = emit();
    p.x = Math.cos(a) * s * rr(0.1, 0.9);
    p.y = Math.sin(a) * s * rr(0.1, 0.55) - s * 0.1;
    p.vx = Math.cos(a) * s * rr(0.2, 1.1);
    p.vy = -s * rr(0.4, 1.5);
    p.ay = s * rr(0.4, 1.8);
    p.drag = 1.4;
    p.r = s * (streak ? rr(0.022, 0.04) : rr(0.045, 0.1));
    p.grow = -s * 0.015;
    p.alpha = 1;
    p.born = born;
    p.life = Math.max(0.1, hold - born);
    p.fadeIn = 0.05;
    // A shallow decay exponent is the whole point: pow 1.5+ dumps the ember in
    // the first third of its life and leaves the last 300 ms empty again. At
    // 0.75 an ember born halfway through is still at half brightness when the
    // effect ends.
    p.pow = 0.75;
    p.twinkle = rr(4, 11);
    p.phase = rr(0, TAU);
    p.wav = s * rr(0.03, 0.09);
    p.wHz = rr(1.6, 4);
    if (streak) {
      p.stretch = rr(4, 7);
      p.shape = SH_STREAK;
      p.rot = Math.PI / 2 + rr(-0.35, 0.35);
      p.sprite = lick;
    } else {
      p.sprite = i % 4 === 0 ? emberHot : ember;
    }
  }
}

/**
 * The ground-contact pool, under everything the family draws. Two blits: a dark
 * scorch 'source-over' and the light pool 'lighter' into the hole it leaves.
 * The scorch is where the "1-px dark contact edge" of item 3 actually lands —
 * inside the glow run a dark pixel adds nothing, so local contrast has to be
 * bought before the run starts.
 */
function drawImpactWash(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  const t = v.age - impactStart(v);
  if (t < 0 || t >= WASH_LIFE) return;
  const s = v.size;
  // Snaps on in two frames, eases out over the rest — light landing, not a fade-in.
  const k = Math.min(1, t / 0.035) * (1 - t / WASH_LIFE);
  const grow = WASH_GROW - 0.5 * (1 - t / WASH_LIFE);
  const rx = s * WASH_RX * grow;
  const ry = s * WASH_RY * grow;
  // The dark contact edge is laid WIDER than the pool, so the pool always has
  // its own darker ground to sit on however bright the biome's floor is.
  ctx.globalCompositeOperation = 'source-over';
  blit(ctx, scorchSprite, 0, GROUND_DROP, rx * 1.15, ry * 1.15, k * 0.8);
  ctx.globalCompositeOperation = 'lighter';
  blit(ctx, v.washSprite, 0, GROUND_DROP, rx, ry, k * 0.9);
  // ...and a tight saturated core inside it, which is the part that survives
  // the crypt's own floor pool and the bloom at battle scale.
  blit(ctx, v.washSprite, 0, GROUND_DROP, rx * 0.42, ry * 0.5, k * 0.85);
}

/**
 * The shockwave and the contact flash, over the family's own render. The ring
 * is centred halfway to the floor and flattened, so it reads as a wave running
 * out along the ground plane rather than as a halo around the target's chest.
 */
function drawImpactRing(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  const t = v.age - impactStart(v);
  if (t < 0 || t >= IMPACT_WINDOW) return;
  const s = v.size;
  const u = t / IMPACT_WINDOW;
  const ease = 1 - (1 - u) * (1 - u);
  const fade = (1 - u) * (1 - u);
  ctx.globalCompositeOperation = 'lighter';
  // The flash: hot, white, small, and gone in a couple of frames at 60 Hz. Held
  // small deliberately — a big one here is the gradient blob this whole module
  // exists to avoid, and it would bury the family underneath it.
  if (u < 0.3) {
    const f = u / 0.3;
    blit(ctx, v.flashSprite, 0, 0, s * (0.15 + 0.3 * f), s * (0.13 + 0.26 * f), (1 - f) * 0.62);
  }
  if (OWN_RING[v.kind]) return;
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = v.ringColor;
  ctx.lineWidth = Math.max(1, s * 0.05 * fade);
  ctx.beginPath();
  ctx.ellipse(0, GROUND_DROP * 0.5, s * (RING_RX0 + RING_RX1 * ease), s * (RING_RY0 + RING_RY1 * ease), 0, 0, TAU);
  ctx.stroke();
}

// --- slash: a drawn cut, a white core, sparks off the edge ---------------------

function buildSlash(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const ang = (-0.62 + rr(-0.16, 0.16)) * v.face;
  const L = s * 1.45;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // The blade is `color` — the weapon's own metal. Drawing it in `color2` made
  // every physical hit (BASH, BITE, CUDGEL, SHIELD_BASH) look like a fire skill,
  // because color2 is the element accent. The spine uses the same hue's 'hot'
  // sprite, whose white plateau is what the bloom's threshold survives, so the
  // cut still has a white core without borrowing another element's colour.
  // color2 is spent only where an accent belongs: the sparks and the bite flash.
  const edge = spriteFor(v.color, 'streak');
  const core = spriteFor(v.color, 'streakHot');
  const spark = spriteFor(v.color2, 'streakHot');
  // The blade: fat in the middle, tapering at both tips, bowed slightly, and
  // laid down in sequence so the cut draws itself in the first fifth of its life.
  //
  // The radii here are a THIRD of round 1's, because these are streaks now and
  // not circles. Every emit site in this file that set `stretch` and a streak
  // sprite left `shape` at its SH_MOTE default, so the elongated 128x32 sprite
  // was squashed back into a round blob and every stretch value in the module
  // was dead — which is exactly what ART-REVIEW saw as "a one-sprite-wide
  // dotted arc". A 3.2-stretch lozenge covers the gap to its neighbour along
  // the cut, which is what the overlap note below has always been asking for.
  for (let i = 0; i < 18; i++) {
    const u = i / 17;
    const along = (u - 0.5) * 2 * L;
    const bow = Math.sin(u * Math.PI) * s * 0.22 * v.face;
    const p = emit();
    p.x = ca * along - sa * bow;
    p.y = sa * along + ca * bow;
    // Radius, stretch and count are tuned together: adjacent motes have to
    // OVERLAP or the cut reads as a dotted line instead of an edge.
    p.r = s * 0.062 * (0.35 + Math.sin(u * Math.PI));
    p.stretch = 3.4;
    p.shape = SH_STREAK;
    p.rot = ang;
    p.born = u * d * 0.12;
    p.life = d * 0.72;
    p.pow = 1.5;
    p.fadeIn = 0.015;
    p.sprite = edge;
  }
  // The white core, a thinner cut riding the same line.
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    const along = (u - 0.5) * 1.8 * L;
    const bow = Math.sin(u * Math.PI) * s * 0.22 * v.face;
    const p = emit();
    p.x = ca * along - sa * bow;
    p.y = sa * along + ca * bow;
    p.r = s * 0.026 * (0.35 + Math.sin(u * Math.PI));
    p.stretch = 4.6;
    p.shape = SH_STREAK;
    p.rot = ang;
    p.born = u * d * 0.1;
    p.life = d * 0.46;
    p.pow = 2;
    p.sprite = core;
  }
  // The follow-through: a fainter, shorter second cut a few degrees off the
  // first and a beat later. One stroke reads as a drawn line; two read as a
  // blade that swung through.
  for (let i = 0; i < 12; i++) {
    const u = i / 11;
    const a2 = ang + 0.2 * v.face;
    const along = (u - 0.5) * 1.55 * L;
    const p = emit();
    p.x = Math.cos(a2) * along;
    p.y = Math.sin(a2) * along;
    p.r = s * 0.035 * (0.35 + Math.sin(u * Math.PI));
    p.stretch = 3.4;
    p.shape = SH_STREAK;
    p.rot = a2;
    p.alpha = 0.55;
    p.born = d * 0.06 + u * d * 0.1;
    p.life = d * 0.4;
    p.pow = 1.6;
    p.sprite = edge;
  }
  // Sparks thrown off the cut, mostly perpendicular to it, falling as they die.
  // Twenty sparks (was 18) at 1.4x the throw, and long enough now to read as
  // sparks rather than as a ring of dots. The count stayed close to round 1's
  // because the follow-through cut above carries the weight instead, and
  // because this family sits nearest the 0.5 ms budget on the sheet.
  for (let i = 0; i < 20; i++) {
    const u = rnd();
    const along = (u - 0.5) * 2 * L * 0.95;
    const side = rnd() < 0.5 ? 1 : -1;
    const dir = ang + (Math.PI / 2) * side + rr(-0.6, 0.6);
    const sp = s * rr(4.5, 12.5);
    const p = emit();
    p.x = ca * along;
    p.y = sa * along;
    p.vx = Math.cos(dir) * sp;
    p.vy = Math.sin(dir) * sp;
    p.ay = s * 6;
    p.drag = 3.4;
    p.r = s * rr(0.022, 0.04);
    p.stretch = rr(4, 9);
    p.shape = SH_STREAK;
    p.rot = dir;
    p.born = u * d * 0.3;
    p.life = d * rr(0.3, 0.55);
    p.pow = 1.5;
    p.sprite = spark;
  }
}

function renderSlash(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  // The bite point: small and brief. A big flash here reads as a fireball and
  // buries the cut, which is the one thing this archetype has to say.
  if (p < 0.2) {
    const k = 1 - p / 0.2;
    const r = v.size * (0.24 + 0.2 * (1 - k));
    blit(ctx, v.hotSprite, 0, 0, r, r, k * 0.6);
  }
  drawParts(ctx, v);
}

// --- fireBurst: embers up, a white-yellow core, smoke at the rim ---------------

function buildFireBurst(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const smoke = spriteFor(mixHex(v.color, '#0B0710', 0.78), 'smoke');
  const hot = spriteFor(v.color2, 'hot');
  const glow = spriteFor(v.color, 'glow');
  // Smoke first: soot at the edge of the fireball, the only part that darkens —
  // and the one place a warm family gets a dark edge, since the glow run's
  // 'lighter' composite cannot draw one.
  for (let i = 0; i < 9; i++) {
    const a = rr(-Math.PI, 0) + rr(-0.5, 0.5);
    const dist = s * rr(0.42, 0.9);
    const p = emit();
    p.dark = true;
    p.x = Math.cos(a) * dist;
    p.y = Math.sin(a) * dist * 0.8 + s * 0.1;
    p.vx = Math.cos(a) * s * rr(0.5, 1.4);
    p.vy = -s * rr(0.9, 1.8);
    p.drag = 1.6;
    p.r = s * rr(0.14, 0.24);
    p.grow = s * 0.55;
    p.alpha = 0.6;
    p.fadeIn = d * 0.18;
    p.pow = 1.2;
    p.born = d * rr(0.1, 0.45);
    p.life = d * 0.62;
    p.wav = s * 0.08;
    p.wHz = rr(3, 6);
    p.phase = rr(0, TAU);
    p.sprite = smoke;
  }
  // Embers: out in every direction, then buoyant — they turn upward as they
  // slow. The impact half: 50 of them (up from 34), off an emitter ring 1.8x
  // wider, thrown 1.5x harder.
  for (let i = 0; i < 50; i++) {
    const a = rr(0, TAU);
    const sp = s * rr(2.2, 8);
    const p = emit();
    p.x = Math.cos(a) * s * 0.22;
    p.y = Math.sin(a) * s * 0.22;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.85 - s * 1.1;
    p.ay = -s * 1.7;
    p.drag = 2.3;
    p.r = s * rr(0.035, 0.075);
    p.grow = -s * 0.05;
    // Births spread across the first half of the life rather than the first
    // 20 %. The sheet's cost is per DRAW CALL (~9 us each on the software
    // canvas, near enough flat in the blit's size), so what the budget actually
    // buys is live particles at one instant — and a burst that keeps throwing
    // embers for 300 ms reads better than one that fires everything on frame 1
    // and then coasts. Same fifty embers, half as many on screen at the peak.
    p.born = d * rr(0, 0.5);
    p.life = d * rr(0.26, 0.48);
    p.pow = 1.5;
    p.twinkle = i % 2 === 0 ? rr(16, 26) : 0;
    p.phase = rr(0, TAU);
    p.wav = s * 0.05;
    p.wHz = rr(4, 9);
    p.sprite = i % 3 === 0 ? hot : glow;
  }
  // Ember trails: the few that get thrown hardest smear into long streaks, the
  // reference's structural note — a burst is streaks AND motes, not motes alone.
  // These are real streaks now (see buildSlash): at s = 68 they run 20-90 px,
  // three to five times a mote, which is the proportion the reference frame has.
  const streak = spriteFor(v.color2, 'streakHot');
  for (let i = 0; i < 20; i++) {
    const a = rr(0, TAU);
    const sp = s * rr(5, 11);
    const p = emit();
    p.x = Math.cos(a) * s * 0.1;
    p.y = Math.sin(a) * s * 0.1;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.8 - s * 1.4;
    p.ay = -s * 1.2;
    p.drag = 2.6;
    p.r = s * rr(0.02, 0.04);
    p.stretch = rr(6, 13);
    p.shape = SH_STREAK;
    p.rot = a;
    p.born = d * rr(0, 0.2);
    p.life = d * rr(0.18, 0.32);
    p.pow = 1.6;
    p.alpha = 0.9;
    p.sprite = streak;
  }
}

function renderFireBurst(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  // The core: a hot white-yellow ball that expands and is gone before half-life,
  // so the embers are what the eye is left with. Held small on purpose — a core
  // that outgrows its own embers is the gradient blob this archetype replaced.
  if (p < 0.45) {
    const k = 1 - p / 0.45;
    const r = v.size * (0.2 + 0.34 * (p / 0.45));
    blit(ctx, v.hotSprite, 0, 0, r, r, k * k * 0.9 + 0.1 * k);
  }
  drawParts(ctx, v);
}

// --- windBlade: crescents of pale motes, leaf flecks ---------------------------

function buildWindBlade(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const base = v.face > 0 ? -0.1 : Math.PI + 0.1;
  const pale = spriteFor(v.color2, 'streakHot');
  const glow = spriteFor(v.color, 'streak');
  const leaf = mixHex(v.color, '#1D2B53', 0.2);
  // Three crescents, each drawn along its arc and shearing outward as it dies.
  // Eighteen motes an arc (was 13) off a ring 1.25-1.8x wider, and real streaks
  // laid ALONG the arc so a crescent is a blade edge, not beads.
  for (let k = 0; k < 3; k++) {
    const R = s * (0.62 + k * 0.3);
    for (let i = 0; i < 18; i++) {
      const u = i / 17;
      const a = base + (u - 0.5) * 2.1;
      const p = emit();
      p.x = Math.cos(a) * R;
      p.y = Math.sin(a) * R * 0.9;
      p.vx = Math.cos(a) * s * 2.4;
      p.vy = Math.sin(a) * s * 2;
      p.drag = 3.2;
      p.r = s * 0.028 * (0.35 + Math.sin(u * Math.PI) * 1.05);
      p.stretch = 4.2;
      p.shape = SH_STREAK;
      p.rot = a + Math.PI / 2;
      p.born = k * d * 0.12 + u * d * 0.06;
      p.life = d * (0.62 - k * 0.06);
      p.pow = 1.6;
      p.fadeIn = 0.02;
      p.sprite = k === 0 ? pale : glow;
    }
  }
  // Leaf flecks: solid chips tumbling in the gust, the only opaque thing here.
  for (let i = 0; i < 12; i++) {
    const a = base + rr(-1.1, 1.1);
    const R = s * rr(0.35, 0.95);
    const p = emit();
    p.dark = true;
    p.x = Math.cos(a) * R;
    p.y = Math.sin(a) * R * 0.9;
    p.vx = Math.cos(a) * s * rr(1.2, 2.6);
    p.vy = Math.sin(a) * s * rr(0.8, 1.8) - s * 0.3;
    p.ay = s * 2.2;
    p.drag = 1.1;
    p.r = s * rr(0.05, 0.085);
    p.rot = rr(0, TAU);
    p.spin = rr(-14, 14);
    p.born = d * rr(0, 0.25);
    p.life = d * rr(0.6, 0.95);
    p.alpha = 0.9;
    p.pow = 1.2;
    p.shape = SH_CHIP;
    p.col = leaf;
  }
}

function renderWindBlade(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  drawParts(ctx, v);
  // A hairline leading edge binds the inner crescent's motes into one blade.
  const base = v.face > 0 ? -0.1 : Math.PI + 0.1;
  const sweep = 1.05 * Math.min(1, p * 3.2);
  ctx.globalAlpha = (1 - p) * (1 - p) * 0.9;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = Math.max(1, v.size * 0.028);
  ctx.lineCap = 'round';
  ctx.save();
  ctx.scale(1, 0.9);
  ctx.beginPath();
  ctx.arc(0, 0, v.size * (0.5 + p * 0.35), base - sweep, base + sweep);
  ctx.stroke();
  ctx.restore();
}

// --- waterWave: a spiral of droplets and streaks, cyan-white core, foam --------

function buildWaterWave(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const hot = spriteFor(v.color2, 'streakHot');
  const glow = spriteFor(v.color, 'streak');
  const foam = spriteFor(v.color2, 'hot');
  const spin = rnd() < 0.5 ? 1 : -1;
  // The long sheet — the wave itself. A streak is drawn 2*r*stretch long and
  // 2*r thick, so these run 58-149 px long and 2-4 px thick at s = 62: three
  // to five times the 56-px actor sprite, which is the proportion the
  // reference frame has and which two earlier passes here only claimed. Thin
  // rather than short, because a rotated blit's cost is its area and the
  // LENGTH is the part that reads.
  for (let i = 0; i < 18; i++) {
    const u = i / 18;
    const a = u * TAU * 1.7 + rr(-0.3, 0.3);
    const R = s * rr(0.35, 1.5);
    const vy = -s * rr(2.4, 4);
    const vx = -Math.sin(a) * s * 2.4 * spin;
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = s * 0.24 - u * s * 0.55;
    p.vx = vx;
    p.vy = vy;
    p.ay = -s * 0.4;
    p.drag = 1.2;
    p.r = s * rr(0.014, 0.024);
    p.stretch = rr(34, 52);
    p.shape = SH_STREAK;
    p.rot = Math.atan2(vy, vx);
    p.born = u * d * 0.5;
    p.life = d * rr(0.2, 0.32);
    p.pow = 1.6;
    p.fadeIn = 0.02;
    p.alpha = rr(0.6, 1);
    p.sprite = i % 4 === 0 ? hot : glow;
  }
  // Droplets climbing a cylinder: a tangential push plus lift, released in
  // sequence up the column, so the whole sheet reads as one rising spiral.
  for (let i = 0; i < 20; i++) {
    const u = i / 20;
    const a = u * TAU * 1.7 + rr(-0.2, 0.2);
    const R = s * rr(0.4, 1.35);
    const vy = -s * rr(1.5, 2.8);
    const vx = -Math.sin(a) * s * 1.9 * spin;
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = s * 0.26 - u * s * 0.5;
    p.vx = vx;
    p.vy = vy;
    p.ay = -s * 0.4;
    p.drag = 1.4;
    // Round, not stretched: a droplet is a droplet, and it is the cheapest
    // shape in the module (see drawPart's SH_MOTE note). The long streaks
    // above are what carry the reference's structure; forty more rotated
    // blits underneath them buy nothing the eye can find.
    p.r = s * rr(0.03, 0.06);
    p.born = u * d * 0.45;
    p.life = d * rr(0.3, 0.46);
    p.pow = 1.5;
    p.fadeIn = 0.02;
    p.sprite = i % 5 < 2 ? hot : glow;
  }
  // Foam: round white motes flicked off the spiral, twinkling as they scatter
  // wide — the scatter is what stops the column reading as one solid shape.
  for (let i = 0; i < 22; i++) {
    const a = rr(0, TAU);
    const p = emit();
    p.x = Math.cos(a) * s * rr(0.25, 1.6);
    p.y = s * 0.24 - rnd() * s * 0.9;
    p.vx = Math.cos(a) * s * rr(0.8, 2.8);
    p.vy = -s * rr(0.6, 2);
    p.ay = s * 1.6;
    p.drag = 2.6;
    p.r = s * rr(0.028, 0.055);
    p.born = d * rr(0.05, 0.6);
    p.life = d * rr(0.3, 0.55);
    p.pow = 1.4;
    p.twinkle = rr(14, 24);
    p.phase = rr(0, TAU);
    p.sprite = foam;
  }
}

function renderWaterWave(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  // The pool the column climbs out of, and a low hot core sitting in it. The
  // core is deliberately WIDE AND SHORT: a tall bright bar here reads as a
  // light pillar and steals lightBeam's silhouette.
  const poolK = Math.min(1, p * 5) * (1 - p) * (1 - p);
  blit(ctx, v.softSprite, 0, s * 0.28, s * 0.95, s * 0.34, poolK * 0.9);
  if (p < 0.4) {
    const k = 1 - p / 0.4;
    blit(ctx, v.hotSprite, 0, s * 0.22, s * 0.36, s * 0.16, k * k * 0.6);
  }
  drawParts(ctx, v);
}

// --- lightBeam: a pillar with a white core and rising sparkles -----------------

function buildLightBeam(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const H = s * 3.2;
  const W = s * 0.42;
  const pale = spriteFor(v.color2, 'streakHot');
  const glow = spriteFor(v.color, 'streak');
  const star = spriteFor(v.color2, 'star');
  // The pillar IS the rays. It used to be a filled trapezoid with a solid white
  // quad on top, which hid both the 27 ray particles inside it and the target's
  // head; now forty long thin streaks carry it, with gaps between them, and the
  // shaft behind is only a faint wash that binds them together.
  for (let i = 0; i < 40; i++) {
    const u = i / 39;
    // Spread across the shaft with a gap-leaving jitter rather than evenly.
    const lane = (u - 0.5) * 2 + rr(-0.09, 0.09);
    const p = emit();
    p.x = lane * W * 1.15;
    p.y = -H * rr(0.3, 0.62);
    p.vy = -s * rr(1.8, 4.4);
    p.r = s * rr(0.022, 0.05);
    p.stretch = rr(12, 20);
    p.shape = SH_STREAK;
    p.rot = Math.PI / 2;
    p.born = d * rr(0, 0.28);
    p.life = d * rr(0.35, 0.7);
    p.alpha = rr(0.7, 1);
    p.pow = 1.6;
    p.fadeIn = 0.03;
    p.sprite = Math.abs(lane) < 0.62 ? pale : glow;
  }
  // Sparkles drifting up the shaft and out around it.
  for (let i = 0; i < 28; i++) {
    const p = emit();
    p.x = rr(-1, 1) * W * 2.4;
    p.y = -rnd() * H * 0.95 + s * 0.15;
    p.vy = -s * rr(0.5, 1.6);
    p.vx = rr(-0.3, 0.3) * s;
    p.drag = 1.2;
    p.r = s * rr(0.035, 0.07);
    p.born = d * rr(0, 0.5);
    p.life = d * rr(0.35, 0.7);
    p.pow = 1.3;
    p.twinkle = rr(9, 18);
    p.phase = rr(0, TAU);
    p.shape = SH_STAR;
    p.sprite = star;
  }
}

function renderLightBeam(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  const H = s * 3.2;
  const W = s * 0.42 * (1 - p * 0.35);
  const open = Math.min(1, p * 6);
  const fade = (1 - p) * (1 - p);
  // The shaft. One cached linear gradient per (context, recipe): white at the
  // foot, the skill's colour up the body, transparent at the top. H is derived
  // from `size`, which is in the key, so the cached gradient always fits.
  const g = cachedGradient(ctx, v.key) ?? putLinear(ctx, v.key, 0, 0, 0, -H, [
    [0, 'rgba(255,255,255,0.95)'],
    [0.18, v.color2],
    [0.55, v.color],
    [1, rgba(v.color, 0)],
  ]);
  // A faint wash only — at full strength this slab buried the rays and the
  // target's head both. There is no solid white core quad any more; the white
  // lives in the streak sprites' own hot centres, which is where the bloom
  // wants it and where it leaves the silhouette visible.
  ctx.globalAlpha = fade * 0.22;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-W, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W * 0.42, -H * open);
  ctx.lineTo(-W * 0.42, -H * open);
  ctx.closePath();
  ctx.fill();
  // Where it lands. Small and ground-hugging: a foot flash scaled to `size`
  // simply replaced the slab as the thing covering the target's head.
  blit(ctx, v.hotSprite, 0, 0, s * (0.3 + p * 0.3), s * (0.12 + p * 0.14), fade * 0.75);
  drawParts(ctx, v);
}

// --- darkPulse: violet motes imploding into a black-cored burst ----------------

const DARK_TURN = 0.45;

function buildDarkPulse(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const inT = d * DARK_TURN;
  const glow = spriteFor(v.color2, 'streak');
  const hot = spriteFor(v.color2, 'streakHot');
  // The implosion: everything falls inward and arrives together at the turn.
  // The emitter ring is 1.4x wider, so the collapse comes from outside the
  // target's silhouette instead of from just inside it.
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU + rr(-0.12, 0.12);
    const dist = s * rr(1.15, 1.9);
    const p = emit();
    p.x = Math.cos(a) * dist;
    p.y = Math.sin(a) * dist * 0.9;
    p.vx = (-Math.cos(a) * dist) / inT;
    p.vy = (-Math.sin(a) * dist * 0.9) / inT;
    p.r = s * rr(0.022, 0.045);
    p.stretch = 5;
    p.shape = SH_STREAK;
    p.rot = a;
    p.life = inT * 0.98;
    p.alpha = 0.95;
    p.pow = 0.6;
    p.fadeIn = inT * 0.25;
    p.sprite = glow;
  }
  // The burst: back out, faster, whiter, from nothing. 32 shards, up from 18.
  for (let i = 0; i < 32; i++) {
    const a = rr(0, TAU);
    const sp = s * rr(3.4, 10);
    const p = emit();
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.85;
    p.drag = 3.6;
    p.r = s * rr(0.022, 0.05);
    p.stretch = 4.5;
    p.shape = SH_STREAK;
    p.rot = a;
    p.born = inT;
    p.life = (d - inT) * rr(0.6, 0.9);
    p.pow = 1.5;
    p.sprite = hot;
  }
}

function renderDarkPulse(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  // The core goes down FIRST and under 'multiply', not source-over on top.
  // Painted over the motes at alpha 0.92 it was an opaque muddy disc stamped
  // across the target; multiplying scales what is already there toward black,
  // so the sprite's silhouette reads straight through the shadow, and the motes
  // and rim then draw over it instead of under.
  const grow = p < DARK_TURN ? p / DARK_TURN : 1;
  const r = s * (0.08 + 0.46 * grow * grow);
  const hold = p < DARK_TURN ? 1 : Math.max(0, 1 - (p - DARK_TURN) / (1 - DARK_TURN) / 0.8);
  ctx.globalCompositeOperation = 'multiply';
  blit(ctx, v.softSprite, 0, 0, r * 1.15, r * 1.05, 0.6 * hold);
  ctx.globalCompositeOperation = 'lighter';
  drawParts(ctx, v);
  // The rim: a hot ring on the edge of the hole, brightest at the turn.
  const rim = 1 - Math.abs(p - DARK_TURN) / 0.3;
  if (rim > 0) {
    // Three arcs with gaps, not one closed ellipse: a full hard hoop drawn
    // across the target at the turn read as a magenta circle stamped on the
    // sprite. Two passes — a wide soft one and a thin bright one — give it an
    // edge without a hard outline.
    ctx.strokeStyle = v.color2;
    const spin = v.age * 2.2;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = rim * (pass === 0 ? 0.26 : 0.5);
      ctx.lineWidth = Math.max(1, s * (pass === 0 ? 0.075 : 0.022) * rim);
      for (let i = 0; i < 3; i++) {
        const a0 = spin + (i / 3) * TAU;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.05, r * 0.98, 0, a0, a0 + 1.12);
        ctx.stroke();
      }
    }
  }
}

// --- healShimmer: a rising column over a floor glow ----------------------------

/** The heal's floor glow, as a multiple of `size`. Read by renderHealShimmer and by vfxBounds. */
const HEAL_GLOW_RX = 1.15;
const HEAL_GLOW_RY = 0.36;

function buildHealShimmer(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const star = spriteFor(v.color2, 'star');
  const star2 = spriteFor(v.color, 'star');
  const mote = spriteFor(v.color, 'soft');
  // Nothing here is thrown: everything drifts up, slowly, with a long fade-in.
  // That is the whole difference between a heal and a hit — but slow and gentle
  // still has to be an EVENT. It was scored 3/10 at battle scale ("barely an
  // event"), so it is now a column: the sparkles rise the full height of an
  // actor instead of a third of it, in a narrower footprint so they read as one
  // rising shaft rather than a scatter, with lifting streaks inside it.
  const rise = spriteFor(v.color, 'streak');
  for (let i = 0; i < 34; i++) {
    const a = rr(0, TAU);
    const R = Math.sqrt(rnd()) * s * 0.42;
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = s * 0.3 + Math.sin(a) * R * 0.28;
    p.vy = -s * rr(1.6, 3.1);
    p.ay = -s * 0.25;
    p.r = s * rr(0.07, 0.13);
    p.born = d * rr(0, 0.62);
    p.life = d * rr(0.45, 0.72);
    p.fadeIn = d * 0.1;
    p.pow = 1.2;
    p.twinkle = rr(5, 11);
    p.phase = rr(0, TAU);
    p.wav = s * rr(0.03, 0.08);
    p.wHz = rr(2, 4.5);
    p.shape = SH_STAR;
    // Mostly the mint hue; white only as the occasional highlight. Inverted,
    // the whole effect washed out to white and the restoration hue vanished.
    p.sprite = i % 3 === 0 ? star : star2;
  }
  // The lift: thin vertical streaks inside the column, which is what makes it
  // read as rising light rather than as a cloud of stationary sparkles.
  for (let i = 0; i < 10; i++) {
    const p = emit();
    p.x = rr(-0.5, 0.5) * s * 0.8;
    p.y = s * rr(0.05, 0.34);
    p.vy = -s * rr(2.2, 3.8);
    p.r = s * rr(0.022, 0.04);
    p.stretch = rr(5, 9);
    p.shape = SH_STREAK;
    p.rot = Math.PI / 2;
    p.alpha = 0.85;
    p.born = d * rr(0, 0.55);
    p.life = d * rr(0.25, 0.4);
    p.fadeIn = d * 0.06;
    p.pow = 1.3;
    p.sprite = rise;
  }
  for (let i = 0; i < 12; i++) {
    const a = rr(0, TAU);
    const R = Math.sqrt(rnd()) * s * 0.6;
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = s * 0.3 + Math.sin(a) * R * 0.28;
    p.vy = -s * rr(0.4, 0.9);
    p.r = s * rr(0.07, 0.14);
    p.grow = s * 0.06;
    p.alpha = 0.75;
    p.born = d * rr(0, 0.5);
    p.life = d * rr(0.4, 0.6);
    p.fadeIn = d * 0.2;
    p.pow = 1.4;
    p.wav = s * 0.05;
    p.wHz = rr(1.5, 3);
    p.phase = rr(0, TAU);
    p.sprite = mote;
  }
}

function renderHealShimmer(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  // The floor glow: a soft breathing ellipse under the actor's feet, never a
  // flash — but on the FLOOR, at GROUND_DROP, and wide enough to be the thing
  // that says "this actor is being healed" from across the frame.
  const k = Math.min(1, p * 4) * (1 - p * p);
  const breathe = 0.85 + 0.15 * pulse(v.age, 0.5);
  blit(ctx, v.softSprite, 0, GROUND_DROP, s * HEAL_GLOW_RX * breathe, s * HEAL_GLOW_RY * breathe, k * 0.95);
  blit(ctx, v.hotSprite, 0, GROUND_DROP, s * 0.42 * breathe, s * 0.13 * breathe, k * 0.5);
  drawParts(ctx, v);
}

// --- shieldDome: a faceted ward with drifting motes ----------------------------

const DOME_FACETS = 9;

function buildShieldDome(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const R = s * 0.72;
  const mote = spriteFor(v.color2, 'hot');
  const soft = spriteFor(v.color, 'glow');
  // Motes ON the shell, drifting along it, plus a few rising inside.
  for (let i = 0; i < 22; i++) {
    const a = Math.PI + rnd() * Math.PI;
    const p = emit();
    p.x = Math.cos(a) * R * rr(0.92, 1.04);
    p.y = s * 0.18 + Math.sin(a) * R * rr(0.92, 1.04);
    p.vx = -Math.sin(a) * s * rr(0.15, 0.5);
    p.vy = Math.cos(a) * s * rr(0.15, 0.5);
    p.r = s * rr(0.025, 0.055);
    p.born = d * rr(0, 0.4);
    p.life = d * rr(0.35, 0.6);
    p.fadeIn = d * 0.1;
    p.pow = 1.4;
    p.twinkle = rr(6, 14);
    p.phase = rr(0, TAU);
    p.sprite = mote;
  }
  for (let i = 0; i < 14; i++) {
    const p = emit();
    p.x = rr(-0.85, 0.85) * R;
    p.y = s * 0.18;
    p.vy = -s * rr(0.5, 1.3);
    p.r = s * rr(0.03, 0.07);
    p.alpha = 0.7;
    p.born = d * rr(0, 0.5);
    p.life = d * rr(0.3, 0.55);
    p.fadeIn = d * 0.12;
    p.pow = 1.5;
    p.wav = s * 0.04;
    p.wHz = rr(2, 5);
    p.phase = rr(0, TAU);
    p.sprite = soft;
  }
}

function renderShieldDome(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  // The dome scales in, but the cached gradient is built at the FULL radius and
  // the context is scaled to match: a gradient keyed by `size` cannot also be
  // built at whatever radius the first frame happened to have.
  const full = s * 0.72;
  const grow = 0.55 + 0.45 * Math.min(1, p / 0.18);
  const R = full;
  const cy = s * 0.18;
  const fade = 1 - p * p;
  // A polygon, not an arc: nine flat facets read as faceted glass, and each one
  // carries its own brightness so the shell has structure instead of a rim.
  const g = cachedGradient(ctx, v.key) ?? putRadial(ctx, v.key, full, [
    [0, rgba(v.color, 0)],
    [0.62, rgba(v.color, 0.1)],
    [1, rgba(v.color, 0.55)],
  ]);
  ctx.save();
  ctx.translate(0, cy);
  ctx.scale(grow, grow);
  ctx.beginPath();
  for (let i = 0; i <= DOME_FACETS; i++) {
    const a = Math.PI + (i / DOME_FACETS) * Math.PI;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.globalAlpha = fade * 0.8;
  ctx.fillStyle = g;
  ctx.fill();
  // A second shell inside the first, at a different radius and counter-drifting
  // phase. One shell was a static piece of glass — the ward "layers" now, and
  // the gap between the two is what makes it read as a volume.
  ctx.globalAlpha = fade * 0.42;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = Math.max(1, s * 0.016);
  ctx.beginPath();
  for (let i = 0; i <= DOME_FACETS; i++) {
    const a = Math.PI + ((i + 0.5) / DOME_FACETS) * Math.PI;
    const rr2 = R * (0.76 + 0.03 * Math.sin(v.age * 2.4 + i));
    const x = Math.cos(a) * rr2;
    const y = Math.sin(a) * rr2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Facet edges, uneven so the shell glints rather than glowing evenly, with
  // ONE facet running bright around the dome — a highlight travelling over
  // glass, and the only thing here that unambiguously moves.
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.lineCap = 'round';
  const sweep = (v.age * 2.6) % DOME_FACETS;
  for (let i = 0; i < DOME_FACETS; i++) {
    const a0 = Math.PI + (i / DOME_FACETS) * Math.PI;
    const a1 = Math.PI + ((i + 1) / DOME_FACETS) * Math.PI;
    const lit = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(v.seed * 1.7 + i * 2.3 + v.age * 3));
    const near = Math.abs(((i - sweep + DOME_FACETS * 1.5) % DOME_FACETS) - DOME_FACETS * 0.5);
    const hot = Math.max(0, 1 - near / 1.2);
    ctx.globalAlpha = Math.min(1, fade * (lit + hot * 0.9));
    ctx.strokeStyle = hot > 0.4 ? v.color2 : i % 2 === 0 ? v.color2 : v.color;
    ctx.lineWidth = Math.max(1, s * (0.022 + hot * 0.02));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
    ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    ctx.stroke();
  }
  // The floor line closing the ward.
  ctx.globalAlpha = fade * 0.7;
  ctx.strokeStyle = v.color2;
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.lineTo(R, 0);
  ctx.stroke();
  ctx.restore();
  drawParts(ctx, v);
}

// --- stunStar: orbiting stars with trails --------------------------------------

function buildStunStar(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  // A stun star has to be legible at a glance from across the frame, so both
  // sprites keep a white core (mixing the darker `color2` toward white rather
  // than using it raw — a maroon star on a navy floor is not a star).
  const star = spriteFor(v.color, 'star');
  const star2 = spriteFor(mixHex(v.color2, '#FFFFFF', 0.45), 'star');
  const mote = spriteFor(v.color, 'glow');
  const dir = rnd() < 0.5 ? 1 : -1;
  // Two counter-rotating rings rather than one, at different radii and speeds,
  // so a stun has depth and something crossing rather than a single flat halo.
  for (let ring = 0; ring < 2; ring++) {
    const rd = ring === 0 ? dir : -dir;
    const n = ring === 0 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const p = emit();
      p.x = 0;
      p.y = -s * (ring === 0 ? 0.5 : 0.3);
      p.orbit = (ring === 0 ? 5.2 : 3.4) * rd;
      // Wide enough to clear the target's head rather than sit on it.
      p.ox = s * (ring === 0 ? 1.05 : 0.66);
      p.oy = s * (ring === 0 ? 0.4 : 0.26);
      p.phase = (i / n) * TAU;
      p.r = s * (ring === 0 ? rr(0.2, 0.27) : rr(0.13, 0.18));
      p.spin = 3 * rd;
      p.life = d;
      p.fadeIn = d * 0.12;
      p.pow = 1.2;
      p.trail = 3;
      p.twinkle = rr(7, 12);
      p.shape = SH_STAR;
      p.sprite = i % 2 === 0 ? star : star2;
    }
  }
  // A little dust falling off the orbit, so the ring is not the only motion.
  for (let i = 0; i < 14; i++) {
    const p = emit();
    p.x = rr(-0.9, 0.9) * s * 0.9;
    p.y = -s * 0.5 + rr(-0.2, 0.2) * s;
    p.vy = s * rr(0.2, 0.7);
    p.vx = rr(-0.3, 0.3) * s;
    p.drag = 1.5;
    p.r = s * rr(0.03, 0.055);
    p.alpha = 0.7;
    p.born = d * rr(0, 0.6);
    p.life = d * rr(0.25, 0.45);
    p.pow = 1.3;
    p.twinkle = rr(8, 16);
    p.phase = rr(0, TAU);
    p.sprite = mote;
  }
}

function renderStunStar(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  drawParts(ctx, v);
}

// --- burnFlicker: licking flame tongues ---------------------------------------

function buildBurnFlicker(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const hot = spriteFor(v.color2, 'hot');
  const glow = spriteFor(v.color, 'glow');
  const tip = spriteFor(mixHex(v.color, '#FF004D', 0.45), 'glow');
  // Four tongues of flame. Each is a chain of VERTICAL STREAKS, not a stack of
  // round motes: a segment is drawn 2*r*stretch tall against a 0.15-size step,
  // so consecutive segments overlap by two thirds and the tongue is continuous
  // even while it flickers. The round-mote version read as five columns of
  // discrete dots — a dot matrix, not fire — because each mote twinkled on its
  // own phase and swayed by its own amount, so the gaps between them opened and
  // closed independently.
  //
  // Two things keep it a tongue rather than a chain: the twinkle phase advances
  // only 0.2 rad per segment (the whole tongue brightens and dims together, the
  // way a real flame does) and the sway shares one frequency per tongue so the
  // column BENDS instead of zig-zagging.
  for (let j = 0; j < 4; j++) {
    const bx = (j - 1.5) * s * 0.3 + rr(-0.05, 0.05) * s;
    const hz = rr(5, 8);
    const ph = rr(0, TAU);
    const lean = rr(-0.16, 0.16);
    for (let i = 0; i < 6; i++) {
      const p = emit();
      p.x = bx;
      p.y = -i * s * 0.13;
      p.vy = -s * rr(0.45, 0.75);
      p.r = s * (0.19 - i * 0.021);
      p.grow = -s * 0.02;
      p.stretch = 1.7;
      p.shape = SH_STREAK;
      p.rot = Math.PI / 2 + lean * (i / 5);
      p.born = i * 0.016;
      p.life = d * rr(0.66, 0.88);
      p.pow = 1.1;
      p.fadeIn = 0.03;
      p.twinkle = rr(7, 11);
      p.phase = ph + i * 0.2;
      p.wav = s * 0.07 * (i + 1) * 0.5;
      p.wHz = hz;
      p.sprite = i <= 1 ? hot : i >= 4 ? tip : glow;
    }
  }
  // Embers breaking off the tips.
  for (let i = 0; i < 14; i++) {
    const p = emit();
    p.x = rr(-0.9, 0.9) * s;
    p.y = -s * rr(0.4, 1.1);
    p.vy = -s * rr(1.2, 2.8);
    p.r = s * rr(0.03, 0.055);
    p.born = d * rr(0, 0.62);
    p.life = d * rr(0.34, 0.55);
    p.pow = 1.15;
    p.twinkle = rr(14, 22);
    p.phase = rr(0, TAU);
    p.wav = s * 0.09;
    p.wHz = rr(4, 8);
    p.sprite = hot;
  }
}

function renderBurnFlicker(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  drawParts(ctx, v);
}

// --- shockwave: an expanding ring with debris chips ----------------------------

function buildShockwave(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  const glow = spriteFor(v.color, 'streak');
  const hot = spriteFor(v.color2, 'streakHot');
  const chip = mixHex(v.color, '#0B0710', 0.62);
  // Debris: launched up and out, falling back under real gravity — the only
  // effect with a ballistic arc, which is what sells weight.
  for (let i = 0; i < 14; i++) {
    const a = rr(0, TAU);
    const p = emit();
    p.dark = true;
    p.x = Math.cos(a) * s * 0.18;
    p.y = Math.sin(a) * s * 0.08;
    p.vx = Math.cos(a) * s * rr(2.2, 5);
    p.vy = -s * rr(1.8, 4.4);
    p.ay = s * 11;
    p.r = s * rr(0.03, 0.055);
    p.rot = rr(0, TAU);
    p.spin = rr(-16, 16);
    p.alpha = 0.95;
    p.life = d * rr(0.6, 0.85);
    p.pow = 0.7;
    p.shape = SH_CHIP;
    p.col = chip;
  }
  // The ring itself: dust puffs stretched along their own outward motion, so
  // the ring is made of movement rather than being a stroked ellipse. Forty
  // puffs (was 28) at 1.4x the throw, stretched for real now (see buildSlash).
  // This is the family the review named as OWNING the expanding-ring shape, so
  // it is also the one archetype the shared impact ring skips (see OWN_RING) —
  // two stroked hoops on one hit is a duplicate, not a layer.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU + rr(-0.06, 0.06);
    const sp = s * rr(3.8, 5.6);
    const p = emit();
    p.x = Math.cos(a) * s * 0.12;
    p.y = Math.sin(a) * s * 0.05;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.4;
    p.drag = 3.4;
    p.r = s * rr(0.022, 0.042);
    p.grow = s * 0.05;
    p.stretch = 4;
    p.shape = SH_STREAK;
    p.rot = a;
    p.born = (i % 4) * d * 0.07;
    p.life = d * rr(0.36, 0.52);
    p.pow = 1.5;
    p.fadeIn = 0.02;
    p.sprite = i % 4 === 0 ? hot : glow;
  }
}

function renderShockwave(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  const ease = 1 - (1 - p) * (1 - p);
  const r = s * (0.12 + 0.88 * ease);
  const fade = (1 - p) * (1 - p);
  // The ground flash under the impact.
  if (p < 0.3) {
    const k = 1 - p / 0.3;
    blit(ctx, v.hotSprite, 0, 0, s * (0.3 + 0.4 * (1 - k)), s * (0.14 + 0.2 * (1 - k)), k * 0.9);
  }
  drawParts(ctx, v);
  // The leading edge, thinning as it runs out.
  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = v.color2;
  ctx.lineWidth = Math.max(1, s * 0.055 * (1 - p));
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.4, 0, 0, TAU);
  ctx.stroke();
}

// --- projectile: a hot head, a mote trail, an impact spray ---------------------

/**
 * The fraction of the effect's life the head spends in flight.
 *
 * 0.32 of 0.72 s = a 230 ms flight, deliberately just under the 236 ms this
 * had before the tail was lengthened. battle.ts fires the VFX and the damage
 * pop on the same HIT event, so every millisecond of flight is a millisecond
 * the number is on screen before the shot lands; the first pass took the
 * flight to 328 ms and made that visibly worse. The impact still owns 490 ms
 * afterwards, which is the tail the round was written for.
 *
 * The real fix is `vfxImpactDelay` — battle.ts delaying the pop by exactly
 * this — but the flight is kept under the old number so the timing can never
 * be worse than it was even before that lands.
 */
const PROJ_ARRIVE = 0.32;

function buildProjectile(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  // The path is stored relative to the target, which is where the renderer sits.
  const dx = v.fromX - v.x;
  const dy = v.fromY - v.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = Math.min(len * 0.14, s * 4);
  const glow = spriteFor(v.color, 'glow');
  const hotStreak = spriteFor(v.color2, 'streakHot');
  const spark = spriteFor(v.color2, 'streakHot');
  const travel = Math.atan2(dy, dx);
  // The trail: small motes laid down along the path, each appearing as the head
  // passes it, so the tail is emitted without spawning anything per frame. Many
  // and small — a handful of fat blobs is a smear, not a trail.
  for (let i = 0; i < 26; i++) {
    const f = i / 26;
    const arc = Math.sin(f * Math.PI) * bow;
    const p = emit();
    p.x = dx * (1 - f) + nx * arc + rr(-0.35, 0.35) * s;
    p.y = dy * (1 - f) + ny * arc + rr(-0.35, 0.35) * s;
    p.vx = rr(-0.5, 0.5) * s;
    p.vy = rr(-1.1, -0.2) * s;
    p.drag = 2;
    p.r = s * rr(0.07, 0.14);
    p.grow = -s * 0.1;
    p.born = (1 - f) * d * PROJ_ARRIVE * 0.94;
    p.life = d * 0.26;
    p.alpha = 0.9;
    p.pow = 1.5;
    p.twinkle = i % 3 === 0 ? rr(12, 20) : 0;
    p.phase = rr(0, TAU);
    p.sprite = glow;
  }
  // Streaks strung along the same path: the smear of a thing moving fast.
  for (let i = 0; i < 12; i++) {
    const f = i / 12;
    const arc = Math.sin(f * Math.PI) * bow;
    const p = emit();
    p.x = dx * (1 - f) + nx * arc;
    p.y = dy * (1 - f) + ny * arc;
    p.r = s * rr(0.032, 0.06);
    p.stretch = rr(6, 10);
    p.shape = SH_STREAK;
    p.rot = travel;
    p.born = (1 - f) * d * PROJ_ARRIVE * 0.94;
    p.life = d * 0.14;
    p.alpha = 0.8;
    p.pow = 1.8;
    p.sprite = hotStreak;
  }
  // The impact: a spray of stretched streaks thrown radially off the hit, so
  // arrival reads as a burst of shards rather than a slightly larger soft ball.
  // 32 shards (was 20) off a 1.4x throw, and their life already runs to the very
  // end of the duration, which is the tail.
  for (let i = 0; i < 32; i++) {
    const a = rr(0, TAU);
    const sp = s * rr(5, 14);
    const p = emit();
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp * 0.9 - s * 1.2;
    p.ay = s * 12;
    p.drag = 3.2;
    p.r = s * rr(0.032, 0.065);
    if (i % 3 !== 0) {
      // Two in three are shards; the third is round spatter — a burst of one
      // uniform shape reads as a texture, and the round ones are near-free.
      p.stretch = rr(6, 10);
      p.shape = SH_STREAK;
      p.rot = a;
    }
    // Spread over the first 70 ms of the arrival rather than all on one frame:
    // the sweep in tools/vfx.ts puts this family's cost peak right here, and a
    // spray that keeps arriving reads as a longer hit, not a smaller one.
    p.born = d * PROJ_ARRIVE + rr(0, 0.07);
    p.life = d * (1 - PROJ_ARRIVE) * rr(0.6, 1);
    p.pow = 1.4;
    p.sprite = spark;
  }
}

function renderProjectile(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  drawParts(ctx, v);
  const f = Math.min(1, p / PROJ_ARRIVE);
  const dx = v.fromX - v.x;
  const dy = v.fromY - v.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(len * 0.14, s * 4);
  const arc = Math.sin(f * Math.PI) * bow;
  const hx = dx * (1 - f) + (-dy / len) * arc;
  const hy = dy * (1 - f) + (dx / len) * arc;
  if (p < PROJ_ARRIVE) {
    // The head: a tight white centre inside a small coloured halo. Kept small —
    // a big soft ball is the blob this archetype replaced, and the trail is
    // what says "travelling".
    blit(ctx, v.softSprite, hx, hy, s * 0.5, s * 0.42, 0.85);
    blit(ctx, v.hotSprite, hx, hy, s * 0.26, s * 0.23, 1);
  } else {
    const k = 1 - (p - PROJ_ARRIVE) / (1 - PROJ_ARRIVE);
    blit(ctx, v.hotSprite, 0, 0, s * (0.32 + 0.4 * (1 - k)), s * (0.28 + 0.36 * (1 - k)), k * k * 0.9);
  }
}

// --- frostShards: glittering crystal in a frost mist ---------------------------

function buildFrostShards(v: VfxInstance): void {
  const s = v.size;
  const d = v.duration;
  // frostShards' `color` is very nearly white, so every layer taken straight
  // from it stacks under 'lighter' into one white blob. The mist and the
  // glitter are pulled toward `color2` (the cold hue) and held dim; only the
  // shard highlights are allowed to be white.
  const cold = mixHex(v.color, v.color2, 0.7);
  const mist = spriteFor(cold, 'soft');
  const glint = spriteFor(v.color2, 'streakHot');
  const star = spriteFor(mixHex(v.color2, '#FFFFFF', 0.25), 'star');
  const body = mixHex(v.color, '#1D2B53', 0.42);
  // Shards: solid crystal, drawn source-over so they read as ice rather than as
  // more glow, growing out of the mist and settling.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + rr(-0.3, 0.3);
    const R = s * rr(0.35, 0.95);
    const p = emit();
    p.dark = true;
    p.x = Math.cos(a) * R;
    p.y = Math.sin(a) * R * 0.75;
    p.vx = Math.cos(a) * s * 0.7;
    p.vy = Math.sin(a) * s * 0.5;
    p.drag = 4;
    p.r = s * rr(0.2, 0.36);
    p.grow = s * 0.18;
    p.rot = a + Math.PI / 2 + rr(-0.3, 0.3);
    p.spin = rr(-1.2, 1.2);
    p.alpha = 0.9;
    p.born = d * rr(0, 0.22);
    p.life = d * rr(0.7, 0.95);
    p.fadeIn = d * 0.1;
    p.pow = 1.4;
    p.shape = SH_SHARD;
    p.col = body;
  }
  // Mist: wide, dim, slow. The bed the crystal sits in.
  for (let i = 0; i < 10; i++) {
    const a = rr(0, TAU);
    const p = emit();
    p.x = Math.cos(a) * s * rr(0, 0.4);
    p.y = Math.sin(a) * s * rr(0, 0.3) + s * 0.1;
    p.vx = Math.cos(a) * s * rr(0.2, 0.6);
    p.vy = -s * rr(0.1, 0.4);
    p.r = s * rr(0.22, 0.4);
    p.grow = s * 0.3;
    p.alpha = 0.16;
    p.fadeIn = d * 0.25;
    p.born = d * rr(0, 0.2);
    p.life = d * 0.9;
    p.pow = 1.2;
    p.sprite = mist;
  }
  // Glints on the shard faces.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + rr(-0.3, 0.3);
    const R = s * rr(0.3, 0.85);
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = Math.sin(a) * R * 0.75;
    p.r = s * rr(0.025, 0.05);
    p.stretch = 4.5;
    p.shape = SH_STREAK;
    p.rot = a + Math.PI / 2;
    p.born = d * rr(0.05, 0.35);
    p.life = d * rr(0.24, 0.4);
    p.pow = 1.4;
    p.twinkle = rr(10, 20);
    p.phase = rr(0, TAU);
    p.sprite = glint;
  }
  // Glitter: tiny stars blinking on and off across the whole cloud.
  for (let i = 0; i < 24; i++) {
    const a = rr(0, TAU);
    const R = Math.sqrt(rnd()) * s * 1.25;
    const p = emit();
    p.x = Math.cos(a) * R;
    p.y = Math.sin(a) * R * 0.8;
    p.vy = -s * rr(0.05, 0.3);
    p.r = s * rr(0.03, 0.065);
    p.born = d * rr(0, 0.6);
    p.life = d * rr(0.25, 0.5);
    p.pow = 1.3;
    p.twinkle = rr(12, 24);
    p.phase = rr(0, TAU);
    p.shape = SH_STAR;
    p.sprite = star;
  }
}

function renderFrostShards(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  const s = v.size;
  // A cold breath under the crystal — the cold hue, and dim: this archetype's
  // brightness has to live in the shard highlights, not in a haze.
  const k = Math.min(1, p * 4) * (1 - p) * (1 - p);
  blit(ctx, v.softSprite, 0, s * 0.1, s * 0.85, s * 0.5, k * 0.32);
  drawParts(ctx, v);
}

// --- Dispatch -----------------------------------------------------------------

function renderOne(ctx: CanvasRenderingContext2D, v: VfxInstance, p: number): void {
  switch (v.kind) {
    case 'slash': return renderSlash(ctx, v, p);
    case 'fireBurst': return renderFireBurst(ctx, v, p);
    case 'windBlade': return renderWindBlade(ctx, v, p);
    case 'waterWave': return renderWaterWave(ctx, v, p);
    case 'lightBeam': return renderLightBeam(ctx, v, p);
    case 'darkPulse': return renderDarkPulse(ctx, v, p);
    case 'healShimmer': return renderHealShimmer(ctx, v, p);
    case 'shieldDome': return renderShieldDome(ctx, v, p);
    case 'stunStar': return renderStunStar(ctx, v);
    case 'burnFlicker': return renderBurnFlicker(ctx, v);
    case 'shockwave': return renderShockwave(ctx, v, p);
    case 'projectile': return renderProjectile(ctx, v, p);
    case 'frostShards': return renderFrostShards(ctx, v, p);
  }
}

// --- The particle pass --------------------------------------------------------

/** One cached sprite, centred, at an explicit half-width / half-height. */
function blit(ctx: CanvasRenderingContext2D, sp: HTMLCanvasElement | null, x: number, y: number, rx: number, ry: number, alpha: number): void {
  if (!sp || alpha <= 0.004 || rx <= 0.05 || ry <= 0.05) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sp, x - rx, y - ry, rx * 2, ry * 2);
}

/**
 * Draws an instance's particles: the dark run under 'source-over', the glowing
 * run under 'lighter'. Allocation-free — every sprite, colour string and
 * gradient it touches was built at spawn.
 */
function drawParts(ctx: CanvasRenderingContext2D, v: VfxInstance): void {
  const parts = v.parts;
  const age = v.age;
  if (v.darkCount > 0) {
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < v.darkCount; i++) drawPart(ctx, parts[i], age);
    ctx.globalCompositeOperation = 'lighter';
  }
  for (let i = v.darkCount; i < v.count; i++) drawPart(ctx, parts[i], age);
}

function drawPart(ctx: CanvasRenderingContext2D, p: Particle, age: number): void {
  const t = age - p.born;
  if (t < 0 || t >= p.life) return;
  const u = t / p.life;
  let a = p.alpha * Math.pow(1 - u, p.pow);
  if (p.fadeIn > 0 && t < p.fadeIn) a *= t / p.fadeIn;
  if (p.twinkle !== 0) a *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.phase + t * p.twinkle));
  if (a <= 0.004) return;
  const r = p.r + p.grow * t;
  if (r <= 0.05) return;
  let x = p.x;
  let y = p.y;
  let rot = p.rot;
  if (p.orbit !== 0) {
    const ang = p.phase + p.orbit * t;
    x += Math.cos(ang) * p.ox;
    y += Math.sin(ang) * p.oy;
    rot += p.spin * t;
    if (p.trail > 0 && p.sprite) {
      // Ghosts one step back along the orbit — analytic, so a trail needs no history buffer.
      for (let k = p.trail; k >= 1; k--) {
        const ga = ang - k * 0.17;
        const gr = r * (1 - k * 0.15);
        if (gr <= 0.05) continue;
        ctx.globalAlpha = a * (0.34 / k);
        ctx.drawImage(p.sprite, p.x + Math.cos(ga) * p.ox - gr, p.y + Math.sin(ga) * p.oy - gr, gr * 2, gr * 2);
      }
    }
  } else if (p.wav !== 0) {
    x += Math.sin(p.phase + t * p.wHz) * p.wav;
  }
  ctx.globalAlpha = a > 1 ? 1 : a;
  switch (p.shape) {
    case SH_MOTE: {
      // A mote IS a radial falloff, so rotating it is a no-op: `rot` is ignored
      // here on purpose and the blit always takes the one-call fast path. That
      // is worth saying out loud — a save()/rotate()/restore() around a
      // drawImage copies the whole graphics state and roughly doubles the cost
      // of the cheapest particle in the module, and several builders set `rot`
      // on motes out of habit (they are computing the angle for the streaks
      // beside them anyway).
      if (!p.sprite) return;
      ctx.drawImage(p.sprite, x - r, y - r, r * 2, r * 2);
      return;
    }
    case SH_STAR: {
      // A four-point sparkle is not rotation-invariant; this one pays.
      if (!p.sprite) return;
      if (rot === 0) {
        ctx.drawImage(p.sprite, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.drawImage(p.sprite, -r, -r, r * 2, r * 2);
        ctx.restore();
      }
      return;
    }
    case SH_STREAK: {
      if (!p.sprite) return;
      const len = r * p.stretch;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(p.sprite, -len, -r, len * 2, r * 2);
      ctx.restore();
      return;
    }
    case SH_CHIP: {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = p.col;
      ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
      ctx.restore();
      return;
    }
    default: {
      // SH_SHARD: a crystal quad with a bright inner facet.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.42, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = Math.min(1, a * 0.9);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.85);
      ctx.lineTo(r * 0.13, -r * 0.1);
      ctx.lineTo(0, r * 0.5);
      ctx.lineTo(-r * 0.13, -r * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
