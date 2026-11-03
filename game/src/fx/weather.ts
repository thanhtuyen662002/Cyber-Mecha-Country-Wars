// Full-screen weather overlays. Own fixed-size pools, no allocation per frame.
import { Container, Graphics, Sprite } from 'pixi.js';
import { H, W, type WeatherKey, rand } from '../core/config';
import type { FxTextures } from '../draw/fxTextures';

interface Drop { s: Sprite; vx: number; vy: number; ph: number }

export class Weather {
  readonly layer = new Container();
  private tintOverlay: Sprite;
  private flashOverlay: Sprite;
  private drops: Drop[] = [];
  private flakes: Drop[] = [];
  private fogs: Drop[] = [];
  private streaks: Drop[] = [];
  private leaves: Drop[] = [];
  private bolt = new Graphics();
  private boltGlow = new Graphics();
  private boltLife = 0;
  private nextStrike = 3;
  key: WeatherKey = 'clear';
  windX = 0;
  /** Picks what the bolt hits (world coords) and applies damage; returns the hit point. */
  onStrike: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  /** World -> screen (the weather layer is not zoomed with the camera). */
  toScreen: (x: number, y: number) => { x: number; y: number } = (x, y) => ({ x, y });
  onThunder: () => void = () => {};
  splash: (x: number, y: number) => void = () => {};

  constructor(fx: FxTextures) {
    this.tintOverlay = new Sprite(fx.white);
    this.tintOverlay.width = W;
    this.tintOverlay.height = H;
    this.tintOverlay.alpha = 0;
    this.flashOverlay = new Sprite(fx.white);
    this.flashOverlay.width = W;
    this.flashOverlay.height = H;
    this.flashOverlay.alpha = 0;
    this.flashOverlay.blendMode = 'add';
    this.boltGlow.blendMode = 'add';
    this.bolt.blendMode = 'add';

    const mk = (tex: typeof fx.rain, n: number, arr: Drop[], add: boolean) => {
      for (let i = 0; i < n; i++) {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        if (add) s.blendMode = 'add';
        s.visible = false;
        arr.push({ s, vx: 0, vy: 0, ph: rand(0, 6.28) });
      }
    };
    mk(fx.rain, 700, this.drops, false);
    mk(fx.snow, 900, this.flakes, false);
    mk(fx.fog, 10, this.fogs, false);
    mk(fx.streak, 60, this.streaks, true);
    mk(fx.leaf, 80, this.leaves, false);
    this.layer.addChild(this.tintOverlay);
    for (const a of [this.fogs, this.drops, this.flakes, this.streaks, this.leaves]) for (const d of a) this.layer.addChild(d.s);
    this.layer.addChild(this.boltGlow, this.bolt, this.flashOverlay);
  }

  set(key: WeatherKey) {
    this.key = key;
    const rainy = key === 'rain' || key === 'storm';
    this.drops.forEach((d, i) => {
      d.s.visible = rainy && i < (key === 'storm' ? 700 : 550);
      d.s.position.set(rand(-200, W + 200), rand(-100, H));
      d.vy = rand(1500, 2100);
      d.s.alpha = rand(0.25, 0.55);
      d.s.tint = 0xc8dcff;
      d.s.scale.set(1, rand(0.8, 1.4));
    });
    this.flakes.forEach((d) => {
      d.s.visible = key === 'blizzard';
      d.s.position.set(rand(0, W), rand(0, H));
      d.vy = rand(80, 220);
      d.s.scale.set(rand(0.25, 0.8));
      d.s.alpha = rand(0.5, 0.95);
    });
    this.fogs.forEach((d) => {
      d.s.visible = key === 'fog' || key === 'blizzard';
      d.s.position.set(rand(0, W), rand(0, H));
      d.s.scale.set(rand(5, 8));
      d.s.alpha = key === 'fog' ? rand(0.16, 0.28) : rand(0.04, 0.08);
      d.s.tint = key === 'fog' ? 0xc9d2dc : 0xffffff;
      d.vx = rand(8, 25);
    });
    this.streaks.forEach((d) => {
      d.s.visible = key === 'wind' || key === 'blizzard';
      d.s.position.set(rand(-200, W), rand(0, H));
      d.vx = rand(900, 1500);
      d.s.alpha = rand(0.08, 0.25);
      d.s.scale.set(rand(1, 3), 1);
    });
    this.leaves.forEach((d) => {
      d.s.visible = key === 'wind';
      d.s.position.set(rand(0, W), rand(0, H));
      d.vx = rand(400, 700);
      d.vy = rand(-60, 60);
      d.s.tint = [0x6b8a3a, 0x8a6a2a, 0x555a50][(Math.random() * 3) | 0];
      d.s.scale.set(rand(0.7, 1.3));
    });
    const tint: Record<WeatherKey, [number, number]> = {
      clear: [0x000000, 0],
      rain: [0x0a1428, 0.28],
      storm: [0x050a1a, 0.42],
      blizzard: [0xdfeaff, 0.08],
      fog: [0xb8c4d0, 0.12],
      wind: [0x2a2010, 0.08],
    };
    this.tintOverlay.tint = tint[key][0];
    this.tintOverlay.alpha = tint[key][1];
    this.windX = { clear: 0, rain: 60, storm: 160, blizzard: 260, fog: 15, wind: 420 }[key];
    this.nextStrike = 2;
  }

