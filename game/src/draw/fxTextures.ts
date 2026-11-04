// Small effect textures painted once on a 2D canvas, then uploaded to the GPU.
// Everything is white/greyscale so sprites can be tinted at runtime.
import { Texture } from 'pixi.js';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d')! };
}

function radial(size: number, stops: [number, string][]) {
  const { c, x } = canvas(size, size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return Texture.from(c);
}

// Cheap hash noise for soft blobs.
function blob(size: number, lumps: number, seed: number, soft = 1) {
  const { c, x } = canvas(size, size);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < lumps; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * size * 0.14;
    const cx = size / 2 + Math.cos(a) * d;
    const cy = size / 2 + Math.sin(a) * d;
    const rad = Math.min(size * 0.34, size * (0.16 + r() * 0.16) * soft);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
  }
  return Texture.from(c);
}

export interface FxTextures {
  glow: Texture; // soft additive light
  core: Texture; // hot small center
  spark: Texture; // streak
  smoke: Texture[];
  ring: Texture;
  debris: Texture;
  flame: Texture;
  scorch: Texture;
  crater: Texture;
  track: Texture;
  tracer: Texture;
  beam: Texture;
  rain: Texture;
  snow: Texture;
  fog: Texture;
  streak: Texture;
  leaf: Texture;
  bubble: Texture;
  white: Texture;
  shell: Texture;
  rocket: Texture;
}

