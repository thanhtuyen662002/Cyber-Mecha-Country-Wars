// Shared constants and tiny helpers. Logical canvas = TikTok vertical 1080x1920.
export const W = 1080;
export const H = 1920;

/** Fixed simulation rate (PLAN.md: logic 30x/s, render interpolated at 60 FPS). */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export type TerrainKey = 'jungle' | 'desert' | 'ice' | 'volcano' | 'swamp' | 'sea' | 'city' | 'industrial';
/** Rotation order: one terrain per round. */
export const TERRAINS: { key: TerrainKey; name: string; groundSpeed: number; heavyPenalty: number; hint: string }[] = [
  { key: 'jungle', name: 'Jungle', groundSpeed: 0.85, heavyPenalty: 1, hint: 'Snipers hide in the trees' },
  { key: 'desert', name: 'Desert', groundSpeed: 0.9, heavyPenalty: 1, hint: 'Wheels sink, energy weapons overheat' },
  { key: 'ice', name: 'Ice Field', groundSpeed: 1.1, heavyPenalty: 1, hint: 'Slippery: vehicles slide' },
  { key: 'volcano', name: 'Volcano', groundSpeed: 0.95, heavyPenalty: 1, hint: 'Lava burns ground units, fly over it' },
  { key: 'swamp', name: 'Toxic Swamp', groundSpeed: 0.75, heavyPenalty: 0.7, hint: 'Heavy units bog down' },
  { key: 'sea', name: 'Sea & Islands', groundSpeed: 1, heavyPenalty: 1, hint: 'Water slows ground units: hovercraft rule' },
  { key: 'city', name: 'Ruined City', groundSpeed: 1, heavyPenalty: 1, hint: 'Close-quarters street fights' },
  { key: 'industrial', name: 'Industrial Zone', groundSpeed: 1, heavyPenalty: 1, hint: 'Fuel depots explode, pylons arc' },
];

export type WeatherKey = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind' | 'sandstorm' | 'heatwave' | 'emstorm';
export const WEATHERS: { key: WeatherKey; name: string; icon: string; hint: string }[] = [
  { key: 'clear', name: 'Clear Skies', icon: '☀', hint: 'No modifiers' },
  { key: 'rain', name: 'Heavy Rain', icon: '🌧', hint: 'Flames weaker, ground units slower' },
  { key: 'storm', name: 'Thunderstorm', icon: '⛈', hint: 'Lightning hits tall mechs' },
  { key: 'blizzard', name: 'Blizzard', icon: '❄', hint: 'Everyone slower, shorter range' },
  { key: 'fog', name: 'Fog', icon: '🌫', hint: 'Snipers and bombers lose range' },
  { key: 'wind', name: 'Strong Wind', icon: '💨', hint: 'Aircraft and rockets drift' },
  { key: 'sandstorm', name: 'Sandstorm', icon: '🌪', hint: 'Short range, armour sandblasted' },
  { key: 'heatwave', name: 'Heatwave', icon: '🔥', hint: 'Energy weapons overheat, fire burns hotter' },
  { key: 'emstorm', name: 'EM Storm', icon: '🌀', hint: 'Drones fall, energy weapons supercharged' },
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
