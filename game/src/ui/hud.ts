// On-stream HUD (Pixi, so it is captured by TikTok LIVE Studio / OBS with the game).
// Text is refreshed at most 4x per second (PLAN.md); banners animate every frame.
import { Container, Graphics, Sprite, Text, type TextStyleOptions } from 'pixi.js';
import { H, TERRAINS, W, WEATHERS, type WeatherKey, fmt, lerp } from '../core/config';
import { COUNTRY_BY_CODE } from '../core/countries';
import { TIER_LABEL, UNITS } from '../core/units';
import type { FlagAtlas } from '../draw/flags';
import type { LiveStatus } from '../net/live';
import type { Game, RoundSummary } from '../sim/game';
import { RANKS, rankOf } from '../sim/players';

const FONT = 'Arial Black, Arial, sans-serif';
const st = (size: number, fill: number | string = 0xffffff, extra: Partial<TextStyleOptions> = {}): TextStyleOptions => ({
  fontFamily: FONT, fontWeight: '900', fontSize: size, fill, stroke: { color: 0x000000, width: Math.max(3, size / 7) }, ...extra,
});
const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

interface FeedLine { root: Container; flag: Sprite; text: Text; life: number }

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
  // victory
  private vicBg: Graphics;
  private vicBox = new Container();
  private textTick = 0;
  private finalFlash = 0;

  constructor(private flags: FlagAtlas) {
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
  cutIn(tier: number, unitName: string, who: string, code: string, color: number, dur: number) {
    this.cutT = 0;
    this.cutDur = dur;
    const y0 = tier >= 5 ? 760 : 820;
    const h = tier >= 5 ? 340 : 230;
    this.cutBand.clear();
    this.cutBand.poly([0, y0 + 60, W, y0, W, y0 + h, 0, y0 + h + 60]).fill({ color: 0x000000, alpha: 0.72 });
    this.cutBand.poly([0, y0 + 52, W, y0 - 8, W, y0 + 4, 0, y0 + 64]).fill(color);
    this.cutBand.poly([0, y0 + h + 52, W, y0 + h - 8, W, y0 + h + 4, 0, y0 + h + 64]).fill(color);
    this.cutTitle.text = unitName.toUpperCase();
    this.cutTitle.style.fontSize = tier >= 5 ? 92 : 70;
    this.cutTitle.style.fill = tier >= 6 ? 0xffd34d : color;
    this.cutName.text = `@${who} called it in!`;
    this.cutName.style.fontSize = tier >= 5 ? 46 : 36;
    this.cutFlag.texture = this.flags.get(code);
    this.cutFlag.scale.set(tier >= 5 ? 1.1 : 0.8);
    this.cutTitle.y = y0 + h * 0.42 + 20;
    this.cutName.y = y0 + h * 0.78 + 20;
    this.cutFlag.y = this.cutName.y;
    this.cine.visible = true;
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
      this.cutTitle.x = lerp(-600, W / 2, slide) + out * (W + 600);
      this.cutName.x = lerp(W + 600, W / 2 + 40, slide) - out * (W + 600);
      this.cutFlag.x = this.cutName.x - this.cutName.width / 2 - 60;
      this.cutBand.alpha = Math.min(1, p * 6) * (1 - out);
      if (p > this.cutDur) this.cine.visible = false;
    }
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
