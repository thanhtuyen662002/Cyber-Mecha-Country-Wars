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

// ---------------------------------------------------------------- units
// All units face +X (right). Origin = rotation centre.

function infantry(): DrawFn {
  return ({ b, p, g }) => {
    b.roundRect(-11, -6.5, 8, 13, 2.5).fill(0x3e4535).stroke(EDGE); // backpack
    b.roundRect(-1, 2, 10, 4, 2).fill(0x4a5240); // right arm
    b.roundRect(-1, -6, 8, 3.5, 1.7).fill(0x4a5240); // left arm
    b.ellipse(-1, 0, 7, 9.5).fill(metal()).stroke(EDGE); // armour vest
    b.rect(3, 3, 18, 2.6).fill(0x1b1f26); // rifle
    b.rect(9, 5, 3, 4).fill(0x1b1f26);
    b.circle(1, 0, 5.6).fill(darkMetal()).stroke(EDGE); // helmet
    b.circle(0, -1.5, 2.2).fill({ color: 0xffffff, alpha: 0.18 });
    p.circle(-2, -8.5, 3).fill(0xeeeeee).stroke(PANEL);
    p.circle(-2, 8.5, 3).fill(0xeeeeee).stroke(PANEL);
    p.rect(-4, -1, 5, 2).fill(0xdddddd);
    g.rect(5, -3, 1.8, 6).fill(0xffffff); // visor
    g.circle(20, 4.3, 1.1).fill(0xffffff);
  };
}

function drone(): DrawFn {
  return ({ b, p, g }) => {
    for (const s of [1, -1]) {
      b.moveTo(-11, -11 * s).lineTo(11, 11 * s).stroke({ width: 3.6, color: 0x2a303b });
    }
    for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) b.circle(x, y, 3.6).fill(darkMetal()).stroke(EDGE);
    b.roundRect(-8, -5.5, 15, 11, 3).fill(metal()).stroke(EDGE);
    b.poly([7, -4.5, 14, 0, 7, 4.5]).fill(0x6e5d3c).stroke(EDGE); // warhead
    b.rect(9, -1, 3, 2).fill(0xc79a3a);
    p.rect(-6, -5.5, 3.5, 11).fill(0xeeeeee);
    g.circle(4, 0, 2.2).fill(0xffffff);
    for (const [x, y] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) g.circle(x, y, 1.2).fill(0xffffff);
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
  return ({ b }) => {
    for (const y of [-21, 11]) {
      b.roundRect(-31, y, 62, 10, 3.5).fill(0x1a1d23).stroke(EDGE);
      for (let x = -29 + phase * 3; x < 29; x += 6) b.rect(x, y + 1, 2.2, 8).fill(0x3a3f49);
      for (const wx of [-22, -11, 0, 11, 22]) b.circle(wx, y + 5, 2).fill({ color: 0x5c6575, alpha: 0.5 });
    }
  };
}

function tankHull(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(-29, -16, 58, 3).fill(0x4a5262);
    b.rect(-29, 13, 58, 3).fill(0x4a5262);
    b.poly([-27, -13, 21, -13, 29, -6, 29, 6, 21, 13, -27, 13]).fill(metal()).stroke(EDGE);
    b.moveTo(21, -13).lineTo(21, 13).stroke(PANEL);
    b.moveTo(-14, -13).lineTo(-14, 13).stroke(PANEL);
    for (let x = -25; x < -15; x += 2.5) b.rect(x, -9, 1.2, 18).fill({ color: 0x0e1116, alpha: 0.8 }); // engine grille
    b.moveTo(-26, -12).lineTo(20, -12).stroke(HI);
    b.circle(-20, 9, 1.5).fill(0x20252e);
    b.circle(-20, -9, 1.5).fill(0x20252e);
    p.poly([0, -13, 6, -13, 2, 0, 6, 13, 0, 13, -4, 0]).fill(0xe8e8e8).stroke(PANEL);
    p.poly([22, -12, 28, -6, 24, -6, 19, -11]).fill(0xe8e8e8);
    p.poly([22, 12, 28, 6, 24, 6, 19, 11]).fill(0xe8e8e8);
    g.rect(27, -11, 2.4, 3.4).fill(0xffffff);
    g.rect(27, 7.6, 2.4, 3.4).fill(0xffffff);
    g.rect(-27.5, -7, 1.8, 14).fill(0xffffff);
  };
}

