'use client';

import { motion } from 'motion/react';
import { usePrefersReducedMotion as useReducedMotion } from '@/lib/retro/use-reduced-motion';
import type { ReactNode } from 'react';

/**
 * Screen entrance: a short stepped rise (video-game style). With
 * `prefers-reduced-motion` the content simply appears. Never blocks input.
 */
export function ScreenTransition({
  id,
  children,
  className,
}: {
  /** Changing the id replays the entrance (e.g. the screen name). */
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced)
    return (
      <div data-screen={id} data-motion="reduced" className={className}>
        {children}
      </div>
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
