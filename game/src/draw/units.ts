// Procedural vector art for units and fortresses.
// Every part is drawn in 3 layers and baked to textures once at startup:
//   base  = grey metal (never tinted)            -> normal blend
//   paint = light-grey panels tinted team colour -> normal blend
//   glow  = white neon lines + blurred halo       -> additive blend, tinted team colour
// One set of textures therefore serves every country.
import { BlurFilter, Container, FillGradient, Graphics, Rectangle, type Renderer, Texture } from 'pixi.js';

export interface PartTex {
  base: Texture;
  paint: Texture;
  glow: Texture;
}

type L = { b: Graphics; p: Graphics; g: Graphics };
type DrawFn = (l: L) => void;

let R: Renderer;

const metal = () =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: '#a9b3c4' },
      { offset: 0.45, color: '#646e82' },
      { offset: 1, color: '#2a303b' },
    ],
    textureSpace: 'local',
  });
const darkMetal = () =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: '#6d7688' },
      { offset: 1, color: '#1d222b' },
    ],
    textureSpace: 'local',
  });
const glass = () =>
  new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: '#7fd8ff' },
      { offset: 0.35, color: '#16334d' },
      { offset: 1, color: '#060b14' },
    ],
    textureSpace: 'local',
  });

const EDGE = { width: 1.2, color: 0x12161d, alpha: 0.9 };
const PANEL = { width: 0.8, color: 0x1a1f28, alpha: 0.6 };
const HI = { width: 1, color: 0xdfe7f5, alpha: 0.5 };

function bake(target: Container, size: number): Texture {
  return R.generateTexture({
    target,
    frame: new Rectangle(-size / 2, -size / 2, size, size),
    resolution: 2,
    antialias: true,
  });
}

function part(size: number, draw: DrawFn, blur = 5): PartTex {
  const l: L = { b: new Graphics(), p: new Graphics(), g: new Graphics() };
  draw(l);
  // Glow = blurred copy (halo) under the crisp neon lines.
  const halo: L = { b: new Graphics(), p: new Graphics(), g: new Graphics() };
  draw(halo);
  halo.g.filters = [new BlurFilter({ strength: blur, quality: 3 })];
  const glowC = new Container();
  glowC.addChild(halo.g, halo.g.clone(), l.g);
  glowC.children[1].filters = [new BlurFilter({ strength: blur * 2.5, quality: 3 })];
  glowC.children[1].alpha = 0.8;
  const t: PartTex = { base: bake(l.b, size), paint: bake(l.p, size), glow: bake(glowC, size) };
  [l.b, l.p, l.g, halo.b, halo.p].forEach((g) => g.destroy());
  glowC.destroy({ children: true });
  return t;
}

const pts = (a: number[], sx = 1, sy = 1) => a.map((v, i) => (i % 2 ? v * sy : v * sx));
const mirrorY = (a: number[]) => {
  const out: number[] = [];
  for (let i = 0; i < a.length; i += 2) out.push(a[i], -a[i + 1]);
  return out;
};

/** Rectangle with chamfered (cut) corners: the basic "sci-fi plate". */
const cham = (x: number, y: number, w: number, h: number, c: number) => [x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c, x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c];
const hexPts = (cx: number, cy: number, r: number) => {
  const a: number[] = [];
  for (let i = 0; i < 6; i++) a.push(cx + Math.cos((i / 6) * Math.PI * 2) * r, cy + Math.sin((i / 6) * Math.PI * 2) * r);
  return a;
};

// ---------------------------------------------------------------- units
// All units face +X (right). Origin = rotation centre.

function infantry(): DrawFn {
  // power-armoured exo-trooper with an energy rifle
  return ({ b, p, g }) => {
    b.poly(cham(-14, -7, 9, 14, 2.5)).fill(darkMetal()).stroke(EDGE); // power pack
    b.rect(-13, -4, 2, 8).fill(0x0e1116);
    b.poly([0, 1.5, 8, 2, 9, 6, 0, 6.5]).fill(0x3a414d).stroke(EDGE); // forearms
    b.poly([0, -6.5, 6, -6, 7, -2.5, 0, -2.5]).fill(0x3a414d).stroke(EDGE);
    b.poly([-8, -9, 2, -9, 6, -4, 6, 4, 2, 9, -8, 9, -10, 0]).fill(metal()).stroke(EDGE); // chest plate
    b.moveTo(-8, -8).lineTo(2, -8).stroke(HI);
    b.poly([2, 1.6, 22, 2.2, 24, 3.6, 22, 5.6, 2, 5.6]).fill(0x1b1f26).stroke(EDGE); // energy rifle
    b.rect(8, 5.6, 3, 3).fill(0x1b1f26);
    b.poly([-3, -5, 3, -5.5, 6.5, -2, 6.5, 2, 3, 5.5, -3, 5, -5, 0]).fill(darkMetal()).stroke(EDGE); // helmet
    for (const s of [-1, 1]) p.poly([-6, s * 7, 1, s * 7.5, 3, s * 11, -5, s * 11.5, -8, s * 9.5]).fill(0xeeeeee).stroke(PANEL); // pauldrons
    p.rect(-12, -6, 2, 12).fill(0xdddddd);
    g.poly([3.5, -3.5, 6.8, -1.5, 6.8, 1.5, 3.5, 3.5, 4.6, 0]).fill(0xffffff); // visor
    for (let x = 10; x < 20; x += 3) g.rect(x, 2.6, 1.6, 2).fill(0xffffff); // coil
    g.circle(24.5, 3.6, 1.3).fill(0xffffff);
    g.rect(-12.5, -3, 1, 6).fill(0xffffff); // power cell
  };
}

function drone(): DrawFn {
  // hex-bodied strike drone with four ducted fans and a glowing warhead
  return ({ b, p, g }) => {
    for (const s of [1, -1]) b.moveTo(-11, -11 * s).lineTo(11, 11 * s).stroke({ width: 3, color: 0x2a303b });
    for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
      b.circle(x, y, 6.2).stroke({ width: 2, color: 0x3a414d });
      b.circle(x, y, 6.2).stroke({ width: 0.8, color: 0x10141a });
    }
    b.poly(hexPts(0, 0, 8.5)).fill(metal()).stroke(EDGE);
    b.poly(hexPts(0, 0, 5)).fill(0x1d222b).stroke(EDGE);
    b.poly([6, -4, 15, 0, 6, 4]).fill(0x3a2a1c).stroke(EDGE); // warhead
    p.poly([-7.4, -4.2, -4, -6.6, -4, 6.6, -7.4, 4.2]).fill(0xeeeeee);
    g.circle(0, 0, 2.6).fill(0xffffff);
    g.poly([8, -2, 13.5, 0, 8, 2]).fill(0xffffff);
    for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) g.circle(x, y, 6.2).stroke({ width: 0.8, color: 0xffffff, alpha: 0.8 });
  };
}

function droneRotor(): DrawFn {
  return ({ b }) => {
    b.circle(0, 0, 8).fill({ color: 0xc8d2e0, alpha: 0.18 });
    b.rect(-8, -1, 16, 2).fill({ color: 0x1d222b, alpha: 0.85 });
    b.circle(0, 0, 1.5).fill(0x8d98ab);
  };
}

function tankTracks(phase: number): DrawFn {
  // Short, wide hull: 48 long x 46 wide (was 62 x 42) so it reads as a compact tank.
  return ({ b }) => {
    for (const y of [-23, 12]) {
      b.roundRect(-25, y, 50, 11, 4).fill(0x1a1d23).stroke(EDGE);
      for (let x = -23 + phase * 3; x < 23; x += 6) b.rect(x, y + 1, 2.4, 9).fill(0x3a3f49);
      for (const wx of [-16, -5.5, 5.5, 16]) b.circle(wx, y + 5.5, 2.3).fill({ color: 0x5c6575, alpha: 0.55 });
    }
  };
}

