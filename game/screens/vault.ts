// Ember Quest v3 — screens/vault.ts: the meta screen, and the one file in the
// game that touches localStorage (CLAUDE.md's repo map says so out loud).
// Three faces, all on geometry the contract already owns:
//
//   EQUIP    run start. The Vault's twelve relics on the draft grid
//            (VAULT_SIZE = 12 = DRAFT_X x DRAFT_Y), pick up to
//            vaultSlots = min(VAULT_EQUIP_MAX, actsCleared), ONE PER SLOT —
//            a slot greys out once it is spoken for. The ascension select
//            rides the same frame: a stepper on the WEAR row's outer seats,
//            CONTINUE between them, and the chosen level is clamped up by
//            `minAscensionFor` — one per Vault relic worn (DESIGN.md:922).
//   DOORS    the act-6 clear. DESCEND and ANOTHER LAP, 520 x 200 at DOOR_X
//            96 / 664, DOOR_Y 320, titles in bitmap FONT_HD at TEXT_LABEL —
//            door labels are one of the two things that stay bitmap.
//   BANK     run end. Pick n of the worn relics on the party columns, then,
//            only if the Vault would overflow, drop down to VAULT_SIZE on the
//            grid. Under-dropping is legal: the seam trims lowest-level-first.
//
// The persistence key holds exactly what DESIGN.md:925-928 says survives a
// run — the Vault, vaultSlots and the highest ascension won — behind a version
// tag. A parse failure RESETS to empty rather than throwing: a corrupt key
// must never be able to stop the game booting.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { FONT_HD, PICO8, drawText, textWidth } from '../../engine';
import {
  CANVAS_W, CONTINUE, DOOR_H, DOOR_W, DOOR_X, DOOR_Y, HUD_LARGE, HUD_PX, HUD_SMALL, PAUSE_ICON,
  RELIC_TITLE_MAX, TEXT_LABEL, WEAR_X, WEAR_Y, safeInsetFor,
} from './layout';
import {
  ACCENT, ACCENT_COOL, C_GOLD, C_MUTED, drawFocusablePlate, drawIcon, drawPrimaryButton,
  gradientPlate, hudText, hudTextCentered, plate,
} from './hud';
import { SLOT_ICON_NAME } from './hud';
import type { Relic, Slot } from '../types';
import { ASCENSION_MAX, SLOTS, VAULT_EQUIP_MAX, VAULT_SIZE } from '../types';
/** The ladder's top, from the one place that owns it (game/types.ts) — re-exported because this screen is
 * where the ascension select lives and main.ts reads it from here. */
export { ASCENSION_MAX };
import { LAP_MULT } from '../data/enemies';
import { isKindled, mainLine, partyWorn, relicTitle } from '../sim/relics';
import {
  ColumnOptions, RARITY_COLOR, ScreenView, addPartyColumns, addPauseIcon, deriveCtxFor, drawBanner,
  drawPartyColumns, drawPauseIcon, parseColumnId,
} from './party';
import { draftSlotRect } from './draft';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const hd = { font: FONT_HD };
const TITLE_H = FONT_HD.glyphH * TEXT_LABEL;

// ------------------------------------------------------------- geometry ---
/** The band over the grid: what this screen is, and where the ascension stands. */
// promote to layout.ts
export const VAULT_BAND = { x: 24, y: 24, w: CANVAS_W - 48, h: 56 } as const;
/** Pad inside a vault chip. */
// promote to layout.ts
export const CHIP_PAD = 12;
/**
 * The ascension select, as ONE control on the foot row left of CONTINUE: a ◀
 * seat, the level on a lit plate, a ▶ seat. Both seats are drawn at exactly
 * TAP_MIN so the drawn rect IS the hit rect, and the three pieces end at 448 —
 * where CONTINUE begins.
 */
