import type {
  BattleState,
  DamageKind,
  Derived,
  EnemyActResult,
  EnemyInstance,
  Hero,
  HeroAction,
  HeroActResult,
  Hit,
  Rng,
  SpellDef,
  SpellId,
} from '../types';
import { ACT_MULT, ENEMIES, SPELLS } from '../data';
import { allEffects, findEffect } from './gear';
import { derive, spellCost } from './hero';
import { clamp, jitter, type EffectOf } from './util';

type Scope = 'ATTACK' | 'SPELL';

export function spawnEnemy(id: string, clears: number, act: number): EnemyInstance {
  const def = ENEMIES[id];
  if (!def) {throw new Error(`unknown enemy: ${id}`);}
  const m = ACT_MULT[clamp(act, 0, ACT_MULT.length - 1)] ?? 1;
  const hp = Math.max(1, Math.round((def.hpBase + def.hpPerClear * clears) * m * def.mult));
  const atk = Math.max(1, Math.round((def.atkBase + def.atkPerClear * clears) * m * def.mult));
  return { def, hp, maxHp: hp, atk };
}

export function createBattle(enemy: EnemyInstance): BattleState {
  return { enemy, rampStacks: 0, lastScope: null, actionsTaken: 0 };
}

export function startTurn(hero: Hero): { hpRegen: number; mpRegen: number; bloodLoss: number } {
  const d = derive(hero);
  const hpRegen = clamp(d.hpRegen, 0, Math.max(0, d.maxHp - hero.hp));
  const mpRegen = clamp(d.mpRegen, 0, Math.max(0, d.maxMp - hero.mp));
  hero.hp += hpRegen;
  hero.mp += mpRegen;
  let blood = 0;
  for (const eff of allEffects(hero, 'BLOOD')) {blood += eff.hpPerTurn;}
  const bloodLoss = Math.min(blood, Math.max(0, hero.hp - 1));
  hero.hp -= bloodLoss;
  return { hpRegen, mpRegen, bloodLoss };
}

