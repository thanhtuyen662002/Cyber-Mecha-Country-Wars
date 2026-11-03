// Map props painted straight into the baked terrain canvas (zero runtime cost).
// All seen from directly above, lit from the top-left, with a soft drop shadow.
import { H, RESERVED, W, rand } from '../core/config';

type C = CanvasRenderingContext2D;

export const nearBase = (x: number, y: number, r = 230) => RESERVED.some((t) => Math.hypot(x - t.x, y - t.y) < Math.max(r * 0.6, t.r));

/** Random spot that avoids both fortresses and (optionally) the central lane. */
export function spot(margin = 30, avoidLane = false): [number, number] {
  for (let i = 0; i < 40; i++) {
    const x = rand(margin, W - margin), y = rand(margin, H - margin);
    if (nearBase(x, y)) continue;
    if (avoidLane && Math.abs(x - W / 2) < 120) continue;
    return [x, y];
  }
  return [rand(0, W), rand(0, H)];
}

function shadow(ctx: C, draw: () => void, dx = 6, dy = 8, a = 0.35) {
  ctx.save();
  ctx.translate(dx, dy);
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  draw();
  ctx.restore();
}

function poly(ctx: C, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function rock(ctx: C, x: number, y: number, r: number, base: string, light: string, moss?: string) {
  const pts: number[] = [];
  const n = 7 + ((Math.random() * 4) | 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.28;
    pts.push(x + Math.cos(a) * r * rand(0.7, 1.05), y + Math.sin(a) * r * rand(0.65, 0.95));
  }
  shadow(ctx, () => (poly(ctx, pts), ctx.fill()), r * 0.35, r * 0.45);
  ctx.fillStyle = base;
  poly(ctx, pts);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y - r * 0.25, r * 0.5, r * 0.32, -0.5, 0, 6.28);
  ctx.fill();
  if (moss) {
    ctx.fillStyle = moss;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.4, r * rand(0.15, 0.3), 0, 6.28);
      ctx.fill();
    }
  }
}

export function sandbags(ctx: C, x: number, y: number, len: number, rot: number, color = '#8a7a58') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const n = Math.max(3, Math.round(len / 12));
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < n; i++) {
      const bx = -len / 2 + i * 12 + (row ? 6 : 0), by = row * 8 - 4;
      shadow(ctx, () => (ctx.beginPath(), ctx.ellipse(bx, by, 6.5, 4.5, 0, 0, 6.28), ctx.fill()), 2, 3, 0.4);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(bx, by, 6.5, 4.5, 0, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(bx - 4, by - 3, 5, 1.5);
    }
  ctx.restore();
}

export function hedgehog(ctx: C, x: number, y: number, s = 12) {
  // Czech hedgehog anti-tank obstacle: three crossed steel beams
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand(0, 6.28));
  ctx.lineCap = 'square';
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 0) ctx.translate(4, 5);
    else ctx.translate(-4, -5);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      ctx.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.35)' : k === 0 ? '#5d636d' : '#474c55';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * -s, Math.sin(a) * -s);
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function crate(ctx: C, x: number, y: number, s: number, color = '#6b5a3c') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand(-0.4, 0.4));
  shadow(ctx, () => ctx.fillRect(-s / 2, -s / 2, s, s), 4, 5);
  ctx.fillStyle = color;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
  ctx.beginPath();
  ctx.moveTo(-s / 2, -s / 2);
  ctx.lineTo(s / 2, s / 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-s / 2, -s / 2, s, 2);
  ctx.restore();
}

export function barrels(ctx: C, x: number, y: number, n: number, color: string, ring: string) {
  for (let i = 0; i < n; i++) {
    const bx = x + rand(-14, 14), by = y + rand(-14, 14);
    shadow(ctx, () => (ctx.beginPath(), ctx.arc(bx, by, 7, 0, 6.28), ctx.fill()), 3, 4);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = ring;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, 6.28);
    ctx.stroke();
  }
}

