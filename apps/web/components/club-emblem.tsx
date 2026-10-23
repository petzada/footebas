import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Generic club emblem drawn by the game. No real crest or logo is ever used:
 * shape, pattern, colors and initials derive from a stable hash of the club
 * id (or name) unless the catalog supplies colors.
 */
export interface EmblemInput {
  readonly name: string;
  readonly id?: string;
  readonly colors?: { readonly primary: string; readonly secondary: string };
}

export type EmblemShape = 'shield' | 'round' | 'diamond' | 'hexagon';
export type EmblemPattern = 'solid' | 'stripes' | 'sash' | 'halves' | 'chevron';

export interface EmblemSpec {
  readonly initials: string;
  readonly shape: EmblemShape;
  readonly pattern: EmblemPattern;
  readonly primary: string;
  readonly secondary: string;
  readonly ink: string;
}

const SHAPES: readonly EmblemShape[] = [
  'shield',
  'round',
  'diamond',
  'hexagon',
];
const PATTERNS: readonly EmblemPattern[] = [
  'solid',
  'stripes',
  'sash',
  'halves',
  'chevron',
];
const STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'fc',
  'ec',
  'sc',
  'ac',
  'cr',
  'club',
  'clube',
]);

/** FNV-1a 32-bit: tiny, stable across runtimes, good enough to spread hues. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function clubInitials(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[\s\-.]+/)
    .filter(Boolean);
  const meaningful = words.filter((word) => !STOPWORDS.has(word.toLowerCase()));
  const pool = meaningful.length > 0 ? meaningful : words;
  if (pool.length === 0) return '?';
  if (pool.length === 1) return pool[0]!.slice(0, 3).toUpperCase();
  return pool
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

const hsl = (hue: number, saturation: number, lightness: number) =>
  `hsl(${hue} ${saturation}% ${lightness}%)`;

/** Relative luminance of `hsl(h s% l%)` or `#rrggbb`; unknown formats read as dark. */
function luminance(color: string): number {
  let rgb: [number, number, number] | undefined;
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const value = Number.parseInt(hex[1]!, 16);
    rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  const parsed =
    /^hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)$/.exec(color);
  if (parsed) {
    const h = Number(parsed[1]) / 360;
    const s = Number(parsed[2]) / 100;
    const l = Number(parsed[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t: number) => {
      const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    rgb = [
      channel(h + 1 / 3) * 255,
      channel(h) * 255,
      channel(h - 1 / 3) * 255,
    ];
  }
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Pure and deterministic: the same club always gets the same emblem. */
export function emblemSpec(input: EmblemInput): EmblemSpec {
  const seed = (input.id ?? input.name).trim().toLowerCase();
  const hash = stableHash(seed);
  const hue = hash % 360;
  const primary = input.colors?.primary ?? hsl(hue, 62, 34);
  const secondary =
    input.colors?.secondary ??
    ((hash >>> 9) % 3 === 0
      ? hsl(48, 30, 94)
      : hsl((hue + 150 + ((hash >>> 12) % 60)) % 360, 72, 56));
  return {
    initials: clubInitials(input.name),
    shape: SHAPES[(hash >>> 3) % SHAPES.length]!,
    pattern: PATTERNS[(hash >>> 6) % PATTERNS.length]!,
    primary,
    secondary,
    ink: luminance(primary) > 0.35 ? hsl(150, 30, 10) : hsl(48, 40, 97),
  };
}

const OUTLINE: Record<EmblemShape, string> = {
  shield: 'M32 3 L58 11 V30 C58 46 47 56 32 61 C17 56 6 46 6 30 V11 Z',
  round:
    'M32 3 C48 3 61 16 61 32 C61 48 48 61 32 61 C16 61 3 48 3 32 C3 16 16 3 32 3 Z',
  diamond: 'M32 2 L61 32 L32 62 L3 32 Z',
  hexagon: 'M32 3 L57 17 V47 L32 61 L7 47 V17 Z',
};

function PatternLayer({ spec }: { spec: EmblemSpec }) {
  switch (spec.pattern) {
    case 'stripes':
      return (
        <g fill={spec.secondary}>
          <rect x="14" y="0" width="7" height="64" />
          <rect x="28.5" y="0" width="7" height="64" />
          <rect x="43" y="0" width="7" height="64" />
        </g>
      );
    case 'sash':
      return <path d="M-4 18 L18 -4 L68 46 L46 68 Z" fill={spec.secondary} />;
    case 'halves':
      return <rect x="32" y="0" width="32" height="64" fill={spec.secondary} />;
    case 'chevron':
      return (
        <path
          d="M0 22 L32 40 L64 22 V34 L32 52 L0 34 Z"
          fill={spec.secondary}
        />
      );
    default:
      return null;
  }
}

export function ClubEmblem({
  name,
  id,
  colors,
  size = 40,
  className,
  decorative = false,
}: EmblemInput & {
  size?: number;
  className?: string;
  /** Hide from assistive tech when the club name is already next to it. */
  decorative?: boolean;
}) {
  const clip = useId();
  const spec = emblemSpec({
    name,
    ...(id === undefined ? {} : { id }),
    ...(colors === undefined ? {} : { colors }),
  });
  const fontSize = spec.initials.length >= 3 ? 15 : 19;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      // Inline size wins over parent rules such as Button's `[&_svg]:size-4`.
      style={{ width: size, height: size }}
      className={cn('shrink-0 drop-shadow-sm', className)}
      data-testid="club-emblem"
      data-shape={spec.shape}
      data-pattern={spec.pattern}
      {...(decorative
        ? { 'aria-hidden': true, focusable: 'false' }
        : { role: 'img', 'aria-label': `Emblema do ${name}` })}
    >
      <defs>
        <clipPath id={clip}>
          <path d={OUTLINE[spec.shape]} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="64" fill={spec.primary} />
        <PatternLayer spec={spec} />
        <circle cx="32" cy="33" r="15" fill={spec.primary} opacity="0.92" />
      </g>
      <path
        d={OUTLINE[spec.shape]}
        fill="none"
        stroke={spec.secondary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing="0.5"
        fill={spec.ink}
      >
        {spec.initials}
      </text>
    </svg>
  );
}
