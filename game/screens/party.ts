// Ember Quest v3 — screens/party.ts: the party screen AND the three-column
// party grid every other run screen borrows. DESIGN.md → UI constraints, the
// region table's `party` row: three member columns in the card slots, each
// column six PARTY_ROW = 64 slot rows from y 128 (the row is the region's
// `index`), PARTY_SWAP / PARTY_LEADER / PARTY_BACK across the foot, group
// `party`, index 0 / 1 / 2, BACK also bound to B.
//
// Two things live here, and the second is why this file is first in the
// phase-5 set:
//   1. `addPartyColumns` / `drawPartyColumns` — the columns as a REUSABLE
//      widget. The FORGE picks its relic on them, the ALTAR its awakening
//      target, the REST its sharpen target, the Vault its relics to bank.
//      One geometry, one focus language, four screens.
//   2. `createPartyScreen` — the screen itself: who is in the party, what
//      they wear, which sets are live, who leads.
//
// The party screen DISPLAYS: relics are moved by the wear flow on a card
// screen and nowhere else (phase-5 decision: DESIGN.md:784's "relics move
// freely" has no rule behind it, so no mid-run re-slotting ships). SWAP and
// LEADER are the contract's two conditional actions and stay `disabled`
// unless the caller — the draft, a SUMMON, a REST, the ALTAR — enables them.
//
// Drawn in cards.ts's language: main.ts's one scene pass puts the lit biome
// behind, every plate is a thin translucent slab, every line the player reads
// is HUD text, and bitmap FONT_HD appears nowhere on this screen (a relic
// title in a 64-px row is a LABEL, not a card title).

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { PICO8 } from '../../engine';
import {
  CANVAS_W, CARD_X, CARD_W, HUD_LARGE, HUD_PX, HUD_SMALL, NAME_MAX_CHARACTER,
  PARTY_BACK, PARTY_LEADER, PARTY_ROW, PARTY_ROW_Y0, PARTY_SWAP, PAUSE_ICON, PAUSE_ICON_HIT,
  PORTRAIT, RELIC_TITLE_MAX,
} from './layout';
import {
  ACCENT, ACCENT_COOL, ACCENT_HP, C_GOLD, C_MUTED, C_VIOLET, EDGE_SOFT, ELEMENT_COLOR, HP_RULE_H,
  COLUMN_BASE_ALPHA, FOCUS_CHOSEN, INK_TROUGH, PLATE_RADIUS, focusGlow, focusLift,
  ELEMENT_ICON_NAME, SLOT_ICON_NAME, drawFocusablePlate, drawHpRule, drawIcon, drawPrimaryButton,
  drawSecondaryButton, formatSetBonus, gradientPlate, hudText, hudTextCentered, hudWidth, plate,
  portraitFor, roundRectPath, textWash, footHint,
} from './hud';
import type { PactId, Party, PartyMember, Rarity, Relic, RoomType, Slot } from '../types';
import { SLOTS } from '../types';
import { SETS } from '../data/sets';
import { ACTOR_RECIPES } from '../art/actors';
import type { DeriveCtx } from '../sim/relics';
import { activeSets, derive, isKindled, mainLine, relicTitle, wornRelics } from '../sim/relics';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];

/**
 * The rarity ramp, identical to cards.ts's own table (COMMON is the dim grey,
 * never the cream the focus ring owns).
 * // promote to hud.ts — two files now hold the same four rows.
 */
export const RARITY_COLOR: Record<Rarity, string> = {
  COMMON: C_MUTED, RARE: ACCENT_COOL, EPIC: C_VIOLET, LEGENDARY: ACCENT,
};

// ------------------------------------------------------------ geometry ----
// Everything below is `// promote to layout.ts`: the contract fixes the six
// rows, the three columns and the three foot buttons, and these are the
// numbers that fill the space those leave over.

/**
 * The column head — portrait, name, element, HP — between the banner and the
 * first slot row (y 128, the contract's own). It starts at 56, not 36: the
 * banner line every run screen wears sits at BANNER_Y and a taller head ran
 * straight through it.
 */
