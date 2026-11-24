import { ENEMIES, HOLLOW_ID } from '../data';
import { EMBER_MAX } from '../types';
import { canAfford, knownSpells } from '../sim';
import type { DeathRecord, Game } from '../state';
import { C_ACCENT } from '../theme';
import { at } from '../lookup';
import { hasWeakAnswer, weakSpells } from './battle-preview';

export interface RecapLine { text: string; color: string; pack?: readonly string[]; wrap?: boolean }

type TipKey =
  | 'HEAVY' | 'STRIKE' | 'HEX' | 'SCORCH' | 'BURN' | 'THORNS' | 'BLOOD' | 'HOLLOW' | 'ELITE' | 'ABANDONED'
  | 'GUARD_FAILED' | 'NO_ANSWER' | 'DRY' | 'NO_MP' | 'IDLE_MAGIC' | 'IDLE_BURST' | 'NO_GUARD';

const TIPS: Record<TipKey, readonly string[]> = {
  HEAVY: ['GUARD WHEN IT WINDS UP, OR BREAK IT', 'GUARD THE HEAVY BLOW TO PARRY AND RIPOSTE', 'HIT ITS WEAKNESS AS IT WINDS UP TO BREAK IT', 'SAVE EMBER BURST FOR THE WIND-UP'],
  STRIKE: ['REST SITES REFILL POTIONS - ROUTE VIA ONE', 'DRINK A POTION BEFORE THE HIT, NOT AFTER', 'GUARD HALVES ANY BLOW WHEN HP RUNS LOW', 'SPEND POINTS ON HP AND DEF WHEN HITS HURT'],
  HEX: ['HEXES ARE MAGIC - MDEF BLUNTS THEM, NOT DEF', 'SPEND A POINT ON MDEF WHEN HEXERS HURT', 'REST SITES REFILL POTIONS - ROUTE VIA ONE'],
  SCORCH: ['BURN TICKS FOR 3 TURNS - A POTION BUYS TIME', 'ASH MANTLE OR FROST BEAD WARD OFF BURNS', 'A SCORCHER BURNS YOU - END IT BEFORE IT ADDS UP'],
  BURN: ['BURN TICKS FOR 3 TURNS - A POTION BUYS TIME', 'ASH MANTLE OR FROST BEAD WARD OFF BURNS', 'BURN TICKS AFTER YOU ACT - A POTION LANDS FIRST'],
  THORNS: ['THORNED FOES PUNISH MANY SMALL HITS', 'ONE BIG HIT BEATS MANY SMALL ONES ON THORNS', 'THORNS NEVER FIRE ON THE KILLING BLOW'],
  BLOOD: ['THE BLOOD PRICE BITES EACH TURN - BE QUICK', 'A PACT IS A DEBT - PICK ONE YOUR BUILD PAYS'],
  HOLLOW: ['THE HOLLOW WEARS YOUR GEAR - SWAP BEFORE IT', 'YOUR SHADOW COPIES YOUR GEAR AFFIXES TOO', 'PACK A COUNTER-BUILD FOR YOUR OWN SHADOW'],
  ELITE: ['ELITES PAY WELL BUT CAN WAIT UNTIL YOU HEAL', 'SKIP AN ELITE WHEN HP IS LOW - REST FIRST', 'ELITES HIT HARDER - FIGHT THEM AT FULL HP'],
  ABANDONED: ['A NEW RUN DRAWS A NEW MAP - THE EMBER WAITS', 'EVERY ROUTE TEACHES SOMETHING - TRY ANOTHER'],
  GUARD_FAILED: ['A GUARD ONLY SOFTENS THE BLOW - HEAL BEFORE IT LANDS', 'GUARDED, IT STILL KILLED - DRINK OR BREAK IT FIRST'],
  NO_ANSWER: ['THE MAP NAMES THE BOSS WEAKNESS - CARRY A SPELL FOR IT', 'TAKE A SCROLL OF THE BOSS WEAKNESS BEFORE THE FIGHT'],
  DRY: ['YOU RAN OUT OF POTIONS - REST SITES REFILL THEM', 'REST SITES REFILL POTIONS - ROUTE VIA ONE'],
  NO_MP: ['OUT OF MP - A GUARDED HIT GIVES SOME BACK', 'SPEND A POINT ON MP WHEN SPELLS RUN DRY'],
  IDLE_MAGIC: ['YOUR MAGIC HIT ITS WEAKNESS - USE IT', 'A WEAK SPELL HITS FAR HARDER THAN ATTACK'],
  IDLE_BURST: ['YOUR EMBER WAS FULL - BURST HITS HARDEST', 'A FULL EMBER IS A BURST WAITING - SPEND IT'],
  NO_GUARD: ['GUARD THE HEAVY BLOW TO PARRY AND RIPOSTE', 'GUARD WHEN IT WINDS UP - A HEAVY BLOW FOLLOWS'],
};