function tankTurret(): DrawFn {
  return ({ b, p, g }) => {
    b.rect(8, -2.6, 31, 5.2).fill(darkMetal()).stroke(EDGE);
    b.rect(37, -3.8, 6, 7.6).fill(0x2a303b).stroke(EDGE); // muzzle brake
    b.rect(5, -5.5, 7, 11).fill(0x3d4452).stroke(EDGE);
    b.poly([-13, -10, 4, -12, 12, -6, 12, 6, 4, 12, -13, 10, -16, 4, -16, -4]).fill(metal()).stroke(EDGE);
    b.circle(-5, 4.5, 3.8).fill(darkMetal()).stroke(EDGE); // hatch
    b.rect(-2, -9, 4, 3).fill(0x20252e);
    b.moveTo(-13, -9).lineTo(3, -11).stroke(HI);
    p.poly([-9, -8, -5, -8, -1, 0, -5, 8, -9, 8, -5, 0]).fill(0xeeeeee);
    g.circle(5, -8, 1.7).fill(0xffffff);
    g.rect(13, -0.6, 23, 1.2).fill(0xffffff);
  };
}

function spiderBody(): DrawFn {
  return ({ b, p, g }) => {
    b.ellipse(-14, 0, 17, 14).fill(metal()).stroke(EDGE); // abdomen
    for (let i = -2; i <= 2; i++) b.moveTo(-26, i * 4.5).lineTo(-3, i * 3).stroke(PANEL);
    b.poly([-4, -12, 10, -13, 17, -6, 17, 6, 10, 13, -4, 12, -8, 0]).fill(darkMetal()).stroke(EDGE); // thorax
    b.poly([14, -8, 26, -5, 29, 0, 26, 5, 14, 8]).fill(metal()).stroke(EDGE); // head
    b.rect(24, -8, 12, 3).fill(0x20252e); // twin emitters
    b.rect(24, 5, 12, 3).fill(0x20252e);
    b.circle(4, 0, 5).fill(0x2a303b).stroke(EDGE);
    p.poly([-24, -6, -10, -11, -8, -6, -22, -2]).fill(0xeeeeee);
    p.poly([-24, 6, -10, 11, -8, 6, -22, 2]).fill(0xeeeeee);
    p.rect(-2, -2, 12, 4).fill(0xdddddd);
    for (const [x, y, r] of [[25, -2.5, 1.9], [25, 2.5, 1.9], [21, -5, 1.3], [21, 5, 1.3], [27.5, 0, 1.2]]) g.circle(x, y, r).fill(0xffffff);
    g.circle(4, 0, 2.6).fill(0xffffff);
    g.rect(34, -7.4, 2.4, 1.8).fill(0xffffff);
    g.rect(34, 5.6, 2.4, 1.8).fill(0xffffff);
    g.moveTo(-28, 0).lineTo(-4, 0).stroke({ width: 1.2, color: 0xffffff });
  };
}

