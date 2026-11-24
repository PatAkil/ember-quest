import { PICO8 } from '../../engine';
import type { AffixId, BattleState, EnemyActResult, EnemyInstance, HeroAction, HeroActResult, HeroCommand, TurnStart } from '../types';
import { SPELLS } from '../data';
import { canAfford, createBattle, enemyAct, heroAct, isSpell, spawnFoe, startTurn } from '../sim';
import { adoptTurn, commitTurn, mirrorRng } from './battle-commit';
import { BRACE_DUR, bannerBlocks, bannerDur, clearNote, cue, dismissBanner, fadeProgress, flushFx, fxBusy, resetFx, skipToImpact, updateFx } from '../fx';
import { armA, biome, foeScale, resetCursorEdge, takeA } from '../state';
import type { BattleWin, Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_HP, C_LOG_HURT, C_MP, C_TEXT, C_WARN, heroPos } from '../theme';
import { MOTES_FLIGHT, deathFx, lastHitDelay, defeatFx, entranceFx, heroImpact, heroWindup, popHero, prepareFx, regenAura } from './battle-fx';
import { enemyImpact, enemyWindup, reviveFx } from './battle-fx-enemy';
import type { PopSpec } from './battle-fx';
import { fxBreak, fxBurnTick, fxBurst, fxGuard, fxPhase, fxPotion, fxResist, fxRiposte, fxWeak } from './battle-fx-verbs';
import { clampMenuCursor, menuChoice, reopenMenu } from './battle-menu';
import { fxSlipsAway, fxThorns } from './battle-fx-affix';
import { clearPops, pushPop, scoreSpot } from '../pops';
import { markResumed, noteLog, noteVerb, recordBlow, recordBurn, recordThorns, resetDeath } from './battle-death';

function openBattle(g: Game, state: BattleState, win: BattleWin): void {
  const { magicCursor } = g.battle;
  g.battle = {
    enemy: state.enemy, state, onKill: win.kill, onWon: win.done,
    phase: 'MENU', menuCursor: 0, menu: 'TOP', topCursor: 0, magicCursor, magicPage: 0, outcome: 'NONE',
    queue: [], timer: 0, text: '', color: C_TEXT, bufferedA: false, committed: null,
  };
  g.subScene = 'BATTLE';
  resetDeath(g);
  clearPops(g);
  resetFx(g);
  clampMenuCursor(g);
  resetCursorEdge(g);
  armA(g);
}

export function startBattle(g: Game, id: string, win: BattleWin, affixes: readonly AffixId[] = []): void {
  const enemy = spawnFoe(id, { ...foeScale(g), hero: g.hero, affixes });
  openBattle(g, createBattle(enemy), win);
  entranceFx(g, enemy);
  if (enemy.def.kind !== 'NORMAL') {say(g, `${enemy.def.name} BARS THE WAY!`, C_ACCENT);}
}

export function resumeBattle(g: Game, state: BattleState, win: BattleWin): void {
  openBattle(g, state, win);
  markResumed(g);
  say(g, `THE FIGHT WITH ${state.enemy.def.name} GOES ON`, C_DIM);
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
  adoptTurn(g);
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
  reopenMenu(g);
}

const DEFEAT_HOLD = 1.0;
const PREPARE_DELAY = 0.2;
const ENEMY_TURN_HOLD = 0.8;
const DEFEAT_SAY_DELAY = 0.4;

function enemyDefeated(g: Game, e: EnemyInstance, lastHit = 0): void {
  g.battle.onKill();
  cue(g, lastHit, () => { adoptTurn(g); });
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
  adoptTurn(g);
  g.battle.outcome = 'LOST';
  deathFx(g);
}

const LOG_MAX = 52;
const PARRY_TAIL = 'YOUR NEXT STRIKE HITS HARDER';

function withHead(head: string, text: string): string {
  return head.length + text.length <= LOG_MAX ? head + text : text;
}

