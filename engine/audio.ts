// audio.ts — WebAudio chiptune synth. Zero asset files; every sound is
// generated from oscillators/noise on the fly.
//
// Autoplay policy is handled BY DESIGN: the AudioContext is NOT created at
// module load. It is created/resumed lazily inside unlock(), which input.ts
// calls from the first keydown or tap (DESIGN.md → Input: "Audio unlocks on
// the first key or the first tap"). play() before unlock() is a silent no-op.
//
// Signal chain: every generator connects into one `master` GainNode (the
// public volume/mute control) → one `limiter` WaveShaperNode (a static
// soft-knee curve — see buildLimiterCurve — so a handful of sounds landing in
// the same frame, an AOE hit or a crit stacked on a death flash, round off
// toward ±1 instead of clipping) → destination. A WaveShaperNode was chosen
// over DynamicsCompressorNode deliberately: a time-based compressor's
// attack/release reacts to the BROADBAND ENERGY of a fast chiptune envelope's
// own decay (not just its peak sample), so it was measured clamping ordinary
// one-shot sounds to a quarter of their designed level; a static per-sample
// curve has no attack/release to mistune and is fully transparent below its
// threshold regardless of how sharply a sound decays. The shared noise buffer
// (white noise, read at a random offset per burst so repeats don't sound
// identical) is created once, alongside the context, in unlock().
//
// A per-name cooldown (COOLDOWN_DEFAULT, overridden per name below) drops a
// play() call that lands too soon after the last one for the SAME name, so a
// spray of same-frame calls (three AOE targets, a key held on a menu) can't
// stack into a buzz — it silently skips rather than queuing.

/**
 * Canonical sound names, plus four legacy aliases kept so old call sites —
 * `jump` / `pickup` / `explosion` / `blip` — keep resolving to a real sound
 * unchanged:
 *   pickup    → heal       both were already "a rising, good-news chime"
 *   blip      → ui         both were the generic menu/confirm click
 *   explosion → death      the old explosion literally WAS a falling sweep + noise
 *   jump      → confirm    an upward, affirmative blip; Ember Quest has no jump
 */
export type Sfx =
  | 'hit' | 'magic' | 'crit' | 'glance' | 'burn' | 'heal' | 'shield'
  | 'debuff' | 'buff' | 'death' | 'enemyDeath' | 'turn' | 'skill' | 'target'
  | 'ui' | 'confirm' | 'cancel' | 'card' | 'equip' | 'skip'
  | 'win' | 'lose' | 'boss' | 'enrage'
  | 'jump' | 'pickup' | 'explosion' | 'blip';

type CanonicalSfx = Exclude<Sfx, 'jump' | 'pickup' | 'explosion' | 'blip'>;

const ALIAS: Record<'jump' | 'pickup' | 'explosion' | 'blip', CanonicalSfx> = {
  pickup: 'heal',
  blip: 'ui',
  explosion: 'death',
  jump: 'confirm',
};

export interface Audio {
  readonly ready: boolean;
  /** Create/resume the AudioContext. MUST be called inside a user gesture. */
  unlock(): void;
  play(sfx: Sfx, opts?: { pitch?: number; gain?: number }): void;
  /** 0..1 master volume. Independent of mute() — muting keeps the level, just silences it. */
  setVolume(v: number): void;
  mute(muted: boolean): void;
}

type Ctx = AudioContext;

// -------------------------------------------------------------- tuning ----
const STOP_PAD = 0.02; // seconds past a node's envelope end before .stop() — never audible, just headroom
const NOISE_BUFFER_SECONDS = 1.0;
const COOLDOWN_DEFAULT = 0.045;
/** Per-name floor between repeats; anything not listed uses COOLDOWN_DEFAULT. */
const COOLDOWN: Partial<Record<CanonicalSfx, number>> = {
  crit: 0.15,
  death: 0.2,
  enemyDeath: 0.2,
  boss: 0.4,
  enrage: 0.25,
  win: 0.4,
  lose: 0.4,
  heal: 0.08,
  shield: 0.1,
  burn: 0.1,
  turn: 0.12,
};

