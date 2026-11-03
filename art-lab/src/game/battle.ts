// Minimal battle sandbox so the art can be judged in motion: units march, shoot, explode.
// Not the real game logic (that comes in M1-M2); just enough to drive every visual.
import { BitmapFont, BitmapText, Container, RenderTexture, type Renderer, Sprite } from 'pixi.js';
import { H, NAMES, TEAMS, type Team, type TeamId, type TerrainKey, UNITS, type UnitDef, type UnitKey, W, clamp, pick, rand } from '../config';
import type { FxTextures } from '../draw/fxTextures';
import type { ImageArt } from '../draw/imageArt';
import type { UnitArt } from '../draw/units';
import type { Particles } from '../fx/particles';
import type { Sfx } from '../fx/sfx';
import { type Skin, type UnitVisual, buildFortress, buildVisual } from './visuals';

interface Target {
  x: number; y: number; radius: number; hp: number; maxHp: number;
  team: TeamId; air: boolean; alive: boolean;
}

interface Unit extends Target {
  def: UnitDef;
  name: string;
  vx: number; vy: number;
  angle: number; aim: number; dist: number; moving: number;
  lane: number;
  cool: number; special: number; salvo: number;
  retarget: number;
  target: Target | null;
  flash: number;
  vis: UnitVisual;
  tag: BitmapText | null;
  bar: Sprite | null;
  barBg: Sprite | null;
  born: number;
}

interface Fortress extends Target {
  view: ReturnType<typeof buildFortress>;
  respawn: number;
  label: BitmapText;
}

type ProjKind = 'bullet' | 'shell' | 'rocket';
interface Proj {
  kind: ProjKind; s: Sprite; alive: boolean;
  x: number; y: number; tx: number; ty: number; speed: number;
  team: TeamId; dmg: number; splash: number; target: Target | null; tint: number; trail: number;
}

interface Beam { s: Sprite; core: Sprite; life: number; max: number; w: number }

interface Wreck { s: Sprite; life: number; smoke: number }

export class Battle {
  readonly decal: Sprite;
  readonly shadows = new Container();
  readonly ground = new Container();
  readonly proj = new Container();
  readonly air = new Container();
  readonly tags = new Container();
  private rt: RenderTexture;
  private stamp = new Container();
  private stampSprite: Sprite;
  units: Unit[] = [];
  forts: Fortress[] = [];
  private projs: Proj[] = [];
  private beams: Beam[] = [];
  private wrecks: Wreck[] = [];
  skin: Skin = 'code';
  terrain: TerrainKey = 'jungle';
  groundSpeed = 1;
  auto = true;
  private spawnTimer = [0, 0.5];
  private titanTimer = 12;
  time = 0;
  cap = 250;

  onFeed: (msg: string, team: TeamId) => void = () => {};
  onShake: (amount: number) => void = () => {};
  onTitan: (u: { x: number; y: number }, name: string, team: Team) => void = () => {};
  onBigBoom: (x: number, y: number, power: number) => void = () => {};
  onHitStop: (sec: number) => void = () => {};

