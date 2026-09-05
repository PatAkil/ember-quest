// Ember Quest v3 — screens/title.ts: the TITLE scene, standing in the EMBER
// CRYPT. The reference is octopath-3 — a lit scene with the party small in
// it — and octopath-4's restraint: the diorama does the talking, the words
// stay out of its way. So the three slice heroes idle on the battle screen's
// own diagonal (layout.ts's HERO_FEET, contact shadows under them, drawn
// between the diorama and the light plane by main.ts's one scene pass), the
// logo is the only bitmap text on the frame, and everything the player reads
// as UI — tagline, hint, biome line, START — is the HUD face over a thin
// plate. START is still a full-canvas tap target (twinned with the drawn
// plate, which carries the focus ring) so a phone can start from anywhere.
// DESIGN.md → Presentation → HD-2D, Input, UI constraints ("Two kinds of
// text": the logo is bitmap, the rest is not).

import type { Audio, HitRegions, Input, Light, LightActor, PixelCanvas } from '../../engine';
import { BUTTON_KEY, FONT_HD, PICO8, blink, drawLogo, pulse } from '../../engine';
import {
  CANVAS_W, CANVAS_H, HERO_FEET, HUD_PX, HUD_SMALL, safeInsetFor,
} from './layout';
import { FOCUS_RING_W, hudText, hudTextCentered, plate } from './hud';
import type { ActorDrawState } from '../art/actors';
import { ACTOR_RECIPES, ACTOR_W, actorHitRect, drawActor } from '../art/actors';
import { CHARACTERS, SLICE_PARTY } from '../data';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_ACCENT = PICO8[10];

/** The registered target is the button the title has always had; only the DRAWN plate is thin, centred in it. */
const START_HIT = { x: CANVAS_W / 2 - 200, y: 520, w: 400, h: 96 } as const;
const START_PLATE = { x: START_HIT.x, y: START_HIT.y + 20, w: START_HIT.w, h: 56 } as const;

const LOGO_Y = 108;
const TAGLINE_Y = 214;
const SUBLINE_Y = 240;

/** Recipes that carry their own light — battle.ts's ACTOR_GLOW for the three the title stands up. */
const TITLE_GLOW: Record<string, number> = { EMBER: 0.9, TIDE: 0.55 };

/** The party as the title stands it: the slice roster on the battle screen's own diagonal. */
const CAST = SLICE_PARTY.map((id, i) => ({
  recipe: ACTOR_RECIPES[id],
  element: CHARACTERS[id].element,
  feet: HERO_FEET[i] ?? HERO_FEET[0],
  glow: TITLE_GLOW[id] ?? 0,
}));

/**
 * The rects renderLightPlane wants for rim light and prop glow. The cast never
 * moves, so this is built once at module load — the title allocates nothing per
 * frame. `y` is the top of the silhouette, the same 0.88 x ACTOR_W the battle
 * screen uses for a head.
 */
/** Contact-shadow widths, measured once: actorHitRect returns a fresh object and the cast is static. */
const SHADOW_SPAN: readonly number[] = CAST.map((c) => actorHitRect(c.recipe, c.feet.x, c.feet.y).w);

const LIGHT_ACTORS: readonly LightActor[] = CAST.map((c) => ({
  x: c.feet.x - ACTOR_W / 2,
  y: c.feet.y - ACTOR_W * 0.88,
  w: ACTOR_W,
  h: ACTOR_W * 0.88,
  glow: c.glow,
}));

export interface TitleScreenDeps {
  pc: PixelCanvas;
  input: Input;
  regions: HitRegions;
  audio: Audio;
  /** The shared scene layer — this screen only uses it for the heroes' contact shadows. */
  light: Light;
  /** main.ts's one scene pass: diorama -> the world this callback draws -> light plane -> post. */
  scene(drawWorld: () => void, actors: readonly LightActor[]): void;
  /** Fired once, the frame START is activated (tap anywhere, or A on the focused button). */
  onStart: () => void;
}

