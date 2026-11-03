// On-stream HUD (Pixi, so it is captured by TikTok LIVE Studio / OBS with the game).
// Text is refreshed at most 4x per second (PLAN.md); banners animate every frame.
import { Container, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import { H, TERRAINS, W, WEATHERS, type WeatherKey, fmt, lerp } from '../core/config';
import { COUNTRY_BY_CODE } from '../core/countries';
import { COUNTER, TIER_LABEL, TIER_MIN, UNITS, UNIT_KEYS, type UnitKey } from '../core/units';
import type { FlagAtlas } from '../draw/flags';
import type { FxTextures } from '../draw/fxTextures';
import type { UnitArt } from '../draw/units';
import { type UnitVisual, buildVisual } from '../sim/visuals';
import type { LiveStatus } from '../net/live';
import type { Game, RoundSummary } from '../sim/game';
import { RANKS, rankOf } from '../sim/players';

const FONT = 'Arial Black, Arial, sans-serif';
const st = (size: number, fill: number | string = 0xffffff, extra: Partial<TextStyleOptions> = {}): TextStyleOptions => ({
  fontFamily: FONT, fontWeight: '900', fontSize: size, fill, stroke: { color: 0x000000, width: Math.max(3, size / 7) }, ...extra,
});
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

interface FeedLine { root: Container; flag: Sprite; text: Text; life: number }

/** Approximate on-screen footprint (px) of each unit rig, used to frame portraits. */
const FOOT: Record<UnitKey, number> = { infantry: 34, sniper: 44, at: 36, drone: 34, flamer: 34, tank: 62, aa: 62, spider: 104, heli: 120, robot: 92, bomber: 100, titan: 180, strike: 100, jeep: 52, repair: 48, mbt: 90, mlrs: 70, emp: 62, hover: 110, mobile: 150, carrier: 220, stormfort: 150, orbital: 110, dragon: 200 };
const CLASS_NAME = { inf: 'infantry', vehicle: 'vehicles', mech: 'mechs', air: 'aircraft', fort: 'fortresses' } as const;

/** A unit rig animated in place, for cards and the unit guide. */
class Portrait {
  readonly root = new Container();
  private vis: UnitVisual;
  private dist = 0;
  private t = Math.random() * 10;
  constructor(key: UnitKey, color: number, size: number, art: UnitArt, fx: FxTextures) {
    const glow = new Sprite(fx.glow);
    glow.anchor.set(0.5);
    glow.width = glow.height = size * 1.5;
    glow.tint = color;
    glow.alpha = 0.35;
    glow.blendMode = 'add';
    this.vis = buildVisual(key, color, art, fx);
    const holder = new Container();
    holder.scale.set(size / FOOT[key]);
    holder.addChild(this.vis.root);
    this.root.addChild(glow, holder);
  }
  update(dt: number) {
    this.t += dt;
    this.dist += dt * 30;
    this.vis.root.position.set(0, 0);
    const a = -0.5 + Math.sin(this.t * 0.6) * 0.12;
    this.vis.update({ angle: a, aim: a + Math.sin(this.t * 1.3) * 0.35, moving: 0.8, dist: this.dist, t: this.t, flash: 0 });
  }
  destroy() {
    this.vis.shadow.destroy({ children: true });
    this.root.destroy({ children: true });
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
  private textTick = 0;
  private finalFlash = 0;

  constructor(private flags: FlagAtlas, private art: UnitArt, private fx: FxTextures) {
    const top = new Graphics();
    top.rect(0, 0, W, 236).fill({ color: 0x04060b, alpha: 0.62 });
    top.rect(0, 234, W, 3).fill({ color: 0x38c8ff, alpha: 0.35 });
    const bottom = new Graphics();
    bottom.rect(0, H - 96, W, 96).fill({ color: 0x04060b, alpha: 0.7 });
    bottom.rect(0, H - 98, W, 3).fill({ color: 0xffd34d, alpha: 0.4 });
    this.layer.addChild(top, bottom);

    const crown = new Text({ text: '👑 WORLD EMPEROR', style: st(24, 0xffd34d) });
    crown.position.set(24, 14);
    this.throneName = new Text({ text: 'Send a gift to claim the throne', style: st(44, 0xffe9a0) });
    this.throneName.position.set(24, 44);
    this.throneCoins = new Text({ text: '', style: st(26, 0xffd34d) });
    this.throneCoins.anchor.set(1, 0);
    this.throneCoins.position.set(W - 24, 16);
    this.throneCall = new Text({ text: '', style: st(22, 0xffffff) });
    this.throneCall.anchor.set(1, 0);
    this.throneCall.position.set(W - 24, 60);
    this.roundText = new Text({ text: '', style: st(26, 0x9fc4ff) });
    this.roundText.position.set(24, 112);
    this.timerText = new Text({ text: '', style: st(46) });
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(W / 2, 100);
    this.weatherText = new Text({ text: '', style: st(26) });
    this.weatherText.anchor.set(1, 0);
    this.weatherText.position.set(W - 24, 104);
    this.forecastText = new Text({ text: '', style: st(20, 0xffd34d) });
    this.forecastText.anchor.set(1, 0);
    this.forecastText.position.set(W - 24, 138);
    this.strip.position.set(24, 172);
    this.dot = new Graphics();
    this.dot.position.set(W - 14, 228);
    this.layer.addChild(crown, this.throneName, this.throneCoins, this.throneCall, this.roundText, this.timerText, this.weatherText, this.forecastText, this.strip, this.dot);

    // tip / SOS banner
    this.tipBg = new Graphics();
    this.tip = new Text({ text: '', style: st(28, 0xffffff, { align: 'center', wordWrap: true, wordWrapWidth: W - 120 }) });
    this.tip.anchor.set(0.5);
    this.tip.position.set(W / 2, 300);
    this.layer.addChild(this.tipBg, this.tip);

    // rivalry
    this.vsA = new Sprite(flags.get('XX'));
    this.vsB = new Sprite(flags.get('XX'));
    for (const s of [this.vsA, this.vsB]) (s.anchor.set(0.5), s.scale.set(0.75));
    this.vsA.position.set(-110, 0);
    this.vsB.position.set(110, 0);
    this.vsText = new Text({ text: 'VS', style: st(44, 0xff4f4f) });
    this.vsText.anchor.set(0.5);
    const vsBg = new Graphics().roundRect(-180, -42, 360, 84, 18).fill({ color: 0x000000, alpha: 0.55 });
    this.vsBox.addChild(vsBg, this.vsA, this.vsB, this.vsText);
    this.vsBox.position.set(W / 2, 372);
    this.vsBox.visible = false;
    this.layer.addChild(this.vsBox);

    // ticker (how to play)
    this.ticker = new Text({ text: '', style: st(30, 0xffffff, { align: 'center' }) });
    this.ticker.anchor.set(0.5);
    this.ticker.position.set(W / 2, H - 48);
    this.layer.addChild(this.ticker);

    // cut-in
    this.cutTitle = new Text({ text: '', style: st(92, 0xffffff, { letterSpacing: 4 }) });
    this.cutName = new Text({ text: '', style: st(46, 0xffe27a) });
    this.cutFlag = new Sprite(flags.get('XX'));
    for (const t of [this.cutTitle, this.cutName, this.cutFlag]) t.anchor.set(0.5);
    this.cine.addChild(this.cutBand, this.cutTitle, this.cutName, this.cutFlag);
    this.cine.visible = false;
    this.guide.visible = false;

    // victory overlay
    this.vicBg = new Graphics().rect(0, 0, W, H).fill({ color: 0x02040a, alpha: 0.78 });
    this.overlay.addChild(this.vicBg, this.vicBox);
    this.overlay.visible = false;
  }

  // ------------------------------------------------------------ feed
  pushFeed(text: string, code: string, color = 0xffffff) {
    let line = this.feed.length >= 5 ? this.feed.shift()! : null;
    if (!line) {
      const root = new Container();
      const flag = new Sprite(this.flags.get(code));
      flag.anchor.set(0, 0.5);
      flag.scale.set(0.42);
      const t = new Text({ text: '', style: st(25, 0xffffff) });
      t.anchor.set(0, 0.5);
      t.position.set(48, 0);
      root.addChild(flag, t);
      this.layer.addChild(root);
      line = { root, flag, text: t, life: 0 };
    }
    line.flag.texture = this.flags.get(code);
    line.text.text = text.length > 58 ? text.slice(0, 57) + '…' : text;
    line.text.style.fill = color;
    line.life = 9;
    line.root.alpha = 1;
    this.feed.push(line);
    this.feed.forEach((l, i) => l.root.position.set(22, H - 130 - (this.feed.length - 1 - i) * 40));
  }

  // ------------------------------------------------------------ cinematic banner
  cutIn(tier: number, key: UnitKey, unitName: string, who: string, code: string, color: number, dur: number) {
    this.cutT = 0;
    this.cutDur = dur;
    const y0 = tier >= 5 ? 740 : 800;
    const h = tier >= 5 ? 380 : 280;
    this.cutBand.clear();
    this.cutBand.poly([0, y0 + 60, W, y0, W, y0 + h, 0, y0 + h + 60]).fill({ color: 0x000000, alpha: 0.75 });
    this.cutBand.poly([0, y0 + 52, W, y0 - 8, W, y0 + 4, 0, y0 + 64]).fill(color);
    this.cutBand.poly([0, y0 + h + 52, W, y0 + h - 8, W, y0 + h + 4, 0, y0 + h + 64]).fill(color);
    // the unit itself, big, on the left of the banner
    this.cutPortrait?.destroy();
    this.cutPortrait = new Portrait(key === 'strike' ? 'bomber' : key, color, tier >= 5 ? 330 : 250, this.art, this.fx);
    this.cutPortrait.root.y = y0 + h / 2 + 30;
    this.cine.addChildAt(this.cutPortrait.root, 1);
    this.cutTitle.text = unitName.toUpperCase();
    this.cutTitle.style.fontSize = tier >= 5 ? 86 : 66;
    this.cutTitle.style.fill = tier >= 6 ? 0xffd34d : color;
    this.cutTitle.scale.set(Math.min(1, 600 / this.cutTitle.width));
    this.cutName.text = `@${who} called it in!`;
    this.cutName.style.fontSize = tier >= 5 ? 40 : 32;
    this.cutName.scale.set(Math.min(1, 520 / this.cutName.width));
    this.cutFlag.texture = this.flags.get(code);
    this.cutFlag.scale.set(tier >= 5 ? 0.9 : 0.7);
    this.cutTitle.y = y0 + h * 0.42 + 24;
    this.cutName.y = y0 + h * 0.74 + 24;
    this.cutFlag.y = this.cutName.y;
    this.cine.visible = true;
  }

  /** Small slide-in card with the unit's picture for mid-tier gifts. */
  deployCard(key: UnitKey, who: string, code: string, color: number) {
    if (this.cards.length >= 3) this.dropCard(this.cards[0]);
    const used = new Set(this.cards.map((c) => c.slot));
    const slot = [0, 1, 2].find((i) => !used.has(i)) ?? 0;
    const root = new Container();
    const bg = new Graphics();
    bg.roundRect(0, 0, 440, 132, 18).fill({ color: 0x05070c, alpha: 0.82 }).stroke({ width: 3, color, alpha: 0.9 });
    bg.roundRect(10, 10, 112, 112, 12).fill({ color: 0x111827, alpha: 0.9 });
    root.addChild(bg);
    const portrait = new Portrait(key, color, 112, this.art, this.fx);
    portrait.root.position.set(66, 66);
    root.addChild(portrait.root);
    const name = new Text({ text: UNITS[key].name.toUpperCase(), style: st(30, color) });
    name.position.set(138, 16);
    name.scale.set(Math.min(1, 290 / name.width));
    const flag = new Sprite(this.flags.get(code));
    flag.scale.set(0.38);
    flag.position.set(138, 66);
    const by = new Text({ text: `@${who}`, style: st(24, 0xffffff) });
    by.position.set(184, 64);
    by.scale.set(Math.min(1, 240 / by.width));
    const tag = new Text({ text: `TIER ${UNITS[key].tier} · deployed`, style: st(18, 0x9fb4d8) });
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

  /** Full-screen guide of all 13 units with their gift tier and what they counter. */
  toggleGuide(show = !this.guide.visible) {
    this.guide.visible = show;
    for (const p of this.guidePortraits) p.destroy();
    this.guidePortraits = [];
    this.guide.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (!show) return;
    const bg = new Graphics().rect(0, 0, W, H).fill({ color: 0x03050a, alpha: 0.94 });
    this.guide.addChild(bg);
    const title = new Text({ text: 'UNIT GUIDE', style: st(60, 0xffd34d, { letterSpacing: 4 }) });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 40);
    this.guide.addChild(title);
    const cols = 3, cw = W / cols, ch = 350, top = 140;
    const keys = UNIT_KEYS;
    keys.forEach((k, i) => {
      const d = UNITS[k];
      const cx = (i % cols) * cw + cw / 2, cy = top + Math.floor(i / cols) * ch;
      const box = new Graphics().roundRect(cx - cw / 2 + 10, cy, cw - 20, ch - 16, 16).fill({ color: 0x0c1220, alpha: 1 }).stroke({ width: 2, color: 0x23324d });
      this.guide.addChild(box);
      const p = new Portrait(k === 'strike' ? 'bomber' : k, 0x38c8ff, k === 'titan' ? 165 : 150, this.art, this.fx);
      if (k === 'strike') p.root.children[1].tint = 0xffd34d;
      p.root.position.set(cx, cy + 105);
      this.guide.addChild(p.root);
      this.guidePortraits.push(p);
      const name = new Text({ text: d.name.toUpperCase(), style: st(26, 0xffffff) });
      name.anchor.set(0.5, 0);
      name.position.set(cx, cy + 205);
      name.scale.set(Math.min(1, (cw - 40) / name.width));
      const how = d.tier === 0 ? { infantry: 'CHAT', sniper: 'FOLLOW', at: 'SHARE' }[k as 'infantry'] : `${TIER_MIN[d.tier].toLocaleString('en-US')}+ COINS`;
      const tier = new Text({ text: `${how}${d.cmds[0] && d.tier > 0 && d.tier !== 3 && d.tier !== 5 && d.tier !== 6 ? ' · ' + d.cmds[0] : ''}`, style: st(20, 0xffd34d) });
      tier.anchor.set(0.5, 0);
      tier.position.set(cx, cy + 242);
      const strong = (Object.entries(COUNTER[d.weapon]) as [keyof typeof CLASS_NAME, number][]).filter(([, v]) => v >= 1.4).map(([c]) => CLASS_NAME[c]);
      const vs = new Text({ text: strong.length ? `Strong vs ${strong.join(', ')}` : 'All-rounder', style: st(18, 0x9fb4d8, { wordWrap: true, wordWrapWidth: cw - 40, align: 'center' }) });
      vs.anchor.set(0.5, 0);
      vs.position.set(cx, cy + 276);
      this.guide.addChild(name, tier, vs);
    });
  }

  // ------------------------------------------------------------ victory
  showVictory(s: RoundSummary) {
    this.cine.visible = false;
    this.vicBox.removeChildren().forEach((c) => c.destroy());
    const add = <T extends Container>(o: T, x: number, y: number) => (o.position.set(x, y), this.vicBox.addChild(o), o);
    const win = s.ranking[0];
    add(new Text({ text: `ROUND ${s.n} COMPLETE`, style: st(46, 0x9fc4ff) }), W / 2, 360).anchor.set(0.5);
    if (win) {
      const fl = add(new Sprite(this.flags.get(win.code)), W / 2, 580);
      fl.anchor.set(0.5);
      fl.scale.set(2.6);
      const t = add(new Text({ text: `${win.name.toUpperCase()} WINS!`, style: st(86, win.color) }), W / 2, 790);
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
    this.overlay.visible = true;
    this.overlay.alpha = 0;
  }
  hideVictory() {
    this.overlay.visible = false;
  }

  // ------------------------------------------------------------ per frame
  update(dt: number, game: Game, status: LiveStatus | 'sim') {
    // cut-in animation
    if (this.cine.visible) {
      this.cutT += dt;
      const p = this.cutT;
      const slide = ease((p - 0.05) * 4);
      const out = ease((p - (this.cutDur - 0.35)) * 3);
      this.cutTitle.x = lerp(-600, W / 2 + 110, slide) + out * (W + 600);
      this.cutName.x = lerp(W + 600, W / 2 + 150, slide) - out * (W + 600);
      this.cutFlag.x = this.cutName.x - this.cutName.width / 2 - 60;
      this.cutBand.alpha = Math.min(1, p * 6) * (1 - out);
      if (this.cutPortrait) {
        this.cutPortrait.root.x = lerp(-300, 200, ease((p - 0.1) * 3.5)) - out * 700;
        this.cutPortrait.root.alpha = 1 - out;
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
    for (const l of this.feed) {
      l.life -= dt;
      l.root.alpha = Math.max(0, Math.min(1, l.life));
    }
    if (this.overlay.visible) this.overlay.alpha = Math.min(1, this.overlay.alpha + dt * 2);
    // final assault flashing timer
    this.finalFlash += dt;
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
      this.throneName.style.fill = 0xffe9a0;
      this.throneCoins.text = `${fmt(emp.today)} coins today · ${rank.name}`;
      this.throneCall.text = `Send ${fmt(emp.today + 1)}+ to steal the throne!`;
    } else {
      this.throneName.text = 'The throne is empty!';
      this.throneCoins.text = '';
      this.throneCall.text = 'First gift today takes the crown';
    }
    // round, timer
    const r = game.round;
    const ter = TERRAINS.find((t) => t.key === game.terrain)!;
    this.roundText.text = `ROUND ${r.n} · ${ter.name.toUpperCase()}`;
    const tl = Math.max(0, Math.ceil(r.timeLeft));
    const final = r.state === 'battle' && tl <= 60;
    this.timerText.text = r.state === 'victory' ? 'VICTORY' : final ? `⚡ ${tl}s  FINAL ASSAULT x2` : `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
    this.timerText.style.fill = final ? (Math.sin(this.finalFlash * 8) > 0 ? 0xff3b3b : 0xffd34d) : 0xffffff;
    this.timerText.style.fontSize = final ? 40 : 46;
    const wd = WEATHERS.find((x) => x.key === game.weather)!;
    this.weatherText.text = `${wd.icon} ${wd.name.toUpperCase()}`;
    if (game.nextWeather) {
      const nd = WEATHERS.find((x) => x.key === game.nextWeather)!;
      this.forecastText.text = `NEXT: ${nd.icon} ${nd.name} in ${Math.max(0, Math.ceil(game.weatherIn))}s`;
    } else this.forecastText.text = wd.key === 'clear' ? '' : wd.hint;
    // country strip: top 6 by score
    const ranked = w.factions.filter((f) => f.id !== 0 && f.slot >= 0).sort((a, b) => b.score - a.score).slice(0, 6);
    while (this.stripItems.length < ranked.length) {
      const flag = new Sprite(this.flags.get('XX'));
      flag.anchor.set(0, 0.5);
      flag.scale.set(0.45);
      const text = new Text({ text: '', style: st(24) });
      text.anchor.set(0, 0.5);
      this.strip.addChild(flag, text);
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
    });
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
    } else {
      const bombed = w.slotted.filter((f) => f.hurtBy.air > 400).sort((a, b) => b.hurtBy.air - a.hurtBy.air)[0];
      const armored = w.slotted.filter((f) => f.hurtBy.vehicle + f.hurtBy.mech > 900).sort((a, b) => b.hurtBy.vehicle + b.hurtBy.mech - (a.hurtBy.vehicle + a.hurtBy.mech))[0];
      if (bombed) tip = `${bombed.def.name} is being bombed from the air! Send a ${TIER_LABEL(2)} coin gift + type !aa for ANTI-AIR`;
      else if (armored) tip = `${armored.def.name} is under armour attack! Share the LIVE for ANTI-TANK troops`;
    }
    this.tip.text = tip;
    this.tip.style.fill = tipCol;
    this.tipBg.clear();
    if (tip) this.tipBg.roundRect(40, 300 - this.tip.height / 2 - 12, W - 80, this.tip.height + 24, 14).fill({ color: 0x000000, alpha: 0.6 });
    this.tip.visible = !!tip;
    if (tip) this.vsBox.y = 300 + this.tip.height / 2 + 70;
    else this.vsBox.y = 330;
    // how-to-play ticker
    this.tickerT -= 0.25;
    if (this.tickerT <= 0) {
      this.tickerT = 6;
      const codes = ['us', 'uk', 'ca', 'au', 'de', 'fr', 'mx', 'br', 'ph'].filter((c) => COUNTRY_BY_CODE.has(c === 'uk' ? 'GB' : c.toUpperCase()));
      const lines = [
        `TYPE YOUR COUNTRY TO JOIN: ${codes.join(' · ')} …`,
        `CHAT = rifleman · FOLLOW = sniper · SHARE = anti-tank`,
        `ROSE → ${UNITS.drone.name} · ${TIER_LABEL(2)} coins → TANK / AA / SPIDER`,
        `${TIER_LABEL(3)} → HELI · ${TIER_LABEL(4)} → ROBOT / BOMBER · ${TIER_LABEL(5)} → MECHA TITAN`,
        `${TIER_LABEL(6)} coins → ☢ STRATEGIC BOMBING`,
        `Pick your unit: !tank !aa !spider !drone !flame !robot !bomber`,
        `${game.cfg.likesPerCrate.toLocaleString('en-US')} LIKES = SUPPLY CRATE (${fmt(game.likesRoom)}/${fmt(game.cfg.likesPerCrate)})`,
        `Hold the ENERGY CORE · REPAIR DEPOT · FACTORY for bonuses`,
      ];
      this.ticker.text = lines[this.tickerIdx++ % lines.length];
    }
  }

  weatherIcon(k: WeatherKey) {
    return WEATHERS.find((x) => x.key === k)?.icon ?? '';
  }
}
