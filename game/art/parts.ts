// Ember Quest v3 — game/art/parts.ts
//
// The shared ASCII part library for the layered-actor pipeline (DESIGN.md →
// Presentation → Layered actors). Pure data: no engine import, no DOM. A part
// is a small ASCII-art drawing (rows of characters) plus a map from character
// to a ROLE key — never a literal colour, so one part can be baked for any
// element (`actors.ts` owns the role → colour table and does the baking).
//
// Anchors are named cell points authored in the part's OWN local grid (row 0,
// col 0 = its top-left). `actors.ts` composes a recipe by placing one part's
// named anchor exactly on another already-placed part's same-named anchor
// (e.g. a weapon's `weaponGrip` lands on the arm's `weaponGrip`), which is
// what keeps a weapon glued to a hand across every pose keyframe. Not every
// part defines every anchor — only the ones relevant to how it is used.
//
// Rows may be ragged (a short row is padded transparent on the right by
// engine's `makeSprite`); they are kept close to rectangular here for
// readability while authoring, not because the pipeline requires it.
//
// Style: one light direction (top-left, rim light is added at BAKE time in
// actors.ts, not here), thick 2-3 cell-wide strokes, a 1-cell dark keyline
// baked directly into the rows (never `makeSprite`'s automatic `outline`
// option — that grows the sprite by a cell per side and would shift every
// anchor authored below), and a 3-4 tone ramp per material via the role set.

// --- Roles --------------------------------------------------------------------

/**
 * A material role, never a literal colour. `accent` and `glow` are the two
 * roles an element re-tints (actors.ts's ELEMENT_PALETTE); `skin`, `cloth`,
 * `metal`, `dark` and `light` stay neutral on every actor. `dark` is the
 * authored keyline; `light` is reserved for a hand-placed glint (eyes, a
 * blade's edge) — the silhouette-wide rim light is a bake-time pass over the
 * composed actor, not something painted into a part.
 */
export type RoleKey = 'skin' | 'cloth' | 'metal' | 'accent' | 'glow' | 'dark' | 'light';

/** ASCII character → role. '.', ' ' and any character missing from `map` are transparent (engine's `makeSprite` convention). */
export type RoleMap = Readonly<Record<string, RoleKey>>;

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The six named connection points a part may define, in ITS OWN local grid.
 * `feet` / `hit` mark the whole-recipe ground contact and hurtbox centre
 * (authored on body/body-like parts); `head` marks where a head sits on a
 * torso, and — on a head part — the neck point that lands there; `hand`
 * marks where arms sit on a torso, and — on an arms part — the shoulder
 * point that lands there; `weaponGrip` marks the fist on an arms part and
 * the handle on a weapon part; `capePin` marks the back-shoulder point on a
 * torso and the collar point on a cloak.
 */
export type AnchorName = 'hand' | 'head' | 'weaponGrip' | 'capePin' | 'feet' | 'hit';

export interface PartDef {
  /** ASCII rows, top to bottom. */
  readonly rows: readonly string[];
  readonly map: RoleMap;
  readonly anchors: Partial<Readonly<Record<AnchorName, Point>>>;
}

function part(rows: readonly string[], map: RoleMap, anchors: Partial<Record<AnchorName, Point>>): PartDef {
  return { rows, map, anchors };
}

// --- Humanoid bodies ------------------------------------------------------
// Legs are baked into the torso (no separate leg layer) — at 64px and
// POSE_FPS 12 a separate leg swing bought little and every anchor stays
// simpler with one fewer layer to place.

// Accent (the element tint) is the DOMINANT fill here, not a trim line — at
// the size this composites and draws to, a 1-cell stripe reads as grey from
// across the stage. Cloth is kept only as a collar/belt/boot accent so the
// garment still looks like cloth over a body, not a solid colour block.
const TORSO_SLIM = part(
  [
    '......##......',
    '.....####.....',
    '....#CCCC#....',
    '...#OOOOOO#...',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOCCCCOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '..#OOOOOOOO#..',
    '...#OOOOOO#...',
    '...#OOOOOO#...',
    '..#OOOOOOOO#..',
    '..#CC#..#CC#..',
    '..#CC#..#CC#..',
    '..#CC#..#CC#..',
    '..#CC#..#CC#..',
    '..#CC#..#CC#..',
    '..####..####..',
  ],
  { '#': 'dark', C: 'cloth', O: 'accent' },
  { head: { x: 7, y: 0 }, hand: { x: 11, y: 5 }, capePin: { x: 2, y: 3 }, feet: { x: 7, y: 23 }, hit: { x: 7, y: 12 } },
);

