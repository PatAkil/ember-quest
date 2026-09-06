// Ember Quest v3 — screens/cards.ts: every card screen the run drives outside
// battle. Three faces sharing one file because they are one flow: (1) the
// room-to-room card (name, biome, a blurb, CONTINUE), (2) the relic-card
// offer (N cards + SKIP), (3) — once a card is picked — the who-wears-it row
// (each member's current piece in the three card slots, a compare() line per
// WEAR_BTN, the fourth button decline). DESIGN.md → UI constraints (cards,
// skip rows), Relics (compare, rollRelic's card text).
//
// Drawn in the battle screen's language: main.ts's shared scene pass puts the
// lit crypt behind, and the cards are thin translucent plates over it, not
// boxes on black. Bitmap FONT_HD survives in exactly one place per the
// contract — the CARD TITLE (the room's name, the relic's name) at
// TEXT_LABEL. Everything else the player reads is HUD text at HUD_PX /
// HUD_SMALL, and the focused plate carries the focus ring.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { PICO8 } from '../../engine';
import {
  BLURB_LINES_MAX, CANVAS_W, CARD_PAD, CARD_W, CARD_W_FOUR, CARD_X, CARD_X_FOUR, CARD_Y, CARD_H,
  CONTINUE, HUD_LARGE, HUD_PX, HUD_SMALL, NAME_MAX_CHARACTER, PAUSE_ICON, PAUSE_ICON_HIT, PORTRAIT, SKIP,
  HUD_TITLE, HUD_TITLE_H, WEAR_BTN, WEAR_X, WEAR_Y,
} from './layout';
import {
  ACCENT, ACCENT_COOL, C_GOLD, C_MUTED, C_VIOLET, EDGE_SOFT, SLOT_ICON_NAME, drawFocusablePlate, drawIcon,
  drawPrimaryButton, drawSecondaryButton, formatSetBonus, gradientPlate, hudFit, hudText, hudTextCentered,
  plate, portraitFor, roundRectPath, titleBand, hudWidth, PLATE_RADIUS, focusGlow,
} from './hud';
import type { PartyMember, Rarity, Relic, Slot } from '../types';
import { SETS } from '../data/sets';
import type { ActorDrawState } from '../art/actors';
import { ACTOR_RECIPES, ACTOR_W, drawActor } from '../art/actors';
import { compare, isKindled, mainLine, relicTitle, sigilBlurb, substatLine } from '../sim/relics';
import type { DeriveCtx } from '../sim/relics';
import { mkDeriveCtx } from '../sim/run';
import type { RunScreen } from './run';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
/** Every accent on this screen comes out of hud.ts's three: the pure yellow and the pure cyan are gone. */
const C_ACCENT = ACCENT;
const C_KINDLED = C_GOLD;
// COMMON is the DIM grey, not the cream: a cream keyline is what "focused" used
// to look like, and a COMMON card wearing it would have said so on every row it
// appeared in. Focus is light now (hud.ts's `focusGlow`/`focusLift`), so the
// rarity border is free to be the only line on a card. The other three are the
// grade's own amber, tide and violet — four hues that all belong to the biome
// they are drawn over.
const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: C_MUTED, RARE: ACCENT_COOL, EPIC: C_VIOLET, LEGENDARY: ACCENT,
};
/** A card's plate is a shade denser than a bare panel: it carries five rows of small text. */
const CARD_ALPHA = 0.66;
/** The room card's own floor and how far below centre it sits — see renderRoomCard. */
const ROOM_CARD_MIN_H = 300;
const ROOM_CARD_DROP = 24;
/** The slot glyph beside a relic's slot name, and the portrait chip on a candidate column. */
const SLOT_CHIP = 32;

/**
 * A card's title line. Round 4 moved it off the bitmap face onto the HUD stack
 * (UI round-4 item 5) — the 3x5 face now appears only where it is alone, on the
 * logo and the damage pops — so this is `HUD_TITLE_H`, not `FONT_HD.glyphH x
 * TEXT_LABEL`. The title band survives: it is the card's HEAD, and a card wants
 * one whether or not two faces are meeting in it.
 */
const TITLE_H = HUD_TITLE_H;
/** Row pitch for HUD lines — body and small. */
const ROW = 26;
const ROW_SMALL = 21;
/** The banner over a card row (which drop this is, or which relic is being placed). */
const BANNER_Y = 40;