export function crater(ctx: C, x: number, y: number, r: number, rim: string) {
  const g = ctx.createRadialGradient(x - r * 0.15, y - r * 0.15, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.3)');
  g.addColorStop(0.85, rim);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.35, r * 0.55, -0.2, 1.8);
  ctx.arc(x + r * 0.35, y + r * 0.35, r * 0.4, 1.8, -0.2, true);
  ctx.fill();
}

export function barbedWire(ctx: C, x: number, y: number, len: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = 'rgba(30,30,30,0.7)';
  ctx.lineWidth = 1;
  for (let i = -len / 2; i < len / 2; i += 6) {
    ctx.beginPath();
    ctx.arc(i, 0, 5, 0, 6.28);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a3226';
  for (let i = -len / 2; i <= len / 2; i += 30) ctx.fillRect(i - 2, -2, 4, 4);
  ctx.restore();
}

export function log(ctx: C, x: number, y: number, len: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  shadow(ctx, () => ctx.fillRect(-len / 2, -6, len, 12), 4, 6);
  const g = ctx.createLinearGradient(0, -7, 0, 7);
  g.addColorStop(0, '#7a5a3a');
  g.addColorStop(1, '#3a2818');
  ctx.fillStyle = g;
  ctx.fillRect(-len / 2, -6, len, 12);
  ctx.fillStyle = '#a07c52';
  ctx.beginPath();
  ctx.ellipse(len / 2, 0, 3, 6, 0, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

export function bush(ctx: C, x: number, y: number, r: number, dark: string, light: string) {
  shadow(ctx, () => (ctx.beginPath(), ctx.arc(x, y, r, 0, 6.28), ctx.fill()), r * 0.3, r * 0.4, 0.3);
  for (let i = 0; i < 5; i++) {
    const a = rand(0, 6.28), d = rand(0, r * 0.5), rr = r * rand(0.45, 0.7);
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    const g = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, 1, cx, cy, rr);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, 6.28);
    ctx.fill();
  }
}

export function stoneRuin(ctx: C, x: number, y: number, s: number) {
  // ancient temple foundation: broken square of carved blocks
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand(-0.3, 0.3));
  const block = (bx: number, by: number, w: number, h: number) => {
    shadow(ctx, () => ctx.fillRect(bx, by, w, h), 5, 6);
    ctx.fillStyle = '#7d7a68';
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = 'rgba(255,255,230,0.18)';
    ctx.fillRect(bx, by, w, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(70,120,50,0.6)';
    ctx.beginPath();
    ctx.arc(bx + rand(0, w), by + rand(0, h), rand(3, 7), 0, 6.28);
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(120,115,95,0.35)';
  ctx.fillRect(-s / 2, -s / 2, s, s);
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.35) continue;
      const side = i;
      const t = -s / 2 + (k * s) / 4;
      if (side === 0) block(t, -s / 2, s / 4 - 3, 14);
      if (side === 1) block(t, s / 2 - 14, s / 4 - 3, 14);
      if (side === 2) block(-s / 2, t, 14, s / 4 - 3);
      if (side === 3) block(s / 2 - 14, t, 14, s / 4 - 3);
    }
  }
  // central idol / altar
  block(-12, -12, 24, 24);
  ctx.restore();
}

export function bunker(ctx: C, x: number, y: number, s: number, color = '#5a5d55') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand(-0.5, 0.5));
  shadow(ctx, () => (ctx.beginPath(), ctx.roundRect(-s / 2, -s / 3, s, (s * 2) / 3, 10), ctx.fill()), 8, 10);
  const g = ctx.createLinearGradient(-s / 2, -s / 3, s / 2, s / 3);
  g.addColorStop(0, '#8a8d84');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 3, s, (s * 2) / 3, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.fillRect(-s / 4, s / 3 - 5, s / 2, 4); // gun slit
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(-s / 2 + 6, -s / 3 + 4, s - 12, 3);
  ctx.restore();
}

