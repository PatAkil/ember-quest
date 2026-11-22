// Ember Quest — a retro roguelike JRPG. No overworld walking, no real-time
// action: every screen is a menu or a battle tableau. Descend through FOUR
// ACTS (Crypt -> Tundra -> Desert -> Holy Temple), each a branching node map
// (FIGHT/ELITE/REST/LOOT/BOSS) leading to that act's single boss. Combat is
// turn-based, one enemy at a time: ATTACK (free) or a known spell (costs MP);
// enemies hit back PHYSICAL or MAGIC and carry their own resists.
//
// v2 PROGRESSION (see DESIGN.md): every clear pays SKILL POINTS spent on the
// LEVEL UP screen (HP/MP/ATK/MAG/DEF/MDEF/CRIT), and loot is a table of NAMED
// ITEMS in six slots — one item per slot, a new find replaces the old — where
// every RARE+ item carries a unique effect (hex dagger, ramping axe, twin
// bolts, reflect mail, phoenix pendant...). Rules live in sim.ts, content in
// data.ts; this file is screens, input, juice and rendering only.
// Permadeath; felling the Seraph wins the run.
//
// STYLE CARD — diverges from the reference game, both verification fixtures,
// AND every sibling in workspace/ (see workspace/ember-descent/game/main.ts for
// the sibling this most needs to differ from — same fiction):
//   - PALETTE: PICO8. Background is a flat BLACK VOID (PICO8[0]) — ember-descent
//     uses PICO8[1]; this game's depth planes are the only thing separating
//     "menu" screens from "battle" screens.
//   - HERO: a CRIMSON KNIGHT, 22x27 at px 1 — body 8, shade 2, highlight 9,
//     white (7) plume, yellow (10) visor, grey (6/5) blade angled off his right
//     side as its own silhouette island. NOT blue (ember-descent's hero).
//   - SPRITE CRAFT: every actor authored at px 1 at rendered size (normals
//     14-38 px, elites 14-25, bosses 26-39 wide), keyline in the rows, 2-3 body
//     tones + flat accents, 2-frame breathe/float idles (sprites.ts).
//   - BACKGROUND PLANES (under the ambient layer, inside the ambient band):
//     CRYPT [1] pillars + torch flames; TUNDRA [1] crescent moon + ice peaks;
//     DESERT low orange sun behind brown dune domes at reduced alpha; TEMPLE
//     fluted dark-grey columns with gold capitals.
//   - SURFACES: drawBevel floors — CRYPT 5/6/1, TUNDRA 1/12/0, DESERT 4/9/2,
//     TEMPLE 6/7/5 — one dither lip; black ground shadows under actors. Panels
//     are square dark-blue (1) plates with a yellow (10) keyline, selected rows
//     get a dark-purple (2) bar — the opposite of ember-descent's notched panels.
//   - RARITY LANGUAGE: item names tint by rarity — grey / blue / pink / yellow.
//   - LOGO: drawLogo 10 / 9 / 2; the title prop is the knight at px 2 on the
//     Crypt floor with a slime idling opposite.
//   - ACCENT: warm yellow (10) for headings, the selected row and borders.
//   - AMBIENT: embers / snow / embers-as-dust (peach) / bubbles-as-motes (gold).
//   - JUICE: shake + yellow flash on hits, red shake + flash when struck, crits
//     get a scale-3 outlined number and a hit-stop, bursts in each actor's own
//     hue, a red RADIAL flash from the hero + freeze-frame on the killing blow;
//     the knight falls where he stood and the killer stays under the dim.
//   - TERMINAL SCREENS: live tableau + dimScene + a hollow drawFrame bezel.
//
// Controls: Up/Down (arrows/WASD) move every cursor; A confirms / spends a
// point / advances; PAUSE pauses. B is intentionally undeclared.

import {
  createPixelCanvas, createLoop, createInput, controlHints, createScenes,
  createParticles, createJuice, createAudio, createCrt, createRuntime,
  drawSprite, frameIndex, drawText, drawTextCentered, textWidth,
  drawFrame, drawLogo, fillDither, drawBevel, drawPanel,
  hudText, dimScene, blink,
  BUTTON_KEY, PICO8, SAFE_MARGIN,
} from '../engine';
import type { Sprite, AmbientPreset } from '../engine';
import {
  heroFrames, ENEMY_FRAMES, ICON_SWORD, ICON_WAND, ICON_ARMOR, ICON_NECKLACE, ICON_CHALICE, ICON_BOOTS, ICON_TOME, ICON_EMPTY,
  fightIcon, eliteIcon, restIcon, lootIcon, bossIcon,
} from './sprites';
import type { Anim } from './sprites';
import { STAT_KEYS, SP_GAIN, SLOTS } from './types';
import type { Hero, Item, Slot, StatKey, SpellId, LootSource, LootOffer, EnemyKind, EnemyInstance, BattleState, HeroAction, Derived } from './types';
import { BIOMES, ENEMIES, ITEMS, SPELLS, RARITY_COLOR_INDEX, BOSS_ENTRY_HEAL, validateData } from './data';
import {
  createHero, derive, heroActions, spellCost, canAfford, spendPoint, grantClear, healFraction, fullHeal,
  spawnEnemy, createBattle, startTurn, heroAct, enemyAct, rollLoot, skipMend,
  applyOffer, compareOffer, describeOffer, displayName, itemLevel, noteDeclinedScrolls,
} from './sim';

// --- Setup -------------------------------------------------------------------
const W = 240;
const H = 160;
const pc = createPixelCanvas({ width: W, height: H, scale: 3, parent: document.getElementById('screen') });
const audio = createAudio();
const input = createInput(
  [{ button: 'A', label: 'select' }, { button: 'PAUSE', label: 'pause' }],
  { onFirstKey: () => audio.unlock() },
);
const scenes = createScenes();
const particles = createParticles({ width: W, height: H, ambient: 'embers' });
const juice = createJuice();
const crt = createCrt();
const runtime = createRuntime();
for (const v of validateData()) console.warn('[ember-quest data]', v);

// --- Palette roles -----------------------------------------------------------
const C_BG = PICO8[0];
const C_PANEL = PICO8[1];
const C_BORDER = PICO8[10];
const C_ACCENT = PICO8[10];
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_HP = PICO8[11];
const C_HP_LOW = PICO8[8];
const C_MP = PICO8[12];
const C_DMG_TAKEN = PICO8[8];
const C_SEL_BAR = PICO8[2];
const rarityColor = (item: Item): string => PICO8[RARITY_COLOR_INDEX[item.rarity]];

/** Burst / identity hue per enemy id (sprites carry the rest). */
const ENEMY_COLOR: Record<string, string> = {
  SLIME: PICO8[11], GOBLIN: PICO8[9], SKELETON: PICO8[7], OGRE_KING: PICO8[4], WRAITH_LORD: PICO8[13], DARK_LORD: PICO8[3],
  ICE_WOLF: PICO8[12], ICE_BEAR: PICO8[7], FROST_WISP: PICO8[13], YETI: PICO8[6],
  SANDWORM: PICO8[15], SCORPION: PICO8[10], MUMMY: PICO8[6], SAND_GOLEM: PICO8[4],
  GUARDIAN: PICO8[10], ORACLE: PICO8[13], PALADIN: PICO8[7], SERAPH: PICO8[15],
};
const enemyColor = (id: string): string => ENEMY_COLOR[id] ?? C_TEXT;

/** Per-biome presentation (the rules tables in data.ts know nothing about colour). */
interface BiomeLook { floor: string; floorLight: string; floorDark: string; ambient: AmbientPreset; ambientColor: string }
const BIOME_LOOK: BiomeLook[] = [
  { floor: PICO8[5], floorLight: PICO8[6], floorDark: PICO8[1], ambient: 'embers', ambientColor: PICO8[9] },
  { floor: PICO8[1], floorLight: PICO8[12], floorDark: PICO8[0], ambient: 'snow', ambientColor: PICO8[7] },
  { floor: PICO8[4], floorLight: PICO8[9], floorDark: PICO8[2], ambient: 'embers', ambientColor: PICO8[15] },
  { floor: PICO8[6], floorLight: PICO8[7], floorDark: PICO8[5], ambient: 'bubbles', ambientColor: PICO8[10] },
];

let clock = 0; // ONE clock, fed by fixed-step dt, drives every animation.

