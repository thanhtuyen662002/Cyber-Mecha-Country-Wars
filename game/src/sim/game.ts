// Game rules on top of the World: what each TikTok action does, rounds, weather schedule,
// CPU reinforcements, supply-drop triggers, season stats and the 30-second save.
import { TERRAINS, TERRAIN_WEATHERS, type TerrainKey, WEATHERS, type WeatherKey, pick, rand } from '../core/config';
import { COUNTRY_BY_CODE, parseCountry } from '../core/countries';
import { TIER_UNITS, UNITS, UNIT_CMDS, type UnitKey, tierOf } from '../core/units';
import type { EventQueue, GameEvent } from '../net/events';
import { load, save } from '../sys/persist';
import { type Player, Players, dayKey, rankOf } from './players';
import type { Faction, World } from './world';

export interface GameConfig {
  roundSeconds: number;
  victorySeconds: number;
  seedCountries: string[];
  /** seconds without live events before CPU reinforcements ramp up */
  idleSeconds: number;
  likesPerCrate: number;
  sharesPerCrate: number;
  chatSpawnCooldown: number;
  eventsPerTick: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  roundSeconds: 5 * 60,
  victorySeconds: 12,
  seedCountries: ['US', 'GB', 'CA', 'AU'],
  idleSeconds: 45,
  likesPerCrate: 1000,
  sharesPerCrate: 10,
  chatSpawnCooldown: 15,
  eventsPerTick: 8,
};

export interface RoundSummary {
  n: number;
  ranking: { code: string; name: string; score: number; kills: number; color: number }[];
  mvp: Player | null;
  topDonor: Player | null;
  /** this month's country standings (wins, coins) */
  season: { code: string; name: string; wins: number; coins: number }[];
  /** all-time top supporters */
  legends: { name: string; coins: number; rank: number; country: string | null }[];
}

/** Chat words that vote for the next weather. */
const WEATHER_VOTES: Record<string, WeatherKey> = {
  '!clear': 'clear', '!sun': 'clear', '!rain': 'rain', '!storm': 'storm', '!thunder': 'storm', '!snow': 'blizzard', '!blizzard': 'blizzard',
  '!fog': 'fog', '!wind': 'wind', '!sand': 'sandstorm', '!sandstorm': 'sandstorm', '!heat': 'heatwave', '!heatwave': 'heatwave', '!emp': 'emstorm', '!em': 'emstorm',
};

/** Shared war-chest goals: every coin gifted to a country this round fills its chest; each goal calls in a reward. */
export const CHEST_GOALS: { coins: number; label: string; units: [UnitKey, number] }[] = [
  { coins: 300, label: '3 BATTLE TANKS', units: ['mbt', 3] },
  { coins: 1500, label: '2 WAR ROBOTS', units: ['robot', 2] },
  { coins: 5000, label: 'MECHA TITAN', units: ['titan', 1] },
  { coins: 15000, label: 'ORBITAL CANNON', units: ['orbital', 1] },
];

export interface SeasonStats {
  key: string; // YYYY-MM
  countries: Record<string, { wins: number; coins: number }>;
}

const SAVE_KEY = 'state-v1';

export class Game {
  readonly players = new Players();
  round = { n: 1, timeLeft: 900, state: 'battle' as 'battle' | 'victory', victoryT: 0, terrainIdx: 0 };
  weather: WeatherKey = 'clear';
  nextWeather: WeatherKey | null = null;
  weatherIn = 120;
  season: SeasonStats = { key: new Date().toISOString().slice(0, 7), countries: {} };
  lastSummary: RoundSummary | null = null;
  likesRoom = 0;
  sharesRoom = 0;
  lastLive = -999;
  voteOpen = false;
  readonly votes = new Map<WeatherKey, number>();
  private voters = new Set<string>(); // world time of last real (non-simulated) event
  private crateT = 120;
  private botT = 2;
  private saveT = 30;
  private lockNotice = new Map<string, number>();
  /** recent kill value between two countries, for the rivalry banner */
  readonly rivalry = new Map<string, number>();

  // UI hooks
  onFeed: (text: string, code: string, color?: number) => void = () => {};
  onTerrain: (key: TerrainKey) => void = () => {};
  onWeather: (key: WeatherKey) => void = () => {};
  onRoundEnd: (s: RoundSummary) => void = () => {};
  onRoundStart: (n: number) => void = () => {};
  onAlert: (title: string, sub: string, color: number, code?: string) => void = () => {};
  onGift: (p: Player, f: Faction, gift: string, coins: number, count: number, unit: UnitKey) => void = () => {};

