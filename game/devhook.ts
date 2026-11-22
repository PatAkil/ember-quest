import type { SceneMachine } from '../engine';
import type { Hero, Derived, EnemyInstance, EnemyKind, HeroAction, LootOffer, LootSource, Rng, StatKey } from './types';
import { createHero, grantClear, spendPoint, rollLoot, applyOffer, noteDeclinedScrolls, fullHeal } from './sim';

type SubScene = 'MAP' | 'BATTLE' | 'LEVELUP' | 'LOOT' | 'CARD';
type Action = 'A' | 'PAUSE' | 'UP' | 'DOWN';
type Fixture = 'title' | 'map' | 'battle' | 'levelup' | 'loot' | 'card' | 'paused' | 'gameover' | 'win';

interface DevNode { type: string; stage: number; slot: number; links: number[]; cleared: boolean }

interface DevView {
  scene: string; subScene: SubScene; act: number; hero: Hero; derived: Derived; enemy: EnemyInstance | null;
  clears: number; score: number; dying: boolean; cursors: Record<SubScene, number>;
  battlePhase: string; battleText: string; actions: HeroAction[]; offers: LootOffer[]; card: string[];
  map: DevNode[][]; curStage: number; reachable: number[];
}

export interface DevHost {
  scenes: SceneMachine;
  setRng(r: Rng): void;
  tick(dt: number): void;
  render(): void;
  resetEdge(): void;
  startRun(hero: Hero, act: number, clears: number): void;
  selectNode(node: DevNode): void;
  nextNodes(): DevNode[];
  bossNode(): DevNode;
  winBattle(): void;
  enemyTurn(): void;
  view(): DevView;
}

const FIXTURES: Fixture[] = ['title', 'map', 'battle', 'levelup', 'loot', 'card', 'paused', 'gameover', 'win'];
const KEY: Record<Action, string> = { A: 'Space', PAUSE: 'KeyP', UP: 'ArrowUp', DOWN: 'ArrowDown' };
const DT = 1 / 60;
const PLAN: StatKey[] = ['HP', 'ATK', 'MAG', 'DEF', 'MDEF', 'HP', 'MP', 'CRIT'];
const ACT_CLEARS: EnemyKind[] = ['NORMAL', 'NORMAL', 'NORMAL', 'ELITE', 'NORMAL', 'BOSS'];

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spendAll(hero: Hero, start: number): number {
  let i = start;
  while (hero.sp > 0 && spendPoint(hero, PLAN[i % PLAN.length])) {i++;}
  return i;
}

function takeLoot(hero: Hero, source: LootSource, act: number, rng: Rng): void {
  const offers = rollLoot(source, act, hero, rng);
  const pick = offers.find((o) => o.kind === 'SCROLL') ?? offers.find((o) => o.kind === 'ITEM') ?? offers[0];
  if (pick) {applyOffer(hero, pick, rng);}
  noteDeclinedScrolls(hero, offers, pick ?? null);
}

function veteran(acts: number, rng: Rng): Hero {
  const hero = createHero();
  let plan = 0;
  for (let act = 0; act < acts; act++) {
    for (const kind of ACT_CLEARS) {
      grantClear(hero, kind);
      plan = spendAll(hero, plan);
      if (kind !== 'NORMAL') {takeLoot(hero, kind, act, rng);}
    }
    fullHeal(hero);
  }
  return hero;
}

function parseParams(): { seed: number | null; fixture: Fixture | null; act: number } {
  const q = new URLSearchParams(location.search);
  const raw = q.get('scene');
  const fixture = raw && (FIXTURES as string[]).includes(raw) ? (raw as Fixture) : null;
  if (raw && !fixture) {console.warn(`[devhook] unknown scene "${raw}"`);}
  const s = Number.parseInt(q.get('seed') ?? '', 10);
  const seed = Number.isFinite(s) && s >= 0 ? s : fixture ? 1 : null;
  const a = Number.parseInt(q.get('act') ?? '1', 10);
  return { seed, fixture, act: Number.isFinite(a) ? Math.min(4, Math.max(1, a)) : 1 };
}