// --- Map generation -------------------------------------------------------------
type RoomType = 'FIGHT' | 'ELITE' | 'REST' | 'LOOT' | 'BOSS';
interface MapNode { type: RoomType; stage: number; slot: number; links: number[]; cleared: boolean }
const STAGE_SIZES = [2, 3, 2, 3, 2, 3]; // 6 stages, then a 1-node BOSS stage

function pickRoomType(): RoomType {
  const r = Math.random();
  if (r < 0.15) return 'ELITE';
  if (r < 0.30) return 'REST';
  if (r < 0.42) return 'LOOT';
  return 'FIGHT';
}

/**
 * Link one stage to the next so that (a) every next node is reachable,
 * (b) most nodes offer TWO onward choices — the previous monotone ladder gave
 * a single link 84 % of the time, so the map, not the player, picked rooms —
 * and (c) crossings are only ever the small X between two NEIGHBOURING nodes:
 * node i's lowest target may dip one below node i-1's highest, never below
 * node i-2's highest, so no edge ever cuts across another node's straight run.
 */
function linkStage(cur: MapNode[], next: MapNode[]): void {
  const a = cur.length; const b = next.length;
  const his: number[] = [];
  for (let i = 0; i < a; i++) {
    const straight = Math.round((i * (b - 1)) / Math.max(1, a - 1));
    const floorLo = Math.max(i >= 1 ? his[i - 1] - 1 : 0, i >= 2 ? his[i - 2] : 0);
    const span = b >= 2 && Math.random() < 0.85 ? 2 : 1;
    let lo = Math.max(floorLo, Math.min(straight - (span === 2 && Math.random() < 0.5 ? 1 : 0), b - 1));
    let hi = Math.min(b - 1, lo + span - 1);
    if (hi < lo) hi = lo;
    // keep the span honest when it was clipped at the bottom edge
    if (hi - lo + 1 < span && lo > floorLo) lo = Math.max(floorLo, hi - span + 1);
    cur[i].links = [];
    for (let j = lo; j <= hi; j++) cur[i].links.push(j);
    his.push(hi);
  }
  // Coverage: any orphaned next node is claimed by the nearest node whose span can stretch to it.
  for (let j = 0; j < b; j++) {
    if (cur.some((n) => n.links.includes(j))) continue;
    let best = 0; let bestDist = Infinity;
    cur.forEach((n, i) => {
      const d = Math.min(Math.abs(n.links[0] - j), Math.abs(n.links[n.links.length - 1] - j));
      if (d < bestDist) { bestDist = d; best = i; }
    });
    cur[best].links.push(j);
    cur[best].links.sort((x, y) => x - y);
  }
  // No rest feeding into rest: the second one becomes a fight.
  for (const n of cur) if (n.type === 'REST') for (const j of n.links) if (next[j].type === 'REST') next[j].type = 'FIGHT';
}

function generateMap(): MapNode[][] {
  const stages: MapNode[][] = [];
  for (let s = 0; s < STAGE_SIZES.length; s++) {
    const stage: MapNode[] = [];
    for (let n = 0; n < STAGE_SIZES[s]; n++) stage.push({ type: pickRoomType(), stage: s, slot: n, links: [], cleared: false });
    stages.push(stage);
  }
  stages.push([{ type: 'BOSS', stage: STAGE_SIZES.length, slot: 0, links: [], cleared: false }]);
  // No elite before the first clear — an elite against base stats is a coin flip, not a choice.
  for (const n of stages[0]) if (n.type === 'ELITE') n.type = 'FIGHT';
  if (!stages.slice(1, 6).some((st) => st.some((n) => n.type === 'ELITE'))) {
    const st = stages[2]; st[Math.floor(Math.random() * st.length)].type = 'ELITE';
  }
  if (!stages.slice(0, 6).some((st) => st.some((n) => n.type === 'REST'))) {
    const st = stages[4]; st[Math.floor(Math.random() * st.length)].type = 'REST';
  }
  // A chest every act — and when we have to invent one, make it the REST's
  // sibling so "rest or loot" is a choice the route forces at least once.
  if (!stages.slice(0, 6).some((st) => st.some((n) => n.type === 'LOOT'))) {
    const restStage = stages.slice(0, 6).find((st) => st.length > 1 && st.some((n) => n.type === 'REST')) ?? stages[3];
    const cands = restStage.filter((n) => n.type !== 'REST');
    (cands[Math.floor(Math.random() * cands.length)] ?? restStage[0]).type = 'LOOT';
  }
  for (let s = 0; s < stages.length - 1; s++) linkStage(stages[s], stages[s + 1]);
  return stages;
}

// --- Run state -------------------------------------------------------------------
let hero: Hero = createHero();
let clears = 0; // encounters cleared this run — the difficulty scalar and score basis
let score = 0;
let actIndex = 0;
let mapStages: MapNode[][] = [];
let curStage = -1; // -1 = before stage 0
let reachable: number[] = [0, 1]; // slot indices reachable in the NEXT stage
let cursor = 0;
let pendingNode: MapNode | null = null;

type SubScene = 'MAP' | 'BATTLE' | 'LEVELUP' | 'LOOT' | 'CARD';
let subScene: SubScene = 'MAP';
let prevDirY = 0; // manual edge-detection for menu navigation (engine exposes dir, not a directional press edge)
function resetCursorEdge(): void { prevDirY = input.dir.y; }
/** Up/Down as a press edge: returns -1/0/+1 once per key-down. */
function dirEdge(): number {
  const dy = input.dir.y;
  const edge = dy !== 0 && prevDirY === 0 ? dy : 0;
  prevDirY = dy;
  return edge;
}

let best = 0;
let beatBest = false;
const BEST_KEY = 'retrovibe.ember-quest.best';
try { best = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0; } catch { best = 0; }
function saveBest(): void {
  beatBest = score > best;
  if (beatBest) { best = score; try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode */ } }
}

let deathBiome = '';
let dying = false;
let heroDown = false; // death tableau: the knight lies where he fell
const biome = () => BIOMES[actIndex];
const look = () => BIOME_LOOK[actIndex];

// --- Damage / status pops -------------------------------------------------------
interface Pop { x: number; y: number; life: number; text: string; color: string; scale: number }
const POP_LIFE = 1.1;
const pops: Pop[] = [];
function pushPop(x: number, y: number, text: string, color: string, scale = 2): void { pops.push({ x, y, life: POP_LIFE, text, color, scale }); }
function updatePops(dt: number): void {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.life -= dt; p.y -= 14 * dt;
    if (p.life <= 0) pops.splice(i, 1);
  }
}

// --- Card screen (non-interactive message) --------------------------------------
let cardLines: string[] = [];
let cardOnDone: () => void = () => {};
function showCard(lines: string[], onDone: () => void): void {
  cardLines = lines; cardOnDone = onDone; subScene = 'CARD'; resetCursorEdge();
}

// --- Level-up screen (spend skill points) ---------------------------------------
let luCursor = 0;
let luOnDone: () => void = () => {};
let luEarned = 0;
function startLevelUp(earned: number, onDone: () => void): void {
  if (hero.sp <= 0) { onDone(); return; }
  luEarned = earned; luCursor = 0; luOnDone = onDone; subScene = 'LEVELUP'; resetCursorEdge();
}
function updateLevelUp(): void {
  const dy = dirEdge();
  if (dy) { luCursor = (luCursor + dy + STAT_KEYS.length) % STAT_KEYS.length; audio.play('blip'); }
  if (input.pressed('A')) {
    if (spendPoint(hero, STAT_KEYS[luCursor])) {
      audio.play('pickup');
      const hp = heroPos();
      pushPop(hp.x, hp.y - 26, `+${SP_GAIN[STAT_KEYS[luCursor]]} ${STAT_KEYS[luCursor]}`, C_ACCENT);
    }
    if (hero.sp <= 0) luOnDone();
  }
}

