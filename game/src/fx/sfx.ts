// Synthesized sound design + cinematic war score (Web Audio), no audio files needed.
//
// SFX: every sound is layered like a field recording (transient crack, distorted body, chest punch,
// sub tail, debris) and then *placed* in the battlefield: stereo pan from the screen position,
// distant sounds are quieter and muffled, and every blast throws a delayed echo back off the hills.
// Huge blasts briefly "deafen" the mix (low-pass duck + ear ring) like being close to a shell.
// A distant-battle bed (far artillery and machine-gun bursts) grows with the fighting so the war
// never sounds empty. Weather colours the whole SFX bus (rain/snow absorb highs, fog muffles,
// sandstorm grit) and has its own looping ambience beds.
//
// Music: an original cinematic battle score in D minor (Dm Bb F C | Dm Bb Gm A) built from
// supersaw strings, a spiccato string ostinato, taiko ensemble, low brass, a heroic horn theme,
// choir "aah" and braam hits. Layers enter with `intensity`; `urgent` (final minute) adds a
// ticking clock, raises the tempo and lifts everything a semitone.
type Kind = 'gun' | 'cannon' | 'laser' | 'rocket' | 'boom' | 'bigboom' | 'thunder' | 'alarm' | 'flak' | 'sniper' | 'flame' | 'drop' | 'whistle' | 'ricochet' | 'clang' | 'splash' | 'steam';
export type SfxKind = Kind;
export type Ambience = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind' | 'sandstorm' | 'heatwave' | 'emstorm';

