// tools/screens.ts — the phase-5 run screens on their own, over the real
// diorama, driven by hand-written fixtures. Dev-server only (Vite serves it at
// /tools/screens.html; `vite build` never bundles it and nothing in game/ or
// engine/ imports it).
//
// Every screen in game/screens/{draft,map,party,node,vault}.ts is a factory
// that takes a plain props object — a fake ScreenView and a fake pending — so it
// can be stood up without the seam, without main.ts and without a run. That is
// what this page does: one screen, one fixture, one frame, plus a region dump a
// blind verifier can read.
//
//   screen=draft|summon|map|party|shrine|forge|altar|rest
//         |vault-equip|vault-doors|vault-bank        (default draft)
//   fixture=<name>        per-screen; `list` in the metrics line names them all
//   phone=1               lays the frame out as a PHONE (CSS width 640, so
//                         layout.ts's isPhone() is true and SAFE_BOTTOM_PHONE
//                         applies) and then restores the CSS width before the
//                         capture, so the shot is still a full 1280x720 frame
//   focus=<region id>     put the keyboard focus there before the frame
//   steps=<id>,<id>       ACTIVATE these regions first, one per tick, by
//                         focusing each and dispatching a real Space keydown —
//                         the same route a player takes, so the multi-step
//                         faces (FORGE's mode/recast/rebrand, the SUMMON's
//                         swap-out, BANK's drop) are reachable from a URL
//   biome=EMBER_CRYPT     which diorama stands behind
//   t=2.4                 the frame time every render is given
//
// window.__screens = { view(), pending(), regions(), focusedId(), regionAt(x, y), press(id) }
//   regions() dumps every region the screen registered this tick — id, group,
//   index, disabled, the DRAWN rect and the expanded HIT rect — and regionAt()
//   resolves a point exactly as engine/input.ts does (drawn rects in painter's
//   order, then hit rects), so "no strip resolves to a neighbour" can be
//   proved on a grid instead of guessed from pixels.
//
// capture: node tools/capture.mjs shot url=/tools/screens.html?screen=map&fixture=act3 name=sc-map-act3

import { createAudio, createHitRegions, createInput, createLight, createPixelCanvas, setSafeInset } from '../engine';
import type { HitRegions, Light, PixelCanvas } from '../engine';
import { CANVAS_H, CANVAS_W, SAFE_INSET } from '../game/screens/layout';
import { backdropFor } from '../game/art/backdrops';
import { CHARACTERS, ROSTER } from '../game/data/characters';
import { PACTS } from '../game/data/pacts';
import type { Element, PactId, Party, PartyMember, Relic, RoomType, SetId, SummonOffer } from '../game/types';
import { SLOTS } from '../game/types';
import { mulberry32 } from '../game/sim/rng';
import type { DeriveCtx } from '../game/sim/relics';
import {
  derive, equip, forgeLevels, forgeOptions, partyWorn, rebrandSets, rollRelic, rollSetPool, sharpenCandidates,
} from '../game/sim/relics';
import { buildMap } from '../game/sim/run';
import type { RunMap } from '../game/sim/run';
import type { ScreenView } from '../game/screens/party';
import { createPartyScreen } from '../game/screens/party';
import { createMapScreen } from '../game/screens/map';
import { createDraftScreen } from '../game/screens/draft';
import { createNodeScreen } from '../game/screens/node';
import { createVaultScreen } from '../game/screens/vault';

// ------------------------------------------------------------- the page ---
const params = new URLSearchParams(location.search);
const SCREEN = (params.get('screen') ?? 'draft').toLowerCase();
const FIXTURE = params.get('fixture') ?? '';
const PHONE = params.get('phone') === '1';
const TIME = Number(params.get('t') ?? 2.4);
const BIOME = params.get('biome') ?? 'EMBER_CRYPT';
const STEPS = (params.get('steps') ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0);

const mount = document.getElementById('mount') as HTMLDivElement;
const out = document.getElementById('metrics') as HTMLPreElement;
const pc: PixelCanvas = createPixelCanvas({ width: CANVAS_W, height: CANVAS_H, scale: 1, parent: mount, smoothing: true });
pc.canvas.id = 'sheet';
/** The phone layout is a CSS-width question (layout.ts's isPhone), so it is set here and undone before the shot. */
const PHONE_CSS = 640;
pc.canvas.style.width = `${PHONE ? PHONE_CSS : CANVAS_W}px`;
pc.canvas.style.height = `${Math.round((PHONE ? PHONE_CSS : CANVAS_W) * (CANVAS_H / CANVAS_W))}px`;
setSafeInset(SAFE_INSET);

