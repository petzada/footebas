import { describe, expect, it } from 'vitest';
import { createMatchReplayFrame } from '@/lib/match-replay-model';
import {
  PHASES,
  PITCH,
  buildChoreography,
  playerKey,
  sampleStage,
  sampleStageNormalized,
  stepForMinute,
} from './choreography';
import {
  SEGMENT_MS,
  advanceController,
  pixelScaleFor,
  syncController,
  type StageController,
} from './match-scene';
import { stageTheme } from './theme';
import { deepFreeze, stageMatch } from './test-fixture';

const keyframes = [0, 0.15, PHASES.open, PHASES.build, PHASES.action, 1];

function controllerFor(minute = 0): StageController {
  const choreography = buildChoreography(stageMatch());
  return {
    choreography,
    colors: { home: '#f7c948', away: '#1f4f9a' },
    step: stepForMinute(choreography, minute),
    progress: 1,
    paused: false,
    speed: 1,
  };
}

describe('match stage choreography', () => {
  it('is deterministic: same match, same keyframes', () => {
    const first = buildChoreography(stageMatch());
    const second = buildChoreography(stageMatch());
    expect(second).toEqual(first);
    for (let step = 0; step < first.segments.length; step += 1)
      for (const progress of keyframes)
        expect(sampleStage(second, step, progress)).toEqual(
          sampleStage(first, step, progress),
        );
  });

  it('derives a different choreography from a different match id', () => {
    const a = sampleStage(buildChoreography(stageMatch()), 1, PHASES.open);
    const b = sampleStage(
      buildChoreography(stageMatch({ matchId: 'other-match' })),
      1,
      PHASES.open,
    );
    expect(b.players).not.toEqual(a.players);
  });

  it('stops at kickoff, every event minute and full time', () => {
    const match = stageMatch();
    const choreography = buildChoreography(match);
    expect(choreography.minutes).toEqual([0, 9, 24, 41, 64, 70, 81, 88, 90]);
    for (const event of match.timeline) {
      const segment =
        choreography.segments[stepForMinute(choreography, event.minute)]!;
      expect(segment.minute).toBe(event.minute);
      expect(segment.events).toContain(event);
    }
    expect(stepForMinute(choreography, 30)).toBe(2);
  });

  it('ends every goal with the ball in the net on the scoring side', () => {
    const choreography = buildChoreography(stageMatch());
    const home = sampleStage(choreography, stepForMinute(choreography, 24), 1);
    expect(home.ball.x).toBeGreaterThan(PITCH.right);
    expect(home.ball.y).toBeGreaterThan(PITCH.goalTop);
    expect(home.ball.y).toBeLessThan(PITCH.goalBottom);
    expect(home.overlay).toMatchObject({ kind: 'goal', side: 'home' });
    expect(home.celebration).toBe(1);

    const away = sampleStage(choreography, stepForMinute(choreography, 70), 1);
    expect(away.ball.x).toBeLessThan(PITCH.left);
    expect(away.ball.y).toBeGreaterThan(PITCH.goalTop);
    expect(away.ball.y).toBeLessThan(PITCH.goalBottom);
    expect(away.overlay).toMatchObject({ kind: 'goal', side: 'away' });
  });

  it('shows the shot trajectory while the ball is in flight', () => {
    const choreography = buildChoreography(stageMatch());
    const step = stepForMinute(choreography, 9);
    const flying = sampleStage(choreography, step, 0.65);
    expect(flying.shotFrom).not.toBeNull();
    expect(sampleStage(choreography, step, 0.2).shotFrom).toBeNull();
    expect(sampleStage(choreography, step, 1).overlay).toMatchObject({
      kind: 'chance',
      side: 'home',
    });
  });

  it('raises the card over the booked player only after the foul', () => {
    const choreography = buildChoreography(stageMatch());
    const step = stepForMinute(choreography, 41);
    expect(sampleStage(choreography, step, PHASES.build).overlay).toBeNull();
    const rest = sampleStage(choreography, step, 1);
    expect(rest.overlay).toEqual({
      kind: 'card',
      side: 'away',
      card: 'yellow',
      playerKey: playerKey('away', 3),
    });
    expect(rest.players.find((p) => p.key === 'away-3')?.number).toBe(4);
  });

  it('swaps the shirt number and shows the substitution plate', () => {
    const choreography = buildChoreography(stageMatch());
    const step = stepForMinute(choreography, 64);
    const before = sampleStage(choreography, step, 0.5);
    const after = sampleStage(choreography, step, 1);
    expect(before.players.find((p) => p.key === 'home-10')?.number).toBe(11);
    expect(after.players.find((p) => p.key === 'home-10')?.number).toBe(12);
    expect(after.overlay).toEqual({
      kind: 'substitution',
      side: 'home',
      playerKey: 'home-10',
      inNumber: 12,
      outNumber: 11,
    });
  });

  it('walks a sent-off player off the pitch for good', () => {
    const choreography = buildChoreography(stageMatch());
    const step = stepForMinute(choreography, 81);
    const during = sampleStage(choreography, step, 0.9);
    expect(during.players.find((p) => p.key === 'home-2')?.visible).toBe(true);
    expect(
      sampleStage(choreography, step, 1).players.find((p) => p.key === 'home-2')
        ?.visible,
    ).toBe(false);
    expect(
      sampleStage(choreography, step + 1, 0.5).players.find(
        (p) => p.key === 'home-2',
      )?.visible,
    ).toBe(false);
  });

  it('keeps 22 players and the ball inside the canvas', () => {
    const choreography = buildChoreography(stageMatch());
    for (let step = 0; step < choreography.segments.length; step += 1)
      for (const progress of keyframes) {
        const frame = sampleStage(choreography, step, progress);
        expect(frame.players).toHaveLength(22);
        for (const thing of [frame.ball, ...frame.players]) {
          expect(thing.x).toBeGreaterThanOrEqual(0);
          expect(thing.x).toBeLessThanOrEqual(PITCH.width);
          expect(thing.y).toBeGreaterThanOrEqual(0);
          expect(thing.y).toBeLessThanOrEqual(PITCH.height);
        }
      }
  });

  it('exposes the same trajectories normalised to 0..1 for other renderers', () => {
    const choreography = buildChoreography(stageMatch());
    const step = stepForMinute(choreography, 24);
    const raw = sampleStage(choreography, step, 1);
    const normalized = sampleStageNormalized(choreography, step, 1);
    expect(normalized.ball.u).toBeCloseTo(raw.ball.x / PITCH.width, 3);
    expect(normalized.ball.v).toBeCloseTo(raw.ball.y / PITCH.height, 3);
    expect(normalized.ball.u).toBeGreaterThan(PITCH.right / PITCH.width);
    expect(normalized.players).toHaveLength(22);
    for (const player of normalized.players) {
      expect(player.u).toBeGreaterThanOrEqual(0);
      expect(player.u).toBeLessThanOrEqual(1);
      expect(player.v).toBeGreaterThanOrEqual(0);
      expect(player.v).toBeLessThanOrEqual(1);
    }
    expect(sampleStageNormalized(choreography, step, 1)).toEqual(normalized);
  });

  it('never touches the official result', () => {
    const match = deepFreeze(stageMatch());
    const snapshot = JSON.parse(JSON.stringify(match));
    const choreography = buildChoreography(match);
    for (let step = 0; step < choreography.segments.length; step += 1)
      sampleStage(choreography, step, 0.5);
    expect(JSON.parse(JSON.stringify(match))).toEqual(snapshot);
    expect(createMatchReplayFrame(match, 90).score).toEqual({
      home: 1,
      away: 1,
    });
  });
});

