// Shared constants and tiny helpers. Logical canvas = TikTok vertical 1080x1920.
export const W = 1080;
export const H = 1920;

/** Fixed simulation rate (PLAN.md: logic 30x/s, render interpolated at 60 FPS). */
export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;

export type TerrainKey = 'jungle' | 'desert' | 'ice' | 'volcano' | 'swamp' | 'sea' | 'city' | 'industrial';
/** Rotation order: one terrain per round. */
export const TERRAINS: { key: TerrainKey; name: string; groundSpeed: number; heavyPenalty: number; hint: string; fx: string }[] = [
  { key: 'jungle', name: 'Jungle', groundSpeed: 0.85, heavyPenalty: 1, hint: 'Snipers hide in the trees', fx: 'Ground units -15% speed · mud when it rains' },
  { key: 'desert', name: 'Desert', groundSpeed: 0.9, heavyPenalty: 1, hint: 'Wheels sink, energy weapons overheat', fx: 'Wheels -20% · energy weapons overheat · tracks in the sand' },
  { key: 'ice', name: 'Ice Field', groundSpeed: 1.1, heavyPenalty: 1, hint: 'Slippery: vehicles slide', fx: '+10% speed but vehicles slide · tracks in the snow' },
  { key: 'volcano', name: 'Volcano', groundSpeed: 0.95, heavyPenalty: 1, hint: 'Lava burns ground units, fly over it', fx: 'Lava burns ground units · ash clouds' },
  { key: 'swamp', name: 'Toxic Swamp', groundSpeed: 0.75, heavyPenalty: 0.7, hint: 'Heavy units bog down', fx: 'Ground -25% · heavy units -30% · mud splashes' },
  { key: 'sea', name: 'Sea & Islands', groundSpeed: 1, heavyPenalty: 1, hint: 'Water slows ground units: hovercraft rule', fx: 'Water: ground units -55% · hovercraft full speed' },
  { key: 'city', name: 'Ruined City', groundSpeed: 1, heavyPenalty: 1, hint: 'Close-quarters street fights', fx: 'Concrete dust · close-quarters street fights' },
  { key: 'industrial', name: 'Industrial Zone', groundSpeed: 1, heavyPenalty: 1, hint: 'Fuel depots explode, pylons arc', fx: 'Fuel depots explode · pylons arc · EMP +30%' },
];

export type WeatherKey = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind' | 'sandstorm' | 'heatwave' | 'emstorm';
export const WEATHERS: { key: WeatherKey; name: string; icon: string; hint: string; fx: string }[] = [
  { key: 'clear', name: 'Clear Skies', icon: '☀', hint: 'No modifiers', fx: 'No modifiers' },
  { key: 'rain', name: 'Heavy Rain', icon: '🌧', hint: 'Flames weaker, ground units slower', fx: 'Ground -12% speed · flames -45% · fire turns to steam' },
  { key: 'storm', name: 'Thunderstorm', icon: '⛈', hint: 'Lightning hits tall mechs', fx: 'Ground -12% · lightning hits tall mechs · flames -45%' },
  { key: 'blizzard', name: 'Blizzard', icon: '❄', hint: 'Everyone slower, shorter range', fx: 'All units -25% speed · range -20% · deep tracks' },
  { key: 'fog', name: 'Fog', icon: '🌫', hint: 'Snipers and bombers lose range', fx: 'Sniper / AA / robot range -40%' },
  { key: 'wind', name: 'Strong Wind', icon: '💨', hint: 'Aircraft and rockets drift', fx: 'Aircraft and rockets drift · bombs -20% · smoke blown away' },
  { key: 'sandstorm', name: 'Sandstorm', icon: '🌪', hint: 'Short range, armour sandblasted', fx: 'Range -30% · armour sandblasted · aircraft -20%' },
  { key: 'heatwave', name: 'Heatwave', icon: '🔥', hint: 'Energy weapons overheat, fire burns hotter', fx: 'Energy weapons overheat · fire +25% and bigger' },
  { key: 'emstorm', name: 'EM Storm', icon: '🌀', hint: 'Drones fall, energy weapons supercharged', fx: 'Drones fry · energy weapons +30% · radar -25%' },
];

/** Weather that makes sense on each battlefield (no snow in the desert, no sandstorm at sea). */
export const TERRAIN_WEATHERS: Record<TerrainKey, WeatherKey[]> = {
  jungle: ['clear', 'rain', 'storm', 'fog', 'wind', 'heatwave', 'emstorm'],
  desert: ['clear', 'sandstorm', 'heatwave', 'wind', 'emstorm'],
  ice: ['clear', 'blizzard', 'fog', 'wind', 'emstorm'],
  volcano: ['clear', 'heatwave', 'storm', 'wind', 'emstorm'],
  swamp: ['clear', 'rain', 'storm', 'fog', 'heatwave', 'emstorm'],
  sea: ['clear', 'rain', 'storm', 'fog', 'wind', 'emstorm'],
  city: ['clear', 'rain', 'storm', 'fog', 'wind', 'blizzard', 'heatwave', 'emstorm'],
  industrial: ['clear', 'rain', 'storm', 'fog', 'wind', 'blizzard', 'heatwave', 'emstorm'],
};
/** Chat command that votes for each weather (shown in the HUD). */
export const WEATHER_CMD: Record<WeatherKey, string> = { clear: '!clear', rain: '!rain', storm: '!storm', blizzard: '!snow', fog: '!fog', wind: '!wind', sandstorm: '!sand', heatwave: '!heat', emstorm: '!emp' };

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
