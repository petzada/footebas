import type postgres from 'postgres';
import { describe, expect, it } from 'vitest';
import { InMemoryRankingStore, InMemoryUnitOfWork } from './in-memory.js';
import {
  PostgresAchievementLedger,
  PostgresRankingStore,
} from './rankings-postgres.js';
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

describe('ranking avatar', () => {
  it('in memory: the snapshot keeps the latest avatar of the best career', async () => {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    await unitOfWork.withCareerLock('seed', async (tx) => {
      await tx.achievements.record([
        achievement({
          careerId: 'career_a',
          userId: 'user_a',
          avatar: 'avatar-02',
        }),
        achievement({
          careerId: 'career_a',
          userId: 'user_a',
          avatar: 'https://cdn.footebas.com.br/avatars/a.png',
          season: 2,
          recordedAt: '2026-10-24T12:00:00.000Z',
        }),
        achievement({ careerId: 'career_b', userId: 'user_b' }),
      ]);
    });
    const store = new InMemoryRankingStore(() => unitOfWork.achievements());
    await store.replaceSnapshot(
      'global',
      'all',
      await store.aggregate('global'),
      '2026-10-24T12:00:00.000Z',
    );
    const rows = (await store.snapshot('global', 'all', 10))?.rows ?? [];
    expect(rows.map(({ userId, avatar }) => [userId, avatar])).toEqual([
      ['user_a', 'https://cdn.footebas.com.br/avatars/a.png'],
      ['user_b', undefined],
    ]);
    expect(rows[1]).not.toHaveProperty('avatar');
    expect(
      await store.positionsOf('user_a', [{ scope: 'global', period: 'all' }]),
    ).toEqual([
      expect.objectContaining({
        avatar: 'https://cdn.footebas.com.br/avatars/a.png',
      }),
    ]);
  });
});

/** Tagged-template stand-in: records each query and answers queued rows. */
function fakeSql(answers: unknown[][] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (first: unknown, ...values: unknown[]) => {
    // `sql(rows)` is the bulk-insert helper: return the rows to inspect.
    if (!Array.isArray(first) || !('raw' in first)) return { helper: first };
    const text = (first as string[]).join('?');
    // Fragments (`sql\`points\``) are values of the query that embeds them.
    if (!/\b(select|insert|delete)\b/.test(text)) return { fragment: text };
    calls.push({ text, values });
    return Promise.resolve(answers.shift() ?? []);
  };
  const begin = (body: (tx: typeof sql) => Promise<unknown>) => body(sql);
  return {
    sql: Object.assign(sql, { begin }) as unknown as postgres.Sql,
    calls,
  };
}

describe('Postgres ranking avatar', () => {
  it('stores the avatar with the achievement and reads it back', async () => {
    // One answer per insert (two entries), then the listByCareer rows.
    const { sql, calls } = fakeSql([
      [],
      [],
      [
        {
          career_id: 'career_a',
          user_id: 'user_a',
          display_name: 'Marcio',
          avatar: null,
          type: 'season_completed',
          season: 1,
          competition_id: 'competition_serie_a',
          club_id: 'club_flamengo',
          club_reputation: 80,
          game_date: '2026-12-31',
          points: 5,
          rise_points: 0,
          rules_version: 'ranking-v1',
          recorded_at: '2026-10-23T12:00:00.000Z',
        },
      ],
    ]);
    const ledger = new PostgresAchievementLedger(sql);
    await ledger.record([
      achievement({
        careerId: 'career_a',
        userId: 'user_a',
        avatar: 'avatar-07',
      }),
      achievement({ careerId: 'career_a', userId: 'user_a', season: 2 }),
    ]);
    expect(calls[0]?.text).toContain('display_name, avatar, type');
    expect(calls[0]?.values.slice(0, 5)).toEqual([
      'career_a',
      'user_a',
      'Marcio',
      'avatar-07',
      'season_completed',
    ]);
    expect(calls[1]?.values[3]).toBeNull();
    const [read] = await ledger.listByCareer('career_a');
    expect(read).toMatchObject({ careerId: 'career_a', season: 1 });
    expect(read).not.toHaveProperty('avatar');
  });

  it('aggregates the latest non-null avatar and copies it to the snapshot', async () => {
    const { sql, calls } = fakeSql([
      [
        {
          career_id: 'career_a',
          user_id: 'user_a',
          display_name: 'Marcio',
          avatar: 'avatar-04',
          points: 100,
          reached_at: '2026-10-23T12:00:00.000Z',
        },
        {
          career_id: 'career_b',
          user_id: 'user_b',
          display_name: 'Ana',
          avatar: null,
          points: 50,
          reached_at: '2026-10-23T12:00:00.000Z',
        },
      ],
    ]);
    const store = new PostgresRankingStore(sql);
    const rows = await store.aggregate('global');
    const aggregateQuery = calls.at(-1)?.text ?? '';
    expect(aggregateQuery).toContain(
      'array_agg(avatar order by recorded_at desc, id desc)',
    );
    expect(aggregateQuery).toContain('filter (where avatar is not null)');
    expect(rows).toEqual([
      expect.objectContaining({ userId: 'user_a', avatar: 'avatar-04' }),
      expect.objectContaining({ userId: 'user_b' }),
    ]);
    expect(rows[1]).not.toHaveProperty('avatar');

    await store.replaceSnapshot(
      'global',
      'all',
      rows,
      '2026-10-23T12:15:00.000Z',
    );
    const insert = calls.at(-1);
    expect(insert?.text).toContain('insert into footebas.ranking_snapshots');
    expect(
      (insert?.values[0] as { helper: { avatar: string | null }[] }).helper.map(
        ({ avatar }) => avatar,
      ),
    ).toEqual(['avatar-04', null]);
  });

  it('serves the snapshot avatar and omits a null one', async () => {
    const snapshotRow = (userId: string, avatar: string | null) => ({
      scope: 'global',
      period: 'all',
      position: userId === 'user_a' ? 1 : 2,
      user_id: userId,
      career_id: `career_${userId}`,
      display_name: userId,
      avatar,
      points: 10,
      generated_at: '2026-10-23T12:15:00.000Z',
    });
    const { sql } = fakeSql([
      [{ total: 2, generated_at: '2026-10-23T12:15:00.000Z' }],
      [
        snapshotRow('user_a', 'https://lh3.googleusercontent.com/a/x'),
        snapshotRow('user_b', null),
      ],
    ]);
    const snapshot = await new PostgresRankingStore(sql).snapshot(
      'global',
      'all',
      100,
    );
    expect(snapshot?.rows[0]?.avatar).toBe(
      'https://lh3.googleusercontent.com/a/x',
    );
    expect(snapshot?.rows[1]).not.toHaveProperty('avatar');
  });
});
