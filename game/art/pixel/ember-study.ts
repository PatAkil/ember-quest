// game/art/pixel/ember-study.ts — EMBER drawn as a DIRECT PIXEL GRID.
//
// The experiment behind this file: thirteen artist-plus-critic rounds took
// the procedural kit (game/art/parts.ts + actors.ts) to 9/10 on every
// measurable criterion and the sprites still read "a bit off" beside Octopath
// Traveler. The hypothesis is that the kit is the ceiling, not the model or
// the resolution — so this is one hero drawn by hand, cell by cell, at the
// SAME cell (ACTOR_SCALE 2 → one cell = 2 screen px), in the reference's
// craft: a full 1-px dark outline, interior lines wherever a form turns,
// three to four hard-edged tones per material, a head close to a third of
// the height, real eyes, real hands, tapered legs, dark boots, and a figure
// that sits DARK on the ground with only its highlights above L* 75.
//
// No imports from the kit: this module is data. tools/study.html renders it
// beside the reference crops and the kit's EMBER at matched zoom.
//
// Colours are EMBER's own (paletteOf(ACTOR_RECIPES.EMBER), logged from the
// page) so it is the same character — plus an outline and three added steps
// in the L* 35-45 band that every kit ramp lacks (each ramp jumps from its
// dark step at L* 27-31 straight to a midtone at L* 51-52, because `legal()`
// lifts every step from 2 up to clear 3.2:1 against the navy; a garment's
// shadow SIDE lives exactly in that gap on the reference).
//
// Authored FACING RIGHT (staff on the viewer's right, head turned 3/4 right),
// the way the kit's EMBER faces on the line-up; the battle mirrors it.

export type StudyPose = 'idle' | 'attack' | 'hurt' | 'cast' | 'dead';

export interface PixelStudy {
  readonly id: string;
  /** Character → hex colour. '.' and ' ' are transparent (makeSprite's rule). */
  readonly map: Readonly<Record<string, string>>;
  /** Frames per pose; each frame is a grid of equal-length rows (≤ 64 rows × ≤ 48 columns). */
  readonly poses: Readonly<Record<StudyPose, ReadonlyArray<ReadonlyArray<string>>>>;
  /** The floor contact, in cells: bottom centre of the figure. */
  readonly feet: { readonly x: number; readonly y: number };
  /** The torso centre, in cells (targeting cursors, hit pops). */
  readonly hit: { readonly x: number; readonly y: number };
  /** The torso box, in cells. */
  readonly hitSize: { readonly w: number; readonly h: number };
}

// --- Palette (24) ------------------------------------------------------------
// Ramps are EMBER's resolved ramps; "added" marks a step the ramp does not have.
const MAP: Readonly<Record<string, string>> = {
  o: '#1c1416', // outline — near-black, warm (added)
  // hair (EMBER_HAIR): deep strands / shadow / mid / lit / sheen
  h: '#4e3b3d', // hair step 1
  H: '#7a5d59', // added — L* 42, the shadow side of the mane
  i: '#95736f', // hair step 2
  I: '#a7887c', // hair step 3 — the lit mass (the kit's EMBER paints most of his mane in this)
  s: '#c9c2ba', // hair step 4 — the sheen crescent only
  // skin: shadow / mid + catchlight (the neck in shadow is the deep 'q')
  k: '#a77465', // skin step 2
  K: '#c3a28c', // skin step 3
  w: '#e6e5e2', // skin step 5 — one cell per eye
  // vest (EMBER_VEST / accent): deep / dark / mid / lit
  q: '#261d21', // accent step 0 — also every deep shadow and the boots
  V: '#4e3b42', // accent step 1
  m: '#6a5257', // added — L* 37, the lit plane of a dark garment
  M: '#907577', // accent step 2 — collar edge, lit seam
  // trousers (DUSK_CLOTH): deep / dark / mid / lit
  c: '#24212c', // cloth step 0
  C: '#4d465d', // cloth step 1
  p: '#625b70', // added — L* 40, the lit plane of the trousers
  P: '#7e778d', // cloth step 2 — a fold catch at the knee
  // leather (bracers, belt, boots' cuff, staff): dark / mid / lit
  l: '#563f3e', // leather step 1
  L: '#997261', // leather step 2
  b: '#b2957a', // leather step 3 — buckle, buttons, cuff, sole line
  // glow (FIRE): ember / flame / mid / core
  g: '#571d05', // glow step 1
  f: '#e16614', // glow step 2
  F: '#eca351', // glow step 3
  y: '#efd29f', // glow step 4
};

