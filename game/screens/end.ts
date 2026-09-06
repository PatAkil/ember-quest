// Ember Quest v3 — screens/end.ts: GAME OVER and VICTORY. Pure rendering +
// input; scene routing and the runtime.gameOver/stateChanged sends live in
// main.ts's scenes.onEnter handlers (messaging-game-over: "putting it in the
// onEnter handler guarantees exactly one send per terminal entry"). DESIGN.md
// → UI constraints (end screens row): RETRY/CONTINUE reuse CONTINUE; the
// act-6 doors row is the VAULT screen's (DESCEND / ANOTHER LAP), reached
// before the run ends, so it never lands here.
//
// Phase 6a: what this screen reports is the seam's own `RunResult` — the act
// and lap reached, the ascension it was run at, the clears, and what went into
// the Vault — not a re-derivation. The score is the live view's (RunResult
// carries no score; DESIGN.md → Score: "shown on the victory and death
// screens ... never lost on death").
//
// The crypt stays on screen behind it: main.ts's shared scene pass, then
// dimScene (the engine's terminal-screen overlay — GAME_OVER / WIN / PAUSED —
// which keeps the world readable as context), then HUD text and one plate.
// No bitmap text here: a verdict is something the player READS, so it renders
// in the HUD face like every other UI line.

import type { Audio, HitRegions, Input, Light, LightActor, PixelCanvas } from '../../engine';
import { PICO8, dimScene } from '../../engine';
import { CANVAS_W, CANVAS_H, CONTINUE, HUD_LARGE, HUD_PX, HUD_SMALL, safeInsetFor } from './layout';
import { ACTS, VAULT_SIZE } from '../types';
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
 * The whole party stands in the frame the player screenshots (UI item 10),
 * the survivors in idle and the fallen in their dead poses since UI round 4. They
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
/** The act-clear beat's dim: lighter than a terminal screen's, because the run goes on. */
const BEAT_DIM = 0.38;
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
  /** GAME_OVER's RETRY: a fresh run (the Vault face first, when there is anything in it to choose). */
  onRetry: () => void;
  /** VICTORY's CONTINUE: the same — the Vault has just been rewritten with what this run banked. */
  onContinue: () => void;
}

export interface EndScreen {
  update(dt: number, run: RunScreen): void;
  render(time: number, run: RunScreen): void;
  /**
   * THE ACT-CLEAR BEAT (composition round-4 item 6). Clearing an act cut
   * straight from the boss's reward card to the next act's map; this is the
   * held frame in between — the party standing in the biome they just took,
   * under the same warm pool the end screens use, over a lighter dim. It asks
   * nothing: A, B or a tap anywhere goes on, and it goes on by itself after
   * `ACT_CLEAR_HOLD` so no screen can swallow a run.
   */
  updateActClear(dt: number, run: RunScreen): void;
  renderActClear(time: number, run: RunScreen): void;
}

/** How long the act-clear beat holds before it walks on by itself. */
export const ACT_CLEAR_HOLD = 3.4;
/** How much of the beat's length is the read-in fade — the rest is the held frame. */
const ACT_CLEAR_FADE = 0.35;

