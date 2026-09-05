// Ember Quest v3 — screens/draft.ts: one grid, three payloads. The DRAFT
// (your starting leader, one of six), the SUMMON (one of three not in the
// party, or the EPIC and a swap when the party is full) and the FORGE's
// REBRAND set list all lay their options out on the contract's twelve draft
// slots — DRAFT_CARD 284 × 136 at DRAFT_X 48 / 348 / 648 / 948 and DRAFT_Y
// 88 / 240 / 392 (DESIGN.md → UI constraints, the `draft` region row), and
// the pick is confirmed by CONTINUE.
//
// A card is a KIT, not a portrait: name, element, role, the three skill
// names, the leader skill and the awakening all sit inside the 136-px card,
// and the bottom row of the grid is a DETAIL STRIP that opens the focused
// option out — cooldowns, targets, base stats, and (for a SUMMON) whether
// this recruit is favoured against the coming act's dominant element.
//
// The draft cannot be declined (DESIGN.md → Building a party): there is no
// DECLINE seat and B is inert. A SUMMON can, on the WEAR grid's fourth seat
// and on B, and declining a SUMMON mends nothing.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { PICO8 } from '../../engine';
import {
  CANVAS_W, CONTINUE, DRAFT_CARD, DRAFT_X, DRAFT_Y, HUD_LARGE, HUD_PX, HUD_SMALL, NAME_MAX_CHARACTER,
  NAME_MAX_SKILL, PARTY_BACK, PORTRAIT, WEAR_BTN, WEAR_X, WEAR_Y, safeInsetFor,
} from './layout';
import {
  ACCENT, ACCENT_COOL, ACCENT_HP, C_GOLD, C_MUTED, C_VIOLET, ELEMENT_COLOR, ELEMENT_ICON_NAME,
  drawFocusablePlate, drawIcon, drawPrimaryButton, drawSecondaryButton, formatSetBonus, gradientPlate,
  hudText, hudTextCentered, plate, portraitFor, roundRectPath,
} from './hud';
import type { CharacterDef, Element, LeaderSkill, Relic, SetId, Stat, SummonOffer } from '../types';
import { CHARACTERS } from '../data/characters';
import { SKILLS } from '../data/skills';
import { SETS } from '../data/sets';
import { ACTOR_RECIPES } from '../art/actors';
import { derive, mainLine, relicTitle } from '../sim/relics';
import {
  ColumnOptions, RARITY_COLOR, ScreenView, addPartyColumns, addPauseIcon, deriveCtxFor, drawBanner,
  drawPartyColumns, drawPauseIcon, parseColumnId,
} from './party';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];

// ------------------------------------------------------------- geometry ---
/** Pad inside a draft card. */
// promote to layout.ts
export const DRAFT_PAD = 12;
/**
 * The focused option, opened out — one wide strip on the first grid row the
 * cards did NOT use, so a one-row face (a SUMMON) keeps its detail against the
 * cards instead of across an empty band.
 */
// promote to layout.ts
export const DRAFT_DETAIL_X = DRAFT_X[0];
// promote to layout.ts
export const DRAFT_DETAIL_W = DRAFT_X[3] + DRAFT_CARD.w - DRAFT_X[0];
export function draftDetailRect(count: number): { x: number; y: number; w: number; h: number } {
  const rows = Math.max(1, Math.min(2, Math.ceil(count / 4)));
  const y = DRAFT_Y[rows];
  // One row of cards leaves TWO grid rows under it; the strip takes both rather
  // than leaving a dead band between itself and CONTINUE.
  const h = rows === 1 ? DRAFT_Y[2] + DRAFT_CARD.h - DRAFT_Y[1] : DRAFT_CARD.h;
  return { x: DRAFT_DETAIL_X, y, w: DRAFT_DETAIL_W, h };
}
/** The height the detail's three columns actually occupy — the block is centred in a tall strip. */
// promote to layout.ts
export const DETAIL_BLOCK_H = 116;
/** The three columns inside that strip: who · what they do · what they bring. */
// promote to layout.ts
export const DETAIL_COL = [DRAFT_DETAIL_X + 20, DRAFT_DETAIL_X + 380, DRAFT_DETAIL_X + 800] as const;

