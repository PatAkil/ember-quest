import {
  type AffixId,
  type BattleState,
  type DamageKind,
  type Derived,
  type EnemyInstance,
  type FoeScale,
  type Hero,
  type HeroAction,
  type HeroActResult,
  type Hit,
  type Rng,
  type SpellDef,
  type SpellId,
} from '../types';
import { ENEMIES, SPELLS } from '../data';
import { affixResists, swiftEvades, thornsDamage } from './affixes';
import { commandAct, heroResult, isCommand, settleBreak } from './commands';
import { elementMult } from './element';
import { burstBlow, gainEmber } from './burst';
import { actMult } from './descent';
import { nextIntent } from './enemy-turn';
import { findEffect } from './gear';
import { derive, isGuardAction, isSpell, spellCost } from './hero';
import { pactDamage } from './pacts';
import { burnChance, gearPower, heroElement, riposteMult } from './power';
import { applyBurn, atTurnStart, heroBurnTick, heroFalls, resistOf, tickWard, type Fall } from './status';
import { JITTER_MIN, jitter, type EffectOf } from './util';

type Scope = 'ATTACK' | 'SPELL';
type StrikeAction = 'ATTACK' | SpellId;

export const clearsTerm = (scale: FoeScale): number => scale.descentClears ?? scale.clears;

export function spawnEnemy(id: string, scale: FoeScale, affixes: readonly AffixId[] = []): EnemyInstance {
  const def = ENEMIES[id];
  if (!def) {throw new Error(`unknown enemy: ${id}`);}
  const m = actMult(scale.n);
  const clears = clearsTerm(scale);
  const hp = Math.max(1, Math.round((def.hpBase + def.hpPerClear * clears) * m * def.mult));
  const atk = Math.max(1, Math.round((def.atkBase + def.atkPerClear * clears) * m * def.mult));
  return {
    def, hp, maxHp: hp, atk,
    ...affixResists(def, affixes),
    affixes: [...affixes], burn: null, wardTurns: 0, phase: 1, cycleIndex: 0, mended: false, staggered: false,
  };
}

export function createBattle(enemy: EnemyInstance): BattleState {
  return {
    enemy, rampStacks: 0, lastScope: null, actionsTaken: 0,
    intent: nextIntent(enemy), guarding: false, guardChain: 0, riposte: false, aegis: 0, calm: 0, foeMark: enemy.hp, turn: 0,
  };
}

function afterResist(raw: number, kind: DamageKind, enemy: EnemyInstance, elementMul: number): number {
  return Math.max(1, Math.round(raw * (1 - resistOf(enemy, kind) / 100) * elementMul));
}

interface Swing {
  base: number;
  kind: DamageKind;
  verb: string;
  mults: number[];
}

function attackSwing(hero: Hero, d: Derived): Swing {
  const weaponKind: DamageKind = hero.equipment.WEAPON?.weaponKind ?? 'PHYSICAL';
  const swing: Swing = {
    base: weaponKind === 'MAGIC' ? d.mag : d.atk,
    kind: weaponKind,
    verb: 'STRIKES',
    mults: [1],
  };
  if (findEffect(hero, 'HEX_STRIKE')) {
    swing.kind = 'MAGIC';
    swing.base = d.atk;
  }
  const twin = findEffect(hero, 'TWIN_STRIKE');
  if (twin) {swing.mults.push(twin.secondHitMult);}
  return swing;
}

function spellSwing(hero: Hero, d: Derived, action: SpellId): Swing {
  const spell = SPELLS[action];
  const hex = findEffect(hero, 'HEX_STRIKE');
  const swing: Swing = {
    base: spell.scale === 'MAG' ? d.mag : d.atk,
    kind: spell.kind,
    verb: spell.verb,
    mults: Array.from({ length: Math.max(1, spell.hits) }, () => spell.mult),
  };
  if (hex && spell.kind === 'PHYSICAL' && (action === 'SLASH' || hex.allPhysical)) {
    swing.kind = 'MAGIC';
    swing.base = d.atk;
  }
  const twice = findEffect(hero, 'SPELL_TWICE');
  if (twice?.spell === action) {swing.mults.push(spell.mult * twice.secondHitMult);}
  return swing;
}

