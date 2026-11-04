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

/** Scale + offset a flat point list. */
const inset = (a: number[], k: number, cx = 0, cy = 0) => a.map((v, i) => (i % 2 ? cy + (v - cy) * k : cx + (v - cx) * k));

function titanLeg(): DrawFn {
  // armoured digitigrade foot: toe claws, ankle actuator, layered shin plates
  return ({ b, p, g }) => {
    for (const y of [-11, 0, 11]) {
      b.poly([28, y - 4, 42, y - 2, 46, y, 42, y + 2, 28, y + 4]).fill(darkMetal()).stroke(OUT); // claws
      b.rect(30, y - 1, 8, 2).fill(0x14181f);
    }
    const foot = [-24, -10, -15, -15, 26, -15, 33, -8, 33, 8, 26, 15, -15, 15, -24, 10];
    plate(b, foot, inset(foot, 0.86, 3));
    plate(b, [-12, -10, 12, -10, 19, -4.5, 19, 4.5, 12, 10, -12, 10, -15, 0], [-10, -8, 11, -8, 16.6, -3.6, 16.6, 3.6, 11, 8, -10, 8, -12.6, 0]);
    b.moveTo(-10, -7.2).lineTo(11, -7.2).stroke(HI);
    b.circle(0, 0, 7).fill(0x14181f).stroke(OUT);
    b.circle(0, 0, 4.6).stroke({ width: 1.2, color: 0x4a5262 });
    for (const s of [-1, 1]) b.rect(-20, s * 9 - 1.5, 6, 3).fill(0x14181f);
    p.poly([8, -8, 13, -8, 13, 8, 8, 8]).fill(0xeeeeee);
    p.poly([-21, -8.4, -17, -11.6, -17, 11.6, -21, 8.4]).fill(0xe0e0e0);
    g.circle(0, 0, 2.8).fill(0xffffff);
    g.rect(20, -1, 9, 2).fill(0xffffff);
    for (const y of [-11, 0, 11]) g.rect(39, y - 0.5, 5, 1).fill(0xffffff);
  };
}

