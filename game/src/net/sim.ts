// Event simulator for testing without a live stream. It emits raw TikFinity-format messages and
// runs them through the same normalizer and queue as the real connection.
import { COUNTRIES } from '../core/countries';
import { pick, rand } from '../core/config';
import { type GameEvent, normalize } from './events';

// Sample gift catalogue (coin values to be checked against the live gift list, PLAN.md M0).
export const SAMPLE_GIFTS: { name: string; coins: number; streak: boolean }[] = [
  { name: 'Rose', coins: 1, streak: true },
  { name: 'Finger Heart', coins: 5, streak: true },
  { name: 'Perfume', coins: 20, streak: true },
  { name: 'Doughnut', coins: 30, streak: true },
  { name: 'Hand Hearts', coins: 100, streak: false },
  { name: 'Corgi', coins: 299, streak: false },
  { name: 'Money Gun', coins: 500, streak: false },
  { name: 'Galaxy', coins: 1000, streak: false },
  { name: 'Whale Diving', coins: 2150, streak: false },
  { name: 'Interstellar', coins: 10000, streak: false },
  { name: 'Lion', coins: 29999, streak: false },
  { name: 'TikTok Universe', coins: 44999, streak: false },
];

const WEST = ['US', 'US', 'US', 'GB', 'GB', 'CA', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'PL', 'MX', 'BR', 'PH'];
const SYL = ['ka', 'ri', 'jo', 'mi', 'ne', 'ty', 'lo', 'sa', 'ben', 'ash', 'ky', 'zo', 'max', 'eli', 'nova', 'rex', 'jay', 'liv'];

interface SimViewer { uid: string; name: string; country: string }

export class Simulator {
  auto = false;
  /** events per second in auto mode */
  rate = 3;
  private viewers: SimViewer[] = [];
  private acc = 0;
  private n = 0;

  constructor(private out: (e: GameEvent) => void) {
    for (let i = 0; i < 60; i++) this.viewers.push(this.makeViewer());
  }

  private makeViewer(): SimViewer {
    const name = `sim_${pick(SYL)}${pick(SYL)}${(Math.random() * 99) | 0}`;
    return { uid: `sim${this.n++}`, name, country: pick(WEST) };
  }

  private emit(event: string, v: SimViewer, data: Record<string, unknown> = {}) {
    const e = normalize({ event, data: { uniqueId: v.name, userId: v.uid, nickname: v.name, ...data } });
    if (e) this.out(e);
  }

  viewer() {
    if (Math.random() < 0.05) this.viewers[(Math.random() * this.viewers.length) | 0] = this.makeViewer();
    return pick(this.viewers);
  }

  join(code?: string) {
    const v = this.viewer();
    if (code) v.country = code;
    this.emit('chat', v, { comment: Math.random() < 0.6 ? v.country.toLowerCase() : flagEmoji(v.country) });
  }
  chat(text = pick(['lets go!!', 'gg', 'push mid', 'wow', 'defend!', 'who is winning?'])) {
    this.emit('chat', this.viewer(), { comment: text });
  }
  command(cmd: string) {
    this.emit('chat', this.viewer(), { comment: cmd });
  }
  follow() {
    this.emit('social', this.viewer(), { displayType: 'pm_mt_msg_viewer_follow' });
  }
  share() {
    this.emit('social', this.viewer(), { displayType: 'pm_main_follow_message_viewer_2_share' });
  }
  likes(count = 15) {
    this.emit('like', this.viewer(), { likeCount: count });
  }
  gift(coins: number, count = 1, v = this.viewer()) {
    const g = SAMPLE_GIFTS.reduce((a, b) => (Math.abs(b.coins - coins) < Math.abs(a.coins - coins) ? b : a));
    if (g.streak) {
      // a real streak: intermediate events + final repeatEnd
      for (let i = 1; i < count; i++) this.emit('gift', v, { giftId: g.name, giftName: g.name, diamondCount: g.coins, repeatCount: i, repeatEnd: false, giftType: 1 });
      this.emit('gift', v, { giftId: g.name, giftName: g.name, diamondCount: g.coins, repeatCount: count, repeatEnd: true, giftType: 1 });
    } else this.emit('gift', v, { giftId: g.name, giftName: g.name, diamondCount: g.coins, repeatCount: count, giftType: 2 });
  }
  spam(n = 500) {
    for (let i = 0; i < n; i++) this.gift(pick([1, 1, 1, 5, 30, 100]), 1);
  }

  update(dt: number) {
    if (!this.auto) return;
    this.acc += dt * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1;
      const r = Math.random();
      if (r < 0.32) this.join();
      else if (r < 0.5) this.chat();
      else if (r < 0.7) this.likes((rand(5, 40)) | 0);
      else if (r < 0.74) this.follow();
      else if (r < 0.77) this.share();
      else if (r < 0.95) this.gift(pick([1, 1, 1, 5, 5, 20, 30]), Math.random() < 0.3 ? (rand(2, 15) | 0) : 1);
      else if (r < 0.993) this.gift(pick([100, 299, 500, 1000]));
      else if (r < 0.999) this.gift(pick([10000, 2150]));
      else this.gift(44999);
    }
  }
}

export function flagEmoji(code: string) {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const ALL_CODES = COUNTRIES.map((c) => c.code);