  constructor(private renderer: Renderer, private art: UnitArt, private img: ImageArt, private fx: FxTextures, private particles: Particles, private sfx: Sfx) {
    this.rt = RenderTexture.create({ width: W, height: H });
    this.decal = new Sprite(this.rt);
    this.stampSprite = new Sprite(fx.scorch);
    this.stampSprite.anchor.set(0.5);
    this.stamp.addChild(this.stampSprite);
    BitmapFont.install({ name: 'Tag', style: { fontFamily: 'Arial', fontSize: 30, fontWeight: 'bold', fill: '#ffffff', stroke: { color: '#000000', width: 5 } }, chars: [['a', 'z'], ['A', 'Z'], ['0', '9'], ' @._-:!→+%'] });
    for (let i = 0; i < 400; i++) {
      const s = new Sprite(fx.tracer);
      s.anchor.set(1, 0.5);
      s.visible = false;
      this.proj.addChild(s);
      this.projs.push({ kind: 'bullet', s, alive: false, x: 0, y: 0, tx: 0, ty: 0, speed: 0, team: 0, dmg: 0, splash: 0, target: null, tint: 0, trail: 0 });
    }
    for (let i = 0; i < 40; i++) {
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
    this.buildForts();
  }

  // ------------------------------------------------------------ setup
  private buildForts() {
    for (const f of this.forts) {
      f.view.root.destroy({ children: true });
      f.label.destroy();
    }
    this.forts = TEAMS.map((t) => {
      const view = buildFortress(this.skin, t, this.art, this.img, this.fx);
      view.root.position.set(t.base.x, t.base.y);
      this.ground.addChildAt(view.root, 0);
      const label = new BitmapText({ text: `${t.name}`, style: { fontFamily: 'Tag', fontSize: 34 } });
      label.anchor.set(0.5);
      label.position.set(t.base.x, t.base.y + (t.id === 0 ? 175 : -175));
      label.tint = t.color;
      this.tags.addChild(label);
      return { x: t.base.x, y: t.base.y, radius: 120, hp: 8000, maxHp: 8000, team: t.id, air: false, alive: true, view, respawn: 0, label };
    });
  }

  setSkin(skin: Skin) {
    this.skin = skin;
    this.buildForts();
    for (const u of this.units) {
      const old = u.vis;
      u.vis = buildVisual(u.def.key, skin, TEAMS[u.team], this.art, this.img, this.fx);
      (u.def.air ? this.air : this.ground).addChild(u.vis.root);
      this.shadows.addChild(u.vis.shadow);
      old.root.destroy({ children: true });
      old.shadow.destroy({ children: true });
    }
  }

  clearDecals() {
    this.renderer.render({ container: new Container(), target: this.rt, clear: true });
  }

  reset() {
    for (const u of [...this.units]) this.removeUnit(u);
    for (const w of this.wrecks) w.s.destroy();
    this.wrecks = [];
    for (const p of this.projs) (p.alive = false), (p.s.visible = false);
    this.clearDecals();
    for (const f of this.forts) (f.hp = f.maxHp), (f.alive = true), (f.view.root.visible = true);
  }

  // ------------------------------------------------------------ spawning
  spawn(key: UnitKey, team: TeamId, name = pick(NAMES), announce = true) {
    if (this.units.length >= this.cap) return null;
    const def = UNITS[key];
    const t = TEAMS[team];
    const dir = team === 0 ? -1 : 1;
    const x = t.base.x + rand(-200, 200);
    const y = t.base.y + dir * rand(140, 200);
    const vis = buildVisual(key, this.skin, t, this.art, this.img, this.fx);
    const u: Unit = {
      def, name, team, x, y, vx: 0, vy: 0, radius: def.radius, hp: def.hp, maxHp: def.hp, air: def.air, alive: true,
      angle: dir * Math.PI / 2, aim: dir * Math.PI / 2, dist: 0, moving: 0, lane: rand(120, W - 120), cool: rand(0, 1), special: rand(2, 4), salvo: 0,
      retarget: 0, target: null, flash: 0, vis, tag: null, bar: null, barBg: null, born: this.time,
    };
    (def.air ? this.air : this.ground).addChild(vis.root);
    this.shadows.addChild(vis.shadow);
    if (def.tier >= 2) {
      u.tag = new BitmapText({ text: `@${name}`, style: { fontFamily: 'Tag', fontSize: def.tier >= 5 ? 26 : 16 } });
      u.tag.anchor.set(0.5);
      u.tag.tint = def.tier >= 5 ? 0xffe27a : 0xffffff;
      this.tags.addChild(u.tag);
      u.barBg = new Sprite(this.fx.white);
      u.barBg.tint = 0x000000;
      u.barBg.alpha = 0.6;
      u.bar = new Sprite(this.fx.white);
      u.bar.tint = t.color;
      this.tags.addChild(u.barBg, u.bar);
    }
    // arrival effect scales with tier ("pay-to-flex")
    this.particles.ring(x, y, 0.6 + def.tier * 0.5, t.color, 0.5);
    this.particles.flash(x, y, 0.5 + def.tier * 0.4, t.color, 0.3);
    if (def.tier >= 3) this.particles.sparks(x, y, 20, t.color, 300);
    this.units.push(u);
    if (announce && def.tier >= 1) this.onFeed(`@${name} → ${def.name.toUpperCase()}`, team);
    if (key === 'titan') {
      this.onTitan(u, name, t);
      this.sfx.play('alarm');
    }
    return u;
  }

  private removeUnit(u: Unit) {
    u.alive = false;
    u.vis.root.destroy({ children: true });
    u.vis.shadow.destroy({ children: true });
    u.tag?.destroy();
    u.bar?.destroy();
    u.barBg?.destroy();
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
  }

  // ------------------------------------------------------------ weapons
  private fire(kind: ProjKind, x: number, y: number, target: Target, team: TeamId, dmg: number, splash: number, tint: number, spread = 0) {
    const p = this.projs.find((q) => !q.alive);
    if (!p) return;
    p.kind = kind;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.tx = target.x + rand(-spread, spread);
    p.ty = target.y + rand(-spread, spread);
    p.target = target;
    p.team = team;
    p.dmg = dmg;
    p.splash = splash;
    p.tint = tint;
    p.trail = 0;
    p.speed = kind === 'bullet' ? 1400 : kind === 'shell' ? 900 : 520;
    const s = p.s;
    s.visible = true;
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

  private damage(t: Target, dmg: number) {
    if (!t.alive) return;
    t.hp -= dmg;
    if ('def' in t) (t as Unit).flash = 1;
    if (t.hp <= 0) this.kill(t);
  }

  private splashAt(x: number, y: number, r: number, dmg: number, team: TeamId, hitAir: boolean) {
    for (const u of this.units) {
      if (u.team === team || !u.alive || (u.air && !hitAir)) continue;
      const d = Math.hypot(u.x - x, u.y - y);
      if (d < r + u.radius) this.damage(u, dmg * (1 - (d / (r + u.radius)) * 0.6));
    }
    for (const f of this.forts) if (f.team !== team && f.alive && Math.hypot(f.x - x, f.y - y) < r + f.radius) this.damage(f, dmg * 0.5);
  }

  private stampDecal(tex: typeof this.fx.scorch, x: number, y: number, scale: number, alpha: number, rot = rand(0, 6.28), tint = 0xffffff) {
    const s = this.stampSprite;
    s.texture = tex;
    s.position.set(x, y);
    s.scale.set(scale);
    s.rotation = rot;
    s.alpha = alpha;
    s.tint = tint;
    this.renderer.render({ container: this.stamp, target: this.rt, clear: false });
  }

  private kill(t: Target) {
    t.alive = false;
    if (!('def' in t)) {
      const f = t as Fortress;
      this.megaBoom(f.x, f.y);
      f.view.root.visible = false;
      f.respawn = 5;
      this.onFeed(`${TEAMS[f.team].name} FORTRESS DESTROYED!`, f.team === 0 ? 1 : 0);
      return;
    }
    const u = t as Unit;
    const tier = u.def.tier;
    this.particles.explode(u.x, u.y, tier + (u.def.key === 'drone' ? 1 : 0));
    this.sfx.play(tier >= 2 ? 'boom' : 'gun', tier >= 2 ? 1 : 0.4);
    if (!u.air || u.def.key === 'heli') {
      if (tier >= 2) this.stampDecal(this.fx.crater, u.x, u.y, 0.4 + tier * 0.15, 0.8);
      this.stampDecal(this.fx.scorch, u.x, u.y, 0.5 + tier * 0.25, 0.9);
    }
    if (tier >= 2) {
      this.onShake(6 + tier * 4);
      if (tier >= 3) this.onHitStop(0.05);
      // burning wreck
      const tex = this.skin === 'image' ? this.img.tex[`unit_${u.def.key}`] : { tank: this.art.tankHull, spider: this.art.spiderBody, heli: this.art.heliBody, titan: this.art.titanTorso }[u.def.key as 'tank']?.base;
      if (tex) {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.position.set(u.x, u.y);
        s.rotation = u.angle + (this.skin === 'image' ? Math.PI / 2 : 0);
        if (this.skin === 'image') s.scale.set(u.vis.root.children[1]?.scale.x ?? 1);
        s.tint = 0x2b2622;
        this.ground.addChildAt(s, 2);
        this.wrecks.push({ s, life: 7, smoke: 0 });
      }
    }
    if (tier >= 3 && tier < 5) this.onBigBoom(u.x, u.y, 0.45);
    if (tier >= 5) this.megaBoom(u.x, u.y);
    if (tier >= 1) this.onFeed(`@${u.name}'s ${u.def.name} destroyed`, u.team === 0 ? 1 : 0);
    this.removeUnit(u);
  }

  megaBoom(x: number, y: number) {
    this.particles.explode(x, y, 6);
    for (let i = 0; i < 6; i++) this.particles.explode(x + rand(-90, 90), y + rand(-90, 90), 3);
    this.stampDecal(this.fx.crater, x, y, 2.8, 0.9);
    this.stampDecal(this.fx.scorch, x, y, 3.5, 1);
    this.onShake(32);
    this.onBigBoom(x, y, 1);
    this.onHitStop(0.09);
    this.sfx.play('bigboom');
  }

  nuke() {
    const t = Math.random() < 0.5 ? 0 : 1;
    const f = this.forts[t];
    const x = f.x + rand(-120, 120), y = H / 2 + (f.y - H / 2) * 0.45;
    this.onFeed('☢ STRATEGIC STRIKE incoming', t === 0 ? 1 : 0);
    this.splashAt(x, y, 300, 900, t === 0 ? 1 : 0, true);
    this.megaBoom(x, y);
  }

  lightningAt(x: number, y: number) {
    // hits the tallest metal unit near the strike
    let best: Unit | null = null, bd = 200;
    for (const u of this.units) {
      const d = Math.hypot(u.x - x, u.y - y) - u.def.tier * 25;
      if (d < bd) (bd = d), (best = u);
    }
    const tx = best?.x ?? x, ty = best?.y ?? y;
    this.particles.flash(tx, ty, 2.5, 0xb8d0ff, 0.35);
    this.particles.sparks(tx, ty, 30, 0xcfe0ff, 420);
    this.stampDecal(this.fx.scorch, tx, ty, 0.9, 0.9);
    if (best) this.damage(best, 220);
    this.onShake(10);
    return { x: tx, y: ty };
  }

  splash(x: number, y: number) {
    this.particles.spawn(this.fx.ring, true, x, y, 0, 0, 0.25, 0.04, 0.14, 0.5, 0, 0xc8dcff);
  }

  // ------------------------------------------------------------ main update
  update(dt: number, wind: number) {
    this.time += dt;
    if (this.auto) this.autoSpawn(dt);

    for (const f of this.forts) {
      f.view.shield.alpha = 0.2 + Math.sin(this.time * 2 + f.team) * 0.06;
      f.view.shield.rotation += dt * 0.2;
      if (!f.alive) {
        f.respawn -= dt;
        if (f.respawn <= 0) {
          f.alive = true;
          f.hp = f.maxHp;
          f.view.root.visible = true;
          this.particles.ring(f.x, f.y, 5, TEAMS[f.team].color, 0.8);
        }
      }
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.alive) this.updateUnit(u, dt, wind);
    }

    for (const p of this.projs) if (p.alive) this.updateProj(p, dt);

    for (const b of this.beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = Math.max(0, b.life / b.max);
      b.s.alpha = k;
      b.core.alpha = k;
      b.s.height = b.w * (0.6 + k * 0.4) * (0.9 + Math.random() * 0.2);
      if (b.life <= 0) b.s.visible = b.core.visible = false;
    }

    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const w = this.wrecks[i];
      w.life -= dt;
      w.smoke -= dt;
      if (w.smoke <= 0) {
        w.smoke = 0.18;
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
  }

  private autoSpawn(dt: number) {
    for (const team of [0, 1] as TeamId[]) {
      this.spawnTimer[team] -= dt;
      if (this.spawnTimer[team] > 0) continue;
      const mine = this.units.filter((u) => u.team === team).length;
      this.spawnTimer[team] = rand(0.25, 0.7) * (mine > 60 ? 3 : 1);
      const r = Math.random();
      const key: UnitKey = r < 0.55 ? 'infantry' : r < 0.75 ? 'drone' : r < 0.88 ? 'tank' : r < 0.94 ? 'spider' : 'heli';
      this.spawn(key, team);
    }
    this.titanTimer -= dt;
    if (this.titanTimer <= 0) {
      this.titanTimer = rand(35, 50);
      if (!this.units.some((u) => u.def.key === 'titan')) this.spawn('titan', Math.random() < 0.5 ? 0 : 1);
    }
  }

  private findTarget(u: Unit): Target | null {
    let best: Target | null = null;
    let bd = u.def.range * 2.2 + 200;
    const canAir = u.def.weapon !== 'shell';
    for (const o of this.units) {
      if (o.team === u.team || !o.alive || (o.air && !canAir)) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d < bd) (bd = d), (best = o);
    }
    const ef = this.forts[u.team === 0 ? 1 : 0];
    if (ef.alive && Math.hypot(ef.x - u.x, ef.y - u.y) - ef.radius < bd) best = ef;
    return best;
  }

  private updateUnit(u: Unit, dt: number, wind: number) {
    const def = u.def;
    u.flash = Math.max(0, u.flash - dt * 5);
    u.retarget -= dt;
    if (u.retarget <= 0 || (u.target && !u.target.alive)) {
      u.retarget = 0.4 + Math.random() * 0.2;
      u.target = this.findTarget(u);
    }
    const ef = this.forts[u.team === 0 ? 1 : 0];
    const tgt = u.target;
    let gx = u.lane, gy = ef.y;
    let dToT = Infinity;
    if (tgt) {
      dToT = Math.hypot(tgt.x - u.x, tgt.y - u.y) - tgt.radius;
      gx = tgt.x;
      gy = tgt.y;
    }
    const engage = tgt && dToT < def.range;
    let speed = def.speed * (def.air ? 1 : this.groundSpeed);
    let dx = gx - u.x, dy = gy - u.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    if (engage && def.weapon !== 'kamikaze') {
      if (def.key === 'heli') {
        // strafe around the target
        const tx = -dy, ty = dx;
        dx = tx;
        dy = ty;
        speed *= 0.6;
      } else speed = 0;
    }
    // ice = slippery (low acceleration), else snappy
    const accel = def.air ? 3 : this.terrain === 'ice' ? 1.2 : 6;
    const k = Math.min(1, accel * dt);
    u.vx += (dx * speed - u.vx) * k;
    u.vy += (dy * speed - u.vy) * k;
    if (def.air) u.vx += wind * 0.08 * dt;
    u.x = clamp(u.x + u.vx * dt, 20, W - 20);
    u.y = clamp(u.y + u.vy * dt, 20, H - 20);
    const v = Math.hypot(u.vx, u.vy);
    u.dist += v * dt;
    u.moving = clamp(v / (def.speed * 0.5), 0, 1);
    if (v > 4) {
      const want = Math.atan2(u.vy, u.vx);
      u.angle += angDiff(u.angle, want) * Math.min(1, dt * (def.key === 'titan' ? 1.5 : 6));
    }
    const aimWant = tgt ? Math.atan2(tgt.y - u.y, tgt.x - u.x) : u.angle;
    u.aim += angDiff(u.aim, aimWant) * Math.min(1, dt * 5);

    // tank tread marks on soft ground
    if (def.key === 'tank' && v > 8 && Math.random() < dt * 8 && this.terrain !== 'city') {
      for (const s of [-1, 1]) this.stampDecal(this.fx.track, u.x - Math.sin(u.angle) * 17 * s, u.y + Math.cos(u.angle) * 17 * s, 1, 0.5, u.angle + Math.PI / 2);
    }
    if (def.key === 'heli' && Math.random() < dt * 4) this.particles.trail(u.x - Math.cos(u.angle) * 40, u.y - Math.sin(u.angle) * 40, 0.6, 0x666666);

    // weapons
    u.cool -= dt;
    u.special -= dt;
    if (tgt && engage && u.cool <= 0 && Math.abs(angDiff(u.aim, aimWant)) < 0.35) {
      u.cool = def.fireInterval * rand(0.85, 1.15);
      this.shoot(u, tgt);
    }
    if (def.key === 'titan' && tgt && dToT < def.range * 1.2) this.titanSpecials(u, tgt);
    if (def.weapon === 'kamikaze' && tgt && dToT < 20) {
      this.particles.explode(u.x, u.y, 3);
      this.splashAt(u.x, u.y, 60, def.dmg, u.team, true);
      this.sfx.play('boom', 0.7);
      this.stampDecal(this.fx.scorch, u.x, u.y, 0.8, 0.9);
      this.onShake(5);
      this.removeUnit(u);
      return;
    }

    // visuals
    u.vis.root.position.set(u.x, u.y);
    u.vis.update({ angle: u.angle, aim: u.aim, moving: u.moving, dist: u.dist, t: this.time + u.born, flash: u.flash });
    u.vis.root.tint = u.flash > 0.3 ? 0xffb0a0 : 0xffffff;
    if (u.tag && u.bar && u.barBg) {
      const off = def.radius + 14;
      u.tag.position.set(u.x, u.y - off - 12);
      const bw = Math.max(36, def.radius * 1.4);
      u.barBg.position.set(u.x - bw / 2 - 1, u.y - off - 1);
      u.barBg.width = bw + 2;
      u.barBg.height = 6;
      u.bar.position.set(u.x - bw / 2, u.y - off);
      u.bar.width = bw * Math.max(0, u.hp / u.maxHp);
      u.bar.height = 4;
    }
  }

  private muzzle(u: Unit, fx: number, fy: number) {
    const c = Math.cos(u.aim), s = Math.sin(u.aim);
    return { x: u.x + c * fx - s * fy, y: u.y + s * fx + c * fy };
  }

  private shoot(u: Unit, t: Target) {
    const team = TEAMS[u.team];
    switch (u.def.weapon) {
      case 'bullet': {
        const m = this.muzzle(u, 21, 4);
        this.particles.muzzle(m.x, m.y, u.aim, 0.25, 0xffd27a);
        this.fire('bullet', m.x, m.y, t, u.team, u.def.dmg, 0, 0xffe2a0, 10);
        this.sfx.play('gun', 0.35);
        break;
      }
      case 'shell': {
        const m = this.muzzle(u, 39, 0);
        this.particles.muzzle(m.x, m.y, u.aim, 0.7, 0xffc070);
        this.particles.smokePuff(m.x, m.y, 0.5, 0x777777, 1.2);
        u.flash = 0.6;
        this.fire('shell', m.x, m.y, t, u.team, u.def.dmg, 40, 0xffd28a, 12);
        this.sfx.play('cannon', 0.6);
        break;
      }
      case 'laser': {
        const side = (u.salvo++ % 2) * 2 - 1;
        const m = this.muzzle(u, 33, 5 * side);
        const hx = t.x + rand(-6, 6), hy = t.y + rand(-6, 6);
        this.beam(m.x, m.y, hx, hy, 9, team.color, 0.09);
        this.particles.sparks(hx, hy, 3, team.color, 200);
        this.particles.flash(hx, hy, 0.3, team.color, 0.1);
        this.damage(t, u.def.dmg);
        this.sfx.play('laser', 0.3);
        break;
      }
      case 'rocket': {
        for (const side of [-1, 1]) {
          const m = this.muzzle(u, 10, 22 * side);
          this.particles.muzzle(m.x, m.y, u.aim, 0.4, 0xffb060);
          this.fire('rocket', m.x, m.y, t, u.team, u.def.dmg, 45, 0xffffff, 20);
        }
        this.sfx.play('rocket', 0.5);
        break;
      }
      case 'titan': {
        const side = (u.salvo++ % 2) * 2 - 1;
        const m = this.muzzle(u, 68, 36 * side);
        this.particles.muzzle(m.x, m.y, u.aim, 0.45, team.color);
        this.fire('bullet', m.x, m.y, t, u.team, u.def.dmg, 0, team.color, 22);
        this.sfx.play('gun', 0.5);
        break;
      }
      case 'kamikaze':
        break;
    }
  }

  private titanSpecials(u: Unit, t: Target) {
    if (u.special > 0) return;
    u.special = rand(3.5, 5);
    const team = TEAMS[u.team];
    if (Math.random() < 0.55) {
      // twin shoulder rail-beams
      for (const side of [-1, 1]) {
        const m = this.muzzle(u, 82, 58 * side);
        const ex = t.x + rand(-20, 20), ey = t.y + rand(-20, 20);
        this.beam(m.x, m.y, ex, ey, 44, team.color, 0.55);
        this.particles.flash(m.x, m.y, 1.6, team.color, 0.3);
        this.particles.explode(ex, ey, 3);
        this.splashAt(ex, ey, 70, 260, u.team, true);
        this.stampDecal(this.fx.scorch, ex, ey, 1.2, 1);
      }
      this.onShake(14);
      this.sfx.play('laser', 1);
      this.sfx.play('boom', 1);
    } else {
      // missile salvo
      for (let i = 0; i < 8; i++) {
        const m = this.muzzle(u, -40, rand(-30, 30));
        this.fire('rocket', m.x, m.y, t, u.team, 60, 55, 0xffffff, 70);
      }
      this.sfx.play('rocket', 1);
    }
  }

  private updateProj(p: Proj, dt: number) {
    if (p.kind === 'rocket' && p.target?.alive) {
      // light homing
      p.tx += (p.target.x - p.tx) * Math.min(1, dt * 3);
      p.ty += (p.target.y - p.ty) * Math.min(1, dt * 3);
    }
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
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.s.position.set(p.x, p.y);
    if (p.kind === 'rocket') {
      p.trail -= dt;
      if (p.trail <= 0) {
        p.trail = 0.02;
        this.particles.trail(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, 0.5);
        this.particles.spawn(this.fx.glow, true, p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, 0, 0, 0.08, 0.18, 0.05, 1, 0, 0xffa040);
      }
    }
  }

  private impact(p: Proj) {
    const t = p.target;
    if (p.kind === 'bullet') {
      this.particles.sparks(p.tx, p.ty, 2, p.tint, 160);
      if (t?.alive && Math.hypot(t.x - p.tx, t.y - p.ty) < t.radius + 16) this.damage(t, p.dmg);
      return;
    }
    this.particles.explode(p.tx, p.ty, p.kind === 'shell' ? 2 : 1);
    this.stampDecal(this.fx.scorch, p.tx, p.ty, 0.5, 0.8);
    this.splashAt(p.tx, p.ty, p.splash, p.dmg, p.team, p.kind === 'rocket');
    this.sfx.play('boom', 0.35);
    this.onShake(p.kind === 'shell' ? 3 : 2);
  }

  stats() {
    return { units: this.units.length, projectiles: this.projs.filter((p) => p.alive).length };
  }
}

function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