function titanTorso(): DrawFn {
  return ({ b, p, g }) => {
    // back thruster packs
    for (const s of [-1, 1]) {
      const y0 = s > 0 ? 7 : -33;
      plate(b, cham(-68, y0, 24, 26, 5), cham(-66, y0 + 2, 20, 22, 4));
      for (let i = 0; i < 3; i++) b.rect(-66, y0 + 5 + i * 6.5, 7, 3).fill(0x0e1116);
      b.circle(-70, y0 + 13, 4).fill(0x14181f).stroke(OUT);
    }
    // shoulder rail cannons
    for (const s of [-1, 1]) {
      plate(b, pts([4, 51, 72, 53, 80, 58, 72, 63, 4, 65], 1, s), pts([7, 53.4, 70.6, 55, 76.4, 58, 70.6, 61, 7, 62.6], 1, s));
      for (const o of [-2.6, 1.2]) b.rect(26, s * 58 + o - 0.2, 46, 1.6).fill(0x14181f);
      for (let x = 30; x < 70; x += 7) b.rect(x, s * 58 - 5, 1.6, 10).fill({ color: 0x14181f, alpha: 0.65 });
      b.poly(cham(78, s * 58 - 5, 6, 10, 1.8)).fill(0x1b1f26).stroke(OUT);
      plate(b, cham(12, s * 58 - 11, 16, 22, 3.5), cham(14, s * 58 - 9, 12, 18, 2.6));
    }
    // arm gatlings
    for (const s of [-1, 1]) {
      plate(b, cham(6, s * 36 - 8, 50, 16, 4), cham(8.4, s * 36 - 5.6, 45.2, 11.2, 3));
      for (let i = -1; i <= 1; i++) b.rect(54, s * 36 + i * 3.4 - 1.1, 22, 2.2).fill(0x1b1f26).stroke({ width: 0.5, color: 0x0b0e13 });
      b.circle(54, s * 36, 6.5).fill({ color: 0x14181f, alpha: 0.6 }).stroke({ width: 1.6, color: 0x4a5262 });
      b.poly(cham(20, s * 36 - 4, 10, 8, 2)).fill(0x5a4a2a).stroke(EDGE); // ammo feed
    }
    // shoulder pads
    const pad = [-34, -42, 20, -46, 36, -58, 34, -74, 22, -83, -16, -83, -38, -64];
    plate(b, pad, inset(pad, 0.86, 0, -63));
    plate(b, mirrorY(pad), mirrorY(inset(pad, 0.86, 0, -63)));
    for (const s of [-1, 1]) b.moveTo(-14, s * 80).lineTo(20, s * 80).stroke(HI);
    // chest
    const chest = [-44, -36, -30, -47, 14, -49, 42, -30, 53, 0, 42, 30, 14, 49, -30, 47, -44, 36, -53, 0];
    plate(b, chest, inset(chest, 0.9));
    b.moveTo(-27, -42).lineTo(13, -44).stroke(HI);
    b.moveTo(13, -44).lineTo(28, 0).lineTo(13, 44).stroke(PANEL);
    b.moveTo(-24, -42).lineTo(-24, 42).stroke(PANEL);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) b.rect(-2 + i * 5, s * 34 - 1.5, 3, 3).fill(0x14181f); // vents
    b.poly([24, -17, 49, -7, 49, 7, 24, 17, 29, 0]).fill(glass()).stroke(OUT); // visor
    b.poly([27, -14, 40, -9, 39, -6.6, 28.6, -10]).fill({ color: 0xffffff, alpha: 0.2 });
    b.poly(hexPts(-8, 0, 18)).fill(0x14181f).stroke(OUT); // reactor
    b.poly(hexPts(-8, 0, 13)).stroke({ width: 2, color: 0x4a5262 });
    // team paint
    const pp = [-12, -52, 10, -52, 28, -62, 26, -74, -8, -76];
    p.poly(pp).fill(0xeeeeee).stroke(PANEL);
    p.poly(mirrorY(pp)).fill(0xeeeeee).stroke(PANEL);
    p.poly([-48, -9, -32, -11, -32, 11, -48, 9]).fill(0xe0e0e0);
    for (const s of [-1, 1]) p.poly(pts([16, 40, 36, 27, 31, 23.6, 14, 34], 1, s)).fill(0xeeeeee);
    // neon
    g.poly(hexPts(-8, 0, 8)).fill(0xffffff);
    g.poly([27, -14, 47, -6, 47, 6, 27, 14]).stroke({ width: 1.5, color: 0xffffff });
    g.moveTo(13, -44).lineTo(28, 0).lineTo(13, 44).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
    for (const s of [-1, 1]) {
      g.rect(28, s * 58 - 0.6, 46, 1.2).fill(0xffffff);
      g.circle(-70, s > 0 ? 20 : -20, 2).fill(0xffffff);
      g.poly(pts([22, -80, 34, -72, 34, -60], 1, s)).stroke({ width: 1.2, color: 0xffffff });
      g.circle(54, s * 36, 2).fill(0xffffff);
    }
  };
}

