// Ember Quest v3 — game/screens/layout.ts: every constant of DESIGN.md's
// "UI constraints" section (under Presentation) as named exports, plus the
// region table's geometry and a handful of small pure helpers screens build
// on. Values are transcribed EXACTLY as the contract states them — this file
// owns no rule and draws nothing; it is the shared ruler every screen holds
// itself against, so a shared number never drifts between files.
//
// Owned by no single screen: game/screens/run.ts, cards.ts, battle.ts, and
// every screen after it import from here. Nothing in this file imports a
// screen, so there is no cycle to worry about.

import type { BitmapFont, PixelCanvas } from '../../engine';
import { textWidth } from '../../engine';

// ================================================================ canvas ===
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// ================================================================== text ===
/** Nothing renders below scale 2. */
export const TEXT_POP = 3;
/** A crit's hit pop renders one scale larger than a normal hit's. */
export const TEXT_POP_CRIT = 4;
/** Skill labels, the current actor's name, door and card titles. */
export const TEXT_LABEL = 3;
/** Everything else. */
export const TEXT_BODY = 2;

// ------------------------------------------------------------ name caps ----
export const LOG_LINE_MAX = 72;
export const NAME_MAX_CHARACTER = 16;
export const NAME_MAX_SKILL = 14;
export const NAME_MAX_SET = 8;
export const NAME_MAX_ENEMY = 16;
export const NAME_MAX_BIOME = 12;
export const NAME_MAX_PACT = 16;
export const BLURB_MAX = 30;
export const RELIC_TITLE_MAX = 11;

// -------------------------------------------------------------- pooling ----
export const POP_MAX = 16;
export const LOG_KEEP = 32;
export const QUEUE_LEN = 8;

// ---------------------------------------------------------------- safety ---
/** setSafeInset({ left: 24, top: 24, right: 24, bottom: 24 }) at boot — the engine's own SAFE_MARGIN is untouched. */
export const SAFE_INSET = { left: 24, top: 24, right: 24, bottom: 24 } as const;
/** A phone (CSS scale < 0.75) grows the bottom inset only — nothing else moves. */
export const SAFE_BOTTOM_PHONE = 40;

// ============================================================ turn ribbon ==
/**
 * y 24-104, not the 24-88 the contract used to declare. The actor on turn is
 * drawn 1.4x (r 33.6 against everyone else's 21) and carries a caret under it,
 * so the band genuinely reaches y 104 — the old number stopped being true the
 * moment the current chip grew, and a declared band that lies is worse than a
 * taller one. Nothing else lives above y 96 on this side of the frame: the hero
 * panels are at x 976 and the ribbon ends by x 450. (No RIBBON_TOP export: the
 * band's top is the literal 24 every draw call already uses — same number as
 * SAFE_INSET.top below, but no line in this screen has ever needed it back
 * as a named constant, so there was nothing for an export to serve.)
 */
export const RIBBON_BOTTOM = 104;
/** Scale on the chip of the actor whose turn it is, and the gap the chevron divider sits in. */
export const QUEUE_CURRENT_SCALE = 1.4;
export const QUEUE_ROLLOVER_GAP = 22;

export const QUEUE_CHIP = 48;
export const QUEUE_X = 24;
export const QUEUE_Y = 32;
export const QUEUE_GAP = 4;
/** Size of the intent badge drawn on an enemy's queue chip. */
export const INTENT_BADGE = 24;

export const NAME_X = 452;
export const NAME_Y = 40;

export const ENRAGE_CHIP = { x: 848, y: 40, w: 112, h: 32 } as const;

/** ACT/LAP and SCORE lines right-align to this x. */
export const RIBBON_RIGHT = 1160;
export const RIBBON_ACT_Y = 32;
export const RIBBON_SCORE_Y = 57;

/** The ribbon's own pause glyph — drawn small; PAUSE_BTN (below) is the paused-overlay's three big buttons. */
export const PAUSE_ICON = { x: 1192, y: 24, w: 64, h: 64 } as const;
/** Explicit, larger-than-drawn hit rect for PAUSE_ICON — "the PAUSE pattern" the skill bar also uses. */
export const PAUSE_ICON_HIT = { x: 1176, y: 0, w: 96, h: 96 } as const;

