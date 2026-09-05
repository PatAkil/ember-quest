// Ember Quest v3 — game/art/actors.ts
//
// Composes game/art/parts.ts's ASCII parts into full character and enemy
// recipes, bakes a pose to an offscreen bitmap once per (recipe, pose,
// frame, element), and draws that bitmap with one drawImage per actor per
// frame (DESIGN.md → Presentation → Layered actors). `ACTOR_RECIPES` is
// looked up by plain string id — the six heroes' and every enemy's id in
// game/data/enemies.ts — so this module never has to import ../data/* (art
// stays a leaf; sim/data stay ignorant of it, per the module table).
//
// Composition model: a recipe is a z-ordered list of layers, each placing a
// part either at a literal (x, y) or anchored to an already-placed layer's
// named anchor point (parts.ts's AnchorName). Placing an anchored layer
// means solving "where does MY OWN same-named anchor have to land so it
// coincides with the target" — that solve is what keeps a weapon glued to a
// hand (and a head to a neck, and a cloak to a shoulder) across every pose
// keyframe, including the frames where the weapon rotates. Rotation is
// always a multiple of 90 degrees and is applied to the PART'S PIXEL GRID
// (rotateSprite90 below), never a canvas transform, so a rotated blade stays
// exactly as hard-edged as everything else on the actor plane.

import { makeSprite, tintSprite, bakeSprite, drawBaked, frameIndex, PICO8 } from '../../engine';
import type { PixelCanvas, Sprite, SpriteMap } from '../../engine';
import type { Element } from '../types';
import { PART_LIBRARY } from './parts';
import type { AnchorName, PartId, Point, RoleKey, RoleMap } from './parts';
import { renderVfx, spawnVfx, updateVfx } from './vfx';
import type { VfxInstance } from './vfx';

// --- Presentation constants (DESIGN.md → Presentation → Canvas and scale / Layered actors) ---
// Presentation constants live in the module that reads them (game/types.ts's
// own rule) — these are read here and nowhere headless, so they live here.

export const ACTOR_PART = 64;
export const BOSS_PART = 96;
export const ACTOR_SCALE = 3;
/** Derived, not re-authored, so the two numbers can never drift apart. */
export const ACTOR_W = ACTOR_PART * ACTOR_SCALE;
export const BOSS_W = BOSS_PART * ACTOR_SCALE;
export const POSE_FPS = 12;

export type PoseName = 'idle' | 'attack' | 'hurt' | 'cast' | 'dead';

/** Frame count per pose — idle's 2-4 is DESIGN.md's own range; the rest are sized to their named beats (attack: wind-up/strike/recover). */
export const POSE_FRAMES: Record<PoseName, number> = { idle: 3, attack: 3, hurt: 2, cast: 3, dead: 2 };

// --- Recipe shape -----------------------------------------------------------

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
}

export interface LayerKeyframe {
  dx?: number;
  dy?: number;
  /** Degrees, always a multiple of 90 — rotation happens on the pixel grid (rotateSprite90), never a canvas transform, so it stays hard-edged. */
  rot?: 0 | 90 | 180 | 270;
}

export interface ActorRecipe {
  id: string;
  /** The actor's native element — what its 'accent'/'glow' roles tint to when a caller doesn't override it. */
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
}

export interface ActorDrawState {
  pose: PoseName;
  time: number;
  element: Element;
  facing: 1 | -1;
  x: number;
  y: number;
}

// --- Element → colour (the 'accent'/'glow' tint table) ------------------------
// Every other role (skin/cloth/metal/dark/light) stays neutral on every
// actor — only 'accent' and 'glow' are a per-element palette swap.

const NEUTRAL: Record<Exclude<RoleKey, 'accent' | 'glow'>, string> = {
  skin: PICO8[15],
  cloth: PICO8[5],
  metal: PICO8[6],
  dark: PICO8[0],
  light: PICO8[7],
};
/** Parts are authored as if FIRE (red accent, orange glow); every other element is a tintSprite swap off these two placeholders. */
const PLACEHOLDER_ACCENT = PICO8[8];
const PLACEHOLDER_GLOW = PICO8[9];

