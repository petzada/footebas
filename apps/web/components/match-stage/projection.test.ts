import { describe, expect, it } from 'vitest';
import {
  PITCH,
  buildChoreography,
  sampleStageNormalized,
  stepForMinute,
} from './choreography';
import {
  FIELD,
  cameraFor,
  cameraSettled,
  dampCamera,
  goalLineX,
  isCut,
  pitchToWorld,
  unitsToWorld,
} from './projection';
import { stageMatch } from './test-fixture';

describe('pitchToWorld', () => {
  it('maps the painted line box onto an official 105 x 68 m pitch', () => {
    const corner = (x: number, y: number) =>
      pitchToWorld({ u: x / PITCH.width, v: y / PITCH.height });
    expect(corner(PITCH.left, PITCH.top)).toEqual({ x: -52.5, y: 0, z: -34 });
    expect(corner(PITCH.right, PITCH.bottom)).toEqual({ x: 52.5, y: 0, z: 34 });
    expect(corner(50, 32)).toEqual({ x: 0, y: 0, z: 0 });
    expect(unitsToWorld(50, 32)).toEqual({ x: 0, y: 0, z: 0 });
    expect(goalLineX('home')).toBe(52.5);
    expect(goalLineX('away')).toBe(-52.5);
  });

  it('lifts the ball by its normalized height', () => {
    expect(pitchToWorld({ u: 0.5, v: 0.5 }, 1).y).toBe(FIELD.ballLift);
    expect(pitchToWorld({ u: 0.5, v: 0.5 }, 0.5).y).toBe(FIELD.ballLift / 2);
  });

  it('is deterministic over a whole choreography and stays on the grass', () => {
    const choreography = buildChoreography(stageMatch());
    const halfLength = FIELD.lineLength / 2 + FIELD.margin;
    const halfWidth = FIELD.lineWidth / 2 + FIELD.margin;
    for (let step = 0; step < choreography.segments.length; step += 1)
      for (const progress of [0, 0.3, 0.58, 0.72, 1]) {
        const frame = sampleStageNormalized(choreography, step, progress);
        const again = sampleStageNormalized(choreography, step, progress);
        for (const [index, player] of frame.players.entries()) {
          const world = pitchToWorld(player);
          expect(world).toEqual(pitchToWorld(again.players[index]!));
          expect(Math.abs(world.x)).toBeLessThanOrEqual(halfLength);
          expect(Math.abs(world.z)).toBeLessThanOrEqual(halfWidth);
        }
      }
  });

  it('puts a goal inside the net behind the line', () => {
    const choreography = buildChoreography(stageMatch());
    const frame = sampleStageNormalized(
      choreography,
      stepForMinute(choreography, 24),
      1,
    );
    const ball = pitchToWorld(frame.ball, frame.ball.height);
    expect(ball.x).toBeGreaterThan(goalLineX('home'));
    expect(ball.x).toBeLessThan(goalLineX('home') + FIELD.goalDepth);
    expect(Math.abs(ball.z)).toBeLessThan(FIELD.goalWidth / 2);
  });
});