describe('stage controller', () => {
  it('advances by real time scaled by speed and stops at rest', () => {
    const controller = controllerFor();
    controller.progress = 0;
    for (let frame = 0; frame < 5; frame += 1)
      advanceController(controller, SEGMENT_MS / 20);
    expect(controller.progress).toBeCloseTo(0.25);
    controller.speed = 4;
    advanceController(controller, 50);
    expect(controller.progress).toBeCloseTo(0.45);
    for (let frame = 0; frame < 20; frame += 1)
      advanceController(controller, 100);
    expect(controller.progress).toBe(1);
    expect(advanceController(controller, 16)).toBe(false);
  });

  it('freezes while paused', () => {
    const controller = controllerFor();
    controller.progress = 0.3;
    controller.paused = true;
    expect(advanceController(controller, 500)).toBe(false);
    expect(controller.progress).toBe(0.3);
  });

  it('animates the natural next step and snaps skips to the result', () => {
    const controller = controllerFor();
    syncController(controller, { minute: 9, playing: true, speed: 2 });
    expect(controller).toMatchObject({ step: 1, progress: 0, speed: 2 });

    syncController(controller, { minute: 90, playing: false, speed: 2 });
    expect(controller).toMatchObject({ step: 8, progress: 1, paused: false });

    const paused = controllerFor(24);
    syncController(paused, { minute: 24, playing: false, speed: 1 });
    expect(paused.paused).toBe(true);
  });

  it('caps the device pixel ratio at 2', () => {
    expect(pixelScaleFor(360, 3, stageTheme)).toBe(2);
    expect(pixelScaleFor(360, 1, stageTheme)).toBe(1);
    expect(pixelScaleFor(2000, 3, stageTheme)).toBe(4);
    expect(pixelScaleFor(0, 1, stageTheme)).toBe(1);
  });
});
