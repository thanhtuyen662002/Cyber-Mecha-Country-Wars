// Gameplay geometry for the hazard terrains, shared by the painter (draw/terrain.ts) and the
// simulation (sim/world.ts) so what you see is exactly what hurts.
import { H, RESERVED, W } from './config';

// ------------------------------------------------------------ volcano: lava rivers
const wave = (y0: number, amp: number, f: number, ph: number) => {
  const pts: number[] = [];
  for (let x = -60; x <= W + 60; x += 30) pts.push(x, y0 + Math.sin(x / f + ph) * amp + Math.sin(x / (f * 0.37) + ph * 2) * amp * 0.25);
  return pts;
};
/** Polylines [x0,y0,x1,y1,...]; lava is LAVA_HALF px either side. */
export const LAVA: number[][] = [wave(800, 70, 170, 0.6), wave(1250, 60, 150, 2.3)];
export const LAVA_HALF = 34;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
export function lavaDist(x: number, y: number) {
  let best = Infinity;
  for (const l of LAVA) {
    for (let i = 0; i < l.length - 2; i += 2) {
      if (Math.abs(l[i] - x) > 80) continue;
      best = Math.min(best, segDist(x, y, l[i], l[i + 1], l[i + 2], l[i + 3]));
    }
  }
  return best;
}

// ------------------------------------------------------------ sea: islands in shallow water
export interface Island { x: number; y: number; r: number; seed: number }
let islands: Island[] = [];
/** Islands: one under every fortress slot / capture point, plus a few stepping stones. */
export function getIslands(): Island[] {
  if (islands.length) return islands;
  const extra = [[540, 650, 60], [300, 1180, 70], [790, 880, 65], [540, 1450, 60], [330, 560, 50], [760, 1500, 50]];
  islands = [
    ...RESERVED.map((t, i) => ({ x: t.x, y: t.y, r: t.r + (t.r > 90 ? 55 : 35), seed: i * 1.7 })),
    ...extra.map(([x, y, r], i) => ({ x, y, r, seed: 9 + i })),
  ];
  return islands;
}
/** Island radius at an angle (wobbly coastline, deterministic). */
export function coast(is: Island, a: number) {
  return is.r * (1 + Math.sin(a * 3 + is.seed) * 0.12 + Math.sin(a * 7 + is.seed * 2) * 0.06);
}
const CELL = 16;
const GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
let water: Uint8Array | null = null;
export function isWater(x: number, y: number) {
  if (!water) {
    water = new Uint8Array(GW * GH);
    const isl = getIslands();
    for (let gy = 0; gy < GH; gy++)
      for (let gx = 0; gx < GW; gx++) {
        const px = gx * CELL + CELL / 2, py = gy * CELL + CELL / 2;
        let wet = 1;
        for (const s of isl) {
          const d = Math.hypot(px - s.x, py - s.y);
          if (d < coast(s, Math.atan2(py - s.y, px - s.x))) {
            wet = 0;
            break;
          }
        }
        water[gy * GW + gx] = wet;
      }
  }
  const gx = Math.max(0, Math.min(GW - 1, (x / CELL) | 0)), gy = Math.max(0, Math.min(GH - 1, (y / CELL) | 0));
  return water[gy * GW + gx] === 1;
}

// ------------------------------------------------------------ industrial: fuel depots + power pylons
export const BARREL_SPOTS: [number, number][] = [
  [330, 620], [760, 600], [420, 860], [700, 1180], [360, 1240], [780, 1420], [250, 980], [830, 960], [540, 1560], [540, 520],
];
export const PYLONS: [number, number][] = [
  [60, 600], [380, 760], [700, 760], [1020, 600], [60, 1440], [380, 1300], [700, 1300], [1020, 1440],
];
/** Power lines between consecutive pylons (pairs of indices). */
export const WIRES: [number, number][] = [[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [1, 5], [2, 6]];
