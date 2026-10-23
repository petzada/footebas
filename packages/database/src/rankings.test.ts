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
  rulesVersion: 'ranking-v2',
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
        await tx.achievements.enroll({
          careerId: 'career_a',
          userId: 'user_a',
          displayName: 'Ana',
        });
        throw new Error('save update failed');
      }),
    ).rejects.toThrow('save update failed');
    expect(unitOfWork.achievements()).toEqual([]);
    expect(unitOfWork.rankingPlayers()).toEqual([]);
  });

  it('keeps the first career as the name of the account', async () => {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    unitOfWork.signUp('user_a', '2026-10-01T00:00:00.000Z');
    await unitOfWork.withCareerLock('career_a', async (tx) => {
      await tx.achievements.enroll({
        careerId: 'career_a',
        userId: 'user_a',
        displayName: 'Primeiro',
        avatar: 'avatar-03',
      });
      await tx.achievements.enroll({
        careerId: 'career_b',
        userId: 'user_a',
        displayName: 'Segundo',
      });
    });
    expect(unitOfWork.rankingPlayers()).toEqual([
      {
        userId: 'user_a',
        joinedAt: '2026-10-01T00:00:00.000Z',
        careerId: 'career_a',
        displayName: 'Primeiro',
        avatar: 'avatar-03',
      },
    ]);
  });
});

describe('in-memory ranking store (live, ADR 0017)', () => {
  async function seeded() {
    const unitOfWork = new InMemoryUnitOfWork(clock);
    unitOfWork.signUp('user_new', '2026-10-01T00:00:00.000Z');
    unitOfWork.signUp('user_idle', '2026-10-02T00:00:00.000Z');
    await unitOfWork.withCareerLock('seed', async (tx) => {
      await tx.achievements.enroll({
        careerId: 'career_new',
        userId: 'user_new',
        displayName: 'Novato',
      });
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
        achievement({
          careerId: 'career_b',
          userId: 'user_b',
          type: 'state_title',
          competitionId: 'competition_estadual',
          points: 25,
          recordedAt: '2026-09-10T12:00:00.000Z',
        }),
      ]);
    });
    return { unitOfWork, store: new InMemoryRankingStore(unitOfWork) };
  }

  it('lists users with points, then accounts with a career and zero', async () => {
    const { store } = await seeded();
    const general = await store.board('general', 'all', 100);
    // user_a, user_b, then the accounts without points in sign-up order;
    // user_idle has no career: counted (position 4, total 4) but hidden.
    expect(general.total).toBe(4);
    expect(
      general.rows.map(({ position, userId, points }) => [
        position,
        userId,
        points,
      ]),
    ).toEqual([
      [1, 'user_a', 105],
      [2, 'user_b', 95],
      [3, 'user_new', 0],
    ]);
    const titles = await store.board('titles', 'all', 2);
    expect(
      titles.rows.map(({ userId, titles: count }) => [userId, count]),
    ).toEqual([
      ['user_b', 2],
      ['user_a', 1],
    ]);
    expect(
      (await store.board('rise', 'all', 100)).rows.map(({ userId }) => userId),
    ).toEqual(['user_a', 'user_new', 'user_b']);
    expect(
      (await store.board('monthly', '2026-09', 100)).rows.map(
        ({ userId, points }) => [userId, points],
      ),
    ).toEqual([
      ['user_b', 95],
      ['user_new', 0],
      ['user_a', 0],
    ]);
  });

  it('gives every account its position and the total of participants', async () => {
    const { store } = await seeded();
    const targets = [
      { scope: 'general', period: 'all' },
      { scope: 'titles', period: 'all' },
      { scope: 'best_season', period: 'all' },
    ] as const;
    expect(
      (await store.positionsOf('user_idle', targets)).map(
        ({ scope, position, total, points }) => [
          scope,
          position,
          total,
          points,
        ],
      ),
    ).toEqual([
      ['general', 4, 4, 0],
      ['titles', 4, 4, 0],
      ['best_season', 4, 4, 0],
    ]);
    const [general] = await store.positionsOf('user_b', targets);
    expect(general).toMatchObject({
      position: 2,
      total: 4,
      careerId: 'career_b',
      points: 95,
    });
    expect(
      (await store.positionsOf('user_ghost', targets))[0],
    ).not.toHaveProperty('position');
  });

  it('closes a month only once', async () => {
    const { store } = await seeded();
    expect(await store.closeMonth('2026-09')).toBe(1);
    expect(await store.closeMonth('2026-09')).toBeUndefined();
  });
});