function carrier(): DrawFn {
  // airborne drone carrier: armoured hull, flight deck with launch lanes, command island, four lift nacelles
  return ({ b, p, g }) => {
    for (const [x, y] of [[-50, -46], [-50, 46], [40, -46], [40, 46]]) {
      b.moveTo(x > 0 ? x - 16 : x + 16, y > 0 ? y - 14 : y + 14).lineTo(x > 0 ? 20 : -30, y > 0 ? 22 : -22).stroke({ width: 8, color: 0x0b0e13 });
      b.moveTo(x > 0 ? x - 16 : x + 16, y > 0 ? y - 14 : y + 14).lineTo(x > 0 ? 20 : -30, y > 0 ? 22 : -22).stroke({ width: 5, color: 0x4a5262 });
      b.circle(x, y, 21).fill(darkMetal()).stroke(OUT);
      b.circle(x, y, 16).fill(0x0e1116).stroke(EDGE);
      for (let k = -12; k <= 12; k += 4) b.rect(x + k - 0.5, y - 14, 1, 28).fill({ color: 0x2c313a, alpha: 0.8 });
    }
    const hull = [-92, -26, -81, -37, 70, -37, 101, -16, 110, 0, 101, 16, 70, 37, -81, 37, -92, 26];
    plate(b, hull, inset(hull, 0.92, 5));
    b.poly([-80, -24, 70, -24, 87, -10, 87, 10, 70, 24, -80, 24]).fill(0x1d222b).stroke(OUT); // flight deck
    for (const s of [-1, 1]) for (let x = -72; x < 70; x += 12) b.rect(x, s * 11 - 1, 7, 2).fill(0x8d98ab);
    b.moveTo(-80, 0).lineTo(80, 0).stroke({ width: 0.8, color: 0x8d98ab, alpha: 0.5 });
    plate(b, cham(-22, -38, 44, 12, 3), cham(-20, -36.4, 40, 8.8, 2.4)); // command island
    b.poly([2, -35.6, 18, -35.6, 20, -29, 2, -29]).fill(glass()).stroke(EDGE);
    b.circle(-14, -32, 3).fill(0x14181f).stroke(EDGE); // radar dome
    for (let i = 0; i < 4; i++) b.poly(cham(-70 + i * 16, -7, 10, 14, 2)).fill(0x0e1116).stroke(EDGE); // drone bays
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.circle(30 + i * 14, s * 30, 3).fill(0x14181f).stroke(EDGE); // point-defence turrets
    b.moveTo(-80, -34.6).lineTo(69, -34.6).stroke(HI);
    p.poly([88, -10, 100, -15, 107, 0, 100, 15, 88, 10]).fill(0xeeeeee).stroke(PANEL);
    p.poly([-88, -23.6, -80, -32, -76, -32, -76, 32, -80, 32, -88, 23.6]).fill(0xe6e6e6);
    for (const s of [-1, 1]) for (let x = -72; x < 70; x += 12) g.rect(x, s * 11 - 0.5, 7, 1).fill(0xffffff);
    for (let i = 0; i < 4; i++) g.rect(-67 + i * 16, -1, 4, 2).fill(0xffffff);
    for (const [x, y] of [[-50, -46], [-50, 46], [40, -46], [40, 46]]) g.circle(x, y, 21).stroke({ width: 1.2, color: 0xffffff, alpha: 0.7 });
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.circle(30 + i * 14, s * 30, 1).fill(0xffffff);
    g.circle(108, 0, 2.5).fill(0xffffff);
  };
}

function stormBase(): DrawFn {
  // walking tesla fortress: octagon hull on four armoured feet, capacitor ring
  return ({ b, p, g }) => {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 48, y = Math.sin(a) * 48;
      plate(b, cham(x - 13, y - 13, 26, 26, 6), cham(x - 10.4, y - 10.4, 20.8, 20.8, 4.6));
      b.circle(x, y, 4.5).fill(0x14181f).stroke(EDGE);
      g.circle(x, y, 2.6).fill(0xffffff);
    }
    const oct: number[] = [];
    for (let i = 0; i < 8; i++) oct.push(Math.cos((i / 8) * Math.PI * 2 + Math.PI / 8) * 47, Math.sin((i / 8) * Math.PI * 2 + Math.PI / 8) * 47);
    plate(b, oct, inset(oct, 0.9));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      b.moveTo(Math.cos(a) * 33, Math.sin(a) * 33).lineTo(Math.cos(a) * 42, Math.sin(a) * 42).stroke(PANEL);
    }
    b.circle(0, 0, 32).fill(0x1b1f26).stroke(OUT);
    b.circle(0, 0, 29).stroke({ width: 1, color: 0x4a5262 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.poly(cham(Math.cos(a) * 38 - 3.5, Math.sin(a) * 38 - 3.5, 7, 7, 1.8)).fill(0x14181f).stroke(EDGE);
      p.poly(cham(Math.cos(a) * 38 - 2, Math.sin(a) * 38 - 2, 4, 4, 1)).fill(0xeeeeee);
    }
    b.moveTo(-30, -36).lineTo(14, -44).stroke(HI);
    g.poly(oct).stroke({ width: 1.4, color: 0xffffff, alpha: 0.7 });
    g.circle(0, 0, 32).stroke({ width: 1.4, color: 0xffffff, alpha: 0.6 });
  };
}

