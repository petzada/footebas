/* eslint-disable @typescript-eslint/no-non-null-assertion -- validated league cardinality and map membership */
import {
  createFixture,
  entityId,
  type ClubId,
  type CompetitionId,
  type Fixture,
  type FixtureId,
  type GameDate,
  type MatchResult,
} from '@footebas/domain';

export type TieBreaker =
  'points' | 'wins' | 'goalDifference' | 'goalsFor' | 'headToHead' | 'clubId';

export interface LeagueRules {
  readonly pointsForWin: number;
  readonly pointsForDraw: number;
  readonly pointsForLoss: number;
  readonly tieBreakers: readonly TieBreaker[];
}

export interface LeagueRow {
  readonly clubId: ClubId;
  readonly played: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly goalDifference: number;
  readonly points: number;
}

const DEFAULT_RULES: LeagueRules = Object.freeze({
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tieBreakers: Object.freeze<TieBreaker[]>([
    'points',
    'wins',
    'goalDifference',
    'goalsFor',
    'headToHead',
    'clubId',
  ]),
});

interface AppliedMatch {
  readonly fixtureId: FixtureId;
  readonly homeClubId: ClubId;
  readonly awayClubId: ClubId;
  readonly homeGoals: number;
  readonly awayGoals: number;
}

function validateClubs(clubIds: readonly ClubId[]): void {
  if (clubIds.length < 2 || clubIds.length % 2 !== 0)
    throw new Error('A league requires an even number of at least two clubs');
  if (new Set(clubIds).size !== clubIds.length)
    throw new Error('League club IDs must be unique');
}

export function generateDoubleRoundRobin(
  competitionId: CompetitionId,
  clubIds: readonly ClubId[],
  firstRoundDate: GameDate,
  daysBetweenRounds = 7,
): readonly Fixture[] {
  validateClubs(clubIds);
  if (!Number.isSafeInteger(daysBetweenRounds) || daysBetweenRounds < 1)
    throw new Error('daysBetweenRounds must be a positive safe integer');

  const rotating = [...clubIds];
  const firstLeg: Fixture[] = [];
  const roundsPerLeg = rotating.length - 1;
  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    for (
      let matchIndex = 0;
      matchIndex < rotating.length / 2;
      matchIndex += 1
    ) {
      const left = rotating[matchIndex]!;
      const right = rotating[rotating.length - 1 - matchIndex]!;
      // Alternating the fixed club avoids a systematic venue run.
      const [homeClubId, awayClubId] =
        matchIndex === 0 && roundIndex % 2 === 1
          ? [right, left]
          : [left, right];
      const round = roundIndex + 1;
      firstLeg.push(
        createFixture({
          id: entityId(
            `${competitionId}_r${String(round)}_m${String(matchIndex + 1)}`,
            'fixture',
          ),
          competitionId,
          round,
          date: firstRoundDate.addDays(roundIndex * daysBetweenRounds),
          homeClubId,
          awayClubId,
          status: 'scheduled',
        }),
      );
    }
    const last = rotating.pop()!;
    rotating.splice(1, 0, last);
  }

  const secondLeg = firstLeg.map((fixture, index) => {
    const round = fixture.round + roundsPerLeg;
    return createFixture({
      id: entityId(
        `${competitionId}_r${String(round)}_m${String((index % (clubIds.length / 2)) + 1)}`,
        'fixture',
      ),
      competitionId,
      round,
      date: firstRoundDate.addDays((round - 1) * daysBetweenRounds),
      homeClubId: fixture.awayClubId,
      awayClubId: fixture.homeClubId,
      status: 'scheduled',
    });
  });
  return Object.freeze([...firstLeg, ...secondLeg]);
}

function emptyRow(clubId: ClubId): LeagueRow {
  return Object.freeze({
    clubId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  });
}

export class LeagueTable {
  readonly #clubIds: readonly ClubId[];
  readonly #rules: LeagueRules;
  readonly #matches: readonly AppliedMatch[];

