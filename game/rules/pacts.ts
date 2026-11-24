import { PACT_IDS, type PactDef, type PactId } from '../types';

export const PACTS: Record<PactId, PactDef> = {
  BRITTLE: { id: 'BRITTLE', name: 'BRITTLE', curse: '-20% MAX HP', boon: '+25% DAMAGE DEALT', mods: { maxHpMult: 0.8, dmgMult: 1.25 } },
  TITHE: { id: 'TITHE', name: 'TITHE', curse: 'CLEAR HEAL 25% TO 10%', boon: '+1 SP PER CLEAR', mods: { clearHealMult: 0.4, spPerClear: 1 } },
  HEX: { id: 'HEX', name: 'HEX', curse: 'ELITES AND BOSSES +1 AFFIX', boon: 'ELITE AND BOSS LOOT +1 RARITY', mods: { foeAffix: 1, rarityShift: 1 } },
  IRON: { id: 'IRON', name: 'IRON', curse: 'FOES +15% ATK', boon: '+15% MAX HP, +1 SP PER BOSS', mods: { foeAtkMult: 1.15, maxHpMult: 1.15, spPerBoss: 1 } },
  MISER: { id: 'MISER', name: 'MISER', curse: 'FIGHT ROOMS NEVER DROP', boon: 'CHESTS, ELITES, BOSSES +1 CARD', mods: { fightDrops: 0, extraCard: 1 } },
  STORM: { id: 'STORM', name: 'STORM', curse: 'ATTACK DEALS -15%', boon: 'BURST FILLS X1.5', mods: { attackMult: 0.85, burstGainMult: 1.5 } },
  ASH: { id: 'ASH', name: 'ASH', curse: 'REST HEALS 50%', boon: 'REST ALSO GIVES AN UPGRADE', mods: { restHealMult: 0.5, restUpgrade: 1 } },
  HUNTER: { id: 'HUNTER', name: 'HUNTER', curse: 'ELITES +30% HP', boon: 'ELITES +2 SP AND A 4TH CARD', mods: { eliteHpMult: 1.3, eliteSp: 2, eliteExtraCard: 1 } },
};

const PACT_NAME_MAX = 12;
const PACT_LINE_MAX = 30;

const lineFaults = (p: PactDef, what: 'curse' | 'boon'): string[] => {
  const text = p[what];
  const bad: string[] = [];
  if (text.length === 0 || text.length > PACT_LINE_MAX) {bad.push(`${p.id}: ${what} must be 1..${String(PACT_LINE_MAX)} chars`);}
  if (text !== text.toUpperCase()) {bad.push(`${p.id}: ${what} not uppercase`);}
  return bad;
};

function pactFaults(id: PactId): string[] {
  const p = PACTS[id];
  const bad = [...lineFaults(p, 'curse'), ...lineFaults(p, 'boon')];
  if (p.id !== id) {bad.push(`${id}: id field says ${p.id}`);}
  if (p.name.length > PACT_NAME_MAX || p.name !== p.name.toUpperCase()) {bad.push(`${id}: name must be uppercase, at most ${String(PACT_NAME_MAX)} chars`);}
  if (Object.keys(p.mods).length === 0) {bad.push(`${id}: a pact needs at least one mod`);}
  return bad;
}

export function validatePacts(): string[] {
  const listed = Object.keys(PACTS);
  const bad = PACT_IDS.flatMap(pactFaults);
  if (listed.length !== PACT_IDS.length) {bad.push('PACTS and PACT_IDS disagree');}
  return bad;
}
