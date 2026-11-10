/**
 * Broadcast direction of a highlight: how the real-time clock of a segment
 * maps onto its choreography. Goals are shown live, celebrated, replayed in
 * slow motion from behind the goal and only then handed back to open play.
 * Pure and presentation-only.
 */
import { PHASES, type StageSegment } from './choreography';

export type DirectionMode = 'live' | 'celebration' | 'replay' | 'rest';

export interface Direction {
  /** Choreography progress to sample (not monotonic: replays rewind). */
  readonly p: number;
  readonly mode: DirectionMode;
}

/** Clock marks of a goal highlight (fractions of the segment). */
export const GOAL_CUT = {
  /** Live play up to just after the ball hits the net. */
  live: 0.47,
  celebration: 0.68,
  replay: 0.95,
  /** Choreography window the live part covers. */
  liveUntil: 0.82,
  /** Choreography window the replay shows again. */
  replayFrom: 0.5,
  replayUntil: 0.8,
} as const;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

export function isGoal(segment: StageSegment | undefined): boolean {
  return segment?.overlay?.kind === 'goal';
}

/** Where the choreography is for a segment clock in 0..1. */
export function directionAt(
  segment: StageSegment | undefined,
  clock: number,
): Direction {
  const t = Math.max(0, Math.min(1, clock));
  if (!isGoal(segment)) return { p: t, mode: t >= 1 ? 'rest' : 'live' };
  if (t < GOAL_CUT.live)
    return { p: lerp(0, GOAL_CUT.liveUntil, t / GOAL_CUT.live), mode: 'live' };
  if (t < GOAL_CUT.celebration)
    return {
      p: lerp(
        GOAL_CUT.liveUntil,
        1,
        (t - GOAL_CUT.live) / (GOAL_CUT.celebration - GOAL_CUT.live),
      ),
      mode: 'celebration',
    };
  if (t < GOAL_CUT.replay)
    return {
      p: lerp(
        GOAL_CUT.replayFrom,
        GOAL_CUT.replayUntil,
        (t - GOAL_CUT.celebration) / (GOAL_CUT.replay - GOAL_CUT.celebration),
      ),
      mode: 'replay',
    };
  return { p: 1, mode: 'rest' };
}

/**
 * Segment clock at which the decisive action lands (ball in the net, card
 * shown...): where sounds and the narration line belong.
 */
export function actionClock(segment: StageSegment | undefined): number {
  return isGoal(segment)
    ? (PHASES.action / GOAL_CUT.liveUntil) * GOAL_CUT.live
    : PHASES.action;
}
