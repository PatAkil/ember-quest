import type { Sprite } from '../../engine';
import { enemyAnim, heroFrames } from '../sprites';
import { enemyAnchor, enemyPos } from '../backdrop';
import type { Game } from '../state';
import { ACTOR_PX, HERO_W, HERO_X, heroPos } from '../theme';
import type { Point } from '../theme';

const BLADE_BITE = 3;
const BODY_BITE = 8;

interface Ink { first: number; last: number }

const inkCache = new Map<Sprite, Ink>();

function scanInk(s: Sprite): Ink {
  let first = s.w; let last = -1;
  s.pixels.forEach((c, i) => {
    if (!c) {return;}
    const x = i % s.w;
    first = Math.min(first, x); last = Math.max(last, x);
  });
  return last < 0 ? { first: 0, last: s.w - 1 } : { first, last };
}

function inkOf(s: Sprite): Ink {
  const cached = inkCache.get(s);
  if (cached) {return cached;}
  const ink = scanInk(s);
  inkCache.set(s, ink);
  return ink;
}

const HERO_INK = inkOf(heroFrames[0]);
const heroTipX = (): number => HERO_X - HERO_W / 2 + (HERO_INK.last + 1) * ACTOR_PX;

function enemyFrontX(g: Game): number {
  const e = g.battle.enemy;
  const first = e ? inkOf(enemyAnim(e.def.id)[0]).first : 0;
  return enemyAnchor(g).front + first * ACTOR_PX;
}

export const enemyContact = (g: Game): Point => ({ x: enemyFrontX(g) + BLADE_BITE, y: enemyPos(g).y });

export const heroContact = (): Point => ({ x: heroTipX() - BODY_BITE, y: heroPos().y });

export const heroReach = (g: Game): number => Math.max(0, enemyFrontX(g) + BLADE_BITE - heroTipX());

export const enemyReach = (g: Game): number => Math.max(0, enemyFrontX(g) - heroContact().x);
