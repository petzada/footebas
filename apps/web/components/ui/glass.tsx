import * as React from 'react';

import { cn } from '@/lib/utils';

type GlassElement = 'div' | 'section' | 'header' | 'nav' | 'aside' | 'article';

/**
 * ISOPOP glass surface (ADR 0009): white at 50% (72% when `strong`), light
 * border, soft shadow and the single blur token. `globals.css` swaps it for
 * an opaque surface without backdrop-filter support or with
 * `prefers-reduced-transparency`. Keep it to six per screen and never use it
 * for long lists (use `surface` there).
 */
export function Glass({
  as: Component = 'div',
  strong = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: GlassElement;
  strong?: boolean;
}) {
  return (
    <Component
      data-glass={strong ? 'strong' : 'regular'}
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-2xl',
        className,
      )}
      {...props}
    />
  );
}