/**
 * DESIGN.md's roster table has a Role column; game/data/characters.ts does not
 * carry it yet, so the six words live here.
 * // promote to game/data/characters.ts (CharacterDef.role).
 */
export const ROLE: Record<string, string> = {
  EMBER: 'AoE burner', GALE: 'speed stripper', TIDE: 'healer',
  BASALT: 'DEF wall', SABLE: 'ACC debuffer', LUMEN: 'crit sniper',
};

/** Percent for the four flats, points for the four rates (LeaderSkill's own unit rule). */
const PCT_STATS: readonly Stat[] = ['HP', 'ATK', 'DEF', 'SPD'];
export function leaderLine(l: LeaderSkill): string {
  const pct = PCT_STATS.indexOf(l.stat) >= 0 ? '%' : '';
  const base = `${l.stat} +${l.amount}${pct}`;
  return l.element !== undefined ? `${base} . ${l.element} +${l.elementAmount ?? l.amount}${pct}` : base;
}
export function awakeningLine(def: CharacterDef): string {
  const a = def.awakening;
  return 'upgrades' in a ? `${a.name} . upgrades skill ${a.upgrades.slot + 1}` : a.name;
}
function skillNames(def: CharacterDef): string {
  return def.skills.map((id) => (SKILLS[id]?.name ?? id).slice(0, NAME_MAX_SKILL)).join(' . ');
}

// ================================================================= props ===
export interface DraftOption {
  def: CharacterDef;
  /** SUMMON only: this recruit's element beats the coming act's dominant. */
  favored?: boolean;
  dominant?: Element;
}

/**
 * NOTE for the caller: a NEW decision must arrive as a NEW props object (this
 * is what spreading a pending into `{...pending, view}` does anyway). The
 * screen skips rebuilding its identity key when it is handed the SAME object
 * twice in a tick — update() then render() — so a props object mutated in
 * place would not be seen as a new decision.
 */
export type DraftProps =
  | { kind: 'DRAFT'; view: ScreenView; roster: readonly string[] }
  | { kind: 'SUMMON'; view: ScreenView; offers: readonly SummonOffer[]; full: boolean; epic?: Relic | null }
  | { kind: 'REBRAND'; view: ScreenView; relic: Relic; sets: readonly SetId[]; declineLabel?: string };

export type DraftAnswer =
  | { kind: 'DRAFT'; index: number }
  | { kind: 'SUMMON'; answer: number | { swap: number; out: number } | null }
  | { kind: 'REBRAND'; set: SetId | null };

export interface DraftDevView {
  kind: 'DRAFT' | 'SUMMON' | 'REBRAND';
  options: string[];
  full: boolean;
  chosen: number | null;
  step: 'PICK' | 'SWAP_OUT';
}

export interface DraftScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  scene(): void;
  onPause(): void;
  onAnswer(answer: DraftAnswer): void;
}

export interface DraftScreen {
  update(dt: number, props: DraftProps): void;
  render(time: number, props: DraftProps): void;
  view(props: DraftProps): DraftDevView;
}

/** The options a face offers, as one shape. */
function optionsOf(props: DraftProps): DraftOption[] {
  if (props.kind === 'DRAFT') return props.roster.map((id) => ({ def: CHARACTERS[id] })).filter((o) => !!o.def);
  if (props.kind === 'SUMMON') return props.offers.map((o) => ({ def: o.def, favored: o.favored, dominant: o.dominant }));
  return [];
}