export function swingFor(hero: Hero, d: Derived, action: StrikeAction): Swing {
  return action === 'ATTACK' ? attackSwing(hero, d) : spellSwing(hero, d, action);
}

interface LineParts { verb: string; enemyName: string; nums: number[]; crit: boolean; rampSuffix: string }

function battleLine({ verb, enemyName, nums, crit, rampSuffix }: LineParts): string {
  const joined = nums.join('+');
  const core = `HERO ${verb} ${enemyName} FOR ${joined}!`;
  const prefix = crit ? 'CRITICAL! ' : '';
  const candidates = [prefix + core + rampSuffix, prefix + core, core];
  for (const c of candidates) {if (c.length <= 52) {return c;}}
  const total = nums.reduce((a, b) => a + b, 0);
  const short = `HERO HITS ${enemyName} FOR ${total}!`;
  return short.slice(0, 52);
}

interface Ramp { effect: EffectOf<'RAMP'> | undefined; active: boolean; mult: number; suffix: string }

function rampFor(hero: Hero, battle: BattleState, scope: Scope): Ramp {
  const effect = findEffect(hero, 'RAMP');
  if (effect?.scope !== scope) {return { effect, active: false, mult: 1, suffix: '' };}
  const mult = 1 + effect.perStack * battle.rampStacks;
  return { effect, active: true, mult, suffix: battle.rampStacks > 0 ? ` (X${mult.toFixed(2)})` : '' };
}

function advance(battle: BattleState, ramp: Ramp, scope: Scope): void {
  if (ramp.effect) {
    if (ramp.active) {battle.rampStacks = Math.min(ramp.effect.maxStacks, battle.rampStacks + 1);}
    else if (!ramp.effect.sticky) {battle.rampStacks = 0;}
  }
  battle.lastScope = scope;
  battle.actionsTaken += 1;
}

function castHeal(hero: Hero, d: Derived, spell: SpellDef, heal: number): HeroActResult {
  const room = Math.max(0, d.maxHp - hero.hp);
  const healed = Math.min(Math.round(d.maxHp * heal), room);
  hero.hp += healed;
  return heroResult(`HERO ${spell.verb} +${healed} HP!`, { healed });
}

interface Strike { d: Derived; swing: Swing; power: number; elementMul: number }
interface Volley { hits: Hit[]; total: number; anyCrit: boolean; mpRestored: number }
interface Roll { mult: number; jitter: number; crit: boolean }

function hitDamage(hero: Hero, enemy: EnemyInstance, strike: Strike, roll: Roll): number {
  const { d, swing, power, elementMul } = strike;
  const execute = findEffect(hero, 'EXECUTE');
  let raw = swing.base * roll.mult * roll.jitter * power;
  if (roll.crit) {raw *= d.critMult;}
  if (execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= execute.threshold) {
    raw *= 1 + execute.bonus;
  }
  return afterResist(raw, swing.kind, enemy, elementMul);
}

function rollVolley(hero: Hero, enemy: EnemyInstance, strike: Strike, rng: Rng): Volley {
  const mpOnHit = findEffect(hero, 'MP_ON_HIT');
  const volley: Volley = { hits: [], total: 0, anyCrit: false, mpRestored: 0 };
  for (const mult of strike.swing.mults) {
    const roll: Roll = { mult, jitter: jitter(rng), crit: false };
    roll.crit = rng() * 100 < strike.d.crit;
    if (roll.crit) {volley.anyCrit = true;}
    const dmg = hitDamage(hero, enemy, strike, roll);
    volley.hits.push({ dmg, crit: roll.crit, kind: strike.swing.kind });
    volley.total += dmg;
    if (mpOnHit) {volley.mpRestored += mpOnHit.amount;}
  }
  return volley;
}

