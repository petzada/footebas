import { describe, expect, it } from 'vitest';
import {
  aggregateRanking,
  RANKING_RULES_VERSION,
  RANKING_SCOPES,
  rankingPoints,
  rankingStandings,
  risePoints,
  userRankingEntries,
  type RankingLedgerEntry,
} from './ranking.js';

const entry = (
  overrides: Partial<RankingLedgerEntry> &
    Pick<RankingLedgerEntry, 'careerId' | 'userId'>,
): RankingLedgerEntry => ({
  displayName: overrides.careerId,
  type: 'season_completed',
  season: 1,
  competitionId: '',
  points: 5,
  risePoints: 0,
  recordedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

describe('ranking points (v1 table, kept in v2)', () => {
  it('scores titles by competition and league titles by division', () => {
    expect(rankingPoints('continental_title')).toBe(180);
    expect(rankingPoints('league_title', 'serie-a')).toBe(100);
    expect(rankingPoints('league_title', 'serie-b')).toBe(60);
    expect(rankingPoints('league_title', 'serie-c')).toBe(40);
    expect(rankingPoints('cup_title')).toBe(70);
    expect(rankingPoints('state_title')).toBe(25);
    expect(rankingPoints('promotion')).toBe(45);
    expect(rankingPoints('season_completed')).toBe(5);
  });

  it('gives rise points only to feats of small clubs, scaled up to 3x', () => {
    expect(risePoints('promotion', 45, 66)).toBe(0);
    expect(risePoints('season_completed', 5, 40)).toBe(0);
    expect(risePoints('promotion', 45, 65)).toBe(45);
    expect(risePoints('promotion', 45, 50)).toBe(90);
    expect(risePoints('league_title', 40, 20)).toBe(120);
  });
});

describe('ranking aggregation', () => {
  it('counts only the best career of each user and breaks ties by who got there first', () => {
    const rows = aggregateRanking(
      [
        entry({ careerId: 'career_a1', userId: 'user_a', points: 100 }),
        entry({ careerId: 'career_a2', userId: 'user_a', points: 30 }),
        entry({
          careerId: 'career_a2',
          userId: 'user_a',
          points: 45,
          type: 'promotion',
        }),
        entry({
          careerId: 'career_b',
          userId: 'user_b',
          points: 100,
          recordedAt: '2026-10-02T10:00:00.000Z',
        }),
        entry({ careerId: 'career_c', userId: 'user_c', points: 175 }),
      ],
      'general',
    );
    expect(rows).toEqual([
      {
        position: 1,
        userId: 'user_c',
        careerId: 'career_c',
        displayName: 'career_c',
        points: 175,
        titles: 0,
        season: 0,
      },
      // user_a: best career (100) beats the other one (75); not summed.
      {
        position: 2,
        userId: 'user_a',
        careerId: 'career_a1',
        displayName: 'career_a1',
        points: 100,
        titles: 0,
        season: 0,
      },
      {
        position: 3,
        userId: 'user_b',
        careerId: 'career_b',
        displayName: 'career_b',
        points: 100,
        titles: 0,
        season: 0,
      },
    ]);
  });

  it('builds the monthly board from the month the server validated each achievement', () => {
    const ledger = [
      entry({
        careerId: 'career_a',
        userId: 'user_a',
        points: 100,
        recordedAt: '2026-09-30T23:59:59.000Z',
      }),
      entry({
        careerId: 'career_a',
        userId: 'user_a',
        points: 5,
        recordedAt: '2026-10-01T00:00:00.000Z',
      }),
      entry({
        careerId: 'career_b',
        userId: 'user_b',
        points: 45,
        recordedAt: '2026-10-15T12:00:00.000Z',
      }),
    ];
    expect(
      aggregateRanking(ledger, 'monthly', '2026-10').map(
        ({ userId, points }) => [userId, points],
      ),
    ).toEqual([
      ['user_b', 45],
      ['user_a', 5],
    ]);
    expect(aggregateRanking(ledger, 'monthly', '2026-11')).toEqual([]);
  });

  it('ranks rise by rise points and leaves out careers without any', () => {
    const rows = aggregateRanking(
      [
        entry({
          careerId: 'career_big',
          userId: 'user_big',
          type: 'league_title',
          points: 100,
          risePoints: 0,
        }),
        entry({
          careerId: 'career_small',
          userId: 'user_small',
          type: 'promotion',
          points: 45,
          risePoints: 96,
        }),
      ],
      'rise',
    );
    expect(rows).toEqual([
      {
        position: 1,
        userId: 'user_small',
        careerId: 'career_small',
        displayName: 'career_small',
        points: 96,
        titles: 0,
        season: 0,
      },
    ]);
  });

  it('shows the latest name a career recorded', () => {
    const [row] = aggregateRanking(
      [
        entry({ careerId: 'career_a', userId: 'user_a', displayName: 'Old' }),
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          displayName: 'New',
          season: 2,
          recordedAt: '2026-10-05T10:00:00.000Z',
        }),
      ],
      'general',
    );
    expect(row).toMatchObject({ displayName: 'New', points: 10 });
  });

  it('carries the latest avatar of the best career into the row', () => {
    const rows = aggregateRanking(
      [
        entry({
          careerId: 'career_a1',
          userId: 'user_a',
          avatar: 'avatar-03',
          points: 100,
        }),
        entry({
          careerId: 'career_a1',
          userId: 'user_a',
          avatar: 'https://cdn.footebas.com.br/avatars/user_a.png',
          season: 2,
          recordedAt: '2026-10-05T10:00:00.000Z',
        }),
        // A newer row without avatar does not erase the known one.
        entry({
          careerId: 'career_a1',
          userId: 'user_a',
          season: 3,
          recordedAt: '2026-10-06T10:00:00.000Z',
        }),
        entry({
          careerId: 'career_a2',
          userId: 'user_a',
          avatar: 'avatar-09',
          points: 20,
        }),
        entry({ careerId: 'career_b', userId: 'user_b' }),
      ],
      'general',
    );
    expect(rows).toEqual([
      expect.objectContaining({
        careerId: 'career_a1',
        avatar: 'https://cdn.footebas.com.br/avatars/user_a.png',
        points: 110,
      }),
      expect.objectContaining({ careerId: 'career_b' }),
    ]);
    expect(rows[1]).not.toHaveProperty('avatar');
  });

  it('keeps the most recent avatar whatever the order of the entries', () => {
    const [row] = aggregateRanking(
      [
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          season: 3,
          recordedAt: '2026-10-06T10:00:00.000Z',
        }),
        entry({ careerId: 'career_a', userId: 'user_a', avatar: 'avatar-01' }),
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          avatar: 'avatar-07',
          season: 2,
          recordedAt: '2026-10-05T10:00:00.000Z',
        }),
      ],
      'general',
    );
    expect(row).toMatchObject({ avatar: 'avatar-07', points: 15 });
  });
});

