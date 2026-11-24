import { PICO8 } from '../../engine';
import { SLOTS } from '../types';
import { PACTS } from '../data';
import { actInDepth, depthOf, displayName, gloryBonus, itemLevel } from '../sim';
import { biome, shownAct } from '../state';
import type { DeathRecord, Game } from '../state';
import { C_ACCENT, C_DIM, C_LOG_HURT, C_TEXT, C_WARN } from '../theme';
import { abandonTip, deathTip } from './ending-tips';
import type { RecapLine } from './ending-tips';


const KILL_LINE: Record<Exclude<DeathRecord['cause'], ''>, (d: DeathRecord) => [string, string]> = {
  BLOW: (d) => [`SLAIN BY ${d.killerName}`, `ITS ${d.move} DEALT ${String(d.damage)}${d.guarded ? ' THROUGH YOUR GUARD' : ''}`],
  THORNS: (d) => [`SLAIN BY ${d.killerName}`, `ITS THORNS STRUCK BACK FOR ${String(d.damage)}`],
  BURN: (d) => [`BURNED DOWN FIGHTING ${d.killerName}`, `THE LAST BURN TICK DEALT ${String(d.damage)}`],
  BLOOD: (d) => [`BLED OUT FIGHTING ${d.killerName}`, `THE BLOOD PRICE TOOK ${String(d.damage)}`],
};

function killerLines(d: DeathRecord): RecapLine[] {
  if (d.cause === '') {return [];}
  const [slain, how] = KILL_LINE[d.cause](d);
  const log = d.lastLines.map((text) => ({ text, color: C_DIM }));
  return [{ text: slain, color: C_LOG_HURT }, ...log, { text: how, color: C_TEXT }];
}

function placeLine(g: Game): RecapLine {
  const { n } = shownAct(g);
  const text = `DEPTH ${String(depthOf(n))}  ACT ${String(actInDepth(n) + 1)}  ${biome(g).name}`;
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
  return [placeLine(g), ...killerLines(g.death), ...buildLines(g), deathTip(g)];
}

export function abandonRecap(g: Game): RecapLine[] {
  return [placeLine(g), ...buildLines(g), abandonTip(g)];
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