function tankHull(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(-24, -17, 48, 3.5).fill(0x4a5262); // fenders
    b.rect(-24, 13.5, 48, 3.5).fill(0x4a5262);
    b.poly([-22, -14, 15, -14, 23, -7, 23, 7, 15, 14, -22, 14]).fill(metal()).stroke(EDGE);
    b.moveTo(15, -14).lineTo(15, 14).stroke(PANEL);
    b.moveTo(-11, -14).lineTo(-11, 14).stroke(PANEL);
    for (let x = -20; x < -12; x += 2.4) b.rect(x, -10, 1.2, 20).fill({ color: 0x0e1116, alpha: 0.8 }); // engine grille
    b.moveTo(-21, -13).lineTo(14, -13).stroke(HI);
    for (const y of [-10, 10]) b.roundRect(-8, y - 2.5, 8, 5, 1.5).fill(0x2a303b).stroke(EDGE); // stowage boxes
    b.circle(-16, 11, 1.5).fill(0x20252e);
    b.circle(-16, -11, 1.5).fill(0x20252e);
    p.poly([2, -14, 8, -14, 4, 0, 8, 14, 2, 14, -2, 0]).fill(0xe8e8e8).stroke(PANEL);
    p.poly([16, -13, 22, -7, 18, -7, 13, -12]).fill(0xe8e8e8);
    p.poly([16, 13, 22, 7, 18, 7, 13, 12]).fill(0xe8e8e8);
    g.rect(21.5, -12, 2.4, 3.6).fill(0xffffff);
    g.rect(21.5, 8.4, 2.4, 3.6).fill(0xffffff);
    g.rect(-22.5, -8, 1.8, 16).fill(0xffffff);
  };
}

function tankTurret(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(9, -2.8, 25, 5.6).fill(darkMetal()).stroke(EDGE);
    b.rect(32, -4, 6, 8).fill(0x2a303b).stroke(EDGE); // muzzle brake
    b.rect(6, -6, 7, 12).fill(0x3d4452).stroke(EDGE);
    b.poly([-14, -12, 4, -13, 13, -7, 13, 7, 4, 13, -14, 12, -17, 5, -17, -5]).fill(metal()).stroke(EDGE);
    b.circle(-5, 5, 4).fill(darkMetal()).stroke(EDGE); // hatch
    b.rect(-3, -10.5, 5, 3.4).fill(0x20252e);
    b.rect(-16, -3, 3, 6).fill(0x20252e); // rear bustle
    b.moveTo(-14, -11).lineTo(3, -12).stroke(HI);
    p.poly([-10, -9, -6, -9, -2, 0, -6, 9, -10, 9, -6, 0]).fill(0xeeeeee);
    g.circle(5, -9, 1.8).fill(0xffffff);
    g.rect(13, -0.6, 19, 1.2).fill(0xffffff);
  };
}

// Quad walker mech: armoured chassis + 4 hydraulic legs + separate twin-cannon turret.
function spiderBody(): DrawFn {
  return ({ b, p, g }) => {
    const hull = [-22, -10, -14, -20, 14, -20, 24, -10, 24, 10, 14, 20, -14, 20, -22, 10];
    b.poly(hull).fill(darkMetal()).stroke({ width: 1.6, color: 0x10141a });
    b.poly([-17, -8, -11, -15, 11, -15, 19, -8, 19, 8, 11, 15, -11, 15, -17, 8]).fill(metal()).stroke(EDGE);
    // hip actuator housings at the four corners
    for (const [x, y] of [[13, -15], [13, 15], [-13, -15], [-13, 15]]) b.roundRect(x - 6, y - 6, 12, 12, 3).fill(0x2a303b).stroke(EDGE);
    // rear power pack + exhaust vents
    b.roundRect(-30, -9, 10, 18, 3).fill(0x2a303b).stroke(EDGE);
    for (let i = -1; i <= 1; i++) b.rect(-29, i * 5 - 1, 7, 2).fill(0x0e1116);
    // front sensor bar
    b.roundRect(20, -7, 8, 14, 2).fill(0x1d222b).stroke(EDGE);
    b.moveTo(-16, -14).lineTo(10, -14).stroke(HI);
    b.moveTo(0, -15).lineTo(0, 15).stroke(PANEL);
    // hazard stripes on the side armour (team paint)
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) p.poly([-6 + i * 6, s * 15, -3 + i * 6, s * 15, -6 + i * 6, s * 19.5, -9 + i * 6, s * 19.5]).fill(0xeeeeee);
    p.rect(-17, -3, 6, 6).fill(0xe6e6e6);
    g.rect(26, -5.5, 1.8, 11).fill(0xffffff); // sensor strip
    for (const [x, y] of [[13, -15], [13, 15], [-13, -15], [-13, 15]]) g.circle(x, y, 1.6).fill(0xffffff);
    g.rect(-30, -1, 2, 2).fill(0xffffff);
  };
}

function spiderTurret(): DrawFn {
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.rect(6, s * 5 - 2, 26, 4).fill(darkMetal()).stroke(EDGE); // twin barrels
      b.rect(29, s * 5 - 3, 5, 6).fill(0x2a303b).stroke(EDGE);
    }
    b.poly([-10, -9, 6, -10, 12, -5, 12, 5, 6, 10, -10, 9, -13, 0]).fill(metal()).stroke(EDGE);
    b.circle(-2, 0, 5).fill(0x1d222b).stroke(EDGE);
    p.poly([-9, -8, -4, -8, -4, 8, -9, 8]).fill(0xeeeeee);
    g.circle(-2, 0, 2.4).fill(0xffffff);
    for (const s of [-1, 1]) g.rect(12, s * 5 - 0.5, 18, 1).fill(0xffffff);
  };
}

function spiderLeg(): DrawFn {
  // Hip at origin, leg extends to +X. Thigh block + knee actuator + piston + shin + foot pad.
  return ({ b, p, g }) => {
    b.circle(0, 0, 5.5).fill(0x3a414d).stroke(EDGE);
    b.poly([0, -5, 22, -4.5, 24, 0, 22, 4.5, 0, 5]).fill(metal()).stroke(EDGE); // thigh armour
    b.moveTo(3, 6.5).lineTo(21, 6).stroke({ width: 2, color: 0x8d98ab }); // hydraulic piston
    b.rect(3, 5.5, 8, 2).fill(0x2a303b);
    b.roundRect(19, -6, 11, 12, 2).fill(0x2a303b).stroke(EDGE); // knee actuator
    b.poly([29, -3.5, 44, -2.5, 44, 2.5, 29, 3.5]).fill(darkMetal()).stroke(EDGE); // shin
    b.roundRect(42, -6.5, 8, 13, 3).fill(0x3a414d).stroke(EDGE); // foot pad
    p.rect(8, -4.5, 6, 9).fill(0xeeeeee);
    g.circle(24.5, 0, 1.5).fill(0xffffff);
  };
}

function heliBody(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(-48, -3, 44, 6).fill(darkMetal()).stroke(EDGE); // tail boom
    b.poly([-50, -4, -42, -4, -40, -13, -46, -13]).fill(metal()).stroke(EDGE); // stabilisers
    b.poly([-50, 4, -42, 4, -40, 13, -46, 13]).fill(metal()).stroke(EDGE);
    b.roundRect(-6, -25, 11, 50, 3).fill(darkMetal()).stroke(EDGE); // stub wings
    for (const s of [-1, 1]) {
      b.roundRect(-9, s > 0 ? 18 : -26, 18, 8, 4).fill(0x2a303b).stroke(EDGE); // rocket pods
      for (let i = 0; i < 3; i++) b.circle(8, (s > 0 ? 20 : -24) + i * 2, 0.9).fill(0x0a0c10);
    }
    b.poly([36, 0, 28, -9, 6, -12, -14, -9, -20, 0, -14, 9, 6, 12, 28, 9]).fill(metal()).stroke(EDGE); // fuselage
    b.roundRect(-14, -14, 16, 6, 2).fill(0x3a414d).stroke(EDGE); // engines
    b.roundRect(-14, 8, 16, 6, 2).fill(0x3a414d).stroke(EDGE);
    b.ellipse(16, 0, 11, 6.5).fill(glass()).stroke(EDGE); // canopy
    b.ellipse(19, -2, 4, 1.6).fill({ color: 0xffffff, alpha: 0.5 });
    b.rect(30, -1.2, 12, 2.4).fill(0x1b1f26); // chin gun
    b.moveTo(-12, -8).lineTo(26, -8).stroke(HI);
    p.rect(-38, -3, 6, 6).fill(0xeeeeee);
    p.poly([-6, -11, 0, -11, 0, 11, -6, 11]).fill(0xe6e6e6);
    g.circle(-2, -25, 1.8).fill(0xffffff);
    g.circle(-2, 25, 1.8).fill(0xffffff);
    g.circle(-50, 0, 1.6).fill(0xffffff);
    g.ellipse(16, 0, 11.5, 7).stroke({ width: 1, color: 0xffffff });
  };
}

function heliRotor(): DrawFn {
  return ({ b }) => {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const c = Math.cos(a), s = Math.sin(a);
      const n = [-2.4 * -s, -2.4 * c];
      b.poly([n[0], n[1], 54 * c + n[0], 54 * s + n[1], 54 * c - n[0], 54 * s - n[1], -n[0], -n[1]]).fill({ color: 0x1a1e25, alpha: 0.92 });
    }
    b.circle(0, 0, 4).fill(metal()).stroke(EDGE);
  };
}

