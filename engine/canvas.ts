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
  if (!Number.isInteger(scale) || scale < 1) {throw new RangeError(`createPixelCanvas: scale must be a positive integer, got ${String(scale)}`);}
  return scale;
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

const MAX_BACKING_SCALE = 6;

export interface DisplayFit {
  readonly backing: number;
  readonly display: number;
}

function enlargedFit(whole: number, maxBacking: number): DisplayFit {
  const minBacking = Math.ceil(maxBacking / 2);
  for (let display = whole; display > maxBacking; display--) {
    for (let backing = maxBacking; backing >= minBacking; backing--) {
      if (display % backing === 0) {return { backing, display };}
    }
  }
  return { backing: maxBacking, display: maxBacking };
}

export function fitDisplay(logical: FitArea, area: FitArea, maxBacking = MAX_BACKING_SCALE): DisplayFit {
  const ratio = Math.min(area.width / logical.width, area.height / logical.height);
  const fit = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const cap = Math.max(1, Math.floor(maxBacking));
  if (fit < 1) {return { backing: 1, display: fit };}
  const whole = Math.floor(fit);
  return whole <= cap ? { backing: whole, display: whole } : enlargedFit(whole, cap);
}

export function autoFit(pc: PixelCanvas, available: () => FitArea, maxBacking = MAX_BACKING_SCALE): () => void {
  const refit = (): void => {
    const fit = fitDisplay(pc, available(), maxBacking);
    pc.resize(fit.backing);
    pc.canvas.style.width = `${String(pc.width * fit.display)}px`;
    pc.canvas.style.height = `${String(pc.height * fit.display)}px`;
  };
  refit();
  window.addEventListener('resize', refit);
  return () => {
    window.removeEventListener('resize', refit);
    pc.canvas.style.width = '';
    pc.canvas.style.height = '';
  };
}
