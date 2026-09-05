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

// ================================================================ SKY RUINS ===
// Open air over a broken sky-city at dusk: the same key-upper-left /
// fill-lower-right geometry as every other biome, but the light is a low sun
// instead of a flame or a moon, and the "walls" are chunks of masonry with
// nothing holding them up. The actor row stays a gap of open twilight sky —
// islands and wind streaks crowd the edges and cross high overhead; nothing
// bright drifts through the middle at head height.

const RUINS_FAR_INK = '#3c3a5e';
const RUINS_MID_INK = '#3a3560';
const RUINS_NEAR_INK = '#0b0a17';

/** A chunk of floating rock: a flat-ish top, a jagged broken underside. */
function floatIsland(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, fill: string): void {
  const hw = w / 2;
  poly(ctx, [
    x - hw, baseY - h * 0.32,
    x - hw * 0.7, baseY - h,
    x - hw * 0.1, baseY - h * 0.86,
    x + hw * 0.55, baseY - h,
    x + hw, baseY - h * 0.3,
    x + hw * 0.62, baseY - h * 0.05,
    x + hw * 0.2, baseY,
    x - hw * 0.35, baseY - h * 0.08,
  ], fill);
}

/** A thin wind-blown streak — a tapered curved stroke, never a filled shape. */
function windStreak(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, bow: number, color: string, alpha: number, width: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.5, y + bow, x + len, y - bow * 0.4);
  ctx.stroke();
  ctx.restore();
}