const TORSO_HEAVY = part(
  [
    '........##........',
    '.......####.......',
    '......######......',
    '.....#MMMMMM#.....',
    '....#MOOOOOOM#....',
    '...#MOOOOOOOOM#...',
    '...#MOOOOOOOOM#...',
    '...#MOOMMMMOOM#...',
    '...#MOOOMMOOOM#...',
    '...#MOOOMMOOOM#...',
    '...#MOOOOOOOOM#...',
    '...#MOOOOOOOOM#...',
    '...#MOOOOOOOOM#...',
    '...#MOOOOOOOOM#...',
    '....#MOOOOOOM#....',
    '....#MMOOOOMM#....',
    '...#MMMM##MMMM#...',
    '...#MMM#..#MMM#...',
    '...#MMM#..#MMM#...',
    '...#####..#####...',
  ],
  { '#': 'dark', M: 'metal', O: 'accent' },
  { head: { x: 9, y: 0 }, hand: { x: 14, y: 6 }, capePin: { x: 3, y: 4 }, feet: { x: 9, y: 19 }, hit: { x: 9, y: 11 } },
);

const TORSO_ROBE = part(
  [
    '.......##.......',
    '......####......',
    '.....#CCCC#.....',
    '....#OOOOOO#....',
    '...#OOOOOOOO#...',
    '...#OOOOOOOO#...',
    '...#OOOOOOOO#...',
    '...#OOCCCCOO#...',
    '...#OOOOOOOO#...',
    '...#OOOOOOOO#...',
    '..#OOOOOOOOOO#..',
    '..#OOOOOOOOOO#..',
    '..#OOOOOOOOOO#..',
    '..#OOOOOOOOOO#..',
    '.#OOOOOOOOOOOO#.',
    '.#OOOOOOOOOOOO#.',
    '.#OOOOCCCCOOOO#.',
    '#OOOO#....#OOOO#',
    '#OOO#......#OOO#',
    '#CC#........#CC#',
    '####........####',
  ],
  { '#': 'dark', C: 'cloth', O: 'accent' },
  { head: { x: 8, y: 0 }, hand: { x: 12, y: 5 }, capePin: { x: 3, y: 3 }, feet: { x: 8, y: 20 }, hit: { x: 8, y: 11 } },
);

// --- Heads ------------------------------------------------------------------

const HEAD_ROUND = part(
  [
    '..######..',
    '.#SSSSSS#.',
    '#SSSSSSSS#',
    '#SSL.SSSS#',
    '#SSSSSSSS#',
    '.#SSSSSS#.',
    '..######..',
    '...####...',
  ],
  { '#': 'dark', S: 'skin', L: 'light' },
  { head: { x: 5, y: 7 } },
);

const HEAD_HELM = part(
  [
    '.####MM####.',
    '#MMMMMMMMMM#',
    '#MOMMMMMMOM#',
    '#MMMMMMMMMM#',
    '#MM#SSSS#MM#',
    '#MM#SLSS#MM#',
    '.#M#SSSS#M#.',
    '..#MMMMMM#..',
    '...######...',
  ],
  { '#': 'dark', M: 'metal', O: 'accent', S: 'skin', L: 'light' },
  { head: { x: 6, y: 8 } },
);

const HEAD_HOOD = part(
  [
    '..#OOOOOO#.',
    '.#OOOOOOOO#',
    '#OO#SSSSO#O',
    '#O#SSLSSS#O',
    '#O#SSSSSS#O',
    '.#OOSSSSO#.',
    '..#OOOOO#..',
    '...#OOO#...',
    '....###....',
  ],
  { '#': 'dark', O: 'accent', S: 'skin', L: 'light' },
  { head: { x: 5, y: 8 } },
);

// --- Arms ---------------------------------------------------------------------

const ARMS_IDLE = part(
  [
    '.####...',
    '#CCCC#..',
    '#CCCC#..',
    '.#CCC#.#',
    '.#CCC##S#',
    '..#CC#SS#',
    '..#CC#S#.',
    '...##.##.',
  ],
  { '#': 'dark', C: 'cloth', S: 'skin' },
  { hand: { x: 2, y: 0 }, weaponGrip: { x: 7, y: 6 } },
);

