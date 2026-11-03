// Tiny synthesized SFX (Web Audio) so the demo has sound without any audio files.
// The real game will use Howler.js + royalty-free/AI samples; this is just for feel.
type Kind = 'gun' | 'cannon' | 'laser' | 'rocket' | 'boom' | 'bigboom' | 'thunder' | 'alarm';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private voices = 0;
  private last: Partial<Record<Kind, number>> = {};
  enabled = false;

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
    }
    if (on) this.ctx?.resume();
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
      case 'boom': noise(0.7, 'lowpass', 600, 0.9, 0.6); tone('sine', 90, 30, 0.5, 0.7); done(0.7); break;
      case 'bigboom': noise(2.2, 'lowpass', 400, 1.2, 2); tone('sine', 70, 20, 1.6, 1); noise(0.3, 'highpass', 2000, 0.4, 0.25); done(2.2); break;
      case 'thunder': noise(2.5, 'lowpass', 300, 1.1, 2.3); noise(0.15, 'highpass', 3000, 0.5, 0.12); done(2.5); break;
      case 'alarm': tone('square', 660, 440, 0.6, 0.15); done(0.6); break;
    }
  }
}
