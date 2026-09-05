// Ember Quest v3 — PACTS: SHRINE curse/boon pairs. Headless.
// DESIGN.md → Pacts. Both halves last the rest of the run and stack; a SHRINE
// draws uniformly among untaken pacts and is a FORGE when none remain.

import type { Pact, PactId } from '../types';

export const PACTS: Record<PactId, Pact> = {
  HASTE: { id: 'HASTE', name: 'Pact of Haste', blurb: 'Enemies +10% SPD; +1 card',
    curse: { kind: 'ENEMY_SPD_PCT', pct: 10 }, boon: { kind: 'EXTRA_CARDS', count: 1 } },
  FURY: { id: 'FURY', name: 'Pact of Fury', blurb: 'Foes +15% ATK; party +15% ATK',
    curse: { kind: 'ENEMY_ATK_PCT', pct: 15 }, boon: { kind: 'PARTY_ATK_PCT', pct: 15 } },
  VEIL: { id: 'VEIL', name: 'Pact of the Veil', blurb: 'Bosses open immune; EPICs +1',
    curse: { kind: 'BOSS_INVINCIBLE_START', turns: 1 }, boon: { kind: 'EPIC_DROP_LEVEL', levels: 1 } },
  BLIND: { id: 'BLIND', name: 'Blind Pact', blurb: 'Party RES -20; party ACC +25',
    curse: { kind: 'PARTY_RES', pts: -20 }, boon: { kind: 'PARTY_ACC', pts: 25 } },
  SCHISM: { id: 'SCHISM', name: 'Pact of Schism', blurb: 'No leader skill; own at half',
    curse: { kind: 'LEADER_OFF' }, boon: { kind: 'LEADER_SELF' } },
  DEARTH: { id: 'DEARTH', name: 'Pact of Dearth', blurb: 'One fewer card; FORGE gives +4',
    curse: { kind: 'FEWER_CARDS', count: 1 }, boon: { kind: 'FORGE_LEVELS', levels: 4 } },
};

export const PACT_IDS = Object.keys(PACTS) as PactId[];
