// Ember Quest v3 — CHARACTERS: the launch roster, awakenings and leader
// skills. Headless: imports ../types and ./skills only.
//
// Kits are DESIGN.md's roster table. Base stats sit inside the contract's
// bands (HP 2000–4500 · ATK 150–320 · DEF 120–280 · SPD 95–120) and are
// chosen per role — the balance reviewer's "mid hero" (HP 3200 · ATK 235 ·
// DEF 180 · SPD 108) is close to the roster's mean. Phase 8 retunes them.

import type { CharacterDef } from '../types';

export const CHARACTERS: Record<string, CharacterDef> = {
  EMBER: {
    id: 'EMBER', name: 'Ember', element: 'FIRE',
    base: { hp: 2900, atk: 280, def: 150, spd: 104 },
    skills: ['CINDER', 'FLARE', 'INFERNO'],
    awakening: { name: 'Wildfire', upgrades: { slot: 2, to: 'INFERNO_BRAND' } },
    leader: { stat: 'ATK', amount: 20, element: 'FIRE', elementAmount: 35 },
  },
  GALE: {
    id: 'GALE', name: 'Gale', element: 'WIND',
    base: { hp: 2600, atk: 220, def: 140, spd: 120 },
    skills: ['GUST', 'SQUALL', 'TAILWIND'],
    awakening: { name: 'Riptide', upgrades: { slot: 0, to: 'GUST_RIP' } },
    leader: { stat: 'SPD', amount: 15, element: 'WIND', elementAmount: 25 },
  },
  TIDE: {
    id: 'TIDE', name: 'Tide', element: 'WATER',
    base: { hp: 3800, atk: 180, def: 190, spd: 108 },
    skills: ['RIPPLE', 'TIDEPOOL', 'UNDERTOW'],
    awakening: { name: 'Stillwater', upgrades: { slot: 2, to: 'UNDERTOW_WARD' } },
    leader: { stat: 'HP', amount: 20, element: 'WATER', elementAmount: 30 },
  },
  BASALT: {
    id: 'BASALT', name: 'Basalt', element: 'FIRE',
    base: { hp: 4200, atk: 160, def: 280, spd: 96 },
    skills: ['BASH', 'BULWARK', 'QUAKE'],
    awakening: { name: 'Rampart', upgrades: { slot: 1, to: 'BULWARK_RAMPART' } },
    leader: { stat: 'DEF', amount: 25 },
  },
  SABLE: {
    id: 'SABLE', name: 'Sable', element: 'DARK',
    base: { hp: 3000, atk: 210, def: 160, spd: 112 },
    skills: ['HEX', 'MIRE', 'ECLIPSE'],
    awakening: { name: 'Lingering Hex', upgrades: { slot: 0, to: 'HEX_LINGER' } },
    leader: { stat: 'ACC', amount: 20 },
  },
  LUMEN: {
    id: 'LUMEN', name: 'Lumen', element: 'LIGHT',
    base: { hp: 2500, atk: 320, def: 120, spd: 100 },
    skills: ['LANCE', 'RADIANCE', 'JUDGEMENT'],
    awakening: { name: 'Verdict', upgrades: { slot: 2, to: 'JUDGEMENT_REFUND' } },
    leader: { stat: 'CRIT', amount: 35 },
  },
};

/** Roster order — the draft screen and the harness's `roster` default. */
export const ROSTER: readonly string[] = ['EMBER', 'GALE', 'TIDE', 'BASALT', 'SABLE', 'LUMEN'];

/** The phase-4 vertical slice's fixed party, leader first. */
export const SLICE_PARTY: readonly string[] = ['EMBER', 'GALE', 'TIDE'];
