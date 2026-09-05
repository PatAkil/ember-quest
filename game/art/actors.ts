// Ember Quest v3 — game/art/actors.ts
//
// Composes game/art/parts.ts's material grids into full character and enemy
// recipes, resolves every (material, shade) pair through the recipe's own
// palette, bakes a pose to an offscreen bitmap once per (recipe, pose,
// frame, element), and draws that bitmap with ONE drawImage per actor per
// frame (DESIGN.md → Presentation → Layered actors). `ACTOR_RECIPES` is
// looked up by plain string id — the six heroes' and every enemy's id in
// game/data/enemies.ts — so this module never imports ../data/* (art stays a
// leaf; sim and data stay ignorant of it).
//
// COLOUR (v3.2, the Octopath Traveler pass). A part names a material and a
// shade; this module owns what those mean. Every material is a FOUR-SHADE
// ramp with a hue shift — shadows cooler and darker (toward violet and
// navy), highlights warmer and lighter (toward cream), midtones
// desaturated, nothing pure black. A recipe picks its garment ramp from its
// ELEMENT (fire crimson, wind green, water teal, light gold, dark plum) and
// overrides the handful of materials that make it that character — EMBER's
// ember hair, TIDE's pale robe over teal, LUMEN's cream-gold — while the
// neutral secondaries (leather, iron, linen, bone) are shared, which is what
// keeps six heroes standing together as one palette.
//
// Composition model: a recipe is a z-ordered list of layers, each placing a
// part at a literal (x, y) or anchored to an already-placed layer's named
// anchor. Placing an anchored layer solves "where must MY OWN same-named
// anchor land so it coincides with the target" — that solve is what keeps a
// weapon in a hand (and a head on a neck, a cloak on a shoulder) across
// every pose keyframe, rotations included. Rotation is a multiple of 90
// degrees applied to the PART'S PIXEL GRID (rotateSprite90), never a canvas
// transform, so a swung blade stays exactly as hard-edged as everything else.

import { bakeSprite, drawBaked, frameIndex } from '../../engine';
import type { PixelCanvas, Sprite } from '../../engine';
import type { Element } from '../types';
import { MATERIALS, MAT_EMPTY, MAT_INK, PART_LIBRARY } from './parts';
import type { AnchorName, Material, PartId, Point, Ramp } from './parts';
import { renderVfx, spawnVfx, updateVfx } from './vfx';
import type { VfxInstance } from './vfx';

// --- Presentation constants (DESIGN.md → Presentation → Canvas and scale) -----

export const ACTOR_PART = 64;
export const BOSS_PART = 96;
export const ACTOR_SCALE = 3;
/** Derived, not re-authored, so the two numbers can never drift apart. */
export const ACTOR_W = ACTOR_PART * ACTOR_SCALE;
export const BOSS_W = BOSS_PART * ACTOR_SCALE;
export const POSE_FPS = 12;

/** The ground line every hero, normal and elite stands on inside the 64-cell canvas, and its boss-canvas twin. */
const GROUND_Y = 57;
const BOSS_GROUND_Y = 92;
const CENTRE_X = ACTOR_PART / 2;
const BOSS_CENTRE_X = BOSS_PART / 2;

export type PoseName = 'idle' | 'attack' | 'hurt' | 'cast' | 'dead';

/** Frame count per pose — idle's 2-4 is DESIGN.md's own range; the rest are sized to their named beats (attack: wind-up / strike / recover). */
export const POSE_FRAMES: Record<PoseName, number> = { idle: 3, attack: 3, hurt: 2, cast: 3, dead: 2 };

// --- Recipe shape -------------------------------------------------------------

/** Attach this layer's own same-named anchor to the point already resolved for an earlier layer (by its index in `ActorRecipe.layers`). */
export interface AnchorRef {
  of: number;
  anchor: AnchorName;
}

export interface LayerDef {
  part: PartId;
  /** A literal top-left placement, or an anchor attachment to an earlier layer. */
  at: Point | AnchorRef;
  /** Paint order, ascending; ties keep array order. */
  z: number;
  /** A static nudge applied after the anchor solve — how a bow rides higher in the hand than its own grip row implies. */
  off?: Point;
}

export interface LayerKeyframe {
  dx?: number;
  dy?: number;
  /** Degrees, always a multiple of 90 — rotation happens on the pixel grid (rotateSprite90), never a canvas transform, so it stays hard-edged. */
  rot?: 0 | 90 | 180 | 270;
}

