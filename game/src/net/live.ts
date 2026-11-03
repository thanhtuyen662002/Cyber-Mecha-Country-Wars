// WebSocket client for live TikTok events.
// TikFinity (free) re-broadcasts events on ws://localhost:21213/ in TikTok-Live-Connector format;
// our own bridge (../bridge, TikTok-Live-Connector) serves the same format on :21214.
// We try each URL in turn with exponential back-off (1, 2, 4 ... 30 s).
import { type GameEvent, normalize } from './events';

export type LiveStatus = 'connecting' | 'live' | 'offline';

export class LiveSource {
  status: LiveStatus = 'connecting';
  url = '';
  received = 0;
  lastRaw = '';
  private ws: WebSocket | null = null;
  private idx = 0;
  private backoff = 1;
  private timer: number | null = null;
  private stopped = false;

  constructor(private urls: string[], private out: (e: GameEvent) => void) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.ws?.close();
  }

  private connect() {
    if (this.stopped || !this.urls.length) return;
    this.url = this.urls[this.idx % this.urls.length];
    this.status = 'connecting';
    let opened = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.ws.onopen = () => {
      opened = true;
      this.status = 'live';
      this.backoff = 1;
    };
    this.ws.onmessage = (m) => {
      this.received++;
      if (typeof m.data !== 'string') return;
      this.lastRaw = m.data.slice(0, 300);
      try {
        const e = normalize(JSON.parse(m.data));
        if (e) this.out(e);
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      if (!opened) this.idx++; // try the next source
      this.retry();
    };
    this.ws.onerror = () => this.ws?.close();
  }

  private retry() {
    this.status = 'offline';
    if (this.stopped) return;
    const wait = this.backoff;
    this.backoff = Math.min(30, this.backoff * 2);
    this.timer = window.setTimeout(() => this.connect(), wait * 1000);
  }
}