/** The grid's own pitch: DRAFT_X is four columns 300 apart carrying a 284-wide card. */
// promote to layout.ts
export const DRAFT_PITCH = DRAFT_X[1] - DRAFT_X[0];
/**
 * Slot k's rect, row-major, with EVERY short row centred on the frame at the
 * contract's own pitch — snapping a short row to DRAFT_X centred a row of two
 * (columns 1 and 2) but left-packed a row of three, so six options and three
 * options obeyed different rules. Centring is the one rule; it REPRODUCES the
 * contract's columns wherever a row is full (4 -> 48/348/648/948) or holds two
 * (348/648), and only a row of three or one moves off them.
 */
export function draftSlotRect(k: number, count: number): { x: number; y: number; w: number; h: number } {
  const row = Math.min(2, Math.floor(k / 4));
  const inRow = Math.max(1, Math.min(4, count - row * 4));
  const span = inRow * DRAFT_CARD.w + (inRow - 1) * (DRAFT_PITCH - DRAFT_CARD.w);
  const start = Math.round((CANVAS_W - span) / 2);
  return { x: start + (k % 4) * DRAFT_PITCH, y: DRAFT_Y[row], w: DRAFT_CARD.w, h: DRAFT_CARD.h };
}
/** The EPIC's own seat when the party is full: the fourth column of the top row. */
export const EPIC_SLOT = { x: DRAFT_X[3], y: DRAFT_Y[0], w: DRAFT_CARD.w, h: DRAFT_CARD.h } as const;

