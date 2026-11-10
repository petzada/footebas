import { useMemo } from 'react';
import { pixelAvatarUri, type PixelAvatarOptions } from '@/lib/retro/avatar';
import { cn } from '@/lib/utils';

/**
 * Deterministic vector portrait for an athlete or coach (no photos). The
 * picture is an inline `data:` SVG, so it never leaves the device and is
 * cached per seed. Decorative unless a `label` is given.
 */
export function PixelAvatar({
  seed,
  size = 48,
  label,
  className,
  ...options
}: PixelAvatarOptions & {
  seed: string;
  size?: number;
  label?: string;
  className?: string;
}) {
  const { backdrop, transparent, shirt } = options;
  const src = useMemo(
    () =>
      pixelAvatarUri(seed, {
        size,
        ...(backdrop === undefined ? {} : { backdrop }),
        ...(transparent === undefined ? {} : { transparent }),
        ...(shirt === undefined ? {} : { shirt }),
      }),
    [seed, size, backdrop, transparent, shirt],
  );
  return (
    // Generated locally; next/image is for remote or static files.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      draggable={false}
      data-avatar-seed={seed}
      className={cn('shrink-0 select-none rounded-md', className)}
      alt={label ?? ''}
      {...(label ? { role: 'img' } : { 'aria-hidden': true })}
    />
  );
}
