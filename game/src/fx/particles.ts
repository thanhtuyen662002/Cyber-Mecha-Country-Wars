// Pooled particle system. Sprites are allocated once (hard cap) and recycled,
// so long 24/7 sessions never allocate in the frame loop.
import { Container, Sprite, type Texture } from 'pixi.js';
import { rand } from '../core/config';
import type { FxTextures } from '../draw/fxTextures';

interface P {
  s: Sprite;
  alive: boolean;
  x: number; y: number; vx: number; vy: number;
  life: number; max: number;
  s0: number; s1: number; a0: number; a1: number;
  spin: number; drag: number; wind: number;
  stretch: number; // >0 = orient along velocity, stretched
  arc: number; // >0 = fake height arc (debris flying up then landing)
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
      const p: P = { s, alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0, wind: 0, stretch: 0, arc: 0, c0: 0xffffff, c1: -1 };
      this.pool.push(p);
      this.free.push(p);
    }
  }

  get cap() {
    return this.pool.length;
  }

  spawn(tex: Texture, additive: boolean, x: number, y: number, vx: number, vy: number, life: number, s0: number, s1: number, a0: number, a1: number, tint: number, opts?: Partial<Pick<P, 'spin' | 'drag' | 'wind' | 'stretch' | 'c1' | 'arc'>> & { rot?: number; delay?: number }) {
    let p = this.free.pop();
    if (!p) {
      // steal the oldest-ish: recycle a random live one
      p = this.pool[(Math.random() * this.pool.length) | 0];
      p.s.parent?.removeChild(p.s);
      this.active--;
    }
    p.alive = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = -(opts?.delay ?? 0); p.max = life;
    p.s0 = s0; p.s1 = s1; p.a0 = a0; p.a1 = a1;
    p.spin = opts?.spin ?? 0;
    p.drag = opts?.drag ?? 0;
    p.wind = opts?.wind ?? 0;
    p.stretch = opts?.stretch ?? 0;
    p.arc = opts?.arc ?? 0;
    p.c0 = tint;
    p.c1 = opts?.c1 ?? -1;
    const s = p.s;
    s.texture = tex;
    s.blendMode = additive ? 'add' : 'normal';
    s.tint = tint;
    s.rotation = opts?.rot ?? (p.stretch ? 0 : rand(0, 6.28));
    s.visible = p.life >= 0;
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
      if (p.life < 0) continue;
      if (!p.s.visible) p.s.visible = true;
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
      const sc = (p.s0 + (p.s1 - p.s0) * t) * (p.arc ? 1 + Math.sin(Math.PI * Math.min(1, t * 1.6)) * p.arc : 1);
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
      this.spawn(this.fx.spark, true, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.55), 0.45, 0.1, 1, 0, tint, { drag: 3.5, stretch: 2.2, c1: 0xff5a20 });
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
      this.spawn(this.fx.debris, false, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.6, 1.2), rand(0.5, 1.1), 0.4, 1, 0.8, tint, { spin: rand(-14, 14), drag: 2.5, arc: rand(0.8, 1.8) });
    }
  }

  fireball(x: number, y: number, size: number, count = 10) {
    for (let i = 0; i < this.n(count); i++) {
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

  // tiered explosions (bigger gift = bigger boom). Layers, in order of appearance:
  // white flash + area light -> fireball (white>yellow>orange>red) -> sparks with trails
  // -> flying debris (arcs up and lands) -> dust ring along the ground -> rising smoke column -> lingering embers
  explode(x: number, y: number, tier: number) {
    const k = 0.7 + tier * 0.5;
    this.spawn(this.fx.glow, true, x, y, 0, 0, 0.35 + tier * 0.06, 1.2 * k, 2.4 * k, 0.45, 0, 0xff9a40); // area light
    this.flash(x, y, 1.3 * k, 0xfff0d0, 0.2 + tier * 0.03);
    this.sparks(x, y, 8 + tier * 8, 0xffd27a, 280 + tier * 100);
    if (tier >= 1) this.fireball(x, y, 0.55 * k, 8 + tier * 3);
    if (tier >= 2) {
      this.ring(x, y, 1.5 * k, 0xffe2b0, 0.35);
      // dust ring hugging the ground
      for (let i = 0; i < this.n(10 + tier * 3); i++) {
        const a = (i / (10 + tier * 3)) * 6.28 + rand(-0.2, 0.2), v = rand(120, 200) * k * 0.6;
        this.spawn(this.fx.smoke[i % 3], false, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.8, 1.3), 0.3 * k, 0.9 * k, 0.4, 0, 0x8a7a66, { drag: 3, spin: rand(-1, 1) });
      }
      this.debris(x, y, 6 + tier * 5, 240 + tier * 60);
      // smoke column: dark puffs that start after the fireball and drift up with the wind
      for (let i = 0; i < this.n(4 + tier * 2); i++)
        this.spawn(this.fx.smoke[i % 3], false, x + rand(-15, 15) * k, y + rand(-15, 15) * k, rand(-10, 10), rand(-55, -25), rand(2.5, 4) + tier * 0.4, 0.5 * k, 2 * k, 0.55, 0, 0x2e2b28, { delay: 0.12 + i * 0.05, wind: 0.8, spin: rand(-0.5, 0.5), drag: 0.4, c1: 0x6a6560 });
      // embers floating in the smoke
      for (let i = 0; i < this.n(6 + tier * 4); i++)
        this.spawn(this.fx.glow, true, x + rand(-20, 20) * k, y + rand(-20, 20) * k, rand(-40, 40), rand(-70, -20), rand(1, 2.2), 0.09, 0.03, 1, 0, 0xffa040, { delay: rand(0.1, 0.5), wind: 1, drag: 0.8 });
    }
    if (tier >= 4) {
      this.ring(x, y, 4 * k, 0xffffff, 0.6);
      this.flash(x, y, 3 * k, 0xff9a40, 0.6);
      // secondary blasts popping around the main one
      for (let i = 0; i < this.n(5); i++) {
        const a = rand(0, 6.28), d = rand(40, 90) * k * 0.5;
        const sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d, delay = rand(0.15, 0.6);
        this.spawn(this.fx.glow, true, sx, sy, 0, 0, 0.3, 0.8 * k, 1.6 * k, 1, 0, 0xffc070, { delay });
        for (let j = 0; j < this.n(5); j++)
          this.spawn(this.fx.smoke[j % 3], true, sx, sy, rand(-60, 60), rand(-60, 60), rand(0.3, 0.6), 0.4 * k, 0.9 * k, 1, 0, 0xfff1c0, { delay, drag: 3, c1: 0xff3a10 });
      }
    }
  }
}
