export interface Crt {
  render(ctx: CanvasRenderingContext2D, width: number, height: number, dt: number): void;
}

export interface CrtOptions {
  scanlineAlpha?: number;
  vignetteAlpha?: number;
  flicker?: number;
  halation?: number;
  lift?: string;
}
const PHOSPHOR_LIFT = 'rgb(15,17,28)';
const HALATION_ALPHA = 0.09;
export function createCrt(opts: CrtOptions = {}): Crt {
  const scanlineAlpha = opts.scanlineAlpha ?? 0.09;
  const vignetteAlpha = opts.vignetteAlpha ?? 0.35;
  const flickerPeak = opts.flicker ?? 0.03;
  const halationAlpha = opts.halation ?? HALATION_ALPHA;
  const lift = opts.lift ?? PHOSPHOR_LIFT;

  const scanGrey = Math.max(0, Math.round(255 * (1 - scanlineAlpha)));
  const scanFill = `rgb(${scanGrey},${scanGrey},${scanGrey})`;
  let clock = 0;
  let grad: CanvasGradient | null = null;
  let gradW = -1;
  let gradH = -1;

  let snap: HTMLCanvasElement | null = null;
  let snapCtx: CanvasRenderingContext2D | null = null;
  function snapshot(source: HTMLCanvasElement): CanvasRenderingContext2D | null {
    if (!snap || snap.width !== source.width || snap.height !== source.height) {
      snap = document.createElement('canvas');
      snap.width = source.width;
      snap.height = source.height;
      snapCtx = snap.getContext('2d');
      if (snapCtx) {snapCtx.imageSmoothingEnabled = false;}
    }
    if (!snapCtx) {return null;}
    snapCtx.setTransform(1, 0, 0, 1, 0, 0);
    snapCtx.globalCompositeOperation = 'copy';
    snapCtx.drawImage(source, 0, 0);
    snapCtx.globalCompositeOperation = 'source-over';
    return snapCtx;
  }
  function vignette(ctx: CanvasRenderingContext2D, width: number, height: number): CanvasGradient {
    if (grad && gradW === width && gradH === height) {return grad;}
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.max(width, height) * 0.86;
    const g = ctx.createRadialGradient(cx, cy, outer * 0.42, cx, cy, outer);
    g.addColorStop(0, 'rgba(4,6,14,0)');

    g.addColorStop(0.62, `rgba(4,6,14,${(vignetteAlpha * 0.3).toFixed(4)})`);
    g.addColorStop(1, `rgba(4,6,14,${vignetteAlpha.toFixed(4)})`);
    grad = g;
    gradW = width;
    gradH = height;
    return g;
  }
  return {
    render(ctx, width, height, dt) {
      clock += dt;
      const canvas = ctx.canvas;

      if (halationAlpha > 0 && canvas.width > 0 && canvas.height > 0) {

        const src = snapshot(canvas);
        if (src) {
          const source = src.canvas;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = halationAlpha;
          const dw = canvas.width;
          const dh = canvas.height;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(source, 1, 0, dw - 1, dh, 0, 0, dw - 1, dh);
          ctx.drawImage(source, dw - 1, 0, 1, dh, dw - 1, 0, 1, dh);
          ctx.drawImage(source, 0, 0, dw - 1, dh, 1, 0, dw - 1, dh);
          ctx.drawImage(source, 0, 0, 1, dh, 0, 0, 1, dh);
          ctx.restore();
        }
      }
      if (lift !== '') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = lift;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      if (scanlineAlpha > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = scanFill;
        for (let y = 0; y < height; y += 2) {
          ctx.fillRect(0, y, width, 1);
        }
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = vignette(ctx, width, height);
      ctx.fillRect(0, 0, width, height);
      if (flickerPeak > 0) {
        const a = flickerPeak * (0.5 + 0.5 * Math.sin(clock * 40));
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    },
  };
}