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

import type { Audio, HitRegions, Input, PixelCanvas, TextOptions } from '../../engine';
import { FONT_HD, PICO8, drawText, textWidth } from '../../engine';
import {
  BLURB_LINES_MAX, CANVAS_W, CARD_PAD, CARD_W, CARD_W_FOUR, CARD_X, CARD_X_FOUR, CARD_Y, CARD_H,
  CONTINUE, HUD_LARGE, HUD_PX, HUD_SMALL, NAME_MAX_CHARACTER, PAUSE_ICON, PAUSE_ICON_HIT, PORTRAIT, SKIP,
  TEXT_LABEL, WEAR_BTN, WEAR_X, WEAR_Y,
} from './layout';
import {
  SLOT_ABBR, drawFocusablePlate, formatSetBonus, hudFit, hudText, hudTextCentered, plate, portraitFor,
  roundRectPath,
} from './hud';
import type { PartyMember, Rarity, Relic } from '../types';
import { SETS } from '../data/sets';
import { ACTOR_RECIPES } from '../art/actors';
import { compare, isKindled, mainLine, relicTitle, sigilBlurb, substatLine } from '../sim/relics';
import type { DeriveCtx } from '../sim/relics';
import type { RunScreen } from './run';

const hd = { font: FONT_HD };
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_ACCENT = PICO8[10];
const C_KINDLED = PICO8[9];
// COMMON is the DIM grey, not the cream: cream belongs to the focus ring alone
// (hud.ts's FOCUS_RING), and a COMMON card wearing it would say "focused" on
// every row it appeared in.
const RARITY_COLOR: Record<Rarity, string> = { COMMON: PICO8[6], RARE: PICO8[12], EPIC: PICO8[14], LEGENDARY: PICO8[9] };
/** A card's plate is a shade denser than a bare panel: it carries five rows of small text. */
const CARD_ALPHA = 0.58;
/** The slot glyph beside a relic's slot name, and the portrait chip on a candidate column. */
const SLOT_CHIP = 32;

/** The one bitmap line on a card: its title, at TEXT_LABEL (FONT_HD is 11 rows tall). */
const TITLE_H = FONT_HD.glyphH * TEXT_LABEL;
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
function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, w: number, y: number, opts: TextOptions): void {
  const tw = textWidth(text, opts.scale ?? 1, opts.spacing ?? 1, opts.font);
  drawText(ctx, text, Math.round(x + (w - tw) / 2), y, opts);
}

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

/** Every button on these screens is the same object: a thin plate, a HUD label, a ring when focused. */
function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  label: string,
  focused: boolean,
  accent: string,
): void {
  drawFocusablePlate(ctx, rect.x, rect.y, rect.w, rect.h, focused, accent, 0.55);
  // The ring says "focused", not the ink: a label the player has to read is
  // never dimmed just because the keyboard is elsewhere.
  hudTextCentered(ctx, label, rect.x, rect.y, rect.w, rect.h, { color: C_TEXT });
}

/** The ribbon's own pause glyph (battle.ts's drawRibbon, verbatim) — reachable from every non-battle
 * screen too, per addPauseIcon()'s own hit region: a phone has no P key. */
function drawPauseIcon(ctx: CanvasRenderingContext2D, regions: HitRegions): void {
  const focused = regions.focused() === 'pause-icon';
  plate(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, { alpha: 0.5, border: focused ? PICO8[7] : 'rgba(255,255,255,0.2)' });
  ctx.fillStyle = focused ? PICO8[7] : PICO8[6];
  ctx.fillRect(PAUSE_ICON.x + 22, PAUSE_ICON.y + 20, 6, 24);
  ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 20, 6, 24);
}