const RUINS: BiomeLook = {
  id: 'SKY RUINS',
  key: { color: '#ffc266', x: 220, y: 138, radius: 460, alpha: 0.22 },
  fill: { color: '#5a5fb0', x: 1090, y: 630, radius: 660, alpha: 0.18 },
  pool: { color: '#ffd699', x: 640, y: 480, rx: 400, ry: 116, alpha: 0.18 },
  shafts: { color: '#ffdca0', alpha: 0.07, x: 170, y: -90, angle: -0.5, count: 4, width: 48, length: 1040, gap: 148 },
  grade: {
    shadow: '#221a3c',
    shadowAlpha: 0.2,
    vignette: 0.62,
    highlight: '#ffdca0',
    highlightAlpha: 0.09,
  },
  fog: { color: '#8f96c8', alpha: 0.05, y: 260, height: 240, speed: 6, bands: 2 },
  motes: { color: '#e8ddff', count: 58, size: 7, rise: -10, drift: 22 },
  rim: '#ffe0a8',
  ambient: 'stars',
  ambientColor: '#cdd0ff',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#0b0a1c'],
      [0.22, '#171438'],
      [0.42, '#2e2a5c'],
      [0.56, '#5a4a6e'],
      [0.66, '#7a5a5c'],
      [1, '#16142a'],
    ]);
    // A scatter of faint stars, well above head height, dim enough to never outshine the sun.
    ctx.save();
    ctx.fillStyle = '#f2eaff';
    const starXY: readonly (readonly [number, number, number])[] = [
      [80, 60, 0.5], [140, 110, 0.35], [420, 50, 0.4], [520, 90, 0.3], [700, 40, 0.45],
      [900, 70, 0.3], [1020, 110, 0.4], [1150, 55, 0.35], [1200, 130, 0.3], [980, 160, 0.25],
      [260, 150, 0.3], [60, 170, 0.3],
    ];
    for (const [x, y, a] of starXY) {
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
    // The low dusk sun, hard left of the actor row — same side as the key light it feeds.
    softBlob(ctx, 220, 138, 190, 190, '#ffb85e', 0.3);
    ctx.beginPath();
    ctx.arc(220, 138, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#fff1d8';
    ctx.fill();
    softBlob(ctx, 220, 138, 62, 62, '#ffe6b0', 0.32);
    // Distant floating islands, hazy, spread the full width but kept above the head band.
    for (const [x, y, w, h] of [[120, 210, 130, 60], [430, 180, 90, 44], [760, 230, 150, 64], [1080, 190, 110, 52], [1220, 260, 90, 46]] as const) {
      floatIsland(ctx, x, y, w, h, RUINS_FAR_INK);
    }
    windStreak(ctx, -20, 150, 340, -26, '#dcd6ff', 0.14, 3);
    windStreak(ctx, 900, 220, 320, -18, '#dcd6ff', 0.12, 2);
    vgrad(ctx, 0, 150, W, FLOOR_Y - 150, [
      [0, 'rgba(150,140,180,0)'],
      [1, 'rgba(170,150,170,0.42)'],
    ]);
    ctx.fillStyle = '#241f38';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  },

  mid(ctx, W) {
    // Bigger, closer masonry, still clear of the actor row at head height.
    floatIsland(ctx, 210, FLOOR_Y - 70, 210, 130, RUINS_MID_INK);
    pillar(ctx, 236, FLOOR_Y - 176, FLOOR_Y - 76, 16, RUINS_MID_INK, '#443e6c');
    floatIsland(ctx, 1080, FLOOR_Y - 40, 240, 150, RUINS_MID_INK);
    arch(ctx, 1080, 44, FLOOR_Y - 172, FLOOR_Y - 76, RUINS_MID_INK);
    // The arch's key-lit edge — the side facing the sun catches a warm rim,
    // the one thing that reads this as a RUIN and not a silhouette cut-out.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffd699';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(1036, FLOOR_Y - 128);
    ctx.quadraticCurveTo(1036, FLOOR_Y - 172, 1080, FLOOR_Y - 172);
    ctx.stroke();
    ctx.restore();
    floatIsland(ctx, 620, 150, 130, 60, '#38335c');
    for (const x of [520, 780]) {
      poly(ctx, [x - 20, FLOOR_Y + 10, x - 12, FLOOR_Y - 40, x + 12, FLOOR_Y - 40, x + 20, FLOOR_Y + 10], '#1c1932');
    }
    windStreak(ctx, 340, 260, 300, -20, '#bcb4e8', 0.12, 3);
    windStreak(ctx, 760, 300, 260, 18, '#bcb4e8', 0.1, 2);
    ctx.fillStyle = 'rgba(255,200,140,0.07)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#342f4c'],
      [0.3, '#1e1a30'],
      [1, '#100e1c'],
    ]);
    // A whisper of the perspective grid — structure, not a synthwave floor.
    floorGrid(ctx, W, H, '#584f7c', 0.11);
    // Broken flagstones: irregular missing slabs, not a uniform lattice.
    for (const [x, y, w, h] of [[400, 470, 90, 46], [880, 520, 110, 50], [640, 600, 70, 34]] as const) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      poly(ctx, [x - w / 2, y, x - w * 0.3, y - h / 2, x + w * 0.4, y - h * 0.4, x + w / 2, y + h * 0.1, x + w * 0.2, y + h / 2, x - w * 0.2, y + h * 0.4], '#0e0b1a');
      ctx.restore();
    }
    for (const [x, y, r] of [[280, 470, 24], [1020, 540, 26], [640, 610, 40]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1830';
      ctx.fill();
      ctx.restore();
    }
    // Cracks radiating between the broken slabs — a platform holding itself
    // together, not a void.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#080612';
    ctx.lineWidth = 2;
    for (const [x0, x1] of [[520, 440], [740, 860], [640, 620], [420, 340], [900, 960]] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, FLOOR_Y + 18);
      ctx.lineTo((x0 + x1) / 2, FLOOR_Y + 120);
      ctx.lineTo(x1, H);
      ctx.stroke();
    }
    ctx.restore();
    // The platform's broken edge, hard left and right — this floor ends in open air.
    poly(ctx, [0, H, 0, FLOOR_Y + 30, 60, FLOOR_Y + 50, 30, FLOOR_Y + 90, 0, H], '#0c0a16');
    poly(ctx, [W, H, W, FLOOR_Y + 34, W - 54, FLOOR_Y + 56, W - 26, FLOOR_Y + 96, W, H], '#0c0a16');
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 140, -40, 104, H + 40, -40, H + 40], RUINS_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 148, -40, W - 112, H + 40, W + 40, H + 40], RUINS_NEAR_INK);
    floatIsland(ctx, 60, 40, 220, 130, RUINS_NEAR_INK);
    floatIsland(ctx, W - 60, 70, 220, 140, RUINS_NEAR_INK);
    windStreak(ctx, -30, H * 0.5, 300, -30, RUINS_NEAR_INK, 0.5, 10);
    windStreak(ctx, W + 30, H * 0.42, -300, 26, RUINS_NEAR_INK, 0.5, 10);
  },
};

