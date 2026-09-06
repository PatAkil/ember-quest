// tools/backdrops.ts — the diorama loop's eyes. Dev-server only (Vite serves
// it at /tools/backdrops.html; `vite build` never bundles it and nothing in
// game/ or engine/ imports it).
//
// Renders ONE biome's diorama through the real engine/light.ts pipeline —
// createLight, setBiome, renderBackground -> renderLightPlane -> renderPost —
// with NO actors, so a backdrop can be screenshotted and judged on its own,
// without a battle in that act (phase 6b's SKY RUINS / ASHEN FORGE / SUNKEN
// VAULT / STORM SPIRE have no playable battle reaching them yet).
//
//   actors=6                   feed renderLightPlane N ACTOR BOXES at layout.ts's own
//                              feet anchors (default 0). The picture is nonsense — light
//                              on an empty floor — but the TIMING is the stage's real
//                              per-actor cost: the actor plane's multiplicative gain, the
//                              rim spill and a prop's floor pool. A backdrop capture must
//                              stay at actors=0, where it is byte-identical.
//   biome=SKY_RUINS            which BACKDROPS entry to draw (default EMBER_CRYPT;
//                              accepts either the spaced or underscored form)
//   tier=HIGH|MED|LOW|ARCADE   light quality tier (default HIGH, the desktop default).
//                              ARCADE additionally runs engine/crt.ts over the finished
//                              frame, exactly as the game does — without it an ARCADE
//                              capture is byte-identical to LOW.
//   blank=1                    perf control: the same look with flat-fill painters
//   runs=40 batches=5          the per-frame cost is the MIN of `batches` batch means of
//                              `runs` frames each — the machine runs other agents' builds,
//                              and a single mean measures their load as much as the frame
//   dim=0.62                   paint engine/ui.ts's `dimScene` fill over the finished
//                              frame at that alpha — the terminal-overlay case the
//                              GAME_OVER / WIN / PAUSED screens draw. It is here because
//                              a flat multiply over a hard-edged sky body is what turned
//                              the marsh's moon into a grey coin with a cyan ring
//                              (first-ten-minutes defect 5), and that defect took a
//                              whole `playfull acts=2` run to see. 0 (default) skips it.
//   shake=14                   feed renderBackground a camera shake of that many px on
//                              both axes. The planes lag it by their own depth
//                              (drawPlane), and the sky body has to follow the FAR
//                              plane's lag exactly or it detaches from its own disc —
//                              which is the state a GAME_OVER frame is drawn in, because
//                              the death shake is still running. 0 (default) is a still.
//   t=2.4                      the frame time in seconds fed to every render call —
//                              fog bands, light shafts and the key-light breathing
//                              alpha are all a function of this, so a nonzero moment
//                              avoids catching them at their t=0 rest pose. Dust motes
//                              keep their baked, already-spread seed positions either
//                              way: renderLightPlane's own dt is 0 on this cold first
//                              call, exactly as it is on the game's own first frame.
//
// capture: node tools/capture.mjs shot url=/tools/backdrops.html?biome=SKY_RUINS name=backdrop-SKY_RUINS

import { createLight, createCrt } from '../engine';
import type { BiomeLook, LightActor, LightTier } from '../engine';
import { CANVAS_W, CANVAS_H, HERO_FEET, ENEMY_FEET } from '../game/screens/layout';
import { BACKDROPS, backdropFor } from '../game/art/backdrops';

const params = new URLSearchParams(location.search);
const biomeParam = params.get('biome') ?? 'EMBER_CRYPT';
const TIME = Number(params.get('t') ?? 2.4);

function parseTier(s: string): LightTier {
  const up = s.toUpperCase();
  if (up === 'MED' || up === 'LOW' || up === 'ARCADE' || up === 'HIGH') return up;
  return 'HIGH';
}
const TIER = parseTier(params.get('tier') ?? 'HIGH');

/**
 * How many ACTOR BOXES to hand renderLightPlane. Default 0 — a backdrop is
 * judged with nobody on the stage, and that capture must stay byte-identical
 * whatever the actor plane's light law is doing.
 *
 * It is not 0 for the PERF question, though: the actor plane's light (the
 * multiplicative gain, the rim spill, a prop's floor pool) is per-actor work
 * that a no-actor frame never pays, so `actors=6` puts the full six-body stage
 * on the timing without drawing a single sprite. The boxes are the real ones —
 * layout.ts's three hero and three enemy feet anchors, ACTOR_W wide and as tall
 * as a hero stands — so the number is the stage's own cost, not a synthetic
 * one. The frame it screenshots is nonsense (light on an empty floor); read the
 * timing, not the picture.
 */
const ACTOR_N = Math.max(0, Math.min(8, Number(params.get('actors') ?? 0)));
const ACTOR_BOX_W = 128;
const ACTOR_BOX_H = 112;
const actorBoxes: LightActor[] = [];
for (let i = 0; i < ACTOR_N; i++) {
  const f = i < 3 ? HERO_FEET[i] : ENEMY_FEET[i - 3];
  actorBoxes.push({
    x: f.x - ACTOR_BOX_W / 2,
    y: f.y - ACTOR_BOX_H,
    w: ACTOR_BOX_W,
    h: ACTOR_BOX_H,
    glow: i === 0 ? 0.8 : 0,
  });
}

