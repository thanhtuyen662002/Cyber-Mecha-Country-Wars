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
  // small parts get extra resolution so they stay crisp in close-ups (cards, portraits, zoomed camera)
  return R.generateTexture({
    target,
    frame: new Rectangle(-size / 2, -size / 2, size, size),
    resolution: size <= 80 ? 4 : 3,
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
  const t: PartTex = { base: bake(l.b, size), paint: bake(l.p, size), glow: bake(glowC, size + blur * 8) };
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
// ---------------------------------------------------------------- tier 0-1 (v3: layered armour like the tank/spider)
const OUT = { width: 1.6, color: 0x0b0e13, alpha: 1 };
/** Two-layer armour plate: dark silhouette with a lighter inset plate, the look shared by the tank and spider. */
function plate(b: Graphics, outer: number[], inner: number[]) {
  b.poly(outer).fill(darkMetal()).stroke(OUT);
  b.poly(inner).fill(metal()).stroke(EDGE);
}

function infantry(): DrawFn {
  // exo-trooper: jump pack, heavy pauldrons, bullpup plasma carbine
  return ({ b, p, g }) => {
    plate(b, cham(-18, -9, 10, 18, 3), cham(-16.5, -7, 7, 14, 2)); // jump pack
    for (const y of [-5, 5]) b.circle(-18.5, y, 2.6).fill(0x14181f).stroke(EDGE);
    for (const s of [-1, 1]) plate(b, pts([-9, 6, 3, 6, 7, 9.5, 5, 14, -5, 14.5, -11, 10.5], 1, s), pts([-7, 8, 2, 8, 4.6, 10.4, 3, 12.6, -4, 12.8, -8.6, 10.2], 1, s));
    plate(b, [-12, -8.5, 0, -10, 7, -6, 8, 0, 7, 6, 0, 10, -12, 8.5, -14, 0], [-10, -6.5, 0, -8, 5, -4.6, 5.6, 0, 5, 4.6, 0, 8, -10, 6.5, -11.6, 0]);
    b.moveTo(-10, -6).lineTo(0, -7.5).stroke(HI);
    b.moveTo(-4, -7.6).lineTo(-4, 7.6).stroke(PANEL);
    b.poly([1, -8.5, 6, -7.5, 15, -1, 13, 1.6, 4, -3.5]).fill(0x3a414d).stroke(EDGE); // support arm to the foregrip
    b.poly(cham(-1, 0.4, 17, 6, 1.4)).fill(0x1b1f26).stroke(EDGE); // receiver
    b.poly([15, 1.4, 27, 1.8, 28, 3.4, 27, 5, 15, 5.4]).fill(darkMetal()).stroke(EDGE); // barrel shroud
    b.rect(28, 2.4, 3.5, 2).fill(0x14181f);
    b.poly(cham(4, -2, 8, 3, 0.8)).fill(0x3a414d).stroke(EDGE); // optic
    b.rect(7, 6.4, 3, 3.4).fill(0x14181f).stroke(EDGE); // magazine
    b.poly([2, 7.5, 8, 8, 9, 5, 4, 4]).fill(0x3a414d).stroke(EDGE); // trigger hand
    plate(b, [-4.5, -6, 2, -6.5, 6.5, -3.4, 7.8, 0, 6.5, 3.4, 2, 6.5, -4.5, 6, -6.5, 0], [-3.4, -4.4, 1.6, -4.8, 4.6, -2.4, 5, 0, 4.6, 2.4, 1.6, 4.8, -3.4, 4.4, -4.8, 0]); // helmet
    for (const s of [-1, 1]) p.poly(pts([-4, 8.6, 1.4, 8.6, -0.6, 12.6, -6, 12.6], 1, s)).fill(0xeeeeee);
    p.rect(-15, -6, 2, 12).fill(0xeeeeee);
    p.poly([-2.4, -4.5, -0.6, -4.7, -0.6, 4.7, -2.4, 4.5]).fill(0xeeeeee);
    g.poly([5, -2.8, 7.6, -0.9, 7.6, 0.9, 5, 2.8, 5.8, 0]).fill(0xffffff); // visor
    for (const y of [-5, 5]) g.circle(-18.5, y, 1.3).fill(0xffffff);
    for (let x = 16.5; x < 26; x += 2.6) g.rect(x, 2.7, 1.3, 1.6).fill(0xffffff);
    g.circle(11, -0.5, 0.9).fill(0xffffff);
    g.poly(hexPts(-7, 0, 1.6)).fill(0xffffff); // chest core
  };
}

function sniper(): DrawFn {
  // prone recon marksman: armoured legs, hex optical-camo cloak, long coil railgun on a bipod
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      plate(b, pts([-34, 2, -16, 1.5, -14, 5.5, -16, 8.5, -34, 7.5, -36, 4.8], 1, s), pts([-32, 3.2, -18, 3, -16.6, 5.4, -18, 7.2, -32, 6.4], 1, s));
      b.poly(pts([-27, 1.6, -22, 1.4, -21, 4.8, -22, 8.4, -27, 8, -28, 4.8], 1, s)).fill(0x2a303b).stroke(EDGE); // knee pads
    }
    plate(b, [-19, -8, -4, -9.5, 3, -6.5, 3, 6.5, -4, 9.5, -19, 8, -21, 0], [-17, -6, -4, -7.6, 1, -5, 1, 5, -4, 7.6, -17, 6, -18.6, 0]);
    // optical-camo cloak over the back
    b.poly([-22, -7, -10, -10.5, -3, -9, -3, 9, -10, 10.5, -22, 7, -24, 0]).fill({ color: 0x0f141c, alpha: 0.9 }).stroke(EDGE);
    for (let i = 0; i < 7; i++) {
      const x = -19 + (i % 3) * 6 + (((i / 3) | 0) % 2) * 3, y = -5.5 + ((i / 3) | 0) * 5.5;
      b.poly(hexPts(x, y, 2.4)).stroke({ width: 0.7, color: 0x3a4a5e, alpha: 1 });
    }
    // arms forward to the rifle
    for (const s of [-1, 1]) b.poly(pts([-4, 7.5, 6, 3, 9, 4.5, -1, 9.5], 1, s)).fill(0x3a414d).stroke(EDGE);
    // railgun
    b.poly(cham(2, -3.6, 16, 7.2, 1.6)).fill(darkMetal()).stroke(OUT); // receiver
    b.rect(-6, -1.6, 9, 3.2).fill(0x1b1f26).stroke(EDGE); // stock
    for (const y of [-2.6, 1.2]) b.rect(17, y, 26, 1.4).fill(0x2a303b).stroke({ width: 0.6, color: 0x0b0e13 });
    for (let x = 20; x < 40; x += 5) b.rect(x, -3.4, 2, 6.8).fill(0x3a414d).stroke({ width: 0.6, color: 0x0b0e13 }); // coil rings
    b.poly(cham(42, -3.8, 5, 7.6, 1.4)).fill(0x1b1f26).stroke(EDGE); // muzzle brake
    b.poly(cham(5, -8.4, 12, 4, 1.2)).fill(0x3a414d).stroke(EDGE); // long scope
    b.rect(16.5, -7.8, 2.4, 2.8).fill(0x1b1f26);
    b.moveTo(24, 2).lineTo(20, 10).moveTo(24, 2).lineTo(28, 10).stroke({ width: 1.4, color: 0x1b1f26 }); // bipod
    b.moveTo(24, -2).lineTo(20, -10).moveTo(24, -2).lineTo(28, -10).stroke({ width: 1.4, color: 0x1b1f26 });
    plate(b, [-2, -5.2, 3.5, -5.4, 7.5, -2.6, 8.5, 0, 7.5, 2.6, 3.5, 5.4, -2, 5.2, -4, 0], [-1, -3.6, 3, -3.8, 5.6, -1.8, 6, 0, 5.6, 1.8, 3, 3.8, -1, 3.6, -2.4, 0]); // helmet
    for (const s of [-1, 1]) p.poly(pts([-14, 6.2, -8, 7.2, -8, 9.6, -14, 8.6], 1, s)).fill(0xeeeeee);
    p.rect(8, -3.6, 3, 7.2).fill(0xeeeeee);
    g.rect(18, -0.6, 25, 1.2).fill(0xffffff); // rail charge
    for (let x = 20; x < 40; x += 5) g.rect(x + 0.6, -3, 0.8, 6).fill({ color: 0xffffff, alpha: 0.8 });
    g.circle(18.2, -6.4, 1.2).fill(0xffffff); // scope lens
    g.poly([6, -2, 8.2, -0.6, 8.2, 0.6, 6, 2]).fill(0xffffff); // visor
    for (let i = 0; i < 7; i += 2) {
      const x = -19 + (i % 3) * 6 + (((i / 3) | 0) % 2) * 3, y = -5.5 + ((i / 3) | 0) * 5.5;
      g.poly(hexPts(x, y, 2.4)).stroke({ width: 0.5, color: 0xffffff, alpha: 0.6 });
    }
  };
}

