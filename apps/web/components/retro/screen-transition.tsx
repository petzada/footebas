'use client';

import { motion } from 'motion/react';
import {
  takeScreenOrigin,
  type ScreenEntrance,
  type ScreenOrigin,
} from '@/lib/retro/transition-origin';
import { usePrefersReducedMotion as useReducedMotion } from '@/lib/retro/use-reduced-motion';
import { markScreen } from '@/lib/rum';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Screen entrance: a short stepped rise (video-game style). With
 * `prefers-reduced-motion` the content simply appears. Never blocks input.
 *
 * When the previous screen handed over a tap point (`setScreenOrigin`, or the
 * `origin` prop), the screen instead grows out of that point with a fade;
 * the screen that follows plays the inverse (settles down from a slight zoom).
 */
export function ScreenTransition({
  id,
  children,
  className,
  origin,
}: {
  /** Changing the id replays the entrance (e.g. the screen name). */
  id: string;
  children: ReactNode;
  className?: string;
  /** Viewport point the screen should grow out of (overrides the hand-off). */
  origin?: ScreenOrigin | null;
}) {
  const reduced = useReducedMotion();
  // Idempotent per id, so re-renders of the same screen keep their answer.
  const entrance: ScreenEntrance = origin
    ? { kind: 'origin', origin }
    : takeScreenOrigin(id);
  const ref = useRef<HTMLDivElement>(null);
  const point = entrance?.kind === 'origin' ? entrance.origin : null;
  const px = point?.x;
  const py = point?.y;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || px === undefined || py === undefined) return;
    const box = node.getBoundingClientRect();
    node.style.transformOrigin = `${px - box.left}px ${py - box.top}px`;
  }, [id, px, py]);
  // Real-user timing: tap → this screen painted (lib/rum.ts).
  useEffect(() => {
    markScreen(id);
  }, [id]);
  if (reduced)
    return (
      <div data-screen={id} data-motion="reduced" className={className}>
        {children}
      </div>
    );
  if (point)
    return (
      <motion.div
        key={id}
        ref={ref}
        data-screen={id}
        data-motion="origin"
        className={className}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut', type: 'tween' }}
      >
        {children}
      </motion.div>
    );
  if (entrance?.kind === 'return')
    return (
      <motion.div
        key={id}
        data-screen={id}
        data-motion="return"
        className={className}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut', type: 'tween' }}
      >
        {children}
      </motion.div>
    );
  return (
    <motion.div
      key={id}
      data-screen={id}
      data-motion="stepped"
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'linear', type: 'tween' }}
    >
      {children}
    </motion.div>
  );
}

/** Staggered entrance for a list of cards or options. */
export function StaggerList({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'ul' | 'ol';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  const Plain = as;
  if (reduced) return <Plain className={className}>{children}</Plain>;
  return (
    <Component
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.05 } },
      }}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'li';
}) {
  const reduced = useReducedMotion();
  const Component = motion[as];
  const Plain = as;
  if (reduced) return <Plain className={className}>{children}</Plain>;
  return (
    <Component
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.18 } },
      }}
    >
      {children}
    </Component>
  );
}
