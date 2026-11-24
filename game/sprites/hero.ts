import { PICO8, makeSprite } from '../../engine';
import { breatheFrames, mirrorRows } from './helpers';

const HERO_MAP = { k: PICO8[0], b: PICO8[8], s: PICO8[2], h: PICO8[9], p: PICO8[7], w: PICO8[6], g: PICO8[5], e: PICO8[10] };

const HERO_ROWS: [string, ...string[]] = [
  '.......kpk............',
  '.......kpk............',
  '......kppk............',
  '......kppk..........k.',
  '.....kkhhkk........kwk',
  '....khhhbbbk.......kwk',
  '....khbbbbbsk.....kwgk',
  '....kbbbbbbsk.....kwgk',
  '....kbkeekbsk.....kwgk',
  '....kbbbbbbsk....kwgk.',
  '.....kbbbbsk.....kwgk.',
  '...kkkkbbbkkkk...kwgk.',
  '..khhhbbbbbbsskk.kwgk.',
  '.khhbbbbbbbbbssskhhhhk',
  '.kbbbkbbbbbbkbbsskhkk.',
  '.kbbskkbbbbkkbbsskbk..',
  '.kssk.kbbbbk.kssskkk..',
  '.kkk..kbhbbk..kkkk....',
  '.....kbbbbbbk.........',
  '.....kbbbbsbk.........',
  '.....kbbskbsk.........',
  '....kbbsk.kbsk........',
  '....kbbsk.kbbsk.......',
  '....kbssk.kbssk.......',
  '....kbssk.kbssk.......',
  '...kbbbbk.kbbbbk......',
  '...kkkkkk.kkkkkk......',
];

export const heroFrames = breatheFrames(HERO_ROWS, HERO_MAP);

const HOLLOW_MAP = { k: PICO8[0], b: PICO8[2], s: PICO8[1], h: PICO8[13], p: PICO8[13], w: PICO8[5], g: PICO8[1], e: PICO8[8] };

export const hollowFrames = breatheFrames(mirrorRows(HERO_ROWS), HOLLOW_MAP);

export const heroFallen = makeSprite([
  '.........kkkkk......................kkkk..............',
  '........keeeeek....................khhbbk.............',
  '.......kkkkkkkkk.kkkkkkkkkk.......khbbbbsk..kkk.......',
  '.....kkhhkffffk.khhhhhhhhhhk.....khbbkkbsk.kppk.kek...',
  '..kk.khbbkfkfkkkhbbbbbbbbbbskk..khbbk.kbbskkpwgkkek...',
  '.kppkkbbbkffkgkkbbbbbbbbbbbsshkkhbbk...kbbskwwgkkekkk.',
  'kpppwkbbbbkkkgkkkkkkkkkkkwwkkhbkbbsk....kbhhkwgkkepppk',
  'kppwwwkbbbbbsgkhbbbbbbbbkwwgkbbkbbsk.....khhkwgkkewwwk',
  'kpwwwwwksssskgkssssssssskkkkkssksssk......kkkkkkkekkk.',
  '.kkkkkkkkkkkk.kkkkkkkkkkkkkk.kkkkkkkk.........kk.k....',
], { ...HERO_MAP, f: PICO8[15] });