/** Tagged-template stand-in: records each query and answers queued rows. */
function fakeSql(answers: unknown[][] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (first: unknown, ...values: unknown[]) => {
    // `sql(rows)` is the bulk-insert / list helper: return it to inspect.
    if (!Array.isArray(first) || !('raw' in first)) return { helper: first };
    const text = (first as string[]).join('?');
    if (!/\b(select|insert|delete|update)\b/.test(text))
      return { fragment: text };
    calls.push({ text, values });
    return Promise.resolve(answers.shift() ?? []);
  };
  const begin = (body: (tx: typeof sql) => Promise<unknown>) => body(sql);
  const array = (values: unknown[]) => ({ array: values });
  return {
    sql: Object.assign(sql, { begin, array }) as unknown as postgres.Sql,
    calls,
  };
}

const ledgerRow = (overrides: Record<string, unknown> = {}) => ({
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
  ...overrides,
});

const helperRows = <T>(call: { values: unknown[] } | undefined) =>
  (call?.values[0] as { helper: T[] }).helper;

describe('Postgres achievement ledger (ADR 0017)', () => {
  it('records a title and updates the totals of the user in the same transaction', async () => {
    const title = achievement({
      careerId: 'career_a',
      userId: 'user_a',
      type: 'state_title',
      competitionId: 'competition_estadual_rj',
      points: 25,
      risePoints: 50,
      avatar: 'avatar-07',
      recordedAt: '2026-10-23T12:00:00.000Z',
    });
    const { sql, calls } = fakeSql([
      [], // insert achievements
      [{ needs_refresh: false }], // upsert account (locks it)
      [
        // the user's ledger: an older season, then the new title
        ledgerRow({ recorded_at: '2026-09-01T10:00:00.000Z' }),
        ledgerRow({
          type: 'state_title',
          competition_id: 'competition_estadual_rj',
          season: 2,
          points: 25,
          rise_points: 50,
          avatar: 'avatar-07',
        }),
      ],
      [], // delete the rows being rebuilt
      [], // insert the rows
    ]);
    await new PostgresAchievementLedger(sql).record([title]);
    const texts = calls.map(({ text }) => text);
    expect(texts[0]).toContain('insert into footebas.validated_achievements');
    expect(texts[0]).toContain(
      'on conflict (career_id, type, season, competition_id) do nothing',
    );
    expect(helperRows<{ avatar: string; type: string }>(calls[0])).toEqual([
      expect.objectContaining({ avatar: 'avatar-07', type: 'state_title' }),
    ]);
    expect(texts[1]).toContain('insert into footebas.ranking_players');
    expect(texts[1]).toContain('on conflict (user_id) do update');
    expect(calls[1]?.values.slice(0, 3)).toEqual([
      'user_a',
      'career_a',
      'Marcio',
    ]);
    expect(texts[2]).toContain('from footebas.validated_achievements');
    expect(calls[2]?.values).toEqual(['user_a']);
    // Only the all-time rows and the month of the new achievement.
    expect(texts[3]).toContain("(period = 'all' or period in ?)");
    expect(calls[3]?.values[1]).toEqual({ helper: ['2026-10'] });
    const rows = helperRows<Record<string, unknown>>(calls[4]);
    expect(
      rows.map(({ scope, period, points, titles, season }) => [
        scope,
        period,
        points,
        titles,
        season,
      ]),
    ).toEqual([
      ['general', 'all', 30, 0, 0],
      ['titles', 'all', 30, 1, 0],
      ['best_season', 'all', 25, 0, 2],
      ['rise', 'all', 50, 0, 0],
      ['monthly', '2026-10', 25, 0, 0],
    ]);
    expect(rows[0]).toMatchObject({
      user_id: 'user_a',
      career_id: 'career_a',
      avatar: 'avatar-07',
      reached_at: '2026-10-23T12:00:00.000Z',
    });
    // No flag to clear: five round trips in all.
    expect(calls).toHaveLength(5);
  });

  it('rebuilds every row of an account the migration flagged', async () => {
    const { sql, calls } = fakeSql([
      [],
      [{ needs_refresh: true }],
      [
        ledgerRow({ recorded_at: '2026-08-01T10:00:00.000Z' }),
        ledgerRow({ season: 2 }),
      ],
      [],
      [],
      [],
    ]);
    await new PostgresAchievementLedger(sql).record([
      achievement({ careerId: 'career_a', userId: 'user_a', season: 2 }),
    ]);
    expect(calls[3]?.text).not.toContain('period in');
    expect(
      helperRows<{ period: string }>(calls[4])
        .filter(({ period }) => period !== 'all')
        .map(({ period }) => period),
    ).toEqual(['2026-08', '2026-10']);
    expect(calls[5]?.text).toContain('set needs_refresh = false');
  });

  it('does nothing without achievements', async () => {
    const { sql, calls } = fakeSql();
    await new PostgresAchievementLedger(sql).record([]);
    expect(calls).toEqual([]);
  });

  it('enrolls the first career of the account without replacing it later', async () => {
    const { sql, calls } = fakeSql([[{ needs_refresh: false }]]);
    await new PostgresAchievementLedger(sql).enroll({
      careerId: 'career_a',
      userId: 'user_a',
      displayName: 'Ana',
    });
    expect(calls[0]?.text).toContain(
      'career_id = coalesce(ranking_players.career_id, excluded.career_id)',
    );
    expect(calls[0]?.values).toEqual(['user_a', 'career_a', 'Ana', null]);
  });

  it('reads the ledger back without a null avatar', async () => {
    const { sql } = fakeSql([[ledgerRow()]]);
    const [read] = await new PostgresAchievementLedger(sql).listByCareer(
      'career_a',
    );
    expect(read).toMatchObject({
      careerId: 'career_a',
      season: 1,
      gameDate: '2026-12-31',
      rulesVersion: 'ranking-v1',
    });
    expect(read).not.toHaveProperty('avatar');
  });
});