export interface TitleScreen {
  update(dt: number): void;
  render(time: number): void;
}

export function createTitleScreen(deps: TitleScreenDeps): TitleScreen {
  const { pc, input, regions, audio, light, scene, onStart } = deps;

  /** The frame's clock, read by the bound callback below — so the scene pass takes no fresh closure per frame. */
  let castTime = 0;
  /** One draw record for the whole cast, rewritten per hero: three static idlers allocate nothing. */
  const drawState: ActorDrawState = { pose: 'idle', time: 0, element: CAST[0].element, facing: 1, x: 0, y: 0 };
  const drawCast = (): void => {
    const ctx = pc.ctx;
    for (let i = 0; i < CAST.length; i++) {
      light.drawContactShadow(ctx, CAST[i].feet.x, CAST[i].feet.y, SHADOW_SPAN[i]);
    }
    for (const c of CAST) {
      drawState.time = castTime;
      drawState.element = c.element;
      drawState.x = c.feet.x;
      drawState.y = c.feet.y;
      drawActor(ctx, c.recipe, drawState);
    }
  };

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
      regions.add('start', START_HIT.x, START_HIT.y, START_HIT.w, START_HIT.h, { index: 0 });
      regions.add('start', 0, 0, CANVAS_W, CANVAS_H, { index: 0 });
      regions.end();
      if (regions.activated() === 'start') {
        audio.play('blip');
        onStart();
      }
      input.endFrame();
    },

    render(time: number) {
      // main.ts clears once, before juice.preRender, for every screen alike; the
      // scene pass puts the cast between the diorama and the light plane, so the
      // heroes are lit and rimmed by the crypt they are standing in.
      const ctx = pc.ctx;
      const inset = safeInsetFor(pc);
      castTime = time;
      scene(drawCast, LIGHT_ACTORS);

      // The logo is world-and-arcade, so it stays bitmap FONT_HD (DESIGN.md,
      // "Two kinds of text"); everything under it is UI, so it is not.
      drawLogo(ctx, 'EMBER QUEST', CANVAS_W, LOGO_Y, { color: C_ACCENT, shade: PICO8[9], shadow: PICO8[2], scale: 8, font: FONT_HD });
      hudTextCentered(ctx, 'a roguelike party battler', 0, TAGLINE_Y, CANVAS_W, HUD_PX, { color: C_DIM });
      hudTextCentered(ctx, 'three heroes . an attack bar . relics that roll their own numbers', 0, SUBLINE_Y, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_TEXT });

      // Focus BREATHES, it never blinks out: the ring alternates between the
      // cream focus colour and the plate's own accent, so there is no frame in
      // which the focused button is indistinguishable from an unfocused one.
      const focused = regions.focused() === 'start';
      const hot = focused && blink(time, 1.0, 0.6) === 1;
      plate(ctx, START_PLATE.x, START_PLATE.y, START_PLATE.w, START_PLATE.h,
        hot ? { border: C_TEXT, borderWidth: FOCUS_RING_W, alpha: 0.7 } : { border: C_ACCENT, alpha: 0.55 });
      // The one call to action on the frame: it reads bright whether or not the
      // keyboard has found it yet; the ring, not the ink, is what says "focused".
      hudTextCentered(ctx, 'PRESS TO BEGIN', START_PLATE.x, START_PLATE.y, START_PLATE.w, START_PLATE.h, { color: C_TEXT });

      const hint = input.pointer.type === 'touch' ? 'tap anywhere to begin' : `${BUTTON_KEY.A.hint} or tap anywhere . arrows move . P pauses`;
      hudTextCentered(ctx, hint, 0, CANVAS_H - inset.bottom - 20, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      hudText(ctx, 'EMBER CRYPT . act 1', inset.left, inset.top, {
        px: HUD_SMALL, color: C_DIM, alpha: 0.5 + 0.5 * pulse(time, 2),
      });
    },
  };
}
