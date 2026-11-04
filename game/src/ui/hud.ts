// On-stream HUD (Pixi, so it is captured by TikTok LIVE Studio / OBS with the game).
// Text is refreshed at most 4x per second (PLAN.md); banners animate every frame.
import { Container, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import { H, TERRAINS, TERRAIN_WEATHERS, W, WEATHERS, WEATHER_CMD, type WeatherKey, fmt, lerp } from '../core/config';
import { COUNTRY_BY_CODE } from '../core/countries';
import { COUNTER, EVENT_UNITS, TIER_COLOR, TIER_LABEL, TIER_MIN, TIER_UNITS, UNITS, UNIT_KEYS, type UnitKey } from '../core/units';
import type { FlagAtlas } from '../draw/flags';
import type { FxTextures } from '../draw/fxTextures';
import type { UnitArt } from '../draw/units';
import { type UnitVisual, buildVisual } from '../sim/visuals';
import type { LiveStatus } from '../net/live';
import { CHEST_GOALS, type Game, type RoundSummary } from '../sim/game';
import { RANKS, rankOf } from '../sim/players';

// Sci-fi type: Orbitron for headings, Rajdhani for everything you read quickly (bundled, see main.ts).
export const TITLE_FONT = 'Orbitron, Arial Black, sans-serif';
export const BODY_FONT = 'Rajdhani, Arial, sans-serif';
const NEON = 0x38e1ff;
const GOLD = 0xffd34d;
const st = (size: number, fill: number | string = 0xffffff, extra: Partial<TextStyleOptions> = {}): TextStyleOptions => ({
  fontFamily: BODY_FONT, fontWeight: '700', fontSize: size, fill,
  stroke: { color: 0x02060c, width: Math.max(3, size / 8) },
  dropShadow: { color: 0x000000, alpha: 0.55, blur: 4, distance: 2, angle: Math.PI / 2 },
  ...extra,
});
const tt = (size: number, fill: number | string = 0xffffff, extra: Partial<TextStyleOptions> = {}): TextStyleOptions =>
  st(size, fill, { fontFamily: TITLE_FONT, fontWeight: '900', letterSpacing: Math.round(size * 0.06), ...extra });

/** Chamfered rectangle (top-left and bottom-right corners cut): the HUD's basic shape. */
const cutRect = (x: number, y: number, w: number, h: number, c: number) => [x + c, y, x + w, y, x + w, y + h - c, x + w - c, y + h, x, y + h, x, y + c];

/** Holographic panel: dark glass, neon edge, bright corner brackets and faint scanlines. */
function panel(g: Graphics, x: number, y: number, w: number, h: number, o: { color?: number; alpha?: number; cut?: number; edge?: number; scan?: boolean } = {}) {
  const color = o.color ?? NEON, c = o.cut ?? Math.min(18, h * 0.3);
  const pts = cutRect(x, y, w, h, c);
  g.poly(pts).fill({ color: 0x050b16, alpha: o.alpha ?? 0.72 });
  g.poly(cutRect(x + 3, y + 3, w - 6, h * 0.45, c * 0.8)).fill({ color: 0x9fdcff, alpha: 0.05 }); // glass sheen
  if (o.scan !== false) for (let yy = y + 4; yy < y + h - 2; yy += 4) g.rect(x + 2, yy, w - 4, 1).fill({ color: 0x000000, alpha: 0.12 });
  g.poly(pts).stroke({ width: o.edge ?? 2, color, alpha: 0.75 });
  // corner brackets
  const b = Math.min(26, w * 0.2, h * 0.5);
  g.moveTo(x + w - b, y).lineTo(x + w, y).lineTo(x + w, y + b).stroke({ width: 4, color, alpha: 1 });
  g.moveTo(x + b, y + h).lineTo(x, y + h).lineTo(x, y + h - b).stroke({ width: 4, color, alpha: 1 });
  // tick marks along the bottom edge
  for (let k = 0; k < 4; k++) g.rect(x + w - c - 14 - k * 9, y + h - 6, 5, 2).fill({ color, alpha: 0.8 });
}
/** "USA war chest 240/300 → 3 BATTLE TANKS" for the country closest to its next goal (>=50%). */
function chestCall(fs: import('../sim/world').Faction[]): string | null {
  let best: string | null = null, bk = 0.5;
  for (const f of fs) {
    const g = CHEST_GOALS[f.chestStage];
    if (!g || !f.fort?.alive) continue;
    const k = f.chest / g.coins;
    if (k >= bk && k < 1) (bk = k), (best = `${f.def.name.toUpperCase()} WAR CHEST ${Math.floor(f.chest)}/${g.coins} coins → ${g.label}! Every gift fills it`);
  }
  return best;
}
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

interface FeedLine { root: Container; bg: Graphics; flag: Sprite; text: Text; life: number }

/** Approximate on-screen footprint (px) of each unit rig, used to frame portraits. */
const FOOT: Record<UnitKey, number> = { infantry: 46, sniper: 66, at: 46, drone: 38, flamer: 48, tank: 62, aa: 62, spider: 104, heli: 120, robot: 92, bomber: 100, titan: 180, strike: 100, jeep: 60, repair: 48, mbt: 90, mlrs: 70, emp: 62, hover: 110, mobile: 150, carrier: 220, stormfort: 150, orbital: 110, dragon: 200 };
const CLASS_NAME = { inf: 'infantry', vehicle: 'vehicles', mech: 'mechs', air: 'aircraft', fort: 'fortresses' } as const;

/** One-line role description shown on unit spec sheets. */
const UNIT_BLURB: Record<UnitKey, string> = {
  infantry: 'Cheap, fast to field and always on the move. Swarms of riflemen hold the line and shred other infantry.',
  sniper: 'Long-barrel rail rifle. Picks off soldiers from far behind the front, but folds against armor.',
  at: 'Shoulder-launched anti-armor rockets. The cheapest answer to tanks and mechs on the field.',
  drone: 'A flying bomb. Dives straight into the nearest target and detonates for heavy damage.',
  flamer: 'Pressurised plasma flamethrower. Melts infantry in a short cone, useless against aircraft.',
  jeep: 'Fast wheeled scout with a roof-mounted machine gun. Great at cleaning up infantry and drones.',
  tank: 'Light tracked tank with a fast-firing cannon. Solid armor and splash damage against soldiers.',
  aa: 'Twin flak cannons with a radar dish. Tears aircraft out of the sky at very long range.',
  spider: 'Six-legged walker with a pulsed laser. Strides over any terrain and hits every class evenly.',
  repair: 'Support drone that beams repairs into damaged allies. Keeps your big units alive longer.',
  heli: 'Attack helicopter firing rocket salvos. Flies over every obstacle and hunts vehicles.',
  mbt: 'Heavy main battle tank. Thick armor and a big-bore cannon that wrecks infantry and forts.',
  mlrs: 'Rocket artillery. Fires six-rocket salvos from extreme range onto the enemy rear lines.',
  emp: 'Electromagnetic pulse truck. Its blast fries mechs and aircraft and stuns everything nearby.',
  robot: 'Humanoid war robot with arm cannons and shoulder rockets. A walking frontline anchor.',
  bomber: 'Carpet-bombing run across the battlefield. Devastating on the ground, gone in seconds.',
  hover: 'Hovercraft gunship. Glides over water and sand at full speed and fires rocket volleys.',
  mobile: 'A rolling fortress with three turrets: two cannons, then a main rail gun. Huge armor.',
  titan: 'Colossal bipedal mech. Twin gatling arrays and missiles fire non-stop in every direction.',
  carrier: 'Flying aircraft carrier. Launches attack drones and shreds enemy aircraft with point defence.',
  stormfort: 'Mobile tesla fortress. Calls lightning onto its target that chains to more enemies.',
  strike: 'Strategic bombing run. A bomber wing flattens the whole enemy side of the map.',
  orbital: 'Satellite laser from orbit. A beam sweeps across the battlefield, erasing all in its path.',
  dragon: 'The ultimate unit. A serpentine mecha dragon that flies anywhere and breathes plasma fire.',
};

/** A unit rig animated in place, for cards and the unit guide. */
class Portrait {
  readonly root = new Container();
  private vis: UnitVisual;
  private dist = 0;
  private t = Math.random() * 10;
  readonly holder = new Container();
  private curl = false;
  constructor(key: UnitKey, color: number, size: number, art: UnitArt, fx: FxTextures) {
    const glow = new Sprite(fx.glow);
    glow.anchor.set(0.5);
    glow.width = glow.height = size * 1.5;
    glow.tint = color;
    glow.alpha = 0.35;
    glow.blendMode = 'add';
    this.vis = buildVisual(key, color, art, fx);
    this.holder.scale.set(size / FOOT[key]);
    this.holder.addChild(this.vis.root);
    this.root.addChild(glow, this.holder);
    this.curl = key === 'dragon';
    // the storm fortress' cloud cover reads as a grey smudge off the battlefield: thin it out
    if (key === 'stormfort') for (const c of this.vis.root.children) if (c instanceof Sprite && c.texture === fx.fog) c.alpha = 0.08;
  }
  update(dt: number) {
    this.t += dt;
    this.dist += dt * 30;
    if (this.curl) {
      // fly the dragon in a slow circle so its body coils behind the head
      const R = 62, w = this.t * 0.9;
      this.vis.root.position.set(Math.cos(w) * R, Math.sin(w) * R);
      this.holder.pivot.set(Math.cos(w - 0.9) * R * 0.75, Math.sin(w - 0.9) * R * 0.75);
      const h = w + Math.PI / 2;
      this.vis.update({ angle: h, aim: h, moving: 1, dist: this.dist, t: this.t, flash: 0 });
      return;
    }
    this.vis.root.position.set(0, 0);
    const a = -0.5 + Math.sin(this.t * 0.6) * 0.12;
    this.vis.update({ angle: a, aim: a + Math.sin(this.t * 1.3) * 0.35, moving: 0.8, dist: this.dist, t: this.t, flash: 0 });
  }
  destroy() {
    this.vis.shadow.destroy({ children: true });
    this.root.destroy({ children: true });
  }
}

/**
 * Right-edge "arsenal" rail: one cell per gift tier (T1..T6) showing a unit nobody has summoned yet
 * this round, with its price. It doubles as the tier ladder and as a standing call to gift.
 */
class Arsenal {
  readonly root = new Container();
  private cells: { tier: number; bg: Graphics; name: Text; price: Text; check: Text; portraits: Map<UnitKey, Portrait>; idx: number; shown: UnitKey | null; pulse: number; done: boolean }[] = [];
  private cycle = 0;
  private known = new Set<UnitKey>();
  static readonly CH = 66;
  static readonly CW = Math.floor((W - 24 - 5 * 6) / 6);
  constructor(art: UnitArt, fx: FxTextures) {
    const { CW, CH } = Arsenal;
    // header tab hanging under the country strip
    const head = new Graphics();
    const label = new Text({ text: 'NOT YET SUMMONED THIS ROUND · BE THE FIRST!', style: tt(13, GOLD) });
    label.anchor.set(0.5, 0.5);
    label.position.set((W - 24) / 2, 11);
    panel(head, (W - 24) / 2 - label.width / 2 - 18, 0, label.width + 36, 22, { color: GOLD, cut: 6, alpha: 0.85, scan: false });
    this.root.addChild(head, label);
    for (let tier = 1; tier <= 6; tier++) {
      const col = TIER_COLOR[tier];
      const cell = new Container();
      cell.position.set((tier - 1) * (CW + 6), 26);
      const bg = new Graphics();
      panel(bg, 0, 0, CW, CH, { color: col, cut: 10, alpha: 0.7, scan: false });
      const badge = new Graphics().roundRect(4, 4, 30, 18, 4).fill({ color: col, alpha: 0.95 });
      const bt = new Text({ text: `T${tier}`, style: tt(13, 0x02060c, { stroke: { width: 0 }, dropShadow: false }) });
      bt.anchor.set(0.5);
      bt.position.set(19, 13);
      const price = new Text({ text: '', style: st(21, col) });
      price.anchor.set(0, 0);
      price.position.set(70, 5);
      const name = new Text({ text: '', style: st(13, 0xffffff) });
      name.anchor.set(0, 0);
      name.position.set(70, 36);
      const check = new Text({ text: '✓ ALL OUT', style: st(17, 0x5dff8a) });
      check.anchor.set(0, 0.5);
      check.position.set(70, CH / 2);
      check.visible = false;
      cell.addChild(bg);
      const portraits = new Map<UnitKey, Portrait>();
      for (const k of TIER_UNITS[tier]) {
        const big = k === 'titan' || k === 'carrier' || k === 'dragon' || k === 'stormfort' || k === 'mobile';
        const p = new Portrait(k === 'strike' ? 'bomber' : k, col, big ? 54 : 46, art, fx);
        if (k === 'strike') p.root.children[1].tint = GOLD;
        p.root.position.set(36, CH / 2 + 4);
        p.root.visible = false;
        cell.addChild(p.root);
        portraits.set(k, p);
      }
      cell.addChild(badge, bt, price, name, check);
      this.root.addChild(cell);
      this.cells.push({ tier, bg, name, price, check, portraits, idx: 0, shown: null, pulse: 0, done: false });
    }
  }
  update(dt: number) {
    for (const c of this.cells) {
      if (c.shown) c.portraits.get(c.shown)!.update(dt);
      if (c.pulse > 0) {
        c.pulse = Math.max(0, c.pulse - dt);
        c.bg.alpha = c.pulse ? 0.55 + 0.45 * Math.abs(Math.sin(c.pulse * 12)) : 1;
      }
    }
  }
  /** Called 4x per second with this round's summoned set. */
  refresh(summoned: Set<UnitKey>, crowded: boolean) {
    this.root.alpha = crowded ? 0.6 : 1;
    this.cycle += 0.25;
    const step = this.cycle >= 3;
    if (step) this.cycle = 0;
    for (const k of summoned) if (!this.known.has(k)) {
      this.known.add(k);
      const c = this.cells[UNITS[k].tier - 1];
      if (c) c.pulse = 1.2;
    }
    if (!summoned.size && this.known.size) this.known.clear(); // new round
    for (const c of this.cells) {
      const left = TIER_UNITS[c.tier].filter((k) => !summoned.has(k));
      c.done = !left.length;
      if (step) c.idx++;
      const key = c.done ? TIER_UNITS[c.tier][0] : left[c.idx % left.length];
      if (key !== c.shown) {
        if (c.shown) c.portraits.get(c.shown)!.root.visible = false;
        c.shown = key;
        c.portraits.get(key)!.root.visible = true;
      }
      const p = c.portraits.get(key)!;
      p.root.alpha = c.done ? 0.25 : 1;
      c.check.visible = c.done;
      c.name.visible = !c.done;
      const nm = (key === 'strike' ? 'AIR STRIKE' : UNITS[key].name).toUpperCase();
      if (c.name.text !== nm) {
        c.name.text = nm;
        c.name.scale.set(Math.min(1, (Arsenal.CW - 74) / Math.max(1, c.name.width / c.name.scale.x)));
      }
      const pr = c.tier === 1 ? 'ROSE' : TIER_MIN[c.tier].toLocaleString('en-US');
      if (c.price.text !== pr) {
        c.price.text = pr;
        c.price.scale.set(Math.min(1, (Arsenal.CW - 74) / Math.max(1, c.price.width / c.price.scale.x)));
      }
    }
  }
  /** Names of the most expensive kinds still missing, for the ticker. */
  missing(summoned: Set<UnitKey>, n: number) {
    const out: string[] = [];
    for (let t = 6; t >= 2 && out.length < n; t--) for (const k of TIER_UNITS[t]) if (!summoned.has(k) && out.length < n) out.push(`${(k === 'strike' ? 'AIR STRIKE' : UNITS[k].name).toUpperCase()} (${TIER_MIN[t].toLocaleString('en-US')})`);
    return out;
  }
}

interface Card { root: Container; portrait: Portrait; life: number; slot: number }

export class Hud {
  readonly layer = new Container();
  readonly cine = new Container();
  readonly overlay = new Container();
  // top
  private throneName: Text;
  private throneCoins: Text;
  private throneCall: Text;
  private roundText: Text;
  private timerText: Text;
  private weatherText: Text;
  private forecastText: Text;
  private strip = new Container();
  private stripItems: { flag: Sprite; text: Text }[] = [];
  private dot: Graphics;
  private scan: Sprite;
  // middle banners
  private tip: Text;
  private tipBg: Graphics;
  private vsBox = new Container();
  private vsA: Sprite;
  private vsB: Sprite;
  private vsText: Text;
  // bottom
  private feed: FeedLine[] = [];
  private ticker: Text;
  private tickerIdx = 0;
  private tickerT = 0;
  // cinematic cut-in
  private cutBand = new Graphics();
  private cutTitle: Text;
  private cutName: Text;
  private cutFlag: Sprite;
  private cutTag: Text;
  private cutInfo: Text;
  private cutCode: Text;
  private cutGhosts: Text[] = [];
  private cutFrame = new Container();
  private cutRet = new Graphics();
  private cutRet2 = new Graphics();
  private cutBar = new Graphics();
  private cutSweep: Sprite;
  private cutFull = '';
  private cutColor = 0xffffff;
  private cutT = 0;
  private cutDur = 0;
  private cutPortrait: Portrait | null = null;
  // deploy cards (tier 2-3 gifts) and the unit guide
  private cards: Card[] = [];
  readonly guide = new Container();
  private guidePortraits: Portrait[] = [];
  // victory
  private vicBg: Graphics;
  private vicBox = new Container();
  private vicSeason = new Container();
  private vicTime = 0;
  private textTick = 0;
  private finalFlash = 0;
  // big centre alerts (war chest, underdog, final minute) and the last-10s countdown
  private alertBox = new Container();
  private alertBg = new Graphics();
  private alertTitle!: Text;
  private alertSub!: Text;
  private alertFlag!: Sprite;
  private alertQ: { title: string; sub: string; color: number; code?: string }[] = [];
  private alertT = 0;
  private countText!: Text;
  private lastCount = -1;
  private countPulse = 0;
  private chestBars: Graphics[] = [];
  private arsenal: Arsenal;

  constructor(private flags: FlagAtlas, private art: UnitArt, private fx: FxTextures) {
    // ---- top HUD: three rows of holo panels
    const top = new Graphics();
    top.rect(0, 0, W, 236).fill({ color: 0x02050a, alpha: 0.35 });
    panel(top, 12, 10, 690, 86, { color: GOLD });
    panel(top, 714, 10, 354, 86);
    panel(top, 12, 104, 380, 64);
    const hex = [W / 2 - 128, 136, W / 2 - 104, 102, W / 2 + 104, 102, W / 2 + 128, 136, W / 2 + 104, 170, W / 2 - 104, 170];
    top.poly(hex).fill({ color: 0x050b16, alpha: 0.85 }).stroke({ width: 3, color: NEON, alpha: 0.95 });
    top.poly(hex.map((v, i) => (i % 2 ? 136 + (v - 136) * 0.82 : W / 2 + (v - W / 2) * 0.9))).stroke({ width: 1, color: NEON, alpha: 0.4 });
    panel(top, 688, 104, 380, 64);
    panel(top, 12, 178, W - 24, 50, { cut: 12 });
    const bottom = new Graphics();
    panel(bottom, 10, H - 92, W - 20, 80, { color: GOLD, cut: 20 });
    this.layer.addChild(top, bottom);
    this.scan = new Sprite(fx.beam);
    this.scan.anchor.set(0.5);
    this.scan.height = 60;
    this.scan.width = 160;
    this.scan.tint = GOLD;
    this.scan.alpha = 0.18;
    this.scan.blendMode = 'add';
    this.scan.y = H - 52;
    this.layer.addChild(this.scan);

    const crown = new Text({ text: '♛ WORLD EMPEROR', style: tt(17, GOLD) });
    crown.position.set(30, 18);
    this.throneName = new Text({ text: 'Send a gift to claim the throne', style: st(44, 0xffe9a0) });
    this.throneName.position.set(30, 38);
    this.throneCoins = new Text({ text: '', style: st(26, GOLD) });
    this.throneCoins.anchor.set(1, 0);
    this.throneCoins.position.set(W - 30, 18);
    this.throneCall = new Text({ text: '', style: st(22, 0xffffff) });
    this.throneCall.anchor.set(1, 0);
    this.throneCall.position.set(W - 30, 56);
    this.roundText = new Text({ text: '', style: tt(19, 0x9fe4ff) });
    this.roundText.anchor.set(0, 0.5);
    this.roundText.position.set(30, 136);
    this.timerText = new Text({ text: '', style: tt(38) });
    this.timerText.anchor.set(0.5);
    this.timerText.position.set(W / 2, 137);
    this.weatherText = new Text({ text: '', style: st(26) });
    this.weatherText.anchor.set(1, 0);
    this.weatherText.position.set(W - 30, 106);
    this.forecastText = new Text({ text: '', style: st(19, GOLD) });
    this.forecastText.anchor.set(1, 0);
    this.forecastText.position.set(W - 30, 138);
    this.strip.position.set(32, 185);
    this.dot = new Graphics();
    this.dot.position.set(W - 34, 203);
    this.layer.addChild(crown, this.throneName, this.throneCoins, this.throneCall, this.roundText, this.timerText, this.weatherText, this.forecastText, this.strip, this.dot);

    // centre alert + final countdown
    this.alertTitle = new Text({ text: '', style: tt(46, 0xffffff) });
    this.alertTitle.anchor.set(0.5);
    this.alertSub = new Text({ text: '', style: st(30, 0xffffff, { align: 'center', wordWrap: true, wordWrapWidth: W - 220 }) });
    this.alertSub.anchor.set(0.5, 0);
    this.alertFlag = new Sprite(this.flags.get('XX'));
    this.alertFlag.anchor.set(0.5);
    this.alertBox.addChild(this.alertBg, this.alertFlag, this.alertTitle, this.alertSub);
    this.alertBox.position.set(W / 2, 1430); // below the cut-in and deploy cards, above the feed
    this.alertBox.visible = false;
    this.countText = new Text({ text: '', style: tt(220, 0xffffff, { stroke: { color: 0x02060c, width: 14 } }) });
    this.countText.anchor.set(0.5);
    this.countText.position.set(W / 2, H / 2 - 40);
    this.countText.visible = false;
    this.layer.addChild(this.alertBox, this.countText);
    // tip / SOS banner
    this.tipBg = new Graphics();
    this.tip = new Text({ text: '', style: st(30, 0xffffff, { align: 'center', wordWrap: true, wordWrapWidth: W - 140 }) });
    this.tip.anchor.set(0.5);
    this.tip.position.set(W / 2, 368);
    this.layer.addChild(this.tipBg, this.tip);

    // rivalry
    this.vsA = new Sprite(flags.get('XX'));
    this.vsB = new Sprite(flags.get('XX'));
    for (const s of [this.vsA, this.vsB]) (s.anchor.set(0.5), s.scale.set(0.75));
    this.vsA.position.set(-110, 0);
    this.vsB.position.set(110, 0);
    this.vsText = new Text({ text: 'VS', style: tt(40, 0xff4f4f) });
    this.vsText.anchor.set(0.5);
    const vsBg = new Graphics();
    panel(vsBg, -180, -42, 360, 84, { color: 0xff4f4f });
    this.vsBox.addChild(vsBg, this.vsA, this.vsB, this.vsText);
    this.vsBox.position.set(W / 2, 372);
    this.vsBox.visible = false;
    this.layer.addChild(this.vsBox);

    // ticker (how to play)
    this.ticker = new Text({ text: '', style: st(32, 0xffffff, { align: 'center' }) });
    this.ticker.anchor.set(0.5);
    this.ticker.position.set(W / 2, H - 48);
    this.layer.addChild(this.ticker);

    // tier ladder / not-yet-summoned row under the country strip (TikTok covers the screen edges)
    this.arsenal = new Arsenal(art, fx);
    this.arsenal.root.position.set(12, 232);
    this.layer.addChild(this.arsenal.root);

    // cut-in
    // cut-in: holographic alert frame (built per call in cutIn)
    this.cutTitle = new Text({ text: '', style: tt(64, 0xffffff) });
    this.cutName = new Text({ text: '', style: st(40, 0xffe27a) });
    this.cutTag = new Text({ text: '', style: tt(18, 0xffffff) });
    this.cutInfo = new Text({ text: '', style: tt(16, 0x9fe4ff, { dropShadow: false }) });
    this.cutCode = new Text({ text: '', style: tt(12, 0x9fe4ff, { stroke: { width: 0, color: 0 }, dropShadow: false }) });
    this.cutFlag = new Sprite(flags.get('XX'));
    this.cutFlag.anchor.set(0, 0.5);
    for (const t of [this.cutTitle, this.cutName, this.cutTag, this.cutInfo]) t.anchor.set(0, 0.5);
    this.cutCode.anchor.set(1, 0.5);
    this.cutCode.alpha = 0.55;
    for (const c of [0xff3df0, 0x3dfcff]) {
      const g = new Text({ text: '', style: tt(64, c, { stroke: { width: 0, color: 0 }, dropShadow: false }) });
      g.anchor.set(0, 0.5);
      g.blendMode = 'add';
      g.alpha = 0.7;
      this.cutGhosts.push(g);
    }
    this.cutSweep = new Sprite(fx.beam);
    this.cutSweep.anchor.set(0.5);
    this.cutSweep.rotation = Math.PI / 2;
    this.cutSweep.blendMode = 'add';
    this.cutSweep.alpha = 0.22;
    this.cutRet.blendMode = 'add';
    this.cutRet2.blendMode = 'add';
    this.cutFrame.addChild(this.cutBand, this.cutRet2, this.cutRet, this.cutSweep, ...this.cutGhosts, this.cutTitle, this.cutTag, this.cutInfo, this.cutBar, this.cutFlag, this.cutName, this.cutCode);
    this.cine.addChild(this.cutFrame);
    this.cine.visible = false;
    this.guide.visible = false;

    // victory overlay
    this.vicBg = new Graphics().rect(0, 0, W, H).fill({ color: 0x02040a, alpha: 0.78 });
    this.overlay.addChild(this.vicBg, this.vicBox, this.vicSeason);
    this.overlay.visible = false;
  }

  // ------------------------------------------------------------ feed
  /** Big centre banner for round-changing moments; queued so they never overlap. */
  alert(title: string, sub: string, color: number, code?: string) {
    if (this.alertQ.length < 4) this.alertQ.push({ title, sub, color, code });
  }
  private showAlert(a: { title: string; sub: string; color: number; code?: string }) {
    this.alertTitle.text = a.title;
    this.alertTitle.style.fill = a.color;
    this.alertTitle.scale.set(Math.min(1, (W - 200) / (this.alertTitle.width / this.alertTitle.scale.x)));
    this.alertSub.text = a.sub;
    this.alertFlag.visible = !!a.code;
    if (a.code) {
      this.alertFlag.texture = this.flags.get(a.code);
      this.alertFlag.scale.set(1);
    }
    const top = a.code ? -110 : -50;
    this.alertFlag.position.set(0, top + 30);
    this.alertTitle.position.set(0, top + (a.code ? 100 : 40));
    this.alertSub.position.set(0, this.alertTitle.y + 38);
    const h = this.alertSub.y + this.alertSub.height + 26 - top;
    this.alertBg.clear();
    panel(this.alertBg, -(W - 120) / 2, top - 14, W - 120, h + 14, { color: a.color, alpha: 0.85, cut: 26, edge: 3 });
    this.alertT = 3.8;
    this.alertBox.visible = true;
  }

  pushFeed(text: string, code: string, color = 0xffffff) {
    let line = this.feed.length >= 5 ? this.feed.shift()! : null;
    if (!line) {
      const root = new Container();
      const bg = new Graphics();
      const flag = new Sprite(this.flags.get(code));
      flag.anchor.set(0, 0.5);
      flag.scale.set(0.42);
      flag.x = 10;
      const t = new Text({ text: '', style: st(27, 0xffffff) });
      t.anchor.set(0, 0.5);
      t.position.set(58, 0);
      root.addChild(bg, flag, t);
      this.layer.addChild(root);
      line = { root, bg, flag, text: t, life: 0 };
    }
    line.flag.texture = this.flags.get(code);
    line.text.text = text.length > 62 ? text.slice(0, 61) + '…' : text;
    line.text.style.fill = color;
    const w = Math.min(W - 40, line.text.width + 76);
    line.bg.clear().poly(cutRect(0, -18, w, 36, 10)).fill({ color: 0x050b16, alpha: 0.62 });
    line.bg.rect(0, -18, 4, 36).fill({ color, alpha: 0.95 });
    line.life = 9;
    line.root.alpha = 1;
    this.feed.push(line);
    this.feed.forEach((l, i) => l.root.position.set(16, H - 124 - (this.feed.length - 1 - i) * 42));
  }

  // ------------------------------------------------------------ cinematic banner
  cutIn(tier: number, key: UnitKey, unitName: string, who: string, code: string, color: number, dur: number) {
    this.cutT = 0;
    this.cutDur = dur;
    const big = tier >= 5;
    const accent = tier >= 6 ? GOLD : color;
    this.cutColor = accent;
    const h = big ? 400 : 330;
    const cy = 960;
    const y0 = cy - h / 2, x0 = 20, w = W - 40, c = 44;
    const R = h * 0.38, rx = 200;
    this.cutFrame.pivot.set(0, cy);
    this.cutFrame.position.set(0, cy);

    // ---- static frame
    const b = this.cutBand.clear();
    const frame = [x0 + c, y0, x0 + w - c, y0, x0 + w, y0 + c, x0 + w, y0 + h - c, x0 + w - c, y0 + h, x0 + c, y0 + h, x0, y0 + h - c, x0, y0 + c];
    b.poly(frame).fill({ color: 0x030810, alpha: 0.9 });
    b.poly(frame).fill({ color: accent, alpha: 0.05 });
    // hex grid on the data side
    for (let gy = y0 + 18, row = 0; gy < y0 + h - 10; gy += 26, row++)
      for (let gx = 390 + (row % 2) * 15; gx < x0 + w - 20; gx += 30) {
        const pts: number[] = [];
        for (let k = 0; k < 6; k++) pts.push(gx + Math.cos((k / 6) * Math.PI * 2 + Math.PI / 6) * 9, gy + Math.sin((k / 6) * Math.PI * 2 + Math.PI / 6) * 9);
        b.poly(pts).stroke({ width: 1, color: accent, alpha: 0.07 });
      }
    for (let yy = y0 + 3; yy < y0 + h - 3; yy += 4) b.rect(x0 + 6, yy, w - 12, 1).fill({ color: 0x000000, alpha: 0.2 });
    // double neon border
    b.poly(frame).stroke({ width: 3, color: accent, alpha: 0.95 });
    const inset = frame.map((v, i) => (i % 2 ? cy + (v - cy) * ((h - 20) / h) : W / 2 + (v - W / 2) * ((w - 20) / w)));
    b.poly(inset).stroke({ width: 1, color: accent, alpha: 0.35 });
    // heavy corner brackets
    const br = 46;
    for (const [px, py, sx, sy] of [[x0, y0 + c, 1, 1], [x0 + w, y0 + c, -1, 1], [x0, y0 + h - c, 1, -1], [x0 + w, y0 + h - c, -1, -1]] as const) {
      b.moveTo(px, py + sy * br).lineTo(px, py).lineTo(px + sx * c, py - sy * c).lineTo(px + sx * (c + br), py - sy * c).stroke({ width: 6, color: accent, alpha: 1 });
    }
    // top label plate
    b.poly([x0 + c + 20, y0, x0 + c + 300, y0, x0 + c + 284, y0 + 16, x0 + c + 36, y0 + 16]).fill({ color: accent, alpha: 0.9 });
    // divider with ticks between the radar and the data
    b.moveTo(370, y0 + 24).lineTo(370, y0 + h - 24).stroke({ width: 2, color: accent, alpha: 0.6 });
    for (let yy = y0 + 34; yy < y0 + h - 30; yy += 14) b.rect(364, yy, (yy - y0) % 56 === 34 % 56 ? 12 : 6, 2).fill({ color: accent, alpha: 0.6 });
    // radar backdrop + crosshair
    b.circle(rx, cy, R + 26).fill({ color: 0x000000, alpha: 0.45 });
    b.circle(rx, cy, R).stroke({ width: 2, color: accent, alpha: 0.5 });
    b.circle(rx, cy, R * 0.55).stroke({ width: 1, color: accent, alpha: 0.3 });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.moveTo(rx + dx * (R + 34), cy + dy * (R + 34)).lineTo(rx + dx * (R - 12), cy + dy * (R - 12)).stroke({ width: 2, color: accent, alpha: 0.8 });
    // right-edge chevrons
    for (let k = 0; k < 5; k++) {
      const x = x0 + w - 34 - k * 22, yy = y0 + 34;
      b.poly([x, yy, x + 12, yy, x + 22, yy + 12, x + 12, yy + 24, x, yy + 24, x + 10, yy + 12]).fill({ color: accent, alpha: 0.2 + k * 0.15 });
    }
    // hazard stripes for the big ones
    if (big)
      for (let x = 400; x < x0 + w - 60; x += 28) b.poly([x, y0 + h - 22, x + 14, y0 + h - 22, x + 4, y0 + h - 8, x - 10, y0 + h - 8]).fill({ color: accent, alpha: 0.55 });

    // ---- rotating radar rings
    const r1 = this.cutRet.clear();
    for (let k = 0; k < 3; k++) r1.arc(0, 0, R + 14, (k / 3) * Math.PI * 2, (k / 3) * Math.PI * 2 + 1.4).stroke({ width: 4, color: accent, alpha: 0.9 });
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2, l = k % 3 ? 5 : 11;
      r1.moveTo(Math.cos(a) * (R + 20), Math.sin(a) * (R + 20)).lineTo(Math.cos(a) * (R + 20 + l), Math.sin(a) * (R + 20 + l)).stroke({ width: 1.5, color: accent, alpha: 0.7 });
    }
    r1.position.set(rx, cy);
    const r2 = this.cutRet2.clear();
    for (let k = 0; k < 12; k++) r2.arc(0, 0, R - 8, (k / 12) * Math.PI * 2, (k / 12) * Math.PI * 2 + 0.3).stroke({ width: 2, color: accent, alpha: 0.6 });
    r2.moveTo(0, 0).lineTo(R - 8, 0).stroke({ width: 2, color: accent, alpha: 0.8 }); // radar sweep arm
    r2.position.set(rx, cy);

    // ---- unit hologram in the radar
    this.cutPortrait?.destroy();
    const pk = key === 'strike' ? 'bomber' : key;
    this.cutPortrait = new Portrait(pk, accent, R * 1.6, this.art, this.fx);
    this.cutPortrait.root.position.set(rx, cy);
    this.cutFrame.addChildAt(this.cutPortrait.root, 3);

    // ---- text block
    const def = UNITS[key];
    const cls = key === 'strike' ? 'AIR STRIKE' : key === 'orbital' ? 'ORBITAL STRIKE' : { inf: 'INFANTRY', vehicle: 'ARMOR', mech: 'MECH', air: 'AIRCRAFT' }[def.cls];
    const tx = 400;
    this.cutTag.text = `▲ INCOMING DEPLOYMENT  //  TIER ${tier}`;
    this.cutTag.style.fill = accent;
    this.cutTag.position.set(tx, y0 + 50);
    this.cutFull = unitName.toUpperCase();
    this.cutTitle.style.fontSize = big ? 70 : 58;
    this.cutTitle.style.fill = 0xffffff;
    this.cutTitle.text = this.cutFull;
    const sc = Math.min(1, 610 / this.cutTitle.width);
    for (const t of [this.cutTitle, ...this.cutGhosts]) {
      t.style.fontSize = this.cutTitle.style.fontSize;
      t.text = this.cutFull;
      t.scale.set(sc);
      t.position.set(tx, cy - (big ? 46 : 38));
    }
    this.cutInfo.text = `CLASS: ${cls}   THREAT: ${'▮'.repeat(tier + 1)}${'▯'.repeat(Math.max(0, 6 - tier))}`;
    this.cutInfo.style.fill = accent;
    this.cutInfo.position.set(tx, cy + (big ? 18 : 12));
    this.cutBar.position.set(tx, cy + (big ? 44 : 36));
    this.cutFlag.texture = this.flags.get(code);
    this.cutFlag.scale.set(big ? 0.62 : 0.52);
    this.cutFlag.position.set(tx, y0 + h - (big ? 72 : 60));
    this.cutName.text = `@${who}  CALLED IT IN`;
    this.cutName.style.fontSize = big ? 40 : 34;
    this.cutName.scale.set(1);
    this.cutName.scale.set(Math.min(1, 540 / this.cutName.width));
    this.cutName.position.set(tx + (big ? 80 : 68), this.cutFlag.y);
    this.cutCode.text = `SAT-LINK ${(Math.random() * 0xffff) | 0} // AUTH ${code}-${tier}${(Math.random() * 900 + 100) | 0}`;
    this.cutCode.position.set(x0 + w - 50, y0 + h - (big ? 36 : 26));
    this.cutSweep.height = 40;
    this.cutSweep.width = h - 20;
    this.cutSweep.tint = accent;
    this.cutSweep.y = cy;
    this.cine.visible = true;
  }

  /** Small slide-in card with the unit's picture for mid-tier gifts. */
  deployCard(key: UnitKey, who: string, code: string, color: number) {
    if (this.cards.length >= 3) this.dropCard(this.cards[0]);
    const used = new Set(this.cards.map((c) => c.slot));
    const slot = [0, 1, 2].find((i) => !used.has(i)) ?? 0;
    const root = new Container();
    const bg = new Graphics();
    panel(bg, 0, 0, 440, 132, { color, alpha: 0.85, cut: 22 });
    bg.poly(cutRect(10, 10, 112, 112, 14)).fill({ color: 0x0b1626, alpha: 0.95 }).stroke({ width: 1.5, color, alpha: 0.5 });
    for (let k = 0; k < UNITS[key].tier; k++) bg.poly([392 - k * 16, 18, 404 - k * 16, 18, 398 - k * 16, 30]).fill({ color: GOLD });
    root.addChild(bg);
    const portrait = new Portrait(key, color, 112, this.art, this.fx);
    portrait.root.position.set(66, 66);
    root.addChild(portrait.root);
    const name = new Text({ text: UNITS[key].name.toUpperCase(), style: tt(24, color) });
    name.position.set(138, 30);
    name.anchor.set(0, 0.5);
    name.scale.set(Math.min(1, 230 / name.width));
    const flag = new Sprite(this.flags.get(code));
    flag.scale.set(0.38);
    flag.position.set(138, 66);
    const by = new Text({ text: `@${who}`, style: st(26, 0xffffff) });
    by.position.set(184, 64);
    by.scale.set(Math.min(1, 240 / by.width));
    const tag = new Text({ text: `TIER ${UNITS[key].tier} · DEPLOYED`, style: tt(13, 0x9fdcff) });
    tag.position.set(138, 100);
    root.addChild(name, flag, by, tag);
    root.position.set(W + 20, 520 + slot * 148);
    this.layer.addChild(root);
    this.cards.push({ root, portrait, life: 3.2, slot });
  }

  private dropCard(c: Card) {
    c.portrait.destroy();
    c.root.destroy({ children: true });
    this.cards.splice(this.cards.indexOf(c), 1);
  }

  /** Full-screen guide of all 24 units with their gift tier and what they counter. */
  toggleGuide(show = !this.guide.visible) {
    this.guide.visible = show;
    for (const p of this.guidePortraits) p.destroy();
    this.guidePortraits = [];
    this.guide.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!show) return;
    const bg = new Graphics().rect(0, 0, W, H).fill({ color: 0x03050a, alpha: 0.94 });
    this.guide.addChild(bg);
    const title = new Text({ text: 'UNIT DATABASE', style: tt(52, GOLD) });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 28);
    const sub = new Text({ text: '24 units · 7 gift tiers · pick yours with a !command', style: st(24, 0x9fdcff) });
    sub.anchor.set(0.5, 0);
    sub.position.set(W / 2, 92);
    this.guide.addChild(title, sub);
    const cols = 4, cw = W / cols, ch = 292, top = 136;
    const keys = UNIT_KEYS;
    keys.forEach((k, i) => {
      const d = UNITS[k];
      const cx = (i % cols) * cw + cw / 2, cy = top + Math.floor(i / cols) * ch;
      const tierCol = [0x9fb4d8, 0x6dff9a, 0x38e1ff, 0x5a8cff, 0xc86dff, 0xff9a3d, GOLD][d.tier];
      const box = new Graphics();
      panel(box, cx - cw / 2 + 8, cy, cw - 16, ch - 12, { color: tierCol, alpha: 0.9, cut: 16 });
      this.guide.addChild(box);
      const tierTag = new Text({ text: `T${d.tier}`, style: tt(16, tierCol) });
      tierTag.position.set(cx - cw / 2 + 20, cy + 10);
      this.guide.addChild(tierTag);
      const p = new Portrait(k === 'strike' ? 'bomber' : k, tierCol, k === 'titan' || k === 'carrier' || k === 'dragon' ? 135 : 118, this.art, this.fx);
      if (k === 'strike') p.root.children[1].tint = GOLD;
      p.root.position.set(cx, cy + 92);
      this.guide.addChild(p.root);
      this.guidePortraits.push(p);
      const name = new Text({ text: d.name.toUpperCase(), style: tt(17, 0xffffff) });
      name.anchor.set(0.5, 0);
      name.position.set(cx, cy + 172);
      name.scale.set(Math.min(1, (cw - 40) / name.width));
      const how = d.tier === 0 ? { infantry: 'CHAT', sniper: 'FOLLOW', at: 'SHARE' }[k as 'infantry'] : `${TIER_MIN[d.tier].toLocaleString('en-US')}+ COINS`;
      const tier = new Text({ text: `${how}${d.tier > 0 ? ' · ' + d.cmds[0] : ''}`, style: st(21, GOLD) });
      tier.anchor.set(0.5, 0);
      tier.position.set(cx, cy + 202);
      tier.scale.set(Math.min(1, (cw - 30) / tier.width));
      const strong = (Object.entries(COUNTER[d.weapon]) as [keyof typeof CLASS_NAME, number][]).filter(([, v]) => v >= 1.4).map(([c]) => CLASS_NAME[c]);
      const vsText = d.weapon === 'repair' ? 'Heals friendly units' : strong.length ? `Strong vs ${strong.join(', ')}` : 'All-rounder';
      const vs = new Text({ text: vsText, style: st(18, 0x9fb4d8, { wordWrap: true, wordWrapWidth: cw - 36, align: 'center' }) });
      vs.anchor.set(0.5, 0);
      vs.position.set(cx, cy + 232);
      this.guide.addChild(name, tier, vs);
    });
  }

  /** Grid of large unit portraits (design review sheet). */
  sheet(keys: UnitKey[], cell = 420): { root: Container; w: number; h: number; destroy: () => void } {
    const root = new Container();
    const cols = Math.min(3, keys.length), rows = Math.ceil(keys.length / cols);
    const w = cols * cell, h = rows * (cell + 50);
    const g = new Graphics().rect(0, 0, w, h).fill(0x0b111c);
    for (let x = 0; x <= w; x += 30) g.rect(x, 0, 1, h).fill({ color: 0x38e1ff, alpha: 0.05 });
    for (let y = 0; y <= h; y += 30) g.rect(0, y, w, 1).fill({ color: 0x38e1ff, alpha: 0.05 });
    root.addChild(g);
    const ps: Portrait[] = [];
    keys.forEach((k, i) => {
      const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * (cell + 50) + cell / 2 + 10;
      const big = k === 'titan' || k === 'carrier' || k === 'dragon' || k === 'mobile' || k === 'stormfort';
      const p = new Portrait(k === 'strike' ? 'bomber' : k, 0x38e1ff, (big ? 0.78 : 0.68) * cell, this.art, this.fx);
      for (let f = 0; f < 150; f++) p.update(1 / 30);
      const hb = p.holder.getBounds(), rb = p.root.getBounds();
      p.root.position.set(cx - (hb.x + hb.width / 2 - rb.x - rb.width / 2), cy - (hb.y + hb.height / 2 - rb.y - rb.height / 2));
      root.addChild(p.root);
      ps.push(p);
      const t = new Text({ text: UNITS[k].name.toUpperCase(), style: tt(24, 0xffffff) });
      t.anchor.set(0.5, 0);
      t.position.set(cx, Math.floor(i / cols) * (cell + 50) + cell + 8);
      root.addChild(t);
    });
    return { root, w, h, destroy: () => (ps.forEach((p) => p.destroy()), root.destroy({ children: true })) };
  }

  /** A 1080x1350 spec sheet for one unit (used to export reference images). */
  poster(key: UnitKey): { root: Container; destroy: () => void } {
    const d = UNITS[key];
    const PW = 1080, PH = 1350;
    const col = [0x9fb4d8, 0x6dff9a, 0x38e1ff, 0x5a8cff, 0xc86dff, 0xff9a3d, GOLD][d.tier];
    const root = new Container();
    const g = new Graphics();
    g.rect(0, 0, PW, PH).fill(0x03060d);
    for (let y = 0; y < PH; y += 6) g.rect(0, y, PW, 3).fill({ color: col, alpha: 0.012 + 0.03 * (1 - y / PH) });
    for (let x = 0; x <= PW; x += 60) g.rect(x, 0, 1, PH).fill({ color: col, alpha: 0.06 });
    for (let y = 0; y <= PH; y += 60) g.rect(0, y, PW, 1).fill({ color: col, alpha: 0.06 });
    panel(g, 24, 24, PW - 48, PH - 48, { color: col, alpha: 0.35, cut: 40, edge: 3 });
    // header
    panel(g, 60, 64, 220, 46, { color: col, alpha: 0.9, cut: 12 });
    root.addChild(g);
    const add = <T extends Container>(o: T, x: number, y: number, ax = 0, ay = 0) => {
      if ('anchor' in o) (o as unknown as Text).anchor.set(ax, ay);
      o.position.set(x, y);
      root.addChild(o);
      return o;
    };
    add(new Text({ text: `TIER ${d.tier}`, style: tt(24, col) }), 170, 87, 0.5, 0.5);
    const event = EVENT_UNITS.includes(key);
    const clsName = event ? 'GLOBAL EVENT' : { inf: 'INFANTRY', vehicle: 'VEHICLE', mech: 'MECH', air: 'AIRCRAFT' }[d.cls];
    add(new Text({ text: `UNIT FILE // ${clsName}`, style: st(26, 0x9fdcff, { letterSpacing: 4 }) }), PW - 60, 87, 1, 0.5);
    const name = add(new Text({ text: d.name.toUpperCase(), style: tt(78, 0xffffff) }), PW / 2, 128, 0.5, 0);
    name.scale.set(Math.min(1, (PW - 120) / name.width));
    // portrait stage
    const ring = new Graphics();
    const cx = PW / 2, cy = 540;
    for (let r = 120; r <= 330; r += 70) ring.circle(cx, cy, r).stroke({ width: 2, color: col, alpha: 0.18 });
    ring.circle(cx, cy, 300).stroke({ width: 4, color: col, alpha: 0.5 });
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2, r0 = k % 4 === 0 ? 300 : 308;
      ring.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0).lineTo(cx + Math.cos(a) * 320, cy + Math.sin(a) * 320).stroke({ width: k % 4 === 0 ? 4 : 2, color: col, alpha: 0.7 });
    }
    ring.moveTo(cx - 360, cy).lineTo(cx - 250, cy).moveTo(cx + 250, cy).lineTo(cx + 360, cy).stroke({ width: 2, color: col, alpha: 0.5 });
    ring.moveTo(cx, cy - 325).lineTo(cx, cy - 250).moveTo(cx, cy + 250).lineTo(cx, cy + 325).stroke({ width: 2, color: col, alpha: 0.5 });
    root.addChild(ring);
    const big = key === 'titan' || key === 'carrier' || key === 'dragon' || key === 'mobile' || key === 'stormfort';
    const p = new Portrait(key === 'strike' ? 'bomber' : key, col, big ? 470 : 400, this.art, this.fx);
    for (let i = 0; i < 150; i++) p.update(1 / 30);
    const hb = p.holder.getBounds(), rb = p.root.getBounds();
    p.root.position.set(cx - (hb.x + hb.width / 2 - rb.x - rb.width / 2), cy - (hb.y + hb.height / 2 - rb.y - rb.height / 2));
    root.addChild(p.root);
    // stats
    let y = 878;
    const bars: [string, number, number, string][] = event
      ? []
      : [
          ['ARMOR', d.hp, 9000, d.hp.toLocaleString('en-US') + ' HP'],
          ['FIREPOWER', d.weapon === 'repair' ? d.dmg / d.fireInterval : d.dmg / d.fireInterval, 400, d.weapon === 'repair' ? `${Math.round(d.dmg / d.fireInterval)} HEAL/S` : `${Math.round(d.dmg / d.fireInterval)} DPS`],
          ['RANGE', d.range, 600, `${d.range} M`],
          ['SPEED', d.speed, 210, `${d.speed} KM/H`],
        ];
    const sb = new Graphics();
    root.addChild(sb);
    if (event) {
      panel(sb, 60, y - 10, PW - 120, 120, { color: col, alpha: 0.6, cut: 16 });
      add(new Text({ text: 'INSTANT MAP-WIDE STRIKE · NO UNIT SPAWNS', style: tt(30, col) }), PW / 2, y + 50, 0.5, 0.5);
      y += 140;
    } else {
      for (const [label, v, max, txt] of bars) {
        const f = Math.max(0.04, Math.min(1, Math.log(1 + v) / Math.log(1 + max)));
        add(new Text({ text: label, style: tt(22, 0x9fdcff) }), 60, y + 13, 0, 0.5);
        const bx = 300, segs = 26;
        for (let k = 0; k < segs; k++) sb.poly([bx + k * 20 + 6, y, bx + k * 20 + 22, y, bx + k * 20 + 16, y + 26, bx + k * 20, y + 26]).fill({ color: k / segs < f ? col : 0x1a2a40, alpha: k / segs < f ? 0.95 : 0.8 });
        add(new Text({ text: txt, style: st(28, 0xffffff) }), PW - 60, y + 13, 1, 0.5);
        y += 42;
      }
      y += 4;
    }
    // info panel
    const how = d.tier === 0 ? { infantry: 'Chat anything', sniper: 'Follow the host', at: 'Share the LIVE' }[key as 'infantry'] : `Gift ${TIER_MIN[d.tier].toLocaleString('en-US')}+ coins`;
    const strong = (Object.entries(COUNTER[d.weapon]) as [keyof typeof CLASS_NAME, number][]).filter(([, v]) => v >= 1.4).map(([c]) => CLASS_NAME[c]);
    const strongText = d.weapon === 'repair' ? 'Heals friendly units' : strong.length ? strong.join(', ') : 'All-rounder';
    const weakKeys = event ? [] : UNIT_KEYS.filter((k) => k !== key && !EVENT_UNITS.includes(k) && COUNTER[UNITS[k].weapon][d.cls] >= 2).map((k) => UNITS[k].name);
    const ib = new Graphics();
    root.addChild(ib);
    panel(ib, 60, y, PW - 120, PH - 60 - y, { color: col, alpha: 0.75, cut: 22 });
    const rows: [string, string, number][] = [
      ['CALL', `${how}${d.tier > 0 || key === 'infantry' ? '  ·  type ' + d.cmds.join(' / ') : ''}`, GOLD],
      ['STRONG VS', strongText, 0x6dff9a],
      ['WEAK VS', event ? 'Cannot be stopped' : weakKeys.length ? weakKeys.slice(0, 4).join(', ') + (weakKeys.length > 4 ? '…' : '') : 'Nothing in particular', 0xff6d6d],
    ];
    let ry = y + 22;
    for (const [lab, val, c] of rows) {
      add(new Text({ text: lab, style: tt(20, c) }), 90, ry + 4);
      const t = add(new Text({ text: val, style: st(28, 0xffffff) }), 290, ry);
      t.scale.set(Math.min(1, (PW - 380) / t.width));
      ry += 40;
    }
    add(new Text({ text: UNIT_BLURB[key], style: st(26, 0xb8cbe6, { wordWrap: true, wordWrapWidth: PW - 180, lineHeight: 32 }) }), 90, ry + 8);
    return { root, destroy: () => (p.destroy(), root.destroy({ children: true })) };
  }

  // ------------------------------------------------------------ victory
  showVictory(s: RoundSummary) {
    this.cine.visible = false;
    this.vicBox.removeChildren().forEach((c) => c.destroy());
    const add = <T extends Container>(o: T, x: number, y: number) => (o.position.set(x, y), this.vicBox.addChild(o), o);
    const win = s.ranking[0];
    const box = new Graphics();
    panel(box, 60, 300, W - 120, 1320, { color: win?.color ?? NEON, alpha: 0.6, cut: 40 });
    this.vicBox.addChild(box);
    add(new Text({ text: `ROUND ${s.n} COMPLETE`, style: tt(40, 0x9fe4ff) }), W / 2, 380).anchor.set(0.5);
    if (win) {
      const fl = add(new Sprite(this.flags.get(win.code)), W / 2, 580);
      fl.anchor.set(0.5);
      fl.scale.set(2.6);
      const t = add(new Text({ text: `${win.name.toUpperCase()} WINS!`, style: tt(68, win.color) }), W / 2, 790);
      t.scale.set(Math.min(1, (W - 180) / t.width));
      t.anchor.set(0.5);
    }
    s.ranking.slice(0, 5).forEach((r, i) => {
      const y = 920 + i * 74;
      const f = add(new Sprite(this.flags.get(r.code)), 200, y);
      f.anchor.set(0.5);
      f.scale.set(0.6);
      add(new Text({ text: `${i + 1}. ${r.name}`, style: st(38, i === 0 ? 0xffd34d : 0xffffff) }), 250, y).anchor.set(0, 0.5);
      add(new Text({ text: fmt(r.score), style: st(38, r.color) }), W - 160, y).anchor.set(1, 0.5);
    });
    let y = 1330;
    if (s.mvp) {
      add(new Text({ text: `MVP  @${s.mvp.name}  ·  ${s.mvp.roundKills} kills`, style: st(36, 0x7fd8ff) }), W / 2, y).anchor.set(0.5);
      y += 64;
    }
    if (s.topDonor) add(new Text({ text: `TOP SUPPORTER  @${s.topDonor.name}  ·  ${fmt(s.topDonor.roundCoins ?? 0)} coins`, style: st(34, 0xffd34d) }), W / 2, y).anchor.set(0.5);
    add(new Text({ text: 'Next battle starting… type your country code to join!', style: st(30, 0xffffff) }), W / 2, 1560).anchor.set(0.5);
    this.buildSeason(s);
    this.vicTime = 0;
    this.vicBox.visible = true;
    this.vicSeason.visible = false;
    this.overlay.visible = true;
    this.overlay.alpha = 0;
  }
  /** Second victory page: monthly country standings and all-time supporters (the reasons to come back). */
  private buildSeason(s: RoundSummary) {
    this.vicSeason.removeChildren().forEach((c) => c.destroy());
    const add = <T extends Container>(o: T, x: number, y: number) => (o.position.set(x, y), this.vicSeason.addChild(o), o);
    const box = new Graphics();
    panel(box, 60, 300, W - 120, 1320, { color: GOLD, alpha: 0.6, cut: 40 });
    this.vicSeason.addChild(box);
    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    add(new Text({ text: 'SEASON STANDINGS', style: tt(48, GOLD) }), W / 2, 390).anchor.set(0.5);
    add(new Text({ text: `${month} · most round wins takes the season crown`, style: st(28, 0x9fdcff) }), W / 2, 450).anchor.set(0.5);
    s.season.forEach((r, i) => {
      const y = 540 + i * 78;
      const f = add(new Sprite(this.flags.get(r.code)), 170, y);
      f.anchor.set(0.5);
      f.scale.set(0.6);
      add(new Text({ text: `${i + 1}. ${r.name}`, style: st(38, i === 0 ? GOLD : 0xffffff) }), 220, y).anchor.set(0, 0.5);
      add(new Text({ text: `${r.wins} W · ${fmt(r.coins)} coins`, style: st(32, 0x9fdcff) }), W - 140, y).anchor.set(1, 0.5);
    });
    add(new Text({ text: 'HALL OF LEGENDS', style: tt(40, 0xff9a3d) }), W / 2, 1000).anchor.set(0.5);
    add(new Text({ text: 'all-time supporters · ranks are kept forever', style: st(26, 0x9fdcff) }), W / 2, 1050).anchor.set(0.5);
    s.legends.forEach((p, i) => {
      const y = 1120 + i * 70;
      const r = RANKS[p.rank];
      if (p.country) {
        const f = add(new Sprite(this.flags.get(p.country)), 170, y);
        f.anchor.set(0.5);
        f.scale.set(0.5);
      }
      add(new Text({ text: `@${p.name}`, style: st(36, 0xffffff) }), 220, y).anchor.set(0, 0.5);
      add(new Text({ text: `${r.name.toUpperCase()} · ${fmt(p.coins)}`, style: st(30, r.color) }), W - 140, y).anchor.set(1, 0.5);
    });
    if (!s.legends.length) add(new Text({ text: 'Be the first legend: any gift ranks you up', style: st(32, 0xffffff) }), W / 2, 1200).anchor.set(0.5);
    add(new Text({ text: 'Next battle starting… type your country code to join!', style: st(30, 0xffffff) }), W / 2, 1560).anchor.set(0.5);
  }
  hideVictory() {
    this.overlay.visible = false;
  }

  // ------------------------------------------------------------ per frame
  update(dt: number, game: Game, status: LiveStatus | 'sim') {
    // cut-in animation: frame snaps open, title decrypts with a glitch, energy bar charges
    if (this.cine.visible) {
      this.cutT += dt;
      const p = this.cutT;
      const open = ease(p * 5);
      const out = ease((p - (this.cutDur - 0.3)) * 4);
      this.cutFrame.scale.y = Math.max(0.01, open * (1 - out));
      this.cutFrame.alpha = Math.min(1, p * 8) * (1 - out * 0.5);
      this.cutRet.rotation += dt * 1.2;
      this.cutRet2.rotation -= dt * 2.4;
      // title: random glyphs resolve left-to-right
      const rev = Math.max(0, Math.min(1, (p - 0.12) / 0.5));
      const n = Math.floor(this.cutFull.length * rev);
      const glyphs = '#%&@01X/<>=*';
      let txt = this.cutFull.slice(0, n);
      for (let i = n; i < this.cutFull.length; i++) txt += this.cutFull[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
      if (this.cutTitle.text !== txt) for (const t of [this.cutTitle, ...this.cutGhosts]) t.text = txt;
      const glitch = p < 0.75 || Math.random() < 0.04 ? 1 : 0;
      this.cutGhosts.forEach((g, i) => {
        g.x = this.cutTitle.x + (i ? 1 : -1) * (glitch ? 3 + Math.random() * 7 : 2);
        g.y = this.cutTitle.y + (glitch ? (Math.random() - 0.5) * 4 : 0);
        g.alpha = glitch ? 0.75 : 0.35;
      });
      // text slides in from the right, staggered
      const slideIn = (d: number) => (1 - ease((p - d) * 5)) * 120;
      this.cutTag.x = 400 + slideIn(0.08);
      this.cutTag.alpha = Math.min(1, (p - 0.08) * 6);
      this.cutInfo.x = 400 + slideIn(0.3);
      this.cutInfo.alpha = Math.min(1, (p - 0.3) * 6);
      this.cutFlag.x = 400 + slideIn(0.4);
      this.cutName.x = this.cutFlag.x + this.cutFlag.width + 16;
      this.cutFlag.alpha = this.cutName.alpha = Math.min(1, (p - 0.4) * 6);
      // energy bar
      const fill = ease((p - 0.3) / 0.9);
      const bw = 610;
      this.cutBar.clear().rect(0, 0, bw, 14).fill({ color: 0x000000, alpha: 0.6 }).stroke({ width: 1.5, color: this.cutColor, alpha: 0.6 });
      for (let x = 0; x < bw * fill - 6; x += 10) this.cutBar.poly([x + 3, 3, x + 10, 3, x + 7, 11, x, 11]).fill({ color: this.cutColor, alpha: 0.95 });
      // scanning light across the frame
      this.cutSweep.x = 20 + ((p * 900) % (W + 200)) - 100;
      if (this.cutPortrait) {
        const k = ease((p - 0.1) * 4);
        this.cutPortrait.root.scale.set(0.6 + k * 0.4);
        this.cutPortrait.root.alpha = k * (Math.random() < 0.05 && p < 1 ? 0.4 : 1);
        this.cutPortrait.update(dt);
      }
      if (p > this.cutDur) this.cine.visible = false;
    }
    for (const c of [...this.cards]) {
      c.life -= dt;
      const inT = ease((3.2 - c.life) * 4), outT = ease((0.4 - c.life) * 3);
      c.root.x = lerp(W + 20, W - 460, inT) + outT * 480;
      c.portrait.update(dt);
      if (c.life <= 0) this.dropCard(c);
    }
    if (this.guide.visible) for (const p of this.guidePortraits) p.update(dt);
    this.arsenal.update(dt);
    for (const l of this.feed) {
      l.life -= dt;
      l.root.alpha = Math.max(0, Math.min(1, l.life));
    }
    if (this.overlay.visible) this.overlay.alpha = Math.min(1, this.overlay.alpha + dt * 2);
    if (this.overlay.visible) {
      this.vicTime += dt;
      const second = this.vicTime > 6;
      this.vicBox.visible = !second;
      this.vicSeason.visible = second;
    }
    this.scan.x = ((this.finalFlash * 260) % (W + 400)) - 200;
    // final assault flashing timer
    this.finalFlash += dt;
    if (this.alertT > 0) {
      this.alertT -= dt;
      const k = Math.min(1, (3.8 - this.alertT) / 0.25), out = Math.min(1, this.alertT / 0.3);
      this.alertBox.alpha = Math.min(k, out);
      this.alertBox.scale.set(0.85 + 0.15 * ease(k));
      if (this.alertT <= 0) this.alertBox.visible = false;
    } else if (this.alertQ.length) this.showAlert(this.alertQ.shift()!);
    if (this.countText.visible) {
      this.countPulse = Math.max(0, this.countPulse - dt * 1.4);
      this.countText.scale.set(1 + this.countPulse * 0.5);
      this.countText.alpha = 0.35 + this.countPulse * 0.6;
    }
    this.textTick -= dt;
    if (this.textTick > 0) return;
    this.textTick = 0.25;
    this.refresh(game, status);
  }

  private refresh(game: Game, status: LiveStatus | 'sim') {
    const w = game.world;
    // throne
    const emp = game.emperor();
    if (emp) {
      const rank = RANKS[rankOf(emp.coins)];
      this.throneName.text = `@${emp.name}`;
      this.throneName.scale.set(Math.min(1, 650 / Math.max(1, this.throneName.width / this.throneName.scale.x)));
      this.throneName.style.fill = 0xffe9a0;
      this.throneCoins.text = `${fmt(emp.today)} coins today · ${rank.name}`;
      this.throneCall.text = `Send ${fmt(emp.today + 1)}+ to steal the throne!`;
    } else {
      this.throneName.text = 'The throne is empty!';
      this.throneName.scale.set(1);
      this.throneCoins.text = '';
      this.throneCall.text = 'First gift today takes the crown';
    }
    // round, timer
    const r = game.round;
    const ter = TERRAINS.find((t) => t.key === game.terrain)!;
    this.roundText.text = `R${r.n} · ${ter.name.toUpperCase()}`;
    this.roundText.scale.set(Math.min(1, 350 / Math.max(1, this.roundText.width / this.roundText.scale.x)));
    const tl = Math.max(0, Math.ceil(r.timeLeft));
    const final = r.state === 'battle' && tl <= 60;
    this.timerText.text = r.state === 'victory' ? 'VICTORY' : final ? `${tl}s · FINAL x2` : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
    this.timerText.style.fill = final ? (Math.sin(this.finalFlash * 8) > 0 ? 0xff3b3b : 0xffd34d) : 0xffffff;
    this.timerText.style.fontSize = final ? 24 : 38;
    this.timerText.scale.set(Math.min(1, 240 / Math.max(1, this.timerText.width / this.timerText.scale.x)));
    const cd = r.state === 'battle' && tl <= 10 && tl > 0 ? tl : -1;
    if (cd !== this.lastCount) {
      this.lastCount = cd;
      this.countPulse = 1;
    }
    this.countText.visible = cd > 0;
    if (cd > 0 && this.countText.text !== String(cd)) {
      this.countText.text = String(cd);
      this.countText.style.fill = cd <= 3 ? 0xff3b3b : 0xffd34d;
    }
    const wd = WEATHERS.find((x) => x.key === game.weather)!;
    const wind = Math.abs(w.wind) > 100 ? ' ' + (w.wind > 0 ? '›' : '‹').repeat(Math.min(4, Math.round(Math.abs(w.wind) / 130))) : '';
    this.weatherText.text = `${wd.icon} ${wd.name.toUpperCase()}${wind}`;
    if (game.nextWeather) {
      const nd = WEATHERS.find((x) => x.key === game.nextWeather)!;
      this.forecastText.text = `NEXT: ${nd.icon} ${nd.name} in ${Math.max(0, Math.ceil(game.weatherIn))}s`;
    } else this.forecastText.text = wd.key === 'clear' ? ter.fx : wd.fx;
    for (const t of [this.throneCoins, this.throneCall, this.weatherText, this.forecastText]) t.scale.set(Math.min(1, 330 / Math.max(1, t.width / t.scale.x)));
    // country strip: top 6 by score
    const ranked = w.factions.filter((f) => f.id !== 0 && f.slot >= 0).sort((a, b) => b.score - a.score).slice(0, 6);
    while (this.stripItems.length < ranked.length) {
      const flag = new Sprite(this.flags.get('XX'));
      flag.anchor.set(0, 0.5);
      flag.scale.set(0.45);
      const text = new Text({ text: '', style: tt(20) });
      text.anchor.set(0, 0.5);
      const bar = new Graphics();
      this.strip.addChild(bar, flag, text);
      this.chestBars.push(bar);
      this.stripItems.push({ flag, text });
    }
    this.stripItems.forEach((it, i) => {
      const f = ranked[i];
      it.flag.visible = it.text.visible = !!f;
      if (!f) return;
      const x = i * 172;
      it.flag.texture = this.flags.get(f.code);
      it.flag.position.set(x, 18);
      it.text.text = fmt(f.score);
      it.text.style.fill = f.fort?.alive === false ? 0x777777 : f.color;
      it.text.position.set(x + 50, 18);
      // war-chest progress toward the next goal
      const bar = this.chestBars[i];
      const g = CHEST_GOALS[f.chestStage];
      const lo = f.chestStage > 0 ? CHEST_GOALS[f.chestStage - 1].coins : 0;
      const k = g ? Math.max(0, Math.min(1, (f.chest - lo) / (g.coins - lo))) : 1;
      bar.clear().rect(x, 33, 150, 4).fill({ color: 0x000000, alpha: 0.5 }).rect(x, 33, 150 * k, 4).fill({ color: f.shieldT > 0 ? 0xffd34d : f.color, alpha: 0.95 });
    });
    for (let i = ranked.length; i < this.chestBars.length; i++) this.chestBars[i].clear();
    this.arsenal.refresh(w.summoned, false);
    // connection dot
    const col = status === 'live' ? 0x3dff7a : status === 'sim' ? 0x7f93b5 : status === 'connecting' ? 0xffd34d : 0xff4f4f;
    this.dot.clear().circle(0, 0, 6).fill(col);
    // rivalry
    const riv = game.topRivalry();
    this.vsBox.visible = !!riv && r.state === 'battle';
    if (riv) {
      this.vsA.texture = this.flags.get(riv[0].code);
      this.vsB.texture = this.flags.get(riv[1].code);
    }
    // tips: SOS > counter call > nothing
    let tip = '', tipCol = 0xffffff;
    const sos = w.slotted.find((f) => f.fort?.alive && f.fort.hp / f.fort.maxHp < 0.25);
    if (sos) {
      tip = `SOS! ${sos.def.name.toUpperCase()} FORTRESS UNDER 25% · gift now to defend it!`;
      tipCol = Math.sin(this.finalFlash * 6) > 0 ? 0xff4f4f : 0xffd34d;
    } else if (game.underdogFid >= 0 && w.factions[game.underdogFid]?.shieldT > 0) {
      const u = w.factions[game.underdogFid];
      tip = `UNDERDOG ${u.def.name.toUpperCase()} · shield ${Math.ceil(u.shieldT)}s · points x1.5 · gift now to turn it around!`;
      tipCol = 0xffd34d;
    } else if (chestCall(w.slotted)) {
      tip = chestCall(w.slotted)!;
      tipCol = 0xffd34d;
    } else if (game.voteOpen) {
      const top = [...game.votes].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${WEATHERS.find((x) => x.key === k)!.icon} ${v}`).join('  ');
      tip = `VOTE THE NEXT WEATHER: type ${TERRAIN_WEATHERS[game.terrain].filter((k) => k !== game.weather).map((k) => WEATHER_CMD[k]).join(' ')}${top ? `   ·   ${top}` : ''}`;
      tipCol = 0x9fdcff;
    } else {
      const bombed = w.slotted.filter((f) => f.hurtBy.air > 400).sort((a, b) => b.hurtBy.air - a.hurtBy.air)[0];
      const armored = w.slotted.filter((f) => f.hurtBy.vehicle + f.hurtBy.mech > 900).sort((a, b) => b.hurtBy.vehicle + b.hurtBy.mech - (a.hurtBy.vehicle + a.hurtBy.mech))[0];
      if (bombed) tip = `${bombed.def.name} is being bombed from the air! Send a ${TIER_LABEL(2)} coin gift + type !aa for ANTI-AIR`;
      else if (armored) tip = `${armored.def.name} is under armour attack! Share the LIVE for ANTI-TANK troops`;
    }
    this.tip.text = tip;
    this.tip.style.fill = tipCol;
    this.tipBg.clear();
    if (tip) {
      const th = this.tip.height + 28, ty = 368 - th / 2;
      panel(this.tipBg, 40, ty, W - 80, th, { color: sos ? 0xff4f4f : GOLD, alpha: 0.75 });
      if (sos) for (let k = 0; k < 6; k++) this.tipBg.poly([52 + k * 16, ty + 6, 60 + k * 16, ty + 6, 52 + k * 16, ty + th - 6, 44 + k * 16, ty + th - 6]).fill({ color: 0xff4f4f, alpha: 0.6 });
    }
    this.tip.visible = !!tip;
    if (tip) this.vsBox.y = 368 + this.tip.height / 2 + 70;
    else this.vsBox.y = 400;
    // how-to-play ticker
    this.tickerT -= 0.25;
    if (this.tickerT <= 0) {
      this.tickerT = 6;
      const codes = ['us', 'uk', 'ca', 'au', 'de', 'fr', 'mx', 'br', 'ph'].filter((c) => COUNTRY_BY_CODE.has(c === 'uk' ? 'GB' : c.toUpperCase()));
      const lines = [
        `TYPE YOUR COUNTRY TO JOIN: ${codes.join(' · ')} …`,
        `CHAT = rifleman · FOLLOW = sniper · SHARE = anti-tank`,
        `ROSE → DRONE / FLAMER / JEEP · ${TIER_LABEL(2)} coins → TANK / AA / SPIDER / REPAIR`,
        `${TIER_LABEL(3)} → HELI / BATTLE TANK / ARTILLERY / EMP`,
        `${TIER_LABEL(4)} → ROBOT / BOMBER / HOVERCRAFT / MOBILE FORTRESS`,
        `${TIER_LABEL(5)} → TITAN / DRONE CARRIER / STORM FORTRESS`,
        `${TIER_LABEL(6)} coins → STRATEGIC BOMBING / ORBITAL CANNON / MECHA DRAGON`,
        ...(() => {
          const m = this.arsenal.missing(w.summoned, 3);
          return m.length ? [`NOT SUMMONED YET THIS ROUND: ${m.join(' · ')} → be the first!`] : [];
        })(),
        `Pick your unit: !tank !aa !emp !mlrs !hover !robot !carrier !dragon …`,
        `${game.cfg.likesPerCrate.toLocaleString('en-US')} LIKES = SUPPLY CRATE (${fmt(game.likesRoom)}/${fmt(game.cfg.likesPerCrate)})`,
        `Hold the ENERGY CORE · REPAIR DEPOT · FACTORY for bonuses`,
        `WAR CHEST: every coin fills your country's bar → ${CHEST_GOALS.map((g) => `${fmt(g.coins)} ${g.label}`).join(' · ')}`,
        `Losing badly? The UNDERDOG gets a shield and x1.5 points: rally your country!`,
        `BOSS RAID at 2:30 · FINAL MINUTE = DOUBLE POINTS · vote the next weather in chat`,
      ];
      this.ticker.text = lines[this.tickerIdx++ % lines.length];
      this.ticker.scale.set(Math.min(1, (W - 80) / Math.max(1, this.ticker.width / this.ticker.scale.x)));
    }
  }

  weatherIcon(k: WeatherKey) {
    return WEATHERS.find((x) => x.key === k)?.icon ?? '';
  }
}