function stormSpire(): DrawFn {
  // tesla spire from above: toroid rings over spoked frame, glowing core
  return ({ b, p, g }) => {
    b.circle(0, 0, 27).fill(darkMetal()).stroke(OUT);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.moveTo(Math.cos(a) * 8, Math.sin(a) * 8).lineTo(Math.cos(a) * 26, Math.sin(a) * 26).stroke({ width: 2.4, color: 0x14181f });
      b.circle(Math.cos(a) * 24, Math.sin(a) * 24, 2.4).fill(0x2a303b).stroke(EDGE);
    }
    for (const r of [20, 13.5]) {
      b.circle(0, 0, r).stroke({ width: 4, color: 0x0b0e13 });
      b.circle(0, 0, r).stroke({ width: 2.6, color: 0x8d98ab });
    }
    b.circle(0, 0, 7.5).fill(0x14181f).stroke(OUT);
    p.circle(0, 0, 5.5).fill(0xeeeeee);
    g.circle(0, 0, 6).fill(0xffffff);
    for (const r of [20, 13.5]) g.circle(0, 0, r).stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.circle(Math.cos(a) * 24, Math.sin(a) * 24, 1.1).fill(0xffffff);
    }
  };
}

function satellite(): DrawFn {
  // orbital cannon satellite (portrait / cut-in only)
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      const y0 = s > 0 ? 18 : -60;
      b.rect(-3, s > 0 ? 9 : -18, 6, 9).fill(0x4a5262).stroke(EDGE); // booms
      b.poly(cham(-24, y0, 48, 42, 3)).fill(0x0f1a30).stroke(OUT); // solar wings
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.rect(-22 + i * 11.6, y0 + 2 + j * 13.2, 10.4, 12).fill(0x1a2f55).stroke({ width: 0.6, color: 0x3a5a8a });
    }
    b.poly([12, -7, 48, -5, 54, 0, 48, 5, 12, 7]).fill(darkMetal()).stroke(OUT); // cannon
    for (let i = 0; i < 3; i++) {
      b.circle(24 + i * 8.5, 0, 6).stroke({ width: 3, color: 0x0b0e13 });
      b.circle(24 + i * 8.5, 0, 6).stroke({ width: 1.8, color: 0x8d98ab });
    }
    plate(b, hexPts(0, 0, 17), hexPts(0, 0, 14));
    b.poly(hexPts(0, 0, 8)).fill(0x14181f).stroke(EDGE);
    p.poly([-12, -7, -7, -12, -7, 12, -12, 7]).fill(0xeeeeee);
    g.circle(0, 0, 4).fill(0xffffff);
    g.rect(14, -0.8, 38, 1.6).fill(0xffffff);
    for (let i = 0; i < 3; i++) g.circle(24 + i * 8.5, 0, 6).stroke({ width: 0.8, color: 0xffffff });
    for (const s of [-1, 1]) g.rect(-24, s > 0 ? 59 : -61, 48, 1.4).fill({ color: 0xffffff, alpha: 0.7 });
  };
}

function dragonHead(): DrawFn {
  // mecha dragon head: swept horns, armoured snout, toothed jaw, plasma furnace mouth
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) {
      b.poly(pts([-12, 7, -34, 24, -30, 16, -20, 6], 1, s)).fill(darkMetal()).stroke(OUT); // horns
      b.poly(pts([-4, 12, -18, 22, -12, 12], 1, s)).fill(0x3a414d).stroke(EDGE);
    }
    const head = [-17, -14, 6, -17, 26, -10, 42, -5, 44, 0, 42, 5, 26, 10, 6, 17, -17, 14, -23, 0];
    plate(b, head, inset(head, 0.86, 8));
    b.poly([24, -6.5, 46, -3.5, 49, 0, 46, 3.5, 24, 6.5]).fill(0x14181f).stroke(OUT); // jaw
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.poly(pts([28 + i * 3.6, 5.6, 29.8 + i * 3.6, 2.6, 31.6 + i * 3.6, 5.6], 1, s)).fill(0xc8d2e0);
    b.moveTo(-14, -11).lineTo(24, -8).stroke(HI);
    b.moveTo(6, -14).lineTo(10, 0).lineTo(6, 14).stroke(PANEL);
    for (const s of [-1, 1]) b.poly(pts([10, 6, 21, 7.4, 19, 3.6, 11, 3], 1, s)).fill(0x14181f).stroke(EDGE); // eye sockets
    p.poly([-12, -11, 2, -13, 2, 13, -12, 11, -16, 0]).fill(0xeeeeee).stroke(PANEL);
    for (const s of [-1, 1]) g.poly(pts([12, 5.4, 20, 6.4, 18.6, 4.2, 12.4, 4], 1, s)).fill(0xffffff); // eyes
    g.poly([26, -2, 46, -1, 46, 1, 26, 2]).fill(0xffffff);
  };
}