function atSoldier(): DrawFn {
  // heavy exo with a shoulder-mounted twin-tube plasma launcher
  return ({ b, p, g }) => {
    plate(b, cham(-18, -9, 10, 18, 3), cham(-16.5, -7, 7, 14, 2)); // pack
    for (const y of [-6, 2.4]) b.poly(cham(-21.5, y, 4.5, 4, 1)).fill(0x7a6436).stroke(EDGE); // spare rockets
    plate(b, pts([-9, 6, 3, 6, 7, 9.5, 5, 14, -5, 14.5, -11, 10.5]), pts([-7, 8, 2, 8, 4.6, 10.4, 3, 12.6, -4, 12.8, -8.6, 10.2]));
    plate(b, [-12, -8.5, 0, -10, 7, -6, 8, 0, 7, 6, 0, 10, -12, 8.5, -14, 0], [-10, -6.5, 0, -8, 5, -4.6, 5.6, 0, 5, 4.6, 0, 8, -10, 6.5, -11.6, 0]);
    b.moveTo(-4, -7.6).lineTo(-4, 7.6).stroke(PANEL);
    // launcher across the left shoulder
    b.poly([-14, -16, 22, -16, 26, -13.5, 26, -5.5, 22, -3, -14, -3, -16, -9.5]).fill(darkMetal()).stroke(OUT);
    b.poly([-12, -14.4, 21, -14.4, 24, -12.6, 24, -6.4, 21, -4.6, -12, -4.6]).fill(metal()).stroke(EDGE);
    b.moveTo(-12, -9.5).lineTo(24, -9.5).stroke(PANEL);
    b.poly([-14, -14, -19, -16.5, -19, -2.5, -14, -5]).fill(0x1b1f26).stroke(EDGE); // exhaust flare
    for (const y of [-12.4, -6.6]) b.circle(26, y, 2.4).fill(0x14181f).stroke(EDGE); // tube mouths
    b.poly(cham(8, -20, 9, 4.4, 1.2)).fill(0x3a414d).stroke(EDGE); // targeting optic
    b.poly([2, 7.5, 8, 8, 9, 3, 4, 2]).fill(0x3a414d).stroke(EDGE); // free arm
    plate(b, [-4.5, -6, 2, -6.5, 6.5, -3.4, 7.8, 0, 6.5, 3.4, 2, 6.5, -4.5, 6, -6.5, 0], [-3.4, -4.4, 1.6, -4.8, 4.6, -2.4, 5, 0, 4.6, 2.4, 1.6, 4.8, -3.4, 4.4, -4.8, 0]);
    p.poly([-4, 8.6, 1.4, 8.6, -0.6, 12.6, -6, 12.6]).fill(0xeeeeee);
    p.poly([2, -14.4, 8, -14.4, 6, -4.6, 0, -4.6]).fill(0xeeeeee);
    p.poly([-2.4, -4.5, -0.6, -4.7, -0.6, 4.7, -2.4, 4.5]).fill(0xeeeeee);
    g.poly([5, -2.8, 7.6, -0.9, 7.6, 0.9, 5, 2.8, 5.8, 0]).fill(0xffffff);
    for (const y of [-12.4, -6.6]) g.circle(26, y, 1.2).fill(0xffffff); // warheads
    g.circle(17.5, -17.8, 1.1).fill(0xffffff);
    g.rect(10, -10, 11, 1).fill(0xffffff);
    g.poly(hexPts(-7, 0, 1.6)).fill(0xffffff);
  };
}

