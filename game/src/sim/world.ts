// The battlefield simulation: countries, fortresses, units, weapons, capture points, supply crates.
// Runs on a fixed 30 Hz tick (update(dt) with dt = SIM_DT); render() interpolates positions at 60 FPS.
// Hard caps everywhere (PLAN.md "trần số lượng"): units, projectiles, beams, wrecks, crates, delayed blasts.
import { BitmapFont, BitmapText, Container, RenderTexture, type Renderer, Sprite, type Texture } from 'pixi.js';
import { H, RESERVED, SIM_DT, TERRAINS, type TerrainKey, W, type WeatherKey, angDiff, clamp, lerp, pick, rand } from '../core/config';
import { COUNTRY_BY_CODE, type CountryDef, MERC } from '../core/countries';
import { COUNTER, TIER_COLOR, UNITS, type UnitClass, type UnitDef, type UnitKey } from '../core/units';
import { BARREL_SPOTS, LAVA_HALF, PYLONS, isWater, lavaDist } from '../core/terrainmap';
import type { FlagAtlas } from '../draw/flags';
import type { FxTextures } from '../draw/fxTextures';
import type { UnitArt } from '../draw/units';
import type { Particles } from '../fx/particles';
import { type FortressView, type UnitVisual, buildFortress, buildVisual } from './visuals';
import type { SfxKind } from '../fx/sfx';
import { LOOK, type Mat, surfaceAt } from './surface';

export const UNIT_CAP = 250;
const FORT_HP = 12000;

/** 12 fortress slots around the edge of the portrait map, filled in this order. */
export const SLOTS: { x: number; y: number }[] = [
  { x: 210, y: 420 }, { x: 870, y: 1640 }, { x: 870, y: 420 }, { x: 210, y: 1640 },
  { x: 540, y: 330 }, { x: 540, y: 1720 }, { x: 140, y: 1030 }, { x: 940, y: 1030 },
  { x: 120, y: 730 }, { x: 960, y: 1330 }, { x: 960, y: 730 }, { x: 120, y: 1330 },
];
const fortScale = (n: number) => (n <= 4 ? 0.78 : n <= 6 ? 0.66 : 0.54);

interface Target {
  x: number; y: number; radius: number; hp: number; maxHp: number;
  fid: number; cls: UnitClass | 'fort'; alive: boolean;
}

export interface Fort extends Target {
  view: FortressView;
  flag: Sprite;
  label: BitmapText;
  barBg: Sprite;
  bar: Sprite;
  scale: number;
  hitFlash: number;
  cool: number;
}

export interface Faction {
  id: number;
  def: CountryDef;
  code: string;
  color: number;
  slot: number; // -1 = no fortress (mercenaries / evicted)
  fort: Fort | null;
  lastActive: number; // world time (s)
  score: number;
  kills: number;
  fortsDestroyed: number;
  units: number; // alive count, refreshed each tick
  cls: Record<UnitClass, number>; // alive count per class (for auto-counter picks)
  hurtBy: Record<UnitClass, number>; // decaying damage taken per attacker class (for "call AA!" tips)
  /** score multiplier for this country (underdog boost) */
  boost: number;
  /** seconds of underdog fortress shield left (fort takes 50% damage) */
  shieldT: number;
  /** coins gifted to this country this round (shared war chest) */
  chest: number;
  /** war-chest goals already reached this round */
  chestStage: number;
}

export interface Unit extends Target {
  cls: UnitClass;
  def: UnitDef;
  name: string; // owner @name ('' for CPU)
  uid: string;
  rank: number;
  px: number; py: number; // previous tick position (interpolation)
  vx: number; vy: number;
  angle: number; aim: number; dist: number; moving: number;
  cool: number; special: number; salvo: number;
  retarget: number;
  target: Target | null;
  goalX: number; goalY: number;
  flash: number;
  vis: UnitVisual;
  tag: BitmapText | null;
  tagUntil: number;
  bar: Sprite | null;
  barBg: Sprite | null;
  /** "T1".."T6" chip in the tier colour, so viewers can read a unit's price at a glance. */
  badge: BitmapText | null;
  badgeBg: Sprite | null;
  born: number;
  squad: number;
  kills: number;
  shield: number; // seconds of 50% damage reduction
  haste: number; // seconds of +50% speed
  // bombers
  passes: number;
  dropT: number;
  dir: number;
  scale: number;
}

type ProjKind = 'bullet' | 'shell' | 'rocket';
interface Proj {
  kind: ProjKind; s: Sprite; alive: boolean;
  x: number; y: number; tx: number; ty: number; speed: number;
  fid: number; dmg: number; splash: number; target: Target | null; tint: number; trail: number;
  w: keyof typeof COUNTER; owner: Unit | null; air: boolean; whistle: boolean;
}
interface Beam { s: Sprite; core: Sprite; life: number; max: number; w: number }
interface Wreck { s: Sprite; life: number; smoke: number }
interface Blast { t: number; x: number; y: number; r: number; dmg: number; fid: number; tier: number; owner: Unit | null; fortDmg: number; alive: boolean }

export type CaptureKind = 'core' | 'depot' | 'factory';
export interface CapturePoint {
  kind: CaptureKind; name: string; x: number; y: number;
  owner: number; // faction id or -1
  claim: number; // faction currently capturing
  progress: number; // 0..1
  view: Container; ring: Sprite; glows: Sprite[]; label: BitmapText;
  timer: number;
}

export type CrateKind = 'heal' | 'shield' | 'haste' | 'reinforce';
interface Crate {
  alive: boolean; x: number; y: number; alt: number; kind: CrateKind; golden: boolean; from: string;
  view: Container; chute: Sprite; body: Container; smoke: number; life: number;
}

export interface KillInfo { killer: Unit | null; killerFid: number; victim: Unit; cause?: 'lightning' | 'lava' | 'pylon' | 'depot' }

export interface WorldHooks {
  feedKill(k: KillInfo): void;
  feedText(text: string, code: string, color?: number): void;
  shake(a: number): void;
  bigBoom(x: number, y: number, power: number): void;
  hitStop(s: number): void;
  cinematic(u: { x: number; y: number }, tier: number, key: UnitKey, name: string, unitName: string, f: Faction): void;
  /** Draw a lightning bolt onto a world point (no damage: the caller applies it). */
  bolt(x: number, y: number): void;
  sound(kind: SfxKind, vol?: number, x?: number, y?: number): void;
}

const ENERGY = new Set<keyof typeof COUNTER>(['laser', 'emp', 'storm', 'titan', 'orbital']);

const CAPTURE_DEFS: { kind: CaptureKind; name: string; x: number; y: number }[] = [
  { kind: 'core', name: 'ENERGY CORE', x: 540, y: 1010 },
  { kind: 'depot', name: 'REPAIR DEPOT', x: 400, y: 700 },
  { kind: 'factory', name: 'FACTORY', x: 680, y: 1330 },
];

export class World {
  readonly decal: Sprite;
  readonly shadows = new Container();
  readonly pads = new Container();
  readonly ground = new Container();
  readonly proj = new Container();
  readonly air = new Container();
  readonly tags = new Container();
  private rt: RenderTexture;
  private stamp = new Container();
  private stampSprite: Sprite;

  factions: Faction[] = [];
  byCode = new Map<string, Faction>();
  units: Unit[] = [];
  caps: CapturePoint[] = [];
  private crates: Crate[] = [];
  private projs: Proj[] = [];
  private beams: Beam[] = [];
  private wrecks: Wreck[] = [];
  private blasts: Blast[] = [];
  private pool = new Map<UnitKey, UnitVisual[]>();
  private tagPool: BitmapText[] = [];
  private barPool: Sprite[] = [];
  /** Unit kinds viewers summoned this round (the HUD lists the ones still missing). */
  readonly summoned = new Set<UnitKey>();

  terrain: TerrainKey = 'jungle';
  weather: WeatherKey = 'clear';
  wind = 0;
  time = 0;
  /** damage dealt to the current raid boss, per faction id */
  readonly bossDmg = new Map<number, number>();
  /** score multiplier (2 during the final assault) */
  mult = 1;
  hooks!: WorldHooks;
  droppedSpawns = 0;
  /** coarse heat map for the camera director (6 x 10 cells) */
  readonly heat = new Float32Array(60);

  // spatial hash
  private readonly cell = 120;
  private readonly gw = Math.ceil(W / 120);
  private readonly gh = Math.ceil(H / 120);
  private grid: Unit[][] = [];

  constructor(private renderer: Renderer, private art: UnitArt, private fx: FxTextures, private flags: FlagAtlas, private particles: Particles) {
    this.rt = RenderTexture.create({ width: W, height: H });
    this.decal = new Sprite(this.rt);
    this.stampSprite = new Sprite(fx.scorch);
    this.stampSprite.anchor.set(0.5);
    this.stamp.addChild(this.stampSprite);
    BitmapFont.install({
      name: 'Tag',
      style: { fontFamily: 'Rajdhani, Arial', fontSize: 32, fontWeight: 'bold', fill: '#ffffff', stroke: { color: '#02060c', width: 5 } },
      chars: [['a', 'z'], ['A', 'Z'], ['0', '9'], ' @._-:!→+%x×#()/'],
    });
    for (let i = 0; i < this.gw * this.gh; i++) this.grid.push([]);
    for (let i = 0; i < 500; i++) {
      const s = new Sprite(fx.tracer);
      s.anchor.set(1, 0.5);
      s.visible = false;
      this.proj.addChild(s);
      this.projs.push({ kind: 'bullet', s, alive: false, x: 0, y: 0, tx: 0, ty: 0, speed: 0, fid: 0, dmg: 0, splash: 0, target: null, tint: 0, trail: 0, w: 'rifle', owner: null, air: false, whistle: false });
    }
    for (let i = 0; i < 60; i++) {
      const s = new Sprite(fx.beam);
      s.anchor.set(0, 0.5);
      s.blendMode = 'add';
      s.visible = false;
      const core = new Sprite(fx.beam);
      core.anchor.set(0, 0.5);
      core.blendMode = 'add';
      core.visible = false;
      this.proj.addChild(s, core);
      this.beams.push({ s, core, life: 0, max: 1, w: 1 });
    }
    for (let i = 0; i < 160; i++) this.blasts.push({ t: 0, x: 0, y: 0, r: 0, dmg: 0, fid: 0, tier: 0, owner: null, fortDmg: 0, alive: false });
    this.buildCaptures();
    // the mercenary faction always exists (id 0), it never owns a fortress
    this.addFaction(MERC);
  }

  // ================================================================ factions & forts
  private addFaction(def: CountryDef): Faction {
    const f: Faction = {
      id: this.factions.length, def, code: def.code, color: def.color, slot: -1, fort: null, lastActive: this.time,
      score: 0, kills: 0, fortsDestroyed: 0, units: 0, cls: { inf: 0, vehicle: 0, mech: 0, air: 0 }, hurtBy: { inf: 0, vehicle: 0, mech: 0, air: 0 },
      boost: 1, shieldT: 0, chest: 0, chestStage: 0,
    };
    this.factions.push(f);
    this.byCode.set(def.code, f);
    return f;
  }

  get merc() {
    return this.factions[0];
  }

  /** Active countries with a fortress slot, in slot order. */
  get slotted() {
    return this.factions.filter((f) => f.slot >= 0);
  }

  /** Get (or create) a country's faction and make sure it has a fortress if a slot is free / can be freed. */
  faction(code: string): Faction {
    let f = this.byCode.get(code);
    if (!f) {
      const def = COUNTRY_BY_CODE.get(code) ?? MERC;
      if (def === MERC) return this.merc;
      f = this.addFaction(def);
      f.color = this.distinctColor(def.color, f);
    }
    f.lastActive = this.time;
    if (f.slot < 0 && f !== this.merc) this.giveSlot(f);
    return f;
  }