export interface ActorRecipe {
  id: string;
  /** The actor's native element — what its accent and glow ramps become when a caller doesn't override it. */
  element: Element;
  /** Part-resolution canvas size: ACTOR_PART for a hero/normal/elite, BOSS_PART for a boss. */
  res: number;
  layers: LayerDef[];
  /** Per pose, per layer (parallel to `layers`): that layer's keyframes for the pose. A single-entry array holds for every frame. */
  rigs: Record<PoseName, LayerKeyframe[][]>;
  /** Canonical ground-contact point (recipe-space, frame-independent) — drawBaked's origin. */
  feet: Point;
  /** Canonical centre-mass point, for actorHitRect. */
  hit: Point;
  /** Hurtbox size in cell units (pre-scale). */
  hitSize: { w: number; h: number };
  /** Material ramps that make this character this character; everything unnamed falls back to the neutral set and the element's accent/glow. */
  palette?: Partial<Record<Material, Ramp>>;
}

export interface ActorDrawState {
  pose: PoseName;
  time: number;
  element: Element;
  facing: 1 | -1;
  x: number;
  y: number;
}

// --- Palette ------------------------------------------------------------------
// Four shades per material, darkest → lightest, hue-shifted: the dark end
// cools toward navy or violet, the light end warms toward cream. Midtones
// are deliberately desaturated — the saturated end of a ramp is a highlight,
// never a fill.

/** The one colour outside every ramp: hand-placed feature ink (eyes, a visor slit, a belt seam). Dark navy, never black. */
const INK = '#141126';

type Palette = Record<Material, Ramp>;

const NEUTRAL: Palette = {
  skin: ['#2e1a2a', '#8a5546', '#c99476', '#f2d5ae'],
  hair: ['#1a1526', '#453a52', '#6f6274', '#a89aa4'],
  cloth: ['#161a2e', '#46506f', '#78829f', '#bcc3d6'],
  cloth2: ['#1e1428', '#5a3f60', '#8c6b8a', '#c6aac0'],
  leather: ['#160f1a', '#493226', '#7a5539', '#ab8156'],
  metal: ['#12162a', '#3e4661', '#727e9c', '#bcc6da'],
  accent: ['#260c16', '#7c2530', '#c4463a', '#ef8a52'],
  glow: ['#7a2410', '#d4621c', '#f8ab3e', '#ffeaa8'],
  bone: ['#1c1a2e', '#57536e', '#928da2', '#ded9e2'],
};

const ELEMENT_RAMPS: Record<Element, { accent: Ramp; glow: Ramp }> = {
  FIRE: { accent: ['#260c16', '#7c2530', '#c4463a', '#ef8a52'], glow: ['#7a2410', '#d4621c', '#f8ab3e', '#ffeaa8'] },
  WIND: { accent: ['#0d1c13', '#2f5c39', '#5c9455', '#a0cf7e'], glow: ['#2c4a1e', '#6ba24e', '#b9e07c', '#f2ffd2'] },
  WATER: { accent: ['#0a1526', '#22476a', '#3f80a6', '#84c6d6'], glow: ['#123c4c', '#2f8ca8', '#82d9e6', '#e2ffff'] },
  LIGHT: { accent: ['#241a0c', '#7d5c24', '#c69c40', '#f6de94'], glow: ['#7c5c1c', '#dab24a', '#f9e89c', '#fffce2'] },
  DARK: { accent: ['#100a18', '#3c2249', '#66397c', '#9c6ab2'], glow: ['#3c1442', '#7c2c82', '#c264c2', '#f2b2ea'] },
};

// Named ramps reused across recipes, so the roster reads as one palette
// rather than nineteen unrelated colour choices.
const EMBER_HAIR: Ramp = ['#280c0a', '#8a3316', '#cf6529', '#f7a24a'];
const GOLD_HAIR: Ramp = ['#2e2210', '#907230', '#d2ad5c', '#f7e6ae'];
const FLAX_HAIR: Ramp = ['#232310', '#77762e', '#b3b055', '#e6dd93'];
const DARK_HAIR: Ramp = ['#101020', '#332f45', '#524d66', '#7d7690'];
const PALE_ROBE: Ramp = ['#151d33', '#465f86', '#7d9dbd', '#c9e0ea'];
const DEEP_TEAL: Ramp = ['#05171c', '#1b4a52', '#2f7078', '#63a3a4'];
const LINEN: Ramp = ['#241f14', '#6d6047', '#a89474', '#e3d3ae'];
const OLIVE: Ramp = ['#121a12', '#3f4d38', '#6d7b5e', '#a7b48e'];
const WHITE_CLOTH: Ramp = ['#1c1e2e', '#5b5e78', '#9298ac', '#eceff5'];
const BLOOD_TABARD: Ramp = ['#1c0810', '#6b1f26', '#a83a34', '#d97a52'];
const ASH_HIDE: Ramp = ['#14141e', '#40404e', '#6d6d7a', '#a5a5b0'];
const MOSS: Ramp = ['#101a10', '#3a5232', '#5f7d48', '#95af6c'];
const SILT: Ramp = ['#181209', '#54452a', '#867049', '#bda173'];
const DUSK_CLOTH: Ramp = ['#11101c', '#393850', '#5d5c78', '#8d8ca6'];