function flamer(): DrawFn {
  // heavy plasma-thrower: twin pressurised fuel cylinders, braided hose, shrouded lance
  return ({ b, p, g }) => {
    for (const y of [-9.5, 1.5]) {
      b.roundRect(-24, y, 15, 8, 4).fill(0x4a2216).stroke(OUT);
      b.roundRect(-22.5, y + 1.4, 12, 3, 1.5).fill({ color: 0xb06a4a, alpha: 0.5 });
      b.rect(-25.5, y + 2.5, 2, 3).fill(0x2a303b);
    }
    for (const s of [-1, 1]) plate(b, pts([-9, 6, 3, 6, 7, 9.5, 5, 14.5, -5, 15, -11, 11], 1, s), pts([-7, 8, 2, 8, 4.6, 10.6, 3, 13, -4, 13.2, -8.6, 10.6], 1, s));
    plate(b, [-12, -9, 0, -10.5, 7.5, -6, 8.5, 0, 7.5, 6, 0, 10.5, -12, 9, -14, 0], [-10, -7, 0, -8.5, 5.5, -4.6, 6, 0, 5.5, 4.6, 0, 8.5, -10, 7, -11.6, 0]);
    b.moveTo(-10, -6.6).lineTo(0, -8).stroke(HI);
    b.moveTo(-12, 3).bezierCurveTo(-6, 13, 2, 11, 6, 6).stroke({ width: 2.2, color: 0x1b1f26 }); // hose
    b.moveTo(-12, 3).bezierCurveTo(-6, 13, 2, 11, 6, 6).stroke({ width: 0.8, color: 0x4a5262 });
    b.poly([3, 1.8, 22, 2.2, 22, 6.8, 3, 7.2]).fill(darkMetal()).stroke(EDGE); // lance
    b.poly([21, 0.6, 28, 1.6, 29, 4.5, 28, 7.4, 21, 8.4]).fill(0x2a303b).stroke(OUT); // nozzle shroud
    for (let x = 8; x < 20; x += 3.4) b.rect(x, 1.8, 1.2, 5.4).fill(0x14181f);
    b.poly([1, -8, 6, -7, 13, 0, 11, 2, 4, -3]).fill(0x3a414d).stroke(EDGE);
    plate(b, [-4.5, -6, 2, -6.5, 6.5, -3.4, 7.8, 0, 6.5, 3.4, 2, 6.5, -4.5, 6, -6.5, 0], [-3.4, -4.4, 1.6, -4.8, 4.6, -2.4, 5, 0, 4.6, 2.4, 1.6, 4.8, -3.4, 4.4, -4.8, 0]);
    for (const s of [-1, 1]) p.poly(pts([-4, 8.6, 1.4, 8.6, -0.6, 13, -6, 13], 1, s)).fill(0xeeeeee);
    p.rect(-18, -9.5, 2.4, 19).fill({ color: 0xeeeeee, alpha: 0.85 });
    g.poly([5, -2.8, 7.6, -0.9, 7.6, 0.9, 5, 2.8, 5.8, 0]).fill(0xffffff);
    for (const y of [-9.5, 1.5]) g.rect(-21, y + 6, 9, 1).fill(0xffffff); // fuel gauges
    g.circle(29.4, 4.5, 1.8).fill(0xffffff); // pilot flame
    g.rect(9, 4, 11, 1).fill(0xffffff);
    g.poly(hexPts(-7, 0, 1.6)).fill(0xffffff);
  };
}

function drone(): DrawFn {
  // loitering munition: delta wing, canards, glowing shaped-charge nose, rear pusher prop (separate sprite)
  return ({ b, p, g }) => {
    const wing = [10, 0, -4, -6, -12, -18, -17, -18, -14, -5, -16, 0, -14, 5, -17, 18, -12, 18, -4, 6];
    b.poly(wing).fill(darkMetal()).stroke(OUT);
    b.poly([7, 0, -4, -4, -10, -15, -13.5, -15, -11.5, -4, -11.5, 4, -13.5, 15, -10, 15, -4, 4]).fill(metal()).stroke(EDGE);
    for (const s of [-1, 1]) b.poly(pts([-15.5, 14, -11, 13, -10, 19, -15, 20], 1, s)).fill(0x2a303b).stroke(EDGE); // winglets
    b.poly([20, 0, 14, -3.4, -12, -3.4, -14, 0, -12, 3.4, 14, 3.4]).fill(darkMetal()).stroke(OUT); // fuselage
    b.poly([18, 0, 13, -2, 2, -2, 2, 2, 13, 2]).fill(0x3a2a1c).stroke(EDGE); // warhead
    for (const s of [-1, 1]) b.poly(pts([8, 3, 12, 3, 9, 8, 6, 8], 1, s)).fill(0x3a414d).stroke(EDGE); // canards
    b.moveTo(-4, -5.5).lineTo(-11, -16).stroke(HI);
    b.rect(-15, -2.2, 3, 4.4).fill(0x14181f); // prop hub mount
    for (const s of [-1, 1]) p.poly(pts([-6, 6.5, -3.6, 6, -8.6, 14, -11, 14], 1, s)).fill(0xeeeeee);
    p.rect(-6, -3.4, 3, 6.8).fill(0xeeeeee);
    g.poly([20, 0, 15, -2.2, 15, 2.2]).fill(0xffffff);
    g.rect(3, -0.6, 10, 1.2).fill(0xffffff);
    for (const s of [-1, 1]) g.circle(-16, s * 18.4, 1.2).fill(0xffffff); // wingtip lights
  };
}

function droneRotor(): DrawFn {
  return ({ b }) => {
    b.circle(0, 0, 8).fill({ color: 0xc8d2e0, alpha: 0.16 });
    b.circle(0, 0, 8).stroke({ width: 0.6, color: 0xc8d2e0, alpha: 0.3 });
    b.poly([-1, -8, 1, -8, 1.4, 8, -1.4, 8]).fill({ color: 0x1d222b, alpha: 0.9 });
    b.circle(0, 0, 1.8).fill(0x8d98ab);
  };
}

function jeepBody(): DrawFn {
  // armoured strike buggy: knobbly wheels, wedge hood, slanted canopy, roll cage, rear spare
  return ({ b, p, g }) => {
    for (const [x, y] of [[-14, -16], [14, -16], [-14, 16], [14, 16]]) {
      b.roundRect(x - 7, y - 4.5, 14, 9, 2.5).fill(0x14171c).stroke(OUT);
      for (let k = -5; k <= 5; k += 2.5) b.rect(x + k - 0.6, y - 4, 1.2, 8).fill(0x2c313a);
      b.circle(x, y, 2).fill(0x4a5262);
    }
    b.poly([-25, -10, -18, -14, 16, -14, 27, -8, 29, 0, 27, 8, 16, 14, -18, 14, -25, 10]).fill(darkMetal()).stroke(OUT);
    b.poly([-22, -8, -16, -11.6, 14, -11.6, 24, -6.4, 25.6, 0, 24, 6.4, 14, 11.6, -16, 11.6, -22, 8]).fill(metal()).stroke(EDGE);
    b.moveTo(14, -11.6).lineTo(18, 0).lineTo(14, 11.6).stroke(PANEL); // hood crease
    b.moveTo(-16, -11).lineTo(13, -11).stroke(HI);
    for (let y = -5; y <= 5; y += 2.5) b.rect(20, y - 0.5, 4, 1).fill(0x0e1116); // grille
    b.poly([5, -10, 13, -8, 13, 8, 5, 10]).fill(glass()).stroke(EDGE); // windshield
    b.poly([5, -10, 13, -8, 12, -6, 6, -7.5]).fill({ color: 0xffffff, alpha: 0.18 });
    b.moveTo(-14, -10.5).lineTo(4, -10.5).moveTo(-14, 10.5).lineTo(4, 10.5).moveTo(-14, -10.5).lineTo(-14, 10.5).moveTo(-5, -10.5).lineTo(-5, 10.5).stroke({ width: 1.8, color: 0x1b1f26 });
    b.circle(-27, 0, 5.5).fill(0x14171c).stroke(OUT); // spare wheel
    b.circle(-27, 0, 2).fill(0x4a5262);
    for (const s of [-1, 1]) b.poly(pts([-22, 9, -16, 9, -16, 12, -22, 12], 1, s)).fill(0x2a303b);
    p.poly([16, -11.6, 23, -7, 20, -4, 15, -7]).fill(0xeeeeee);
    p.poly([16, 11.6, 23, 7, 20, 4, 15, 7]).fill(0xeeeeee);
    p.poly([-20, -7, -16, -7, -16, 7, -20, 7]).fill(0xe0e0e0);
    for (const s of [-1, 1]) g.poly(pts([26, 3.6, 28.2, 2.6, 28.2, 6.6, 25.4, 7], 1, s)).fill(0xffffff); // headlights
    for (const s of [-1, 1]) g.rect(-25, s * 8 - 1, 1.4, 2).fill(0xffffff);
  };
}

