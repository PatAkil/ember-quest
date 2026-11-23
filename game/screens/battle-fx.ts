import { PICO8, contrast } from '../../engine';
import type { Sprite } from '../../engine';
import type { EnemyActResult, EnemyInstance, EnemyKind, Hero, HeroAction, HeroActResult, Hit, SpellId } from '../types';
import { enemyAnim, heroFrames } from '../sprites';
import { enemyAnchor, enemyPos, heroAnchor } from '../backdrop';
import { addMove, addShot, addTint, cue, holdMeter, meter } from '../fx';
import { enemyContact, enemyReach, heroContact, heroReach } from './battle-reach';
import type { Actor, ShotKind } from '../fx-state';
import { popSpot, pushPop } from '../pops';
import type { Game } from '../state';
import { C_ACCENT, C_DIM, C_DMG_TAKEN, C_HP, C_MP, C_TEXT, FLOOR_Y, HERO_H, HERO_W, HERO_X, HUD_BOTTOM, enemyColor, heroPos } from '../theme';
import type { Point } from '../theme';

type Archetype = 'MELEE' | 'HEAVY' | 'SHOT' | 'SKY' | 'AURA';
interface Look { arch: Archetype; impact: number; shot: ShotKind | null; color: string; glow: string }

const SPELL_LOOK: Record<SpellId, Look> = {
  FIREBALL: { arch: 'SHOT', impact: 0.28, shot: 'ORB', color: PICO8[9], glow: PICO8[10] },
  WATER: { arch: 'SHOT', impact: 0.3, shot: 'WAVE', color: PICO8[12], glow: PICO8[7] },
  SLASH: { arch: 'MELEE', impact: 0.18, shot: 'SLASH', color: PICO8[7], glow: PICO8[10] },
  THUNDER: { arch: 'SKY', impact: 0.24, shot: 'SKYBOLT', color: PICO8[10], glow: PICO8[7] },
  TWINBOLT: { arch: 'SHOT', impact: 0.24, shot: 'BOLT', color: PICO8[12], glow: PICO8[7] },
  LEECH: { arch: 'SHOT', impact: 0.28, shot: 'BOLT', color: PICO8[14], glow: PICO8[2] },
  QUAKE: { arch: 'HEAVY', impact: 0.24, shot: 'DUST', color: PICO8[15], glow: PICO8[6] },
  MEND: { arch: 'AURA', impact: 0.22, shot: 'RISE', color: PICO8[11], glow: PICO8[7] },
};
const STRIKE_LOOK: Look = { arch: 'MELEE', impact: 0.18, shot: null, color: PICO8[7], glow: PICO8[6] };
const HEXBOLT_LOOK: Look = { arch: 'SHOT', impact: 0.26, shot: 'BOLT', color: PICO8[14], glow: PICO8[7] };
const LAUNCH = 0.1;
const STAGGER = 0.16;
export const MOTES_FLIGHT = 0.3;

export const lastHitDelay = (hits: number): number => STAGGER * Math.max(0, hits - 1);

export const hasHex = (hero: Hero): boolean => Object.values(hero.equipment).some((it) => it.effect.kind === 'HEX_STRIKE');
export const magicWeapon = (hero: Hero): boolean => hero.equipment.WEAPON?.weaponKind === 'MAGIC';

function heroLook(hero: Hero, action: HeroAction): Look {
  if (action !== 'ATTACK') {return SPELL_LOOK[action];}
  return hasHex(hero) || magicWeapon(hero) ? HEXBOLT_LOOK : STRIKE_LOOK;
}

function enemyLook(e: EnemyInstance): Look {
  if (e.def.atkType === 'PHYSICAL') {return { ...STRIKE_LOOK, impact: 0.2 };}
  return { arch: 'SHOT', impact: 0.28, shot: 'HEX', color: enemyColor(e.def.id), glow: PICO8[7] };
}

interface Side { actor: Actor; foe: Actor; cast: Point; hit: Point; feet: Point; head: Point; contact: Point; reach: number }

const heroCast = (): Point => ({ x: HERO_X + HERO_W / 2 + 2, y: FLOOR_Y - Math.round(HERO_H * 0.55) });

function heroSide(g: Game): Side {
  return {
    actor: 'HERO', foe: 'ENEMY', cast: heroCast(), hit: enemyPos(g), feet: { x: HERO_X, y: FLOOR_Y - 4 }, head: heroAnchor().head,
    contact: enemyContact(g), reach: heroReach(g),
  };
}

function enemySide(g: Game): Side {
  const p = enemyPos(g);
  const a = enemyAnchor(g);
  return {
    actor: 'ENEMY', foe: 'HERO', cast: { x: a.front - 2, y: p.y }, hit: heroPos(), feet: { x: p.x, y: FLOOR_Y - 4 }, head: a.head,
    contact: heroContact(), reach: enemyReach(g),
  };
}

