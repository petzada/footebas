import {
  InMemoryRankingStore,
  InMemoryUnitOfWork,
  type ValidatedAchievement,
} from '@footebas/database';
import { describe, expect, it } from 'vitest';
import { FakeBearerAuth, FakeClock } from './ports.js';
import {
  RankingService,
  seasonAchievements,
  titleAchievements,
  uniqueAchievements,
} from './rankings.js';

const achievement = (
  overrides: Partial<ValidatedAchievement> &
    Pick<ValidatedAchievement, 'careerId' | 'userId'>,
): ValidatedAchievement => ({
  displayName: 'Treinador',
  type: 'season_completed',
  season: 1,
  competitionId: 'competition_serie_a',
  clubId: 'club_one',
  clubReputation: 80,
  gameDate: '2026-12-31',
  points: 5,
  risePoints: 0,
  rulesVersion: 'ranking-v1',
  recordedAt: '2026-10-20T10:00:00.000Z',
  ...overrides,
});

async function setup(instant: string) {
  const clock = new FakeClock(new Date(instant));
  const unitOfWork = new InMemoryUnitOfWork(clock);
  const auth = new FakeBearerAuth();
  // Accounts that signed up: Caio has no career yet, Duda one with 0 points.
  unitOfWork.signUp('user_caio', '2026-10-01T00:00:00.000Z');
  unitOfWork.signUp('user_duda', '2026-10-02T00:00:00.000Z');
  await unitOfWork.withCareerLock('seed', async (tx) => {
    await tx.achievements.enroll({
      careerId: 'career_duda',
      userId: 'user_duda',
      displayName: 'Duda',
      avatar: 'avatar-08',
    });
    await tx.achievements.record([
      achievement({
        careerId: 'career_ana',
        userId: 'user_ana',
        displayName: 'Ana',
        avatar: 'avatar-05',
        type: 'promotion',
        competitionId: 'competition_serie_b',
        clubReputation: 55,
        points: 45,
        risePoints: 75,
      }),
      achievement({
        careerId: 'career_ana',
        userId: 'user_ana',
        displayName: 'Ana',
        avatar: 'avatar-05',
        type: 'state_title',
        competitionId: 'competition_estadual',
        clubReputation: 55,
        points: 25,
        risePoints: 42,
      }),
      achievement({
        careerId: 'career_bia',
        userId: 'user_bia',
        displayName: 'Bia',
        avatar: 'https://lh3.googleusercontent.com/a/bia',
        type: 'league_title',
        points: 100,
        recordedAt: '2026-09-30T22:00:00.000Z',
      }),
      achievement({
        careerId: 'career_bia_2',
        userId: 'user_bia',
        displayName: 'Bia 2',
        // Outside the profile contract: the read model drops it.
        avatar: 'http://example.com/bia.png',
        points: 5,
      }),
    ]);
  });
  const service = new RankingService({
    store: new InMemoryRankingStore(unitOfWork),
    clock,
    auth,
  });
  return { service, auth, clock, unitOfWork };
}

