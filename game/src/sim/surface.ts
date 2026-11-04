// What the ground is made of at a point, and how it reacts to wheels, feet and shells.
// Used by the world to make terrain + weather physically visible: tracks in snow and sand,
// mud splatter, water geysers, concrete dust, volcanic ash, steam when fire meets rain.
import type { TerrainKey, WeatherKey } from '../core/config';
import { isWater } from '../core/terrainmap';

export type Mat = 'dirt' | 'sand' | 'snow' | 'mud' | 'water' | 'concrete' | 'ash';

export interface MatLook {
  dust: number; // kicked-up dust / blast plume tint
  dustAlpha: number;
  chunk: number; // flying debris tint
  track: number; // tyre/tread/foot marks (-1 = leaves none)
  trackAlpha: number;
  plume: number; // 0..2 how tall/long the blast plume lingers
}

export const LOOK: Record<Mat, MatLook> = {
  dirt: { dust: 0x8a7050, dustAlpha: 0.45, chunk: 0x4a3a28, track: 0x2a1e12, trackAlpha: 0.42, plume: 1 },
  sand: { dust: 0xdcbc80, dustAlpha: 0.55, chunk: 0xb89058, track: 0x6a4620, trackAlpha: 0.55, plume: 1.8 },
  snow: { dust: 0xf2f7ff, dustAlpha: 0.7, chunk: 0xe6eef8, track: 0x8aa2bc, trackAlpha: 0.55, plume: 1.2 },
  mud: { dust: 0x5a6234, dustAlpha: 0.5, chunk: 0x2e3418, track: 0x141a08, trackAlpha: 0.62, plume: 0.6 },
  water: { dust: 0xdcefff, dustAlpha: 0.6, chunk: 0xc8e4ff, track: -1, trackAlpha: 0, plume: 0.4 },
  concrete: { dust: 0x9a9a98, dustAlpha: 0.55, chunk: 0x6a6a68, track: -1, trackAlpha: 0, plume: 1.3 },
  ash: { dust: 0x3a3532, dustAlpha: 0.6, chunk: 0x221e1c, track: 0x120e0c, trackAlpha: 0.4, plume: 1.5 },
};

export function surfaceAt(terrain: TerrainKey, weather: WeatherKey, x: number, y: number): Mat {
  switch (terrain) {
    case 'sea': return isWater(x, y) ? 'water' : 'sand';
    case 'desert': return 'sand';
    case 'ice': return 'snow';
    case 'volcano': return 'ash';
    case 'swamp': return 'mud';
    case 'city':
    case 'industrial': return 'concrete';
    default: return weather === 'rain' || weather === 'storm' ? 'mud' : weather === 'blizzard' ? 'snow' : 'dirt';
  }
}