export function makeFxTextures(): FxTextures {
  const glow = radial(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.45)'],
    [0.6, 'rgba(255,255,255,0.1)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  const core = radial(64, [
    [0, 'rgba(255,255,255,1)'],
    [0.5, 'rgba(255,255,255,0.9)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  const sp = canvas(64, 8);
  {
    const g = sp.x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    sp.x.fillStyle = g;
    sp.x.beginPath();
    sp.x.ellipse(32, 4, 32, 3, 0, 0, Math.PI * 2);
    sp.x.fill();
  }

  const ring = canvas(128, 128);
  {
    const g = ring.x.createRadialGradient(64, 64, 40, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ring.x.fillStyle = g;
    ring.x.fillRect(0, 0, 128, 128);
  }

  const deb = canvas(16, 16);
  deb.x.fillStyle = '#fff';
  deb.x.beginPath();
  deb.x.moveTo(2, 4);
  deb.x.lineTo(13, 1);
  deb.x.lineTo(15, 11);
  deb.x.lineTo(6, 15);
  deb.x.closePath();
  deb.x.fill();

  const fl = canvas(48, 64);
  {
    const g = fl.x.createRadialGradient(24, 44, 2, 24, 40, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    fl.x.fillStyle = g;
    fl.x.beginPath();
    fl.x.moveTo(24, 2);
    fl.x.quadraticCurveTo(46, 40, 24, 62);
    fl.x.quadraticCurveTo(2, 40, 24, 2);
    fl.x.fill();
  }

  // Scorch: dark irregular stain, used as decal (normal blend, tinted black)
  const sc = canvas(128, 128);
  {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 30;
      const cx = 64 + Math.cos(a) * d;
      const cy = 64 + Math.sin(a) * d;
      const r = 14 + Math.random() * 26;
      const g = sc.x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sc.x.fillStyle = g;
      sc.x.fillRect(0, 0, 128, 128);
    }
    // radial splatter lines
    sc.x.strokeStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2;
      sc.x.lineWidth = 1 + Math.random() * 2;
      sc.x.beginPath();
      sc.x.moveTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18);
      sc.x.lineTo(64 + Math.cos(a) * (40 + Math.random() * 22), 64 + Math.sin(a) * (40 + Math.random() * 22));
      sc.x.stroke();
    }
  }

  const cr = canvas(128, 128);
  {
    const g = cr.x.createRadialGradient(60, 60, 4, 64, 64, 50);
    g.addColorStop(0, 'rgba(10,8,6,0.85)');
    g.addColorStop(0.55, 'rgba(25,20,16,0.7)');
    g.addColorStop(0.8, 'rgba(120,110,95,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cr.x.fillStyle = g;
    cr.x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 10; i++) {
      cr.x.fillStyle = `rgba(${60 + Math.random() * 40},${55 + Math.random() * 30},${45},0.6)`;
      const a = Math.random() * Math.PI * 2;
      cr.x.fillRect(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46, 3 + Math.random() * 4, 3 + Math.random() * 4);
    }
  }

  const tr = canvas(8, 24);
  tr.x.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 4; i++) tr.x.fillRect(0, i * 6, 8, 3);

  const tc = canvas(32, 4);
  {
    const g = tc.x.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    tc.x.fillStyle = g;
    tc.x.fillRect(0, 0, 32, 4);
  }

  const bm = canvas(4, 32);
  {
    const g = bm.x.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    bm.x.fillStyle = g;
    bm.x.fillRect(0, 0, 4, 32);
  }

  const rn = canvas(2, 40);
  {
    const g = rn.x.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    rn.x.fillStyle = g;
    rn.x.fillRect(0, 0, 2, 40);
  }

  const sn = radial(16, [
    [0, 'rgba(255,255,255,1)'],
    [0.5, 'rgba(255,255,255,0.8)'],
    [1, 'rgba(255,255,255,0)'],
  ]);

  const st = canvas(128, 3);
  {
    const g = st.x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    st.x.fillStyle = g;
    st.x.fillRect(0, 0, 128, 3);
  }

  const lf = canvas(14, 8);
  lf.x.fillStyle = '#fff';
  lf.x.beginPath();
  lf.x.ellipse(7, 4, 7, 3.5, 0, 0, Math.PI * 2);
  lf.x.fill();

  const bb = canvas(32, 32);
  bb.x.strokeStyle = 'rgba(255,255,255,0.9)';
  bb.x.lineWidth = 2;
  bb.x.beginPath();
  bb.x.arc(16, 16, 12, 0, Math.PI * 2);
  bb.x.stroke();
  bb.x.fillStyle = 'rgba(255,255,255,0.25)';
  bb.x.fill();
  bb.x.fillStyle = 'rgba(255,255,255,0.9)';
  bb.x.fillRect(10, 9, 4, 3);

  const wh = canvas(4, 4);
  wh.x.fillStyle = '#fff';
  wh.x.fillRect(0, 0, 4, 4);

  const shl = canvas(14, 6);
  shl.x.fillStyle = '#fff';
  shl.x.beginPath();
  shl.x.ellipse(7, 3, 7, 3, 0, 0, Math.PI * 2);
  shl.x.fill();

  const rk = canvas(20, 6);
  rk.x.fillStyle = '#d8dde6';
  rk.x.fillRect(2, 1, 14, 4);
  rk.x.fillStyle = '#fff';
  rk.x.beginPath();
  rk.x.moveTo(16, 0);
  rk.x.lineTo(20, 3);
  rk.x.lineTo(16, 6);
  rk.x.fill();
  rk.x.fillStyle = '#8a93a3';
  rk.x.fillRect(0, 0, 3, 6);

  return {
    glow,
    core,
    spark: Texture.from(sp.c),
    smoke: [blob(96, 9, 7), blob(96, 9, 91), blob(96, 9, 333)],
    ring: Texture.from(ring.c),
    debris: Texture.from(deb.c),
    flame: Texture.from(fl.c),
    scorch: Texture.from(sc.c),
    crater: Texture.from(cr.c),
    track: Texture.from(tr.c),
    tracer: Texture.from(tc.c),
    beam: Texture.from(bm.c),
    rain: Texture.from(rn.c),
    snow: sn,
    fog: blob(256, 22, 1234, 1.4),
    streak: Texture.from(st.c),
    leaf: Texture.from(lf.c),
    bubble: Texture.from(bb.c),
    white: Texture.from(wh.c),
    shell: Texture.from(shl.c),
    rocket: Texture.from(rk.c),
  };
}
