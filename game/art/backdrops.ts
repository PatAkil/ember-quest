// Ember Quest v3 — game/art/backdrops.ts
//
// The diorama behind the fight: one BiomeLook per biome, handed to
// engine/light.ts, which bakes the four plane painters into blurred offscreens
// ONCE per (biome, tier) and then only ever redraws them at a parallax offset.
// Nothing here runs at frame time, so the painters are written for looks, not
// for speed — paths, gradients and a hundred small shapes are all fair game.
//
// THE RULE OF THE PALETTE: the sprites are the saturated element in the frame;
// the world is desaturated and dark-to-mid. Aerial perspective does the depth —
// the FAR plane is the lightest and the bluest, the MID plane sits a shade
// darker, and the NEAR plane (drawn over the actors) is the darkest thing on
// screen. Any warmth in the crypt or green in the marsh is a light source
// justifying itself, never a decorated wall.
//
// The stage geometry is DESIGN.md's: the wall meets the floor at FLOOR_Y, the
// perspective converges on VP, heroes stand at x 408-520 and enemies mirror
// about x 640, so the composition keeps its interest OUTSIDE x 330-950 at head
// height and lets the actor line own the middle.

import type { BiomeLook, BiomeLooks } from '../../engine';

/** Where the back wall meets the stage floor. */
const FLOOR_Y = 392;
/** The vanishing point every floor line converges on (above the wall line: the camera looks slightly down). */
const VP_X = 640;
const VP_Y = 296;

// ------------------------------------------------------------------ helpers --

type Stop = readonly [number, string];