const ARMS_GUARD = part(
  [
    '.####....',
    '#CCCC#...',
    '#CCCC#.##',
    '.#CCC#S#.',
    '.#CCC#S#.',
    '..#CC#S#.',
    '..#CC##..',
    '...##....',
  ],
  { '#': 'dark', C: 'cloth', S: 'skin' },
  { hand: { x: 2, y: 0 }, weaponGrip: { x: 6, y: 3 } },
);

// --- Weapons: sword, bow, staff, shield, dagger, orb --------------------------
// Every weapon is authored resting vertically (grip near the top, business
// end hanging down) so the idle pose reads as "held ready"; the attack rig
// rotates it in 90-degree steps about `weaponGrip`.

const SWORD = part(
  [
    '.##.',
    '#MM#',
    '#MM#',
    '#MM#',
    '#MM#',
    '#MM#',
    '#MM#',
    '#MM#',
    'MMMM',
    'MOOM',
    '.##.',
    '.##.',
    '.##.',
    '#MM#',
    '#MM#',
    '.##.',
  ],
  { '#': 'dark', M: 'metal', O: 'accent' },
  { weaponGrip: { x: 1, y: 12 } },
);

const DAGGER = part(
  ['.##..', '#LM#.', '#LM#.', '#LM#.', '#LM#.', 'MOOM.', '.##..', '#MM#.', '#MM#.', '.##..', '.##..'],
  { '#': 'dark', M: 'metal', O: 'accent', L: 'light' },
  { weaponGrip: { x: 1, y: 6 } },
);

const STAFF = part(
  [
    '.#O#.',
    '#OOO#',
    '#OGO#',
    '.#O#.',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
    '.###.',
    '.###.',
    '..#..',
    '..#..',
    '..#..',
    '.###.',
    '.###.',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { weaponGrip: { x: 2, y: 19 } },
);

const BOW = part(
  [
    '..##..',
    '.#MM#.',
    '#MM.MM',
    'MM.O.M',
    'M#.O.M',
    'M#.O.#',
    'M#.O.#',
    'M#.O.M',
    'MM.O.M',
    '#MM.MM',
    '.#MM#.',
    '..##..',
    '..##..',
    '..##..',
    '..##..',
    '..##..',
  ],
  { '#': 'dark', M: 'metal', O: 'accent' },
  { weaponGrip: { x: 3, y: 7 } },
);

const SHIELD = part(
  [
    '.#MMMMM#.',
    '#MMMMMMM#',
    '#MOOOOOM#',
    '#MOMMMOM#',
    '#MOMGMOM#',
    '#MOMMMOM#',
    '#MOOOOOM#',
    '#MMMMMMM#',
    '.#MMMMM#.',
    '..#MMM#..',
    '...#M#...',
    '....#....',
  ],
  { '#': 'dark', M: 'metal', O: 'accent', G: 'glow' },
  { hand: { x: 4, y: 5 } },
);

const ORB = part(
  ['.#OOO#.', '#OOOOO#', '#OGGGO#', '#OGGGO#', '#OOOOO#', '.#OOO#.', '..###..'],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { weaponGrip: { x: 3, y: 3 } },
);

// --- Capes / cloaks -----------------------------------------------------------

const CLOAK = part(
  [
    '..####..',
    '.#CCCC#.',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OOOOOO#',
    '#OO..OO#',
    '#O....O#',
    '#O....O#',
    '#......#',
    'O......O',
    'O......O',
    '#......#',
  ],
  { '#': 'dark', C: 'cloth', O: 'accent' },
  { capePin: { x: 4, y: 1 } },
);

// --- Accessories: crown, halo, claw -------------------------------------------

const CROWN = part(
  ['#.#.#.#.#', '#O#O#O#O#', '#OOOOOOO#', '#OOGOOOG#', '#########'],
  { '#': 'dark', O: 'accent', G: 'glow' },
  {},
);

const HALO = part(['.#GGGGG#.', '#GG...GG#', '.#GGGGG#.'], { '#': 'dark', G: 'glow' }, {});

const CLAW = part(
  [
    '.####...',
    '#MMMM#..',
    '#MMMM#.#',
    '.#MM#.#O',
    '.#MM##O#',
    '..#M#O#.',
    '..#M#O..',
    '.#M#O...',
    '.#O#....',
    '.#O.....',
  ],
  { '#': 'dark', M: 'metal', O: 'accent' },
  { weaponGrip: { x: 4, y: 4 } },
);

// --- Monster bodies -------------------------------------------------------
// Single-part creatures: no separate head/arms rig, one silhouette per
// layer (occasionally two, e.g. the imp's wings) so a quadruped or a
// floating shape never has to fake a biped skeleton.

const IMP_BODY = part(
  [
    '...##....',
    '..#OO#...',
    '.#OOOO#..',
    '#OGO.OGO#',
    '#OOOOOOO#',
    '.#OOOOO#.',
    '..#OOO#..',
    '.#O#.#O#.',
    '.#O#.#O#.',
    '#OO#.#OO#',
    '.##...##.',
    '.#O#.#O#.',
    '.#O#.#O#.',
    '##O#.#O##',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 5, y: 13 }, hit: { x: 5, y: 6 }, hand: { x: 7, y: 6 } },
);

