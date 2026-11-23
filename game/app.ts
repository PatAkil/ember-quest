import {
  createPixelCanvas, autoFit, createInput, createScenes, createParticles, createJuice, createAudio, createCrt, createRuntime,
} from '../engine';
import type { FitArea, PixelCanvas } from '../engine';
import { W, H } from './theme';

const HOLD_SCALE = 3;

function px(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function shellChrome(shell: HTMLElement, canvas: HTMLCanvasElement): FitArea {
  const style = getComputedStyle(shell);
  const kids = Array.from(shell.children).filter((el): el is HTMLElement => el instanceof HTMLElement);
  const stacked = kids.reduce((sum, el) => sum + el.offsetHeight, 0) + px(style.rowGap) * Math.max(0, kids.length - 1);
  const widest = kids.reduce((most, el) => (el.contains(canvas) ? Math.max(most, el.offsetWidth) : most), canvas.offsetWidth);
  return {
    width: widest - canvas.offsetWidth + px(style.paddingLeft) + px(style.paddingRight),
    height: stacked - canvas.offsetHeight + px(style.paddingTop) + px(style.paddingBottom),
  };
}

function viewportArea(pc: PixelCanvas): FitArea {
  const shell = document.getElementById('cabinet');
  const chrome = shell ? shellChrome(shell, pc.canvas) : { width: 0, height: 0 };
  return { width: window.innerWidth - chrome.width, height: window.innerHeight - chrome.height };
}

function mountCanvas(fixedScale: boolean): PixelCanvas {
  const pc = createPixelCanvas({ width: W, height: H, scale: HOLD_SCALE, parent: document.getElementById('screen') });
  if (!fixedScale) {autoFit(pc, () => viewportArea(pc));}
  return pc;
}

export function createApp(fixedScale = false) {
  const pc = mountCanvas(fixedScale);
  const audio = createAudio();
  const input = createInput(
    [{ button: 'A', label: 'select' }, { button: 'PAUSE', label: 'pause' }],
    { onFirstKey: () => { audio.unlock(); } },
  );
  const scenes = createScenes();
  const particles = createParticles({ width: W, height: H, ambient: 'embers' });
  const juice = createJuice();
  const crt = createCrt();
  const runtime = createRuntime();
  return { pc, audio, input, scenes, particles, juice, crt, runtime };
}

export type App = ReturnType<typeof createApp>;
