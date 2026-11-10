'use client';

import { useEffect, useRef, useState } from 'react';
import {
  canvasSupportSnapshot,
  readSimplePreference,
} from '@/components/match-stage/stage-mode';
import { clubKit } from '@/lib/club-kits';
import { usePrefersReducedMotion } from '@/lib/retro/use-reduced-motion';
import { cn } from '@/lib/utils';

export interface StadiumShowcaseProps {
  /** Club whose colours dress the stands; a neutral ground when omitted. */
  readonly club?: Readonly<{ id: string; name: string }>;
  /** 0..1: share of the seats taken. */
  readonly occupancy?: number;
  readonly className?: string;
  /** Content drawn over the stadium (titles, numbers). */
  readonly children?: React.ReactNode;
}

const NEUTRAL = { id: 'footebas', name: 'Footebas' } as const;

/**
 * A living 3D stadium as a backdrop (ADR 0018 §9): decorative, loaded on
 * demand after the screen is idle, paused off screen and in hidden tabs.
 * Without WebGL, with "Visual simples" or while it loads, a painted night
 * stadium (pure CSS) holds the place, so nothing depends on the 3D.
 */
export function StadiumShowcase({
  club = NEUTRAL,
  occupancy,
  className,
  children,
}: StadiumShowcaseProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);
  const { id: clubId, name: clubName } = club;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (canvasSupportSnapshot() !== 'webgl' || readSimplePreference()) return;
    let disposed = false;
    let handle: { wake(): void; sleep(): void; dispose(): void } | undefined;
    const kit =
      clubId === NEUTRAL.id
        ? { shirt: '#128a4c', trim: '#f6c443' }
        : clubKit({ id: clubId, name: clubName });
    const start = () => {
      void Promise.all([
        import('@/components/match-stage/stadium/showcase'),
        import('@/components/match-stage/stadium/quality'),
      ])
        .then(([{ createStadiumShowcase }, { detectQuality }]) =>
          createStadiumShowcase({
            host,
            quality: detectQuality(),
            colour: kit.shirt,
            trim: kit.trim,
            name: clubName,
            still: reducedMotion,
            ...(occupancy === undefined ? {} : { occupancy }),
            onReady: () => {
              if (!disposed) setReady(true);
            },
          }),
        )
        .then((created) => {
          if (disposed) created.dispose();
          else {
            handle = created;
            if (document.hidden || !visible) created.sleep();
          }
        })
        .catch(() => undefined);
    };
    // The screen comes first: build the stadium when the browser is idle.
    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(start, { timeout: 1500 })
        : window.setTimeout(start, 400);

    let visible = true;
    const apply = () => {
      if (document.hidden || !visible) handle?.sleep();
      else handle?.wake();
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? undefined
        : new IntersectionObserver((entries) => {
            visible = entries.some((entry) => entry.isIntersecting);
            apply();
          });
    observer?.observe(host);
    document.addEventListener('visibilitychange', apply);

    return () => {
      disposed = true;
      if (typeof window.cancelIdleCallback === 'function')
        window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', apply);
      handle?.dispose();
      setReady(false);
    };
  }, [clubId, clubName, occupancy, reducedMotion]);

  return (
    <div
      className={cn('stadium-showcase relative overflow-hidden', className)}
      data-ready={ready}
      data-testid="stadium-showcase"
    >
      <div
        aria-hidden="true"
        className={cn(
          'stadium-showcase-paint absolute inset-0 transition-opacity duration-700',
          ready && 'opacity-0',
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 transition-opacity duration-700 [&_canvas]:block',
          ready ? 'opacity-100' : 'opacity-0',
        )}
        ref={hostRef}
      />
      <div
        aria-hidden="true"
        className="stadium-showcase-shade absolute inset-0"
      />
      {children ? <div className="relative z-10">{children}</div> : null}
    </div>
  );
}