function enemyLine(r: EnemyActResult): string {
  if (r.heroDead || r.revived) {return r.text;}
  if (r.parried && r.dodged) {return `DODGED AND PARRIED! ${PARRY_TAIL}`;}
  return r.text;
}

function enemyLineColor(r: EnemyActResult): string {
  if (r.revived || r.parried) {return C_ACCENT;}
  return r.dmg > 0 && !r.guarded ? C_LOG_HURT : C_TEXT;
}

const PHASE_DELAY = 0.4;
const BURN_DELAY = 0.45;
const BURN_TAIL = 0.45;
const ROSE = 'YOU RISE!';
const rose = (text: string): boolean => text.endsWith(ROSE);

function foeBurns(g: Game, enemy: EnemyInstance, r: EnemyActResult): void {
  cue(g, BURN_DELAY, () => { fxBurnTick(g, 'ENEMY', r.burnTick, 0); say(g, r.burnText, C_TEXT); noteLog(g, r.burnText); });
  if (r.enemyDefeated) { enemyDefeated(g, enemy, BURN_DELAY); return; }
  g.battle.timer = Math.max(g.battle.timer, BURN_DELAY + BURN_TAIL);
}

function asideAt(r: EnemyActResult): number {
  const afterBurn = r.burnTick > 0 ? BURN_DELAY + BURN_TAIL : PHASE_DELAY;
  return r.phaseChanged ? Math.max(afterBurn, PHASE_DELAY + bannerDur()) : afterBurn;
}

function foeAside(g: Game, r: EnemyActResult): void {
  if (!r.aside) {return;}
  const at = asideAt(r);
  cue(g, at, () => { say(g, r.aside, C_WARN); noteLog(g, r.aside); });
  g.battle.timer = Math.max(g.battle.timer, at + BURN_TAIL);
}

function foeTail(g: Game, enemy: EnemyInstance, r: EnemyActResult): void {
  if (r.burnTick > 0) {foeBurns(g, enemy, r);} else if (r.enemyDefeated) {enemyDefeated(g, enemy);}
  if (!r.enemyDefeated) {foeAside(g, r);}
}

export function applyEnemyAction(g: Game): void {
  const { enemy, state } = g.battle;
  if (!enemy || !state) {return;}
  const r = enemyAct(g.hero, state, mirrorRng(g, 'FOE'));
  say(g, enemyLine(r), enemyLineColor(r));
  enemyImpact(g, r);
  g.fx.guardSpent = true;
  if (r.heroDead) { recordBlow(g, enemy, r); heroDies(g, r.text); return; }
  noteLog(g, enemyLine(r));
  if (r.phaseChanged) {cue(g, PHASE_DELAY, () => { fxPhase(g, enemy); });}
  foeTail(g, enemy, r);
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
  if (!r.heroDead) {noteLog(g, riposte ? withHead('RIPOSTE! ', r.text) : r.text);}
  if (riposte) { say(g, withHead('RIPOSTE! ', r.text), C_ACCENT); return; }
  say(g, r.text, r.crit ? C_ACCENT : C_TEXT);
}

function heroBurns(g: Game, e: EnemyInstance, r: HeroActResult, at: { delay: number; slot: number }): void {
  cue(g, at.delay, () => {
    fxBurnTick(g, 'HERO', r.burnTick, at.slot);
    noteLog(g, r.burnText);
    if (r.heroDead) { recordBurn(g, e, r.burnTick); heroDies(g, r.burnText); return; }
    const rise = rose(r.burnText);
    if (rise) {reviveFx(g);}
    say(g, r.burnText, rise ? C_ACCENT : C_LOG_HURT);
  });
}

