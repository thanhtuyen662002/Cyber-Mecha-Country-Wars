// Shared constants for the art lab. Logical canvas = TikTok vertical 1080x1920.
export const W = 1080;
export const H = 1920;

export type TeamId = 0 | 1;

export interface Team {
  id: TeamId;
  name: string;
  flag: string;
  color: number; // neon/team paint colour (from the flag)
  dark: number;
  base: { x: number; y: number };
}

export const TEAMS: Team[] = [
  { id: 0, name: 'USA', flag: '🇺🇸', color: 0x38c8ff, dark: 0x0b3a5c, base: { x: 540, y: 1660 } },
  { id: 1, name: 'CANADA', flag: '🇨🇦', color: 0xff3d5a, dark: 0x5c0b1b, base: { x: 540, y: 330 } },
];

export type UnitKey = 'infantry' | 'drone' | 'tank' | 'spider' | 'heli' | 'titan';
export type Weapon = 'bullet' | 'kamikaze' | 'shell' | 'laser' | 'rocket' | 'titan';

export interface UnitDef {
  key: UnitKey;
  name: string;
  gift: string; // which gift tier would call it (from PLAN.md tiers)
  tier: number; // 0..6, drives size, glow and effect budget
  hp: number;
  speed: number; // px / s
  range: number;
  dmg: number;
  fireInterval: number; // s
  radius: number; // collision / selection radius
  air: boolean;
  weapon: Weapon;
}

export const UNITS: Record<UnitKey, UnitDef> = {
  infantry: { key: 'infantry', name: 'Infantry', gift: 'Chat (free)', tier: 0, hp: 40, speed: 46, range: 150, dmg: 4, fireInterval: 0.45, radius: 11, air: false, weapon: 'bullet' },
  drone: { key: 'drone', name: 'Kamikaze Drone', gift: 'Rose (1 coin)', tier: 1, hp: 25, speed: 150, range: 18, dmg: 70, fireInterval: 1, radius: 13, air: true, weapon: 'kamikaze' },
  tank: { key: 'tank', name: 'Light Tank', gift: 'Tier 2 gift', tier: 2, hp: 260, speed: 38, range: 260, dmg: 45, fireInterval: 1.6, radius: 26, air: false, weapon: 'shell' },
  spider: { key: 'spider', name: 'Spider Mech', gift: 'Tier 3 gift', tier: 3, hp: 380, speed: 52, range: 230, dmg: 9, fireInterval: 0.16, radius: 34, air: false, weapon: 'laser' },
  heli: { key: 'heli', name: 'Attack Heli', gift: 'Tier 3 gift', tier: 3, hp: 300, speed: 85, range: 330, dmg: 30, fireInterval: 0.9, radius: 40, air: true, weapon: 'rocket' },
  titan: { key: 'titan', name: 'Mecha Titan', gift: 'Tier 5 gift', tier: 5, hp: 4200, speed: 24, range: 420, dmg: 26, fireInterval: 0.08, radius: 80, air: false, weapon: 'titan' },
};

export const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];

export type TerrainKey = 'jungle' | 'ice' | 'swamp' | 'city';
export const TERRAINS: { key: TerrainKey; name: string; groundSpeed: number }[] = [
  { key: 'jungle', name: 'Jungle', groundSpeed: 0.85 },
  { key: 'ice', name: 'Ice', groundSpeed: 1.1 },
  { key: 'swamp', name: 'Toxic Swamp', groundSpeed: 0.7 },
  { key: 'city', name: 'Ruined City', groundSpeed: 1 },
];

export type WeatherKey = 'clear' | 'rain' | 'storm' | 'blizzard' | 'fog' | 'wind';
export const WEATHERS: { key: WeatherKey; name: string }[] = [
  { key: 'clear', name: 'Clear' },
  { key: 'rain', name: 'Heavy Rain' },
  { key: 'storm', name: 'Thunderstorm' },
  { key: 'blizzard', name: 'Blizzard' },
  { key: 'fog', name: 'Fog' },
  { key: 'wind', name: 'Strong Wind' },
];

// Fake viewer names for the bot spawner.
export const NAMES = [
  'skyler_99', 'mikey.gg', 'jess4ever', 'tankdaddy', 'luna_vibes', 'ryan.tx', 'maple_mike', 'noahplays', 'emma.k', 'big_tony',
  'zoe_zoom', 'chris.p', 'ava.live', 'liam_mtl', 'grace.yyc', 'dylan77', 'mia.rose', 'jake_bc', 'olivia.on', 'ethan.nyc',
];

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