  public constructor(
    clubIds: readonly ClubId[],
    rules: LeagueRules = DEFAULT_RULES,
    matches: readonly AppliedMatch[] = [],
  ) {
    validateClubs(clubIds);
    if (new Set(rules.tieBreakers).size !== rules.tieBreakers.length)
      throw new Error('Tie breakers must be unique');
    for (const points of [
      rules.pointsForWin,
      rules.pointsForDraw,
      rules.pointsForLoss,
    ])
      if (!Number.isSafeInteger(points) || points < 0)
        throw new Error('League points must be non-negative safe integers');
    this.#clubIds = Object.freeze([...clubIds]);
    this.#rules = Object.freeze({
      ...rules,
      tieBreakers: Object.freeze([...rules.tieBreakers]),
    });
    this.#matches = Object.freeze(
      matches.map((match) => Object.freeze({ ...match })),
    );
    Object.freeze(this);
  }

  public apply(fixture: Fixture, result: MatchResult): LeagueTable {
    if (fixture.id !== result.fixtureId)
      throw new Error('Fixture and match result IDs differ');
    if (
      !this.#clubIds.includes(fixture.homeClubId) ||
      !this.#clubIds.includes(fixture.awayClubId)
    )
      throw new Error('Fixture contains a club outside this league');
    const existing = this.#matches.find(
      ({ fixtureId }) => fixtureId === fixture.id,
    );
    if (existing !== undefined) {
      if (
        existing.homeClubId !== fixture.homeClubId ||
        existing.awayClubId !== fixture.awayClubId ||
        existing.homeGoals !== result.homeGoals ||
        existing.awayGoals !== result.awayGoals
      )
        throw new Error(
          `Conflicting duplicate result for fixture ${fixture.id}`,
        );
      return this;
    }
    return new LeagueTable(this.#clubIds, this.#rules, [
      ...this.#matches,
      {
        fixtureId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      },
    ]);
  }

  public get playedFixtureIds(): readonly FixtureId[] {
    return Object.freeze(this.#matches.map(({ fixtureId }) => fixtureId));
  }

  public get standings(): readonly LeagueRow[] {
    const rows = new Map(
      this.#clubIds.map((clubId) => [clubId, { ...emptyRow(clubId) }]),
    );
    for (const match of this.#matches) {
      const home = rows.get(match.homeClubId)!;
      const away = rows.get(match.awayClubId)!;
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeGoals;
      home.goalsAgainst += match.awayGoals;
      away.goalsFor += match.awayGoals;
      away.goalsAgainst += match.homeGoals;
      if (match.homeGoals > match.awayGoals) {
        home.wins += 1;
        away.losses += 1;
        home.points += this.#rules.pointsForWin;
        away.points += this.#rules.pointsForLoss;
      } else if (match.homeGoals < match.awayGoals) {
        away.wins += 1;
        home.losses += 1;
        away.points += this.#rules.pointsForWin;
        home.points += this.#rules.pointsForLoss;
      } else {
        home.draws += 1;
        away.draws += 1;
        home.points += this.#rules.pointsForDraw;
        away.points += this.#rules.pointsForDraw;
      }
    }
    const materialized = [...rows.values()].map((row) =>
      Object.freeze({
        ...row,
        goalDifference: row.goalsFor - row.goalsAgainst,
      }),
    );
    return Object.freeze(
      materialized.sort((left, right) => this.#compare(left, right)),
    );
  }

  public get champion(): ClubId | undefined {
    return this.#matches.length ===
      this.#clubIds.length * (this.#clubIds.length - 1)
      ? this.standings[0]?.clubId
      : undefined;
  }

  #headToHead(left: ClubId, right: ClubId): number {
    let balance = 0;
    for (const match of this.#matches) {
      if (match.homeClubId === left && match.awayClubId === right)
        balance +=
          match.homeGoals > match.awayGoals
            ? 3
            : match.homeGoals === match.awayGoals
              ? 1
              : 0;
      if (match.homeClubId === right && match.awayClubId === left)
        balance -=
          match.homeGoals > match.awayGoals
            ? 3
            : match.homeGoals === match.awayGoals
              ? 1
              : 0;
    }
    return balance;
  }

  #compareCriterion(
    left: LeagueRow,
    right: LeagueRow,
    criterion: TieBreaker,
  ): number {
    switch (criterion) {
      case 'points':
        return right.points - left.points;
      case 'wins':
        return right.wins - left.wins;
      case 'goalDifference':
        return right.goalDifference - left.goalDifference;
      case 'goalsFor':
        return right.goalsFor - left.goalsFor;
      case 'headToHead':
        return -this.#headToHead(left.clubId, right.clubId);
      case 'clubId':
        return left.clubId.localeCompare(right.clubId);
    }
  }

  #compare(left: LeagueRow, right: LeagueRow): number {
    for (const criterion of this.#rules.tieBreakers) {
      const difference = this.#compareCriterion(left, right, criterion);
      if (difference !== 0) return difference;
    }
    return left.clubId.localeCompare(right.clubId);
  }
}