// promote to layout.ts
export const PARTY_HEAD = { y: 56, h: 68 } as const;
/** Where the six rows stop: PARTY_ROW_Y0 + 6 × PARTY_ROW. */
// promote to layout.ts
export const PARTY_ROWS_BOTTOM = PARTY_ROW_Y0 + 6 * PARTY_ROW;
/**
 * The set-bonus band, on its own line positions (see PARTY_SET_LINE_Y). The inspect
 * overlay's SET_BAND (x 48, w 968) would run straight through PARTY_SWAP and
 * PARTY_LEADER on this screen, so the band takes the clear gutter between
 * PARTY_LEADER's right edge (624) and PARTY_BACK's left (952).
 */
// promote to layout.ts
export const PARTY_SET_BAND = { x: 640, y: 512, w: 304, h: 136 } as const;
/**
 * This band's OWN line positions. It used to borrow the inspect overlay's
 * `SET_LINE_Y`; round 4 shrank the inspect panel and moved those lines to
 * 472/494/516, which printed the party's first set line ABOVE its own label.
 * The two bands are different screens and now say so.
 */
// promote to layout.ts
export const PARTY_SET_LINE_Y = [540, 576, 612] as const;
/** The band's own label row, clear of PARTY_SET_LINE_Y[0] = 540 (it used to sit on it). */
// promote to layout.ts
export const PARTY_SET_LABEL_Y = 512;
/** Pad inside a column plate, and the pitch of the two head lines. */
// promote to layout.ts
export const COL_PAD = 14;

/** The slot pictogram in a row, and the small marks in a head. */
// promote to layout.ts
export const ROW_ICON = 28;
// promote to layout.ts
export const HEAD_MARK = 20;

// ================================================================= views ===
/**
 * What every phase-5 screen reads off the run. `runstep.ts`'s own `RunView`
 * satisfies this structurally — extra fields are fine — and everything but
 * `party` is optional, so a view that has not grown a field yet still
 * type-checks. Named ScreenView, not RunView, so the two cannot be confused at
 * an import site: this one is the SUBSET the screens read, the seam's is the
 * whole live run. A screen never imports the seam's implementation, only
 * shapes like this one.
 */
export interface ScreenView {
  party: Party;
  act?: number;
  lap?: number;
  ascension?: number;
  score?: number;
  pactsTaken?: readonly PactId[];
  vault?: readonly Relic[];
  vaultSlots?: number;
  /** Where the party is standing (RunSnapshot): −1/−1 before an act's first room. */
  stage?: number;
  nodeIdx?: number;
  /** FIGHT/ELITE clears this act, and every room visited so far — both monotonic within a run. */
  clears?: number;
  rooms?: readonly RoomType[];
}

/**
 * The run's POSITION as a string, for a screen's "is this a new decision?" key.
 * A payload alone cannot answer that: two SUMMONs can offer the same three
 * characters and two walked-past FORGEs can see the same worn set, and a key
 * built from the payload alone let the second one open pre-picked with the
 * first one's answer still on screen. Position is what makes a decision new.
 */
export function viewKey(view: ScreenView): string {
  return `${view.act ?? 0}/${view.lap ?? 0}/${view.stage ?? -1}/${view.nodeIdx ?? -1}/${view.clears ?? 0}/${view.rooms?.length ?? 0}`;
}

/** The DeriveCtx every screen builds the same way — the leader's skill and the run's pacts. */
export function deriveCtxFor(view: ScreenView): DeriveCtx {
  const party = view.party;
  return { leader: party.members[party.leader]?.def.leader ?? null, pacts: view.pactsTaken ?? [] };
}

// ============================================================ pause icon ===
/**
 * The ribbon's pause glyph and its region, verbatim from cards.ts's own pair —
 * DESIGN.md's Input section ("PAUSE ... has an on-screen target — because a
 * phone has no keys") is a whole-game rule, so every screen in this set calls
 * both. Registered FIRST, so a card or a column keeps its own pixels where the
 * icon's 96-px hit rect overlaps them.
 * // promote to hud.ts — cards.ts holds the same two functions.
 */
