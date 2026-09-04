// Ember Quest — content tables. Headless: imports ./types ONLY (no engine, no
// DOM) so the balance simulator can bundle this with sim.ts and run headless.
//
//   SPELLS / SPELL_ORDER  the eight castables (four learned per act, four from tomes)
//   ITEMS                 the loot pool: six slots, four rarities, one unique effect per RARE+
//   LOOT_WEIGHTS/COUNT    what each loot source rolls, per act
//   ENEMIES / BIOMES      the eighteen foes and the four acts they live in
//   ACT_MULT + heals      global scaling knobs the balance pass tunes
//   validateData()        dev-only self-check: returns [] when the tables are legal
//
// Balance shape (hero base: 7 ATK / 12 MAG / 34 HP):
//   COMMON weapons +4/+7/+10 (later tiers minAct-gated) and carry NO effect.
//   RARE +8..12, EPIC +10..14, LEGENDARY +14..18, each with a unique effect and
//   sometimes a downside. Enemy def/mdef are the puzzle: plated foes want magic,
//   spectral ones want steel.

import type {
  Biome, EnemyDef, Item, ItemEffect, LootSource, Rarity, SpellDef, SpellId,
} from './types';

// ---------------------------------------------------------------- spells ----
export const SPELLS: Record<SpellId, SpellDef> = {
  FIREBALL: { id: 'FIREBALL', name: 'FIREBALL', cost: 5, mult: 1.0, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'HURLS FIRE AT' },
  WATER: { id: 'WATER', name: 'WATER', cost: 8, mult: 1.6, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'FLOODS' },
  SLASH: { id: 'SLASH', name: 'SLASH', cost: 4, mult: 1.8, hits: 1, scale: 'ATK', kind: 'PHYSICAL', verb: 'SLASHES' },
  THUNDER: { id: 'THUNDER', name: 'THUNDER', cost: 10, mult: 2.1, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'CALLS LIGHTNING ON' },
  TWINBOLT: { id: 'TWINBOLT', name: 'TWINBOLT', cost: 7, mult: 0.85, hits: 2, scale: 'MAG', kind: 'MAGIC', verb: 'FORKS BOLTS AT' },
  LEECH: { id: 'LEECH', name: 'LEECH', cost: 6, mult: 1.1, hits: 1, scale: 'MAG', kind: 'MAGIC', verb: 'LEECHES', leech: 0.4 },
  QUAKE: { id: 'QUAKE', name: 'QUAKE', cost: 7, mult: 2.0, hits: 1, scale: 'ATK', kind: 'PHYSICAL', verb: 'QUAKES' },
  MEND: { id: 'MEND', name: 'MEND', cost: 6, mult: 0, hits: 0, scale: 'MAG', kind: 'MAGIC', verb: 'MENDS', heal: 0.35 },
};

/** Display order on the battle menu: act spells first, then tome spells. */
export const SPELL_ORDER: SpellId[] = ['FIREBALL', 'WATER', 'SLASH', 'THUNDER', 'TWINBOLT', 'LEECH', 'QUAKE', 'MEND'];