// ================================================================ ASHEN FORGE ==
// An industrial furnace hall: the same warm-key / cool-fill geometry as the
// crypt, pushed hotter and harder — one great furnace mouth at the far left
// throws the key light, chains hang from a ceiling that never fully resolves,
// and anvils sit at the edges. The actor row stays dark iron and soot; the
// glow lives at the margins, the same discipline as the crypt's brazier.

const FORGE_FAR_INK = '#3a1e1a';
const FORGE_MID_INK = '#171313';
const FORGE_NEAR_INK = '#090504';

/** An anvil silhouette: a flat base, a tapered waist, a horn to one side. */
function anvilShape(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, fill: string): void {
  const hw = w / 2;
  poly(ctx, [x - hw * 0.55, baseY, x - hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY - w * 0.16, x + hw * 0.55, baseY], fill);
  poly(ctx, [x - hw * 0.4, baseY - w * 0.16, x - hw * 0.28, baseY - w * 0.5, x + hw * 0.28, baseY - w * 0.5, x + hw * 0.4, baseY - w * 0.16], fill);
  poly(ctx, [x - hw * 0.5, baseY - w * 0.5, x - hw * 0.5, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.62, x + hw * 0.32, baseY - w * 0.5], fill);
  poly(ctx, [x + hw * 0.2, baseY - w * 0.58, x + hw * 1.1, baseY - w * 0.7, x + hw * 1.08, baseY - w * 0.58, x + hw * 0.28, baseY - w * 0.48], fill);
}