const audio = createAudio();
const input = createInput(
  [{ button: 'A', label: 'select' }, { button: 'B', label: 'back' }, { button: 'PAUSE', label: 'pause' }],
  { pointer: { canvas: pc.canvas, width: CANVAS_W, height: CANVAS_H } },
);

// ------------------------------------------------- the region tap recorder -
interface Rect { x: number; y: number; w: number; h: number }
interface Rec { id: string; x: number; y: number; w: number; h: number; index: number; group: string; disabled: boolean; hit: Rect }
/** engine/input.ts's TAP_MIN and its `fit` — mirrored, so the dump reports the rects the registry really tests. */
const TAP_MIN = 96;
const fit = (pos: number, size: number, limit: number): number => (size >= limit ? 0 : Math.min(Math.max(pos, 0), limit - size));
function hitFor(x: number, y: number, w: number, h: number): Rect {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return {
    x: w < TAP_MIN ? fit(cx - TAP_MIN / 2, TAP_MIN, CANVAS_W) : x,
    y: h < TAP_MIN ? fit(cy - TAP_MIN / 2, TAP_MIN, CANVAS_H) : y,
    w: w < TAP_MIN ? Math.min(TAP_MIN, CANVAS_W) : w,
    h: h < TAP_MIN ? Math.min(TAP_MIN, CANVAS_H) : h,
  };
}
const recs: Rec[] = [];
const raw = createHitRegions(input, { width: CANVAS_W, height: CANVAS_H });
const regions: HitRegions = {
  begin() { recs.length = 0; raw.begin(); },
  add(id, x, y, w, h, opts) {
    recs.push({
      id, x, y, w, h, index: opts?.index ?? Number.MAX_SAFE_INTEGER, group: opts?.group ?? '',
      disabled: opts?.disabled ?? false, hit: hitFor(x, y, w, h),
    });
    raw.add(id, x, y, w, h, opts);
  },
  end() { raw.end(); },
  activated: () => raw.activated(),
  focused: () => raw.focused(),
  focus: (id) => raw.focus(id),
  hovered: () => raw.hovered(),
  pressing: () => raw.pressing(),
  region: (id) => raw.region(id),
  hitRect: (id) => raw.hitRect(id),
};
const inside = (r: Rect | Rec, x: number, y: number): boolean => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
/** The registry's own two-pass rule: drawn rects in painter's order, then the expanded hit rects. */
function regionAt(x: number, y: number): Rec | null {
  for (let i = recs.length - 1; i >= 0; i--) if (inside(recs[i], x, y)) return recs[i];
  for (let i = recs.length - 1; i >= 0; i--) if (inside(recs[i].hit, x, y)) return recs[i];
  return null;
}

// ------------------------------------------------------------ the scene ---
const light: Light = createLight({ width: CANVAS_W, height: CANVAS_H, tier: 'HIGH' });
light.setBiome(backdropFor(BIOME));
let clock = TIME;
function scene(): void {
  const ctx = pc.ctx;
  pc.clear('#000000');
  light.renderBackground(ctx, { time: clock, shakeX: 0, shakeY: 0 });
  light.renderLightPlane(ctx, { time: clock });
  light.renderPost(ctx, { time: clock });
}

