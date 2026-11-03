// Cyber Mecha Country Wars: entry point. Wires the event sources, the fixed-step simulation,
// the camera director, effects, HUD and the 24/7 watchdog together.
import { Application, Container, type Filter, Rectangle, Sprite } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import { H, SIM_DT, type TerrainKey, W, type WeatherKey, lerp, rand } from './core/config';
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
import { World } from './sim/world';
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

  // ------------------------------------------------------------ assets (all code-drawn, baked once)
  const fx = makeFxTextures();
  const art = makeUnitArt(app.renderer);
  const flags = makeFlags();
  const particles = new Particles(fx, 3000);
  const sfx = new Sfx();
  const weather = new Weather(fx);
  const hud = new Hud(flags);
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
  app.stage.addChild(view, weather.layer, screenFlash, hud.layer, hud.cine, hud.overlay);

  const bloom = new AdvancedBloomFilter({ threshold: 0.62, bloomScale: 0.9, brightness: 1, blur: 6, quality: 4 });
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
  let hot = { x: W / 2, y: H / 2, zoom: 1, hold: 0 };

  world.hooks = {
    feedKill: ({ killer, killerFid, victim }) => {
      game.noteKill(killerFid, victim.fid, victim.def.value);
      if (killer?.uid) {
        const p = game.players.map.get(killer.uid);
        if (p) p.roundKills = (p.roundKills ?? 0) + 1;
      }
      // only notable kills reach the feed (keeps it readable)
      if (victim.def.tier < 2 && !(killer && killer.def.tier >= 4 && killer.def.key !== 'strike' && victim.def.tier >= 1)) return;
      const kf = world.factions[killerFid], vf = world.factions[victim.fid];
      const whom = victim.name ? `@${victim.name}` : vf.def.name;
      if (!kf) return hud.pushFeed(`⚡ Lightning struck ${whom} [${victim.def.name}]`, vf.code, 0xb8d0ff);
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
    cinematic: (u, tier, name, unitName, f) => {
      const dur = tier >= 6 ? 5.5 : tier >= 5 ? 3.4 : 2.4;
      // bigger gifts jump the queue; at most 6 queued. The camera follows the unit as it moves.
      const s: Shot = { at: u, tier, dur, t: 0 };
      if (shots.length < 6) shots.push(s);
      shots.sort((a, b) => b.tier - a.tier);
      hud.cutIn(tier, unitName, name, f.code, f.color, Math.min(dur, 2.8));
      if (tier >= 5) sfx.play('alarm');
    },
    sound: (k, v) => sfx.play(k, v),
  };

  game.onFeed = (t, code, color) => hud.pushFeed(t, code, color);
  game.onTerrain = (k) => setTerrain(k);
  game.onWeather = (k) => setWeather(k);
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
  };
  const unitLabel = (k: UnitKey) => UNITS[k].name.toUpperCase();

  // ------------------------------------------------------------ event sources
  const urls = params.get('ws')?.split(',') ?? fc.liveUrls ?? ['ws://localhost:21213/', 'ws://localhost:21214/'];
  const live = new LiveSource(params.has('nolive') ? [] : urls, (e) => queue.push(e));
  live.start();
  const sim = new Simulator((e) => queue.push(e));
  sim.auto = params.has('sim');

  const watchdog = new Watchdog({ saveNow: () => game.persist(), canvas: app.canvas, refreshHours: fc.refreshHours ?? 6, heapLimitMB: fc.heapLimitMB ?? 1500 });

  const stats = { fps: 60, quality: 'high' as 'high' | 'reduced' };
  await game.start();
  if (!clean) new DevPanel(document.getElementById('ui')!, { game, world, sim, live, queue, sfx, particles, watchdog, setBloom: (on) => ((bloomOn = on), applyFilters()), bloomOn: () => bloomOn, stats: () => stats });
  // first click anywhere enables audio (browsers block autoplay); OBS/Studio sources can use ?sound
  if (params.has('sound')) sfx.enable(true);
  window.addEventListener('pointerdown', () => !sfx.enabled && !params.has('mute') && sfx.enable(true), { once: true });

  // ------------------------------------------------------------ main loop: fixed 30 Hz sim, interpolated render
  let acc = 0, t = 0, heatT = 0, comboT = 0;
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
      tz = p < shot.dur - 0.5 ? (shot.tier >= 5 ? 1.7 : 1.45) : 1;
      tx = shot.at.x;
      ty = shot.at.y;
      if (shot.tier >= 5) timeScale = p < 1.4 ? 0.3 : lerp(0.3, 1, Math.min(1, (p - 1.4) / 0.6));
      if (p >= shot.dur) shot = null;
    } else {
      heatT -= realDt;
      hot.hold -= realDt;
      if (heatT <= 0) {
        heatT = 1;
        let bi = -1, bv = 0;
        world.heat.forEach((v, i) => v > bv && ((bv = v), (bi = i)));
        if (hot.hold <= 0) {
          if (bi >= 0 && bv > 25 && game.round.state === 'battle') {
            hot = { x: ((bi % 6) + 0.5) * (W / 6), y: (Math.floor(bi / 6) + 0.5) * (H / 10), zoom: 1.22, hold: 5 };
          } else hot = { x: W / 2, y: H / 2, zoom: 1, hold: 3 };
        }
      }
      tz = hot.zoom;
      tx = hot.x;
      ty = hot.y;
    }
    const zk = Math.min(1, realDt * (shot ? 4 : 1.2));
    cam.zoom = lerp(cam.zoom, tz, zk);
    const half = 1 - 1 / cam.zoom;
    cam.x = lerp(cam.x, Math.max(W / 2 - (W / 2) * half, Math.min(W / 2 + (W / 2) * half, tx)), zk);
    cam.y = lerp(cam.y, Math.max(H / 2 - (H / 2) * half, Math.min(H / 2 + (H / 2) * half, ty)), zk);
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
    game, world, sim, queue, live, hud, setTerrain, setWeather,
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
      app.ticker.stop();
      app.render();
    },
    render: () => app.render(),
  };
}

main();
