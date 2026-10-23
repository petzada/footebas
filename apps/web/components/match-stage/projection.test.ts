import { describe, expect, it } from 'vitest';
import { buildChoreography, sampleStageNormalized } from './choreography';
import {
  FIELD,
  cameraFor,
  cameraSettled,
  dampCamera,
  goalLineX,
  pitchToWorld,
  renderSizeFor,
  runFrame,
} from './projection';
import { deepFreeze, stageMatch } from './test-fixture';

describe('pitchToWorld', () => {
  it('maps the painted line box onto the model (105 x 67.35 m)', () => {
    // Lines sit at 2..98 x 2..62 in the 100x64 pitch box.
    expect(pitchToWorld({ u: 0.02, v: 0.03125 })).toEqual({
      x: -52.5,
      y: 0,
      z: -33.675,
    });
    expect(pitchToWorld({ u: 0.98, v: 0.96875 })).toEqual({
      x: 52.5,
      y: 0,
      z: 33.675,
    });
    expect(pitchToWorld({ u: 0.5, v: 0.5 })).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('lifts the ball by its normalized height', () => {
    expect(pitchToWorld({ u: 0.5, v: 0.5 }, 0.5).y).toBe(FIELD.ballLift / 2);
  });

  it('is deterministic over a whole choreography and stays on the island', () => {
    const match = deepFreeze(stageMatch());
    const choreography = buildChoreography(match);
    const seen = new Map<string, string>();
    for (let step = 0; step < choreography.segments.length; step += 1) {
      for (const progress of [0, 0.3, 0.58, 0.72, 1]) {
        const frame = sampleStageNormalized(choreography, step, progress);
        const points = [frame.ball, ...frame.players].map((point) =>
          pitchToWorld(point),
        );
        for (const point of points) {
          expect(Math.abs(point.x)).toBeLessThanOrEqual(FIELD.islandLength / 2);
          expect(Math.abs(point.z)).toBeLessThanOrEqual(FIELD.islandWidth / 2);
        }
        const key = `${step}:${progress}`;
        const serialized = JSON.stringify(points);
        expect(seen.get(key) ?? serialized).toBe(serialized);
        seen.set(key, serialized);
      }
    }
    // Same input, same world positions on a second pass.
    const again = sampleStageNormalized(choreography, 3, 0.72);
    expect(
      JSON.stringify(
        [again.ball, ...again.players].map((point) => pitchToWorld(point)),
      ),
    ).toBe(seen.get('3:0.72'));
  });

  it('puts a goal inside the net behind the line', () => {
    const match = deepFreeze(stageMatch());
    const choreography = buildChoreography(match);
    const goalStep = choreography.minutes.indexOf(24);
    const rest = sampleStageNormalized(choreography, goalStep, 1);
    const ball = pitchToWorld(rest.ball);
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
    const right = cameraFor({
      kind: 'follow',
      focus: { x: 60, y: 0, z: 10 },
      zoom: 0,
    });
    expect(centre.position.x).toBe(0);
    expect(right.position.x).toBeGreaterThan(0);
    expect(right.position.x).toBeLessThanOrEqual(34);
    expect(right.target.x).toBeLessThanOrEqual(46);
    expect(right.position.y).toBe(centre.position.y);
  });

  it('zooms for a shot and pushes in towards the goal', () => {
    const calm = cameraFor({
      kind: 'follow',
      focus: { x: 0, y: 0, z: 0 },
      zoom: 0,
    });
    const shot = cameraFor({
      kind: 'follow',
      focus: { x: 0, y: 0, z: 0 },
      zoom: 1,
    });
    expect(shot.fov).toBeLessThan(calm.fov);
    const goal = cameraFor({ kind: 'goal', side: 'away', intensity: 1 });
    expect(goal.target.x).toBeLessThan(0);
    expect(goal.position.z).toBeLessThan(calm.position.z);
    expect(goal.fov).toBeLessThan(shot.fov);
  });

  it('damps deterministically, never overshoots and settles', () => {
    const from = cameraFor({
      kind: 'follow',
      focus: { x: -40, y: 0, z: 0 },
      zoom: 0,
    });
    const to = cameraFor({ kind: 'goal', side: 'home', intensity: 1 });
    const once = dampCamera(from, to, 16);
    expect(dampCamera(from, to, 16)).toEqual(once);
    expect(once.position.x).toBeGreaterThan(from.position.x);
    expect(once.position.x).toBeLessThan(to.position.x);
    let rig = from;
    for (let frame = 0; frame < 400; frame += 1) rig = dampCamera(rig, to, 16);
    expect(cameraSettled(rig, to)).toBe(true);
    expect(cameraSettled(from, to)).toBe(false);
  });

  it('ignores absurd deltas (tab resumed) without jumping past the goal', () => {
    const from = cameraFor({
      kind: 'follow',
      focus: { x: 0, y: 0, z: 0 },
      zoom: 0,
    });
    const to = cameraFor({ kind: 'goal', side: 'home', intensity: 1 });
    const rig = dampCamera(from, to, 60_000);
    expect(rig.position.x).toBeLessThanOrEqual(to.position.x);
  });
});

describe('retro helpers', () => {
  it('renders at 320–480 px wide with a 16:10 aspect', () => {
    expect(renderSizeFor(360)).toEqual({ width: 320, height: 200 });
    expect(renderSizeFor(500)).toEqual({ width: 400, height: 250 });
    expect(renderSizeFor(1200)).toEqual({ width: 480, height: 300 });
  });

  it('cycles the running frames with distance and rests when still', () => {
    expect(runFrame(0)).toBe(0);
    expect(runFrame(0.95)).toBe(1);
    expect(runFrame(1.9)).toBe(2);
    expect(runFrame(2.8)).toBe(0);
  });
});