// =========================================================== the fixtures ==
// Hand-written, but built out of the real generators: a relic comes from
// rollRelic and a map from buildMap, on a fixed seed, so a fixture is a run
// that could have happened rather than a shape invented for the screenshot.
const rng = mulberry32(20260905);
const POOL: SetId[] = rollSetPool([], rng);
let seq = 0;
const rollCtx = (act: number) => ({ act, lap: 1, ascension: 0, pool: POOL, pacts: [] as PactId[], nextId: () => `fx-${seq++}` });
function relicFor(act: number, source: 'FIGHT' | 'ELITE' | 'LOOT' | 'BOSS' = 'ELITE'): Relic {
  return rollRelic(source, rollCtx(act), rng);
}
function dctxFor(party: Party): DeriveCtx {
  return { leader: party.members[party.leader]?.def.leader ?? null, pacts: [] };
}
function member(id: string, awakened = false): PartyMember {
  return { def: CHARACTERS[id], hp: 1, relics: {}, awakened };
}
/** A party, its relics rolled and worn, its HP set as a fraction of the derived max. */
function makeParty(ids: string[], leader: number, relicsEach: number[], hpFrac: number[], awakened: number[] = []): Party {
  const party: Party = { members: ids.map((id, i) => member(id, awakened.indexOf(i) >= 0)), leader };
  const dctx = dctxFor(party);
  party.members.forEach((m, i) => {
    for (let k = 0; k < relicsEach[i]; k++) equip(m, { ...relicFor(2 + (k % 4)), slot: SLOTS[k % SLOTS.length] }, dctx);
    m.hp = Math.max(0, Math.round(derive(m, dctx).HP * hpFrac[i]));
  });
  return party;
}

const P_FRESH = makeParty(['EMBER', 'GALE', 'TIDE'], 0, [0, 0, 0], [1, 1, 1]);
const P_FULL = makeParty(['EMBER', 'BASALT', 'LUMEN'], 1, [6, 6, 6], [1, 0.62, 0.18], [2]);
const P_MIXED = makeParty(['EMBER', 'GALE', 'TIDE'], 0, [4, 2, 0], [1, 0.45, 0], [2]);
const P_SOLO: Party = { members: [P_FRESH.members[0]], leader: 0 };

function viewOf(party: Party, o: Partial<ScreenView> = {}): ScreenView {
  return {
    party, act: 1, lap: 1, ascension: 0, score: 0, pactsTaken: [], vault: [], vaultSlots: 0,
    stage: 0, nodeIdx: 0, clears: 0, rooms: [], ...o,
  };
}

/** A map fixture: the generated act, where the party stands, and what the seam offered. */
interface MapFixture { map: RunMap; stage: number; nodeIdx: number; offeredIdxs: number[]; offeredTypes: RoomType[]; taken: number[]; view: ScreenView }
function mapFixture(act: number, ascension: number, party: Party, at: number, node: number, view: ScreenView): MapFixture {
  const map = buildMap(act, ascension, party, mulberry32(1000 + act));
  const stage = at + 1;
  const offeredIdxs = at < 0 ? [...map.entry] : [...(map.links[at]?.[node] ?? [])];
  const offeredTypes = offeredIdxs.map((i) => (stage < map.stages.length ? map.stages[stage][i] : ('BOSS' as RoomType)));
  const taken: number[] = [];
  for (let s = 0; s <= at; s++) taken[s] = s === at ? node : 0;
  return { map, stage, nodeIdx: node, offeredIdxs, offeredTypes, taken, view };
}

const MAPS: Record<string, MapFixture> = {
  'act1-entry': mapFixture(1, 0, P_SOLO, -1, -1, viewOf(P_SOLO, { act: 1 })),
  act1: mapFixture(1, 0, P_FRESH, 0, 0, viewOf(P_FRESH, { act: 1, score: 120 })),
  act3: mapFixture(3, 4, P_FULL, 1, 1, viewOf(P_FULL, { act: 3, lap: 1, ascension: 4, score: 2480, pactsTaken: ['VEIL'] })),
  boss: mapFixture(3, 4, P_FULL, 4, 0, viewOf(P_FULL, { act: 3, lap: 2, ascension: 4, score: 5310, pactsTaken: ['VEIL', 'FURY'] })),
};

const SUMMON_OFFERS_3: SummonOffer[] = ['GALE', 'SABLE', 'LUMEN'].map((id, i) => ({
  def: CHARACTERS[id], favored: i === 1, dominant: 'FIRE' as Element,
}));

const VAULT_12: Relic[] = Array.from({ length: 12 }, (_, i) => relicFor(3 + (i % 4), i % 3 === 0 ? 'BOSS' : 'ELITE'));