describe('ranking service (live, ADR 0017)', () => {
  it('serves the general board live with every account counted', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    const general = await service.leaderboard({});
    expect(general).toMatchObject({
      scope: 'general',
      period: 'all',
      rulesVersion: 'ranking-v2',
      generatedAt: '2026-10-23T12:00:00.000Z',
      // Ana, Bia, Caio (no career: counted, not listed) and Duda.
      total: 4,
    });
    expect(general.rows).toEqual([
      {
        position: 1,
        displayName: 'Bia',
        avatar: 'https://lh3.googleusercontent.com/a/bia',
        points: 100,
      },
      { position: 2, displayName: 'Ana', avatar: 'avatar-05', points: 70 },
      { position: 4, displayName: 'Duda', avatar: 'avatar-08', points: 0 },
    ]);
  });

  it('keeps scope=global as an alias of general for older clients', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    const legacy = await service.leaderboard({ scope: 'global' });
    expect(legacy.scope).toBe('global');
    expect(legacy.rows).toEqual((await service.leaderboard({})).rows);
  });

  it('ranks titles and the best season with their own measure', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    expect((await service.leaderboard({ scope: 'titles' })).rows).toEqual([
      // One title each: Ana's 70 points do not beat Bia's 100.
      {
        position: 1,
        displayName: 'Bia',
        avatar: 'https://lh3.googleusercontent.com/a/bia',
        points: 100,
        titles: 1,
      },
      {
        position: 2,
        displayName: 'Ana',
        avatar: 'avatar-05',
        points: 70,
        titles: 1,
      },
      {
        position: 4,
        displayName: 'Duda',
        avatar: 'avatar-08',
        points: 0,
        titles: 0,
      },
    ]);
    const best = await service.leaderboard({ scope: 'best_season', limit: 1 });
    expect(best.rows).toEqual([
      {
        position: 1,
        displayName: 'Bia',
        avatar: 'https://lh3.googleusercontent.com/a/bia',
        points: 100,
        season: 1,
      },
    ]);
    const monthly = await service.leaderboard({ scope: 'monthly' });
    // Bia's title was validated in September; October has her 5 points.
    expect(monthly.rows.slice(0, 2)).toEqual([
      { position: 1, displayName: 'Ana', avatar: 'avatar-05', points: 70 },
      { position: 2, displayName: 'Bia 2', points: 5 },
    ]);
    expect(
      (await service.leaderboard({ scope: 'rise', limit: '1' })).rows,
    ).toEqual([
      { position: 1, displayName: 'Ana', avatar: 'avatar-05', points: 117 },
    ]);
  });

  it('rejects bad queries', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    await expect(service.leaderboard({ scope: 'weekly' })).rejects.toThrow();
    await expect(
      service.leaderboard({ scope: 'monthly', period: '2026-13' }),
    ).rejects.toThrow();
  });

  it('closes the previous month on the first day of a month, once', async () => {
    const { service } = await setup('2026-11-01T00:05:00.000Z');
    expect(await service.maintain()).toEqual({
      ranAt: '2026-11-01T00:05:00.000Z',
      closedMonth: { period: '2026-10', rows: 2 },
      refreshed: 0,
    });
    expect(await service.maintain()).toEqual({
      ranAt: '2026-11-01T00:05:00.000Z',
      refreshed: 0,
    });
    const october = await service.leaderboard({
      scope: 'monthly',
      period: '2026-10',
    });
    expect(october.rows[0]).toMatchObject({ displayName: 'Ana', points: 70 });
  });

  it('closes nothing on other days', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    expect(await service.maintain()).toEqual({
      ranAt: '2026-10-23T12:00:00.000Z',
      refreshed: 0,
    });
  });

  it('tells the authenticated user their position of all participants', async () => {
    const { service, auth } = await setup('2026-10-23T12:00:00.000Z');
    const token = (userId: string) =>
      auth.issue({
        userId,
        email: `${userId}@example.com`,
        displayName: userId,
      });
    const mine = await service.mine(token('user_ana'));
    expect(mine.rulesVersion).toBe('ranking-v2');
    expect(mine.entries).toEqual([
      {
        scope: 'general',
        period: 'all',
        total: 4,
        position: 2,
        points: 70,
        displayName: 'Ana',
        avatar: 'avatar-05',
      },
      {
        scope: 'titles',
        period: 'all',
        total: 4,
        position: 2,
        points: 70,
        titles: 1,
        displayName: 'Ana',
        avatar: 'avatar-05',
      },
      {
        scope: 'best_season',
        period: 'all',
        total: 4,
        position: 2,
        points: 70,
        season: 1,
        displayName: 'Ana',
        avatar: 'avatar-05',
      },
      {
        scope: 'rise',
        period: 'all',
        total: 4,
        position: 1,
        points: 117,
        displayName: 'Ana',
        avatar: 'avatar-05',
      },
      {
        scope: 'monthly',
        period: '2026-10',
        total: 4,
        position: 1,
        points: 70,
        displayName: 'Ana',
        avatar: 'avatar-05',
      },
    ]);
    // An account without career still has a position (with zero).
    const caio = await service.mine(token('user_caio'));
    expect(caio.entries[0]).toEqual({
      scope: 'general',
      period: 'all',
      total: 4,
      position: 3,
      points: 0,
    });
    // A user outside the ranking (never signed up) has no position.
    const ghost = await service.mine(token('user_ghost'));
    expect(ghost.entries[0]).toEqual({
      scope: 'general',
      period: 'all',
      total: 4,
      points: 0,
    });
    await expect(service.mine('Bearer nope')).rejects.toThrow();
  });
});