function dragonSeg(): DrawFn {
  return ({ b, p, g }) => {
    for (const s of [-1, 1]) b.poly(pts([-9, 16, 9, 16, 5, 25, -5, 25], 1, s)).fill(darkMetal()).stroke(OUT); // side fins
    plate(b, hexPts(0, 0, 17.5), hexPts(0, 0, 14.5));
    b.poly(hexPts(0, 0, 9)).fill(0x14181f).stroke(OUT);
    b.moveTo(-8, -12).lineTo(6, -12).stroke(HI);
    p.poly([-13, -8, -8, -12.4, -8, 12.4, -13, 8]).fill(0xeeeeee);
    g.poly(hexPts(0, 0, 4.5)).fill(0xffffff);
    g.poly(hexPts(0, 0, 17.5)).stroke({ width: 0.8, color: 0xffffff, alpha: 0.5 });
  };
}

function dragonWing(): DrawFn {
  // origin at the shoulder, wing spreads toward -Y: armoured spars with energy membranes between
  return ({ b, p, g }) => {
    const tips: [number, number][] = [[-4, -74], [-20, -64], [-27, -44], [-30, -24]];
    b.poly([0, 0, 14, -8, 10, -40, -4, -74, -20, -64, -27, -44, -30, -24, -18, -8]).fill({ color: 0x1a2030, alpha: 0.85 }).stroke(OUT);
    for (const [x, y] of tips) {
      b.moveTo(4, -4).lineTo(x, y).stroke({ width: 4.4, color: 0x0b0e13 });
      b.moveTo(4, -4).lineTo(x, y).stroke({ width: 2.8, color: 0x6d7688 });
      b.circle(x, y, 2.2).fill(0x2a303b).stroke(EDGE);
    }
    plate(b, [0, 0, 14, -8, 12, -40, 2, -52, -2, -12], [2, -3, 11.4, -8.6, 10, -38, 3, -46, 0, -12]); // leading-edge armour
    p.poly([5, -10, 9.6, -36, 4.6, -42, 2, -14]).fill(0xeeeeee);
    for (const [x, y] of tips) g.moveTo(4, -4).lineTo(x, y).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
    for (const [x, y] of tips) g.circle(x, y, 1.2).fill(0xffffff);
  };
}