  constructor(readonly world: World, private queue: EventQueue, readonly cfg: GameConfig = DEFAULT_CONFIG) {
    this.round.timeLeft = cfg.roundSeconds;
  }

  get terrain(): TerrainKey {
    return TERRAINS[this.round.terrainIdx % TERRAINS.length].key;
  }

  // ---------------------------------------------------------------- start / restore
  async start() {
    const saved = await load<any>(SAVE_KEY);
    if (saved?.v === 1) {
      this.players.restore(saved.players);
      if (saved.season?.key === this.season.key) this.season = saved.season;
      this.likesRoom = saved.likesRoom ?? 0;
      this.sharesRoom = saved.sharesRoom ?? 0;
      const fresh = Date.now() - saved.savedAt < 15 * 60 * 1000;
      if (fresh && saved.round) {
        this.round.n = saved.round.n;
        this.round.terrainIdx = saved.round.terrainIdx;
        this.round.timeLeft = Math.max(30, saved.round.timeLeft);
        this.weather = saved.round.weather ?? 'clear';
        this.fitWeather();
        this.onTerrain(this.terrain);
        this.world.terrain = this.terrain;
        this.world.restore(saved.world);
        this.onWeather(this.weather);
        this.onFeed(`Battle resumed: round ${this.round.n}`, 'XX', 0x9aa4b8);
        this.seed();
        return;
      }
      this.round.n = (saved.round?.n ?? 0) + 1;
      this.round.terrainIdx = (saved.round?.terrainIdx ?? -1) + 1;
    }
    this.onTerrain(this.terrain);
    this.world.newRound(this.terrain);
    this.seed();
    this.fitWeather();
    this.onWeather(this.weather);
    this.onRoundStart(this.round.n);
  }

  private seed() {
    for (const c of this.cfg.seedCountries) if (COUNTRY_BY_CODE.has(c) && this.world.slotted.length < 4) this.world.faction(c);
  }

  async persist() {
    await save(SAVE_KEY, {
      v: 1,
      savedAt: Date.now(),
      round: { n: this.round.n, terrainIdx: this.round.terrainIdx, timeLeft: this.round.state === 'battle' ? this.round.timeLeft : 0, weather: this.weather },
      world: this.world.snapshot(),
      players: this.players.serialize(),
      season: this.season,
      likesRoom: this.likesRoom,
      sharesRoom: this.sharesRoom,
    });
  }

