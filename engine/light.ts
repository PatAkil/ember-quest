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
//   light.renderBackground(ctx, { time, shakeX, shakeY });   // far · mid · floor
//   drawActor(...) / light.drawContactShadow(...)            // the sharp plane
//   light.renderLightPlane(ctx, { time, actors });           // near · key · rim · dust
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

/** A radial light source: colour, centre and reach, in logical px. */
export interface KeyLight {
  color: string;
  x: number;
  y: number;
  radius: number;
  /** Peak alpha at the centre, composited 'lighter' (0.10-0.30 is the useful band). */
  alpha: number;
}

/** The pool of light on the stage floor where the actors stand — a squashed radial. */
export interface PoolLight {
  color: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
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

/** Slow horizontal fog banks drifting across the stage, composited 'lighter'. */
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
  /** Passes 1-2: far, mid and floor planes at their parallax offsets. */
  renderBackground(ctx: CanvasRenderingContext2D, frame: BackgroundFrame): void;
  /** Pass 4: the near plane over the actors, then key, fill, pool, rim, fog, dust. */
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
 * Depth of each plane: 1 = locked to the actor plane, 0 = infinitely far. The
 * offset applied is -(1 - depth) x shake, which makes a far plane LAG the
 * camera — the parallax that turns four flat layers into a diorama.
 */
const DEPTH_FAR = 0.3;
const DEPTH_MID = 0.62;
const DEPTH_FLOOR = 0.9;
const DEPTH_NEAR = 1.35;

/** Bake-time blur radius per plane, in logical px. The actor plane gets none. */
const BLUR_FAR = 6;
const BLUR_MID = 2.6;
const BLUR_FLOOR = 1.25;
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
 */
const RIM_FLOOR = 0.10;
const RIM_LIFT = 0.14;
const RIM_REF = 0.24;
/** How far along the light direction the spill is pushed, as fractions of the box. */
const RIM_PUSH_X = 0.3;
const RIM_PUSH_Y = 0.22;

/**
 * The lit prop. Two pieces, and neither of them is a disc over the torso:
 *
 *  - a TIGHT halo at the prop itself (radius `GLOW_HALO` + `GLOW_HALO_GAIN`
 *    x glow, as a fraction of the actor's width — about 20 px on a 128-px
 *    hero), so the flame or orb sits in its own bloom;
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
const GLOW_HALO_GAIN = 0.07;
const GLOW_HALO_ALPHA = 0.34;
const GLOW_POOL = 0.5;
const GLOW_POOL_GAIN = 0.34;
const GLOW_POOL_ALPHA = 0.2;
const GLOW_POOL_SQUASH = 0.24;

/** Contact shadows are ink, not tint: one colour, hard edge, every biome. */
const SHADOW_INK = '#05060b';

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
  const s = Math.max(w / width, h / height);
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
  /**
   * Key, fill and both floor pools flattened to four parallel arrays — centre,
   * elliptical reach and peak alpha. renderLightPlane walks them per actor to
   * find the NEAREST source, which is what decides how hard that actor's rim
   * spills and which way it leans. Built once; the loop reads, never writes.
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
  const s = Math.max(w / width, h / height);
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
    srcX: [],
    srcY: [],
    srcRX: [],
    srcRY: [],
    srcW: [],
  };
  pushSource(baked, look.key.x, look.key.y, look.key.radius, look.key.radius, look.key.alpha);
  pushSource(baked, look.fill.x, look.fill.y, look.fill.radius, look.fill.radius, look.fill.alpha);
  pushSource(baked, look.pool.x, look.pool.y, look.pool.rx, look.pool.ry, look.pool.alpha);
  if (look.pool2) {
    pushSource(baked, look.pool2.x, look.pool2.y, look.pool2.rx, look.pool2.ry, look.pool2.alpha);
  }
  baked.gradeMap = bakeGradeMap(look, width, height, low);
  if (low) {
    baked.flat = bakeFlat(look, width, height);
    return baked;
  }
  baked.lightMap = bakeLightMap(look, width, height, !med);
  baked.rimSprite = softSprite(look.rim, 96);
  baked.glowSprite = softSprite(look.key.color, 96);
  baked.far = bakePlane(look.far, width, height, BLUR_FAR, '#000000');
  if (med) {
    // MED folds mid and floor into one plane: one fewer full-screen draw, and
    // the floor's parallax difference is invisible next to a phone's shake.
    baked.mid = bakePlane(
      (c, w, h) => {
        look.mid(c, w, h);
        look.floor(c, w, h);
      },
      width,
      height,
      BLUR_MED_BACK,
    );
  } else {
    baked.mid = bakePlane(look.mid, width, height, BLUR_MID);
    baked.floor = bakePlane(look.floor, width, height, BLUR_FLOOR);
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
      const sway = Math.sin(frame.time * SWAY_RATE) * SWAY_PX;
      if (b.flat) {
        // LOW / ARCADE: one opaque draw, key light and grade already in it.
        ctx.drawImage(b.flat, -PLANE_PAD, -PLANE_PAD);
        return;
      }
      drawPlane(ctx, b.far, DEPTH_FAR, sway * 0.3);
      drawPlane(ctx, b.mid, DEPTH_MID, sway * 0.7);
      drawPlane(ctx, b.floor, DEPTH_FLOOR, sway);
    },

    renderLightPlane(ctx, frame) {
      glowN = 0;
      const b = ensureBaked();
      if (!b || !look || b.flat) return; // LOW has no light plane at all.
      const l = look;
      const dt = lastTime < 0 ? 0 : Math.max(0, Math.min(0.1, frame.time - lastTime));
      lastTime = frame.time;

      // 1. The foreground plane, over the actors, leading the camera.
      drawPlane(ctx, b.near, DEPTH_NEAR, Math.sin(frame.time * SWAY_RATE) * SWAY_PX * 1.4);

      // 2. The whole light rig in one 1:1 additive blit — key, fill, floor pool
      //    and shafts, baked. It breathes on ALPHA only, never on geometry, so
      //    the bitmap stays valid for the life of the biome.
      if (b.lightMap) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.94 + 0.06 * Math.sin(frame.time * 0.6);
        ctx.drawImage(b.lightMap, 0, 0);
        ctx.restore();
      }

      // 3. Rim light and prop glow, per actor. The crisp per-pixel rim is baked
      //    into the sprite by the actor pipeline; this is the spill around it —
      //    the part the bloom is supposed to catch.
      const actors = frame.actors;
      if (actors && actors.length && b.rimSprite && b.glowSprite) {
        const rimS = b.rimSprite;
        const glowS = b.glowSprite;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const srcN = b.srcX.length;
        for (let i = 0; i < actors.length; i++) {
          const a = actors[i];
          const cx = a.x + a.w / 2;
          const cy = a.y + a.h * 0.42;
          // Which light is actually on this actor? A single centred pool peaks
          // where nobody stands, so a flat rim alpha left one whole half of the
          // stage diagonal reading as unlit. Walk the sources, keep the
          // strongest at this point, and drive BOTH the spill's strength and
          // its lean off it — blended halfway back toward the key, because the
          // sprites' own baked rim is upper-left in every biome and the spill
          // must not fight it.
          let best = 0;
          let bx = 0;
          let by = 0;
          for (let s = 0; s < srcN; s++) {
            const ox = b.srcX[s] - cx;
            const oy = b.srcY[s] - cy;
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
          // The spill around the silhouette. Its geometry is deliberately
          // UNCHANGED: pushing it out onto the lit edge (push 0.62, a
          // 0.92 x 0.74 disc) was tried against the torso measurements and
          // rejected — it moves EMBER's torso from 25.4 % below L 35 to 47.4 %,
          // well past the reference frames' own 14-20 %, and buys TIDE only
          // 0.6 -> 5.1 % because TIDE's measured box is a white robe with a lit
          // orb in the middle of it, not a garment plane.
          const rw = a.w * 1.15;
          const rh = a.h * 0.95;
          ctx.globalAlpha = RIM_FLOOR + RIM_LIFT * Math.min(1, best / RIM_REF);
          ctx.drawImage(rimS, cx + dx * a.w * RIM_PUSH_X - rw / 2, cy + dy * a.h * RIM_PUSH_Y - rh / 2, rw, rh);
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
            // The prop's own halo: small enough that its falloff is spent
            // before it reaches the chest.
            const hr = a.w * (GLOW_HALO + glow * GLOW_HALO_GAIN);
            ctx.globalAlpha = GLOW_HALO_ALPHA * glow;
            ctx.drawImage(glowS, gx - hr, gy - hr, hr * 2, hr * 2);
            if (glowN < 16) {
              glowX[glowN] = gx;
              glowY[glowN] = gy;
              glowR[glowN] = hr;
              glowA[glowN] = glow;
              glowN++;
            }
          }
        }
        ctx.restore();
      }

      // 4. Fog: the same strip twice, drifting in opposite directions.
      if (b.fogBand && l.fog.alpha > 0) {
        const band = b.fogBand;
        ctx.save();
        for (let i = 0; i < l.fog.bands; i++) {
          const dir = i % 2 === 0 ? 1 : -1;
          const span = band.width;
          let x = ((frame.time * l.fog.speed * dir * (0.6 + i * 0.35)) % span) - span * 0.25;
          if (x > 0) x -= span;
          const y = l.fog.y + i * l.fog.height * 0.42;
          ctx.globalAlpha = l.fog.alpha * (1 - i * 0.22);
          ctx.drawImage(band, Math.round(x), Math.round(y));
          // The wrap copy only when the first one leaves a gap on the right.
          if (x + span < W) ctx.drawImage(band, Math.round(x + span), Math.round(y));
        }
        ctx.restore();
      }

      // 5. Dust in the beam. Seeded, pooled, additive; the y wrap keeps the
      //    field inside the stage instead of raining on the ribbon.
      if (b.moteSprite && b.motes.length) {
        const m = l.motes;
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

      // save/restore is the whole contract here: composite op, alpha, fill and
      // smoothing all go back to what the caller had (see crt.ts).
      ctx.restore();
    },

    drawContactShadow(ctx, x, y, w) {
      // Hard-edged, not a soft blob: a sprite standing on a soft smudge floats.
      // Outer ellipse at 0.8x the foot span and 40% alpha, an inner core over
      // the middle 60% that doubles the density right under the feet.
      const rx = w * 0.4;
      const ry = Math.max(2, rx * 0.2);
      ctx.save();
      ctx.fillStyle = SHADOW_INK;
      ctx.globalAlpha = 0.46;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
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
