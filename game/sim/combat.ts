import {
  type BattleState,
  type DamageKind,
  type Derived,
  type EnemyInstance,
  type Hero,
  type HeroAction,
  type HeroActResult,
  type Hit,
  type Rng,
  type SpellDef,
  type SpellId,
} from '../types';
import { ACT_MULT, ENEMIES, SPELLS } from '../data';
import { commandAct, heroResult, isCommand, settleBreak } from './commands';
import { elementMult } from './element';
import { gainEmber } from './burst';
import { nextIntent } from './enemy-turn';
import { findEffect } from './gear';
import { derive, isGuardAction, spellCost } from './hero';
import { burnChance, gearPower, heroElement, riposteMult } from './power';
import { applyBurn, resistOf, tickWard } from './status';
import { clamp, jitter, type EffectOf } from './util';

type Scope = 'ATTACK' | 'SPELL';
type StrikeAction = 'ATTACK' | SpellId;

export function spawnEnemy(id: string, clears: number, act: number): EnemyInstance {
  const def = ENEMIES[id];
  if (!def) {throw new Error(`unknown enemy: ${id}`);}
  const m = ACT_MULT[clamp(act, 0, ACT_MULT.length - 1)] ?? 1;
  const hp = Math.max(1, Math.round((def.hpBase + def.hpPerClear * clears) * m * def.mult));
  const atk = Math.max(1, Math.round((def.atkBase + def.atkPerClear * clears) * m * def.mult));
  return {
    def, hp, maxHp: hp, atk,
    resPhys: def.def, resMagic: def.mdef,
    affixes: [], burn: null, wardTurns: 0, phase: 1, cycleIndex: 0, mended: false, staggered: false,
  };
}

export function createBattle(enemy: EnemyInstance): BattleState {
  return {
    enemy, rampStacks: 0, lastScope: null, actionsTaken: 0,
    intent: nextIntent(enemy), guarding: false, guardChain: 0, riposte: false, aegis: 0,
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

function rollVolley(hero: Hero, enemy: EnemyInstance, strike: Strike, rng: Rng): Volley {
  const { d, swing, power, elementMul } = strike;
  const execute = findEffect(hero, 'EXECUTE');
  const mpOnHit = findEffect(hero, 'MP_ON_HIT');
  const volley: Volley = { hits: [], total: 0, anyCrit: false, mpRestored: 0 };
  for (const mult of swing.mults) {
    let raw = swing.base * mult * jitter(rng) * power;
    const crit = rng() * 100 < d.crit;
    if (crit) {
      raw *= d.critMult;
      volley.anyCrit = true;
    }
    if (execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= execute.threshold) {
      raw *= 1 + execute.bonus;
    }
    const dmg = afterResist(raw, swing.kind, enemy, elementMul);
    volley.hits.push({ dmg, crit, kind: swing.kind });
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
  const power = gearPower({ hero, battle, d, element: heroElement(hero, action) });
  return battle.riposte ? power * riposteMult(hero) : power;
}

function openerOf(hero: Hero, battle: BattleState, scope: Scope): Power {
  const firstStrike = findEffect(hero, 'FIRST_STRIKE');
  return { ramp: rampFor(hero, battle, scope), opener: firstStrike && battle.actionsTaken === 0 ? firstStrike.mult : 1 };
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
  const swing = swingFor(hero, d, action);
  const elementMul = elementMult(enemy.def, heroElement(hero, action));
  const power = ramp.mult * opener * strikePower(hero, battle, d, action);
  const volley = rollVolley(hero, enemy, { d, swing, power, elementMul }, rng);
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

export function heroAct(hero: Hero, battle: BattleState, action: HeroAction, rng: Rng): HeroActResult {
  battle.guardChain = isGuardAction(action) ? battle.guardChain + 1 : 0;
  battle.guarding = false;
  battle.aegis = 0;
  const result = act(hero, battle, action, rng);
  tickWard(battle.enemy);
  return settleBreak(hero, battle, action, result);
}
