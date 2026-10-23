/**
 * Pure geometry for the 3D stage: maps the renderer-agnostic normalized
 * frame (`sampleStageNormalized`, 0..1 over the 100x64 pitch box) onto the
 * converted stadium model, and drives the TV camera.
 *
 * World frame (metres): +X runs goal to goal (home goal at -X), +Z towards
 * the near touchline (where the camera sits), +Y up, grass at y = 0. The GLB
 * produced by `scripts/convert-stadium.mjs` is baked into this same frame.
 */
import { PITCH, type NormalizedStagePoint } from './choreography';

export const FIELD = {
  /** Painted line box of the model, in metres. */
  lineLength: 105,
  lineWidth: 67.35,
  /** Whole grass island (lines plus the margin), in metres. */
  islandLength: 114.38,
  islandWidth: 76.26,
  islandDepth: 10.48,
  /** Goal mouth. */
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2,
  /** Max ball lift (normalized height 1) in metres. */
  ballLift: 6,
} as const;

/** Metres per pitch unit along each axis (lines at 2..98 and 2..62). */
const UNIT_X = FIELD.lineLength / (PITCH.right - PITCH.left);
const UNIT_Z = FIELD.lineWidth / (PITCH.bottom - PITCH.top);

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/** Normalized pitch point (u goal to goal, v far to near) to world metres. */
export function pitchToWorld(
  point: NormalizedStagePoint,
  height = 0,
): WorldPoint {
  return {
    x: round((point.u * PITCH.width - PITCH.width / 2) * UNIT_X),
    y: round(height * FIELD.ballLift),
    z: round((point.v * PITCH.height - PITCH.height / 2) * UNIT_Z),
  };
}

/** World x of the goal line a side attacks (home attacks +X). */
export function goalLineX(side: 'home' | 'away'): number {
  return side === 'home' ? FIELD.lineLength / 2 : -FIELD.lineLength / 2;
}

export interface CameraRig {
  readonly position: WorldPoint;
  readonly target: WorldPoint;
  /** Vertical field of view in degrees. */
  readonly fov: number;
}

export type CameraShot =
  | Readonly<{ kind: 'follow'; focus: WorldPoint; zoom: number }>
  | Readonly<{ kind: 'goal'; side: 'home' | 'away'; intensity: number }>;

const FOLLOW = {
  height: 36,
  distance: 62,
  fov: 34,
  zoomFov: 26,
  panLimit: 34,
  lookLimit: 46,
} as const;

/**
 * Where the broadcast camera wants to be for a shot. `follow` pans along the
 * near touchline after the ball; `goal` pushes in towards the net.
 */
export function cameraFor(shot: CameraShot): CameraRig {
  if (shot.kind === 'goal') {
    const goalX = goalLineX(shot.side);
    const t = clamp(shot.intensity, 0, 1);
    const toward = Math.sign(goalX);
    return {
      position: {
        x: round(goalX * (0.5 + 0.1 * t) - toward * 4),
        y: round(FOLLOW.height - 12 * t),
        z: round(FOLLOW.distance - 18 * t),
      },
      target: { x: round(goalX * 0.9), y: round(1.2 - 0.4 * t), z: 0 },
      fov: round(FOLLOW.fov - (FOLLOW.fov - 24) * t),
    };
  }
  const zoom = clamp(shot.zoom, 0, 1);
  const panX = clamp(shot.focus.x * 0.6, -FOLLOW.panLimit, FOLLOW.panLimit);
  const lookX = clamp(shot.focus.x * 0.85, -FOLLOW.lookLimit, FOLLOW.lookLimit);
  return {
    position: {
      x: round(panX),
      y: round(FOLLOW.height - 6 * zoom),
      z: round(FOLLOW.distance - 10 * zoom),
    },
    target: {
      x: round(lookX),
      y: 0,
      z: round(clamp(shot.focus.z * 0.35, -12, 12)),
    },
    fov: round(FOLLOW.fov - (FOLLOW.fov - FOLLOW.zoomFov) * zoom),
  };
}

function dampValue(from: number, to: number, factor: number): number {
  const next = from + (to - from) * factor;
  // Snap the last centimetre so rounding can never stall short of the goal.
  return Math.abs(to - next) < 0.01 ? to : next;
}

function dampPoint(
  from: WorldPoint,
  to: WorldPoint,
  factor: number,
): WorldPoint {
  return {
    x: dampValue(from.x, to.x, factor),
    y: dampValue(from.y, to.y, factor),
    z: dampValue(from.z, to.z, factor),
  };
}

/**
 * Frame-rate independent exponential smoothing towards `goal`. Never
 * overshoots and is deterministic for the same `(from, goal, deltaMs)`.
 * `halfLifeMs` is how long it takes to close half of the remaining gap.
 */
export function dampCamera(
  from: CameraRig,
  goal: CameraRig,
  deltaMs: number,
  halfLifeMs = 420,
): CameraRig {
  const delta = clamp(deltaMs, 0, 1000);
  const factor =
    halfLifeMs <= 0 ? 1 : 1 - Math.pow(0.5, delta / Math.max(1, halfLifeMs));
  return {
    position: dampPoint(from.position, goal.position, factor),
    target: dampPoint(from.target, goal.target, factor),
    fov: dampValue(from.fov, goal.fov, factor),
  };
}

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** True when the rig is close enough to its goal to stop re-rendering. */
export function cameraSettled(
  current: CameraRig,
  goal: CameraRig,
  epsilon = 0.02,
): boolean {
  return (
    distance(current.position, goal.position) < epsilon &&
    distance(current.target, goal.target) < epsilon &&
    Math.abs(current.fov - goal.fov) < epsilon
  );
}

/** Low-resolution render size for the retro look (pixel-doubled by CSS). */
export function renderSizeFor(cssWidth: number): Readonly<{
  width: number;
  height: number;
}> {
  const width = cssWidth >= 640 ? 480 : cssWidth >= 420 ? 400 : 320;
  return { width, height: Math.round(width * 0.625) };
}

/** Running-cycle frame (0..frames-1) from distance covered, in metres. */
export function runFrame(distanceMoved: number, frames = 3): number {
  if (distanceMoved < 0.05) return 0;
  return Math.floor(distanceMoved / 0.9) % frames;
}