const ELEMENT_PALETTE: Record<Element, { accent: string; glow: string }> = {
  FIRE: { accent: PICO8[8], glow: PICO8[9] },
  WIND: { accent: PICO8[11], glow: PICO8[7] },
  WATER: { accent: PICO8[12], glow: PICO8[7] },
  LIGHT: { accent: PICO8[10], glow: PICO8[7] },
  DARK: { accent: PICO8[2], glow: PICO8[14] },
};

function neutralSpriteMap(map: RoleMap): SpriteMap {
  const out: SpriteMap = {};
  for (const ch in map) {
    const role = map[ch];
    if (!role) continue;
    out[ch] = role === 'accent' ? PLACEHOLDER_ACCENT : role === 'glow' ? PLACEHOLDER_GLOW : NEUTRAL[role];
  }
  return out;
}

// Baked lazily, once per part / once per (part, element) — DESIGN.md's own
// budget line for this pipeline.
const neutralSpriteCache = new Map<PartId, Sprite>();
function neutralSprite(id: PartId): Sprite {
  let s = neutralSpriteCache.get(id);
  if (!s) {
    const p = PART_LIBRARY[id];
    s = makeSprite(p.rows as string[], neutralSpriteMap(p.map));
    neutralSpriteCache.set(id, s);
  }
  return s;
}

const elementSpriteCache = new Map<string, Sprite>();
function elementSprite(id: PartId, element: Element): Sprite {
  const key = `${id}|${element}`;
  let s = elementSpriteCache.get(key);
  if (!s) {
    const base = neutralSprite(id);
    s =
      element === 'FIRE'
        ? base
        : tintSprite(base, {
            [PLACEHOLDER_ACCENT]: ELEMENT_PALETTE[element].accent,
            [PLACEHOLDER_GLOW]: ELEMENT_PALETTE[element].glow,
          });
    elementSpriteCache.set(key, s);
  }
  return s;
}

// --- Local primitive: 90-degree Sprite rotation --------------------------
// The engine has no Sprite-level rotation (drawBaked's `rotation` is a
// canvas-space transform for an arbitrary angle at DRAW time); the actor
// bake needs an exact, anchor-preserving rotation at COMPOSE time instead,
// so it is implemented locally here as a pixel-grid remap — integer math
// only, so a rotated weapon stays exactly as hard-edged as everything else.

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

// --- Composition ------------------------------------------------------------

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
 * bake time only (see bakePose), never the per-frame draw path. Layers are
 * RESOLVED in array order (an anchored layer may only reference an earlier
 * index) and PAINTED in `z` order, so dependency order and paint order can
 * differ (a cloak behind the torso can still be placed off the torso's own
 * anchor).
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
    const base = elementSprite(layer.part, element);
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

  applyRimLight(pixels, res, res);
  return { w: res, h: res, pixels };
}

/** A 1-cell light edge along the composed silhouette's top-left, promoting the authored dark keyline where it faces up or left — one light direction, applied once at bake time (DESIGN.md's rim-light rule). */
function applyRimLight(pixels: (string | null)[], w: number, h: number): void {
  const src = pixels.slice();
  const dark = NEUTRAL.dark;
  const light = NEUTRAL.light;
  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      const i = rowBase + x;
      if (src[i] !== dark) continue;
      const up = y > 0 ? src[i - w] : null;
      const left = x > 0 ? src[i - 1] : null;
      if (up === null || left === null) pixels[i] = light;
    }
  }
}

// --- Baking + drawing ---------------------------------------------------------

const poseBitmapCache = new Map<string, HTMLCanvasElement>();

/** Composes and bakes a pose to an offscreen canvas the first time it is asked for; every later call for the same (recipe, pose, frame, element) is a cache hit. */
export function bakePose(recipe: ActorRecipe, pose: PoseName, frame: number, element: Element): HTMLCanvasElement {
  const key = `${recipe.id}|${pose}|${frame}|${element}`;
  let bmp = poseBitmapCache.get(key);
  if (!bmp) {
    bmp = bakeSprite(composePose(recipe, pose, frame, element), 1);
    poseBitmapCache.set(key, bmp);
  }
  return bmp;
}