function spiderLeg(): DrawFn {
  // Hip at origin, leg extends to +X. Rotated per leg at runtime.
  return ({ b, g }) => {
    b.poly([0, -3, 20, -3.5, 22, 0, 20, 3.5, 0, 3]).fill(darkMetal()).stroke(EDGE);
    b.circle(21, 0, 3.6).fill(metal()).stroke(EDGE);
    b.poly([22, -2.5, 40, -1, 44, 0, 40, 1, 22, 2.5]).fill(metal()).stroke(EDGE);
    g.circle(21, 0, 1.2).fill(0xffffff);
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
  return ({ b, p, g }) => {
    b.roundRect(-22, -13, 52, 26, 7).fill(darkMetal()).stroke(EDGE); // foot
    b.poly([30, -12, 40, -14, 38, -5, 30, -4]).fill(0x2a303b).stroke(EDGE); // toe claws
    b.poly([30, 12, 40, 14, 38, 5, 30, 4]).fill(0x2a303b).stroke(EDGE);
    b.poly([30, -3, 42, 0, 30, 3]).fill(0x2a303b).stroke(EDGE);
    b.roundRect(-10, -9, 26, 18, 5).fill(metal()).stroke(EDGE); // shin
    b.circle(0, 0, 6).fill(0x3a414d).stroke(EDGE);
    p.rect(8, -9, 5, 18).fill(0xeeeeee);
    g.rect(-20, -1, 10, 2).fill(0xffffff);
  };
}

function titanTorso(): DrawFn {
  return ({ b, p, g }) => {
    // back thrusters
    b.roundRect(-62, -30, 18, 22, 4).fill(0x2a303b).stroke(EDGE);
    b.roundRect(-62, 8, 18, 22, 4).fill(0x2a303b).stroke(EDGE);
    // shoulder cannons
    for (const s of [-1, 1]) {
      b.rect(6, s * 58 - 6, 70, 12).fill(darkMetal()).stroke(EDGE);
      b.rect(70, s * 58 - 8, 12, 16).fill(0x2a303b).stroke(EDGE);
      b.rect(20, s * 58 - 9, 8, 18).fill(0x3a414d).stroke(EDGE);
    }
    // arm gatlings
    for (const s of [-1, 1]) {
      b.roundRect(10, s * 36 - 6, 46, 12, 4).fill(0x2a303b).stroke(EDGE);
      for (let i = -1; i <= 1; i++) b.rect(50, s * 36 + i * 3 - 1, 18, 2).fill(0x1b1f26);
    }
    // shoulder pads
    b.poly(pts([-30, -42, 22, -44, 34, -56, 30, -76, -18, -78, -36, -62])).fill(metal()).stroke(EDGE);
    b.poly(mirrorY([-30, -42, 22, -44, 34, -56, 30, -76, -18, -78, -36, -62])).fill(metal()).stroke(EDGE);
    // chest
    b.poly([-40, -40, 14, -46, 40, -28, 48, 0, 40, 28, 14, 46, -40, 40, -50, 0]).fill(metal()).stroke(EDGE);
    b.moveTo(-40, -39).lineTo(14, -45).stroke(HI);
    b.moveTo(14, -46).lineTo(14, 46).stroke(PANEL);
    b.moveTo(-24, -40).lineTo(-24, 40).stroke(PANEL);
    b.poly([24, -16, 44, -8, 44, 8, 24, 16]).fill(glass()).stroke(EDGE); // cockpit visor
    b.circle(-8, 0, 15).fill(0x1d222b).stroke(EDGE); // reactor housing
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.moveTo(-8 + Math.cos(a) * 10, Math.sin(a) * 10).lineTo(-8 + Math.cos(a) * 15, Math.sin(a) * 15).stroke({ width: 2, color: 0x4a5262 });
    }
    p.poly(pts([-14, -50, 8, -50, 26, -62, 24, -72, -10, -72])).fill(0xeeeeee).stroke(PANEL);
    p.poly(mirrorY([-14, -50, 8, -50, 26, -62, 24, -72, -10, -72])).fill(0xeeeeee).stroke(PANEL);
    p.poly([-46, -8, -30, -8, -30, 8, -46, 8]).fill(0xe0e0e0);
    p.poly([16, -40, 36, -26, 30, -22, 14, -34]).fill(0xeeeeee);
    p.poly([16, 40, 36, 26, 30, 22, 14, 34]).fill(0xeeeeee);
    g.circle(-8, 0, 8).fill(0xffffff); // reactor core
    g.poly([26, -12, 42, -6, 42, 6, 26, 12]).stroke({ width: 1.5, color: 0xffffff });
    for (const s of [-1, 1]) {
      g.rect(30, s * 58 - 1, 44, 2).fill(0xffffff);
      g.rect(-62, s * 19 - 6, 3, 12).fill(0xffffff);
      g.circle(28, s * 66, 2).fill(0xffffff);
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
  heliBody: PartTex;
  heliRotor: PartTex;
  rotorDisc: PartTex;
  titanLeg: PartTex;
  titanTorso: PartTex;
  fortress: PartTex;
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
    spiderBody: part(84, spiderBody(), 4),
    spiderLeg: part(96, spiderLeg(), 3),
    heliBody: part(116, heliBody(), 4),
    heliRotor: part(116, heliRotor()),
    rotorDisc: part(116, rotorDisc()),
    titanLeg: part(96, titanLeg(), 5),
    titanTorso: part(200, titanTorso(), 7),
    fortress: part(300, fortress(), 8),
  };
}
