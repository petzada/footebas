import type { MatchEvent, MatchResult } from '@footebas/domain';

/** Feed speeds; 0.5× is the slow live view of decision 18. */
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4, 8] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];
export type MatchOutputMode = 'instant' | 'fast' | 'feed';

export interface FeedItem {
  readonly id: string;
  readonly minute: number;
  readonly event: MatchEvent;
  readonly importance: 'routine' | 'key';
}

export interface MatchPresentation {
  readonly result: Readonly<{ home: number; away: number }>;
  readonly feed: readonly FeedItem[];
  readonly keyMoments: readonly FeedItem[];
  readonly playback: Readonly<{
    modes: readonly MatchOutputMode[];
    speeds: readonly PlaybackSpeed[];
    canSkip: true;
  }>;
}

export function createMatchPresentation(
  result: MatchResult,
): MatchPresentation {
  const feed = result.timeline.map((event, index) =>
    Object.freeze({
      id: `${result.matchId}_event_${String(index + 1)}`,
      minute: event.minute,
      event,
      importance: [
        'goal',
        'card',
        'injury',
        'substitution',
        'tactical_change',
      ].includes(event.type)
        ? ('key' as const)
        : ('routine' as const),
    }),
  );
  return Object.freeze({
    result: Object.freeze({ home: result.homeGoals, away: result.awayGoals }),
    feed: Object.freeze(feed),
    keyMoments: Object.freeze(
      feed.filter(({ importance }) => importance === 'key'),
    ),
    playback: Object.freeze({
      modes: Object.freeze(['instant', 'fast', 'feed'] as const),
      speeds: Object.freeze([...PLAYBACK_SPEEDS]),
      canSkip: true as const,
    }),
  });
}
