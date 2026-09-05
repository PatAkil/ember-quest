// Ember Quest v3 — SIGILS: the authored effects on EPIC and LEGENDARY relics,
// two per slot, each with its kindled (+6) behaviour. Headless.
// DESIGN.md → Sigils and kindling. Blurbs ≤ 30 chars; a kindled blurb differs.

import type { SigilDef, SigilId } from '../types';

export const SIGILS: Record<SigilId, SigilDef> = {
  OPENER: { id: 'OPENER', slot: 'WEAPON', blurb: 'First skill starts no cooldown', effect: { kind: 'OPENER' },
    kindled: { blurb: 'First skill free, and +30% ATB', effect: { kind: 'OPENER', atb: 0.3 } } },
  RENDER: { id: 'RENDER', slot: 'WEAPON', blurb: 'Crits strip 10% ATB', effect: { kind: 'RENDER', strip: 0.1 },
    kindled: { blurb: 'Crits strip ATB, stretch a hex', effect: { kind: 'RENDER', strip: 0.1, extend: 1 } } },
  SURGE: { id: 'SURGE', slot: 'BOOTS', blurb: 'On a kill: +50% ATB', effect: { kind: 'SURGE', self: 0.5 },
    kindled: { blurb: 'A kill: +50% ATB, allies +25%', effect: { kind: 'SURGE', self: 0.5, allies: 0.25 } } },
  TRIP: { id: 'TRIP', slot: 'BOOTS', blurb: 'Your SLOW also strips 25% ATB', effect: { kind: 'TRIP', slowStrip: 0.25 },
    kindled: { blurb: 'SLOW strips 25%, STUN all', effect: { kind: 'TRIP', slowStrip: 0.25, stunStrip: 1 } } },
  BASTION: { id: 'BASTION', slot: 'ARMOR', blurb: 'Shields on you are 50% larger', effect: { kind: 'BASTION', bonus: 0.5 },
    kindled: { blurb: 'Bigger shields that cleanse', effect: { kind: 'BASTION', bonus: 0.5, cleanse: 1 } } },
  THORNS: { id: 'THORNS', slot: 'ARMOR', blurb: 'COUNTER under DEF_UP or shield', effect: { kind: 'THORNS' },
    kindled: { blurb: 'Counters also DEF_BREAK', effect: { kind: 'THORNS', applyBreak: 0.75 } } },
  SPARK: { id: 'SPARK', slot: 'NECKLACE', blurb: 'Crit: longest cooldown -1', effect: { kind: 'SPARK' },
    kindled: { blurb: 'Crit: every cooldown -1', effect: { kind: 'SPARK', all: true } } },
  BLOODLUST: { id: 'BLOODLUST', slot: 'NECKLACE', blurb: '+10 CRIT per debuff on target', effect: { kind: 'BLOODLUST', perDebuff: 10 },
    kindled: { blurb: '+15 CRIT per debuff on target', effect: { kind: 'BLOODLUST', perDebuff: 15 } } },
  MENDING: { id: 'MENDING', slot: 'CHALICE', blurb: 'Your heals cleanse one debuff', effect: { kind: 'MENDING' },
    kindled: { blurb: 'Heals cleanse and give 10% ATB', effect: { kind: 'MENDING', atb: 0.1 } } },
  GRUDGE: { id: 'GRUDGE', slot: 'CHALICE', blurb: 'Hit below 50% HP: ATK_UP', effect: { kind: 'GRUDGE', threshold: 0.5, turns: 2 },
    kindled: { blurb: 'Hit below 50%: ATK_UP, shield', effect: { kind: 'GRUDGE', threshold: 0.5, turns: 2, shield: 0.15 } } },
  LOCKDOWN: { id: 'LOCKDOWN', slot: 'TOME', blurb: 'Your debuffs last +1 turn', effect: { kind: 'LOCKDOWN', extra: 1 },
    kindled: { blurb: 'Debuffs last +1 and ignore RES', effect: { kind: 'LOCKDOWN', extra: 1, ignoreRes: true } } },
  ECHO: { id: 'ECHO', slot: 'TOME', blurb: 'Skill 3 cooldown -1', effect: { kind: 'ECHO', skills: [2] },
    kindled: { blurb: 'Skills 2 and 3 cooldown -1', effect: { kind: 'ECHO', skills: [1, 2] } } },
};

export const SIGIL_IDS = Object.keys(SIGILS) as SigilId[];