/** A hanging chain: a column of small linked rings. */
function chainLine(ctx: CanvasRenderingContext2D, x: number, topY: number, botY: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  const link = 13;
  for (let y = topY; y < botY; y += link) {
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const FORGE: BiomeLook = {
  id: 'ASHEN FORGE',
  key: { color: '#ff5a2e', x: 210, y: 168, radius: 460, alpha: 0.24 },
  fill: { color: '#3d4a7a', x: 1085, y: 630, radius: 660, alpha: 0.22 },
  pool: { color: '#ff8a4a', x: 640, y: 486, rx: 400, ry: 122, alpha: 0.28 },
  shafts: { color: '#ff8552', alpha: 0.07, x: 140, y: -80, angle: -0.5, count: 4, width: 50, length: 1040, gap: 150 },
  grade: {
    shadow: '#2a1210',
    shadowAlpha: 0.22,
    vignette: 0.66,
    highlight: '#ff9a5c',
    highlightAlpha: 0.11,
  },
  fog: { color: '#5a3a2e', alpha: 0.06, y: 300, height: 260, speed: 6, bands: 2 },
  motes: { color: '#ffab5a', count: 66, size: 8, rise: -30, drift: 14 },
  rim: '#ffb073',
  ambient: 'embers',
  ambientColor: '#c1360f',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#0a0806'],
      [0.24, '#1c110c'],
      [0.46, '#341c14'],
      [0.56, '#3e2216'],
      [0.68, '#241410'],
      [1, '#120a08'],
    ]);
    // The great furnace mouth, hard left — the room's one true light source.
    arch(ctx, 200, 100, 118, FLOOR_Y, '#2a1208');
    arch(ctx, 200, 62, 168, FLOOR_Y, '#5c2408');
    softBlob(ctx, 200, 320, 130, 128, '#ff5a1c', 0.22);
    softBlob(ctx, 200, 300, 46, 44, '#ffd27a', 0.3);
    // Ceiling ductwork and hanging chains, none of it over the actor row's centre.
    for (const x of [340, 900, 1150]) chainLine(ctx, x, 0, 150, '#0e0806', 0.6);
    for (const x of [380, 460, 940, 1080]) {
      pillar(ctx, x, 60, FLOOR_Y, 17, FORGE_FAR_INK, '#4a2418');
    }
    vgrad(ctx, 0, 150, W, FLOOR_Y - 150, [
      [0, 'rgba(120,70,50,0)'],
      [1, 'rgba(150,90,60,0.5)'],
    ]);
    ctx.fillStyle = '#241108';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  },

  mid(ctx, W) {
    // Soot-grey iron, not a second light source — the furnace mouth stays the
    // only saturated colour in the room; everything else is what it lights.
    anvilShape(ctx, 250, FLOOR_Y + 30, 96, FORGE_MID_INK);
    anvilShape(ctx, 1040, FLOOR_Y + 24, 104, FORGE_MID_INK);
    for (const x of [560, 700, 860]) chainLine(ctx, x, 20, 200, '#100907', 0.55);
    pillar(ctx, 1150, 90, FLOOR_Y + 20, 26, FORGE_MID_INK, '#332c2a');
    // A handful of drifting embers — small, dim, no new light source.
    for (const [x, y, r] of [[300, 260, 2.5], [1120, 230, 2.5], [640, 200, 1.8]] as const) {
      softBlob(ctx, x, y, r * 5, r * 5, '#c17a3e', 0.12);
    }
    ctx.fillStyle = 'rgba(255,110,40,0.06)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    // Soot-grey, not the mid plane's orange-brown — the floor is what the
    // furnace lights, not a light source of its own.
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#241c18'],
      [0.28, '#171312'],
      [1, '#0e0b0a'],
    ]);
    floorGrid(ctx, W, H, '#5a3a28', 0.16);
    // Cooled runnels of slag, held to the sides (x < 350 / > 930) — a dim
    // ember fill, not a stroke, tapering wide-near/narrow-far to the vanishing
    // point, so nothing bright crosses the actor row.
    for (const [x0, x1] of [[200, 160], [290, 250], [1000, 1040]] as const) {
      const midx = (x0 + x1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#c2521c';
      ctx.beginPath();
      ctx.moveTo(x0 - 1, FLOOR_Y + 16);
      ctx.lineTo(x0 + 1, FLOOR_Y + 16);
      ctx.lineTo(midx + 2, FLOOR_Y + 120);
      ctx.lineTo(midx - 2, FLOOR_Y + 120);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(midx - 2, FLOOR_Y + 120);
      ctx.lineTo(midx + 2, FLOOR_Y + 120);
      ctx.lineTo(x1 + 3, H);
      ctx.lineTo(x1 - 3, H);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    for (const [x, y, r] of [[300, 470, 26], [1010, 540, 28], [220, 610, 36]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#180d09';
      ctx.fill();
      ctx.restore();
    }
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 150, -40, 112, H + 40, -40, H + 40], FORGE_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 158, -40, W - 120, H + 40, W + 40, H + 40], FORGE_NEAR_INK);
    chainLine(ctx, 90, -40, 140, FORGE_NEAR_INK, 0.9);
    chainLine(ctx, W - 100, -40, 170, FORGE_NEAR_INK, 0.9);
    anvilShape(ctx, 130, H - 30, 150, FORGE_NEAR_INK);
  },
};

// ================================================================ SUNKEN VAULT ==
// A drowned reliquary: the crypt's own pillars and arches, submerged and cold,
// lit by a shaft of surface light instead of a flame. Caustic ripples stand in
// for the crypt's dust haze; drifting silt stands in for its embers. The vault
// door itself follows the crypt's OWN brazier discipline — held off to one
// side (x ~= 980), never centred behind the actor row — and the flanking
// columns stay past x < 330 / x > 950 too, so the middle of the frame is open,
// dim water.

const VAULT_FAR_INK = '#1c3a4a';
const VAULT_MID_INK = '#0e222c';
const VAULT_NEAR_INK = '#050f14';

