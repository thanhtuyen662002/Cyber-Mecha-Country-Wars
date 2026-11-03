// Fallback event source for Cyber Mecha Country Wars.
// Connects to a TikTok LIVE with TikTok-Live-Connector and re-broadcasts the events on
// ws://localhost:21214/ in the same {"event": ..., "data": ...} format TikFinity uses,
// so the game needs no extra code. Use it only if TikFinity's WebSocket is not available.
//
//   npm install
//   npm start -- your_tiktok_username        (or set TIKTOK_USERNAME)
//   optional: EULER_API_KEY=... (sign server key, raises rate limits)  PORT=21214
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import { WebSocketServer } from 'ws';

const username = (process.argv[2] || process.env.TIKTOK_USERNAME || '').replace(/^@/, '');
const port = Number(process.env.PORT || 21214);
if (!username) {
  console.error('Usage: npm start -- <tiktok_username>');
  process.exit(1);
}

const wss = new WebSocketServer({ host: '127.0.0.1', port });
const json = (v) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x));
function send(event, data) {
  const msg = json({ event, data });
  for (const c of wss.clients) if (c.readyState === 1) c.send(msg);
}
wss.on('listening', () => console.log(`[bridge] game can connect to ws://localhost:${port}/`));
wss.on('connection', () => console.log(`[bridge] game connected (${wss.clients.size} client(s))`));

const FORWARD = { chat: WebcastEvent.CHAT, gift: WebcastEvent.GIFT, like: WebcastEvent.LIKE, follow: WebcastEvent.FOLLOW, share: WebcastEvent.SHARE, member: WebcastEvent.MEMBER };

let backoff = 2;
let conn = null;
let timer = null;
function retry(why) {
  if (timer) return;
  console.log(`[bridge] ${why}, retrying in ${backoff}s`);
  timer = setTimeout(() => {
    timer = null;
    connect();
  }, backoff * 1000);
  backoff = Math.min(60, backoff * 2);
}
async function connect() {
  conn?.removeAllListeners?.();
  conn = new TikTokLiveConnection(username, { signApiKey: process.env.EULER_API_KEY || undefined, enableExtendedGiftInfo: true });
  for (const [name, ev] of Object.entries(FORWARD)) conn.on(ev, (data) => send(name, data));
  conn.on(WebcastEvent.STREAM_END, () => console.log('[bridge] stream ended'));
  conn.on('disconnected', () => retry('disconnected'));
  try {
    const state = await conn.connect();
    backoff = 2;
    console.log(`[bridge] connected to @${username} (room ${state.roomId})`);
  } catch (err) {
    retry(`could not connect (${err?.message ?? err}); is @${username} live?`);
  }
}
connect();
process.on('SIGINT', () => {
  conn?.disconnect();
  wss.close();
  process.exit(0);
});
