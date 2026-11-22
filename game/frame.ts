import { PICO8 } from '../engine';
import type { SceneMachine } from '../engine';
import { startPlaying } from './flow';
import { updatePops } from './pops';
import type { Game, SubScene } from './state';
import { C_ACCENT, C_BG, H, W } from './theme';
import { renderBattle } from './screens/battle-view';
import { updateBattle } from './screens/battle';
import { renderCard, updateCard } from './screens/card';
import { renderLevelUp, updateLevelUp } from './screens/levelup';
import { renderLoot } from './screens/loot-view';
import { updateLoot } from './screens/loot';
import { renderMap, updateMap } from './screens/map';
import { renderEndingOverlay, renderPausedOverlay, renderTitle } from './screens/title';

type Scene = SceneMachine['current'];

const UPDATE_SUB: Record<SubScene, (g: Game, dt: number) => void> = {
  MAP: updateMap,
  BATTLE: updateBattle,
  LEVELUP: updateLevelUp,
  LOOT: updateLoot,
  CARD: updateCard,
};

const RENDER_SUB: Record<SubScene, (g: Game) => void> = {
  MAP: renderMap,
  BATTLE: renderBattle,
  LEVELUP: renderLevelUp,
  LOOT: renderLoot,
  CARD: renderCard,
};

function restartOnA(g: Game): void {
  if (g.app.input.pressed('A')) { g.app.audio.play('blip'); startPlaying(g); }
}

function updatePlaying(g: Game, dt: number): void {
  if (g.app.input.pressed('PAUSE')) { g.app.audio.play('blip'); g.app.scenes.to('PAUSED'); return; }
  UPDATE_SUB[g.subScene](g, dt);
}

function updatePaused(g: Game): void {
  if (g.app.input.pressed('PAUSE')) { g.app.audio.play('blip'); g.app.scenes.to('PLAYING'); }
}

const UPDATE_SCENE: Record<Scene, (g: Game, dt: number) => void> = {
  TITLE: restartOnA,
  PLAYING: updatePlaying,
  PAUSED: updatePaused,
  GAME_OVER: restartOnA,
  WIN: restartOnA,
};

export function update(g: Game, dt: number): void {
  const { juice, particles, input, scenes } = g.app;
  g.clock += dt;
  juice.update(dt);
  particles.update(dt);
  updatePops(g.pops, dt);
  UPDATE_SCENE[scenes.current](g, dt);
  input.endFrame();
}

const renderPlaying = (g: Game): void => { RENDER_SUB[g.subScene](g); };

const renderPaused = (g: Game): void => { renderPlaying(g); renderPausedOverlay(g); };
const renderGameOver = (g: Game): void => { renderPlaying(g); renderEndingOverlay(g, { headline: g.deathBiome, color: PICO8[8], sub: 'YOU DIED IN' }); };
const renderWin = (g: Game): void => { renderPlaying(g); renderEndingOverlay(g, { headline: 'VICTORY', color: C_ACCENT, sub: 'THE SERAPH IS UNMADE' }); };

const RENDER_SCENE: Record<Scene, (g: Game) => void> = {
  TITLE: renderTitle,
  PLAYING: renderPlaying,
  PAUSED: renderPaused,
  GAME_OVER: renderGameOver,
  WIN: renderWin,
};

export function render(g: Game): void {
  const { pc, juice, crt, scenes } = g.app;
  pc.clear(C_BG);
  juice.preRender(pc.ctx);
  RENDER_SCENE[scenes.current](g);
  juice.postRender(pc.ctx, W, H);
  crt.render(pc.ctx, W, H, 1 / 60);
}
