// Ember Quest v3 — screens/title.ts: the TITLE scene. Moved out of main.ts
// once phase 4 needed somewhere to route on from — same treatment (drawLogo,
// the pointer-aware hint), START now a full-canvas tap target (twinned with
// a drawn button for the focus ring) so a phone can start from anywhere on
// screen. DESIGN.md → Presentation → Input, UI constraints; end screens row
// (START is screen-level, like the Home-Screen hint and rotate prompt).

import type { Audio, HitRegions, Input, PixelCanvas } from '../../engine';
import { BUTTON_KEY, FONT_HD, PICO8, blink, drawLogo, drawPanel, drawText, drawTextCentered, pulse, textWidth } from '../../engine';
import { CANVAS_W, CANVAS_H, TEXT_BODY, TEXT_LABEL, safeInsetFor } from './layout';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_ACCENT = PICO8[10];
const C_PANEL = PICO8[1];

const START_BTN = { x: CANVAS_W / 2 - 200, y: 520, w: 400, h: 96 } as const;
const hd = { font: FONT_HD };

export interface TitleScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** Fired once, the frame START is activated (tap anywhere, or A on the focused button). */
  onStart: () => void;
}

export interface TitleScreen {
  update(dt: number): void;
  render(time: number): void;
}

export function createTitleScreen(deps: TitleScreenDeps): TitleScreen {
  const { pc, input, regions, audio, onStart } = deps;

  return {
    update() {
      // A screen's update() is a complete tick — begin -> add -> end -> check
      // activation -> endFrame() — exactly once, the same shape battle.ts uses:
      // regions.end() is what actually resolves this tick's tap/focus/activation,
      // so checking activated() before it runs would only ever see last tick's
      // (already-cleared) result.
      regions.begin();
      // The drawn button first (its geometry is the focus ring), then a full-canvas
      // twin second so a tap anywhere on a phone also starts the run.
      regions.add('start', START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, { index: 0 });
      regions.add('start', 0, 0, CANVAS_W, CANVAS_H, { index: 0 });
      regions.end();
      if (regions.activated() === 'start') {
        audio.play('blip');
        onStart();
      }
      input.endFrame();
    },

    render(time: number) {
      // main.ts clears once, before juice.preRender, for every screen alike.
      const ctx = pc.ctx;
      const inset = safeInsetFor(pc);

      drawLogo(ctx, 'EMBER QUEST', CANVAS_W, 150, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 8, font: FONT_HD });
      drawTextCentered(ctx, 'a roguelike party battler', CANVAS_W, 270, { ...hd, color: C_DIM, scale: TEXT_BODY });
      drawTextCentered(ctx, 'three heroes . an attack bar . relics that roll their own numbers', CANVAS_W, 300, { ...hd, color: C_TEXT, scale: TEXT_BODY });

      const focused = regions.focused() === 'start';
      const hot = focused && blink(time, 1.0, 0.6) === 1;
      drawPanel(pc, START_BTN.x, START_BTN.y, START_BTN.w, START_BTN.h, { color: C_PANEL, border: hot ? C_TEXT : C_ACCENT });
      const label = 'PRESS TO BEGIN';
      const lx = Math.round(START_BTN.x + (START_BTN.w - textWidth(label, TEXT_LABEL, 1, FONT_HD)) / 2);
      drawText(ctx, label, lx, START_BTN.y + 30, { ...hd, color: focused ? C_TEXT : C_DIM, scale: TEXT_LABEL });

      const hint = input.pointer.type === 'touch' ? 'tap anywhere to begin' : `${BUTTON_KEY.A.hint} or tap anywhere . arrows move . P pauses`;
      drawTextCentered(ctx, hint, CANVAS_W, CANVAS_H - inset.bottom - 22, { ...hd, color: C_DIM, scale: TEXT_BODY });
      ctx.globalAlpha = 0.5 + 0.5 * pulse(time, 2);
      drawText(ctx, 'EMBER CRYPT . act 1', inset.left, inset.top, { ...hd, color: C_DIM, scale: TEXT_BODY });
      ctx.globalAlpha = 1;
    },
  };
}
