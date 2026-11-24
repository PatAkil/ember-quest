import { SAFE_MARGIN, dimScene, drawText } from '../../engine';
import type { AffixId } from '../types';
import { AFFIX_IDS, PACTS, affixCountFor, depthOf, pactMods } from '../sim';
import { renderTableau } from '../backdrop';
import { at } from '../lookup';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_FAINT, C_GOOD, C_LOG_HURT, C_SEL_BAR, C_TEXT, C_WARN, W } from '../theme';
import { drawCommandBand, wrap2 } from '../widgets';
import { drawDetail, drawSkyCard, promptInk } from './threshold-view';
import type { Ink } from './threshold-view';
import { PACT_ARM, armed } from './threshold';

const NAME_W = 58;
const DETAIL_X = SAFE_MARGIN + NAME_W + 8;
const ROW_PITCH = 11;
const SKY_TEXT_W = W - 60;

function rollableAffixes(g: Game): AffixId[] {
  const counts = affixCountFor(depthOf(g.n));
  const most = Math.max(counts.normal, counts.elite) + pactMods(g.hero).foeAffix;
  if (most <= 0) {return [];}
  const seen = new Set(g.depthPlan.flatMap((plan) => (plan.affixOrder ?? AFFIX_IDS).slice(0, most)));
  return AFFIX_IDS.filter((id) => seen.has(id));
}

function depthLines(g: Game): Ink[] {
  const depth = `DEPTH ${String(depthOf(g.n))}`;
  const head = { text: `${depth} AWAITS`, color: C_DIM };
  const affixes = rollableAffixes(g);
  if (affixes.length === 0) {return [head];}
  const lines = wrap2(`${depth} FOES MAY BE: ${affixes.join(' ')}`, SKY_TEXT_W);
  const inks = lines.map((text) => ({ text, color: C_WARN }));
  return inks.length === 1 ? [head, ...inks] : inks;
}

function drawPactRows(g: Game, ctx: CanvasRenderingContext2D, ready: boolean): void {
  const { offers, cursor } = g.pact;
  offers.forEach((id, i) => {
    const y = BAND_Y + 6 + i * ROW_PITCH;
    const sel = i === cursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(SAFE_MARGIN, y - 2, NAME_W, 9); }
    const color = ready ? (sel ? C_ACCENT : C_TEXT) : C_FAINT;
    drawText(ctx, `${sel ? '> ' : '  '}${PACTS[id].name}`, { x: SAFE_MARGIN + 2, y }, { color, shadow: sel });
  });
}

export function renderPact(g: Game): void {
  const { pc } = g.app;
  const { ctx } = pc;
  const { offers, cursor, openedAt } = g.pact;
  const ready = armed(g, { openedAt, delay: PACT_ARM });
  const chosen = PACTS[at(offers, cursor)];
  renderTableau(g, false);
  dimScene(pc, 0.6);
  drawSkyCard(ctx, 'CHOOSE A PACT', depthLines(g));
  drawCommandBand(ctx);
  drawPactRows(g, ctx, ready);
  drawDetail(ctx, [
    { text: `CURSE: ${chosen.curse}`, color: C_LOG_HURT },
    { text: `BOON: ${chosen.boon}`, color: C_GOOD },
    { text: '', color: C_TEXT },
    promptInk(g, ready, 'SEAL THE PACT'),
  ], DETAIL_X);
}
