// Tiny synthesized SFX (Web Audio) so the demo has sound without any audio files.
// The real game will use Howler.js + royalty-free/AI samples; this is just for feel.
type Kind = 'gun' | 'cannon' | 'laser' | 'rocket' | 'boom' | 'bigboom' | 'thunder' | 'alarm';

// D minor battle loop, 8 bars: Dm Bb F C | Dm Bb Gm A  (bass root, pad triad as MIDI notes)
const PROG: [number, number[]][] = [
  [38, [62, 65, 69]], [34, [58, 62, 65]], [41, [60, 65, 69]], [36, [60, 64, 67]],
  [38, [62, 65, 69]], [34, [58, 62, 65]], [31, [58, 62, 67]], [33, [57, 61, 64]],
];
const BASS_PATTERN = [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 7]; // semitones over root, per 16th
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private voices = 0;
  private last: Partial<Record<Kind, number>> = {};
  enabled = false;
  private musicGain!: GainNode;
  private musicOn = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  /** 0 = calm (pad + bass), 1 = all-out war (drums, arps, taiko hits). Set by the game. */
  intensity = 0.3;
  private readonly bpm = 132;

  enable(on: boolean) {
    this.enabled = on;
    if (on && !this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
    }
    if (on) this.ctx?.resume();
    this.setMusic(on);
  }

  // ---------------------------------------------------------------- music
  private setMusic(on: boolean) {
    if (!this.ctx || on === this.musicOn) return;
    this.musicOn = on;
    if (on) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
    } else if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const c = this.ctx!;
    const dur16 = 60 / this.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, dur16);
      this.step = (this.step + 1) % (16 * PROG.length);
      this.nextTime += dur16;
    }
  }

  private env(t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.musicGain);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, len: number, out: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, peak: number, decay: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f).connect(this.env(t, peak, 0.002, decay));
    src.start(t, Math.random());
    src.stop(t + decay + 0.05);
  }

  private playStep(step: number, t: number, d: number) {
    const c = this.ctx!;
    const I = this.intensity;
    const bar = Math.floor(step / 16) % PROG.length;
    const s = step % 16;
    const [root, chord] = PROG[bar];

    // pad: detuned saws through a lowpass that opens with intensity
    if (s === 0) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700 + I * 1600;
      lp.connect(this.env(t, 0.06, 0.25, d * 16));
      for (const n of chord) for (const dt of [-8, 8]) this.osc('sawtooth', midi(n), t, d * 16, lp, dt);
    }
    // bass: driving 16ths, gated by intensity
    if (I > 0.15 && (I > 0.5 || s % 2 === 0)) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300 + I * 500;
      lp.Q.value = 6;
      lp.connect(this.env(t, 0.22, 0.005, d * 0.9));
      this.osc('sawtooth', midi(root + BASS_PATTERN[s]), t, d, lp);
    }
    // kick
    if (I > 0.3 && (s % 4 === 0 || (I > 0.75 && s === 14))) {
      const o = this.osc('sine', 150, t, 0.25, this.env(t, 0.9, 0.002, 0.22));
      o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    }
    // snare (noise + body)
    if (I > 0.45 && (s === 4 || s === 12)) {
      this.noiseHit(t, 'bandpass', 1800, 0.45, 0.16);
      this.osc('triangle', 190, t, 0.1, this.env(t, 0.25, 0.002, 0.09));
    }
    // hats
    if (I > 0.2 && (s % 4 === 2 || (I > 0.6 && s % 2 === 1))) this.noiseHit(t, 'highpass', 7000, s % 4 === 2 ? 0.12 : 0.05, 0.04);
    // arpeggio lead
    if (I > 0.55) {
      const n = chord[[0, 1, 2, 1][s % 4]] + (s >= 8 ? 12 : 0);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2500;
      lp.connect(this.env(t, 0.045 + I * 0.03, 0.003, d * 0.8));
      this.osc('square', midi(n), t, d, lp);
    }
    // taiko + tom fill: the "something big is happening" layer
    if (I > 0.8) {
      if (s === 0 || s === 10) {
        const o = this.osc('sine', 90, t, 0.5, this.env(t, 0.8, 0.003, 0.45));
        o.frequency.exponentialRampToValueAtTime(45, t + 0.4);
        this.noiseHit(t, 'lowpass', 500, 0.3, 0.2);
      }
      if (bar === PROG.length - 1 && s >= 12) {
        const o = this.osc('sine', 220 - (s - 12) * 30, t, 0.15, this.env(t, 0.5, 0.002, 0.14));
        o.frequency.exponentialRampToValueAtTime(80, t + 0.14);
      }
    }
  }

  play(kind: Kind, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const minGap: Record<Kind, number> = { gun: 0.05, cannon: 0.08, laser: 0.06, rocket: 0.08, boom: 0.06, bigboom: 0.2, thunder: 0.5, alarm: 1 };
    if ((this.last[kind] ?? -1) > now - minGap[kind]) return; // rate-limit spam
    if (this.voices >= 16) return; // voice cap (PLAN.md budget)
    this.last[kind] = now;
    const c = this.ctx;
    const out = c.createGain();
    out.connect(this.master);
    this.voices++;
    const done = (t: number) => setTimeout(() => (this.voices--, out.disconnect()), t * 1000 + 50);

    const noise = (dur: number, type: BiquadFilterType, freq: number, gain: number, decay: number) => {
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 0.5 + Math.random();
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(gain * vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      src.connect(f).connect(g).connect(out);
      src.start(now, Math.random());
      src.stop(now + dur);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, gain: number) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, now);
      o.frequency.exponentialRampToValueAtTime(f1, now + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(gain * vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.connect(g).connect(out);
      o.start(now);
      o.stop(now + dur);
    };

    switch (kind) {
      case 'gun': noise(0.08, 'highpass', 1200, 0.25, 0.07); done(0.1); break;
      case 'cannon': noise(0.4, 'lowpass', 900, 0.8, 0.35); tone('sine', 120, 40, 0.3, 0.6); done(0.4); break;
      case 'laser': tone('sawtooth', 1800, 300, 0.12, 0.12); done(0.15); break;
      case 'rocket': noise(0.5, 'bandpass', 700, 0.35, 0.45); done(0.5); break;
      case 'boom': noise(0.12, 'highpass', 1800, 0.4, 0.1); noise(1, 'lowpass', 650, 1, 0.9); tone('sine', 110, 28, 0.6, 0.9); done(1); break;
      case 'bigboom': noise(0.25, 'highpass', 2500, 0.7, 0.2); noise(3.2, 'lowpass', 380, 1.3, 3); noise(3.2, 'lowpass', 120, 1, 3); tone('sine', 80, 18, 2, 1.2); tone('triangle', 55, 25, 1.2, 0.5); done(3.2); break;
      case 'thunder': noise(2.5, 'lowpass', 300, 1.1, 2.3); noise(0.15, 'highpass', 3000, 0.5, 0.12); done(2.5); break;
      case 'alarm': tone('square', 660, 440, 0.6, 0.15); done(0.6); break;
    }
  }
}
