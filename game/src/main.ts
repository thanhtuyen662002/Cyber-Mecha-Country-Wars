// Cyber Mecha Country Wars: entry point. Wires the event sources, the fixed-step simulation,
// the camera director, effects, HUD and the 24/7 watchdog together.
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import { Application, Container, type Filter, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import { H, SIM_DT, TERRAINS, type TerrainKey, W, WEATHERS, type WeatherKey, lerp, pick, rand } from './core/config';
import { UNITS, type UnitKey, setTierMin } from './core/units';
import { makeFlags } from './draw/flags';
import { makeFxTextures } from './draw/fxTextures';
import { type TerrainScene, buildTerrain } from './draw/terrain';
import { makeUnitArt } from './draw/units';
import { Particles } from './fx/particles';
import { Sfx } from './fx/sfx';
import { Weather } from './fx/weather';
import { EventQueue, flushStaleCombos } from './net/events';
import { LiveSource } from './net/live';
import { Simulator } from './net/sim';
import { DEFAULT_CONFIG, Game, type GameConfig } from './sim/game';
import { type Unit, World } from './sim/world';
import { wipe } from './sys/persist';
import { Watchdog } from './sys/watchdog';
import { DevPanel } from './ui/devpanel';
import { Hud } from './ui/hud';

declare const __DEMO__: boolean;
const params = new URLSearchParams(location.search);
if (__DEMO__) for (const k of ['sim', 'nolive']) params.set(k, '');

interface FileConfig extends Partial<GameConfig> {
  tierMinCoins?: number[];
  liveUrls?: string[];
  refreshHours?: number;
  heapLimitMB?: number;
}

async function loadConfig(): Promise<FileConfig> {
  try {
    const r = await fetch('./config/game.json', { cache: 'no-store' });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

async function main() {
  if (params.has('reset')) await wipe();
  const fc = await loadConfig();
  if (fc.tierMinCoins) setTierMin(fc.tierMinCoins);
  const cfg: GameConfig = { ...DEFAULT_CONFIG, ...fc };
  if (params.get('round')) cfg.roundSeconds = Number(params.get('round')) || cfg.roundSeconds;

  const lowres = params.has('lowres');
  const app = new Application();
  await app.init({ width: W, height: H, background: 0x05070c, antialias: true, resolution: lowres ? 720 / 1080 : 1, preference: 'webgl', powerPreference: 'high-performance' });
  app.canvas.style.width = '';
  app.canvas.style.height = '';
  document.getElementById('stage')!.appendChild(app.canvas);
  const clean = params.has('clean');
  if (clean) document.body.classList.add('clean');

  // bundled sci-fi fonts must be ready before any Pixi text is rasterised
  try {
    await Promise.race([
      Promise.all(['900 40px Orbitron', '700 40px Orbitron', '700 40px Rajdhani', '600 40px Rajdhani'].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* fall back to system fonts */
  }

  // ------------------------------------------------------------ assets (all code-drawn, baked once)
  const fx = makeFxTextures();
  const art = makeUnitArt(app.renderer);
  const flags = makeFlags();
  const particles = new Particles(fx, 3000);
  const sfx = new Sfx();
  const weather = new Weather(fx);
  const hud = new Hud(flags, art, fx);
  World.reserveSlots();
  const world = new World(app.renderer, art, fx, flags, particles);
  const queue = new EventQueue();
  const game = new Game(world, queue, cfg);

  // ------------------------------------------------------------ scene graph
  const view = new Container(); // camera
  view.filterArea = new Rectangle(0, 0, W, H);
  const groundSlot = new Container();
  const underSlot = new Container();
  const overSlot = new Container();
  view.addChild(groundSlot, world.decal, underSlot, world.pads, world.shadows, world.ground, particles.low, world.proj, overSlot, world.air, particles.high, world.tags);
  const screenFlash = new Sprite(fx.white);
  screenFlash.width = W;
  screenFlash.height = H;
  screenFlash.blendMode = 'add';
  screenFlash.tint = 0xffe0b0;
  screenFlash.alpha = 0;
  app.stage.addChild(view, weather.layer, screenFlash, hud.layer, hud.cine, hud.overlay, hud.guide);

  const bloom = new AdvancedBloomFilter({ threshold: 0.72, bloomScale: 0.75, brightness: 1, blur: 4, quality: 4 });
  let shocks: ShockwaveFilter[] = [];
  let bloomOn = !params.has('nobloom');
  const applyFilters = () => {
    const f: Filter[] = [...shocks];
    if (bloomOn) f.push(bloom);
    view.filters = f.length ? f : null;
  };
  applyFilters();

  // ------------------------------------------------------------ terrain / weather
  let terrain: TerrainScene | null = null;
  const setTerrain = (k: TerrainKey) => {
    terrain?.destroy();
    particles.clear();
    terrain = buildTerrain(k, fx, particles);
    groundSlot.addChild(terrain.ground);
    underSlot.addChild(terrain.under);
    overSlot.addChild(terrain.over);
  };
  const setWeather = (k: WeatherKey) => {
    weather.set(k);
    sfx.setAmbience(k);
    world.weather = k;
    world.wind = weather.windX;
    particles.windX = weather.windX;
  };
  weather.onStrike = (x, y) => world.lightningAt(x, y);
  weather.onThunder = () => setTimeout(() => sfx.play('thunder'), 250);
  weather.splash = (x, y) => world.splash(x, y);

  // ------------------------------------------------------------ camera director
  const cam = { x: W / 2, y: H / 2, zoom: 1 };
  weather.toScreen = (x, y) => ({ x: (x - cam.x) * cam.zoom + W / 2, y: (y - cam.y) * cam.zoom + H / 2 });
  let shake = 0, hitStop = 0, timeScale = 1;
  interface Shot { at: { x: number; y: number }; tier: number; dur: number; t: number }
  const shots: Shot[] = [];
  let shot: Shot | null = null;
  type FocusKind = 'wide' | 'heat' | 'unit' | 'fort';
  const focus: { kind: FocusKind; x: number; y: number; zoom: number; hold: number; unit: Unit | null } = { kind: 'wide', x: W / 2, y: H / 2, zoom: 1.05, hold: 2, unit: null };
  let lastWide = 0;
  const fortHp = new Map<number, number>();
  const pickFocus = () => {
    const now = world.time;
    const set = (kind: FocusKind, x: number, y: number, zoom: number, hold: number, unit: Unit | null = null) =>
      Object.assign(focus, { kind, x, y, zoom, hold, unit });
    // fort damage since the last cut
    let fortHit: { x: number; y: number; d: number } | null = null;
    for (const f of world.slotted) {
      const ft = f.fort;
      if (!ft) continue;
      const d = (fortHp.get(f.id) ?? ft.hp) - ft.hp;
      fortHp.set(f.id, ft.hp);
      if (ft.alive && d > 250 && (!fortHit || d > fortHit.d)) fortHit = { x: ft.x, y: ft.y, d };
    }
    if (game.round.state !== 'battle') return set('wide', W / 2, H / 2, 1, 3);
    if (world.units.length < 3) {
      // quiet moment: tour the fortresses instead of holding a static wide shot
      const forts = world.slotted.map((f) => f.fort).filter((f) => f?.alive);
      const f = forts.length ? pick(forts)! : null;
      return f ? set('fort', f.x, f.y, 1.25, 4) : set('wide', W / 2, H / 2, 1, 3);
    }
    if (now - lastWide > 24) return (lastWide = now), set('wide', W / 2, H / 2, 1, 3.5);
    const opts: (() => void)[] = [];
    // a freshly deployed gift unit
    const fresh = world.units.filter((u) => u.alive && u.def.tier >= 2 && now - u.born < 5 && u.def.key !== 'strike');
    if (fresh.length && focus.kind !== 'unit') {
      const u = fresh.reduce((a, b) => (b.def.tier > a.def.tier || (b.def.tier === a.def.tier && b.born > a.born) ? b : a));
      return set('unit', u.x, u.y, u.def.tier >= 3 ? 1.5 : 1.42, 3.6, u);
    }
    if (fortHit && focus.kind !== 'fort') opts.push(() => set('fort', fortHit!.x, fortHit!.y, 1.32, 4));
    // hottest fight: follow its strongest unit so the camera keeps moving with it
    let bi = -1, bv = 0;
    world.heat.forEach((v, i) => v > bv && ((bv = v), (bi = i)));
    if (bi >= 0 && bv > 12 && focus.kind !== 'heat') {
      const hx = ((bi % 6) + 0.5) * (W / 6), hy = (Math.floor(bi / 6) + 0.5) * (H / 10);
      let best: Unit | null = null, bs = -1;
      for (const u of world.units) {
        if (!u.alive || u.def.key === 'strike') continue;
        const d = Math.hypot(u.x - hx, u.y - hy);
        if (d > 260) continue;
        const sc = u.def.tier * 100 - d * 0.3;
        if (sc > bs) (bs = sc), (best = u);
      }
      opts.push(() => set('heat', hx, hy, 1.38, 4.5, best));
    }
    // a random viewer's unit (viewers love seeing their own name on screen)
    const named = world.units.filter((u) => u.alive && u.name && u.def.key !== 'strike');
    if (named.length) opts.push(() => { const u = pick(named); set('unit', u.x, u.y, 1.45, 3.5, u); });
    if (!opts.length) return set('wide', W / 2, H / 2, 1.08, 3);
    pick(opts)();
  };

  world.hooks = {
    feedKill: ({ killer, killerFid, victim, cause }) => {
      game.noteKill(killerFid, victim.fid, victim.def.value);
      if (killer?.uid) {
        const p = game.players.map.get(killer.uid);
        if (p) p.roundKills = (p.roundKills ?? 0) + 1;
      }
      // only notable kills reach the feed (keeps it readable)
      if (victim.def.tier < 2 && !(killer && killer.def.tier >= 4 && killer.def.key !== 'strike' && victim.def.tier >= 1)) return;
      if (!killer && world.orbitalActive) return; // the orbital beam announces itself
      const kf = world.factions[killerFid], vf = world.factions[victim.fid];
      const whom = victim.name ? `@${victim.name}` : vf.def.name;
      if (!kf) {
        const how = { lava: '🌋 Lava swallowed', pylon: '⚡ A power line fried', depot: '💥 A fuel depot blew up', lightning: '⚡ Lightning struck' }[cause ?? 'lightning'];
        return hud.pushFeed(`${how} ${whom} [${victim.def.name}]`, vf.code, 0xb8d0ff);
      }
      const who = killer?.name ? `@${killer.name}` : kf.def.name;
      hud.pushFeed(`${who} [${killer?.def.name ?? 'Fortress guns'}] ✖ ${whom} [${victim.def.name}]`, kf.code, kf.color);
    },
    feedText: (t, code, color) => hud.pushFeed(t, code, color),
    shake: (a) => (shake = Math.min(40, shake + a)),
    hitStop: (s) => (hitStop = Math.max(hitStop, s)),
    bigBoom: (x, y, power) => {
      if (shocks.length >= 3) shocks.shift()?.destroy();
      const sx = (x - cam.x) * cam.zoom + W / 2, sy = (y - cam.y) * cam.zoom + H / 2;
      shocks.push(new ShockwaveFilter({ center: { x: sx, y: sy }, amplitude: 50 * power, wavelength: 200 * power + 60, speed: 1200 * Math.sqrt(power), brightness: 1 + 0.35 * power, radius: 1400 * power, time: 0 }));
      screenFlash.alpha = Math.max(screenFlash.alpha, 0.55 * power);
      applyFilters();
    },
    cinematic: (u, tier, key, name, unitName, f) => {
      const dur = tier >= 6 ? 5.5 : tier >= 5 ? 3.4 : 2.4;
      // bigger gifts jump the queue; at most 6 queued. The camera follows the unit as it moves.
      const s: Shot = { at: u, tier, dur, t: 0 };
      if (shots.length < 6) shots.push(s);
      shots.sort((a, b) => b.tier - a.tier);
      hud.cutIn(tier, key, unitName, name, f.code, f.color, Math.min(dur, 2.8));
      if (tier >= 5) sfx.play('alarm');
    },
    sound: (k, v = 1, x?: number, y?: number) => {
      if (x === undefined || y === undefined) return sfx.play(k, v);
      // place the sound: stereo from the screen position, quieter + muffled when off screen
      const sx = (x - cam.x) * cam.zoom + W / 2, sy = (y - cam.y) * cam.zoom + H / 2;
      const off = Math.max(0, Math.abs(sx - W / 2) - W / 2, Math.abs(sy - H / 2) - H / 2) / (W * 0.6);
      sfx.play(k, v * (0.85 + 0.15 * Math.min(2, cam.zoom)), (sx - W / 2) / (W / 2) * 0.8, Math.min(1, off));
    },
    bolt: (x, y) => weather.boltAt(x, y),
  };

  game.onFeed = (t, code, color) => hud.pushFeed(t, code, color);
  game.onAlert = (title, sub, color, code) => (hud.alert(title, sub, color, code), sfx.play('alarm', 0.6));
  game.onTerrain = (k) => {
    setTerrain(k);
    const td = TERRAINS.find((x) => x.key === k)!;
    hud.alert(`BATTLEFIELD: ${td.name.toUpperCase()}`, td.fx, 0x7fd8ff);
  };
  game.onWeather = (k) => {
    const changed = world.weather !== k;
    setWeather(k);
    const wd = WEATHERS.find((x) => x.key === k)!;
    if (changed && k !== 'clear') hud.alert(`${wd.icon} ${wd.name.toUpperCase()}`, wd.fx, 0xffd34d);
  };
  game.onRoundEnd = (s) => {
    hud.showVictory(s);
    sfx.play('bigboom');
  };
  game.onRoundStart = (n) => {
    hud.hideVictory();
    hud.pushFeed(`ROUND ${n}: BATTLE STARTS!`, 'XX', 0xffd34d);
    if (watchdog.dueForRefresh()) void watchdog.reload('scheduled-refresh');
  };
  game.onGift = (p, f, gift, coins, count, unit) => {
    if (coins * count >= 10 || count > 1) hud.pushFeed(`@${p.name} sent ${gift}${count > 1 ? ` x${count}` : ''} → ${unitLabel(unit)}`, f.code, f.color);
    // mid-tier gifts get a side card with the unit's picture (tier 4+ already get the full cut-in)
    const t = UNITS[unit].tier;
    if (t >= 2 && t <= 3) hud.deployCard(unit, p.name, f.code, f.color);
  };
  const unitLabel = (k: UnitKey) => UNITS[k].name.toUpperCase();

  // ------------------------------------------------------------ event sources
  const urls = params.get('ws')?.split(',') ?? fc.liveUrls ?? ['ws://localhost:21213/', 'ws://localhost:21214/'];
  const live = new LiveSource(params.has('nolive') ? [] : urls, (e) => queue.push(e));
  live.start();
  const sim = new Simulator((e) => queue.push(e));
  sim.auto = params.has('sim');

  const watchdog = new Watchdog({ saveNow: () => game.persist(), canvas: app.canvas, refreshHours: fc.refreshHours ?? 6, heapLimitMB: fc.heapLimitMB ?? 1500 });
  if (params.has('nowatchdog')) watchdog.paused = true; // offline screenshot tools

  const stats = { fps: 60, quality: 'high' as 'high' | 'reduced' };
  await game.start();
  if (!clean) new DevPanel(document.getElementById('ui')!, { game, world, hud, sim, live, queue, sfx, particles, watchdog, setBloom: (on) => ((bloomOn = on), applyFilters()), bloomOn: () => bloomOn, stats: () => stats });
  // first click anywhere enables audio (browsers block autoplay); OBS/Studio sources can use ?sound
  if (params.has('sound')) sfx.enable(true);
  if (params.has('units')) hud.toggleGuide(true);
  window.addEventListener('pointerdown', () => !sfx.enabled && !params.has('mute') && sfx.enable(true), { once: true });

  // ------------------------------------------------------------ main loop: fixed 30 Hz sim, interpolated render
  let acc = 0, t = 0, comboT = 0;
  let fpsAcc = 0, fpsN = 0, lowFps = 0, goodFps = 0;
  app.ticker.add((tk) => {
    watchdog.frame();
    const realDt = Math.min(tk.deltaMS / 1000, 0.1);
    fpsAcc += tk.FPS;
    fpsN++;
    sim.update(realDt);
    comboT -= realDt;
    if (comboT <= 0) {
      comboT = 1;
      flushStaleCombos(Date.now(), (e) => queue.push(e));
    }

    // director: cinematic shots first, otherwise follow the hottest fight
    if (!shot && shots.length) shot = shots.shift()!;
    let tz = 1, tx = W / 2, ty = H / 2;
    timeScale = 1;
    if (shot) {
      shot.t += realDt;
      const p = shot.t;
      tz = p < shot.dur - 0.5 ? (shot.tier >= 5 ? 1.7 : 1.45) : 1.3;
      tx = shot.at.x;
      ty = shot.at.y;
      if (shot.tier >= 5) timeScale = p < 1.4 ? 0.3 : lerp(0.3, 1, Math.min(1, (p - 1.4) / 0.6));
      if (p >= shot.dur) (shot = null), (focus.hold = 0); // cut to fresh action right after
    } else {
      // roaming director: keep cutting between the action so the stream never looks static
      focus.hold -= realDt;
      if (focus.unit && !focus.unit.alive) focus.hold = Math.min(focus.hold, 0.6);
      if (focus.hold <= 0) pickFocus();
      if (focus.unit?.alive) (focus.x = focus.unit.x), (focus.y = focus.unit.y);
      // slow handheld drift on top of the framing
      tz = focus.zoom + Math.sin(t * 0.31) * 0.03;
      tx = focus.x + Math.sin(t * 0.23) * 40;
      ty = focus.y + Math.cos(t * 0.17) * 60;
    }
    const zk = Math.min(1, realDt * (shot ? 4 : 1.1));
    const pk = Math.min(1, realDt * (shot ? 4 : 1.7));
    cam.zoom = lerp(cam.zoom, tz, zk);
    const half = 1 - 1 / cam.zoom;
    cam.x = lerp(cam.x, Math.max(W / 2 - (W / 2) * half, Math.min(W / 2 + (W / 2) * half, tx)), pk);
    cam.y = lerp(cam.y, Math.max(H / 2 - (H / 2) * half, Math.min(H / 2 + (H / 2) * half, ty)), pk);
    shake *= Math.pow(0.02, realDt);
    view.pivot.set(cam.x, cam.y);
    view.position.set(W / 2 + rand(-shake, shake) * 0.5, H / 2 + rand(-shake, shake) * 0.5);
    view.scale.set(cam.zoom);

    // simulation
    if (hitStop > 0) hitStop -= realDt;
    else {
      acc += realDt * timeScale;
      let steps = 0;
      while (acc >= SIM_DT && steps < 4) {
        game.tick(SIM_DT);
        acc -= SIM_DT;
        steps++;
      }
      if (steps === 4) acc = 0; // never spiral after a long stall
      const dt = realDt * timeScale;
      t += dt;
      particles.update(dt);
      terrain?.update(dt, t, weather.windX / 420);
      weather.update(dt, t);
    }
    world.render(Math.min(1, acc / SIM_DT), t);
    hud.update(realDt, game, sim.auto && live.status !== 'live' ? 'sim' : live.status);

    if (shocks.length) {
      for (const s of shocks) s.time += realDt;
      const before = shocks.length;
      shocks = shocks.filter((s) => (s.time > 1.4 ? (s.destroy(), false) : true));
      if (shocks.length !== before) applyFilters();
    }
    screenFlash.alpha = Math.max(0, screenFlash.alpha - realDt * 2.5);

    // music follows the battle
    let target = 0.25 + Math.min(0.55, world.units.length / 110) + Math.min(0.3, shake / 60);
    if (shot || game.round.timeLeft < 60 || world.units.some((u) => u.def.tier >= 5)) target = 1;
    sfx.intensity += (Math.min(1, target) - sfx.intensity) * Math.min(1, realDt * 0.5);
    sfx.urgent = game.round.state === 'battle' && game.round.timeLeft < 60;

    // auto quality (PLAN.md): avg FPS < 50 for 10 s -> fewer particles + no bloom; restore when stable
    lowFps = tk.FPS < 50 ? lowFps + realDt : Math.max(0, lowFps - realDt * 0.5);
    goodFps = tk.FPS > 57 ? goodFps + realDt : 0;
    if (lowFps > 10 && stats.quality === 'high') {
      stats.quality = 'reduced';
      particles.budget = 0.5;
      if (bloomOn) (bloomOn = false), applyFilters();
    } else if (goodFps > 30 && stats.quality === 'reduced') {
      stats.quality = 'high';
      particles.budget = 1;
      if (!params.has('nobloom')) (bloomOn = true), applyFilters();
      lowFps = 0;
    }
    if (fpsN >= 30) {
      stats.fps = Math.round(fpsAcc / fpsN);
      fpsAcc = fpsN = 0;
    }
  });

  // debug hook for automated tests / screenshots
  (window as unknown as { cmcw: unknown }).cmcw = {
    game, world, sim, queue, live, hud, setTerrain, setWeather, cam, focus, view,
    step: (sec: number) => {
      for (let i = 0; i < sec * 30; i++) {
        game.tick(SIM_DT);
        particles.update(SIM_DT);
        weather.update(SIM_DT, (t += SIM_DT));
      }
      world.render(1, t);
      hud.update(1, game, 'sim');
    },
    freeze: () => {
      watchdog.paused = true;
      app.ticker.stop();
      app.render();
    },
    render: () => app.render(),
    /** Render a design-review grid of unit portraits to a PNG data URL. */
    sheet: async (keys: UnitKey[]) => {
      watchdog.paused = true;
      const p = hud.sheet(keys);
      const url = await app.renderer.extract.base64({ target: p.root, frame: new Rectangle(0, 0, p.w, p.h), resolution: 1 });
      p.destroy();
      return url;
    },
    /** Render baked art parts (e.g. 'fortress', 'capturePad.core') side by side, for design review. */
    parts: async (names: string[], scale = 2, color = 0x38e1ff) => {
      watchdog.paused = true;
      const root = new Container();
      let x = 0, h = 0;
      for (const n of names) {
        const [a, b] = n.split('.');
        const any = art as unknown as Record<string, Record<string, { base: Texture; paint: Texture; glow: Texture }> & { base: Texture; paint: Texture; glow: Texture }>;
        const pt = b ? any[a][b] : any[a];
        const c = new Container();
        const sz = pt.base.width * scale;
        for (const [k, t] of [['base', pt.base], ['paint', pt.paint], ['glow', pt.glow]] as const) {
          const s = new Sprite(t);
          s.anchor.set(0.5);
          if (k !== 'base') s.tint = color;
          if (k === 'glow') s.blendMode = 'add';
          s.scale.set(scale);
          c.addChild(s);
        }
        c.position.set(x + sz / 2, sz / 2);
        x += sz;
        h = Math.max(h, sz);
        root.addChild(c);
      }
      const bg = new Graphics().rect(0, 0, x, h).fill(0x3a3f36);
      root.addChildAt(bg, 0);
      const url = await app.renderer.extract.base64({ target: root, frame: new Rectangle(0, 0, x, h), resolution: 1 });
      root.destroy({ children: true });
      return url;
    },
    /** Render one unit's spec sheet to a PNG data URL. */
    poster: async (key: UnitKey) => {
      watchdog.paused = true;
      const p = hud.poster(key);
      const url = await app.renderer.extract.base64({ target: p.root, frame: new Rectangle(0, 0, 1080, 1350), resolution: 1 });
      p.destroy();
      return url;
    },
  };
}

main();
