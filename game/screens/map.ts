// Ember Quest v3 — screens/map.ts: the act map. DESIGN.md → The map, and the
// region table's `map` row: MAP_NODE = 96 at MAP_X = 88 + 208 × stage,
// MAP_Y = 168 + 144 × row, with the act and score band at y 24-120.
//
// The screen CONSUMES the generator and re-derives nothing: `buildMap` owns
// the stages, the links and the landmark (sim/run.ts), and the seam owns which
// successors are offered (`offeredIdxs`, run.ts's route pending). Drawing the
// choosable set from the links here instead would be a second implementation
// of the routing rule, and the two would drift.
//
// Six columns: STAGE_SIZES [2, 3, 1, 3, 2] and then the BOSS — x 88 / 296 /
// 504 / 712 / 920 / 1128. A stage's nodes are centred over the three rows, so
// a two-node stage takes rows 0 and 2 and the one-node landmark takes row 1;
// the landmark wears the contract's ACCENT ring.
//
// Routing is mandatory — there is no default and no walk-past — so B is the
// PARTY button's twin here (phase-5 decision 5: the map keeps a PARTY button
// in the band plus B), never a way out of the choice.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { PICO8 } from '../../engine';
import {
  CANVAS_W, HUD_LARGE, HUD_SMALL, MAP_BAND_BOTTOM, MAP_BAND_TOP, MAP_NODE, NAME_MAX_CHARACTER,
  mapX, mapY, safeInsetFor,
} from './layout';
import {
  ACCENT, ACCENT_COOL, ACCENT_HP, C_CREAM, C_DEBUFF, C_GOLD, C_MUTED, C_VIOLET, PLATE_RADIUS,
  drawHpRule, drawIcon, drawSecondaryButton, focusGlow, focusLift, gradientPlate,
  hudText, hudTextCentered, plate, footHint,
} from './hud';

/**
 * How much flat ink a node that is NOT on offer carries under its wash. A room
 * two stages ahead is what a route is planned against, so its label has to be
 * legible over whatever the biome is doing behind it — the marsh's moon and the
 * crypt's brazier both sit right under the node grid.
 */
const NODE_BASE_WALKED = 0.6;
const NODE_BASE_AHEAD = 0.52;
import type { IconName } from './hud';
import type { RoomType } from '../types';
import { LANDMARK_STAGE, STAGE_SIZES } from '../types';
import type { RunMap } from '../sim/run';
import { derive } from '../sim/relics';
import { ScreenView, addPauseIcon, deriveCtxFor, drawPauseIcon } from './party';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];

// ------------------------------------------------------------- geometry ---
/** The BOSS is the implicit sixth column: STAGE_SIZES.length. */
// promote to layout.ts
export const BOSS_STAGE = STAGE_SIZES.length;
/** Three rows are available; a stage of n nodes is centred over them. */
// promote to layout.ts
export function mapRow(size: number, i: number): number {
  if (size >= 3) return i;
  if (size === 2) return i * 2;
  return 1;
}
/** The act entry's own stub, left of the first column. */
// promote to layout.ts
export const MAP_ENTRY_X = 40;
/** The PARTY button in the band — the map's only non-routing target besides PAUSE. */
// promote to layout.ts
export const MAP_PARTY = { x: 936, y: MAP_BAND_TOP, w: 216, h: 96 } as const;
/** Where the party's HP pips start, and their pitch. */
// promote to layout.ts
export const MAP_PIP_X = 336;
// promote to layout.ts
export const MAP_PIP_W = 190;

/** Shape carries the room: no letters on a node. */
// promote to hud.ts — the room's mark, beside SLOT_ICON_NAME and STATUS_ICON_NAME.
export const ROOM_ICON_NAME: Record<RoomType, IconName> = {
  FIGHT: 'sword', ELITE: 'shieldCrack', REST: 'chalice', LOOT: 'pendant',
  SHRINE: 'halo', FORGE: 'flame', SUMMON: 'wing', ALTAR: 'sun', BOSS: 'brand',
};
/** Colour carries the family: a fight is cream, a gift is gold, a danger is red. */
// promote to hud.ts
export const ROOM_COLOR: Record<RoomType, string> = {
  FIGHT: C_CREAM, ELITE: C_DEBUFF, REST: ACCENT_HP, LOOT: C_GOLD,
  SHRINE: C_VIOLET, FORGE: ACCENT, SUMMON: ACCENT_COOL, ALTAR: C_GOLD, BOSS: C_DEBUFF,
};

