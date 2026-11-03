// Turns unit state into sprites, in two skins:
//  - 'code'  : multi-part rig from procedural textures (animated legs, rotors, turrets)
//  - 'image' : one AI/CC0 image per unit (prettier detail, but a single rigid sprite)
import { Container, Sprite, type Texture } from 'pixi.js';
import { type Team, type UnitKey } from '../config';
import type { FxTextures } from '../draw/fxTextures';
import type { ImageArt } from '../draw/imageArt';
import type { PartTex, UnitArt } from '../draw/units';

export type Skin = 'code' | 'image';

export interface VisualState {
  angle: number; // body heading
  aim: number; // weapon heading (world)
  moving: number; // 0..1
  dist: number; // distance travelled (for track/leg animation)
  t: number;
  flash: number; // >0 just got hit
}

export interface UnitVisual {
  root: Container;
  shadow: Container;
  glows: Sprite[]; // neon layers, pulsed on hit
  update(s: VisualState): void;
}

// display size (px) for image skin, roughly matching the code rig footprint
export const IMAGE_SIZE: Record<UnitKey, number> = { infantry: 30, drone: 32, tank: 60, spider: 96, heli: 118, titan: 200 };
const AIR_SHADOW: Partial<Record<UnitKey, [number, number, number]>> = { drone: [16, 24, 0.7], heli: [34, 52, 0.85] };

function layered(pt: PartTex, team: Team) {
  const c = new Container();
  const base = new Sprite(pt.base);
  const paint = new Sprite(pt.paint);
  const glow = new Sprite(pt.glow);
  for (const s of [base, paint, glow]) s.anchor.set(0.5);
  paint.tint = team.color;
  glow.tint = team.color;
  glow.blendMode = 'add';
  c.addChild(base, paint, glow);
  return { c, glow, base };
}

function shadowOf(tex: Texture, alpha = 0.38) {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.tint = 0x000000;
  s.alpha = alpha;
  return s;
}

function aura(fx: FxTextures, team: Team, size: number) {
  const a = new Sprite(fx.glow);
  a.anchor.set(0.5);
  a.width = a.height = size;
  a.tint = team.color;
  a.alpha = 0.35;
  a.blendMode = 'add';
  return a;
}

