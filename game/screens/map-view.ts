import { PICO8, drawSprite } from '../../engine';
import { HERO_PIP, ROOM_ART } from '../sprites';
import type { RoomArt } from '../sprites';
import { STAGE_SIZES } from '../mapgen';
import { stageAt } from '../state';
import type { Game, MapNode, RoomType } from '../state';
import { C_ACCENT, C_DIM, C_FAINT, C_TEXT } from '../theme';
import type { Point } from '../theme';
import { accentHz, drawDashed } from '../widgets';
import { drawIconIn, drawMedallion, drawRing, squareAt } from './plate';

const ART: Record<RoomType, RoomArt> = ROOM_ART;
const NODE_X0 = 31;
const BOSS_X = 223;
const NODE_DX = (BOSS_X - NODE_X0) / STAGE_SIZES.length;
const MAP_MID_Y = 63;
const NODE_SPREAD = 24;
const PLATE = 15;
const HALO = 19;
const PORT = 8;
const FAN = 3;
const START_PLATE = 13;
const C_ROUTE_PAST = PICO8[5];
const C_CASING = PICO8[0];
const CASING_OFFSETS: readonly Point[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];

const MAP_START: Point = { x: 15, y: MAP_MID_Y };
const nodeX = (stage: number): number => NODE_X0 + stage * NODE_DX;
const nodeY = (slot: number, count: number): number => MAP_MID_Y - ((count - 1) * NODE_SPREAD) / 2 + slot * NODE_SPREAD;
const nodeCentre = (g: Game, node: MapNode): Point => ({ x: nodeX(node.stage), y: nodeY(node.slot, stageAt(g, node.stage).length) });

type NodeState = 'CURSOR' | 'OPEN' | 'WALKED' | 'PASSED' | 'AHEAD';
type Variant = 'icon' | 'faint' | 'spent';
interface NodeLook { ring: string; variant: Variant }

const isOpen = (g: Game, node: MapNode): boolean => node.stage === g.map.curStage + 1 && g.map.reachable.includes(node.slot);

function nodeState(g: Game, node: MapNode): NodeState {
  if (node.cleared) {return 'WALKED';}
  if (isOpen(g, node)) {return node.slot === g.map.cursor ? 'CURSOR' : 'OPEN';}
  return node.stage <= g.map.curStage + 1 ? 'PASSED' : 'AHEAD';
}

const cursorBeat = (g: Game): boolean => accentHz(g.clock, 2, 0.5);

const LOOKS: Record<Exclude<NodeState, 'CURSOR'>, NodeLook> = {
  OPEN: { ring: C_TEXT, variant: 'icon' },
  WALKED: { ring: C_ACCENT, variant: 'faint' },
  PASSED: { ring: C_ROUTE_PAST, variant: 'spent' },
  AHEAD: { ring: C_FAINT, variant: 'icon' },
};

const CURSOR_LOOK: NodeLook = { ring: C_ACCENT, variant: 'icon' };
const nodeLook = (state: NodeState): NodeLook => (state === 'CURSOR' ? CURSOR_LOOK : LOOKS[state]);

const OPEN_HALO = PICO8[5];
const openBeat = (g: Game): boolean => accentHz(g.clock, 1, 0.5);

function drawNodeRings(g: Game, c: Point, state: NodeState, ring: string): void {
  const ctx = g.app.pc.ctx;
  if (state !== 'CURSOR' && state !== 'OPEN') {return;}
  drawRing(ctx, squareAt(c, PLATE - 2), ring);
  if (state === 'CURSOR') {drawRing(ctx, squareAt(c, HALO), cursorBeat(g) ? C_ACCENT : C_TEXT);}
  else {drawRing(ctx, squareAt(c, HALO), openBeat(g) ? C_DIM : OPEN_HALO);}
}

function drawNode(g: Game, node: MapNode): void {
  const ctx = g.app.pc.ctx;
  const c = nodeCentre(g, node);
  const state = nodeState(g, node);
  const look = nodeLook(state);
  const plate = squareAt(c, PLATE);
  drawMedallion(ctx, plate, look.ring);
  drawNodeRings(g, c, state, look.ring);
  drawIconIn(ctx, ART[node.type][look.variant], plate, 1);
}

export function drawNodes(g: Game): void {
  for (const stage of g.map.stages) {
    for (const node of stage) {drawNode(g, node);}
  }
}

