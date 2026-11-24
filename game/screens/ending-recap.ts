import { PICO8 } from '../../engine';
import { SLOTS } from '../types';
import { HOLLOW_ID, PACTS } from '../data';
import { actInDepth, depthOf, displayName, gloryBonus, itemLevel } from '../sim';
import { biome } from '../state';
import type { DeathRecord, Game } from '../state';
import { C_ACCENT, C_DIM, C_LOG_HURT, C_TEXT, C_WARN } from '../theme';
import { at } from '../lookup';

export interface RecapLine { text: string; color: string; pack?: readonly string[]; wrap?: boolean }

type TipKey = 'HEAVY' | 'STRIKE' | 'HEX' | 'SCORCH' | 'BURN' | 'THORNS' | 'BLOOD' | 'HOLLOW' | 'ELITE' | 'ABANDONED';

const TIPS: Record<TipKey, readonly string[]> = {
  HEAVY: ['GUARD WHEN IT WINDS UP, OR BREAK IT', 'GUARD THE HEAVY BLOW TO PARRY AND RIPOSTE', 'HIT ITS WEAKNESS AS IT WINDS UP TO BREAK IT', 'SAVE EMBER BURST FOR THE WIND-UP'],
  STRIKE: ['REST SITES REFILL POTIONS - ROUTE VIA ONE', 'DRINK A POTION BEFORE THE HIT, NOT AFTER', 'GUARD HALVES ANY BLOW WHEN HP RUNS LOW', 'SPEND POINTS ON HP AND DEF WHEN HITS HURT'],
  HEX: ['HEXES ARE MAGIC - MDEF BLUNTS THEM, NOT DEF', 'SPEND A POINT ON MDEF WHEN HEXERS HURT', 'REST SITES REFILL POTIONS - ROUTE VIA ONE'],
  SCORCH: ['BURN TICKS FOR 3 TURNS - A POTION BUYS TIME', 'ASH MANTLE OR FROST BEAD WARD OFF BURNS', 'A SCORCHER BURNS YOU - END IT BEFORE IT ADDS UP'],
  BURN: ['BURN TICKS FOR 3 TURNS - A POTION BUYS TIME', 'ASH MANTLE OR FROST BEAD WARD OFF BURNS', 'BURNS TICK AT YOUR TURN - HEAL BEFORE THEN'],
  THORNS: ['THORNED FOES PUNISH MANY SMALL HITS', 'ONE BIG HIT BEATS MANY SMALL ONES ON THORNS', 'THORNS NEVER FIRE ON THE KILLING BLOW'],
  BLOOD: ['THE BLOOD PRICE BITES EACH TURN - BE QUICK', 'A PACT IS A DEBT - PICK ONE YOUR BUILD PAYS'],
  HOLLOW: ['THE HOLLOW WEARS YOUR GEAR - SWAP BEFORE IT', 'YOUR SHADOW COPIES YOUR GEAR AFFIXES TOO', 'PACK A COUNTER-BUILD FOR YOUR OWN SHADOW'],
  ELITE: ['ELITES PAY WELL BUT CAN WAIT UNTIL YOU HEAL', 'SKIP AN ELITE WHEN HP IS LOW - REST FIRST', 'ELITES HIT HARDER - FIGHT THEM AT FULL HP'],
  ABANDONED: ['A NEW RUN DRAWS A NEW MAP - THE EMBER WAITS', 'EVERY ROUTE TEACHES SOMETHING - TRY ANOTHER'],
};

const MOVE_TIP: Partial<Record<string, TipKey>> = { 'HEAVY BLOW': 'HEAVY', SCORCH: 'SCORCH', HEX: 'HEX' };
const CAUSE_TIP: Partial<Record<DeathRecord['cause'], TipKey>> = { BURN: 'BURN', THORNS: 'THORNS', BLOOD: 'BLOOD' };

function tipKey(d: DeathRecord): TipKey {
  if (d.killerId === HOLLOW_ID) {return 'HOLLOW';}
  const byCause = CAUSE_TIP[d.cause];
  if (byCause) {return byCause;}
  const byMove = MOVE_TIP[d.move];
  if (byMove) {return byMove;}
  return d.elite ? 'ELITE' : 'STRIKE';
}

const runHash = (g: Game): number => g.score * 7 + g.clears * 13 + g.n * 31 + g.death.damage * 17 + g.hero.sp;

function tipFor(g: Game, key: TipKey): RecapLine {
  const tips = TIPS[key];
  return { text: `NEXT TIME: ${at(tips, runHash(g) % tips.length)}`, color: C_ACCENT, wrap: true };
}

const KILL_LINE: Record<Exclude<DeathRecord['cause'], ''>, (d: DeathRecord) => [string, string]> = {
  BLOW: (d) => [`SLAIN BY ${d.killerName}`, `ITS ${d.move} DEALT ${String(d.damage)}`],
  THORNS: (d) => [`SLAIN BY ${d.killerName}`, `ITS THORNS STRUCK BACK FOR ${String(d.damage)}`],
  BURN: (d) => [`BURNED DOWN FIGHTING ${d.killerName}`, `THE LAST BURN TICK DEALT ${String(d.damage)}`],
  BLOOD: (d) => [`BLED OUT FIGHTING ${d.killerName}`, `THE BLOOD PRICE TOOK ${String(d.damage)}`],
};

function killerLines(d: DeathRecord): RecapLine[] {
  if (d.cause === '') {return [];}
  const [slain, how] = KILL_LINE[d.cause](d);
  const log = d.lastLines.map((text) => ({ text, color: C_DIM }));
  return [{ text: slain, color: C_LOG_HURT }, { text: how, color: C_TEXT }, ...log];
}

function placeLine(g: Game): RecapLine {
  const text = `DEPTH ${String(depthOf(g.n))}  ACT ${String(actInDepth(g.n) + 1)}  ${biome(g).name}`;
  return { text, color: C_TEXT };
}

function gearNames(g: Game): string[] {
  return SLOTS.flatMap((sl) => {
    const item = g.hero.equipment[sl];
    return item ? [displayName(item, itemLevel(g.hero, sl))] : [];
  });
}

function buildLines(g: Game): RecapLine[] {
  const names = gearNames(g);
  const gear: RecapLine = { text: names.length ? '' : 'NO GEAR', color: C_TEXT, pack: names };
  const pacts = g.hero.pacts.map((id) => PACTS[id].name);
  return pacts.length ? [gear, { text: `PACTS  ${pacts.join('  ')}`, color: C_WARN }] : [gear];
}

export function deathRecap(g: Game): RecapLine[] {
  return [placeLine(g), ...killerLines(g.death), ...buildLines(g), tipFor(g, tipKey(g.death))];
}

export function abandonRecap(g: Game): RecapLine[] {
  return [placeLine(g), ...buildLines(g), tipFor(g, 'ABANDONED')];
}

function invitation(depth: number): RecapLine {
  const text = depth > 1 ? `DEPTH ${String(depth + 1)} WAITS FOR YOUR NEXT RUN` : 'THE DESCENT WAITS FOR YOUR NEXT RUN';
  return { text, color: C_ACCENT, wrap: true };
}

export function winRecap(g: Game): RecapLine[] {
  const depth = depthOf(g.n);
  const glory = { text: `GLORY +${String(gloryBonus(depth))}   BOSSES FELLED ${String(g.bosses)}`, color: PICO8[11] };
  return [placeLine(g), glory, ...buildLines(g), invitation(depth)];
}
