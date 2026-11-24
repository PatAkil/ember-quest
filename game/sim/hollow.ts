import { HOLLOW_HP_FLOOR, type AffixId, type EnemyInstance, type FoeScale, type Hero } from '../types';
import { HOLLOW_ID } from '../data';
import { spawnEnemy } from './combat';
import { derive } from './hero';

export function hollowOf(hero: Hero, n: number): EnemyInstance {
  const shell = spawnEnemy(HOLLOW_ID, { n, clears: 0, descentClears: null });
  const hp = Math.max(shell.hp, Math.round(HOLLOW_HP_FLOOR * derive(hero).maxHp));
  return { ...shell, hp, maxHp: hp };
}

export interface SpawnContext extends FoeScale { hero: Hero; affixes?: readonly AffixId[] }

export const spawnFoe = (id: string, ctx: SpawnContext): EnemyInstance =>
  (id === HOLLOW_ID ? hollowOf(ctx.hero, ctx.n) : spawnEnemy(id, ctx, ctx.affixes ?? []));