const MOVE_TIP: Partial<Record<string, TipKey>> = { 'HEAVY BLOW': 'HEAVY', SCORCH: 'SCORCH', HEX: 'HEX' };
const CAUSE_TIP: Partial<Record<DeathRecord['cause'], TipKey>> = { BURN: 'BURN', THORNS: 'THORNS', BLOOD: 'BLOOD' };

const killedByBlow = (d: DeathRecord): boolean => d.cause === 'BLOW';

function unansweredBoss(g: Game): boolean {
  const e = g.battle.enemy;
  const def = ENEMIES[g.death.killerId];
  return Boolean(e && def?.kind === 'BOSS' && def.weak && !hasWeakAnswer(g.hero, e));
}

function idleMagic(g: Game): boolean {
  const e = g.battle.enemy;
  return Boolean(e && !g.death.used.includes('MAGIC') && weakSpells(g.hero, e).some((id) => canAfford(g.hero, id)));
}

const outOfMp = (g: Game): boolean => {
  const spells = knownSpells(g.hero);
  return spells.length > 0 && !spells.some((id) => canAfford(g.hero, id));
};

const SITUATIONS: readonly [TipKey, (g: Game) => boolean][] = [
  ['GUARD_FAILED', (g) => killedByBlow(g.death) && g.death.guarded],
  ['NO_ANSWER', unansweredBoss],
  ['IDLE_BURST', (g) => g.hero.ember >= EMBER_MAX && !g.death.used.includes('BURST')],
  ['IDLE_MAGIC', idleMagic],
  ['NO_GUARD', (g) => g.death.move === 'HEAVY BLOW' && !g.death.used.includes('GUARD')],
  ['DRY', (g) => g.hero.potions === 0 && killedByBlow(g.death)],
  ['NO_MP', outOfMp],
];

function causeKey(d: DeathRecord): TipKey {
  const byCause = CAUSE_TIP[d.cause];
  if (byCause) {return byCause;}
  const byMove = MOVE_TIP[d.move];
  if (byMove) {return byMove;}
  return d.elite ? 'ELITE' : 'STRIKE';
}

function tipKey(g: Game): TipKey {
  if (g.death.killerId === HOLLOW_ID) {return 'HOLLOW';}
  const hit = SITUATIONS.find(([, applies]) => applies(g));
  return hit ? hit[0] : causeKey(g.death);
}

const runHash = (g: Game): number => g.score * 7 + g.clears * 13 + g.n * 31 + g.death.damage * 17 + g.hero.sp;

function tipFor(g: Game, key: TipKey): RecapLine {
  const tips = TIPS[key];
  return { text: `NEXT TIME: ${at(tips, runHash(g) % tips.length)}`, color: C_ACCENT, wrap: true };
}

export const deathTip = (g: Game): RecapLine => tipFor(g, tipKey(g));

export const abandonTip = (g: Game): RecapLine => tipFor(g, 'ABANDONED');
