import { dimScene, drawPanel, drawTextCentered } from '../../engine';
import { PACTS } from '../data';
import { depthOf } from '../sim';
import { renderTableau } from '../backdrop';
import { at } from '../lookup';
import type { Game } from '../state';
import { C_ACCENT, C_BORDER, C_GOOD, C_LOG_HURT, C_PANEL, W } from '../theme';
import { TOP_PANEL, drawChoiceRows } from './threshold-view';

export function renderPact(g: Game): void {
  const { pc } = g.app;
  const { ctx } = pc;
  const { offers, cursor } = g.pact;
  const chosen = PACTS[at(offers, cursor)];
  renderTableau(g, false);
  dimScene(pc, 0.6);
  drawPanel(pc, TOP_PANEL, { color: C_PANEL, border: C_BORDER });
  drawTextCentered(ctx, `DEPTH ${String(depthOf(g.n))}  SEAL A PACT`, { width: W, y: TOP_PANEL.y + 6 }, { color: C_ACCENT, shadow: true });
  drawTextCentered(ctx, chosen.name, { width: W, y: TOP_PANEL.y + 15 }, { color: C_ACCENT, scale: 2, shadow: true });
  drawTextCentered(ctx, chosen.curse, { width: W, y: TOP_PANEL.y + 29 }, { color: C_LOG_HURT, shadow: true });
  drawTextCentered(ctx, chosen.boon, { width: W, y: TOP_PANEL.y + 37 }, { color: C_GOOD, shadow: true });
  drawChoiceRows(ctx, offers.map((id) => ({ label: PACTS[id].name, note: PACTS[id].boon })), cursor);
}