// Arpeggio ratios (semitone-accurate, root = 1): reused by heal/win/lose so
// the three "phrase" sounds share one derivation instead of three ad-hoc lists.
const HEAL_RATIOS: readonly number[] = [1, 1.26, 1.5, 2]; // root · maj3 · 5th · octave, rising
const WIN_RATIOS: readonly number[] = [1, 1.26, 1.5, 2, 2.52]; // + a high flourish note
const LOSE_RATIOS: readonly number[] = [1, 0.891, 0.749, 0.5]; // root · -2 semi · -5 semi · octave down

// Below LIMITER_THRESHOLD the curve is the identity (y = x): every sound here was
// designed to peak well under it, so normal play is untouched. Above it, excess
// eases toward ±1 via tanh — a hard sum from a pileup rounds off, it never clips.
const LIMITER_THRESHOLD = 0.7;
const LIMITER_CURVE_POINTS = 2048;
function buildLimiterCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(LIMITER_CURVE_POINTS);
  for (let i = 0; i < LIMITER_CURVE_POINTS; i++) {
    const x = (i / (LIMITER_CURVE_POINTS - 1)) * 2 - 1;
    const ax = Math.abs(x);
    if (ax <= LIMITER_THRESHOLD) {
      curve[i] = x;
    } else {
      const t = (ax - LIMITER_THRESHOLD) / (1 - LIMITER_THRESHOLD);
      curve[i] = Math.sign(x) * (LIMITER_THRESHOLD + (1 - LIMITER_THRESHOLD) * Math.tanh(t));
    }
  }
  return curve;
}