export function pine(ctx: C, x: number, y: number, r: number) {
  // snowy pine from above: star of needle tiers with snow caps
  shadow(ctx, () => (ctx.beginPath(), ctx.arc(x, y, r, 0, 6.28), ctx.fill()), r * 0.5, r * 0.6, 0.3);
  for (let tier = 0; tier < 3; tier++) {
    const rr = r * (1 - tier * 0.28);
    const n = 9 - tier * 2;
    const pts: number[] = [];
    for (let k = 0; k < n * 2; k++) {
      const a = (k / (n * 2)) * 6.28 + tier * 0.3;
      const d = k % 2 ? rr * 0.55 : rr;
      pts.push(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.fillStyle = ['#1f3b33', '#2b4d42', '#3a6152'][tier];
    poly(ctx, pts);
    ctx.fill();
    ctx.fillStyle = 'rgba(240,248,255,0.75)';
    for (let k = 0; k < n; k += 2) {
      const a = (k / n) * 6.28 + tier * 0.3 - 0.4;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.7, rr * 0.18, rr * 0.1, a, 0, 6.28);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f4f9ff';
  ctx.beginPath();
  ctx.arc(x - 1, y - 1, r * 0.12, 0, 6.28);
  ctx.fill();
}

export function dome(ctx: C, x: number, y: number, r: number, tint: string) {
  shadow(ctx, () => (ctx.beginPath(), ctx.arc(x, y, r, 0, 6.28), ctx.fill()), r * 0.3, r * 0.35);
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#f2f6fa');
  g.addColorStop(0.6, '#a9b6c2');
  g.addColorStop(1, '#5c6875');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos((k / 6) * 6.28) * r, y + Math.sin((k / 6) * 6.28) * r);
    ctx.stroke();
  }
  ctx.fillStyle = tint;
  ctx.fillRect(x - r * 0.15, y + r * 0.7, r * 0.3, r * 0.35);
}

export function fuelTank(ctx: C, x: number, y: number, r: number) {
  shadow(ctx, () => (ctx.beginPath(), ctx.arc(x, y, r, 0, 6.28), ctx.fill()), 6, 8);
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 2, x, y, r);
  g.addColorStop(0, '#d9dde2');
  g.addColorStop(1, '#6d7680');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.65, 0, 6.28);
  ctx.stroke();
  ctx.fillStyle = '#c23b2a';
  ctx.fillRect(x - 4, y - 4, 8, 8);
}

export function deadTree(ctx: C, x: number, y: number, r: number) {
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, a: number, len: number, w: number, depth: number) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(bx + 8, by + 10);
    ctx.lineTo(ex + 8, ey + 10);
    ctx.stroke();
    ctx.strokeStyle = depth === 0 ? '#3b3024' : '#4a3d2e';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth < 2) for (let i = 0; i < 2; i++) branch(ex, ey, a + rand(-0.8, 0.8), len * 0.6, w * 0.6, depth + 1);
  };
  for (let i = 0; i < 4; i++) branch(x, y, rand(0, 6.28), r * rand(0.5, 0.8), 4, 0);
  ctx.fillStyle = '#2a2219';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 6.28);
  ctx.fill();
}

export function wreckMech(ctx: C, x: number, y: number, s: number) {
  // half-sunk dead war machine, rusted
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand(0, 6.28));
  shadow(ctx, () => ctx.fillRect(-s / 2, -s / 3, s, (s * 2) / 3), 6, 8);
  ctx.fillStyle = '#4a3a2c';
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 3, s, (s * 2) / 3, 6);
  ctx.fill();
  ctx.fillStyle = '#6a4a30';
  ctx.fillRect(-s / 4, -s / 5, s / 2, (s * 2) / 5);
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(s / 2 - 4, 0);
  ctx.lineTo(s, rand(-10, 10));
  ctx.stroke();
  for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-s / 4, (sy * s) / 3);
    ctx.lineTo(-s / 3, sy * s * 0.75);
    ctx.lineTo(-s / 1.6, sy * s * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(140,230,60,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.7, s * 0.5, 0, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

export function pipe(ctx: C, x0: number, y0: number, x1: number, y1: number) {
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(x0 + 6, y0 + 8);
  ctx.lineTo(x1 + 6, y1 + 8);
  ctx.stroke();
  ctx.strokeStyle = '#5a5e52';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, y0 - 3);
  ctx.lineTo(x1, y1 - 3);
  ctx.stroke();
  const len = Math.hypot(x1 - x0, y1 - y0);
  for (let d = 30; d < len; d += 60) {
    const t = d / len;
    ctx.fillStyle = '#3d4038';
    ctx.beginPath();
    ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 8, 0, 6.28);
    ctx.fill();
  }
}