function fortress(): DrawFn {
  // hex citadel: armoured outer wall with corner gun towers, courtyard with silos and pads, reactor keep
  const hex = (r: number, rot = Math.PI / 6) => {
    const a: number[] = [];
    for (let i = 0; i < 6; i++) a.push(Math.cos((i / 6) * Math.PI * 2 + rot) * r, Math.sin((i / 6) * Math.PI * 2 + rot) * r);
    return a;
  };
  const corner = (i: number, r: number) => {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  return ({ b, p, g }) => {
    // outer wall
    plate(b, hex(136), hex(126));
    b.poly(hex(112)).fill(0x161a21).stroke(OUT); // courtyard floor
    // floor grid clipped to the courtyard hex (pointy top: vertices at (0,+-110) and (+-95,+-55))
    for (let k = -90; k <= 90; k += 18) {
      const ym = 110 - (Math.abs(k) * 55) / 95, xm = Math.abs(k) <= 55 ? 95 : ((110 - Math.abs(k)) * 95) / 55;
      b.moveTo(k, -ym).lineTo(k, ym).stroke({ width: 0.8, color: 0x2a303b, alpha: 0.8 });
      b.moveTo(-xm, k).lineTo(xm, k).stroke({ width: 0.8, color: 0x2a303b, alpha: 0.8 });
    }
    b.poly(hex(112)).stroke({ width: 2, color: 0x0b0e13 });
    // wall armour blocks + walkway
    for (let i = 0; i < 6; i++) {
      const [x0, y0] = corner(i, 119), [x1, y1] = corner(i + 1, 119);
      for (let k = 1; k < 6; k++) {
        const t = k / 6, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const a = Math.atan2(y1 - y0, x1 - x0);
        const c = Math.cos(a), s = Math.sin(a);
        const pt = (u: number, v: number) => [x + c * u - s * v, y + s * u + c * v];
        b.poly([...pt(-8, -6), ...pt(8, -6), ...pt(8, 6), ...pt(-8, 6)]).fill(darkMetal()).stroke(EDGE);
        if (k % 2) p.poly([...pt(-5, -3), ...pt(5, -3), ...pt(5, 3), ...pt(-5, 3)]).fill(0xeeeeee);
      }
      b.moveTo(...(corner(i, 131) as [number, number])).lineTo(...(corner(i + 1, 131) as [number, number])).stroke(HI);
    }
    // courtyard: three missile silos and three vehicle pads
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 82, y = Math.sin(a) * 82;
      if (i % 2 === 0) {
        b.circle(x, y, 13).fill(darkMetal()).stroke(OUT);
        b.circle(x, y, 9).fill(0x14181f).stroke(EDGE);
        b.moveTo(x - 9, y).lineTo(x + 9, y).stroke({ width: 1.2, color: 0x4a5262 });
        g.circle(x, y, 2.4).fill(0xffffff);
        g.circle(x, y, 9).stroke({ width: 0.8, color: 0xffffff, alpha: 0.6 });
      } else {
        b.poly(hexPts(x, y, 14)).fill(0x1d222b).stroke(EDGE);
        b.poly(hexPts(x, y, 14)).stroke({ width: 1.6, color: 0x5a6477, alpha: 0.8 });
        for (let k = 0; k < 3; k++) {
          const ca = a + Math.PI + ((k - 1) * Math.PI) / 3;
          p.circle(x + Math.cos(ca) * 10, y + Math.sin(ca) * 10, 1.6).fill(0xeeeeee);
        }
      }
    }
    // spokes from keep to the wall gates
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      b.moveTo(Math.cos(a) * 60, Math.sin(a) * 60).lineTo(Math.cos(a) * 108, Math.sin(a) * 108).stroke({ width: 7, color: 0x0b0e13 });
      b.moveTo(Math.cos(a) * 60, Math.sin(a) * 60).lineTo(Math.cos(a) * 108, Math.sin(a) * 108).stroke({ width: 4.5, color: 0x3a414d });
      g.moveTo(Math.cos(a) * 62, Math.sin(a) * 62).lineTo(Math.cos(a) * 106, Math.sin(a) * 106).stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
    }
    // corner gun towers
    for (let i = 0; i < 6; i++) {
      const [x, y] = corner(i, 122);
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const c = Math.cos(a), s = Math.sin(a);
      for (const o of [-4, 4]) {
        const px = x - s * o, py = y + c * o;
        b.moveTo(px, py).lineTo(px + c * 30, py + s * 30).stroke({ width: 4.4, color: 0x0b0e13 });
        b.moveTo(px, py).lineTo(px + c * 30, py + s * 30).stroke({ width: 2.6, color: 0x4a5262 });
      }
      plate(b, hexPts(x, y, 19), hexPts(x, y, 15.5));
      b.circle(x, y, 8).fill(0x14181f).stroke(EDGE);
      p.poly(hexPts(x, y, 12)).stroke({ width: 3, color: 0xeeeeee });
      g.circle(x, y, 3.2).fill(0xffffff);
    }
    // central keep + reactor
    plate(b, hex(58), hex(50));
    b.poly(hex(58)).stroke({ width: 2.4, color: 0x0b0e13 });
    for (let i = 0; i < 6; i++) {
      const [x, y] = corner(i, 54);
      b.circle(x, y, 3).fill(0x14181f).stroke(EDGE);
    }
    b.moveTo(...(corner(4, 55) as [number, number])).lineTo(...(corner(5, 55) as [number, number])).stroke(HI);
    b.circle(0, 0, 32).fill(0x0e1116).stroke(OUT);
    b.circle(0, 0, 26).stroke({ width: 3, color: 0x4a5262 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.rect(Math.cos(a) * 29 - 1.5, Math.sin(a) * 29 - 1.5, 3, 3).fill(0x2a303b);
    }
    p.poly(hex(46)).stroke({ width: 5, color: 0xeeeeee });
    g.circle(0, 0, 17).fill(0xffffff);
    g.circle(0, 0, 25).stroke({ width: 2, color: 0xffffff });
    g.poly(hex(126)).stroke({ width: 1.6, color: 0xffffff, alpha: 0.8 });
    g.poly(hex(112)).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
  };
}

