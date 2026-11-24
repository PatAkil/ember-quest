import { makeSprite, PICO8 } from '../../engine';
import type { Sprite, SpriteMap } from '../../engine';

const KEYLINE = { outline: PICO8[0] };
const keyed = (rows: string[], map: SpriteMap): Sprite => makeSprite(rows, { k: PICO8[0], ...map }, KEYLINE);

export const ICON_SWORD = keyed([
  '......W',
  '.....WS',
  '....WS.',
  '...WS..',
  'G.WS...',
  '.G.....',
  'B.G....',
], { W: PICO8[7], S: PICO8[6], G: PICO8[9], B: PICO8[4] });

export const ICON_WAND = keyed([
  '....CC.',
  '...CWWC',
  '...CWCC',
  '...OCC.',
  '..O....',
  '.O.....',
  'O......',
], { C: PICO8[12], W: PICO8[7], O: PICO8[9] });

export const ICON_ARMOR = keyed([
  'HH...OO',
  'HHOkOOD',
  'HOOOOOD',
  '.HOOOD.',
  '.HOOOD.',
  '.OOOOD.',
  '.DDDDD.',
], { H: PICO8[10], O: PICO8[9], D: PICO8[4] });

export const ICON_NECKLACE = keyed([
  'C.....C',
  'C.....C',
  '.C...C.',
  '..CPC..',
  '.PPWPP.',
  '..PPD..',
  '...D...',
], { C: PICO8[10], P: PICO8[14], W: PICO8[7], D: PICO8[2] });

export const ICON_BOOTS = keyed([
  '.WWW...',
  '.BBB...',
  '.BBB...',
  '.BBBB..',
  '.BBBBBB',
  'BBBBBBB',
  'SSS.SSS',
], { W: PICO8[7], B: PICO8[15], S: PICO8[4] });

export const ICON_CHALICE = keyed([
  'YYYYYYY',
  'YWYYYYO',
  '.YYYYO.',
  '..YYO..',
  '...Y...',
  '..YYO..',
  '.YYYYO.',
], { Y: PICO8[10], W: PICO8[7], O: PICO8[9] });

const TOME_ROWS = [
  'DDGGGG.',
  'DYGGGGW',
  'DDGYYGP',
  'DDGYYGW',
  'DYGGGGP',
  'DDGGGGW',
  '.DWPWPW',
];
export const ICON_TOME = keyed(TOME_ROWS, { G: PICO8[11], D: PICO8[3], Y: PICO8[10], W: PICO8[7], P: PICO8[6] });
export const ICON_SCROLL = keyed(TOME_ROWS, { G: PICO8[12], D: PICO8[13], Y: PICO8[7], W: PICO8[7], P: PICO8[6] });

export const ICON_EMPTY = makeSprite([
  '.........',
  '.FF...FF.',
  '.F.....F.',
  '.........',
  '.........',
  '.........',
  '.F.....F.',
  '.FF...FF.',
  '.........',
], { F: PICO8[13] });

export const HERO_PIP = keyed([
  '..WWW..',
  '...W...',
  '.RRRRR.',
  'RRRRRRD',
  'RYYYYYD',
  'RRRRRRD',
  '.RRDDD.',
], { W: PICO8[7], R: PICO8[8], Y: PICO8[10], D: PICO8[2] });

interface RoomRows { rows: string[]; map: SpriteMap; hue: string }

const ROOM_ROWS = {
  FIGHT: {
    rows: ['W.......W', '.W.....W.', '..S...S..', '...S.S...', '....W....', '.G.S.S.G.', '..G...G..', '.B.G.G.B.', 'B.......B'],
    map: { W: PICO8[7], S: PICO8[6], G: PICO8[9], B: PICO8[4] }, hue: PICO8[7],
  },
  ELITE: {
    rows: ['H.......H', 'H.......H', '.hRRRRRh.', '.RRRRRRR.', '.RYYRYYD.', '.RRRRRRD.', '..RRkRD..', '..RkRkD..', '...D.D...'],
    map: { H: PICO8[7], h: PICO8[6], R: PICO8[8], D: PICO8[2], Y: PICO8[10] }, hue: PICO8[8],
  },
  REST: {
    rows: ['....O....', '...OO..O.', '..OOYO.O.', '..OYYOOO.', '.OOYWYOO.', '.OYYWYYO.', '..OYYYO..', 'LLDOOODLL', '..LL.LL..'],
    map: { O: PICO8[9], Y: PICO8[10], W: PICO8[7], L: PICO8[4], D: PICO8[2] }, hue: PICO8[9],
  },
  LOOT: {
    rows: ['..BBBBB..', '.BWBBBBB.', 'BBBBBBBBB', 'BTBBBBBTB', 'TTTTWTTTT', 'BTBBkBBTB', 'BTBBBBBTB', 'STSSSSSTS', 'STSSSSSTS'],
    map: { B: PICO8[12], S: PICO8[13], T: PICO8[10], W: PICO8[7] }, hue: PICO8[12],
  },
  EVENT: {
    rows: ['..GGGGG..', '.GW...GGD', '.GD...GGD', '.....GGD.', '....GGD..', '....GD...', '.........', '....GW...', '....GD...'],
    map: { G: PICO8[11], W: PICO8[7], D: PICO8[3] }, hue: PICO8[11],
  },
  BOSS: {
    rows: ['P...Y...P', 'P..PPP..P', 'PP.PPP.PP', '.PPPPPPP.', '.PPPPPPP.', '.YPCPCPY.', '.PPPPPPP.', '.DDDDDDD.', '.........'],
    map: { P: PICO8[14], D: PICO8[2], Y: PICO8[10], C: PICO8[12] }, hue: PICO8[14],
  },
} satisfies Record<string, RoomRows>;

type RoomKind = keyof typeof ROOM_ROWS;
export interface RoomArt { icon: Sprite; faint: Sprite; spent: Sprite; hue: string }

const tinted = (rows: string[], color: string): Sprite => makeSprite(rows.map((r) => r.replace(/[^.k]/g, 'c')), { c: color, k: PICO8[0] }, KEYLINE);

function roomArt(spec: RoomRows): RoomArt {
  return {
    icon: keyed(spec.rows, spec.map),
    faint: tinted(spec.rows, PICO8[13]),
    spent: tinted(spec.rows, PICO8[5]),
    hue: spec.hue,
  };
}

export const ROOM_ART: Record<RoomKind, RoomArt> = {
  FIGHT: roomArt(ROOM_ROWS.FIGHT),
  ELITE: roomArt(ROOM_ROWS.ELITE),
  REST: roomArt(ROOM_ROWS.REST),
  LOOT: roomArt(ROOM_ROWS.LOOT),
  EVENT: roomArt(ROOM_ROWS.EVENT),
  BOSS: roomArt(ROOM_ROWS.BOSS),
};
