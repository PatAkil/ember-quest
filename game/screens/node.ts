// Ember Quest v3 — screens/node.ts: the four rooms that are a DECISION rather
// than a fight — SHRINE, FORGE, ALTAR, REST — in one file because they are one
// grammar: the party columns (screens/party.ts) are the board, the WEAR grid is
// the verb row, CONTINUE is the confirmation and B is the way out.
//
//   SHRINE  DESIGN.md:841 — one pact in the middle card slot: its curse, its
//           boon, its blurb wrapped to BLURB_LINES_MAX. Tap the card to accept,
//           SKIP or B to walk past. No mend either way; taken pacts ride a
//           chip column so the stack is legible.
//   FORGE   DESIGN.md:842 — pick the relic on the party columns, then the mode
//           on the WEAR grid (LEVEL +n, RECAST, REBRAND, WALK PAST), then the
//           substat (four rows on the middle card) or the set (the draft grid,
//           screens/draft.ts's REBRAND face). B steps back one level, then
//           walks past.
//   ALTAR   DESIGN.md:844 — the un-awakened only, and it cannot be declined:
//           B is inert and the seam's own default is candidates[0].
//   REST    DESIGN.md:839 — FULL HEAL is the CONTINUE seat and the default (B
//           too); a sharpen candidate's column shows which of its relics would
//           take the +1, in slot order, up to SHARPEN_RELICS.
//
// Legality is never re-implemented here: `options` (forgeOptions), `rebrand`
// (rebrandSets) and `candidates` (sharpenCandidates / the un-awakened) arrive
// with the pending and this file only draws them. An answer the seam dislikes
// falls to the seam's own default.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { FONT_HD, PICO8, drawText, textWidth } from '../../engine';
import {
  BLURB_LINES_MAX, CANVAS_W, CARD_H, CARD_PAD, CARD_W, CARD_X, CARD_Y, CONTINUE, HUD_PX,
  HUD_SMALL, NAME_MAX_PACT, SKIP, TEXT_LABEL, WEAR_BTN, WEAR_X, WEAR_Y, safeInsetFor,
} from './layout';
import {
  ACCENT, ACCENT_HP, C_DEBUFF, C_GOLD, C_MUTED, C_VIOLET, drawFocusablePlate,
  drawPrimaryButton, drawSecondaryButton, gradientPlate, hudFit, hudText, hudTextCentered, plate,
} from './hud';
import type { CharacterDef, Modifier, Pact, PactId, PartyMember, Relic, SetId, Slot } from '../types';
import { SHARPEN_RELICS, SLOTS } from '../types';
import { PACTS } from '../data/pacts';
import { SKILLS } from '../data/skills';
import type { ForgeMode, ForgeOption } from '../sim/relics';
import { derive, isCapped, mainLine, rebrandSets, relicTitle, substatLine } from '../sim/relics';
import {
  ColumnOptions, RARITY_COLOR, ScreenView, addPartyColumns, addPauseIcon, deriveCtxFor, drawBanner,
  drawPartyColumns, drawPauseIcon, parseColumnId, viewKey,
} from './party';
import { createDraftScreen } from './draft';
import type { DraftScreen } from './draft';

const hd = { font: FONT_HD };
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const TITLE_H = FONT_HD.glyphH * TEXT_LABEL;

// ------------------------------------------------------------- geometry ---
/** HUD row pitches, cards.ts's own two. */
// promote to layout.ts
export const ROW = 26;
// promote to layout.ts
export const ROW_SMALL = 21;
/** The taken-pact chips beside a SHRINE's card. */
// promote to layout.ts
export const PACT_CHIP = { x: 40, y: 128, w: 300, h: 44, gap: 8 } as const;
/** RECAST's four substat rows, inside the middle card slot. */
// promote to layout.ts
export const SUB_ROW = { x: CARD_X[1], y: 200, w: CARD_W, h: 64, pitch: 72 } as const;
/** One line under the columns, above the button row: the focused column's detail. */
// promote to layout.ts
export const FOOT_NOTE_Y = 516;

