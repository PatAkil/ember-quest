// Ember Quest v3 — PACTS: SHRINE curse/boon pairs. Headless.
// DESIGN.md → Pacts. Both halves last the rest of the run and stack; a SHRINE
// draws uniformly among untaken pacts and is a FORGE when none remain.

import type { Pact, PactId } from '../types';

export const PACTS: Record<PactId, Pact> = {
  HASTE: { id: 'HASTE', name: 'Pact of Haste', blurb: 'Enemies +6% SPD; +1 card',
    curse: { kind: 'ENEMY_SPD_PCT', pct: 6 }, boon: { kind: 'EXTRA_CARDS', count: 1 } },
  FURY: { id: 'FURY', name: 'Pact of Fury', blurb: 'Foes +15% ATK; party +15% ATK',
    curse: { kind: 'ENEMY_ATK_PCT', pct: 15 }, boon: { kind: 'PARTY_ATK_PCT', pct: 15 } },
  VEIL: { id: 'VEIL', name: 'Pact of the Veil', blurb: 'Bosses open immune; EPICs +2',
    curse: { kind: 'BOSS_INVINCIBLE_START', turns: 1 }, boon: { kind: 'EPIC_DROP_LEVEL', levels: 2 } },
  BLIND: { id: 'BLIND', name: 'Blind Pact', blurb: 'Party RES -30; party ACC +10',
    curse: { kind: 'PARTY_RES', pts: -30 }, boon: { kind: 'PARTY_ACC', pts: 10 } },
  SCHISM: { id: 'SCHISM', name: 'Pact of Schism', blurb: 'No leader skill; own at half',
    curse: { kind: 'LEADER_OFF' }, boon: { kind: 'LEADER_SELF' } },
  DEARTH: { id: 'DEARTH', name: 'Pact of Dearth', blurb: 'One fewer card; FORGE gives +4',
    curse: { kind: 'FEWER_CARDS', count: 1 }, boon: { kind: 'FORGE_LEVELS', levels: 4 } },
};

export const PACT_IDS = Object.keys(PACTS) as PactId[];
