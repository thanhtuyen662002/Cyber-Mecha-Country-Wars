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
