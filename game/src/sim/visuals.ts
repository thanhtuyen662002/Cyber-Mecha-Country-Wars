// Turns unit state into multi-part sprite rigs built from the procedural textures.
// Rigs are pooled per unit type (see World): `setColor` re-tints a recycled rig for a new country.
import { Container, Sprite, type Texture } from 'pixi.js';
import type { UnitKey } from '../core/units';
import type { FxTextures } from '../draw/fxTextures';
import type { PartTex, UnitArt } from '../draw/units';

export interface VisualState {
  angle: number; // body heading
  aim: number; // weapon heading (world)
  moving: number; // 0..1
  dist: number; // distance travelled (track/leg animation)
  t: number;
  flash: number; // >0 just got hit / fired
}

export interface UnitVisual {
  key: UnitKey;
  root: Container;
  shadow: Container;
  update(s: VisualState): void;
  setColor(c: number): void;
}

function shadowOf(tex: Texture, alpha = 0.38) {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.tint = 0x000000;
  s.alpha = alpha;
  return s;
}

export function buildVisual(key: UnitKey, color: number, art: UnitArt, fx: FxTextures): UnitVisual {
  const root = new Container();
  const shadow = new Container();
  const tinted: Sprite[] = [];
  const add = (pt: PartTex, parent: Container = root) => {
    const c = new Container();
    const base = new Sprite(pt.base);
    const paint = new Sprite(pt.paint);
    const glow = new Sprite(pt.glow);
    for (const s of [base, paint, glow]) s.anchor.set(0.5);
    glow.blendMode = 'add';
    c.addChild(base, paint, glow);
    tinted.push(paint, glow);
    parent.addChild(c);
    return { c, glow, base };
  };
  const aura = (size: number, alpha = 0.35) => {
    const a = new Sprite(fx.glow);
    a.anchor.set(0.5);
    a.width = a.height = size;
    a.alpha = alpha;
    a.blendMode = 'add';
    tinted.push(a);
    root.addChild(a);
    return a;
  };
  const setColor = (c: number) => {
    for (const s of tinted) s.tint = c;
  };
  const done = (update: (s: VisualState) => void): UnitVisual => {
    setColor(color);
    return { key, root, shadow, update, setColor };
  };

  switch (key) {
    case 'infantry':
    case 'sniper':
    case 'at':
    case 'flamer': {
      const pt = key === 'infantry' ? art.infantry : key === 'sniper' ? art.sniper : key === 'at' ? art.atSoldier : art.flamer;
      const body = add(pt);
      const sh = shadowOf(pt.base, 0.3);
      shadow.addChild(sh);
      const crawl = key === 'sniper';
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        const b = 1 + Math.sin(st.dist * (crawl ? 0.2 : 0.45)) * (crawl ? 0.03 : 0.06) * st.moving;
        body.c.scale.set(b, 1 / b);
        shadow.position.set(root.x + 3, root.y + 5);
      });
    }
    case 'drone': {
      const body = add(art.drone);
      const rotors: Sprite[] = [];
      for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
        const r = new Sprite(art.droneRotor.base);
        r.anchor.set(0.5);
        r.position.set(x, y);
        body.c.addChild(r);
        rotors.push(r);
      }
      const sh = shadowOf(art.drone.base, 0.3);
      sh.scale.set(0.7);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        rotors.forEach((r, i) => (r.rotation += i % 2 ? 0.9 : -0.9));
        body.glow.alpha = 0.7 + Math.sin(st.t * 18) * 0.3;
        shadow.position.set(root.x + 16, root.y + 24);
        root.y += Math.sin(st.t * 4) * 1.2;
      });
    }
    case 'tank': {
      const hullC = new Container();
      root.addChild(hullC);
      const tracks = art.tankTracks.map((pt) => {
        const s = new Sprite(pt.base);
        s.anchor.set(0.5);
        hullC.addChild(s);
        return s;
      });
      add(art.tankHull, hullC);
      const turret = add(art.tankTurret);
      const sh = shadowOf(art.tankHull.base, 0.4);
      shadow.addChild(sh);
      let recoil = 0;
      return done((st) => {
        hullC.rotation = st.angle;
        sh.rotation = st.angle;
        const ph = Math.floor(st.dist / 3) % 2;
        tracks[0].visible = ph === 0;
        tracks[1].visible = ph === 1;
        turret.c.rotation = st.aim;
        if (st.flash > 0.5) recoil = 5;
        recoil *= 0.8;
        turret.c.position.set(Math.cos(st.angle) * -2 - Math.cos(st.aim) * recoil, Math.sin(st.angle) * -2 - Math.sin(st.aim) * recoil);
        shadow.position.set(root.x + 5, root.y + 7);
      });
    }
    case 'aa': {
      const hull = add(art.aaHull);
      const turret = add(art.aaTurret);
      const rad = new Sprite(art.radar.base);
      rad.anchor.set(0.2, 0.5);
      rad.position.set(-14, 0);
      hull.c.addChild(rad);
      const sh = shadowOf(art.aaHull.base, 0.4);
      shadow.addChild(sh);
      return done((st) => {
        hull.c.rotation = st.angle;
        sh.rotation = st.angle;
        rad.rotation = st.t * 3;
        turret.c.rotation = st.aim;
        turret.c.position.set(Math.cos(st.angle) * 4, Math.sin(st.angle) * 4);
        shadow.position.set(root.x + 5, root.y + 7);
      });
    }
    case 'spider': {
      aura(120);
      const bodyC = new Container();
      root.addChild(bodyC);
      const legDefs: [number, number, number, number][] = [
        [13, -15, -0.95, 0], [13, 15, 0.95, Math.PI], [-13, -15, -2.2, Math.PI], [-13, 15, 2.2, 0],
      ];
      const legs = legDefs.map(([x, y, a, ph]) => {
        const l = add(art.spiderLeg, bodyC);
        l.c.position.set(x, y);
        l.c.rotation = a;
        l.c.scale.set(0.8);
        return { l, a, ph };
      });
      add(art.spiderBody, bodyC);
      const turret = add(art.spiderTurret);
      const sh = shadowOf(art.spiderBody.base, 0.35);
      sh.scale.set(1.9);
      shadow.addChild(sh);
      return done((st) => {
        bodyC.rotation = st.angle;
        sh.rotation = st.angle;
        const ph = st.dist * 0.1;
        legs.forEach((g) => {
          const w = Math.sin(ph + g.ph);
          g.l.c.rotation = g.a + w * 0.22 * st.moving * Math.sign(g.a);
          g.l.c.scale.x = 0.8 * (1 + Math.max(0, Math.cos(ph + g.ph)) * 0.08 * st.moving);
        });
        bodyC.y = Math.abs(Math.sin(ph)) * -1.2 * st.moving;
        turret.c.rotation = st.aim;
        turret.c.y = bodyC.y;
        shadow.position.set(root.x + 6, root.y + 8);
      });
    }
    case 'heli': {
      const body = add(art.heliBody);
      const rotor = new Sprite(art.heliRotor.base);
      rotor.anchor.set(0.5);
      const disc = new Sprite(art.rotorDisc.base);
      disc.anchor.set(0.5);
      disc.blendMode = 'add';
      const tail = new Sprite(art.droneRotor.base);
      tail.anchor.set(0.5);
      tail.scale.set(0.9);
      root.addChild(disc, rotor, tail);
      const sh = shadowOf(art.heliBody.base, 0.3);
      sh.scale.set(0.85);
      const shR = shadowOf(art.rotorDisc.base, 0.6);
      shR.scale.set(0.85);
      shadow.addChild(sh, shR);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        rotor.rotation += 0.55;
        tail.rotation -= 0.9;
        tail.position.set(Math.cos(st.angle) * -46 - Math.sin(st.angle) * 6, Math.sin(st.angle) * -46 + Math.cos(st.angle) * 6);
        const bank = Math.sin(st.aim - st.angle) * 0.08;
        body.c.scale.set(1, 1 - Math.abs(bank));
        shadow.position.set(root.x + 34, root.y + 52);
        root.y += Math.sin(st.t * 2.2) * 2;
      });
    }
    case 'robot': {
      aura(170, 0.3);
      const legsC = new Container();
      root.addChild(legsC);
      const legL = add(art.titanLeg, legsC);
      const legR = add(art.titanLeg, legsC);
      legL.c.scale.set(0.62);
      legR.c.scale.set(0.62);
      const torso = add(art.robotTorso);
      const sh = shadowOf(art.robotTorso.base, 0.4);
      shadow.addChild(sh);
      return done((st) => {
        legsC.rotation = st.angle;
        const ph = st.dist * 0.08;
        legL.c.position.set(Math.sin(ph) * 11 * st.moving, -17);
        legR.c.position.set(-Math.sin(ph) * 11 * st.moving, 17);
        torso.c.rotation = st.aim;
        torso.c.y = Math.abs(Math.cos(ph)) * -1.5 * st.moving;
        sh.rotation = st.aim;
        torso.glow.alpha = 0.8 + st.flash * 0.4;
        shadow.position.set(root.x + 9, root.y + 12);
      });
    }
    case 'bomber':
    case 'strike': {
      const body = add(art.bomber);
      const burn: Sprite[] = [];
      for (const s of [-1, 1]) {
        const b = new Sprite(fx.glow);
        b.anchor.set(0.5);
        b.blendMode = 'add';
        b.tint = 0xffa040;
        b.width = 34;
        b.height = 16;
        b.position.set(-24, s * 20);
        body.c.addChild(b);
        burn.push(b);
      }
      const sh = shadowOf(art.bomber.base, 0.28);
      sh.scale.set(0.9);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        for (const b of burn) b.alpha = 0.7 + Math.random() * 0.3;
        // banking when turning
        body.c.scale.y = 1 - Math.min(0.25, Math.abs(st.moving - 1) * 0.5);
        shadow.position.set(root.x + 60 * root.scale.x, root.y + 90 * root.scale.x);
      });
    }
    case 'titan': {
      aura(300);
      const legsC = new Container();
      root.addChild(legsC);
      const legL = add(art.titanLeg, legsC);
      const legR = add(art.titanLeg, legsC);
      const torso = add(art.titanTorso);
      const core = new Sprite(fx.glow);
      core.anchor.set(0.5);
      core.blendMode = 'add';
      core.width = core.height = 70;
      tinted.push(core);
      torso.c.addChild(core);
      core.position.set(-8, 0);
      const sh = shadowOf(art.titanTorso.base, 0.4);
      shadow.addChild(sh);
      return done((st) => {
        legsC.rotation = st.angle;
        const ph = st.dist * 0.05;
        legL.c.position.set(Math.sin(ph) * 16 * st.moving, -30);
        legR.c.position.set(-Math.sin(ph) * 16 * st.moving, 30);
        torso.c.rotation = st.aim;
        torso.c.y = Math.abs(Math.cos(ph)) * -2 * st.moving;
        sh.rotation = st.aim;
        core.alpha = 0.6 + Math.sin(st.t * 5) * 0.25 + st.flash;
        shadow.position.set(root.x + 12, root.y + 16);
      });
    }
    case 'jeep': {
      const body = add(art.jeepBody);
      const gun = add(art.jeepGun);
      const sh = shadowOf(art.jeepBody.base, 0.38);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        gun.c.rotation = st.aim;
        gun.c.position.set(Math.cos(st.angle) * -4, Math.sin(st.angle) * -4);
        body.c.y = Math.sin(st.dist * 0.5) * 0.7 * st.moving;
        shadow.position.set(root.x + 4, root.y + 6);
      });
    }
    case 'repair': {
      const body = add(art.repairDrone);
      const rotors = [-1, 1].map((s) => {
        const r = new Sprite(art.droneRotor.base);
        r.anchor.set(0.5);
        r.position.set(-4, s * 15);
        body.c.addChild(r);
        return r;
      });
      const sh = shadowOf(art.repairDrone.base, 0.28);
      sh.scale.set(0.7);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        rotors.forEach((r, i) => (r.rotation += i ? 0.8 : -0.8));
        body.glow.alpha = 0.75 + Math.sin(st.t * 6) * 0.25;
        shadow.position.set(root.x + 18, root.y + 26);
        root.y += Math.sin(st.t * 3) * 1.5;
      });
    }
    case 'mbt': {
      const hullC = new Container();
      root.addChild(hullC);
      const tr = new Sprite(art.mbtTracks.base);
      tr.anchor.set(0.5);
      hullC.addChild(tr);
      add(art.mbtHull, hullC);
      const turret = add(art.mbtTurret);
      const sh = shadowOf(art.mbtHull.base, 0.42);
      shadow.addChild(sh);
      let recoil = 0;
      return done((st) => {
        hullC.rotation = st.angle;
        sh.rotation = st.angle;
        tr.x = ((st.dist * 0.5) % 7) * 0.12 * st.moving;
        turret.c.rotation = st.aim;
        if (st.flash > 0.5) recoil = 7;
        recoil *= 0.82;
        turret.c.position.set(Math.cos(st.angle) * -3 - Math.cos(st.aim) * recoil, Math.sin(st.angle) * -3 - Math.sin(st.aim) * recoil);
        shadow.position.set(root.x + 6, root.y + 8);
      });
    }
    case 'mlrs': {
      const hull = add(art.mlrsHull);
      const pod = add(art.mlrsPod);
      const sh = shadowOf(art.mlrsHull.base, 0.4);
      shadow.addChild(sh);
      return done((st) => {
        hull.c.rotation = st.angle;
        sh.rotation = st.angle;
        pod.c.rotation = st.aim;
        pod.c.position.set(Math.cos(st.angle) * -10, Math.sin(st.angle) * -10);
        pod.glow.alpha = 0.5 + st.flash * 0.8;
        shadow.position.set(root.x + 5, root.y + 7);
      });
    }
    case 'emp': {
      const hull = add(art.empHull);
      const coil = add(art.empCoil);
      const sh = shadowOf(art.empHull.base, 0.4);
      shadow.addChild(sh);
      const halo = aura(90, 0.25);
      return done((st) => {
        hull.c.rotation = st.angle;
        sh.rotation = st.angle;
        coil.c.rotation = st.t * 2;
        coil.c.position.set(Math.cos(st.angle) * -6, Math.sin(st.angle) * -6);
        coil.glow.alpha = 0.6 + Math.sin(st.t * 9) * 0.25 + st.flash;
        halo.alpha = 0.15 + st.flash * 0.5;
        shadow.position.set(root.x + 5, root.y + 7);
      });
    }
    case 'hover': {
      const body = add(art.hoverBody);
      const fans = [-1, 1].map((s) => {
        const r = new Sprite(art.droneRotor.base);
        r.anchor.set(0.5);
        r.scale.set(1.25);
        r.position.set(-30, s * 13);
        body.c.addChild(r);
        return r;
      });
      const sh = shadowOf(art.hoverBody.base, 0.35);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        fans.forEach((f, i) => (f.rotation += i ? 0.7 : -0.7));
        const yaw = Math.sin(st.t * 1.7) * 0.03;
        body.c.rotation += yaw;
        shadow.position.set(root.x + 8, root.y + 12);
        root.y += Math.sin(st.t * 2.4) * 1.2;
      });
    }
    case 'mobile': {
      aura(220, 0.22);
      const hullC = new Container();
      root.addChild(hullC);
      const tr = new Sprite(art.mobileTracks.base);
      tr.anchor.set(0.5);
      hullC.addChild(tr);
      add(art.mobileHull, hullC);
      const mounts: [number, number, PartTex, number][] = [[38, 0, art.mbtTurret, 0.75], [-6, -16, art.tankTurret, 0.72], [-6, 16, art.tankTurret, 0.72]];
      const turrets = mounts.map(([x, y, pt, sc]) => {
        const t = add(pt);
        t.c.scale.set(sc);
        return { t, x, y };
      });
      const sh = shadowOf(art.mobileHull.base, 0.45);
      shadow.addChild(sh);
      return done((st) => {
        hullC.rotation = st.angle;
        sh.rotation = st.angle;
        const c = Math.cos(st.angle), s = Math.sin(st.angle);
        turrets.forEach(({ t, x, y }, i) => {
          t.c.position.set(c * x - s * y, s * x + c * y);
          t.c.rotation = st.aim + (i === 0 ? 0 : Math.sin(st.t * 0.9 + i) * 0.25);
        });
        tr.x = ((st.dist * 0.5) % 7) * 0.12 * st.moving;
        shadow.position.set(root.x + 9, root.y + 12);
      });
    }
    case 'carrier': {
      aura(320, 0.25);
      const body = add(art.carrier);
      const fans = [[-50, -46], [-50, 46], [40, -46], [40, 46]].map(([x, y]) => {
        const r = new Sprite(art.droneRotor.base);
        r.anchor.set(0.5);
        r.scale.set(2.3);
        r.position.set(x, y);
        body.c.addChild(r);
        return r;
      });
      const sh = shadowOf(art.carrier.base, 0.26);
      sh.scale.set(0.9);
      shadow.addChild(sh);
      return done((st) => {
        body.c.rotation = st.angle;
        sh.rotation = st.angle;
        fans.forEach((f, i) => (f.rotation += i % 2 ? 0.5 : -0.5));
        body.glow.alpha = 0.8 + Math.sin(st.t * 3) * 0.2;
        shadow.position.set(root.x + 60, root.y + 90);
        root.y += Math.sin(st.t * 1.2) * 2.5;
      });
    }
    case 'stormfort': {
      const cloud: Sprite[] = [];
      for (let i = 0; i < 5; i++) {
        const c = new Sprite(fx.fog);
        c.anchor.set(0.5);
        c.scale.set(0.9 + i * 0.12);
        c.tint = 0x3a4060;
        c.alpha = 0.32;
        cloud.push(c);
      }
      const halo = aura(260, 0.3);
      const base = add(art.stormBase);
      const spire = add(art.stormSpire);
      root.addChild(...cloud);
      const sh = shadowOf(art.stormBase.base, 0.42);
      shadow.addChild(sh);
      return done((st) => {
        base.c.rotation = st.angle;
        sh.rotation = st.angle;
        spire.c.rotation = -st.t * 1.5;
        spire.glow.alpha = 0.6 + Math.random() * 0.4 * (0.5 + st.flash);
        halo.alpha = 0.2 + Math.sin(st.t * 3) * 0.08 + st.flash * 0.4;
        cloud.forEach((c, i) => {
          const a = st.t * (0.25 + i * 0.05) + i * 1.3;
          c.position.set(Math.cos(a) * 46, Math.sin(a) * 46);
          c.rotation = a;
        });
        base.c.y = Math.abs(Math.sin(st.dist * 0.06)) * -1.5 * st.moving;
        shadow.position.set(root.x + 10, root.y + 14);
      });
    }
    case 'orbital': {
      // only used for portraits and cut-ins: the strike itself is drawn by the world
      aura(170, 0.35);
      const body = add(art.satellite);
      return done((st) => {
        body.c.rotation = st.angle * 0.3;
        body.glow.alpha = 0.7 + Math.sin(st.t * 4) * 0.3;
      });
    }
    case 'dragon': {
      aura(260, 0.25);
      const N = 9, GAP = 22;
      const segC = new Container();
      root.addChild(segC);
      const segs = Array.from({ length: N }, (_, i) => {
        const sg = add(art.dragonSeg, segC);
        sg.c.scale.set(1 - (i / N) * 0.55);
        return sg;
      });
      const wings = [1, -1].map((s) => {
        const w = add(art.dragonWing);
        w.c.scale.y = s;
        return w;
      });
      const head = add(art.dragonHead);
      const sh = shadowOf(art.dragonHead.base, 0.25);
      shadow.addChild(sh);
      // world-space trail of the head; segments follow it like a serpent
      const hist: { x: number; y: number }[] = [];
      let last = { x: NaN, y: NaN };
      return done((st) => {
        const hx = root.x, hy = root.y;
        if (!(Math.hypot(hx - last.x, hy - last.y) < 300)) {
          hist.length = 0;
          for (let i = 0; i < N * GAP; i++) hist.push({ x: hx - Math.cos(st.angle) * i, y: hy - Math.sin(st.angle) * i });
        }
        const step = Math.hypot(hx - last.x, hy - last.y) || 0;
        for (let k = 0; k < Math.min(30, Math.ceil(step)); k++) {
          const f = (k + 1) / Math.ceil(step);
          hist.unshift({ x: last.x + (hx - last.x) * f, y: last.y + (hy - last.y) * f });
        }
        if (hist.length > N * GAP + 2) hist.length = N * GAP + 2;
        last = { x: hx, y: hy };
        const wave = Math.sin(st.t * 3);
        for (let i = 0; i < N; i++) {
          const p0 = hist[Math.min(hist.length - 1, (i + 1) * GAP)], p1 = hist[Math.min(hist.length - 1, (i + 1) * GAP - 4)];
          const sg = segs[i].c;
          const a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const off = Math.sin(st.t * 4 - i * 0.7) * 4;
          sg.position.set(p0.x - hx - Math.sin(a) * off, p0.y - hy + Math.cos(a) * off);
          sg.rotation = a;
        }
        head.c.rotation = st.angle;
        const w1 = segs[0].c;
        wings.forEach((w, i) => {
          w.c.position.copyFrom(w1.position);
          w.c.rotation = w1.rotation;
          w.c.scale.x = 1;
          w.c.scale.y = (i ? -1 : 1) * (0.8 + wave * 0.25);
        });
        head.glow.alpha = 0.8 + st.flash;
        sh.rotation = st.angle;
        shadow.position.set(root.x + 50, root.y + 80);
      });
    }
  }
}

export interface FortressView {
  root: Container;
  body: Container;
  shield: Sprite;
  setColor(c: number): void;
}

export function buildFortress(color: number, art: UnitArt, fx: FxTextures): FortressView {
  const root = new Container();
  const body = new Container();
  const shield = new Sprite(fx.ring);
  shield.anchor.set(0.5);
  shield.width = shield.height = 360;
  shield.blendMode = 'add';
  shield.alpha = 0.25;
  const sh = shadowOf(art.fortress.base, 0.45);
  sh.position.set(10, 14);
  body.addChild(sh);
  const base = new Sprite(art.fortress.base);
  const paint = new Sprite(art.fortress.paint);
  const glow = new Sprite(art.fortress.glow);
  for (const s of [base, paint, glow]) s.anchor.set(0.5);
  glow.blendMode = 'add';
  body.addChild(base, paint, glow);
  root.addChild(body, shield);
  const setColor = (c: number) => {
    paint.tint = glow.tint = shield.tint = c;
  };
  setColor(color);
  return { root, body, shield, setColor };
}
