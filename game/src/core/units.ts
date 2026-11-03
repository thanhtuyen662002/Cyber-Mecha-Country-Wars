// The 13 launch units (PLAN.md "Đã chốt"), their gift tiers and the counter system.
export type UnitKey =
  | 'infantry' | 'sniper' | 'at' // tier 0: chat / follow / share
  | 'drone' | 'flamer' // tier 1
  | 'tank' | 'aa' | 'spider' // tier 2
  | 'heli' // tier 3
  | 'robot' | 'bomber' // tier 4
  | 'titan' // tier 5
  | 'strike'; // tier 6 (strategic bombing run, an event rather than a unit)

/** What a unit is, for counters. */
export type UnitClass = 'inf' | 'vehicle' | 'mech' | 'air';
/** What a weapon is good against. */
export type Weapon = 'rifle' | 'sniper' | 'atRocket' | 'flame' | 'kamikaze' | 'shell' | 'flak' | 'laser' | 'rocket' | 'robot' | 'bombs' | 'titan';

export interface UnitDef {
  key: UnitKey;
  name: string;
  tier: number;
  cls: UnitClass;
  weapon: Weapon;
  hp: number;
  speed: number; // px/s
  range: number;
  dmg: number;
  fireInterval: number;
  radius: number;
  /** Mass for knock-back: light units fly further. */
  mass: number;
  /** Chat command(s) to pre-select this unit for your next gift of its tier. */
  cmds: string[];
  /** Points awarded to the killer's country. */
  value: number;
}

const u = (d: UnitDef) => d;
export const UNITS: Record<UnitKey, UnitDef> = {
  infantry: u({ key: 'infantry', name: 'Rifleman', tier: 0, cls: 'inf', weapon: 'rifle', hp: 40, speed: 46, range: 150, dmg: 4, fireInterval: 0.45, radius: 11, mass: 1, cmds: ['!inf', '!rifle'], value: 5 }),
  sniper: u({ key: 'sniper', name: 'Sniper', tier: 0, cls: 'inf', weapon: 'sniper', hp: 32, speed: 36, range: 400, dmg: 34, fireInterval: 2.2, radius: 11, mass: 1, cmds: ['!sniper'], value: 8 }),
  at: u({ key: 'at', name: 'Anti-Tank', tier: 0, cls: 'inf', weapon: 'atRocket', hp: 45, speed: 40, range: 240, dmg: 46, fireInterval: 2.1, radius: 11, mass: 1, cmds: ['!at', '!bazooka'], value: 8 }),
  drone: u({ key: 'drone', name: 'Kamikaze Drone', tier: 1, cls: 'air', weapon: 'kamikaze', hp: 25, speed: 150, range: 18, dmg: 80, fireInterval: 1, radius: 13, mass: 1, cmds: ['!drone'], value: 10 }),
  flamer: u({ key: 'flamer', name: 'Flamethrower', tier: 1, cls: 'inf', weapon: 'flame', hp: 70, speed: 44, range: 95, dmg: 3.2, fireInterval: 0.08, radius: 12, mass: 1.2, cmds: ['!flame', '!fire'], value: 12 }),
  tank: u({ key: 'tank', name: 'Light Tank', tier: 2, cls: 'vehicle', weapon: 'shell', hp: 280, speed: 38, range: 260, dmg: 48, fireInterval: 1.6, radius: 26, mass: 8, cmds: ['!tank'], value: 40 }),
  aa: u({ key: 'aa', name: 'AA Vehicle', tier: 2, cls: 'vehicle', weapon: 'flak', hp: 220, speed: 42, range: 360, dmg: 14, fireInterval: 0.22, radius: 26, mass: 7, cmds: ['!aa', '!antiair'], value: 40 }),
  spider: u({ key: 'spider', name: 'Spider Mech', tier: 2, cls: 'mech', weapon: 'laser', hp: 360, speed: 52, range: 230, dmg: 8, fireInterval: 0.16, radius: 32, mass: 9, cmds: ['!spider', '!mech'], value: 45 }),
  heli: u({ key: 'heli', name: 'Attack Heli', tier: 3, cls: 'air', weapon: 'rocket', hp: 420, speed: 85, range: 330, dmg: 34, fireInterval: 0.9, radius: 40, mass: 6, cmds: ['!heli', '!air'], value: 120 }),
  robot: u({ key: 'robot', name: 'War Robot', tier: 4, cls: 'mech', weapon: 'robot', hp: 1600, speed: 30, range: 320, dmg: 42, fireInterval: 0.55, radius: 46, mass: 30, cmds: ['!robot'], value: 400 }),
  bomber: u({ key: 'bomber', name: 'Strike Bomber', tier: 4, cls: 'air', weapon: 'bombs', hp: 700, speed: 210, range: 60, dmg: 90, fireInterval: 0.12, radius: 50, mass: 20, cmds: ['!bomber', '!bomb'], value: 400 }),
  titan: u({ key: 'titan', name: 'Mecha Titan', tier: 5, cls: 'mech', weapon: 'titan', hp: 5200, speed: 24, range: 420, dmg: 26, fireInterval: 0.08, radius: 80, mass: 200, cmds: ['!titan'], value: 2000 }),
  strike: u({ key: 'strike', name: 'Strategic Bombing', tier: 6, cls: 'air', weapon: 'bombs', hp: 1, speed: 0, range: 0, dmg: 0, fireInterval: 1, radius: 1, mass: 1, cmds: ['!nuke', '!strike'], value: 0 }),
};
export const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];
export const TIER_UNITS: UnitKey[][] = [['infantry', 'sniper', 'at'], ['drone', 'flamer'], ['tank', 'aa', 'spider'], ['heli'], ['robot', 'bomber'], ['titan'], ['strike']];

