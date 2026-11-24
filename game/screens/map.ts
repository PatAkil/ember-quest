import { SAFE_MARGIN, drawText, drawTextCentered, hudText, textWidth } from '../../engine';
import { renderBiomeBackdrop } from '../backdrop';
import { selectNode } from '../flow';
import { at } from '../lookup';
import { biome, dirEdge, stageAt } from '../state';
import type { Game, RoomType } from '../state';
import { C_ACCENT, C_DIM, C_TEXT, H, W } from '../theme';
import { openGear } from './gear';
import { drawEdges, drawHeroMarker, drawNodes } from './map-view';
import { drawStatusPanel, STATUS_PANEL_H } from './status';

const MAP_BACKDROP_DIM = 0.45;
const ROOM_BLURB: Record<RoomType, string> = {
  FIGHT: 'A FOE BARS THE WAY',
  ELITE: 'A DEADLY FOE  RICH SPOILS',
  REST: 'A CAMPFIRE  RESTORES HP AND MP',
  LOOT: 'A CHEST  TAKE ONE ITEM',
  BOSS: 'THE MASTER OF THIS ACT',
};

function moveCursor(g: Game, dy: number): void {
  const { reachable, cursor } = g.map;
  const i = reachable.indexOf(cursor);
  const next = reachable[(i + dy + reachable.length) % reachable.length];
  if (next !== undefined && next !== cursor) { g.map.cursor = next; g.app.audio.play('blip'); }
}

export function updateMap(g: Game): void {
  const dy = dirEdge(g);
  if (dy) {moveCursor(g, dy);}
  if (g.app.input.pressed('B')) { g.app.audio.play('blip'); openGear(g); return; }
  if (g.app.input.pressed('A') && g.map.reachable.length) {
    g.app.audio.play('blip');
    selectNode(g, at(stageAt(g, g.map.curStage + 1), g.map.cursor));
  }
}

function drawReadout(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  const node = g.map.reachable.length ? g.map.stages[g.map.curStage + 1]?.[g.map.cursor] : undefined;
  if (!node) {
    drawTextCentered(ctx, 'CHOOSE YOUR PATH', { width: W, y }, { color: C_DIM, shadow: true });
    return;
  }
  const head = node.type;
  const blurb = ROOM_BLURB[node.type];
  const gap = 8;
  const x = Math.round((W - textWidth(head, 1) - gap - textWidth(blurb, 1)) / 2);
  drawText(ctx, head, { x, y }, { color: C_ACCENT, shadow: true });
  drawText(ctx, blurb, { x: x + textWidth(head, 1) + gap, y }, { color: C_DIM, shadow: true });
}

export function renderMap(g: Game): void {
  const { pc, particles } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g, MAP_BACKDROP_DIM);
  particles.render(ctx);
  drawTextCentered(ctx, `ACT ${g.actIndex + 1}  ${biome(g).name}`, { width: W, y: SAFE_MARGIN }, { color: C_ACCENT, shadow: true });
  drawReadout(g, SAFE_MARGIN + 8);
  drawEdges(g);
  drawNodes(g);
  drawHeroMarker(g);
  drawStatusPanel(g, H - SAFE_MARGIN - STATUS_PANEL_H);
  hudText(pc, `SCORE ${g.score}`, { h: 'right', v: 'top' }, { color: C_TEXT });
}
