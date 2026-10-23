import {
  coachAvatarSchema,
  myRankingReadModelSchema,
  rankingQuerySchema,
  rankingReadModelSchema,
  type MyRankingReadModel,
  type RankingReadModel,
} from '@footebas/contracts';
import type {
  RankingPeriod,
  RankingStorePort,
  ValidatedAchievement,
} from '@footebas/database';
import {
  RANKING_RULES_VERSION,
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

export interface SeasonAchievementInput {
  readonly season: number;
  readonly year: number;
  /** Club the manager led when the season closed; none means no points. */
  readonly managedClubId?: string;
  readonly clubReputation: number;
  readonly outcomes: readonly { competitionId: string; championId: string }[];
  readonly definitions: readonly {
    id: string;
    tier: CompetitionDefinition['tier'];
  }[];
  readonly divisionCompetitionIds: Readonly<Record<string, string>>;
  readonly promotions: readonly { clubId: string; toCompetitionId: string }[];
  /** National league the managed club played this season, if any. */
  readonly leagueCompetitionId?: string;
}

/**
 * Achievements the server validates at a season close (ranking-v1, ADR
 * 0013): titles and promotion of the managed club and the completed season.
 * Same facts as the world's prestige achievements, with the competition so
 * each one is unique per career, type, season and competition.
 */
export function seasonAchievements(
  input: SeasonAchievementInput,
): SeasonAchievement[] {
  const clubId = input.managedClubId;
  if (clubId === undefined) return [];
  const gameDate = `${String(input.year)}-12-31`;
  const divisionOf = (competitionId: string): RankingDivision | undefined =>
    (
      Object.entries(input.divisionCompetitionIds) as [
        RankingDivision,
        string,
      ][]
    ).find(([, id]) => id === competitionId)?.[0];
  const achievement = (
    type: RankedAchievementType,
    competitionId: string,
  ): SeasonAchievement => {
    const points = rankingPoints(type, divisionOf(competitionId));
    return {
      type,
      season: input.season,
      competitionId,
      clubId,
      clubReputation: input.clubReputation,
      gameDate,
      points,
      risePoints: risePoints(type, points, input.clubReputation),
      rulesVersion: RANKING_RULES_VERSION,
    };
  };
  const titles = input.outcomes
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
      return [achievement(type, competitionId)];
    });
  const promotions = input.promotions
    .filter((promotion) => promotion.clubId === clubId)
    .map(({ toCompetitionId }) => achievement('promotion', toCompetitionId));
  return [
    ...titles,
    ...promotions,
    achievement('season_completed', input.leagueCompetitionId ?? ''),
  ];
}

const ALL: RankingPeriod = 'all';

/**
 * Avatar of a snapshot row, only when it still satisfies the profile
 * contract: a stale or unexpected value drops the avatar (the screen falls
 * back to a pixel one) instead of failing the whole leaderboard.
 */
const rowAvatar = (avatar: string | undefined) =>
  avatar !== undefined && coachAvatarSchema.safeParse(avatar).success
    ? { avatar }
    : {};

/** Snapshot period of a scope at an instant. */
export function rankingPeriodOf(scope: RankingScope, now: Date): string {
  return scope === 'monthly' ? rankingMonthOf(now.toISOString()) : ALL;
}

export interface RankingServiceDependencies {
  readonly store: RankingStorePort;
  readonly clock: Clock;
  readonly auth?: AuthPort;
}

export interface SnapshotRun {
  readonly generatedAt: string;
  readonly snapshots: readonly {
    scope: RankingScope;
    period: string;
    rows: number;
  }[];
}

/**
 * Leaderboards (ADR 0013): the scheduled job aggregates the ledger into
 * snapshots; public reads only ever touch snapshots.
 */
export class RankingService {
  public constructor(private readonly deps: RankingServiceDependencies) {}

  /**
   * Regenerates global, rise and the current month. On the first day of a
   * month it also closes the previous month with its final totals.
   */
  public async generateSnapshots(): Promise<SnapshotRun> {
    const now = this.deps.clock.now();
    const generatedAt = now.toISOString();
    const month = rankingMonthOf(generatedAt);
    const targets: { scope: RankingScope; period: string }[] = [
      { scope: 'global', period: ALL },
      { scope: 'rise', period: ALL },
      { scope: 'monthly', period: month },
    ];
    if (now.getUTCDate() === 1)
      targets.push({
        scope: 'monthly',
        period: rankingMonthOf(
          new Date(
            Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
          ).toISOString(),
        ),
      });
    const snapshots = [];
    for (const { scope, period } of targets) {
      const rows = await this.deps.store.aggregate(
        scope,
        scope === 'monthly' ? period : undefined,
      );
      await this.deps.store.replaceSnapshot(scope, period, rows, generatedAt);
      snapshots.push({ scope, period, rows: rows.length });
    }
    return { generatedAt, snapshots };
  }

  /** Public leaderboard from the latest snapshot (`GET /v1/rankings`). */
  public async leaderboard(rawQuery: unknown): Promise<RankingReadModel> {
    const query = rankingQuerySchema.parse(rawQuery);
    const period =
      query.scope === 'monthly'
        ? (query.period ?? rankingPeriodOf('monthly', this.deps.clock.now()))
        : ALL;
    const snapshot = await this.deps.store.snapshot(
      query.scope,
      period,
      query.limit,
    );
    return rankingReadModelSchema.parse({
      version: 1,
      rulesVersion: RANKING_RULES_VERSION,
      scope: query.scope,
      period,
      ...(snapshot === undefined ? {} : { generatedAt: snapshot.generatedAt }),
      total: snapshot?.total ?? 0,
      rows: (snapshot?.rows ?? []).map(
        ({ position, displayName, avatar, points }) => ({
          position,
          displayName,
          ...rowAvatar(avatar),
          points,
        }),
      ),
    });
  }

  /** The caller's position in each scope (`GET /v1/rankings/me`). */
  public async mine(bearer: string): Promise<MyRankingReadModel> {
    if (this.deps.auth === undefined)
      throw new AuthenticationError('rankings require authentication');
    const { userId } = await this.deps.auth.authenticate(bearer);
    const now = this.deps.clock.now();
    const targets = (['global', 'rise', 'monthly'] as const).map((scope) => ({
      scope,
      period: rankingPeriodOf(scope, now),
    }));
    const rows = await this.deps.store.positionsOf(userId, targets);
    return myRankingReadModelSchema.parse({
      version: 1,
      rulesVersion: RANKING_RULES_VERSION,
      entries: targets.map(({ scope, period }) => {
        const row = rows.find(
          (item) => item.scope === scope && item.period === period,
        );
        return {
          scope,
          period,
          ...(row === undefined
            ? {}
            : {
                position: row.position,
                points: row.points,
                displayName: row.displayName,
                ...rowAvatar(row.avatar),
                generatedAt: row.generatedAt,
              }),
        };
      }),
    });
  }
}