export function createEndScreen(deps: EndScreenDeps): EndScreen {
  const { pc, input, regions, audio, light, scene, onRetry, onContinue } = deps;
  /**
   * The survivors. Three records are allocated once and rewritten in place each
   * frame — `castN` is how many of them are live this frame — so the end screen
   * allocates nothing per frame, exactly like the battle's light-actor pool.
   */
  interface CastMember {
    recipe: ActorRecipe; element: ActorDrawState['element']; x: number; y: number; span: number;
    pose: ActorDrawState['pose'];
  }
  const cast: CastMember[] = CAST_FEET.map((f) => ({ recipe: ACTOR_RECIPES.EMBER, element: 'FIRE', x: f.x, y: f.y, span: 0, pose: 'idle' }));
  let castN = 0;
  let castTime = 0;

  const drawCast = (): void => {
    const ctx = pc.ctx;
    for (let i = 0; i < castN; i++) light.drawContactShadow(ctx, cast[i].x, cast[i].y, cast[i].span);
    for (let i = 0; i < castN; i++) {
      const c = cast[i];
      castPose.time = castTime;
      castPose.pose = c.pose;
      castPose.element = c.element;
      castPose.x = c.x;
      castPose.y = c.y;
      drawActor(ctx, c.recipe, castPose);
    }
  };

  /** Seconds the act-clear beat has been on screen; -1 while it is not up. */
  let beatAge = -1;

  /** Fill the cast records from the party — survivors idling, the fallen in their dead pose. */
  function buildCast(s: { party: { members: readonly { hp: number; def: { id: string; element: string } }[] } }): void {
    castN = 0;
    for (const m of s.party.members) {
      if (castN >= CAST_FEET.length) continue;
      const recipe = ACTOR_RECIPES[m.def.id];
      if (!recipe) continue;
      const f = CAST_FEET[castN];
      const c = cast[castN];
      c.recipe = recipe;
      c.element = m.def.element as ActorDrawState['element'];
      c.pose = m.hp <= 0 ? 'dead' : 'idle';
      c.x = f.x;
      c.y = f.y;
      c.span = actorHitRect(recipe, f.x, f.y).w;
      castLightPool[castN].x = f.x - ACTOR_W / 2;
      castLightPool[castN].y = f.y - ACTOR_W * 0.88;
      castLights[castN] = castLightPool[castN];
      castN += 1;
    }
    castLights.length = castN;
  }

  /** The warm pool laid back over the dim so the party reads as lit under it. */
  function layKeyPool(ctx: CanvasRenderingContext2D): void {
    if (!castN) return;
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

  return {
    updateActClear(dt, run) {
      if (beatAge < 0) beatAge = 0;
      beatAge += dt;
      regions.begin();
      // ONE full-canvas target: the beat is a frame to look at, not a choice, so
      // there is nowhere on it that does not go on. Keyboard parity comes free —
      // it is the only region, so it holds focus and A activates it.
      regions.add('act-clear', 0, 0, CANVAS_W, CANVAS_H, { index: 0 });
      regions.end();
      const skipped = regions.activated() === 'act-clear' || input.pressed('B');
      if (skipped || beatAge >= ACT_CLEAR_HOLD) {
        if (skipped) audio.play('blip');
        beatAge = -1;
        run.clearAct();
      }
      input.endFrame();
    },

    renderActClear(time, run) {
      const ctx = pc.ctx;
      const s = run.state();
      castTime = time;
      buildCast(s);
      scene(castN ? drawCast : undefined, castLights);
      // A LIGHTER dim than a terminal screen's: the act is over, the run is not.
      dimScene(pc, BEAT_DIM);
      layKeyPool(ctx);

      const t = beatAge < 0 ? 1 : Math.min(1, beatAge / ACT_CLEAR_FADE);
      ctx.save();
      ctx.globalAlpha = t;
      hudTextCentered(ctx, `ACT ${s.actCleared} CLEARED`, 0, VERDICT_Y - 40, CANVAS_W, VERDICT_PX,
        { px: VERDICT_PX, weight: 200, color: ACCENT });
      hudTextCentered(ctx, s.actClearedBiome.toUpperCase(), 0, VERDICT_Y + 34, CANVAS_W, HUD_LARGE,
        { px: HUD_LARGE, color: C_TEXT });
      hudTextCentered(ctx, `SCORE ${Math.round(s.score)}   .   ${s.roomsCleared} ROOMS`, 0, VERDICT_Y + 74, CANVAS_W, HUD_PX,
        { color: C_DIM });
      ctx.restore();
      const inset = safeInsetFor(pc);
      hudTextCentered(ctx, 'A or a tap goes on', 0, pc.height - inset.bottom - 18, CANVAS_W, HUD_SMALL,
        { px: HUD_SMALL, color: C_DIM });
    },

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

      // THE WHOLE PARTY IS IN THE FRAME, however the run ended (composition
      // round-4 item 5). The screen used to draw only survivors, so a GAME OVER
      // — which by definition has none — was four centred lines and a button
      // over bare ground measuring p50 15.8 at the seats where the party would
      // stand. The fallen take the same three seats in their DEAD pose, under
      // the same warm pool the win screen lays back over the dim, so the last
      // frame of a run is the party that lost it rather than an empty stage.
      castTime = time;
      buildCast(s);
      scene(castN ? drawCast : undefined, castLights);

      // The terminal-screen overlay: the crypt stays visible under it.
      dimScene(pc, CAST_DIM);
      layKeyPool(ctx);

      // The run's own report, not a second count of it.
      const res = run.result();
      const act = res ? res.actReached : 1;
      const lap = res ? res.lap : 1;
      const asc = res ? res.ascension : 0;
      const summary = `ACT ${act} OF ${ACTS}   LAP ${lap}   A${asc}   SCORE ${s.score}`;
      hudTextCentered(ctx, summary, 0, SUMMARY_Y, CANVAS_W, HUD_PX, { color: C_DIM });
      const verdict = won ? 'VICTORY' : 'GAME OVER';
      const vw = hudWidth(ctx, verdict, VERDICT_PX, 200);
      hudText(ctx, verdict, (CANVAS_W - vw) / 2, VERDICT_Y, { px: VERDICT_PX, weight: 200, color: accent });
      // RETREAT is screens/run.ts's own sentinel for a mid-battle QUIT (screens/battle.ts's `forfeit`
      // tag, which run.ts turns into a loss) — a player who walked away was not slain by anything and
      // reads that line oddly credited to the pack they were fighting, so it gets its own line.
      const verdictLine = won
        ? lap > 1 ? `YOU DESCENDED AFTER ${lap} LAPS` : 'YOU DESCENDED'
        : s.deathBy === 'RETREAT' ? 'YOU RETREATED' : `SLAIN BY ${s.deathBy.toUpperCase()}`;
      hudTextCentered(ctx, verdictLine, 0, LINE_Y, CANVAS_W, HUD_LARGE, {
        px: HUD_LARGE, color: C_TEXT,
      });
      const rooms = res ? res.rooms.length : s.roomsCleared;
      const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
      const sub = res
        ? `${plural(rooms, 'ROOM', 'ROOMS')}   ${plural(res.clears, 'CLEAR', 'CLEARS')}   ${plural(res.actsCleared, 'BOSS', 'BOSSES')}   VAULT ${res.banked.length} / ${VAULT_SIZE}`
        : plural(rooms, 'ROOM', 'ROOMS');
      hudTextCentered(ctx, sub, 0, SUB_Y, CANVAS_W, HUD_SMALL, {
        px: HUD_SMALL, color: C_DIM,
      });

      // The screen's one action, in the ONE gold every primary in the game
      // wears. The verdict's own colour lives in the WORD above — VICTORY amber,
      // GAME OVER in the debuff rose — not in the button's plate: a red slab and
      // a gold slab doing the same job on two ends of one run was the last of
      // the three-hue title system (UI item 3).
      drawPrimaryButton(ctx, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, won ? 'CONTINUE' : 'RETRY',
        regions.focused() === 'end-continue', regions.pressing() === 'end-continue');
    },
  };
}