const paletteCache = new Map<string, Palette>();
function paletteFor(recipe: ActorRecipe, element: Element): Palette {
  const key = `${recipe.id}|${element}`;
  let p = paletteCache.get(key);
  if (!p) {
    p = { ...NEUTRAL, accent: ELEMENT_RAMPS[element].accent, glow: ELEMENT_RAMPS[element].glow, ...(recipe.palette ?? {}) };
    paletteCache.set(key, p);
  }
  return p;
}

// --- Part → Sprite ------------------------------------------------------------
// A PartDef holds materials and shades; a Sprite holds colours. Resolving
// one against a palette is the only place a hex string enters the pipeline,
// and it happens once per (part, recipe, element) at bake time.

const partSpriteCache = new Map<string, Sprite>();
function partSprite(id: PartId, recipe: ActorRecipe, element: Element): Sprite {
  const key = `${id}|${recipe.id}|${element}`;
  let s = partSpriteCache.get(key);
  if (!s) {
    const p = PART_LIBRARY[id];
    const pal = paletteFor(recipe, element);
    const pixels: (string | null)[] = new Array(p.w * p.h).fill(null);
    for (let i = 0; i < pixels.length; i++) {
      const m = p.mat[i];
      if (m === MAT_EMPTY) continue;
      pixels[i] = m === MAT_INK ? INK : pal[MATERIALS[m]][p.shade[i]];
    }
    s = { w: p.w, h: p.h, pixels };
    partSpriteCache.set(key, s);
  }
  return s;
}

// --- Local primitive: 90-degree Sprite rotation -------------------------------
// The engine has no Sprite-level rotation (drawBaked's `rotation` is a
// canvas-space transform at DRAW time); the actor bake needs an exact,
// anchor-preserving rotation at COMPOSE time, so it lives here as an integer
// pixel-grid remap.

function rotatePoint90(p: Point, steps: number, w: number, h: number): Point {
  let x = p.x;
  let y = p.y;
  let cw = w;
  let ch = h;
  for (let i = 0; i < steps; i++) {
    const nx = ch - 1 - y;
    const ny = x;
    x = nx;
    y = ny;
    const t = cw;
    cw = ch;
    ch = t;
  }
  return { x, y };
}

function rotateSprite90(sprite: Sprite, steps: number): Sprite {
  let cur = sprite;
  for (let s = 0; s < steps; s++) {
    const { w, h, pixels } = cur;
    const nw = h;
    const nh = w;
    const out: (string | null)[] = new Array(nw * nh).fill(null);
    for (let y = 0; y < h; y++) {
      const rowBase = y * w;
      for (let x = 0; x < w; x++) {
        const c = pixels[rowBase + x];
        if (c === null) continue;
        out[x * nw + (h - 1 - y)] = c;
      }
    }
    cur = { w: nw, h: nh, pixels: out };
  }
  return cur;
}

// --- Composition --------------------------------------------------------------

const ANCHOR_NAMES: readonly AnchorName[] = ['hand', 'head', 'weaponGrip', 'capePin', 'feet', 'hit'];

interface ResolvedLayer {
  sprite: Sprite;
  x: number;
  y: number;
  anchors: Partial<Record<AnchorName, Point>>;
}

function rotationSteps(rot: number | undefined): number {
  return ((Math.round((rot ?? 0) / 90) % 4) + 4) % 4;
}

/**
 * Build the composed pixel grid for one (recipe, pose, frame, element) —
 * bake time only, never the per-frame draw path. Layers are RESOLVED in
 * array order (an anchored layer may only reference an earlier index) and
 * PAINTED in `z` order, so a cloak can hang behind the body it was placed
 * off. Each part carries its own dark rim, so overlapping layers separate
 * without any global keyline pass.
 */
