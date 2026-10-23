import {
  InMemoryRankingStore,
  InMemoryUnitOfWork,
  type ValidatedAchievement,
} from '@footebas/database';
import { describe, expect, it } from 'vitest';
import { FakeBearerAuth, FakeClock } from './ports.js';
import { RankingService, seasonAchievements } from './rankings.js';

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
  await unitOfWork.withCareerLock('seed', async (tx) => {
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
    store: new InMemoryRankingStore(() => unitOfWork.achievements()),
    clock,
    auth,
  });
  return { service, auth, clock };
}

describe('ranking service', () => {
  it('publishes snapshots of global, rise and the current month', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    const run = await service.generateSnapshots();
    expect(run.snapshots).toEqual([
      { scope: 'global', period: 'all', rows: 2 },
      { scope: 'rise', period: 'all', rows: 1 },
      { scope: 'monthly', period: '2026-10', rows: 2 },
    ]);
    const global = await service.leaderboard({});
    expect(global).toMatchObject({
      scope: 'global',
      period: 'all',
      rulesVersion: 'ranking-v1',
      generatedAt: '2026-10-23T12:00:00.000Z',
      total: 2,
    });
    expect(global.rows).toEqual([
      {
        position: 1,
        displayName: 'Bia',
        avatar: 'https://lh3.googleusercontent.com/a/bia',
        points: 100,
      },
      { position: 2, displayName: 'Ana', avatar: 'avatar-05', points: 45 },
    ]);
    const monthly = await service.leaderboard({ scope: 'monthly' });
    // Bia's title was validated in September; October has her 5 points.
    expect(monthly.rows).toEqual([
      { position: 1, displayName: 'Ana', avatar: 'avatar-05', points: 45 },
      { position: 2, displayName: 'Bia 2', points: 5 },
    ]);
    expect(
      (await service.leaderboard({ scope: 'rise', limit: '1' })).rows,
    ).toEqual([
      { position: 1, displayName: 'Ana', avatar: 'avatar-05', points: 75 },
    ]);
  });

  it('closes the previous month on the first day of a month', async () => {
    const { service } = await setup('2026-11-01T00:05:00.000Z');
    const run = await service.generateSnapshots();
    expect(
      run.snapshots.map(({ scope, period }) => `${scope}:${period}`),
    ).toEqual(['global:all', 'rise:all', 'monthly:2026-11', 'monthly:2026-10']);
    const october = await service.leaderboard({
      scope: 'monthly',
      period: '2026-10',
    });
    expect(october.total).toBe(2);
  });

  it('answers empty before the first snapshot and rejects bad queries', async () => {
    const { service } = await setup('2026-10-23T12:00:00.000Z');
    expect(await service.leaderboard({ scope: 'rise' })).toEqual({
      version: 1,
      rulesVersion: 'ranking-v1',
      scope: 'rise',
      period: 'all',
      total: 0,
      rows: [],
    });
    await expect(service.leaderboard({ scope: 'weekly' })).rejects.toThrow();
    await expect(
      service.leaderboard({ scope: 'monthly', period: '2026-13' }),
    ).rejects.toThrow();
  });

  it('tells the authenticated user their position in each scope', async () => {
    const { service, auth } = await setup('2026-10-23T12:00:00.000Z');
    await service.generateSnapshots();
    const token = auth.issue({
      userId: 'user_ana',
      email: 'ana@example.com',
      displayName: 'Ana',
    });
    const mine = await service.mine(token);
    expect(mine.entries).toEqual([
      {
        scope: 'global',
        period: 'all',
        position: 2,
        points: 45,
        displayName: 'Ana',
        avatar: 'avatar-05',
        generatedAt: '2026-10-23T12:00:00.000Z',
      },
      {
        scope: 'rise',
        period: 'all',
        position: 1,
        points: 75,
        displayName: 'Ana',
        avatar: 'avatar-05',
        generatedAt: '2026-10-23T12:00:00.000Z',
      },
      {
        scope: 'monthly',
        period: '2026-10',
        position: 1,
        points: 45,
        displayName: 'Ana',
        avatar: 'avatar-05',
        generatedAt: '2026-10-23T12:00:00.000Z',
      },
    ]);
    await expect(service.mine('Bearer nope')).rejects.toThrow();
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