/** Every fixture this page knows, per screen — the `list` line in the metrics block. */
const FIXTURES: Record<string, string[]> = {
  draft: ['six', 'three'],
  summon: ['three', 'three-late', 'full'],
  map: ['act1', 'act1-entry', 'act3', 'boss'],
  party: ['empty', 'full', 'leader', 'awakened'],
  shrine: ['veil', 'stacked'],
  forge: ['mid', 'mid-late', 'capped'],
  altar: ['two'],
  rest: ['sharpen'],
  'vault-equip': ['twelve', 'empty'],
  'vault-doors': ['lap1', 'lap3'],
  'vault-bank': ['win', 'death'],
};

// ============================================================ the screens ==
let pending: unknown = null;
let view: ScreenView = viewOf(P_FRESH);
const answers: unknown[] = [];
const onAnswer = (a: unknown): void => { answers.push(a); };
const deps = { pc, input, regions, audio, scene, onPause: () => answers.push({ kind: 'PAUSE' }) };

const partyScreen = createPartyScreen({ ...deps, onBack: () => answers.push({ kind: 'BACK' }), onLeader: (m) => onAnswer({ kind: 'LEADER', m }), onSwap: (m) => onAnswer({ kind: 'SWAP', m }) });
const mapScreen = createMapScreen({ ...deps, onRoute: (c) => onAnswer({ kind: 'ROUTE', c }), onParty: () => onAnswer({ kind: 'PARTY' }) });
const draftScreen = createDraftScreen({ ...deps, onAnswer });
const nodeScreen = createNodeScreen({ ...deps, onAnswer });
const vaultScreen = createVaultScreen({ ...deps, onAnswer });

type Tick = { update(dt: number): void; render(t: number): void; dev(): unknown };

