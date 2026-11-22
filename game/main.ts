import { createLoop } from '../engine';
import { derive, heroActions } from './sim';
import { validateData } from './data';
import { installDevHook } from './devhook';
import { createApp } from './app';
import { selectNode, startRun, wireScenes } from './flow';
import { render, update } from './frame';
import { at } from './lookup';
import { createGame, resetCursorEdge, stageAt } from './state';
import type { Game } from './state';
import { applyEnemyAction, onQueueDone } from './screens/battle';

const app = createApp();
const violations = validateData();
if (violations.length > 0) {reportError(new Error(`[ember-quest data] ${violations.join('; ')}`));}
const g = createGame(app);
wireScenes(g);

function view(game: Game) {
  const { map, battle } = game;
  return {
    scene: game.app.scenes.current, subScene: game.subScene, act: game.actIndex + 1, hero: game.hero, derived: derive(game.hero),
    enemy: battle.enemy, clears: game.clears, score: game.score, dying: game.dying,
    cursors: { MAP: map.cursor, BATTLE: battle.menuCursor, LEVELUP: game.levelUp.cursor, LOOT: game.loot.cursor, CARD: 0 },
    battlePhase: battle.phase, battleText: battle.text, actions: heroActions(game.hero), offers: game.loot.offers, card: game.card.lines,
    map: map.stages, curStage: map.curStage, reachable: map.reachable,
  };
}

const tick = (dt: number): void => { update(g, dt); };
const draw = (): void => { render(g); };
const dev = import.meta.env.DEV ? installDevHook({
  scenes: app.scenes, setRng: (r) => { g.rng = r; }, tick, render: draw, resetEdge: () => { resetCursorEdge(g); },
  startRun: (hero, act, clears) => { startRun(g, hero, act, clears); },
  selectNode: (node) => { selectNode(g, node); },
  nextNodes: () => g.map.reachable.map((i) => at(stageAt(g, g.map.curStage + 1), i)),
  bossNode: () => at(stageAt(g, g.map.stages.length - 1), 0),
  winBattle: () => { g.battle.outcome = 'WON'; onQueueDone(g); },
  enemyTurn: () => { applyEnemyAction(g); },
  view: () => view(g),
}) : null;
createLoop(dev ?? { update: tick, render: draw }).start();
