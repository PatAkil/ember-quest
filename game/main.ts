import { createLoop } from '../engine';
import { actInDepth, depthOf, derive, describeSave, heroActions, validateData } from './sim';
import { HOLD, installDevHook } from './devhook';
import { createApp } from './app';
import { enterAct, selectNode, startRun, wireScenes } from './flow';
import { loadResume, offerResume, watchStorage } from './resume';
import { render, update } from './frame';
import { at } from './lookup';
import { createGame, installRng, resetCursorEdge, stageAt } from './state';
import type { Game } from './state';
import { syncReveal } from './transition';
import { applyEnemyAction, onQueueDone } from './screens/battle';
import { driftCount } from './screens/battle-commit';
import { openGear } from './screens/gear';
import { chooseUpgrade } from './screens/loot';

const app = createApp(HOLD);
const violations = validateData();
if (violations.length > 0) {reportError(new Error(`[ember-quest data] ${violations.join('; ')}`));}
const g = createGame(app);
wireScenes(g);

function menuView(game: Game) {
  const scene = game.app.scenes.current;
  if (scene === 'PAUSED') {return { ...game.pause };}
  if (scene !== 'TITLE' || !game.resume) {return null;}
  return { ...game.title, resume: describeSave(game.resume) };
}

function view(game: Game) {
  const { map, battle } = game;
  return {
    scene: game.app.scenes.current, subScene: game.subScene, act: actInDepth(game.n) + 1, n: game.n, depth: depthOf(game.n), hero: game.hero, derived: derive(game.hero),
    enemy: battle.enemy, clears: game.clears, score: game.score, dying: game.dying,
    cursors: { MAP: map.cursor, BATTLE: battle.menuCursor, LEVELUP: game.levelUp.cursor, LOOT: game.loot.cursor, CARD: 0, GEAR: game.gear.cursor, PICK: game.pick.cursor, EVENT: game.event.cursor,
      THRESHOLD: game.threshold.cursor, PACT: game.pact.cursor },
    battlePhase: battle.phase, battleText: battle.text, intent: battle.state?.intent ?? null, actions: heroActions(game.hero), offers: game.loot.offers, card: game.card.lines,
    map: map.stages, curStage: map.curStage, reachable: map.reachable,
    pick: { title: game.pick.title, rows: game.pick.rows.map((r) => r.name) },
    event: { id: game.event.def.id, title: game.event.def.title, options: game.event.def.options.map((o) => o.label) },
    descent: { won: game.won, banked: game.banked, bosses: game.bosses, descentClears: game.descentClears, plan: game.plan },
    pacts: game.pact.offers,
    menu: menuView(game),
    save: { lost: game.saveLost, notice: game.notice?.text ?? null },
    drift: driftCount(),
  };
}

const tick = (dt: number): void => { update(g, dt); };
const draw = (): void => { render(g); };
const dev = import.meta.env.DEV ? installDevHook({
  scenes: app.scenes, setRng: (source) => { installRng(g, source, true); }, tick, render: draw, resetEdge: () => { resetCursorEdge(g); },
  syncReveal: () => { syncReveal(g); },
  startRun: (hero, n, clears) => { startRun(g, hero, n, clears); },
  plan: () => g.plan,
  remap: (stageSizes) => { g.plan = { ...g.plan, stageSizes }; enterAct(g); },
  selectNode: (node) => { selectNode(g, node); },
  nextNodes: () => g.map.reachable.map((i) => at(stageAt(g, g.map.curStage + 1), i)),
  bossNode: () => at(stageAt(g, g.map.stages.length - 1), 0),
  winBattle: () => { g.battle.outcome = 'WON'; onQueueDone(g); },
  enemyTurn: () => { applyEnemyAction(g); },
  openGear: () => { openGear(g); },
  pickUpgrade: () => { chooseUpgrade(g); },
  battle: () => g.battle,
  view: () => view(g),
  offerResume: () => { offerResume(g); },
}) : null;
loadResume(g);
watchStorage(g);
createLoop(dev ?? { update: tick, render: draw }).start();