// promote to layout.ts
export const ASC_DOWN = { x: WEAR_X[0], y: WEAR_Y, w: 96, h: 96 } as const;
// promote to layout.ts
export const ASC_PLATE = { x: 144, y: 568, w: 200, h: 64 } as const;
// promote to layout.ts
export const ASC_UP = { x: 352, y: WEAR_Y, w: 96, h: 96 } as const;

// =========================================================== persistence ===
/** One key, version-tagged. DESIGN.md → The Vault: the relics, the slots and the highest ascension won. */
export const VAULT_KEY = 'ember-quest/vault';
export const VAULT_VERSION = 1;

export interface VaultSave {
  version: number;
  vault: Relic[];
  /** min(VAULT_EQUIP_MAX, acts cleared last run). */
  vaultSlots: number;
  unlockedAscension: number;
}

export const EMPTY_VAULT: VaultSave = { version: VAULT_VERSION, vault: [], vaultSlots: 0, unlockedAscension: 0 };

function clampInt(n: unknown, lo: number, hi: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : lo;
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Reads the key. Anything unexpected — no storage at all (a locked-down
 * browser), bad JSON, a wrong version, a non-array vault — comes back as
 * EMPTY_VAULT. A meta file is never worth a crash on boot.
 */
export function loadVault(): VaultSave {
  try {
    const raw = globalThis.localStorage?.getItem(VAULT_KEY);
    if (!raw) return { ...EMPTY_VAULT, vault: [] };
    const parsed = JSON.parse(raw) as Partial<VaultSave> | null;
    if (!parsed || parsed.version !== VAULT_VERSION || !Array.isArray(parsed.vault)) return { ...EMPTY_VAULT, vault: [] };
    return {
      version: VAULT_VERSION,
      vault: (parsed.vault as Relic[]).slice(0, VAULT_SIZE),
      vaultSlots: clampInt(parsed.vaultSlots, 0, VAULT_EQUIP_MAX),
      unlockedAscension: clampInt(parsed.unlockedAscension, 0, ASCENSION_MAX),
    };
  } catch {
    return { ...EMPTY_VAULT, vault: [] };
  }
}

/** Writes the key. A storage that refuses (private mode, quota) is not an error the player should see. */
export function saveVault(save: VaultSave): void {
  try {
    const out: VaultSave = {
      version: VAULT_VERSION,
      vault: save.vault.slice(0, VAULT_SIZE),
      vaultSlots: clampInt(save.vaultSlots, 0, VAULT_EQUIP_MAX),
      unlockedAscension: clampInt(save.unlockedAscension, 0, ASCENSION_MAX),
    };
    globalThis.localStorage?.setItem(VAULT_KEY, JSON.stringify(out));
  } catch {
    /* a Vault that cannot be written is a Vault that stays empty next boot — never a thrown boot */
  }
}
export function clearVault(): void {
  try {
    globalThis.localStorage?.removeItem(VAULT_KEY);
  } catch {
    /* ignored, as above */
  }
}

/**
 * THE NOT-IMPLEMENTED RULE, implemented — here and nowhere else. DESIGN.md:922:
 * carrying the Vault into a run raises the FLOOR of the ascension you may
 * choose, by one per Vault relic worn. The select clamps to this and says why;
 * the clamped value is what goes into RunConfig.ascension, so sim/run.ts needs
 * no change and never learns the Vault was the reason.
 */
export function minAscensionFor(equipped: readonly Relic[]): number {
  return Math.min(ASCENSION_MAX, equipped.length);
}
/** The chosen level, floored by the Vault and ceilinged by what has been unlocked (the floor wins a tie-break). */
export function clampAscension(chosen: number, equippedCount: number, unlocked: number): number {
  const floor = Math.min(ASCENSION_MAX, equippedCount);
  const ceil = Math.max(floor, Math.min(ASCENSION_MAX, unlocked));
  return Math.max(floor, Math.min(ceil, Math.max(0, Math.floor(chosen))));
}

// ================================================================= props ===
/**
 * NOTE for the caller: a NEW decision must arrive as a NEW props object (this
 * is what spreading a pending into `{...pending, view}` does anyway). The
 * screen skips rebuilding its identity key when it is handed the SAME object
 * twice in a tick — update() then render() — so a props object mutated in
 * place would not be seen as a new decision.
 */
export type VaultProps =
  | {
    kind: 'EQUIP'; vault: readonly Relic[]; slots: number;
    /** The player's current choice; the screen clamps it and reports the clamped value back. */
    ascension: number; unlockedAscension: number; view?: ScreenView;
  }
  | { kind: 'DOORS'; view: ScreenView; banked: number }
  | { kind: 'BANK'; view: ScreenView; worn: readonly Relic[]; n: number; vault: readonly Relic[]; vaultSize?: number };

export type VaultAnswer =
  | { kind: 'EQUIP'; equip: number[]; ascension: number }
  | { kind: 'DOORS'; door: 'DESCEND' | 'LAP' }
  | { kind: 'BANK'; take: number[]; drop: number[] };

export interface VaultDevView {
  face: VaultProps['kind'];
  step: 'PICK' | 'DROP';
  chosen: number[];
  drop: number[];
  slots: number;
  ascension: number;
  minAscension: number;
}

export interface VaultScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  scene(): void;
  onPause(): void;
  onAnswer(answer: VaultAnswer): void;
}