// ============================================================ hero panels ===
// ONE panel column, and it belongs to the PARTY — octopath-4's own arrangement:
// the party stands on the right with its name/HP plates beside it, and the
// enemies carry no column at all (their name, HP and statuses ride a plate over
// the focused/targeted sprite; every enemy stays a target through its own sprite
// hit rect). PANEL_H is the HIT height and the ceiling on the drawn one: a plate
// whose status shelf is empty draws shorter than it registers.
export const PANEL_W = 280;
export const PANEL_H = 104;
export const PANEL_PAD = 7;
/** x 976-1256 — the party's own side of the frame, flush to the right safe inset. */
export const PANEL_X_HERO = 976;
export const PANEL_Y = [96, 212, 328] as const;
export const PANEL_ROW_GAP = 4;
export const PANEL_ROW_NAME_H = 22;
export const PANEL_ROW_HP_H = 22;
export const PANEL_ROW_ATB_H = 6;
export const PANEL_ROW_STATUS_H = 28;
/** Status row: up to six 28-px icons; the element glyph rides the NAME row, not the shelf. */
export const STATUS_ICON = 28;
export const STATUS_ICON_MAX = 6;
/** The element glyph beside a panel's name — a small drawn mark, never a saturated block. */
export const ELEMENT_GLYPH = 20;

// ================================================================== stage ==
/** The stage owns the frame now: x 24-1160, one panel column instead of two walls. */
export const STAGE_X0 = 24;
export const STAGE_X1 = 1160;
/** The diagonal's step. 90 (was 56) so the three ranks read as depth instead of a stack. */
export const DIAG_DX = 90;
export const DIAG_DY = 68;

/** The party faces LEFT on a back-to-front diagonal at right-centre — octopath-4's spread. */
export const HERO_FEET = [
  { x: 700, y: 380 },
  { x: 700 + DIAG_DX, y: 380 + DIAG_DY },
  { x: 700 + 2 * DIAG_DX, y: 380 + 2 * DIAG_DY },
] as const;
/** Enemies own the left third on the same three ground rows — not a mirror of the party any more. */
export const ENEMY_FEET = [
  { x: 230, y: 380 },
  { x: 330, y: 448 },
  { x: 430, y: 516 },
] as const;
/** Two enemies FAN instead of stacking on the diagonal's far end, so the left half carries mass. */
export const ENEMY_FEET_PAIR: readonly { x: number; y: number }[] = [
  { x: 206, y: 400 },
  { x: 452, y: 504 },
];
/** A lone boss stands centred on its own side. */
export const BOSS_FEET = { x: 322, y: 490 } as const;

/**
 * No gauge slabs on the ground. An actor carries a 3-px HP hairline tucked into
 * its contact shadow, never wider than the foot span, and only while its HP is
 * short or for HP_HAIRLINE_HOLD seconds after a change. ATB lives in the hero
 * panels and in the ribbon's order — nowhere on the floor.
 */
export const HP_HAIRLINE_H = 3;
export const HP_HAIRLINE_SPAN = 0.62;
export const HP_HAIRLINE_HOLD = 1.5;

/** The enemy's name/HP/status plate, floated over the focused or targeted sprite. */
export const ENEMY_PLATE_MIN_W = 132;
export const ENEMY_PLATE_PAD = 10;
/**
 * Gap between the plate's foot and the top of the sprite's REAL silhouette. 18,
 * not 96: octopath-4 pins its plate to the body, and a fixed 96 measured off a
 * fixed 0.88 x ACTOR_W left a 170-px leader over a short recipe like the Ash
 * Hound — with the stem running straight through the damage number. The plate
 * now hugs the head and the POP goes above the plate instead (see
 * POP_PLATE_CLEAR), so nothing has to be joined by a line at all.
 */
export const ENEMY_PLATE_LIFT = 18;
/** Rows the plate stacks: name, HP + its rule, and the status shelf when there is one. */
export const ENEMY_PLATE_NAME_H = 20;
export const ENEMY_PLATE_HP_H = 22;
export const ENEMY_PLATE_STATUS_H = 24;
/** Air between the plate's top and a pop that has been pushed above it. */
export const POP_PLATE_CLEAR = 8;

/**
 * The x span a side's sprite hit cells tile across. A hurtbox is 68 px wide on a
 * 90-px pitch, so growing each to TAP_MIN made adjacent cells overlap by 6 px
 * and the fallback pass gave those strips to the LATER-registered hero. The
 * cells below are split at the midpoint between neighbours instead — every
 * point in the band belongs to the actor it is nearest, resolved in the
 * first pass, with no ambiguous strip left over.
 */
export function spriteCellX(feet: readonly { x: number }[], i: number, halfW: number): { x: number; w: number } {
  const c = feet[i].x;
  const left = i > 0 ? (feet[i - 1].x + c) / 2 : c - halfW;
  const right = i < feet.length - 1 ? (c + feet[i + 1].x) / 2 : c + halfW;
  return { x: left, w: right - left };
}