function rotorDisc(): DrawFn {
  return ({ b }) => {
    b.circle(0, 0, 54).fill({ color: 0xffffff, alpha: 0.07 });
    b.circle(0, 0, 54).stroke({ width: 1.5, color: 0xffffff, alpha: 0.25 });
    b.circle(0, 0, 36).stroke({ width: 1, color: 0xffffff, alpha: 0.1 });
  };
}

function titanLeg(): DrawFn {
  // armoured digitigrade foot with a glowing ankle actuator
  return ({ b, p, g }) => {
    b.poly([-22, -10, -14, -14, 26, -14, 32, -8, 32, 8, 26, 14, -14, 14, -22, 10]).fill(darkMetal()).stroke(EDGE);
    for (const y of [-11, 0, 11]) b.poly([30, y - 3.5, 42, y - 1.5, 42, y + 1.5, 30, y + 3.5]).fill(0x2a303b).stroke(EDGE); // claws
    b.poly([-10, -9, 12, -9, 18, -4, 18, 4, 12, 9, -10, 9]).fill(metal()).stroke(EDGE);
    b.moveTo(-9, -8).lineTo(11, -8).stroke(HI);
    b.circle(0, 0, 6.5).fill(0x1d222b).stroke(EDGE);
    p.poly([8, -9, 13, -9, 13, 9, 8, 9]).fill(0xeeeeee);
    p.poly([-20, -9, -16, -12, -16, 12, -20, 9]).fill(0xe0e0e0);
    g.circle(0, 0, 3).fill(0xffffff);
    g.rect(20, -1, 10, 2).fill(0xffffff);
    for (const y of [-11, 0, 11]) g.rect(36, y - 0.5, 5, 1).fill(0xffffff);
  };
}

function titanTorso(): DrawFn {
  return ({ b, p, g }) => {
    // back thrusters
    for (const s of [-1, 1]) {
      b.poly(cham(-66, s > 0 ? 8 : -32, 22, 24, 5)).fill(0x2a303b).stroke(EDGE);
      for (let i = 0; i < 3; i++) b.rect(-64, (s > 0 ? 12 : -28) + i * 6, 6, 3).fill(0x0e1116);
    }
    // shoulder rail cannons
    for (const s of [-1, 1]) {
      b.poly([4, s * 58 - 7, 72, s * 58 - 5, 78, s * 58, 72, s * 58 + 5, 4, s * 58 + 7]).fill(darkMetal()).stroke(EDGE);
      b.rect(24, s * 58 - 2.5, 50, 1.6).fill(0x1b1f26);
      b.rect(24, s * 58 + 1, 50, 1.6).fill(0x1b1f26);
      b.poly(cham(14, s * 58 - 10, 14, 20, 3)).fill(0x3a414d).stroke(EDGE);
    }
    // arm gatlings
    for (const s of [-1, 1]) {
      b.poly(cham(8, s * 36 - 7, 48, 14, 4)).fill(0x2a303b).stroke(EDGE);
      for (let i = -1; i <= 1; i++) b.rect(52, s * 36 + i * 3.4 - 1, 20, 2).fill(0x1b1f26);
      b.circle(52, s * 36, 6).stroke({ width: 1.5, color: 0x4a5262 });
    }
    // shoulder pads (angular)
    const pad = [-34, -42, 20, -46, 36, -58, 34, -74, 22, -82, -16, -82, -38, -64];
    b.poly(pad).fill(metal()).stroke(EDGE);
    b.poly(mirrorY(pad)).fill(metal()).stroke(EDGE);
    // chest
    const chest = [-44, -36, -30, -46, 14, -48, 42, -30, 52, 0, 42, 30, 14, 48, -30, 46, -44, 36, -52, 0];
    b.poly(chest).fill(metal()).stroke({ width: 1.8, color: 0x10141a });
    b.moveTo(-30, -45).lineTo(14, -47).stroke(HI);
    b.moveTo(14, -48).lineTo(30, 0).lineTo(14, 48).stroke(PANEL);
    b.moveTo(-24, -44).lineTo(-24, 44).stroke(PANEL);
    b.poly([26, -16, 48, -7, 48, 7, 26, 16, 30, 0]).fill(glass()).stroke(EDGE); // visor
    b.poly(hexPts(-8, 0, 17)).fill(0x1d222b).stroke(EDGE); // reactor
    b.poly(hexPts(-8, 0, 12)).stroke({ width: 2, color: 0x4a5262 });
    // team paint
    p.poly([-12, -52, 10, -52, 28, -62, 26, -74, -8, -76]).fill(0xeeeeee).stroke(PANEL);
    p.poly(mirrorY([-12, -52, 10, -52, 28, -62, 26, -74, -8, -76])).fill(0xeeeeee).stroke(PANEL);
    p.poly([-50, -8, -32, -10, -32, 10, -50, 8]).fill(0xe0e0e0);
    p.poly([16, -42, 38, -28, 32, -24, 14, -36]).fill(0xeeeeee);
    p.poly([16, 42, 38, 28, 32, 24, 14, 36]).fill(0xeeeeee);
    // neon
    g.poly(hexPts(-8, 0, 8)).fill(0xffffff);
    g.poly([28, -13, 46, -6, 46, 6, 28, 13]).stroke({ width: 1.5, color: 0xffffff });
    g.moveTo(14, -48).lineTo(30, 0).lineTo(14, 48).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
    for (const s of [-1, 1]) {
      g.rect(28, s * 58 - 0.6, 46, 1.2).fill(0xffffff);
      g.rect(-64, s * 20 - 6, 3, 12).fill(0xffffff);
      g.poly(pts([22, -80, 34, -72, 34, -60])).stroke({ width: 1.2, color: 0xffffff });
      g.circle(52, s * 36, 2).fill(0xffffff);
    }
  };
}

function fortress(): DrawFn {
  const hex = (r: number) => {
    const a: number[] = [];
    for (let i = 0; i < 6; i++) a.push(Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * r, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * r);
    return a;
  };
  return ({ b, p, g }) => {
    b.poly(hex(132)).fill(0x2a303b).stroke({ width: 3, color: 0x10141a });
    b.poly(hex(118)).fill(metal()).stroke(EDGE);
    b.poly(hex(100)).fill(0x3a414d).stroke(EDGE);
    // yard markings
    b.circle(0, 0, 70).stroke({ width: 2, color: 0x5a6477, alpha: 0.7 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.rect(Math.cos(a) * 80 - 3, Math.sin(a) * 80 - 3, 6, 6).fill(0x252a33);
    }
    // corner turrets
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * 120, y = Math.sin(a) * 120;
      b.circle(x, y, 17).fill(darkMetal()).stroke(EDGE);
      b.rect(x - 2, y - 2, Math.cos(a) * 26, 4).fill(0x1b1f26);
      p.circle(x, y, 8).fill(0xeeeeee).stroke(PANEL);
      g.circle(x, y, 3).fill(0xffffff);
    }
    // central keep
    b.poly(hex(52)).fill(metal()).stroke({ width: 2, color: 0x10141a });
    b.circle(0, 0, 30).fill(0x1d222b).stroke(EDGE);
    p.poly(hex(44)).stroke({ width: 5, color: 0xeeeeee });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      p.rect(Math.cos(a) * 109 - 6, Math.sin(a) * 109 - 6, 12, 12).fill(0xeeeeee);
    }
    g.circle(0, 0, 18).fill(0xffffff);
    g.circle(0, 0, 26).stroke({ width: 2, color: 0xffffff });
    g.poly(hex(118)).stroke({ width: 1.6, color: 0xffffff, alpha: 0.8 });
  };
}


