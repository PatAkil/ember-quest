export interface PixelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  resize(scale: number): void;
  clear(color?: string): void;
}

export interface FitArea {
  width: number;
  height: number;
}

interface CreatePixelCanvasOptions {
  width: number;
  height: number;
  scale?: number;
  parent?: HTMLElement | null;
}

function applyScale(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, logical: FitArea, scale: number): void {
  canvas.width = logical.width * scale;
  canvas.height = logical.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function wholeScale(scale: number): number {
  if (!Number.isFinite(scale) || scale < 1) {throw new Error(`createPixelCanvas: scale must be a positive integer, got ${scale}`);}
  return Math.floor(scale);
}

export function createPixelCanvas(opts: CreatePixelCanvasOptions): PixelCanvas {
  if (opts.parent === null) {
    throw new Error(
      'createPixelCanvas: parent is null — mount point not found (check the id passed to getElementById against index.html)',
    );
  }
  const { width, height } = opts;
  const logical = { width, height };
  let scale = wholeScale(opts.scale ?? 3);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {throw new Error('2D canvas context unavailable');}
  applyScale(canvas, ctx, logical, scale);
  (opts.parent ?? document.body).appendChild(canvas);
  return {
    canvas,
    ctx,
    width,
    height,
    get scale() { return scale; },
    resize(next) {
      const whole = wholeScale(next);
      if (whole === scale) {return;}
      scale = whole;
      applyScale(canvas, ctx, logical, scale);
    },
    clear(color = '#000000') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    },
  };
}

export function fitScale(logical: FitArea, area: FitArea, minScale = 2): number {
  const fit = Math.floor(Math.min(area.width / logical.width, area.height / logical.height));
  return Math.max(minScale, Number.isFinite(fit) ? fit : minScale);
}

export function autoFit(pc: PixelCanvas, available: () => FitArea, minScale = 2): () => void {
  const refit = (): void => { pc.resize(fitScale(pc, available(), minScale)); };
  refit();
  window.addEventListener('resize', refit);
  return () => { window.removeEventListener('resize', refit); };
}
