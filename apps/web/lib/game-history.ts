'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import type { Screen } from '@/lib/career-api';

/** Where the player is: the flow stage and, inside the career, the screen. */
export interface GameLocation {
  readonly stage: string;
  readonly screen: Screen;
}

interface HistoryState {
  readonly footebas?: GameLocation;
}

function locationOf(state: unknown): GameLocation | undefined {
  const candidate = (state as HistoryState | null)?.footebas;
  return candidate && typeof candidate.stage === 'string'
    ? candidate
    : undefined;
}

/**
 * One browser-history entry per screen (docs/design revisão mobile, D1):
 * the phone's Back goes to the previous screen instead of leaving the
 * game. The first screen replaces the entry it was opened on, so Back from
 * it leaves the site (no trap), and the sign-in/loading stage never gets an
 * entry of its own. During a live match Back pauses instead of leaving:
 * `onBackInMatch` runs and the match entry is pushed again.
 */
export function useGameHistory({
  location,
  restore,
  onBackInMatch,
}: {
  location: GameLocation;
  /** Applies a location that came back from the history. */
  restore(target: GameLocation): void;
  /** Called instead of `restore` while a match is being played. */
  onBackInMatch?: (() => void) | undefined;
}) {
  const started = useRef(false);
  // Set when `restore` changes the location, so that render does not push.
  const restoring = useRef(false);
  const { stage, screen } = location;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const state: HistoryState = { footebas: { stage, screen } };
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    const previous = locationOf(window.history.state);
    // Login/loading never gets its own entry; the first real screen takes
    // the entry the page was opened on.
    if (!started.current || stage === 'login' || previous?.stage === 'login') {
      started.current = true;
      window.history.replaceState(state, '');
      return;
    }
    if (previous?.stage === stage && previous.screen === screen) return;
    window.history.pushState(state, '');
  }, [stage, screen]);

  const onPopState = useEffectEvent((event: PopStateEvent) => {
    const target = locationOf(event.state);
    if (!target) return;
    if (stage === 'match') {
      onBackInMatch?.();
      window.history.pushState(
        { footebas: { stage, screen } } satisfies HistoryState,
        '',
      );
      return;
    }
    if (target.stage === stage && target.screen === screen) return;
    restoring.current = true;
    restore(target);
  });

  useEffect(() => {
    const listener = (event: PopStateEvent) => onPopState(event);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
}