describe('ranking-v2 scopes (ADR 0017)', () => {
  it('has five scopes and a new rules version', () => {
    expect(RANKING_RULES_VERSION).toBe('ranking-v2');
    expect(RANKING_SCOPES).toEqual([
      'general',
      'titles',
      'best_season',
      'rise',
      'monthly',
    ]);
  });

  it('ranks titles by count, then points, then who got there first, then id', () => {
    const rows = aggregateRanking(
      [
        // user_a: two titles (state + cup), 95 points.
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          type: 'state_title',
          points: 25,
        }),
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          type: 'cup_title',
          points: 70,
          competitionId: 'cup',
        }),
        // user_b: one Serie A title, more points but fewer titles.
        entry({
          careerId: 'career_b',
          userId: 'user_b',
          type: 'league_title',
          points: 100,
        }),
        entry({
          careerId: 'career_b',
          userId: 'user_b',
          type: 'promotion',
          points: 45,
          competitionId: 'b',
        }),
        // user_c: two titles like user_a and the same points, but later.
        entry({
          careerId: 'career_c',
          userId: 'user_c',
          type: 'state_title',
          points: 25,
        }),
        entry({
          careerId: 'career_c',
          userId: 'user_c',
          type: 'cup_title',
          points: 70,
          competitionId: 'cup',
          recordedAt: '2026-10-03T10:00:00.000Z',
        }),
        // user_d: same as user_a (titles, points, instant): id decides.
        entry({
          careerId: 'career_d',
          userId: 'user_d',
          type: 'state_title',
          points: 25,
        }),
        entry({
          careerId: 'career_d',
          userId: 'user_d',
          type: 'cup_title',
          points: 70,
          competitionId: 'cup',
        }),
        // user_e: no title, only points; still ranked, after every title.
        entry({ careerId: 'career_e', userId: 'user_e', points: 5 }),
      ],
      'titles',
    );
    expect(
      rows.map(({ userId, titles, points }) => [userId, titles, points]),
    ).toEqual([
      ['user_a', 2, 95],
      ['user_d', 2, 95],
      ['user_c', 2, 95],
      ['user_b', 1, 145],
      ['user_e', 0, 5],
    ]);
    expect(rows.map(({ position }) => position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the best career of the user in titles, even with fewer points', () => {
    const rows = aggregateRanking(
      [
        entry({
          careerId: 'career_rich',
          userId: 'user_a',
          type: 'continental_title',
          points: 180,
        }),
        entry({
          careerId: 'career_many',
          userId: 'user_a',
          type: 'state_title',
          points: 25,
        }),
        entry({
          careerId: 'career_many',
          userId: 'user_a',
          type: 'state_title',
          points: 25,
          season: 2,
        }),
      ],
      'titles',
    );
    expect(rows).toEqual([
      expect.objectContaining({
        careerId: 'career_many',
        titles: 2,
        points: 50,
      }),
    ]);
  });

  it('ranks the best single season of the best career; older season wins a tie', () => {
    const rows = aggregateRanking(
      [
        // user_a: season 1 = 105, season 2 = 30 -> best is season 1.
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          type: 'league_title',
          points: 100,
        }),
        entry({ careerId: 'career_a', userId: 'user_a', points: 5 }),
        entry({
          careerId: 'career_a',
          userId: 'user_a',
          season: 2,
          points: 30,
        }),
        // user_b: 105 in season 3, recorded earlier than user_a.
        entry({
          careerId: 'career_b',
          userId: 'user_b',
          season: 3,
          points: 105,
          recordedAt: '2026-09-01T10:00:00.000Z',
        }),
        // user_c: 105 in season 2 of a career and in season 1 of another.
        entry({
          careerId: 'career_c1',
          userId: 'user_c',
          season: 2,
          points: 105,
        }),
        entry({
          careerId: 'career_c2',
          userId: 'user_c',
          season: 1,
          points: 105,
          recordedAt: '2026-10-09T10:00:00.000Z',
        }),
        // Rise points never count here.
        entry({
          careerId: 'career_d',
          userId: 'user_d',
          points: 0,
          risePoints: 300,
        }),
      ],
      'best_season',
    );
    expect(
      rows.map(({ userId, careerId, season, points }) => [
        userId,
        careerId,
        season,
        points,
      ]),
    ).toEqual([
      ['user_a', 'career_a', 1, 105],
      ['user_c', 'career_c2', 1, 105],
      ['user_b', 'career_b', 3, 105],
    ]);
  });

  it('builds every total of a user for the transaction of an achievement', () => {
    const ledger = [
      entry({
        careerId: 'career_a',
        userId: 'user_a',
        type: 'state_title',
        points: 25,
        risePoints: 50,
        recordedAt: '2026-09-20T10:00:00.000Z',
      }),
      entry({
        careerId: 'career_a',
        userId: 'user_a',
        points: 5,
        recordedAt: '2026-10-02T10:00:00.000Z',
      }),
    ];
    const all = userRankingEntries(ledger);
    expect(
      all.map(({ scope, period, points, titles, season }) => [
        scope,
        period,
        points,
        titles,
        season,
      ]),
    ).toEqual([
      ['general', 'all', 30, 0, 0],
      ['titles', 'all', 30, 1, 0],
      ['best_season', 'all', 30, 0, 1],
      ['rise', 'all', 50, 0, 0],
      ['monthly', '2026-09', 25, 0, 0],
      ['monthly', '2026-10', 5, 0, 0],
    ]);
    expect(all[0]).toMatchObject({ reachedAt: '2026-10-02T10:00:00.000Z' });
    // Only the months asked for (past months never change).
    expect(
      userRankingEntries(ledger, ['2026-10']).map(
        ({ scope, period }) => `${scope}:${period}`,
      ),
    ).toEqual([
      'general:all',
      'titles:all',
      'best_season:all',
      'rise:all',
      'monthly:2026-10',
    ]);
  });

  it('puts every account in the standings: points first, then zeros by sign-up', () => {
    const rows = aggregateRanking(
      [entry({ careerId: 'career_b', userId: 'user_b', points: 45 })],
      'general',
    );
    const standings = rankingStandings(rows, [
      {
        userId: 'user_late',
        joinedAt: '2026-10-05T00:00:00.000Z',
        careerId: 'career_late',
        displayName: 'Late',
        avatar: 'avatar-02',
      },
      { userId: 'user_nocareer', joinedAt: '2026-10-01T00:00:00.000Z' },
      {
        userId: 'user_b',
        joinedAt: '2026-10-09T00:00:00.000Z',
        careerId: 'career_b',
        displayName: 'B',
      },
      {
        userId: 'user_early',
        joinedAt: '2026-10-01T00:00:00.000Z',
        careerId: 'career_early',
        displayName: 'Early',
      },
    ]);
    expect(standings).toEqual([
      {
        position: 1,
        userId: 'user_b',
        careerId: 'career_b',
        displayName: 'career_b',
        points: 45,
        titles: 0,
        season: 0,
      },
      {
        position: 2,
        userId: 'user_early',
        careerId: 'career_early',
        displayName: 'Early',
        points: 0,
        titles: 0,
        season: 0,
      },
      // Counted (position and total) but without career: never listed.
      { position: 3, userId: 'user_nocareer', points: 0, titles: 0, season: 0 },
      {
        position: 4,
        userId: 'user_late',
        careerId: 'career_late',
        displayName: 'Late',
        avatar: 'avatar-02',
        points: 0,
        titles: 0,
        season: 0,
      },
    ]);
  });
});