/** Knobbly off-road wheel seen from above. */
function wheel(b: Graphics, x: number, y: number, w = 14, h = 9) {
  b.roundRect(x - w / 2, y - h / 2, w, h, 2.5).fill(0x14171c).stroke(OUT);
  for (let k = -w / 2 + 2; k <= w / 2 - 2; k += 2.5) b.rect(x + k - 0.6, y - h / 2 + 0.5, 1.2, h - 1).fill(0x2c313a);
  b.circle(x, y, Math.min(w, h) * 0.22).fill(0x4a5262);
}

function aaHull(): DrawFn {
  // hover flak platform: four ducted lift nacelles, armoured deck
  return ({ b, p, g }) => {
    for (const [x, y] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) {
      b.roundRect(x - 9, y - 6, 18, 12, 5).fill(darkMetal()).stroke(OUT);
      b.roundRect(x - 7, y - 4, 14, 8, 3.5).fill(0x14181f).stroke(EDGE);
      for (let k = -5; k <= 5; k += 2.5) b.rect(x + k - 0.5, y - 3.5, 1, 7).fill(0x2c313a);
    }
    plate(b, [-29, -11, -22, -17, 18, -17, 29, -7, 30, 0, 29, 7, 18, 17, -22, 17, -29, 11], [-26, -9, -20, -14.4, 16, -14.4, 26, -5.6, 27, 0, 26, 5.6, 16, 14.4, -20, 14.4, -26, 9]);
    b.moveTo(16, -14.4).lineTo(21, 0).lineTo(16, 14.4).stroke(PANEL);
    b.moveTo(-20, -13.6).lineTo(15, -13.6).stroke(HI);
    for (let x = -25; x < -18; x += 2.2) b.rect(x, -7, 1.1, 14).fill({ color: 0x0e1116, alpha: 0.85 });
    for (const s of [-1, 1]) b.poly(pts([-6, 10, 8, 10, 6, 14.4, -4, 14.4], 1, s)).fill(0x2a303b).stroke(EDGE);
    for (const s of [-1, 1]) p.poly(pts([18, 14.4, 25, 6.4, 22, 4.6, 15, 12], 1, s)).fill(0xeeeeee);
    p.rect(-17, -14.4, 3, 28.8).fill(0xe6e6e6);
    for (const [x, y] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) g.roundRect(x - 6, y - 1, 12, 2, 1).fill(0xffffff);
    g.rect(28.4, -4, 1.4, 8).fill(0xffffff);
  };
}

function aaTurret(): DrawFn {
  // twin-linked flak autocannons either side of an armoured fire-control block
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      for (const o of [-2, 2]) b.rect(8, s * 11 + o - 1.1, 26, 2.2).fill(0x1b1f26).stroke({ width: 0.6, color: 0x0b0e13 });
      b.poly(cham(30, s * 11 - 4, 5, 8, 1.4)).fill(0x2a303b).stroke(EDGE); // muzzle brakes
      plate(b, cham(-8, s * 11 - 6, 20, 12, 2.5), cham(-6, s * 11 - 4, 16, 8, 1.8)); // gun pods
      b.rect(-4, s * 11 - 1, 10, 2).fill(0x14181f);
    }
    plate(b, [-14, -8, -6, -10.5, 8, -10.5, 13, -4, 13, 4, 8, 10.5, -6, 10.5, -14, 8], [-11.6, -6, -5, -8.4, 6.4, -8.4, 10.6, -3, 10.6, 3, 6.4, 8.4, -5, 8.4, -11.6, 6]);
    b.poly(cham(2, -4, 8, 8, 2)).fill(glass()).stroke(EDGE); // fire-control optics
    for (const s of [-1, 1]) p.rect(-6, s * 11 - 4, 4, 8).fill(0xeeeeee);
    p.poly([-11, -5, -7, -5, -7, 5, -11, 5]).fill(0xeeeeee);
    for (const s of [-1, 1]) g.rect(12, s * 11 - 0.4, 18, 0.8).fill(0xffffff);
    g.circle(6, 0, 1.4).fill(0xffffff);
  };
}

function radar(): DrawFn {
  // rotating phased-array panel on a mast
  return ({ b, g }) => {
    b.poly([-4, -14, 3, -12, 3, 12, -4, 14]).fill(darkMetal()).stroke(OUT);
    b.poly([-2.6, -12, 1.6, -10.6, 1.6, 10.6, -2.6, 12]).fill(metal()).stroke(EDGE);
    for (let i = -10; i <= 8; i += 3) b.rect(-2, i, 3.2, 1).fill(0x2a303b);
    b.rect(2, -1.2, 5, 2.4).fill(0x1b1f26).stroke(EDGE);
    g.rect(-0.6, -11, 1.2, 22).fill(0xffffff);
  };
}