export interface MapProps {
  view: ScreenView;
  /** buildMap's own output — stages, entry, links. */
  map: RunMap;
  /**
   * The stage the OFFERED nodes live in — sim/run.ts's ROUTE pending `stage`
   * verbatim (STAGE_SIZES.length is the act's BOSS). The party is standing one
   * stage back, at `stage - 1`; −1 there means the act's entry, and `entry` is
   * what is offered.
   */
  stage: number;
  /** Where the party is standing inside `stage - 1` (RunSnapshot.nodeIdx); −1 at the entry. */
  nodeIdx: number;
  /** run.ts's route pending, verbatim: indices into `stage`, NOT node ids. */
  offeredIdxs: readonly number[];
  offeredTypes: readonly RoomType[];
  /** The node taken at each stage so far, stage order — the path drawn behind the party. */
  taken?: readonly number[];
}

export interface MapDevView {
  stages: RoomType[][];
  links: readonly (readonly number[])[][];
  entry: readonly number[];
  stage: number;
  nodeIdx: number;
  offered: { idx: number; type: RoomType }[];
}

export interface MapScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  scene(): void;
  onPause(): void;
  /** The chosen successor, as an index into `offeredIdxs` — exactly what route() answers. */
  onRoute(choice: number): void;
  /** The band's PARTY button, and B. */
  onParty(): void;
}

export interface MapScreen {
  update(dt: number, props: MapProps): void;
  render(time: number, props: MapProps): void;
  view(props: MapProps): MapDevView;
}

const nodeId = (stage: number, i: number): string => `map-node-${stage}-${i}`;

/** The room type at (stage, i) — the BOSS column is implicit, past `stages`. */
function typeAt(map: RunMap, stage: number, i: number): RoomType {
  if (stage >= BOSS_STAGE) return 'BOSS';
  return map.stages[stage]?.[i] ?? 'FIGHT';
}
function sizeOf(map: RunMap, stage: number): number {
  if (stage >= BOSS_STAGE) return 1;
  return map.stages[stage]?.length ?? 0;
}
function nodeRect(map: RunMap, stage: number, i: number): { x: number; y: number; w: number; h: number } {
  return { x: mapX(stage), y: mapY(mapRow(sizeOf(map, stage), i)), w: MAP_NODE, h: MAP_NODE };
}

