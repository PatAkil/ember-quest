// Ember Quest v3 — screens/end.ts: GAME OVER and VICTORY. Pure rendering +
// input; scene routing and the runtime.gameOver/stateChanged sends live in
// main.ts's scenes.onEnter handlers (messaging-game-over: "putting it in the
// onEnter handler guarantees exactly one send per terminal entry"). DESIGN.md
// → UI constraints (end screens row): RETRY/CONTINUE reuse CONTINUE; the
// act-6 doors row does not apply here — the slice ends at act 1.
//
// The crypt stays on screen behind it: main.ts's shared scene pass, then
// dimScene (the engine's terminal-screen overlay — GAME_OVER / WIN / PAUSED —
// which keeps the world readable as context), then HUD text and one plate.
// No bitmap text here: a verdict is something the player READS, so it renders
// in the HUD face like every other UI line.

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { PICO8, dimScene } from '../../engine';
import { CANVAS_W, CONTINUE, HUD_LARGE, HUD_PX, HUD_SMALL } from './layout';
import { hudText, hudTextCentered, hudWidth, plate } from './hud';
import type { RunScreen } from './run';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_DEATH = PICO8[8];
const C_VICTORY = PICO8[10];

/** The verdict, at roughly the height the contract's bitmap scale 4 drew — the battle's PAUSED size. */
const VERDICT_PX = 44;
/** The region table: "score and act ... centred at y 120". */
const SUMMARY_Y = 120;
const VERDICT_Y = 216;
const LINE_Y = 312;
const SUB_Y = 350;

export interface EndScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** main.ts's one scene pass: the lit diorama every screen draws its HUD over. */
  scene(): void;
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
  const { pc, input, regions, audio, scene, onRetry, onContinue } = deps;

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
      scene();
      const ctx = pc.ctx;
      const s = run.state();
      const won = s.phase === 'VICTORY';
      const accent = won ? C_VICTORY : C_DEATH;
      // The terminal-screen overlay: the crypt stays visible under it.
      dimScene(pc);

      hudTextCentered(ctx, `ACT 1   SCORE ${s.score}`, 0, SUMMARY_Y, CANVAS_W, HUD_PX, { color: C_DIM });
      const verdict = won ? 'VICTORY' : 'GAME OVER';
      const vw = hudWidth(ctx, verdict, VERDICT_PX, 200);
      hudText(ctx, verdict, (CANVAS_W - vw) / 2, VERDICT_Y, { px: VERDICT_PX, weight: 200, color: accent });
      hudTextCentered(ctx, won ? 'ACT 1 CLEARED' : `SLAIN BY ${s.deathBy.toUpperCase()}`, 0, LINE_Y, CANVAS_W, HUD_LARGE, {
        px: HUD_LARGE, color: C_TEXT,
      });
      hudTextCentered(ctx, `ROOMS CLEARED ${s.roomsCleared} / ${run.rooms.length}`, 0, SUB_Y, CANVAS_W, HUD_SMALL, {
        px: HUD_SMALL, color: C_DIM,
      });

      const focused = regions.focused() === 'end-continue';
      const pressed = regions.pressing() === 'end-continue';
      plate(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, focused ? { border: C_TEXT, alpha: 0.7 } : { border: accent, alpha: 0.55 });
      // A pressed button sinks its label by a pixel, as it did before.
      hudTextCentered(ctx, won ? 'CONTINUE' : 'RETRY', CONTINUE.x, CONTINUE.y + (pressed ? 2 : 0), CONTINUE.w, CONTINUE.h, { color: C_TEXT });
    },
  };
}
