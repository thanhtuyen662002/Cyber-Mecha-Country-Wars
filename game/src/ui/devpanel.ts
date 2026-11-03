// Operator panel (HTML, hidden with ?clean so it never shows on stream).
// Test every TikTok action through the same event pipeline as the live connection.
import { WEATHERS } from '../core/config';
import { TIER_MIN } from '../core/units';
import type { EventQueue } from '../net/events';
import type { LiveSource } from '../net/live';
import { ALL_CODES, type Simulator } from '../net/sim';
import type { Particles } from '../fx/particles';
import type { Sfx } from '../fx/sfx';
import type { Game } from '../sim/game';
import type { World } from '../sim/world';
import { wipe } from '../sys/persist';
import type { Watchdog } from '../sys/watchdog';

interface Deps {
  game: Game; world: World; sim: Simulator; live: LiveSource; queue: EventQueue; sfx: Sfx; particles: Particles; watchdog: Watchdog;
  setBloom(on: boolean): void; bloomOn(): boolean; stats: () => { fps: number; quality: string };
}

export class DevPanel {
  private statsEl = document.createElement('div');
  private collapsed = window.innerWidth < 700;
  private code = 'US';

  constructor(private el: HTMLElement, private d: Deps) {
    this.render();
    window.setInterval(() => this.tick(), 500);
  }

  private btn(label: string, fn: () => void, on = false, cls = '') {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = (on ? 'on ' : '') + cls;
    b.onclick = () => {
      fn();
      this.render();
    };
    return b;
  }

  private group(title: string, items: HTMLElement[]) {
    const g = document.createElement('div');
    g.className = 'grp';
    g.innerHTML = `<div class="lbl">${title}</div>`;
    const r = document.createElement('div');
    r.className = 'row';
    items.forEach((b) => r.appendChild(b));
    g.appendChild(r);
    return g;
  }

  render() {
    const { game, sim, sfx } = this.d;
    const el = this.el;
    el.className = this.collapsed ? 'collapsed' : '';
    el.innerHTML = '';
    const h = document.createElement('h1');
    h.innerHTML = `<span>⚙ CMCW operator</span><span>${this.collapsed ? '▸' : '▾'}</span>`;
    h.onclick = () => ((this.collapsed = !this.collapsed), this.render());
    el.appendChild(h);
    const body = document.createElement('div');
    body.className = 'body';
    const sel = document.createElement('select');
    for (const c of ALL_CODES) {
      const o = document.createElement('option');
      o.value = o.textContent = c;
      if (c === this.code) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => (this.code = sel.value);
    body.appendChild(this.group('Simulated viewers', [
      this.btn(sim.auto ? 'Auto viewers: ON' : 'Auto viewers: OFF', () => (sim.auto = !sim.auto), sim.auto),
      this.btn('Rate x2', () => (sim.rate = Math.min(40, sim.rate * 2))),
      this.btn('Rate ÷2', () => (sim.rate = Math.max(0.5, sim.rate / 2))),
    ]));
    body.appendChild(this.group('Viewer joins country', [sel, this.btn('Join', () => sim.join(this.code)), this.btn('Random join', () => sim.join())]));
    body.appendChild(this.group('Free actions', [
      this.btn('Chat', () => sim.chat()), this.btn('Follow', () => sim.follow()), this.btn('Share', () => sim.share()), this.btn('+200 likes', () => sim.likes(200)),
    ]));
    body.appendChild(this.group('Gifts (coins per gift)', [
      this.btn('Rose x1', () => sim.gift(1)), this.btn('Rose x20', () => sim.gift(1, 20)), this.btn('30', () => sim.gift(30)), this.btn('100', () => sim.gift(100)),
      this.btn('500', () => sim.gift(500)), this.btn('1,000', () => sim.gift(1000)), this.btn('10,000', () => sim.gift(10000)), this.btn('44,999', () => sim.gift(44999), false, 'red'),
    ]));
    body.appendChild(this.group('Unit commands (next gift)', ['!tank', '!aa', '!spider', '!drone', '!flame', '!robot', '!bomber'].map((c) => this.btn(c, () => sim.command(c)))));
    body.appendChild(this.group('Weather', WEATHERS.map((w) => this.btn(w.name, () => {
      game.weather = w.key;
      game.nextWeather = null;
      game.weatherIn = 240;
      game.onWeather(w.key);
    }, game.weather === w.key))));
    body.appendChild(this.group('Stress & round', [
      this.btn('Spam 500 gifts', () => sim.spam(500), false, 'red'),
      this.btn('Supply crate', () => this.d.world.dropCrate()),
      this.btn('End round', () => game.endRound()),
      this.btn(this.d.bloomOn() ? 'Bloom: ON' : 'Bloom: OFF', () => this.d.setBloom(!this.d.bloomOn()), this.d.bloomOn()),
      this.btn(sfx.enabled ? '🔊 Sound: ON' : '🔈 Sound: OFF', () => sfx.enable(!sfx.enabled), sfx.enabled),
      this.btn('Wipe save + reload', () => void wipe().then(() => location.reload()), false, 'red'),
    ]));
    const note = document.createElement('div');
    note.className = 'note';
    note.innerHTML = `Tiers (coins): ${TIER_MIN.slice(1).map((v, i) => `T${i + 1} ${v}+`).join(' · ')}<br>Add <code>?clean</code> for the stream capture (hides this panel). <code>?sim</code> starts auto viewers.`;
    body.appendChild(note);
    this.statsEl.className = 'stats';
    body.appendChild(this.statsEl);
    el.appendChild(body);
    this.tick();
  }

  private tick() {
    const { world, live, queue, particles, watchdog, game } = this.d;
    const s = world.stats();
    const st = this.d.stats();
    const heap = watchdog.heapMB();
    this.statsEl.textContent =
      `FPS ${st.fps}  quality ${st.quality}\n` +
      `units ${s.units}/250  projectiles ${s.projectiles}  pooled rigs ${s.pooled}\n` +
      `particles ${particles.active}/${particles.cap}  queue ${queue.size}  dropped ${queue.dropped}/${world.droppedSpawns}\n` +
      `live ${live.status} ${live.url}  msgs ${live.received}\n` +
      `players ${game.players.map.size}  countries ${world.slotted.length}/12${heap ? `  heap ${heap.toFixed(0)} MB` : ''}\n` +
      (live.lastRaw ? `last: ${live.lastRaw.slice(0, 90)}` : '');
  }
}
