/**
 * Pure geometry for the 3D stage: maps the renderer-agnostic normalized frame
 * (`sampleStageNormalized`, 0..1 over the 100x64 pitch box) onto the stadium
 * and drives the broadcast cameras.
 *
 * World frame (metres): +X runs goal to goal (home goal at -X), +Z towards
 * the near touchline (where the main camera sits), +Y up, grass at y = 0.
 */
import { PITCH, type NormalizedStagePoint } from './choreography';

export const FIELD = {
  /** Painted line box, in metres (official 105 x 68). */
  lineLength: 105,
  lineWidth: 68,
  /** Grass beyond the lines before the boards. */
  margin: 7,
  /** Goal mouth. */
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2.2,
  /** Max ball lift (normalized height 1) in metres. */
  ballLift: 6.5,
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

/** Pitch units (100x64 box) to world metres, for anchors and spots. */
export function unitsToWorld(x: number, y: number): WorldPoint {
  return pitchToWorld({ u: x / PITCH.width, v: y / PITCH.height });
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
  /** Main gantry camera: pans along the near touchline after the ball. */
  | Readonly<{ kind: 'follow'; focus: WorldPoint; zoom: number }>
  /** Push in towards the net as the ball goes in. */
  | Readonly<{ kind: 'goal'; side: 'home' | 'away'; intensity: number }>
  /** Slow aerial orbit: before kickoff, at the breaks and at full time. */
  | Readonly<{ kind: 'aerial'; angle: number }>
  /** Low shot of an athlete from `angle` around him (celebrations). */
  | Readonly<{ kind: 'hero'; focus: WorldPoint; angle: number }>
  /** Behind-the-goal replay camera. */
  | Readonly<{ kind: 'replay'; side: 'home' | 'away'; focus: WorldPoint }>
  /** Tight shot of one athlete (cards, injuries, substitutions). */
  | Readonly<{ kind: 'close'; focus: WorldPoint }>;

const FOLLOW = {
  height: 25,
  distance: 64,
  fov: 22,
  zoomFov: 15,
  panLimit: 36,
  lookLimit: 48,
} as const;

/** Where a camera wants to be for a shot. Pure. */
export function cameraFor(shot: CameraShot): CameraRig {
  switch (shot.kind) {
    case 'goal': {
      const goalX = goalLineX(shot.side);
      const t = clamp(shot.intensity, 0, 1);
      const toward = Math.sign(goalX);
      return {
        position: {
          x: round(goalX * (0.5 + 0.1 * t) - toward * 4),
          y: round(FOLLOW.height - 12 * t),
          z: round(FOLLOW.distance - 22 * t),
        },
        target: { x: round(goalX * 0.92), y: round(1.4 - 0.4 * t), z: 0 },
        fov: round(FOLLOW.fov - (FOLLOW.fov - 20) * t),
      };
    }
    case 'aerial':
      return {
        position: {
          x: round(Math.cos(shot.angle) * 96),
          y: 46,
          z: round(Math.sin(shot.angle) * 82),
        },
        target: { x: 0, y: 2, z: 0 },
        fov: 34,
      };
    case 'hero':
      return {
        position: {
          x: round(shot.focus.x + Math.cos(shot.angle) * 11.5),
          y: 2.3,
          z: round(shot.focus.z + Math.sin(shot.angle) * 11.5),
        },
        target: { x: shot.focus.x, y: 1.25, z: shot.focus.z },
        fov: 27,
      };
    case 'replay': {
      const goalX = goalLineX(shot.side);
      const toward = Math.sign(goalX);
      return {
        position: {
          x: round(goalX + toward * 13),
          y: 5.4,
          z: round(clamp(shot.focus.z * 0.35, -9, 9) + 5.5),
        },
        target: {
          x: round(goalX - toward * 7),
          y: 1.3,
          z: round(clamp(shot.focus.z * 0.6, -14, 14)),
        },
        fov: 27,
      };
    }
    case 'close':
      return {
        position: {
          x: round(clamp(shot.focus.x * 0.82, -44, 44)),
          y: 6.5,
          z: round(shot.focus.z + 21),
        },
        target: { x: shot.focus.x, y: 1.2, z: shot.focus.z },
        fov: 19,
      };
    case 'follow': {
      const zoom = clamp(shot.zoom, 0, 1);
      const panX = clamp(
        shot.focus.x * 0.58,
        -FOLLOW.panLimit,
        FOLLOW.panLimit,
      );
      const lookX = clamp(
        shot.focus.x * 0.88,
        -FOLLOW.lookLimit,
        FOLLOW.lookLimit,
      );
      return {
        position: {
          x: round(panX),
          y: round(FOLLOW.height - 5 * zoom),
          z: round(FOLLOW.distance - 9 * zoom),
        },
        target: {
          x: round(lookX),
          y: 0,
          z: round(clamp(shot.focus.z * 0.42, -16, 16)),
        },
        fov: round(FOLLOW.fov - (FOLLOW.fov - FOLLOW.zoomFov) * zoom),
      };
    }
  }
}

/** Shots of the same family glide into each other; others are hard cuts. */
export function isCut(
  from: CameraShot['kind'],
  to: CameraShot['kind'],
): boolean {
  if (from === to) return false;
  const gantry = (kind: CameraShot['kind']) =>
    kind === 'follow' || kind === 'goal';
  return !(gantry(from) && gantry(to));
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
  halfLifeMs = 380,
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
