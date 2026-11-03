// One event shape for the whole game. Every source (TikFinity, the TikTok-Live-Connector bridge,
// the simulator) is converted into this before it reaches the game, through the same queue.

export interface Viewer {
  uid: string; // stable id (TikTok userId, falls back to uniqueId)
  name: string; // @uniqueId: ASCII, used on unit tags
  nick: string; // display name (may contain emoji)
  pic?: string;
}

export type GameEvent =
  | ({ k: 'chat'; text: string } & Viewer)
  | ({ k: 'gift'; gift: string; coins: number; count: number } & Viewer)
  | ({ k: 'like'; count: number } & Viewer)
  | ({ k: 'follow' } & Viewer)
  | ({ k: 'share' } & Viewer);

type Raw = Record<string, any>;

const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function viewerOf(d: Raw): Viewer | null {
  const u: Raw = d.user ?? d;
  const name = s(u.uniqueId ?? d.uniqueId).replace(/[^A-Za-z0-9_.]/g, '').slice(0, 24);
  const uid = s(u.userId ?? d.userId ?? name);
  if (!uid && !name) return null;
  const picRaw = u.profilePictureUrl ?? d.profilePictureUrl ?? u.profilePicture?.url?.[0] ?? u.profilePicture?.urls?.[0];
  return { uid: uid || name, name: name || 'viewer', nick: s(u.nickname ?? d.nickname ?? name).slice(0, 32), pic: picRaw ? s(picRaw) : undefined };
}

/**
 * Streak gifts (giftType 1, e.g. Rose x20) arrive as many events while the combo runs.
 * Only the final one (repeatEnd) counts; if it never comes, we flush after a timeout.
 */
const pendingCombos = new Map<string, { ev: GameEvent; at: number }>();
const COMBO_TIMEOUT_MS = 8000;

export function flushStaleCombos(now: number, out: (e: GameEvent) => void) {
  for (const [k, p] of pendingCombos) {
    if (now - p.at > COMBO_TIMEOUT_MS) {
      pendingCombos.delete(k);
      out(p.ev);
    }
  }
}

/**
 * Parses one message in the TikFinity / TikTok-Live-Connector format:
 *   {"event": "gift", "data": {...}}
 * Tolerates both connector v1 (flat fields) and v2 (nested user / giftDetails) shapes.
 */
export function normalize(msg: Raw, now = Date.now()): GameEvent | null {
  const ev = s(msg.event ?? msg.type).toLowerCase();
  const d: Raw = msg.data ?? msg;
  const v = viewerOf(d);
  if (!v) return null;
  switch (ev) {
    case 'chat':
    case 'comment':
      return { k: 'chat', text: s(d.comment ?? d.text).slice(0, 200), ...v };
    case 'gift': {
      const coins = Number(d.diamondCount ?? d.giftDetails?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? d.gift?.diamond_count ?? 0);
      const count = Math.max(1, Number(d.repeatCount ?? d.comboCount ?? 1) || 1);
      const giftType = Number(d.giftType ?? d.giftDetails?.giftType ?? 0);
      const gift = s(d.giftName ?? d.giftDetails?.giftName ?? d.extendedGiftInfo?.name ?? 'Gift');
      if (!(coins > 0)) return null;
      const e: GameEvent = { k: 'gift', gift, coins, count, ...v };
      const key = `${v.uid}:${s(d.giftId ?? gift)}`;
      if (giftType === 1) {
        if (d.repeatEnd === true || d.repeatEnd === 1 || d.repeatEnd === 'true') {
          pendingCombos.delete(key);
          return e;
        }
        pendingCombos.set(key, { ev: e, at: now });
        return null;
      }
      return e;
    }
    case 'like':
      return { k: 'like', count: Math.max(1, Number(d.likeCount ?? d.count ?? 1) || 1), ...v };
    case 'follow':
      return { k: 'follow', ...v };
    case 'share':
      return { k: 'share', ...v };
    case 'social': {
      const t = s(d.displayType ?? d.label ?? d.common?.displayText?.key).toLowerCase();
      if (t.includes('follow')) return { k: 'follow', ...v };
      if (t.includes('share')) return { k: 'share', ...v };
      return null;
    }
    default:
      return null;
  }
}

/**
 * Bounded queues: gifts are never dropped (cap is huge for a live stream), free actions are
 * dropped oldest-first when a like/chat flood exceeds the cap. The game drains a fixed number
 * per tick, so a 500-gift spam becomes a few seconds of continuous spawns instead of a frame drop.
 */
export class EventQueue {
  private gifts: GameEvent[] = [];
  private social: GameEvent[] = [];
  dropped = 0;
  constructor(private giftCap = 5000, private socialCap = 400) {}
  push(e: GameEvent) {
    if (e.k === 'gift') {
      if (this.gifts.length >= this.giftCap) {
        this.dropped++;
        return;
      }
      this.gifts.push(e);
    } else {
      if (this.social.length >= this.socialCap) {
        this.social.shift();
        this.dropped++;
      }
      this.social.push(e);
    }
  }
  /** Gifts first, then free actions. */
  take(): GameEvent | undefined {
    return this.gifts.shift() ?? this.social.shift();
  }
  get size() {
    return this.gifts.length + this.social.length;
  }
}
