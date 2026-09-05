// Ember Quest v3 — screens/end.ts: GAME OVER and VICTORY. Pure rendering +
// input; scene routing and the runtime.gameOver/stateChanged sends live in
// main.ts's scenes.onEnter handlers (messaging-game-over: "putting it in the
// onEnter handler guarantees exactly one send per terminal entry"). DESIGN.md
// → UI constraints (end screens row): RETRY/CONTINUE reuse CONTINUE; the
// act-6 doors row does not apply here — the slice ends at act 1.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { FONT_HD, PICO8, drawPanel, drawText, drawTextCentered, textWidth } from '../../engine';
import { CANVAS_W, CONTINUE, TEXT_BODY, TEXT_LABEL, TEXT_POP_CRIT } from './layout';
import type { RunScreen } from './run';

const hd = { font: FONT_HD };
const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_PANEL = PICO8[1];
const C_DEATH = PICO8[8];
const C_VICTORY = PICO8[10];

export interface EndScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** GAME_OVER's RETRY: start a fresh slice run. */
  onRetry: () => void;
  /** VICTORY's CONTINUE: restart the slice (there is no act 2 yet). */
  onContinue: () => void;
}

export interface EndScreen {
  update(dt: number, run: RunScreen): void;
  render(time: number, run: RunScreen): void;
}

export function createEndScreen(deps: EndScreenDeps): EndScreen {
  const { pc, input, regions, audio, onRetry, onContinue } = deps;

  return {
    // A complete tick — begin -> add -> end -> check activation -> endFrame() —
    // the same shape battle.ts uses: end() is what resolves this tick's
    // activation, so it must run before (not after) the check below.
    update(_dt, run) {
      const won = run.state().phase === 'VICTORY';
      regions.begin();
      regions.add('end-continue', CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { index: 0 });
      regions.end();
      if (regions.activated() === 'end-continue') {
        audio.play('blip');
        if (won) onContinue();
        else onRetry();
      }
      input.endFrame();
    },

    render(_time, run) {
      const ctx = pc.ctx;
      const s = run.state();
      const won = s.phase === 'VICTORY';
      const accent = won ? C_VICTORY : C_DEATH;

      // DESIGN.md UI constraints → end screens: "score and act at TEXT_LABEL
      // centred at y 120" — a compact summary line above the big verdict.
      drawTextCentered(ctx, `ACT 1   SCORE ${s.score}`, CANVAS_W, 120, { ...hd, color: C_DIM, scale: TEXT_LABEL });
      drawTextCentered(ctx, won ? 'VICTORY' : 'GAME OVER', CANVAS_W, 230, { ...hd, color: accent, scale: TEXT_POP_CRIT, outline: true });
      drawTextCentered(ctx, won ? 'ACT 1 CLEARED' : `SLAIN BY ${s.deathBy.toUpperCase()}`, CANVAS_W, 320, { ...hd, color: C_TEXT, scale: TEXT_LABEL });
      drawTextCentered(ctx, `ROOMS CLEARED ${s.roomsCleared} / ${run.rooms.length}`, CANVAS_W, 360, { ...hd, color: C_DIM, scale: TEXT_BODY });

      const focused = regions.focused() === 'end-continue';
      const pressed = regions.pressing() === 'end-continue';
      drawPanel(pc, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, { color: C_PANEL, border: focused ? C_TEXT : accent });
      const label = won ? 'CONTINUE' : 'RETRY';
      const lx = Math.round(CONTINUE.x + (CONTINUE.w - textWidth(label, TEXT_LABEL, 1, FONT_HD)) / 2);
      drawText(ctx, label, lx, CONTINUE.y + (pressed ? 32 : 30), { ...hd, color: focused ? C_TEXT : C_DIM, scale: TEXT_LABEL });
    },
  };
}
