// Pooled particle system. Sprites are allocated once (hard cap) and recycled,
// so long 24/7 sessions never allocate in the frame loop.
import { Container, Sprite, type Texture } from 'pixi.js';
import { rand } from '../config';
import type { FxTextures } from '../draw/fxTextures';

interface P {
  s: Sprite;
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  s0: number; s1: number; a0: number; a1: number;
  spin: number; drag: number; wind: number;
  stretch: number; // >0 = orient along velocity, stretched
  c0: number; c1: number; // colour ramp (tint), c1 < 0 = no ramp
}

function lerpColor(a: number, b: number, t: number) {
  const ar = a >> 16, ag = (a >> 8) & 255, ab = a & 255;
  const br = b >> 16, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t);
}

export class Particles {
  readonly low = new Container(); // normal blend (smoke, debris) - under air units
  readonly high = new Container(); // additive (fire, sparks, glow) - above everything
  private pool: P[] = [];
  private free: P[] = [];
  active = 0;
  budget = 1; // 0..1 quality scale (auto-quality lowers it)
  windX = 0;

  constructor(private fx: FxTextures, cap = 3000) {
    for (let i = 0; i < cap; i++) {
      const s = new Sprite(fx.glow);
      s.anchor.set(0.5);
      s.visible = false;
      const p: P = { s, alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0, wind: 0, stretch: 0, c0: 0xffffff, c1: -1 };
      this.pool.push(p);
      this.free.push(p);
    }
  }

  get cap() {
    return this.pool.length;
  }