export function addPauseIcon(regions: HitRegions): void {
  regions.add('pause-icon', PAUSE_ICON_HIT.x, PAUSE_ICON_HIT.y, PAUSE_ICON_HIT.w, PAUSE_ICON_HIT.h, { index: 90, group: 'ribbon' });
}
export function drawPauseIcon(ctx: CanvasRenderingContext2D, regions: HitRegions): void {
  const focused = regions.focused() === 'pause-icon';
  if (focused) focusGlow(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, PLATE_RADIUS, ACCENT);
  plate(ctx, PAUSE_ICON.x, PAUSE_ICON.y, PAUSE_ICON.w, PAUSE_ICON.h, { alpha: focused ? 0.66 : 0.5, border: EDGE_SOFT });
  ctx.fillStyle = focused ? PICO8[7] : PICO8[6];
  ctx.fillRect(PAUSE_ICON.x + 22, PAUSE_ICON.y + 20, 6, 24);
  ctx.fillRect(PAUSE_ICON.x + 36, PAUSE_ICON.y + 20, 6, 24);
}

/**
 * The one banner line every run screen wears, centred over the columns. 26, not
 * the 8 it started at: hudTextCentered's own vertical centring lifts a
 * HUD_LARGE line ~2 px above `y`, and anything above 24 is outside the safe
 * inset (DESIGN.md: hit rects may bleed into the margin, drawn panels may not).
 */
// promote to layout.ts
export const BANNER_Y = 26;
/**
 * ONE ACCENT SYSTEM. The screen title is ALWAYS the amber — there is no colour
 * parameter any more, because that parameter is what produced a cyan SUMMON, a
 * green REST, a violet SHRINE and a gold ALTAR, four titles in four hues on
 * four consecutive screens of one run. Where the room's own family still needs
 * to be said, it is said in a WORD: `accentWord` is drawn in `accentColor`
 * inside the otherwise-amber line, so the colour identifies the thing it names
 * rather than repainting the whole plate.
 *
 * Drawn as up to three runs measured with hudWidth: `ctx.letterSpacing` adds
 * its px after every glyph including the last, so the parts sum to the whole
 * and the line stays centred where a single call would have put it.
 */
export function drawBanner(ctx: CanvasRenderingContext2D, text: string, accentWord?: string, accentColor: string = ACCENT): void {
  const px = HUD_LARGE;
  const y = BANNER_Y + (HUD_LARGE - px * 1.16) / 2;
  const at = accentWord ? text.indexOf(accentWord) : -1;
  if (at < 0) {
    hudTextCentered(ctx, text, 0, BANNER_Y, CANVAS_W, HUD_LARGE, { px, color: ACCENT });
    return;
  }
  const head = text.slice(0, at);
  const mid = text.slice(at, at + accentWord!.length);
  const tail = text.slice(at + accentWord!.length);
  const total = hudWidth(ctx, text, px);
  let x = Math.round((CANVAS_W - total) / 2);
  if (head) x += hudText(ctx, head, x, y, { px, color: ACCENT });
  x += hudText(ctx, mid, x, y, { px, color: accentColor });
  if (tail) hudText(ctx, tail, x, y, { px, color: ACCENT });
}

// ======================================================= the party columns ==
export type PickMode = 'NONE' | 'ROW' | 'MEMBER';

export interface ColumnOptions {
  /** ROW: each of the six slot rows is a target. MEMBER: the whole column is one. NONE: display only. */
  pick: PickMode;
  /** Region id prefix: `<prefix>-row-<m>-<i>` / `<prefix>-col-<m>`. */
  prefix: string;
  /** Region group — 'party' on this screen, the node's own group elsewhere. */
  group: string;
  dctx: DeriveCtx;
  /** ROW mode: which rows may be activated (default: every row holding a relic). */
  rowEnabled?: (member: PartyMember, slot: Slot, relic: Relic | undefined, m: number, row: number) => boolean;
  /** MEMBER mode: which columns may be activated (default: all). */
  memberEnabled?: (member: PartyMember, m: number) => boolean;
  /** Rows drawn as already chosen — the accent border, no ring. */
  isRowChosen?: (m: number, row: number) => boolean;
  /** Columns drawn as chosen (the ALTAR's target, a REST's sharpen member, the selected column). */
  isMemberChosen?: (m: number) => boolean;
  /** A line under the head: the heal preview, the awakening's name, "+1 on 4 relics". */
  note?: (member: PartyMember, m: number) => string;
  /** A right-aligned tag on a row: "+1", "CAPPED", "TAKEN". */
  rowTag?: (member: PartyMember, slot: Slot, relic: Relic | undefined, m: number, row: number) => string;
}