describe('Postgres ranking store (ADR 0017)', () => {
  const entryRow = (
    userId: string,
    points: number,
    avatar: string | null = null,
  ) => ({
    user_id: userId,
    career_id: `career_${userId}`,
    display_name: userId,
    avatar,
    points,
    titles: 0,
    season: 0,
  });

  it('reads the board by index and fills it with accounts without points', async () => {
    const { sql, calls } = fakeSql([
      [{ total: 5, scored: 2 }],
      [entryRow('user_a', 100, 'avatar-04'), entryRow('user_b', 50)],
      [
        // Accounts without points: user_idle (position 1) has no career
        // and is filtered by the query; user_new is 2nd among them.
        { ...entryRow('user_new', 0), position: 2 },
      ],
    ]);
    const board = await new PostgresRankingStore(sql).board(
      'general',
      'all',
      3,
    );
    expect(calls[0]?.text).toContain(
      'count(*)::int from footebas.ranking_players',
    );
    expect(calls[1]?.text).toContain(
      'order by -titles, -points, season, reached_at, user_id',
    );
    expect(calls[1]?.values).toEqual(['general', 'all', 3]);
    expect(calls[2]?.text).toContain(
      'row_number() over (order by p.joined_at, p.user_id)',
    );
    expect(calls[2]?.text).toContain('where career_id is not null');
    expect(calls[2]?.values.at(-1)).toBe(1);
    expect(board.total).toBe(5);
    expect(
      board.rows.map(({ position, userId, points }) => [
        position,
        userId,
        points,
      ]),
    ).toEqual([
      [1, 'user_a', 100],
      [2, 'user_b', 50],
      [4, 'user_new', 0],
    ]);
    expect(board.rows[0]?.avatar).toBe('avatar-04');
    expect(board.rows[1]).not.toHaveProperty('avatar');
  });

  it('skips the accounts without points when the page is full', async () => {
    const { sql, calls } = fakeSql([
      [{ total: 9, scored: 4 }],
      [entryRow('user_a', 100), entryRow('user_b', 50)],
    ]);
    await new PostgresRankingStore(sql).board('titles', 'all', 2);
    expect(calls).toHaveLength(2);
  });

  it('computes every position of the user in one statement', async () => {
    const { sql, calls } = fakeSql([
      [
        {
          scope: 'general',
          period: 'all',
          total: 5000,
          ...entryRow('user_a', 30),
          position: 1234,
        },
        {
          scope: 'monthly',
          period: '2026-10',
          total: 5000,
          ...entryRow('user_a', 0),
          position: 4000,
        },
      ],
    ]);
    const positions = await new PostgresRankingStore(sql).positionsOf(
      'user_a',
      [
        { scope: 'general', period: 'all' },
        { scope: 'monthly', period: '2026-10' },
      ],
    );
    expect(calls).toHaveLength(1);
    const text = calls[0]?.text ?? '';
    expect(text).toContain(
      '(-o.titles, -o.points, o.season, o.reached_at, o.user_id)',
    );
    expect(text).toContain(
      '(q.joined_at, q.user_id) < (p.joined_at, p.user_id)',
    );
    expect(calls[0]?.values).toContainEqual({ array: ['general', 'monthly'] });
    expect(calls[0]?.values).toContainEqual({ array: ['all', '2026-10'] });
    expect(positions).toEqual([
      expect.objectContaining({
        scope: 'general',
        position: 1234,
        total: 5000,
        points: 30,
      }),
      expect.objectContaining({
        scope: 'monthly',
        position: 4000,
        total: 5000,
        points: 0,
      }),
    ]);
  });

  it('leaves the position out for a user without account', async () => {
    const { sql } = fakeSql([
      [
        {
          scope: 'general',
          period: 'all',
          total: 3,
          user_id: 'user_x',
          career_id: null,
          display_name: null,
          avatar: null,
          points: 0,
          titles: 0,
          season: 0,
          position: null,
        },
      ],
    ]);
    const [position] = await new PostgresRankingStore(sql).positionsOf(
      'user_x',
      [{ scope: 'general', period: 'all' }],
    );
    expect(position).toEqual({
      scope: 'general',
      period: 'all',
      total: 3,
      userId: 'user_x',
      points: 0,
      titles: 0,
      season: 0,
    });
  });

  it('closes a month into the history once', async () => {
    const { sql, calls } = fakeSql([
      [{ rows: 0 }],
      [{ rows: 12 }],
      [{ rows: 12 }],
    ]);
    const store = new PostgresRankingStore(sql);
    expect(await store.closeMonth('2026-09', '2026-10-01T00:00:00.000Z')).toBe(
      12,
    );
    expect(calls[1]?.text).toContain('insert into footebas.ranking_snapshots');
    expect(
      await store.closeMonth('2026-09', '2026-10-01T00:15:00.000Z'),
    ).toBeUndefined();
  });

  it('rebuilds the flagged accounts one transaction each', async () => {
    const { sql, calls } = fakeSql([
      [{ user_id: 'user_a' }],
      [], // lock
      [ledgerRow()],
      [], // delete
      [], // insert
      [], // clear flag
    ]);
    expect(await new PostgresRankingStore(sql).refreshPending(50)).toBe(1);
    expect(calls[1]?.text).toContain('for update');
    expect(calls[5]?.text).toContain('set needs_refresh = false');
  });
});
