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
/** A phone's skill buttons draw taller; hit rects still reach the bottom edge. */
export const SKILL_H_PHONE = 80;

// ============================================================ turn ribbon ==
// y 24-88.
export const RIBBON_TOP = 24;
export const RIBBON_BOTTOM = 88;

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

/** Top-left of the i'th ribbon queue chip (i = 0..QUEUE_LEN-1). */
export function queueChipPos(i: number): { x: number; y: number } {
  return { x: QUEUE_X + i * (QUEUE_CHIP + QUEUE_GAP), y: QUEUE_Y };
}
/** The intent badge's top-left on an enemy's chip: (chip.x + 24, chip.y + 24). */
export function intentBadgePos(chip: { x: number; y: number }): { x: number; y: number } {
  return { x: chip.x + 24, y: chip.y + 24 };
}

// ==================================================== hero / enemy panels ==
export const PANEL_W = 280;
export const PANEL_H = 104;
export const PANEL_PAD = 7;
/** x 24-304. */
export const PANEL_X_HERO = 24;
/** x 976-1256 — the mirror of the hero column; tap = the canonical enemy target. */
export const PANEL_X_ENEMY = 976;
export const PANEL_Y = [96, 212, 328] as const;
export const PANEL_ROW_GAP = 4;
export const PANEL_ROW_NAME_H = 22;
export const PANEL_ROW_HP_H = 22;
export const PANEL_ROW_ATB_H = 6;
export const PANEL_ROW_STATUS_H = 28;
/** Status row: up to six 28-px icons plus one element chip; past six, five icons and a "+N" chip. */
export const STATUS_ICON = 28;
export const STATUS_ICON_MAX = 6;
export const ELEMENT_CHIP = { w: 32, h: 28 } as const;

/** The drawn rect of one side's panel in its slot (0..2). */
export function panelRect(side: 'HERO' | 'ENEMY', slot: number): { x: number; y: number; w: number; h: number } {
  return { x: side === 'HERO' ? PANEL_X_HERO : PANEL_X_ENEMY, y: PANEL_Y[slot], w: PANEL_W, h: PANEL_H };
}

// ================================================================== stage ==
/** x 312-968 (the panels are the bounds). */
export const STAGE_X0 = 312;
export const STAGE_X1 = 968;
export const DIAG_DX = 56;
export const DIAG_DY = 68;

/** Heroes face right on a back-to-front diagonal at left-centre: feet at (408,380)/(464,448)/(520,516). */
export const HERO_FEET = [
  { x: 408, y: 380 },
  { x: 408 + DIAG_DX, y: 380 + DIAG_DY },
  { x: 408 + 2 * DIAG_DX, y: 380 + 2 * DIAG_DY },
] as const;
/** Enemies mirrored about x 640: enemyX = 640 + (640 - heroX) = 1280 - heroX. */
export const ENEMY_FEET = HERO_FEET.map((p) => ({ x: CANVAS_W - p.x, y: p.y })) as readonly { x: number; y: number }[];
/** A solo boss's feet — not one of the three mirrored slots above. */
export const BOSS_FEET = { x: 816, y: 516 } as const;

export const HP_GAUGE = { w: 96, h: 12 } as const;
export const ATB_GAUGE = { w: 96, h: 6 } as const;
/** Icons above an actor's head on the stage (as opposed to the panel's status row); past this, 3 + "+N". */
export const STATUS_ABOVE_MAX = 4;
/** Hit pops spawn this far above the feet. */
export const POP_HEAD_OFFSET = 64;

// ======================================================================= log
export const LOG_RECT = { x: 24, y: 558, w: 1232, h: 32 } as const;
export const LOG_TEXT = { x: 32, y: 563 } as const;

// ============================================================== skill bar ==
export const SKILL_W = 400;
export const SKILL_H = 96;
export const SKILL_X = [28, 440, 852] as const;
export const SKILL_Y = 600;
/** The registered hit rect is taller than the drawn button — "the PAUSE pattern". */
export const SKILL_HIT_H = 120;

export function skillHitRect(i: number): { x: number; y: number; w: number; h: number } {
  return { x: SKILL_X[i], y: SKILL_Y, w: SKILL_W, h: SKILL_HIT_H };
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
