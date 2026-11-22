import { PICO8 } from '../../engine';
import type { EnemyInstance, HeroAction } from '../types';
import { SPELLS } from '../data';
import { canAfford, createBattle, enemyAct, heroAct, heroActions, spawnEnemy, startTurn } from '../sim';
import { at } from '../lookup';
import { BRACE_DUR, bannerBlocks, cue, dismissBanner, fadeProgress, flushFx, resetFx, skipToImpact, updateFx } from '../fx';
import { biome, dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_HP, C_LOG_HURT, C_MP, C_TEXT, heroPos } from '../theme';
import { deathFx, lastHitDelay, defeatFx, enemyImpact, enemyWindup, entranceFx, heroImpact, heroWindup, popHero, prepareFx, regenAura } from './battle-fx';
import type { PopSpec } from './battle-fx';
import { clearPops, pushPop, scoreSpot } from '../pops';

export function startBattle(g: Game, id: string, onWin: () => void): void {
  const enemy = spawnEnemy(id, g.clears, g.actIndex);
  g.battle = {
    enemy, state: createBattle(enemy), onWon: onWin,
    phase: 'MENU', menuCursor: 0, outcome: 'NONE',
    queue: [], timer: 0, text: '', color: C_TEXT, bufferedA: false,
  };
  g.subScene = 'BATTLE';
  clearPops(g);
  resetFx(g);
  entranceFx(g, enemy);
  if (enemy.def.kind !== 'NORMAL') {say(g, `${enemy.def.name} BARS THE WAY!`, C_ACCENT);}
  resetCursorEdge(g);
}

function push(g: Game, hold: number, run: () => void): void { g.battle.queue.push({ hold, run }); }

function say(g: Game, text: string, color: string): void { g.battle.text = text; g.battle.color = color; }

function beginQueue(g: Game): void { g.battle.phase = 'QUEUE'; advanceQueueStep(g); }

function advanceQueueStep(g: Game): void {
  flushFx(g);
  const step = g.battle.queue.shift();
  if (!step) { onQueueDone(g); return; }
  step.run();
  g.battle.timer = step.hold;
}

export function onQueueDone(g: Game): void {
  const b = g.battle;
  b.bufferedA = false;
  if (b.outcome === 'LOST') {return;}
  if (b.outcome === 'WON') {
    b.outcome = 'NONE';
    const cb = b.onWon;
    b.enemy = null; b.state = null;
    b.phase = 'MENU';
    resetFx(g);
    cb();
    return;
  }
  b.phase = 'MENU';
  b.menuCursor = Math.min(b.menuCursor, heroActions(g.hero).length - 1);
}

const DEFEAT_HOLD = 1.0;
const PREPARE_DELAY = 0.2;
const ENEMY_TURN_HOLD = 0.8;
const DEFEAT_SAY_DELAY = 0.4;

function enemyDefeated(g: Game, e: EnemyInstance, lastHit = 0): void {
  cue(g, lastHit, () => {
    defeatFx(g, e);
    pushPop(g.pops, scoreSpot(), '+100', C_ACCENT);
  });
  cue(g, lastHit + DEFEAT_SAY_DELAY, () => { say(g, `${e.def.name} DEFEATED!`, C_ACCENT); });
  g.battle.outcome = 'WON';
  g.battle.queue.length = 0;
  g.battle.timer = lastHit + DEFEAT_HOLD;
}

function heroDies(g: Game, text: string): void {
  const hp = heroPos();
  const { audio, particles, juice } = g.app;
  say(g, text, C_LOG_HURT);
  audio.play('explosion');
  particles.burst(hp.x, hp.y, { count: 14, color: PICO8[8], speed: 150 });
  juice.shake(6, 0.5);
  juice.flash(PICO8[8], 0.45, { x: hp.x, y: hp.y });
  juice.hitStop(0.4);
  g.dying = true; g.heroDown = true;
  g.battle.outcome = 'LOST';
  deathFx(g);
}

export function applyEnemyAction(g: Game): void {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return;}
  const r = enemyAct(g.hero, state, g.rng);
  say(g, r.text, r.dodged ? C_TEXT : C_LOG_HURT);
  if (r.revived) {g.battle.color = C_ACCENT;}
  enemyImpact(g, r);
  if (r.heroDead) { heroDies(g, r.text); return; }
  if (r.enemyDefeated) {enemyDefeated(g, enemy);}
}