const IMP_WINGS = part(
  [
    '##......##',
    '#O#....#O#',
    '#OO#..#OO#',
    '.#OO##OO#.',
    '.#OOOOOO#.',
    '..#OOOO#..',
    '..#O##O#..',
    '..##..##..',
  ],
  { '#': 'dark', O: 'accent' },
  {},
);

const HOUND_BODY = part(
  [
    '.......##......',
    '......#OO#.....',
    '.....#OGOO#....',
    '.####OOOOOO###.',
    '#OOOOOOOOOOOOO#',
    '#OOOOOOOOOOOOO#',
    '#OOOOOOOOOOOOO#',
    '.#OOOOOOOOOOO#.',
    '..#O#....#O#...',
    '..#O#....#O#...',
    '..#O#....#O#...',
    '..#O#....#O#...',
    '.##O##..##O##..',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 7, y: 12 }, hit: { x: 7, y: 6 }, hand: { x: 12, y: 4 } },
);

const WRAITH_BODY = part(
  [
    '....####....',
    '...#CCCC#...',
    '..#CCCCCC#..',
    '..#CGCCGC#..',
    '..#CCCCCC#..',
    '...#CCCC#...',
    '..#CCCCCC#..',
    '.#CCCCCCCC#.',
    '.#CCCCCCCC#.',
    '.#CCCCCCCC#.',
    '#CCCCCCCCCC#',
    '#CCCCCCCCCC#',
    '#CCCCCCCCCC#',
    '#CCCCCCCCCC#',
    '#CCCCCCCCCC#',
    '#CC#CC#CC#C#',
    '#C#.#C#.#C#.',
  ],
  { '#': 'dark', C: 'cloth', G: 'glow' },
  { feet: { x: 6, y: 16 }, hit: { x: 6, y: 9 }, hand: { x: 9, y: 8 } },
);

const TOAD_BODY = part(
  [
    '....########....',
    '...#OOOOOOOO#...',
    '..#O#OO..OO#O#..',
    '.#OO#O.GG.O#OO#.',
    '#OOOOOOOOOOOOOO#',
    '#OOOOOOOOOOOOOO#',
    '#OOOOOOOOOOOOOO#',
    '.#OOOOOOOOOOOO#.',
    '..#OOOOOOOOOO#..',
    '.#O#........#O#.',
    '#OO#........#OO#',
    '##..#........#..',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 8, y: 11 }, hit: { x: 8, y: 6 }, hand: { x: 12, y: 5 } },
);

const WISP_BODY = part(
  [
    '..#GGG#..',
    '.#GGGGG#.',
    '#GGOOOGG#',
    '#GOO.OOG#',
    '#GOO.OOG#',
    '#GGOOOGG#',
    '.#GGGGG#.',
    '..#GGG#..',
    '...#.#...',
    '..#...#..',
    '.#.....#.',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 4, y: 10 }, hit: { x: 4, y: 4 }, hand: { x: 7, y: 3 } },
);

const CRAB_BODY = part(
  [
    'O#............#O',
    'OO#..........#OO',
    '#OO#........#OO#',
    '.#OO########OO#.',
    '..#OOOOOOOOOO#..',
    '.#OOGO.OO.OGOO#.',
    '#OOOOOOOOOOOOOO#',
    '.#OOOOOOOOOOOO#.',
    '..#O#.#O#.#O#..',
    '..#O#.#O#.#O#..',
    '.##O##.##O##....',
  ],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 8, y: 10 }, hit: { x: 8, y: 5 }, hand: { x: 13, y: 4 } },
);

