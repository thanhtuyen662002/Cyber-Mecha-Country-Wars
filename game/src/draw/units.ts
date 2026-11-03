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


// ---------------------------------------------------------------- launch units added in the game
function sniper(): DrawFn {
  // prone marksman under a ghillie cape with a long rifle
  return ({ b, p, g }) => {
    b.ellipse(-8, 0, 13, 8).fill(0x3f4a33).stroke(EDGE); // ghillie cape
    for (const [x, y, r] of [[-16, -5, 3], [-12, 6, 3.5], [-3, -7, 3], [-18, 3, 2.5], [-6, 7, 2.5]] as const) b.circle(x, y, r).fill(0x4d5a3c);
    b.rect(2, -1.2, 30, 2.4).fill(0x1b1f26); // long barrel
    b.rect(30, -2, 5, 4).fill(0x2a303b); // suppressor
    b.rect(8, -3.5, 8, 2).fill(0x2a303b); // scope
    b.moveTo(12, 1).lineTo(10, 6).moveTo(12, 1).lineTo(14, 6).stroke({ width: 1.2, color: 0x1b1f26 }); // bipod
    b.circle(2, 0, 5).fill(darkMetal()).stroke(EDGE); // helmet
    p.rect(-14, -2, 6, 4).fill(0xdddddd);
    g.circle(16, -2.5, 1.3).fill(0xffffff); // scope glint
  };
}

function atSoldier(): DrawFn {
  return ({ b, p, g }) => {
    b.roundRect(-11, -6.5, 8, 13, 2.5).fill(0x3e4535).stroke(EDGE);
    for (let i = 0; i < 2; i++) b.roundRect(-14 + i * 0, -4 + i * 6, 5, 4, 1).fill(0x6e5d3c); // spare rockets
    b.ellipse(-1, 0, 7, 9.5).fill(metal()).stroke(EDGE);
    b.rect(-6, -9.5, 30, 5).fill(0x3a414d).stroke(EDGE); // launcher tube on the shoulder
    b.rect(22, -10.5, 5, 7).fill(0x2a303b).stroke(EDGE);
    b.poly([24, -9, 30, -7, 24, -5]).fill(0x8a6a3a); // warhead
    b.circle(1, 0, 5.6).fill(darkMetal()).stroke(EDGE);
    p.circle(-2, 8.5, 3).fill(0xeeeeee).stroke(PANEL);
    p.rect(4, -9.5, 6, 5).fill(0xeeeeee);
    g.rect(5, -2, 1.8, 5).fill(0xffffff);
    g.circle(27, -7, 1.2).fill(0xffffff);
  };
}

function flamer(): DrawFn {
  return ({ b, p, g }) => {
    for (const y of [-5, 1]) b.roundRect(-16, y, 11, 5, 2.5).fill(0x8a3a24).stroke(EDGE); // fuel tanks
    b.ellipse(-1, 0, 7.5, 10).fill(metal()).stroke(EDGE);
    b.rect(3, 2.5, 16, 3).fill(0x2a303b); // flame lance
    b.rect(18, 1.8, 4, 4.4).fill(0x1b1f26);
    b.moveTo(-10, 0).lineTo(4, 4).stroke({ width: 1.4, color: 0x1b1f26 }); // hose
    b.circle(1, 0, 6).fill(darkMetal()).stroke(EDGE); // heavy helmet
    p.rect(-15, -5, 3, 11).fill(0xeeeeee);
    g.rect(5, -3, 2, 6).fill(0xffffff);
    g.circle(22, 4, 1.6).fill(0xffffff); // pilot light
  };
}

function aaHull(): DrawFn {
  // six-wheeled armoured carrier
  return ({ b, p, g }) => {
    for (const y of [-19, 13]) for (const x of [-17, 0, 17]) b.roundRect(x - 6, y, 12, 6, 2).fill(0x1a1d23).stroke(EDGE);
    b.poly([-26, -14, 18, -14, 27, -6, 27, 6, 18, 14, -26, 14]).fill(metal()).stroke(EDGE);
    b.poly([18, -14, 27, -6, 27, 6, 18, 14]).fill(0x4a5262).stroke(EDGE); // sloped nose
    b.moveTo(-25, -13).lineTo(17, -13).stroke(HI);
    for (let x = -23; x < -15; x += 2.4) b.rect(x, -9, 1.2, 18).fill({ color: 0x0e1116, alpha: 0.8 });
    p.poly([-6, -14, 2, -14, 2, 14, -6, 14]).fill(0xe8e8e8).stroke(PANEL);
    g.rect(25.5, -10, 2, 4).fill(0xffffff);
    g.rect(25.5, 6, 2, 4).fill(0xffffff);
  };
}