export function createAudio(): Audio {
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let limiter: WaveShaperNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let volume = 1;
  let muted = false;
  const lastPlayed: Partial<Record<CanonicalSfx, number>> = {};

  function applyMasterGain(): void {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.01);
  }

  // ---------------------------------------------------------- primitives --
  /** An enveloped oscillator. `endFreq` (defaults to `freq`, i.e. no sweep) ramps
   * exponentially; `attack` (default 0) is an instant chiptune pluck unless given. */
  function tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    when: number,
    vol: number,
    endFreq: number = freq,
    attack = 0,
  ): void {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const v = Math.max(0.0002, vol);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
    if (attack > 0) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + attack);
    } else {
      g.gain.setValueAtTime(v, t0);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + STOP_PAD);
  }

  /** A filtered burst from the shared noise buffer, read at a random offset each
   * time so repeated bursts (a crackle's five ticks) don't sound identical. */
  function noiseHit(
    dur: number,
    when: number,
    vol: number,
    freq0: number,
    freq1: number = freq0,
    filterType: BiquadFilterType = 'lowpass',
    q = 1,
  ): void {
    if (!ctx || !master || !noiseBuffer) return;
    const t0 = ctx.currentTime + when;
    const v = Math.max(0.0002, vol);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const span = noiseBuffer.duration - dur;
    const offset = span > 0 ? Math.random() * span : 0;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType;
    filt.Q.value = q;
    filt.frequency.setValueAtTime(Math.max(20, freq0), t0);
    if (freq1 !== freq0) filt.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(master);
    src.start(t0, offset, dur);
  }

  /** A sine tracked by a same-frequency high-Q bandpass — "bandpass" is unity gain
   * at its own centre, so this rings a touch (via Q) without ever muting the tone. */
  function shieldTone(freq: number, dur: number, when: number, vol: number, q: number): void {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + when;
    const v = Math.max(0.0002, vol);
    const endFreq = freq * 1.08;
    const o = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    o.frequency.linearRampToValueAtTime(endFreq, t0 + dur);
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(freq, t0);
    filt.frequency.linearRampToValueAtTime(endFreq, t0 + dur);
    filt.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(filt).connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + STOP_PAD);
  }

  // -------------------------------------------------------- the sound set --
  // Every generator takes (pitch, gain) — a frequency multiplier and a linear
  // volume multiplier, both already validated by play() before dispatch.
  function sHit(p: number, g: number): void {
    tone(190 * p, 0.09, 'triangle', 0, 0.34 * g, 65 * p);
    noiseHit(0.05, 0, 0.3 * g, 1100, 160);
  }
  function sMagic(p: number, g: number): void {
    tone(560 * p, 0.13, 'sine', 0, 0.3 * g, 1500 * p);
    tone(1400 * p, 0.07, 'triangle', 0.015, 0.16 * g, 2100 * p);
  }
  function sCrit(p: number, g: number): void {
    noiseHit(0.06, 0, 0.32 * g, 1800, 180);
    tone(210 * p, 0.11, 'square', 0, 0.32 * g, 60 * p);
    tone(340 * p, 0.24, 'sawtooth', 0.02, 0.24 * g, 1200 * p);
    noiseHit(0.24, 0.06, 0.18 * g, 2600, 260, 'bandpass', 2);
  }
  function sGlance(p: number, g: number): void {
    // Low + short: chosen for a "dull damped tap" character, but that combination means
    // the envelope's own decay (time constant = dur/8) is fast relative to the wave's own
    // period — the wave never reaches full swing before it's already decaying, so `vol`
    // has to run well above the target perceptual level to still land there in practice.
    tone(160 * p, 0.06, 'triangle', 0, 0.34 * g, 100 * p);
    noiseHit(0.045, 0, 0.22 * g, 320, 110);
  }
  function sBurn(p: number, g: number): void {
    // A narrow bandpass only keeps a sliver of the noise buffer's energy, and that
    // sliver's own envelope fluctuates randomly (narrowband noise beats like a wobbly
    // tone) — over one ~45ms tick it can legitimately roll quiet. A highpass keeps most
    // of the buffer's energy (everything above the cutoff) so each tick's peak is far
    // more reliable, while a per-tick randomized, rising cutoff still gives the bright,
    // thin, spitting character of a crackle rather than a dull thud.
    const n = 5;
    for (let i = 0; i < n; i++) {
      const when = (i / n) * 0.3 + Math.random() * 0.02;
      const f = (900 + Math.random() * 1800) * p;
      noiseHit(0.045, when, (0.34 - i * 0.025) * g, f, f * 1.4, 'highpass', 1);
    }
  }
  function sHeal(p: number, g: number): void {
    for (let i = 0; i < HEAL_RATIOS.length; i++) {
      tone(523 * HEAL_RATIOS[i] * p, 0.16, 'triangle', i * 0.055, 0.26 * g, undefined, 0.015);
    }
  }
  function sShield(p: number, g: number): void {
    shieldTone(300 * p, 0.32, 0, 0.3 * g, 7);
  }
  function sDebuff(p: number, g: number): void {
    tone(520 * p, 0.1, 'square', 0, 0.3 * g, 300 * p);
  }
  function sBuff(p: number, g: number): void {
    tone(420 * p, 0.1, 'square', 0, 0.3 * g, 700 * p);
  }
  function sDeath(p: number, g: number): void {
    tone(300 * p, 0.32, 'sawtooth', 0, 0.32 * g, 34 * p);
    noiseHit(0.33, 0.02, 0.28 * g, 1500, 110);
  }
  function sEnemyDeath(p: number, g: number): void {
    // Same shape as death, darker: lower body, triangle instead of sawtooth (duller
    // edge), and the noise sweep stays low instead of starting bright.
    tone(190 * p, 0.32, 'triangle', 0, 0.32 * g, 26 * p);
    noiseHit(0.33, 0.02, 0.28 * g, 700, 70);
  }
  function sTurn(p: number, g: number): void {
    tone(880 * p, 0.05, 'triangle', 0, 0.3 * g);
    tone(1320 * p, 0.05, 'triangle', 0.035, 0.2 * g);
  }
  function sSkill(p: number, g: number): void {
    tone(740 * p, 0.06, 'square', 0, 0.3 * g);
  }
  function sTarget(p: number, g: number): void {
    // Lighter than `skill` in timbre (sine, brief, high) as well as level.
    tone(1000 * p, 0.04, 'sine', 0, 0.28 * g);
  }
  function sUi(p: number, g: number): void {
    tone(660 * p, 0.045, 'square', 0, 0.3 * g);
  }
  function sConfirm(p: number, g: number): void {
    tone(500 * p, 0.09, 'triangle', 0, 0.3 * g, 780 * p);
  }
  function sCancel(p: number, g: number): void {
    tone(480 * p, 0.09, 'triangle', 0, 0.3 * g, 260 * p);
  }
  function sCard(p: number, g: number): void {
    tone(700 * p, 0.06, 'triangle', 0, 0.32 * g);
    noiseHit(0.03, 0, 0.12 * g, 3200, 1800);
  }
  function sEquip(p: number, g: number): void {
    tone(240 * p, 0.14, 'square', 0, 0.3 * g);
    tone(900 * p, 0.05, 'triangle', 0.03, 0.18 * g);
  }
  function sSkip(p: number, g: number): void {
    tone(850 * p, 0.055, 'sine', 0, 0.3 * g, 1150 * p);
  }
  function sWin(p: number, g: number): void {
    for (let i = 0; i < WIN_RATIOS.length; i++) {
      tone(523 * WIN_RATIOS[i] * p, 0.14, 'square', i * 0.06, 0.24 * g, undefined, 0.01);
    }
  }
  function sLose(p: number, g: number): void {
    for (let i = 0; i < LOSE_RATIOS.length; i++) {
      tone(440 * LOSE_RATIOS[i] * p, 0.15, 'triangle', i * 0.065, 0.24 * g, undefined, 0.02);
    }
  }
  function sBoss(p: number, g: number): void {
    tone(55 * p, 0.34, 'sawtooth', 0, 0.3 * g, 42 * p, 0.02);
    tone(58 * p, 0.34, 'triangle', 0, 0.22 * g, 44 * p, 0.02); // slight detune for width
    noiseHit(0.12, 0, 0.24 * g, 300, 60);
  }
  function sEnrage(p: number, g: number): void {
    // A dissonant tritone, stabbed twice — a sharp, unambiguous "danger" cue.
    tone(440 * p, 0.1, 'sawtooth', 0, 0.26 * g, 415 * p);
    tone(622 * p, 0.1, 'sawtooth', 0, 0.22 * g, 587 * p);
    tone(440 * p, 0.09, 'sawtooth', 0.14, 0.24 * g, 415 * p);
    tone(622 * p, 0.09, 'sawtooth', 0.14, 0.2 * g, 587 * p);
  }

  const SOUND: Record<CanonicalSfx, (pitch: number, gain: number) => void> = {
    hit: sHit,
    magic: sMagic,
    crit: sCrit,
    glance: sGlance,
    burn: sBurn,
    heal: sHeal,
    shield: sShield,
    debuff: sDebuff,
    buff: sBuff,
    death: sDeath,
    enemyDeath: sEnemyDeath,
    turn: sTurn,
    skill: sSkill,
    target: sTarget,
    ui: sUi,
    confirm: sConfirm,
    cancel: sCancel,
    card: sCard,
    equip: sEquip,
    skip: sSkip,
    win: sWin,
    lose: sLose,
    boss: sBoss,
    enrage: sEnrage,
  };

  return {
    get ready() {
      return ctx !== null && ctx.state === 'running';
    },
    unlock() {
      try {
        if (!ctx) {
          ctx = new AudioContext();
          master = ctx.createGain();
          master.gain.value = muted ? 0 : volume;
          limiter = ctx.createWaveShaper();
          limiter.curve = buildLimiterCurve();
          limiter.oversample = 'none'; // a static per-sample curve needs no anti-aliasing help below threshold
          master.connect(limiter);
          limiter.connect(ctx.destination);

          const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS), ctx.sampleRate);
          const data = noise.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
          noiseBuffer = noise;
        }
        if (ctx.state === 'suspended') void ctx.resume();
      } catch {
        ctx = null;
        master = null;
        limiter = null;
        noiseBuffer = null;
      }
    },
    play(sfx, opts) {
      if (!ctx || !master || muted || ctx.state !== 'running') return;
      const canonical = ALIAS[sfx as 'jump' | 'pickup' | 'explosion' | 'blip'] ?? (sfx as CanonicalSfx);
      const now = ctx.currentTime;
      const cd = COOLDOWN[canonical] ?? COOLDOWN_DEFAULT;
      if (now - (lastPlayed[canonical] ?? -Infinity) < cd) return;
      lastPlayed[canonical] = now;
      const rawPitch = opts?.pitch;
      const rawGain = opts?.gain;
      const pitch = rawPitch !== undefined && isFinite(rawPitch) && rawPitch > 0 ? rawPitch : 1;
      const gain = rawGain !== undefined && isFinite(rawGain) && rawGain >= 0 ? rawGain : 1;
      SOUND[canonical](pitch, gain);
    },
    setVolume(v) {
      volume = v < 0 ? 0 : v > 1 ? 1 : v;
      applyMasterGain();
    },
    mute(m) {
      muted = m;
      applyMasterGain();
    },
  };
}