  // ---------------------------------------------------------------- events
  handle(e: GameEvent, simulated = false) {
    const w = this.world;
    if (!simulated) this.lastLive = w.time;
    const p = this.players.get(e.uid, e.name, e.nick);
    const home = () => (p.country ? w.faction(p.country) : w.merc);
    switch (e.k) {
      case 'chat': {
        const code = parseCountry(e.text);
        if (code) return this.join(p, code);
        const cmd = e.text.trim().toLowerCase().split(/\s+/)[0];
        const wv = WEATHER_VOTES[cmd];
        if (wv && this.voteOpen && wv !== this.weather && TERRAIN_WEATHERS[this.terrain].includes(wv) && !this.voters.has(p.uid)) {
          this.voters.add(p.uid);
          this.votes.set(wv, (this.votes.get(wv) ?? 0) + 1 + Math.min(4, rankOf(p.coins)));
          return;
        }
        const key = UNIT_CMDS.get(cmd);
        if (key) {
          p.pref[UNITS[key].tier] = key;
          this.onFeed(`@${p.name} set next ${UNITS[key].tier === 0 ? 'free unit' : `tier ${UNITS[key].tier} gift`} → ${UNITS[key].name}`, p.country ?? 'XX');
          return;
        }
        // any chat from a soldier = one rifleman (rate-limited per viewer)
        if (p.country && w.time >= (p.nextChatSpawn ?? 0)) {
          p.nextChatSpawn = w.time + this.cfg.chatSpawnCooldown;
          w.spawn('infantry', home().id, p.name, p.uid, rankOf(p.coins));
        }
        return;
      }
      case 'gift': {
        const total = e.coins * e.count;
        this.players.addCoins(p, total);
        const f = home();
        const sc = (this.season.countries[f.code] ??= { wins: 0, coins: 0 });
        sc.coins += total;
        if (f.id !== 0) this.fillChest(f, total * f.boost);
        const tier = tierOf(e.coins);
        const pref = p.pref[tier];
        const key: UnitKey = pref && TIER_UNITS[tier].includes(pref) ? pref : this.autoPick(tier, f);
        const maxN = tier >= 6 ? 3 : tier >= 4 ? 5 : 10;
        const n = Math.min(e.count, maxN);
        const extra = e.count - n;
        for (let i = 0; i < n; i++) w.spawn(key, f.id, p.name, p.uid, rankOf(p.coins), undefined, i === n - 1 && extra > 0 ? 1 + Math.min(4, (extra / maxN) * 0.5) : 1);
        if (tier >= 5) w.dropCrate(true, p.name);
        this.onGift(p, f, e.gift, e.coins, e.count, key);
        if (!p.country && tier >= 1 && (this.lockNotice.get('m' + p.uid) ?? -99) < this.world.time - 90 && (this.lockNotice.set('m' + p.uid, this.world.time), true)) this.onFeed(`@${p.name} fights as a MERCENARY: type your country code (us, uk, ca…) to join your nation!`, 'XX', 0xffd34d);
        return;
      }
      case 'like': {
        this.likesRoom += e.count;
        p.likeAcc = (p.likeAcc ?? 0) + e.count;
        if (p.likeAcc >= 100 && p.country) {
          p.likeAcc -= 100;
          w.spawn('infantry', home().id, p.name, p.uid, rankOf(p.coins));
        }
        if (this.likesRoom >= this.cfg.likesPerCrate) {
          this.likesRoom -= this.cfg.likesPerCrate;
          w.dropCrate();
          this.onFeed(`${this.cfg.likesPerCrate.toLocaleString('en-US')} likes! Supply crate dropping`, 'XX', 0xff6fa8);
        }
        return;
      }
      case 'follow': {
        w.spawn('sniper', home().id, p.name, p.uid, rankOf(p.coins));
        this.onFeed(`@${p.name} followed → SNIPER deployed`, p.country ?? 'XX');
        return;
      }
      case 'share': {
        w.spawn('at', home().id, p.name, p.uid, rankOf(p.coins));
        this.sharesRoom++;
        if (this.sharesRoom >= this.cfg.sharesPerCrate) {
          this.sharesRoom = 0;
          w.dropCrate();
        }
        this.onFeed(`@${p.name} shared → ANTI-TANK deployed`, p.country ?? 'XX');
        return;
      }
    }
  }

  private join(p: Player, code: string) {
    if (this.lockNotice.size > 2000) this.lockNotice.clear();
    const r = this.players.setCountry(p, code);
    const def = COUNTRY_BY_CODE.get(code)!;
    if (r === 'locked') {
      if ((this.lockNotice.get(p.uid) ?? -99) < this.world.time - 60) {
        this.lockNotice.set(p.uid, this.world.time);
        this.onFeed(`@${p.name} already switched today: still fighting for ${COUNTRY_BY_CODE.get(p.country!)?.name}`, p.country!, 0x9aa4b8);
      }
      return;
    }
    const f = this.world.faction(code);
    if (r === 'ok') {
      this.onFeed(`@${p.name} joined ${def.name}!`, code, f.color);
      this.world.spawn('infantry', f.id, p.name, p.uid, rankOf(p.coins));
      p.nextChatSpawn = this.world.time + this.cfg.chatSpawnCooldown;
    }
  }

