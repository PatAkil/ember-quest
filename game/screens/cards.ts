// Ember Quest v3 — screens/cards.ts: every card screen the run drives outside
// battle. Three faces sharing one file because they are one flow: (1) the
// room-to-room card (name, biome, a blurb, CONTINUE), (2) the relic-card
// offer (N cards + SKIP), (3) — once a card is picked — the who-wears-it row
// (each member's current piece in the three card slots, a compare() line per
// WEAR_BTN, the fourth button decline). DESIGN.md → UI constraints (cards,
// skip rows), Relics (compare, rollRelic's card text).

import type { Audio, HitRegions, Input, PixelCanvas, TextOptions } from '../../engine';
import { FONT_HD, PICO8, drawPanel, drawText, textWidth } from '../../engine';
import {
  BLURB_LINES_MAX, CANVAS_W, CARD_PAD, CARD_W, CARD_W_FOUR, CARD_X, CARD_X_FOUR, CARD_Y, CARD_H,
  CONTINUE, SKIP, TEXT_BODY, TEXT_LABEL, WEAR_BTN, WEAR_X, WEAR_Y, fitText,
} from './layout';
import type { Rarity, Relic } from '../types';
import { compare, isKindled, mainLine, relicTitle, sigilBlurb, substatLine } from '../sim/relics';
import type { DeriveCtx } from '../sim/relics';
import type { RunScreen } from './run';

const hd = { font: FONT_HD };
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_PANEL = PICO8[1];
const C_ACCENT = PICO8[10];
const RARITY_COLOR: Record<Rarity, string> = { COMMON: PICO8[7], RARE: PICO8[12], EPIC: PICO8[14], LEGENDARY: PICO8[9] };
const LINE_H = FONT_HD.glyphH * TEXT_BODY + 5;

export interface CardsScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
}

export interface CardsScreen {
  update(dt: number, run: RunScreen): void;
  render(time: number, run: RunScreen): void;
}