function vgrad(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stops: readonly Stop[]): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [t, c] of stops) g.addColorStop(t, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function poly(ctx: CanvasRenderingContext2D, pts: readonly number[], fill: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A soft light blob — bake time only, so a fresh gradient per call is free. */
function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
): void {
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** A round-topped arch opening, apex at (x, top), springing at `spring`. */
function arch(
  ctx: CanvasRenderingContext2D,
  x: number,
  half: number,
  top: number,
  spring: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.moveTo(x - half, spring);
  ctx.lineTo(x - half, top + half);
  ctx.quadraticCurveTo(x - half, top, x, top);
  ctx.quadraticCurveTo(x + half, top, x + half, top + half);
  ctx.lineTo(x + half, spring);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A column: slightly tapered, with a lighter key-side edge. */
function pillar(
  ctx: CanvasRenderingContext2D,
  x: number,
  top: number,
  bottom: number,
  half: number,
  fill: string,
  edge: string,
): void {
  poly(ctx, [x - half, bottom, x - half * 0.82, top, x + half * 0.82, top, x + half, bottom], fill);
  poly(ctx, [x - half, bottom, x - half * 0.82, top, x - half * 0.45, top, x - half * 0.6, bottom], edge);
}

/**
 * Feather the top edge of the ground plane. A hard horizontal join between the
 * hazy mid-field and the ground reads as a seam across the whole frame; 40 px
 * of alpha ramp turns it into the base of the haze.
 */
function fadeTop(ctx: CanvasRenderingContext2D, width: number, y: number, h: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(0, y, width, h);
  ctx.restore();
}

/** Perspective floor: courses that crowd toward the wall, and lines converging on the vanishing point. */
function floorGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  line: string,
  alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = line;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  // Every line runs through (VP_X, VP_Y); only the stretch below the wall is drawn.
  const k = (FLOOR_Y - VP_Y) / (height - VP_Y);
  for (let i = -9; i <= 9; i++) {
    const xb = VP_X + i * 190;
    ctx.beginPath();
    ctx.moveTo(VP_X + (xb - VP_X) * k, FLOOR_Y);
    ctx.lineTo(xb, height);
    ctx.stroke();
  }
  // Courses: y advances geometrically so the flagstones foreshorten.
  let y = FLOOR_Y + 6;
  let step = 8;
  while (y < height) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    y += step;
    step *= 1.34;
  }
  ctx.restore();
}

// ================================================================ EMBER CRYPT ==
// Warm amber over cold stone. The light has a reason to exist — a burning arch
// at the far left of the vault, its beams thrown across the room as shafts —
// and it comes from the UPPER LEFT because that is where the sprites' own baked
// key and rim come from; the fill answers it from the lower right, cool.
//
// The actor row (x 330-950, y 250-540) is kept deliberately empty: dark
// pillars, low detail, nothing saturated and nothing bright behind a head.

const CRYPT_FAR_INK = '#282640';
const CRYPT_MID_INK = '#14101f';
const CRYPT_NEAR_INK = '#07050d';

const CRYPT: BiomeLook = {
  id: 'EMBER CRYPT',
  key: { color: '#ff9436', x: 244, y: 158, radius: 430, alpha: 0.21 },
  fill: { color: '#4a63a8', x: 1080, y: 630, radius: 660, alpha: 0.2 },
  pool: { color: '#ffb15c', x: 640, y: 486, rx: 396, ry: 120, alpha: 0.26 },
  shafts: { color: '#ffb066', alpha: 0.065, x: 150, y: -90, angle: -0.52, count: 4, width: 52, length: 1050, gap: 152 },
  grade: {
    shadow: '#3a1b2a',
    shadowAlpha: 0.20,
    vignette: 0.64,
    highlight: '#ffb673',
    highlightAlpha: 0.10,
  },
  fog: { color: '#6b4a3a', alpha: 0.06, y: 300, height: 260, speed: 7, bands: 2 },
  motes: { color: '#ffa348', count: 64, size: 9, rise: -26, drift: 16 },
  rim: '#ffcf8f',
  ambient: 'embers',
  ambientColor: '#8a3a18',

  far(ctx, W, H) {
    // Aerial perspective: the deepest plane is the LIGHTEST and the least
    // contrasty thing in the frame, hazing out toward the wall line.
    vgrad(ctx, 0, 0, W, H, [
      [0, '#0e0c18'],
      [0.26, '#1d1726'],
      [0.48, '#332630'],
      [0.56, '#3a2b30'],
      [0.68, '#241c26'],
      [1, '#14101a'],
    ]);
    arch(ctx, 190, 84, 132, FLOOR_Y, '#3c2315');
    arch(ctx, 190, 50, 196, FLOOR_Y, '#6b3a1a');
    softBlob(ctx, 190, 320, 116, 120, '#c9631f', 0.15);
    for (const x of [372, 470, 640, 812, 980, 1112, 1216]) {
      pillar(ctx, x, 96, FLOOR_Y, 19, CRYPT_FAR_INK, '#3a3859');
    }
    ctx.strokeStyle = CRYPT_FAR_INK;
    ctx.lineWidth = 6;
    for (const x of [372, 640, 980]) {
      ctx.beginPath();
      ctx.moveTo(x, 100);
      ctx.quadraticCurveTo(x + 84, 22, x + 168, 100);
      ctx.stroke();
    }
    // Dust haze washing the whole far plane down toward the floor.
    vgrad(ctx, 0, 150, W, FLOOR_Y - 150, [
      [0, 'rgba(120,96,102,0)'],
      [1, 'rgba(146,116,110,0.52)'],
    ]);
    ctx.fillStyle = '#2b2334';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  },

  mid(ctx, W) {
    // Dark, low-detail stone. Everything here sits behind an actor at some
    // point in the fight, so nothing may draw attention to itself.
    pillar(ctx, 336, 54, FLOOR_Y + 30, 32, CRYPT_MID_INK, '#241d38');
    pillar(ctx, 964, 40, FLOOR_Y + 34, 34, CRYPT_MID_INK, '#1d1730');
    pillar(ctx, 784, 200, FLOOR_Y + 8, 24, CRYPT_MID_INK, '#1c1730');
    pillar(ctx, 516, 236, FLOOR_Y + 4, 20, CRYPT_MID_INK, '#221b34');
    poly(ctx, [282, FLOOR_Y + 30, 296, 296, 336, 302, 330, FLOOR_Y + 34], CRYPT_MID_INK);
    for (const x of [612, 700, 1064]) {
      poly(ctx, [x - 44, FLOOR_Y + 20, x - 36, FLOOR_Y - 30, x + 36, FLOOR_Y - 30, x + 44, FLOOR_Y + 20], '#191426');
      ctx.fillStyle = '#0e0b18';
      ctx.fillRect(x - 32, FLOOR_Y - 36, 64, 7);
    }
    // The brazier that anchors the key — kept hard left, out of the actor row.
    poly(ctx, [212, FLOOR_Y + 26, 222, 352, 254, 352, 264, FLOOR_Y + 26], '#120e1c');
    poly(ctx, [206, 352, 270, 352, 260, 332, 216, 332], '#241a24');
    softBlob(ctx, 238, 320, 86, 74, '#ff7d20', 0.2);
    softBlob(ctx, 238, 312, 30, 28, '#ffca7a', 0.34);
    for (const x of [432, 700, 892, 1120]) {
      poly(ctx, [x - 24, FLOOR_Y + 42, x - 12, FLOOR_Y - 18, x + 12, FLOOR_Y - 18, x + 24, FLOOR_Y + 42], '#120e1e');
    }
    ctx.fillStyle = 'rgba(255,150,70,0.08)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    // The ground reads a clear step darker than the hazy mid-field behind it —
    // that step is what lets a lit head and shoulder separate from the room.
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#332a3a'],
      [0.3, '#1e1728'],
      [1, '#100c18'],
    ]);
    floorGrid(ctx, W, H, '#5a4c66', 0.15);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#080610';
    ctx.lineWidth = 2;
    for (const [x0, x1] of [[560, 470], [760, 900], [640, 660]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_Y + 20);
      ctx.lineTo((x0 + x1) / 2, FLOOR_Y + 130);
      ctx.lineTo(x1, H);
      ctx.stroke();
    }
    ctx.restore();
    for (const [x, y, r] of [[300, 470, 26], [1010, 540, 26], [214, 604, 34]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1528';
      ctx.fill();
      ctx.restore();
    }
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 150, -40, 112, H + 40, -40, H + 40], CRYPT_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 158, -40, W - 120, H + 40, W + 40, H + 40], CRYPT_NEAR_INK);
    poly(ctx, [-40, -40, 380, -40, 150, 74, 112, 150], CRYPT_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 380, -40, W - 158, 74, W - 120, 150], CRYPT_NEAR_INK);
  },
};