// --- Loot screen (choose one item, or keep gear + mend) --------------------------
const pickOne = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
let lootOffers: LootOffer[] = [];
let lootCursor = 0;
let lootSource: LootSource = 'FIGHT';
let lootOnDone: () => void = () => {};
function startLoot(source: LootSource, onDone: () => void): void {
  lootOffers = rollLoot(source, actIndex, hero, Math.random);
  // Bad-luck guard: a knight with no weapon cannot out-damage anything, so the
  // first item offers of a run always include one (a common blade or wand).
  const itemIdx = lootOffers.map((o, i) => (o.kind === 'ITEM' ? i : -1)).filter((i) => i >= 0);
  if (!hero.equipment.WEAPON && itemIdx.length && !lootOffers.some((o) => o.kind === 'ITEM' && o.item.slot === 'WEAPON')) {
    const starters = ITEMS.filter((i) => i.slot === 'WEAPON' && i.rarity === 'COMMON' && (i.minAct ?? 0) <= actIndex);
    if (starters.length) lootOffers[itemIdx[itemIdx.length - 1]] = { kind: 'ITEM', item: pickOne(starters) };
  }
  lootSource = source; lootCursor = 0; lootOnDone = onDone;
  if (lootOffers.length === 0) {
    if (source === 'FIGHT') { onDone(); return; } // a dry fight: no drop, no screen
    const m = skipMend(hero);
    showCard(['THE CACHE IS BARE', `MENDED ${m.hp} HP AND ${m.mp} MP`], onDone);
    return;
  }
  subScene = 'LOOT'; resetCursorEdge();
}
function updateLoot(): void {
  const n = lootOffers.length + 1;
  const dy = dirEdge();
  if (dy) { lootCursor = (lootCursor + dy + n) % n; audio.play('blip'); }
  if (input.pressed('A')) {
    if (lootCursor < lootOffers.length) {
      const offer = lootOffers[lootCursor];
      const delta = compareOffer(hero, offer);
      const r = applyOffer(hero, offer, Math.random);
      noteDeclinedScrolls(hero, lootOffers, offer);
      audio.play('pickup');
      if (offer.kind === 'SCROLL') {
        const hp = heroPos();
        particles.burst(hp.x, hp.y - 10, { count: 14, color: PICO8[12], speed: 100 });
        juice.flash(PICO8[12], 0.3);
        const sp = SPELLS[offer.spell];
        showCard([`YOU LEARNED ${sp.name}!`, `${sp.scale} x${sp.mult.toFixed(1)}${sp.hits > 1 ? ` x${sp.hits}` : ''}  ${sp.cost} MP  ${sp.kind}`], lootOnDone);
      } else if (offer.kind === 'ITEM') {
        showCard([`EQUIPPED ${offer.item.name}`, r.replaced ? `${r.replaced.name} IS LEFT BEHIND` : offer.item.blurb], lootOnDone);
      } else {
        const hp = heroPos();
        particles.burst(hp.x, hp.y, { count: 12, color: C_ACCENT, speed: 90 });
        showCard([offer.toLevel >= 2 ? `${offer.item.name} AWAKENS!` : `${displayName(offer.item, offer.toLevel)}`, offer.toLevel >= 2 ? r.line : delta], lootOnDone);
      }
    } else {
      const m = skipMend(hero);
      noteDeclinedScrolls(hero, lootOffers, null);
      audio.play('pickup');
      showCard(['YOU KEEP YOUR GEAR', `MENDED ${m.hp} HP AND ${m.mp} MP`], lootOnDone);
    }
  }
}

// --- Map navigation ---------------------------------------------------------------
function moveCursor(dy: number): void {
  const i = reachable.indexOf(cursor);
  const next = reachable[(i + dy + reachable.length) % reachable.length];
  if (next !== cursor) { cursor = next; audio.play('blip'); }
}

function advanceStage(): void {
  const node = pendingNode!;
  node.cleared = true;
  curStage = node.stage;
  const next = mapStages[curStage + 1];
  reachable = node.links.length ? node.links : next.map((_, i) => i);
  cursor = reachable[0];
  subScene = 'MAP';
  resetCursorEdge();
}

function onClear(kind: EnemyKind): number {
  clears++;
  score = clears * 100;
  runtime.scoreChanged(score);
  const g = grantClear(hero, kind);
  return g.sp;
}

function onActCleared(): void {
  if (actIndex >= BIOMES.length - 1) { subScene = 'BATTLE'; scenes.to('WIN'); return; }
  actIndex++;
  showCard([`${BIOMES[actIndex].name} AWAITS...`, 'THE DESCENT CONTINUES'], () => enterAct());
}

function selectNode(node: MapNode): void {
  pendingNode = node;
  const b = biome();
  if (node.type === 'FIGHT') {
    startBattle(pickOne(b.normals), () => {
      const sp = onClear('NORMAL');
      startLevelUp(sp, () => startLoot('FIGHT', () => advanceStage()));
    });
  } else if (node.type === 'ELITE') {
    startBattle(pickOne(b.elites), () => {
      const sp = onClear('ELITE');
      startLevelUp(sp, () => startLoot('ELITE', () => advanceStage()));
    });
  } else if (node.type === 'BOSS') {
    node.cleared = true;
    healFraction(hero, BOSS_ENTRY_HEAL);
    startBattle(b.boss, () => {
      const sp = onClear('BOSS');
      showCard(['VICTORY!', `${ENEMIES[b.boss].name} IS NO MORE`], () =>
        startLevelUp(sp, () => startLoot('BOSS', () => onActCleared())));
    });
  } else if (node.type === 'REST') {
    fullHeal(hero);
    audio.play('pickup');
    showCard(['FULLY RESTED', 'HP AND MP RESTORED'], () => advanceStage());
  } else if (node.type === 'LOOT') {
    startLoot('LOOT', () => advanceStage());
  }
}

function enterAct(): void {
  mapStages = generateMap();
  pendingNode = null;
  curStage = -1;
  reachable = mapStages[0].map((_, i) => i);
  cursor = 0;
  subScene = 'MAP';
  particles.setAmbient(look().ambient, look().ambientColor);
  resetCursorEdge();
}

function startRun(): void {
  hero = createHero();
  clears = 0; score = 0; actIndex = 0; dying = false; heroDown = false; enemy = null; battle = null; pops.length = 0;
  enterAct();
}

function startPlaying(): void { startRun(); scenes.to('PLAYING'); }

scenes.onEnter('TITLE', () => runtime.stateChanged('TITLE'));
scenes.onEnter('PLAYING', () => runtime.stateChanged('PLAYING'));
scenes.onEnter('PAUSED', () => runtime.stateChanged('PAUSED'));
scenes.onEnter('GAME_OVER', () => { saveBest(); runtime.stateChanged('GAME_OVER'); runtime.gameOver({ score, won: false }); });
scenes.onEnter('WIN', () => { saveBest(); runtime.stateChanged('WIN'); runtime.gameOver({ score, won: true }); });

// --- Battle state ------------------------------------------------------------------
let enemy: EnemyInstance | null = null;
let battle: BattleState | null = null;
type BattlePhase = 'MENU' | 'QUEUE';
let battlePhase: BattlePhase = 'MENU';
let menuCursor = 0;
type Outcome = 'NONE' | 'WON' | 'LOST';
let pendingOutcome: Outcome = 'NONE';
let onBattleWon: () => void = () => {};
interface QueueStep { hold: number; run: () => void }
let queue: QueueStep[] = [];
let queueTimer = 0;
let curText = '';
let curColor = C_TEXT;

const FLOOR_Y = 112;
const HERO_X = 56;   // hero centre
const ENEMY_X = 176; // enemy centre

function heroPos(): { x: number; y: number } { return { x: HERO_X, y: FLOOR_Y - 14 }; }
function enemyPos(): { x: number; y: number } {
  const h = enemy ? ENEMY_FRAMES[enemy.def.id][0].h : 0;
  return { x: ENEMY_X, y: FLOOR_Y - h / 2 };
}

function startBattle(id: string, onWin: () => void): void {
  enemy = spawnEnemy(id, clears, actIndex);
  battle = createBattle(enemy);
  onBattleWon = onWin;
  battlePhase = 'MENU'; menuCursor = 0; pendingOutcome = 'NONE';
  queue = []; queueTimer = 0; curText = ''; curColor = C_TEXT;
  subScene = 'BATTLE';
  resetCursorEdge();
}

function push(hold: number, run: () => void): void { queue.push({ hold, run }); }
function beginQueue(): void { battlePhase = 'QUEUE'; advanceQueueStep(); }
function advanceQueueStep(): void {
  const step = queue.shift();
  if (!step) { onQueueDone(); return; }
  step.run();
  queueTimer = step.hold;
}

function onQueueDone(): void {
  if (pendingOutcome === 'LOST') return; // dying flow handled in updateBattle
  if (pendingOutcome === 'WON') {
    pendingOutcome = 'NONE';
    const cb = onBattleWon;
    enemy = null; battle = null;
    battlePhase = 'MENU';
    cb();
    return;
  }
  battlePhase = 'MENU';
  menuCursor = Math.min(menuCursor, heroActions(hero).length - 1);
}