function afterResist(raw: number, kind: DamageKind, enemy: EnemyInstance): number {
  const resist = kind === 'PHYSICAL' ? enemy.def.def : enemy.def.mdef;
  return Math.max(1, Math.round(raw * (1 - resist / 100)));
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

export function swingFor(hero: Hero, d: Derived, action: HeroAction): Swing {
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
  return {
    hits: [],
    healed,
    mpRestored: 0,
    text: `HERO ${spell.verb} +${healed} HP!`.slice(0, 52),
    enemyDefeated: false,
    crit: false,
  };
}

interface Strike { d: Derived; swing: Swing; rampMult: number; openerMult: number }
interface Volley { hits: Hit[]; total: number; anyCrit: boolean; mpRestored: number }

function rollVolley(hero: Hero, enemy: EnemyInstance, strike: Strike, rng: Rng): Volley {
  const { d, swing, rampMult, openerMult } = strike;
  const execute = findEffect(hero, 'EXECUTE');
  const mpOnHit = findEffect(hero, 'MP_ON_HIT');
  const volley: Volley = { hits: [], total: 0, anyCrit: false, mpRestored: 0 };
  for (const mult of swing.mults) {
    let raw = swing.base * mult * jitter(rng) * rampMult * openerMult;
    const crit = rng() * 100 < d.crit;
    if (crit) {
      raw *= d.critMult;
      volley.anyCrit = true;
    }
    if (execute && enemy.maxHp > 0 && enemy.hp / enemy.maxHp <= execute.threshold) {
      raw *= 1 + execute.bonus;
    }
    const dmg = afterResist(raw, swing.kind, enemy);
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

export function heroAct(hero: Hero, battle: BattleState, action: HeroAction, rng: Rng): HeroActResult {
  const d = derive(hero);
  const enemy = battle.enemy;
  const scope: Scope = action === 'ATTACK' ? 'ATTACK' : 'SPELL';
  const spell = action === 'ATTACK' ? undefined : SPELLS[action];
  if (action !== 'ATTACK') {hero.mp = Math.max(0, hero.mp - spellCost(hero, action));}
  const ramp = rampFor(hero, battle, scope);
  const firstStrike = findEffect(hero, 'FIRST_STRIKE');
  const openerMult = firstStrike && battle.actionsTaken === 0 ? firstStrike.mult : 1;
  if (spell?.heal !== undefined) {
    const result = castHeal(hero, d, spell, spell.heal);
    advance(battle, ramp, scope);
    return result;
  }
  const swing = swingFor(hero, d, action);
  const volley = rollVolley(hero, enemy, { d, swing, rampMult: ramp.mult, openerMult }, rng);
  enemy.hp = Math.max(0, enemy.hp - volley.total);
  const { healed, mpRestored } = sustain(hero, d, volley, spell);
  advance(battle, ramp, scope);
  const nums = volley.hits.map((h) => h.dmg);
  return {
    hits: volley.hits,
    healed,
    mpRestored,
    text: battleLine({ verb: swing.verb, enemyName: enemy.def.name, nums, crit: volley.anyCrit, rampSuffix: ramp.suffix }),
    enemyDefeated: enemy.hp <= 0,
    crit: volley.anyCrit,
  };
}

function reviveCharges(hero: Hero): { total: number; hpFraction: number } {
  let total = 0;
  let hpFraction = 0;
  for (const eff of allEffects(hero, 'REVIVE')) {
    total += eff.twice ? 2 : 1;
    hpFraction = Math.max(hpFraction, eff.hpFraction);
  }
  return { total: Math.min(2, total), hpFraction };
}

function tryRevive(hero: Hero, d: Derived): boolean {
  const charges = reviveCharges(hero);
  const spent = (hero.revived ? 1 : 0) + (hero.revivedTwice ? 1 : 0);
  if (spent >= charges.total) {return false;}
  hero.hp = Math.max(1, Math.round(d.maxHp * charges.hpFraction));
  if (!hero.revived) {hero.revived = true;}
  else {hero.revivedTwice = true;}
  return true;
}

function reflectDamage(hero: Hero, dmg: number, physical: boolean): number {
  const reflect = findEffect(hero, 'REFLECT');
  if (!reflect || reflect.fraction <= 0 || !(physical || reflect.magicToo)) {return 0;}
  return Math.max(1, Math.round(dmg * reflect.fraction));
}

interface Blow { dmg: number; reflected: number; enemyDefeated: boolean }

function landed(blow: Blow, fate: { revived: boolean; heroDead: boolean }, text: string): EnemyActResult {
  return {
    dodged: false,
    dmg: blow.dmg,
    reflected: blow.reflected,
    revived: fate.revived,
    heroDead: fate.heroDead,
    enemyDefeated: blow.enemyDefeated,
    text: text.slice(0, 52),
  };
}

function dodgedBlow(name: string): EnemyActResult {
  return {
    dodged: true,
    dmg: 0,
    reflected: 0,
    revived: false,
    heroDead: false,
    enemyDefeated: false,
    text: `YOU DODGE ${name}'S BLOW!`.slice(0, 52),
  };
}

export function enemyAct(hero: Hero, battle: BattleState, rng: Rng): EnemyActResult {
  const d = derive(hero);
  const enemy = battle.enemy;
  const name = enemy.def.name;
  if (rng() * 100 < d.dodge) {return dodgedBlow(name);}
  const physical = enemy.def.atkType === 'PHYSICAL';
  const resist = physical ? d.def : d.mdef;
  const dmg = Math.max(1, Math.round(enemy.atk * jitter(rng) * (1 - resist / 100)));
  hero.hp -= dmg;
  const reflected = reflectDamage(hero, dmg, physical);
  if (reflected > 0) {enemy.hp = Math.max(0, enemy.hp - reflected);}
  const blow: Blow = { dmg, reflected, enemyDefeated: enemy.hp <= 0 };
  const verb = physical ? 'STRIKES' : 'HEXES';
  if (hero.hp > 0) {return landed(blow, { revived: false, heroDead: false }, `${name} ${verb} YOU FOR ${dmg}!`);}
  if (tryRevive(hero, d)) {
    return landed(blow, { revived: true, heroDead: false }, `${name} FELLS YOU! YOUR GEAR BURNS - YOU RISE!`);
  }
  hero.hp = 0;
  return landed(blow, { revived: false, heroDead: true }, `${name} ${verb} YOU FOR ${dmg} - YOU FALL!`);
}
