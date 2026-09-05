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
//   biome=SKY_RUINS            which BACKDROPS entry to draw (default EMBER_CRYPT;
//                              accepts either the spaced or underscored form)
//   tier=HIGH|MED|LOW|ARCADE   light quality tier (default HIGH, the desktop default)
//   t=2.4                      the frame time in seconds fed to every render call —
//                              fog bands, light shafts and the key-light breathing
//                              alpha are all a function of this, so a nonzero moment
//                              avoids catching them at their t=0 rest pose. Dust motes
//                              keep their baked, already-spread seed positions either
//                              way: renderLightPlane's own dt is 0 on this cold first
//                              call, exactly as it is on the game's own first frame.
//
// capture: node tools/capture.mjs shot url=/tools/backdrops.html?biome=SKY_RUINS name=backdrop-SKY_RUINS

import { createLight } from '../engine';
import type { BiomeLook, LightTier } from '../engine';
import { CANVAS_W, CANVAS_H } from '../game/screens/layout';
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

const look: BiomeLook = backdropFor(biomeParam);
const light = createLight({ width: CANVAS_W, height: CANVAS_H, tier: TIER });
light.setBiome(look);

// No actors: just the diorama, in the battle screen's own three-call order.
light.renderBackground(ctx, { time: TIME, shakeX: 0, shakeY: 0 });
light.renderLightPlane(ctx, { time: TIME });
light.renderPost(ctx, { time: TIME });

const known = Object.keys(BACKDROPS).filter((k) => k.includes(' '));
out.textContent = [
  `backdrop · biome=${biomeParam} -> ${look.id} · tier=${TIER} · t=${TIME}`,
  `known biomes: ${known.join(', ')}`,
].join('\n');

(window as unknown as { __lineup: { ready: boolean; biome: string; tier: LightTier } }).__lineup = {
  ready: true,
  biome: look.id,
  tier: TIER,
};
