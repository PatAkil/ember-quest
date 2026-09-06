/**
 * actors-late.ts — the actor recipes for the acts 3-6 enemy packs: SKY RUINS,
 * ASHEN FORGE, SUNKEN VAULT and STORM SPIRE (game/data/enemies.ts's acts 3-6,
 * DESIGN.md's four biome tables).
 *
 * CONTRACT. `lateRecipes()` BUILDS and returns the recipes when it is CALLED.
 * Nothing here may touch actors.ts's module-level consts at load time: actors.ts
 * imports this module, so the two form an import cycle and those consts are
 * still in their temporal dead zone while this module body evaluates. Every
 * palette, ramp and recipe therefore lives INSIDE the function; only hoisted
 * function declarations from actors.ts may be called from in it, and they are
 * called after actors.ts has finished initialising.
 *
 * WHAT EACH SPRITE HAS TO SHOW. A sentinel guards, a priest tempers, a hawk
 * dives: the kit in game/data/skills.ts is the brief for the silhouette, and
 * each pack has to read against ITS OWN floor — the four `BiomeLook.ground.lit`
 * inks in game/art/backdrops.ts, not the line-up's navy. That is why the ruins
 * are warm sandstone over a violet floor, the vault is bronze and kelp over a
 * teal one, and the spire is brass over blue-grey.
 */
import { boss, creature, humanoid, glowRamp, ramp, registerRecoilArms } from './actors';
import type { ActorRecipe } from './actors';
import type { Ramp } from './parts';

/**
 * ROUND 11 — THE RECOIL ARMS, reachable at last. `RECOIL_ARMS` was a module
 * const in actors.ts, so the `arms_*_hurt` grids parts-late.ts authored in the
 * late-enemy round were registered and unreachable: the recoil was carried by a
 * sheared torso alone, and the round-10 critic measured six of these humanoids
 * driving the head DOWN three cells on hurt 0 (crownDy +3) — the exact defect
 * round 10 had just closed on the nineteen. `registerRecoilArms` (artist A's
 * hook) folds these pairs into the same table the nineteen are found in, so the
 * far arm is now flung up and out off the blow and the weapon arm drops back to
 * the hip, on every one of the thirteen.
 */
const LATE_RECOIL_ARMS: Record<string, string> = {
  arms_stone: 'arms_stone_hurt',
  arms_slag: 'arms_slag_hurt',
  arms_apron: 'arms_apron_hurt',
  arms_furnace: 'arms_furnace_hurt',
  arms_vestment: 'arms_vestment_hurt',
  arms_bronze: 'arms_bronze_hurt',
  arms_shell: 'arms_shell_hurt',
  arms_late_bare: 'arms_late_bare_hurt',
  arms_brass: 'arms_brass_hurt',
  arms_granite: 'arms_granite_hurt',
  arms_seraph: 'arms_seraph_hurt',
};