const PROG: [number, number[]][] = [
  [38, [62, 65, 69]], [34, [58, 62, 65]], [41, [60, 65, 69]], [36, [60, 64, 67]],
  [38, [62, 65, 69]], [34, [58, 62, 65]], [31, [58, 62, 67]], [33, [57, 61, 64]],
];
/** heroic horn theme: [midi, start16th, length16ths] per bar */
const THEME: [number, number, number][][] = [
  [[62, 0, 6], [65, 6, 2], [69, 8, 8]],
  [[70, 0, 6], [69, 6, 2], [65, 8, 8]],
  [[65, 0, 4], [67, 4, 4], [69, 8, 8]],
  [[67, 0, 6], [64, 6, 2], [60, 8, 8]],
  [[62, 0, 6], [65, 6, 2], [69, 8, 6], [74, 14, 2]],
  [[74, 0, 8], [72, 8, 4], [70, 12, 4]],
  [[70, 0, 6], [69, 6, 2], [67, 8, 8]],
  [[69, 0, 12], [61, 12, 4]],
];
/** spiccato ostinato over the chord (index into [root, third, fifth, octave]) */
const OSTINATO = [0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 2, 0, 1, 0, 2, 3];
/** taiko ensemble: 2 = big drum, 1 = mid drum */
const TAIKO = [2, 0, 0, 1, 0, 0, 2, 0, 2, 0, 0, 1, 0, 0, 1, 1];
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private deafen!: BiquadFilterNode; // shell-shock low-pass on everything
  private sfxBus!: GainNode;
  private sfxTone!: BiquadFilterNode; // weather colouring of all SFX
  private reverbSend!: GainNode;
  private echoSend!: GainNode; // long slap-back off the hills
  private drive!: WaveShaperNode;
  private noise!: AudioBuffer;
  private pink!: AudioBuffer;
  private brown!: AudioBuffer;
  private voices = 0;
  private last: Partial<Record<Kind, number>> = {};
  enabled = false;
  private musicGain!: GainNode;
  private musicDuck!: GainNode;
  private musicVerb!: GainNode;
  private musicOn = false;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private warTimer: number | null = null;
  private amb: { key: Ambience; nodes: AudioScheduledSourceNode[]; gain: GainNode; tick: number | null } | null = null;
  private wantAmb: Ambience = 'clear';
  /** 0 = calm (strings), 1 = all-out war (taiko, brass theme, choir). Set by the game. */
  intensity = 0.3;
  /** final minute: ticking clock, faster, a semitone higher */
  urgent = false;
  // Recorded audio (optional): public/audio/manifest.json lists CC0 files per sound kind and
  // music tracks. When present they replace/augment the synth; without them the synth plays alone.
  private samples: Partial<Record<Kind, { bufs: AudioBuffer[]; gain: number }>> = {};
  private tracks: { calm: AudioBuffer[]; battle: AudioBuffer[] } = { calm: [], battle: [] };
  private trackGains: { calm: GainNode; battle: GainNode } | null = null;
  private trackSrc: { calm: AudioBufferSourceNode | null; battle: AudioBufferSourceNode | null } = { calm: null, battle: null };
  private loaded = false;

  enable(on: boolean) {
    this.enabled = on;
    if (on && !this.ctx) this.build();
    if (on) this.ctx?.resume();
    if (on && !this.loaded) {
      this.loaded = true;
      void this.loadSamples();
    }
    this.setMusic(on);
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
    if (on) this.setAmbience(this.wantAmb, true);
  }

  private build() {
    const c = (this.ctx = new AudioContext());
    // master: shell-shock filter -> glue compressor -> limiter -> out
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    this.deafen = c.createBiquadFilter();
    this.deafen.type = 'lowpass';
    this.deafen.frequency.value = 20000;
    this.deafen.Q.value = 0.5;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.3;
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -2;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.08;
    this.master.connect(this.deafen).connect(comp).connect(limit).connect(c.destination);

    // SFX bus: weather tone -> master, with reverb + echo sends
    this.sfxTone = c.createBiquadFilter();
    this.sfxTone.type = 'lowpass';
    this.sfxTone.frequency.value = 18000;
    this.sfxTone.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.sfxTone);
    const verb = c.createConvolver();
    verb.buffer = this.impulse(3.4, 2.4);
    const verbLp = c.createBiquadFilter();
    verbLp.type = 'lowpass';
    verbLp.frequency.value = 2400;
    const verbOut = c.createGain();
    verbOut.gain.value = 0.6;
    this.reverbSend = c.createGain();
    this.reverbSend.connect(verb).connect(verbLp).connect(verbOut).connect(this.sfxTone);
    // valley echo: two dark repeats panned apart (the hills on either side answer back)
    this.echoSend = c.createGain();
    const echoLp = c.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 900;
    this.echoSend.connect(echoLp);
    for (const [time, pan, g] of [[0.38, -0.7, 0.42], [0.71, 0.6, 0.26]] as const) {
      const d = c.createDelay(1.5);
      d.delayTime.value = time;
      const p = c.createStereoPanner();
      p.pan.value = pan;
      const eg = c.createGain();
      eg.gain.value = g;
      echoLp.connect(d).connect(p).connect(eg);
      eg.connect(this.sfxTone);
      eg.connect(this.reverbSend);
    }
    // shared saturation stage for explosions
    this.drive = c.createWaveShaper();
    this.drive.curve = this.satCurve(4);
    this.drive.oversample = '2x';
    const driveOut = c.createGain();
    driveOut.gain.value = 0.7;
    this.drive.connect(driveOut);
    driveOut.connect(this.sfxBus);
    driveOut.connect(this.reverbSend);

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

    // music: own hall reverb, ducked under big explosions
    this.musicDuck = c.createGain();
    this.musicDuck.connect(this.master);
    this.musicGain = c.createGain();
    this.musicGain.gain.value = 0.3;
    this.musicGain.connect(this.musicDuck);
    const hall = c.createConvolver();
    hall.buffer = this.impulse(2.8, 3);
    const hallOut = c.createGain();
    hallOut.gain.value = 0.32;
    this.musicVerb = c.createGain();
    this.musicVerb.connect(hall).connect(hallOut).connect(this.musicDuck);
  }

  private async loadSamples() {
    const c = this.ctx!;
    let m: { sfx?: Record<string, { files: string[]; gain?: number }>; music?: { calm?: string[]; battle?: string[] } };
    try {
      const r = await fetch('audio/manifest.json', { cache: 'no-cache' });
      if (!r.ok) return;
      m = await r.json();
    } catch {
      return; // no recorded audio shipped: synth only
    }
    const load = async (f: string) => {
      try {
        const r = await fetch(`audio/${f}`);
        return r.ok ? await c.decodeAudioData(await r.arrayBuffer()) : null;
      } catch {
        return null;
      }
    };
    for (const [kind, v] of Object.entries(m.sfx ?? {})) {
      const bufs = (await Promise.all(v.files.map(load))).filter((b): b is AudioBuffer => !!b);
      if (bufs.length) this.samples[kind as Kind] = { bufs, gain: v.gain ?? 1 };
    }
    for (const key of ['calm', 'battle'] as const) this.tracks[key] = (await Promise.all((m.music?.[key] ?? []).map(load))).filter((b): b is AudioBuffer => !!b);
    if (this.tracks.calm.length || this.tracks.battle.length) this.startTracks();
    console.info(`[sfx] recorded audio: ${Object.keys(this.samples).length} kinds, ${this.tracks.calm.length + this.tracks.battle.length} music tracks`);
  }

  /** Recorded music: a calm bed and a battle track cross-faded by intensity; each picks a new file when it ends. */
  private startTracks() {
    const c = this.ctx!;
    this.trackGains = { calm: c.createGain(), battle: c.createGain() };
    for (const key of ['calm', 'battle'] as const) {
      this.trackGains[key].gain.value = 0;
      this.trackGains[key].connect(this.musicGain);
      const next = () => {
        const list = this.tracks[key].length ? this.tracks[key] : this.tracks.calm.length ? this.tracks.calm : this.tracks.battle;
        const src = c.createBufferSource();
        src.buffer = list[(Math.random() * list.length) | 0];
        src.connect(this.trackGains![key]);
        src.onended = () => this.musicOn && this.trackSrc[key] === src && next();
        src.start();
        this.trackSrc[key] = src;
      };
      next();
    }
  }

  private impulse(sec: number, decay: number) {
    const c = this.ctx!;
    const n = Math.floor(c.sampleRate * sec);
    const buf = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
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

  /** Weather changes how the battlefield sounds. */
  private toneFor(key: Ambience) {
    if (!this.ctx) return;
    const f = { clear: 18000, rain: 7000, storm: 6000, blizzard: 4200, fog: 3200, wind: 9000, sandstorm: 3800, heatwave: 14000, emstorm: 10000 }[key];
    this.sfxTone.frequency.setTargetAtTime(f, this.ctx.currentTime, 1.5);
  }

  // ================================================================ music
  private setMusic(on: boolean) {
    if (!this.ctx || on === this.musicOn) return;
    this.musicOn = on;
    if (on) {
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 25);
      this.warTimer = window.setInterval(() => this.distantWar(), 180);
    } else {
      if (this.timer !== null) clearInterval(this.timer);
      if (this.warTimer !== null) clearInterval(this.warTimer);
      this.timer = this.warTimer = null;
    }
  }

  private schedule() {
    const c = this.ctx!;
    if (this.trackGains) {
      const I = this.intensity, t = c.currentTime;
      this.trackGains.calm.gain.setTargetAtTime(Math.max(0, 1 - I * 1.4) * 1.6, t, 1.5);
      this.trackGains.battle.gain.setTargetAtTime(Math.min(1, I * 1.4) * 1.6, t, 1.5);
      for (const k of ['calm', 'battle'] as const) if (this.trackSrc[k]) this.trackSrc[k]!.playbackRate.value = this.urgent ? 1.04 : 1;
      this.nextTime = t;
      return;
    }
    while (this.nextTime < c.currentTime + 0.2) {
      const bpm = this.urgent ? 112 : 100;
      const d = 60 / bpm / 4;
      this.playStep(this.step, this.nextTime, d);
      this.step = (this.step + 1) % (16 * PROG.length);
      this.nextTime += d;
    }
  }

  /** gain envelope into the music bus (with a hall send) */
  private menv(t: number, peak: number, attack: number, hold: number, release: number, wet = 0.5) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(this.musicGain);
    if (wet > 0) {
      const s = this.ctx!.createGain();
      s.gain.value = wet;
      g.connect(s).connect(this.musicVerb);
    }
    return g;
  }

  private mosc(type: OscillatorType, f: number, t: number, len: number, out: AudioNode, detune = 0) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    return o;
  }

  private mnoise(t: number, buf: AudioBuffer, type: BiquadFilterType, freq: number, out: AudioNode, len: number, q = 0.7) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(out);
    src.start(t, Math.random() * 3);
    src.stop(t + len + 0.05);
  }

  private playStep(step: number, t: number, d: number) {
    const c = this.ctx!;
    const I = this.intensity;
    const up = this.urgent ? 1 : 0;
    const bar = Math.floor(step / 16) % PROG.length;
    const s = step % 16;
    const [root0, chord0] = PROG[bar];
    const root = root0 + up, chord = chord0.map((n) => n + up);
    const barLen = d * 16;

    // ---- string pad: supersaw ensemble, slow swell, filter opens with intensity
    if (s === 0) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(500 + I * 900, t);
      lp.frequency.linearRampToValueAtTime(800 + I * 2000, t + barLen * 0.6);
      lp.connect(this.menv(t, 0.05 + I * 0.025, barLen * 0.35, barLen * 0.45, barLen * 0.6, 0.8));
      for (const n of [root + 12, ...chord]) for (const dt of [-14, -5, 5, 14]) this.mosc('sawtooth', midi(n), t, barLen * 1.4, lp, dt);
      // contrabass + cello root
      const lb = c.createBiquadFilter();
      lb.type = 'lowpass';
      lb.frequency.value = 280;
      lb.connect(this.menv(t, 0.18, 0.12, barLen * 0.7, barLen * 0.4, 0.3));
      this.mosc('sawtooth', midi(root), t, barLen * 1.2, lb, -4);
      this.mosc('sawtooth', midi(root), t, barLen * 1.2, lb, 4);
    }
    // ---- braam: the huge low brass "BWAAM" at the top of each loop and every 4 bars in full war
    if (s === 0 && I > 0.5 && (bar === 0 || (I > 0.85 && bar === 4))) {
      const sh = c.createWaveShaper();
      sh.curve = this.satCurve(3);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(150, t);
      lp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
      lp.frequency.exponentialRampToValueAtTime(300, t + 3.5);
      sh.connect(lp).connect(this.menv(t, 0.2, 0.06, 0.8, 3, 0.9));
      for (const n of [root - 12, root, root + 7]) for (const dt of [-10, 10]) this.mosc('sawtooth', midi(n), t, 4, sh, dt);
      this.mnoise(t, this.brown, 'lowpass', 120, this.menv(t, 0.5, 0.01, 0, 1.6, 0.6), 1.6);
    }
    // ---- spiccato string ostinato: the engine of the battle
    if (I > 0.22) {
      const pool = [chord[0], chord[1], chord[2], chord[0] + 12];
      const n = pool[OSTINATO[s]] - 12;
      const acc = s % 4 === 0 ? 1 : 0.65;
      const bp = c.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.value = 1400 + I * 1400;
      bp.Q.value = 2;
      bp.connect(this.menv(t, (0.05 + I * 0.04) * acc, 0.004, 0, d * 0.9, 0.45));
      this.mosc('sawtooth', midi(n), t, d, bp, -7);
      this.mosc('sawtooth', midi(n), t, d, bp, 7);
      if (I > 0.6) this.mosc('sawtooth', midi(n + 12), t, d, bp, 0);
    }
    // ---- taiko ensemble
    if (I > 0.35) {
      const hit = TAIKO[s];
      const busy = I > 0.7 && (s === 13 || s === 15);
      if (hit || busy) {
        const big = hit === 2;
        const f0 = big ? 95 : 150;
        const o = this.mosc('sine', f0, t, 0.7, this.menv(t, big ? 0.95 : 0.5, 0.002, 0, big ? 0.6 : 0.3, 0.7));
        o.frequency.exponentialRampToValueAtTime(big ? 42 : 80, t + (big ? 0.35 : 0.2));
        this.mnoise(t, this.brown, 'lowpass', big ? 380 : 700, this.menv(t, big ? 0.6 : 0.3, 0.002, 0, 0.18, 0.5), 0.2);
        this.mnoise(t, this.noise, 'bandpass', 2400, this.menv(t, 0.05, 0.001, 0, 0.03, 0.2), 0.04, 1.5); // stick slap
      }
    }
    // ---- ensemble snare / anvil on the backbeat
    if (I > 0.6 && (s === 4 || s === 12)) {
      this.mnoise(t, this.noise, 'bandpass', 1900, this.menv(t, 0.3, 0.002, 0, 0.18, 0.6), 0.2, 0.9);
      this.mosc('triangle', 210, t, 0.1, this.menv(t, 0.18, 0.002, 0, 0.08, 0.2));
      if (I > 0.85) {
        // anvil: inharmonic metal partials
        for (const [f, g] of [[1800, 0.03], [2470, 0.02], [3910, 0.012]]) this.mosc('sine', f, t, 0.4, this.menv(t, g, 0.001, 0, 0.35, 0.6));
      }
    }
    // ---- drum roll into the next phrase
    if (I > 0.75 && bar % 4 === 3 && s >= 12) {
      for (let i = 0; i < 2; i++) {
        const tt = t + i * d * 0.5;
        const o = this.mosc('sine', 240 - (s - 12) * 25, tt, 0.15, this.menv(tt, 0.35 + (s - 12) * 0.08, 0.002, 0, 0.12, 0.5));
        o.frequency.exponentialRampToValueAtTime(90, tt + 0.12);
      }
    }
    // ---- low brass chords on the downbeats
    if (I > 0.55 && (s === 0 || s === 8)) {
      for (const n of [chord[0] - 12, chord[2] - 12]) this.brass(t, n, d * 7, 0.035 + I * 0.025, 1100);
    }
    // ---- heroic horn theme
    if (I > 0.7) {
      for (const [n, st, ln] of THEME[bar]) if (st === s) this.brass(t, n + up, d * ln * 0.95, 0.06 + I * 0.03, 2400, true);
    }
    // ---- choir "aah": formant-filtered ensemble for the biggest moments
    if (I > 0.85 && s === 0) {
      const sum = c.createGain();
      const out = this.menv(t, 0.06, barLen * 0.3, barLen * 0.5, barLen * 0.5, 1);
      for (const [f, q, g] of [[800, 6, 1], [1150, 7, 0.6], [2900, 9, 0.25]]) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = q;
        const fg = c.createGain();
        fg.gain.value = g * 3;
        sum.connect(bp).connect(fg).connect(out);
      }
      for (const n of [chord[0], chord[1], chord[2], chord[0] + 12]) for (const dt of [-9, 0, 9]) {
        const o = this.mosc('sawtooth', midi(n), t, barLen * 1.4, sum, dt);
        const v = c.createOscillator();
        v.frequency.value = 5 + Math.random();
        const vg = c.createGain();
        vg.gain.value = 6;
        v.connect(vg).connect(o.detune);
        v.start(t);
        v.stop(t + barLen * 1.4);
      }
    }
    // ---- final minute: ticking clock + high string tremolo
    if (this.urgent) {
      if (s % 2 === 0) this.mnoise(t, this.noise, 'bandpass', s % 8 === 0 ? 3800 : 5200, this.menv(t, 0.09, 0.001, 0, 0.03, 0.2), 0.04, 8);
      if (s % 2 === 0) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;
        lp.connect(this.menv(t, 0.02, 0.005, 0, d * 1.6, 0.6));
        this.mosc('sawtooth', midi(chord[2] + 12), t, d * 2, lp, 3);
      }
    }
  }

  /** brass voice: saw stack with a fast "blat" filter opening and late vibrato */
  private brass(t: number, n: number, len: number, peak: number, bright: number, lead = false) {
    const c = this.ctx!;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(bright, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(bright * 0.55, t + 0.35);
    lp.connect(this.menv(t, peak, 0.05, Math.max(0, len - 0.2), 0.35, lead ? 0.7 : 0.5));
    const vib = c.createOscillator();
    vib.frequency.value = 5.2;
    const vg = c.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(lead ? 9 : 4, t + Math.min(0.5, len));
    vib.connect(vg);
    vib.start(t);
    vib.stop(t + len + 0.4);
    for (const dt of lead ? [-8, 0, 8] : [-6, 6]) {
      const o = this.mosc('sawtooth', midi(n), t, len + 0.35, lp, dt);
      vg.connect(o.detune);
    }
    if (lead) this.mosc('square', midi(n - 12), t, len + 0.35, lp, 0);
  }

  /** far-off battle: artillery thumps and machine-gun bursts beyond the hills */
  private distantWar() {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx;
    const I = this.intensity;
    const out = c.createGain();
    out.gain.value = 0.5;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const pan = c.createStereoPanner();
    pan.pan.value = Math.random() * 1.8 - 0.9;
    out.connect(lp).connect(pan);
    pan.connect(this.sfxBus);
    const ws = c.createGain();
    ws.gain.value = 1.2;
    pan.connect(ws).connect(this.reverbSend);
    const now = c.currentTime + Math.random() * 0.15;
    const burst = (buf: AudioBuffer, at: number, f: number, g: number, dec: number) => {
      const src = c.createBufferSource();
      src.buffer = buf;
      const bf = c.createBiquadFilter();
      bf.type = 'lowpass';
      bf.frequency.value = f;
      const gg = c.createGain();
      gg.gain.setValueAtTime(0.0001, at);
      gg.gain.linearRampToValueAtTime(g, at + 0.005);
      gg.gain.exponentialRampToValueAtTime(0.0001, at + dec);
      src.connect(bf).connect(gg).connect(out);
      src.start(at, Math.random() * 3);
      src.stop(at + dec + 0.05);
    };
    let used = false;
    if (Math.random() < 0.06 + I * 0.16) {
      // distant artillery: dull thump with a long roll
      burst(this.brown, now, 260, 0.8 + I * 0.5, 1.4);
      const o = c.createOscillator();
      o.frequency.setValueAtTime(60, now);
      o.frequency.exponentialRampToValueAtTime(28, now + 0.8);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.linearRampToValueAtTime(0.35, now + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      o.connect(og).connect(out);
      o.start(now);
      o.stop(now + 1);
      used = true;
    }
    if (Math.random() < 0.04 + I * 0.12) {
      // far machine gun burst
      const n = 4 + ((Math.random() * 8) | 0);
      const rate = 0.07 + Math.random() * 0.03;
      for (let i = 0; i < n; i++) burst(this.pink, now + i * rate, 1100, 0.25 + Math.random() * 0.15, 0.08);
      used = true;
    }
    setTimeout(() => out.disconnect(), used ? 3000 : 10);
  }

  // ================================================================ one-shot SFX
  /**
   * @param pan  -1 (left) .. 1 (right), from the emitter's screen position
   * @param dist 0 = on screen, 1 = far off screen (quieter, muffled, more echo)
   */
  play(kind: Kind, vol = 1, pan = 0, dist = 0) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime + 0.005;
    const minGap: Record<Kind, number> = { gun: 0.04, flak: 0.05, sniper: 0.15, flame: 0.12, cannon: 0.06, laser: 0.05, rocket: 0.07, boom: 0.045, bigboom: 0.18, thunder: 0.6, alarm: 1.5, drop: 0.2, whistle: 0.35, ricochet: 0.18, clang: 0.08, splash: 0.12, steam: 0.3 };
    if ((this.last[kind] ?? -1) > now - minGap[kind]) return;
    const big = kind === 'bigboom' || kind === 'thunder' || kind === 'alarm';
    if (this.voices >= 22 && !big) return;
    if (dist > 0.95 && !big) return; // far away and small: inaudible anyway
    this.last[kind] = now;
    this.voices++;
    const out = c.createGain();
    out.gain.value = vol * (1 - dist * 0.65);
    const pn = c.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, pan));
    const air = c.createBiquadFilter(); // air absorption with distance
    air.type = 'lowpass';
    air.frequency.value = 18000 * Math.pow(0.08, dist);
    out.connect(air).connect(pn).connect(this.sfxBus);
    const send = c.createGain();
    send.gain.value = 0;
    pn.connect(send).connect(this.reverbSend);
    const echo = c.createGain();
    echo.gain.value = 0;
    pn.connect(echo).connect(this.echoSend);
    const wet = (v: number, e = 0) => {
      send.gain.value = v * (1 + dist);
      echo.gain.value = e * (1 + dist * 0.5);
    };
    // the explosion bus is shared, so pan its contribution through a per-voice panner too
    const drv = c.createGain();
    const dpn = c.createStereoPanner();
    dpn.pan.value = pn.pan.value * 0.7;
    drv.gain.value = vol * (1 - dist * 0.65);
    drv.connect(dpn).connect(this.drive);
    let end = 0.2;
    const done = () => setTimeout(() => {
      this.voices--;
      for (const n of [out, send, echo, drv, dpn, air, pn]) n.disconnect();
    }, (end + 0.9) * 1000);

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
      return o;
    };
    const crackle = (t: number, dur: number, n: number, gain: number, freq = 3000) => {
      for (let i = 0; i < n; i++) {
        const at = t + Math.pow(Math.random(), 1.6) * dur;
        noise(this.noise, at, 'bandpass', freq * (0.5 + Math.random()), freq, gain * (0.3 + Math.random() * 0.7) * (1 - (at - t) / dur), 0.001, 0.01 + Math.random() * 0.03, out, 1.5);
      }
    };
    /** falling metal and rock: short inharmonic clanks scattered over the tail */
    const clanks = (t: number, dur: number, n: number, gain: number) => {
      for (let i = 0; i < n; i++) {
        const at = t + 0.2 + Math.random() * dur;
        const f = 300 + Math.random() * 900;
        tone('triangle', at, f, f * 0.97, gain * (0.4 + Math.random() * 0.6), 0.001, 0.05 + Math.random() * 0.08);
        tone('sine', at, f * 2.76, f * 2.7, gain * 0.3, 0.001, 0.04);
      }
    };
    const r = () => 0.92 + Math.random() * 0.16;

    // recorded sample: plays alone for small sounds; heavy sounds keep the synth sub/punch underneath
    const smp = this.samples[kind];
    if (smp) {
      const src = c.createBufferSource();
      src.buffer = smp.bufs[(Math.random() * smp.bufs.length) | 0];
      src.playbackRate.value = 0.94 + Math.random() * 0.12;
      const g = c.createGain();
      g.gain.value = smp.gain;
      src.connect(g).connect(out);
      src.start(now);
      end = Math.max(end, src.buffer.duration);
      const heavy = kind === 'boom' || kind === 'bigboom' || kind === 'cannon' || kind === 'thunder';
      if (!heavy) {
        wet(kind === 'sniper' ? 0.6 : 0.25, kind === 'gun' || kind === 'sniper' || kind === 'flak' ? 0.4 : 0.2);
        done();
        return;
      }
      g.gain.value = smp.gain * 1.6;
      out.gain.value *= 0.6;
      drv.gain.value *= 0.6;
    }

    switch (kind) {
      case 'gun': // rifle: supersonic crack + muzzle body + ground slap, answered by the hills
        noise(this.noise, now, 'highpass', 2600 * r(), 1800, 0.6, 0.001, 0.03);
        noise(this.pink, now, 'bandpass', 1000 * r(), 450, 0.6, 0.001, 0.09, out, 1.2);
        tone('sine', now, 190 * r(), 55, 0.35, 0.001, 0.07);
        wet(0.3, 0.35);
        break;
      case 'flak': // autocannon: heavy pop with a metallic ring
        noise(this.noise, now, 'highpass', 1800, 900, 0.7, 0.001, 0.05);
        noise(this.pink, now, 'bandpass', 600 * r(), 250, 0.8, 0.001, 0.16, out, 1.5);
        tone('triangle', now, 150 * r(), 48, 0.6, 0.001, 0.14);
        tone('sine', now + 0.002, 2200 * r(), 1900, 0.04, 0.001, 0.08);
        wet(0.4, 0.4);
        break;
      case 'sniper': // big-bore crack, long echo down the valley
        noise(this.noise, now, 'highpass', 3500, 2000, 1, 0.001, 0.04);
        noise(this.pink, now, 'bandpass', 800, 200, 1, 0.001, 0.25, out, 1);
        tone('sine', now, 120, 35, 0.6, 0.001, 0.22);
        wet(0.8, 0.9);
        break;
      case 'flame': // roaring gas jet
        noise(this.brown, now, 'lowpass', 900, 500, 0.7, 0.04, 0.38, out, 0.7, 1.4);
        noise(this.pink, now, 'bandpass', 2400, 1500, 0.18, 0.03, 0.3, out, 0.6);
        crackle(now, 0.35, 8, 0.12, 2500);
        wet(0.2);
        break;
      case 'cannon': // tank gun: blast wave, chest thump, breech clank, rolling echo
        noise(this.noise, now, 'highpass', 1500, 700, 1, 0.001, 0.06);
        noise(this.brown, now, 'lowpass', 2000, 180, 1.5, 0.003, 0.75, drv, 0.7);
        tone('sine', now, 110 * r(), 34, 1.2, 0.002, 0.5, drv);
        tone('sine', now, 62, 30, 0.8, 0.003, 0.9);
        tone('triangle', now + 0.09, 820 * r(), 790, 0.06, 0.001, 0.12);
        wet(0.7, 0.9);
        break;
      case 'laser': // charged beam: two detuned sweeps + sizzle
        tone('sawtooth', now, 2400 * r(), 420, 0.11, 0.002, 0.13);
        tone('square', now, 1210 * r(), 300, 0.06, 0.002, 0.11);
        noise(this.noise, now, 'bandpass', 6000, 3000, 0.14, 0.002, 0.1, out, 3);
        tone('sine', now, 90, 40, 0.3, 0.002, 0.15);
        wet(0.3, 0.2);
        break;
      case 'rocket': // ignition pop + whoosh that rises then fades away
        noise(this.noise, now, 'highpass', 2000, 1200, 0.5, 0.001, 0.04);
        noise(this.pink, now, 'bandpass', 450, 2400, 0.8, 0.05, 0.6, out, 1.3);
        noise(this.brown, now, 'lowpass', 700, 200, 0.6, 0.02, 0.7);
        tone('sine', now, 80, 40, 0.4, 0.002, 0.2);
        wet(0.5, 0.5);
        break;
      case 'boom': { // explosion: crack -> chest punch -> distorted fireball -> sub -> debris -> valley echo
        const k = r();
        noise(this.noise, now, 'highpass', 2800, 1200, 1.1, 0.001, 0.05);
        tone('sine', now, 140 * k, 45, 1.5, 0.002, 0.14, drv); // punch
        noise(this.brown, now, 'lowpass', 2600 * k, 140, 2, 0.004, 1.4, drv, 0.6);
        noise(this.pink, now + 0.01, 'lowpass', 900, 120, 0.9, 0.02, 1.7);
        tone('sine', now, 58 * k, 22, 1.4, 0.003, 1.3);
        noise(this.brown, now + 0.04, 'lowpass', 140, 60, 0.9, 0.06, 1.8, out, 0.5, 0.6); // ground rumble
        crackle(now + 0.08, 1.3, 26, 0.38, 2600);
        if (vol > 0.6) clanks(now, 1, 4, 0.08);
        wet(0.9, 1);
        if (vol >= 0.9 && dist < 0.3) this.duck(0.35, 0.7);
        break;
      }
      case 'bigboom': { // titan death / fortress / strike: shockwave, long roll, secondary blasts
        noise(this.noise, now, 'highpass', 3000, 900, 1.3, 0.001, 0.09);
        tone('sine', now, 120, 30, 2, 0.002, 0.3, drv);
        noise(this.brown, now, 'lowpass', 2200, 90, 2.6, 0.005, 3.4, drv, 0.5);
        noise(this.brown, now + 0.15, 'lowpass', 260, 60, 1.8, 0.3, 4.8, out, 0.6, 0.6);
        tone('sine', now, 55, 16, 2, 0.004, 2.8, drv);
        tone('sine', now + 0.05, 36, 18, 1.2, 0.05, 3.4);
        for (let i = 0; i < 5; i++) {
          const t = now + 0.35 + i * (0.22 + Math.random() * 0.35);
          noise(this.brown, t, 'lowpass', 1500, 150, 1, 0.003, 0.8, drv, 0.7);
          tone('sine', t, 90, 30, 0.7, 0.003, 0.5, drv);
          noise(this.noise, t, 'highpass', 2500, 1200, 0.4, 0.001, 0.04);
        }
        crackle(now + 0.2, 3.2, 70, 0.42, 2200);
        clanks(now + 0.4, 2.6, 12, 0.12);
        wet(1.2, 1.2);
        if (dist < 0.5) this.duck(1, 1.8);
        break;
      }
      case 'thunder': {
        const crack = now;
        for (let i = 0; i < 5; i++) noise(this.noise, crack + i * 0.025 + Math.random() * 0.02, 'highpass', 3500, 1500, 1 - i * 0.12, 0.001, 0.07);
        noise(this.pink, crack, 'bandpass', 1800, 300, 1, 0.002, 0.6, out, 0.7);
        let t = crack + 0.15;
        for (let i = 0; i < 6; i++) {
          const len = 0.8 + Math.random() * 1.4;
          noise(this.brown, t, 'lowpass', 500 - i * 50, 80, 1.7 - i * 0.18, 0.12 + Math.random() * 0.2, len, drv, 0.6, 0.7);
          t += len * (0.35 + Math.random() * 0.3);
        }
        tone('sine', crack + 0.05, 50, 22, 1, 0.1, 3);
        wet(1.3, 0.8);
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
      case 'drop':
        noise(this.brown, now, 'lowpass', 500, 90, 1, 0.003, 0.35);
        crackle(now, 0.25, 8, 0.25, 1800);
        wet(0.4);
        break;
      case 'whistle': { // incoming shell: falling whistle, slightly wobbly
        const o = tone('sine', now, 2100 * r(), 650, 0.09, 0.15, 0.85);
        const v = c.createOscillator();
        v.frequency.value = 9;
        const vg = c.createGain();
        vg.gain.value = 18;
        v.connect(vg).connect(o.detune);
        v.start(now);
        v.stop(now + 1.1);
        noise(this.pink, now, 'bandpass', 1800, 700, 0.06, 0.2, 0.8, out, 4);
        wet(0.4);
        break;
      }
      case 'ricochet': { // bullet off armour: bright sweep down
        const f = 2400 + Math.random() * 1600;
        tone('sine', now, f, f * 0.55, 0.12, 0.002, 0.28);
        noise(this.noise, now, 'bandpass', 4000, 2500, 0.15, 0.001, 0.05, out, 2);
        wet(0.5);
        break;
      }
      case 'clang': // round hits a hull
        for (const [f, g] of [[610, 0.2], [1530, 0.1], [2710, 0.05]]) tone('triangle', now, f * r(), f * 0.97, g, 0.001, 0.18);
        noise(this.noise, now, 'highpass', 3000, 2000, 0.25, 0.001, 0.03);
        wet(0.3);
        break;
      case 'splash': // shell into water: plunge + spray
        noise(this.brown, now, 'lowpass', 600, 120, 1, 0.004, 0.4);
        noise(this.pink, now + 0.03, 'bandpass', 2400, 900, 0.6, 0.05, 0.9, out, 0.8);
        crackle(now + 0.25, 0.8, 18, 0.18, 3500);
        wet(0.5, 0.3);
        break;
      case 'steam': // fire meets rain/snow
        noise(this.noise, now, 'highpass', 5000, 3000, 0.2, 0.05, 0.6);
        noise(this.pink, now, 'bandpass', 3000, 2500, 0.1, 0.05, 0.5, out, 2);
        wet(0.2);
        break;
    }
    done();
  }

  /** shell shock: everything goes dull for a moment, music dips, a faint ring in the ears */
  private duck(depth: number, sec: number) {
    const c = this.ctx!;
    const t = c.currentTime;
    const f = this.deafen.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(300, 20000 * Math.pow(0.02, depth)), t + 0.06);
    f.exponentialRampToValueAtTime(20000, t + 0.06 + sec);
    const m = this.musicDuck.gain;
    m.cancelScheduledValues(t);
    m.setValueAtTime(m.value, t);
    m.linearRampToValueAtTime(1 - depth * 0.6, t + 0.05);
    m.linearRampToValueAtTime(1, t + 0.05 + sec * 1.4);
    if (depth >= 0.9) {
      const o = c.createOscillator();
      o.frequency.value = 3700 + Math.random() * 400;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.025, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15 + sec * 1.5);
      o.connect(g).connect(c.destination); // bypasses the deafen filter: it is *in* your ears
      o.start(t);
      o.stop(t + 0.3 + sec * 1.5);
    }
  }

  // ================================================================ weather ambience
  setAmbience(key: Ambience, force = false) {
    this.wantAmb = key;
    if (!this.ctx || !this.enabled) return;
    this.toneFor(key);
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
      const a = loop(this.brown, 'bandpass', 260, 4, 0.7, 0.85);
      lfo(a.f.frequency, 0.07, 120);
      lfo(a.g.gain, 0.17, 0.35);
      const h = loop(this.pink, 'bandpass', 1800, 0.8, 0.35);
      lfo(h.g.gain, 0.21, 0.2);
      loop(this.noise, 'highpass', 5000, 0.5, 0.06);
      loop(this.brown, 'lowpass', 100, 0.5, 0.6);
    } else if (key === 'heatwave') {
      const a = loop(this.noise, 'bandpass', 4600, 18, 0.2);
      lfo(a.g.gain, 2.3, 0.18);
      lfo(a.f.frequency, 0.1, 300);
      const b = loop(this.brown, 'lowpass', 160, 0.5, 0.3);
      lfo(b.g.gain, 0.05, 0.1);
    } else if (key === 'emstorm') {
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
      const a = loop(this.brown, 'bandpass', key === 'blizzard' ? 420 : 300, 6, 0.6, 0.9);
      lfo(a.f.frequency, 0.09, 180);
      lfo(a.g.gain, 0.13, 0.3);
      const b = loop(this.pink, 'bandpass', 900, 3, 0.25);
      lfo(b.f.frequency, 0.05, 400);
      loop(this.pink, 'highpass', key === 'blizzard' ? 4000 : 2500, 0.5, key === 'blizzard' ? 0.18 : 0.1);
      loop(this.brown, 'lowpass', 120, 0.5, 0.5);
    } else if (key === 'fog') {
      const a = loop(this.brown, 'lowpass', 180, 0.5, 0.6);
      lfo(a.g.gain, 0.04, 0.2);
      loop(this.pink, 'bandpass', 600, 2, 0.06);
    } else {
      const a = loop(this.brown, 'lowpass', 250, 0.5, 0.15);
      lfo(a.g.gain, 0.06, 0.06);
    }
    gain.gain.setTargetAtTime(key === 'clear' ? 0.25 : level, c.currentTime, 1.2);
    this.amb = { key, nodes, gain, tick };
  }
}