function sniper(): DrawFn {
  // prone marksman under an optical-camo cape with a long railgun
  return ({ b, p, g }) => {
    b.poly([-24, -6, -14, -11, -2, -9, 4, -5, 4, 5, -2, 9, -14, 11, -24, 6, -27, 0]).fill(0x1d222b).stroke(EDGE); // camo cape
    for (let i = 0; i < 9; i++) {
      const x = -22 + (i % 3) * 7 + ((i / 3) | 0) * 2, y = -6 + ((i / 3) | 0) * 6;
      b.poly(hexPts(x, y, 2.6)).stroke({ width: 0.7, color: 0x3a4555, alpha: 0.9 });
    }
    b.rect(2, -2.4, 34, 1.4).fill(0x2a303b); // twin rails
    b.rect(2, 1, 34, 1.4).fill(0x2a303b);
    b.poly(cham(4, -3.5, 12, 7, 1.5)).fill(darkMetal()).stroke(EDGE); // receiver
    b.poly(cham(8, -7, 8, 3.5, 1)).fill(0x3a414d).stroke(EDGE); // scope
    b.rect(34, -3.4, 4, 6.8).fill(0x1b1f26);
    b.moveTo(14, 3).lineTo(11, 8).moveTo(14, 3).lineTo(17, 8).stroke({ width: 1.2, color: 0x1b1f26 }); // bipod
    b.poly([-1, -4.5, 4, -4.5, 6.5, 0, 4, 4.5, -1, 4.5, -3, 0]).fill(darkMetal()).stroke(EDGE); // helmet
    p.poly([-20, -3, -10, -3, -10, 3, -20, 3]).fill(0xd8d8d8);
    g.rect(4, -0.6, 32, 1.2).fill(0xffffff); // rail charge
    g.circle(16.5, -5.2, 1.4).fill(0xffffff); // scope lens
    g.rect(4.5, -2, 1.4, 4).fill(0xffffff); // visor
    for (let i = 0; i < 9; i += 2) g.poly(hexPts(-22 + (i % 3) * 7 + ((i / 3) | 0) * 2, -6 + ((i / 3) | 0) * 6, 2.6)).stroke({ width: 0.5, color: 0xffffff, alpha: 0.5 });
  };
}

function atSoldier(): DrawFn {
  // heavy exo with a shoulder-mounted plasma launcher
  return ({ b, p, g }) => {
    b.poly(cham(-15, -8, 9, 16, 2.5)).fill(darkMetal()).stroke(EDGE); // pack
    for (const y of [-6, 2]) b.poly(cham(-18, y, 4, 4, 1)).fill(0x6e5d3c).stroke(EDGE); // spare cells
    b.poly([-9, -10, 3, -10, 7, -4, 7, 5, 3, 10, -9, 10, -11, 0]).fill(metal()).stroke(EDGE);
    b.poly([-8, -12.5, 24, -12.5, 27, -10, 27, -5, 24, -3.5, -8, -3.5]).fill(darkMetal()).stroke(EDGE); // launcher
    b.poly(cham(10, -15, 7, 4, 1)).fill(0x3a414d).stroke(EDGE); // targeting optic
    b.poly([27, -11.5, 33, -8, 27, -4.5]).fill(0x2a303b).stroke(EDGE);
    b.poly([-3, -5, 3, -5.5, 6.5, -2, 6.5, 2, 3, 5.5, -3, 5, -5, 0]).fill(darkMetal()).stroke(EDGE);
    p.poly([-6, 7, 1, 7.5, 3, 11, -5, 11.5, -8, 9.5]).fill(0xeeeeee).stroke(PANEL);
    p.rect(0, -12.5, 6, 9).fill(0xeeeeee);
    g.poly([3.5, -3.5, 6.8, -1.5, 6.8, 1.5, 3.5, 3.5, 4.6, 0]).fill(0xffffff);
    g.circle(13.5, -13, 1.3).fill(0xffffff);
    g.circle(30, -8, 2).fill(0xffffff); // plasma warhead
    g.rect(8, -8.5, 14, 1).fill(0xffffff);
  };
}

function flamer(): DrawFn {
  // heavy plasma-thrower trooper with twin fuel cells
  return ({ b, p, g }) => {
    for (const y of [-8, 1]) {
      b.poly(cham(-19, y, 12, 7, 2)).fill(0x5a2a1c).stroke(EDGE);
      b.rect(-17, y + 2, 8, 3).fill(0x2a1810);
    }
    b.poly([-9, -11, 3, -11, 8, -5, 8, 5, 3, 11, -9, 11, -11, 0]).fill(metal()).stroke(EDGE);
    b.moveTo(-9, -10).lineTo(3, -10).stroke(HI);
    b.poly([3, 2, 20, 2.5, 22, 4.2, 20, 6, 3, 6]).fill(0x2a303b).stroke(EDGE); // lance
    b.poly(cham(19, 1.2, 5, 6, 1.2)).fill(0x1b1f26).stroke(EDGE);
    b.moveTo(-10, 2).bezierCurveTo(-4, 8, 0, 6, 4, 4).stroke({ width: 1.6, color: 0x1b1f26 }); // hose
    b.poly([-3, -5.5, 3, -6, 7, -2, 7, 2, 3, 6, -3, 5.5, -5.5, 0]).fill(darkMetal()).stroke(EDGE);
    for (const s of [-1, 1]) p.poly([-7, s * 8, 1, s * 8.5, 3, s * 12.5, -6, s * 13, -9, s * 10.5]).fill(0xeeeeee).stroke(PANEL);
    g.poly([3.5, -3.5, 7, -1.5, 7, 1.5, 3.5, 3.5, 4.8, 0]).fill(0xffffff);
    for (const y of [-8, 1]) g.rect(-17, y + 3, 8, 1).fill(0xffffff); // cell gauges
    g.circle(24, 4.2, 1.8).fill(0xffffff); // pilot flame
    g.rect(8, 3.6, 10, 0.9).fill(0xffffff);
  };
}

function aaHull(): DrawFn {
  // hover anti-air platform: four glowing lift pods instead of wheels
  return ({ b, p, g }) => {
    for (const [x, y] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) {
      b.poly(cham(x - 8, y - 5, 16, 10, 3)).fill(0x1a1d23).stroke(EDGE);
    }
    b.poly([-27, -11, -20, -16, 18, -16, 28, -6, 28, 6, 18, 16, -20, 16, -27, 11]).fill(metal()).stroke(EDGE);
    b.poly([18, -16, 28, -6, 28, 6, 18, 16, 20, 0]).fill(0x4a5262).stroke(EDGE);
    b.moveTo(-20, -15).lineTo(17, -15).stroke(HI);
    for (let x = -24; x < -17; x += 2.2) b.rect(x, -8, 1.1, 16).fill({ color: 0x0e1116, alpha: 0.8 });
    b.moveTo(-8, -16).lineTo(-8, 16).stroke(PANEL);
    p.poly([-6, -16, 2, -16, 0, -10, -4, -10]).fill(0xe8e8e8);
    p.poly([-6, 16, 2, 16, 0, 10, -4, 10]).fill(0xe8e8e8);
    for (const [x, y] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) g.poly(cham(x - 6, y - 2, 12, 4, 1.5)).fill(0xffffff); // lift glow
    g.rect(26.5, -4, 1.4, 8).fill(0xffffff);
    g.poly([-27, -11, -20, -16, 18, -16, 28, -6, 28, 6, 18, 16, -20, 16, -27, 11]).stroke({ width: 0.8, color: 0xffffff, alpha: 0.6 });
  };
}

function aaTurret(): DrawFn {
  // twin vertical-launch missile cells
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(cham(-6, s * 11 - 6, 28, 12, 2.5)).fill(darkMetal()).stroke(EDGE);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.rect(6 + i * 5, s * 11 - 4 + j * 5, 3.4, 3.4).fill(0x0a0c10);
      p.rect(-4, s * 11 - 6, 6, 12).fill(0xeeeeee);
    }
    b.poly([-13, -8, -6, -10, 9, -10, 12, 0, 9, 10, -6, 10, -13, 8]).fill(metal()).stroke(EDGE);
    b.circle(-2, 0, 5).fill(0x1d222b).stroke(EDGE);
    g.circle(-2, 0, 2.2).fill(0xffffff);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.rect(6.8 + i * 5, s * 11 - 3.2, 1.8, 1.8).fill(0xffffff);
  };
}

function radar(): DrawFn {
  // phased-array panel
  return ({ b, g }) => {
    b.poly([-3, -13, 3, -11, 3, 11, -3, 13]).fill(0x5a6477).stroke(EDGE);
    for (let i = -10; i <= 8; i += 3) b.rect(-2, i, 4, 1).fill(0x2a303b);
    b.rect(-1, -1, 7, 2).fill(0x2a303b);
    g.rect(-0.6, -11, 1.2, 22).fill(0xffffff);
  };
}

