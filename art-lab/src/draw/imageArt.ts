// Image-based skin: loads PNGs dropped into public/art/ (AI-generated from docs/ART_PROMPTS.md
// or CC0 packs). Anything missing gets a clearly-labelled placeholder so the gap is obvious.
import { Assets, Texture } from 'pixi.js';
import type { TerrainKey, UnitKey } from '../config';

export type ImageKey = `unit_${UnitKey}` | 'fortress' | `terrain_${TerrainKey}`;

export const IMAGE_KEYS: ImageKey[] = [
  'unit_infantry', 'unit_drone', 'unit_tank', 'unit_spider', 'unit_heli', 'unit_titan', 'fortress',
  'terrain_jungle', 'terrain_ice', 'terrain_swamp', 'terrain_city',
];

export interface ImageArt {
  tex: Record<ImageKey, Texture>;
  found: Set<ImageKey>;
}

function placeholder(key: ImageKey): Texture {
  const terrain = key.startsWith('terrain');
  const s = terrain ? 512 : 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const x = c.getContext('2d')!;
  x.fillStyle = terrain ? '#1a1f2a' : 'rgba(30,36,50,0.55)';
  x.fillRect(0, 0, s, s);
  x.strokeStyle = '#ff4fd8';
  x.setLineDash([10, 8]);
  x.lineWidth = 4;
  x.strokeRect(6, 6, s - 12, s - 12);
  x.setLineDash([]);
  // arrow showing which way the art must face (up)
  x.fillStyle = 'rgba(255,79,216,0.5)';
  x.beginPath();
  x.moveTo(s / 2, s * 0.14);
  x.lineTo(s * 0.62, s * 0.3);
  x.lineTo(s * 0.38, s * 0.3);
  x.fill();
  x.fillStyle = '#ffd6f6';
  x.font = `bold ${terrain ? 30 : 22}px system-ui, sans-serif`;
  x.textAlign = 'center';
  x.fillText('MISSING IMAGE', s / 2, s / 2 - 6);
  x.font = `${terrain ? 26 : 18}px ui-monospace, monospace`;
  x.fillText(`art/${key}.png`, s / 2, s / 2 + 24);
  return Texture.from(c);
}

export async function loadImageArt(): Promise<ImageArt> {
  const tex = {} as Record<ImageKey, Texture>;
  const found = new Set<ImageKey>();
  await Promise.all(
    IMAGE_KEYS.map(async (k) => {
      const url = `${import.meta.env.BASE_URL}art/${k}.png`;
      try {
        // HEAD first so a missing file doesn't spam the console with decode errors.
        const res = await fetch(url, { method: 'HEAD' });
        if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image')) throw new Error('missing');
        tex[k] = await Assets.load<Texture>(url);
        found.add(k);
      } catch {
        tex[k] = placeholder(k);
      }
    }),
  );
  return { tex, found };
}
