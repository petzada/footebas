import { PixelAvatar } from '@/components/retro/pixel-avatar';
import {
  COACH_AVATARS,
  isAvatarUrl,
  type CoachAvatarId,
  type CoachAvatarRef,
} from '@/lib/coach-profile';
import { cn } from '@/lib/utils';

/*
 * Generic coach avatars, drawn by the game (no photos, no real people).
 * Each id (`avatar-01` … `avatar-12`) is a fixed portrait seed with its
 * own backdrop, so the same choice always looks the same.
 */
const BACKDROPS: Readonly<Record<CoachAvatarId, string>> = {
  'avatar-01': '1f3a5c',
  'avatar-02': '4d3c14',
  'avatar-03': '1b4a54',
  'avatar-04': '5a2a2e',
  'avatar-05': '2e2f5e',
  'avatar-06': '12543a',
  'avatar-07': '1b4a54',
  'avatar-08': '4d3c14',
  'avatar-09': '1f3a5c',
  'avatar-10': '5a2a2e',
  'avatar-11': '2e2f5e',
  'avatar-12': '12543a',
};

export function avatarNumber(avatar: CoachAvatarId): number {
  return COACH_AVATARS.indexOf(avatar) + 1;
}

/** Deterministic pixel coach (`avatar-01` … `avatar-12`) or the coach's own picture. */
export function CoachAvatar({
  avatar,
  size = 64,
  label,
  className,
}: {
  avatar: CoachAvatarRef | string;
  size?: number;
  label?: string;
  className?: string;
}) {
  if (isAvatarUrl(avatar))
    return (
      // eslint-disable-next-line @next/next/no-img-element -- user picture from our CDN
      <img
        src={avatar}
        alt={label ?? ''}
        {...(label ? {} : { 'aria-hidden': true })}
        data-avatar="custom"
        width={size}
        height={size}
        className={cn(
          'px-border inline-block shrink-0 overflow-hidden bg-muted object-cover',
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  const id = avatar in BACKDROPS ? (avatar as CoachAvatarId) : 'avatar-01';
  return (
    <span
      data-avatar={avatar}
      className={cn(
        'px-border inline-block shrink-0 overflow-hidden bg-muted',
        className,
      )}
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