function robotTorso(): DrawFn {
  // bipedal war robot: V-chest, reactor, rail-cannon right arm, hex missile pod left
  return ({ b, p, g }) => {
    b.poly(cham(-38, -15, 14, 30, 4)).fill(0x2a303b).stroke(EDGE); // reactor pack
    for (let i = 0; i < 4; i++) b.rect(-36, -11 + i * 6, 8, 2.5).fill(0x0e1116);
    // right arm rail cannon (y +)
    b.poly([-2, 16, 46, 17, 54, 20, 54, 27, 46, 30, -2, 31]).fill(darkMetal()).stroke(EDGE);
    b.rect(14, 20, 38, 1.6).fill(0x1b1f26);
    b.rect(14, 25.5, 38, 1.6).fill(0x1b1f26);
    b.poly(cham(0, 14, 14, 19, 3)).fill(0x3a414d).stroke(EDGE);
    // left arm hex missile pod (y -)
    b.poly(cham(-6, -34, 30, 17, 4)).fill(0x3a414d).stroke(EDGE);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.poly(hexPts(8 + i * 5.4, -29 + j * 6.5, 2.4)).fill(0x0a0c10);
    // shoulders
    for (const s of [-1, 1]) b.poly([-18, s * 13, 6, s * 13, 12, s * 20, 6, s * 28, -14, s * 28, -20, s * 21]).fill(metal()).stroke(EDGE);
    // chest
    b.poly([-28, -18, -18, -22, 10, -22, 26, -10, 32, 0, 26, 10, 10, 22, -18, 22, -28, 18, -32, 0]).fill(metal()).stroke({ width: 1.5, color: 0x10141a });
    b.moveTo(-18, -21).lineTo(10, -21).stroke(HI);
    b.moveTo(10, -22).lineTo(20, 0).lineTo(10, 22).stroke(PANEL);
    b.poly([14, -9, 30, -4, 30, 4, 14, 9, 17, 0]).fill(glass()).stroke(EDGE); // visor
    b.poly(hexPts(-8, 0, 9)).fill(0x1d222b).stroke(EDGE);
    // paint
    p.poly([-24, -16, -14, -18, -14, 18, -24, 16]).fill(0xeeeeee).stroke(PANEL);
    for (const s of [-1, 1]) p.poly([-14, s * 22, 4, s * 22, 8, s * 26, -12, s * 26]).fill(0xeeeeee);
    // neon
    g.poly(hexPts(-8, 0, 5)).fill(0xffffff);
    g.poly([15, -7, 29, -3, 29, 3, 15, 7]).stroke({ width: 1.3, color: 0xffffff });
    g.rect(16, 23, 36, 1.4).fill(0xffffff); // rail charge
    g.moveTo(10, -22).lineTo(20, 0).lineTo(10, 22).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
    for (let i = 0; i < 3; i++) g.circle(8 + i * 5.4, -29, 1).fill(0xffffff);
    g.rect(-37, -6, 2, 12).fill(0xffffff);
  };
}

function bomber(): DrawFn {
  // stealth flying wing with glowing leading edges, nose to +X
  return ({ b, p, g }) => {
    const wing = [46, 0, 14, -12, -18, -62, -30, -66, -26, -40, -38, -24, -30, -10, -38, 0, -30, 10, -38, 24, -26, 40, -30, 66, -18, 62, 14, 12];
    b.poly(wing).fill(darkMetal()).stroke({ width: 1.6, color: 0x10141a });
    b.poly([40, 0, 12, -9, -16, -14, -28, -6, -28, 6, -16, 14, 12, 9]).fill(metal()).stroke(EDGE); // spine
    b.moveTo(14, -12).lineTo(-18, -60).stroke(HI);
    for (let i = 1; i < 4; i++) b.moveTo(10 - i * 8, -10 - i * 12).lineTo(-6 - i * 8, -8 - i * 3).stroke(PANEL);
    for (let i = 1; i < 4; i++) b.moveTo(10 - i * 8, 10 + i * 12).lineTo(-6 - i * 8, 8 + i * 3).stroke(PANEL);
    b.poly([30, -4, 20, -6, 14, 0, 20, 6, 30, 4, 34, 0]).fill(glass()).stroke(EDGE); // canopy
    for (const s of [-1, 1]) {
      b.poly(cham(-14, s * 20 - 6, 20, 12, 3)).fill(0x2a303b).stroke(EDGE);
      b.poly([-26, s * 20 - 4, -14, s * 20 - 5, -14, s * 20 + 5, -26, s * 20 + 4]).fill(0x0e1116);
    }
    for (const s of [-1, 1]) p.poly([-4, s * 28, 2, s * 30, -12, s * 54, -18, s * 52]).fill(0xeeeeee);
    p.poly([0, -4, 10, -3, 10, 3, 0, 4]).fill(0xeeeeee);
    // neon leading edges + exhaust
    g.moveTo(46, 0).lineTo(14, -12).lineTo(-18, -62).stroke({ width: 1.4, color: 0xffffff });
    g.moveTo(46, 0).lineTo(14, 12).lineTo(-18, 62).stroke({ width: 1.4, color: 0xffffff });
    for (const s of [-1, 1]) {
      g.circle(-27, s * 64, 2).fill(0xffffff);
      g.rect(-25, s * 20 - 3, 3, 6).fill(0xffffff);
    }
    g.poly([30, -3, 21, -4.5, 16, 0, 21, 4.5, 30, 3]).stroke({ width: 1, color: 0xffffff });
  };
}

function crate(): DrawFn {
  return ({ b, p, g }) => {
    b.roundRect(-16, -16, 32, 32, 4).fill(metal()).stroke({ width: 1.6, color: 0x10141a });
    b.rect(-16, -3, 32, 6).fill(0x2a303b);
    b.rect(-3, -16, 6, 32).fill(0x2a303b);
    b.moveTo(-14, -14).lineTo(10, -14).stroke(HI);
    p.roundRect(-12, -12, 7, 7, 1).fill(0xeeeeee);
    p.roundRect(5, 5, 7, 7, 1).fill(0xeeeeee);
    g.rect(-1, -1, 2, 2).fill(0xffffff);
    g.roundRect(-16, -16, 32, 32, 4).stroke({ width: 1.2, color: 0xffffff });
  };
}

function parachute(): DrawFn {
  return ({ b }) => {
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      b.poly([0, 0, Math.cos(a0) * 34, Math.sin(a0) * 34, Math.cos(a1) * 34, Math.sin(a1) * 34]).fill(i % 2 ? 0xd8dde6 : 0xf2a33a);
    }
    b.circle(0, 0, 34).stroke({ width: 1.5, color: 0x10141a, alpha: 0.6 });
    b.circle(0, 0, 4).fill(0x6a6f78);
  };
}

function capturePad(): DrawFn {
  return ({ b, p, g }) => {
    const hex: number[] = [];
    for (let i = 0; i < 6; i++) hex.push(Math.cos((i / 6) * Math.PI * 2) * 70, Math.sin((i / 6) * Math.PI * 2) * 70);
    b.poly(hex).fill({ color: 0x2a303b, alpha: 0.85 }).stroke({ width: 3, color: 0x10141a });
    b.circle(0, 0, 50).fill(metal()).stroke(EDGE);
    b.circle(0, 0, 34).fill(0x1d222b).stroke(EDGE);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      p.rect(Math.cos(a) * 60 - 5, Math.sin(a) * 60 - 5, 10, 10).fill(0xeeeeee);
    }
    g.circle(0, 0, 40).stroke({ width: 2, color: 0xffffff });
    g.circle(0, 0, 12).fill(0xffffff);
  };
}


// ---------------------------------------------------------------- expansion units (full 24-unit roster)
function jeepBody(): DrawFn {
  // armoured gun jeep: 4 off-road wheels, roll cage
  return ({ b, p, g }) => {
    for (const [x, y] of [[-13, -15], [13, -15], [-13, 15], [13, 15]]) b.poly(cham(x - 6, y - 4, 12, 8, 2)).fill(0x16191e).stroke(EDGE);
    b.poly([-22, -11, -16, -13, 16, -13, 24, -8, 26, 0, 24, 8, 16, 13, -16, 13, -22, 11]).fill(metal()).stroke(EDGE);
    b.poly([8, -11, 18, -9, 18, 9, 8, 11]).fill(glass()).stroke(EDGE); // windshield
    b.moveTo(-14, -11).lineTo(6, -11).moveTo(-14, 11).lineTo(6, 11).stroke({ width: 1.6, color: 0x2a303b }); // roll bars
    b.moveTo(-14, -11).lineTo(-14, 11).stroke({ width: 1.6, color: 0x2a303b });
    b.poly(cham(-21, -6, 6, 12, 1.5)).fill(0x2a303b).stroke(EDGE);
    b.moveTo(-15, -12).lineTo(15, -12).stroke(HI);
    p.poly([18, -10, 24, -7, 24, 7, 18, 10]).fill(0xeeeeee);
    p.rect(-6, -13, 6, 26).fill(0xe0e0e0);
    g.rect(24.5, -7, 1.6, 4).fill(0xffffff);
    g.rect(24.5, 3, 1.6, 4).fill(0xffffff);
    g.rect(-21, -1, 1.4, 2).fill(0xffffff);
  };
}