/** A band of wavering underwater light — thin sine-wave strokes, composited additive. */
function causticBand(ctx: CanvasRenderingContext2D, y: number, w: number, color: string, alpha: number, seed: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = alpha * (1 - i * 0.16);
    ctx.beginPath();
    const yy = y + i * 13;
    for (let x = 0; x <= w; x += 24) {
      const yo = Math.sin((x + seed + i * 46) * 0.021) * 9;
      if (x === 0) ctx.moveTo(x, yy + yo);
      else ctx.lineTo(x, yy + yo);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const VAULT: BiomeLook = {
  id: 'SUNKEN VAULT',
  key: { color: '#6fd8ff', x: 210, y: 132, radius: 460, alpha: 0.2 },
  fill: { color: '#1c3a78', x: 1085, y: 630, radius: 660, alpha: 0.19 },
  pool: { color: '#7fe2ff', x: 640, y: 484, rx: 402, ry: 118, alpha: 0.2 },
  shafts: { color: '#a6ecff', alpha: 0.075, x: 160, y: -90, angle: -0.48, count: 5, width: 46, length: 1040, gap: 138 },
  grade: {
    shadow: '#08202c',
    shadowAlpha: 0.24,
    vignette: 0.64,
    highlight: '#9fe8ff',
    highlightAlpha: 0.09,
  },
  fog: { color: '#3f7488', alpha: 0.09, y: 290, height: 280, speed: 5, bands: 2 },
  motes: { color: '#cdeeff', count: 70, size: 6, rise: 14, drift: 12 },
  rim: '#bdeeff',
  ambient: 'bubbles',
  ambientColor: '#2f7c8a',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#040f16'],
      [0.24, '#0c2432'],
      [0.46, '#164358'],
      [0.56, '#1b4d5e'],
      [0.68, '#0f2e38'],
      [1, '#081a22'],
    ]);
    // The surface light column, hard left, feeding the key.
    softBlob(ctx, 210, 100, 230, 260, '#2f97b8', 0.3);
    softBlob(ctx, 210, 132, 60, 60, '#cdf3ff', 0.3);
    // The vault door itself, held off to one side — the crypt's own brazier
    // discipline — with flanking columns past the actor band on both edges.
    arch(ctx, 980, 108, 118, FLOOR_Y, VAULT_FAR_INK);
    for (const x of [180, 260]) pillar(ctx, x, 130, FLOOR_Y, 18, VAULT_FAR_INK, '#2c5262');
    for (const x of [1060, 1180]) pillar(ctx, x, 170, FLOOR_Y, 16, VAULT_FAR_INK, '#264854');
    causticBand(ctx, 190, W, '#9fe2f2', 0.1, 0);
    vgrad(ctx, 0, 150, W, FLOOR_Y - 150, [
      [0, 'rgba(120,180,190,0)'],
      [1, 'rgba(120,190,198,0.4)'],
    ]);
    ctx.fillStyle = '#0e222c';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  },

  mid(ctx, W) {
    pillar(ctx, 300, 60, FLOOR_Y + 30, 30, VAULT_MID_INK, '#1c3844');
    // The door's own inner frame, nested at the same off-centre x as the far
    // plane's arch — depth, not a second doorway in the middle of the room.
    arch(ctx, 980, 62, 216, FLOOR_Y + 8, '#132a34');
    // A toppled column, half-buried — the only diagonal in an otherwise upright room.
    ctx.save();
    ctx.translate(150, FLOOR_Y + 10);
    ctx.rotate(-0.32);
    poly(ctx, [-140, -18, 140, -18, 140, 18, -140, 18], VAULT_MID_INK);
    ctx.restore();
    // No caustic band at head height here — that patch is what the floor
    // plane's own two bands (below FLOOR_Y, at foot level) are for.
    for (const [x, y, r] of [[210, 340, 16], [270, 400, 10], [1060, 320, 15], [1140, 380, 9]] as const) {
      softBlob(ctx, x, y, r * 2.4, r * 2.4, '#7fe0d0', 0.28);
    }
    ctx.fillStyle = 'rgba(150,225,235,0.08)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#173842'],
      [0.28, '#0d222a'],
      [1, '#061318'],
    ]);
    causticBand(ctx, FLOOR_Y + 30, W, '#a6e6f2', 0.08, 220);
    causticBand(ctx, FLOOR_Y + 120, W, '#a6e6f2', 0.06, 300);
    for (const [x, y, r] of [[300, 470, 26], [1010, 540, 26], [200, 606, 34]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0a1e24';
      ctx.fill();
      ctx.restore();
    }
    // Drifting silt drifts settled on the flagstones, a shade darker than the floor.
    for (const [x, y, w] of [[420, 480, 60], [780, 520, 80], [980, 460, 50]] as const) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, Math.PI * 2);
      ctx.fillStyle = '#12303a';
      ctx.fill();
      ctx.restore();
    }
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 100, -40, 74, H + 40, -40, H + 40], VAULT_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 108, -40, W - 82, H + 40, W + 40, H + 40], VAULT_NEAR_INK);
    pillar(ctx, 70, -40, H + 20, 42, VAULT_NEAR_INK, '#0a1c22');
    pillar(ctx, W - 76, -40, H + 20, 40, VAULT_NEAR_INK, '#0a1c22');
    // Silt clouds hanging in the water, right at the frame edges.
    softBlob(ctx, 40, H * 0.6, 160, 200, '#0d262e', 0.5);
    softBlob(ctx, W - 40, H * 0.5, 170, 210, '#0d262e', 0.5);
  },
};