function enemyDefeatedStep(): void {
  const e = enemy!;
  const p = enemyPos();
  const mag = e.def.kind === 'BOSS' ? 1 : e.def.kind === 'ELITE' ? 0.6 : 0.3;
  push(1.0, () => {
    curText = `${e.def.name} DEFEATED!`; curColor = C_ACCENT;
    audio.play('explosion');
    particles.burst(p.x, p.y, { count: 10 + Math.round(mag * 10), color: enemyColor(e.def.id), speed: 120 + mag * 60 });
    juice.shake(4 + mag * 3, 0.35 + mag * 0.15);
    pushPop(p.x, p.y - 24, '+100', C_ACCENT);
    pendingOutcome = 'WON';
  });
}

function heroDies(text: string): void {
  const hp = heroPos();
  curText = text; curColor = C_DMG_TAKEN;
  audio.play('explosion');
  particles.burst(hp.x, hp.y, { count: 14, color: PICO8[8], speed: 150 });
  juice.shake(6, 0.5);
  juice.flash(PICO8[8], 0.45, { x: hp.x, y: hp.y });
  juice.hitStop(0.4);
  dying = true; heroDown = true;
  pendingOutcome = 'LOST';
}

function applyEnemyAction(): void {
  if (!enemy || !battle) return;
  const r = enemyAct(hero, battle, Math.random);
  const hp = heroPos();
  curText = r.text; curColor = r.dodged ? C_TEXT : C_DMG_TAKEN;
  if (r.dodged) { audio.play('blip'); pushPop(hp.x, hp.y - 8, 'MISS', C_DIM); }
  else {
    pushPop(hp.x, hp.y - 8, `-${r.dmg}`, C_DMG_TAKEN);
    if (r.heroDead) { heroDies(r.text); return; }
    audio.play('hit');
    particles.burst(hp.x, hp.y, { count: 5, color: PICO8[8] });
    juice.shake(3, 0.25);
    juice.flash(PICO8[8], 0.2);
    if (r.revived) {
      juice.flash(C_ACCENT, 0.6, { x: hp.x, y: hp.y });
      particles.burst(hp.x, hp.y, { count: 16, color: C_ACCENT, speed: 140 });
      audio.play('pickup');
      curColor = C_ACCENT;
    }
  }
  if (r.reflected > 0) {
    const p = enemyPos();
    pushPop(p.x, p.y - 8, `-${r.reflected}`, PICO8[9]);
    particles.burst(p.x, p.y, { count: 5, color: PICO8[9] });
  }
  if (r.enemyDefeated) enemyDefeatedStep();
}

function applyHeroAction(action: HeroAction): void {
  if (!enemy || !battle) return;
  const e = enemy;
  const hp = heroPos();
  const turn = startTurn(hero);
  if (turn.mpRegen > 0) pushPop(hp.x, hp.y - 22, `+${turn.mpRegen} MP`, C_MP);
  if (turn.hpRegen > 0) pushPop(hp.x + 18, hp.y - 30, `+${turn.hpRegen} HP`, C_HP);
  if (turn.bloodLoss > 0) pushPop(hp.x - 16, hp.y - 30, `-${turn.bloodLoss}`, C_DMG_TAKEN);
  const r = heroAct(hero, battle, action, Math.random);
  curText = r.text; curColor = r.crit ? C_ACCENT : C_TEXT;
  const p = enemyPos();
  r.hits.forEach((h, i) => {
    const color = h.crit ? C_ACCENT : h.kind === 'MAGIC' ? PICO8[14] : C_TEXT;
    pushPop(p.x + (i - (r.hits.length - 1) / 2) * 26, p.y - 8 - i * 6, `-${h.dmg}${h.crit ? '!' : ''}`, color, h.crit ? 3 : 2);
  });
  if (r.hits.length) {
    if (r.crit) {
      audio.play('explosion'); juice.shake(4, 0.3); juice.flash(C_ACCENT, 0.3); juice.hitStop(0.08);
      particles.burst(p.x, p.y, { count: 12, color: C_ACCENT, speed: 130 });
    } else {
      audio.play('hit'); juice.shake(2, 0.2); juice.flash(C_ACCENT, 0.2);
      particles.burst(p.x, p.y, { count: 6, color: enemyColor(e.def.id) });
    }
  } else {
    audio.play('pickup');
    particles.burst(hp.x, hp.y, { count: 8, color: C_HP, speed: 60 });
  }
  if (r.healed > 0) pushPop(hp.x, hp.y - 14, `+${r.healed} HP`, C_HP);
  if (r.mpRestored > 0) pushPop(hp.x + 14, hp.y - 20, `+${r.mpRestored} MP`, C_MP);
  if (r.enemyDefeated) enemyDefeatedStep();
  else {
    push(0.7, () => { curText = `${e.def.name} PREPARES...`; curColor = C_DIM; });
    push(0.9, applyEnemyAction);
  }
}

function useAction(action: HeroAction): void {
  if (!enemy) return;
  if (!canAfford(hero, action)) {
    push(0.7, () => { curText = 'NOT ENOUGH MP!'; curColor = C_DIM; audio.play('blip'); });
    beginQueue();
    return;
  }
  push(0.9, () => applyHeroAction(action));
  beginQueue();
}

// --- Update ----------------------------------------------------------------------
const blinkHz = (hz: number): boolean => blink(clock, 1 / hz, 0.5) === 1;
const accentHz = (hz: number, duty = 0.2): boolean => blink(clock, 1 / hz, duty) === 1;

function updateMap(): void {
  const dy = dirEdge();
  if (dy) moveCursor(dy);
  if (input.pressed('A') && reachable.length) {
    audio.play('blip');
    selectNode(mapStages[curStage + 1][cursor]);
  }
}

function updateBattle(dt: number): void {
  if (dying) {
    if (!juice.frozen) {
      deathBiome = biome().name; dying = false;
      scenes.to('GAME_OVER');
    }
    return;
  }
  if (battlePhase === 'MENU') {
    const n = heroActions(hero).length;
    const dy = dirEdge();
    if (dy) { menuCursor = (menuCursor + dy + n) % n; audio.play('blip'); }
    if (input.pressed('A')) { audio.play('blip'); useAction(heroActions(hero)[menuCursor]); }
  } else {
    queueTimer -= dt;
    if (queueTimer <= 0 || input.pressed('A')) advanceQueueStep();
  }
}

function updateCard(): void {
  if (input.pressed('A')) { audio.play('blip'); cardOnDone(); }
}

function update(dt: number): void {
  clock += dt;
  juice.update(dt);
  particles.update(dt);
  updatePops(dt);

  switch (scenes.current) {
    case 'TITLE': { if (input.pressed('A')) { audio.play('blip'); startPlaying(); } break; }
    case 'PLAYING': {
      if (input.pressed('PAUSE')) { audio.play('blip'); scenes.to('PAUSED'); break; }
      switch (subScene) {
        case 'MAP': updateMap(); break;
        case 'BATTLE': updateBattle(dt); break;
        case 'LEVELUP': updateLevelUp(); break;
        case 'LOOT': updateLoot(); break;
        case 'CARD': updateCard(); break;
      }
      break;
    }
    case 'PAUSED': { if (input.pressed('PAUSE')) { audio.play('blip'); scenes.to('PLAYING'); } break; }
    case 'GAME_OVER':
    case 'WIN': { if (input.pressed('A')) { audio.play('blip'); startPlaying(); } break; }
  }
  input.endFrame();
}

// --- Rendering ---------------------------------------------------------------------
/** Filled isoceles triangle, apex up — for ice peaks. Integer rows, no AA. */
function fillPeak(ctx: CanvasRenderingContext2D, cx: number, baseY: number, halfW: number, height: number): void {
  for (let i = 0; i < height; i++) {
    const hw = Math.round((halfW * (i + 1)) / height);
    ctx.fillRect(cx - hw, baseY - height + i, hw * 2 + 1, 1);
  }
}

/** Filled half-disc (dune / sun), rows only. */
function fillDome(ctx: CanvasRenderingContext2D, cx: number, baseY: number, r: number, cap = r): void {
  for (let i = 0; i < cap; i++) {
    const y = baseY - cap + i;
    const dy = cap - i;
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(cx - hw, y, hw * 2 + 1, 1);
  }
}

/** Filled disc, rows only. */
function fillDisc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

/**
 * Far plane + silhouette plane for the current biome, both under the ambient
 * layer and both inside the ambient band vs the black void: silhouettes are
 * PICO8[1] (1.52:1) or a palette tone at reduced alpha (~2:1 max); the far
 * band is PICO8[1] at half alpha (~1.25:1). Tiny bright accents (torch
 * flames, gold caps) are the only things brighter, and they are 2-4 px.
 */