function jeepGun(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(4, -1.6, 20, 3.2).fill(0x1b1f26).stroke(EDGE);
    b.rect(20, -2.4, 4, 4.8).fill(0x2a303b);
    b.poly(cham(-6, -6, 12, 12, 3)).fill(darkMetal()).stroke(EDGE);
    b.poly([2, -8, 6, -8, 6, 8, 2, 8]).fill(0x3a414d).stroke(EDGE); // gun shield
    p.rect(-5, -2, 5, 4).fill(0xeeeeee);
    g.rect(7, -0.5, 14, 1).fill(0xffffff);
  };
}

function repairDrone(): DrawFn {
  // support drone: twin rotors, manipulator arm, repair emitter
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.moveTo(0, 0).lineTo(-4, s * 15).stroke({ width: 3, color: 0x2a303b });
      b.circle(-4, s * 15, 8).stroke({ width: 2, color: 0x3a414d });
    }
    b.poly([-12, -7, -6, -10, 8, -10, 14, -4, 14, 4, 8, 10, -6, 10, -12, 7]).fill(metal()).stroke(EDGE);
    b.moveTo(10, 4).lineTo(20, 7).lineTo(24, 3).stroke({ width: 2, color: 0x4a5262 }); // arm
    b.circle(24, 3, 2.4).fill(0x2a303b);
    p.rect(-3, -6, 6, 12).fill(0xeeeeee); // cross
    p.rect(-6, -2.5, 12, 5).fill(0xeeeeee);
    g.circle(24, 3, 1.6).fill(0xffffff);
    g.rect(-2, -1, 4, 2).fill(0xffffff);
    for (const s of [-1, 1]) g.circle(-4, s * 15, 8).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
  };
}

function mbtHull(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(-32, -22, 64, 4).fill(0x4a5262);
    b.rect(-32, 18, 64, 4).fill(0x4a5262);
    b.poly([-30, -18, 20, -18, 32, -9, 34, 0, 32, 9, 20, 18, -30, 18, -34, 10, -34, -10]).fill(metal()).stroke({ width: 1.5, color: 0x10141a });
    b.poly([20, -18, 32, -9, 34, 0, 32, 9, 20, 18, 24, 0]).fill(0x4a5262).stroke(EDGE); // glacis
    for (let x = -31; x < -20; x += 2.4) b.rect(x, -12, 1.2, 24).fill({ color: 0x0e1116, alpha: 0.8 });
    for (const y of [-14, 14]) for (let x = -14; x < 18; x += 8) b.poly(cham(x, y - 3, 7, 6, 1.2)).fill(0x3a414d).stroke(EDGE); // reactive armour
    b.moveTo(-29, -17).lineTo(19, -17).stroke(HI);
    p.poly([-4, -18, 4, -18, 0, 0, 4, 18, -4, 18, -8, 0]).fill(0xe8e8e8).stroke(PANEL);
    g.rect(31, -8, 2, 4).fill(0xffffff);
    g.rect(31, 4, 2, 4).fill(0xffffff);
    g.rect(-33, -9, 1.8, 18).fill(0xffffff);
  };
}

function mbtTurret(): DrawFn {
  return ({ b, p, g }) => {
    b.poly([12, -4, 50, -3.4, 50, 3.4, 12, 4]).fill(darkMetal()).stroke(EDGE); // long rail gun
    b.rect(24, -1, 26, 2).fill(0x1b1f26);
    b.poly(cham(48, -5.5, 9, 11, 2)).fill(0x2a303b).stroke(EDGE);
    b.poly([-20, -15, 4, -17, 18, -9, 20, 0, 18, 9, 4, 17, -20, 15, -24, 6, -24, -6]).fill(metal()).stroke({ width: 1.5, color: 0x10141a });
    b.poly(cham(-8, -13, 10, 6, 1.5)).fill(0x2a303b).stroke(EDGE); // sensor pod
    b.poly(hexPts(-6, 6, 5)).fill(darkMetal()).stroke(EDGE);
    b.moveTo(-20, -14).lineTo(4, -16).stroke(HI);
    b.moveTo(4, -17).lineTo(12, 0).lineTo(4, 17).stroke(PANEL);
    p.poly([-16, -12, -11, -12, -7, 0, -11, 12, -16, 12, -12, 0]).fill(0xeeeeee);
    g.circle(1, -10, 1.6).fill(0xffffff);
    g.rect(14, -0.6, 34, 1.2).fill(0xffffff);
    g.moveTo(4, -17).lineTo(12, 0).lineTo(4, 17).stroke({ width: 0.8, color: 0xffffff, alpha: 0.6 });
  };
}

function mlrsHull(): DrawFn {
  // 6-wheel launcher truck, cab at the front
  return ({ b, p, g }) => {
    for (const y of [-17, 17]) for (const x of [-20, -6, 18]) b.poly(cham(x - 6, y - 4, 12, 8, 2)).fill(0x16191e).stroke(EDGE);
    b.poly([-30, -14, 10, -14, 10, 14, -30, 14]).fill(darkMetal()).stroke(EDGE); // bed
    b.poly([12, -14, 26, -14, 34, -8, 34, 8, 26, 14, 12, 14]).fill(metal()).stroke(EDGE); // cab
    b.poly([24, -11, 31, -6, 31, 6, 24, 11]).fill(glass()).stroke(EDGE);
    for (const s of [-1, 1]) b.poly(cham(-28, s * 11 - 2, 8, 4, 1)).fill(0x3a414d); // stabiliser jacks
    b.moveTo(13, -13).lineTo(25, -13).stroke(HI);
    p.poly([12, -14, 18, -14, 18, 14, 12, 14]).fill(0xeeeeee);
    g.rect(33, -7, 1.6, 4).fill(0xffffff);
    g.rect(33, 3, 1.6, 4).fill(0xffffff);
  };
}

function mlrsPod(): DrawFn {
  // 4 x 3 rocket tube box on a turntable
  return ({ b, p, g }) => {
    b.circle(0, 0, 9).fill(0x2a303b).stroke(EDGE);
    b.poly(cham(-14, -13, 34, 26, 3)).fill(metal()).stroke({ width: 1.4, color: 0x10141a });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.circle(-6 + j * 9, -8.5 + i * 5.7, 2.3).fill(0x0a0c10).stroke({ width: 0.6, color: 0x4a5262 });
    p.rect(-14, -13, 34, 3.5).fill(0xeeeeee);
    p.rect(-14, 9.5, 34, 3.5).fill(0xeeeeee);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.circle(-6 + j * 9, -8.5 + i * 5.7, 0.9).fill(0xffffff);
  };
}

function empHull(): DrawFn {
  // 4-wheel capacitor truck
  return ({ b, p, g }) => {
    for (const [x, y] of [[-16, -16], [16, -16], [-16, 16], [16, 16]]) b.poly(cham(x - 7, y - 4, 14, 8, 2)).fill(0x16191e).stroke(EDGE);
    b.poly([-28, -12, -22, -15, 20, -15, 30, -6, 30, 6, 20, 15, -22, 15, -28, 12]).fill(metal()).stroke(EDGE);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.poly(cham(-24 + i * 9, s * 9 - 3, 7, 6, 1.5)).fill(0x1d222b).stroke(EDGE); // capacitors
    b.poly([20, -13, 28, -6, 28, 6, 20, 13]).fill(glass()).stroke(EDGE);
    p.poly([-28, -12, -22, -15, -18, -15, -18, 15, -22, 15, -28, 12]).fill(0xeeeeee);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.rect(-23 + i * 9, s * 9 - 0.5, 5, 1).fill(0xffffff);
    g.rect(29, -4, 1.4, 8).fill(0xffffff);
  };
}

function empCoil(): DrawFn {
  // tesla emitter dish
  return ({ b, p, g }) => {
    b.circle(0, 0, 16).fill(darkMetal()).stroke(EDGE);
    b.circle(0, 0, 11).stroke({ width: 2.5, color: 0x8d98ab });
    b.circle(0, 0, 6).stroke({ width: 2.5, color: 0x8d98ab });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      b.moveTo(Math.cos(a) * 6, Math.sin(a) * 6).lineTo(Math.cos(a) * 16, Math.sin(a) * 16).stroke({ width: 1.5, color: 0x2a303b });
    }
    p.circle(0, 0, 3).fill(0xeeeeee);
    g.circle(0, 0, 3.5).fill(0xffffff);
    g.circle(0, 0, 11).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    g.circle(0, 0, 16).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
  };
}

