// Viewer registry: chosen country, lifetime coins (rank), today's coins (throne), unit preferences.
// Bounded: the least recently seen viewers are dropped beyond MAX_PLAYERS.
import type { UnitKey } from '../core/units';

export interface Player {
  uid: string;
  name: string;
  nick: string;
  country: string | null;
  coins: number; // lifetime
  today: number;
  day: string;
  changedDay: string; // last day the country was changed (max 1 change per day)
  pref: Record<number, UnitKey>; // tier -> preferred unit
  lastSeen: number;
  // transient (not saved)
  roundKills?: number;
  roundCoins?: number;
  nextChatSpawn?: number;
  likeAcc?: number;
}

export const RANKS: { name: string; min: number; color: number }[] = [
  { name: 'Private', min: 0, color: 0xffffff },
  { name: 'Corporal', min: 100, color: 0xc8d2e0 },
  { name: 'Lieutenant', min: 1000, color: 0x7fd8ff },
  { name: 'Colonel', min: 5000, color: 0xffd34d },
  { name: 'General', min: 20000, color: 0xff9a3d },
  { name: 'Marshal', min: 100000, color: 0xff4fd8 },
];
export const rankOf = (coins: number) => {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (coins >= RANKS[i].min) r = i;
  return r;
};

const MAX_PLAYERS = 5000;
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

export class Players {
  map = new Map<string, Player>();

  get(uid: string, name: string, nick: string): Player {
    let p = this.map.get(uid);
    const now = Date.now();
    if (!p) {
      p = { uid, name, nick, country: null, coins: 0, today: 0, day: dayKey(now), changedDay: '', pref: {}, lastSeen: now };
      this.map.set(uid, p);
      if (this.map.size > MAX_PLAYERS * 1.2) this.prune();
    }
    p.name = name || p.name;
    p.nick = nick || p.nick;
    p.lastSeen = now;
    const d = dayKey(now);
    if (p.day !== d) {
      p.day = d;
      p.today = 0;
    }
    return p;
  }

  /** Returns 'ok' | 'same' | 'locked'. */
  setCountry(p: Player, code: string): 'ok' | 'same' | 'locked' {
    if (p.country === code) return 'same';
    const d = dayKey();
    if (p.country && p.changedDay === d) return 'locked';
    if (p.country) p.changedDay = d;
    p.country = code;
    return 'ok';
  }

  addCoins(p: Player, coins: number) {
    p.coins += coins;
    p.today += coins;
    p.roundCoins = (p.roundCoins ?? 0) + coins;
  }

  /** Today's top donor (World Emperor). */
  emperor(): Player | null {
    const d = dayKey();
    let best: Player | null = null;
    for (const p of this.map.values()) if (p.day === d && p.today > 0 && (!best || p.today > best.today)) best = p;
    return best;
  }

  roundMvp(): Player | null {
    let best: Player | null = null;
    for (const p of this.map.values()) if ((p.roundKills ?? 0) > 0 && (!best || (p.roundKills ?? 0) > (best.roundKills ?? 0))) best = p;
    return best;
  }
  roundTopDonor(): Player | null {
    let best: Player | null = null;
    for (const p of this.map.values()) if ((p.roundCoins ?? 0) > 0 && (!best || (p.roundCoins ?? 0) > (best.roundCoins ?? 0))) best = p;
    return best;
  }
  resetRound() {
    for (const p of this.map.values()) {
      p.roundKills = 0;
      p.roundCoins = 0;
    }
  }

  private prune() {
    const arr = [...this.map.values()].sort((a, b) => b.lastSeen + b.coins * 1000 - (a.lastSeen + a.coins * 1000));
    this.map = new Map(arr.slice(0, MAX_PLAYERS).map((p) => [p.uid, p]));
  }

  serialize() {
    return [...this.map.values()].map(({ roundKills, roundCoins, nextChatSpawn, likeAcc, ...p }) => (void roundKills, void roundCoins, void nextChatSpawn, void likeAcc, p));
  }
  restore(list: Player[] | null) {
    if (!list) return;
    this.map = new Map(list.map((p) => [p.uid, { ...p, pref: p.pref ?? {} }]));
  }
}