function renderBiomeBackdrop(): void {
  const ctx = pc.ctx;
  const flame = frameIndex(clock, 6, 2);
  switch (actIndex) {
    case 0: { // THE CRYPT — a low stone wall, four pillars, torch sconces.
      ctx.globalAlpha = 0.5; ctx.fillStyle = PICO8[1];
      ctx.fillRect(0, FLOOR_Y - 30, W, 30);
      ctx.globalAlpha = 1;
      for (const px of [14, 92, 148, 216]) {
        ctx.fillRect(px, 6, 10, FLOOR_Y - 6);
        ctx.fillRect(px - 2, 6, 14, 3);      // capital
        ctx.fillRect(px - 2, FLOOR_Y - 4, 14, 4); // plinth
      }
      for (const tx of [40, 120, 200]) {   // torches between the pillars
        ctx.fillStyle = PICO8[4]; ctx.fillRect(tx, 44, 2, 6);
        ctx.fillStyle = flame ? PICO8[9] : PICO8[10];
        ctx.fillRect(tx - 1 + flame, 38, 3, 4); ctx.fillRect(tx, 36 + flame, 2, 2);
      }
      break;
    }
    case 1: { // THE TUNDRA — a dark moon, a ridge of ice peaks, a snow-haze band.
      ctx.fillStyle = PICO8[1];
      fillDisc(ctx, 60, 36, 12);                       // moon
      ctx.fillStyle = PICO8[0]; fillDisc(ctx, 65, 33, 10); // crescent bite
      ctx.fillStyle = PICO8[1];
      const peaks: Array<[number, number, number]> = [[10, 26, 34], [48, 20, 24], [96, 30, 42], [140, 18, 20], [186, 26, 30], [232, 22, 26]];
      for (const [cx, hw, h] of peaks) fillPeak(ctx, cx, FLOOR_Y, hw, h);
      ctx.globalAlpha = 0.5; ctx.fillRect(0, FLOOR_Y - 18, W, 18); ctx.globalAlpha = 1;
      break;
    }
    case 2: { // THE DESERT — a huge low sun, two dune ridges, heat band.
      ctx.globalAlpha = 0.3; ctx.fillStyle = PICO8[9];
      fillDome(ctx, 150, FLOOR_Y - 34, 22, 22);       // low sun, half-set behind the far dune
      ctx.globalAlpha = 0.45; ctx.fillStyle = PICO8[4];
      fillDome(ctx, 40, FLOOR_Y, 90, 30); fillDome(ctx, 200, FLOOR_Y, 110, 24);
      ctx.globalAlpha = 0.6; fillDome(ctx, 130, FLOOR_Y, 70, 12);
      ctx.globalAlpha = 1;
      break;
    }
    default: { // HOLY TEMPLE — fluted marble columns with gold capitals, altar step.
      ctx.globalAlpha = 0.5; ctx.fillStyle = PICO8[1];
      ctx.fillRect(0, FLOOR_Y - 26, W, 26);
      ctx.globalAlpha = 0.7; ctx.fillStyle = PICO8[5];
      for (const cx of [22, 78, 162, 218]) {
        ctx.fillRect(cx - 6, 10, 12, FLOOR_Y - 10);
        ctx.fillStyle = PICO8[0]; ctx.fillRect(cx - 2, 16, 1, FLOOR_Y - 22); ctx.fillRect(cx + 2, 16, 1, FLOOR_Y - 22);
        ctx.fillStyle = PICO8[5];
        ctx.fillRect(cx - 8, 10, 16, 4); ctx.fillRect(cx - 8, FLOOR_Y - 5, 16, 5);
      }
      ctx.globalAlpha = 0.45; ctx.fillStyle = PICO8[10];
      for (const cx of [22, 78, 162, 218]) ctx.fillRect(cx - 8, 8, 16, 2);
      ctx.globalAlpha = 1;
      break;
    }
  }
}

/** Beveled biome floor with a single dithered lip — the one texture strip. */
function renderFloor(): void {
  const b = look();
  drawBevel(pc.ctx, 0, FLOOR_Y, W, H - FLOOR_Y, b.floor, b.floorLight, b.floorDark);
  fillDither(pc.ctx, 0, FLOOR_Y + 2, W, 2, b.floor, b.floorLight, 'sparse');
  fillDither(pc.ctx, 0, H - 10, W, 10, b.floor, b.floorDark, 'sparse');
}

/** Ground shadow + sprite, feet on FLOOR_Y. `phase` desyncs the two idle clocks. */
function drawActor(frames: Anim, cx: number, phase: number, fallen = false): void {
  const ctx = pc.ctx;
  const f = frames[frameIndex(clock + phase, 2, 2)];
  const sx = Math.round(cx - f.w / 2);
  const sy = FLOOR_Y - f.h;
  ctx.fillStyle = PICO8[0];
  ctx.fillRect(sx + 3, FLOOR_Y - 1, f.w - 6, 3);
  if (fallen) {
    // Death tableau: the knight lies on his back — a 90-degree rotate keeps pixels crisp.
    ctx.save();
    ctx.translate(sx + f.w / 2, FLOOR_Y);
    ctx.rotate(-Math.PI / 2);
    drawSprite(ctx, frames[0], 0, Math.round(-f.h / 2), 1);
    ctx.restore();
    return;
  }
  drawSprite(ctx, f, sx, sy, 1);
}

function drawBar(x: number, y: number, w: number, h: number, frac: number, color: string): void {
  const ctx = pc.ctx;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, Math.round(w * Math.max(0, Math.min(1, frac)))), h);
  drawFrame(ctx, x, y, w, h, PICO8[0], 1);
}

function drawLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string): void {
  const dx = x1 - x0; const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(x0 + (dx * i) / steps), Math.round(y0 + (dy * i) / steps), 1, 1);
  }
}


const ROOM_ICON: Record<RoomType, Sprite> = { FIGHT: fightIcon, ELITE: eliteIcon, REST: restIcon, LOOT: lootIcon, BOSS: bossIcon };
const ROOM_LABEL: Record<RoomType, string> = { FIGHT: 'FIGHT', ELITE: 'ELITE', REST: 'REST', LOOT: 'LOOT', BOSS: 'BOSS' };
const SLOT_ICON: Record<Slot, Sprite> = { WEAPON: ICON_SWORD, ARMOR: ICON_ARMOR, NECKLACE: ICON_NECKLACE, BOOTS: ICON_BOOTS, CHALICE: ICON_CHALICE, TOME: ICON_TOME };
function itemIcon(item: Item): Sprite { return item.slot === 'WEAPON' && item.weaponKind === 'MAGIC' ? ICON_WAND : SLOT_ICON[item.slot]; }

const STAGE_COUNT = STAGE_SIZES.length + 1;
function nodeX(stage: number): number { return SAFE_MARGIN + 14 + stage * ((W - 2 * SAFE_MARGIN - 28) / (STAGE_COUNT - 1)); }
function nodeY(_stage: number, slot: number, count: number): number {
  const spread = 28; const top = 64 - ((count - 1) * spread) / 2;
  return top + slot * spread;
}

/** Text that must fit a width: draws at scale 1, dropping trailing words if it would overflow. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, opts: { color: string; shadow?: boolean }): void {
  let t = text;
  while (t.length > 3 && textWidth(t, 1) > maxW) {
    const cut = t.lastIndexOf(' ');
    t = cut > 0 ? t.slice(0, cut) : t.slice(0, -1);
  }
  drawText(ctx, t, x, y, opts);
}
/** Split a battle-log line into at most two lines that fit `maxW`. */
function wrap2(text: string, maxW: number): string[] {
  if (textWidth(text, 1) <= maxW) return [text];
  const words = text.split(' ');
  let first = '';
  for (const w of words) {
    const t = first ? `${first} ${w}` : w;
    if (textWidth(t, 1) > maxW) break;
    first = t;
  }
  return [first, text.slice(first.length).trim()];
}

const pct = (n: number): string => `${Math.round(n)}%`;

