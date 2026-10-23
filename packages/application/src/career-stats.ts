/* eslint-disable @typescript-eslint/no-non-null-assertion -- ids come from the same aggregate */
import type { CareerSeasonReadModel } from '@footebas/contracts';
import type {
  CompetitionCalendarFixture,
  CompetitionDefinition,
  MatchResult,
  Player,
} from '@footebas/domain';
import type { CareerSeasonState } from '@footebas/engine';

/**
 * Season statistics (Temporada, docs/09) kept in the career save. Only what
 * cannot be derived later is stored: each player's season line (from the
 * engine's performances) and the managed club's position after each league
 * round. Closed seasons keep a small archive with names resolved, because
 * retired players leave the save.
 */
export const STATS_RULES_VERSION = 'career-stats-v1' as const;
const KEPT_ARCHIVED_SEASONS = 30;
const LEADERS = 10;
const ARCHIVED_LEADERS = 5;

export interface PlayerSeasonLine {
  clubId: string;
  appearances: number;
  goals: number;
  assists: number;
  /** Sum of match ratings, one decimal. */
  ratingTotal: number;
}

export interface RoundPosition {
  round: number;
  date: string;
  position: number;
}

type Leader = CareerSeasonReadModel['topScorers'][number];
type ClubRecord = NonNullable<CareerSeasonReadModel['club']>;
type Positions = CareerSeasonReadModel['positions'][number];
type Champion = CareerSeasonReadModel['champions'][number];
type Award = CareerSeasonReadModel['awards'][number];

export interface SeasonArchive {
  season: number;
  year: number;
  club?: ClubRecord;
  champions: Champion[];
  awards: Award[];
  topScorers: Leader[];
  positions: Positions[];
}

export interface CareerStatsState {
  version: typeof STATS_RULES_VERSION;
  season: number;
  /** False when recording began after the season had started. */
  complete: boolean;
  players: Record<string, PlayerSeasonLine>;
  /** Managed club league positions by competition id. */
  positions: Record<string, RoundPosition[]>;
  archive: SeasonArchive[];
}

/**
 * Stats of the save, created on first write. Season 1 is seeded exactly from
 * career totals (they start at zero with the career); later seasons of saves
 * created before this version start recording from now on.
 */
export function ensureStats(
  stats: CareerStatsState | undefined,
  season: number,
  players: readonly Player[],
  playedFixtures: number,
): CareerStatsState {
  if (stats !== undefined) return stats;
  const seeded: Record<string, PlayerSeasonLine> = {};
  if (season === 1)
    for (const player of players)
      if (player.careerStats.appearances > 0 && player.clubId !== undefined)
        seeded[player.id] = {
          clubId: player.clubId,
          appearances: player.careerStats.appearances,
          goals: player.careerStats.goals,
          assists: player.careerStats.assists,
          ratingTotal: player.careerStats.ratingTotal ?? 0,
        };
  return {
    version: STATS_RULES_VERSION,
    season,
    // Positions by round cannot be rebuilt, so a late start is partial.
    complete: playedFixtures === 0,
    players: seeded,
    positions: {},
    archive: [],
  };
}

/** Adds one match's performances to the players' season lines. */
export function recordMatchStats(
  stats: CareerStatsState,
  fixture: CompetitionCalendarFixture,
  result: MatchResult,
): void {
  for (const performance of result.playerPerformances ?? []) {
    const clubId =
      performance.side === 'home' ? fixture.homeClubId : fixture.awayClubId;
    const line = stats.players[performance.playerId] ?? {
      clubId,
      appearances: 0,
      goals: 0,
      assists: 0,
      ratingTotal: 0,
    };
    stats.players[performance.playerId] = {
      clubId,
      appearances: line.appearances + 1,
      goals: line.goals + performance.goals,
      assists: line.assists + performance.assists,
      ratingTotal: Number((line.ratingTotal + performance.rating).toFixed(1)),
    };
  }
}

/** Managed club position after a league round (one entry per round). */
export function recordRoundPosition(
  stats: CareerStatsState,
  competitionId: string,
  entry: RoundPosition,
): void {
  const rounds = (stats.positions[competitionId] ?? []).filter(
    ({ round }) => round !== entry.round,
  );
  stats.positions[competitionId] = [...rounds, entry];
}