/** Diagnostic only (used by the verification tooling): how many distinct (recipe, pose, frame, element) bitmaps are cached right now. */
export function bakedPoseCount(): number {
  return poseBitmapCache.size;
}

/** A 'dead' pose sinks AND fades — geometric sink is ordinary dy keyframes; the fade is applied here since a baked Sprite has no per-pixel alpha to bake in. */
const DEAD_ALPHA: readonly number[] = [0.8, 0.45];

/** One drawImage per actor per frame: look up (or bake) the pose bitmap, then draw it hard-pixelled at ACTOR_SCALE, anchored at the feet. */
// A single reused options record: drawBaked only reads it synchronously for
// the duration of one call and keeps no reference afterward, so mutating and
// re-passing the same object every draw is safe — and unlike a fresh object
// literal per call, it allocates nothing in the per-actor-per-frame hot path.
const drawOpts: { scale: number; flipX: boolean; originX: number; originY: number; alpha: number } = {
  scale: ACTOR_SCALE,
  flipX: false,
  originX: 0,
  originY: 0,
  alpha: 1,
};

export function drawActor(ctx: CanvasRenderingContext2D, recipe: ActorRecipe, state: ActorDrawState): void {
  const frame = frameIndex(state.time, POSE_FPS, POSE_FRAMES[state.pose]);
  const bitmap = bakePose(recipe, state.pose, frame, state.element);
  drawOpts.flipX = state.facing === -1;
  drawOpts.originX = recipe.feet.x;
  drawOpts.originY = recipe.feet.y;
  drawOpts.alpha = state.pose === 'dead' ? (DEAD_ALPHA[frame] ?? 1) : 1;
  drawBaked(ctx, bitmap, state.x, state.y, drawOpts);
}

/** The hurtbox for pops/targeting cursors: a fixed-size rect centred on the recipe's `hit` point, in the same logical-px space as `x, y` passed to drawActor. */
export function actorHitRect(recipe: ActorRecipe, x: number, y: number): { x: number; y: number; w: number; h: number } {
  const dx = (recipe.hit.x - recipe.feet.x) * ACTOR_SCALE;
  const dy = (recipe.hit.y - recipe.feet.y) * ACTOR_SCALE;
  const w = recipe.hitSize.w * ACTOR_SCALE;
  const h = recipe.hitSize.h * ACTOR_SCALE;
  return { x: x + dx - w / 2, y: y + dy - h / 2, w, h };
}

// --- Rig generator ------------------------------------------------------------
// Every recipe shares the same five-pose shape; what differs is which layer
// (if any) is the weapon that swings, and which (if any) is a cloth layer
// that sways on its own beat. Non-special layers all move IN LOCKSTEP (the
// same dx/dy every frame), which is what keeps a literally-placed accessory
// (a crown, a halo) glued to its neighbour without needing its own anchor.

// Amplitudes doubled from v3.0 for the art-quality pass — a figure roughly
// twice the linear size needs a bob/swing roughly twice as large to read as
// the same GESTURE at ×3 rather than a twitch (DESIGN.md's "2-3 cell bob, a
// weapon arc that travels").
function buildRig(layerCount: number, weaponIdx?: number, capeIdx?: number): Record<PoseName, LayerKeyframe[][]> {
  const idle: LayerKeyframe[][] = [];
  const attack: LayerKeyframe[][] = [];
  const cast: LayerKeyframe[][] = [];
  const hurt: LayerKeyframe[][] = [];
  const dead: LayerKeyframe[][] = [];
  for (let i = 0; i < layerCount; i++) {
    const isWeapon = i === weaponIdx;
    const isCape = i === capeIdx;
    idle.push(isCape ? [{ dy: 0 }, { dx: 2, dy: 2 }, { dx: 0, dy: 0 }] : [{ dy: 0 }, { dy: -2 }, { dy: 0 }]);
    if (isWeapon) attack.push([{ rot: 270 }, { rot: 90, dx: 5 }, { rot: 0 }]); // wind-up, the swing travels, recover
    else if (isCape) attack.push([{ dx: -2 }, { dx: 4 }, { dx: 0 }]);
    else if (weaponIdx === undefined) attack.push([{ dx: 0 }, { dx: 6 }, { dx: 0 }]); // no weapon: a body lunge (BASALT's slam)
    else attack.push([{ dx: 0 }, { dx: 3 }, { dx: 0 }]);
    if (isWeapon) cast.push([{ dy: -2 }, { dy: -7 }, { dy: -7 }]);
    else if (isCape) cast.push([{ dy: 0 }, { dy: 2 }, { dy: 0 }]);
    else cast.push([{ dy: 0 }, { dy: -2 }, { dy: -2 }]);
    hurt.push([{ dx: -5 }, { dx: 0 }]);
    dead.push([{ dy: 3 }, { dy: 8 }]);
  }
  return { idle, attack, hurt, cast, dead };
}