/** Equipment strip (two rows of three slots) + HP/MP bars + derived stats. */
function drawStatusPanel(y: number): void {
  const ctx = pc.ctx;
  const d = derive(hero);
  drawPanel(pc, SAFE_MARGIN, y, W - 2 * SAFE_MARGIN, 46, { color: C_PANEL, border: C_BORDER });
  SLOTS.forEach((slot, i) => {
    const bx = SAFE_MARGIN + 5 + (i % 3) * 72;
    const by = y + 4 + Math.floor(i / 3) * 8;
    const item = hero.equipment[slot];
    drawSprite(ctx, item ? itemIcon(item) : ICON_EMPTY, bx, by, 1);
    drawText(ctx, item ? displayName(item, itemLevel(hero, slot)) : `NO ${slot}`, bx + 7, by, { color: item ? rarityColor(item) : PICO8[5] });
  });
  drawText(ctx, 'HP', SAFE_MARGIN + 5, y + 23, { color: C_TEXT });
  drawBar(SAFE_MARGIN + 15, y + 23, 40, 5, hero.hp / d.maxHp, hero.hp / d.maxHp < 0.25 ? C_HP_LOW : C_HP);
  drawText(ctx, `${hero.hp}/${d.maxHp}`, SAFE_MARGIN + 58, y + 23, { color: C_DIM });
  drawText(ctx, 'MP', SAFE_MARGIN + 92, y + 23, { color: C_TEXT });
  drawBar(SAFE_MARGIN + 102, y + 23, 40, 5, hero.mp / d.maxMp, C_MP);
  drawText(ctx, `${hero.mp}/${d.maxMp}`, SAFE_MARGIN + 145, y + 23, { color: C_DIM });
  const regen = [d.mpRegen ? `+${d.mpRegen}MP` : '', d.hpRegen ? `+${d.hpRegen}HP` : ''].filter(Boolean).join(' ');
  if (regen) drawText(ctx, `${regen}/TURN`, W - SAFE_MARGIN - 5 - textWidth(`${regen}/TURN`, 1), y + 23, { color: C_HP });
  const stats = `ATK ${d.atk} MAG ${d.mag} DEF ${pct(d.def)} MDEF ${pct(d.mdef)} CRIT ${pct(d.crit)} X${d.critMult.toFixed(1)} DGE ${pct(d.dodge)}`;
  fitText(ctx, stats, SAFE_MARGIN + 5, y + 34, W - 2 * SAFE_MARGIN - 10, { color: C_DIM });
}

function renderMap(): void {
  const ctx = pc.ctx;
  ctx.globalAlpha = 0.45; renderBiomeBackdrop(); ctx.globalAlpha = 1;
  particles.render(ctx);
  const header = `ACT ${actIndex + 1}  ${biome().name}`;
  drawTextCentered(ctx, header, W, SAFE_MARGIN, { color: C_ACCENT, shadow: true });
  drawTextCentered(ctx, 'CHOOSE YOUR PATH', W, SAFE_MARGIN + 8, { color: C_DIM, shadow: true });
  // Edges: a short horizontal stub out of the source, a diagonal, a stub into
  // the target — dim by default, white out of the current node, thick accent
  // to the cursor node, so "where does this path go" is answered by colour.
  const drawEdge = (s: number, node: MapNode, li: number, color: string, thick: boolean) => {
    const x0 = nodeX(s) + 11; const y0 = nodeY(s, node.slot, mapStages[s].length);
    const x1 = nodeX(s + 1) - 11; const y1 = nodeY(s + 1, li, mapStages[s + 1].length);
    drawLine(ctx, x0, y0, x0 + 3, y0, color);
    drawLine(ctx, x0 + 3, y0, x1 - 3, y1, color);
    drawLine(ctx, x1 - 3, y1, x1, y1, color);
    if (thick) { drawLine(ctx, x0, y0 + 1, x0 + 3, y0 + 1, color); drawLine(ctx, x0 + 3, y0 + 1, x1 - 3, y1 + 1, color); drawLine(ctx, x1 - 3, y1 + 1, x1, y1 + 1, color); }
  };
  const fromCurrent = (s: number, node: MapNode) => s === curStage && node === pendingNode;
  for (let s = 0; s < mapStages.length - 1; s++) {
    for (const node of mapStages[s]) for (const li of node.links) {
      if (!fromCurrent(s, node)) drawEdge(s, node, li, node.cleared ? C_DIM : PICO8[5], false);
    }
  }
  if (curStage >= 0 && pendingNode) {
    for (const li of pendingNode.links) drawEdge(curStage, pendingNode, li, li === cursor ? C_ACCENT : C_TEXT, li === cursor);
  }
  for (let s = 0; s < mapStages.length; s++) {
    const stage = mapStages[s];
    for (const node of stage) {
      const x = nodeX(s); const y = nodeY(s, node.slot, stage.length);
      const isReachable = s === curStage + 1 && reachable.includes(node.slot);
      const isCursor = isReachable && node.slot === cursor;
      const dim = node.cleared || s > curStage + 1 || (s === curStage + 1 && !isReachable);
      const glow = isCursor && accentHz(3, 0.5);
      const boxColor = isCursor ? (glow ? PICO8[7] : C_ACCENT) : dim ? PICO8[5] : C_DIM;
      drawBevel(ctx, x - 11, y - 11, 22, 20, node.cleared ? PICO8[0] : C_PANEL, isCursor ? C_ACCENT : PICO8[1], PICO8[0]);
      drawFrame(ctx, x - 11, y - 11, 22, 20, boxColor, 1);
      drawSprite(ctx, ROOM_ICON[node.type], x - 2, y - 8, 1);
      const label = ROOM_LABEL[node.type];
      drawText(ctx, label, x - textWidth(label, 1) / 2, y + 1, { color: boxColor, shadow: true });
      if (node.cleared) drawText(ctx, 'X', x - 2, y - 8, { color: C_DIM });
    }
  }
  drawStatusPanel(H - SAFE_MARGIN - 46);
  hudText(pc, `SCORE ${score}`, 'right', 'top', { color: C_TEXT });
}

function renderTableau(withEnemy: boolean, withHero = true): void {
  renderBiomeBackdrop();
  particles.render(pc.ctx);
  renderFloor();
  if (withHero) drawActor(heroFrames, HERO_X, 0, heroDown);
  if (withEnemy && enemy) drawActor(ENEMY_FRAMES[enemy.def.id], ENEMY_X, 0.25);
}

function renderHeroHud(d: Derived): void {
  const ctx = pc.ctx;
  drawPanel(pc, SAFE_MARGIN, SAFE_MARGIN, 132, 32, { color: C_PANEL, border: C_BORDER });
  drawText(ctx, 'HP', SAFE_MARGIN + 4, SAFE_MARGIN + 4, { color: C_TEXT });
  drawBar(SAFE_MARGIN + 16, SAFE_MARGIN + 4, 56, 5, hero.hp / d.maxHp, hero.hp / d.maxHp < 0.25 ? C_HP_LOW : C_HP);
  drawText(ctx, `${hero.hp}/${d.maxHp}`, SAFE_MARGIN + 76, SAFE_MARGIN + 4, { color: C_DIM });
  drawText(ctx, 'MP', SAFE_MARGIN + 4, SAFE_MARGIN + 12, { color: C_TEXT });
  drawBar(SAFE_MARGIN + 16, SAFE_MARGIN + 12, 56, 5, hero.mp / d.maxMp, C_MP);
  drawText(ctx, `${hero.mp}/${d.maxMp}`, SAFE_MARGIN + 76, SAFE_MARGIN + 12, { color: C_DIM });
  const line = `ATK ${d.atk} MAG ${d.mag} CRIT ${pct(d.crit)}`;
  drawText(ctx, line, SAFE_MARGIN + 4, SAFE_MARGIN + 22, { color: C_DIM });
  if (battle && battle.rampStacks > 0) {
    const ramp = `RAMP ${battle.rampStacks}`;
    drawText(ctx, ramp, SAFE_MARGIN + 128 - textWidth(ramp, 1), SAFE_MARGIN + 22, { color: PICO8[9] });
  }
}