// ----------------------------------------------------------------- items ----
// Names <= 13 chars, blurbs <= 30 chars, both UPPERCASE. COMMON = mods only.
//
// LEVELS AND AWAKENINGS (read before editing an item)
//   Every item can be upgraded twice: +0 -> +1 -> +2 (MAX_LEVEL). LEGENDARY
//   items stop at +1 (LEGENDARY_MAX_LEVEL) and therefore carry NO `awaken`.
//   +1  is automatic and authored by nobody: sim.ts scales `mods` by
//       (1 + UPGRADE_SCALE * level) and nudges the effect's magnitude up with
//       it. Nothing changes about HOW the item plays.
//   +2  is the AWAKENING and IS authored here, in `item.awaken`:
//         blurb   what the loot card reads at +2. <= 30 chars, UPPERCASE, and
//                 it must differ from the base blurb (validateData checks).
//         mods    ADDED on top of the scaled base mods.
//         effect  REPLACES the base effect, and its numbers are FINAL — they
//                 are authored post-scaling, so sim.ts must use them verbatim.
//   House rule: an awakening changes how the item PLAYS, not just how hard it
//   hits — prefer a flag (sticky / allPhysical / magicToo / twice / discount)
//   or an effect swap over a bigger number. COMMONS have `effect: NONE` at +0
//   and awaken into a real, modest effect, so a starting blade can still turn
//   into a build piece; no two COMMONS in the same slot awaken the same way.
export const ITEMS: Item[] = [
  // --- WEAPON: physical (basic ATTACK scales off ATK, deals PHYSICAL) -------
  { id: 'RUSTY_BLADE', name: 'RUSTY BLADE', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'PHYSICAL', mods: { atk: 4 }, effect: { kind: 'NONE' }, blurb: 'CHIPPED BUT HONEST STEEL',
    awaken: { blurb: '+10% PER ATTACK IN A ROW', effect: { kind: 'RAMP', perStack: 0.1, maxStacks: 4, scope: 'ATTACK' } } },
  { id: 'IRON_SWORD', name: 'IRON SWORD', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'PHYSICAL', mods: { atk: 7 }, effect: { kind: 'NONE' }, blurb: 'A SOLDIERS PLAIN SWORD', minAct: 1,
    awaken: { blurb: 'FINISHES WOUNDED FOES', effect: { kind: 'EXECUTE', threshold: 0.25, bonus: 0.4 } } },
  { id: 'WAR_CLEAVER', name: 'WAR CLEAVER', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'PHYSICAL', mods: { atk: 10 }, effect: { kind: 'NONE' }, blurb: 'HEAVY, WIDE, UNSUBTLE', minAct: 2,
    awaken: { blurb: 'OPENING SWING HITS 1.9X', effect: { kind: 'FIRST_STRIKE', mult: 1.9 } } },
  { id: 'HEX_DAGGER', name: 'HEX DAGGER', slot: 'WEAPON', rarity: 'RARE', weaponKind: 'PHYSICAL', mods: { atk: 9 }, effect: { kind: 'HEX_STRIKE' }, blurb: 'STEEL THAT CUTS AS MAGIC',
    awaken: { blurb: 'ALL PHYSICAL HITS AS MAGIC', effect: { kind: 'HEX_STRIKE', allPhysical: true } } },
  { id: 'FURY_BLADE', name: 'FURY BLADE', slot: 'WEAPON', rarity: 'RARE', weaponKind: 'PHYSICAL', mods: { atk: 8 }, effect: { kind: 'RAMP', perStack: 0.15, maxStacks: 5, scope: 'ATTACK' }, blurb: '+15% PER ATTACK IN A ROW',
    awaken: { blurb: 'RAMP SURVIVES SPELLCASTING', effect: { kind: 'RAMP', perStack: 0.2, maxStacks: 6, scope: 'ATTACK', sticky: true } } },
  { id: 'GLASS_SABER', name: 'GLASS SABER', slot: 'WEAPON', rarity: 'RARE', weaponKind: 'PHYSICAL', mods: { atk: 12 }, effect: { kind: 'GLASS', maxHpFraction: 0.25 }, blurb: 'BRUTAL ATK. -25% MAX HP', minAct: 1,
    awaken: { blurb: 'SAME RISK, NOW +15% CRIT', mods: { crit: 15 }, effect: { kind: 'GLASS', maxHpFraction: 0.25 } } },
  { id: 'TWIN_FANGS', name: 'TWIN FANGS', slot: 'WEAPON', rarity: 'EPIC', weaponKind: 'PHYSICAL', mods: { atk: 11 }, effect: { kind: 'TWIN_STRIKE', secondHitMult: 0.6 }, blurb: 'ATTACKS HIT TWICE', minAct: 1,
    awaken: { blurb: 'SECOND FANG BITES AS HARD', effect: { kind: 'TWIN_STRIKE', secondHitMult: 0.85 } } },
  { id: 'SHADOW_EDGE', name: 'SHADOW EDGE', slot: 'WEAPON', rarity: 'EPIC', weaponKind: 'PHYSICAL', mods: { atk: 10, crit: 18 }, effect: { kind: 'EXECUTE', threshold: 0.3, bonus: 0.6 }, blurb: '+18% CRIT. MAULS WOUNDED', minAct: 1,
    awaken: { blurb: 'EXECUTES BELOW HALF HP', effect: { kind: 'EXECUTE', threshold: 0.5, bonus: 0.7 } } },
  { id: 'SOULEATER', name: 'SOULEATER', slot: 'WEAPON', rarity: 'LEGENDARY', weaponKind: 'PHYSICAL', mods: { atk: 16 }, effect: { kind: 'DRAIN', fraction: 0.35 }, blurb: 'HEALS 35% OF DAMAGE DEALT', minAct: 2 },

  // --- WEAPON: magic (basic ATTACK scales off MAG, deals MAGIC) -------------
  { id: 'WILLOW_WAND', name: 'WILLOW WAND', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'MAGIC', mods: { mag: 4 }, effect: { kind: 'NONE' }, blurb: 'A GREEN STICK THAT SPARKS',
    awaken: { blurb: 'EVERY HIT RESTORES 1 MP', effect: { kind: 'MP_ON_HIT', amount: 1 } } },
  { id: 'OAK_STAFF', name: 'OAK STAFF', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'MAGIC', mods: { mag: 7 }, effect: { kind: 'NONE' }, blurb: 'SEASONED, STEADY, SILENT', minAct: 1,
    awaken: { blurb: 'ALL SPELLS COST 1 LESS', effect: { kind: 'CHEAPER_SPELLS', amount: 1 } } },
  { id: 'RUNE_STAFF', name: 'RUNE STAFF', slot: 'WEAPON', rarity: 'COMMON', weaponKind: 'MAGIC', mods: { mag: 10 }, effect: { kind: 'NONE' }, blurb: 'CARVED WITH OLD WORDS', minAct: 2,
    awaken: { blurb: 'FIREBALL ECHOES ONCE MORE', effect: { kind: 'SPELL_TWICE', spell: 'FIREBALL', secondHitMult: 0.35 } } },
  { id: 'MANA_SCEPTRE', name: 'MANA SCEPTRE', slot: 'WEAPON', rarity: 'RARE', weaponKind: 'MAGIC', mods: { mag: 9, mp: 6 }, effect: { kind: 'CHEAPER_SPELLS', amount: 2 }, blurb: 'ALL SPELLS COST 2 LESS',
    awaken: { blurb: 'SPELLS COST 3 LESS. +2 MP', mods: { mpRegen: 2 }, effect: { kind: 'CHEAPER_SPELLS', amount: 3 } } },
  { id: 'STORM_STAFF', name: 'STORM STAFF', slot: 'WEAPON', rarity: 'EPIC', weaponKind: 'MAGIC', mods: { mag: 12 }, effect: { kind: 'RAMP', perStack: 0.15, maxStacks: 5, scope: 'SPELL' }, blurb: '+15% PER SPELL IN A ROW', minAct: 1,
    awaken: { blurb: 'RAMP SURVIVES ATTACKING', effect: { kind: 'RAMP', perStack: 0.2, maxStacks: 6, scope: 'SPELL', sticky: true } } },
  { id: 'ARC_ROD', name: 'ARC ROD', slot: 'WEAPON', rarity: 'EPIC', weaponKind: 'MAGIC', mods: { mag: 11, mp: 6 }, effect: { kind: 'SPELL_TWICE', spell: 'FIREBALL', secondHitMult: 0.7 }, blurb: 'FIREBALL STRIKES TWICE', minAct: 1,
    awaken: { blurb: 'FIREBALL TWICE, FULL POWER', mods: { mp: 4 }, effect: { kind: 'SPELL_TWICE', spell: 'FIREBALL', secondHitMult: 1.0 } } },
  { id: 'NIGHT_SCEPTRE', name: 'NIGHT SCEPTRE', slot: 'WEAPON', rarity: 'LEGENDARY', weaponKind: 'MAGIC', mods: { mag: 17 }, effect: { kind: 'BLOOD', hpPerTurn: 3 }, blurb: 'VAST MAG. BLEEDS 3 HP', minAct: 2 },

  // --- ARMOR: def, and the thorns line -------------------------------------
  { id: 'LEATHER_VEST', name: 'LEATHER VEST', slot: 'ARMOR', rarity: 'COMMON', mods: { def: 10 }, effect: { kind: 'NONE' }, blurb: 'BOILED HIDE, WELL WORN',
    awaken: { blurb: 'RETURNS 20% OF MELEE HITS', effect: { kind: 'REFLECT', fraction: 0.2 } } },
  { id: 'IRON_MAIL', name: 'IRON MAIL', slot: 'ARMOR', rarity: 'COMMON', mods: { def: 18 }, effect: { kind: 'NONE' }, blurb: 'RINGS OF COLD GREY IRON', minAct: 1,
    awaken: { blurb: 'YOUR HITS RING BACK 2 MP', effect: { kind: 'MP_ON_HIT', amount: 2 } } },
  { id: 'PLATE_ARMOR', name: 'PLATE ARMOR', slot: 'ARMOR', rarity: 'COMMON', mods: { def: 26 }, effect: { kind: 'NONE' }, blurb: 'A WALL YOU CAN WEAR', minAct: 2,
    awaken: { blurb: 'STAND ONCE AFTER A DEATHBLOW', effect: { kind: 'REVIVE', hpFraction: 0.3 } } },
  { id: 'BRAMBLE_VEST', name: 'BRAMBLE VEST', slot: 'ARMOR', rarity: 'RARE', mods: { def: 20 }, effect: { kind: 'REFLECT', fraction: 0.35 }, blurb: 'RETURNS 35% OF MELEE HITS',
    awaken: { blurb: 'THORNS RETURN HEXES TOO', effect: { kind: 'REFLECT', fraction: 0.5, magicToo: true } } },
  { id: 'MIRROR_PLATE', name: 'MIRROR PLATE', slot: 'ARMOR', rarity: 'EPIC', mods: { def: 26, mdef: 18 }, effect: { kind: 'REFLECT', fraction: 0.6 }, blurb: 'WARDS ALL. RETURNS 60%', minAct: 1,
    awaken: { blurb: 'RETURNS 80% OF ANY DAMAGE', effect: { kind: 'REFLECT', fraction: 0.8, magicToo: true } } },
  { id: 'TITAN_PLATE', name: 'TITAN PLATE', slot: 'ARMOR', rarity: 'LEGENDARY', mods: { def: 34, hp: 14 }, effect: { kind: 'REFLECT', fraction: 1.0 }, blurb: 'RETURNS EVERY MELEE HIT', minAct: 2 },

  // --- NECKLACE: mdef, regen, and the one second chance --------------------
  { id: 'BONE_CHARM', name: 'BONE CHARM', slot: 'NECKLACE', rarity: 'COMMON', mods: { mdef: 10 }, effect: { kind: 'NONE' }, blurb: 'A KNUCKLE ON A STRING',
    awaken: { blurb: 'HEALS 10% OF DAMAGE DEALT', effect: { kind: 'DRAIN', fraction: 0.1 } } },
  { id: 'JADE_AMULET', name: 'JADE AMULET', slot: 'NECKLACE', rarity: 'COMMON', mods: { mdef: 18 }, effect: { kind: 'NONE' }, blurb: 'COOL GREEN AGAINST HEXES', minAct: 1,
    awaken: { blurb: 'WATER STRIKES TWICE', effect: { kind: 'SPELL_TWICE', spell: 'WATER', secondHitMult: 0.5 } } },
  { id: 'RUNE_TORC', name: 'RUNE TORC', slot: 'NECKLACE', rarity: 'COMMON', mods: { mdef: 26 }, effect: { kind: 'NONE' }, blurb: 'HEAVY WITH WARDING MARKS', minAct: 2,
    awaken: { blurb: 'YOUR STEEL STRIKES AS MAGIC', effect: { kind: 'HEX_STRIKE' } } },
  { id: 'HEART_LOCKET', name: 'HEART LOCKET', slot: 'NECKLACE', rarity: 'RARE', mods: { mdef: 14, hpRegen: 3 }, effect: { kind: 'DRAIN', fraction: 0.11 }, blurb: '+3 HP A TURN. SIPS LIFE',
    awaken: { blurb: 'DRINKS 30%. MENDS MORE', mods: { hpRegen: 2 }, effect: { kind: 'DRAIN', fraction: 0.3 } } },
  { id: 'SAGE_PENDANT', name: 'SAGE PENDANT', slot: 'NECKLACE', rarity: 'EPIC', mods: { mdef: 26, mp: 8 }, effect: { kind: 'MP_ON_HIT', amount: 3 }, blurb: 'EVERY HIT RESTORES 3 MP', minAct: 1,
    awaken: { blurb: 'EVERY HIT RESTORES 5 MP', mods: { mp: 6 }, effect: { kind: 'MP_ON_HIT', amount: 5 } } },
  { id: 'PHOENIX_TEAR', name: 'PHOENIX TEAR', slot: 'NECKLACE', rarity: 'LEGENDARY', mods: { mdef: 22, hp: 10 }, effect: { kind: 'REVIVE', hpFraction: 0.5 }, blurb: 'CHEAT DEATH ONCE PER RUN', minAct: 2 },

  // --- BOOTS: dodge, crit, opening blows -----------------------------------
  { id: 'WORN_SHOES', name: 'WORN SHOES', slot: 'BOOTS', rarity: 'COMMON', mods: { dodge: 6 }, effect: { kind: 'NONE' }, blurb: 'THIN SOLES, QUICK STEPS',
    awaken: { blurb: 'FIRST ACTION HITS 1.4X', effect: { kind: 'FIRST_STRIKE', mult: 1.4 } } },
  { id: 'SWIFT_BOOTS', name: 'SWIFT BOOTS', slot: 'BOOTS', rarity: 'COMMON', mods: { dodge: 12 }, effect: { kind: 'NONE' }, blurb: 'LIGHT ENOUGH TO SLIP HITS', minAct: 1,
    awaken: { blurb: 'FAST FEET STRIKE TWICE', mods: { dodge: 4 }, effect: { kind: 'TWIN_STRIKE', secondHitMult: 0.3 } } },
  { id: 'LUCKY_BOOTS', name: 'LUCKY BOOTS', slot: 'BOOTS', rarity: 'RARE', mods: { dodge: 8, crit: 15 }, effect: { kind: 'FIRST_STRIKE', mult: 1.8 }, blurb: '+15% CRIT. OPENS AT 1.8X',
    awaken: { blurb: 'OPENS AT 2.4X. +4% DODGE', mods: { dodge: 4 }, effect: { kind: 'FIRST_STRIKE', mult: 2.4 } } },
  { id: 'WIND_GREAVES', name: 'WIND GREAVES', slot: 'BOOTS', rarity: 'EPIC', mods: { dodge: 16, crit: 10 }, effect: { kind: 'FIRST_STRIKE', mult: 2.6 }, blurb: 'FIRST ACTION HITS 2.6X', minAct: 1,
    awaken: { blurb: 'OPENS AT 3.4X. +4% DODGE', mods: { dodge: 4 }, effect: { kind: 'FIRST_STRIKE', mult: 3.4 } } },

  // --- CHALICE: mp regen, and the two that ask for blood -------------------
  { id: 'TIN_CUP', name: 'TIN CUP', slot: 'CHALICE', rarity: 'COMMON', mods: { mpRegen: 1 }, effect: { kind: 'NONE' }, blurb: 'DENTED. STILL HOLDS MANA',
    awaken: { blurb: 'ALSO MENDS 1 HP A TURN', mods: { hpRegen: 1 } } },
  { id: 'SILVER_CUP', name: 'SILVER CUP', slot: 'CHALICE', rarity: 'COMMON', mods: { mpRegen: 2 }, effect: { kind: 'NONE' }, blurb: '+2 MP EVERY TURN', minAct: 1,
    awaken: { blurb: 'EVERY SPELL COSTS 1 LESS', mods: { mpRegen: 1 }, effect: { kind: 'CHEAPER_SPELLS', amount: 1 } } },
  { id: 'EMBER_CUP', name: 'EMBER CUP', slot: 'CHALICE', rarity: 'RARE', mods: { mpRegen: 2, mag: 4 }, effect: { kind: 'RAMP', perStack: 0.08, maxStacks: 4, scope: 'SPELL' }, blurb: '+8% PER SPELL IN A ROW',
    awaken: { blurb: 'FIRST ACTION BURNS AT 2X', mods: { mag: 3 }, effect: { kind: 'FIRST_STRIKE', mult: 2.0 } } },
  { id: 'HOLY_GRAIL', name: 'HOLY GRAIL', slot: 'CHALICE', rarity: 'EPIC', mods: { mpRegen: 3, hpRegen: 3 }, effect: { kind: 'CHEAPER_SPELLS', amount: 1 }, blurb: '+3 HP +3 MP EVERY TURN', minAct: 1,
    awaken: { blurb: 'CHEAT DEATH TWICE PER RUN', effect: { kind: 'REVIVE', hpFraction: 0.5, twice: true } } },
  { id: 'BLOOD_CUP', name: 'BLOOD CUP', slot: 'CHALICE', rarity: 'LEGENDARY', mods: { mpRegen: 4, hpRegen: 4, atk: 6, mag: 6 }, effect: { kind: 'BLOOD', hpPerTurn: 4 }, blurb: 'POWER AND REGEN. IT BITES', minAct: 2 },

  // --- BOSS SIGNATURES: never rolled; only that boss's own loot table ------
  // One per boss, offered as card 2 of the three the boss puts up (the other
  // two are the act's spell SCROLL and one rolled RARE+). `minAct` is the act
  // the boss lives in, so the gate matches the only place it can appear.
  { id: 'DARK_CROWN', name: 'DARK CROWN', slot: 'NECKLACE', rarity: 'EPIC', mods: { mdef: 22, mag: 6 }, effect: { kind: 'MP_ON_HIT', amount: 3 }, blurb: 'IT DRINKS PAIN, PAYS MANA', minAct: 0, bossOnly: 'DARK_LORD',
    awaken: { blurb: 'DRINKS DEEPER: 5 MP A HIT', mods: { hp: 8 }, effect: { kind: 'MP_ON_HIT', amount: 5 } } },
  { id: 'YETI_HIDE', name: 'YETI HIDE', slot: 'ARMOR', rarity: 'EPIC', mods: { def: 28, hpRegen: 3 }, effect: { kind: 'DRAIN', fraction: 0.1 }, blurb: 'STILL WARM. IT SIPS LIFE', minAct: 1, bossOnly: 'YETI',
    awaken: { blurb: 'THE PELT KNITS: +3 HP/TURN', mods: { hpRegen: 3 }, effect: { kind: 'DRAIN', fraction: 0.14 } } },
  { id: 'GOLEM_FIST', name: 'GOLEM FIST', slot: 'WEAPON', rarity: 'EPIC', weaponKind: 'PHYSICAL', mods: { atk: 15 }, effect: { kind: 'FIRST_STRIKE', mult: 2.2 }, blurb: 'OPENS AT 2.2X. STONE HAND', minAct: 2, bossOnly: 'SAND_GOLEM',
    awaken: { blurb: 'STACKS NEVER FALL: +12% EA', effect: { kind: 'RAMP', perStack: 0.12, maxStacks: 5, scope: 'ATTACK', sticky: true } } },

  // --- TOME: each grants one extra spell while equipped --------------------
  { id: 'SPARK_TOME', name: 'SPARK TOME', slot: 'TOME', rarity: 'RARE', mods: { mag: 3 }, effect: { kind: 'GRANT_SPELL', spell: 'TWINBOLT' }, blurb: 'TWINBOLT: TWO FORKED HITS',
    awaken: { blurb: 'TWINBOLT COSTS 3 LESS MP', mods: { mag: 3 }, effect: { kind: 'GRANT_SPELL', spell: 'TWINBOLT', discount: 3 } } },
  { id: 'LEECH_TOME', name: 'LEECH TOME', slot: 'TOME', rarity: 'RARE', mods: { mp: 5 }, effect: { kind: 'GRANT_SPELL', spell: 'LEECH' }, blurb: 'LEECH: STEAL 40% AS LIFE',
    awaken: { blurb: 'LEECH COSTS 2 LESS MP', mods: { mp: 4 }, effect: { kind: 'GRANT_SPELL', spell: 'LEECH', discount: 2 } } },
  { id: 'STONE_TOME', name: 'STONE TOME', slot: 'TOME', rarity: 'EPIC', mods: { atk: 4 }, effect: { kind: 'GRANT_SPELL', spell: 'QUAKE' }, blurb: 'QUAKE: BIG PHYSICAL BLOW', minAct: 1,
    awaken: { blurb: 'QUAKE COSTS 3 LESS MP', mods: { atk: 3 }, effect: { kind: 'GRANT_SPELL', spell: 'QUAKE', discount: 3 } } },
  { id: 'LIFE_TOME', name: 'LIFE TOME', slot: 'TOME', rarity: 'EPIC', mods: { mp: 6 }, effect: { kind: 'GRANT_SPELL', spell: 'MEND' }, blurb: 'MEND: HEAL 35% MAX HP', minAct: 1,
    awaken: { blurb: 'MEND COSTS 2 LESS MP', mods: { mp: 4 }, effect: { kind: 'GRANT_SPELL', spell: 'MEND', discount: 2 } } },
];