function anchor(of: number, name: AnchorName): AnchorRef {
  return { of, anchor: name };
}

function anchorPoint(partId: PartId, at: Point, name: AnchorName): Point {
  const a = PART_LIBRARY[partId].anchors[name] ?? { x: 0, y: 0 };
  return { x: at.x + a.x, y: at.y + a.y };
}

// --- Recipes ------------------------------------------------------------------
// Literal placements (a recipe's base/body layer, plus the odd literally
// -placed accessory) were authored so every hero's/normal's FEET land at
// y ~= 62 of the 64-cell canvas (BOSS_PART's at y ~= 93 of 96) — a shared
// "ground line" so the roster stands together at gameplay scale — then
// tuned by eye against the verification screenshot.

const HERO_HIT_SIZE = { w: 32, h: 68 };
const BOSS_HIT_SIZE = { w: 58, h: 118 };

const SLIM_AT: Point = { x: 20, y: 21 }; // EMBER, GALE (torso_lean shares this footprint), SABLE, LUMEN
const HEAVY_AT: Point = { x: 16, y: 19 }; // BASALT, CRYPT_WARDEN, PYRE_KNIGHT, DROWNED_KNIGHT
const ROBE_AT: Point = { x: 14, y: 19 }; // TIDE, MARSH_HAG
// torso_heavy's own centreline sits at HEAVY_AT.x + HEAVY_LH (16 + 16 = 32,
// the 64-cell canvas centre) — SHIELD_AT/TOWER_AT centre each shield's OWN
// half-width (10 / 11) on that same column so it reads as held in front,
// not off to one side.
const SHIELD_AT: Point = { x: 22, y: 23 }; // knights' round shield, literal in front
// TOWER_AT deliberately does NOT centre the shield on the torso: fully
// overlapping torso_heavy's own 33-wide silhouette left it entirely inside
// the body's outline, reading as "more red chest" rather than a held
// object — shifted left so it visibly pokes out past the body's own edge.
const TOWER_AT: Point = { x: 8, y: 15 };
const CREST_AT: Point = { x: 29, y: 0 }; // knight helm crest (plume/kelp), literal above the helm
const LUMEN_HALO_AT: Point = { x: 24, y: 1 }; // hero-scale halo, floating above HEAD_LONGHAIR
const OFFHAND_AT: Point = { x: 22, y: 40 }; // GALE's sheathed off-hand dagger, at the hip (torso_slim's own hip band starts at absolute y ~= 42)

const IMP_AT: Point = { x: 21, y: 33 };
const IMP_WINGS_AT: Point = { x: 19, y: 35 };
const HOUND_AT: Point = { x: 18, y: 41 };
const WRAITH_AT: Point = { x: 18, y: 24 };
const TOAD_AT: Point = { x: 10, y: 37 };
const WISP_AT: Point = { x: 20, y: 39 };
const CRAB_AT: Point = { x: 10, y: 39 };
const FENFIRE_AT: Point = { x: 22, y: 45 };

const KING_AT: Point = { x: 26, y: 28 }; // shared footprint: KING_BODY and SAINT_BODY are both 45x66
const CROWN_AT: Point = { x: 40, y: 4 }; // HOLLOW_KING
const SAINT_HALO_AT: Point = { x: 40, y: 2 }; // PALE_SAINT (boss scale)

