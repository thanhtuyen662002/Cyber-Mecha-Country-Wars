// Code-drawn country flags, baked into one atlas texture at startup.
// Simplified but recognisable at the small sizes used on stream (24-96 px wide).
import { Rectangle, Texture } from 'pixi.js';
import { COUNTRIES, type CountryDef, type FlagSpec, MERC } from '../core/countries';

const FW = 96, FH = 64;
type C = CanvasRenderingContext2D;

function star(x: C, cx: number, cy: number, r: number, color: string, points = 5, inner = 0.42, rot = -Math.PI / 2) {
  x.fillStyle = color;
  x.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i * Math.PI) / points;
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath();
  x.fill();
}
const rect = (x: C, c: string, a: number, b: number, w: number, h: number) => ((x.fillStyle = c), x.fillRect(a, b, w, h));
const circle = (x: C, c: string, cx: number, cy: number, r: number) => {
  x.fillStyle = c;
  x.beginPath();
  x.arc(cx, cy, r, 0, Math.PI * 2);
  x.fill();
};
const poly = (x: C, c: string, pts: number[]) => {
  x.fillStyle = c;
  x.beginPath();
  x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.closePath();
  x.fill();
};
function bands(x: C, cols: string[], weights: number[] | undefined, vertical: boolean, w = FW, hh = FH) {
  const ws = weights ?? cols.map(() => 1);
  const tot = ws.reduce((a, b) => a + b, 0);
  let p = 0;
  cols.forEach((c, i) => {
    const s = (ws[i] / tot) * (vertical ? w : hh);
    if (vertical) rect(x, c, p, 0, Math.ceil(s), hh);
    else rect(x, c, 0, p, w, Math.ceil(s));
    p += s;
  });
}
function crescent(x: C, cx: number, cy: number, r: number, bg: string, fg = '#ffffff', off = 0.28) {
  circle(x, fg, cx, cy, r);
  circle(x, bg, cx + r * off, cy, r * 0.8);
}
function unionJack(x: C, w: number, hh: number) {
  rect(x, '#012169', 0, 0, w, hh);
  x.save();
  x.lineCap = 'butt';
  x.strokeStyle = '#ffffff';
  x.lineWidth = hh * 0.2;
  x.beginPath();
  x.moveTo(0, 0); x.lineTo(w, hh); x.moveTo(w, 0); x.lineTo(0, hh);
  x.stroke();
  x.strokeStyle = '#c8102e';
  x.lineWidth = hh * 0.07;
  x.stroke();
  x.restore();
  rect(x, '#ffffff', w / 2 - hh * 0.17, 0, hh * 0.34, hh);
  rect(x, '#ffffff', 0, hh / 2 - hh * 0.17, w, hh * 0.34);
  rect(x, '#c8102e', w / 2 - hh * 0.1, 0, hh * 0.2, hh);
  rect(x, '#c8102e', 0, hh / 2 - hh * 0.1, w, hh * 0.2);
}