interface Edge { from: MapNode; to: MapNode }
type Route = readonly Point[];

function routeOf(g: Game, e: Edge): Route {
  const a = nodeCentre(g, e.from); const b = nodeCentre(g, e.to);
  const fan = Math.sign(b.y - a.y) * FAN;
  return [{ x: a.x + PORT, y: a.y + fan }, { x: b.x - PORT, y: b.y - fan }];
}

interface Pen { offset: Point; color: string; every: number }

function strokeRoute(ctx: CanvasRenderingContext2D, route: Route, pen: Pen): void {
  for (let i = 1; i < route.length; i++) {
    const p = route[i - 1]; const q = route[i];
    if (!p || !q) {continue;}
    const from = { x: p.x + pen.offset.x, y: p.y + pen.offset.y };
    drawDashed(ctx, { from, to: { x: q.x + pen.offset.x, y: q.y + pen.offset.y }, every: pen.every }, pen.color);
  }
}

interface EdgeStyle { color: string; cased: boolean; every?: number }

function drawEdge(g: Game, e: Edge, style: EdgeStyle): void {
  const ctx = g.app.pc.ctx;
  const route = routeOf(g, e);
  if (style.cased) {
    for (const o of CASING_OFFSETS) {strokeRoute(ctx, route, { offset: o, color: C_CASING, every: 1 });}
  }
  strokeRoute(ctx, route, { offset: { x: 0, y: 0 }, color: style.color, every: style.every ?? 1 });
}

function edgesOf(g: Game, node: MapNode): Edge[] {
  const next = g.map.stages[node.stage + 1] ?? [];
  return node.links.flatMap((li) => {
    const to = next[li];
    return to ? [{ from: node, to }] : [];
  });
}

type EdgeRole = 'WALKED' | 'CHOICE' | 'TAKEN' | 'PREVIEW' | 'PAST' | 'AHEAD';

function edgeRole(g: Game, e: Edge): EdgeRole {
  const { curStage, cursor } = g.map;
  if (e.from.cleared && e.to.cleared) {return 'WALKED';}
  if (e.from.cleared && e.from.stage === curStage && isOpen(g, e.to)) {return e.to.slot === cursor ? 'TAKEN' : 'CHOICE';}
  if (isOpen(g, e.from) && e.from.slot === cursor) {return 'PREVIEW';}
  return e.from.stage <= curStage ? 'PAST' : 'AHEAD';
}

const ROLE_ORDER: readonly EdgeRole[] = ['PAST', 'AHEAD', 'PREVIEW', 'WALKED', 'CHOICE', 'TAKEN'];

const ROLE_STYLE: Record<EdgeRole, EdgeStyle> = {
  PAST: { color: C_ROUTE_PAST, cased: false, every: 2 },
  AHEAD: { color: C_FAINT, cased: false, every: 2 },
  PREVIEW: { color: C_DIM, cased: true },
  WALKED: { color: C_ACCENT, cased: true },
  CHOICE: { color: C_TEXT, cased: true },
  TAKEN: { color: C_ACCENT, cased: true },
};

export function drawEdges(g: Game): void {
  const edges = g.map.stages.flat().flatMap((n) => edgesOf(g, n)).map((e) => ({ e, role: edgeRole(g, e) }));
  for (const role of ROLE_ORDER) {
    const style = ROLE_STYLE[role];
    for (const item of edges) {
      if (item.role === role) {drawEdge(g, item.e, style);}
    }
  }
}

const heroBob = (g: Game): number => (accentHz(g.clock, 1.5, 0.5) ? 1 : 0);

export function drawHeroMarker(g: Game): void {
  const here = g.map.stages.flat().find((n) => n.cleared && n.stage === g.map.curStage);
  const ctx = g.app.pc.ctx;
  if (!here) {
    const plate = squareAt(MAP_START, START_PLATE);
    drawMedallion(ctx, plate, C_ACCENT);
    drawIconIn(ctx, HERO_PIP, { ...plate, y: plate.y - heroBob(g) }, 1);
    return;
  }
  const c = nodeCentre(g, here);
  const top = c.y - (PLATE - 1) / 2;
  drawSprite(ctx, HERO_PIP, { x: c.x - (HERO_PIP.w - 1) / 2, y: top - HERO_PIP.h + 2 - heroBob(g) }, 1);
}