export function createDraftScreen(deps: DraftScreenDeps): DraftScreen {
  const { pc, input, regions, audio, scene, onPause, onAnswer } = deps;
  /** The picked option, confirmed by CONTINUE. −1 is "the EPIC" on a full SUMMON. */
  let chosen: number | null = null;
  let step: 'PICK' | 'SWAP_OUT' = 'PICK';
  let lastKey = '';
  let lastProps: DraftProps | null = null;

  /** A new payload resets the pick — the screen is reused for every draft, summon and rebrand. */
  function sync(props: DraftProps): void {
    // update() and render() see the same object in a tick: build the key once.
    if (props === lastProps) return;
    lastProps = props;
    const key = props.kind === 'DRAFT' ? `D:${props.roster.join(',')}`
      : props.kind === 'SUMMON' ? `S:${props.offers.map((o) => o.def.id).join(',')}:${props.full}`
        : `R:${props.relic.id}:${props.sets.join(',')}`;
    if (key === lastKey) return;
    lastKey = key;
    chosen = props.kind === 'DRAFT' ? 0 : null;
    step = 'PICK';
  }

  function swapColumns(props: DraftProps): ColumnOptions {
    return { pick: 'MEMBER', prefix: 'swap', group: 'swap', dctx: deriveCtxFor(props.view) };
  }

  function update(_dt: number, props: DraftProps): void {
    sync(props);
    const options = optionsOf(props);
    const setCount = props.kind === 'REBRAND' ? props.sets.length : 0;
    const count = props.kind === 'REBRAND' ? setCount : options.length;
    const full = props.kind === 'SUMMON' && props.full;
    regions.begin();
    addPauseIcon(regions);

    if (step === 'SWAP_OUT' && props.kind === 'SUMMON') {
      addPartyColumns(regions, props.view.party, swapColumns(props));
      regions.add('swap-back', PARTY_BACK.x, PARTY_BACK.y, PARTY_BACK.w, PARTY_BACK.h, { index: 9, group: 'swap' });
      regions.end();
      const act = regions.activated();
      if (input.pressed('B') || act === 'swap-back') { audio.play('cancel'); step = 'PICK'; }
      else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      else if (act) {
        const parsed = parseColumnId(swapColumns(props), act);
        if (parsed && chosen !== null && chosen >= 0) {
          audio.play('confirm');
          onAnswer({ kind: 'SUMMON', answer: { swap: chosen, out: parsed.member } });
        }
      }
      input.endFrame();
      return;
    }

    // With the EPIC in the fourth seat the offers are a row of FOUR, so they
    // sit on the contract's own columns instead of being centred under it.
    const layout = full ? 4 : count;
    for (let k = 0; k < count; k++) {
      const r = draftSlotRect(k, layout);
      regions.add(`draft-${k}`, r.x, r.y, r.w, r.h, { index: k, group: 'draft' });
    }
    if (full) regions.add('draft-epic', EPIC_SLOT.x, EPIC_SLOT.y, EPIC_SLOT.w, EPIC_SLOT.h, { index: count, group: 'draft' });
    regions.add('draft-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, {
      index: 10, group: 'draft', disabled: chosen === null,
    });
    const canDecline = props.kind !== 'DRAFT';
    if (canDecline) regions.add('draft-decline', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 11, group: 'draft' });
    regions.end();

    const act = regions.activated();
    if (canDecline && input.pressed('B')) { audio.play('cancel'); decline(props); }
    else if (act === 'draft-decline') { audio.play('cancel'); decline(props); }
    else if (act === 'draft-epic') { audio.play('card'); chosen = -1; }
    else if (act === 'draft-continue') confirm(props);
    else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
    else if (act && act.startsWith('draft-')) {
      const k = Number(act.slice(6));
      if (Number.isInteger(k)) {
        audio.play('card');
        chosen = k;
        // A full SUMMON's recruit needs a seat before it can be answered.
        if (full) step = 'SWAP_OUT';
      }
    }
    input.endFrame();
  }

  function decline(props: DraftProps): void {
    if (props.kind === 'SUMMON') onAnswer({ kind: 'SUMMON', answer: null });
    else if (props.kind === 'REBRAND') onAnswer({ kind: 'REBRAND', set: null });
  }

  function confirm(props: DraftProps): void {
    if (chosen === null) return;
    audio.play('confirm');
    if (props.kind === 'DRAFT') { onAnswer({ kind: 'DRAFT', index: Math.max(0, chosen) }); return; }
    if (props.kind === 'REBRAND') { onAnswer({ kind: 'REBRAND', set: props.sets[chosen] ?? null }); return; }
    if (chosen < 0) { onAnswer({ kind: 'SUMMON', answer: 0 }); return; } // "the EPIC", DESIGN.md's own 0
    onAnswer({ kind: 'SUMMON', answer: chosen });
  }

  // ------------------------------------------------------------ drawing ---
  function drawPortrait(def: CharacterDef, x: number, y: number, accent: string): void {
    const ctx = pc.ctx;
    plate(ctx, x, y, PORTRAIT, PORTRAIT, { alpha: 0.5, border: accent, radius: 3 });
    const recipe = ACTOR_RECIPES[def.id];
    const art = recipe ? portraitFor(recipe, def.element) : null;
    if (!art) return;
    ctx.save();
    roundRectPath(ctx, Math.round(x) + 1.5, Math.round(y) + 1.5, PORTRAIT - 3, PORTRAIT - 3, 3);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(art, Math.round(x), Math.round(y), PORTRAIT, PORTRAIT);
    ctx.restore();
  }

  function drawOptionCard(option: DraftOption, r: { x: number; y: number; w: number; h: number }, id: string, picked: boolean): void {
    const ctx = pc.ctx;
    const def = option.def;
    const focused = regions.focused() === id;
    const color = ELEMENT_COLOR[def.element];
    drawFocusablePlate(ctx, r.x, r.y, r.w, r.h, focused, picked ? ACCENT : undefined, picked ? 0.68 : 0.55);

    drawPortrait(def, r.x + DRAFT_PAD, r.y + 10, focused || picked ? C_TEXT : C_DIM);
    const tx = r.x + DRAFT_PAD + PORTRAIT + 12;
    hudText(ctx, def.name.slice(0, NAME_MAX_CHARACTER), tx, r.y + 10, { color: C_TEXT });
    drawIcon(ctx, ELEMENT_ICON_NAME[def.element], r.x + r.w - DRAFT_PAD - 18, r.y + 10, 18, color);
    hudText(ctx, ROLE[def.id] ?? def.element, tx, r.y + 32, { px: HUD_SMALL, color: C_MUTED });
    // FAVORED rides the NAME row, beside the element mark: on the role row it
    // sat directly over the card's rule and read as an underline.
    if (option.favored) {
      hudText(ctx, 'FAVORED', r.x + r.w - DRAFT_PAD - 26, r.y + 12, { px: HUD_SMALL, color: ACCENT_HP, align: 'right' });
    }

    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = picked ? ACCENT : C_MUTED;
    ctx.fillRect(r.x + DRAFT_PAD, r.y + 56, r.w - 2 * DRAFT_PAD, 1);
    ctx.restore();

    hudText(ctx, skillNames(def), r.x + DRAFT_PAD, r.y + 62, { px: HUD_SMALL, color: C_TEXT });
    hudText(ctx, `LEAD ${leaderLine(def.leader)}`, r.x + DRAFT_PAD, r.y + 82, { px: HUD_SMALL, color: ACCENT });
    hudText(ctx, `AWAKEN ${def.awakening.name}`, r.x + DRAFT_PAD, r.y + 102, { px: HUD_SMALL, color: C_GOLD });
  }

  function drawSetCard(props: Extract<DraftProps, { kind: 'REBRAND' }>, k: number, r: { x: number; y: number; w: number; h: number }): void {
    const ctx = pc.ctx;
    const id = props.sets[k];
    const def = SETS[id];
    const focused = regions.focused() === `draft-${k}`;
    const picked = chosen === k;
    drawFocusablePlate(ctx, r.x, r.y, r.w, r.h, focused, picked ? ACCENT : undefined, picked ? 0.68 : 0.55);
    hudText(ctx, def.name, r.x + DRAFT_PAD, r.y + 12, { px: HUD_LARGE, color: picked ? ACCENT : C_TEXT });
    hudText(ctx, `${def.pieces}-PIECE SET`, r.x + DRAFT_PAD, r.y + 46, { px: HUD_SMALL, color: C_MUTED });
    hudText(ctx, formatSetBonus(def.bonus), r.x + DRAFT_PAD, r.y + 70, { px: HUD_SMALL, color: C_TEXT });
    if (id === props.relic.set) hudText(ctx, 'WORN NOW', r.x + DRAFT_PAD, r.y + 96, { px: HUD_SMALL, color: ACCENT_COOL });
  }

  /** The EPIC seat on a full SUMMON: the relic itself, and what taking it means. */
  function drawEpicCard(props: Extract<DraftProps, { kind: 'SUMMON' }>): void {
    const ctx = pc.ctx;
    const r = EPIC_SLOT;
    const focused = regions.focused() === 'draft-epic';
    const picked = chosen === -1;
    const relic = props.epic ?? null;
    const color = relic ? RARITY_COLOR[relic.rarity] : C_VIOLET;
    drawFocusablePlate(ctx, r.x, r.y, r.w, r.h, focused, picked ? ACCENT : color, picked ? 0.68 : 0.55);
    hudText(ctx, 'TAKE THE EPIC', r.x + DRAFT_PAD, r.y + 12, { color: C_TEXT });
    if (relic) {
      hudText(ctx, relicTitle(relic), r.x + DRAFT_PAD, r.y + 40, { px: HUD_LARGE, color });
      hudText(ctx, mainLine(relic), r.x + DRAFT_PAD, r.y + 72, { px: HUD_SMALL, color: C_TEXT });
    }
    hudText(ctx, 'the party is full', r.x + DRAFT_PAD, r.y + 102, { px: HUD_SMALL, color: C_MUTED });
  }

  /** The bottom strip: the focused option opened out — cooldowns, targets, base stats. */
  function drawDetail(props: DraftProps, options: DraftOption[], count: number): void {
    const ctx = pc.ctx;
    const focusId = regions.focused() ?? '';
    let k = chosen ?? 0;
    if (focusId.startsWith('draft-')) {
      const n = Number(focusId.slice(6));
      if (Number.isInteger(n)) k = n;
    }
    const strip = draftDetailRect(count);
    const top = Math.round(strip.y + (strip.h - DETAIL_BLOCK_H) / 2);
    gradientPlate(ctx, strip.x, strip.y, strip.w, strip.h, { topAlpha: 0.5 });

    if (props.kind === 'REBRAND') {
      const target = props.sets[k];
      hudText(ctx, relicTitle(props.relic), DETAIL_COL[0], top + 18, { px: HUD_LARGE, color: RARITY_COLOR[props.relic.rarity] });
      hudText(ctx, `${mainLine(props.relic)} . ${SETS[props.relic.set].pieces}-piece ${SETS[props.relic.set].name} now`, DETAIL_COL[0], top + 54, { px: HUD_SMALL, color: C_TEXT });
      hudText(ctx, 'every roll is kept — only the set changes', DETAIL_COL[0], top + 78, { px: HUD_SMALL, color: C_MUTED });
      if (target) {
        hudText(ctx, `BECOMES ${SETS[target].name}`, DETAIL_COL[1], top + 18, { px: HUD_LARGE, color: ACCENT });
        hudText(ctx, `${SETS[target].pieces}-piece . ${formatSetBonus(SETS[target].bonus)}`, DETAIL_COL[1], top + 54, { px: HUD_SMALL, color: C_TEXT });
      }
      return;
    }

    const option = options[k];
    if (!option) return;
    const def = option.def;
    hudText(ctx, def.name.slice(0, NAME_MAX_CHARACTER), DETAIL_COL[0], top + 14, { px: HUD_LARGE, color: C_TEXT });
    hudText(ctx, `${def.element} . ${ROLE[def.id] ?? ''}`, DETAIL_COL[0], top + 46, { px: HUD_SMALL, color: ELEMENT_COLOR[def.element] });
    // At the DRAFT there is no leader yet, so the base stats are read with no
    // leader skill on them — showing Ember's own +20 % ATK on Ember's card
    // would price a bonus the player has not been given.
    const dctx = props.kind === 'DRAFT'
      ? { leader: null, pacts: props.view.pactsTaken ?? [] }
      : deriveCtxFor(props.view);
    const stats = derive({ def, relics: {}, awakened: false }, dctx);
    hudText(ctx, `HP ${stats.HP}   ATK ${stats.ATK}   DEF ${stats.DEF}   SPD ${stats.SPD}`, DETAIL_COL[0], top + 72, { px: HUD_SMALL, color: C_MUTED });
    if (option.favored && option.dominant) {
      hudText(ctx, `favoured against ${option.dominant}`, DETAIL_COL[0], top + 96, { px: HUD_SMALL, color: ACCENT_HP });
    }

    def.skills.forEach((id, i) => {
      const s = SKILLS[id];
      if (!s) return;
      const y = top + 14 + i * 34;
      hudText(ctx, s.name.slice(0, NAME_MAX_SKILL), DETAIL_COL[1], y, { color: C_TEXT });
      const target = s.target.replace('ALL_', 'all ').replace('LOWEST_HP_ALLY', 'weakest ally').toLowerCase();
      hudText(ctx, `cd ${s.cooldown} . ${target}`, DETAIL_COL[1], y + 20, { px: HUD_SMALL, color: C_MUTED });
    });

    hudText(ctx, 'LEADER SKILL', DETAIL_COL[2], top + 14, { px: HUD_SMALL, color: C_MUTED });
    hudText(ctx, leaderLine(def.leader), DETAIL_COL[2], top + 34, { color: ACCENT });
    hudText(ctx, 'AWAKENING', DETAIL_COL[2], top + 66, { px: HUD_SMALL, color: C_MUTED });
    hudText(ctx, awakeningLine(def), DETAIL_COL[2], top + 86, { px: HUD_SMALL, color: C_GOLD });
  }

  function render(_time: number, props: DraftProps): void {
    sync(props);
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const options = optionsOf(props);
    scene();

    if (step === 'SWAP_OUT' && props.kind === 'SUMMON') {
      const o = swapColumns(props);
      const name = chosen !== null && chosen >= 0 ? props.offers[chosen]?.def.name ?? '' : '';
      drawBanner(ctx, `WHO STEPS ASIDE FOR ${name.toUpperCase()}?`, ACCENT_COOL);
      drawPartyColumns(pc, regions, props.view.party, o);
      drawSecondaryButton(ctx, PARTY_BACK.x, PARTY_BACK.y, PARTY_BACK.w, PARTY_BACK.h, 'BACK', regions.focused() === 'swap-back');
      hudTextCentered(ctx, 'they hand over their relics, their HP fraction, the seat and the awakening', 0,
        pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      drawPauseIcon(ctx, regions);
      return;
    }

    const banner = props.kind === 'DRAFT' ? 'CHOOSE YOUR FIRST HERO'
      : props.kind === 'SUMMON' ? (props.full ? 'A SUMMON . THE PARTY IS FULL' : 'A SUMMON . ONE JOINS YOU')
        : 'REBRAND . CHOOSE THE NEW SET';
    drawBanner(ctx, banner, props.kind === 'SUMMON' ? ACCENT_COOL : ACCENT);

    if (props.kind === 'REBRAND') {
      props.sets.forEach((_id, k) => drawSetCard(props, k, draftSlotRect(k, props.sets.length)));
    } else {
      const layout = props.kind === 'SUMMON' && props.full ? 4 : options.length;
      options.forEach((option, k) => drawOptionCard(option, draftSlotRect(k, layout), `draft-${k}`, chosen === k));
    }
    if (props.kind === 'SUMMON' && props.full) drawEpicCard(props);
    drawDetail(props, options, props.kind === 'REBRAND' ? props.sets.length : options.length);

    const label = props.kind === 'DRAFT' ? 'BEGIN THE RUN' : props.kind === 'REBRAND' ? 'REBRAND' : 'RECRUIT';
    if (chosen === null) {
      hudTextCentered(ctx, 'pick one', CONTINUE.x, CONTINUE.y + 34, CONTINUE.w, HUD_PX, { color: C_MUTED, alpha: 0.7 });
    } else {
      drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, label,
        regions.focused() === 'draft-continue', regions.pressing() === 'draft-continue');
    }
    if (props.kind !== 'DRAFT') {
      const declineLabel = props.kind === 'REBRAND' ? props.declineLabel ?? 'DECLINE' : 'DECLINE';
      drawSecondaryButton(ctx, WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, declineLabel, regions.focused() === 'draft-decline');
    } else {
      hudTextCentered(ctx, 'the draft cannot be declined', WEAR_X[3], WEAR_Y + 34, WEAR_BTN.w, HUD_SMALL, {
        px: HUD_SMALL, color: C_MUTED, alpha: 0.6,
      });
    }
    hudTextCentered(ctx, props.kind === 'SUMMON' ? 'declining a SUMMON mends nothing' : 'arrows move . A picks . CONTINUE confirms', 0,
      pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
    drawPauseIcon(ctx, regions);
  }

  return {
    update,
    render,
    view(props: DraftProps): DraftDevView {
      const options = optionsOf(props);
      return {
        kind: props.kind,
        options: props.kind === 'REBRAND' ? [...props.sets] : options.map((o) => o.def.id),
        full: props.kind === 'SUMMON' && props.full,
        chosen,
        step,
      };
    },
  };
}
