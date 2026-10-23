import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  apiErrorSchema,
  commandSchema,
  createCareerCommandSchema,
  fakeAuthIdentitySchema,
  homeReadModelSchema,
  jobSseEventSchema,
  jobStatusSchema,
  postMatchReadModelSchema,
  sessionSchema,
  setLineupCommandSchema,
  snapshotMetadataSchema,
  standingsReadModelSchema,
  type SnapshotMetadata,
} from './index.js';

const envelope = {
  version: 1,
  commandId: 'cmd_create_1',
  idempotencyKey: 'career:create:1',
  expectedVersion: 0,
} as const;
const instant = '2026-07-21T12:00:00.000Z';
const club = { id: 'club_bahia', name: 'Bahia', shortName: 'BAH' };

function roundTrip<T>(schema: { parse(value: unknown): T }, value: unknown): T {
  const parsed = schema.parse(value);
  return schema.parse(JSON.parse(JSON.stringify(parsed)) as unknown);
}

describe('auth and command contracts', () => {
  it('accepts fake auth/session fixtures and survives JSON roundtrip', () => {
    const identity = {
      version: 1,
      userId: 'user_demo',
      email: 'demo@footebas.test',
      displayName: 'Demo',
    };
    expect(fakeAuthIdentitySchema.safeParse(identity).success).toBe(true);
    expect(
      roundTrip(sessionSchema, {
        version: 1,
        sessionId: 'session_demo',
        identity,
        issuedAt: instant,
        expiresAt: '2026-07-22T12:00:00.000Z',
      }),
    ).toEqual(expect.objectContaining({ sessionId: 'session_demo' }));
  });

  it('parses every command discriminator compatibly', () => {
    const commands = [
      {
        ...envelope,
        type: 'CreateCareer',
        payload: { managerName: 'Márcio', startDate: '2026-01-01' },
      },
      {
        ...envelope,
        type: 'SelectClub',
        payload: { careerId: 'career_1', clubId: 'club_bahia' },
      },
      {
        ...envelope,
        type: 'SetTactics',
        payload: {
          careerId: 'career_1',
          formation: '4-3-3',
          mentality: 'balanced',
          attackDirection: 'wings',
          marking: 'heavy',
        },
      },
      {
        ...envelope,
        type: 'SetLineup',
        payload: {
          careerId: 'career_1',
          clubId: 'club_bahia',
          starters: Array.from({ length: 11 }, (_, index) => ({
            playerId: `player_${String(index + 1)}`,
            position: index === 0 ? 'GK' : 'CM',
          })),
          substitutes: ['player_12', 'player_13'],
          captainId: 'player_2',
        },
      },
      {
        ...envelope,
        type: 'AdvanceDate',
        payload: { careerId: 'career_1', throughDate: '2026-01-08' },
      },
      {
        ...envelope,
        type: 'SimulateMatch',
        payload: { careerId: 'career_1', fixtureId: 'fixture_1' },
      },
    ];
    for (const command of commands) {
      expect(commandSchema.safeParse(command).success).toBe(true);
      expect(roundTrip(commandSchema, command)).toEqual(command);
    }
  });

  it('rejects unknown keys, bad bounds and incomplete lineups', () => {
    expect(
      createCareerCommandSchema.safeParse({
        ...envelope,
        type: 'CreateCareer',
        payload: { managerName: '', startDate: 'tomorrow' },
        surprise: true,
      }).success,
    ).toBe(false);
    expect(
      setLineupCommandSchema.safeParse({
        ...envelope,
        type: 'SetLineup',
        payload: {
          careerId: 'career_1',
          clubId: 'club_1',
          starters: [],
          substitutes: [],
          captainId: 'player_1',
        },
      }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        ...envelope,
        expectedVersion: -1,
        type: 'AdvanceDate',
        payload: { careerId: '../bad' },
      }).success,
    ).toBe(false);
  });
});

describe('errors, jobs and SSE', () => {
  it('accepts discriminated errors and rejects mismatched shapes', () => {
    expect(
      apiErrorSchema.safeParse({
        version: 1,
        requestId: 'request_1',
        code: 'VERSION_CONFLICT',
        message: 'stale',
        expectedVersion: 2,
        actualVersion: 3,
      }).success,
    ).toBe(true);
    expect(
      apiErrorSchema.safeParse({
        version: 1,
        requestId: 'request_1',
        code: 'NOT_FOUND',
        message: 'missing',
      }).success,
    ).toBe(false);
  });

  it('validates job progress and SSE event roundtrips', () => {
    const status = {
      version: 1,
      jobId: 'job_1',
      commandId: 'cmd_1',
      careerId: 'career_1',
      state: 'running',
      progress: { current: 1, total: 4, percent: 25, stage: 'simulate' },
      attempt: 1,
      createdAt: instant,
      updatedAt: instant,
    };
    expect(jobStatusSchema.safeParse(status).success).toBe(true);
    expect(
      jobStatusSchema.safeParse({
        ...status,
        progress: { ...status.progress, current: 5 },
      }).success,
    ).toBe(false);
    const event = {
      version: 1,
      eventId: 'event_1',
      jobId: 'job_1',
      occurredAt: instant,
      type: 'job.status',
      data: status,
    };
    expect(roundTrip(jobSseEventSchema, event)).toEqual(event);
  });
});