function repairDrone(): DrawFn {
  // engineering drone: two ducted fans, twin manipulator arms, nano-repair emitter
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(pts([-8, 4, 0, 4, -2, 9, -6, 9], 1, s)).fill(0x2a303b).stroke(EDGE); // pylons
      b.circle(-4, s * 15, 9).fill({ color: 0x14181f, alpha: 0.45 }).stroke(OUT);
      b.circle(-4, s * 15, 9).stroke({ width: 2.4, color: 0x4a5262 });
      b.circle(-4, s * 15, 9).stroke({ width: 0.8, color: 0x0b0e13 });
    }
    for (const s of [-1, 1]) {
      b.moveTo(10, s * 4).lineTo(19, s * 7).lineTo(25, s * 3).stroke({ width: 2.6, color: 0x1b1f26 }); // arms
      b.moveTo(10, s * 4).lineTo(19, s * 7).lineTo(25, s * 3).stroke({ width: 1.2, color: 0x6d7688 });
      b.circle(19, s * 7, 1.8).fill(0x2a303b).stroke(EDGE);
      b.poly(pts([24, 1.5, 28, 2.5, 27, 5, 23, 4.5], 1, s)).fill(0x3a414d).stroke(EDGE); // claws
    }
    plate(b, [-14, -7, -8, -11, 9, -11, 15, -4, 15, 4, 9, 11, -8, 11, -14, 7], [-11.6, -5.4, -6.6, -8.6, 7.6, -8.6, 12.4, -3, 12.4, 3, 7.6, 8.6, -6.6, 8.6, -11.6, 5.4]);
    b.moveTo(-6.6, -8).lineTo(7.6, -8).stroke(HI);
    b.circle(13.5, 0, 3).fill(0x1b1f26).stroke(EDGE); // emitter
    p.rect(-4.5, -6.5, 5, 13).fill(0xeeeeee);
    p.rect(-8.5, -2.5, 13, 5).fill(0xeeeeee);
    g.circle(13.5, 0, 1.8).fill(0xffffff);
    g.rect(-3, -1, 2, 2).fill(0xffffff);
    for (const s of [-1, 1]) {
      g.circle(-4, s * 15, 9).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
      g.circle(27, s * 3.5, 0.9).fill(0xffffff);
    }
  };
}

function mbtHull(): DrawFn {
  // heavy hull: wedge glacis, reactive-armour skirts, rear engine deck
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(pts([-34, 18, 30, 18, 33, 23, -34, 23], 1, s)).fill(0x2a303b).stroke(OUT); // skirts
      for (let x = -30; x < 28; x += 8) b.poly(pts([x, 18.6, x + 7, 18.6, x + 7, 22.4, x, 22.4], 1, s)).fill(0x3a414d).stroke(EDGE);
    }
    plate(b, [-32, -18, 20, -18, 33, -9, 36, 0, 33, 9, 20, 18, -32, 18, -36, 10, -36, -10], [-29.6, -15.6, 18.4, -15.6, 30, -7.6, 32.6, 0, 30, 7.6, 18.4, 15.6, -29.6, 15.6, -33, 8.4, -33, -8.4]);
    b.poly([20, -15.6, 30, -7.6, 32.6, 0, 30, 7.6, 20, 15.6, 25, 0]).fill(0x4a5262).stroke(EDGE); // glacis
    for (let x = -32; x < -20; x += 2.4) b.rect(x, -11, 1.2, 22).fill({ color: 0x0e1116, alpha: 0.85 }); // engine deck
    b.moveTo(-29, -14.8).lineTo(18, -14.8).stroke(HI);
    b.moveTo(-18, -15.6).lineTo(-18, 15.6).stroke(PANEL);
    for (const s of [-1, 1]) b.poly(cham(-16, s * 11 - 2.5, 8, 5, 1.2)).fill(0x1b1f26).stroke(EDGE); // stowage
    p.poly([-6, -15.6, 2, -15.6, -2, 0, 2, 15.6, -6, 15.6, -10, 0]).fill(0xe8e8e8).stroke(PANEL);
    for (const s of [-1, 1]) p.poly(pts([22, 15.6, 30, 7.6, 27, 6, 20, 12], 1, s)).fill(0xeeeeee);
    for (const s of [-1, 1]) g.rect(32.4, s * 6 - 2, 2, 4).fill(0xffffff);
    g.rect(-35, -8, 1.8, 16).fill(0xffffff);
  };
}

function mbtTurret(): DrawFn {
  // angular composite turret with a long rail cannon, sensor mast and smoke dischargers
  return ({ b, p, g }) => {
    b.poly([12, -4.4, 52, -3.6, 52, 3.6, 12, 4.4]).fill(darkMetal()).stroke(OUT); // barrel
    for (let x = 20; x < 48; x += 6) b.rect(x, -4, 1.4, 8).fill(0x14181f);
    b.poly(cham(50, -6, 10, 12, 2.2)).fill(0x2a303b).stroke(OUT);
    for (const s of [-1, 1]) b.rect(53, s * 3 - 0.7, 6, 1.4).fill(0x0b0e13);
    plate(b, [-22, -16, 4, -18, 19, -10, 22, 0, 19, 10, 4, 18, -22, 16, -26, 7, -26, -7], [-19.6, -13.6, 3.4, -15.4, 16.4, -8.6, 19, 0, 16.4, 8.6, 3.4, 15.4, -19.6, 13.6, -23, 6, -23, -6]);
    b.moveTo(3.4, -15.4).lineTo(11, 0).lineTo(3.4, 15.4).stroke(PANEL);
    b.moveTo(-19.6, -13).lineTo(3.4, -14.8).stroke(HI);
    b.poly(cham(-10, -14, 11, 6, 1.5)).fill(0x1b1f26).stroke(EDGE); // sensor
    b.poly(hexPts(-8, 6, 5)).fill(darkMetal()).stroke(EDGE); // commander hatch
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.circle(14 - i * 3.4, s * 13.6, 1.3).fill(0x1b1f26).stroke({ width: 0.6, color: 0x0b0e13 }); // smoke
    b.rect(-28, -5, 4, 10).fill(0x1b1f26).stroke(EDGE); // bustle
    p.poly([-18, -12, -13, -12, -9, 0, -13, 12, -18, 12, -14, 0]).fill(0xeeeeee);
    g.circle(-1.5, -11, 1.6).fill(0xffffff);
    g.rect(14, -0.6, 36, 1.2).fill(0xffffff);
    g.moveTo(3.4, -15.4).lineTo(11, 0).lineTo(3.4, 15.4).stroke({ width: 0.8, color: 0xffffff, alpha: 0.6 });
  };
}

