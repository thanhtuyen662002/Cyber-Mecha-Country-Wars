// Countries viewers can join by typing a flag emoji or a code/name in chat.
// Flags are drawn in code (draw/flags.ts) because flag emoji do not render on Windows
// (TikTok LIVE Studio / OBS browser sources show "US" letters instead of a flag).
// `color` = the team neon colour taken from the flag; clashes are separated at runtime.

export type FlagSpec =
  | { t: 'h'; c: string[]; w?: number[] } // horizontal bands (optional relative weights)
  | { t: 'v'; c: string[] } // vertical bands
  | { t: 'nordic'; bg: string; cross: string; inner?: string }
  | { t: 'disc'; bg: string; disc: string; x?: number; r?: number }
  | { t: 'custom'; id: string };

export interface CountryDef {
  code: string; // ISO 3166-1 alpha-2, upper case
  name: string;
  color: number;
  flag: FlagSpec;
  aliases?: string[];
}

const h = (...c: string[]): FlagSpec => ({ t: 'h', c });
const v = (...c: string[]): FlagSpec => ({ t: 'v', c });
const cu = (id: string): FlagSpec => ({ t: 'custom', id });

export const COUNTRIES: CountryDef[] = [
  { code: 'US', name: 'USA', color: 0x3c8cff, flag: cu('US'), aliases: ['usa', 'america', 'united states', 'murica'] },
  { code: 'GB', name: 'UK', color: 0xff3b55, flag: cu('GB'), aliases: ['uk', 'britain', 'england', 'great britain', 'united kingdom', 'scotland', 'wales'] },
  { code: 'CA', name: 'Canada', color: 0xff2b2b, flag: cu('CA'), aliases: ['canada'] },
  { code: 'AU', name: 'Australia', color: 0x2bd9a0, flag: cu('AU'), aliases: ['australia', 'aussie'] },
  { code: 'NZ', name: 'New Zealand', color: 0x9ad0ff, flag: cu('NZ'), aliases: ['new zealand', 'nz'] },
  { code: 'IE', name: 'Ireland', color: 0x2ee86b, flag: v('#169b62', '#ffffff', '#ff883e'), aliases: ['ireland'] },
  { code: 'DE', name: 'Germany', color: 0xffcc00, flag: h('#000000', '#dd0000', '#ffce00'), aliases: ['germany', 'deutschland'] },
  { code: 'FR', name: 'France', color: 0x4f7dff, flag: v('#0055a4', '#ffffff', '#ef4135'), aliases: ['france'] },
  { code: 'IT', name: 'Italy', color: 0x20d36a, flag: v('#009246', '#ffffff', '#ce2b37'), aliases: ['italy', 'italia'] },
  { code: 'ES', name: 'Spain', color: 0xffb400, flag: { t: 'h', c: ['#aa151b', '#f1bf00', '#aa151b'], w: [1, 2, 1] }, aliases: ['spain', 'espana'] },
  { code: 'PT', name: 'Portugal', color: 0x00b050, flag: cu('PT'), aliases: ['portugal'] },
  { code: 'NL', name: 'Netherlands', color: 0xff7a00, flag: h('#ae1c28', '#ffffff', '#21468b'), aliases: ['netherlands', 'holland'] },
  { code: 'BE', name: 'Belgium', color: 0xffd900, flag: v('#000000', '#fdda24', '#ef3340'), aliases: ['belgium'] },
  { code: 'CH', name: 'Switzerland', color: 0xff4040, flag: cu('CH'), aliases: ['switzerland', 'swiss'] },
  { code: 'AT', name: 'Austria', color: 0xff5050, flag: h('#ed2939', '#ffffff', '#ed2939'), aliases: ['austria'] },
  { code: 'SE', name: 'Sweden', color: 0x2f9bff, flag: { t: 'nordic', bg: '#006aa7', cross: '#fecc00' }, aliases: ['sweden'] },
  { code: 'NO', name: 'Norway', color: 0xff3d4d, flag: { t: 'nordic', bg: '#ba0c2f', cross: '#ffffff', inner: '#00205b' }, aliases: ['norway'] },
  { code: 'DK', name: 'Denmark', color: 0xff3048, flag: { t: 'nordic', bg: '#c8102e', cross: '#ffffff' }, aliases: ['denmark'] },
  { code: 'FI', name: 'Finland', color: 0x8fc2ff, flag: { t: 'nordic', bg: '#ffffff', cross: '#002f6c' }, aliases: ['finland', 'suomi'] },
  { code: 'IS', name: 'Iceland', color: 0x5aa0ff, flag: { t: 'nordic', bg: '#02529c', cross: '#ffffff', inner: '#dc1e35' }, aliases: ['iceland'] },
  { code: 'PL', name: 'Poland', color: 0xff3d6a, flag: h('#ffffff', '#dc143c'), aliases: ['poland', 'polska'] },
  { code: 'UA', name: 'Ukraine', color: 0xffd500, flag: h('#0057b7', '#ffd700'), aliases: ['ukraine'] },
  { code: 'CZ', name: 'Czechia', color: 0x4d7dff, flag: cu('CZ'), aliases: ['czech', 'czechia'] },
  { code: 'GR', name: 'Greece', color: 0x3fa0ff, flag: cu('GR'), aliases: ['greece'] },
  { code: 'RO', name: 'Romania', color: 0xffd23c, flag: v('#002b7f', '#fcd116', '#ce1126'), aliases: ['romania'] },
  { code: 'HU', name: 'Hungary', color: 0x3fd07a, flag: h('#cd2a3e', '#ffffff', '#436f4d'), aliases: ['hungary'] },
  { code: 'HR', name: 'Croatia', color: 0xff4a5a, flag: h('#ff0000', '#ffffff', '#171796'), aliases: ['croatia'] },
  { code: 'RS', name: 'Serbia', color: 0xd94a5a, flag: h('#c6363c', '#0c4076', '#ffffff'), aliases: ['serbia'] },
  { code: 'BG', name: 'Bulgaria', color: 0x2fc28a, flag: h('#ffffff', '#00966e', '#d62612'), aliases: ['bulgaria'] },
  { code: 'LT', name: 'Lithuania', color: 0xfdb913, flag: h('#fdb913', '#006a44', '#c1272d'), aliases: ['lithuania'] },
  { code: 'LV', name: 'Latvia', color: 0xb03a4e, flag: { t: 'h', c: ['#9e3039', '#ffffff', '#9e3039'], w: [2, 1, 2] }, aliases: ['latvia'] },
  { code: 'EE', name: 'Estonia', color: 0x4891d9, flag: h('#0072ce', '#000000', '#ffffff'), aliases: ['estonia'] },
  { code: 'RU', name: 'Russia', color: 0xe8e8ff, flag: h('#ffffff', '#0039a6', '#d52b1e'), aliases: ['russia'] },
  { code: 'TR', name: 'Turkey', color: 0xff2a3a, flag: cu('TR'), aliases: ['turkey', 'turkiye'] },
  { code: 'MX', name: 'Mexico', color: 0x18c26a, flag: v('#006847', '#ffffff', '#ce1126'), aliases: ['mexico'] },
  { code: 'BR', name: 'Brazil', color: 0x2fe05a, flag: cu('BR'), aliases: ['brazil', 'brasil'] },
  { code: 'AR', name: 'Argentina', color: 0x75c4ff, flag: cu('AR'), aliases: ['argentina'] },
  { code: 'CO', name: 'Colombia', color: 0xffd200, flag: { t: 'h', c: ['#fcd116', '#003893', '#ce1126'], w: [2, 1, 1] }, aliases: ['colombia'] },
  { code: 'CL', name: 'Chile', color: 0xe8345a, flag: cu('CL'), aliases: ['chile'] },
  { code: 'PE', name: 'Peru', color: 0xff3a3a, flag: v('#d91023', '#ffffff', '#d91023'), aliases: ['peru'] },
  { code: 'VE', name: 'Venezuela', color: 0xffcf3a, flag: h('#ffcc00', '#00247d', '#cf142b'), aliases: ['venezuela'] },
  { code: 'PR', name: 'Puerto Rico', color: 0x4aa8ff, flag: cu('PR'), aliases: ['puerto rico'] },
  { code: 'DO', name: 'Dominican Rep.', color: 0x3f6fff, flag: cu('DO'), aliases: ['dominican republic', 'dr'] },
  { code: 'JM', name: 'Jamaica', color: 0xffd23c, flag: cu('JM'), aliases: ['jamaica'] },
  { code: 'PH', name: 'Philippines', color: 0x3f7bff, flag: cu('PH'), aliases: ['philippines', 'pinoy'] },
  { code: 'VN', name: 'Vietnam', color: 0xff3a2a, flag: cu('VN'), aliases: ['vietnam', 'viet nam'] },
  { code: 'ID', name: 'Indonesia', color: 0xff3e3e, flag: h('#ff0000', '#ffffff'), aliases: ['indonesia'] },
  { code: 'TH', name: 'Thailand', color: 0x6a7dff, flag: { t: 'h', c: ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], w: [1, 1, 2, 1, 1] }, aliases: ['thailand'] },
  { code: 'MY', name: 'Malaysia', color: 0xffcc00, flag: cu('MY'), aliases: ['malaysia'] },
  { code: 'SG', name: 'Singapore', color: 0xff4a5a, flag: h('#ef3340', '#ffffff'), aliases: ['singapore'] },
  { code: 'JP', name: 'Japan', color: 0xff3d6e, flag: { t: 'disc', bg: '#ffffff', disc: '#bc002d' }, aliases: ['japan', 'nippon'] },
  { code: 'KR', name: 'South Korea', color: 0x4a7dff, flag: cu('KR'), aliases: ['korea', 'south korea'] },
  { code: 'CN', name: 'China', color: 0xff3020, flag: cu('CN'), aliases: ['china'] },
  { code: 'TW', name: 'Taiwan', color: 0x3a5dff, flag: cu('TW'), aliases: ['taiwan'] },
  { code: 'IN', name: 'India', color: 0xff9933, flag: cu('IN'), aliases: ['india', 'bharat'] },
  { code: 'PK', name: 'Pakistan', color: 0x1fbf5a, flag: cu('PK'), aliases: ['pakistan'] },
  { code: 'BD', name: 'Bangladesh', color: 0x1fae5a, flag: { t: 'disc', bg: '#006a4e', disc: '#f42a41', x: 0.45 }, aliases: ['bangladesh'] },
  { code: 'SA', name: 'Saudi Arabia', color: 0x1fcf6a, flag: cu('SA'), aliases: ['saudi', 'ksa', 'saudi arabia'] },
  { code: 'AE', name: 'UAE', color: 0x2fd07a, flag: cu('AE'), aliases: ['uae', 'emirates', 'dubai'] },
  { code: 'IL', name: 'Israel', color: 0x5aa8ff, flag: cu('IL'), aliases: ['israel'] },
  { code: 'EG', name: 'Egypt', color: 0xffc23c, flag: h('#ce1126', '#ffffff', '#000000'), aliases: ['egypt'] },
  { code: 'MA', name: 'Morocco', color: 0xff3b3b, flag: cu('MA'), aliases: ['morocco'] },
  { code: 'DZ', name: 'Algeria', color: 0x2fd06a, flag: cu('DZ'), aliases: ['algeria'] },
  { code: 'NG', name: 'Nigeria', color: 0x18d070, flag: v('#008751', '#ffffff', '#008751'), aliases: ['nigeria', 'naija'] },
  { code: 'GH', name: 'Ghana', color: 0xfcd116, flag: cu('GH'), aliases: ['ghana'] },
  { code: 'KE', name: 'Kenya', color: 0x2fb05a, flag: cu('KE'), aliases: ['kenya'] },
  { code: 'ZA', name: 'South Africa', color: 0x24c78a, flag: cu('ZA'), aliases: ['south africa', 'rsa'] },
];

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const ALIAS = new Map<string, string>();
for (const c of COUNTRIES) {
  ALIAS.set(c.code.toLowerCase(), c.code);
  for (const a of c.aliases ?? []) ALIAS.set(a, c.code);
}
// Common alternative codes
ALIAS.set('uk', 'GB');
ALIAS.set('en', 'GB');
ALIAS.set('eng', 'GB');
ALIAS.set('usa', 'US');
ALIAS.set('ph', 'PH');