function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, w: number, y: number, opts: TextOptions): void {
  const tw = textWidth(text, opts.scale ?? 1, opts.spacing ?? 1, opts.font);
  drawText(ctx, text, Math.round(x + (w - tw) / 2), y, opts);
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

function drawRelicCard(pc: PixelCanvas, regions: HitRegions, relic: Relic, x: number, w: number, id: string): void {
  const ctx = pc.ctx;
  const color = RARITY_COLOR[relic.rarity];
  const focused = regions.focused() === id;
  drawPanel(pc, x, CARD_Y, w, CARD_H, { color: C_PANEL, border: focused ? C_TEXT : color });
  let y = CARD_Y + CARD_PAD;
  centerText(ctx, relicTitle(relic), x, w, y, { ...hd, color, scale: TEXT_LABEL });
  y += LINE_H + 6;
  centerText(ctx, relic.slot, x, w, y, { ...hd, color: C_DIM, scale: TEXT_BODY });
  y += LINE_H + 4;
  if (isKindled(relic)) {
    centerText(ctx, 'KINDLED', x, w, y, { ...hd, color: PICO8[9], scale: TEXT_BODY });
    y += LINE_H + 4;
  }
  y += 6;
  drawText(ctx, mainLine(relic), x + CARD_PAD, y, { ...hd, color: C_TEXT, scale: TEXT_BODY });
  y += LINE_H;
  for (let i = 0; i < 4; i++) {
    const line = substatLine(relic, i);
    if (!line) continue;
    drawText(ctx, line, x + CARD_PAD, y, { ...hd, color: C_DIM, scale: TEXT_BODY });
    y += LINE_H;
  }
  const blurb = sigilBlurb(relic);
  if (blurb) {
    y += 6;
    for (const ln of fitText(blurb, w - 2 * CARD_PAD, TEXT_BODY, FONT_HD, BLURB_LINES_MAX)) {
      drawText(ctx, ln, x + CARD_PAD, y, { ...hd, color, scale: TEXT_BODY });
      y += LINE_H;
    }
  }
}

function ctxFor(run: RunScreen): DeriveCtx {
  const party = run.state().party;
  return { leader: party.members[party.leader]?.def.leader ?? null, pacts: [] };
}

export function createCardsScreen(deps: CardsScreenDeps): CardsScreen {
  const { pc, input, regions, audio } = deps;
  let wearing: number | null = null;
  let lastOffer: Relic[] | null = null;

  // A screen's update() is a complete tick — begin -> add -> end -> check
  // activation -> endFrame() — exactly once, the same shape battle.ts uses:
  // regions.end() is what actually resolves this tick's tap/focus/activation,
  // so every branch below registers first, calls end(), THEN reacts.
  function update(_dt: number, run: RunScreen): void {
    const s = run.state();
    regions.begin();

    if (s.phase === 'ROOM') {
      regions.add('room-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 0 });
      regions.end();
      if (regions.activated() === 'room-continue') { audio.play('blip'); run.enterRoom(); }
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
      regions.end();
      const act = regions.activated();
      if (act === 'skip' || input.pressed('B')) { audio.play('blip'); run.skip(); }
      else if (act?.startsWith('card-')) { audio.play('blip'); wearing = Number(act.slice(5)); }
      input.endFrame();
      return;
    }
    const party = s.party;
    for (let m = 0; m < party.members.length; m++) regions.add(`wear-${m}`, WEAR_X[m], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: m, group: 'wear' });
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
    }
    input.endFrame();
  }

  function renderOffer(run: RunScreen, offer: readonly Relic[]): void {
    const ctx = pc.ctx;
    const label = run.state().cardSource === 'BOSS' ? 'BOSS REWARD' : run.state().cardSource === 'LOOT' ? 'TREASURE' : 'FIGHT DROP';
    centerText(ctx, label, 0, CANVAS_W, 52, { ...hd, color: C_ACCENT, scale: TEXT_LABEL });
    const { xs, w } = cardXs(offer.length);
    offer.forEach((relic, i) => drawRelicCard(pc, regions, relic, xs[i], w, `card-${i}`));
    const skipFocused = regions.focused() === 'skip';
    drawPanel(pc, SKIP.x, SKIP.y, SKIP.w, SKIP.h, { color: C_PANEL, border: skipFocused ? C_TEXT : C_DIM });
    centerText(ctx, 'SKIP', SKIP.x, SKIP.w, SKIP.y + 30, { ...hd, color: skipFocused ? C_TEXT : C_DIM, scale: TEXT_LABEL });
  }

  function renderWear(run: RunScreen, relic: Relic): void {
    const ctx = pc.ctx;
    const color = RARITY_COLOR[relic.rarity];
    centerText(ctx, `${relicTitle(relic)} — ${mainLine(relic)}`, 0, CANVAS_W, 52, { ...hd, color, scale: TEXT_LABEL });
    const { xs, w } = cardXs(3);
    const party = run.state().party;
    const ctxD = ctxFor(run);
    party.members.forEach((member, i) => {
      const current = member.relics[relic.slot];
      drawPanel(pc, xs[i], CARD_Y, w, CARD_H, { color: C_PANEL, border: C_DIM });
      let y = CARD_Y + CARD_PAD;
      centerText(ctx, member.def.name.toUpperCase(), xs[i], w, y, { ...hd, color: C_TEXT, scale: TEXT_LABEL });
      y += LINE_H + 10;
      if (current) {
        centerText(ctx, relicTitle(current), xs[i], w, y, { ...hd, color: RARITY_COLOR[current.rarity], scale: TEXT_BODY });
        y += LINE_H;
        drawText(ctx, mainLine(current), xs[i] + CARD_PAD, y, { ...hd, color: C_DIM, scale: TEXT_BODY });
      } else {
        centerText(ctx, 'EMPTY', xs[i], w, y, { ...hd, color: C_DIM, scale: TEXT_BODY });
      }
      const btn = { x: WEAR_X[i], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
      const focused = regions.focused() === `wear-${i}`;
      drawPanel(pc, btn.x, btn.y, btn.w, btn.h, { color: C_PANEL, border: focused ? C_TEXT : color });
      drawText(ctx, member.def.name.toUpperCase(), btn.x + 10, btn.y + 10, { ...hd, color: focused ? C_TEXT : C_DIM, scale: TEXT_BODY });
      drawText(ctx, compare(member, relic, ctxD).line, btn.x + 10, btn.y + 10 + LINE_H, { ...hd, color: C_TEXT, scale: TEXT_BODY });
    });
    const declineBtn = { x: WEAR_X[3], y: WEAR_Y, w: WEAR_BTN.w, h: WEAR_BTN.h };
    const declineFocused = regions.focused() === 'wear-decline';
    drawPanel(pc, declineBtn.x, declineBtn.y, declineBtn.w, declineBtn.h, { color: C_PANEL, border: declineFocused ? C_TEXT : C_DIM });
    centerText(ctx, 'DECLINE', declineBtn.x, declineBtn.w, declineBtn.y + 38, { ...hd, color: declineFocused ? C_TEXT : C_DIM, scale: TEXT_BODY });
  }

  function renderRoom(run: RunScreen): void {
    const ctx = pc.ctx;
    const s = run.state();
    const { xs, w } = cardXs(1);
    const x = xs[0];
    drawPanel(pc, x, CARD_Y, w, CARD_H, { color: C_PANEL, border: C_ACCENT });
    let y = CARD_Y + CARD_PAD + 6;
    centerText(ctx, s.roomCard.title, x, w, y, { ...hd, color: C_ACCENT, scale: TEXT_LABEL });
    y += LINE_H + 4;
    centerText(ctx, s.roomCard.biome, x, w, y, { ...hd, color: C_DIM, scale: TEXT_BODY });
    y += LINE_H + 16;
    for (const ln of fitText(s.roomCard.blurb, w - 2 * CARD_PAD, TEXT_BODY, FONT_HD, BLURB_LINES_MAX)) {
      centerText(ctx, ln, x, w, y, { ...hd, color: C_TEXT, scale: TEXT_BODY });
      y += LINE_H;
    }
    const focused = regions.focused() === 'room-continue';
    drawPanel(pc, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { color: C_PANEL, border: focused ? C_TEXT : C_ACCENT });
    centerText(ctx, 'CONTINUE', CONTINUE.x, CONTINUE.w, CONTINUE.y + 30, { ...hd, color: focused ? C_TEXT : C_DIM, scale: TEXT_LABEL });
  }

  return {
    update,
    render(_time: number, run: RunScreen) {
      const s = run.state();
      if (s.phase === 'ROOM') { renderRoom(run); return; }
      if (s.phase !== 'CARDS') return;
      const offer = run.cards();
      if (wearing === null) renderOffer(run, offer);
      else renderWear(run, offer[wearing]);
    },
  };
}
