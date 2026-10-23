import { useId } from 'react';
import { COACH_AVATARS, type CoachAvatarId } from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

type Hair = 'short' | 'buzz' | 'curly' | 'long' | 'bald' | 'bun' | 'cap';
type Extra = 'none' | 'beard' | 'glasses' | 'moustache';

interface AvatarSpec {
  readonly skin: string;
  readonly hair: Hair;
  readonly hairColor: string;
  readonly extra: Extra;
  readonly shirt: string;
  readonly sky: readonly [string, string];
}

/*
 * Generic coach avatars, drawn by the game (no photos, no real people).
 * Illustration colors live here because they are artwork, not UI tokens.
 */
const SPECS: Readonly<Record<CoachAvatarId, AvatarSpec>> = {
  'avatar-01': {
    skin: '#f2c6a0',
    hair: 'short',
    hairColor: '#3b2a20',
    extra: 'none',
    shirt: '#1d7446',
    sky: ['#bee3f0', '#e4eef7'],
  },
  'avatar-02': {
    skin: '#8d5a3b',
    hair: 'buzz',
    hairColor: '#1d1612',
    extra: 'beard',
    shirt: '#f57a57',
    sky: ['#fdf1e3', '#f9e2e7'],
  },
  'avatar-03': {
    skin: '#ffd6c2',
    hair: 'long',
    hairColor: '#c98e3c',
    extra: 'none',
    shirt: '#4a6fa5',
    sky: ['#dff3f1', '#bee3f0'],
  },
  'avatar-04': {
    skin: '#c98e66',
    hair: 'curly',
    hairColor: '#2b1d16',
    extra: 'glasses',
    shirt: '#17263a',
    sky: ['#f9e2e7', '#fdf1e3'],
  },
  'avatar-05': {
    skin: '#e7b48f',
    hair: 'bald',
    hairColor: '#6e4630',
    extra: 'moustache',
    shirt: '#a93b24',
    sky: ['#e4eef7', '#dff3f1'],
  },
  'avatar-06': {
    skin: '#6e4630',
    hair: 'bun',
    hairColor: '#120d0a',
    extra: 'none',
    shirt: '#2e9e62',
    sky: ['#bee3f0', '#f9e2e7'],
  },
  'avatar-07': {
    skin: '#ffe3d3',
    hair: 'short',
    hairColor: '#8a8f99',
    extra: 'glasses',
    shirt: '#4a5b70',
    sky: ['#fdf1e3', '#e4eef7'],
  },
  'avatar-08': {
    skin: '#b07a55',
    hair: 'cap',
    hairColor: '#1d7446',
    extra: 'beard',
    shirt: '#f4b740',
    sky: ['#dff3f1', '#fdf1e3'],
  },
  'avatar-09': {
    skin: '#f2c6a0',
    hair: 'curly',
    hairColor: '#a3471f',
    extra: 'none',
    shirt: '#7a4fa0',
    sky: ['#f9e2e7', '#bee3f0'],
  },
  'avatar-10': {
    skin: '#8d5a3b',
    hair: 'long',
    hairColor: '#1d1612',
    extra: 'none',
    shirt: '#1f7a8c',
    sky: ['#e4eef7', '#f9e2e7'],
  },
  'avatar-11': {
    skin: '#e7b48f',
    hair: 'buzz',
    hairColor: '#4a3426',
    extra: 'moustache',
    shirt: '#c2553b',
    sky: ['#bee3f0', '#dff3f1'],
  },
  'avatar-12': {
    skin: '#c98e66',
    hair: 'bald',
    hairColor: '#d9d9d9',
    extra: 'beard',
    shirt: '#17263a',
    sky: ['#fdf1e3', '#dff3f1'],
  },
};

export function avatarNumber(avatar: CoachAvatarId): number {
  return COACH_AVATARS.indexOf(avatar) + 1;
}