export function reeds(ctx: C, x: number, y: number) {
  ctx.strokeStyle = 'rgba(120,140,60,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = rand(0, 6.28), l = rand(6, 14);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

export function rooftop(ctx: C, bx: number, by: number, bw: number, bh: number) {
  // HVAC units, solar panels, water tank, helipad
  const kind = Math.random();
  if (kind < 0.25 && bw > 90 && bh > 90) {
    const cx = bx + bw / 2, cy = by + bh / 2, r = Math.min(bw, bh) * 0.3;
    ctx.strokeStyle = 'rgba(230,230,230,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.28);
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,230,230,0.5)';
    ctx.font = `bold ${r}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', cx, cy + 2);
    return;
  }
  if (kind < 0.5) {
    for (let i = 0; i < 6; i++) {
      const w = 16, h = 10, x = bx + 10 + (i % 3) * 20, y = by + 10 + Math.floor(i / 3) * 14;
      if (x + w > bx + bw - 6 || y + h > by + bh - 6) continue;
      ctx.fillStyle = '#1c2a44';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(120,170,255,0.35)';
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }
  for (let i = 0; i < 3; i++) {
    const s = rand(10, 16), x = bx + rand(8, Math.max(9, bw - 24)), y = by + rand(8, Math.max(9, bh - 24));
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 3, y + 4, s, s);
    ctx.fillStyle = '#7a7f88';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#2e3238';
    ctx.beginPath();
    ctx.arc(x + s / 2, y + s / 2, s * 0.32, 0, 6.28);
    ctx.fill();
  }
  if (kind > 0.8) {
    const x = bx + bw - 22, y = by + 22;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(x + 5, y + 6, 12, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = '#6a5440';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = '#3a2c20';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

export function vignette(ctx: C, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Generic battlefield clutter shared by every map. */
export function battlefield(ctx: C, rim: string, bagColor: string) {
  for (let i = 0; i < 10; i++) {
    const [x, y] = spot(40);
    crater(ctx, x, y, rand(18, 42), rim);
  }
  // defensive lines in front of each fortress slot, facing the map centre
  for (const t of RESERVED) {
    const a = Math.atan2(H / 2 - t.y, W / 2 - t.x);
    const fx = Math.cos(a), fy = Math.sin(a), sx = -fy, sy = fx;
    const d = t.r + 40;
    for (const s of [-1, 1]) {
      sandbags(ctx, t.x + fx * d + sx * s * 70, t.y + fy * d + sy * s * 70, 70, a + Math.PI / 2 + s * 0.3, bagColor);
      hedgehog(ctx, t.x + fx * (d + 50) + sx * s * 120, t.y + fy * (d + 50) + sy * s * 120);
    }
    barbedWire(ctx, t.x + fx * (d + 30), t.y + fy * (d + 30), 90, a + Math.PI / 2);
    for (let i = 0; i < 2; i++) crate(ctx, t.x + fx * d + sx * rand(-120, 120), t.y + fy * d + sy * rand(-120, 120), rand(12, 16));
  }
  for (let i = 0; i < 6; i++) {
    const [x, y] = spot(60, true);
    sandbags(ctx, x, y, rand(50, 90), rand(0, 3.14), bagColor);
  }
}
