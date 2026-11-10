import { describe, expect, it } from 'vitest';
import { createMatchReplayFrame } from '@/lib/match-replay-model';
import {
  PHASES,
  PITCH,
  anchorsForCodes,
  buildChoreography,
  playerKey,
  sampleStage,
  sampleStageNormalized,
  stepForMinute,
} from './choreography';
import { matchKits } from '@/lib/club-kits';
import { PLAY_MS } from '@/lib/match-pace';
import {
  advanceController,
  segmentDurationMs,
  syncController,
  type StageController,
} from './controller';
import { GOAL_CUT, actionClock, directionAt } from './direction';
import { deepFreeze, stageMatch } from './test-fixture';

const keyframes = [0, 0.15, PHASES.open, PHASES.build, PHASES.action, 1];

function controllerFor(minute = 0): StageController {
  const choreography = buildChoreography(stageMatch());
  return {
    choreography,
    kits: matchKits({ id: 'cfc' }, { id: 'fba' }),
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

describe('formations and plays', () => {
  it('lines the teams up by position, mirrored for the visitors', () => {
    const anchors = anchorsForCodes([
      'GK',
      'RB',
      'CB',
      'CB',
      'LB',
      'CM',
      'CM',
      'RW',
      'LW',
      'ST',
      'ST',
    ]);
    expect(anchors).toHaveLength(11);
    expect(anchors[0]).toEqual({ x: 7, y: 32 });
    // Two centre-backs and two strikers split around the axis of the pitch.
    expect(anchors[2]!.y + anchors[3]!.y).toBe(64);
    expect(anchors[9]!.y + anchors[10]!.y).toBe(64);
    // The right-back is on the other side of the left-back.
    expect(anchors[1]!.y).toBeGreaterThan(32);
    expect(anchors[4]!.y).toBeLessThan(32);

    const kickoff = sampleStage(buildChoreography(stageMatch()), 0, 1);
    const home = kickoff.players.find((p) => p.key === 'home-1')!;
    const away = kickoff.players.find((p) => p.key === 'away-1')!;
    expect(away.x).toBeCloseTo(PITCH.width - home.x, 1);
    expect(away.y).toBeCloseTo(PITCH.height - home.y, 1);
  });

  it('puts the keeper in goal whatever order the source lists the squad in', () => {
    const base = stageMatch();
    const shuffled = stageMatch({
      home: {
        ...base.home,
        players: base.home.players.map((player, index) => ({
          ...player,
          position: index === 4 ? 'GK' : index === 0 ? 'ST' : 'CM',
        })),
      },
    });
    const frame = sampleStage(buildChoreography(shuffled), 0, 1);
    const keeper = frame.players.find((p) => p.key === 'home-0')!;
    expect(keeper.number).toBe(5);
    expect(keeper.x).toBeLessThan(12);
  });

  it('reshapes a side when the manager changes the formation', () => {
    const choreography = buildChoreography(
      stageMatch({
        timeline: [
          {
            type: 'tactical_change',
            minute: 30,
            side: 'home',
            formation: '3-5-2',
            mentality: 'attacking',
          },
        ],
      }),
    );
    const before = choreography.segments[0]!.anchors.home;
    const after = choreography.segments[1]!.anchors.home;
    expect(after).not.toEqual(before);
    expect(after[0]).toEqual(before[0]);
    expect(choreography.segments[1]!.anchors.away).toEqual(
      choreography.segments[0]!.anchors.away,
    );
  });

  it('stages each kind of play and ending the engine reports', () => {
    const match = stageMatch({
      timeline: [
        {
          type: 'chance',
          minute: 10,
          side: 'home',
          xg: 0.2,
          playerId: 'cfc-9',
          assistId: 'cfc-7',
          play: 'cross',
          outcome: 'saved',
        },
        {
          type: 'chance',
          minute: 20,
          side: 'away',
          xg: 0.1,
          playerId: 'fba-10',
          play: 'long_shot',
          outcome: 'woodwork',
        },
        {
          type: 'chance',
          minute: 30,
          side: 'home',
          xg: 0.3,
          playerId: 'cfc-11',
          play: 'individual',
          outcome: 'blocked',
        },
      ],
    });
    const choreography = buildChoreography(match);
    const [, cross, post, blocked] = choreography.segments;

    // The named athletes take the shot and the last pass.
    expect(cross!.involvedKey).toBe('home-8');
    expect(cross!.play).toBe('cross');
    expect(cross!.overlay).toMatchObject({ kind: 'chance', outcome: 'saved' });
    expect(cross!.actions.map((action) => action.kind)).toEqual(
      expect.arrayContaining(['pass', 'header', 'dive']),
    );
    expect(
      cross!.actions.find((action) => action.kind === 'header')?.playerKey,
    ).toBe('home-8');
    // A cross is lofted from the wing: the ball leaves the grass.
    expect(sampleStage(choreography, 1, 0.55).ball.height).toBeGreaterThan(0.3);

    // Off the post: the ball meets the frame of the goal and comes back out.
    expect(post!.overlay).toMatchObject({ kind: 'chance', outcome: 'post' });
    const hit = sampleStage(choreography, 2, PHASES.action);
    expect([PITCH.goalTop, PITCH.goalBottom]).toContain(hit.ball.y);
    expect(Math.abs(hit.ball.x - PITCH.left)).toBeLessThan(1);
    expect(sampleStage(choreography, 2, 1).ball.x).toBeGreaterThan(
      PITCH.left + 4,
    );

    // Blocked: it never reaches the goal line.
    expect(blocked!.overlay).toMatchObject({ outcome: 'blocked' });
    expect(sampleStage(choreography, 3, 1).ball.x).toBeLessThan(PITCH.right);
    expect(
      blocked!.actions.some(
        (action) =>
          action.kind === 'tackle' && action.playerKey.startsWith('away'),
      ),
    ).toBe(true);
  });

  it('gives every highlight a length and celebrates goals', () => {
    const choreography = buildChoreography(stageMatch());
    const goal = choreography.segments[stepForMinute(choreography, 24)]!;
    const card = choreography.segments[stepForMinute(choreography, 41)]!;
    expect(goal.durationMs).toBe(PLAY_MS.goal);
    expect(card.durationMs).toBe(PLAY_MS.card);
    expect(
      goal.actions.filter((action) => action.kind === 'celebrate').length,
    ).toBeGreaterThan(1);
    expect(
      card.actions.some(
        (action) => action.kind === 'fall' && action.until !== undefined,
      ),
    ).toBe(true);
  });
});

describe('broadcast direction', () => {
  it('plays ordinary highlights straight through', () => {
    const choreography = buildChoreography(stageMatch());
    const chance = choreography.segments[stepForMinute(choreography, 9)];
    expect(directionAt(chance, 0.4)).toEqual({ p: 0.4, mode: 'live' });
    expect(directionAt(chance, 1)).toEqual({ p: 1, mode: 'rest' });
    expect(actionClock(chance)).toBe(PHASES.action);
  });

  it('shows a goal live, celebrates it and replays it in slow motion', () => {
    const choreography = buildChoreography(stageMatch());
    const goal = choreography.segments[stepForMinute(choreography, 24)];
    expect(directionAt(goal, 0).mode).toBe('live');
    // Live reaches past the ball in the net before the cut.
    expect(directionAt(goal, GOAL_CUT.live - 0.001).p).toBeGreaterThan(
      PHASES.action,
    );
    expect(directionAt(goal, 0.6).mode).toBe('celebration');
    const replayStart = directionAt(goal, GOAL_CUT.celebration);
    const replayEnd = directionAt(goal, GOAL_CUT.replay - 0.001);
    expect(replayStart).toEqual({ p: GOAL_CUT.replayFrom, mode: 'replay' });
    // The replay rewinds to before the shot and runs through the goal again.
    expect(replayStart.p).toBeLessThan(PHASES.build);
    expect(replayEnd.p).toBeGreaterThan(PHASES.action);
    expect(directionAt(goal, 1)).toEqual({ p: 1, mode: 'rest' });
    // The ball hits the net before the live part ends.
    expect(actionClock(goal)).toBeLessThan(GOAL_CUT.live);
  });
});

describe('stage controller', () => {
  it('advances by real time scaled by speed and stops at rest', () => {
    const controller = controllerFor(9);
    const duration = segmentDurationMs(
      controller.choreography,
      controller.step,
    );
    expect(duration).toBe(PLAY_MS.chance);
    controller.progress = 0;
    // Frames longer than 100 ms are clamped (a resumed tab never jumps).
    for (let frame = 0; frame < 50; frame += 1)
      advanceController(controller, duration / 200);
    expect(controller.progress).toBeCloseTo(0.25);
    controller.speed = 4;
    advanceController(controller, duration / 80);
    expect(controller.progress).toBeCloseTo(0.3);
    for (let frame = 0; frame < 200; frame += 1)
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
});
