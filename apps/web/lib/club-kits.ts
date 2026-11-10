/**
 * Kit colours for the 3D match stage and club accents. Presentation only:
 * colours come from the crest (generated map) or, for clubs without one, from
 * a stable hash of the club id. Nothing in the rules depends on it.
 */
import { CREST_KITS } from './club-kits.generated';

export interface Kit {
  /** Shirt body. */
  readonly shirt: string;
  /** Sleeves cuffs, collar and sock tops. */
  readonly trim: string;
  readonly shorts: string;
  readonly socks: string;
  /** Number on the back; always readable over the shirt. */
  readonly number: string;
}

type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : value.padEnd(6, '0').slice(0, 6);
  const number = Number.parseInt(full, 16) || 0;
  return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Perceptual-ish distance in 0..~1.7; under ~0.28 two shirts look alike. */
export function colourDistance(left: string, right: string): number {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  // "Redmean": cheap and far closer to perception than plain RGB.
  const mean = (a[0] + b[0]) / 2 / 255;
  const dr = (a[0] - b[0]) / 255;
  const dg = (a[1] - b[1]) / 255;
  const db = (a[2] - b[2]) / 255;
  return Math.sqrt((2 + mean) * dr * dr + 4 * dg * dg + (3 - mean) * db * db);
}

function hueAndChroma(hex: string): readonly [number, number] {
  const [r, g, b] = hexToRgb(hex).map((channel) => channel / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma === 0) return [0, 0];
  const hue =
    max === r
      ? ((g - b) / chroma + 6) % 6
      : max === g
        ? (b - r) / chroma + 2
        : (r - g) / chroma + 4;
  return [hue * 60, chroma];
}

/**
 * Whether two shirts would be confused on the pitch: close colours, or two
 * strong colours of the same family (red and maroon, royal and navy).
 */
export function kitsClash(left: string, right: string): boolean {
  if (colourDistance(left, right) < 0.5) return true;
  const [hueA, chromaA] = hueAndChroma(left);
  const [hueB, chromaB] = hueAndChroma(right);
  if (chromaA < 0.25 || chromaB < 0.25) return false;
  const gap = Math.abs(hueA - hueB);
  return Math.min(gap, 360 - gap) < 32;
}

function mix(left: string, right: string, amount: number): string {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return rgbToHex([
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ]);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] =
    sector < 1
      ? [chroma, x, 0]
      : sector < 2
        ? [x, chroma, 0]
        : sector < 3
          ? [0, chroma, x]
          : sector < 4
            ? [0, x, chroma]
            : sector < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const m = l - chroma / 2;
  return rgbToHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