// ================================================================= text ====
/**
 * A pact's half as one line. formatSetBonus's twin — same job, other union.
 * // promote to hud.ts, beside formatSetBonus.
 */
export function modifierLine(m: Modifier): string {
  switch (m.kind) {
    case 'ENEMY_SPD_PCT': return `enemies +${m.pct}% SPD`;
    case 'ENEMY_ATK_PCT': return `enemies +${m.pct}% ATK`;
    case 'PARTY_ATK_PCT': return `party +${m.pct}% ATK`;
    case 'PARTY_RES': return `party ${m.pts >= 0 ? '+' : ''}${m.pts} RES`;
    case 'PARTY_ACC': return `party ${m.pts >= 0 ? '+' : ''}${m.pts} ACC`;
    case 'BOSS_INVINCIBLE_START': return `bosses open INVINCIBLE ${m.turns}t`;
    case 'EPIC_DROP_LEVEL': return `EPICs drop +${m.levels}`;
    case 'EXTRA_CARDS': return `+${m.count} card on every relic screen`;
    case 'FEWER_CARDS': return `${m.count} fewer card on every relic screen`;
    case 'FORGE_LEVELS': return `a FORGE gives +${m.levels}`;
    case 'LEADER_OFF': return 'no leader skill';
    case 'LEADER_SELF': return 'each keeps their own, at half';
    default: return '';
  }
}

/** What awakening this member actually does — the stat line, or the skill it upgrades. */
export function awakeningDetail(def: CharacterDef): string {
  const a = def.awakening;
  if ('upgrades' in a) {
    const from = SKILLS[def.skills[a.upgrades.slot]]?.name ?? `skill ${a.upgrades.slot + 1}`;
    const to = SKILLS[a.upgrades.to]?.name ?? a.upgrades.to;
    // An upgraded skill usually KEEPS its name (INFERNO -> INFERNO_BRAND is
    // still "Inferno"), and "Inferno becomes Inferno" reads as a bug.
    return from === to ? `${from} is upgraded` : `${from} becomes ${to}`;
  }
  return Object.entries(a.bonus).map(([stat, amount]) => `${stat} +${amount}`).join(' . ');
}

/** The relics a SHARPEN would touch: uncapped, slot order, at most SHARPEN_RELICS. */
export function sharpenPreview(relics: Partial<Record<Slot, Relic>>): Set<Slot> {
  const out = new Set<Slot>();
  for (const slot of SLOTS) {
    if (out.size >= SHARPEN_RELICS) break;
    const relic = relics[slot];
    if (relic && !isCapped(relic)) out.add(slot);
  }
  return out;
}

// ================================================================= props ===
/**
 * NOTE for the caller: a NEW decision must arrive as a NEW props object (this
 * is what spreading a pending into `{...pending, view}` does anyway). The
 * screen skips rebuilding its identity key when it is handed the SAME object
 * twice in a tick — update() then render() — so a props object mutated in
 * place would not be seen as a new decision.
 */
export type NodeProps =
  | { kind: 'SHRINE'; view: ScreenView; pact: Pact; untakenCount: number }
  | {
    kind: 'FORGE'; view: ScreenView; worn: readonly Relic[]; options: readonly ForgeOption[];
    pool: readonly SetId[]; levels: number; rebrand?: readonly (readonly SetId[])[];
  }
  | { kind: 'ALTAR'; view: ScreenView; candidates: readonly number[] }
  | { kind: 'REST'; view: ScreenView; candidates: readonly number[] };

export type NodeAnswer =
  | { kind: 'SHRINE'; take: boolean }
  | { kind: 'FORGE'; answer: { relic: number; mode: ForgeMode; substat?: number; set?: SetId } | null }
  | { kind: 'ALTAR'; index: number }
  | { kind: 'REST'; answer: 'HEAL' | { sharpen: number } };

export type NodeStep = 'MAIN' | 'MODE' | 'RECAST' | 'REBRAND';

export interface NodeDevView {
  kind: NodeProps['kind'];
  step: NodeStep;
  options: string[];
  chosen: number | null;
}

