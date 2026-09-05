// Ember Quest v3 — SETS: eight 2-piece and eight 4-piece bonuses. Headless.
// DESIGN.md → Sets. A 2-piece applies floor(n / 2) times, a 4-piece once;
// every bonus is wearer-only except BULWARK's battle-start shield.

import type { SetDef, SetId } from '../types';
import {
  BULWARK_SHIELD, BULWARK_TURNS, DESPAIR_CHANCE, DESTROY_DEALT, DESTROY_FLOOR, DESTROY_FRACTION,
  NEMESIS_ATB, REVENGE_CHANCE, VAMPIRE_FRACTION, VIOLENT_CHANCE, WILL_RES, WILL_TURNS,
} from '../types';

export const SETS: Record<SetId, SetDef> = {
  FATAL: { id: 'FATAL', name: 'FATAL', pieces: 2, bonus: { kind: 'STAT_PCT', stat: 'ATK', pct: 15 } },
  ENERGY: { id: 'ENERGY', name: 'ENERGY', pieces: 2, bonus: { kind: 'STAT_PCT', stat: 'HP', pct: 15 } },
  GUARD: { id: 'GUARD', name: 'GUARD', pieces: 2, bonus: { kind: 'STAT_PCT', stat: 'DEF', pct: 15 } },
  SWIFT: { id: 'SWIFT', name: 'SWIFT', pieces: 2, bonus: { kind: 'STAT_PCT', stat: 'SPD', pct: 20 } },
  BLADE: { id: 'BLADE', name: 'BLADE', pieces: 2, bonus: { kind: 'STAT_PTS', stat: 'CRIT', pts: 12 } },
  RAGE: { id: 'RAGE', name: 'RAGE', pieces: 2, bonus: { kind: 'STAT_PTS', stat: 'CDMG', pts: 40 } },
  FOCUS: { id: 'FOCUS', name: 'FOCUS', pieces: 2, bonus: { kind: 'STAT_PTS', stat: 'ACC', pts: 20 } },
  ENDURE: { id: 'ENDURE', name: 'ENDURE', pieces: 2, bonus: { kind: 'STAT_PTS', stat: 'RES', pts: 20 } },
  VIOLENT: { id: 'VIOLENT', name: 'VIOLENT', pieces: 4, bonus: { kind: 'EXTRA_TURN', chance: VIOLENT_CHANCE } },
  DESPAIR: { id: 'DESPAIR', name: 'DESPAIR', pieces: 4, bonus: { kind: 'STUN_ON_HIT', chance: DESPAIR_CHANCE, turns: 1 } },
  VAMPIRE: { id: 'VAMPIRE', name: 'VAMPIRE', pieces: 4, bonus: { kind: 'LEECH', fraction: VAMPIRE_FRACTION } },
  WILL: { id: 'WILL', name: 'WILL', pieces: 4, bonus: { kind: 'IMMUNITY_START', turns: WILL_TURNS, res: WILL_RES } },
  NEMESIS: { id: 'NEMESIS', name: 'NEMESIS', pieces: 4, bonus: { kind: 'ATB_ON_HIT', fraction: NEMESIS_ATB } },
  REVENGE: { id: 'REVENGE', name: 'REVENGE', pieces: 4, bonus: { kind: 'COUNTER', chance: REVENGE_CHANCE } },
  BULWARK: { id: 'BULWARK', name: 'BULWARK', pieces: 4, bonus: { kind: 'SHIELD_START', fraction: BULWARK_SHIELD, turns: BULWARK_TURNS } },
  DESTROY: { id: 'DESTROY', name: 'DESTROY', pieces: 4, bonus: { kind: 'DESTROY', dealt: DESTROY_DEALT, fraction: DESTROY_FRACTION, floor: DESTROY_FLOOR } },
};

export const SET_IDS = Object.keys(SETS) as SetId[];
export const TWO_PIECE_SETS: readonly SetId[] = SET_IDS.filter((id) => SETS[id].pieces === 2);
export const FOUR_PIECE_SETS: readonly SetId[] = SET_IDS.filter((id) => SETS[id].pieces === 4);