/** Icons above an actor's head on the stage (as opposed to the panel's status row); past this, 3 + "+N". */
export const STATUS_ABOVE_MAX = 4;
/** Hit pops spawn this far above the feet. */
export const POP_HEAD_OFFSET = 64;
/** How far a pop may rise from where it spawned — bounded so it never climbs into a neighbour or a panel. */
export const POP_RISE_MAX = 26;

// ======================================================================= log
/**
 * No full-width plate and no rule: one shadowed line over a SHORT local wash
 * that fades out at both ends, sitting beside the command list in the bottom
 * band. LOG_MAX_W is where the line is truncated, not a drawn box.
 */
export const LOG_TEXT = { x: 376, y: 552 } as const;
export const LOG_MAX_W = 784;
/** Height of the wash behind the line, and how far it bleeds past the text. */
export const LOG_WASH_H = 34;
export const LOG_WASH_BLEED = 28;

// ============================================================ command list ==
/**
 * Three compact rows stacked bottom-left, not three 400x96 slabs across the
 * whole width: name left, cooldown pips right. The drawn row is smaller than the
 * registered hit rect — the PAUSE pattern — so a phone still gets TAP_MIN.
 */
export const SKILL_X = 24;
export const SKILL_W = 320;
export const SKILL_H = 40;
export const SKILL_H_PHONE = 56;
export const SKILL_ROW_GAP = 8;
/** The list's bottom edge: air under it on desktop, the phone inset on a phone. */
export const SKILL_BOTTOM = 672;
export const SKILL_BOTTOM_PHONE = 680;
/** The drawn rect of command row i (0..2), stacked upward from the list's bottom edge. */
export function skillRowRect(i: number, phone: boolean): { x: number; y: number; w: number; h: number } {
  const h = phone ? SKILL_H_PHONE : SKILL_H;
  const bottom = phone ? SKILL_BOTTOM_PHONE : SKILL_BOTTOM;
  return { x: SKILL_X, y: bottom - h - (2 - i) * (h + SKILL_ROW_GAP), w: SKILL_W, h };
}
/**
 * What a row REGISTERS: its drawn rect grown by half the gap on each side, so
 * the three rows TILE. Registering the drawn rects alone left an 8-px gutter
 * between them that no first-pass rect covered; the fallback pass then resolved
 * it by registration order, which handed every gutter tap to the row BELOW —
 * and swallowed it whenever that row was on cooldown. Split down the middle,
 * each half of a gutter belongs to the row it is nearer.
 */
export function skillHitRect(i: number, phone: boolean): { x: number; y: number; w: number; h: number } {
  const r = skillRowRect(i, phone);
  const half = SKILL_ROW_GAP / 2;
  return { x: r.x, y: r.y - half, w: r.w, h: r.h + SKILL_ROW_GAP };
}
/**
 * The strip from the last row's foot to the canvas bottom edge, registered as a
 * TWIN of the last row so the list still "reaches the bottom edge" on a phone.
 *
 * The rows themselves register their DRAWN rects and let the registry grow each
 * to TAP_MIN on its own. Registering pre-grown 96-px rects instead is a trap:
 * at a 48-px pitch they overlap by half, the registry's first pass resolves a
 * tap against the LAST registered rect that contains it, and every tap on row 1
 * landed on row 2 — which, on cooldown, is a disabled region and swallows the
 * tap. Drawn-first is what makes a row's own pixels beat its neighbour's
 * expanded rect, so the drawn rect is what must be registered.
 */
export function skillTailRect(phone: boolean): { x: number; y: number; w: number; h: number } {
  const r = skillRowRect(2, phone);
  const y = r.y + r.h;
  return { x: r.x, y, w: r.w, h: CANVAS_H - y };
}

// ================================================================== cards ==
export const CARD_Y = 88;
export const CARD_H = 440;
export const CARD_W = 384;
export const CARD_X = [40, 448, 856] as const;
/** Four-up layout, under a HASTE-style extra-cards modifier. */
export const CARD_W_FOUR = 284;
export const CARD_X_FOUR = [48, 348, 648, 948] as const;
export const CARD_PAD = 16;
export const BLURB_LINES_MAX = 3;

/** The room-to-room continue prompt, and every end screen's RETRY/CONTINUE. */
export const CONTINUE = { x: 448, y: 552, w: 384, h: 96 } as const;
export const WEAR_BTN = { w: 280, h: 96 } as const;
/** Three candidates, the fourth slot is decline. */
export const WEAR_X = [40, 344, 648, 952] as const;
export const WEAR_Y = 552;

// ================================================================== doors ==
export const DOOR_W = 520;
export const DOOR_H = 200;
export const DOOR_X = [96, 664] as const;
export const DOOR_Y = 320;

