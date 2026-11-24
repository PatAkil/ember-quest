import type { SceneMachine } from '../engine';
import { ACTS_PER_DEPTH, EMBER_MAX } from './types';
import type { BattleState, Hero, Derived, EnemyInstance, EnemyKind, HeroAction, LootOffer, LootSource, MoveId, PactId, Rng, SpellId, StatKey } from './types';
import {
  createHero, createSeededRng, grantClear, spendPoint, rollLoot, applyOffer, noteDeclinedScrolls, fullHeal, equip, stow, learnSpell, offerPacts, planOf, storyPlan, takePact,
} from './sim';
import { HOLLOW_ID, ITEMS } from './data';
import type { ActPlan, SeededRng } from './sim';
import type { BattleScreen, MapNode, RoomType, SubScene } from './state';
import { at, must, noop } from './lookup';

type Action = 'A' | 'B' | 'PAUSE' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Fixture =
  | 'title' | 'map' | 'battle' | 'levelup' | 'loot' | 'card' | 'paused' | 'gameover' | 'win' | 'gear' | 'pick' | 'drop'
  | 'battle-heavy' | 'battle-magic' | 'battle-ward' | 'battle-phase' | 'event' | 'threshold' | 'pact' | 'battle-hollow' | 'map-long' | 'battle-affix'
  | 'title-continue' | 'paused-abandon';
type DevNode = MapNode;

interface DevView {
  scene: string; subScene: SubScene; act: number; n: number; depth: number; hero: Hero; derived: Derived; enemy: EnemyInstance | null;
  clears: number; score: number; dying: boolean; cursors: Record<SubScene, number>;
  battlePhase: string; battleText: string; intent: MoveId | null; actions: HeroAction[]; offers: LootOffer[]; card: string[];
  map: DevNode[][]; curStage: number; reachable: number[];
  pick: { title: string; rows: string[] };
  event: { id: string; title: string; options: string[] };
  descent: { won: boolean; banked: number; bosses: number; descentClears: number | null; plan: ActPlan };
  pacts: PactId[];
  menu: { cursor: number; confirm: boolean; resume?: string } | null;
}

interface DevHost {
  scenes: SceneMachine;
  setRng(source: SeededRng): void;
  tick(dt: number): void;
  render(): void;
  resetEdge(): void;
  syncReveal(): void;
  startRun(hero: Hero, n: number, clears: number): void;
  plan(): ActPlan;
  remap(stageSizes: number[]): void;
  selectNode(node: DevNode): void;
  nextNodes(): DevNode[];
  bossNode(): DevNode;
  winBattle(): void;
  enemyTurn(): void;
  openGear(): void;
  pickUpgrade(): void;
  battle(): BattleScreen;
  view(): DevView;
  offerResume(): void;
}

const FIXTURES: readonly Fixture[] = [
  'title', 'map', 'battle', 'levelup', 'loot', 'card', 'paused', 'gameover', 'win', 'gear', 'pick', 'drop', 'battle-heavy', 'battle-magic',
  'battle-ward', 'battle-phase', 'event', 'threshold', 'pact', 'battle-hollow', 'map-long', 'battle-affix', 'title-continue', 'paused-abandon',
];
const KEY: Record<Action, string> = {
  A: 'Space', B: 'KeyX', PAUSE: 'KeyP', UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
};
const DT = 1 / 60;
const PLAN: readonly StatKey[] = ['HP', 'ATK', 'MAG', 'DEF', 'MDEF', 'HP', 'MP', 'CRIT'];
const ACT_CLEARS: EnemyKind[] = ['NORMAL', 'NORMAL', 'NORMAL', 'ELITE', 'NORMAL', 'BOSS'];

function spendAll(hero: Hero, start: number): number {
  let i = start;
  while (hero.sp > 0 && spendPoint(hero, at(PLAN, i % PLAN.length))) {i++;}
  return i;
}