function buildTick(fixture?: string, screen?: string): Tick {
  const fx = fixture ?? FIXTURE ?? '';
  switch (screen ?? SCREEN) {
    case 'party': {
      const party = fx === 'full' ? P_FULL : fx === 'empty' ? P_FRESH : P_MIXED;
      const props = {
        view: viewOf(party, { act: 3, lap: 1, score: 1980, pactsTaken: ['HASTE'] as PactId[] }),
        leaderEnabled: fx === 'leader',
        swapEnabled: fx === 'leader',
        title: fx === 'awakened' ? 'THE PARTY . AFTER THE ALTAR' : undefined,
      };
      view = props.view;
      pending = { kind: 'PARTY', fixture: fx };
      return { update: (dt) => partyScreen.update(dt, props), render: (t) => partyScreen.render(t, props), dev: () => partyScreen.view(props) };
    }
    case 'map': {
      const m = MAPS[fx] ?? MAPS.act1;
      const props = { view: m.view, map: m.map, stage: m.stage, nodeIdx: m.nodeIdx, offeredIdxs: m.offeredIdxs, offeredTypes: m.offeredTypes, taken: m.taken };
      view = m.view;
      pending = { kind: 'ROUTE', offeredIdxs: m.offeredIdxs, offeredTypes: m.offeredTypes, stage: m.stage };
      return { update: (dt) => mapScreen.update(dt, props), render: (t) => mapScreen.render(t, props), dev: () => mapScreen.view(props) };
    }
    case 'summon': {
      const full = fx === 'full';
      const late = fx === 'three-late';
      const party = full ? P_FULL : P_SOLO;
      // `three` and `three-late` are the SAME three offers at two different
      // nodes: the pair a screen must not confuse for one decision.
      const props = {
        kind: 'SUMMON' as const,
        view: viewOf(party, late
          ? { act: 5, lap: 1, score: 3300, stage: 3, nodeIdx: 1, clears: 4, rooms: new Array(19).fill('FIGHT') }
          : { act: full ? 5 : 1, score: full ? 4100 : 0, stage: full ? 3 : 0, nodeIdx: 0 }),
        offers: SUMMON_OFFERS_3, full, epic: full ? relicFor(5, 'BOSS') : null,
      };
      view = props.view;
      pending = { kind: 'SUMMON', offers: SUMMON_OFFERS_3.map((o) => o.def.id), full, opening: !full };
      return { update: (dt) => draftScreen.update(dt, props), render: (t) => draftScreen.render(t, props), dev: () => draftScreen.view(props) };
    }
    case 'shrine': {
      const stacked = fx === 'stacked';
      const props = {
        kind: 'SHRINE' as const,
        view: viewOf(P_FULL, { act: 2, score: 640, pactsTaken: (stacked ? ['HASTE', 'FURY'] : []) as PactId[] }),
        pact: stacked ? PACTS.DEARTH : PACTS.VEIL,
        untakenCount: stacked ? 3 : 5,
        // The fixture stands in act 2, so the shrine's own line has to name act
        // 2's biome — the hardcoded "the crypt" is exactly the defect the
        // fixture would otherwise keep reproducing.
        biome: 'FROST MARSH',
      };
      view = props.view;
      pending = { kind: 'SHRINE', pact: props.pact.id, untakenCount: props.untakenCount };
      return { update: (dt) => nodeScreen.update(dt, props), render: (t) => nodeScreen.render(t, props), dev: () => nodeScreen.view(props) };
    }
    case 'forge': {
      const party = fx === 'capped' ? P_MIXED : P_FULL;
      const late = fx === 'mid-late';
      const worn = partyWorn(party);
      // `mid` and `mid-late` are the same worn set at two different forges.
      const props = {
        kind: 'FORGE' as const,
        view: viewOf(party, late
          ? { act: 4, score: 3400, stage: 3, nodeIdx: 2, clears: 3, rooms: new Array(15).fill('FIGHT') }
          : { act: 4, score: 3010, stage: 1, nodeIdx: 0, clears: 1, rooms: new Array(13).fill('FIGHT') }),
        worn,
        options: forgeOptions(worn, []), pool: POOL, levels: forgeLevels([]),
        rebrand: worn.map((r) => rebrandSets(r, POOL)),
      };
      view = props.view;
      pending = { kind: 'FORGE', worn: worn.length, options: props.options.length, levels: props.levels };
      return { update: (dt) => nodeScreen.update(dt, props), render: (t) => nodeScreen.render(t, props), dev: () => nodeScreen.view(props) };
    }
    case 'altar': {
      const party = P_MIXED;
      const candidates = party.members.flatMap((m, i) => (m.awakened ? [] : [i]));
      const props = { kind: 'ALTAR' as const, view: viewOf(party, { act: 3, score: 1720 }), candidates };
      view = props.view;
      pending = { kind: 'ALTAR', candidates };
      return { update: (dt) => nodeScreen.update(dt, props), render: (t) => nodeScreen.render(t, props), dev: () => nodeScreen.view(props) };
    }
    case 'rest': {
      const party = P_FULL;
      const candidates = sharpenCandidates(party);
      const props = { kind: 'REST' as const, view: viewOf(party, { act: 4, score: 2860 }), candidates };
      view = props.view;
      pending = { kind: 'REST', candidates };
      return { update: (dt) => nodeScreen.update(dt, props), render: (t) => nodeScreen.render(t, props), dev: () => nodeScreen.view(props) };
    }
    case 'vault-equip': {
      const vault = fx === 'empty' ? [] : VAULT_12;
      const props = { kind: 'EQUIP' as const, vault, slots: 3, ascension: 0, unlockedAscension: 4, view: viewOf(P_SOLO) };
      view = viewOf(P_SOLO);
      pending = { kind: 'VAULT_EQUIP', vault: vault.length, slots: 3 };
      return { update: (dt) => vaultScreen.update(dt, props), render: (t) => vaultScreen.render(t, props), dev: () => vaultScreen.view(props) };
    }
    case 'vault-doors': {
      const lap = fx === 'lap3' ? 3 : 1;
      const props = {
        kind: 'DOORS' as const,
        view: viewOf(P_FULL, { act: 6, lap, score: lap * 4200, pactsTaken: ['VEIL'] as PactId[] }),
        banked: 2 + lap - 1,
      };
      view = props.view;
      pending = { kind: 'LAP', banked: props.banked };
      return { update: (dt) => vaultScreen.update(dt, props), render: (t) => vaultScreen.render(t, props), dev: () => vaultScreen.view(props) };
    }
    case 'vault-bank': {
      const death = fx === 'death';
      const worn = partyWorn(P_FULL);
      const props = {
        kind: 'BANK' as const, view: viewOf(P_FULL, { act: death ? 4 : 6, lap: 1, score: 3900 }),
        worn, n: death ? 1 : 2, vault: death ? VAULT_12.slice(0, 5) : VAULT_12.slice(0, 11), vaultSize: 12,
      };
      view = props.view;
      pending = { kind: 'BANK', n: props.n, vault: props.vault.length, worn: worn.length };
      return { update: (dt) => vaultScreen.update(dt, props), render: (t) => vaultScreen.render(t, props), dev: () => vaultScreen.view(props) };
    }
    default: {
      const roster = fx === 'three' ? ROSTER.slice(0, 3) : ROSTER;
      const props = { kind: 'DRAFT' as const, view: viewOf(P_SOLO), roster };
      view = props.view;
      pending = { kind: 'DRAFT', roster: [...roster] };
      return { update: (dt) => draftScreen.update(dt, props), render: (t) => draftScreen.render(t, props), dev: () => draftScreen.view(props) };
    }
  }
}