function hoverBody(): DrawFn {
  // assault hovercraft: rubber skirt, deck, twin rear thrust fans, nose gun
  return ({ b, p, g }) => {
    b.poly([-44, -22, -36, -28, 30, -28, 48, -12, 52, 0, 48, 12, 30, 28, -36, 28, -44, 22]).fill(0x1a1d23).stroke({ width: 1.6, color: 0x0a0c10 }); // skirt
    b.poly([-38, -18, -30, -22, 26, -22, 40, -10, 44, 0, 40, 10, 26, 22, -30, 22, -38, 18]).fill(metal()).stroke(EDGE);
    for (const s of [-1, 1]) {
      b.circle(-30, s * 13, 11).fill(0x2a303b).stroke(EDGE); // fan ducts
      b.circle(-30, s * 13, 8).fill(0x0e1116);
    }
    b.poly(cham(4, -10, 22, 20, 4)).fill(darkMetal()).stroke(EDGE); // superstructure
    b.poly([18, -7, 26, -4, 26, 4, 18, 7]).fill(glass()).stroke(EDGE);
    b.poly([42, -3, 58, -2, 58, 2, 42, 3]).fill(0x1b1f26).stroke(EDGE); // nose gun
    for (const s of [-1, 1]) b.poly(cham(-12, s * 16 - 3, 16, 6, 1.5)).fill(0x3a414d).stroke(EDGE); // rocket rails
    b.moveTo(-30, -21).lineTo(25, -21).stroke(HI);
    p.poly([-10, -22, -2, -22, -2, 22, -10, 22]).fill(0xe8e8e8).stroke(PANEL);
    p.poly([30, -22, 40, -12, 36, -10, 28, -18]).fill(0xeeeeee);
    p.poly([30, 22, 40, 12, 36, 10, 28, 18]).fill(0xeeeeee);
    g.poly([-44, -22, -36, -28, 30, -28, 48, -12, 52, 0, 48, 12, 30, 28, -36, 28, -44, 22]).stroke({ width: 1.2, color: 0xffffff, alpha: 0.65 });
    g.poly([19, -5, 25, -3, 25, 3, 19, 5]).stroke({ width: 1, color: 0xffffff });
    for (const s of [-1, 1]) g.circle(-30, s * 13, 11).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
  };
}

function hullTracks(len: number, wid: number): DrawFn {
  return ({ b }) => {
    for (const y of [-wid / 2, wid / 2 - 14]) {
      b.roundRect(-len / 2, y, len, 14, 5).fill(0x16191e).stroke(EDGE);
      for (let x = -len / 2 + 3; x < len / 2 - 3; x += 7) b.rect(x, y + 1.5, 2.6, 11).fill(0x343943);
    }
  };
}

function mobileHull(): DrawFn {
  // super-heavy tracked platform carrying three turrets
  return ({ b, p, g }) => {
    b.poly([-62, -34, -50, -42, 52, -42, 70, -24, 74, 0, 70, 24, 52, 42, -50, 42, -62, 34, -66, 0]).fill(metal()).stroke({ width: 2, color: 0x10141a });
    b.poly([-50, -30, 46, -30, 60, -16, 60, 16, 46, 30, -50, 30, -56, 0]).fill(darkMetal()).stroke(EDGE);
    for (const [x, y] of [[38, 0], [-6, -16], [-6, 16]]) b.poly(hexPts(x, y, 15)).fill(0x2a303b).stroke(EDGE); // turret rings
    for (let x = -60; x < -48; x += 2.6) b.rect(x, -20, 1.3, 40).fill({ color: 0x0e1116, alpha: 0.8 });
    b.moveTo(-50, -41).lineTo(51, -41).stroke(HI);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.poly(cham(-40 + i * 15, s * 36 - 3, 12, 6, 1.5)).fill(0x3a414d).stroke(EDGE);
    p.poly([-62, -34, -50, -42, -38, -42, -38, 42, -50, 42, -62, 34, -66, 0]).fill(0xe6e6e6).stroke(PANEL);
    p.poly([52, -42, 70, -24, 64, -22, 48, -36]).fill(0xeeeeee);
    p.poly([52, 42, 70, 24, 64, 22, 48, 36]).fill(0xeeeeee);
    g.poly([-50, -30, 46, -30, 60, -16, 60, 16, 46, 30, -50, 30, -56, 0]).stroke({ width: 1.2, color: 0xffffff, alpha: 0.6 });
    g.rect(72, -10, 2, 20).fill(0xffffff);
    for (const [x, y] of [[38, 0], [-6, -16], [-6, 16]]) g.poly(hexPts(x, y, 15)).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
  };
}

function carrier(): DrawFn {
  // airborne drone carrier: long deck with launch lanes, four lift engines
  return ({ b, p, g }) => {
    for (const [x, y] of [[-50, -46], [-50, 46], [40, -46], [40, 46]]) {
      b.circle(x, y, 20).fill(0x2a303b).stroke(EDGE);
      b.circle(x, y, 15).fill(0x0e1116);
      b.moveTo(x - 15, y).lineTo(x + 15, y).moveTo(x, y - 15).lineTo(x, y + 15).stroke({ width: 2, color: 0x3a414d });
      b.moveTo(x > 0 ? x - 18 : x + 18, y > 0 ? y - 16 : y + 16).lineTo(x > 0 ? 20 : -30, y > 0 ? 20 : -20).stroke({ width: 5, color: 0x3a414d });
    }
    b.poly([-90, -26, -80, -36, 70, -36, 100, -16, 108, 0, 100, 16, 70, 36, -80, 36, -90, 26]).fill(metal()).stroke({ width: 2, color: 0x10141a });
    b.poly([-80, -24, 70, -24, 86, -10, 86, 10, 70, 24, -80, 24]).fill(0x2a303b).stroke(EDGE); // flight deck
    for (const s of [-1, 1]) for (let x = -72; x < 70; x += 12) b.rect(x, s * 11 - 1, 7, 2).fill(0xc8d2e0);
    b.poly(cham(-20, -36, 40, 10, 3)).fill(darkMetal()).stroke(EDGE); // island / bridge
    b.poly([0, -34, 16, -34, 18, -28, 0, -28]).fill(glass());
    for (let i = 0; i < 4; i++) b.poly(cham(-70 + i * 16, -7, 10, 14, 2)).fill(0x1d222b).stroke(EDGE); // drone bays
    b.moveTo(-80, -35).lineTo(69, -35).stroke(HI);
    p.poly([86, -10, 100, -16, 108, 0, 100, 16, 86, 10]).fill(0xeeeeee).stroke(PANEL);
    p.poly([-90, -26, -80, -36, -80, 36, -90, 26]).fill(0xe6e6e6);
    for (const s of [-1, 1]) for (let x = -72; x < 70; x += 12) g.rect(x, s * 11 - 0.5, 7, 1).fill(0xffffff);
    for (let i = 0; i < 4; i++) g.rect(-67 + i * 16, -1, 4, 2).fill(0xffffff);
    for (const [x, y] of [[-50, -46], [-50, 46], [40, -46], [40, 46]]) g.circle(x, y, 20).stroke({ width: 1.2, color: 0xffffff, alpha: 0.7 });
    g.circle(106, 0, 2.5).fill(0xffffff);
  };
}

function stormBase(): DrawFn {
  // walking weather station: octagon hull on four stub legs
  return ({ b, p, g }) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 46, y = Math.sin(a) * 46;
      b.poly(cham(x - 12, y - 12, 24, 24, 6)).fill(darkMetal()).stroke(EDGE);
      g.circle(x, y, 3).fill(0xffffff);
    }
    const oct: number[] = [];
    for (let i = 0; i < 8; i++) oct.push(Math.cos((i / 8) * Math.PI * 2 + Math.PI / 8) * 46, Math.sin((i / 8) * Math.PI * 2 + Math.PI / 8) * 46);
    b.poly(oct).fill(metal()).stroke({ width: 2, color: 0x10141a });
    b.circle(0, 0, 32).fill(0x2a303b).stroke(EDGE);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.poly(cham(Math.cos(a) * 38 - 3, Math.sin(a) * 38 - 3, 6, 6, 1.5)).fill(0x1d222b);
      p.poly(cham(Math.cos(a) * 38 - 2, Math.sin(a) * 38 - 2, 4, 4, 1)).fill(0xeeeeee);
    }
    g.poly(oct).stroke({ width: 1.4, color: 0xffffff, alpha: 0.7 });
    g.circle(0, 0, 32).stroke({ width: 1.4, color: 0xffffff, alpha: 0.6 });
  };
}

function stormSpire(): DrawFn {
  // tesla spire seen from above: stacked rings around a glowing core
  return ({ b, p, g }) => {
    b.circle(0, 0, 26).fill(darkMetal()).stroke(EDGE);
    for (const r of [20, 14]) b.circle(0, 0, r).stroke({ width: 3, color: 0x8d98ab });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.moveTo(Math.cos(a) * 8, Math.sin(a) * 8).lineTo(Math.cos(a) * 26, Math.sin(a) * 26).stroke({ width: 2, color: 0x2a303b });
    }
    p.circle(0, 0, 7).fill(0xeeeeee);
    g.circle(0, 0, 7).fill(0xffffff);
    for (const r of [20, 14]) g.circle(0, 0, r).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
  };
}