  spawn(tex: Texture, additive: boolean, x: number, y: number, vx: number, vy: number, life: number, s0: number, s1: number, a0: number, a1: number, tint: number, opts?: Partial<Pick<P, 'spin' | 'drag' | 'wind' | 'stretch' | 'c1'>> & { rot?: number }) {
    let p = this.free.pop();
    if (!p) {
      // steal the oldest-ish: recycle a random live one
      p = this.pool[(Math.random() * this.pool.length) | 0];
      p.s.parent?.removeChild(p.s);
      this.active--;
    }
    p.alive = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = 0; p.max = life;
    p.s0 = s0; p.s1 = s1; p.a0 = a0; p.a1 = a1;
    p.spin = opts?.spin ?? 0;
    p.drag = opts?.drag ?? 0;
    p.wind = opts?.wind ?? 0;
    p.stretch = opts?.stretch ?? 0;
    p.c0 = tint;
    p.c1 = opts?.c1 ?? -1;
    const s = p.s;
    s.texture = tex;
    s.blendMode = additive ? 'add' : 'normal';
    s.tint = tint;
    s.rotation = opts?.rot ?? (p.stretch ? 0 : rand(0, 6.28));
    s.visible = true;
    s.position.set(x, y);
    s.scale.set(s0);
    s.alpha = a0;
    (additive ? this.high : this.low).addChild(s);
    this.active++;
    return p;
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        p.s.visible = false;
        p.s.parent?.removeChild(p.s);
        this.free.push(p);
        this.active--;
        continue;
      }
      const t = p.life / p.max;
      if (p.drag) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += (p.vx + this.windX * p.wind) * dt;
      p.y += p.vy * dt;
      const s = p.s;
      s.position.set(p.x, p.y);
      const sc = p.s0 + (p.s1 - p.s0) * t;
      if (p.stretch) {
        s.rotation = Math.atan2(p.vy, p.vx + this.windX * p.wind);
        s.scale.set(sc * p.stretch, sc);
      } else {
        s.scale.set(sc);
        s.rotation += p.spin * dt;
      }
      s.alpha = p.a0 + (p.a1 - p.a0) * t;
      if (p.c1 >= 0) s.tint = lerpColor(p.c0, p.c1, t);
    }
  }

  clear() {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.alive = false;
      p.s.visible = false;
      p.s.parent?.removeChild(p.s);
      this.free.push(p);
    }
    this.active = 0;
  }

  private n(count: number) {
    return Math.max(1, Math.round(count * this.budget));
  }

  // ------------------------------------------------ presets
  sparks(x: number, y: number, count: number, tint = 0xffc46b, speed = 380) {
    for (let i = 0; i < this.n(count); i++) {
      const a = rand(0, 6.28), v = rand(0.3, 1) * speed;
      this.spawn(this.fx.spark, true, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.15, 0.4), 0.35, 0.1, 1, 0, tint, { drag: 4, stretch: 1.6 });
    }
  }

  flash(x: number, y: number, size: number, tint = 0xffd9a0, life = 0.18) {
    this.spawn(this.fx.glow, true, x, y, 0, 0, life, size * 0.6, size, 1, 0, tint);
    this.spawn(this.fx.core, true, x, y, 0, 0, life * 0.7, size * 0.25, size * 0.4, 1, 0, 0xffffff);
  }

  muzzle(x: number, y: number, angle: number, size: number, tint: number) {
    this.spawn(this.fx.flame, true, x, y, 0, 0, 0.07, size, size * 0.6, 1, 0, tint, { rot: angle + Math.PI / 2 });
    this.spawn(this.fx.glow, true, x, y, 0, 0, 0.08, size * 0.8, size * 1.1, 0.8, 0, tint);
  }

  smokePuff(x: number, y: number, size: number, tint = 0x5a5a5a, life = 2.2, alpha = 0.5) {
    this.spawn(this.fx.smoke[(Math.random() * 3) | 0], false, x, y, rand(-12, 12), rand(-30, -10), life * rand(0.8, 1.2), size * 0.5, size * 1.8, alpha, 0, tint, { spin: rand(-0.6, 0.6), wind: 0.8, drag: 0.6 });
  }

  trail(x: number, y: number, size: number, tint = 0xb8b8b8) {
    this.spawn(this.fx.smoke[(Math.random() * 3) | 0], false, x, y, rand(-6, 6), rand(-6, 6), rand(0.6, 1.1), size * 0.25, size * 0.8, 0.5, 0, tint, { spin: rand(-1, 1), wind: 0.6 });
  }

  debris(x: number, y: number, count: number, speed: number, tint = 0x4a4f58) {
    for (let i = 0; i < this.n(count); i++) {
      const a = rand(0, 6.28), v = rand(0.3, 1) * speed;
      this.spawn(this.fx.debris, false, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.5, 1.1), rand(0.4, 1), 0.3, 1, 0.6, tint, { spin: rand(-14, 14), drag: 3 });
    }
  }

  fireball(x: number, y: number, size: number) {
    for (let i = 0; i < this.n(10); i++) {
      const a = rand(0, 6.28), v = rand(20, 90) * size;
      this.spawn(this.fx.smoke[i % 3], true, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.7), size * 0.6, size * 1.6, 1, 0, 0xfff1c0, { drag: 3.5, c1: 0xff3a10, spin: rand(-2, 2) });
    }
  }

  ring(x: number, y: number, size: number, tint = 0xffe2b0, life = 0.4) {
    this.spawn(this.fx.ring, true, x, y, 0, 0, life, size * 0.2, size, 0.9, 0, tint);
  }

  flame(x: number, y: number, size: number) {
    this.spawn(this.fx.flame, true, x, y, rand(-8, 8), rand(-50, -25), rand(0.35, 0.6), size * rand(0.5, 0.8), size * 0.2, 0.9, 0, 0xffe08a, { c1: 0xff3000, rot: 0, wind: 0.5 });
  }

  firefly(x: number, y: number) {
    this.spawn(this.fx.glow, true, x, y, rand(-10, 10), rand(-10, 10), rand(1.5, 3), 0.08, 0.12, 0.9, 0, 0xd8ff7a);
  }

  sparkle(x: number, y: number) {
    this.spawn(this.fx.spark, true, x, y, 0, 0, 0.4, 0.3, 0.05, 1, 0, 0xffffff, { rot: Math.PI / 4 });
    this.spawn(this.fx.spark, true, x, y, 0, 0, 0.4, 0.3, 0.05, 1, 0, 0xffffff, { rot: -Math.PI / 4 });
  }

  bubble(x: number, y: number) {
    this.spawn(this.fx.bubble, true, x, y, 0, 0, rand(0.6, 1.2), 0.15, rand(0.4, 0.7), 0.9, 0, 0x9dff4a);
  }

  mist(x: number, y: number, tint: number) {
    this.spawn(this.fx.smoke[(Math.random() * 3) | 0], true, x, y, rand(-10, 10), rand(-20, -8), rand(2.5, 4), 0.8, 2.6, 0.18, 0, tint, { wind: 0.7, spin: rand(-0.3, 0.3) });
  }

  // tiered explosions (bigger gift = bigger boom)
  explode(x: number, y: number, tier: number) {
    const k = 0.6 + tier * 0.45;
    this.flash(x, y, 1.2 * k, 0xffc070, 0.25 + tier * 0.03);
    this.sparks(x, y, 6 + tier * 6, 0xffcf7a, 250 + tier * 90);
    if (tier >= 1) this.fireball(x, y, 0.5 * k);
    if (tier >= 2) {
      this.ring(x, y, 1.2 * k);
      this.debris(x, y, 6 + tier * 4, 220 + tier * 50);
      for (let i = 0; i < this.n(3 + tier); i++) this.smokePuff(x + rand(-20, 20) * k, y + rand(-20, 20) * k, 0.8 * k, 0x6a6560, 2.5 + tier * 0.4, 0.45);
    }
    if (tier >= 4) {
      this.ring(x, y, 4 * k, 0xffffff, 0.6);
      this.flash(x, y, 4 * k, 0xff9a40, 0.6);
    }
  }
}
