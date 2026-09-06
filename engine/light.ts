// light.ts — the HD-2D scene layer: a tilt-shift diorama in five passes.
//
// The reference is Octopath Traveler. A frame is built like a stage set, not a
// tilemap: soft blurred planes recede behind a razor-sharp actor plane, warm
// key light rakes in from one side, dust hangs in the beam, and a grading pass
// closes the whole thing under one colour. DESIGN.md's "HD-2D — hard pixels
// under soft light" is the contract; this module owns passes 1, 2, 4 and 5.
// Pass 3 (the actors) belongs to game/art/actors.ts and is drawn BETWEEN two
// calls here. The governing rule stays one line long: exactly one plane is
// pixelated, and it is not one of ours.
//
// The frame, in caller order:
//
//   pc.clear(...)                     // unshaken
//   juice.preRender(ctx)              // camera shake translate
//   light.renderBackground(ctx, { time, shakeX, shakeY });   // far·mid·floor·near + the wash
//   drawActor(...) / light.drawContactShadow(...)            // the sharp plane
//   light.renderLightPlane(ctx, { time, actors });           // per-actor gain · rim · prop glow (fog and dust are drawn by renderBackground, behind the actors)
//   light.renderPost(ctx, { time, flashAlpha });             // bloom · grade · vignette
//   juice.postRender(ctx, W, H)
//   ...panels, ribbon, log, skill bar, text...               // UI is never bloomed
//
// COST. Everything expensive happens once. Planes are painted by the biome's
// own painter functions into padded offscreens and blurred THERE (ctx.filter
// where it exists, a down/up-sample box blur where it does not), then redrawn
// with one drawImage per frame at a parallax offset. Radial gradients are
// built at the origin and positioned with translate, cached per (context,
// colour, radius bucket) so a frame does zero gradient construction and zero
// string building. Dust motes are a pooled, seeded array — no Math.random
// after the biome is built, no allocation in update. getImageData is never
// called at all.
//
// TIERS. HIGH ≈ 8.5 FSE, MED ≈ 6, LOW ≈ 3, ARCADE = LOW's planes (the caller
// applies engine/crt.ts over them). Bloom and CRT halation are the same
// effect: this module never runs bloom below MED, and the tiers that do run it
// must not run the CRT. note(frameMs) implements the contract's one-way drop:
// 60 consecutive frames over 20 ms and the tier falls to LOW, for good.

import type { AmbientPreset } from './particles';

export type LightTier = 'HIGH' | 'MED' | 'LOW' | 'ARCADE';

/**
 * A plane painter draws one depth layer in logical (1280x720) coordinates with
 * plain canvas primitives. It runs ONCE per (biome, tier) into an offscreen,
 * so it may be as expensive as it likes — hundreds of paths are fine. The
 * context it receives is already translated and slightly scaled to cover the
 * parallax padding; just draw as if the frame were 0,0..width,height.
 */
export type PlanePainter = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/**
 * How much of a source counts as light ON THE ACTOR PLANE, as a multiplier on
 * its alpha (default 1). The DIORAMA always gets the source at its full alpha —
 * this scales nothing that is baked into the light map, so a biome's backdrop
 * is bit for bit what it was whatever this says.
 *
 * It exists because the two are not the same job. A crypt's warm key is
 * architecture light: it rakes the far wall from high up on the left and it is
 * the reason that side of the room glows, but the party stands three ranks away
 * from it on the right and should not be lit by it as hard as the enemies
 * standing under it. With one weight per source the frame's own hierarchy — who
 * the eye lands on first — is a number in game/art/backdrops.ts rather than a
 * consequence of where the wall happens to be.
 */
type ActorWeight = {
  /** 0..2, default 1. Scales this source's contribution to the per-actor gain and rim ONLY. */
  actorWeight?: number;
};

/** A radial light source: colour, centre and reach, in logical px. */
export interface KeyLight extends ActorWeight {
  color: string;
  x: number;
  y: number;
  radius: number;
  /** Peak alpha at the centre, composited 'lighter' (0.10-0.30 is the useful band). */
  alpha: number;
}

/** The pool of light on the stage floor where the actors stand — a squashed radial. */
export interface PoolLight extends ActorWeight {
  color: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  alpha: number;
}

/**
 * A SKY BODY — a moon, a sun, a lightning afterglow: the brightest object in
 * the biome, and the one thing in the frame that has to keep reading as a
 * LIGHT after somebody paints a terminal overlay over the top of it.
 *
 * THE dimScene INTERACTION. `engine/ui.ts`'s `dimScene` is a flat black
 * `source-over` at 0.5-0.66 — a uniform multiply. That is proportional, so it
 * cannot invert the frame's value order; what it does do is take a body that
 * was authored as a FLAT DISC with a hard edge and hand back a flat mid-grey
 * disc with a coloured ring around it, which reads as a hole punched in the
 * sky and not as a moon (the marsh's, on `playfull-end-GAME_OVER.png`). A
 * gradient survives the same multiply as a gradient: what dims proportionally
 * and still reads as a light is a CORE inside a wide falloff.
 *
 * So the body is re-applied here, additively, in `renderPost` AFTER the grade
 * — the grade's multiply is the other thing flattening it — as one cached
 * sprite: `r` is the body itself, `halo` the reach of its glow, `alpha` the
 * peak. One `drawImage` per frame for the biomes that declare it and nothing
 * at all for the four that do not.
 */
export interface SkyLight {
  color: string;
  x: number;
  y: number;
  /** Radius of the body's own core, in logical px. */
  r: number;
  /** Radius at which its glow reaches zero. */
  halo: number;
  /** Peak alpha at the centre (0.2-0.6). */
  alpha: number;
}

/** The grading pass: one 'multiply' tint that carries the vignette, one 'screen' lift. */
export interface GradeLook {
  /** Shadow tint multiplied over the frame (the biome's colour of darkness). */
  shadow: string;
  /** Uniform strength of that tint at the frame centre (0.10-0.35). */
  shadowAlpha: number;
  /** Strength of the same tint at the corners — the vignette (0.35-0.70). */
  vignette: number;
  /** Highlight tint screened back in on HIGH only ('' skips the pass). */
  highlight: string;
  highlightAlpha: number;
}

/** Slow horizontal fog banks drifting across the stage, composited 'source-over' (the motes are the additive layer). */
export interface FogLook {
  color: string;
  /** Peak alpha of one band (0.03-0.12). 0 skips fog. */
  alpha: number;
  /** Top of the fog region in logical px. */
  y: number;
  height: number;
  /** Drift speed in px/s; bands alternate direction. */
  speed: number;
  /** How many bands (1-3). */
  bands: number;
}

/**
 * Volumetric light shafts — the village reference: soft diagonal bands leaning
 * out of the key light, baked into the light map and composited 'lighter'.
 */
export interface ShaftLook {
  color: string;
  /** Peak alpha of one shaft (0.05-0.2). */
  alpha: number;
  /** Where the shafts come from, usually off-frame near the key. */
  x: number;
  y: number;
  /** Lean from vertical in radians; positive tips to the right going down. */
  angle: number;
  count: number;
  /** Half-width of one shaft in px. */
  width: number;
  /** How far the shafts throw. */
  length: number;
  /** Distance between shafts across the fan. */
  gap: number;
}

/** Dust, embers or wisps drifting in the beam — smooth alpha sprites, not pixels. */
export interface MoteLook {
  color: string;
  /** Mote count at HIGH; MED halves it, LOW drops them entirely. */
  count: number;
  /** Mote diameter in logical px (soft edge included). */
  size: number;
  /** Vertical drift in px/s — negative rises (embers), positive falls (snow, ash). */
  rise: number;
  /** Sideways sway amplitude in px. */
  drift: number;
}

/** Everything the scene layer needs to know about one biome. Data only — the concrete records live in game/art/backdrops.ts. */
export interface BiomeLook {
  id: string;
  /** The warm (or cold) primary light. */
  key: KeyLight;
  /** The opposing fill, cooler and wider. */
  fill: KeyLight;
  /** The floor pool the actors stand in. */
  pool: PoolLight;
  /**
   * A SECOND floor pool. The stage is a diagonal with the party on one side
   * and the enemies mirrored on the other; one centred pool peaks where nobody
   * stands and leaves the far half of the diagonal unlit. Give the two bands a
   * symmetric pair and both halves read. Optional: a biome with a single pool
   * behaves exactly as before.
   */
  pool2?: PoolLight;
  grade: GradeLook;
  fog: FogLook;
  motes: MoteLook;
  /** Optional volumetric shafts leaning out of the key light. */
  shafts?: ShaftLook;
  /**
   * Optional sky body — the moon, the sun, the afterglow. Re-applied additively
   * after the grade so it survives a terminal `dimScene` as a light; see
   * `SkyLight`. Biomes with no sky (the crypt, the forge, the vault) omit it
   * and pay nothing.
   */
  sky?: SkyLight;
  /** Rim colour spilled along the key-lit side of every actor silhouette. */
  rim: string;
  /** Preset + colour for the caller's engine/particles.ts ambient layer (the coarse pixel layer; the motes above are this module's soft one). */
  ambient: AmbientPreset | null;
  ambientColor?: string;
  /** Sky and far silhouettes — heaviest blur, slowest parallax, opaque (this is the clear). */
  far: PlanePainter;
  /** Mid structures — medium blur. */
  mid: PlanePainter;
  /** The receding stage floor — nearly sharp, moves almost with the actors. */
  floor: PlanePainter;
  /** Foreground framing drawn OVER the actors — heavy blur, fastest parallax. */
  near: PlanePainter;
}

/** The map a game hands the scene layer: biome id -> look. */
export type BiomeLooks = Record<string, BiomeLook>;

