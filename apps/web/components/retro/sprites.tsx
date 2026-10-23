import { cn } from '@/lib/utils';

/*
 * Pixel sprites drawn by code (ADR 0012 §3): ball, whistle, trophy, cards,
 * star and cup. Each sprite is a character grid; the palette maps a
 * character to an artwork color (not a UI token). Rendered as SVG rects with
 * crisp edges so they scale without blur.
 */

type Palette = Readonly<Record<string, string>>;

const INK = '#15201a';
const CHALK = '#f4efe2';

export interface SpriteProps {
  size?: number;
  className?: string;
  /** Accessible name; decorative (hidden) when omitted. */
  label?: string;
}

function PixelSprite({
  grid,
  palette,
  size = 24,
  className,
  label,
  name,
}: SpriteProps & { grid: readonly string[]; palette: Palette; name: string }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      shapeRendering="crispEdges"
      data-sprite={name}
      className={cn('shrink-0', className)}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true, focusable: 'false' })}
    >
      {grid.flatMap((row, y) =>
        [...row].flatMap((char, x) => {
          const fill = palette[char];
          return fill
            ? [
                <rect
                  key={`${x}-${y}`}
                  x={x}
                  y={y}
                  width={1}
                  height={1}
                  fill={fill}
                />,
              ]
            : [];
        }),
      )}
    </svg>
  );
}

const BALL = [
  '...kkkk...',
  '.kkwwwwkk.',
  '.kwwkkwwk.',
  'kwwkkkkwwk',
  'kwkkwwkkwk',
  'kwkkwwkkwk',
  'kwwkkkkwwk',
  '.kwwkkwwk.',
  '.kkwwwwkk.',
  '...kkkk...',
] as const;

export function PixelBall(props: SpriteProps) {
  return (
    <PixelSprite
      name="ball"
      grid={BALL}
      palette={{ k: INK, w: CHALK }}
      {...props}
    />
  );
}

const WHISTLE = [
  '..........',
  '..kkkkkk..',
  '.kssssssk.',
  'kssskksssk',
  'kssskksssk',
  'kssssssssk',
  '.kssssssk.',
  '..kkkkkk..',
  '.....kk...',
  '......k...',
] as const;

export function PixelWhistle(props: SpriteProps) {
  return (
    <PixelSprite
      name="whistle"
      grid={WHISTLE}
      palette={{ k: INK, s: '#c0c7d0' }}
      {...props}
    />
  );
}

const TROPHY = [
  '.kkkkkkkk.',
  'kygggggygk',
  'kygggggygk',
  'kkgggggkk.',
  '..kgggk...',
  '...kgk....',
  '...kgk....',
  '..kgggk...',
  '.kgggggk..',
  '.kkkkkkk..',
] as const;

export function PixelTrophy(props: SpriteProps) {
  return (
    <PixelSprite
      name="trophy"
      grid={TROPHY}
      palette={{ k: INK, g: '#ffd23f', y: '#ffe88a' }}
      {...props}
    />
  );
}

const CARD = [
  '.kkkkkk.',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  'kccccccK',
  '.kkkkkk.',
] as const;

export function PixelCard({
  tone = 'yellow',
  ...props
}: SpriteProps & { tone?: 'yellow' | 'red' }) {
  return (
    <PixelSprite
      name={`card-${tone}`}
      grid={CARD}
      palette={{ k: INK, K: INK, c: tone === 'red' ? '#c8322b' : '#ffd23f' }}
      {...props}
    />
  );
}

const STAR = [
  '....k....',
  '...kyk...',
  '...kyk...',
  'kkkkyykkk',
  '.kyyyyyk.',
  '..kyyyk..',
  '..kyyyk..',
  '.kyykyyk.',
  'kk.....kk',
] as const;

export function PixelStar(props: SpriteProps) {
  return (
    <PixelSprite
      name="star"
      grid={STAR}
      palette={{ k: INK, y: '#ffd23f' }}
      {...props}
    />
  );
}

const HEART = [
  '.kk..kk.',
  'krrkkrrk',
  'krrrrrrk',
  'krrrrrrk',
  '.krrrrk.',
  '..krrk..',
  '...kk...',
] as const;

export function PixelHeart(props: SpriteProps) {
  return (
    <PixelSprite
      name="heart"
      grid={HEART}
      palette={{ k: INK, r: '#c8322b' }}
      {...props}
    />
  );
}

const ARROW = [
  'k.....',
  'kk....',
  'kyk...',
  'kyyk..',
  'kyyyk.',
  'kyyyyk',
  'kyyyk.',
  'kyyk..',
  'kyk...',
  'kk....',
  'k.....',
] as const;

/** "Press start" arrow; blinks via the `.blink` class when wanted. */
export function PixelArrow(props: SpriteProps) {
  return (
    <PixelSprite
      name="arrow"
      grid={ARROW}
      palette={{ k: INK, y: CHALK }}
      {...props}
    />
  );
}

const COIN = [
  '..kkkk..',
  '.kyyyyk.',
  'kyykkyyk',
  'kyykyyyk',
  'kyykyyyk',
  'kyykkyyk',
  '.kyyyyk.',
  '..kkkk..',
] as const;

export function PixelCoin(props: SpriteProps) {
  return (
    <PixelSprite
      name="coin"
      grid={COIN}
      palette={{ k: INK, y: '#ffd23f' }}
      {...props}
    />
  );
}

const FLAG = [
  'kkkkkkk.',
  'kcwcwck.',
  'kwcwcwk.',
  'kcwcwck.',
  'kkkkkkk.',
  'k.......',
  'k.......',
  'k.......',
] as const;

/** Corner flag (checkered). */
export function PixelFlag(props: SpriteProps) {
  return (
    <PixelSprite
      name="flag"
      grid={FLAG}
      palette={{ k: INK, c: '#c8322b', w: CHALK }}
      {...props}
    />
  );
}