function renderEnemyHud(): void {
  if (!enemy) return;
  const ctx = pc.ctx;
  const e = enemy;
  const tag = e.def.kind === 'BOSS' ? ' BOSS' : e.def.kind === 'ELITE' ? ' ELITE' : '';
  const nameW = textWidth(e.def.name + tag, 1);
  drawText(ctx, e.def.name, W - SAFE_MARGIN - nameW, SAFE_MARGIN + 9, { color: C_TEXT, shadow: true });
  if (tag) drawText(ctx, tag.trim(), W - SAFE_MARGIN - textWidth(tag.trim(), 1), SAFE_MARGIN + 9, { color: C_ACCENT, shadow: true });
  drawBar(W - SAFE_MARGIN - 80, SAFE_MARGIN + 17, 80, 5, e.hp / e.maxHp, e.hp / e.maxHp < 0.25 ? C_HP_LOW : C_HP);
  const atk = e.def.atkType === 'PHYSICAL' ? 'STRIKES' : 'HEXES';
  drawText(ctx, atk, W - SAFE_MARGIN - 80, SAFE_MARGIN + 24, { color: e.def.atkType === 'PHYSICAL' ? PICO8[9] : PICO8[14], shadow: true });
  const res = e.def.def >= e.def.mdef ? (e.def.def > 0 ? `RES PHYS ${e.def.def}%` : '') : `RES MAG ${e.def.mdef}%`;
  if (res) drawText(ctx, res, W - SAFE_MARGIN - textWidth(res, 1), SAFE_MARGIN + 24, { color: C_DIM, shadow: true });
}

function renderBattle(): void {
  renderTableau(true);
  const d = derive(hero);
  renderEnemyHud();
  hudText(pc, `SCORE ${score}`, 'right', 'top', { color: C_TEXT });
  renderHeroHud(d);

  if (battlePhase === 'MENU' && !heroDown) {
    // Up to 3 rows per column so the panel never climbs over the actors' feet.
    const actions = heroActions(hero);
    const rows = Math.min(3, actions.length);
    const cols = Math.ceil(actions.length / 3);
    const colW = (W - 2 * SAFE_MARGIN) / cols;
    const panelH = 10 + rows * 9;
    const panelY = H - SAFE_MARGIN - panelH;
    drawPanel(pc, SAFE_MARGIN, panelY, W - 2 * SAFE_MARGIN, panelH, { color: C_PANEL, border: C_BORDER });
    actions.forEach((a, i) => {
      const sel = i === menuCursor;
      const afford = canAfford(hero, a);
      const x0 = Math.round(SAFE_MARGIN + Math.floor(i / 3) * colW);
      const y = panelY + 5 + (i % 3) * 9;
      if (sel) { pc.ctx.fillStyle = C_SEL_BAR; pc.ctx.fillRect(x0 + 2, y - 2, Math.round(colW) - 4, 9); }
      const cost = a === 'ATTACK' ? 0 : spellCost(hero, a);
      const name = a === 'ATTACK' ? 'ATTACK' : SPELLS[a].name;
      const label = cost > 0 ? `${name} ${cost}MP` : `${name} FREE`;
      drawText(pc.ctx, (sel ? '> ' : '  ') + label, x0 + 5, y, { color: sel ? C_ACCENT : afford ? C_TEXT : PICO8[5], shadow: sel });
      const hex = Object.values(hero.equipment).some((it) => it && it.effect.kind === 'HEX_STRIKE');
      const kind = a === 'ATTACK'
        ? (hex || hero.equipment.WEAPON?.weaponKind === 'MAGIC' ? 'MAGIC' : 'PHYSICAL')
        : hex && a === 'SLASH' ? 'MAGIC' : SPELLS[a].kind;
      const res = enemy ? (kind === 'PHYSICAL' ? enemy.def.def : enemy.def.mdef) : 0;
      const isHeal = a !== 'ATTACK' && SPELLS[a].heal !== undefined;
      const info = a === 'ATTACK'
        ? (hero.equipment.WEAPON?.weaponKind === 'MAGIC' ? 'MAG x1.0' : 'ATK x1.0')
        : isHeal ? `HEAL ${Math.round(SPELLS[a].heal! * 100)}%`
          : `${SPELLS[a].scale} x${SPELLS[a].mult.toFixed(1)}${SPELLS[a].hits > 1 ? `x${SPELLS[a].hits}` : ''}`;
      const tag = !isHeal && res >= 20 ? ` -${res}%` : '';
      drawText(pc.ctx, info + tag, x0 + Math.round(colW) - 5 - textWidth(info + tag, 1), y, { color: tag ? PICO8[8] : sel ? C_TEXT : C_DIM });
    });
  } else {
    drawPanel(pc, SAFE_MARGIN, H - SAFE_MARGIN - 22, W - 2 * SAFE_MARGIN, 22, { color: C_PANEL, border: C_BORDER });
    const lines = wrap2(curText, W - 2 * SAFE_MARGIN - 10);
    if (lines.length === 1) drawTextCentered(pc.ctx, lines[0], W, H - SAFE_MARGIN - 15, { color: curColor, shadow: true });
    else {
      drawTextCentered(pc.ctx, lines[0], W, H - SAFE_MARGIN - 18, { color: curColor, shadow: true });
      drawTextCentered(pc.ctx, lines[1], W, H - SAFE_MARGIN - 10, { color: curColor, shadow: true });
    }
  }
  drawPops();
}

/** Damage / score numbers: scale 2 with a drop shadow, crits at scale 3 outlined. */
function drawPops(): void {
  for (const p of pops) {
    pc.ctx.globalAlpha = Math.min(1, Math.max(0, (p.life / POP_LIFE) * 1.6));
    drawText(pc.ctx, p.text, Math.round(p.x - textWidth(p.text, p.scale) / 2), Math.round(p.y), { color: p.color, scale: p.scale, shadow: p.scale < 3, outline: p.scale >= 3 });
  }
  pc.ctx.globalAlpha = 1;
}

function renderLevelUp(): void {
  renderTableau(false);
  const d = derive(hero);
  const ctx = pc.ctx;
  const panelY = SAFE_MARGIN + 2;
  const panelH = 62;
  drawPanel(pc, 16, panelY, W - 32, panelH, { color: C_PANEL, border: C_BORDER });
  const title = `LEVEL UP  +${luEarned} SP   ${hero.sp} TO SPEND`;
  drawTextCentered(ctx, title, W, panelY + 5, { color: C_ACCENT, shadow: true });
  const current: Record<StatKey, string> = {
    HP: String(d.maxHp), MP: String(d.maxMp), ATK: String(d.atk), MAG: String(d.mag), DEF: pct(d.def), MDEF: pct(d.mdef), CRIT: pct(d.crit),
  };
  const gainTxt: Record<StatKey, string> = { HP: '+5', MP: '+3', ATK: '+2', MAG: '+2', DEF: '+3%', MDEF: '+3%', CRIT: '+2%' };
  const colW = (W - 32) / 2;
  STAT_KEYS.forEach((k, i) => {
    const col = Math.floor(i / 4); const row = i % 4;
    const x0 = 16 + col * colW; const y = panelY + 16 + row * 9;
    const sel = i === luCursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(Math.round(x0) + 3, y - 2, Math.round(colW) - 6, 9); }
    drawText(ctx, `${sel ? '> ' : '  '}${k}`, Math.round(x0) + 6, y, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
    const v = `${current[k]} ${gainTxt[k]}`;
    drawText(ctx, v, Math.round(x0 + colW) - 6 - textWidth(v, 1), y, { color: sel ? C_TEXT : C_DIM });
  });
  drawTextCentered(ctx, `${BUTTON_KEY.A.hint} SPEND A POINT`, W, panelY + panelH - 9, { color: blinkHz(1.2) ? C_TEXT : C_DIM });
  drawPops();
}