const rowId = (o: ColumnOptions, m: number, row: number): string => `${o.prefix}-row-${m}-${row}`;
const colId = (o: ColumnOptions, m: number): string => `${o.prefix}-col-${m}`;

/** The drawn rect of member `m`'s slot row `row` — what the registry is given, and what the ring wears. */
export function partyRowRect(m: number, row: number): { x: number; y: number; w: number; h: number } {
  return { x: CARD_X[m], y: PARTY_ROW_Y0 + row * PARTY_ROW, w: CARD_W, h: PARTY_ROW };
}
/** The whole column, head included — MEMBER mode's target. */
export function partyColRect(m: number): { x: number; y: number; w: number; h: number } {
  return { x: CARD_X[m], y: PARTY_HEAD.y, w: CARD_W, h: PARTY_ROWS_BOTTOM - PARTY_HEAD.y };
}

/**
 * Registers the columns. DRAWN rects only — the registry grows each to
 * TAP_MIN about its centre, and a drawn rect always beats a neighbour's
 * expansion, so a 384 × 64 row is a comfortable target with no pre-grown
 * rect stealing its neighbour's taps.
 */
export function addPartyColumns(regions: HitRegions, party: Party, o: ColumnOptions): void {
  if (o.pick === 'NONE') return;
  for (let m = 0; m < party.members.length; m++) {
    const member = party.members[m];
    if (o.pick === 'MEMBER') {
      const r = partyColRect(m);
      regions.add(colId(o, m), r.x, r.y, r.w, r.h, {
        index: m, group: o.group, disabled: o.memberEnabled ? !o.memberEnabled(member, m) : false,
      });
      continue;
    }
    for (let row = 0; row < SLOTS.length; row++) {
      const slot = SLOTS[row];
      const relic = member.relics[slot];
      const enabled = o.rowEnabled ? o.rowEnabled(member, slot, relic, m, row) : relic !== undefined;
      const r = partyRowRect(m, row);
      regions.add(rowId(o, m, row), r.x, r.y, r.w, r.h, { index: row, group: o.group, disabled: !enabled });
    }
  }
}

/** Which column the focus is in, or null — what PARTY_SWAP and PARTY_LEADER act on. */
export function focusedColumn(regions: HitRegions, o: ColumnOptions): number | null {
  const id = regions.focused();
  if (!id || !id.startsWith(`${o.prefix}-`)) return null;
  const parts = id.split('-');
  const m = Number(parts[2]);
  return Number.isInteger(m) ? m : null;
}
/** The focused slot row, or null — the FORGE's picked relic. */
export function focusedRow(regions: HitRegions, o: ColumnOptions): { member: number; row: number } | null {
  const id = regions.focused();
  if (!id || !id.startsWith(`${o.prefix}-row-`)) return null;
  const parts = id.split('-');
  const m = Number(parts[2]);
  const row = Number(parts[3]);
  return Number.isInteger(m) && Number.isInteger(row) ? { member: m, row } : null;
}
/** Parses an activated column/row id back into its indices. */
export function parseColumnId(o: ColumnOptions, id: string | null): { member: number; row: number | null } | null {
  if (!id || !id.startsWith(`${o.prefix}-`)) return null;
  const parts = id.split('-');
  const kind = parts[1];
  const m = Number(parts[2]);
  if (!Number.isInteger(m)) return null;
  if (kind === 'col') return { member: m, row: null };
  const row = Number(parts[3]);
  return Number.isInteger(row) ? { member: m, row } : null;
}

