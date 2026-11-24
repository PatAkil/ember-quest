import { PICO8 } from '../../engine';
import type { EnemyInstance, Element } from '../types';
import { enemyAnchor, heroAnchor } from '../backdrop';
import { addMove, addShot, addTint, cue, showBanner } from '../fx';
import type { Actor } from '../fx-state';
import { popSpot, pushPop } from '../pops';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_EMBER, C_GOOD, C_HP, C_WARD, ELEMENT_COLOR, FLOOR_Y, HERO_H, HERO_W, HERO_X, W } from '../theme';
import type { Point } from '../theme';
import { actorBody } from './battle-auras';

interface PopAt { actor: Actor; slot?: number; scale?: number }

export function popOn(g: Game, at: PopAt, text: string, color: string): void {
  const anchor = at.actor === 'HERO' ? heroAnchor() : enemyAnchor(g);
  pushPop(g.pops, { ...popSpot(anchor, at.slot ?? 0), scale: at.scale ?? 2 }, text, color);
}

export const centreOf = (g: Game, actor: Actor): Point => actorBody(actor, g).centre;
const heroFront = (): Point => ({ x: HERO_X + HERO_W / 2 + 4, y: FLOOR_Y - HERO_H / 2 + 2 });

export function fxGuard(g: Game): void {
  popOn(g, { actor: 'HERO' }, 'GUARD', C_WARD);
  addShot(g, { kind: 'SHIELD', dur: 0.4, from: heroFront(), to: heroFront(), color: C_WARD, glow: PICO8[7] });
  addTint(g, 'HERO', C_WARD, 0.06);
  g.app.audio.play('jump');
}

export function fxGuardedHit(g: Game, dmg: number): void {
  popOn(g, { actor: 'HERO' }, `GUARD -${String(dmg)}`, C_WARD);
  addShot(g, { kind: 'SHIELD', dur: 0.3, from: heroFront(), to: heroFront(), color: C_WARD, glow: PICO8[7] });
  addMove(g, 'HERO', 'RECOIL', 3);
  g.app.particles.burst(heroFront().x, heroFront().y, { count: 6, color: C_WARD, speed: 70 });
  g.app.juice.shake(1, 0.12);
  g.app.audio.play('blip');
}

export function fxParry(g: Game, dmg: number): void {
  const at = heroFront();
  popOn(g, { actor: 'HERO', scale: 3 }, 'PARRY!', C_ACCENT);
  if (dmg > 0) {popOn(g, { actor: 'HERO', slot: 1 }, `-${String(dmg)}`, C_WARD);}
  addShot(g, { kind: 'ARC', dur: 0.16, from: at, to: { x: at.x + 1, y: at.y }, color: C_ACCENT, glow: PICO8[7] });
  addShot(g, { kind: 'RING', dur: 0.3, from: at, to: at, color: C_ACCENT, glow: PICO8[7] });
  g.app.juice.flash(PICO8[7], 0.22, at);
  g.app.juice.hitStop(0.14);
  g.app.particles.burst(at.x, at.y, { count: 14, color: C_ACCENT, speed: 150 });
  g.app.audio.play('pickup');
  g.app.audio.play('hit');
}

export function fxRiposte(g: Game): void {
  const p = centreOf(g, 'ENEMY');
  g.app.juice.flash(PICO8[7], 0.16, p);
  g.app.juice.shake(4, 0.3);
  g.app.audio.play('explosion');
}

export function fxBreak(g: Game, slot: number): void {
  const p = centreOf(g, 'ENEMY');
  popOn(g, { actor: 'ENEMY', slot }, 'BREAK!', C_ACCENT);
  addMove(g, 'ENEMY', 'RECOIL', 12);
  addShot(g, { kind: 'RING', dur: 0.4, from: p, to: p, color: C_ACCENT, glow: PICO8[7] });
  g.app.juice.hitStop(0.18);
  g.app.juice.shake(5, 0.35);
  g.app.juice.flash(PICO8[7], 0.2, p);
  g.app.particles.burst(p.x, p.y, { count: 16, color: C_ACCENT, speed: 150 });
  g.app.audio.play('explosion');
}

export function fxBurst(g: Game): void {
  const p = centreOf(g, 'ENEMY');
  g.app.juice.flash(C_ACCENT, 0.45);
  g.app.juice.shake(7, 0.55);
  g.app.juice.hitStop(0.16);
  g.app.particles.burst(p.x, p.y, { count: 24, color: C_ACCENT, speed: 170 });
  g.app.particles.burst(p.x, p.y, { count: 14, color: C_EMBER, speed: 110 });
  addMove(g, 'ENEMY', 'RECOIL', 14);
  g.app.audio.play('explosion');
  g.app.audio.play('whoosh');
}