function composePose(recipe: ActorRecipe, pose: PoseName, frame: number, element: Element): Sprite {
  const res = recipe.res;
  const pixels: (string | null)[] = new Array(res * res).fill(null);
  const resolved: ResolvedLayer[] = [];

  for (let i = 0; i < recipe.layers.length; i++) {
    const layer = recipe.layers[i];
    const kfList = recipe.rigs[pose][i];
    const kf = kfList[frame % kfList.length] ?? {};
    const steps = rotationSteps(kf.rot);
    const base = partSprite(layer.part, recipe, element);
    const sprite = steps === 0 ? base : rotateSprite90(base, steps);
    const partAnchors = PART_LIBRARY[layer.part].anchors;

    let left: number;
    let top: number;
    if ('of' in layer.at) {
      const parent = resolved[layer.at.of];
      const target = parent.anchors[layer.at.anchor] ?? { x: parent.x, y: parent.y };
      const localRaw = partAnchors[layer.at.anchor] ?? { x: 0, y: 0 };
      const local = steps === 0 ? localRaw : rotatePoint90(localRaw, steps, base.w, base.h);
      left = target.x - local.x + (kf.dx ?? 0);
      top = target.y - local.y + (kf.dy ?? 0);
    } else {
      left = layer.at.x + (kf.dx ?? 0);
      top = layer.at.y + (kf.dy ?? 0);
    }
    left += layer.off?.x ?? 0;
    top += layer.off?.y ?? 0;

    const anchors: Partial<Record<AnchorName, Point>> = {};
    for (const name of ANCHOR_NAMES) {
      const a = partAnchors[name];
      if (!a) continue;
      const ra = steps === 0 ? a : rotatePoint90(a, steps, base.w, base.h);
      anchors[name] = { x: left + ra.x, y: top + ra.y };
    }
    resolved.push({ sprite, x: left, y: top, anchors });
  }

  const order = recipe.layers.map((_, i) => i).sort((a, b) => recipe.layers[a].z - recipe.layers[b].z);
  for (const i of order) {
    const { sprite, x, y } = resolved[i];
    for (let sy = 0; sy < sprite.h; sy++) {
      const py = y + sy;
      if (py < 0 || py >= res) continue;
      const destRow = py * res;
      const srcRow = sy * sprite.w;
      for (let sx = 0; sx < sprite.w; sx++) {
        const c = sprite.pixels[srcRow + sx];
        if (c === null) continue;
        const px = x + sx;
        if (px < 0 || px >= res) continue;
        pixels[destRow + px] = c;
      }
    }
  }
  return { w: res, h: res, pixels };
}

// --- Baking and drawing -------------------------------------------------------

// Baked bitmaps are indexed by NUMBER, not by a composed key string: the
// draw path runs once per actor per frame, and a template literal there
// would allocate on every one of them. A Map keyed by the recipe object
// plus one integer index costs nothing per frame.
const POSE_INDEX: Record<PoseName, number> = { idle: 0, attack: 1, hurt: 2, cast: 3, dead: 4 };
const ELEMENT_INDEX: Record<Element, number> = { FIRE: 0, WIND: 1, WATER: 2, LIGHT: 3, DARK: 4 };
const MAX_FRAMES = 4; // the largest POSE_FRAMES entry the pipeline allows
const SLOTS = 5 * MAX_FRAMES * 5;
const poseBitmaps = new Map<ActorRecipe, (HTMLCanvasElement | undefined)[]>();
let bakedCount = 0;

/** Composes and bakes a pose the first time it is asked for; every later call for the same (recipe, pose, frame, element) is a cache hit. */
export function bakePose(recipe: ActorRecipe, pose: PoseName, frame: number, element: Element): HTMLCanvasElement {
  let slots = poseBitmaps.get(recipe);
  if (!slots) {
    slots = new Array<HTMLCanvasElement | undefined>(SLOTS);
    poseBitmaps.set(recipe, slots);
  }
  const i = (POSE_INDEX[pose] * MAX_FRAMES + (frame % MAX_FRAMES)) * 5 + ELEMENT_INDEX[element];
  let bmp = slots[i];
  if (!bmp) {
    bmp = bakeSprite(composePose(recipe, pose, frame, element), 1);
    slots[i] = bmp;
    bakedCount++;
  }
  return bmp;
}

/** Diagnostic only (the verification tooling): how many distinct (recipe, pose, frame, element) bitmaps have been baked. */
export function bakedPoseCount(): number {
  return bakedCount;
}

/** A 'dead' pose sinks AND fades — the sink is ordinary dy keyframes; the fade is applied here, since a baked Sprite has no per-pixel alpha. */
const DEAD_ALPHA: readonly number[] = [0.8, 0.45];

// A single reused options record: drawBaked reads it synchronously and keeps
// no reference, so mutating and re-passing one object allocates nothing in
// the per-actor-per-frame hot path.
const drawOpts: { scale: number; flipX: boolean; originX: number; originY: number; alpha: number } = {
  scale: ACTOR_SCALE,
  flipX: false,
  originX: 0,
  originY: 0,
  alpha: 1,
};