function drawPortrait(ctx: CanvasRenderingContext2D, member: PartyMember, x: number, y: number, accent: string): void {
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

/** One column's head: who this is, what they are, how much of them is left. */
function drawHead(pc: PixelCanvas, m: number, member: PartyMember, leader: boolean, o: ColumnOptions, accent: string): void {
  const ctx = pc.ctx;
  const x = CARD_X[m];
  const y = PARTY_HEAD.y;
  const dead = member.hp <= 0;
  const maxHp = derive(member, o.dctx).HP;
  const nameX = x + COL_PAD + PORTRAIT + COL_PAD;

  // The pause icon owns the top-right corner of every screen (PAUSE_ICON_HIT),
  // so the third column's own right-hand marks step aside for it instead of
  // sitting under it.
  const clear = Math.max(0, x + CARD_W - PAUSE_ICON_HIT.x + 8);
  const right = x + CARD_W - COL_PAD - clear;

  drawPortrait(ctx, member, x + COL_PAD, y + 14, accent);
  hudText(ctx, member.def.name.slice(0, NAME_MAX_CHARACTER), nameX, y + 4, { px: HUD_LARGE, color: dead ? C_MUTED : C_TEXT });

  // The two marks that are not words: the element, and the leader's star.
  let markX = right - HEAD_MARK;
  drawIcon(ctx, ELEMENT_ICON_NAME[member.def.element], markX, y + 4, HEAD_MARK, ELEMENT_COLOR[member.def.element]);
  if (leader) {
    markX -= HEAD_MARK + 8;
    drawIcon(ctx, 'star', markX, y + 4, HEAD_MARK, C_GOLD);
  }

  // The note (a heal preview, an awakening) takes the sub-line's place when a
  // screen supplies one — the element is already a mark on the same row.
  const note = o.note?.(member, m) ?? '';
  // Just the word, not "LIGHT . AWAKENED": the element is already a mark on
  // this row, and the pair ran into the HP number on the third column.
  const sub = member.awakened ? 'AWAKENED' : member.def.element;
  hudText(ctx, note || sub, nameX, y + 30, { px: HUD_SMALL, color: note ? ACCENT_HP : member.awakened ? C_GOLD : C_MUTED });

  // HP as the panel's own rule: the bar carries the fraction, the number the detail.
  const hpText = dead ? 'DOWN' : `${member.hp} / ${maxHp}`;
  hudText(ctx, hpText, right, y + 28, { px: HUD_SMALL, color: dead ? C_MUTED : C_TEXT, align: 'right' });
  // A DOWNED member gets no rule at all — only a broken trough. drawHpRule tints
  // its trough with the element, and at frac 0 that tint IS the whole bar: a
  // full-width lit line that reads as full HP at a glance, which is the exact
  // opposite of the truth. Alpha alone did not fix it (a dim full line is still
  // a full line), so the tint goes and the trough is hatched instead.
  const barX = x + COL_PAD;
  const barW = CARD_W - 2 * COL_PAD;
  if (dead) {
    ctx.save();
    ctx.fillStyle = INK_TROUGH;
    ctx.fillRect(Math.round(barX), y + 54, barW, HP_RULE_H);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = C_MUTED;
    for (let hx = 0; hx < barW; hx += 10) ctx.fillRect(Math.round(barX + hx), y + 54, 4, HP_RULE_H);
    ctx.restore();
  } else {
    drawHpRule(ctx, barX, y + 54, barW, maxHp > 0 ? member.hp / maxHp : 0, member.def.element, true);
  }
}

/** One slot row: the slot's mark, the relic's title and main line, or a dash. */
function drawRow(pc: PixelCanvas, regions: HitRegions, m: number, member: PartyMember, row: number, o: ColumnOptions): void {
  const ctx = pc.ctx;
  const slot = SLOTS[row];
  const relic = member.relics[slot];
  const r = partyRowRect(m, row);
  const id = rowId(o, m, row);
  const focused = o.pick === 'ROW' && regions.focused() === id;
  const chosen = o.isRowChosen?.(m, row) ?? false;
  const enabled = o.pick !== 'ROW' || (o.rowEnabled ? o.rowEnabled(member, slot, relic, m, row) : relic !== undefined);
  const color = relic ? RARITY_COLOR[relic.rarity] : C_MUTED;

  if (focused) {
    drawFocusablePlate(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, true, undefined, 0.5, ACCENT);
  } else if (chosen) {
    focusGlow(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, PLATE_RADIUS, ACCENT, FOCUS_CHOSEN);
    plate(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, { alpha: 0.5 });
    focusLift(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, PLATE_RADIUS, ACCENT, FOCUS_CHOSEN);
  }
  ctx.save();
  if (!enabled) ctx.globalAlpha *= 0.45;
  drawIcon(ctx, SLOT_ICON_NAME[slot], r.x + COL_PAD, r.y + (PARTY_ROW - ROW_ICON) / 2, ROW_ICON, relic ? color : C_MUTED);
  const tx = r.x + COL_PAD + ROW_ICON + 14;
  if (relic) {
    hudText(ctx, relicTitle(relic).slice(0, RELIC_TITLE_MAX), tx, r.y + 10, { color: isKindled(relic) ? C_GOLD : color });
    hudText(ctx, mainLine(relic), tx, r.y + 34, { px: HUD_SMALL, color: C_DIM });
  } else {
    hudText(ctx, slot, tx, r.y + 10, { px: HUD_SMALL, color: C_MUTED });
    hudText(ctx, '—', tx, r.y + 30, { color: C_MUTED });
  }
  const tag = o.rowTag?.(member, slot, relic, m, row) ?? '';
  if (tag) hudText(ctx, tag, r.x + r.w - COL_PAD, r.y + 22, { px: HUD_SMALL, color: ACCENT_HP, align: 'right' });
  ctx.restore();
}

/** The three columns, heads and rows. Call after the scene pass, before the foot buttons. */
export function drawPartyColumns(pc: PixelCanvas, regions: HitRegions, party: Party, o: ColumnOptions): void {
  const ctx = pc.ctx;
  for (let m = 0; m < party.members.length; m++) {
    const member = party.members[m];
    const rect = partyColRect(m);
    const colFocused = o.pick === 'MEMBER' && regions.focused() === colId(o, m);
    const colChosen = o.isMemberChosen?.(m) ?? false;
    const enabled = o.pick !== 'MEMBER' || (o.memberEnabled ? o.memberEnabled(member, m) : true);
    // The column carries six rows of small text over a lit diorama, so its
    // wash holds a FLOOR instead of reaching zero two thirds down — that fade
    // is what let the marsh's dead trees run through the relic rows. Focus is
    // the glow and the lift, never a keyline.
    // CHOSEN is the same light at `FOCUS_CHOSEN` strength, never a border: an
    // amber keyline round the chosen column was the loudest edge on the party
    // screen and told the player "focused" in the very shape round 3 retired.
    // A BASE under the gradient (UI round-4 item 1): six rows of small text over
    // a lit diorama need the card plates' own floor, not a wash. Measured on
    // bank/rest the interiors were 21.0-23.5 L at satMean 30-33 with the marsh's
    // trees and boat legible through them; the cards that work read 12.2-13.4 L
    // at satMean 8-9, and they are a flat fill.
    const lit = colFocused || colChosen;
    if (lit) focusGlow(ctx, rect.x, rect.y, rect.w, rect.h, PLATE_RADIUS, ACCENT, colFocused ? 1 : FOCUS_CHOSEN);
    gradientPlate(ctx, rect.x, rect.y, rect.w, rect.h, {
      base: COLUMN_BASE_ALPHA,
      topAlpha: lit ? 0.42 : 0.3,
      floorAlpha: lit ? 0.3 : 0.2,
    });
    if (lit) focusLift(ctx, rect.x, rect.y, rect.w, rect.h, PLATE_RADIUS, ACCENT, colFocused ? 1 : FOCUS_CHOSEN);
    ctx.save();
    if (!enabled) ctx.globalAlpha *= 0.5;
    drawHead(pc, m, member, party.leader === m, o, colFocused || colChosen ? C_TEXT : C_DIM);
    ctx.restore();
    for (let row = 0; row < SLOTS.length; row++) drawRow(pc, regions, m, member, row, o);
  }
}

/** The live set bonuses, one line per distinct active set — the inspect overlay's own band, moved clear of the buttons. */
export function drawSetBand(pc: PixelCanvas, party: Party): void {
  const ctx = pc.ctx;
  const counts = new Map<string, number>();
  for (const m of party.members) for (const id of activeSets(wornRelics(m))) counts.set(id, (counts.get(id) ?? 0) + 1);
  // A WASH PER LINE (UI item 8). This band stands between the columns and the
  // foot row over OPEN FLOOR — the marsh's reeds and the crypt's brazier ran
  // straight through "SETS IN PLAY / none yet". One plate over the block would
  // put a hard vertical edge across the middle column's foot, so each line gets
  // the log line's own treatment instead: a short wash the width of that line,
  // faded out at both ends, with nothing between the lines.
  const washed = (text: string, y: number, color: string): void => {
    const w = hudWidth(ctx, text, HUD_SMALL);
    textWash(ctx, PARTY_SET_BAND.x - 14, y - 6, w + 40, HUD_SMALL + 12, 0.55);
    hudText(ctx, text, PARTY_SET_BAND.x, y, { px: HUD_SMALL, color });
  };
  washed('SETS IN PLAY', PARTY_SET_LABEL_Y, C_MUTED);
  if (counts.size === 0) {
    washed('none yet', PARTY_SET_LINE_Y[0], C_DIM);
    return;
  }
  let line = 0;
  for (const [id, n] of counts) {
    if (line >= PARTY_SET_LINE_Y.length) break;
    const def = SETS[id as keyof typeof SETS];
    if (!def) continue;
    const stack = n > 1 ? ` x${n}` : '';
    washed(`${def.name}${stack}  ${formatSetBonus(def.bonus)}`, PARTY_SET_LINE_Y[line], C_TEXT);
    line += 1;
  }
}

// ============================================================ the screen ===
export interface PartyScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** main.ts's one scene pass: the lit diorama every screen draws its HUD over. */
  scene(): void;
  onPause(): void;
  /** BACK — also bound to B. */
  onBack(): void;
  /** The focused column becomes the leader. Only offered where `leaderEnabled` is true. */
  onLeader?(member: number): void;
  /** The focused column is the one swapped out (a SUMMON with a full party). */
  onSwap?(member: number): void;
}