export function fxBurstCharge(g: Game, from: Point, dur: number): void {
  addShot(g, { kind: 'CHARGE', dur, from, to: from, color: C_EMBER, glow: C_ACCENT });
  addShot(g, { kind: 'RING', dur, from: centreOf(g, 'HERO'), to: centreOf(g, 'HERO'), color: C_EMBER, glow: C_ACCENT });
  addTint(g, 'HERO', C_ACCENT, 0.08);
  g.app.audio.play('jump');
  cue(g, dur - 0.08, () => { addShot(g, { kind: 'BEAM', dur: 0.55, from, to: { x: W + 16, y: from.y }, color: C_EMBER, glow: C_ACCENT }); });
}

export function fxPotion(g: Game): void {
  const p = centreOf(g, 'HERO');
  g.app.particles.burst(p.x, p.y - 10, { count: 10, color: C_HP, speed: 70 });
  addTint(g, 'HERO', C_HP, 0.08);
}

export function fxBurnTick(g: Game, actor: Actor, amount: number, slot: number): void {
  const p = centreOf(g, actor);
  popOn(g, { actor, slot, scale: 1 }, `BURN -${String(amount)}`, C_EMBER);
  addTint(g, actor, C_EMBER, 0.08);
  g.app.particles.burst(p.x, p.y - 6, { count: 8, color: C_EMBER, speed: 60 });
  g.app.audio.play('hit');
}

export function fxPhase(g: Game, e: EnemyInstance): void {
  const p = centreOf(g, 'ENEMY');
  showBanner(g, { name: e.def.phase2?.banner ?? e.def.name, tag: 'PHASE 2', color: PICO8[8] });
  addMove(g, 'ENEMY', 'ROAR', 6);
  addTint(g, 'ENEMY', PICO8[7], 0.1);
  cue(g, 0.2, () => { addTint(g, 'ENEMY', PICO8[8], 0.1); });
  g.app.juice.shake(5, 0.5);
  g.app.particles.burst(p.x, p.y, { count: 20, color: PICO8[8], speed: 140 });
  g.app.audio.play('explosion');
}

export function fxWeak(g: Game, element: Element | undefined, slot: number): void {
  const p = centreOf(g, 'ENEMY');
  const color = element ? ELEMENT_COLOR[element] : C_GOOD;
  popOn(g, { actor: 'ENEMY', slot }, 'WEAK!', C_GOOD);
  addShot(g, { kind: 'BLOOM', dur: 0.34, from: p, to: p, color, glow: PICO8[7] });
  g.app.juice.hitStop(0.1);
  g.app.particles.burst(p.x, p.y, { count: 10, color, speed: 120 });
}

export function fxResist(g: Game, slot: number): void {
  popOn(g, { actor: 'ENEMY', slot, scale: 1 }, 'RESIST', C_DIM);
  g.app.audio.play('blip');
}

export function fxWard(g: Game): void {
  const p = centreOf(g, 'ENEMY');
  popOn(g, { actor: 'ENEMY' }, 'WARD', C_WARD);
  addShot(g, { kind: 'RING', dur: 0.5, from: p, to: p, color: C_WARD, glow: PICO8[7] });
  addTint(g, 'ENEMY', C_WARD, 0.1);
  g.app.audio.play('jump');
}

export function fxMend(g: Game, healed: number): void {
  popOn(g, { actor: 'ENEMY' }, `+${String(healed)}`, C_HP);
  addTint(g, 'ENEMY', C_HP, 0.1);
  g.app.audio.play('pickup');
}

export function fxScorch(g: Game): void {
  const p = centreOf(g, 'HERO');
  popOn(g, { actor: 'HERO', slot: 1, scale: 1 }, 'BURN', C_EMBER);
  g.app.particles.burst(p.x, p.y, { count: 12, color: C_EMBER, speed: 90 });
}

export function fxHeavyHit(g: Game): void {
  const p = centreOf(g, 'HERO');
  g.app.juice.shake(6, 0.4);
  g.app.juice.hitStop(0.1);
  g.app.juice.flash(PICO8[8], 0.2, p);
  g.app.audio.play('explosion');
}

export function fxStaggered(g: Game): void {
  popOn(g, { actor: 'ENEMY', scale: 1 }, 'STAGGERED', C_DIM);
  g.app.audio.play('blip');
}