describe('read models and snapshots', () => {
  const base = {
    version: 1,
    careerId: 'career_1',
    aggregateVersion: 7,
    projectedAt: instant,
  };

  it('accepts minimum home, standings and post-match fixtures', () => {
    expect(
      homeReadModelSchema.safeParse({
        ...base,
        managerName: 'Demo',
        careerName: 'Carreira de Demo',
        coach: {
          nationality: 'BR',
          avatar: 'avatar-01',
          personality: 'estrategista',
        },
        inbox: [],
        club,
        currentDate: '2026-01-08',
        season: 1,
        balance: 100_00,
        nextFixtureId: 'fixture_1',
        pendingActions: [],
      }).success,
    ).toBe(true);
    expect(
      standingsReadModelSchema.safeParse({
        ...base,
        competitionId: 'competition_1',
        competition: 'Liga',
        rows: [1, 2].map((position) => ({
          position,
          club: { ...club, id: `club_${String(position)}` },
          played: 1,
          won: position === 1 ? 1 : 0,
          drawn: 0,
          lost: position === 2 ? 1 : 0,
          goalsFor: position === 1 ? 2 : 0,
          goalsAgainst: position === 1 ? 0 : 2,
          goalDifference: position === 1 ? 2 : -2,
          points: position === 1 ? 3 : 0,
        })),
      }).success,
    ).toBe(true);
    const postMatch = {
      ...base,
      matchId: 'match_1',
      fixtureId: 'fixture_1',
      homeClub: club,
      awayClub: {
        ...club,
        id: 'club_vitoria',
        name: 'Vitória',
        shortName: 'VIT',
      },
      score: { home: 1, away: 0 },
      timeline: [
        { type: 'goal', minute: 42, side: 'home', playerId: 'player_1' },
      ],
      tableUpdated: true,
      playback: {
        modes: ['instant', 'fast', 'feed'],
        speeds: [0.5, 1, 2, 4, 8],
        canSkip: true,
      },
    };
    expect(roundTrip(postMatchReadModelSchema, postMatch)).toEqual(postMatch);

    // match-v4 chances carry shooter, assistant, play and outcome (ADR 0015).
    const rich = {
      ...postMatch,
      timeline: [
        {
          type: 'chance',
          minute: 12,
          side: 'away',
          xg: 0.18,
          playerId: 'player_9',
          assistId: 'player_10',
          play: 'counter',
          outcome: 'woodwork',
        },
        {
          type: 'goal',
          minute: 42,
          side: 'home',
          playerId: 'player_1',
          assistId: 'player_7',
          play: 'cross',
        },
      ],
    };
    expect(roundTrip(postMatchReadModelSchema, rich)).toEqual(rich);
    // Results recorded before match-v4 have bare chances and stay valid.
    expect(
      postMatchReadModelSchema.safeParse({
        ...postMatch,
        timeline: [{ type: 'chance', minute: 30, side: 'home', xg: 0.07 }],
      }).success,
    ).toBe(true);
    expect(
      postMatchReadModelSchema.safeParse({
        ...rich,
        timeline: [{ ...rich.timeline[0], play: 'free_kick' }],
      }).success,
    ).toBe(false);
    // 0.5× joined the speeds; the older list without it still parses, any
    // other speed set does not.
    expect(
      postMatchReadModelSchema.safeParse({
        ...postMatch,
        playback: { ...postMatch.playback, speeds: [1, 2, 4, 8] },
      }).success,
    ).toBe(true);
    for (const speeds of [
      [0.25, 1, 2, 4, 8],
      [0.5, 1, 2, 4],
      [1, 0.5, 2, 4, 8],
    ])
      expect(
        postMatchReadModelSchema.safeParse({
          ...postMatch,
          playback: { ...postMatch.playback, speeds },
        }).success,
      ).toBe(false);
  });

  it('requires complete snapshot version provenance and checksum', () => {
    const snapshot = {
      version: 1,
      snapshotId: 'snapshot_1',
      careerId: 'career_1',
      aggregateVersion: 7,
      gameDate: '2026-01-08',
      seed: 'season-1',
      versions: {
        schema: '1',
        engine: '1.0.0',
        rules: '1',
        content: '2026-01',
        prng: 'xoshiro-v1',
      },
      checksum: `sha256:${'a'.repeat(64)}`,
      createdAt: instant,
    };
    const parsed = roundTrip(snapshotMetadataSchema, snapshot);
    expect(parsed).toEqual(snapshot);
    expectTypeOf(parsed).toEqualTypeOf<SnapshotMetadata>();
    expect(
      snapshotMetadataSchema.safeParse({ ...snapshot, checksum: 'abc' })
        .success,
    ).toBe(false);
    expect(
      snapshotMetadataSchema.safeParse({
        ...snapshot,
        versions: { schema: '1' },
      }).success,
    ).toBe(false);
  });
});