function mlrsHull(): DrawFn {
  // 6x6 launcher truck: armoured cab at the front, stabiliser jacks at the rear
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) for (const x of [-21, -7, 19]) wheel(b, x, s * 17, 13, 8);
    plate(b, [-33, -14, 11, -14, 11, 14, -33, 14, -35, 9, -35, -9], [-31, -11.6, 9, -11.6, 9, 11.6, -31, 11.6, -32.6, 8, -32.6, -8]); // bed
    for (let x = -28; x < 8; x += 6) b.moveTo(x, -11.6).lineTo(x, 11.6).stroke(PANEL);
    plate(b, [12, -15, 27, -15, 36, -8, 37, 0, 36, 8, 27, 15, 12, 15], [14, -12.6, 26, -12.6, 33.4, -6.6, 34.4, 0, 33.4, 6.6, 26, 12.6, 14, 12.6]); // cab
    b.poly([25, -11, 32, -6, 32, 6, 25, 11]).fill(glass()).stroke(EDGE);
    b.poly([25, -11, 32, -6, 31, -4, 25.6, -8]).fill({ color: 0xffffff, alpha: 0.18 });
    for (const s of [-1, 1]) b.poly(cham(-34, s * 13 - 2.5, 9, 5, 1.2)).fill(0x3a414d).stroke(EDGE); // jacks
    b.moveTo(14, -12).lineTo(25, -12).stroke(HI);
    p.poly([14, -12.6, 19, -12.6, 19, 12.6, 14, 12.6]).fill(0xeeeeee);
    for (const s of [-1, 1]) g.rect(35.6, s * 5 - 2, 1.6, 4).fill(0xffffff);
    for (const s of [-1, 1]) g.rect(-34, s * 13 - 0.6, 3, 1.2).fill(0xffffff);
  };
}

function mlrsPod(): DrawFn {
  // armoured 4x3 rocket launcher box on a turntable
  return ({ b, p, g }) => {
    b.circle(0, 0, 10).fill(0x1b1f26).stroke(OUT);
    plate(b, cham(-15, -14, 36, 28, 3.5), cham(-13, -12, 32, 24, 2.6));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      b.circle(-4 + j * 8.6, -8.5 + i * 5.7, 2.5).fill(0x0a0c10).stroke({ width: 0.8, color: 0x4a5262 });
    }
    b.poly([19, -13, 23, -10, 23, 10, 19, 13]).fill(0x2a303b).stroke(EDGE); // blast lip
    b.rect(-14, -2, 6, 4).fill(0x1b1f26);
    p.rect(-13, -12, 6, 24).fill(0xeeeeee);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.circle(-4 + j * 8.6, -8.5 + i * 5.7, 1).fill(0xffffff);
  };
}

function empHull(): DrawFn {
  // 4x4 capacitor truck with armoured cab and exposed capacitor banks
  return ({ b, p, g }) => {
    for (const [x, y] of [[-17, -17], [17, -17], [-17, 17], [17, 17]]) wheel(b, x, y, 14, 8);
    plate(b, [-30, -12, -24, -15.5, 20, -15.5, 31, -7, 32, 0, 31, 7, 20, 15.5, -24, 15.5, -30, 12], [-27.6, -10, -22.6, -13, 18.6, -13, 28.4, -5.6, 29.4, 0, 28.4, 5.6, 18.6, 13, -22.6, 13, -27.6, 10]);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      b.poly(cham(-25 + i * 8.5, s * 8.6 - 3.4, 7, 6.8, 1.6)).fill(0x14181f).stroke(OUT);
      b.rect(-24 + i * 8.5, s * 8.6 - 2.4, 5, 4.8).fill(0x2a303b);
    }
    b.poly([19, -12, 28, -5.6, 28, 5.6, 19, 12]).fill(glass()).stroke(EDGE);
    b.moveTo(-22, -12.4).lineTo(18, -12.4).stroke(HI);
    b.moveTo(-28, 0).lineTo(-26, 0).stroke(PANEL);
    p.poly([-27.6, -10, -22.6, -13, -21, -13, -21, 13, -22.6, 13, -27.6, 10]).fill(0xeeeeee);
    p.poly([18.6, -13, 22, -13, 22, 13, 18.6, 13]).fill(0xeeeeee);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.rect(-23.4 + i * 8.5, s * 8.6 - 0.5, 3.8, 1).fill(0xffffff);
    g.rect(30.6, -4, 1.4, 8).fill(0xffffff);
  };
}

function empCoil(): DrawFn {
  // tesla emitter: stacked toroid rings over a hex mount, discharge nodes at the corners
  return ({ b, p, g }) => {
    b.poly(hexPts(0, 0, 17)).fill(darkMetal()).stroke(OUT);
    b.poly(hexPts(0, 0, 14)).fill(metal()).stroke(EDGE);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.circle(Math.cos(a) * 14.5, Math.sin(a) * 14.5, 2.2).fill(0x1b1f26).stroke(EDGE);
    }
    b.circle(0, 0, 10.5).fill(0x1b1f26).stroke(OUT);
    b.circle(0, 0, 10.5).stroke({ width: 2.4, color: 0x8d98ab });
    b.circle(0, 0, 6.5).stroke({ width: 2.4, color: 0x6d7688 });
    b.circle(0, 0, 3.5).fill(0x2a303b).stroke(EDGE);
    p.circle(0, 0, 2.2).fill(0xeeeeee);
    g.circle(0, 0, 3).fill(0xffffff);
    g.circle(0, 0, 8.5).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.circle(Math.cos(a) * 14.5, Math.sin(a) * 14.5, 1.1).fill(0xffffff);
    }
  };
}