/** Mercenaries: viewers who gifted before choosing a country. No fortress, fight everyone. */
export const MERC: CountryDef = { code: 'XX', name: 'Mercenaries', color: 0xb9b9c9, flag: cu('XX') };

const RI_A = 0x1f1e6;
/**
 * Detects a country choice in a chat message.
 * Accepts: a flag emoji anywhere, the whole message being a code/name ("us", "Canada"),
 * or "!join xx". Plain words inside longer sentences are ignored on purpose so normal chat
 * ("is it on?") never switches anyone's country.
 */
export function parseCountry(text: string): string | null {
  const cps = Array.from(text);
  for (let i = 0; i < cps.length - 1; i++) {
    const a = cps[i].codePointAt(0)!, b = cps[i + 1].codePointAt(0)!;
    if (a >= RI_A && a < RI_A + 26 && b >= RI_A && b < RI_A + 26) {
      const code = String.fromCharCode(65 + a - RI_A, 65 + b - RI_A);
      if (COUNTRY_BY_CODE.has(code)) return code;
      if (code === 'UK') return 'GB';
    }
  }
  // England / Scotland / Wales tag-sequence flags
  if (text.includes('\u{1F3F4}\u{E0067}\u{E0062}')) return 'GB';
  const t = text.trim().toLowerCase().replace(/[!.?\s]+$/g, '');
  const m = /^!?(?:join|team)\s+(.+)$/.exec(t);
  const key = (m ? m[1] : t).replace(/^#/, '');
  return ALIAS.get(key) ?? null;
}