// ================================================================ FROST MARSH ==
// The opposite temperature and the opposite kind of space: no ceiling, no
// stone, a cold moon low over standing water. Same lighting geometry as the
// crypt — key upper left, cool fill from the lower right — because the sprites
// are lit that way and the scene has to agree with them.

const MARSH_FAR_INK = '#48627a';
const MARSH_MID_INK = '#12212b';
const MARSH_NEAR_INK = '#060f14';

/** A bare marsh tree: leaning trunk, three forks, no leaves. */
function deadTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  base: number,
  h: number,
  lean: number,
  color: string,
): void {
  const top = base - h;
  poly(ctx, [x - h * 0.055, base, x + lean - h * 0.02, top, x + lean + h * 0.02, top, x + h * 0.055, base], color);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const forks: readonly (readonly [number, number, number])[] = [
    [0.42, -1, 0.34],
    [0.62, 1, 0.28],
    [0.8, -1, 0.2],
  ];
  for (const [at, dir, len] of forks) {
    const bx = x + lean * at;
    const by = base - h * at;
    ctx.lineWidth = Math.max(2, h * 0.035 * (1 - at));
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + dir * h * len * 0.6, by - h * len * 0.4, bx + dir * h * len, by - h * len * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/** A clump of reeds fanning out of one point. */
function reeds(ctx: CanvasRenderingContext2D, x: number, base: number, h: number, n: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    ctx.lineWidth = 3 + (1 - Math.abs(t)) * 3;
    const tip = h * (0.62 + (1 - Math.abs(t)) * 0.38);
    ctx.beginPath();
    ctx.moveTo(x + t * 6, base);
    ctx.quadraticCurveTo(x + t * tip * 0.35, base - tip * 0.6, x + t * tip * 0.8, base - tip);
    ctx.stroke();
  }
  ctx.restore();
}

const MARSH: BiomeLook = {
  id: 'FROST MARSH',
  key: { color: '#7fdcc4', x: 196, y: 126, radius: 440, alpha: 0.22 },
  fill: { color: '#41579c', x: 1090, y: 630, radius: 660, alpha: 0.16 },
  pool: { color: '#8fe2d0', x: 640, y: 482, rx: 404, ry: 118, alpha: 0.2 },
  shafts: { color: '#a9e8dd', alpha: 0.06, x: 168, y: -80, angle: -0.46, count: 5, width: 44, length: 1020, gap: 136 },
  grade: {
    shadow: '#12293c',
    shadowAlpha: 0.22,
    vignette: 0.62,
    highlight: '#a9e8dd',
    highlightAlpha: 0.09,
  },
  fog: { color: '#7fa8ad', alpha: 0.105, y: 286, height: 300, speed: 9, bands: 2 },
  motes: { color: '#cdeee4', count: 56, size: 8, rise: 12, drift: 15 },
  rim: '#bff0e2',
  ambient: 'snow',
  ambientColor: '#456a72',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#101b26'],
      [0.28, '#20364a'],
      [0.48, '#3d5c6c'],
      [0.55, '#456471'],
      [0.66, '#223a45'],
      [1, '#13232c'],
    ]);
    // The cold moon, upper left, where the key light stands.
    softBlob(ctx, 196, 126, 250, 250, '#2f6f74', 0.32);
    ctx.beginPath();
    ctx.arc(196, 126, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#dcf4ec';
    ctx.fill();
    softBlob(ctx, 196, 126, 70, 70, '#a8e6dc', 0.3);
    for (const [x, h] of [[96, 128], [178, 96], [330, 150], [452, 104], [600, 128], [742, 88], [1046, 116], [1180, 148]] as const) {
      deadTree(ctx, x, FLOOR_Y - 4, h, (x % 7) - 3, MARSH_FAR_INK);
    }
    poly(ctx, [0, FLOOR_Y, 0, FLOOR_Y - 24, 300, FLOOR_Y - 36, 700, FLOOR_Y - 20, 1000, FLOOR_Y - 38, W, FLOOR_Y - 22, W, FLOOR_Y], '#38566a');
    for (const x of [120, 350, 620, 980, 1180]) reeds(ctx, x, FLOOR_Y - 12, 58, 7, '#3d6070');
    // Standing haze — the marsh's aerial perspective, heavier than the crypt's.
    vgrad(ctx, 0, 130, W, FLOOR_Y - 120, [
      [0, 'rgba(150,185,190,0)'],
      [1, 'rgba(160,196,198,0.4)'],
    ]);
  },

  mid(ctx, W) {
    deadTree(ctx, 306, FLOOR_Y + 28, 268, 22, MARSH_MID_INK);
    deadTree(ctx, 1064, FLOOR_Y + 34, 290, -26, MARSH_MID_INK);
    deadTree(ctx, 962, FLOOR_Y + 6, 148, 14, MARSH_MID_INK);
    poly(ctx, [1180, FLOOR_Y + 40, 1160, FLOOR_Y + 4, 890, FLOOR_Y + 14, 900, FLOOR_Y + 54], '#101f28');
    for (const x of [920, 986, 1052, 1120]) {
      ctx.fillStyle = '#0c1a22';
      ctx.fillRect(x, FLOOR_Y + 10, 9, 62);
    }
    // Will-o'-wisps, kept off the actor row so nothing bright sits behind a head.
    for (const [x, y, r] of [[188, 336, 22], [268, 400, 14], [1132, 316, 20], [1214, 372, 13]] as const) {
      softBlob(ctx, x, y, r * 3.6, r * 3.6, '#2f8f76', 0.5);
      softBlob(ctx, x, y, r, r, '#d8fff0', 0.8);
    }
    for (const x of [430, 700, 1128]) reeds(ctx, x, FLOOR_Y + 26, 96, 7, '#0d1b23');
    ctx.fillStyle = 'rgba(150,225,210,0.08)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    // Water, a clear step darker than the hazy bank behind it.
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#2c4a56'],
      [0.26, '#152932'],
      [1, '#0a141a'],
    ]);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let sy = FLOOR_Y + 10;
    let sstep = 11;
    while (sy < H) {
      const t = (sy - FLOOR_Y) / (H - FLOOR_Y);
      ctx.globalAlpha = 0.05 * (1 - t * 0.5);
      ctx.fillStyle = '#7fb6bd';
      ctx.fillRect(0, sy, W, Math.max(1, 1 + t * 3));
      sy += sstep;
      sstep *= 1.3;
    }
    ctx.restore();
    // The moon's column, widening as it comes forward.
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const y = FLOOR_Y + 14 + t * (H - FLOOR_Y);
      const w = 30 + t * 150;
      softBlob(ctx, 196 + Math.sin(i * 0.9) * 10, y, w, 7 + t * 11, '#9fe6d8', 0.1 * (1 - t * 0.62));
    }
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (const x of [306, 962, 1064]) {
      vgrad(ctx, x - 32, FLOOR_Y, 64, 210, [
        [0, '#08141a'],
        [1, 'rgba(8,20,26,0)'],
      ]);
    }
    ctx.restore();
    for (const [x, y, r] of [[300, 500, 44], [1010, 540, 40], [190, 626, 66]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0f2029';
      ctx.fill();
      ctx.restore();
    }
    for (const x of [252, 1046] as const) reeds(ctx, x, 552, 92, 5, '#0a171d');
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 96, -40, 70, H + 40, -40, H + 40], MARSH_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 104, -40, W - 78, H + 40, W + 40, H + 40], MARSH_NEAR_INK);
    reeds(ctx, 118, H + 30, 420, 9, MARSH_NEAR_INK);
    reeds(ctx, W - 128, H + 30, 380, 9, MARSH_NEAR_INK);
    ctx.save();
    ctx.strokeStyle = MARSH_NEAR_INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.quadraticCurveTo(240, 60, 470, 34);
    ctx.stroke();
    ctx.lineWidth = 11;
    for (const [x, y] of [[318, 60], [412, 44]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 30, y + 70, x + 6, y + 132);
      ctx.stroke();
    }
    ctx.restore();
  },
};

// ------------------------------------------------------------------ exports --

/**
 * Biome id -> diorama. Keyed by `Biome.name` from game/data/enemies.ts (the
 * string the battle screen already carries in `opts.biome`), with the
 * underscored spelling registered as an alias so either form resolves.
 */
export const BACKDROPS: BiomeLooks = {
  'EMBER CRYPT': CRYPT,
  EMBER_CRYPT: CRYPT,
  'FROST MARSH': MARSH,
  FROST_MARSH: MARSH,
};

/** The look for a biome name, falling back to the crypt for a biome phase 6b has not authored yet. */
export function backdropFor(biome: string): BiomeLook {
  return BACKDROPS[biome] ?? BACKDROPS[biome.replace(/[\s-]+/g, '_')] ?? CRYPT;
}
