export type AmbientPreset = 'stars' | 'rain' | 'snow' | 'embers' | 'bubbles';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  life: number;
  maxLife: number;
  seed: number;
  rate: number;
  base: number;
  amp: number;
  sharp: number;
  wob: number;
  wobRate: number;
  gloss: string;
}

export interface BurstOptions {
  count?: number;
  color?: string;
  speed?: number;
  life?: number;
}

export interface ParticleSystem {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  burst(x: number, y: number, opts?: BurstOptions): void;
  setAmbient(preset: AmbientPreset | null, color?: string): void;
}

export interface ParticleOptions {
  width: number;
  height: number;
  ambient?: AmbientPreset | null;
  ambientCount?: number;
  ambientColor?: string;
}
const TAU = Math.PI * 2;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
function shade(hex: string, f: number): string {
  const h = hex.replace('#', '');
  let out = '#';
  for (let i = 0; i < 3; i++) {
    const v = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(i * 2, i * 2 + 2), 16) * f)));
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}
export function createParticles(opts: ParticleOptions): ParticleSystem {
  const { width, height } = opts;
  const ambientCount = opts.ambientCount ?? 48;
  let ambientPreset: AmbientPreset | null = opts.ambient ?? null;
  let ambientColor: string | undefined = opts.ambientColor;
  let ambient: Particle[] = [];
  const transient: Particle[] = [];
  let clock = 0;

  const AMBIENT_COLOR: Record<AmbientPreset, string> = {
    stars: '#45413F',
    rain: '#104668',
    snow: '#3B444C',
    embers: '#5C3B00',
    bubbles: '#453F53',
  };
  const FAR = 0.85;
  const NEAR = 1.1;

  const SPARK = 1.15;
  const GLOSS = 1.15;
  function spawnAmbient(preset: AmbientPreset, d: number, x: number, y: number, gloss = false): Particle {
    const c = ambientColor ?? AMBIENT_COLOR[preset];
    const tone = d === 0 ? shade(c, FAR) : d === 1 ? c : d === 2 ? shade(c, NEAR) : shade(c, SPARK);

    const z = d === 3 ? 0.7 : d / 2;
    const p: Particle = {
      x, y, vx: 0, vy: 0,
      w: d === 2 ? 2 : 1,
      h: d === 2 ? 2 : 1,
      color: tone,
      life: Infinity,
      maxLife: Infinity,
      seed: rand(0, TAU),
      rate: rand(0.6, 1.8),
      base: 0.92,
      amp: 0.08,
      sharp: 1,
      wob: 0,
      wobRate: rand(0.5, 1.4),
      gloss: '',
    };
    switch (preset) {
      case 'stars':
        p.vy = rand(1.5, 5) + z * 7;
        if (d === 3) {
          p.w = 1;
          p.h = 1;
          p.base = 0.6;
          p.amp = 0.4;
          p.rate = rand(1.1, 2.4);
        } else if (d === 2) {
          p.base = 0.82;
          p.amp = 0.18;
        } else if (d === 0) {
          p.base = 0.88;
          p.amp = 0.12;
        }
        break;
      case 'rain':
        p.w = 1;
        p.h = d >= 2 ? 3 : 2;
        p.vx = -22 - z * 22;
        p.vy = 130 + z * 130;
        p.base = 1;
        p.amp = 0;
        break;
      case 'snow':
        p.vy = 10 + z * 26;
        p.wob = 1 + z * 2;
        p.wobRate = rand(0.4, 1.1);
        p.base = 0.88;
        p.amp = 0.12;
        break;
      case 'embers':
        p.vy = -(14 + z * 34);
        p.vx = rand(-5, 5);
        p.wob = 1 + z * 2;
        p.wobRate = rand(0.6, 1.6);
        p.sharp = 3;
        if (d === 3) {
          p.w = 1;
          p.h = 1;
          p.base = 0.5;
          p.amp = 0.5;
          p.rate = rand(1.0, 2.2);
        } else {
          p.base = 0.85;
          p.amp = 0.15;
          p.rate = rand(0.5, 1.4);
        }
        break;
      case 'bubbles':
        p.vy = -(8 + z * 24);
        p.vx = rand(-3, 3);
        p.wob = 1.5 + z * 2.5;
        p.wobRate = rand(0.5, 1.3);
        p.base = 0.9;
        p.amp = 0.1;
        if (d === 2 && gloss) {p.gloss = shade(c, GLOSS);}
        break;
    }
    return p;
  }
  function rebuildAmbient(): void {
    ambient = [];
    if (!ambientPreset) {return;}
    const preset = ambientPreset;
    const sparks = preset === 'stars' || preset === 'embers';

    const clumps = preset !== 'rain';
    const rising = preset === 'embers' || preset === 'bubbles';
    let cx = rand(0, width);
    let cy = rand(0, height);
    for (let i = 0; i < ambientCount; i++) {
      const r = i / ambientCount;
      let d = r < 0.5 ? 0 : r < 0.82 ? 1 : 2;
      if (sparks && i % 17 === 5) {d = 3;}
      let x: number;
      let y: number;
      if (clumps) {
        if (i % 4 === 0) {
          cx = rand(0, width);
          cy = rand(0, height);
          x = cx;
          y = cy;
        } else {
          const sx = rising ? 6 + d * 3 : 14 + d * 10;
          const sy = rising ? height * 0.45 : 14 + d * 10;
          x = (cx + rand(-sx, sx) + width) % width;
          y = (cy + rand(-sy, sy) + height) % height;
        }
      } else {
        x = rand(0, width);
        y = rand(0, height);
      }
      ambient.push(spawnAmbient(preset, d, x, y, i % 2 === 0));
    }
  }
  rebuildAmbient();
  function wrap(p: Particle): void {
    if (p.x < -4) {p.x = width + 4;}
    else if (p.x > width + 4) {p.x = -4;}
    if (p.y < -4) {p.y = height + 4;}
    else if (p.y > height + 4) {p.y = -4;}
  }
  return {
    update(dt) {
      clock += dt;
      for (const p of ambient) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        wrap(p);
      }
      for (let i = transient.length - 1; i >= 0; i--) {
        const p = transient[i];
        p.life -= dt;
        if (p.life <= 0) {
          transient.splice(i, 1);
          continue;
        }
        p.vy += 140 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    render(ctx) {
      for (const p of ambient) {
        let u = 0.5 + 0.5 * Math.sin(clock * p.rate + p.seed);
        if (p.sharp !== 1) {u = u ** p.sharp;}
        const a = p.base + p.amp * u;
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillStyle = p.color;
        const x = Math.round(p.x + (p.wob === 0 ? 0 : p.wob * Math.sin(clock * p.wobRate + p.seed)));
        const y = Math.round(p.y);
        ctx.fillRect(x, y, p.w, p.h);
        if (p.gloss !== '') {
          ctx.fillStyle = p.gloss;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      for (const p of transient) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, p.h);
      }
      ctx.globalAlpha = 1;
    },
    burst(x, y, o = {}) {
      const count = o.count ?? 8;
      const color = o.color ?? '#FFEC27';
      const speed = o.speed ?? 90;
      const life = o.life ?? 0.5;
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const s = speed * rand(0.4, 1);
        const size = Math.random() < 0.5 ? 2 : 3;
        transient.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          w: size,
          h: size,
          color,
          life,
          maxLife: life,
          seed: 0, rate: 0, base: 1, amp: 0, sharp: 1, wob: 0, wobRate: 0, gloss: '',
        });
      }
    },
    setAmbient(preset, color) {
      ambientPreset = preset;
      if (color !== undefined) {ambientColor = color;}
      rebuildAmbient();
    },
  };
}