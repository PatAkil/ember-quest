import { SAFE_MARGIN, dimScene, drawText } from '../../engine';
import type { AffixId } from '../types';
import { PACTS, depthAffixes, depthOf } from '../sim';
import { renderTableau } from '../backdrop';
import { armed } from '../state';
import type { Game } from '../state';
import { BAND_Y, C_ACCENT, C_DIM, C_FAINT, C_GOOD, C_LOG_HURT, C_SEL_BAR, C_TEXT, C_WARN, W } from '../theme';
import { drawCommandBand, wrap2 } from '../widgets';
import { choosePrompt, drawDetail, drawSkyCard, promptInk } from './threshold-view';
import type { Ink } from './threshold-view';
import { PACT_ARM } from './threshold';

const NAME_W = 58;
const DETAIL_X = SAFE_MARGIN + NAME_W + 8;
const ROW_PITCH = 11;
const SKY_TEXT_W = W - 60;

const rollableAffixes = (g: Game): AffixId[] => depthAffixes(g.depthPlan);

function depthLines(g: Game): Ink[] {
  const depth = `DEPTH ${String(depthOf(g.n))}`;
  const head = { text: `${depth} AWAITS`, color: C_DIM };
  const affixes = rollableAffixes(g);
  if (affixes.length === 0) {return [head];}
  const lines = wrap2(`${depth} FOES MAY BE: ${affixes.join(' ')}`, SKY_TEXT_W);
  const inks = lines.map((text) => ({ text, color: C_WARN }));
  return inks.length === 1 ? [head, ...inks] : inks;
}

const AFFIX_BLURB: Record<AffixId, string> = {
  VAMPIRIC: 'HEALS AS IT HITS',
  ARMORED: '+20 DEF',
  WARDED: '+20 MDEF',
  THORNED: 'HURTS ATTACKERS',
  SWIFT: 'DODGES SOME HITS',
  SEARING: 'ITS STRIKES BURN',
};
const LEGEND = { x: 122, y: 57, pitch: 8, nameW: 40 };

function drawAffixLegend(g: Game, ctx: CanvasRenderingContext2D): void {
  rollableAffixes(g).forEach((id, i) => {
    const y = LEGEND.y + i * LEGEND.pitch;
    drawText(ctx, id, { x: LEGEND.x, y }, { color: C_WARN, shadow: true });
    drawText(ctx, AFFIX_BLURB[id], { x: LEGEND.x + LEGEND.nameW, y }, { color: C_TEXT, shadow: true });
  });
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
  const { openedAt } = g.pact;
  const ready = armed(g, { openedAt, delay: PACT_ARM });
  renderTableau(g, false);
  dimScene(pc, 0.6);
  drawSkyCard(ctx, 'CHOOSE A PACT', depthLines(g));
  drawAffixLegend(g, ctx);
  drawCommandBand(ctx);
  drawPactRows(g, ctx, ready);
  drawDetail(ctx, pactDetail(g, ready), DETAIL_X);
}

function pactDetail(g: Game, ready: boolean): Ink[] {
  const { offers, cursor, refusedAt } = g.pact;
  const id = offers[cursor];
  if (id === undefined) {
    return [
      { text: 'A PACT BINDS YOU FOR GOOD', color: C_TEXT },
      { text: 'EACH HAS A CURSE AND A BOON', color: C_DIM },
      { text: '', color: C_TEXT },
      choosePrompt(g, refusedAt),
    ];
  }
  const chosen = PACTS[id];
  return [
    { text: `CURSE: ${chosen.curse}`, color: C_LOG_HURT },
    { text: `BOON: ${chosen.boon}`, color: C_GOOD },
    { text: '', color: C_TEXT },
    promptInk(g, ready, 'SEAL THE PACT'),
  ];
}
