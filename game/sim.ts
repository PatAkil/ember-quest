export {
  canUpgradeAny,
  displayName,
  effectiveBlurb,
  effectiveEffect,
  effectiveMods,
  itemLevel,
  maxLevelFor,
  scaleEffect,
} from './sim/gear';
export {
  createHero,
  derive,
  enterActRecovery,
  equip,
  fullHeal,
  grantClear,
  healFraction,
  heroActions,
  isSpell,
  knownSpells,
  learnSpell,
  refillPotions,
  skipMend,
  spellCost,
  spendPoint,
  takePact,
} from './sim/hero';
export {
  awakenPreview,
  compareFull,
  compareLine,
  compareOffer,
  describeItem,
  describeOffer,
  type CompareRow,
  type FullCompare,
} from './sim/describe';
export { applyOffer, ensureStarterWeapon, noteDeclinedScrolls, resolveOverflow, resolveUpgrade, rollLoot, type AppliedOffer, type OfferChoice } from './sim/loot';
export { discard, ownedIds, packSize, stow, swapIn, unequip, upgradableTargets } from './sim/pack';
export { clearsTerm, createBattle, expectedHeroDamage, heroAct, rollScript, spawnEnemy, type RollPlan } from './sim/combat';
export { ENRAGE_LINE, enemyAct, expectedFoeDamage, type FoeBlowEstimate } from './sim/enemy-turn';
export { resolveTurn, turnRng, turnSeed, type TurnStream } from './sim/turn';
export {
  breakFacts,
  burstKind,
  expectedPlan,
  expectedPreBlowLoss,
  guardFacts,
  healPreview,
  preBlowFate,
  strikeFacts,
  strikeKind,
  type BreakFacts,
  type Fate,
  type FateCause,
  type GuardFacts,
  type PreBlow,
  type StrikeAction,
  type StrikeFacts,
} from './sim/preview';
export { canAfford, canDrinkPotion, livesLeft, pendingTick, resistOf, startTurn } from './sim/status';
export { elementMult } from './sim/element';
export { burstPower } from './sim/burst';
export { burnWarded, desperate, gearPower, heroElement, punishes, riposteMult, woundUp } from './sim/power';
export type { Policy, RoomType } from './sim/model';
export { POLICIES, type PolicyName } from './sim/policies';
export { generateMap, MAP_SHAPE, rollAffixes, type FoePools } from './sim/map';
export { at, createSeededRng, pickOneIndex, type SeededRng } from './sim/util';
export { runBattle } from './sim/run-battle';
export { SIM_MAX_N, simulateRun, type BossPick, type Probe, type RunResult, type SimOptions } from './sim/run';
export {
  actInDepth,
  actMult,
  affixCountFor,
  depthAffixes,
  depthOf,
  descentStageSizes,
  descentWeights,
  inDescent,
  firstActOf,
  isLastActOfDepth,
  planDepth,
  planOf,
  storyAct,
  storyPlan,
  type ActPlan,
  type ActRef,
} from './sim/descent';
export { affixPool, affixResists, searingStrike, swiftEvades, thornsDamage, vampiricHeal } from './sim/affixes';
export { foeAffixes, hollowAffixes, hollowOf, spawnFoe, type SpawnContext } from './sim/hollow';
export { descentRow, lootWeights } from './sim/descent-loot';
export { restHero, type RestOutcome } from './sim/rest';
export { describeSave, fromSaved, loadRun, saveRun, SAVE_VERSION, toSaved, type RunSnapshot, type SavedRun, type SavedStep, type RewardSource, type SavedBattle, type SavedFoe } from './sim/save';
export { lootCards, neutralMods, offerPacts, pactDamage, pactMods, type PactTotals } from './sim/pacts';
export { gloryBonus, scoreAfterDeath, scoreOf } from './sim/score';
export { ACT_MULT, BIOMES, ITEMS, LOOT_WEIGHTS, PACTS, validateData, validatePacts } from './data';
export {
  AFFIX_EVADE,
  AFFIX_IDS,
  AFFIX_LIFESTEAL,
  AFFIX_MAX,
  AFFIX_THORNS,
  AFFIX_THORNS_CAP,
  DESCENT_GROWTH,
  DESCENT_LEGENDARY_CAP,
  DESCENT_PHASE_AT,
  DESCENT_STAGE_MAX,
  ENRAGE_AFTER,
  HOLLOW_ATK_SHARE,
  HOLLOW_HIT_CAP,
  HOLLOW_HIT_FLOOR,
  HOLLOW_HP_FLOOR,
  HOLLOW_HP_HITS,
  HOLLOW_RES_CAP,
  HOLLOW_SWIFT_DODGE,
  REST_MEND,
} from './types';
export { EVENTS, QUIET_EVENT, validateEvents } from './data';
export {
  appliedWords,
  applyEventCosts,
  effectIsGain,
  effectWords,
  eventOptionBlocker,
  eventOptionEnabled,
  eventById,
  eventPlayable,
  pickEvent,
  rollEventItem,
  screenEffectOf,
  takePendingBurn,
  type AppliedEffect,
  type ScreenEffect,
} from './sim/events';
export { randomEventChoice } from './sim/policy-choices';
