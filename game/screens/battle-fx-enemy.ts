import { PICO8 } from '../../engine';
import type { EnemyActResult, EnemyInstance, MoveId } from '../types';
import { enemyAnchor, enemyPos, heroAnchor } from '../backdrop';
import { addMove, addShot, addTint, cue, meter } from '../fx';
import { popSpot, pushPop } from '../pops';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_EMBER, C_HP, C_WARD, FLOOR_Y, HERO_X, enemyColor, heroPos } from '../theme';
import { STRIKE_LOOK, enemySide, impactMark, react, runWindup, toneFor } from './battle-fx';
import type { Look } from './battle-fx';
import { fxGuardedHit, fxHeavyHit, fxMend, fxParry, fxScorch, fxStaggered, fxWard } from './battle-fx-verbs';

function baseLook(e: EnemyInstance): Look {
  if (e.def.atkType === 'PHYSICAL') {return { ...STRIKE_LOOK, impact: 0.2 };}
  return { arch: 'SHOT', impact: 0.28, shot: 'HEX', color: enemyColor(e.def.id), glow: PICO8[7] };
}

const MOVE_LOOK: Record<MoveId, (base: Look) => Look> = {
  STRIKE: (base) => base,
  WINDUP: (base) => base,
  HEAVY: (base) => ({ ...base, impact: base.impact + 0.06 }),
  SCORCH: (base) => (base.arch === 'SHOT' ? { ...base, shot: 'ORB', color: C_EMBER, glow: PICO8[10] } : { ...base, color: C_EMBER, glow: PICO8[10] }),
  WARD: () => ({ arch: 'AURA', impact: 0.3, shot: 'RISE', color: C_WARD, glow: PICO8[7] }),
  MEND: () => ({ arch: 'AURA', impact: 0.3, shot: 'RISE', color: C_HP, glow: PICO8[7] }),
};

const STAGGER_BEAT = 0.2;
const HEAVY_HOP = 8;

export function enemyWindup(g: Game, e: EnemyInstance): number {
  if (e.staggered) { addMove(g, 'ENEMY', 'RECOIL', 2); return STAGGER_BEAT; }
  const move = g.battle.state?.intent ?? 'STRIKE';
  const look = MOVE_LOOK[move](baseLook(e));
  runWindup(g, enemySide(g), look);
  if (move === 'HEAVY' && look.arch === 'MELEE') {addMove(g, 'ENEMY', 'HEAVY', HEAVY_HOP);}
  return look.impact;
}

export function reviveFx(g: Game): void {
  const hp = heroPos();
  const m = meter(g, 'heroHp');
  m.shown = 0; m.ghost = 0; m.last = 0;
  g.app.juice.flash(C_ACCENT, 0.6, { x: hp.x, y: hp.y });
  g.app.particles.burst(hp.x, hp.y, { count: 16, color: C_ACCENT, speed: 140 });
  g.app.audio.play('pickup');
  addShot(g, { kind: 'RING', dur: 0.5, from: hp, to: hp, color: C_ACCENT, glow: PICO8[7] });
  addShot(g, { kind: 'RISE', dur: 0.7, from: { x: HERO_X, y: FLOOR_Y - 4 }, to: heroAnchor().head, color: C_ACCENT, glow: PICO8[7] });
  addTint(g, 'HERO', C_ACCENT, 0.14);
}

function reflectFx(g: Game, amount: number): void {
  const p = enemyPos(g);
  pushPop(g.pops, popSpot(enemyAnchor(g)), `-${String(amount)}`, PICO8[9]);
  g.app.particles.burst(p.x, p.y, { count: 5, color: PICO8[9] });
  addTint(g, 'ENEMY', toneFor(g, 'ENEMY'), 0.07);
  addMove(g, 'ENEMY', 'RECOIL', 2);
}

const COUNTER_DELAY = 0.12;

function counterFx(g: Game, amount: number): void {
  const p = enemyPos(g);
  const a = enemyAnchor(g);
  addMove(g, 'HERO', 'LUNGE', 6);
  cue(g, COUNTER_DELAY, () => {
    pushPop(g.pops, { ...popSpot(a, 1), scale: 2 }, `COUNTER -${String(amount)}`, C_ACCENT);
    addShot(g, { kind: 'SLASH', dur: 0.24, from: p, to: p, color: C_ACCENT, glow: PICO8[7] });
    addTint(g, 'ENEMY', toneFor(g, 'ENEMY'), 0.07);
    addMove(g, 'ENEMY', 'RECOIL', 4);
    g.app.audio.play('hit');
  });
}

function dodgeFx(g: Game, r: EnemyActResult): void {
  g.app.audio.play('blip');
  addMove(g, 'HERO', 'DODGE', 8);
  if (r.parried) { fxParry(g, 0); return; }
  pushPop(g.pops, popSpot(heroAnchor()), 'MISS', C_DIM);
}

function quietMove(g: Game, r: EnemyActResult): boolean {
  if (r.staggered) { fxStaggered(g); return true; }
  if (r.warded) { fxWard(g); return true; }
  if (r.move === 'MEND') { fxMend(g, r.healed); return true; }
  if (r.dodged) { dodgeFx(g, r); return true; }
  return false;
}

function struck(g: Game, r: EnemyActResult): void {
  const heavy = r.move === 'HEAVY';
  if (r.parried) { fxParry(g, r.dmg); return; }
  if (r.guarded) { fxGuardedHit(g, r.dmg); return; }
  pushPop(g.pops, { ...popSpot(heroAnchor()), scale: heavy ? 3 : 2 }, `-${String(r.dmg)}`, C_DMG_TAKEN);
  if (r.heroDead) {return;}
  react(g, { target: 'HERO', at: heroPos(), crit: false, heavy, burst: PICO8[8] });
  g.app.juice.shake(3, 0.25);
  if (heavy) {fxHeavyHit(g);}
}

export function enemyImpact(g: Game, r: EnemyActResult): void {
  if (quietMove(g, r)) {return;}
  const e = g.battle.enemy;
  if (e) {impactMark(g, enemySide(g), MOVE_LOOK[r.move](baseLook(e)));}
  struck(g, r);
  if (r.heroDead) {return;}
  if (r.burned) {fxScorch(g);}
  if (r.revived) {reviveFx(g);}
  if (r.reflected > 0) {reflectFx(g, r.reflected);}
  if (r.countered > 0) {counterFx(g, r.countered);}
}