export interface CardsScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** main.ts's one scene pass: the lit diorama every screen draws its HUD over. */
  scene(): void;
  /**
   * PAUSE from the room card or a relic screen: main.ts's engine-scene PAUSED overlay, reached here by
   * the ribbon's own pause icon (battle.ts's PAUSE_ICON/PAUSE_ICON_HIT geometry, reused verbatim) so a
   * phone — which has no P key — can reach it from every non-battle screen, not only mid-fight. The raw
   * P/Esc key edge is still read directly in main.ts's update(); this is the on-screen route the
   * contract requires alongside it ("PAUSE ... have on-screen targets — because a phone has no keys").
   */
  onPause(): void;
}

export interface CardsScreen {
  update(dt: number, run: RunScreen): void;
  render(time: number, run: RunScreen): void;
}

/** Bitmap, centred — card titles only. */

/** The hairline under a card title: the rarity's colour, the width of the card's inner box. */
function titleRule(ctx: CanvasRenderingContext2D, x: number, w: number, y: number, color: string): void {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x + CARD_PAD), Math.round(y), Math.round(w - CARD_PAD * 2), 1);
  ctx.restore();
}

/** x positions for n offered cards: the authored 3-up/4-up rows verbatim, or a centred row for 1-2 (n=1 lands exactly on the room-card's middle slot). */
function cardXs(n: number): { xs: number[]; w: number } {
  if (n >= 4) return { xs: [...CARD_X_FOUR], w: CARD_W_FOUR };
  if (n === 3) return { xs: [...CARD_X], w: CARD_W };
  const gap = CARD_X[1] - CARD_X[0] - CARD_W;
  const total = n * CARD_W + Math.max(0, n - 1) * gap;
  const start = CANVAS_W / 2 - total / 2;
  return { xs: Array.from({ length: n }, (_, i) => Math.round(start + i * (CARD_W + gap))), w: CARD_W };
}

/**
 * Two buttons, never one generic bordered rectangle (UI item 9). CONTINUE is
 * the screen's call to action and gets the lit borderless plate; SKIP and
 * DECLINE are the quiet half and are plain text with a focus underline.
 */
function drawPrimary(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, label: string, focused: boolean, pressed = false): void {
  drawPrimaryButton(ctx, rect.x, rect.y, rect.w, rect.h, label, focused, pressed, C_ACCENT);
}
function drawSecondary(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, label: string, focused: boolean): void {
  drawSecondaryButton(ctx, rect.x, rect.y, rect.w, rect.h, label, focused, C_ACCENT);
}

/** The ribbon's own pause glyph (battle.ts's drawRibbon, verbatim) — reachable from every non-battle
 * screen too, per addPauseIcon()'s own hit region: a phone has no P key. */
function drawPauseIcon(ctx: CanvasRenderingContext2D, regions: HitRegions): void {
  const focused = regions.focused() === 'pause-icon';
  if (focused) focusGlow(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, PLATE_RADIUS, ACCENT);
  plate(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, { alpha: focused ? 0.66 : 0.5, border: EDGE_SOFT });
  ctx.fillStyle = focused ? PICO8[7] : PICO8[6];
  ctx.fillRect(PAUSE_ICON.x + 22, PAUSE_ICON.y + 20, 6, 24);
  ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 20, 6, 24);
}

/** The slot's own pictogram — the same mark the inspect overlay draws, no `Wp`/`Bt` anywhere. */
function drawSlotChip(ctx: CanvasRenderingContext2D, x: number, y: number, slot: Slot, color: string): void {
  drawIcon(ctx, SLOT_ICON_NAME[slot], x, y, SLOT_CHIP, color);
}

/** An actor's baked face in a chip — the ribbon's portrait, at the head of a candidate's column. */
function drawPortraitChip(ctx: CanvasRenderingContext2D, member: PartyMember, x: number, y: number, accent: string): void {
  plate(ctx, x, y, PORTRAIT, PORTRAIT, { alpha: 0.5, border: accent, radius: 3 });
  const recipe = ACTOR_RECIPES[member.def.id];
  const art = recipe ? portraitFor(recipe, member.def.element) : null;
  if (!art) return;
  ctx.save();
  roundRectPath(ctx, Math.round(x) + 1.5, Math.round(y) + 1.5, PORTRAIT - 3, PORTRAIT - 3, 3);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(art, Math.round(x), Math.round(y), PORTRAIT, PORTRAIT);
  ctx.restore();
}

