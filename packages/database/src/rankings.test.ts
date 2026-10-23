import { describe, expect, it } from 'vitest';
import { InMemoryRankingStore, InMemoryUnitOfWork } from './in-memory.js';
import type { ValidatedAchievement } from './ports.js';

const clock = { now: () => new Date('2026-10-23T12:00:00.000Z') };

const achievement = (
  overrides: Partial<ValidatedAchievement> &
    Pick<ValidatedAchievement, 'careerId' | 'userId'>,
): ValidatedAchievement => ({
  displayName: 'Marcio',
  type: 'season_completed',
  season: 1,
  competitionId: 'competition_serie_a',
  clubId: 'club_flamengo',
  clubReputation: 80,
  gameDate: '2026-12-31',
  points: 5,
  risePoints: 0,
  rulesVersion: 'ranking-v1',
  recordedAt: '2026-10-23T12:00:00.000Z',
  ...overrides,
});

describe('in-memory achievement ledger', () => {
  it('records once per career, type, season and competition', async () => {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    const first = achievement({ careerId: 'career_a', userId: 'user_a' });
    await unitOfWork.withCareerLock('career_a', async (tx) => {
      await tx.achievements.record([first]);
      await tx.achievements.record([{ ...first, points: 999 }]);
      await tx.achievements.record([{ ...first, season: 2 }]);
    });
    expect(
      unitOfWork.achievements().map(({ season, points }) => [season, points]),
    ).toEqual([
      [1, 5],
      [2, 5],
    ]);
  });

  it('records nothing when the career transaction rolls back', async () => {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    await expect(
      unitOfWork.withCareerLock('career_a', async (tx) => {
        await tx.achievements.record([
          achievement({ careerId: 'career_a', userId: 'user_a' }),
        ]);
        throw new Error('save update failed');
      }),
    ).rejects.toThrow('save update failed');
    expect(unitOfWork.achievements()).toEqual([]);
  });
});

describe('in-memory ranking store', () => {
  it('aggregates the ledger into snapshots and finds each user', async () => {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    await unitOfWork.withCareerLock('seed', async (tx) => {
      await tx.achievements.record([
        achievement({ careerId: 'career_a1', userId: 'user_a' }),
        achievement({
          careerId: 'career_a1',
          userId: 'user_a',
          type: 'league_title',
          points: 100,
        }),
        achievement({
          careerId: 'career_a2',
          userId: 'user_a',
          type: 'promotion',
          competitionId: 'competition_serie_b',
          clubReputation: 50,
          points: 45,
          risePoints: 90,
        }),
        achievement({
          careerId: 'career_b',
          userId: 'user_b',
          type: 'cup_title',
          competitionId: 'competition_copa',
          points: 70,
          recordedAt: '2026-09-10T12:00:00.000Z',
        }),
      ]);
    });
    const store = new InMemoryRankingStore(() => unitOfWork.achievements());
    const global = await store.aggregate('global');
    expect(
      global.map(({ userId, careerId, points }) => [userId, careerId, points]),
    ).toEqual([
      ['user_a', 'career_a1', 105],
      ['user_b', 'career_b', 70],
    ]);
    expect(
      (await store.aggregate('rise')).map(({ userId, points }) => [
        userId,
        points,
      ]),
    ).toEqual([['user_a', 90]]);
    expect(
      (await store.aggregate('monthly', '2026-10')).map(
        ({ userId, points }) => [userId, points],
      ),
    ).toEqual([['user_a', 105]]);
    await store.replaceSnapshot(
      'global',
      'all',
      global,
      '2026-10-23T12:00:00.000Z',
    );
    expect((await store.snapshot('global', 'all', 1))?.rows).toHaveLength(1);
    expect((await store.snapshot('global', 'all', 1))?.total).toBe(2);
    expect(
      await store.positionsOf('user_b', [
        { scope: 'global', period: 'all' },
        { scope: 'rise', period: 'all' },
      ]),
    ).toEqual([
      {
        scope: 'global',
        period: 'all',
        generatedAt: '2026-10-23T12:00:00.000Z',
        position: 2,
        userId: 'user_b',
        careerId: 'career_b',
        displayName: 'Marcio',
        points: 70,
      },
    ]);
  });
});