export interface VaultScreen {
  update(dt: number, props: VaultProps): void;
  render(time: number, props: VaultProps): void;
  view(props: VaultProps): VaultDevView;
}

export function createVaultScreen(deps: VaultScreenDeps): VaultScreen {
  const { pc, input, regions, audio, scene, onPause, onAnswer } = deps;
  /** EQUIP: indices into `vault`, in pick order — the answer IS ordered (first per slot wins). BANK: indices into `worn`. */
  let chosen: number[] = [];
  /** BANK's second step: indices into `vault`. */
  let drop: number[] = [];
  let step: 'PICK' | 'DROP' = 'PICK';
  /**
   * The level the PLAYER asked for. What the screen shows and answers is this
   * clamped up by the Vault's floor — kept apart precisely so un-picking a
   * relic takes the floor's push back with it, while a level the player
   * stepped to themselves survives.
   */
  let wanted = 0;
  let lastKey = '';
  let lastProps: VaultProps | null = null;

  /** Rebuilt only when the payload actually changes — update() and render() share one build per frame. */
  function sync(props: VaultProps): void {
    if (props === lastProps) return;
    lastProps = props;
    const key = props.kind === 'EQUIP' ? `E:${props.vault.map((r) => r.id).join(',')}:${props.slots}`
      : props.kind === 'DOORS' ? `D:${props.banked}`
        : `B:${props.worn.map((r) => r.id).join(',')}:${props.n}`;
    if (key === lastKey) return;
    lastKey = key;
    chosen = [];
    drop = [];
    step = 'PICK';
    if (props.kind === 'EQUIP') wanted = Math.max(0, Math.floor(props.ascension));
  }

  /** The Vault's floor this frame, and the level that follows from it — computed once per pass. */
  function equipped(props: Extract<VaultProps, { kind: 'EQUIP' }>): Relic[] {
    const out: Relic[] = [];
    for (const i of chosen) {
      const relic = props.vault[i];
      if (relic) out.push(relic);
    }
    return out;
  }
  function ascensionNow(props: Extract<VaultProps, { kind: 'EQUIP' }>): { floor: number; ceil: number; level: number } {
    const floor = minAscensionFor(equipped(props));
    const ceil = Math.max(floor, Math.min(ASCENSION_MAX, props.unlockedAscension));
    return { floor, ceil, level: clampAscension(wanted, chosen.length, props.unlockedAscension) };
  }

  /** EQUIP's one-per-slot rule, drawn as well as enforced: which slots are already spoken for. */
  function takenSlots(vault: readonly Relic[]): Set<Slot> {
    const out = new Set<Slot>();
    for (const i of chosen) {
      const relic = vault[i];
      if (relic) out.add(relic.slot);
    }
    return out;
  }

  function bankColumns(props: Extract<VaultProps, { kind: 'BANK' }>): ColumnOptions {
    const index = new Map<string, number>();
    props.worn.forEach((r, i) => index.set(r.id, i));
    return {
      pick: 'ROW', prefix: 'bank', group: 'bank', dctx: deriveCtxFor(props.view),
      rowEnabled: (_m, _slot, relic) => {
        if (!relic) return false;
        const i = index.get(relic.id) ?? -1;
        return i >= 0 && (chosen.indexOf(i) >= 0 || chosen.length < props.n);
      },
      isRowChosen: (m, row) => {
        const relic = props.view.party.members[m]?.relics[SLOTS[row]];
        return !!relic && chosen.indexOf(index.get(relic.id) ?? -1) >= 0;
      },
      rowTag: (_m, _slot, relic) => {
        if (!relic) return '';
        return chosen.indexOf(index.get(relic.id) ?? -1) >= 0 ? 'BANKED' : '';
      },
    };
  }

  function toggle(list: number[], i: number, max: number): number[] {
    const at = list.indexOf(i);
    if (at >= 0) return list.filter((x) => x !== i);
    if (list.length >= max) return list;
    return [...list, i];
  }

  // ------------------------------------------------------------ update ----
  function update(_dt: number, props: VaultProps): void {
    sync(props);
    regions.begin();
    addPauseIcon(regions);

    if (props.kind === 'DOORS') {
      regions.add('door-descend', DOOR_X[0], DOOR_Y, DOOR_W, DOOR_H, { index: 0, group: 'doors' });
      regions.add('door-lap', DOOR_X[1], DOOR_Y, DOOR_W, DOOR_H, { index: 1, group: 'doors' });
      regions.end();
      const act = regions.activated();
      if (act === 'door-descend') { audio.play('win'); onAnswer({ kind: 'DOORS', door: 'DESCEND' }); }
      else if (act === 'door-lap') { audio.play('boss'); onAnswer({ kind: 'DOORS', door: 'LAP' }); }
      else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      input.endFrame();
      return;
    }

    if (props.kind === 'EQUIP') {
      const taken = takenSlots(props.vault);
      props.vault.forEach((relic, i) => {
        const r = draftSlotRect(i, props.vault.length);
        const picked = chosen.indexOf(i) >= 0;
        const blocked = !picked && (chosen.length >= props.slots || taken.has(relic.slot));
        regions.add(`vault-${i}`, r.x, r.y, r.w, r.h, { index: i, group: 'vault', disabled: blocked });
      });
      // CONTINUE takes the lowest of the three foot indices, so an EMPTY Vault
      // (no chip to focus) opens on "BEGIN THE RUN" rather than on a stepper
      // that is disabled at the floor.
      regions.add('vault-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 19, group: 'vault' });
      const asc = ascensionNow(props);
      regions.add('vault-asc-down', ASC_DOWN.x, ASC_DOWN.y, ASC_DOWN.w, ASC_DOWN.h, {
        index: 20, group: 'vault', disabled: asc.level <= asc.floor,
      });
      regions.add('vault-asc-up', ASC_UP.x, ASC_UP.y, ASC_UP.w, ASC_UP.h, {
        index: 21, group: 'vault', disabled: asc.level >= asc.ceil,
      });
      regions.end();
      const act = regions.activated();
      if (act === 'vault-continue') {
        audio.play('confirm');
        onAnswer({ kind: 'EQUIP', equip: [...chosen], ascension: asc.level });
      } else if (act === 'vault-asc-up') {
        audio.play('ui');
        wanted = Math.min(asc.ceil, asc.level + 1);
      } else if (act === 'vault-asc-down') {
        // Stepping DOWN sets the player's own wish below the floor as well, so
        // the level really falls once the relic that raised it is put back.
        audio.play('ui');
        wanted = Math.max(0, asc.level - 1);
      } else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      else if (act && act.startsWith('vault-')) {
        const i = Number(act.slice(6));
        if (Number.isInteger(i)) { audio.play('equip'); chosen = toggle(chosen, i, props.slots); }
      }
      if (input.pressed('B') && chosen.length > 0) { audio.play('cancel'); chosen = []; }
      input.endFrame();
      return;
    }

    // BANK — take, then (only on an overflow) drop.
    const size = props.vaultSize ?? VAULT_SIZE;
    const over = props.vault.length + Math.min(chosen.length, props.n) - size;
    if (step === 'DROP') {
      props.vault.forEach((_relic, i) => {
        const r = draftSlotRect(i, props.vault.length);
        regions.add(`vault-${i}`, r.x, r.y, r.w, r.h, { index: i, group: 'vault' });
      });
      // NOT gated on drop.length: the seam trims what is still over the cap,
      // lowest level first (run.ts's resolveBank), which is exactly what the
      // caption promises. A disabled CONTINUE made that promise a lie.
      regions.add('bank-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 20, group: 'vault' });
      regions.end();
      const act = regions.activated();
      if (input.pressed('B')) { audio.play('cancel'); step = 'PICK'; }
      else if (act === 'bank-continue') { audio.play('confirm'); onAnswer({ kind: 'BANK', take: [...chosen], drop: [...drop] }); }
      else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
      else if (act && act.startsWith('vault-')) {
        const i = Number(act.slice(6));
        if (Number.isInteger(i)) { audio.play('skip'); drop = toggle(drop, i, props.vault.length); }
      }
      input.endFrame();
      return;
    }
    const o = bankColumns(props);
    addPartyColumns(regions, props.view.party, o);
    regions.add('bank-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 8, group: 'bank' });
    regions.end();
    const act = regions.activated();
    // B is the DEFAULT answer here, {take:[],drop:[]} — banking nothing. Without
    // it the one screen whose default the contract spells out had no way to
    // reach it.
    if (input.pressed('B')) { audio.play('cancel'); onAnswer({ kind: 'BANK', take: [], drop: [] }); }
    else if (act === 'bank-continue') {
      if (over > 0) { audio.play('ui'); step = 'DROP'; }
      else { audio.play('confirm'); onAnswer({ kind: 'BANK', take: [...chosen], drop: [] }); }
    } else if (act === 'pause-icon') { audio.play('ui'); onPause(); }
    else if (act) {
      const parsed = parseColumnId(o, act);
      if (parsed && parsed.row !== null) {
        const relic = props.view.party.members[parsed.member]?.relics[SLOTS[parsed.row]];
        const i = relic ? props.worn.findIndex((r) => r.id === relic.id) : -1;
        if (i >= 0) { audio.play('equip'); chosen = toggle(chosen, i, props.n); }
      }
    }
    input.endFrame();
  }

  // ------------------------------------------------------------ render ----
  /** One Vault relic on a draft slot: what it is, what it gives, and why it may be closed to you. */
  function drawChip(relic: Relic, i: number, count: number, id: string, state: 'PICKED' | 'BLOCKED' | 'OPEN' | 'DROPPED'): void {
    const ctx = pc.ctx;
    const r = draftSlotRect(i, count);
    const focused = regions.focused() === id;
    const color = RARITY_COLOR[relic.rarity];
    const accent = state === 'PICKED' ? ACCENT : state === 'DROPPED' ? C_MUTED : color;
    drawFocusablePlate(ctx, r.x, r.y, r.w, r.h, focused, accent, state === 'PICKED' ? 0.7 : 0.55);
    ctx.save();
    if (state === 'BLOCKED' || state === 'DROPPED') ctx.globalAlpha *= 0.45;
    drawIcon(ctx, SLOT_ICON_NAME[relic.slot], r.x + CHIP_PAD, r.y + 14, 28, color);
    hudText(ctx, relicTitle(relic).slice(0, RELIC_TITLE_MAX), r.x + CHIP_PAD + 40, r.y + 12, {
      color: isKindled(relic) ? C_GOLD : color,
    });
    hudText(ctx, relic.slot, r.x + CHIP_PAD + 40, r.y + 36, { px: HUD_SMALL, color: C_MUTED });
    hudText(ctx, mainLine(relic), r.x + CHIP_PAD, r.y + 64, { px: HUD_SMALL, color: C_TEXT });
    const subs = relic.subs.length;
    hudText(ctx, `${subs} substat${subs === 1 ? '' : 's'}`, r.x + r.w - CHIP_PAD, r.y + 64, { px: HUD_SMALL, color: C_MUTED, align: 'right' });
    // The rarity keeps the bottom-left corner alone: the state tag below is
    // right-aligned on the same row and the pair used to run together.
    hudText(ctx, relic.rarity, r.x + CHIP_PAD, r.y + 88, { px: HUD_SMALL, color: C_MUTED });
    ctx.restore();
    if (state === 'PICKED') hudText(ctx, 'EQUIPPED', r.x + r.w - CHIP_PAD, r.y + 88, { px: HUD_SMALL, color: ACCENT, align: 'right' });
    if (state === 'DROPPED') hudText(ctx, 'DROPPED', r.x + r.w - CHIP_PAD, r.y + 88, { px: HUD_SMALL, color: C_MUTED, align: 'right' });
    if (state === 'BLOCKED') hudText(ctx, 'SLOT TAKEN', r.x + r.w - CHIP_PAD, r.y + 88, { px: HUD_SMALL, color: C_MUTED, align: 'right' });
  }

  /** One seat of the ascension stepper: a plate, a triangle, and the level it would take you to. */
  function drawStepperSeat(rect: { x: number; y: number; w: number; h: number }, id: string, dir: -1 | 1, enabled: boolean, target: number): void {
    const ctx = pc.ctx;
    const focused = regions.focused() === id;
    const cy = rect.y + rect.h / 2;
    gradientPlate(ctx, rect.x, rect.y + 16, rect.w, rect.h - 32, {
      topAlpha: focused ? 0.62 : 0.4, border: focused ? C_TEXT : undefined,
    });
    ctx.save();
    if (!enabled) ctx.globalAlpha *= 0.35;
    ctx.fillStyle = focused ? C_TEXT : ACCENT_COOL;
    ctx.beginPath();
    const cx = rect.x + rect.w / 2 + (dir < 0 ? -2 : 2);
    // The APEX points the way the seat goes: left seat ◀, right seat ▶.
    ctx.moveTo(cx - dir * 9, cy - 11);
    ctx.lineTo(cx - dir * 9, cy + 11);
    ctx.lineTo(cx + dir * 9, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    hudTextCentered(ctx, enabled ? `A${target}` : dir < 0 ? 'floor' : 'cap', rect.x, cy + 12, rect.w, HUD_SMALL, {
      px: HUD_SMALL, color: C_MUTED, alpha: enabled ? 1 : 0.6,
    });
  }

  function renderEquip(props: Extract<VaultProps, { kind: 'EQUIP' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const taken = takenSlots(props.vault);
    const asc = ascensionNow(props);
    const floor = asc.floor;
    // The band carries all three headline facts. It stops short of the pause
    // icon's corner (PAUSE_ICON.x), which owns 1192-1256 on every screen.
    plate(ctx, VAULT_BAND.x, VAULT_BAND.y, VAULT_BAND.w, VAULT_BAND.h, { alpha: 0.42 });
    hudText(ctx, `THE VAULT . ${props.vault.length} / ${VAULT_SIZE} HELD`, VAULT_BAND.x + 16, VAULT_BAND.y + 14, {
      px: HUD_LARGE, color: ACCENT,
    });
    hudTextCentered(ctx, floor > 0 ? `A${floor} minimum — one per Vault relic worn` : `A0 to A${asc.ceil} unlocked`,
      0, VAULT_BAND.y + 20, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: floor > 0 ? ACCENT : C_MUTED });
    hudText(ctx, `${chosen.length} / ${props.slots} equipped`, PAUSE_ICON.x - 16, VAULT_BAND.y + 18, {
      color: chosen.length >= props.slots ? ACCENT : C_TEXT, align: 'right',
    });

    if (props.vault.length === 0) {
      hudTextCentered(ctx, 'the Vault is empty — bank a relic and it will be waiting here', 0, 300, CANVAS_W, HUD_PX, { color: C_MUTED });
    }
    props.vault.forEach((relic, i) => {
      const picked = chosen.indexOf(i) >= 0;
      const blocked = !picked && (chosen.length >= props.slots || taken.has(relic.slot));
      drawChip(relic, i, props.vault.length, `vault-${i}`, picked ? 'PICKED' : blocked ? 'BLOCKED' : 'OPEN');
    });

    // The ascension select is a CONTROL, not small print at the frame's edges:
    // a lit level plate over the CONTINUE row with a ◀ and a ▶ seat either side
    // of it, each seat still the contract's WEAR_BTN so a thumb has its 96 px.
    drawStepperSeat(ASC_DOWN, 'vault-asc-down', -1, asc.level > floor, asc.level - 1);
    drawStepperSeat(ASC_UP, 'vault-asc-up', 1, asc.level < asc.ceil, asc.level + 1);
    plate(ctx, ASC_PLATE.x, ASC_PLATE.y, ASC_PLATE.w, ASC_PLATE.h, { alpha: 0.6, border: ACCENT_COOL });
    hudTextCentered(ctx, 'ASCENSION', ASC_PLATE.x, ASC_PLATE.y + 6, ASC_PLATE.w, HUD_SMALL, { px: HUD_SMALL, color: C_MUTED });
    hudTextCentered(ctx, `A${asc.level}`, ASC_PLATE.x, ASC_PLATE.y + 26, ASC_PLATE.w, HUD_LARGE, { px: HUD_LARGE, color: ACCENT_COOL });
    drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, 'BEGIN THE RUN',
      regions.focused() === 'vault-continue', regions.pressing() === 'vault-continue');
    hudTextCentered(ctx, 'one relic per slot . withdrawing takes it out of the Vault . B clears the picks', 0,
      pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
  }

  function renderDoors(props: Extract<VaultProps, { kind: 'DOORS' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const lap = props.view.lap ?? 1;
    drawBanner(ctx, 'THE SIXTH BOSS IS DOWN', C_GOLD);

    // The band between the banner and the doors carries the run being decided:
    // where it got to, what it scored, and what is actually on the table.
    const party = props.view.party;
    const worn = partyWorn(party);
    const kindled = worn.filter((r) => isKindled(r)).length;
    hudTextCentered(ctx, `ACT ${props.view.act ?? 6} . LAP ${lap}`, 0, 130, CANVAS_W, HUD_PX, { color: C_MUTED });
    hudTextCentered(ctx, `SCORE ${Math.round(props.view.score ?? 0)}`, 0, 158, CANVAS_W, HUD_LARGE, { px: HUD_LARGE, color: C_GOLD });
    const names = party.members.map((m, i) => (party.leader === i ? `${m.def.name}*` : m.def.name)).join('  .  ');
    hudTextCentered(ctx, names, 0, 208, CANVAS_W, HUD_PX, { color: C_TEXT });
    hudTextCentered(ctx, `${worn.length} relic${worn.length === 1 ? '' : 's'} worn${kindled ? ` . ${kindled} kindled` : ''}`,
      0, 236, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_MUTED });

    const doors: [string, string, string[], string][] = [
      ['door-descend', 'DESCEND', [`bank ${props.banked} relic${props.banked === 1 ? '' : 's'}`, 'end the run, take the win'], C_GOLD],
      ['door-lap', 'ANOTHER LAP', ['keep party, HP, relics, awakenings', `every enemy x${LAP_MULT.hp} HP, x${LAP_MULT.atk} ATK`], ACCENT_COOL],
    ];
    doors.forEach(([id, title, lines, color], i) => {
      const x = DOOR_X[i];
      const focused = regions.focused() === id;
      drawFocusablePlate(ctx, x, DOOR_Y, DOOR_W, DOOR_H, focused, color, focused ? 0.72 : 0.55);
      const tw = textWidth(title, TEXT_LABEL, 1, FONT_HD);
      drawText(ctx, title, Math.round(x + (DOOR_W - tw) / 2), DOOR_Y + 40, { ...hd, color, scale: TEXT_LABEL });
      lines.forEach((ln, k) => {
        hudTextCentered(ctx, ln, x, DOOR_Y + 56 + TITLE_H + k * 30, DOOR_W, HUD_PX, { color: k === 0 ? C_TEXT : C_MUTED });
      });
    });
    hudTextCentered(ctx, 'the ascension unlock is already yours — the doors only decide the relics', 0,
      pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
  }

  function renderBank(props: Extract<VaultProps, { kind: 'BANK' }>): void {
    const ctx = pc.ctx;
    const inset = safeInsetFor(pc);
    const size = props.vaultSize ?? VAULT_SIZE;
    const over = props.vault.length + Math.min(chosen.length, props.n) - size;

    if (step === 'DROP') {
      drawBanner(ctx, `THE VAULT IS FULL . DROP ${Math.max(0, over)}`, C_MUTED);
      props.vault.forEach((relic, i) => drawChip(relic, i, props.vault.length, `vault-${i}`, drop.indexOf(i) >= 0 ? 'DROPPED' : 'OPEN'));
      const short = Math.max(0, over - drop.length);
      hudTextCentered(ctx, short > 0 ? `${drop.length} of ${Math.max(0, over)} chosen . ${short} will be trimmed for you`
        : `${drop.length} of ${Math.max(0, over)} chosen`, 0, WEAR_Y - 20, CANVAS_W, HUD_SMALL,
      { px: HUD_SMALL, color: short > 0 ? ACCENT : C_MUTED });
      drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, 'CLOSE THE VAULT',
        regions.focused() === 'bank-continue', regions.pressing() === 'bank-continue');
      hudTextCentered(ctx, 'drop too few and the lowest levels go first', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL,
        { px: HUD_SMALL, color: C_DIM });
      return;
    }

    const o = bankColumns(props);
    drawBanner(ctx, `BANK ${props.n} RELIC${props.n === 1 ? '' : 'S'}`, ACCENT);
    drawPartyColumns(pc, regions, props.view.party, o);
    hudTextCentered(ctx, `${chosen.length} / ${props.n} chosen . the Vault holds ${props.vault.length} of ${size}`, 0, 516, CANVAS_W, HUD_PX, {
      color: chosen.length >= props.n ? ACCENT : C_DIM,
    });
    drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, over > 0 ? 'NEXT . MAKE ROOM' : 'BANK THEM',
      regions.focused() === 'bank-continue', regions.pressing() === 'bank-continue');
    hudTextCentered(ctx, 'level, sigil and kindling all survive the run . B banks nothing', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL,
      { px: HUD_SMALL, color: C_DIM });
  }

  function render(_time: number, props: VaultProps): void {
    sync(props);
    scene();
    if (props.kind === 'EQUIP') renderEquip(props);
    else if (props.kind === 'DOORS') renderDoors(props);
    else renderBank(props);
    drawPauseIcon(pc.ctx, regions);
  }

  return {
    update,
    render,
    view(props: VaultProps): VaultDevView {
      const equippedNow = props.kind === 'EQUIP' ? equipped(props) : [];
      return {
        face: props.kind,
        step,
        chosen: [...chosen],
        drop: [...drop],
        slots: props.kind === 'EQUIP' ? props.slots : props.kind === 'BANK' ? props.n : 0,
        ascension: props.kind === 'EQUIP' ? ascensionNow(props).level : 0,
        minAscension: minAscensionFor(equippedNow),
      };
    },
  };
}