/** A relic's numbers, from the main line down through its substats. Returns the y it finished at. */
function drawRelicStats(ctx: CanvasRenderingContext2D, relic: Relic, x: number, w: number, y: number, px: number): number {
  hudText(ctx, mainLine(relic), x + CARD_PAD, y, { px, color: C_TEXT });
  y += px === HUD_PX ? ROW : ROW_SMALL;
  for (let i = 0; i < 4; i++) {
    const line = substatLine(relic, i);
    if (!line) continue;
    hudText(ctx, line, x + CARD_PAD, y, { px: HUD_SMALL, color: C_DIM });
    y += ROW_SMALL;
  }
  return y;
}

/**
 * The head of a card: the height of the strip the bitmap TITLE owns. Measured
 * once here so the band, the title's baseline and the body below it cannot
 * drift apart.
 */
const TITLE_BAND_H = CARD_PAD + TITLE_H + 8;

/**
 * What a relic card is made of, measured before anything is drawn. Split out of
 * the draw so a ROW of cards can be sized together: every sibling used to
 * centre its OWN height in the 440-px band, which put three boss-reward cards'
 * tops at y 122 / 132 / 165 and their bottoms at 492 / 484 / 455 — a ragged row
 * that reads as a layout bug rather than as three offers.
 */
interface RelicCardParts { blurbLines: string[]; subs: number; topH: number; setH: number; sigilH: number; h: number }
function relicCardParts(ctx: CanvasRenderingContext2D, relic: Relic, w: number): RelicCardParts {
  const set = SETS[relic.set];
  const blurb = sigilBlurb(relic);
  const blurbLines = blurb ? hudFit(ctx, blurb, w - 2 * CARD_PAD, HUD_SMALL, BLURB_LINES_MAX) : [];
  let subs = 0;
  for (let k = 0; k < 4; k++) if (substatLine(relic, k)) subs += 1;
  const topH = TITLE_BAND_H + 12 + ROW_SMALL + 6 + SLOT_CHIP + 12 + ROW + subs * ROW_SMALL;
  const setH = set ? 8 + 12 + ROW_SMALL + ROW_SMALL : 0;
  const sigilH = blurbLines.length ? 14 + 8 + blurbLines.length * ROW_SMALL : 0;
  return { blurbLines, subs, topH, setH, sigilH, h: topH + setH + sigilH + CARD_PAD };
}

/**
 * One offered relic, filled out the way the battle's panels are: what it is
 * (title, rarity, slot), what it gives (main, substats), what its SET gives,
 * and — anchored at the foot, over its own hairline — what its sigil does.
 *
 * `cardY` / `cardH` come from the ROW, not from this card: the row sizes every
 * card to the tallest, so the tops, the set lines and the sigil lines all align
 * across the offer. The HIT rect stays the contract's full band (`CARD_H`, 472 since
 * UI round 4) either way.
 */
