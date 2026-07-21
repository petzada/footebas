/* eslint-disable @typescript-eslint/no-non-null-assertion -- generated fixture cardinalities are asserted */
import {
  GameDate,
  entityId,
  type ClubId,
  type Fixture,
  type MatchResult,
} from '@footebas/domain';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateDoubleRoundRobin, LeagueTable } from './league.js';

const competitionId = entityId('competition_test', 'competition');
const clubs = (count: number): ClubId[] =>
  Array.from({ length: count }, (_, index) =>
    entityId(`club_${String(index + 1)}`, 'club'),
  );

function result(
  fixture: Fixture,
  homeGoals: number,
  awayGoals: number,
): MatchResult {
  return {
    fixtureId: fixture.id,
    matchId: entityId(`match_${fixture.id}`, 'match'),
    homeGoals,
    awayGoals,
    home: {
      shots: 0,
      shotsOnTarget: 0,
      possession: 50,
      yellowCards: 0,
      redCards: 0,
      xg: 0,
    },
    away: {
      shots: 0,
      shotsOnTarget: 0,
      possession: 50,
      yellowCards: 0,
      redCards: 0,
      xg: 0,
    },
    timeline: [],
    seed: 'test',
    engineVersion: 'test',
  };
}

describe('double round-robin calendar', () => {
  it('keeps the eight-club golden shape of 14 rounds and four games', () => {
    const fixtures = generateDoubleRoundRobin(
      competitionId,
      clubs(8),
      GameDate.parse('2026-01-03'),
    );
    expect(fixtures).toHaveLength(56);
    expect([...new Set(fixtures.map(({ round }) => round))]).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1),
    );
    expect(
      Array.from(
        { length: 14 },
        (_, index) =>
          fixtures.filter(({ round }) => round === index + 1).length,
      ),
    ).toEqual(Array.from({ length: 14 }, () => 4));
    expect(
      fixtures
        .slice(0, 4)
        .map(({ homeClubId, awayClubId }) => [homeClubId, awayClubId]),
    ).toMatchInlineSnapshot(`
      [
        [
          "club_1",
          "club_8",
        ],
        [
          "club_2",
          "club_7",
        ],
        [
          "club_3",
          "club_6",
        ],
        [
          "club_4",
          "club_5",
        ],
      ]
    `);
  });

  it('gives every pair exactly two games with inverted venues', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), (half) => {
        const clubIds = clubs(half * 2);
        const fixtures = generateDoubleRoundRobin(
          competitionId,
          clubIds,
          GameDate.parse('2026-01-01'),
        );
        expect(fixtures).toHaveLength(clubIds.length * (clubIds.length - 1));
        for (let left = 0; left < clubIds.length; left += 1)
          for (let right = left + 1; right < clubIds.length; right += 1) {
            const pair = fixtures.filter(
              ({ homeClubId, awayClubId }) =>
                (homeClubId === clubIds[left] &&
                  awayClubId === clubIds[right]) ||
                (homeClubId === clubIds[right] && awayClubId === clubIds[left]),
            );
            expect(pair).toHaveLength(2);
            expect(pair[0]!.homeClubId).toBe(pair[1]!.awayClubId);
          }
      }),
      { numRuns: 40 },
    );
  });
});

describe('LeagueTable', () => {
  it('is immutable, idempotent, and rejects conflicting duplicates', () => {
    const clubIds = clubs(4);
    const fixture = generateDoubleRoundRobin(
      competitionId,
      clubIds,
      GameDate.parse('2026-01-01'),
    )[0]!;
    const empty = new LeagueTable(clubIds);
    const applied = empty.apply(fixture, result(fixture, 2, 1));
    expect(empty.standings.every(({ played }) => played === 0)).toBe(true);
    expect(applied.apply(fixture, result(fixture, 2, 1))).toBe(applied);
    expect(() => applied.apply(fixture, result(fixture, 1, 2))).toThrow(
      /Conflicting/,
    );
    expect(Object.isFrozen(applied)).toBe(true);
  });

  it('maintains standings invariants and closes with a deterministic champion', () => {
    const clubIds = clubs(8);
    const fixtures = generateDoubleRoundRobin(
      competitionId,
      clubIds,
      GameDate.parse('2026-01-01'),
    );
    let table = new LeagueTable(clubIds);
    for (const [index, fixture] of fixtures.entries())
      table = table.apply(fixture, result(fixture, index % 3, (index * 7) % 4));
    const standings = table.standings;
    expect(standings).toHaveLength(8);
    expect(standings.every((row) => row.played === 14)).toBe(true);
    expect(standings.reduce((sum, row) => sum + row.goalsFor, 0)).toBe(
      standings.reduce((sum, row) => sum + row.goalsAgainst, 0),
    );
    expect(
      standings.every(
        (row) => row.played === row.wins + row.draws + row.losses,
      ),
    ).toBe(true);
    expect(table.champion).toBe(standings[0]!.clubId);
  });
});