// ================================================================ inspect ==
export const INSPECT = { x: 24, y: 24, w: 1232, h: 648 } as const;
export const INSPECT_NAME = { x: 48, y: 40 } as const;
export const INSPECT_ROW_ICON = 32;
/** Six relic rows, i = 0..5. */
export function inspectRowY(i: number): number {
  return 96 + 72 * i;
}
export const SET_BAND = { x: 48, y: 536, w: 968, h: 112 } as const;
export const SET_LINE_Y = [540, 576, 612] as const;
export const BACK = { x: 1040, y: 552, w: 192, h: 96 } as const;

// ================================================================== pause ==
export const PAUSE_BTN = { w: 400, h: 96 } as const;
export const PAUSE_BTN_X = 440;
/** resume, ARCADE toggle, quit. */
export const PAUSE_BTN_Y = [216, 336, 456] as const;
export const PAUSED_TEXT_Y = 120;

// ==================================================================== map ==
export const MAP_NODE = 96;
export function mapX(stage: number): number {
  return 88 + 208 * stage;
}
export function mapY(row: number): number {
  return 168 + 144 * row;
}
export const MAP_BAND_TOP = 24;
export const MAP_BAND_BOTTOM = 120;

// ================================================================== party ==
export const PARTY_ROW = 64;
export const PARTY_ROW_Y0 = 128;
/** Disabled outside the draft, a SUMMON, a REST and the ALTAR. */
export const PARTY_SWAP = { x: 40, y: 552, w: 280, h: 96 } as const;
export const PARTY_LEADER = { x: 344, y: 552, w: 280, h: 96 } as const;
export const PARTY_BACK = { x: 952, y: 552, w: 280, h: 96 } as const;

// ================================================================== draft ==
export const DRAFT_CARD = { w: 284, h: 136 } as const;
export const DRAFT_X = [48, 348, 648, 948] as const;
export const DRAFT_Y = [88, 240, 392] as const;

// =================================================================== skip ==
/** SKIP / WALK PAST / DECLINE all reuse CONTINUE's rect, registered under every card row. */
export const SKIP = CONTINUE;

// ================================================================ HUD font ==
// DESIGN.md -> "UI constraints", "Two kinds of text": bitmap FONT_HD belongs to
// the world (damage pops, the logo, card titles, door labels); everything the
// player reads as UI renders in a vector system stack, light weight,
// letter-spaced, with a 1-px dark drop shadow. These are the numbers that
// paragraph names — a screen builds its `ctx.font` from them and never hard-codes
// a size.

/** The vector stack. No webfont: it must be there on the first frame. */
export const HUD_FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
/** Body UI: panel names, the log line, skill labels. Nothing renders below HUD_SMALL. */
export const HUD_PX = 18;
/** Numbers, hints, secondary lines (ACT/LAP, SCORE, cooldown keys). */
export const HUD_SMALL = 15;
/** The one large UI line per screen — in battle, the current actor's name. */
export const HUD_LARGE = 24;
/** Tracking in px, applied through `ctx.letterSpacing` (manual fallback where unsupported). */
export const HUD_LETTER_SPACING = 1;

/** The ribbon's baked actor portrait: the recipe's head in a `PORTRAIT`-square cache. */
export const PORTRAIT = 40;

// ================================================================ helpers ==
/** A phone: the canvas's CSS width is under 0.75x its logical width. */
export function isPhone(pc: PixelCanvas): boolean {
  const rect = pc.canvas.getBoundingClientRect();
  if (rect.width <= 0) return false;
  return rect.width / pc.width < 0.75;
}

/** The live safe inset: SAFE_INSET, with the bottom grown on a phone. */
export function safeInsetFor(pc: PixelCanvas): { left: number; top: number; right: number; bottom: number } {
  return { ...SAFE_INSET, bottom: isPhone(pc) ? SAFE_BOTTOM_PHONE : SAFE_INSET.bottom };
}

/**
 * Greedy word-wrap measured by textWidth (never character count, which lies
 * for a proportional font), capped at `maxLines`. The final kept line
 * absorbs every remaining word without further wrapping — the contract caps
 * LINES, not characters, so a caller that must never overflow a line
 * truncates the source string before calling fitText.
 */
export function fitText(text: string, maxWidth: number, scale: number, font: BitmapFont, maxLines = BLURB_LINES_MAX): string[] {
  const words = text.split(' ').filter((w) => w.length > 0);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = line ? `${line} ${word}` : word;
    if (line === '' || textWidth(candidate, scale, 1, font) <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    if (lines.length >= maxLines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}
