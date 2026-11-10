/**
 * How long each kind of play holds the screen at 1x. Shared by the live clock
 * (which waits on the play) and by the 3D stage (which animates it), so the
 * narration, the scoreboard and the highlight always end together.
 * Presentation only.
 */
import type { ReplayEvent } from './match-replay-model';

/** Real time of one quiet match minute at 1x. */
export const LIVE_MINUTE_MS = 650;

export const PLAY_MS: Readonly<Record<ReplayEvent['type'] | 'none', number>> = {
  goal: 10_000,
  chance: 5_200,
  card: 4_200,
  injury: 4_200,
  substitution: 3_400,
  tactical_change: 2_600,
  none: 2_600,
};

const PRIORITY: Readonly<Record<ReplayEvent['type'], number>> = {
  goal: 6,
  chance: 5,
  card: 4,
  injury: 3,
  substitution: 2,
  tactical_change: 1,
};

/** The event that owns the highlight when several share a minute. */
export function primaryEvent(
  events: readonly ReplayEvent[],
): ReplayEvent | undefined {
  let best: ReplayEvent | undefined;
  for (const event of events)
    if (!best || PRIORITY[event.type] > PRIORITY[best.type]) best = event;
  return best;
}

/** Time the highlight of a minute takes at 1x. */
export function playDurationMs(events: readonly ReplayEvent[]): number {
  return PLAY_MS[primaryEvent(events)?.type ?? 'none'];
}

/** Highlight length of an official minute of a timeline, at 1x. */
export function minuteDwellMs(
  timeline: readonly ReplayEvent[],
  minute: number,
): number {
  return playDurationMs(
    timeline.filter((event) => Math.floor(event.minute) === minute),
  );
}

/** Narration beat when no highlight is on screen (kickoff, breaks, simple pitch). */
export const LIVE_EVENT_MS = 900;

/**
 * Fraction of a highlight at which its decisive action lands: the moment the
 * narration line and the scoreboard may show it without spoiling the picture.
 */
const REVEAL_AT: Readonly<Record<ReplayEvent['type'], number>> = {
  goal: 0.43,
  chance: 0.74,
  card: 0.74,
  injury: 0.74,
  substitution: 0.6,
  tactical_change: 0.5,
};

function primaryAt(
  timeline: readonly ReplayEvent[],
  minute: number,
): ReplayEvent | undefined {
  return primaryEvent(
    timeline.filter((event) => Math.floor(event.minute) === minute),
  );
}

/** Time from reaching a minute to revealing its play, at 1x. */
export function revealDelayMs(
  timeline: readonly ReplayEvent[],
  minute: number,
): number {
  const primary = primaryAt(timeline, minute);
  return primary
    ? PLAY_MS[primary.type] * REVEAL_AT[primary.type]
    : LIVE_EVENT_MS;
}

/** Rest of the highlight after the reveal: the clock waits for it, at 1x. */
export function holdAfterRevealMs(
  timeline: readonly ReplayEvent[],
  minute: number,
): number {
  const primary = primaryAt(timeline, minute);
  return primary ? PLAY_MS[primary.type] * (1 - REVEAL_AT[primary.type]) : 0;
}
