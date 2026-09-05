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

import type { Audio, HitRegions, Input, Light, LightActor, PixelCanvas } from '../../engine';
import { PICO8, dimScene } from '../../engine';
import { CANVAS_W, CANVAS_H, CONTINUE, HUD_LARGE, HUD_PX, HUD_SMALL } from './layout';
import { ACCENT, C_DEBUFF, KEY_LIGHT, drawPrimaryButton, hudText, hudTextCentered, hudWidth, withAlpha } from './hud';
import type { ActorDrawState, ActorRecipe } from '../art/actors';
import { ACTOR_RECIPES, ACTOR_W, actorHitRect, drawActor } from '../art/actors';
import type { RunScreen } from './run';

const C_TEXT = PICO8[7];
const C_DIM = PICO8[6];
const C_DEATH = C_DEBUFF;
/** The key light's own amber, not a pure yellow that belongs to no biome. */
const C_VICTORY = ACCENT;

/**
 * The survivors stand in the frame the player screenshots (UI item 10). They
 * are placed on the party's own side, clear of the centred verdict block and of
 * CONTINUE's plate, and drawn INSIDE the scene pass so the crypt's key light
 * and rim reach them; a cached warm pool is laid over the terminal dim
 * afterwards so they still read as lit under it.
 */
const CAST_FEET = [
  { x: 896, y: 424 },
  { x: 986, y: 492 },
  { x: 1076, y: 560 },
] as const;
const CAST_DIM = 0.5;
const POOL = { x: 986, y: 470, r: 300 };
const castPose: ActorDrawState = { pose: 'idle', time: 0, element: 'FIRE', facing: -1, x: 0, y: 0 };
/**
 * One pooled LightActor per member, plus the VIEW handed to renderLightPlane.
 * The pool keeps its three records for the life of the page and the view is
 * trimmed to the live count — trimming the pool itself would drop a record a
 * later frame (a fuller party on a retry) needs back.
 */
const castLightPool: LightActor[] = CAST_FEET.map((f) => ({ x: f.x - ACTOR_W / 2, y: f.y - ACTOR_W * 0.88, w: ACTOR_W, h: ACTOR_W * 0.88, glow: 0 }));
const castLights: LightActor[] = [];
let keyPool: CanvasGradient | null = null;

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
  /** main.ts's one scene pass: diorama -> the world this callback draws -> light plane -> post. */
  scene(drawWorld?: () => void, actors?: readonly LightActor[]): void;
  /** The shared scene layer — this screen only uses it for the survivors' contact shadows. */
  light: Light;
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
  const { pc, input, regions, audio, light, scene, onRetry, onContinue } = deps;
  /**
   * The survivors. Three records are allocated once and rewritten in place each
   * frame — `castN` is how many of them are live this frame — so the end screen
   * allocates nothing per frame, exactly like the battle's light-actor pool.
   */
  interface CastMember { recipe: ActorRecipe; element: ActorDrawState['element']; x: number; y: number; span: number }
  const cast: CastMember[] = CAST_FEET.map((f) => ({ recipe: ACTOR_RECIPES.EMBER, element: 'FIRE', x: f.x, y: f.y, span: 0 }));
  let castN = 0;
  let castTime = 0;

  const drawCast = (): void => {
    const ctx = pc.ctx;
    for (let i = 0; i < castN; i++) light.drawContactShadow(ctx, cast[i].x, cast[i].y, cast[i].span);
    for (let i = 0; i < castN; i++) {
      const c = cast[i];
      castPose.time = castTime;
      castPose.element = c.element;
      castPose.x = c.x;
      castPose.y = c.y;
      drawActor(ctx, c.recipe, castPose);
    }
  };

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

    render(time, run) {
      const ctx = pc.ctx;
      const s = run.state();
      const won = s.phase === 'VICTORY';
      const accent = won ? C_VICTORY : C_DEATH;

      // Whoever walked out of the run stands in the frame, lit by the crypt.
      castTime = time;
      castN = 0;
      for (const m of s.party.members) {
        if (m.hp <= 0 || castN >= CAST_FEET.length) continue;
        const recipe = ACTOR_RECIPES[m.def.id];
        if (!recipe) continue;
        const f = CAST_FEET[castN];
        const c = cast[castN];
        c.recipe = recipe;
        c.element = m.def.element;
        c.x = f.x;
        c.y = f.y;
        c.span = actorHitRect(recipe, f.x, f.y).w;
        castLightPool[castN].x = f.x - ACTOR_W / 2;
        castLightPool[castN].y = f.y - ACTOR_W * 0.88;
        castLights[castN] = castLightPool[castN];
        castN += 1;
      }
      castLights.length = castN;
      scene(castN ? drawCast : undefined, castLights);

      // The terminal-screen overlay: the crypt stays visible under it.
      dimScene(pc, CAST_DIM);
      if (castN) {
        // A warm pool laid back over the dim, so the survivors read as standing
        // in the key light instead of behind a grey sheet. Built once.
        if (!keyPool) {
          keyPool = ctx.createRadialGradient(POOL.x, POOL.y, 0, POOL.x, POOL.y, POOL.r);
          keyPool.addColorStop(0, withAlpha(ACCENT, 0.2));
          keyPool.addColorStop(0.55, withAlpha(KEY_LIGHT, 0.09));
          keyPool.addColorStop(1, withAlpha(KEY_LIGHT, 0));
        }
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = keyPool;
        ctx.fillRect(POOL.x - POOL.r, Math.max(0, POOL.y - POOL.r), POOL.r * 2, Math.min(CANVAS_H, POOL.r * 2));
        ctx.restore();
      }

      hudTextCentered(ctx, `ACT 1   SCORE ${s.score}`, 0, SUMMARY_Y, CANVAS_W, HUD_PX, { color: C_DIM });
      const verdict = won ? 'VICTORY' : 'GAME OVER';
      const vw = hudWidth(ctx, verdict, VERDICT_PX, 200);
      hudText(ctx, verdict, (CANVAS_W - vw) / 2, VERDICT_Y, { px: VERDICT_PX, weight: 200, color: accent });
      // RETREAT is run.ts's own sentinel for a mid-battle QUIT (screens/battle.ts's `forfeit` tag,
      // relayed through main.ts) — a player who walked away was not slain by anything and reads that
      // line oddly credited to the pack they were fighting, so it gets its own verdict line instead.
      const verdictLine = won ? 'ACT 1 CLEARED' : s.deathBy === 'RETREAT' ? 'YOU RETREATED' : `SLAIN BY ${s.deathBy.toUpperCase()}`;
      hudTextCentered(ctx, verdictLine, 0, LINE_Y, CANVAS_W, HUD_LARGE, {
        px: HUD_LARGE, color: C_TEXT,
      });
      hudTextCentered(ctx, `ROOMS CLEARED ${s.roomsCleared} / ${run.rooms.length}`, 0, SUB_Y, CANVAS_W, HUD_SMALL, {
        px: HUD_SMALL, color: C_DIM,
      });

      // The screen's one action: the lit primary plate, in the verdict's colour.
      drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, won ? 'CONTINUE' : 'RETRY',
        regions.focused() === 'end-continue', regions.pressing() === 'end-continue', accent);
    },
  };
}