function takeLoot(hero: Hero, source: LootSource, act: number, rng: Rng): void {
  const offers = rollLoot(source, { n: act, plan: planOf(storyPlan(), act) }, hero, rng);
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

const KIT_WORN: readonly [string, number][] = [['IRON_SWORD', 1], ['LEATHER_VEST', 0], ['BONE_CHARM', 2]];
const KIT_PACK: readonly [string, number][] = [['WILLOW_WAND', 0], ['BRAMBLE_VEST', 1], ['SWIFT_BOOTS', 0]];
const KIT_REST: readonly [string, number][] = [['WORN_SHOES', 0], ['TIN_CUP', 1], ['SPARK_TOME', 0]];
const KIT_SPARE: readonly [string, number][] = [['RUNE_TORC', 0]];

const itemById = (id: string) => must(ITEMS.find((i) => i.id === id), `item ${id}`);

function outfit(worn: readonly [string, number][], pack: readonly [string, number][]): Hero {
  const hero = createHero();
  for (const [id, level] of worn) {equip(hero, itemById(id), level);}
  for (const [id, level] of pack) {stow(hero, { item: itemById(id), level });}
  fullHeal(hero);
  return hero;
}

const SCHOLAR: readonly SpellId[] = ['WATER', 'SLASH', 'THUNDER', 'TWINBOLT', 'LEECH', 'QUAKE'];

function braced(hero: Hero): Hero {
  hero.ember = EMBER_MAX;
  hero.potions = 1;
  hero.burn = { perTurn: 3, turns: 3 };
  return hero;
}

function scholar(hero: Hero): Hero {
  for (const spell of SCHOLAR) {learnSpell(hero, spell);}
  fullHeal(hero);
  return hero;
}

const kitted = (): Hero => outfit(KIT_WORN, KIT_PACK);
const dressed = (): Hero => outfit([...KIT_WORN, ...KIT_REST], []);
const laden = (): Hero => outfit([...KIT_WORN, ...KIT_REST], [...KIT_PACK, ...KIT_SPARE]);

function wanderer(hero: Hero): Hero {
  stow(hero, { item: itemById(at(KIT_SPARE, 0)[0]), level: 0 });
  return hero;
}

function pledged(hero: Hero, depth: number, rng: Rng): Hero {
  for (let d = 2; d <= depth; d++) {
    const [first] = offerPacts(hero, rng);
    if (first) {takePact(hero, first);}
  }
  fullHeal(hero);
  return hero;
}

function scoutedFoe(type: RoomType, plan: ActPlan): string | undefined {
  if (type === 'FIGHT') {return plan.normals[0];}
  return type === 'ELITE' ? plan.elites[0] : undefined;
}

interface Params { seed: number | null; fixture: Fixture | null; n: number; depth: number }

const isFixture = (raw: string): raw is Fixture => (FIXTURES as readonly string[]).includes(raw);

function parseFixture(q: URLSearchParams): Fixture | null {
  const raw = q.get('scene');
  if (raw === null || raw === '') {return null;}
  if (isFixture(raw)) {return raw;}
  reportError(new Error(`[devhook] unknown scene "${raw}"`));
  return null;
}

function parseSeed(q: URLSearchParams, fixture: Fixture | null): number | null {
  const s = Number.parseInt(q.get('seed') ?? '', 10);
  if (Number.isFinite(s) && s >= 0) {return s;}
  return fixture || HOLD ? 1 : null;
}

const MAX_DEPTH = 10;
const LONG_MAP = [2, 3, 2, 3, 2, 3, 2, 3];

function parseBounded(raw: string | null, max: number): number {
  const v = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(v) ? Math.min(max, Math.max(1, v)) : 1;
}

function parseParams(): Params {
  const q = new URLSearchParams(location.search);
  const fixture = parseFixture(q);
  const depth = parseBounded(q.get('depth'), MAX_DEPTH);
  const n = ACTS_PER_DEPTH * (depth - 1) + parseBounded(q.get('act'), ACTS_PER_DEPTH) - 1;
  return { seed: parseSeed(q, fixture), fixture, n, depth };
}

const menuOf = (v: DevView): { menu?: DevView['menu'] } => (v.menu ? { menu: v.menu } : {});

function snapshot(v: DevView, seed: number | null): unknown {
  const sub = v.subScene;
  return JSON.parse(JSON.stringify({
    scene: v.scene, subScene: sub, act: v.act, n: v.n, depth: v.depth, actInDepth: v.act - 1, seed, cursor: v.cursors[sub],
    won: v.descent.won, banked: v.descent.banked, bosses: v.descent.bosses, biome: v.descent.plan.biomeIndex,
    hero: v.hero, derived: v.derived, enemy: v.enemy, clears: v.clears, score: v.score,
    battle: sub === 'BATTLE' ? { phase: v.battlePhase, text: v.battleText, intent: v.intent, actions: v.actions } : null,
    loot: sub === 'LOOT' ? v.offers : null,
    card: sub === 'CARD' ? v.card : null,
    gear: sub === 'GEAR' ? { pack: v.hero.pack.length } : null,
    pick: sub === 'PICK' ? v.pick : null,
    event: sub === 'EVENT' ? v.event : null,
    threshold: sub === 'THRESHOLD' ? { choices: ['ASCEND', 'DESCEND'] } : null,
    pact: sub === 'PACT' ? { offers: v.pacts } : null,
    ...menuOf(v),
    map: sub === 'MAP' ? { stage: v.curStage, reachable: v.reachable, stages: v.map.map((st) => st.map((n) => (n.cleared ? `${n.type}*` : n.type))) } : null,
  }));
}

export const HOLD = import.meta.env.DEV && new URLSearchParams(location.search).has('hold');
if (HOLD) {Math.random = createSeededRng(0x9e3779b9).next;}

interface Driver {
  runTick: (dt: number) => void;
  press: (action: Action) => void;
}

function createDriver(host: DevHost): Driver {
  const queued: string[] = [];
  const key = (type: 'keydown' | 'keyup', code: string): void => { window.dispatchEvent(new KeyboardEvent(type, { code })); };
  return {
    runTick: (dt) => {
      const codes = queued.splice(0);
      for (const c of codes) {key('keydown', c);}
      host.tick(dt);
      for (const c of codes) {key('keyup', c);}
      if (codes.length) {host.resetEdge();}
    },
    press: (action) => {
      if (!(action in KEY)) {throw new Error(`unknown action ${action}`);}
      queued.push(KEY[action]);
    },
  };
}

function ticksUntil(driver: Driver, done: () => boolean, max: number, withA = false): void {
  for (let i = 0; i < max && !done(); i++) {
    if (withA) {driver.press('A');}
    driver.runTick(DT);
  }
}

const ARM_TICKS = 70;
const A_TICKS = 16;

function settle(driver: Driver, ticks: number): void {
  for (let i = 0; i < ticks; i++) {driver.runTick(DT);}
}

interface FixtureContext { host: DevHost; driver: Driver; rng: Rng; n: number; depth: number; seed: number }

const FALLS: readonly ((e: EnemyInstance, hero: Hero) => void)[] = [noop, (_e, h) => { h.hp = 1; h.burn = { perTurn: 4, turns: 2 }; }, (e, h) => { h.hp = 1; e.affixes = ['THORNED']; }];

type VerbFixture = 'battle-heavy' | 'battle-magic' | 'battle-ward' | 'battle-phase' | 'battle-affix';
interface Starts { fresh: () => Hero; begin: (hero?: Hero) => void; battle: (hero?: Hero) => void }

function verbFixtures(fx: FixtureContext, starts: Starts): Record<VerbFixture, () => void> {
  const { host, driver } = fx;
  const { fresh, begin, battle } = starts;
  const foe = (): { e: EnemyInstance; state: BattleState } => {
    const b = host.battle();
    return { e: must(b.enemy ?? undefined, 'enemy'), state: must(b.state ?? undefined, 'battle state') };
  };
  const ward = (): void => {
    battle();
    const { e, state } = foe();
    e.def = { ...e.def, weak: 'FIRE' };
    e.wardTurns = 2;
    e.burn = { perTurn: 3, turns: 3 };
    Object.assign(state, { intent: 'SCORCH', riposte: true, guarding: true });
  };
  const phase = (): void => {
    begin();
    host.selectNode(host.bossNode());
    const { e } = foe();
    e.def = { ...e.def, phase2: e.def.phase2 ?? { at: 0.5, moves: ['WINDUP', 'HEAVY', 'STRIKE'], banner: `${e.def.name} RAGES`, atkMult: 1.15 } };
    e.hp = Math.floor(e.maxHp * 0.45);
    host.enemyTurn();
    host.syncReveal();
    for (let i = 0; i < 24; i++) {driver.runTick(DT);}
  };
  return {
    'battle-heavy': () => { battle(braced(fresh())); foe().state.intent = 'HEAVY'; },
    'battle-magic': () => { battle(scholar(fresh())); host.battle().menu = 'MAGIC'; },
    'battle-ward': ward,
    'battle-phase': phase,
    'battle-affix': () => { battle(); foe().e.affixes = ['THORNED', 'VAMPIRIC', 'SWIFT']; },
  };
}

function fixtureBuilders(fx: FixtureContext): Record<Fixture, () => void> {
  const { host, driver, rng, n, depth } = fx;
  const fresh = (): Hero => pledged(n > 0 ? veteran(n, rng) : createHero(), depth, rng);
  const begin = (hero?: Hero): void => {
    host.startRun(hero ?? fresh(), n, n * ACT_CLEARS.length);
    host.scenes.to('PLAYING');
  };
  const enter = (type: RoomType): void => {
    const nodes = host.nextNodes();
    const node = nodes.find((m) => m.type === type) ?? at(nodes, 0);
    if (node.type !== type) {node.enemyId = scoutedFoe(type, host.plan());}
    node.type = type;
    host.selectNode(node);
  };
  const battle = (hero?: Hero): void => { begin(hero); enter('FIGHT'); };
  const toItemOffer = (): void => {
    const i = host.view().offers.findIndex((o) => o.kind === 'ITEM');
    host.syncReveal();
    for (let n = 0; n < i; n++) { driver.press('DOWN'); driver.runTick(DT); }
  };
  const chest = (hero: Hero): void => { begin(hero); enter('LOOT'); toItemOffer(); };
  const loseBattle = (): void => {
    const way = fx.seed % 4;
    if (way === 3) { begin(); host.plan().boss = HOLLOW_ID; host.selectNode(host.bossNode()); } else {battle();}
    FALLS[way]?.(must(host.battle().enemy ?? undefined, 'enemy'), host.view().hero);
    host.syncReveal();
    if (way === 1 || way === 2) {ticksUntil(driver, () => host.view().dying, 400, true);}
    for (let i = 0; i < 500 && !host.view().dying && host.view().enemy; i++) {host.enemyTurn();}
    ticksUntil(driver, () => host.scenes.is('GAME_OVER'), 240);
  };
  const killLastBoss = (cleared = depth): void => {
    const lastAct = ACTS_PER_DEPTH * cleared - 1;
    host.startRun(pledged(veteran(lastAct, rng), cleared, rng), lastAct, lastAct * ACT_CLEARS.length);
    host.scenes.to('PLAYING');
    host.selectNode(host.bossNode());
    host.winBattle();
    ticksUntil(driver, () => host.view().subScene === 'THRESHOLD', 400, true);
    settle(driver, ARM_TICKS);
  };
  const winRun = (): void => {
    killLastBoss();
    ticksUntil(driver, () => host.scenes.is('WIN'), 400, true);
  };
  const pactRun = (): void => {
    killLastBoss(Math.max(1, depth - 1));
    host.syncReveal();
    driver.press('DOWN'); driver.runTick(DT);
    driver.press('A'); driver.runTick(DT);
    settle(driver, ARM_TICKS);
  };
  return {
    title: noop,
    map: () => { begin(); },
    battle,
    ...verbFixtures(fx, { fresh, begin, battle }),
    levelup: () => { battle(); host.winBattle(); },
    loot: () => { chest(dressed()); },
    card: () => { begin(); enter('REST'); },
    paused: () => { battle(); host.scenes.to('PAUSED'); },
    'paused-abandon': () => {
      battle(); host.scenes.to('PAUSED');
      driver.press('DOWN'); driver.runTick(DT);
      driver.press('A'); driver.runTick(DT);
    },
    'title-continue': () => { host.startRun(fresh(), n, n * ACT_CLEARS.length); host.offerResume(); },
    gameover: loseBattle,
    win: winRun,
    gear: () => { begin(kitted()); host.openGear(); },
    pick: () => { begin(laden()); enter('LOOT'); host.pickUpgrade(); },
    drop: () => { chest(laden()); host.syncReveal(); settle(driver, A_TICKS); driver.press('A'); driver.runTick(DT); },
    event: () => { begin(wanderer(fresh())); enter('EVENT'); },
    threshold: () => { killLastBoss(); },
    pact: pactRun,
    'battle-hollow': () => { begin(); host.plan().boss = HOLLOW_ID; host.selectNode(host.bossNode()); },
    'map-long': () => { begin(); host.remap(LONG_MAP); },
  };
}

function storageEntries(): [string, string][] {
  const entries: [string, string][] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = k === null ? null : localStorage.getItem(k);
    if (k !== null && v !== null) {entries.push([k, v]);}
  }
  return entries;
}

function preservingStorage(run: () => void): void {
  const stored = storageEntries();
  run();
  localStorage.clear();
  for (const [k, v] of stored) {localStorage.setItem(k, v);}
}

export function installDevHook(host: DevHost): { update(dt: number): void; render(): void } {
  const { seed, fixture, n, depth } = parseParams();
  const source = seed === null ? null : createSeededRng(seed);
  if (source) {host.setRng(source);}
  const rng = source?.next ?? null;
  let manual = HOLD;
  const driver = createDriver(host);
  if (fixture !== null && rng !== null) {
    const build = fixtureBuilders({ host, driver, rng, n, depth, seed: seed ?? 0 })[fixture];
    preservingStorage(build);
    host.syncReveal();
  }

  const api = {
    state: () => snapshot(host.view(), seed),
    step: (n = 1): unknown => {
      manual = true;
      for (let i = 0; i < n; i++) {driver.runTick(DT);}
      host.render();
      return snapshot(host.view(), seed);
    },
    press: driver.press,
  };
  (window as unknown as { __ember: typeof api }).__ember = api;
  return {
    update: (dt) => { if (!manual) {driver.runTick(dt);} },
    render: () => { if (!HOLD) {host.render();} },
  };
}
