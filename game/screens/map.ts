import { PICO8, SAFE_MARGIN, drawBevel, drawFrame, drawSprite, drawText, drawTextCentered, hudText, textWidth } from '../../engine';
import type { Sprite } from '../../engine';
import { fightIcon, eliteIcon, restIcon, lootIcon, bossIcon } from '../sprites';
import { renderBiomeBackdrop } from '../backdrop';
import { selectNode } from '../flow';
import { at } from '../lookup';
import { STAGE_SIZES } from '../mapgen';
import { biome, dirEdge, stageAt } from '../state';
import type { Game, MapNode, RoomType } from '../state';
import { C_ACCENT, C_DIM, C_FAINT, C_PANEL, C_TEXT, H, W } from '../theme';
import type { Point } from '../theme';
import { accentHz, drawLine } from '../widgets';
import { drawStatusPanel } from './status';

const ROOM_ICON: Record<RoomType, Sprite> = { FIGHT: fightIcon, ELITE: eliteIcon, REST: restIcon, LOOT: lootIcon, BOSS: bossIcon };
const MAP_BACKDROP_DIM = 0.45;
const STAGE_COUNT = STAGE_SIZES.length + 1;
const nodeX = (stage: number): number => SAFE_MARGIN + 14 + stage * ((W - 2 * SAFE_MARGIN - 28) / (STAGE_COUNT - 1));
function nodeY(slot: number, count: number): number {
  const spread = 28; const top = 64 - ((count - 1) * spread) / 2;
  return top + slot * spread;
}

function moveCursor(g: Game, dy: number): void {
  const { reachable, cursor } = g.map;
  const i = reachable.indexOf(cursor);
  const next = reachable[(i + dy + reachable.length) % reachable.length];
  if (next !== undefined && next !== cursor) { g.map.cursor = next; g.app.audio.play('blip'); }
}

export function updateMap(g: Game): void {
  const dy = dirEdge(g);
  if (dy) {moveCursor(g, dy);}
  if (g.app.input.pressed('A') && g.map.reachable.length) {
    g.app.audio.play('blip');
    selectNode(g, at(stageAt(g, g.map.curStage + 1), g.map.cursor));
  }
}

interface EdgeStyle { color: string; thick: boolean }

function drawEdge(g: Game, node: MapNode, li: number, style: EdgeStyle): void {
  const ctx = g.app.pc.ctx;
  const s = node.stage;
  const from: Point = { x: nodeX(s) + 11, y: nodeY(node.slot, stageAt(g, s).length) };
  const to: Point = { x: nodeX(s + 1) - 11, y: nodeY(li, stageAt(g, s + 1).length) };
  const segments = (dy: number): void => {
    drawLine(ctx, { x: from.x, y: from.y + dy }, { x: from.x + 3, y: from.y + dy }, style.color);
    drawLine(ctx, { x: from.x + 3, y: from.y + dy }, { x: to.x - 3, y: to.y + dy }, style.color);
    drawLine(ctx, { x: to.x - 3, y: to.y + dy }, { x: to.x, y: to.y + dy }, style.color);
  };
  segments(0);
  if (style.thick) {segments(1);}
}

function drawEdges(g: Game): void {
  const { stages, curStage, pendingNode, cursor } = g.map;
  for (const node of stages.slice(0, -1).flat()) {
    if (node.stage === curStage && node === pendingNode) {continue;}
    for (const li of node.links) {drawEdge(g, node, li, { color: C_FAINT, thick: false });}
  }
  if (curStage < 0 || !pendingNode) {return;}
  for (const li of pendingNode.links) {drawEdge(g, pendingNode, li, { color: li === cursor ? C_ACCENT : C_TEXT, thick: li === cursor });}
}

interface NodeLook { box: string; label: string; isCursor: boolean }

function nodeLook(g: Game, node: MapNode): NodeLook {
  const { curStage, reachable, cursor } = g.map;
  const s = node.stage;
  const isReachable = s === curStage + 1 && reachable.includes(node.slot);
  const isCursor = isReachable && node.slot === cursor;
  if (isCursor) {
    const box = accentHz(g.clock, 3, 0.5) ? PICO8[7] : C_ACCENT;
    return { box, label: box, isCursor };
  }
  if (isReachable) {return { box: C_TEXT, label: C_TEXT, isCursor };}
  const future = !node.cleared && s > curStage + 1;
  return { box: C_FAINT, label: future ? C_DIM : C_FAINT, isCursor };
}

function drawNode(g: Game, node: MapNode, count: number): void {
  const ctx = g.app.pc.ctx;
  const x = nodeX(node.stage); const y = nodeY(node.slot, count);
  const { box, label: labelColor, isCursor } = nodeLook(g, node);
  drawBevel(ctx, { x: x - 11, y: y - 11, w: 22, h: 20 }, { fill: node.cleared ? PICO8[0] : C_PANEL, light: isCursor ? C_ACCENT : PICO8[1], dark: PICO8[0] });
  drawFrame(ctx, { x: x - 11, y: y - 11, w: 22, h: 20 }, { color: box, thickness: 1 });
  drawSprite(ctx, ROOM_ICON[node.type], { x: x - 3, y: y - 9 }, 1);
  const label = node.type;
  drawText(ctx, label, { x: x - textWidth(label, 1) / 2, y: y + 1 }, { color: labelColor, shadow: true });
  if (node.cleared) {drawText(ctx, 'X', { x: x - 2, y: y - 8 }, { color: C_DIM });}
}

export function renderMap(g: Game): void {
  const { pc, particles } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g, MAP_BACKDROP_DIM);
  particles.render(ctx);
  const header = `ACT ${g.actIndex + 1}  ${biome(g).name}`;
  drawTextCentered(ctx, header, { width: W, y: SAFE_MARGIN }, { color: C_ACCENT, shadow: true });
  drawTextCentered(ctx, 'CHOOSE YOUR PATH', { width: W, y: SAFE_MARGIN + 8 }, { color: C_DIM, shadow: true });
  drawEdges(g);
  for (const stage of g.map.stages) {
    for (const node of stage) {drawNode(g, node, stage.length);}
  }
  drawStatusPanel(g, H - SAFE_MARGIN - 46);
  hudText(pc, `SCORE ${g.score}`, { h: 'right', v: 'top' }, { color: C_TEXT });
}