function sustain(hero: Hero, d: Derived, volley: Volley, spell: SpellDef | undefined): { healed: number; mpRestored: number } {
  let healed = 0;
  const drain = findEffect(hero, 'DRAIN');
  if (drain) {healed += Math.round(volley.total * drain.fraction);}
  if (spell?.leech) {healed += Math.round(volley.total * spell.leech);}
  if (healed > 0) {
    healed = Math.min(healed, Math.max(0, d.maxHp - hero.hp));
    hero.hp += healed;
  }
  let mpRestored = volley.mpRestored;
  if (mpRestored > 0) {
    mpRestored = Math.min(mpRestored, Math.max(0, d.maxMp - hero.mp));
    hero.mp += mpRestored;
  }
  return { healed, mpRestored };
}

function igniteFoe(hero: Hero, enemy: EnemyInstance, volley: Volley, rng: Rng): boolean {
  const chance = burnChance(hero);
  if (chance <= 0 || enemy.hp <= 0 || volley.total <= 0 || rng() >= chance) {return false;}
  applyBurn(enemy, volley.total);
  return true;
}

interface Power { ramp: Ramp; opener: number }

function strikePower(hero: Hero, battle: BattleState, d: Derived, action: StrikeAction): number {
  const power = gearPower({ hero, battle, d, element: heroElement(hero, action) }) * pactDamage(hero, action === 'ATTACK');
  return battle.riposte ? power * riposteMult(hero) : power;
}

function openerOf(hero: Hero, battle: BattleState, scope: Scope): Power {
  const firstStrike = findEffect(hero, 'FIRST_STRIKE');
  return { ramp: rampFor(hero, battle, scope), opener: firstStrike && battle.actionsTaken === 0 ? firstStrike.mult : 1 };
}

function slipsAway(battle: BattleState, ramp: Ramp, scope: Scope): HeroActResult {
  advance(battle, ramp, scope);
  return heroResult('IT SLIPS AWAY!', { missed: true });
}

function strikeOf(hero: Hero, battle: BattleState, action: StrikeAction, power: Power): Strike {
  const d = derive(hero);
  return {
    d,
    swing: swingFor(hero, d, action),
    elementMul: elementMult(battle.enemy.def, heroElement(hero, action)),
    power: power.ramp.mult * power.opener * strikePower(hero, battle, d, action),
  };
}

function strikeAct(hero: Hero, battle: BattleState, action: StrikeAction, rng: Rng): HeroActResult {
  const d = derive(hero);
  const enemy = battle.enemy;
  const scope: Scope = action === 'ATTACK' ? 'ATTACK' : 'SPELL';
  const spell = action === 'ATTACK' ? undefined : SPELLS[action];
  const { ramp, opener } = openerOf(hero, battle, scope);
  if (spell?.heal !== undefined) {
    const result = castHeal(hero, d, spell, spell.heal);
    advance(battle, ramp, scope);
    return result;
  }
  if (swiftEvades(enemy, rng)) {return slipsAway(battle, ramp, scope);}
  const strike = strikeOf(hero, battle, action, { ramp, opener });
  const { swing, elementMul } = strike;
  const volley = rollVolley(hero, enemy, strike, rng);
  enemy.hp = Math.max(0, enemy.hp - volley.total);
  const { healed, mpRestored } = sustain(hero, d, volley, spell);
  const burned = igniteFoe(hero, enemy, volley, rng);
  advance(battle, ramp, scope);
  battle.riposte = false;
  gainEmber(hero, 'ACTION');
  const nums = volley.hits.map((h) => h.dmg);
  return heroResult(battleLine({ verb: swing.verb, enemyName: enemy.def.name, nums, crit: volley.anyCrit, rampSuffix: ramp.suffix }), {
    hits: volley.hits, healed, mpRestored, burned,
    enemyDefeated: enemy.hp <= 0,
    crit: volley.anyCrit,
    weak: elementMul > 1,
    resisted: elementMul < 1,
  });
}

function aegisAct(hero: Hero, battle: BattleState, spell: SpellDef): HeroActResult {
  hero.mp = Math.max(0, hero.mp - spellCost(hero, spell.id));
  battle.guarding = true;
  battle.aegis = spell.guard?.reflect ?? 0;
  return heroResult(`HERO ${spell.verb}!`, { guarded: true });
}