function aaTurret(): DrawFn {
  // twin missile pods + rotating radar plate
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.roundRect(-4, s * 11 - 5, 26, 10, 2).fill(darkMetal()).stroke(EDGE);
      for (let j = 0; j < 2; j++) b.circle(21, s * 11 - 2.5 + j * 5, 1.6).fill(0x0a0c10);
      p.rect(2, s * 11 - 5, 5, 10).fill(0xeeeeee);
    }
    b.roundRect(-12, -9, 20, 18, 4).fill(metal()).stroke(EDGE);
    b.circle(-3, 0, 5).fill(0x1d222b).stroke(EDGE);
    g.circle(-3, 0, 2.2).fill(0xffffff);
    for (const s of [-1, 1]) g.rect(8, s * 11 - 0.5, 12, 1).fill(0xffffff);
  };
}

function radar(): DrawFn {
  return ({ b, g }) => {
    b.roundRect(-3, -12, 6, 24, 2).fill(0x8d98ab).stroke(EDGE);
    b.rect(-1, -1, 7, 2).fill(0x2a303b);
    g.rect(-1, -10, 1.2, 20).fill(0xffffff);
  };
}

function robotTorso(): DrawFn {
  // bipedal war robot: smaller sibling of the Titan with one big arm cannon + rocket pod
  return ({ b, p, g }) => {
    b.roundRect(-34, -14, 12, 28, 3).fill(0x2a303b).stroke(EDGE); // back pack
    // right arm cannon (y +)
    b.roundRect(0, 18, 44, 11, 3).fill(darkMetal()).stroke(EDGE);
    b.rect(42, 19.5, 10, 8).fill(0x2a303b).stroke(EDGE);
    // left arm rocket pod (y -)
    b.roundRect(-4, -31, 26, 14, 3).fill(0x3a414d).stroke(EDGE);
    for (let i = 0; i < 3; i++) b.circle(18, -28 + i * 4, 1.2).fill(0x0a0c10);
    // shoulders
    b.roundRect(-14, -26, 22, 12, 4).fill(metal()).stroke(EDGE);
    b.roundRect(-14, 14, 22, 12, 4).fill(metal()).stroke(EDGE);
    // chest
    b.poly([-26, -18, 8, -20, 24, -10, 28, 0, 24, 10, 8, 20, -26, 18, -30, 0]).fill(metal()).stroke(EDGE);
    b.moveTo(-26, -17).lineTo(8, -19).stroke(HI);
    b.poly([12, -8, 25, -4, 25, 4, 12, 8]).fill(glass()).stroke(EDGE);
    b.circle(-8, 0, 8).fill(0x1d222b).stroke(EDGE);
    p.poly([-20, -16, -12, -16, -12, 16, -20, 16]).fill(0xeeeeee).stroke(PANEL);
    p.rect(-10, -25, 10, 4).fill(0xeeeeee);
    p.rect(-10, 21, 10, 4).fill(0xeeeeee);
    g.circle(-8, 0, 4).fill(0xffffff);
    g.poly([13, -6, 24, -3, 24, 3, 13, 6]).stroke({ width: 1.2, color: 0xffffff });
    g.rect(10, 23, 30, 1.5).fill(0xffffff);
  };
}

function bomber(): DrawFn {
  // flying-wing strike bomber, nose to +X
  return ({ b, p, g }) => {
    b.poly([44, 0, 10, -12, -22, -64, -34, -60, -22, -24, -36, -14, -30, 0, -36, 14, -22, 24, -34, 60, -22, 64, 10, 12]).fill(metal()).stroke({ width: 1.6, color: 0x10141a });
    b.poly([40, 0, 12, -8, -24, -10, -24, 10, 12, 8]).fill(darkMetal()).stroke(EDGE); // spine
    b.ellipse(24, 0, 9, 4.5).fill(glass()).stroke(EDGE);
    for (const s of [-1, 1]) {
      b.roundRect(-14, s * 20 - 5, 18, 10, 3).fill(0x2a303b).stroke(EDGE); // engine nacelles
      b.rect(-18, s * 20 - 3, 4, 6).fill(0x0e1116);
    }
    b.moveTo(10, -12).lineTo(-22, -62).stroke(HI);
    for (const s of [-1, 1]) p.poly([-6, s * 30, 0, s * 30, -14, s * 56, -20, s * 56]).fill(0xeeeeee);
    p.poly([0, -4, 8, -3, 8, 3, 0, 4]).fill(0xeeeeee);
    for (const s of [-1, 1]) {
      g.circle(-27, s * 62, 2).fill(0xffffff); // wingtip lights
      g.rect(-20, s * 20 - 2, 2, 4).fill(0xffffff); // afterburner
    }
    g.ellipse(24, 0, 9.5, 5).stroke({ width: 1, color: 0xffffff });
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
  };
}