/** One actor's bounding rect on the stage, for rim light and glow. */
export interface LightActor {
  /**
   * WHAT this box is. `'actor'` (the default, and what an absent field means)
   * is a BODY: it gets the multiplicative gain, the rim spill and, if it
   * carries a lit prop, the glow. `'vfx'` is an EFFECT's bounds — it gets the
   * glow and NOTHING else.
   *
   * The distinction is not cosmetic. `game/screens/battle.ts` feeds every
   * effect's `vfxBounds` through the same `addLightActor` the six fighters go
   * through, and everything above the `glow > 0` test used to run on it: a
   * `'color-dodge'` gain over a `GAIN_RX x GAIN_RY` (0.66 x 0.98) ellipse of
   * the box, plus a rim spill 1.15 x 0.95 of it. On a body that ellipse is a
   * torso; on a round-3 effect box it is up to 515 x 674 px of the frame lifted
   * multiplicatively, which is why a hit turned its target white — the target's
   * share above L 75 at the moment of impact measures 25.8 % from the sprite's
   * own flash and 67.5 % once the effect's box is fed in. An effect is light
   * that ALREADY draws its own bright pixels; it must not also be a gain.
   */
  kind?: 'actor' | 'vfx';
  /** Left edge of the actor's box in logical px. */
  x: number;
  /** Top edge of the actor's box in logical px. */
  y: number;
  w: number;
  h: number;
  /** 0..1+ — a lit prop (flame staff, orb, halo) the bloom should catch. */
  glow?: number;
  /**
   * WHERE on the box that prop actually is, as fractions of `w` and `h` from
   * the box's top-left: `{dx: 0.32, dy: 0.14}` is a staff head held high on the
   * key side. The glow used to be a disc as wide as the whole sprite centred on
   * the sprite, which lit the carrier's own garment as hard as it lit the prop
   * — an authored L* 12 cell inside EMBER's torso rendered at 47.7 and the
   * plane the artist put there disappeared, while GALE (a dagger, no glow) kept
   * its 15 % below L 35. A prop is a point light a few cells across, not a
   * lantern inside the character.
   *
   * Omit it and the default applies, which is the upper-left quadrant where
   * staffs, raised orbs and halos sit. A caller that knows its recipe's anchor
   * should pass the real one; the field is optional so no caller has to change.
   */
  glowAt?: { dx: number; dy: number };
}

export interface CreateLightOptions {
  width: number;
  height: number;
  tier?: LightTier;
}

export interface BackgroundFrame {
  time: number;
  /** The camera shake currently applied to the context, in logical px. Planes lag it by depth. */
  shakeX?: number;
  shakeY?: number;
}

export interface LightPlaneFrame {
  time: number;
  actors?: readonly LightActor[];
}

export interface PostFrame {
  time: number;
  /** 0..1 — a screen flash in progress; blooms harder for the duration. */
  flashAlpha?: number;
}

export interface Light {
  setTier(tier: LightTier): void;
  tier(): LightTier;
  setBiome(look: BiomeLook): void;
  /**
   * Passes 1-2 and the whole additive wash: far, mid, floor and near planes at
   * their parallax offsets, then the baked light map. The wash is here and not
   * in renderLightPlane so that it lands on the DIORAMA and never on an actor —
   * see GAIN_FLOOR for why an additive term is the wrong law for a sprite.
   */
  renderBackground(ctx: CanvasRenderingContext2D, frame: BackgroundFrame): void;
  /** Pass 4, over the actors: the per-actor multiplicative gain, rim spill, prop glow (fog and dust moved behind the actors in scene round 5). */
  renderLightPlane(ctx: CanvasRenderingContext2D, frame: LightPlaneFrame): void;
  /** Pass 5: bloom, then the grade + vignette. Leaves context state as found. */
  renderPost(ctx: CanvasRenderingContext2D, frame: PostFrame): void;
  /** A soft ellipse under an actor's feet — call before the actor is drawn. */
  drawContactShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void;
  /** Feed the last frame's duration. 60 consecutive frames > 20 ms drops the tier to LOW, permanently. */
  note(frameMs: number): void;
}

// ---------------------------------------------------------------- constants --

/**
 * How far a plane may slide inside its offscreen. Every plane is baked
 * oversized by this on all four sides (and its content scaled to cover the
 * bleed), so parallax and a 30-px death shake can never expose an edge. Same
 * number as ui.ts's DIM_BLEED, for the same reason.
 */
const PLANE_PAD = 40;

/**
 * The scale a padded plane is rasterised at, so that a painter's full logical
 * rect still covers the padded canvas: `max((W + 2·PAD)/W, (H + 2·PAD)/H)`,
 * about the frame centre. On the game's 1280x720 that is **1.1111** (the
 * height drives it, not the width). It has ONE definition because three places
 * have to agree on it — `bakePlane`, `bakeFlat`, and `renderPost`'s sky body,
 * which has to land on top of the far plane that paints it.
 */
function padScale(width: number, height: number): number {
  return Math.max((width + PLANE_PAD * 2) / width, (height + PLANE_PAD * 2) / height);
}

/**
 * Depth of each plane: 1 = locked to the actor plane, 0 = infinitely far. The
 * offset applied is -(1 - depth) x shake, which makes a far plane LAG the
 * camera — the parallax that turns four flat layers into a diorama.
 */
const DEPTH_FAR = 0.3;
const DEPTH_MID = 0.62;
const DEPTH_FLOOR = 0.9;
const DEPTH_NEAR = 1.35;

/**
 * Bake-time blur radius per plane, in logical px. The actor plane gets none —
 * and NEITHER DOES THE FLOOR any more. DESIGN.md's depth-of-field split still
 * holds for FAR and MID (6 and 2.6 px, the two planes the camera is not
 * focused on), but the ground the actors stand on is at the actor plane's own
 * depth, and a 1.25-px blur over it turned a 2-px stone into a 4-px smudge:
 * the floor's whole p10->p90 range measured 4.4 L near and 11.8 mid against
 * `octopath-4`'s 30.8 / 51.9, so the sharp sprites read as pasted onto an
 * airbrush. Zero here is what lets `backdrops.ts`'s `pixelGround` author the
 * ground at ACTOR_SCALE and have the cells survive the bake (see `crisp`
 * in `bakePlane`, which also drops the plane's `padScale` — 1.1111 on a
 * 1280x720 frame).
 */
const BLUR_FAR = 6;
// MID drops to 1.2 in round 6. At 2.6 the plane the diorama's ARCHITECTURE
// lives on — arches, hanging chains, lamps, the lit doorway, the brick coursing
// — was erased: `r3-bd-CRYPT-ARCADE.png` (the flat ARCADE bake, no plane blur)
// shows all of it drawn and the HIGH tier showing none of it. The
// depth-of-field split is still honest: FAR keeps 6 and NEAR keeps 8, so the
// two planes the camera is NOT focused on stay soft, and the mid plane — one
// step behind the actors, not a horizon away — now reads as structure. See
// tools/out/CONTRACT-EDITS-5.md for DESIGN.md's own sentence.
const BLUR_MID = 1.2;
const BLUR_FLOOR = 0;
const BLUR_NEAR = 8;
/** MED flattens mid+floor into one layer and blurs the lot a little less. */
const BLUR_MED_BACK = 2.5;

/** Slow idle sway, so the diorama breathes when the camera is still. */
const SWAY_PX = 5;
const SWAY_RATE = 0.09;

/** Bloom: quarter res at HIGH, eighth at MED. */
const BLOOM_DIV_HIGH = 4;
const BLOOM_DIV_MED = 8;
const BLOOM_ALPHA = 0.5;
/**
 * How much of the bloom is taken back off the ACTOR PLANE, over the same
 * ellipse the gain uses.
 *
 * The bloom is the last additive term left on a sprite, and round 5 measured
 * what that costs once the ground under the actors carries value. With ONE
 * sprite (GALE) planted at all six seats of the crypt at HIGH, the same pose,
 * the same pixels — sheet p50 36.0 at every seat — the frame read p50 47.4 to
 * 57.5: an **8.2 L spread** with the per-actor gain contributing a nearly flat
 * +12.6 to +18.9. At MED (an eighth-res bloom) the spread was 4.3; at LOW,
 * which draws no bloom at all, it was **0.4**. The seat lottery is the bloom
 * and nothing else: it is frame-derived, so a sprite standing where the floor
 * happens to be bright — the near hero seat, or the enemy seat the crypt's
 * brazier blooms across — is lifted by however bright that patch is.
 *
 * Additive is also the wrong law for a sprite's DISTRIBUTION. A constant added
 * in sRGB moves every cell by the same number of L*, so it eats the dark tail
 * first: it is why a hero authored with 48 % of its torso below L 35 arrived
 * with 10 %. The gain (`GAIN_FLOOR`) is multiplicative and preserves the
 * spread, so what the bloom is taken off by is given back there.
 *
 * NOT everywhere. The mask feathers — full over the inner 62 % of the ellipse
 * and back to nothing at its edge — so the halo a lit prop throws into the AIR
 * survives; only the part landing on the carrier's own cells goes. A `'vfx'`
 * box is never damped at all: an effect IS the bright thing the bloom exists
 * to catch. At 1 the frame keeps 205 of 216 hero seat-readings inside the
 * review's value bar against 196 at 0.9, which is the trade this number is
 * making.
 */
const BLOOM_ACTOR_DAMP = 1;

/** Radial gradients are cached per this many px of radius. */
const RADIUS_BUCKET = 8;

/**
 * Semi-axes of the grade's elliptical vignette, as a fraction of the frame.
 * Sized so the corners land at t ~= 1 and every edge mid-point at t ~= 0.7 —
 * one continuous ramp, no straight inner boundary anywhere.
 */
const VIGNETTE_RX = 0.72;
const VIGNETTE_RY = 0.78;

/**
 * The per-actor rim spill: its floor (an actor standing outside every pool is
 * dim, never black) and the lift a fully-lit actor gets on top of it. The
 * reference weight is the alpha at which a source counts as "full" — the top
 * of KeyLight.alpha's documented band.
 *
 * These are HALF what they were before the actor plane went proportional: the
 * spill is now the small ADDITIVE half of an actor's light (the air around a
 * silhouette catching the beam) and the gain below is the large half.
 */
const RIM_FLOOR = 0.04;
const RIM_LIFT = 0.06;
const RIM_REF = 0.24;
/** How far along the light direction the spill is pushed, as fractions of the box. */
const RIM_PUSH_X = 0.3;
const RIM_PUSH_Y = 0.22;