export interface StatsNames {
  readonly clubs: ReadonlyMap<string, string>;
  readonly players: ReadonlyMap<string, string>;
  readonly competitions: ReadonlyMap<string, string>;
}

const clubRef = (names: StatsNames, id: string | undefined) => {
  const name = id === undefined ? undefined : names.clubs.get(id);
  return id === undefined || name === undefined ? undefined : { id, name };
};

/** Minimum appearances to rank by average rating. */
export function minimumRatedAppearances(stats: CareerStatsState): number {
  const most = Math.max(
    0,
    ...Object.values(stats.players).map(({ appearances }) => appearances),
  );
  return Math.max(3, Math.floor(most / 3));
}

function leaders(
  stats: CareerStatsState,
  names: StatsNames,
  metric: 'goals' | 'assists' | 'rating',
  limit: number,
): Leader[] {
  const minimum = minimumRatedAppearances(stats);
  return Object.entries(stats.players)
    .map(([playerId, line]) => ({
      playerId,
      line,
      value:
        metric === 'rating'
          ? line.appearances >= minimum
            ? Number((line.ratingTotal / line.appearances).toFixed(2))
            : 0
          : line[metric],
    }))
    .filter(({ value, playerId }) => value > 0 && names.players.has(playerId))
    .sort(
      (left, right) =>
        right.value - left.value ||
        left.line.appearances - right.line.appearances ||
        left.playerId.localeCompare(right.playerId),
    )
    .slice(0, limit)
    .map(({ playerId, line, value }) => {
      const club = clubRef(names, line.clubId);
      return {
        playerId,
        playerName: names.players.get(playerId)!,
        ...(club === undefined ? {} : { club }),
        appearances: line.appearances,
        value,
      };
    });
}

function awardsOf(
  scorers: readonly Leader[],
  assists: readonly Leader[],
  ratings: readonly Leader[],
): Award[] {
  const award = (kind: Award['kind'], leader: Leader | undefined) =>
    leader === undefined
      ? []
      : [
          {
            kind,
            playerId: leader.playerId,
            playerName: leader.playerName,
            ...(leader.club === undefined ? {} : { club: leader.club }),
            value: leader.value,
          },
        ];
  return [
    ...award('top_scorer', scorers[0]),
    ...award('top_assists', assists[0]),
    ...award('best_rating', ratings[0]),
  ];
}

/** Managed club record in every competition of the season. */
export function clubRecord(
  competition: CareerSeasonState,
  clubId: string,
  names: StatsNames,
): ClubRecord | undefined {
  const club = clubRef(names, clubId);
  if (club === undefined) return undefined;
  const record = {
    club,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
  };
  for (const fixture of competition.fixtures) {
    const result = competition.results[fixture.id];
    if (result === undefined) continue;
    const home = fixture.homeClubId === clubId;
    if (!home && fixture.awayClubId !== clubId) continue;
    const goalsFor = home ? result.homeGoals : result.awayGoals;
    const goalsAgainst = home ? result.awayGoals : result.homeGoals;
    record.played += 1;
    record.goalsFor += goalsFor;
    record.goalsAgainst += goalsAgainst;
    if (goalsFor > goalsAgainst) record.won += 1;
    else if (goalsFor < goalsAgainst) record.lost += 1;
    else record.drawn += 1;
  }
  record.goalDifference = record.goalsFor - record.goalsAgainst;
  return record;
}

function positionsOf(stats: CareerStatsState, names: StatsNames): Positions[] {
  return Object.entries(stats.positions)
    .map(([competitionId, rounds]) => ({
      competitionId,
      competition: names.competitions.get(competitionId) ?? competitionId,
      rounds: [...rounds].sort((left, right) => left.round - right.round),
    }))
    .sort((left, right) =>
      left.competitionId.localeCompare(right.competitionId),
    )
    .slice(0, 8);
}

