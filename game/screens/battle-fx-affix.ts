import { PICO8 } from '../../engine';
import { addMove, addShot, addTint, cue } from '../fx';
import type { Game } from '../state';
import { C_DIM, C_DMG_TAKEN, C_HP } from '../theme';
import { lastHitDelay } from './battle-fx';
import { centreOf, popOn } from './battle-fx-verbs';

const SLIP_STEP = 10;
const THORN_BEAT = 0.14;
const LEECH_FLIGHT = 0.3;

export function fxSlipsAway(g: Game, slot: number): void {
  addMove(g, 'ENEMY', 'DODGE', SLIP_STEP);
  popOn(g, { actor: 'ENEMY', slot, scale: 1 }, 'SLIPS AWAY', C_DIM);
  g.app.audio.play('whoosh');
}

export function fxThorns(g: Game, bite: { amount: number; hits: number; then: () => void }): void {
  const { amount, hits, then } = bite;
  cue(g, lastHitDelay(hits) + THORN_BEAT, () => {
    then();
    const p = centreOf(g, 'HERO');
    popOn(g, { actor: 'HERO', slot: 1, scale: 1 }, `THORNS -${String(amount)}`, C_DMG_TAKEN);
    addTint(g, 'HERO', PICO8[7], 0.06);
    addMove(g, 'HERO', 'RECOIL', 2);
    g.app.particles.burst(p.x, p.y, { count: 6, color: PICO8[8], speed: 70 });
    g.app.juice.shake(1, 0.12);
    g.app.audio.play('hit');
  });
}

export function fxVampiric(g: Game, healed: number): void {
  const from = centreOf(g, 'HERO');
  const to = centreOf(g, 'ENEMY');
  addShot(g, { kind: 'MOTES', dur: LEECH_FLIGHT, from, to, color: PICO8[8], glow: C_HP });
  cue(g, LEECH_FLIGHT, () => {
    popOn(g, { actor: 'ENEMY' }, `+${String(healed)}`, C_HP);
    addTint(g, 'ENEMY', C_HP, 0.08);
    g.app.audio.play('pickup');
  });
}