function robotTorso(): DrawFn {
  // bipedal war robot: armoured V-chest, reactor pack, rail-cannon right arm, hex missile pod left
  return ({ b, p, g }) => {
    plate(b, cham(-40, -16, 16, 32, 4), cham(-38, -13.6, 12, 27.2, 3)); // reactor pack
    for (let i = 0; i < 4; i++) b.rect(-37, -11 + i * 6, 9, 2.4).fill(0x0e1116);
    // right arm rail cannon (y +)
    plate(b, [-2, 15, 44, 16, 54, 19.5, 56, 23.5, 54, 27.5, 44, 31, -2, 32], [0, 17.4, 43, 18.2, 51.6, 21, 53, 23.5, 51.6, 26, 43, 28.8, 0, 29.6]);
    for (const y of [20.4, 25.2]) b.rect(16, y, 36, 1.6).fill(0x14181f);
    for (let x = 18; x < 44; x += 6) b.rect(x, 18.4, 1.4, 10).fill({ color: 0x14181f, alpha: 0.7 });
    b.poly(cham(54, 19, 6, 9, 1.6)).fill(0x1b1f26).stroke(OUT);
    plate(b, cham(-2, 13, 16, 21, 3.5), cham(0, 15, 12, 17, 2.6)); // elbow block
    // left arm hex missile pod (y -)
    plate(b, cham(-8, -36, 34, 19, 4), cham(-6, -34, 30, 15, 3));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.poly(hexPts(4 + i * 5.6, -30.4 + j * 6.6, 2.5)).fill(0x0a0c10).stroke({ width: 0.6, color: 0x4a5262 });
    // shoulders
    for (const s of [-1, 1]) plate(b, pts([-20, 12, 6, 12, 13, 20, 6, 29, -15, 29, -22, 21], 1, s), pts([-17.6, 14.2, 4.6, 14.2, 10.4, 20.4, 4.6, 26.8, -13.6, 26.8, -19.4, 20.6], 1, s));
    // chest
    plate(b, [-29, -19, -18, -23, 10, -23, 27, -10, 33, 0, 27, 10, 10, 23, -18, 23, -29, 19, -33, 0], [-26.4, -16.6, -17, -20.4, 9, -20.4, 24.4, -8.6, 29.6, 0, 24.4, 8.6, 9, 20.4, -17, 20.4, -26.4, 16.6, -30, 0]);
    b.moveTo(-17, -19.6).lineTo(9, -19.6).stroke(HI);
    b.moveTo(9, -20.4).lineTo(19, 0).lineTo(9, 20.4).stroke(PANEL);
    b.moveTo(-20, -18).lineTo(-20, 18).stroke(PANEL);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.rect(-4 + i * 4, s * 15 - 1, 2.4, 2).fill(0x14181f); // vents
    b.poly([13, -10, 31, -4.5, 31, 4.5, 13, 10, 16.5, 0]).fill(glass()).stroke(OUT); // head / visor
    b.poly([15, -8, 25, -5, 24, -3.4, 16.4, -5.6]).fill({ color: 0xffffff, alpha: 0.2 });
    b.poly(hexPts(-7, 0, 9.5)).fill(0x14181f).stroke(OUT);
    b.poly(hexPts(-7, 0, 7)).stroke({ width: 1.2, color: 0x4a5262 });
    // paint
    p.poly([-26.4, -16.6, -21, -18.8, -21, 18.8, -26.4, 16.6, -30, 0]).fill(0xeeeeee).stroke(PANEL);
    for (const s of [-1, 1]) p.poly(pts([-13.6, 22.6, 4, 22.6, 7.4, 26.8, -11, 26.8], 1, s)).fill(0xeeeeee);
    p.rect(34, 18.2, 6, 10.6).fill(0xeeeeee);
    // neon
    g.poly(hexPts(-7, 0, 5)).fill(0xffffff);
    g.poly([15, -7.4, 29.6, -3, 29.6, 3, 15, 7.4]).stroke({ width: 1.3, color: 0xffffff });
    g.rect(17, 22.8, 36, 1.4).fill(0xffffff); // rail charge
    g.moveTo(9, -20.4).lineTo(19, 0).lineTo(9, 20.4).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
    for (let i = 0; i < 4; i++) g.circle(4 + i * 5.6, -30.4, 1).fill(0xffffff);
    g.rect(-38.6, -7, 2, 14).fill(0xffffff);
  };
}

function hoverBody(): DrawFn {
  // assault hovercraft: segmented skirt, armoured deck, twin ducted thrust fans, rocket pods, nose gun
  return ({ b, p, g }) => {
    const skirt = [-46, -22, -37, -30, 30, -30, 49, -13, 54, 0, 49, 13, 30, 30, -37, 30, -46, 22];
    b.poly(skirt).fill(0x15181d).stroke(OUT);
    for (let x = -34; x < 30; x += 6) for (const s of [-1, 1]) b.rect(x, s > 0 ? 26 : -30, 1, 4).fill(0x2c313a);
    plate(b, [-40, -18, -31, -24, 26, -24, 42, -11, 46, 0, 42, 11, 26, 24, -31, 24, -40, 18], [-37.4, -16, -29.6, -21.4, 24.6, -21.4, 39.4, -9.6, 43, 0, 39.4, 9.6, 24.6, 21.4, -29.6, 21.4, -37.4, 16]);
    for (const s of [-1, 1]) {
      b.circle(-31, s * 13, 11.5).fill(darkMetal()).stroke(OUT); // fan ducts
      b.circle(-31, s * 13, 8.6).fill(0x0e1116).stroke(EDGE);
      for (let k = -6; k <= 6; k += 3) b.rect(-31 + k - 0.4, s * 13 - 8, 0.8, 16).fill({ color: 0x2c313a, alpha: 0.8 });
    }
    plate(b, cham(2, -11, 25, 22, 4.5), cham(4.4, -8.6, 20.2, 17.2, 3.4)); // superstructure
    b.poly([18, -7, 27, -4, 27, 4, 18, 7]).fill(glass()).stroke(EDGE);
    b.poly([42, -3.4, 60, -2.4, 60, 2.4, 42, 3.4]).fill(0x1b1f26).stroke(OUT); // nose gun
    b.poly(cham(58, -3.6, 4, 7.2, 1.2)).fill(0x2a303b).stroke(EDGE);
    for (const s of [-1, 1]) {
      plate(b, cham(-14, s * 16 - 4, 20, 8, 2), cham(-12.6, s * 16 - 2.8, 17.2, 5.6, 1.4)); // rocket pods
      for (let i = 0; i < 3; i++) b.circle(3 - i * 0.1, s * 16 - 2 + i * 2, 0.9).fill(0x0a0c10);
    }
    b.moveTo(-29.6, -20.6).lineTo(24, -20.6).stroke(HI);
    p.poly([-12, -21.4, -4, -21.4, -4, 21.4, -12, 21.4]).fill(0xe8e8e8).stroke(PANEL);
    for (const s of [-1, 1]) p.poly(pts([28, 21.4, 39.4, 9.6, 35.6, 8, 26, 17.6], 1, s)).fill(0xeeeeee);
    g.poly(skirt).stroke({ width: 1.2, color: 0xffffff, alpha: 0.55 });
    g.poly([19, -5, 26, -3, 26, 3, 19, 5]).stroke({ width: 1, color: 0xffffff });
    for (const s of [-1, 1]) g.circle(-31, s * 13, 11.5).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
    g.rect(44, -0.5, 14, 1).fill(0xffffff);
  };
}