/**
 * THE ACTOR PLANE'S LIGHT IS A GAIN, NOT A WASH.
 *
 * The rig used to light the actors the way it lights the diorama: one additive
 * full-screen blit of the baked light map, over the top of them. An additive
 * term is a constant in sRGB and sRGB is very nearly linear in L*, so it moves
 * every cell by the SAME number of L — which on a garment authored at L 28-36
 * is +15 to +36. Measured per component on CRYPT_WARDEN's own masked cells, the
 * map alone put +19.5 L on cells authored below L 35 and +11.7 on cells above
 * L 65, and the grade's multiply then took -10.0 off the darks and -16.6 off
 * the lights: an authored range of 25 -> 74 came out of the frame as 46 -> 76.
 *
 * The law here is multiplicative instead. `'color-dodge'` with a flat source is
 * exactly `dest / (1 - src)` — a per-channel GAIN — and with a flat colour and
 * a feathered alpha the compositing formula collapses to
 *
 *     out = dest * (1 + a * (G - 1))
 *
 * EXACTLY linear in the source alpha `a`, so one baked soft sprite plus
 * `globalAlpha` covers the whole strength range with no per-frame gradient, no
 * readback and no allocation. A cell's own value survives: the dark plane moves
 * a few L, the mid-tones take 10-15, the highlights keep and gain their
 * sparkle, and the ratio between an actor and the floor it stands on — the one
 * an additive wash drives towards 1:1 — is preserved, because a common gain
 * cancels out of a ratio.
 *
 * GAIN_FLOOR is what an actor standing outside every pool gets; it is not zero
 * because the grade is about a x0.80 multiply and an unlit actor would land
 * BELOW its own sheet. GAIN_LIFT is what a fully-lit one gets on top of that.
 * GAIN_TINT mixes the biome's rim colour toward white — at 0 the gain is
 * neutral, at 1 it carries the rim colour's own channel ratio, which over-warms
 * a garment the biome has already tinted.
 */
const GAIN_FLOOR = 0.06;
const GAIN_LIFT = 0.24;
const GAIN_TINT = 0.45;
/**
 * The gain's footprint, as fractions of the actor's box. Deliberately TIGHTER
 * than the rim spill's: the party stands on a 90-px diagonal carrying 128-px
 * boxes, so two neighbours overlap by a third, and two gains MULTIPLY where two
 * washes only added. At 0.66 x 0.98 the ellipses meet instead of stacking.
 */
/**
 * The per-frame SEAT CAP: how far one body's source reach may sit from the
 * median body's, before the gain is computed from it.
 *
 * The pools are ellipses on the floor and the seats are a diagonal across
 * them, so reach at the six anchors runs 0.18 to 0.99 in the crypt — a 0.8
 * spread, which at `GAIN_LIFT` is ~8 L of gain between the best-lit and the
 * worst-lit seat, on top of whatever the sprite itself is. Round 11 called
 * that out as "the near hero seat is the brightest thing on the stage", and
 * the review's own rule is that no seat's torso p50 may sit more than 5 L
 * above the median seat's.
 *
 * Geometry alone cannot deliver that — the pools have to stay where the feet
 * are — so the rig compresses instead: every actor's reach is clamped into a
 * band around the MEDIAN actor's reach in the same frame. Inside the band the
 * light still varies, which is the point of having pools at all; outside it,
 * no body may be more than `GAIN_SPREAD_CAP` of reach clear of the pack. It is
 * a relative law, so a frame of one actor is unchanged, and `'vfx'` boxes are
 * excluded from the median and never capped.
 */
const GAIN_SPREAD_CAP = 0.14;

const GAIN_RX = 0.66;
const GAIN_RY = 0.98;

/**
 * The lit prop. Two pieces, and neither of them is a disc over the torso:
 *
 *  - NOTHING over the sprite. This pass runs after the actors are drawn, so
 *    any additive disc at the prop lands on the carrier's garment; the prop's
 *    own bright pixels pass renderPost's self-multiply threshold and the bloom
 *    puts the halo back into the air around them, under nothing;
 *  - a WIDE, FLAT pool centred on the actor's FEET, which is the light the
 *    prop throws on the ground and into the contact shadow. It is squashed to
 *    `GLOW_POOL_SQUASH` of its width, so it reaches barely a boot-height above
 *    the floor and never climbs the garment.
 *
 * The bloom is then fed the halo's own footprint rather than the whole sprite:
 * the prop's bright pixels survive renderPost's self-multiply threshold on
 * their own, and this only guarantees a small flame still catches.
 */
const GLOW_AT_DX = 0.32;
const GLOW_AT_DY = 0.14;
const GLOW_HALO = 0.09;
/** Hard ceiling on the bloom seed's radius, in logical px — it must stay inside the prop. */
const GLOW_BLOOM_MAX = 10;
const GLOW_POOL = 0.5;
const GLOW_POOL_GAIN = 0.34;
const GLOW_POOL_ALPHA = 0.2;
const GLOW_POOL_SQUASH = 0.24;

/** Contact shadows are ink, not tint: one colour, hard edge, every biome. */
const SHADOW_INK = '#05060b';
/** The cast lobe's peak alpha and its foreshortening (see drawContactShadow). */
const SHADOW_CAST_ALPHA = 0.82;
const SHADOW_CAST_SQUASH = 0.5;

/** note(): the contract's one-way quality drop. */
const SLOW_FRAME_MS = 20;
const SLOW_FRAME_LIMIT = 60;

// ------------------------------------------------------------------ helpers --

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return cv;
}

function ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = cv.getContext('2d');
  if (!c) throw new Error('light.ts: 2D context unavailable');
  return c;
}

/** Does this browser's 2D context honour ctx.filter? Probed once. */
let filterOk: boolean | null = null;
function hasFilter(c: CanvasRenderingContext2D): boolean {
  if (filterOk === null) {
    try {
      c.filter = 'blur(1px)';
      filterOk = c.filter === 'blur(1px)';
      c.filter = 'none';
    } catch {
      filterOk = false;
    }
  }
  return filterOk;
}

/**
 * Blur `src` into a fresh canvas of the same size. ctx.filter does it in one
 * draw where it exists; where it does not, the fallback is the classic
 * down-then-up resample — three bilinear halvings approximate a Gaussian
 * closely enough for a plane that is meant to be out of focus anyway. Either
 * way this runs at BAKE time only.
 */
