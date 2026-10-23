import {
  coachAvatarSchema,
  myRankingReadModelSchema,
  rankingQuerySchema,
  rankingReadModelSchema,
  type MyRankingReadModel,
  type RankingReadModel,
} from '@footebas/contracts';
import type {
  RankingStorePort,
  ValidatedAchievement,
} from '@footebas/database';
import {
  RANKING_ALL_TIME,
  RANKING_RULES_VERSION,
  RANKING_SCOPES,
  rankingMonthOf,
  rankingPoints,
  risePoints,
  type CompetitionDefinition,
  type RankedAchievementType,
  type RankingDivision,
  type RankingScope,
} from '@footebas/domain';
import { AuthenticationError, type AuthPort, type Clock } from './ports.js';

/** An achievement of the season close, before it is bound to a user. */
export type SeasonAchievement = Omit<
  ValidatedAchievement,
  'careerId' | 'userId' | 'displayName' | 'avatar' | 'recordedAt'
>;

/** Facts of the competitions that just ended, as the server simulated them. */
export interface CompetitionTitleInput {
  readonly season: number;
  /** In-game date the competitions ended (`YYYY-MM-DD`). */
  readonly gameDate: string;
  /** Club the manager led when they ended; none means no title. */
  readonly managedClubId?: string;
  readonly clubReputation: number;
  readonly outcomes: readonly { competitionId: string; championId: string }[];
  readonly definitions: readonly {
    id: string;
    tier: CompetitionDefinition['tier'];
  }[];
  readonly divisionCompetitionIds: Readonly<Record<string, string>>;
}

export interface SeasonAchievementInput extends Omit<
  CompetitionTitleInput,
  'gameDate'
> {
  readonly year: number;
  readonly promotions: readonly { clubId: string; toCompetitionId: string }[];
  /** National league the managed club played this season, if any. */
  readonly leagueCompetitionId?: string;
}

function achievementOf(
  input: CompetitionTitleInput & { managedClubId: string },
  type: RankedAchievementType,
  competitionId: string,
): SeasonAchievement {
  const division = (
    Object.entries(input.divisionCompetitionIds) as [RankingDivision, string][]
  ).find(([, id]) => id === competitionId)?.[0];
  const points = rankingPoints(type, division);
  return {
    type,
    season: input.season,
    competitionId,
    clubId: input.managedClubId,
    clubReputation: input.clubReputation,
    gameDate: input.gameDate,
    points,
    risePoints: risePoints(type, points, input.clubReputation),
    rulesVersion: RANKING_RULES_VERSION,
  };
}

/**
 * Titles of the managed club among competitions that just ended (ADR 0017):
 * a title counts when the competition ends, in the commit of the round that
 * ended it, not at the season close.
 */
export function titleAchievements(
  input: CompetitionTitleInput,
): SeasonAchievement[] {
  const clubId = input.managedClubId;
  if (clubId === undefined) return [];
  return input.outcomes
    .filter(({ championId }) => championId === clubId)
    .flatMap(({ competitionId }) => {
      const tier = input.definitions.find(
        ({ id }) => id === competitionId,
      )?.tier;
      if (tier === undefined) return [];
      const type: RankedAchievementType =
        tier === 'national_league'
          ? 'league_title'
          : tier === 'continental'
            ? 'continental_title'
            : tier === 'national_cup'
              ? 'cup_title'
              : 'state_title';
      return [
        achievementOf({ ...input, managedClubId: clubId }, type, competitionId),
      ];
    });
}

/**
 * Achievements the server validates at a season close (ADR 0013, ADR 0017):
 * promotion and the completed season of the managed club, plus every title of
 * the season again. Titles are recorded when each competition ends; the
 * ledger's unique key (career, type, season, competition) makes the repeat a
 * no-op and still records titles of careers that were mid-season when titles
 * started to count at the end of the competition.
 */
export function seasonAchievements(
  input: SeasonAchievementInput,
): SeasonAchievement[] {
  const clubId = input.managedClubId;
  if (clubId === undefined) return [];
  const atClose = {
    ...input,
    managedClubId: clubId,
    gameDate: `${String(input.year)}-12-31`,
  };
  const promotions = input.promotions
    .filter((promotion) => promotion.clubId === clubId)
    .map(({ toCompetitionId }) =>
      achievementOf(atClose, 'promotion', toCompetitionId),
    );
  return [
    ...titleAchievements(atClose),
    ...promotions,
    achievementOf(atClose, 'season_completed', input.leagueCompetitionId ?? ''),
  ];
}

/** Achievements once per type, season and competition (the first wins). */
export function uniqueAchievements<
  T extends Pick<SeasonAchievement, 'type' | 'season' | 'competitionId'>,