function drawRelicCard(
  pc: PixelCanvas, regions: HitRegions, relic: Relic, x: number, w: number, id: string,
  cardY: number, cardH: number, parts: RelicCardParts, rowSigilH: number,
): void {
  const ctx = pc.ctx;
  const color = RARITY_COLOR[relic.rarity];
  const set = SETS[relic.set];
  const { blurbLines } = parts;
  // NO RARITY STROKE (round-4 item 3): the cyan edge on a RARE card was the
  // highest-chroma line on any screen, and it said what the title's own colour
  // and the word RARE under it already say. Rarity is a colour ON TYPE now, not
  // a frame round a box; the focus glow still takes the rarity's hue.
  drawFocusablePlate(ctx, x, cardY, w, cardH, regions.focused() === id, undefined, CARD_ALPHA, color);

  // The bitmap title in a band of its own — the two type voices in two boxes,
  // never one (UI item 9; the contract keeps card titles bitmap).
  titleBand(ctx, x, cardY, w, TITLE_BAND_H, color);
  let y = cardY + CARD_PAD;
  hudTextCentered(ctx, relicTitle(relic), x, y, w, TITLE_H, { px: HUD_TITLE, color });
  y = cardY + TITLE_BAND_H + 12;
  // Rarity as a word, not only as a colour — and KINDLED rides the same line.
  const rarity = isKindled(relic) ? `${relic.rarity} . KINDLED` : relic.rarity;
  hudTextCentered(ctx, rarity, x, y, w, HUD_SMALL, { px: HUD_SMALL, color: isKindled(relic) ? C_KINDLED : color });
  y += ROW_SMALL + 6;

  drawSlotChip(ctx, x + CARD_PAD, y, relic.slot, color);
  hudText(ctx, relic.slot, x + CARD_PAD + SLOT_CHIP + 12, y + (SLOT_CHIP - HUD_PX) / 2 - 1, { color: C_TEXT });
  y += SLOT_CHIP + 12;

  // The slack a short card carries in a filled row is SPLIT, not left in one
  // lump: half above the stat block and half under it, so the card reads as
  // airy rather than as a plate with a hole between its stats and its set line.
  const slack = Math.max(0, cardH - parts.h);
  drawRelicStats(ctx, relic, x, w, y + Math.round(slack / 2), HUD_PX);

  // The set block and the sigil are the card's FOOT group, anchored to the
  // bottom edge: with the row sharing one height, that is what makes the set
  // lines and the sigil lines read as rows across three cards.
  let fy = cardY + cardH - CARD_PAD - rowSigilH - parts.setH;
  if (set) {
    fy += 8;
    titleRule(ctx, x, w, fy, C_DIM);
    fy += 12;
    hudText(ctx, `${set.pieces}-PIECE SET`, x + CARD_PAD, fy, { px: HUD_SMALL, color: C_DIM });
    fy += ROW_SMALL;
    hudText(ctx, formatSetBonus(set.bonus), x + CARD_PAD, fy, { px: HUD_SMALL, color: C_TEXT });
  }

  // The sigil is what makes the relic worth taking, so it closes the card.
  if (blurbLines.length) {
    let by = cardY + cardH - CARD_PAD - blurbLines.length * ROW_SMALL;
    titleRule(ctx, x, w, by - 14, color);
    for (const ln of blurbLines) {
      hudText(ctx, ln, x + CARD_PAD, by, { px: HUD_SMALL, color });
      by += ROW_SMALL;
    }
  }
}

function ctxFor(run: RunScreen): DeriveCtx {
  // The seam's own context, not a second copy of the rule: the run's pacts
  // belong in it (SCHISM rewrites what a leader skill is worth, FURY moves ATK),
  // so a compare() line drawn against an empty pact list would quote a number
  // the wearer will not actually get.
  const view = run.view();
  return mkDeriveCtx(view.party, view.pactsTaken);
}

/** One draw record for every candidate sprite on the who-wears-it row: the screen allocates nothing per frame. */
const wearPose: ActorDrawState = { pose: 'idle', time: 0, element: 'FIRE', facing: -1, x: 0, y: 0 };

