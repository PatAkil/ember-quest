// Ember Quest v3 — screens/title.ts: the TITLE scene, standing in the EMBER
// CRYPT. The reference is octopath-3 — a lit scene with the party small in
// it — and octopath-4's restraint: the diorama does the talking, the words
// stay out of its way. So three heroes idle on the battle screen's
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
import { ACCENT, ACCENT_DEEP, ACCENT_SHADOW, drawPrimaryButton, hudText, hudTextCentered } from './hud';
import type { ActorDrawState } from '../art/actors';
import { ACTOR_RECIPES, ACTOR_W, actorHitRect, drawActor } from '../art/actors';
import { CHARACTERS, SLICE_PARTY } from '../data';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
/** The key light's own amber — the pure yellow that belonged to no biome is gone. */
const C_ACCENT = ACCENT;

/** The registered target is the button the title has always had; only the DRAWN plate is thin, centred in it. */
const START_HIT = { x: CANVAS_W / 2 - 200, y: 520, w: 400, h: 96 } as const;
const START_PLATE = { x: START_HIT.x, y: START_HIT.y + 20, w: START_HIT.w, h: 56 } as const;

const LOGO_Y = 108;
const TAGLINE_Y = 214;
const SUBLINE_Y = 240;
/** The Vault line, between the sub-line and START — drawn only when the Vault has something in it. */
const VAULT_Y = 468;

/** Recipes that carry their own light — battle.ts's ACTOR_GLOW for the three the title stands up. */
const TITLE_GLOW: Record<string, number> = { EMBER: 0.9, TIDE: 0.55 };

/**
 * The three the title stands up, on the battle screen's own diagonal. They are
 * scenery, not a party any more — the run drafts its own — so this is a fixed
 * cast chosen for the frame, and nothing downstream reads it.
 */
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
  /**
   * What the Vault is carrying into the next run — "VAULT 6 . 3 TO EQUIP .
   * A2 UNLOCKED", or '' on a first run. It is the one thing the title has to
   * say that the diorama cannot: START goes to the Vault's EQUIP face when
   * there is anything there to choose, and straight to the draft when there is
   * not (main.ts's beginNewRun), so the player is told which one is coming.
   */
  vaultLine?: () => string;
}

export interface TitleScreen {
  update(dt: number): void;
  render(time: number): void;
}

export function createTitleScreen(deps: TitleScreenDeps): TitleScreen {
  const { pc, input, regions, audio, light, scene, onStart, vaultLine } = deps;

  /** The frame's clock, read by the bound callback below — so the scene pass takes no fresh closure per frame. */
  let castTime = 0;
  /** One draw record for the whole cast, rewritten per hero: three static idlers allocate nothing. */
  const drawState: ActorDrawState = { pose: 'idle', time: 0, element: CAST[0].element, facing: -1, x: 0, y: 0 };
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
      drawLogo(ctx, 'EMBER QUEST', CANVAS_W, LOGO_Y, { color: C_ACCENT, shade: ACCENT_DEEP, shadow: ACCENT_SHADOW, scale: 8, font: FONT_HD });
      hudTextCentered(ctx, 'a roguelike party battler', 0, TAGLINE_Y, CANVAS_W, HUD_PX, { color: C_DIM });
      hudTextCentered(ctx, 'three heroes . an attack bar . relics that roll their own numbers', 0, SUBLINE_Y, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_TEXT });

      // The one call to action on the frame, and the game's PRIMARY button: a
      // lit borderless plate with a key-coloured glow, not the 1-px bordered
      // rounded rectangle every other screen used to wear (UI item 9). Focus
      // BREATHES rather than blinking out — the glow swells, it never leaves.
      const focused = regions.focused() === 'start';
      const hot = focused && blink(time, 1.0, 0.6) === 1;
      drawPrimaryButton(ctx, START_PLATE.x, START_PLATE.y - 8, START_PLATE.w, START_PLATE.h + 16,
        'PRESS TO BEGIN', hot || focused, false, C_ACCENT);

      // What the run starts FROM: the Vault line when there is one, so
      // "PRESS TO BEGIN" is not a promise about a screen the player cannot see.
      const vault = vaultLine?.() ?? '';
      if (vault) {
        hudTextCentered(ctx, vault, 0, VAULT_Y, CANVAS_W, HUD_SMALL, {
          px: HUD_SMALL, color: C_ACCENT, alpha: 0.6 + 0.4 * pulse(time, 3),
        });
      }

      const hint = input.pointer.type === 'touch' ? 'tap anywhere to begin' : `${BUTTON_KEY.A.hint} or tap anywhere . arrows move . ${BUTTON_KEY.PAUSE.hint} pauses`;
      hudTextCentered(ctx, hint, 0, CANVAS_H - inset.bottom - 20, CANVAS_W, HUD_SMALL, { px: HUD_SMALL, color: C_DIM });
      hudText(ctx, 'EMBER CRYPT . act 1', inset.left, inset.top, {
        px: HUD_SMALL, color: C_DIM, alpha: 0.5 + 0.5 * pulse(time, 2),
      });
    },
  };
}