function landHeroAction(g: Game, action: HeroAction, slot: number): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const preHp = e.hp;
  const armed = state.riposte && action !== 'BURST';
  const r = heroAct(g.hero, state, action, mirrorRng(g, 'HERO'));
  state.turn += 1;
  g.fx.guardSpent = false;
  const riposte = armed && r.hits.length > 0;
  sayHeroResult(g, r, riposte);
  heroImpact(g, { action, result: r, slot, preHp, riposte });
  verbFx(g, action, r);
  if (riposte) {fxRiposte(g);}
  if (affixFx(g, r, slot)) { recordThorns(g, e, r.thorns); return; }
  if (r.enemyDefeated) { enemyDefeated(g, e, lastHitDelay(r.hits.length)); return; }
  heroTail(g, { e, action, r, slot });
}

interface Landed { e: EnemyInstance; action: HeroAction; r: HeroActResult; slot: number }

function heroTail(g: Game, landed: Landed): void {
  const { e, action, r, slot } = landed;
  if (r.broke) {cue(g, BREAK_SAY_DELAY, () => { say(g, `BREAK! ${e.def.name} LOSES ITS TURN`, C_ACCENT); });}
  const hold = heroHold(action, r);
  g.battle.timer = r.burnTick > 0 ? hold + BURN_DELAY + BURN_TAIL : hold;
  if (r.burnTick > 0) {heroBurns(g, e, r, { delay: hold + BURN_DELAY, slot: slot + 1 });}
  if (r.heroDead) {return;}
  push(g, BRACE_DUR, () => { prepareFx(g); });
  push(g, ENEMY_TURN_HOLD, () => { enemyStep(g, e); });
}

function affixFx(g: Game, r: HeroActResult, slot: number): boolean {
  if (r.missed) {fxSlipsAway(g, slot);}
  const byThorns = r.heroDead && r.burnTick === 0;
  if (r.thorns > 0) {fxThorns(g, { amount: r.thorns, hits: r.hits.length, then: () => { thornsLine(g, r, byThorns); } });}
  if (byThorns) { noteLog(g, r.thornsText); heroDies(g, r.thornsText || r.text); return true; }
  return false;
}

function thornsLine(g: Game, r: HeroActResult, fatal: boolean): void {
  if (fatal || !r.thornsText) {return;}
  const rise = rose(r.thornsText);
  if (rise) {reviveFx(g);}
  say(g, r.thornsText, rise ? C_ACCENT : C_LOG_HURT);
  noteLog(g, r.thornsText);
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

function heroStep(g: Game, action: HeroAction): void {
  const { enemy: e, state } = g.battle;
  if (!e || !state) {return;}
  const turn = startTurn(g.hero, action);
  const turnPops = turnStartPops(turn);
  say(g, announce(action), C_DIM);
  popHero(g, turnPops);
  if (turnPops.length) {regenAura(g);}
  cue(g, heroWindup(g, action), () => { landHeroAction(g, action, turnPops.length); }, true);
}

function useAction(g: Game, action: HeroAction): void {
  if (!g.battle.enemy) {return;}
  clearNote(g);
  if (!canAfford(g.hero, action)) {
    push(g, 0.7, () => { say(g, 'NOT ENOUGH MP!', C_DIM); g.app.audio.play('blip'); });
    beginQueue(g);
    return;
  }
  noteVerb(g, action);
  g.battle.committed = commitTurn(g, action);
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
    if (consumeA(g)) { dismissBanner(g); armA(g); }
    return;
  }
  g.battle.bufferedA = false;
  const chosen = menuChoice(g, takeA(g));
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

const KILL_SHOWN = 0.5;

function hurryKill(g: Game): void {
  if (g.fx.cues.length === 0) {return;}
  flushFx(g);
  g.battle.timer = Math.min(g.battle.timer, KILL_SHOWN);
}

const stepOver = (g: Game): boolean => g.battle.timer <= 0 && !fxBusy(g);

function updateQueue(g: Game, dt: number): void {
  g.battle.timer -= dt;
  if (g.battle.outcome === 'WON') {
    if (consumeA(g)) {hurryKill(g);}
    if (stepOver(g)) {advanceQueueStep(g);}
    return;
  }
  if (!consumeA(g)) {
    if (stepOver(g)) {advanceQueueStep(g);}
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