const FENFIRE_BODY = part(
  ['..#O#..', '.#OGO#.', '#OGGGO#', '#OGGGO#', '.#OGO#.', '..#O#..', '...#...', '..#.#..', '.#...#.'],
  { '#': 'dark', O: 'accent', G: 'glow' },
  { feet: { x: 3, y: 8 }, hit: { x: 3, y: 3 }, hand: { x: 5, y: 2 } },
);

// --- Boss-scale body + head (Hollow King, Pale Saint) --------------------------
// Authored bigger and placed in the 96-cell BOSS_PART canvas; the crown /
// halo / claw / cloak accessories above tell the two bosses apart on top of
// the element tint.

const KING_BODY = part(
  [
    '..........########..........',
    '.........#MMMMMMMM#..........',
    '........#MMOOOOOOMM#.........',
    '.......#MMOOOOOOOOMM#........',
    '......#MMMMMMMMMMMMMM#.......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMOOOOOOOOOOMMM#......',
    '.....#MMMOOOOOOOOOOMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMOOOOOOMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '.....#MMMMMMMMMMMMMMMM#......',
    '......#MMMMMMMMMMMMMM#.......',
    '......#MMMMMMMMMMMMMM#.......',
    '.......#MMMMMMMMMMMM#........',
    '.......#MMMMM##MMMMM#........',
    '......#MMMMM#..#MMMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '......#MMMM#....#MMMM#.......',
    '.....#MMMMM#....#MMMMM#......',
    '.....#########..#########....',
  ],
  { '#': 'dark', M: 'metal', O: 'accent' },
  { head: { x: 14, y: 0 }, hand: { x: 21, y: 9 }, weaponGrip: { x: 24, y: 12 }, capePin: { x: 6, y: 5 }, feet: { x: 14, y: 29 }, hit: { x: 14, y: 15 } },
);

const KING_HEAD = part(
  [
    '..#GGGGGGGG#..',
    '.#GOGGGGGGOG#.',
    '#GOOGGGGGGOOG#',
    '#SSSSSSSSSSSS#',
    '#SS#SSSSSS#SS#',
    '#SS#SLSSSL#SS#',
    '#SSSSSSSSSSSS#',
    '#SS##SSSS##SS#',
    '.#SSSSSSSSSS#.',
    '.#S#SSSSSS#S#.',
    '..#S#S##S#S#..',
    '...#########..',
  ],
  { '#': 'dark', G: 'glow', O: 'accent', S: 'skin', L: 'light' },
  { head: { x: 6, y: 11 } },
);

// --- Library ------------------------------------------------------------------

export const PART_LIBRARY = {
  // humanoid rig
  torso_slim: TORSO_SLIM,
  torso_heavy: TORSO_HEAVY,
  torso_robe: TORSO_ROBE,
  head_round: HEAD_ROUND,
  head_helm: HEAD_HELM,
  head_hood: HEAD_HOOD,
  arms_idle: ARMS_IDLE,
  arms_guard: ARMS_GUARD,
  // weapons
  sword: SWORD,
  dagger: DAGGER,
  staff: STAFF,
  bow: BOW,
  shield: SHIELD,
  orb: ORB,
  // capes
  cloak: CLOAK,
  // accessories
  crown: CROWN,
  halo: HALO,
  claw: CLAW,
  // EMBER CRYPT monsters
  imp_body: IMP_BODY,
  imp_wings: IMP_WINGS,
  hound_body: HOUND_BODY,
  wraith_body: WRAITH_BODY,
  // FROST MARSH monsters
  toad_body: TOAD_BODY,
  wisp_body: WISP_BODY,
  crab_body: CRAB_BODY,
  fenfire_body: FENFIRE_BODY,
  // boss scale
  king_body: KING_BODY,
  king_head: KING_HEAD,
} satisfies Record<string, PartDef>;

export type PartId = keyof typeof PART_LIBRARY;

/** Cell width/height of a part's own ASCII grid (before any pose rotation). */
export function partSize(id: PartId): { w: number; h: number } {
  const p = PART_LIBRARY[id];
  const h = p.rows.length;
  let w = 0;
  for (const row of p.rows) if (row.length > w) w = row.length;
  return { w, h };
}