const canvas = document.getElementById('sheet') as HTMLCanvasElement;
const out = document.getElementById('metrics') as HTMLPreElement;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
canvas.style.width = `${CANVAS_W}px`;
canvas.style.height = `${CANVAS_H}px`;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('backdrops: 2D context unavailable');
// The diorama is a smooth layer (blurred planes, gradients, bloom) — the same
// smoothing main.ts turns on for its own pixel canvas before this module ever draws.
ctx.imageSmoothingEnabled = true;

const real: BiomeLook = backdropFor(biomeParam);
// blank=1 is the PERF CONTROL. Same BiomeLook — same plane sizes, same fog,
// same mote count, same bloom and grade — but the four painters are reduced to
// one flat fill each. Everything the plane painters draw happens at bake time
// into a fixed-size offscreen, so if the control and the real biome cost the
// same per frame, adding a hundred scattered stones to a painter is free at
// frame time, which is the claim the ground pass rests on.
const flat = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  c.fillStyle = '#20202c';
  c.fillRect(0, 0, w, h);
};
const look: BiomeLook =
  params.get('blank') === '1' ? { ...real, far: flat, mid: flat, floor: flat, near: flat } : real;
const light = createLight({ width: CANVAS_W, height: CANVAS_H, tier: TIER });

// No actors: just the diorama, in the battle screen's own three-call order.
const g2d = ctx;
// ARCADE is LOW's planes with the CRT applied over them (DESIGN.md's tier
// table): bloom and CRT halation are the same effect and exactly one runs. The
// tool used to stop after renderPost, so an ARCADE capture came back
// byte-identical to LOW and the ARCADE look was never actually verifiable.
const crt = TIER === 'ARCADE' ? createCrt() : null;
// The terminal overlay, byte for byte what engine/ui.ts's dimScene paints
// (a flat black source-over, oversized so a shake cannot expose an edge).
const DIM = Math.max(0, Math.min(1, Number(params.get('dim') ?? 0)));
const SHAKE = Number(params.get('shake') ?? 0);
function frame(t: number): void {
  g2d.clearRect(0, 0, CANVAS_W, CANVAS_H);
  light.renderBackground(g2d, { time: t, shakeX: SHAKE, shakeY: SHAKE * 0.6 });
  light.renderLightPlane(g2d, ACTOR_N > 0 ? { time: t, actors: actorBoxes } : { time: t });
  light.renderPost(g2d, { time: t });
  if (crt) crt.render(g2d, CANVAS_W, CANVAS_H, 1 / 60);
  if (DIM > 0) {
    g2d.save();
    g2d.fillStyle = `rgba(0,0,0,${DIM})`;
    g2d.fillRect(-16, -16, CANVAS_W + 32, CANVAS_H + 32);
    g2d.restore();
  }
}

// The bake is the expensive half and happens ONCE per (biome, tier): time it
// separately from the per-frame cost, which is the number DESIGN.md budgets
// (HIGH ~= 8 ms). The first frames also pay for lazily-built gradient caches,
// so the mean is taken over a run AFTER a warm-up — and the bloom's source
// refreshes on alternate frames, so an even sample count is measured.
const WARM = 12;
const RUNS = Number(params.get('runs') ?? 40);
const BATCHES = Number(params.get('batches') ?? 5);
const t0 = performance.now();
light.setBiome(look);
const bakeMs = performance.now() - t0;
for (let i = 0; i < WARM; i++) frame(TIME + i * 0.016);
// MIN of several batch means, not one mean. This machine runs other agents'
// builds and sims; a single sample measures their load as much as the frame,
// and the minimum is the only statistic that is robust to a noisy neighbour.
let best = Infinity;
let total = 0;
for (let b = 0; b < BATCHES; b++) {
  const t1 = performance.now();
  for (let i = 0; i < RUNS; i++) frame(TIME + (b * RUNS + i) * 0.016);
  const ms = (performance.now() - t1) / RUNS;
  total += ms;
  if (ms < best) best = ms;
}
const frameMs = best;
const meanMs = total / BATCHES;

// The screenshot is the LAST thing drawn: one clean frame at exactly TIME.
frame(TIME);

const known = Object.keys(BACKDROPS).filter((k) => k.includes(' '));
const timing = `bake ${bakeMs.toFixed(1)} ms · frame ${frameMs.toFixed(2)} ms (best of ${BATCHES}x${RUNS}; mean ${meanMs.toFixed(2)}; tier ${TIER})`;
out.textContent = [
  `backdrop · biome=${biomeParam} -> ${look.id} · tier=${TIER} · t=${TIME} · actors=${ACTOR_N} · dim=${DIM} · shake=${SHAKE}`,
  timing,
  `known biomes: ${known.join(', ')}`,
].join('\n');

(window as unknown as {
  __lineup: { ready: boolean; biome: string; tier: LightTier; bakeMs: number; frameMs: number };
}).__lineup = {
  ready: true,
  biome: look.id,
  tier: TIER,
  bakeMs: Math.round(bakeMs * 10) / 10,
  frameMs: Math.round(frameMs * 100) / 100,
};
