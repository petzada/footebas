import { PixelAvatar } from '@/components/retro/pixel-avatar';
import { COACH_AVATARS, type CoachAvatarId } from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

/*
 * Generic coach avatars, drawn by the game (no photos, no real people).
 * Each id (`avatar-01` … `avatar-12`) is a fixed pixel-art seed with its
 * own backdrop, so the same choice always looks the same.
 */
const BACKDROPS: Readonly<Record<CoachAvatarId, string>> = {
  'avatar-01': '246630',
  'avatar-02': 'ffd23f',
  'avatar-03': '7cc4ea',
  'avatar-04': 'c8322b',
  'avatar-05': 'a0672f',
  'avatar-06': '2f7d3a',
  'avatar-07': '7cc4ea',
  'avatar-08': 'ffd23f',
  'avatar-09': '246630',
  'avatar-10': 'c8322b',
  'avatar-11': 'a0672f',
  'avatar-12': '2f7d3a',
};

export function avatarNumber(avatar: CoachAvatarId): number {
  return COACH_AVATARS.indexOf(avatar) + 1;
}

/** Deterministic pixel coach (`avatar-01` … `avatar-12`). */
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
  const id = avatar in BACKDROPS ? avatar : 'avatar-01';
  return (
    <span
      data-avatar={avatar}
      className={cn('px-border inline-block shrink-0 bg-chalk', className)}
      style={{ width: size, height: size }}
    >
      <PixelAvatar
        seed={`treinador-${id}`}
        size={size}
        backdrop={BACKDROPS[id]}
        {...(label ? { label } : {})}
      />
    </span>
  );
}
