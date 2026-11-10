/**
 * Procedural body animation for the 3D athletes: joint angles as pure
 * functions of time, so the same clock always yields the same pose (replays
 * rewind cleanly). No skeleton files, no mocap: everything is generated here.
 *
 * Conventions (radians): hips and shoulders swing forward when positive,
 * knees and elbows bend when positive, `armOut` lifts the arm sideways,
 * `lean` tips the torso forward, `pitch` tips the whole body forward
 * (negative = on the back), `roll` tips it sideways, `drop` (0..1) lowers the
 * hips to the grass and `jump` lifts them (metres).
 */

export interface Pose {
  lean: number;
  twist: number;
  pitch: number;
  roll: number;
  drop: number;
  jump: number;
  headPitch: number;
  hipL: number;
  hipR: number;
  kneeL: number;
  kneeR: number;
  shoulderL: number;
  shoulderR: number;
  armOutL: number;
  armOutR: number;
  elbowL: number;
  elbowR: number;
}

export const POSE_KEYS = [
  'lean',
  'twist',
  'pitch',
  'roll',
  'drop',
  'jump',
  'headPitch',
  'hipL',
  'hipR',
  'kneeL',
  'kneeR',
  'shoulderL',
  'shoulderR',
  'armOutL',
  'armOutR',
  'elbowL',
  'elbowR',
] as const satisfies readonly (keyof Pose)[];