function HairShape({ spec }: { spec: AvatarSpec }) {
  const fill = spec.hairColor;
  switch (spec.hair) {
    case 'short':
      return (
        <path d="M19 31 C19 17 45 13 47 29 C43 24 28 22 19 31 Z" fill={fill} />
      );
    case 'buzz':
      return (
        <path
          d="M20 29 C21 19 43 17 45 28 C38 25 27 25 20 29 Z"
          fill={fill}
          opacity="0.85"
        />
      );
    case 'curly':
      return (
        <g fill={fill}>
          <circle cx="22" cy="25" r="5" />
          <circle cx="29" cy="20" r="6" />
          <circle cx="37" cy="20" r="6" />
          <circle cx="44" cy="25" r="5" />
          <circle cx="19" cy="31" r="3.5" />
          <circle cx="47" cy="31" r="3.5" />
        </g>
      );
    case 'long':
      return (
        <path
          d="M18 46 C14 26 20 16 33 16 C46 16 52 26 48 46 L44 46 C46 34 44 26 33 25 C22 26 20 34 22 46 Z"
          fill={fill}
        />
      );
    case 'bun':
      return (
        <g fill={fill}>
          <circle cx="33" cy="13" r="6" />
          <path d="M19 30 C19 18 47 16 47 30 C42 23 25 23 19 30 Z" />
        </g>
      );
    case 'cap':
      return (
        <g fill={fill}>
          <path d="M19 28 C19 17 47 16 47 28 Z" />
          <rect x="30" y="26" width="22" height="4" rx="2" />
        </g>
      );
    case 'bald':
      return (
        <g fill={fill}>
          <path d="M19 33 C19 29 20 27 21 26 L21 34 Z" />
          <path d="M47 33 C47 29 46 27 45 26 L45 34 Z" />
        </g>
      );
  }
}

function ExtraShape({ spec }: { spec: AvatarSpec }) {
  switch (spec.extra) {
    case 'beard':
      return (
        <path
          d="M22 37 C23 47 28 51 33 51 C38 51 43 47 44 37 C41 43 37 44 33 44 C29 44 25 43 22 37 Z"
          fill={spec.hairColor}
          opacity="0.9"
        />
      );
    case 'moustache':
      return (
        <path
          d="M27 40 C30 37 32 38 33 39 C34 38 36 37 39 40 C36 41 34 40 33 40 C32 40 30 41 27 40 Z"
          fill={spec.hairColor}
        />
      );
    case 'glasses':
      return (
        <g fill="none" stroke="#17263a" strokeWidth="1.6">
          <circle cx="27.5" cy="33" r="4" />
          <circle cx="38.5" cy="33" r="4" />
          <path d="M31.5 33 H34.5" />
        </g>
      );
    case 'none':
      return null;
  }
}

/**
 * Generic coach avatar (`avatar-01` … `avatar-12`), deterministic SVG.
 * Decorative unless a `label` is given.
 */
export function CoachAvatar({
  avatar,
  size = 64,
  label,
  className,
}: {
  avatar: CoachAvatarId;
  size?: number;
  label?: string;
  className?: string;
}) {
  const gradient = useId();
  const spec = SPECS[avatar] ?? SPECS['avatar-01'];
  return (
    <svg
      viewBox="0 0 66 66"
      width={size}
      height={size}
      data-avatar={avatar}
      className={cn('shrink-0 rounded-[28%]', className)}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true, focusable: 'false' })}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={spec.sky[0]} />
          <stop offset="1" stopColor={spec.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="66" height="66" rx="18" fill={`url(#${gradient})`} />
      {/* shirt with collar */}
      <path
        d="M8 66 C10 52 20 48 33 48 C46 48 56 52 58 66 Z"
        fill={spec.shirt}
      />
      <path d="M27 48 L33 56 L39 48 Z" fill="#ffffff" opacity="0.85" />
      {/* neck and head */}
      <rect x="28" y="40" width="10" height="10" rx="4" fill={spec.skin} />
      <ellipse cx="33" cy="32" rx="13" ry="15" fill={spec.skin} />
      <circle cx="20" cy="33" r="2.5" fill={spec.skin} />
      <circle cx="46" cy="33" r="2.5" fill={spec.skin} />
      <HairShape spec={spec} />
      {/* face */}
      <circle cx="28" cy="33" r="1.5" fill="#17263a" />
      <circle cx="38" cy="33" r="1.5" fill="#17263a" />
      <path
        d="M29 41 C31 43 35 43 37 41"
        stroke="#17263a"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <ExtraShape spec={spec} />
    </svg>
  );
}