  update(dt: number, t: number) {
    const k = this.key;
    if (k === 'rain' || k === 'storm') {
      const slant = this.windX / 1800;
      for (const d of this.drops) {
        if (!d.s.visible) continue;
        d.s.y += d.vy * dt;
        d.s.x += d.vy * slant * dt;
        d.s.rotation = -slant;
        if (d.s.y > H + 40) {
          if (Math.random() < 0.25) this.splash(d.s.x, rand(0, H));
          d.s.y = rand(-120, -20);
          d.s.x = rand(-200, W + 100);
        }
      }
    }
    if (k === 'blizzard') {
      for (const d of this.flakes) {
        d.s.y += d.vy * dt;
        d.s.x += (this.windX * 0.9 + Math.sin(t * 2 + d.ph) * 60) * dt;
        if (d.s.y > H + 10 || d.s.x > W + 10) {
          d.s.y = rand(-20, H * 0.6);
          d.s.x = rand(-200, -10);
        }
      }
    }
    if (k === 'fog' || k === 'blizzard') {
      for (const d of this.fogs) {
        d.s.x += (d.vx + this.windX * 0.2) * dt;
        d.s.rotation += dt * 0.02;
        if (d.s.x > W + 500) d.s.x = -500;
      }
    }
    if (k === 'wind' || k === 'blizzard') {
      for (const d of this.streaks) {
        d.s.x += d.vx * dt;
        if (d.s.x > W + 300) {
          d.s.x = rand(-500, -100);
          d.s.y = rand(0, H);
        }
      }
    }
    if (k === 'wind') {
      for (const d of this.leaves) {
        d.s.x += d.vx * dt;
        d.s.y += (d.vy + Math.sin(t * 4 + d.ph) * 120) * dt;
        d.s.rotation += dt * 8;
        if (d.s.x > W + 20) {
          d.s.x = -20;
          d.s.y = rand(0, H);
        }
      }
    }
    if (k === 'storm') {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.nextStrike = rand(2.5, 6);
        this.lightning(rand(120, W - 120), rand(400, H - 400));
      }
    }
    if (this.boltLife > 0) {
      this.boltLife -= dt;
      const a = Math.max(0, this.boltLife / 0.35);
      this.bolt.alpha = a > 0.5 ? (Math.random() < 0.3 ? 0.3 : 1) : a;
      this.boltGlow.alpha = this.bolt.alpha;
    } else {
      this.bolt.alpha = 0;
      this.boltGlow.alpha = 0;
    }
    if (this.flashOverlay.alpha > 0) this.flashOverlay.alpha = Math.max(0, this.flashOverlay.alpha - dt * 3);
  }

  lightning(wx: number, wy: number) {
    const hit = this.onStrike(wx, wy);
    const { x, y } = this.toScreen(hit.x, hit.y);
    const pts: number[] = [];
    let px = x + rand(-200, 200), py = -20;
    pts.push(px, py);
    while (py < y) {
      py += rand(40, 90);
      px += (x - px) * 0.25 + rand(-40, 40);
      pts.push(px, Math.min(py, y));
    }
    const draw = (g: Graphics, w: number, c: number, al: number) => {
      g.clear();
      g.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.stroke({ width: w, color: c, alpha: al, join: 'round' });
      // forks
      for (let i = 4; i < pts.length - 2; i += 4) {
        g.moveTo(pts[i], pts[i + 1]);
        g.lineTo(pts[i] + rand(-80, 80), pts[i + 1] + rand(30, 80));
        g.stroke({ width: w * 0.5, color: c, alpha: al * 0.7 });
      }
    };
    draw(this.boltGlow, 16, 0x7aa8ff, 0.35);
    draw(this.bolt, 3, 0xf2f6ff, 1);
    this.boltLife = 0.35;
    this.flashOverlay.alpha = 0.55;
    this.onThunder();
  }
}