export function createCardsScreen(deps: CardsScreenDeps): CardsScreen {
  const { pc, input, regions, audio, scene, onPause } = deps;
  let wearing: number | null = null;
  let lastOffer: Relic[] | null = null;
  /** The frame clock, so the idlers on the wear row actually breathe. */
  let wearClock = 0;

  /** The ribbon's own pause icon, reachable from every non-battle screen — DESIGN.md's Input section:
   * "PAUSE ... have on-screen targets — because a phone has no keys" is a rule about the whole game, not
   * only the battle screen. A high index and its own group keep it out of the primary flow's cycling. */
  function addPauseIcon(): void {
    regions.add('pause-icon', PAUSE_ICON_HIT.x, PAUSE_ICON_HIT.y, PAUSE_ICON_HIT.w, PAUSE_ICON_HIT.h, { index: 90, group: 'ribbon' });
  }
  /**
   * ...and it registers FIRST on every card screen. Its hit rect is (1176, 0,
   * 96, 96) and the third card slot starts at y 88, so the two overlap in a
   * 64x8 strip; the registry lets the LAST registration win, which handed that
   * strip — and the same strip off the third wear column — to PAUSE. Registered
   * first, the card wins its own pixels back and the icon keeps y 0-88.
   */

  // A screen's update() is a complete tick — begin -> add -> end -> check
  // activation -> endFrame() — exactly once, the same shape battle.ts uses:
  // regions.end() is what actually resolves this tick's tap/focus/activation,
  // so every branch below registers first, calls end(), THEN reacts.
  function update(_dt: number, run: RunScreen): void {
    const s = run.state();
    regions.begin();

    if (s.phase === 'ROOM') {
      addPauseIcon();
      regions.add('room-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 0 });
      regions.end();
      const act = regions.activated();
      if (act === 'room-continue') { audio.play('blip'); run.enterRoom(); }
      else if (act === 'pause-icon') { audio.play('blip'); onPause(); }
      input.endFrame();
      return;
    }
    if (s.phase !== 'CARDS') {
      wearing = null;
      lastOffer = null;
      regions.end();
      input.endFrame();
      return;
    }
    const offer = run.cards();
    if (offer !== lastOffer) { lastOffer = offer; wearing = null; }

    if (wearing === null) {
      addPauseIcon();
      const { xs, w } = cardXs(offer.length);
      offer.forEach((_r, i) => regions.add(`card-${i}`, xs[i], CARD_Y, w, CARD_H, { index: i, group: 'cards' }));
      regions.add('skip', SKIP.x, SKIP.y, SKIP.w, SKIP.h, { index: offer.length, group: 'cards' });
      regions.end();
      const act = regions.activated();
      if (act === 'skip' || input.pressed('B')) { audio.play('blip'); run.skip(); }
      else if (act?.startsWith('card-')) { audio.play('blip'); wearing = Number(act.slice(5)); }
      else if (act === 'pause-icon') { audio.play('blip'); onPause(); }
      input.endFrame();
      return;
    }
    const party = s.party;
    // The button FIRST — a twin id takes its geometry (and so its focus ring)
    // from the first registration — then the candidate's whole column as its
    // twin, because on a phone the column is the biggest thing on the screen
    // and DESIGN's Input section wants a panel and its target to share an id.
    addPauseIcon();
    const wearCols = cardXs(3);
    for (let m = 0; m < party.members.length; m++) {
      regions.add(`wear-${m}`, WEAR_X[m], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: m, group: 'wear' });
      regions.add(`wear-${m}`, wearCols.xs[m], CARD_Y, wearCols.w, CARD_H, { index: m, group: 'wear' });
    }
    regions.add('wear-decline', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 3, group: 'wear' });
    regions.end();
    if (input.pressed('B')) {
      wearing = null;
    } else {
      const act = regions.activated();
      if (act === 'wear-decline') { audio.play('blip'); run.skip(); wearing = null; }
      else if (act?.startsWith('wear-')) {
        const m = Number(act.slice(5));
        if (Number.isInteger(m)) { audio.play('pickup'); run.pick(wearing, m); wearing = null; }
      }
      else if (act === 'pause-icon') { audio.play('blip'); onPause(); }
    }
    input.endFrame();
  }

  function renderOffer(run: RunScreen, offer: readonly Relic[]): void {
    const ctx = pc.ctx;
    const source = run.state().cardSource;
    const label = source === 'BOSS' ? 'BOSS REWARD' : source === 'ELITE' ? 'ELITE REWARD'
      : source === 'LOOT' ? 'TREASURE' : source === 'SUMMON' ? 'THE EPIC ON OFFER' : 'FIGHT DROP';
    hudTextCentered(ctx, label, 0, BANNER_Y, CANVAS_W, HUD_LARGE, { px: HUD_LARGE, color: C_ACCENT });
    const { xs, w } = cardXs(offer.length);
    // ONE height for the row: measured from every card, taken from the tallest,
    // centred in the contract's band (`CARD_H` 472) once.
    // THE ROW FILLS THE BAND (UI round-4 item 4). Round 3 sized the row to its
    // tallest card and centred it, which left 174 px of bare floor under it.
    // The row is the band now: the head group sits at the top and the set and
    // sigil groups stay anchored to the foot, so a short card carries its slack
    // as air between its own blocks instead of as a dead strip under all three.
    const parts = offer.map((relic) => relicCardParts(ctx, relic, w));
    let rowSigilH = 0;
    for (const p of parts) if (p.sigilH > rowSigilH) rowSigilH = p.sigilH;
    const cardH = CARD_H;
    const cardY = CARD_Y;
    offer.forEach((relic, i) => drawRelicCard(pc, regions, relic, xs[i], w, `card-${i}`, cardY, cardH, parts[i], rowSigilH));
    drawSecondary(ctx, SKIP, 'SKIP', regions.focused() === 'skip');
    drawPauseIcon(ctx, regions);
  }

  function renderWear(run: RunScreen, relic: Relic): void {
    const ctx = pc.ctx;
    const color = RARITY_COLOR[relic.rarity];
    // The relic being placed, as its own card title (bitmap) + its main line
    // (HUD) — and the bitmap gets a band of its own so the two voices are not
    // stacked bare on the diorama.
    const headW = Math.max(360, hudWidth(ctx, relicTitle(relic), HUD_TITLE) + 120);
    // y 24, not 14: a DRAWN panel may not bleed into the safe inset (the hit
    // rects are what are allowed to).
    const headH = 14 + TITLE_H + 8;
    titleBand(ctx, (CANVAS_W - headW) / 2, 24, headW, headH, color);
    hudTextCentered(ctx, relicTitle(relic), 0, 36, CANVAS_W, TITLE_H, { px: HUD_TITLE, color });
    hudTextCentered(ctx, mainLine(relic), 0, 24 + headH + 6, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });

    const { xs, w } = cardXs(3);
    const party = run.state().party;
    const ctxD = ctxFor(run);

    // The column is MEASURED, like the relic cards — and the three are measured
    // TOGETHER, so a party where one member wears the slot and two do not still
    // reads as one row rather than three cards at three heights.
    const cols = party.members.map((member) => {
      const current = member.relics[relic.slot];
      const recipe = ACTOR_RECIPES[member.def.id];
      const spriteH = recipe ? ACTOR_W * 0.9 : 0;
      let subs = 0;
      if (current) for (let k = 0; k < 4; k++) if (substatLine(current, k)) subs += 1;
      const relicBlockH = current ? TITLE_BAND_H + 6 + ROW_SMALL * (1 + subs) : ROW_SMALL;
      return {
        current, recipe, spriteH, relicBlockH,
        h: CARD_PAD * 2 + PORTRAIT + 10 + 14 + ROW + relicBlockH + 12 + spriteH + 14 + ROW_SMALL,
      };
    });
    const relicBlockMax = cols.reduce((m, c) => Math.max(m, c.relicBlockH), 0);
    const cardH = CARD_H;
    const cardY = CARD_Y;

    party.members.forEach((member, i) => {
      const focused = regions.focused() === `wear-${i}`;
      const { current, recipe, spriteH } = cols[i];
      const relicBlockH = relicBlockMax;
      const line = compare(member, relic, ctxD).line;
      // The column and its button are one target (twinned ids), so they light together.
      drawFocusablePlate(ctx, xs[i], cardY, w, cardH, focused, undefined, CARD_ALPHA);

      // Who: the baked face, then the name.
      let y = cardY + CARD_PAD;
      drawPortraitChip(ctx, member, xs[i] + CARD_PAD, y, focused ? C_TEXT : C_DIM);
      hudText(ctx, member.def.name.slice(0, NAME_MAX_CHARACTER), xs[i] + CARD_PAD + PORTRAIT + 14, y + (PORTRAIT - HUD_LARGE) / 2 - 1, {
        px: HUD_LARGE, color: C_TEXT,
      });
      y += PORTRAIT + 10;
      titleRule(ctx, xs[i], w, y, focused ? C_TEXT : C_DIM);
      y += 14;

      // What they are wearing there now, then the candidate THEMSELVES idling at
      // ACTOR_SCALE — the sprite is the column's picture, where the word EMPTY was.
      hudTextCentered(ctx, `${relic.slot} NOW`, xs[i], y, w, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      y += ROW;
      if (current) {
        const cc = RARITY_COLOR[current.rarity];
        titleBand(ctx, xs[i] + CARD_PAD, y - 6, w - 2 * CARD_PAD, TITLE_H + 12, cc, 3, 0.34);
        hudTextCentered(ctx, relicTitle(current), xs[i], y, w, TITLE_H, { px: HUD_TITLE, color: cc });
        drawRelicStats(ctx, current, xs[i], w, y + TITLE_H + 16, HUD_SMALL);
      } else {
        hudTextCentered(ctx, 'nothing worn', xs[i], y, w, ROW_SMALL, { px: HUD_SMALL, color: C_DIM });
      }
      y += relicBlockH + 12;
      const spriteFeet = y + spriteH;
      if (recipe) {
        // Clipped to the column, so a tall recipe can never spill onto its neighbour.
        ctx.save();
        roundRectPath(ctx, xs[i] + 1, cardY + 1, w - 2, cardH - 2, 4);
        ctx.clip();
        wearPose.time = wearClock;
        wearPose.element = member.def.element;
        wearPose.x = xs[i] + w / 2;
        wearPose.y = spriteFeet;
        drawActor(ctx, recipe, wearPose);
        ctx.restore();
      }

      // And what taking it would change — the same line the button carries, at
      // the foot of the column where there is room to read it.
      const footY = cardY + cardH - CARD_PAD - ROW_SMALL;
      titleRule(ctx, xs[i], w, footY - 14, focused ? C_TEXT : C_DIM);
      hudTextCentered(ctx, line, xs[i], footY, w, HUD_SMALL, { px: HUD_SMALL, color: focused ? C_TEXT : C_DIM });

      // Three equal choices, so none of them is THE primary: a plate each, and
      // the ring says which one the keyboard is on.
      // Three equal seats, each visibly a seat AT REST: the second candidate's
      // button was a wash that reached zero before its own text and read as
      // bare words on the floor (UI item 6).
      const btn = { x: WEAR_X[i], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
      gradientPlate(ctx, btn.x, btn.y + 12, btn.w, btn.h - 24, {
        topAlpha: focused ? 0.68 : 0.5, floorAlpha: focused ? 0.52 : 0.38, focused,
      });
      hudText(ctx, member.def.name.slice(0, NAME_MAX_CHARACTER), btn.x + 14, btn.y + 26, { color: C_TEXT });
      hudText(ctx, line, btn.x + 14, btn.y + 50, { px: HUD_SMALL, color: focused ? C_TEXT : C_DIM });
    });

    const declineBtn = { x: WEAR_X[3], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
    drawSecondary(ctx, declineBtn, 'DECLINE', regions.focused() === 'wear-decline');
    drawPauseIcon(ctx, regions);
  }

  function renderRoom(run: RunScreen): void {
    const ctx = pc.ctx;
    const s = run.state();
    const { xs, w } = cardXs(1);
    const x = xs[0];
    // The plate is the height of the three lines it holds, centred in the
    // contract's band (`CARD_H` 472) — the room card used to be 62 % empty.
    const blurb = hudFit(ctx, s.roomCard.blurb, w - 2 * CARD_PAD, HUD_PX, BLURB_LINES_MAX);
    const blockH = TITLE_H + 20 + HUD_SMALL + 14 + blurb.length * ROW;
    // A FLOOR under the measured height (UI round-4 item 4): a two-line blurb
    // gave a 190-px plate in a 472-px band, which put a 140-px strip of bare
    // floor between the card and the CONTINUE seat. 300 is the height at which
    // the gap under it lands inside the 100-px bar on every blurb length.
    const cardH = Math.max(ROOM_CARD_MIN_H, blockH + CARD_PAD * 3);
    const cardY = Math.round(CARD_Y + (CARD_H - cardH) / 2) + ROOM_CARD_DROP;
    gradientPlate(ctx, x, cardY, w, cardH, { base: 0.5, topAlpha: 0.5, floorAlpha: 0.36 });
    // The room's name is a card title: bitmap, per the contract — in a band of
    // its own, so the bitmap word and the vector blurb are not in one box.
    titleBand(ctx, x, cardY, w, TITLE_BAND_H, C_ACCENT);
    let y = cardY + CARD_PAD;
    hudTextCentered(ctx, s.roomCard.title, x, y, w, TITLE_H, { px: HUD_TITLE, color: C_ACCENT });
    y = cardY + TITLE_BAND_H + 12;
    hudTextCentered(ctx, s.roomCard.biome, x, y, w, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
    y += HUD_SMALL + 14;
    for (const ln of blurb) {
      hudTextCentered(ctx, ln, x, y, w, HUD_PX, { color: C_TEXT });
      y += ROW;
    }
    drawPrimary(ctx, CONTINUE, 'CONTINUE', regions.focused() === 'room-continue', regions.pressing() === 'room-continue');
    drawPauseIcon(ctx, regions);
  }

  return {
    update,
    render(time: number, run: RunScreen) {
      wearClock = time;
      scene();
      const s = run.state();
      if (s.phase === 'ROOM') { renderRoom(run); return; }
      if (s.phase !== 'CARDS') return;
      const offer = run.cards();
      if (wearing === null) renderOffer(run, offer);
      else renderWear(run, offer[wearing]);
    },
  };
}
