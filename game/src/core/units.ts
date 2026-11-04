// The full 24-unit roster from PLAN.md (7 gift tiers) (PLAN.md "Đã chốt"), their gift tiers and the counter system.
export type UnitKey =
  | 'infantry' | 'sniper' | 'at' // tier 0: chat / follow / share
  | 'drone' | 'flamer' | 'jeep' // tier 1
  | 'tank' | 'aa' | 'spider' | 'repair' // tier 2
  | 'heli' | 'mbt' | 'mlrs' | 'emp' // tier 3
  | 'robot' | 'bomber' | 'hover' | 'mobile' // tier 4
  | 'titan' | 'carrier' | 'stormfort' // tier 5
  | 'strike' | 'orbital' | 'dragon'; // tier 6 (strike + orbital are events rather than units)

/** What a unit is, for counters. */
export type UnitClass = 'inf' | 'vehicle' | 'mech' | 'air';
/** What a weapon is good against. */
export type Weapon = 'rifle' | 'sniper' | 'atRocket' | 'flame' | 'kamikaze' | 'shell' | 'flak' | 'laser' | 'rocket' | 'robot' | 'bombs' | 'titan' | 'mg' | 'repair' | 'artillery' | 'emp' | 'mobile' | 'carrier' | 'storm' | 'orbital' | 'dragon';

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
  jeep: u({ key: 'jeep', name: 'Gun Jeep', tier: 1, cls: 'vehicle', weapon: 'mg', hp: 120, speed: 95, range: 200, dmg: 5, fireInterval: 0.13, radius: 20, mass: 4, cmds: ['!jeep'], value: 12 }),
  repair: u({ key: 'repair', name: 'Repair Drone', tier: 2, cls: 'air', weapon: 'repair', hp: 160, speed: 90, range: 170, dmg: 26, fireInterval: 0.1, radius: 20, mass: 2, cmds: ['!repair', '!heal'], value: 35 }),
  mbt: u({ key: 'mbt', name: 'Battle Tank', tier: 3, cls: 'vehicle', weapon: 'shell', hp: 820, speed: 32, range: 300, dmg: 95, fireInterval: 1.9, radius: 34, mass: 14, cmds: ['!mbt', '!bigtank'], value: 120 }),
  mlrs: u({ key: 'mlrs', name: 'Rocket Artillery', tier: 3, cls: 'vehicle', weapon: 'artillery', hp: 380, speed: 34, range: 600, dmg: 55, fireInterval: 5.5, radius: 30, mass: 9, cmds: ['!mlrs', '!arty'], value: 120 }),
  emp: u({ key: 'emp', name: 'EMP Truck', tier: 3, cls: 'vehicle', weapon: 'emp', hp: 460, speed: 44, range: 230, dmg: 70, fireInterval: 2.6, radius: 28, mass: 8, cmds: ['!emp'], value: 120 }),
  hover: u({ key: 'hover', name: 'Hover Assault', tier: 4, cls: 'vehicle', weapon: 'rocket', hp: 1300, speed: 78, range: 320, dmg: 40, fireInterval: 0.7, radius: 46, mass: 18, cmds: ['!hover'], value: 400 }),
  mobile: u({ key: 'mobile', name: 'Mobile Fortress', tier: 4, cls: 'vehicle', weapon: 'mobile', hp: 3000, speed: 16, range: 340, dmg: 60, fireInterval: 0.6, radius: 70, mass: 80, cmds: ['!fortress', '!mobile'], value: 400 }),
  carrier: u({ key: 'carrier', name: 'Drone Carrier', tier: 5, cls: 'air', weapon: 'carrier', hp: 4200, speed: 34, range: 380, dmg: 14, fireInterval: 0.2, radius: 96, mass: 150, cmds: ['!carrier'], value: 2000 }),
  stormfort: u({ key: 'stormfort', name: 'Storm Fortress', tier: 5, cls: 'mech', weapon: 'storm', hp: 4800, speed: 18, range: 440, dmg: 240, fireInterval: 1.6, radius: 66, mass: 180, cmds: ['!storm', '!stormfort'], value: 2000 }),
  strike: u({ key: 'strike', name: 'Strategic Bombing', tier: 6, cls: 'air', weapon: 'bombs', hp: 1, speed: 0, range: 0, dmg: 0, fireInterval: 1, radius: 1, mass: 1, cmds: ['!nuke', '!strike'], value: 0 }),
  orbital: u({ key: 'orbital', name: 'Orbital Cannon', tier: 6, cls: 'air', weapon: 'orbital', hp: 1, speed: 0, range: 0, dmg: 0, fireInterval: 1, radius: 1, mass: 1, cmds: ['!orbital', '!laser'], value: 0 }),
  dragon: u({ key: 'dragon', name: 'Mecha Dragon', tier: 6, cls: 'air', weapon: 'dragon', hp: 9000, speed: 80, range: 230, dmg: 9, fireInterval: 0.06, radius: 70, mass: 300, cmds: ['!dragon'], value: 5000 }),
};
/** Events: no unit stays on the field, they are scripted strikes. */
export const EVENT_UNITS: UnitKey[] = ['strike', 'orbital'];
export const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];
export const TIER_UNITS: UnitKey[][] = [
  ['infantry', 'sniper', 'at'],
  ['drone', 'flamer', 'jeep'],
  ['tank', 'aa', 'spider', 'repair'],
  ['heli', 'mbt', 'mlrs', 'emp'],
  ['robot', 'bomber', 'hover', 'mobile'],
  ['titan', 'carrier', 'stormfort'],
  ['strike', 'orbital', 'dragon'],
];

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
  mg: { inf: 1.8, vehicle: 0.4, mech: 0.3, air: 0.9, fort: 0.3 },
  repair: { inf: 0, vehicle: 0, mech: 0, air: 0, fort: 0 },
  artillery: { inf: 1.6, vehicle: 1.4, mech: 1, air: 0, fort: 1.6 },
  emp: { inf: 0.3, vehicle: 0.9, mech: 2.6, air: 2.4, fort: 0.6 },
  mobile: { inf: 1.4, vehicle: 1.3, mech: 1.1, air: 0.8, fort: 1.4 },
  carrier: { inf: 0.8, vehicle: 0.4, mech: 0.4, air: 2.5, fort: 0.3 },
  storm: { inf: 1, vehicle: 1.3, mech: 2, air: 1.5, fort: 1 },
  orbital: { inf: 2, vehicle: 2, mech: 2, air: 1, fort: 2 },
  dragon: { inf: 2.4, vehicle: 1.3, mech: 1.1, air: 1.2, fort: 1.1 },
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
/** One colour per tier, used on unit badges and the HUD arsenal (T0 white ... T6 gold). */
export const TIER_COLOR = [0xd8dee8, 0x5dff8a, 0x38e1ff, 0x5b8cff, 0xc06bff, 0xff9a3d, 0xffd34d];
export const TIER_LABEL = (t: number) => (t === 0 ? 'free' : t === 6 ? `${TIER_MIN[6].toLocaleString('en-US')}+` : `${TIER_MIN[t].toLocaleString('en-US')}+`);