/** One drawImage per actor per frame: look up (or bake) the pose bitmap, then draw it hard-pixelled at ACTOR_SCALE, anchored at the feet. */
export function drawActor(ctx: CanvasRenderingContext2D, recipe: ActorRecipe, state: ActorDrawState): void {
  const frame = frameIndex(state.time, POSE_FPS, POSE_FRAMES[state.pose]);
  const bitmap = bakePose(recipe, state.pose, frame, state.element);
  drawOpts.flipX = state.facing === -1;
  drawOpts.originX = recipe.feet.x;
  drawOpts.originY = recipe.feet.y;
  drawOpts.alpha = state.pose === 'dead' ? (DEAD_ALPHA[frame] ?? 1) : 1;
  drawBaked(ctx, bitmap, state.x, state.y, drawOpts);
}

/** The hurtbox for pops and targeting cursors: a fixed-size rect centred on the recipe's `hit` point, in the same logical-px space as the (x, y) passed to drawActor. */
export function actorHitRect(recipe: ActorRecipe, x: number, y: number): { x: number; y: number; w: number; h: number } {
  const dx = (recipe.hit.x - recipe.feet.x) * ACTOR_SCALE;
  const dy = (recipe.hit.y - recipe.feet.y) * ACTOR_SCALE;
  const w = recipe.hitSize.w * ACTOR_SCALE;
  const h = recipe.hitSize.h * ACTOR_SCALE;
  return { x: x + dx - w / 2, y: y + dy - h / 2, w, h };
}

// --- Rig generator ------------------------------------------------------------
// Every recipe shares the same five-pose shape; what differs is which layer
// is the weapon that swings and which (if any) is a cloth layer that sways
// on its own beat. Every other layer moves IN LOCKSTEP, which is what keeps
// a literally-placed accessory (a crown, a halo, a sheathed blade) glued to
// its neighbour without needing an anchor of its own.
//
// Amplitudes are read at ×3: a one-cell breath is three screen pixels, which
// is the whole of an idle; the attack is where the travel lives.

function buildRig(layerCount: number, weaponIdx?: number, capeIdx?: number, thrust = false): Record<PoseName, LayerKeyframe[][]> {
  const idle: LayerKeyframe[][] = [];
  const attack: LayerKeyframe[][] = [];
  const cast: LayerKeyframe[][] = [];
  const hurt: LayerKeyframe[][] = [];
  const dead: LayerKeyframe[][] = [];
  for (let i = 0; i < layerCount; i++) {
    const isWeapon = i === weaponIdx;
    const isCape = i === capeIdx;
    idle.push(isCape ? [{ dx: 0 }, { dx: 2, dy: 1 }, { dx: 1, dy: 0 }] : [{ dy: 0 }, { dy: -1 }, { dy: 0 }]);
    // A weapon SHORTER than its bearer swings through 90-degree steps; one
    // taller than the canvas is wide (a staff, a bow) is planted and driven
    // forward instead — a horizontal 52-cell staff would run off the bake.
    if (isWeapon && thrust) attack.push([{ dy: -3 }, { dx: 9, dy: -1 }, { dx: 2 }]);
    else if (isWeapon) attack.push([{ rot: 270, dx: -2 }, { rot: 90, dx: 4, dy: -2 }, { rot: 0 }]); // wind-up, the swing travels, recover
    else if (isCape) attack.push([{ dx: -3 }, { dx: 5 }, { dx: 0 }]);
    else if (weaponIdx === undefined) attack.push([{ dx: -2 }, { dx: 6 }, { dx: 0 }]); // no weapon: a body lunge
    else attack.push([{ dx: -1 }, { dx: 4 }, { dx: 0 }]);
    if (isWeapon) cast.push([{ dy: -2 }, { dy: -5 }, { dy: -5 }]);
    else if (isCape) cast.push([{ dy: 0 }, { dy: 2 }, { dy: 1 }]);
    else cast.push([{ dy: 0 }, { dy: -2 }, { dy: -2 }]);
    hurt.push([{ dx: -4 }, { dx: 0 }]);
    // The sink stays inside the bake: the fade in drawActor carries the rest.
    dead.push([{ dy: 2 }, { dy: 5 }]);
  }
  return { idle, attack, hurt, cast, dead };
}

/** A weapon this tall cannot be rotated flat inside the bake canvas, so its recipe thrusts instead of swinging. */
const SWING_MAX_H = 34;
function thrusts(weapon: PartId): boolean {
  return PART_LIBRARY[weapon].h > SWING_MAX_H;
}

function anchor(of: number, name: AnchorName): AnchorRef {
  return { of, anchor: name };
}

/** Place a part so its `feet` land on the shared ground line at the canvas centre — no hand-tuned per-recipe offsets, so the whole roster stands on one floor. */
function groundAt(id: PartId, cx: number, groundY: number): Point {
  const p = PART_LIBRARY[id];
  const feet = p.anchors.feet ?? { x: (p.w / 2) | 0, y: p.h - 1 };
  return { x: cx - feet.x, y: groundY - feet.y };
}