function mobileHull(): DrawFn {
  // super-heavy tracked fortress hull carrying three turrets
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(pts([-62, 36, 62, 36, 68, 44, -62, 44], 1, s)).fill(0x2a303b).stroke(OUT); // side skirts
      for (let i = 0; i < 8; i++) b.poly(pts([-58 + i * 15, 37, -46 + i * 15, 37, -46 + i * 15, 43, -58 + i * 15, 43], 1, s)).fill(0x3a414d).stroke(EDGE);
    }
    plate(b, [-62, -34, -50, -40, 52, -40, 70, -22, 74, 0, 70, 22, 52, 40, -50, 40, -62, 34, -66, 0], [-59, -31.6, -48.6, -36.6, 50.6, -36.6, 66.4, -20.6, 70, 0, 66.4, 20.6, 50.6, 36.6, -48.6, 36.6, -59, 31.6, -62.6, 0]);
    b.poly([-48, -28, 44, -28, 58, -14, 58, 14, 44, 28, -48, 28, -54, 0]).fill(darkMetal()).stroke(OUT); // armoured deck
    b.moveTo(52, -36.6).lineTo(60, 0).lineTo(52, 36.6).stroke(PANEL);
    for (const [x, y] of [[38, 0], [-6, -16], [-6, 16]]) {
      b.poly(hexPts(x, y, 16)).fill(0x1b1f26).stroke(OUT); // turret rings
      b.poly(hexPts(x, y, 13)).stroke({ width: 1, color: 0x4a5262 });
    }
    for (let x = -60; x < -50; x += 2.4) b.rect(x, -22, 1.2, 44).fill({ color: 0x0e1116, alpha: 0.85 }); // engine grille
    for (const s of [-1, 1]) b.poly(cham(-46, s * 14 - 5, 14, 10, 2)).fill(0x2a303b).stroke(EDGE); // exhaust stacks
    b.moveTo(-48.6, -35.8).lineTo(50, -35.8).stroke(HI);
    b.moveTo(18, -28).lineTo(18, 28).stroke(PANEL);
    p.poly([-59, -31.6, -48.6, -36.6, -40, -36.6, -40, 36.6, -48.6, 36.6, -59, 31.6, -62.6, 0]).fill(0xe6e6e6).stroke(PANEL);
    for (const s of [-1, 1]) p.poly(pts([52, 36.6, 66.4, 20.6, 61, 19, 48, 32], 1, s)).fill(0xeeeeee);
    g.poly([-48, -28, 44, -28, 58, -14, 58, 14, 44, 28, -48, 28, -54, 0]).stroke({ width: 1.2, color: 0xffffff, alpha: 0.6 });
    g.rect(72, -10, 2, 20).fill(0xffffff);
    for (const s of [-1, 1]) g.rect(-44, s * 14 - 1, 10, 2).fill(0xffffff);
    for (const [x, y] of [[38, 0], [-6, -16], [-6, 16]]) g.poly(hexPts(x, y, 16)).stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
  };
}

function jeepGun(): DrawFn {
  // ring-mounted rotary machine gun with ammo drum and angled shield
  return ({ b, p, g }) => {
    b.circle(0, 0, 7.5).fill(0x1b1f26).stroke(OUT); // turret ring
    b.poly([3, -1.8, 24, -1.8, 24, 1.8, 3, 1.8]).fill(0x1b1f26).stroke(EDGE);
    for (const y of [-1, 1]) b.rect(5, y - 0.4, 19, 0.8).fill(0x3a414d);
    b.poly(cham(22, -2.8, 4.5, 5.6, 1.2)).fill(0x2a303b).stroke(EDGE);
    b.poly(cham(-5, -5, 11, 10, 2.5)).fill(darkMetal()).stroke(OUT);
    b.roundRect(-3, 4, 7, 5, 2).fill(0x5a4a2a).stroke(EDGE); // ammo drum
    b.poly([5, -9, 9, -7, 9, 7, 5, 9, 3.6, 0]).fill(metal()).stroke(OUT); // shield
    p.poly([5.6, -7.6, 8, -6.2, 8, -2, 5.6, -2]).fill(0xeeeeee);
    p.rect(-4, -2, 4, 4).fill(0xeeeeee);
    g.rect(10, -0.4, 13, 0.8).fill(0xffffff);
    g.circle(1, -2.5, 0.9).fill(0xffffff);
  };
}

// All units face +X (right). Origin = rotation centre.




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










function hullTracks(len: number, wid: number): DrawFn {
  return ({ b }) => {
    for (const y of [-wid / 2, wid / 2 - 14]) {
      b.roundRect(-len / 2, y, len, 14, 5).fill(0x16191e).stroke(OUT);
      for (let x = -len / 2 + 3; x < len / 2 - 3; x += 5) b.rect(x, y + 1, 2.2, 12).fill(0x343943);
      const n = Math.round(len / 14);
      for (let i = 0; i < n; i++) b.circle(-len / 2 + 7 + (i * (len - 14)) / (n - 1), y + 7, 3.2).fill({ color: 0x5c6575, alpha: 0.55 }).stroke({ width: 0.6, color: 0x0b0e13, alpha: 0.6 });
    }
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

function depot(): DrawFn {
  // cluster of explosive fuel drums (industrial terrain hazard)
  return ({ b, g }) => {
    for (const [x, y] of [[-12, -10], [10, -12], [-14, 10], [8, 9], [0, -1]]) {
      b.circle(x + 3, y + 4, 10).fill({ color: 0x000000, alpha: 0.35 });
      b.circle(x, y, 10).fill(0xb8321e).stroke({ width: 1.4, color: 0x2a0c06 });
      b.circle(x, y, 6.5).stroke({ width: 1.2, color: 0x6a1a10 });
      b.circle(x - 2.5, y - 2.5, 2.2).fill({ color: 0xffffff, alpha: 0.35 });
      b.poly([x - 3, y + 3, x, y - 3, x + 3, y + 3]).fill(0xffd34d);
      g.circle(x, y, 1).fill(0xffffff);
    }
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
  depot: PartTex;
  dragonHead: PartTex;
  dragonSeg: PartTex;
  dragonWing: PartTex;
}

export function makeUnitArt(renderer: Renderer): UnitArt {
  R = renderer;
  return {
    infantry: part(68, infantry(), 3),
    drone: part(48, drone(), 3),
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
    sniper: part(100, sniper(), 3),
    atSoldier: part(68, atSoldier(), 3),
    flamer: part(68, flamer(), 3),
    aaHull: part(80, aaHull(), 4),
    aaTurret: part(64, aaTurret(), 4),
    radar: part(32, radar(), 3),
    robotTorso: part(128, robotTorso(), 5),
    bomber: part(150, bomber(), 5),
    crate: part(48, crate(), 4),
    parachute: part(80, parachute()),
    capturePad: part(160, capturePad(), 6),
    jeepBody: part(76, jeepBody(), 3),
    jeepGun: part(56, jeepGun(), 3),
    repairDrone: part(68, repairDrone(), 3),
    mbtTracks: part(100, hullTracks(76, 56)),
    mbtHull: part(104, mbtHull(), 4),
    mbtTurret: part(136, mbtTurret(), 4),
    mlrsHull: part(88, mlrsHull(), 4),
    mlrsPod: part(60, mlrsPod(), 3),
    empHull: part(80, empHull(), 4),
    empCoil: part(48, empCoil(), 5),
    hoverBody: part(132, hoverBody(), 5),
    mobileTracks: part(176, hullTracks(140, 100)),
    mobileHull: part(184, mobileHull(), 6),
    carrier: part(240, carrier(), 7),
    stormBase: part(150, stormBase(), 6),
    stormSpire: part(64, stormSpire(), 6),
    satellite: part(128, satellite(), 5),
    depot: part(56, depot(), 3),
    dragonHead: part(100, dragonHead(), 5),
    dragonSeg: part(56, dragonSeg(), 4),
    dragonWing: part(160, dragonWing(), 5),
  };
}