/** A small square chip with a two-letter glyph — the inspect overlay's slot icon, reused. */
function drawSlotChip(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  plate(ctx, x, y, SLOT_CHIP, SLOT_CHIP, { alpha: 0.5, border: color, radius: 3 });
  hudTextCentered(ctx, label, x, y, SLOT_CHIP, SLOT_CHIP, { px: HUD_SMALL, color });
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
 * One offered relic, filled out the way the battle's panels are: what it is
 * (title, rarity, slot), what it gives (main, substats), what its SET gives,
 * and — anchored at the foot, over its own hairline — what its sigil does.
 */
function drawRelicCard(pc: PixelCanvas, regions: HitRegions, relic: Relic, x: number, w: number, id: string): void {
  const ctx = pc.ctx;
  const color = RARITY_COLOR[relic.rarity];
  drawFocusablePlate(ctx, x, CARD_Y, w, CARD_H, regions.focused() === id, color, CARD_ALPHA);

  let y = CARD_Y + CARD_PAD;
  // The card title stays bitmap — the contract's one exception on this screen.
  centerText(ctx, relicTitle(relic), x, w, y, { ...hd, color, scale: TEXT_LABEL });
  y += TITLE_H + 8;
  titleRule(ctx, x, w, y, color);
  y += 12;
  // Rarity as a word, not only as a colour — and KINDLED rides the same line.
  const rarity = isKindled(relic) ? `${relic.rarity} . KINDLED` : relic.rarity;
  hudTextCentered(ctx, rarity, x, y, w, HUD_SMALL, { px: HUD_SMALL, color: isKindled(relic) ? C_KINDLED : color });
  y += ROW_SMALL + 6;

  drawSlotChip(ctx, x + CARD_PAD, y, SLOT_ABBR[relic.slot], color);
  hudText(ctx, relic.slot, x + CARD_PAD + SLOT_CHIP + 12, y + (SLOT_CHIP - HUD_PX) / 2 - 1, { color: C_TEXT });
  y += SLOT_CHIP + 12;

  y = drawRelicStats(ctx, relic, x, w, y, HUD_PX);

  // What the SET is worth: the title already names it, so this is the number.
  const set = SETS[relic.set];
  if (set) {
    y += 8;
    titleRule(ctx, x, w, y, C_DIM);
    y += 12;
    hudText(ctx, `${set.pieces}-PIECE SET`, x + CARD_PAD, y, { px: HUD_SMALL, color: C_DIM });
    y += ROW_SMALL;
    hudText(ctx, formatSetBonus(set.bonus), x + CARD_PAD, y, { px: HUD_SMALL, color: C_TEXT });
  }

  // The sigil is what makes the relic worth taking, so it gets the card's foot
  // to itself: numbers at the top, the effect at the bottom, air in between.
  const blurb = sigilBlurb(relic);
  if (blurb) {
    const lines = hudFit(ctx, blurb, w - 2 * CARD_PAD, HUD_SMALL, BLURB_LINES_MAX);
    let by = CARD_Y + CARD_H - CARD_PAD - lines.length * ROW_SMALL;
    titleRule(ctx, x, w, by - 14, color);
    for (const ln of lines) {
      hudText(ctx, ln, x + CARD_PAD, by, { px: HUD_SMALL, color });
      by += ROW_SMALL;
    }
  }
}

function ctxFor(run: RunScreen): DeriveCtx {
  const party = run.state().party;
  return { leader: party.members[party.leader]?.def.leader ?? null, pacts: [] };
}

export function createCardsScreen(deps: CardsScreenDeps): CardsScreen {
  const { pc, input, regions, audio, scene, onPause } = deps;
  let wearing: number | null = null;
  let lastOffer: Relic[] | null = null;

  /** The ribbon's own pause icon, reachable from every non-battle screen — DESIGN.md's Input section:
   * "PAUSE ... have on-screen targets — because a phone has no keys" is a rule about the whole game, not
   * only the battle screen. A high index and its own group keep it out of the primary flow's cycling. */
  function addPauseIcon(): void {
    regions.add('pause-icon', PAUSE_ICON_HIT.x, PAUSE_ICON_HIT.y, PAUSE_ICON_HIT.w, PAUSE_ICON_HIT.h, { index: 90, group: 'ribbon' });
  }

  // A screen's update() is a complete tick — begin -> add -> end -> check
  // activation -> endFrame() — exactly once, the same shape battle.ts uses:
  // regions.end() is what actually resolves this tick's tap/focus/activation,
  // so every branch below registers first, calls end(), THEN reacts.
  function update(_dt: number, run: RunScreen): void {
    const s = run.state();
    regions.begin();

    if (s.phase === 'ROOM') {
      regions.add('room-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 0 });
      addPauseIcon();
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
      const { xs, w } = cardXs(offer.length);
      offer.forEach((_r, i) => regions.add(`card-${i}`, xs[i], CARD_Y, w, CARD_H, { index: i, group: 'cards' }));
      regions.add('skip', SKIP.x, SKIP.y, SKIP.w, SKIP.h, { index: offer.length, group: 'cards' });
      addPauseIcon();
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
    const wearCols = cardXs(3);
    for (let m = 0; m < party.members.length; m++) {
      regions.add(`wear-${m}`, WEAR_X[m], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: m, group: 'wear' });
      regions.add(`wear-${m}`, wearCols.xs[m], CARD_Y, wearCols.w, CARD_H, { index: m, group: 'wear' });
    }
    regions.add('wear-decline', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 3, group: 'wear' });
    addPauseIcon();
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
    const label = source === 'BOSS' ? 'BOSS REWARD' : source === 'LOOT' ? 'TREASURE' : 'FIGHT DROP';
    hudTextCentered(ctx, label, 0, BANNER_Y, CANVAS_W, HUD_LARGE, { px: HUD_LARGE, color: C_ACCENT });
    const { xs, w } = cardXs(offer.length);
    offer.forEach((relic, i) => drawRelicCard(pc, regions, relic, xs[i], w, `card-${i}`));
    drawButton(ctx, SKIP, 'SKIP', regions.focused() === 'skip', C_DIM);
    drawPauseIcon(ctx, regions);
  }

  function renderWear(run: RunScreen, relic: Relic): void {
    const ctx = pc.ctx;
    const color = RARITY_COLOR[relic.rarity];
    // The relic being placed, as its own card title (bitmap) + its main line (HUD).
    centerText(ctx, relicTitle(relic), 0, CANVAS_W, 26, { ...hd, color, scale: TEXT_LABEL });
    hudTextCentered(ctx, mainLine(relic), 0, 26 + TITLE_H + 4, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });

    const { xs, w } = cardXs(3);
    const party = run.state().party;
    const ctxD = ctxFor(run);
    party.members.forEach((member, i) => {
      const focused = regions.focused() === `wear-${i}`;
      // The column and its button are one target (twinned ids), so they light together.
      drawFocusablePlate(ctx, xs[i], CARD_Y, w, CARD_H, focused, undefined, CARD_ALPHA);
      const current = member.relics[relic.slot];
      const line = compare(member, relic, ctxD).line;

      // Who: the baked face, then the name.
      let y = CARD_Y + CARD_PAD;
      drawPortraitChip(ctx, member, xs[i] + CARD_PAD, y, focused ? C_TEXT : C_DIM);
      hudText(ctx, member.def.name.slice(0, NAME_MAX_CHARACTER), xs[i] + CARD_PAD + PORTRAIT + 14, y + (PORTRAIT - HUD_LARGE) / 2 - 1, {
        px: HUD_LARGE, color: C_TEXT,
      });
      y += PORTRAIT + 10;
      titleRule(ctx, xs[i], w, y, focused ? C_TEXT : C_DIM);
      y += 14;

      // What they are wearing there now, centred in the space between the header
      // and the compare line — a one-substat COMMON and a four-substat LEGENDARY
      // both sit in the middle of the column instead of hanging off the top,
      // the way renderRoom centres its block.
      hudTextCentered(ctx, `${relic.slot} NOW`, xs[i], y, w, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      y += ROW;
      const footY = CARD_Y + CARD_H - CARD_PAD - ROW_SMALL;
      const bodyTop = y;
      const bodyBottom = footY - 14; // the foot hairline
      if (current) {
        let subs = 0;
        for (let k = 0; k < 4; k++) if (substatLine(current, k)) subs += 1;
        const blockH = TITLE_H + 10 + ROW_SMALL * (1 + subs);
        let by = Math.round(bodyTop + (bodyBottom - bodyTop - blockH) / 2);
        centerText(ctx, relicTitle(current), xs[i], w, by, { ...hd, color: RARITY_COLOR[current.rarity], scale: TEXT_LABEL });
        by += TITLE_H + 10;
        drawRelicStats(ctx, current, xs[i], w, by, HUD_SMALL);
      } else {
        // Nothing to compare against: say so once, in the middle of the same space.
        hudTextCentered(ctx, 'EMPTY', xs[i], (bodyTop + bodyBottom - HUD_PX) / 2, w, HUD_PX, { color: C_DIM });
      }

      // And what taking it would change — the same line the button carries, at
      // the foot of the column where there is room to read it.
      titleRule(ctx, xs[i], w, footY - 14, focused ? C_TEXT : C_DIM);
      hudTextCentered(ctx, line, xs[i], footY, w, HUD_SMALL, { px: HUD_SMALL, color: focused ? C_TEXT : C_DIM });

      const btn = { x: WEAR_X[i], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
      drawFocusablePlate(ctx, btn.x, btn.y, btn.w, btn.h, focused, color, 0.55);
      hudText(ctx, member.def.name.slice(0, NAME_MAX_CHARACTER), btn.x + 14, btn.y + 22, { color: C_TEXT });
      hudText(ctx, line, btn.x + 14, btn.y + 50, { px: HUD_SMALL, color: focused ? C_TEXT : C_DIM });
    });

    const declineBtn = { x: WEAR_X[3], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
    drawButton(ctx, declineBtn, 'DECLINE', regions.focused() === 'wear-decline', C_DIM);
    drawPauseIcon(ctx, regions);
  }

  function renderRoom(run: RunScreen): void {
    const ctx = pc.ctx;
    const s = run.state();
    const { xs, w } = cardXs(1);
    const x = xs[0];
    plate(ctx, x, CARD_Y, w, CARD_H, { border: C_ACCENT, alpha: 0.58 });
    // The slot's 384x440 is the contract's; the room's three lines are centred
    // inside it, so the space around them reads as margin, not as a hole.
    const blurb = hudFit(ctx, s.roomCard.blurb, w - 2 * CARD_PAD, HUD_PX, BLURB_LINES_MAX);
    const blockH = TITLE_H + 20 + HUD_SMALL + 14 + blurb.length * ROW;
    let y = Math.round(CARD_Y + (CARD_H - blockH) / 2);
    // The room's name is a card title: bitmap, per the contract.
    centerText(ctx, s.roomCard.title, x, w, y, { ...hd, color: C_ACCENT, scale: TEXT_LABEL });
    y += TITLE_H + 8;
    titleRule(ctx, x, w, y, C_ACCENT);
    y += 12;
    hudTextCentered(ctx, s.roomCard.biome, x, y, w, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
    y += HUD_SMALL + 14;
    for (const ln of blurb) {
      hudTextCentered(ctx, ln, x, y, w, HUD_PX, { color: C_TEXT });
      y += ROW;
    }
    drawButton(ctx, CONTINUE, 'CONTINUE', regions.focused() === 'room-continue', C_ACCENT);
    drawPauseIcon(ctx, regions);
  }

  return {
    update,
    render(_time: number, run: RunScreen) {
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
