import { PICO8 } from '../../engine';
import type { AffixId, EnemyActResult, EnemyInstance, HeroAction, HeroActResult, HeroCommand, TurnStart } from '../types';
import { SPELLS } from '../data';
import { canAfford, createBattle, enemyAct, heroAct, isSpell, spawnFoe, startTurn } from '../sim';
import { BRACE_DUR, bannerBlocks, cue, dismissBanner, fadeProgress, flushFx, resetFx, skipToImpact, updateFx } from '../fx';
import { biome, foeScale, resetCursorEdge } from '../state';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_HP, C_LOG_HURT, C_MP, C_TEXT, heroPos } from '../theme';
import { MOTES_FLIGHT, deathFx, lastHitDelay, defeatFx, entranceFx, heroImpact, heroWindup, popHero, prepareFx, regenAura } from './battle-fx';
import { enemyImpact, enemyWindup, reviveFx } from './battle-fx-enemy';
import type { PopSpec } from './battle-fx';
import { fxBreak, fxBurnTick, fxBurst, fxGuard, fxPhase, fxPotion, fxResist, fxRiposte, fxWeak } from './battle-fx-verbs';
import { clampMenuCursor, menuChoice } from './battle-menu';
import { clearPops, pushPop, scoreSpot } from '../pops';

export function startBattle(g: Game, id: string, onWin: () => void, affixes: readonly AffixId[] = []): void {
  const enemy = spawnFoe(id, { ...foeScale(g), hero: g.hero, affixes });
  const { magicCursor } = g.battle;
  g.battle = {
    enemy, state: createBattle(enemy), onWon: onWin,
    phase: 'MENU', menuCursor: 0, menu: 'TOP', topCursor: 0, magicCursor, magicPage: 0, outcome: 'NONE',
    queue: [], timer: 0, text: '', color: C_TEXT, bufferedA: false,
  };
  g.subScene = 'BATTLE';
  clearPops(g);
  resetFx(g);
  clampMenuCursor(g);
  entranceFx(g, enemy);
  if (enemy.def.kind !== 'NORMAL') {say(g, `${enemy.def.name} BARS THE WAY!`, C_ACCENT);}
  resetCursorEdge(g);
}

function push(g: Game, hold: number, run: () => void): void { g.battle.queue.push({ hold, run }); }

function say(g: Game, text: string, color: string): void { g.battle.text = text; g.battle.color = color; }

function beginQueue(g: Game): void { g.battle.phase = 'QUEUE'; advanceQueueStep(g); }

function advanceQueueStep(g: Game): void {
  if (g.battle.queue.length === 0 && g.battle.outcome === 'WON') { onQueueDone(g); return; }
  flushFx(g);
  const step = g.battle.queue.shift();
  if (!step) { onQueueDone(g); return; }
  step.run();
  g.battle.timer = step.hold;
}

export function onQueueDone(g: Game): void {
  const b = g.battle;
  b.bufferedA = false;
  if (b.outcome === 'LOST') {return;}
  if (b.outcome === 'WON') {
    b.outcome = 'NONE';
    const cb = b.onWon;
    b.enemy = null; b.state = null;
    b.phase = 'MENU';
    resetFx(g);
    cb();
    return;
  }
  b.phase = 'MENU';
  clampMenuCursor(g);
}

const DEFEAT_HOLD = 1.0;
const PREPARE_DELAY = 0.2;
const ENEMY_TURN_HOLD = 0.8;
const DEFEAT_SAY_DELAY = 0.4;

function enemyDefeated(g: Game, e: EnemyInstance, lastHit = 0): void {
  cue(g, lastHit, () => {
    defeatFx(g, e);
    pushPop(g.pops, scoreSpot(), '+100', C_ACCENT);
  });
  cue(g, lastHit + DEFEAT_SAY_DELAY, () => { say(g, `${e.def.name} DEFEATED!`, C_ACCENT); });
  g.battle.outcome = 'WON';
  g.battle.queue.length = 0;
  g.battle.timer = lastHit + DEFEAT_HOLD;
}

function heroDies(g: Game, text: string): void {
  const hp = heroPos();
  const { audio, particles, juice } = g.app;
  say(g, text, C_LOG_HURT);
  audio.play('explosion');
  particles.burst(hp.x, hp.y, { count: 14, color: PICO8[8], speed: 150 });
  juice.shake(6, 0.5);
  juice.flash(PICO8[8], 0.45, { x: hp.x, y: hp.y });
  juice.hitStop(0.4);
  g.dying = true; g.heroDown = true;
  g.battle.outcome = 'LOST';
  deathFx(g);
}

