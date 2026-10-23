import { describe, expect, it } from 'vitest';
import {
  aggregateRanking,
  rankingPoints,
  risePoints,
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

describe('ranking-v1 points', () => {
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
      'global',
    );
    expect(rows).toEqual([
      {
        position: 1,
        userId: 'user_c',
        careerId: 'career_c',
        displayName: 'career_c',
        points: 175,
      },
      // user_a: best career (100) beats the other one (75); not summed.
      {
        position: 2,
        userId: 'user_a',
        careerId: 'career_a1',
        displayName: 'career_a1',
        points: 100,
      },
      {
        position: 3,
        userId: 'user_b',
        careerId: 'career_b',
        displayName: 'career_b',
        points: 100,
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
      'global',
    );
    expect(row).toMatchObject({ displayName: 'New', points: 10 });
  });
});