function anchorPoint(partId: PartId, at: Point, name: AnchorName): Point {
  const a = PART_LIBRARY[partId].anchors[name] ?? { x: 0, y: 0 };
  return { x: at.x + a.x, y: at.y + a.y };
}

// --- Recipes ------------------------------------------------------------------

const HERO_HIT_SIZE = { w: 34, h: 50 };
const BOSS_HIT_SIZE = { w: 56, h: 88 };

const TOWER_AT: Point = { x: 4, y: 28 }; // BASALT's tower shield, held across the body
const SHIELD_AT: Point = { x: 13, y: 28 }; // the knights' kite shield
const PLUME_AT: Point = { x: 29, y: 0 };
const KELP_AT: Point = { x: 28, y: 0 };
const HALO_AT: Point = { x: 24, y: 5 };
const OFFHAND_AT: Point = { x: 22, y: 40 }; // GALE's sheathed second blade, at the hip
const WINGS_AT: Point = { x: 16, y: 34 };
const CROWN_AT: Point = { x: 39, y: 2 };
const BOSS_HALO_AT: Point = { x: 35, y: 1 };

interface HumanoidOpts {
  id: string;
  element: Element;
  body: PartId;
  head: PartId;
  arms: PartId;
  weapon: PartId;
  weaponOff?: Point;
  cape?: PartId;
  extras?: { part: PartId; at: Point; z: number }[];
  palette?: Partial<Record<Material, Ramp>>;
}

/**
 * The common "body + arms + head + hand weapon [+ cape] [+ literal extras]"
 * biped — the six heroes and every humanoid enemy. Layer order is fixed
 * (body 0, arms 1, head 2, weapon 3) so the rig always knows which layer
 * swings; `extras` are literal ornaments and held objects that ride along.
 */
function humanoid(opts: HumanoidOpts): ActorRecipe {
  const at = groundAt(opts.body, CENTRE_X, GROUND_Y);
  const layers: LayerDef[] = [
    { part: opts.body, at, z: 1 },
    { part: opts.arms, at: anchor(0, 'hand'), z: 2 },
    { part: opts.head, at: anchor(0, 'head'), z: 4 },
    { part: opts.weapon, at: anchor(1, 'weaponGrip'), z: 3, off: opts.weaponOff },
  ];
  let capeIdx: number | undefined;
  if (opts.cape) {
    capeIdx = layers.length;
    layers.push({ part: opts.cape, at: anchor(0, 'capePin'), z: 0 });
  }
  for (const e of opts.extras ?? []) layers.push({ part: e.part, at: e.at, z: e.z });
  return {
    id: opts.id,
    element: opts.element,
    res: ACTOR_PART,
    layers,
    feet: anchorPoint(opts.body, at, 'feet'),
    hit: anchorPoint(opts.body, at, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, 3, capeIdx, thrusts(opts.weapon)),
    palette: opts.palette,
  };
}

/** A one- or two-layer creature — every crypt and marsh normal that isn't a humanoid. */
function monster(id: string, element: Element, bodyPart: PartId, palette?: Partial<Record<Material, Ramp>>, extra?: { part: PartId; at: Point; z: number; sway?: boolean }): ActorRecipe {
  const at = groundAt(bodyPart, CENTRE_X, GROUND_Y);
  const layers: LayerDef[] = [];
  let capeIdx: number | undefined;
  if (extra) {
    layers.push({ part: extra.part, at: extra.at, z: extra.z });
    if (extra.sway) capeIdx = 0;
  }
  layers.push({ part: bodyPart, at, z: 1 });
  return {
    id,
    element,
    res: ACTOR_PART,
    layers,
    feet: anchorPoint(bodyPart, at, 'feet'),
    hit: anchorPoint(bodyPart, at, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, undefined, capeIdx),
    palette,
  };
}

/** Boss scale: a body and head on the boss canvas, a cloak behind, a crown or halo above, and a weapon on the body's own grip (bosses carry no arms layer). */
function boss(opts: { id: string; element: Element; body: PartId; head: PartId; cape: PartId; crest: PartId; crestAt: Point; weapon: PartId; weaponOff?: Point; palette?: Partial<Record<Material, Ramp>> }): ActorRecipe {
  const at = groundAt(opts.body, BOSS_CENTRE_X, BOSS_GROUND_Y);
  const layers: LayerDef[] = [
    { part: opts.body, at, z: 1 },
    { part: opts.cape, at: anchor(0, 'capePin'), z: 0 },
    { part: opts.head, at: anchor(0, 'head'), z: 4 },
    { part: opts.crest, at: opts.crestAt, z: 5 },
    { part: opts.weapon, at: anchor(0, 'weaponGrip'), z: 3, off: opts.weaponOff },
  ];
  return {
    id: opts.id,
    element: opts.element,
    res: BOSS_PART,
    layers,
    feet: anchorPoint(opts.body, at, 'feet'),
    hit: anchorPoint(opts.body, at, 'hit'),
    hitSize: BOSS_HIT_SIZE,
    rigs: buildRig(layers.length, 4, 1, thrusts(opts.weapon)),
    palette: opts.palette,
  };
}