function championsOf(
  champions: readonly {
    competitionId: string;
    championId: string;
    decidedOn?: string;
  }[],
  names: StatsNames,
): Champion[] {
  return champions.flatMap(({ competitionId, championId, decidedOn }) => {
    const club = clubRef(names, championId);
    return club === undefined
      ? []
      : [
          {
            competitionId,
            competition: names.competitions.get(competitionId) ?? competitionId,
            club,
            ...(decidedOn === undefined ? {} : { decidedOn }),
          },
        ];
  });
}

/**
 * Champions already decided in the current season: only competitions whose
 * last match was played (an outcome exists), with the deciding date.
 */
export function currentChampions(
  competition: CareerSeasonState,
): { competitionId: string; championId: string; decidedOn?: string }[] {
  return competition.competitions.flatMap((item) => {
    if (item.outcome === undefined) return [];
    const decidedOn = competition.fixtures
      .filter(
        ({ id, competitionId }) =>
          competitionId === item.competitionId &&
          competition.results[id] !== undefined,
      )
      .map(({ date }) => date)
      .sort()
      .at(-1);
    return [
      {
        competitionId: item.competitionId,
        championId: item.outcome.championId,
        ...(decidedOn === undefined ? {} : { decidedOn }),
      },
    ];
  });
}

export interface SeasonProjectionInput {
  readonly stats: CareerStatsState | undefined;
  readonly competition: CareerSeasonState;
  readonly managedClubId?: string;
  readonly names: StatsNames;
}

/** Body of the season read model (without the read envelope). */
export function projectSeason(input: SeasonProjectionInput) {
  const stats =
    input.stats ??
    ensureStats(
      undefined,
      input.competition.season,
      [],
      Number.MAX_SAFE_INTEGER,
    );
  const topScorers = leaders(stats, input.names, 'goals', LEADERS);
  const topAssists = leaders(stats, input.names, 'assists', LEADERS);
  const topRatings = leaders(stats, input.names, 'rating', LEADERS);
  const club =
    input.managedClubId === undefined
      ? undefined
      : clubRecord(input.competition, input.managedClubId, input.names);
  return {
    rulesVersion: STATS_RULES_VERSION,
    season: input.competition.season,
    year: input.competition.year,
    coverage:
      input.stats?.complete === true &&
      input.stats.season === input.competition.season
        ? ('complete' as const)
        : ('partial' as const),
    ...(club === undefined ? {} : { club }),
    topScorers,
    topAssists,
    topRatings,
    minimumRatedAppearances: minimumRatedAppearances(stats),
    positions: positionsOf(stats, input.names),
    champions: championsOf(currentChampions(input.competition), input.names),
    awards: awardsOf(topScorers, topAssists, topRatings),
    history: [...stats.archive].reverse(),
  };
}

export interface SeasonCloseInput {
  readonly competition: CareerSeasonState;
  readonly managedClubId?: string;
  readonly champions: readonly { competitionId: string; championId: string }[];
  readonly names: StatsNames;
}

/**
 * Archives the closing season (names resolved now, before retirements) and
 * starts an empty one for `nextSeason`.
 */
export function closeSeasonStats(
  stats: CareerStatsState,
  input: SeasonCloseInput,
  nextSeason: number,
): CareerStatsState {
  const topScorers = leaders(stats, input.names, 'goals', ARCHIVED_LEADERS);
  const awards = awardsOf(
    topScorers,
    leaders(stats, input.names, 'assists', 1),
    leaders(stats, input.names, 'rating', 1),
  );
  const club =
    input.managedClubId === undefined
      ? undefined
      : clubRecord(input.competition, input.managedClubId, input.names);
  const archived: SeasonArchive = {
    season: input.competition.season,
    year: input.competition.year,
    ...(club === undefined ? {} : { club }),
    champions: championsOf(input.champions, input.names),
    awards,
    topScorers,
    positions: positionsOf(stats, input.names),
  };
  return {
    version: STATS_RULES_VERSION,
    season: nextSeason,
    complete: true,
    players: {},
    positions: {},
    archive: [...stats.archive, archived].slice(-KEPT_ARCHIVED_SEASONS),
  };
}

/** League tiers whose standings feed the position-by-round chart. */
export const LEAGUE_TIERS: ReadonlySet<CompetitionDefinition['tier']> = new Set(
  ['national_league', 'state'],
);