export function createMapScreen(deps: MapScreenDeps): MapScreen {
  const { pc, input, regions, audio, scene, onPause, onRoute, onParty } = deps;

  function update(_dt: number, props: MapProps): void {
    const { map, offeredIdxs } = props;
    const target = props.stage;
    regions.begin();
    addPauseIcon(regions);
    regions.add('map-party', MAP_PARTY.x, MAP_PARTY.y, MAP_PARTY.w, MAP_PARTY.h, { index: 10, group: 'map' });
    // Every node registers: the offered ones enabled and indexed in the order
    // route() will read them, the rest disabled — focusable, so the player can
    // read what they are turning down, never activatable.
    let dead = 20;
    for (let s = 0; s <= BOSS_STAGE; s++) {
      for (let i = 0; i < sizeOf(map, s); i++) {
        const r = nodeRect(map, s, i);
        const choice = s === target ? offeredIdxs.indexOf(i) : -1;
        regions.add(nodeId(s, i), r.x, r.y, r.w, r.h, {
          index: choice >= 0 ? choice : dead++, group: 'map', disabled: choice < 0,
        });
      }
    }
    regions.end();

    const act = regions.activated();
    if (input.pressed('B')) { audio.play('ui'); onParty(); }
    else if (act === 'map-party') { audio.play('ui'); onParty(); }
    else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
    else if (act && act.startsWith('map-node-')) {
      const parts = act.split('-');
      const s = Number(parts[2]);
      const i = Number(parts[3]);
      const choice = s === target ? offeredIdxs.indexOf(i) : -1;
      if (choice >= 0) { audio.play('confirm'); onRoute(choice); }
    }
    input.endFrame();
  }

  /** One hairline from a node's right edge into a successor's left edge, bowed through the gutter. */
  function link(from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number; w: number; h: number }, color: string, alpha: number): void {
    const ctx = pc.ctx;
    const x0 = from.x + from.w;
    const y0 = from.y + from.h / 2;
    const x1 = to.x;
    const y1 = to.y + to.h / 2;
    const mid = (x0 + x1) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(mid, y0, mid, y1, x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  function drawNode(props: MapProps, s: number, i: number): void {
    const ctx = pc.ctx;
    const { map, nodeIdx, offeredIdxs, taken } = props;
    const at = props.stage - 1; // the stage the party is standing in
    const r = nodeRect(map, s, i);
    const type = typeAt(map, s, i);
    const color = ROOM_COLOR[type];
    const offered = s === props.stage && offeredIdxs.indexOf(i) >= 0;
    const here = s === at && i === nodeIdx;
    const walked = taken ? taken[s] === i && s <= at : false;
    const landmark = s === LANDMARK_STAGE;
    const focused = regions.focused() === nodeId(s, i);

    // Focus is LIGHT here too. A node's own colour is often the very cream the
    // old ring was made of (every FIGHT), so the ring had to be a second
    // separated line 5 px outside the plate — a box round a box. The glow is
    // drawn UNDER the plate in the node's own colour and the body is lifted, so
    // the focused node is the brightest thing in its column instead of the
    // outlined one.
    // NO KEYLINE ANYWHERE ON THIS SCREEN (round-4 item 2). Every node used to
    // wear one: the offered ones a border in the room's colour, the one you are
    // standing on a cream one, the landmark a second ACCENT rectangle inset 3 px
    // inside its plate. Three lines saying three different things, in the shape
    // round 3 retired for focus — and on a map the FOCUSED node wore the same
    // shape as the rest. All of it is light and value now: an offered node is
    // the densest plate with its colour in the icon and lit text, the one you
    // stand on adds the HERE caption, the landmark takes the accent LIFT along
    // its head, and focus is the glow plus the lift as everywhere else.
    //
    // Every node also takes a flat BASE (round-4 item 6): the labels on the
    // rooms you are not being offered measured under 2:1 against the lit ground,
    // because a 0.26-alpha wash is not a background — it is the ground. With a
    // base under them the label reads against INK at its own alpha instead.
    if (focused) focusGlow(ctx, r.x, r.y, r.w, r.h, PLATE_RADIUS, offered || here ? color : C_MUTED);
    if (offered || here) {
      plate(ctx, r.x, r.y, r.w, r.h, { alpha: focused ? 0.86 : 0.78 });
    } else {
      gradientPlate(ctx, r.x, r.y, r.w, r.h, {
        base: walked ? NODE_BASE_WALKED : NODE_BASE_AHEAD,
        topAlpha: focused ? 0.4 : 0.24,
        floorAlpha: focused ? 0.3 : 0.14,
      });
    }
    if (landmark) focusLift(ctx, r.x, r.y, r.w, r.h, PLATE_RADIUS, ACCENT, offered || here ? 0.9 : 0.55);
    if (focused) focusLift(ctx, r.x, r.y, r.w, r.h, PLATE_RADIUS, offered || here ? color : C_MUTED);
    ctx.save();
    // The icon dims on a room you are not being offered; the LABEL does not.
    // Contrast is measured on the word, and a 0.62 multiplier on C_MUTED over a
    // lit marsh is what put SUMMON, ELITE and the grey FIGHTs under 2:1.
    drawIcon(ctx, ROOM_ICON_NAME[type], r.x + (MAP_NODE - 36) / 2, r.y + 14, 36,
      offered || here ? color : C_MUTED, offered || here || walked ? 1 : 0.72);
    hudTextCentered(ctx, type, r.x, r.y + 58, r.w, HUD_SMALL, {
      px: HUD_SMALL, color: offered || here ? C_TEXT : C_CREAM,
    });
    ctx.restore();
    if (here) hudTextCentered(ctx, 'HERE', r.x, r.y + MAP_NODE + 4, r.w, HUD_SMALL, { px: HUD_SMALL, color: C_CREAM });
  }

  function drawBand(props: MapProps): void {
    const ctx = pc.ctx;
    const v = props.view;
    const inset = safeInsetFor(pc);
    const dctx = deriveCtxFor(v);
    hudText(ctx, `ACT ${v.act ?? 1} / 6`, inset.left, MAP_BAND_TOP + 6, { px: HUD_LARGE, color: ACCENT });
    const bits = [`LAP ${v.lap ?? 1}`, `A${v.ascension ?? 0}`, `SCORE ${Math.round(v.score ?? 0)}`];
    hudText(ctx, bits.join('  .  '), inset.left, MAP_BAND_TOP + 40, { px: HUD_SMALL, color: C_MUTED });

    // The party as three pips: who is standing, and how much of them is left.
    v.party.members.forEach((m, i) => {
      const x = MAP_PIP_X + i * MAP_PIP_W;
      const maxHp = derive(m, dctx).HP;
      const dead = m.hp <= 0;
      const leader = v.party.leader === i;
      hudText(ctx, m.def.name.slice(0, NAME_MAX_CHARACTER), x, MAP_BAND_TOP + 8, {
        px: HUD_SMALL, color: dead ? C_MUTED : C_TEXT,
      });
      if (leader) drawIcon(ctx, 'star', x + MAP_PIP_W - 46, MAP_BAND_TOP + 6, 16, C_GOLD);
      drawHpRule(ctx, x, MAP_BAND_TOP + 30, MAP_PIP_W - 30, maxHp > 0 ? m.hp / maxHp : 0, m.def.element, !dead);
      hudText(ctx, dead ? 'DOWN' : `${Math.round((m.hp / Math.max(1, maxHp)) * 100)}%`, x, MAP_BAND_TOP + 40, {
        px: HUD_SMALL, color: dead ? C_MUTED : C_DIM,
      });
    });
  }

  function render(_time: number, props: MapProps): void {
    const ctx = pc.ctx;
    const { map, nodeIdx, offeredIdxs, taken } = props;
    const at = props.stage - 1;
    const inset = safeInsetFor(pc);
    scene();

    // The band, then the links UNDER the nodes, then the nodes.
    plate(ctx, inset.left, MAP_BAND_TOP, CANVAS_W - inset.left - inset.right, MAP_BAND_BOTTOM - MAP_BAND_TOP, { alpha: 0.42 });
    drawBand(props);

    const entryStub = { x: MAP_ENTRY_X - 24, y: mapY(1), w: 24, h: MAP_NODE };
    for (const i of map.entry) {
      const lit = props.stage === 0 && offeredIdxs.indexOf(i) >= 0;
      link(entryStub, nodeRect(map, 0, i), lit ? ACCENT : C_MUTED, lit ? 0.8 : 0.28);
    }
    for (let s = 0; s <= BOSS_STAGE - 1; s++) {
      for (let i = 0; i < sizeOf(map, s); i++) {
        const targets = s < map.links.length ? map.links[s][i] ?? [] : [];
        for (const j of targets) {
          const fromHere = s === at && i === nodeIdx;
          const lit = fromHere && offeredIdxs.indexOf(j) >= 0;
          const walked = !!taken && taken[s] === i && taken[s + 1] === j;
          link(nodeRect(map, s, i), nodeRect(map, s + 1, j), lit || walked ? ACCENT : C_MUTED, lit ? 0.85 : walked ? 0.5 : 0.22);
        }
      }
    }
    for (let s = 0; s <= BOSS_STAGE; s++) for (let i = 0; i < sizeOf(map, s); i++) drawNode(props, s, i);

    // The band's two buttons, and the one line of guidance under the map.
    drawSecondaryButton(ctx, MAP_PARTY.x, MAP_PARTY.y, MAP_PARTY.w, MAP_PARTY.h, 'PARTY', regions.focused() === 'map-party');
    drawPauseIcon(ctx, regions);
    const choices = props.offeredTypes.length;
    footHint(pc, `${choices} way${choices === 1 ? '' : 's'} on  .  A takes the lit room  .  B opens the party`);
  }

  return {
    update,
    render,
    view(props: MapProps): MapDevView {
      return {
        stages: props.map.stages,
        links: props.map.links,
        entry: props.map.entry,
        stage: props.stage,
        nodeIdx: props.nodeIdx,
        offered: props.offeredIdxs.map((idx, k) => ({ idx, type: props.offeredTypes[k] ?? typeAt(props.map, props.stage, idx) })),
      };
    },
  };
}
