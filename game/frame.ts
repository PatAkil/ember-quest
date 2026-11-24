import type { SceneMachine } from '../engine';
import { startPlaying } from './flow';
import { realRun } from './persist';
import { loadResume } from './resume';
import { loadStoredRun } from './storage';
import { updatePops } from './pops';
import { drawReveal, trackReveal } from './transition';
import { armed } from './state';
import { END_ARM } from './screens/threshold';
import type { Game, SubScene } from './state';
import { C_BG, H, W } from './theme';
import { renderBattle } from './screens/battle-view';
import { updateBattle } from './screens/battle';
import { renderCard, updateCard } from './screens/card';
import { renderGear } from './screens/gear-view';
import { updateGear } from './screens/gear';
import { renderLevelUp, updateLevelUp } from './screens/levelup';
import { renderLoot } from './screens/loot-view';
import { updateLoot } from './screens/loot';
import { renderMap, updateMap } from './screens/map';
import { renderPick } from './screens/pick-view';
import { updatePick } from './screens/pick';
import { renderEvent } from './screens/event-view';
import { updateEvent } from './screens/event';
import { renderPact } from './screens/pact-view';
import { updatePact } from './screens/pact';
import { renderThreshold } from './screens/threshold-view';
import { updateThreshold } from './screens/threshold';
import { renderTitle, updateTitle } from './screens/title';
import { renderPausedOverlay, updatePaused } from './screens/pause';
import { renderGameOverOverlay, renderWinOverlay } from './screens/ending';

type Scene = SceneMachine['current'];

const UPDATE_SUB: Record<SubScene, (g: Game, dt: number) => void> = {
  MAP: updateMap,
  BATTLE: updateBattle,
  LEVELUP: updateLevelUp,
  LOOT: updateLoot,
  CARD: updateCard,
  GEAR: updateGear,
  PICK: updatePick,
  EVENT: updateEvent,
  THRESHOLD: updateThreshold,
  PACT: updatePact,
};

const RENDER_SUB: Record<SubScene, (g: Game) => void> = {
  MAP: renderMap,
  BATTLE: renderBattle,
  LEVELUP: renderLevelUp,
  LOOT: renderLoot,
  CARD: renderCard,
  GEAR: renderGear,
  PICK: renderPick,
  EVENT: renderEvent,
  THRESHOLD: renderThreshold,
  PACT: renderPact,
};

function liveSaveElsewhere(g: Game): boolean {
  return realRun(g) && loadStoredRun() !== null;
}

function restartOnA(g: Game): void {
  if (!armed(g, { openedAt: g.endedAt, delay: END_ARM })) {return;}
  if (!g.app.input.pressed('A')) {return;}
  g.app.audio.play('blip');
  if (!liveSaveElsewhere(g)) { startPlaying(g); return; }
  g.title = { cursor: 0, confirm: false, yes: false };
  loadResume(g);
  g.app.scenes.to('TITLE');
}

function updatePlaying(g: Game, dt: number): void {
  if (g.app.input.pressed('PAUSE') && !g.dying) { g.app.audio.play('blip'); g.app.scenes.to('PAUSED'); return; }
  UPDATE_SUB[g.subScene](g, dt);
}

const UPDATE_SCENE: Record<Scene, (g: Game, dt: number) => void> = {
  TITLE: updateTitle,
  PLAYING: updatePlaying,
  PAUSED: updatePaused,
  GAME_OVER: restartOnA,
  WIN: restartOnA,
};

export function update(g: Game, dt: number): void {
  const { juice, particles, input, scenes } = g.app;
  if (scenes.current === 'PAUSED') {
    updatePaused(g);
    input.endFrame();
    return;
  }
  g.clock += dt;
  juice.update(dt);
  particles.update(dt);
  updatePops(g.pops, dt);
  UPDATE_SCENE[scenes.current](g, dt);
  trackReveal(g, dt);
  input.endFrame();
}

const renderPlaying = (g: Game): void => { RENDER_SUB[g.subScene](g); drawReveal(g); };

const renderPaused = (g: Game): void => { renderPlaying(g); renderPausedOverlay(g); };
const renderGameOver = (g: Game): void => { renderGameOverOverlay(g); };
const renderWin = (g: Game): void => { renderWinOverlay(g); };

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