// ------------------------------------------------------------------ loot ----
// One [COMMON, RARE, EPIC, LEGENDARY] weight tuple per act (index 0..3).
// Weights drift toward rare as the run deepens; BOSS never rolls COMMON.
export const LOOT_WEIGHTS: Record<LootSource, Array<[number, number, number, number]>> = {
  FIGHT: [[70, 25, 5, 0], [60, 30, 9, 1], [50, 35, 13, 2], [40, 40, 17, 3]],
  ELITE: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10]],
  LOOT: [[35, 45, 17, 3], [28, 44, 23, 5], [21, 42, 29, 8], [15, 40, 35, 10]],
  BOSS: [[0, 40, 45, 15], [0, 33, 47, 20], [0, 27, 48, 25], [0, 20, 50, 30]],
};

/**
 * How many cards the loot screen offers (player may always decline for a mend).
 * BOSS is 3: the act's spell SCROLL, that boss's signature item, and one rolled
 * RARE+ (or the oldest scroll the player has already turned down).
 */
export const LOOT_COUNT: Record<LootSource, number> = { FIGHT: 1, ELITE: 3, LOOT: 2, BOSS: 3 };

// --------------------------------------------------------------- enemies ----
// def/mdef are percentage resists and are the tactical puzzle: SKELETON and
// SAND GOLEM shrug off steel, FROST WISP and SERAPH shrug off spells.
// Scaling: (base + perClear * clears) * ACT_MULT[act] * mult.
export const ENEMIES: Record<string, EnemyDef> = {
  // --- THE CRYPT ---
  SLIME: { id: 'SLIME', name: 'SLIME', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 36, hpPerClear: 5, atkBase: 3.5, atkPerClear: 0.26, def: 0, mdef: 0, mult: 1, trait: 'GOOEY' },
  GOBLIN: { id: 'GOBLIN', name: 'GOBLIN', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 38, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 0, mdef: 0, mult: 1, trait: 'SNEAKY' },
  SKELETON: { id: 'SKELETON', name: 'SKELETON', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 40, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 30, mdef: 0, mult: 1, trait: 'BONY' },
  OGRE_KING: { id: 'OGRE_KING', name: 'OGRE KING', kind: 'ELITE', atkType: 'PHYSICAL', hpBase: 52, hpPerClear: 7, atkBase: 3.8, atkPerClear: 0.42, def: 15, mdef: 0, mult: 1, trait: 'BRUTAL' },
  WRAITH_LORD: { id: 'WRAITH_LORD', name: 'WRAITH LORD', kind: 'ELITE', atkType: 'MAGIC', hpBase: 52, hpPerClear: 7, atkBase: 3.8, atkPerClear: 0.42, def: 12, mdef: 10, mult: 1, trait: 'SPECTRAL' },
  DARK_LORD: { id: 'DARK_LORD', name: 'DARK LORD', kind: 'BOSS', atkType: 'MAGIC', hpBase: 95, hpPerClear: 4, atkBase: 6.6, atkPerClear: 0.5, def: 15, mdef: 15, mult: 1.0, trait: 'DREAD' },

  // --- THE TUNDRA ---
  ICE_WOLF: { id: 'ICE_WOLF', name: 'ICE WOLF', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 36, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 5, mdef: 5, mult: 1, trait: 'PACK HUNTER' },
  ICE_BEAR: { id: 'ICE_BEAR', name: 'ICE BEAR', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 15, mdef: 0, mult: 1, trait: 'THICK HIDE' },
  FROST_WISP: { id: 'FROST_WISP', name: 'FROST WISP', kind: 'ELITE', atkType: 'MAGIC', hpBase: 76, hpPerClear: 7, atkBase: 5.2, atkPerClear: 0.42, def: 0, mdef: 35, mult: 1, trait: 'SPECTRAL' },
  YETI: { id: 'YETI', name: 'YETI', kind: 'BOSS', atkType: 'PHYSICAL', hpBase: 120, hpPerClear: 6, atkBase: 8.4, atkPerClear: 0.42, def: 20, mdef: 10, mult: 1.17, trait: 'FURIOUS' },

  // --- THE DESERT ---
  SANDWORM: { id: 'SANDWORM', name: 'SANDWORM', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 10, mdef: 0, mult: 1, trait: 'BURROWS' },
  SCORPION: { id: 'SCORPION', name: 'SCORPION', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 38, hpPerClear: 5, atkBase: 4, atkPerClear: 0.26, def: 5, mdef: 10, mult: 1, trait: 'VENOMOUS' },
  MUMMY: { id: 'MUMMY', name: 'MUMMY', kind: 'ELITE', atkType: 'MAGIC', hpBase: 78, hpPerClear: 7, atkBase: 5.6, atkPerClear: 0.42, def: 10, mdef: 25, mult: 1, trait: 'CURSED' },
  SAND_GOLEM: { id: 'SAND_GOLEM', name: 'SAND GOLEM', kind: 'BOSS', atkType: 'PHYSICAL', hpBase: 215, hpPerClear: 6, atkBase: 8.2, atkPerClear: 0.26, def: 40, mdef: 5, mult: 1.15, trait: 'STONE SKIN' },

  // --- HOLY TEMPLE ---
  GUARDIAN: { id: 'GUARDIAN', name: 'GUARDIAN', kind: 'NORMAL', atkType: 'PHYSICAL', hpBase: 42, hpPerClear: 5, atkBase: 4.2, atkPerClear: 0.26, def: 25, mdef: 0, mult: 1, trait: 'ARMORED' },
  ORACLE: { id: 'ORACLE', name: 'ORACLE', kind: 'NORMAL', atkType: 'MAGIC', hpBase: 36, hpPerClear: 5, atkBase: 3.8, atkPerClear: 0.26, def: 0, mdef: 25, mult: 1, trait: 'FARSEEING' },
  PALADIN: { id: 'PALADIN', name: 'PALADIN', kind: 'ELITE', atkType: 'PHYSICAL', hpBase: 96, hpPerClear: 7, atkBase: 6.0, atkPerClear: 0.42, def: 25, mdef: 15, mult: 1, trait: 'BLESSED' },
  SERAPH: { id: 'SERAPH', name: 'THE SERAPH', kind: 'BOSS', atkType: 'MAGIC', hpBase: 172, hpPerClear: 7, atkBase: 7.8, atkPerClear: 0.22, def: 15, mdef: 30, mult: 1.25, trait: 'DIVINE' },
};

