import { PICO8 } from '../../engine';
import type { EnemyActResult, EnemyInstance, EnemyKind, HeroAction, HeroActResult } from '../types';
import { canAfford, createBattle, enemyAct, heroAct, heroActions, spawnEnemy, startTurn } from '../sim';
import { enemyPos } from '../backdrop';
import { at } from '../lookup';
import { pushPop } from '../pops';
import { biome, dirEdge, resetCursorEdge, wrapCursor } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_HP, C_MP, C_TEXT, enemyColor, heroPos } from '../theme';
import type { Point } from '../theme';

export function startBattle(g: Game, id: string, onWin: () => void): void {
  const enemy = spawnEnemy(id, g.clears, g.actIndex);
  g.battle = {
    enemy, state: createBattle(enemy), onWon: onWin,
    phase: 'MENU', menuCursor: 0, outcome: 'NONE',
    queue: [], timer: 0, text: '', color: C_TEXT,
  };
  g.subScene = 'BATTLE';
  resetCursorEdge(g);
}

function push(g: Game, hold: number, run: () => void): void { g.battle.queue.push({ hold, run }); }

function say(g: Game, text: string, color: string): void { g.battle.text = text; g.battle.color = color; }

function beginQueue(g: Game): void { g.battle.phase = 'QUEUE'; advanceQueueStep(g); }

function advanceQueueStep(g: Game): void {
  const step = g.battle.queue.shift();
  if (!step) { onQueueDone(g); return; }
  step.run();
  g.battle.timer = step.hold;
}

export function onQueueDone(g: Game): void {
  const b = g.battle;
  if (b.outcome === 'LOST') {return;}
  if (b.outcome === 'WON') {
    b.outcome = 'NONE';
    const cb = b.onWon;
    b.enemy = null; b.state = null;
    b.phase = 'MENU';
    cb();
    return;
  }
  b.phase = 'MENU';
  b.menuCursor = Math.min(b.menuCursor, heroActions(g.hero).length - 1);
}

const DEFEAT_MAGNITUDE: Record<EnemyKind, number> = { BOSS: 1, ELITE: 0.6, NORMAL: 0.3 };

function enemyDefeatedStep(g: Game, e: EnemyInstance): void {
  const p = enemyPos(g);
  const mag = DEFEAT_MAGNITUDE[e.def.kind];
  push(g, 1.0, () => {
    say(g, `${e.def.name} DEFEATED!`, C_ACCENT);
    g.app.audio.play('explosion');
    g.app.particles.burst(p.x, p.y, { count: 10 + Math.round(mag * 10), color: enemyColor(e.def.id), speed: 120 + mag * 60 });
    g.app.juice.shake(4 + mag * 3, 0.35 + mag * 0.15);
    pushPop(g.pops, { x: p.x, y: p.y - 24 }, '+100', C_ACCENT);
    g.battle.outcome = 'WON';
  });
}

function heroDies(g: Game, text: string): void {
  const hp = heroPos();
  const { audio, particles, juice } = g.app;
  say(g, text, C_DMG_TAKEN);
  audio.play('explosion');
  particles.burst(hp.x, hp.y, { count: 14, color: PICO8[8], speed: 150 });
  juice.shake(6, 0.5);
  juice.flash(PICO8[8], 0.45, { x: hp.x, y: hp.y });
  juice.hitStop(0.4);
  g.dying = true; g.heroDown = true;
  g.battle.outcome = 'LOST';
}

function heroStruck(g: Game, r: EnemyActResult, hp: Point): boolean {
  const { audio, particles, juice } = g.app;
  pushPop(g.pops, { x: hp.x, y: hp.y - 8 }, `-${r.dmg}`, C_DMG_TAKEN);
  if (r.heroDead) { heroDies(g, r.text); return false; }
  audio.play('hit');
  particles.burst(hp.x, hp.y, { count: 5, color: PICO8[8] });
  juice.shake(3, 0.25);
  juice.flash(PICO8[8], 0.2);
  if (r.revived) {
    juice.flash(C_ACCENT, 0.6, { x: hp.x, y: hp.y });
    particles.burst(hp.x, hp.y, { count: 16, color: C_ACCENT, speed: 140 });
    audio.play('pickup');
    g.battle.color = C_ACCENT;
  }
  return true;
}