  /** Keep team colours distinguishable: shift hue if too close to a country already on the map. */
  private distinctColor(c: number, self: Faction) {
    const hue = (x: number) => {
      const r = (x >> 16) / 255, g = ((x >> 8) & 255) / 255, b = (x & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!d) return 0;
      const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const used = this.factions.filter((f) => f !== self && f.slot >= 0).map((f) => hue(f.color));
    let h0 = hue(c);
    for (let i = 0; i < 12 && used.some((u) => Math.min(Math.abs(u - h0), 360 - Math.abs(u - h0)) < 18); i++) h0 = (h0 + 29) % 360;
    if (h0 === hue(c)) return c;
    const f = (n: number) => {
      const k = (n + h0 / 60) % 6;
      return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)) * 0.85));
    };
    return (f(5) << 16) | (f(3) << 8) | f(1);
  }

  private giveSlot(f: Faction) {
    const used = new Set(this.factions.map((x) => x.slot).filter((s) => s >= 0));
    let slot = SLOTS.findIndex((_, i) => !used.has(i));
    if (slot < 0) {
      // evict the least recently active country (it keeps its units; gets a slot back when active)
      const victim = this.slotted.filter((x) => this.time - x.lastActive > 20).sort((a, b) => a.lastActive - b.lastActive)[0];
      if (!victim) return;
      slot = victim.slot;
      this.removeFort(victim);
      victim.slot = -1;
      this.hooks?.feedText(`${victim.def.name} fortress went dormant`, victim.code, 0x9aa4b8);
    }
    f.slot = slot;
    this.buildFort(f, true);
    this.rescaleForts();
  }

  private buildFort(f: Faction, landing: boolean, hp = FORT_HP) {
    const s = SLOTS[f.slot];
    const view = buildFortress(f.color, this.art, this.fx);
    view.root.position.set(s.x, s.y);
    this.ground.addChildAt(view.root, 0);
    const flag = new Sprite(this.flags.get(f.code));
    flag.anchor.set(0.5);
    const label = new BitmapText({ text: f.def.name.toUpperCase(), style: { fontFamily: 'Tag', fontSize: 26 } });
    label.anchor.set(0.5);
    label.tint = f.color;
    const barBg = new Sprite(this.fx.white);
    barBg.tint = 0x000000;
    barBg.alpha = 0.65;
    const bar = new Sprite(this.fx.white);
    bar.tint = f.color;
    this.tags.addChild(barBg, bar, flag, label);
    f.fort = { x: s.x, y: s.y, radius: 100, hp, maxHp: FORT_HP, fid: f.id, cls: 'fort', alive: hp > 0, view, flag, label, barBg, bar, scale: 0.7, hitFlash: 0, cool: 1 };
    if (hp <= 0) view.body.alpha = 0.25;
    if (landing) {
      this.particles.ring(s.x, s.y, 6, f.color, 0.8);
      this.particles.flash(s.x, s.y, 4, f.color, 0.5);
      this.particles.sparks(s.x, s.y, 40, f.color, 500);
      this.stampDecal(this.fx.scorch, s.x, s.y, 2.2, 0.6);
      this.hooks?.shake(10);
      this.hooks?.sound('bigboom', 0.6, s.x, s.y);
    }
  }

  private removeFort(f: Faction) {
    if (!f.fort) return;
    const t = f.fort;
    t.view.root.destroy({ children: true });
    for (const o of [t.flag, t.label, t.barBg, t.bar]) o.destroy();
    f.fort = null;
  }

  private rescaleForts() {
    const n = this.slotted.length;
    const k = fortScale(n);
    for (const f of this.slotted) {
      const t = f.fort!;
      t.scale = k;
      t.radius = 130 * k;
      t.view.root.scale.set(k);
      const ly = t.y + (t.y < H / 2 ? 1 : -1) * (150 * k + 26);
      const above = t.y >= H / 2;
      t.flag.scale.set(0.5);
      t.flag.position.set(t.x - 70, ly);
      t.label.position.set(t.x + 18, ly);
      t.barBg.position.set(t.x - 92, ly + (above ? 22 : -34));
      t.barBg.width = 184;
      t.barBg.height = 12;
      t.bar.position.set(t.x - 90, t.barBg.y + 2);
      t.bar.height = 8;
    }
  }

  /** Rebuild all forts for a new round (full HP), keeping countries that were active recently. */
  newRound(terrain: TerrainKey, keepActiveWithin = 600) {
    this.summoned.clear();
    for (const u of [...this.units]) this.removeUnit(u);
    for (const w of this.wrecks) w.s.destroy();
    this.wrecks = [];
    for (const p of this.projs) (p.alive = false), (p.s.visible = false);
    for (const b of this.blasts) b.alive = false;
    for (const c of this.crates) this.removeCrate(c);
    this.crates = [];
    this.clearDecals();
    this.terrain = terrain;
    for (const f of this.factions) {
      f.score = f.kills = f.fortsDestroyed = f.chest = f.chestStage = f.shieldT = 0;
      f.boost = 1;
      this.removeFort(f);
      if (f.slot >= 0 && this.time - f.lastActive > keepActiveWithin && this.slotted.length > 4) f.slot = -1;
    }
    for (const f of this.slotted) this.buildFort(f, false);
    this.rescaleForts();
    for (const c of this.caps) {
      c.owner = -1;
      c.claim = -1;
      c.progress = 0;
    }
  }

  /** Reserve the fortress slots so the terrain painter keeps them clear. */
  static reserveSlots() {
    RESERVED.length = 0;
    for (const s of SLOTS) RESERVED.push({ x: s.x, y: s.y, r: 95 });
    for (const c of CAPTURE_DEFS) RESERVED.push({ x: c.x, y: c.y, r: 70 });
  }

  // ================================================================ capture points
  private buildCaptures() {
    for (const d of CAPTURE_DEFS) {
      const view = new Container();
      view.position.set(d.x, d.y);
      const base = new Sprite(this.art.capturePad[d.kind].base);
      const paint = new Sprite(this.art.capturePad[d.kind].paint);
      const glow = new Sprite(this.art.capturePad[d.kind].glow);
      for (const s of [base, paint, glow]) s.anchor.set(0.5);
      glow.blendMode = 'add';
      const ring = new Sprite(this.fx.ring);
      ring.anchor.set(0.5);
      ring.blendMode = 'add';
      ring.width = ring.height = 230;
      view.addChild(base, paint, glow, ring);
      view.scale.set(0.85);
      this.pads.addChild(view);
      const label = new BitmapText({ text: d.name, style: { fontFamily: 'Tag', fontSize: 20 } });
      label.anchor.set(0.5);
      label.position.set(d.x, d.y + 78);
      this.tags.addChild(label);
      this.caps.push({ ...d, owner: -1, claim: -1, progress: 0, view, ring, glows: [paint, glow], label, timer: 0 });
    }
  }

  private updateCaptures(dt: number) {
    for (const c of this.caps) {
      c.timer -= dt;
      const colorOf = (fid: number) => (fid >= 0 ? this.factions[fid].color : 0x8d98ab);
      c.ring.rotation += dt * (c.owner >= 0 ? 0.8 : 0.2);
      c.ring.alpha = 0.25 + Math.sin(this.time * 3) * 0.08 + c.progress * 0.3;
      if (c.timer > 0) continue;
      c.timer = 0.25;
      // presence weighted by tier
      const presence = new Map<number, number>();
      for (const u of this.near(c.x, c.y, 110)) {
        if (u.cls === 'air' || u.fid === 0) continue;
        presence.set(u.fid, (presence.get(u.fid) ?? 0) + 1 + u.def.tier);
      }
      let best = -1, bestV = 0, second = 0;
      for (const [fid, v] of presence) {
        if (v > bestV) (second = bestV), (bestV = v), (best = fid);
        else if (v > second) second = v;
      }
      if (best >= 0 && bestV > second * 1.5) {
        if (best === c.owner) c.progress = Math.min(1, c.progress + 0.05);
        else if (c.claim === best) {
          c.progress += 0.04 + Math.min(0.08, bestV * 0.004);
          if (c.progress >= 1) {
            c.owner = best;
            c.progress = 1;
            const f = this.factions[best];
            this.hooks.feedText(`${f.def.name} captured the ${c.name}!`, f.code, f.color);
            this.particles.ring(c.x, c.y, 4, f.color, 0.6);
            this.hooks.sound('alarm', 0.4, c.x, c.y);
          }
        } else {
          c.progress -= 0.08;
          if (c.progress <= 0) {
            c.progress = 0;
            c.claim = best;
            if (c.owner >= 0 && c.owner !== best) c.owner = -1;
          }
        }
      }
      const col = colorOf(c.owner >= 0 ? c.owner : c.claim);
      c.ring.tint = col;
      for (const g of c.glows) g.tint = c.owner >= 0 ? colorOf(c.owner) : 0x8d98ab;
      c.label.tint = c.owner >= 0 ? colorOf(c.owner) : 0xffffff;
      if (c.owner >= 0) {
        const f = this.factions[c.owner];
        f.score += 2 * 0.25 * this.mult * f.boost;
        if (c.kind === 'depot') for (const u of this.near(c.x, c.y, 260)) if (u.fid === c.owner && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.02);
      }
    }
  }

  private factoryTimer = 10;
  private captureBonuses(dt: number) {
    this.factoryTimer -= dt;
    if (this.factoryTimer <= 0) {
      this.factoryTimer = 10;
      const fc = this.caps.find((c) => c.kind === 'factory')!;
      if (fc.owner > 0) this.spawn('infantry', fc.owner, '', '', 0, { x: fc.x + rand(-40, 40), y: fc.y + rand(-40, 40) });
    }
  }

  coreOwner() {
    return this.caps[0].owner;
  }

  // ================================================================ spawning
  private takeVisual(key: UnitKey, color: number) {
    const v = this.pool.get(key)?.pop();
    if (v) {
      v.setColor(color);
      v.root.visible = v.shadow.visible = true;
      v.root.alpha = 1;
      v.root.scale.set(1);
      return v;
    }
    return buildVisual(key, color, this.art, this.fx);
  }

  private releaseVisual(v: UnitVisual) {
    v.root.parent?.removeChild(v.root);
    v.shadow.parent?.removeChild(v.shadow);
    const arr = this.pool.get(v.key) ?? [];
    if (arr.length < 60) {
      arr.push(v);
      this.pool.set(v.key, arr);
    } else {
      v.root.destroy({ children: true });
      v.shadow.destroy({ children: true });
    }
  }

  private takeTag(text: string, size: number, tint: number) {
    const t = this.tagPool.pop() ?? new BitmapText({ text: '', style: { fontFamily: 'Tag', fontSize: 16 } });
    t.text = text;
    t.style.fontSize = size;
    t.anchor.set(0.5);
    t.tint = tint;
    t.visible = true;
    this.tags.addChild(t);
    return t;
  }
  private takeBar(tint: number, alpha = 1) {
    const s = this.barPool.pop() ?? new Sprite(this.fx.white);
    s.tint = tint;
    s.alpha = alpha;
    s.visible = true;
    this.tags.addChild(s);
    return s;
  }

  spawnPoint(f: Faction): { x: number; y: number; dir: number } {
    if (f.slot >= 0) {
      const s = SLOTS[f.slot];
      const a = Math.atan2(H / 2 - s.y, W / 2 - s.x) + rand(-0.7, 0.7);
      const d = (f.fort?.radius ?? 80) + rand(30, 70);
      return { x: clamp(s.x + Math.cos(a) * d, 30, W - 30), y: clamp(s.y + Math.sin(a) * d, 30, H - 30), dir: a };
    }
    // no fortress: enter from a random map edge
    const side = (Math.random() * 4) | 0;
    const x = side === 0 ? 30 : side === 1 ? W - 30 : rand(100, W - 100);
    const y = side === 2 ? 440 : side === 3 ? H - 160 : rand(460, H - 400);
    return { x, y, dir: Math.atan2(H / 2 - y, W / 2 - x) };
  }

  /**
   * Spawns a unit for a faction. Over the cap, tier 0-1 units merge into an existing squad
   * (HP stacks, so the gift is never lost) and tier 2+ replace the oldest cheap unit.
   */
  spawn(key: UnitKey, fid: number, name: string, uid: string, rank: number, at?: { x: number; y: number }, power = 1): Unit | null {
    const def = UNITS[key];
    const f = this.factions[fid];
    if (key === 'strike') return this.launchStrike(f, name, uid);
    if (key === 'orbital') return this.launchOrbital(f, name, uid);
    if (this.units.length >= UNIT_CAP) {
      if (def.tier <= 1) {
        const mate = this.units.find((u) => u.fid === fid && u.def.key === key && u.squad < 12);
        if (mate) {
          mate.squad++;
          mate.maxHp += def.hp * 0.7;
          mate.hp += def.hp * 0.7;
          if (mate.tag) mate.tag.text = `${mate.name ? '@' + mate.name : f.def.name} x${mate.squad}`;
          return mate;
        }
        this.droppedSpawns++;
        return null;
      }
      const cheap = this.units.find((u) => u.def.tier <= 1 && u.fid === fid) ?? this.units.find((u) => u.def.tier <= 1);
      if (!cheap) {
        this.droppedSpawns++;
        return null;
      }
      this.removeUnit(cheap);
    }
    const sp = at ? { ...at, dir: Math.atan2(H / 2 - at.y, W / 2 - at.x) } : this.spawnPoint(f);
    const vis = this.takeVisual(key, f.color);
    const isBomber = key === 'bomber';
    let x = sp.x, y = sp.y, dir = sp.dir;
    if (isBomber) {
      // bombers enter from behind their fortress, off-screen
      x = clamp(sp.x - Math.cos(sp.dir) * 260, -120, W + 120);
      y = clamp(sp.y - Math.sin(sp.dir) * 260, -120, H + 120);
    }
    const hp = def.hp * power;
    const u: Unit = {
      def, name, uid, rank, fid, x, y, px: x, py: y, vx: 0, vy: 0, radius: def.radius, hp, maxHp: hp, cls: def.cls, alive: true,
      angle: dir, aim: dir, dist: 0, moving: 0, cool: rand(0, 1), special: rand(2, 4), salvo: 0,
      retarget: 0, target: null, goalX: W / 2, goalY: H / 2, flash: 0, vis, tag: null, tagUntil: 0, bar: null, barBg: null, badge: null, badgeBg: null, born: this.time,
      squad: 1, kills: 0, shield: 0, haste: 0, passes: 0, dropT: 0, dir, scale: 1,
    };
    (def.cls === 'air' ? this.air : this.ground).addChild(vis.root);
    this.shadows.addChild(vis.shadow);
    const label = name ? `@${name}` : def.tier >= 2 ? f.def.name.toUpperCase() : '';
    if (label) {
      const big = def.tier >= 4;
      const tint = big ? [0xffffff, 0xc8d2e0, 0x7fd8ff, 0xffd34d, 0xff9a3d, 0xff4fd8][rank] ?? 0xffe27a : def.tier >= 2 ? f.color : 0xffffff;
      u.tag = this.takeTag(label, big ? 24 : def.tier >= 2 ? 16 : 14, def.tier >= 5 ? 0xffe27a : tint);
      u.tagUntil = def.tier >= 2 ? Infinity : this.time + 3;
    }
    if (def.tier >= 2) {
      u.barBg = this.takeBar(0x000000, 0.6);
      u.bar = this.takeBar(f.color);
    }
    if (def.tier >= 1) {
      u.badgeBg = this.takeBar(0x02060c, 0.7);
      u.badge = this.takeTag(`T${def.tier}`, def.tier >= 4 ? 22 : 18, TIER_COLOR[def.tier]);
    }
    // arrival effect scales with tier ("pay-to-flex")
    this.particles.ring(x, y, 0.6 + def.tier * 0.5, f.color, 0.5);
    this.particles.flash(x, y, 0.5 + def.tier * 0.4, f.color, 0.3);
    if (def.tier >= 3) this.particles.sparks(x, y, 20, f.color, 300);
    if (def.tier >= 4) this.stampDecal(this.fx.scorch, x, y, 1.2, 0.5);
    this.units.push(u);
    if (def.tier >= 4 && uid !== 'boss') this.hooks.cinematic(u, def.tier, def.key, name || f.def.name, def.name, f);
    if (key === 'titan') this.hooks.sound('alarm');
    return u;
  }

  private removeUnit(u: Unit) {
    u.alive = false;
    this.releaseVisual(u.vis);
    for (const t of [u.tag, u.badge]) if (t) (t.visible = false), this.tags.removeChild(t), this.tagPool.length < 300 ? this.tagPool.push(t) : t.destroy();
    for (const b of [u.bar, u.barBg, u.badgeBg]) if (b) (b.visible = false), this.tags.removeChild(b), this.barPool.length < 300 ? this.barPool.push(b) : b.destroy();
    u.tag = u.badge = null;
    u.bar = u.barBg = u.badgeBg = null;
    const i = this.units.indexOf(u);
    if (i >= 0) {
      this.units[i] = this.units[this.units.length - 1];
      this.units.pop();
    }
  }

  // ================================================================ strategic strike (tier 6)
  private strikeQueue: { f: Faction; name: string; uid: string }[] = [];
  private launchStrike(f: Faction, name: string, uid: string): null {
    if (this.strikeQueue.length < 5) this.strikeQueue.push({ f, name, uid });
    return null;
  }
  get strikeActive() {
    return this.units.some((u) => u.def.key === 'strike');
  }
  private updateStrikes() {
    if (!this.strikeQueue.length || this.strikeActive) return;
    const { f, name, uid } = this.strikeQueue.shift()!;
    // target: strongest enemy fortress (most HP), else densest enemy area
    const enemies = this.slotted.filter((e) => e.id !== f.id && e.fort?.alive);
    const tgt = enemies.sort((a, b) => b.score - a.score || b.fort!.hp - a.fort!.hp)[0]?.fort ?? { x: W / 2, y: H / 2 };
    const from = this.spawnPoint(f);
    const a = Math.atan2(tgt.y - from.y, tgt.x - from.x);
    const sx = tgt.x - Math.cos(a) * 900, sy = tgt.y - Math.sin(a) * 900;
    const vis = this.takeVisual('strike', f.color);
    const def = UNITS.strike;
    const u: Unit = {
      def, name, uid, rank: 0, fid: f.id, x: sx, y: sy, px: sx, py: sy, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, radius: 1, hp: 1, maxHp: 1, cls: 'air', alive: true,
      angle: a, aim: a, dist: 0, moving: 1, cool: 0, special: 0, salvo: 0, retarget: 0, target: null, goalX: tgt.x, goalY: tgt.y, flash: 0, vis, tag: null, tagUntil: 0,
      bar: null, barBg: null, badge: null, badgeBg: null, born: this.time, squad: 1, kills: 0, shield: 0, haste: 0, passes: 0, dropT: 0, dir: a, scale: 2.4,
    };
    vis.root.scale.set(2.4);
    this.air.addChild(vis.root);
    this.shadows.addChild(vis.shadow);
    u.tag = this.takeTag(`☢ @${name || f.def.name}`.replace('☢ ', ''), 30, 0xffe27a);
    u.tagUntil = Infinity;
    this.units.push(u);
    this.hooks.cinematic(tgt, 6, 'strike', name || f.def.name, def.name, f);
    this.hooks.sound('alarm', 1);
  }


  // ================================================================ expansion unit behaviours
  private boltHit(t: Target, dmg: number, u: Unit) {
    this.hooks.bolt(t.x, t.y);
    this.particles.flash(t.x, t.y, 1.6, 0xb8d0ff, 0.25);
    this.particles.sparks(t.x, t.y, 16, 0xcfe0ff, 360);
    this.stampDecal(this.fx.scorch, t.x, t.y, 0.7, 0.8);
    this.damage(t, dmg, 'storm', u, u.fid);
    this.hooks.shake(4);
  }

  /** Repair drones follow the most damaged friendly unit and patch it up with a green beam. */
  private updateRepair(u: Unit, dt: number) {
    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target?.alive) {
      u.retarget = 0.6;
      let best: Unit | null = null, bs = 0;
      for (const o of this.near(u.x, u.y, 520)) {
        if (o.fid !== u.fid || o === u || o.def.key === 'strike' || o.hp >= o.maxHp) continue;
        const s = (1 - o.hp / o.maxHp) * (1 + o.def.tier) - Math.hypot(o.x - u.x, o.y - u.y) / 800;
        if (s > bs) (bs = s), (best = o);
      }
      u.target = best;
      if (!best) this.chooseGoal(u);
    }
    const t = u.target as Unit | null;
    let gx = u.goalX, gy = u.goalY;
    if (t) {
      // hover just behind the patient
      gx = t.x - Math.cos(t.angle) * 50;
      gy = t.y - Math.sin(t.angle) * 50;
    }
    const dx = gx - u.x, dy = gy - u.y, d = Math.hypot(dx, dy) || 1;
    const sp = d > 30 ? u.def.speed : 0;
    const k = Math.min(1, 3 * dt);
    u.vx += ((dx / d) * sp - u.vx) * k;
    u.vy += ((dy / d) * sp - u.vy) * k;
    u.x = clamp(u.x + u.vx * dt, 20, W - 20);
    u.y = clamp(u.y + u.vy * dt, 20, H - 20);
    const v = Math.hypot(u.vx, u.vy);
    u.moving = clamp(v / u.def.speed, 0, 1);
    if (v > 4) u.angle += angDiff(u.angle, Math.atan2(u.vy, u.vx)) * Math.min(1, dt * 5);
    if (t && Math.hypot(t.x - u.x, t.y - u.y) < u.def.range) {
      u.cool -= dt;
      if (u.cool <= 0) {
        u.cool = 0.25;
        const m = this.muzzle(u, 24, 3);
        this.beam(m.x, m.y, t.x, t.y, 5, 0x6dff9a, 0.22);
        this.particles.sparks(t.x, t.y, 2, 0x9affb8, 90);
        t.hp = Math.min(t.maxHp, t.hp + u.def.dmg * 0.25 * (1 + t.def.tier * 0.5));
      }
      u.aim = Math.atan2(t.y - u.y, t.x - u.x);
    }
  }

  /** Drone carriers keep a swarm of kamikaze drones in the air. */
  private carrierLaunch(u: Unit, dt: number) {
    if (u.special > 0) return; // ticks down in updateUnit
    u.special = 4.5;
    let mine = 0;
    for (const o of this.units) if (o.fid === u.fid && o.def.key === 'drone' && o.born > this.time - 30) mine++;
    if (mine >= 12) return;
    for (let i = 0; i < 3; i++) {
      const at = { x: u.x + Math.cos(u.angle) * 60 + rand(-20, 20), y: u.y + Math.sin(u.angle) * 60 + rand(-30, 30) };
      const d = this.spawn('drone', u.fid, '', u.uid, 0, at);
      if (d) d.angle = d.aim = u.angle;
    }
    this.particles.ring(u.x, u.y, 1.2, this.factions[u.fid].color, 0.35);
    this.hooks.sound('rocket', 0.5, u.x, u.y);
  }

  // ================================================================ orbital cannon (tier 6)
  private orbitalQueue: { f: Faction; name: string; uid: string }[] = [];
  private orbital: { f: Faction; name: string; uid: string; x: number; y: number; t: number; dir: number } | null = null;
  get orbitalActive() {
    return !!this.orbital;
  }
  private launchOrbital(f: Faction, name: string, uid: string): null {
    if (this.orbitalQueue.length < 5) this.orbitalQueue.push({ f, name, uid });
    return null;
  }
  private updateOrbital(dt: number) {
    if (!this.orbital && this.orbitalQueue.length && !this.strikeActive) {
      const { f, name, uid } = this.orbitalQueue.shift()!;
      const enemies = this.slotted.filter((e) => e.id !== f.id && e.fort?.alive);
      const tgt = enemies.sort((a, b) => b.score - a.score || b.fort!.hp - a.fort!.hp)[0]?.fort ?? { x: W / 2, y: H / 2 };
      this.orbital = { f, name, uid, x: tgt.x, y: tgt.y, t: 0, dir: Math.random() < 0.5 ? -1 : 1 };
      this.hooks.cinematic(this.orbital, 6, 'orbital', name || f.def.name, UNITS.orbital.name, f);
      this.hooks.sound('alarm', 1);
      this.hooks.feedText(`ORBITAL CANNON LOCKED by ${name ? '@' + name : f.def.name}!`, f.code, 0xffe27a);
    }
    const o = this.orbital;
    if (!o) return;
    o.t += dt;
    const col = o.f.color;
    if (o.t < 2.2) {
      // targeting: shrinking rings + warning sparks
      if (Math.random() < dt * 8) this.particles.ring(o.x, o.y, 3.4 - o.t, col, 0.4);
      if (Math.random() < dt * 4) this.beam(o.x - 260, o.y, o.x + 260, o.y, 3, col, 0.1), this.beam(o.x, o.y - 260, o.x, o.y + 260, 3, col, 0.1);
      return;
    }
    if (o.t < 2.2 + dt * 1.5) {
      this.hooks.bigBoom(o.x, o.y, 1);
      this.hooks.sound('bigboom', 1, o.x, o.y);
      this.hooks.shake(30);
    }
    if (o.t < 4.8) {
      // the beam sweeps slowly across the target
      const p = (o.t - 2.2) / 2.6;
      const bx = o.x + o.dir * (p - 0.5) * 300, by = o.y + Math.sin(p * 6) * 30;
      this.beam(bx, by - 1400, bx, by, 150, col, 0.08);
      this.beam(bx, by - 1400, bx, by, 60, 0xffffff, 0.08);
      this.particles.flash(bx, by, 3, col, 0.12);
      if (Math.random() < 0.6) this.particles.explode(bx + rand(-50, 50), by + rand(-50, 50), 2);
      if (Math.random() < 0.3) this.stampDecal(this.fx.scorch, bx, by, 1.4, 0.8);
      this.splashAt(bx, by, 110, 42, o.f.id, true, 'orbital', null);
      this.hooks.shake(8);
      this.addHeat(bx, by, 8);
      return;
    }
    this.stampDecal(this.fx.crater, o.x, o.y, 2.6, 0.9);
    this.orbital = null;
  }


  // ================================================================ terrain hazards
  private depots: { x: number; y: number; hp: number; alive: boolean; s: Container }[] = [];
  private pylonT = PYLONS.map(() => rand(1, 3));
  private hazardTerrain: TerrainKey | null = null;
  private buildHazards() {
    this.hazardTerrain = this.terrain;
    for (const d of this.depots) (d.alive = false), d.s.destroy({ children: true });
    this.depots = [];
    if (this.terrain !== 'industrial') return;
    for (const [x, y] of BARREL_SPOTS) {
      const c = new Container();
      for (const t of [this.art.depot.base, this.art.depot.glow]) {
        const sp = new Sprite(t);
        sp.anchor.set(0.5);
        if (t === this.art.depot.glow) (sp.blendMode = 'add'), (sp.tint = 0xffb040);
        c.addChild(sp);
      }
      c.position.set(x, y);
      c.scale.set(1.15);
      this.ground.addChildAt(c, 0);
      this.depots.push({ x, y, hp: 220, alive: true, s: c });
    }
  }

  private blowDepot(d: { x: number; y: number; hp: number; alive: boolean; s: Container }, fid: number, owner: Unit | null) {
    d.alive = false;
    d.s.visible = false;
    this.particles.explode(d.x, d.y, 4);
    this.particles.fireball(d.x, d.y, 2.2, 14);
    this.stampDecal(this.fx.crater, d.x, d.y, 1.3, 0.9);
    this.stampDecal(this.fx.scorch, d.x, d.y, 2, 1);
    this.hooks.bigBoom(d.x, d.y, 0.5);
    this.hooks.shake(16);
    this.hooks.sound('bigboom', 0.8, d.x, d.y);
    this.addHeat(d.x, d.y, 20);
    // chain reaction: the blast hurts everyone (no faction is safe) and can set off neighbours
    for (const u of this.near(d.x, d.y, 130)) {
      if (u.cls === 'air' || u.def.key === 'strike') continue;
      u.hp -= 180 * (1 - Math.hypot(u.x - d.x, u.y - d.y) / 160);
      u.flash = 1;
      if (u.hp <= 0) this.kill(u, owner, fid, 'depot');
    }
    for (const o of this.depots) if (o.alive && Math.hypot(o.x - d.x, o.y - d.y) < 280) this.delayedDepot(o, fid, owner);
  }
  private delayedDepot(d: { x: number; y: number; hp: number; alive: boolean; s: Container }, fid: number, owner: Unit | null) {
    d.hp = Math.min(d.hp, 1);
    setTimeout(() => d.alive && this.blowDepot(d, fid, owner), 350);
  }

  private updateHazards(dt: number) {
    if (this.hazardTerrain !== this.terrain) this.buildHazards();
    if (this.weather === 'emstorm' || this.weather === 'sandstorm') {
      for (const u of this.units) {
        if (!u.alive || u.def.key === 'strike') continue;
        // EM storm fries drone electronics; a sandstorm slowly scours armour
        const d = this.weather === 'emstorm' ? (u.def.key === 'drone' || u.def.key === 'repair' ? 14 : 0) : u.cls === 'inf' ? 0 : u.maxHp * 0.002;
        if (d <= 0) continue;
        u.hp -= d * dt;
        if (this.weather === 'emstorm' && Math.random() < dt * 2) this.particles.sparks(u.x, u.y, 3, 0xc090ff, 120);
        if (u.hp <= 0) this.kill(u, null, -1, 'lightning');
      }
    }
    if (this.terrain === 'volcano') {
      for (const u of this.units) {
        if (u.cls === 'air' || !u.alive) continue;
        if (lavaDist(u.x, u.y) > LAVA_HALF + u.radius * 0.3) continue;
        u.hp -= (u.def.key === 'hover' ? 20 : 45) * dt * (1 + u.def.tier * 0.4);
        u.flash = 0.5;
        if (Math.random() < dt * 8) this.particles.flame(u.x + rand(-u.radius, u.radius) * 0.6, u.y + rand(-u.radius, u.radius) * 0.6, 0.7);
        if (u.hp <= 0) this.kill(u, null, -1, 'lava');
      }
    }
    if (this.terrain === 'sea') {
      for (const u of this.units) {
        if (u.cls === 'air' || !u.alive || u.def.key === 'hover') continue;
        if (Math.random() < dt * 3 && Math.hypot(u.vx, u.vy) > 10 && isWater(u.x, u.y)) this.splash(u.x + rand(-u.radius, u.radius) * 0.5, u.y + rand(-u.radius, u.radius) * 0.5);
      }
    }
    if (this.terrain === 'industrial') {
      PYLONS.forEach(([x, y], i) => {
        this.pylonT[i] -= dt;
        if (this.pylonT[i] > 0) return;
        this.pylonT[i] = rand(1.2, 2.4);
        let best: Unit | null = null, bd = 120;
        for (const u of this.near(x, y, 120)) {
          if (u.def.key === 'strike') continue;
          const d = Math.hypot(u.x - x, u.y - y);
          if (d < bd) (bd = d), (best = u);
        }
        if (!best) return;
        this.beam(x, y, best.x, best.y, 7, 0x9ad8ff, 0.2);
        this.particles.sparks(best.x, best.y, 10, 0xcfe8ff, 260);
        best.hp -= 50;
        best.flash = 1;
        this.hooks.sound('laser', 0.3, best.x, best.y);
        if (best.hp <= 0) this.kill(best, null, -1, 'pylon');
      });
    }
  }

  /** Ground speed multiplier from the terrain under the unit. */
  private terrainSpeed(u: Unit) {
    if (u.def.key === 'hover') return 1;
    if (this.terrain === 'desert' && (u.def.key === 'jeep' || u.def.key === 'mlrs' || u.def.key === 'emp')) return 0.8;
    if (this.terrain === 'sea' && isWater(u.x, u.y)) return 0.45;
    return 1;
  }

  /** Fire-rate penalty: energy weapons overheat in the desert (and in a heatwave). */
  private heatFactor(u: Unit) {
    const energy = u.def.weapon === 'laser' || u.def.weapon === 'flame' || u.def.weapon === 'emp' || u.def.weapon === 'storm';
    let k = 1;
    if (energy && this.terrain === 'desert') k *= 1.2;
    if (energy && this.weather === 'heatwave') k *= 1.3;
    return k;
  }

  // ================================================================ supply crates
  dropCrate(golden = false, from = '', at?: { x: number; y: number }) {
    if (this.crates.length >= 6) return;
    const kinds: CrateKind[] = ['heal', 'shield', 'haste', 'reinforce'];
    const kind = golden ? 'reinforce' : Math.random() < 0.12 ? 'reinforce' : pick(kinds.slice(0, 3));
    const x = at?.x ?? rand(200, W - 200), y = at?.y ?? rand(560, H - 560);
    const view = new Container();
    view.position.set(x, y);
    const body = new Container();
    const base = new Sprite(this.art.crate.base);
    const paint = new Sprite(this.art.crate.paint);
    const glow = new Sprite(this.art.crate.glow);
    for (const s of [base, paint, glow]) s.anchor.set(0.5);
    glow.blendMode = 'add';
    const c = golden ? 0xffd34d : { heal: 0x4dff88, shield: 0x4dc8ff, haste: 0xff9a3d, reinforce: 0xff4fd8 }[kind];
    paint.tint = glow.tint = c;
    body.addChild(base, paint, glow);
    if (golden) body.scale.set(1.4);
    const chute = new Sprite(this.art.parachute.base);
    chute.anchor.set(0.5);
    view.addChild(body, chute);
    this.air.addChild(view);
    const label = from ? `Supply from @${from}` : '';
    this.crates.push({ alive: true, x, y, alt: 1, kind, golden, from: label, view, chute, body, smoke: 0, life: 45 });
    this.hooks.feedText(golden && from ? `★ Golden supply crate from @${from}!` : 'Supply crate incoming!', 'XX', golden ? 0xffd34d : 0xffffff);
  }

  private removeCrate(c: Crate) {
    c.alive = false;
    c.view.destroy({ children: true });
  }

  private updateCrates(dt: number) {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      c.life -= dt;
      if (c.alt > 0) {
        c.alt = Math.max(0, c.alt - dt * 0.25);
        const k = 1 + c.alt * 1.6;
        c.view.scale.set(k);
        c.chute.alpha = Math.min(1, c.alt * 4);
        c.chute.position.set(Math.sin(this.time * 2) * 3, -18);
        c.view.x = c.x + c.alt * 120 * Math.sin(this.time * 0.8);
        if (c.alt === 0) {
          c.chute.visible = false;
          c.view.x = c.x;
          this.particles.ring(c.x, c.y, 1.4, 0xffffff, 0.4);
          this.hooks.sound('drop', 0.8, c.x, c.y);
          // reparent to the ground layer once landed
          this.ground.addChild(c.view);
        }
        continue;
      }
      c.smoke -= dt;
      if (c.smoke <= 0) {
        c.smoke = 0.12;
        this.particles.smokePuff(c.x, c.y - 8, 0.6, c.golden ? 0xffd34d : 0xff4f4f, 2.4, 0.45);
      }
      c.body.rotation = Math.sin(this.time * 3) * 0.05;
      // first ground unit to touch it claims it
      const taker = this.near(c.x, c.y, 40).find((u) => u.cls !== 'air' || u.def.key === 'heli') ?? null;
      if (taker || c.life <= 0) {
        if (taker) this.claimCrate(c, taker);
        this.removeCrate(c);
        this.crates.splice(i, 1);
      }
    }
  }

  private claimCrate(c: Crate, u: Unit) {
    const f = this.factions[u.fid];
    this.particles.flash(c.x, c.y, 2, 0xffffff, 0.4);
    this.particles.sparks(c.x, c.y, 30, f.color, 350);
    const mates = this.near(c.x, c.y, 260).filter((m) => m.fid === u.fid);
    let what = '';
    if (c.kind === 'heal') {
      for (const m of mates) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.5);
      what = 'REPAIR KIT';
    } else if (c.kind === 'shield') {
      for (const m of mates) m.shield = 15;
      what = 'ENERGY SHIELDS';
    } else if (c.kind === 'haste') {
      for (const m of mates) m.haste = 15;
      what = 'NITRO BOOST';
    } else {
      const n = c.golden ? 3 : 1;
      for (let i = 0; i < n; i++) this.spawn(c.golden ? 'tank' : 'heli', u.fid, u.name, u.uid, u.rank, { x: c.x + rand(-40, 40), y: c.y + rand(-40, 40) });
      what = c.golden ? 'TANK PLATOON' : 'FREE ATTACK HELI';
    }
    this.hooks.feedText(`${u.name ? '@' + u.name : f.def.name} grabbed ${what}${c.from ? ` (${c.from})` : ''}`, f.code, f.color);
  }

  // ================================================================ weapons
  private fire(kind: ProjKind, x: number, y: number, target: Target, owner: Unit | null, fid: number, dmg: number, splash: number, tint: number, w: keyof typeof COUNTER, spread = 0) {
    const p = this.projs.find((q) => !q.alive);
    if (!p) return;
    p.kind = kind;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.tx = target.x + rand(-spread, spread);
    p.ty = target.y + rand(-spread, spread);
    p.target = target;
    p.fid = fid;
    p.dmg = dmg;
    p.splash = splash;
    p.tint = tint;
    p.trail = 0;
    p.w = w;
    p.owner = owner;
    p.air = target.cls === 'air';
    p.whistle = w === 'artillery';
    p.speed = kind === 'bullet' ? 1400 : kind === 'shell' ? 900 : 520;
    const s = p.s;
    s.visible = true;
    s.position.set(x, y);
    if (kind === 'bullet') {
      s.texture = this.fx.tracer;
      s.anchor.set(1, 0.5);
      s.blendMode = 'add';
      s.tint = tint;
      s.scale.set(1.3, 0.8);
    } else if (kind === 'shell') {
      s.texture = this.fx.glow;
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = 0xffd28a;
      s.scale.set(0.16);
    } else {
      s.texture = this.fx.rocket;
      s.anchor.set(0.5);
      s.blendMode = 'normal';
      s.tint = 0xffffff;
      s.scale.set(1.2);
    }
  }

  private beam(x: number, y: number, x2: number, y2: number, width: number, tint: number, life: number) {
    const b = this.beams.find((q) => q.life <= 0);
    if (!b) return;
    const a = Math.atan2(y2 - y, x2 - x);
    const len = Math.hypot(x2 - x, y2 - y);
    for (const [s, w, c] of [[b.s, width, tint], [b.core, width * 0.35, 0xffffff]] as const) {
      s.visible = true;
      s.position.set(x, y);
      s.rotation = a;
      s.width = len;
      s.height = w;
      s.tint = c;
      s.alpha = 1;
    }
    b.life = b.max = life;
    b.w = width;
  }

  private delayedBlast(t: number, x: number, y: number, r: number, dmg: number, fid: number, tier: number, owner: Unit | null, fortDmg = 0) {
    const b = this.blasts.find((q) => !q.alive);
    if (!b) return;
    Object.assign(b, { t, x, y, r, dmg, fid, tier, owner, fortDmg, alive: true });
  }

  private damage(t: Target, dmg: number, w: keyof typeof COUNTER, attacker: Unit | null, fid: number) {
    if (!t.alive || dmg <= 0) return;
    let d = dmg * COUNTER[w][t.cls];
    if (d <= 0) return;
    if (this.weather === 'emstorm' && ENERGY.has(w)) d *= 1.3;
    if (this.weather === 'heatwave' && (w === 'flame' || w === 'dragon')) d *= 1.25;
    if (t.cls === 'fort') {
      const fort = t as Fort;
      if (attacker && !attacker.uid) d *= 0.5; // CPU reinforcements chip forts slowly; viewers' units hit full
      if (this.factions[fort.fid].shieldT > 0) d *= 0.5; // underdog shield
      fort.hitFlash = 1;
      const f = this.factions[fid];
      f.score += d * 0.1 * this.mult * f.boost;
      fort.hp -= d;
      this.addHeat(t.x, t.y, d * 0.02);
      if (fort.hp <= 0) this.destroyFort(fort, fid);
      return;
    }
    const u = t as Unit;
    if (u.shield > 0) d *= 0.5;
    if (u.def.key === 'strike') return;
    u.hp -= d;
    u.flash = 1;
    if (u.uid === 'boss' && fid > 0) this.bossDmg.set(fid, (this.bossDmg.get(fid) ?? 0) + Math.min(d, u.hp + d));
    if (attacker) this.factions[u.fid].hurtBy[attacker.cls] += d;
    this.addHeat(u.x, u.y, d * 0.01);
    if (u.hp <= 0) this.kill(u, attacker, fid);
  }

  private splashAt(x: number, y: number, r: number, dmg: number, fid: number, hitAir: boolean, w: keyof typeof COUNTER, owner: Unit | null) {
    for (const u of this.near(x, y, r + 80)) {
      if (u.fid === fid || !u.alive || (u.cls === 'air' && !hitAir)) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < r + u.radius) {
        this.damage(u, dmg * (1 - (d / (r + u.radius)) * 0.6), w, owner, fid);
        // knock-back: light units fly further
        if (u.alive && u.cls !== 'air') {
          const k = (dmg / (u.def.mass * 20)) * 30;
          u.vx += ((u.x - x) / (d || 1)) * k;
          u.vy += ((u.y - y) / (d || 1)) * k;
        }
      }
    }
    for (const f of this.slotted) {
      const t = f.fort!;
      if (f.id !== fid && t.alive && Math.hypot(t.x - x, t.y - y) < r + t.radius) this.damage(t, dmg * 0.5, w, owner, fid);
    }
    for (const d of this.depots) {
      if (!d.alive || Math.hypot(d.x - x, d.y - y) > r + 30) continue;
      d.hp -= dmg;
      if (d.hp <= 0) this.blowDepot(d, fid, owner);
    }
  }

  private stampDecal(tex: Texture, x: number, y: number, scale: number, alpha: number, rot = rand(0, 6.28), tint = 0xffffff) {
    const s = this.stampSprite;
    s.texture = tex;
    s.position.set(x, y);
    s.scale.set(scale);
    s.rotation = rot;
    s.alpha = alpha;
    s.tint = tint;
    this.renderer.render({ container: this.stamp, target: this.rt, clear: false });
  }

  // ================================================================ ground physics: terrain + weather made visible
  private mat(x: number, y: number): Mat {
    return surfaceAt(this.terrain, this.weather, x, y);
  }

  /** Something hits the ground; the ground answers in its own material.
   *  power 0.5 = bullet puff, 1 = shell, 2-3 = vehicle wreck / bomb, 4+ = mega blast. */
  groundFx(x: number, y: number, power: number) {
    const m = this.mat(x, y), L = LOOK[m], P = this.particles, fx = this.fx;
    const smoke = () => fx.smoke[(Math.random() * 3) | 0];
    const n = (k: number) => Math.max(1, Math.round(k * P.budget));
    if (power < 0.8) {
      if (m === 'water') P.spawn(fx.ring, false, x, y, 0, 0, 0.35, 0.03, 0.12, 0.6, 0, 0xdcefff);
      else P.spawn(smoke(), false, x, y, rand(-15, 15), rand(-28, -8), rand(0.4, 0.8), 0.06, 0.28, L.dustAlpha * 0.8, 0, L.dust, { wind: 1, drag: 2 });
      if (m === 'concrete' && Math.random() < 0.4) P.sparks(x, y, 1, 0xffe0a0, 200);
      return;
    }
    const k = Math.sqrt(power);
    if (m === 'water') {
      // geyser: white column shooting up, rings spreading, spray drifting off
      for (let i = 0; i < n(10 + power * 6); i++) {
        const a = -Math.PI / 2 + rand(-0.35, 0.35), v = rand(160, 360) * k;
        P.spawn(fx.spark, false, x + rand(-8, 8) * k, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.5, 0.9), 0.5 * k, 0.2, 0.95, 0, 0xf0f8ff, { drag: 2.2, stretch: 2.5, wind: 0.3 });
      }
      for (let i = 0; i < 3; i++) P.spawn(fx.ring, false, x, y, 0, 0, 0.9 + i * 0.3, 0.1 * k, (0.6 + i * 0.35) * k, 0.7, 0, 0xdcefff, { delay: i * 0.12 });
      for (let i = 0; i < n(4 + power * 2); i++)
        P.spawn(smoke(), false, x + rand(-12, 12) * k, y - rand(0, 40) * k, rand(-20, 20), rand(-50, -15), rand(1.2, 2), 0.3 * k, 1.1 * k, 0.55, 0, 0xeef6ff, { wind: 1, drag: 0.8, delay: 0.1 });
      this.hooks.sound('splash', Math.min(1, 0.4 + power * 0.15), x, y);
      return;
    }
    // ground ring of material hugging the floor
    for (let i = 0; i < n(6 + power * 3); i++) {
      const a = rand(0, 6.28), v = rand(70, 150) * k;
      P.spawn(smoke(), false, x, y, Math.cos(a) * v, Math.sin(a) * v * 0.7, rand(0.8, 1.4) * (0.7 + L.plume * 0.4), 0.2 * k, 0.7 * k, L.dustAlpha, 0, L.dust, { drag: 2.6, spin: rand(-1, 1), wind: 0.6 });
    }
    // plume of material thrown up, lingers by material (sand hangs, mud drops)
    for (let i = 0; i < n(3 + power * 2 * L.plume); i++)
      P.spawn(smoke(), false, x + rand(-14, 14) * k, y + rand(-10, 10) * k, rand(-14, 14), rand(-60, -25) * L.plume, rand(1.4, 2.4) * L.plume + 0.6, 0.35 * k, 1.5 * k, L.dustAlpha * 0.9, 0, L.dust, { wind: 1.1, drag: 0.7, spin: rand(-0.4, 0.4), delay: rand(0, 0.15) });
    // chunks of the ground itself (snow clods, mud, rubble, sand)
    for (let i = 0; i < n(4 + power * 3); i++) {
      const a = rand(0, 6.28), v = rand(120, 260) * k;
      P.spawn(fx.debris, false, x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.6, 1.1), rand(0.4, 0.8), 0.3, 1, 0.7, L.chunk, { spin: rand(-12, 12), drag: 2.5, arc: rand(0.8, 1.6) });
    }
    if (m === 'mud') // splatter marks around the hole
      for (let i = 0; i < Math.min(6, 2 + power); i++) this.stampDecal(this.fx.scorch, x + rand(-30, 30) * k, y + rand(-30, 30) * k, rand(0.2, 0.45) * k, 0.55, rand(0, 6.28), 0x2a3010);
    if (m === 'snow') { // white powder blown out + exposed dark ground
      this.stampDecal(this.fx.crater, x, y, 0.35 * k, 0.5, rand(0, 6.28), 0x5a6a7a);
      for (let i = 0; i < n(4); i++) P.sparkle(x + rand(-30, 30) * k, y + rand(-30, 30) * k);
    }
    if (m === 'concrete') P.sparks(x, y, 3 + power * 2, 0xffd890, 300);
    if (m === 'ash') for (let i = 0; i < n(4 + power * 2); i++)
      P.spawn(fx.glow, true, x + rand(-20, 20) * k, y + rand(-20, 20) * k, rand(-30, 30), rand(-80, -30), rand(1, 2), 0.08, 0.03, 1, 0, 0xff7a30, { wind: 1, drag: 0.6, delay: rand(0, 0.4) });
    this.fireWeather(x, y, power);
  }

  /** Fire meets the weather: rain and snow hiss it out into steam, a heatwave makes it roar. */
  private fireWeather(x: number, y: number, power: number) {
    const P = this.particles, w = this.weather;
    if (w === 'rain' || w === 'storm' || w === 'blizzard') {
      for (let i = 0; i < Math.max(1, Math.round(power * 1.5 * P.budget)); i++)
        P.spawn(this.fx.smoke[i % 3], false, x + rand(-14, 14), y + rand(-14, 14), rand(-10, 10), rand(-60, -30), rand(1, 1.8), 0.25, 1.2 * Math.sqrt(power), 0.5, 0, 0xf4f8ff, { wind: 1, drag: 0.5, delay: rand(0.05, 0.3) });
      if (Math.random() < 0.25) this.hooks.sound('steam', 0.5, x, y);
    } else if (w === 'heatwave') {
      for (let i = 0; i < Math.max(1, Math.round(power * 2 * P.budget)); i++) P.flame(x + rand(-16, 16), y + rand(-16, 16), 0.9 + power * 0.2);
    }
  }

  /** Wheels, tracks and feet on the ground: marks, dust, wakes, skids. slip = angle between where it goes and where it wants to go. */
  private stepFx(u: Unit, v: number, slip: number, dt: number) {
    if (v < 6) return;
    const m = this.mat(u.x, u.y), L = LOOK[m], P = this.particles;
    const heavy = u.cls === 'vehicle' || u.cls === 'mech';
    const hover = u.def.key === 'hover';
    const ca = Math.cos(u.angle), sa = Math.sin(u.angle);
    const rx = u.x - ca * u.radius * 0.7, ry = u.y - sa * u.radius * 0.7;
    if (m === 'water') {
      if (Math.random() < dt * (heavy ? 9 : 4)) {
        P.spawn(this.fx.ring, false, rx, ry, 0, 0, 0.9, 0.05, heavy ? u.radius / 50 : 0.25, 0.55, 0, 0xdcefff);
        P.spawn(this.fx.spark, false, rx + rand(-6, 6), ry + rand(-6, 6), -ca * 60 + rand(-40, 40), -sa * 60 + rand(-40, 40), 0.4, 0.3, 0.1, 0.8, 0, 0xffffff, { drag: 3, stretch: 2 });
      }
      return;
    }
    if (L.track >= 0 && !hover) {
      if (heavy && Math.random() < dt * 9) {
        const w = u.radius * 0.5, sc = clamp(u.radius / 28, 0.6, 1.6);
        for (const s of [-1, 1]) this.stampDecal(this.fx.track, u.x - sa * w * s, u.y + ca * w * s, sc, L.trackAlpha, u.angle + Math.PI / 2, L.track);
      } else if (u.cls === 'inf' && (m === 'snow' || m === 'sand' || m === 'mud') && Math.random() < dt * 2.5)
        this.stampDecal(this.fx.track, u.x, u.y, 0.28, L.trackAlpha * 0.8, u.angle + Math.PI / 2, L.track);
    }
    const soft = m === 'sand' || m === 'snow' || m === 'ash';
    const rate = heavy ? (soft ? 12 : m === 'concrete' ? 3 : 6) : soft ? 3 : 1;
    if (Math.random() < dt * rate * P.budget)
      P.spawn(this.fx.smoke[(Math.random() * 3) | 0], false, rx + rand(-8, 8), ry + rand(-8, 8), -ca * v * 0.15 + rand(-10, 10), -sa * v * 0.15 + rand(-14, 0), rand(0.8, 1.6), heavy ? 0.15 : 0.08, heavy ? clamp(u.radius / 30, 0.5, 1.6) : 0.35, L.dustAlpha * (heavy ? 0.6 : 0.4), 0, L.dust, { wind: 1, drag: 1, spin: rand(-0.6, 0.6) });
    if (m === 'mud' && heavy && Math.random() < dt * 5)
      P.spawn(this.fx.debris, false, rx, ry, -ca * 80 + rand(-60, 60), -sa * 80 + rand(-60, 60), 0.5, 0.35, 0.2, 1, 0.6, L.chunk, { drag: 3, arc: 0.8, spin: rand(-8, 8) });
    // ice: vehicles slide sideways, leaving pale skid streaks and ice spray
    if (this.terrain === 'ice' && heavy && slip > 0.3 && v > 18 && Math.random() < dt * 16) {
      this.stampDecal(this.fx.track, rx, ry, clamp(u.radius / 28, 0.6, 1.4), 0.45, Math.atan2(u.vy, u.vx) + Math.PI / 2, 0xd8e6f6);
      P.spawn(this.fx.spark, false, rx, ry, -u.vx * 0.5 + rand(-40, 40), -u.vy * 0.5 + rand(-40, 40), 0.45, 0.35, 0.1, 0.9, 0, 0xf4faff, { drag: 3, stretch: 2 });
    }
    // rain: puddle splashes under wheels and boots
    if ((this.weather === 'rain' || this.weather === 'storm') && Math.random() < dt * (heavy ? 6 : 2)) this.splash(rx + rand(-10, 10), ry + rand(-10, 10));
  }

  clearDecals() {
    this.renderer.render({ container: new Container(), target: this.rt, clear: true });
  }

  private destroyFort(t: Fort, byFid: number) {
    t.alive = false;
    t.hp = 0;
    const victim = this.factions[t.fid];
    const by = this.factions[byFid];
    by.score += 500 * this.mult * by.boost;
    by.fortsDestroyed++;
    this.megaBoom(t.x, t.y);
    t.view.body.alpha = 0.25;
    this.hooks.feedText(`${victim.def.name} FORTRESS DESTROYED by ${by.def.name}!`, by.code, by.color);
  }

  private kill(u: Unit, killer: Unit | null, killerFid: number, cause?: KillInfo['cause']) {
    u.alive = false;
    const tier = u.def.tier;
    const kf = this.factions[killerFid];
    if (kf) {
      kf.score += u.def.value * this.mult * kf.boost;
      kf.kills++;
    }
    if (killer) {
      killer.kills++;
      if (killer.tag && killer.def.tier <= 1) killer.tagUntil = this.time + 2.5; // show name again on a kill
    }
    this.hooks.feedKill({ killer, killerFid, victim: u, cause });
    this.particles.explode(u.x, u.y, tier + (u.def.key === 'drone' ? 1 : 0));
    this.hooks.sound(tier >= 2 ? 'boom' : 'gun', tier >= 2 ? 1 : 0.4, u.x, u.y);
    if (u.cls !== 'air') this.groundFx(u.x, u.y, 1 + tier * 0.5);
    if (u.cls !== 'air' || u.def.key === 'heli') {
      if (tier >= 2) this.stampDecal(this.fx.crater, u.x, u.y, 0.4 + tier * 0.15, 0.8);
      this.stampDecal(this.fx.scorch, u.x, u.y, 0.5 + tier * 0.25, 0.9);
    }
    if (tier >= 2) {
      this.hooks.shake(6 + tier * 4);
      if (tier >= 3) this.hooks.hitStop(0.05);
      const wreckTex = ({ tank: this.art.tankHull, aa: this.art.aaHull, spider: this.art.spiderBody, heli: this.art.heliBody, robot: this.art.robotTorso, titan: this.art.titanTorso, bomber: this.art.bomber, jeep: this.art.jeepBody, mbt: this.art.mbtHull, mlrs: this.art.mlrsHull, emp: this.art.empHull, hover: this.art.hoverBody, mobile: this.art.mobileHull, carrier: this.art.carrier, stormfort: this.art.stormBase, dragon: this.art.dragonHead } as Partial<Record<UnitKey, { base: Texture }>>)[u.def.key]?.base;
      if (wreckTex && this.wrecks.length < 30) {
        const s = new Sprite(wreckTex);
        s.anchor.set(0.5);
        s.position.set(u.x, u.y);
        s.rotation = u.angle;
        s.tint = 0x2b2622;
        this.ground.addChildAt(s, Math.min(2, this.ground.children.length));
        this.wrecks.push({ s, life: 7, smoke: 0 });
      }
    }
    if (tier >= 3 && tier < 5) this.hooks.bigBoom(u.x, u.y, 0.45);
    if (tier >= 5) this.megaBoom(u.x, u.y);
    this.removeUnit(u);
  }

  megaBoom(x: number, y: number) {
    this.particles.explode(x, y, 6);
    for (let i = 0; i < 6; i++) this.particles.explode(x + rand(-90, 90), y + rand(-90, 90), 3);
    this.stampDecal(this.fx.crater, x, y, 2.8, 0.9);
    this.stampDecal(this.fx.scorch, x, y, 3.5, 1);
    this.hooks.shake(32);
    this.hooks.bigBoom(x, y, 1);
    this.hooks.hitStop(0.09);
    this.hooks.sound('bigboom', 1, x, y);
    this.groundFx(x, y, 5);
    this.addHeat(x, y, 40);
  }

  /** Lightning prefers tall metal units (robots, Titans) near the strike. */
  lightningAt(x: number, y: number) {
    let best: Unit | null = null, bd = 260;
    for (const u of this.units) {
      if (u.def.key === 'strike' || u.def.key === 'stormfort') continue;
      const tall = u.cls === 'mech' ? u.def.tier * 40 + 60 : u.def.tier * 15;
      const d = Math.hypot(u.x - x, u.y - y) - tall;
      if (d < bd) (bd = d), (best = u);
    }
    const tx = best?.x ?? x, ty = best?.y ?? y;
    this.particles.flash(tx, ty, 2.5, 0xb8d0ff, 0.35);
    this.particles.sparks(tx, ty, 30, 0xcfe0ff, 420);
    this.stampDecal(this.fx.scorch, tx, ty, 0.9, 0.9);
    if (best) {
      best.hp -= 260;
      best.flash = 1;
      if (best.hp <= 0) this.kill(best, null, -1, 'lightning');
    }
    this.hooks.shake(10);
    return { x: tx, y: ty };
  }

  splash(x: number, y: number) {
    this.particles.spawn(this.fx.ring, true, x, y, 0, 0, 0.25, 0.04, 0.14, 0.5, 0, 0xc8dcff);
  }

  // ================================================================ queries
  private rebuildGrid() {
    for (const c of this.grid) c.length = 0;
    for (const u of this.units) {
      const cx = clamp((u.x / this.cell) | 0, 0, this.gw - 1), cy = clamp((u.y / this.cell) | 0, 0, this.gh - 1);
      this.grid[cy * this.gw + cx].push(u);
    }
  }

  private nearBuf: Unit[] = [];
  /** Units within r of (x, y). Returns a shared buffer: copy it if you keep it. */
  near(x: number, y: number, r: number): Unit[] {
    const out = this.nearBuf;
    out.length = 0;
    const x0 = clamp(((x - r) / this.cell) | 0, 0, this.gw - 1), x1 = clamp(((x + r) / this.cell) | 0, 0, this.gw - 1);
    const y0 = clamp(((y - r) / this.cell) | 0, 0, this.gh - 1), y1 = clamp(((y + r) / this.cell) | 0, 0, this.gh - 1);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        for (const u of this.grid[cy * this.gw + cx]) {
          const dx = u.x - x, dy = u.y - y;
          if (u.alive && dx * dx + dy * dy <= r2) out.push(u);
        }
    return out;
  }

  private findTarget(u: Unit): Target | null {
    const w = u.def.weapon;
    const range = this.rangeOf(u);
    const R = Math.min(range * 2 + 160, 720);
    let best: Target | null = null, bs = Infinity;
    for (const o of this.near(u.x, u.y, R)) {
      if (o.fid === u.fid || o.def.key === 'strike') continue;
      const m = COUNTER[w][o.cls];
      if (m <= 0) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      const s = d / (0.4 + m);
      if (s < bs) (bs = s), (best = o);
    }
    if (COUNTER[w].fort > 0) {
      for (const f of this.slotted) {
        const t = f.fort!;
        if (f.id === u.fid || !t.alive) continue;
        const d = Math.max(0, Math.hypot(t.x - u.x, t.y - u.y) - t.radius);
        if (d < R && d / (0.4 + COUNTER[w].fort) < bs) (bs = d), (best = t);
      }
    }
    return best;
  }

  /** Where a unit marches when nothing is in range: nearest enemy fortress, else a capture point. */
  private chooseGoal(u: Unit) {
    let bx = W / 2, by = H / 2, bd = Infinity;
    for (const f of this.slotted) {
      const t = f.fort!;
      if (f.id === u.fid || !t.alive) continue;
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      if (d < bd) (bd = d), (bx = t.x), (by = t.y);
    }
    if (bd === Infinity || Math.random() < 0.35) {
      const c = this.caps.filter((c) => c.owner !== u.fid);
      if (c.length) {
        const p = c.reduce((a, b) => (Math.hypot(a.x - u.x, a.y - u.y) < Math.hypot(b.x - u.x, b.y - u.y) ? a : b));
        bx = p.x + rand(-50, 50);
        by = p.y + rand(-50, 50);
      }
    }
    u.goalX = bx;
    u.goalY = by;
  }

  rangeOf(u: Unit) {
    let r = u.def.range;
    if (this.weather === 'blizzard') r *= 0.8;
    if (this.weather === 'sandstorm') r *= 0.7;
    if (this.weather === 'emstorm' && (u.def.key === 'aa' || u.def.key === 'mlrs')) r *= 0.75; // radar blackout
    if (this.weather === 'fog' && (u.def.key === 'sniper' || u.def.key === 'aa' || u.def.key === 'robot')) r *= 0.6;
    return r;
  }

  // ================================================================ main update (fixed tick)
  update(dt = SIM_DT) {
    this.time += dt;
    this.rebuildGrid();
    for (const f of this.factions) {
      f.units = 0;
      f.cls.inf = f.cls.vehicle = f.cls.mech = f.cls.air = 0;
      for (const k of ['inf', 'vehicle', 'mech', 'air'] as UnitClass[]) f.hurtBy[k] *= 1 - dt * 0.15;
    }
    for (const u of this.units) {
      const f = this.factions[u.fid];
      f.units++;
      f.cls[u.cls]++;
      u.px = u.x;
      u.py = u.y;
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u && u.alive) this.updateUnit(u, dt);
    }
    for (const p of this.projs) if (p.alive) this.updateProj(p, dt);
    for (const b of this.blasts) {
      if (!b.alive) continue;
      b.t -= dt;
      if (b.t > 0) continue;
      b.alive = false;
      this.particles.explode(b.x, b.y, b.tier);
      this.groundFx(b.x, b.y, 1 + b.tier * 0.4);
      this.stampDecal(this.fx.scorch, b.x, b.y, 0.5 + b.tier * 0.2, 0.9);
      if (b.tier >= 3) this.stampDecal(this.fx.crater, b.x, b.y, 0.3 + b.tier * 0.12, 0.8);
      this.splashAt(b.x, b.y, b.r, b.dmg, b.fid, false, 'bombs', b.owner);
      if (b.fortDmg > 0)
        for (const f of this.slotted) {
          const t = f.fort!;
          if (f.id !== b.fid && t.alive && Math.hypot(t.x - b.x, t.y - b.y) < t.radius + b.r) this.damage(t, b.fortDmg, 'bombs', b.owner, b.fid);
        }
      this.hooks.shake(3 + b.tier * 2);
      this.hooks.sound('boom', 0.5, b.x, b.y);
    }
    for (const f of this.slotted) {
      const t = f.fort!;
      t.view.shield.alpha = t.alive ? (f.shieldT > 0 ? 0.6 + Math.sin(this.time * 6) * 0.2 : 0.2 + Math.sin(this.time * 2 + f.id) * 0.06) : 0;
      t.view.shield.rotation += dt * 0.2;
      t.hitFlash = Math.max(0, t.hitFlash - dt * 4);
      t.bar.width = 180 * Math.max(0, t.hp / t.maxHp);
      t.bar.tint = t.hp / t.maxHp < 0.25 && Math.sin(this.time * 10) > 0 ? 0xff3030 : f.color;
      if (t.alive) this.fortTurrets(f, t, dt);
      if (!t.alive && Math.random() < dt * 6) this.particles.smokePuff(t.x + rand(-60, 60) * t.scale, t.y + rand(-60, 60) * t.scale, 1.2, 0x3a3632, 3, 0.5);
    }
    this.updateCaptures(dt);
    this.captureBonuses(dt);
    this.updateCrates(dt);
    this.updateStrikes();
    this.updateOrbital(dt);
    this.updateHazards(dt);
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const w = this.wrecks[i];
      w.life -= dt;
      w.smoke -= dt;
      if (w.smoke <= 0) {
        w.smoke = 0.2;
        this.particles.smokePuff(w.s.x + rand(-10, 10), w.s.y + rand(-10, 10), 0.7, 0x55504b, 2.5, 0.35);
        if (Math.random() < 0.5) this.particles.flame(w.s.x + rand(-12, 12), w.s.y + rand(-12, 12), 0.6);
      }
      if (w.life < 1) w.s.alpha = w.life;
      if (w.life <= 0) {
        this.stampDecal(w.s.texture, w.s.x, w.s.y, w.s.scale.x, 0.55, w.s.rotation, 0x1a1816);
        w.s.destroy();
        this.wrecks.splice(i, 1);
      }
    }
    for (let i = 0; i < this.heat.length; i++) this.heat[i] *= 1 - dt * 0.35;
  }

  /** Fortress corner turrets defend against anything close. */
  private fortTurrets(f: Faction, t: Fort, dt: number) {
    t.cool -= dt;
    if (t.cool > 0) return;
    t.cool = 0.5;
    const r = t.radius + 170;
    let best: Unit | null = null, bd = Infinity;
    for (const u of this.near(t.x, t.y, r)) {
      if (u.fid === f.id || u.def.key === 'strike') continue;
      const d = Math.hypot(u.x - t.x, u.y - t.y);
      if (d < bd) (bd = d), (best = u);
    }
    if (!best) return;
    const a = Math.atan2(best.y - t.y, best.x - t.x);
    const mx = t.x + Math.cos(a) * t.radius * 0.9, my = t.y + Math.sin(a) * t.radius * 0.9;
    this.particles.muzzle(mx, my, a, 0.5, f.color);
    this.fire('bullet', mx, my, best, null, f.id, 22, 0, f.color, 'robot', 8);
  }

  private addHeat(x: number, y: number, v: number) {
    const cx = clamp((x / (W / 6)) | 0, 0, 5), cy = clamp((y / (H / 10)) | 0, 0, 9);
    this.heat[cy * 6 + cx] += v;
  }

  private updateUnit(u: Unit, dt: number) {
    const def = u.def;
    u.flash = Math.max(0, u.flash - dt * 5);
    u.shield = Math.max(0, u.shield - dt);
    u.haste = Math.max(0, u.haste - dt);
    if (def.key === 'bomber' || def.key === 'strike') return this.updateBomber(u, dt);
    if (def.weapon === 'repair') return this.updateRepair(u, dt);
    u.retarget -= dt;
    if (u.retarget <= 0 || (u.target && !u.target.alive)) {
      u.retarget = 0.4 + Math.random() * 0.25;
      u.target = this.findTarget(u);
      if (!u.target && (Math.random() < 0.3 || Math.hypot(u.goalX - u.x, u.goalY - u.y) < 60)) this.chooseGoal(u);
    }
    const tgt = u.target;
    const range = this.rangeOf(u);
    let gx = u.goalX, gy = u.goalY;
    let dToT = Infinity;
    if (tgt) {
      dToT = Math.hypot(tgt.x - u.x, tgt.y - u.y) - tgt.radius;
      gx = tgt.x;
      gy = tgt.y;
    }
    const engage = tgt && dToT < range;
    const ter = TERRAINS.find((t) => t.key === this.terrain)!;
    let speed = def.speed;
    if (u.cls !== 'air' && def.key !== 'hover') {
      speed *= ter.groundSpeed;
      if (u.cls === 'vehicle' || u.cls === 'mech') speed *= ter.heavyPenalty;
      if (this.weather === 'rain' || this.weather === 'storm') speed *= 0.88;
    }
    if (this.weather === 'blizzard') speed *= 0.75;
    if (this.weather === 'sandstorm') speed *= u.cls === 'air' ? 0.8 : 0.9;
    if (u.cls !== 'air') speed *= this.terrainSpeed(u);
    if (u.haste > 0) speed *= 1.5;
    let dx = gx - u.x, dy = gy - u.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    if (engage && def.weapon !== 'kamikaze') {
      if (def.key === 'heli' || def.key === 'dragon') {
        const tx = -dy, ty = dx;
        dx = tx;
        dy = ty;
        speed *= 0.6;
      } else speed = 0;
    }
    // separation from friendly ground units (cheap: only the unit's own neighbourhood)
    if (u.cls !== 'air') {
      for (const o of this.near(u.x, u.y, u.radius + 30)) {
        if (o === u || o.cls === 'air') continue;
        const ox = u.x - o.x, oy = u.y - o.y;
        const d = Math.hypot(ox, oy) || 1;
        const min = u.radius + o.radius;
        if (d < min) {
          const push = ((min - d) / min) * (o.def.mass / (u.def.mass + o.def.mass)) * 2;
          dx += (ox / d) * push;
          dy += (oy / d) * push;
        }
      }
    }
    const accel = u.cls === 'air' ? 3 : this.terrain === 'ice' ? 1.2 : 6;
    const k = Math.min(1, accel * dt);
    u.vx += (dx * speed - u.vx) * k;
    u.vy += (dy * speed - u.vy) * k;
    if (u.cls === 'air') u.vx += this.wind * 0.08 * dt;
    u.x = clamp(u.x + u.vx * dt, 20, W - 20);
    u.y = clamp(u.y + u.vy * dt, 20, H - 20);
    const v = Math.hypot(u.vx, u.vy);
    u.dist += v * dt;
    u.moving = clamp(v / (def.speed * 0.5), 0, 1);
    if (v > 4) u.angle += angDiff(u.angle, Math.atan2(u.vy, u.vx)) * Math.min(1, dt * (def.key === 'titan' ? 1.5 : def.key === 'robot' ? 2.5 : 6));
    const aimWant = tgt ? Math.atan2(tgt.y - u.y, tgt.x - u.x) : u.angle;
    u.aim += angDiff(u.aim, aimWant) * Math.min(1, dt * 5);

    if (u.cls !== 'air') this.stepFx(u, v, Math.abs(angDiff(Math.atan2(u.vy, u.vx), Math.atan2(dy, dx))), dt);
    if (def.key === 'hover' && v > 10 && Math.random() < dt * 10) this.particles.smokePuff(u.x - Math.cos(u.angle) * 44 + rand(-14, 14), u.y - Math.sin(u.angle) * 44 + rand(-14, 14), 0.5, this.terrain === 'ice' ? 0xe8f0ff : 0xa89a80, 1, 0.35);
    if (def.key === 'carrier') this.carrierLaunch(u, dt);
    if (def.key === 'stormfort' && Math.random() < dt * 1.5) this.particles.sparks(u.x + rand(-40, 40), u.y + rand(-40, 40), 3, 0xb8c8ff, 160);
    if (def.key === 'heli' && Math.random() < dt * 4) this.particles.trail(u.x - Math.cos(u.angle) * 40, u.y - Math.sin(u.angle) * 40, 0.6, 0x666666);

    u.cool -= dt * (this.coreOwner() === u.fid ? 1.3 : 1);
    u.special -= dt;
    if (tgt && engage && u.cool <= 0 && Math.abs(angDiff(u.aim, aimWant)) < 0.4) {
      u.cool = def.fireInterval * rand(0.85, 1.15) * this.heatFactor(u);
      this.shoot(u, tgt);
    }
    if ((def.key === 'titan' || def.key === 'robot') && tgt && dToT < range * 1.2) this.heavySpecials(u, tgt);
    if (def.weapon === 'kamikaze' && tgt && dToT < 20) {
      this.particles.explode(u.x, u.y, 3);
      this.splashAt(u.x, u.y, 60, def.dmg, u.fid, true, 'kamikaze', u);
      if (tgt.cls === 'fort') this.damage(tgt, def.dmg, 'kamikaze', u, u.fid);
      this.hooks.sound('boom', 0.7, u.x, u.y);
      this.groundFx(u.x, u.y, 2);
      this.stampDecal(this.fx.scorch, u.x, u.y, 0.8, 0.9);
      this.hooks.shake(5);
      this.removeUnit(u);
    }
  }

  private updateBomber(u: Unit, dt: number) {
    const strike = u.def.key === 'strike';
    if (!strike && u.passes === 0 && u.dropT === 0) {
      // pick a run: densest enemy cluster or enemy fortress
      let best: Target | null = null, bs = 0;
      for (const o of this.units) {
        if (o.fid === u.fid || o.cls === 'air') continue;
        const s = this.near(o.x, o.y, 150).filter((n) => n.fid !== u.fid).length;
        if (s > bs) (bs = s), (best = o);
      }
      if (bs < 4) {
        const forts = this.slotted.filter((f) => f.id !== u.fid && f.fort!.alive).map((f) => f.fort!);
        if (forts.length) best = pick(forts);
      }
      const t = best ?? { x: W / 2, y: H / 2 };
      u.goalX = t.x;
      u.goalY = t.y;
      u.dropT = -1;
    }
    const want = Math.atan2(u.goalY - u.y, u.goalX - u.x);
    const dGoal = Math.hypot(u.goalX - u.x, u.goalY - u.y);
    if (!strike && u.dropT < 0 && dGoal > 260) u.angle += angDiff(u.angle, want) * Math.min(1, dt * 1.2);
    const sp = strike ? 330 : u.def.speed;
    u.vx = Math.cos(u.angle) * sp + this.wind * 0.15;
    u.vy = Math.sin(u.angle) * sp;
    u.x += u.vx * dt;
    u.y += u.vy * dt;
    u.dist += sp * dt;
    u.aim = u.angle;
    u.moving = 1 - Math.min(0.4, Math.abs(angDiff(u.angle, want)) * 0.3);
    // carpet bombing near the goal
    const bombing = strike ? u.x > -50 && u.x < W + 50 && u.y > 150 && u.y < H - 50 : dGoal < 240;
    if (bombing) {
      u.cool -= dt;
      if (u.cool <= 0) {
        u.cool = strike ? 0.07 : u.def.fireInterval;
        const off = rand(-40, 40) * (strike ? 3 : 1);
        const bx = u.x - Math.cos(u.angle) * 30 - Math.sin(u.angle) * off, by = u.y - Math.sin(u.angle) * 30 + Math.cos(u.angle) * off;
        if (Math.random() < (strike ? 0.15 : 0.5)) this.hooks.sound('whistle', 0.5, bx, by);
        this.delayedBlast(0.45, bx, by, strike ? 110 : 55, strike ? 700 : u.def.dmg * (this.weather === 'wind' ? 0.8 : 1), u.fid, strike ? 4 : 2, u, strike ? 260 : 60);
      }
    }
    // left the map: turn around for another pass, or leave
    const out = u.x < -220 || u.x > W + 220 || u.y < -220 || u.y > H + 220;
    if (out) {
      if (strike || u.passes >= 2) {
        this.removeUnit(u);
        return;
      }
      u.passes++;
      u.angle = Math.atan2(H / 2 - u.y, W / 2 - u.x) + rand(-0.3, 0.3);
      u.dropT = 0; // re-pick a target
      u.passes = Math.max(1, u.passes);
    }
  }

  private muzzle(u: Unit, fx: number, fy: number) {
    const c = Math.cos(u.aim), s = Math.sin(u.aim);
    return { x: u.x + c * fx - s * fy, y: u.y + s * fx + c * fy };
  }

  private shoot(u: Unit, t: Target) {
    const f = this.factions[u.fid];
    const dmg = u.def.dmg;
    switch (u.def.weapon) {
      case 'rifle': {
        const m = this.muzzle(u, 21, 4);
        this.particles.muzzle(m.x, m.y, u.aim, 0.25, 0xffd27a);
        this.fire('bullet', m.x, m.y, t, u, u.fid, dmg, 0, 0xffe2a0, 'rifle', 10);
        this.hooks.sound('gun', 0.3, u.x, u.y);
        break;
      }
      case 'sniper': {
        const m = this.muzzle(u, 34, -1);
        this.particles.muzzle(m.x, m.y, u.aim, 0.4, 0xffe8b0);
        this.beam(m.x, m.y, t.x, t.y, 3, 0xfff2c0, 0.12);
        this.particles.sparks(t.x, t.y, 4, 0xffffff, 200);
        this.damage(t, dmg, 'sniper', u, u.fid);
        this.hooks.sound('sniper', 0.5, u.x, u.y);
        break;
      }
      case 'atRocket': {
        const m = this.muzzle(u, 28, -7);
        this.particles.smokePuff(u.x - Math.cos(u.aim) * 14, u.y - Math.sin(u.aim) * 14, 0.6, 0x9a9a9a, 1);
        this.fire('rocket', m.x, m.y, t, u, u.fid, dmg, 30, 0xffffff, 'atRocket', 6);
        this.hooks.sound('rocket', 0.4, u.x, u.y);
        break;
      }
      case 'flame': {
        const m = this.muzzle(u, 22, 4);
        const wet = this.weather === 'rain' || this.weather === 'storm' ? 0.55 : 1;
        for (let i = 0; i < 2; i++) {
          const a = u.aim + rand(-0.18, 0.18), v = rand(260, 340);
          this.particles.spawn(this.fx.flame, true, m.x, m.y, Math.cos(a) * v, Math.sin(a) * v, 0.32, 0.25, 0.9, 1, 0, 0xffe08a, { c1: 0xff3000, drag: 2, rot: a + Math.PI / 2 });
        }
        this.damage(t, dmg * wet, 'flame', u, u.fid);
        this.fireWeather(t.x, t.y, 1);
        this.hooks.sound('flame', 0.45, u.x, u.y);
        if (Math.random() < 0.05) this.stampDecal(this.fx.scorch, t.x, t.y, 0.4, 0.5);
        break;
      }
      case 'shell': {
        const m = this.muzzle(u, u.def.key === 'mbt' ? 58 : 39, 0);
        this.particles.muzzle(m.x, m.y, u.aim, 0.7, 0xffc070);
        this.particles.smokePuff(m.x, m.y, 0.5, 0x777777, 1.2);
        u.flash = 0.6;
        this.fire('shell', m.x, m.y, t, u, u.fid, dmg, u.def.key === 'mbt' ? 60 : 40, 0xffd28a, 'shell', 12);
        this.hooks.sound('cannon', u.def.key === 'mbt' ? 0.8 : 0.5, u.x, u.y);
        break;
      }
      case 'flak': {
        const side = (u.salvo++ % 2) * 2 - 1;
        const m = this.muzzle(u, 24, 11 * side);
        this.particles.muzzle(m.x, m.y, u.aim, 0.3, 0xfff0a0);
        this.fire('bullet', m.x, m.y, t, u, u.fid, dmg, t.cls === 'air' ? 26 : 0, 0xfff0a0, 'flak', 16);
        this.hooks.sound('flak', 0.35, u.x, u.y);
        break;
      }
      case 'laser': {
        const side = (u.salvo++ % 2) * 2 - 1;
        const m = this.muzzle(u, 33, 5 * side);
        const hx = t.x + rand(-6, 6), hy = t.y + rand(-6, 6);
        this.beam(m.x, m.y, hx, hy, 9, f.color, 0.09);
        this.particles.sparks(hx, hy, 3, f.color, 200);
        this.particles.flash(hx, hy, 0.3, f.color, 0.1);
        this.damage(t, dmg, 'laser', u, u.fid);
        this.hooks.sound('laser', 0.25, u.x, u.y);
        break;
      }
      case 'rocket': {
        for (const side of [-1, 1]) {
          const m = u.def.key === 'hover' ? this.muzzle(u, -4, 16 * side) : this.muzzle(u, 10, 22 * side);
          this.particles.muzzle(m.x, m.y, u.aim, 0.4, 0xffb060);
          this.fire('rocket', m.x, m.y, t, u, u.fid, dmg, 45, 0xffffff, 'rocket', 20);
        }
        this.hooks.sound('rocket', 0.45, u.x, u.y);
        break;
      }
      case 'robot': {
        const m = this.muzzle(u, 52, 24);
        this.particles.muzzle(m.x, m.y, u.aim, 0.9, f.color);
        u.flash = 0.6;
        this.fire('shell', m.x, m.y, t, u, u.fid, dmg, 50, f.color, 'robot', 14);
        this.hooks.sound('cannon', 0.6, u.x, u.y);
        break;
      }
      case 'titan': {
        const side = (u.salvo++ % 2) * 2 - 1;
        const m = this.muzzle(u, 68, 36 * side);
        this.particles.muzzle(m.x, m.y, u.aim, 0.45, f.color);
        this.fire('bullet', m.x, m.y, t, u, u.fid, dmg, 0, f.color, 'titan', 22);
        this.hooks.sound('gun', 0.45, u.x, u.y);
        break;
      }
      case 'mg': {
        const m = this.muzzle(u, 20, 0);
        this.particles.muzzle(m.x, m.y, u.aim, 0.3, 0xffe08a);
        this.fire('bullet', m.x, m.y, t, u, u.fid, dmg, 0, 0xffe2a0, 'mg', 14);
        if (u.salvo++ % 3 === 0) this.hooks.sound('gun', 0.3, u.x, u.y);
        break;
      }
      case 'artillery': {
        // six-rocket salvo arcing onto the target area
        u.flash = 1;
        for (let i = 0; i < 6; i++) {
          const m = this.muzzle(u, -2 + (i % 3) * 7, -8 + ((i / 3) | 0) * 16);
          this.fire('rocket', m.x, m.y, t, u, u.fid, dmg, 55, 0xffffff, 'artillery', 70);
        }
        this.particles.smokePuff(u.x, u.y, 1.4, 0x9a9a9a, 2.2, 0.5);
        this.hooks.sound('rocket', 0.9, u.x, u.y);
        break;
      }
      case 'emp': {
        // electromagnetic pulse: wrecks electronics (mechs, drones), stuns everything in the blast
        u.flash = 1;
        const m = this.muzzle(u, -6, 0);
        this.beam(m.x, m.y, t.x, t.y, 14, 0x9ad8ff, 0.18);
        this.particles.ring(t.x, t.y, 2.4, 0x9ad8ff, 0.45);
        this.particles.flash(t.x, t.y, 1.6, 0x9ad8ff, 0.25);
        this.particles.sparks(t.x, t.y, 24, 0xcfe8ff, 360);
        this.splashAt(t.x, t.y, 130, dmg * (this.terrain === 'industrial' ? 1.3 : 1), u.fid, true, 'emp', u);
        for (const o of this.near(t.x, t.y, 150)) {
          if (o.fid === u.fid || o.def.key === 'strike') continue;
          o.cool = Math.max(o.cool, 1.4);
          o.vx *= 0.1;
          o.vy *= 0.1;
        }
        if (t.cls === 'fort') this.damage(t, dmg, 'emp', u, u.fid);
        this.hooks.sound('laser', 0.8, u.x, u.y);
        break;
      }
      case 'mobile': {
        // three turrets take turns: two cannons, then the main rail gun
        const k = u.salvo++ % 3;
        const c = Math.cos(u.angle), s = Math.sin(u.angle);
        const [ox, oy] = k === 0 ? [38, 0] : k === 1 ? [-6, -16] : [-6, 16];
        const bx = u.x + c * ox - s * oy, by = u.y + s * ox + c * oy;
        const mx = bx + Math.cos(u.aim) * (k === 0 ? 44 : 28), my = by + Math.sin(u.aim) * (k === 0 ? 44 : 28);
        this.particles.muzzle(mx, my, u.aim, k === 0 ? 0.9 : 0.6, 0xffc070);
        if (t.cls === 'air') this.fire('bullet', mx, my, t, u, u.fid, dmg * 0.5, 20, 0xfff0a0, 'mobile', 16);
        else this.fire('shell', mx, my, t, u, u.fid, k === 0 ? dmg * 1.6 : dmg, 50, 0xffd28a, 'mobile', 14);
        u.flash = 0.6;
        this.hooks.sound('cannon', k === 0 ? 0.8 : 0.5, u.x, u.y);
        break;
      }
      case 'carrier': {
        // point-defence guns along the deck
        const m = this.muzzle(u, rand(-60, 80), rand(-30, 30));
        this.fire('bullet', m.x, m.y, t, u, u.fid, dmg, t.cls === 'air' ? 20 : 0, f.color, 'carrier', 18);
        if (u.salvo++ % 4 === 0) this.hooks.sound('flak', 0.3, u.x, u.y);
        break;
      }
      case 'storm': {
        // calls lightning onto the target, chaining to up to two more enemies
        u.flash = 1;
        let x = t.x, y = t.y;
        const hit = new Set<Target>([t]);
        this.boltHit(t, dmg, u);
        for (let j = 0; j < 2; j++) {
          let nx: Unit | null = null, nd = 160;
          for (const o of this.near(x, y, 160)) {
            if (o.fid === u.fid || hit.has(o) || o.def.key === 'strike') continue;
            const d = Math.hypot(o.x - x, o.y - y);
            if (d < nd) (nd = d), (nx = o);
          }
          if (!nx) break;
          this.beam(x, y, nx.x, nx.y, 6, 0xcfe0ff, 0.2);
          hit.add(nx);
          this.boltHit(nx, dmg * 0.5, u);
          x = nx.x;
          y = nx.y;
        }
        this.hooks.sound('thunder', 0.7, u.x, u.y);
        break;
      }
      case 'dragon': {
        // flame breath cone
        const m = this.muzzle(u, 46, 0);
        for (let i = 0; i < 3; i++) {
          const a = u.aim + rand(-0.25, 0.25), v = rand(380, 520);
          this.particles.spawn(this.fx.flame, true, m.x, m.y, Math.cos(a) * v, Math.sin(a) * v, 0.45, 0.4, 1.6, 1, 0, 0xfff0b0, { c1: f.color, drag: 1.6, rot: a + Math.PI / 2 });
        }
        const wet = this.weather === 'rain' || this.weather === 'storm' ? 0.7 : 1;
        this.splashAt(t.x, t.y, 45, dmg * wet, u.fid, true, 'dragon', u);
        this.fireWeather(t.x, t.y, 1.6);
        if (t.cls === 'fort') this.damage(t, dmg * 1.5, 'dragon', u, u.fid);
        if (Math.random() < 0.08) this.stampDecal(this.fx.scorch, t.x + rand(-30, 30), t.y + rand(-30, 30), 0.6, 0.6);
        if (u.salvo++ % 5 === 0) this.hooks.sound('flame', 0.7, u.x, u.y);
        break;
      }
      default:
        break;
    }
  }

  private heavySpecials(u: Unit, t: Target) {
    if (u.special > 0) return;
    const f = this.factions[u.fid];
    if (u.def.key === 'robot') {
      u.special = rand(4, 6);
      for (let i = 0; i < 6; i++) {
        const m = this.muzzle(u, 18, -28 + i * 2);
        this.fire('rocket', m.x, m.y, t, u, u.fid, 40, 45, 0xffffff, 'rocket', 50);
      }
      this.hooks.sound('rocket', 0.9, u.x, u.y);
      return;
    }
    u.special = rand(3.5, 5);
    if (Math.random() < 0.55) {
      for (const side of [-1, 1]) {
        const m = this.muzzle(u, 82, 58 * side);
        const ex = t.x + rand(-20, 20), ey = t.y + rand(-20, 20);
        this.beam(m.x, m.y, ex, ey, 44, f.color, 0.55);
        this.particles.flash(m.x, m.y, 1.6, f.color, 0.3);
        this.particles.explode(ex, ey, 3);
        this.splashAt(ex, ey, 70, 260, u.fid, true, 'titan', u);
        if (t.cls === 'fort') this.damage(t, 200, 'titan', u, u.fid);
        this.stampDecal(this.fx.scorch, ex, ey, 1.2, 1);
      }
      this.hooks.shake(14);
      this.hooks.sound('laser', 1, u.x, u.y);
      this.hooks.sound('boom', 1, u.x, u.y);
    } else {
      for (let i = 0; i < 8; i++) {
        const m = this.muzzle(u, -40, rand(-30, 30));
        this.fire('rocket', m.x, m.y, t, u, u.fid, 60, 55, 0xffffff, 'rocket', 70);
      }
      this.hooks.sound('rocket', 1, u.x, u.y);
    }
  }

  private updateProj(p: Proj, dt: number) {
    if (p.kind === 'rocket' && p.target?.alive) {
      p.tx += (p.target.x - p.tx) * Math.min(1, dt * 3);
      p.ty += (p.target.y - p.ty) * Math.min(1, dt * 3);
    }
    if (p.kind === 'rocket') p.tx += this.wind * 0.12 * dt;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    const a = Math.atan2(dy, dx);
    p.s.rotation = a;
    if (d <= step) {
      p.alive = false;
      p.s.visible = false;
      this.impact(p);
      return;
    }
    if (p.whistle && d < p.speed * 0.9) {
      p.whistle = false;
      this.hooks.sound('whistle', 0.7, p.tx, p.ty);
    }
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.s.position.set(p.x, p.y);
    if (p.kind === 'rocket') {
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = 0.03;
        this.particles.trail(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, 0.5);
        this.particles.spawn(this.fx.glow, true, p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, 0, 0, 0.08, 0.18, 0.05, 1, 0, 0xffa040);
      }
    }
  }

  private impact(p: Proj) {
    const t = p.target;
    if (p.kind === 'bullet') {
      if (p.w === 'flak' && p.air) {
        this.particles.flash(p.tx, p.ty, 0.5, 0xfff0a0, 0.12);
        this.particles.smokePuff(p.tx, p.ty, 0.35, 0x444444, 0.8, 0.6);
      } else this.particles.sparks(p.tx, p.ty, 2, p.tint, 160);
      if (t?.alive && Math.hypot(t.x - p.tx, t.y - p.ty) < t.radius + 20) {
        this.damage(t, p.dmg, p.w, p.owner, p.fid);
        // rounds ringing off armour
        if (t.cls === 'vehicle' || t.cls === 'mech' || t.cls === 'fort') {
          const r = Math.random();
          if (r < 0.12) this.hooks.sound('clang', 0.35, p.tx, p.ty);
          else if (r < 0.17) {
            this.hooks.sound('ricochet', 0.4, p.tx, p.ty);
            this.particles.sparks(p.tx, p.ty, 3, 0xfff4c0, 320);
          }
        }
      } else if (!p.air && Math.random() < 0.5) this.groundFx(p.tx, p.ty, 0.5);
      return;
    }
    this.particles.explode(p.tx, p.ty, p.kind === 'shell' ? 2 : 1);
    if (!p.air) this.groundFx(p.tx, p.ty, p.kind === 'shell' ? 1.2 : 1);
    this.stampDecal(this.fx.scorch, p.tx, p.ty, 0.5, 0.8);
    if (t?.cls === 'fort' && t.alive) this.damage(t, p.dmg, p.w, p.owner, p.fid);
    else this.splashAt(p.tx, p.ty, p.splash, p.dmg, p.fid, p.kind === 'rocket', p.w, p.owner);
    this.hooks.sound('boom', 0.3, p.tx, p.ty);
    this.hooks.shake(p.kind === 'shell' ? 3 : 2);
  }

  // ================================================================ render (every frame, interpolated)
  render(alpha: number, t: number) {
    // weather on the armour: frost in a blizzard, wet sheen in rain, dust in a sandstorm, heat glow
    const wt = ({ blizzard: 0xdfe9ff, rain: 0xd8e0ea, storm: 0xd0d8e6, sandstorm: 0xf0dcb8, heatwave: 0xfff0e0, fog: 0xe4e8ec } as Partial<Record<WeatherKey, number>>)[this.weather] ?? 0xffffff;
    for (const u of this.units) {
      u.vis.root.tint = u.flash > 0 ? 0xffffff : wt;
      const x = lerp(u.px, u.x, alpha), y = lerp(u.py, u.y, alpha);
      u.vis.root.position.set(x, y);
      u.vis.update({ angle: u.angle, aim: u.aim, moving: u.moving, dist: u.dist, t: t + u.born, flash: u.flash });
      if (u.shield > 0) u.vis.root.alpha = 0.75 + Math.sin(t * 12) * 0.2;
      else u.vis.root.alpha = 1;
      if (u.tag) {
        u.tag.visible = this.time < u.tagUntil;
        const off = u.def.radius * u.scale + 14;
        u.tag.position.set(x, y - off - (u.bar ? 12 : 0));
      }
      if (u.bar && u.barBg) {
        const off = u.def.radius + 14;
        const bw = Math.max(36, u.def.radius * 1.4);
        u.barBg.position.set(x - bw / 2 - 1, y - off - 1);
        u.barBg.width = bw + 2;
        u.barBg.height = 6;
        u.bar.position.set(x - bw / 2, y - off);
        u.bar.width = bw * Math.max(0, u.hp / u.maxHp);
        u.bar.height = 4;
      }
      if (u.badge && u.badgeBg) {
        // chip left of the HP bar (tier 2+), or alone above the unit (tier 1)
        const bw = Math.max(36, u.def.radius * 1.4);
        const bx = u.bar ? x - bw / 2 - 6 - u.badge.width / 2 : u.tag?.visible ? x - u.tag.width / 2 - 6 - u.badge.width / 2 : x;
        const by = y - (u.def.radius * u.scale + 14) + (u.bar ? 2 : 0);
        u.badge.position.set(bx, by);
        u.badgeBg.position.set(bx - u.badge.width / 2 - 3, by - u.badge.height / 2 + 1);
        u.badgeBg.width = u.badge.width + 6;
        u.badgeBg.height = u.badge.height - 2;
      }
    }
    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= 1 / 60;
      const k = Math.max(0, b.life / b.max);
      b.s.alpha = k;
      b.core.alpha = k;
      b.s.height = b.w * (0.6 + k * 0.4) * (0.9 + Math.random() * 0.2);
      if (b.life <= 0) b.s.visible = b.core.visible = false;
    }
    for (const f of this.slotted) {
      const fo = f.fort!;
      fo.view.body.tint = fo.hitFlash > 0.3 ? 0xffc0b0 : 0xffffff;
    }
  }

  stats() {
    return { units: this.units.length, projectiles: this.projs.filter((p) => p.alive).length, pooled: [...this.pool.values()].reduce((a, b) => a + b.length, 0) };
  }

  // ================================================================ save / restore
  snapshot() {
    return {
      time: this.time,
      factions: this.factions.slice(1).map((f) => ({ code: f.code, slot: f.slot, score: f.score, kills: f.kills, chest: f.chest, chestStage: f.chestStage, fortHp: f.fort?.hp ?? FORT_HP, lastActiveAgo: this.time - f.lastActive })),
      caps: this.caps.map((c) => ({ owner: c.owner >= 0 ? this.factions[c.owner].code : null })),
    };
  }

  restore(s: ReturnType<World['snapshot']>) {
    for (const fs of s.factions) {
      const def = COUNTRY_BY_CODE.get(fs.code);
      if (!def) continue;
      const f = this.addFaction(def);
      f.color = this.distinctColor(def.color, f);
      f.score = fs.score;
      f.kills = fs.kills;
      f.chest = fs.chest ?? 0;
      f.chestStage = fs.chestStage ?? 0;
      f.lastActive = this.time - Math.min(fs.lastActiveAgo, 300);
      if (fs.slot >= 0 && fs.slot < SLOTS.length && !this.factions.some((o) => o !== f && o.slot === fs.slot)) {
        f.slot = fs.slot;
        this.buildFort(f, false, fs.fortHp);
      }
    }
    this.rescaleForts();
    s.caps.forEach((c, i) => {
      const f = c.owner ? this.byCode.get(c.owner) : null;
      if (f && this.caps[i]) {
        this.caps[i].owner = f.id;
        this.caps[i].progress = 1;
      }
    });
  }
}