const CUSTOM: Record<string, (x: C) => void> = {
  US(x) {
    for (let i = 0; i < 13; i++) rect(x, i % 2 ? '#ffffff' : '#b22234', 0, (i * FH) / 13, FW, FH / 13 + 1);
    rect(x, '#3c3b6e', 0, 0, FW * 0.42, (FH * 7) / 13);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) star(x, 5 + c * 6.4 + (r % 2) * 3, 4.5 + r * 6.3, 2.2, '#ffffff');
  },
  GB(x) { unionJack(x, FW, FH); },
  CA(x) {
    bands(x, ['#d80621', '#ffffff', '#d80621'], [1, 2, 1], true);
    // stylised maple leaf
    poly(x, '#d80621', [48, 12, 53, 22, 60, 19, 57, 33, 66, 27, 64, 36, 58, 40, 50, 39, 50, 52, 46, 52, 46, 39, 38, 40, 32, 36, 30, 27, 39, 33, 36, 19, 43, 22]);
  },
  AU(x) {
    rect(x, '#00008b', 0, 0, FW, FH);
    x.save(); x.beginPath(); x.rect(0, 0, FW / 2, FH / 2); x.clip(); unionJack(x, FW / 2, FH / 2); x.restore();
    star(x, 24, 48, 7, '#ffffff', 7, 0.5);
    for (const [a, b, r] of [[72, 14, 4], [62, 30, 4], [82, 26, 4], [72, 52, 4.5], [78, 38, 2]] as const) star(x, a, b, r, '#ffffff', 7, 0.5);
  },
  NZ(x) {
    rect(x, '#00247d', 0, 0, FW, FH);
    x.save(); x.beginPath(); x.rect(0, 0, FW / 2, FH / 2); x.clip(); unionJack(x, FW / 2, FH / 2); x.restore();
    for (const [a, b, r] of [[72, 14, 4.5], [62, 30, 4.5], [82, 27, 4], [72, 50, 5]] as const) { star(x, a, b, r + 1.3, '#ffffff'); star(x, a, b, r, '#cc142b'); }
  },
  PT(x) { bands(x, ['#006600', '#ff0000'], [2, 3], true); circle(x, '#ffcc00', 38, 32, 13); circle(x, '#ff0000', 38, 32, 9); rect(x, '#ffffff', 34, 26, 8, 11); },
  CH(x) { rect(x, '#da291c', 0, 0, FW, FH); rect(x, '#ffffff', 42, 14, 12, 36); rect(x, '#ffffff', 30, 26, 36, 12); },
  CZ(x) { bands(x, ['#ffffff', '#d7141a'], undefined, false); poly(x, '#11457e', [0, 0, 44, 32, 0, 64]); },
  GR(x) {
    for (let i = 0; i < 9; i++) rect(x, i % 2 ? '#ffffff' : '#0d5eaf', 0, (i * FH) / 9, FW, FH / 9 + 1);
    rect(x, '#0d5eaf', 0, 0, 36, 36);
    rect(x, '#ffffff', 14, 0, 7, 36); rect(x, '#ffffff', 0, 14, 36, 7);
  },
  TR(x) { rect(x, '#e30a17', 0, 0, FW, FH); crescent(x, 36, 32, 16, '#e30a17'); star(x, 56, 32, 7, '#ffffff', 5, 0.42, Math.PI); },
  BR(x) { rect(x, '#009c3b', 0, 0, FW, FH); poly(x, '#ffdf00', [48, 6, 90, 32, 48, 58, 6, 32]); circle(x, '#002776', 48, 32, 14); rect(x, '#ffffff', 34, 30, 28, 3); },
  AR(x) { bands(x, ['#74acdf', '#ffffff', '#74acdf'], undefined, false); circle(x, '#f6b40e', 48, 32, 7); },
  CL(x) { bands(x, ['#ffffff', '#d52b1e'], undefined, false); rect(x, '#0039a6', 0, 0, 32, 32); star(x, 16, 16, 8, '#ffffff'); },
  PR(x) { for (let i = 0; i < 5; i++) rect(x, i % 2 ? '#ffffff' : '#ed0000', 0, (i * FH) / 5, FW, FH / 5 + 1); poly(x, '#0050f0', [0, 0, 50, 32, 0, 64]); star(x, 16, 32, 8, '#ffffff'); },
  DO(x) { rect(x, '#ffffff', 0, 0, FW, FH); rect(x, '#002d62', 0, 0, 40, 25); rect(x, '#ce1126', 56, 0, 40, 25); rect(x, '#ce1126', 0, 39, 40, 25); rect(x, '#002d62', 56, 39, 40, 25); },
  JM(x) { rect(x, '#009b3a', 0, 0, FW, FH); poly(x, '#000000', [0, 6, 40, 32, 0, 58]); poly(x, '#000000', [96, 6, 56, 32, 96, 58]); x.save(); x.strokeStyle = '#fed100'; x.lineWidth = 9; x.beginPath(); x.moveTo(0, 0); x.lineTo(FW, FH); x.moveTo(FW, 0); x.lineTo(0, FH); x.stroke(); x.restore(); },
  PH(x) { bands(x, ['#0038a8', '#ce1126'], undefined, false); poly(x, '#ffffff', [0, 0, 52, 32, 0, 64]); circle(x, '#fcd116', 17, 32, 7); },
  VN(x) { rect(x, '#da251d', 0, 0, FW, FH); star(x, 48, 33, 18, '#ffff00'); },
  MY(x) { for (let i = 0; i < 14; i++) rect(x, i % 2 ? '#ffffff' : '#cc0001', 0, (i * FH) / 14, FW, FH / 14 + 1); rect(x, '#010066', 0, 0, 48, 36); crescent(x, 18, 18, 11, '#010066', '#ffcc00', 0.32); star(x, 34, 18, 7, '#ffcc00', 14, 0.45); },
  KR(x) { rect(x, '#ffffff', 0, 0, FW, FH); circle(x, '#cd2e3a', 48, 32, 15); x.save(); x.beginPath(); x.rect(0, 32, FW, 32); x.clip(); circle(x, '#0047a0', 48, 32, 15); x.restore(); for (const [a, b] of [[18, 12], [78, 12], [18, 52], [78, 52]]) rect(x, '#000000', a - 6, b - 5, 12, 10); },
  CN(x) { rect(x, '#de2910', 0, 0, FW, FH); star(x, 18, 18, 10, '#ffde00'); for (const [a, b] of [[34, 7], [40, 14], [40, 23], [34, 30]]) star(x, a, b, 3.2, '#ffde00'); },
  TW(x) { rect(x, '#fe0000', 0, 0, FW, FH); rect(x, '#000095', 0, 0, 48, 32); star(x, 24, 16, 10, '#ffffff', 12, 0.55); circle(x, '#000095', 24, 16, 5); circle(x, '#ffffff', 24, 16, 4); },
  IN(x) { bands(x, ['#ff9933', '#ffffff', '#138808'], undefined, false); x.strokeStyle = '#000080'; x.lineWidth = 2; x.beginPath(); x.arc(48, 32, 8, 0, Math.PI * 2); x.stroke(); circle(x, '#000080', 48, 32, 2); },
  PK(x) { rect(x, '#ffffff', 0, 0, 24, FH); rect(x, '#01411c', 24, 0, 72, FH); crescent(x, 60, 34, 16, '#01411c', '#ffffff', -0.3); star(x, 66, 22, 6, '#ffffff'); },
  SA(x) { rect(x, '#006c35', 0, 0, FW, FH); rect(x, '#ffffff', 22, 18, 52, 6); rect(x, '#ffffff', 26, 42, 44, 3); },
  AE(x) { bands(x, ['#00732f', '#ffffff', '#000000'], undefined, false); rect(x, '#ff0000', 0, 0, 26, FH); },
  IL(x) { rect(x, '#ffffff', 0, 0, FW, FH); rect(x, '#0038b8', 0, 8, FW, 8); rect(x, '#0038b8', 0, 48, FW, 8); x.strokeStyle = '#0038b8'; x.lineWidth = 2.5; for (const r of [0, Math.PI]) { x.beginPath(); for (let i = 0; i < 3; i++) { const a = r - Math.PI / 2 + (i * Math.PI * 2) / 3; x.lineTo(48 + Math.cos(a) * 12, 32 + Math.sin(a) * 12); } x.closePath(); x.stroke(); } },
  MA(x) { rect(x, '#c1272d', 0, 0, FW, FH); x.strokeStyle = '#006233'; x.lineWidth = 3; x.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; x.lineTo(48 + Math.cos(a) * 15, 33 + Math.sin(a) * 15); } x.stroke(); },
  DZ(x) { bands(x, ['#006633', '#ffffff'], undefined, true); crescent(x, 50, 32, 15, '#ffffff', '#d21034', -0.3); star(x, 56, 32, 6, '#d21034'); },
  GH(x) { bands(x, ['#ce1126', '#fcd116', '#006b3f'], undefined, false); star(x, 48, 32, 10, '#000000'); },
  KE(x) { bands(x, ['#000000', '#ffffff', '#bb0000', '#ffffff', '#006600'], [6, 1, 6, 1, 6], false); x.fillStyle = '#bb0000'; x.beginPath(); x.ellipse(48, 32, 9, 19, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); },
  ZA(x) { bands(x, ['#de3831', '#002395'], undefined, false); poly(x, '#ffffff', [0, 0, 18, 0, 50, 24, 96, 24, 96, 40, 50, 40, 18, 64, 0, 64]); poly(x, '#007a4d', [0, 0, 10, 0, 46, 27, 96, 27, 96, 37, 46, 37, 10, 64, 0, 64]); poly(x, '#ffb612', [0, 8, 30, 32, 0, 56]); poly(x, '#000000', [0, 13, 24, 32, 0, 51]); },
  XX(x) {
    rect(x, '#24272e', 0, 0, FW, FH);
    for (let i = -FH; i < FW; i += 16) poly(x, '#3a3e48', [i, 0, i + 8, 0, i + 8 + FH, FH, i + FH, FH]);
    circle(x, '#cfd3dc', 48, 30, 13);
    rect(x, '#24272e', 40, 26, 6, 5); rect(x, '#24272e', 50, 26, 6, 5); rect(x, '#cfd3dc', 42, 40, 12, 8);
  },
};

