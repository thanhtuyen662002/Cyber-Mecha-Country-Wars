// Shared constants and tiny helpers. Logical canvas = TikTok vertical 1080x1920.
export const W = 1080;
export const H = 1920;

/** Fixed simulation rate (PLAN.md: logic 30x/s, render interpolated at 60 FPS). */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export type TerrainKey = 'jungle' | 'ice' | 'swamp' | 'city';
export const TERRAINS: { key: TerrainKey; name: string; groundSpeed: number; heavyPenalty: number }[] = [
  { key: 'jungle', name: 'Jungle', groundSpeed: 0.85, heavyPenalty: 1 },
  { key: 'ice', name: 'Ice Field', groundSpeed: 1.1, heavyPenalty: 1 },
  { key: 'swamp', name: 'Toxic Swamp', groundSpeed: 0.75, heavyPenalty: 0.7 },
  { key: 'city', name: 'Ruined City', groundSpeed: 1, heavyPenalty: 1 },
];

export type WeatherKey = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind';
export const WEATHERS: { key: WeatherKey; name: string; icon: string; hint: string }[] = [
  { key: 'clear', name: 'Clear Skies', icon: '☀', hint: 'No modifiers' },
  { key: 'rain', name: 'Heavy Rain', icon: '🌧', hint: 'Flames weaker, ground units slower' },
  { key: 'storm', name: 'Thunderstorm', icon: '⛈', hint: 'Lightning hits tall mechs' },
  { key: 'blizzard', name: 'Blizzard', icon: '❄', hint: 'Everyone slower, shorter range' },
  { key: 'fog', name: 'Fog', icon: '🌫', hint: 'Snipers and bombers lose range' },
  { key: 'wind', name: 'Strong Wind', icon: '💨', hint: 'Aircraft and rockets drift' },
];

/** Spots the terrain painter keeps clear of props (fortress slots). Set before building terrain. */
export const RESERVED: { x: number; y: number; r: number }[] = [];

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