export function buildVisual(key: UnitKey, skin: Skin, team: Team, art: UnitArt, img: ImageArt, fx: FxTextures): UnitVisual {
  const root = new Container();
  const shadow = new Container();
  const air = AIR_SHADOW[key];

  if (skin === 'image') {
    const tex = img.tex[`unit_${key}`];
    const size = IMAGE_SIZE[key];
    const k = size / Math.max(tex.width, tex.height);
    const ring = aura(fx, team, size * 1.5);
    root.addChild(ring);
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(k);
    root.addChild(s);
    let disc: Sprite | null = null;
    if (key === 'heli' || key === 'drone') {
      disc = new Sprite(art.rotorDisc.base);
      disc.anchor.set(0.5);
      disc.blendMode = 'add';
      disc.scale.set(key === 'heli' ? 1 : 0.3);
      root.addChild(disc);
    }
    const sh = shadowOf(tex);
    sh.scale.set(k * (air ? air[2] : 1));
    shadow.addChild(sh);
    return {
      root,
      shadow,
      glows: [ring],
      update(st) {
        // Images are drawn facing UP, so rotate by +90deg relative to the +X heading.
        s.rotation = (key === 'titan' || key === 'tank' ? st.aim : st.angle) + Math.PI / 2;
        sh.rotation = s.rotation;
        const bob = key === 'infantry' ? 1 + Math.sin(st.dist * 0.4) * 0.05 * st.moving : 1;
        s.scale.set(k * bob);
        ring.alpha = 0.3 + Math.sin(st.t * 3) * 0.08 + st.flash;
        if (disc) disc.rotation += 0.6;
        shadow.position.set(root.x + (air ? air[0] : 4), root.y + (air ? air[1] : 6));
        if (air) root.y += Math.sin(st.t * 2.5) * 1.5;
      },
    };
  }

  // ------------------------------------------------ code rigs
  const glows: Sprite[] = [];
  const add = (pt: PartTex, parent: Container = root) => {
    const l = layered(pt, team);
    parent.addChild(l.c);
    glows.push(l.glow);
    return l;
  };

  switch (key) {
    case 'infantry': {
      const body = add(art.infantry);
      const sh = shadowOf(art.infantry.base, 0.3);
      shadow.addChild(sh);
      return {
        root, shadow, glows,
        update(st) {
          body.c.rotation = st.angle;
          sh.rotation = st.angle;
          const b = 1 + Math.sin(st.dist * 0.45) * 0.06 * st.moving;
          body.c.scale.set(b, 1 / b);
          shadow.position.set(root.x + 3, root.y + 5);
        },
      };
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
      return {
        root, shadow, glows,
        update(st) {
          body.c.rotation = st.angle;
          sh.rotation = st.angle;
          rotors.forEach((r, i) => (r.rotation += i % 2 ? 0.9 : -0.9));
          body.glow.alpha = 0.7 + Math.sin(st.t * 18) * 0.3;
          shadow.position.set(root.x + 16, root.y + 24);
          root.y += Math.sin(st.t * 4) * 1.2;
        },
      };
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
      return {
        root, shadow, glows,
        update(st) {
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
        },
      };
    }
    case 'spider': {
      root.addChild(aura(fx, team, 120));
      const bodyC = new Container();
      root.addChild(bodyC);
      // 4 legs on the corner actuators; diagonal pairs step together (FL+RR, FR+RL)
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
      return {
        root, shadow, glows,
        update(st) {
          bodyC.rotation = st.angle;
          sh.rotation = st.angle;
          const ph = st.dist * 0.1;
          legs.forEach((g) => {
            const w = Math.sin(ph + g.ph);
            g.l.c.rotation = g.a + w * 0.22 * st.moving * Math.sign(g.a);
            g.l.c.scale.x = 0.8 * (1 + Math.max(0, Math.cos(ph + g.ph)) * 0.08 * st.moving); // foot lift/extend
          });
          bodyC.y = Math.abs(Math.sin(ph)) * -1.2 * st.moving;
          turret.c.rotation = st.aim;
          turret.c.y = bodyC.y;
          shadow.position.set(root.x + 6, root.y + 8);
        },
      };
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
      return {
        root, shadow, glows,
        update(st) {
          body.c.rotation = st.angle;
          sh.rotation = st.angle;
          rotor.rotation += 0.55;
          tail.rotation -= 0.9;
          tail.position.set(Math.cos(st.angle) * -46 - Math.sin(st.angle) * 6, Math.sin(st.angle) * -46 + Math.cos(st.angle) * 6);
          // bank: squash slightly when turning toward aim
          const bank = Math.sin(st.aim - st.angle) * 0.08;
          body.c.scale.set(1, 1 - Math.abs(bank));
          shadow.position.set(root.x + 34, root.y + 52);
          root.y += Math.sin(st.t * 2.2) * 2;
        },
      };
    }
    case 'titan': {
      root.addChild(aura(fx, team, 300));
      const legsC = new Container();
      root.addChild(legsC);
      const legL = add(art.titanLeg, legsC);
      const legR = add(art.titanLeg, legsC);
      const torso = add(art.titanTorso);
      const core = new Sprite(fx.glow);
      core.anchor.set(0.5);
      core.tint = team.color;
      core.blendMode = 'add';
      core.width = core.height = 70;
      torso.c.addChild(core);
      core.position.set(-8, 0);
      const sh = shadowOf(art.titanTorso.base, 0.4);
      shadow.addChild(sh);
      return {
        root, shadow, glows,
        update(st) {
          legsC.rotation = st.angle;
          const ph = st.dist * 0.05;
          legL.c.position.set(Math.sin(ph) * 16 * st.moving, -30);
          legR.c.position.set(-Math.sin(ph) * 16 * st.moving, 30);
          torso.c.rotation = st.aim;
          torso.c.y = Math.abs(Math.cos(ph)) * -2 * st.moving;
          sh.rotation = st.aim;
          core.alpha = 0.6 + Math.sin(st.t * 5) * 0.25 + st.flash;
          shadow.position.set(root.x + 12, root.y + 16);
        },
      };
    }
  }
}

export function buildFortress(skin: Skin, team: Team, art: UnitArt, img: ImageArt, fx: FxTextures) {
  const root = new Container();
  const glows: Sprite[] = [];
  const shield = new Sprite(fx.ring);
  shield.anchor.set(0.5);
  shield.width = shield.height = 360;
  shield.tint = team.color;
  shield.blendMode = 'add';
  shield.alpha = 0.25;
  if (skin === 'image') {
    const s = new Sprite(img.tex.fortress);
    s.anchor.set(0.5);
    s.scale.set(290 / Math.max(s.texture.width, s.texture.height));
    root.addChild(aura(fx, team, 420), s);
  } else {
    const sh = shadowOf(art.fortress.base, 0.45);
    sh.position.set(10, 14);
    root.addChild(sh);
    const l = layered(art.fortress, team);
    root.addChild(l.c);
    glows.push(l.glow);
  }
  root.addChild(shield);
  return { root, shield, glows };
}