const whooshAt = (g: Game, delay: number): void => { cue(g, delay, () => { g.app.audio.play('whoosh'); }); };

function launch(g: Game, s: Side, l: Look, flight: number): void {
  addShot(g, { kind: 'CHARGE', dur: LAUNCH, from: s.cast, to: s.cast, color: l.color, glow: l.glow });
  addShot(g, { kind: l.shot ?? 'BOLT', dur: flight, from: s.cast, to: s.hit, color: l.color, glow: l.glow }, LAUNCH);
  whooshAt(g, LAUNCH);
}

const SKY_TOP = HUD_BOTTOM + 3;

function skyStrike(g: Game, s: Side, l: Look, delay: number): void {
  addShot(g, { kind: 'SKYBOLT', dur: 0.2, from: { x: s.hit.x + 5, y: SKY_TOP }, to: s.hit, color: l.color, glow: l.glow }, delay);
}

const WINDUP: Record<Archetype, (g: Game, s: Side, l: Look) => void> = {
  MELEE: (g, s) => { addMove(g, s.actor, 'LUNGE', s.reach); whooshAt(g, 0.07); },
  HEAVY: (g, s) => { addMove(g, s.actor, 'HEAVY', 16); whooshAt(g, 0.12); },
  SHOT: (g, s, l) => { addMove(g, s.actor, 'CAST', 4); launch(g, s, l, l.impact - LAUNCH); },
  SKY: (g, s, l) => {
    addMove(g, s.actor, 'CAST', 3);
    addShot(g, { kind: 'CHARGE', dur: l.impact, from: { x: s.hit.x + 5, y: 40 }, to: s.cast, color: l.color, glow: l.glow });
    skyStrike(g, s, l, l.impact - 0.02);
  },
  AURA: (g, s, l) => { addShot(g, { kind: 'RISE', dur: 0.6, from: s.feet, to: s.head, color: l.color, glow: l.glow }); },
};

export function heroWindup(g: Game, action: HeroAction): number {
  const l = heroLook(g.hero, action);
  WINDUP[l.arch](g, heroSide(g), l);
  return l.impact;
}

export function enemyWindup(g: Game, e: EnemyInstance): number {
  const l = enemyLook(e);
  WINDUP[l.arch](g, enemySide(g), l);
  return l.impact;
}

const HERO_TONE_FROM = heroFrames[0];
const TONES = [PICO8[7], PICO8[12]] as const;
const toneCache = new Map<Sprite, string>();

function dominant(s: Sprite): string {
  const counts = new Map<string, number>();
  for (const c of s.pixels) {if (c && c !== PICO8[0]) {counts.set(c, (counts.get(c) ?? 0) + 1);}}
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? PICO8[0];
}

function flashTone(s: Sprite): string {
  const cached = toneCache.get(s);
  if (cached) {return cached;}
  const body = dominant(s);
  const tone = contrast(body, TONES[0]) >= contrast(body, TONES[1]) ? TONES[0] : TONES[1];
  toneCache.set(s, tone);
  return tone;
}

function toneFor(g: Game, actor: Actor): string {
  const e = g.battle.enemy;
  return flashTone(actor === 'ENEMY' && e ? enemyAnim(e.def.id)[0] : HERO_TONE_FROM);
}

interface Blow { target: Actor; at: Point; crit: boolean; heavy: boolean; burst: string }

function react(g: Game, b: Blow): void {
  const { audio, particles, juice } = g.app;
  addTint(g, b.target, toneFor(g, b.target), b.crit ? 0.12 : 0.07);
  addMove(g, b.target, 'RECOIL', b.crit ? 8 : b.heavy ? 7 : 6);
  if (b.crit) {
    audio.play('explosion'); juice.shake(4, 0.3); juice.flash(C_ACCENT, 0.3); juice.hitStop(0.08);
    particles.burst(b.at.x, b.at.y, { count: 12, color: C_ACCENT, speed: 130 });
    return;
  }
  audio.play('hit');
  juice.shake(b.heavy ? 4 : 2, b.heavy ? 0.3 : 0.18);
  particles.burst(b.at.x, b.at.y, { count: 6, color: b.burst });
}

function hitPop(g: Game, h: Hit, slot: number): void {
  const color = h.crit ? C_ACCENT : h.kind === 'MAGIC' ? PICO8[14] : C_TEXT;
  pushPop(g.pops, { ...popSpot(enemyAnchor(g), slot), scale: h.crit ? 3 : 2 }, `-${h.dmg}${h.crit ? '!' : ''}`, color);
}

const ARC_DUR = 0.1;
const BLOOM_DUR = 0.22;

