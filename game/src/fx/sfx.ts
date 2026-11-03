// Synthesized sound design (Web Audio), no audio files needed.
// Every sound is layered like a real recording: transient crack + body + low-end sub + tail,
// through a shared distortion stage and a generated room/outdoor reverb, then a compressor and
// limiter so dozens of explosions never clip. Weather has its own looping ambience beds
// (rain, storm, blizzard wind, fog drone, gusts) that cross-fade when the weather changes.
type Kind = 'gun' | 'cannon' | 'laser' | 'rocket' | 'boom' | 'bigboom' | 'thunder' | 'alarm' | 'flak' | 'sniper' | 'flame' | 'drop';
export type Ambience = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind' | 'sandstorm' | 'heatwave' | 'emstorm';

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
  private sfxBus!: GainNode;
  private reverbSend!: GainNode;
  private drive!: WaveShaperNode;
  private noise!: AudioBuffer; // white
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;
  private voices = 0;
  private last: Partial<Record<Kind, number>> = {};
  enabled = false;
  private musicGain!: GainNode;
  private musicOn = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private amb: { key: Ambience; nodes: AudioScheduledSourceNode[]; gain: GainNode; tick: number | null } | null = null;
  private wantAmb: Ambience = 'clear';
  /** 0 = calm (pad + bass), 1 = all-out war (drums, arps, taiko hits). Set by the game. */
  intensity = 0.3;
  private readonly bpm = 132;

  enable(on: boolean) {
    this.enabled = on;
    if (on && !this.ctx) this.build();
    if (on) this.ctx?.resume();
    this.setMusic(on);
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    if (on) this.setAmbience(this.wantAmb, true);
  }

  private build() {
    const c = (this.ctx = new AudioContext());
    // master: compressor -> soft limiter -> out
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -3;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.1;
    this.master.connect(comp).connect(limit).connect(c.destination);
    // sfx bus with a reverb send (outdoor battlefield: long, dark tail)
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    const verb = c.createConvolver();
    verb.buffer = this.impulse(3.2, 2.6);
    const verbLp = c.createBiquadFilter();
    verbLp.type = 'lowpass';
    verbLp.frequency.value = 2600;
    const verbOut = c.createGain();
    verbOut.gain.value = 0.55;
    this.reverbSend = c.createGain();
    this.reverbSend.connect(verb).connect(verbLp).connect(verbOut).connect(this.master);
    // shared drive stage for explosions (tape-style saturation)
    this.drive = c.createWaveShaper();
    this.drive.curve = this.satCurve(3.5);
    this.drive.oversample = '2x';
    const driveOut = c.createGain();
    driveOut.gain.value = 0.7;
    this.drive.connect(driveOut);
    driveOut.connect(this.sfxBus);
    driveOut.connect(this.reverbSend);
    // noise colours
    const len = c.sampleRate * 4;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    this.pink = c.createBuffer(1, len, c.sampleRate);
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const w = this.noise.getChannelData(0), p = this.pink.getChannelData(0), b = this.brown.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
    for (let i = 0; i < len; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
      b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
      b6 = x * 0.115926;
      br = (br + 0.02 * x) / 1.02;
      b[i] = br * 3.5;
    }
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
  }

  private impulse(sec: number, decay: number) {
    const c = this.ctx!;
    const n = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // early reflections (sparse) then a dense decaying tail
        const early = i < c.sampleRate * 0.08 && Math.random() < 0.02 ? 1 : 0;
        d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, decay) + early * (Math.random() - 0.5)) * 0.6;
      }
    }
    return buf;
  }

  private satCurve(k: number) {
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return curve;
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

  // ---------------------------------------------------------------- one-shot SFX
  play(kind: Kind, vol = 1) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime + 0.005;
    const minGap: Record<Kind, number> = { gun: 0.045, flak: 0.05, sniper: 0.15, flame: 0.12, cannon: 0.07, laser: 0.05, rocket: 0.07, boom: 0.05, bigboom: 0.18, thunder: 0.6, alarm: 1.5, drop: 0.2 };
    if ((this.last[kind] ?? -1) > now - minGap[kind]) return; // rate-limit spam
    const big = kind === 'bigboom' || kind === 'thunder' || kind === 'alarm';
    if (this.voices >= 16 && !big) return; // voice cap (PLAN.md budget); big moments always play
    this.last[kind] = now;
    this.voices++;
    const out = c.createGain();
    out.gain.value = vol;
    out.connect(this.sfxBus);
    const send = c.createGain();
    send.gain.value = 0;
    out.connect(send).connect(this.reverbSend);
    const wet = (v: number) => (send.gain.value = v);
    let end = 0.2;
    const done = () => setTimeout(() => {
      this.voices--;
      out.disconnect();
      send.disconnect();
    }, (end + 0.3) * 1000);

    /** filtered noise burst with an attack/decay envelope and optional filter sweep */
    const noise = (buf: AudioBuffer, t: number, type: BiquadFilterType, f0: number, f1: number, gain: number, attack: number, decay: number, dest: AudioNode = out, q = 0.8, rate = 1) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
      const f = c.createBiquadFilter();
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      src.connect(f).connect(g).connect(dest);
      src.start(t, Math.random() * 3);
      src.stop(t + attack + decay + 0.05);
      end = Math.max(end, t - now + attack + decay);
    };
    const tone = (type: OscillatorType, t: number, f0: number, f1: number, gain: number, attack: number, decay: number, dest: AudioNode = out) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + attack + decay);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + attack + decay + 0.05);
      end = Math.max(end, t - now + attack + decay);
    };
    /** random crackle: dozens of tiny clicks (debris, embers, rain on metal) */
    const crackle = (t: number, dur: number, n: number, gain: number, freq = 3000) => {
      for (let i = 0; i < n; i++) {
        const at = t + Math.pow(Math.random(), 1.6) * dur;
        noise(this.noise, at, 'bandpass', freq * (0.5 + Math.random()), freq, gain * (0.3 + Math.random() * 0.7) * (1 - (at - t) / dur), 0.001, 0.01 + Math.random() * 0.03, out, 1.5);
      }
    };
    const r = () => 0.92 + Math.random() * 0.16; // pitch variation so repeats never sound identical

    switch (kind) {
      case 'gun': // rifle: supersonic crack + muzzle body + short slap off the ground
        noise(this.noise, now, 'highpass', 2500 * r(), 1800, 0.55, 0.001, 0.035);
        noise(this.pink, now, 'bandpass', 1100 * r(), 500, 0.5, 0.001, 0.09, out, 1.2);
        tone('sine', now, 180 * r(), 60, 0.25, 0.001, 0.06);
        wet(0.35);
        break;
      case 'flak': // autocannon: heavier pop with a metallic ring
        noise(this.noise, now, 'highpass', 1800, 900, 0.6, 0.001, 0.05);
        noise(this.pink, now, 'bandpass', 600 * r(), 250, 0.7, 0.001, 0.16, out, 1.5);
        tone('triangle', now, 140 * r(), 50, 0.45, 0.001, 0.12);
        tone('sine', now + 0.002, 2200 * r(), 1900, 0.04, 0.001, 0.08);
        wet(0.4);
        break;
      case 'sniper': // big-bore crack + long echo down the valley
        noise(this.noise, now, 'highpass', 3500, 2000, 0.9, 0.001, 0.04);
        noise(this.pink, now, 'bandpass', 800, 200, 0.9, 0.001, 0.25, out, 1);
        tone('sine', now, 120, 35, 0.5, 0.001, 0.2);
        wet(0.9);
        break;
      case 'flame': // roaring gas jet
        noise(this.brown, now, 'lowpass', 900, 500, 0.6, 0.04, 0.35, out, 0.7, 1.4);
        noise(this.pink, now, 'bandpass', 2400, 1500, 0.15, 0.03, 0.3, out, 0.6);
        crackle(now, 0.35, 6, 0.1, 2500);
        wet(0.2);
        break;
      case 'cannon': // tank gun: blast wave, chest thump, rolling tail
        noise(this.noise, now, 'highpass', 1500, 700, 0.9, 0.001, 0.06);
        noise(this.brown, now, 'lowpass', 1800, 180, 1.4, 0.003, 0.7, this.drive, 0.7);
        tone('sine', now, 95 * r(), 32, 1.0, 0.002, 0.45, this.drive);
        wet(0.8);
        break;
      case 'laser': // charged beam: two detuned sweeps + sizzle
        tone('sawtooth', now, 2400 * r(), 420, 0.1, 0.002, 0.13);
        tone('square', now, 1210 * r(), 300, 0.05, 0.002, 0.11);
        noise(this.noise, now, 'bandpass', 6000, 3000, 0.12, 0.002, 0.1, out, 3);
        wet(0.3);
        break;
      case 'rocket': // ignition pop + whoosh that rises then fades as it flies away
        noise(this.noise, now, 'highpass', 2000, 1200, 0.4, 0.001, 0.04);
        noise(this.pink, now, 'bandpass', 500, 2200, 0.7, 0.05, 0.55, out, 1.3);
        noise(this.brown, now, 'lowpass', 600, 200, 0.5, 0.02, 0.6);
        wet(0.5);
        break;
      case 'boom': { // explosion: crack -> distorted fireball body -> sub -> debris rain -> tail
        const k = r();
        noise(this.noise, now, 'highpass', 2600, 1200, 1.0, 0.001, 0.05);
        noise(this.brown, now, 'lowpass', 2400 * k, 140, 1.8, 0.004, 1.3, this.drive, 0.6);
        noise(this.pink, now + 0.01, 'lowpass', 900, 120, 0.8, 0.02, 1.6);
        tone('sine', now, 75 * k, 26, 1.3, 0.003, 0.9, this.drive);
        crackle(now + 0.08, 1.1, 22, 0.35, 2600);
        wet(0.9);
        break;
      }
      case 'bigboom': { // titan death / fortress / strike: shockwave, long roll, secondary blasts
        noise(this.noise, now, 'highpass', 3000, 900, 1.2, 0.001, 0.09);
        noise(this.brown, now, 'lowpass', 2000, 90, 2.4, 0.005, 3.2, this.drive, 0.5);
        noise(this.brown, now + 0.15, 'lowpass', 260, 60, 1.6, 0.3, 4.5, out, 0.6, 0.6);
        tone('sine', now, 60, 16, 1.8, 0.004, 2.6, this.drive);
        tone('sine', now + 0.05, 38, 18, 1.0, 0.05, 3.2);
        for (let i = 0; i < 4; i++) {
          const t = now + 0.35 + i * (0.25 + Math.random() * 0.35);
          noise(this.brown, t, 'lowpass', 1400, 150, 0.9, 0.003, 0.8, this.drive, 0.7);
          tone('sine', t, 85, 30, 0.6, 0.003, 0.5, this.drive);
        }
        crackle(now + 0.2, 3, 60, 0.4, 2200);
        wet(1.2);
        break;
      }
      case 'thunder': { // close strike: tearing crack, then a long rumble that rolls in gusts
        const crack = now;
        for (let i = 0; i < 5; i++) noise(this.noise, crack + i * 0.025 + Math.random() * 0.02, 'highpass', 3500, 1500, 0.9 - i * 0.12, 0.001, 0.07);
        noise(this.pink, crack, 'bandpass', 1800, 300, 0.9, 0.002, 0.6, out, 0.7);
        let t = crack + 0.15;
        for (let i = 0; i < 6; i++) {
          const len = 0.8 + Math.random() * 1.4;
          noise(this.brown, t, 'lowpass', 500 - i * 50, 80, 1.6 - i * 0.18, 0.12 + Math.random() * 0.2, len, this.drive, 0.6, 0.7);
          t += len * (0.35 + Math.random() * 0.3);
        }
        tone('sine', crack + 0.05, 50, 22, 0.9, 0.1, 3);
        wet(1.3);
        break;
      }
      case 'alarm': // military klaxon, two pulses
        for (let i = 0; i < 2; i++) {
          const t = now + i * 0.55;
          tone('sawtooth', t, 520, 700, 0.12, 0.02, 0.45);
          tone('sawtooth', t, 523, 703, 0.08, 0.02, 0.45);
        }
        wet(0.6);
        break;
      case 'drop': // parachute crate landing: thud + rattle
        noise(this.brown, now, 'lowpass', 500, 90, 1, 0.003, 0.35);
        crackle(now, 0.25, 8, 0.25, 1800);
        wet(0.4);
        break;
    }
    done();
  }

  // ---------------------------------------------------------------- weather ambience
  /** Cross-fades the looping weather bed. Safe to call before audio is enabled. */
  setAmbience(key: Ambience, force = false) {
    this.wantAmb = key;
    if (!this.ctx || !this.enabled) return;
    if (!force && this.amb?.key === key) return;
    const c = this.ctx;
    const old = this.amb;
    if (old) {
      old.gain.gain.setTargetAtTime(0, c.currentTime, 0.8);
      if (old.tick !== null) clearInterval(old.tick);
      setTimeout(() => {
        for (const n of old.nodes) n.stop();
        old.gain.disconnect();
      }, 4000);
    }
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const nodes: AudioScheduledSourceNode[] = [];
    const loop = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, level: number, rate = 1) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = level;
      src.connect(f).connect(g).connect(gain);
      src.start(0, Math.random() * 3);
      nodes.push(src);
      return { f, g };
    };
    /** slow random modulation of a param (wind gusts, rain intensity) */
    const lfo = (param: AudioParam, rate: number, depth: number) => {
      const o = c.createOscillator();
      o.frequency.value = rate;
      const d = c.createGain();
      d.gain.value = depth;
      o.connect(d).connect(param);
      o.start();
      nodes.push(o);
    };
    let tick: number | null = null;
    const level = { clear: 0, rain: 0.5, storm: 0.65, blizzard: 0.55, fog: 0.3, wind: 0.55, sandstorm: 0.6, heatwave: 0.35, emstorm: 0.5 }[key];
    if (key === 'rain' || key === 'storm') {
      // steady downpour = pink hiss + wet low patter, plus close drops on metal/leaves
      loop(this.pink, 'highpass', 900, 0.5, 0.35);
      loop(this.pink, 'bandpass', 3200, 0.4, 0.25);
      const low = loop(this.brown, 'lowpass', 400, 0.5, key === 'storm' ? 0.5 : 0.25);
      lfo(low.g.gain, 0.07, 0.12);
      if (key === 'storm') {
        const w = loop(this.brown, 'bandpass', 320, 4, 0.35, 0.8);
        lfo(w.f.frequency, 0.11, 140);
        lfo(w.g.gain, 0.05, 0.2);
      }
      tick = window.setInterval(() => {
        if (!this.ctx) return;
        const t = c.currentTime;
        for (let i = 0; i < (key === 'storm' ? 6 : 4); i++) {
          const src = c.createBufferSource();
          src.buffer = this.noise;
          const f = c.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = 2000 + Math.random() * 5000;
          f.Q.value = 6;
          const g = c.createGain();
          const at = t + Math.random() * 0.25;
          g.gain.setValueAtTime(0.12 * Math.random(), at);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
          src.connect(f).connect(g).connect(gain);
          src.start(at, Math.random() * 3);
          src.stop(at + 0.05);
        }
      }, 250);
    } else if (key === 'sandstorm') {
      // roaring wind full of grit: lower howl + strong mid hiss with gusts
      const a = loop(this.brown, 'bandpass', 260, 4, 0.7, 0.85);
      lfo(a.f.frequency, 0.07, 120);
      lfo(a.g.gain, 0.17, 0.35);
      const h = loop(this.pink, 'bandpass', 1800, 0.8, 0.35);
      lfo(h.g.gain, 0.21, 0.2);
      loop(this.noise, 'highpass', 5000, 0.5, 0.06);
      loop(this.brown, 'lowpass', 100, 0.5, 0.6);
    } else if (key === 'heatwave') {
      // shimmering heat: high cicada-like buzz pulsing over a dry low drone
      const a = loop(this.noise, 'bandpass', 4600, 18, 0.2);
      lfo(a.g.gain, 2.3, 0.18);
      lfo(a.f.frequency, 0.1, 300);
      const b = loop(this.brown, 'lowpass', 160, 0.5, 0.3);
      lfo(b.g.gain, 0.05, 0.1);
    } else if (key === 'emstorm') {
      // electric hum + random crackles
      const hum = c.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 55;
      const hf = c.createBiquadFilter();
      hf.type = 'lowpass';
      hf.frequency.value = 400;
      const hg = c.createGain();
      hg.gain.value = 0.05;
      hum.connect(hf).connect(hg).connect(gain);
      hum.start();
      nodes.push(hum);
      lfo(hf.frequency, 0.3, 250);
      const a = loop(this.brown, 'bandpass', 700, 6, 0.3);
      lfo(a.f.frequency, 0.13, 400);
      tick = window.setInterval(() => {
        if (!this.ctx || Math.random() < 0.4) return;
        const t = c.currentTime;
        for (let i = 0; i < 8; i++) {
          const src = c.createBufferSource();
          src.buffer = this.noise;
          const f = c.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 3000;
          const g = c.createGain();
          const at = t + i * 0.012 + Math.random() * 0.01;
          g.gain.setValueAtTime(0.2 * Math.random(), at);
          g.gain.exponentialRampToValueAtTime(0.0001, at + 0.015);
          src.connect(f).connect(g).connect(gain);
          src.start(at, Math.random() * 3);
          src.stop(at + 0.02);
        }
      }, 300);
    } else if (key === 'blizzard' || key === 'wind') {
      // howling wind: resonant band-passed noise with slowly drifting pitch and gusts
      const a = loop(this.brown, 'bandpass', key === 'blizzard' ? 420 : 300, 6, 0.6, 0.9);
      lfo(a.f.frequency, 0.09, 180);
      lfo(a.g.gain, 0.13, 0.3);
      const b = loop(this.pink, 'bandpass', 900, 3, 0.25);
      lfo(b.f.frequency, 0.05, 400);
      loop(this.pink, 'highpass', key === 'blizzard' ? 4000 : 2500, 0.5, key === 'blizzard' ? 0.18 : 0.1); // snow/sand hiss
      loop(this.brown, 'lowpass', 120, 0.5, 0.5); // ground rumble
    } else if (key === 'fog') {
      const a = loop(this.brown, 'lowpass', 180, 0.5, 0.6);
      lfo(a.g.gain, 0.04, 0.2);
      loop(this.pink, 'bandpass', 600, 2, 0.06);
    } else {
      // clear: faint distant battlefield air so silence never feels dead
      const a = loop(this.brown, 'lowpass', 250, 0.5, 0.15);
      lfo(a.g.gain, 0.06, 0.06);
    }
    gain.gain.setTargetAtTime(key === 'clear' ? 0.25 : level, c.currentTime, 1.2);
    this.amb = { key, nodes, gain, tick };
  }
}