describe('camera', () => {
  it('follows the ball along the touchline within pan limits', () => {
    const centre = cameraFor({
      kind: 'follow',
      focus: { x: 0, y: 0, z: 0 },
      zoom: 0,
    });
    expect(centre.position.x).toBe(0);
    expect(centre.position.z).toBeGreaterThan(FIELD.lineWidth / 2);
    const right = cameraFor({
      kind: 'follow',
      focus: { x: 50, y: 0, z: 10 },
      zoom: 0,
    });
    const left = cameraFor({
      kind: 'follow',
      focus: { x: -50, y: 0, z: 10 },
      zoom: 0,
    });
    expect(right.position.x).toBeGreaterThan(0);
    expect(left.position.x).toBe(-right.position.x);
    expect(right.target.x).toBeGreaterThan(right.position.x);
    // The gantry never leaves the side of the pitch, however far the ball is.
    expect(
      cameraFor({ kind: 'follow', focus: { x: 500, y: 0, z: 0 }, zoom: 0 })
        .position.x,
    ).toBeLessThan(FIELD.lineLength / 2);
  });

  it('zooms for a shot and pushes in towards the goal', () => {
    const wide = cameraFor({
      kind: 'follow',
      focus: { x: 30, y: 0, z: 0 },
      zoom: 0,
    });
    const tight = cameraFor({
      kind: 'follow',
      focus: { x: 30, y: 0, z: 0 },
      zoom: 1,
    });
    expect(tight.fov).toBeLessThan(wide.fov);
    expect(tight.position.z).toBeLessThan(wide.position.z);
    const goal = cameraFor({ kind: 'goal', side: 'home', intensity: 1 });
    expect(goal.target.x).toBeGreaterThan(40);
    expect(goal.position.y).toBeLessThan(wide.position.y);
    expect(
      cameraFor({ kind: 'goal', side: 'away', intensity: 1 }).target.x,
    ).toBe(-goal.target.x);
  });

  it('has a camera for every moment of the broadcast', () => {
    const focus = { x: 20, y: 0, z: -10 };
    const aerial = cameraFor({ kind: 'aerial', angle: 0 });
    expect(aerial.position.y).toBeGreaterThan(40);
    expect(aerial.target).toEqual({ x: 0, y: 2, z: 0 });
    // Celebration: a low camera a few metres from the athlete.
    const hero = cameraFor({ kind: 'hero', focus, angle: 0 });
    expect(hero.position.y).toBeLessThan(3);
    expect(Math.hypot(hero.position.x - 20, hero.position.z + 10)).toBeCloseTo(
      11.5,
      1,
    );
    expect(hero.target.x).toBe(20);
    // Replay: behind the goal that was scored in, looking back at the play.
    const replay = cameraFor({ kind: 'replay', side: 'home', focus });
    expect(replay.position.x).toBeGreaterThan(goalLineX('home'));
    expect(replay.target.x).toBeLessThan(goalLineX('home'));
    const close = cameraFor({ kind: 'close', focus });
    expect(close.fov).toBeLessThan(25);
    expect(close.target.x).toBe(20);
  });

  it('glides between gantry shots and cuts everywhere else', () => {
    expect(isCut('follow', 'follow')).toBe(false);
    expect(isCut('follow', 'goal')).toBe(false);
    expect(isCut('goal', 'follow')).toBe(false);
    expect(isCut('goal', 'hero')).toBe(true);
    expect(isCut('hero', 'replay')).toBe(true);
    expect(isCut('replay', 'follow')).toBe(true);
    expect(isCut('aerial', 'follow')).toBe(true);
  });

  it('damps deterministically, never overshoots and settles', () => {
    const from = cameraFor({
      kind: 'follow',
      focus: { x: -40, y: 0, z: 0 },
      zoom: 0,
    });
    const goal = cameraFor({
      kind: 'follow',
      focus: { x: 40, y: 0, z: 0 },
      zoom: 1,
    });
    let rig = from;
    let previous = from.position.x;
    for (let frame = 0; frame < 600; frame += 1) {
      rig = dampCamera(rig, goal, 16);
      expect(rig.position.x).toBeGreaterThanOrEqual(previous);
      expect(rig.position.x).toBeLessThanOrEqual(goal.position.x);
      previous = rig.position.x;
    }
    expect(cameraSettled(rig, goal)).toBe(true);
    expect(dampCamera(from, goal, 16)).toEqual(dampCamera(from, goal, 16));
  });

  it('ignores absurd deltas (tab resumed) without jumping past the goal', () => {
    const from = cameraFor({ kind: 'aerial', angle: 0 });
    const goal = cameraFor({ kind: 'aerial', angle: 1 });
    const jumped = dampCamera(from, goal, 60_000);
    expect(jumped.position.x).toBeLessThanOrEqual(
      Math.max(from.position.x, goal.position.x),
    );
    expect(jumped.position.x).toBeGreaterThanOrEqual(
      Math.min(from.position.x, goal.position.x),
    );
    expect(dampCamera(from, goal, 0)).toEqual(from);
  });
});