function spellAct(hero: Hero, battle: BattleState, action: SpellId, rng: Rng): HeroActResult {
  const spell = SPELLS[action];
  if (spell.guard) {return aegisAct(hero, battle, spell);}
  hero.mp = Math.max(0, hero.mp - spellCost(hero, action));
  return strikeAct(hero, battle, action, rng);
}

function act(hero: Hero, battle: BattleState, action: HeroAction, rng: Rng): HeroActResult {
  if (isCommand(action)) {return commandAct(hero, battle, action);}
  return action === 'ATTACK' ? strikeAct(hero, battle, action, rng) : spellAct(hero, battle, action, rng);
}

const THORNS_LINE: Record<Fall, (n: string) => string> = {
  STANDING: (n) => `THORNS BITE YOU FOR ${n}`,
  DEAD: (n) => `THE THORNS TAKE YOU! (${n})`,
  REVIVED: (n) => `THE THORNS FELL YOU (${n}) - YOU RISE!`,
};

function backlash(hero: Hero, battle: BattleState, result: HeroActResult): HeroActResult {
  const dealt = result.hits.reduce((sum, h) => sum + h.dmg, 0);
  const thorns = result.enemyDefeated ? 0 : thornsDamage(battle.enemy, dealt, derive(hero).maxHp);
  if (thorns <= 0) {return result;}
  hero.hp -= thorns;
  const fall = heroFalls(hero);
  const thornsText = THORNS_LINE[fall](String(thorns));
  return { ...result, thorns, thornsText, heroDead: fall === 'DEAD', revived: fall === 'REVIVED' };
}

const strikesFoe = (action: HeroAction): action is StrikeAction =>
  action === 'ATTACK' || (isSpell(action) && SPELLS[action].heal === undefined && SPELLS[action].guard === undefined);

const dealsDamage = (action: HeroAction): boolean => action === 'BURST' || strikesFoe(action);

function chainAfter(battle: BattleState, action: HeroAction): number {
  if (isGuardAction(action)) {return battle.guardChain + 1;}
  return dealsDamage(action) ? 0 : battle.guardChain;
}

function burnAfter(hero: Hero, result: HeroActResult): HeroActResult {
  if (result.heroDead || result.enemyDefeated) {return result;}
  const { burnTick, fall } = heroBurnTick(hero);
  if (burnTick <= 0) {return result;}
  const n = String(burnTick);
  const burnText = fall === 'DEAD' ? `THE FLAMES TAKE YOU! (${n})` : fall === 'REVIVED' ? `THE FLAMES FELL YOU (${n}) - YOU RISE!` : `YOU BURN FOR ${n}`;
  return { ...result, burnTick, burnText, heroDead: fall === 'DEAD', revived: result.revived || fall === 'REVIVED' };
}

export function heroAct(hero: Hero, battle: BattleState, action: HeroAction, rng: Rng): HeroActResult {
  battle.guardChain = chainAfter(battle, action);
  battle.guarding = false;
  battle.aegis = 0;
  const result = act(hero, battle, action, rng);
  tickWard(battle.enemy);
  return burnAfter(hero, backlash(hero, battle, settleBreak(hero, battle, action, result)));
}

function heroDamageAt(hero: Hero, battle: BattleState, action: HeroAction, roll: number): number {
  const ready = atTurnStart(hero, action);
  if (action === 'BURST') {return burstBlow(ready, derive(ready)).dmg;}
  if (!strikesFoe(action)) {return 0;}
  const strike = strikeOf(ready, battle, action, openerOf(ready, battle, action === 'ATTACK' ? 'ATTACK' : 'SPELL'));
  return strike.swing.mults.reduce((sum, mult) => sum + hitDamage(ready, battle.enemy, strike, { mult, jitter: roll, crit: false }), 0);
}

export const expectedHeroDamage = (hero: Hero, battle: BattleState, action: HeroAction): number => heroDamageAt(hero, battle, action, 1);

export const leastHeroDamage = (hero: Hero, battle: BattleState, action: HeroAction): number => heroDamageAt(hero, battle, action, JITTER_MIN);