/**
 * The common "torso + arms + head + hand weapon [+ cape] [+ offhand] [+
 * accessory]" biped shape — EMBER, GALE, TIDE, SABLE, LUMEN and the
 * staff/cane-bearing support enemies all share it. `cape` takes a PartId
 * (not a boolean) so a scarf, a short cloak or a full cloak can all use the
 * same slot; `offhand` is a small literal accent (a sheathed second blade)
 * that rides along with the torso rather than gripping anything; `accessory`
 * is a literal ornament (a halo) that floats above the head, on the same
 * pattern bossRecipe already uses for a crown.
 */
function humanoidRecipe(opts: {
  id: string;
  element: Element;
  torso: PartId;
  torsoAt: Point;
  head: PartId;
  arms: PartId;
  weapon: PartId;
  cape?: PartId;
  offhand?: { part: PartId; at: Point };
  accessory?: { part: PartId; at: Point };
}): ActorRecipe {
  const layers: LayerDef[] = [
    { part: opts.torso, at: opts.torsoAt, z: 1 },
    { part: opts.arms, at: anchor(0, 'hand'), z: 2 },
    { part: opts.head, at: anchor(0, 'head'), z: 4 },
    { part: opts.weapon, at: anchor(1, 'weaponGrip'), z: 3 },
  ];
  let capeIdx: number | undefined;
  if (opts.cape) {
    capeIdx = layers.length;
    layers.push({ part: opts.cape, at: anchor(0, 'capePin'), z: 0 });
  }
  if (opts.offhand) layers.push({ part: opts.offhand.part, at: opts.offhand.at, z: 2 });
  if (opts.accessory) layers.push({ part: opts.accessory.part, at: opts.accessory.at, z: 5 });
  return {
    id: opts.id,
    element: opts.element,
    res: ACTOR_PART,
    layers,
    feet: anchorPoint(opts.torso, opts.torsoAt, 'feet'),
    hit: anchorPoint(opts.torso, opts.torsoAt, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, 3, capeIdx),
  };
}

/** Sword + shield knights (PYRE_KNIGHT, DROWNED_KNIGHT) — the shield is literally placed (a raised guard barely moves pose to pose) rather than anchored, since the six-name anchor vocabulary has no second grip point. An optional helm crest (PLUME/KELP) tells the two knights apart beyond their element tint. */
function knightRecipe(id: string, element: Element, crest?: PartId): ActorRecipe {
  const layers: LayerDef[] = [
    { part: 'torso_heavy', at: HEAVY_AT, z: 1 },
    { part: 'arms_sleeve', at: anchor(0, 'hand'), z: 2 },
    { part: 'head_helm', at: anchor(0, 'head'), z: 4 },
    { part: 'sword', at: anchor(1, 'weaponGrip'), z: 3 },
    { part: 'shield', at: SHIELD_AT, z: 2 },
  ];
  if (crest) layers.push({ part: crest, at: CREST_AT, z: 5 });
  return {
    id,
    element,
    res: ACTOR_PART,
    layers,
    feet: anchorPoint('torso_heavy', HEAVY_AT, 'feet'),
    hit: anchorPoint('torso_heavy', HEAVY_AT, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, 3),
  };
}

/** A single- (or double-) layer creature body — every EMBER CRYPT/FROST MARSH normal that isn't a humanoid. */
function monsterRecipe(
  id: string,
  element: Element,
  bodyPart: PartId,
  bodyAt: Point,
  extra?: { part: PartId; at: Point; z: number; sway?: boolean },
): ActorRecipe {
  const layers: LayerDef[] = [];
  let capeIdx: number | undefined;
  if (extra) {
    layers.push({ part: extra.part, at: extra.at, z: extra.z });
    if (extra.sway) capeIdx = 0;
  }
  layers.push({ part: bodyPart, at: bodyAt, z: 1 });
  return {
    id,
    element,
    res: ACTOR_PART,
    layers,
    feet: anchorPoint(bodyPart, bodyAt, 'feet'),
    hit: anchorPoint(bodyPart, bodyAt, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, undefined, capeIdx),
  };
}