describe('titles when a competition ends (ADR 0017)', () => {
  const definitions = [
    { id: 'competition_serie_b', tier: 'national_league' as const },
    { id: 'competition_estadual', tier: 'state' as const },
    { id: 'competition_copa', tier: 'national_cup' as const },
    { id: 'competition_libertadores', tier: 'continental' as const },
  ];
  const divisionCompetitionIds = {
    'serie-a': 'competition_serie_a',
    'serie-b': 'competition_serie_b',
    'serie-c': 'competition_serie_c',
  };

  it('validates the title of the managed club on the date it ended', () => {
    expect(
      titleAchievements({
        season: 2,
        gameDate: '2027-04-20',
        managedClubId: 'club_small',
        clubReputation: 50,
        outcomes: [
          { competitionId: 'competition_estadual', championId: 'club_small' },
          { competitionId: 'competition_copa', championId: 'club_other' },
        ],
        definitions,
        divisionCompetitionIds,
      }),
    ).toEqual([
      {
        type: 'state_title',
        season: 2,
        competitionId: 'competition_estadual',
        clubId: 'club_small',
        clubReputation: 50,
        gameDate: '2027-04-20',
        points: 25,
        risePoints: 50,
        rulesVersion: 'ranking-v2',
      },
    ]);
  });

  it('validates nothing without a managed club or a known competition', () => {
    const outcomes = [
      { competitionId: 'competition_unknown', championId: 'club_small' },
    ];
    expect(
      titleAchievements({
        season: 1,
        gameDate: '2026-05-01',
        clubReputation: 50,
        outcomes,
        definitions,
        divisionCompetitionIds,
      }),
    ).toEqual([]);
    expect(
      titleAchievements({
        season: 1,
        gameDate: '2026-05-01',
        managedClubId: 'club_small',
        clubReputation: 50,
        outcomes,
        definitions,
        divisionCompetitionIds,
      }),
    ).toEqual([]);
  });

  it('keeps the first of repeated achievements (the title of the round wins)', () => {
    const titles = titleAchievements({
      season: 1,
      gameDate: '2026-04-20',
      managedClubId: 'club_small',
      clubReputation: 50,
      outcomes: [
        { competitionId: 'competition_estadual', championId: 'club_small' },
      ],
      definitions,
      divisionCompetitionIds,
    });
    const atClose = seasonAchievements({
      season: 1,
      year: 2026,
      managedClubId: 'club_small',
      clubReputation: 50,
      outcomes: [
        { competitionId: 'competition_estadual', championId: 'club_small' },
      ],
      definitions,
      divisionCompetitionIds,
      promotions: [],
      leagueCompetitionId: 'competition_serie_b',
    });
    const merged = uniqueAchievements([...titles, ...atClose]);
    expect(merged.map(({ type, gameDate }) => [type, gameDate])).toEqual([
      ['state_title', '2026-04-20'],
      ['season_completed', '2026-12-31'],
    ]);
  });
});

describe('season achievements', () => {
  const base = {
    season: 3,
    year: 2028,
    managedClubId: 'club_small',
    clubReputation: 50,
    definitions: [
      { id: 'competition_serie_b', tier: 'national_league' as const },
      { id: 'competition_estadual', tier: 'state' as const },
      { id: 'competition_copa', tier: 'national_cup' as const },
    ],
    divisionCompetitionIds: {
      'serie-a': 'competition_serie_a',
      'serie-b': 'competition_serie_b',
      'serie-c': 'competition_serie_c',
    },
    leagueCompetitionId: 'competition_serie_b',
  };

  it('validates titles, promotion and the completed season of the managed club', () => {
    const achievements = seasonAchievements({
      ...base,
      outcomes: [
        { competitionId: 'competition_serie_b', championId: 'club_small' },
        { competitionId: 'competition_estadual', championId: 'club_small' },
        { competitionId: 'competition_copa', championId: 'club_other' },
      ],
      promotions: [
        { clubId: 'club_small', toCompetitionId: 'competition_serie_a' },
        { clubId: 'club_other', toCompetitionId: 'competition_serie_a' },
      ],
    });
    expect(
      achievements.map(({ type, competitionId, points, risePoints }) => [
        type,
        competitionId,
        points,
        risePoints,
      ]),
    ).toEqual([
      ['league_title', 'competition_serie_b', 60, 120],
      ['state_title', 'competition_estadual', 25, 50],
      ['promotion', 'competition_serie_a', 45, 90],
      ['season_completed', 'competition_serie_b', 5, 0],
    ]);
    expect(
      achievements.every(({ gameDate }) => gameDate === '2028-12-31'),
    ).toBe(true);
  });

  it('validates nothing for an unemployed coach', () => {
    const { managedClubId: _managed, ...unemployed } = base;
    void _managed;
    expect(
      seasonAchievements({ ...unemployed, outcomes: [], promotions: [] }),
    ).toEqual([]);
  });
});
