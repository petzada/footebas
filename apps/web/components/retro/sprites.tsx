import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Game icons drawn by code (ADR 0018): ball, whistle, trophy, cards, star,
 * heart, arrow, coin and corner flag. Smooth vectors on a 24x24 grid, lit
 * from above with a soft gradient and outlined with one consistent stroke.
 * Gold, green and red come from the theme tokens; the arrow follows the text
 * colour. The exported names keep the "Pixel" prefix of the previous theme so
 * no screen has to change.
 */

export interface SpriteProps {
  size?: number;
  className?: string;
  /** Accessible name; decorative (hidden) when omitted. */
  label?: string;
}

/** Shared outline of every icon. */
const OUTLINE = {
  stroke: 'var(--ink)',
  strokeOpacity: 0.7,
  strokeWidth: 1.1,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

const GOLD_LIGHT = '#ffe9a6';
const GOLD_DEEP = '#c8921a';
const SILVER_LIGHT = '#f4f7fa';
const SILVER_DEEP = '#8f9cab';

function Icon({
  size = 24,
  className,
  label,
  name,
  children,
}: SpriteProps & { name: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      fill="none"
      data-sprite={name}
      className={cn('shrink-0', className)}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true, focusable: 'false' })}
    >
      {children}
    </svg>
  );
}

/** Top-to-bottom gradient; `stops` are CSS colours (tokens allowed). */
function Shade({ id, stops }: { id: string; stops: readonly string[] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      {stops.map((color, i) => (
        <stop
          key={i}
          offset={stops.length === 1 ? 0 : i / (stops.length - 1)}
          style={{ stopColor: color }}
        />
      ))}
    </linearGradient>
  );
}

const GOLD = [GOLD_LIGHT, 'var(--bulb)', GOLD_DEEP] as const;

export function PixelBall(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="ball" {...props}>
      <defs>
        <radialGradient id={id} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#dfe6ee" />
          <stop offset="1" stopColor="#aab6c4" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="9.5" fill={`url(#${id})`} {...OUTLINE} />
      <path
        d="M12 7.6 16.2 10.6 14.6 15.5H9.4L7.8 10.6Z"
        fill="var(--ink)"
        fillOpacity="0.88"
      />
      <path
        d="M12 7.6V3.2M16.2 10.6l4.4-1.5M14.6 15.5l2.7 3.8M9.4 15.5l-2.7 3.8M7.8 10.6 3.4 9.1"
        {...OUTLINE}
        strokeOpacity={0.8}
      />
      <path
        d="M8.2 3.6 12 3.2l3.8.4M20.6 9.1l.8 3.6-1.5 3.6M17.3 19.3 12 21.4l-5.3-2.1M4.1 16.3 2.6 12.7l.8-3.6"
        {...OUTLINE}
        strokeOpacity={0.45}
      />
    </Icon>
  );
}

export function PixelWhistle(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="whistle" {...props}>
      <defs>
        <Shade id={id} stops={[SILVER_LIGHT, '#c9d2dc', SILVER_DEEP]} />
      </defs>
      <circle cx="17.6" cy="4.6" r="1.9" {...OUTLINE} stroke="#c9d2dc" />
      <path
        d="M3.5 7.5h11a6.5 6.5 0 1 1-6.18 4.5H3.5a1 1 0 0 1-1-1v-2.5a1 1 0 0 1 1-1Z"
        fill={`url(#${id})`}
        {...OUTLINE}
      />
      <path d="M9.6 7.6h3.2v1.9H9.6Z" fill="var(--ink)" fillOpacity="0.8" />
      <circle cx="14.5" cy="14" r="2.3" fill="var(--ink)" fillOpacity="0.8" />
      <path
        d="M10.2 16.6a5 5 0 0 0 3 2.6"
        stroke="#ffffff"
        strokeOpacity="0.7"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function PixelTrophy(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="trophy" {...props}>
      <defs>
        <Shade id={id} stops={GOLD} />
      </defs>
      <path
        d="M7 5H4.2v1.6a3.6 3.6 0 0 0 3.6 3.6M17 5h2.8v1.6a3.6 3.6 0 0 1-3.6 3.6"
        stroke="var(--bulb)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.9 13h2.2l.5 4.2h-3.2Z" fill={`url(#${id})`} {...OUTLINE} />
      <path d="M7 3h10v5.4a5 5 0 0 1-10 0Z" fill={`url(#${id})`} {...OUTLINE} />
      <rect
        x="7.5"
        y="17.2"
        width="9"
        height="3.6"
        rx="1.1"
        fill={`url(#${id})`}
        {...OUTLINE}
      />
      <path
        d="M9.1 4.8v3.4a3 3 0 0 0 .9 2.1"
        stroke="#ffffff"
        strokeOpacity="0.65"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Icon>
  );
}

