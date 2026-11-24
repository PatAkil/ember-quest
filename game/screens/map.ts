import { BUTTON_KEY, PICO8, SAFE_MARGIN, drawText, drawTextCentered, hudText, textWidth } from '../../engine';
import { renderBiomeBackdrop } from '../backdrop';
import { selectNode } from '../flow';
import { at } from '../lookup';
import { biome, dirEdge, stageAt, takeA } from '../state';
import type { Game, MapNode, RoomType } from '../state';
import { ENEMIES, HOLLOW_ID } from '../data';
import { POTIONS_MAX } from '../types';
import { actInDepth, depthOf, derive, pactMods } from '../sim';
import { C_ACCENT, C_DIM, C_LOG_HURT, C_TEXT, C_WARN, H, W } from '../theme';
import { openGear } from './gear';
import { drawEdges, drawHeroMarker, drawNodes } from './map-view';
import { drawStatusPanel, STATUS_PANEL_H } from './status';
import { C_AFFIX } from './battle-tags';

const MAP_BACKDROP_DIM = 0.45;
const ROOM_BLURB: Record<RoomType, string> = {
  FIGHT: 'A FOE BARS THE WAY',
  ELITE: 'A DEADLY FOE  RICH SPOILS',
  REST: 'A CAMPFIRE  RESTORES HP AND MP',
  LOOT: 'A CHEST  TAKE ONE ITEM',
  EVENT: 'A STRANGE ENCOUNTER',
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
  if (takeA(g) && g.map.reachable.length) {
    g.app.audio.play('blip');
    selectNode(g, at(stageAt(g, g.map.curStage + 1), g.map.cursor));
  }
}

interface Ink { text: string; color: string }

const HOLLOW_LINE: Ink = { text: 'YOUR OWN SHADOW', color: C_LOG_HURT };
const READOUT_MAX_W = W - 2 * SAFE_MARGIN;
const READOUT_GAP = 8;

function affixParts(affixes: readonly string[] | undefined): Ink[] {
  const [first, ...rest] = affixes ?? [];
  if (first === undefined) {return [];}
  return [{ text: rest.length ? `${first} +${String(rest.length)}` : first, color: C_AFFIX }];
}

function foeParts(id: string | undefined, affixes: readonly string[] | undefined): Ink[] {
  const foe = id === undefined ? undefined : ENEMIES[id];
  if (!foe) {return [];}
  const name = { text: foe.name, color: C_TEXT };
  if (id === HOLLOW_ID) {return [name, HOLLOW_LINE];}
  const physical = foe.atkType === 'PHYSICAL';
  return [name, { text: physical ? 'STRIKES' : 'HEXES', color: physical ? C_WARN : C_LOG_HURT }, ...affixParts(affixes)];
}

const partsWidth = (parts: readonly Ink[]): number => parts.reduce((sum, p) => sum + textWidth(p.text, 1), 0) + READOUT_GAP * (parts.length - 1);

function fitParts(parts: Ink[]): Ink[] {
  const affix = parts[parts.length - 1];
  if (partsWidth(parts) <= READOUT_MAX_W || parts.length < 4 || !affix) {return parts;}
  return [...parts.slice(0, 2), affix];
}

function readoutParts(g: Game, node: MapNode): Ink[] {
  const head = { text: node.type, color: C_ACCENT };
  const id = node.type === 'BOSS' ? g.plan.boss : node.enemyId;
  const foe = node.type === 'FIGHT' || node.type === 'ELITE' || node.type === 'BOSS' ? foeParts(id, node.affixes) : [];
  if (foe.length) {return fitParts([head, ...foe]);}
  return node.type === 'REST' && restWasted(g) ? [head, REST_WASTED] : [head, { text: ROOM_BLURB[node.type], color: C_DIM }];
}

const REST_WASTED: Ink = { text: 'YOU ARE ALREADY AT FULL STRENGTH', color: C_WARN };

function restWasted(g: Game): boolean {
  const { hero } = g;
  const d = derive(hero);
  return pactMods(hero).restUpgrade <= 0 && hero.hp >= d.maxHp && hero.mp >= d.maxMp && hero.potions >= POTIONS_MAX;
}

const LOST_NOTICE = 'ANOTHER TAB TOOK THIS RUN - THIS ONE NO LONGER SAVES';
const NOTICE_Y = 97;

function drawLostNotice(g: Game): void {
  if (!g.saveLost) {return;}
  const ctx = g.app.pc.ctx;
  const w = textWidth(LOST_NOTICE, 1);
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(Math.round((W - w) / 2) - 2, NOTICE_Y - 1, w + 4, 7);
  drawTextCentered(ctx, LOST_NOTICE, { width: W, y: NOTICE_Y }, { color: C_WARN });
}

function mapHeader(g: Game): string {
  const act = `ACT ${String(actInDepth(g.n) + 1)}  ${biome(g).name}`;
  const depth = depthOf(g.n);
  return depth > 1 ? `DEPTH ${String(depth)}  ${act}` : act;
}

function drawReadout(g: Game, y: number): void {
  const ctx = g.app.pc.ctx;
  const node = g.map.reachable.length ? g.map.stages[g.map.curStage + 1]?.[g.map.cursor] : undefined;
  if (!node) {
    drawTextCentered(ctx, 'CHOOSE YOUR PATH', { width: W, y }, { color: C_DIM, shadow: true });
    return;
  }
  const parts = readoutParts(g, node);
  let x = Math.round((W - partsWidth(parts)) / 2);
  for (const part of parts) {
    drawText(ctx, part.text, { x, y }, { color: part.color, shadow: true });
    x += textWidth(part.text, 1) + READOUT_GAP;
  }
}

export function renderMap(g: Game): void {
  const { pc, particles } = g.app;
  const ctx = pc.ctx;
  renderBiomeBackdrop(g, MAP_BACKDROP_DIM);
  particles.render(ctx);
  drawTextCentered(ctx, mapHeader(g), { width: W, y: SAFE_MARGIN }, { color: C_ACCENT, shadow: true });
  drawReadout(g, SAFE_MARGIN + 8);
  drawEdges(g);
  drawNodes(g);
  drawHeroMarker(g);
  drawStatusPanel(g, H - SAFE_MARGIN - STATUS_PANEL_H);
  drawLostNotice(g);
  hudText(pc, `SCORE ${g.score}`, { h: 'right', v: 'top' }, { color: C_TEXT });
  hudText(pc, `${BUTTON_KEY.B.hint} GEAR`, { h: 'left', v: 'top' }, { color: C_DIM });
}
