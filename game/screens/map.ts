import { BUTTON_KEY, SAFE_MARGIN, drawText, drawTextCentered, hudText, textWidth } from '../../engine';
import { renderBiomeBackdrop } from '../backdrop';
import { selectNode } from '../flow';
import { at } from '../lookup';
import { biome, dirEdge, stageAt } from '../state';
import type { Game, MapNode, RoomType } from '../state';
import { ENEMIES } from '../data';
import { C_ACCENT, C_DIM, C_LOG_HURT, C_TEXT, C_WARN, H, W } from '../theme';
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

interface Ink { text: string; color: string }

function foeParts(id: string | undefined): Ink[] {
  const foe = id === undefined ? undefined : ENEMIES[id];
  if (!foe) {return [];}
  const physical = foe.atkType === 'PHYSICAL';
  return [{ text: foe.name, color: C_TEXT }, { text: physical ? 'STRIKES' : 'HEXES', color: physical ? C_WARN : C_LOG_HURT }];
}

function readoutParts(g: Game, node: MapNode): Ink[] {
  const head = { text: node.type, color: C_ACCENT };
  const id = node.type === 'BOSS' ? biome(g).boss : node.enemyId;
  const foe = node.type === 'FIGHT' || node.type === 'ELITE' || node.type === 'BOSS' ? foeParts(id) : [];
  return foe.length ? [head, ...foe] : [head, { text: ROOM_BLURB[node.type], color: C_DIM }];
}

function drawReadout(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  const node = g.map.reachable.length ? g.map.stages[g.map.curStage + 1]?.[g.map.cursor] : undefined;
  if (!node) {
    drawTextCentered(ctx, 'CHOOSE YOUR PATH', { width: W, y }, { color: C_DIM, shadow: true });
    return;
  }
  const parts = readoutParts(g, node);
  const gap = 8;
  const total = parts.reduce((sum, p) => sum + textWidth(p.text, 1), 0) + gap * (parts.length - 1);
  let x = Math.round((W - total) / 2);
  for (const part of parts) {
    drawText(ctx, part.text, { x, y }, { color: part.color, shadow: true });
    x += textWidth(part.text, 1) + gap;
  }
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
  hudText(pc, `${BUTTON_KEY.B.hint} GEAR`, { h: 'left', v: 'top' }, { color: C_DIM });
}