// ================================================================ STORM SPIRE ==
// A tower top above the weather: the crypt's geometry once more, but the key
// light is the afterglow of a lightning strike and the "ceiling" is open sky
// with a sea of storm cloud sitting right at the horizon line. Banners and
// broken battlements frame the edges; the actor row stays clear night air.

const SPIRE_MID_INK = '#171b2c';
const SPIRE_NEAR_INK = '#08090f';

/** A small triangular banner, hanging from a point and fluttering to one side. */
function pennant(ctx: CanvasRenderingContext2D, x: number, topY: number, len: number, lean: number, fill: string): void {
  poly(ctx, [x - 3, topY, x + 3, topY, x + lean, topY + len * 0.5, x + lean * 0.4, topY + len], fill);
}

/** A jagged lightning stroke: a soft wide glow pass under a bright narrow core — never a 2-px scribble. */
function boltStreak(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string, alpha: number): void {
  const pts: readonly (readonly [number, number])[] = [
    [x, y],
    [x + len * 0.2, y + len * 0.2],
    [x - len * 0.05, y + len * 0.32],
    [x + len * 0.16, y + len * 0.56],
    [x - len * 0.04, y + len * 0.64],
    [x + len * 0.12, y + len * 0.86],
    [x, y + len],
  ];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.globalAlpha = alpha * 0.32;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.restore();
}

/** A tapering Gothic spire: three narrowing tiers, a lit ledge, a couple of lit windows and a cross-strut spike. */
function spireTower(ctx: CanvasRenderingContext2D, x: number, base: number, top: number, baseHalf: number, fill: string, lit: string): void {
  const h = base - top;
  const tiers: readonly (readonly [number, number])[] = [
    [base - h * 0.32, baseHalf],
    [base - h * 0.6, baseHalf * 0.66],
    [base - h * 0.82, baseHalf * 0.38],
    [top, baseHalf * 0.1],
  ];
  let py = base;
  let ph = baseHalf;
  for (const [y, half] of tiers) {
    poly(ctx, [x - ph, py, x - half, y, x + half, y, x + ph, py], fill);
    py = y;
    ph = half;
  }
  // A lit rim down the key-facing (left) edge of every tier — an outline
  // reads as a silhouette regardless of what light washes over the fill.
  ctx.save();
  ctx.strokeStyle = lit;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  py = base;
  ph = baseHalf;
  ctx.beginPath();
  ctx.moveTo(x - ph, py);
  for (const [y, half] of tiers) {
    ctx.lineTo(x - half, y);
    py = y;
    ph = half;
  }
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = lit;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - baseHalf * 0.7, base - h * 0.32);
  ctx.lineTo(x + baseHalf * 0.7, base - h * 0.32);
  ctx.moveTo(x - baseHalf * 0.46, base - h * 0.6);
  ctx.lineTo(x + baseHalf * 0.46, base - h * 0.6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top - h * 0.09);
  ctx.moveTo(x - h * 0.025, top - h * 0.035);
  ctx.lineTo(x + h * 0.025, top - h * 0.035);
  ctx.strokeStyle = fill;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = lit;
  ctx.fillRect(x - 3, base - h * 0.46, 6, 10);
  ctx.fillRect(x - 3, base - h * 0.72, 5, 8);
  ctx.restore();
}