function paint(x: C, f: FlagSpec) {
  switch (f.t) {
    case 'h': return bands(x, f.c, f.w, false);
    case 'v': return bands(x, f.c, undefined, true);
    case 'nordic':
      rect(x, f.bg, 0, 0, FW, FH);
      rect(x, f.cross, 26, 0, 14, FH); rect(x, f.cross, 0, 25, FW, 14);
      if (f.inner) { rect(x, f.inner, 29.5, 0, 7, FH); rect(x, f.inner, 0, 28.5, FW, 7); }
      return;
    case 'disc':
      rect(x, f.bg, 0, 0, FW, FH);
      return circle(x, f.disc, FW * (f.x ?? 0.5), FH / 2, FH * (f.r ?? 0.3));
    case 'custom':
      return CUSTOM[f.id]?.(x);
  }
}

export interface FlagAtlas {
  tex: Map<string, Texture>;
  get(code: string): Texture;
}

export function makeFlags(): FlagAtlas {
  const all: CountryDef[] = [...COUNTRIES, MERC];
  const cols = 10, pad = 2;
  const rows = Math.ceil(all.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * (FW + pad * 2);
  cv.height = rows * (FH + pad * 2);
  const x = cv.getContext('2d')!;
  const frames: [string, number, number][] = [];
  all.forEach((c, i) => {
    const ox = (i % cols) * (FW + pad * 2) + pad, oy = Math.floor(i / cols) * (FH + pad * 2) + pad;
    x.save();
    x.translate(ox, oy);
    x.beginPath();
    x.rect(0, 0, FW, FH);
    x.clip();
    paint(x, c.flag);
    // subtle cloth shading so flags read as objects, not stickers
    const g = x.createLinearGradient(0, 0, FW, FH);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    x.fillStyle = g;
    x.fillRect(0, 0, FW, FH);
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    x.lineWidth = 2;
    x.strokeRect(1, 1, FW - 2, FH - 2);
    x.restore();
    frames.push([c.code, ox, oy]);
  });
  const base = Texture.from(cv).source;
  const tex = new Map<string, Texture>();
  for (const [code, ox, oy] of frames) tex.set(code, new Texture({ source: base, frame: new Rectangle(ox, oy, FW, FH) }));
  return { tex, get: (code) => tex.get(code) ?? tex.get('XX')! };
}