let tick = buildTick(FIXTURE || (FIXTURES[SCREEN]?.[0] ?? ''));

// --------------------------------------------------------------- driving --
function frame(dt: number): void {
  tick.update(dt);
  tick.render(clock);
}
/** A real Space edge on the window — the same route a player's keyboard takes. */
function press(id: string): void {
  raw.focus(id);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  frame(1 / 60);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  frame(1 / 60);
}

// One cold frame so the screen registers its regions, then the scripted steps,
// then the focus the URL asked for.
frame(1 / 60);
for (const id of STEPS) press(id);
const FOCUS = params.get('focus');
if (FOCUS) { raw.focus(FOCUS); frame(1 / 60); }
frame(1 / 60);

// The phone layout has been measured; the SHOT is full size either way.
if (PHONE) {
  pc.canvas.style.width = `${CANVAS_W}px`;
  pc.canvas.style.height = `${CANVAS_H}px`;
}

interface RegionDump { id: string; group: string; index: number | null; disabled: boolean; drawn: Rect; hit: Rect }
/** The live registration list, rebuilt on demand — a BFS moves focus, and every move re-registers. */
function dumpRegions(): RegionDump[] {
  return recs.map((r) => ({
    id: r.id, group: r.group, index: r.index === Number.MAX_SAFE_INTEGER ? null : r.index, disabled: r.disabled,
    drawn: { x: r.x, y: r.y, w: r.w, h: r.h }, hit: r.hit,
  }));
}
const dump = dumpRegions();
out.textContent = [
  `screen=${SCREEN} fixture=${FIXTURE || (FIXTURES[SCREEN]?.[0] ?? '-')} phone=${PHONE ? 1 : 0} steps=${STEPS.join('>') || '-'}`,
  `fixtures: ${(FIXTURES[SCREEN] ?? []).join(', ') || '-'}`,
  `regions (${dump.length}): ${dump.map((r) => `${r.id}${r.disabled ? '*' : ''}`).join(' ')}`,
  `focus: ${raw.focused() ?? '-'}   answers: ${JSON.stringify(answers)}`,
  `dev: ${JSON.stringify(tick.dev())}`.slice(0, 400),
].join('\n');

(window as unknown as { __screens: unknown }).__screens = {
  view: () => view,
  pending: () => pending,
  regions: () => dumpRegions(),
  focusedId: () => raw.focused(),
  /** Put the keyboard here (a screen's own opening focus is whatever the registry's first() picks). */
  focus: (id: string) => { raw.focus(id); frame(1 / 60); return raw.focused(); },
  /** One arrow press, resolved: the id focus lands on. 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'. */
  move: (code: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    frame(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    return raw.focused();
  },
  regionAt: (x: number, y: number) => {
    const r = regionAt(x, y);
    return r ? { id: r.id, group: r.group, index: r.index, disabled: r.disabled } : null;
  },
  press,
  answers: () => answers,
  dev: () => tick.dev(),
  /**
   * Hand the LIVE screen a different fixture — and, with `screen`, a different
   * FACE of the same screen file (draft -> summon is one DraftScreen instance,
   * exactly as main.ts creates it once per run). This is how "a second decision
   * must not inherit the first one's answer or its focus" is provable at all.
   */
  use: (fixture: string, screen?: string) => { tick = buildTick(fixture, screen); frame(1 / 60); return tick.dev(); },
};
(window as unknown as { __lineup: unknown }).__lineup = {
  ready: true, screen: SCREEN, fixture: FIXTURE, phone: PHONE, regions: dump.length,
};