function impactMark(g: Game, s: Side, l: Look): void {
  if (l.arch === 'MELEE') {
    const to = { x: s.contact.x + Math.sign(s.hit.x - s.cast.x), y: s.contact.y };
    addShot(g, { kind: 'ARC', dur: ARC_DUR, from: s.contact, to, color: l.color, glow: l.glow });
  }
  if (l.arch === 'SHOT') {addShot(g, { kind: 'BLOOM', dur: BLOOM_DUR, from: s.hit, to: s.hit, color: l.color, glow: l.glow });}
}

function landHit(g: Game, l: Look, h: Hit, slot: number): void {
  const s = heroSide(g);
  const e = g.battle.enemy;
  hitPop(g, h, slot);
  impactMark(g, s, l);
  react(g, { target: 'ENEMY', at: s.hit, crit: h.crit, heavy: l.arch === 'HEAVY', burst: e ? enemyColor(e.def.id) : C_TEXT });
  if (l.shot === 'SLASH' || (l.arch === 'MELEE' && slot > 0)) {addShot(g, { kind: 'SLASH', dur: 0.26, from: s.hit, to: s.hit, color: l.color, glow: l.glow });}
  if (l.arch === 'HEAVY') {addShot(g, { kind: 'DUST', dur: 0.32, from: { x: HERO_X + 16, y: FLOOR_Y }, to: { x: s.hit.x + 12, y: FLOOR_Y }, color: l.color, glow: l.glow });}
}

interface StagedHit { look: Look; hit: Hit; slot: number; drop: number }

function stagedHit(g: Game, st: StagedHit): void {
  const delay = STAGGER * st.slot;
  const s = heroSide(g);
  if (st.drop > 0) {holdMeter(g, 'enemyHp', st.drop);}
  if (st.look.arch === 'SHOT') {addShot(g, { kind: st.look.shot ?? 'BOLT', dur: delay, from: s.cast, to: s.hit, color: st.look.color, glow: st.look.glow });}
  if (st.look.arch === 'SKY') {skyStrike(g, s, st.look, delay - 0.02);}
  cue(g, delay, () => {
    if (st.drop > 0) {holdMeter(g, 'enemyHp', -st.drop);}
    landHit(g, st.look, st.hit, st.slot);
  });
}

export interface PopSpec { text: string; color: string }

export function popHero(g: Game, specs: readonly PopSpec[], first = 0): void {
  const anchor = heroAnchor();
  specs.forEach((s, i) => { pushPop(g.pops, popSpot(anchor, first + i), s.text, s.color); });
}

function restorePops(r: HeroActResult): PopSpec[] {
  const specs: PopSpec[] = [];
  if (r.healed > 0) {specs.push({ text: `+${r.healed} HP`, color: C_HP });}
  if (r.mpRestored > 0) {specs.push({ text: `+${r.mpRestored} MP`, color: C_MP });}
  return specs;
}

function selfRestore(g: Game, r: HeroActResult, slot: number): void {
  const s = heroSide(g);
  popHero(g, restorePops(r), slot);
  addShot(g, { kind: 'RING', dur: 0.36, from: heroPos(), to: heroPos(), color: C_HP, glow: PICO8[7] });
  g.app.audio.play('pickup');
  g.app.particles.burst(s.head.x, s.head.y + 10, { count: 8, color: C_HP, speed: 60 });
}

function drainBack(g: Game, r: HeroActResult, slot: number): void {
  const s = heroSide(g);
  holdMeter(g, 'heroHp', -r.healed);
  addShot(g, { kind: 'MOTES', dur: MOTES_FLIGHT, from: s.hit, to: heroPos(), color: C_HP, glow: PICO8[7] });
  cue(g, MOTES_FLIGHT, () => {
    holdMeter(g, 'heroHp', r.healed);
    popHero(g, restorePops(r), slot);
    addTint(g, 'HERO', C_HP, 0.06);
    g.app.particles.burst(heroPos().x, heroPos().y, { count: 6, color: C_HP, speed: 50 });
  });
}

interface HeroImpact { action: HeroAction; result: HeroActResult; slot: number; preHp: number }

export function heroImpact(g: Game, imp: HeroImpact): void {
  const { action, result: r, slot, preHp } = imp;
  const l = heroLook(g.hero, action);
  if (!r.hits.length) { selfRestore(g, r, slot); return; }
  let rem = Math.max(0, preHp - (r.hits[0]?.dmg ?? 0));
  r.hits.forEach((h, i) => {
    if (i === 0) { landHit(g, l, h, 0); return; }
    const drop = Math.min(rem, h.dmg);
    rem -= drop;
    stagedHit(g, { look: l, hit: h, slot: i, drop });
  });
  if (r.healed > 0) {drainBack(g, r, slot);} else if (r.mpRestored > 0) {popHero(g, restorePops(r), slot);}
}