// --- idle, frame 0 — the master frame ---------------------------------------
// 40 columns × 64 rows. Body rows 10-63 (54 cells tall); the flame staff rises
// to row 1, so the staff is taller than he is. Key light upper-left.
//
//            0         1         2         3
//            0123456789012345678901234567890123456789
const IDLE_0: readonly string[] = [
  '....................................f...', // 0 flame tip
  '...................................fF...', // 1
  '..................................fFyf..', // 2
  '.................................fFyyFf.', // 3
  '.................................fFyyFf.', // 4
  '.................................fFyFf..', // 5
  '..................................fFFf..', // 6
  '..................................ggg...', // 7 the ember the flame sits on
  '.................h................oLl...', // 8 crown spike tip; staff: outline / lit core / shadow side
  '.............h..hIh....o..........oLl...', // 9 spike tips
  '............hIhhssIhhhhio.........oLl...', // 10
  '...........hIIsssssIIiiiio........oLl...', // 11 the mass; sheen crescent upper-left
  '..........hIssssIIIhIiiihio.......oLl...', // 12
  '.........hIssIIIIIIhiiiiihHo......oLl...', // 13
  '.........hssIIIhIIIihiiiiHhHo.....oLl...', // 14 strand lines run down-right
  '........hIIIIhIiIIiihiiiiHHHo.....oLl...', // 15
  '.......hIIIhIiiiiiiihiiiHHHHHooo..oLl...', // 16 left tip; right tip
  '.......hIhHHhiiiiihhHHHhHHhHHHHo..oLl...', // 17 right tip
  '........hhHHhhhhkkhhkkhhkhhHHoo...oLl...', // 18 fringe spikes over the forehead
  '.........hihiihokoooKKooooKhHo....oLl...', // 19 brows
  '.........hihiihokKwoKKKwoKKho.....oLl...', // 20 eyes, catchlight top-left
  '.........hihiihokKooKKKooKKo......oLl...', // 21
  '..........hhiihokKooKKKooKko......oLl...', // 22
  '..........hhihhokKKKKKKKKKko......oLl...', // 23
  '...........ohhookKKKKKKKKKko......oLl...', // 24
  '............ohookKKKKKKoKKko.....oLl....', // 25 mouth
  '.............o..okKKKKKKKko......oLl....', // 26
  '.................okKKKKKko.......oLl....', // 27 chin
  '..................ooooooo........oLl....', // 28 under the chin
  '...................oqqqqo........oLl....', // 29 neck, in deep shadow
  '................ooooqqqqooooo....oLl....', // 30 collar line
  '............oooooMMsssssMmVqooooooLl....', // 31 lapels, shirt V; the shoulder caps
  '............oKKkomMMsssMmVVqoKKkooLl....', // 32 shoulder caps
  '............oKKkoMMMMsMmVVVqoKKkooLl....', // 33
  '............oKKkoMMMmmobmVVqoKKkooLl....', // 34 front edge, button
  '............oKKkoMMMmmommVVqoKKkooLl....', // 35
  '............obLloMMMmVommVVqobLlooLl....', // 36 bracers, lit cuff
  '............olLloMMMmmVbmVVqolLlooLl....', // 37 button
  '............olLloMMmmmVmmVVqolLlooLl....', // 38
  '............ollloMMmmmommVVqoolllooLl...', // 39 the near wrist bends toward the staff
  '............oKKkoMMmmmobmVVqo.oKKkko....', // 40 hands; the near fist closes on the staff
  '............oKkkoMmmmmommVVqo.oKkkko....', // 41
  '............oooooLLLLLbbLLLLo..oooLl....', // 42 belt, buckle
  '................olllllbbllllo...oLl.....', // 43
  '................oPPpppCcppCco...oLl.....', // 44 hips
  '................oPPpppCcppCco...oLl.....', // 45
  '................oPpppCocppCco...oLl.....', // 46 legs part
  '................oPpCpCocppCco...oLl.....', // 47
  '................oPpCpCocppCco...oLl.....', // 48
  '................oPpppCocppCco...oLl.....', // 49
  '................opPpCo.oPpCco...oLl.....', // 50 knees: a fold catch, a gap between the legs
  '................opppCo.oppCco...oLl.....', // 51
  '................opppCo.oppCco...oLl.....', // 52
  '................opppCo.oppCco...oLl.....', // 53
  '................opppCo.oppCco...oLl.....', // 54
  '................opppCo.oppCco...oLl.....', // 55
  '................obbbbo.obbbbo...oLl.....', // 56 boot cuffs
  '................olqqqo.olqqqo...oLl.....', // 57
  '................olqqqo.olqqqo...oLl.....', // 58
  '................olqqqo.olqqqo...oLl.....', // 59
  '................olqqqo.olqqqo...oLl.....', // 60
  '................olqqbo.olqqqbo..oLl.....', // 61 toe caps
  '................olqqqo.olqqqqo..oLl.....', // 62
  '................oooooo.ooooooo..ooo.....', // 63 soles, ferrule
];

// TODO(phase 2): attack / hurt / cast / dead and the two other idle frames are
// copies of the master frame until the owner has judged the idle sheet.
const TODO_COPY: ReadonlyArray<ReadonlyArray<string>> = [IDLE_0, IDLE_0, IDLE_0];

export const EMBER_STUDY: PixelStudy = {
  id: 'EMBER_STUDY',
  map: MAP,
  poses: {
    idle: [IDLE_0, IDLE_0, IDLE_0], // TODO(phase 2): frames 1-2 are copies
    attack: TODO_COPY,
    hurt: TODO_COPY,
    cast: TODO_COPY,
    dead: TODO_COPY,
  },
  feet: { x: 22, y: 64 },
  hit: { x: 22, y: 36 },
  hitSize: { w: 14, h: 14 },
};