function renderLoot(): void {
  renderTableau(false, false);
  const ctx = pc.ctx;
  const n = lootOffers.length;
  const panelY = SAFE_MARGIN;
  const panelH = 14 + (n + 1) * 8 + 4 + 26;
  const x0 = 16; const pw = W - 32;
  drawPanel(pc, x0, panelY, pw, panelH, { color: C_PANEL, border: C_BORDER });
  const title = lootSource === 'LOOT' ? 'A CHEST  TAKE ONE OR LEAVE IT' : lootSource === 'FIGHT' ? 'IT DROPPED SOMETHING' : lootSource === 'BOSS' ? 'THE BOSS HOARD  CHOOSE ONE' : 'ELITE SPOILS  CHOOSE ONE';
  drawTextCentered(ctx, title, W, panelY + 5, { color: C_ACCENT, shadow: true });
  for (let i = 0; i <= n; i++) {
    const y = panelY + 14 + i * 8;
    const sel = i === lootCursor;
    if (sel) { ctx.fillStyle = C_SEL_BAR; ctx.fillRect(x0 + 3, y - 2, pw - 6, 9); }
    drawText(ctx, sel ? '>' : ' ', x0 + 6, y, { color: C_ACCENT });
    if (i < n && lootOffers[i].kind === 'SCROLL') {
      const offer = lootOffers[i] as { kind: 'SCROLL'; spell: SpellId };
      drawSprite(ctx, ICON_TOME, x0 + 14, y - 1, 1);
      drawText(ctx, `SCROLL OF ${SPELLS[offer.spell].name}`, x0 + 22, y, { color: PICO8[12], shadow: sel });
      drawText(ctx, 'LEARN A SPELL', x0 + 88, y, { color: C_DIM });
      drawText(ctx, 'SCROLL', x0 + pw - 6 - textWidth('SCROLL', 1), y, { color: PICO8[12] });
    } else if (i < n) {
      const offer = lootOffers[i] as Exclude<LootOffer, { kind: 'SCROLL' }>;
      const item = offer.item;
      drawSprite(ctx, itemIcon(item), x0 + 14, y - 1, 1);
      if (offer.kind === 'ITEM') {
        const owned = hero.equipment[item.slot];
        drawText(ctx, item.name, x0 + 22, y, { color: rarityColor(item), shadow: sel });
        drawText(ctx, owned ? `VS ${displayName(owned, itemLevel(hero, item.slot))}` : `${item.slot} SLOT`, x0 + 88, y, { color: C_DIM });
        drawText(ctx, item.rarity, x0 + pw - 6 - textWidth(item.rarity, 1), y, { color: rarityColor(item) });
      } else {
        drawText(ctx, displayName(item, offer.toLevel), x0 + 22, y, { color: C_ACCENT, shadow: sel });
        drawText(ctx, offer.toLevel >= 2 ? 'AWAKEN YOUR GEAR' : 'IMPROVE YOUR GEAR', x0 + 88, y, { color: C_DIM });
        drawText(ctx, 'UPGRADE', x0 + pw - 6 - textWidth('UPGRADE', 1), y, { color: C_ACCENT });
      }
    } else {
      drawText(ctx, 'KEEP YOUR GEAR', x0 + 12, y, { color: sel ? C_ACCENT : C_TEXT, shadow: sel });
      drawText(ctx, 'MEND 25% HP AND MP', x0 + pw - 6 - textWidth('MEND 25% HP AND MP', 1), y, { color: C_DIM });
    }
  }
  const dy = panelY + 14 + (n + 1) * 8 + 4;
  ctx.fillStyle = PICO8[5]; ctx.fillRect(x0 + 6, dy - 3, pw - 12, 1);
  if (lootCursor < n) {
    const offer = lootOffers[lootCursor];
    const lines = describeOffer(hero, offer);
    const blurbColor = offer.kind === 'SCROLL' ? PICO8[12] : offer.kind === 'UPGRADE' ? C_ACCENT : offer.item.effect.kind === 'NONE' ? C_DIM : rarityColor(offer.item);
    fitText(ctx, lines[0] ?? '', x0 + 6, dy, pw - 12, { color: C_TEXT });
    fitText(ctx, lines[1] ?? '', x0 + 6, dy + 8, pw - 12, { color: blurbColor });
    fitText(ctx, compareOffer(hero, offer), x0 + 6, dy + 16, pw - 12, { color: C_DIM });
  } else {
    drawText(ctx, 'NOTHING HERE FITS YOUR BUILD?', x0 + 6, dy, { color: C_DIM });
    drawText(ctx, 'TAKE THE MEND AND MOVE ON.', x0 + 6, dy + 8, { color: C_DIM });
  }
}

function renderCard(): void {
  renderTableau(false);
  dimScene(pc, 0.6);
  const h = 26 + cardLines.length * 12;
  const y = 30;
  drawFrame(pc.ctx, 26, y, W - 52, h, C_BORDER, 1);
  cardLines.forEach((line, i) => drawTextCentered(pc.ctx, line, W, y + 8 + i * 12, { color: i === 0 ? C_ACCENT : C_TEXT, shadow: true }));
  drawTextCentered(pc.ctx, `${BUTTON_KEY.A.hint} CONTINUE`, W, y + h - 10, { color: blinkHz(1.2) ? C_TEXT : C_DIM });
}

function renderTitle(): void {
  renderBiomeBackdrop(); particles.render(pc.ctx); renderFloor();
  // Hero as a poster prop at px 2 — its keyline is PICO8[0] on the black void
  // (1:1), so scaling the row-authored keyline is legal here.
  const hf = heroFrames[frameIndex(clock, 2, 2)];
  pc.ctx.fillStyle = PICO8[0]; pc.ctx.fillRect(HERO_X - hf.w + 6, FLOOR_Y - 1, hf.w * 2 - 12, 3);
  drawSprite(pc.ctx, hf, HERO_X - hf.w, FLOOR_Y - hf.h * 2, 2);
  drawActor(ENEMY_FRAMES.SLIME, 170, 0.5);
  drawLogo(pc.ctx, 'EMBER QUEST', W, 12, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 3 });
  drawTextCentered(pc.ctx, 'A ROGUELIKE DESCENT', W, 34, { color: C_DIM, shadow: true });
  drawTextCentered(pc.ctx, 'FOUR ACTS  ONE LIFE  YOUR BUILD', W, 44, { color: C_TEXT, shadow: true });
  drawTextCentered(pc.ctx, `PRESS ${BUTTON_KEY.A.hint} TO DESCEND`, W, 122, { color: blinkHz(1.2) ? C_ACCENT : C_TEXT, shadow: true });
  const hintOpts = { color: C_DIM, shadow: true };
  drawTextCentered(pc.ctx, 'UP/DOWN  MOVE CURSOR', W, 134, hintOpts);
  controlHints(input).forEach((h, i) => drawTextCentered(pc.ctx, h, W, 142 + i * 8, hintOpts));
  if (best > 0) hudText(pc, `BEST ${best}`, 'right', 'top', { color: C_DIM });
}

/** The PLAYING world for whatever sub-screen is active — also drawn as context under PAUSED / GAME_OVER / WIN. */
function renderPlaying(): void {
  switch (subScene) {
    case 'MAP': renderMap(); break;
    case 'BATTLE': renderBattle(); break;
    case 'LEVELUP': renderLevelUp(); break;
    case 'LOOT': renderLoot(); break;
    case 'CARD': renderCard(); break;
  }
}

function renderEnding(headline: string, headColor: string, sub: string): void {
  renderPlaying();
  dimScene(pc, 0.6);
  drawFrame(pc.ctx, 26, 42, W - 52, 76, C_BORDER, 1);
  drawTextCentered(pc.ctx, sub, W, 50, { color: C_DIM, shadow: true });
  drawTextCentered(pc.ctx, headline, W, 60, { color: headColor, scale: 2 });
  drawTextCentered(pc.ctx, `${clears} ENCOUNTERS CLEARED`, W, 78, { color: C_TEXT, shadow: true });
  const build = SLOTS.map((sl) => (hero.equipment[sl] ? displayName(hero.equipment[sl]!, itemLevel(hero, sl)) : '')).filter(Boolean).join(' ') || 'NO GEAR';
  fitText(pc.ctx, build, Math.max(30, Math.round((W - Math.min(W - 60, textWidth(build, 1))) / 2)), 86, W - 60, { color: C_DIM, shadow: true });
  drawTextCentered(pc.ctx, `SCORE ${score}   ${beatBest ? 'NEW BEST' : `BEST ${best}`}`, W, 95, { color: beatBest ? C_ACCENT : C_DIM, shadow: true });
  drawTextCentered(pc.ctx, `${BUTTON_KEY.A.hint} DESCEND AGAIN`, W, 106, { color: blinkHz(1.2) ? C_TEXT : C_DIM, shadow: true });
}

function render(): void {
  pc.clear(C_BG);
  juice.preRender(pc.ctx);
  switch (scenes.current) {
    case 'TITLE': renderTitle(); break;
    case 'PLAYING': renderPlaying(); break;
    case 'PAUSED': {
      renderPlaying();
      dimScene(pc, 0.6);
      hudText(pc, 'PAUSED', 'center', 'middle', { color: C_ACCENT, scale: 2, plate: false });
      drawTextCentered(pc.ctx, `${BUTTON_KEY.PAUSE.hint} RESUME`, W, 96, { color: C_DIM, shadow: true });
      break;
    }
    case 'GAME_OVER': renderEnding(deathBiome, PICO8[8], 'YOU DIED IN'); break;
    case 'WIN': renderEnding('VICTORY', C_ACCENT, 'THE SERAPH IS UNMADE'); break;
  }
  juice.postRender(pc.ctx, W, H);
  crt.render(pc.ctx, W, H, 1 / 60);
}

createLoop({ update, render }).start();
