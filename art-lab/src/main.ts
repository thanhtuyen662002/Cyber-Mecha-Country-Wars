import { Application, Container, Graphics, Rectangle, Sprite, Text, TilingSprite } from 'pixi.js';
import { AdvancedBloomFilter, ShockwaveFilter } from 'pixi-filters';
import { H, TEAMS, TERRAINS, type TeamId, type TerrainKey, UNITS, UNIT_KEYS, type UnitKey, W, WEATHERS, type WeatherKey, lerp, rand } from './config';
import { makeFxTextures } from './draw/fxTextures';
import { type ImageArt, loadImageArt } from './draw/imageArt';
import { type TerrainScene, buildTerrain } from './draw/terrain';
import { makeUnitArt } from './draw/units';
import { Particles } from './fx/particles';
import { Sfx } from './fx/sfx';
import { Weather } from './fx/weather';
import { Battle } from './game/battle';
import { type Skin, type UnitVisual, buildFortress, buildVisual } from './game/visuals';

const params = new URLSearchParams(location.search);

async function main() {
  const app = new Application();
  await app.init({ width: W, height: H, background: 0x05070c, antialias: true, resolution: 1, preference: 'webgl', powerPreference: 'high-performance' });
  document.getElementById('stage')!.appendChild(app.canvas);
  if (params.has('clean')) document.body.classList.add('clean');

  const fx = makeFxTextures();
  const art = makeUnitArt(app.renderer);
  const img: ImageArt = await loadImageArt();
  const particles = new Particles(fx, 3000);
  const sfx = new Sfx();
  const weather = new Weather(fx);
  const battle = new Battle(app.renderer, art, img, fx, particles, sfx);

  // ------------------------------------------------------------ scene graph
  const world = new Container();
  world.filterArea = new Rectangle(0, 0, W, H);
  const groundSlot = new Container();
  const underSlot = new Container();
  const overSlot = new Container();
  world.addChild(groundSlot, battle.decal, underSlot, battle.shadows, battle.ground, particles.low, battle.proj, overSlot, battle.air, particles.high, battle.tags);
  const hud = new Container();
  const cine = new Container();
  const gallery = new Container();
  app.stage.addChild(world, weather.layer, hud, cine, gallery);
  gallery.visible = false;

  const bloom = new AdvancedBloomFilter({ threshold: 0.62, bloomScale: 0.9, brightness: 1, blur: 6, quality: 4 });
  let shocks: ShockwaveFilter[] = [];
  let bloomOn = !params.has('nobloom');
  const applyFilters = () => {
    const f = [];
    f.push(...shocks);
    if (bloomOn) f.push(bloom);
    world.filters = f.length ? f : null;
  };
  applyFilters();

  // ------------------------------------------------------------ state
  let skin: Skin = params.get('skin') === 'image' ? 'image' : 'code';
  let terrainKey: TerrainKey = (params.get('terrain') as TerrainKey) || 'jungle';
  let weatherKey: WeatherKey = (params.get('weather') as WeatherKey) || 'clear';
  let terrain: TerrainScene | null = null;
  let imageGround: TilingSprite | null = null;
  let spawnTeam: TeamId = 0;
  let view: 'battle' | 'gallery' = params.get('view') === 'gallery' ? 'gallery' : 'battle';
  let timeScale = 1;
  let hitStop = 0;
  let shake = 0;
  const cam = { x: W / 2, y: H / 2, zoom: 1 };
  let cineT = 0;
  let cineTarget = { x: W / 2, y: H / 2 };

  function setTerrain(k: TerrainKey) {
    terrainKey = k;
    terrain?.destroy();
    imageGround?.destroy();
    imageGround = null;
    particles.clear();
    terrain = buildTerrain(k, fx, particles);
    const def = TERRAINS.find((t) => t.key === k)!;
    battle.terrain = k;
    battle.groundSpeed = def.groundSpeed;
    battle.clearDecals();
    if (skin === 'image') {
      const tex = img.tex[`terrain_${k}`];
      imageGround = new TilingSprite({ texture: tex, width: W, height: H });
      const sc = img.found.has(`terrain_${k}`) ? W / tex.width : 1;
      imageGround.tileScale.set(sc);
      groundSlot.addChild(imageGround);
    } else {
      groundSlot.addChild(terrain.ground);
      underSlot.addChild(terrain.under);
      overSlot.addChild(terrain.over);
    }
    refreshUI();
  }

  function setSkin(s: Skin) {
    skin = s;
    battle.setSkin(s);
    setTerrain(terrainKey);
    if (view === 'gallery') buildGallery();
  }

  function setWeather(k: WeatherKey) {
    weatherKey = k;
    weather.set(k);
    particles.windX = weather.windX;
    refreshUI();
  }

  weather.onStrike = (x, y) => battle.lightningAt(x, y);
  weather.onThunder = () => setTimeout(() => sfx.play('thunder'), 250);
  weather.splash = (x, y) => battle.splash(x, y);

  // ------------------------------------------------------------ HUD
  const hudBg = new Graphics();
  hudBg.rect(0, 0, W, 150).fill({ color: 0x05070c, alpha: 0.55 });
  hudBg.rect(0, 148, W, 2).fill({ color: 0x38c8ff, alpha: 0.3 });
  hud.addChild(hudBg);
  const teamText = TEAMS.map((t, i) => {
    const tx = new Text({ text: `${t.flag} ${t.name}`, style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 40, fill: t.color, stroke: { color: 0x000000, width: 6 } } });
    tx.position.set(i === 0 ? 30 : W - 30, 18);
    tx.anchor.set(i === 0 ? 0 : 1, 0);
    hud.addChild(tx);
    return tx;
  });
  void teamText;
  const vs = new Text({ text: 'VS', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 44, fill: 0xffffff, stroke: { color: 0x000000, width: 6 } } });
  vs.anchor.set(0.5, 0);
  vs.position.set(W / 2, 14);
  hud.addChild(vs);
  const bars = TEAMS.map((t, i) => {
    const bg = new Sprite(fx.white);
    bg.tint = 0x111722;
    bg.position.set(i === 0 ? 30 : W / 2 + 40, 82);
    bg.width = W / 2 - 70;
    bg.height = 18;
    const fg = new Sprite(fx.white);
    fg.tint = t.color;
    fg.position.copyFrom(bg.position);
    fg.height = 18;
    hud.addChild(bg, fg);
    return fg;
  });
  const feedText = new Text({ text: '', style: { fontFamily: 'Arial', fontWeight: '700', fontSize: 26, fill: 0xffffff, stroke: { color: 0x000000, width: 5 }, lineHeight: 34 } });
  feedText.position.set(24, H - 180);
  hud.addChild(feedText);
  const weatherBadge = new Text({ text: '', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 30, fill: 0xffffff, stroke: { color: 0x000000, width: 5 } } });
  weatherBadge.anchor.set(1, 0);
  weatherBadge.position.set(W - 24, 112);
  hud.addChild(weatherBadge);
  const skinBadge = new Text({ text: '', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 28, fill: 0xff4fd8, stroke: { color: 0x000000, width: 5 } } });
  skinBadge.position.set(24, 112);
  hud.addChild(skinBadge);

  const feed: { msg: string; team: TeamId }[] = [];
  let feedDirty = true;
  battle.onFeed = (msg, team) => {
    feed.push({ msg: `${TEAMS[team].flag} ${msg}`, team });
    if (feed.length > 4) feed.shift();
    feedDirty = true;
  };
  battle.onShake = (a) => (shake = Math.min(40, shake + a));
  battle.onHitStop = (s) => (hitStop = Math.max(hitStop, s));
  const screenFlash = new Sprite(fx.white);
  screenFlash.width = W;
  screenFlash.height = H;
  screenFlash.blendMode = 'add';
  screenFlash.tint = 0xffe0b0;
  screenFlash.alpha = 0;
  battle.onBigBoom = (x, y, power) => {
    if (shocks.length >= 3) shocks.shift()?.destroy();
    const sx = (x - cam.x) * cam.zoom + W / 2, sy = (y - cam.y) * cam.zoom + H / 2;
    shocks.push(new ShockwaveFilter({ center: { x: sx, y: sy }, amplitude: 50 * power, wavelength: 200 * power + 60, speed: 1200 * Math.sqrt(power), brightness: 1 + 0.35 * power, radius: 1400 * power, time: 0 }));
    screenFlash.alpha = Math.max(screenFlash.alpha, 0.55 * power);
    applyFilters();
  };

  // Titan cut-in: zoom + slow motion + banner (tier-5 "pay-to-flex" moment)
  app.stage.addChildAt(screenFlash, app.stage.getChildIndex(weather.layer) + 1);
  const cutBand = new Graphics();
  const cutTitle = new Text({ text: 'MECHA TITAN', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 92, fill: 0xffffff, stroke: { color: 0x000000, width: 8 }, letterSpacing: 4 } });
  const cutName = new Text({ text: '', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 46, fill: 0xffe27a, stroke: { color: 0x000000, width: 6 } } });
  cutTitle.anchor.set(0.5);
  cutName.anchor.set(0.5);
  cine.addChild(cutBand, cutTitle, cutName);
  cine.visible = false;
  battle.onTitan = (u, name, team) => {
    cineT = 2.6;
    cineTarget = u;
    cutBand.clear();
    cutBand.poly([0, 820, W, 760, W, 1100, 0, 1160]).fill({ color: 0x000000, alpha: 0.7 });
    cutBand.poly([0, 812, W, 752, W, 764, 0, 824]).fill(team.color);
    cutBand.poly([0, 1152, W, 1092, W, 1104, 0, 1164]).fill(team.color);
    cutTitle.style.fill = team.color;
    cutName.text = `${team.flag} @${name} called it in!`;
  };

  // ------------------------------------------------------------ gallery (side-by-side)
  let galleryItems: { vis: UnitVisual; dist: number }[] = [];
  function buildGallery() {
    gallery.removeChildren().forEach((c) => c.destroy({ children: true }));
    galleryItems = [];
    const bg = new Graphics();
    bg.rect(0, 0, W, H).fill(0x0a0f18);
    for (let x = 0; x < W; x += 40) bg.rect(x, 0, 1, H).fill({ color: 0x38c8ff, alpha: 0.05 });
    for (let y = 0; y < H; y += 40) bg.rect(0, y, W, 1).fill({ color: 0x38c8ff, alpha: 0.05 });
    bg.rect(W / 2 - 1, 150, 2, H - 150).fill({ color: 0xffffff, alpha: 0.15 });
    gallery.addChild(bg);
    const head = (t: string, x: number, c: number) => {
      const tx = new Text({ text: t, style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 40, fill: c } });
      tx.anchor.set(0.5, 0);
      tx.position.set(x, 90);
      gallery.addChild(tx);
    };
    const title = new Text({ text: 'ART COMPARISON', style: { fontFamily: 'Arial', fontWeight: '900', fontSize: 52, fill: 0xffffff, letterSpacing: 3 } });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 20);
    gallery.addChild(title);
    head('A · CODE-DRAWN', W / 4, 0x38c8ff);
    head(`B · IMAGE (${[...img.found].length}/11 files)`, (W * 3) / 4, 0xff4fd8);
    const scale: Record<UnitKey, number> = { infantry: 4.4, drone: 4, tank: 2.6, spider: 2.1, heli: 1.55, titan: 1 };
    const rowH = 215;
    UNIT_KEYS.forEach((k, i) => {
      const y = 260 + i * rowH;
      const label = new Text({ text: `${UNITS[k].name.toUpperCase()}  ·  tier ${UNITS[k].tier}  ·  ${UNITS[k].gift}`, style: { fontFamily: 'Arial', fontWeight: '700', fontSize: 22, fill: 0x9fb4d8 } });
      label.anchor.set(0.5, 0);
      label.position.set(W / 2, y - 95);
      gallery.addChild(label);
      for (const [sk, x] of [['code', W / 4], ['image', (W * 3) / 4]] as const) {
        const holder = new Container();
        holder.position.set(x, y + 10);
        holder.scale.set(scale[k]);
        const vis = buildVisual(k, sk, TEAMS[0], art, img, fx);
        holder.addChild(vis.root); // shadows left out: cleaner side-by-side
        gallery.addChild(holder);
        galleryItems.push({ vis, dist: 0 });
      }
    });
    const fy = 260 + UNIT_KEYS.length * rowH + 60;
    const fl = new Text({ text: 'FORTRESS', style: { fontFamily: 'Arial', fontWeight: '700', fontSize: 22, fill: 0x9fb4d8 } });
    fl.anchor.set(0.5, 0);
    fl.position.set(W / 2, fy - 150);
    gallery.addChild(fl);
    for (const [sk, x] of [['code', W / 4], ['image', (W * 3) / 4]] as const) {
      const f = buildFortress(sk, TEAMS[0], art, img, fx);
      f.root.position.set(x, fy + 20);
      f.root.scale.set(0.8);
      gallery.addChild(f.root);
    }
  }

  // ------------------------------------------------------------ HTML controls
  const ui = document.getElementById('ui')!;
  function btn(label: string, on: boolean, fn: () => void, cls = '') {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = (on ? 'on ' : '') + cls;
    b.onclick = () => {
      fn();
      refreshUI();
    };
    return b;
  }
  function group(title: string, buttons: HTMLElement[]) {
    const g = document.createElement('div');
    g.className = 'grp';
    g.innerHTML = `<div class="lbl">${title}</div>`;
    const r = document.createElement('div');
    r.className = 'row';
    buttons.forEach((b) => r.appendChild(b));
    g.appendChild(r);
    return g;
  }
  let collapsed = window.innerWidth < 700;
  const statsEl = document.createElement('div');
  statsEl.className = 'stats';
  function refreshUI() {
    ui.className = collapsed ? 'collapsed' : '';
    ui.innerHTML = '';
    const h = document.createElement('h1');
    h.innerHTML = `<span>⚙ CMCW Art Lab</span><span>${collapsed ? '▸' : '▾'}</span>`;
    h.onclick = () => ((collapsed = !collapsed), refreshUI());
    ui.appendChild(h);
    const body = document.createElement('div');
    body.className = 'body';
    body.appendChild(group('View', [btn('Battle', view === 'battle', () => setView('battle')), btn('Side-by-side gallery', view === 'gallery', () => setView('gallery'))]));
    body.appendChild(group('Art source', [btn('A · Code-drawn', skin === 'code', () => setSkin('code')), btn('B · Images', skin === 'image', () => setSkin('image'))]));
    body.appendChild(group('Terrain', TERRAINS.map((t) => btn(t.name, terrainKey === t.key, () => setTerrain(t.key)))));
    body.appendChild(group('Weather', WEATHERS.map((w) => btn(w.name, weatherKey === w.key, () => setWeather(w.key)))));
    body.appendChild(group('Spawn for', [btn(`${TEAMS[0].flag} ${TEAMS[0].name}`, spawnTeam === 0, () => (spawnTeam = 0)), btn(`${TEAMS[1].flag} ${TEAMS[1].name}`, spawnTeam === 1, () => (spawnTeam = 1), 'red')]));
    body.appendChild(group('Spawn unit', UNIT_KEYS.map((k) => btn(UNITS[k].name, false, () => battle.spawn(k, spawnTeam)))));
    body.appendChild(
      group('Effects & tests', [
        btn('☢ Strategic strike', false, () => battle.nuke()),
        btn('⚡ Lightning', false, () => weather.lightning(rand(150, W - 150), rand(500, H - 500))),
        btn(battle.auto ? 'Auto battle: ON' : 'Auto battle: OFF', battle.auto, () => (battle.auto = !battle.auto)),
        btn('Stress: fill to 250 units', false, () => {
          for (let i = 0; battle.units.length < 250 && i < 400; i++) battle.spawn(Math.random() < 0.7 ? 'infantry' : 'tank', (i % 2) as TeamId, undefined, false);
        }),
        btn('Reset', false, () => battle.reset()),
        btn(bloomOn ? 'Bloom: ON' : 'Bloom: OFF', bloomOn, () => ((bloomOn = !bloomOn), applyFilters())),
        btn(sfx.enabled ? '🔊 Sound + music: ON' : '🔈 Sound + music: OFF', sfx.enabled, () => sfx.enable(!sfx.enabled)),
      ]),
    );
    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML = `Images found: <b>${img.found.size}/11</b>. Drop PNGs into <code>art-lab/public/art/</code> (names in <code>docs/ART_PROMPTS.md</code>) and reload. Add <code>?clean</code> to the URL for an OBS/TikTok capture without this panel.`;
    body.appendChild(note);
    body.appendChild(statsEl);
    ui.appendChild(body);
    skinBadge.text = skin === 'code' ? 'A · CODE' : 'B · IMAGES';
    skinBadge.style.fill = skin === 'code' ? 0x38c8ff : 0xff4fd8;
    weatherBadge.text = `${{ clear: '☀', rain: '🌧', storm: '⛈', blizzard: '❄', fog: '🌫', wind: '💨' }[weatherKey]} ${WEATHERS.find((w) => w.key === weatherKey)!.name.toUpperCase()}`;
  }

  function setView(v: 'battle' | 'gallery') {
    view = v;
    gallery.visible = v === 'gallery';
    world.visible = hud.visible = weather.layer.visible = v === 'battle';
    if (v === 'gallery') buildGallery();
    refreshUI();
  }

  setTerrain(terrainKey);
  setWeather(weatherKey);
  setView(view);
  // opening scene: a few units so the screen is never empty
  for (let i = 0; i < 14; i++) battle.spawn(i % 5 === 4 ? 'tank' : 'infantry', (i % 2) as TeamId, undefined, false);
  battle.spawn('spider', 0, undefined, false);
  battle.spawn('heli', 1, undefined, false);

  // ------------------------------------------------------------ loop
  let t = 0;
  let fpsAcc = 0, fpsN = 0, fpsShown = 60, lowFpsTime = 0, hudTick = 0;
  app.ticker.add((tk) => {
    const realDt = Math.min(tk.deltaMS / 1000, 1 / 20);
    fpsAcc += tk.FPS;
    fpsN++;
    hudTick -= realDt;

    if (view === 'gallery') {
      t += realDt;
      for (const g of galleryItems) {
        g.dist += realDt * 40;
        g.vis.root.position.set(0, 0);
        g.vis.update({ angle: 0, aim: Math.sin(t * 0.8) * 0.4, moving: 1, dist: g.dist, t, flash: 0 });
      }
      return;
    }

    if (hitStop > 0) {
      hitStop -= realDt;
      return;
    }
    // cinematic
    let targetZoom = 1, tx = W / 2, ty = H / 2;
    if (cineT > 0) {
      cineT -= realDt;
      const p = 2.6 - cineT;
      timeScale = p < 1.3 ? 0.3 : lerp(0.3, 1, Math.min(1, (p - 1.3) / 0.6));
      targetZoom = p < 1.9 ? 1.65 : 1;
      tx = cineTarget.x;
      ty = cineTarget.y;
      cine.visible = p > 0.15 && p < 2.1;
      const slide = Math.min(1, (p - 0.15) * 4);
      cutTitle.position.set(lerp(-500, W / 2, easeOut(slide)), 930);
      cutName.position.set(lerp(W + 500, W / 2, easeOut(slide)), 1030);
    } else {
      timeScale = 1;
      cine.visible = false;
    }
    const zk = Math.min(1, realDt * 4);
    cam.zoom = lerp(cam.zoom, targetZoom, zk);
    const half = 1 - 1 / cam.zoom;
    cam.x = lerp(cam.x, Math.max(W / 2 - (W / 2) * half, Math.min(W / 2 + (W / 2) * half, tx)), zk);
    cam.y = lerp(cam.y, Math.max(H / 2 - (H / 2) * half, Math.min(H / 2 + (H / 2) * half, ty)), zk);
    shake *= Math.pow(0.02, realDt);
    world.pivot.set(cam.x, cam.y);
    world.position.set(W / 2 + rand(-shake, shake) * 0.5, H / 2 + rand(-shake, shake) * 0.5);
    world.scale.set(cam.zoom);

    const dt = realDt * timeScale;
    t += dt;
    battle.update(dt, weather.windX);
    particles.update(dt);
    terrain?.update(dt, t, weather.windX / 420);
    weather.update(dt, t);

    if (shocks.length) {
      for (const s of shocks) s.time += realDt;
      const before = shocks.length;
      shocks = shocks.filter((s) => (s.time > 1.4 ? (s.destroy(), false) : true));
      if (shocks.length !== before) applyFilters();
    }
    screenFlash.alpha = Math.max(0, screenFlash.alpha - realDt * 2.5);

    // auto quality: drop particle budget / bloom if the stream PC struggles
    // music intensity follows the battle: unit count + big moments
    const st0 = battle.units.length;
    let target = 0.25 + Math.min(0.55, st0 / 110) + Math.min(0.3, shake / 60);
    if (cineT > 0 || battle.units.some((u) => u.def.tier >= 5)) target = 1;
    sfx.intensity += (Math.min(1, target) - sfx.intensity) * Math.min(1, realDt * 0.5);
    const fps = tk.FPS;
    lowFpsTime = fps < 50 ? lowFpsTime + realDt : Math.max(0, lowFpsTime - realDt);
    particles.budget = lowFpsTime > 3 ? 0.5 : 1;

    if (hudTick <= 0) {
      hudTick = 0.25; // HUD at 4 Hz (PLAN.md)
      fpsShown = Math.round(fpsAcc / fpsN);
      fpsAcc = fpsN = 0;
      battle.forts.forEach((f, i) => (bars[i].width = (W / 2 - 70) * Math.max(0, f.hp / f.maxHp)));
      if (feedDirty) {
        feedText.text = feed.map((f) => f.msg).join('\n');
        feedDirty = false;
      }
      const st = battle.stats();
      statsEl.textContent = `FPS ${fpsShown}   units ${st.units}/250   particles ${particles.active}/${particles.cap}\nprojectiles ${st.projectiles}   bloom ${bloomOn ? 'on' : 'off'}   quality ${particles.budget === 1 ? 'high' : 'reduced'}`;
    }
  });

  // debug hook for automated screenshots
  const step = (sec: number) => {
    for (let i = 0; i < sec * 30; i++) {
      t += 1 / 30;
      battle.update(1 / 30, weather.windX);
      particles.update(1 / 30);
      terrain?.update(1 / 30, t, weather.windX / 420);
      weather.update(1 / 30, t);
    }
  };
  (window as unknown as { lab: unknown }).lab = { battle, setSkin, setTerrain, setWeather, setView, weather, step, freeze: () => { app.ticker.stop(); app.render(); } };
}

function easeOut(x: number) {
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
}

main();