export function regenAura(g: Game): void {
  const s = heroSide(g);
  addShot(g, { kind: 'RISE', dur: 0.4, from: s.feet, to: s.head, color: C_HP, glow: C_MP });
}

function reviveFx(g: Game): void {
  const hp = heroPos();
  const m = meter(g, 'heroHp');
  m.shown = 0; m.ghost = 0; m.last = 0;
  g.app.juice.flash(C_ACCENT, 0.6, { x: hp.x, y: hp.y });
  g.app.particles.burst(hp.x, hp.y, { count: 16, color: C_ACCENT, speed: 140 });
  g.app.audio.play('pickup');
  addShot(g, { kind: 'RING', dur: 0.5, from: hp, to: hp, color: C_ACCENT, glow: PICO8[7] });
  addShot(g, { kind: 'RISE', dur: 0.7, from: { x: HERO_X, y: FLOOR_Y - 4 }, to: heroAnchor().head, color: C_ACCENT, glow: PICO8[7] });
  addTint(g, 'HERO', C_ACCENT, 0.14);
}

function reflectFx(g: Game, amount: number): void {
  const p = enemyPos(g);
  pushPop(g.pops, popSpot(enemyAnchor(g)), `-${amount}`, PICO8[9]);
  g.app.particles.burst(p.x, p.y, { count: 5, color: PICO8[9] });
  addTint(g, 'ENEMY', toneFor(g, 'ENEMY'), 0.07);
  addMove(g, 'ENEMY', 'RECOIL', 2);
}

export function enemyImpact(g: Game, r: EnemyActResult): void {
  if (r.dodged) {
    g.app.audio.play('blip');
    pushPop(g.pops, popSpot(heroAnchor()), 'MISS', C_DIM);
    addMove(g, 'HERO', 'DODGE', 8);
    return;
  }
  pushPop(g.pops, popSpot(heroAnchor()), `-${r.dmg}`, C_DMG_TAKEN);
  const e = g.battle.enemy;
  if (e) {impactMark(g, enemySide(g), enemyLook(e));}
  if (r.heroDead) {return;}
  react(g, { target: 'HERO', at: heroPos(), crit: false, heavy: false, burst: PICO8[8] });
  g.app.juice.shake(3, 0.25);
  if (r.revived) {reviveFx(g);}
  if (r.reflected > 0) {reflectFx(g, r.reflected);}
}

export function deathFx(g: Game): void {
  addTint(g, 'HERO', toneFor(g, 'HERO'), 0.08);
  g.fx.fall = { t0: g.fx.t + 0.04, dur: 0.4 };
}

const DEFEAT_MAGNITUDE: Record<EnemyKind, number> = { BOSS: 1, ELITE: 0.6, NORMAL: 0.3 };
const BOSS_BURSTS: readonly (readonly [number, number, number])[] = [[0.22, -0.3, -0.25], [0.42, 0.28, 0.1], [0.62, -0.1, 0.3]];

export function defeatFx(g: Game, e: EnemyInstance): void {
  const p = enemyPos(g);
  const a = enemyAnchor(g);
  const mag = DEFEAT_MAGNITUDE[e.def.kind];
  const boss = e.def.kind === 'BOSS';
  const color = enemyColor(e.def.id);
  g.app.audio.play('explosion');
  g.app.particles.burst(p.x, p.y, { count: 10 + Math.round(mag * 10), color, speed: 120 + mag * 60 });
  g.app.juice.shake(4 + mag * 3, 0.35 + mag * 0.15);
  addTint(g, 'ENEMY', toneFor(g, 'ENEMY'), 0.1);
  g.fx.dissolve = { t0: g.fx.t + 0.03, dur: boss ? 0.8 : 0.7 };
  if (!boss) {return;}
  const half = { w: (p.x - a.front), h: p.y - a.head.y };
  for (const [at, fx, fy] of BOSS_BURSTS) {
    cue(g, at, () => {
      g.app.particles.burst(p.x + fx * 2 * half.w, p.y + fy * 2 * half.h, { count: 10, color: PICO8[9], speed: 110 });
      g.app.juice.shake(5, 0.3);
      g.app.audio.play('hit');
    });
  }
}

export const KIND_TAG: Record<EnemyKind, string> = { BOSS: 'BOSS', ELITE: 'ELITE', NORMAL: '' };

export function entranceFx(g: Game, e: EnemyInstance): void {
  addMove(g, 'ENEMY', 'ENTER', 48);
  const tag = KIND_TAG[e.def.kind];
  if (!tag) {return;}
  g.fx.banner = { t0: g.fx.t, name: e.def.name, tag, color: e.def.kind === 'BOSS' ? PICO8[8] : C_ACCENT };
}

const BRACE_PULL = 5;

export function prepareFx(g: Game): void { addMove(g, 'ENEMY', 'BRACE', BRACE_PULL); }
