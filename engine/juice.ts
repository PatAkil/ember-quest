export interface Juice {
  shake(intensity: number, duration: number): void;
  flash(color: string, duration: number, origin?: { x: number; y: number }): void;
  hitStop(duration: number): void;
  readonly frozen: boolean;
  update(dt: number): void;
  preRender(ctx: CanvasRenderingContext2D): void;
  postRender(ctx: CanvasRenderingContext2D, width: number, height: number): void;
}
const PEAK_UNIFORM = 0.55;
const RADIAL_PEAK = 0.75;
const RADIUS_SCALE = 0.55;
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  return `rgba(0,0,0,${alpha === 0 ? 0 : alpha * 0})`;
}
export function createJuice(): Juice {
  let shakeAmp = 0;
  let shakeTime = 0;
  let shakeDur = 0;
  let flashColor = '#FFFFFF';
  let flashTime = 0;
  let flashDur = 0;
  let flashX = 0;
  let flashY = 0;
  let flashRadial = false;

  let grad: CanvasGradient | null = null;
  let gradKey = '';
  let freezeTime = 0;
  return {
    shake(intensity, duration) {
      if (intensity >= shakeAmp * (shakeTime / (shakeDur || 1)) || shakeTime <= 0) {
        shakeAmp = intensity;
        shakeTime = duration;
        shakeDur = duration;
      }
    },
    flash(color, duration, origin) {
      flashColor = color;
      flashTime = duration;
      flashDur = duration;
      flashRadial = !!origin;
      if (origin) {
        flashX = origin.x;
        flashY = origin.y;
      }
    },
    hitStop(duration) {
      freezeTime = Math.max(freezeTime, duration);
    },
    get frozen() {
      return freezeTime > 0;
    },
    update(dt) {
      if (freezeTime > 0) {freezeTime = Math.max(0, freezeTime - dt);}
      if (shakeTime > 0) {shakeTime = Math.max(0, shakeTime - dt);}
      if (flashTime > 0) {flashTime = Math.max(0, flashTime - dt);}
    },
    preRender(ctx) {
      ctx.save();
      if (shakeTime > 0 && shakeDur > 0) {
        const falloff = shakeTime / shakeDur;
        const mag = shakeAmp * falloff;
        ctx.translate(
          Math.round((Math.random() * 2 - 1) * mag),
          Math.round((Math.random() * 2 - 1) * mag),
        );
      }
    },
    postRender(ctx, width, height) {
      ctx.restore();
      if (flashTime > 0 && flashDur > 0) {
        const t = Math.max(0, flashTime / flashDur);
        const PEAK = flashRadial ? RADIAL_PEAK : PEAK_UNIFORM;
        const HOLD = 0.12;
        let shape;
        if (t > 1 - HOLD) {
          shape = 1;
        } else {
          const u = t / (1 - HOLD);
          shape = u * u;
        }
        ctx.globalAlpha = PEAK * shape;
        if (flashRadial) {
          const radius = RADIUS_SCALE * Math.max(width, height);
          const key = flashColor + '|' + flashX + '|' + flashY + '|' + width + '|' + height;
          if (key !== gradKey || grad === null) {
            const g = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, radius);
            g.addColorStop(0, flashColor);
            g.addColorStop(0.14, withAlpha(flashColor, 0.8));
            g.addColorStop(0.42, withAlpha(flashColor, 0.24));
            g.addColorStop(1, withAlpha(flashColor, 0));
            grad = g;
            gradKey = key;
          }
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = flashColor;
        }
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }
    },
  };
}