const LOG_MAX = 52;
const PARRY_TAIL = 'YOUR NEXT STRIKE HITS HARDER';

function withTail(text: string, tail: string): string {
  const joined = text.replace(/!$/, '') + tail;
  return joined.length <= LOG_MAX ? joined : text;
}

function withHead(head: string, text: string): string {
  return head.length + text.length <= LOG_MAX ? head + text : text;
}

function enemyLine(r: EnemyActResult): string {
  if (r.heroDead || r.revived) {return r.text;}
  if (r.parried) {return r.dodged ? `DODGED AND PARRIED! ${PARRY_TAIL}` : `PARRIED FOR ${String(r.dmg)}! ${PARRY_TAIL}`;}
  if (r.guarded && !r.dodged && r.dmg > 0) {return `YOU BRACE. THE BLOW GLANCES OFF FOR ${String(r.dmg)}!`;}
  return r.burned ? withTail(r.text, ' - YOU BURN!') : r.text;
}

function enemyLineColor(r: EnemyActResult): string {
  if (r.revived || r.parried) {return C_ACCENT;}
  return r.dmg > 0 && !r.guarded ? C_LOG_HURT : C_TEXT;
}

const PHASE_DELAY = 0.4;

export function applyEnemyAction(g: Game): void {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return;}
  const r = enemyAct(g.hero, state, g.rng);
  say(g, enemyLine(r), enemyLineColor(r));
  enemyImpact(g, r);
  g.fx.guardSpent = true;
  if (r.heroDead) { heroDies(g, r.text); return; }
  if (r.enemyDefeated) { enemyDefeated(g, enemy); return; }
  if (r.phaseChanged) {cue(g, PHASE_DELAY, () => { fxPhase(g, enemy); });}
}

function enemyStep(g: Game, e: EnemyInstance): void {
  cue(g, enemyWindup(g, e), () => { applyEnemyAction(g); }, true);
}

function turnStartPops(turn: TurnStart): PopSpec[] {
  const specs: PopSpec[] = [];
  if (turn.mpRegen > 0) {specs.push({ text: `+${turn.mpRegen} MP`, color: C_MP });}
  if (turn.hpRegen > 0) {specs.push({ text: `+${turn.hpRegen} HP`, color: C_HP });}
  if (turn.bloodLoss > 0) {specs.push({ text: `-${turn.bloodLoss}`, color: C_DMG_TAKEN });}
  return specs;
}

const BIG_BEAT_HOLD = 0.6;
const BREAK_SAY_DELAY = 0.5;

function heroHold(action: HeroAction, r: HeroActResult): number {
  const base = Math.max(PREPARE_DELAY + lastHitDelay(r.hits.length), r.healed > 0 ? MOTES_FLIGHT : 0);
  return action === 'BURST' || r.broke ? Math.max(base, BIG_BEAT_HOLD) : base;
}

function sayHeroResult(g: Game, r: HeroActResult, riposte: boolean): void {
  if (riposte) { say(g, withHead('RIPOSTE! ', r.text), C_ACCENT); return; }
  say(g, r.text, r.crit ? C_ACCENT : C_TEXT);
}

function landHeroAction(g: Game, action: HeroAction, slot: number): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const preHp = e.hp;
  const armed = state.riposte && action !== 'BURST';
  const r = heroAct(g.hero, state, action, g.rng);
  g.fx.guardSpent = false;
  const riposte = armed && r.hits.length > 0;
  sayHeroResult(g, r, riposte);
  heroImpact(g, { action, result: r, slot, preHp, riposte });
  verbFx(g, action, r);
  if (riposte) {fxRiposte(g);}
  if (r.enemyDefeated) { enemyDefeated(g, e, lastHitDelay(r.hits.length)); return; }
  if (r.broke) {cue(g, BREAK_SAY_DELAY, () => { say(g, `BREAK! ${e.def.name} LOSES ITS TURN`, C_ACCENT); });}
  g.battle.timer = heroHold(action, r);
  push(g, BRACE_DUR, () => { prepareFx(g); });
  push(g, ENEMY_TURN_HOLD, () => { enemyStep(g, e); });
}

const elementOf = (action: HeroAction) => (isSpell(action) ? SPELLS[action].element : undefined);

function hitVerbFx(g: Game, action: HeroAction, r: HeroActResult): void {
  const slot = action === 'BURST' ? 2 : r.hits.length;
  if (r.broke) { fxBreak(g, slot); return; }
  if (r.weak) {fxWeak(g, elementOf(action), slot);}
  if (r.resisted) {fxResist(g, slot);}
}