// ---------------------------------------------------------------- biomes ----
// `scroll` is the spell the act's BOSS offers as one of its three cards — it is
// no longer learned for free on act entry, so it sits one act EARLIER than the
// old `learn` field did. The Temple boss ends the run, so it offers no scroll.
export const BIOMES: Biome[] = [
  { name: 'THE CRYPT', normals: ['SLIME', 'GOBLIN', 'SKELETON'], elites: ['OGRE_KING', 'WRAITH_LORD'], boss: 'DARK_LORD', scroll: 'WATER' },
  { name: 'THE TUNDRA', normals: ['ICE_WOLF', 'ICE_BEAR'], elites: ['FROST_WISP'], boss: 'YETI', scroll: 'SLASH' },
  { name: 'THE DESERT', normals: ['SANDWORM', 'SCORPION'], elites: ['MUMMY'], boss: 'SAND_GOLEM', scroll: 'THUNDER' },
  { name: 'HOLY TEMPLE', normals: ['GUARDIAN', 'ORACLE'], elites: ['PALADIN'], boss: 'SERAPH' },
];

// ------------------------------------------------------------------ knobs ---
/** Multiplies enemy hp and atk, per act. */
export const ACT_MULT = [1.0, 1.38, 2.2, 3.1];
/** Fraction of max HP/MP restored on clearing any node. */
export const CLEAR_HEAL = 0.25;
/** Fraction of max HP restored on entering a boss node. */
export const BOSS_ENTRY_HEAL = 0.6;
/** Fraction of max HP restored when the player declines every loot card. */
export const SKIP_MEND = 0.25;