export interface PartyProps {
  view: ScreenView;
  /**
   * A LEADER decision is open — the draft, a SUMMON, a REST, the ALTAR
   * (DESIGN.md:783; the seam's LEADER pending). BACK then reads "KEEP <name>"
   * and the caller answers it with the seat as it stands, which is the seam's
   * own default.
   */
  leaderEnabled?: boolean;
  /** A SUMMON with a full party routes its swap through this screen. */
  swapEnabled?: boolean;
  /** The banner over the columns. */
  title?: string;
}

export interface PartyDevView {
  members: { id: string; hp: number; maxHp: number; leader: boolean; awakened: boolean; relics: (string | null)[] }[];
  focusColumn: number | null;
  focusRow: number | null;
}

export interface PartyScreen {
  update(dt: number, props: PartyProps): void;
  render(time: number, props: PartyProps): void;
  /** __eq.party() — what the screen believes, for a blind verifier. */
  view(props: PartyProps): PartyDevView;
}

export function createPartyScreen(deps: PartyScreenDeps): PartyScreen {
  const { pc, input, regions, audio, scene, onPause, onBack, onLeader, onSwap } = deps;
  /** The column the two conditional buttons act on: the last column focus was in. */
  let column = 0;

  function options(props: PartyProps): ColumnOptions {
    // Every row is a live target here, empty ones included: a row's action on
    // THIS screen is "select this column" (what SWAP and LEADER act on), not
    // "pick this relic", so a bare slot is still something to press.
    return { pick: 'ROW', prefix: 'party', group: 'party', dctx: deriveCtxFor(props.view), rowEnabled: () => true };
  }

  function update(_dt: number, props: PartyProps): void {
    const o = options(props);
    const party = props.view.party;
    regions.begin();
    addPauseIcon(regions);
    addPartyColumns(regions, party, o);
    // 8 / 9 / 10, not 0 / 1 / 2: the six slot rows already own 0-5 in this
    // group, so the contract's button indices put three regions on each of 0, 1
    // and 2 and every tie fell to registration order. The rows keep 0-5 and the
    // buttons sit after them (altar-continue 8, vault-continue 19 do the same).
    regions.add('party-swap', PARTY_SWAP.x, PARTY_SWAP.y, PARTY_SWAP.w, PARTY_SWAP.h, {
      index: 8, group: 'party', disabled: !props.swapEnabled,
    });
    regions.add('party-leader', PARTY_LEADER.x, PARTY_LEADER.y, PARTY_LEADER.w, PARTY_LEADER.h, {
      index: 9, group: 'party', disabled: !props.leaderEnabled,
    });
    regions.add('party-back', PARTY_BACK.x, PARTY_BACK.y, PARTY_BACK.w, PARTY_BACK.h, { index: 10, group: 'party' });
    regions.end();

    const inColumn = focusedColumn(regions, o);
    if (inColumn !== null && inColumn < party.members.length) column = inColumn;

    const act = regions.activated();
    if (input.pressed('B')) { audio.play('cancel'); onBack(); }
    else if (act === 'party-back') { audio.play('cancel'); onBack(); }
    else if (act === 'party-leader' && props.leaderEnabled) { audio.play('confirm'); onLeader?.(column); }
    else if (act === 'party-swap' && props.swapEnabled) { audio.play('confirm'); onSwap?.(column); }
    else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
    else if (act && act.startsWith('party-row-')) {
      // A row's own action: it SELECTS its column, which is what the two
      // conditional buttons act on. Relics are moved by the wear flow alone.
      const parsed = parseColumnId(o, act);
      if (parsed) { column = parsed.member; audio.play('ui'); }
    }
    input.endFrame();
  }

  function render(_time: number, props: PartyProps): void {
    const ctx = pc.ctx;
    const party = props.view.party;
    const o = options(props);
    o.isMemberChosen = (m) => m === column;
    scene();
    drawBanner(ctx, props.title ?? 'THE PARTY');
    drawPartyColumns(pc, regions, party, o);
    drawSetBand(pc, party);

    const member = party.members[column];
    const who = member ? member.def.name.slice(0, NAME_MAX_CHARACTER).toUpperCase() : '';
    const swapFocus = regions.focused() === 'party-swap';
    const leadFocus = regions.focused() === 'party-leader';
    if (props.swapEnabled) drawSecondaryButton(ctx, PARTY_SWAP.x, PARTY_SWAP.y, PARTY_SWAP.w, PARTY_SWAP.h, `SWAP OUT ${who}`, swapFocus);
    else drawDisabled(ctx, PARTY_SWAP, 'SWAP OUT', 'only at a SUMMON');
    if (props.leaderEnabled) drawPrimaryButton(ctx, PARTY_LEADER.x, PARTY_LEADER.y, PARTY_LEADER.w, PARTY_LEADER.h, `${who} LEADS`, leadFocus);
    else drawDisabled(ctx, PARTY_LEADER, 'LEADER', 'at a SUMMON, REST or ALTAR');
    // With a LEADER decision open, BACK is not "go away" — it is "leave the seat
    // where it is", which is exactly what the seam's own default does.
    const leaderNow = party.members[party.leader];
    const backLabel = props.leaderEnabled && leaderNow ? `KEEP ${leaderNow.def.name.toUpperCase()}` : 'BACK';
    drawSecondaryButton(ctx, PARTY_BACK.x, PARTY_BACK.y, PARTY_BACK.w, PARTY_BACK.h, backLabel, regions.focused() === 'party-back');

    footHint(pc, props.leaderEnabled ? 'arrows move . A selects a column . B keeps the seat as it is'
      : 'arrows move . A selects a column . B goes back');
    drawPauseIcon(ctx, regions);
  }

  return {
    update,
    render,
    view(props: PartyProps): PartyDevView {
      const o = options(props);
      const row = focusedRow(regions, o);
      const dctx = deriveCtxFor(props.view);
      return {
        members: props.view.party.members.map((m, i) => ({
          id: m.def.id,
          hp: m.hp,
          maxHp: derive(m, dctx).HP,
          leader: props.view.party.leader === i,
          awakened: m.awakened,
          relics: SLOTS.map((s) => (m.relics[s] ? relicTitle(m.relics[s] as Relic) : null)),
        })),
        focusColumn: row ? row.member : column,
        focusRow: row ? row.row : null,
      };
    },
  };
}

/** A button that is present but not offered: the label, and the reason under it. */
/**
 * A control that is not offered here — SWAP OUT away from a SUMMON, LEADER
 * away from a leader decision. It keeps its SEAT (UI item 6): two bare grey
 * lines on the diorama read as a caption nobody can act on, where the same
 * words on a quiet plate read as a button that is simply not lit yet, which is
 * what they are. `drawPendingButton`'s own body, plus the reason under it.
 */
export function drawDisabled(
  ctx: CanvasRenderingContext2D, rect: { x: number; y: number; w: number; h: number }, label: string, why: string,
): void {
  gradientPlate(ctx, rect.x, rect.y + 12, rect.w, rect.h - 24, { base: 0.46, topAlpha: 0.2, floorAlpha: 0.14 });
  hudTextCentered(ctx, label, rect.x, rect.y + 22, rect.w, HUD_PX, { color: C_MUTED, alpha: 0.75 });
  hudTextCentered(ctx, why, rect.x, rect.y + 48, rect.w, HUD_SMALL, { px: HUD_SMALL, color: C_MUTED, alpha: 0.6 });
}