/**
 * Boss-scale: a body + head (KING_BODY/KING_HEAD's gapped bone vs.
 * SAINT_BODY/SAINT_HEAD's unbroken robe — see parts.ts — so the two bosses
 * no longer share a silhouette), a crown or halo (literal — moves in
 * lockstep with the head via the shared default keyframes, see buildRig), a
 * cloak, and a weapon-slot (claws / a holy orb) anchored to the body's own
 * weaponGrip (bosses have no separate arms layer).
 */
function bossRecipe(opts: { id: string; element: Element; body: PartId; head: PartId; cape: PartId; accessory: PartId; accessoryAt: Point; weapon: PartId }): ActorRecipe {
  const layers: LayerDef[] = [
    { part: opts.body, at: KING_AT, z: 1 },
    { part: opts.cape, at: anchor(0, 'capePin'), z: 0 },
    { part: opts.head, at: anchor(0, 'head'), z: 4 },
    { part: opts.accessory, at: opts.accessoryAt, z: 5 },
    { part: opts.weapon, at: anchor(0, 'weaponGrip'), z: 3 },
  ];
  return {
    id: opts.id,
    element: opts.element,
    res: BOSS_PART,
    layers,
    feet: anchorPoint(opts.body, KING_AT, 'feet'),
    hit: anchorPoint(opts.body, KING_AT, 'hit'),
    hitSize: BOSS_HIT_SIZE,
    rigs: buildRig(layers.length, 4, 1),
  };
}

/** BASALT: full helm, broad pauldrons, a tower shield held in front, and a mace — no bare sword-and-buckler read like the knights. */
const BASALT: ActorRecipe = (() => {
  const layers: LayerDef[] = [
    { part: 'torso_heavy', at: HEAVY_AT, z: 1 },
    { part: 'arms_guard', at: anchor(0, 'hand'), z: 2 },
    { part: 'head_helm', at: anchor(0, 'head'), z: 4 },
    { part: 'mace', at: anchor(1, 'weaponGrip'), z: 3 },
    { part: 'tower_shield', at: TOWER_AT, z: 4 },
  ];
  return {
    id: 'BASALT',
    element: 'FIRE',
    res: ACTOR_PART,
    layers,
    feet: anchorPoint('torso_heavy', HEAVY_AT, 'feet'),
    hit: anchorPoint('torso_heavy', HEAVY_AT, 'hit'),
    hitSize: HERO_HIT_SIZE,
    rigs: buildRig(layers.length, 3), // the mace (index 3) swings; the tower shield punches forward with it
  };
})();

/**
 * The six heroes and every enemy id in game/data/enemies.ts (EMBER CRYPT +
 * FROST MARSH), looked up by that same string id. Per DESIGN.md's
 * silhouette rule, every hero gets its own head AND its own weapon/cape
 * shape — never just a shared body with a different tint:
 *   EMBER spiked hair + bare arms + a flame-headed staff; GALE a windswept
 *   crop + a forward-leaning torso + a scarf streaming back + a sheathed
 *   off-hand blade (twin daggers without a second arm rig); TIDE a deep
 *   hood + both arms cradling a floating orb; BASALT a full helm + a tower
 *   shield held in front + a mace; SABLE a shadowed pointed hood (lit eyes)
 *   + a short cloak + a curved dagger held low; LUMEN long hair + a
 *   floating halo + a tall bow.
 */