function capturePad(kind: 'core' | 'depot' | 'factory'): DrawFn {
  // neutral objective pad with a holo icon for its role
  return ({ b, p, g }) => {
    const hex = hexPts(0, 0, 72);
    plate(b, hex, hexPts(0, 0, 64));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      b.poly(cham(Math.cos(a) * 58 - 6, Math.sin(a) * 58 - 6, 12, 12, 3)).fill(0x14181f).stroke(EDGE);
      p.poly(cham(Math.cos(a) * 58 - 3.5, Math.sin(a) * 58 - 3.5, 7, 7, 2)).fill(0xeeeeee);
    }
    b.circle(0, 0, 46).fill(0x14181f).stroke(OUT);
    b.circle(0, 0, 40).stroke({ width: 2, color: 0x3a414d });
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      b.moveTo(Math.cos(a) * 41, Math.sin(a) * 41).lineTo(Math.cos(a) * 45, Math.sin(a) * 45).stroke({ width: 1, color: 0x5a6477 });
    }
    g.circle(0, 0, 40).stroke({ width: 1.6, color: 0xffffff, alpha: 0.8 });
    // role icon
    if (kind === 'core') {
      const bolt = [4, -24, -12, 4, -1, 4, -5, 24, 12, -4, 1, -4];
      b.poly(bolt).fill(0x2a303b).stroke(OUT);
      g.poly(bolt).fill({ color: 0xffffff, alpha: 0.9 });
    } else if (kind === 'depot') {
      const w = [-6, -22, 6, -22, 6, -6, 22, -6, 22, 6, 6, 6, 6, 22, -6, 22, -6, 6, -22, 6, -22, -6, -6, -6];
      b.poly(w).fill(0x2a303b).stroke(OUT);
      g.poly(w).fill({ color: 0xffffff, alpha: 0.9 });
    } else {
      const gear: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, r = i % 2 ? 17 : 23;
        gear.push(Math.cos(a - 0.1) * r, Math.sin(a - 0.1) * r, Math.cos(a + 0.1) * r, Math.sin(a + 0.1) * r);
      }
      b.poly(gear).fill(0x2a303b).stroke(OUT);
      g.poly(gear).fill({ color: 0xffffff, alpha: 0.9 });
      b.circle(0, 0, 7).fill(0x14181f);
      g.circle(0, 0, 7).fill({ color: 0x000000, alpha: 1 });
    }
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
  capturePad: Record<'core' | 'depot' | 'factory', PartTex>;
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
    titanLeg: part(100, titanLeg(), 5),
    titanTorso: part(204, titanTorso(), 7),
    fortress: part(304, fortress(), 8),
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
    capturePad: { core: part(168, capturePad('core'), 6), depot: part(168, capturePad('depot'), 6), factory: part(168, capturePad('factory'), 6) },
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
    carrier: part(244, carrier(), 7),
    stormBase: part(156, stormBase(), 6),
    stormSpire: part(64, stormSpire(), 6),
    satellite: part(132, satellite(), 5),
    depot: part(56, depot(), 3),
    dragonHead: part(104, dragonHead(), 5),
    dragonSeg: part(60, dragonSeg(), 4),
    dragonWing: part(160, dragonWing(), 5),
  };
}