/** Damage multiplier: weapon -> target class. 0 = cannot target. Fortress uses `fort`. */
export const COUNTER: Record<Weapon, Record<UnitClass | 'fort', number>> = {
  rifle: { inf: 1.5, vehicle: 0.35, mech: 0.3, air: 0.6, fort: 0.5 },
  sniper: { inf: 3, vehicle: 0.25, mech: 0.25, air: 0.4, fort: 0.3 },
  atRocket: { inf: 0.4, vehicle: 2.6, mech: 2.1, air: 0, fort: 1.2 },
  flame: { inf: 2.6, vehicle: 0.6, mech: 0.5, air: 0, fort: 0.6 },
  kamikaze: { inf: 1, vehicle: 1.5, mech: 1.2, air: 1, fort: 1 },
  shell: { inf: 1.6, vehicle: 1, mech: 0.8, air: 0, fort: 1.5 },
  flak: { inf: 0.5, vehicle: 0.25, mech: 0.25, air: 3.2, fort: 0.2 },
  laser: { inf: 1.2, vehicle: 1, mech: 1, air: 0.8, fort: 0.8 },
  rocket: { inf: 1, vehicle: 2, mech: 1.4, air: 0.5, fort: 1 },
  robot: { inf: 1.2, vehicle: 1.2, mech: 1.1, air: 0.7, fort: 1.2 },
  bombs: { inf: 1.5, vehicle: 1.5, mech: 1.1, air: 0, fort: 1.3 },
  titan: { inf: 1.2, vehicle: 1.2, mech: 1.2, air: 1, fort: 1.4 },
};

/** Chat command -> unit key. */
export const UNIT_CMDS = new Map<string, UnitKey>();
for (const k of UNIT_KEYS) for (const c of UNITS[k].cmds) UNIT_CMDS.set(c, k);

// ---------------------------------------------------------------- gift tiers
/** Lower coin bound of tiers 1..6 (tier 0 = free actions). Overridable via public/config/game.json. */
export let TIER_MIN = [0, 1, 10, 100, 500, 5000, 30000];
export function setTierMin(t: number[]) {
  if (t.length === 7 && t.every((v, i) => i === 0 || v > t[i - 1])) TIER_MIN = t;
}
export function tierOf(coins: number) {
  let t = 1;
  for (let i = 1; i < TIER_MIN.length; i++) if (coins >= TIER_MIN[i]) t = i;
  return t;
}
export const TIER_LABEL = (t: number) => (t === 0 ? 'free' : t === 6 ? `${TIER_MIN[6].toLocaleString('en-US')}+` : `${TIER_MIN[t].toLocaleString('en-US')}+`);