export function applyEnemyAction(g: Game): void {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return;}
  const r = enemyAct(g.hero, state, g.rng);
  const hp = heroPos();
  say(g, r.text, r.dodged ? C_TEXT : C_DMG_TAKEN);
  if (r.dodged) { g.app.audio.play('blip'); pushPop(g.pops, { x: hp.x, y: hp.y - 8 }, 'MISS', C_DIM); }
  else if (!heroStruck(g, r, hp)) {return;}
  if (r.reflected > 0) {
    const p = enemyPos(g);
    pushPop(g.pops, { x: p.x, y: p.y - 8 }, `-${r.reflected}`, PICO8[9]);
    g.app.particles.burst(p.x, p.y, { count: 5, color: PICO8[9] });
  }
  if (r.enemyDefeated) {enemyDefeatedStep(g, enemy);}
}

function turnStartPops(g: Game, hp: Point): void {
  const turn = startTurn(g.hero);
  if (turn.mpRegen > 0) {pushPop(g.pops, { x: hp.x, y: hp.y - 22 }, `+${turn.mpRegen} MP`, C_MP);}
  if (turn.hpRegen > 0) {pushPop(g.pops, { x: hp.x + 18, y: hp.y - 30 }, `+${turn.hpRegen} HP`, C_HP);}
  if (turn.bloodLoss > 0) {pushPop(g.pops, { x: hp.x - 16, y: hp.y - 30 }, `-${turn.bloodLoss}`, C_DMG_TAKEN);}
}

function hitFeedback(g: Game, r: HeroActResult, e: EnemyInstance): void {
  const { audio, particles, juice } = g.app;
  const p = enemyPos(g);
  r.hits.forEach((h, i) => {
    const color = h.crit ? C_ACCENT : h.kind === 'MAGIC' ? PICO8[14] : C_TEXT;
    pushPop(g.pops, { x: p.x + (i - (r.hits.length - 1) / 2) * 26, y: p.y - 8 - i * 6, scale: h.crit ? 3 : 2 }, `-${h.dmg}${h.crit ? '!' : ''}`, color);
  });
  if (!r.hits.length) {
    const hp = heroPos();
    audio.play('pickup');
    particles.burst(hp.x, hp.y, { count: 8, color: C_HP, speed: 60 });
    return;
  }
  if (r.crit) {
    audio.play('explosion'); juice.shake(4, 0.3); juice.flash(C_ACCENT, 0.3); juice.hitStop(0.08);
    particles.burst(p.x, p.y, { count: 12, color: C_ACCENT, speed: 130 });
  } else {
    audio.play('hit'); juice.shake(2, 0.2); juice.flash(C_ACCENT, 0.2);
    particles.burst(p.x, p.y, { count: 6, color: enemyColor(e.def.id) });
  }
}

function applyHeroAction(g: Game, action: HeroAction): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const hp = heroPos();
  turnStartPops(g, hp);
  const r = heroAct(g.hero, state, action, g.rng);
  say(g, r.text, r.crit ? C_ACCENT : C_TEXT);
  hitFeedback(g, r, e);
  if (r.healed > 0) {pushPop(g.pops, { x: hp.x, y: hp.y - 14 }, `+${r.healed} HP`, C_HP);}
  if (r.mpRestored > 0) {pushPop(g.pops, { x: hp.x + 14, y: hp.y - 20 }, `+${r.mpRestored} MP`, C_MP);}
  if (r.enemyDefeated) {enemyDefeatedStep(g, e); return;}
  push(g, 0.7, () => { say(g, `${e.def.name} PREPARES...`, C_DIM); });
  push(g, 0.9, () => { applyEnemyAction(g); });
}

function useAction(g: Game, action: HeroAction): void {
  if (!g.battle.enemy) {return;}
  if (!canAfford(g.hero, action)) {
    push(g, 0.7, () => { say(g, 'NOT ENOUGH MP!', C_DIM); g.app.audio.play('blip'); });
    beginQueue(g);
    return;
  }
  push(g, 0.9, () => { applyHeroAction(g, action); });
  beginQueue(g);
}

function updateMenu(g: Game): void {
  const actions = heroActions(g.hero);
  const dy = dirEdge(g);
  if (dy) { g.battle.menuCursor = wrapCursor(g.battle.menuCursor, dy, actions.length); g.app.audio.play('blip'); }
  if (g.app.input.pressed('A')) { g.app.audio.play('blip'); useAction(g, at(heroActions(g.hero), g.battle.menuCursor)); }
}

export function updateBattle(g: Game, dt: number): void {
  if (g.dying) {
    if (!g.app.juice.frozen) {
      g.deathBiome = biome(g).name; g.dying = false;
      g.app.scenes.to('GAME_OVER');
    }
    return;
  }
  if (g.battle.phase === 'MENU') {
    updateMenu(g);
    return;
  }
  g.battle.timer -= dt;
  if (g.battle.timer <= 0 || g.app.input.pressed('A')) {advanceQueueStep(g);}
}
