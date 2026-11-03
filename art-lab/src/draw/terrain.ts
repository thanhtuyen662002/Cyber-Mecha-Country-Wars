// Procedural terrain: a baked ground texture (noise + painted features on a 2D canvas)
// plus a small animated layer (trees swaying, toxic pools with a shader, fires, sparkles).
import { Container, Filter, GlProgram, Sprite, Texture } from 'pixi.js';
import { H, TEAMS, W, type TerrainKey, rand } from '../config';
import type { FxTextures } from './fxTextures';
import type { Particles } from '../fx/particles';
import * as P from './props';

// ------------------------------------------------------------ noise
function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number, oct = 4) {
  let t = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    t += vnoise(x * f, y * f, s + i * 17) * amp;
    f *= 2;
    amp *= 0.5;
  }
  return t;
}

type RGB = [number, number, number];
const hex = (c: string): RGB => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function noiseGround(c1: string, c2: string, c3: string, scale: number, seed: number, detail = 18): HTMLCanvasElement {
  // Painted at half resolution, upscaled with smoothing (4x cheaper).
  const w = W / 2, h = H / 2;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const A = hex(c1), B = hex(c2), C = hex(c3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x / scale, y / scale, seed);
      const m = fbm(x / (scale * 0.3), y / (scale * 0.3), seed + 99, 2);
      let col = n < 0.5 ? mix(A, B, n * 2) : mix(B, C, (n - 0.5) * 2);
      const grain = (hash(x, y, seed) - 0.5) * detail + (m - 0.5) * detail;
      col = [col[0] + grain, col[1] + grain, col[2] + grain];
      const i = (y * w + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const fc = full.getContext('2d')!;
  fc.imageSmoothingQuality = 'high';
  fc.drawImage(cv, 0, 0, W, H);
  return full;
}

function blotch(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function winding(ctx: CanvasRenderingContext2D, x0: number, width: number, color: string, wobble: number, seed: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = -20; y <= H + 20; y += 20) {
    const x = x0 + Math.sin(y / 260 + seed) * wobble + Math.sin(y / 97 + seed * 3) * wobble * 0.3;
    if (y === -20) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function clearBases(ctx: CanvasRenderingContext2D, color: string) {
  for (const t of TEAMS) blotch(ctx, t.base.x, t.base.y, 220, color);
}

// ------------------------------------------------------------ painters
function paintJungle(): HTMLCanvasElement {
  const cv = noiseGround('#13261a', '#24452a', '#3d6a34', 90, 3);
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < 70; i++) blotch(ctx, rand(0, W), rand(0, H), rand(30, 110), `rgba(${rand(40, 80) | 0},${rand(90, 130) | 0},${rand(30, 50) | 0},0.35)`);
  // muddy river across the middle
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#2b2a1c';
  ctx.lineWidth = 120;
  ctx.beginPath();
  for (let x = -40; x <= W + 40; x += 20) {
    const y = 980 + Math.sin(x / 180) * 60;
    if (x === -40) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70,110,90,0.55)';
  ctx.lineWidth = 80;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(160,200,180,0.12)';
  ctx.lineWidth = 6;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    const off = rand(-30, 30);
    for (let x = rand(0, 200); x <= W; x += 20) {
      const y = 980 + off + Math.sin(x / 180) * 60;
      ctx.lineTo(x, y);
      if (Math.random() < 0.04) break;
    }
    ctx.stroke();
  }
  ctx.restore();
  // dirt trail
  winding(ctx, 540, 70, 'rgba(92,70,44,0.55)', 120, 1.3);
  winding(ctx, 540, 30, 'rgba(120,95,60,0.35)', 120, 1.3);
  // ferns / undergrowth specks
  for (let i = 0; i < 1600; i++) {
    const x = rand(0, W), y = rand(0, H);
    ctx.fillStyle = `rgba(${rand(50, 110) | 0},${rand(120, 180) | 0},${rand(40, 70) | 0},${rand(0.25, 0.6)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rand(2, 6), rand(1, 2.5), rand(0, 6.28), 0, Math.PI * 2);
    ctx.fill();
  }
  clearBases(ctx, 'rgba(60,70,50,0.6)');
  for (let i = 0; i < 45; i++) { const [x, y] = P.spot(20); P.bush(ctx, x, y, rand(10, 22), '#1d3a1c', '#4f8a3a'); }
  for (let i = 0; i < 14; i++) { const [x, y] = P.spot(30); P.rock(ctx, x, y, rand(10, 22), '#5d5f55', '#8a8c80', 'rgba(70,120,50,0.7)'); }
  for (let i = 0; i < 8; i++) { const [x, y] = P.spot(40); P.log(ctx, x, y, rand(50, 90), rand(0, 3.14)); }
  P.stoneRuin(ctx, 230, 700, 150);
  P.stoneRuin(ctx, 860, 1280, 130);
  P.bunker(ctx, 820, 640, 70, '#4f5a44');
  P.bunker(ctx, 250, 1340, 70, '#4f5a44');
  P.battlefield(ctx, 'rgba(110,85,50,0.5)', '#7a6a48');
  P.vignette(ctx, 0.5);
  return cv;
}

function paintIce(): HTMLCanvasElement {
  const cv = noiseGround('#4f6b82', '#7d9db4', '#b4cddd', 120, 11, 10);
  const ctx = cv.getContext('2d')!;
  // frozen lakes
  for (const [x, y, rx, ry] of [[300, 760, 260, 150], [820, 1180, 230, 170], [200, 1300, 150, 90]]) {
    const g = ctx.createRadialGradient(x, y, 10, x, y, Math.max(rx, ry));
    g.addColorStop(0, 'rgba(40,110,170,0.75)');
    g.addColorStop(0.7, 'rgba(80,150,200,0.55)');
    g.addColorStop(1, 'rgba(150,200,230,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand(-0.3, 0.3), 0, Math.PI * 2);
    ctx.fill();
    // cracks
    ctx.strokeStyle = 'rgba(235,250,255,0.7)';
    for (let k = 0; k < 9; k++) {
      ctx.lineWidth = rand(0.8, 2);
      ctx.beginPath();
      let px = x + rand(-rx * 0.5, rx * 0.5), py = y + rand(-ry * 0.5, ry * 0.5);
      ctx.moveTo(px, py);
      let a = rand(0, 6.28);
      for (let s = 0; s < 8; s++) {
        a += rand(-0.7, 0.7);
        px += Math.cos(a) * rand(10, 30);
        py += Math.sin(a) * rand(10, 30);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // snow drifts
  for (let i = 0; i < 40; i++) blotch(ctx, rand(0, W), rand(0, H), rand(40, 120), 'rgba(235,245,255,0.18)');
  // ice rocks
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(10, 26);
    ctx.fillStyle = 'rgba(40,60,80,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 8, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7d93a6';
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28;
      ctx.lineTo(x + Math.cos(a) * r * rand(0.7, 1), y + Math.sin(a) * r * rand(0.6, 0.9));
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.2, y - r * 0.25, r * 0.6, r * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  winding(ctx, 540, 60, 'rgba(120,140,160,0.25)', 90, 2.1);
  clearBases(ctx, 'rgba(120,140,160,0.5)');
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? rand(10, 140) : W - rand(10, 140);
    const y = rand(60, H - 60);
    if (!P.nearBase(side, y)) P.pine(ctx, side, y, rand(18, 32));
  }
  for (let i = 0; i < 6; i++) { const [x, y] = P.spot(40, true); P.pine(ctx, x, y, rand(16, 26)); }
  P.dome(ctx, 860, 560, 34, '#c23b2a');
  P.dome(ctx, 920, 620, 22, '#c23b2a');
  P.fuelTank(ctx, 800, 640, 18);
  P.fuelTank(ctx, 200, 1300, 22);
  P.fuelTank(ctx, 240, 1340, 16);
  P.bunker(ctx, 180, 620, 64, '#8b98a3');
  P.battlefield(ctx, 'rgba(235,245,255,0.55)', '#a8a490');
  P.vignette(ctx, 0.45);
  return cv;
}

const POOLS: [number, number, number, number][] = [
  [260, 620, 190, 110], [820, 820, 170, 120], [430, 1060, 230, 120], [180, 1380, 140, 90], [880, 1360, 150, 100], [700, 560, 90, 60],
];

function paintSwamp(): HTMLCanvasElement {
  const cv = noiseGround('#1b1d17', '#2c3122', '#4a4630', 80, 21, 14);
  const ctx = cv.getContext('2d')!;
  for (let i = 0; i < 60; i++) blotch(ctx, rand(0, W), rand(0, H), rand(40, 120), `rgba(${rand(50, 70) | 0},${rand(30, 50) | 0},${rand(60, 80) | 0},0.3)`);
  // stained banks around the pools
  for (const [x, y, rx, ry] of POOLS) {
    ctx.fillStyle = 'rgba(30,45,20,0.8)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx * 1.15, ry * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    blotch(ctx, x, y, Math.max(rx, ry) * 1.6, 'rgba(110,190,40,0.18)');
  }
  // dead trees (top-down stumps + fallen logs)
  for (let i = 0; i < 26; i++) {
    const x = rand(0, W), y = rand(0, H);
    ctx.strokeStyle = '#2a2219';
    ctx.lineWidth = rand(5, 9);
    ctx.lineCap = 'round';
    const a = rand(0, 6.28), l = rand(30, 80);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
    ctx.fillStyle = '#3a2f22';
    ctx.beginPath();
    ctx.arc(x, y, rand(6, 10), 0, 6.28);
    ctx.fill();
  }
  // rusted barrels
  for (let i = 0; i < 14; i++) {
    const x = rand(0, W), y = rand(0, H);
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = '#b8e02c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  winding(ctx, 540, 50, 'rgba(60,55,40,0.5)', 140, 0.4);
  clearBases(ctx, 'rgba(50,50,40,0.6)');
  for (let i = 0; i < 40; i++) { const [x, y] = P.spot(20); P.reeds(ctx, x, y); }
  for (let i = 0; i < 12; i++) { const [x, y] = P.spot(40); P.deadTree(ctx, x, y, rand(24, 40)); }
  P.wreckMech(ctx, 820, 1090, 60);
  P.wreckMech(ctx, 240, 900, 46);
  P.pipe(ctx, -20, 1220, 420, 1180);
  P.pipe(ctx, 1100, 720, 700, 690);
  for (let i = 0; i < 6; i++) { const [x, y] = P.spot(40); P.barrels(ctx, x, y, 3 + ((Math.random() * 3) | 0), '#5a3a1e', '#b8e02c'); }
  P.battlefield(ctx, 'rgba(90,100,50,0.5)', '#6a6448');
  P.vignette(ctx, 0.6);
  return cv;
}

function paintCity(): HTMLCanvasElement {
  const cv = noiseGround('#24272d', '#30343b', '#40444c', 60, 31, 10);
  const ctx = cv.getContext('2d')!;
  const roadsX = [160, 540, 920];
  const roadsY = [560, 960, 1360];
  // roads
  for (const x of roadsX) {
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(x - 55, 0, 110, H);
  }
  for (const y of roadsY) {
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, y - 55, W, 110);
  }
  ctx.fillStyle = 'rgba(230,190,60,0.55)';
  for (const x of roadsX) for (let y = 0; y < H; y += 46) ctx.fillRect(x - 2, y, 4, 24);
  for (const y of roadsY) for (let x = 0; x < W; x += 46) ctx.fillRect(x, y - 2, 24, 4);
  // blocks with ruined buildings (rooftops seen from above)
  const xs = [0, ...roadsX.map((x) => [x - 55, x + 55]).flat(), W];
  const ys = [0, ...roadsY.map((y) => [y - 55, y + 55]).flat(), H];
  for (let i = 0; i < xs.length; i += 2)
    for (let j = 0; j < ys.length; j += 2) {
      const x0 = xs[i], x1 = xs[i + 1], y0 = ys[j], y1 = ys[j + 1];
      ctx.fillStyle = '#4a4d54'; // sidewalk
      ctx.fillRect(x0 + 6, y0 + 6, x1 - x0 - 12, y1 - y0 - 12);
      const nearBase = TEAMS.some((t) => Math.abs((x0 + x1) / 2 - t.base.x) < 260 && Math.abs((y0 + y1) / 2 - t.base.y) < 230);
      if (nearBase) continue;
      // split block into 1-3 buildings
      const n = 1 + ((Math.random() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const bw = (x1 - x0 - 30) / n;
        const bx = x0 + 15 + k * bw, by = y0 + 15, bh = y1 - y0 - 30;
        if (bw < 30 || bh < 30) continue;
        // shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(bx + 10, by + 12, bw - 6, bh);
        ctx.fillStyle = `rgb(${rand(55, 75) | 0},${rand(58, 78) | 0},${rand(66, 86) | 0})`;
        ctx.fillRect(bx, by, bw - 6, bh);
        // roof details
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 6, by + 6, bw - 18, bh - 12);
        for (let v = 0; v < 3; v++) {
          ctx.fillStyle = '#2a2d33';
          ctx.fillRect(bx + rand(10, bw - 30), by + rand(10, bh - 30), rand(10, 18), rand(10, 18));
        }
        P.rooftop(ctx, bx, by, bw - 6, bh);
        // destroyed chunk: crater into roof with rubble
        if (Math.random() < 0.7) {
          const cx = bx + rand(0, bw), cy = by + rand(0, bh), r = rand(20, 50);
          ctx.fillStyle = '#17181b';
          ctx.beginPath();
          for (let a = 0; a < 12; a++) {
            const ang = (a / 12) * 6.28;
            ctx.lineTo(cx + Math.cos(ang) * r * rand(0.6, 1.1), cy + Math.sin(ang) * r * rand(0.6, 1.1));
          }
          ctx.fill();
          for (let q = 0; q < 30; q++) {
            ctx.fillStyle = `rgba(${rand(80, 130) | 0},${rand(80, 120) | 0},${rand(80, 110) | 0},0.9)`;
            ctx.fillRect(cx + rand(-r * 1.4, r * 1.4), cy + rand(-r * 1.4, r * 1.4), rand(2, 7), rand(2, 7));
          }
        }
      }
    }
  // wrecked cars
  for (let i = 0; i < 12; i++) {
    const vertical = Math.random() < 0.5;
    const x = vertical ? roadsX[(Math.random() * 3) | 0] + rand(-30, 30) : rand(0, W);
    const y = vertical ? rand(0, H) : roadsY[(Math.random() * 3) | 0] + rand(-30, 30);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((vertical ? Math.PI / 2 : 0) + rand(-0.4, 0.4));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-15, -6, 34, 18);
    ctx.fillStyle = ['#5a2a24', '#2a3a4a', '#3a3a30'][i % 3];
    ctx.fillRect(-18, -9, 36, 18);
    ctx.fillStyle = '#121418';
    ctx.fillRect(-6, -7, 14, 14);
    ctx.restore();
  }
  for (let i = 0; i < 30; i++) blotch(ctx, rand(0, W), rand(0, H), rand(30, 80), 'rgba(0,0,0,0.25)');
  // barricades at intersections + street lights
  for (const x of roadsX) for (const y of roadsY) {
    if (P.nearBase(x, y, 260)) continue;
    if (Math.random() < 0.6) P.sandbags(ctx, x + rand(-30, 30), y + rand(-30, 30), 70, rand(0, 3.14), '#8a8070');
    if (Math.random() < 0.5) P.hedgehog(ctx, x + rand(-40, 40), y + rand(-40, 40));
    for (const [dx, dy] of [[-60, -60], [60, 60]]) {
      ctx.fillStyle = '#2a2d33';
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 4, 0, 6.28);
      ctx.fill();
    }
  }
  for (let i = 0; i < 10; i++) { const [x, y] = P.spot(30); P.crate(ctx, x, y, rand(12, 18), '#5a5040'); }
  P.battlefield(ctx, 'rgba(140,140,140,0.5)', '#8a8070');
  P.vignette(ctx, 0.55);
  return cv;
}

// ------------------------------------------------------------ toxic pool shader
const VERT = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreen;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void){
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  vScreen = position;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}`;

const FRAG = `in vec2 vTextureCoord;
in vec2 vScreen;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 uv = vScreen / 70.0;
  float t = uTime;
  float a = n(uv + vec2(t*0.25, t*0.1));
  float b = n(uv*1.7 - vec2(t*0.15, t*0.3));
  float caust = smoothstep(0.35, 0.0, abs(a-b));
  vec4 m = texture(uTexture, vTextureCoord);
  vec3 deep = vec3(0.10, 0.35, 0.05);
  vec3 lit  = vec3(0.55, 1.0, 0.15);
  float pulse = 0.85 + 0.15*sin(t*1.7 + vScreen.x*0.01);
  vec3 col = mix(deep, lit, caust*0.8 + a*0.2) * pulse;
  float edge = smoothstep(0.0, 0.5, m.a) - smoothstep(0.5, 1.0, m.a);
  col += vec3(0.6,1.0,0.3) * edge * 0.6;
  finalColor = vec4(col, 1.0) * m.a * 0.92;
}`;

function poolMask(): Texture {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  for (const [x, y, rx, ry] of POOLS) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let a = 0; a <= 24; a++) {
      const ang = (a / 24) * 6.28;
      const r = rx * (0.92 + Math.sin(ang * 3 + x) * 0.06);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.fill();
    ctx.restore();
  }
  return Texture.from(cv);
}

// ------------------------------------------------------------ trees (jungle canopy, drawn once)
function treeTexture(seed: number): Texture {
  const s = 180;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d')!;
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let layer = 0; layer < 3; layer++) {
    const n = 7 - layer * 2;
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = rnd() * (40 - layer * 14);
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d, rad = 34 - layer * 6 + rnd() * 10;
      const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 2, x, y, rad);
      const base = [[30, 70, 30], [45, 100, 38], [80, 140, 50]][layer];
      g.addColorStop(0, `rgb(${base[0] + 40},${base[1] + 50},${base[2] + 20})`);
      g.addColorStop(0.7, `rgb(${base[0]},${base[1]},${base[2]})`);
      g.addColorStop(1, `rgba(${base[0] - 20},${base[1] - 30},${base[2] - 10},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, 6.28);
      ctx.fill();
    }
  }
  return Texture.from(cv);
}

// ------------------------------------------------------------ public
export interface TerrainScene {
  ground: Sprite;
  over: Container; // things drawn above units (canopy)
  under: Container; // animated ground layer (pools, sparkles)
  update(dt: number, t: number, wind: number): void;
  destroy(): void;
}

export function buildTerrain(key: TerrainKey, fx: FxTextures, particles: Particles): TerrainScene {
  const painter = { jungle: paintJungle, ice: paintIce, swamp: paintSwamp, city: paintCity }[key];
  const tex = Texture.from(painter());
  const ground = new Sprite(tex);
  const under = new Container();
  const over = new Container();
  const ownTextures: Texture[] = [tex];
  const updaters: ((dt: number, t: number, wind: number) => void)[] = [];

  if (key === 'jungle') {
    const trees: Sprite[] = [];
    const tt = [treeTexture(5), treeTexture(77), treeTexture(901)];
    ownTextures.push(...tt);
    const spots: [number, number][] = [];
    for (let y = 80; y < H; y += 120) {
      spots.push([rand(-40, 70), y + rand(-30, 30)], [W - rand(-40, 70), y + rand(-30, 30)]);
      if (Math.random() < 0.35) spots.push([rand(180, W - 180), y]);
    }
    for (const [x, y] of spots) {
      if (TEAMS.some((t) => Math.hypot(x - t.base.x, y - t.base.y) < 230)) continue;
      const shadow = new Sprite(tt[(Math.random() * 3) | 0]);
      shadow.anchor.set(0.5);
      shadow.position.set(x + 24, y + 30);
      shadow.tint = 0x000000;
      shadow.alpha = 0.35;
      shadow.scale.set(rand(0.8, 1.3));
      under.addChild(shadow);
      const s = new Sprite(shadow.texture);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.scale.copyFrom(shadow.scale);
      s.rotation = rand(0, 6.28);
      over.addChild(s);
      trees.push(s);
    }
    // light shafts
    const shafts: Sprite[] = [];
    for (let i = 0; i < 5; i++) {
      const s = new Sprite(fx.beam);
      s.anchor.set(0.5);
      s.position.set(rand(100, W - 100), rand(200, H - 200));
      s.rotation = 0.5;
      s.width = 900;
      s.height = 140;
      s.blendMode = 'add';
      s.tint = 0xfff2b0;
      s.alpha = 0.06;
      over.addChild(s);
      shafts.push(s);
    }
    updaters.push((dt, t, wind) => {
      trees.forEach((s, i) => {
        s.skew.set(Math.sin(t * 1.3 + i) * 0.03 * (1 + wind * 3), Math.cos(t * 1.1 + i) * 0.03 * (1 + wind * 3));
      });
      shafts.forEach((s, i) => (s.alpha = 0.05 + Math.sin(t * 0.5 + i * 2) * 0.03));
      if (Math.random() < dt * 6) particles.firefly(rand(0, W), rand(0, H));
    });
  }

  if (key === 'ice') {
    const sheen = new Sprite(fx.beam);
    sheen.anchor.set(0.5);
    sheen.rotation = -0.6;
    sheen.width = 2400;
    sheen.height = 220;
    sheen.alpha = 0.1;
    sheen.blendMode = 'add';
    under.addChild(sheen);
    updaters.push((dt, t) => {
      sheen.position.set(((t * 120) % 2600) - 700, H / 2);
      if (Math.random() < dt * 25) particles.sparkle(rand(0, W), rand(0, H));
    });
  }

  if (key === 'swamp') {
    const mask = poolMask();
    ownTextures.push(mask);
    const pools = new Sprite(mask);
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: VERT, fragment: FRAG, name: 'toxic-pool' }),
      resources: { poolUniforms: { uTime: { value: 0, type: 'f32' } } },
    });
    pools.filters = [filter];
    under.addChild(pools);
    const glow: Sprite[] = POOLS.map(([x, y, rx, ry]) => {
      const g = new Sprite(fx.glow);
      g.anchor.set(0.5);
      g.position.set(x, y);
      g.width = rx * 3;
      g.height = ry * 3;
      g.tint = 0x7dff2a;
      g.blendMode = 'add';
      g.alpha = 0.18;
      over.addChild(g);
      return g;
    });
    updaters.push((dt, t) => {
      filter.resources.poolUniforms.uniforms.uTime = t;
      glow.forEach((g, i) => (g.alpha = 0.14 + Math.sin(t * 1.5 + i) * 0.05));
      if (Math.random() < dt * 14) {
        const [x, y, rx, ry] = POOLS[(Math.random() * POOLS.length) | 0];
        const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * 0.8;
        particles.bubble(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d);
      }
      if (Math.random() < dt * 3) {
        const [x, y] = POOLS[(Math.random() * POOLS.length) | 0];
        particles.mist(x + rand(-60, 60), y + rand(-30, 30), 0x6dff3a);
      }
    });
  }

  if (key === 'city') {
    const lights = [[60, 760], [1020, 1160], [40, 1500]].map(([x, y], i) => {
      const b = new Sprite(fx.beam);
      b.anchor.set(0, 0.5);
      b.position.set(x, y);
      b.width = 700;
      b.height = 90;
      b.tint = 0xdfe8ff;
      b.alpha = 0.08;
      b.blendMode = 'add';
      over.addChild(b);
      return { b, base: x < W / 2 ? 0 : Math.PI, ph: i * 2 };
    });
    updaters.push((_dt, t) => lights.forEach((l) => (l.b.rotation = l.base + Math.sin(t * 0.35 + l.ph) * 0.6)));
    const fires: [number, number][] = [];
    for (let i = 0; i < 9; i++) fires.push([rand(60, W - 60), rand(200, H - 200)]);
    const signs: Sprite[] = [];
    const neon = [0xff2bd6, 0x2bf0ff, 0xffd02b];
    for (let i = 0; i < 10; i++) {
      const s = new Sprite(fx.glow);
      s.anchor.set(0.5);
      s.position.set(rand(0, W), rand(0, H));
      s.width = rand(60, 120);
      s.height = rand(20, 40);
      s.tint = neon[i % 3];
      s.blendMode = 'add';
      over.addChild(s);
      signs.push(s);
    }
    updaters.push((dt, t) => {
      signs.forEach((s, i) => (s.alpha = Math.sin(t * 7 + i * 13) > 0.85 - (i % 3) * 0.3 ? 0.15 : 0.55));
      for (const [x, y] of fires) {
        if (Math.random() < dt * 20) particles.flame(x + rand(-8, 8), y + rand(-5, 5), 0.8);
        if (Math.random() < dt * 4) particles.smokePuff(x, y - 10, 0.9, 0x333333, 2.2, 0.45);
      }
      if (Math.random() < dt * 2) particles.sparks(rand(0, W), rand(0, H), 6, 0xffd27a, 120);
    });
  }

  return {
    ground,
    over,
    under,
    update(dt, t, wind) {
      for (const u of updaters) u(dt, t, wind);
    },
    destroy() {
      ground.destroy();
      under.destroy({ children: true });
      over.destroy({ children: true });
      ownTextures.forEach((t) => t.destroy(true));
    },
  };
}