export const ACTOR_RECIPES: Record<string, ActorRecipe> = {
  // --- heroes ---
  EMBER: humanoidRecipe({ id: 'EMBER', element: 'FIRE', torso: 'torso_slim', torsoAt: SLIM_AT, head: 'head_spiky', arms: 'arms_bare', weapon: 'staff' }),
  GALE: humanoidRecipe({
    id: 'GALE',
    element: 'WIND',
    torso: 'torso_lean',
    torsoAt: SLIM_AT,
    head: 'head_windswept',
    arms: 'arms_sleeve',
    weapon: 'dagger',
    cape: 'scarf',
    offhand: { part: 'dagger_small', at: OFFHAND_AT },
  }),
  TIDE: humanoidRecipe({ id: 'TIDE', element: 'WATER', torso: 'torso_robe', torsoAt: ROBE_AT, head: 'head_hood_deep', arms: 'arms_both', weapon: 'orb' }),
  BASALT,
  SABLE: humanoidRecipe({ id: 'SABLE', element: 'DARK', torso: 'torso_slim', torsoAt: SLIM_AT, head: 'head_hood_shadow', arms: 'arms_sleeve', weapon: 'dagger_curved', cape: 'short_cloak' }),
  LUMEN: humanoidRecipe({
    id: 'LUMEN',
    element: 'LIGHT',
    torso: 'torso_slim',
    torsoAt: SLIM_AT,
    head: 'head_longhair',
    arms: 'arms_sleeve',
    weapon: 'bow_tall',
    accessory: { part: 'halo', at: LUMEN_HALO_AT },
  }),
  // --- EMBER CRYPT ---
  CINDER_IMP: monsterRecipe('CINDER_IMP', 'FIRE', 'imp_body', IMP_AT, { part: 'imp_wings', at: IMP_WINGS_AT, z: 0, sway: true }),
  ASH_HOUND: monsterRecipe('ASH_HOUND', 'FIRE', 'hound_body', HOUND_AT),
  CRYPT_WARDEN: humanoidRecipe({ id: 'CRYPT_WARDEN', element: 'FIRE', torso: 'torso_heavy', torsoAt: HEAVY_AT, head: 'head_helm', arms: 'arms_sleeve', weapon: 'lantern' }),
  DUST_WRAITH: monsterRecipe('DUST_WRAITH', 'WIND', 'wraith_body', WRAITH_AT),
  PYRE_KNIGHT: knightRecipe('PYRE_KNIGHT', 'FIRE', 'plume'),
  HOLLOW_KING: bossRecipe({ id: 'HOLLOW_KING', element: 'DARK', body: 'king_body', head: 'king_head', cape: 'cloak_ragged', accessory: 'crown', accessoryAt: CROWN_AT, weapon: 'claw' }),
  // --- FROST MARSH ---
  BOG_TOAD: monsterRecipe('BOG_TOAD', 'WATER', 'toad_body', TOAD_AT),
  FROST_WISP: monsterRecipe('FROST_WISP', 'WATER', 'wisp_body', WISP_AT),
  MARSH_HAG: humanoidRecipe({ id: 'MARSH_HAG', element: 'WATER', torso: 'torso_robe', torsoAt: ROBE_AT, head: 'head_hag', arms: 'arms_sleeve', weapon: 'cane' }),
  SILT_CRAB: monsterRecipe('SILT_CRAB', 'WATER', 'crab_body', CRAB_AT),
  FEN_FIRE: monsterRecipe('FEN_FIRE', 'FIRE', 'fenfire_body', FENFIRE_AT),
  DROWNED_KNIGHT: knightRecipe('DROWNED_KNIGHT', 'WATER', 'kelp'),
  PALE_SAINT: bossRecipe({ id: 'PALE_SAINT', element: 'LIGHT', body: 'saint_body', head: 'saint_head', cape: 'cloak_holy', accessory: 'halo', accessoryAt: SAINT_HALO_AT, weapon: 'orb' }),
};

// --- Demo hook ----------------------------------------------------------------
// One line for the next writer (main.ts) to wire in: draws the three
// slice heroes and three EMBER CRYPT enemies idling on the diagonal stage
// (DESIGN.md's UI-constraints stage row), with a real VFX burst off
// vfx.ts's own spawn/update/render loop every couple of seconds — the actual
// pipeline the battle screen will use, not a stand-in animation.

interface DemoActor {
  id: string;
  x: number;
  y: number;
}

// Spacing widened from v3.0 for the bigger silhouettes (roughly double the
// linear size — see parts.ts's SIZE note) so the staggered stage doesn't
// pile the three heroes on top of each other.
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

/** Idling heroes + enemies on the diagonal stage, one VFX burst every 2s. Wire into main.ts with `demoStage(pc, clock)` inside `render()`. */
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