/**
 * The six heroes and every enemy id in game/data/enemies.ts (EMBER CRYPT +
 * FROST MARSH), looked up by that same string id. Per DESIGN.md's silhouette
 * rule each hero owns its body, its head and its weapon shape — never one
 * body in six tints — and reads apart in greyscale:
 *   EMBER an ember mane, bare bracered arms and a flame staff taller than
 *   he is; GALE a windswept crop, a scarf streaming off the lean, twin
 *   daggers; TIDE a deep hood and a floor-length robe with a wave hem,
 *   cradling an orb; BASALT a slit-visored helm, pauldrons, a tower shield
 *   and a mace; SABLE a pointed hood with two lit eyes over a knee-length
 *   cloak, a curved dagger held low; LUMEN long cream-gold hair under a
 *   halo, a gold-trimmed mantle and a bow as tall as she is.
 */
export const ACTOR_RECIPES: Record<string, ActorRecipe> = {
  // --- heroes ---
  EMBER: humanoid({
    id: 'EMBER',
    element: 'FIRE',
    body: 'body_ember',
    head: 'head_ember',
    arms: 'arms_bare',
    weapon: 'staff',
    palette: { hair: EMBER_HAIR, cloth: DUSK_CLOTH },
  }),
  GALE: humanoid({
    id: 'GALE',
    element: 'WIND',
    body: 'body_gale',
    head: 'head_gale',
    arms: 'arms_sleeve',
    weapon: 'dagger',
    cape: 'scarf',
    extras: [{ part: 'dagger_sheathed', at: OFFHAND_AT, z: 3 }],
    palette: { hair: FLAX_HAIR, cloth: OLIVE, cloth2: LINEN },
  }),
  TIDE: humanoid({
    id: 'TIDE',
    element: 'WATER',
    body: 'body_tide',
    head: 'head_tide',
    arms: 'arms_robe',
    weapon: 'orb',
    palette: { accent: PALE_ROBE, cloth: DEEP_TEAL, hair: DARK_HAIR },
  }),
  BASALT: humanoid({
    id: 'BASALT',
    element: 'FIRE',
    body: 'body_basalt',
    head: 'head_basalt',
    arms: 'arms_plate',
    weapon: 'mace',
    extras: [{ part: 'tower_shield', at: TOWER_AT, z: 3 }],
    palette: { accent: BLOOD_TABARD },
  }),
  SABLE: humanoid({
    id: 'SABLE',
    element: 'DARK',
    body: 'body_sable',
    head: 'head_sable',
    arms: 'arms_sleeve',
    weapon: 'dagger_curved',
    palette: { cloth: DUSK_CLOTH },
  }),
  LUMEN: humanoid({
    id: 'LUMEN',
    element: 'LIGHT',
    body: 'body_lumen',
    head: 'head_lumen',
    arms: 'arms_mantle',
    weapon: 'bow_tall',
    weaponOff: { x: 2, y: -6 },
    extras: [{ part: 'halo', at: HALO_AT, z: 5 }],
    palette: { hair: GOLD_HAIR, cloth: WHITE_CLOTH },
  }),
  // --- EMBER CRYPT ---
  CINDER_IMP: monster('CINDER_IMP', 'FIRE', 'imp_body', undefined, { part: 'imp_wings', at: WINGS_AT, z: 0, sway: true }),
  ASH_HOUND: monster('ASH_HOUND', 'FIRE', 'hound_body', { cloth: ASH_HIDE }),
  CRYPT_WARDEN: humanoid({
    id: 'CRYPT_WARDEN',
    element: 'FIRE',
    body: 'body_brute',
    head: 'head_brute',
    arms: 'arms_plate',
    weapon: 'lantern',
    palette: { cloth: DUSK_CLOTH },
  }),
  DUST_WRAITH: monster('DUST_WRAITH', 'WIND', 'wraith_body', { cloth: DUSK_CLOTH, accent: ASH_HIDE }),
  PYRE_KNIGHT: humanoid({
    id: 'PYRE_KNIGHT',
    element: 'FIRE',
    body: 'body_basalt',
    head: 'head_basalt',
    arms: 'arms_plate',
    weapon: 'sword',
    extras: [
      { part: 'shield', at: SHIELD_AT, z: 3 },
      { part: 'plume', at: PLUME_AT, z: 5 },
    ],
  }),
  HOLLOW_KING: boss({
    id: 'HOLLOW_KING',
    element: 'DARK',
    body: 'king_body',
    head: 'king_head',
    cape: 'cloak_ragged',
    crest: 'crown',
    crestAt: CROWN_AT,
    weapon: 'claw',
    palette: { cloth2: BLOOD_TABARD, cloth: DUSK_CLOTH },
  }),
  // --- FROST MARSH ---
  BOG_TOAD: monster('BOG_TOAD', 'WATER', 'toad_body', { accent: MOSS }),
  FROST_WISP: monster('FROST_WISP', 'WATER', 'wisp_body'),
  MARSH_HAG: humanoid({
    id: 'MARSH_HAG',
    element: 'WATER',
    body: 'body_tide',
    head: 'head_hag',
    arms: 'arms_sleeve',
    weapon: 'cane',
    palette: { accent: MOSS, cloth: SILT },
  }),
  SILT_CRAB: monster('SILT_CRAB', 'WATER', 'crab_body', { accent: SILT }),
  FEN_FIRE: monster('FEN_FIRE', 'FIRE', 'fenfire_body', { glow: ELEMENT_RAMPS.WIND.glow, accent: MOSS }),
  DROWNED_KNIGHT: humanoid({
    id: 'DROWNED_KNIGHT',
    element: 'WATER',
    body: 'body_basalt',
    head: 'head_basalt',
    arms: 'arms_plate',
    weapon: 'sword',
    extras: [
      { part: 'shield', at: SHIELD_AT, z: 3 },
      { part: 'kelp', at: KELP_AT, z: 5 },
    ],
    palette: { metal: ['#0d1618', '#38524f', '#688079', '#a8bdae'] },
  }),
  PALE_SAINT: boss({
    id: 'PALE_SAINT',
    element: 'LIGHT',
    body: 'saint_body',
    head: 'saint_head',
    cape: 'cloak_holy',
    crest: 'halo_boss',
    crestAt: BOSS_HALO_AT,
    weapon: 'orb',
    weaponOff: { x: 4, y: -4 },
    palette: { cloth: WHITE_CLOTH, cloth2: GOLD_HAIR },
  }),
};