function snapshot(v: DevView, seed: number | null): unknown {
  const sub = v.subScene;
  return JSON.parse(JSON.stringify({
    scene: v.scene, subScene: sub, act: v.act, seed, cursor: v.cursors[sub],
    hero: v.hero, derived: v.derived, enemy: v.enemy, clears: v.clears, score: v.score,
    battle: sub === 'BATTLE' ? { phase: v.battlePhase, text: v.battleText, actions: v.actions } : null,
    loot: sub === 'LOOT' ? v.offers : null,
    card: sub === 'CARD' ? v.card : null,
    map: sub === 'MAP' ? { stage: v.curStage, reachable: v.reachable, stages: v.map.map((st) => st.map((n) => (n.cleared ? `${n.type}*` : n.type))) } : null,
  }));
}

const HOLD = import.meta.env.DEV && new URLSearchParams(location.search).has('hold');
if (HOLD) {Math.random = mulberry32(0x9e3779b9);}

export function installDevHook(host: DevHost): { update(dt: number): void; render(): void } {
  const { seed, fixture, act } = parseParams();
  const rng = seed === null ? null : mulberry32(seed);
  if (rng) {host.setRng(rng);}
  let manual = HOLD;
  const queued: string[] = [];

  const key = (type: 'keydown' | 'keyup', code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { code })); };
  const runTick = (dt: number): void => {
    const codes = queued.splice(0);
    for (const c of codes) {key('keydown', c);}
    host.tick(dt);
    for (const c of codes) {key('keyup', c);}
    if (codes.length) {host.resetEdge();}
  };
  const press = (action: Action): void => {
    if (!(action in KEY)) {throw new Error(`unknown action ${action}`);}
    queued.push(KEY[action]);
  };
  const ticksUntil = (done: () => boolean, max: number, withA = false): void => {
    for (let i = 0; i < max && !done(); i++) {
      if (withA) {press('A');}
      runTick(DT);
    }
  };

  const begin = (): void => {
    host.startRun(act > 1 ? veteran(act - 1, rng!) : createHero(), act - 1, (act - 1) * ACT_CLEARS.length);
    host.scenes.to('PLAYING');
  };
  const enter = (type: string): void => {
    const nodes = host.nextNodes();
    const node = nodes.find((n) => n.type === type) ?? nodes[0];
    node.type = type;
    host.selectNode(node);
  };
  const battle = (): void => { begin(); enter('FIGHT'); };

  const build: Record<Fixture, () => void> = {
    title: () => {},
    map: begin,
    battle,
    levelup: () => { battle(); host.winBattle(); },
    loot: () => { begin(); enter('LOOT'); },
    card: () => { begin(); enter('REST'); },
    paused: () => { battle(); host.scenes.to('PAUSED'); },
    gameover: () => {
      battle();
      for (let i = 0; i < 500 && !host.view().dying && host.view().enemy; i++) {host.enemyTurn();}
      ticksUntil(() => host.scenes.is('GAME_OVER'), 240);
    },
    win: () => {
      host.startRun(veteran(3, rng!), 3, 3 * ACT_CLEARS.length);
      host.scenes.to('PLAYING');
      host.selectNode(host.bossNode());
      host.winBattle();
      ticksUntil(() => host.scenes.is('WIN'), 400, true);
    },
  };
  if (fixture) {
    const stored = { ...localStorage };
    build[fixture]();
    localStorage.clear();
    for (const [k, v] of Object.entries(stored)) {localStorage.setItem(k, v);}
  }

  const api = {
    state: () => snapshot(host.view(), seed),
    step: (n = 1): unknown => {
      manual = true;
      for (let i = 0; i < n; i++) {runTick(DT);}
      host.render();
      return snapshot(host.view(), seed);
    },
    press,
  };
  (window as unknown as { __ember: typeof api }).__ember = api;
  return {
    update: (dt) => { if (!manual) {runTick(dt);} },
    render: () => { if (!HOLD) {host.render();} },
  };
}