function satellite(): DrawFn {
  // orbital cannon satellite (portrait / cut-in only)
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(cham(-22, s > 0 ? 16 : -58, 44, 42, 3)).fill(0x1a2a4a).stroke(EDGE); // solar wings
      for (let i = 1; i < 4; i++) b.moveTo(-22 + i * 11, s > 0 ? 16 : -58).lineTo(-22 + i * 11, s > 0 ? 58 : -16).stroke({ width: 0.8, color: 0x3a5a8a });
      b.rect(-2, s > 0 ? 8 : -16, 4, 8).fill(0x5a6477);
    }
    b.poly(hexPts(0, 0, 16)).fill(metal()).stroke({ width: 1.5, color: 0x10141a });
    b.poly([12, -6, 44, -4, 48, 0, 44, 4, 12, 6]).fill(darkMetal()).stroke(EDGE); // cannon
    for (let i = 0; i < 3; i++) b.circle(22 + i * 8, 0, 5).stroke({ width: 1.6, color: 0x8d98ab });
    p.poly(hexPts(0, 0, 9)).fill(0xeeeeee);
    g.circle(0, 0, 4).fill(0xffffff);
    g.rect(14, -0.8, 34, 1.6).fill(0xffffff);
    for (let i = 0; i < 3; i++) g.circle(22 + i * 8, 0, 5).stroke({ width: 0.8, color: 0xffffff });
  };
}

function dragonHead(): DrawFn {
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) b.poly([-14, s * 8, -30, s * 22, -22, s * 10]).fill(darkMetal()).stroke(EDGE); // horns
    b.poly([-16, -14, 6, -16, 26, -9, 40, -4, 40, 4, 26, 9, 6, 16, -16, 14, -22, 0]).fill(metal()).stroke({ width: 1.5, color: 0x10141a });
    b.poly([24, -6, 44, -3, 46, 0, 44, 3, 24, 6]).fill(0x1d222b).stroke(EDGE); // jaw
    for (let i = 0; i < 4; i++) b.poly([28 + i * 4, -6, 30 + i * 4, -3, 32 + i * 4, -6]).fill(0xc8d2e0);
    b.moveTo(-14, -13).lineTo(24, -9).stroke(HI);
    p.poly([-10, -12, 4, -13, 4, 13, -10, 12]).fill(0xeeeeee).stroke(PANEL);
    for (const s of [-1, 1]) g.poly([12, s * 7, 20, s * 8, 18, s * 5]).fill(0xffffff); // eyes
    g.poly([26, -2, 44, -1, 44, 1, 26, 2]).fill(0xffffff); // furnace mouth
  };
}

function dragonSeg(): DrawFn {
  return ({ b, p, g }) => {
    b.poly(hexPts(0, 0, 17)).fill(metal()).stroke({ width: 1.4, color: 0x10141a });
    b.poly([-8, -18, 8, -18, 4, -24, -4, -24]).fill(darkMetal()).stroke(EDGE); // dorsal fin (side)
    b.poly([-8, 18, 8, 18, 4, 24, -4, 24]).fill(darkMetal()).stroke(EDGE);
    b.poly(hexPts(0, 0, 9)).fill(0x1d222b).stroke(EDGE);
    p.poly([-12, -10, -6, -14, -6, 14, -12, 10]).fill(0xeeeeee);
    g.poly(hexPts(0, 0, 4.5)).fill(0xffffff);
    g.poly(hexPts(0, 0, 17)).stroke({ width: 0.8, color: 0xffffff, alpha: 0.5 });
  };
}

function dragonWing(): DrawFn {
  // origin at the shoulder, wing spreads toward -Y
  return ({ b, p, g }) => {
    b.poly([0, 0, 14, -8, 10, -40, -6, -72, -22, -60, -26, -40, -30, -22, -18, -8]).fill({ color: 0x2a303b, alpha: 0.95 }).stroke({ width: 1.4, color: 0x10141a });
    for (const [x, y] of [[-6, -72], [-22, -60], [-26, -40], [-30, -22]]) b.moveTo(4, -4).lineTo(x, y).stroke({ width: 2.4, color: 0x5a6477 });
    p.poly([4, -6, 10, -40, 2, -50, -2, -12]).fill(0xeeeeee);
    for (const [x, y] of [[-6, -72], [-22, -60], [-26, -40], [-30, -22]]) g.moveTo(4, -4).lineTo(x, y).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
  };
}

// ---------------------------------------------------------------- public

export interface UnitArt {
  infantry: PartTex;
  drone: PartTex;
  droneRotor: PartTex;
  tankTracks: PartTex[];
  tankHull: PartTex;
  tankTurret: PartTex;
  spiderBody: PartTex;
  spiderLeg: PartTex;
  spiderTurret: PartTex;
  heliBody: PartTex;
  heliRotor: PartTex;
  rotorDisc: PartTex;
  titanLeg: PartTex;
  titanTorso: PartTex;
  fortress: PartTex;
  sniper: PartTex;
  atSoldier: PartTex;
  flamer: PartTex;
  aaHull: PartTex;
  aaTurret: PartTex;
  radar: PartTex;
  robotTorso: PartTex;
  bomber: PartTex;
  crate: PartTex;
  parachute: PartTex;
  capturePad: PartTex;
  jeepBody: PartTex;
  jeepGun: PartTex;
  repairDrone: PartTex;
  mbtTracks: PartTex;
  mbtHull: PartTex;
  mbtTurret: PartTex;
  mlrsHull: PartTex;
  mlrsPod: PartTex;
  empHull: PartTex;
  empCoil: PartTex;
  hoverBody: PartTex;
  mobileTracks: PartTex;
  mobileHull: PartTex;
  carrier: PartTex;
  stormBase: PartTex;
  stormSpire: PartTex;
  satellite: PartTex;
  dragonHead: PartTex;
  dragonSeg: PartTex;
  dragonWing: PartTex;
}

export function makeUnitArt(renderer: Renderer): UnitArt {
  R = renderer;
  return {
    infantry: part(48, infantry(), 3),
    drone: part(44, drone(), 3),
    droneRotor: part(20, droneRotor()),
    tankTracks: [0, 1].map((ph) => part(72, tankTracks(ph))),
    tankHull: part(72, tankHull(), 4),
    tankTurret: part(96, tankTurret(), 4),
    spiderBody: part(76, spiderBody(), 4),
    spiderLeg: part(112, spiderLeg(), 3),
    spiderTurret: part(80, spiderTurret(), 4),
    heliBody: part(116, heliBody(), 4),
    heliRotor: part(116, heliRotor()),
    rotorDisc: part(116, rotorDisc()),
    titanLeg: part(96, titanLeg(), 5),
    titanTorso: part(200, titanTorso(), 7),
    fortress: part(300, fortress(), 8),
    sniper: part(80, sniper(), 3),
    atSoldier: part(64, atSoldier(), 3),
    flamer: part(56, flamer(), 3),
    aaHull: part(72, aaHull(), 4),
    aaTurret: part(64, aaTurret(), 4),
    radar: part(32, radar(), 3),
    robotTorso: part(120, robotTorso(), 5),
    bomber: part(150, bomber(), 5),
    crate: part(48, crate(), 4),
    parachute: part(80, parachute()),
    capturePad: part(160, capturePad(), 6),
    jeepBody: part(64, jeepBody(), 3),
    jeepGun: part(56, jeepGun(), 3),
    repairDrone: part(64, repairDrone(), 3),
    mbtTracks: part(100, hullTracks(76, 56)),
    mbtHull: part(100, mbtHull(), 4),
    mbtTurret: part(130, mbtTurret(), 4),
    mlrsHull: part(84, mlrsHull(), 4),
    mlrsPod: part(56, mlrsPod(), 3),
    empHull: part(72, empHull(), 4),
    empCoil: part(44, empCoil(), 5),
    hoverBody: part(128, hoverBody(), 5),
    mobileTracks: part(176, hullTracks(140, 100)),
    mobileHull: part(176, mobileHull(), 6),
    carrier: part(240, carrier(), 7),
    stormBase: part(150, stormBase(), 6),
    stormSpire: part(64, stormSpire(), 6),
    satellite: part(128, satellite(), 5),
    dragonHead: part(100, dragonHead(), 5),
    dragonSeg: part(56, dragonSeg(), 4),
    dragonWing: part(160, dragonWing(), 5),
  };
}