export interface NodeScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  scene(): void;
  onPause(): void;
  onAnswer(answer: NodeAnswer): void;
}

export interface NodeScreen {
  update(dt: number, props: NodeProps): void;
  render(time: number, props: NodeProps): void;
  view(props: NodeProps): NodeDevView;
}

export function createNodeScreen(deps: NodeScreenDeps): NodeScreen {
  const { pc, input, regions, audio, scene, onPause, onAnswer } = deps;
  let step: NodeStep = 'MAIN';
  /**
   * The screen's one pick: on a FORGE it is an index into `worn` (with
   * `pickedAt` remembering the column/row it was taken from), on the ALTAR it
   * is the member index awaiting CONTINUE. The REST and the SHRINE commit on
   * the spot and never set it.
   */
  let relicIdx: number | null = null;
  let pickedAt: { member: number; row: number } | null = null;
  let lastKey = '';
  let lastProps: NodeProps | null = null;

  /** REBRAND borrows the draft grid whole — one screen, three payloads (screens/draft.ts). */
  const rebrandScreen: DraftScreen = createDraftScreen({
    pc,
    input,
    regions,
    audio,
    scene,
    onPause,
    onAnswer(answer) {
      if (answer.kind !== 'REBRAND') return;
      if (answer.set === null) { step = 'MODE'; return; }
      if (relicIdx === null) return;
      onAnswer({ kind: 'FORGE', answer: { relic: relicIdx, mode: 'REBRAND', set: answer.set } });
    },
  });

  function sync(props: NodeProps): void {
    // update() and render() are handed the same props object in a tick, so the
    // key is built once per frame rather than twice.
    if (props === lastProps) return;
    lastProps = props;
    // Position first: two walked-past FORGEs with the same worn set are two
    // different rooms, and the second must not inherit the first one's step.
    const where = viewKey(props.view);
    const key = props.kind === 'SHRINE' ? `S@${where}:${props.pact.id}`
      : props.kind === 'FORGE' ? `F@${where}:${props.worn.map((r) => r.id).join(',')}`
        : `${props.kind}@${where}:${props.candidates.join(',')}`;
    if (key === lastKey) return;
    lastKey = key;
    step = 'MAIN';
    relicIdx = null;
    pickedAt = null;
  }

  /**
   * The pact card's REAL rect. The card is measured from the rows it holds and
   * centred in the contract's 440-px band, so registering the whole band made
   * ~105 px of empty frame above and below it accept the pact. The fitted rect
   * is what is registered; TAP_MIN grows it if a very short pact ever needs it.
   * Measured once per pact — hudFit costs a measureText per word.
   */
  let shrineFit: { id: string; lines: string[]; rect: { x: number; y: number; w: number; h: number } } | null = null;
  function shrineCard(props: Extract<NodeProps, { kind: 'SHRINE' }>): { lines: string[]; rect: { x: number; y: number; w: number; h: number } } {
    if (shrineFit && shrineFit.id === props.pact.id) return shrineFit;
    const lines = hudFit(pc.ctx, props.pact.blurb, CARD_W - 2 * CARD_PAD, HUD_SMALL, BLURB_LINES_MAX);
    const h = CARD_PAD * 2 + TITLE_H + 8 + 12 + (ROW_SMALL + ROW) * 2 + 16 + 14 + lines.length * ROW_SMALL;
    const rect = { x: CARD_X[1], y: Math.round(CARD_Y + (CARD_H - h) / 2), w: CARD_W, h };
    shrineFit = { id: props.pact.id, lines, rect };
    return shrineFit;
  }

  // ----------------------------------------------------------- columns ----
  function columns(props: NodeProps): ColumnOptions {
    const dctx = deriveCtxFor(props.view);
    if (props.kind === 'FORGE') {
      const legal = new Set(props.options.map((o) => o.relic));
      const index = new Map<string, number>();
      props.worn.forEach((r, i) => index.set(r.id, i));
      return {
        pick: 'ROW', prefix: 'forge', group: 'forge', dctx,
        rowEnabled: (_m, _slot, relic) => !!relic && legal.has(index.get(relic.id) ?? -1),
        isRowChosen: (m, row) => !!pickedAt && pickedAt.member === m && pickedAt.row === row,
      };
    }
    if (props.kind === 'ALTAR') {
      return {
        pick: 'MEMBER', prefix: 'altar', group: 'altar', dctx,
        memberEnabled: (_member, m) => props.candidates.indexOf(m) >= 0,
        isMemberChosen: (m) => relicIdx === m,
        note: (member) => (member.awakened ? 'already awakened' : `AWAKEN ${member.def.awakening.name}`),
      };
    }
    // REST
    return {
      pick: 'MEMBER', prefix: 'rest', group: 'rest', dctx,
      memberEnabled: (_member, m) => (props as Extract<NodeProps, { kind: 'REST' }>).candidates.indexOf(m) >= 0,
      note: (member) => {
        const maxHp = derive(member, dctx).HP;
        const gain = Math.max(0, maxHp - member.hp);
        return gain > 0 ? `FULL HEAL +${gain}` : 'at full HP';
      },
      rowTag: (member, slot, relic) => {
        if (!relic) return '';
        if (isCapped(relic)) return 'CAPPED';
        return sharpenPreview(member.relics).has(slot) ? '+1' : '';
      },
    };
  }

  /** FORGE: the worn index a (member, row) stands for, or null. */
  function wornIndexAt(props: Extract<NodeProps, { kind: 'FORGE' }>, member: number, row: number): number | null {
    const m = props.view.party.members[member];
    const relic = m?.relics[SLOTS[row]];
    if (!relic) return null;
    const idx = props.worn.findIndex((r) => r.id === relic.id);
    return idx >= 0 ? idx : null;
  }
  function rebrandFor(props: Extract<NodeProps, { kind: 'FORGE' }>, i: number): readonly SetId[] {
    const given = props.rebrand?.[i];
    if (given) return given;
    const relic = props.worn[i];
    return relic ? rebrandSets(relic, props.pool) : [];
  }
  function modeLegal(props: Extract<NodeProps, { kind: 'FORGE' }>, i: number, mode: ForgeMode): boolean {
    return props.options.some((o) => o.relic === i && o.mode === mode);
  }

  // ------------------------------------------------------------ update ----
  function update(dt: number, props: NodeProps): void {
    sync(props);
    if (props.kind === 'FORGE' && step === 'REBRAND' && relicIdx !== null) {
      rebrandScreen.update(dt, { kind: 'REBRAND', view: props.view, relic: props.worn[relicIdx], sets: rebrandFor(props, relicIdx), declineLabel: 'BACK' });
      return;
    }
    regions.begin();
    addPauseIcon(regions);

    if (props.kind === 'SHRINE') {
      const card = shrineCard(props).rect;
      regions.add('shrine-take', card.x, card.y, card.w, card.h, { index: 0, group: 'cards' });
      regions.add('shrine-skip', SKIP.x, SKIP.y, SKIP.w, SKIP.h, { index: 1, group: 'cards' });
      regions.end();
      const act = regions.activated();
      if (input.pressed('B') || act === 'shrine-skip') { audio.play('skip'); onAnswer({ kind: 'SHRINE', take: false }); }
      else if (act === 'shrine-take') { audio.play('confirm'); onAnswer({ kind: 'SHRINE', take: true }); }
      else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      input.endFrame();
      return;
    }

    if (props.kind === 'FORGE') {
      const o = columns(props);
      if (step === 'RECAST' && relicIdx !== null) {
        const relic = props.worn[relicIdx];
        for (let i = 0; i < 4; i++) {
          regions.add(`forge-sub-${i}`, SUB_ROW.x, SUB_ROW.y + i * SUB_ROW.pitch, SUB_ROW.w, SUB_ROW.h, {
            index: i, group: 'forge', disabled: !relic || !relic.subs[i],
          });
        }
        regions.add('forge-walk', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 4, group: 'forge' });
        regions.end();
        const act = regions.activated();
        if (input.pressed('B')) { audio.play('cancel'); step = 'MODE'; }
        else if (act === 'forge-walk') { audio.play('skip'); onAnswer({ kind: 'FORGE', answer: null }); }
        else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
        else if (act && act.startsWith('forge-sub-')) {
          const i = Number(act.slice(10));
          if (Number.isInteger(i)) { audio.play('equip'); onAnswer({ kind: 'FORGE', answer: { relic: relicIdx, mode: 'RECAST', substat: i } }); }
        }
        input.endFrame();
        return;
      }
      if (step === 'MODE' && relicIdx !== null) {
        const capped = modeLegal(props, relicIdx, 'LEVEL');
        regions.add('forge-level', WEAR_X[0], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 0, group: 'forge', disabled: !capped });
        regions.add('forge-recast', WEAR_X[1], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 1, group: 'forge', disabled: !modeLegal(props, relicIdx, 'RECAST') });
        regions.add('forge-rebrand', WEAR_X[2], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, {
          index: 2, group: 'forge', disabled: !modeLegal(props, relicIdx, 'REBRAND') || rebrandFor(props, relicIdx).length === 0,
        });
        regions.add('forge-walk', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 3, group: 'forge' });
        regions.end();
        const act = regions.activated();
        if (input.pressed('B')) { audio.play('cancel'); step = 'MAIN'; }
        else if (act === 'forge-walk') { audio.play('skip'); onAnswer({ kind: 'FORGE', answer: null }); }
        else if (act === 'forge-level') { audio.play('equip'); onAnswer({ kind: 'FORGE', answer: { relic: relicIdx, mode: 'LEVEL' } }); }
        else if (act === 'forge-recast') { audio.play('ui'); step = 'RECAST'; }
        else if (act === 'forge-rebrand') { audio.play('ui'); step = 'REBRAND'; }
        else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
        input.endFrame();
        return;
      }
      addPartyColumns(regions, props.view.party, o);
      regions.add('forge-walk', WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, { index: 9, group: 'forge' });
      regions.end();
      const act = regions.activated();
      if (input.pressed('B') || act === 'forge-walk') { audio.play('skip'); onAnswer({ kind: 'FORGE', answer: null }); }
      else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      else if (act) {
        const parsed = parseColumnId(o, act);
        if (parsed && parsed.row !== null) {
          const idx = wornIndexAt(props, parsed.member, parsed.row);
          if (idx !== null) { audio.play('card'); relicIdx = idx; pickedAt = { member: parsed.member, row: parsed.row }; step = 'MODE'; }
        }
      }
      input.endFrame();
      return;
    }

    // ALTAR and REST: the columns, a confirmation seat, and (REST only) a way past.
    const o = columns(props);
    addPartyColumns(regions, props.view.party, o);
    if (props.kind === 'ALTAR') {
      regions.add('altar-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, {
        index: 8, group: 'altar', disabled: relicIdx === null,
      });
    } else {
      regions.add('rest-heal', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 8, group: 'rest' });
    }
    regions.end();
    const act = regions.activated();
    if (props.kind === 'REST' && (input.pressed('B') || act === 'rest-heal')) {
      audio.play('heal');
      onAnswer({ kind: 'REST', answer: 'HEAL' });
    } else if (act === 'altar-continue' && relicIdx !== null) {
      audio.play('confirm');
      onAnswer({ kind: 'ALTAR', index: relicIdx });
    } else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
    else if (act) {
      const parsed = parseColumnId(o, act);
      if (parsed) {
        if (props.kind === 'ALTAR') { audio.play('card'); relicIdx = parsed.member; }
        else { audio.play('buff'); onAnswer({ kind: 'REST', answer: { sharpen: parsed.member } }); }
      }
    }
    input.endFrame();
  }

  // ------------------------------------------------------------ render ----
  function centerBitmap(text: string, x: number, w: number, y: number, color: string): void {
    const tw = textWidth(text, TEXT_LABEL, 1, FONT_HD);
    drawText(pc.ctx, text, Math.round(x + (w - tw) / 2), y, { ...hd, color, scale: TEXT_LABEL });
  }
  function rule(x: number, w: number, y: number, color: string): void {
    const ctx = pc.ctx;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + CARD_PAD), Math.round(y), Math.round(w - CARD_PAD * 2), 1);
    ctx.restore();
  }

  function renderShrine(props: Extract<NodeProps, { kind: 'SHRINE' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const pact = props.pact;
    const { lines: blurb, rect } = shrineCard(props);
    const x = rect.x;
    const w = rect.w;
    const cardH = rect.h;
    const cardY = rect.y;
    const focused = regions.focused() === 'shrine-take';

    drawBanner(ctx, 'A SHRINE . THE PACT ON OFFER', C_VIOLET);
    drawFocusablePlate(ctx, x, cardY, w, cardH, focused, C_VIOLET, 0.6);
    let y = cardY + CARD_PAD;
    centerBitmap(pact.name.slice(0, NAME_MAX_PACT), x, w, y, C_VIOLET);
    y += TITLE_H + 8;
    rule(x, w, y, C_VIOLET);
    y += 12;
    hudText(ctx, 'CURSE', x + CARD_PAD, y, { px: HUD_SMALL, color: C_MUTED });
    y += ROW_SMALL;
    hudText(ctx, modifierLine(pact.curse), x + CARD_PAD, y, { color: C_DEBUFF });
    y += ROW;
    hudText(ctx, 'BOON', x + CARD_PAD, y, { px: HUD_SMALL, color: C_MUTED });
    y += ROW_SMALL;
    hudText(ctx, modifierLine(pact.boon), x + CARD_PAD, y, { color: ACCENT_HP });
    y += ROW + 16;
    rule(x, w, y, C_MUTED);
    y += 14;
    for (const ln of blurb) {
      hudTextCentered(ctx, ln, x, y, w, ROW_SMALL, { px: HUD_SMALL, color: C_TEXT });
      y += ROW_SMALL;
    }

    // The stack so far, and how much of the pool is left.
    const taken = props.view.pactsTaken ?? [];
    hudText(ctx, 'PACTS TAKEN', PACT_CHIP.x, PACT_CHIP.y - 26, { px: HUD_SMALL, color: C_MUTED });
    if (taken.length === 0) hudText(ctx, 'none yet', PACT_CHIP.x, PACT_CHIP.y, { px: HUD_SMALL, color: C_DIM });
    taken.forEach((id: PactId, i: number) => {
      const cy = PACT_CHIP.y + i * (PACT_CHIP.h + PACT_CHIP.gap);
      plate(ctx, PACT_CHIP.x, cy, PACT_CHIP.w, PACT_CHIP.h, { alpha: 0.5 });
      hudText(ctx, PACTS[id]?.name ?? id, PACT_CHIP.x + 12, cy + 12, { px: HUD_SMALL, color: C_VIOLET });
    });
    hudText(ctx, `${props.untakenCount} pact${props.untakenCount === 1 ? '' : 's'} left in the crypt`,
      CANVAS_W - inset.right, PACT_CHIP.y - 26, { px: HUD_SMALL, color: C_MUTED, align: 'right' });

    drawSecondaryButton(ctx, SKIP.x, SKIP.y, SKIP.w, SKIP.h, 'WALK PAST', regions.focused() === 'shrine-skip');
    hudTextCentered(ctx, 'both halves last the rest of the run . walking past mends nothing', 0,
      pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
  }

  function renderForge(props: Extract<NodeProps, { kind: 'FORGE' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const relic = relicIdx !== null ? props.worn[relicIdx] : null;

    if (step === 'RECAST' && relic) {
      drawBanner(ctx, 'RECAST . WHICH SUBSTAT?', ACCENT);
      const color = RARITY_COLOR[relic.rarity];
      centerBitmap(relicTitle(relic), CARD_X[1], CARD_W, CARD_Y + 8, color);
      hudTextCentered(ctx, mainLine(relic), CARD_X[1], CARD_Y + TITLE_H + 16, CARD_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      for (let i = 0; i < 4; i++) {
        const y = SUB_ROW.y + i * SUB_ROW.pitch;
        const line = substatLine(relic, i);
        const focused = regions.focused() === `forge-sub-${i}`;
        drawFocusablePlate(ctx, SUB_ROW.x, y, SUB_ROW.w, SUB_ROW.h, focused, line ? color : undefined, 0.55);
        ctx.save();
        if (!line) ctx.globalAlpha *= 0.45;
        hudText(ctx, line || 'no substat here', SUB_ROW.x + CARD_PAD, y + 20, { color: line ? C_TEXT : C_MUTED });
        ctx.restore();
      }
      hudTextCentered(ctx, 'the key is redrawn and every roll is taken again', 0, 496, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_MUTED });
      drawSecondaryButton(ctx, WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, 'WALK PAST', regions.focused() === 'forge-walk');
      hudTextCentered(ctx, 'B steps back', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      return;
    }

    const base = columns(props);
    // Past step 1 the columns are context, not a menu: only the picked row stays
    // lit, so the frame cannot imply that the others are still choosable.
    const o: ColumnOptions = step === 'MODE'
      ? { ...base, rowEnabled: (_m, _slot, _relic, m, row) => !!pickedAt && pickedAt.member === m && pickedAt.row === row }
      : base;
    drawBanner(ctx, step === 'MODE' ? 'THE FORGE . WHAT SHALL IT BECOME?' : 'THE FORGE . CHOOSE A RELIC', ACCENT);
    drawPartyColumns(pc, regions, props.view.party, o);

    if (step === 'MODE' && relic && relicIdx !== null) {
      const capped = isCapped(relic);
      const rebrandCount = rebrandFor(props, relicIdx).length;
      hudTextCentered(ctx, `${relicTitle(relic)} . ${mainLine(relic)}`, 0, FOOT_NOTE_Y, CANVAS_W, HUD_PX, {
        color: RARITY_COLOR[relic.rarity],
      });
      const buttons: [string, string, string, boolean][] = [
        ['forge-level', `LEVEL +${props.levels}`, capped ? 'already capped' : `+${props.levels} levels`, !capped && modeLegal(props, relicIdx, 'LEVEL')],
        ['forge-recast', 'RECAST', 'redraw one substat', modeLegal(props, relicIdx, 'RECAST')],
        ['forge-rebrand', 'REBRAND', rebrandCount ? `${rebrandCount} sets in the pool` : 'no other set', modeLegal(props, relicIdx, 'REBRAND') && rebrandCount > 0],
      ];
      buttons.forEach(([id, label, why, enabled], i) => {
        const focused = regions.focused() === id;
        if (!enabled) {
          gradientPlate(ctx, WEAR_X[i], WEAR_Y + 12, WEAR_BTN.w, WEAR_BTN.h - 24, { topAlpha: 0.3, border: focused ? C_TEXT : undefined });
          hudTextCentered(ctx, label, WEAR_X[i], WEAR_Y + 24, WEAR_BTN.w, HUD_PX, { color: C_MUTED, alpha: 0.6 });
          hudTextCentered(ctx, why, WEAR_X[i], WEAR_Y + 50, WEAR_BTN.w, HUD_SMALL, { px: HUD_SMALL, color: C_MUTED, alpha: 0.5 });
          return;
        }
        if (i === 0) drawPrimaryButton(ctx, WEAR_X[i], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, label, focused, regions.pressing() === id);
        else {
          gradientPlate(ctx, WEAR_X[i], WEAR_Y + 12, WEAR_BTN.w, WEAR_BTN.h - 24, { topAlpha: focused ? 0.6 : 0.4, border: focused ? C_TEXT : undefined });
          hudTextCentered(ctx, label, WEAR_X[i], WEAR_Y + 22, WEAR_BTN.w, HUD_PX, { color: C_TEXT });
          hudTextCentered(ctx, why, WEAR_X[i], WEAR_Y + 50, WEAR_BTN.w, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
        }
      });
    } else {
      hudTextCentered(ctx, 'A picks the relic . B walks past', 0, FOOT_NOTE_Y, CANVAS_W, HUD_PX, { color: C_DIM });
    }
    drawSecondaryButton(ctx, WEAR_X[3], WEAR_Y, WEAR_BTN.w, WEAR_BTN.h, 'WALK PAST', regions.focused() === 'forge-walk');
    hudTextCentered(ctx, 'walking past is legal — the forge keeps nothing', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, {
      px: HUD_SMALL, color: C_DIM,
    });
  }

  /** The REST's foot line — one sharpenPreview call, not one per interpolation. */
  function restDetail(member: PartyMember, candidate: boolean): string {
    if (!candidate) return `${member.def.name} has nothing left to sharpen`;
    const n = sharpenPreview(member.relics).size;
    return `SHARPEN ${member.def.name} . +1 on ${n} relic${n === 1 ? '' : 's'}`;
  }

  function renderAltarOrRest(props: Extract<NodeProps, { kind: 'ALTAR' | 'REST' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const o = columns(props);
    const altar = props.kind === 'ALTAR';
    drawBanner(ctx, altar ? 'THE ALTAR . ONE AWAKENS' : 'A REST . HEAL, OR SHARPEN', altar ? C_GOLD : ACCENT_HP);
    drawPartyColumns(pc, regions, props.view.party, o);

    // The focused column's detail, on the one line between the columns and the seats.
    const id = regions.focused() ?? '';
    const focusM = id.startsWith(`${o.prefix}-col-`) ? Number(id.slice(`${o.prefix}-col-`.length)) : (relicIdx ?? -1);
    const member = props.view.party.members[focusM];
    if (member) {
      const detail = altar
        ? (member.awakened ? `${member.def.name} has already awakened` : `${member.def.awakening.name} . ${awakeningDetail(member.def)}`)
        : restDetail(member, props.candidates.indexOf(focusM) >= 0);
      hudTextCentered(ctx, detail, 0, FOOT_NOTE_Y, CANVAS_W, HUD_PX, { color: altar ? C_GOLD : ACCENT_HP });
    }

    if (altar) {
      const chosen = relicIdx !== null ? props.view.party.members[relicIdx] : null;
      if (chosen) {
        drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, `AWAKEN ${chosen.def.name.toUpperCase()}`,
          regions.focused() === 'altar-continue', regions.pressing() === 'altar-continue', C_GOLD);
      } else {
        hudTextCentered(ctx, 'choose who awakens', CONTINUE.x, CONTINUE.y + 34, CONTINUE.w, HUD_PX, { color: C_MUTED, alpha: 0.7 });
      }
      hudTextCentered(ctx, 'the altar cannot be declined . once per lap, one member', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL,
        { px: HUD_SMALL, color: C_DIM });
      return;
    }
    drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, 'FULL HEAL',
      regions.focused() === 'rest-heal', regions.pressing() === 'rest-heal', ACCENT_HP);
    hudTextCentered(ctx, 'A on a column sharpens that member . FULL HEAL is also on B', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL,
      { px: HUD_SMALL, color: C_DIM });
  }

  function render(time: number, props: NodeProps): void {
    sync(props);
    if (props.kind === 'FORGE' && step === 'REBRAND' && relicIdx !== null) {
      rebrandScreen.render(time, { kind: 'REBRAND', view: props.view, relic: props.worn[relicIdx], sets: rebrandFor(props, relicIdx), declineLabel: 'BACK' });
      return;
    }
    scene();
    if (props.kind === 'SHRINE') renderShrine(props);
    else if (props.kind === 'FORGE') renderForge(props);
    else renderAltarOrRest(props);
    drawPauseIcon(pc.ctx, regions);
  }

  return {
    update,
    render,
    view(props: NodeProps): NodeDevView {
      const options = props.kind === 'SHRINE' ? [props.pact.id]
        : props.kind === 'FORGE' ? props.worn.map((r) => relicTitle(r))
          : props.candidates.map((c) => String(c));
      return { kind: props.kind, step, options, chosen: relicIdx };
    },
  };
}