// --- Demo hook ----------------------------------------------------------------
// The three slice heroes and three crypt enemies idling on the diagonal
// stage (DESIGN.md's UI-constraints stage row) with a real VFX burst off
// vfx.ts's own spawn/update/render loop — the actual pipeline the battle
// screen uses, not a stand-in animation.

interface DemoActor {
  id: string;
  x: number;
  y: number;
}

const DEMO_HEROES: readonly DemoActor[] = [
  { id: 'EMBER', x: 330, y: 330 },
  { id: 'GALE', x: 420, y: 420 },
  { id: 'TIDE', x: 510, y: 510 },
];
// "enemies mirrored about x 640" (DESIGN.md): enemyX = 640 + (640 - heroX).
const DEMO_ENEMIES: readonly DemoActor[] = [
  { id: 'CINDER_IMP', x: 1280 - 330, y: 330 },
  { id: 'ASH_HOUND', x: 1280 - 420, y: 420 },
  { id: 'CRYPT_WARDEN', x: 1280 - 510, y: 510 },
];

const demoVfx: VfxInstance[] = [];
let demoPrevTime: number | null = null;
let demoLastCycle = -1;

/** Idling heroes and enemies on the diagonal stage, one VFX burst every 2s. Wire into main.ts with `demoStage(pc, clock)` inside `render()`. */
export function demoStage(pc: PixelCanvas, time: number): void {
  const dt = demoPrevTime === null ? 0 : Math.max(0, Math.min(0.25, time - demoPrevTime));
  demoPrevTime = time;
  updateVfx(demoVfx, dt);

  for (const h of DEMO_HEROES) {
    const recipe = ACTOR_RECIPES[h.id];
    drawActor(pc.ctx, recipe, { pose: 'idle', time, element: recipe.element, facing: 1, x: h.x, y: h.y });
  }
  for (const e of DEMO_ENEMIES) {
    const recipe = ACTOR_RECIPES[e.id];
    drawActor(pc.ctx, recipe, { pose: 'idle', time, element: recipe.element, facing: -1, x: e.x, y: e.y });
  }

  const cycle = Math.floor(time / 2);
  if (cycle !== demoLastCycle) {
    demoLastCycle = cycle;
    spawnVfx(demoVfx, 'CINDER', DEMO_HEROES[0].x, DEMO_HEROES[0].y - 46);
  }
  renderVfx(pc.ctx, demoVfx);
}