export function lateRecipes(): Record<string, ActorRecipe> {
  registerRecoilArms(LATE_RECOIL_ARMS);
  // ---- SKY RUINS (act 3) ------------------------------------------------------
  // Weathered sandstone, wind-green and a pale sky, read against RUINS_GROUND's
  // violet-grey floor (#57506f) — the lightest of the four. Grey stone would be
  // a hole in that floor, so the masonry here is WARM and the wind is GREEN.
  const RUIN_STONE: Ramp = ramp(34, 11, 44, { mid: -8, lit: -12, spec: -12, plane: 3 }); // the sentinel's masonry, ten L under the floor it stands on
  const RUIN_RUNE: Ramp = ramp(122, 22, 40); // carved bands, the one chromatic thing on it
  const RAPTOR_PLUME: Ramp = ramp(52, 21, 44, { mid: -9, lit: -4, plane: 1 }); // straw-pale plumage: the raptor reads light where the sentinel reads dark
  const RAPTOR_COVERT: Ramp = ramp(128, 15, 40, { mid: -9, lit: -4, plane: 1 });
  const RAPTOR_HIDE: Ramp = ramp(26, 27, 38); // beak, scaled legs and talons
  const SPRITE_AIR: Ramp = ramp(150, 15, 48);
  const SPRITE_CURRENT: Ramp = ramp(166, 22, 40);
  const STORM_SLATE: Ramp = ramp(216, 14, 42);
  const RAIN: Ramp = ramp(202, 27, 46);
  const DRAKE_HIDE: Ramp = ramp(158, 19, 38);
  const DRAKE_MEMBRANE: Ramp = ramp(136, 13, 46);
  const DRAKE_HORN: Ramp = ramp(48, 13, 48);
  const SKY_SILVER: Ramp = ramp(272, 11, 47); // the king's tarnished plate
  const SKY_SURCOAT: Ramp = ramp(238, 23, 34); // a storm indigo, well off HOLLOW_KING's lavender and off the ruins' own violet floor
  const SKY_MASONRY: Ramp = ramp(38, 13, 52); // the sheared wing stump and the cracked crown

  const ruins: Record<string, ActorRecipe> = {
    // A diver at rest: two folded wing peaks ABOVE the shoulder line, a hooked
    // beak on a short pitched neck, a long stiff tail counterweighting it. GALE
    // DIVE throws both wings open and drives the talons nine cells forward.
    RUIN_RAPTOR: creature({
      id: 'RUIN_RAPTOR',
      element: 'WIND',
      idle: ['raptor_body', 'raptor_body_b', 'raptor_body_c'],
      wind: 'raptor_wind',
      strike: 'raptor_strike',
      hurt: 'raptor_hurt',
      dead: ['raptor_dead'],
      settle: { part: 'raptor_settle' },
      palette: { bone: RAPTOR_PLUME, accent: RAPTOR_COVERT, leather: RAPTOR_HIDE },
    }),
    // DAZZLE GUST blinds: a coil of moving air with a lit heart and two slits,
    // wound tight on the wind-up and flung open on the strike. No facet on it
    // anywhere — the frost wisp is the shard, this is the wind.
    WIND_SPRITE: creature({
      id: 'WIND_SPRITE',
      element: 'WIND',
      idle: ['sprite_body', 'sprite_body_b', 'sprite_body_c'],
      wind: 'sprite_wind',
      strike: 'sprite_strike',
      hurt: 'sprite_hurt',
      dead: ['sprite_dead', 'sprite_dead_b'],
      settle: { part: 'sprite_settle' },
      palette: { cloth: SPRITE_AIR, accent: SPRITE_CURRENT, glow: glowRamp(96, 58, 93) },
    }),
    // WARD STONE and MEND ECHO: masonry that guards. A lintel of shoulder past
    // the hips, a rune band that is the only lit thing on the chest, a keystone
    // belt and a slab skirt — and a ward slab it swings on a short haft.
    RUIN_SENTINEL: humanoid({
      id: 'RUIN_SENTINEL',
      element: 'WIND',
      body: 'sentinel_body',
      head: 'sentinel_head',
      arms: 'arms_stone',
      weapon: 'ward_stone',
      fingers: 'fingers_stone',
      fallen: 'fallen_stone',
      down: 'sentinel_head_down',
      tilt: 'sentinel_head_tilt',
      recoilBody: 'sentinel_body_hurt',
      recoilDx: -9,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'sentinel_head_sway',
      sway2: 'sentinel_head_sway2',
      swayBody: 'sentinel_body_sway',
      palette: { metal: RUIN_STONE, accent: RUIN_RUNE, glow: glowRamp(104, 60, 86) },
    }),
    // The WATER foil: all mass and no limb. Four lobes of unequal size over a
    // curtain of rain, two dim lights low in it, and DOWNPOUR drops the whole
    // curtain nine cells with the bolt it has been holding.
    DROWNED_CLOUD: creature({
      id: 'DROWNED_CLOUD',
      element: 'WATER',
      idle: ['cloud_body', 'cloud_body_b', 'cloud_body_c'],
      wind: 'cloud_wind',
      strike: 'cloud_strike',
      hurt: 'cloud_hurt',
      dead: ['cloud_dead'],
      settle: { part: 'cloud_body', dy: -1 },
      palette: { cloth: STORM_SLATE, accent: RAIN, glow: glowRamp(190, 52, 88) },
    }),
    // The elite is the wingspan: TEMPEST WING and GALE BREATH, so the membranes
    // carry the silhouette and the head is a nozzle on a long neck.
    STORM_DRAKE: creature({
      id: 'STORM_DRAKE',
      element: 'WIND',
      idle: ['drake_body', 'drake_body_b', 'drake_body_c'],
      wind: 'drake_wind',
      strike: 'drake_strike',
      hurt: 'drake_hurt',
      dead: ['drake_dead'],
      settle: { part: 'drake_settle' },
      palette: { leather: DRAKE_HIDE, cloth2: DRAKE_MEMBRANE, bone: DRAKE_HORN },
    }),
    // The lord the ruins fell with: one wing sheared to a stump of masonry, a
    // mantle torn to three tatters, a cracked crown askew over a slit great
    // helm, and a greatsword of falling stone planted across the body.
    SKYFALLEN_KING: boss({
      id: 'SKYFALLEN_KING',
      element: 'DARK',
      body: 'sky_body',
      head: 'sky_head',
      cape: 'cloak_sky',
      crest: 'crown_broken',
      crestAt: { x: 36, y: 19 },
      arms: 'arms_stone',
      weapon: 'skyrent',
      weaponOff: { x: -3, y: 0 },
      fallen: 'fallen_sky',
      down: 'sky_head_down',
      tilt: 'sky_head_tilt',
      recoilLift: true,
      recoilBody: 'sky_body_hurt',
      recoilDx: -12,
      sway: 'sky_head_sway',
      sway2: 'sky_head_sway2',
      swayCape: 'cloak_sky_sway',
      palette: { metal: SKY_SILVER, cloth2: SKY_SURCOAT, bone: SKY_MASONRY },
    }),
  };

  // ---- ASHEN FORGE (act 4) ----------------------------------------------------
  // Cold iron over FORGE_GROUND's warm brown floor (#5b4438) under a #ff5a2e key:
  // amber on amber is a hole, so the metal here is a blue-cold iron and the only
  // warm thing in the pack is the fire INSIDE it — a seam, a grille, a crucible.
  // HUE SEPARATION, round-8's rule applied inside the pack: the golem and the
  // knight are both iron over a warm accent, and on one ramp they measured 79 %
  // top-ten-colour overlap. The golem's iron is COLD (a blue cast iron) over a
  // dull ochre slag; the knight's is SCORCHED (a warm rust) over the ember red.
  const COLD_IRON: Ramp = ramp(220, 9, 38, { mid: -5, lit: -9, spec: -9, plane: 3 }); // the golem, and the Forge Saint's mitre
  const SCORCHED_IRON: Ramp = ramp(8, 13, 34); // the furnace knight's plate
  const SLAG: Ramp = ramp(34, 24, 40); // cooling slag on the golem's fist
  const EMBER_RED: Ramp = ramp(6, 27, 40); // the knight's scorched tabard
  const WOLF_HIDE: Ramp = ramp(12, 15, 36); // a charcoal hide, warm where PYRE_KNIGHT's charred iron is violet
  const WOLF_SPINE: Ramp = ramp(26, 32, 42);
  const SMITH_LEATHER: Ramp = ramp(30, 27, 42, { mid: -5, lit: -4, spec: 3 }); // the priest's apron
  const SMITH_STOLE: Ramp = ramp(348, 20, 36);
  const VAPOUR: Ramp = ramp(188, 13, 50); // the steam wraith, clear of TIDE's and LUMEN's pale blues
  const SOOT_LINEN: Ramp = ramp(24, 8, 40); // the Forge Saint's chasuble — a LIGHT boss in soot, not in white

  const forge: Record<string, ActorRecipe> = {
    // MOLTEN SLAM, built around ONE oversized fist: a squat riveted automaton
    // with a furnace seam down its chest and a slag boulder on a stub of chain.
    FORGE_GOLEM: humanoid({
      id: 'FORGE_GOLEM',
      element: 'FIRE',
      body: 'golem_body',
      head: 'golem_head',
      arms: 'arms_slag',
      weapon: 'slag_fist',
      fingers: 'fingers_slag',
      fallen: 'fallen_slag',
      down: 'golem_head_down',
      tilt: 'golem_head_tilt',
      recoilBody: 'golem_body_hurt',
      recoilDx: -9,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'golem_head_sway',
      sway2: 'golem_head_sway2',
      swayBody: 'golem_body_sway',
      palette: { metal: COLD_IRON, accent: SLAG, glow: glowRamp(24, 88, 92) },
    }),
    // BRANDING BITE: leggier than the crypt's hound, its topline broken by seven
    // ember-lit spines, its tail carried up and forward, ember cracks along the
    // flank and a hind pair on different geometry from the fore.
    CINDER_WOLF: creature({
      id: 'CINDER_WOLF',
      element: 'FIRE',
      idle: ['wolf_body', 'wolf_body_b', 'wolf_body_c'],
      wind: 'wolf_wind',
      strike: 'wolf_strike',
      hurt: 'wolf_hurt',
      dead: ['wolf_dead'],
      settle: { part: 'wolf_settle' },
      palette: { leather: WOLF_HIDE, accent: WOLF_SPINE, bone: ramp(44, 12, 56), glow: glowRamp(20, 90, 90) },
    }),
    // TEMPER and EMBER SALVE: a working smith in orders. Narrow shoulders under
    // a wide apron — the inverse of the sentinel's T — a stole over one shoulder,
    // a bellows satchel at the far hip, and long tongs closed on a hot billet.
    SMITH_PRIEST: humanoid({
      id: 'SMITH_PRIEST',
      element: 'FIRE',
      body: 'priest_body',
      head: 'priest_head',
      arms: 'arms_apron',
      weapon: 'tongs',
      fingers: 'fingers_apron',
      fallen: 'fallen_apron',
      down: 'priest_head_down',
      tilt: 'priest_head_tilt',
      recoilLift: true,
      recoilBody: 'priest_body_hurt',
      recoilDx: -11,
      sway: 'priest_head_sway',
      sway2: 'priest_head_sway2',
      swayBody: 'priest_body_sway',
      headOff: { x: 2, y: 5 }, // THE STOOP: a smith works bent over the anvil, and it is what takes his outline off the vault's two robed columns
      extras: [{ part: 'bellows', at: { x: 20, y: 34 }, z: 0 }],
      palette: { leather: SMITH_LEATHER, cloth2: SMITH_STOLE, cloth: ramp(28, 10, 34), glow: glowRamp(28, 86, 92) },
    }),
    // The WATER foil in a furnace: a legless column of scalding vapour with a
    // hollow face and two vent arms — no hard edge anywhere on it, which is the
    // opposite construction to the golem standing beside it.
    STEAM_WRAITH: creature({
      id: 'STEAM_WRAITH',
      element: 'WATER',
      idle: ['steam_body', 'steam_body_b', 'steam_body_c'],
      wind: 'steam_wind',
      strike: 'steam_strike',
      hurt: 'steam_hurt',
      dead: ['steam_dead', 'steam_dead_b'],
      settle: { part: 'steam_body', dy: -1 },
      palette: { cloth: VAPOUR, glow: glowRamp(30, 70, 90) },
    }),
    // The elite: banded plate over a scorched tabard, a chimney venting off the
    // far pauldron, and a visor that is a furnace DOOR with the fire behind it.
    FURNACE_KNIGHT: humanoid({
      id: 'FURNACE_KNIGHT',
      element: 'FIRE',
      body: 'furnace_body',
      head: 'furnace_head',
      arms: 'arms_furnace',
      weapon: 'greathammer',
      fingers: 'fingers_furnace',
      fallen: 'fallen_furnace',
      down: 'furnace_head_down',
      tilt: 'furnace_head_tilt',
      recoilBody: 'furnace_body_hurt',
      recoilDx: -10,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'furnace_head_sway',
      sway2: 'furnace_head_sway2',
      swayBody: 'furnace_body_sway',
      palette: { metal: SCORCHED_IRON, accent: EMBER_RED, leather: ramp(26, 22, 38), glow: glowRamp(26, 90, 92) },
    }),
    // The boss is a CRUCIBLE in vestments: the torso opens on white fire under a
    // soot-black chasuble, so the biggest light in the biome is inside the boss
    // rather than on it. A halo of sparks, and a hammer-sceptre it thrusts.
    FORGE_SAINT: boss({
      id: 'FORGE_SAINT',
      element: 'LIGHT',
      body: 'saintf_body',
      head: 'saintf_head',
      cape: 'cloak_saintf',
      crest: 'halo_sparks',
      crestAt: { x: 34, y: 23 },
      arms: 'arms_vestment',
      weapon: 'sceptre_hammer',
      fallen: 'fallen_saintf',
      down: 'saintf_head_down',
      tilt: 'saintf_head_tilt',
      recoilLift: true,
      recoilBody: 'saintf_body_hurt',
      recoilDx: -10,
      sway: 'saintf_head_sway',
      sway2: 'saintf_head_sway2',
      swayCape: 'cloak_saintf_sway',
      palette: { cloth: SOOT_LINEN, metal: COLD_IRON, leather: SMITH_LEATHER, glow: glowRamp(44, 66, 95) },
    }),
  };

  // ---- SUNKEN VAULT (act 5) ---------------------------------------------------
  // A drowned reliquary over VAULT_GROUND's teal floor (#3e6d7c) under a #6fd8ff
  // key: teal on teal is a hole, so the pack is BRONZE and KELP, and the only
  // cyan in it is a bioluminescence the enemies carry as light sources.
  const VERDIGRIS: Ramp = ramp(152, 21, 42, { mid: -8, lit: -2, spec: -3, plane: 3 }); // drowned bronze — warm-green metal against a cold floor
  const KELP: Ramp = ramp(94, 20, 34); // the weed every figure in the vault wears
  const VAULT_RUST: Ramp = ramp(18, 30, 40);
  const JELLY_BELL: Ramp = ramp(282, 12, 44); // a violet bell, the one non-green thing in the biome
  const JELLY_STING: Ramp = ramp(300, 15, 38);
  const ORACLE_ROBE: Ramp = ramp(232, 20, 40, { plane: 4 }); // indigo, well clear of TIDE's and the Saint's pale blues
  const CORAL: Ramp = ramp(6, 21, 46);
  const EEL_HIDE: Ramp = ramp(204, 17, 36);
  const EEL_FIN: Ramp = ramp(46, 27, 46); // a brass sail fin — the WIND foil reads warm in a cold room
  const ABYSS_HIDE: Ramp = ramp(262, 15, 32);
  const SKING_GOLD: Ramp = ramp(44, 17, 40); // the drowned king's gold, not the Forge Saint's

  const vault: Record<string, ActorRecipe> = {
    // Tall and NARROW where the crypt's drowned knight is hunched: a barnacled
    // bronze cuirass over a long scale skirt, a kelp veil off an open-faced helm,
    // and a pike it thrusts rather than swings.
    DROWNED_SENTINEL: humanoid({
      id: 'DROWNED_SENTINEL',
      element: 'WATER',
      body: 'dsent_body',
      head: 'dsent_head',
      arms: 'arms_bronze',
      weapon: 'rusted_pike',
      fingers: 'fingers_bronze',
      fallen: 'fallen_bronze',
      down: 'dsent_head_down',
      tilt: 'dsent_head_tilt',
      recoilBody: 'dsent_body_hurt',
      recoilDx: -10,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'dsent_head_sway',
      sway2: 'dsent_head_sway2',
      swayBody: 'dsent_body_sway',
      palette: { metal: VERDIGRIS, cloth: KELP, leather: VAULT_RUST },
    }),
    // NUMBING STING: a bell with a bioluminescent ring low inside it over a
    // curtain of ten stingers, which ARE the strike — driven eleven cells out.
    VAULT_JELLY: creature({
      id: 'VAULT_JELLY',
      element: 'WATER',
      idle: ['jelly_body', 'jelly_body_b', 'jelly_body_c'],
      wind: 'jelly_wind',
      strike: 'jelly_strike',
      hurt: 'jelly_hurt',
      dead: ['jelly_dead'],
      settle: { part: 'jelly_body', dy: -1 },
      palette: { cloth2: JELLY_BELL, accent: JELLY_STING, glow: glowRamp(178, 62, 92) },
    }),
    // DEEP MEND, and she CRADLES: a scrying shell in two cupped hands under a
    // coral crown three cells wider than her shoulders — the one figure in the
    // game whose head is the widest part of the silhouette.
    TIDE_ORACLE: humanoid({
      id: 'TIDE_ORACLE',
      element: 'WATER',
      body: 'oracle_body',
      head: 'oracle_head',
      arms: 'arms_shell',
      weapon: 'scrying_shell',
      cradle: true,
      fallen: 'fallen_oracle',
      down: 'oracle_head_down',
      tilt: 'oracle_head_tilt',
      recoilLift: true,
      recoilBody: 'oracle_body_hurt',
      recoilDx: -11,
      sway: 'oracle_head_sway',
      sway2: 'oracle_head_sway2',
      swayBody: 'oracle_body_sway',
      palette: { cloth: ORACLE_ROBE, accent: CORAL, bone: ramp(20, 26, 50), hair: ramp(196, 14, 42), glow: glowRamp(180, 58, 92) },
    }),
    // The WIND foil in a drowned room: a ribbon body in a standing S with a
    // brass sail fin down its whole back and sparks at the jaw — the one thing
    // in the vault that reads as fast.
    WIND_EEL: creature({
      id: 'WIND_EEL',
      element: 'WIND',
      idle: ['eel_body', 'eel_body_b', 'eel_body_c'],
      wind: 'eel_wind',
      strike: 'eel_strike',
      hurt: 'eel_hurt',
      dead: ['eel_dead'],
      settle: { part: 'eel_settle' },
      palette: { leather: EEL_HIDE, cloth2: EEL_FIN, bone: ramp(44, 12, 54), glow: glowRamp(56, 46, 94) },
    }),
    // CRUSHING COILS: the silhouette IS the coil — three stacked loops with a
    // wedge skull rising off the top and a jaw of nine teeth on the strike.
    LEVIATHAN_SPAWN: creature({
      id: 'LEVIATHAN_SPAWN',
      element: 'WATER',
      idle: ['lev_body', 'lev_body_b', 'lev_body_c'],
      wind: 'lev_wind',
      strike: 'lev_strike',
      hurt: 'lev_hurt',
      dead: ['lev_dead'],
      settle: { part: 'lev_settle' },
      palette: { leather: ABYSS_HIDE, bone: ramp(42, 14, 56), glow: glowRamp(174, 60, 90) },
    }),
    // The boss's legs are gone below the knee into a skirt of kelp, its mantle
    // is weed, its face is weed, and a reliquary lamp is set into its chest —
    // nothing about the silhouette is the Skyfallen King's.
    SUNKEN_KING: boss({
      id: 'SUNKEN_KING',
      element: 'DARK',
      body: 'sking_body',
      head: 'sking_head',
      cape: 'cloak_sking',
      crest: 'crown_coral',
      crestAt: { x: 34, y: 22 },
      arms: 'arms_bronze',
      weapon: 'trident',
      weaponOff: { x: -2, y: 0 },
      fallen: 'fallen_sking',
      down: 'sking_head_down',
      tilt: 'sking_head_tilt',
      recoilLift: true,
      recoilBody: 'sking_body_hurt',
      recoilDx: -10,
      sway: 'sking_head_sway',
      sway2: 'sking_head_sway2',
      swayCape: 'cloak_sking_sway',
      extras: [{ part: 'anchor_broken', at: { x: 22, y: 40 }, z: 5 }],
      palette: { metal: SKING_GOLD, cloth: ramp(84, 16, 32), bone: CORAL, glow: glowRamp(172, 64, 90) },
    }),
  };

  // ---- STORM SPIRE (act 6) ----------------------------------------------------
  // A lightning-lit tower top over SPIRE_GROUND's blue-grey floor (#5b6484) under
  // a near-white key. Storm grey on storm grey is a hole, so the pack is BRASS
  // and granite, and the only white in it is the lightning the enemies carry.
  const BRASS: Ramp = ramp(46, 26, 44, { mid: -5, lit: 1, spec: 2 }); // the warden and the colossus's bindings
  const PALE_GOLD: Ramp = ramp(56, 19, 54); // the seraph's mask and lance, a step off the warden's brass
  const HAWK_FEATHER: Ramp = ramp(28, 19, 36, { mid: -9, lit: -4, plane: 2 }); // a dark warm plumage: nothing like the ruins' straw raptor
  const MONK_GI: Ramp = ramp(38, 23, 46);
  const MONK_SASH: Ramp = ramp(186, 21, 34);
  const STORM_COAT: Ramp = ramp(222, 19, 44); // the warden's and the seraph's storm indigo // the warden's and the seraph's storm indigo
  const GRANITE: Ramp = ramp(246, 7, 40); // the colossus, cool where the ruins' stone is warm
  const CLINKER: Ramp = ramp(22, 11, 30); // the ember elemental's burnt heart

  const spire: Record<string, ActorRecipe> = {
    // DIVEBOMB: already falling where the ruins' raptor stands mantled — the
    // wings swept BACK into a delta, the body pitched nose-down, the legs
    // tucked, and a bolt running one wing on the strike.
    LIGHTNING_HAWK: creature({
      id: 'LIGHTNING_HAWK',
      element: 'WIND',
      idle: ['hawk_body', 'hawk_body_b', 'hawk_body_c'],
      wind: 'hawk_wind',
      strike: 'hawk_strike',
      hurt: 'hawk_hurt',
      dead: ['hawk_dead'],
      settle: { part: 'hawk_settle' },
      palette: { hair: HAWK_FEATHER, accent: BRASS, glow: glowRamp(56, 44, 95) },
    }),
    // WIND PALM scales off SPD, so this is the only humanoid of the twenty-four
    // carrying no weapon: an open palm is the strike and a string of prayer
    // beads wound round that hand is what its fist has to cross.
    GALE_MONK: humanoid({
      id: 'GALE_MONK',
      element: 'WIND',
      body: 'monk_body',
      head: 'monk_head',
      arms: 'arms_late_bare',
      weapon: 'beads',
      fingers: 'fingers_late_bare',
      fallen: 'fallen_monk',
      down: 'monk_head_down',
      tilt: 'monk_head_tilt',
      recoilLift: true,
      recoilBody: 'monk_body_hurt',
      recoilDx: -11,
      sway: 'monk_head_sway',
      sway2: 'monk_head_sway2',
      swayBody: 'monk_body_sway',
      palette: { cloth: MONK_GI, cloth2: MONK_SASH, accent: ramp(40, 28, 44), hair: ramp(258, 12, 34) },
    }),
    // UPDRAFT MEND and STAND FAST: brass over a storm coat, an open face under a
    // helm with a weather-VANE spur, and a staff whose lamp is CAGED — four bars
    // over the light, so the pack's brightest pane is broken by construction.
    SPIRE_WARDEN: humanoid({
      id: 'SPIRE_WARDEN',
      element: 'WIND',
      body: 'warden_body',
      head: 'warden_head',
      arms: 'arms_brass',
      weapon: 'storm_staff',
      fingers: 'fingers_brass',
      fallen: 'fallen_brass',
      down: 'warden_head_down',
      tilt: 'warden_head_tilt',
      recoilBody: 'warden_body_hurt',
      recoilDx: -10,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'warden_head_sway',
      sway2: 'warden_head_sway2',
      swayBody: 'warden_body_sway',
      cape: 'cape_storm',
      swayCape: 'cape_storm_sway',
      palette: { metal: BRASS, cloth: STORM_COAT, cloth2: ramp(232, 16, 32), glow: glowRamp(52, 48, 92) },
    }),
    // The inverse of the marsh's fen fire: a DARK clinker core with a body of
    // loose embers orbiting it, so its dark is at the centre and its light at
    // the edge, and CINDER BURST throws the whole orbit out.
    EMBER_ELEMENTAL: creature({
      id: 'EMBER_ELEMENTAL',
      element: 'FIRE',
      idle: ['elemental_body', 'elemental_body_b', 'elemental_body_c'],
      wind: 'elemental_wind',
      strike: 'elemental_strike',
      hurt: 'elemental_hurt',
      dead: ['elemental_dead', 'elemental_dead_b'],
      settle: { part: 'elemental_settle' },
      palette: { bone: CLINKER, glow: glowRamp(20, 88, 92) },
    }),
    // CHAIN BOLT: granite bound in brass, with two conductor rods standing off
    // the shoulders and an arc between them — the widest and brightest part of
    // this silhouette is ABOVE the shoulder line rather than at it.
    THUNDER_COLOSSUS: humanoid({
      id: 'THUNDER_COLOSSUS',
      element: 'WIND',
      body: 'colossus_body',
      head: 'colossus_head',
      arms: 'arms_granite',
      weapon: 'granite_maul',
      fingers: 'fingers_granite',
      fallen: 'fallen_granite',
      down: 'colossus_head_down',
      tilt: 'colossus_head_tilt',
      recoilBody: 'colossus_body_hurt',
      recoilDx: -10,
      // ROUND 11 — the chin goes UP on the hit. Without the arms swap this figure had nothing to lift the skull and the critic measured crownDy +3 on it.
      recoilLift: true,
      sway: 'colossus_head_sway',
      sway2: 'colossus_head_sway2',
      swayBody: 'colossus_body_sway',
      palette: { bone: GRANITE, metal: BRASS, glow: glowRamp(54, 42, 95) },
    }),
    // AEGIS OF LIGHT: where the Forge Saint is a crucible and the two DARK kings
    // are armoured, this boss is WINGS — three pairs at three pitches, drawn
    // from the shoulder — over a brass mask with no eyes in it.
    SPIRE_SERAPH: boss({
      id: 'SPIRE_SERAPH',
      element: 'LIGHT',
      body: 'seraph_body',
      head: 'seraph_head',
      cape: 'empty',
      crest: 'halo_ring',
      crestAt: { x: 34, y: 30 },
      arms: 'arms_seraph',
      weapon: 'radiant_lance',
      weaponOff: { x: -2, y: 0 },
      fallen: 'fallen_seraph',
      down: 'seraph_head_down',
      tilt: 'seraph_head_tilt',
      recoilLift: true,
      recoilBody: 'seraph_body_hurt',
      recoilDx: -10,
      sway: 'seraph_head_sway',
      sway2: 'seraph_head_sway2',
      palette: { metal: PALE_GOLD, cloth: ramp(204, 15, 40), cloth2: ramp(224, 11, 50), glow: glowRamp(50, 50, 95) },
    }),
  };

  return { ...ruins, ...forge, ...vault, ...spire };
}