function stableHash(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

const WHITE = '#f4f4f0';
const INK = '#14181d';

function readable(over: string): string {
  return luminance(over) > 0.55 ? INK : WHITE;
}

function kitFrom(shirt: string, trim: string): Kit {
  const light = luminance(shirt) > 0.7;
  // Light shirts take dark shorts (and vice versa) unless the trim is a
  // strong club colour, which then dresses the shorts.
  const shorts =
    colourDistance(shirt, trim) > 0.45 && luminance(trim) < 0.75
      ? trim
      : light
        ? INK
        : mix(shirt, '#000000', 0.35);
  return {
    shirt,
    trim,
    shorts,
    socks: light ? WHITE : mix(shirt, '#000000', 0.15),
    number: readable(shirt),
  };
}

/**
 * Clubs whose crest does not tell the shirt (a red anchor on a white-shirted
 * club, a grey star on a black one): shirt and trim set by hand.
 */
const KNOWN_KITS: Readonly<Record<string, readonly [string, string]>> = {
  club_atletico_mineiro: ['#15171a', '#f4f4f0'],
  club_bahia: ['#0857a2', '#d5101a'],
  club_botafogo: ['#15171a', '#f4f4f0'],
  club_ceara: ['#15171a', '#f4f4f0'],
  club_corinthians: ['#f4f4f0', '#15171a'],
  club_coritiba: ['#f4f4f0', '#0b6b3a'],
  club_fluminense: ['#8b0928', '#0b6b3a'],
  club_fortaleza: ['#1c3f94', '#d5101a'],
  club_santos: ['#f4f4f0', '#15171a'],
  club_sao_paulo: ['#f4f4f0', '#d5101a'],
  club_sport: ['#d5101a', '#15171a'],
  club_vasco: ['#15171a', '#f4f4f0'],
  club_vitoria: ['#d5101a', '#15171a'],
};

/** Catalogue id of a club from its display name ("São Paulo" -> club_sao_paulo). */
export function clubIdFromName(name: string): string {
  return `club_${name
    .normalize('NFD')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/ +/g, '_')}`;
}

/** Home kit of a club. Pure: the same club always gets the same colours. */
export function clubKit(club: Readonly<{ id: string; name?: string }>): Kit {
  const crest = KNOWN_KITS[club.id] ?? CREST_KITS[club.id];
  if (crest) return kitFrom(crest[0], crest[1]);
  const hash = stableHash((club.id || club.name || 'club').toLowerCase());
  const hue = hash % 360;
  const shirt = hslToHex(hue, 68, 38 + ((hash >>> 9) % 14));
  const trim =
    (hash >>> 13) % 3 === 0
      ? WHITE
      : hslToHex((hue + 150 + ((hash >>> 16) % 60)) % 360, 72, 58);
  return kitFrom(shirt, trim);
}

/** Change strip: the trim colour, or plain white/dark when that clashes too. */
export function awayKit(kit: Kit, against: Kit): Kit {
  const candidates = [
    kitFrom(kit.trim, kit.shirt),
    kitFrom(WHITE, kit.shirt),
    kitFrom('#1b2026', kit.trim),
    kitFrom('#f2c230', INK),
  ];
  return (
    candidates.find(
      (candidate) => !kitsClash(candidate.shirt, against.shirt),
    ) ?? candidates[1]!
  );
}

export interface MatchKits {
  readonly home: Kit;
  readonly away: Kit;
  /** Goalkeepers never share a colour with either outfield kit. */
  readonly homeKeeper: Kit;
  readonly awayKeeper: Kit;
  readonly referee: Kit;
}

const KEEPER_SHIRTS = ['#f2c230', '#2bd4c0', '#ff7a1a', '#b65cff', '#9aa3ad'];

function keeperKit(avoid: readonly Kit[], skip: number): Kit {
  const free = KEEPER_SHIRTS.filter((shirt) =>
    avoid.every((kit) => !kitsClash(kit.shirt, shirt)),
  );
  const shirt = (free.length > 0 ? free : KEEPER_SHIRTS)[
    skip % Math.max(1, free.length || KEEPER_SHIRTS.length)
  ]!;
  return {
    shirt,
    trim: INK,
    shorts: mix(shirt, '#000000', 0.25),
    socks: shirt,
    number: readable(shirt),
  };
}

/** Kits of a fixture: the visitors change when the shirts would clash. */
export function matchKits(
  home: Readonly<{ id: string; name?: string }>,
  away: Readonly<{ id: string; name?: string }>,
): MatchKits {
  const homeKit = clubKit(home);
  const natural = clubKit(away);
  const awayResolved = kitsClash(homeKit.shirt, natural.shirt)
    ? awayKit(natural, homeKit)
    : natural;
  const homeKeeper = keeperKit([homeKit, awayResolved], 0);
  const awayKeeper = keeperKit([homeKit, awayResolved, homeKeeper], 1);
  return {
    home: homeKit,
    away: awayResolved,
    homeKeeper,
    awayKeeper,
    referee: {
      shirt: '#101216',
      trim: '#f2c230',
      shorts: '#101216',
      socks: '#101216',
      number: WHITE,
    },
  };
}