const SPIRE: BiomeLook = {
  id: 'STORM SPIRE',
  key: { color: '#cfe0ff', x: 220, y: 150, radius: 470, alpha: 0.22 },
  fill: { color: '#443f6e', x: 1085, y: 630, radius: 660, alpha: 0.18 },
  pool: { color: '#d8ecff', x: 640, y: 482, rx: 400, ry: 116, alpha: 0.18 },
  shafts: { color: '#dfeaff', alpha: 0.065, x: 180, y: -90, angle: -0.5, count: 4, width: 46, length: 1030, gap: 150 },
  grade: {
    shadow: '#1a1a30',
    shadowAlpha: 0.22,
    vignette: 0.65,
    highlight: '#d6e6ff',
    highlightAlpha: 0.1,
  },
  fog: { color: '#5a6088', alpha: 0.07, y: 270, height: 250, speed: 10, bands: 2 },
  motes: { color: '#e2ecff', count: 54, size: 7, rise: 20, drift: 26 },
  rim: '#e6f0ff',
  ambient: 'rain',
  ambientColor: '#7d9fd0',

  far(ctx, W, H) {
    vgrad(ctx, 0, 0, W, H, [
      [0, '#07070f'],
      [0.24, '#12142a'],
      [0.44, '#232748'],
      [0.56, '#343458'],
      [0.68, '#22233c'],
      [1, '#131424'],
    ]);
    // The afterglow of the last strike, hard left, feeding the key light.
    softBlob(ctx, 220, 150, 240, 240, '#a8c8ff', 0.3);
    softBlob(ctx, 224, 40, 46, 46, '#f2f8ff', 0.4);
    boltStreak(ctx, 224, 40, 220, '#eaf2ff', 0.75);
    boltStreak(ctx, 980, 20, 150, '#dbe8ff', 0.28);
    // A sea of storm cloud sitting right at the horizon, held past x < 330 /
    // x > 950 — the actor band stays clear night air, not pale cloud. A lit
    // top edge is what sells a CLOUD instead of a smudge, kept dim (0.15) so
    // it never becomes the brightest patch in the frame.
    for (const [x, y, r] of [[80, FLOOR_Y - 6, 130], [300, FLOOR_Y - 20, 150], [1020, FLOOR_Y - 6, 150], [1200, FLOOR_Y - 16, 130]] as const) {
      softBlob(ctx, x, y + r * 0.16, r, r * 0.5, '#454e78', 0.65);
      softBlob(ctx, x, y - r * 0.18, r * 0.8, r * 0.32, '#7883b8', 0.15);
    }
    // A sister spire, off to the right, taller than anything else in frame — a
    // real tapering silhouette (tiers, a lit ledge, windows), not a hairline.
    // Drawn LAST (opaque fills), over the additive cloud glow, so it stays a
    // crisp silhouette instead of washing out under it.
    spireTower(ctx, 1150, FLOOR_Y, 26, 58, SPIRE_NEAR_INK, '#c9d6ff');
    vgrad(ctx, 0, 150, W, FLOOR_Y - 150, [
      [0, 'rgba(150,160,200,0)'],
      [1, 'rgba(170,180,210,0.34)'],
    ]);
    ctx.fillStyle = '#171930';
    ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  },

  mid(ctx, W) {
    // Broken battlements at the edges — varied heights and widths, not six
    // identical slabs, framing the platform without crowding it.
    const leftMerlons: readonly (readonly [number, number, number])[] = [[294, 15, 68], [336, 19, 46], [380, 14, 60]];
    const rightMerlons: readonly (readonly [number, number, number])[] = [[882, 14, 58], [924, 20, 72], [968, 15, 44]];
    for (const [x, hw, h] of [...leftMerlons, ...rightMerlons]) {
      poly(ctx, [x - hw, FLOOR_Y + 10, x - hw, FLOOR_Y - h, x + hw, FLOOR_Y - h, x + hw, FLOOR_Y + 10], SPIRE_MID_INK);
    }
    pennant(ctx, 294, FLOOR_Y - 68, 70, 26, '#242840');
    pennant(ctx, 924, FLOOR_Y - 72, 66, -24, '#242840');
    // A lower cloud bank, closer, drifting just under the parapets — held past
    // the actor band on both sides.
    for (const [x, y, r] of [[160, FLOOR_Y + 24, 130], [1120, FLOOR_Y + 26, 130]] as const) {
      softBlob(ctx, x, y, r, r * 0.42, '#2a2f4c', 0.55);
      softBlob(ctx, x, y - r * 0.2, r * 0.7, r * 0.2, '#565f90', 0.15);
    }
    ctx.fillStyle = 'rgba(200,215,255,0.08)';
    ctx.fillRect(0, FLOOR_Y - 2, W, 3);
  },

  floor(ctx, W, H) {
    vgrad(ctx, 0, FLOOR_Y, W, H - FLOOR_Y, [
      [0, '#2a2c40'],
      [0.3, '#181a2a'],
      [1, '#0c0d18'],
    ]);
    floorGrid(ctx, W, H, '#565c82', 0.14);
    for (const [x, y, r] of [[290, 468, 24], [1010, 538, 26], [640, 606, 38]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#161828';
      ctx.fill();
      ctx.restore();
    }
    fadeTop(ctx, W, FLOOR_Y - 2, 44);
  },

  near(ctx, W, H) {
    poly(ctx, [-40, -40, 150, -40, 112, H + 40, -40, H + 40], SPIRE_NEAR_INK);
    poly(ctx, [W + 40, -40, W - 158, -40, W - 120, H + 40, W + 40, H + 40], SPIRE_NEAR_INK);
    poly(ctx, [-20, H + 40, -20, H - 40, 40, H - 60, 100, H - 40, 100, H + 40], SPIRE_NEAR_INK);
    poly(ctx, [W + 20, H + 40, W + 20, H - 40, W - 40, H - 60, W - 100, H - 40, W - 100, H + 40], SPIRE_NEAR_INK);
    pennant(ctx, 130, -40, 240, 40, SPIRE_NEAR_INK);
    pennant(ctx, W - 140, -40, 220, -36, SPIRE_NEAR_INK);
    // The rampart the camera stands behind — crenellations along the bottom
    // edge, sides only, so the frame reads as looking OUT from a tower top.
    const MERLON = 46;
    const MERLON_H = 64;
    for (let x = -20; x < 200; x += MERLON) poly(ctx, [x, H + 20, x, H - MERLON_H, x + MERLON * 0.62, H - MERLON_H, x + MERLON * 0.62, H + 20], SPIRE_NEAR_INK);
    for (let x = W + 20; x > W - 200; x -= MERLON) poly(ctx, [x, H + 20, x, H - MERLON_H, x - MERLON * 0.62, H - MERLON_H, x - MERLON * 0.62, H + 20], SPIRE_NEAR_INK);
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
  'SKY RUINS': RUINS,
  SKY_RUINS: RUINS,
  'ASHEN FORGE': FORGE,
  ASHEN_FORGE: FORGE,
  'SUNKEN VAULT': VAULT,
  SUNKEN_VAULT: VAULT,
  'STORM SPIRE': SPIRE,
  STORM_SPIRE: SPIRE,
};

/** The look for a biome name, falling back to the crypt for a biome phase 6b has not authored yet. */
export function backdropFor(biome: string): BiomeLook {
  return BACKDROPS[biome] ?? BACKDROPS[biome.replace(/[\s-]+/g, '_')] ?? CRYPT;
}