function verbFx(g: Game, action: HeroAction, r: HeroActResult): void {
  if (r.guarded) {fxGuard(g);}
  if (action === 'POTION' && r.healed > 0) {fxPotion(g);}
  if (action === 'BURST' && r.hits.length > 0) {fxBurst(g);}
  if (r.hits.length > 0) {hitVerbFx(g, action, r);}
}

const VERB_SAY: Record<Exclude<HeroCommand, 'ATTACK'>, string> = { GUARD: 'HERO GUARDS!', BURST: 'EMBER BURST!', POTION: 'HERO DRINKS A POTION!' };

function announce(action: HeroAction): string {
  if (action === 'ATTACK') {return 'HERO ATTACKS!';}
  return isSpell(action) ? `HERO CASTS ${SPELLS[action].name}!` : VERB_SAY[action];
}

function burnLine(turn: TurnStart, e: EnemyInstance): string {
  const parts: string[] = [];
  if (turn.heroBurn > 0) {parts.push(`YOU BURN FOR ${String(turn.heroBurn)}`);}
  if (turn.enemyBurn > 0) {parts.push(`${e.def.name} BURNS FOR ${String(turn.enemyBurn)}`);}
  return parts.join(', ');
}

function turnLine(turn: TurnStart, e: EnemyInstance, announced: string): string {
  const burn = burnLine(turn, e);
  if (!burn) {return announced;}
  const joined = `${burn} - ${announced}`;
  return joined.length <= LOG_MAX ? joined : `${burn}!`;
}

function heroStep(g: Game, action: HeroAction): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const turn = startTurn(g.hero, state, action);
  const turnPops = turnStartPops(turn);
  say(g, turnLine(turn, e, announce(action)), C_DIM);
  popHero(g, turnPops);
  if (turnPops.length) {regenAura(g);}
  if (turn.heroBurn > 0 || turn.enemyBurn > 0) {fxBurnTick(g, turn, turnPops.length);}
  if (turn.revived) {reviveFx(g);}
  if (turn.heroDead) { heroDies(g, 'THE FLAMES TAKE YOU!'); return; }
  if (turn.enemyDefeated) { enemyDefeated(g, e); return; }
  const slot = turnPops.length + (turn.heroBurn > 0 ? 1 : 0);
  cue(g, heroWindup(g, action), () => { landHeroAction(g, action, slot); }, true);
}

function useAction(g: Game, action: HeroAction): void {
  if (!g.battle.enemy) {return;}
  g.fx.note = null;
  if (!canAfford(g.hero, action)) {
    push(g, 0.7, () => { say(g, 'NOT ENOUGH MP!', C_DIM); g.app.audio.play('blip'); });
    beginQueue(g);
    return;
  }
  push(g, 0.9, () => { heroStep(g, action); });
  beginQueue(g);
}

function consumeA(g: Game): boolean {
  const hit = g.app.input.pressed('A') || g.battle.bufferedA;
  g.battle.bufferedA = false;
  return hit;
}

function updateMenu(g: Game): void {
  if (bannerBlocks(g)) {
    resetCursorEdge(g);
    if (consumeA(g)) {dismissBanner(g);}
    return;
  }
  const chosen = menuChoice(g, consumeA(g));
  if (chosen) {useAction(g, chosen);}
}

function updateDying(g: Game, dt: number): void {
  if (g.app.juice.frozen) {return;}
  updateFx(g, dt);
  if (fadeProgress(g.fx, g.fx.fall) < 1) {return;}
  g.deathBiome = biome(g).name; g.dying = false;
  clearPops(g);
  resetFx(g);
  g.app.scenes.to('GAME_OVER');
}

function updateQueue(g: Game, dt: number): void {
  g.battle.timer -= dt;
  if (!consumeA(g)) {
    if (g.battle.timer <= 0) {advanceQueueStep(g);}
    return;
  }
  const before = g.battle.timer;
  const skipped = skipToImpact(g);
  if (skipped === null) { advanceQueueStep(g); return; }
  if (g.battle.timer === before) {g.battle.timer -= skipped;}
}

export function updateBattle(g: Game, dt: number): void {
  if (g.dying) { updateDying(g, dt); return; }
  if (g.app.juice.frozen) {
    if (g.app.input.pressed('A')) {g.battle.bufferedA = true;}
    return;
  }
  updateFx(g, dt);
  if (g.battle.phase === 'MENU') {updateMenu(g); return;}
  updateQueue(g, dt);
}