function enemyStep(g: Game, e: EnemyInstance): void {
  cue(g, enemyWindup(g, e), () => { applyEnemyAction(g); }, true);
}

function turnStartPops(g: Game): PopSpec[] {
  const turn = startTurn(g.hero);
  const specs: PopSpec[] = [];
  if (turn.mpRegen > 0) {specs.push({ text: `+${turn.mpRegen} MP`, color: C_MP });}
  if (turn.hpRegen > 0) {specs.push({ text: `+${turn.hpRegen} HP`, color: C_HP });}
  if (turn.bloodLoss > 0) {specs.push({ text: `-${turn.bloodLoss}`, color: C_DMG_TAKEN });}
  return specs;
}

function landHeroAction(g: Game, action: HeroAction, slot: number): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const r = heroAct(g.hero, state, action, g.rng);
  say(g, r.text, r.crit ? C_ACCENT : C_TEXT);
  heroImpact(g, action, r, slot);
  if (r.enemyDefeated) { enemyDefeated(g, e, lastHitDelay(r.hits.length)); return; }
  g.battle.timer = PREPARE_DELAY + lastHitDelay(r.hits.length);
  push(g, BRACE_DUR, () => { prepareFx(g); });
  push(g, ENEMY_TURN_HOLD, () => { enemyStep(g, e); });
}

function heroStep(g: Game, action: HeroAction): void {
  if (!g.battle.enemy) {return;}
  const turnPops = turnStartPops(g);
  say(g, action === 'ATTACK' ? 'HERO ATTACKS!' : `HERO CASTS ${SPELLS[action].name}!`, C_DIM);
  popHero(g, turnPops);
  if (turnPops.length) {regenAura(g);}
  cue(g, heroWindup(g, action), () => { landHeroAction(g, action, turnPops.length); }, true);
}

function useAction(g: Game, action: HeroAction): void {
  if (!g.battle.enemy) {return;}
  if (!canAfford(g.hero, action)) {
    push(g, 0.7, () => { say(g, 'NOT ENOUGH MP!', C_DIM); g.app.audio.play('blip'); });
    beginQueue(g);
    return;
  }
  push(g, 0.9, () => { heroStep(g, action); });
  beginQueue(g);
}

function consumeA(g: Game): boolean {
  const hit = g.app.input.pressed('A') || g.battle.bufferedA;
  g.battle.bufferedA = false;
  return hit;
}

function updateMenu(g: Game): void {
  if (bannerBlocks(g)) {
    if (consumeA(g)) {dismissBanner(g);}
    return;
  }
  const actions = heroActions(g.hero);
  const dy = dirEdge(g);
  if (dy) { g.battle.menuCursor = wrapCursor(g.battle.menuCursor, dy, actions.length); g.app.audio.play('blip'); }
  if (consumeA(g)) { g.app.audio.play('blip'); useAction(g, at(heroActions(g.hero), g.battle.menuCursor)); }
}

function updateDying(g: Game, dt: number): void {
  if (g.app.juice.frozen) {return;}
  updateFx(g, dt);
  if (fadeProgress(g.fx, g.fx.fall) < 1) {return;}
  g.deathBiome = biome(g).name; g.dying = false;
  clearPops(g);
  resetFx(g);
  g.app.scenes.to('GAME_OVER');
}

function updateQueue(g: Game, dt: number): void {
  g.battle.timer -= dt;
  if (!consumeA(g)) {
    if (g.battle.timer <= 0) {advanceQueueStep(g);}
    return;
  }
  const before = g.battle.timer;
  const skipped = skipToImpact(g);
  if (skipped === null) { advanceQueueStep(g); return; }
  if (g.battle.timer === before) {g.battle.timer -= skipped;}
}

export function updateBattle(g: Game, dt: number): void {
  if (g.dying) { updateDying(g, dt); return; }
  if (g.app.juice.frozen) {
    if (g.app.input.pressed('A')) {g.battle.bufferedA = true;}
    return;
  }
  updateFx(g, dt);
  if (g.battle.phase === 'MENU') {updateMenu(g); return;}
  updateQueue(g, dt);
}