/** PICO8 indices for rarity text: grey, blue, pink, yellow. */
export const RARITY_COLOR_INDEX: Record<Rarity, number> = { COMMON: 6, RARE: 12, EPIC: 14, LEGENDARY: 10 };

// ------------------------------------------------------------- self-check ---
/** Every ItemEffect kind, exhaustively — the compiler fails if one is missing. */
const EFFECT_KINDS: Record<ItemEffect['kind'], true> = {
  NONE: true, HEX_STRIKE: true, RAMP: true, TWIN_STRIKE: true, SPELL_TWICE: true,
  CHEAPER_SPELLS: true, DRAIN: true, REFLECT: true, REVIVE: true, MP_ON_HIT: true,
  GLASS: true, BLOOD: true, EXECUTE: true, FIRST_STRIKE: true, GRANT_SPELL: true,
};

/**
 * Dev-only table check — main.ts calls this once at boot in dev and logs the
 * result. Returns [] when the content is legal.
 */
export function validateData(): string[] {
  const bad: string[] = [];
  const seen = new Set<string>();
  const usedKinds = new Set<string>();

  for (const it of ITEMS) {
    if (seen.has(it.id)) bad.push('duplicate item id ' + it.id);
    seen.add(it.id);
    if (it.name.length > 13) bad.push(it.id + ': name ' + it.name.length + ' chars');
    if (it.name !== it.name.toUpperCase()) bad.push(it.id + ': name not uppercase');
    if (it.blurb.length > 30) bad.push(it.id + ': blurb ' + it.blurb.length + ' chars');
    if (it.blurb !== it.blurb.toUpperCase()) bad.push(it.id + ': blurb not uppercase');
    if (it.rarity !== 'COMMON' && it.effect.kind === 'NONE') bad.push(it.id + ': non-common with no effect');
    if (it.rarity === 'COMMON' && it.effect.kind !== 'NONE') bad.push(it.id + ': common with an effect');
    if (it.slot === 'TOME' && it.effect.kind !== 'GRANT_SPELL') bad.push(it.id + ': tome must grant a spell');
    if (it.slot === 'WEAPON' && !it.weaponKind) bad.push(it.id + ': weapon needs a weaponKind');
    if (it.slot !== 'WEAPON' && it.weaponKind) bad.push(it.id + ': non-weapon with a weaponKind');
    if (it.effect.kind === 'GRANT_SPELL' && !SPELLS[it.effect.spell]) bad.push(it.id + ': grants unknown spell');
    if (it.effect.kind === 'SPELL_TWICE' && !SPELLS[it.effect.spell]) bad.push(it.id + ': doubles unknown spell');
    if ('learn' in (it as unknown as Record<string, unknown>)) bad.push(it.id + ': still uses learn');
    usedKinds.add(it.effect.kind);

    // --- upgrades: +2 awakenings ------------------------------------------
    const aw = it.awaken;
    if (it.rarity === 'LEGENDARY') {
      if (aw) bad.push(it.id + ': legendary must not awaken');
    } else if (!aw) {
      bad.push(it.id + ': missing awaken (+2)');
    } else {
      if (aw.blurb.length > 30) bad.push(it.id + ': awaken blurb ' + aw.blurb.length + ' chars');
      if (aw.blurb !== aw.blurb.toUpperCase()) bad.push(it.id + ': awaken blurb not uppercase');
      if (aw.blurb === it.blurb) bad.push(it.id + ': awaken blurb same as base');
      const modKeys = aw.mods ? Object.keys(aw.mods).length : 0;
      if (!aw.effect && modKeys === 0) bad.push(it.id + ': awaken changes nothing');
      if (aw.effect) {
        if (!(aw.effect.kind in EFFECT_KINDS)) bad.push(it.id + ': awaken uses unknown effect kind');
        if (aw.effect.kind === 'NONE') bad.push(it.id + ': awaken effect must not be NONE');
        if (aw.effect.kind === 'GRANT_SPELL') {
          if (!SPELLS[aw.effect.spell]) bad.push(it.id + ': awaken grants unknown spell');
          const disc = aw.effect.discount ?? 0;
          if (disc < 0 || disc >= SPELLS[aw.effect.spell].cost) bad.push(it.id + ': awaken discount out of range');
        }
        if (aw.effect.kind === 'SPELL_TWICE' && !SPELLS[aw.effect.spell]) bad.push(it.id + ': awaken doubles unknown spell');
        if (it.slot === 'TOME') {
          if (aw.effect.kind !== 'GRANT_SPELL') bad.push(it.id + ': tome awaken must grant a spell');
          else if (it.effect.kind === 'GRANT_SPELL' && aw.effect.spell !== it.effect.spell) {
            bad.push(it.id + ': tome awaken changes its spell');
          }
        }
      }
    }
  }
  for (const kind of Object.keys(EFFECT_KINDS)) {
    if (!usedKinds.has(kind)) bad.push('effect kind never used: ' + kind);
  }

  // --- boss signatures: one per boss, and that boss must exist and be a BOSS -
  const signatureOf = new Map<string, string>();
  for (const it of ITEMS) {
    if (!it.bossOnly) continue;
    const boss = ENEMIES[it.bossOnly];
    if (!boss) bad.push(it.id + ': bossOnly names unknown enemy ' + it.bossOnly);
    else if (boss.kind !== 'BOSS') bad.push(it.id + ': bossOnly ' + it.bossOnly + ' is not a BOSS');
    const already = signatureOf.get(it.bossOnly);
    if (already) bad.push(it.bossOnly + ': two signature items (' + already + ', ' + it.id + ')');
    else signatureOf.set(it.bossOnly, it.id);
  }

  for (const id of SPELL_ORDER) {
    if (!SPELLS[id]) bad.push('SPELL_ORDER lists unknown spell ' + id);
  }
  for (const id of Object.keys(SPELLS) as Array<keyof typeof SPELLS>) {
    if (!SPELL_ORDER.includes(id)) bad.push('spell missing from SPELL_ORDER: ' + id);
    if (SPELLS[id].name.length > 9) bad.push(id + ': spell name too long');
  }

  for (const e of Object.values(ENEMIES)) {
    if (e.name.length > 12) bad.push(e.id + ': enemy name ' + e.name.length + ' chars');
    if (e.trait && e.trait.length > 14) bad.push(e.id + ': trait too long');
    if (e.def < 0 || e.def > 40 || e.mdef < 0 || e.mdef > 40) bad.push(e.id + ': resist out of 0..40');
  }

  const usedEnemies = new Set<string>();
  const scrollsSeen = new Set<string>();
  for (let bi = 0; bi < BIOMES.length; bi += 1) {
    const b = BIOMES[bi];
    if (b.name.length > 12) bad.push(b.name + ': biome name too long');
    if (b.scroll) {
      if (scrollsSeen.has(b.scroll)) bad.push(b.name + ': scroll ' + b.scroll + ' offered twice');
      scrollsSeen.add(b.scroll);
    }
    for (const id of [...b.normals, ...b.elites, b.boss]) {
      if (!ENEMIES[id]) bad.push(b.name + ': unknown enemy ' + id);
      else usedEnemies.add(id);
    }
    // `learn` was the old auto-taught act-entry spell; `scroll` replaced it.
    if ('learn' in (b as unknown as Record<string, unknown>)) bad.push(b.name + ': still uses learn, rename to scroll');
    if (b.scroll) {
      if (!SPELLS[b.scroll]) bad.push(b.name + ': scroll is an unknown spell');
      if (b.scroll === 'FIREBALL') bad.push(b.name + ': scroll must not be FIREBALL (known at start)');
    }
    if (ENEMIES[b.boss] && ENEMIES[b.boss].kind !== 'BOSS') bad.push(b.name + ': boss is not a BOSS');
    const sig = signatureOf.get(b.boss);
    if (sig) {
      const item = ITEMS.find((i) => i.id === sig);
      if (item && (item.minAct ?? 0) !== bi) bad.push(sig + ': minAct should be ' + bi + ' (its boss lives there)');
    }
  }
  for (const id of Object.keys(ENEMIES)) {
    if (!usedEnemies.has(id)) bad.push('enemy in no biome: ' + id);
  }

  for (const src of Object.keys(LOOT_WEIGHTS) as LootSource[]) {
    const rows = LOOT_WEIGHTS[src];
    if (rows.length !== 4) bad.push(src + ': needs one weight row per act');
    rows.forEach((row, act) => {
      const sum = row[0] + row[1] + row[2] + row[3];
      if (sum !== 100) bad.push(src + ' act ' + act + ': weights sum to ' + sum);
    });
  }
  for (const src2 of Object.keys(LOOT_WEIGHTS) as LootSource[]) {
    const n = LOOT_COUNT[src2];
    if (!Number.isInteger(n) || n < 1) bad.push(src2 + ': LOOT_COUNT must be a positive integer');
  }
  if (ACT_MULT.length !== BIOMES.length) bad.push('ACT_MULT must have one entry per biome');

  return bad;
}
