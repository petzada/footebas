/**
 * Hand-off point between a screen that was tapped somewhere (the club map)
 * and the next `ScreenTransition`, which grows out of that spot. The shell
 * does not need to know: the origin is set right before navigating and
 * consumed by the next transition that mounts.
 */
export interface ScreenOrigin {
  /** Viewport coordinates (px) of the tap. */
  readonly x: number;
  readonly y: number;
}

export type ScreenEntrance =
  { kind: 'origin'; origin: ScreenOrigin } | { kind: 'return' } | null;

let pending: ScreenOrigin | null = null;
let lastWasOrigin = false;
let cached: { id: string; entrance: ScreenEntrance } | null = null;

/** Remember where the user tapped, for the next screen entrance. */
export function setScreenOrigin(origin: ScreenOrigin | null): void {
  pending = origin;
  cached = null;
}

/**
 * Entrance for the screen `id` that is mounting: `'origin'` with the tap
 * point when it should grow out of it, `'return'` when the previous screen
 * entered that way (so this one plays the inverse), else `null`. Asking
 * again for the same id returns the same answer (strict mode, re-renders).
 */
export function takeScreenOrigin(id: string): ScreenEntrance {
  if (cached?.id === id) return cached.entrance;
  let entrance: ScreenEntrance = null;
  if (pending) {
    entrance = { kind: 'origin', origin: pending };
    pending = null;
    lastWasOrigin = true;
  } else if (lastWasOrigin) {
    entrance = { kind: 'return' };
    lastWasOrigin = false;
  }
  cached = { id, entrance };
  return entrance;
}

/** Test helper: forget any pending origin. */
export function resetScreenOrigin(): void {
  pending = null;
  lastWasOrigin = false;
  cached = null;
}