export function PixelCard({
  tone = 'yellow',
  ...props
}: SpriteProps & { tone?: 'yellow' | 'red' }) {
  const id = useId();
  return (
    <Icon name={`card-${tone}`} {...props}>
      <defs>
        <Shade
          id={id}
          stops={
            tone === 'red' ? ['#ff8f86', 'var(--card-red)', '#b42b2b'] : GOLD
          }
        />
      </defs>
      <g transform="rotate(9 12 12)">
        <rect
          x="6.4"
          y="2.8"
          width="11.2"
          height="18.4"
          rx="2"
          fill={`url(#${id})`}
          {...OUTLINE}
        />
        <path
          d="M8.6 5.6v7"
          stroke="#ffffff"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </Icon>
  );
}

export function PixelStar(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="star" {...props}>
      <defs>
        <Shade id={id} stops={GOLD} />
      </defs>
      <path
        d="M12 3l2.47 6.1 6.57.46-5.05 4.24 1.59 6.39L12 16.7l-5.58 3.49 1.59-6.39-5.05-4.24 6.57-.46Z"
        fill={`url(#${id})`}
        {...OUTLINE}
      />
      <path
        d="M12 5.9 10.4 10l-3.6.3"
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function PixelHeart(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="heart" {...props}>
      <defs>
        <Shade id={id} stops={['#ff8f86', 'var(--card-red)', '#b42b2b']} />
      </defs>
      <path
        d="M12 20.6C5.2 15.8 2.5 12.2 2.5 8.6a5 5 0 0 1 9.5-2.2 5 5 0 0 1 9.5 2.2c0 3.6-2.7 7.2-9.5 12Z"
        fill={`url(#${id})`}
        {...OUTLINE}
      />
      <path
        d="M5.2 8.4a2.6 2.6 0 0 1 2.4-2.6"
        stroke="#ffffff"
        strokeOpacity="0.65"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** "Play" arrow in the text colour; blinks via the `.blink` class when wanted. */
export function PixelArrow(props: SpriteProps) {
  return (
    <Icon name="arrow" {...props}>
      <path
        d="M8 5.2 18 12 8 18.8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

export function PixelCoin(props: SpriteProps) {
  const id = useId();
  return (
    <Icon name="coin" {...props}>
      <defs>
        <Shade id={id} stops={GOLD} />
      </defs>
      <circle cx="12" cy="12" r="9.5" fill={`url(#${id})`} {...OUTLINE} />
      <circle
        cx="12"
        cy="12"
        r="6.6"
        stroke={GOLD_DEEP}
        strokeOpacity="0.85"
        strokeWidth="1.1"
      />
      <path
        d="M12 7.8l1.15 3.05L16.2 12l-3.05 1.15L12 16.2l-1.15-3.05L7.8 12l3.05-1.15Z"
        fill={GOLD_DEEP}
        fillOpacity="0.9"
      />
      <path
        d="M5.3 9.6a7.2 7.2 0 0 1 4.3-4.3"
        stroke="#ffffff"
        strokeOpacity="0.7"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** Corner flag (checkered). */
export function PixelFlag(props: SpriteProps) {
  const id = useId();
  const clip = `${id}c`;
  return (
    <Icon name="flag" {...props}>
      <defs>
        <Shade id={id} stops={['#ff8f86', 'var(--card-red)']} />
        <clipPath id={clip}>
          <path d="M5.6 4.2q3.5-1.8 7 0t7 0v8.6q-3.5 1.8-7 0t-7 0Z" />
        </clipPath>
      </defs>
      <path
        d="M5.6 4.2q3.5-1.8 7 0t7 0v8.6q-3.5 1.8-7 0t-7 0Z"
        fill={`url(#${id})`}
        {...OUTLINE}
      />
      <g clipPath={`url(#${clip})`} fill="var(--chalk)">
        <path d="M5.6 2h4.7v6.5H5.6ZM14.9 2h4.8v6.5h-4.8ZM10.3 8.5h4.6V15h-4.6Z" />
      </g>
      <path
        d="M5 3v18"
        stroke="var(--chalk-deep)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Icon>
  );
}
