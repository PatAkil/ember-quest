import { GLORY_PER_DEPTH, SCORE_PER_BOSS, SCORE_PER_CLEAR } from '../types';

interface Tallies { clears: number; bosses: number }
interface Stakes { score: number; banked: number; won: boolean }

export const scoreOf = ({ clears, bosses }: Tallies): number => clears * SCORE_PER_CLEAR + bosses * SCORE_PER_BOSS;

export const gloryBonus = (depth: number): number => GLORY_PER_DEPTH * depth;

export const scoreAfterDeath = ({ score, banked, won }: Stakes): number =>
  (won ? banked + Math.floor((score - banked) / 2) : score);