export function emptyPose(): Pose {
  return {
    lean: 0,
    twist: 0,
    pitch: 0,
    roll: 0,
    drop: 0,
    jump: 0,
    headPitch: 0,
    hipL: 0,
    hipR: 0,
    kneeL: 0,
    kneeR: 0,
    shoulderL: 0,
    shoulderR: 0,
    armOutL: 0,
    armOutR: 0,
    elbowL: 0,
    elbowR: 0,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smooth(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function reset(out: Pose): Pose {
  for (const key of POSE_KEYS) out[key] = 0;
  return out;
}

/** `out = from + (to - from) * weight`, joint by joint. */
export function mixPose(out: Pose, from: Pose, to: Pose, weight: number): Pose {
  const w = clamp01(weight);
  for (const key of POSE_KEYS) out[key] = from[key] + (to[key] - from[key]) * w;
  return out;
}

/**
 * Standing, jogging and sprinting in one cycle. `phase` advances with the
 * distance covered (radians, 2π per stride pair), `effort` is 0 standing to
 * 1 at full sprint, `time` (seconds) only feeds the idle breathing.
 */
export function locomotionPose(
  out: Pose,
  phase: number,
  effort: number,
  time: number,
): Pose {
  reset(out);
  const s = clamp01(effort);
  const swing = 0.1 * Math.min(1, s * 8) + 0.78 * s;
  const left = phase;
  const right = phase + Math.PI;
  out.hipL = swing * Math.sin(left);
  out.hipR = swing * Math.sin(right);
  const bend = 0.22 + 1.2 * s;
  out.kneeL = 0.1 + bend * Math.max(0, Math.cos(left)) * Math.min(1, s * 6);
  out.kneeR = 0.1 + bend * Math.max(0, Math.cos(right)) * Math.min(1, s * 6);
  const breath = Math.sin(time * 1.7) * 0.03 * (1 - s);
  out.shoulderL = -0.85 * swing * Math.sin(left) + breath;
  out.shoulderR = -0.85 * swing * Math.sin(right) + breath;
  out.elbowL = 0.22 + 1.05 * s;
  out.elbowR = 0.22 + 1.05 * s;
  out.armOutL = 0.14;
  out.armOutR = 0.14;
  out.lean = 0.04 + 0.2 * s;
  out.twist = 0.14 * s * Math.sin(phase);
  return out;
}

export type ActionKind =
  | 'pass'
  | 'shot'
  | 'header'
  | 'dive'
  | 'tackle'
  | 'fall'
  | 'celebrate'
  | 'despair';

/** Seconds a one-off movement takes; held ones ease in over this time. */
export const ACTION_SECONDS: Readonly<Record<ActionKind, number>> = {
  pass: 0.55,
  shot: 0.8,
  header: 0.75,
  dive: 0.7,
  tackle: 0.9,
  fall: 0.5,
  celebrate: 0.4,
  despair: 0.45,
};

/** Fraction of a one-off movement at which the foot (or head) meets the ball. */
export const ACTION_CONTACT: Readonly<Record<ActionKind, number>> = {
  pass: 0.5,
  shot: 0.5,
  header: 0.55,
  dive: 0,
  tackle: 0.3,
  fall: 0,
  celebrate: 0,
  despair: 0,
};

/**
 * Pose of a movement at `t` (0..1 through it; held movements stay at 1) and
 * `time` in seconds for the looping ones. `side` is -1/1: which way a keeper
 * dives, in the athlete's own frame (1 = to his left).
 */
export function actionPose(
  out: Pose,
  kind: ActionKind,
  t: number,
  time: number,
  side = 1,
): Pose {
  reset(out);
  const c = clamp01(t);
  switch (kind) {
    case 'pass':
    case 'shot': {
      const power = kind === 'shot' ? 1 : 0.62;
      const wind = smooth(c / 0.4);
      const strike = smooth((c - 0.4) / 0.16);
      const follow = smooth((c - 0.56) / 0.44);
      out.hipR = power * (-0.9 * wind + 2.05 * strike - 1.0 * follow);
      out.kneeR = power * (1.35 * wind - 1.25 * strike + 0.25 * follow);
      out.hipL = 0.12;
      out.kneeL = 0.24;
      out.lean = 0.12 - 0.22 * strike * power;
      out.shoulderL = 0.7 * strike * power;
      out.shoulderR = -0.6 * wind * power;
      out.armOutL = 0.25 + 0.6 * wind * power;
      out.armOutR = 0.3;
      out.elbowL = 0.5;
      out.elbowR = 0.5;
      out.twist = power * (0.35 * wind - 0.6 * strike + 0.25 * follow);
      return out;
    }
    case 'header': {
      const up = Math.sin(Math.PI * c);
      out.jump = 0.62 * up;
      out.lean =
        c < 0.5
          ? -0.32 * smooth(c / 0.5)
          : -0.32 + 0.8 * smooth((c - 0.5) / 0.22);
      out.headPitch = out.lean * 0.5;
      out.armOutL = 0.75 * up;
      out.armOutR = 0.75 * up;
      out.elbowL = 0.7;
      out.elbowR = 0.7;
      out.kneeL = 0.6 * up;
      out.kneeR = 0.35 * up;
      out.hipL = 0.3 * up;
      return out;
    }
    case 'dive': {
      const e = smooth(c / 0.5);
      out.roll = -side * 1.42 * e;
      out.drop = 0.8 * smooth((c - 0.25) / 0.6);
      out.jump = 0.55 * Math.sin(Math.PI * Math.min(1, c / 0.7));
      out.shoulderL = 2.9 * e;
      out.shoulderR = 2.9 * e;
      out.armOutL = 0.2;
      out.armOutR = 0.2;
      out.kneeL = 0.25 * e;
      out.hipR = 0.2 * e;
      return out;
    }
    case 'tackle': {
      const e = smooth(c / 0.28) * (1 - smooth((c - 0.72) / 0.28));
      out.pitch = -1.02 * e;
      out.drop = 0.72 * e;
      out.hipR = 1.5 * e;
      out.hipL = 0.55 * e;
      out.kneeL = 1.7 * e;
      out.armOutL = 0.8 * e;
      out.armOutR = 0.6 * e;
      out.shoulderL = -0.5 * e;
      out.shoulderR = -0.5 * e;
      return out;
    }
    case 'fall': {
      const e = smooth(c);
      out.pitch = -1.5 * e;
      out.drop = 0.94 * e;
      out.armOutL = 1.15 * e;
      out.armOutR = 0.7 * e;
      out.kneeL = 0.75 * e;
      out.hipL = 0.55 * e;
      out.elbowR = 1.4 * e;
      out.shoulderR = 0.6 * e;
      return out;
    }
    case 'celebrate': {
      const e = smooth(c);
      const hop = Math.abs(Math.sin(time * 8.5));
      out.shoulderL = 2.85 * e;
      out.shoulderR = 2.85 * e;
      out.armOutL = 0.5 * e;
      out.armOutR = 0.5 * e;
      out.elbowL = 0.25 + 0.4 * hop * e;
      out.elbowR = 0.25 + 0.4 * hop * e;
      out.jump = 0.3 * hop * e;
      out.kneeL = 0.5 * (1 - hop) * e;
      out.kneeR = 0.5 * (1 - hop) * e;
      out.hipL = 0.2 * (1 - hop) * e;
      out.hipR = 0.2 * (1 - hop) * e;
      out.lean = -0.1 * e;
      out.headPitch = -0.2 * e;
      return out;
    }
    case 'despair': {
      const e = smooth(c);
      out.shoulderL = 2.45 * e;
      out.shoulderR = 2.45 * e;
      out.elbowL = 2.3 * e;
      out.elbowR = 2.3 * e;
      out.armOutL = 0.4 * e;
      out.armOutR = 0.4 * e;
      out.headPitch = 0.35 * e;
      out.lean = 0.12 * e;
      out.kneeL = 0.15;
      out.kneeR = 0.15;
      return out;
    }
  }
}

/** Leg segment lengths (metres, before the athlete scale). */
export const LEG = { thigh: 0.42, shin: 0.47 } as const;

/** Hip height that keeps the lowest foot on the grass for a pose. */
export function hipHeight(pose: Pose): number {
  const reach = (hip: number, knee: number) =>
    LEG.thigh * Math.cos(hip) + LEG.shin * Math.cos(hip - knee);
  const standing = Math.max(
    reach(pose.hipL, pose.kneeL),
    reach(pose.hipR, pose.kneeR),
  );
  return standing + (0.17 - standing) * clamp01(pose.drop) + pose.jump;
}
