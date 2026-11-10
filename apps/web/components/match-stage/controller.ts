/**
 * Clock of the match stage: a mutable controller written by React and read by
 * the renderer. It only says which highlight is on screen and how far into it
 * we are; it never feeds anything back into the score or the events.
 */
import { stepForMinute, type StageChoreography } from './choreography';
import type { MatchKits } from '@/lib/club-kits';

export interface StageController {
  /** Swapped in place when the timeline is re-planned at a break. */
  choreography: StageChoreography;
  readonly kits: MatchKits;
  /** Highlight on screen (index into `choreography.segments`). */
  step: number;
  /** 0..1 through the highlight; 1 = over, open play resumes. */
  progress: number;
  paused: boolean;
  speed: number;
}

/** Real time of a highlight at 1x. */
export function segmentDurationMs(
  choreography: StageChoreography,
  step: number,
): number {
  return Math.max(1, choreography.segments[step]?.durationMs ?? 1);
}

/** Advances the highlight clock; returns true while it is still playing. */
export function advanceController(
  controller: StageController,
  deltaMs: number,
): boolean {
  if (controller.paused || controller.progress >= 1) return false;
  const delta = Math.max(0, Math.min(deltaMs, 100));
  controller.progress = Math.min(
    1,
    controller.progress +
      (delta * controller.speed) /
        segmentDurationMs(controller.choreography, controller.step),
  );
  return true;
}

/**
 * Writes the React replay state into the controller. Only the natural next
 * step animates; skips and rewinds snap to the rest pose, so "ver resultado"
 * is never held back by the animation.
 */
export function syncController(
  controller: StageController,
  state: Readonly<{ minute: number; playing: boolean; speed: number }>,
): void {
  const complete = state.minute >= controller.choreography.duration;
  controller.speed = state.speed;
  controller.paused = !state.playing && !complete;
  const target = stepForMinute(controller.choreography, state.minute);
  if (target === controller.step) return;
  const natural = target === controller.step + 1;
  controller.step = target;
  controller.progress = natural ? 0 : 1;
}