function blurred(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const oc = ctx2d(out);
  oc.imageSmoothingEnabled = true;
  if (radius <= 0) {
    oc.drawImage(src, 0, 0);
    return out;
  }
  if (hasFilter(oc)) {
    oc.filter = `blur(${radius}px)`;
    oc.drawImage(src, 0, 0);
    oc.filter = 'none';
    return out;
  }
  const steps = Math.max(1, Math.min(3, Math.round(radius / 2.5)));
  const div = Math.pow(2, steps);
  const small = makeCanvas(src.width / div, src.height / div);
  const sc = ctx2d(small);
  sc.imageSmoothingEnabled = true;
  sc.drawImage(src, 0, 0, small.width, small.height);
  oc.drawImage(small, 0, 0, small.width, small.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Run a plane painter into a padded offscreen and blur it. The painter draws
 * in plain 0..W/0..H logical coordinates; the transform here shifts it into
 * the padding and scales it just enough that its content covers the bleed, so
 * a sliding plane never shows a seam.
 */
function bakePlane(
  painter: PlanePainter,
  width: number,
  height: number,
  blur: number,
  opaqueUnder?: string,
  crisp = false,
): HTMLCanvasElement {
  const w = width + PLANE_PAD * 2;
  const h = height + PLANE_PAD * 2;
  const raw = makeCanvas(w, h);
  const rc = ctx2d(raw);
  rc.imageSmoothingEnabled = true;
  if (opaqueUnder) {
    rc.fillStyle = opaqueUnder;
    rc.fillRect(0, 0, w, h);
  }
  if (crisp) {
    // A PIXEL plane. The scale below is `padScale` — 1.1111 on a 1280x720
    // frame — which is exactly the wrong transform for a ground authored on a
    // 2-px grid: every
    // cell lands on a fractional boundary and the rasteriser antialiases both
    // of its edges, so a hard-pixel stone arrives as a 3-px gradient. Draw at
    // 1:1 inside the padding instead, and pay for the bleed by stretching the
    // outermost row and column of the finished plane outwards — `drawPlane`
    // rounds its parallax offset, so at 1:1 the plane reaches the screen with
    // its cells still whole.
    rc.save();
    rc.translate(PLANE_PAD, PLANE_PAD);
    painter(rc, width, height);
    rc.restore();
    rc.imageSmoothingEnabled = false;
    // left / right columns, then top / bottom rows over the full padded width.
    rc.drawImage(raw, PLANE_PAD, 0, 1, h, 0, 0, PLANE_PAD, h);
    rc.drawImage(raw, w - PLANE_PAD - 1, 0, 1, h, w - PLANE_PAD, 0, PLANE_PAD, h);
    rc.drawImage(raw, 0, PLANE_PAD, w, 1, 0, 0, w, PLANE_PAD);
    rc.drawImage(raw, 0, h - PLANE_PAD - 1, w, 1, 0, h - PLANE_PAD, w, PLANE_PAD);
    rc.imageSmoothingEnabled = true;
    return blur > 0 ? blurred(raw, blur) : raw;
  }
  const s = padScale(width, height);
  rc.save();
  rc.translate(w / 2, h / 2);
  rc.scale(s, s);
  rc.translate(-width / 2, -height / 2);
  painter(rc, width, height);
  rc.restore();
  return blur > 0 ? blurred(raw, blur) : raw;
}

// --- gradient cache ----------------------------------------------------------
// Radial gradients are built ONCE per (context, colour, radius bucket) at the
// ORIGIN and positioned with translate/scale at draw time, so a per-actor rim
// or a contact shadow costs a Map lookup on values that already exist — no
// string building, no gradient construction, nothing for the GC.

type RadiusMap = Map<number, CanvasGradient>;
type ColorMap = Map<string, RadiusMap>;
const gradCache = new WeakMap<CanvasRenderingContext2D, ColorMap>();

/** A soft radial from `color` at full alpha in the centre to transparent at `radius`, centred on (0,0). */
function radial(ctx: CanvasRenderingContext2D, color: string, radius: number): CanvasGradient {
  let byColor = gradCache.get(ctx);
  if (!byColor) {
    byColor = new Map();
    gradCache.set(ctx, byColor);
  }
  let byRadius = byColor.get(color);
  if (!byRadius) {
    byRadius = new Map();
    byColor.set(color, byRadius);
  }
  const bucket = Math.max(1, Math.round(radius / RADIUS_BUCKET));
  const hit = byRadius.get(bucket);
  if (hit) return hit;
  const r = bucket * RADIUS_BUCKET;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, withAlpha(color, 1));
  g.addColorStop(0.45, withAlpha(color, 0.42));
  g.addColorStop(1, withAlpha(color, 0));
  byRadius.set(bucket, g);
  return g;
}

/** #rrggbb (or #rgb) -> rgba(). Called at cache-fill time only. */
function withAlpha(hex: string, alpha: number): string {
  let h = hex.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Draw a cached radial centred at (cx, cy), squashed to rx x ry. One save,
 * one fillRect; the gradient itself never moves, the matrix does.
 */
function blob(
  ctx: CanvasRenderingContext2D,
  color: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  if (alpha <= 0 || rx <= 0 || ry <= 0) return;
  const bucket = Math.max(1, Math.round(rx / RADIUS_BUCKET)) * RADIUS_BUCKET;
  const g = radial(ctx, color, rx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(-bucket, -bucket, bucket * 2, bucket * 2);
  ctx.restore();
}

// ------------------------------------------------------------ baked biomes --

interface Mote {
  x: number;
  y: number;
  /** Phase offset for the sway and the twinkle. */
  seed: number;
  /** Fraction of MoteLook.size, 0.45..1. */
  scale: number;
  /** Fraction of MoteLook.rise, 0.5..1.4 — a depth ramp. */
  speed: number;
  alpha: number;
}

interface Baked {
  id: string;
  tier: LightTier;
  far: HTMLCanvasElement | null;
  mid: HTMLCanvasElement | null;
  floor: HTMLCanvasElement | null;
  near: HTMLCanvasElement | null;
  /** LOW/ARCADE: far+mid+floor+key light+grade flattened into one opaque draw. */
  flat: HTMLCanvasElement | null;
  moteSprite: HTMLCanvasElement | null;
  motes: Mote[];
  /** A soft mist strip, drawn twice at drifting offsets. */
  fogBand: HTMLCanvasElement | null;
  /** Key + fill + pool + shafts, baked flat: one 1:1 'lighter' blit per frame. */
  lightMap: HTMLCanvasElement | null;
  /** Opaque grade + vignette: one 1:1 'multiply' blit per frame. */
  gradeMap: HTMLCanvasElement | null;
  /** Soft round sprites for the per-actor rim spill and prop glow. */
  rimSprite: HTMLCanvasElement | null;
  glowSprite: HTMLCanvasElement | null;
  /** The actor plane's multiplicative light, drawn 'color-dodge' (see GAIN_FLOOR). */
  gainSprite: HTMLCanvasElement | null;
  /** The sky body's core-in-a-halo, re-applied after the grade (see SkyLight). */
  skySprite: HTMLCanvasElement | null;
  /**
   * Key, fill and both floor pools flattened to five parallel arrays — centre,
   * elliptical reach and ACTOR-PLANE weight (alpha x KeyLight.actorWeight).
   * renderLightPlane walks them per actor to find the strongest source at that
   * point, which decides how hard the gain and the rim spill are and which way
   * the spill leans. Built once; the loop reads, never writes.
   */
  srcX: number[];
  srcY: number[];
  srcRX: number[];
  srcRY: number[];
  srcW: number[];
}

/** Deterministic mote layout: same biome, same dust, every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bakeMoteSprite(look: MoteLook): HTMLCanvasElement {
  const r = Math.max(4, Math.ceil(look.size));
  const cv = makeCanvas(r * 2, r * 2);
  const c = ctx2d(cv);
  const g = c.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, withAlpha(look.color, 1));
  g.addColorStop(0.35, withAlpha(look.color, 0.55));
  g.addColorStop(1, withAlpha(look.color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, r * 2, r * 2);
  return cv;
}

function buildMotes(look: MoteLook, count: number, width: number, height: number): Mote[] {
  const rand = lcg(0x5eed ^ count ^ Math.round(look.rise * 31));
  const out: Mote[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: rand() * width,
      y: 100 + rand() * (height - 140),
      seed: rand() * Math.PI * 2,
      scale: 0.45 + rand() * 0.55,
      speed: 0.5 + rand() * 0.9,
      alpha: 0.25 + rand() * 0.55,
    });
  }
  return out;
}

/**
 * Key, fill, floor pool and shafts, composited 'lighter'. BAKE TIME ONLY: a
 * full-screen gradient fillRect costs three times what a 1:1 blit of the same
 * pixels costs, so the whole light rig is flattened into one bitmap here and
 * the frame draws that bitmap instead.
 */
function paintKeyLight(ctx: CanvasRenderingContext2D, look: BiomeLook, scale: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  blob(ctx, look.fill.color, look.fill.x, look.fill.y, look.fill.radius, look.fill.radius, look.fill.alpha * scale);
  blob(ctx, look.key.color, look.key.x, look.key.y, look.key.radius, look.key.radius, look.key.alpha * scale);
  blob(ctx, look.pool.color, look.pool.x, look.pool.y, look.pool.rx, look.pool.ry, look.pool.alpha * scale);
  const p2 = look.pool2;
  if (p2) blob(ctx, p2.color, p2.x, p2.y, p2.rx, p2.ry, p2.alpha * scale);
  const sh = look.shafts;
  if (sh && sh.alpha > 0) {
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.angle);
    for (let i = 0; i < sh.count; i++) {
      const off = (i - (sh.count - 1) / 2) * sh.gap;
      const w = sh.width * (0.62 + ((i * 7) % 5) * 0.16);
      blob(ctx, sh.color, off, sh.length * 0.5, w, sh.length * 0.5, sh.alpha * scale);
      blob(ctx, sh.color, off, sh.length * 0.34, w * 0.5, sh.length * 0.34, sh.alpha * 0.7 * scale);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** The light rig flattened to one full-res bitmap, softened so nothing bands. */
function bakeLightMap(look: BiomeLook, width: number, height: number, withHighlight: boolean): HTMLCanvasElement {
  const cv = makeCanvas(width, height);
  const c = ctx2d(cv);
  paintKeyLight(c, look, 1);
  if (withHighlight && look.grade.highlight && look.grade.highlightAlpha > 0) {
    paintHighlight(c, look, width, height);
  }
  return blurred(cv, 5);
}

/**
 * The grade + vignette as an OPAQUE bitmap: white where the frame is untouched,
 * tinted where it is darkened, so one 'multiply' blit reproduces exactly what a
 * cached gradient fillRect used to — at a third of the cost.
 */
function bakeGradeMap(look: BiomeLook, width: number, height: number, flatTier: boolean): HTMLCanvasElement {
  const cv = makeCanvas(width, height);
  const c = ctx2d(cv);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height * 0.46;
  // ELLIPTICAL, not a circle scaled to the diagonal. A circular falloff on a
  // 16:9 frame runs out of gradient long before the left and right edges, so
  // its last stops pile up into a band down each side with a straight inner
  // boundary — a rectangular vignette in all but name. Building the gradient
  // on a unit circle and scaling it to the frame's own proportions puts the
  // corners at t ~= 1 and the side mid-points at t ~= 0.7, which is a single
  // smooth ramp of 600+ px from the centre to any edge.
  const rx = width * VIGNETTE_RX;
  const ry = height * VIGNETTE_RY;
  // At LOW the uniform tint is already inside the flat background; only the
  // vignette is left to draw over the actors.
  const centre = flatTier ? 0 : look.grade.shadowAlpha;
  const span = look.grade.vignette - centre;
  c.save();
  c.translate(cx, cy);
  c.scale(rx, ry);
  const g = c.createRadialGradient(0, 0, 0.16, 0, 0, 1);
  g.addColorStop(0, withAlpha(look.grade.shadow, centre));
  g.addColorStop(0.45, withAlpha(look.grade.shadow, centre + span * 0.1));
  g.addColorStop(0.72, withAlpha(look.grade.shadow, centre + span * 0.36));
  g.addColorStop(0.9, withAlpha(look.grade.shadow, centre + span * 0.72));
  g.addColorStop(1, withAlpha(look.grade.shadow, look.grade.vignette));
  c.fillStyle = g;
  // In the scaled space the frame spans at most +/-0.75 on each axis; 2 covers
  // it with room for the gradient's own edge clamp.
  c.fillRect(-2, -2, 4, 4);
  c.restore();
  return cv;
}

/**
 * The HIGH tier's highlight lift, painted INTO the light map rather than
 * blitted as its own 'screen' pass. A separate full-screen blend costs about
 * 0.9 ms of a 8 ms frame and an additive lift is indistinguishable from a
 * screen at these alphas, so the tint is baked where it is free.
 */
function paintHighlight(ctx: CanvasRenderingContext2D, look: BiomeLook, width: number, height: number): void {
  const g = ctx.createLinearGradient(look.key.x, 0, width - look.key.x, height);
  g.addColorStop(0, withAlpha(look.grade.highlight, look.grade.highlightAlpha));
  g.addColorStop(0.5, withAlpha(look.grade.highlight, look.grade.highlightAlpha * 0.3));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** A soft round sprite: rim spill and prop glow are drawn as scaled bitmaps, never as per-frame gradient fills. */
function softSprite(color: string, size: number): HTMLCanvasElement {
  const cv = makeCanvas(size, size);
  const c = ctx2d(cv);
  const r = size / 2;
  const g = c.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, withAlpha(color, 1));
  g.addColorStop(0.42, withAlpha(color, 0.4));
  g.addColorStop(1, withAlpha(color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

/**
 * The actor-plane damp mask: opaque across the body and feathering to nothing
 * at the ellipse's edge, so the bloom is removed from the sprite's own cells
 * and left in the air around it (see BLOOM_ACTOR_DAMP). Baked once.
 */
function bloomDampSprite(): HTMLCanvasElement {
  const size = 64;
  const cv = makeCanvas(size, size);
  const c = ctx2d(cv);
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.62, 'rgba(255,255,255,1)');
  g.addColorStop(0.86, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

/**
 * The sky body as a LIGHT: a hot core that holds its value across the disc, a
 * soft limb, then a long falloff to nothing at `halo`. Five stops rather than
 * softSprite's three, because this one is judged after a 0.5 multiply — the
 * shape of the ramp is the whole point (see `SkyLight`).
 */
function skySprite(look: SkyLight): HTMLCanvasElement {
  const size = Math.max(8, Math.ceil(look.halo * 2));
  const cv = makeCanvas(size, size);
  const c = ctx2d(cv);
  const R = size / 2;
  const core = Math.max(0.02, Math.min(0.9, look.r / look.halo));
  // THE CORE FALLS ACROSS ITSELF. Holding 0.92 alpha out to 72 % of the disc
  // made the sprite flatten the very body it exists to keep: measured under a
  // terminal dim the marsh moon read p10 = p50 = p90 = 53.2 with a range of
  // 0.0 L and satMean 0.0 — a grey coin, the round-2 defect, drawn by the fix
  // for it. A real body is brightest at one point and falls off from there, and
  // an additive sprite that ramps lets the FAR plane's own painted disc (which
  // is a gradient too now) show through the middle of it.
  const g = c.createRadialGradient(R * 0.94, R * 0.9, 0, R, R, R);
  g.addColorStop(0, withAlpha(look.color, 1));
  g.addColorStop(core * 0.3, withAlpha(look.color, 0.86));
  g.addColorStop(core * 0.66, withAlpha(look.color, 0.62));
  g.addColorStop(core, withAlpha(look.color, 0.36));
  g.addColorStop(core + (1 - core) * 0.24, withAlpha(look.color, 0.17));
  g.addColorStop(core + (1 - core) * 0.6, withAlpha(look.color, 0.045));
  g.addColorStop(1, withAlpha(look.color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

/**
 * The actor plane's GAIN sprite: a flat colour whose value is the dodge amount
 * `1 - 1/G` per channel, under an alpha profile that holds most of its strength
 * over the silhouette and lets go before the box edge.
 *
 * The profile matters more here than it does for a spill. `softSprite`'s ramp
 * is down to 0.4 by 42 % of the radius, which on a 128-px box puts a quarter of
 * the peak gain on a shoulder — the limbs would model darker than the chest for
 * no reason in the art. This holds ~0.9 out to half the radius and then falls,
 * so the gain reads as a light on the figure rather than a spot on its middle,
 * and still reaches zero at the ellipse so nothing edges.
 */
function gainSprite(rim: string, size: number, gain: number, tint: number): HTMLCanvasElement {
  const t = Math.max(0, Math.min(0.92, 1 - 1 / Math.max(1, gain)));
  let h = rim.trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const peak = Math.max(1, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  const chan = (v: number): number => {
    // The rim colour's channel ratio, mixed `tint` of the way from neutral.
    const k = 1 - tint + tint * (v / peak);
    return Math.round(255 * Math.max(0, Math.min(0.92, t * k)));
  };
  const col = `rgb(${chan((n >> 16) & 255)},${chan((n >> 8) & 255)},${chan(n & 255)})`;
  const cv = makeCanvas(size, size);
  const c = ctx2d(cv);
  const r = size / 2;
  const g = c.createRadialGradient(r, r, 0, r, r, r);
  const stop = (at: number, a: number): void => {
    g.addColorStop(at, col.replace('rgb(', 'rgba(').replace(')', `,${a})`));
  };
  stop(0, 1);
  stop(0.5, 0.9);
  stop(0.78, 0.44);
  stop(1, 0);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return cv;
}

/**
 * Flatten every plane plus the key light and the colour grade into one opaque
 * bitmap — the LOW tier's whole background pass.
 *
 * Each painter gets its OWN layer. A painter is entitled to use
 * 'destination-out' on itself (feathering the joint where its ground meets the
 * haze is exactly that), and painting all three into one canvas turned that
 * into an erase straight through the planes behind it — a transparent
 * full-width strip at the wall line, which is the seam the HD tiers spend
 * effort breaking. One scratch canvas per plane, at bake time, keeps LOW
 * showing what HIGH shows.
 */
function bakeFlat(look: BiomeLook, width: number, height: number): HTMLCanvasElement {
  const w = width + PLANE_PAD * 2;
  const h = height + PLANE_PAD * 2;
  const cv = makeCanvas(w, h);
  const c = ctx2d(cv);
  c.imageSmoothingEnabled = true;
  const s = padScale(width, height);
  const layer = makeCanvas(w, h);
  const lc = ctx2d(layer);
  lc.imageSmoothingEnabled = true;
  for (const painter of [look.far, look.mid, look.floor]) {
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'copy';
    lc.fillStyle = 'rgba(0,0,0,0)';
    lc.fillRect(0, 0, w, h);
    lc.globalCompositeOperation = 'source-over';
    lc.save();
    lc.translate(PLANE_PAD, PLANE_PAD);
    lc.translate(width / 2, height / 2);
    lc.scale(s, s);
    lc.translate(-width / 2, -height / 2);
    painter(lc, width, height);
    lc.restore();
    c.drawImage(layer, 0, 0);
  }
  c.save();
  c.translate(PLANE_PAD, PLANE_PAD);
  c.translate(width / 2, height / 2);
  c.scale(s, s);
  c.translate(-width / 2, -height / 2);
  paintKeyLight(c, look, 1);
  // The grade, minus the vignette: LOW still draws that over the actors.
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = withAlpha(look.grade.shadow, look.grade.shadowAlpha);
  c.fillRect(-PLANE_PAD, -PLANE_PAD, w, h);
  c.restore();
  return cv;
}

/**
 * A drifting mist strip: overlapping soft blobs, blurred once. Drawn twice per
 * frame at different offsets and alphas, which is enough parallax for fog.
 */
function bakeFogBand(fog: FogLook, width: number): HTMLCanvasElement {
  const w = Math.ceil(width * 1.5);
  const h = Math.max(8, Math.ceil(fog.height));
  const cv = makeCanvas(w, h);
  const c = ctx2d(cv);
  const rand = lcg(0xf0619 ^ Math.round(fog.speed * 97));
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const rx = w * (0.09 + rand() * 0.16);
    blob(c, fog.color, rand() * w, h * (0.25 + rand() * 0.5), rx, h * (0.3 + rand() * 0.45), 0.24 + rand() * 0.3);
  }
  c.globalCompositeOperation = 'source-over';
  return blurred(cv, 12);
}

function pushSource(b: Baked, x: number, y: number, rx: number, ry: number, w: number): void {
  b.srcX.push(x);
  b.srcY.push(y);
  b.srcRX.push(Math.max(1, rx));
  b.srcRY.push(Math.max(1, ry));
  b.srcW.push(w);
}

function bakeBiome(look: BiomeLook, tier: LightTier, width: number, height: number): Baked {
  const low = tier === 'LOW' || tier === 'ARCADE';
  const med = tier === 'MED';
  const baked: Baked = {
    id: look.id,
    tier,
    far: null,
    mid: null,
    floor: null,
    near: null,
    flat: null,
    moteSprite: null,
    motes: [],
    fogBand: null,
    lightMap: null,
    gradeMap: null,
    rimSprite: null,
    glowSprite: null,
    gainSprite: null,
    skySprite: null,
    srcX: [],
    srcY: [],
    srcRX: [],
    srcRY: [],
    srcW: [],
  };
  // The weights below are the ACTOR PLANE's, not the diorama's: the light map
  // above is baked from the same records at their full alpha, so nothing here
  // can move a backdrop pixel.
  const aw = (src: { alpha: number; actorWeight?: number }): number => src.alpha * (src.actorWeight ?? 1);
  pushSource(baked, look.key.x, look.key.y, look.key.radius, look.key.radius, aw(look.key));
  pushSource(baked, look.fill.x, look.fill.y, look.fill.radius, look.fill.radius, aw(look.fill));
  pushSource(baked, look.pool.x, look.pool.y, look.pool.rx, look.pool.ry, aw(look.pool));
  if (look.pool2) {
    pushSource(baked, look.pool2.x, look.pool2.y, look.pool2.rx, look.pool2.ry, aw(look.pool2));
  }
  baked.gradeMap = bakeGradeMap(look, width, height, low);
  // Every tier, LOW included: the flat bake carries the same flat disc, and a
  // terminal overlay is drawn over LOW exactly as it is over HIGH.
  if (look.sky && look.sky.alpha > 0) baked.skySprite = skySprite(look.sky);
  if (low) {
    baked.flat = bakeFlat(look, width, height);
    return baked;
  }
  baked.lightMap = bakeLightMap(look, width, height, !med);
  baked.rimSprite = softSprite(look.rim, 96);
  baked.glowSprite = softSprite(look.key.color, 96);
  baked.gainSprite = gainSprite(look.rim, 96, 1 + GAIN_FLOOR + GAIN_LIFT, GAIN_TINT);
  baked.far = bakePlane(look.far, width, height, BLUR_FAR, '#000000');
  if (med) {
    // MED folds mid and floor into one plane: one fewer full-screen draw, and
    // the floor's parallax difference is invisible next to a phone's shake.
    //
    // They are RASTERISED SEPARATELY first, though. `fadeTop` in
    // game/art/backdrops.ts feathers the floor's top edge with
    // 'destination-out'; on a SHARED canvas that erase goes straight through
    // the mid content under it and down to the far plane, and what comes back
    // is a hard full-width boundary at the wall/floor joint — exactly the
    // defect `bakeFlat` was given per-painter layers for at LOW. Measured with
    // the straight-edge detector on `bd-SUNKEN_VAULT`: a 1171-px run at y 379
    // at MED against 187 px at HIGH, and 1249 px on `bd-SKY_RUINS`. The temp
    // canvas is oversized by PLANE_PAD on every side because the floor
    // painters deliberately draw past the logical rect (`floorLip`,
    // `edgeCurtain`), and it is composited before the blur, so the frame still
    // draws exactly one bitmap and pays nothing.
    baked.mid = bakePlane(
      (c, w, h) => {
        look.mid(c, w, h);
        const P = PLANE_PAD;
        const fl = makeCanvas(w + P * 2, h + P * 2);
        const fc = ctx2d(fl);
        fc.translate(P, P);
        look.floor(fc, w, h);
        c.drawImage(fl, -P, -P);
      },
      width,
      height,
      BLUR_MED_BACK,
    );
  } else {
    baked.mid = bakePlane(look.mid, width, height, BLUR_MID);
    baked.floor = bakePlane(look.floor, width, height, BLUR_FLOOR, undefined, true);
  }
  baked.near = bakePlane(look.near, width, height, BLUR_NEAR);
  if (look.fog.alpha > 0) baked.fogBand = bakeFogBand(look.fog, width);
  const count = med ? Math.round(look.motes.count * 0.5) : look.motes.count;
  if (count > 0) {
    baked.moteSprite = bakeMoteSprite(look.motes);
    baked.motes = buildMotes(look.motes, count, width, height);
  }
  return baked;
}

// ----------------------------------------------------------------- the API --

export function createLight(opts: CreateLightOptions): Light {
  const W = opts.width;
  const H = opts.height;
  let tier: LightTier = opts.tier ?? 'HIGH';
  let look: BiomeLook | null = null;
  let baked: Baked | null = null;
  const cache = new Map<string, Baked>();

  let slowRun = 0;
  let dropped = false;
  let shakeX = 0;
  let shakeY = 0;
  let lastTime = -1;

  // Bloom offscreens: one pair for the life of the module, re-sized only when
  // the divisor changes with the tier.
  let bloomA: HTMLCanvasElement | null = null;
  let bloomB: HTMLCanvasElement | null = null;
  let bloomACtx: CanvasRenderingContext2D | null = null;
  let bloomBCtx: CanvasRenderingContext2D | null = null;
  let bloomMid: HTMLCanvasElement | null = null;
  let bloomMidCtx: CanvasRenderingContext2D | null = null;
  let bloomDiv = 0;
  let bloomW = 0;
  let bloomH = 0;
  let bloomPhase = 0;
  let bloomStale = true;

  // Glow list, refilled by renderLightPlane and read by the bloom: pooled, so
  // a frame with six lit props allocates nothing.
  const glowX: number[] = [];
  const glowY: number[] = [];
  const glowR: number[] = [];
  const glowA: number[] = [];
  let glowN = 0;

  // The actor-plane damp list, filled in the same pass and read by the bloom
  // (see BLOOM_ACTOR_DAMP). Pooled exactly like the glow list; a 'vfx' box
  // never enters it.
  const reachBuf: number[] = [];
  const reachSorted: number[] = [];
  const dampX: number[] = [];
  const dampY: number[] = [];
  const dampRX: number[] = [];
  const dampRY: number[] = [];
  let dampN = 0;
  let dampSprite: HTMLCanvasElement | null = null;

  function ensureBaked(): Baked | null {
    if (!look) return null;
    if (baked && baked.id === look.id && baked.tier === tier) return baked;
    const key = look.id + '|' + tier;
    let hit = cache.get(key);
    if (!hit) {
      hit = bakeBiome(look, tier, W, H);
      cache.set(key, hit);
    }
    baked = hit;
    return baked;
  }

  function ensureBloom(div: number): boolean {
    if (bloomDiv === div && bloomA && bloomB) return true;
    bloomDiv = div;
    bloomW = Math.max(2, Math.round(W / div));
    bloomH = Math.max(2, Math.round(H / div));
    bloomA = makeCanvas(bloomW, bloomH);
    bloomB = makeCanvas(bloomW, bloomH);
    bloomACtx = ctx2d(bloomA);
    bloomBCtx = ctx2d(bloomB);
    bloomACtx.imageSmoothingEnabled = true;
    bloomBCtx.imageSmoothingEnabled = true;
    bloomMid = makeCanvas(W / 2, H / 2);
    bloomMidCtx = ctx2d(bloomMid);
    bloomMidCtx.imageSmoothingEnabled = true;
    bloomStale = true;
    return true;
  }

  /** One plane at its parallax offset. Depth < 1 lags the camera, > 1 leads it. */
  function drawPlane(
    ctx: CanvasRenderingContext2D,
    plane: HTMLCanvasElement | null,
    depth: number,
    sway: number,
  ): void {
    if (!plane) return;
    const ox = Math.round(-PLANE_PAD - (1 - depth) * shakeX + sway);
    const oy = Math.round(-PLANE_PAD - (1 - depth) * shakeY);
    ctx.drawImage(plane, ox, oy);
  }

  return {
    setTier(next) {
      // The drop is one-way: once a device has proved it cannot hold 60 Hz,
      // nothing puts it back up (DESIGN.md, tier table).
      if (dropped && (next === 'HIGH' || next === 'MED')) return;
      tier = next;
      baked = null;
    },
    tier() {
      return tier;
    },
    setBiome(next) {
      look = next;
      baked = null;
      ensureBaked();
    },

    renderBackground(ctx, frame) {
      const b = ensureBaked();
      if (!b || !look) return;
      shakeX = frame.shakeX ?? 0;
      shakeY = frame.shakeY ?? 0;
      // The mote clock lives here now that the motes do (see DUST IN THE BEAM).
      const dt = lastTime < 0 ? 0 : Math.max(0, Math.min(0.1, frame.time - lastTime));
      lastTime = frame.time;
      const sway = Math.sin(frame.time * SWAY_RATE) * SWAY_PX;
      if (b.flat) {
        // LOW / ARCADE: one opaque draw, key light and grade already in it.
        ctx.drawImage(b.flat, -PLANE_PAD, -PLANE_PAD);
        return;
      }
      drawPlane(ctx, b.far, DEPTH_FAR, sway * 0.3);
      drawPlane(ctx, b.mid, DEPTH_MID, sway * 0.7);
      drawPlane(ctx, b.floor, DEPTH_FLOOR, sway);
      // The NEAR plane and the light rig both moved up here, out of
      // renderLightPlane, so that the additive wash lands on the DIORAMA and
      // never on an actor (see GAIN_FLOOR). Their order relative to each other
      // and to the three planes above is untouched — far, mid, floor, near,
      // light — so a frame with no actors in it is pixel for pixel the frame
      // this rig drew before, which is what tools/backdrops.html captures.
      //
      // The near plane is now UNDER the actors rather than over them. It is the
      // foreground, so that is a real reordering, and it is safe only because
      // this diorama's foreground never touches an actor: the side curtains
      // ramp out by x 150-186 and the front rank's sprite starts at x 174, and
      // floorLip is authored to start below the front rank's feet at y 516 (its
      // own comment says so). A biome that paints near-plane matter across the
      // stage would occlude actors before this change and would not after it.
      drawPlane(ctx, b.near, DEPTH_NEAR, sway * 1.4);
      // The whole light rig in one 1:1 additive blit — key, fill, floor pools
      // and shafts, baked. It breathes on ALPHA only, never on geometry, so the
      // bitmap stays valid for the life of the biome.
      if (b.lightMap) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.94 + 0.06 * Math.sin(frame.time * 0.6);
        ctx.drawImage(b.lightMap, 0, 0);
        ctx.restore();
      }

      // THE FOG BANDS, and they are drawn HERE — behind the actors, at the end
      // of the background — not in renderLightPlane over the top of them.
      //
      // On a frame with nobody on the stage this is the same picture to the
      // byte: renderLightPlane's first act was the per-actor loop (which does
      // nothing with no actors) and its second was this block, so [planes]
      // [light map][fog] is the order either way. With actors it is a different
      // frame, and the measurement is why. Round 5 planted ONE sprite at all
      // six seats of the crypt: identical pixels, sheet p50 36.0 everywhere,
      // and the frame read a 6.6 L spread across the seats. The fog is a strip
      // drawn TWICE at `fog.y` and `fog.y + height * 0.42` — 300 and 409 in the
      // crypt — so a sprite standing in the near rank has both bands over it
      // and a sprite in the far rank has one, which lifted the near enemy seat
      // 4 L above the median for no reason an artist could see or fix. Killing
      // the fog and motes over the actor plane took the spread to 2.3.
      //
      // It is also the right way round: aerial perspective is between the
      // planes, not a wash over the thing the camera is focused on. The motes
      // stay over the actors — they are dust in the beam, sparse and in front.
      const fl = look.fog;
      if (b.fogBand && fl.alpha > 0) {
        const band = b.fogBand;
        ctx.save();
        for (let i = 0; i < fl.bands; i++) {
          const dir = i % 2 === 0 ? 1 : -1;
          const span = band.width;
          let x = ((frame.time * fl.speed * dir * (0.6 + i * 0.35)) % span) - span * 0.25;
          if (x > 0) x -= span;
          const y = fl.y + i * fl.height * 0.42;
          ctx.globalAlpha = fl.alpha * (1 - i * 0.22);
          ctx.drawImage(band, Math.round(x), Math.round(y));
          // The wrap copy only when the first one leaves a gap on the right.
          if (x + span < W) ctx.drawImage(band, Math.round(x + span), Math.round(y));
        }
        ctx.restore();
      }

      // DUST IN THE BEAM — and behind the actors, with the fog, for the same
      // reason and a bigger number. The motes are 64 additive blobs up to ~36 px
      // across at seeded positions; where a few of them happen to cluster they
      // are worth SIX L on whatever sprite stands there. In the crypt they sit
      // over the near enemy seat, and that one accident was most of round 5's
      // 6.6 L seat spread: turning the motes off alone took it to 3.0. Nothing
      // an artist can see, nothing an artist can fix, and it moves with the
      // seed rather than with the light. Behind the actor plane it is still the
      // same dust in the same beam — the actor plane is the one the camera is
      // focused on, and since round 3 the NEAR plane is under the actors too.
      if (b.moteSprite && b.motes.length) {
        const m = look.motes;
        const sprite = b.moteSprite;
        const sw = sprite.width;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < b.motes.length; i++) {
          const p = b.motes[i];
          p.y += m.rise * p.speed * dt;
          if (p.y < 90) p.y = H - 30;
          else if (p.y > H - 20) p.y = 100;
          p.x += Math.cos(frame.time * 0.5 + p.seed) * m.drift * dt;
          if (p.x < -20) p.x = W + 10;
          else if (p.x > W + 20) p.x = -10;
          const tw = 0.55 + 0.45 * Math.sin(frame.time * 1.6 + p.seed * 3);
          const size = sw * p.scale;
          ctx.globalAlpha = p.alpha * tw;
          ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
        }
        ctx.restore();
      }
    },

    renderLightPlane(ctx, frame) {
      glowN = 0;
      dampN = 0;
      const b = ensureBaked();
      if (!b || !look || b.flat) return; // LOW has no light plane at all.
      const l = look;

      // 3. The actor plane's own light, per actor: first the multiplicative
      //    GAIN that replaced the additive wash (see GAIN_FLOOR), then the
      //    additive rim spill around the silhouette and the prop's floor pool.
      //    The crisp per-pixel rim is baked into the sprite by the actor
      //    pipeline; this is the spill around it, the part the bloom catches.
      const actors = frame.actors;
      if (actors && actors.length && b.rimSprite && b.glowSprite) {
        const rimS = b.rimSprite;
        const glowS = b.glowSprite;
        const gainS = b.gainSprite;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const srcN = b.srcX.length;
        // PASS ONE: every body's raw reach, and the median of them. Two pooled
        // arrays, at most sixteen entries, no allocation (see GAIN_SPREAD_CAP).
        let bodyN = 0;
        for (let i = 0; i < actors.length; i++) {
          const a = actors[i];
          if (a.kind === 'vfx') continue;
          const cx0 = a.x + a.w / 2;
          const fy0 = a.y + a.h;
          let bw = 0;
          for (let s = 0; s < srcN; s++) {
            const ox = b.srcX[s] - cx0;
            const oy = b.srcY[s] - fy0;
            const nd = Math.hypot(ox / b.srcRX[s], oy / b.srcRY[s]);
            const w = nd >= 1 ? 0 : b.srcW[s] * (1 - nd);
            if (w > bw) bw = w;
          }
          reachBuf[bodyN] = Math.min(1, bw / RIM_REF);
          reachSorted[bodyN] = reachBuf[bodyN];
          bodyN++;
        }
        let medReach = 0;
        if (bodyN > 0) {
          // Insertion sort over <= 16 pooled entries; sort() would allocate.
          for (let i = 1; i < bodyN; i++) {
            const v = reachSorted[i];
            let j = i - 1;
            while (j >= 0 && reachSorted[j] > v) { reachSorted[j + 1] = reachSorted[j]; j--; }
            reachSorted[j + 1] = v;
          }
          medReach = reachSorted[bodyN >> 1];
        }
        let bodyI = 0;
        for (let i = 0; i < actors.length; i++) {
          const a = actors[i];
          const cx = a.x + a.w / 2;
          const cy = a.y + a.h * 0.42;
          // WHERE THE SOURCE TEST HAPPENS: at the actor's FEET, not at its
          // chest. `cy` above is the centre of mass and it is still where the
          // gain and the spill are CENTRED, but the question "which light is on
          // this actor, and how hard" is answered at `fy` — the ground the
          // actor is standing on.
          //
          // The two floor pools are ellipses centred at the floor line with
          // ry ~ 116; a standing figure's chest is ~65 px above its feet, which
          // is more than half of that. So an actor standing squarely IN a pool
          // had its chest tested near the pool's edge, and the seats standing in
          // the brightest light drew the least gain. Measured on the crypt with
          // one sprite at all six seats: the enemy-1 seat has the brightest
          // ground of the six (strip relY 122 against 87-104) and drew the
          // LOWEST reach of the six (0.23); at the feet it draws 0.62, and the
          // near hero seat — the one round 11 called the brightest on the stage
          // — drops from 0.83 to 0.55. The rig now tracks the floor it is
          // lighting bodies against, which is the whole point of a floor pool.
          const fy = a.y + a.h;
          // Which light is actually on this actor? A single centred pool peaks
          // where nobody stands, so a flat rim alpha left one whole half of the
          // stage diagonal reading as unlit. Walk the sources, keep the
          // strongest at this point, and drive the GAIN's strength, the spill's
          // strength and the spill's lean off it — the lean blended halfway
          // back toward the key, because the sprites' own baked rim is
          // upper-left in every biome and the spill must not fight it.
          //
          // srcW is alpha x actorWeight, so a source can be worth more or less
          // to a BODY than it is to the wall behind it (see ActorWeight).
          let best = 0;
          let bx = 0;
          let by = 0;
          for (let s = 0; s < srcN; s++) {
            const ox = b.srcX[s] - cx;
            const oy = b.srcY[s] - fy;
            const nd = Math.hypot(ox / b.srcRX[s], oy / b.srcRY[s]);
            const w = nd >= 1 ? 0 : b.srcW[s] * (1 - nd);
            if (w > best) {
              best = w;
              bx = ox;
              by = oy;
            }
          }
          let dx = l.key.x - cx;
          let dy = l.key.y - cy;
          const kl = Math.hypot(dx, dy) || 1;
          dx /= kl;
          dy /= kl;
          if (best > 0) {
            const bl = Math.hypot(bx, by) || 1;
            dx = dx * 0.5 + (bx / bl) * 0.5;
            dy = dy * 0.5 + (by / bl) * 0.5;
            const bn = Math.hypot(dx, dy) || 1;
            dx /= bn;
            dy /= bn;
          }
          // The capped reach (see GAIN_SPREAD_CAP). A 'vfx' box never entered
          // the median and is not capped; it takes its raw value and uses it
          // for nothing but the spill it does not draw.
          let reach = Math.min(1, best / RIM_REF);
          if (a.kind !== 'vfx') {
            const raw = reachBuf[bodyI++];
            reach = medReach + Math.max(-GAIN_SPREAD_CAP, Math.min(GAIN_SPREAD_CAP, raw - medReach));
          }
          // 3a. THE GAIN. `'color-dodge'` with this sprite's flat colour is a
          //     per-channel multiply, and with a flat colour under a feathered
          //     alpha the compositing formula is exactly
          //     out = dest * (1 + a * (G - 1)) — linear in globalAlpha, so one
          //     baked sprite covers the whole strength band. Drawn BEFORE the
          //     spill on purpose: multiply the sprite's own value first, then
          //     add the floor, which is the "multiply-then-add" the actor plane
          //     needs. Centred on the box and NOT pushed toward the light: the
          //     sprite's own baked rim already carries the direction, and a
          //     pushed gain lights the air on one side instead of the figure.
          if (a.kind !== 'vfx' && dampN < 16) {
            // The bloom's share of THIS body, to be taken back in renderPost.
            dampX[dampN] = cx;
            dampY[dampN] = cy;
            dampRX[dampN] = a.w * GAIN_RX * 0.5;
            dampRY[dampN] = a.h * GAIN_RY * 0.5;
            dampN++;
          }
          // A 'vfx' box is an effect's bounds, not a body: no gain, no spill,
          // only the glow below (see LightActor.kind).
          if (gainS && a.kind !== 'vfx') {
            const gw = a.w * GAIN_RX;
            const gh = a.h * GAIN_RY;
            ctx.globalCompositeOperation = 'color-dodge';
            ctx.globalAlpha = (GAIN_FLOOR + GAIN_LIFT * reach) / (GAIN_FLOOR + GAIN_LIFT);
            ctx.drawImage(gainS, cx - gw / 2, cy - gh / 2, gw, gh);
            ctx.globalCompositeOperation = 'lighter';
          }
          // 3b. The spill around the silhouette. Its geometry is deliberately
          // UNCHANGED: pushing it out onto the lit edge (push 0.62, a
          // 0.92 x 0.74 disc) was tried against the torso measurements and
          // rejected — it moves EMBER's torso from 25.4 % below L 35 to 47.4 %,
          // well past the reference frames' own 14-20 %, and buys TIDE only
          // 0.6 -> 5.1 % because TIDE's measured box is a white robe with a lit
          // orb in the middle of it, not a garment plane.
          if (a.kind !== 'vfx') {
            const rw = a.w * 1.15;
            const rh = a.h * 0.95;
            ctx.globalAlpha = RIM_FLOOR + RIM_LIFT * reach;
            ctx.drawImage(rimS, cx + dx * a.w * RIM_PUSH_X - rw / 2, cy + dy * a.h * RIM_PUSH_Y - rh / 2, rw, rh);
          }
          const glow = a.glow ?? 0;
          if (glow > 0) {
            // Anchored at the PROP, not at the actor's centre of mass.
            const at = a.glowAt;
            const gx = a.x + (at ? at.dx : GLOW_AT_DX) * a.w;
            const gy = a.y + (at ? at.dy : GLOW_AT_DY) * a.h;
            // The light it throws on the floor: wide, flat, at the feet, where
            // there is no sprite to wash out.
            const pr = a.w * (GLOW_POOL + glow * GLOW_POOL_GAIN);
            const ph = pr * GLOW_POOL_SQUASH;
            ctx.globalAlpha = GLOW_POOL_ALPHA * glow;
            ctx.drawImage(glowS, gx - pr, a.y + a.h - ph, pr * 2, ph * 2);
            // NO disc over the sprite. This pass runs AFTER the actors are
            // drawn, so anything additive laid at the prop lands on the
            // carrier's own garment pixels — and a prop is not always held
            // clear of the body: TIDE's orb sits at chest height, so even a
            // 16-px halo put the rig's lift on TIDE at +20 L against +9 on the
            // others and ate the plane the artist had authored under it. The
            // visible glow is the prop's OWN bright pixels coming back through
            // renderPost's bloom threshold, which spreads them into the air
            // around the prop without touching the pixels underneath.
            if (glowN < 16) {
              glowX[glowN] = gx;
              glowY[glowN] = gy;
              // Kept INSIDE the prop: the blob only has to guarantee that a
              // small flame reaches the threshold, and a radius wider than the
              // prop blooms the garment behind it back out again.
              glowR[glowN] = Math.min(a.w * GLOW_HALO, GLOW_BLOOM_MAX);
              glowA[glowN] = glow;
              glowN++;
            }
          }
        }
        ctx.restore();
      }

    },

    renderPost(ctx, frame) {
      const b = ensureBaked();
      if (!b || !look) return;
      const l = look;
      const flash = frame.flashAlpha ?? 0;
      ctx.save();

      // --- bloom (HIGH/MED only; LOW and ARCADE hand the glow to the CRT) ---
      if (tier === 'HIGH' || tier === 'MED') {
        const div = tier === 'HIGH' ? BLOOM_DIV_HIGH : BLOOM_DIV_MED;
        ensureBloom(div);
        const src = bloomACtx;
        const dst = bloomBCtx;
        // Sampling the frame back off the display canvas costs about 2 ms —
        // it forces the deferred display list to rasterise and hands the
        // pixels back to the CPU. The bloom source is a quarter-res, heavily
        // blurred signal that cannot change fast enough for a 30 Hz refresh to
        // be visible, so it is rebuilt on alternate frames and reused between.
        bloomPhase ^= 1;
        const refresh = bloomPhase === 0 || bloomStale;
        bloomStale = false;
        if (src && dst && bloomA && bloomB && refresh) {
          const canvas = ctx.canvas;
          // Downscale the finished world (UI has not been drawn yet, so the
          // bloom can never come from a text plate).
          src.setTransform(1, 0, 0, 1, 0, 0);
          src.globalCompositeOperation = 'copy';
          src.globalAlpha = 1;
          src.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, bloomW, bloomH);
          // Threshold without getImageData: multiplying the frame by itself
          // twice sends a mid grey to 1/8 of its value and leaves the highlights
          // where they are. Two extra quarter-res draws, no pixel readback.
          dst.setTransform(1, 0, 0, 1, 0, 0);
          dst.globalCompositeOperation = 'copy';
          dst.drawImage(bloomA, 0, 0);
          src.globalCompositeOperation = 'multiply';
          src.drawImage(bloomB, 0, 0);
          src.drawImage(bloomB, 0, 0);
          // Lit props are nudged back in so a small flame still catches even
          // when its pixels are not the brightest thing on screen — at the
          // PROP's own footprint. Centred on the sprite and sized to it, this
          // used to blow the whole carrier back over its own garment after the
          // upscale; the prop's bright pixels already survive the self-multiply
          // threshold above on their own, so this only has to guarantee them.
          if (glowN > 0) {
            const k = bloomW / W;
            src.setTransform(k, 0, 0, k, 0, 0);
            src.globalCompositeOperation = 'lighter';
            for (let i = 0; i < glowN; i++) {
              blob(src, l.key.color, glowX[i], glowY[i], glowR[i] * 0.7, glowR[i] * 0.7, 0.34 * glowA[i]);
            }
            src.setTransform(1, 0, 0, 1, 0, 0);
          }
          // Blur the small buffer, then upscale it over the frame.
          dst.globalCompositeOperation = 'copy';
          if (hasFilter(dst)) {
            dst.filter = `blur(${div === BLOOM_DIV_HIGH ? 4 : 2.5}px)`;
            dst.drawImage(bloomA, 0, 0);
            dst.filter = 'none';
          } else {
            dst.drawImage(bloomA, 0, 0);
            dst.globalCompositeOperation = 'source-over';
            dst.globalAlpha = 0.5;
            dst.drawImage(bloomA, -1, 0);
            dst.drawImage(bloomA, 1, 0);
            dst.drawImage(bloomA, 0, -1);
            dst.drawImage(bloomA, 0, 1);
            dst.globalAlpha = 1;
          }
          // Half of the upscale happens here, into a small buffer where
          // filtering is free; only the last x2 lands on the frame.
          if (bloomMid && bloomMidCtx) {
            bloomMidCtx.globalCompositeOperation = 'copy';
            bloomMidCtx.drawImage(bloomB, 0, 0, bloomW, bloomH, 0, 0, bloomMid.width, bloomMid.height);
            // ...and the actor plane's share of it comes straight back off
            // (see BLOOM_ACTOR_DAMP). One 'destination-out' ellipse per body
            // on the half-res buffer, from a sprite baked once: at most sixteen
            // draws over 640x360, no readback and no allocation. It runs inside
            // the refresh branch because that is where the buffer is written —
            // the bloom source is already an alternate-frame signal by design,
            // so the damp is exactly as fresh as the thing it damps.
            if (dampN > 0) {
              if (!dampSprite) dampSprite = bloomDampSprite();
              const k = bloomMid.width / W;
              bloomMidCtx.save();
              bloomMidCtx.globalCompositeOperation = 'destination-out';
              bloomMidCtx.globalAlpha = BLOOM_ACTOR_DAMP;
              for (let i = 0; i < dampN; i++) {
                const rx = dampRX[i] * k;
                const ry = dampRY[i] * k;
                bloomMidCtx.drawImage(dampSprite, dampX[i] * k - rx, dampY[i] * k - ry, rx * 2, ry * 2);
              }
              bloomMidCtx.restore();
            }
          }
        }
        if (bloomB && bloomMid && bloomMidCtx) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(1, BLOOM_ALPHA * (1 + flash));
          // The last x2 runs NEAREST: on a blurred source the steps are
          // invisible and it costs a third of a filtered blow-up.
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bloomMid, 0, 0, bloomMid.width, bloomMid.height, 0, 0, W, H);
          ctx.imageSmoothingEnabled = true;
          ctx.globalAlpha = 1;
        }
      }

      // --- grade: one multiply that carries the vignette, one screen lift ---
      //     Both are baked bitmaps blitted 1:1. A full-screen gradient fillRect
      //     is three times the cost of the same pixels as an image.
      if (b.gradeMap) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = 1;
        ctx.drawImage(b.gradeMap, 0, 0);
      }

      // --- the sky body, re-applied as a light (see SkyLight) --------------
      //     AFTER the grade, additively, so the one object the frame calls its
      //     brightest keeps a core and a falloff through both the grade's
      //     multiply and whatever terminal dim the caller paints next.
      //
      //     IT IS DRAWN IN THE FAR PLANE'S SPACE, NOT IN SCREEN SPACE. `sky.x`
      //     / `sky.y` are the coordinates the biome's FAR painter paints the
      //     body at, and that painter is rasterised through `bakePlane`'s pad
      //     scale (`padScale`, 1.1111 on a 1280x720 frame, about the frame
      //     centre) and then blitted by `drawPlane` at `-PLANE_PAD` plus the
      //     far plane's own parallax lag and sway. Drawn at raw (sky.x, sky.y)
      //     the sprite landed +49 x / +26 y off its own body and the marsh and
      //     ruins showed TWO overlapping discs at every tier — a rendering bug,
      //     not a light. Position AND size go through the same transform, and
      //     the offset follows `drawPlane`'s exactly (same rounding, same
      //     `sway * 0.3`) so the body cannot detach during a camera shake —
      //     which is precisely when GAME_OVER is drawn. The flat tiers (LOW /
      //     ARCADE) blit their one merged plane at exactly `-PLANE_PAD` with no
      //     parallax and no sway, so there the offset term is zero.
      const sky = l.sky;
      if (sky && b.skySprite) {
        const sway = Math.sin((frame.time ?? 0) * SWAY_RATE) * SWAY_PX;
        const ox = b.flat ? -PLANE_PAD : Math.round(-PLANE_PAD - (1 - DEPTH_FAR) * shakeX + sway * 0.3);
        const oy = b.flat ? -PLANE_PAD : Math.round(-PLANE_PAD - (1 - DEPTH_FAR) * shakeY);
        const ps = padScale(W, H);
        const cx = ox + PLANE_PAD + W / 2 + ps * (sky.x - W / 2);
        const cy = oy + PLANE_PAD + H / 2 + ps * (sky.y - H / 2);
        const s = b.skySprite;
        const dw = s.width * ps;
        const dh = s.height * ps;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = sky.alpha;
        ctx.drawImage(s, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.globalAlpha = 1;
      }

      // save/restore is the whole contract here: composite op, alpha, fill and
      // smoothing all go back to what the caller had (see crt.ts).
      ctx.restore();
    },

    drawContactShadow(ctx, x, y, w) {
      // Hard-edged, not a soft blob: a sprite standing on a soft smudge floats.
      // Outer ellipse at 0.8x the foot span, an inner core over the middle 60 %
      // that thickens the density right under the feet.
      //
      // The two alphas came DOWN (0.46/0.50 -> 0.34/0.30) when the additive
      // wash moved off the actor plane, and it is the same edit, not a second
      // one. This is drawn between renderBackground and renderLightPlane, so it
      // used to land on an UNLIT floor and then take the whole light map on top
      // of it; now the floor beneath it is already lit and nothing lifts it
      // afterwards. At the old numbers the same ellipse fell from about L 33 to
      // L 19 and read as a black sticker under every actor. These land it back
      // at L 29-30 — a shade heavier than it used to read, which is the right
      // side to err on for contact.
      //
      // ROUND 5 ADDS THE CAST LOBE. The two ellipses below are CONTACT — they
      // say the feet touch the floor, and they reach about five px past them.
      // On round 4's floor that is no longer the whole job: the ground the
      // actors stand on now carries L 36-44 inside the pools, and the review's
      // in-scene ruler is the actor's median against that ground. A figure lit
      // from upper left throws a shadow down and to the RIGHT, and in
      // `octopath-4` those cast shadows are the darkest marks on the sand. So a
      // third, softer, longer lobe leans away from the key, at two thirds of
      // the contact alpha and falling to nothing. One more ellipse per actor,
      // drawn on the floor and never on a sprite, and invisible to the
      // actorless backdrop captures, which never call this.
      const rx = w * 0.4;
      const ry = Math.max(2, rx * 0.2);
      ctx.save();
      // Round 6 lengthens it. The foot pools came up hard this round — the
      // ground inside each cluster went from p50 21.7-38.7 to 43.7-59.4 — and
      // on a floor that bright a five-px smear under the boots is not a
      // shadow. The lobe now reaches about 40 px past the feet, which is where
      // the review's second ground strip is measured and where a figure lit
      // from a hole in the ceiling actually throws one.
      const lx = x + rx * 0.62;
      const ly = y + ry * 3.4;
      const lr = rx * 3.0;
      ctx.save();
      ctx.globalAlpha = SHADOW_CAST_ALPHA;
      ctx.translate(lx, ly);
      ctx.scale(1, SHADOW_CAST_SQUASH);
      // The shared cache, so a per-actor cast shadow is a Map lookup and not a
      // gradient construction: nothing here allocates per frame.
      ctx.fillStyle = radial(ctx, SHADOW_INK, lr);
      ctx.fillRect(-lr, -lr, lr * 2, lr * 2);
      ctx.restore();
      ctx.fillStyle = SHADOW_INK;
      ctx.globalAlpha = 0.34;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.30;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, rx * 0.6, Math.max(1.5, ry * 0.78), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    note(frameMs) {
      if (dropped) return;
      if (frameMs > SLOW_FRAME_MS) {
        slowRun++;
        if (slowRun >= SLOW_FRAME_LIMIT) {
          dropped = true;
          if (tier === 'HIGH' || tier === 'MED') {
            tier = 'LOW';
            baked = null;
          }
        }
      } else {
        slowRun = 0;
      }
    },
  };
}