>(achievements: readonly T[]): T[] {
  const seen = new Set<string>();
  return achievements.filter(({ type, season, competitionId }) => {
    const key = `${type}|${String(season)}|${competitionId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Avatar of a ranking row, only when it still satisfies the profile
 * contract: a stale or unexpected value drops the avatar (the screen falls
 * back to a pixel one) instead of failing the whole leaderboard.
 */
const rowAvatar = (avatar: string | undefined) =>
  avatar !== undefined && coachAvatarSchema.safeParse(avatar).success
    ? { avatar }
    : {};

/** Measure fields of a row: titles and season only where they rank. */
const measure = (
  scope: RankingScope,
  row: { points: number; titles: number; season: number },
) => ({
  points: row.points,
  ...(scope === 'titles' ? { titles: row.titles } : {}),
  ...(scope === 'best_season' && row.season > 0 ? { season: row.season } : {}),
});

/** Period of a scope at an instant (`all`, or the current month). */
export function rankingPeriodOf(scope: RankingScope, now: Date): string {
  return scope === 'monthly'
    ? rankingMonthOf(now.toISOString())
    : RANKING_ALL_TIME;
}

/** Month before the one of `now`, as `YYYY-MM` (UTC). */
const previousMonth = (now: Date) =>
  rankingMonthOf(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    ).toISOString(),
  );

export interface RankingServiceDependencies {
  readonly store: RankingStorePort;
  readonly clock: Clock;
  readonly auth?: AuthPort;
}

export interface RankingMaintenance {
  readonly ranAt: string;
  /** Month closed into the history on day 1, when it was still open. */
  readonly closedMonth?: { readonly period: string; readonly rows: number };
  /** Accounts whose totals were rebuilt (flagged by the migration). */
  readonly refreshed: number;
}

/** Accounts rebuilt per cron run (ADR 0017 backfill). */
export const RANKING_REFRESH_BATCH = 100;

/**
 * Leaderboards (ADR 0017): totals are written with each achievement, reads
 * are live (ordered by index) and the user's position is computed on read.
 */
export class RankingService {
  public constructor(private readonly deps: RankingServiceDependencies) {}

  /**
   * Scheduled job (Cron Trigger): on the first day of a month it closes the
   * previous month into the history; it also rebuilds the accounts flagged
   * by the migration. It never aggregates the whole ledger.
   */
  public async maintain(): Promise<RankingMaintenance> {
    const now = this.deps.clock.now();
    const ranAt = now.toISOString();
    let closedMonth: RankingMaintenance['closedMonth'];
    if (now.getUTCDate() === 1) {
      const period = previousMonth(now);
      const rows = await this.deps.store.closeMonth(period, ranAt);
      if (rows !== undefined) closedMonth = { period, rows };
    }
    const refreshed = await this.deps.store.refreshPending(
      RANKING_REFRESH_BATCH,
    );
    return {
      ranAt,
      ...(closedMonth === undefined ? {} : { closedMonth }),
      refreshed,
    };
  }

  /** Public leaderboard, live (`GET /v1/rankings`). */
  public async leaderboard(rawQuery: unknown): Promise<RankingReadModel> {
    const query = rankingQuerySchema.parse(rawQuery);
    const now = this.deps.clock.now();
    // `global` is the former name of `general` (older clients).
    const scope: RankingScope =
      query.scope === 'global' ? 'general' : query.scope;
    const period =
      scope === 'monthly'
        ? (query.period ?? rankingPeriodOf('monthly', now))
        : RANKING_ALL_TIME;
    const board = await this.deps.store.board(scope, period, query.limit);
    return rankingReadModelSchema.parse({
      version: 1,
      rulesVersion: RANKING_RULES_VERSION,
      scope: query.scope,
      period,
      generatedAt: now.toISOString(),
      total: board.total,
      rows: board.rows.map((row) => ({
        position: row.position,
        displayName: row.displayName,
        ...rowAvatar(row.avatar),
        ...measure(scope, row),
      })),
    });
  }

  /**
   * The caller's position and the number of participants in each scope
   * (`GET /v1/rankings/me`), computed on read. Every account has one, with
   * zero points until its first achievement.
   */
  public async mine(bearer: string): Promise<MyRankingReadModel> {
    if (this.deps.auth === undefined)
      throw new AuthenticationError('rankings require authentication');
    const { userId } = await this.deps.auth.authenticate(bearer);
    const now = this.deps.clock.now();
    const targets = RANKING_SCOPES.map((scope) => ({
      scope,
      period: rankingPeriodOf(scope, now),
    }));
    const positions = await this.deps.store.positionsOf(userId, targets);
    const entries = targets.map(({ scope, period }) => {
      const row = positions.find(
        (item) => item.scope === scope && item.period === period,
      );
      return {
        scope,
        period,
        total: row?.total ?? 0,
        ...(row?.position === undefined ? {} : { position: row.position }),
        ...measure(scope, row ?? { points: 0, titles: 0, season: 0 }),
        ...(row?.displayName === undefined
          ? {}
          : { displayName: row.displayName }),
        ...rowAvatar(row?.avatar),
      };
    });
    const general = entries.find(({ scope }) => scope === 'general');
    return myRankingReadModelSchema.parse({
      version: 1,
      rulesVersion: RANKING_RULES_VERSION,
      // PROVISIONAL (ADR 0017): `global` repeats `general` for web clients
      // cached before the rename; remove it in the next cycle.
      entries: [
        ...entries,
        ...(general === undefined ? [] : [{ ...general, scope: 'global' }]),
      ],
    });
  }
}