  /** No preference: call the unit that counters what the enemy fields most. */
  autoPick(tier: number, f: Faction): UnitKey {
    const opts = TIER_UNITS[tier] ?? TIER_UNITS[1];
    if (opts.length === 1) return opts[0];
    const enemy = { inf: 0, vehicle: 0, mech: 0, air: 0 };
    for (const o of this.world.factions) {
      if (o.id === f.id) continue;
      enemy.inf += o.cls.inf;
      enemy.vehicle += o.cls.vehicle;
      enemy.mech += o.cls.mech;
      enemy.air += o.cls.air;
    }
    const enemyAA = this.world.units.filter((u) => (u.def.key === 'aa' || u.def.key === 'mobile') && u.fid !== f.id).length;
    const armour = enemy.vehicle + enemy.mech;
    const wounded = this.world.units.filter((u) => u.fid === f.id && u.def.tier >= 2 && u.hp < u.maxHp * 0.6).length;
    const r = Math.random();
    switch (tier) {
      case 0:
        return 'infantry';
      case 1:
        if (enemy.inf > 25 && r < 0.45) return 'flamer';
        return r < 0.4 ? 'drone' : r < 0.7 ? 'jeep' : 'flamer';
      case 2:
        if (enemy.air >= 4 || f.hurtBy.air > 300) return 'aa';
        if (wounded >= 3 && r < 0.4) return 'repair';
        return armour > enemy.inf * 0.3 ? (r < 0.5 ? 'spider' : 'tank') : r < 0.55 ? 'tank' : r < 0.85 ? 'spider' : 'repair';
      case 3:
        if (enemy.mech + enemy.air >= 6 && r < 0.5) return 'emp';
        if (enemyAA >= 3) return r < 0.5 ? 'mbt' : 'mlrs';
        return r < 0.3 ? 'heli' : r < 0.55 ? 'mbt' : r < 0.8 ? 'mlrs' : 'emp';
      case 4:
        if (enemyAA >= 3) return r < 0.4 ? 'robot' : r < 0.7 ? 'mobile' : 'hover';
        return r < 0.3 ? 'bomber' : r < 0.55 ? 'robot' : r < 0.8 ? 'hover' : 'mobile';
      case 5:
        if (enemy.air >= 8) return r < 0.6 ? 'carrier' : 'titan';
        return r < 0.4 ? 'titan' : r < 0.7 ? 'stormfort' : 'carrier';
      case 6:
        return r < 0.4 ? 'strike' : r < 0.7 ? 'orbital' : 'dragon';
      default:
        return pick(opts);
    }
  }

