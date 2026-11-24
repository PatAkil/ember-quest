import { PICO8 } from '../../engine';
import type { EnemyInstance, TurnStart } from '../types';
import { enemyAnchor, enemyPos, heroAnchor } from '../backdrop';
import { addTint, showBanner } from '../fx';
import { popSpot, pushPop } from '../pops';
import type { Game } from '../state';
import { C_ACCENT, C_HP, C_MP, heroPos } from '../theme';

const C_BURN = PICO8[9];

function heroPop(g: Game, text: string, color: string, slot = 0): void {
  pushPop(g.pops, popSpot(heroAnchor(), slot), text, color);
}

function enemyPop(g: Game, text: string, color: string, slot = 0): void {
  pushPop(g.pops, popSpot(enemyAnchor(g), slot), text, color);
}

export function fxGuard(g: Game): void {
  heroPop(g, 'GUARD', C_MP);
  addTint(g, 'HERO', C_MP, 0.08);
  g.app.audio.play('blip');
}

export function fxParry(g: Game): void {
  heroPop(g, 'PARRY!', C_ACCENT, 1);
  g.app.audio.play('pickup');
  g.app.juice.hitStop(0.08);
}

export function fxBreak(g: Game): void {
  const p = enemyPos(g);
  enemyPop(g, 'BREAK!', C_ACCENT, 1);
  g.app.audio.play('explosion');
  g.app.juice.shake(4, 0.3);
  g.app.particles.burst(p.x, p.y, { count: 12, color: C_ACCENT, speed: 130 });
}

export function fxBurst(g: Game): void {
  const p = enemyPos(g);
  enemyPop(g, 'BURST!', C_BURN, 1);
  g.app.juice.flash(C_BURN, 0.35, { x: p.x, y: p.y });
  g.app.juice.shake(6, 0.45);
  g.app.audio.play('explosion');
}

export function fxPotion(g: Game): void {
  const hp = heroPos();
  g.app.particles.burst(hp.x, hp.y, { count: 10, color: C_HP, speed: 70 });
}

export function fxBurnTick(g: Game, turn: TurnStart): void {
  if (turn.heroBurn > 0) {heroPop(g, `-${turn.heroBurn}`, C_BURN, 2);}
  if (turn.enemyBurn > 0) {enemyPop(g, `-${turn.enemyBurn}`, C_BURN);}
  g.app.audio.play('hit');
}

export function fxPhase(g: Game, e: EnemyInstance): void {
  showBanner(g, { name: e.def.phase2?.banner ?? e.def.name, tag: 'PHASE 2', color: PICO8[8] });
  g.app.juice.shake(5, 0.4);
  g.app.audio.play('explosion');
}

export function fxWeak(g: Game): void {
  enemyPop(g, 'WEAK!', C_ACCENT, 1);
  g.app.juice.hitStop(0.06);
}
