// Ember Quest v3 — ASCENSION: the A0–A10 ladder as eleven cumulative rows.
// Headless. DESIGN.md → Ascension: each level adds its row to every row above.

import type { AscensionRow } from '../types';
import { ASC_HP_ATK_PER_LEVEL, ASC_RES_PER_LEVEL } from '../types';

function row(a: number): AscensionRow {
  return {
    enemyHpPct: a * ASC_HP_ATK_PER_LEVEL * 100,
    enemyAtkPct: a * ASC_HP_ATK_PER_LEVEL * 100,
    enemyRes: ASC_RES_PER_LEVEL * Math.max(0, a - 1),
    restGuarantee: a < 3,
    substatTopMinus: a >= 4 ? 1 : 0,
    bossFourthSkill: a >= 5,
    restWeightMult: a >= 6 ? 0.5 : 1,
    enemySpdPct: a >= 7 ? 8 : 0,
    elitePackPlus: a >= 8 ? 1 : 0,
    bossOpens: a >= 9,
    bossWill: a >= 10,
  };
}

/** Index = ascension level; A0 is the identity row. */
export const ASCENSION: readonly AscensionRow[] = Array.from({ length: 11 }, (_, a) => row(a));