  // ---------------------------------------------------------------- tick
  tick(dt: number) {
    const w = this.world;
    // drain the event queue at a fixed rate
    for (let i = 0; i < this.cfg.eventsPerTick; i++) {
      const e = this.queue.take();
      if (!e) break;
      this.handle(e, e.uid.startsWith('sim'));
    }
    if (this.round.state === 'victory') {
      this.round.victoryT -= dt;
      if (this.round.victoryT <= 0) this.newRound();
      w.update(dt);
      return;
    }
    const before = this.round.timeLeft;
    this.round.timeLeft -= dt;
    w.mult = this.round.timeLeft <= 60 ? 2 : 1;
    if (before > 60 && this.round.timeLeft <= 60) {
      this.onAlert('FINAL MINUTE', 'ALL POINTS x2 · every gift counts double!', 0xff3b3b);
      this.onFeed('FINAL MINUTE! All points x2', 'XX', 0xff3b3b);
    }
    this.underdog(dt);
    this.bossRaid(before);
    w.update(dt);
    this.bots(dt);
    // weather schedule: forecast 15 s ahead (PLAN.md)
    this.weatherIn -= dt;
    // viewers vote the next weather in the 30 s before the forecast (!rain, !storm, !fog...)
    if (!this.nextWeather && !this.voteOpen && this.weatherIn <= 45) {
      this.voteOpen = true;
      this.votes.clear();
      this.voters.clear();
    }
    if (!this.nextWeather && this.weatherIn <= 15) {
      this.voteOpen = false;
      const opts = TERRAIN_WEATHERS[this.terrain].filter((k) => k !== this.weather);
      const top = [...this.votes].sort((a, b) => b[1] - a[1])[0];
      if (top) {
        this.nextWeather = top[0];
        this.onFeed(`Viewers voted: ${WEATHERS.find((x) => x.key === top[0])!.name} incoming!`, 'XX', 0x7fd8ff);
      } else this.nextWeather = this.weather !== 'clear' && Math.random() < 0.35 ? 'clear' : pick(opts.filter((k) => k !== 'clear'));
    }
    if (this.weatherIn <= 0 && this.nextWeather) {
      this.weather = this.nextWeather;
      this.nextWeather = null;
      this.weatherIn = rand(180, 300);
      this.onWeather(this.weather);
    }
    // random supply drops
    this.crateT -= dt;
    if (this.crateT <= 0) {
      this.crateT = 120;
      w.dropCrate();
    }
    // rivalry decay
    for (const [k, v] of this.rivalry) {
      const nv = v * (1 - dt * 0.03);
      if (nv < 1) this.rivalry.delete(k);
      else this.rivalry.set(k, nv);
    }
    // round end: time out, or one fortress left standing
    const standing = w.slotted.filter((f) => f.fort?.alive);
    if (this.round.timeLeft <= 0 || (w.slotted.length >= 2 && standing.length <= 1 && this.cfg.roundSeconds - this.round.timeLeft > 60)) this.endRound();
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 30;
      void this.persist();
    }
  }

  /** Add coins to a country's shared war chest and pay out any goals reached. */
  fillChest(f: Faction, coins: number) {
    const w = this.world;
    const prev = f.chest;
    f.chest += coins;
    while (f.chestStage < CHEST_GOALS.length && f.chest >= CHEST_GOALS[f.chestStage].coins) {
      const g = CHEST_GOALS[f.chestStage++];
      for (let i = 0; i < g.units[1]; i++) w.spawn(g.units[0], f.id, `${f.def.name} WAR CHEST`, `chest:${f.code}`, 0);
      this.onAlert(`${f.def.name.toUpperCase()} WAR CHEST`, `Goal reached → ${g.label} deployed!`, f.color, f.code);
      this.onFeed(`${f.def.name} war chest full → ${g.label}!`, f.code, f.color);
    }
    const g = CHEST_GOALS[f.chestStage];
    if (g && prev < g.coins * 0.75 && f.chest >= g.coins * 0.75) this.onFeed(`${f.def.name} war chest ${Math.floor(f.chest)}/${g.coins} → ${g.label} almost unlocked!`, f.code, f.color);
  }

  /** Mid-round event: a neutral ROGUE TITAN drops in the centre; the country that deals the most damage wins a big bonus. */
  boss: import('./world').Unit | null = null;
  private bossRaid(before: number) {
    const w = this.world;
    if (!this.boss && before > 150 && this.round.timeLeft <= 150 && w.slotted.filter((f) => f.fort?.alive).length >= 2) {
      w.bossDmg.clear();
      const u = w.spawn('titan', 0, 'ROGUE TITAN', 'boss', 0, { x: 540, y: 1010 });
      if (u) {
        u.maxHp = u.hp = u.def.hp * 2.5;
        this.boss = u;
        this.onAlert('BOSS RAID: ROGUE TITAN', 'Hit it hardest → +1500 points for your country!', 0xff4fd8);
        this.onFeed('BOSS RAID! A Rogue Titan has landed in the centre', 'XX', 0xff4fd8);
      }
    }
    if (this.boss && !this.boss.alive) {
      const top = [...w.bossDmg].sort((a, b) => b[1] - a[1])[0];
      if (top && w.factions[top[0]]) {
        const f = w.factions[top[0]];
        f.score += 1500 * w.mult;
        this.onAlert(`${f.def.name.toUpperCase()} SLAYS THE BOSS`, `Most damage on the Rogue Titan → +${1500 * w.mult} points`, f.color, f.code);
        this.onFeed(`${f.def.name} wins the boss raid: +${1500 * w.mult} points`, f.code, f.color);
      }
      this.boss = null;
    }
  }

  /** Comeback rule: when one country runs away with the round, the weakest standing fortress gets a shield and x1.5 points. */
  private underdogT = 20;
  underdogFid = -1;
  private underdog(dt: number) {
    const w = this.world;
    for (const f of w.slotted) if (f.shieldT > 0 && (f.shieldT -= dt) <= 0) (f.shieldT = 0), (f.boost = 1), this.underdogFid === f.id && (this.underdogFid = -1);
    if ((this.underdogT -= dt) > 0 || this.underdogFid >= 0 || this.round.timeLeft < 20) return;
    this.underdogT = 15;
    const alive = w.slotted.filter((f) => f.fort?.alive).sort((a, b) => b.score - a.score);
    if (alive.length < 3) return;
    const lead = alive[0], low = alive[alive.length - 1];
    if (lead.score < 400 || low.score > lead.score * 0.4) return;
    low.boost = 1.5;
    low.shieldT = 45;
    this.underdogFid = low.id;
    this.underdogT = 60;
    this.onAlert(`UNDERDOG: ${low.def.name.toUpperCase()}`, 'Fortress shield 45s · points and war chest x1.5 · gift now to turn it around!', low.color, low.code);
    this.onFeed(`${low.def.name} is the UNDERDOG: shield up, points x1.5 for 45s`, low.code, low.color);
  }

  /** CPU reinforcements keep every fortress defended when chat is quiet (labelled CPU, never fake viewers). */
  private bots(dt: number) {
    const w = this.world;
    this.botT -= dt;
    if (this.botT > 0) return;
    const idle = w.time - this.lastLive > this.cfg.idleSeconds;
    this.botT = idle ? rand(0.8, 1.6) : rand(3, 5);
    for (const f of w.slotted) {
      const cap = idle ? 22 : 8;
      if (f.units >= cap) continue;
      const r = Math.random();
      const key: UnitKey = r < 0.62 ? 'infantry' : r < 0.72 ? 'sniper' : r < 0.8 ? 'at' : r < 0.86 ? 'drone' : r < 0.9 ? 'flamer' : r < 0.93 ? 'jeep' : idle && r < 0.98 ? pick(['tank', 'aa', 'spider'] as UnitKey[]) : 'infantry';
      w.spawn(key, f.id, '', '', 0);
    }
  }

  noteKill(killerFid: number, victimFid: number, value: number) {
    if (killerFid === victimFid || killerFid <= 0 || victimFid <= 0) return;
    const [a, b] = killerFid < victimFid ? [killerFid, victimFid] : [victimFid, killerFid];
    const k = `${a}|${b}`;
    this.rivalry.set(k, (this.rivalry.get(k) ?? 0) + value);
  }

  topRivalry(): [Faction, Faction, number] | null {
    let best: string | null = null, bv = 0;
    for (const [k, v] of this.rivalry) if (v > bv) (bv = v), (best = k);
    if (!best || bv < 300) return null;
    const [a, b] = best.split('|').map(Number);
    const fa = this.world.factions[a], fb = this.world.factions[b];
    if (fa.slot < 0 || fb.slot < 0) return null;
    return [fa, fb, bv];
  }

  endRound() {
    if (this.round.state !== 'battle') return;
    const w = this.world;
    const ranking = w.factions
      .filter((f) => f.id !== 0 && (f.slot >= 0 || f.score > 0))
      .sort((a, b) => b.score - a.score)
      .map((f) => ({ code: f.code, name: f.def.name, score: Math.round(f.score), kills: f.kills, color: f.color }));
    if (ranking[0]) (this.season.countries[ranking[0].code] ??= { wins: 0, coins: 0 }).wins++;
    const season = Object.entries(this.season.countries)
      .map(([code, v]) => ({ code, name: COUNTRY_BY_CODE.get(code)?.name ?? code, wins: v.wins, coins: v.coins }))
      .sort((a, b) => b.wins - a.wins || b.coins - a.coins)
      .slice(0, 5);
    const legends = [...this.players.map.values()]
      .filter((p) => p.coins > 0)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 5)
      .map((p) => ({ name: p.name, coins: p.coins, rank: rankOf(p.coins), country: p.country }));
    const s: RoundSummary = { n: this.round.n, ranking, mvp: this.players.roundMvp(), topDonor: this.players.roundTopDonor(), season, legends };
    this.lastSummary = s;
    this.round.state = 'victory';
    this.round.victoryT = this.cfg.victorySeconds;
    this.onRoundEnd(s);
    void this.persist();
  }

  newRound() {
    this.round.n++;
    this.round.terrainIdx++;
    this.round.state = 'battle';
    this.round.timeLeft = this.cfg.roundSeconds;
    this.players.resetRound();
    this.rivalry.clear();
    this.underdogFid = -1;
    this.underdogT = 20;
    this.boss = null;
    const seasonKey = new Date().toISOString().slice(0, 7);
    if (seasonKey !== this.season.key) this.season = { key: seasonKey, countries: {} };
    this.onTerrain(this.terrain);
    this.world.newRound(this.terrain);
    this.seed();
    if (this.fitWeather()) this.onWeather(this.weather);
    this.onRoundStart(this.round.n);
    void this.persist();
  }

  /** New battlefield: drop weather that cannot happen there (snow in the desert...). Returns true if it changed. */
  private fitWeather() {
    const ok = TERRAIN_WEATHERS[this.terrain];
    if (this.nextWeather && !ok.includes(this.nextWeather)) this.nextWeather = null;
    if (ok.includes(this.weather)) return false;
    this.weather = 'clear';
    return true;
  }

  emperor() {
    const p = this.players.emperor();
    return p && p.day === dayKey() ? p : null;
  }
}
